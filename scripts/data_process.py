#!/usr/bin/env python3
"""
Stage 2: Data Processing Script

Reads Parquet data and computes reliability statistics using Polars.
Outputs processed data to data/processed/.

Uses Polars lazy API throughout to minimize memory usage.
"""

from collections.abc import Callable
from datetime import datetime

import psutil

from config import (
    DIR_PROCESSED,
    THRESHOLD_AGE_BRACKET,
    THRESHOLD_BRAND,
    THRESHOLD_MODEL,
)
from defect_build import build_defect_breakdowns, build_defect_codes, build_defect_stats
from fuel_build import build_fuel_breakdown
from inspection_prepare import json_save, load_dataset, scan_dataset
from inspection_stats import inspection_stats_build, metadata_stats_collect
from stats_aggregate import aggregate_brand_stats, aggregate_model_stats, generate_rankings


def memory_mb() -> float:
    """Get current process memory in MB."""
    return psutil.Process().memory_info().rss / (1024 * 1024)


def _add_fuel_and_track_ranges(
    stats_list: list[dict], fuel_dict: dict, key_extractor: Callable[[dict], str]
) -> tuple[int, int, int]:
    """Add fuel breakdown to stats and compute max fleet size, and min/max inspections."""
    max_fleet_size = 0
    min_inspections: int | float = float("inf") if stats_list else 0
    max_inspections = 0
    default_fuel = {"Benzine": 0, "Diesel": 0, "Elektriciteit": 0, "LPG": 0, "other": 0}

    for stat in stats_list:
        key = key_extractor(stat)
        stat["fuel_breakdown"] = fuel_dict.get(key, default_fuel)

        vc = stat["vehicle_count"]
        ti = stat["total_inspections"]
        if vc > max_fleet_size:
            max_fleet_size = vc
        if ti < min_inspections:
            min_inspections = ti
        if ti > max_inspections:
            max_inspections = ti

    if min_inspections == float("inf"):
        min_inspections = 0

    return max_fleet_size, int(min_inspections), max_inspections


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

    print("Building lazy inspection statistics plan...", flush=True)
    inspection_stats_lf = inspection_stats_build(
        inspections_lf, vehicles_lf, defects_lf, brandstof_lf
    )

    # Aggregate by brand and model (returns stats + age range)
    print("Aggregating brand and model statistics...", flush=True)
    brand_stats, min_age, max_age = aggregate_brand_stats(inspection_stats_lf)
    model_stats, _, _ = aggregate_model_stats(inspection_stats_lf)
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

    # Add fuel_breakdown and calculate ranges in single pass for efficiency
    max_fleet_size_brand, min_inspections_brand, max_inspections_brand = _add_fuel_and_track_ranges(
        brand_stats, brand_fuel, lambda stat: stat["merk"]
    )

    max_fleet_size_model, min_inspections_model, max_inspections_model = _add_fuel_and_track_ranges(
        model_stats, model_fuel, lambda stat: f"{stat['merk']}|{stat['handelsbenaming']}"
    )

    # Generate rankings
    rankings = generate_rankings(brand_stats, model_stats)

    print("Collecting metadata summaries...", flush=True)
    metadata_stats = metadata_stats_collect(inspection_stats_lf)
    total_inspections = metadata_stats["total_inspections"]
    total_defects = metadata_stats["total_defects"]
    total_vehicles = metadata_stats["total_vehicles"]

    # Calculate dynamic ranges for frontend filters
    max_price = int(metadata_stats["max_price"])
    max_fleet_size = max(max_fleet_size_brand, max_fleet_size_model)
    min_inspections = min(min_inspections_brand, min_inspections_model)
    max_inspections = max(max_inspections_brand, max_inspections_model)

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
        "fuel_types": metadata_stats["fuel_types"],
        "counts": {
            "brands": len(brand_stats),
            "models": len(model_stats),
            "vehicles_processed": total_vehicles,
            "total_inspections": total_inspections,
            "total_defects": total_defects,
            "consumer_vehicles": metadata_stats["consumer_vehicles"],
            "commercial_vehicles": metadata_stats["commercial_vehicles"],
        },
        "source": "RDW Open Data",
        "pipeline_stage": 2,
    }

    metadata["stats"] = {
        "zero_defect_rate": metadata_stats["zero_defect_rate"],
        "yearly_trend": metadata_stats["yearly_trend"],
        "fleet_age_stats": metadata_stats["fleet_age_stats"],
    }

    # Build defect stats
    print("Building defect statistics...", flush=True)
    defect_stats = build_defect_stats(defects_lf, gebreken_df, total_inspections)
    print(f"Defect stats: {len(defect_stats['top_defects'])} defect types", flush=True)

    # Build per-defect breakdowns for dynamic frontend filtering
    print("Building defect breakdowns...", flush=True)
    brand_defect_breakdown, model_defect_breakdown = build_defect_breakdowns(
        defects_lf, inspection_stats_lf
    )
    print(
        f"Defect breakdowns: {len(brand_defect_breakdown)} brands, "
        f"{len(model_defect_breakdown)} models | memory: {memory_mb():.0f} MB",
        flush=True,
    )

    # Build defect code index for frontend display
    defect_codes = build_defect_codes(gebreken_df)
    print(f"Defect codes: {len(defect_codes)} codes", flush=True)

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
