# Reliability Metrics

> **Last Updated:** 2025-12-10

## Overview

This document describes how reliability metrics are calculated from RDW APK inspection data.

---

## Primary Metrics

### Defects per Vehicle-Year - Primary Ranking Metric

The main reliability indicator used for rankings. This metric normalizes defects by the actual time vehicles were under inspection, avoiding cadence bias from varying inspection frequencies.

**Formula:**

```text
defects_per_vehicle_year = total_defects / total_vehicle_years

where:
  vehicle_years = sum of inspection_coverage_years for each vehicle

inspection_coverage_years = max((vervaldatum_keuring - meld_datum_door_keuringsinstantie)/365.25, 0.25)
- fallback: 1.0 year if vervaldatum_keuring is missing or invalid
- inspections are deduped to the earliest meld_tijd_door_keuringsinstantie per vehicle/day to avoid counting re-tests
- only `periodieke controle` records are included (tachograph in/out events are excluded)
```

**Why Vehicle-Years Instead of Average Age:**

The previous formula `defects_per_year = avg_defects_per_inspection / avg_age_years` created cadence bias:
- APK inspections occur at different frequencies by age (first at 4 years, then biennial until 8, then annual)
- Brands with newer fleets appeared less reliable because the denominator (avg_age) was smaller
- Vehicle-years accounts for actual inspection opportunity, not just calendar age

**Interpretation:**

- Lower values = better reliability per year of service
- Accounts for inspection cadence differences across vehicle ages
- Fair comparison between brands with different age profiles and inspection histories
- This is the primary metric used for ranking brands and models

**Example:**

| Brand | Total Defects | Vehicle-Years | Defects/Vehicle-Year |
|-------|---------------|---------------|----------------------|
| Toyota | 15,000 | 60,000 | 0.250 |
| Tesla | 4,500 | 12,000 | 0.375 |

Toyota shows better reliability normalized by actual inspection time, even though both brands may have similar avg_defects_per_inspection.

---

### Average Defects per Inspection

A secondary metric that shows the raw defect rate without age normalization.

**Formula:**

```text
avg_defects_per_inspection = total_defects / total_inspections
```

**Interpretation:**

- Lower values = fewer defects found
- Range: typically 0.1 to 1.5
- A value of 0.30 means an average of 0.3 defects per inspection
- Does not account for vehicle age

**Example:**

| Brand | Total Defects | Total Inspections | Avg Defects/Inspection |
|-------|---------------|-------------------|------------------------|
| Toyota | 15,000 | 75,000 | 0.20 |
| BMW | 30,000 | 75,000 | 0.40 |

---

### Standard Deviation

Both metrics include standard deviation to indicate statistical uncertainty:

- `std_defects_per_inspection` — Variance in per-vehicle defect rates
- `std_defects_per_vehicle_year` — Variance in per-vehicle annual defect rates

**Interpretation:**

- Lower std dev = more consistent data across vehicles
- Higher std dev = more variation (could indicate small sample or mixed fleet quality)
- Brands with small samples (e.g., BYD) will typically show higher std dev

**Example:**

| Brand | Defects/Year | Std Dev | Confidence |
|-------|--------------|---------|------------|
| Toyota | 0.25 | 0.02 | High (large sample, low variance) |
| BYD | 0.35 | 0.18 | Low (small sample, high variance) |

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

Minimum thresholds for inclusion in rankings:

| Level | Minimum Vehicles | Rationale |
|-------|------------------|-----------|
| Level | Minimum Vehicles | Rationale |
|-------|------------------|-----------|
| Brand (General) | 100 | Include emerging brands in full lists |
| Brand (Home Page Top 10) | 500 | Higher confidence for featured ranking |
| Model (General) | 50 | Balance granularity vs. confidence |
| Model (Home Page Top 10) | 100 | Higher confidence for featured ranking |
| Age Bracket | 30 | Per-bracket minimum |

Records below these thresholds are excluded from rankings and tables.

> [!NOTE]
> Brands with smaller samples (e.g., BYD, Polestar) are included but will show higher standard deviation values, indicating greater statistical uncertainty. Users should consider both the defect rate and its std deviation when comparing brands.

---

## Data Filters

### Applied Filters

| Filter | Value | Reason |
|--------|-------|--------|
| Vehicle type | `voertuigsoort='Personenauto'` | Exclude trucks, motorcycles, trailers |
| Inspection type | `soort_melding_ki_omschrijving='periodieke controle'` | Avoid tachograph in/out events |
| Re-tests | Keep earliest `meld_tijd_door_keuringsinstantie` per vehicle/day | Drop likely same-day re-tests (no explicit RDW flag available) |
| Inspection status | Exclude "Vervallen", "Niet verschenen" | Only count actual completed inspections |

### Defect Counting

All defects are counted equally (weight 1.0). 

> [!NOTE]
> Severity weighting was removed because RDW does not publish defect severity classifications in their open data (`a34c-vvps` or `hx2c-gt7k`). The previous heuristic approach (inferring severity from defect code patterns) was undocumented and potentially inaccurate.

### Data Sanity Checks

The following inspections are filtered out before analysis:

- Vehicle age < 0 or > 100 years
- Inspection date before vehicle registration date
- Invalid or missing dates
- Non-`periodieke controle` inspection records (tachograph in/out events)
- Duplicate inspections on the same vehicle/day after the earliest meld_tijd (treated as re-tests)

### Excluded Data

- Vehicles without registration date (cannot calculate age)
- Vehicles with no inspection records
- Records with missing required fields
- Brands/models below sample size thresholds
- Inspections failing sanity checks

---

## Ranking Methodology

### Top 10 Most Reliable

Sorted by `defects_per_vehicle_year` ascending (lowest = best).

### Top 10 Least Reliable

Sorted by `defects_per_vehicle_year` descending (highest = worst).

### Tie-Breaking

When two brands/models have identical `defects_per_vehicle_year`:

1. Higher `vehicle_count` ranks first (more confident data)

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
