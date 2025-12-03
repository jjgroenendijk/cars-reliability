"use client";

import type { RdwInspection, RdwDefect } from "@/app/lib/types";

interface InspectionsCardProps {
  inspections: RdwInspection[];
  defects: RdwDefect[];
  defect_descriptions: Map<string, string>;
}

function date_format(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}-${month}-${year}`;
}

export function InspectionsCard({
  inspections,
  defects,
  defect_descriptions,
}: InspectionsCardProps) {
  // Group defects by inspection date
  const defects_by_date = (date: string): RdwDefect[] => {
    return defects.filter((d) => d.meld_datum_door_keuringsinstantie === date);
  };

  if (inspections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          APK History
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          No APK inspection data available
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          APK History
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {inspections.length} inspection{inspections.length !== 1 ? "s" : ""} found
        </p>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {inspections.map((inspection, index) => {
          const inspection_defects = defects_by_date(
            inspection.meld_datum_door_keuringsinstantie
          );
          const has_defects = inspection_defects.length > 0;

          return (
            <div key={index} className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {date_format(inspection.meld_datum_door_keuringsinstantie)}
                  </span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {inspection.meld_tijd_door_keuringsinstantie}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      inspection.soort_meldingomschrijving?.includes("Goedgekeurd")
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                    }`}
                  >
                    {inspection.soort_meldingomschrijving ?? "Unknown"}
                  </span>
                  {inspection.km_stand && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {parseInt(inspection.km_stand).toLocaleString("nl-NL")} km
                    </span>
                  )}
                </div>
              </div>

              {has_defects && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Defects found:
                  </p>
                  <ul className="space-y-1">
                    {inspection_defects.map((defect, defect_index) => (
                      <li
                        key={defect_index}
                        className="text-sm text-gray-600 dark:text-gray-400 pl-4 border-l-2 border-gray-200 dark:border-gray-600"
                      >
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-500 mr-2">
                          [{defect.gebrek_identificatie}]
                        </span>
                        {defect_descriptions.get(defect.gebrek_identificatie) ??
                          "No description available"}
                        {parseInt(defect.aantal_gebreken) > 1 && (
                          <span className="ml-1 text-gray-400 dark:text-gray-500">
                            (x{defect.aantal_gebreken})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
