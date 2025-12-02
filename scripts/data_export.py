#!/usr/bin/env python3
"""
Stage 1: Data Export Download Script

Downloads a single RDW dataset via bulk CSV export API.
Run once per dataset in the pipeline for parallel downloads.

Usage:
    python scripts/data_export.py <dataset_id> [options]
    python scripts/data_export.py m9d7-ebf2 --verbose
    python scripts/data_export.py m9d7-ebf2 --name voertuigen --verbose
    python scripts/data_export.py m9d7-ebf2 --filter "voertuigsoort=Personenauto"
    python scripts/data_export.py m9d7-ebf2 --columns kenteken,merk,handelsbenaming
    python scripts/data_export.py sgfe-77wx --aggregate inspection_count
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

DIR_RAW = Path(__file__).parent.parent / "data" / "raw"
API_BASE = "https://opendata.rdw.nl"
EXPORT_URL = API_BASE + "/api/views/{id}/rows.csv?accessType=DOWNLOAD"
COUNT_URL = API_BASE + "/resource/{id}.json?$select=count(*)"
REQUEST_TIMEOUT = 1800  # 30 minutes for large downloads
CHUNK_SIZE = 1024 * 1024  # 1MB chunks


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
    """Create a session with connection pooling."""
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(
        pool_connections=1, pool_maxsize=1, max_retries=3
    )
    session.mount("https://", adapter)
    if token := os.environ.get("RDW_APP_TOKEN"):
        session.headers["X-App-Token"] = token
    return session


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


def csv_line_parse(line: str) -> list[str]:
    """Parse a CSV line, handling quoted fields with commas."""
    if '"' not in line:
        return line.split(",")

    parts: list[str] = []
    current = ""
    in_quotes = False

    for char in line:
        if char == '"':
            in_quotes = not in_quotes
        elif char == "," and not in_quotes:
            parts.append(current.strip().strip('"'))
            current = ""
        else:
            current += char

    parts.append(current.strip().strip('"'))
    return parts


def dataset_download(
    session: requests.Session,
    dataset_id: str,
    output_name: str,
    verbose: bool,
    filter_spec: str | None = None,
    columns: list[str] | None = None,
    aggregate_field: str | None = None,
) -> tuple[int, int, float]:
    """
    Download dataset and save as JSON.

    Returns: (record_count, bytes_downloaded, elapsed_seconds)
    """
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

    response = session.get(url, timeout=REQUEST_TIMEOUT, stream=True)
    response.raise_for_status()

    # Parse filter spec: "col=val"
    filter_col: str | None = None
    filter_val: str | None = None
    if filter_spec and "=" in filter_spec:
        filter_col, filter_val = filter_spec.split("=", 1)

    # Stream CSV
    buffer = ""
    header_line: str | None = None
    fieldnames: list[str] = []
    col_indices: dict[str, int] = {}
    filter_idx: int | None = None
    column_indices: list[tuple[str, int]] = []
    kenteken_idx: int | None = None

    row_count = 0
    bytes_downloaded = 0
    last_progress_time = start
    records: list[dict[str, str]] = []
    counts: dict[str, int] = {}  # for aggregation mode

    for chunk in response.iter_content(chunk_size=CHUNK_SIZE, decode_unicode=True):
        if chunk:
            bytes_downloaded += len(chunk.encode("utf-8"))
            buffer += chunk

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line:
                    continue

                # First line is header
                if header_line is None:
                    header_line = line
                    fieldnames = csv_line_parse(line)
                    col_indices = {col: i for i, col in enumerate(fieldnames)}

                    # Set up filter
                    if filter_col:
                        filter_idx = col_indices.get(filter_col)

                    # Set up column selection
                    if columns:
                        column_indices = [
                            (c, col_indices[c]) for c in columns if c in col_indices
                        ]
                    else:
                        column_indices = [(c, i) for i, c in enumerate(fieldnames)]

                    # Set up aggregation
                    if aggregate_field:
                        kenteken_idx = col_indices.get("kenteken")
                    continue

                row_count += 1
                parts = csv_line_parse(line)

                # Apply filter
                if filter_idx is not None:
                    if len(parts) <= filter_idx or parts[filter_idx] != filter_val:
                        continue

                # Aggregation mode: count by kenteken
                if aggregate_field and kenteken_idx is not None:
                    if len(parts) > kenteken_idx:
                        kenteken = parts[kenteken_idx]
                        if kenteken:
                            counts[kenteken] = counts.get(kenteken, 0) + 1
                else:
                    # Build record with selected columns
                    row = {
                        c: parts[i] if i < len(parts) else "" for c, i in column_indices
                    }
                    records.append(row)

                # Progress update every 5 seconds (verbose only)
                if verbose:
                    now = time.time()
                    if now - last_progress_time >= 5:
                        elapsed = now - start
                        mb = bytes_downloaded / (1024 * 1024)
                        speed = mb / elapsed if elapsed > 0 else 0
                        if total_rows:
                            pct = (row_count / total_rows) * 100
                            print(
                                f"  [{output_name}] {pct:.1f}% | {row_count:,} rows | "
                                f"{mb:.1f} MB | {speed:.1f} MB/s",
                                flush=True,
                            )
                        else:
                            print(
                                f"  [{output_name}] {row_count:,} rows | {mb:.1f} MB | {speed:.1f} MB/s",
                                flush=True,
                            )
                        last_progress_time = now

    # Convert aggregation counts to records
    if aggregate_field:
        records = [{"kenteken": k, aggregate_field: str(v)} for k, v in counts.items()]

    # Save as JSON
    filepath = DIR_RAW / f"{output_name}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    elapsed = time.time() - start
    size_mb = filepath.stat().st_size / (1024 * 1024)

    print(
        f"[{output_name}] done: {len(records):,} records, {size_mb:.0f} MB, {elapsed:.0f}s",
        flush=True,
    )

    return len(records), bytes_downloaded, elapsed


def main() -> None:
    """Download a single dataset."""
    parser = argparse.ArgumentParser(
        description="Download RDW dataset via CSV export",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s m9d7-ebf2 --name voertuigen
  %(prog)s m9d7-ebf2 --filter "voertuigsoort=Personenauto" --verbose
  %(prog)s m9d7-ebf2 --columns kenteken,merk,handelsbenaming
  %(prog)s sgfe-77wx --aggregate inspection_count
""",
    )
    parser.add_argument("dataset_id", help="RDW dataset ID (e.g., m9d7-ebf2)")
    parser.add_argument("--name", "-n", help="Output filename (default: dataset_id)")
    parser.add_argument(
        "--filter", "-f", dest="filter_spec", help="Filter as col=value"
    )
    parser.add_argument("--columns", "-c", help="Comma-separated column names to keep")
    parser.add_argument(
        "--aggregate", "-a", help="Aggregate by kenteken, output as field name"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Show progress with percentage"
    )
    args = parser.parse_args()

    env_load()
    DIR_RAW.mkdir(parents=True, exist_ok=True)

    output_name = args.name or args.dataset_id
    columns = args.columns.split(",") if args.columns else None

    session = session_create()

    try:
        record_count, bytes_dl, elapsed = dataset_download(
            session=session,
            dataset_id=args.dataset_id,
            output_name=output_name,
            verbose=args.verbose,
            filter_spec=args.filter_spec,
            columns=columns,
            aggregate_field=args.aggregate,
        )

        if args.verbose:
            mb = bytes_dl / (1024 * 1024)
            speed = mb / elapsed if elapsed > 0 else 0
            print(f"Average speed: {speed:.1f} MB/s", flush=True)

    except Exception as e:
        print(f"FAILED: {e}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
