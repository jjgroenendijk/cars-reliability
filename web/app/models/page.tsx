"use client";

import { useState, useEffect, useMemo } from "react";
import type { ModelStats, Rankings } from "@/app/lib/types";
import { ReliabilityTable, type Column } from "@/app/components/reliability_table";
import { timestamp_format } from "@/app/lib/data_load";

const MODEL_COLUMNS: Column<ModelStats>[] = [
  { key: "merk", label: "Brand" },
  { key: "handelsbenaming", label: "Model" },
  { key: "vehicle_count", label: "Vehicles" },
  { key: "total_inspections", label: "Inspections" },
  { key: "avg_defects_per_inspection", label: "Avg. Defects" },
  { key: "avg_age_years", label: "Avg. Age" },
  { key: "defects_per_year", label: "Defects/Year" },
];

export default function ModelsPage() {
  const [model_stats, setModelStats] = useState<ModelStats[]>([]);
  const [generated_at, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected_brand, setSelectedBrand] = useState<string>("");

  useEffect(() => {
    async function data_fetch() {
      try {
        const [stats_response, rankings_response] = await Promise.all([
          fetch("/data/model_stats.json"),
          fetch("/data/rankings.json"),
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

  // Filter data by selected brand
  const filtered_data = useMemo(() => {
    if (!selected_brand) {
      return model_stats;
    }
    return model_stats.filter((m) => m.merk === selected_brand);
  }, [model_stats, selected_brand]);

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
          Overview of all car models sorted by reliability based on MOT inspection data.
          Filter by brand or click a column header to sort.
        </p>
      </div>

      {/* Brand Filter */}
      <div className="mb-6">
        <label
          htmlFor="brand-filter"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Filter by brand
        </label>
        <select
          id="brand-filter"
          value={selected_brand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="w-full sm:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <ReliabilityTable
          data={filtered_data}
          columns={MODEL_COLUMNS}
          defaultSortKey="avg_defects_per_inspection"
          defaultSortDirection="asc"
          filterKey="handelsbenaming"
          filterPlaceholder="Search model..."
          emptyMessage="No model data available"
        />
      </div>

      {/* Legend */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Legend
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <dt className="inline font-medium">Inspections:</dt>
            <dd className="inline ml-1">Total number of MOT inspections</dd>
          </div>
          <div>
            <dt className="inline font-medium">Defect Rate:</dt>
            <dd className="inline ml-1">Percentage of inspections with defects</dd>
          </div>
          <div>
            <dt className="inline font-medium">Avg. Defects:</dt>
            <dd className="inline ml-1">Average number of defects per inspection</dd>
          </div>
          <div>
            <dt className="inline font-medium">Sample Size:</dt>
            <dd className="inline ml-1">Small (&lt;100), Medium (100-1000), Large (&gt;1000)</dd>
          </div>
        </dl>
      </div>

      {/* Data attribution */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p>
          Data: RDW Open Data
          {generated_at && (
            <span className="ml-2">
              | Updated: {timestamp_format(generated_at)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
