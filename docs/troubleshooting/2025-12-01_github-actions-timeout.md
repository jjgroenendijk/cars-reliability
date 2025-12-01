# GitHub Actions Timeout After 2 Hours

**Date:** 2025-12-01
**Status:** IMPLEMENTED - Testing
**Goal:** Enable 100% dataset download within GitHub Actions constraints

## Problem Statement

The inspections dataset contains ~24.7 million records. At current download speeds (~3,400 records/second via Socrata API), this takes approximately **2+ hours** to download, exceeding GitHub Actions' **2-hour job timeout**.

### Constraints
- GitHub Actions job timeout: **2 hours** (hard limit, free tier)
- Inspections dataset: ~24.7M records
- Current download rate: ~3,400 records/second
- Required time at current rate: ~2h 1m (just over the limit)

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
