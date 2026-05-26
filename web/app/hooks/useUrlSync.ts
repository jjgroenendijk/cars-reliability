import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Metadata } from "@/app/lib/types";
import { DEFAULTS } from "@/app/lib/defaults";

interface UseUrlSyncProps {
    metadata: Partial<Metadata>;
}

export function useUrlSync({ metadata }: UseUrlSyncProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Seed initial state from the URL query so filters survive reload/sharing.
    // Reading in the useState initializers (instead of a mount effect) avoids the
    // cascading re-render flagged by react-hooks/set-state-in-effect. The /data
    // route renders this behind a Suspense boundary, so there is no server-rendered
    // markup to mismatch against during hydration.
    const param_number = (key: string, fallback: number) => {
        const raw = searchParams?.get(key);
        return raw ? Number(raw) : fallback;
    };

    // State Variables
    const [viewMode, setViewMode] = useState<"brands" | "models">(() => {
        const v = searchParams?.get("view");
        return v === "brands" || v === "models" ? v : "brands";
    });
    const [showStdDev, setShowStdDev] = useState(() => searchParams?.get("stdDev") === "true");
    const [showCatalogPrice, setShowCatalogPrice] = useState(() => searchParams?.get("catPrice") === "true");
    const [pageSize, setPageSize] = useState(() => param_number("pageSize", DEFAULTS.pageSize));
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState(() => searchParams?.get("q") ?? "");
    const [selectedBrands, setSelectedBrands] = useState<string[]>(() => {
        const b = searchParams?.get("brands");
        return b ? b.split(",") : [];
    });
    const [showConsumer, setShowConsumer] = useState(true);
    const [showCommercial, setShowCommercial] = useState(false);
    const [selectedFuels, setSelectedFuels] = useState<string[]>(() => {
        const f = searchParams?.get("fuels");
        return f ? f.split(",") : [];
    });
    const [minPrice, setMinPrice] = useState(() => param_number("minPrice", DEFAULTS.price.min));
    const [maxPrice, setMaxPrice] = useState(() => param_number("maxPrice", DEFAULTS.price.max));
    const [ageRange, setAgeRange] = useState<[number, number]>(() => {
        const aMin = searchParams?.get("ageMin");
        const aMax = searchParams?.get("ageMax");
        return aMin && aMax ? [Number(aMin), Number(aMax)] : [DEFAULTS.age.min, DEFAULTS.age.max];
    });
    const [minFleetSize, setMinFleetSize] = useState(() => param_number("fleetMin", DEFAULTS.fleet.min));
    const [maxFleetSize, setMaxFleetSize] = useState(() => param_number("fleetMax", DEFAULTS.fleet.max));
    const [minInspections, setMinInspections] = useState(() => param_number("inspMin", DEFAULTS.inspections.min));
    const [maxInspections, setMaxInspections] = useState(() => param_number("inspMax", DEFAULTS.inspections.max));

    // Derived max values for sync logic
    const maxFleetSizeAvailable = useMemo(() => {
        if (metadata.ranges?.fleet) return metadata.ranges.fleet.max;
        return DEFAULTS.fleet.max;
    }, [metadata]);

    const maxPriceAvailable = useMemo(() => {
        if (metadata.ranges?.price) return metadata.ranges.price.max;
        return DEFAULTS.price.max;
    }, [metadata]);

    const maxInspectionsAvailable = useMemo(() => {
        if (metadata.ranges?.inspections) return metadata.ranges.inspections.max;
        return DEFAULTS.inspections.max;
    }, [metadata]);

    // Reset pagination whenever a filter changes. Tracking the previous filter
    // signature and resetting during render (rather than in an effect) avoids the
    // cascading re-render flagged by react-hooks/set-state-in-effect.
    const filter_signature = JSON.stringify([
        viewMode, searchQuery, selectedBrands, selectedFuels, minPrice, maxPrice,
        ageRange, minFleetSize, maxFleetSize, minInspections, maxInspections,
        showConsumer, showCommercial,
    ]);
    const [prev_filter_signature, setPrevFilterSignature] = useState(filter_signature);
    if (filter_signature !== prev_filter_signature) {
        setPrevFilterSignature(filter_signature);
        setCurrentPage(1);
    }

    // Sync to URL
    const createQueryString = useCallback(
        (params: Record<string, string | number | boolean | undefined>) => {
            const newSearchParams = new URLSearchParams();

            for (const [key, value] of Object.entries(params)) {
                if (value === undefined || value === null || value === "") {
                    newSearchParams.delete(key);
                } else {
                    newSearchParams.set(key, String(value));
                }
            }
            return newSearchParams.toString();
        },
        []
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            const params: Record<string, string | number | boolean | undefined> = {};

            if (viewMode !== "brands") params.view = viewMode;
            if (selectedBrands.length > 0) params.brands = selectedBrands.join(",");
            if (selectedFuels.length > 0) params.fuels = selectedFuels.join(",");

            if (minPrice > DEFAULTS.price.min) params.minPrice = minPrice;
            if (maxPrice < maxPriceAvailable) params.maxPrice = maxPrice;

            const currentMinAge = metadata.ranges?.age.min ?? DEFAULTS.age.min;
            const currentMaxAge = metadata.ranges?.age.max ?? DEFAULTS.age.max;
            if (ageRange[0] !== currentMinAge) params.ageMin = ageRange[0];
            if (ageRange[1] !== currentMaxAge) params.ageMax = ageRange[1];

            const currentMinFleet = metadata.ranges?.fleet.min ?? DEFAULTS.fleet.min;
            const currentMaxFleet = maxFleetSizeAvailable;
            if (minFleetSize !== currentMinFleet) params.fleetMin = minFleetSize;
            if (maxFleetSize !== currentMaxFleet) params.fleetMax = maxFleetSize;

            const currentMinInsp = metadata.ranges?.inspections?.min ?? DEFAULTS.inspections.min;
            const currentMaxInsp = maxInspectionsAvailable;
            if (minInspections !== currentMinInsp) params.inspMin = minInspections;
            if (maxInspections !== currentMaxInsp) params.inspMax = maxInspections;

            if (searchQuery) params.q = searchQuery;
            if (showStdDev) params.stdDev = "true";
            if (showCatalogPrice) params.catPrice = "true";
            if (pageSize !== DEFAULTS.pageSize) params.pageSize = pageSize;
            if (currentPage !== 1) params.page = currentPage;

            const queryString = createQueryString(params);

            if (!queryString) {
                router.replace(pathname, { scroll: false });
            } else {
                router.replace(`${pathname}?${queryString}`, { scroll: false });
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [
        viewMode, selectedBrands, selectedFuels, minPrice, maxPrice,
        ageRange, minFleetSize, maxFleetSize, minInspections, maxInspections, searchQuery,
        showStdDev, showCatalogPrice, pageSize, currentPage,
        pathname, router, createQueryString,
        maxPriceAvailable, maxFleetSizeAvailable, maxInspectionsAvailable, metadata
    ]);


    // Return all state and setters
    return {
        viewMode, setViewMode,
        showStdDev, setShowStdDev,
        showCatalogPrice, setShowCatalogPrice,
        pageSize, setPageSize,
        currentPage, setCurrentPage,
        searchQuery, setSearchQuery,
        selectedBrands, setSelectedBrands,
        showConsumer, setShowConsumer,
        showCommercial, setShowCommercial,
        selectedFuels, setSelectedFuels,
        minPrice, setMinPrice,
        maxPrice, setMaxPrice,
        ageRange, setAgeRange,
        minFleetSize, setMinFleetSize,
        maxFleetSize, setMaxFleetSize,
        minInspections, setMinInspections,
        maxInspections, setMaxInspections,
        maxFleetSizeAvailable,
        maxPriceAvailable,
        maxInspectionsAvailable
    };
}
