## 2024-05-15 - Pre-calculate map inside hooks
**Learning:** In statistics processing hooks (like `useStatisticsProcessing`), calculating values (totals, ratios) using map/reduce inside large dataset iteration loops causes massive overhead during frequent UI updates.
**Action:** Pre-calculate constant values across the entire dataset into a Map *outside* of the hot loop using `useMemo` so that lookups inside the loop are O(1).
