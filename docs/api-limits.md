# API limits

## GitHub

- Actions API: ~1,000 requests/hour per user
- Artifacts: soft cap ~2 GB per artifact
- Cache: 10 GB total per repo
- Rate errors: 403 `rate limit exceeded`; back off and retry

## RDW Open Data API (Socrata)

- Request rate: ~1,000 requests/hour with app token (`X-App-Token`)
- Anonymous use: throttled quickly; shared IP pool
- Throttle response: HTTP 429 on excess; back off before retry
- Rows per call: default 1,000 rows if `$limit` omitted
- Max rows per call: up to 50,000 rows with `$limit`
- Pagination: use `$offset` + `$limit` to retrieve >50k rows
- Total data: no hard cap on total rows; paging required for large pulls
- Payload size: keep responses below ~250 MB by tuning `$limit` and selected columns
