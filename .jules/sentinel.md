
## 2024-04-24 - Exposed API Token in Logging
**Vulnerability:** Partial API token logged in `scripts/api_client.py` during initialization.
**Learning:** Even partial logging of tokens (e.g., first 8 chars) can be sufficient to narrow down search spaces for brute-forcing, leak environment details, or violate security compliance. Hardcoded sliced logging must be avoided.
**Prevention:** Always use static placeholder strings (e.g., `***` or `<REDACTED>`) or proper masking functions when logging authentication events, regardless of the token's length or source environment variable name.
