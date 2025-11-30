"""
Fetch data from RDW Open Data API (Socrata/SODA API).

Datasets:
- Gekentekende voertuigen (m9d7-ebf2): Vehicle registrations
- Geconstateerde Gebreken (a34c-vvps): Defects found during inspections
- Gebreken (hx2c-gt7k): Defect reference table

Environment variables:
- RDW_APP_TOKEN: Socrata app token for higher rate limits (recommended)
- DATA_SAMPLE_PERCENT: Percentage of data to fetch (1-100, default 100)
- FETCH_WORKERS: Number of parallel workers for batch fetching (default 4)
"""

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import wraps
from pathlib import Path
from threading import Lock

import pandas as pd
from sodapy import Socrata
from tqdm import tqdm


def retry_with_backoff(max_retries: int = 3, base_delay: float = 1.0):
    """Decorator to retry a function with exponential backoff."""
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
                        print(f"  Retry {attempt + 1}/{max_retries} after {delay}s: {e}")
                        time.sleep(delay)
            raise last_exception
        return wrapper
    return decorator


def get_num_workers() -> int:
    """Get the number of parallel workers for batch fetching."""
    return int(os.environ.get("FETCH_WORKERS", "4"))

# RDW Open Data domain
RDW_DOMAIN = "opendata.rdw.nl"

# Dataset IDs
DATASETS = {
    "vehicles": "m9d7-ebf2",      # Gekentekende voertuigen
    "defects_found": "a34c-vvps", # Geconstateerde Gebreken
    "defect_codes": "hx2c-gt7k",  # Gebreken (reference table)
}

# Full dataset size (approximately 24.5M defect records as of 2025)
FULL_DATASET_SIZE = 25_000_000

# Data directory
DATA_DIR = Path(__file__).parent.parent / "data"


def get_sample_percent() -> int:
    """Get the data sample percentage from environment (1-100)."""
    percent = int(os.environ.get("DATA_SAMPLE_PERCENT", "100"))
    return max(1, min(100, percent))


def get_data_limit() -> int:
    """Calculate the data limit based on sample percentage."""
    percent = get_sample_percent()
    limit = int(FULL_DATASET_SIZE * percent / 100)
    return max(10000, limit)  # Minimum 10k records


def get_client() -> Socrata:
    """Create Socrata client for RDW API with app token if available."""
    app_token = os.environ.get("RDW_APP_TOKEN")
    if app_token:
        print(f"  Using app token for higher rate limits")
    else:
        print("  Warning: No app token - requests will be throttled")
    return Socrata(RDW_DOMAIN, app_token)


def fetch_defects_found(client: Socrata, limit: int | None = None) -> pd.DataFrame:
    """
    Fetch defects found during inspections using parallel pagination.
    
    Args:
        client: Socrata client
        limit: Maximum number of records to fetch (default from environment)
    
    Returns:
        DataFrame with defect data
    """
    if limit is None:
        limit = get_data_limit()
    
    sample_percent = get_sample_percent()
    num_workers = get_num_workers()
    print(f"Fetching defects found (limit: {limit:,}, {sample_percent}% of full dataset, {num_workers} workers)...")
    
    # Use pagination for large datasets
    page_size = 50000  # Socrata recommended max per request
    all_results = []
    results_lock = Lock()
    
    # Calculate all page offsets upfront
    offsets = list(range(0, limit, page_size))
    total_pages = len(offsets)
    
    @retry_with_backoff(max_retries=3, base_delay=2.0)
    def fetch_page(offset):
        fetch_size = min(page_size, limit - offset)
        return client.get(
            DATASETS["defects_found"],
            limit=fetch_size,
            offset=offset,
            order="kenteken",  # Consistent ordering for pagination
        )
    
    def process_page(offset):
        try:
            results = fetch_page(offset)
            return (offset, results, None)
        except Exception as e:
            return (offset, [], str(e))
    
    with tqdm(total=total_pages, desc="  Defects", unit="pages") as pbar:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {executor.submit(process_page, offset): offset for offset in offsets}
            
            for future in as_completed(futures):
                offset, results, error = future.result()
                if error:
                    print(f"\n  Error at offset {offset}: {error}")
                elif results:
                    with results_lock:
                        all_results.extend(results)
                pbar.update(1)
    
    df = pd.DataFrame.from_records(all_results)
    print(f"  Fetched {len(df):,} defect records")
    return df


def fetch_vehicles_for_kentekens(
    client: Socrata, 
    kentekens: list[str],
    batch_size: int = 1000
) -> pd.DataFrame:
    """
    Fetch vehicle info for specific license plates using parallel requests.
    
    Args:
        client: Socrata client
        kentekens: List of license plates to fetch
        batch_size: Number of kentekens per API call
    
    Returns:
        DataFrame with vehicle data
    """
    num_workers = get_num_workers()
    print(f"Fetching vehicle info for {len(kentekens)} unique kentekens ({num_workers} workers)...")
    
    columns = [
        "kenteken",
        "merk",
        "handelsbenaming",
        "voertuigsoort",
        "datum_eerste_toelating",
        "vervaldatum_apk",
        "cilinderinhoud",
        "aantal_cilinders",
        "massa_rijklaar",
        "eerste_kleur",
        "inrichting",
    ]
    
    all_results = []
    results_lock = Lock()
    unique_kentekens = list(set(kentekens))
    total_batches = (len(unique_kentekens) + batch_size - 1) // batch_size
    
    # Create batches upfront
    batches = [
        unique_kentekens[i:i + batch_size] 
        for i in range(0, len(unique_kentekens), batch_size)
    ]
    
    @retry_with_backoff(max_retries=3, base_delay=2.0)
    def fetch_batch(batch_kentekens):
        kenteken_list = ",".join(f"'{k}'" for k in batch_kentekens)
        return client.get(
            DATASETS["vehicles"],
            select=",".join(columns),
            where=f"kenteken IN ({kenteken_list}) AND voertuigsoort='Personenauto'",
            limit=batch_size,
        )
    
    def process_batch(batch_idx_and_data):
        batch_idx, batch = batch_idx_and_data
        try:
            results = fetch_batch(batch)
            return (batch_idx, results, None)
        except Exception as e:
            return (batch_idx, [], str(e))
    
    with tqdm(total=total_batches, desc="  Vehicles", unit="batch") as pbar:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(process_batch, (i, batch)): i 
                for i, batch in enumerate(batches)
            }
            
            for future in as_completed(futures):
                batch_idx, results, error = future.result()
                if error:
                    print(f"\n  Warning: batch {batch_idx} failed after retries: {error}")
                else:
                    with results_lock:
                        all_results.extend(results)
                pbar.update(1)
    
    df = pd.DataFrame.from_records(all_results)
    print(f"  Fetched info for {len(df)} passenger cars")
    return df


def fetch_defect_codes(client: Socrata) -> pd.DataFrame:
    """
    Fetch defect reference table (all possible defect codes and descriptions).
    
    Args:
        client: Socrata client
    
    Returns:
        DataFrame with defect codes
    """
    print("Fetching defect codes...")
    
    results = client.get(
        DATASETS["defect_codes"],
        limit=10000,  # Reference table should be small
    )
    
    df = pd.DataFrame.from_records(results)
    print(f"  Fetched {len(df)} defect codes")
    return df


def fetch_fuel_for_kentekens(
    client: Socrata,
    kentekens: list[str],
    batch_size: int = 1000
) -> pd.DataFrame:
    """
    Fetch fuel type info for specific license plates using parallel requests.
    
    Args:
        client: Socrata client
        kentekens: List of license plates to fetch
        batch_size: Number of kentekens per API call
    
    Returns:
        DataFrame with fuel data
    """
    num_workers = get_num_workers()
    print(f"Fetching fuel info for {len(kentekens)} unique kentekens ({num_workers} workers)...")
    
    all_results = []
    results_lock = Lock()
    unique_kentekens = list(set(kentekens))
    total_batches = (len(unique_kentekens) + batch_size - 1) // batch_size
    
    # Create batches upfront
    batches = [
        unique_kentekens[i:i + batch_size] 
        for i in range(0, len(unique_kentekens), batch_size)
    ]
    
    @retry_with_backoff(max_retries=3, base_delay=2.0)
    def fetch_batch(batch_kentekens):
        kenteken_list = ",".join(f"'{k}'" for k in batch_kentekens)
        return client.get(
            "8ys7-d773",  # Fuel dataset
            where=f"kenteken IN ({kenteken_list}) AND brandstof_volgnummer='1'",  # Primary fuel only
            limit=batch_size,
        )
    
    def process_batch(batch_idx_and_data):
        batch_idx, batch = batch_idx_and_data
        try:
            results = fetch_batch(batch)
            return (batch_idx, results, None)
        except Exception as e:
            return (batch_idx, [], str(e))
    
    with tqdm(total=total_batches, desc="  Fuel", unit="batch") as pbar:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(process_batch, (i, batch)): i 
                for i, batch in enumerate(batches)
            }
            
            for future in as_completed(futures):
                batch_idx, results, error = future.result()
                if error:
                    print(f"\n  Warning: fuel batch {batch_idx} failed after retries: {error}")
                else:
                    with results_lock:
                        all_results.extend(results)
                pbar.update(1)
    
    df = pd.DataFrame.from_records(all_results)
    print(f"  Fetched fuel info for {len(df)} vehicles")
    return df


def main():
    """Fetch all data and save to CSV files."""
    import json
    
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    sample_percent = get_sample_percent()
    print(f"\n{'='*60}")
    print(f"DATA FETCH: {sample_percent}% of full dataset")
    print(f"{'='*60}\n")
    
    client = get_client()
    
    # First, fetch defects (this is our primary dataset)
    defects_df = fetch_defects_found(client)
    defect_codes_df = fetch_defect_codes(client)
    
    # Then fetch vehicle info for the kentekens that have defects
    kentekens = defects_df["kenteken"].unique().tolist()
    vehicles_df = fetch_vehicles_for_kentekens(client, kentekens)
    
    # Fetch fuel data for these vehicles
    fuel_df = fetch_fuel_for_kentekens(client, kentekens)
    
    # Save to CSV
    vehicles_df.to_csv(DATA_DIR / "vehicles.csv", index=False)
    defects_df.to_csv(DATA_DIR / "defects_found.csv", index=False)
    defect_codes_df.to_csv(DATA_DIR / "defect_codes.csv", index=False)
    fuel_df.to_csv(DATA_DIR / "fuel.csv", index=False)
    
    # Save metadata about the fetch
    metadata = {
        "sample_percent": sample_percent,
        "full_dataset_size": FULL_DATASET_SIZE,
        "fetched_defects": len(defects_df),
        "fetched_vehicles": len(vehicles_df),
        "fetched_at": pd.Timestamp.now().isoformat(),
    }
    with open(DATA_DIR / "fetch_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\nData saved to {DATA_DIR}/")
    print(f"  - vehicles.csv: {len(vehicles_df):,} records")
    print(f"  - defects_found.csv: {len(defects_df):,} records")
    print(f"  - defect_codes.csv: {len(defect_codes_df):,} records")
    print(f"  - fuel.csv: {len(fuel_df):,} records")
    print(f"  - fetch_metadata.json: sample={sample_percent}%")
    
    client.close()


if __name__ == "__main__":
    main()
