"""
Lazy inspection statistics plan builders for Stage 2.

The functions here intentionally return LazyFrames or small collected metadata.
They must not materialize the full inspection-level dataset.
"""

from pathlib import Path
from typing import Any

import polars as pl

from inspection_prepare import primary_inspections_filter


def _determine_primary_fuel(brandstof_lf: pl.LazyFrame) -> pl.LazyFrame:
    """Determine a single primary fuel category per license plate."""
    fuel_indicators = brandstof_lf.group_by("kenteken").agg(
        [
            (pl.col("brandstof_omschrijving") == "Elektriciteit").any().alias("has_electric"),
            (pl.col("brandstof_omschrijving") == "Benzine").any().alias("has_benzine"),
            (pl.col("brandstof_omschrijving") == "Diesel").any().alias("has_diesel"),
            (pl.col("brandstof_omschrijving") == "LPG").any().alias("has_lpg"),
        ]
    )

    return fuel_indicators.select(
        [
            "kenteken",
            pl.when(pl.col("has_lpg"))
            .then(pl.lit("LPG"))
            .when(pl.col("has_electric") & (pl.col("has_benzine") | pl.col("has_diesel")))
            .then(pl.lit("Hybrid"))
            .when(pl.col("has_electric"))
            .then(pl.lit("Elektriciteit"))
            .when(pl.col("has_diesel"))
            .then(pl.lit("Diesel"))
            .when(pl.col("has_benzine"))
            .then(pl.lit("Benzine"))
            .otherwise(pl.lit("Other"))
            .alias("primary_fuel"),
        ]
    )


def inspection_stats_build(
    inspections_lf: pl.LazyFrame,
    vehicles_lf: pl.LazyFrame,
    defects_lf: pl.LazyFrame,
    brandstof_lf: pl.LazyFrame,
) -> pl.LazyFrame:
    """Build the lazy inspection-level stats plan used by Stage 2 outputs."""
    primary_inspections = primary_inspections_filter(inspections_lf)
    fuel_types = _determine_primary_fuel(brandstof_lf)

    vehicle_columns = vehicles_lf.select(
        [
            "kenteken",
            pl.col("merk").str.to_uppercase().str.strip_chars().alias("merk"),
            pl.col("handelsbenaming").str.to_uppercase().str.strip_chars().alias("handelsbenaming"),
            "datum_eerste_toelating",
            pl.col("catalogusprijs").cast(pl.Float64).fill_null(0).alias("catalogusprijs"),
            pl.when(pl.col("voertuigsoort") == "Personenauto")
            .then(pl.lit("consumer"))
            .when(pl.col("voertuigsoort") == "Bedrijfsauto")
            .then(pl.lit("commercial"))
            .otherwise(pl.lit("other"))
            .alias("vehicle_type_group"),
        ]
    ).filter(pl.col("vehicle_type_group").is_in(["consumer", "commercial"]))

    inspections_with_age = (
        primary_inspections.join(vehicle_columns, on="kenteken", how="inner")
        .join(fuel_types, on="kenteken", how="left")
        .with_columns(
            [
                pl.col("primary_fuel").fill_null("Other"),
                pl.col("meld_datum_door_keuringsinstantie")
                .str.slice(0, 4)
                .cast(pl.Int32)
                .alias("insp_year"),
                pl.col("datum_eerste_toelating").str.slice(0, 4).cast(pl.Int32).alias("reg_year"),
            ]
        )
        .with_columns((pl.col("insp_year") - pl.col("reg_year")).alias("age_at_inspection"))
        .filter((pl.col("age_at_inspection") >= 0) & (pl.col("age_at_inspection") <= 100))
    )

    defect_counts = defects_lf.group_by(
        ["kenteken", "meld_datum_door_keuringsinstantie", "meld_tijd_door_keuringsinstantie"]
    ).agg(
        pl.col("aantal_gebreken_geconstateerd")
        .fill_null(1)
        .cast(pl.Int64)
        .sum()
        .alias("defect_count")
    )

    return inspections_with_age.join(
        defect_counts,
        on=["kenteken", "meld_datum_door_keuringsinstantie", "meld_tijd_door_keuringsinstantie"],
        how="left",
    ).with_columns(pl.col("defect_count").fill_null(0))


def inspection_stats_persist(inspections_lf: pl.LazyFrame, output_path: Path) -> pl.LazyFrame:
    """Persist the expensive inspection stats plan and return a lazy scan of it."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    inspections_lf.sink_parquet(
        output_path,
        compression="zstd",
        maintain_order=False,
        engine="streaming",
    )
    return pl.scan_parquet(output_path)


def metadata_stats_collect(inspections_lf: pl.LazyFrame) -> dict[str, Any]:
    """Collect small metadata summaries from the lazy inspection stats plan."""
    summary_lf = inspections_lf.select(
        [
            pl.len().alias("total_inspections"),
            pl.col("defect_count").sum().cast(pl.Int64).alias("total_defects"),
            pl.col("kenteken").n_unique().alias("total_vehicles"),
            pl.col("catalogusprijs").max().cast(pl.Int64).alias("max_price"),
            (pl.col("defect_count") == 0).sum().alias("zero_defect_inspections"),
            pl.col("kenteken")
            .filter(pl.col("vehicle_type_group") == "consumer")
            .n_unique()
            .alias("consumer_vehicles"),
            pl.col("kenteken")
            .filter(pl.col("vehicle_type_group") == "commercial")
            .n_unique()
            .alias("commercial_vehicles"),
        ]
    )

    fuel_types_lf = inspections_lf.select("primary_fuel").unique().sort("primary_fuel")

    yearly_trend_lf = (
        inspections_lf.group_by("insp_year")
        .agg(
            [
                pl.len().alias("inspections"),
                pl.col("defect_count").sum().alias("total_defects"),
            ]
        )
        .with_columns(
            (pl.col("total_defects") / pl.col("inspections"))
            .round(4)
            .alias("avg_defects_per_inspection")
        )
        .filter(pl.col("inspections") >= 10_000)
        .sort("insp_year")
    )

    fleet_age_lf = (
        inspections_lf.group_by("age_at_inspection")
        .agg(
            [
                pl.len().alias("total_inspections"),
                pl.col("defect_count").sum().alias("total_defects"),
                pl.col("kenteken").n_unique().alias("vehicle_count"),
            ]
        )
        .with_columns(
            (pl.col("total_defects") / pl.col("total_inspections"))
            .round(4)
            .alias("avg_defects_per_inspection")
        )
        .filter(
            (pl.col("vehicle_count") >= 100)
            & (pl.col("age_at_inspection") >= 1)
            & (pl.col("age_at_inspection") <= 30)
        )
        .sort("age_at_inspection")
    )

    summary_df, fuel_types_df, yearly_trend_df, fleet_age_df = pl.collect_all(
        [summary_lf, fuel_types_lf, yearly_trend_lf, fleet_age_lf],
        engine="streaming",
    )
    summary = summary_df.to_dicts()[0]
    total_inspections = summary["total_inspections"]

    return {
        **summary,
        "max_price": summary["max_price"] or 0,
        "zero_defect_rate": round(summary["zero_defect_inspections"] / total_inspections, 4)
        if total_inspections > 0
        else 0.0,
        "fuel_types": fuel_types_df["primary_fuel"].to_list(),
        "yearly_trend": yearly_trend_df.to_dicts(),
        "fleet_age_stats": fleet_age_df.to_dicts(),
    }
