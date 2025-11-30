# Copilot Instructions for cars-reliability

## Project Overview

This project analyzes Dutch vehicle inspection (APK) data from RDW Open Data to calculate car reliability metrics. The pipeline fetches data via Socrata API, processes it with pandas, and generates a static HTML site deployed to GitHub Pages.

## Architecture

**Data flow:** `fetch_data.py` → CSV files → `process_data.py` → JSON → `generate_site.py` → site/

Key directories:
- `src/` - Python pipeline scripts (fetch → process → generate)
- `src/templates/` - HTML and JavaScript templates
- `data/` - Raw CSV files (gitignored, regenerated on each run)
- `site/` - Generated website deployed to GitHub Pages
- `docs/` - Project documentation (Markdown)

## RDW API Conventions

The RDW uses Socrata's SODA API. Dataset IDs are defined in `src/fetch_data.py`:
```python
DATASETS = {
    "vehicles": "m9d7-ebf2",      # Gekentekende voertuigen
    "defects_found": "a34c-vvps", # Geconstateerde Gebreken
    "defect_codes": "hx2c-gt7k",  # Gebreken (reference table)
    "inspections": "sgfe-77wx",   # Meldingen Keuringsinstantie (all APK results)
}
# Additional dataset fetched separately:
# Fuel: 8ys7-d773 - Brandstof data
```

When querying the API:
- Use `sodapy.Socrata` client with domain `opendata.rdw.nl`
- Filter passenger cars with `voertuigsoort='Personenauto'`
- Join on `kenteken` (license plate) between datasets
- Handle rate limits gracefully; batch requests for large queries

## Development Workflow

```bash
# Run the full pipeline locally
python src/fetch_data.py    # Fetches from RDW API (~2-3 min)
python src/process_data.py  # Calculates metrics, outputs JSON
python src/generate_site.py # Copies templates to site/

# Preview the site
cd site && python -m http.server 8000
```

## Code Patterns

- All scripts use `Path(__file__).parent.parent / "subdir"` for paths relative to project root
- DataFrames loaded with `dtype=str` to avoid type coercion issues with kentekens
- Metrics require minimum sample sizes (100 vehicles for brands, 50 for models)
- Templates in `src/templates/` are copied by `generate_site.py`
- JavaScript loads data dynamically from JSON files using `fetch()`

## CI/CD

GitHub Actions workflow (`.github/workflows/update.yml`):
- Runs weekly on Sundays and on push to `src/` or workflow files
- Commits generated `site/` files and deploys to GitHub Pages
- Uses `[skip ci]` in commit messages to avoid infinite loops

## Style Guidelines

- No emojis in code or generated output
- Dutch field names from RDW (e.g., `merk`, `kenteken`, `handelsbenaming`) are preserved
- English for code, comments, and documentation
