## 2024-05-18 - Prevent substring leakage of secrets in logs
**Vulnerability:** API token substrings were logged to stdout.
**Learning:** Secret masking in CI/CD logs only applies to exact string matches, leaving substrings exposed and creating credential leaks.
**Prevention:** Never log substrings of secrets; use a static replacement like `[MASKED]` instead.
