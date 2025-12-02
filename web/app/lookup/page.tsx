"use client";

import { useState } from "react";
import { useVehicleLookup } from "./hooks/vehicle_lookup_use";
import { VehicleInfoCard } from "./components/vehicle_info_card";
import { InspectionsCard } from "./components/inspections_card";

export default function LookupPage() {
  const [license_plate, setLicensePlate] = useState("");
  const { state, vehicle_lookup } = useVehicleLookup(license_plate);

  const form_submit = (e: React.FormEvent) => {
    e.preventDefault();
    vehicle_lookup();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          License Plate Lookup
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Search vehicle information and MOT history by license plate.
          Data is fetched live from the RDW.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={form_submit} className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-grow">
            <label htmlFor="license-plate" className="sr-only">
              License Plate
            </label>
            <input
              id="license-plate"
              type="text"
              value={license_plate}
              onChange={(e) => setLicensePlate(e.target.value)}
              placeholder="E.g., AB123C or AB-123-C"
              className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500
                       uppercase"
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>
          <button
            type="submit"
            disabled={state.loading}
            className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg 
                     hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed
                     transition-colors"
          >
            {state.loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {state.error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{state.error}</p>
        </div>
      )}

      {/* Results */}
      {state.vehicle && (
        <div className="space-y-6">
          {/* Vehicle Info */}
          <VehicleInfoCard vehicle={state.vehicle} />

          {/* Inspections */}
          <InspectionsCard
            inspections={state.inspections}
            defects={state.defects}
            defect_descriptions={state.defect_descriptions}
          />
        </div>
      )}

      {/* Empty State */}
      {state.searched && !state.vehicle && !state.error && !state.loading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No results found
        </div>
      )}

      {/* Data attribution */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Data is fetched live from{" "}
          <a
            href="https://opendata.rdw.nl/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            RDW Open Data
          </a>
          . This website is not affiliated with the RDW.
        </p>
      </div>
    </div>
  );
}
