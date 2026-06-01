## 2025-06-01 - Prevent SQL/SoQL Injection in RDW API
**Vulnerability:** Unsanitized defect IDs were being joined and passed directly into a `$where` query parameter in `web/app/lookup/hooks/vehicle_lookup_use.ts`, creating a potential injection vulnerability against the external RDW Socrata API.
**Learning:** Even though we're querying an external Open Data API and the input originates from a previous API response (defect IDs), we should never trust dynamic data when constructing query strings like `$where`.
**Prevention:** Strictly sanitize all interpolated inputs in dynamic queries by escaping single quotes (`.replace(/'/g, "''")`) to implement Defense in Depth.
