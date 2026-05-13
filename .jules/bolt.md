## 2024-06-25 - Native Object iteration in Node.js
**Learning:** Benchmarking in the Next.js environment confirms that `Object.keys(obj)` combined with a `for` loop is >3x faster than `Object.entries()` or `Object.values()` with `.reduce()`, and ~2x faster than `for...in` + `hasOwnProperty` because it completely avoids allocating tuple arrays or callbacks while iterating over large dictionaries.
**Action:** Replace `Object.entries()` and `Object.values().reduce()` with `Object.keys()` + `for` loop in hot paths, such as the data aggregation in `useStatisticsProcessing`.
