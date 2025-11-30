"""
Pipeline orchestrator: fetch all RDW datasets and save to CSV files.

This is the main entry point for fetching data. It coordinates:
1. Fetching defects_found (primary dataset for kenteken sampling)
2. Fetching vehicle info, fuel data, and inspections for those kentekens
3. Saving all data to CSV files in data/

For fetching individual datasets (e.g., in parallel CI jobs), use fetch_single.py.

Environment variables:
- RDW_APP_TOKEN: Socrata app token for higher rate limits (recommended)
- DATA_SAMPLE_PERCENT: Percentage of data to fetch (1-100, default 100)
- FETCH_WORKERS: Number of parallel workers for batch fetching (default 2)
"""

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

import pandas as pd

from rdw_client import (
    DATASETS,
    DATA_DIR,
    get_client,
    get_dataset_size,
    get_num_workers,
    get_sample_percent,
    log,
    retry_with_backoff,
)


def fetch_defects_found(client, limit: int | None = None) -> pd.DataFrame:
    """Fetch defects found during inspections using parallel pagination."""
    total_size = get_dataset_size(client, DATASETS["defects_found"])
    sample_percent = get_sample_percent()
    
    if limit is None:
        limit = max(10000, int(total_size * sample_percent / 100))
    
    num_workers = get_num_workers()
    log(f"Fetching defects found ({sample_percent}% of {total_size:,} = {limit:,} records, {num_workers} workers)...")
    
    page_size = 50000
    all_results = []
    results_lock = Lock()
    offsets = list(range(0, limit, page_size))
    total_pages = len(offsets)
    
    @retry_with_backoff(max_retries=5, base_delay=2.0)
    def fetch_page(offset):
        fetch_size = min(page_size, limit - offset)
        return client.get(
            DATASETS["defects_found"],
            limit=fetch_size,
            offset=offset,
            order="kenteken",
        )
    
    def process_page(offset):
        try:
            time.sleep(0.1)
            results = fetch_page(offset)
            return (offset, results, None)
        except Exception as e:
            return (offset, [], str(e))
    
    completed = 0
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {executor.submit(process_page, offset): offset for offset in offsets}
        
        for future in as_completed(futures):
            offset, results, error = future.result()
            completed += 1
            if error:
                log(f"  Error at offset {offset}: {error}")
            elif results:
                with results_lock:
                    all_results.extend(results)
            
            if completed % max(1, total_pages // 10) == 0 or completed == total_pages:
                log(f"  Progress: {completed}/{total_pages} pages ({completed * 100 // total_pages}%)")
    
    df = pd.DataFrame.from_records(all_results)
    log(f"  Fetched {len(df):,} defect records")
    return df


def fetch_vehicles_for_kentekens(client, kentekens: list[str], batch_size: int = 1000) -> pd.DataFrame:
    """Fetch vehicle info for specific license plates using parallel requests."""
    num_workers = get_num_workers()
    log(f"Fetching vehicle info for {len(kentekens)} unique kentekens ({num_workers} workers)...")
    
    columns = [
        "kenteken", "merk", "handelsbenaming", "voertuigsoort",
        "datum_eerste_toelating", "vervaldatum_apk", "cilinderinhoud",
        "aantal_cilinders", "massa_rijklaar", "eerste_kleur", "inrichting",
    ]
    
    all_results = []
    results_lock = Lock()
    unique_kentekens = list(set(kentekens))
    batches = [unique_kentekens[i:i + batch_size] for i in range(0, len(unique_kentekens), batch_size)]
    total_batches = len(batches)
    
    @retry_with_backoff(max_retries=5, base_delay=2.0)
    def fetch_batch(batch_kentekens):
        kenteken_list = ",".join(f"'{k}'" for k in batch_kentekens)
        return client.get(
            DATASETS["vehicles"],
            select=",".join(columns),
            where=f"kenteken IN ({kenteken_list}) AND voertuigsoort='Personenauto'",
            limit=batch_size,
        )
    
    def process_batch(batch_data):
        batch_idx, batch = batch_data
        try:
            time.sleep(0.1)
            results = fetch_batch(batch)
            return (batch_idx, results, None)
        except Exception as e:
            return (batch_idx, [], str(e))
    
    completed = 0
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {executor.submit(process_batch, (i, b)): i for i, b in enumerate(batches)}
        for future in as_completed(futures):
            batch_idx, results, error = future.result()
            completed += 1
            if error:
                log(f"  Warning: batch {batch_idx} failed: {error}")
            else:
                with results_lock:
                    all_results.extend(results)
            
            if completed % max(1, total_batches // 10) == 0 or completed == total_batches:
                log(f"  Progress: {completed}/{total_batches} batches ({completed * 100 // total_batches}%)")
    
    df = pd.DataFrame.from_records(all_results)
    log(f"  Fetched info for {len(df)} passenger cars")
    return df


def fetch_defect_codes(client) -> pd.DataFrame:
    """Fetch defect reference table (all possible defect codes and descriptions)."""
    log("Fetching defect codes...")
    results = client.get(DATASETS["defect_codes"], limit=10000)
    df = pd.DataFrame.from_records(results)
    log(f"  Fetched {len(df)} defect codes")
    return df


def fetch_fuel_for_kentekens(client, kentekens: list[str], batch_size: int = 1000) -> pd.DataFrame:
    """Fetch fuel type info for specific license plates using parallel requests."""
    num_workers = get_num_workers()
    log(f"Fetching fuel info for {len(kentekens)} unique kentekens ({num_workers} workers)...")
    
    all_results = []
    results_lock = Lock()
    unique_kentekens = list(set(kentekens))
    batches = [unique_kentekens[i:i + batch_size] for i in range(0, len(unique_kentekens), batch_size)]
    total_batches = len(batches)
    
    @retry_with_backoff(max_retries=5, base_delay=2.0)
    def fetch_batch(batch_kentekens):
        kenteken_list = ",".join(f"'{k}'" for k in batch_kentekens)
        return client.get(
            DATASETS["fuel"],
            where=f"kenteken IN ({kenteken_list}) AND brandstof_volgnummer='1'",
            limit=batch_size,
        )
    
    def process_batch(batch_data):
        batch_idx, batch = batch_data
        try:
            time.sleep(0.1)
            results = fetch_batch(batch)
            return (batch_idx, results, None)
        except Exception as e:
            return (batch_idx, [], str(e))
    
    completed = 0
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {executor.submit(process_batch, (i, b)): i for i, b in enumerate(batches)}
        for future in as_completed(futures):
            batch_idx, results, error = future.result()
            completed += 1
            if error:
                log(f"  Warning: fuel batch {batch_idx} failed: {error}")
            else:
                with results_lock:
                    all_results.extend(results)
            
            if completed % max(1, total_batches // 10) == 0 or completed == total_batches:
                log(f"  Progress: {completed}/{total_batches} batches ({completed * 100 // total_batches}%)")
    
    df = pd.DataFrame.from_records(all_results)
    log(f"  Fetched fuel info for {len(df)} vehicles")
    return df


def fetch_inspections_for_kentekens(client, kentekens: list[str], batch_size: int = 1000) -> pd.DataFrame:
    """Fetch all inspection results (pass/fail) for specific license plates."""
    num_workers = get_num_workers()
    log(f"Fetching inspection results for {len(kentekens)} unique kentekens ({num_workers} workers)...")
    
    all_results = []
    results_lock = Lock()
    unique_kentekens = list(set(kentekens))
    batches = [unique_kentekens[i:i + batch_size] for i in range(0, len(unique_kentekens), batch_size)]
    total_batches = len(batches)
    
    @retry_with_backoff(max_retries=5, base_delay=2.0)
    def fetch_batch(batch_kentekens):
        kenteken_list = ",".join(f"'{k}'" for k in batch_kentekens)
        return client.get(
            DATASETS["inspections"],
            select="kenteken,meld_datum_door_keuringsinstantie,soort_melding_ki_omschrijving,vervaldatum_keuring",
            where=f"kenteken IN ({kenteken_list}) AND soort_erkenning_omschrijving='APK Lichte voertuigen'",
            limit=batch_size * 10,
        )
    
    def process_batch(batch_data):
        batch_idx, batch = batch_data
        try:
            time.sleep(0.1)
            results = fetch_batch(batch)
            return (batch_idx, results, None)
        except Exception as e:
            return (batch_idx, [], str(e))
    
    completed = 0
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {executor.submit(process_batch, (i, b)): i for i, b in enumerate(batches)}
        for future in as_completed(futures):
            batch_idx, results, error = future.result()
            completed += 1
            if error:
                log(f"  Warning: inspection batch {batch_idx} failed: {error}")
            else:
                with results_lock:
                    all_results.extend(results)
            
            if completed % max(1, total_batches // 10) == 0 or completed == total_batches:
                log(f"  Progress: {completed}/{total_batches} batches ({completed * 100 // total_batches}%)")
    
    df = pd.DataFrame.from_records(all_results)
    log(f"  Fetched {len(df)} inspection records")
    return df


def main():
    """Fetch all data and save to CSV files."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    sample_percent = get_sample_percent()
    log(f"\n{'='*60}")
    log(f"DATA FETCH: {sample_percent}% of full dataset")
    log(f"{'='*60}\n")
    
    client = get_client()
    
    # First, fetch defects (primary dataset for selecting kentekens)
    defects_df = fetch_defects_found(client)
    defect_codes_df = fetch_defect_codes(client)
    
    # Get unique kentekens from defects dataset
    kentekens = defects_df["kenteken"].unique().tolist()
    
    # Fetch vehicle info, fuel data, and ALL inspections for these kentekens
    vehicles_df = fetch_vehicles_for_kentekens(client, kentekens)
    fuel_df = fetch_fuel_for_kentekens(client, kentekens)
    inspections_df = fetch_inspections_for_kentekens(client, kentekens)
    
    # Save to CSV
    log("\nSaving data to CSV files...")
    
    log(f"  Writing vehicles.csv ({len(vehicles_df):,} records)...")
    vehicles_df.to_csv(DATA_DIR / "vehicles.csv", index=False)
    
    log(f"  Writing defects_found.csv ({len(defects_df):,} records)...")
    defects_df.to_csv(DATA_DIR / "defects_found.csv", index=False)
    
    log(f"  Writing defect_codes.csv ({len(defect_codes_df):,} records)...")
    defect_codes_df.to_csv(DATA_DIR / "defect_codes.csv", index=False)
    
    log(f"  Writing fuel.csv ({len(fuel_df):,} records)...")
    fuel_df.to_csv(DATA_DIR / "fuel.csv", index=False)
    
    log(f"  Writing inspections.csv ({len(inspections_df):,} records)...")
    inspections_df.to_csv(DATA_DIR / "inspections.csv", index=False)
    
    # Save metadata
    log("  Writing fetch_metadata.json...")
    full_dataset_size = get_dataset_size(client, DATASETS["defects_found"])
    metadata = {
        "sample_percent": sample_percent,
        "full_dataset_size": full_dataset_size,
        "fetched_defects": len(defects_df),
        "fetched_vehicles": len(vehicles_df),
        "fetched_inspections": len(inspections_df),
        "fetched_at": pd.Timestamp.now().isoformat(),
    }
    with open(DATA_DIR / "fetch_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    log(f"\nAll data saved to {DATA_DIR}/")
    log(f"  - vehicles.csv: {len(vehicles_df):,} records")
    log(f"  - defects_found.csv: {len(defects_df):,} records")
    log(f"  - defect_codes.csv: {len(defect_codes_df):,} records")
    log(f"  - fuel.csv: {len(fuel_df):,} records")
    log(f"  - inspections.csv: {len(inspections_df):,} records")
    log(f"  - fetch_metadata.json: sample={sample_percent}%")
    
    client.close()


if __name__ == "__main__":
    main()
