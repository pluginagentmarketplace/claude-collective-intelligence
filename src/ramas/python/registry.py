#!/usr/bin/env python3
"""
RAMAS Window Registry

Port from: window-registry.js (202 lines)

Manages worker terminal window information.
Stores in JSON file: /tmp/ramas-windows.json

Key differences from JS version:
- Uses dataclasses for type safety
- Supports both sync and async file I/O
- Path handling via pathlib

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

import json
import os
import time
from pathlib import Path
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field, asdict
from enum import Enum

# Optional async file I/O
try:
    import aiofiles
    HAS_AIOFILES = True
except ImportError:
    HAS_AIOFILES = False


# =============================================================================
# Constants
# =============================================================================

# Registry file path (same as JS version)
REGISTRY_PATH = os.environ.get(
    "RAMAS_REGISTRY_PATH",
    "/tmp/ramas-windows.json"
)


class WorkerStatus(Enum):
    """Worker availability status"""
    GREEN = "green"  # Available, accepting messages
    RED = "red"      # Busy, messages queued


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class WindowInfo:
    """Information about a worker's terminal window"""
    window_id: str
    session_id: Optional[str] = None
    status: str = "green"
    registered_at: int = field(default_factory=lambda: int(time.time() * 1000))
    last_status_change: int = field(default_factory=lambda: int(time.time() * 1000))
    previous_status: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "windowId": self.window_id,
            "sessionId": self.session_id,
            "status": self.status,
            "registeredAt": self.registered_at,
            "lastStatusChange": self.last_status_change,
            "previousStatus": self.previous_status,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WindowInfo":
        """Create from dictionary (JSON deserialization)"""
        return cls(
            window_id=str(data.get("windowId", "")),
            session_id=data.get("sessionId"),
            status=data.get("status", "green"),
            registered_at=data.get("registeredAt", int(time.time() * 1000)),
            last_status_change=data.get("lastStatusChange", int(time.time() * 1000)),
            previous_status=data.get("previousStatus"),
        )


@dataclass
class Registry:
    """RAMAS window registry structure"""
    version: str = "2.0.0"  # Python version
    created: Optional[int] = None
    updated: Optional[int] = None
    windows: Dict[str, WindowInfo] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return {
            "version": self.version,
            "created": self.created,
            "updated": self.updated,
            "windows": {
                worker_id: window.to_dict()
                for worker_id, window in self.windows.items()
            }
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Registry":
        """Create from dictionary (JSON deserialization)"""
        windows = {}
        for worker_id, window_data in data.get("windows", {}).items():
            windows[worker_id] = WindowInfo.from_dict(window_data)

        return cls(
            version=data.get("version", "2.0.0"),
            created=data.get("created"),
            updated=data.get("updated"),
            windows=windows,
        )


# =============================================================================
# Synchronous Functions (Direct port from JS)
# =============================================================================

def _load_registry() -> Registry:
    """Load registry from file (sync)"""
    try:
        path = Path(REGISTRY_PATH)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return Registry.from_dict(data)
    except Exception as e:
        print(f"[RAMAS] Registry load error: {e}")

    # Return empty registry
    return Registry(created=int(time.time() * 1000))


def _save_registry(registry: Registry) -> bool:
    """Save registry to file (sync)"""
    try:
        registry.updated = int(time.time() * 1000)
        path = Path(REGISTRY_PATH)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(registry.to_dict(), f, indent=2)

        return True
    except Exception as e:
        print(f"[RAMAS] Registry save error: {e}")
        return False


def save_window(
    worker_id: str,
    window_id: str,
    session_id: Optional[str] = None,
    status: str = "green"
) -> bool:
    """
    Save worker window information.

    Args:
        worker_id: Worker ID (e.g., "worker-001")
        window_id: iTerm2 window ID
        session_id: iTerm2 session ID (optional)
        status: Initial status ("green" or "red")

    Returns:
        bool: True if successful
    """
    registry = _load_registry()

    registry.windows[worker_id] = WindowInfo(
        window_id=str(window_id),
        session_id=str(session_id) if session_id else None,
        status=status,
    )

    return _save_registry(registry)


def get_window(worker_id: str) -> Optional[WindowInfo]:
    """
    Get worker window information.

    Args:
        worker_id: Worker ID

    Returns:
        WindowInfo or None if not found
    """
    registry = _load_registry()
    return registry.windows.get(worker_id)


def get_all_windows() -> Dict[str, WindowInfo]:
    """
    Get all worker windows.

    Returns:
        Dict mapping worker_id to WindowInfo
    """
    registry = _load_registry()
    return registry.windows


def update_status(worker_id: str, status: str) -> bool:
    """
    Update worker status.

    Args:
        worker_id: Worker ID
        status: New status ("green" or "red")

    Returns:
        bool: True if successful
    """
    if status not in ["green", "red"]:
        print(f"[RAMAS] Invalid status: {status}. Must be 'green' or 'red'")
        return False

    registry = _load_registry()

    if worker_id not in registry.windows:
        print(f"[RAMAS] Worker not found: {worker_id}")
        return False

    window = registry.windows[worker_id]
    window.previous_status = window.status
    window.status = status
    window.last_status_change = int(time.time() * 1000)

    return _save_registry(registry)


def remove_window(worker_id: str) -> bool:
    """
    Remove worker from registry.

    Args:
        worker_id: Worker ID

    Returns:
        bool: True if successful
    """
    registry = _load_registry()

    if worker_id in registry.windows:
        del registry.windows[worker_id]
        return _save_registry(registry)

    return False


def get_workers_by_status(status: str) -> List[str]:
    """
    Get workers with specific status.

    Args:
        status: Filter status ("green" or "red")

    Returns:
        List of worker IDs
    """
    registry = _load_registry()
    return [
        worker_id
        for worker_id, window in registry.windows.items()
        if window.status == status
    ]


def clear_registry() -> bool:
    """
    Clear all workers from registry.

    Returns:
        bool: True if successful
    """
    registry = Registry(created=int(time.time() * 1000))
    return _save_registry(registry)


def exists() -> bool:
    """
    Check if registry file exists.

    Returns:
        bool: True if exists
    """
    return Path(REGISTRY_PATH).exists()


def get_stats() -> Dict[str, Any]:
    """
    Get registry statistics.

    Returns:
        Dict with stats
    """
    registry = _load_registry()
    windows = list(registry.windows.values())

    return {
        "total": len(windows),
        "green": sum(1 for w in windows if w.status == "green"),
        "red": sum(1 for w in windows if w.status == "red"),
        "registryPath": REGISTRY_PATH,
        "created": registry.created,
        "updated": registry.updated,
    }


# =============================================================================
# Async Functions (Bonus feature for Python)
# =============================================================================

async def async_load_registry() -> Registry:
    """Load registry from file (async)"""
    if not HAS_AIOFILES:
        return _load_registry()

    try:
        path = Path(REGISTRY_PATH)
        if path.exists():
            async with aiofiles.open(path, "r", encoding="utf-8") as f:
                content = await f.read()
                data = json.loads(content)
                return Registry.from_dict(data)
    except Exception as e:
        print(f"[RAMAS] Async registry load error: {e}")

    return Registry(created=int(time.time() * 1000))


async def async_save_registry(registry: Registry) -> bool:
    """Save registry to file (async)"""
    if not HAS_AIOFILES:
        return _save_registry(registry)

    try:
        registry.updated = int(time.time() * 1000)
        path = Path(REGISTRY_PATH)

        async with aiofiles.open(path, "w", encoding="utf-8") as f:
            await f.write(json.dumps(registry.to_dict(), indent=2))

        return True
    except Exception as e:
        print(f"[RAMAS] Async registry save error: {e}")
        return False


async def async_save_window(
    worker_id: str,
    window_id: str,
    session_id: Optional[str] = None,
    status: str = "green"
) -> bool:
    """Save worker window information (async)"""
    registry = await async_load_registry()

    registry.windows[worker_id] = WindowInfo(
        window_id=str(window_id),
        session_id=str(session_id) if session_id else None,
        status=status,
    )

    return await async_save_registry(registry)


async def async_update_status(worker_id: str, status: str) -> bool:
    """Update worker status (async)"""
    if status not in ["green", "red"]:
        print(f"[RAMAS] Invalid status: {status}")
        return False

    registry = await async_load_registry()

    if worker_id not in registry.windows:
        print(f"[RAMAS] Worker not found: {worker_id}")
        return False

    window = registry.windows[worker_id]
    window.previous_status = window.status
    window.status = status
    window.last_status_change = int(time.time() * 1000)

    return await async_save_registry(registry)


# =============================================================================
# WindowRegistry Class (Optional OOP wrapper)
# =============================================================================

class WindowRegistry:
    """
    OOP wrapper for window registry operations.

    Usage:
        registry = WindowRegistry()
        registry.save_window("worker-001", "12345")
        info = registry.get_window("worker-001")
    """

    def __init__(self, path: Optional[str] = None):
        self.path = path or REGISTRY_PATH

    def save_window(
        self,
        worker_id: str,
        window_id: str,
        session_id: Optional[str] = None,
        status: str = "green"
    ) -> bool:
        return save_window(worker_id, window_id, session_id, status)

    def get_window(self, worker_id: str) -> Optional[WindowInfo]:
        return get_window(worker_id)

    def get_all_windows(self) -> Dict[str, WindowInfo]:
        return get_all_windows()

    def update_status(self, worker_id: str, status: str) -> bool:
        return update_status(worker_id, status)

    def remove_window(self, worker_id: str) -> bool:
        return remove_window(worker_id)

    def get_workers_by_status(self, status: str) -> List[str]:
        return get_workers_by_status(status)

    def clear(self) -> bool:
        return clear_registry()

    def exists(self) -> bool:
        return exists()

    def get_stats(self) -> Dict[str, Any]:
        return get_stats()


# =============================================================================
# Main (for testing)
# =============================================================================

def main():
    """Test the registry"""
    print("Testing RAMAS Window Registry...")
    print(f"Registry path: {REGISTRY_PATH}")

    # Clear and test
    clear_registry()
    print(f"Exists: {exists()}")

    # Save some windows
    save_window("team-leader", "4039", "session-1", "green")
    save_window("worker-001", "4040", "session-2", "green")
    save_window("worker-002", "4041", "session-3", "red")

    # Get stats
    stats = get_stats()
    print(f"Stats: {json.dumps(stats, indent=2)}")

    # Get by status
    green_workers = get_workers_by_status("green")
    red_workers = get_workers_by_status("red")
    print(f"Green workers: {green_workers}")
    print(f"Red workers: {red_workers}")

    # Update status
    update_status("worker-001", "red")
    info = get_window("worker-001")
    print(f"Worker-001 after update: {info.to_dict() if info else None}")


if __name__ == "__main__":
    main()
