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
- Optional date filter via INSPECTION_DAYS_LIMIT

Environment variables (checked in order):
- RDW_APP_TOKEN (preferred, used in GitHub Actions)
- APP_Token (alternative, used in local .env)
- INSPECTION_DAYS_LIMIT: number of days of inspection history to include (e.g., 365)

Set as GitHub secret: RDW_APP_TOKEN
Set as GitHub variable: INSPECTION_DAYS_LIMIT
"""

import argparse
import json
import math
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import requests

from rdw_api import (
    RATE_LIMITER,
    MultiDatasetProgress,
    env_load,
    log_always,
    page_fetch,
    row_count_get,
    session_create,
    verbose_set,
)

PAGE_SIZE = 50000
DATASET_WORKERS = 4


def inspection_days_limit_get() -> int | None:
    """Get inspection days limit from environment variable. Returns None if not set."""
    value = os.environ.get("INSPECTION_DAYS_LIMIT", "").strip()
    if not value:
        return None
    try:
        days = int(value)
        return days if days > 0 else None
    except ValueError:
        return None


def date_filter_build(days: int) -> str:
    """Build SoQL date filter for past N days based on meld_datum_door_keuringsinstantie."""
    cutoff = datetime.now() - timedelta(days=days)
    # RDW uses YYYYMMDD format for meld_datum_door_keuringsinstantie
    return f"meld_datum_door_keuringsinstantie >= '{cutoff.strftime('%Y%m%d')}'"


def datasets_build() -> dict[str, dict[str, Any]]:
    """Build dataset configurations, applying date filter if days limit is set."""
    days_limit = inspection_days_limit_get()
    date_filter = date_filter_build(days_limit) if days_limit else None

    datasets: dict[str, dict[str, Any]] = {
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

    # Apply date filter to inspection-related datasets
    if date_filter:
        datasets["meldingen_keuringsinstantie"]["filter"] = date_filter
        datasets["geconstateerde_gebreken"]["filter"] = date_filter

    return datasets


DIR_RAW = Path(__file__).parent.parent / "data" / "raw"


def dataset_fetch_parallel(
    name: str,
    config: dict[str, Any],
    session: requests.Session,
    progress: MultiDatasetProgress | None = None,
) -> tuple[str, int]:
    """Fetch dataset using parallel page downloads."""
    dataset_id = config["id"]
    page_size = config.get("page_size", PAGE_SIZE)
    filter_clause = config.get("filter")
    select_clause = config.get("select")

    total_rows = row_count_get(session, dataset_id, filter_clause)
    total_pages = math.ceil(total_rows / page_size) if total_rows > 0 else 1

    offsets = list(range(0, total_rows, page_size))
    results: dict[int, list[dict[str, Any]]] = {}
    results_lock = threading.Lock()

    def fetch_page(offset: int) -> None:
        page = page_fetch(
            session, dataset_id, offset, page_size, select_clause, filter_clause, None
        )
        with results_lock:
            results[offset] = page
        if progress:
            progress.update(name)

    workers = RATE_LIMITER.get_workers()

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

    if progress:
        progress.mark_done(name)
    return name, record_count


def dataset_fetch_sequential(
    name: str,
    config: dict[str, Any],
    session: requests.Session,
    progress: MultiDatasetProgress | None = None,
) -> tuple[str, int]:
    """Fetch dataset sequentially (for grouped queries)."""
    dataset_id = config["id"]
    page_size = config.get("page_size", PAGE_SIZE)
    filter_clause = config.get("filter")
    select_clause = config.get("select")
    group_clause = config.get("group")

    filepath = DIR_RAW / f"{name}.json"
    record_count = 0
    offset = 0

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

            if progress:
                progress.update(name)

            if len(page) < page_size:
                break
            offset += page_size

        f.write("]")

    if progress:
        progress.mark_done(name)
    return name, record_count


def dataset_fetch(
    name: str,
    config: dict[str, Any],
    session: requests.Session,
    progress: MultiDatasetProgress | None = None,
) -> tuple[str, int]:
    """Fetch dataset using appropriate strategy."""
    if config.get("parallel_pages", False):
        return dataset_fetch_parallel(name, config, session, progress)
    return dataset_fetch_sequential(name, config, session, progress)


def main() -> None:
    """Parallel download of all datasets."""
    parser = argparse.ArgumentParser(description="Download RDW datasets")
    parser.add_argument("--verbose", "-v", action="store_true", help="Detailed output")
    args = parser.parse_args()
    verbose_set(args.verbose)

    env_load()
    session = session_create()
    DIR_RAW.mkdir(parents=True, exist_ok=True)

    # Build dataset configs (applies date filter if INSPECTION_DAYS_LIMIT is set)
    datasets = datasets_build()
    days_limit = inspection_days_limit_get()

    log_always("Stage 1: RDW data download")
    if days_limit:
        log_always(f"Filter: inspections from past {days_limit} days only")
    log_always("Fetching dataset sizes...")

    # Calculate column width for alignment
    max_name_len = max(len(name) for name in datasets)
    total_rows = 0
    row_counts: list[tuple[str, int, int]] = []
    for name, config in datasets.items():
        count = row_count_get(session, config["id"], config.get("filter"))
        pages = math.ceil(count / config.get("page_size", PAGE_SIZE))
        row_counts.append((name, count, pages))
        total_rows += count

    for name, count, pages in row_counts:
        log_always(f"  {name:<{max_name_len}}  {count:>14,} rows  ({pages} pages)")
    log_always(f"  {'Total':<{max_name_len}}  {total_rows:>14,} rows")
    log_always("")

    # Create shared progress tracker
    progress_info = {name: (count, pages) for name, count, pages in row_counts}
    progress = MultiDatasetProgress(progress_info)

    start = time.time()
    results: dict[str, int] = {}
    failed: list[str] = []

    with ThreadPoolExecutor(max_workers=DATASET_WORKERS) as ex:
        futures = {
            ex.submit(dataset_fetch, name, config, session, progress): name
            for name, config in datasets.items()
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                _, count = future.result()
                results[name] = count
            except Exception as e:
                progress.mark_done(name)
                log_always(f"\n[{name}] FAILED: {e}")
                failed.append(name)

    progress.finish()
    elapsed = time.time() - start
    total = sum(results.values())
    log_always(f"Complete: {total:,} rows in {elapsed:.0f}s")

    if failed:
        log_always(f"Failed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
