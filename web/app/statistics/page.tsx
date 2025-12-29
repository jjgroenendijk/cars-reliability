"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { BrandStats, ModelStats, Rankings, PerYearStats, Metadata } from "@/app/lib/types";
import { ReliabilityTable, type Column } from "@/app/components/reliability_table";
import { DefectFilterPanel } from "@/app/components/defect_filter_panel";
import FilterBar from "@/app/components/filter_bar";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import { timestamp_format, pascal_case_format } from "@/app/lib/data_load";
import { RefreshCw, AlertTriangle, Info, Trophy } from "lucide-react";



// -- Brand Types --
interface BrandStatsFiltered extends BrandStats {
    filtered_defects?: number;
    filtered_defects_per_vehicle_year?: number | null;
    std_defects_per_inspection?: number | null;
    std_defects_per_vehicle_year?: number | null;
}

// -- Model Types --
interface ModelStatsFiltered extends ModelStats {
    filtered_defects?: number;
    filtered_defects_per_vehicle_year?: number | null;
    std_defects_per_inspection?: number | null;
    std_defects_per_vehicle_year?: number | null;
}

// -- Columns --
const BRAND_COLUMNS_FULL: Column<BrandStatsFiltered>[] = [
    { key: "merk", label: "Brand", format: (v) => pascal_case_format(String(v)) },
    { key: "vehicle_count", label: "Vehicles" },
    { key: "total_inspections", label: "Inspections" },
    { key: "avg_defects_per_inspection", label: "Defects / Inspection" },
    { key: "avg_age_years", label: "Avg Age" },
    { key: "filtered_defects_per_vehicle_year", label: "Defects / Year" },
];

const BRAND_COLUMNS_FILTERED: Column<BrandStatsFiltered>[] = [
    { key: "merk", label: "Brand", format: (v) => pascal_case_format(String(v)) },
    { key: "vehicle_count", label: "Vehicles" },
    { key: "total_inspections", label: "Inspections" },
    { key: "avg_defects_per_inspection", label: "Defects / Inspection" },
    { key: "filtered_defects_per_vehicle_year", label: "Defects / Year" },
];

const MODEL_COLUMNS_FULL: Column<ModelStatsFiltered>[] = [
    { key: "merk", label: "Brand", format: (v) => pascal_case_format(String(v)) },
    { key: "handelsbenaming", label: "Model", format: (v) => pascal_case_format(String(v)) },
    { key: "vehicle_count", label: "Vehicles" },
    { key: "total_inspections", label: "Inspections" },
    { key: "avg_defects_per_inspection", label: "Defects / Inspection" },
    { key: "avg_age_years", label: "Avg Age" },
    { key: "filtered_defects_per_vehicle_year", label: "Defects / Year" },
];

const MODEL_COLUMNS_FILTERED: Column<ModelStatsFiltered>[] = [
    { key: "merk", label: "Brand", format: (v) => pascal_case_format(String(v)) },
    { key: "handelsbenaming", label: "Model", format: (v) => pascal_case_format(String(v)) },
    { key: "vehicle_count", label: "Vehicles" },
    { key: "total_inspections", label: "Inspections" },
    { key: "avg_defects_per_inspection", label: "Defects / Inspection" },
    { key: "filtered_defects_per_vehicle_year", label: "Defects / Year" },
];

/** Aggregate per-year stats for a given age range */
function aggregateAgeRange(
    per_year_stats: Record<string, PerYearStats> | undefined,
    minAge: number,
    maxAge: number
): PerYearStats | null {
    if (!per_year_stats) return null;

    let total_vehicles = 0;
    let total_inspections = 0;
    let total_defects = 0;

    for (let age = minAge; age <= maxAge; age++) {
        const yearStats = per_year_stats[String(age)];
        if (yearStats) {
            total_vehicles += yearStats.vehicle_count;
            total_inspections += yearStats.total_inspections;
            total_defects += yearStats.total_defects;
        }
    }

    if (total_inspections === 0) return null;

    return {
        vehicle_count: total_vehicles,
        total_inspections,
        total_defects,
        avg_defects_per_inspection: Math.round((total_defects / total_inspections) * 10000) / 10000,
    };
}

export default function StatisticsPage() {
    const [viewMode, setViewMode] = useState<"brands" | "models">("brands");
    const [showStdDev, setShowStdDev] = useState(false);
    const [showCatalogPrice, setShowCatalogPrice] = useState(false);

    // Pagination State
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    const [brand_stats, setBrandStats] = useState<BrandStats[]>([]);
    const [model_stats, setModelStats] = useState<ModelStats[]>([]);

    const [metadata, setMetadata] = useState<Partial<Metadata>>({});
    const [generated_at, setGeneratedAt] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [showConsumer, setShowConsumer] = useState(true);
    const [showCommercial, setShowCommercial] = useState(false);

    // New Filters
    const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
    const [minPrice, setMinPrice] = useState(0);
    const [maxPrice, setMaxPrice] = useState(100000); // 100k+

    // Sliders
    const defaultMin = 4;
    const defaultMax = 20;
    const [ageRange, setAgeRange] = useState<[number, number]>([defaultMin, defaultMax]);
    const [minFleetSize, setMinFleetSize] = useState(1000);
    const [maxFleetSize, setMaxFleetSize] = useState(500000);

    const { brand_breakdowns, model_breakdowns, calculate_filtered_defects, mode } = useDefectFilter();

    // URL Sync Hooks
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Derive age bounds from metadata
    const minAge = metadata.age_range?.min ?? 0;
    const maxAge = metadata.age_range?.max ?? 30;
    const isAgeFilterActive = ageRange[0] > minAge || ageRange[1] < maxAge;

    // 1. Hydrate state from URL on mount
    useEffect(() => {
        if (!searchParams) return;

        const pView = searchParams.get("view");
        if (pView === "brands" || pView === "models") setViewMode(pView);

        const pBrands = searchParams.get("brands");
        if (pBrands) setSelectedBrands(pBrands.split(","));

        const pFuels = searchParams.get("fuels");
        if (pFuels) setSelectedFuels(pFuels.split(","));

        const pMinPrice = searchParams.get("minPrice");
        if (pMinPrice) setMinPrice(Number(pMinPrice));

        const pMaxPrice = searchParams.get("maxPrice");
        if (pMaxPrice) setMaxPrice(Number(pMaxPrice));

        const pAgeMin = searchParams.get("ageMin");
        const pAgeMax = searchParams.get("ageMax");
        if (pAgeMin && pAgeMax) setAgeRange([Number(pAgeMin), Number(pAgeMax)]);

        const pFleetMin = searchParams.get("fleetMin");
        if (pFleetMin) setMinFleetSize(Number(pFleetMin));

        const pFleetMax = searchParams.get("fleetMax");
        if (pFleetMax) setMaxFleetSize(Number(pFleetMax));

        const pSearch = searchParams.get("q");
        if (pSearch) setSearchQuery(pSearch);

        const pStdDev = searchParams.get("stdDev");
        if (pStdDev === "true") setShowStdDev(true);

        const pCatPrice = searchParams.get("catPrice");
        if (pCatPrice === "true") setShowCatalogPrice(true);

        const pPageSize = searchParams.get("pageSize");
        if (pPageSize) setPageSize(Number(pPageSize));

        const pPage = searchParams.get("page");
        if (pPage) setCurrentPage(Number(pPage));

        // Consumer/Commercial defaults are usually static but could be synced too
    }, [searchParams]);



    // Reset page on filter change (except page change itself)
    useEffect(() => {
        setCurrentPage(1);
    }, [viewMode, searchQuery, selectedBrands, selectedFuels, minPrice, maxPrice, ageRange, minFleetSize, maxFleetSize, showConsumer, showCommercial]);

    useEffect(() => {
        async function data_fetch() {
            try {
                const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                const t = Date.now();
                const [brand_response, model_response, rankings_response, metadata_response] = await Promise.all([
                    fetch(`${base_path}/data/brand_stats.json?t=${t}`),
                    fetch(`${base_path}/data/model_stats.json?t=${t}`),
                    fetch(`${base_path}/data/rankings.json?t=${t}`),
                    fetch(`${base_path}/data/metadata.json?t=${t}`),
                ]);

                if (!brand_response.ok || !model_response.ok) {
                    throw new Error("Could not load statistics data");
                }

                const brands: BrandStats[] = await brand_response.json();
                const models: ModelStats[] = await model_response.json();

                setBrandStats(brands);
                setModelStats(models);



                if (rankings_response.ok) {
                    const rankings: Rankings = await rankings_response.json();
                    setGeneratedAt(rankings.generated_at);
                }

                if (metadata_response.ok) {
                    const meta: Metadata = await metadata_response.json();
                    setMetadata(meta);

                    if (meta.ranges) {
                        // Set dynamic max values from metadata
                        setMaxPrice(meta.ranges.price.max);
                        // Fleet size max is usually very large, we can default to it or a slightly lower usable cap if UI demands
                        // But user requested dynamic max, so let's use it.
                        setMaxFleetSize(meta.ranges.fleet.max);

                        setAgeRange([meta.ranges.age.min, meta.ranges.age.max]);
                    } else if (meta.age_range) {
                        // Fallback for old metadata format
                        setAgeRange([meta.age_range.min, meta.age_range.max]);
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }
        data_fetch();
    }, []);

    // Calculate max fleet size based on current view/usage (ignoring price/fuel for stability)
    const maxFleetSizeAvailable = useMemo(() => {
        if (metadata.ranges?.fleet) return metadata.ranges.fleet.max;
        return 500000; // Fallback
    }, [metadata]);

    const maxPriceAvailable = useMemo(() => {
        if (metadata.ranges?.price) return metadata.ranges.price.max;
        return 100000; // Fallback
    }, [metadata]);

    // 2. Sync state to URL
    const createQueryString = useCallback(
        (params: Record<string, string | number | boolean | undefined>) => {
            const newSearchParams = new URLSearchParams(searchParams?.toString());

            for (const [key, value] of Object.entries(params)) {
                if (value === undefined || value === null || value === "") {
                    newSearchParams.delete(key);
                } else {
                    newSearchParams.set(key, String(value));
                }
            }
            return newSearchParams.toString();
        },
        [searchParams]
    );

    useEffect(() => {
        // Debounce URL updates slightly to avoid lag on sliders
        const timer = setTimeout(() => {
            const params: Record<string, string | number | boolean | undefined> = {};

            if (viewMode !== "brands") params.view = viewMode;
            if (selectedBrands.length > 0) params.brands = selectedBrands.join(",");
            if (selectedFuels.length > 0) params.fuels = selectedFuels.join(",");

            if (minPrice > 0) params.minPrice = minPrice;
            // Only add maxPrice if it's NOT the maximum available (meaning user filtered it down)
            if (maxPrice < maxPriceAvailable) params.maxPrice = maxPrice;

            // Age Defaults
            const currentMinAge = metadata.ranges?.age.min ?? defaultMin;
            const currentMaxAge = metadata.ranges?.age.max ?? defaultMax;
            if (ageRange[0] !== currentMinAge) params.ageMin = ageRange[0];
            if (ageRange[1] !== currentMaxAge) params.ageMax = ageRange[1];

            // Fleet Defaults
            const currentMinFleet = metadata.ranges?.fleet.min ?? 1000;
            const currentMaxFleet = maxFleetSizeAvailable;
            if (minFleetSize !== currentMinFleet) params.fleetMin = minFleetSize;
            if (maxFleetSize !== currentMaxFleet) params.fleetMax = maxFleetSize;

            if (searchQuery) params.q = searchQuery;
            if (showStdDev) params.stdDev = "true";
            if (showCatalogPrice) params.catPrice = "true";
            if (pageSize !== 50) params.pageSize = pageSize;
            if (currentPage !== 1) params.page = currentPage;

            const queryString = createQueryString(params);

            // If query string is empty, clean up the URL completely
            if (!queryString) {
                router.replace(pathname, { scroll: false });
            } else {
                router.replace(`${pathname}?${queryString}`, { scroll: false });
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [
        viewMode, selectedBrands, selectedFuels, minPrice, maxPrice,
        ageRange, minFleetSize, maxFleetSize, searchQuery,
        showStdDev, showCatalogPrice, pageSize, currentPage,
        pathname, router, createQueryString, defaultMin, defaultMax,
        maxPriceAvailable, maxFleetSizeAvailable, metadata
    ]);


    // -- Main Aggegration & Filtering Pipeline --
    const processed_data = useMemo(() => {
        // 1. Select Source
        const rawData = viewMode === "brands" ? brand_stats : model_stats;

        // 2. Filter Rows (Fuel, Price, Usage)
        let filtered = rawData.filter((item) => {
            if (showConsumer && item.vehicle_type_group === "consumer") return true;
            if (showCommercial && item.vehicle_type_group === "commercial") return true;
            return false;
        });

        if (selectedFuels.length > 0) {
            filtered = filtered.filter((item) => selectedFuels.includes(item.primary_fuel));
        }

        filtered = filtered.filter((item) => {
            let p = 0;
            if (item.sum_catalog_price && item.count_with_price && item.count_with_price > 0) {
                p = item.sum_catalog_price / item.count_with_price;
            }
            // Treat max value as infinity
            if (maxPrice >= maxPriceAvailable) return p >= minPrice;
            return p >= minPrice && p <= maxPrice;
        });

        if (selectedBrands.length > 0) {
            filtered = filtered.filter((item) => selectedBrands.includes(item.merk));
        }

        // 3. Aggregate Rows by Key (Brand or Brand+Model)
        const groupBy = (item: BrandStats | ModelStats) => viewMode === "brands" ? item.merk : `${item.merk} ${(item as ModelStats).handelsbenaming}`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aggregatedMap = new Map<string, any>();

        for (const item of filtered) {
            const key = groupBy(item);
            if (!aggregatedMap.has(key)) {
                // Deep clone per_year_stats to enable merging
                aggregatedMap.set(key, {
                    ...item,
                    per_year_stats: JSON.parse(JSON.stringify(item.per_year_stats))
                });
            } else {
                const existing = aggregatedMap.get(key);
                existing.vehicle_count += item.vehicle_count;
                existing.total_inspections += item.total_inspections;
                existing.total_defects += item.total_defects;
                existing.total_vehicle_years += item.total_vehicle_years;

                // Accumulate sums for rate-based standard deviation
                if (item.sum_defects_per_vehicle_year_rates != null) {
                    existing.sum_defects_per_vehicle_year_rates = (existing.sum_defects_per_vehicle_year_rates || 0) + item.sum_defects_per_vehicle_year_rates;
                }
                if (item.sum_sq_defects_per_vehicle_year_rates != null) {
                    existing.sum_sq_defects_per_vehicle_year_rates = (existing.sum_sq_defects_per_vehicle_year_rates || 0) + item.sum_sq_defects_per_vehicle_year_rates;
                }

                // Accumulate SumSq for defects per inspection
                if (item.sum_sq_defect_counts != null) {
                    existing.sum_sq_defect_counts = (existing.sum_sq_defect_counts || 0) + item.sum_sq_defect_counts;
                }

                // Accumulate Sum Catalog Price
                if (item.sum_catalog_price != null) {
                    existing.sum_catalog_price = (existing.sum_catalog_price || 0) + item.sum_catalog_price;
                }

                // Accumulate Count with Price
                if (item.count_with_price != null) {
                    existing.count_with_price = (existing.count_with_price || 0) + item.count_with_price;
                }

                // Std dev cannot be accurately recalculated when merging aggregated data unless we use the accumulated sums
                // Set to null initially; will be recalculated in derived metrics if sums are available
                existing.std_defects_per_inspection = null;
                existing.std_defects_per_vehicle_year = null;

                // Merge Per Year Stats
                for (const [age, stats] of Object.entries(item.per_year_stats)) {
                    if (!existing.per_year_stats[age]) {
                        existing.per_year_stats[age] = { ...stats };
                    } else {
                        const eStats = existing.per_year_stats[age];
                        const iStats = stats;
                        eStats.vehicle_count += iStats.vehicle_count;
                        eStats.total_inspections += iStats.total_inspections;
                        eStats.total_defects += iStats.total_defects;
                    }
                }
            }
        }

        let results = Array.from(aggregatedMap.values());

        // 4. Calculate Derived Metrics (Pre-Defect Filter)
        // 4. Calculate Derived Metrics (Pre-Defect Filter)
        results = results.map(item => {
            // Calculate Std Dev for Defects per Vehicle Year (from rates)
            let std_defects_per_vehicle_year = item.std_defects_per_vehicle_year;

            // If we have accumulated sums (from aggregation), recalculate std dev
            if (item.total_inspections > 1 && item.sum_defects_per_vehicle_year_rates != null && item.sum_sq_defects_per_vehicle_year_rates != null) {
                const N = item.total_inspections;
                const sumX = item.sum_defects_per_vehicle_year_rates;
                const sumX2 = item.sum_sq_defects_per_vehicle_year_rates;

                // Var = E[X^2] - (E[X])^2
                // Var = (sumX2 / N) - (sumX / N)^2
                const mean = sumX / N;
                const variance = (sumX2 / N) - (mean * mean);

                // Use max(0, variance) to handle floating point epsilon errors yielding negative zero
                std_defects_per_vehicle_year = Math.sqrt(Math.max(0, variance));
            }

            // Calculate Std Dev for Defects per Inspection
            let std_defects_per_inspection = item.std_defects_per_inspection;
            if (item.total_inspections > 1 && item.sum_sq_defect_counts != null) {
                const N = item.total_inspections;
                const sumX = item.total_defects; // Sum of defects
                const sumX2 = item.sum_sq_defect_counts;

                // Var = (sumX2 - (sumX^2 / N)) / (N - 1) for sample variance? 
                // Wait, Polars uses sample std dev by default (ddof=1).
                // But the formula (sumX2/N) - (mean^2) is for Population variance (ddof=0).

                // For consistence with Polars std():
                // Polars default std() is sample standard deviation.
                // Var = ( Sum(X^2) - (Sum(X)^2 / N) ) / (N-1)

                const numerator = sumX2 - ((sumX * sumX) / N);
                const variance = numerator / (N - 1);

                std_defects_per_inspection = Math.sqrt(Math.max(0, variance));
            }

            // Calculate Avg Price
            let avg_catalog_price = null;
            if (item.sum_catalog_price != null && item.count_with_price && item.count_with_price > 0) {
                avg_catalog_price = item.sum_catalog_price / item.count_with_price;
            }

            return {
                ...item,
                avg_defects_per_inspection: item.total_inspections > 0 ? item.total_defects / item.total_inspections : 0,
                defects_per_vehicle_year: item.total_vehicle_years > 0 ? item.total_defects / item.total_vehicle_years : 0,
                std_defects_per_vehicle_year: std_defects_per_vehicle_year,
                std_defects_per_inspection: std_defects_per_inspection,
                avg_catalog_price: avg_catalog_price,
            };
        });

        // 5. Apply Defect Filters (Ratio Approach) & Age Range
        results = results.map(item => {
            // A. Defect Filter Ratio
            let defectRatio = 1.0;
            if (mode !== "all") {
                const key = viewMode === "brands" ? item.merk : `${item.merk}|${item.handelsbenaming}`;
                const breakdown = viewMode === "brands" ? brand_breakdowns[key] : model_breakdowns[key];

                if (breakdown) {
                    const totalInBreakdown = Object.values(breakdown).reduce((a, b) => a + b, 0);
                    const filteredInBreakdown = calculate_filtered_defects(breakdown);
                    if (totalInBreakdown > 0) {
                        defectRatio = filteredInBreakdown / totalInBreakdown;
                    }
                }
            }

            // B. Age Range Aggregation
            let finalDefects = 0;
            let finalInspections = 0;

            if (isAgeFilterActive) {
                const aggregated = aggregateAgeRange(item.per_year_stats, ageRange[0], ageRange[1]);
                if (aggregated) {
                    finalDefects = aggregated.total_defects;
                    finalInspections = aggregated.total_inspections;
                }
            } else {
                finalDefects = item.total_defects;
                finalInspections = item.total_inspections; // Using inspections as proxy for vehicle years in global view if simpler, or total_vehicle_years
                // For consistency with Age Range, we'll use total_vehicle_years for global rate
            }

            // Apply Defect Ratio to specific range defects
            const filteredDefects = finalDefects * defectRatio;

            // Calculate Final Rate
            // Denominator: If Age Filter active, use range inspections (~ vehicle years). If not, use total_vehicle_years.
            const denominator = isAgeFilterActive ? finalInspections : item.total_vehicle_years;
            const finalRate = denominator > 0 ? filteredDefects / denominator : null;

            return {
                ...item,
                filtered_defects: Math.round(filteredDefects),
                filtered_defects_per_vehicle_year: finalRate,
                // If age filter is active, update displayed counts to match range
                vehicle_count: isAgeFilterActive ? (aggregateAgeRange(item.per_year_stats, ageRange[0], ageRange[1])?.vehicle_count || 0) : item.vehicle_count,
                total_inspections: isAgeFilterActive ? finalInspections : item.total_inspections,
            };
        });

        // 6. Filter by Fleet Size & Validity
        results = results.filter(item =>
            item.vehicle_count >= minFleetSize &&
            item.vehicle_count <= maxFleetSize &&
            item.filtered_defects_per_vehicle_year !== null
        );

        // 7. Search Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            results = results.filter((item) => {
                if (viewMode === "brands") return item.merk.toLowerCase().includes(q);
                return (
                    item.merk.toLowerCase().includes(q) || item.handelsbenaming.toLowerCase().includes(q)
                );
            });
        }

        // 8. Sort
        return results.sort((a, b) => (a.filtered_defects_per_vehicle_year || 0) - (b.filtered_defects_per_vehicle_year || 0));

    }, [brand_stats, model_stats, viewMode, showConsumer, showCommercial, selectedBrands, selectedFuels, minPrice, maxPrice, minFleetSize, maxFleetSize, searchQuery, ageRange, isAgeFilterActive, mode, brand_breakdowns, model_breakdowns, calculate_filtered_defects, maxPriceAvailable]);


    // Memoize columns at top level to avoid conditional hook errors
    const tableColumns = useMemo(() => {
        const baseCols = viewMode === "brands"
            ? (isAgeFilterActive ? BRAND_COLUMNS_FILTERED : BRAND_COLUMNS_FULL)
            : (isAgeFilterActive ? MODEL_COLUMNS_FILTERED : MODEL_COLUMNS_FULL);

        // Clone cols to avoid mutating constants/previous ref
        const cols = [...baseCols];

        // 1. Add Price Column if enabled (Models only)
        if (viewMode === "models" && showCatalogPrice) {
            cols.splice(2, 0, {
                // avg_catalog_price is dynamically added
                key: "avg_catalog_price",
                label: "Avg. Price",
                format: (v: unknown) => (typeof v === 'number') ? `€ ${Number(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}` : "-"
            });
        }

        // 2. Add Std Dev Columns if enabled
        if (showStdDev) {
            const insertIndex = cols.findIndex(c => c.key === "avg_defects_per_inspection") + 1;

            if (insertIndex > 0) {
                // Insert std dev for defects/inspection
                cols.splice(insertIndex, 0, {
                    key: "std_defects_per_inspection",
                    label: "Std. Dev. (Inspection)",
                    format: (v: unknown) => (typeof v === 'number') ? Number(v).toFixed(4) : "-"
                });

                // Insert std dev for defects/year - only in FULL mode (not when age filter is active)
                if (!isAgeFilterActive) {
                    const yearColIndex = cols.findIndex(c => c.key === "filtered_defects_per_vehicle_year");
                    if (yearColIndex > 0) {
                        cols.splice(yearColIndex + 1, 0, {
                            key: "std_defects_per_vehicle_year",
                            label: "Std. Dev. / Year",
                            format: (v: unknown) => (typeof v === 'number') ? Number(v).toFixed(4) : "-"
                        });
                    }
                }
            }
        }
        return cols;
    }, [viewMode, isAgeFilterActive, showStdDev, showCatalogPrice]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-4">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <h2 className="text-xl font-bold">Error Loading Data</h2>
                    <p>{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-zinc-900 text-zinc-50 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                    Retry
                    <RefreshCw className="w-4 h-4 inline-block ml-2" />
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="space-y-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Reliability Statistics
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl">
                        Comprehensive analysis of vehicle reliability based on millions of RDW inspection records.
                    </p>
                </div>

                {/* Main Filter Bar */}
                <FilterBar
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    showConsumer={showConsumer}
                    setShowConsumer={setShowConsumer}
                    showCommercial={showCommercial}
                    setShowCommercial={setShowCommercial}
                    availableBrands={brand_stats}
                    selectedBrands={selectedBrands}
                    setSelectedBrands={setSelectedBrands}
                    selectedFuels={selectedFuels}
                    setSelectedFuels={setSelectedFuels}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    setMinPrice={setMinPrice}
                    setMaxPrice={setMaxPrice}
                    ageRange={ageRange}
                    setAgeRange={setAgeRange}
                    minFleetSize={minFleetSize}
                    setMinFleetSize={setMinFleetSize}
                    maxFleetSize={maxFleetSize}
                    setMaxFleetSize={setMaxFleetSize}
                    maxFleetSizeAvailable={maxFleetSizeAvailable}
                    minFleetSizeAvailable={metadata.ranges?.fleet.min ?? 0}
                    defectFilterComponent={<DefectFilterPanel />}
                    showStdDev={showStdDev}
                    setShowStdDev={setShowStdDev}
                    minAgeAvailable={metadata.ranges?.age.min ?? 0}
                    maxAgeAvailable={metadata.ranges?.age.max ?? 30}
                    minPriceAvailable={metadata.ranges?.price.min ?? 0}
                    maxPriceAvailable={maxPriceAvailable}
                    showCatalogPrice={showCatalogPrice}
                    setShowCatalogPrice={setShowCatalogPrice}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                />
            </div>

            {
                loading ? (
                    <div className="animate-pulse space-y-8">
                        <div className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-3xl" />
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />)}
                        </div>
                    </div>
                ) : processed_data.length > 0 ? (
                    <>
                        {/* Table */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-yellow-500" />
                                    Rankings
                                </h2>
                                <span className="text-sm text-zinc-500">
                                    Found {processed_data.length} {viewMode}
                                </span>
                            </div>
                            <ReliabilityTable
                                data={processed_data}
                                columns={tableColumns}
                                defaultSortKey="filtered_defects_per_vehicle_year"
                                defaultSortDirection="asc"
                                filterKey={viewMode === "brands" ? "merk" : "handelsbenaming"}
                                hideSearchInput={true}
                                pageSize={pageSize}
                                currentPage={currentPage}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </>
                ) : (
                    <div className="text-center py-24 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700">
                        <Info className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No results found</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-2">
                            Try adjusting your filters.
                        </p>
                        <button
                            onClick={() => {
                                setSelectedFuels([]);
                                setMinPrice(0);
                                setMaxPrice(100000);
                                setAgeRange([defaultMin, defaultMax]);
                                setSearchQuery("");
                            }}
                            className="mt-6 text-blue-600 dark:text-blue-400 font-medium hover:underline"
                        >
                            Clear filters
                        </button>
                    </div>
                )
            }

            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                <p>Data: RDW Open Data {generated_at && `| Updated: ${timestamp_format(generated_at)}`}</p>
            </div>
        </div >
    );
}
