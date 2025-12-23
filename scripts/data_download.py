#!/usr/bin/env python3
"""
RDW Dataset to Parquet Export Script

Downloads complete RDW datasets via parallel JSON pagination and exports to Parquet.
Uses Polars for efficient data handling and ZSTD compression.

Usage:
    uv run python data_duckdb_export.py --all                  # Download all 5 datasets
    uv run python data_duckdb_export.py m9d7-ebf2 --verbose    # Download single dataset
    uv run python data_duckdb_export.py hx2c-gt7k --verbose    # Small dataset for testing

Datasets:
    m9d7-ebf2 - Gekentekende Voertuigen
    sgfe-77wx - Meldingen Keuringsinstantie
    a34c-vvps - Geconstateerde Gebreken
    hx2c-gt7k - Gebreken
    8ys7-d773 - Brandstof
"""

import argparse
import json
import math
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import polars as pl
import psutil
import requests

from config import PAGE_SIZE, REQUEST_TIMEOUT

# Output directory
DIR_OUTPUT = Path(__file__).parent.parent / "data" / "parquet"
METADATA_FILE = DIR_OUTPUT / ".download_metadata.json"

# RDW API
API_BASE = "https://opendata.rdw.nl"
COUNT_URL = API_BASE + "/resource/{id}.json?$select=count(*)"
RESOURCE_URL = API_BASE + "/resource/{id}.json?$limit={limit}&$offset={offset}"
PARALLEL_WORKERS = min(32, (os.cpu_count() or 1) + 4)  # Dynamic worker scaling

# Dataset definitions
DATASETS = {
    "m9d7-ebf2": "voertuigen",
    "sgfe-77wx": "meldingen",
    "a34c-vvps": "geconstateerde_gebreken",
    "hx2c-gt7k": "gebreken",
    "8ys7-d773": "brandstof",
}


def env_load() -> None:
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip().strip("\"'")


def session_create() -> requests.Session:
    """Create HTTP session with connection pooling optimized for parallel downloads."""
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(
        pool_connections=PARALLEL_WORKERS,
        pool_maxsize=PARALLEL_WORKERS,
        max_retries=requests.adapters.Retry(
            total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504]
        ),
    )
    session.mount("https://", adapter)
    if token := os.environ.get("RDW_APP_TOKEN") or os.environ.get("APP_Token"):
        session.headers["X-App-Token"] = token
        print(f"Using app token: {token[:8]}...")
    return session


def metadata_load() -> dict:
    """Load download metadata from disk."""
    if METADATA_FILE.exists():
        with open(METADATA_FILE) as f:
            return json.load(f)
    return {}


def metadata_save(metadata: dict) -> None:
    """Save download metadata to disk."""
    DIR_OUTPUT.mkdir(parents=True, exist_ok=True)
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)


def last_download_date_set(dataset_id: str, date_str: str) -> None:
    """Set last download date for a dataset."""
    metadata = metadata_load()
    if dataset_id not in metadata:
        metadata[dataset_id] = {}
    metadata[dataset_id]["last_date"] = date_str
    metadata[dataset_id]["updated_at"] = datetime.now().isoformat()
    metadata_save(metadata)


def memory_usage_mb() -> float:
    """Get current process memory usage in MB."""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)


def row_count_get(session: requests.Session, dataset_id: str) -> int | None:
    """Get total row count for progress percentage."""
    import io

    url = COUNT_URL.format(id=dataset_id)
    max_retries = 3

    for attempt in range(max_retries):
        try:
            r = session.get(url, timeout=60)
            r.raise_for_status()
            df = pl.read_json(io.BytesIO(r.content))
            if "count" in df.columns and len(df) > 0:
                return int(df["count"][0])
            print(f"  [count] unexpected response: {df}")
            return None
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** (attempt + 1)
                print(f"  [count] attempt {attempt + 1} failed: {e}, retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"  [count] all attempts failed: {e}")
                return None
    return None


def page_fetch(session: requests.Session, dataset_id: str, offset: int, limit: int) -> list[dict]:
    """Fetch a single page of data from the API with retry logic."""
    url = RESOURCE_URL.format(id=dataset_id, limit=limit, offset=offset)
    max_retries = 5

    for attempt in range(max_retries):
        try:
            r = session.get(url, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            return r.json()
        except (
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
        ) as e:
            if attempt == max_retries - 1:
                raise  # Re-raise on final attempt
            wait_time = 2**attempt  # Exponential backoff: 1, 2, 4, 8, 16 seconds
            print(f"  [retry] page at offset {offset} failed: {e}, retrying in {wait_time}s...")
            time.sleep(wait_time)

    # Should never reach here, but just in case
    raise RuntimeError(f"Failed to fetch page at offset {offset} after {max_retries} attempts")


def dataset_download_parallel(
    session: requests.Session,
    dataset_id: str,
    output_name: str,
    output_path: Path,
    verbose: bool,
    total_rows: int,
) -> int:
    """
    Download dataset using parallel page fetching and write directly to Parquet.

    Uses temp files to avoid memory accumulation - each batch is written to disk
    immediately, then all temp files are stream-merged at the end.

    Returns: row_count
    """
    import shutil
    import tempfile

    page_size = PAGE_SIZE
    total_pages = math.ceil(total_rows / page_size) if total_rows > 0 else 1
    offsets = list(range(0, total_rows, page_size))

    print(
        f"[{output_name}] downloading {total_rows:,} rows in {total_pages} pages "
        f"using {PARALLEL_WORKERS} workers...",
        flush=True,
    )

    # Create temp directory for batch files
    temp_dir = Path(tempfile.mkdtemp(prefix=f"rdw_{output_name}_"))

    pages_fetched = 0
    pages_lock = threading.Lock()

    start = time.time()
    last_progress_time = [start]

    def fetch_page_wrapper(page_idx: int, offset: int) -> None:
        """Fetch a page and write directly to temp Parquet file."""
        nonlocal pages_fetched
        page_data = page_fetch(session, dataset_id, offset, page_size)

        # Write directly to temp file - no memory accumulation
        temp_path = temp_dir / f"batch_{page_idx:05d}.parquet"
        pl.DataFrame(page_data).write_parquet(temp_path, compression="zstd")

        with pages_lock:
            pages_fetched += 1

            if verbose:
                now = time.time()
                if now - last_progress_time[0] >= 5:
                    elapsed = now - start
                    pct = (pages_fetched / total_pages * 100) if total_pages > 0 else 0
                    rows_fetched = pages_fetched * page_size
                    speed = rows_fetched / elapsed if elapsed > 0 else 0
                    mem = memory_usage_mb()
                    print(
                        f"  [{output_name}] {pct:.1f}% | {pages_fetched}/{total_pages} "
                        f"pages | {rows_fetched:,} rows | {speed:.0f} rows/s | {mem:.0f} MB",
                        flush=True,
                    )
                    last_progress_time[0] = now

    # Download all pages in parallel
    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
        futures = [
            executor.submit(fetch_page_wrapper, idx, offset) for idx, offset in enumerate(offsets)
        ]
        for future in as_completed(futures):
            if exc := future.exception():
                # Clean up temp dir on error
                shutil.rmtree(temp_dir, ignore_errors=True)
                raise exc

    download_time = time.time() - start
    mem_after_download = memory_usage_mb()

    rows_per_sec = total_rows / download_time if download_time > 0 else 0
    print(
        f"[{output_name}] downloaded {total_rows:,} rows in {download_time:.0f}s "
        f"({rows_per_sec:.0f} rows/s) | memory: {mem_after_download:.1f} MB",
        flush=True,
    )

    # Stream-merge all temp files into final output
    print(f"[{output_name}] merging {total_pages} temp files to Parquet...", flush=True)
    merge_start = time.time()

    # Use glob pattern to scan all temp parquet files and stream to output
    # Handle schema variations: RDW API can return different columns in different pages
    # - missing_columns='insert': add NULL columns for fields missing in some batches
    # - extra_columns='ignore': skip extra columns not in the first batch's schema
    temp_pattern = str(temp_dir / "batch_*.parquet")
    pl.scan_parquet(
        temp_pattern,
        missing_columns="insert",
        extra_columns="ignore",
    ).sink_parquet(output_path, compression="zstd")

    merge_time = time.time() - merge_start
    mem_after_merge = memory_usage_mb()

    # Clean up temp directory
    shutil.rmtree(temp_dir, ignore_errors=True)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(
        f"[{output_name}] merged Parquet in {merge_time:.1f}s ({file_size_mb:.1f} MB) "
        f"| memory: {mem_after_merge:.1f} MB",
        flush=True,
    )

    return total_rows


def dataset_download_to_parquet(
    session: requests.Session,
    dataset_id: str,
    output_name: str,
    verbose: bool,
) -> tuple[int, float]:
    """
    Download dataset and save as Parquet using parallel pagination.

    Returns: (row_count, elapsed_seconds)
    """
    output_path = DIR_OUTPUT / f"{output_name}.parquet"

    # Get row count for parallel downloads
    mem_start = memory_usage_mb()
    print(f"[{output_name}] fetching row count... | memory: {mem_start:.1f} MB", flush=True)
    total_rows = row_count_get(session, dataset_id)

    if total_rows is None or total_rows == 0:
        print(f"[{output_name}] no rows found or count failed", flush=True)
        return 0, 0.0

    print(f"[{output_name}] {total_rows:,} rows to download", flush=True)

    start = time.time()

    # Download using parallel pagination
    row_count = dataset_download_parallel(
        session, dataset_id, output_name, output_path, verbose, total_rows
    )

    # Update metadata
    today = datetime.now().strftime("%Y%m%d")
    last_download_date_set(dataset_id, today)

    total_time = time.time() - start
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(
        f"[{output_name}] done: {row_count:,} rows, {file_size_mb:.1f} MB, {total_time:.0f}s total",
        flush=True,
    )

    return row_count, total_time


def main() -> None:
    """Download RDW datasets to Parquet format."""
    parser = argparse.ArgumentParser(
        description="Download RDW datasets to Parquet format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Datasets available:
  m9d7-ebf2 - Gekentekende Voertuigen (vehicle registrations)
  sgfe-77wx - Meldingen Keuringsinstantie (inspection results)
  a34c-vvps - Geconstateerde Gebreken (defects found)
  hx2c-gt7k - Gebreken (defect type reference)
  8ys7-d773 - Brandstof (fuel data)

Examples:
  %(prog)s --all --verbose           # Download all datasets
  %(prog)s hx2c-gt7k --verbose       # Download small reference dataset
  %(prog)s m9d7-ebf2                 # Download vehicle registrations
""",
    )
    parser.add_argument(
        "dataset_id",
        nargs="?",
        help="RDW dataset ID (e.g., m9d7-ebf2)",
    )
    parser.add_argument(
        "--all",
        "-a",
        action="store_true",
        help="Download all 5 datasets",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Show detailed progress",
    )
    args = parser.parse_args()

    if not args.dataset_id and not args.all:
        parser.print_help()
        sys.exit(1)

    env_load()
    DIR_OUTPUT.mkdir(parents=True, exist_ok=True)

    session = session_create()

    # Determine which datasets to download
    if args.all:
        datasets_to_download = list(DATASETS.items())
    else:
        if args.dataset_id not in DATASETS:
            print(f"Unknown dataset: {args.dataset_id}")
            print(f"Available: {', '.join(DATASETS.keys())}")
            sys.exit(1)
        datasets_to_download = [(args.dataset_id, DATASETS[args.dataset_id])]

    print(f"Downloading {len(datasets_to_download)} dataset(s) to {DIR_OUTPUT}")
    print()

    total_start = time.time()
    total_rows = 0
    failed = []

    for dataset_id, output_name in datasets_to_download:
        try:
            row_count, _ = dataset_download_to_parquet(
                session=session,
                dataset_id=dataset_id,
                output_name=output_name,
                verbose=args.verbose,
            )
            total_rows += row_count
        except Exception as e:
            print(f"[{output_name}] FAILED: {e}", flush=True)
            failed.append(output_name)
        print()

    total_time = time.time() - total_start

    # Summary
    print("=" * 60)
    print(
        f"Complete: {len(datasets_to_download) - len(failed)}/{len(datasets_to_download)} datasets"
    )
    print(f"Total rows: {total_rows:,}")
    print(f"Total time: {total_time / 60:.1f} minutes")
    if failed:
        print(f"Failed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
