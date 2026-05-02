"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, Car, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import type { BrandStats, Metadata, ModelStats, Rankings } from "@/app/lib/types";
import { pascal_case_format, timestamp_format } from "@/app/lib/data_load";

interface StatisticsData {
    brand_stats: BrandStats[];
    model_stats: ModelStats[];
    rankings: Rankings | null;
    metadata: Partial<Metadata>;
}

interface MetricCardProps {
    label: string;
    value: string;
    detail: string;
}

interface FuelShare {
    fuel: string;
    count: number;
    share: number;
}

function number_format(value: number): string {
    return value.toLocaleString("nl-NL");
}

function decimal_format(value: number, precision = 2): string {
    return value.toLocaleString("nl-NL", {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });
}

function rate_format(value: number): string {
    return decimal_format(value, 2);
}

function percentage_format(value: number): string {
    return `${decimal_format(value * 100, 1)}%`;
}

function MetricCard({ label, value, detail }: MetricCardProps) {
    return (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {value}
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{detail}</div>
        </div>
    );
}

export default function StatisticsPage() {
    const [data, setData] = useState<StatisticsData>({
        brand_stats: [],
        model_stats: [],
        rankings: null,
        metadata: {},
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function data_fetch() {
            try {
                const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                const t = Date.now();
                const [brand_response, model_response, rankings_response, metadata_response] = await Promise.all([
                    fetch(`${base_path}/data/brand_stats.json?t=${t}`),
                    fetch(`${base_path}/data/model_stats.json?t=${t}`),
                    fetch(`${base_path}/data/rankings.json?t=${t}`),
                    fetch(`${base_path}/data/metadata.json?t=${t}`),
                ]);

                if (!brand_response.ok || !model_response.ok) {
                    throw new Error("Could not load statistics data");
                }

                const brand_stats: BrandStats[] = await brand_response.json();
                const model_stats: ModelStats[] = await model_response.json();
                const rankings: Rankings | null = rankings_response.ok ? await rankings_response.json() : null;
                const metadata: Partial<Metadata> = metadata_response.ok ? await metadata_response.json() : {};

                setData({ brand_stats, model_stats, rankings, metadata });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }

        data_fetch();
    }, []);

    const statistics = useMemo(() => {
        const totals = data.brand_stats.reduce(
            (acc, item) => {
                acc.vehicles += item.vehicle_count;
                acc.inspections += item.total_inspections;
                acc.defects += item.total_defects;
                acc.vehicle_years += item.total_vehicle_years;
                if (item.vehicle_type_group === "consumer") {
                    acc.consumer_vehicles += item.vehicle_count;
                }
                if (item.vehicle_type_group === "commercial") {
                    acc.commercial_vehicles += item.vehicle_count;
                }
                acc.fuel_counts.set(item.primary_fuel, (acc.fuel_counts.get(item.primary_fuel) ?? 0) + item.vehicle_count);
                return acc;
            },
            {
                vehicles: 0,
                inspections: 0,
                defects: 0,
                vehicle_years: 0,
                consumer_vehicles: 0,
                commercial_vehicles: 0,
                fuel_counts: new Map<string, number>(),
            }
        );

        const fuel_shares: FuelShare[] = Array.from(totals.fuel_counts.entries())
            .map(([fuel, count]) => ({
                fuel,
                count,
                share: totals.vehicles > 0 ? count / totals.vehicles : 0,
            }))
            .sort((a, b) => b.count - a.count);

        const best_brand = data.rankings?.most_reliable_brands[0] ?? null;
        const worst_brand = data.rankings?.least_reliable_brands[0] ?? null;
        const best_model = data.rankings?.most_reliable_models[0] ?? null;
        const worst_model = data.rankings?.least_reliable_models[0] ?? null;

        return {
            totals,
            fuel_shares,
            best_brand,
            worst_brand,
            best_model,
            worst_model,
            defects_per_inspection: totals.inspections > 0 ? totals.defects / totals.inspections : 0,
            defects_per_vehicle_year: totals.vehicle_years > 0 ? totals.defects / totals.vehicle_years : 0,
            consumer_share: totals.vehicles > 0 ? totals.consumer_vehicles / totals.vehicles : 0,
            commercial_share: totals.vehicles > 0 ? totals.commercial_vehicles / totals.vehicles : 0,
        };
    }, [data]);

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <div className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="h-36 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl mb-4">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <h1 className="text-xl font-bold">Error Loading Statistics</h1>
                    <p>{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-zinc-900 text-zinc-50 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                    Retry
                    <RefreshCw className="w-4 h-4 inline-block ml-2" />
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Statistics
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2 max-w-3xl">
                        Aggregate APK inspection insights calculated from the processed RDW data used across this site.
                    </p>
                </div>
                <Link
                    href="/data"
                    className="inline-flex items-center gap-2 self-start rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                    Explore Data
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    label="Vehicles"
                    value={number_format(statistics.totals.vehicles)}
                    detail={`${number_format(data.brand_stats.length)} brand rows, ${number_format(data.model_stats.length)} model rows`}
                />
                <MetricCard
                    label="APK Inspections"
                    value={number_format(statistics.totals.inspections)}
                    detail={`${number_format(statistics.totals.defects)} reported defects`}
                />
                <MetricCard
                    label="Defects / Inspection"
                    value={rate_format(statistics.defects_per_inspection)}
                    detail="Across all processed brand data"
                />
                <MetricCard
                    label="Defects / Vehicle Year"
                    value={rate_format(statistics.defects_per_vehicle_year)}
                    detail={`${number_format(Math.round(statistics.totals.vehicle_years))} total vehicle-years`}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 lg:col-span-2">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Fuel Mix</h2>
                    </div>
                    <div className="mt-5 space-y-4">
                        {statistics.fuel_shares.slice(0, 6).map((item) => (
                            <div key={item.fuel}>
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{pascal_case_format(item.fuel)}</span>
                                    <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
                                        {percentage_format(item.share)}
                                    </span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                                    <div
                                        className="h-2 rounded-full bg-blue-600 dark:bg-blue-400"
                                        style={{ width: `${Math.max(1, item.share * 100)}%` }}
                                    />
                                </div>
                                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{number_format(item.count)} vehicles</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                    <div className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Vehicle Usage</h2>
                    </div>
                    <dl className="mt-5 space-y-4">
                        <div>
                            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Consumer vehicles</dt>
                            <dd className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                                {percentage_format(statistics.consumer_share)}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Commercial vehicles</dt>
                            <dd className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                                {percentage_format(statistics.commercial_share)}
                            </dd>
                        </div>
                        {data.metadata.ranges?.age && (
                            <div>
                                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Vehicle age coverage</dt>
                                <dd className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                                    {data.metadata.ranges.age.min}-{data.metadata.ranges.age.max} years
                                </dd>
                            </div>
                        )}
                    </dl>
                </section>
            </div>

            <section className="space-y-5">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Standout Rankings</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <RankingHighlight
                        title="Fewest defects brand"
                        name={statistics.best_brand ? pascal_case_format(statistics.best_brand.merk) : "-"}
                        value={statistics.best_brand?.defects_per_vehicle_year}
                    />
                    <RankingHighlight
                        title="Most defects brand"
                        name={statistics.worst_brand ? pascal_case_format(statistics.worst_brand.merk) : "-"}
                        value={statistics.worst_brand?.defects_per_vehicle_year}
                    />
                    <RankingHighlight
                        title="Fewest defects model"
                        name={statistics.best_model ? `${pascal_case_format(statistics.best_model.merk)} ${pascal_case_format(statistics.best_model.handelsbenaming ?? "")}` : "-"}
                        value={statistics.best_model?.defects_per_vehicle_year}
                    />
                    <RankingHighlight
                        title="Most defects model"
                        name={statistics.worst_model ? `${pascal_case_format(statistics.worst_model.merk)} ${pascal_case_format(statistics.worst_model.handelsbenaming ?? "")}` : "-"}
                        value={statistics.worst_model?.defects_per_vehicle_year}
                    />
                </div>
            </section>

            <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                        <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Data Freshness</h2>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        {data.rankings?.generated_at ? `Generated ${timestamp_format(data.rankings.generated_at)}` : "Generation time unavailable"}
                    </div>
                </div>
            </section>
        </div>
    );
}

function RankingHighlight({ title, name, value }: { title: string; name: string; value: number | undefined }) {
    return (
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-4">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{title}</div>
            <div className="mt-2 min-h-12 text-lg font-semibold leading-snug text-zinc-950 dark:text-zinc-50">{name}</div>
            <div className="mt-3 font-mono tabular-nums text-sm text-zinc-600 dark:text-zinc-400">
                {typeof value === "number" ? `${rate_format(value)} defects/year` : "-"}
            </div>
        </div>
    );
}
