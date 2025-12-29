"use client";

import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortConfig, SortDirection } from "@/app/lib/types";
import { percentage_format, number_format } from "@/app/lib/data_load";

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

export function ReliabilityTable<T extends object>({
  data,
  columns,
  defaultSortKey,
  defaultSortDirection = "asc",
  filterKey,
  filterPlaceholder = "Zoeken...",
  emptyMessage = "Geen gegevens beschikbaar",
  externalSearchValue,
  hideSearchInput = false,
  pageSize,
  currentPage = 1,
  onPageChange,
}: ReliabilityTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultSortKey ? String(defaultSortKey) : "",
    direction: defaultSortDirection,
  });
  const [internalFilterValue, setInternalFilterValue] = useState("");

  const filterValue = externalSearchValue ?? internalFilterValue;

  const sortedAndFilteredData = useMemo(() => {
    let result = [...data];

    // Apply filter if filterKey is set and filterValue is not empty
    if (filterKey && filterValue) {
      const searchTerm = filterValue.toLowerCase();
      result = result.filter((row) => {
        const value = row[filterKey];
        if (typeof value === "string") {
          return value.toLowerCase().includes(searchTerm);
        }
        return false;
      });
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        let comparison = 0;
        if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue, "nl-NL");
        }

        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [data, sortConfig, filterKey, filterValue]);

  // Pagination logic
  const totalPages = pageSize ? Math.ceil(sortedAndFilteredData.length / pageSize) : 1;
  const paginatedData = pageSize
    ? sortedAndFilteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedAndFilteredData;

  function sort_toggle(key: string) {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function sort_indicator_render(key: string) {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-1" />;
    }
    return (
      <span className="ml-1">
        {sortConfig.direction === "asc" ? (
          <ArrowUp className="w-4 h-4" aria-label="Sorted ascending" />
        ) : (
          <ArrowDown className="w-4 h-4" aria-label="Sorted descending" />
        )}
      </span>
    );
  }

  function cell_value_format(
    column: Column<T>,
    value: unknown,
    row: T
  ): string {
    if (column.format) {
      return column.format(value, row);
    }
    if (typeof value === "number") {
      // Auto-detect percentage fields
      if (
        String(column.key).includes("rate") ||
        String(column.key).includes("percentage")
      ) {
        return percentage_format(value);
      }
      // Format large numbers
      if (value >= 1000) {
        return number_format(value);
      }
      // Format decimal numbers
      if (!Number.isInteger(value)) {
        return value.toFixed(2);
      }
      return String(value);
    }
    return String(value ?? "-");
  }



  return (
    <div className="w-full">
      {filterKey && !hideSearchInput && (
        <div className="mb-4">
          <input
            type="text"
            value={internalFilterValue}
            onChange={(e) => setInternalFilterValue(e.target.value)}
            placeholder={filterPlaceholder}
            className="w-full sm:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      )}



      <div className="overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-auto w-full">
          <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={`
                    px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 tracking-wider whitespace-nowrap
                    ${column.sortable !== false ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none transition-colors" : ""}
                    ${column.className ?? ""}
                    ${column.headerClassName ?? ""}
                  `}
                  onClick={() =>
                    column.sortable !== false && sort_toggle(String(column.key))
                  }
                >
                  <span className="flex items-center gap-1">
                    <span className="whitespace-pre-line leading-tight">
                      {column.label}
                    </span>
                    {column.sortable !== false &&
                      sort_indicator_render(String(column.key))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`px-3 py-2 text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap ${column.className ?? ""} ${column.cellClassName ?? ""}`}
                    >
                      {cell_value_format(column, row[column.key], row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>


    </div>
  );
}

// Preset formatters for common column types
export const COLUMN_FORMATTERS = {
  percentage: (value: unknown): string => {
    if (typeof value === "number") {
      return percentage_format(value);
    }
    return String(value ?? "-");
  },
  number: (value: unknown): string => {
    if (typeof value === "number") {
      return number_format(value);
    }
    return String(value ?? "-");
  },
  decimal: (value: unknown): string => {
    if (typeof value === "number") {
      return value.toFixed(2);
    }
    return String(value ?? "-");
  },
};
