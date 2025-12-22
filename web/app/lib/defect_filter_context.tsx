"use client";

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";
import type {
    DefectBreakdownIndex,
    DefectCodeIndex,
    DefectFilterMode,
    DefectBreakdown,
} from "./types";
import { isReliabilityDefect } from "./defect_categories";

const STORAGE_KEY = "defect_filter_state";

interface DefectFilterState {
    mode: DefectFilterMode;
    excluded_codes: Set<string>;
}

interface DefectFilterContextType {
    /** Current filter mode */
    mode: DefectFilterMode;
    /** Set of excluded defect codes (for custom mode) */
    excluded_codes: Set<string>;
    /** Whether data is still loading */
    loading: boolean;
    /** Error message if loading failed */
    error: string | null;
    /** All defect codes with descriptions */
    defect_codes: DefectCodeIndex;
    /** Brand defect breakdowns */
    brand_breakdowns: DefectBreakdownIndex;
    /** Model defect breakdowns */
    model_breakdowns: DefectBreakdownIndex;
    /** Set the filter mode */
    mode_set: (mode: DefectFilterMode) => void;
    /** Toggle a defect code's exclusion status */
    toggle_defect: (code: string) => void;
    /** Reset to default (reliability mode) */
    reset_filter: () => void;
    /** Check if a defect code is currently included */
    is_included: (code: string) => boolean;
    /** Calculate filtered defect count for a breakdown */
    calculate_filtered_defects: (breakdown: DefectBreakdown | undefined) => number;
    /** Get count of active (included) defects */
    active_defect_count: number;
    /** Get total defect code count */
    total_defect_count: number;
}

const DefectFilterContext = createContext<DefectFilterContextType | null>(null);

/**
 * Get the set of excluded codes for reliability mode (wear-and-tear codes).
 */
function reliability_excluded_codes(codes: DefectCodeIndex): Set<string> {
    const excluded = new Set<string>();
    for (const code of Object.keys(codes)) {
        if (!isReliabilityDefect(code)) {
            excluded.add(code);
        }
    }
    return excluded;
}

interface DefectFilterProviderProps {
    children: ReactNode;
}

export function DefectFilterProvider({ children }: DefectFilterProviderProps) {
    const [mode, setMode] = useState<DefectFilterMode>("reliability");
    const [excluded_codes, setExcludedCodes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [defect_codes, setDefectCodes] = useState<DefectCodeIndex>({});
    const [brand_breakdowns, setBrandBreakdowns] = useState<DefectBreakdownIndex>({});
    const [model_breakdowns, setModelBreakdowns] = useState<DefectBreakdownIndex>({});

    // Load data and restore saved state
    useEffect(() => {
        async function load_data() {
            try {
                const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                const [codes_res, brand_res, model_res] = await Promise.all([
                    fetch(`${base_path}/data/defect_codes.json`),
                    fetch(`${base_path}/data/brand_defect_breakdown.json`),
                    fetch(`${base_path}/data/model_defect_breakdown.json`),
                ]);

                if (!codes_res.ok || !brand_res.ok || !model_res.ok) {
                    throw new Error("Could not load defect filter data");
                }

                const codes: DefectCodeIndex = await codes_res.json();
                const brands: DefectBreakdownIndex = await brand_res.json();
                const models: DefectBreakdownIndex = await model_res.json();

                setDefectCodes(codes);
                setBrandBreakdowns(brands);
                setModelBreakdowns(models);

                // Restore saved state from localStorage
                try {
                    const saved = localStorage.getItem(STORAGE_KEY);
                    if (saved) {
                        const parsed = JSON.parse(saved) as {
                            mode: DefectFilterMode;
                            excluded_codes: string[]
                        };
                        setMode(parsed.mode);
                        if (parsed.mode === "custom") {
                            setExcludedCodes(new Set(parsed.excluded_codes));
                        } else if (parsed.mode === "reliability") {
                            setExcludedCodes(reliability_excluded_codes(codes));
                        } else {
                            setExcludedCodes(new Set());
                        }
                    } else {
                        // Default to reliability mode
                        setExcludedCodes(reliability_excluded_codes(codes));
                    }
                } catch {
                    // Ignore localStorage errors, use default
                    setExcludedCodes(reliability_excluded_codes(codes));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }
        load_data();
    }, []);

    // Save state to localStorage when it changes
    useEffect(() => {
        if (loading) return;
        try {
            const state = {
                mode,
                excluded_codes: Array.from(excluded_codes),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            // Ignore localStorage errors
        }
    }, [mode, excluded_codes, loading]);

    const mode_set = useCallback((new_mode: DefectFilterMode) => {
        setMode(new_mode);
        if (new_mode === "all") {
            setExcludedCodes(new Set());
        } else if (new_mode === "reliability") {
            setExcludedCodes(reliability_excluded_codes(defect_codes));
        }
        // For "custom", keep the current excluded_codes
    }, [defect_codes]);

    const toggle_defect = useCallback((code: string) => {
        setMode("custom");
        setExcludedCodes(prev => {
            const next = new Set(prev);
            if (next.has(code)) {
                next.delete(code);
            } else {
                next.add(code);
            }
            return next;
        });
    }, []);

    const reset_filter = useCallback(() => {
        setMode("reliability");
        setExcludedCodes(reliability_excluded_codes(defect_codes));
    }, [defect_codes]);

    const is_included = useCallback((code: string): boolean => {
        return !excluded_codes.has(code);
    }, [excluded_codes]);

    const calculate_filtered_defects = useCallback(
        (breakdown: DefectBreakdown | undefined): number => {
            if (!breakdown) return 0;
            let total = 0;
            for (const [code, count] of Object.entries(breakdown)) {
                if (!excluded_codes.has(code)) {
                    total += count;
                }
            }
            return total;
        },
        [excluded_codes]
    );

    const active_defect_count = useMemo(() => {
        return Object.keys(defect_codes).length - excluded_codes.size;
    }, [defect_codes, excluded_codes]);

    const total_defect_count = useMemo(() => {
        return Object.keys(defect_codes).length;
    }, [defect_codes]);

    const value: DefectFilterContextType = {
        mode,
        excluded_codes,
        loading,
        error,
        defect_codes,
        brand_breakdowns,
        model_breakdowns,
        mode_set,
        toggle_defect,
        reset_filter,
        is_included,
        calculate_filtered_defects,
        active_defect_count,
        total_defect_count,
    };

    return (
        <DefectFilterContext.Provider value={value}>
            {children}
        </DefectFilterContext.Provider>
    );
}

/**
 * Hook to access defect filter context.
 * Must be used within a DefectFilterProvider.
 */
export function useDefectFilter(): DefectFilterContextType {
    const context = useContext(DefectFilterContext);
    if (!context) {
        throw new Error("useDefectFilter must be used within a DefectFilterProvider");
    }
    return context;
}
