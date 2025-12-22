# Todo

## Parquet-based Data Pipeline (feature/parquet-pipeline branch)

- [x] Figure out how to do incremental data downloads for all datasets
  - [x] Datasets with date fields: use Socrata SoQL `$where` filtering
  - [x] Datasets without date fields (brandstof): full download with merge using primary keys
  - [x] Fix column name normalization for merge compatibility
- [ ] Verify incremental downloads locally (parquet files are located in `data/duckdb/`)
  - [x] Test first run (full download) - works with normalized column names
  - [x] Test subsequent runs (incremental with date filter) - works for gebreken
  - [ ] Test merge logic when new records exist (needs real new data)
  - [x] Test empty result handling - correctly keeps existing data
- [ ] Verify in GitHub Actions pipeline
  - [ ] Test full downloads work on first run (current run in progress)
  - [ ] Test incremental mode is triggered on cache hit
  - [ ] Test data processing works with parquet input
- [ ] Verify GitHub Actions cache works for compressed parquet files
  - [ ] Confirm cache save after download
  - [ ] Confirm cache restore on subsequent runs
  - [ ] Verify cache key strategy (week-based)
- [x] Review `scripts/data_duckdb_export.py` for optimization opportunities
- [ ] Update data processing to use parquet files
  - [ ] Test `data_process.py` locally with parquet input from `data/duckdb/`
  - [ ] Verify output matches expected format in `data/processed/`
  - [ ] Update GitHub Actions to use parquet files in processing stage
- [x] Fix voertuigen parquet export schema mismatch during union/concat

> **Note**: First run after code update needs full download to create parquet files with 
> normalized column names (snake_case). Subsequent incremental runs will work correctly.

## Dynamic Defect Filtering Feature

**Requirement**: Users must be able to filter/select defect types and see reliability metrics dynamically recalculated for all brands and models.

- [x] Backend: Generate per-defect breakdown data
  - [x] Call `defect_breakdown_build()` in `data_process.py`
  - [x] Save `brand_defect_breakdown.json` (133KB) with defect counts per brand
  - [x] Save `model_defect_breakdown.json` (914KB) with defect counts per model
  - [x] Save `defect_codes.json` (55KB) with defect descriptions
  - [x] Add `total_vehicle_years` to each brand/model for client-side calculation
- [x] Frontend: Add defect filter UI component
  - [x] Multi-select interface for defect types (1005 unique codes)
  - [x] Preset filters: "Reliability only" (default), "All defects", "Custom"
  - [x] Search/filter within defect list
  - [x] Expandable panel with checkboxes for custom selection
- [x] Frontend: Dynamic metric recalculation
  - [x] Load defect breakdown data via React context
  - [x] Recalculate `defects_per_vehicle_year` when filter changes
  - [x] Update rankings in real-time on homepage, brands, and models pages
  - [x] Persist user's custom selection in localStorage
- [x] Update TypeScript types for new data structures
- [x] Verify JSON file sizes remain reasonable (~1.1 MB total uncompressed)

