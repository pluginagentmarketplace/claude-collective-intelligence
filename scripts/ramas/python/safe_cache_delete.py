#!/usr/bin/env python3
"""
RAMAS Safe Cache Delete Script

Safely delete RAMAS cache and session files by moving to Trash.
Follows CLAUDE.md rules: NO rm -rf! All deletions go to ~/.Trash/

Features:
- Session-specific cleanup (by session number)
- Full cleanup (all RAMAS temp files)
- Dry-run mode for preview
- Interactive confirmation
- Recovery info (files can be restored from Trash)

Usage:
    python scripts/ramas/python/safe_cache_delete.py                    # Interactive mode
    python scripts/ramas/python/safe_cache_delete.py --all              # Delete all RAMAS files
    python scripts/ramas/python/safe_cache_delete.py --session SESSION  # Delete specific session
    python scripts/ramas/python/safe_cache_delete.py --dry-run          # Preview only
    python scripts/ramas/python/safe_cache_delete.py --list             # List all sessions

Author: Dr. Umit Kacar
Date: 2026-01-04
Safety: All files moved to ~/.Trash/ (recoverable!)
"""

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# =============================================================================
# Configuration
# =============================================================================

# RAMAS temp file locations
RAMAS_FILES = {
    "windows_registry": Path("/tmp/ramas-windows.json"),
    "session_registry": Path("/tmp/ramas-session-registry.json"),
    "session_inboxes": Path("/tmp/ramas-session-inboxes"),
    "daemon_log": Path("/tmp/ramas-daemon.log"),
    "daemon_new_log": Path("/tmp/ramas-daemon-new.log"),
}

# Trash directory (macOS)
TRASH_DIR = Path.home() / ".Trash"


# =============================================================================
# Safe Delete Utilities
# =============================================================================

def safe_delete(path: Path, dry_run: bool = False) -> Tuple[bool, str]:
    """
    Safely delete a file or directory by moving to Trash.

    IMPORTANT: This follows CLAUDE.md rules - NO rm -rf!

    Args:
        path: File or directory path
        dry_run: If True, only preview

    Returns:
        Tuple of (success, message)
    """
    if not path.exists():
        return False, f"Not found: {path}"

    # Generate unique trash name
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    trash_name = f"{path.name}_{timestamp}"
    trash_dest = TRASH_DIR / trash_name

    if dry_run:
        size = get_size_str(path)
        return True, f"[DRY-RUN] Would move: {path} ({size}) → Trash"

    try:
        shutil.move(str(path), str(trash_dest))
        return True, f"Moved to Trash: {path.name}"
    except Exception as e:
        return False, f"Failed: {path} - {e}"


def get_size_str(path: Path) -> str:
    """Get human-readable size of file or directory"""
    if not path.exists():
        return "0 B"

    if path.is_file():
        size = path.stat().st_size
    else:
        size = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())

    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


# =============================================================================
# Session Discovery
# =============================================================================

def list_sessions() -> List[Dict]:
    """List all sessions from registry"""
    registry_path = RAMAS_FILES["session_registry"]

    if not registry_path.exists():
        return []

    try:
        with open(registry_path) as f:
            data = json.load(f)

        sessions = []
        for session_id, info in data.get("sessions", {}).items():
            sessions.append({
                "id": session_id,
                "name": info.get("session_name", "Unknown"),
                "created": info.get("created_at", "Unknown"),
                "state": info.get("state", "unknown"),
                "participants": info.get("participants", []),
            })

        return sorted(sessions, key=lambda x: x["created"], reverse=True)
    except Exception as e:
        print(f"Error reading registry: {e}")
        return []


def find_session_files(session_id: str) -> List[Path]:
    """Find all files related to a specific session"""
    files = []

    # Check inbox files
    inbox_dir = RAMAS_FILES["session_inboxes"]
    if inbox_dir.exists():
        for inbox_file in inbox_dir.glob("*.json"):
            try:
                with open(inbox_file) as f:
                    data = json.load(f)
                if session_id in data.get("sessions", {}):
                    files.append(inbox_file)
            except:
                pass

    return files


# =============================================================================
# Cleanup Functions
# =============================================================================

def cleanup_all(dry_run: bool = False, confirm: bool = True) -> int:
    """
    Clean up ALL RAMAS temp files.

    Returns:
        Number of items deleted
    """
    print()
    print("═" * 60)
    print("  RAMAS Full Cleanup (Safe Delete → Trash)")
    print("═" * 60)
    print()

    # Calculate total size
    total_size = 0
    items_to_delete = []

    for name, path in RAMAS_FILES.items():
        if path.exists():
            items_to_delete.append((name, path))
            if path.is_file():
                total_size += path.stat().st_size
            else:
                total_size += sum(f.stat().st_size for f in path.rglob("*") if f.is_file())

    if not items_to_delete:
        print("  ℹ️  No RAMAS files found to clean up")
        return 0

    # Show what will be deleted
    print("  📋 Files to be moved to Trash:")
    print()
    for name, path in items_to_delete:
        size = get_size_str(path)
        if path.is_dir():
            count = len(list(path.glob("*")))
            print(f"     • {path} ({count} files, {size})")
        else:
            print(f"     • {path} ({size})")

    print()
    print(f"  📊 Total: {len(items_to_delete)} items, {get_size_str(Path('/tmp'))} (approx)")
    print()

    if dry_run:
        print("  🔍 DRY-RUN MODE: No files will be deleted")
        return 0

    # Confirm
    if confirm:
        response = input("  ❓ Proceed with cleanup? [y/N]: ").strip().lower()
        if response not in ("y", "yes"):
            print("  ❌ Cancelled")
            return 0

    # Delete
    print()
    deleted = 0
    for name, path in items_to_delete:
        success, message = safe_delete(path, dry_run=False)
        if success:
            print(f"  ✅ {message}")
            deleted += 1
        else:
            print(f"  ⚠️  {message}")

    print()
    print(f"  📦 Moved {deleted}/{len(items_to_delete)} items to Trash")
    print("  💡 Tip: Recover from Finder → Trash if needed")

    return deleted


def cleanup_session(session_id: str, dry_run: bool = False) -> int:
    """
    Clean up files for a specific session.

    Note: This removes session data from inbox files, but doesn't
    delete the entire inbox file (other sessions may use it).

    Returns:
        Number of items affected
    """
    print()
    print("═" * 60)
    print(f"  Session Cleanup: {session_id[:30]}...")
    print("═" * 60)
    print()

    # Find session in registry
    sessions = list_sessions()
    session_info = None
    for s in sessions:
        if s["id"] == session_id or session_id in s["id"]:
            session_info = s
            session_id = s["id"]  # Use full ID
            break

    if not session_info:
        print(f"  ❌ Session not found: {session_id}")
        print()
        print("  Available sessions:")
        for s in sessions[:5]:
            print(f"     • {s['id'][:40]}... ({s['name']})")
        return 0

    print(f"  📋 Session: {session_info['name']}")
    print(f"  📅 Created: {session_info['created']}")
    print(f"  👥 Participants: {', '.join(session_info['participants'])}")
    print()

    if dry_run:
        print("  🔍 DRY-RUN: Would remove session data from registry and inboxes")
        return 1

    # Remove from session registry
    registry_path = RAMAS_FILES["session_registry"]
    if registry_path.exists():
        try:
            with open(registry_path) as f:
                data = json.load(f)

            if session_id in data.get("sessions", {}):
                del data["sessions"][session_id]
                with open(registry_path, "w") as f:
                    json.dump(data, f, indent=2)
                print(f"  ✅ Removed from session registry")
        except Exception as e:
            print(f"  ⚠️  Failed to update registry: {e}")

    # Remove from inbox files
    inbox_dir = RAMAS_FILES["session_inboxes"]
    if inbox_dir.exists():
        for inbox_file in inbox_dir.glob("*.json"):
            try:
                with open(inbox_file) as f:
                    data = json.load(f)

                if session_id in data.get("sessions", {}):
                    del data["sessions"][session_id]
                    with open(inbox_file, "w") as f:
                        json.dump(data, f, indent=2)
                    print(f"  ✅ Removed from {inbox_file.name}")
            except Exception as e:
                print(f"  ⚠️  Failed to update {inbox_file.name}: {e}")

    print()
    print("  💡 Session data removed (registry/inboxes updated)")

    return 1


# =============================================================================
# CLI Interface
# =============================================================================

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Safely delete RAMAS cache and session files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                         # Interactive mode
  %(prog)s --list                  # List all sessions
  %(prog)s --all                   # Delete all RAMAS files
  %(prog)s --session SESSION_ID    # Delete specific session
  %(prog)s --all --dry-run         # Preview full cleanup
  %(prog)s --all --yes             # Skip confirmation

Safety Note:
  All files are moved to ~/.Trash/ (NOT permanently deleted).
  You can recover them from Finder → Trash if needed.
        """
    )

    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List all sessions"
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="Delete all RAMAS temp files"
    )
    parser.add_argument(
        "--session", "-s",
        type=str,
        help="Delete specific session (full or partial ID)"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Preview only, don't delete"
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help="Skip confirmation prompts"
    )

    return parser.parse_args()


def interactive_mode():
    """Interactive session selection"""
    print()
    print("═" * 60)
    print("  RAMAS Safe Cache Delete - Interactive Mode")
    print("═" * 60)
    print()

    sessions = list_sessions()

    if not sessions:
        print("  ℹ️  No sessions found")
        print()
        response = input("  Delete all RAMAS files instead? [y/N]: ").strip().lower()
        if response in ("y", "yes"):
            cleanup_all(dry_run=False, confirm=False)
        return

    print("  📋 Available Sessions:")
    print()
    for i, s in enumerate(sessions, 1):
        state_emoji = "🟢" if s["state"] == "active" else "⚪"
        print(f"     {i}. {state_emoji} {s['name']}")
        print(f"        ID: {s['id'][:40]}...")
        print(f"        Created: {s['created']}")
        print()

    print("     0. Delete ALL RAMAS files")
    print()

    try:
        choice = input("  Select session number (or 0 for all): ").strip()
        if not choice:
            print("  ❌ Cancelled")
            return

        choice = int(choice)

        if choice == 0:
            cleanup_all(dry_run=False, confirm=True)
        elif 1 <= choice <= len(sessions):
            session = sessions[choice - 1]
            cleanup_session(session["id"], dry_run=False)
        else:
            print("  ❌ Invalid selection")
    except ValueError:
        print("  ❌ Invalid input")
    except KeyboardInterrupt:
        print("\n  ❌ Cancelled")


def main():
    """Main entry point"""
    args = parse_args()

    if args.list:
        # List sessions
        sessions = list_sessions()
        print()
        print("═" * 60)
        print("  RAMAS Sessions")
        print("═" * 60)
        print()

        if not sessions:
            print("  ℹ️  No sessions found")
        else:
            for s in sessions:
                state_emoji = "🟢" if s["state"] == "active" else "⚪"
                print(f"  {state_emoji} {s['name']}")
                print(f"     ID: {s['id']}")
                print(f"     Created: {s['created']}")
                print(f"     Participants: {', '.join(s['participants'])}")
                print()

        # Also show file sizes
        print("  📊 File Sizes:")
        for name, path in RAMAS_FILES.items():
            if path.exists():
                size = get_size_str(path)
                print(f"     • {path.name}: {size}")
        print()

    elif args.all:
        # Full cleanup
        cleanup_all(dry_run=args.dry_run, confirm=not args.yes)

    elif args.session:
        # Session-specific cleanup
        cleanup_session(args.session, dry_run=args.dry_run)

    else:
        # Interactive mode
        interactive_mode()


if __name__ == "__main__":
    main()
