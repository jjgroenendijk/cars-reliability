/**
 * Functions to load JSON data from public/data/ directory.
 * These functions are used for server-side data loading in Next.js pages.
 */

import type { BrandStats, ModelStats, Rankings, DataSet } from "./types";

/**
 * Base path for data files. Uses NEXT_PUBLIC_BASE_PATH for production deployments.
 */
const DATA_BASE_PATH = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data`;

/**
 * Load brand statistics from JSON file.
 * @returns Promise resolving to array of BrandStats
 */
export async function brand_stats_load(): Promise<BrandStats[]> {
  try {
    const response = await fetch(`${DATA_BASE_PATH}/brand_stats.json`);
    if (!response.ok) {
      throw new Error(`Failed to load brand stats: ${response.status}`);
    }
    const data: BrandStats[] = await response.json();
    return data;
  } catch {
    return [];
  }
}

/**
 * Load model statistics from JSON file.
 * @returns Promise resolving to array of ModelStats
 */
export async function model_stats_load(): Promise<ModelStats[]> {
  try {
    const response = await fetch(`${DATA_BASE_PATH}/model_stats.json`);
    if (!response.ok) {
      throw new Error(`Failed to load model stats: ${response.status}`);
    }
    const data: ModelStats[] = await response.json();
    return data;
  } catch {
    return [];
  }
}

/**
 * Load rankings from JSON file.
 * @returns Promise resolving to Rankings object
 */
export async function rankings_load(): Promise<Rankings | null> {
  try {
    const response = await fetch(`${DATA_BASE_PATH}/rankings.json`);
    if (!response.ok) {
      throw new Error(`Failed to load rankings: ${response.status}`);
    }
    const data: Rankings = await response.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Load all data files at once.
 * @returns Promise resolving to complete DataSet
 */
export async function data_load_all(): Promise<DataSet | null> {
  try {
    const [brand_stats, model_stats, rankings] = await Promise.all([
      brand_stats_load(),
      model_stats_load(),
      rankings_load(),
    ]);

    if (!rankings) {
      return null;
    }

    return {
      brand_stats,
      model_stats,
      rankings,
      generated_at: rankings.generated_at,
    };
  } catch {
    return null;
  }
}

/**
 * Format timestamp for display.
 * @param timestamp - ISO timestamp string
 * @returns Formatted date string in Dutch locale
 */
export function timestamp_format(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString("nl-NL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

/**
 * Format percentage for display.
 * @param value - Decimal value (e.g., 0.15 for 15%)
 * @returns Formatted percentage string
 */
export function percentage_format(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format large numbers with thousand separators.
 * @param value - Number to format
 * @returns Formatted number string
 */
export function number_format(value: number): string {
  return value.toLocaleString("nl-NL");
}

/**
 * Convert ALL CAPS string to Pascal Case.
 * @param value - String to format (e.g., "VOLKSWAGEN" or "GOLF VARIANT")
 * @returns Pascal Case string (e.g., "Volkswagen" or "Golf Variant")
 */
export function pascal_case_format(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
