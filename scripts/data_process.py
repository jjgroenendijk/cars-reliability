#!/usr/bin/env python3
"""
Stage 2: Data Processing Script

Reads raw data from data/raw/ (JSON files from Stage 1) and computes
reliability statistics. Outputs processed data to data/processed/.
"""

from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from defect_aggregate import defect_counts_index_create
from inspection_prepare import (
    age_calculate,
    data_sanity_check,
    date_parse_yyyymmdd,
    inspection_key_build,
    inspection_keys_primary,
    json_load,
    json_save,
    time_normalize,
    vehicles_index,
)
from stats_calculate import (
    AGE_BRACKETS,
    metadata_create,
    rankings_generate,
    stats_filter_brands,
    stats_filter_models,
)

DIR_RAW = Path(__file__).parent.parent / "data" / "raw"
DIR_PROCESSED = Path(__file__).parent.parent / "data" / "processed"


def bracket_empty() -> dict[str, dict[str, int]]:
    """Create empty age bracket structure."""
    return {b: {"count": 0, "defects": 0, "inspections": 0} for b in AGE_BRACKETS}


def gebreken_index_create(
    gebreken_data: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Create an index of defect classifications by gebrek_identificatie."""
    return {
        g["gebrek_identificatie"]: g
        for g in gebreken_data
        if g.get("gebrek_identificatie")
    }


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


def vehicle_summaries_build(
    inspections: list[dict[str, Any]],
    vehicle_index: dict[str, dict[str, Any]],
    defects_by_inspection: dict[tuple[str, str, str], float],
    valid_inspections: set[tuple[str, str, str]],
) -> dict[str, dict[str, Any]]:
    """Build per-vehicle summaries using inspection dates for age buckets and vehicle-years."""
    summaries: dict[str, dict[str, Any]] = {}
    filtered_count = 0

    for record in inspections:
        key = inspection_key_build(record)
        if not key or key not in valid_inspections:
            continue

        kenteken, inspection_date_str, inspection_time = key

        inspection_date = date_parse_yyyymmdd(inspection_date_str)
        if not inspection_date:
            continue

        vehicle = vehicle_index.get(kenteken)
        if not vehicle:
            continue

        age_at_inspection = age_calculate(
            vehicle.get("datum_eerste_toelating", "").strip(), inspection_date
        )

        vervaldatum_keuring = record.get("vervaldatum_keuring", "").strip()
        vervaldatum_date = date_parse_yyyymmdd(vervaldatum_keuring)

        # Apply sanity checks
        if not data_sanity_check(vehicle, inspection_date, age_at_inspection):
            filtered_count += 1
            continue

        merk = vehicle.get("merk", "").strip().upper()
        handelsbenaming = vehicle.get("handelsbenaming", "").strip().upper()
        if not merk:
            continue

        summary = summaries.get(kenteken)
        if not summary:
            summary = {
                "kenteken": kenteken,
                "merk": merk,
                "handelsbenaming": handelsbenaming,
                "total_inspections": 0,
                "total_defects": 0,
                "age_sum": 0,
                "age_count": 0,
                "vehicle_years": 0.0,
                "first_inspection_date": None,
                "last_inspection_date": None,
                "bracket_inspections": {b: 0 for b in AGE_BRACKETS},
                "bracket_defects": {b: 0 for b in AGE_BRACKETS},
            }
            summaries[kenteken] = summary

        summary["total_inspections"] += 1
        defects = defects_by_inspection.get(
            (kenteken, inspection_date_str, inspection_time), 0
        )
        summary["total_defects"] += defects

        if vervaldatum_date and vervaldatum_date >= inspection_date:
            coverage_years = (vervaldatum_date - inspection_date).days / 365.25
            summary["vehicle_years"] += max(coverage_years, 0.25)
        else:
            summary["vehicle_years"] += 1.0

        # Track inspection date range for vehicle-years calculation
        if (
            summary["first_inspection_date"] is None
            or inspection_date < summary["first_inspection_date"]
        ):
            summary["first_inspection_date"] = inspection_date
        if (
            summary["last_inspection_date"] is None
            or inspection_date > summary["last_inspection_date"]
        ):
            summary["last_inspection_date"] = inspection_date

        if age_at_inspection is None:
            continue

        summary["age_sum"] += age_at_inspection
        summary["age_count"] += 1

        for bracket_name, (min_age, max_age) in AGE_BRACKETS.items():
            if min_age <= age_at_inspection <= max_age:
                summary["bracket_inspections"][bracket_name] += 1
                summary["bracket_defects"][bracket_name] += defects

    if filtered_count > 0:
        print(f"Filtered {filtered_count} invalid inspection records", flush=True)

    return summaries


def stats_aggregate(
    vehicle_summaries: dict[str, dict[str, Any]],
    fuel_index: dict[str, set[str]],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Aggregate statistics by brand and model."""

    def new_stats() -> dict[str, Any]:
        return {
            "vehicle_count": 0,
            "total_inspections": 0,
            "total_defects": 0,
            "age_sum": 0,
            "age_count": 0,
            "vehicle_years": 0.0,
            "age_brackets": bracket_empty(),
            "fuel_breakdown": fuel_breakdown_empty(),
        }

    brand_data: dict[str, dict[str, Any]] = defaultdict(new_stats)
    model_data: dict[str, dict[str, Any]] = defaultdict(new_stats)

    for summary in vehicle_summaries.values():
        if summary["total_inspections"] == 0:
            continue

        merk = summary["merk"]
        handelsbenaming = summary["handelsbenaming"]
        model_key = f"{merk}|{handelsbenaming}" if handelsbenaming else merk

        vehicle_years = summary.get("vehicle_years", 0.0)
        first_insp = summary.get("first_inspection_date")
        last_insp = summary.get("last_inspection_date")
        if vehicle_years <= 0 and first_insp and last_insp:
            inspection_span_years = (last_insp - first_insp).days / 365.25
            vehicle_years = max(inspection_span_years + 1.0, 1.0)
        elif vehicle_years <= 0:
            vehicle_years = 1.0

        for data, key in [(brand_data, merk), (model_data, model_key)]:
            data[key]["vehicle_count"] += 1
            data[key]["total_inspections"] += summary["total_inspections"]
            data[key]["total_defects"] += summary["total_defects"]
            data[key]["age_sum"] += summary["age_sum"]
            data[key]["age_count"] += summary["age_count"]
            data[key]["vehicle_years"] += vehicle_years

            for bracket_name in AGE_BRACKETS:
                insp_count = summary["bracket_inspections"][bracket_name]
                if insp_count > 0:
                    data[key]["age_brackets"][bracket_name]["count"] += 1
                    data[key]["age_brackets"][bracket_name]["inspections"] += insp_count
                    data[key]["age_brackets"][bracket_name]["defects"] += summary[
                        "bracket_defects"
                    ][bracket_name]

        model_data[model_key]["merk"] = merk
        model_data[model_key]["handelsbenaming"] = handelsbenaming

        # Track fuel types for this vehicle
        fuels = fuel_index.get(summary["kenteken"], set())
        for fuel in fuels:
            if fuel in MAIN_FUEL_TYPES:
                brand_data[merk]["fuel_breakdown"][fuel] += 1
                model_data[model_key]["fuel_breakdown"][fuel] += 1
            else:
                brand_data[merk]["fuel_breakdown"]["other"] += 1
                model_data[model_key]["fuel_breakdown"]["other"] += 1

    return dict(brand_data), dict(model_data)


def main() -> None:
    """Main entry point for the data processing script."""
    print("Stage2: Processing", flush=True)
    start_time = datetime.now()

    try:
        vehicles = json_load(DIR_RAW / "gekentekende_voertuigen.json")
        inspections = json_load(DIR_RAW / "meldingen_keuringsinstantie.json")
        defects = json_load(DIR_RAW / "geconstateerde_gebreken.json")
        gebreken_data = json_load(DIR_RAW / "gebreken.json")
        fuel_data = json_load(DIR_RAW / "brandstof.json")
    except FileNotFoundError as e:
        print(f"FAIL: {e}", flush=True)
        exit(1)

    print(f"Loaded {len(vehicles) // 1000}k vehicles", flush=True)

    vehicle_index = vehicles_index(vehicles)
    valid_inspections = inspection_keys_primary(inspections)
    gebreken_index = gebreken_index_create(gebreken_data)
    defects_by_inspection = defect_counts_index_create(
        defects, gebreken_index, valid_inspections
    )
    vehicle_summaries = vehicle_summaries_build(
        inspections, vehicle_index, defects_by_inspection, valid_inspections
    )
    fuel_index = fuel_index_create(fuel_data)

    total_inspections = sum(
        summary["total_inspections"] for summary in vehicle_summaries.values()
    )
    total_defects = sum(
        summary["total_defects"] for summary in vehicle_summaries.values()
    )

    brand_data, model_data = stats_aggregate(vehicle_summaries, fuel_index)

    brand_stats = stats_filter_brands(brand_data)
    model_stats = stats_filter_models(model_data)

    brand_stats.sort(key=lambda x: x.get("defects_per_vehicle_year") or float("inf"))
    model_stats.sort(key=lambda x: x.get("defects_per_vehicle_year") or float("inf"))

    rankings = rankings_generate(brand_stats, model_stats)
    metadata = metadata_create(
        len(brand_stats),
        len(model_stats),
        len(vehicle_summaries),
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
