# API limits

## GitHub

- Actions API: ~1,000 requests/hour per user (GitHub default); avoid heavy polling.
- Artifact sizes: soft cap ~2 GB per artifact; keep stage outputs small.
- Cache: 10 GB total per repo; cache keys should be versioned for invalidation.
- Rate errors: 403 with `rate limit exceeded`; back off and retry later.

## RDW Dataset API (Socrata)

- Defaults: 1,000 rows if no `$limit`; use app token (`X-App-Token`) to avoid IP throttling.
- Page size: v2 max ≈50k rows; v3 “no fixed max” but stick to 10k–50k to stay under timeouts.
- Response size: treat 250 MB as the ceiling; shrink `$limit` or window if nearing it.
- Throttling: 429 on excess; use exponential backoff; a few req/s is usually safe with a token.
- Checklist: token, paging, payload <250 MB, backoff on 429, log size/rate.