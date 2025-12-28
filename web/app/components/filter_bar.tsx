"use client";

import { useState } from "react";
import { Search, Filter } from "lucide-react";
import { BrandFilter } from "./brand_filter";
import type { BrandStats } from "@/app/lib/types";

interface FilterBarProps {
    viewMode: "brands" | "models";
    setViewMode: (mode: "brands" | "models") => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    showConsumer: boolean;
    setShowConsumer: (show: boolean) => void;
    showCommercial: boolean;
    setShowCommercial: (show: boolean) => void;
    // Brand Filter
    availableBrands: BrandStats[];
    selectedBrands: string[];
    setSelectedBrands: (brands: string[]) => void;
    // Fuel Filter
    selectedFuels: string[];
    setSelectedFuels: (fuels: string[]) => void;
    // Price Filter
    minPrice: number;
    maxPrice: number;
    setMinPrice: (price: number) => void;
    setMaxPrice: (price: number) => void;
    // Other filters (Age, Fleet)
    ageRange: [number, number];
    setAgeRange: (range: [number, number]) => void;
    minFleetSize: number;
    setMinFleetSize: (size: number) => void;
    maxFleetSizeAvailable: number;
    // Defect Filter Slot
    defectFilterComponent?: React.ReactNode;
    // Standard Deviation Toggle
    showStdDev: boolean;
    setShowStdDev: (show: boolean) => void;
}

const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "EV", "LPG", "Other"];
const FUEL_DISPLAY_NAMES: Record<string, string> = {
    "Petrol": "Petrol",
    "Diesel": "Diesel",
    "Hybrid": "Hybrid",
    "EV": "Electric",
    "LPG": "LPG",
    "Other": "Other",
};
const PRICE_STEP = 5000;
const MAX_PRICE_LIMIT = 100000;

export default function FilterBar({
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    showConsumer,
    setShowConsumer,
    showCommercial,
    setShowCommercial,
    availableBrands,
    selectedBrands,
    setSelectedBrands,
    selectedFuels,
    setSelectedFuels,
    minPrice,
    maxPrice,
    setMinPrice,
    setMaxPrice,
    ageRange,
    setAgeRange,
    minFleetSize,
    setMinFleetSize,
    maxFleetSizeAvailable,
    defectFilterComponent,
    showStdDev,
    setShowStdDev,
}: FilterBarProps) {
    const [showMoreFilters, setShowMoreFilters] = useState(false);

    const toggleFuel = (fuel: string) => {
        if (selectedFuels.includes(fuel)) {
            setSelectedFuels(selectedFuels.filter((f) => f !== fuel));
        } else {
            setSelectedFuels([...selectedFuels, fuel]);
        }
    };

    return (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-2 lg:p-3 sticky top-4 z-40 transition-all">
            <div className="flex flex-col gap-3">
                {/* Primary Control Bar */}
                <div className="flex flex-col lg:flex-row items-center gap-3 w-full">

                    {/* 1. Search Bar (Primary) */}
                    <div className="relative w-full lg:w-64 flex-shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder={`Search ${viewMode}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-transparent focus:border-blue-500 focus:ring-0 rounded-xl text-sm transition-all"
                        />
                    </div>

                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 hidden lg:block" />

                    {/* 2. Primary Filters Group */}
                    <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">

                        {/* Brand Filter */}
                        {viewMode === "brands" || viewMode === "models" ? (
                            <BrandFilter
                                brands={availableBrands}
                                selectedBrands={selectedBrands}
                                setSelectedBrands={setSelectedBrands}
                            />
                        ) : null}

                        {/* Defect Filter (Injected) */}
                        {defectFilterComponent}

                        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-1 hidden sm:block" />

                        {/* View Mode Toggle */}
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg inline-flex flex-shrink-0">
                            <button
                                onClick={() => setViewMode("brands")}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "brands"
                                    ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                                    }`}
                            >
                                Brands
                            </button>
                            <button
                                onClick={() => setViewMode("models")}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "models"
                                    ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                                    }`}
                            >
                                Models
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow lg:block hidden" />

                    {/* 3. More Filters & Actions */}
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">

                        {/* Quick Fuel Toggles (Hidden when expanded filters are shown) */}
                        {!showMoreFilters && (
                            <div className="hidden xl:flex items-center gap-1">
                                {FUEL_TYPES.slice(0, 4).map((fuel) => (
                                    <button
                                        key={fuel}
                                        onClick={() => toggleFuel(fuel)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedFuels.includes(fuel)
                                            ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                                            : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700 hover:border-zinc-300"
                                            }`}
                                    >
                                        {FUEL_DISPLAY_NAMES[fuel] || fuel}
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setShowMoreFilters(!showMoreFilters)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${showMoreFilters
                                ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
                                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                            <span>Filters</span>
                        </button>
                    </div>
                </div>

                {/* Expanded Filters Section */}
                {showMoreFilters && (
                    <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-200">
                        {/* Usage Checkboxes */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Vehicle Usage</label>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showConsumer}
                                        onChange={(e) => setShowConsumer(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Personal Cars</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showCommercial}
                                        onChange={(e) => setShowCommercial(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Commercial Vehicles</span>
                                </label>
                            </div>
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showStdDev}
                                        onChange={(e) => setShowStdDev(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Show Std. Dev.</span>
                                </label>
                            </div>
                        </div>

                        {/* Fuel (Full List) */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Fuel Type</label>
                            <div className="flex flex-wrap gap-1">
                                {FUEL_TYPES.map((fuel) => (
                                    <button
                                        key={fuel}
                                        onClick={() => toggleFuel(fuel)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedFuels.includes(fuel)
                                            ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                                            : "bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                                            }`}
                                    >
                                        {FUEL_DISPLAY_NAMES[fuel] || fuel}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Price Filter (Only for Models view) */}
                        {viewMode === "models" && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Price Range</label>
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                        {minPrice >= MAX_PRICE_LIMIT ? "€100k+" : `€${(minPrice / 1000).toFixed(0)}k`} - {maxPrice >= MAX_PRICE_LIMIT ? "€100k+" : `€${(maxPrice / 1000).toFixed(0)}k`}
                                    </span>
                                </div>
                                <div className="px-1 flex gap-4 items-center">
                                    <input
                                        type="range"
                                        min="0"
                                        max={MAX_PRICE_LIMIT}
                                        step={PRICE_STEP}
                                        value={minPrice}
                                        onChange={(e) => {
                                            const val = Math.min(Number(e.target.value), maxPrice - PRICE_STEP);
                                            setMinPrice(val);
                                        }}
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <input
                                        type="range"
                                        min="0"
                                        max={MAX_PRICE_LIMIT}
                                        step={PRICE_STEP}
                                        value={maxPrice}
                                        onChange={(e) => {
                                            const val = Math.max(Number(e.target.value), minPrice + PRICE_STEP);
                                            setMaxPrice(val);
                                        }}
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Age & Fleet */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Vehicle Age</label>
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                        {ageRange[0]} - {ageRange[1]} years
                                    </span>
                                </div>
                                <div className="flex gap-2 items-center px-1">
                                    <input
                                        type="range"
                                        min="0"
                                        max="40"
                                        value={ageRange[0]}
                                        onChange={(e) => {
                                            const val = Math.min(Number(e.target.value), ageRange[1] - 1);
                                            setAgeRange([val, ageRange[1]]);
                                        }}
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <input
                                        type="range"
                                        min="0"
                                        max="40"
                                        value={ageRange[1]}
                                        onChange={(e) => {
                                            const val = Math.max(Number(e.target.value), ageRange[0] + 1);
                                            setAgeRange([ageRange[0], val]);
                                        }}
                                        className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Min. Fleet Size</label>
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                        {minFleetSize}+ vehicles
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max={Math.min(maxFleetSizeAvailable, 5000)}
                                    step="10"
                                    value={minFleetSize}
                                    onChange={(e) => setMinFleetSize(Number(e.target.value))}
                                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
