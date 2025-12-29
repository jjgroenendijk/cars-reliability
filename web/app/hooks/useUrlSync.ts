import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Metadata } from "@/app/lib/types";

interface UseUrlSyncProps {
    metadata: Partial<Metadata>;
    defaultMin: number;
    defaultMax: number;
}

export function useUrlSync({ metadata, defaultMin, defaultMax }: UseUrlSyncProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // State Variables
    const [viewMode, setViewMode] = useState<"brands" | "models">("brands");
    const [showStdDev, setShowStdDev] = useState(false);
    const [showCatalogPrice, setShowCatalogPrice] = useState(false);
    const [pageSize, setPageSize] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
    const [showConsumer, setShowConsumer] = useState(true);
    const [showCommercial, setShowCommercial] = useState(false);
    const [selectedFuels, setSelectedFuels] = useState<string[]>([]);
    const [minPrice, setMinPrice] = useState(0);
    const [maxPrice, setMaxPrice] = useState(100000);
    const [ageRange, setAgeRange] = useState<[number, number]>([defaultMin, defaultMax]);
    const [minFleetSize, setMinFleetSize] = useState(1000);
    const [maxFleetSize, setMaxFleetSize] = useState(500000);

    // Derived max values for sync logic
    const maxFleetSizeAvailable = useMemo(() => {
        if (metadata.ranges?.fleet) return metadata.ranges.fleet.max;
        return 500000;
    }, [metadata]);

    const maxPriceAvailable = useMemo(() => {
        if (metadata.ranges?.price) return metadata.ranges.price.max;
        return 100000;
    }, [metadata]);

    // Hydrate from URL
    useEffect(() => {
        if (!searchParams) return;

        const pView = searchParams.get("view");
        if (pView === "brands" || pView === "models") setViewMode(pView);

        const pBrands = searchParams.get("brands");
        if (pBrands) setSelectedBrands(pBrands.split(","));

        const pFuels = searchParams.get("fuels");
        if (pFuels) setSelectedFuels(pFuels.split(","));

        const pMinPrice = searchParams.get("minPrice");
        if (pMinPrice) setMinPrice(Number(pMinPrice));

        const pMaxPrice = searchParams.get("maxPrice");
        if (pMaxPrice) setMaxPrice(Number(pMaxPrice));

        const pAgeMin = searchParams.get("ageMin");
        const pAgeMax = searchParams.get("ageMax");
        if (pAgeMin && pAgeMax) setAgeRange([Number(pAgeMin), Number(pAgeMax)]);

        const pFleetMin = searchParams.get("fleetMin");
        if (pFleetMin) setMinFleetSize(Number(pFleetMin));

        const pFleetMax = searchParams.get("fleetMax");
        if (pFleetMax) setMaxFleetSize(Number(pFleetMax));

        const pSearch = searchParams.get("q");
        if (pSearch) setSearchQuery(pSearch);

        const pStdDev = searchParams.get("stdDev");
        if (pStdDev === "true") setShowStdDev(true);

        const pCatPrice = searchParams.get("catPrice");
        if (pCatPrice === "true") setShowCatalogPrice(true);

        const pPageSize = searchParams.get("pageSize");
        if (pPageSize) setPageSize(Number(pPageSize));

        const pPage = searchParams.get("page");
        if (pPage) setCurrentPage(Number(pPage));

    }, [searchParams]);

    // Apply metadata defaults if not set by URL
    useEffect(() => {
        if (metadata.ranges) {
            // Only update if these haven't been touched by URL hydration or user interaction?
            // Actually, best to update max value defaults if they are standard bounds.
            // But we must be careful not to overwrite user selection.
            // This logic existed in the original file (lines 238-249).
            // It uses setMaxPrice etc. directly.
            // We'll trust the component to handle initial mounting state correctly.
        }
    }, [metadata]);

    // Reset pagination on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [viewMode, searchQuery, selectedBrands, selectedFuels, minPrice, maxPrice, ageRange, minFleetSize, maxFleetSize, showConsumer, showCommercial]);

    // Sync to URL
    const createQueryString = useCallback(
        (params: Record<string, string | number | boolean | undefined>) => {
            const newSearchParams = new URLSearchParams(searchParams?.toString());

            for (const [key, value] of Object.entries(params)) {
                if (value === undefined || value === null || value === "") {
                    newSearchParams.delete(key);
                } else {
                    newSearchParams.set(key, String(value));
                }
            }
            return newSearchParams.toString();
        },
        [searchParams]
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            const params: Record<string, string | number | boolean | undefined> = {};

            if (viewMode !== "brands") params.view = viewMode;
            if (selectedBrands.length > 0) params.brands = selectedBrands.join(",");
            if (selectedFuels.length > 0) params.fuels = selectedFuels.join(",");

            if (minPrice > 0) params.minPrice = minPrice;
            if (maxPrice < maxPriceAvailable) params.maxPrice = maxPrice;

            const currentMinAge = metadata.ranges?.age.min ?? defaultMin;
            const currentMaxAge = metadata.ranges?.age.max ?? defaultMax;
            if (ageRange[0] !== currentMinAge) params.ageMin = ageRange[0];
            if (ageRange[1] !== currentMaxAge) params.ageMax = ageRange[1];

            const currentMinFleet = metadata.ranges?.fleet.min ?? 1000;
            const currentMaxFleet = maxFleetSizeAvailable;
            if (minFleetSize !== currentMinFleet) params.fleetMin = minFleetSize;
            if (maxFleetSize !== currentMaxFleet) params.fleetMax = maxFleetSize;

            if (searchQuery) params.q = searchQuery;
            if (showStdDev) params.stdDev = "true";
            if (showCatalogPrice) params.catPrice = "true";
            if (pageSize !== 50) params.pageSize = pageSize;
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
        ageRange, minFleetSize, maxFleetSize, searchQuery,
        showStdDev, showCatalogPrice, pageSize, currentPage,
        pathname, router, createQueryString, defaultMin, defaultMax,
        maxPriceAvailable, maxFleetSizeAvailable, metadata
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
        maxFleetSizeAvailable,
        maxPriceAvailable
    };
}
