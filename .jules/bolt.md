## 2024-05-18 - Fast object cloning with manual spreading
**Learning:** `structuredClone` is very slow compared to manual object iteration and spreading for shallow, predictable nested objects, particularly in loops over large lists of items. The stats array can be large, causing significant delays.
**Action:** When copying `per_year_stats` inside hot `reduce` or loops processing data, construct the new copy manually.

## 2024-05-18 - Single Loop Array Processing
**Learning:** Chaining multiple array methods like `.filter()` and `.map()` on large datasets creates an O(k*n) iteration problem and significant memory pressure from intermediate array allocations, dragging down CPU efficiency during high-frequency component re-renders.
**Action:** When filtering and transforming large arrays of objects within React hooks (like in `useStatisticsProcessing`), utilize a single loop `for` and `continue` statements instead of chained `.map().filter()` calls.
