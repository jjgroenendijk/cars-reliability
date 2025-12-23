"use client";

import { useState, useEffect, useMemo } from "react";
import type { BrandStats, Rankings, FuelBreakdown } from "@/app/lib/types";
import { FuelBreakdownBar } from "@/app/components/fuel_breakdown";
import { timestamp_format, pascal_case_format } from "@/app/lib/data_load";

type SortKey = "merk" | "vehicle_count" | "electric_pct" | "diesel_pct" | "petrol_pct";
type SortDir = "asc" | "desc";

interface BrandFuelData {
  merk: string;
  vehicle_count: number;
  fuel_breakdown: FuelBreakdown;
  petrol_pct: number;
  diesel_pct: number;
  electric_pct: number;
}

function fuel_total_calculate(fb: FuelBreakdown): number {
  return fb.Benzine + fb.Diesel + fb.Elektriciteit + fb.LPG + fb.other;
}

function pct_calculate(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export default function FuelsPage() {
  const [brand_stats, setBrandStats] = useState<BrandStats[]>([]);
  const [generated_at, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort_key, setSortKey] = useState<SortKey>("electric_pct");
  const [sort_dir, setSortDir] = useState<SortDir>("desc");
  const [filter_text, setFilterText] = useState("");

  useEffect(() => {
    async function data_fetch() {
      try {
        const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const [stats_res, rankings_res] = await Promise.all([
          fetch(`${base_path}/data/brand_stats.json`),
          fetch(`${base_path}/data/rankings.json`),
        ]);

        if (!stats_res.ok) throw new Error("Could not load brand data");

        const stats: BrandStats[] = await stats_res.json();
        setBrandStats(stats);

        if (rankings_res.ok) {
          const rankings: Rankings = await rankings_res.json();
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

  const fuel_data = useMemo((): BrandFuelData[] => {
    return brand_stats
      .filter((b) => b.fuel_breakdown)
      .map((b) => {
        const total = fuel_total_calculate(b.fuel_breakdown);
        return {
          merk: b.merk,
          vehicle_count: b.vehicle_count,
          fuel_breakdown: b.fuel_breakdown,
          petrol_pct: pct_calculate(b.fuel_breakdown.Benzine, total),
          diesel_pct: pct_calculate(b.fuel_breakdown.Diesel, total),
          electric_pct: pct_calculate(b.fuel_breakdown.Elektriciteit, total),
        };
      })
      .filter((b) => b.merk.toLowerCase().includes(filter_text.toLowerCase()));
  }, [brand_stats, filter_text]);

  const sorted_data = useMemo((): BrandFuelData[] => {
    const mult = sort_dir === "asc" ? 1 : -1;
    return [...fuel_data].sort((a, b) => {
      if (sort_key === "merk") {
        return mult * a.merk.localeCompare(b.merk);
      }
      const val_a = a[sort_key];
      const val_b = b[sort_key];
      return mult * (val_a - val_b);
    });
  }, [fuel_data, sort_key, sort_dir]);

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
          Fuel Type Breakdown
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
          Fuel Type Breakdown
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Overview of fuel type distribution by brand. Compare electric, diesel, and petrol
          percentages across manufacturers.
        </p>
      </div>

      {/* Search filter */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search brand..."
          value={filter_text}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  onClick={() => column_click("merk")}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Brand{sort_indicator("merk")}
                </th>
                <th
                  onClick={() => column_click("vehicle_count")}
                  className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Vehicles{sort_indicator("vehicle_count")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 w-64">
                  Fuel Distribution
                </th>
                <th
                  onClick={() => column_click("petrol_pct")}
                  className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Petrol{sort_indicator("petrol_pct")}
                </th>
                <th
                  onClick={() => column_click("diesel_pct")}
                  className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Diesel{sort_indicator("diesel_pct")}
                </th>
                <th
                  onClick={() => column_click("electric_pct")}
                  className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Electric{sort_indicator("electric_pct")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sorted_data.map((brand) => (
                <tr
                  key={brand.merk}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                    {pascal_case_format(brand.merk)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 text-right">
                    {brand.vehicle_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <FuelBreakdownBar fuel_breakdown={brand.fuel_breakdown} compact />
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="text-blue-600 dark:text-blue-400">
                      {brand.petrol_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="text-gray-600 dark:text-gray-400">
                      {brand.diesel_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="text-green-600 dark:text-green-400">
                      {brand.electric_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Legend
        </h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">Petrol (Benzine)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-600" />
            <span className="text-gray-600 dark:text-gray-400">Diesel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-gray-600 dark:text-gray-400">Electric</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-gray-600 dark:text-gray-400">LPG</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-purple-500" />
            <span className="text-gray-600 dark:text-gray-400">Other (CNG, Hydrogen, etc.)</span>
          </div>
        </div>
      </div>

      {/* Data attribution */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
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
