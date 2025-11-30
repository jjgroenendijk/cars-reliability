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

## Branches

| Branch | Data Sample | Deployment |
|--------|-------------|------------|
| `main` | 100% | GitHub Pages |
| `dev` | 1% | Surge.sh preview |

Work on `dev` for quick feedback, merge to `main` for production.

## Running the Pipeline

### Option 1: Parallel fetcher (recommended)

```bash
# 1. Fetch inspections first (primary dataset)
DATA_SAMPLE_PERCENT=1 python src/fetch_dataset.py inspections

# 2. Fetch dependent datasets using kentekens from inspections
DATA_SAMPLE_PERCENT=1 python src/fetch_dataset.py vehicles --kentekens-from data/inspections.csv
DATA_SAMPLE_PERCENT=1 python src/fetch_dataset.py fuel --kentekens-from data/inspections.csv
DATA_SAMPLE_PERCENT=1 python src/fetch_dataset.py defects_found --kentekens-from data/inspections.csv

# 3. Fetch reference table
python src/fetch_dataset.py defect_codes

# 4. Process and generate
python src/process_data.py
python src/generate_site.py
```

### Option 2: Legacy monolithic fetcher

```bash
DATA_SAMPLE_PERCENT=1 python src/fetch_data.py
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
├── fetch_data.py      # RDW API client
├── process_data.py    # Data processing & metrics
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
| `FETCH_WORKERS` | Number of parallel threads for batch fetching | 8 |

Get an app token at [opendata.rdw.nl](https://opendata.rdw.nl/) (free registration).

**Note:** Dataset size is queried dynamically from the API, so percentages always reflect the current data.

### Using an App Token Locally

Create a `.env` file (already in `.gitignore`):

```bash
APP_Token=your_app_token_here
```

Then run with the token:

```bash
source .env && RDW_APP_TOKEN=$APP_Token python src/fetch_data.py
```

### Data Sampling

```bash
# Quick dev run (1% sample, ~245k records, 8 workers)
DATA_SAMPLE_PERCENT=1 FETCH_WORKERS=8 python src/fetch_data.py

# Full production run (~24.5M records, takes ~15-20 min)
DATA_SAMPLE_PERCENT=100 FETCH_WORKERS=8 python src/fetch_data.py
```

The fetch script queries the actual dataset size from the API, so these numbers adjust automatically as RDW adds more data.

### Adjusting Thresholds

In `src/process_data.py`:

```python
# Lower threshold includes more models (default is 50)
model_stats = calculate_defects_by_model(vehicles, defects, min_vehicles=20)
```

## Testing

Currently no automated tests. To verify the pipeline:

```bash
# Run full pipeline
python src/fetch_data.py && python src/process_data.py && python src/generate_site.py

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

1. Pipeline runs (fetch → process → generate)
2. Generated `site/` folder is uploaded as artifact
3. GitHub Pages serves from the artifact

No files are committed - the site is built fresh on each deploy.

### Triggering a Refresh

```bash
# Manually trigger the update workflow
gh workflow run update.yml

# Watch progress
gh run watch
```

## Troubleshooting

### "No such column" API Error

The RDW schema changes occasionally. Check the [dataset page](https://opendata.rdw.nl/Voertuigen/Open-Data-RDW-Gekentekende_voertuigen/m9d7-ebf2) for current column names.

### Rate Limiting

If you see 429 errors, the built-in retry logic will handle transient failures. For persistent issues:

- Add an app token (see Configuration)
- Reduce batch sizes
- Add delays between requests

### Bypassing Cache in CI

To force a fresh data fetch in GitHub Actions:

1. Go to Actions → "Update Car Reliability Data" → "Run workflow"
2. Check the "Force fresh data fetch" checkbox
3. Click "Run workflow"

### No Data Overlap

If brand stats are empty, the defects and vehicles aren't matching:

```python
# Debug: check for common kentekens
vehicles = pd.read_csv('data/vehicles.csv')
defects = pd.read_csv('data/defects_found.csv')
common = set(vehicles.kenteken) & set(defects.kenteken)
print(f"Common: {len(common)}")
```
