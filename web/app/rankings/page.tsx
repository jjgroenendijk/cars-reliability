"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Rankings, RankingEntry } from "@/app/lib/types";
import { timestamp_format, number_format } from "@/app/lib/data_load";

export default function RankingsPage() {
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function data_fetch() {
      try {
        const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const response = await fetch(`${base_path}/data/rankings.json`);
        if (!response.ok) {
          throw new Error("Could not load rankings data");
        }
        const data: Rankings = await response.json();
        setRankings(data);
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

  if (error || !rankings) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Top 10 Rankings
        </h1>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            {error ?? "Could not load rankings data."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Top 10 Rankings
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Complete top 10 and bottom 10 rankings for brands and models based on
          defects per year of vehicle age (age-normalized metric).
        </p>
      </div>

      {/* Brands Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Brands
        </h2>
        <div className="grid gap-8 lg:grid-cols-2">
          <RankingTable
            title="Most Reliable Brands"
            entries={rankings.most_reliable_brands}
            highlight_color="green"
          />
          <RankingTable
            title="Least Reliable Brands"
            entries={rankings.least_reliable_brands}
            highlight_color="red"
          />
        </div>
        <div className="mt-4">
          <Link
            href="/brands"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            View all brands with detailed statistics
          </Link>
        </div>
      </section>

      {/* Models Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Models
        </h2>
        <div className="grid gap-8 lg:grid-cols-2">
          <RankingTable
            title="Most Reliable Models"
            entries={rankings.most_reliable_models}
            highlight_color="green"
            show_model
          />
          <RankingTable
            title="Least Reliable Models"
            entries={rankings.least_reliable_models}
            highlight_color="red"
            show_model
          />
        </div>
        <div className="mt-4">
          <Link
            href="/models"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            View all models with detailed statistics
          </Link>
        </div>
      </section>

      {/* Data attribution */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400">
        <p>
          Data: RDW Open Data | Updated: {timestamp_format(rankings.generated_at)}
        </p>
        <p className="mt-2">
          Rankings are based on defects per year (age-normalized). Only brands/models
          with at least 100 inspections are included.
        </p>
      </div>
    </div>
  );
}

interface RankingTableProps {
  title: string;
  entries: RankingEntry[];
  highlight_color: "green" | "red";
  show_model?: boolean;
}

function RankingTable({
  title,
  entries,
  highlight_color,
  show_model = false,
}: RankingTableProps) {
  const border_color =
    highlight_color === "green"
      ? "border-l-green-500"
      : "border-l-red-500";

  const header_bg =
    highlight_color === "green"
      ? "bg-green-50 dark:bg-green-900/20"
      : "bg-red-50 dark:bg-red-900/20";

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${border_color} overflow-hidden`}
    >
      <div className={`px-6 py-4 ${header_bg}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-sm text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-medium w-12">#</th>
              <th className="px-4 py-3 font-medium">
                {show_model ? "Brand / Model" : "Brand"}
              </th>
              <th className="px-4 py-3 font-medium text-right">Defects/Year</th>
              <th className="px-4 py-3 font-medium text-right">Inspections</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-gray-500 dark:text-gray-400"
                >
                  No data available
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.rank}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-medium">
                    {entry.rank}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {entry.merk}
                    </span>
                    {show_model && entry.handelsbenaming && (
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        {entry.handelsbenaming}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        highlight_color === "green"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {entry.defects_per_year.toFixed(4)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {number_format(entry.total_inspections)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
