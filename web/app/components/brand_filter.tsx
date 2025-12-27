"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

interface BrandStats {
    merk: string;
    vehicle_count: number;
}

interface BrandFilterProps {
    brands: BrandStats[];
    selectedBrands: string[];
    setSelectedBrands: (brands: string[]) => void;
}

export function BrandFilter({ brands, selectedBrands, setSelectedBrands }: BrandFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
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

    // Sort brands by vehicle count (Popularity)
    const sortedBrands = useMemo(() => {
        return [...brands].sort((a, b) => b.vehicle_count - a.vehicle_count);
    }, [brands]);

    // Filter by search term
    const filteredBrands = useMemo(() => {
        if (!searchTerm) return sortedBrands;
        const lowSearch = searchTerm.toLowerCase();
        return sortedBrands.filter(b => b.merk.toLowerCase().includes(lowSearch));
    }, [sortedBrands, searchTerm]);

    const toggleBrand = (merk: string) => {
        if (selectedBrands.includes(merk)) {
            setSelectedBrands(selectedBrands.filter(b => b !== merk));
        } else {
            setSelectedBrands([...selectedBrands, merk]);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${isOpen || selectedBrands.length > 0
                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
                    : "bg-zinc-100 border-transparent text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
            >
                <span>Brands</span>
                {selectedBrands.length > 0 && (
                    <span className="bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-100 text-xs px-1.5 py-0.5 rounded-full">
                        {selectedBrands.length}
                    </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 max-h-[400px] flex flex-col bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                    {/* Header with Search */}
                    <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search brands..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-between text-xs px-1">
                            <button
                                onClick={() => setSelectedBrands([])}
                                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                                disabled={selectedBrands.length === 0}
                            >
                                Clear selected
                            </button>
                            <span className="text-zinc-400">{filteredBrands.length} brands</span>
                        </div>
                    </div>

                    {/* Brand List */}
                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredBrands.length === 0 ? (
                            <div className="p-4 text-center text-sm text-zinc-500">No brands found</div>
                        ) : (
                            filteredBrands.map((brand) => {
                                const isSelected = selectedBrands.includes(brand.merk);
                                return (
                                    <button
                                        key={brand.merk}
                                        onClick={() => toggleBrand(brand.merk)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${isSelected
                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                            : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                            }`}
                                    >
                                        <span className="truncate">{brand.merk}</span>
                                        {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
