/**
 * TypeScript interfaces for Dutch Car Reliability data structures.
 * These types match the JSON output from the data processing pipeline (scripts/data_process.py).
 */

/** Per-year statistics for age-based filtering */
export interface PerYearStats {
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
  vehicle_type_group: string;
  primary_fuel: string;
  avg_catalog_price?: number | null;
  vehicle_count: number;
  total_inspections: number;
  total_defects: number;
  /** Count of inspections with a non-zero defect count (defect_count > 0) */
  inspections_with_defects?: number;
  total_reliability_defects?: number;
  total_vehicle_years: number;
  avg_defects_per_inspection: number | null;
  std_defects_per_inspection?: number | null;
  avg_age_years: number | null;
  defects_per_vehicle_year: number | null;
  std_defects_per_vehicle_year?: number | null;
  sum_defects_per_vehicle_year_rates?: number | null;
  sum_sq_defects_per_vehicle_year_rates?: number | null;
  sum_sq_defect_counts?: number | null;
  sum_catalog_price?: number | null;
  count_with_price?: number;
  reliability_defects_per_vehicle_year: number | null;
  fuel_breakdown: FuelBreakdown;
  /** Per-year statistics keyed by age (e.g., "4", "5", "10") */
  per_year_stats: Record<string, PerYearStats>;
}

export interface ModelStats {
  merk: string;
  handelsbenaming: string;
  vehicle_type_group: string;
  primary_fuel: string;
  avg_catalog_price?: number | null;
  vehicle_count: number;
  total_inspections: number;
  total_defects: number;
  total_reliability_defects?: number;
  total_vehicle_years: number;
  avg_defects_per_inspection: number | null;
  std_defects_per_inspection?: number | null;
  avg_age_years: number | null;
  defects_per_vehicle_year: number | null;
  std_defects_per_vehicle_year?: number | null;
  sum_defects_per_vehicle_year_rates?: number | null;
  sum_sq_defects_per_vehicle_year_rates?: number | null;
  sum_sq_defect_counts?: number | null;
  sum_catalog_price?: number | null;
  count_with_price?: number;
  reliability_defects_per_vehicle_year: number | null;
  fuel_breakdown: FuelBreakdown;
  /** Per-year statistics keyed by age (e.g., "4", "5", "10") */
  per_year_stats: Record<string, PerYearStats>;
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

export interface Range {
  min: number;
  max: number;
}

export interface FleetAgeStat {
  age_at_inspection: number;
  total_inspections: number;
  total_defects: number;
  vehicle_count: number;
  avg_defects_per_inspection: number;
}

export interface YearlyTrendEntry {
  insp_year: number;
  inspections: number;
  total_defects: number;
  avg_defects_per_inspection: number;
}

export interface Metadata {
  generated_at: string;
  ranges?: {
    price: Range;
    fleet: Range;
    age: Range;
    inspections: Range;
  };
  fuel_types?: string[];
  age_range?: {
    min: number;
    max: number;
  };
  counts?: {
    consumer_vehicles: number;
    commercial_vehicles: number;
    vehicles_processed?: number;
    total_inspections?: number;
    total_defects?: number;
    brands?: number;
    models?: number;
  };
  stats?: {
    zero_defect_rate: number;
    yearly_trend: YearlyTrendEntry[];
    fleet_age_stats: FleetAgeStat[];
  };
}


