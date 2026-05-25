#!/usr/bin/env python3
"""
Stage 2: Data Processing Script

Reads Parquet data and computes reliability statistics using Polars.
Outputs processed data to data/processed/.

Uses Polars lazy API throughout to minimize memory usage.
"""

from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from time import monotonic

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
from inspection_stats import (
    inspection_stats_build,
    inspection_stats_persist,
    metadata_stats_collect,
)
from stats_aggregate import aggregate_brand_stats, aggregate_model_stats, generate_rankings


def memory_mb() -> float:
    """Get current process memory in MB."""
    return psutil.Process().memory_info().rss / (1024 * 1024)


def phase_start(name: str) -> float:
    """Log the start of an expensive processing phase."""
    print(f"Stage2 phase start: {name} | memory: {memory_mb():.0f} MB", flush=True)
    return monotonic()


def phase_done(name: str, started: float, detail: str = "") -> None:
    """Log the completion of an expensive processing phase."""
    suffix = f" | {detail}" if detail else ""
    elapsed = monotonic() - started
    print(
        f"Stage2 phase done: {name} in {elapsed:.0f}s | memory: {memory_mb():.0f} MB{suffix}",
        flush=True,
    )


def file_size_mb(path: Path) -> float:
    """Return a file size in MB."""
    return path.stat().st_size / (1024 * 1024)


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

    phase = phase_start("build inspection stats plan")
    inspection_stats_lf = inspection_stats_build(
        inspections_lf, vehicles_lf, defects_lf, brandstof_lf
    )
    phase_done("build inspection stats plan", phase)

    intermediate_path = DIR_PROCESSED / "_inspection_stats.parquet"
    phase = phase_start("write inspection stats checkpoint")
    inspection_stats_lf = inspection_stats_persist(inspection_stats_lf, intermediate_path)
    phase_done(
        "write inspection stats checkpoint",
        phase,
        f"{intermediate_path.name}={file_size_mb(intermediate_path):.0f} MB",
    )

    # Aggregate by brand and model (returns stats + age range)
    phase = phase_start("aggregate brand statistics")
    brand_stats, min_age, max_age = aggregate_brand_stats(inspection_stats_lf)
    phase_done("aggregate brand statistics", phase, f"brands={len(brand_stats)}")

    phase = phase_start("aggregate model statistics")
    model_stats, _, _ = aggregate_model_stats(inspection_stats_lf)
    phase_done("aggregate model statistics", phase, f"models={len(model_stats)}")
    print(f"Age range: {min_age}-{max_age}", flush=True)

    # Build fuel breakdowns
    phase = phase_start("build fuel breakdowns")
    brand_fuel, model_fuel = build_fuel_breakdown(brandstof_lf, vehicles_lf)
    phase_done(
        "build fuel breakdowns", phase, f"brands={len(brand_fuel)}, models={len(model_fuel)}"
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

    phase = phase_start("collect metadata summaries")
    metadata_stats = metadata_stats_collect(inspection_stats_lf)
    phase_done("collect metadata summaries", phase)
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
    phase = phase_start("build defect statistics")
    defect_stats = build_defect_stats(defects_lf, gebreken_df, total_inspections)
    phase_done("build defect statistics", phase, f"defect_types={len(defect_stats['top_defects'])}")

    # Build per-defect breakdowns for dynamic frontend filtering
    phase = phase_start("build defect breakdowns")
    brand_defect_breakdown, model_defect_breakdown = build_defect_breakdowns(
        defects_lf, inspection_stats_lf
    )
    phase_done(
        "build defect breakdowns",
        phase,
        f"brands={len(brand_defect_breakdown)}, models={len(model_defect_breakdown)}",
    )

    # Build defect code index for frontend display
    defect_codes = build_defect_codes(gebreken_df)
    print(f"Defect codes: {len(defect_codes)} codes", flush=True)

    # Save outputs - all are now dicts/lists after aggregation refactoring
    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)

    phase = phase_start("write processed JSON")
    json_save(brand_stats, DIR_PROCESSED / "brand_stats.json")
    json_save(model_stats, DIR_PROCESSED / "model_stats.json")

    # Use json_save for dicts (rankings, metadata, defect_stats, defect breakdowns)
    json_save(rankings, DIR_PROCESSED / "rankings.json")
    json_save(metadata, DIR_PROCESSED / "metadata.json")
    json_save(defect_stats, DIR_PROCESSED / "defect_stats.json")
    json_save(brand_defect_breakdown, DIR_PROCESSED / "brand_defect_breakdown.json")
    json_save(model_defect_breakdown, DIR_PROCESSED / "model_defect_breakdown.json")
    json_save(defect_codes, DIR_PROCESSED / "defect_codes.json")
    phase_done("write processed JSON", phase)

    if intermediate_path.exists():
        phase = phase_start("remove inspection stats checkpoint")
        intermediate_path.unlink()
        phase_done("remove inspection stats checkpoint", phase)

    elapsed = (datetime.now() - start_time).total_seconds()
    print(
        f"Done: {len(brand_stats)} brands, {len(model_stats)} models "
        f"in {elapsed:.0f}s | memory: {memory_mb():.0f} MB",
        flush=True,
    )


if __name__ == "__main__":
    main()
