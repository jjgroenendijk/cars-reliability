import polars as pl
from config import DIR_PARQUET

def main():
    voertuigen_path = DIR_PARQUET / "voertuigen.parquet"
    brandstof_path = DIR_PARQUET / "brandstof.parquet"
    
    if not voertuigen_path.exists():
        print(f"File not found: {voertuigen_path}")
        return

    print("Scanning vehicle data...")
    # Filter to Consumer vehicles
    df_v = (
        pl.scan_parquet(voertuigen_path)
        .filter(pl.col("voertuigsoort") == "Personenauto")
        .select(["kenteken", "catalogusprijs"])
    )
    
    # Analyze Price
    print("\nAnalyzing Catalogusprijs...")
    prices = (
        df_v
        .select(pl.col("catalogusprijs").cast(pl.Float64))
        .filter(pl.col("catalogusprijs").is_not_null())
        .collect()
    )
    
    print(prices["catalogusprijs"].describe())
    
    # Check potential buckets
    q = [0.2, 0.4, 0.6, 0.8]
    print(f"\nQuantiles {q}:")
    print(prices["catalogusprijs"].quantile(0.2))
    print(prices["catalogusprijs"].quantile(0.4))
    print(prices["catalogusprijs"].quantile(0.6))
    print(prices["catalogusprijs"].quantile(0.8))

    # Analyze Fuel
    if brandstof_path.exists():
        print("\nAnalyzing Fuel Types...")
        # We need to join because brandstof has multiple entries per vehicle (e.g. hybrid)
        # But for now let's just look at raw counts in the brandstof table
        # Ideally we want the "primary" fuel.
        df_fuel = pl.scan_parquet(brandstof_path).select("brandstof_omschrijving").collect()
        print(df_fuel["brandstof_omschrijving"].value_counts(sort=True).head(10))

if __name__ == "__main__":
    main()
