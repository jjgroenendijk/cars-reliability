"""Shared system and filesystem utilities for the Stage 1-2 pipeline.

Small cross-cutting helpers (process memory, filesystem sizing and removal)
used by multiple pipeline scripts. Kept dependency-light and side-effect free.
"""

import shutil
from pathlib import Path

import psutil


def memory_mb() -> float:
    """Return the current process resident memory in MB."""
    return psutil.Process().memory_info().rss / (1024 * 1024)


def path_size_mb(path: Path) -> float:
    """Return a file or directory size in MB."""
    if path.is_dir():
        size = sum(child.stat().st_size for child in path.rglob("*") if child.is_file())
    else:
        size = path.stat().st_size
    return size / (1024 * 1024)


def path_remove(path: Path) -> None:
    """Remove a file or directory if it exists."""
    if path.is_dir():
        shutil.rmtree(path)
    elif path.exists():
        path.unlink()
