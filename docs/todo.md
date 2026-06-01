# Todo

- [x] Fix PostCSS security update resolution.

  Requirement: resolve the Dependabot security-update failure for `postcss`
  without downgrading or making a broad Next.js upgrade. The vulnerable path is
  the nested `postcss@8.4.31` dependency installed under `next@16.2.6`; the
  rest of the app already resolves a patched PostCSS version.

  Result: added an npm override so `next@16.2.6` resolves its nested PostCSS
  dependency to `8.5.10`, then regenerated `package-lock.json`. Verified the
  production audit is clean, `npm ls postcss` shows the patched nested version,
  and the web lint and production build pass.

- [x] Fix Dependabot CI failures for generated release notes and ESLint 10.

  Requirement: keep the attribution guard active for human-authored commit and
  PR text, but do not fail Dependabot PRs because generated upstream release
  notes mention blocked tool names. Prevent future ESLint 10 update PRs until
  the current Next lint stack supports that major version without plugin
  crashes.

  Result: changed the PR attribution workflow to scan every PR title, scan
  non-Dependabot PR bodies, and skip only generated Dependabot PR bodies.
  Added a Dependabot ignore rule for major `eslint` updates while keeping
  minor and patch updates eligible. Verified the repo checks and shell-level
  attribution scan behavior locally.

- [x] Fix RDW lookup defect-description query escaping.

  Requirement: escape defect IDs before placing them in the RDW `$where`
  expression used by the license-plate lookup flow, so a quote in
  `gebrek_identificatie` stays inside the string literal instead of changing the
  query. Add focused coverage for quote escaping and verify the web checks.

  Result: added a SoQL string-literal escape helper for defect IDs in
  `vehicle_lookup_use.ts` and an e2e regression that stubs RDW lookup responses
  with a quoted defect ID, then verifies the outgoing description `$where`
  parameter uses doubled quotes. Updated stale e2e expectations for the current
  apkstat.nl UI and pinned e2e language setup to English. Verified with web
  lint, TypeScript, all Playwright e2e tests, and production build.

- [x] Enforce contributor rules via git hooks and CI.

  Requirement: the AI-attribution check (previously local-only) plus other
  mechanically checkable rules (Ruff lint + format, per-file LOC cap, no
  emojis/pictographs, no ASCII decoration) must run both as local git hooks and
  as GitHub Actions checks, using shared scripts so the two never drift.

  Result: added shared `ci/` check scripts (`loc-check.sh`, `charset-check.sh`,
  `attribution-check.sh`, `commit-attribution-check.sh`) invoked identically by the
  `.githooks` hooks and CI; extended `.githooks/pre-commit` to run them and
  to auto-format staged Python with Ruff; consolidated `lint_web.yml` into
  `.github/workflows/checks.yml` (web-lint, python-lint, repo-checks jobs); raised
  the documented LOC cap to 500; and removed pre-existing emoji from
  `cache_validate.py`, `useStatisticsProcessing.ts`, `parquet_pipeline.yml`, and
  the attribution block-list source.

- [x] Add per-brand defect histograms to the statistics page.

  Requirement: show two bar charts on `/statistics`, each with one bar per the X
  most common brands (by vehicle count). Chart 1 height = average defects per
  inspection; chart 2 height = defect-found rate (share of inspections with a
  non-zero defect count).

  Backend: add `inspections_with_defects` (count of inspections with
  `defect_count > 0`) to `aggregate_brand_stats()` in `stats_aggregate.py` so the
  frontend can derive the defect-found rate per brand. Frontend: new reusable
  `brand_chart.tsx` and two new sections in `statistics/page.tsx`; X defined in
  `lib/defaults.ts`.

  Result: added the `inspections_with_defects` aggregation, re-ran Stage 2
  (429 brands), and verified `0 <= inspections_with_defects <= total_inspections`
  for every brand row. Added `brand_chart.tsx`, two consolidated per-brand
  arrays in `page.tsx`, `topBrandsChart: 15` in `defaults.ts`, and EN/NL i18n
  keys. `tsc --noEmit`, `eslint --max-warnings 0`, and `next build` all pass; the
  existing age and trend charts are unchanged.

- [x] Lower meldingen cache validation size threshold.

  Problem: a fresh `sgfe-77wx` download on 2026-05-25 produced a readable
  `meldingen.parquet` with 24,825,567 rows and 11 columns, matching the live
  downloader row count, but Zstd compression produced a 291,698,961 byte file.
  The current 300,000,000 byte cache validation threshold rejects that valid
  file.

  Requirement: lower the `meldingen` minimum cache size enough to keep the
  corruption guard useful without rejecting current valid downloads.

  Result: lowered `MIN_CACHE_SIZES["meldingen"]` to 250,000,000 bytes.
  Verified with `uv run python cache_validate.py ../data/parquet/meldingen.parquet`.

- [x] Fix post-merge Stage 2 pipeline termination.

  Problem: the merged Stage 2 memory fix still failed on the push-to-main run
  for `d56f4b6`. The `process` job reached the `Process data` step, emitted no
  script logs for roughly 45 minutes, then ended with the step still marked
  in progress. A full local rerun of PR 155 then reproduced an exit 137 while
  writing `_inspection_stats.parquet`, before downstream aggregation started.
  The single checkpoint still executed primary-inspection reduction, defect
  aggregation, fuel aggregation, and large joins in one plan.

  Requirement: keep the Stage 2 implementation Polars-native and streaming,
  persist expensive reductions as smaller intermediate Parquet checkpoints,
  then scan the final inspection-stats checkpoint for brand/model, metadata,
  and breakdown aggregations. Add progress checkpoints around each expensive
  step so future CI failures identify the stalled phase.

  Result: split the checkpoint writer into primary-inspection, defect-count,
  primary-fuel, vehicle-attribute, and partitioned final inspection-stats
  checkpoints. Switched brand/model paired aggregations back to sequential
  collection now that the source is checkpointed. Full local Stage 2 completed
  against the real Parquet inputs in 76 seconds, wrote all processed JSON files,
  and removed `data/processed/_inspection_stats` before exit.

- [x] Fix scheduled Stage 2 pipeline memory failure.

  Problem: scheduled `Data Pipeline (Parquet)` runs fail in the `process` job
  while computing inspection statistics. The step reaches
  `Computing inspection statistics...`, then the GitHub-hosted runner receives
  a shutdown signal. The last green process run logged roughly 15 GB RSS, so
  the current full inspection DataFrame materialization is too close to the
  standard runner limit.

  Requirement: keep Stage 2 Polars-native and avoid collecting the full joined
  inspection dataset. Aggregate brand/model stats, metadata totals, and defect
  breakdown inputs from lazy plans or smaller aggregated frames.

  Result: moved inspection-level joins into a reusable lazy plan, changed
  brand/model aggregation and metadata summaries to collect only aggregated
  frames, and updated defect breakdowns to join against the lazy inspection
  keys. Replaced the primary-inspection global sort with a grouped earliest-time
  join to reduce peak memory pressure. Verified with Ruff, py_compile,
  `mypy --ignore-missing-imports`, and a synthetic Stage 2 Parquet run.

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
