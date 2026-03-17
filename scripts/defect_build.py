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
    # 1. Convert inspections to LazyFrame
    insp_keys_lf = inspections_df.lazy().select(
        [
            "kenteken",
            "meld_datum_door_keuringsinstantie",
            "meld_tijd_door_keuringsinstantie",
            "merk",
            "handelsbenaming",
        ]
    )

    # 2. Join LAZILY
    defects_with_brand_lf = defects_lf.select(
        [
            "kenteken",
            "meld_datum_door_keuringsinstantie",
            "meld_tijd_door_keuringsinstantie",
            "gebrek_identificatie",
            pl.col("aantal_gebreken_geconstateerd").fill_null(1).cast(pl.Int64).alias("count"),
        ]
    ).join(
        insp_keys_lf,
        on=[
            "kenteken",
            "meld_datum_door_keuringsinstantie",
            "meld_tijd_door_keuringsinstantie",
        ],
        how="inner",
    )

    # 3. Optimized Aggregation using Structs + Collect All
    # Brand Breakdown
    brand_agg_lazy = (
        defects_with_brand_lf.group_by(["merk", "gebrek_identificatie"])
        .agg(pl.col("count").sum())
        .group_by("merk")
        .agg(pl.struct(["gebrek_identificatie", "count"]).alias("defects"))
    )

    # Model Breakdown
    model_agg_lazy = (
        defects_with_brand_lf.with_columns(
            (pl.col("merk") + "|" + pl.col("handelsbenaming")).alias("model_key")
        )
        .group_by(["model_key", "gebrek_identificatie"])
        .agg(pl.col("count").sum())
        .group_by("model_key")
        .agg(pl.struct(["gebrek_identificatie", "count"]).alias("defects"))
    )

    brand_breakdown_df, model_breakdown_df = pl.collect_all([brand_agg_lazy, model_agg_lazy])

    brand_defects: dict[str, dict[str, int]] = {}
    # Use iter_rows assuming column order: merk, defects
    for brand, defects_structs in brand_breakdown_df.iter_rows():
        brand_defects[brand] = {d["gebrek_identificatie"]: d["count"] for d in defects_structs}

    model_defects: dict[str, dict[str, int]] = {}
    # Use iter_rows assuming column order: model_key, defects
    for model_key, defects_structs in model_breakdown_df.iter_rows():
        model_defects[model_key] = {d["gebrek_identificatie"]: d["count"] for d in defects_structs}

    return brand_defects, model_defects


def build_defect_codes(gebreken_df: pl.DataFrame) -> dict[str, str]:
    """Build defect code index (code -> description) for frontend display."""
    df = gebreken_df.filter(
        pl.col("gebrek_identificatie").is_not_null() & (pl.col("gebrek_identificatie") != "")
    ).select(pl.col("gebrek_identificatie"), pl.col("gebrek_omschrijving").fill_null(""))
    return dict(zip(df.get_column("gebrek_identificatie"), df.get_column("gebrek_omschrijving")))
