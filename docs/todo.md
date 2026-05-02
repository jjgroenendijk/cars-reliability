# Todo

- [x] Fix RDW download duplicates and verify rebuilt Parquet files.

  Problem: the current `data/parquet/meldingen.parquet` contains many exact duplicate
  full rows. Local checks found 24,883,259 rows but only 16,035,779 unique full rows,
  meaning 8,847,480 extra duplicate rows. A sampled row that appeared 7 times locally
  existed only once when queried directly from RDW, so the bulk duplicates are not
  inspection business semantics.

  Important: this does not look like simple append behavior. The local
  `meldingen.parquet` row count matched the live RDW `sgfe-77wx` count
  (24,883,259). If previous runs had appended to the same Parquet file, the local row
  count should exceed the RDW count. The more likely failure mode is duplicate rows
  plus missing rows caused by unstable pagination.

  Suspected root cause: `scripts/data_download.py` historically downloaded RDW pages
  with parallel `$limit` / `$offset` requests through `scripts/api_client.py`, without
  a deterministic `$order`. Socrata/RDW offset pagination is not stable without an
  order, so parallel pages can overlap and skip rows while still producing the expected
  total row count.

  Constraints for the fix:
  - Do not use unordered offset pagination for full dataset downloads.
  - A single CSV export avoids offset overlap but was slow for GitHub Actions. Prefer
    a bounded-memory, parallel-safe strategy such as non-overlapping `kenteken` ranges,
    with per-shard CSV/Parquet files merged by Polars.
  - Keep RDW column names exactly as provided.
  - Keep all raw fields as strings unless the downstream pipeline explicitly converts
    them.
  - Ensure `scripts/data_download.py` stays under the 400 LOC cap.

  Verification required:
  - Rebuild at least `sgfe-77wx` (`meldingen`) and `a34c-vvps`
    (`geconstateerde_gebreken`) locally.
  - Confirm each rebuilt Parquet row count equals `row_count_get()` for the RDW
    dataset.
  - Confirm `meldingen.parquet` exact full-row duplicates drop dramatically. Some
    same-plate/same-date/same-time records are legitimate when columns like
    `soort_erkenning_keuringsinstantie` differ, but millions of exact full-row
    duplicates are not.
  - Query a previously duplicated sample such as kenteken `2KZB19`,
    `meld_datum_door_keuringsinstantie='20250724'`,
    `meld_tijd_door_keuringsinstantie='1308'`; it should no longer appear 7 times
    locally if RDW still reports one matching row.

  Result: fixed Stage 1 downloads to use streamed CSV exports split into
  non-overlapping `kenteken` prefix shards, with no unordered offset pagination.
  Rebuilt `meldingen.parquet` and `geconstateerde_gebreken.parquet` locally.
  Verification against live RDW counts on 2026-05-02:
  - `meldingen`: 24,883,259 local rows, 24,883,259 RDW rows.
  - `geconstateerde_gebreken`: 24,657,443 local rows, 24,657,443 RDW rows.
  - `meldingen` exact full-row duplicates: 0.
  - Sample `2KZB19` / `20250724` / `1308`: 1 local row, 1 RDW row.

- [x] Rename current statistics table page to Data and add a new aggregate Statistics page.

- [x] Remove redundant statistics page pagination/source footer elements.
- [x] Fix statistics rankings average age display and numeric header alignment.

- [x] Defer heavy table filtering while dragging selection sliders (price/age/fleet/inspections) to reduce jitter.

- [x] Ensure standard deviation display is paired with the base value in-table for both Defects / Inspection and Defects / Year, styled distinctly (color or font), using separate columns.

- [x] Set default age filter to 4-30 years using frontend defaults in `web/app/lib/defaults.ts`.

- [x] Filter homepage top 10 brands by minimum fleet size of 2000 using frontend defaults.

- [x] Fix inspections slider max to use metadata-derived max inspections.
- [x] Fix statistics page view toggle so switching from models back to brands updates URL and state.
- [x] Split long statistics column headers to multiple lines and reduce header text size for standard deviation columns.
- [x] Fix homepage top 10 brand rankings missing entries; add regression test coverage.
- [x] Start developing frontend tests (homepage coverage and key flows).
- [x] Fix homepage top 10 links to statistics views and add e2e coverage for those buttons.
- [x] Stabilize homepage and statistics e2e selectors for navigation and filters.
- [x] Fix site build failure caused by unsupported Lucide GitHub icon import.
- [x] Optimize RDW page downloads and Parquet batch writes.
- [ ] Fix ESLint 10 incompatibility with eslint-config-next React plugin.
- [ ] Rebranded website to apkstat.nl with APK Statistieken focus.
