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

- Runs weekly (Sunday midnight UTC)
- Executes the full pipeline
- Commits any data changes
- Deploys `site/` to GitHub Pages

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
- **Sample size**: MVP limits to 100k defect records for speed
