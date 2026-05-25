# Automation Contributor Rules

> Dense guidance for automated coding contributors.

## Critical Rule

> [!CAUTION]
> **All frontend data and constants MUST derive from backend JSON.**
> Never hardcode values (filter ranges, fuel types, age brackets, thresholds, labels, etc.) in frontend code. The Python pipeline calculates dynamic values (min/max ranges, lists, thresholds) and writes them to `metadata.json` or other processed JSON files. Frontend must always read from these files.
> If a frontend default cannot be derived from backend JSON, define it in `web/app/lib/defaults.ts` (and nowhere else).

## Architecture

```mermaid
flowchart LR
    subgraph Stage1["Stage 1: Download"]
        DL[data_download.py]
    end
    subgraph Stage2["Stage 2: Process"]
        IP[inspection_prepare.py]
        DP[data_process.py]
        SC[stats_calculate.py]
    end
    subgraph Stage3["Stage 3: Build"]
        WEB[Next.js static site]
    end

    RDW[(RDW API)] --> DL
    DL --> PQ[(data/parquet/)]
    PQ --> IP --> DP --> SC
    SC --> JSON[(data/processed/*.json)]
    JSON --> WEB --> GH[GitHub Pages]
```

**Pipeline discipline**: Stages run sequentially. Stage N must succeed before Stage N+1 runs.

**Stage 2 modules**: `data_process.py` orchestrates Stage 2 and delegates to the helper modules `inspection_prepare.py`, `inspection_stats.py`, `stats_aggregate.py`, `defect_build.py`, and `fuel_build.py`. Shared helpers live in `config.py`, `api_client.py`, `system_utils.py` (memory/filesystem utilities), and `cache_validate.py`.

**Re-run requirement**: After modifying `data_process.py` or any script that changes JSON output, always re-run the pipeline:
```bash
cd scripts && uv run data_process.py
cd ../web && npm run dev  # JSON files sync automatically via predev hook
```

## Project Structure

- `scripts/` — Stage 1-2: Python data pipeline
- `web/` — Stage 3: Next.js static site
- `data/parquet/` — Raw RDW data (gitignored)
- `data/processed/` — JSON for web (gitignored)
- `docs/` — All documentation

### Frontend (`web/app/`)

- `page.tsx` — Homepage
- `data/`, `statistics/`, `defects/`, `fuels/`, `lookup/`, `about/` — Route pages
- `components/` — Reusable UI (sliders, filters, tables, navigation)
- `hooks/` — Data fetching and processing (`useStatisticsData`, `useDefectData`, `useFuelData`, `useUrlSync`)
- `lib/types.ts` — TypeScript interfaces for all JSON data
- `lib/data_load.ts` — JSON fetch utilities
- `lib/statistics_config.ts` — Table column definitions

## Tech Stack

- Python 3.11+ (managed via uv, config in `scripts/`)
- Polars for data processing: LazyFrames (`scan_*`) and native functions are **mandatory**; actively refactor any Python loops or dicts to Polars-native code
- Memory constraint: full dataset cannot fit in memory; always use streaming/lazy processing
- Next.js 16, Tailwind CSS 4.1, Node.js 22+
- `.env` stores the RDW app token; never commit it

## Code Standards

### Naming Convention: `<subject>_<verb>`

- **Files**: `data_download.py`, `stats_calculate.py` *(not `downloadData.py`)*
- **Functions**: `dataset_fetch()`, `json_save()` *(not `fetchDataset()`)*
- **Variables**: `brand_stats`, `model_data` *(not `brandStats`)*

### Rules

- File size: hard cap 400 LOC; split early
- Language: English everywhere except RDW field names (stay Dutch, exactly as provided)
- Python: type hints + docstrings required; format with Ruff before commit
- TypeScript: strict mode, no `any`, no `console.log` in production
- No emojis, no mock data, minimal logging (no timestamps)
- No tool attribution: do not include assistant/tool branding, model names,
  automation signatures, or generated-by language in branch names, commit
  messages, PR titles/bodies, code, docs, comments, UI text, or generated
  artifacts. Use human-readable task names only.

## Boundaries

**Always:**
- Derive frontend values from backend JSON
- Preserve RDW column names exactly
- Update `docs/data_mapping.md` when using new fields
- Run formatter before commit
- Keep files under 400 LOC

**Ask First:**
- Adding new dependencies
- Major architecture changes
- Modifying CI/CD config

**Never:**
- Hardcode filter ranges, labels, or thresholds in frontend
- Rename/normalize RDW fields
- Commit `.env` or secrets
- Use mock/invented data
- Print date/time in logs

## RDW API

Base URL: `https://opendata.rdw.nl/resource/{id}.json`

- **Gekentekende Voertuigen** (`m9d7-ebf2`)
- **Meldingen Keuringsinstantie** (`sgfe-77wx`)
- **Geconstateerde Gebreken** (`a34c-vvps`)
- **Gebreken** (`hx2c-gt7k`)
- **Brandstof** (`8ys7-d773`)

## Documentation

- `docs/ai-rules.md` — This file: automation guidance, architecture, commands
- `docs/api-limits.md` — RDW rate limits and pagination
- `docs/data_mapping.md` — RDW field names and pipeline output formats
- `docs/metrics.md` — Defect metrics, age brackets, thresholds
- `docs/requirements.md` — Project requirements and acceptance criteria
- `docs/todo.md` — Task tracking (update before/after work)
- `docs/troubleshooting/` — Issue logs: `YYYY-MM-DD_<slug>.md` format

Keep docs current. Priority: update docs before any other work.

## Git Workflow

**Always push changes to a new PR.** Every code change must be submitted via a pull request — never commit directly to `main`.

## Verification Workflow

1. Run changes locally
2. Commit and push to a feature branch
3. Open a pull request
4. Watch GitHub Actions until green
