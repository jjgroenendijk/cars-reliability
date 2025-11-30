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
│   ├── download.py         # Unified data fetching script
│   ├── download.py         # Data fetching (API, streaming CSV)
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
    └── update.yml          # CI/CD workflow (per-dataset caching)
```

## Data Flow

### 1. Fetch (`src/download.py`)

Unified script for fetching data:

**All datasets at once:**
```bash
python src/download.py --all
```

**Individual datasets (for CI per-dataset caching):**
```bash
python src/download.py inspections
python src/download.py vehicles --kentekens-from data/inspections.csv
```

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
- **Streaming CSV writes** - Flushes to disk immediately, survives interruption
- **Per-dataset caching** - Each dataset cached separately in CI
- **Exponential backoff** - Retries with increasing delays on API errors

### 2. Process (`src/process_data.py`)

- Loads CSV files into pandas DataFrames
- Joins with vehicle info on `kenteken`
- Calculates pass rate from inspections
- Aggregates by brand and model
- Outputs JSON files for the website

### 3. Generate (`src/generate_site.py`)

- Copies HTML/CSS/JS templates from `src/templates/`
- Templates load data dynamically via `fetch()`

### 4. Deploy (GitHub Actions)

Single workflow with per-dataset caching:

```text
Restore caches → Fetch missing datasets → Save caches → Process → Generate → Deploy
```

- **Per-dataset caching**: Each dataset cached independently
- **Sample percentage**: Adjustable via workflow input (1%, 10%, 50%, 100%)
- **Weekly refresh**: Scheduled run every Sunday at midnight UTC

## Key Design Decisions

### Why start from inspections (not defects)?

Starting from defects creates **sample bias** - we only see vehicles that failed. Starting from inspections gives us ALL results (pass and fail), enabling accurate pass rate calculations.

### Why per-dataset caching?

The RDW API is slow (~2-3 hours for full dataset). Per-dataset caching allows:

- Independent cache invalidation per dataset
- Faster recovery when only one dataset needs refresh
- Efficient use of GitHub Actions cache

### Why streaming writes?

Writing to disk as data arrives:
- Reduces memory usage
- Provides recovery point on interruption
- Visible progress in CI logs

### Why Static HTML with Dynamic JS?

- No server required (GitHub Pages is free)
- Fast loading with async data fetching
- Easy to update data without changing templates

## Resilience Features

### API Retry Logic

The fetch scripts include exponential backoff retry for API calls:

- 5 retries per batch with 2s base delay
- Backoff multiplier: 2x (delays: 2s, 4s, 8s, 16s, 32s)
- Failed batches are logged but don't stop the entire fetch

### Data Caching

GitHub Actions caches fetched data to speed up repeated runs:

- Cache key: `{dataset}-{sample}pct-{week}-{script-hash}`
- Each dataset is cached independently
- Fresh data is fetched weekly (cache key includes week number)
- Script changes invalidate cache automatically
- Manual workflow dispatch has "force fetch" option to bypass cache

## Data Sampling

The `DATA_SAMPLE_PERCENT` environment variable controls how much of the full dataset to fetch.

Dataset size is queried dynamically from the API at runtime using `SELECT count(*)`, so the percentages always reflect the current dataset size.

| Sample | Records | Use Case |
|--------|---------|----------|
| 1% | ~245k defects | Quick local testing |
| 10% | ~2.5M defects | Testing full pipeline |
| 100% | ~24.5M defects | Production (weekly scheduled runs) |

## Performance

### Parallel Fetching

All batch operations use `ThreadPoolExecutor` for parallel requests:

- Defects: Fetched in 50k record pages
- Vehicles/Fuel/Inspections: Fetched in 1k kenteken batches

Default is 2 workers to avoid overwhelming the RDW API.

### App Token

Using an RDW app token (`RDW_APP_TOKEN`) removes rate limiting and speeds up API calls.
