"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";

interface BrandStats {
    merk: string;
    vehicle_count: number;
}

interface BrandFilterProps {
    brands: BrandStats[];
    selectedBrands: string[];
    setSelectedBrands: (brands: string[]) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    mode: "brands" | "models";
}

export function BrandFilter({
    brands,
    selectedBrands,
    setSelectedBrands,
    searchQuery,
    setSearchQuery,
    mode
}: BrandFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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

    // Aggregate brands to ensure uniqueness and sum vehicle counts
    const uniqueBrands = useMemo(() => {
        const brandMap = new Map<string, number>();
        for (const brand of brands) {
            brandMap.set(brand.merk, (brandMap.get(brand.merk) || 0) + brand.vehicle_count);
        }
        return Array.from(brandMap.entries()).map(([merk, count]) => ({
            merk,
            vehicle_count: count,
        }));
    }, [brands]);

    // Sort brands by vehicle count (Popularity)
    const sortedBrands = useMemo(() => {
        return [...uniqueBrands].sort((a, b) => b.vehicle_count - a.vehicle_count);
    }, [uniqueBrands]);

    // Filter by search term
    const filteredBrands = useMemo(() => {
        if (!searchQuery) return sortedBrands;
        const lowSearch = searchQuery.toLowerCase();
        return sortedBrands.filter(b => b.merk.toLowerCase().includes(lowSearch));
    }, [sortedBrands, searchQuery]);

    const toggleBrand = (merk: string) => {
        if (selectedBrands.includes(merk)) {
            setSelectedBrands(selectedBrands.filter(b => b !== merk));
        } else {
            setSelectedBrands([...selectedBrands, merk]);
        }
    };

    const handleInputFocus = () => {
        setIsOpen(true);
    };

    // Placeholder text based on selection
    const placeholder = selectedBrands.length > 0
        ? `${selectedBrands.length} selected`
        : `Search ${mode}...`;

    return (
        <div className="relative w-full sm:w-64 lg:w-72" ref={containerRef}>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-8 py-2 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm transition-all"
                />
                {searchQuery || selectedBrands.length > 0 ? (
                    <button
                        onClick={() => {
                            setSearchQuery("");
                            if (selectedBrands.length > 0) {
                                // If we have selection, maybe we want to keep it?
                                // User intent for X usually means clear input or clear all?
                                // Let's clear search query if present, else clear selection
                                if (!searchQuery) setSelectedBrands([]);
                            }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                    >
                        <X className="w-3.5 h-3.5 text-zinc-500" />
                    </button>
                ) : (
                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none transition-transform ${isOpen ? "rotate-180" : ""}`} />
                )}
            </div>

            {/* Dropdown Results */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 max-h-[400px] flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 z-50 animate-in fade-in slide-in-from-top-2 duration-100">
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-t-xl flex justify-between items-center text-xs">
                        <span className="text-zinc-500 font-medium ml-1">Select Brands</span>
                        {selectedBrands.length > 0 && (
                            <button
                                onClick={() => setSelectedBrands([])}
                                className="text-blue-600 dark:text-blue-400 hover:underline px-2"
                            >
                                Clear ({selectedBrands.length})
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredBrands.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-sm text-zinc-500">No brands found matching &quot;{searchQuery}&quot;</p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {filteredBrands.map((brand) => {
                                    const isSelected = selectedBrands.includes(brand.merk);
                                    return (
                                        <button
                                            key={brand.merk}
                                            onClick={() => toggleBrand(brand.merk)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-all ${isSelected
                                                ? "bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100 font-medium"
                                                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected
                                                ? "bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                                                : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
                                                }`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="flex-1 truncate">{brand.merk}</span>
                                            <span className="text-xs text-zinc-400 tabular-nums">
                                                {brand.vehicle_count.toLocaleString()}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

