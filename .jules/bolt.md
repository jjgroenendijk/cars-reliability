## 2024-05-29 - Intl Formatter Caching
**Learning:** `toLocaleString` and `toLocaleDateString` in V8/Node.js incur massive overhead (up to 100x slower) when passed an options object in hot loops, due to repeated instantiation of underlying Intl formatters.
**Action:** Always cache `Intl.NumberFormat` and `Intl.DateTimeFormat` instances at the module level when formatting data in large collections.
