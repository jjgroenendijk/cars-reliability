# Reliability Metrics

## Current Metrics (MVP)

### Average Defects per Vehicle

**Formula:**
```
avg_defects_per_vehicle = total_defects / unique_vehicles
```

**Interpretation:**
- Lower values indicate more reliable vehicles
- Measures the average number of defects found across all inspections for a vehicle

**Limitations:**
- Doesn't account for vehicle age (older cars have more inspections)
- Doesn't distinguish between major and minor defects
- Sample bias: only includes vehicles that had defects recorded

### Average Defects per Inspection

**Formula:**
```
avg_defects_per_inspection = total_defects / total_inspections
```

**Interpretation:**
- Normalizes for number of inspections
- Useful for comparing vehicles with different inspection histories

## Planned Metrics

### APK Failure Rate

```
failure_rate = failed_inspections / total_inspections
```

Would require the "Keuringsresultaten" dataset which contains pass/fail outcomes.

### Age-Normalized Defect Rate

```
normalized_rate = defects / (vehicle_age_in_years * inspections)
```

Controls for the fact that older vehicles naturally accumulate more defects.

### Defect Severity Score

Weight defects by severity category:
- Critical defects: weight 3
- Major defects: weight 2  
- Minor defects: weight 1

```
severity_score = (critical * 3 + major * 2 + minor * 1) / total_inspections
```

### First-APK Failure Rate

```
first_apk_failure = vehicles_failing_first_apk / vehicles_with_first_apk
```

Measures reliability when the car is 4 years old (when first APK is required in NL).

## Data Filters

### Current Filters

- **Vehicle type**: Personenauto (passenger cars) only
- **Minimum sample**: 100+ vehicles for brand stats, 50+ for model stats

### Suggested Additional Filters

- **Age range**: Compare cars of similar age cohorts
- **Mileage bands**: If mileage data becomes available
- **Time period**: Focus on recent years for relevance

## Methodology Notes

### Join Strategy

We start from the defects dataset and join to vehicles:

```
defects (kenteken) → vehicles (kenteken, merk, handelsbenaming)
```

This means:
- ✅ All analyzed vehicles have at least one defect record
- ❌ Vehicles with zero defects are not in our dataset

### Aggregation

1. Count defects per vehicle (kenteken)
2. Join with vehicle metadata (brand, model)
3. Aggregate by brand/model
4. Calculate averages

### Statistical Considerations

- **Sample size matters**: We require minimum vehicle counts to avoid misleading results from small samples
- **Confidence intervals**: Not yet calculated (TODO)
- **Outliers**: Not currently handled; extreme values could skew averages

## Comparison to Other Studies

### ANWB Betrouwbaarheidsonderzoek
The Dutch auto club ANWB publishes reliability studies based on member surveys. Our approach differs:
- We use objective inspection data, not subjective reports
- We measure defects found, not breakdowns experienced
- We have access to all registered vehicles, not just ANWB members

### TÜV Report (Germany)
Similar methodology using inspection data. Differences:
- TÜV has access to more detailed defect categorization
- They normalize by age cohorts
- Larger sample sizes (all of Germany)
