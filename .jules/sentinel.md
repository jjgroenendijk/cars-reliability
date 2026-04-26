
## 2024-05-24 - [Token Leakage in Logs]
**Vulnerability:** The RDW app token was partially logged in plain text.
**Learning:** GitHub Actions only masks exact secret strings, so logging substrings bypasses secret masking and exposes the token.
**Prevention:** Avoid logging partial sensitive tokens or use fully masked placeholders when logging secrets.
