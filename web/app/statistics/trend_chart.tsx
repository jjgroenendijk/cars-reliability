"use client";

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { YearlyTrendEntry } from "@/app/lib/types";

interface TrendChartProps {
    data: YearlyTrendEntry[];
}

interface TooltipPayload {
    payload?: YearlyTrendEntry;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
    if (!active || !payload?.length || !payload[0].payload) return null;
    const d = payload[0].payload;
    return (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-lg text-sm">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{d.insp_year}</p>
            <p className="text-zinc-600 dark:text-zinc-300 mt-1">
                <span className="font-mono">{d.avg_defects_per_inspection.toFixed(2)}</span> defects / inspection
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
                {d.inspections.toLocaleString("nl-NL")} inspections
            </p>
        </div>
    );
}

export function TrendChart({ data }: TrendChartProps) {
    if (data.length < 2) return null;

    const first = data[0].avg_defects_per_inspection;
    const last = data[data.length - 1].avg_defects_per_inspection;
    const delta = ((last - first) / first) * 100;
    const improved = delta < 0;

    return (
        <div className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {data[0].insp_year}–{data[data.length - 1].insp_year}:{" "}
                <span className={improved ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-500 dark:text-red-400 font-medium"}>
                    {improved ? "" : "+"}
                    {delta.toFixed(1)}%
                </span>{" "}
                {improved ? "fewer" : "more"} defects per inspection
            </p>
            <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                        <XAxis
                            dataKey="insp_year"
                            tick={{ fill: "currentColor", fontSize: 11 }}
                            stroke="none"
                        />
                        <YAxis
                            tick={{ fill: "currentColor", fontSize: 11 }}
                            stroke="none"
                            domain={["auto", "auto"]}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#3b82f6", strokeWidth: 1 }} />
                        <Area
                            type="monotone"
                            dataKey="avg_defects_per_inspection"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#trend-fill)"
                            dot={false}
                            activeDot={{ r: 4, fill: "#3b82f6" }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
