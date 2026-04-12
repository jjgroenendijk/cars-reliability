## 2024-05-18 - Fast object cloning with manual spreading
**Learning:** `structuredClone` is very slow compared to manual object iteration and spreading for shallow, predictable nested objects, particularly in loops over large lists of items. The stats array can be large, causing significant delays.
**Action:** When copying `per_year_stats` inside hot `reduce` or loops processing data, construct the new copy manually.
