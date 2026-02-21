import random
import time

import polars as pl
from scripts.defect_build import build_defect_breakdowns


def run_benchmark():
    # Setup parameters
    num_defects = 1_000_000
    num_inspections = 100_000

    # Set seed for reproducibility
    random.seed(42)

    # Generate synthetic data
    print("Generating synthetic data...")

    # Inspections DataFrame
    # Generate random data using random module
    brands = ["BRAND_A", "BRAND_B", "BRAND_C"]
    models = ["MODEL_X", "MODEL_Y", "MODEL_Z"]

    inspections_data = {
        "kenteken": [f"K{i:06d}" for i in range(num_inspections)],
        "meld_datum_door_keuringsinstantie": ["20230101"] * num_inspections,
        "meld_tijd_door_keuringsinstantie": ["1200"] * num_inspections,
        "merk": [random.choice(brands) for _ in range(num_inspections)],
        "handelsbenaming": [random.choice(models) for _ in range(num_inspections)],
    }
    inspections_df = pl.DataFrame(inspections_data)

    # Defects LazyFrame
    defect_codes = ["D01", "D02", "D03", "D04"]

    # We need to pick kentekens from inspections
    insp_kentekens = inspections_data["kenteken"]

    defects_data = {
        "kenteken": [random.choice(insp_kentekens) for _ in range(num_defects)],
        "meld_datum_door_keuringsinstantie": ["20230101"] * num_defects,
        "meld_tijd_door_keuringsinstantie": ["1200"] * num_defects,
        "gebrek_identificatie": [random.choice(defect_codes) for _ in range(num_defects)],
        "aantal_gebreken_geconstateerd": [random.randint(1, 5) for _ in range(num_defects)],
    }
    defects_lf = pl.LazyFrame(defects_data)

    print("Starting benchmark...")
    start_time = time.time()

    # Run the function
    brand_defects, model_defects = build_defect_breakdowns(defects_lf, inspections_df)

    end_time = time.time()
    duration = end_time - start_time

    print(f"Benchmark finished in {duration:.4f} seconds")

    # Calculate some hash or sum to verify correctness
    brand_total = sum(sum(d.values()) for d in brand_defects.values())
    model_total = sum(sum(d.values()) for d in model_defects.values())

    print(f"Total brand defects count: {brand_total}")
    print(f"Total model defects count: {model_total}")

    return duration


if __name__ == "__main__":
    run_benchmark()
