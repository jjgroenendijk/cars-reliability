"""
Fuel breakdown building functions.

Builds fuel type distribution data per brand and model.
"""

import polars as pl

from config import KNOWN_FUEL_TYPES


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
    )

    # Initialize empty FuelBreakdown template
    empty_breakdown = {"Benzine": 0, "Diesel": 0, "Elektriciteit": 0, "LPG": 0, "other": 0}

    # Aggregate by brand using Struct Aggregation
    brand_fuel_agg = (
        fuel_with_brand.group_by(["merk", "fuel_type"])
        .agg(pl.col("kenteken").n_unique().alias("count"))
        .select(pl.col("merk"), pl.struct("fuel_type", "count").alias("entry"))
        .group_by("merk")
        .agg(pl.col("entry"))
    )

    brand_fuel: dict[str, dict[str, int]] = {}
    for brand, entries in brand_fuel_agg.iter_rows():
        breakdown = empty_breakdown.copy()
        for entry in entries:
            breakdown[entry["fuel_type"]] = entry["count"]
        brand_fuel[brand] = breakdown

    # Aggregate by model using Struct Aggregation
    model_fuel_agg = (
        fuel_with_brand.with_columns(
            (pl.col("merk") + "|" + pl.col("handelsbenaming")).alias("model_key")
        )
        .group_by(["model_key", "fuel_type"])
        .agg(pl.col("kenteken").n_unique().alias("count"))
        .select(pl.col("model_key"), pl.struct("fuel_type", "count").alias("entry"))
        .group_by("model_key")
        .agg(pl.col("entry"))
    )

    model_fuel: dict[str, dict[str, int]] = {}
    for model, entries in model_fuel_agg.iter_rows():
        breakdown = empty_breakdown.copy()
        for entry in entries:
            breakdown[entry["fuel_type"]] = entry["count"]
        model_fuel[model] = breakdown

    return brand_fuel, model_fuel
