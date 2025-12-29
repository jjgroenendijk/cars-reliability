import { pascal_case_format } from "@/app/lib/data_load";
import { FuelBreakdownBar } from "@/app/components/fuel_breakdown";
import type { BrandFuelData } from "@/app/hooks/useFuelData";

type SortKey = "merk" | "vehicle_count" | "electric_pct" | "diesel_pct" | "petrol_pct";

interface FuelTableProps {
    data: BrandFuelData[];
    viewMode: "brands" | "models";
    column_click: (key: SortKey) => void;
    sort_indicator: (key: SortKey) => string;
}

export function FuelTable({ data, viewMode, column_click, sort_indicator }: FuelTableProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                            <th
                                onClick={() => column_click("merk")}
                                className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                                {viewMode === "models" ? "Model" : "Brand"}{sort_indicator("merk")}
                            </th>
                            <th
                                onClick={() => column_click("vehicle_count")}
                                className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Vehicles{sort_indicator("vehicle_count")}
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 w-1/3 min-w-[300px]">
                                Fuel Distribution
                            </th>
                            <th
                                onClick={() => column_click("petrol_pct")}
                                className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Petrol{sort_indicator("petrol_pct")}
                            </th>
                            <th
                                onClick={() => column_click("diesel_pct")}
                                className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Diesel{sort_indicator("diesel_pct")}
                            </th>
                            <th
                                onClick={() => column_click("electric_pct")}
                                className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Electric{sort_indicator("electric_pct")}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {data.map((item) => (
                            <tr
                                key={viewMode === "brands" ? item.merk : `${item.merk}-${item.handelsbenaming}`}
                                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                            >
                                <td className="px-6 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {pascal_case_format(item.merk)} {item.handelsbenaming ? pascal_case_format(item.handelsbenaming) : ""}
                                </td>
                                <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400 text-right tabular-nums">
                                    {item.vehicle_count.toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <FuelBreakdownBar fuel_breakdown={item.fuel_breakdown} compact />
                                </td>
                                <td className="px-6 py-4 text-sm text-right tabular-nums">
                                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                                        {item.petrol_pct}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-right tabular-nums">
                                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                                        {item.diesel_pct}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-right tabular-nums">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        {item.electric_pct}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
