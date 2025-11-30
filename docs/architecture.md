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
│   └── generate_site.py    # HTML generation
├── data/                   # Raw data (gitignored)
│   ├── vehicles.csv
│   ├── defects_found.csv
│   └── defect_codes.csv
├── site/                   # Generated website
│   ├── index.html
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

- Reads processed JSON data
- Generates static HTML using Python string templates
- Outputs to `site/index.html`

### 4. Deploy (GitHub Actions)

- Runs weekly (Sunday midnight UTC)
- Executes the full pipeline
- Commits any data changes
- Deploys `site/` to GitHub Pages

## Key Design Decisions

### Why Socrata/SODA API?
RDW uses Tyler Technologies' Socrata platform for their open data. The `sodapy` library provides a clean Python interface with built-in pagination and query support.

### Why Static HTML?
- No server required (GitHub Pages is free)
- Fast loading
- Simple to maintain
- Can be enhanced with JavaScript later

### Why start from defects?
The defects dataset is smaller and more focused. Starting there ensures we only fetch vehicle info for cars that have inspection records, maximizing data overlap.

## Limitations

- **Rate limiting**: Without an app token, API calls are throttled
- **Data freshness**: RDW updates daily, but we only fetch weekly
- **Sample size**: MVP limits to 100k defect records for speed
