"""
Helper utilities for Stage 2 inspection preparation and I/O.

Uses Polars lazy API for memory-efficient processing - avoids Python dict conversion.
"""

import json
from pathlib import Path
from typing import Any

import polars as pl

DIR_PARQUET = Path(__file__).parent.parent / "data" / "parquet"


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


def dataframe_write_json(df: pl.DataFrame, filepath: Path) -> None:
    """Write a DataFrame directly to JSON using native Polars.

    More performant than converting to dict and using json.dump.
    """
    filepath.parent.mkdir(parents=True, exist_ok=True)
    df.write_json(filepath)


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


def primary_inspections_filter(inspections_lf: pl.LazyFrame) -> pl.LazyFrame:
    """Filter to primary APK inspections only (one per vehicle per day, earliest time).

    Args:
        inspections_lf: LazyFrame of meldingen data

    Returns:
        LazyFrame with only primary inspection records
    """
    return (
        inspections_lf
        # Filter to periodieke controle only
        .filter(
            pl.col("soort_melding_ki_omschrijving").str.to_lowercase().str.strip_chars()
            == "periodieke controle"
        )
        # Normalize time field
        .with_columns(
            pl.col("meld_tijd_door_keuringsinstantie")
            .fill_null("")
            .str.strip_chars()
            .str.zfill(4)
            .alias("insp_time_normalized")
        )
        # Keep earliest inspection per vehicle per day
        .sort(["kenteken", "meld_datum_door_keuringsinstantie", "insp_time_normalized"])
        .group_by(["kenteken", "meld_datum_door_keuringsinstantie"])
        .first()
    )
