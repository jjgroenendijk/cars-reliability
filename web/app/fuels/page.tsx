"use client";

import { useState } from "react";
import { timestamp_format } from "@/app/lib/data_load";
import FilterBar from "@/app/components/filter_bar";
import { DefectFilterPanel } from "@/app/components/defect_filter_panel";
import { AlertTriangle, RefreshCw, Info } from "lucide-react";
import { useFuelData } from "@/app/hooks/useFuelData";
import { FuelTable } from "@/app/components/fuels/FuelTable";
import { FuelLegend } from "@/app/components/fuels/FuelLegend";

export default function FuelsPage() {
  const [viewMode, setViewMode] = useState<"brands" | "models">("brands");
  const [showStdDev, setShowStdDev] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showConsumer, setShowConsumer] = useState(true);
  const [showCommercial, setShowCommercial] = useState(false);
  const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);
  const [minFleetSize, setMinFleetSize] = useState(100);
  const [maxFleetSize, setMaxFleetSize] = useState(5000);
  const [showCatalogPrice, setShowCatalogPrice] = useState(false);

  const filterState = {
    viewMode,
    showConsumer,
    showCommercial,
    selectedFuels,
    minPrice,
    maxPrice,
    selectedBrands,
    searchQuery,
    minFleetSize,
    maxFleetSize
  };

  const {
    brand_stats,
    processed_data,
    generated_at,
    loading,
    error,
    ageRange,
    setAgeRange,
    column_click,
    sort_indicator
  } = useFuelData(filterState);

  const defaultMin = 4;
  const defaultMax = 20;
  const maxFleetSizeAvailable = 5000;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-4">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h2 className="text-xl font-bold">Error Loading Data</h2>
          <p>{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-zinc-900 text-zinc-50 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Retry
          <RefreshCw className="w-4 h-4 inline-block ml-2" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Fuel Type Breakdown
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl">
            Overview of fuel type distribution by brand. Compare electric, diesel, and petrol
            percentages across manufacturers.
          </p>
        </div>

        {/* Main Filter Bar */}
        <FilterBar
          viewMode={viewMode}
          setViewMode={setViewMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showConsumer={showConsumer}
          setShowConsumer={setShowConsumer}
          showCommercial={showCommercial}
          setShowCommercial={setShowCommercial}
          availableBrands={brand_stats}
          selectedBrands={selectedBrands}
          setSelectedBrands={setSelectedBrands}
          selectedFuels={selectedFuels}
          setSelectedFuels={setSelectedFuels}
          minPrice={minPrice}
          maxPrice={maxPrice}
          setMinPrice={setMinPrice}
          setMaxPrice={setMaxPrice}
          ageRange={ageRange}
          setAgeRange={setAgeRange}
          minFleetSize={minFleetSize}
          setMinFleetSize={setMinFleetSize}
          maxFleetSize={maxFleetSize}
          setMaxFleetSize={setMaxFleetSize}
          maxFleetSizeAvailable={maxFleetSizeAvailable}
          defectFilterComponent={<DefectFilterPanel />}
          showStdDev={showStdDev}
          setShowStdDev={setShowStdDev}
          maxAgeAvailable={30}
          maxPriceAvailable={100000}
          showCatalogPrice={showCatalogPrice}
          setShowCatalogPrice={setShowCatalogPrice}
        />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-8">
          <div className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-3xl" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />)}
          </div>
        </div>
      ) : processed_data.length > 0 ? (
        <>
          <FuelTable
            data={processed_data}
            viewMode={viewMode}
            column_click={column_click}
            sort_indicator={sort_indicator}
          />
          <FuelLegend />
        </>
      ) : (
        <div className="text-center py-24 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700">
          <Info className="w-12 h-12 mx-auto text-zinc-400 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No results found</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-2">
            Try adjusting your filters.
          </p>
          <button
            onClick={() => {
              setSelectedFuels([]);
              setMinPrice(0);
              setMaxPrice(100000);
              setAgeRange([defaultMin, defaultMax]);
              setSearchQuery("");
            }}
            className="mt-6 text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="text-sm text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-8">
        <p>
          Data: RDW Open Data
          {generated_at && (
            <span className="ml-2">| Updated: {timestamp_format(generated_at)}</span>
          )}
        </p>
      </div>
    </div>
  );
}
