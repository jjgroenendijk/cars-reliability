# Todo

- [x] Fix incomplete Dutch website translations.

  Problem: selecting Dutch leaves multiple visible UI strings in English.
  Audit page and component copy, move missing strings through the existing i18n
  translation layer, and verify the Dutch locale renders translated text.

  Result: added missing translation keys for shared controls and page copy,
  localized the data, statistics, defects, fuels, and lookup UI, persisted the
  selected language, and split i18n/page components to keep files under 400 LOC.
  Verified with `npx tsc --noEmit` and `npm run build`; `npm run lint` is still
  blocked by the tracked ESLint 10 / eslint-config-next React plugin crash.

- [ ] Fix direct RDW CSV-to-Parquet downloads for GitHub Actions.

  Requirement: final output must be one physical Parquet file per dataset.
  Stream each RDW CSV shard into `BytesIO`, convert that buffer directly to a
  temporary shard Parquet file, then merge those shard files into the final
  single Parquet file. Avoid intermediate CSV temp files. Keep the existing
  non-overlapping `kenteken` sharding so downloads do not use unstable offset
  pagination.

  Also verify the parquet workflow cache restore keys match the exact keys saved
  by the matrix download job, so the process job can restore all dataset artifacts
  after the download job completes. Do not restore older same-week caches after
  downloader code changes, because that can keep using the previous single-file
  Parquet output and skip the new direct conversion path.

  Local verification:
  - `hx2c-gt7k` downloaded successfully through the direct `BytesIO` path to a
    single `data/parquet/gebreken.parquet` file.
  - `cache_validate.py` rejects Parquet directories and only accepts single-file
    Parquet outputs.
  - A header-only RDW CSV shard converts to a valid zero-row Parquet part.

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
