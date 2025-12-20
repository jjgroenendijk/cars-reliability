# Dutch Car Reliability Analysis

A data analysis project that evaluates car brand and model reliability using official Dutch vehicle inspection data from RDW Open Data. The project processes millions of APK inspection records to calculate reliability metrics and presents them through an interactive website. Rankings show the most and least reliable vehicles, with filtering by age bracket and live license plate lookup.

**Links:** [Live Site](https://jjgroenendijk.github.io/cars-reliability/) | [GitHub](https://github.com/jjgroenendijk/cars-reliability)

[![Website Build & Deploy](https://github.com/jjgroenendijk/cars-reliability/actions/workflows/website_build.yml/badge.svg)](https://github.com/jjgroenendijk/cars-reliability/actions/workflows/website_build.yml)

## Overview

This project calculates reliability metrics for car brands and models using official inspection data from [RDW Open Data](https://opendata.rdw.nl/). The website displays top 10 and bottom 10 rankings, with the ability to filter by vehicle age.

## Features

- **Top/Bottom 10 Rankings** - Most and least reliable brands and models
- **Age-Bracket Analysis** - Compare reliability for cars 5-15 years old
- **Sortable Tables** - Full brand and model data, filterable and sortable
- **Live License Plate Lookup** - Real-time vehicle inspection history
- **Weekly Updates** - Data refreshed automatically via GitHub Actions

## Architecture

The project uses a 3-stage pipeline:

```text
Stage 1: Data Download (Python)  → Fetch from RDW API
Stage 2: Data Processing (Python) → Calculate statistics
Stage 3: Website Build (Next.js)  → Deploy to GitHub Pages
```

## Data Sources

| Dataset | ID | Description |
|---------|-----|-------------|
| Meldingen Keuringsinstantie | `sgfe-77wx` | Inspection results (pass/fail) |
| Gekentekende voertuigen | `m9d7-ebf2` | Vehicle registrations (make, model) |
| Geconstateerde Gebreken | `a34c-vvps` | Defects found during inspections |
| Gebreken | `hx2c-gt7k` | Defect type descriptions |

## Technology Stack

| Component | Technology |
|-----------|------------|
| Data Pipeline | Python 3.11+ |
| Website | Next.js 16 |
| Styling | Tailwind CSS 4.1 |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 22+

### Setup

```bash
# Clone repository
git clone https://github.com/jjgroenendijk/cars-reliability.git
cd cars-reliability

# Python setup
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Node.js setup
cd web && npm install
```

### Run Pipeline

```bash
# Stage 1: Download data
python scripts/data_download.py

# Stage 2: Process data
python scripts/data_process.py

# Stage 3: Run website
cp -r data/processed/* web/public/data/
cd web && npm run dev
```

## License

Data from RDW Open Data is [CC0 (Public Domain)](https://creativecommons.org/publicdomain/zero/1.0/).
