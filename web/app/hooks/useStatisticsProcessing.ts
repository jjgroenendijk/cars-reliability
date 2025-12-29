import { useMemo } from "react";
import type { BrandStats, ModelStats, Metadata, PerYearStats } from "@/app/lib/types";
import { aggregateAgeRange, type BrandStatsFiltered, type ModelStatsFiltered } from "@/app/lib/statistics_config";

interface FilterState {
    viewMode: "brands" | "models";
    showConsumer: boolean;
    showCommercial: boolean;
    selectedFuels: string[];
    minPrice: number;
    maxPrice: number;
    selectedBrands: string[];
    searchQuery: string;
    ageRange: [number, number];
    minFleetSize: number;
    maxFleetSize: number;
    minInspections: number;
    maxInspections: number;
    maxPriceAvailable: number;
    maxInspectionsAvailable: number;
}

interface UseStatisticsProcessingProps {
    brand_stats: BrandStats[];
    model_stats: ModelStats[];
    metadata: Partial<Metadata>;
    filterState: FilterState;
    defectFilter: {
        brand_breakdowns: Record<string, Record<string, number>>;
        model_breakdowns: Record<string, Record<string, number>>;
        calculate_filtered_defects: (breakdown: Record<string, number>) => number;
        mode: string;
    };
}

export function useStatisticsProcessing({
    brand_stats,
    model_stats,
    metadata,
    filterState,
    defectFilter
}: UseStatisticsProcessingProps) {

    // Derived states
    const minAge = metadata.age_range?.min ?? 0;
    const maxAge = metadata.age_range?.max ?? 30;
    const isAgeFilterActive = filterState.ageRange[0] > minAge || filterState.ageRange[1] < maxAge;

    const {
        viewMode, showConsumer, showCommercial, selectedFuels,
        minPrice, maxPrice, selectedBrands, searchQuery,
        ageRange, minFleetSize, maxFleetSize, minInspections, maxInspections, maxPriceAvailable, maxInspectionsAvailable
    } = filterState;

    const { brand_breakdowns, model_breakdowns, calculate_filtered_defects, mode } = defectFilter;

    // Main Aggregation & Filtering Pipeline
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

                // Std dev cannot be accurately recalculated when merging aggregated data
                existing.std_defects_per_inspection = null;
                existing.std_defects_per_vehicle_year = null;

                // Merge Per Year Stats
                for (const [age, stats] of Object.entries(item.per_year_stats)) {
                    if (!existing.per_year_stats[age]) {
                        existing.per_year_stats[age] = { ...(stats as PerYearStats) };
                    } else {
                        const eStats = existing.per_year_stats[age];
                        const iStats = stats as PerYearStats;
                        eStats.vehicle_count += iStats.vehicle_count;
                        eStats.total_inspections += iStats.total_inspections;
                        eStats.total_defects += iStats.total_defects;
                    }
                }
            }
        }

        let results = Array.from(aggregatedMap.values());

        // 4. Calculate Derived Metrics (Pre-Defect Filter)
        results = results.map(item => {
            // Calculate Std Dev for Defects per Vehicle Year (from rates)
            let std_defects_per_vehicle_year = item.std_defects_per_vehicle_year;

            if (item.total_inspections > 1 && item.sum_defects_per_vehicle_year_rates != null && item.sum_sq_defects_per_vehicle_year_rates != null) {
                const N = item.total_inspections;
                const sumX = item.sum_defects_per_vehicle_year_rates;
                const sumX2 = item.sum_sq_defects_per_vehicle_year_rates;

                const mean = sumX / N;
                const variance = (sumX2 / N) - (mean * mean);
                std_defects_per_vehicle_year = Math.sqrt(Math.max(0, variance));
            }

            // Calculate Std Dev for Defects per Inspection
            let std_defects_per_inspection = item.std_defects_per_inspection;
            if (item.total_inspections > 1 && item.sum_sq_defect_counts != null) {
                const N = item.total_inspections;
                const sumX = item.total_defects;
                const sumX2 = item.sum_sq_defect_counts;

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
                finalInspections = item.total_inspections;
            }

            const filteredDefects = finalDefects * defectRatio;
            const denominator = isAgeFilterActive ? finalInspections : item.total_vehicle_years;
            const finalRate = denominator > 0 ? filteredDefects / denominator : null;

            return {
                ...item,
                filtered_defects: Math.round(filteredDefects),
                filtered_defects_per_vehicle_year: finalRate,
                vehicle_count: isAgeFilterActive ? (aggregateAgeRange(item.per_year_stats, ageRange[0], ageRange[1])?.vehicle_count || 0) : item.vehicle_count,
                avg_age_years: isAgeFilterActive ? (aggregateAgeRange(item.per_year_stats, ageRange[0], ageRange[1])?.avg_age_years || null) : item.avg_age_years,
                total_inspections: isAgeFilterActive ? finalInspections : item.total_inspections,
            };
        });

        // 6. Filter by Fleet Size, Inspections & Validity
        results = results.filter(item => {
            const inspOk = item.total_inspections >= minInspections &&
                (maxInspections >= maxInspectionsAvailable || item.total_inspections <= maxInspections);
            return item.vehicle_count >= minFleetSize &&
                item.vehicle_count <= maxFleetSize &&
                inspOk &&
                item.filtered_defects_per_vehicle_year !== null;
        });

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

    }, [brand_stats, model_stats, viewMode, showConsumer, showCommercial, selectedFuels, minPrice, maxPrice, minFleetSize, maxFleetSize, minInspections, maxInspections, searchQuery, ageRange, isAgeFilterActive, mode, brand_breakdowns, model_breakdowns, calculate_filtered_defects, maxPriceAvailable, maxInspectionsAvailable, selectedBrands, metadata]);

    return {
        processed_data: processed_data as (BrandStatsFiltered | ModelStatsFiltered)[],
        isAgeFilterActive
    };
}
