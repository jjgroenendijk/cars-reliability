"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { pascal_case_format } from "@/app/lib/data_load";

interface ChartProps {
    data: any[];
    metric: string;
}

export default function ReliabilityChart({ data, metric }: ChartProps) {
    // Placeholder chart implementation
    return (
        <div className="h-96 w-full p-4">
            <div className="flex items-center justify-center h-full border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800">
                <p className="text-gray-500">Reliability Chart (Placeholder)</p>
            </div>
        </div>
    );
}
