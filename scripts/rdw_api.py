"""
RDW API utilities for data download scripts.

Provides HTTP session management, rate limiting, and API helpers
for interacting with the RDW Open Data (Socrata) API.
"""

import os
import threading
import time
from pathlib import Path
from typing import Any

import requests

API_BASE_URL = "https://opendata.rdw.nl/resource"
REQUEST_TIMEOUT = 180

# Module-level verbose flag (set by main script)
_verbose = False


def verbose_set(value: bool) -> None:
    """Set verbose mode for logging."""
    global _verbose
    _verbose = value


def log(msg: str) -> None:
    """Print message if verbose mode is enabled."""
    if _verbose:
        print(msg, flush=True)


def log_always(msg: str) -> None:
    """Always print message (for progress and errors)."""
    print(msg, flush=True)


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


def token_get() -> str | None:
    """Get app token from environment (supports multiple variable names)."""
    for var in ["RDW_APP_TOKEN", "APP_Token"]:
        if token := os.environ.get(var):
            return token
    return None


class RateLimiter:
    """Dynamic rate limiter that adjusts concurrency based on 429 responses."""

    def __init__(self, initial_workers: int, min_workers: int = 2) -> None:
        self.current_workers = initial_workers
        self.min_workers = min_workers
        self.lock = threading.Lock()
        self.rate_limit_count = 0
        self.last_scale_down = 0.0
        self.cooldown = 30.0

    def on_rate_limit(self) -> int:
        """Called on 429. Returns wait time in seconds."""
        with self.lock:
            self.rate_limit_count += 1
            now = time.time()
            if now - self.last_scale_down > self.cooldown:
                old = self.current_workers
                self.current_workers = max(self.min_workers, self.current_workers // 2)
                if old != self.current_workers:
                    log_always(f"Rate limit: workers {old} -> {self.current_workers}")
                self.last_scale_down = now
            return min(2 ** min(self.rate_limit_count, 5), 32)

    def on_success(self) -> None:
        """Called on successful request."""
        with self.lock:
            if self.rate_limit_count > 0:
                self.rate_limit_count -= 1

    def get_workers(self) -> int:
        """Get current worker count."""
        with self.lock:
            return self.current_workers


# Global rate limiter instance
RATE_LIMITER = RateLimiter(initial_workers=8, min_workers=2)


def session_create() -> requests.Session:
    """Create HTTP session with connection pooling and app token."""
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(
        pool_connections=10,
        pool_maxsize=20,
        max_retries=requests.adapters.Retry(
            total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504]
        ),
    )
    session.mount("https://", adapter)
    session.headers["Accept"] = "application/json"
    if token := token_get():
        session.headers["X-App-Token"] = token
        log(f"Using app token: {token[:8]}...")
    else:
        log_always("Warning: No app token, requests may be throttled")
    return session


def api_get(
    session: requests.Session, url: str, timeout: int = REQUEST_TIMEOUT
) -> list[dict[str, Any]]:
    """Make API request with retry on errors including connection failures."""
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code == 429:
                wait = RATE_LIMITER.on_rate_limit()
                log(f"Rate limited (429), waiting {wait}s...")
                time.sleep(wait)
                continue
            r.raise_for_status()
            RATE_LIMITER.on_success()
            return r.json()
        except (
            requests.exceptions.Timeout,
            requests.exceptions.ConnectionError,
            requests.exceptions.ChunkedEncodingError,
        ) as e:
            wait = 2 ** (attempt + 1)
            if attempt < max_attempts - 1:
                log(
                    f"Connection error (attempt {attempt + 1}): {e}, retrying in {wait}s"
                )
                time.sleep(wait)
            else:
                raise
        except requests.exceptions.RequestException:
            raise
    raise requests.RequestException(f"Failed after {max_attempts} attempts: {url}")


def row_count_get(
    session: requests.Session,
    dataset_id: str,
    filter_clause: str | None = None,
    group_field: str | None = None,
) -> int:
    """Get total row count for a dataset.

    Args:
        session: HTTP session
        dataset_id: Socrata dataset ID
        filter_clause: Optional WHERE clause
        group_field: If set, count distinct values of this field (for grouped queries)
    """
    if group_field:
        url = f"{API_BASE_URL}/{dataset_id}.json?$select=count(distinct {group_field})"
    else:
        url = f"{API_BASE_URL}/{dataset_id}.json?$select=count(*)"
    if filter_clause:
        url += f"&$where={requests.utils.quote(filter_clause)}"
    data = api_get(session, url, timeout=60)
    # Response key varies: "count" or "count_distinct_<field>"
    if data:
        for key in data[0]:
            if key.startswith("count"):
                return int(data[0][key])
    return 0


def page_fetch(
    session: requests.Session,
    dataset_id: str,
    offset: int,
    page_size: int,
    select_clause: str | None = None,
    filter_clause: str | None = None,
    group_clause: str | None = None,
    order_clause: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch a single page of data."""
    url = f"{API_BASE_URL}/{dataset_id}.json?$limit={page_size}&$offset={offset}"
    if select_clause:
        url += f"&$select={requests.utils.quote(select_clause)}"
    if filter_clause:
        url += f"&$where={requests.utils.quote(filter_clause)}"
    if group_clause:
        url += f"&$group={requests.utils.quote(group_clause)}"
    if order_clause:
        url += f"&$order={requests.utils.quote(order_clause)}"
    return api_get(session, url)


class ProgressTracker:
    """Thread-safe progress tracker with percentage display."""

    def __init__(self, name: str, total: int) -> None:
        self.name = name
        self.total = total
        self.completed = 0
        self.lock = threading.Lock()
        self.last_pct = -1

    def update(self, count: int) -> None:
        """Update progress and print if percentage changed (5% increments)."""
        with self.lock:
            self.completed += count
            if self.total > 0:
                pct = int((self.completed / self.total) * 100)
                if pct >= self.last_pct + 5 or pct == 100:
                    self.last_pct = pct
                    log_always(f"[{self.name}] {pct}%")


class MultiDatasetProgress:
    """Thread-safe progress tracker for multiple datasets."""

    def __init__(self, datasets: dict[str, tuple[int, int]]) -> None:
        """
        Initialize with dataset info.

        Args:
            datasets: dict of {name: (total_rows, total_pages)}
        """
        self.datasets = list(datasets.keys())
        self.total_rows = {name: info[0] for name, info in datasets.items()}
        self.total_pages = {name: info[1] for name, info in datasets.items()}
        self.completed_pages: dict[str, int] = {name: 0 for name in self.datasets}
        self.completed_rows: dict[str, int] = {name: 0 for name in self.datasets}
        self.written_bytes: dict[str, int] = {name: 0 for name in self.datasets}
        self.done: set[str] = set()
        self.lock = threading.Lock()
        self.last_pct: dict[str, int] = {name: -1 for name in self.datasets}

    def update(
        self, name: str, pages_done: int = 1, rows_done: int = 0, bytes_written: int = 0
    ) -> None:
        """Update progress for a dataset."""
        with self.lock:
            self.completed_pages[name] += pages_done
            self.completed_rows[name] += rows_done
            self.written_bytes[name] += bytes_written
            self._print_progress(name)

    def mark_done(self, name: str) -> None:
        """Mark a dataset as complete."""
        with self.lock:
            self.done.add(name)
            self._print_done(name)

    def _print_progress(self, name: str) -> None:
        """Print progress if percentage changed."""
        current = self.completed_pages[name]
        total = self.total_pages[name]
        if total > 0:
            pct = min(100, int((current / total) * 100))
            if pct > self.last_pct[name]:
                self.last_pct[name] = pct
                rows = self.completed_rows[name]
                total_rows = self.total_rows[name]
                size_mb = self.written_bytes[name] / (1024 * 1024)
                print(
                    f"{name}: {pct}% | page {current}/{total} | rows {rows:,}/{total_rows:,} | {size_mb:.1f} MB",
                    flush=True,
                )

    def _print_done(self, name: str) -> None:
        """Print done message with file size."""
        from pathlib import Path

        filepath = Path(__file__).parent.parent / "data" / "raw" / f"{name}.json"
        if filepath.exists():
            size_mb = filepath.stat().st_size / (1024 * 1024)
            print(f"{name}: done ({size_mb:.1f} MB)", flush=True)
        else:
            print(f"{name}: done", flush=True)

    def finish(self) -> None:
        """No-op for compatibility."""
        pass
