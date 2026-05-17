## 2024-05-17 - Fix SOQL Injection in Defect Lookup
**Vulnerability:** SOQL Injection vulnerability due to unsanitized third-party API data (`gebrek_identificatie`) being concatenated into a dynamic SoQL query `$where` clause.
**Learning:** Third-party API data cannot be trusted. Constructing dynamic queries on the frontend using unescaped data can lead to injection attacks against the API provider.
**Prevention:** Implement Defense in Depth by always sanitizing interpolated inputs. In this case, escape single quotes by doubling them (`.replace(/'/g, "''")`) before inserting them into SoQL/SQL queries.
