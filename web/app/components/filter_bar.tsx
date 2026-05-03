"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { BrandFilter } from "./brand_filter";
import { RangeSlider } from "./range_slider";
import type { BrandStats } from "@/app/lib/types";
import { useLanguage } from "@/app/lib/i18n/LanguageContext";

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
    // Other filters (Age, Fleet, Inspections)
    ageRange: [number, number];
    setAgeRange: (range: [number, number]) => void;
    minFleetSize: number;
    setMinFleetSize: (size: number) => void;
    maxFleetSize: number;
    setMaxFleetSize: (size: number) => void;
    minInspections: number;
    setMinInspections: (count: number) => void;
    maxInspections: number;
    setMaxInspections: (count: number) => void;
    // Defect Filter Slot
    defectFilterComponent?: React.ReactNode;
    // Standard Deviation Toggle
    showStdDev: boolean;
    setShowStdDev: (show: boolean) => void;
    // Dynamic ranges from metadata
    minAgeAvailable: number;
    maxAgeAvailable: number;
    minPriceAvailable: number;
    maxPriceAvailable: number;
    minFleetSizeAvailable: number;
    maxFleetSizeAvailable: number;
    minInspectionsAvailable: number;
    maxInspectionsAvailable: number;
    // Catalog Price Toggle
    showCatalogPrice: boolean;
    setShowCatalogPrice: (show: boolean) => void;
    // Pagination
    pageSize: number;
    setPageSize: (size: number) => void;
    // Available fuel types from metadata
    availableFuelTypes: string[];
}

// Price formatter for slider labels
const formatPrice = (p: number) => {
    if (p >= 1000000) return `€${(p / 1000000).toFixed(1)}M`;
    if (p >= 1000) return `€${(p / 1000).toFixed(0)}k`;
    return `€${p}`;
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
    minInspections,
    setMinInspections,
    maxInspections,
    setMaxInspections,
    defectFilterComponent,
    showStdDev,
    setShowStdDev,
    minAgeAvailable,
    maxAgeAvailable,
    minPriceAvailable,
    maxPriceAvailable,
    minFleetSizeAvailable,
    maxFleetSizeAvailable,
    minInspectionsAvailable,
    maxInspectionsAvailable,
    showCatalogPrice,
    setShowCatalogPrice,
    pageSize,
    setPageSize,
    availableFuelTypes,
}: FilterBarProps) {
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const { t } = useLanguage();

    const toggleFuel = (fuel: string) => {
        if (selectedFuels.includes(fuel)) {
            setSelectedFuels(selectedFuels.filter((f) => f !== fuel));
        } else {
            setSelectedFuels([...selectedFuels, fuel]);
        }
    };

    const fuel_label_get = (fuel: string) => {
        const fuel_keys: Record<string, string> = {
            Benzine: "fuels.legend_petrol",
            Diesel: "fuels.legend_diesel",
            Hybrid: "fuels.legend_hybrid",
            Elektriciteit: "fuels.legend_electric",
            LPG: "fuels.legend_lpg",
            Other: "fuels.legend_other",
            other: "fuels.legend_other",
        };
        return fuel_keys[fuel] ? t(fuel_keys[fuel]) : fuel;
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
                                {t("filters.brands")}
                            </button>
                            <button
                                onClick={() => setViewMode("models")}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "models"
                                    ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                                    }`}
                            >
                                {t("filters.models")}
                            </button>
                        </div>

                        {/* Defect Filter (Injected) */}
                        {defectFilterComponent}

                    </div>

                    <div className="flex-grow lg:block hidden" />

                    {/* 3. More Filters & Actions */}
                    <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">

                        <button
                            onClick={() => setShowMoreFilters(!showMoreFilters)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${showMoreFilters
                                ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900"
                                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                            <span>{t("filters.filters")}</span>
                        </button>
                    </div>
                </div>

                {/* Expanded Filters Section */}
                {showMoreFilters && (
                    <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr] gap-8 lg:gap-12 animate-in slide-in-from-top-2 duration-200">
                        {/* Usage Checkboxes */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("filters.vehicle_usage")}</label>
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showConsumer}
                                        onChange={(e) => setShowConsumer(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{t("filters.personal_cars")}</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showCommercial}
                                        onChange={(e) => setShowCommercial(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{t("filters.commercial_vehicles")}</span>
                                </label>
                            </div>

                            {/* Display Options */}
                            <div className="pt-2 mt-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-2">{t("filters.display_options")}</label>
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showStdDev}
                                            onChange={(e) => setShowStdDev(e.target.checked)}
                                            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                        />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">{t("filters.show_standard_deviation")}</span>
                                    </label>

                                    {viewMode === "models" && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showCatalogPrice}
                                                onChange={(e) => setShowCatalogPrice(e.target.checked)}
                                                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                            />
                                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{t("filters.show_catalog_price")}</span>
                                        </label>
                                    )}

                                    {/* Page Size Selector */}
                                    <div className="pt-2">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block mb-1">{t("filters.items_per_page")}</label>
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
                                            <option value="All">{t("filters.all")}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fuel (Full List) */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("filters.fuel_type")}</label>
                            <div className="flex flex-col gap-2">
                                {availableFuelTypes.map((fuel) => (
                                    <label key={fuel} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedFuels.includes(fuel)}
                                            onChange={() => toggleFuel(fuel)}
                                            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 dark:bg-zinc-700"
                                        />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                                            {fuel_label_get(fuel)}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Sliders Column 1: Price & Age */}
                        <div className="space-y-6">
                            {/* Price Filter (Only for Models view) */}
                            {viewMode === "models" && (
                                <div className="px-1">
                                    <RangeSlider
                                        label={t("filters.price_range")}
                                        min={minPriceAvailable}
                                        max={maxPriceAvailable}
                                        value={[minPrice, maxPrice]}
                                        onChange={([min, max]) => {
                                            setMinPrice(min);
                                            setMaxPrice(max);
                                        }}
                                        formatValue={formatPrice}
                                        inputWidth="w-20"
                                    />
                                </div>
                            )}

                            <div className="px-1">
                                <RangeSlider
                                    label={t("filters.vehicle_age")}
                                    min={minAgeAvailable}
                                    max={maxAgeAvailable}
                                    value={ageRange}
                                    onChange={setAgeRange}
                                    unit={t("filters.years")}
                                    inputWidth="w-12"
                                />
                            </div>
                        </div>

                        {/* Sliders Column 2: Fleet & Inspections */}
                        <div className="space-y-6">
                            <RangeSlider
                                label={t("filters.fleet_size")}
                                min={minFleetSizeAvailable}
                                max={maxFleetSizeAvailable}
                                value={[minFleetSize, maxFleetSize]}
                                onChange={([min, max]) => {
                                    setMinFleetSize(min);
                                    setMaxFleetSize(max);
                                }}
                                inputWidth="w-20"
                            />

                            <RangeSlider
                                label={t("filters.inspections")}
                                min={minInspectionsAvailable}
                                max={maxInspectionsAvailable}
                                value={[minInspections, maxInspections]}
                                onChange={([min, max]) => {
                                    setMinInspections(min);
                                    setMaxInspections(max);
                                }}
                                inputWidth="w-20"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
