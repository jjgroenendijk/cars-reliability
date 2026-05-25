"""
Lazy inspection statistics plan builders for Stage 2.

The functions here intentionally return LazyFrames or small collected metadata.
They must not materialize the full inspection-level dataset.
"""

from pathlib import Path
from typing import Any

import polars as pl

from system_utils import path_remove


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


def _normalized_time() -> pl.Expr:
    """Return a normalized RDW inspection time expression."""
    return (
        pl.col("meld_tijd_door_keuringsinstantie")
        .fill_null("")
        .str.strip_chars()
        .str.zfill(4)
        .alias("meld_tijd_door_keuringsinstantie")
    )


def _kenteken_prefix() -> pl.Expr:
    """Return the partition prefix used for bounded checkpoint joins."""
    return pl.col("kenteken").str.slice(0, 1).str.to_uppercase().fill_null("").alias("_prefix")


def _primary_inspection_keys(inspections_lf: pl.LazyFrame) -> pl.LazyFrame:
    """Reduce RDW inspection reports to one primary APK key per vehicle/day."""
    return (
        inspections_lf.filter(
            pl.col("soort_melding_ki_omschrijving").str.to_lowercase().str.strip_chars()
            == "periodieke controle"
        )
        .select(
            [
                "kenteken",
                "meld_datum_door_keuringsinstantie",
                _normalized_time(),
            ]
        )
        .group_by(["kenteken", "meld_datum_door_keuringsinstantie"])
        .agg(pl.col("meld_tijd_door_keuringsinstantie").min())
        .with_columns(
            [
                _kenteken_prefix(),
                pl.col("meld_datum_door_keuringsinstantie")
                .str.slice(0, 4)
                .cast(pl.Int32)
                .alias("insp_year"),
            ]
        )
    )


def _defect_counts_build(defects_lf: pl.LazyFrame) -> pl.LazyFrame:
    """Aggregate defect counts to the inspection key used by Stage 2."""
    return (
        defects_lf.select(
            [
                "kenteken",
                "meld_datum_door_keuringsinstantie",
                _normalized_time(),
                pl.col("aantal_gebreken_geconstateerd")
                .fill_null(1)
                .cast(pl.Int64)
                .alias("aantal_gebreken_geconstateerd"),
            ]
        )
        .with_columns(_kenteken_prefix())
        .group_by(
            [
                "_prefix",
                "kenteken",
                "meld_datum_door_keuringsinstantie",
                "meld_tijd_door_keuringsinstantie",
            ]
        )
        .agg(pl.col("aantal_gebreken_geconstateerd").sum().alias("defect_count"))
    )


def _vehicle_attributes_build(vehicles_lf: pl.LazyFrame) -> pl.LazyFrame:
    """Select and normalize vehicle attributes needed by Stage 2."""
    return (
        vehicles_lf.select(
            [
                "kenteken",
                _kenteken_prefix(),
                pl.col("merk").str.to_uppercase().str.strip_chars().alias("merk"),
                pl.col("handelsbenaming")
                .str.to_uppercase()
                .str.strip_chars()
                .alias("handelsbenaming"),
                "datum_eerste_toelating",
                pl.col("catalogusprijs").cast(pl.Float64).fill_null(0).alias("catalogusprijs"),
                pl.when(pl.col("voertuigsoort") == "Personenauto")
                .then(pl.lit("consumer"))
                .when(pl.col("voertuigsoort") == "Bedrijfsauto")
                .then(pl.lit("commercial"))
                .otherwise(pl.lit("other"))
                .alias("vehicle_type_group"),
            ]
        )
        .filter(pl.col("vehicle_type_group").is_in(["consumer", "commercial"]))
        .unique(subset=["kenteken"], keep="first")
    )


def _inspection_stats_join(
    primary_inspections: pl.LazyFrame,
    vehicle_columns: pl.LazyFrame,
    defect_counts: pl.LazyFrame,
    fuel_types: pl.LazyFrame,
) -> pl.LazyFrame:
    """Join reduced Stage 2 inputs into the final inspection-level schema."""
    return (
        primary_inspections.join(vehicle_columns, on=["_prefix", "kenteken"], how="inner")
        .join(fuel_types, on=["_prefix", "kenteken"], how="left")
        .join(
            defect_counts,
            on=[
                "_prefix",
                "kenteken",
                "meld_datum_door_keuringsinstantie",
                "meld_tijd_door_keuringsinstantie",
            ],
            how="left",
        )
        .with_columns(
            [
                pl.col("primary_fuel").fill_null("Other"),
                pl.col("datum_eerste_toelating").str.slice(0, 4).cast(pl.Int32).alias("reg_year"),
                pl.col("defect_count").fill_null(0),
            ]
        )
        .with_columns((pl.col("insp_year") - pl.col("reg_year")).alias("age_at_inspection"))
        .filter((pl.col("age_at_inspection") >= 0) & (pl.col("age_at_inspection") <= 100))
        .select(
            [
                "kenteken",
                "meld_datum_door_keuringsinstantie",
                "meld_tijd_door_keuringsinstantie",
                "merk",
                "handelsbenaming",
                "catalogusprijs",
                "vehicle_type_group",
                "primary_fuel",
                "insp_year",
                "age_at_inspection",
                "defect_count",
            ]
        )
    )


def inspection_stats_build(
    inspections_lf: pl.LazyFrame,
    vehicles_lf: pl.LazyFrame,
    defects_lf: pl.LazyFrame,
    brandstof_lf: pl.LazyFrame,
) -> pl.LazyFrame:
    """Build the lazy inspection-level stats plan used by Stage 2 outputs."""
    primary_inspections = _primary_inspection_keys(inspections_lf)
    fuel_types = _determine_primary_fuel(brandstof_lf)
    defect_counts = _defect_counts_build(defects_lf)
    vehicle_columns = _vehicle_attributes_build(vehicles_lf)

    return _inspection_stats_join(primary_inspections, vehicle_columns, defect_counts, fuel_types)


def _lazyframe_persist(lazy_frame: pl.LazyFrame, output_path: Path) -> pl.LazyFrame:
    """Persist a lazy frame as Parquet and return a lazy scan of the file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    path_remove(output_path)

    lazy_frame.sink_parquet(
        output_path,
        compression="zstd",
        maintain_order=False,
        engine="streaming",
    )
    return pl.scan_parquet(output_path)


def _checkpoint_path(output_path: Path, name: str) -> Path:
    """Return a sibling checkpoint path for Stage 2 intermediates."""
    return output_path.with_name(f"_{name}.parquet")


def inspection_stats_persist(
    inspections_lf: pl.LazyFrame,
    vehicles_lf: pl.LazyFrame,
    defects_lf: pl.LazyFrame,
    brandstof_lf: pl.LazyFrame,
    output_path: Path,
) -> pl.LazyFrame:
    """Persist reduced Stage 2 checkpoints and return the inspection stats scan."""
    primary_path = _checkpoint_path(output_path, "primary_inspections")
    defect_path = _checkpoint_path(output_path, "defect_counts")
    fuel_path = _checkpoint_path(output_path, "primary_fuel")
    vehicle_path = _checkpoint_path(output_path, "vehicle_attributes")

    for path in (primary_path, defect_path, fuel_path, vehicle_path, output_path):
        path_remove(path)

    print("Stage2 checkpoint start: primary inspections", flush=True)
    primary_inspections = _lazyframe_persist(_primary_inspection_keys(inspections_lf), primary_path)
    print("Stage2 checkpoint done: primary inspections", flush=True)

    print("Stage2 checkpoint start: defect counts", flush=True)
    defect_counts = _lazyframe_persist(_defect_counts_build(defects_lf), defect_path)
    print("Stage2 checkpoint done: defect counts", flush=True)

    print("Stage2 checkpoint start: primary fuel", flush=True)
    fuel_types = _lazyframe_persist(
        _determine_primary_fuel(brandstof_lf).with_columns(_kenteken_prefix()), fuel_path
    )
    print("Stage2 checkpoint done: primary fuel", flush=True)

    print("Stage2 checkpoint start: vehicle attributes", flush=True)
    vehicle_columns = _lazyframe_persist(_vehicle_attributes_build(vehicles_lf), vehicle_path)
    print("Stage2 checkpoint done: vehicle attributes", flush=True)

    prefixes = (
        primary_inspections.select(pl.col("_prefix").unique().sort())
        .collect(engine="streaming")
        .get_column("_prefix")
        .to_list()
    )

    output_path.mkdir(parents=True, exist_ok=True)
    for prefix in prefixes:
        part_path = output_path / f"part-{prefix or 'empty'}.parquet"
        print(f"Stage2 checkpoint start: inspection stats {prefix}", flush=True)
        inspection_stats = _inspection_stats_join(
            primary_inspections.filter(pl.col("_prefix") == prefix),
            vehicle_columns.filter(pl.col("_prefix") == prefix),
            defect_counts.filter(pl.col("_prefix") == prefix),
            fuel_types.filter(pl.col("_prefix") == prefix),
        )
        _lazyframe_persist(inspection_stats, part_path)
        print(f"Stage2 checkpoint done: inspection stats {prefix}", flush=True)

    result = pl.scan_parquet(str(output_path / "*.parquet"))
    print("Stage2 checkpoint done: inspection stats", flush=True)

    for path in (primary_path, defect_path, fuel_path, vehicle_path):
        path_remove(path)

    return result


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
