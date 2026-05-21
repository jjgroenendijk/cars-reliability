## 2024-05-21 - [SOQL Injection via Interpolation]
**Vulnerability:** SOQL injection vulnerability in `vehicle_lookup_use.ts` due to unescaped third-party data directly interpolated into the `$where` clause.
**Learning:** Socrata/OData APIs that use SOQL-like `$where` syntax are vulnerable to string-termination attacks if parameters are dynamically built via string templates without escaping.
**Prevention:** Always sanitize or escape strings (`String(id).replace(/'/g, "''")`) before interpolation, even if the data comes from external APIs, to implement Defense in Depth.
