"""
Helper utilities for Stage 2 inspection preparation and I/O.

Uses Polars lazy API for memory-efficient processing - avoids Python dict conversion.
"""

import json
from pathlib import Path
from typing import Any

import polars as pl

from config import DIR_PARQUET


def scan_dataset(dataset_name: str) -> pl.LazyFrame:
    """Scan a Parquet dataset lazily.

    Args:
        dataset_name: Name of the dataset (e.g., "voertuigen", "meldingen")

    Returns:
        LazyFrame for the dataset
    """
    parquet_path = DIR_PARQUET / f"{dataset_name}.parquet"

    if not parquet_path.exists():
        raise FileNotFoundError(f"Parquet file not found: {parquet_path}")

    return pl.scan_parquet(parquet_path)


def load_dataset(dataset_name: str, columns: list[str] | None = None) -> pl.DataFrame:
    """Load a Parquet dataset as DataFrame.

    Args:
        dataset_name: Name of the dataset (e.g., "voertuigen", "meldingen")
        columns: Optional list of columns to load

    Returns:
        DataFrame with the dataset
    """
    parquet_path = DIR_PARQUET / f"{dataset_name}.parquet"

    if not parquet_path.exists():
        raise FileNotFoundError(f"Parquet file not found: {parquet_path}")

    if columns:
        return pl.read_parquet(parquet_path, columns=columns)
    return pl.read_parquet(parquet_path)


def json_save(data: Any, filepath: Path) -> None:
    """Save data to a JSON file.

    Uses native Polars write_json for DataFrames, Python json for dicts.
    """
    filepath.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, pl.DataFrame):
        data.write_json(filepath)
    else:
        with open(filepath, "w", encoding="utf-8") as file_handle:
            json.dump(data, file_handle, ensure_ascii=False, indent=2)
