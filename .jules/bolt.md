## 2024-05-10 - Iterating Over Statically Keyed Objects
**Learning:** Using `Object.values(obj).reduce()` and `Object.entries(obj)` introduces significant performance overhead (~3x slower) compared to iterating over `Object.keys(obj)` with a `for...of` loop due to the allocation of intermediate tuple arrays and `.reduce()` callback overhead.
**Action:** Replace `Object.values(obj).reduce()` and `Object.entries(obj)` with `for (const key of Object.keys(obj))` in hot code paths dealing with large object traversal.
