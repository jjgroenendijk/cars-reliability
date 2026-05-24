## 2026-05-24 - Unsanitized Input in RDW API SODA Queries
**Vulnerability:** SOQL/SODA injection vulnerability in `vehicle_lookup_use.ts` where dynamic query strings interpolated `id` variables without sanitization (`$where=gebrek_identificatie='${id}'`).
**Learning:** Data from external APIs, even when used as identifiers for subsequent API calls, must be sanitized if used in dynamic query construction to prevent injection attacks against the third-party service (Defense in Depth).
**Prevention:** Always escape single quotes (e.g., `.replace(/'/g, "''")`) or use parameterized queries when constructing dynamic SODA/SQL `$where` clauses in the frontend.
