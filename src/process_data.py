"""
Process RDW data to calculate reliability metrics.

Metrics:
1. Defect rate per brand/model - Average number of defects found per inspection
2. (Future) APK failure rate - Percentage of vehicles failing APK
"""

import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent.parent / "data"


def load_data() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load the fetched data from CSV files."""
    print("Loading data...")
    
    vehicles = pd.read_csv(DATA_DIR / "vehicles.csv", dtype=str)
    defects = pd.read_csv(DATA_DIR / "defects_found.csv", dtype=str)
    defect_codes = pd.read_csv(DATA_DIR / "defect_codes.csv", dtype=str)
    
    print(f"  Vehicles: {len(vehicles)}")
    print(f"  Defects: {len(defects)}")
    print(f"  Defect codes: {len(defect_codes)}")
    
    return vehicles, defects, defect_codes


def calculate_defects_by_brand(
    vehicles: pd.DataFrame, 
    defects: pd.DataFrame
) -> pd.DataFrame:
    """
    Calculate average defects per vehicle by brand.
    
    Args:
        vehicles: Vehicle registration data
        defects: Defects found during inspections
    
    Returns:
        DataFrame with brand, vehicle count, total defects, avg defects
    """
    print("\nCalculating defects by brand...")
    
    # Count defects per vehicle (kenteken)
    defects_per_vehicle = defects.groupby("kenteken").agg(
        total_defects=("aantal_gebreken_geconstateerd", lambda x: pd.to_numeric(x, errors="coerce").sum()),
        inspection_count=("kenteken", "count")
    ).reset_index()
    
    # Join with vehicle data to get brand
    merged = vehicles[["kenteken", "merk", "handelsbenaming"]].merge(
        defects_per_vehicle,
        on="kenteken",
        how="inner"
    )
    
    # Aggregate by brand
    brand_stats = merged.groupby("merk").agg(
        vehicle_count=("kenteken", "nunique"),
        total_defects=("total_defects", "sum"),
        total_inspections=("inspection_count", "sum"),
    ).reset_index()
    
    # Calculate average defects per vehicle
    brand_stats["avg_defects_per_vehicle"] = (
        brand_stats["total_defects"] / brand_stats["vehicle_count"]
    ).round(2)
    
    brand_stats["avg_defects_per_inspection"] = (
        brand_stats["total_defects"] / brand_stats["total_inspections"]
    ).round(2)
    
    # Filter to brands with enough data (at least 100 vehicles)
    brand_stats = brand_stats[brand_stats["vehicle_count"] >= 100]
    
    # Sort by avg defects (lower is better = more reliable)
    brand_stats = brand_stats.sort_values("avg_defects_per_vehicle")
    
    print(f"  Calculated stats for {len(brand_stats)} brands")
    return brand_stats


def calculate_defects_by_model(
    vehicles: pd.DataFrame, 
    defects: pd.DataFrame,
    min_vehicles: int = 50
) -> pd.DataFrame:
    """
    Calculate average defects per vehicle by model.
    
    Args:
        vehicles: Vehicle registration data
        defects: Defects found during inspections
        min_vehicles: Minimum vehicles required for a model to be included
    
    Returns:
        DataFrame with brand, model, vehicle count, total defects, avg defects
    """
    print(f"\nCalculating defects by model (min {min_vehicles} vehicles)...")
    
    # Count defects per vehicle (kenteken)
    defects_per_vehicle = defects.groupby("kenteken").agg(
        total_defects=("aantal_gebreken_geconstateerd", lambda x: pd.to_numeric(x, errors="coerce").sum()),
        inspection_count=("kenteken", "count")
    ).reset_index()
    
    # Join with vehicle data to get brand and model
    merged = vehicles[["kenteken", "merk", "handelsbenaming"]].merge(
        defects_per_vehicle,
        on="kenteken",
        how="inner"
    )
    
    # Aggregate by brand and model
    model_stats = merged.groupby(["merk", "handelsbenaming"]).agg(
        vehicle_count=("kenteken", "nunique"),
        total_defects=("total_defects", "sum"),
        total_inspections=("inspection_count", "sum"),
    ).reset_index()
    
    # Calculate averages
    model_stats["avg_defects_per_vehicle"] = (
        model_stats["total_defects"] / model_stats["vehicle_count"]
    ).round(2)
    
    model_stats["avg_defects_per_inspection"] = (
        model_stats["total_defects"] / model_stats["total_inspections"]
    ).round(2)
    
    # Filter to models with enough data
    model_stats = model_stats[model_stats["vehicle_count"] >= min_vehicles]
    
    # Sort by avg defects (lower is better)
    model_stats = model_stats.sort_values("avg_defects_per_vehicle")
    
    print(f"  Calculated stats for {len(model_stats)} models")
    return model_stats


def save_results(brand_stats: pd.DataFrame, model_stats: pd.DataFrame):
    """Save processed results to JSON for the static site."""
    output_dir = Path(__file__).parent.parent / "site" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save brand stats
    brand_data = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "brands": brand_stats.to_dict(orient="records")
    }
    with open(output_dir / "brand_reliability.json", "w") as f:
        json.dump(brand_data, f, indent=2)
    
    # Save model stats (top 50 best and worst)
    best_models = model_stats.head(50).to_dict(orient="records")
    worst_models = model_stats.tail(50).to_dict(orient="records")
    
    model_data = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "most_reliable": best_models,
        "least_reliable": worst_models,
    }
    with open(output_dir / "model_reliability.json", "w") as f:
        json.dump(model_data, f, indent=2)
    
    print(f"\nResults saved to {output_dir}/")


def main():
    """Process data and calculate reliability metrics."""
    vehicles, defects, defect_codes = load_data()
    
    brand_stats = calculate_defects_by_brand(vehicles, defects)
    model_stats = calculate_defects_by_model(vehicles, defects)
    
    # Print top 10 most reliable brands
    print("\n" + "=" * 50)
    print("TOP 10 MOST RELIABLE BRANDS (lowest avg defects)")
    print("=" * 50)
    print(brand_stats.head(10).to_string(index=False))
    
    # Print top 10 least reliable brands
    print("\n" + "=" * 50)
    print("TOP 10 LEAST RELIABLE BRANDS (highest avg defects)")
    print("=" * 50)
    print(brand_stats.tail(10).to_string(index=False))
    
    save_results(brand_stats, model_stats)


if __name__ == "__main__":
    main()
