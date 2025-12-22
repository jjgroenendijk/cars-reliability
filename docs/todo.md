# Todo

## Parquet-Only Data Pipeline

- [x] Migrate to parquet-only data loading (no JSON fallback)
- [x] Delete dead code: `data_export.py`, `data_download.py` (~627 LOC)
- [x] Delete old workflow: `pipeline.yml`
- [x] Update `inspection_prepare.py` with `data_load()` function
- [ ] Verify GitHub Actions pipeline on main branch
  - [ ] Test cache save/restore works
  - [ ] Verify data processing with parquet input
- [ ] Test incremental downloads with `--incremental` flag

## Code Quality

- [ ] Split `data_process.py` (442 LOC > 400 LOC limit)
  - Move `defect_breakdown_build()` to `defect_aggregate.py`
  - Move `vehicle_summaries_build()` to new file
- [ ] Consider consolidating `rdw_api.py` utilities shared with `data_duckdb_export.py`

## Dynamic Defect Filtering Feature

- [x] Backend: Generate per-defect breakdown data
- [x] Frontend: Add defect filter UI component
- [x] Frontend: Dynamic metric recalculation
- [x] Update TypeScript types for new data structures
- [x] Verify JSON file sizes remain reasonable (~1.1 MB total uncompressed)
