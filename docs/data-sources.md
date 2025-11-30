# Data Sources

All data comes from [RDW Open Data](https://opendata.rdw.nl/), the official Dutch vehicle authority's open data portal.

## Datasets Used

### 1. Meldingen Keuringsinstantie (Inspection Results) - PRIMARY

| Property | Value |
|----------|-------|
| Dataset ID | `sgfe-77wx` |
| URL | [opendata.rdw.nl](https://opendata.rdw.nl/Keuringen/Open-Data-RDW-Meldingen-Keuringsinstantie/sgfe-77wx) |
| Update Frequency | Daily |
| License | CC0 (Public Domain) |

**Key columns:**

- `kenteken` - License plate number
- `meld_datum_door_keuringsinstantie` - Inspection date
- `soort_melding_ki_omschrijving` - Inspection result type
- `vervaldatum_keuring` - New APK validity date (empty/0 = failed)
- `soort_erkenning_omschrijving` - Category (we filter for "APK Lichte voertuigen")

**Why this is primary:** This dataset contains ALL inspection results, including those where no defects were found. This allows us to calculate accurate pass rates and avoid sample bias.

### 2. Gekentekende Voertuigen (Registered Vehicles)

| Property | Value |
|----------|-------|
| Dataset ID | `m9d7-ebf2` |
| URL | [opendata.rdw.nl](https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen/m9d7-ebf2) |
| Update Frequency | Daily |
| License | CC0 (Public Domain) |

**Key columns:**

- `kenteken` - License plate number
- `merk` - Brand (e.g., VOLKSWAGEN, TOYOTA)
- `handelsbenaming` - Model name (e.g., GOLF, YARIS)
- `voertuigsoort` - Vehicle type (we filter for "Personenauto")
- `datum_eerste_toelating` - First registration date

We fetch this for kentekens found in the inspections dataset.

### 3. Geconstateerde Gebreken (Defects Found)

| Property | Value |
|----------|-------|
| Dataset ID | `a34c-vvps` |
| URL | [opendata.rdw.nl](https://opendata.rdw.nl/Keuringen/Open-Data-RDW-Geconstateerde-Gebreken/a34c-vvps) |
| Update Frequency | Daily |
| License | CC0 (Public Domain) |

**Key columns:**

- `kenteken` - License plate number
- `meld_datum_door_keuringsinstantie` - Inspection date
- `gebrek_identificatie` - Defect code
- `aantal_gebreken_geconstateerd` - Number of defects found

Each row represents a defect found during an APK inspection.

### 4. Gebreken (Defect Codes)

| Property | Value |
|----------|-------|
| Dataset ID | `hx2c-gt7k` |
| URL | [opendata.rdw.nl](https://opendata.rdw.nl/Keuringen/Open-Data-RDW-Gebreken/hx2c-gt7k) |
| License | CC0 (Public Domain) |

**Key columns:**

- `gebrek_identificatie` - Defect code
- `gebrek_omschrijving` - Human-readable description

Reference table for defect codes.

### 5. Brandstof (Fuel)

| Property | Value |
|----------|-------|
| Dataset ID | `8ys7-d773` |
| URL | [opendata.rdw.nl](https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen_brandstof/8ys7-d773) |
| Update Frequency | Daily |
| License | CC0 (Public Domain) |

**Key columns:**

- `kenteken` - License plate number
- `brandstof_volgnummer` - Fuel sequence (1 = primary)
- `brandstof_omschrijving` - Fuel type (Benzine, Diesel, Elektriciteit)

We filter for `brandstof_volgnummer='1'` to get the primary fuel only.

## Data Flow

```text
inspections (all APK results)
      |
      +-- extract unique kentekens
              |
              +-- vehicles (make, model info)
              +-- fuel (fuel type)
              +-- defects_found (defect details)
```

Starting from inspections (not defects) ensures we include vehicles that passed their APK with no issues, avoiding sample bias.

## API Access

RDW uses the Socrata SODA API. No authentication is required, but rate limits apply.

### Example Query

```python
from sodapy import Socrata

client = Socrata("opendata.rdw.nl", None)

# Get 1000 inspection records
results = client.get("sgfe-77wx", limit=1000)
```

### SoQL Queries

The API supports SoQL (Socrata Query Language):

```python
# Get APK inspections for light vehicles only
results = client.get(
    "sgfe-77wx",
    where="soort_erkenning_omschrijving='APK Lichte voertuigen'",
    select="kenteken,meld_datum_door_keuringsinstantie,vervaldatum_keuring",
    limit=1000
)
```

## Data Quality Notes

- **Completeness**: Not all vehicles have inspection records (new cars, exports)
- **Timeliness**: Data is updated daily by RDW
- **Accuracy**: Official government data, considered authoritative
- **Coverage**: Only Dutch-registered vehicles

## References

- [RDW Open Data Portal](https://opendata.rdw.nl/)
- [Socrata SODA API Docs](https://dev.socrata.com/)
