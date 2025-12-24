"""
Defect data building functions.

Builds defect statistics, breakdowns, and code indexes for frontend consumption.
"""

from datetime import datetime

import polars as pl


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
