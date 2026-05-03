"""
RDW API client functions.

Handles HTTP session management, API requests, and retry logic.
"""

import io
import os
import time
from pathlib import Path
from typing import BinaryIO

import polars as pl
import requests

from config import API_BASE, REQUEST_TIMEOUT

# URL templates
COUNT_URL = API_BASE + "/resource/{id}.json?$select=count(*)"
CSV_URL = API_BASE + "/resource/{id}.csv"

# Dynamic worker scaling for parallel downloads.
PARALLEL_WORKERS = int(
    os.environ.get(
        "RDW_WORKERS",
        min(32, (os.cpu_count() or 1) + 4),
    )
)


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
        print("Using app token: [MASKED]")
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


def csv_stream_download(
    session: requests.Session,
    dataset_id: str,
    where_clause: str | None,
    row_limit: int,
    output: BinaryIO,
) -> None:
    """Stream a CSV export from RDW to a writable binary stream."""
    params = {"$limit": str(row_limit)}
    if where_clause:
        params["$where"] = where_clause
    max_retries = 5

    for attempt in range(max_retries):
        try:
            if attempt > 0:
                output.seek(0)
                output.truncate()
            with session.get(
                CSV_URL.format(id=dataset_id),
                params=params,
                stream=True,
                timeout=REQUEST_TIMEOUT,
            ) as response:
                response.raise_for_status()
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        output.write(chunk)
            return
        except (
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.ConnectionError,
            requests.exceptions.HTTPError,
            requests.exceptions.Timeout,
        ) as e:
            if attempt == max_retries - 1:
                raise
            wait_time = 2**attempt
            shard = where_clause or "full export"
            print(f"  [retry] CSV shard {shard} failed: {e}, retrying in {wait_time}s...")
            time.sleep(wait_time)

    raise RuntimeError(f"Failed to fetch CSV shard for {dataset_id} after {max_retries} attempts")
