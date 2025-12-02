#!/usr/bin/env python3
"""
Stage 1: Data Download Script

Fetches raw data from RDW Open Data (Socrata API) and saves to data/raw/.
Uses multi-threading for parallel downloads across datasets AND within datasets.

Features:
- Parallel dataset downloads (all datasets at once)
- Parallel page fetching within large datasets
- Dynamic worker scaling: reduces concurrency on rate limits (429)
- Percentage-based progress indicators
- Direct-to-disk streaming to avoid memory overload

Environment variables (checked in order):
- RDW_APP_TOKEN (preferred, used in GitHub Actions)
- APP_Token (alternative, used in local .env)

Set as GitHub secret: RDW_APP_TOKEN
"""

import argparse
import json
import math
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import requests

from rdw_api import (
    RATE_LIMITER,
    ProgressTracker,
    env_load,
    log,
    log_always,
    page_fetch,
    row_count_get,
    session_create,
    verbose_set,
)

PAGE_SIZE = 50000
DATASET_WORKERS = 4

DATASETS = {
    "gekentekende_voertuigen": {
        "id": "m9d7-ebf2",
        "filter": "voertuigsoort='Personenauto'",
        "select": "kenteken,merk,handelsbenaming,datum_eerste_toelating",
        "parallel_pages": True,
    },
    "meldingen_keuringsinstantie": {
        "id": "sgfe-77wx",
        "select": "kenteken,count(kenteken) as inspection_count",
        "group": "kenteken",
        "parallel_pages": False,
    },
    "geconstateerde_gebreken": {
        "id": "a34c-vvps",
        "select": "kenteken,count(kenteken) as defect_count",
        "group": "kenteken",
        "parallel_pages": False,
    },
    "gebreken": {
        "id": "hx2c-gt7k",
        "page_size": 1000,
        "parallel_pages": False,
    },
}

DIR_RAW = Path(__file__).parent.parent / "data" / "raw"


def dataset_fetch_parallel(
    name: str, config: dict[str, Any], session: requests.Session
) -> tuple[str, int]:
    """Fetch dataset using parallel page downloads."""
    dataset_id = config["id"]
    page_size = config.get("page_size", PAGE_SIZE)
    filter_clause = config.get("filter")
    select_clause = config.get("select")

    total_rows = row_count_get(session, dataset_id, filter_clause)
    total_pages = math.ceil(total_rows / page_size) if total_rows > 0 else 1
    log(f"[{name}] {total_rows:,} rows, {total_pages} pages")
    log_always(f"[{name}] 0%")

    progress = ProgressTracker(name, total_rows)
    offsets = list(range(0, total_rows, page_size))
    results: dict[int, list[dict[str, Any]]] = {}
    results_lock = threading.Lock()

    def fetch_page(offset: int) -> None:
        page = page_fetch(
            session, dataset_id, offset, page_size, select_clause, filter_clause, None
        )
        with results_lock:
            results[offset] = page
        progress.update(len(page))

    workers = RATE_LIMITER.get_workers()
    log(f"[{name}] using {workers} parallel workers")

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(fetch_page, off): off for off in offsets}
        for future in as_completed(futures):
            if exc := future.exception():
                raise exc

    # Stream to disk
    filepath = DIR_RAW / f"{name}.json"
    record_count = 0
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("[")
        first = True
        for offset in offsets:
            for record in results.get(offset, []):
                if not first:
                    f.write(",")
                first = False
                json.dump(record, f, ensure_ascii=False)
                record_count += 1
        f.write("]")

    size_mb = filepath.stat().st_size / (1024 * 1024)
    log_always(f"[{name}] done: {record_count:,} rows, {size_mb:.0f} MB")
    return name, record_count


def dataset_fetch_sequential(
    name: str, config: dict[str, Any], session: requests.Session
) -> tuple[str, int]:
    """Fetch dataset sequentially (for grouped queries)."""
    dataset_id = config["id"]
    page_size = config.get("page_size", PAGE_SIZE)
    filter_clause = config.get("filter")
    select_clause = config.get("select")
    group_clause = config.get("group")

    is_grouped = group_clause is not None
    total_rows = 0 if is_grouped else row_count_get(session, dataset_id, filter_clause)
    if total_rows:
        log(f"[{name}] {total_rows:,} rows")
    log_always(f"[{name}] 0%")

    filepath = DIR_RAW / f"{name}.json"
    record_count = 0
    offset = 0
    last_pct = 0

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("[")
        first = True
        while True:
            page = page_fetch(
                session,
                dataset_id,
                offset,
                page_size,
                select_clause,
                filter_clause,
                group_clause,
            )
            if not page:
                break

            for record in page:
                if not first:
                    f.write(",")
                first = False
                json.dump(record, f, ensure_ascii=False)
                record_count += 1

            if len(page) < page_size:
                break
            offset += page_size

            if total_rows > 0:
                pct = int((record_count / total_rows) * 100)
                if pct >= last_pct + 5:
                    last_pct = pct
                    log_always(f"[{name}] {pct}%")
            elif record_count % 500000 == 0:
                log_always(f"[{name}] {record_count // 1000}k rows")

        f.write("]")

    size_mb = filepath.stat().st_size / (1024 * 1024)
    log_always(f"[{name}] done: {record_count:,} rows, {size_mb:.0f} MB")
    return name, record_count


def dataset_fetch(
    name: str, config: dict[str, Any], session: requests.Session
) -> tuple[str, int]:
    """Fetch dataset using appropriate strategy."""
    if config.get("parallel_pages", False):
        return dataset_fetch_parallel(name, config, session)
    return dataset_fetch_sequential(name, config, session)


def main() -> None:
    """Parallel download of all datasets."""
    parser = argparse.ArgumentParser(description="Download RDW datasets")
    parser.add_argument("--verbose", "-v", action="store_true", help="Detailed output")
    args = parser.parse_args()
    verbose_set(args.verbose)

    env_load()
    session = session_create()
    DIR_RAW.mkdir(parents=True, exist_ok=True)

    log_always("Stage 1: RDW data download")
    log_always("Fetching dataset sizes...")

    total_rows = 0
    for name, config in DATASETS.items():
        count = row_count_get(session, config["id"], config.get("filter"))
        pages = math.ceil(count / config.get("page_size", PAGE_SIZE))
        log_always(f"  {name}: {count:,} rows ({pages} pages)")
        total_rows += count
    log_always(f"  Total: {total_rows:,} rows")
    log_always("")

    start = time.time()
    results: dict[str, int] = {}
    failed: list[str] = []

    with ThreadPoolExecutor(max_workers=DATASET_WORKERS) as ex:
        futures = {
            ex.submit(dataset_fetch, name, config, session): name
            for name, config in DATASETS.items()
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                _, count = future.result()
                results[name] = count
            except Exception as e:
                log_always(f"[{name}] FAILED: {e}")
                failed.append(name)

    elapsed = time.time() - start
    total = sum(results.values())
    log_always(f"Complete: {total:,} rows in {elapsed:.0f}s")

    if failed:
        log_always(f"Failed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
