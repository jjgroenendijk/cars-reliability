#!/usr/bin/env python3
"""
Stage 1 Alternative: Bulk Download Script

Downloads entire datasets via Socrata export API instead of pagination.
This is a test to compare speed vs the paginated approach.

Export URLs:
- CSV: /api/views/{id}/rows.csv?accessType=DOWNLOAD
- JSON: /api/views/{id}/rows.json?accessType=DOWNLOAD
"""

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

# Datasets to download - only the ones we need
DATASETS = {
    "gekentekende_voertuigen": {
        "id": "m9d7-ebf2",
        "columns": ["kenteken", "merk", "handelsbenaming", "datum_eerste_toelating", "voertuigsoort"],
    },
    "meldingen_keuringsinstantie": {
        "id": "sgfe-77wx",
        "columns": ["kenteken"],  # We only need to count per kenteken
    },
    "geconstateerde_gebreken": {
        "id": "a34c-vvps",
        "columns": ["kenteken"],  # We only need to count per kenteken
    },
    "gebreken": {
        "id": "hx2c-gt7k",
        "columns": None,  # All columns (small reference table)
    },
}

DIR_RAW = Path(__file__).parent.parent / "data" / "raw"
REQUEST_TIMEOUT = 600  # 10 minutes for large downloads


def env_load() -> None:
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() not in os.environ:
                        os.environ[k.strip()] = v.strip().strip("\"'")


def headers_get() -> dict[str, str]:
    """Build HTTP headers with optional app token."""
    h = {"Accept": "text/csv"}
    if token := os.environ.get("RDW_APP_TOKEN"):
        h["X-App-Token"] = token
    return h


def download_and_filter_csv(
    name: str, dataset_id: str, columns: list[str] | None, headers: dict[str, str]
) -> tuple[str, int, float]:
    """Download CSV and filter to needed columns, aggregate counts for inspection/defect data.
    
    Streams the CSV line-by-line to avoid loading entire file into memory.
    """
    url = f"https://opendata.rdw.nl/api/views/{dataset_id}/rows.csv?accessType=DOWNLOAD"
    
    print(f"[{name}] downloading+processing (streaming)...", flush=True)
    start = time.time()
    
    response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT, stream=True)
    response.raise_for_status()
    
    # Stream CSV line by line
    lines = response.iter_lines(decode_unicode=True)
    header_line = next(lines)
    fieldnames = header_line.split(",")
    
    # Find column indices we need
    col_indices: dict[str, int] = {}
    for i, col in enumerate(fieldnames):
        col_indices[col] = i
    
    row_count = 0
    last_progress = 0
    
    # For inspection/defect data, aggregate counts by kenteken
    if name in ("meldingen_keuringsinstantie", "geconstateerde_gebreken"):
        kenteken_idx = col_indices.get("kenteken")
        if kenteken_idx is None:
            raise ValueError(f"kenteken column not found in {name}")
        
        counts: dict[str, int] = {}
        for line in lines:
            if not line:
                continue
            parts = line.split(",")
            if len(parts) > kenteken_idx:
                kenteken = parts[kenteken_idx].strip().strip('"')
                if kenteken:
                    counts[kenteken] = counts.get(kenteken, 0) + 1
            row_count += 1
            if row_count - last_progress >= 1_000_000:
                print(f"[{name}] {row_count//1_000_000}M rows...", flush=True)
                last_progress = row_count
        
        # Convert to list format matching paginated script output
        count_field = "inspection_count" if "meldingen" in name else "defect_count"
        records = [{"kenteken": k, count_field: str(v)} for k, v in counts.items()]
    
    # For vehicles, filter columns and filter to Personenauto only
    elif name == "gekentekende_voertuigen":
        needed_cols = ["kenteken", "merk", "handelsbenaming", "datum_eerste_toelating"]
        voertuigsoort_idx = col_indices.get("voertuigsoort")
        needed_indices = [(c, col_indices.get(c)) for c in needed_cols]
        
        records = []
        for line in lines:
            if not line:
                continue
            # Simple CSV parse (assumes no commas in values, which is true for RDW data)
            parts = line.split(",")
            
            # Filter to Personenauto only
            if voertuigsoort_idx is not None and len(parts) > voertuigsoort_idx:
                voertuigsoort = parts[voertuigsoort_idx].strip().strip('"')
                if voertuigsoort != "Personenauto":
                    row_count += 1
                    continue
            
            row = {}
            for col_name, idx in needed_indices:
                if idx is not None and len(parts) > idx:
                    row[col_name] = parts[idx].strip().strip('"')
                else:
                    row[col_name] = ""
            records.append(row)
            
            row_count += 1
            if row_count - last_progress >= 1_000_000:
                print(f"[{name}] {row_count//1_000_000}M rows, {len(records)//1000}k kept...", flush=True)
                last_progress = row_count
    
    # For reference tables, keep all
    else:
        records = []
        for line in lines:
            if not line:
                continue
            parts = line.split(",")
            row = {}
            for col_name, idx in col_indices.items():
                if len(parts) > idx:
                    row[col_name] = parts[idx].strip().strip('"')
            records.append(row)
            row_count += 1
    
    # Save as JSON
    filepath = DIR_RAW / f"{name}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)
    
    size_mb = filepath.stat().st_size / (1024 * 1024)
    total_time = time.time() - start
    print(f"[{name}] done: {len(records)//1000}k records from {row_count//1000}k rows, {size_mb:.0f}MB, {total_time:.0f}s", flush=True)
    
    return name, len(records), total_time


def main() -> None:
    """Download all datasets via bulk export."""
    env_load()
    headers = headers_get()
    DIR_RAW.mkdir(parents=True, exist_ok=True)
    
    print("Stage1-BULK: RDW download (export API)", flush=True)
    start = time.time()
    
    results: dict[str, int] = {}
    failed: list[str] = []
    
    # Download sequentially to avoid overwhelming the server
    # (bulk downloads are heavy)
    for name, config in DATASETS.items():
        try:
            _, count, _ = download_and_filter_csv(
                name, config["id"], config.get("columns"), headers
            )
            results[name] = count
        except Exception as e:
            print(f"[{name}] FAIL: {e}", flush=True)
            failed.append(name)
    
    elapsed = time.time() - start
    total = sum(results.values())
    print(f"Done: {total//1000}k rows total, {elapsed:.0f}s", flush=True)
    
    if failed:
        exit(1)


if __name__ == "__main__":
    main()
