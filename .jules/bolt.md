## 2024-05-30 - O(N x M) Inner Loop Reduction with Map Lookup
**Learning:** Extracting an inline `Object.values().reduce()` running inside a hot loop iteration (filtering/mapping thousands of rows) into a standalone `useMemo` that pre-calculates the ratios as a Map reduces CPU overhead to $O(N + M)$.
**Action:** Always inspect array reductions occurring within rendering or filtering loops. Lift invariant map calculations into their own dedicated `useMemo` hooks, leveraging constant-time `Map.get()` lookups for O(1) retrieval instead of O(M) inline calculation on every iteration.
