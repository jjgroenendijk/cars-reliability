"use client";

import { useState, useEffect, useMemo } from "react";
import type { ModelStats, Rankings, PerYearStats } from "@/app/lib/types";
import { ReliabilityTable, type Column } from "@/app/components/reliability_table";
import { DefectFilterPanel } from "@/app/components/defect_filter_panel";
import { AgeRangeSlider } from "@/app/components/age_range_slider";
import { FleetSizeSlider } from "@/app/components/fleet_size_slider";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import { timestamp_format, pascal_case_format } from "@/app/lib/data_load";
import { Search, Settings2 } from "lucide-react";

interface Metadata {
  age_range?: { min: number; max: number };
}

interface ModelStatsFiltered {
  merk: string;
  handelsbenaming: string;
  vehicle_count: number;
  total_inspections: number;
  total_defects: number;
  avg_defects_per_inspection: number | null;
}

interface ModelStatsWithFilteredMetrics extends ModelStats {
  filtered_defects: number;
  filtered_defects_per_vehicle_year: number | null;
}

const MODEL_COLUMNS_FULL: Column<ModelStatsWithFilteredMetrics>[] = [
  { key: "merk", label: "Brand", format: (v) => pascal_case_format(String(v)) },
  { key: "handelsbenaming", label: "Model", format: (v) => pascal_case_format(String(v)) },
  { key: "vehicle_count", label: "Vehicles" },
  { key: "total_inspections", label: "Inspections" },
  { key: "avg_defects_per_inspection", label: "Defects/Inspection" },
  { key: "avg_age_years", label: "Avg. Age" },
  { key: "filtered_defects_per_vehicle_year", label: "Defects/Year" },
];

const MODEL_COLUMNS_FILTERED: Column<ModelStatsFiltered>[] = [
  { key: "merk", label: "Brand", format: (v) => pascal_case_format(String(v)) },
  { key: "handelsbenaming", label: "Model", format: (v) => pascal_case_format(String(v)) },
  { key: "vehicle_count", label: "Vehicles" },
  { key: "total_inspections", label: "Inspections" },
  { key: "avg_defects_per_inspection", label: "Defects/Inspection" },
];

/** Aggregate per-year stats for a given age range */
function aggregateAgeRange(
  per_year_stats: Record<string, PerYearStats> | undefined,
  minAge: number,
  maxAge: number
): PerYearStats | null {
  if (!per_year_stats) return null;

  let total_vehicles = 0;
  let total_inspections = 0;
  let total_defects = 0;

  for (let age = minAge; age <= maxAge; age++) {
    const yearStats = per_year_stats[String(age)];
    if (yearStats) {
      total_vehicles += yearStats.vehicle_count;
      total_inspections += yearStats.total_inspections;
      total_defects += yearStats.total_defects;
    }
  }

  if (total_inspections === 0) return null;

  return {
    vehicle_count: total_vehicles,
    total_inspections,
    total_defects,
    avg_defects_per_inspection: Math.round((total_defects / total_inspections) * 10000) / 10000,
  };
}

export default function ModelsPage() {
  const [model_stats, setModelStats] = useState<ModelStats[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({});
  const [generated_at, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected_brand, setSelectedBrand] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Slider state: [minAge, maxAge]
  const defaultMin = 4;
  const defaultMax = 20;
  const [ageRange, setAgeRange] = useState<[number, number]>([defaultMin, defaultMax]);
  const [minFleetSize, setMinFleetSize] = useState(0);

  const { model_breakdowns, calculate_filtered_defects, mode } = useDefectFilter();

  // Derive age bounds from metadata
  const minAge = metadata.age_range?.min ?? 0;
  const maxAge = metadata.age_range?.max ?? 30;

  useEffect(() => {
    async function data_fetch() {
      try {
        const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const [stats_response, rankings_response, metadata_response] = await Promise.all([
          fetch(`${base_path}/data/model_stats.json`),
          fetch(`${base_path}/data/rankings.json`),
          fetch(`${base_path}/data/metadata.json`),
        ]);

        if (!stats_response.ok) {
          throw new Error("Could not load model data");
        }

        const stats: ModelStats[] = await stats_response.json();
        setModelStats(stats);

        if (rankings_response.ok) {
          const rankings: Rankings = await rankings_response.json();
          setGeneratedAt(rankings.generated_at);
        }

        if (metadata_response.ok) {
          const meta: Metadata = await metadata_response.json();
          setMetadata(meta);
          // Initialize age range from metadata
          if (meta.age_range) {
            setAgeRange([
              Math.max(meta.age_range.min, defaultMin),
              Math.min(meta.age_range.max, defaultMax),
            ]);
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

  // Extract unique brands for filter dropdown
  const brands = useMemo(() => {
    const unique_brands = [...new Set(model_stats.map((m) => m.merk))];
    return unique_brands.sort((a, b) => a.localeCompare(b, "nl-NL"));
  }, [model_stats]);

  // Calculate max fleet size for slider
  const maxFleetSize = useMemo(() => {
    if (model_stats.length === 0) return 10000;
    return Math.max(...model_stats.map((m) => m.vehicle_count));
  }, [model_stats]);

  // Check if age range filter is active
  const isAgeFilterActive = ageRange[0] > minAge || ageRange[1] < maxAge;

  // Calculate filtered metrics based on defect filter
  const stats_with_filtered_metrics = useMemo((): ModelStatsWithFilteredMetrics[] => {
    return model_stats.map((m) => {
      const model_key = `${m.merk}|${m.handelsbenaming}`;
      const breakdown = model_breakdowns[model_key];
      const filtered_defects = calculate_filtered_defects(breakdown);
      const filtered_defects_per_vehicle_year =
        m.total_vehicle_years > 0
          ? Math.round((filtered_defects / m.total_vehicle_years) * 1000000) / 1000000
          : null;

      return {
        ...m,
        filtered_defects,
        filtered_defects_per_vehicle_year,
      };
    });
  }, [model_stats, model_breakdowns, calculate_filtered_defects]);

  // Filter and transform data based on brand, fleet size, and age slider
  const filtered_data = useMemo((): ModelStatsFiltered[] | ModelStatsWithFilteredMetrics[] => {
    // Apply brand filter
    let result = stats_with_filtered_metrics;
    if (selected_brand) {
      result = result.filter((m) => m.merk === selected_brand);
    }

    // Apply fleet size filter
    result = result.filter((m) => m.vehicle_count >= minFleetSize);

    if (!isAgeFilterActive) {
      return result;
    }

    // Age filter active - aggregate per_year_stats for selected range
    const filtered: ModelStatsFiltered[] = [];
    for (const m of result) {
      const aggregated = aggregateAgeRange(m.per_year_stats, ageRange[0], ageRange[1]);
      if (aggregated && aggregated.total_inspections >= 100) {
        filtered.push({
          merk: m.merk,
          handelsbenaming: m.handelsbenaming,
          vehicle_count: aggregated.vehicle_count,
          total_inspections: aggregated.total_inspections,
          total_defects: aggregated.total_defects,
          avg_defects_per_inspection: aggregated.avg_defects_per_inspection,
        });
      }
    }
    return filtered;
  }, [stats_with_filtered_metrics, selected_brand, minFleetSize, ageRange, isAgeFilterActive]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Loading data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Reliability by Model
        </h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Reliability by Model
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Overview of all car models sorted by reliability based on APK inspection data.
          Filter by brand, age, or defect types, or click a column header to sort.
        </p>
      </div>

      {/* Configuration Section */}
      <div className="mb-8 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-gray-500" />
            Configuration
          </h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {/* Search Model - Now integrated in grid */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search model..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                           bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            {/* Brand Filter - Re-integrated */}
            <div>
              <label
                htmlFor="brand-filter"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Brand Filter
              </label>
              <select
                id="brand-filter"
                value={selected_brand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              >
                <option value="">All brands</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {pascal_case_format(brand)}
                  </option>
                ))}
              </select>
            </div>

            {/* Defect Filter */}
            <div>
              <DefectFilterPanel />
            </div>

            {/* Age Range Slider */}
            <div>
              <AgeRangeSlider
                minAge={minAge}
                maxAge={maxAge}
                value={ageRange}
                onChange={setAgeRange}
              />
            </div>

            {/* Fleet Size Slider */}
            <div>
              <FleetSizeSlider max={maxFleetSize} value={minFleetSize} onChange={setMinFleetSize} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {!isAgeFilterActive ? (
          <ReliabilityTable
            data={filtered_data as ModelStatsWithFilteredMetrics[]}
            columns={MODEL_COLUMNS_FULL}
            defaultSortKey="filtered_defects_per_vehicle_year"
            defaultSortDirection="asc"
            filterKey="handelsbenaming"
            externalSearchValue={searchTerm}
            hideSearchInput={true}
            emptyMessage="No model data available"
          />
        ) : (
          <ReliabilityTable
            data={filtered_data as ModelStatsFiltered[]}
            columns={MODEL_COLUMNS_FILTERED}
            defaultSortKey="avg_defects_per_inspection"
            defaultSortDirection="asc"
            filterKey="handelsbenaming"
            externalSearchValue={searchTerm}
            hideSearchInput={true}
            emptyMessage={`No models with 100+ inspections in ${ageRange[0]}-${ageRange[1]} year range`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Legend</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <dt className="inline font-medium">Inspections:</dt>
            <dd className="inline ml-1">Total number of APK inspections</dd>
          </div>
          <div>
            <dt className="inline font-medium">Defects/Year:</dt>
            <dd className="inline ml-1">Defects per vehicle-year{mode !== "all" && " (filtered)"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Defects/Inspection:</dt>
            <dd className="inline ml-1">Average defects found per APK inspection</dd>
          </div>
          <div>
            <dt className="inline font-medium">Filter:</dt>
            <dd className="inline ml-1">
              {mode === "all" && "All defects included"}
              {mode === "reliability" && "Wear-and-tear excluded"}
              {mode === "custom" && "Custom defect selection"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Data attribution */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p>
          Data: RDW Open Data
          {generated_at && <span className="ml-2">| Updated: {timestamp_format(generated_at)}</span>}
        </p>
      </div>
    </div>
  );
}
