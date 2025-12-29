import { BarChart3, AlertCircle, ClipboardList } from "lucide-react";

interface DefectSummaryCardsProps {
    calculated_stats: {
        total_count: number;
        reliability_count: number;
        wear_count: number;
        reliability_percentage: string;
    };
    total_inspections: number;
}

export function DefectSummaryCards({ calculated_stats, total_inspections }: DefectSummaryCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-4 mb-8">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <BarChart3 className="h-4 w-4" />
                    Total Defects
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {calculated_stats.total_count.toLocaleString()}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    Reliability Defects
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {calculated_stats.reliability_count.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {calculated_stats.reliability_percentage}% of total
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800 p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">
                    <ClipboardList className="h-4 w-4" />
                    Wear & Tear
                </div>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {calculated_stats.wear_count.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Normal maintenance items
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    <ClipboardList className="h-4 w-4" />
                    Total Inspections
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {total_inspections.toLocaleString()}
                </div>
            </div>
        </div>
    );
}
