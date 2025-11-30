# Future Improvements

## Short-term (Next iteration)

### Data Enhancements
- [ ] Increase sample size to 500k+ defect records
- [ ] Add vehicle age to analysis (normalize by age cohort)
- [ ] Include APK pass/fail rates (need to find dataset)
- [ ] Add fuel type breakdown (petrol, diesel, electric, hybrid)

### Website Improvements
- [ ] Add interactive charts (Chart.js or similar)
- [ ] Search/filter functionality
- [ ] Mobile-responsive design improvements
- [ ] Add data download option (CSV export)

### Metrics
- [ ] Age-normalized reliability scores
- [ ] Confidence intervals for rankings
- [ ] Defect category breakdown (brakes, lights, emissions, etc.)

## Medium-term

### Additional Data Sources
- [ ] Terugroepacties (recalls) - measure recall frequency by brand
- [ ] Mileage data (if available)
- [ ] Historical trends (year-over-year comparison)

### Analysis Features
- [ ] Compare specific models head-to-head
- [ ] Best cars in price categories
- [ ] Reliability by model year
- [ ] Regional differences (if any)

### Technical Improvements
- [ ] Add proper Python tests (pytest)
- [ ] Type checking with mypy
- [ ] Better error handling and logging
- [ ] Caching for API responses

## Long-term Vision

### Full Reliability Dashboard
- Interactive exploration of all Dutch car reliability data
- Personalized recommendations based on user criteria
- Integration with car buying guides

### API Service
- Provide reliability data via REST API
- Enable third-party integrations
- Real-time data updates

### Machine Learning
- Predict future reliability based on early defect patterns
- Identify emerging reliability issues
- Anomaly detection for data quality

## Non-goals

Things explicitly out of scope:

- **Real-time data**: Weekly updates are sufficient for this use case
- **Personal data**: We don't need or want individual vehicle histories
- **Commercial use**: This is an open-source educational project
- **Comparison with other countries**: Focus is on Dutch market only

## How to Contribute

See [development.md](development.md) for setup instructions. 

Priority areas for contributions:
1. Data visualization (JavaScript charts)
2. Additional reliability metrics
3. Documentation improvements
4. Test coverage

Open an issue on GitHub to discuss new features before implementing.
