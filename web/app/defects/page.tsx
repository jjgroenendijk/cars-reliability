"use client";

import Link from "next/link";
import { AlertCircle, Calendar, ArrowRight } from "lucide-react";
import { timestamp_format } from "@/app/lib/data_load";
import { useDefectData } from "@/app/hooks/useDefectData";
import { DefectSummaryCards } from "@/app/components/defects/DefectSummaryCards";
import { DefectChart } from "@/app/components/defects/DefectChart";
import { DefectTable } from "@/app/components/defects/DefectTable";
import { useLanguage } from "@/app/lib/i18n/LanguageContext";

export default function DefectsPage() {
    const { t } = useLanguage();
    const {
        defect_stats,
        loading,
        error,
        search_term,
        setSearchTerm,
        sort_key,
        sort_direction,
        handle_sort,
        category_filter,
        setCategoryFilter,
        show_config,
        setShowConfig,
        filtered_defects,
        calculated_stats,
        chart_data,
        toggle_reliability,
        reset_overrides,
        override_count,
        reliability_overrides
    } = useDefectData();

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">
                    {t("defects.loading")}
                </div>
            </div>
        );
    }

    if (error || !defect_stats) {
        return (
            <div className="max-w-4xl mx-auto py-12">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                    {t("defects.title")}
                </h1>
                <div className="inline-flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
                    <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                    <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                        {error ?? t("defects.processing")}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {t("defects.title")}
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                    {t("defects.page_subtitle")}
                </p>
            </div>

            {/* Summary Cards */}
            <DefectSummaryCards
                calculated_stats={calculated_stats}
                total_inspections={defect_stats.total_inspections}
            />

            {/* Bar Chart */}
            <DefectChart chart_data={chart_data} />

            {/* Defects Table */}
            <DefectTable
                filtered_defects={filtered_defects}
                sort_key={sort_key}
                sort_direction={sort_direction}
                handle_sort={handle_sort}
                search_term={search_term}
                setSearchTerm={setSearchTerm}
                category_filter={category_filter}
                setCategoryFilter={setCategoryFilter}
                show_config={show_config}
                setShowConfig={setShowConfig}
                toggle_reliability={toggle_reliability}
                reset_overrides={reset_overrides}
                override_count={override_count}
                reliability_overrides={reliability_overrides}
            />

            {/* Data footer */}
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{t("common.last_updated")}: {timestamp_format(defect_stats.generated_at)}</span>
                </div>
                {override_count > 0 && (
                    <div className="text-blue-600 dark:text-blue-400">
                        * {t(override_count === 1 ? "defects.custom_classification_one" : "defects.custom_classification_other", { count: override_count })}
                    </div>
                )}
                <Link
                    href="/about"
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    {t("home.learn_more")}
                    <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
        </div>
    );
}
