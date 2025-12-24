#!/usr/bin/env python3
"""
Stage 2: Data Processing Script

Reads Parquet data and computes reliability statistics using Polars.
Outputs processed data to data/processed/.

Uses Polars lazy API throughout to minimize memory usage.
"""

import gc
from datetime import datetime
from pathlib import Path

import polars as pl
import psutil

from config import AGE_BRACKETS, THRESHOLD_AGE_BRACKET, THRESHOLD_BRAND, THRESHOLD_MODEL
from inspection_prepare import (
    json_save,
    load_dataset,
    primary_inspections_filter,
    scan_dataset,
)

DIR_PROCESSED = Path(__file__).parent.parent / "data" / "processed"


def memory_mb() -> float:
    """Get current process memory in MB."""
    return psutil.Process().memory_info().rss / (1024 * 1024)


def compute_inspection_stats(
    inspections_lf: pl.LazyFrame,
    vehicles_lf: pl.LazyFrame,
    defects_lf: pl.LazyFrame,
) -> pl.DataFrame:
    """Compute per-vehicle inspection statistics using Polars operations.

    This replaces the Python dict-based vehicle_summaries_build.
    """
    # Filter to primary inspections only
    primary_inspections = primary_inspections_filter(inspections_lf)

    # Join with vehicle data to get brand/model info
    inspections_with_vehicles = primary_inspections.join(
        vehicles_lf.select(
            [
                "kenteken",
                pl.col("merk").str.to_uppercase().str.strip_chars().alias("merk"),
                pl.col("handelsbenaming")
                .str.to_uppercase()
                .str.strip_chars()
                .alias("handelsbenaming"),
                "datum_eerste_toelating",
            ]
        ),
        on="kenteken",
        how="inner",
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

    # Pivot bracket stats to have one row per brand with all bracket columns
    if bracket_dfs:
        all_brackets = pl.concat(bracket_dfs)
        # Create struct columns for each bracket
        bracket_pivot = all_brackets.group_by("merk").agg(
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
        # Join bracket stats to main stats
        brand_df = brand_df.join(bracket_pivot, on="merk", how="left")

    # Convert to list of dicts - Polars handles struct -> dict conversion natively
    result = brand_df.to_dicts()

    # Ensure age_brackets structure exists for all brands
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

    # Pivot bracket stats to have one row per model with all bracket columns
    if bracket_dfs:
        all_brackets = pl.concat(bracket_dfs)
        # Create struct columns for each bracket
        bracket_pivot = all_brackets.group_by(["merk", "handelsbenaming"]).agg(
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
        # Join bracket stats to main stats
        model_df = model_df.join(bracket_pivot, on=["merk", "handelsbenaming"], how="left")

    # Convert to list of dicts - Polars handles struct -> dict conversion natively
    result = model_df.to_dicts()

    # Ensure age_brackets structure exists for all models
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


def build_defect_stats(
    defects_lf: pl.LazyFrame, gebreken_df: pl.DataFrame, total_inspections: int
) -> dict:
    """Build defect type statistics."""
    # Count defects by type
    defect_counts = (
        defects_lf.group_by("gebrek_identificatie")
        .agg(
            [
                pl.col("aantal_gebreken_geconstateerd")
                .fill_null(1)
                .cast(pl.Int64)
                .sum()
                .alias("count"),
            ]
        )
        .sort("count", descending=True)
        .head(50)
        .collect()
    )

    # Calculate total defects for percentage calculation
    total_defects = defect_counts["count"].sum()

    # Join with descriptions and compute all fields using Polars
    top_defects = (
        defect_counts.join(
            gebreken_df.select(["gebrek_identificatie", "gebrek_omschrijving"]),
            on="gebrek_identificatie",
            how="left",
        )
        .with_columns(
            [
                (pl.col("count") / total_defects * 100).round(2).alias("percentage"),
                pl.col("gebrek_omschrijving")
                .fill_null("Onbekend gebrek")
                .alias("defect_description"),
            ]
        )
        .rename({"gebrek_identificatie": "defect_code"})
        .select(["defect_code", "defect_description", "count", "percentage"])
        .to_dicts()
    )

    return {
        "total_defects": total_defects,
        "total_inspections": total_inspections,
        "avg_defects_per_inspection": round(total_defects / total_inspections, 2)
        if total_inspections > 0
        else 0,
        "top_defects": top_defects,
        "generated_at": datetime.now().isoformat(),
    }


def build_defect_breakdowns(
    defects_lf: pl.LazyFrame,
    inspections_df: pl.DataFrame,
) -> tuple[dict[str, dict[str, int]], dict[str, dict[str, int]]]:
    """Build per-defect-code counts for each brand and model.

    This enables the frontend to dynamically recalculate reliability
    metrics when users toggle which defects count as reliability indicators.

    Returns:
        Tuple of (brand_defects, model_defects) where each is a dict mapping
        brand/model name to a dict of defect_code -> count
    """
    # Get unique inspection keys with brand/model info from inspections_df
    insp_keys = inspections_df.select(
        [
            "kenteken",
            "meld_datum_door_keuringsinstantie",
            "meld_tijd_door_keuringsinstantie",
            "merk",
            "handelsbenaming",
        ]
    )

    # Join defects with inspections to get brand/model info
    defects_with_brand = (
        defects_lf.select(
            [
                "kenteken",
                "meld_datum_door_keuringsinstantie",
                "meld_tijd_door_keuringsinstantie",
                "gebrek_identificatie",
                pl.col("aantal_gebreken_geconstateerd").fill_null(1).cast(pl.Int64).alias("count"),
            ]
        )
        .collect()
        .join(
            insp_keys,
            on=[
                "kenteken",
                "meld_datum_door_keuringsinstantie",
                "meld_tijd_door_keuringsinstantie",
            ],
            how="inner",
        )
    )

    # Aggregate by brand and defect code
    brand_breakdown = (
        defects_with_brand.group_by(["merk", "gebrek_identificatie"])
        .agg(pl.col("count").sum())
        .to_dicts()
    )

    # Aggregate by model (merk|handelsbenaming) and defect code
    model_breakdown = (
        defects_with_brand.with_columns(
            (pl.col("merk") + "|" + pl.col("handelsbenaming")).alias("model_key")
        )
        .group_by(["model_key", "gebrek_identificatie"])
        .agg(pl.col("count").sum())
        .to_dicts()
    )

    # Convert to nested dict format: {brand: {defect_code: count}}
    brand_defects: dict[str, dict[str, int]] = {}
    for row in brand_breakdown:
        brand = row["merk"]
        code = row["gebrek_identificatie"]
        count = row["count"]
        if brand not in brand_defects:
            brand_defects[brand] = {}
        brand_defects[brand][code] = count

    model_defects: dict[str, dict[str, int]] = {}
    for row in model_breakdown:
        model = row["model_key"]
        code = row["gebrek_identificatie"]
        count = row["count"]
        if model not in model_defects:
            model_defects[model] = {}
        model_defects[model][code] = count

    return brand_defects, model_defects


def build_defect_codes(gebreken_df: pl.DataFrame) -> dict[str, str]:
    """Build defect code index (code -> description) for frontend display."""
    result = {}
    for row in gebreken_df.select(["gebrek_identificatie", "gebrek_omschrijving"]).to_dicts():
        code = row["gebrek_identificatie"]
        desc = row["gebrek_omschrijving"] or ""
        if code:
            result[code] = desc
    return result


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
    print(f"Scanning datasets lazily | memory: {memory_mb():.0f} MB", flush=True)

    # Compute inspection statistics (this is the main work)
    print("Computing inspection statistics...", flush=True)
    inspections_df = compute_inspection_stats(inspections_lf, vehicles_lf, defects_lf)
    print(
        f"Computed stats ({len(inspections_df):,} inspections) | memory: {memory_mb():.0f} MB",
        flush=True,
    )

    # Aggregate by brand and model
    brand_stats = aggregate_brand_stats(inspections_df)
    model_stats = aggregate_model_stats(inspections_df)
    print(
        f"Aggregated: {len(brand_stats)} brands, {len(model_stats)} models | memory: {memory_mb():.0f} MB",
        flush=True,
    )

    # Generate rankings
    rankings = generate_rankings(brand_stats, model_stats)

    # Calculate totals
    total_inspections = len(inspections_df)
    total_defects = int(inspections_df["defect_count"].sum())
    total_vehicles = inspections_df["kenteken"].n_unique()

    # Build metadata
    metadata = {
        "generated_at": datetime.now().isoformat(),
        "thresholds": {
            "brand": THRESHOLD_BRAND,
            "model": THRESHOLD_MODEL,
            "age_bracket": THRESHOLD_AGE_BRACKET,
        },
        "age_brackets": AGE_BRACKETS,
        "counts": {
            "brands": len(brand_stats),
            "models": len(model_stats),
            "vehicles_processed": total_vehicles,
            "total_inspections": total_inspections,
            "total_defects": total_defects,
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
        f"Done: {len(brand_stats)} brands, {len(model_stats)} models in {elapsed:.0f}s | memory: {memory_mb():.0f} MB",
        flush=True,
    )


if __name__ == "__main__":
    main()
