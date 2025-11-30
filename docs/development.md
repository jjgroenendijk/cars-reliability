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

## Running the Pipeline

```bash
# 1. Fetch data from RDW (takes a few minutes)
python src/fetch_data.py

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

| Variable | Description | Required |
|----------|-------------|----------|
| `RDW_APP_TOKEN` | Socrata app token for higher rate limits | No |

Get an app token at [opendata.rdw.nl](https://opendata.rdw.nl/) (free registration).

### Adjusting Limits

In `src/fetch_data.py`:
```python
# Increase for more comprehensive data
defects_df = fetch_defects_found(client, limit=500000)
```

In `src/process_data.py`:
```python
# Lower threshold includes more models
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

### Manual Deployment

```bash
git add site/
git commit -m "Update data"
git push
```

GitHub Actions will automatically deploy to GitHub Pages.

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
If you see 429 errors:
- Add an app token (see Configuration)
- Reduce batch sizes
- Add delays between requests

### No Data Overlap
If brand stats are empty, the defects and vehicles aren't matching:
```python
# Debug: check for common kentekens
vehicles = pd.read_csv('data/vehicles.csv')
defects = pd.read_csv('data/defects_found.csv')
common = set(vehicles.kenteken) & set(defects.kenteken)
print(f"Common: {len(common)}")
```
