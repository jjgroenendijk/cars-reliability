# API limits

## GitHub

- Pages builds: soft cap 10 builds/hour; Actions-built Pages follow Actions limits instead
- Pages bandwidth: soft cap 100 GB/month served
- Pages size/time: source repo recommended <1 GB; published site must be ≤1 GB; deploy builds time out after 10 minutes
- Pages custom domains: one per site on any plan; Free requires public repos, Pro+ allows private
- Pages usage: static sites only; heavy traffic may see 429 throttling
- Actions minutes (private repos): Free 2,000/mo, Pro 3,000/mo; public repos unlimited
- Actions runner multiplier: Linux 1×, Windows 2×, macOS 10× against minutes
- Actions concurrency: Free up to 20 concurrent jobs (max 5 macOS), Pro up to 40 (max 5 macOS)
- Actions duration: per job max 6 hours on hosted; workflow max 35 days; self-hosted job max 5 days
- Actions burst limits: up to 1,500 workflow events per 10s; max 256 matrix jobs per workflow; max 500 queued runs per 10s
- Actions storage: artifacts 500 MB (Free) / 1 GB (Pro) per repo; cache 10 GB per repo; artifact/log retention defaults to 90 days
- GITHUB_TOKEN API limit: 1,000 requests/hour per repo (15,000/hour for Enterprise Cloud org token); standard user PAT is 5,000/hour
- API unauthenticated: 60 requests/hour per IP; authenticated user/app: 5,000/hour; search API: 30 search/min, 10 code search/min; GraphQL: points-based (typical 5,000 points/hour)

## RDW Open Data API (Socrata)

- Request rate: ~1,000 requests/hour with app token (`X-App-Token`)
- Anonymous use: throttled quickly; shared IP pool
- Throttle response: HTTP 429 on excess; back off before retry
- Rows per call: default 1,000 rows if `$limit` omitted
- Max rows per call: up to 50,000 rows with `$limit`
- Pagination: use `$offset` + `$limit` to retrieve >50k rows
- Total data: no hard cap on total rows; paging required for large pulls
- Payload size: keep responses below ~250 MB by tuning `$limit` and selected columns

## Dynamic Rate Limit Handling

The `data_download.py` script implements adaptive rate limiting:

- Starts with 8 parallel workers per dataset
- On HTTP 429 response: halves workers (min 2) and applies exponential backoff
- Wait times: 2s, 4s, 8s, 16s, 32s (capped)
- Cooldown: 30s between worker reductions
- Recovery: slowly restores rate limit count on successful requests

## Parallel Download Strategy

Stage 1 uses parallel fetching at two levels:

1. Dataset level: All 5 datasets download in parallel jobs (GitHub Actions)
2. Page level: Within each dataset, multiple pages are fetched concurrently

For grouped queries (meldingen, geconstateerde_gebreken), an `$order` clause is required to enable deterministic parallel pagination.

Progress output format: `dataset: X% | page Y/Z | rows A/B | C MB`

## Per-Dataset Caching

Each dataset has its own GitHub Actions cache:

- Cache key format: `dataset-v2-WEEK-days-DAYS-HASH`
- Enables partial retries (only re-download failed datasets)
- Job timeout: 60 minutes per dataset

## Environment Variables

App token can be set via (checked in order):

1. `RDW_APP_TOKEN` - preferred, use for GitHub Actions secret
2. `APP_Token` - alternative, used in local `.env` file
