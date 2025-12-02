"use client";

import { FuelBreakdown } from "../lib/types";

interface FuelBreakdownProps {
  fuel_breakdown: FuelBreakdown;
  compact?: boolean;
}

const FUEL_LABELS: Record<keyof FuelBreakdown, string> = {
  Benzine: "Petrol",
  Diesel: "Diesel",
  Elektriciteit: "Electric",
  LPG: "LPG",
  other: "Other",
};

const FUEL_COLORS: Record<keyof FuelBreakdown, string> = {
  Benzine: "bg-blue-500",
  Diesel: "bg-gray-600",
  Elektriciteit: "bg-green-500",
  LPG: "bg-orange-500",
  other: "bg-purple-500",
};

function fuel_total_calculate(breakdown: FuelBreakdown): number {
  return (
    breakdown.Benzine +
    breakdown.Diesel +
    breakdown.Elektriciteit +
    breakdown.LPG +
    breakdown.other
  );
}

function fuel_percentage_calculate(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export function FuelBreakdownBar({ fuel_breakdown, compact }: FuelBreakdownProps) {
  const total = fuel_total_calculate(fuel_breakdown);
  if (total === 0) return null;

  const fuel_keys: (keyof FuelBreakdown)[] = [
    "Benzine",
    "Diesel",
    "Elektriciteit",
    "LPG",
    "other",
  ];

  const active_fuels = fuel_keys.filter((key) => fuel_breakdown[key] > 0);

  if (compact) {
    return (
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
        {active_fuels.map((key) => {
          const pct = fuel_percentage_calculate(fuel_breakdown[key], total);
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className={`${FUEL_COLORS[key]} h-full`}
              style={{ width: `${pct}%` }}
              title={`${FUEL_LABELS[key]}: ${pct}%`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-200">
        {active_fuels.map((key) => {
          const pct = fuel_percentage_calculate(fuel_breakdown[key], total);
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className={`${FUEL_COLORS[key]} h-full`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {active_fuels.map((key) => {
          const pct = fuel_percentage_calculate(fuel_breakdown[key], total);
          return (
            <div key={key} className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-full ${FUEL_COLORS[key]}`} />
              <span>
                {FUEL_LABELS[key]}: {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
