#!/usr/bin/env python3
"""
Fetch a single dataset from RDW Open Data API.

Usage:
    python fetch_dataset.py defects_found
    python fetch_dataset.py defect_codes
    python fetch_dataset.py vehicles --kentekens-from data/defects_found.csv
    python fetch_dataset.py fuel --kentekens-from data/defects_found.csv
    python fetch_dataset.py inspections --kentekens-from data/defects_found.csv

Environment variables:
    RDW_APP_TOKEN: Socrata app token for higher rate limits
    DATA_SAMPLE_PERCENT: Percentage of data to fetch (1-100, default 100)
    FETCH_WORKERS: Number of parallel workers (default 2)
"""

import argparse
import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import wraps
from pathlib import Path
from threading import Lock

import pandas as pd
from sodapy import Socrata

# RDW Open Data domain and dataset IDs
RDW_DOMAIN = "opendata.rdw.nl"
DATASETS = {
    "vehicles": "m9d7-ebf2",
    "defects_found": "a34c-vvps",
    "defect_codes": "hx2c-gt7k",
    "inspections": "sgfe-77wx",
    "fuel": "8ys7-d773",
}

DATA_DIR = Path(__file__).parent.parent / "data"


def log(msg: str) -> None:
    """Print with immediate flush for CI visibility."""
    print(msg, flush=True)


def is_ci() -> bool:
    return os.environ.get("CI", "").lower() == "true" or os.environ.get("GITHUB_ACTIONS") == "true"


def retry_with_backoff(max_retries: int = 5, base_delay: float = 2.0):
    """Retry with exponential backoff."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        log(f"  Retry {attempt + 1}/{max_retries} after {delay:.0f}s: {type(e).__name__}")
                        time.sleep(delay)
            raise last_exception
        return wrapper
    return decorator


class StreamingCSVWriter:
    """Thread-safe CSV writer that flushes to disk immediately."""
    
    def __init__(self, filepath: Path):
        self.filepath = filepath
        self._file = None
        self._writer = None
        self._lock = Lock()
        self._row_count = 0
        self._fieldnames = None
    
    def __enter__(self):
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        self._file = open(self.filepath, 'w', newline='', encoding='utf-8')
        return self
    
    def __exit__(self, *args):
        if self._file:
            self._file.close()
    
    def write_rows(self, rows: list[dict]) -> int:
        if not rows:
            return 0
        
        with self._lock:
            if self._writer is None:
                self._fieldnames = list(rows[0].keys())
                self._writer = csv.DictWriter(self._file, fieldnames=self._fieldnames, extrasaction='ignore')
                self._writer.writeheader()
            
            for row in rows:
                self._writer.writerow(row)
            
            self._file.flush()
            os.fsync(self._file.fileno())
            self._row_count += len(rows)
            return len(rows)
    
    @property
    def row_count(self) -> int:
        return self._row_count


def get_client() -> Socrata:
    app_token = os.environ.get("RDW_APP_TOKEN")
    if app_token:
        log("Using app token for higher rate limits")
    return Socrata(RDW_DOMAIN, app_token, timeout=60)


def get_sample_percent() -> int:
    return max(1, min(100, int(os.environ.get("DATA_SAMPLE_PERCENT", "100"))))


def get_num_workers() -> int:
    return int(os.environ.get("FETCH_WORKERS", "2"))


def get_dataset_size(client: Socrata, dataset_id: str) -> int:
    try:
        result = client.get(dataset_id, select="count(*)", limit=1)
        return int(result[0]["count"]) if result else 25_000_000
    except Exception:
        return 25_000_000


def load_kentekens(csv_path: Path) -> list[str]:
    """Load unique kentekens from a CSV file."""
    log(f"Loading kentekens from {csv_path}...")
    df = pd.read_csv(csv_path, usecols=["kenteken"], dtype=str)
    kentekens = df["kenteken"].dropna().unique().tolist()
    log(f"  Found {len(kentekens):,} unique kentekens")
    return kentekens


def fetch_defects_found(client: Socrata, output_file: Path):
    """Fetch defects found with streaming write."""
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


def fetch_defect_codes(client: Socrata, output_file: Path):
    """Fetch defect codes reference table."""
    log("Fetching defect_codes...")
    results = client.get(DATASETS["defect_codes"], limit=10000)
    
    with StreamingCSVWriter(output_file) as writer:
        writer.write_rows(results)
    
    log(f"  Written {len(results):,} records to {output_file}")


def fetch_vehicles(client: Socrata, kentekens: list[str], output_file: Path):
    """Fetch vehicle info for kentekens with streaming write."""
    num_workers = get_num_workers()
    batch_size = 1000
    
    columns = [
        "kenteken", "merk", "handelsbenaming", "voertuigsoort",
        "datum_eerste_toelating", "vervaldatum_apk", "cilinderinhoud",
        "aantal_cilinders", "massa_rijklaar", "eerste_kleur", "inrichting",
    ]
    
    unique = list(set(kentekens))
    batches = [unique[i:i + batch_size] for i in range(0, len(unique), batch_size)]
    total = len(batches)
    
    log(f"Fetching vehicles for {len(unique):,} kentekens ({total} batches, {num_workers} workers)")
    
    @retry_with_backoff()
    def fetch_batch(batch):
        time.sleep(0.1)
        kenteken_list = ",".join(f"'{k}'" for k in batch)
        return client.get(
            DATASETS["vehicles"],
            select=",".join(columns),
            where=f"kenteken IN ({kenteken_list}) AND voertuigsoort='Personenauto'",
            limit=batch_size,
        )
    
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


def fetch_fuel(client: Socrata, kentekens: list[str], output_file: Path):
    """Fetch fuel info for kentekens with streaming write."""
    num_workers = get_num_workers()
    batch_size = 1000
    
    unique = list(set(kentekens))
    batches = [unique[i:i + batch_size] for i in range(0, len(unique), batch_size)]
    total = len(batches)
    
    log(f"Fetching fuel for {len(unique):,} kentekens ({total} batches, {num_workers} workers)")
    
    @retry_with_backoff()
    def fetch_batch(batch):
        time.sleep(0.1)
        kenteken_list = ",".join(f"'{k}'" for k in batch)
        return client.get(
            DATASETS["fuel"],
            where=f"kenteken IN ({kenteken_list}) AND brandstof_volgnummer='1'",
            limit=batch_size,
        )
    
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


def fetch_inspections(client: Socrata, kentekens: list[str], output_file: Path):
    """Fetch inspection results for kentekens with streaming write."""
    num_workers = get_num_workers()
    batch_size = 1000
    
    unique = list(set(kentekens))
    batches = [unique[i:i + batch_size] for i in range(0, len(unique), batch_size)]
    total = len(batches)
    
    log(f"Fetching inspections for {len(unique):,} kentekens ({total} batches, {num_workers} workers)")
    
    @retry_with_backoff()
    def fetch_batch(batch):
        time.sleep(0.1)
        kenteken_list = ",".join(f"'{k}'" for k in batch)
        return client.get(
            DATASETS["inspections"],
            select="kenteken,meld_datum_door_keuringsinstantie,soort_melding_ki_omschrijving,vervaldatum_keuring",
            where=f"kenteken IN ({kenteken_list}) AND soort_erkenning_omschrijving='APK Lichte voertuigen'",
            limit=batch_size * 10,  # Multiple inspections per vehicle
        )
    
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
        if args.dataset == "defects_found":
            fetch_defects_found(client, output_file)
        
        elif args.dataset == "defect_codes":
            fetch_defect_codes(client, output_file)
        
        elif args.dataset in ("vehicles", "fuel", "inspections"):
            if not args.kentekens_from:
                log(f"Error: --kentekens-from required for {args.dataset}")
                sys.exit(1)
            if not args.kentekens_from.exists():
                log(f"Error: {args.kentekens_from} not found")
                sys.exit(1)
            
            kentekens = load_kentekens(args.kentekens_from)
            
            if args.dataset == "vehicles":
                fetch_vehicles(client, kentekens, output_file)
            elif args.dataset == "fuel":
                fetch_fuel(client, kentekens, output_file)
            elif args.dataset == "inspections":
                fetch_inspections(client, kentekens, output_file)
    
    finally:
        client.close()
    
    log(f"\nDone! Output: {output_file}")


if __name__ == "__main__":
    main()
