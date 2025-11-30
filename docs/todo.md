# Code Simplification Opportunities

Analysis of the codebase identified the following opportunities to reduce complexity, nesting, and code duplication.

## High Priority

### 1. Extract Duplicate Inspection ID Logic in `process_data.py`

**Location:** `calculate_defects_by_brand()` and `calculate_defects_by_model()` (lines ~85-180 and ~200-310)

**Issue:** Both functions duplicate the same pattern:

- Create `inspection_id` from `kenteken + meld_datum_door_keuringsinstantie`
- Convert `aantal_gebreken_geconstateerd` to numeric
- Group by inspection to get defect stats
- Merge with vehicles
- Calculate pass rates from inspections data

**Suggestion:** Extract a shared `prepare_inspection_stats()` function that handles the common data preparation. The brand/model functions would then only handle the aggregation logic specific to their grouping level.

```python
# Before: ~120 lines duplicated across two functions
# After: One ~60-line helper + two ~40-line aggregation functions
```

### 2. Simplify Pass Rate Calculation Block

**Location:** `process_data.py`, lines ~145-170 and ~260-285

**Issue:** The pass rate calculation logic is deeply nested (4+ levels) and repeated twice. Each block:

1. Copies inspections dataframe
2. Creates inspection_id
3. Merges with vehicles
4. Groups by brand/model
5. Merges back with stats
6. Calculates pass rate

**Suggestion:** Create a `calculate_pass_rate()` helper that takes the base stats and groupby columns, reducing ~25 lines to ~5 per call.

### 3. ~~Unify `parallel_fetch` and `parallel_fetch_to_writer`~~ DONE

**Status:** Merged into `items_fetch_parallel()` with `stream_to_disk` boolean. Also merged `rdw_client.py` into `download.py`.

## Medium Priority

### 4. ~~Simplify `fetch_dataset()` Branching in `download.py`~~ DONE

**Status:** Extracted `_kenteken_batches_build()` and `_offset_pages_build()` helpers. Reduced `dataset_fetch()` to ~30 lines.

### 5. Reduce Repetitive Table Rendering in `app.js`

**Location:** `src/templates/app.js`, lines ~95-150 (renderTop10Tables) and ~155-240 (renderBrandTable, renderModelTable)

**Issue:** Four nearly identical table rendering loops for top-10 lists, plus similar logic in brand/model tables. Each differs only in:

- Target element ID
- Data source array
- Column configuration

**Suggestion:** Create a generic `renderTable(elementId, data, columns)` helper:

```javascript
const columns = [
    { key: 'merk', label: 'Brand' },
    { key: 'avg_defects_per_inspection', label: 'Defects/Insp', format: v => formatValue(v, 2) }
];
renderTable('top10-reliable-tbody', top10ReliableModels, columns);
```

### 6. Simplify Sorting Logic in `app.js`

**Location:** `app.js`, lines ~270-295

**Issue:** Brand and model table sorting handlers are nearly identical, differing only in variable names.

**Suggestion:** Create a factory function:

```javascript
function createSortHandler(tableId, sortState) {
    return (th) => {
        const col = th.dataset.col;
        if (sortState.col === col) {
            sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.col = col;
            sortState.dir = 'asc';
        }
        sortState.render();
    };
}
```

## Low Priority

### 7. Consolidate Configuration in `download.py`

**Location:** `download.py`, lines ~45-65

**Issue:** `DATASET_CONFIGS` could include the default kenteken requirement flag, making the kenteken validation in `main()` data-driven rather than hardcoded.

### 8. Simplify Argument Validation in `download.py`

**Location:** `download.py`, lines ~305-345

**Issue:** The streaming mode determination logic could be simplified with early returns or a helper function.

### 9. Use Constants for Magic Numbers

**Location:** Multiple files

**Issue:** Several magic numbers appear without explanation:

- `100` minimum vehicles for brand stats
- `50` minimum vehicles for model stats
- `50000` page size for offset pagination
- `1000` batch size for kenteken queries

**Suggestion:** Define these as named constants at module level with brief comments.

## Coding Standards

### Python Function Naming Convention

All Python functions should follow the `<subject>_<verb>` naming pattern.

**Examples:**

- `dataset_download()` - downloads a dataset
- `metadata_load()` - loads metadata
- `vehicles_enrich()` - enriches vehicle data
- `defects_calculate()` - calculates defects
- `results_save()` - saves results

**Current violations to fix:**

- `load_metadata()` → `metadata_load()`
- `load_data()` → `data_load()`
- `load_kentekens()` → `kentekens_load()`
- `enrich_vehicles()` → `vehicles_enrich()`
- `calculate_defects_by_brand()` → `defects_by_brand_calculate()`
- `calculate_defects_by_model()` → `defects_by_model_calculate()`
- `save_results()` → `results_save()`
- `fetch_dataset()` → `dataset_fetch()`
- `fetch_all()` → `datasets_fetch_all()`
- `generate_site()` → `site_generate()`

## Refactoring Notes

When implementing these changes:

1. Ensure all tests pass after each refactor
2. Keep function signatures backward-compatible where possible
3. Consider adding type hints during refactoring
4. Run the full pipeline locally before committing
