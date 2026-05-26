"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { number_format, pascal_case_format } from "@/app/lib/data_load";

export interface BrandChartDatum {
    merk: string;
    value: number;
    vehicle_count: number;
}

interface BrandChartProps {
    data: BrandChartDatum[];
    /** Formats the bar value for the Y-axis and tooltip (e.g. decimals or percentage). */
    valueFormat: (value: number) => string;
    /** Label describing the metric, shown in the tooltip. */
    valueLabel: string;
    barColor?: string;
}

interface TooltipPayload {
    payload?: BrandChartDatum;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    valueFormat: (value: number) => string;
    valueLabel: string;
}

function CustomTooltip({ active, payload, valueFormat, valueLabel }: CustomTooltipProps) {
    if (!active || !payload?.length || !payload[0].payload) return null;
    const d = payload[0].payload;
    return (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-lg text-sm">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{pascal_case_format(d.merk)}</p>
            <p className="text-zinc-600 dark:text-zinc-300 mt-1">
                <span className="font-mono">{valueFormat(d.value)}</span> {valueLabel}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400">
                {number_format(d.vehicle_count)} vehicles
            </p>
        </div>
    );
}

export function BrandChart({ data, valueFormat, valueLabel, barColor = "#3b82f6" }: BrandChartProps) {
    return (
        <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                    <XAxis
                        dataKey="merk"
                        tickFormatter={(v: string) => pascal_case_format(v)}
                        tick={{ fill: "currentColor", fontSize: 11, className: "text-zinc-500" }}
                        stroke="none"
                        interval={0}
                        angle={-40}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis
                        tickFormatter={(v: number) => valueFormat(v)}
                        tick={{ fill: "currentColor", fontSize: 11, className: "text-zinc-500" }}
                        stroke="none"
                        width={56}
                    />
                    <Tooltip
                        content={<CustomTooltip valueFormat={valueFormat} valueLabel={valueLabel} />}
                        cursor={{ fill: "rgba(100,100,100,0.08)" }}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]} fill={barColor} fillOpacity={0.85} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
