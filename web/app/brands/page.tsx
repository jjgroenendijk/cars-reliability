"use client";

import { useState, useEffect } from "react";
import type { BrandStats, Rankings } from "@/app/lib/types";
import { ReliabilityTable, type Column } from "@/app/components/reliability_table";
import { timestamp_format } from "@/app/lib/data_load";

const BRAND_COLUMNS: Column<BrandStats>[] = [
  { key: "brand", label: "Merk" },
  { key: "total_inspections", label: "Keuringen" },
  { key: "defect_rate", label: "Gebrekenpercentage" },
  { key: "avg_defects_per_inspection", label: "Gem. gebreken" },
  { key: "model_count", label: "Modellen" },
  { key: "oldest_year", label: "Vanaf" },
  { key: "newest_year", label: "Tot" },
];

export default function BrandsPage() {
  const [brandStats, setBrandStats] = useState<BrandStats[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function data_fetch() {
      try {
        const [statsResponse, rankingsResponse] = await Promise.all([
          fetch("/data/brand_stats.json"),
          fetch("/data/rankings.json"),
        ]);

        if (!statsResponse.ok) {
          throw new Error("Kon merkgegevens niet laden");
        }

        const stats: BrandStats[] = await statsResponse.json();
        setBrandStats(stats);

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
          Betrouwbaarheid per merk
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
          Betrouwbaarheid per merk
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Overzicht van alle automerken gesorteerd op betrouwbaarheid op basis van APK-keuringsgegevens.
          Klik op een kolomkop om te sorteren.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <ReliabilityTable
          data={brandStats}
          columns={BRAND_COLUMNS}
          defaultSortKey="defect_rate"
          defaultSortDirection="asc"
          filterKey="brand"
          filterPlaceholder="Zoek merk..."
          emptyMessage="Geen merkgegevens beschikbaar"
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
            <dt className="inline font-medium">Modellen:</dt>
            <dd className="inline ml-1">Aantal verschillende modellen</dd>
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
