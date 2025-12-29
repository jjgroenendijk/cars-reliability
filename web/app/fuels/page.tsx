"use client";

import { useState, useEffect, useMemo } from "react";
import type { BrandStats, ModelStats, Rankings, FuelBreakdown } from "@/app/lib/types";
import { FuelBreakdownBar } from "@/app/components/fuel_breakdown";
import { timestamp_format, pascal_case_format } from "@/app/lib/data_load";
import FilterBar from "@/app/components/filter_bar";
import { DefectFilterPanel } from "@/app/components/defect_filter_panel";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import { AlertTriangle, RefreshCw, Info } from "lucide-react";

type SortKey = "merk" | "vehicle_count" | "electric_pct" | "diesel_pct" | "petrol_pct";
type SortDir = "asc" | "desc";

interface BrandFuelData {
  merk: string;
  handelsbenaming?: string; // Optional, present in model view
  vehicle_count: number;
  fuel_breakdown: FuelBreakdown;
  petrol_pct: number;
  diesel_pct: number;
  electric_pct: number;
  // For sorting
  [key: string]: string | number | FuelBreakdown | undefined;
}

interface Metadata {
  age_range?: { min: number; max: number };
}

function fuel_total_calculate(fb: FuelBreakdown): number {
  return fb.Benzine + fb.Diesel + fb.Elektriciteit + fb.LPG + fb.other;
}

function pct_calculate(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function sum_fuel_breakdowns(a: FuelBreakdown, b: FuelBreakdown): FuelBreakdown {
  return {
    Benzine: a.Benzine + b.Benzine,
    Diesel: a.Diesel + b.Diesel,
    Elektriciteit: a.Elektriciteit + b.Elektriciteit,
    LPG: a.LPG + b.LPG,
    other: a.other + b.other,
  };
}

export default function FuelsPage() {
  const [viewMode, setViewMode] = useState<"brands" | "models">("brands");
  const [showStdDev, setShowStdDev] = useState(false); // Prop required by FilterBar, though maybe not used here

  const [brand_stats, setBrandStats] = useState<BrandStats[]>([]);
  const [model_stats, setModelStats] = useState<ModelStats[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({});
  const [generated_at, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [showConsumer, setShowConsumer] = useState(true);
  const [showCommercial, setShowCommercial] = useState(false);

  // New Filters
  const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);

  // Sliders
  const defaultMin = 4;
  const defaultMax = 20;
  const [ageRange, setAgeRange] = useState<[number, number]>([defaultMin, defaultMax]);
  const [minFleetSize, setMinFleetSize] = useState(100);

  // Defect context (kept for FilterBar compatibility, though mostly for defects)
  const { } = useDefectFilter();

  const [sort_key, setSortKey] = useState<SortKey>("electric_pct");
  const [sort_dir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    async function data_fetch() {
      try {
        const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const t = Date.now();
        const [brand_res, model_res, rankings_res, metadata_res] = await Promise.all([
          fetch(`${base_path}/data/brand_stats.json?t=${t}`),
          fetch(`${base_path}/data/model_stats.json?t=${t}`),
          fetch(`${base_path}/data/rankings.json?t=${t}`),
          fetch(`${base_path}/data/metadata.json?t=${t}`),
        ]);

        if (!brand_res.ok || !model_res.ok) {
          throw new Error("Could not load statistics data");
        }

        const brands: BrandStats[] = await brand_res.json();
        const models: ModelStats[] = await model_res.json();

        setBrandStats(brands);
        setModelStats(models);

        if (rankings_res.ok) {
          const rankings: Rankings = await rankings_res.json();
          setGeneratedAt(rankings.generated_at);
        }

        if (metadata_res.ok) {
          const meta: Metadata = await metadata_res.json();
          setMetadata(meta);
          if (meta.age_range) {
            setAgeRange([meta.age_range.min, meta.age_range.max]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    data_fetch();
  }, []);

  // Max fleet size for slider
  const maxFleetSizeAvailable = useMemo(() => {
    // Only rough estimation for slider limits
    return 5000;
  }, []);

  // Main Aggregation & Filtering Pipeline
  const processed_data = useMemo((): BrandFuelData[] => {
    // 1. Select Source
    const rawData = viewMode === "brands" ? brand_stats : model_stats;

    // 2. Filter Rows (Fuel, Price, Usage) - EXACTLY as statistics page
    let filtered = rawData.filter((item) => {
      if (showConsumer && item.vehicle_type_group === "consumer") return true;
      if (showCommercial && item.vehicle_type_group === "commercial") return true;
      return false;
    });

    if (selectedFuels.length > 0) {
      filtered = filtered.filter((item) => selectedFuels.includes(item.primary_fuel));
    }

    filtered = filtered.filter((item) => {
      const p = item.price_segment;
      if (maxPrice >= 100000) return p >= minPrice;
      return p >= minPrice && p <= maxPrice;
    });

    if (selectedBrands.length > 0) {
      filtered = filtered.filter((item) => selectedBrands.includes(item.merk));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        if (viewMode === "brands") return item.merk.toLowerCase().includes(q);
        return (
          item.merk.toLowerCase().includes(q) || (item as ModelStats).handelsbenaming.toLowerCase().includes(q)
        );
      });
    }

    // 3. Aggregate Rows to fix duplicates & combine broken down rows
    // Key is just Brand name for brand view, Brand+Model for model view
    const groupBy = (item: BrandStats | ModelStats) =>
      viewMode === "brands" ? item.merk : `${item.merk}|${(item as ModelStats).handelsbenaming}`;

    const aggregatedMap = new Map<string, BrandFuelData>();

    for (const item of filtered) {
      const key = groupBy(item);
      const existing = aggregatedMap.get(key);

      // When merging, we need to correctly sum the fuel breakdowns.
      // But wait: 'item.fuel_breakdown' in raw data is for THAT Specific row (e.g. Petrol version).
      // If we are aggregating, we are summing separate rows that might have different primary fuels.
      // The `fuel_breakdown` field on the item should already contain the breakdown for THAT item?
      // Actually, in `brand_stats`, `fuel_breakdown` is likely tailored to the BRAND total?
      // No, strictly speaking:
      // If `brand_stats` has multiple rows for "Knaus" (one consumer, one commercial),
      // each row has a `fuel_breakdown`. We must sum them.

      if (!existing) {
        aggregatedMap.set(key, {
          merk: item.merk,
          handelsbenaming: viewMode === "models" ? (item as ModelStats).handelsbenaming : undefined,
          vehicle_count: item.vehicle_count,
          fuel_breakdown: { ...item.fuel_breakdown },
          petrol_pct: 0, // calc later
          diesel_pct: 0,
          electric_pct: 0
        });
      } else {
        existing.vehicle_count += item.vehicle_count;
        existing.fuel_breakdown = sum_fuel_breakdowns(existing.fuel_breakdown, item.fuel_breakdown);
      }
    }

    // 4. Final Processing (Percents & Fleet Filter)
    let results = Array.from(aggregatedMap.values());

    results = results.map(item => {
      const total = fuel_total_calculate(item.fuel_breakdown);
      return {
        ...item,
        petrol_pct: pct_calculate(item.fuel_breakdown.Benzine, total),
        diesel_pct: pct_calculate(item.fuel_breakdown.Diesel, total),
        electric_pct: pct_calculate(item.fuel_breakdown.Elektriciteit, total),
      };
    });

    // Filter by fleet size
    results = results.filter(item => item.vehicle_count >= minFleetSize);

    // 5. Sort
    const mult = sort_dir === "asc" ? 1 : -1;
    results.sort((a, b) => {
      if (sort_key === "merk") {
        return mult * a.merk.localeCompare(b.merk);
      }
      const val_a = a[sort_key] as number;
      const val_b = b[sort_key] as number;
      return mult * (val_a - val_b);
    });

    return results;

  }, [brand_stats, model_stats, viewMode, showConsumer, showCommercial, selectedFuels, minPrice, maxPrice, selectedBrands, searchQuery, minFleetSize, sort_key, sort_dir]);


  function column_click(key: SortKey) {
    if (sort_key === key) {
      setSortDir(sort_dir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sort_indicator(key: SortKey): string {
    if (sort_key !== key) return "";
    return sort_dir === "asc" ? " ▲" : " ▼";
  }

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
          maxFleetSizeAvailable={maxFleetSizeAvailable}
          defectFilterComponent={<DefectFilterPanel />}
          showStdDev={showStdDev}
          setShowStdDev={setShowStdDev}
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
          {/* Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <th
                      onClick={() => column_click("merk")}
                      className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {viewMode === "models" ? "Model" : "Brand"}{sort_indicator("merk")}
                    </th>
                    <th
                      onClick={() => column_click("vehicle_count")}
                      className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Vehicles{sort_indicator("vehicle_count")}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 w-1/3 min-w-[300px]">
                      Fuel Distribution
                    </th>
                    <th
                      onClick={() => column_click("petrol_pct")}
                      className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Petrol{sort_indicator("petrol_pct")}
                    </th>
                    <th
                      onClick={() => column_click("diesel_pct")}
                      className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Diesel{sort_indicator("diesel_pct")}
                    </th>
                    <th
                      onClick={() => column_click("electric_pct")}
                      className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Electric{sort_indicator("electric_pct")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {processed_data.map((item) => (
                    <tr
                      key={viewMode === "brands" ? item.merk : `${item.merk}-${item.handelsbenaming}`}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {pascal_case_format(item.merk)} {item.handelsbenaming ? pascal_case_format(item.handelsbenaming) : ""}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400 text-right tabular-nums">
                        {item.vehicle_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <FuelBreakdownBar fuel_breakdown={item.fuel_breakdown} compact />
                      </td>
                      <td className="px-6 py-4 text-sm text-right tabular-nums">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {item.petrol_pct}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right tabular-nums">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                          {item.diesel_pct}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {item.electric_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-4 flex flex-wrap gap-6 text-sm justify-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-zinc-600 dark:text-zinc-400">Petrol</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-600" />
              <span className="text-zinc-600 dark:text-zinc-400">Diesel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-zinc-600 dark:text-zinc-400">Electric</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-zinc-600 dark:text-zinc-400">LPG</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-zinc-600 dark:text-zinc-400">Other</span>
            </div>
          </div>
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
