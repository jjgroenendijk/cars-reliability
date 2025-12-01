# GitHub Actions Timeout After 2 Hours

**Date:** 2025-12-01  
**Status:** In Progress  
**Issue:** Workflow gets cancelled after ~2 hours during data download

## Symptoms

- GitHub Actions job is cancelled mid-download
- No explicit error message - just "cancelled"
- Happens consistently around the 2-hour mark
- RAM usage was climbing (observed 10.6GB / 15.6GB at 29% progress)

## Root Cause Analysis

GitHub Actions has a **6-hour job timeout** by default, but the job was being cancelled earlier. Possible causes:

1. **Memory exhaustion** - Runner has 16GB RAM, downloads were consuming too much
2. **Concurrency settings** - `cancel-in-progress: false` is set, but another workflow might interfere
3. **GitHub infrastructure** - Possible resource limits on free tier runners

## Changes Made

### 1. Reduced Memory Usage (2025-11-30)
- Reduced page size from 50,000 to 10,000 records per API request
- Added chunked processing (max 20 concurrent items in memory)
- Commit: `b5413f7`

### 2. Added Resume Support (2025-11-30)
- Downloads now detect existing partial files and resume from where they left off
- `.complete` marker file indicates successful completion
- Partial downloads are cached for next run
- Commit: `897368c`

### 3. Workflow Changes (2025-11-30)
- Reordered downloads: smallest first (defect_codes → inspections → vehicles → fuel → defects_found)
- Added `continue-on-error: true` to prevent one failure from blocking others
- Cache includes both CSV and `.complete` marker
- Partial downloads are cached on failure for resume
- Commit: `b796376`, `897368c`

## Current Workflow Behavior

1. Restore cached data (including partial downloads)
2. Check `.complete` markers to skip finished datasets
3. Fetch/resume incomplete datasets
4. Save cache immediately after each successful download
5. Save partial cache on failure (for resume on next run)
6. Verify all datasets available before processing

## Expected Resolution

With resume support, the full 100% dataset should complete across multiple workflow runs:

- **Run 1:** Downloads inspections (partial) → times out → caches partial
- **Run 2:** Restores partial → resumes inspections → completes → downloads vehicles (partial) → times out
- **Run 3:** Restores completed inspections + partial vehicles → resumes → continues...
- **Eventually:** All datasets complete, site is built and deployed

## Monitoring

Check GitHub Actions logs for:
- `Resuming: found X existing records` - indicates resume is working
- `Skipping N completed pages` - confirms pages are being skipped
- `[STATS] RAM: X/15.6GB` - monitor memory usage
- `.complete` marker in cache status

## Related Files

- `.github/workflows/update.yml` - Workflow definition
- `src/download.py` - Download script with resume support
- `docs/architecture.md` - Architecture documentation

## Next Steps if Issue Persists

1. Reduce sample percentage temporarily (10% or 50%)
2. Consider splitting into multiple workflow jobs
3. Investigate GitHub Actions larger runners (paid)
4. Add more aggressive memory cleanup between datasets
