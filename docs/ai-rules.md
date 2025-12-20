# AI Assistant Rules

> Dense guidance for Claude, Copilot, and other AI assistants.

## Context & Layout

- Project: Dutch car reliability using RDW Open Data. 3-stage flow: Python fetch, Python process, Next.js static site (GitHub Pages).

### Folders

- `scripts/` (Stage 1-2)
- `web/` (Stage 3)
- `data/raw/` + `data/processed/` (gitignored outputs)
- `docs/` (all docs)

### Frameworks

- Next.js 16
- Tailwind CSS 4.1
- Python 3.11+ (managed via uv)
- Node.js 22+
- uv for Python dependency management
- `.env` stores the RDW app token; never commit it.

This file must always mention which frameworks and versions are in use.

### Python Environment Management

- Use `uv` for all Python dependency management (replaces pip/venv).
- Python project configuration is in `scripts/` directory (pyproject.toml, .python-version, uv.lock).
- Run Python scripts with `cd scripts && uv run python script_name.py` or activate the environment.
- Install dependencies with `cd scripts && uv sync` (creates scripts/.venv/ automatically).
- Add dependencies with `cd scripts && uv add package_name`.
- Add dev dependencies with `cd scripts && uv add --dev package_name`.
- The lockfile `scripts/uv.lock` is committed for reproducible builds.

## Code Rules

- Naming: `<subject>_<verb>` for files/functions/vars.
- Naming avoidance: no camelCase, no verb_subject flips, no vague names.
- Filenames: `data_download.py`, `stats_calculate.py`, `site_build.py`.
- Functions: `dataset_fetch()`, `metrics_calculate()`, `json_save()`.
- Variables: `brand_stats`, `model_data`, `inspection_count`.
- File size: hard cap 400 LOC per file.
- Simplicity first: keep code (especially website code) minimal and straightforward before introducing abstractions.
- File split: split early before hitting the cap.
- Language: everything must be in English except for preserved dataset field names (RDW fields stay Dutch).
- RDW field names must stay exactly as provided by the datasets; do not rename them. Keep `docs/data_mapping.md` updated when fields are used.
- Mock data is not allowed; do not invent sample data—use real RDW data or explicitly request it.
- Logging: keep logs minimal; do not print date/time stamps.
- Python typing: always add type hints and docstrings.
- Python env: managed automatically by uv in `scripts/` directory; use `cd scripts && uv run` or activate via `source scripts/.venv/bin/activate`.
- Python formatting: run `cd scripts && uv run ruff format` before commit; hook + CI enforce it.
- TypeScript: strict mode, no `any`, no `console.log` in production.
- No emojis anywhere in code, UI, or docs.
- No bold formatting, unless absolutely necessary.
- Enforcement: pre-commit hook warns when staged files exceed 400 LOC (suggest split); ESLint for TypeScript; Ruff for Python.

## RDW API

- Base: `https://opendata.rdw.nl/resource/{id}.json`.
- Datasets:
  - Gekentekende Voertuigen (`m9d7-ebf2`)
  - Meldingen Keuringsinstantie (`sgfe-77wx`)
  - Geconstateerde Gebreken (`a34c-vvps`)
  - Gebreken (`hx2c-gt7k`)
  - Brandstof (`8ys7-d773`)

## Parquet Data Pipeline

### Data Download (`scripts/data_duckdb_export.py`)

- Downloads RDW datasets to Parquet format using DuckDB.
- Output: `data/duckdb/*.parquet` (gitignored).
- Column names must be preserved exactly as provided by RDW (with spaces and mixed case). Never normalize or transform column names.
- Supports incremental downloads with `--incremental` flag.
- Date fields for incremental filtering:
  - voertuigen: `datum_tenaamstelling`
  - meldingen/geconstateerde_gebreken: `meld_datum_door_keuringsinstantie`
  - gebreken: `ingangsdatum_gebrek`
  - brandstof: no date field (uses full download with merge)

### Hard Requirements

- Data must be downloaded and stored as-is without modification.
- RDW column names with spaces (e.g., `Meld datum door keuringsinstantie`) must be preserved exactly.

## Feature Flags

GitHub repository variables control optional behavior. Set in Settings > Secrets and variables > Actions > Variables.

| Variable | Values | Description |
|----------|--------|-------------|
| `INSPECTION_DAYS_LIMIT` | number / unset | When set to a positive number (e.g., `365`), only includes inspections from the past N days in Stage 1 download. Uses `meld_datum_door_keuringsinstantie` field for filtering. |

## Documentation

- `docs/ai-rules.md`: AI assistant guidance, code rules, frameworks, verification workflow.
- `docs/api-limits.md`: RDW API rate limits and pagination strategies.
- `docs/data_mapping.md`: RDW field names, data structures, and pipeline output formats.
- `docs/metrics.md`: Reliability calculations, formulas, age-bracket definitions, sample size thresholds.
- `docs/requirements.md`: Project requirements and acceptance criteria.
- `docs/todo.md`: Task tracking for outstanding work items.
- `docs/troubleshooting/`: Issue logs; one file per issue at `YYYY-MM-DD_<issue-slug>.md`.

Keep all docs up to date. Priority: update docs before any other work.
If a new requirement is suspected, ask the user to confirm, then add it.

### Task Tracking

- Track all outstanding work in `docs/todo.md`.
- Update todo.md before starting and after completing work.
- Mark tasks as done with `[x]` when completed.
- Add new tasks as they are discovered.

### Troubleshooting

- Create a file for every issue at `docs/troubleshooting/YYYY-MM-DD_<issue-slug>.md`.
- While troubleshooting: append new notes at the end, do not reread, and keep the doc live-updated.
- Coverage: include date/status, symptoms, root-cause analysis, changes made, resolution.
- After resolution: reformat and summarize the doc for clarity.

## Verification Workflow

- Run changes locally to verify functionality.
- Commit and push.
- Watch GitHub Actions until green.

## Pipeline Discipline

- Stage order is strict: Stage 1 (download) must complete successfully before Stage 2 (process) runs; Stage 2 must succeed before Stage 3 (build) runs. If a stage fails, later stages must not run and the pipeline should cancel.
