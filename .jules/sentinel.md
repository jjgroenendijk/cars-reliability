## 2025-05-19 - Fix SOQL Injection in Vehicle Lookup
**Vulnerability:** SOQL injection vulnerability via unsanitized `gebrek_identificatie` parameter in the `vehicle_lookup_use.ts` hook.
**Learning:** Dynamic query construction for third-party APIs (like RDW) must escape user inputs even if the input source is indirect (like defect IDs).
**Prevention:** Always sanitize string interpolations in `$where` clauses using `.replace(/'/g, "''")` to prevent query injection.
