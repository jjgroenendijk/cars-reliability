import polars as pl
from config import DIR_PARQUET

def main():
    voertuigen_path = DIR_PARQUET / "voertuigen.parquet"
    if not voertuigen_path.exists():
        print(f"File not found: {voertuigen_path}")
        return

    print("Scanning vehicle data...")
    # Filter to Personenauto (Consumer) as that's what we care about most for these filters
    df = (
        pl.scan_parquet(voertuigen_path)
        .filter(pl.col("voertuigsoort") == "Personenauto")
        .select(["inrichting"])
        .collect()
    )
    
    print("\nBody Types (Personenauto):")
    print(df["inrichting"].value_counts(sort=True).head(25))

if __name__ == "__main__":
    main()
