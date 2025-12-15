"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { DefectStats, DefectTypeStat } from "@/app/lib/types";
import { timestamp_format } from "@/app/lib/data_load";
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
} from "lucide-react";

export default function DefectsPage() {
    const [defect_stats, setDefectStats] = useState<DefectStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search_term, setSearchTerm] = useState("");
    const [sort_key, setSortKey] = useState<"count" | "percentage">("count");
    const [sort_direction, setSortDirection] = useState<"asc" | "desc">("desc");

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

    // Filter and sort defects
    const filtered_defects = useMemo((): DefectTypeStat[] => {
        if (!defect_stats) return [];

        let result = [...defect_stats.top_defects];

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
    }, [defect_stats, search_term, sort_key, sort_direction]);

    // Chart data (top 15 for visibility)
    const chart_data = useMemo(() => {
        if (!defect_stats) return [];
        return defect_stats.top_defects.slice(0, 15).map((d) => ({
            name: d.defect_code,
            description: d.defect_description,
            count: d.count,
            percentage: d.percentage,
        }));
    }, [defect_stats]);

    const handle_sort = (key: "count" | "percentage") => {
        if (sort_key === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDirection("desc");
        }
    };

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
                    Overview of the most common defects found during APK inspections.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3 mb-8">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        <BarChart3 className="h-4 w-4" />
                        Total Defects
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {defect_stats.total_defects.toLocaleString()}
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

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        <AlertCircle className="h-4 w-4" />
                        Avg. Defects per Inspection
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {defect_stats.avg_defects_per_inspection.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Top 15 Most Common Defects
                </h2>
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
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    All Defect Types
                </h2>

                {/* Search */}
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
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
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
                                        colSpan={4}
                                        className="py-8 text-center text-gray-500 dark:text-gray-400"
                                    >
                                        No defects found matching your criteria
                                    </td>
                                </tr>
                            ) : (
                                filtered_defects.map((defect) => (
                                    <tr
                                        key={defect.defect_code}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                    >
                                        <td className="py-3 px-4 font-mono text-sm text-gray-900 dark:text-white">
                                            {defect.defect_code}
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
