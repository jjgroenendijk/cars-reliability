# Todo

> Outstanding work items for the Dutch Car Reliability project.

## Stage 1: Data Download (Python)

- [x] Create `scripts/data_download.py` - Fetch data from RDW API
- [x] Implement pagination with Socrata API limits
- [x] Add app token support for RDW API
- [x] Save raw data to `data/raw/`

## Stage 2: Data Processing (Python)

- [x] Create `scripts/data_process.py` - Compute reliability statistics
- [x] Calculate avg defects per inspection (by brand)
- [x] Calculate avg defects per inspection (by model)
- [x] Calculate defects per year (age-normalized)
- [x] Implement age-bracket analysis (4-7, 8-12, 13-20, 5-15 years)
- [x] Generate top/bottom 10 rankings
- [x] Save processed data to `data/processed/`

## Stage 3: Website (Next.js)

- [x] Initialize Next.js 16 project in `web/`
- [x] Configure Tailwind CSS 4.1
- [x] Create homepage with reliability overview
- [x] Create brand reliability table (sortable, filterable)
- [x] Create model reliability table (sortable, filterable)
- [ ] Create top 10 / bottom 10 pages for brands and models (homepage only shows top 5 previews)
- [ ] Create age-filtered views
- [x] Create license plate lookup (live RDW query)
- [x] Add inspection history view (live RDW query)
- [x] Add defect detail descriptions in lookup (hx2c-gt7k join)
- [x] Create about/methodology page
- [x] Configure static export for GitHub Pages
- [x] Add RDW attribution and data generation timestamp to the site
- [ ] Add common issues per model view (frequent defects)
- [ ] Add fuel type breakdown visualization (electric vs. diesel vs. petrol)
- [ ] Add historical reliability trend view
- [x] Enforce snake_case naming in React components, props, and state to comply with AI rules
- [x] Translate UI copy to English (keep RDW field names in Dutch only)
- [x] Split `web/app/lookup/page.tsx` below 400 LOC by extracting components/hooks

## Infrastructure

- [x] Create `.github/workflows/data_download.yml`
- [x] Create `.github/workflows/data_process.yml`
- [x] Create `.github/workflows/website_build.yml`
- [x] Set up caching strategy between workflows
- [x] Configure weekly schedule (Sunday midnight UTC)
- [x] Enforce stage gating so Stage 2 and 3 only run after the previous stage succeeds (remove direct push/dispatch paths)
- [x] Add gitignore coverage for `data/raw/` and `data/processed/` outputs; remove committed raw JSON
- [x] Make Stage 1 run on every push with cache-first strategy (download only on cache miss or weekly refresh)

## Development Setup

- [x] Create Python venv and install dependencies
- [x] Set up pre-commit hook for LOC warning when files exceed 400 lines
- [x] Create data directories (`data/raw/`, `data/processed/`)
- [x] Add VS Code tasks for common operations

## Documentation

- [x] Document Brandstof dataset (`8ys7-d773`) fields in `docs/data_mapping.md`
- [x] Record lookup/live query fields in `docs/data_mapping.md` once inspection history and defect details are added

## Experiments

- [x] Evaluate bulk CSV export (`scripts/data_export.py`) as alternative to paginated API
  - Created `scripts/data_export.py` with streaming CSV, parallel downloads, verbose flag
  - Verbose flag shows download speed; disabled in CI for cleaner logs
  - Uses 3 parallel threads for dataset downloads
  - ~3 MB/s download speed observed

## Testing / Verification

- [ ] Run data_download.py locally to verify API access
- [ ] Run data_process.py with sample data
- [ ] Build and test Next.js static export locally
- [ ] Verify GitHub Actions workflows run correctly
