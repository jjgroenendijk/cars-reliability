"use client";

import { useState, useMemo } from "react";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import {
    Filter,
    ChevronDown,
    ChevronUp,
    Search,
    RotateCcw,
    Check,
} from "lucide-react";

/**
 * Defect filter panel component.
 * Allows users to select which defect types to include in reliability calculations.
 */
export function DefectFilterPanel() {
    const {
        mode,
        excluded_codes,
        loading,
        error,
        defect_codes,
        mode_set,
        toggle_defect,
        reset_filter,
        is_included,
        active_defect_count,
        total_defect_count,
    } = useDefectFilter();

    const [expanded, setExpanded] = useState(false);
    const [search_term, setSearchTerm] = useState("");

    // Sort defect codes alphabetically and filter by search
    const filtered_codes = useMemo(() => {
        const all_codes = Object.entries(defect_codes).sort(([a], [b]) =>
            a.localeCompare(b)
        );

        if (!search_term) return all_codes;

        const term = search_term.toLowerCase();
        return all_codes.filter(
            ([code, desc]) =>
                code.toLowerCase().includes(term) || desc.toLowerCase().includes(term)
        );
    }, [defect_codes, search_term]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Filter className="h-4 w-4 animate-pulse" />
                <span>Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-yellow-800 dark:text-yellow-200 text-sm">
                Filter unavailable
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Defect Filter
                </label>
                {mode !== "reliability" && (
                    <button
                        onClick={reset_filter}
                        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                    </button>
                )}
            </div>

            {/* Mode buttons */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => mode_set("all")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                >
                    All
                </button>
                <button
                    onClick={() => mode_set("reliability")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "reliability"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                >
                    Reliability
                </button>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "custom"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                >
                    Custom
                    {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </button>
            </div>

            {/* Expanded defect list */}
            {expanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search defect codes..."
                            value={search_term}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Defect list */}
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                        {filtered_codes.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                No defects found matching &quot;{search_term}&quot;
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filtered_codes.map(([code, description]) => {
                                    const included = is_included(code);
                                    return (
                                        <button
                                            key={code}
                                            onClick={() => toggle_defect(code)}
                                            className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!included ? "opacity-50" : ""
                                                }`}
                                        >
                                            <div
                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${included
                                                    ? "bg-blue-600 border-blue-600 text-white"
                                                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                                    }`}
                                            >
                                                {included && <Check className="h-3 w-3" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="font-mono text-sm text-gray-900 dark:text-white">
                                                    {code}
                                                </span>
                                                <span className="mx-2 text-gray-400">-</span>
                                                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                                    {description || "No description"}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selection summary */}
                    <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                            {filtered_codes.length} defects shown
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    // Select all visible
                                    filtered_codes.forEach(([code]) => {
                                        if (!is_included(code)) {
                                            toggle_defect(code);
                                        }
                                    });
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Include all shown
                            </button>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <button
                                onClick={() => {
                                    // Deselect all visible
                                    filtered_codes.forEach(([code]) => {
                                        if (is_included(code)) {
                                            toggle_defect(code);
                                        }
                                    });
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Exclude all shown
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
