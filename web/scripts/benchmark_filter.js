/* eslint-disable @typescript-eslint/no-require-imports */
const { performance } = require('perf_hooks');

const DATA_SIZE = 100000; // 100k items
const SELECTED_SIZE = 50; // 50 selected brands
const BRANDS_POOL_SIZE = 200; // 200 unique brands

// Generate a pool of brand names
const brandsPool = Array.from({ length: BRANDS_POOL_SIZE }, (_, i) => `Brand_${i}`);

// Generate data (BrandStats dummy)
const data = Array.from({ length: DATA_SIZE }, () => ({
    merk: brandsPool[Math.floor(Math.random() * BRANDS_POOL_SIZE)],
    otherProp: 'some data'
}));

// Generate selected brands (subset of pool)
const selectedBrands = [];
while (selectedBrands.length < SELECTED_SIZE) {
    const brand = brandsPool[Math.floor(Math.random() * BRANDS_POOL_SIZE)];
    if (!selectedBrands.includes(brand)) {
        selectedBrands.push(brand);
    }
}

console.log(`Data Size: ${DATA_SIZE}`);
console.log(`Selected Brands Size: ${SELECTED_SIZE}`);
console.log('---');

const ITERATIONS = 1000;

// Benchmark 1: Array.includes
const start1 = performance.now();
let result1;
for (let i = 0; i < ITERATIONS; i++) {
    result1 = data.filter(item => selectedBrands.includes(item.merk));
}
const end1 = performance.now();
const time1 = end1 - start1;
console.log(`Array.includes (x${ITERATIONS}): ${time1.toFixed(2)} ms`);
console.log(`Avg per run: ${(time1 / ITERATIONS).toFixed(4)} ms`);

// Benchmark 2: Set.has (with Set creation inside loop)
const start2 = performance.now();
let result2;
for (let i = 0; i < ITERATIONS; i++) {
    const brandSet = new Set(selectedBrands);
    result2 = data.filter(item => brandSet.has(item.merk));
}
const end2 = performance.now();
const time2 = end2 - start2;
console.log(`Set.has (x${ITERATIONS}): ${time2.toFixed(2)} ms`);
console.log(`Avg per run: ${(time2 / ITERATIONS).toFixed(4)} ms`);

// Verify results match
if (result1.length !== result2.length) {
    console.error(`Mismatch! Array: ${result1.length}, Set: ${result2.length}`);
} else {
    console.log(`Results match: ${result1.length} items found.`);
}

console.log(`Improvement: ${(time1 / time2).toFixed(2)}x faster`);
