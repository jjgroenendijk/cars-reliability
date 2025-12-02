/**
 * TypeScript interfaces for Dutch Car Reliability data structures.
 * These types match the JSON output from the data processing pipeline.
 */

export interface BrandStats {
  brand: string;
  total_inspections: number;
  total_defects: number;
  defect_rate: number;
  avg_defects_per_inspection: number;
  model_count: number;
  oldest_year: number;
  newest_year: number;
}

export interface ModelStats {
  brand: string;
  model: string;
  total_inspections: number;
  total_defects: number;
  defect_rate: number;
  avg_defects_per_inspection: number;
  oldest_year: number;
  newest_year: number;
  sample_size_category: "small" | "medium" | "large";
}

export interface RankingEntry {
  rank: number;
  brand: string;
  model?: string;
  defect_rate: number;
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
