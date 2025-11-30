#!/usr/bin/env python3
"""
Fetch a single dataset from RDW Open Data API with streaming CSV writes.

This script is designed for parallel CI jobs - each job fetches one dataset.
For fetching all datasets in sequence, use fetch_pipeline.py instead.

Usage:
    python fetch_single.py inspections              # Fetch all inspections (primary)
    python fetch_single.py defect_codes             # Fetch reference table
    python fetch_single.py vehicles --kentekens-from data/inspections.csv
    python fetch_single.py fuel --kentekens-from data/inspections.csv
    python fetch_single.py defects_found --kentekens-from data/inspections.csv

Environment variables:
    RDW_APP_TOKEN: Socrata app token for higher rate limits
    DATA_SAMPLE_PERCENT: Percentage of data to fetch (1-100, default 100)
    FETCH_WORKERS: Number of parallel workers (default 2)
"""

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    retry_with_backoff,
)


def load_kentekens(csv_path: Path) -> list[str]:
    """Load unique kentekens from a CSV file."""
    log(f"Loading kentekens from {csv_path}...")
    df = pd.read_csv(csv_path, usecols=["kenteken"], dtype=str)
    kentekens = df["kenteken"].dropna().unique().tolist()
    log(f"  Found {len(kentekens):,} unique kentekens")
    return kentekens


def fetch_inspections_all(client, output_file: Path):
    """Fetch ALL inspection results with streaming write (primary dataset)."""
    total_size = get_dataset_size(client, DATASETS["inspections"])
    sample_percent = get_sample_percent()
    limit = max(10000, int(total_size * sample_percent / 100))
    num_workers = get_num_workers()
    
    log(f"Fetching inspections ({sample_percent}% of {total_size:,} = {limit:,} records)")
    
    page_size = 50000
    offsets = list(range(0, limit, page_size))
    total_pages = len(offsets)
    
    @retry_with_backoff()
    def fetch_page(offset):
        time.sleep(0.1)
        return client.get(
            DATASETS["inspections"],
            select="kenteken,meld_datum_door_keuringsinstantie,soort_melding_ki_omschrijving,vervaldatum_keuring",
            where="soort_erkenning_omschrijving='APK Lichte voertuigen'",
            limit=min(page_size, limit - offset),
            offset=offset,
            order="kenteken",
        )
    
    with StreamingCSVWriter(output_file) as writer:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {executor.submit(fetch_page, o): o for o in offsets}
            completed = 0
            
            for future in as_completed(futures):
                completed += 1
                try:
                    results = future.result()
                    writer.write_rows(results)
                except Exception as e:
                    log(f"  Error: {e}")
                
                if completed % max(1, total_pages // 10) == 0 or completed == total_pages:
                    log(f"  Progress: {completed}/{total_pages} pages ({completed * 100 // total_pages}%)")
        
        log(f"  Written {writer.row_count:,} records to {output_file}")


def fetch_defects_found_all(client, output_file: Path):
    """Fetch ALL defects found with streaming write."""
    total_size = get_dataset_size(client, DATASETS["defects_found"])
    sample_percent = get_sample_percent()
    limit = max(10000, int(total_size * sample_percent / 100))
    num_workers = get_num_workers()
    
    log(f"Fetching defects_found ({sample_percent}% of {total_size:,} = {limit:,} records)")
    
    page_size = 50000
    offsets = list(range(0, limit, page_size))
    total_pages = len(offsets)
    
    @retry_with_backoff()
    def fetch_page(offset):
        time.sleep(0.1)
        return client.get(
            DATASETS["defects_found"],
            limit=min(page_size, limit - offset),
            offset=offset,
            order="kenteken",
        )
    
    with StreamingCSVWriter(output_file) as writer:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {executor.submit(fetch_page, o): o for o in offsets}
            completed = 0
            
            for future in as_completed(futures):
                completed += 1
                try:
                    results = future.result()
                    writer.write_rows(results)
                except Exception as e:
                    log(f"  Error: {e}")
                
                if completed % max(1, total_pages // 10) == 0 or completed == total_pages:
                    log(f"  Progress: {completed}/{total_pages} pages ({completed * 100 // total_pages}%)")
        
        log(f"  Written {writer.row_count:,} records to {output_file}")


def fetch_defect_codes(client, output_file: Path):
    """Fetch defect codes reference table."""
    log("Fetching defect_codes...")
    results = client.get(DATASETS["defect_codes"], limit=10000)
    
    with StreamingCSVWriter(output_file) as writer:
        writer.write_rows(results)
    
    log(f"  Written {len(results):,} records to {output_file}")


def fetch_for_kentekens(client, dataset: str, kentekens: list[str], output_file: Path):
    """Fetch dataset for specific kentekens with streaming write."""
    num_workers = get_num_workers()
    batch_size = 1000
    
    unique = list(set(kentekens))
    batches = [unique[i:i + batch_size] for i in range(0, len(unique), batch_size)]
    total = len(batches)
    
    log(f"Fetching {dataset} for {len(unique):,} kentekens ({total} batches, {num_workers} workers)")
    
    # Dataset-specific query configuration
    configs = {
        "vehicles": {
            "select": "kenteken,merk,handelsbenaming,voertuigsoort,datum_eerste_toelating,vervaldatum_apk,cilinderinhoud,aantal_cilinders,massa_rijklaar,eerste_kleur,inrichting",
            "extra_where": " AND voertuigsoort='Personenauto'",
            "limit_mult": 1,
        },
        "fuel": {
            "select": None,
            "extra_where": " AND brandstof_volgnummer='1'",
            "limit_mult": 1,
        },
        "defects_found": {
            "select": None,
            "extra_where": "",
            "limit_mult": 20,  # A vehicle can have many defects
        },
        "inspections": {
            "select": "kenteken,meld_datum_door_keuringsinstantie,soort_melding_ki_omschrijving,vervaldatum_keuring",
            "extra_where": " AND soort_erkenning_omschrijving='APK Lichte voertuigen'",
            "limit_mult": 10,  # Multiple inspections per vehicle
        },
    }
    
    config = configs[dataset]
    
    @retry_with_backoff()
    def fetch_batch(batch):
        time.sleep(0.1)
        kenteken_list = ",".join(f"'{k}'" for k in batch)
        where = f"kenteken IN ({kenteken_list}){config['extra_where']}"
        
        kwargs = {
            "where": where,
            "limit": batch_size * config["limit_mult"],
        }
        if config["select"]:
            kwargs["select"] = config["select"]
        
        return client.get(DATASETS[dataset], **kwargs)
    
    with StreamingCSVWriter(output_file) as writer:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {executor.submit(fetch_batch, b): i for i, b in enumerate(batches)}
            completed = 0
            
            for future in as_completed(futures):
                completed += 1
                try:
                    results = future.result()
                    writer.write_rows(results)
                except Exception as e:
                    log(f"  Batch error: {e}")
                
                if completed % max(1, total // 10) == 0 or completed == total:
                    log(f"  Progress: {completed}/{total} batches ({completed * 100 // total}%)")
        
        log(f"  Written {writer.row_count:,} records to {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Fetch a single RDW dataset")
    parser.add_argument("dataset", choices=list(DATASETS.keys()), help="Dataset to fetch")
    parser.add_argument("--kentekens-from", type=Path, help="CSV file to load kentekens from")
    parser.add_argument("--output", type=Path, help="Output CSV file (default: data/<dataset>.csv)")
    args = parser.parse_args()
    
    output_file = args.output or DATA_DIR / f"{args.dataset}.csv"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    log(f"\n{'='*60}")
    log(f"FETCH DATASET: {args.dataset}")
    log(f"Output: {output_file}")
    log(f"Sample: {get_sample_percent()}%, Workers: {get_num_workers()}")
    log(f"{'='*60}\n")
    
    client = get_client()
    
    try:
        # Reference table: no dependencies
        if args.dataset == "defect_codes":
            fetch_defect_codes(client, output_file)
        
        # Primary datasets: can fetch all without kentekens
        elif args.dataset == "inspections" and not args.kentekens_from:
            fetch_inspections_all(client, output_file)
        
        elif args.dataset == "defects_found" and not args.kentekens_from:
            fetch_defects_found_all(client, output_file)
        
        # Dependent datasets: need kentekens
        elif args.dataset in ("vehicles", "fuel", "defects_found", "inspections"):
            if not args.kentekens_from:
                log(f"Error: --kentekens-from required for {args.dataset}")
                log(f"Usage: python fetch_single.py {args.dataset} --kentekens-from data/inspections.csv")
                sys.exit(1)
            if not args.kentekens_from.exists():
                log(f"Error: {args.kentekens_from} not found")
                sys.exit(1)
            
            kentekens = load_kentekens(args.kentekens_from)
            fetch_for_kentekens(client, args.dataset, kentekens, output_file)
    
    finally:
        client.close()
    
    log(f"\nDone! Output: {output_file}")


if __name__ == "__main__":
    main()
