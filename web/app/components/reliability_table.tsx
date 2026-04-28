"use client";

import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortConfig, SortDirection } from "@/app/lib/types";
import { percentage_format, number_format } from "@/app/lib/data_load";
import { useLanguage } from "@/app/lib/i18n/LanguageContext";

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  format?: (value: unknown, row: T) => string;
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

interface ReliabilityTableProps<T extends object> {
  data: T[];
  columns: Column<T>[];
  defaultSortKey?: keyof T;
  defaultSortDirection?: SortDirection;
  filterKey?: keyof T;
  filterPlaceholder?: string;
  emptyMessage?: string;
  /** External search value to control filtering from parent */
  externalSearchValue?: string;
  /** If true, the internal search input is hidden */
  hideSearchInput?: boolean;
  // Pagination
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

// Ensure SortConfig uses keyof T for type safety
interface TableSortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

export function ReliabilityTable<T extends object>({
  data,
  columns,
  defaultSortKey,
  defaultSortDirection = "asc",
  filterKey,
  filterPlaceholder = "Filter...",
  emptyMessage = "No data available",
  externalSearchValue = "",
  hideSearchInput = false,
  pageSize,
  currentPage,
  onPageChange,
}: ReliabilityTableProps<T>) {
  const { t } = useLanguage();
  const [sortConfig, setSortConfig] = useState<TableSortConfig<T>>({
    key: defaultSortKey || columns[0].key,
    direction: defaultSortDirection,
  });

  // Internal search state only used if external search is not provided and hideSearchInput is false
  const [internalSearch, setInternalSearch] = useState("");
  const searchValue = hideSearchInput ? externalSearchValue : internalSearch;

  // Handle translation for header labels if they match our translation keys
  const getHeaderLabel = (label: string) => {
    // Check if the label contains newline (used in statistics_config)
    const normalizedLabel = label.replace(/\n/g, ' ');

    // Map internal labels to translation keys
    const translationMap: Record<string, string> = {
      'Rank': 'common.rank',
      'Brand': 'common.brand',
      'Model': 'common.model',
      'Defects / Year': 'common.defects_per_year',
      'Defects / Inspection': 'common.defects_per_inspection',
    };

    if (translationMap[normalizedLabel]) {
      return t(translationMap[normalizedLabel]);
    }

    return label;
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Filter
    if (filterKey && searchValue.trim() !== "") {
      const searchTerms = searchValue.toLowerCase().split(" ").filter(term => term.length > 0);
      result = result.filter((row) => {
        const val = row[filterKey];
        if (typeof val === "string") {
          const rowVal = val.toLowerCase();
          // Check if all search terms are present in the row value
          return searchTerms.every(term => rowVal.includes(term));
        }
        return false;
      });
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortConfig.key] as any;
      const bVal = b[sortConfig.key] as any;

      if (aVal === bVal) return 0;

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) return sortConfig.direction === "asc" ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortConfig.direction === "asc" ? -1 : 1;

      // Type-safe comparison
      const aCmp = aVal as string | number;
      const bCmp = bVal as string | number;

      if (aCmp < bCmp) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aCmp > bCmp) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });

    return result;
  }, [data, filterKey, searchValue, sortConfig]);

  // Apply pagination if pageSize is provided
  const isPaginated = pageSize !== undefined;
  const paginatedData = useMemo(() => {
    if (!isPaginated) return filteredAndSortedData;

    const page = currentPage || 1;
    const startIndex = (page - 1) * pageSize;
    return filteredAndSortedData.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedData, isPaginated, pageSize, currentPage]);

  const totalPages = isPaginated ? Math.ceil(filteredAndSortedData.length / pageSize) : 1;

  function sort_toggle(key: keyof T) {
    let direction: SortDirection = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    // Reset to page 1 on sort change if paginated
    if (isPaginated && onPageChange) {
      onPageChange(1);
    }
  }

  function sort_indicator_render(key: keyof T) {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    );
  }

  function header_content_class(headerClassName?: string, sortable?: boolean) {
    const isRightAligned = headerClassName?.split(/\s+/).includes("text-right");
    const alignClass = isRightAligned ? "flex-row-reverse" : "";
    const cursorClass = sortable !== false ? "cursor-pointer group" : "";
    return `flex items-center gap-1.5 ${alignClass} ${cursorClass}`;
  }

  function cell_value_format(
    row: T,
    key: keyof T,
    format?: (val: unknown, row: T) => string
  ) {
    const value = row[key];
    if (format) {
      return format(value, row);
    }
    if (typeof value === "number") {
      // Default number formatting heuristic:
      // If it looks like a year, display as integer
      if (value >= 1900 && value <= 2100 && Number.isInteger(value)) {
        return value.toString();
      }
      // If it's a small decimal (likely a percentage or rate), format with 2 decimals
      if (value < 100 && !Number.isInteger(value)) {
        return percentage_format(value);
      }
      // Otherwise, standard number formatting
      return number_format(value);
    }
    return String(value ?? "");
  }

  return (
    <div className="w-full">
      {/* Internal Filter Input */}
      {!hideSearchInput && filterKey && (
        <div className="mb-4">
          <input
            type="text"
            placeholder={filterPlaceholder}
            value={internalSearch}
            onChange={(e) => {
              setInternalSearch(e.target.value);
              // Reset to page 1 on search
              if (isPaginated && onPageChange) {
                onPageChange(1);
              }
            }}
            className="w-full max-w-sm px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={`px-4 sm:px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap select-none ${col.headerClassName || ""}`}
                    onClick={() => col.sortable !== false && sort_toggle(col.key)}
                  >
                    <div className={header_content_class(col.headerClassName, col.sortable)}>
                      <span className="whitespace-pre-line leading-tight">{getHeaderLabel(col.label)}</span>
                      {col.sortable !== false && sort_indicator_render(col.key)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedData.length > 0 ? (
                paginatedData.map((row, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={`px-4 sm:px-6 py-4 text-sm whitespace-nowrap ${col.cellClassName || ""} ${col.className || ""}`}
                      >
                        {cell_value_format(row, col.key, col.format)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {isPaginated && totalPages > 1 && onPageChange && (
        <div className="mt-4 flex items-center justify-between px-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(currentPage! - 1) * pageSize! + 1} to {Math.min(currentPage! * pageSize!, filteredAndSortedData.length)} of {filteredAndSortedData.length} entries
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage! - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center px-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage! + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
