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
times. The first PR 155 checkpoint change moved that repeated plan into one
streaming Parquet write, but a full local rerun reproduced exit 137 while
writing `_inspection_stats.parquet`.

The checkpoint plan still combined primary-inspection reduction, defect-count
aggregation, primary-fuel aggregation, and large joins in a single lazy plan.
That left peak memory high enough for the process to be killed before the first
durable checkpoint completed.

## Fix

Persist the large reductions in smaller stages:

- primary inspection keys
- per-inspection defect counts
- primary fuel per vehicle
- vehicle attributes
- final inspection statistics, partitioned by the first `kenteken` character

Scan the final `data/processed/_inspection_stats` Parquet parts for brand/model
statistics, metadata, and defect breakdowns. Remove all intermediate files and
the partitioned checkpoint directory before uploading processed artifacts.

Keep paired aggregation collection sequential for the largest brand/model
outputs now that the source is checkpointed, and add progress logs before and
after expensive Stage 2 phases. The workflow runs Stage 2 with unbuffered Python
output and lists processed artifact sizes even if the process step fails, so
future failures should show the last completed phase.

## Verification

Local verification first reproduced the failure on the full Parquet datasets:

```bash
cd scripts && uv run python -u data_process.py
```

The process reached `Stage2 phase start: write inspection stats checkpoint` and
was killed with exit code 137. After splitting the checkpoint plan, run:

```bash
cd scripts && uv run python data_process.py
```

The full-data run completed in 76 seconds, wrote the expected processed JSON
files, and removed `data/processed/_inspection_stats` before exit. Additional
checks:

```bash
cd scripts && uv run ruff format --check data_process.py inspection_stats.py stats_aggregate.py defect_build.py
cd scripts && uv run ruff check data_process.py inspection_stats.py stats_aggregate.py defect_build.py
cd scripts && uv run mypy --ignore-missing-imports data_process.py inspection_stats.py stats_aggregate.py defect_build.py
cd scripts && uv run python -m py_compile data_process.py inspection_stats.py stats_aggregate.py defect_build.py fuel_build.py inspection_prepare.py
```
