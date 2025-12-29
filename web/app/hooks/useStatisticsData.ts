import { useState, useEffect, useMemo } from "react";
import type { BrandStats, ModelStats, Rankings, Metadata } from "@/app/lib/types";

export function useStatisticsData() {
    const [brand_stats, setBrandStats] = useState<BrandStats[]>([]);
    const [model_stats, setModelStats] = useState<ModelStats[]>([]);
    const [metadata, setMetadata] = useState<Partial<Metadata>>({});
    const [generated_at, setGeneratedAt] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial Data Fetch
    useEffect(() => {
        async function data_fetch() {
            try {
                const base_path = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                const t = Date.now();
                const [brand_response, model_response, rankings_response, metadata_response] = await Promise.all([
                    fetch(`${base_path}/data/brand_stats.json?t=${t}`),
                    fetch(`${base_path}/data/model_stats.json?t=${t}`),
                    fetch(`${base_path}/data/rankings.json?t=${t}`),
                    fetch(`${base_path}/data/metadata.json?t=${t}`),
                ]);

                if (!brand_response.ok || !model_response.ok) {
                    throw new Error("Could not load statistics data");
                }

                const brands: BrandStats[] = await brand_response.json();
                const models: ModelStats[] = await model_response.json();

                setBrandStats(brands);
                setModelStats(models);

                if (rankings_response.ok) {
                    const rankings: Rankings = await rankings_response.json();
                    setGeneratedAt(rankings.generated_at);
                }

                if (metadata_response.ok) {
                    const meta: Metadata = await metadata_response.json();
                    setMetadata(meta);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
            } finally {
                setLoading(false);
            }
        }
        data_fetch();
    }, []);

    return {
        brand_stats,
        model_stats,
        metadata,
        generated_at,
        loading,
        error
    };
}
