## 2024-05-31 - [Medium] Fix SOQL Injection in Vehicle Lookup

**Vulnerability:** SOQL Injection vulnerability in `$where` query interpolation for RDW API
**Learning:** `gebrek_identificatie` was directly string-interpolated in a mapped array loop without escaping, creating an attack vector if upstream API values contained single quotes.
**Prevention:** Always escape single quotes (`.replace(/'/g, "''")`) when interpolating string variables into SOQL `$where` clauses.
