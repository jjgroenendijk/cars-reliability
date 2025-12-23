"use client";

import { useState, useMemo } from "react";
import type { SortConfig, SortDirection } from "@/app/lib/types";
import { percentage_format, number_format } from "@/app/lib/data_load";

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  format?: (value: unknown, row: T) => string;
  className?: string;
}

interface ReliabilityTableProps<T extends object> {
  data: T[];
  columns: Column<T>[];
  defaultSortKey?: keyof T;
  defaultSortDirection?: SortDirection;
  filterKey?: keyof T;
  filterPlaceholder?: string;
  emptyMessage?: string;
}

export function ReliabilityTable<T extends object>({
  data,
  columns,
  defaultSortKey,
  defaultSortDirection = "asc",
  filterKey,
  filterPlaceholder = "Zoeken...",
  emptyMessage = "Geen gegevens beschikbaar",
}: ReliabilityTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultSortKey ? String(defaultSortKey) : "",
    direction: defaultSortDirection,
  });
  const [filterValue, setFilterValue] = useState("");

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

  function sort_toggle(key: string) {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function sort_indicator_render(key: string) {
    if (sortConfig.key !== key) {
      return <span className="text-gray-300 dark:text-gray-600 ml-1">-</span>;
    }
    return (
      <span className="ml-1">
        {sortConfig.direction === "asc" ? (
          <span aria-label="Sorted ascending">[A]</span>
        ) : (
          <span aria-label="Sorted descending">[Z]</span>
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
      {filterKey && (
        <div className="mb-4">
          <input
            type="text"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder={filterPlaceholder}
            className="w-full sm:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={`
                    px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 tracking-wider
                    ${column.sortable !== false ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none" : ""}
                    ${column.className ?? ""}
                  `}
                  onClick={() =>
                    column.sortable !== false && sort_toggle(String(column.key))
                  }
                >
                  <span className="flex items-center">
                    {column.label}
                    {column.sortable !== false &&
                      sort_indicator_render(String(column.key))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedAndFilteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedAndFilteredData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap ${column.className ?? ""}`}
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

      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {sortedAndFilteredData.length} of {data.length} results
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
