"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Rankings, RankingEntry, BrandStats, ModelStats } from "@/app/lib/types";
import { DefectFilterPanel } from "@/app/components/defect_filter_panel";
import { useDefectFilter } from "@/app/lib/defect_filter_context";
import { timestamp_format, pascal_case_format } from "@/app/lib/data_load";
import { Search, Car, AlertCircle, Calendar, ArrowRight } from "lucide-react";

interface RankingEntryWithFiltered extends RankingEntry {
  filtered_defects_per_vehicle_year: number;
}

export default function HomePage() {
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [brand_stats, setBrandStats] = useState<BrandStats[]>([]);
  const [model_stats, setModelStats] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    brand_breakdowns,
    model_breakdowns,
    calculate_filtered_defects,
    mode,
    loading: filter_loading
  } = useDefectFilter();

  useEffect(() => {
    async function data_fetch() {
      try {
        const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const [rankings_res, brands_res, models_res] = await Promise.all([
          fetch(`${base_path}/data/rankings.json`),
          fetch(`${base_path}/data/brand_stats.json`),
          fetch(`${base_path}/data/model_stats.json`),
        ]);

        if (!rankings_res.ok) {
          throw new Error("Could not load data");
        }

        const rankings_data: Rankings = await rankings_res.json();
        setRankings(rankings_data);

        if (brands_res.ok) {
          const brands: BrandStats[] = await brands_res.json();
          setBrandStats(brands);
        }

        if (models_res.ok) {
          const models: ModelStats[] = await models_res.json();
          setModelStats(models);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    data_fetch();
  }, []);

  // Calculate filtered rankings based on defect filter
  const filtered_rankings = useMemo(() => {
    if (!rankings || filter_loading) return null;

    // Calculate filtered brand rankings
    const brand_entries: RankingEntryWithFiltered[] = brand_stats
      .map((b) => {
        const breakdown = brand_breakdowns[b.merk];
        const filtered_defects = calculate_filtered_defects(breakdown);
        const filtered_rate = b.total_vehicle_years > 0
          ? filtered_defects / b.total_vehicle_years
          : 0;
        return {
          rank: 0,
          merk: b.merk,
          total_inspections: b.total_inspections,
          defects_per_vehicle_year: filtered_rate,
          filtered_defects_per_vehicle_year: filtered_rate,
        };
      })
      .filter((e) => e.total_inspections >= 100);

    // Sort and assign ranks (create new objects to avoid rank overwriting)
    const sorted_brands_asc = [...brand_entries]
      .sort((a, b) => a.filtered_defects_per_vehicle_year - b.filtered_defects_per_vehicle_year)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    const sorted_brands_desc = [...brand_entries]
      .sort((a, b) => b.filtered_defects_per_vehicle_year - a.filtered_defects_per_vehicle_year)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // Calculate filtered model rankings
    const model_entries: RankingEntryWithFiltered[] = model_stats
      .map((m) => {
        const model_key = `${m.merk}|${m.handelsbenaming}`;
        const breakdown = model_breakdowns[model_key];
        const filtered_defects = calculate_filtered_defects(breakdown);
        const filtered_rate = m.total_vehicle_years > 0
          ? filtered_defects / m.total_vehicle_years
          : 0;
        return {
          rank: 0,
          merk: m.merk,
          handelsbenaming: m.handelsbenaming,
          total_inspections: m.total_inspections,
          defects_per_vehicle_year: filtered_rate,
          filtered_defects_per_vehicle_year: filtered_rate,
        };
      })
      .filter((e) => e.total_inspections >= 50);

    const sorted_models_asc = [...model_entries]
      .sort((a, b) => a.filtered_defects_per_vehicle_year - b.filtered_defects_per_vehicle_year)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    const sorted_models_desc = [...model_entries]
      .sort((a, b) => b.filtered_defects_per_vehicle_year - a.filtered_defects_per_vehicle_year)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    return {
      most_reliable_brands: sorted_brands_asc.slice(0, 10),
      least_reliable_brands: sorted_brands_desc.slice(0, 10),
      most_reliable_models: sorted_models_asc.slice(0, 10),
      least_reliable_models: sorted_models_desc.slice(0, 10),
      generated_at: rankings.generated_at,
    };
  }, [rankings, brand_stats, model_stats, brand_breakdowns, model_breakdowns, calculate_filtered_defects, filter_loading]);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div className="text-gray-600 dark:text-gray-400 font-medium">Loading reliability data...</div>
      </div>
    );
  }

  if (error || !rankings) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <section className="mb-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
            Dutch Car Reliability
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Discover the most and least reliable car brands and models in the Netherlands,
            based on APK inspection data from the RDW.
          </p>
          <div className="inline-flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6 max-w-lg mx-auto">
            <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
            <p className="text-yellow-800 dark:text-yellow-200 font-medium">
              {error ?? "Data is currently being processed. Please check back later."}
            </p>
          </div>
        </section>
      </div>
    );
  }

  // Use filtered rankings if available, otherwise fall back to original
  const display_rankings = filtered_rankings ?? rankings;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <section className="mb-12 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
            Dutch Car <span className="text-blue-600 dark:text-blue-400">Reliability</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
            Data-driven insights into vehicle reliability based on millions of official RDW APK inspections.
            Find out which cars pass with flying colors and which ones struggle.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/lookup"
              className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 gap-2 group"
            >
              <Search className="h-5 w-5 group-hover:scale-110 transition-transform" />
              License Plate Lookup
            </Link>
            <Link
              href="/brands"
              className="inline-flex items-center justify-center px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-2"
            >
              <Car className="h-5 w-5" />
              View All Brands
            </Link>
          </div>
        </div>
      </section>

      {/* Defect Filter Panel */}
      <DefectFilterPanel />

      {/* Filter indicator */}
      {mode !== "all" && (
        <div className="mb-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          Rankings filtered by{" "}
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {mode === "reliability" ? "reliability defects only" : "custom defect selection"}
          </span>
        </div>
      )}

      {/* Top 10 Rankings Grid */}
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12 mb-16">
        {/* Most Reliable Brands */}
        <RankingCard
          title="Most Reliable Brands"
          subtitle="Lowest defects per year"
          entries={display_rankings.most_reliable_brands.slice(0, 10)}
          link_href="/brands"
          link_text="View all brands"
          highlight_color="green"
        />

        {/* Least Reliable Brands */}
        <RankingCard
          title="Least Reliable Brands"
          subtitle="Highest defects per year"
          entries={display_rankings.least_reliable_brands.slice(0, 10)}
          link_href="/brands"
          link_text="View all brands"
          highlight_color="red"
        />

        {/* Most Reliable Models */}
        <RankingCard
          title="Most Reliable Models"
          subtitle="Lowest defects per year"
          entries={display_rankings.most_reliable_models.slice(0, 10)}
          link_href="/models"
          link_text="View all models"
          highlight_color="green"
          show_model
        />

        {/* Least Reliable Models */}
        <RankingCard
          title="Least Reliable Models"
          subtitle="Highest defects per year"
          entries={display_rankings.least_reliable_models.slice(0, 10)}
          link_href="/models"
          link_text="View all models"
          highlight_color="red"
          show_model
        />
      </div>

      {/* Data Info */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
            <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              About this data
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              These statistics are calculated based on APK inspection data from the RDW (Netherlands Vehicle Authority).
              The reliability score is calculated by analyzing the number of defects found relative to the vehicle&apos;s age
              and the total number of inspections. Lower scores indicate better reliability.
              {mode !== "all" && (
                <span className="block mt-2 text-blue-600 dark:text-blue-400">
                  Currently showing filtered results - use the filter above to customize which defects are included.
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Last updated: {timestamp_format(display_rankings.generated_at)}</span>
              </div>
              <Link
                href="/about"
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Learn more about the methodology
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface RankingCardProps {
  title: string;
  subtitle: string;
  entries: RankingEntry[];
  link_href: string;
  link_text: string;
  highlight_color: "green" | "red";
  show_model?: boolean;
}

function RankingCard({
  title,
  subtitle,
  entries,
  link_href,
  link_text,
  highlight_color,
  show_model = false,
}: RankingCardProps) {
  const isGreen = highlight_color === "green";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
      <div className={`px-6 py-5 border-b border-gray-100 dark:border-gray-800 ${isGreen ? 'bg-green-50/50 dark:bg-green-900/10' : 'bg-red-50/50 dark:bg-red-900/10'}`}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      </div>

      <div className="flex-grow divide-y divide-gray-100 dark:divide-gray-800">
        {entries.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
            No data available
          </div>
        ) : (
          entries.map((entry, index) => (
            <div
              key={index}
              className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <span className={`
                  flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                  ${index < 3
                    ? (isGreen ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}
                `}>
                  {entry.rank}
                </span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {pascal_case_format(entry.merk)}
                  </div>
                  {show_model && entry.handelsbenaming && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {pascal_case_format(entry.handelsbenaming)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-mono font-medium ${isGreen ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {(entry.defects_per_vehicle_year ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 mt-auto">
        <Link
          href={link_href}
          className="flex items-center justify-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {link_text}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
