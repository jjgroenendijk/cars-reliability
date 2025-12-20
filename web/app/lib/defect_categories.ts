/**
 * Client-side defect categorization for reliability filtering.
 * Mirrors the logic in scripts/defect_categories.py
 */

// Specific defect codes that are NOT reliability indicators (wear-and-tear)
const WEAR_AND_TEAR_CODES: Set<string> = new Set([
    // Tires / Banden
    "205", // Band onvoldoende profiel
    "206", // Band onvoldoende profiel (<1.4mm)
    "210", // Bandenspanning niet op juiste waarde
    "212", // Tire pressure warning
    "213", // Tire mounting not per spec
    "216", // Load index too small
    "217", // Load index not determinable
    "701", // Tire profile advisory
    "875", // Bandenprofiel just below minimum
    "876", // Bandenprofiel insufficient
    // Advisory codes
    "AC1", // Tire profile advisory
    "RA4", // Tire pressure system warning
]);

// Defect code prefixes that indicate wear-and-tear (administrative/advisory codes)
const WEAR_AND_TEAR_PREFIXES: string[] = ["AC", "AP"];

/**
 * Check if a defect code represents wear-and-tear rather than reliability.
 */
export function isWearAndTearDefect(defectCode: string): boolean {
    const code = defectCode.trim().toUpperCase();

    // Check specific codes
    if (WEAR_AND_TEAR_CODES.has(code)) {
        return true;
    }

    // Check prefixes
    for (const prefix of WEAR_AND_TEAR_PREFIXES) {
        if (code.startsWith(prefix)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a defect code represents a true reliability issue.
 */
export function isReliabilityDefect(defectCode: string): boolean {
    return !isWearAndTearDefect(defectCode);
}

/**
 * Categorize a defect code.
 */
export function categorizeDefect(defectCode: string): "reliability" | "wear_and_tear" {
    return isWearAndTearDefect(defectCode) ? "wear_and_tear" : "reliability";
}

/**
 * Get the default wear-and-tear codes for display/configuration.
 */
export function getDefaultWearAndTearCodes(): string[] {
    return Array.from(WEAR_AND_TEAR_CODES).sort();
}
