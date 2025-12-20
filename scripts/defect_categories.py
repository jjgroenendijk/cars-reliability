"""
Defect category configuration for reliability filtering.

This module defines which defects are considered "wear-and-tear" (consumables that
naturally wear out regardless of car quality) vs "reliability" (indicating actual
mechanical or structural issues with the vehicle).

Categorization is based on the `gebrek_artikel_nummer` field from RDW's gebreken dataset.
"""

from typing import Any

# Article number patterns that indicate WEAR-AND-TEAR defects (NOT reliability issues)
# These are consumables/items that naturally wear out regardless of car quality:
WEAR_AND_TEAR_ARTICLE_PATTERNS: set[str] = {
    # Tires / Banden (profiel, montage, etc.) - Art 5.*.27
    "5.*.27",
    "5.2.27",
    "5.3.27",
    # Tire-related advisory codes
    "TA.5C",
    "TA.5D",
    "TA.6G",
    "TA.6H",
    "AC1",  # Advisory: tire profile 1.6-2.5mm
    # Lights / Verlichting - Bulbs wear out over time
    "5.*.51",
    "5.*.52",
    "5.*.53",
    "5.*.55",
    "5.*.61",
    "5.*.62",
    "5.2.51",
    "5.2.52",
    "5.2.53",
    "5.2.55",
    "5.3.51",
    "5.3.52",
    "5.3.53",
    "5.3.55",
    # Windshield wipers - normal wear items
    "5.*.36",
    "5.2.36",
    "5.3.36",
}

# Defect code prefixes that indicate wear-and-tear (administrative/advisory codes)
WEAR_AND_TEAR_CODE_PREFIXES: tuple[str, ...] = (
    "AC",  # Advisory Codes
    "AP",  # APK+ codes (advisory)
)

# Specific defect codes that are NOT reliability indicators
# (These override article number matching for edge cases)
WEAR_AND_TEAR_SPECIFIC_CODES: set[str] = {
    "205",  # Band onvoldoende profiel
    "206",  # Band onvoldoende profiel (<1.4mm)
    "212",  # Tire pressure warning
    "213",  # Tire mounting not per spec
    "216",  # Load index too small
    "217",  # Load index not determinable
    "701",  # Tire profile advisory
    "875",  # Bandenprofiel just below minimum
    "876",  # Bandenprofiel insufficient
    "RA4",  # Tire pressure system warning
    "AC1",  # Tire profile advisory
}


def is_wear_and_tear_defect(
    defect_code: str,
    gebreken_index: dict[str, dict[str, Any]] | None = None,
) -> bool:
    """
    Check if a defect code represents wear-and-tear rather than reliability.

    Args:
        defect_code: The gebrek_identificatie code
        gebreken_index: Optional index of defect descriptions (for article number lookup)

    Returns:
        True if this defect is wear-and-tear, False if it's a reliability indicator
    """
    defect_code = defect_code.strip().upper()

    # Check if it's in the specific wear-and-tear codes
    if defect_code in WEAR_AND_TEAR_SPECIFIC_CODES:
        return True

    # Check prefix-based exclusions
    for prefix in WEAR_AND_TEAR_CODE_PREFIXES:
        if defect_code.startswith(prefix):
            return True

    # If we have the gebreken index, check article number
    if gebreken_index:
        defect_info = gebreken_index.get(defect_code, {})
        article_number = defect_info.get("gebrek_artikel_nummer", "").strip()

        # Check if article number matches any wear-and-tear pattern
        if article_number in WEAR_AND_TEAR_ARTICLE_PATTERNS:
            return True

        # Also check with wildcards replaced
        # Convert "5.2.27" to "5.*.27" pattern for matching
        if article_number and len(article_number) >= 5:
            parts = article_number.split(".")
            if len(parts) >= 3:
                wildcard_pattern = f"{parts[0]}.*.{parts[2]}"
                if wildcard_pattern in WEAR_AND_TEAR_ARTICLE_PATTERNS:
                    return True

    return False


def is_reliability_defect(
    defect_code: str,
    gebreken_index: dict[str, dict[str, Any]] | None = None,
) -> bool:
    """
    Check if a defect code represents a true reliability issue.

    This is the inverse of is_wear_and_tear_defect().

    Args:
        defect_code: The gebrek_identificatie code
        gebreken_index: Optional index of defect descriptions (for article number lookup)

    Returns:
        True if this defect indicates a reliability issue
    """
    return not is_wear_and_tear_defect(defect_code, gebreken_index)


# Category names for UI display
CATEGORY_RELIABILITY = "reliability"
CATEGORY_WEAR_AND_TEAR = "wear_and_tear"


def categorize_defect(
    defect_code: str,
    gebreken_index: dict[str, dict[str, Any]] | None = None,
) -> str:
    """
    Return the category name for a defect code.

    Args:
        defect_code: The gebrek_identificatie code
        gebreken_index: Optional index of defect descriptions

    Returns:
        Either CATEGORY_RELIABILITY or CATEGORY_WEAR_AND_TEAR
    """
    if is_wear_and_tear_defect(defect_code, gebreken_index):
        return CATEGORY_WEAR_AND_TEAR
    return CATEGORY_RELIABILITY
