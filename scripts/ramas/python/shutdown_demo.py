#!/usr/bin/env python3
"""
RAMAS Demo Shutdown Script

Safely shuts down RAMAS demo environment:
1. Sends /exit to each Claude Code session
2. Waits for Claude Code to exit gracefully
3. Closes iTerm2 windows
4. Kills daemon if running
5. Cleans up registry and logs

Usage:
    python scripts/ramas/python/shutdown_demo.py
    python scripts/ramas/python/shutdown_demo.py --force  # Skip /exit, close immediately

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

import argparse
import asyncio
import json
import os
import signal
import subprocess
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import iterm2
except ImportError:
    print("Error: iterm2 not installed. Run: uv pip install iterm2")
    sys.exit(1)

from src.ramas.python import registry
from src.ramas.python import controller


# =============================================================================
# Configuration
# =============================================================================

REGISTRY_PATH = Path("/tmp/ramas-windows.json")
DAEMON_LOG = Path("/tmp/ramas-daemon.log")
SESSION_INBOXES_DIR = Path("/tmp/ramas-session-inboxes")
SESSION_REGISTRY = Path("/tmp/ramas-session-registry.json")
CLAUDE_EXIT_COMMAND = "/exit"
GRACE_PERIOD = 3  # Seconds to wait after /exit
ENTER_DELAY = 1.0  # Delay before pressing Enter (critical for Claude Code!)

# Trash directory (macOS)
TRASH_DIR = Path.home() / ".Trash"


# =============================================================================
# Safe Delete Utilities (CLAUDE.md Compliance: NO rm -rf!)
# =============================================================================

def safe_delete_file(path: Path, dry_run: bool = False) -> bool:
    """
    Safely delete a file by moving to Trash.

    IMPORTANT: This follows CLAUDE.md rules - NO rm -rf!
    Files go to Trash and can be recovered if needed.

    Args:
        path: File path to delete
        dry_run: If True, only print what would be done

    Returns:
        True if successful, False otherwise
    """
    if not path.exists():
        return False

    # Generate unique trash name (handle conflicts)
    trash_name = path.name
    trash_dest = TRASH_DIR / trash_name
    counter = 1
    while trash_dest.exists():
        trash_name = f"{path.stem}_{counter}{path.suffix}"
        trash_dest = TRASH_DIR / trash_name
        counter += 1

    if dry_run:
        print(f"   [DRY-RUN] Would move: {path} → {trash_dest}")
        return True

    try:
        import shutil
        shutil.move(str(path), str(trash_dest))
        return True
    except Exception as e:
        print(f"   ⚠️  Failed to move {path} to Trash: {e}")
        return False


def safe_delete_directory(path: Path, dry_run: bool = False) -> bool:
    """
    Safely delete a directory by moving to Trash.

    IMPORTANT: This follows CLAUDE.md rules - NO rm -rf!
    Directories go to Trash and can be recovered if needed.

    Args:
        path: Directory path to delete
        dry_run: If True, only print what would be done

    Returns:
        True if successful, False otherwise
    """
    if not path.exists():
        return False

    if not path.is_dir():
        return safe_delete_file(path, dry_run)

    # Generate unique trash name (handle conflicts)
    trash_name = path.name
    trash_dest = TRASH_DIR / trash_name
    counter = 1
    while trash_dest.exists():
        trash_name = f"{path.name}_{counter}"
        trash_dest = TRASH_DIR / trash_name
        counter += 1

    if dry_run:
        print(f"   [DRY-RUN] Would move directory: {path} → {trash_dest}")
        return True

    try:
        import shutil
        shutil.move(str(path), str(trash_dest))
        return True
    except Exception as e:
        print(f"   ⚠️  Failed to move {path} to Trash: {e}")
        return False


# =============================================================================
# Functions
# =============================================================================

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Safely shutdown RAMAS demo environment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                    # Graceful shutdown with /exit
  %(prog)s --force            # Skip /exit, close windows immediately
  %(prog)s --dry-run          # Preview what would be deleted
  %(prog)s --keep-logs        # Keep log files after shutdown
  %(prog)s --cleanup-only     # Only delete temp files (no window close)

Safety Note:
  Files are moved to ~/.Trash/ (NOT permanently deleted).
  You can recover them from Finder → Trash if needed.
        """
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip /exit command, close windows immediately"
    )
    parser.add_argument(
        "--keep-logs",
        action="store_true",
        help="Don't delete log files"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be deleted without actually deleting"
    )
    parser.add_argument(
        "--cleanup-only",
        action="store_true",
        help="Only clean up temp files (skip window shutdown)"
    )
    return parser.parse_args()


def kill_daemon():
    """Kill RAMAS daemon if running"""
    print("🔪 Stopping RAMAS Daemon...")

    result = subprocess.run(
        ["pkill", "-f", "src.ramas.python.daemon"],
        capture_output=True
    )

    if result.returncode == 0:
        print("   ✅ Daemon stopped")
    else:
        print("   ℹ️  No daemon running")


async def send_exit_to_session(session: iterm2.Session, worker_id: str) -> bool:
    """
    Send /exit command to Claude Code in a session.

    Uses the reliable "text → delay → enter" pattern to ensure
    the command is properly submitted to Claude Code.
    """
    try:
        print(f"   📤 Sending /exit to {worker_id}...")
        # Use reliable pattern: text → delay → enter
        await controller.send_command_reliable(session, CLAUDE_EXIT_COMMAND)
        return True
    except Exception as e:
        print(f"   ⚠️  Failed to send /exit to {worker_id}: {e}")
        return False


async def close_window(window: iterm2.Window, worker_id: str) -> bool:
    """Close an iTerm2 window"""
    try:
        print(f"   🚪 Closing window for {worker_id}...")
        await window.async_close(force=True)
        return True
    except Exception as e:
        print(f"   ⚠️  Failed to close window for {worker_id}: {e}")
        return False


async def shutdown_windows(force: bool = False):
    """Shutdown all RAMAS demo windows"""

    # Read registry
    if not REGISTRY_PATH.exists():
        print("ℹ️  No registry found, nothing to shutdown")
        return

    try:
        with open(REGISTRY_PATH) as f:
            data = json.load(f)
        windows_data = data.get("windows", {})
    except Exception as e:
        print(f"❌ Failed to read registry: {e}")
        return

    if not windows_data:
        print("ℹ️  No windows in registry")
        return

    print(f"📋 Found {len(windows_data)} windows in registry")

    # Build session ID to worker ID mapping
    session_map = {
        info["sessionId"]: worker_id
        for worker_id, info in windows_data.items()
    }

    # Connect to iTerm2
    print("🖥️  Connecting to iTerm2...")
    try:
        connection = await iterm2.Connection.async_create()
        app = await iterm2.async_get_app(connection)
    except Exception as e:
        print(f"❌ Failed to connect to iTerm2: {e}")
        return

    # Find windows by session ID
    windows_to_close = []
    for window in app.windows:
        for tab in window.tabs:
            for session in tab.sessions:
                if session.session_id in session_map:
                    worker_id = session_map[session.session_id]
                    windows_to_close.append((window, session, worker_id))
                    break

    print(f"🔍 Found {len(windows_to_close)} matching windows")

    if not windows_to_close:
        print("ℹ️  No matching windows found")
        return

    # Phase 1: Send /exit to Claude Code (unless force)
    if not force:
        print()
        print("═" * 50)
        print("Phase 1: Sending /exit to Claude Code")
        print("═" * 50)

        for window, session, worker_id in windows_to_close:
            await send_exit_to_session(session, worker_id)

        print()
        print(f"⏳ Waiting {GRACE_PERIOD}s for Claude Code to exit...")
        await asyncio.sleep(GRACE_PERIOD)

    # Phase 2: Close windows
    print()
    print("═" * 50)
    print("Phase 2: Closing iTerm2 Windows")
    print("═" * 50)

    closed = 0
    for window, session, worker_id in windows_to_close:
        if await close_window(window, worker_id):
            closed += 1

    print()
    print(f"✅ Closed {closed}/{len(windows_to_close)} windows")


def cleanup_files(keep_logs: bool = False, dry_run: bool = False):
    """
    Clean up temporary files using SAFE deletion (move to Trash).

    IMPORTANT: This follows CLAUDE.md rules - NO rm -rf!
    All files are moved to ~/.Trash/ for potential recovery.

    Args:
        keep_logs: If True, don't delete log files
        dry_run: If True, only show what would be deleted
    """
    print()
    print("═" * 50)
    print("Cleanup: Temporary Files (Safe Delete → Trash)")
    print("═" * 50)

    if dry_run:
        print("   [DRY-RUN MODE - No files will be deleted]")
        print()

    # 1. Window Registry
    if REGISTRY_PATH.exists():
        if safe_delete_file(REGISTRY_PATH, dry_run):
            print(f"   ✅ Moved to Trash: {REGISTRY_PATH}")
        else:
            print(f"   ⚠️  Failed: {REGISTRY_PATH}")
    else:
        print(f"   ℹ️  Not found: {REGISTRY_PATH}")

    # 2. Session Registry
    if SESSION_REGISTRY.exists():
        if safe_delete_file(SESSION_REGISTRY, dry_run):
            print(f"   ✅ Moved to Trash: {SESSION_REGISTRY}")
        else:
            print(f"   ⚠️  Failed: {SESSION_REGISTRY}")
    else:
        print(f"   ℹ️  Not found: {SESSION_REGISTRY}")

    # 3. Session Inboxes Directory (entire directory)
    if SESSION_INBOXES_DIR.exists():
        inbox_count = len(list(SESSION_INBOXES_DIR.glob("*.json")))
        if safe_delete_directory(SESSION_INBOXES_DIR, dry_run):
            print(f"   ✅ Moved to Trash: {SESSION_INBOXES_DIR} ({inbox_count} inbox files)")
        else:
            print(f"   ⚠️  Failed: {SESSION_INBOXES_DIR}")
    else:
        print(f"   ℹ️  Not found: {SESSION_INBOXES_DIR}")

    # 4. Daemon log (optional)
    if not keep_logs:
        if DAEMON_LOG.exists():
            if safe_delete_file(DAEMON_LOG, dry_run):
                print(f"   ✅ Moved to Trash: {DAEMON_LOG}")
            else:
                print(f"   ⚠️  Failed: {DAEMON_LOG}")
        else:
            print(f"   ℹ️  Not found: {DAEMON_LOG}")
    else:
        print(f"   ℹ️  Keeping logs (--keep-logs)")

    print()
    print("   💡 Tip: Files can be recovered from ~/.Trash/ if needed")


def main():
    """Main entry point"""
    args = parse_args()

    print()
    print("═" * 50)
    print("     RAMAS Demo Shutdown (Safe Mode)")
    print("═" * 50)
    print()

    if args.dry_run:
        print("🔍 DRY-RUN MODE: No actual changes will be made")
        print()

    if not args.cleanup_only:
        # Kill daemon first
        if not args.dry_run:
            kill_daemon()
        else:
            print("   [DRY-RUN] Would kill RAMAS daemon")
        print()

        # Shutdown windows
        if not args.dry_run:
            asyncio.run(shutdown_windows(force=args.force))
        else:
            print("   [DRY-RUN] Would shutdown iTerm2 windows")
    else:
        print("ℹ️  Skipping window shutdown (--cleanup-only)")

    # Cleanup files (supports dry-run)
    cleanup_files(keep_logs=args.keep_logs, dry_run=args.dry_run)

    print()
    print("═" * 50)
    if args.dry_run:
        print("     🔍 Dry-Run Complete (no changes made)")
    else:
        print("     ✅ Shutdown Complete!")
    print("═" * 50)
    print()


if __name__ == "__main__":
    main()
