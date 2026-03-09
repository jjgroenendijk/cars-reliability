/**
 * Client-side defect categorization for reliability filtering.
 *
 * Classification based on Consumer Reports, JD Power, ADAC, and ANWB
 * methodology: wear-and-tear items (tires, bulbs, wipers, brake pads,
 * shocks, exhaust corrosion) are excluded from reliability scoring.
 *
 * IMPORTANT: AC3 (roestschade / rust damage) is a RELIABILITY indicator
 * and is intentionally NOT in this list. We use individual AC codes
 * instead of an AC* prefix to preserve AC3.
 */

// -- Category: Tires / Banden --
// Normal wear consumables; replaced every 30k-60k km
const TIRE_CODES: readonly string[] = [
    "203", // Band beschadigd
    "204", // Band ernstig beschadigd
    "205", // Band onvoldoende profiel
    "206", // Band onvoldoende profiel (<1.4mm)
    "207", // Uitstulping band
    "208", // Bandenspanning wijkt >0.5 bar af
    "209", // Bandenspanning 1 as wijkt >0.5 bar af
    "210", // Bandenspanning niet op juiste waarde
    "211", // Bandenspanning 1 as niet gelijk
    "212", // Bandenspanning waarschuwing
    "213", // Bandmontage niet conform specificatie
    "214", // Nageprofileerd
    "215", // Banden 1 as niet dezelfde maat
    "216", // Laadindex te klein
    "217", // Laadindex niet vast te stellen
    "218", // Noodwiel gemonteerd
    "701", // Bandprofiel advies
    "874", // Bandenspanning wijkt 2 bar af
    "875", // Bandprofiel net onder minimum
    "876", // Bandprofiel onvoldoende
    "877", // Bandenmaat aangedreven as wijkt af
    "992", // Band bevat uitstekend metalen element
    "AC1", // Band profieldiepte 1.6-2.5mm (advisory)
    "RA4", // Bandenspanning controlesysteem waarschuwing
];

// -- Category: Lighting / Bulbs --
// Bulb failures and alignment are consumable maintenance items
// per Consumer Reports methodology. NOT wiring or electrical faults.
const LIGHTING_CODES: readonly string[] = [
    // Bulb failures ("werkt niet")
    "475", // Achterlicht werkt niet
    "487", // Achteruitrijlicht werkt niet
    "497", // Kentekenplaatverlichting werkt niet
    "507", // Dim-/grootlicht werkt niet
    "532", // Mistachterlicht werkt niet
    "556", // Remlicht werkt niet
    "571", // Richtingaanwijzer werkt niet
    "572", // Zijrichtingaanwijzer werkt niet
    "573", // Waarschuwingsknipperlichten werken niet
    "584", // Stadslicht werkt niet
    "589", // Zij-markeringslicht werkt niet
    "601", // Mistlicht voor werkt niet
    // Light alignment / adjustment
    "516", // Dimlicht onjuist afgesteld
    "517", // Dimlicht onjuist afgesteld (variant)
    "518", // Dimlicht verblindend boven nullijn
    "519", // Dimlicht verblindend
    "520", // Koplamp afwijkend lichtbeeld
    "521", // Koplamp afwijkend lichtbeeld (variant)
    "522", // Licht-donkerscheiding onduidelijk
    "524", // Lichtbeeld onjuist
    "598", // Mistlicht voor onjuist afgesteld
    // Light appearance
    "542", // Retroreflector gebrek
    "576", // Richtingaanwijzers kleur wijkt af
    "710", // Lichtbeeld onjuist (advies)
];

// -- Category: Wipers / Washers --
// Wiper blades and washer fluid are consumable per Consumer Reports, ADAC
const WIPER_CODES: readonly string[] = [
    "388", // Ruitenwisser werkt niet
    "389", // Ruitenwisser werkt niet goed
    "391", // Ruitenwisser onvoldoende zicht
    "392", // Ruitensproeier werkt niet
    "393", // Ruitensproeier werkt niet goed
];

// -- Category: Brake Wear --
// Pad and disc wear only. Brake SYSTEM failures (leaks 296/297,
// ABS 321-325, master cylinder 278/279, lines 303-308, 916)
// are RELIABILITY indicators and are NOT included here.
const BRAKE_WEAR_CODES: readonly string[] = [
    "289", // Schijf-/trommelrem loopt niet vrij
    "290", // Schijf-/trommelrem loopt onvoldoende vrij
    "311", // Remvoering raakt trommel/schijf
    "312", // Remschijf ernstig gecorrodeerd
    "313", // Remschijf slijtage breukrisico
    "AC5", // Mechanische delen remsysteem slijtage (advisory)
    "705", // Mechanische delen remsysteem slijtage (advisory, same as AC5)
];

// -- Category: Shock Absorbers --
// Wear item with 80k-150k km expected lifespan
const SHOCK_ABSORBER_CODES: readonly string[] = [
    "241", // Schokdemper werkt niet goed
    "AC2", // Schokdemper lekkage (advisory)
    "702", // Schokdemper lekkage (advisory, same as AC2)
];

// -- Category: Exhaust Wear --
// Corrosion and mounting wear; expected 5-8 year lifespan.
// Emission SYSTEM failures (DPF 140/141, codes 122-143) are
// RELIABILITY indicators and are NOT included here.
const EXHAUST_WEAR_CODES: readonly string[] = [
    "115", // Uitlaatsysteem niet gasdicht
    "116", // Uitlaatsysteem niet geheel gasdicht
    "117", // Uitlaatsysteem ondeugdelijk bevestigd
];

// -- Category: Administrative / Non-vehicle --
// Not actual vehicle defects; inspection limitations or minor advisories
const ADMINISTRATIVE_CODES: readonly string[] = [
    "AC4", // Stuur/fuseekogel slijtage <=1.0mm (minor wear advisory)
    "704", // Stuur/fuseekogel slijtage (advisory, same as AC4)
];

// Prefixes that indicate non-vehicle / administrative codes.
// AP: administrative prefix (no codes in actual data, harmless safeguard)
// OP: inspection limitation codes (not actual vehicle defects)
const WEAR_AND_TEAR_PREFIXES: readonly string[] = ["AP", "OP"];

/** Category names for documentation and UI */
export type WearAndTearCategory =
    | "tires"
    | "lighting"
    | "wipers"
    | "brake_wear"
    | "shock_absorbers"
    | "exhaust_wear"
    | "administrative";

interface CategoryInfo {
    readonly category: WearAndTearCategory;
    readonly label: string;
    readonly codes: readonly string[];
}

const CATEGORIES: readonly CategoryInfo[] = [
    { category: "tires", label: "Tires / Banden", codes: TIRE_CODES },
    { category: "lighting", label: "Lighting / Bulbs", codes: LIGHTING_CODES },
    { category: "wipers", label: "Wipers / Washers", codes: WIPER_CODES },
    { category: "brake_wear", label: "Brake Wear", codes: BRAKE_WEAR_CODES },
    { category: "shock_absorbers", label: "Shock Absorbers", codes: SHOCK_ABSORBER_CODES },
    { category: "exhaust_wear", label: "Exhaust Wear", codes: EXHAUST_WEAR_CODES },
    { category: "administrative", label: "Administrative", codes: ADMINISTRATIVE_CODES },
];

// Single flat Set for O(1) lookup performance
const WEAR_AND_TEAR_CODES: Set<string> = new Set(
    CATEGORIES.flatMap((c) => c.codes),
);

/**
 * Check if a defect code represents wear-and-tear rather than reliability.
 */
export function isWearAndTearDefect(defectCode: string): boolean {
    const code = defectCode.trim().toUpperCase();

    if (WEAR_AND_TEAR_CODES.has(code)) {
        return true;
    }

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
 * Categorize a defect code as reliability or wear-and-tear.
 */
export function categorizeDefect(defectCode: string): "reliability" | "wear_and_tear" {
    return isWearAndTearDefect(defectCode) ? "wear_and_tear" : "reliability";
}

/**
 * Get all wear-and-tear codes (sorted) for display or configuration.
 */
export function getDefaultWearAndTearCodes(): string[] {
    return Array.from(WEAR_AND_TEAR_CODES).sort();
}

/**
 * Get the wear-and-tear category breakdown for documentation or UI display.
 * Returns each category with its label and associated defect codes.
 */
export function getWearAndTearCategories(): readonly CategoryInfo[] {
    return CATEGORIES;
}
