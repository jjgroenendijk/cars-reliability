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
                        │ (weekly update) │
                        └─────────────────┘
```

## Directory Structure

```
cars/
├── src/                    # Python source code
│   ├── fetch_data.py       # RDW API client
│   ├── process_data.py     # Metrics calculation
│   ├── generate_site.py    # Site generation (copies templates)
│   └── templates/          # HTML/JS templates
│       ├── index.html
│       └── app.js
├── data/                   # Raw data (gitignored)
│   ├── vehicles.csv
│   ├── defects_found.csv
│   ├── defect_codes.csv
│   └── fuel.csv
├── site/                   # Generated website
│   ├── index.html
│   ├── js/
│   │   └── app.js
│   └── data/
│       ├── brand_reliability.json
│       └── model_reliability.json
├── docs/                   # Documentation (you are here)
├── .github/workflows/      # CI/CD
│   └── update.yml
└── requirements.txt
```

## Data Flow

### 1. Fetch (`src/fetch_data.py`)

- Connects to RDW Open Data via Socrata SODA API
- Fetches defect records from `Geconstateerde Gebreken` dataset
- For each unique license plate (kenteken), fetches vehicle info
- Saves raw data as CSV files in `data/`

### 2. Process (`src/process_data.py`)

- Loads CSV files into pandas DataFrames
- Joins defects with vehicle info on `kenteken`
- Aggregates by brand and model
- Calculates metrics (avg defects per vehicle/inspection)
- Outputs JSON files for the website

### 3. Generate (`src/generate_site.py`)

- Copies HTML and JavaScript templates from `src/templates/`
- Templates load data dynamically via JavaScript `fetch()`
- Outputs to `site/index.html` and `site/js/app.js`

### 4. Deploy (GitHub Actions)

- Runs weekly (Sunday midnight UTC) on `main` branch
- Executes the full pipeline in a single job
- Uploads generated `site/` as a GitHub Pages artifact
- Deploys directly from artifact (no files committed to repo)

## Key Design Decisions

### Why Socrata/SODA API?

RDW uses Tyler Technologies' Socrata platform for their open data. The `sodapy` library provides a clean Python interface with built-in pagination and query support.

### Why Static HTML with Dynamic JS?

- No server required (GitHub Pages is free)
- Fast loading with async data fetching
- Separation of concerns (templates vs data)
- Interactive tables with sorting and filtering
- Easy to update data without changing templates

### Why start from defects?

The defects dataset is smaller and more focused. Starting there ensures we only fetch vehicle info for cars that have inspection records, maximizing data overlap.

## Limitations

- **Rate limiting**: Without an app token, API calls are throttled
- **Data freshness**: RDW updates daily, but we only fetch weekly

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

The `DATA_SAMPLE_PERCENT` environment variable controls how much of the full dataset to fetch:

| Sample | Records | Use Case |
|--------|---------|----------|
| 1% | ~250k defects | Dev branch, fast iteration |
| 100% | ~25M defects | Main branch, production |

The website displays a warning banner when viewing sample data.
