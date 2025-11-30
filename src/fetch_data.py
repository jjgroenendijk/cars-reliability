"""
Fetch data from RDW Open Data API (Socrata/SODA API).

Datasets:
- Gekentekende voertuigen (m9d7-ebf2): Vehicle registrations
- Geconstateerde Gebreken (a34c-vvps): Defects found during inspections
- Gebreken (hx2c-gt7k): Defect reference table
- Meldingen Keuringsinstantie (sgfe-77wx): All inspection results (pass/fail)

Environment variables:
- RDW_APP_TOKEN: Socrata app token for higher rate limits (recommended)
- DATA_SAMPLE_PERCENT: Percentage of data to fetch (1-100, default 100)
- FETCH_WORKERS: Number of parallel workers for batch fetching (default 2)
- CI: Set to 'true' in CI environments to disable progress bar animations
- FETCH_DATASET: Single dataset to fetch (for parallel CI jobs)
"""

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
from tqdm import tqdm


def log(message: str) -> None:
    """Print a message and flush immediately (important for CI)."""
    print(message, flush=True)


def is_ci() -> bool:
    """Check if running in a CI environment."""
    return os.environ.get("CI", "").lower() == "true" or os.environ.get("GITHUB_ACTIONS") == "true"


def get_tqdm_kwargs() -> dict:
    """Get tqdm kwargs appropriate for the environment."""
    if is_ci():
        # In CI: completely disable tqdm to avoid log clutter
        return {"disable": True}
    return {}


class CIProgressLogger:
    """Simple progress logger for CI environments."""
    def __init__(self, total: int, desc: str, log_interval: int = 10):
        self.total = total
        self.desc = desc
        self.log_interval = log_interval
        self.count = 0
        self.enabled = is_ci()
        self.start_time = time.time()
    
    def update(self, n: int = 1):
        self.count += n
        if self.enabled and (self.count % self.log_interval == 0 or self.count == self.total):
            pct = int(self.count / self.total * 100)
            elapsed = time.time() - self.start_time
            log(f"  {self.desc}: {self.count}/{self.total} ({pct}%) - {elapsed:.0f}s elapsed")


class StreamingCSVWriter:
    """Write CSV rows as they arrive, with thread-safe appending."""
    
    def __init__(self, filepath: Path, fieldnames: list[str] | None = None):
        self.filepath = filepath
        self.fieldnames = fieldnames
        self._file = None
        self._writer = None
        self._lock = Lock()
        self._row_count = 0
        self._header_written = False
    
    def __enter__(self):
        self._file = open(self.filepath, 'w', newline='', encoding='utf-8')
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._file:
            self._file.close()
        return False
    
    def write_rows(self, rows: list[dict]) -> int:
        """Thread-safe write of multiple rows. Returns number of rows written."""
        if not rows:
            return 0
        
        with self._lock:
            # Initialize writer with fieldnames from first batch if not provided
            if self._writer is None:
                if self.fieldnames is None:
                    self.fieldnames = list(rows[0].keys())
                self._writer = csv.DictWriter(self._file, fieldnames=self.fieldnames, extrasaction='ignore')
            
            # Write header on first batch
            if not self._header_written:
                self._writer.writeheader()
                self._header_written = True
            
            # Write rows
            for row in rows:
                self._writer.writerow(row)
            
            # Flush to disk immediately
            self._file.flush()
            os.fsync(self._file.fileno())
            
            self._row_count += len(rows)
            return len(rows)
    
    @property
    def row_count(self) -> int:
        return self._row_count


def retry_with_backoff(max_retries: int = 5, base_delay: float = 2.0):
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
                        log(f"  Retry {attempt + 1}/{max_retries} after {delay}s: {e}")
                        time.sleep(delay)
            raise last_exception
        return wrapper
    return decorator


def get_num_workers() -> int:
    """Get the number of parallel workers for batch fetching.
    
    Default is 2 workers to avoid overwhelming the RDW API.
    The API is rate-limited and will drop connections with too many parallel requests.
    """
    return int(os.environ.get("FETCH_WORKERS", "2"))

# RDW Open Data domain
RDW_DOMAIN = "opendata.rdw.nl"

# Dataset IDs
DATASETS = {
    "vehicles": "m9d7-ebf2",      # Gekentekende voertuigen
    "defects_found": "a34c-vvps", # Geconstateerde Gebreken
    "defect_codes": "hx2c-gt7k",  # Gebreken (reference table)
    "inspections": "sgfe-77wx",   # Meldingen Keuringsinstantie (all APK results)
}

# Data directory
DATA_DIR = Path(__file__).parent.parent / "data"

# Cache for dataset size (to avoid repeated API calls)
_dataset_size_cache: dict[str, int] = {}


def get_dataset_size(client, dataset_id: str) -> int:
    """Query the total number of records in a dataset."""
    if dataset_id in _dataset_size_cache:
        return _dataset_size_cache[dataset_id]
    
    try:
        result = client.get(dataset_id, select="count(*)", limit=1)
        if result and len(result) > 0:
            count = int(result[0]["count"])
            _dataset_size_cache[dataset_id] = count
            return count
    except Exception as e:
        log(f"  Warning: Could not get dataset size: {e}")
    
    # Fallback to hardcoded estimate
    return 25_000_000


def get_sample_percent() -> int:
    """Get the data sample percentage from environment (1-100)."""
    percent = int(os.environ.get("DATA_SAMPLE_PERCENT", "100"))
    return max(1, min(100, percent))


def get_data_limit(client) -> int:
    """Calculate the data limit based on sample percentage and actual dataset size."""
    percent = get_sample_percent()
    total_size = get_dataset_size(client, DATASETS["defects_found"])
    limit = int(total_size * percent / 100)
    return max(10000, limit)  # Minimum 10k records


def get_client() -> Socrata:
    """Create Socrata client for RDW API with app token if available."""
    app_token = os.environ.get("RDW_APP_TOKEN")
    if app_token:
        log("  Using app token for higher rate limits")
    else:
        log("  Warning: No app token - requests will be throttled")
    # Increase timeout to 60 seconds to handle slow API responses
    return Socrata(RDW_DOMAIN, app_token, timeout=60)


def fetch_defects_found(client: Socrata, limit: int | None = None, output_file: Path | None = None) -> pd.DataFrame:
    """
    Fetch defects found during inspections using parallel pagination.
    
    Args:
        client: Socrata client
        limit: Maximum number of records to fetch (default from environment)
        output_file: If provided, stream results directly to this CSV file
    
    Returns:
        DataFrame with defect data (or empty DataFrame if streaming to file)
    """
    # Get dataset size and calculate limit dynamically
    total_size = get_dataset_size(client, DATASETS["defects_found"])
    sample_percent = get_sample_percent()
    
    if limit is None:
        limit = get_data_limit(client)
    
    num_workers = get_num_workers()
    log(f"Fetching defects found ({sample_percent}% of {total_size:,} = {limit:,} records, {num_workers} workers)...")
    
    # Use pagination for large datasets
    page_size = 50000  # Socrata recommended max per request
    all_results = [] if output_file is None else None
    results_lock = Lock()
    
    # Set up streaming writer if output file provided
    csv_writer = None
    if output_file:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        csv_writer = StreamingCSVWriter(output_file)
        csv_writer.__enter__()
    
    # Calculate all page offsets upfront
    offsets = list(range(0, limit, page_size))
    total_pages = len(offsets)
    
    @retry_with_backoff(max_retries=5, base_delay=2.0)
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
            # Small delay to avoid overwhelming the API
            time.sleep(0.1)
            results = fetch_page(offset)
            return (offset, results, None)
        except Exception as e:
            return (offset, [], str(e))
    
    try:
        ci_logger = CIProgressLogger(total_pages, "Defects pages", log_interval=max(1, total_pages // 10))
        with tqdm(total=total_pages, desc="  Defects", unit="pages", **get_tqdm_kwargs()) as pbar:
            with ThreadPoolExecutor(max_workers=num_workers) as executor:
                futures = {executor.submit(process_page, offset): offset for offset in offsets}
                
                for future in as_completed(futures):
                    offset, results, error = future.result()
                    if error:
                        log(f"\n  Error at offset {offset}: {error}")
                    elif results:
                        if csv_writer:
                            csv_writer.write_rows(results)
                        else:
                            with results_lock:
                                all_results.extend(results)
                    pbar.update(1)
                    ci_logger.update(1)
    finally:
        if csv_writer:
            csv_writer.__exit__(None, None, None)
    
    if csv_writer:
        log(f"  Streamed {csv_writer.row_count:,} defect records to {output_file}")
        return pd.DataFrame()  # Return empty, data is in file
    
    df = pd.DataFrame.from_records(all_results)
    log(f"  Fetched {len(df):,} defect records")
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
    log(f"Fetching vehicle info for {len(kentekens)} unique kentekens ({num_workers} workers)...")
    
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
    
    @retry_with_backoff(max_retries=5, base_delay=2.0)
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
            time.sleep(0.1)  # Small delay to avoid overwhelming the API
            results = fetch_batch(batch)
            return (batch_idx, results, None)
        except Exception as e:
            return (batch_idx, [], str(e))
    
    ci_logger = CIProgressLogger(total_batches, "Vehicle batches", log_interval=max(1, total_batches // 10))
    with tqdm(total=total_batches, desc="  Vehicles", unit="batch", **get_tqdm_kwargs()) as pbar:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(process_batch, (i, batch)): i 
                for i, batch in enumerate(batches)
            }
            
            for future in as_completed(futures):
                batch_idx, results, error = future.result()
                if error:
                    log(f"\n  Warning: batch {batch_idx} failed after retries: {error}")
                else:
                    with results_lock:
                        all_results.extend(results)
                pbar.update(1)
                ci_logger.update(1)
    
    df = pd.DataFrame.from_records(all_results)
    log(f"  Fetched info for {len(df)} passenger cars")
    return df


def fetch_defect_codes(client: Socrata) -> pd.DataFrame:
    """
    Fetch defect reference table (all possible defect codes and descriptions).
    
    Args:
        client: Socrata client
    
    Returns:
        DataFrame with defect codes
    """
    log("Fetching defect codes...")
    
    results = client.get(
        DATASETS["defect_codes"],
        limit=10000,  # Reference table should be small
    )
    
    df = pd.DataFrame.from_records(results)
    log(f"  Fetched {len(df)} defect codes")
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
    log(f"Fetching fuel info for {len(kentekens)} unique kentekens ({num_workers} workers)...")
    
    all_results = []
    results_lock = Lock()
    unique_kentekens = list(set(kentekens))
    total_batches = (len(unique_kentekens) + batch_size - 1) // batch_size
    
    # Create batches upfront
    batches = [
        unique_kentekens[i:i + batch_size] 
        for i in range(0, len(unique_kentekens), batch_size)
    ]
    
    @retry_with_backoff(max_retries=5, base_delay=2.0)
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
            time.sleep(0.1)  # Small delay to avoid overwhelming the API
            results = fetch_batch(batch)
            return (batch_idx, results, None)
        except Exception as e:
            return (batch_idx, [], str(e))
    
    ci_logger = CIProgressLogger(total_batches, "Fuel batches", log_interval=max(1, total_batches // 10))
    with tqdm(total=total_batches, desc="  Fuel", unit="batch", **get_tqdm_kwargs()) as pbar:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(process_batch, (i, batch)): i 
                for i, batch in enumerate(batches)
            }
            
            for future in as_completed(futures):
                batch_idx, results, error = future.result()
                if error:
                    log(f"\n  Warning: fuel batch {batch_idx} failed after retries: {error}")
                else:
                    with results_lock:
                        all_results.extend(results)
                pbar.update(1)
                ci_logger.update(1)
    
    df = pd.DataFrame.from_records(all_results)
    log(f"  Fetched fuel info for {len(df)} vehicles")
    return df


def fetch_inspections_for_kentekens(
    client: Socrata,
    kentekens: list[str],
    batch_size: int = 1000
) -> pd.DataFrame:
    """
    Fetch all inspection results (pass/fail) for specific license plates.
    
    This dataset includes ALL inspections, not just those with defects,
    which allows us to calculate accurate pass/fail rates and avoid sample bias.
    
    Args:
        client: Socrata client
        kentekens: List of license plates to fetch
        batch_size: Number of kentekens per API call
    
    Returns:
        DataFrame with inspection data including pass/fail status
    """
    num_workers = get_num_workers()
    log(f"Fetching inspection results for {len(kentekens)} unique kentekens ({num_workers} workers)...")
    
    all_results = []
    results_lock = Lock()
    unique_kentekens = list(set(kentekens))
    total_batches = (len(unique_kentekens) + batch_size - 1) // batch_size
    
    # Create batches upfront
    batches = [
        unique_kentekens[i:i + batch_size] 
        for i in range(0, len(unique_kentekens), batch_size)
    ]
    
    @retry_with_backoff(max_retries=5, base_delay=2.0)
    def fetch_batch(batch_kentekens):
        kenteken_list = ",".join(f"'{k}'" for k in batch_kentekens)
        return client.get(
            DATASETS["inspections"],
            select="kenteken,meld_datum_door_keuringsinstantie,soort_melding_ki_omschrijving,vervaldatum_keuring",
            where=f"kenteken IN ({kenteken_list}) AND soort_erkenning_omschrijving='APK Lichte voertuigen'",
            limit=batch_size * 10,  # A vehicle can have multiple inspections
        )
    
    def process_batch(batch_idx_and_data):
        batch_idx, batch = batch_idx_and_data
        try:
            time.sleep(0.1)  # Small delay to avoid overwhelming the API
            results = fetch_batch(batch)
            return (batch_idx, results, None)
        except Exception as e:
            return (batch_idx, [], str(e))
    
    ci_logger = CIProgressLogger(total_batches, "Inspection batches", log_interval=max(1, total_batches // 10))
    with tqdm(total=total_batches, desc="  Inspections", unit="batch", **get_tqdm_kwargs()) as pbar:
        with ThreadPoolExecutor(max_workers=num_workers) as executor:
            futures = {
                executor.submit(process_batch, (i, batch)): i 
                for i, batch in enumerate(batches)
            }
            
            for future in as_completed(futures):
                batch_idx, results, error = future.result()
                if error:
                    log(f"\n  Warning: inspection batch {batch_idx} failed after retries: {error}")
                else:
                    with results_lock:
                        all_results.extend(results)
                pbar.update(1)
                ci_logger.update(1)
    
    df = pd.DataFrame.from_records(all_results)
    log(f"  Fetched {len(df)} inspection records")
    return df


def main():
    """Fetch all data and save to CSV files."""
    import json
    
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    sample_percent = get_sample_percent()
    log(f"\n{'='*60}")
    log(f"DATA FETCH: {sample_percent}% of full dataset")
    if is_ci():
        log("(CI mode: progress bar disabled, showing periodic updates)")
    log(f"{'='*60}\n")
    
    client = get_client()
    
    # First, fetch defects (this is our primary dataset for selecting kentekens)
    defects_df = fetch_defects_found(client)
    defect_codes_df = fetch_defect_codes(client)
    
    # Get unique kentekens from defects dataset
    kentekens = defects_df["kenteken"].unique().tolist()
    
    # Fetch vehicle info, fuel data, and ALL inspections for these kentekens
    vehicles_df = fetch_vehicles_for_kentekens(client, kentekens)
    fuel_df = fetch_fuel_for_kentekens(client, kentekens)
    inspections_df = fetch_inspections_for_kentekens(client, kentekens)
    
    # Save to CSV with progress logging
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
    
    # Save metadata about the fetch
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
