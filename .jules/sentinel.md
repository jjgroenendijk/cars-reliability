## 2024-05-27 - Fix SOQL injection vulnerability in vehicle lookup

**Vulnerability:** SOQL injection in the `$where` query to the RDW API when retrieving defect descriptions by ID.
**Learning:** External API IDs or input must still be validated and escaped to prevent query injection logic (Defense in Depth) when dynamic API calls are constructed client-side via query parameters.
**Prevention:** Always use `encodeURIComponent` correctly and fully escape single quotes (e.g. `.replace(/'/g, "''")`) for any variable interpolated into a SOQL or SQL-like query string.
