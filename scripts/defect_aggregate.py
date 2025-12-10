"""
Defect aggregation helpers for Stage 2 processing.
"""

from collections import defaultdict
from typing import Any

from inspection_prepare import time_normalize


def defect_severity_weight(
    gebrek_identificatie: str, gebreken_index: dict[str, dict[str, Any]]
) -> float:
    """
    Determine severity weight for a defect based on its classification.

    European PTI framework uses:
    - Minor defects: 1.0 (baseline)
    - Major defects: 3.0
    - Dangerous defects: 10.0

    Severity is encoded in the gebrek_identificatie or gebrek_artikel_nummer.
    APK severity codes typically use letters: L (licht/minor), H (hoofdgebrek/major), G (gevaarlijk/dangerous).
    """
    if not gebrek_identificatie:
        return 1.0

    gebrek = gebreken_index.get(gebrek_identificatie)
    if not gebrek:
        return 1.0  # Unknown defects get baseline weight

    code_upper = gebrek_identificatie.upper()
    if code_upper.endswith("G") or "GEVAAR" in code_upper or "DANGER" in code_upper:
        return 10.0
    if code_upper.endswith("H") or "HOOFD" in code_upper or "MAJOR" in code_upper:
        return 3.0
    if code_upper.endswith("L") or "LICHT" in code_upper or "MINOR" in code_upper:
        return 1.0

    artikel_nr = gebrek.get("gebrek_artikel_nummer", "").upper()
    if artikel_nr:
        if "G" in artikel_nr[-2:] or "GEVAAR" in artikel_nr:
            return 10.0
        if "H" in artikel_nr[-2:] or "HOOFD" in artikel_nr:
            return 3.0

    return 1.0


def defect_counts_index_create(
    defect_records: list[dict[str, Any]],
    gebreken_index: dict[str, dict[str, Any]],
    valid_inspections: set[tuple[str, str, str]] | None = None,
) -> dict[tuple[str, str, str], float]:
    """Aggregate weighted defect counts per inspection keyed by (kenteken, date, time)."""
    defect_index: dict[tuple[str, str, str], float] = defaultdict(float)
    for record in defect_records:
        kenteken = record.get("kenteken", "").strip()
        insp_date = record.get("meld_datum_door_keuringsinstantie", "").strip()
        insp_time = time_normalize(record.get("meld_tijd_door_keuringsinstantie", ""))
        gebrek_id = record.get("gebrek_identificatie", "").strip()
        if not kenteken or not insp_date:
            continue

        key = (kenteken, insp_date, insp_time)
        if valid_inspections is not None and key not in valid_inspections:
            continue

        raw_count = record.get("aantal_gebreken_geconstateerd", 1)
        try:
            defect_count = int(raw_count)
        except (TypeError, ValueError):
            defect_count = 1

        weight = defect_severity_weight(gebrek_id, gebreken_index)
        weighted_count = max(defect_count, 0) * weight

        defect_index[key] += weighted_count

    return defect_index
