"""
Helper utilities for Stage 2 inspection preparation and I/O.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any


def json_load(filepath: Path) -> list[dict[str, Any]]:
    """Load JSON data from a file."""
    with open(filepath, encoding="utf-8") as file_handle:
        return json.load(file_handle)


def json_save(data: Any, filepath: Path) -> None:
    """Save data to a JSON file."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as file_handle:
        json.dump(data, file_handle, ensure_ascii=False, indent=2)


def date_parse_yyyymmdd(value: str) -> datetime | None:
    """Parse a YYYYMMDD string into a datetime."""
    if not value or len(value) < 8:
        return None
    try:
        return datetime(int(value[:4]), int(value[4:6]), int(value[6:8]))
    except (TypeError, ValueError):
        return None


def age_calculate(datum_eerste_toelating: str, reference_date: datetime) -> int | None:
    """Calculate vehicle age in years from first registration date (YYYYMMDD)."""
    if not datum_eerste_toelating or len(datum_eerste_toelating) < 8:
        return None
    try:
        year = int(datum_eerste_toelating[:4])
        month = int(datum_eerste_toelating[4:6])
        day = int(datum_eerste_toelating[6:8])
        age_years = (reference_date - datetime(year, month, day)).days // 365
        return age_years if 0 <= age_years <= 100 else None
    except (ValueError, TypeError):
        return None


def vehicles_index(vehicles: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Create an index of vehicles by kenteken (license plate)."""
    return {
        vehicle["kenteken"]: vehicle for vehicle in vehicles if vehicle.get("kenteken")
    }


def inspection_filter(record: dict[str, Any]) -> bool:
    """
    Filter inspection records to include only primary APK inspections.

    Accept only APK "periodieke controle" rows to avoid tachograph in/out events.
    Returns True if inspection should be included.
    """
    soort_melding = record.get("soort_melding_ki_omschrijving", "").strip().lower()
    return soort_melding == "periodieke controle"


def time_normalize(value: str) -> str:
    """Normalize inspection time strings (HHMM) to 4-digit zero-padded form."""
    if not value:
        return ""
    trimmed = value.strip()
    if trimmed.isdigit():
        return trimmed.zfill(4)
    return trimmed


def inspection_key_build(record: dict[str, Any]) -> tuple[str, str, str] | None:
    """Build a stable inspection key (kenteken, date, time) or None if missing."""
    kenteken = record.get("kenteken", "").strip()
    insp_date = record.get("meld_datum_door_keuringsinstantie", "").strip()
    insp_time = time_normalize(record.get("meld_tijd_door_keuringsinstantie", ""))
    if not kenteken or not insp_date:
        return None
    return kenteken, insp_date, insp_time


def inspection_keys_primary(
    inspections: list[dict[str, Any]],
) -> set[tuple[str, str, str]]:
    """
    Determine primary inspection keys by vehicle/day.

    Picks the earliest inspection time per (kenteken, date) for periodieke controles
    to avoid counting same-day re-tests.
    """
    earliest_by_vehicle_day: dict[tuple[str, str], str] = {}
    for record in inspections:
        if not inspection_filter(record):
            continue

        key = inspection_key_build(record)
        if not key:
            continue

        kenteken, insp_date, insp_time = key
        vehicle_day = (kenteken, insp_date)
        existing_time = earliest_by_vehicle_day.get(vehicle_day)
        if existing_time is None or (
            insp_time and (existing_time == "" or insp_time < existing_time)
        ):
            earliest_by_vehicle_day[vehicle_day] = insp_time

    return {
        (kenteken, insp_date, insp_time)
        for (kenteken, insp_date), insp_time in earliest_by_vehicle_day.items()
    }


def data_sanity_check(
    vehicle: dict[str, Any],
    inspection_date: datetime,
    age_at_inspection: int | None,
) -> bool:
    """
    Validate vehicle and inspection data for sanity.

    Returns True if data passes sanity checks, False otherwise.
    Filters out:
    - Invalid ages (< 0 or > 100 years)
    - Inspections before vehicle registration date
    - Other data quality issues
    """
    if age_at_inspection is not None and (
        age_at_inspection < 0 or age_at_inspection > 100
    ):
        return False

    registration_date_str = vehicle.get("datum_eerste_toelating", "").strip()
    registration_date = date_parse_yyyymmdd(registration_date_str)
    if registration_date and inspection_date < registration_date:
        return False

    return True
