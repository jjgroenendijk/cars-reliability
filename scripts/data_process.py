#!/usr/bin/env python3
"""
Stage 2: Data Processing Script

Reads raw data from data/raw/ (JSON files from Stage 1) and computes
reliability statistics. Outputs processed data to data/processed/.
"""

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

THRESHOLD_BRAND = 100
THRESHOLD_MODEL = 50
THRESHOLD_AGE_BRACKET = 30
AGE_BRACKETS = {"4_7": (4, 7), "8_12": (8, 12), "13_20": (13, 20), "5_15": (5, 15)}
DIR_RAW = Path(__file__).parent.parent / "data" / "raw"
DIR_PROCESSED = Path(__file__).parent.parent / "data" / "processed"


def json_load(filepath: Path) -> list[dict[str, Any]]:
    """Load JSON data from a file."""
    with open(filepath, encoding="utf-8") as f:
        return json.load(f)


def json_save(data: Any, filepath: Path) -> None:
    """Save data to a JSON file."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


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
    return {v["kenteken"]: v for v in vehicles if v.get("kenteken")}


def counts_from_aggregated(
    records: list[dict[str, Any]], count_field: str
) -> dict[str, int]:
    """Extract counts from pre-aggregated API response."""
    counts: dict[str, int] = {}
    for record in records:
        kenteken = record.get("kenteken")
        count = record.get(count_field)
        if kenteken and count is not None:
            counts[kenteken] = int(count)
    return counts


def bracket_empty() -> dict[str, dict[str, int]]:
    """Create empty age bracket structure."""
    return {b: {"count": 0, "defects": 0, "inspections": 0} for b in AGE_BRACKETS}


def fuel_index_create(fuel_data: list[dict[str, Any]]) -> dict[str, set[str]]:
    """Create an index of fuel types by kenteken (some vehicles have multiple fuels)."""
    fuel_index: dict[str, set[str]] = defaultdict(set)
    for record in fuel_data:
        kenteken = record.get("kenteken")
        fuel = record.get("brandstof_omschrijving")
        if kenteken and fuel:
            fuel_index[kenteken].add(fuel)
    return dict(fuel_index)


def fuel_breakdown_empty() -> dict[str, int]:
    """Create empty fuel breakdown structure with common fuel types."""
    return {
        "Benzine": 0,
        "Diesel": 0,
        "Elektriciteit": 0,
        "LPG": 0,
        "other": 0,
    }


MAIN_FUEL_TYPES = {"Benzine", "Diesel", "Elektriciteit", "LPG"}


def stats_aggregate(
    vehicle_index: dict[str, dict[str, Any]],
    inspection_counts: dict[str, int],
    defect_counts: dict[str, int],
    fuel_index: dict[str, set[str]],
    reference_date: datetime,
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Aggregate statistics by brand and model."""

    def new_stats() -> dict[str, Any]:
        return {
            "vehicle_count": 0,
            "total_inspections": 0,
            "total_defects": 0,
            "age_sum": 0,
            "age_count": 0,
            "age_brackets": bracket_empty(),
            "fuel_breakdown": fuel_breakdown_empty(),
        }

    brand_data: dict[str, dict[str, Any]] = defaultdict(new_stats)
    model_data: dict[str, dict[str, Any]] = defaultdict(new_stats)

    for kenteken, vehicle in vehicle_index.items():
        insp_count = inspection_counts.get(kenteken, 0)
        if insp_count == 0:
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

        # Track fuel types for this vehicle
        fuels = fuel_index.get(kenteken, set())
        for fuel in fuels:
            if fuel in MAIN_FUEL_TYPES:
                brand_data[merk]["fuel_breakdown"][fuel] += 1
                model_data[model_key]["fuel_breakdown"][fuel] += 1
            else:
                brand_data[merk]["fuel_breakdown"]["other"] += 1
                model_data[model_key]["fuel_breakdown"]["other"] += 1

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

    # Keep fuel_breakdown as-is (already has the structure we need)

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
    return result


def stats_filter_models(model_data: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter and format model statistics meeting threshold."""
    return [
        metrics_calculate(stats)
        for stats in model_data.values()
        if stats["vehicle_count"] >= THRESHOLD_MODEL
    ]


def ranking_entry_format(item: dict[str, Any], rank: int) -> dict[str, Any]:
    """Format a stats item as a ranking entry for the website."""
    entry = {
        "rank": rank,
        "merk": item.get("merk", ""),
        "defects_per_year": item.get("defects_per_year", 0),
        "total_inspections": item.get("total_inspections", 0),
    }
    if handelsbenaming := item.get("handelsbenaming"):
        entry["handelsbenaming"] = handelsbenaming
    return entry


def rankings_generate(
    brand_stats: list[dict[str, Any]], model_stats: list[dict[str, Any]]
) -> dict[str, Any]:
    """Generate reliability rankings sorted by defects_per_year."""

    def sort_key(item: dict[str, Any], ascending: bool = True) -> tuple:
        d_year = item.get("defects_per_year")
        if d_year is None:
            return (float("inf") if ascending else float("-inf"), 0)
        v_count = item.get("vehicle_count", 0)
        mult = 1 if ascending else -1
        return (mult * d_year, -v_count)

    valid_brands = [b for b in brand_stats if b.get("defects_per_year") is not None]
    valid_models = [m for m in model_stats if m.get("defects_per_year") is not None]

    top_brands = sorted(valid_brands, key=lambda x: sort_key(x, True))[:10]
    bottom_brands = sorted(valid_brands, key=lambda x: sort_key(x, False))[:10]
    top_models = sorted(valid_models, key=lambda x: sort_key(x, True))[:10]
    bottom_models = sorted(valid_models, key=lambda x: sort_key(x, False))[:10]

    return {
        "most_reliable_brands": [
            ranking_entry_format(b, i + 1) for i, b in enumerate(top_brands)
        ],
        "least_reliable_brands": [
            ranking_entry_format(b, i + 1) for i, b in enumerate(bottom_brands)
        ],
        "most_reliable_models": [
            ranking_entry_format(m, i + 1) for i, m in enumerate(top_models)
        ],
        "least_reliable_models": [
            ranking_entry_format(m, i + 1) for i, m in enumerate(bottom_models)
        ],
        "generated_at": datetime.now().isoformat(),
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
    print("Stage2: Processing", flush=True)
    start_time = datetime.now()
    reference_date = datetime.now()

    try:
        vehicles = json_load(DIR_RAW / "gekentekende_voertuigen.json")
        inspections_agg = json_load(DIR_RAW / "meldingen_keuringsinstantie.json")
        defects_agg = json_load(DIR_RAW / "geconstateerde_gebreken.json")
        fuel_data = json_load(DIR_RAW / "brandstof.json")
    except FileNotFoundError as e:
        print(f"FAIL: {e}", flush=True)
        exit(1)

    print(f"Loaded {len(vehicles) // 1000}k vehicles", flush=True)

    vehicle_index = vehicles_index(vehicles)
    inspection_counts = counts_from_aggregated(inspections_agg, "inspection_count")
    defect_counts = counts_from_aggregated(defects_agg, "defect_count")
    fuel_index = fuel_index_create(fuel_data)

    total_inspections = sum(inspection_counts.values())
    total_defects = sum(defect_counts.values())

    brand_data, model_data = stats_aggregate(
        vehicle_index, inspection_counts, defect_counts, fuel_index, reference_date
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
        total_inspections,
        total_defects,
    )

    DIR_PROCESSED.mkdir(parents=True, exist_ok=True)
    json_save(brand_stats, DIR_PROCESSED / "brand_stats.json")
    json_save(model_stats, DIR_PROCESSED / "model_stats.json")
    json_save(rankings, DIR_PROCESSED / "rankings.json")
    json_save(metadata, DIR_PROCESSED / "metadata.json")

    elapsed = (datetime.now() - start_time).total_seconds()
    print(
        f"Done: {len(brand_stats)} brands, {len(model_stats)} models in {elapsed:.0f}s",
        flush=True,
    )


if __name__ == "__main__":
    main()
