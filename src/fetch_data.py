"""
Fetch data from RDW Open Data API (Socrata/SODA API).

Datasets:
- Gekentekende voertuigen (m9d7-ebf2): Vehicle registrations
- Geconstateerde Gebreken (a34c-vvps): Defects found during inspections
- Gebreken (hx2c-gt7k): Defect reference table
"""

import os
from pathlib import Path

import pandas as pd
from sodapy import Socrata

# RDW Open Data domain
RDW_DOMAIN = "opendata.rdw.nl"

# Dataset IDs
DATASETS = {
    "vehicles": "m9d7-ebf2",      # Gekentekende voertuigen
    "defects_found": "a34c-vvps", # Geconstateerde Gebreken
    "defect_codes": "hx2c-gt7k",  # Gebreken (reference table)
}

# Data directory
DATA_DIR = Path(__file__).parent.parent / "data"


def get_client() -> Socrata:
    """Create Socrata client for RDW API."""
    # App token is optional but recommended for higher rate limits
    app_token = os.environ.get("RDW_APP_TOKEN")
    return Socrata(RDW_DOMAIN, app_token)


def fetch_defects_found(client: Socrata, limit: int = 100000) -> pd.DataFrame:
    """
    Fetch defects found during inspections.
    
    Args:
        client: Socrata client
        limit: Maximum number of records to fetch
    
    Returns:
        DataFrame with defect data
    """
    print(f"Fetching defects found (limit: {limit})...")
    
    results = client.get(
        DATASETS["defects_found"],
        limit=limit,
    )
    
    df = pd.DataFrame.from_records(results)
    print(f"  Fetched {len(df)} defect records")
    return df


def fetch_vehicles_for_kentekens(
    client: Socrata, 
    kentekens: list[str],
    batch_size: int = 1000
) -> pd.DataFrame:
    """
    Fetch vehicle info for specific license plates.
    
    Args:
        client: Socrata client
        kentekens: List of license plates to fetch
        batch_size: Number of kentekens per API call
    
    Returns:
        DataFrame with vehicle data
    """
    print(f"Fetching vehicle info for {len(kentekens)} unique kentekens...")
    
    columns = [
        "kenteken",
        "merk",
        "handelsbenaming",
        "voertuigsoort",
        "datum_eerste_toelating",
        "vervaldatum_apk",
    ]
    
    all_results = []
    unique_kentekens = list(set(kentekens))
    
    for i in range(0, len(unique_kentekens), batch_size):
        batch = unique_kentekens[i:i + batch_size]
        # Create IN clause for SoQL
        kenteken_list = ",".join(f"'{k}'" for k in batch)
        
        try:
            results = client.get(
                DATASETS["vehicles"],
                select=",".join(columns),
                where=f"kenteken IN ({kenteken_list}) AND voertuigsoort='Personenauto'",
                limit=batch_size,
            )
            all_results.extend(results)
        except Exception as e:
            print(f"  Warning: batch {i//batch_size} failed: {e}")
        
        if (i // batch_size) % 10 == 0:
            print(f"  Processed {min(i + batch_size, len(unique_kentekens))}/{len(unique_kentekens)} kentekens...")
    
    df = pd.DataFrame.from_records(all_results)
    print(f"  Fetched info for {len(df)} passenger cars")
    return df


def fetch_defect_codes(client: Socrata) -> pd.DataFrame:
    """
    Fetch defect reference table (all possible defect codes and descriptions).
    
    Args:
        client: Socrata client
    
    Returns:
        DataFrame with defect codes
    """
    print("Fetching defect codes...")
    
    results = client.get(
        DATASETS["defect_codes"],
        limit=10000,  # Reference table should be small
    )
    
    df = pd.DataFrame.from_records(results)
    print(f"  Fetched {len(df)} defect codes")
    return df


def main():
    """Fetch all data and save to CSV files."""
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    client = get_client()
    
    # First, fetch defects (this is our primary dataset)
    defects_df = fetch_defects_found(client)
    defect_codes_df = fetch_defect_codes(client)
    
    # Then fetch vehicle info for the kentekens that have defects
    kentekens = defects_df["kenteken"].unique().tolist()
    vehicles_df = fetch_vehicles_for_kentekens(client, kentekens)
    
    # Save to CSV
    vehicles_df.to_csv(DATA_DIR / "vehicles.csv", index=False)
    defects_df.to_csv(DATA_DIR / "defects_found.csv", index=False)
    defect_codes_df.to_csv(DATA_DIR / "defect_codes.csv", index=False)
    
    print(f"\nData saved to {DATA_DIR}/")
    print(f"  - vehicles.csv: {len(vehicles_df)} records")
    print(f"  - defects_found.csv: {len(defects_df)} records")
    print(f"  - defect_codes.csv: {len(defect_codes_df)} records")
    
    client.close()


if __name__ == "__main__":
    main()
