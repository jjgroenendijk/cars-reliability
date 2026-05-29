/**
 * Formatting helpers for displaying data values in the UI.
 */

// Cache formatters to avoid the high overhead of instantiating Intl formatters
// repeatedly inside hot loops (like mapping thousands of rows in UI tables).
const numberFormatterCache = new Map<number, Intl.NumberFormat>();
const timestampFormatter = new Intl.DateTimeFormat("nl-NL", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const baseNumberFormatter = new Intl.NumberFormat("nl-NL");

/**
 * Format a number with a fixed number of decimal places using the Dutch locale.
 * @param value - Number to format
 * @param precision - Number of decimal places (default 2)
 * @returns Formatted decimal string
 */
export function decimal_format(value: number, precision = 2): string {
  let formatter = numberFormatterCache.get(precision);
  if (!formatter) {
    formatter = new Intl.NumberFormat("nl-NL", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
    numberFormatterCache.set(precision, formatter);
  }
  return formatter.format(value);
}

/**
 * Format timestamp for display.
 * @param timestamp - ISO timestamp string
 * @returns Formatted date string in Dutch locale
 */
export function timestamp_format(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return timestampFormatter.format(date);
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
  return baseNumberFormatter.format(value).replace(/\./g, " ");
}

/**
 * Convert ALL CAPS string to Pascal Case.
 * @param value - String to format (e.g., "VOLKSWAGEN" or "GOLF VARIANT")
 * @returns Pascal Case string (e.g., "Volkswagen" or "Golf Variant")
 */
export function pascal_case_format(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
