# GitHub Actions Timeout After 2 Hours

**Date:** 2025-12-01  
**Status:** RESOLVED  
**Resolution:** Query RDW API directly instead of downloading full datasets

## Problem Statement

The inspections dataset contains ~24.7 million records. At current download speeds (~3,400 records/second via Socrata API), this takes approximately **2+ hours** to download, exceeding GitHub Actions' **2-hour job timeout**.

### Original Constraints
- GitHub Actions job timeout: **2 hours** (hard limit, free tier)
- Inspections dataset: ~24.7M records
- Current download rate: ~3,400 records/second
- Required time at current rate: ~2h 1m (just over the limit)

### Additional Constraint Discovered
- **GitHub Pages size limit: 1GB** - Even if we could download the full dataset, the processed JSON files would exceed GitHub Pages hosting limits.

## Solution Implemented (2025-12-02)

Instead of downloading full datasets, we now:

1. **Query API aggregates directly** in the pipeline (`src/query_rdw.py`)
   - Fetches defect counts grouped by kenteken (~100K records)
   - Fetches inspection counts grouped by kenteken (~100K records)  
   - Fetches vehicle info only for kentekens with data (~180K lookups)
   - Total runtime: ~5-10 minutes (well within GitHub Actions limits)

2. **Live browser queries** for individual vehicle lookup (`kenteken-lookup.html`)
   - No server-side processing needed
   - Real-time data from RDW API

### Files Changed

**Removed:**
- `src/download.py` - Full dataset download (obsolete)
- `src/process_data.py` - CSV processing (obsolete)
- `.github/workflows/download.yml` - Parallel download workflow (obsolete)
- `.github/workflows/process.yml` - Data processing workflow (obsolete)
- `.github/workflows/website.yml` - Separate deploy workflow (obsolete)

**Added/Updated:**
- `src/query_rdw.py` - Direct API queries with SoQL aggregation
- `src/templates/kenteken-lookup.html` - Live vehicle lookup page
- `.github/workflows/update.yml` - Single workflow: query + generate + deploy

### Why This Works

1. **No App Token Required**: Socrata API allows unauthenticated requests. App tokens only provide higher rate limits.
   - Without token: Rate limited by IP address (shared pool)
   - With token: Rate limited per application (higher limits)
   - For a website with individual users making occasional queries, IP-based throttling is fine.

2. **CORS Supported**: Socrata APIs support CORS and JSONP, allowing direct browser requests.

3. **SoQL Aggregation**: The API supports server-side aggregation queries, so we can compute metrics without downloading raw data:
   ```sql
   -- Example: Count defects by brand
   SELECT merk, COUNT(*) as total_defects
   WHERE voertuigsoort='Personenauto'
   GROUP BY merk
   ORDER BY total_defects DESC
   LIMIT 100
   ```

### API Endpoints

| Dataset | ID | Description |
|---------|----|----|
| Vehicles | `m9d7-ebf2` | Gekentekende voertuigen |
| Defects Found | `a34c-vvps` | Geconstateerde Gebreken |
| Defect Codes | `hx2c-gt7k` | Gebreken (reference table) |
| Inspections | `sgfe-77wx` | Meldingen Keuringsinstantie |
| Fuel | `8ys7-d773` | Brandstof data |

Base URL: `https://opendata.rdw.nl/resource/{dataset_id}.json`

### Implementation Plan

1. **Static reference data only**: Pre-download small reference tables (defect codes) that don't change.

2. **On-demand aggregation**: Use SoQL to compute metrics server-side:
   - Brand reliability: Aggregate defects by brand
   - Model reliability: Aggregate defects by brand + model
   - User can filter by year range, fuel type, etc.

3. **Caching strategy**:
   - Browser caches API responses
   - Consider service worker for offline support
   - API responses are typically cached by CDN

4. **Progressive loading**:
   - Show loading states while queries run
   - Load brands first, then details on-demand
   - Paginate large result sets

### Trade-offs

| Aspect | Static JSON (old) | Live API (new) |
|--------|-------------------|----------------|
| Initial load | Fast (cached JSON) | Slower (API call) |
| Data freshness | Weekly updates | Real-time |
| Hosting size | Large (exceeds 1GB) | Tiny (just HTML/JS) |
| CI complexity | High (download, process) | Low (just deploy) |
| Offline support | Full | Limited |
| Rate limits | None | Per-IP throttling |

### Risk Mitigation

- **Rate limiting**: Users querying from same IP might hit limits. Mitigation: cache results, batch queries.
- **API availability**: If RDW API is down, site is down. Mitigation: graceful error handling, cached fallback.
- **Query complexity**: Some metrics require joins across datasets. Mitigation: use SoQL subqueries or multiple requests.

### Critical Limitation: No Cross-Dataset Joins

The Socrata API **does not support joins between datasets**. This is a significant limitation because:

- **Defects dataset** (`a34c-vvps`) has `kenteken` but **no brand/model info**
- **Vehicles dataset** (`m9d7-ebf2`) has `kenteken`, `merk`, `handelsbenaming`
- To calculate "defects per brand", we need to join these datasets

**Workaround Options:**

1. **Client-side join**: Fetch vehicles for a brand, then query defects for those kentekens
   - Problem: Too many kentekens to fit in a single IN clause
   - Requires pagination and multiple requests

2. **Pre-compute brand->kenteken mapping**: Store a compact lookup file
   - ~10M vehicles = ~100MB compressed lookup
   - Still large but manageable

3. **Hybrid approach**: 
   - Pre-compute aggregated statistics (current approach, but need 100% sample)
   - Use live API only for drill-down queries (specific vehicle lookup)

4. **Request RDW to publish a joined dataset**:
   - Contact RDW Open Data team
   - They may already have or could create a pre-joined view

### Revised Assessment

Given the cross-dataset join limitation, the **live API approach is NOT suitable** for computing brand/model reliability metrics directly. 

**Current status of output files:**
- `site/` folder is only **132KB** (aggregated JSON, not raw data)
- GitHub Pages 1GB limit is **not an issue** for the output
- The problem is purely the **download time** in CI

**Recommended path forward:**
1. Keep the current pre-processing approach (output is tiny)
2. Fix the CI timeout using matrix parallelization (Solution 1 from archived section)
3. Consider live API queries only for future features (e.g., individual vehicle lookup)

### Implemented: Hybrid Approach (2025-12-01)

We implemented the hybrid approach:

1. **Static pre-computed data** (pipeline):
   - Top 10 most reliable brands
   - Top 10 least reliable brands
   - Top 10 most reliable models
   - Top 10 least reliable models
   - Full brand/model tables for browsing

2. **Live API queries** (new page):
   - `kenteken-lookup.html` - Individual vehicle inspection history
   - Queries RDW API directly from browser (no app token needed)
   - Fetches: vehicle info, inspection history, defects with descriptions

**Files changed:**
- `src/templates/kenteken-lookup.html` - New modular page for live lookups
- `src/templates/index.html` - Added navigation link to kenteken lookup
- `src/generate_site.py` - Copies new template to site/

**API endpoints used in live lookup:**
- Vehicle info: `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken={kenteken}`
- Inspections: `https://opendata.rdw.nl/resource/sgfe-77wx.json?kenteken={kenteken}`
- Defects: `https://opendata.rdw.nl/resource/a34c-vvps.json?kenteken={kenteken}`
- Defect codes: `https://opendata.rdw.nl/resource/hx2c-gt7k.json` (cached)

---

## Previous Approach (Archived)

The solutions below attempted to solve the download timeout issue. They are still relevant since the live API approach has limitations.

## Solution Analysis

### Solution 1: Matrix Strategy - Parallel Jobs by Data Partition

**Concept:** Split the download into multiple parallel jobs, each fetching a portion of the data based on kenteken prefix (e.g., 0-9, A-Z).

**Implementation:**
```yaml
jobs:
  download:
    strategy:
      matrix:
        partition: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
                    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
                    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
                    'U', 'V', 'W', 'X', 'Y', 'Z']
    steps:
      - run: python src/download.py inspections --partition ${{ matrix.partition }}
  
  merge:
    needs: download
    steps:
      - run: cat data/inspections_*.csv > data/inspections.csv
```

**Pros:**
- Each job runs independently (parallelism)
- ~36 jobs, each handling ~3% of data (~700K records, ~3-4 minutes)
- Total wall-clock time: ~10-15 minutes
- Native GitHub Actions feature

**Cons:**
- Need to merge results afterward
- Cache handling becomes complex (36 separate caches)
- Artifact upload/download overhead
- May hit concurrent job limits (20 for free tier)

**Feasibility:** HIGH - This is the most promising approach

---

### Solution 2: Chunked Download with Auto-Retry Workflow

**Concept:** Download in chunks, cache progress, and automatically re-trigger workflow until complete.

**Implementation:**
```yaml
- name: Download chunk
  run: |
    # Download for 1h 45m max, then save progress
    timeout 6300 python src/download.py inspections --resume || true
    
- name: Check completion
  id: check
  run: |
    if [ -f data/inspections.complete ]; then
      echo "complete=true" >> $GITHUB_OUTPUT
    else
      echo "complete=false" >> $GITHUB_OUTPUT
    fi

- name: Re-trigger if incomplete
  if: steps.check.outputs.complete != 'true'
  uses: peter-evans/repository-dispatch@v2
  with:
    event-type: continue-download
```

**Pros:**
- Simple implementation
- Works with existing resume support
- No code changes needed

**Cons:**
- Multiple workflow runs (could take 2-3 runs)
- Workflow dispatch events count against limits
- Slower total completion time
- Cache key complexity

**Feasibility:** MEDIUM - Works but slower

---

### Solution 3: Increase Parallelism Within Single Job

**Concept:** Increase concurrent API requests to download faster.

**Current State:**
- 2 workers, 10,000 records per page
- Rate: ~3,400 records/second

**Potential Improvement:**
- 8-10 workers
- Rate: ~10,000-15,000 records/second (estimated)
- Time: ~40-60 minutes

**Pros:**
- Single job, simple architecture
- No merge step needed

**Cons:**
- May hit RDW API rate limits
- Higher memory usage
- Previous attempts with 4 workers caused connection errors
- Unpredictable - API may throttle

**Feasibility:** LOW - Already tried, caused API errors

---

### Solution 4: Use GitHub-Hosted Larger Runners

**Concept:** Pay for larger runners with extended timeout.

**Options:**
- `ubuntu-latest-4-cores`: Still 2h timeout
- Self-hosted runner: Custom timeout possible

**Pros:**
- No code changes
- More resources

**Cons:**
- Costs money
- Still may hit timeout
- Overkill for this use case

**Feasibility:** LOW - Not cost-effective

---

### Solution 5: Scheduled Multi-Part Downloads

**Concept:** Schedule multiple workflows that each download a portion.

```yaml
# Workflow 1: Runs Monday 00:00
on:
  schedule:
    - cron: '0 0 * * 1'
env:
  PARTITION_START: 0
  PARTITION_END: 12

# Workflow 2: Runs Monday 02:30
on:
  schedule:
    - cron: '30 2 * * 1'
env:
  PARTITION_START: 12
  PARTITION_END: 24
```

**Pros:**
- Simple to implement
- No job coordination needed

**Cons:**
- Fixed schedule, inflexible
- Must wait for all parts to complete
- Complex if one part fails

**Feasibility:** LOW - Too rigid

---

### Solution 6: External Download + Commit Results

**Concept:** Run download on external compute (Azure, AWS Lambda, local), commit results to repo or artifact storage.

**Pros:**
- No timeout limits
- Full control

**Cons:**
- Requires external infrastructure
- More complex setup
- Security considerations for secrets

**Feasibility:** MEDIUM - Good fallback option

---

## Recommended Solution: Matrix Strategy (Solution 1)

The matrix strategy is the best fit because:

1. **Native GitHub Actions** - No external dependencies
2. **True parallelism** - 36 jobs running simultaneously
3. **Fast completion** - ~10-15 minutes total
4. **Fault tolerant** - Failed partitions can retry independently
5. **Scalable** - Easy to adjust partition count

### Implementation Plan

1. **Modify `download.py`** to accept `--partition` argument
   - Filter inspections by `kenteken LIKE 'X%'`
   - Output to `data/inspections_{partition}.csv`

2. **Update workflow** with matrix strategy
   - 36 parallel jobs (0-9, A-Z)
   - Each job caches its partition independently
   - Merge job combines all partitions

3. **Add merge step**
   - Download all partition artifacts
   - Combine into single `inspections.csv`
   - Continue with processing

### Code Changes Required

**download.py:**
```python
parser.add_argument("--partition", type=str, help="Kenteken prefix to filter (0-9, A-Z)")

# In _offset_pages_build:
if partition:
    where = f"kenteken LIKE '{partition}%'"
```

**update.yml:**
```yaml
jobs:
  download-inspections:
    strategy:
      fail-fast: false
      matrix:
        partition: ['0','1','2','3','4','5','6','7','8','9',
                    'A','B','C','D','E','F','G','H','I','J',
                    'K','L','M','N','O','P','Q','R','S','T',
                    'U','V','W','X','Y','Z']
    steps:
      - name: Download partition
        run: python src/download.py inspections --partition ${{ matrix.partition }}
      - name: Upload partition
        uses: actions/upload-artifact@v4
        with:
          name: inspections-${{ matrix.partition }}
          path: data/inspections_${{ matrix.partition }}.csv
  
  process:
    needs: download-inspections
    steps:
      - name: Download all partitions
        uses: actions/download-artifact@v4
        with:
          pattern: inspections-*
          merge-multiple: true
      - name: Merge partitions
        run: |
          head -1 data/inspections_0.csv > data/inspections.csv
          for f in data/inspections_*.csv; do
            tail -n +2 "$f" >> data/inspections.csv
          done
```

## Implementation Status

### Completed (2025-12-01)

1. [x] Implement `--partition` flag in download.py
   - Added `--partition` CLI argument (single character: 0-9, A-Z)
   - Modified `_offset_pages_build()` to filter by kenteken prefix
   - Output files named `inspections_{partition}.csv`

2. [x] Split workflow into three separate files
   - `download.yml` - Matrix job with 36 partitions for inspections + other datasets
   - `process.yml` - Triggered by download completion, merges and processes data
   - `website.yml` - Triggered by process completion, deploys to GitHub Pages

3. [x] Add merge step in download workflow
   - Downloads all 36 partition artifacts
   - Merges into single `inspections.csv` (header from first file, data from all)
   - Continues with dependent datasets (vehicles, fuel, defects_found)

### Workflow Architecture

```
download.yml                          process.yml         website.yml
┌─────────────────────────────────┐   ┌──────────────┐   ┌─────────────┐
│ download-inspections (matrix)   │   │              │   │             │
│ ├── partition 0 ─┐              │   │   process    │   │   deploy    │
│ ├── partition 1 ─┼─► artifacts  │   │   data       │   │   pages     │
│ ├── ...          │              │   │              │   │             │
│ └── partition Z ─┘              │   │              │   │             │
│                                 │   │              │   │             │
│ download-other (defect_codes)   │   │              │   │             │
│                                 │   │              │   │             │
│ merge-and-download-dependent    │   │              │   │             │
│ ├── merge partitions            │──►│ (triggered)  │──►│ (triggered) │
│ ├── vehicles                    │   │              │   │             │
│ ├── fuel                        │   │              │   │             │
│ └── defects_found ──► artifact  │   │              │   │             │
└─────────────────────────────────┘   └──────────────┘   └─────────────┘
```

### Pending

4. [ ] Test locally with a single partition
5. [ ] Commit and push changes to trigger workflow
6. [ ] Verify matrix jobs complete successfully
7. [ ] Verify 100% sample completes within timeout

---

## Previous Attempts

### Attempt 1: Reduce Memory (2025-11-30)
- Reduced page size from 50,000 to 10,000
- Result: Still times out

### Attempt 2: Resume Support (2025-11-30)
- Added resume capability
- Result: Cache doesn't persist across timeout (job killed before save)

### Attempt 3: 10% Default for Push (2025-12-01)
- Push events use 10% sample
- Result: Works for CI, but doesn't solve 100% goal

## Run History

| Run | Duration | Status | Notes |
|-----|----------|--------|-------|
| #48 | ~25m (expected) | In Progress | 10% sample - testing fix |
| #47 | 2h 0m 21s | Timeout | 100% sample - hit limit |
| #46 | 25m 25s | Success | 10% sample with cache |
