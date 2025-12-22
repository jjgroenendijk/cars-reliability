"use client";

import { DefectFilterProvider } from "@/app/lib/defect_filter_context";
import type { ReactNode } from "react";

interface ProvidersProps {
    children: ReactNode;
}

/**
 * Client-side providers wrapper.
 * Wraps the app with all necessary context providers.
 */
export function Providers({ children }: ProvidersProps) {
    return <DefectFilterProvider>{children}</DefectFilterProvider>;
}
