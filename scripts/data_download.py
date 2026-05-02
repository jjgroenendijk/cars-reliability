#!/usr/bin/env python3
"""
RDW Dataset to Parquet Export Script

Downloads complete RDW datasets via streamed CSV shards and exports to Parquet.
Uses non-overlapping kenteken shards to avoid unstable offset pagination.

Usage:
    uv run python data_download.py --all                  # Download all 5 datasets
    uv run python data_download.py m9d7-ebf2 --verbose    # Download single dataset
    uv run python data_download.py hx2c-gt7k --verbose    # Small dataset for testing

Datasets:
    m9d7-ebf2 - Gekentekende Voertuigen
    sgfe-77wx - Meldingen Keuringsinstantie
    a34c-vvps - Geconstateerde Gebreken
    hx2c-gt7k - Gebreken
    8ys7-d773 - Brandstof
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import polars as pl
import psutil
import requests

from api_client import (
    PARALLEL_WORKERS,
    csv_stream_download,
    env_load,
    row_count_get,
    session_create,
)
from config import DATASETS, DIR_PARQUET

# Metadata file path
METADATA_FILE = DIR_PARQUET / ".download_metadata.json"
KENTEKEN_DATASETS = {"m9d7-ebf2", "sgfe-77wx", "a34c-vvps", "8ys7-d773"}
KENTEKEN_PREFIXES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
SHARD_WORKERS = min(8, PARALLEL_WORKERS)


def metadata_load() -> dict:
    """Load download metadata from disk."""
    if METADATA_FILE.exists():
        with open(METADATA_FILE) as f:
            return json.load(f)
    return {}


def metadata_save(metadata: dict) -> None:
    """Save download metadata to disk."""
    DIR_PARQUET.mkdir(parents=True, exist_ok=True)
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


def temp_schema_collect(temp_paths: list[Path]) -> dict[str, pl.DataType]:
    """Collect the union schema from temporary Parquet files."""
    schema: dict[str, pl.DataType] = {}
    for temp_path in temp_paths:
        for name, dtype in pl.scan_parquet(temp_path).collect_schema().items():
            schema.setdefault(name, dtype)
    return schema


def csv_shards_get(dataset_id: str) -> list[tuple[str, str | None]]:
    """Return non-overlapping CSV export shards for a dataset."""
    if dataset_id not in KENTEKEN_DATASETS:
        return [("full", None)]
    return [
        (f"kenteken_{prefix}", f"starts_with(kenteken, '{prefix}')") for prefix in KENTEKEN_PREFIXES
    ]


def csv_shard_convert(csv_path: Path, parquet_path: Path) -> int:
    """Convert one CSV shard to Parquet with all raw columns kept as strings."""
    pl.scan_csv(csv_path, infer_schema=False).sink_parquet(parquet_path, compression="zstd")
    return int(pl.scan_parquet(parquet_path).select(pl.len()).collect().item())


def dataset_download_sharded(
    session: requests.Session,
    dataset_id: str,
    output_name: str,
    output_path: Path,
    verbose: bool,
    total_rows: int,
) -> int:
    """
    Download dataset with parallel CSV shards and write directly to Parquet.

    Uses temp files to avoid memory accumulation. Each shard is streamed to a CSV
    file, converted to Parquet with string columns, then merged at the end.

    Returns: row_count
    """
    shards = csv_shards_get(dataset_id)
    total_shards = len(shards)

    print(
        f"[{output_name}] downloading {total_rows:,} rows in {total_shards} CSV shards "
        f"using {SHARD_WORKERS} workers...",
        flush=True,
    )

    temp_dir = Path(tempfile.mkdtemp(prefix=f"rdw_{output_name}_"))

    shards_done = 0
    rows_written = 0
    progress_lock = threading.Lock()

    start = time.time()
    last_progress_time = [start]

    def shard_fetch_write(shard_idx: int, shard_name: str, where_clause: str | None) -> Path:
        """Fetch one CSV shard and convert it to a temp Parquet file."""
        nonlocal rows_written, shards_done
        csv_path = temp_dir / f"{shard_idx:03d}_{shard_name}.csv"
        parquet_path = temp_dir / f"{shard_idx:03d}_{shard_name}.parquet"
        csv_stream_download(session, dataset_id, where_clause, total_rows, csv_path)
        shard_rows = csv_shard_convert(csv_path, parquet_path)
        csv_path.unlink(missing_ok=True)

        with progress_lock:
            rows_written += shard_rows
            shards_done += 1

            if verbose:
                now = time.time()
                if now - last_progress_time[0] >= 5:
                    elapsed = now - start
                    pct = (shards_done / total_shards * 100) if total_shards > 0 else 0
                    speed = rows_written / elapsed if elapsed > 0 else 0
                    mem = memory_usage_mb()
                    print(
                        f"  [{output_name}] {pct:.1f}% | {shards_done}/{total_shards} "
                        f"shards | {rows_written:,} rows | {speed:.0f} rows/s | {mem:.0f} MB",
                        flush=True,
                    )
                    last_progress_time[0] = now
        return parquet_path

    temp_paths: list[Path] = []
    try:
        with ThreadPoolExecutor(max_workers=SHARD_WORKERS) as executor:
            futures = [
                executor.submit(shard_fetch_write, idx, shard_name, where_clause)
                for idx, (shard_name, where_clause) in enumerate(shards)
            ]
            for future in as_completed(futures):
                temp_paths.append(future.result())
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise

    download_time = time.time() - start
    mem_after_download = memory_usage_mb()
    rows_per_sec = rows_written / download_time if download_time > 0 else 0

    print(
        f"[{output_name}] downloaded {rows_written:,} rows in {download_time:.0f}s "
        f"({rows_per_sec:.0f} rows/s) | memory: {mem_after_download:.1f} MB",
        flush=True,
    )

    print(f"[{output_name}] merging {len(temp_paths)} temp files to Parquet...", flush=True)
    merge_start = time.time()

    temp_paths = sorted(temp_paths)
    temp_schema = temp_schema_collect(temp_paths)
    output_path.unlink(missing_ok=True)
    pl.scan_parquet(
        [str(temp_path) for temp_path in temp_paths],
        schema=temp_schema,
        missing_columns="insert",
        extra_columns="ignore",
    ).sink_parquet(output_path, compression="zstd")

    merge_time = time.time() - merge_start
    mem_after_merge = memory_usage_mb()

    shutil.rmtree(temp_dir, ignore_errors=True)

    final_rows = int(pl.scan_parquet(output_path).select(pl.len()).collect().item())
    if final_rows != total_rows:
        raise RuntimeError(
            f"row count mismatch after merge: local={final_rows:,}, RDW={total_rows:,}"
        )

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(
        f"[{output_name}] merged Parquet in {merge_time:.1f}s ({file_size_mb:.1f} MB) "
        f"| memory: {mem_after_merge:.1f} MB",
        flush=True,
    )

    return final_rows


def dataset_download_to_parquet(
    session: requests.Session,
    dataset_id: str,
    output_name: str,
    verbose: bool,
) -> tuple[int, float]:
    """
    Download dataset and save as Parquet using parallel CSV shards.

    Returns: (row_count, elapsed_seconds)
    """
    output_path = DIR_PARQUET / f"{output_name}.parquet"

    mem_start = memory_usage_mb()
    print(f"[{output_name}] fetching row count... | memory: {mem_start:.1f} MB", flush=True)
    total_rows = row_count_get(session, dataset_id)

    if total_rows is None or total_rows == 0:
        print(f"[{output_name}] no rows found or count failed", flush=True)
        return 0, 0.0

    print(f"[{output_name}] {total_rows:,} rows to download", flush=True)

    start = time.time()

    row_count = dataset_download_sharded(
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
    DIR_PARQUET.mkdir(parents=True, exist_ok=True)

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

    print(f"Downloading {len(datasets_to_download)} dataset(s) to {DIR_PARQUET}")
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
