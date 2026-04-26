## 2023-10-24 - Consolidated Array Iterations in Data Processing
**Learning:** Chaining multiple `.map()` and `.filter()` operations over thousands of items in Next.js hooks (like `useStatisticsProcessing`) causes significant garbage collection overhead and redundant iterations. Furthermore, nested heavy helper calls (like `aggregateAgeRange`) were un-memoized during iteration, causing them to recalculate identically up to 3 times per item.
**Action:** When processing large arrays in JavaScript, consolidate multiple mapping and filtering passes into a single `for...of` loop. Calculate heavy helper values once per iteration, store them in a local variable, and reuse them to construct the final array without allocating intermediate objects.

## 2024-04-26 - Eliminate Object.entries, Object.values, and reduce in Hot Loops
**Learning:** In Node.js v22, using `Object.entries()`, `Object.values()`, and `Array.prototype.reduce()` on large or nested objects creates significant overhead due to intermediate array allocations and subsequent garbage collection.
**Action:** Replace `Object.entries()`, `Object.values()`, and `reduce()` with manual `for...in` loops in performance-critical paths and data aggregation loops. In micro-benchmarks, `for...in` executes 2-3x faster and creates zero intermediate arrays.
