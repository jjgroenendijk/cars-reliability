"""
Shared calculation helpers for Stage 2 outputs.
"""

from datetime import datetime
from typing import Any

THRESHOLD_BRAND = 100
THRESHOLD_MODEL = 50
THRESHOLD_AGE_BRACKET = 30
AGE_BRACKETS = {"4_7": (4, 7), "8_12": (8, 12), "13_20": (13, 20), "5_15": (5, 15)}


def metrics_calculate(stats: dict[str, Any]) -> dict[str, Any]:
    """Calculate reliability metrics from aggregated statistics."""
    result = dict(stats)
    total_insp = stats.get("total_inspections", 0)
    total_def = stats.get("total_defects", 0)
    age_count = stats.get("age_count", 0)
    age_sum = stats.get("age_sum", 0)
    vehicle_years = stats.get("vehicle_years", 0.0)

    result["avg_defects_per_inspection"] = (
        round(total_def / total_insp, 4) if total_insp > 0 else None
    )
    result["avg_age_years"] = round(age_sum / age_count, 2) if age_count > 0 else None

    # Use vehicle-years normalization to avoid cadence bias
    result["defects_per_vehicle_year"] = (
        round(total_def / vehicle_years, 6) if vehicle_years > 0 else None
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
    del result["vehicle_years"]
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
    defects_per_vehicle_year = item.get("defects_per_vehicle_year")
    entry = {
        "rank": rank,
        "merk": item.get("merk", ""),
        "defects_per_vehicle_year": defects_per_vehicle_year if defects_per_vehicle_year is not None else 0,
        "total_inspections": item.get("total_inspections", 0),
    }
    if handelsbenaming := item.get("handelsbenaming"):
        entry["handelsbenaming"] = handelsbenaming
    return entry


def rankings_generate(
    brand_stats: list[dict[str, Any]], model_stats: list[dict[str, Any]]
) -> dict[str, Any]:
    """Generate reliability rankings sorted by defects_per_vehicle_year."""

    def sort_key(item: dict[str, Any], ascending: bool = True) -> tuple:
        d_vehicle_year = item.get("defects_per_vehicle_year")
        if d_vehicle_year is None:
            return (float("inf") if ascending else float("-inf"), 0)
        v_count = item.get("vehicle_count", 0)
        mult = 1 if ascending else -1
        return (mult * d_vehicle_year, -v_count)

    valid_brands = [b for b in brand_stats if b.get("defects_per_vehicle_year") is not None]
    valid_models = [m for m in model_stats if m.get("defects_per_vehicle_year") is not None]

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
