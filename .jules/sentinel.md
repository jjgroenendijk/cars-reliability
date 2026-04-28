## 2026-04-28 - [Fix API token substring leakage in logs]
**Vulnerability:** Substring of API token being printed in logs (`token[:8]`).
**Learning:** GitHub Actions secret masking only hides exact matches of secrets. Logging a substring (e.g. the first 8 characters) completely bypasses this masking and exposes part of the secret in plain text to anyone with log access.
**Prevention:** Never log any portion or substring of a secret, token, or password. Use static placeholder strings like `***` or `[MASKED]` when indicating that a secret is being used.