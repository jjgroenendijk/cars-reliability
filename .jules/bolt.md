## 2024-05-18 - Pre-calculate derived constants in loops
**Learning:** In high-frequency React hooks (like `useStatisticsProcessing`), calculating dependent ratios or mapping data over objects using `.reduce()` inside the main iteration creates an O(N x M) bottleneck.
**Action:** Extract the repetitive derived calculations into a separate `useMemo` block that iterates over global maps directly with `Object.keys()`, storing the results in a Map. This converts the logic into an O(N + M) pipeline and prevents recalculations on unrelated UI filter changes.
