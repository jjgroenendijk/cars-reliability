## 2024-05-20 - Linear Loop Over Array Methods in Hot Paths
**Learning:** In high-frequency React hooks (e.g. \`useMemo\` processing large lists), replacing chained array methods like \`.filter().reduce()\` with a single linear \`for\` loop prevents unnecessary intermediate array allocations and reduces O(M*N) iterations to O(N).
**Action:** When a high-frequency derived state hook processes thousands of items using chained iterators, refactor the logic into a single native \`for\` loop with localized accumulators to minimize memory pressure and CPU overhead during re-renders.
