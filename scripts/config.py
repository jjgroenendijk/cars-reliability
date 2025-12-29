"""
Central configuration for data processing pipeline.

Contains paths, thresholds, constants, and settings used across all scripts.
"""

from pathlib import Path

# === Directory Paths ===
DIR_ROOT = Path(__file__).parent.parent
DIR_DATA = DIR_ROOT / "data"
DIR_PARQUET = DIR_DATA / "parquet"
DIR_PROCESSED = DIR_DATA / "processed"

# === Thresholds for Statistical Significance ===
THRESHOLD_BRAND = 100
THRESHOLD_MODEL = 1
THRESHOLD_AGE_BRACKET = 30  # Minimum vehicles per year for per-year stats

# === Ranking Thresholds (Home Page Top 10) ===
THRESHOLD_BRAND_RANKING = 500
THRESHOLD_MODEL_RANKING = 100

# === Download Settings ===
REQUEST_TIMEOUT = 3600  # 1 hour for very large downloads
PAGE_SIZE = 50000  # Rows per page for parallel pagination

# === RDW API Configuration ===
API_BASE = "https://opendata.rdw.nl"

# Dataset ID -> output name mapping
DATASETS = {
    "m9d7-ebf2": "voertuigen",
    "sgfe-77wx": "meldingen",
    "a34c-vvps": "geconstateerde_gebreken",
    "hx2c-gt7k": "gebreken",
    "8ys7-d773": "brandstof",
}

# === Processing Configuration ===
KNOWN_FUEL_TYPES = {"Benzine", "Diesel", "Elektriciteit", "LPG"}
VEHICLE_TYPE_CONSUMER = "consumer"
VEHICLE_TYPE_COMMERCIAL = "commercial"



# Primary fuel types for categorization
PRIMARY_FUEL_TYPES = {
    "Benzine",
    "Diesel",
    "Hybrid",
    "EV",
    "LPG",
}

# === Cache Validation ===
# Minimum file sizes in bytes for cache validation
MIN_CACHE_SIZES = {
    "voertuigen": 500_000_000,  # ~500 MB
    "meldingen": 300_000_000,  # ~300 MB
    "geconstateerde_gebreken": 100_000_000,  # ~100 MB
    "gebreken": 10_000,  # ~10 KB (small reference table)
    "brandstof": 50_000_000,  # ~50 MB
}
DEFAULT_MIN_CACHE_SIZE = 10_000  # 10 KB fallback
