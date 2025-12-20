"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { DefectStats, DefectTypeStat } from "@/app/lib/types";
import { timestamp_format } from "@/app/lib/data_load";
import { isReliabilityDefect } from "@/app/lib/defect_categories";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    AlertCircle,
    Calendar,
    ArrowRight,
    Search,
    ChevronUp,
    ChevronDown,
    BarChart3,
    ClipboardList,
    Filter,
    RotateCcw,
    Settings2,
} from "lucide-react";

const STORAGE_KEY = "defect_reliability_overrides";

interface DefectWithCategory extends DefectTypeStat {
    computed_is_reliability: boolean;
}

export default function DefectsPage() {
    const [defect_stats, setDefectStats] = useState<DefectStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search_term, setSearchTerm] = useState("");
    const [sort_key, setSortKey] = useState<"count" | "percentage">("count");
    const [sort_direction, setSortDirection] = useState<"asc" | "desc">("desc");
    const [category_filter, setCategoryFilter] = useState<"all" | "reliability">("reliability");
    const [show_config, setShowConfig] = useState(false);

    // User overrides for reliability classification
    // Map of defect_code -> boolean (true = reliability, false = wear-and-tear)
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

    // Compute is_reliability for each defect (using client-side logic + overrides)
    const defects_with_category = useMemo((): DefectWithCategory[] => {
        if (!defect_stats) return [];

        return defect_stats.top_defects.map((d) => {
            // Check for user override first, then use data field, then compute client-side
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

        // Apply category filter
        if (category_filter === "reliability") {
            result = result.filter((d) => d.computed_is_reliability);
        }

        // Apply search filter
        if (search_term) {
            const term = search_term.toLowerCase();
            result = result.filter(
                (d) =>
                    d.defect_code.toLowerCase().includes(term) ||
                    d.defect_description.toLowerCase().includes(term)
            );
        }

        // Sort
        result.sort((a, b) => {
            const multiplier = sort_direction === "asc" ? 1 : -1;
            return multiplier * (a[sort_key] - b[sort_key]);
        });

        return result;
    }, [defects_with_category, search_term, sort_key, sort_direction, category_filter]);

    // Calculated stats based on current reliability classification
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

    // Chart data (top 15 reliability defects for visibility)
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

    const handle_sort = (key: "count" | "percentage") => {
        if (sort_key === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

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

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">
                    Loading defect data...
                </div>
            </div>
        );
    }

    if (error || !defect_stats) {
        return (
            <div className="max-w-4xl mx-auto py-12">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    Defect Statistics
                </h1>
                <div className="inline-flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
                    <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                        {error ?? "Data is currently being processed. Please check back later."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Defect Statistics
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                    Analysis of defects found during APK inspections. Filter by reliability to focus on true build quality issues.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4 mb-8">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        <BarChart3 className="h-4 w-4" />
                        Total Defects
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {calculated_stats.total_count.toLocaleString()}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                        <AlertCircle className="h-4 w-4" />
                        Reliability Defects
                    </div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {calculated_stats.reliability_count.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {calculated_stats.reliability_percentage}% of total
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800 p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">
                        <ClipboardList className="h-4 w-4" />
                        Wear & Tear
                    </div>
                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {calculated_stats.wear_count.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Normal maintenance items
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        <ClipboardList className="h-4 w-4" />
                        Total Inspections
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {defect_stats.total_inspections.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Top 15 Reliability Defects
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Only showing defects that indicate actual car quality issues (excluding wear-and-tear items).
                </p>
                <div className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chart_data}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" stroke="#9ca3af" />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={100}
                                tick={{ fill: "#9ca3af", fontSize: 12 }}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {data.name}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                                                    {data.description}
                                                </p>
                                                <p className="text-sm mt-1">
                                                    <span className="font-medium">{data.count.toLocaleString()}</span>{" "}
                                                    occurrences ({data.percentage}%)
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Defects Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        All Defect Types
                    </h2>
                    <button
                        onClick={() => setShowConfig(!show_config)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${show_config
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                    >
                        <Settings2 className="h-4 w-4" />
                        Configure Categories
                        {override_count > 0 && (
                            <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                {override_count}
                            </span>
                        )}
                    </button>
                </div>

                {/* Configuration Panel */}
                {show_config && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                                    Customize Reliability Indicators
                                </h3>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Toggle defects in the table below to change whether they count as reliability issues or wear-and-tear.
                                    Your selections are saved locally.
                                </p>
                            </div>
                            {override_count > 0 && (
                                <button
                                    onClick={reset_overrides}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-lg transition-colors"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Reset to defaults
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search defects..."
                            value={search_term}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <button
                            onClick={() => setCategoryFilter("reliability")}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${category_filter === "reliability"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                }`}
                        >
                            Reliability Only
                        </button>
                        <button
                            onClick={() => setCategoryFilter("all")}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${category_filter === "all"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                }`}
                        >
                            All Defects
                        </button>
                    </div>
                </div>

                {/* Explanation */}
                {category_filter === "reliability" && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Showing only reliability-related defects. Wear-and-tear items like tires, lights, and wipers are hidden.
                    </p>
                )}

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                {show_config && (
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                                        Reliability
                                    </th>
                                )}
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                                    Code
                                </th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                                    Description
                                </th>
                                <th
                                    className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                    onClick={() => handle_sort("count")}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Count
                                        {sort_key === "count" &&
                                            (sort_direction === "desc" ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronUp className="h-4 w-4" />
                                            ))}
                                    </div>
                                </th>
                                <th
                                    className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                    onClick={() => handle_sort("percentage")}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Percentage
                                        {sort_key === "percentage" &&
                                            (sort_direction === "desc" ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronUp className="h-4 w-4" />
                                            ))}
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {filtered_defects.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={show_config ? 5 : 4}
                                        className="py-8 text-center text-gray-500 dark:text-gray-400"
                                    >
                                        No defects found matching your criteria
                                    </td>
                                </tr>
                            ) : (
                                filtered_defects.map((defect) => (
                                    <tr
                                        key={defect.defect_code}
                                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!defect.computed_is_reliability ? "opacity-60" : ""
                                            }`}
                                    >
                                        {show_config && (
                                            <td className="py-3 px-4">
                                                <button
                                                    onClick={() => toggle_reliability(defect.defect_code, defect.computed_is_reliability)}
                                                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${defect.computed_is_reliability
                                                            ? "bg-blue-600 border-blue-600 text-white"
                                                            : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                                        }`}
                                                    title={defect.computed_is_reliability ? "Marked as reliability indicator" : "Marked as wear-and-tear"}
                                                >
                                                    {defect.computed_is_reliability && (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </td>
                                        )}
                                        <td className="py-3 px-4 font-mono text-sm text-gray-900 dark:text-white">
                                            {defect.defect_code}
                                            {reliability_overrides[defect.defect_code] !== undefined && (
                                                <span className="ml-2 text-xs text-blue-500">*</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300 max-w-md">
                                            {defect.defect_description}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-sm text-gray-900 dark:text-white">
                                            {defect.count.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-sm text-gray-500 dark:text-gray-400">
                                            {defect.percentage}%
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Data footer */}
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Last updated: {timestamp_format(defect_stats.generated_at)}</span>
                </div>
                {override_count > 0 && (
                    <div className="text-blue-600 dark:text-blue-400">
                        * {override_count} custom classification{override_count !== 1 ? "s" : ""}
                    </div>
                )}
                <Link
                    href="/about"
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    Learn more about the methodology
                    <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}
