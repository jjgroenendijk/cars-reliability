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
- [x] Create top 10 / bottom 10 pages
- [ ] Create age-filtered views
- [x] Create license plate lookup (live RDW query)
- [x] Create about/methodology page
- [x] Configure static export for GitHub Pages

## Infrastructure

- [x] Create `.github/workflows/data_download.yml`
- [x] Create `.github/workflows/data_process.yml`
- [x] Create `.github/workflows/website_build.yml`
- [x] Set up caching strategy between workflows
- [x] Configure weekly schedule (Sunday midnight UTC)

## Development Setup

- [x] Create Python venv and install dependencies
- [x] Set up pre-commit hook for LOC warning when files exceed 400 lines
- [x] Create data directories (`data/raw/`, `data/processed/`)
- [ ] Add VS Code tasks for common operations

## Testing / Verification

- [ ] Run data_download.py locally to verify API access
- [ ] Run data_process.py with sample data
- [ ] Build and test Next.js static export locally
- [ ] Verify GitHub Actions workflows run correctly
