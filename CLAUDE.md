# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project analyzes Dutch vehicle inspection (APK) data from RDW Open Data to calculate car reliability metrics. The pipeline fetches data via Socrata API, processes it with pandas, and generates a static HTML site deployed to GitHub Pages.

## Common Development Commands

### Setup

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt
```

### Running the Pipeline

```bash
# Quick local test (1% sample, ~2 minutes)
DATA_SAMPLE_PERCENT=1 python src/download.py --all
python src/process_data.py
python src/generate_site.py

# Individual datasets (for parallel CI or targeted fetching)
DATA_SAMPLE_PERCENT=1 python src/download.py inspections
DATA_SAMPLE_PERCENT=1 python src/download.py vehicles --kentekens-from data/inspections.csv
DATA_SAMPLE_PERCENT=1 python src/download.py fuel --kentekens-from data/inspections.csv
DATA_SAMPLE_PERCENT=1 python src/download.py defects_found --kentekens-from data/inspections.csv
python src/download.py defect_codes

# Full production run (100% sample, ~2-3 hours)
DATA_SAMPLE_PERCENT=100 python src/download.py --all
python src/process_data.py
python src/generate_site.py

# Preview the site
cd site && python -m http.server 8000
```

### Testing

```bash
# Run streaming CSV writer tests
python src/test_streaming_csv.py

# Verify the pipeline output
DATA_SAMPLE_PERCENT=1 python src/download.py --all
python src/process_data.py
python src/generate_site.py
head site/data/brand_reliability.json
```

## Architecture

### Data Flow

```
download.py → CSV files → process_data.py → JSON → generate_site.py → site/
```

**Key principle: inspections-first, not defects-first**

Starting from `inspections.csv` (all APK results) avoids sample bias. Starting from `defects_found.csv` would only show vehicles that failed, making pass rates impossible to calculate accurately.

### Directory Structure

- `src/rdw_client.py` - Shared utilities (Socrata client, streaming CSV, retry logic)
- `src/download.py` - Unified data fetching script
- `src/process_data.py` - Metrics calculation (defects per inspection, pass rate)
- `src/generate_site.py` - Template copying to site/
- `src/templates/` - HTML and JavaScript templates
- `data/` - Raw CSV files (gitignored, regenerated on each run)
- `site/` - Generated website deployed to GitHub Pages
- `docs/` - Project documentation (architecture, data sources, metrics)

### RDW API Conventions

Dataset IDs are defined in `src/rdw_client.py:DATASETS`:

```python
"vehicles": "m9d7-ebf2",       # Gekentekende voertuigen
"defects_found": "a34c-vvps",  # Geconstateerde Gebreken
"defect_codes": "hx2c-gt7k",   # Gebreken (reference table)
"inspections": "sgfe-77wx",    # Meldingen Keuringsinstantie (all APK results)
"fuel": "8ys7-d773",           # Brandstof data
```

When querying:
- Use `sodapy.Socrata` client with domain `opendata.rdw.nl`
- Filter passenger cars with `voertuigsoort='Personenauto'`
- Join on `kenteken` (license plate) between datasets
- Handle rate limits gracefully; batch requests for large queries

### Key Design Patterns

**Path handling:**
All scripts use `Path(__file__).parent.parent / "subdir"` for paths relative to project root.

**DataFrames:**
Load with `dtype=str` to avoid type coercion issues with kentekens (license plates).

**Streaming writes:**
`src/rdw_client.py:StreamingCSVWriter` flushes to disk immediately for resilience and memory efficiency.

**Retry logic:**
`@retry_with_backoff` decorator with exponential backoff (5 retries, base 2s delay, 2x multiplier).

**Minimum sample sizes:**
Metrics require 100 vehicles for brands, 50 for models to ensure statistical validity.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_SAMPLE_PERCENT` | Percentage of data to fetch (1-100) | 100 |
| `RDW_APP_TOKEN` | Socrata app token for higher rate limits | None |
| `FETCH_WORKERS` | Number of parallel threads for batch fetching | 2 |

Get an app token at opendata.rdw.nl (free registration).

## CI/CD and Branching

**Branch workflow:**
- `dev` - Development branch (1% sample, validates changes)
- `main` - Production branch (100% sample, deploys to GitHub Pages)

**GitHub Pages Deployment:**

- Both branches deploy to: <https://jjgroenendijk.nl/cars-reliability/>
- Deployments overwrite each other (whichever runs last is visible)
- `main` deploys 100% sample data (production)
- `dev` deploys 1% sample data (testing)

**GitHub Actions workflow** (`.github/workflows/update.yml`):

- Runs weekly on Sundays at midnight UTC (default branch only, typically `main`)
- Runs on push to `src/` or workflow files (both `main` and `dev` branches)
- Uses per-dataset caching with keys: `{dataset}-{branch}-{week}-{script-hash}`
- Both branches run full pipeline: fetch → process → generate → deploy
- Cache is branch-specific, so `dev` and `main` maintain separate cached datasets

**Testing changes:**
All changes must be tested on `dev` branch first. Since both branches deploy, the `dev` deployment will temporarily overwrite production until `main` runs again. For safer testing, run the full pipeline locally to catch issues before pushing to `dev`.

## Code Style

- Dutch field names from RDW (e.g., `merk`, `kenteken`, `handelsbenaming`) are preserved
- English for code, comments, and documentation
- DataFrames always use `dtype=str` for kenteken columns
- Use `rdw_client.log()` for console output (includes flush for CI visibility)
