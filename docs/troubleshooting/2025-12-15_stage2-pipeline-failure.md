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

## Resolution

(To be filled in after verification)
