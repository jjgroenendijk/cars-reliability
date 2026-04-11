"use client";

import { DefectFilterProvider } from "@/app/lib/defect_filter_context";
import { LanguageProvider } from "@/app/lib/i18n/LanguageContext";
import type { ReactNode } from "react";

interface ProvidersProps {
    children: ReactNode;
}

/**
 * Client-side providers wrapper.
 * Wraps the app with all necessary context providers.
 */
export function Providers({ children }: ProvidersProps) {
    return (
        <LanguageProvider>
            <DefectFilterProvider>
                {children}
            </DefectFilterProvider>
        </LanguageProvider>
    );
}
