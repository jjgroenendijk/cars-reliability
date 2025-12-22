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
    import math

    result = dict(stats)
    total_insp = stats.get("total_inspections", 0)
    total_def = stats.get("total_defects", 0)
    age_count = stats.get("age_count", 0)
    age_sum = stats.get("age_sum", 0)
    vehicle_years = stats.get("vehicle_years", 0.0)
    vehicle_count = stats.get("vehicle_count", 0)

    # Mean defects per inspection
    mean_per_insp = total_def / total_insp if total_insp > 0 else None
    result["avg_defects_per_inspection"] = round(mean_per_insp, 4) if mean_per_insp else None

    result["avg_age_years"] = round(age_sum / age_count, 2) if age_count > 0 else None

    # Mean defects per vehicle-year (all defects)
    mean_per_year = total_def / vehicle_years if vehicle_years > 0 else None
    result["defects_per_vehicle_year"] = round(mean_per_year, 6) if mean_per_year else None

    # Mean reliability defects per vehicle-year (excluding wear-and-tear)
    total_rel_def = stats.get("total_reliability_defects", total_def)
    rel_mean_per_year = total_rel_def / vehicle_years if vehicle_years > 0 else None
    result["reliability_defects_per_vehicle_year"] = (
        round(rel_mean_per_year, 6) if rel_mean_per_year else None
    )

    # Standard deviation calculations
    # Using: variance = (sum of squares / n) - mean^2
    if vehicle_count > 1:
        # Std dev for defects per inspection (per vehicle)
        sq_sum_insp = stats.get("defects_per_insp_sq_sum", 0.0)
        mean_insp_per_vehicle = (
            total_def / vehicle_count / (total_insp / vehicle_count) if total_insp > 0 else 0
        )
        # Actually use per-vehicle rate: each vehicle has its own defects/inspections
        variance_insp = (
            max(0, sq_sum_insp / vehicle_count - (total_def / total_insp) ** 2)
            if total_insp > 0
            else 0
        )
        result["std_defects_per_inspection"] = round(math.sqrt(variance_insp), 4)

        # Std dev for defects per year (per vehicle)
        sq_sum_year = stats.get("defects_per_year_sq_sum", 0.0)
        mean_year_rate = total_def / vehicle_years if vehicle_years > 0 else 0
        variance_year = max(0, sq_sum_year / vehicle_count - mean_year_rate**2)
        result["std_defects_per_vehicle_year"] = round(math.sqrt(variance_year), 6)
    else:
        result["std_defects_per_inspection"] = None
        result["std_defects_per_vehicle_year"] = None

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

    # Clean up internal fields but keep vehicle_years for frontend calculations
    del result["age_sum"]
    del result["age_count"]
    result["total_vehicle_years"] = round(vehicle_years, 4)  # Keep for client-side recalculation
    del result["vehicle_years"]
    result.pop("defects_per_insp_sq_sum", None)
    result.pop("defects_per_year_sq_sum", None)
    result.pop("reliability_defects_per_year_sq_sum", None)
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
        "defects_per_vehicle_year": defects_per_vehicle_year
        if defects_per_vehicle_year is not None
        else 0,
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
        "most_reliable_brands": [ranking_entry_format(b, i + 1) for i, b in enumerate(top_brands)],
        "least_reliable_brands": [
            ranking_entry_format(b, i + 1) for i, b in enumerate(bottom_brands)
        ],
        "most_reliable_models": [ranking_entry_format(m, i + 1) for i, m in enumerate(top_models)],
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


def defect_type_stats_build(
    defect_records: list[dict[str, Any]],
    gebreken_index: dict[str, dict[str, Any]],
    total_inspections: int,
) -> dict[str, Any]:
    """Build defect type statistics with counts.

    Args:
        defect_records: Raw defect records from geconstateerde_gebreken
        gebreken_index: Index of defect descriptions by gebrek_identificatie
        total_inspections: Total number of inspections for rate calculation

    Returns:
        Dictionary with defect statistics including top defects
    """
    from collections import defaultdict

    # Count defects by type
    defect_counts: dict[str, int] = defaultdict(int)
    total_defect_count = 0

    for record in defect_records:
        gebrek_id = record.get("gebrek_identificatie", "").strip()
        if not gebrek_id:
            continue

        raw_count = record.get("aantal_gebreken_geconstateerd", 1)
        try:
            count = max(int(raw_count), 1)
        except (TypeError, ValueError):
            count = 1

        defect_counts[gebrek_id] += count
        total_defect_count += count

    # Build top defects list with descriptions
    top_defects: list[dict[str, Any]] = []
    sorted_defects = sorted(defect_counts.items(), key=lambda x: -x[1])

    for defect_code, count in sorted_defects[:50]:
        gebrek_info = gebreken_index.get(defect_code, {})
        description = gebrek_info.get("gebrek_omschrijving", "Onbekend gebrek")
        percentage = round((count / total_defect_count) * 100, 2) if total_defect_count > 0 else 0

        # Import here to avoid circular imports
        from defect_categories import categorize_defect, is_reliability_defect

        top_defects.append(
            {
                "defect_code": defect_code,
                "defect_description": description,
                "count": count,
                "percentage": percentage,
                "is_reliability": is_reliability_defect(defect_code, gebreken_index),
                "category": categorize_defect(defect_code, gebreken_index),
            }
        )

    # Calculate average defects per inspection
    avg_defects = round(total_defect_count / total_inspections, 2) if total_inspections > 0 else 0

    return {
        "total_defects": total_defect_count,
        "total_inspections": total_inspections,
        "avg_defects_per_inspection": avg_defects,
        "top_defects": top_defects,
        "generated_at": datetime.now().isoformat(),
    }
