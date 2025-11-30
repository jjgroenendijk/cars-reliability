#!/usr/bin/env python3
"""
Download RDW datasets from the Open Data API.

Unified script for fetching data - supports both streaming writes (for large
datasets in CI) and in-memory collection (for local development).

Usage:
    # Single dataset (streams to disk by default)
    python download.py inspections
    python download.py defect_codes
    python download.py vehicles --kentekens-from data/inspections.csv
    
    # All datasets at once (collects in memory, writes at end)
    python download.py --all
    
    # Force streaming or in-memory mode
    python download.py inspections --stream      # Stream to disk as data arrives
    python download.py inspections --no-stream   # Collect in memory first

Environment variables:
    RDW_APP_TOKEN: Socrata app token for higher rate limits
    DATA_SAMPLE_PERCENT: Percentage of data to fetch (1-100, default 100)
    FETCH_WORKERS: Number of parallel workers (default 2)
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from rdw_client import (
    DATASETS,
    DATA_DIR,
    StreamingCSVWriter,
    get_client,
    get_dataset_size,
    get_num_workers,
    get_sample_percent,
    log,
    parallel_fetch,
    parallel_fetch_to_writer,
    retry_with_backoff,
)


# Dataset-specific query configuration
# Note: No column filtering (select) allowed per requirements.
# Only filter allowed is voertuigsoort='Personenauto' to exclude trucks.
DATASET_CONFIGS = {
    "vehicles": {
        "extra_where": " AND voertuigsoort='Personenauto'",
        "limit_mult": 1,
    },
    "fuel": {
        "extra_where": "",
        "limit_mult": 1,
    },
    "defects_found": {
        "extra_where": "",
        "limit_mult": 20,  # A vehicle can have many defects
    },
    "inspections": {
        "extra_where": "",
        "limit_mult": 10,  # Multiple inspections per vehicle
    },
    "defect_codes": {
        "extra_where": "",
        "limit_mult": 1,
    },
}


def load_kentekens(csv_path: Path) -> list[str]:
    """Load unique kentekens from a CSV file."""
    log(f"Loading kentekens from {csv_path}...")
    df = pd.read_csv(csv_path, usecols=["kenteken"], dtype=str)
    kentekens = df["kenteken"].dropna().unique().tolist()
    log(f"  Found {len(kentekens):,} unique kentekens")
    return kentekens


def fetch_dataset(
    client,
    dataset: str,
    output_file: Path,
    kentekens: list[str] | None = None,
    stream: bool = True,
) -> pd.DataFrame | None:
    """
    Fetch a dataset and write to CSV.
    
    Args:
        client: Socrata client
        dataset: Dataset name (key in DATASETS)
        output_file: Path to write CSV output
        kentekens: Optional list of kentekens to filter by
        stream: If True, stream to disk; if False, collect in memory first
    
    Returns:
        DataFrame if stream=False, None if stream=True
    """
    config = DATASET_CONFIGS[dataset]
    
    # Special case: defect_codes is a small reference table
    if dataset == "defect_codes":
        log("Fetching defect_codes...")
        results = client.get(DATASETS["defect_codes"], limit=10000)
        
        with StreamingCSVWriter(output_file) as writer:
            writer.write_rows(results)
        
        log(f"  Written {len(results):,} records to {output_file}")
        return pd.DataFrame.from_records(results) if not stream else None
    
    # Build fetch function based on whether we have kentekens
    if kentekens:
        # Fetch by kenteken batches
        batch_size = 1000
        unique = list(set(kentekens))
        batches = [unique[i:i + batch_size] for i in range(0, len(unique), batch_size)]
        
        log(f"Fetching {dataset} for {len(unique):,} kentekens ({len(batches)} batches)")
        
        @retry_with_backoff()
        def fetch_batch(batch):
            kenteken_list = ",".join(f"'{k}'" for k in batch)
            where = f"kenteken IN ({kenteken_list}){config['extra_where']}"
            
            kwargs = {"where": where, "limit": batch_size * config["limit_mult"]}
            
            return client.get(DATASETS[dataset], **kwargs)
        
        items = batches
        fetch_fn = fetch_batch
        description = "batches"
    else:
        # Fetch by offset pagination
        total_size = get_dataset_size(client, DATASETS[dataset])
        sample_percent = get_sample_percent()
        limit = max(10000, int(total_size * sample_percent / 100))
        
        log(f"Fetching {dataset} ({sample_percent}% of {total_size:,} = {limit:,} records)")
        
        page_size = 50000
        offsets = list(range(0, limit, page_size))
        
        @retry_with_backoff()
        def fetch_page(offset):
            kwargs = {
                "limit": min(page_size, limit - offset),
                "offset": offset,
                "order": "kenteken",
            }
            # Only vehicles dataset has a filter (Personenauto only)
            if config["extra_where"]:
                kwargs["where"] = config["extra_where"].lstrip(" AND ")
            
            return client.get(DATASETS[dataset], **kwargs)
        
        items = offsets
        fetch_fn = fetch_page
        description = "pages"
    
    # Execute fetch
    if stream:
        with StreamingCSVWriter(output_file) as writer:
            parallel_fetch_to_writer(items, fetch_fn, writer, description=description)
            log(f"  Written {writer.row_count:,} records to {output_file}")
        return None
    else:
        results = parallel_fetch(items, fetch_fn, description=description)
        df = pd.DataFrame.from_records(results)
        df.to_csv(output_file, index=False)
        log(f"  Written {len(df):,} records to {output_file}")
        return df


def fetch_all(client, stream: bool = False):
    """
    Fetch all datasets in the correct order.
    
    Uses defects_found as the primary dataset to get kentekens,
    then fetches dependent datasets for those kentekens.
    """
    sample_percent = get_sample_percent()
    log(f"\n{'='*60}")
    log(f"DOWNLOADING ALL DATASETS ({sample_percent}% sample)")
    log(f"{'='*60}\n")
    
    # First, fetch defects_found (primary dataset)
    defects_df = fetch_dataset(
        client, "defects_found", DATA_DIR / "defects_found.csv", stream=False
    )
    
    # Fetch reference table
    fetch_dataset(client, "defect_codes", DATA_DIR / "defect_codes.csv", stream=stream)
    
    # Get unique kentekens from defects dataset
    kentekens = defects_df["kenteken"].unique().tolist()
    log(f"\nUsing {len(kentekens):,} unique kentekens from defects_found\n")
    
    # Fetch dependent datasets
    vehicles_df = fetch_dataset(
        client, "vehicles", DATA_DIR / "vehicles.csv", 
        kentekens=kentekens, stream=stream
    )
    fetch_dataset(
        client, "fuel", DATA_DIR / "fuel.csv",
        kentekens=kentekens, stream=stream
    )
    inspections_df = fetch_dataset(
        client, "inspections", DATA_DIR / "inspections.csv",
        kentekens=kentekens, stream=stream
    )
    
    # Save metadata
    log("\nWriting fetch_metadata.json...")
    full_dataset_size = get_dataset_size(client, DATASETS["defects_found"])
    
    # Count records (need to read files if we streamed)
    if stream:
        vehicles_count = sum(1 for _ in open(DATA_DIR / "vehicles.csv")) - 1
        inspections_count = sum(1 for _ in open(DATA_DIR / "inspections.csv")) - 1
    else:
        vehicles_count = len(vehicles_df) if vehicles_df is not None else 0
        inspections_count = len(inspections_df) if inspections_df is not None else 0
    
    metadata = {
        "sample_percent": sample_percent,
        "full_dataset_size": full_dataset_size,
        "fetched_defects": len(defects_df),
        "fetched_vehicles": vehicles_count,
        "fetched_inspections": inspections_count,
        "fetched_at": pd.Timestamp.now().isoformat(),
    }
    with open(DATA_DIR / "fetch_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    log(f"\nAll data saved to {DATA_DIR}/")


def main():
    parser = argparse.ArgumentParser(
        description="Download RDW datasets from Open Data API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python download.py inspections              # Fetch inspections (streams to disk)
    python download.py vehicles --kentekens-from data/inspections.csv
    python download.py --all                    # Fetch all datasets
    python download.py inspections --no-stream  # Collect in memory first
        """,
    )
    parser.add_argument(
        "dataset", 
        nargs="?",
        choices=list(DATASETS.keys()), 
        help="Dataset to fetch"
    )
    parser.add_argument(
        "--all", 
        action="store_true",
        help="Fetch all datasets in order"
    )
    parser.add_argument(
        "--kentekens-from", 
        type=Path, 
        help="CSV file to load kentekens from (for dependent datasets)"
    )
    parser.add_argument(
        "--output", 
        type=Path, 
        help="Output CSV file (default: data/<dataset>.csv)"
    )
    parser.add_argument(
        "--stream", 
        action="store_true",
        default=None,
        help="Stream results directly to disk (default for single datasets)"
    )
    parser.add_argument(
        "--no-stream", 
        action="store_true",
        help="Collect results in memory before writing"
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.all and not args.dataset:
        parser.error("Either specify a dataset or use --all")
    
    if args.all and args.dataset:
        parser.error("Cannot specify both a dataset and --all")
    
    # Determine streaming mode
    if args.no_stream:
        stream = False
    elif args.stream:
        stream = True
    else:
        # Default: stream for single datasets, no stream for --all
        stream = not args.all
    
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    client = get_client()
    
    try:
        if args.all:
            fetch_all(client, stream=stream)
        else:
            output_file = args.output or DATA_DIR / f"{args.dataset}.csv"
            
            log(f"\n{'='*60}")
            log(f"DOWNLOADING: {args.dataset}")
            log(f"Output: {output_file}")
            log(f"Mode: {'streaming' if stream else 'in-memory'}")
            log(f"Sample: {get_sample_percent()}%, Workers: {get_num_workers()}")
            log(f"{'='*60}\n")
            
            # Load kentekens if provided
            kentekens = None
            if args.kentekens_from:
                if not args.kentekens_from.exists():
                    log(f"Error: {args.kentekens_from} not found")
                    sys.exit(1)
                kentekens = load_kentekens(args.kentekens_from)
            elif args.dataset in ("vehicles", "fuel"):
                log(f"Error: --kentekens-from required for {args.dataset}")
                log(f"Usage: python download.py {args.dataset} --kentekens-from data/inspections.csv")
                sys.exit(1)
            
            fetch_dataset(client, args.dataset, output_file, kentekens=kentekens, stream=stream)
            log(f"\nDone! Output: {output_file}")
    
    finally:
        client.close()


if __name__ == "__main__":
    main()
