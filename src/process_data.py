"""
Process RDW data to calculate reliability metrics.

Metrics:
1. Defects per inspection - Average number of defects found per APK inspection
2. Issue types per inspection - Average number of different defect categories
3. Vehicle age at inspection - Average age of vehicles in years
"""

import json
from pathlib import Path
from datetime import datetime

import pandas as pd

DATA_DIR = Path(__file__).parent.parent / "data"


def load_metadata() -> dict:
    """Load fetch metadata if available."""
    metadata_path = DATA_DIR / "fetch_metadata.json"
    if metadata_path.exists():
        with open(metadata_path) as f:
            return json.load(f)
    return {"sample_percent": 100, "full_dataset_size": 25_000_000}


def load_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame | None]:
    """Load the fetched data from CSV files."""
    print("Loading data...")
    
    vehicles = pd.read_csv(DATA_DIR / "vehicles.csv", dtype=str)
    defects = pd.read_csv(DATA_DIR / "defects_found.csv", dtype=str)
    defect_codes = pd.read_csv(DATA_DIR / "defect_codes.csv", dtype=str)
    
    # Try to load fuel data if available
    fuel = None
    fuel_path = DATA_DIR / "fuel.csv"
    if fuel_path.exists():
        fuel = pd.read_csv(fuel_path, dtype=str)
        print(f"  Fuel: {len(fuel)}")
    
    print(f"  Vehicles: {len(vehicles)}")
    print(f"  Defects: {len(defects)}")
    print(f"  Defect codes: {len(defect_codes)}")
    
    return vehicles, defects, defect_codes, fuel


def enrich_vehicles(vehicles: pd.DataFrame, fuel: pd.DataFrame | None) -> pd.DataFrame:
    """Add calculated fields to vehicles dataframe."""
    vehicles = vehicles.copy()
    
    # Calculate vehicle age in years from first registration date
    if "datum_eerste_toelating" in vehicles.columns:
        vehicles["first_registration"] = pd.to_datetime(
            vehicles["datum_eerste_toelating"], 
            format="%Y%m%d", 
            errors="coerce"
        )
        today = datetime.now()
        vehicles["age_years"] = (
            (today - vehicles["first_registration"]).dt.days / 365.25
        ).round(1)
    
    # Merge fuel data if available
    if fuel is not None and len(fuel) > 0:
        fuel_simple = fuel[["kenteken", "brandstof_omschrijving"]].drop_duplicates(subset=["kenteken"])
        vehicles = vehicles.merge(fuel_simple, on="kenteken", how="left")
    
    return vehicles


def calculate_defects_by_brand(
    vehicles: pd.DataFrame, 
    defects: pd.DataFrame
) -> pd.DataFrame:
    """
    Calculate average defects per inspection by brand.
    
    Args:
        vehicles: Vehicle registration data
        defects: Defects found during inspections
    
    Returns:
        DataFrame with brand, vehicle count, inspection count, avg defects per inspection
    """
    print("\nCalculating defects by brand...")
    
    # Create a unique inspection identifier (kenteken + date)
    defects = defects.copy()
    defects["inspection_id"] = defects["kenteken"] + "_" + defects["meld_datum_door_keuringsinstantie"]
    
    # Sum defects per inspection (each row is a defect type, aantal_gebreken_geconstateerd is the count)
    defects["defect_count"] = pd.to_numeric(defects["aantal_gebreken_geconstateerd"], errors="coerce").fillna(0)
    
    inspection_stats = defects.groupby(["kenteken", "inspection_id"]).agg(
        total_defects=("defect_count", "sum"),
        defect_types=("gebrek_identificatie", "nunique")
    ).reset_index()
    
    # Join with vehicle data to get brand
    merged = vehicles[["kenteken", "merk", "handelsbenaming"]].merge(
        inspection_stats,
        on="kenteken",
        how="inner"
    )
    
    # Aggregate by brand
    brand_stats = merged.groupby("merk").agg(
        vehicle_count=("kenteken", "nunique"),
        total_inspections=("inspection_id", "nunique"),
        total_defects=("total_defects", "sum"),
        total_defect_types=("defect_types", "sum"),
    ).reset_index()
    
    # Calculate metrics
    brand_stats["avg_defects_per_inspection"] = (
        brand_stats["total_defects"] / brand_stats["total_inspections"]
    ).round(2)
    
    brand_stats["avg_defect_types_per_inspection"] = (
        brand_stats["total_defect_types"] / brand_stats["total_inspections"]
    ).round(2)
    
    brand_stats["inspections_per_vehicle"] = (
        brand_stats["total_inspections"] / brand_stats["vehicle_count"]
    ).round(2)
    
    # Filter to brands with enough data (at least 100 vehicles)
    brand_stats = brand_stats[brand_stats["vehicle_count"] >= 100]
    
    # Sort by avg defects per inspection (lower is better = more reliable)
    brand_stats = brand_stats.sort_values("avg_defects_per_inspection")
    
    print(f"  Calculated stats for {len(brand_stats)} brands")
    return brand_stats


def calculate_defects_by_model(
    vehicles: pd.DataFrame, 
    defects: pd.DataFrame,
    min_vehicles: int = 50
) -> pd.DataFrame:
    """
    Calculate average defects per inspection by model.
    
    Args:
        vehicles: Vehicle registration data
        defects: Defects found during inspections
        min_vehicles: Minimum vehicles required for a model to be included
    
    Returns:
        DataFrame with brand, model, vehicle count, inspection count, avg defects per inspection
    """
    print(f"\nCalculating defects by model (min {min_vehicles} vehicles)...")
    
    # Create a unique inspection identifier (kenteken + date)
    defects = defects.copy()
    defects["inspection_id"] = defects["kenteken"] + "_" + defects["meld_datum_door_keuringsinstantie"]
    
    # Sum defects per inspection
    defects["defect_count"] = pd.to_numeric(defects["aantal_gebreken_geconstateerd"], errors="coerce").fillna(0)
    
    inspection_stats = defects.groupby(["kenteken", "inspection_id"]).agg(
        total_defects=("defect_count", "sum"),
        defect_types=("gebrek_identificatie", "nunique")
    ).reset_index()
    
    # Join with vehicle data to get brand and model
    merged = vehicles[["kenteken", "merk", "handelsbenaming"]].merge(
        inspection_stats,
        on="kenteken",
        how="inner"
    )
    
    # Aggregate by brand and model
    model_stats = merged.groupby(["merk", "handelsbenaming"]).agg(
        vehicle_count=("kenteken", "nunique"),
        total_inspections=("inspection_id", "nunique"),
        total_defects=("total_defects", "sum"),
        total_defect_types=("defect_types", "sum"),
    ).reset_index()
    
    # Calculate metrics
    model_stats["avg_defects_per_inspection"] = (
        model_stats["total_defects"] / model_stats["total_inspections"]
    ).round(2)
    
    model_stats["avg_defect_types_per_inspection"] = (
        model_stats["total_defect_types"] / model_stats["total_inspections"]
    ).round(2)
    
    model_stats["inspections_per_vehicle"] = (
        model_stats["total_inspections"] / model_stats["vehicle_count"]
    ).round(2)
    
    # Filter to models with enough data
    model_stats = model_stats[model_stats["vehicle_count"] >= min_vehicles]
    
    # Sort by avg defects per inspection (lower is better)
    model_stats = model_stats.sort_values("avg_defects_per_inspection")
    
    print(f"  Calculated stats for {len(model_stats)} models")
    return model_stats


def save_results(
    brand_stats: pd.DataFrame, 
    model_stats: pd.DataFrame,
    total_vehicles: int,
    total_inspections: int,
    metadata: dict
):
    """Save processed results to JSON for the static site."""
    output_dir = Path(__file__).parent.parent / "site" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    sample_percent = metadata.get("sample_percent", 100)
    
    # Save brand stats
    brand_data = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "sample_percent": sample_percent,
        "total_vehicles": total_vehicles,
        "total_inspections": total_inspections,
        "brands": brand_stats.to_dict(orient="records")
    }
    with open(output_dir / "brand_reliability.json", "w") as f:
        json.dump(brand_data, f, indent=2)
    
    # Save all model stats (sorted by reliability)
    model_data = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "sample_percent": sample_percent,
        "total_vehicles": total_vehicles,
        "total_inspections": total_inspections,
        "most_reliable": model_stats.to_dict(orient="records"),
        "least_reliable": model_stats.tail(50).to_dict(orient="records"),
    }
    with open(output_dir / "model_reliability.json", "w") as f:
        json.dump(model_data, f, indent=2)
    
    print(f"\nResults saved to {output_dir}/")


def main():
    """Process data and calculate reliability metrics."""
    metadata = load_metadata()
    vehicles, defects, defect_codes, fuel = load_data()
    
    print(f"\nProcessing {metadata.get('sample_percent', 100)}% dataset sample...")
    
    # Enrich vehicles with age and fuel data
    vehicles = enrich_vehicles(vehicles, fuel)
    
    # Create inspection_id for counting unique inspections
    defects["inspection_id"] = defects["kenteken"] + "_" + defects["meld_datum_door_keuringsinstantie"]
    
    # Calculate totals for the site
    total_vehicles = len(vehicles)
    total_inspections = defects["inspection_id"].nunique()
    
    brand_stats = calculate_defects_by_brand(vehicles, defects)
    model_stats = calculate_defects_by_model(vehicles, defects)
    
    # Print top 10 most reliable brands
    print("\n" + "=" * 60)
    print("TOP 10 MOST RELIABLE BRANDS (lowest defects per inspection)")
    print("=" * 60)
    print(brand_stats[["merk", "vehicle_count", "total_inspections", "avg_defects_per_inspection"]].head(10).to_string(index=False))
    
    # Print top 10 least reliable brands
    print("\n" + "=" * 60)
    print("TOP 10 LEAST RELIABLE BRANDS (highest defects per inspection)")
    print("=" * 60)
    print(brand_stats[["merk", "vehicle_count", "total_inspections", "avg_defects_per_inspection"]].tail(10).to_string(index=False))
    
    save_results(brand_stats, model_stats, total_vehicles, total_inspections, metadata)


if __name__ == "__main__":
    main()
