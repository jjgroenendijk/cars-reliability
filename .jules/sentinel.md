## 2024-05-25 - Fix SOQL Injection in Vehicle Lookup
**Vulnerability:** The vehicle lookup hook interpolated `gebrek_identificatie` directly into the RDW API `$where` clause without escaping single quotes, leading to a SOQL/SQL injection risk if the API returns unexpected data.
**Learning:** Even internal or third-party API data mapped into another API query must be treated as untrusted input and properly sanitized, as failure to do so allows payload injection and potential data exposure.
**Prevention:** Always escape single quotes (e.g., using `.replace(/'/g, "''")`) when constructing dynamic queries with interpolated strings, and avoid string concatenation where possible.
