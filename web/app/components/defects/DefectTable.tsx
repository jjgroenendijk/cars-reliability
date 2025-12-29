import { Search, Filter, ChevronUp, ChevronDown, Settings2, RotateCcw } from "lucide-react";
import type { DefectWithCategory } from "@/app/hooks/useDefectData";

interface DefectTableProps {
    filtered_defects: DefectWithCategory[];
    sort_key: "count" | "percentage";
    sort_direction: "asc" | "desc";
    handle_sort: (key: "count" | "percentage") => void;
    search_term: string;
    setSearchTerm: (v: string) => void;
    category_filter: "all" | "reliability";
    setCategoryFilter: (v: "all" | "reliability") => void;
    show_config: boolean;
    setShowConfig: (v: boolean) => void;
    toggle_reliability: (code: string, current: boolean) => void;
    reset_overrides: () => void;
    override_count: number;
    reliability_overrides: Record<string, boolean>;
}

export function DefectTable({
    filtered_defects,
    sort_key,
    sort_direction,
    handle_sort,
    search_term,
    setSearchTerm,
    category_filter,
    setCategoryFilter,
    show_config,
    setShowConfig,
    toggle_reliability,
    reset_overrides,
    override_count,
    reliability_overrides
}: DefectTableProps) {
    return (
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
    );
}
