# Dutch Car Reliability Analysis

This project analyzes vehicle inspection (APK) data from the Dutch RDW to determine which cars are most reliable.

## Quick Links

- [Architecture](architecture.md) - How the system is designed
- [Data Sources](data-sources.md) - RDW datasets and API details
- [Metrics](metrics.md) - How reliability is measured
- [Development](development.md) - Local setup and contribution guide

## Overview

The Dutch RDW (Rijksdienst voor het Wegverkeer) maintains a public database of all registered vehicles and their inspection results. This project:

1. **Fetches** inspection defect data from the RDW Open Data API
2. **Processes** the data to calculate reliability metrics per brand/model
3. **Generates** a static website showing the results
4. **Deploys** automatically via GitHub Actions

## Live Site

View the results at: **[jjgroenendijk.nl/cars-reliability](https://jjgroenendijk.nl/cars-reliability/)**

## Project Status

This is an MVP (Minimum Viable Product). Current limitations:

- Sample size is limited to ~100k defect records
- Only one metric (average defects per vehicle)
- No age normalization (older cars naturally have more defects)
- No visualization/charts yet

See [Future Improvements](future.md) for planned enhancements.
