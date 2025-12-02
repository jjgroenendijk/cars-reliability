# Data Mapping

> RDW field names and their meanings for the Dutch Car Reliability project.

## Design Principle

All field names from RDW datasets are preserved as-is throughout the pipeline. We do not rename Dutch fields to English equivalents. This ensures:

- Consistency between raw data and processed output
- Easy debugging by comparing pipeline stages
- Direct mapping to RDW API documentation
- Keep this document updated whenever new RDW fields are used so it remains the single source of truth for field names.

---

## RDW Datasets

### Gekentekende Voertuigen (`m9d7-ebf2`)

Vehicle registration data. Filtered to `voertuigsoort='Personenauto'`.

Downloaded fields (via `$select`): `kenteken`, `merk`, `handelsbenaming`, `datum_eerste_toelating`

| Field | Type | Description |
|-------|------|-------------|
| `kenteken` | string | License plate (primary key) |
| `merk` | string | Brand name (e.g., "TOYOTA", "VOLKSWAGEN") |
| `handelsbenaming` | string | Model/trade name (e.g., "GOLF", "AYGO X") |
| `datum_eerste_toelating` | string | First registration date (YYYYMMDD) |

Additional fields available in the dataset (not downloaded):

| Field | Type | Description |
|-------|------|-------------|
| `voertuigsoort` | string | Vehicle type (e.g., "Personenauto") |
| `datum_tenaamstelling` | string | Current registration date (YYYYMMDD) |
| `vervaldatum_apk` | string | APK expiry date (YYYYMMDD) |
| `inrichting` | string | Body type (e.g., "hatchback", "sedan") |
| `aantal_zitplaatsen` | string | Number of seats |
| `eerste_kleur` | string | Primary color |
| `tweede_kleur` | string | Secondary color |
| `aantal_cilinders` | string | Number of cylinders |
| `cilinderinhoud` | string | Engine displacement (cc) |
| `massa_ledig_voertuig` | string | Empty weight (kg) |
| `massa_rijklaar` | string | Curb weight (kg) |
| `catalogusprijs` | string | Catalog price (EUR) |
| `lengte` | string | Length (cm) |
| `breedte` | string | Width (cm) |
| `hoogte_voertuig` | string | Height (cm) |
| `wielbasis` | string | Wheelbase (cm) |
| `europese_voertuigcategorie` | string | EU vehicle category (e.g., "M1") |

### Meldingen Keuringsinstantie (`sgfe-77wx`)

APK inspection reports. Downloaded as pre-aggregated counts per vehicle using SoQL.

SoQL query: `$select=kenteken,count(kenteken) as inspection_count&$group=kenteken`

| Field | Type | Description |
|-------|------|-------------|
| `kenteken` | string | License plate (foreign key) |
| `inspection_count` | string | Number of inspections for this vehicle |

### Geconstateerde Gebreken (`a34c-vvps`)

Detected defects during inspections. Downloaded as pre-aggregated counts per vehicle using SoQL.

SoQL query: `$select=kenteken,count(kenteken) as defect_count&$group=kenteken`

| Field | Type | Description |
|-------|------|-------------|
| `kenteken` | string | License plate (foreign key) |
| `defect_count` | string | Number of defects recorded for this vehicle |

### Gebreken (`hx2c-gt7k`)

Defect code reference table.

| Field | Type | Description |
|-------|------|-------------|
| `gebrek_identificatie` | string | Defect code (primary key) |
| `gebrek_omschrijving` | string | Defect description (Dutch) |
| `gebrek_artikel_nummer` | string | Article reference number |
| `ingangsdatum_gebrek` | string | Validity start date (YYYYMMDD) |
| `einddatum_gebrek` | string | Validity end date (YYYYMMDD) |

### Brandstof (`8ys7-d773`)

Fuel type data for vehicles.

| Field | Type | Description |
|-------|------|-------------|
| `kenteken` | string | License plate (foreign key) |
| `brandstof_omschrijving` | string | Fuel type description (e.g., "Benzine", "Diesel", "Elektriciteit") |
| `brandstof_volgnummer` | string | Fuel sequence number (for dual-fuel vehicles) |
| `brandstofverbruik_buiten_de_stad` | string | Fuel consumption outside city (l/100km) |
| `brandstofverbruik_gecombineerd` | string | Combined fuel consumption (l/100km) |
| `brandstofverbruik_stad` | string | City fuel consumption (l/100km) |
| `co2_uitstoot_gecombineerd` | string | CO2 emissions combined (g/km) |
| `emissieklasse` | string | Emission class (e.g., "Euro 5") |
| `geluidsniveau_rijdend` | string | Noise level while driving (dB) |
| `geluidsniveau_stationair` | string | Stationary noise level (dB) |

---

## Live Query Fields (License Plate Lookup)

The lookup page queries RDW APIs directly from the browser. The following fields are used:

### Vehicle Details (from `m9d7-ebf2`)

| Field | Type | UI Label | Description |
|-------|------|----------|-------------|
| `kenteken` | string | License Plate | License plate number |
| `merk` | string | Brand | Vehicle brand |
| `handelsbenaming` | string | Model | Vehicle model name |
| `datum_eerste_toelating` | string | First Registration | First registration date (YYYYMMDD) |
| `datum_tenaamstelling` | string | Registration Date | Current owner registration date (YYYYMMDD) |
| `vervaldatum_apk` | string | MOT Expiry Date | APK expiry date (YYYYMMDD) |
| `eerste_kleur` | string | Color | Primary vehicle color |
| `aantal_deuren` | string | Number of Doors | Door count |
| `aantal_zitplaatsen` | string | Number of Seats | Seat count |
| `cilinderinhoud` | string | Engine Capacity | Engine displacement in cc |
| `massa_ledig_voertuig` | string | Empty Mass | Vehicle empty weight in kg |
| `wam_verzekerd` | string | Insured | WAM insurance status ("Ja"/"Nee") |
| `catalogusprijs` | string | Catalog Price | Original catalog price in EUR |
| `voertuigsoort` | string | (filter) | Vehicle type - used to filter to "Personenauto" |

### Inspection History (from `sgfe-77wx`)

| Field | Type | UI Label | Description |
|-------|------|----------|-------------|
| `kenteken` | string | - | License plate (query filter) |
| `meld_datum_door_keuringsinstantie` | string | Date | Inspection date (YYYYMMDD) |
| `meld_tijd_door_keuringsinstantie` | string | Time | Inspection time (HH:MM) |
| `soort_meldingomschrijving` | string | Result | Inspection result (e.g., "Goedgekeurd", "Afgekeurd") |
| `km_stand` | string | Mileage | Odometer reading at inspection |

### Defects Found (from `a34c-vvps`)

| Field | Type | UI Label | Description |
|-------|------|----------|-------------|
| `kenteken` | string | - | License plate (query filter) |
| `meld_datum_door_keuringsinstantie` | string | - | Inspection date (used to group defects by inspection) |
| `gebrek_identificatie` | string | Defect Code | Defect identifier code |
| `aantal_gebreken` | string | Count | Number of this defect type found |

### Defect Descriptions (from `hx2c-gt7k`)

| Field | Type | UI Label | Description |
|-------|------|----------|-------------|
| `gebrek_identificatie` | string | - | Defect code (used for join) |
| `gebrek_omschrijving` | string | Description | Human-readable defect description (Dutch) |

---

## Processed Data Output

The pipeline produces JSON files in `data/processed/` using the following structures.

### brand_stats.json

Array of brand statistics, sorted by `avg_defects_per_inspection` ascending.

```json
{
  "merk": "TOYOTA",
  "vehicle_count": 12345,
  "total_inspections": 23456,
  "total_defects": 5678,
  "avg_defects_per_inspection": 0.2421,
  "avg_age_years": 8.5,
  "defects_per_year": 0.0285,
  "fuel_breakdown": {
    "Benzine": 8000,
    "Diesel": 3000,
    "Elektriciteit": 500,
    "LPG": 200,
    "other": 45
  },
  "age_brackets": {
    "4_7": { "vehicle_count": 1000, "total_inspections": 2000, "total_defects": 300, "avg_defects_per_inspection": 0.15 },
    "8_12": { ... },
    "13_20": { ... },
    "5_15": { ... }
  }
}
```

### model_stats.json

Array of model statistics, sorted by `avg_defects_per_inspection` ascending.

```json
{
  "merk": "TOYOTA",
  "handelsbenaming": "AYGO",
  "vehicle_count": 5678,
  "total_inspections": 11234,
  "total_defects": 2345,
  "avg_defects_per_inspection": 0.2088,
  "avg_age_years": 7.2,
  "defects_per_year": 0.0290,
  "fuel_breakdown": {
    "Benzine": 5000,
    "Diesel": 500,
    "Elektriciteit": 100,
    "LPG": 50,
    "other": 28
  },
  "age_brackets": { ... }
}
```

### rankings.json

Top/bottom 10 lists for brands and models.

```json
{
  "most_reliable_brands": [
    { "rank": 1, "merk": "TOYOTA", "avg_defects_per_inspection": 0.15, "total_inspections": 50000 }
  ],
  "least_reliable_brands": [ ... ],
  "most_reliable_models": [
    { "rank": 1, "merk": "TOYOTA", "handelsbenaming": "AYGO", "avg_defects_per_inspection": 0.12, "total_inspections": 10000 }
  ],
  "least_reliable_models": [ ... ],
  "generated_at": "2025-12-02T10:30:00.000000"
}
```

### metadata.json

Processing metadata.

```json
{
  "generated_at": "2025-12-02T10:30:00.000000",
  "thresholds": { "brand": 100, "model": 50, "age_bracket": 30 },
  "age_brackets": { "4_7": [4, 7], "8_12": [8, 12], "13_20": [13, 20], "5_15": [5, 15] },
  "counts": { "brands": 50, "models": 500, "vehicles_processed": 100000, "total_inspections": 200000, "total_defects": 40000 },
  "source": "RDW Open Data",
  "pipeline_stage": 2
}
```

---

## Field Naming Convention

- RDW fields: Preserved exactly as returned by API (Dutch, snake_case)
- Computed fields: English, snake_case (e.g., `avg_defects_per_inspection`, `vehicle_count`)
- This distinction makes it clear which fields come directly from RDW vs. calculated by our pipeline
