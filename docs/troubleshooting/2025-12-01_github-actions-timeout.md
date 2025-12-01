# GitHub Actions Timeout After 2 Hours

**Date:** 2025-12-01
**Status:** CONFIRMED - Hitting 2-hour job timeout
**Issue:** Workflow gets cancelled after exactly 2 hours during data download

## Latest Status (2025-12-01)

**Run #47** (commit `27d6999` - "ci: set default sample percentage to 100%"):
- Duration: **2h 0m 21s** (hit timeout exactly)
- Error: `The job has exceeded the maximum execution time of 2h0m0s`
- Status: Cancelled

**Run #46** (commit `897368c` - "feat: add resume support"):
- Duration: **25m 25s**
- Status: Success (using cached 10% data)

The 100% sample is too large to complete within the 2-hour GitHub Actions job timeout, even with resume support enabled.

## Symptoms

- GitHub Actions job is cancelled mid-download
- Error annotation: "The job has exceeded the maximum execution time of 2h0m0s"
- Happens consistently at exactly 2 hours
- RAM usage was observed climbing (10.6GB / 15.6GB at 29% progress)

## Root Cause Analysis

**Confirmed Root Cause:** The 100% sample (~24.7M inspection records) cannot be downloaded within the 2-hour job timeout, even with:
- Reduced page sizes (10,000 records)
- Chunked processing
- Resume support

The RDW API rate and volume means full dataset requires more than 2 hours of continuous downloading.

### GitHub Actions Limits
- **Job timeout:** 2 hours (hard limit for free tier)
- **Workflow timeout:** 6 hours (but our job timeout applies)
- **Runner RAM:** 16GB (Ubuntu runners)

## Workflow Run History (Nov 30 - Dec 1)

| Run | Commit | Duration | Status | Notes |
|-----|--------|----------|--------|-------|
| #47 | `27d6999` | 2h 0m 21s | Cancelled | 100% sample - hit timeout |
| #46 | `897368c` | 25m 25s | Success | Used cached 10% data |
| #45 | `b796376` | 11m 56s | Cancelled | Manual cancellation |
| #44 | `b5413f7` | 29m 49s | Success | 10% sample |
| #43 | `0f9ad89` | 3m 0s | Cancelled | Manual cancellation |
| #42 | `217d203` | 11m 3s | Cancelled | Manual cancellation |
| #41-35 | various | 6-26m | Failed | Various issues during development |

## Changes Made

### 1. Reduced Memory Usage (2025-11-30)
- Reduced page size from 50,000 to 10,000 records per request
- Added chunked processing (max 20 concurrent items in memory)
- Commit: `b5413f7`

### 2. Added Resume Support (2025-11-30)
- Downloads now detect existing partial files and resume from where they left off
- `.complete` marker file indicates successful completion
- Partial downloads are cached for next run
- Commit: `897368c`

### 3. Workflow Changes (2025-11-30)
- Reordered downloads: smallest first (defect_codes -> inspections -> vehicles -> fuel -> defects_found)
- Added `continue-on-error: true` to prevent one failure from blocking others
- Cache includes both CSV and `.complete` marker
- Partial downloads are cached on failure for resume
- Commit: `b796376`, `897368c`

### 4. Default Sample Changed to 100% (2025-11-30)
- Changed default from 10% to 100% for production runs
- Commit: `27d6999`
- **Result:** This triggered the 2-hour timeout issue

## Current Workflow Behavior

1. Restore cached data (including partial downloads)
2. Check `.complete` markers to skip finished datasets
3. Fetch/resume incomplete datasets
4. Save cache immediately after each successful download
5. Save partial cache on failure (for resume on next run)
6. Verify all datasets available before processing

## Why Resume Support Doesn't Fully Solve This

The resume support works for **network interruptions** but has limitations with the 2-hour timeout:

1. **Cache key changes weekly** - Partial downloads are only resumed within the same week
2. **Script hash in cache key** - Any code change invalidates existing cache
3. **Timeout is before cache save** - When the job is killed at 2h, the "Save partial" step never runs
4. **No automatic re-trigger** - Workflow doesn't automatically restart after timeout

## Recommended Solutions

### Option A: Use 10% Sample for Push Events (RECOMMENDED)
Keep 100% sample for scheduled weekly runs, use 10% for push events:
```yaml
SAMPLE="${{ inputs.sample_percent || (github.event_name == 'schedule' && '100' || '10') }}"
```
This is already implemented in PR #1.

### Option B: Split Into Multiple Workflow Runs
Use workflow_call or repository_dispatch to chain multiple 2-hour jobs.

### Option C: Use Larger Runners (Paid)
GitHub-hosted larger runners have higher timeout limits (up to 6 hours).

### Option D: External Processing
Run the data fetching on a separate server (e.g., Azure, AWS) and commit results.

## Immediate Action Required

The workflow is currently configured with 100% as default. To fix:

1. **Merge PR #1** - Implements conditional sample percentage
2. **OR** - Manually change default back to 10%

## Related Files

- `.github/workflows/update.yml` - Workflow definition
- `src/download.py` - Download script with resume support
- `docs/architecture.md` - Architecture documentation

## Monitoring

Check GitHub Actions logs for:
- `Resuming: found X existing records` - indicates resume is working
- `Skipping N completed pages` - confirms pages are being skipped
- `[STATS] RAM: X/15.6GB` - monitor memory usage
- `.complete` marker in cache status

## Fix Applied (2025-12-01)

### Change: Conditional Sample Percentage Based on Event Type

Updated `.github/workflows/update.yml` to use different sample percentages:
- **push events:** 10% sample (fast CI, avoids timeout)
- **schedule events:** 100% sample (weekly full refresh)
- **workflow_dispatch:** User-selected percentage

```yaml
if [ -n "${{ inputs.sample_percent }}" ]; then
  SAMPLE="${{ inputs.sample_percent }}"
elif [ "${{ github.event_name }}" = "schedule" ]; then
  SAMPLE="100"
else
  SAMPLE="10"
fi
```

### Expected Outcome
- Push events will complete in ~25-30 minutes (10% sample)
- Weekly scheduled runs may still timeout, but that's acceptable for now
- Manual runs can specify any sample percentage

### Next Steps
1. Commit and push this fix
2. Monitor the triggered workflow run
3. Update this document with results

---

## Verification (2025-12-01 15:43 UTC)

**Run #48** triggered after fix commit `faa191c`:
- Status: In Progress
- Event: push
- Expected Sample: 10% (due to fix)
- Expected Duration: ~25-30 minutes

Will monitor this run to confirm the fix resolves the timeout issue for push events.
