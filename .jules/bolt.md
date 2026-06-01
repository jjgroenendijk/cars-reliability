## 2024-06-01 - Optimizing React Hooks Array Operations
**Learning:** In high-frequency React hooks (e.g., `useMemo` processing large lists), chaining array methods like `.filter().reduce()` causes unnecessary intermediate array allocations. Replacing them with a single linear `for` loop prevents these allocations and reduces multiple O(N) passes to a single O(N) pass, significantly optimizing memory pressure and CPU overhead.
**Action:** When working on data pipelines in hooks, convert chained `.filter().map().reduce()` operations into a single loop.
