"""
Fuel breakdown building functions.

Builds fuel type distribution data per brand and model.
"""

import polars as pl

from config import KNOWN_FUEL_TYPES


def _build_fuel_dict(df: pl.DataFrame, key_col: str) -> dict[str, dict[str, int]]:
    """Build fuel dictionary using Polars struct aggregation.

    Args:
        df: DataFrame containing at least key_col, "fuel_type", and "count".
        key_col: The column name to group by (e.g., "merk" or "model_key").

    Returns:
        Dictionary mapping key_col values to fuel breakdown dicts.
    """
    # 1. Pivot to wide format so fuel types become columns
    # We use "count" as values. Missing combinations get null, which we fill with 0.
    pivoted = df.pivot(index=key_col, on="fuel_type", values="count").fill_null(0)

    # 2. Ensure all known fuel types + "other" are present as columns
    # Sort to ensure consistent field order in the struct/dict
    expected_cols = sorted(list(KNOWN_FUEL_TYPES)) + ["other"]
    existing_cols = set(pivoted.columns)

    # Add missing columns with 0
    missing_cols = [col for col in expected_cols if col not in existing_cols]
    if missing_cols:
        pivoted = pivoted.with_columns([pl.lit(0).alias(col) for col in missing_cols])

    # 3. Create struct column with all fuel counts
    # The struct fields will follow the order in expected_cols
    struct_df = pivoted.select(pl.col(key_col), pl.struct(expected_cols).alias("fuel_breakdown"))

    # 4. Convert directly to dictionary
    # to_list() on a struct column returns a list of dictionaries
    return dict(zip(struct_df[key_col], struct_df["fuel_breakdown"].to_list()))


def build_fuel_breakdown(
    brandstof_lf: pl.LazyFrame,
    vehicles_lf: pl.LazyFrame,
) -> tuple[dict[str, dict[str, int]], dict[str, dict[str, int]]]:
    """Build fuel type breakdown per brand and model.

    Returns:
        Tuple of (brand_fuel, model_fuel) where each is a dict mapping
        brand/model name to FuelBreakdown dict with keys:
        Benzine, Diesel, Elektriciteit, LPG, other
    """
    # Join brandstof with vehicles to get brand/model info
    # Note: a vehicle can have multiple fuel entries (e.g., hybrid)
    fuel_with_brand_lf = (
        brandstof_lf.select(["kenteken", "brandstof_omschrijving"])
        .join(
            vehicles_lf.select(
                [
                    "kenteken",
                    pl.col("merk").str.to_uppercase().str.strip_chars().alias("merk"),
                    pl.col("handelsbenaming")
                    .str.to_uppercase()
                    .str.strip_chars()
                    .alias("handelsbenaming"),
                ]
            ),
            on="kenteken",
            how="inner",
        )
        .with_columns(
            # Map fuel types: known types stay as-is, others become "other"
            pl.when(pl.col("brandstof_omschrijving").is_in(list(KNOWN_FUEL_TYPES)))
            .then(pl.col("brandstof_omschrijving"))
            .otherwise(pl.lit("other"))
            .alias("fuel_type")
        )
    )

    # Perform a single pass aggregation:
    # 1. Group by merk, handelsbenaming (to avoid creating string key on full dataset),
    #    and fuel_type
    # 2. Count unique vehicles
    # This avoids materializing the huge joined table and avoids expensive string ops on large data.
    raw_stats_df = (
        fuel_with_brand_lf.group_by(["merk", "handelsbenaming", "fuel_type"])
        .agg(pl.col("kenteken").n_unique().alias("count"))
        .collect(engine="streaming")
    )

    # Create model_key on the aggregated result (much smaller)
    model_fuel_stats_df = raw_stats_df.with_columns(
        (pl.col("merk") + "|" + pl.col("handelsbenaming")).alias("model_key")
    )

    # Aggregate by brand from the materialized stats
    brand_fuel_df = model_fuel_stats_df.group_by(["merk", "fuel_type"]).agg(pl.col("count").sum())

    # Model stats is already aggregated
    model_fuel_df = model_fuel_stats_df.select(["model_key", "fuel_type", "count"])

    brand_fuel = _build_fuel_dict(brand_fuel_df, "merk")
    model_fuel = _build_fuel_dict(model_fuel_df, "model_key")

    return brand_fuel, model_fuel
