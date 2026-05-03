"use client";

import { useLanguage } from "@/app/lib/i18n/LanguageContext";

interface RankingHighlightProps {
    title: string;
    name: string;
    value: number | undefined;
    positive?: boolean;
}

function decimal_format(value: number, precision = 2): string {
    return value.toLocaleString("nl-NL", { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

export function RankingHighlight({ title, name, value, positive }: RankingHighlightProps) {
    const { t } = useLanguage();

    return (
        <div className={`rounded-lg p-4 ${positive ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-zinc-50 dark:bg-zinc-800/60"}`}>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{title}</div>
            <div className="mt-2 min-h-12 text-lg font-semibold leading-snug text-zinc-950 dark:text-zinc-50">{name}</div>
            <div className="mt-3 font-mono tabular-nums text-sm text-zinc-600 dark:text-zinc-400">
                {typeof value === "number" ? t("statistics.defects_per_year_short", { value: decimal_format(value) }) : "-"}
            </div>
        </div>
    );
}
