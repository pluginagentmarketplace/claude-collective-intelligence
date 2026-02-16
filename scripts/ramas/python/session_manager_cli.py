#!/usr/bin/env python3
"""
RAMAS: Session Manager CLI

Command-line interface for managing Pattern C sessions.
Reads from the shared session registry file.

Usage:
    python session_manager_cli.py list              # List active sessions
    python session_manager_cli.py get <session_id>  # Get session details
    python session_manager_cli.py participants      # Show all participants
    python session_manager_cli.py cleanup           # Cleanup expired sessions
    python session_manager_cli.py stats             # Show statistics

Author: Dr. Umit Kacar
Date: 2026-01-03
PATTERN-C-002: Session Registry Isolation Fix
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# =============================================================================
# Configuration
# =============================================================================

REGISTRY_FILE = Path("/tmp/ramas-session-registry.json")
INBOX_DIR = Path("/tmp/ramas-session-inboxes")
SESSION_TTL_SECONDS = 3600 * 4  # 4 hours


# =============================================================================
# Colors
# =============================================================================

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}\n")


def print_success(text: str):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")


def print_error(text: str):
    print(f"{Colors.RED}❌ {text}{Colors.END}")


def print_warning(text: str):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")


def print_info(text: str):
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")


# =============================================================================
# Registry Functions
# =============================================================================

def read_registry() -> Dict[str, Any]:
    """Read the session registry file."""
    if not REGISTRY_FILE.exists():
        return {"sessions": {}, "version": "1.0.0"}

    try:
        with open(REGISTRY_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print_error(f"Error reading registry: {e}")
        return {"sessions": {}, "version": "1.0.0"}


def write_registry(data: Dict[str, Any]) -> bool:
    """Write to the session registry file."""
    try:
        with open(REGISTRY_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except IOError as e:
        print_error(f"Error writing registry: {e}")
        return False


def is_expired(session_data: Dict) -> bool:
    """Check if a session is expired."""
    updated_at = session_data.get("updated_at", 0)
    return time.time() - updated_at > SESSION_TTL_SECONDS


def format_time(timestamp: float) -> str:
    """Format timestamp for display."""
    if not timestamp:
        return "N/A"
    return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")


def format_age(timestamp: float) -> str:
    """Format age of timestamp."""
    if not timestamp:
        return "N/A"
    age = time.time() - timestamp
    if age < 60:
        return f"{int(age)}s"
    elif age < 3600:
        return f"{int(age/60)}m"
    else:
        return f"{age/3600:.1f}h"


# =============================================================================
# Commands
# =============================================================================

def cmd_list(args):
    """List all active sessions."""
    print_header("Active Sessions")

    registry = read_registry()
    sessions = registry.get("sessions", {})

    if not sessions:
        print_info("No active sessions found")
        print_info("Create a session using: create_session MCP tool")
        return

    active = 0
    expired = 0

    print(f"{'Session ID':<35} {'Name':<20} {'State':<10} {'Participants':>12} {'Age':>8}")
    print("-" * 90)

    for session_id, data in sessions.items():
        if is_expired(data):
            expired += 1
            if not args.all:
                continue

        active += 1
        short_id = session_id[:32] + "..."
        name = data.get("session_name", "N/A")[:18]
        state = data.get("state", "unknown")
        participants = len(data.get("participants", []))
        age = format_age(data.get("updated_at", 0))

        status_color = Colors.GREEN if state == "active" else Colors.YELLOW
        print(f"{short_id:<35} {name:<20} {status_color}{state:<10}{Colors.END} {participants:>12} {age:>8}")

    print()
    print_info(f"Active: {active} | Expired: {expired}")


def cmd_get(args):
    """Get details of a specific session."""
    session_id = args.session_id
    print_header(f"Session Details")

    registry = read_registry()
    sessions = registry.get("sessions", {})

    # Find matching session (partial match supported)
    matching = [sid for sid in sessions.keys() if sid.startswith(session_id)]

    if not matching:
        print_error(f"Session not found: {session_id}")
        return

    if len(matching) > 1:
        print_warning(f"Multiple sessions match '{session_id}':")
        for sid in matching:
            print(f"  - {sid}")
        return

    session_id = matching[0]
    data = sessions[session_id]

    print(f"{Colors.BOLD}Session ID:{Colors.END} {session_id}")
    print(f"{Colors.BOLD}Name:{Colors.END} {data.get('session_name', 'N/A')}")
    print(f"{Colors.BOLD}Type:{Colors.END} {data.get('session_type', 'N/A')}")
    print(f"{Colors.BOLD}State:{Colors.END} {data.get('state', 'N/A')}")
    print(f"{Colors.BOLD}Creator:{Colors.END} {data.get('creator_id', 'N/A')}")
    print(f"{Colors.BOLD}Created:{Colors.END} {data.get('created_at', 'N/A')}")
    print(f"{Colors.BOLD}Updated:{Colors.END} {format_time(data.get('updated_at', 0))}")
    print(f"{Colors.BOLD}Age:{Colors.END} {format_age(data.get('updated_at', 0))}")
    print(f"{Colors.BOLD}Expired:{Colors.END} {'Yes' if is_expired(data) else 'No'}")

    print(f"\n{Colors.BOLD}Participants ({len(data.get('participants', []))}):{Colors.END}")
    for p in data.get("participants", []):
        print(f"  - {p}")

    metadata = data.get("metadata", {})
    if metadata:
        print(f"\n{Colors.BOLD}Metadata:{Colors.END}")
        for key, value in metadata.items():
            print(f"  {key}: {value}")


def cmd_participants(args):
    """Show all participants across all sessions."""
    print_header("All Participants")

    registry = read_registry()
    sessions = registry.get("sessions", {})

    if not sessions:
        print_info("No active sessions found")
        return

    all_participants = {}

    for session_id, data in sessions.items():
        if is_expired(data) and not args.all:
            continue

        for p in data.get("participants", []):
            if p not in all_participants:
                all_participants[p] = []
            all_participants[p].append({
                "session_id": session_id,
                "session_name": data.get("session_name", "N/A"),
                "is_creator": p == data.get("creator_id")
            })

    if not all_participants:
        print_info("No participants found")
        return

    for agent_id, sessions_list in all_participants.items():
        role = "LEADER" if any(s["is_creator"] for s in sessions_list) else "MEMBER"
        print(f"{Colors.BOLD}{agent_id}{Colors.END} [{role}]")
        for s in sessions_list:
            creator_mark = " (creator)" if s["is_creator"] else ""
            print(f"  └─ {s['session_name']}{creator_mark}")
        print()


def cmd_cleanup(args):
    """Cleanup expired sessions."""
    print_header("Cleanup Expired Sessions")

    registry = read_registry()
    sessions = registry.get("sessions", {})

    if not sessions:
        print_info("No sessions to cleanup")
        return

    to_remove = []
    for session_id, data in sessions.items():
        if is_expired(data):
            to_remove.append(session_id)

    if not to_remove:
        print_success("No expired sessions found")
        return

    if not args.force:
        print_warning(f"Found {len(to_remove)} expired sessions:")
        for sid in to_remove:
            print(f"  - {sid}")
        print()
        confirm = input("Delete these sessions? [y/N]: ")
        if confirm.lower() != 'y':
            print_info("Cleanup cancelled")
            return

    for sid in to_remove:
        del sessions[sid]
        print_success(f"Removed: {sid[:40]}...")

    registry["sessions"] = sessions
    if write_registry(registry):
        print_success(f"Cleaned up {len(to_remove)} expired sessions")
    else:
        print_error("Failed to save registry")


def cmd_stats(args):
    """Show session statistics."""
    print_header("Session Statistics")

    registry = read_registry()
    sessions = registry.get("sessions", {})

    total = len(sessions)
    active = sum(1 for d in sessions.values() if not is_expired(d))
    expired = total - active
    total_participants = sum(len(d.get("participants", [])) for d in sessions.values())

    print(f"{Colors.BOLD}Registry Version:{Colors.END} {registry.get('version', 'N/A')}")
    print(f"{Colors.BOLD}Registry File:{Colors.END} {REGISTRY_FILE}")
    print()
    print(f"{Colors.BOLD}Total Sessions:{Colors.END} {total}")
    print(f"{Colors.BOLD}Active Sessions:{Colors.END} {active}")
    print(f"{Colors.BOLD}Expired Sessions:{Colors.END} {expired}")
    print(f"{Colors.BOLD}Total Participants:{Colors.END} {total_participants}")

    # Inbox stats
    print()
    if INBOX_DIR.exists():
        inbox_files = list(INBOX_DIR.glob("*.json"))
        total_messages = 0
        for inbox in inbox_files:
            try:
                with open(inbox) as f:
                    data = json.load(f)
                    for session_data in data.get("sessions", {}).values():
                        total_messages += len(session_data.get("messages", []))
            except:
                pass

        print(f"{Colors.BOLD}Inbox Directory:{Colors.END} {INBOX_DIR}")
        print(f"{Colors.BOLD}Agent Inboxes:{Colors.END} {len(inbox_files)}")
        print(f"{Colors.BOLD}Total Messages:{Colors.END} {total_messages}")
    else:
        print(f"{Colors.BOLD}Inbox Directory:{Colors.END} Not found")


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="RAMAS Session Manager CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python session_manager_cli.py list
  python session_manager_cli.py list --all          # Include expired
  python session_manager_cli.py get session-123
  python session_manager_cli.py participants
  python session_manager_cli.py cleanup
  python session_manager_cli.py cleanup --force
  python session_manager_cli.py stats
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # list
    list_parser = subparsers.add_parser("list", help="List active sessions")
    list_parser.add_argument("--all", "-a", action="store_true", help="Include expired sessions")
    list_parser.set_defaults(func=cmd_list)

    # get
    get_parser = subparsers.add_parser("get", help="Get session details")
    get_parser.add_argument("session_id", help="Session ID (partial match supported)")
    get_parser.set_defaults(func=cmd_get)

    # participants
    part_parser = subparsers.add_parser("participants", help="Show all participants")
    part_parser.add_argument("--all", "-a", action="store_true", help="Include expired sessions")
    part_parser.set_defaults(func=cmd_participants)

    # cleanup
    clean_parser = subparsers.add_parser("cleanup", help="Cleanup expired sessions")
    clean_parser.add_argument("--force", "-f", action="store_true", help="Skip confirmation")
    clean_parser.set_defaults(func=cmd_cleanup)

    # stats
    stats_parser = subparsers.add_parser("stats", help="Show statistics")
    stats_parser.set_defaults(func=cmd_stats)

    args = parser.parse_args()

    if not args.command:
        # Default to list
        args.all = False
        cmd_list(args)
    else:
        args.func(args)


if __name__ == "__main__":
    main()
