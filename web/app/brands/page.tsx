"use client";

import { useState, useEffect } from "react";
import type { BrandStats, Rankings } from "@/app/lib/types";
import { ReliabilityTable, type Column } from "@/app/components/reliability_table";
import { timestamp_format } from "@/app/lib/data_load";

const BRAND_COLUMNS: Column<BrandStats>[] = [
  { key: "merk", label: "Brand" },
  { key: "vehicle_count", label: "Vehicles" },
  { key: "total_inspections", label: "Inspections" },
  { key: "avg_defects_per_inspection", label: "Avg. Defects" },
  { key: "avg_age_years", label: "Avg. Age" },
  { key: "defects_per_year", label: "Defects/Year" },
];

export default function BrandsPage() {
  const [brand_stats, setBrandStats] = useState<BrandStats[]>([]);
  const [generated_at, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function data_fetch() {
      try {
        const [stats_response, rankings_response] = await Promise.all([
          fetch("/data/brand_stats.json"),
          fetch("/data/rankings.json"),
        ]);

        if (!stats_response.ok) {
          throw new Error("Could not load brand data");
        }

        const stats: BrandStats[] = await stats_response.json();
        setBrandStats(stats);

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
          Reliability by Brand
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
          Reliability by Brand
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Overview of all car brands sorted by reliability based on MOT inspection data.
          Click a column header to sort.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <ReliabilityTable
          data={brand_stats}
          columns={BRAND_COLUMNS}
          defaultSortKey="avg_defects_per_inspection"
          defaultSortDirection="asc"
          filterKey="merk"
          filterPlaceholder="Search brand..."
          emptyMessage="No brand data available"
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
            <dt className="inline font-medium">Models:</dt>
            <dd className="inline ml-1">Number of different models</dd>
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
