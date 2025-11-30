"""
Fetch data from RDW Open Data API (Socrata/SODA API).

Datasets:
- Gekentekende voertuigen (m9d7-ebf2): Vehicle registrations
- Geconstateerde Gebreken (a34c-vvps): Defects found during inspections
- Gebreken (hx2c-gt7k): Defect reference table

Environment variables:
- RDW_APP_TOKEN: Optional Socrata app token for higher rate limits
- DATA_SAMPLE_PERCENT: Percentage of data to fetch (1-100, default 100)
"""

import os
import time
from functools import wraps
from pathlib import Path

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
    """Create Socrata client for RDW API."""
    # App token is optional but recommended for higher rate limits
    app_token = os.environ.get("RDW_APP_TOKEN")
    return Socrata(RDW_DOMAIN, app_token)


def fetch_defects_found(client: Socrata, limit: int | None = None) -> pd.DataFrame:
    """
    Fetch defects found during inspections.
    
    Args:
        client: Socrata client
        limit: Maximum number of records to fetch (default from environment)
    
    Returns:
        DataFrame with defect data
    """
    if limit is None:
        limit = get_data_limit()
    
    sample_percent = get_sample_percent()
    print(f"Fetching defects found (limit: {limit:,}, {sample_percent}% of full dataset)...")
    
    results = client.get(
        DATASETS["defects_found"],
        limit=limit,
    )
    
    df = pd.DataFrame.from_records(results)
    print(f"  Fetched {len(df)} defect records")
    return df


def fetch_vehicles_for_kentekens(
    client: Socrata, 
    kentekens: list[str],
    batch_size: int = 1000
) -> pd.DataFrame:
    """
    Fetch vehicle info for specific license plates.
    
    Args:
        client: Socrata client
        kentekens: List of license plates to fetch
        batch_size: Number of kentekens per API call
    
    Returns:
        DataFrame with vehicle data
    """
    print(f"Fetching vehicle info for {len(kentekens)} unique kentekens...")
    
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
    unique_kentekens = list(set(kentekens))
    total_batches = (len(unique_kentekens) + batch_size - 1) // batch_size
    
    @retry_with_backoff(max_retries=3, base_delay=2.0)
    def fetch_batch(batch_kentekens):
        kenteken_list = ",".join(f"'{k}'" for k in batch_kentekens)
        return client.get(
            DATASETS["vehicles"],
            select=",".join(columns),
            where=f"kenteken IN ({kenteken_list}) AND voertuigsoort='Personenauto'",
            limit=batch_size,
        )
    
    with tqdm(total=total_batches, desc="  Vehicles", unit="batch") as pbar:
        for i in range(0, len(unique_kentekens), batch_size):
            batch = unique_kentekens[i:i + batch_size]
            try:
                results = fetch_batch(batch)
                all_results.extend(results)
            except Exception as e:
                print(f"  Warning: batch {i//batch_size} failed after retries: {e}")
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
    Fetch fuel type info for specific license plates.
    
    Args:
        client: Socrata client
        kentekens: List of license plates to fetch
        batch_size: Number of kentekens per API call
    
    Returns:
        DataFrame with fuel data
    """
    print(f"Fetching fuel info for {len(kentekens)} unique kentekens...")
    
    all_results = []
    unique_kentekens = list(set(kentekens))
    total_batches = (len(unique_kentekens) + batch_size - 1) // batch_size
    
    @retry_with_backoff(max_retries=3, base_delay=2.0)
    def fetch_batch(batch_kentekens):
        kenteken_list = ",".join(f"'{k}'" for k in batch_kentekens)
        return client.get(
            "8ys7-d773",  # Fuel dataset
            where=f"kenteken IN ({kenteken_list}) AND brandstof_volgnummer='1'",  # Primary fuel only
            limit=batch_size,
        )
    
    with tqdm(total=total_batches, desc="  Fuel", unit="batch") as pbar:
        for i in range(0, len(unique_kentekens), batch_size):
            batch = unique_kentekens[i:i + batch_size]
            try:
                results = fetch_batch(batch)
                all_results.extend(results)
            except Exception as e:
                print(f"  Warning: fuel batch {i//batch_size} failed after retries: {e}")
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
