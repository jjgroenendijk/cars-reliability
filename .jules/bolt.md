## 2024-05-24 - Intl vs toLocaleString performance
**Learning:** In frontend performance, caching `Intl.DateTimeFormat` and `Intl.NumberFormat` instances at the module level rather than calling `.toLocaleString()` or `.toLocaleDateString()` with options repeatedly provides massive performance gains (~45x faster for dates, ~65x faster for numbers with options).
**Action:** When a helper function formats a high volume of numbers/dates (e.g., in tables or lists), extract the Intl formatter outside the function rather than instantiating it on every call via `toLocaleString(..., {options})`.
