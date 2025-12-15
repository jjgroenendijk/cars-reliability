# Stage 2 Pipeline Failure

Date: 2025-12-15
Status: In Progress

## Symptoms

- Stage 2 - Data Processing workflow failing since December 14
- Error messages observed:
  - "Cache service responded with 400"
  - "The operation was canceled"
- Multiple consecutive failures: Runs #34, #35, #36 all failed
- Stage 1 completes successfully, but Stage 2 fails
- Last successful run: December 10, 2025 (Run #33)

## Investigation

### Workflow Run Analysis

Examined failed runs:
- Run #36: Failed after 1m 41s
- Run #35: Failed after 1m 43s  
- Run #34: Failed after 1m 36s

The "Run data processing script" step runs for ~57 seconds before failure.

### Root Cause Analysis

Found two critical issues in `.github/workflows/data_process.yml`:

#### Issue 1: Missing requirements.txt

Stage 2 workflow uses:
```yaml
- name: Install dependencies
  run: |
    python -m pip install --upgrade pip
    pip install -r requirements.txt
```

But there is no `requirements.txt` file in the repository. Stage 1 uses `uv` for dependency management with `scripts/pyproject.toml` and `scripts/uv.lock`.

#### Issue 2: Cache Key Mismatch

Stage 2 tries to restore cache with key `raw-data-v2-{week}`:
```yaml
- name: Restore raw data from cache
  uses: actions/cache/restore@v4
  with:
    path: data/raw
    key: raw-data-v2-${{ steps.cache-key.outputs.week }}
```

But Stage 1 caches individual datasets with different keys:
- `gekentekende_voertuigen-v2-{week}-days-{days}`
- `meldingen_keuringsinstantie-v2-{week}-days-{days}`
- `geconstateerde_gebreken-v2-{week}-days-{days}`
- etc.

Stage 1 does not create a combined `raw-data-v2-{week}` cache. It only uploads artifacts.

### Why it worked before

Previously Stage 2 likely succeeded because:
1. It ran immediately after Stage 1 (via workflow_run trigger)
2. The artifact download fallback worked: `Download raw data artifact (fallback)` step
3. But the cache restore fails with 400 error now

The error "Cache service responded with 400" occurs because the cache key doesn't exist.

## Fix

Update `.github/workflows/data_process.yml` to:
1. Use `uv` for dependency management (consistent with Stage 1)
2. Remove the broken cache restore step (rely on artifact download from Stage 1)
3. Handle both workflow_run and workflow_dispatch triggers properly

## Changes Made

Updated `.github/workflows/data_process.yml`:

1. Replaced pip with uv for dependency management (matches Stage 1):
   - Added `astral-sh/setup-uv@v4` action
   - Changed `pip install -r requirements.txt` to `cd scripts && uv sync --frozen`
   - Changed `python scripts/data_process.py` to `cd scripts && uv run python data_process.py`

2. Fixed cache key mismatch:
   - Removed the broken `raw-data-v2-{week}` cache restore step
   - For `workflow_run` trigger: Downloads artifact directly from Stage 1
   - For `workflow_dispatch` trigger: Restores individual dataset caches with correct keys matching Stage 1

3. Added cache key calculation for INSPECTION_DAYS_LIMIT:
   - Now uses same cache key pattern as Stage 1

4. Added verification step to ensure all raw data files are present before processing

5. Removed processed data cache save (unnecessary, artifacts are sufficient)

## Continued Investigation

After deploying fix commit `4ac28b5`, Stage 2 #37 still failed.

Analysis of Stage 2 #37:
- Stage 1 #37 completed successfully with all artifacts (raw-data: 340 MB)
- Stage 2 #37 used our updated workflow (confirmed by "Install uv" step present)
- Steps executed:
  - Download raw data artifact: 19s (success)
  - Run data processing script: 51s
  - Upload processed data artifact: 0s
- Error messages:
  - "Cache service responded with 400" (warning, not error - from skipped cache restore steps)
  - "The operation was canceled"

Root cause found: Concurrency group conflict!

All three stages (Stage 1, 2, 3) used the same concurrency group pattern `pipeline-${{ github.ref }}` with `cancel-in-progress: true`. This means:
1. Stage 1 #37 completes, triggers Stage 2 #37
2. Stage 1 #38 starts (triggered by commit `66a03c9`)
3. Since Stage 1 #38 and Stage 2 #37 share the same concurrency group `pipeline-refs/heads/main`, GitHub Actions cancels Stage 2 #37 to allow Stage 1 #38 to run

This explains why Stage 2 kept getting "The operation was canceled" - it was being terminated by new Stage 1 runs.

## Resolution

Fixed by giving each stage its own concurrency group (commit pending):

1. Stage 1: `stage1-${{ github.ref }}`
2. Stage 2: `stage2-${{ github.event.workflow_run.head_branch || github.ref }}`
3. Stage 3: `stage3-${{ github.event.workflow_run.head_branch }}`

This allows each stage to cancel only its own duplicate runs, not runs from other stages.

Files modified:
- `.github/workflows/data_download.yml`: Changed concurrency group from `pipeline-` to `stage1-`
- `.github/workflows/data_process.yml`: Changed concurrency group from `pipeline-` to `stage2-`
- `.github/workflows/website_build.yml`: Changed concurrency group from `pipeline-` to `stage3-`
