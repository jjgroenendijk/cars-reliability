"use client";

import { useState, useEffect, useMemo } from "react";
import type { ModelStats, Rankings } from "@/app/lib/types";
import { ReliabilityTable, type Column } from "@/app/components/reliability_table";
import { timestamp_format } from "@/app/lib/data_load";

const MODEL_COLUMNS: Column<ModelStats>[] = [
  { key: "merk", label: "Merk" },
  { key: "handelsbenaming", label: "Model" },
  { key: "vehicle_count", label: "Voertuigen" },
  { key: "total_inspections", label: "Keuringen" },
  { key: "avg_defects_per_inspection", label: "Gem. gebreken" },
  { key: "avg_age_years", label: "Gem. leeftijd" },
  { key: "defects_per_year", label: "Gebreken/jaar" },
];

export default function ModelsPage() {
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  useEffect(() => {
    async function data_fetch() {
      try {
        const [statsResponse, rankingsResponse] = await Promise.all([
          fetch("/data/model_stats.json"),
          fetch("/data/rankings.json"),
        ]);

        if (!statsResponse.ok) {
          throw new Error("Kon modelgegevens niet laden");
        }

        const stats: ModelStats[] = await statsResponse.json();
        setModelStats(stats);

        if (rankingsResponse.ok) {
          const rankings: Rankings = await rankingsResponse.json();
          setGeneratedAt(rankings.generated_at);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Onbekende fout");
      } finally {
        setLoading(false);
      }
    }
    data_fetch();
  }, []);

  // Extract unique brands for filter dropdown
  const brands = useMemo(() => {
    const uniqueBrands = [...new Set(modelStats.map((m) => m.merk))];
    return uniqueBrands.sort((a, b) => a.localeCompare(b, "nl-NL"));
  }, [modelStats]);

  // Filter data by selected brand
  const filteredData = useMemo(() => {
    if (!selectedBrand) {
      return modelStats;
    }
    return modelStats.filter((m) => m.merk === selectedBrand);
  }, [modelStats, selectedBrand]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-600 dark:text-gray-400">Gegevens laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Betrouwbaarheid per model
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
          Betrouwbaarheid per model
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Overzicht van alle automodellen gesorteerd op betrouwbaarheid op basis van APK-keuringsgegevens.
          Filter op merk of klik op een kolomkop om te sorteren.
        </p>
      </div>

      {/* Brand Filter */}
      <div className="mb-6">
        <label
          htmlFor="brand-filter"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Filter op merk
        </label>
        <select
          id="brand-filter"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="w-full sm:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Alle merken</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <ReliabilityTable
          data={filteredData}
          columns={MODEL_COLUMNS}
          defaultSortKey="avg_defects_per_inspection"
          defaultSortDirection="asc"
          filterKey="handelsbenaming"
          filterPlaceholder="Zoek model..."
          emptyMessage="Geen modelgegevens beschikbaar"
        />
      </div>

      {/* Legend */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Legenda
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <dt className="inline font-medium">Keuringen:</dt>
            <dd className="inline ml-1">Totaal aantal APK-keuringen</dd>
          </div>
          <div>
            <dt className="inline font-medium">Gebrekenpercentage:</dt>
            <dd className="inline ml-1">Percentage keuringen met gebreken</dd>
          </div>
          <div>
            <dt className="inline font-medium">Gem. gebreken:</dt>
            <dd className="inline ml-1">Gemiddeld aantal gebreken per keuring</dd>
          </div>
          <div>
            <dt className="inline font-medium">Steekproef:</dt>
            <dd className="inline ml-1">Klein (&lt;100), Middel (100-1000), Groot (&gt;1000)</dd>
          </div>
        </dl>
      </div>

      {/* Data attribution */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p>
          Data: RDW Open Data
          {generatedAt && (
            <span className="ml-2">
              | Bijgewerkt: {timestamp_format(generatedAt)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
