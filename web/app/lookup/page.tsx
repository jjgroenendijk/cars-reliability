"use client";

import { useState, useCallback } from "react";
import type {
  RdwVehicle,
  RdwInspection,
  RdwDefect,
  RdwDefectDescription,
} from "@/app/lib/types";

// RDW API endpoints
const RDW_API_BASE = "https://opendata.rdw.nl/resource";
const ENDPOINTS = {
  vehicles: `${RDW_API_BASE}/m9d7-ebf2.json`,
  inspections: `${RDW_API_BASE}/sgfe-77wx.json`,
  defects: `${RDW_API_BASE}/a34c-vvps.json`,
  defect_descriptions: `${RDW_API_BASE}/hx2c-gt7k.json`,
};

interface LookupState {
  vehicle: RdwVehicle | null;
  inspections: RdwInspection[];
  defects: RdwDefect[];
  defectDescriptions: Map<string, string>;
  loading: boolean;
  error: string | null;
  searched: boolean;
}

export default function LookupPage() {
  const [licensePlate, setLicensePlate] = useState("");
  const [state, setState] = useState<LookupState>({
    vehicle: null,
    inspections: [],
    defects: [],
    defectDescriptions: new Map(),
    loading: false,
    error: null,
    searched: false,
  });

  const license_plate_format = useCallback((input: string): string => {
    // Remove all non-alphanumeric characters and convert to uppercase
    return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }, []);

  const vehicle_lookup = useCallback(async () => {
    const formatted = license_plate_format(licensePlate);

    if (!formatted || formatted.length < 4) {
      setState((prev) => ({
        ...prev,
        error: "Voer een geldig kenteken in",
        searched: true,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      vehicle: null,
      inspections: [],
      defects: [],
      defectDescriptions: new Map(),
    }));

    try {
      // Fetch vehicle data
      const vehicleResponse = await fetch(
        `${ENDPOINTS.vehicles}?kenteken=${formatted}`
      );

      if (!vehicleResponse.ok) {
        throw new Error("Kon voertuiggegevens niet ophalen");
      }

      const vehicles: RdwVehicle[] = await vehicleResponse.json();

      if (vehicles.length === 0) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Geen voertuig gevonden met dit kenteken",
          searched: true,
        }));
        return;
      }

      const vehicle = vehicles[0];

      // Fetch inspections and defects in parallel
      const [inspectionsResponse, defectsResponse] = await Promise.all([
        fetch(`${ENDPOINTS.inspections}?kenteken=${formatted}&$order=meld_datum_door_keuringsinstantie DESC&$limit=50`),
        fetch(`${ENDPOINTS.defects}?kenteken=${formatted}&$limit=100`),
      ]);

      let inspections: RdwInspection[] = [];
      let defects: RdwDefect[] = [];

      if (inspectionsResponse.ok) {
        inspections = await inspectionsResponse.json();
      }

      if (defectsResponse.ok) {
        defects = await defectsResponse.json();
      }

      // Fetch defect descriptions for unique defect IDs
      const uniqueDefectIds = [...new Set(defects.map((d) => d.gebrek_identificatie))];
      const defectDescriptions = new Map<string, string>();

      if (uniqueDefectIds.length > 0) {
        // Batch fetch defect descriptions (max 50 at a time due to URL length limits)
        const batches = [];
        for (let i = 0; i < uniqueDefectIds.length; i += 50) {
          batches.push(uniqueDefectIds.slice(i, i + 50));
        }

        for (const batch of batches) {
          const query = batch.map((id) => `gebrek_identificatie='${id}'`).join(" OR ");
          const descResponse = await fetch(
            `${ENDPOINTS.defect_descriptions}?$where=${encodeURIComponent(query)}`
          );

          if (descResponse.ok) {
            const descriptions: RdwDefectDescription[] = await descResponse.json();
            descriptions.forEach((desc) => {
              defectDescriptions.set(desc.gebrek_identificatie, desc.gebrek_omschrijving);
            });
          }
        }
      }

      setState({
        vehicle,
        inspections,
        defects,
        defectDescriptions,
        loading: false,
        error: null,
        searched: true,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Er is een fout opgetreden",
        searched: true,
      }));
    }
  }, [licensePlate, license_plate_format]);

  const form_submit = (e: React.FormEvent) => {
    e.preventDefault();
    vehicle_lookup();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Kenteken opzoeken
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Zoek voertuiginformatie en APK-geschiedenis op basis van kenteken.
          De gegevens worden live opgehaald bij de RDW.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={form_submit} className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-grow">
            <label htmlFor="license-plate" className="sr-only">
              Kenteken
            </label>
            <input
              id="license-plate"
              type="text"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              placeholder="Bijv. AB123C of AB-123-C"
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
            {state.loading ? "Zoeken..." : "Zoeken"}
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
            defectDescriptions={state.defectDescriptions}
          />
        </div>
      )}

      {/* Empty State */}
      {state.searched && !state.vehicle && !state.error && !state.loading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Geen resultaten gevonden
        </div>
      )}

      {/* Data attribution */}
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          De gegevens worden live opgehaald bij{" "}
          <a
            href="https://opendata.rdw.nl/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            RDW Open Data
          </a>
          . Deze website is niet gelieerd aan de RDW.
        </p>
      </div>
    </div>
  );
}

interface VehicleInfoCardProps {
  vehicle: RdwVehicle;
}

function VehicleInfoCard({ vehicle }: VehicleInfoCardProps) {
  const date_format = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {vehicle.merk} {vehicle.handelsbenaming}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 font-mono">
          {vehicle.kenteken}
        </p>
      </div>

      <div className="p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Eerste toelating" value={date_format(vehicle.datum_eerste_toelating)} />
          <InfoRow label="Tenaamstelling" value={date_format(vehicle.datum_tenaamstelling)} />
          <InfoRow label="APK vervaldatum" value={date_format(vehicle.vervaldatum_apk)} />
          <InfoRow label="Kleur" value={vehicle.eerste_kleur} />
          <InfoRow label="Aantal deuren" value={vehicle.aantal_deuren} />
          <InfoRow label="Aantal zitplaatsen" value={vehicle.aantal_zitplaatsen} />
          <InfoRow
            label="Cilinderinhoud"
            value={vehicle.cilinderinhoud ? `${vehicle.cilinderinhoud} cc` : undefined}
          />
          <InfoRow
            label="Massa leeg"
            value={vehicle.massa_ledig_voertuig ? `${vehicle.massa_ledig_voertuig} kg` : undefined}
          />
          <InfoRow label="WAM verzekerd" value={vehicle.wam_verzekerd === "Ja" ? "Ja" : "Nee"} />
          <InfoRow
            label="Catalogusprijs"
            value={
              vehicle.catalogusprijs
                ? `EUR ${parseInt(vehicle.catalogusprijs).toLocaleString("nl-NL")}`
                : undefined
            }
          />
        </dl>
      </div>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string | undefined;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div>
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-white font-medium">
        {value ?? "-"}
      </dd>
    </div>
  );
}

interface InspectionsCardProps {
  inspections: RdwInspection[];
  defects: RdwDefect[];
  defectDescriptions: Map<string, string>;
}

function InspectionsCard({
  inspections,
  defects,
  defectDescriptions,
}: InspectionsCardProps) {
  const date_format = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}-${month}-${year}`;
  };

  // Group defects by inspection date
  const defects_by_date = (date: string): RdwDefect[] => {
    return defects.filter((d) => d.meld_datum_door_keuringsinstantie === date);
  };

  if (inspections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          APK-geschiedenis
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Geen APK-keuringsgegevens beschikbaar
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          APK-geschiedenis
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {inspections.length} keuring{inspections.length !== 1 ? "en" : ""} gevonden
        </p>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {inspections.map((inspection, index) => {
          const inspectionDefects = defects_by_date(
            inspection.meld_datum_door_keuringsinstantie
          );
          const hasDefects = inspectionDefects.length > 0;

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
                    {inspection.soort_meldingomschrijving ?? "Onbekend"}
                  </span>
                  {inspection.km_stand && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {parseInt(inspection.km_stand).toLocaleString("nl-NL")} km
                    </span>
                  )}
                </div>
              </div>

              {hasDefects && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Geconstateerde gebreken:
                  </p>
                  <ul className="space-y-1">
                    {inspectionDefects.map((defect, defectIndex) => (
                      <li
                        key={defectIndex}
                        className="text-sm text-gray-600 dark:text-gray-400 pl-4 border-l-2 border-gray-200 dark:border-gray-600"
                      >
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-500 mr-2">
                          [{defect.gebrek_identificatie}]
                        </span>
                        {defectDescriptions.get(defect.gebrek_identificatie) ??
                          "Geen omschrijving beschikbaar"}
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
