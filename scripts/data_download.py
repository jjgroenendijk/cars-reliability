#!/usr/bin/env python3
"""
Stage 1: Data Download Script

Fetches raw data from RDW Open Data (Socrata API) and saves to data/raw/.
Uses multi-threading for parallel downloads, SoQL aggregation for efficiency.

Why download instead of live API queries:
- Need to JOIN data across 3 datasets (vehicles + inspections + defects) by kenteken
- Socrata API doesn't support cross-dataset JOINs
- Aggregation ($group) already reduces inspection/defect data from ~50M to ~15M rows
"""

import json
import math
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import requests

API_BASE_URL = "https://opendata.rdw.nl/resource"
PAGE_SIZE = 50000
REQUEST_TIMEOUT = 120
MAX_WORKERS = 4

DATASETS = {
    "gekentekende_voertuigen": {
        "id": "m9d7-ebf2",
        "filter": "voertuigsoort='Personenauto'",
        "select": "kenteken,merk,handelsbenaming,datum_eerste_toelating",
    },
    "meldingen_keuringsinstantie": {
        "id": "sgfe-77wx",
        "select": "kenteken,count(kenteken) as inspection_count",
        "group": "kenteken",
    },
    "geconstateerde_gebreken": {
        "id": "a34c-vvps",
        "select": "kenteken,count(kenteken) as defect_count",
        "group": "kenteken",
    },
    "gebreken": {
        "id": "hx2c-gt7k",
        "page_size": 1000,  # Small reference table
    },
}

DIR_RAW = Path(__file__).parent.parent / "data" / "raw"


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
    h = {"Accept": "application/json"}
    if token := os.environ.get("RDW_APP_TOKEN"):
        h["X-App-Token"] = token
    return h


def api_get(url: str, headers: dict[str, str]) -> list[dict[str, Any]]:
    """Make API request with retry on 429."""
    for attempt in range(5):
        try:
            r = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            if r.status_code == 429:
                time.sleep(2**attempt)
                continue
            r.raise_for_status()
            return r.json()
        except requests.exceptions.Timeout:
            if attempt == 4:
                raise
            time.sleep(2**attempt)
    raise requests.RequestException(f"Failed: {url}")


def row_count_get(
    dataset_id: str, headers: dict[str, str], filter_clause: str | None = None
) -> int:
    """Get total row count for a dataset."""
    url = f"{API_BASE_URL}/{dataset_id}.json?$select=count(*)"
    if filter_clause:
        url += f"&$where={requests.utils.quote(filter_clause)}"
    data = api_get(url, headers)
    return int(data[0].get("count", 0)) if data else 0


def dataset_fetch(
    name: str, config: dict[str, Any], headers: dict[str, str]
) -> tuple[str, int]:
    """Fetch a single dataset with progress indication."""
    dataset_id = config["id"]
    page_size = config.get("page_size", PAGE_SIZE)
    filter_clause = config.get("filter")
    select_clause = config.get("select")
    group_clause = config.get("group")

    # For grouped queries, we can't easily get count upfront
    # For non-grouped, get total count first
    total_rows = 0
    total_pages = 0
    if not group_clause:
        total_rows = row_count_get(dataset_id, headers, filter_clause)
        total_pages = math.ceil(total_rows / page_size)
        print(f"[{name}] {total_rows // 1000}k rows, {total_pages} pages", flush=True)
    else:
        print(f"[{name}] starting (grouped query)", flush=True)

    records: list[dict[str, Any]] = []
    offset = 0
    page_num = 0

    while True:
        url = f"{API_BASE_URL}/{dataset_id}.json?$limit={page_size}&$offset={offset}"
        if select_clause:
            url += f"&$select={requests.utils.quote(select_clause)}"
        if filter_clause:
            url += f"&$where={requests.utils.quote(filter_clause)}"
        if group_clause:
            url += f"&$group={requests.utils.quote(group_clause)}"

        page = api_get(url, headers)
        if not page:
            break

        records.extend(page)
        page_num += 1

        if len(page) < page_size:
            break

        offset += page_size

        # Progress: show page X/Y for known totals, or just page X for grouped
        if total_pages:
            print(f"[{name}] {page_num}/{total_pages}", flush=True)
        elif page_num % 5 == 0:  # Every 5 pages for grouped queries
            print(f"[{name}] page {page_num} ({len(records) // 1000}k)", flush=True)

    # Save
    filepath = DIR_RAW / f"{name}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    size_mb = filepath.stat().st_size / (1024 * 1024)
    print(f"[{name}] done {len(records) // 1000}k rows {size_mb:.0f}MB", flush=True)
    return name, len(records)


def main() -> None:
    """Parallel download of all datasets."""
    env_load()
    headers = headers_get()
    DIR_RAW.mkdir(parents=True, exist_ok=True)

    print("Stage1: RDW download", flush=True)
    start = time.time()

    results: dict[str, int] = {}
    failed: list[str] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {
            ex.submit(dataset_fetch, n, c, headers): n for n, c in DATASETS.items()
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                _, count = future.result()
                results[name] = count
            except Exception as e:
                print(f"[{name}] FAIL: {e}", flush=True)
                failed.append(name)

    elapsed = time.time() - start
    total = sum(results.values())
    print(f"Done: {total // 1000}k rows {elapsed:.0f}s", flush=True)

    if failed:
        exit(1)


if __name__ == "__main__":
    main()
