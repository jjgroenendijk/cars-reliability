import type { BrandStats, ModelStats, PerYearStats } from "@/app/lib/types";
import { pascal_case_format } from "@/app/lib/data_load";
import { type Column } from "@/app/components/reliability_table";

// -- Brand Types --
export interface BrandStatsFiltered extends BrandStats {
    filtered_defects?: number;
    filtered_defects_per_vehicle_year?: number | null;
    std_defects_per_inspection?: number | null;
    std_defects_per_vehicle_year?: number | null;
    avg_catalog_price?: number | null; // Added for consistently with calculation
}

// -- Model Types --
export interface ModelStatsFiltered extends ModelStats {
    filtered_defects?: number;
    filtered_defects_per_vehicle_year?: number | null;
    std_defects_per_inspection?: number | null;
    std_defects_per_vehicle_year?: number | null;
    avg_catalog_price?: number | null;
}

// -- Column Factory --
export type StatsFiltered = BrandStatsFiltered | ModelStatsFiltered;

/** Build table columns based on view mode */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function columns_build(viewMode: "brands" | "models"): Column<any>[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cols: Column<any>[] = [
        { key: "merk", label: "Brand", format: (v) => pascal_case_format(String(v)) },
    ];

    if (viewMode === "models") {
        cols.push({ key: "handelsbenaming", label: "Model", format: (v) => pascal_case_format(String(v)) });
    }

    cols.push(
        { key: "vehicle_count", label: "Vehicles" },
        { key: "total_inspections", label: "Inspections" },
        { key: "avg_defects_per_inspection", label: "Defects / Inspection" },
        { key: "avg_age_years", label: "Avg Age" },
        { key: "filtered_defects_per_vehicle_year", label: "Defects / Year" },
    );

    return cols;
}



/** Aggregate per-year stats for a given age range */
export function aggregateAgeRange(
    per_year_stats: Record<string, PerYearStats> | undefined,
    minAge: number,
    maxAge: number
): (PerYearStats & { avg_age_years: number }) | null {
    if (!per_year_stats) return null;

    let total_vehicles = 0;
    let total_inspections = 0;
    let total_defects = 0;
    let total_age_weighted = 0;

    for (let age = minAge; age <= maxAge; age++) {
        const yearStats = per_year_stats[String(age)];
        if (yearStats) {
            total_vehicles += yearStats.vehicle_count;
            total_inspections += yearStats.total_inspections;
            total_defects += yearStats.total_defects;
            total_age_weighted += age * yearStats.vehicle_count;
        }
    }

    if (total_inspections === 0) return null;

    return {
        vehicle_count: total_vehicles,
        total_inspections,
        total_defects,
        avg_defects_per_inspection: Math.round((total_defects / total_inspections) * 10000) / 10000,
        avg_age_years: total_vehicles > 0 ? Math.round((total_age_weighted / total_vehicles) * 10) / 10 : 0
    };
}
