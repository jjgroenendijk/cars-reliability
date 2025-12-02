"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Rankings, RankingEntry } from "@/app/lib/types";
import { timestamp_format, number_format } from "@/app/lib/data_load";

export default function HomePage() {
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function data_fetch() {
      try {
        const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
        const response = await fetch(`${base_path}/data/rankings.json`);
        if (!response.ok) {
          throw new Error("Could not load data");
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
        <section className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Dutch Car Reliability
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            Discover the most and least reliable car brands and models in the Netherlands,
            based on MOT inspection data from the RDW.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              {error ?? "Data is currently being processed. Please check back later."}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <section className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Dutch Car Reliability
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
          Discover the most and least reliable car brands and models in the Netherlands,
          based on MOT inspection data from the RDW.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/lookup"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            License Plate Lookup
          </Link>
          <Link
            href="/brands"
            className="inline-flex items-center px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            View All Brands
          </Link>
        </div>
      </section>

      {/* Top 5 Rankings Grid */}
      <div className="grid gap-8 md:grid-cols-2 mb-12">
        {/* Most Reliable Brands */}
        <RankingCard
          title="Most Reliable Brands"
          subtitle="Top 5"
          entries={rankings.most_reliable_brands.slice(0, 5)}
          link_href="/rankings"
          link_text="View Full Top 10"
          highlight_color="green"
        />

        {/* Least Reliable Brands */}
        <RankingCard
          title="Least Reliable Brands"
          subtitle="Top 5"
          entries={rankings.least_reliable_brands.slice(0, 5)}
          link_href="/rankings"
          link_text="View Full Top 10"
          highlight_color="red"
        />

        {/* Most Reliable Models */}
        <RankingCard
          title="Most Reliable Models"
          subtitle="Top 5"
          entries={rankings.most_reliable_models.slice(0, 5)}
          link_href="/rankings"
          link_text="View Full Top 10"
          highlight_color="green"
          show_model
        />

        {/* Least Reliable Models */}
        <RankingCard
          title="Least Reliable Models"
          subtitle="Top 5"
          entries={rankings.least_reliable_models.slice(0, 5)}
          link_href="/rankings"
          link_text="View Full Top 10"
          highlight_color="red"
          show_model
        />
      </div>

      {/* Data Info */}
      <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          About this data
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          These statistics are calculated based on MOT inspection data from the RDW.
          The reliability score is based on the average number of defects per inspection.
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>
            Last updated: {timestamp_format(rankings.generated_at)}
          </span>
          <Link
            href="/about"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Learn more about the methodology
          </Link>
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
  const border_color =
    highlight_color === "green"
      ? "border-l-green-500"
      : "border-l-red-500";

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${border_color} overflow-hidden`}
    >
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {entries.length === 0 ? (
          <div className="px-6 py-4 text-gray-500 dark:text-gray-400">
            No data available
          </div>
        ) : (
          entries.map((entry, index) => (
            <div
              key={index}
              className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-400 dark:text-gray-500 w-6">
                  {entry.rank}
                </span>
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {entry.merk}
                  </span>
                  {show_model && entry.handelsbenaming && (
                    <span className="text-gray-600 dark:text-gray-400">
                      {" "}
                      {entry.handelsbenaming}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`font-medium ${
                    highlight_color === "green"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {entry.avg_defects_per_inspection.toFixed(2)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({number_format(entry.total_inspections)} inspections)
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800">
        <Link
          href={link_href}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {link_text}
        </Link>
      </div>
    </div>
  );
}
