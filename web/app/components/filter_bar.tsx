"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { BrandFilter } from "./brand_filter";
import { AgeRangeSlider } from "./age_range_slider";
import { FleetSizeSlider } from "./fleet_size_slider";
import { PriceRangeSlider } from "./price_range_slider";
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
    maxFleetSize: number;
    setMaxFleetSize: (size: number) => void;
    maxFleetSizeAvailable: number;
    // Defect Filter Slot
    defectFilterComponent?: React.ReactNode;
    // Standard Deviation Toggle
    showStdDev: boolean;
    setShowStdDev: (show: boolean) => void;
    // Dynamic Age Max
    // Dynamic Age
    minAgeAvailable: number;
    maxAgeAvailable: number;
    // Dynamic Price
    minPriceAvailable: number;
    maxPriceAvailable: number;
    // Dynamic Fleet
    minFleetSizeAvailable: number;
    // Catalog Price Toggle
    showCatalogPrice: boolean;
    setShowCatalogPrice: (show: boolean) => void;
    // Pagination
    pageSize: number;
    setPageSize: (size: number) => void;
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
    maxFleetSize,
    setMaxFleetSize,
    maxFleetSizeAvailable,
    defectFilterComponent,
    showStdDev,
    setShowStdDev,
    minAgeAvailable,
    maxAgeAvailable,
    minPriceAvailable,
    maxPriceAvailable,
    minFleetSizeAvailable,
    showCatalogPrice,
    setShowCatalogPrice,
    pageSize,
    setPageSize,
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

                    {/* 1. Primary Filters Group */}
                    <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto flex-1">

                        {/* Combined Search & Brand Filter */}
                        {viewMode === "brands" || viewMode === "models" ? (
                            <BrandFilter
                                brands={availableBrands}
                                selectedBrands={selectedBrands}
                                setSelectedBrands={setSelectedBrands}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                mode={viewMode}
                            />
                        ) : null}

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

                        {/* Defect Filter (Injected) */}
                        {defectFilterComponent}

                    </div>

                    <div className="flex-grow lg:block hidden" />

                    {/* 3. More Filters & Actions */}
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">

                        {/* Quick Fuel Toggles (Hidden when expanded filters are shown) */}


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

                            {/* Display Options */}
                            <div className="pt-2 mt-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">Display Options</label>
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showStdDev}
                                            onChange={(e) => setShowStdDev(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                        />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Show Standard Deviation</span>
                                    </label>

                                    {viewMode === "models" && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showCatalogPrice}
                                                onChange={(e) => setShowCatalogPrice(e.target.checked)}
                                                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                            />
                                            <span className="text-sm text-zinc-700 dark:text-zinc-300">Show Catalog Price</span>
                                        </label>
                                    )}

                                    {/* Page Size Selector */}
                                    <div className="pt-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-1">Items per page</label>
                                        <select
                                            value={pageSize === 999999 ? "All" : pageSize}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPageSize(val === "All" ? 999999 : Number(val));
                                            }}
                                            className="w-full text-xs px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        >
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                            <option value={500}>500</option>
                                            <option value={1000}>1000</option>
                                            <option value="All">All</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fuel (Full List) */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Fuel Type</label>
                            <div className="flex flex-col gap-2">
                                {FUEL_TYPES.map((fuel) => (
                                    <label key={fuel} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedFuels.includes(fuel)}
                                            onChange={() => toggleFuel(fuel)}
                                            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                        />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                            {FUEL_DISPLAY_NAMES[fuel] || fuel}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Price Filter (Only for Models view) */}
                        {viewMode === "models" && (
                            <div className="space-y-3">
                                <div className="px-1">
                                    <PriceRangeSlider
                                        minPrice={0}
                                        maxPrice={maxPriceAvailable}
                                        value={[minPrice, maxPrice]}
                                        onChange={([newMin, newMax]) => {
                                            setMinPrice(newMin);
                                            setMaxPrice(newMax);
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Age & Fleet */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <div className="px-1">
                                    <AgeRangeSlider
                                        minAge={0}
                                        maxAge={maxAgeAvailable}
                                        value={ageRange}
                                        onChange={setAgeRange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <FleetSizeSlider
                                    minFleetSize={minFleetSize}
                                    setMinFleetSize={setMinFleetSize}
                                    maxFleetSize={maxFleetSize}
                                    setMaxFleetSize={setMaxFleetSize}
                                    maxAvailable={maxFleetSizeAvailable}
                                    minAvailable={minFleetSizeAvailable}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
