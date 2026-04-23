import { useState, useEffect, useMemo, useDeferredValue } from "react";
import type { BrandStats, ModelStats, Rankings, FuelBreakdown, Metadata } from "@/app/lib/types";
import { DEFAULTS } from "@/app/lib/defaults";

export interface BrandFuelData {
    merk: string;
    handelsbenaming?: string;
    vehicle_count: number;
    fuel_breakdown: FuelBreakdown;
    petrol_pct: number;
    diesel_pct: number;
    electric_pct: number;
    [key: string]: string | number | FuelBreakdown | undefined;
}

type SortKey = "merk" | "vehicle_count" | "electric_pct" | "diesel_pct" | "petrol_pct";
type SortDir = "asc" | "desc";

interface FilterState {
    viewMode: "brands" | "models";
    showConsumer: boolean;
    showCommercial: boolean;
    selectedFuels: string[];
    minPrice: number;
    maxPrice: number;
    selectedBrands: string[];
    searchQuery: string;
    minFleetSize: number;
    maxFleetSize: number;
    minInspections: number;
    maxInspections: number;
}

function fuel_total_calculate(fb: FuelBreakdown): number {
    return fb.Benzine + fb.Diesel + fb.Elektriciteit + fb.LPG + fb.other;
}

function pct_calculate(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
}

function sum_fuel_breakdowns(a: FuelBreakdown, b: FuelBreakdown): FuelBreakdown {
    return {
        Benzine: a.Benzine + b.Benzine,
        Diesel: a.Diesel + b.Diesel,
        Elektriciteit: a.Elektriciteit + b.Elektriciteit,
        LPG: a.LPG + b.LPG,
        other: a.other + b.other,
    };
}

export function useFuelData(filterState: FilterState) {
    const [brand_stats, setBrandStats] = useState<BrandStats[]>([]);
    const [model_stats, setModelStats] = useState<ModelStats[]>([]);
    const [generated_at, setGeneratedAt] = useState<string>("");
    const [metadata, setMetadata] = useState<Metadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ageRange, setAgeRange] = useState<[number, number]>([DEFAULTS.age.min, DEFAULTS.age.max]);

    const [sort_key, setSortKey] = useState<SortKey>("electric_pct");
    const [sort_dir, setSortDir] = useState<SortDir>("desc");
    const deferred_filter_state = useDeferredValue(filterState);

    useEffect(() => {
        async function data_fetch() {
            try {
                const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                const t = Date.now();
                const [brand_res, model_res, rankings_res, metadata_res] = await Promise.all([
                    fetch(`${base_path}/data/brand_stats.json?t=${t}`),
                    fetch(`${base_path}/data/model_stats.json?t=${t}`),
                    fetch(`${base_path}/data/rankings.json?t=${t}`),
                    fetch(`${base_path}/data/metadata.json?t=${t}`),
                ]);

                if (!brand_res.ok || !model_res.ok) {
                    throw new Error("Could not load statistics data");
                }

                const brands: BrandStats[] = await brand_res.json();
                const models: ModelStats[] = await model_res.json();

                setBrandStats(brands);
                setModelStats(models);

                if (rankings_res.ok) {
                    const rankings: Rankings = await rankings_res.json();
                    setGeneratedAt(rankings.generated_at);
                }

                if (metadata_res.ok) {
                    const meta: Metadata = await metadata_res.json();
                    setMetadata(meta);
                    const age_range = meta.ranges?.age ?? meta.age_range;
                    if (age_range) {
                        setAgeRange([age_range.min, age_range.max]);
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

    const {
        viewMode, showConsumer, showCommercial, selectedFuels,
        minPrice, maxPrice, selectedBrands, searchQuery,
        minFleetSize, maxFleetSize, minInspections, maxInspections
    } = deferred_filter_state;

    const max_inspections_available = metadata?.ranges?.inspections?.max ?? DEFAULTS.inspections.max;

    // Main Aggregation & Filtering Pipeline
    const processed_data = useMemo((): BrandFuelData[] => {
        const rawData = viewMode === "brands" ? brand_stats : model_stats;

        const selectedFuelsSet = selectedFuels.length > 0 ? new Set(selectedFuels) : null;
        const selectedBrandsSet = selectedBrands.length > 0 ? new Set(selectedBrands) : null;
        const q = searchQuery ? searchQuery.toLowerCase() : null;

        const filtered = rawData.filter((item) => {
            // Usage filter
            if (!(showConsumer && item.vehicle_type_group === "consumer") &&
                !(showCommercial && item.vehicle_type_group === "commercial")) {
                return false;
            }

            // Fuel filter
            if (selectedFuelsSet && !selectedFuelsSet.has(item.primary_fuel)) {
                return false;
            }

            // Price filter
            const p = item.avg_catalog_price ?? 0;
            if (p < minPrice || (maxPrice < DEFAULTS.price.max && p > maxPrice)) {
                return false;
            }

            // Inspections filter
            const insp = item.total_inspections;
            if (insp < minInspections || (maxInspections < max_inspections_available && insp > maxInspections)) {
                return false;
            }

            // Brands filter
            if (selectedBrandsSet && !selectedBrandsSet.has(item.merk)) {
                return false;
            }

            // Search query filter
            if (q) {
                if (viewMode === "brands") {
                    if (!item.merk.toLowerCase().includes(q)) return false;
                } else {
                    if (!item.merk.toLowerCase().includes(q) && !(item as ModelStats).handelsbenaming.toLowerCase().includes(q)) return false;
                }
            }

            return true;
        });

        // Aggregate
        const groupBy = (item: BrandStats | ModelStats) =>
            viewMode === "brands" ? item.merk : `${item.merk}|${(item as ModelStats).handelsbenaming}`;

        const aggregatedMap = new Map<string, BrandFuelData>();

        for (const item of filtered) {
            const key = groupBy(item);
            const existing = aggregatedMap.get(key);

            if (!existing) {
                aggregatedMap.set(key, {
                    merk: item.merk,
                    handelsbenaming: viewMode === "models" ? (item as ModelStats).handelsbenaming : undefined,
                    vehicle_count: item.vehicle_count,
                    fuel_breakdown: { ...item.fuel_breakdown },
                    petrol_pct: 0,
                    diesel_pct: 0,
                    electric_pct: 0
                });
            } else {
                existing.vehicle_count += item.vehicle_count;
                existing.fuel_breakdown = sum_fuel_breakdowns(existing.fuel_breakdown, item.fuel_breakdown);
            }
        }

        // Final Processing
        // ⚡ Bolt Performance Optimization:
        // Replaced chained `.map()` and `.filter()` operations with a single `for...of` pass over `aggregatedMap.values()`.
        // Instead of allocating intermediate arrays and cloning objects (`...item`), we compute and assign
        // percentages directly to the newly instantiated objects from the aggregation step.
        // This changes an O(2N) pipeline with high GC overhead into an O(N) zero-allocation pass.
        const results: BrandFuelData[] = [];

        for (const item of aggregatedMap.values()) {
            if (item.vehicle_count >= minFleetSize && item.vehicle_count <= maxFleetSize) {
                const total = fuel_total_calculate(item.fuel_breakdown);
                item.petrol_pct = pct_calculate(item.fuel_breakdown.Benzine, total);
                item.diesel_pct = pct_calculate(item.fuel_breakdown.Diesel, total);
                item.electric_pct = pct_calculate(item.fuel_breakdown.Elektriciteit, total);
                results.push(item);
            }
        }

        // Sort
        const mult = sort_dir === "asc" ? 1 : -1;
        results.sort((a, b) => {
            if (sort_key === "merk") {
                return mult * a.merk.localeCompare(b.merk);
            }
            const val_a = a[sort_key] as number;
            const val_b = b[sort_key] as number;
            return mult * (val_a - val_b);
        });

        return results;

    }, [brand_stats, model_stats, viewMode, showConsumer, showCommercial, selectedFuels, minPrice, maxPrice, selectedBrands, searchQuery, minFleetSize, maxFleetSize, minInspections, maxInspections, max_inspections_available, sort_key, sort_dir]);

    function column_click(key: SortKey) {
        if (sort_key === key) {
            setSortDir(sort_dir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    }

    function sort_indicator(key: SortKey): string {
        if (sort_key !== key) return "";
        return sort_dir === "asc" ? " ▲" : " ▼";
    }

    return {
        brand_stats,
        processed_data,
        generated_at,
        metadata,
        loading,
        error,
        ageRange,
        setAgeRange,
        column_click,
        sort_indicator
    };
}
