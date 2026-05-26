## 2024-05-26 - Prevent SOQL/SQL Injection in RDW API Query
**Vulnerability:** SOQL/SQL injection vulnerability due to unsanitized interpolation of third-party API data (`gebrek_identificatie`) into a `$where` query clause.
**Learning:** Data from third-party APIs (even trusted ones like RDW) must be treated as untrusted and properly sanitized before being used to construct dynamic queries to prevent injection vulnerabilities (Defense in Depth).
**Prevention:** Always escape single quotes (e.g., `.replace(/'/g, "''")`) when interpolating dynamic data into SQL-like query strings in the frontend.
