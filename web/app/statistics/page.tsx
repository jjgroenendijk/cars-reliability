"use client";

import { Suspense, useMemo, useEffect } from "react";
import { ReliabilityTable } from "@/app/components/reliability_table";
import { DefectFilterPanel } from "@/app/components/defect_filter_panel";
import FilterBar from "@/app/components/filter_bar";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import { timestamp_format } from "@/app/lib/data_load";
import { RefreshCw, AlertTriangle, Info, Trophy } from "lucide-react";
import { columns_build } from "@/app/lib/statistics_config";
import { useStatisticsData } from "@/app/hooks/useStatisticsData";
import { useStatisticsProcessing } from "@/app/hooks/useStatisticsProcessing";
import { useUrlSync } from "@/app/hooks/useUrlSync";
import { TablePagination } from "@/app/components/table_pagination";
import { DEFAULTS } from "@/app/lib/defaults";

/**
 * Loading fallback for the statistics page while URL params are being read.
 */
function StatisticsLoading() {
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="space-y-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Reliability Statistics
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl">
                        Comprehensive analysis of vehicle reliability based on millions of RDW inspection records.
                    </p>
                </div>
            </div>
            <div className="animate-pulse space-y-8">
                <div className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />
                <div className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-3xl" />
            </div>
        </div>
    );
}

/**
 * Main statistics page wrapped in Suspense for useSearchParams support.
 */
export default function StatisticsPage() {
    return (
        <Suspense fallback={<StatisticsLoading />}>
            <StatisticsContent />
        </Suspense>
    );
}

/**
 * Statistics page content with URL sync and data processing.
 */
function StatisticsContent() {
    // Defect Context
    const { brand_breakdowns, model_breakdowns, calculate_filtered_defects, mode } = useDefectFilter();

    // 1. Fetch Data (No dependencies)
    const {
        brand_stats: fetchedBrands,
        model_stats: fetchedModels,
        metadata,
        generated_at,
        loading: isLoading,
        error: isError
    } = useStatisticsData();

    // 2. Init State & URL Sync (Depends on metadata for defaults)
    const state = useUrlSync({
        metadata: metadata || {}
    });

    // 3. Process Data (Depends on Data + State)
    const {
        processed_data: finalData,
        isAgeFilterActive
    } = useStatisticsProcessing({
        brand_stats: fetchedBrands,
        model_stats: fetchedModels,
        metadata: metadata || {},
        filterState: {
            ...state,
            maxPriceAvailable: state.maxPriceAvailable,
            maxInspectionsAvailable: state.maxInspectionsAvailable
        },
        defectFilter: { brand_breakdowns, model_breakdowns, calculate_filtered_defects, mode }
    });

    // Handle Metadata -> State updates (Moved here from page logic/old hook)
    useEffect(() => {
        if (metadata?.ranges) {
            state.setMaxPrice(metadata.ranges.price.max);
            state.setMaxFleetSize(metadata.ranges.fleet.max);
            state.setAgeRange([metadata.ranges.age.min, metadata.ranges.age.max]);
        } else if (metadata?.age_range) {
            state.setAgeRange([metadata.age_range.min, metadata.age_range.max]);
        }
    }, [metadata]);


    // Memoize columns
    const tableColumns = useMemo(() => {
        const baseCols = columns_build(state.viewMode, {
            showStdDev: state.showStdDev,
            isAgeFilterActive
        });

        const cols = [...baseCols];

        if (state.viewMode === "models" && state.showCatalogPrice) {
            cols.splice(2, 0, {
                key: "avg_catalog_price",
                label: "Avg. Price",
                format: (v: unknown) => (typeof v === 'number') ? `€ ${Number(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}` : "-"
            });
        }

        return cols;
    }, [state.viewMode, isAgeFilterActive, state.showStdDev, state.showCatalogPrice]);

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-4">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <h2 className="text-xl font-bold">Error Loading Data</h2>
                    <p>{isError}</p>
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
                        Reliability Statistics
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2 max-w-2xl">
                        Comprehensive analysis of vehicle reliability based on millions of RDW inspection records.
                    </p>
                </div>

                {/* Main Filter Bar */}
                <FilterBar
                    viewMode={state.viewMode}
                    setViewMode={state.setViewMode}
                    searchQuery={state.searchQuery}
                    setSearchQuery={state.setSearchQuery}
                    showConsumer={state.showConsumer}
                    setShowConsumer={state.setShowConsumer}
                    showCommercial={state.showCommercial}
                    setShowCommercial={state.setShowCommercial}
                    availableBrands={fetchedBrands}
                    selectedBrands={state.selectedBrands}
                    setSelectedBrands={state.setSelectedBrands}
                    selectedFuels={state.selectedFuels}
                    setSelectedFuels={state.setSelectedFuels}
                    minPrice={state.minPrice}
                    maxPrice={state.maxPrice}
                    setMinPrice={state.setMinPrice}
                    setMaxPrice={state.setMaxPrice}
                    ageRange={state.ageRange}
                    setAgeRange={state.setAgeRange}
                    minFleetSize={state.minFleetSize}
                    setMinFleetSize={state.setMinFleetSize}
                    maxFleetSize={state.maxFleetSize}
                    setMaxFleetSize={state.setMaxFleetSize}
                    maxFleetSizeAvailable={state.maxFleetSizeAvailable}
                    minFleetSizeAvailable={metadata.ranges?.fleet.min ?? 0}
                    minInspections={state.minInspections}
                    maxInspections={state.maxInspections}
                    setMinInspections={state.setMinInspections}
                    setMaxInspections={state.setMaxInspections}
                    minInspectionsAvailable={metadata.ranges?.inspections?.min ?? 0}
                    maxInspectionsAvailable={state.maxInspectionsAvailable}
                    defectFilterComponent={<DefectFilterPanel />}
                    showStdDev={state.showStdDev}
                    setShowStdDev={state.setShowStdDev}
                    minAgeAvailable={metadata.ranges?.age.min ?? 0}
                    maxAgeAvailable={metadata.ranges?.age.max ?? 30}
                    minPriceAvailable={metadata.ranges?.price.min ?? 0}
                    maxPriceAvailable={state.maxPriceAvailable}
                    showCatalogPrice={state.showCatalogPrice}
                    setShowCatalogPrice={state.setShowCatalogPrice}
                    pageSize={state.pageSize}
                    setPageSize={state.setPageSize}
                    availableFuelTypes={metadata.fuel_types ?? []}
                />
            </div>

            {
                isLoading ? (
                    <div className="animate-pulse space-y-8">
                        <div className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-3xl" />
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />)}
                        </div>
                    </div>
                ) : finalData.length > 0 ? (
                    <>
                        {/* Pagination above table */}
                        {state.pageSize && (
                            <TablePagination
                                currentPage={state.currentPage}
                                totalPages={Math.ceil(finalData.length / state.pageSize)}
                                totalItems={finalData.length}
                                pageSize={state.pageSize}
                                onPageChange={state.setCurrentPage}
                            />
                        )}

                        {/* Table */}
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-yellow-500" />
                                    Rankings
                                </h2>
                                <span className="text-sm text-zinc-500">
                                    Found {finalData.length} {state.viewMode}
                                </span>
                            </div>
                            <ReliabilityTable
                                data={finalData}
                                columns={tableColumns}
                                defaultSortKey="filtered_defects_per_vehicle_year"
                                defaultSortDirection="asc"
                                filterKey={(state.viewMode === "brands" ? "merk" : "handelsbenaming") as keyof typeof finalData[number]}
                                hideSearchInput={true}
                                pageSize={state.pageSize}
                                currentPage={state.currentPage}
                                onPageChange={state.setCurrentPage}
                            />
                        </div>

                        {/* Pagination below table */}
                        {state.pageSize && (
                            <TablePagination
                                currentPage={state.currentPage}
                                totalPages={Math.ceil(finalData.length / state.pageSize)}
                                totalItems={finalData.length}
                                pageSize={state.pageSize}
                                onPageChange={state.setCurrentPage}
                            />
                        )}
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
                                state.setSelectedFuels([]);
                                state.setMinPrice(DEFAULTS.price.min);
                                state.setMaxPrice(DEFAULTS.price.max);
                                state.setAgeRange([DEFAULTS.age.min, DEFAULTS.age.max]);
                                state.setSearchQuery("");
                            }}
                            className="mt-6 text-blue-600 dark:text-blue-400 font-medium hover:underline"
                        >
                            Clear filters
                        </button>
                    </div>
                )
            }

            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                <p>Data: RDW Open Data {generated_at && `| Updated: ${timestamp_format(generated_at)}`}</p>
            </div>
        </div >
    );
}
