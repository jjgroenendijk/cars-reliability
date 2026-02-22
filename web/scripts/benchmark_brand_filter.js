/* eslint-disable */
const { performance } = require('perf_hooks');

const NUM_BRANDS = 5000;
const NUM_SELECTED = 1000;
const ITERATIONS = 1000;

console.log(`\n======================================================`);
console.log(`Brand Filter Performance Benchmark`);
console.log(`======================================================`);
console.log(`Parameters:`);
console.log(`- Brands: ${NUM_BRANDS}`);
console.log(`- Selected Brands: ${NUM_SELECTED}`);
console.log(`- Render Iterations: ${ITERATIONS}`);
console.log(`------------------------------------------------------\n`);

// 1. Setup Data
const brands = Array.from({ length: NUM_BRANDS }, (_, i) => ({
    merk: `Brand-${i}`,
    count: Math.floor(Math.random() * 1000)
}));

// Select a subset of brands (randomly or deterministically)
const selectedBrands = Array.from({ length: NUM_SELECTED }, (_, i) => `Brand-${i * 5}`);

// 2. Measure Baseline (Array.includes)
console.log(`Starting Baseline Measurement (Array.includes)...`);
let start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    brands.forEach(brand => {
        // This is the inefficient O(N*M) part
        const isSelected = selectedBrands.includes(brand.merk);
    });
}
let end = performance.now();
const baselineDuration = end - start;
console.log(`Baseline Duration: ${baselineDuration.toFixed(2)}ms`);

// 3. Measure Optimization (Set.has)
console.log(`\nStarting Optimized Measurement (Set.has)...`);
// Note: In React, Set creation happens once via useMemo when selectedBrands changes.
// We measure the render loop performance assuming the Set is ready.
const selectedBrandsSet = new Set(selectedBrands);

start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    brands.forEach(brand => {
        // This is the optimized O(N) part
        const isSelected = selectedBrandsSet.has(brand.merk);
    });
}
end = performance.now();
const optimizedDuration = end - start;
console.log(`Optimized Duration: ${optimizedDuration.toFixed(2)}ms`);

// 4. Results
const improvement = baselineDuration / optimizedDuration;
console.log(`\n------------------------------------------------------`);
console.log(`Speedup: ${improvement.toFixed(2)}x faster`);
console.log(`======================================================\n`);
