## 2024-05-30 - Intl formatter overhead
**Learning:** Repeatedly calling `Number.prototype.toLocaleString()` or `Date.prototype.toLocaleDateString()` in hot paths (like formatting data table rows) is a known performance bottleneck in JS engines due to the overhead of repeatedly instantiating `Intl` formatter objects under the hood.
**Action:** Always instantiate `Intl.NumberFormat` and `Intl.DateTimeFormat` objects once at the module level and reuse their `.format()` methods when rendering large data sets.
