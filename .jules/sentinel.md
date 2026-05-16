## 2026-05-16 - [SOQL Injection via Third-Party API Response]
**Vulnerability:** Constructing a SOQL-like query using unsanitized IDs obtained from a third-party API response.
**Learning:** Even if data originates from a seemingly trusted third-party API response, it should be treated as untrusted and properly sanitized or escaped when interpolated into dynamic queries, preventing injection attacks (Defense in Depth).
**Prevention:** Always escape quotes (e.g. `id.replace(/'/g, "''")`) or strictly validate input strings before using them in SOQL/SQL queries, regardless of their source.
