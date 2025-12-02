#!/usr/bin/env python3
"""
Stage 1: Data Download Script

Fetches raw data from RDW Open Data (Socrata API) and saves to data/raw/.
Implements pagination, rate limiting with exponential backoff, and app token support.
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# API Configuration
API_BASE_URL = "https://opendata.rdw.nl/resource"
PAGE_SIZE_DEFAULT = 1000
PAGE_SIZE_MAX = 50000
BACKOFF_INITIAL_SECONDS = 1
BACKOFF_MAX_SECONDS = 60
BACKOFF_MULTIPLIER = 2
REQUEST_TIMEOUT_SECONDS = 120

# Dataset definitions
DATASETS = {
    "gekentekende_voertuigen": {
        "id": "m9d7-ebf2",
        "description": "Vehicle registrations",
        "filter": "voertuigsoort='Personenauto'",
        "page_size": PAGE_SIZE_MAX,
    },
    "meldingen_keuringsinstantie": {
        "id": "sgfe-77wx",
        "description": "Inspection reports",
        "filter": None,
        "page_size": PAGE_SIZE_MAX,
    },
    "geconstateerde_gebreken": {
        "id": "a34c-vvps",
        "description": "Detected defects",
        "filter": None,
        "page_size": PAGE_SIZE_MAX,
    },
    "gebreken": {
        "id": "hx2c-gt7k",
        "description": "Defect codes reference",
        "filter": None,
        "page_size": PAGE_SIZE_DEFAULT,
    },
    "brandstof": {
        "id": "8ys7-d773",
        "description": "Fuel types",
        "filter": None,
        "page_size": PAGE_SIZE_MAX,
    },
}


def env_load() -> None:
    """Load environment variables from .env file if it exists."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        logger.info("Loading environment variables from .env file")
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip("\"'")
                    if key not in os.environ:
                        os.environ[key] = value


def token_get() -> str | None:
    """
    Retrieve the RDW API app token from environment.

    Returns:
        App token string or None if not configured.
    """
    token = os.environ.get("RDW_APP_TOKEN")
    if token:
        logger.info("Using RDW app token from environment")
    else:
        logger.warning("No RDW_APP_TOKEN found. Requests may be throttled by IP.")
    return token


def headers_build(token: str | None) -> dict[str, str]:
    """
    Build HTTP headers for API requests.

    Args:
        token: Optional app token for authentication.

    Returns:
        Dictionary of HTTP headers.
    """
    headers = {
        "Accept": "application/json",
    }
    if token:
        headers["X-App-Token"] = token
    return headers


def url_build(
    dataset_id: str,
    limit: int,
    offset: int,
    filter_clause: str | None = None,
) -> str:
    """
    Build the API URL with query parameters.

    Args:
        dataset_id: The Socrata dataset identifier.
        limit: Number of rows to fetch.
        offset: Starting row offset for pagination.
        filter_clause: Optional SoQL WHERE clause.

    Returns:
        Complete API URL string.
    """
    url = f"{API_BASE_URL}/{dataset_id}.json?$limit={limit}&$offset={offset}"
    if filter_clause:
        url += f"&$where={requests.utils.quote(filter_clause)}"
    return url


def request_with_backoff(
    url: str,
    headers: dict[str, str],
    max_retries: int = 5,
) -> requests.Response:
    """
    Make HTTP request with exponential backoff on rate limit errors.

    Args:
        url: The URL to request.
        headers: HTTP headers to include.
        max_retries: Maximum number of retry attempts.

    Returns:
        Response object on success.

    Raises:
        requests.RequestException: If all retries fail.
    """
    backoff_seconds = BACKOFF_INITIAL_SECONDS

    for attempt in range(max_retries + 1):
        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )

            if response.status_code == 429:
                if attempt == max_retries:
                    response.raise_for_status()
                logger.warning(
                    "Rate limited (429). Waiting %d seconds before retry %d/%d",
                    backoff_seconds,
                    attempt + 1,
                    max_retries,
                )
                time.sleep(backoff_seconds)
                backoff_seconds = min(
                    backoff_seconds * BACKOFF_MULTIPLIER,
                    BACKOFF_MAX_SECONDS,
                )
                continue

            response.raise_for_status()
            return response

        except requests.exceptions.Timeout:
            if attempt == max_retries:
                raise
            logger.warning(
                "Request timeout. Waiting %d seconds before retry %d/%d",
                backoff_seconds,
                attempt + 1,
                max_retries,
            )
            time.sleep(backoff_seconds)
            backoff_seconds = min(
                backoff_seconds * BACKOFF_MULTIPLIER,
                BACKOFF_MAX_SECONDS,
            )

    raise requests.RequestException(
        f"Failed to fetch {url} after {max_retries} retries"
    )


def dataset_fetch(
    dataset_id: str,
    headers: dict[str, str],
    page_size: int = PAGE_SIZE_DEFAULT,
    filter_clause: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch all rows from a dataset using pagination.

    Args:
        dataset_id: The Socrata dataset identifier.
        headers: HTTP headers for requests.
        page_size: Number of rows per page.
        filter_clause: Optional SoQL WHERE clause.

    Returns:
        List of all records from the dataset.
    """
    records_all: list[dict[str, Any]] = []
    offset = 0

    logger.info(
        "Fetching dataset %s with page size %d",
        dataset_id,
        page_size,
    )

    while True:
        url = url_build(dataset_id, page_size, offset, filter_clause)
        response = request_with_backoff(url, headers)
        records_page = response.json()

        if not records_page:
            break

        records_all.extend(records_page)
        rows_fetched = len(records_page)
        logger.info(
            "Fetched %d rows (total: %d, offset: %d)",
            rows_fetched,
            len(records_all),
            offset,
        )

        if rows_fetched < page_size:
            break

        offset += page_size

    return records_all


def output_dir_ensure() -> Path:
    """
    Ensure the output directory exists.

    Returns:
        Path to the output directory.
    """
    output_dir = Path(__file__).parent.parent / "data" / "raw"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def data_save(data: list[dict[str, Any]], filename: str, output_dir: Path) -> None:
    """
    Save data to a JSON file.

    Args:
        data: List of records to save.
        filename: Name of the output file.
        output_dir: Directory to save the file in.
    """
    filepath = output_dir / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    file_size_mb = filepath.stat().st_size / (1024 * 1024)
    logger.info("Saved %s (%.2f MB, %d records)", filepath, file_size_mb, len(data))


def datasets_download() -> dict[str, int]:
    """
    Download all configured datasets.

    Returns:
        Dictionary mapping dataset names to record counts.
    """
    env_load()
    token = token_get()
    headers = headers_build(token)
    output_dir = output_dir_ensure()

    results: dict[str, int] = {}

    for name, config in DATASETS.items():
        logger.info(
            "Starting download: %s (%s)",
            name,
            config["description"],
        )
        start_time = time.time()

        try:
            data = dataset_fetch(
                dataset_id=config["id"],
                headers=headers,
                page_size=config["page_size"],
                filter_clause=config["filter"],
            )
            data_save(data, f"{name}.json", output_dir)
            results[name] = len(data)

            elapsed = time.time() - start_time
            logger.info(
                "Completed %s: %d records in %.1f seconds",
                name,
                len(data),
                elapsed,
            )

        except requests.RequestException as e:
            logger.error("Failed to download %s: %s", name, e)
            results[name] = 0

    return results


def summary_print(results: dict[str, int]) -> None:
    """
    Print a summary of download results.

    Args:
        results: Dictionary mapping dataset names to record counts.
    """
    logger.info("=" * 50)
    logger.info("Download Summary")
    logger.info("=" * 50)
    total_records = 0
    for name, count in results.items():
        status = "OK" if count > 0 else "FAILED"
        logger.info("  %s: %d records [%s]", name, count, status)
        total_records += count
    logger.info("=" * 50)
    logger.info("Total records: %d", total_records)


def main() -> None:
    """Main entry point for the data download script."""
    logger.info("Starting RDW data download (Stage 1)")
    start_time = time.time()

    results = datasets_download()
    summary_print(results)

    elapsed = time.time() - start_time
    logger.info("Total download time: %.1f seconds", elapsed)

    # Exit with error code if any downloads failed
    failed_count = sum(1 for count in results.values() if count == 0)
    if failed_count > 0:
        logger.error("%d dataset(s) failed to download", failed_count)
        exit(1)


if __name__ == "__main__":
    main()
