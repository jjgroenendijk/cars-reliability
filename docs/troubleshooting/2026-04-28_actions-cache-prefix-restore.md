# Actions Cache Prefix Restore

**Date:** 2026-04-28
**Status:** Fixed

## Problem

The parquet pipeline redownloaded large RDW datasets after pushes and PR merges. Multiple main-branch runs on 2026-04-28 were canceled while download jobs were still running, so the largest datasets did not always reach the cache-save step before the next run started.

## Root Cause

The download job only ran cache validation when `actions/cache/restore` reported `cache-hit == 'true'`. GitHub Actions sets `cache-hit` to `true` only for an exact primary-key match. When a cache is restored through `restore-keys`, `cache-hit` is not true even though the parquet file is present on disk.

Because the workflow includes the `data_download.py` hash in the primary cache key, a script change can make the current weekly cache a prefix match instead of an exact match. The restored parquet file was then ignored, validation was skipped, and the job started a full RDW download.

The workflow also used `cancel-in-progress: true` for the whole parquet pipeline. When several pushes or PR merges arrived close together, GitHub Actions canceled the active run before all dataset jobs finished and saved their caches. The next run then had to download any unsaved datasets again.

## Fix

Validate the parquet file after every non-forced cache restore attempt. The validator already handles missing files, undersized files, empty parquet files, and unreadable parquet files. A valid restored cache now skips the download whether it came from the exact key or from a restore-key prefix match.

Set `cancel-in-progress: false` for the parquet pipeline concurrency group. GitHub Actions will let the active expensive run finish and save dataset caches, while newer pushes remain pending behind it.

## Verification

The 2026-04-28 pipeline run showed restored cache steps followed by skipped validation and full download steps for several datasets. The run history also showed several main-branch pushes canceled within minutes of each other. After the workflow change, a restore-key match should run `cache_validate.py`; if validation succeeds, `Download dataset` should be skipped. New pushes should no longer cancel an active parquet pipeline before cache save steps can complete.
