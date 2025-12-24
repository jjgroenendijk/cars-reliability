"use client";

import { useState, useEffect, useMemo } from "react";
import type { ModelStats, Rankings, AgeBracketStats } from "@/app/lib/types";
import { ReliabilityTable, type Column } from "@/app/components/reliability_table";
import { DefectFilterPanel } from "@/app/components/defect_filter_panel";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import { timestamp_format, pascal_case_format } from "@/app/lib/data_load";

type AgeBracketKey = "all" | "4_7" | "8_12" | "13_20" | "5_15";

interface AgeBracketOption {
  key: AgeBracketKey;
  label: string;
}

const AGE_BRACKET_OPTIONS: AgeBracketOption[] = [
  { key: "all", label: "All Ages" },
  { key: "4_7", label: "4-7 years" },
  { key: "8_12", label: "8-12 years" },
  { key: "13_20", label: "13-20 years" },
  { key: "5_15", label: "5-15 years" },
];

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

export default function ModelsPage() {
  const [model_stats, setModelStats] = useState<ModelStats[]>([]);
  const [generated_at, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected_brand, setSelectedBrand] = useState<string>("");
  const [selected_age_bracket, setSelectedAgeBracket] = useState<AgeBracketKey>("all");

  const { model_breakdowns, calculate_filtered_defects, mode } = useDefectFilter();

  useEffect(() => {
    async function data_fetch() {
      try {
        const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const [stats_response, rankings_response] = await Promise.all([
          fetch(`${base_path}/data/model_stats.json`),
          fetch(`${base_path}/data/rankings.json`),
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

  // Calculate filtered metrics based on defect filter
  const stats_with_filtered_metrics = useMemo((): ModelStatsWithFilteredMetrics[] => {
    return model_stats.map((m) => {
      // Model key format: "BRAND|MODEL"
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

  // Filter data by selected brand and transform by age bracket
  const filtered_data = useMemo((): ModelStatsFiltered[] | ModelStatsWithFilteredMetrics[] => {
    let result = stats_with_filtered_metrics;

    if (selected_brand) {
      result = result.filter((m) => m.merk === selected_brand);
    }

    if (selected_age_bracket === "all") {
      return result;
    }

    // Filter to models with data for this age bracket (100+ inspections)
    return model_stats
      .filter((m) => {
        if (selected_brand && m.merk !== selected_brand) return false;
        const bracket = m.age_brackets[selected_age_bracket];
        return bracket !== null && bracket.total_inspections >= 100;
      })
      .map((m) => {
        const bracket = m.age_brackets[selected_age_bracket] as AgeBracketStats;
        return {
          merk: m.merk,
          handelsbenaming: m.handelsbenaming,
          vehicle_count: bracket.vehicle_count,
          total_inspections: bracket.total_inspections,
          total_defects: bracket.total_defects,
          avg_defects_per_inspection: bracket.avg_defects_per_inspection,
        };
      });
  }, [model_stats, stats_with_filtered_metrics, selected_brand, selected_age_bracket]);

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
      <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Defect Filter */}
          <div>
            <DefectFilterPanel />
          </div>

          {/* Brand Filter */}
          <div>
            <label
              htmlFor="brand-filter"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Brand
            </label>
            <select
              id="brand-filter"
              value={selected_brand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All brands</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {pascal_case_format(brand)}
                </option>
              ))}
            </select>
          </div>

          {/* Age Bracket Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vehicle Age
            </label>
            <div className="flex flex-wrap gap-2">
              {AGE_BRACKET_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setSelectedAgeBracket(option.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selected_age_bracket === option.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {selected_age_bracket === "all" ? (
          <ReliabilityTable
            data={filtered_data as ModelStatsWithFilteredMetrics[]}
            columns={MODEL_COLUMNS_FULL}
            defaultSortKey="filtered_defects_per_vehicle_year"
            defaultSortDirection="asc"
            filterKey="handelsbenaming"
            filterPlaceholder="Search model..."
            emptyMessage="No model data available"
          />
        ) : (
          <ReliabilityTable
            data={filtered_data as ModelStatsFiltered[]}
            columns={MODEL_COLUMNS_FILTERED}
            defaultSortKey="avg_defects_per_inspection"
            defaultSortDirection="asc"
            filterKey="handelsbenaming"
            filterPlaceholder="Search model..."
            emptyMessage={`No models with 100+ inspections in ${AGE_BRACKET_OPTIONS.find((o) => o.key === selected_age_bracket)?.label ?? ""
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
            <dt className="inline font-medium">Defects/Year:</dt>
            <dd className="inline ml-1">
              Defects per vehicle-year{mode !== "all" && " (filtered)"}
            </dd>
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
