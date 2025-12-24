#!/usr/bin/env python3
"""
Validate cached parquet files before download.

Checks if a parquet file exists, has reasonable size, and is readable.
Exit code 0 = valid, 1 = invalid/missing.

Usage:
    uv run python cache_validate.py ../data/parquet/voertuigen.parquet
"""

import argparse
import sys
from pathlib import Path

import polars as pl

from config import DEFAULT_MIN_CACHE_SIZE, MIN_CACHE_SIZES


def parquet_validate(file_path: Path) -> tuple[bool, str]:
    """Validate parquet file exists and is readable."""
    if not file_path.exists():
        return False, "file does not exist"

    # Check file size
    size = file_path.stat().st_size
    dataset_name = file_path.stem
    min_size = MIN_CACHE_SIZES.get(dataset_name, DEFAULT_MIN_CACHE_SIZE)

    if size < min_size:
        return False, f"file too small ({size:,} bytes, expected >= {min_size:,})"

    # Try to read parquet metadata
    try:
        df = pl.scan_parquet(file_path)
        schema = df.collect_schema()
        if len(schema) == 0:
            return False, "parquet has no columns"

        # Get row count without loading all data
        row_count = df.select(pl.len()).collect().item()
        if row_count == 0:
            return False, "parquet has no rows"

        return True, f"valid ({row_count:,} rows, {size / 1024 / 1024:.1f} MB)"
    except Exception as e:
        return False, f"failed to read parquet: {e}"


def main() -> None:
    """Validate parquet file and exit with appropriate code."""
    parser = argparse.ArgumentParser(description="Validate cached parquet file")
    parser.add_argument("file", type=Path, help="Path to parquet file")
    args = parser.parse_args()

    valid, message = parquet_validate(args.file)
    print(f"{'✓' if valid else '✗'} {args.file.name}: {message}")
    sys.exit(0 if valid else 1)


if __name__ == "__main__":
    main()
