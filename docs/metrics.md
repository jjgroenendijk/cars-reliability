# Reliability Metrics

> **Last Updated:** 2025-12-02

## Overview

This document describes how reliability metrics are calculated from RDW inspection data.

---

## Primary Metrics

### Average Defects per Inspection

The main reliability indicator.

**Formula:**

```text
avg_defects_per_inspection = total_defects / total_inspections
```

**Interpretation:**

- Lower values = more reliable
- Range: typically 0.1 to 1.5
- A value of 0.30 means an average of 0.3 defects per inspection

**Example:**

| Brand | Total Defects | Total Inspections | Avg Defects/Inspection |
|-------|---------------|-------------------|------------------------|
| Toyota | 15,000 | 75,000 | 0.20 |
| BMW | 30,000 | 75,000 | 0.40 |

Toyota has better reliability in this example.

---

### Defects per Year (Age-Normalized)

Accounts for vehicle age - older cars naturally have more defects.

**Formula:**

```text
defects_per_year = avg_defects_per_inspection / avg_age_years
```

**Interpretation:**

- Lower values = better age-adjusted reliability
- Allows fair comparison between brands with different age profiles
- A brand with mostly new cars may appear reliable but age poorly

**Example:**

| Brand | Avg Defects/Insp | Avg Age | Defects/Year |
|-------|------------------|---------|--------------|
| Toyota | 0.30 | 12 years | 0.025 |
| Tesla | 0.15 | 3 years | 0.050 |

Despite lower absolute defects, Tesla ages worse in this example.

---

## Age-Bracket Analysis

Users can filter by vehicle age to compare reliability within similar age groups.

### Default Age Brackets

| Bracket ID | Age Range | Description |
|------------|-----------|-------------|
| `4_7` | 4-7 years | First APK cycles |
| `8_12` | 8-12 years | Common used car age |
| `13_20` | 13-20 years | Older vehicles |
| `5_15` | 5-15 years | User-requested focus range |

### Why 5-15 Years?

This range is particularly useful because:

- Most cars in this range have had multiple APK inspections
- Represents the typical "second-hand car buyer" market
- Excludes very new cars (insufficient data) and very old cars (survivorship bias)
- Shows how cars perform during their working lifetime

### Calculation per Bracket

For each age bracket, calculate:

```text
bracket_avg_defects = sum(defects for vehicles in bracket) / sum(inspections for vehicles in bracket)
```

Only include brackets with at least 30 vehicles.

---

## Sample Size Thresholds

To ensure statistical significance:

| Level | Minimum Vehicles | Rationale |
|-------|------------------|-----------|
| Brand | 100 | Brand-level claims need larger samples |
| Model | 50 | Balance granularity vs. confidence |
| Age Bracket | 30 | Per-bracket minimum |

Records below these thresholds are excluded from rankings and tables.

---

## Data Filters

### Applied Filters

| Filter | Value | Reason |
|--------|-------|--------|
| Vehicle type | `voertuigsoort='Personenauto'` | Exclude trucks, motorcycles, trailers |

### Excluded Data

- Vehicles without registration date (cannot calculate age)
- Vehicles with no inspection records
- Records with missing required fields
- Brands/models below sample size thresholds

---

## Ranking Methodology

### Top 10 Most Reliable

Sorted by `avg_defects_per_inspection` ascending (lowest = best).

### Top 10 Least Reliable  

Sorted by `avg_defects_per_inspection` descending (highest = worst).

### Tie-Breaking

When two brands/models have identical `avg_defects_per_inspection`:

1. Higher `vehicle_count` ranks first (more confident data)
2. Lower `defects_per_year` ranks first (better aging)

---

## Data Quality Considerations

### Survivorship Bias

Older vehicle statistics may be biased:

- Only vehicles that survived to old age are measured
- Unreliable vehicles may have been scrapped earlier
- This makes old vehicles appear more reliable than they were when new

### Registration Date Accuracy

Vehicle age is calculated from `datum_eerste_toelating` (first registration date):

- May not reflect actual manufacturing date
- Import vehicles may show Dutch registration date, not original
- Some dates may be missing or malformed

### Inspection Frequency

Vehicles have different inspection frequencies:

- First APK at 4 years old
- Every 2 years until 8 years old
- Annually after 8 years old

This means older vehicles contribute more inspection data points.

---

## Future Metrics (Backlog)

### Pass Rate

Percentage of inspections passed without defects:

```text
pass_rate = (inspections_without_defects / total_inspections) * 100
```

**Status:** Requires inspection result data (pass/fail), not just defect counts.

### Common Defect Types

Most frequent defect codes by brand/model:

```text
Top defects for VOLKSWAGEN GOLF:
1. Brake disc wear (15%)
2. Light malfunction (12%)
3. Tire condition (10%)
```

**Status:** Requires per-defect-code data, not just counts.

### Trend Analysis

Year-over-year reliability changes:

```text
TOYOTA reliability trend:
2020: 0.25 defects/inspection
2021: 0.23 defects/inspection
2022: 0.22 defects/inspection
```

**Status:** Requires historical data storage.
