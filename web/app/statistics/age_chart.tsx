"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import type { FleetAgeStat } from "@/app/lib/types";

interface AgeChartProps {
    data: FleetAgeStat[];
}

interface TooltipPayload {
    payload?: FleetAgeStat;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
    if (!active || !payload?.length || !payload[0].payload) return null;
    const d = payload[0].payload;
    return (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-lg text-sm">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">Age {d.age_at_inspection} years</p>
            <p className="text-zinc-600 dark:text-zinc-300 mt-1">
                <span className="font-mono">{d.avg_defects_per_inspection.toFixed(2)}</span> defects / inspection
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
                {d.vehicle_count.toLocaleString("nl-NL")} vehicles
            </p>
        </div>
    );
}

export function AgeChart({ data }: AgeChartProps) {
    const visible = data.filter((d) => d.age_at_inspection >= 2 && d.age_at_inspection <= 25);
    const peakRate = Math.max(...visible.map((d) => d.avg_defects_per_inspection));

    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visible} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                    <XAxis
                        dataKey="age_at_inspection"
                        tickFormatter={(v) => `${v}y`}
                        tick={{ fill: "currentColor", fontSize: 11, className: "text-zinc-500" }}
                        stroke="none"
                    />
                    <YAxis
                        tick={{ fill: "currentColor", fontSize: 11, className: "text-zinc-500" }}
                        stroke="none"
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(100,100,100,0.08)" }} />
                    <Bar dataKey="avg_defects_per_inspection" radius={[3, 3, 0, 0]}>
                        {visible.map((entry) => (
                            <Cell
                                key={entry.age_at_inspection}
                                fill={
                                    entry.avg_defects_per_inspection === peakRate
                                        ? "#ef4444"
                                        : "#3b82f6"
                                }
                                fillOpacity={
                                    entry.avg_defects_per_inspection === peakRate ? 1 : 0.75
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
