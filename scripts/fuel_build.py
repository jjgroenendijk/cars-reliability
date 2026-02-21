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
        # Deduplicate on (kenteken, fuel_type) so that simple count/len equals n_unique
        .unique(subset=["kenteken", "fuel_type"])
    )

    def _pivot_to_fuel_dict(df: pl.DataFrame, index_col: str) -> dict[str, dict[str, int]]:
        """Pivot DataFrame and convert to nested dictionary efficiently."""
        # Use pivot to aggregate counts
        # Since we deduplicated, 'len' is equivalent to n_unique
        pivoted = df.pivot(
            on="fuel_type", index=index_col, values="kenteken", aggregate_function="len"
        ).fill_null(0)

        # Ensure all expected fuel columns exist
        expected_fuels = ["Benzine", "Diesel", "Elektriciteit", "LPG", "other"]
        for fuel in expected_fuels:
            if fuel not in pivoted.columns:
                pivoted = pivoted.with_columns(pl.lit(0).alias(fuel))

        # Select columns in fixed order
        pivoted = pivoted.select([index_col] + expected_fuels)

        # Convert to dict using struct trick for speed (avoids iterating over rows manually)
        struct_df = pivoted.select([pl.col(index_col), pl.struct(expected_fuels).alias("data")])

        return {row[index_col]: row["data"] for row in struct_df.to_dicts()}

    # Generate brand breakdown
    brand_fuel = _pivot_to_fuel_dict(fuel_with_brand, "merk")

    # Generate model breakdown
    # Create model_key column first
    fuel_with_brand_model = fuel_with_brand.with_columns(
        (pl.col("merk") + "|" + pl.col("handelsbenaming")).alias("model_key")
    )
    model_fuel = _pivot_to_fuel_dict(fuel_with_brand_model, "model_key")

    return brand_fuel, model_fuel
