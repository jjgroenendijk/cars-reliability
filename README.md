# Dutch Car Reliability Analysis

[![Update Data](https://github.com/jjgroenendijk/cars-reliability/actions/workflows/update-parallel.yml/badge.svg)](https://github.com/jjgroenendijk/cars-reliability/actions/workflows/update-parallel.yml)

**[View the Live Site](https://jjgroenendijk.nl/cars-reliability/)** | **[Dev Preview](https://cars-reliability-dev.surge.sh)**

Analyzing car reliability using Dutch APK (MOT) inspection data from RDW Open Data.

## Overview

This project calculates reliability metrics for car brands and models using official inspection data from [RDW Open Data](https://opendata.rdw.nl/). Unlike biased samples that only look at failed inspections, we analyze ALL inspection results to provide accurate pass/fail rates.

## Data Sources

| Dataset | ID | Description |
|---------|-----|-------------|
| Meldingen Keuringsinstantie | `sgfe-77wx` | **Primary** - All APK inspection results (pass/fail) |
| Gekentekende voertuigen | `m9d7-ebf2` | Vehicle registrations (make, model, dates) |
| Geconstateerde Gebreken | `a34c-vvps` | Defects found during inspections |
| Gebreken | `hx2c-gt7k` | Reference table of defect types |
| Brandstof | `8ys7-d773` | Fuel type and emissions data |

## Reliability Metrics

1. **Pass Rate** - Percentage of inspections passed on first attempt
2. **Average Defects per Inspection** - Mean number of defects found per vehicle

## Project Structure

```text
cars/
├── src/
│   ├── fetch_dataset.py   # Fetch single dataset (for parallel CI)
│   ├── fetch_data.py      # Legacy monolithic fetcher
│   ├── process_data.py    # Metrics calculation
│   ├── generate_site.py   # Template copying to site/
│   └── templates/         # HTML/JS templates
├── data/                   # Downloaded data (gitignored)
├── site/                   # Generated website
├── docs/                   # Documentation
└── .github/workflows/
    ├── update-parallel.yml # Parallel fetch workflow (recommended)
    └── update.yml          # Legacy single-job workflow
```

## Documentation

See [docs/](docs/index.md) for detailed documentation:

- [Architecture](docs/architecture.md) - System design and data flow
- [Data Sources](docs/data-sources.md) - RDW datasets and API details
- [Metrics](docs/metrics.md) - How reliability is measured
- [Development](docs/development.md) - Local setup guide

## Branches

| Branch | Data Sample | Deployment |
|--------|-------------|------------|
| `main` | 100% (~25M records) | GitHub Pages |
| `dev` | 1% (~250k records) | Surge.sh preview |

## Local Development

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Fetch data (1% sample for speed)
DATA_SAMPLE_PERCENT=1 python src/fetch_dataset.py inspections
DATA_SAMPLE_PERCENT=1 python src/fetch_dataset.py vehicles --kentekens-from data/inspections.csv
DATA_SAMPLE_PERCENT=1 python src/fetch_dataset.py defects_found --kentekens-from data/inspections.csv
python src/fetch_dataset.py defect_codes

# Process and generate site
python src/process_data.py
python src/generate_site.py

# Preview
cd site && python -m http.server 8000
```

## License

MIT
