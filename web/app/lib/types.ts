/**
 * TypeScript interfaces for Dutch Car Reliability data structures.
 * These types match the JSON output from the data processing pipeline (scripts/data_process.py).
 */

/** Age bracket statistics for a specific age range */
export interface AgeBracketStats {
  vehicle_count: number;
  total_inspections: number;
  total_defects: number;
  avg_defects_per_inspection: number;
}

/** Fuel type breakdown counts */
export interface FuelBreakdown {
  Benzine: number;
  Diesel: number;
  Elektriciteit: number;
  LPG: number;
  other: number;
}

export interface BrandStats {
  merk: string;
  vehicle_count: number;
  total_inspections: number;
  total_defects: number;
  total_reliability_defects?: number;
  total_vehicle_years: number;
  avg_defects_per_inspection: number | null;
  avg_age_years: number | null;
  defects_per_vehicle_year: number | null;
  reliability_defects_per_vehicle_year: number | null;
  fuel_breakdown: FuelBreakdown;
  age_brackets: {
    "4_7": AgeBracketStats | null;
    "8_12": AgeBracketStats | null;
    "13_20": AgeBracketStats | null;
    "5_15": AgeBracketStats | null;
  };
}

export interface ModelStats {
  merk: string;
  handelsbenaming: string;
  vehicle_count: number;
  total_inspections: number;
  total_defects: number;
  total_reliability_defects?: number;
  total_vehicle_years: number;
  avg_defects_per_inspection: number | null;
  avg_age_years: number | null;
  defects_per_vehicle_year: number | null;
  reliability_defects_per_vehicle_year: number | null;
  fuel_breakdown: FuelBreakdown;
  age_brackets: {
    "4_7": AgeBracketStats | null;
    "8_12": AgeBracketStats | null;
    "13_20": AgeBracketStats | null;
    "5_15": AgeBracketStats | null;
  };
}

export interface RankingEntry {
  rank: number;
  merk: string;
  handelsbenaming?: string;
  defects_per_vehicle_year?: number;
  total_inspections: number;
}

export interface Rankings {
  most_reliable_brands: RankingEntry[];
  least_reliable_brands: RankingEntry[];
  most_reliable_models: RankingEntry[];
  least_reliable_models: RankingEntry[];
  generated_at: string;
}

export interface DataSet {
  brand_stats: BrandStats[];
  model_stats: ModelStats[];
  rankings: Rankings;
  generated_at: string;
}

/** Defect breakdown: maps defect_code -> count for a brand or model */
export type DefectBreakdown = Record<string, number>;

/** All defect breakdowns indexed by brand name or model key */
export type DefectBreakdownIndex = Record<string, DefectBreakdown>;

/** Defect code descriptions for UI display */
export type DefectCodeIndex = Record<string, string>;

/** Defect filter mode */
export type DefectFilterMode = "all" | "reliability" | "custom";

/** Single defect type statistics */
export interface DefectTypeStat {
  defect_code: string;
  defect_description: string;
  count: number;
  percentage: number;
  is_reliability?: boolean;
  category?: 'reliability' | 'wear_and_tear';
}

/** Defect statistics for the defects page */
export interface DefectStats {
  total_defects: number;
  total_inspections: number;
  avg_defects_per_inspection: number;
  top_defects: DefectTypeStat[];
  generated_at: string;
}

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

// RDW API types for license plate lookup
export interface RdwVehicle {
  kenteken: string;
  voertuigsoort: string;
  merk: string;
  handelsbenaming: string;
  datum_eerste_toelating: string;
  datum_tenaamstelling: string;
  bruto_bpm: string;
  catalogusprijs: string;
  cilinderinhoud: string;
  aantal_cilinders: string;
  massa_ledig_voertuig: string;
  toegestane_maximum_massa_voertuig: string;
  zuinigheidsclassificatie: string;
  eerste_kleur: string;
  tweede_kleur: string;
  aantal_zitplaatsen: string;
  aantal_deuren: string;
  aantal_wielen: string;
  afstand_hart_koppeling_tot_achterzijde_voertuig: string;
  afstand_voorzijde_voertuig_tot_hart_koppeling: string;
  lengte: string;
  breedte: string;
  europese_voertuigcategorie: string;
  technische_max_massa_voertuig: string;
  vervaldatum_apk: string;
  wacht_op_keuren: string;
  wam_verzekerd: string;
  maximale_constructiesnelheid: string;
  api_gekentekende_voertuigen_assen: string;
  api_gekentekende_voertuigen_brandstof: string;
  api_gekentekende_voertuigen_carrosserie: string;
  api_gekentekende_voertuigen_carrosserie_specifiek: string;
  api_gekentekende_voertuigen_voertuigklasse: string;
}

export interface RdwInspection {
  kenteken: string;
  meld_datum_door_keuringsinstantie: string;
  meld_tijd_door_keuringsinstantie: string;
  soort_meldingomschrijving: string;
  km_stand?: string;
}

export interface RdwDefect {
  kenteken: string;
  meld_datum_door_keuringsinstantie: string;
  gebrek_identificatie: string;
  aantal_gebreken: string;
}

export interface RdwDefectDescription {
  gebrek_identificatie: string;
  gebrek_omschrijving: string;
}

export interface VehicleLookupResult {
  vehicle: RdwVehicle | null;
  inspections: RdwInspection[];
  defects: RdwDefect[];
  defect_descriptions: Map<string, string>;
  error?: string;
}
