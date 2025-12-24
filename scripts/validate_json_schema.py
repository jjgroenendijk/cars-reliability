#!/usr/bin/env python3
"""
Validate JSON schema for processed data files.

Ensures that required fields exist in the output JSON to prevent
frontend crashes due to missing data.
"""

import json
import sys
from pathlib import Path

DIR_PROCESSED = Path(__file__).parent.parent / "data" / "processed"

REQUIRED_BRAND_FIELDS = [
    "merk",
    "vehicle_count",
    "total_inspections",
    "total_defects",
    "total_vehicle_years",
    "age_brackets",
]

REQUIRED_MODEL_FIELDS = [
    "merk",
    "handelsbenaming",
    "vehicle_count",
    "total_inspections",
    "total_defects",
    "total_vehicle_years",
    "age_brackets",
]

AGE_BRACKET_KEYS = ["4_7", "8_12", "13_20", "5_15"]


def validate_file(path: Path, required_fields: list[str], name: str) -> list[str]:
    """Validate a JSON file has required fields."""
    errors = []

    if not path.exists():
        errors.append(f"{name}: File not found at {path}")
        return errors

    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"{name}: Invalid JSON - {e}")
        return errors

    if not isinstance(data, list):
        errors.append(f"{name}: Expected list, got {type(data).__name__}")
        return errors

    if len(data) == 0:
        errors.append(f"{name}: Empty data array")
        return errors

    # Check first few items for required fields
    for i, item in enumerate(data[:3]):
        for field in required_fields:
            if field not in item:
                errors.append(f"{name}[{i}]: Missing required field '{field}'")

        # Check age_brackets structure
        if "age_brackets" in item:
            brackets = item["age_brackets"]
            if not isinstance(brackets, dict):
                errors.append(f"{name}[{i}]: age_brackets should be dict, got {type(brackets)}")
            else:
                for key in AGE_BRACKET_KEYS:
                    if key not in brackets:
                        errors.append(f"{name}[{i}]: Missing age_bracket key '{key}'")

    return errors


def main() -> int:
    """Run validation and return exit code."""
    all_errors = []

    # Validate brand_stats.json
    brand_errors = validate_file(
        DIR_PROCESSED / "brand_stats.json", REQUIRED_BRAND_FIELDS, "brand_stats"
    )
    all_errors.extend(brand_errors)

    # Validate model_stats.json
    model_errors = validate_file(
        DIR_PROCESSED / "model_stats.json", REQUIRED_MODEL_FIELDS, "model_stats"
    )
    all_errors.extend(model_errors)

    if all_errors:
        print("Schema validation FAILED:")
        for error in all_errors:
            print(f"  - {error}")
        return 1

    print("Schema validation PASSED")
    print(f"  - brand_stats.json: OK")
    print(f"  - model_stats.json: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
