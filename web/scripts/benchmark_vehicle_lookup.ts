import { performance } from "perf_hooks";

// Mock data
const unique_defect_ids = Array.from({ length: 250 }, (_, i) => `defect_${i}`);

// Mock fetch
const mockFetch = async () => {
    return new Promise(resolve => setTimeout(resolve, 50));
};

async function runSequential() {
    const batches = [];
    for (let i = 0; i < unique_defect_ids.length; i += 50) {
        batches.push(unique_defect_ids.slice(i, i + 50));
    }

    const start = performance.now();
    for (const batch of batches) {
        await mockFetch();
    }
    const end = performance.now();
    return end - start;
}

async function runParallel() {
    const batches = [];
    for (let i = 0; i < unique_defect_ids.length; i += 50) {
        batches.push(unique_defect_ids.slice(i, i + 50));
    }

    const start = performance.now();
    await Promise.all(batches.map(async (batch) => {
        await mockFetch();
    }));
    const end = performance.now();
    return end - start;
}

async function run() {
    console.log("Running benchmarks...");
    const seqTime = await runSequential();
    console.log(`Sequential time: ${seqTime.toFixed(2)} ms`);

    const parTime = await runParallel();
    console.log(`Parallel time: ${parTime.toFixed(2)} ms`);

    console.log(`Improvement: ${((seqTime - parTime) / seqTime * 100).toFixed(2)}%`);
}

run();
