import { BrandStats } from "../../app/lib/types";

// Mock data generator
function generateData(count: number): BrandStats[] {
    const data: BrandStats[] = [];
    for (let i = 0; i < count; i++) {
        data.push({
            merk: `Brand_${i % 100}`,
            vehicle_type_group: "consumer",
            primary_fuel: "Benzine",
            vehicle_count: 100,
            total_inspections: 50,
            total_defects: 10,
            total_vehicle_years: 200,
            avg_defects_per_inspection: 0.2,
            avg_age_years: 5,
            defects_per_vehicle_year: 0.05,
            reliability_defects_per_vehicle_year: 0.01,
            fuel_breakdown: { Benzine: 100, Diesel: 0, Elektriciteit: 0, LPG: 0, other: 0 },
            per_year_stats: {},
        });
    }
    return data;
}

function runBenchmark() {
    const DATA_SIZE = 50000;
    const SELECTED_COUNT = 100;

    console.log(`Generating ${DATA_SIZE} items...`);
    const data = generateData(DATA_SIZE);

    const selectedBrands: string[] = [];
    for (let i = 0; i < SELECTED_COUNT; i++) {
        selectedBrands.push(`Brand_${i}`);
    }

    console.log(`Benchmarking filtering with ${DATA_SIZE} items and ${SELECTED_COUNT} selected brands.`);

    // Warmup
    data.filter((item) => selectedBrands.includes(item.merk));
    const setWarmup = new Set(selectedBrands);
    data.filter((item) => setWarmup.has(item.merk));

    // Measure Array.includes
    const startArray = process.hrtime.bigint();
    for (let i = 0; i < 100; i++) {
        data.filter((item) => selectedBrands.includes(item.merk));
    }
    const endArray = process.hrtime.bigint();
    const timeArray = Number(endArray - startArray) / 100 / 1e6; // ms per iteration

    // Measure Set.has
    const startSet = process.hrtime.bigint();
    for (let i = 0; i < 100; i++) {
        const brandSet = new Set(selectedBrands);
        data.filter((item) => brandSet.has(item.merk));
    }
    const endSet = process.hrtime.bigint();
    const timeSet = Number(endSet - startSet) / 100 / 1e6; // ms per iteration

    // Measure Set.has (pre-constructed) - strictly to see pure filtering speed,
    // though in the hook the Set construction is part of the cost unless memoized.
    // The optimization is likely just converting inside the useMemo or filtered block.
    // If it's inside useMemo, it runs every time dependencies change.

    const startSetPre = process.hrtime.bigint();
    const preSet = new Set(selectedBrands);
    for (let i = 0; i < 100; i++) {
        data.filter((item) => preSet.has(item.merk));
    }
    const endSetPre = process.hrtime.bigint();
    const timeSetPre = Number(endSetPre - startSetPre) / 100 / 1e6; // ms per iteration


    console.log(`Array.includes: ${timeArray.toFixed(4)} ms`);
    console.log(`Set.has (inc. construction): ${timeSet.toFixed(4)} ms`);
    console.log(`Set.has (pre-constructed): ${timeSetPre.toFixed(4)} ms`);

    const improvement = (timeArray - timeSet) / timeArray * 100;
    console.log(`Improvement (Array vs Set+Constr): ${improvement.toFixed(2)}%`);
}

runBenchmark();
