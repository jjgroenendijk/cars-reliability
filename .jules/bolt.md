## 2024-05-24 - Init\n**Learning:** Initializing bolt.md\n**Action:** Log here
## 2024-05-24 - Performance Optimizations for Loops
**Learning:** Object.keys() iteration is significantly faster than for...in + hasOwnProperty, Object.entries, and Object.values().reduce() in V8 for our specific use cases in hot loops (aggregating stats), avoiding tuple array allocations.
**Action:** Replace for...in and Object.entries() loops with Object.keys() and explicit assignment in high-frequency React hooks like useStatisticsProcessing.js.
