"""
Statistics aggregation functions for brand and model data.

Computes reliability statistics using native Polars operations.
Per-year statistics replace fixed age brackets for fine-grained filtering.
"""

from datetime import datetime

import polars as pl

from config import (
    THRESHOLD_AGE_BRACKET,
    THRESHOLD_BRAND,
    THRESHOLD_BRAND_RANKING,
    THRESHOLD_MODEL,
    THRESHOLD_MODEL_RANKING,
)


def compute_per_year_stats(
    df: pl.DataFrame, group_cols: list[str]
) -> tuple[pl.DataFrame, int, int]:
    """Compute statistics for each age year using native Polars.

    Returns:
        Tuple of (per_year_df, min_age, max_age)
    """
    # Get min/max ages from the data
    min_age = int(df["age_at_inspection"].min())
    max_age = int(df["age_at_inspection"].max())

    # Group by (group_cols + age) and aggregate
    per_year_df = (
        df.group_by(group_cols + ["age_at_inspection"])
        .agg(
            [
                pl.col("kenteken").n_unique().alias("vehicle_count"),
                pl.len().alias("total_inspections"),
                pl.col("defect_count").sum().cast(pl.Float64).alias("total_defects"),
            ]
        )
        .filter(pl.col("vehicle_count") >= THRESHOLD_AGE_BRACKET)
        .with_columns(
            [
                (pl.col("total_defects") / pl.col("total_inspections"))
                .round(4)
                .alias("avg_defects_per_inspection"),
            ]
        )
        .sort(group_cols + ["age_at_inspection"])
    )

    return per_year_df, min_age, max_age


def _build_per_year_lookup(
    per_year_df: pl.DataFrame, group_cols: list[str]
) -> dict[str, dict[str, dict]]:
    """Build lookup dict from per-year stats DataFrame.

    Returns dict mapping group_key -> {age: stats_dict}
    """
    lookup: dict[str, dict[str, dict]] = {}

    for row in per_year_df.to_dicts():
        # Build group key
        if len(group_cols) == 1:
            group_key = row[group_cols[0]]
        else:
            group_key = "|".join(str(row[c]) for c in group_cols)

        age = str(int(row["age_at_inspection"]))
        stats = {
            "vehicle_count": row["vehicle_count"],
            "total_inspections": row["total_inspections"],
            "total_defects": row["total_defects"],
            "avg_defects_per_inspection": row["avg_defects_per_inspection"],
        }

        if group_key not in lookup:
            lookup[group_key] = {}
        lookup[group_key][age] = stats

    return lookup


def _add_per_year_stats_to_results(
    result: list[dict], lookup: dict[str, dict[str, dict]], group_cols: list[str]
) -> None:
    """Add per_year_stats to each result row from lookup."""
    for row in result:
        if len(group_cols) == 1:
            group_key = row[group_cols[0]]
        else:
            group_key = "|".join(str(row[c]) for c in group_cols)

        row["per_year_stats"] = lookup.get(group_key, {})


def aggregate_brand_stats(
    inspections_df: pl.DataFrame,
) -> tuple[list[dict], int, int]:
    """Aggregate statistics by brand with per-year stats using native Polars.

    Returns:
        Tuple of (brand_stats list, min_age, max_age)
    """
    # Main aggregation
    brand_df = (
        inspections_df.group_by(["merk", "vehicle_type_group", "primary_fuel"])
        .agg(
            [
                pl.col("kenteken").n_unique().alias("vehicle_count"),
                pl.len().alias("total_inspections"),
                pl.col("defect_count").sum().cast(pl.Float64).alias("total_defects"),
                pl.col("defect_count").std().fill_nan(None).round(4).alias("std_defects_per_inspection"),
                pl.col("age_at_inspection").mean().round(2).alias("avg_age_years"),
                pl.col("age_at_inspection").sum().cast(pl.Float64).alias("total_vehicle_years"),
                # Std dev of defects per vehicle year (defect_count / age)
                (pl.col("defect_count") / pl.col("age_at_inspection").clip(lower_bound=1)).std().fill_nan(None).round(4).alias("std_defects_per_vehicle_year"),
                # Sum and SumSq for frontend aggregation
                (pl.col("defect_count") / pl.col("age_at_inspection").clip(lower_bound=1)).sum().cast(pl.Float64).alias("sum_defects_per_vehicle_year_rates"),
                ((pl.col("defect_count") / pl.col("age_at_inspection").clip(lower_bound=1)) ** 2).sum().cast(pl.Float64).alias("sum_sq_defects_per_vehicle_year_rates"),
                # Sum Sq for defects per inspection (frontend aggregation)
                pl.col("defect_count").pow(2).sum().cast(pl.Float64).alias("sum_sq_defect_counts"),
                # Sum Catalog Price (frontend aggregation)
                pl.col("catalogusprijs").sum().cast(pl.Float64).alias("sum_catalog_price"),
                # Count records with price (frontend aggregation denominator)
                pl.col("catalogusprijs").filter(pl.col("catalogusprijs") > 0).count().alias("count_with_price"),
            ]
        )
        .filter(pl.col("vehicle_count") >= THRESHOLD_BRAND)
        .with_columns(
            [
                (pl.col("total_defects") / pl.col("total_inspections"))
                .round(4)
                .alias("avg_defects_per_inspection"),
                (pl.col("total_defects") / pl.col("total_vehicle_years"))
                .fill_nan(0.0)
                .fill_null(0.0)
                .pipe(lambda expr: pl.when(expr.is_infinite()).then(0.0).otherwise(expr))
                .round(6)
                .alias("defects_per_vehicle_year"),
                pl.col("total_vehicle_years").round(4),
            ]
        )
        .sort("defects_per_vehicle_year")
    )

    # Compute per-year stats using Polars group_by
    per_year_df, min_age, max_age = compute_per_year_stats(
        inspections_df, ["merk", "vehicle_type_group", "primary_fuel"]
    )

    # Convert main stats to list of dicts
    result = brand_df.to_dicts()

    # Build per-year lookup and add to results
    if len(per_year_df) > 0:
        per_year_lookup = _build_per_year_lookup(
            per_year_df, ["merk", "vehicle_type_group", "primary_fuel"]
        )
        _add_per_year_stats_to_results(
            result, per_year_lookup, ["merk", "vehicle_type_group", "primary_fuel"]
        )
    else:
        for row in result:
            row["per_year_stats"] = {}

    return result, min_age, max_age


def aggregate_model_stats(
    inspections_df: pl.DataFrame,
) -> tuple[list[dict], int, int]:
    """Aggregate statistics by brand + model with per-year stats using native Polars.

    Returns:
        Tuple of (model_stats list, min_age, max_age)
    """
    # Main aggregation
    model_df = (
        inspections_df.group_by(
            ["merk", "handelsbenaming", "vehicle_type_group", "primary_fuel"]
        )
        .agg(
            [
                pl.col("kenteken").n_unique().alias("vehicle_count"),
                pl.len().alias("total_inspections"),
                pl.col("defect_count").sum().cast(pl.Float64).alias("total_defects"),
                pl.col("defect_count").std().fill_nan(None).round(4).alias("std_defects_per_inspection"),
                pl.col("age_at_inspection").mean().round(2).alias("avg_age_years"),
                pl.col("age_at_inspection").sum().cast(pl.Float64).alias("total_vehicle_years"),
                # Std dev of defects per vehicle year (defect_count / age)
                (pl.col("defect_count") / pl.col("age_at_inspection").clip(lower_bound=1)).std().fill_nan(None).round(4).alias("std_defects_per_vehicle_year"),
                # Sum and SumSq for frontend aggregation
                (pl.col("defect_count") / pl.col("age_at_inspection").clip(lower_bound=1)).sum().cast(pl.Float64).alias("sum_defects_per_vehicle_year_rates"),
                ((pl.col("defect_count") / pl.col("age_at_inspection").clip(lower_bound=1)) ** 2).sum().cast(pl.Float64).alias("sum_sq_defects_per_vehicle_year_rates"),
                # Sum Sq for defects per inspection (frontend aggregation)
                pl.col("defect_count").pow(2).sum().cast(pl.Float64).alias("sum_sq_defect_counts"),
                # Sum Catalog Price (frontend aggregation)
                pl.col("catalogusprijs").sum().cast(pl.Float64).alias("sum_catalog_price"),
                # Count records with price (frontend aggregation denominator)
                pl.col("catalogusprijs").filter(pl.col("catalogusprijs") > 0).count().alias("count_with_price"),
            ]
        )
        .with_columns(
            pl.col("vehicle_count").sum().over(["merk", "handelsbenaming"]).alias("total_model_count")
        )
        .filter(pl.col("total_model_count") >= THRESHOLD_MODEL)
        .with_columns(
            [
                (pl.col("total_defects") / pl.col("total_inspections"))
                .round(4)
                .alias("avg_defects_per_inspection"),
                (pl.col("total_defects") / pl.col("total_vehicle_years"))
                .fill_nan(0.0)
                .fill_null(0.0)
                .pipe(lambda expr: pl.when(expr.is_infinite()).then(0.0).otherwise(expr))
                .round(6)
                .alias("defects_per_vehicle_year"),
                pl.col("total_vehicle_years").round(4),
            ]
        )
        .sort("defects_per_vehicle_year")
    )

    # Compute per-year stats using Polars group_by
    per_year_df, min_age, max_age = compute_per_year_stats(
        inspections_df,
        ["merk", "handelsbenaming", "vehicle_type_group", "primary_fuel"],
    )

    # Convert main stats to list of dicts
    result = model_df.to_dicts()

    # Build per-year lookup and add to results
    if len(per_year_df) > 0:
        per_year_lookup = _build_per_year_lookup(
            per_year_df,
            ["merk", "handelsbenaming", "vehicle_type_group", "primary_fuel"],
        )
        _add_per_year_stats_to_results(
            result,
            per_year_lookup,
            ["merk", "handelsbenaming", "vehicle_type_group", "primary_fuel"],
        )
    else:
        for row in result:
            row["per_year_stats"] = {}

    return result, min_age, max_age

def _aggregate_stats_for_ranking(stats_list: list[dict], group_keys: list[str]) -> list[dict]:
    """Aggregate stats list by group keys for ranking purposes.

    Combines segmented data (e.g. by fuel/price) into a single entry per group.
    """
    aggregated: dict[str, dict] = {}

    for item in stats_list:
        # Create unique key based on group columns
        key_parts = [str(item.get(k, "")) for k in group_keys]
        key = "|".join(key_parts)

        if key not in aggregated:
            aggregated[key] = {k: item.get(k, "") for k in group_keys}
            aggregated[key].update(
                {
                    "vehicle_count": 0,
                    "total_inspections": 0,
                    "total_defects": 0.0,
                    "total_vehicle_years": 0.0,
                }
            )

        # Accumulate metrics
        aggregated[key]["vehicle_count"] += item.get("vehicle_count", 0)
        aggregated[key]["total_inspections"] += item.get("total_inspections", 0)
        aggregated[key]["total_defects"] += item.get("total_defects", 0.0)
        aggregated[key]["total_vehicle_years"] += item.get("total_vehicle_years", 0.0)

    # Convert back to list and calculate derived metrics
    result = []
    for item in aggregated.values():
        total_vehicle_years = item["total_vehicle_years"]
        if total_vehicle_years > 0:
            item["defects_per_vehicle_year"] = (
                item["total_defects"] / total_vehicle_years
            )
        else:
            item["defects_per_vehicle_year"] = 0.0

        result.append(item)

    return result


def generate_rankings(brand_stats: list[dict], model_stats: list[dict]) -> dict:
    """Generate top/bottom rankings for brands and models."""

    def format_ranking(
        items: list[dict], threshold: int, limit: int = 10, reverse: bool = False
    ) -> list[dict]:
        # Filter by ranking threshold
        candidates = [
            item for item in items if item.get("vehicle_count", 0) >= threshold
        ]

        # Sort by defects_per_vehicle_year
        sorted_items = sorted(
            candidates,
            key=lambda x: x.get("defects_per_vehicle_year") or float("inf"),
            reverse=reverse,
        )[:limit]

        result = []
        for rank, item in enumerate(sorted_items, 1):
            entry = {
                "rank": rank,
                "merk": item.get("merk", ""),
                "defects_per_vehicle_year": round(
                    item.get("defects_per_vehicle_year") or 0, 6
                ),
                "total_inspections": item.get("total_inspections", 0),
            }
            if "handelsbenaming" in item:
                entry["handelsbenaming"] = item["handelsbenaming"]
            result.append(entry)
        return result

    # Filter for consumer vehicles only before aggregation
    consumer_brand_stats = [
        item for item in brand_stats if item.get("vehicle_type_group") == "consumer"
    ]
    consumer_model_stats = [
        item for item in model_stats if item.get("vehicle_type_group") == "consumer"
    ]

    # Aggregate stats to avoid duplicates from segmentation
    aggregated_brands = _aggregate_stats_for_ranking(consumer_brand_stats, ["merk"])
    aggregated_models = _aggregate_stats_for_ranking(
        consumer_model_stats, ["merk", "handelsbenaming"]
    )

    most_reliable_brands = format_ranking(
        aggregated_brands, threshold=THRESHOLD_BRAND_RANKING, reverse=False
    )
    least_reliable_brands = format_ranking(
        aggregated_brands, threshold=THRESHOLD_BRAND_RANKING, reverse=True
    )
    most_reliable_models = format_ranking(
        aggregated_models, threshold=THRESHOLD_MODEL_RANKING, reverse=False
    )
    least_reliable_models = format_ranking(
        aggregated_models, threshold=THRESHOLD_MODEL_RANKING, reverse=True
    )

    return {
        "most_reliable_brands": most_reliable_brands,
        "least_reliable_brands": least_reliable_brands,
        "most_reliable_models": most_reliable_models,
        "least_reliable_models": least_reliable_models,
        "generated_at": datetime.now().isoformat(),
    }
