"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import { ChevronDown, Search, Check, RotateCcw } from "lucide-react";

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

    const [isOpen, setIsOpen] = useState(false);
    const [search_term, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
            <div className="px-3 py-2 rounded-lg border border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm animate-pulse">
                Loading...
            </div>
        );
    }

    if (error) return null;

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${isOpen || mode !== "all"
                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                    : "bg-zinc-100 border-transparent text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
            >
                <span>Defects</span>
                {mode === "custom" && active_defect_count > 0 && (
                    <span className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs px-1.5 py-0.5 rounded-full">
                        {active_defect_count}
                    </span>
                )}
                {mode === "reliability" && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 rounded">Reliability</span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 max-h-[500px] flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-left">

                    {/* Presets */}
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-2">
                        <button
                            onClick={() => mode_set("all")}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${mode === "all"
                                ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300"
                                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                                }`}
                        >
                            All Defects
                        </button>
                        <button
                            onClick={() => mode_set("reliability")}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${mode === "reliability"
                                ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300"
                                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                                }`}
                        >
                            Reliability Only
                        </button>
                    </div>

                    {/* Custom Selection Header */}
                    <div className="p-3 pb-0">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                                Custom Selection
                            </div>
                            {mode !== "all" && (
                                <button
                                    onClick={reset_filter}
                                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    Reset
                                </button>
                            )}
                        </div>

                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search defect codes..."
                                value={search_term}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Defect List */}
                    <div className="overflow-y-auto flex-1 p-1 max-h-[300px]">
                        {filtered_codes.length === 0 ? (
                            <div className="p-4 text-center text-sm text-zinc-500">No defects found</div>
                        ) : (
                            filtered_codes.map(([code, description]) => {
                                const included = is_included(code);
                                return (
                                    <button
                                        key={code}
                                        onClick={() => toggle_defect(code)}
                                        className={`w-full flex items-start gap-3 p-2 rounded-lg text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${!included ? "opacity-50 grayscale" : ""
                                            }`}
                                    >
                                        <div
                                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${included
                                                ? "bg-blue-600 border-blue-600 text-white"
                                                : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                                                }`}
                                        >
                                            {included && <Check className="h-3 w-3" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-700 px-1 rounded">
                                                    {code}
                                                </span>
                                            </div>
                                            <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-snug">
                                                {description || "No description"}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Bulk Actions */}
                    <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-between gap-2">
                        <button
                            onClick={() => {
                                filtered_codes.forEach(([code]) => {
                                    if (!is_included(code)) toggle_defect(code);
                                });
                            }}
                            className="flex-1 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                        >
                            Select All
                        </button>
                        <button
                            onClick={() => {
                                filtered_codes.forEach(([code]) => {
                                    if (is_included(code)) toggle_defect(code);
                                });
                            }}
                            className="flex-1 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
