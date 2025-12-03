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

export interface LookupState {
  vehicle: RdwVehicle | null;
  inspections: RdwInspection[];
  defects: RdwDefect[];
  defect_descriptions: Map<string, string>;
  loading: boolean;
  error: string | null;
  searched: boolean;
}

const INITIAL_STATE: LookupState = {
  vehicle: null,
  inspections: [],
  defects: [],
  defect_descriptions: new Map(),
  loading: false,
  error: null,
  searched: false,
};

export function useVehicleLookup(license_plate: string) {
  const [state, setState] = useState<LookupState>(INITIAL_STATE);

  const license_plate_format = useCallback((input: string): string => {
    // Remove all non-alphanumeric characters and convert to uppercase
    return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }, []);

  const vehicle_lookup = useCallback(async () => {
    const formatted = license_plate_format(license_plate);

    if (!formatted || formatted.length < 4) {
      setState((prev) => ({
        ...prev,
        error: "Please enter a valid license plate",
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
      defect_descriptions: new Map(),
    }));

    try {
      // Fetch vehicle data
      const vehicle_response = await fetch(
        `${ENDPOINTS.vehicles}?kenteken=${formatted}`
      );

      if (!vehicle_response.ok) {
        throw new Error("Could not fetch vehicle data");
      }

      const vehicles: RdwVehicle[] = await vehicle_response.json();

      if (vehicles.length === 0) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "No vehicle found with this license plate",
          searched: true,
        }));
        return;
      }

      const vehicle = vehicles[0];

      // Fetch inspections and defects in parallel
      const [inspections_response, defects_response] = await Promise.all([
        fetch(`${ENDPOINTS.inspections}?kenteken=${formatted}&$order=meld_datum_door_keuringsinstantie DESC&$limit=50`),
        fetch(`${ENDPOINTS.defects}?kenteken=${formatted}&$limit=100`),
      ]);

      let inspections: RdwInspection[] = [];
      let defects: RdwDefect[] = [];

      if (inspections_response.ok) {
        inspections = await inspections_response.json();
      }

      if (defects_response.ok) {
        defects = await defects_response.json();
      }

      // Fetch defect descriptions for unique defect IDs
      const unique_defect_ids = [...new Set(defects.map((d) => d.gebrek_identificatie))];
      const defect_descriptions = new Map<string, string>();

      if (unique_defect_ids.length > 0) {
        // Batch fetch defect descriptions (max 50 at a time due to URL length limits)
        const batches = [];
        for (let i = 0; i < unique_defect_ids.length; i += 50) {
          batches.push(unique_defect_ids.slice(i, i + 50));
        }

        for (const batch of batches) {
          const query = batch.map((id) => `gebrek_identificatie='${id}'`).join(" OR ");
          const desc_response = await fetch(
            `${ENDPOINTS.defect_descriptions}?$where=${encodeURIComponent(query)}`
          );

          if (desc_response.ok) {
            const descriptions: RdwDefectDescription[] = await desc_response.json();
            descriptions.forEach((desc) => {
              defect_descriptions.set(desc.gebrek_identificatie, desc.gebrek_omschrijving);
            });
          }
        }
      }

      setState({
        vehicle,
        inspections,
        defects,
        defect_descriptions,
        loading: false,
        error: null,
        searched: true,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "An error occurred",
        searched: true,
      }));
    }
  }, [license_plate, license_plate_format]);

  return { state, vehicle_lookup };
}
