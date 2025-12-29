import { useState, useEffect, useMemo, useCallback } from "react";
import type { DefectStats, DefectTypeStat } from "@/app/lib/types";
import { isReliabilityDefect } from "@/app/lib/defect_categories";

const STORAGE_KEY = "defect_reliability_overrides";

export interface DefectWithCategory extends DefectTypeStat {
    computed_is_reliability: boolean;
}

export function useDefectData() {
    const [defect_stats, setDefectStats] = useState<DefectStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search_term, setSearchTerm] = useState("");
    const [sort_key, setSortKey] = useState<"count" | "percentage">("count");
    const [sort_direction, setSortDirection] = useState<"asc" | "desc">("desc");
    const [category_filter, setCategoryFilter] = useState<"all" | "reliability">("reliability");
    const [show_config, setShowConfig] = useState(false);
    const [reliability_overrides, setReliabilityOverrides] = useState<Record<string, boolean>>({});

    // Load overrides from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setReliabilityOverrides(JSON.parse(saved));
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    // Save overrides to localStorage when they change
    useEffect(() => {
        try {
            if (Object.keys(reliability_overrides).length > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(reliability_overrides));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            // Ignore localStorage errors
        }
    }, [reliability_overrides]);

    // Fetch data
    useEffect(() => {
        async function data_fetch() {
            try {
                const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                const response = await fetch(`${base_path}/data/defect_stats.json`);
                if (!response.ok) {
                    throw new Error("Could not load defect data");
                }
                const data: DefectStats = await response.json();
                setDefectStats(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }
        data_fetch();
    }, []);

    // Compute is_reliability for each defect
    const defects_with_category = useMemo((): DefectWithCategory[] => {
        if (!defect_stats) return [];

        return defect_stats.top_defects.map((d) => {
            const computed = reliability_overrides[d.defect_code]
                ?? d.is_reliability
                ?? isReliabilityDefect(d.defect_code);
            return {
                ...d,
                computed_is_reliability: computed,
            };
        });
    }, [defect_stats, reliability_overrides]);

    // Filter and sort defects
    const filtered_defects = useMemo((): DefectWithCategory[] => {
        let result = [...defects_with_category];

        if (category_filter === "reliability") {
            result = result.filter((d) => d.computed_is_reliability);
        }

        if (search_term) {
            const term = search_term.toLowerCase();
            result = result.filter(
                (d) =>
                    d.defect_code.toLowerCase().includes(term) ||
                    d.defect_description.toLowerCase().includes(term)
            );
        }

        result.sort((a, b) => {
            const multiplier = sort_direction === "asc" ? 1 : -1;
            return multiplier * (a[sort_key] - b[sort_key]);
        });

        return result;
    }, [defects_with_category, search_term, sort_key, sort_direction, category_filter]);

    // Calculated stats
    const calculated_stats = useMemo(() => {
        const reliability_defects = defects_with_category.filter(d => d.computed_is_reliability);
        const reliability_count = reliability_defects.reduce((sum, d) => sum + d.count, 0);
        const total_count = defects_with_category.reduce((sum, d) => sum + d.count, 0);
        const wear_count = total_count - reliability_count;

        return {
            reliability_count,
            wear_count,
            total_count,
            reliability_percentage: total_count > 0
                ? ((reliability_count / total_count) * 100).toFixed(1)
                : "0",
        };
    }, [defects_with_category]);

    // Chart data (top 15 reliability defects)
    const chart_data = useMemo(() => {
        const reliability_defects = defects_with_category
            .filter(d => d.computed_is_reliability)
            .sort((a, b) => b.count - a.count);

        return reliability_defects.slice(0, 15).map((d) => ({
            name: d.defect_code,
            description: d.defect_description,
            count: d.count,
            percentage: d.percentage,
        }));
    }, [defects_with_category]);

    const handle_sort = useCallback((key: "count" | "percentage") => {
        if (sort_key === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    }, [sort_key]);

    const toggle_reliability = useCallback((defect_code: string, current_value: boolean) => {
        setReliabilityOverrides(prev => ({
            ...prev,
            [defect_code]: !current_value,
        }));
    }, []);

    const reset_overrides = useCallback(() => {
        setReliabilityOverrides({});
    }, []);

    const override_count = Object.keys(reliability_overrides).length;

    return {
        defect_stats,
        loading,
        error,
        search_term,
        setSearchTerm,
        sort_key,
        sort_direction,
        handle_sort,
        category_filter,
        setCategoryFilter,
        show_config,
        setShowConfig,
        filtered_defects,
        calculated_stats,
        chart_data,
        toggle_reliability,
        reset_overrides,
        override_count,
        reliability_overrides
    };
}
