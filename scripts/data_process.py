#!/usr/bin/env python3
"""
Stage 2: Data Processing Script

Reads raw data from data/raw/ (JSON files from Stage 1) and computes
reliability statistics. Outputs processed data to data/processed/.
"""

import json
import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

THRESHOLD_BRAND = 100
THRESHOLD_MODEL = 50
THRESHOLD_AGE_BRACKET = 30
AGE_BRACKETS = {"4_7": (4, 7), "8_12": (8, 12), "13_20": (13, 20), "5_15": (5, 15)}
DIR_RAW = Path(__file__).parent.parent / "data" / "raw"
DIR_PROCESSED = Path(__file__).parent.parent / "data" / "processed"


def json_load(filepath: Path) -> list[dict[str, Any]]:
    """Load JSON data from a file."""
    logger.info("Loading %s", filepath)
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)
    logger.info("Loaded %d records from %s", len(data), filepath.name)
    return data


def json_save(data: Any, filepath: Path) -> None:
    """Save data to a JSON file."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info("Saved %s (%.2f KB)", filepath, filepath.stat().st_size / 1024)


def age_calculate(datum_eerste_toelating: str, reference_date: datetime) -> int | None:
    """Calculate vehicle age in years from first registration date (YYYYMMDD)."""
    if not datum_eerste_toelating or len(datum_eerste_toelating) < 8:
        return None
    try:
        year = int(datum_eerste_toelating[:4])
        month = int(datum_eerste_toelating[4:6])
        day = int(datum_eerste_toelating[6:8])
        age_years = (reference_date - datetime(year, month, day)).days // 365
        return age_years if 0 <= age_years <= 100 else None
    except (ValueError, TypeError):
        return None


def vehicles_index(vehicles: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Create an index of vehicles by kenteken (license plate)."""
    index = {v["kenteken"]: v for v in vehicles if v.get("kenteken")}
    logger.info("Indexed %d vehicles by kenteken", len(index))
    return index


def records_count_by_kenteken(records: list[dict[str, Any]]) -> dict[str, int]:
    """Count records per kenteken."""
    counts: dict[str, int] = defaultdict(int)
    for record in records:
        if kenteken := record.get("kenteken"):
            counts[kenteken] += 1
    return dict(counts)


def bracket_empty() -> dict[str, dict[str, int]]:
    """Create empty age bracket structure."""
    return {b: {"count": 0, "defects": 0, "inspections": 0} for b in AGE_BRACKETS}


def stats_aggregate(
    vehicle_index: dict[str, dict[str, Any]],
    inspection_counts: dict[str, int],
    defect_counts: dict[str, int],
    reference_date: datetime,
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Aggregate statistics by brand and model."""
    logger.info("Aggregating statistics by brand and model")

    def new_stats() -> dict[str, Any]:
        return {
            "vehicle_count": 0,
            "total_inspections": 0,
            "total_defects": 0,
            "age_sum": 0,
            "age_count": 0,
            "age_brackets": bracket_empty(),
        }

    brand_data: dict[str, dict[str, Any]] = defaultdict(new_stats)
    model_data: dict[str, dict[str, Any]] = defaultdict(new_stats)
    processed_count, skipped = 0, 0

    for kenteken, vehicle in vehicle_index.items():
        insp_count = inspection_counts.get(kenteken, 0)
        if insp_count == 0:
            skipped += 1
            continue

        def_count = defect_counts.get(kenteken, 0)
        merk = vehicle.get("merk", "").strip().upper()
        handelsbenaming = vehicle.get("handelsbenaming", "").strip().upper()
        if not merk:
            continue

        model_key = f"{merk}|{handelsbenaming}" if handelsbenaming else merk
        age = age_calculate(vehicle.get("datum_eerste_toelating", ""), reference_date)

        for data, key in [(brand_data, merk), (model_data, model_key)]:
            data[key]["vehicle_count"] += 1
            data[key]["total_inspections"] += insp_count
            data[key]["total_defects"] += def_count
            if age is not None:
                data[key]["age_sum"] += age
                data[key]["age_count"] += 1
                for bracket_name, (min_age, max_age) in AGE_BRACKETS.items():
                    if min_age <= age <= max_age:
                        data[key]["age_brackets"][bracket_name]["count"] += 1
                        data[key]["age_brackets"][bracket_name]["defects"] += def_count
                        data[key]["age_brackets"][bracket_name]["inspections"] += (
                            insp_count
                        )

        model_data[model_key]["merk"] = merk
        model_data[model_key]["handelsbenaming"] = handelsbenaming
        processed_count += 1

    logger.info(
        "Aggregated %d vehicles (%d skipped - no inspections)", processed_count, skipped
    )
    logger.info("Found %d brands, %d models", len(brand_data), len(model_data))
    return dict(brand_data), dict(model_data)


def metrics_calculate(stats: dict[str, Any]) -> dict[str, Any]:
    """Calculate reliability metrics from aggregated statistics."""
    result = dict(stats)
    total_insp = stats.get("total_inspections", 0)
    total_def = stats.get("total_defects", 0)
    age_count = stats.get("age_count", 0)
    age_sum = stats.get("age_sum", 0)

    result["avg_defects_per_inspection"] = (
        round(total_def / total_insp, 4) if total_insp > 0 else None
    )
    result["avg_age_years"] = round(age_sum / age_count, 2) if age_count > 0 else None

    avg_def = result["avg_defects_per_inspection"]
    avg_age = result["avg_age_years"]
    result["defects_per_year"] = (
        round(avg_def / avg_age, 6) if avg_def and avg_age and avg_age > 0 else None
    )

    age_brackets_result = {}
    for bracket_name, bracket_stats in stats.get("age_brackets", {}).items():
        b_count = bracket_stats.get("count", 0)
        b_insp = bracket_stats.get("inspections", 0)
        b_def = bracket_stats.get("defects", 0)
        if b_count >= THRESHOLD_AGE_BRACKET and b_insp > 0:
            age_brackets_result[bracket_name] = {
                "vehicle_count": b_count,
                "total_inspections": b_insp,
                "total_defects": b_def,
                "avg_defects_per_inspection": round(b_def / b_insp, 4),
            }
        else:
            age_brackets_result[bracket_name] = None
    result["age_brackets"] = age_brackets_result

    del result["age_sum"]
    del result["age_count"]
    return result


def stats_filter_brands(brand_data: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter and format brand statistics meeting threshold."""
    result = []
    for merk, stats in brand_data.items():
        if stats["vehicle_count"] >= THRESHOLD_BRAND:
            entry = metrics_calculate(stats)
            entry["merk"] = merk
            result.append(entry)
    logger.info(
        "Filtered brands: %d of %d meet threshold (%d)",
        len(result),
        len(brand_data),
        THRESHOLD_BRAND,
    )
    return result


def stats_filter_models(model_data: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter and format model statistics meeting threshold."""
    result = [
        metrics_calculate(stats)
        for stats in model_data.values()
        if stats["vehicle_count"] >= THRESHOLD_MODEL
    ]
    logger.info(
        "Filtered models: %d of %d meet threshold (%d)",
        len(result),
        len(model_data),
        THRESHOLD_MODEL,
    )
    return result


def rankings_generate(
    brand_stats: list[dict[str, Any]], model_stats: list[dict[str, Any]]
) -> dict[str, Any]:
    """Generate reliability rankings."""
    logger.info("Generating rankings")

    def sort_key(item: dict[str, Any], ascending: bool = True) -> tuple:
        avg_def = item.get("avg_defects_per_inspection")
        if avg_def is None:
            return (float("inf") if ascending else float("-inf"), 0, 0)
        v_count = item.get("vehicle_count", 0)
        d_year = item.get("defects_per_year") or (
            float("inf") if ascending else float("-inf")
        )
        mult = 1 if ascending else -1
        return (mult * avg_def, -v_count, mult * d_year)

    valid_brands = [
        b for b in brand_stats if b.get("avg_defects_per_inspection") is not None
    ]
    valid_models = [
        m for m in model_stats if m.get("avg_defects_per_inspection") is not None
    ]

    return {
        "top_10_brands_reliable": sorted(valid_brands, key=lambda x: sort_key(x, True))[
            :10
        ],
        "bottom_10_brands_reliable": sorted(
            valid_brands, key=lambda x: sort_key(x, False)
        )[:10],
        "top_10_models_reliable": sorted(valid_models, key=lambda x: sort_key(x, True))[
            :10
        ],
        "bottom_10_models_reliable": sorted(
            valid_models, key=lambda x: sort_key(x, False)
        )[:10],
    }


def metadata_create(
    brand_count: int,
    model_count: int,
    vehicle_count: int,
    inspection_count: int,
    defect_count: int,
) -> dict[str, Any]:
    """Create metadata about the processing run."""
    return {
        "generated_at": datetime.now().isoformat(),
        "thresholds": {
            "brand": THRESHOLD_BRAND,
            "model": THRESHOLD_MODEL,
            "age_bracket": THRESHOLD_AGE_BRACKET,
        },
        "age_brackets": AGE_BRACKETS,
        "counts": {
            "brands": brand_count,
            "models": model_count,
            "vehicles_processed": vehicle_count,
            "total_inspections": inspection_count,
            "total_defects": defect_count,
        },
        "source": "RDW Open Data",
        "pipeline_stage": 2,
    }


def main() -> None:
    """Main entry point for the data processing script."""
    logger.info("Starting data processing (Stage 2)")
    start_time = datetime.now()
    reference_date = datetime.now()

    try:
        vehicles = json_load(DIR_RAW / "gekentekende_voertuigen.json")
        inspections = json_load(DIR_RAW / "meldingen_keuringsinstantie.json")
        defects = json_load(DIR_RAW / "geconstateerde_gebreken.json")
    except FileNotFoundError as e:
        logger.error("Raw data file not found: %s", e)
        logger.error("Run Stage 1 (data_download.py) first")
        exit(1)

    vehicle_index = vehicles_index(vehicles)
    inspection_counts = records_count_by_kenteken(inspections)
    defect_counts = records_count_by_kenteken(defects)

    brand_data, model_data = stats_aggregate(
        vehicle_index, inspection_counts, defect_counts, reference_date
    )

    brand_stats = stats_filter_brands(brand_data)
    model_stats = stats_filter_models(model_data)

    brand_stats.sort(key=lambda x: x.get("avg_defects_per_inspection") or float("inf"))
    model_stats.sort(key=lambda x: x.get("avg_defects_per_inspection") or float("inf"))

    rankings = rankings_generate(brand_stats, model_stats)
    metadata = metadata_create(
        len(brand_stats),
        len(model_stats),
        len(vehicle_index),
        len(inspections),
        len(defects),
    )

    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)
    json_save(brand_stats, DIR_PROCESSED / "brand_stats.json")
    json_save(model_stats, DIR_PROCESSED / "model_stats.json")
    json_save(rankings, DIR_PROCESSED / "rankings.json")
    json_save(metadata, DIR_PROCESSED / "metadata.json")

    elapsed = (datetime.now() - start_time).total_seconds()
    logger.info("=" * 50)
    logger.info("Processing Summary")
    logger.info("=" * 50)
    logger.info("  Vehicles processed: %d", len(vehicle_index))
    logger.info("  Inspections: %d", len(inspections))
    logger.info("  Defects: %d", len(defects))
    logger.info("  Brands (above threshold): %d", len(brand_stats))
    logger.info("  Models (above threshold): %d", len(model_stats))
    logger.info("=" * 50)
    logger.info("Total processing time: %.1f seconds", elapsed)
    logger.info("Output saved to: %s", DIR_PROCESSED)


if __name__ == "__main__":
    main()
