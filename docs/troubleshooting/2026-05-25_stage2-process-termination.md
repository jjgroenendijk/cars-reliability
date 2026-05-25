# Stage 2 Process Termination After Merge

## Symptom

The `Data Pipeline (Parquet)` workflow failed on the push-to-main run for merge
commit `d56f4b6`. The failing job was `process`; all dataset download jobs
completed successfully and the process job restored all five Parquet caches.

The `Process data` step started at `2026-05-24T13:37:41Z`, produced no script
output, and the job completed as failed at `2026-05-24T14:23:27Z` with that step
still reported as in progress. No Python traceback or explicit shell exit code
was recorded.

## Cause

The prior fix removed eager full DataFrame collection, but downstream Stage 2
aggregations still reused the same expensive inspection-level lazy plan many
times. On the hosted runner this left the first visible Stage 2 checkpoint too
late and allowed the process to be terminated without a useful phase-specific
failure log.

## Fix

Persist the inspection-level lazy plan once to `data/processed/_inspection_stats.parquet`
with Polars streaming `sink_parquet`, then scan that intermediate file for
brand/model statistics, metadata, and defect breakdowns. Remove the intermediate
file before uploading processed artifacts.

Also collect paired aggregations with `pl.collect_all(...)` where two outputs
share the same lazy source, and add progress logs before and after expensive
Stage 2 phases. The workflow runs Stage 2 with unbuffered Python output and
lists processed artifact sizes even if the process step fails, so future
failures should show the last completed phase.

## Verification

Local verification used synthetic Parquet inputs for all five RDW datasets and
ran:

```bash
cd scripts && uv run python data_process.py
```

The run completed, wrote the expected processed JSON files, and removed
`data/processed/_inspection_stats.parquet` before exit. Additional checks:

```bash
cd scripts && uv run ruff format --check data_process.py inspection_stats.py stats_aggregate.py defect_build.py
cd scripts && uv run ruff check data_process.py inspection_stats.py stats_aggregate.py defect_build.py
cd scripts && uv run mypy --ignore-missing-imports data_process.py inspection_stats.py stats_aggregate.py defect_build.py
cd scripts && uv run python -m py_compile data_process.py inspection_stats.py stats_aggregate.py defect_build.py fuel_build.py inspection_prepare.py
```
