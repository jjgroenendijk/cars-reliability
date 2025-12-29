"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface ChartDataItem {
    name: string;
    description: string;
    count: number;
    percentage: number;
}

interface DefectChartProps {
    chart_data: ChartDataItem[];
}

export function DefectChart({ chart_data }: DefectChartProps) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Top 15 Reliability Defects
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Only showing defects that indicate actual car quality issues (excluding wear-and-tear items).
            </p>
            <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chart_data}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="#9ca3af" />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={100}
                            tick={{ fill: "#9ca3af", fontSize: 12 }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {data.name}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                                                {data.description}
                                            </p>
                                            <p className="text-sm mt-1">
                                                <span className="font-medium">{data.count.toLocaleString()}</span>{" "}
                                                occurrences ({data.percentage}%)
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
