# RDW Inspection History Window

Date: 2026-05-02

## Context

After downloading all RDW source data to `data/parquet`, the local files showed inspection and defect dates starting at `20220602` instead of covering all historical APK years.

## Finding

The limitation comes from RDW Open Data source availability, not from `scripts/data_download.py`.

`scripts/api_client.py` uses:

- `https://opendata.rdw.nl/resource/{id}.json?$select=count(*)`
- `https://opendata.rdw.nl/resource/{id}.json?$limit={limit}&$offset={offset}`

There is no date predicate in the downloader unless a separate optional filter is added elsewhere.

Live RDW API checks on 2026-05-02:

```text
sgfe-77wx earliest meld_datum_door_keuringsinstantie: 20220602
sgfe-77wx latest meld_datum_door_keuringsinstantie: 20260501
a34c-vvps earliest meld_datum_door_keuringsinstantie: 20220602
a34c-vvps latest meld_datum_door_keuringsinstantie: 20260501
sgfe-77wx rows before 20220602: 0
a34c-vvps rows before 20220602: 0
```

RDW `vkij-7mwc` (`Open Data RDW: Keuringen`) has older APK expiry dates per license plate, but its metadata describes it as the expiry date of the latest APK per license plate. It does not provide historical inspection events or per-inspection defects.

## Commands

```bash
curl -s --get 'https://opendata.rdw.nl/resource/sgfe-77wx.json' \
  --data-urlencode '$select=meld_datum_door_keuringsinstantie' \
  --data-urlencode '$order=meld_datum_door_keuringsinstantie ASC' \
  --data-urlencode '$limit=1'

curl -s --get 'https://opendata.rdw.nl/resource/a34c-vvps.json' \
  --data-urlencode '$select=meld_datum_door_keuringsinstantie' \
  --data-urlencode '$order=meld_datum_door_keuringsinstantie ASC' \
  --data-urlencode '$limit=1'

curl -s --get 'https://opendata.rdw.nl/resource/sgfe-77wx.json' \
  --data-urlencode '$select=count(*)' \
  --data-urlencode '$where=meld_datum_door_keuringsinstantie < 20220602'

curl -s --get 'https://opendata.rdw.nl/resource/a34c-vvps.json' \
  --data-urlencode '$select=count(*)' \
  --data-urlencode '$where=meld_datum_door_keuringsinstantie < 20220602'
```

## External Checks

- Data.overheid lists `sgfe-77wx` as the public RDW `Meldingen Keuringsinstantie` dataset.
- Data.overheid lists `a34c-vvps` as the public RDW `Geconstateerde Gebreken` dataset.
- Data.overheid lists `vkij-7mwc` as `Open Data RDW: Keuringen`, with the description "Gegevens set met per kenteken de vervaldatum van de laatst uitgevoerde APK."
- A Kenteken.TV March 2023 analysis mentions using RDW APK open data from 2021, 2022, and 2023, which supports that older rows existed publicly in the past and were later removed from the current rolling window.

## Impact

Statistics based on `sgfe-77wx` and `a34c-vvps` can only cover the inspection-event history currently exposed by RDW. Older detailed APK event and defect data would require an external historical archive, a prior private snapshot, or direct RDW access.
