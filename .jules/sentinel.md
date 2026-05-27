## 2024-05-27 - Fix SOQL Injection in Vehicle Lookup
**Vulnerability:** SOQL injection vulnerability in `vehicle_lookup_use.ts` due to unsanitized interpolation of defect IDs into the `$where` clause.
**Learning:** Even when IDs are sourced from an API response, strictly sanitize inputs in dynamic queries (Defense in Depth).
**Prevention:** Always escape single quotes (e.g., `.replace(/'/g, "''")`) when interpolating strings into SOQL/SQL queries.
