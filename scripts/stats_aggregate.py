"""
Statistics aggregation functions for brand and model data.

Computes reliability statistics using native Polars operations.
"""

from datetime import datetime

import polars as pl

from config import AGE_BRACKETS, THRESHOLD_AGE_BRACKET, THRESHOLD_BRAND, THRESHOLD_MODEL


def add_age_bracket_column(df: pl.DataFrame) -> pl.DataFrame:
    """Add age_bracket column based on age_at_inspection."""
    return df.with_columns(
        pl.when((pl.col("age_at_inspection") >= 4) & (pl.col("age_at_inspection") <= 7))
        .then(pl.lit("4_7"))
        .when((pl.col("age_at_inspection") >= 8) & (pl.col("age_at_inspection") <= 12))
        .then(pl.lit("8_12"))
        .when((pl.col("age_at_inspection") >= 13) & (pl.col("age_at_inspection") <= 20))
        .then(pl.lit("13_20"))
        .when((pl.col("age_at_inspection") >= 5) & (pl.col("age_at_inspection") <= 15))
        .then(pl.lit("5_15"))
        .otherwise(pl.lit(None))
        .alias("age_bracket")
    )


def compute_bracket_stats_polars(
    df: pl.DataFrame, group_cols: list[str], bracket_name: str
) -> pl.DataFrame:
    """Compute stats for a single age bracket using native Polars."""
    min_age, max_age = AGE_BRACKETS[bracket_name]
    return (
        df.filter(
            (pl.col("age_at_inspection") >= min_age) & (pl.col("age_at_inspection") <= max_age)
        )
        .group_by(group_cols)
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
                pl.lit(bracket_name).alias("bracket_name"),
            ]
        )
    )


def _pivot_bracket_stats(bracket_dfs: list[pl.DataFrame], group_cols: list[str]) -> pl.DataFrame:
    """Pivot bracket statistics into struct columns per bracket."""
    all_brackets = pl.concat(bracket_dfs)
    return all_brackets.group_by(group_cols).agg(
        [
            pl.struct(
                [
                    pl.col("vehicle_count").filter(pl.col("bracket_name") == b).first(),
                    pl.col("total_inspections").filter(pl.col("bracket_name") == b).first(),
                    pl.col("total_defects").filter(pl.col("bracket_name") == b).first(),
                    pl.col("avg_defects_per_inspection")
                    .filter(pl.col("bracket_name") == b)
                    .first(),
                ]
            ).alias(b)
            for b in AGE_BRACKETS
        ]
    )


def _restructure_age_brackets(result: list[dict]) -> None:
    """Restructure bracket columns into nested age_brackets dict."""
    for row in result:
        if "4_7" not in row:
            for b in AGE_BRACKETS:
                row[b] = None
        # Restructure into age_brackets dict
        row["age_brackets"] = {b: row.pop(b, None) for b in AGE_BRACKETS}
        # Clean up None structs (Polars returns struct with all nulls)
        for b in AGE_BRACKETS:
            if row["age_brackets"][b] and row["age_brackets"][b].get("vehicle_count") is None:
                row["age_brackets"][b] = None


def aggregate_brand_stats(inspections_df: pl.DataFrame) -> list[dict]:
    """Aggregate statistics by brand with age brackets using native Polars."""
    # Main aggregation
    brand_df = (
        inspections_df.group_by("merk")
        .agg(
            [
                pl.col("kenteken").n_unique().alias("vehicle_count"),
                pl.len().alias("total_inspections"),
                pl.col("defect_count").sum().cast(pl.Float64).alias("total_defects"),
                pl.col("age_at_inspection").mean().round(2).alias("avg_age_years"),
                pl.col("age_at_inspection").sum().cast(pl.Float64).alias("total_vehicle_years"),
            ]
        )
        .filter(pl.col("vehicle_count") >= THRESHOLD_BRAND)
        .with_columns(
            [
                (pl.col("total_defects") / pl.col("total_inspections"))
                .round(4)
                .alias("avg_defects_per_inspection"),
                (pl.col("total_defects") / pl.col("total_vehicle_years"))
                .round(6)
                .alias("defects_per_vehicle_year"),
                pl.col("total_vehicle_years").round(4),
            ]
        )
        .sort("defects_per_vehicle_year")
    )

    # Compute age bracket stats for all brackets
    bracket_dfs = []
    for bracket_name in AGE_BRACKETS:
        bracket_df = compute_bracket_stats_polars(inspections_df, ["merk"], bracket_name)
        if len(bracket_df) > 0:
            bracket_dfs.append(bracket_df)

    # Pivot bracket stats and join
    if bracket_dfs:
        bracket_pivot = _pivot_bracket_stats(bracket_dfs, ["merk"])
        brand_df = brand_df.join(bracket_pivot, on="merk", how="left")

    # Convert to list of dicts
    result = brand_df.to_dicts()
    _restructure_age_brackets(result)
    return result


def aggregate_model_stats(inspections_df: pl.DataFrame) -> list[dict]:
    """Aggregate statistics by brand + model with age brackets using native Polars."""
    # Main aggregation
    model_df = (
        inspections_df.group_by(["merk", "handelsbenaming"])
        .agg(
            [
                pl.col("kenteken").n_unique().alias("vehicle_count"),
                pl.len().alias("total_inspections"),
                pl.col("defect_count").sum().cast(pl.Float64).alias("total_defects"),
                pl.col("age_at_inspection").mean().round(2).alias("avg_age_years"),
                pl.col("age_at_inspection").sum().cast(pl.Float64).alias("total_vehicle_years"),
            ]
        )
        .filter(pl.col("vehicle_count") >= THRESHOLD_MODEL)
        .with_columns(
            [
                (pl.col("total_defects") / pl.col("total_inspections"))
                .round(4)
                .alias("avg_defects_per_inspection"),
                (pl.col("total_defects") / pl.col("total_vehicle_years"))
                .round(6)
                .alias("defects_per_vehicle_year"),
                pl.col("total_vehicle_years").round(4),
            ]
        )
        .sort("defects_per_vehicle_year")
    )

    # Compute age bracket stats for all brackets
    bracket_dfs = []
    for bracket_name in AGE_BRACKETS:
        bracket_df = compute_bracket_stats_polars(
            inspections_df, ["merk", "handelsbenaming"], bracket_name
        )
        if len(bracket_df) > 0:
            bracket_dfs.append(bracket_df)

    # Pivot bracket stats and join
    if bracket_dfs:
        bracket_pivot = _pivot_bracket_stats(bracket_dfs, ["merk", "handelsbenaming"])
        model_df = model_df.join(bracket_pivot, on=["merk", "handelsbenaming"], how="left")

    # Convert to list of dicts
    result = model_df.to_dicts()
    _restructure_age_brackets(result)
    return result


def generate_rankings(brand_stats: list[dict], model_stats: list[dict]) -> dict:
    """Generate top/bottom rankings for brands and models."""

    def format_ranking(items: list[dict], limit: int = 10, reverse: bool = False) -> list[dict]:
        # Sort by defects_per_vehicle_year
        sorted_items = sorted(
            items,
            key=lambda x: x.get("defects_per_vehicle_year") or float("inf"),
            reverse=reverse,
        )[:limit]

        result = []
        for rank, item in enumerate(sorted_items, 1):
            entry = {
                "rank": rank,
                "merk": item.get("merk", ""),
                "defects_per_vehicle_year": round(item.get("defects_per_vehicle_year") or 0, 6),
                "total_inspections": item.get("total_inspections", 0),
            }
            if "handelsbenaming" in item:
                entry["handelsbenaming"] = item["handelsbenaming"]
            result.append(entry)
        return result

    most_reliable_brands = format_ranking(brand_stats, reverse=False)
    least_reliable_brands = format_ranking(brand_stats, reverse=True)
    most_reliable_models = format_ranking(model_stats, reverse=False)
    least_reliable_models = format_ranking(model_stats, reverse=True)

    return {
        "most_reliable_brands": most_reliable_brands,
        "least_reliable_brands": least_reliable_brands,
        "most_reliable_models": most_reliable_models,
        "least_reliable_models": least_reliable_models,
        "generated_at": datetime.now().isoformat(),
    }
