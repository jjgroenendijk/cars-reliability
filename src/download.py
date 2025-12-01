#!/usr/bin/env python3
"""
Download RDW datasets from the Open Data API.

Usage:
    python download.py inspections                # Fetch inspections (streams to disk)
    python download.py defect_codes               # Fetch reference table
    python download.py vehicles --kentekens-from data/inspections.csv
    python download.py --all                      # Fetch all datasets

Environment variables:
    RDW_APP_TOKEN: Socrata app token for higher rate limits
    DATA_SAMPLE_PERCENT: Percentage of data to fetch (1-100, default 100)
    FETCH_WORKERS: Number of parallel workers (default 2)
"""

import argparse
import csv
import json
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import wraps
from pathlib import Path
from threading import Lock

import pandas as pd
from sodapy import Socrata

# Optional: psutil for memory/CPU stats (graceful fallback if not installed)
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# Configuration
RDW_DOMAIN = "opendata.rdw.nl"
DATA_DIR = Path(__file__).parent.parent / "data"

DATASETS = {
    "vehicles": "m9d7-ebf2",       # Gekentekende voertuigen
    "defects_found": "a34c-vvps",  # Geconstateerde Gebreken
    "defect_codes": "hx2c-gt7k",   # Gebreken (reference table)
    "inspections": "sgfe-77wx",    # Meldingen Keuringsinstantie
    "fuel": "8ys7-d773",           # Brandstof data
}

# Dataset-specific configuration
DATASET_CONFIGS = {
    "vehicles": {"where": "voertuigsoort='Personenauto'", "limit_mult": 1},
    "fuel": {"where": None, "limit_mult": 1},
    "defects_found": {"where": None, "limit_mult": 20},
    "inspections": {"where": None, "limit_mult": 10},
    "defect_codes": {"where": None, "limit_mult": 1},
}


# =============================================================================
# Utilities
# =============================================================================

def log(msg: str) -> None:
    """Print with immediate flush for CI visibility."""
    print(msg, flush=True)


def stats_log() -> None:
    """Log system resource usage (memory, CPU, disk)."""
    parts = []
    
    # Memory stats
    if HAS_PSUTIL:
        mem = psutil.virtual_memory()
        parts.append(f"RAM: {mem.used / 1024**3:.1f}/{mem.total / 1024**3:.1f}GB ({mem.percent}%)")
        
        # CPU
        cpu = psutil.cpu_percent(interval=0.1)
        parts.append(f"CPU: {cpu}%")
    
    # Disk stats (works without psutil)
    try:
        disk = shutil.disk_usage(DATA_DIR)
        parts.append(f"Disk: {disk.used / 1024**3:.1f}/{disk.total / 1024**3:.1f}GB ({100 * disk.used / disk.total:.0f}%)")
    except Exception:
        pass
    
    # Data dir size
    try:
        if DATA_DIR.exists():
            data_size = sum(f.stat().st_size for f in DATA_DIR.glob("*") if f.is_file())
            parts.append(f"data/: {data_size / 1024**2:.1f}MB")
    except Exception:
        pass
    
    if parts:
        log(f"  [STATS] {' | '.join(parts)}")


def env_sample_percent() -> int:
    """Get sample percentage from environment (1-100)."""
    return max(1, min(100, int(os.environ.get("DATA_SAMPLE_PERCENT", "100"))))


def env_workers() -> int:
    """Get worker count from environment (default 2)."""
    return int(os.environ.get("FETCH_WORKERS", "2"))


def retry_with_backoff(max_retries: int = 5, base_delay: float = 2.0):
    """Decorator for exponential backoff retries."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exc = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        log(f"  Retry {attempt + 1}/{max_retries} after {delay:.0f}s: {e}")
                        time.sleep(delay)
            raise last_exc
        return wrapper
    return decorator


# =============================================================================
# CSV Writer
# =============================================================================

class CSVWriter:
    """Thread-safe CSV writer with immediate disk flush and resume support."""
    
    def __init__(self, filepath: Path, resume: bool = False):
        self.filepath = filepath
        self.resume = resume
        self._file = None
        self._writer = None
        self._lock = Lock()
        self.row_count = 0
        self._existing_count = 0
        self._fieldnames = None
    
    def __enter__(self):
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        
        if self.resume and self.filepath.exists():
            # Count existing rows and get fieldnames for append mode
            self._existing_count = self._count_existing_rows()
            if self._existing_count > 0:
                log(f"  Resuming: found {self._existing_count:,} existing records")
                self._file = open(self.filepath, 'a', newline='', encoding='utf-8')
            else:
                self._file = open(self.filepath, 'w', newline='', encoding='utf-8')
        else:
            self._file = open(self.filepath, 'w', newline='', encoding='utf-8')
        return self
    
    def _count_existing_rows(self) -> int:
        """Count rows in existing file and capture fieldnames."""
        try:
            with open(self.filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                self._fieldnames = reader.fieldnames
                return sum(1 for _ in reader)
        except Exception:
            return 0
    
    def __exit__(self, *_):
        if self._file:
            self._file.close()
    
    @property
    def existing_count(self) -> int:
        """Number of records already in file (for resume)."""
        return self._existing_count
    
    def rows_write(self, rows: list[dict]) -> None:
        """Write rows to CSV (thread-safe)."""
        if not rows:
            return
        with self._lock:
            if self._writer is None:
                # Use existing fieldnames if resuming, otherwise use first row's keys
                fieldnames = self._fieldnames or rows[0].keys()
                self._writer = csv.DictWriter(self._file, fieldnames=fieldnames, extrasaction='ignore')
                if self._existing_count == 0:
                    self._writer.writeheader()
            for row in rows:
                self._writer.writerow(row)
            self._file.flush()
            os.fsync(self._file.fileno())
            self.row_count += len(rows)


# =============================================================================
# Parallel Fetching
# =============================================================================

def items_fetch_parallel(items: list, fetch_fn, writer: CSVWriter | None = None, 
                         stream_to_disk: bool = True, description: str = "items") -> list[dict]:
    """
    Fetch items in parallel with progress logging.
    
    Args:
        items: Items to fetch (offsets or kenteken batches)
        fetch_fn: Function that fetches data for one item
        writer: CSV writer (required if stream_to_disk=True)
        stream_to_disk: Write immediately vs collect in memory
        description: Label for progress logging
    
    Returns:
        Results list (empty if streaming)
    """
    if stream_to_disk and not writer:
        raise ValueError("writer required when stream_to_disk=True")
    
    num_workers = env_workers()
    total = len(items)
    start = time.time()
    log(f"  Fetching {total} {description} with {num_workers} workers...")
    
    results = []
    lock = Lock()
    records = [0]  # Use list to allow modification in nested function
    errors = [0]
    done = [0]
    
    def fetch_with_delay(item):
        time.sleep(0.1)
        try:
            return fetch_fn(item), None
        except Exception as e:
            return [], str(e)
    
    # Process in chunks to limit memory usage (max 20 concurrent items in memory)
    chunk_size = max(20, num_workers * 4)
    
    for chunk_start in range(0, len(items), chunk_size):
        chunk = items[chunk_start:chunk_start + chunk_size]
        
        with ThreadPoolExecutor(max_workers=num_workers) as pool:
            futures = {pool.submit(fetch_with_delay, item): item for item in chunk}
            
            for future in as_completed(futures):
                batch, error = future.result()
                done[0] += 1
                
                if error:
                    errors[0] += 1
                    log(f"  Warning: {error}")
                elif batch:
                    if stream_to_disk:
                        writer.rows_write(batch)
                    else:
                        with lock:
                            results.extend(batch)
                    records[0] += len(batch)
                
                # Log progress at 10% intervals with system stats
                if done[0] % max(1, total // 10) == 0 or done[0] == total:
                    elapsed = time.time() - start
                    rate = records[0] / elapsed if elapsed > 0 else 0
                    log(f"  Progress: {done[0]}/{total} ({done[0] * 100 // total}%) - {records[0]:,} records ({rate:,.0f}/s)")
                    stats_log()
    
    elapsed = time.time() - start
    log(f"  Completed: {records[0]:,} records in {elapsed:.1f}s, {errors[0]} errors")
    stats_log()
    return results


# =============================================================================
# Dataset Fetching
# =============================================================================

def dataset_fetch(client: Socrata, dataset: str, output: Path,
                  kentekens: list[str] | None = None, stream: bool = True,
                  partition: str | None = None) -> pd.DataFrame | None:
    """
    Fetch a dataset and write to CSV.
    
    Args:
        partition: Optional kenteken prefix (0-9, A-Z) to filter data.
                   Used for parallel job splitting.
    
    Returns DataFrame if stream=False, None otherwise.
    """
    config = DATASET_CONFIGS[dataset]
    dataset_id = DATASETS[dataset]
    
    partition_suffix = f" (partition: {partition})" if partition else ""
    log(f"\n--- Starting: {dataset}{partition_suffix} ---")
    stats_log()
    
    # Small reference table - fetch directly
    if dataset == "defect_codes":
        log("Fetching defect_codes...")
        rows = client.get(dataset_id, limit=10000)
        with CSVWriter(output) as w:
            w.rows_write(rows)
        log(f"  Written {len(rows):,} records")
        stats_log()
        return None if stream else pd.DataFrame.from_records(rows)
    
    # Build fetch function and items
    if kentekens:
        items, fetch_fn, desc = _kenteken_batches_build(client, dataset_id, kentekens, config)
    else:
        items, fetch_fn, desc = _offset_pages_build(client, dataset_id, config, partition=partition)
    
    # Execute fetch with resume support
    if stream:
        with CSVWriter(output, resume=True) as w:
            # Skip items that were already fetched (based on existing row count)
            if w.existing_count > 0:
                items = _items_skip_completed(items, w.existing_count, desc)
            
            if not items:
                log(f"  Already complete: {w.existing_count:,} records in {output}")
            else:
                items_fetch_parallel(items, fetch_fn, writer=w, stream_to_disk=True, description=desc)
                total_records = w.existing_count + w.row_count
                log(f"  Written {w.row_count:,} new records ({total_records:,} total) to {output}")
        return None
    
    rows = items_fetch_parallel(items, fetch_fn, stream_to_disk=False, description=desc)
    df = pd.DataFrame.from_records(rows)
    df.to_csv(output, index=False)
    log(f"  Written {len(df):,} records to {output}")
    return df


def _items_skip_completed(items: list, existing_count: int, desc: str) -> list:
    """Skip items that were already fetched based on existing record count."""
    if desc == "pages":
        # For offset-based pagination, calculate how many pages to skip
        page_size = 10000
        pages_done = existing_count // page_size
        if pages_done > 0:
            log(f"  Skipping {pages_done} completed pages ({existing_count:,} records)")
            return items[pages_done:]
    elif desc == "batches":
        # For kenteken batches, estimate batches completed (1000 kentekens per batch)
        # This is approximate since not all kentekens return equal records
        batch_size = 1000
        batches_done = existing_count // batch_size
        if batches_done > 0:
            log(f"  Skipping ~{batches_done} completed batches ({existing_count:,} records)")
            return items[batches_done:]
    return items


def _kenteken_batches_build(client, dataset_id, kentekens, config):
    """Build batched fetch for kenteken filtering."""
    batch_size = 1000
    unique = list(set(kentekens))
    batches = [unique[i:i + batch_size] for i in range(0, len(unique), batch_size)]
    log(f"Fetching for {len(unique):,} kentekens ({len(batches)} batches)")
    
    @retry_with_backoff()
    def fetch(batch):
        klist = ",".join(f"'{k}'" for k in batch)
        where = f"kenteken IN ({klist})"
        if config["where"]:
            where += f" AND {config['where']}"
        return client.get(dataset_id, where=where, limit=batch_size * config["limit_mult"])
    
    return batches, fetch, "batches"


def _offset_pages_build(client, dataset_id, config, partition: str | None = None):
    """Build paginated fetch with offset.
    
    Args:
        partition: Optional kenteken prefix (0-9, A-Z) to filter by.
    """
    # Get total count (with partition filter if specified)
    if partition:
        where_count = f"kenteken LIKE '{partition}%'"
        total = _dataset_size_get(client, dataset_id, where=where_count)
        log(f"Partition '{partition}': {total:,} records")
    else:
        total = _dataset_size_get(client, dataset_id)
    
    sample = env_sample_percent()
    limit = max(10000, int(total * sample / 100))
    log(f"Fetching {sample}% of {total:,} = {limit:,} records")
    
    # Smaller page size to reduce memory pressure per request
    page_size = 10000
    offsets = list(range(0, limit, page_size))
    
    @retry_with_backoff()
    def fetch(offset):
        kwargs = {"limit": min(page_size, limit - offset), "offset": offset, "order": "kenteken"}
        # Build where clause
        where_parts = []
        if partition:
            where_parts.append(f"kenteken LIKE '{partition}%'")
        if config["where"]:
            where_parts.append(config["where"])
        if where_parts:
            kwargs["where"] = " AND ".join(where_parts)
        return client.get(dataset_id, **kwargs)
    
    return offsets, fetch, "pages"


def _dataset_size_get(client, dataset_id, where: str | None = None) -> int:
    """Get total record count for a dataset."""
    try:
        kwargs = {"select": "count(*)", "limit": 1}
        if where:
            kwargs["where"] = where
        result = client.get(dataset_id, **kwargs)
        return int(result[0]["count"]) if result else 25_000_000
    except Exception:
        return 25_000_000


def _client_create() -> Socrata:
    """Create Socrata client."""
    token = os.environ.get("RDW_APP_TOKEN")
    if token:
        log("Using app token for higher rate limits")
    return Socrata(RDW_DOMAIN, token, timeout=60)


# =============================================================================
# High-level Commands
# =============================================================================

def datasets_fetch_all(client: Socrata, stream: bool = False):
    """Fetch all datasets in order."""
    sample = env_sample_percent()
    log(f"\n{'='*60}")
    log(f"DOWNLOADING ALL DATASETS ({sample}% sample)")
    log(f"{'='*60}\n")
    
    # Primary dataset
    defects_df = dataset_fetch(client, "defects_found", DATA_DIR / "defects_found.csv", stream=False)
    dataset_fetch(client, "defect_codes", DATA_DIR / "defect_codes.csv", stream=stream)
    
    # Dependent datasets
    kentekens = defects_df["kenteken"].unique().tolist()
    log(f"\nUsing {len(kentekens):,} unique kentekens\n")
    
    vehicles_df = dataset_fetch(client, "vehicles", DATA_DIR / "vehicles.csv", kentekens=kentekens, stream=stream)
    dataset_fetch(client, "fuel", DATA_DIR / "fuel.csv", kentekens=kentekens, stream=stream)
    inspections_df = dataset_fetch(client, "inspections", DATA_DIR / "inspections.csv", kentekens=kentekens, stream=stream)
    
    # Metadata
    metadata = {
        "sample_percent": sample,
        "full_dataset_size": _dataset_size_get(client, DATASETS["defects_found"]),
        "fetched_defects": len(defects_df),
        "fetched_vehicles": len(vehicles_df) if vehicles_df is not None else _file_lines_count(DATA_DIR / "vehicles.csv"),
        "fetched_inspections": len(inspections_df) if inspections_df is not None else _file_lines_count(DATA_DIR / "inspections.csv"),
        "fetched_at": pd.Timestamp.now().isoformat(),
    }
    with open(DATA_DIR / "fetch_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    log(f"\nAll data saved to {DATA_DIR}/")


def _file_lines_count(path: Path) -> int:
    """Count lines in file (minus header)."""
    return sum(1 for _ in open(path)) - 1


def kentekens_load(csv_path: Path) -> list[str]:
    """Load unique kentekens from CSV."""
    log(f"Loading kentekens from {csv_path}...")
    df = pd.read_csv(csv_path, usecols=["kenteken"], dtype=str)
    kentekens = df["kenteken"].dropna().unique().tolist()
    log(f"  Found {len(kentekens):,} unique kentekens")
    return kentekens


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Download RDW datasets",
        epilog="Examples:\n  python download.py inspections\n  python download.py inspections --partition A\n  python download.py --all",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("dataset", nargs="?", choices=list(DATASETS.keys()))
    parser.add_argument("--all", action="store_true", help="Fetch all datasets")
    parser.add_argument("--kentekens-from", type=Path, help="CSV with kentekens to filter by")
    parser.add_argument("--output", type=Path, help="Output file (default: data/<dataset>.csv)")
    parser.add_argument("--stream", action="store_true", default=None, help="Stream to disk")
    parser.add_argument("--no-stream", action="store_true", help="Collect in memory first")
    parser.add_argument("--partition", type=str, 
                        help="Kenteken prefix to filter (0-9, A-Z). For parallel job splitting.")
    
    args = parser.parse_args()
    
    if not args.all and not args.dataset:
        parser.error("Specify a dataset or use --all")
    if args.all and args.dataset:
        parser.error("Cannot use both dataset and --all")
    if args.partition and args.all:
        parser.error("Cannot use --partition with --all")
    if args.partition and len(args.partition) != 1:
        parser.error("--partition must be a single character (0-9, A-Z)")
    
    stream = not args.no_stream if args.no_stream else (args.stream if args.stream else not args.all)
    
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    client = _client_create()
    
    try:
        if args.all:
            datasets_fetch_all(client, stream=stream)
        else:
            # Determine output filename (include partition suffix if specified)
            if args.output:
                output = args.output
            elif args.partition:
                output = DATA_DIR / f"{args.dataset}_{args.partition}.csv"
            else:
                output = DATA_DIR / f"{args.dataset}.csv"
            
            log(f"\n{'='*60}")
            log(f"DOWNLOADING: {args.dataset}" + (f" (partition: {args.partition})" if args.partition else ""))
            log(f"Output: {output}, Mode: {'stream' if stream else 'memory'}")
            log(f"Sample: {env_sample_percent()}%, Workers: {env_workers()}")
            log(f"{'='*60}\n")
            
            kentekens = None
            if args.kentekens_from:
                if not args.kentekens_from.exists():
                    sys.exit(f"Error: {args.kentekens_from} not found")
                kentekens = kentekens_load(args.kentekens_from)
            elif args.dataset in ("vehicles", "fuel"):
                sys.exit(f"Error: --kentekens-from required for {args.dataset}")
            
            dataset_fetch(client, args.dataset, output, kentekens=kentekens, stream=stream, partition=args.partition)
            log(f"\nDone! Output: {output}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
