import polars as pl
from config import DIR_PARQUET

def main():
    voertuigen_path = DIR_PARQUET / "voertuigen.parquet"
    if not voertuigen_path.exists():
        print(f"File not found: {voertuigen_path}")
        return

    print("Scanning vehicle data...")
    df = pl.scan_parquet(voertuigen_path).select(["voertuigsoort", "inrichting"]).collect()
    
    print("\nVehicle Types (voertuigsoort):")
    print(df["voertuigsoort"].value_counts(sort=True))

    print("\nBody Types (inrichting):")
    print(df["inrichting"].value_counts(sort=True).head(20))

if __name__ == "__main__":
    main()
