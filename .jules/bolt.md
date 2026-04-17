## 2024-05-18 - Fast object cloning with manual spreading
**Learning:** `structuredClone` is very slow compared to manual object iteration and spreading for shallow, predictable nested objects, particularly in loops over large lists of items. The stats array can be large, causing significant delays.
**Action:** When copying `per_year_stats` inside hot `reduce` or loops processing data, construct the new copy manually.
## 2026-04-17 - Loop Fusion for Array Transformation
**Learning:** Processing large data arrays in React hooks by chaining multiple `.map()` and `.filter()` operations creates significant overhead by continuously allocating intermediate arrays. This results in (k \cdot N)$ iterations.
**Action:** Merge sequential array transformations into a single iteration pass (loop fusion). For example, combine calculations, mappings, and filter conditions into one `for...of` loop that conditionally pushes to a result array. This scales processing down to (N)$ and severely reduces GC pauses.
