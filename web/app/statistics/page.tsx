"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Car,
    Gauge,
    RefreshCw,
    ShieldCheck,
    TrendingUp,
    Wrench,
} from "lucide-react";
import type { BrandStats, DefectStats, Metadata, ModelStats, Rankings } from "@/app/lib/types";
import { number_format, pascal_case_format, percentage_format, timestamp_format } from "@/app/lib/data_load";
import { AgeChart } from "./age_chart";
import { TrendChart } from "./trend_chart";

interface StatisticsData {
    brand_stats: BrandStats[];
    model_stats: ModelStats[];
    rankings: Rankings | null;
    metadata: Partial<Metadata>;
    defect_stats: DefectStats | null;
}

function decimal_format(value: number, precision = 2): string {
    return value.toLocaleString("nl-NL", { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

interface InsightCardProps {
    label: string;
    value: string;
    detail: string;
    accent?: boolean;
}

function InsightCard({ label, value, detail, accent }: InsightCardProps) {
    return (
        <div className={`rounded-lg border p-5 ${accent ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"}`}>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
            <div className={`mt-3 text-3xl font-bold tracking-tight ${accent ? "text-blue-700 dark:text-blue-300" : "text-zinc-950 dark:text-zinc-50"}`}>
                {value}
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{detail}</div>
        </div>
    );
}

interface FuelShare {
    fuel: string;
    count: number;
    share: number;
}

export default function StatisticsPage() {
    const [data, setData] = useState<StatisticsData>({
        brand_stats: [],
        model_stats: [],
        rankings: null,
        metadata: {},
        defect_stats: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function data_fetch() {
            try {
                const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                const t = Date.now();
                const [brand_res, model_res, rankings_res, metadata_res, defect_res] = await Promise.all([
                    fetch(`${base_path}/data/brand_stats.json?t=${t}`),
                    fetch(`${base_path}/data/model_stats.json?t=${t}`),
                    fetch(`${base_path}/data/rankings.json?t=${t}`),
                    fetch(`${base_path}/data/metadata.json?t=${t}`),
                    fetch(`${base_path}/data/defect_stats.json?t=${t}`),
                ]);

                if (!brand_res.ok || !model_res.ok) {
                    throw new Error("Could not load statistics data");
                }

                const brand_stats: BrandStats[] = await brand_res.json();
                const model_stats: ModelStats[] = await model_res.json();
                const rankings: Rankings | null = rankings_res.ok ? await rankings_res.json() : null;
                const metadata: Partial<Metadata> = metadata_res.ok ? await metadata_res.json() : {};
                const defect_stats: DefectStats | null = defect_res.ok ? await defect_res.json() : null;

                setData({ brand_stats, model_stats, rankings, metadata, defect_stats });
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
                acc.fuel_counts.set(item.primary_fuel, (acc.fuel_counts.get(item.primary_fuel) ?? 0) + item.vehicle_count);
                return acc;
            },
            {
                vehicles: 0,
                inspections: 0,
                defects: 0,
                vehicle_years: 0,
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

        const reliability_ratio =
            best_brand?.defects_per_vehicle_year && worst_brand?.defects_per_vehicle_year
                ? worst_brand.defects_per_vehicle_year / best_brand.defects_per_vehicle_year
                : null;

        const top_defect = data.defect_stats?.top_defects[0] ?? null;

        const fleet_size = data.metadata.counts?.vehicles_processed ?? totals.vehicles;

        return {
            totals,
            fuel_shares,
            best_brand,
            worst_brand,
            best_model,
            worst_model,
            reliability_ratio,
            top_defect,
            fleet_size,
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
                <div className="h-72 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
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

    const zero_defect_rate = data.metadata.stats?.zero_defect_rate;
    const fleet_age_stats = data.metadata.stats?.fleet_age_stats ?? [];
    const yearly_trend = data.metadata.stats?.yearly_trend ?? [];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                        Statistics
                    </h1>
                    <p className="text-lg text-zinc-600 dark:text-zinc-400 mt-2 max-w-3xl">
                        Key insights from {number_format(statistics.totals.inspections)} APK inspections across the Dutch vehicle fleet.
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

            {/* Insight cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InsightCard
                    label="Vehicles tracked"
                    value={number_format(statistics.fleet_size)}
                    detail={`${number_format(data.brand_stats.length)} brand rows, ${number_format(data.model_stats.length)} model rows`}
                />
                {zero_defect_rate !== undefined && (
                    <InsightCard
                        accent
                        label="Pass with zero defects"
                        value={percentage_format(zero_defect_rate)}
                        detail={`${number_format(statistics.totals.inspections)} total inspections`}
                    />
                )}
                {statistics.reliability_ratio !== null && (
                    <InsightCard
                        label="Reliability spread"
                        value={`${decimal_format(statistics.reliability_ratio, 1)}×`}
                        detail={`${statistics.best_brand ? pascal_case_format(statistics.best_brand.merk) : "–"} vs ${statistics.worst_brand ? pascal_case_format(statistics.worst_brand.merk) : "–"}`}
                    />
                )}
                {statistics.top_defect && (
                    <InsightCard
                        label="Most common defect"
                        value={`${statistics.top_defect.percentage.toFixed(1)}%`}
                        detail={statistics.top_defect.defect_description}
                    />
                )}
            </div>

            {/* Charts row */}
            <div className="grid gap-6 lg:grid-cols-2">
                {fleet_age_stats.length > 0 && (
                    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Defect Rate by Vehicle Age</h2>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
                            Average defects per APK inspection. Red bar = age with most defects.
                        </p>
                        <AgeChart data={fleet_age_stats} />
                    </section>
                )}

                {yearly_trend.length >= 2 && (
                    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Reliability Trend</h2>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                            Average defects per inspection, by inspection year.
                        </p>
                        <TrendChart data={yearly_trend} />
                    </section>
                )}
            </div>

            {/* Fuel mix */}
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

                {/* Top defects summary */}
                {data.defect_stats && data.defect_stats.top_defects.length > 0 && (
                    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                        <div className="flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Top Defects</h2>
                        </div>
                        <ol className="mt-5 space-y-4">
                            {data.defect_stats.top_defects.slice(0, 5).map((defect, idx) => (
                                <li key={defect.defect_code} className="flex gap-3">
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-snug">
                                            {defect.defect_description}
                                        </p>
                                        <p className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                                            {defect.percentage.toFixed(1)}% of all defects
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}
            </div>

            {/* Rankings */}
            <section className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Standout Rankings</h2>
                    </div>
                    {statistics.reliability_ratio !== null && (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">
                            {decimal_format(statistics.reliability_ratio, 1)}× spread between best and worst
                        </span>
                    )}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <RankingHighlight
                        title="Fewest defects brand"
                        name={statistics.best_brand ? pascal_case_format(statistics.best_brand.merk) : "-"}
                        value={statistics.best_brand?.defects_per_vehicle_year}
                        positive
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
                        positive
                    />
                    <RankingHighlight
                        title="Most defects model"
                        name={statistics.worst_model ? `${pascal_case_format(statistics.worst_model.merk)} ${pascal_case_format(statistics.worst_model.handelsbenaming ?? "")}` : "-"}
                        value={statistics.worst_model?.defects_per_vehicle_year}
                    />
                </div>
            </section>

            {/* Data freshness */}
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

function RankingHighlight({ title, name, value, positive }: { title: string; name: string; value: number | undefined; positive?: boolean }) {
    return (
        <div className={`rounded-lg p-4 ${positive ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-zinc-50 dark:bg-zinc-800/60"}`}>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{title}</div>
            <div className="mt-2 min-h-12 text-lg font-semibold leading-snug text-zinc-950 dark:text-zinc-50">{name}</div>
            <div className="mt-3 font-mono tabular-nums text-sm text-zinc-600 dark:text-zinc-400">
                {typeof value === "number" ? `${decimal_format(value)} defects/year` : "-"}
            </div>
        </div>
    );
}
