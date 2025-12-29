#!/usr/bin/env python3
"""
Stage 2: Data Processing Script

Reads Parquet data and computes reliability statistics using Polars.
Outputs processed data to data/processed/.

Uses Polars lazy API throughout to minimize memory usage.
"""

import gc
from datetime import datetime

import polars as pl
import psutil

from config import (
    DIR_PROCESSED,
    THRESHOLD_AGE_BRACKET,
    THRESHOLD_BRAND,
    THRESHOLD_MODEL,
    VEHICLE_TYPE_CONSUMER,
    VEHICLE_TYPE_COMMERCIAL,

    PRIMARY_FUEL_TYPES,
)
from defect_build import build_defect_breakdowns, build_defect_codes, build_defect_stats
from fuel_build import build_fuel_breakdown
from inspection_prepare import json_save, load_dataset, primary_inspections_filter, scan_dataset
from stats_aggregate import aggregate_brand_stats, aggregate_model_stats, generate_rankings


def memory_mb() -> float:
    """Get current process memory in MB."""
    return psutil.Process().memory_info().rss / (1024 * 1024)


def _determine_primary_fuel(brandstof_lf: pl.LazyFrame) -> pl.LazyFrame:
    """
    Determine primary fuel type per license plate.
    Logic:
    - LPG: If any record is LPG
    - Hybrid: If Electric AND (Benzine OR Diesel)
    - EV: If Electric AND NOT (Benzine OR Diesel)
    - Diesel: If Diesel
    - Benzine: If Benzine
    - Other: Fallback
    """
    # Create pivot-like indicators
    fuel_indicators = brandstof_lf.group_by("kenteken").agg(
        [
            (pl.col("brandstof_omschrijving") == "Elektriciteit").any().alias("has_electric"),
            (pl.col("brandstof_omschrijving") == "Benzine").any().alias("has_benzine"),
            (pl.col("brandstof_omschrijving") == "Diesel").any().alias("has_diesel"),
            (pl.col("brandstof_omschrijving") == "LPG").any().alias("has_lpg"),
        ]
    )

    return fuel_indicators.select(
        [
            "kenteken",
            pl.when(pl.col("has_lpg"))
            .then(pl.lit("LPG"))
            .when(pl.col("has_electric") & (pl.col("has_benzine") | pl.col("has_diesel")))
            .then(pl.lit("Hybrid"))
            .when(pl.col("has_electric"))
            .then(pl.lit("Elektriciteit"))
            .when(pl.col("has_diesel"))
            .then(pl.lit("Diesel"))
            .when(pl.col("has_benzine"))
            .then(pl.lit("Benzine"))
            .otherwise(pl.lit("Other"))
            .alias("primary_fuel"),
        ]
    )


def compute_inspection_stats(
    inspections_lf: pl.LazyFrame,
    vehicles_lf: pl.LazyFrame,
    defects_lf: pl.LazyFrame,
    brandstof_lf: pl.LazyFrame,
) -> pl.DataFrame:
    """Compute per-vehicle inspection statistics using Polars operations.

    This replaces the Python dict-based vehicle_summaries_build.
    """
    # 1. Filter valid inspections
    primary_inspections = primary_inspections_filter(inspections_lf)

    # 2. Determine Primary Fuel
    fuel_types = _determine_primary_fuel(brandstof_lf)

    # 3. Join Inspections + Vehicles + Fuel
    inspections_with_vehicles = (
        primary_inspections.join(
            vehicles_lf.select(
                [
                    "kenteken",
                    pl.col("merk").str.to_uppercase().str.strip_chars().alias("merk"),
                    pl.col("handelsbenaming")
                    .str.to_uppercase()
                    .str.strip_chars()
                    .alias("handelsbenaming"),
                    "datum_eerste_toelating",
                    pl.col("catalogusprijs").cast(pl.Float64).fill_null(0).alias("catalogusprijs"),
                    # Map vehicle type to user-facing groups
                    pl.when(pl.col("voertuigsoort") == "Personenauto")
                    .then(pl.lit("consumer"))
                    .when(pl.col("voertuigsoort") == "Bedrijfsauto")
                    .then(pl.lit("commercial"))
                    .otherwise(pl.lit("other"))
                    .alias("vehicle_type_group"),
                    # Price Segments (e.g. 5000, 10000, 15000)

                ]
            )
            .filter(pl.col("vehicle_type_group").is_in(["consumer", "commercial"])),
            on="kenteken",
            how="inner",
        )
        .join(fuel_types, on="kenteken", how="left")
        .with_columns(pl.col("primary_fuel").fill_null("Other"))
    )

    # Parse dates and calculate age at inspection
    inspections_with_age = (
        inspections_with_vehicles.with_columns(
            [
                # Parse inspection date (YYYYMMDD format)
                pl.col("meld_datum_door_keuringsinstantie")
                .str.slice(0, 4)
                .cast(pl.Int32)
                .alias("insp_year"),
                pl.col("meld_datum_door_keuringsinstantie")
                .str.slice(4, 2)
                .cast(pl.Int32)
                .alias("insp_month"),
                pl.col("meld_datum_door_keuringsinstantie")
                .str.slice(6, 2)
                .cast(pl.Int32)
                .alias("insp_day"),
                # Parse registration date
                pl.col("datum_eerste_toelating").str.slice(0, 4).cast(pl.Int32).alias("reg_year"),
            ]
        )
        .with_columns(
            [
                # Calculate age in years (approximate)
                (pl.col("insp_year") - pl.col("reg_year")).alias("age_at_inspection"),
            ]
        )
        .filter(
            # Sanity checks
            (pl.col("age_at_inspection") >= 0) & (pl.col("age_at_inspection") <= 100)
        )
    )

    # Count defects per inspection
    defect_counts = defects_lf.group_by(
        ["kenteken", "meld_datum_door_keuringsinstantie", "meld_tijd_door_keuringsinstantie"]
    ).agg(
        [
            pl.col("aantal_gebreken_geconstateerd")
            .fill_null(1)
            .cast(pl.Int64)
            .sum()
            .alias("defect_count"),
        ]
    )

    # Join defects to inspections
    inspections_with_defects = inspections_with_age.join(
        defect_counts,
        on=["kenteken", "meld_datum_door_keuringsinstantie", "meld_tijd_door_keuringsinstantie"],
        how="left",
    ).with_columns(
        [
            pl.col("defect_count").fill_null(0),
        ]
    )

    return inspections_with_defects.collect()


def main() -> None:
    """Main entry point for the data processing script."""
    print(f"Stage2: Processing (Polars native) | memory: {memory_mb():.0f} MB", flush=True)
    start_time = datetime.now()

    # Load reference data (small, load fully)
    gebreken_df = load_dataset("gebreken")
    print(f"Loaded gebreken ({len(gebreken_df):,} rows) | memory: {memory_mb():.0f} MB", flush=True)

    # Scan large datasets lazily
    vehicles_lf = scan_dataset("voertuigen")
    inspections_lf = scan_dataset("meldingen")
    defects_lf = scan_dataset("geconstateerde_gebreken")
    brandstof_lf = scan_dataset("brandstof")
    print(f"Scanning datasets lazily | memory: {memory_mb():.0f} MB", flush=True)

    # Compute inspection statistics (this is the main work)
    print("Computing inspection statistics...", flush=True)
    inspections_df = compute_inspection_stats(inspections_lf, vehicles_lf, defects_lf, brandstof_lf)
    print(
        f"Computed stats ({len(inspections_df):,} inspections) | memory: {memory_mb():.0f} MB",
        flush=True,
    )

    # Aggregate by brand and model (returns stats + age range)
    brand_stats, min_age, max_age = aggregate_brand_stats(inspections_df)
    model_stats, _, _ = aggregate_model_stats(inspections_df)
    print(
        f"Aggregated: {len(brand_stats)} brands, {len(model_stats)} models "
        f"(ages {min_age}-{max_age}) | memory: {memory_mb():.0f} MB",
        flush=True,
    )

    # Build fuel breakdowns
    print("Building fuel breakdowns...", flush=True)
    brand_fuel, model_fuel = build_fuel_breakdown(brandstof_lf, vehicles_lf)
    print(
        f"Fuel breakdowns: {len(brand_fuel)} brands, {len(model_fuel)} models | "
        f"memory: {memory_mb():.0f} MB",
        flush=True,
    )

    # Add fuel_breakdown to brand_stats
    for brand in brand_stats:
        merk = brand["merk"]
        brand["fuel_breakdown"] = brand_fuel.get(
            merk, {"Benzine": 0, "Diesel": 0, "Elektriciteit": 0, "LPG": 0, "other": 0}
        )

    # Add fuel_breakdown to model_stats
    for model in model_stats:
        model_key = f"{model['merk']}|{model['handelsbenaming']}"
        model["fuel_breakdown"] = model_fuel.get(
            model_key, {"Benzine": 0, "Diesel": 0, "Elektriciteit": 0, "LPG": 0, "other": 0}
        )

    # Generate rankings
    rankings = generate_rankings(brand_stats, model_stats)

    # Calculate totals
    total_inspections = len(inspections_df)
    total_defects = int(inspections_df["defect_count"].sum())
    total_vehicles = inspections_df["kenteken"].n_unique()

    # Calculate dynamic ranges for frontend filters
    max_price = int(inspections_df["catalogusprijs"].max())
    max_fleet_size_brand = max(b["vehicle_count"] for b in brand_stats) if brand_stats else 0
    max_fleet_size_model = max(m["vehicle_count"] for m in model_stats) if model_stats else 0
    max_fleet_size = max(max_fleet_size_brand, max_fleet_size_model)

    # Calculate inspections range from stats
    min_inspections_brand = min(b["total_inspections"] for b in brand_stats) if brand_stats else 0
    max_inspections_brand = max(b["total_inspections"] for b in brand_stats) if brand_stats else 0
    min_inspections_model = min(m["total_inspections"] for m in model_stats) if model_stats else 0
    max_inspections_model = max(m["total_inspections"] for m in model_stats) if model_stats else 0
    min_inspections = min(min_inspections_brand, min_inspections_model)
    max_inspections = max(max_inspections_brand, max_inspections_model)

    # Extract unique fuel types from data
    fuel_types = sorted(inspections_df["primary_fuel"].unique().to_list())

    # Build metadata
    metadata = {
        "generated_at": datetime.now().isoformat(),
        "thresholds": {
            "brand": THRESHOLD_BRAND,
            "model": THRESHOLD_MODEL,
            "age_bracket": THRESHOLD_AGE_BRACKET,
        },
        "ranges": {
            "price": {"min": 0, "max": max_price},
            "fleet": {"min": 0, "max": max_fleet_size},
            "age": {"min": min_age, "max": max_age},
            "inspections": {"min": min_inspections, "max": max_inspections},
        },
        "fuel_types": fuel_types,
        "counts": {
            "brands": len(brand_stats),
            "models": len(model_stats),
            "vehicles_processed": total_vehicles,
            "total_inspections": total_inspections,
            "total_defects": total_defects,
            "consumer_vehicles": inspections_df.filter(
                pl.col("vehicle_type_group") == "consumer"
            )
            .select(pl.col("kenteken").n_unique())
            .item(),
            "commercial_vehicles": inspections_df.filter(
                pl.col("vehicle_type_group") == "commercial"
            )
            .select(pl.col("kenteken").n_unique())
            .item(),
        },
        "source": "RDW Open Data",
        "pipeline_stage": 2,
    }


    # Build defect stats
    print("Building defect statistics...", flush=True)
    defect_stats = build_defect_stats(defects_lf, gebreken_df, total_inspections)
    print(f"Defect stats: {len(defect_stats['top_defects'])} defect types", flush=True)

    # Build per-defect breakdowns for dynamic frontend filtering
    print("Building defect breakdowns...", flush=True)
    brand_defect_breakdown, model_defect_breakdown = build_defect_breakdowns(
        defects_lf, inspections_df
    )
    print(
        f"Defect breakdowns: {len(brand_defect_breakdown)} brands, "
        f"{len(model_defect_breakdown)} models | memory: {memory_mb():.0f} MB",
        flush=True,
    )

    # Build defect code index for frontend display
    defect_codes = build_defect_codes(gebreken_df)
    print(f"Defect codes: {len(defect_codes)} codes", flush=True)

    # Free memory before saving
    del inspections_df
    gc.collect()

    # Save outputs - all are now dicts/lists after aggregation refactoring
    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)

    # Use json_save for all outputs (brand_stats and model_stats are now list[dict])
    json_save(brand_stats, DIR_PROCESSED / "brand_stats.json")
    json_save(model_stats, DIR_PROCESSED / "model_stats.json")

    # Use json_save for dicts (rankings, metadata, defect_stats, defect breakdowns)
    json_save(rankings, DIR_PROCESSED / "rankings.json")
    json_save(metadata, DIR_PROCESSED / "metadata.json")
    json_save(defect_stats, DIR_PROCESSED / "defect_stats.json")
    json_save(brand_defect_breakdown, DIR_PROCESSED / "brand_defect_breakdown.json")
    json_save(model_defect_breakdown, DIR_PROCESSED / "model_defect_breakdown.json")
    json_save(defect_codes, DIR_PROCESSED / "defect_codes.json")

    elapsed = (datetime.now() - start_time).total_seconds()
    print(
        f"Done: {len(brand_stats)} brands, {len(model_stats)} models "
        f"in {elapsed:.0f}s | memory: {memory_mb():.0f} MB",
        flush=True,
    )


if __name__ == "__main__":
    main()
