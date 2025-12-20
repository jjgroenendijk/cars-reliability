#!/usr/bin/env python3
"""
RDW Dataset to DuckDB/Parquet Export Script

Downloads complete RDW datasets via streaming CSV and exports to Parquet format.
Uses memory-efficient streaming to handle datasets larger than available RAM.
Supports incremental downloads for inspection-related datasets.

Usage:
    uv run python data_duckdb_export.py --all                  # Download all 5 datasets
    uv run python data_duckdb_export.py m9d7-ebf2 --verbose    # Download single dataset
    uv run python data_duckdb_export.py hx2c-gt7k --verbose    # Small dataset for testing
    uv run python data_duckdb_export.py sgfe-77wx --incremental # Incremental update

Datasets:
    m9d7-ebf2 - Gekentekende Voertuigen (vehicle registrations)
    sgfe-77wx - Meldingen Keuringsinstantie (inspection results) [incremental]
    a34c-vvps - Geconstateerde Gebreken (defects found) [incremental]
    hx2c-gt7k - Gebreken (defect type reference)
    8ys7-d773 - Brandstof (fuel data)
"""

import argparse
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import duckdb
import requests

# Output directory
DIR_OUTPUT = Path(__file__).parent.parent / "data" / "duckdb"
METADATA_FILE = DIR_OUTPUT / ".download_metadata.json"

# RDW API
API_BASE = "https://opendata.rdw.nl"
EXPORT_URL = API_BASE + "/api/views/{id}/rows.csv?accessType=DOWNLOAD"
FILTERED_EXPORT_URL = API_BASE + "/resource/{id}.csv?$limit=999999999&$where={where}"
COUNT_URL = API_BASE + "/resource/{id}.json?$select=count(*)"
REQUEST_TIMEOUT = 3600  # 1 hour for very large downloads
CHUNK_SIZE = 1024 * 1024  # 1MB chunks for streaming

# Dataset definitions
DATASETS = {
    "m9d7-ebf2": "voertuigen",
    "sgfe-77wx": "meldingen",
    "a34c-vvps": "geconstateerde_gebreken",
    "hx2c-gt7k": "gebreken",
    "8ys7-d773": "brandstof",
}

# Datasets that support incremental updates (have meld_datum_door_keuringsinstantie)
INCREMENTAL_DATASETS = {"sgfe-77wx", "a34c-vvps"}

# Primary keys for deduplication during merge
PRIMARY_KEYS = {
    "sgfe-77wx": ["kenteken", "meld_datum_door_keuringsinstantie", "meld_tijd_door_keuringsinstantie"],
    "a34c-vvps": ["kenteken", "meld_datum_door_keuringsinstantie", "meld_tijd_door_keuringsinstantie", "gebrek_identificatie"],
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
    """Create HTTP session with connection pooling."""
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(
        pool_connections=1,
        pool_maxsize=1,
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


def last_download_date_get(dataset_id: str) -> str | None:
    """Get last download date for a dataset (YYYYMMDD format)."""
    metadata = metadata_load()
    return metadata.get(dataset_id, {}).get("last_date")


def last_download_date_set(dataset_id: str, date_str: str) -> None:
    """Set last download date for a dataset."""
    metadata = metadata_load()
    if dataset_id not in metadata:
        metadata[dataset_id] = {}
    metadata[dataset_id]["last_date"] = date_str
    metadata[dataset_id]["updated_at"] = datetime.now().isoformat()
    metadata_save(metadata)


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


def dataset_download_to_parquet(
    session: requests.Session,
    dataset_id: str,
    output_name: str,
    verbose: bool,
    incremental: bool = False,
) -> tuple[int, float]:
    """
    Download dataset and save as Parquet using DuckDB.

    Strategy:
    1. Stream CSV to a temporary file (memory efficient)
    2. Use DuckDB to read CSV and export to Parquet (DuckDB handles memory internally)
    3. For incremental: merge with existing parquet, deduplicate by primary key

    Returns: (row_count, elapsed_seconds)
    """
    # Determine if we can do incremental download
    since_date: str | None = None
    if incremental and dataset_id in INCREMENTAL_DATASETS:
        since_date = last_download_date_get(dataset_id)
        if since_date:
            print(f"[{output_name}] incremental mode: fetching records since {since_date}", flush=True)
        else:
            print(f"[{output_name}] no previous download found, doing full download", flush=True)
            incremental = False

    # Build URL - use filtered endpoint for incremental, full export for complete download
    if incremental and since_date:
        where_clause = f"meld_datum_door_keuringsinstantie >= '{since_date}'"
        url = FILTERED_EXPORT_URL.format(id=dataset_id, where=quote(where_clause))
    else:
        url = EXPORT_URL.format(id=dataset_id)

    # Get row count for percentage (verbose mode only)
    total_rows: int | None = None
    if verbose:
        print(f"[{output_name}] fetching row count...", flush=True)
        total_rows = row_count_get(session, dataset_id)
        if total_rows:
            print(f"[{output_name}] {total_rows:,} rows to download", flush=True)

    print(f"[{output_name}] starting download...", flush=True)
    start = time.time()

    # Create temporary file for streaming CSV
    with tempfile.NamedTemporaryFile(
        mode="wb", suffix=".csv", delete=False
    ) as temp_file:
        temp_path = temp_file.name

        try:
            # Stream CSV to temp file
            response = session.get(url, timeout=REQUEST_TIMEOUT, stream=True)
            response.raise_for_status()

            bytes_downloaded = 0
            last_progress_time = start

            for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
                if chunk:
                    temp_file.write(chunk)
                    bytes_downloaded += len(chunk)

                    # Progress update every 5 seconds
                    if verbose:
                        now = time.time()
                        if now - last_progress_time >= 5:
                            elapsed = now - start
                            mb = bytes_downloaded / (1024 * 1024)
                            speed = mb / elapsed if elapsed > 0 else 0
                            print(
                                f"  [{output_name}] downloading: {mb:.1f} MB | {speed:.1f} MB/s",
                                flush=True,
                            )
                            last_progress_time = now

            download_time = time.time() - start
            mb_total = bytes_downloaded / (1024 * 1024)
            print(
                f"[{output_name}] downloaded {mb_total:.1f} MB in {download_time:.0f}s",
                flush=True,
            )

            # Now use DuckDB to convert CSV to Parquet
            print(f"[{output_name}] converting to Parquet...", flush=True)
            convert_start = time.time()

            output_path = DIR_OUTPUT / f"{output_name}.parquet"
            temp_parquet = DIR_OUTPUT / f"{output_name}.parquet.tmp"

            # Use DuckDB's CSV reader which handles large files efficiently
            con = duckdb.connect(":memory:")

            # Read CSV with error handling for malformed rows
            # ignore_errors=true: skip rows with wrong number of columns
            # null_padding=true: pad short rows with NULL
            
            # For incremental updates, merge with existing data
            if incremental and output_path.exists() and dataset_id in PRIMARY_KEYS:
                primary_keys = PRIMARY_KEYS[dataset_id]
                pk_columns = ", ".join(primary_keys)
                
                print(f"[{output_name}] merging with existing data...", flush=True)
                
                # Create view of new data
                con.execute(f"""
                    CREATE VIEW new_data AS 
                    SELECT * FROM read_csv_auto(
                        '{temp_path}',
                        header=true,
                        all_varchar=true,
                        ignore_errors=true,
                        null_padding=true
                    )
                """)
                
                # Create view of existing data
                con.execute(f"""
                    CREATE VIEW existing_data AS 
                    SELECT * FROM read_parquet('{output_path}')
                """)
                
                # Merge: new data takes precedence (UNION ALL with dedup)
                # Use window function to keep latest record per primary key
                con.execute(f"""
                    COPY (
                        SELECT * FROM (
                            SELECT *, ROW_NUMBER() OVER (
                                PARTITION BY {pk_columns} 
                                ORDER BY (SELECT NULL)
                            ) as rn
                            FROM (
                                SELECT * FROM new_data
                                UNION ALL
                                SELECT * FROM existing_data
                            )
                        ) WHERE rn = 1
                    ) EXCLUDE (rn)
                    TO '{temp_parquet}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """)
                
                # Replace original with merged
                temp_parquet.replace(output_path)
            else:
                # Full download - just write directly
                con.execute(f"""
                    COPY (SELECT * FROM read_csv_auto(
                        '{temp_path}',
                        header=true,
                        all_varchar=true,
                        ignore_errors=true,
                        null_padding=true
                    ))
                    TO '{output_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """)

            # Get row count from the parquet file
            row_count = con.execute(
                f"SELECT COUNT(*) FROM read_parquet('{output_path}')"
            ).fetchone()[0]

            con.close()

            # Update metadata with today's date for incremental tracking
            if dataset_id in INCREMENTAL_DATASETS:
                today = datetime.now().strftime("%Y%m%d")
                last_download_date_set(dataset_id, today)

            convert_time = time.time() - convert_start
            total_time = time.time() - start
            file_size_mb = output_path.stat().st_size / (1024 * 1024)

            mode_str = "incremental" if incremental and since_date else "full"
            print(
                f"[{output_name}] done ({mode_str}): {row_count:,} rows, {file_size_mb:.1f} MB Parquet, "
                f"{total_time:.0f}s total",
                flush=True,
            )

            return row_count, total_time

        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)


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
    parser.add_argument(
        "--incremental",
        "-i",
        action="store_true",
        help="Incremental download (only for meldingen/gebreken datasets)",
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
            # Only use incremental for supported datasets
            use_incremental = args.incremental and dataset_id in INCREMENTAL_DATASETS
            row_count, _ = dataset_download_to_parquet(
                session=session,
                dataset_id=dataset_id,
                output_name=output_name,
                verbose=args.verbose,
                incremental=use_incremental,
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
