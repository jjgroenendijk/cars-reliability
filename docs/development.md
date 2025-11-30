# Development Guide

## Prerequisites

- Python 3.10+
- Git

## Local Setup

```bash
# Clone the repository
git clone https://github.com/jjgroenendijk/cars-reliability.git
cd cars-reliability

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or: .venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

## Running the Pipeline

### Option 1: All datasets at once

```bash
# Fetch all datasets with 1% sample (quick test)
DATA_SAMPLE_PERCENT=1 python src/download.py --all

# Process and generate
python src/process_data.py
python src/generate_site.py
```

### Option 2: Individual datasets

```bash
# 1. Fetch inspections first (primary dataset)
DATA_SAMPLE_PERCENT=1 python src/download.py inspections

# 2. Fetch dependent datasets using kentekens from inspections
DATA_SAMPLE_PERCENT=1 python src/download.py vehicles --kentekens-from data/inspections.csv
DATA_SAMPLE_PERCENT=1 python src/download.py fuel --kentekens-from data/inspections.csv
DATA_SAMPLE_PERCENT=1 python src/download.py defects_found --kentekens-from data/inspections.csv

# 3. Fetch reference table
python src/download.py defect_codes

# 4. Process and generate
python src/process_data.py
python src/generate_site.py
```

Output files:

- `data/*.csv` - Raw data (gitignored)
- `site/data/*.json` - Processed metrics
- `site/index.html` - Static website

## Viewing the Site Locally

```bash
cd site
python -m http.server 8000
# Open http://localhost:8000
```

## Project Structure

```text
src/
├── download.py        # Unified data fetching script
├── rdw_client.py      # Shared utilities (API, streaming CSV)
├── process_data.py    # Data processing and metrics
├── generate_site.py   # Template copying
└── templates/         # HTML/JS templates
    ├── index.html
    └── app.js
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|----------|
| `DATA_SAMPLE_PERCENT` | Percentage of full dataset to fetch (1-100) | 100 |
| `RDW_APP_TOKEN` | Socrata app token for higher rate limits | None |
| `FETCH_WORKERS` | Number of parallel threads for batch fetching | 2 |

Get an app token at [opendata.rdw.nl](https://opendata.rdw.nl/) (free registration).

### Using an App Token Locally

Create a `.env` file (already in `.gitignore`):

```bash
RDW_APP_TOKEN=your_app_token_here
```

Then run with the token:

```bash
source .env && python src/fetch_pipeline.py
```

### Data Sampling

```bash
# Quick local test (1% sample, ~245k records)
DATA_SAMPLE_PERCENT=1 python src/download.py --all

# Full production run (~24.5M records, takes ~2-3 hours)
DATA_SAMPLE_PERCENT=100 python src/download.py --all
```

## Testing

Run the streaming CSV writer tests:

```bash
python src/test_streaming_csv.py
```

To verify the full pipeline:

```bash
DATA_SAMPLE_PERCENT=1 python src/download.py --all
python src/process_data.py
python src/generate_site.py

# Check output
head site/data/brand_reliability.json
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-improvement`
3. Make changes
4. Test locally
5. Submit a pull request

### Code Style

- Follow PEP 8
- Use type hints where practical
- Document functions with docstrings

## Deployment

The site is deployed automatically via GitHub Actions:

1. Pipeline runs (fetch -> process -> generate)
2. Generated `site/` folder is uploaded as artifact
3. GitHub Pages serves from the artifact

No files are committed - the site is built fresh on each deploy.

### Triggering a Refresh

```bash
# Manually trigger the update workflow (defaults to 100%)
gh workflow run update.yml

# Trigger with specific sample percentage for testing
gh workflow run update.yml -f sample_percent=1

# Watch progress
gh run watch
```

## Troubleshooting

### "No such column" API Error

The RDW schema changes occasionally. Check the [dataset page](https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen/m9d7-ebf2) for current column names.

### Rate Limiting

If you see 429 errors, the built-in retry logic will handle transient failures. For persistent issues:

- Add an app token (see Configuration)
- Reduce workers: `FETCH_WORKERS=1`
- Wait and retry later

### Bypassing Cache in CI

To force a fresh data fetch in GitHub Actions:

1. Go to Actions -> "Update Car Reliability Data" -> "Run workflow"
2. Select sample percentage (1%, 10%, 50%, or 100%)
3. Check the "Force fresh data fetch" checkbox
4. Click "Run workflow"
