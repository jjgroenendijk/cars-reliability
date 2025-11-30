"""
Shared utilities for fetching data from RDW Open Data API.

This module provides reusable components:
- StreamingCSVWriter: Thread-safe CSV writer with immediate disk flush
- retry_with_backoff: Decorator for exponential backoff retries
- Logging utilities for CI environments
- Socrata client factory
"""

import csv
import os
import time
from functools import wraps
from pathlib import Path
from threading import Lock

from sodapy import Socrata


# RDW Open Data domain
RDW_DOMAIN = "opendata.rdw.nl"

# Dataset IDs - central registry
DATASETS = {
    "vehicles": "m9d7-ebf2",       # Gekentekende voertuigen
    "defects_found": "a34c-vvps",  # Geconstateerde Gebreken
    "defect_codes": "hx2c-gt7k",   # Gebreken (reference table)
    "inspections": "sgfe-77wx",    # Meldingen Keuringsinstantie (all APK results)
    "fuel": "8ys7-d773",           # Brandstof data
}

# Default data directory
DATA_DIR = Path(__file__).parent.parent / "data"


def log(message: str) -> None:
    """Print a message and flush immediately (important for CI)."""
    print(message, flush=True)


def is_ci() -> bool:
    """Check if running in a CI environment."""
    return os.environ.get("CI", "").lower() == "true" or os.environ.get("GITHUB_ACTIONS") == "true"


def get_sample_percent() -> int:
    """Get the data sample percentage from environment (1-100)."""
    percent = int(os.environ.get("DATA_SAMPLE_PERCENT", "100"))
    return max(1, min(100, percent))


def get_num_workers() -> int:
    """Get the number of parallel workers for batch fetching.
    
    Default is 2 workers to avoid overwhelming the RDW API.
    The API is rate-limited and will drop connections with too many parallel requests.
    """
    return int(os.environ.get("FETCH_WORKERS", "2"))


def get_client() -> Socrata:
    """Create Socrata client for RDW API with app token if available."""
    app_token = os.environ.get("RDW_APP_TOKEN")
    if app_token:
        log("Using app token for higher rate limits")
    return Socrata(RDW_DOMAIN, app_token, timeout=60)


def get_dataset_size(client: Socrata, dataset_id: str) -> int:
    """Query the total number of records in a dataset."""
    try:
        result = client.get(dataset_id, select="count(*)", limit=1)
        return int(result[0]["count"]) if result else 25_000_000
    except Exception as e:
        log(f"  Warning: Could not get dataset size: {e}")
        return 25_000_000


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
                        log(f"  Retry {attempt + 1}/{max_retries} after {delay:.0f}s: {type(e).__name__}")
                        time.sleep(delay)
            raise last_exception
        return wrapper
    return decorator


class StreamingCSVWriter:
    """Thread-safe CSV writer that flushes to disk immediately.
    
    Usage:
        with StreamingCSVWriter(Path("output.csv")) as writer:
            writer.write_rows([{"col1": "val1", "col2": "val2"}])
    """
    
    def __init__(self, filepath: Path, fieldnames: list[str] | None = None):
        self.filepath = filepath
        self.fieldnames = fieldnames
        self._file = None
        self._writer = None
        self._lock = Lock()
        self._row_count = 0
        self._header_written = False
    
    def __enter__(self):
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
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
                self._writer = csv.DictWriter(
                    self._file, 
                    fieldnames=self.fieldnames, 
                    extrasaction='ignore'
                )
            
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
        """Return total number of rows written."""
        return self._row_count


class CIProgressLogger:
    """Simple progress logger for CI environments where tqdm is disabled."""
    
    def __init__(self, total: int, desc: str, log_interval: int = 10):
        self.total = total
        self.desc = desc
        self.log_interval = log_interval
        self.count = 0
        self.enabled = is_ci()
        self.start_time = time.time()
    
    def update(self, n: int = 1):
        """Update progress counter and log if at interval."""
        self.count += n
        if self.enabled and (self.count % self.log_interval == 0 or self.count == self.total):
            pct = int(self.count / self.total * 100)
            elapsed = time.time() - self.start_time
            log(f"  {self.desc}: {self.count}/{self.total} ({pct}%) - {elapsed:.0f}s elapsed")


def get_tqdm_kwargs() -> dict:
    """Get tqdm kwargs appropriate for the environment."""
    if is_ci():
        # In CI: completely disable tqdm to avoid log clutter
        return {"disable": True}
    return {}
