# Requirements

## Overview

This document defines the requirements for the Dutch Car Reliability Analysis project. The project analyzes APK (vehicle inspection) data from RDW Open Data to calculate and display car reliability metrics.

## Requirement Stewardship

- Requirements are the first and highest priority; keep this document current before any implementation work.
- When a new requirement is suspected but uncertain, pause and ask the user to confirm, then add it here once confirmed.
- Treat this file as the single source of truth; other docs (e.g., development) should point back here.

---

## Pipeline Architecture

The project MUST use a 3-stage pipeline with separate GitHub Actions workflows:

- Stage 1: `data_download.yml` (Python) - Fetch data from RDW API
- Stage 2: `data_process.yml` (Python) - Compute reliability statistics
- Stage 3: `website_build.yml` (TypeScript) - Build and deploy static website

### Stage Dependencies

Stage 1 (Download) leads to Stage 2 (Process) leads to Stage 3 (Build).

- Each stage MUST have its own workflow file
- Stages communicate via GitHub Actions cache/artifacts
- Each stage can be re-run independently

---

## Data Requirements

### Data Sources

All data comes from [RDW Open Data](https://opendata.rdw.nl/) via the Socrata API.

- Gekentekende Voertuigen (`m9d7-ebf2`)
- Meldingen Keuringsinstantie (`sgfe-77wx`)
- Geconstateerde Gebreken (`a34c-vvps`)
- Gebreken (`hx2c-gt7k`)
- Brandstof (`8ys7-d773`)

### Data Filters

- Vehicle type: `voertuigsoort='Personenauto'` - Exclude trucks, motorcycles

### Data Processing Constraints

- Processing MUST complete within GitHub Actions time limits
- The method (full download vs. SoQL aggregation) is flexible
- Weekly refresh schedule (Sundays at midnight UTC)

### Caching

- GitHub Actions cache MUST be used effectively
- Cache keys MUST include version prefix for invalidation
- Large datasets SHOULD be cached between workflow runs

---

## Website Requirements

### Technology Stack

- Framework: Next.js 16
- Styling: Tailwind CSS 4.1
- Output: Static export
- Hosting: GitHub Pages

### Pre-computed Features (from pipeline data)

- Top 10 most reliable models
- Bottom 10 least reliable models
- Top 10 most reliable brands
- Bottom 10 least reliable brands
- Full brand reliability table (sortable, filterable)
- Full model reliability table (sortable, filterable)
- Age-filtered views (e.g., cars 5-15 years old)
- Average defects per year per model
- About/methodology page

### Live Query Features (browser to RDW API)

- License plate (kenteken) lookup
- Vehicle inspection history
- Defect details with descriptions

### Future Features (Backlog)

- Common issues per model - Most frequent defect types
- Fuel type breakdown - Electric vs. diesel vs. petrol
- Historical trend analysis - Reliability over years

### Design Requirements

- Responsive design (mobile-friendly)
- No emojis in UI
- Clear data attribution to RDW
- Show data generation timestamp
- Modular HTML structure
- CSS in separate files

---

## Infrastructure Requirements

### GitHub Actions

- Workflow count: 3 separate YAML files
- Branch: Single branch (`main`)
- Schedule: Weekly (Sunday midnight UTC)
- Timeout: Must complete within limits

### Caching Strategy

- Raw data: Key `raw-data-v{version}-{date}` - Stage 1 output
- Processed data: Key `processed-data-v{version}-{date}` - Stage 2 output
- Next.js build: Key `nextjs-{hash}` - Build cache
- Node modules: Key `node-modules-{hash}` - Dependencies

## Development Workflow (Local)

### Prerequisites

- Python 3.11+, Node.js 22+, Git.

### Environment Setup

Activate Python venv, install Python requirements, then install Node dependencies in `web/`.

### Pipeline Commands

Run `data_download.py` (Stage 1), then `data_process.py` (Stage 2), copy processed data to `web/public/data/`, then run Next.js dev or build.

### Checks

- LOC: keep every file ≤400 lines (Python/TS/TSX); add VS Code task or script as needed.
- Formatting: run `ruff format` (venv active) before committing; hook enforces this.
- Python quality: `python -m pytest scripts/` (when present), `python -m mypy scripts/`.
- TypeScript quality: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

### Git Hooks

- Install a pre-commit hook that runs LOC checks and `ruff format`; it MUST block commits on violations.

### Contribution Flow

1) Create feature branch from `main`.  
2) Follow naming, LOC, and formatting rules.  
3) Run required checks (ruff, LOC, tests, lint, type-check).  
4) Commit and push.  
5) Open PR and ensure GitHub Actions (including `ruff format --check`) are green.
