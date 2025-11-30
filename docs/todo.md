# Code Simplification TODO

This document tracks proposals to reduce complexity and simplify the codebase.

## 1. Generic Parallel Fetch Helper (High Impact)

**Status:** COMPLETED

**Problem:** The old `fetch_pipeline.py` and `fetch_single.py` had nearly identical parallel fetching logic repeated 4-5 times each (~8 times total).

**Solution:** Extracted into `parallel_fetch()` and `parallel_fetch_to_writer()` in `rdw_client.py`. Consolidated both scripts into a single `download.py` with `--stream`/`--no-stream` and `--all` flags.

**Result:** 
- Removed `fetch_pipeline.py` (294 lines)
- Removed `fetch_single.py` (218 lines)  
- Added `download.py` (280 lines) - unified, cleaner interface
- Added ~100 lines to `rdw_client.py` for helpers
- **Net reduction: ~130 lines**

---

## 2. Consolidate Brand/Model Calculation (High Impact)

**Status:** Not Started

**Problem:** `calculate_defects_by_brand` and `calculate_defects_by_model` in `process_data.py` are 95% identical (lines 83-180 and 190-280). The only difference is the groupby keys.

**Solution:** Create a single `calculate_defects_by_group()` function:

```python
def calculate_defects_by_group(
    vehicles: pd.DataFrame, 
    defects: pd.DataFrame,
    inspections: pd.DataFrame | None,
    group_cols: list[str],  # ["merk"] or ["merk", "handelsbenaming"]
    min_count: int = 50
) -> pd.DataFrame:
```

**Impact:** Eliminate ~90 lines of duplicate code.

---

## 3. Remove fetch_pipeline.py

**Status:** COMPLETED (merged with item 1)

Both `fetch_pipeline.py` and `fetch_single.py` were consolidated into a single `download.py` script with:

- `python download.py <dataset>` - fetch single dataset (streaming by default)
- `python download.py --all` - fetch all datasets 
- `--stream` / `--no-stream` flags to control memory vs disk mode

---

## 4. Progress Tracker Helper

**Status:** Not Started

**Problem:** Progress logging pattern is repeated everywhere:

```python
if completed % max(1, total // 10) == 0 or completed == total:
    log(f"  Progress: {completed}/{total} ({completed * 100 // total}%)")
```

**Solution:** Create a progress context manager:

```python
class ProgressTracker:
    def __init__(self, total, description="items"):
        self.total = total
        self.completed = 0
    
    def tick(self):
        self.completed += 1
        if self.completed % max(1, self.total // 10) == 0:
            log(f"  Progress: {self.completed}/{self.total}")
```

**Impact:** Reduce ~30 lines across multiple files.

---

## 5. Use Dataclasses for Dataset Config

**Status:** Not Started

**Problem:** Nested dict in `fetch_for_kentekens` is hard to maintain.

**Solution:** Replace with dataclass:

```python
@dataclass
class DatasetConfig:
    select: str | None = None
    extra_where: str = ""
    limit_mult: int = 1

DATASET_CONFIGS = {
    "vehicles": DatasetConfig(
        select="kenteken,merk,...",
        extra_where=" AND voertuigsoort='Personenauto'"
    ),
    ...
}
```

**Impact:** Improved type safety and readability.

---

## 6. Remove Dead/Unused Code

**Status:** Not Started

**Items:**
- `test_streaming_csv.py` in `src/` - should be in a `tests/` folder or removed
- The `least_reliable` key in `model_reliability.json` output is never used by `app.js`

---

## Summary - Potential Line Reduction

| Change | Lines Removed | Files Affected |
|--------|--------------|----------------|
| Generic parallel fetch helper | ~150 | fetch_pipeline.py, fetch_single.py |
| Consolidate brand/model calculation | ~90 | process_data.py |
| Remove fetch_pipeline.py | ~324 | fetch_pipeline.py |
| Progress tracker helper | ~30 | multiple |
| **Total** | **~600 lines** | |
