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

# Output directory
DIR_OUTPUT = Path(__file__).parent.parent / "data" / "duckdb"
METADATA_FILE = DIR_OUTPUT / ".download_metadata.json"

# RDW API
API_BASE = "https://opendata.rdw.nl"
COUNT_URL = API_BASE + "/resource/{id}.json?$select=count(*)"
RESOURCE_URL = API_BASE + "/resource/{id}.json?$limit={limit}&$offset={offset}"
REQUEST_TIMEOUT = 3600  # 1 hour for very large downloads
PAGE_SIZE = 50000  # Rows per page for parallel pagination
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
    try:
        url = COUNT_URL.format(id=dataset_id)
        r = session.get(url, timeout=30)
        r.raise_for_status()
        data = r.json()
        return int(data[0].get("count", 0)) if data else None
    except Exception:
        return None


def page_fetch(
    session: requests.Session, dataset_id: str, offset: int, limit: int
) -> list[dict]:
    """Fetch a single page of data from the API."""
    url = RESOURCE_URL.format(id=dataset_id, limit=limit, offset=offset)
    r = session.get(url, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.json()


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

    Returns: row_count
    """
    page_size = PAGE_SIZE
    total_pages = math.ceil(total_rows / page_size) if total_rows > 0 else 1
    offsets = list(range(0, total_rows, page_size))

    print(
        f"[{output_name}] downloading {total_rows:,} rows in {total_pages} pages "
        f"using {PARALLEL_WORKERS} workers...",
        flush=True,
    )

    # Store LazyFrames (no memory accumulation)
    all_lazyframes: list[pl.LazyFrame] = []
    pages_fetched = 0
    pages_lock = threading.Lock()

    start = time.time()
    last_progress_time = [start]  # Use list to allow mutation in closure

    def fetch_page_wrapper(page_idx: int, offset: int) -> None:
        """Fetch a page and convert to LazyFrame."""
        nonlocal pages_fetched
        page_data = page_fetch(session, dataset_id, offset, page_size)

        # Convert to LazyFrame immediately (no memory accumulation)
        page_lf = pl.LazyFrame(page_data)

        with pages_lock:
            all_lazyframes.append(page_lf)
            pages_fetched += 1

            # Progress update every 5 seconds
            if verbose:
                now = time.time()
                if now - last_progress_time[0] >= 5:
                    elapsed = now - start
                    pct = (pages_fetched / total_pages * 100) if total_pages > 0 else 0
                    rows_fetched = pages_fetched * page_size
                    speed = rows_fetched / elapsed if elapsed > 0 else 0
                    print(
                        f"  [{output_name}] {pct:.1f}% | {pages_fetched}/{total_pages} "
                        f"pages | {rows_fetched:,} rows | {speed:.0f} rows/s",
                        flush=True,
                    )
                    last_progress_time[0] = now

    # Download all pages in parallel
    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as executor:
        futures = [
            executor.submit(fetch_page_wrapper, idx, offset)
            for idx, offset in enumerate(offsets)
        ]
        for future in as_completed(futures):
            if exc := future.exception():
                raise exc

    download_time = time.time() - start
    mem_after_download = memory_usage_mb()

    rows_per_sec = total_rows / download_time if download_time > 0 else 0
    print(
        f"[{output_name}] downloaded {total_rows:,} rows in {download_time:.0f}s "
        f"({rows_per_sec:.0f} rows/s) | memory: {mem_after_download:.1f} MB",
        flush=True,
    )

    # Concatenate LazyFrames and stream to Parquet
    print(f"[{output_name}] streaming to Parquet with ZSTD compression...", flush=True)
    convert_start = time.time()

    combined_lf = pl.concat(all_lazyframes, how="diagonal")
    combined_lf.sink_parquet(output_path, compression="zstd")

    convert_time = time.time() - convert_start
    mem_after_write = memory_usage_mb()
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(
        f"[{output_name}] wrote Parquet in {convert_time:.1f}s ({file_size_mb:.1f} MB) "
        f"| memory: {mem_after_write:.1f} MB",
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
        f"[{output_name}] done: {row_count:,} rows, {file_size_mb:.1f} MB, "
        f"{total_time:.0f}s total",
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
    print(f"Complete: {len(datasets_to_download) - len(failed)}/{len(datasets_to_download)} datasets")
    print(f"Total rows: {total_rows:,}")
    print(f"Total time: {total_time / 60:.1f} minutes")
    if failed:
        print(f"Failed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
