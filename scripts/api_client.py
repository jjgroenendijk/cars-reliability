"""
RDW API client functions.

Handles HTTP session management, API requests, and retry logic.
"""

import io
import os
import time
from pathlib import Path

import polars as pl
import requests

from config import API_BASE, REQUEST_TIMEOUT

# URL templates
COUNT_URL = API_BASE + "/resource/{id}.json?$select=count(*)"
RESOURCE_URL = API_BASE + "/resource/{id}.json?$limit={limit}&$offset={offset}"

# Dynamic worker scaling for parallel downloads
PARALLEL_WORKERS = min(32, (os.cpu_count() or 1) + 4)


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


def session_create() -> requests.Session:
    """Create HTTP session with connection pooling optimized for parallel downloads."""
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(
        pool_connections=PARALLEL_WORKERS,
        pool_maxsize=PARALLEL_WORKERS,
        max_retries=requests.adapters.Retry(
            total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504]
        ),
    )
    session.mount("https://", adapter)
    if token := os.environ.get("RDW_APP_TOKEN") or os.environ.get("APP_Token"):
        session.headers["X-App-Token"] = token
        print(f"Using app token: {token[:8]}...")
    return session


def row_count_get(session: requests.Session, dataset_id: str) -> int | None:
    """Get total row count for progress percentage."""
    url = COUNT_URL.format(id=dataset_id)
    max_retries = 3

    for attempt in range(max_retries):
        try:
            r = session.get(url, timeout=60)
            r.raise_for_status()
            df = pl.read_json(io.BytesIO(r.content))
            if "count" in df.columns and len(df) > 0:
                return int(df["count"][0])
            print(f"  [count] unexpected response: {df}")
            return None
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** (attempt + 1)
                print(f"  [count] attempt {attempt + 1} failed: {e}, retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"  [count] all attempts failed: {e}")
                return None
    return None


def page_fetch(session: requests.Session, dataset_id: str, offset: int, limit: int) -> list[dict]:
    """Fetch a single page of data from the API with retry logic."""
    url = RESOURCE_URL.format(id=dataset_id, limit=limit, offset=offset)
    max_retries = 5

    for attempt in range(max_retries):
        try:
            r = session.get(url, timeout=REQUEST_TIMEOUT)
            r.raise_for_status()
            return r.json()
        except (
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
        ) as e:
            if attempt == max_retries - 1:
                raise  # Re-raise on final attempt
            wait_time = 2**attempt  # Exponential backoff: 1, 2, 4, 8, 16 seconds
            print(f"  [retry] page at offset {offset} failed: {e}, retrying in {wait_time}s...")
            time.sleep(wait_time)

    # Should never reach here, but just in case
    raise RuntimeError(f"Failed to fetch page at offset {offset} after {max_retries} attempts")
