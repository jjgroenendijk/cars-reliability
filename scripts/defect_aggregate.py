"""
Defect aggregation helpers for Stage 2 processing.
"""

from collections import defaultdict
from typing import Any

from defect_categories import is_reliability_defect
from inspection_prepare import time_normalize


def defect_counts_index_create(
    defect_records: list[dict[str, Any]],
    valid_inspections: set[tuple[str, str, str]] | None = None,
    gebreken_index: dict[str, dict[str, Any]] | None = None,
    reliability_only: bool = False,
) -> dict[tuple[str, str, str], float]:
    """Aggregate defect counts per inspection keyed by (kenteken, date, time).

    All defects are counted equally (weight 1.0). RDW does not publish
    defect severity classifications in their open data, so weighting
    has been removed to avoid inaccurate heuristics.

    Args:
        defect_records: List of defect records from geconstateerde_gebreken
        valid_inspections: Optional set of valid inspection keys to filter by
        gebreken_index: Optional index of defect classifications for filtering
        reliability_only: If True, only count defects classified as reliability issues
            (excludes wear-and-tear items like tires, lights, wipers)

    Returns:
        Dictionary mapping (kenteken, date, time) to defect count
    """
    defect_index: dict[tuple[str, str, str], float] = defaultdict(float)
    for record in defect_records:
        kenteken = record.get("kenteken", "").strip()
        insp_date = record.get("meld_datum_door_keuringsinstantie", "").strip()
        insp_time = time_normalize(record.get("meld_tijd_door_keuringsinstantie", ""))
        if not kenteken or not insp_date:
            continue

        key = (kenteken, insp_date, insp_time)
        if valid_inspections is not None and key not in valid_inspections:
            continue

        # Get defect code for category filtering
        defect_code = record.get("gebrek_identificatie", "").strip()

        # Filter by reliability category if requested
        if reliability_only and defect_code:
            if not is_reliability_defect(defect_code, gebreken_index):
                continue

        raw_count = record.get("aantal_gebreken_geconstateerd", 1)
        try:
            defect_count = int(raw_count)
        except (TypeError, ValueError):
            defect_count = 1

        defect_index[key] += max(defect_count, 0)

    return defect_index
