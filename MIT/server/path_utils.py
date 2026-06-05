"""Path validation helpers for MIT result endpoints (Issue #102)."""
from pathlib import Path


def safe_result_folder(root: Path, folder_name: str) -> Path:
    """Return the resolved path for *folder_name* inside *root*.

    Raises ValueError for any name that is empty, contains path separators,
    contains '..', or whose resolved path escapes *root* (covers symlink
    attacks and encoded variants that slip past the string checks).
    """
    if not folder_name or ".." in folder_name or "/" in folder_name or "\\" in folder_name:
        raise ValueError(f"Invalid folder name: {folder_name!r}")
    resolved = (root / folder_name).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        raise ValueError(f"Path escapes result root: {folder_name!r}")
    return resolved
