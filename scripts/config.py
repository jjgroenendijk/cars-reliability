"""
Central configuration for data processing pipeline.

Contains thresholds, constants, and brackets used across Stage 2 scripts.
"""

# Thresholds for statistical significance (minimum sample sizes)
THRESHOLD_BRAND = 100
THRESHOLD_MODEL = 50
THRESHOLD_AGE_BRACKET = 30

# Age brackets for analysis (name: (min_age, max_age))
AGE_BRACKETS = {"4_7": (4, 7), "8_12": (8, 12), "13_20": (13, 20), "5_15": (5, 15)}

# Download settings
REQUEST_TIMEOUT = 3600  # 1 hour for very large downloads
PAGE_SIZE = 50000  # Rows per page for parallel pagination
