# Architecture

## System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   RDW Open Data │────▶│  Python Scripts │────▶│  Static Website │
│   (Socrata API) │     │  (fetch/process)│     │  (GitHub Pages) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ GitHub Actions  │
                        │ (parallel jobs) │
                        └─────────────────┘
```

## Directory Structure

```
cars/
├── src/                    # Python source code
│   ├── fetch_dataset.py    # Fetch single dataset (parallel CI)
│   ├── fetch_data.py       # Legacy monolithic fetcher
│   ├── process_data.py     # Metrics calculation
│   ├── generate_site.py    # Site generation
│   └── templates/          # HTML/JS templates
├── data/                   # Raw data (gitignored)
│   ├── inspections.csv     # PRIMARY - all APK results
│   ├── vehicles.csv
│   ├── defects_found.csv
│   ├── defect_codes.csv
│   └── fuel.csv
├── site/                   # Generated website
│   ├── index.html
│   ├── css/styles.css
│   ├── js/app.js
│   └── data/
│       ├── brand_reliability.json
│       └── model_reliability.json
├── docs/                   # Documentation
└── .github/workflows/
    ├── update-parallel.yml # Parallel fetch (recommended)
    └── update.yml          # Legacy single-job
```

## Data Flow

### 1. Fetch (`src/fetch_dataset.py`)

The parallel fetcher downloads one dataset at a time with streaming writes:

```
Stage 1 (parallel):
├── inspections (PRIMARY - all APK results)
└── defect_codes (small reference table)
         │
         ▼ extract kentekens
Stage 2 (parallel):
├── vehicles
├── fuel
└── defects_found
```

Key features:
- **Inspections first** - Avoids sample bias by starting with ALL inspection results
- **Streaming CSV writes** - Flushes to disk immediately, survives interruption
- **Per-dataset caching** - Each dataset cached separately in CI

### 2. Process (`src/process_data.py`)

- Loads CSV files into pandas DataFrames
- Joins with vehicle info on `kenteken`
- Calculates pass rate from inspections (unbiased!)
- Aggregates by brand and model
- Outputs JSON files for the website

### 3. Generate (`src/generate_site.py`)

- Copies HTML/CSS/JS templates from `src/templates/`
- Templates load data dynamically via `fetch()`

### 4. Deploy (GitHub Actions)

```
fetch-inspections ──┐
                    ├──▶ process-and-deploy ──▶ GitHub Pages (main)
fetch-defect-codes ─┤                      └──▶ Surge.sh (dev)
                    │
fetch-dependent ────┘
  ├── vehicles
  ├── fuel
  └── defects_found
```

- **Parallel runners**: Up to 5 concurrent jobs
- **Per-dataset caching**: Only refetch changed datasets
- **Artifact handoff**: CSVs passed between jobs

## Key Design Decisions

### Why start from inspections (not defects)?

Starting from defects creates **sample bias** - we only see vehicles that failed. Starting from inspections gives us ALL results (pass and fail), enabling accurate pass rate calculations.

### Why parallel fetching?

The RDW API is slow (~2-3 hours for full dataset). Parallel jobs with separate caches:
- Run fetches concurrently on different runners
- Cache datasets independently
- Resume faster on partial failures

### Why streaming writes?

Writing to disk as data arrives:
- Reduces memory usage
- Provides recovery point on interruption
- Visible progress in CI logs

### Why Static HTML with Dynamic JS?

- No server required (GitHub Pages is free)
- Fast loading with async data fetching
- Easy to update data without changing templates

## Limitations

- **Rate limiting**: RDW API requires careful throttling (2 workers recommended)
- **Data freshness**: Weekly updates (could be daily)

## Resilience Features

### API Retry Logic

The fetch script includes exponential backoff retry for API calls:

- 3 retries per batch with 2s base delay
- Backoff multiplier: 2x (delays: 2s, 4s, 8s)
- Failed batches are logged but don't stop the entire fetch

### Data Caching

GitHub Actions caches fetched data to speed up repeated runs:

- Cache key: `rdw-data-{branch}-{week}-{script-hash}`
- Fresh data is fetched weekly (cache key includes week number)
- Script changes invalidate cache automatically
- Manual workflow dispatch has "force fetch" option to bypass cache

## Data Sampling

The `DATA_SAMPLE_PERCENT` environment variable controls how much of the full dataset to fetch.

Dataset size is queried dynamically from the API at runtime using `SELECT count(*)`, so the percentages always reflect the current dataset size.

| Sample | Records | Use Case |
|--------|---------|----------|
| 1% | ~245k defects | Dev branch, fast iteration |
| 100% | ~24.5M defects | Main branch, production |

The website displays a warning banner when viewing sample data.

## Performance Optimizations

### Parallel Fetching

All batch operations use `ThreadPoolExecutor` for parallel requests:

- Defects: Fetched in 50k record pages, parallelized across workers
- Vehicles: Fetched in 1k kenteken batches, parallelized
- Fuel: Same as vehicles

Default is 8 workers (`FETCH_WORKERS=8`), which provides ~2-3x speedup over sequential fetching.

### App Token

Using an RDW app token (`RDW_APP_TOKEN`) removes rate limiting and significantly speeds up API calls.
