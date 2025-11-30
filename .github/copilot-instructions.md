# Copilot Instructions for cars-reliability

## Project Overview

This project analyzes Dutch vehicle inspection (APK) data from RDW Open Data to calculate car reliability metrics. The pipeline fetches data via Socrata API, processes it with pandas, and generates a static HTML site deployed to GitHub Pages.

## Architecture

**Data flow:** `download.py` → CSV files → `process_data.py` → JSON → `generate_site.py` → site/

Key directories:
- `src/` - Python pipeline scripts (fetch → process → generate)
- `src/download.py` - Data fetching (API client, streaming CSV, parallel fetch)
- `src/templates/` - HTML and JavaScript templates
- `data/` - Raw CSV files (gitignored, regenerated on each run)
- `site/` - Generated website deployed to GitHub Pages
- `docs/` - Project documentation (Markdown)

## RDW API Conventions

The RDW uses Socrata's SODA API. Dataset IDs are defined in `src/download.py`:
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
python src/download.py --all  # Fetches from RDW API (~2-3 min)
python src/process_data.py    # Calculates metrics, outputs JSON
python src/generate_site.py   # Copies templates to site/

# Or fetch individual datasets (for parallel CI jobs)
python src/download.py inspections  # Primary dataset
python src/download.py vehicles --kentekens-from data/inspections.csv

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
- Runs weekly on Sundays at midnight UTC
- Runs on push to `main` branch when `src/` or workflow files change
- Uses per-dataset caching with keys: `{dataset}-{sample}pct-{week}-{script-hash}`
- Deploys generated `site/` to GitHub Pages

## Sample Percentage

- Default: 100% (full dataset)
- Adjustable via workflow_dispatch input: 1%, 10%, 50%, or 100%
- Use `DATA_SAMPLE_PERCENT=1` locally for quick testing
- Run the full pipeline locally before pushing to catch issues

## Style Guidelines

- No emojis in code or generated output
- Dutch field names from RDW (e.g., `merk`, `kenteken`, `handelsbenaming`) are preserved
- English for code, comments, and documentation
- Python functions must use `<subject>_<verb>` naming convention (e.g., `dataset_download`, `metadata_load`, `results_save`)
- Simplicity is paramount: avoid deep nesting and complexity
- Prefer feature flags (boolean parameters) over nested conditionals

## Contributing to This File

When adding new conventions, patterns, or rules to this project, document them in this file (`copilot-instructions.md`). This ensures Copilot and future contributors understand project standards. Include:
- New API conventions or dataset handling patterns
- Code style decisions and naming conventions
- Workflow or deployment changes
- Any project-specific rules that deviate from common practices

## Verification Workflow

When making code changes and it's unclear whether they work correctly:
1. Commit and push the changes to a branch
2. Watch the GitHub Actions logs to verify the change is successful
3. Fix any issues encountered in the CI pipeline before considering the task complete
