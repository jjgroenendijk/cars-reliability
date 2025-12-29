/**
 * Default filter values for the website UI.
 * Centralized configuration for initial filter states across pages.
 */

export const DEFAULTS = {
    /** Age filter defaults (years since first registration) */
    age: {
        min: 4,
        max: 30,
    },
    /** Fleet size filter defaults */
    fleet: {
        min: 100,
        max: 500_000,
    },
    /** Price filter defaults (euros) */
    price: {
        min: 0,
        max: 100_000,
    },
    /** Inspections filter defaults */
    inspections: {
        min: 0,
        max: 10_000_000,
    },
    /** Pagination */
    pageSize: 50,
};
