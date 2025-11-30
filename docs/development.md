# Development Guide

## Prerequisites

- Python 3.10+
- Git
- (Optional) GitHub CLI (`gh`) for deployment

## Local Setup

```bash
# Clone the repository
git clone https://github.com/jjgroenendijk/cars-reliability.git
cd cars-reliability

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```

## Branches

| Branch | Data Sample | Purpose |
|--------|-------------|--------|
| `main` | 100% | Production - deployed to GitHub Pages |
| `dev` | 1% | Development - fast iteration |

Work on `dev` for quick feedback, merge to `main` for production.

## Running the Pipeline

```bash
# 1. Fetch data from RDW (use 1% sample for dev)
DATA_SAMPLE_PERCENT=1 python src/fetch_data.py

# 2. Process data and calculate metrics
python src/process_data.py

# 3. Generate static website
python src/generate_site.py
```

Output files:

- `data/*.csv` - Raw data (gitignored)
- `site/data/*.json` - Processed metrics
- `site/index.html` - Static website
- `site/js/app.js` - Interactive JavaScript

## Viewing the Site Locally

```bash
# Simple Python HTTP server
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
| `FETCH_WORKERS` | Number of parallel threads for batch fetching | 4 |

Get an app token at [opendata.rdw.nl](https://opendata.rdw.nl/) (free registration).

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
# Quick dev run (1% sample, ~250k records)
DATA_SAMPLE_PERCENT=1 python src/fetch_data.py

# Full production run (~25M records, takes longer)
DATA_SAMPLE_PERCENT=100 python src/fetch_data.py
```

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
