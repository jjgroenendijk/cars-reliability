## 2024-05-18 - Fast object cloning with manual spreading
**Learning:** `structuredClone` is very slow compared to manual object iteration and spreading for shallow, predictable nested objects, particularly in loops over large lists of items. The stats array can be large, causing significant delays.
**Action:** When copying `per_year_stats` inside hot `reduce` or loops processing data, construct the new copy manually.
## 2024-04-15 - Array Allocations in React Hot Loops
**Learning:** `Object.values(obj).reduce(...)` creates intermediate array allocations that create significant GC pressure and CPU overhead inside high-frequency loops (like `.map` operations running on thousands of items inside a custom React hook processing large datasets).
**Action:** Always prefer native `for...in` loops combined with `Object.prototype.hasOwnProperty.call(obj, key)` for aggregating object values inside performance-critical paths. Additionally, store the results of complex helper functions (like `aggregateAgeRange`) in variables when their properties are accessed multiple times within the same loop iteration to prevent redundant re-evaluations.
