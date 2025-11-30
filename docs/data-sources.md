# Data Sources

All data comes from [RDW Open Data](https://opendata.rdw.nl/), the official Dutch vehicle authority's open data portal.

## Datasets Used

### 1. Geconstateerde Gebreken (Defects Found)

| Property | Value |
|----------|-------|
| Dataset ID | `a34c-vvps` |
| URL | [opendata.rdw.nl/Keuringen/Open-Data-RDW-Geconstateerde-Gebreken/a34c-vvps](https://opendata.rdw.nl/Keuringen/Open-Data-RDW-Geconstateerde-Gebreken/a34c-vvps) |
| Update Frequency | Daily |
| License | CC0 (Public Domain) |

**Key columns:**
- `kenteken` - License plate number
- `meld_datum_door_keuringsinstantie` - Inspection date
- `gebrek_identificatie` - Defect code
- `aantal_gebreken_geconstateerd` - Number of defects found

This is our primary dataset. Each row represents a defect found during an APK (MOT) inspection.

### 2. Gekentekende Voertuigen (Registered Vehicles)

| Property | Value |
|----------|-------|
| Dataset ID | `m9d7-ebf2` |
| URL | [opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen/m9d7-ebf2](https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen/m9d7-ebf2) |
| Update Frequency | Daily |
| License | CC0 (Public Domain) |

**Key columns:**
- `kenteken` - License plate number
- `merk` - Brand (e.g., VOLKSWAGEN, TOYOTA)
- `handelsbenaming` - Model name (e.g., GOLF, YARIS)
- `voertuigsoort` - Vehicle type (we filter for "Personenauto")
- `datum_eerste_toelating` - First registration date

We use this to enrich defect records with brand/model information.

### 3. Gebreken (Defect Codes)

| Property | Value |
|----------|-------|
| Dataset ID | `hx2c-gt7k` |
| URL | [opendata.rdw.nl/Keuringen/Open-Data-RDW-Gebreken/hx2c-gt7k](https://opendata.rdw.nl/Keuringen/Open-Data-RDW-Gebreken/hx2c-gt7k) |
| License | CC0 (Public Domain) |

**Key columns:**
- `gebrek_identificatie` - Defect code
- `gebrek_omschrijving` - Human-readable description

Reference table for defect codes. Currently fetched but not actively used in the MVP.

### 4. Brandstof (Fuel)

| Property | Value |
|----------|-------|
| Dataset ID | `8ys7-d773` |
| URL | [opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen_brandstof/8ys7-d773](https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen_brandstof/8ys7-d773) |
| Update Frequency | Daily |
| License | CC0 (Public Domain) |

**Key columns:**

- `kenteken` - License plate number
- `brandstof_volgnummer` - Fuel sequence (1 = primary, 2 = secondary for hybrids)
- `brandstof_omschrijving` - Fuel type (Benzine, Diesel, Elektriciteit, etc.)
- `uitlaatemissieniveau` - Emission standard (Euro 5, Euro 6, etc.)

Used to enrich vehicle data with fuel type information. We filter for `brandstof_volgnummer='1'` to get the primary fuel only.

## API Access

RDW uses the Socrata SODA API. No authentication is required, but rate limits apply.

### Example Query

```python
from sodapy import Socrata

client = Socrata("opendata.rdw.nl", None)

# Get 1000 defect records
results = client.get("a34c-vvps", limit=1000)
```

### SoQL Queries

The API supports SoQL (Socrata Query Language):

```python
# Get passenger cars only
results = client.get(
    "m9d7-ebf2",
    where="voertuigsoort='Personenauto'",
    select="kenteken,merk,handelsbenaming",
    limit=1000
)
```

## Data Quality Notes

- **Completeness**: Not all vehicles have inspection records (new cars, exports, etc.)
- **Timeliness**: Data is updated daily by RDW
- **Accuracy**: Official government data, considered authoritative
- **Coverage**: Only Dutch-registered vehicles

## Related Datasets (Not Yet Used)

These could enhance future analysis:

| Dataset | ID | Potential Use |
|---------|-----|---------------|
| Keuringsresultaten | (TBD) | APK pass/fail rates |
| Terugroepacties | (recalls) | Recall frequency |

## References

- [RDW Open Data Portal](https://opendata.rdw.nl/)
- [Dataset Documentation (PDF)](https://www.rdw.nl/over-rdw/dienstverlening/open-data/handleidingen)
- [Socrata SODA API Docs](https://dev.socrata.com/)
