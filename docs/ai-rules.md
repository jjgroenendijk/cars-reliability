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
- Python 3.11+
- Node.js 22+

This file must always mention which frameworks and versions are in use.

## Code Rules

- Naming: `<subject>_<verb>` for files/functions/vars.
- Naming avoidance: no camelCase, no verb_subject flips, no vague names.
- Filenames: `data_download.py`, `stats_calculate.py`, `site_build.py`.
- Functions: `dataset_fetch()`, `metrics_calculate()`, `json_save()`.
- Variables: `brand_stats`, `model_data`, `inspection_count`.
- File size: hard cap 400 LOC per file.
- File split: split early before hitting the cap.
- Language: English only.
- Preserve Dutch RDW field names in data fields.
- Python typing: always add type hints and docstrings.
- Python env: activate `venv/` via `source venv/bin/activate` before Python work.
- Python formatting: run `ruff format` (with venv active) before commit; hook + CI enforce it.
- TypeScript: strict mode, no `any`, no `console.log` in production.
- No emojis anywhere in code, UI, or docs.
- No bold formatting, unless absolutely necessary.
- Enforcement: pre-commit hook checks LOC and runs `ruff format`; ESLint for TypeScript; Ruff for Python.

## RDW API

- Base: `https://opendata.rdw.nl/resource/{id}.json`.
- Datasets:
  - Gekentekende Voertuigen (`m9d7-ebf2`)
  - Meldingen Keuringsinstantie (`sgfe-77wx`)
  - Geconstateerde Gebreken (`a34c-vvps`)
  - Gebreken (`hx2c-gt7k`)
  - Brandstof (`8ys7-d773`)

## Documentation

- `docs/ai-rules.md`: AI assistant guidance, code rules, frameworks, verification workflow.
- `docs/api-limits.md`: RDW API rate limits and pagination strategies.
- `docs/metrics.md`: Reliability calculations, formulas, age-bracket definitions, sample size thresholds.
- `docs/requirements.md`: Project requirements and acceptance criteria.
- `docs/troubleshooting/`: Issue logs; one file per issue at `YYYY-MM-DD_<issue-slug>.md`.

Keep all docs up to date. Priority: update docs before any other work.
If a new requirement is suspected, ask the user to confirm, then add it.

### Troubleshooting

- Create a file for every issue at `docs/troubleshooting/YYYY-MM-DD_<issue-slug>.md`.
- While troubleshooting: append new notes at the end, do not reread, and keep the doc live-updated.
- Coverage: include date/status, symptoms, root-cause analysis, changes made, resolution.
- After resolution: reformat and summarize the doc for clarity.

## Verification Workflow

- Run changes locally to verify functionality.
- Commit and push.
- Watch GitHub Actions until green.
