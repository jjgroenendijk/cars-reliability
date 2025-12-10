# Data Mapping

> RDW field names and their meanings for the Dutch Car Reliability project.

Verification: columns verified against live RDW metadata (`https://opendata.rdw.nl/api/views/<dataset-id>`) on 2025-12-10 using a Python fetch (`urllib.request` with `$limit=metadata`). If a new field appears in RDW, update this file immediately.

## Design Principle

All field names from RDW datasets are preserved as-is throughout the pipeline. We do not rename Dutch fields to English equivalents. Keep this document updated whenever new RDW fields are used so it remains the single source of truth for field names.

---

## RDW Datasets

Date filtering: when `INSPECTION_DAYS_LIMIT` is set, Stage 1 adds `meld_datum_door_keuringsinstantie >= <YYYYMMDD>` to both `sgfe-77wx` and `a34c-vvps` queries.

Current raw snapshot: `data/raw/meldingen_keuringsinstantie.json` and `data/raw/geconstateerde_gebreken.json` were downloaded in aggregated form and only contain per-`kenteken` counts. They lack inspection dates and defect identifiers and must be re-downloaded with the full fields below before Stage 2 can be rerun.

### Gekentekende Voertuigen (`m9d7-ebf2`)

Vehicle registration data. Stage 1 filters to `voertuigsoort='Personenauto'` and currently downloads the subset `kenteken`, `merk`, `handelsbenaming`, `datum_eerste_toelating`. The dataset exposes the full column set below.

Full column list (RDW metadata, 2025-12-10):

| Field | RDW label / description |
|-------|-------------------------|
| `kenteken` | RDW label: Kenteken |
| `voertuigsoort` | RDW label: Voertuigsoort |
| `merk` | RDW label: Merk |
| `handelsbenaming` | RDW label: Handelsbenaming |
| `vervaldatum_apk` | RDW label: Vervaldatum APK |
| `datum_tenaamstelling` | RDW label: Datum tenaamstelling |
| `bruto_bpm` | RDW label: Bruto BPM |
| `inrichting` | RDW label: Inrichting |
| `aantal_zitplaatsen` | RDW label: Aantal zitplaatsen |
| `eerste_kleur` | RDW label: Eerste kleur |
| `tweede_kleur` | RDW label: Tweede kleur |
| `aantal_cilinders` | RDW label: Aantal cilinders |
| `cilinderinhoud` | RDW label: Cilinderinhoud |
| `massa_ledig_voertuig` | RDW label: Massa ledig voertuig |
| `toegestane_maximum_massa_voertuig` | RDW label: Toegestane maximum massa voertuig |
| `massa_rijklaar` | RDW label: Massa rijklaar |
| `maximum_massa_trekken_ongeremd` | RDW label: Maximum massa trekken ongeremd |
| `maximum_trekken_massa_geremd` | RDW label: Maximum trekken massa geremd |
| `datum_eerste_toelating` | RDW label: Datum eerste toelating |
| `datum_eerste_tenaamstelling_in_nederland` | RDW label: Datum eerste tenaamstelling in Nederland |
| `wacht_op_keuren` | RDW label: Wacht op keuren |
| `catalogusprijs` | RDW label: Catalogusprijs |
| `wam_verzekerd` | RDW label: WAM verzekerd |
| `maximale_constructiesnelheid` | RDW label: Maximale constructiesnelheid |
| `laadvermogen` | RDW label: Laadvermogen |
| `oplegger_geremd` | RDW label: Oplegger geremd |
| `aanhangwagen_autonoom_geremd` | RDW label: Aanhangwagen autonoom geremd |
| `aanhangwagen_middenas_geremd` | RDW label: Aanhangwagen middenas geremd |
| `aantal_staanplaatsen` | RDW label: Aantal staanplaatsen |
| `aantal_deuren` | RDW label: Aantal deuren |
| `aantal_wielen` | RDW label: Aantal wielen |
| `afstand_hart_koppeling_tot_achterzijde_voertuig` | RDW label: Afstand hart koppeling tot achterzijde voertuig |
| `afstand_voorzijde_voertuig_tot_hart_koppeling` | RDW label: Afstand voorzijde voertuig tot hart koppeling |
| `afwijkende_maximum_snelheid` | RDW label: Afwijkende maximum snelheid |
| `lengte` | RDW label: Lengte |
| `breedte` | RDW label: Breedte |
| `europese_voertuigcategorie` | RDW label: Europese voertuigcategorie |
| `europese_voertuigcategorie_toevoeging` | RDW label: Europese voertuigcategorie toevoeging |
| `europese_uitvoeringcategorie_toevoeging` | RDW label: Europese uitvoeringcategorie toevoeging |
| `plaats_chassisnummer` | RDW label: Plaats chassisnummer |
| `technische_max_massa_voertuig` | RDW label: Technische max. massa voertuig |
| `type` | RDW label: Type |
| `type_gasinstallatie` | RDW label: Type gasinstallatie |
| `typegoedkeuringsnummer` | RDW label: Typegoedkeuringsnummer |
| `variant` | RDW label: Variant |
| `uitvoering` | RDW label: Uitvoering |
| `volgnummer_wijziging_eu_typegoedkeuring` | RDW label: Volgnummer wijziging EU typegoedkeuring |
| `vermogen_massarijklaar` | RDW label: Vermogen massarijklaar |
| `wielbasis` | RDW label: Wielbasis |
| `export_indicator` | RDW label: Export indicator |
| `openstaande_terugroepactie_indicator` | RDW label: Openstaande terugroepactie indicator |
| `vervaldatum_tachograaf` | RDW label: Vervaldatum tachograaf |
| `taxi_indicator` | RDW label: Taxi indicator |
| `maximum_massa_samenstelling` | RDW label: Maximum massa samenstelling |
| `aantal_rolstoelplaatsen` | RDW label: Aantal rolstoelplaatsen |
| `maximum_ondersteunende_snelheid` | RDW label: Maximum ondersteunende snelheid |
| `jaar_laatste_registratie_tellerstand` | RDW label: Jaar laatste registratie tellerstand |
| `tellerstandoordeel` | RDW label: Tellerstandoordeel |
| `code_toelichting_tellerstandoordeel` | RDW label: Code toelichting tellerstandoordeel |
| `tenaamstellen_mogelijk` | RDW label: Tenaamstellen mogelijk |
| `vervaldatum_apk_dt` | RDW label: Vervaldatum APK DT |
| `datum_tenaamstelling_dt` | RDW label: Datum tenaamstelling DT |
| `datum_eerste_toelating_dt` | RDW label: Datum eerste toelating DT |
| `datum_eerste_tenaamstelling_in_nederland_dt` | RDW label: Datum eerste tenaamstelling in Nederland DT |
| `vervaldatum_tachograaf_dt` | RDW label: Vervaldatum tachograaf DT |
| `maximum_last_onder_de_vooras_sen_tezamen_koppeling` | RDW label: Maximum last onder de vooras(sen) (tezamen)/koppeling |
| `type_remsysteem_voertuig_code` | RDW label: Type remsysteem voertuig code |
| `rupsonderstelconfiguratiecode` | RDW label: Rupsonderstelconfiguratiecode |
| `wielbasis_voertuig_minimum` | RDW label: Wielbasis voertuig minimum |
| `wielbasis_voertuig_maximum` | RDW label: Wielbasis voertuig maximum |
| `lengte_voertuig_minimum` | RDW label: Lengte voertuig minimum |
| `lengte_voertuig_maximum` | RDW label: Lengte voertuig maximum |
| `breedte_voertuig_minimum` | RDW label: Breedte voertuig minimum |
| `breedte_voertuig_maximum` | RDW label: Breedte voertuig maximum |
| `hoogte_voertuig` | RDW label: Hoogte voertuig |
| `hoogte_voertuig_minimum` | RDW label: Hoogte voertuig minimum |
| `hoogte_voertuig_maximum` | RDW label: Hoogte voertuig maximum |
| `massa_bedrijfsklaar_minimaal` | RDW label: Massa bedrijfsklaar minimaal |
| `massa_bedrijfsklaar_maximaal` | RDW label: Massa bedrijfsklaar maximaal |
| `technisch_toelaatbaar_massa_koppelpunt` | RDW label: Technisch toelaatbaar massa koppelpunt |
| `maximum_massa_technisch_maximaal` | RDW label: Maximum massa technisch maximaal |
| `maximum_massa_technisch_minimaal` | RDW label: Maximum massa technisch minimaal |
| `subcategorie_nederland` | RDW label: Subcategorie Nederland |
| `verticale_belasting_koppelpunt_getrokken_voertuig` | RDW label: Verticale belasting koppelpunt getrokken voertuig |
| `zuinigheidsclassificatie` | RDW label: Zuinigheidsclassificatie |
| `registratie_datum_goedkeuring_afschrijvingsmoment_bpm` | RDW label: Registratie datum goedkeuring (afschrijvingsmoment BPM) |
| `registratie_datum_goedkeuring_afschrijvingsmoment_bpm_dt` | RDW label: Registratie datum goedkeuring (afschrijvingsmoment BPM) DT |
| `gem_lading_wrde` | RDW label: Gemiddelde Lading Waarde |
| `aerodyn_voorz` | RDW label: Aerodynamische voorziening of uitrusting |
| `massa_alt_aandr` | RDW label: Additionele massa alternatieve aandrijving |
| `verl_cab_ind` | RDW label: Verlengde cabine indicator |
| `aantal_passagiers_zitplaatsen_wettelijk` | RDW label: Aantal passagiers zitplaatsen wettelijk |
| `aanwijzingsnummer` | RDW label: Aanwijzingsnummer |
| `api_gekentekende_voertuigen_assen` | RDW label: API Gekentekende_voertuigen_assen |
| `api_gekentekende_voertuigen_brandstof` | RDW label: API Gekentekende_voertuigen_brandstof |
| `api_gekentekende_voertuigen_carrosserie` | RDW label: API Gekentekende_voertuigen_carrosserie |
| `api_gekentekende_voertuigen_carrosserie_specifiek` | RDW label: API Gekentekende_voertuigen_carrosserie_specifiek |
| `api_gekentekende_voertuigen_voertuigklasse` | RDW label: API Gekentekende_voertuigen_voertuigklasse |

### Meldingen Keuringsinstantie (`sgfe-77wx`)

APK inspection reports (one row per inspection). Used to compute vehicle age at inspection date for age buckets. The dataset does not expose a `herstel_indicator`; a reliable re-inspection flag still needs to be identified. Current raw snapshot only includes `kenteken` and `inspection_count`.

Recommended Stage 1 query: `$select=kenteken,meld_datum_door_keuringsinstantie,meld_tijd_door_keuringsinstantie,soort_melding_ki_omschrijving,soort_erkenning_keuringsinstantie,soort_erkenning_omschrijving,vervaldatum_keuring&$order=kenteken`

Full column list (RDW metadata, 2025-12-10):

| Field | RDW label / description |
|-------|-------------------------|
| `kenteken` | RDW label: Kenteken |
| `soort_erkenning_keuringsinstantie` | RDW label: Soort erkenning keuringsinstantie |
| `meld_datum_door_keuringsinstantie` | RDW label: Meld datum door keuringsinstantie |
| `meld_tijd_door_keuringsinstantie` | RDW label: Meld tijd door keuringsinstantie |
| `soort_erkenning_omschrijving` | RDW label: Soort erkenning omschrijving |
| `soort_melding_ki_omschrijving` | RDW label: Soort melding ki omschrijving |
| `vervaldatum_keuring` | RDW label: Vervaldatum keuring |
| `meld_datum_door_keuringsinstantie_dt` | RDW label: Meld datum door keuringsinstantie DT |
| `vervaldatum_keuring_dt` | RDW label: Vervaldatum keuring DT |
| `api_gebrek_constateringen` | RDW label: API Gebrek constateringen |
| `api_gebrek_beschrijving` | RDW label: API Gebrek beschrijving |

### Geconstateerde Gebreken (`a34c-vvps`)

Detected defects during inspections (multiple rows possible per inspection). Stage 2 aggregates `aantal_gebreken_geconstateerd` per `(kenteken, meld_datum_door_keuringsinstantie)` and defaults non-numeric values to `1`. Severity weighting from `hx2c-gt7k` is not applied yet (all defects weight 1.0). Current raw snapshot only includes `kenteken` and aggregated `defect_count`.

Recommended Stage 1 query: `$select=kenteken,meld_datum_door_keuringsinstantie,meld_tijd_door_keuringsinstantie,gebrek_identificatie,aantal_gebreken_geconstateerd,soort_erkenning_keuringsinstantie,soort_erkenning_omschrijving&$order=kenteken`

Full column list (RDW metadata, 2025-12-10):

| Field | RDW label / description |
|-------|-------------------------|
| `kenteken` | RDW label: Kenteken |
| `soort_erkenning_keuringsinstantie` | RDW label: Soort erkenning keuringsinstantie |
| `meld_datum_door_keuringsinstantie` | RDW label: Meld datum door keuringsinstantie |
| `meld_tijd_door_keuringsinstantie` | RDW label: Meld tijd door keuringsinstantie |
| `gebrek_identificatie` | RDW label: Gebrek identificatie |
| `soort_erkenning_omschrijving` | RDW label: Soort erkenning omschrijving |
| `aantal_gebreken_geconstateerd` | RDW label: Aantal gebreken geconstateerd |
| `meld_datum_door_keuringsinstantie_dt` | RDW label: Meld datum door keuringsinstantie DT |

### Gebreken (`hx2c-gt7k`)

Defect code reference table (used later for human-readable descriptions and potential severity weighting).

Full column list (RDW metadata, 2025-12-10):

| Field | RDW label / description |
|-------|-------------------------|
| `gebrek_identificatie` | RDW label: Gebrek identificatie |
| `ingangsdatum_gebrek` | RDW label: Ingangsdatum gebrek |
| `einddatum_gebrek` | RDW label: Einddatum gebrek |
| `gebrek_paragraaf_nummer` | RDW label: Gebrek paragraaf nummer |
| `gebrek_artikel_nummer` | RDW label: Gebrek artikel nummer |
| `gebrek_omschrijving` | RDW label: Gebrek omschrijving |
| `ingangsdatum_gebrek_dt` | RDW label: Ingangsdatum gebrek DT |
| `einddatum_gebrek_dt` | RDW label: Einddatum gebrek DT |

### Brandstof (`8ys7-d773`)

Fuel type and emissions data for vehicles. Stage 1 currently downloads `kenteken` and `brandstof_omschrijving`; additional emissions fields are available below.

Full column list (RDW metadata, 2025-12-10):

| Field | RDW label / description |
|-------|-------------------------|
| `kenteken` | RDW label: Kenteken - The license plate uniquely identifies the vehicle. |
| `brandstof_volgnummer` | RDW label: Brandstof volgnummer - Ordering key for multiple fuels. |
| `brandstof_omschrijving` | RDW label: Brandstof omschrijving |
| `brandstofverbruik_buiten` | RDW label: Brandstofverbruik buiten de stad - Fuel consumption outside city (l/100 km). |
| `brandstofverbruik_gecombineerd` | RDW label: Brandstofverbruik gecombineerd - Combined fuel consumption (l/100 km). |
| `brandstofverbruik_stad` | RDW label: Brandstofverbruik stad - Urban fuel consumption (l/100 km). |
| `co2_uitstoot_gecombineerd` | RDW label: CO2 uitstoot gecombineerd - Weighted CO2 for plug-in hybrid combined cycle. |
| `co2_uitstoot_gewogen` | RDW label: CO2 uitstoot gewogen - Weighted CO2 for externally charged hybrids. |
| `geluidsniveau_rijdend` | RDW label: Geluidsniveau rijdend - Drive-by noise level dB(A). |
| `geluidsniveau_stationair` | RDW label: Geluidsniveau stationair - Stationary noise level dB(A). |
| `emissiecode_omschrijving` | RDW label: Emissieklasse |
| `milieuklasse_eg_goedkeuring_licht` | RDW label: Milieuklasse EG Goedkeuring (licht) |
| `milieuklasse_eg_goedkeuring_zwaar` | RDW label: Milieuklasse EG Goedkeuring (zwaar) |
| `uitstoot_deeltjes_licht` | RDW label: Uitstoot deeltjes (licht) - Particle emission (g/km). |
| `uitstoot_deeltjes_zwaar` | RDW label: Uitstoot deeltjes (zwaar) - Particle emission for heavy engines (g/kWh). |
| `nettomaximumvermogen` | RDW label: Nettomaximumvermogen - ICE max power (kW). |
| `nominaal_continu_maximumvermogen` | RDW label: Nominaal continu maximumvermogen - Electric motor continuous power (kW). |
| `roetuitstoot` | RDW label: Roetuitstoot - Soot output (k-value). |
| `toerental_geluidsniveau` | RDW label: Toerental geluidsniveau - RPM during stationary noise test. |
| `emis_deeltjes_type1_wltp` | RDW label: Emissie deeltjes type1 wltp - WLTP particle mass. |
| `emissie_co2_gecombineerd_wltp` | RDW label: Emissie co2 gecombineerd wltp - WLTP CO2 combined. |
| `emis_co2_gewogen_gecombineerd_wltp` | RDW label: Emissie co2 gewogen gecombineerd wltp - WLTP weighted CO2 combined. |
| `brandstof_verbruik_gecombineerd_wltp` | RDW label: Brandstof verbruik gecombineerd wltp - WLTP fuel consumption combined. |
| `brandstof_verbruik_gewogen_gecombineerd_wltp` | RDW label: Brandstof verbruik gewogen gecombineerd wltp - WLTP weighted fuel consumption combined. |
| `elektrisch_verbruik_enkel_elektrisch_wltp` | RDW label: Elektrisch verbruik enkel elektrisch wltp - WLTP electric consumption (BEV). |
| `actie_radius_enkel_elektrisch_wltp` | RDW label: Actie radius enkel elektrisch wltp - WLTP range (BEV). |
| `actie_radius_enkel_elektrisch_stad_wltp` | RDW label: Actie radius enkel elektrisch stad wltp - WLTP city range (BEV). |
| `elektrisch_verbruik_extern_opladen_wltp` | RDW label: Elektrisch verbruik extern opladen wltp - WLTP electric consumption (PHEV). |
| `actie_radius_extern_opladen_wltp` | RDW label: Actie radius extern opladen wltp - WLTP electric range (PHEV). |
| `actie_radius_extern_opladen_stad_wltp` | RDW label: Actie radius extern opladen stad wltp - WLTP city electric range (PHEV). |
| `max_vermogen_15_minuten` | RDW label: Max vermogen 15 minuten - Continuous electric power over 15 minutes. |
| `max_vermogen_60_minuten` | RDW label: Max vermogen 60 minuten - Continuous electric power over 60 minutes. |
| `netto_max_vermogen_elektrisch` | RDW label: Netto max vermogen elektrisch |
| `klasse_hybride_elektrisch_voertuig` | RDW label: Klasse hybride elektrisch voertuig - Hybrid class (OVC-HEV/NOVC-HEV/OVC-FCHV/NOVC-FCHV). |
| `opgegeven_maximum_snelheid` | RDW label: Opgegeven maximum snelheid |
| `uitlaatemissieniveau` | RDW label: Uitlaatemissieniveau |
| `co2_emissieklasse` | RDW label: CO2 emissieklasse |

---

## Live Query Fields (License Plate Lookup)

The lookup page queries RDW APIs directly from the browser. Fields below are the desired UI mappings; the API column names are identical to the RDW names listed above.

### Vehicle Details (from `m9d7-ebf2`)

| Field | Type | UI Label | Description |
|-------|------|----------|-------------|
| `kenteken` | string | License Plate | License plate number |
| `merk` | string | Brand | Vehicle brand |
| `handelsbenaming` | string | Model | Vehicle model name |
| `datum_eerste_toelating` | string | First Registration | First registration date (YYYYMMDD) |
| `datum_tenaamstelling` | string | Registration Date | Current owner registration date (YYYYMMDD) |
| `vervaldatum_apk` | string | APK Expiry Date | APK expiry date (YYYYMMDD) |
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
| `meld_tijd_door_keuringsinstantie` | string | Time | Inspection time (HHMM) |
| `soort_melding_ki_omschrijving` | string | Result | Inspection result (e.g., periodieke controle) |
| `soort_erkenning_keuringsinstantie` | string | Station Type Code | RDW station code |
| `soort_erkenning_omschrijving` | string | Station Type Description | Human-readable station type |
| `vervaldatum_keuring` | string | Valid Through | Inspection validity date (YYYYMMDD) |

Mileage (`km_stand`) is not provided by this dataset.

### Defects Found (from `a34c-vvps`)

| Field | Type | UI Label | Description |
|-------|------|----------|-------------|
| `kenteken` | string | - | License plate (query filter) |
| `meld_datum_door_keuringsinstantie` | string | - | Inspection date (used to group defects by inspection) |
| `meld_tijd_door_keuringsinstantie` | string | - | Inspection time (HHMM) |
| `gebrek_identificatie` | string | Defect Code | Defect identifier code |
| `aantal_gebreken_geconstateerd` | string | Count | Number of this defect type found |
| `soort_erkenning_keuringsinstantie` | string | Station Type Code | RDW station code |
| `soort_erkenning_omschrijving` | string | Station Type Description | Human-readable station type |

### Defect Descriptions (from `hx2c-gt7k`)

| Field | Type | UI Label | Description |
|-------|------|----------|-------------|
| `gebrek_identificatie` | string | - | Defect code (used for join) |
| `gebrek_omschrijving` | string | Description | Human-readable defect description (Dutch) |

### Fuel Details (from `8ys7-d773`)

| Field | Type | UI Label | Description |
|-------|------|----------|-------------|
| `kenteken` | string | - | License plate (query filter) |
| `brandstof_omschrijving` | string | Fuel Type | Fuel description (e.g., Benzine, Diesel, Elektriciteit) |
| `brandstof_volgnummer` | string | Fuel Index | Ordering key for multiple fuels |
| `emissiecode_omschrijving` | string | Emission Class | RDW emission classification |
| `nettomaximumvermogen` | string | Engine Power | ICE maximum power (kW) |
| `nominaal_continu_maximumvermogen` | string | Electric Power | Electric continuous power (kW) |
| `co2_uitstoot_gecombineerd` | string | CO2 Combined | Weighted CO2 for plug-in hybrid |
| `emissie_co2_gecombineerd_wltp` | string | CO2 WLTP | WLTP CO2 combined |
| `brandstof_verbruik_gecombineerd_wltp` | string | Fuel WLTP | WLTP fuel consumption combined |
| `elektrisch_verbruik_enkel_elektrisch_wltp` | string | EV Consumption WLTP | WLTP electric consumption (BEV) |
| `actie_radius_enkel_elektrisch_wltp` | string | EV Range WLTP | WLTP range (BEV) |

---

## Processed Data Output

The pipeline produces JSON files in `data/processed/` using the following structures. Only vehicles with at least one inspection are included. Brand stats require at least 100 vehicles; model stats require at least 50. Age brackets are derived from inspection events: each inspection is assigned to a bracket using the vehicle age on `meld_datum_door_keuringsinstantie`, and `vehicle_count` counts vehicles with at least one inspection in that bracket. Bracket entries are `null` when fewer than 30 vehicles fall into the bracket or when no inspections are present. Fuel breakdown counts vehicles per `brandstof_omschrijving` value (multi-fuel vehicles increment each applicable type, with unrecognized types mapped to `other`). Defect totals sum `aantal_gebreken_geconstateerd` per inspection with a flat weight of 1.0.

Current processed files in `data/processed/` were generated from an earlier per-inspection download and cannot be reproduced from the aggregated raw snapshot.

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
    "8_12": null,
    "13_20": null,
    "5_15": null
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
