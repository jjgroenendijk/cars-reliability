Short answer: **RDW itself doesn’t set hard daily/weekly quotas, but the Socrata platform under it does enforce technical throttling and response-size limits.**

Here’s the concrete picture.

---

## 1. RDW’s own policy (conceptual limits)

RDW’s “Algemene informatie” page about open data says:

* Open data are **“gratis en zonder beperking beschikbaar”** – free and without restriction for every user.([RDW][1])

So there’s **no RDW-specific commercial plan or formal quota** like “X calls per day per user”.

However, in the official RDW Google Group, someone hit `"Too many requests"` using the API, and RDW answered:

> “Er is geen limiet op het bevragen van open data. De techniek kent wel een throttle limit… Meer daarover is te vinden op dev.socrata.com/docs/app-tokens.html”([Google Groups][2])

So: **RDW doesn’t cap you**, but the **Socrata/“Data & Insights” platform** does.

---

## 2. Platform-level limits (Socrata / SODA) that apply to opendata.rdw.nl

RDW runs on Tyler/Socrata’s platform. The generic SODA docs tell you what the API can do.

### 2.1 Row limits per request (`$limit` / `$offset`)

From the SODA **LIMIT** docs:([Socrata Developers][3])

* Default:

  * Any SODA query returns **1,000 rows by default** if you don’t specify `$limit`.
* Maximum `$limit` depends on API version:

  * **v2.0 endpoints:** max `$limit = 50,000` rows.
  * **v2.1 and v3.0 endpoints:** **no fixed max** in the docs – but you’re practically limited by response size and timeouts.

RDW datasets expose **v3 endpoints** in the “API Docs” (e.g. Gekentekende_voertuigen).([Socrata Developers][4])

**Practically for you:**

* Always use `$limit` + `$offset` (or the `?page=` style in v3) and **page** through large tables.
* Stick to **slices like 10k–50k rows per request**; bigger is possible but increases timeout / memory risk.

---

### 2.2 Response-size limit (≈ 250 MB per query/export)

Nearly every RDW dataset page contains this line in the export section:

> “limiet van 250MB. Ontdek meer over externe integraties op …”([RDW][5])

That 250 MB limit is about **dataset exports / external integrations** (Excel, Power BI, etc.), but it gives you a **good rule of thumb** for API responses too: don’t design queries that return hundreds of MB at once.

There’s also a mention of **5 MB** limits for some specific connectors on some datasets (e.g. Autodata), again for external integrations rather than raw SODA.([RDW][6])

---

### 2.3 Throttling / rate limits

The official SODA “Application Tokens” page says:([Socrata Developers][7])

* **Without an application token**:

  * Throttling is done per **IP address**.
  * “IP addresses that make too many requests during a given period may be subject to throttling.”
* **With an application token**:

  * Each token gets its **own pool of API requests**.
  * They currently **do not throttle** app-token traffic in normal use; only if considered abusive/malicious.

If you’re throttled, you get **HTTP 429 Too Many Requests** (RDW users report this exact message).([Google Groups][2])

Some third-party docs and blog posts mention numbers like “~1000 requests/hour” for anonymous access or for certain portals, but those are **not RDW-specific guarantees** and aren’t in the official RDW docs.([Medium][8])

**Practically:**

* **Always register a Socrata app token** and send it as `X-App-Token` header.
* Expect that hammering the API with **many requests per second** can still trigger throttling, even with a token.
* Implement retry logic on **HTTP 429** with backoff.

---

## 3. Quick checklist if you’re building a pipeline on RDW data

For your reliability project, where you’ll likely pull millions of rows:

1. **Use app tokens**

   * Get one via a Socrata account and set `X-App-Token`.([Socrata Developers][7])

2. **Page your queries**

   * Start with `$limit=50000`, `$offset=0, 50000, 100000, …` for v2 endpoints.
   * For v3 endpoints, use the documented pagination style, but still keep each chunk ≤ 50k rows or well below 250 MB.

3. **Watch payload size**

   * If a single request approaches 250 MB or starts timing out, reduce `$limit`.

4. **Be polite on rate**

   * A few requests per second with an app token is usually fine; adapt if you see 429s.
   * Build in exponential backoff on 429 and maybe log the rate you’re actually sustaining.

5. **For full dumps / heavy analytics**

   * Consider **downloading CSV exports** (respecting the 250 MB limit) and then processing locally / in a data warehouse.([Data Overheid][9])

---

If you tell me roughly how many rows you expect to pull (e.g. “entire vehicle base once per day”, “APK defects history” etc.), I can sketch a concrete fetch pattern with example URLs and safe `$limit/$offset` values tuned to that size.

[1]: https://www.rdw.nl/over-rdw/dienstverlening/open-data/algemene-informatie "Algemene informatie | RDW"
[2]: https://groups.google.com/g/voertuigen-open-data/c/9WUAx7QYeP0 "api limiet"
[3]: https://dev.socrata.com/docs/queries/limit.html "The LIMIT Clause | Socrata"
[4]: https://dev.socrata.com/foundry/opendata.rdw.nl/m9d7-ebf2?utm_source=chatgpt.com "Open Data RDW: Gekentekende_voertuigen - Socrata"
[5]: https://opendata.rdw.nl/Voertuigen/Voertuiggegevens/geua-9uwi?utm_source=chatgpt.com "Voertuiggegevens"
[6]: https://opendata.rdw.nl/Voertuigen/Autodata/5pcv-h9bm?utm_source=chatgpt.com "Autodata"
[7]: https://dev.socrata.com/docs/app-tokens.html "Application Tokens | Socrata"
[8]: https://medium.com/analytics-vidhya/accessing-nyc-open-data-apis-with-application-tokens-6b004f8a27c8?utm_source=chatgpt.com "Accessing NYC Open Data APIs with Application Tokens"
[9]: https://data.overheid.nl/dataset/11441-open-data-rdw--gekentekende-voertuigen?utm_source=chatgpt.com "Open Data RDW: Gekentekende_voertuigen"
