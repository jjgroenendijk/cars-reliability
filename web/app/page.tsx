"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Rankings, RankingEntry } from "@/app/lib/types";
import { timestamp_format, percentage_format, number_format } from "@/app/lib/data_load";

export default function HomePage() {
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function data_fetch() {
      try {
        const response = await fetch("/data/rankings.json");
        if (!response.ok) {
          throw new Error("Kon gegevens niet laden");
        }
        const data: Rankings = await response.json();
        setRankings(data);
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

  if (error || !rankings) {
    return (
      <div className="max-w-4xl mx-auto">
        <section className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Auto Betrouwbaarheid Nederland
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
            Ontdek de meest en minst betrouwbare auto merken en modellen in Nederland,
            gebaseerd op APK-keuringsgegevens van de RDW.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              {error ?? "Gegevens worden momenteel verwerkt. Kom later terug."}
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
          Auto Betrouwbaarheid Nederland
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
          Ontdek de meest en minst betrouwbare auto merken en modellen in Nederland,
          gebaseerd op APK-keuringsgegevens van de RDW.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/lookup"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kenteken opzoeken
          </Link>
          <Link
            href="/brands"
            className="inline-flex items-center px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Alle merken bekijken
          </Link>
        </div>
      </section>

      {/* Top 5 Rankings Grid */}
      <div className="grid gap-8 md:grid-cols-2 mb-12">
        {/* Most Reliable Brands */}
        <RankingCard
          title="Meest betrouwbare merken"
          subtitle="Top 5"
          entries={rankings.most_reliable_brands.slice(0, 5)}
          linkHref="/brands"
          linkText="Alle merken bekijken"
          highlightColor="green"
        />

        {/* Least Reliable Brands */}
        <RankingCard
          title="Minst betrouwbare merken"
          subtitle="Top 5"
          entries={rankings.least_reliable_brands.slice(0, 5)}
          linkHref="/brands"
          linkText="Alle merken bekijken"
          highlightColor="red"
        />

        {/* Most Reliable Models */}
        <RankingCard
          title="Meest betrouwbare modellen"
          subtitle="Top 5"
          entries={rankings.most_reliable_models.slice(0, 5)}
          linkHref="/models"
          linkText="Alle modellen bekijken"
          highlightColor="green"
          showModel
        />

        {/* Least Reliable Models */}
        <RankingCard
          title="Minst betrouwbare modellen"
          subtitle="Top 5"
          entries={rankings.least_reliable_models.slice(0, 5)}
          linkHref="/models"
          linkText="Alle modellen bekijken"
          highlightColor="red"
          showModel
        />
      </div>

      {/* Data Info */}
      <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Over deze gegevens
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Deze statistieken zijn berekend op basis van APK-keuringsgegevens van de RDW.
          De betrouwbaarheidsscore is gebaseerd op het percentage keuringen met gebreken.
        </p>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>
            Laatst bijgewerkt: {timestamp_format(rankings.generated_at)}
          </span>
          <Link
            href="/about"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Meer over de methodologie
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
  linkHref: string;
  linkText: string;
  highlightColor: "green" | "red";
  showModel?: boolean;
}

function RankingCard({
  title,
  subtitle,
  entries,
  linkHref,
  linkText,
  highlightColor,
  showModel = false,
}: RankingCardProps) {
  const borderColor =
    highlightColor === "green"
      ? "border-l-green-500"
      : "border-l-red-500";

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 ${borderColor} overflow-hidden`}
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
            Geen gegevens beschikbaar
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
                    {entry.brand}
                  </span>
                  {showModel && entry.model && (
                    <span className="text-gray-600 dark:text-gray-400">
                      {" "}
                      {entry.model}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`font-medium ${
                    highlightColor === "green"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {percentage_format(entry.defect_rate)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({number_format(entry.total_inspections)} keuringen)
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800">
        <Link
          href={linkHref}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {linkText}
        </Link>
      </div>
    </div>
  );
}
