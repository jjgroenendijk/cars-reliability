"""
Fuel breakdown building functions.

Builds fuel type distribution data per brand and model.
"""

import polars as pl

from config import KNOWN_FUEL_TYPES


def _build_fuel_dict(df: pl.DataFrame, key_col: str) -> dict[str, dict[str, int]]:
    """Build fuel dictionary using Polars struct aggregation.

    Args:
        df: DataFrame containing at least key_col, "fuel_type", and "kenteken".
        key_col: The column name to group by (e.g., "merk" or "model_key").

    Returns:
        Dictionary mapping key_col values to fuel breakdown dicts.
    """
    # 1. Aggregate counts by key and fuel type
    counts = (
        df.group_by([key_col, "fuel_type"])
        .agg(pl.col("kenteken").n_unique().alias("count"))
    )

    # 2. Pivot to wide format so fuel types become columns
    # We use "count" as values. Missing combinations get null, which we fill with 0.
    pivoted = counts.pivot(
        index=key_col,
        columns="fuel_type",
        values="count"
    ).fill_null(0)

    # 3. Ensure all known fuel types + "other" are present as columns
    # Sort to ensure consistent field order in the struct/dict
    expected_cols = sorted(list(KNOWN_FUEL_TYPES)) + ["other"]
    existing_cols = set(pivoted.columns)

    # Add missing columns with 0
    missing_cols = [col for col in expected_cols if col not in existing_cols]
    if missing_cols:
        pivoted = pivoted.with_columns([
            pl.lit(0).alias(col) for col in missing_cols
        ])

    # 4. Create struct column with all fuel counts
    # The struct fields will follow the order in expected_cols
    struct_df = pivoted.select(
        pl.col(key_col),
        pl.struct(expected_cols).alias("fuel_breakdown")
    )

    # 5. Convert directly to dictionary
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
    fuel_with_brand = (
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
        .collect()
        # Deduplicate on (kenteken, fuel_type) so that simple count/len equals n_unique
        .unique(subset=["kenteken", "fuel_type"])
    )

    # Build brand fuel breakdown
    brand_fuel = _build_fuel_dict(fuel_with_brand, "merk")

    # Build model fuel breakdown
    # Create model_key first
    fuel_with_model = fuel_with_brand.with_columns(
        (pl.col("merk") + "|" + pl.col("handelsbenaming")).alias("model_key")
    )
    model_fuel = _build_fuel_dict(fuel_with_model, "model_key")

    return brand_fuel, model_fuel
