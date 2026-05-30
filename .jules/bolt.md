## 2024-05-30 - Object iteration overhead in hot loops
**Learning:** In Node.js 22, `Object.keys(obj)` iteration combined with a standard `for` loop is significantly faster than `Object.entries(obj)` and `Object.values(obj).reduce()`, as it avoids tuple array allocation overhead in high-frequency aggregation loops.
**Action:** Default to `Object.keys()` combined with a traditional `for` loop for hot paths over statically keyed objects unless tuple arrays are strictly required.
