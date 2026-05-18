## 2025-01-30 - Prevent SOQL Injection in dynamic RDW API queries
**Vulnerability:** Unsanitized defect IDs interpolated directly into `$where` OData/SOQL queries.
**Learning:** Even when data comes from a third-party API initially, interpolating it directly into another API query without escaping creates an injection risk.
**Prevention:** Always escape single quotes in strings interpolated into dynamic queries, e.g., using `.replace(/'/g, "''")`.
