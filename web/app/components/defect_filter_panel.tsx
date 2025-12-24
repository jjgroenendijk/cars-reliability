"use client";

import { useState, useMemo } from "react";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import { Modal } from "@/app/components/ui/modal";
import {
    Filter,
    Search,
    RotateCcw,
    Check,
    Settings2,
} from "lucide-react";

/**
 * Defect filter panel component.
 * Allows users to select which defect types to include in reliability calculations.
 */
export function DefectFilterPanel() {
    const {
        mode,
        loading,
        error,
        defect_codes,
        mode_set,
        toggle_defect,
        reset_filter,
        is_included,
        active_defect_count,
    } = useDefectFilter();

    const [isModalOpen, setIsModalOpen] = useState(false);
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
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Defect Filter
                    </label>
                </div>
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
            <div className="flex flex-col gap-2">
                <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                    <button
                        onClick={() => mode_set("all")}
                        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === "all"
                            ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => mode_set("reliability")}
                        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === "reliability"
                            ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            }`}
                    >
                        Reliability
                    </button>
                </div>

                <button
                    onClick={() => {
                        mode_set("custom");
                        setIsModalOpen(true);
                    }}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${mode === "custom"
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                >
                    <Settings2 className="h-4 w-4" />
                    {mode === "custom"
                        ? `Custom (${active_defect_count} selected)`
                        : "Select Custom Defects"}
                </button>
            </div>

            {/* Custom Defect Selection Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Select Defects"
            >
                <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search defect codes..."
                            value={search_term}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                        />
                    </div>

                    {/* Defect list */}
                    <div className="max-h-[60vh] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                        {filtered_codes.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
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
                                            className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!included ? "opacity-60 bg-gray-50/50 dark:bg-gray-800/50" : ""
                                                }`}
                                        >
                                            <div
                                                className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${included
                                                    ? "bg-blue-600 border-blue-600 text-white"
                                                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                                                    }`}
                                            >
                                                {included && <Check className="h-3 w-3" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                                                        {code}
                                                    </span>
                                                    <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                                        {description || "No description"}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500 dark:text-gray-400">
                            {filtered_codes.length} defects shown
                        </span>
                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    filtered_codes.forEach(([code]) => {
                                        if (!is_included(code)) toggle_defect(code);
                                    });
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                            >
                                Select All Shown
                            </button>
                            <button
                                onClick={() => {
                                    filtered_codes.forEach(([code]) => {
                                        if (is_included(code)) toggle_defect(code);
                                    });
                                }}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                            >
                                Deselect All Shown
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
