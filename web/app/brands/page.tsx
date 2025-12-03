"use client";

import { useState, useEffect, useMemo } from "react";
import type { BrandStats, Rankings, AgeBracketStats } from "@/app/lib/types";
import { ReliabilityTable, type Column } from "@/app/components/reliability_table";
import { timestamp_format } from "@/app/lib/data_load";

type AgeBracketKey = "all" | "4_7" | "8_12" | "13_20" | "5_15";

interface AgeBracketOption {
  key: AgeBracketKey;
  label: string;
  description: string;
}

const AGE_BRACKET_OPTIONS: AgeBracketOption[] = [
  { key: "all", label: "All Ages", description: "All vehicle ages" },
  { key: "4_7", label: "4-7 years", description: "Young vehicles" },
  { key: "8_12", label: "8-12 years", description: "Mid-age vehicles" },
  { key: "13_20", label: "13-20 years", description: "Older vehicles" },
  { key: "5_15", label: "5-15 years", description: "Core range" },
];

interface BrandStatsFiltered {
  merk: string;
  vehicle_count: number;
  total_inspections: number;
  total_defects: number;
  avg_defects_per_inspection: number | null;
}

const BRAND_COLUMNS_FULL: Column<BrandStats>[] = [
  { key: "merk", label: "Brand" },
  { key: "vehicle_count", label: "Vehicles" },
  { key: "total_inspections", label: "Inspections" },
  { key: "avg_defects_per_inspection", label: "Avg. Defects" },
  { key: "avg_age_years", label: "Avg. Age" },
  { key: "defects_per_year", label: "Defects/Year" },
];

const BRAND_COLUMNS_FILTERED: Column<BrandStatsFiltered>[] = [
  { key: "merk", label: "Brand" },
  { key: "vehicle_count", label: "Vehicles" },
  { key: "total_inspections", label: "Inspections" },
  { key: "avg_defects_per_inspection", label: "Avg. Defects" },
];

export default function BrandsPage() {
  const [brand_stats, setBrandStats] = useState<BrandStats[]>([]);
  const [generated_at, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected_age_bracket, setSelectedAgeBracket] = useState<AgeBracketKey>("all");

  useEffect(() => {
    async function data_fetch() {
      try {
        const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const [stats_response, rankings_response] = await Promise.all([
          fetch(`${base_path}/data/brand_stats.json`),
          fetch(`${base_path}/data/rankings.json`),
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

  // Transform data based on selected age bracket
  const filtered_data = useMemo((): BrandStatsFiltered[] => {
    if (selected_age_bracket === "all") {
      return brand_stats.map((b) => ({
        merk: b.merk,
        vehicle_count: b.vehicle_count,
        total_inspections: b.total_inspections,
        total_defects: b.total_defects,
        avg_defects_per_inspection: b.avg_defects_per_inspection,
      }));
    }

    // Filter to only brands that have data for this age bracket
    return brand_stats
      .filter((b) => {
        const bracket = b.age_brackets[selected_age_bracket];
        return bracket !== null && bracket.total_inspections >= 100;
      })
      .map((b) => {
        const bracket = b.age_brackets[selected_age_bracket] as AgeBracketStats;
        return {
          merk: b.merk,
          vehicle_count: bracket.vehicle_count,
          total_inspections: bracket.total_inspections,
          total_defects: bracket.total_defects,
          avg_defects_per_inspection: bracket.avg_defects_per_inspection,
        };
      });
  }, [brand_stats, selected_age_bracket]);

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
          Overview of all car brands sorted by reliability based on APK inspection data.
          Click a column header to sort. Filter by vehicle age bracket.
        </p>
      </div>

      {/* Age Bracket Selector */}
      <div className="mb-6">
        <label
          htmlFor="age-bracket"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Vehicle Age
        </label>
        <div className="flex flex-wrap gap-2">
          {AGE_BRACKET_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setSelectedAgeBracket(option.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selected_age_bracket === option.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {selected_age_bracket === "all" ? (
          <ReliabilityTable
            data={brand_stats}
            columns={BRAND_COLUMNS_FULL}
            defaultSortKey="avg_defects_per_inspection"
            defaultSortDirection="asc"
            filterKey="merk"
            filterPlaceholder="Search brand..."
            emptyMessage="No brand data available"
          />
        ) : (
          <ReliabilityTable
            data={filtered_data}
            columns={BRAND_COLUMNS_FILTERED}
            defaultSortKey="avg_defects_per_inspection"
            defaultSortDirection="asc"
            filterKey="merk"
            filterPlaceholder="Search brand..."
            emptyMessage={`No brands with 100+ inspections in ${
              AGE_BRACKET_OPTIONS.find((o) => o.key === selected_age_bracket)?.label ?? ""
            } range`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Legend
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <dt className="inline font-medium">Inspections:</dt>
            <dd className="inline ml-1">Total number of APK inspections</dd>
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
