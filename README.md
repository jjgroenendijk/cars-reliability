# Dutch Car Reliability Analysis

Investigating car reliability using data from the Dutch RDW (Rijksdienst voor het Wegverkeer).

## Overview

This project analyzes vehicle inspection (APK) data to determine which cars are most reliable. We use open data from [RDW Open Data](https://opendata.rdw.nl/) to calculate reliability metrics.

## Data Sources

| Dataset | ID | Description |
|---------|-----|-------------|
| Gekentekende voertuigen | `m9d7-ebf2` | Vehicle registrations (make, model, APK dates) |
| Geconstateerde Gebreken | `a34c-vvps` | Defects found during inspections |
| Gebreken | `hx2c-gt7k` | Reference table of defect types |

## Reliability Metrics (MVP)

1. **APK Failure Rate** - Percentage of vehicles that fail their first APK attempt
2. **Average Defects per Inspection** - Mean number of defects found per vehicle

## Project Structure

```
cars/
├── src/
│   ├── fetch_data.py      # Data fetching from RDW API
│   ├── process_data.py    # Data processing and metrics calculation
│   └── generate_site.py   # Static HTML generation
├── data/                   # Downloaded/processed data (gitignored)
├── docs/                   # GitHub Pages static site
├── .github/
│   └── workflows/
│       └── update.yml      # GitHub Actions workflow
├── requirements.txt
└── README.md
```

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run pipeline
python src/fetch_data.py
python src/process_data.py
python src/generate_site.py
```

## License

MIT
