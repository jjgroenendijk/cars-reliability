# Dutch Car Reliability Analysis

[![Update Data](https://github.com/jjgroenendijk/cars-reliability/actions/workflows/update.yml/badge.svg)](https://github.com/jjgroenendijk/cars-reliability/actions/workflows/update.yml)

🔗 **[View the Live Site](https://jjgroenendijk.nl/cars-reliability/)**

Investigating car reliability using data from the Dutch RDW (Rijksdienst voor het Wegverkeer).

## Overview

This project analyzes vehicle inspection (APK) data to determine which cars are most reliable. We use open data from [RDW Open Data](https://opendata.rdw.nl/) to calculate reliability metrics.

## Data Sources

| Dataset | ID | Description |
|---------|-----|-------------|
| Gekentekende voertuigen | `m9d7-ebf2` | Vehicle registrations (make, model, APK dates) |
| Geconstateerde Gebreken | `a34c-vvps` | Defects found during inspections |
| Gebreken | `hx2c-gt7k` | Reference table of defect types |
| Brandstof | `8ys7-d773` | Fuel type and emissions data |

## Reliability Metrics (MVP)

1. **APK Failure Rate** - Percentage of vehicles that fail their first APK attempt
2. **Average Defects per Inspection** - Mean number of defects found per vehicle

## Project Structure

```text
cars/
├── src/
│   ├── fetch_data.py      # Data fetching from RDW API
│   ├── process_data.py    # Data processing and metrics calculation
│   ├── generate_site.py   # Template copying to site/
│   └── templates/         # HTML/JS templates
├── data/                   # Downloaded/processed data (gitignored)
├── site/                   # Generated website (GitHub Pages)
├── docs/                   # Project documentation
├── .github/
│   └── workflows/
│       └── update.yml      # GitHub Actions workflow
├── requirements.txt
└── README.md
```

## Documentation

See the [docs/](docs/index.md) folder for detailed documentation:

- [Architecture](docs/architecture.md) - System design and data flow
- [Data Sources](docs/data-sources.md) - RDW datasets and API details
- [Metrics](docs/metrics.md) - How reliability is measured
- [Development](docs/development.md) - Local setup guide
- [Future Plans](docs/future.md) - Roadmap and improvements

## Branches

| Branch | Data Sample | Purpose |
|--------|-------------|--------|
| `main` | 100% (full dataset) | Production - deployed to GitHub Pages |
| `dev` | 1% (~245k records) | Development - fast iteration |

The `DATA_SAMPLE_PERCENT` environment variable controls how much data to fetch. Dataset size is queried dynamically from the API.

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run pipeline (1% sample for speed, 8 parallel workers)
DATA_SAMPLE_PERCENT=1 FETCH_WORKERS=8 python src/fetch_data.py
python src/process_data.py
python src/generate_site.py

# Preview the site
cd site && python -m http.server 8000
```

For faster fetching with an app token (optional, get one at [opendata.rdw.nl](https://opendata.rdw.nl/)):
```bash
RDW_APP_TOKEN=your_token DATA_SAMPLE_PERCENT=1 python src/fetch_data.py
```

## License

MIT
