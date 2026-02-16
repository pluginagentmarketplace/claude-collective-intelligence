#!/usr/bin/env python3
"""
RAMAS: Inbox Inspector

Debug tool for inspecting Pattern C inbox files.
PATTERN-C-001 uses file-based inboxes to solve MCP stateless problem.

Usage:
    python inbox_inspector.py list                  # List all inboxes
    python inbox_inspector.py read <agent_id>       # Read agent inbox
    python inbox_inspector.py stats                 # Show statistics
    python inbox_inspector.py clear <agent_id>      # Clear agent inbox
    python inbox_inspector.py tail <agent_id>       # Watch inbox in real-time

Author: Dr. Umit Kacar
Date: 2026-01-03
PATTERN-C-001: MCP Stateless Connection Fix
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

INBOX_DIR = Path("/tmp/ramas-session-inboxes")
MESSAGE_TTL_SECONDS = 3600  # 1 hour


# =============================================================================
# Colors
# =============================================================================

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
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
# Helper Functions
# =============================================================================

def read_inbox(inbox_file: Path) -> Dict[str, Any]:
    """Read an inbox file."""
    try:
        with open(inbox_file, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        return {"sessions": {}, "agent_id": inbox_file.stem}


def write_inbox(inbox_file: Path, data: Dict[str, Any]) -> bool:
    """Write to an inbox file."""
    try:
        with open(inbox_file, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except IOError as e:
        print_error(f"Error writing inbox: {e}")
        return False


def format_time(timestamp: float) -> str:
    """Format timestamp for display."""
    if not timestamp:
        return "N/A"
    return datetime.fromtimestamp(timestamp).strftime("%H:%M:%S")


def format_age(timestamp: float) -> str:
    """Format age of timestamp."""
    if not timestamp:
        return "N/A"
    age = time.time() - timestamp
    if age < 60:
        return f"{int(age)}s ago"
    elif age < 3600:
        return f"{int(age/60)}m ago"
    else:
        return f"{age/3600:.1f}h ago"


def get_message_color(msg_type: str) -> str:
    """Get color for message type."""
    colors = {
        "chat": Colors.GREEN,
        "broadcast": Colors.CYAN,
        "task": Colors.YELLOW,
        "result": Colors.MAGENTA,
        "presence": Colors.BLUE,
        "control": Colors.RED,
    }
    return colors.get(msg_type, Colors.END)


def find_agent_inbox(agent_id: str) -> Optional[Path]:
    """Find inbox file for agent (supports partial match)."""
    if not INBOX_DIR.exists():
        return None

    # Exact match first
    exact = INBOX_DIR / f"{agent_id}.json"
    if exact.exists():
        return exact

    # Partial match
    matches = list(INBOX_DIR.glob(f"*{agent_id}*.json"))
    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        print_warning(f"Multiple matches for '{agent_id}':")
        for m in matches:
            print(f"  - {m.stem}")
        return None

    return None


# =============================================================================
# Commands
# =============================================================================

def cmd_list(args):
    """List all inbox files."""
    print_header("Agent Inboxes")

    if not INBOX_DIR.exists():
        print_error(f"Inbox directory not found: {INBOX_DIR}")
        print_info("Inboxes are created when agents join sessions")
        return

    inbox_files = list(INBOX_DIR.glob("*.json"))

    if not inbox_files:
        print_info("No inbox files found")
        return

    print(f"{'Agent ID':<45} {'Sessions':>10} {'Messages':>10} {'Unread':>10}")
    print("-" * 80)

    total_messages = 0
    total_unread = 0

    for inbox_file in sorted(inbox_files):
        data = read_inbox(inbox_file)
        agent_id = inbox_file.stem[:42] + "..." if len(inbox_file.stem) > 42 else inbox_file.stem

        sessions = data.get("sessions", {})
        num_sessions = len(sessions)

        messages = 0
        unread = 0
        for session_data in sessions.values():
            msgs = session_data.get("messages", [])
            messages += len(msgs)
            unread += sum(1 for m in msgs if not m.get("read", False))

        total_messages += messages
        total_unread += unread

        unread_color = Colors.YELLOW if unread > 0 else Colors.DIM
        print(f"{agent_id:<45} {num_sessions:>10} {messages:>10} {unread_color}{unread:>10}{Colors.END}")

    print("-" * 80)
    print(f"{'TOTAL':<45} {len(inbox_files):>10} {total_messages:>10} {total_unread:>10}")


def cmd_read(args):
    """Read an agent's inbox."""
    agent_id = args.agent_id

    inbox_file = find_agent_inbox(agent_id)
    if not inbox_file:
        print_error(f"Inbox not found for: {agent_id}")
        return

    print_header(f"Inbox: {inbox_file.stem[:40]}")

    data = read_inbox(inbox_file)
    sessions = data.get("sessions", {})

    if not sessions:
        print_info("Inbox is empty")
        return

    for session_id, session_data in sessions.items():
        messages = session_data.get("messages", [])
        print(f"\n{Colors.BOLD}Session: {session_id[:40]}...{Colors.END}")
        print(f"Messages: {len(messages)}")
        print("-" * 50)

        if not messages:
            print_info("No messages")
            continue

        # Show messages (last N)
        show_count = args.last if hasattr(args, 'last') and args.last else 10
        messages_to_show = messages[-show_count:]

        for msg in messages_to_show:
            msg_type = msg.get("message_type", "unknown")
            sender = msg.get("sender_id", "unknown")[:15]
            timestamp = msg.get("stored_at", 0)
            read_status = "📖" if msg.get("read", False) else "📬"
            color = get_message_color(msg_type)

            # Get payload content
            payload = msg.get("payload", {})
            content = ""
            if isinstance(payload, dict):
                content = payload.get("content", "")[:50] if payload.get("content") else str(payload)[:50]
            elif isinstance(payload, str):
                content = payload[:50]

            print(f"{read_status} {color}[{msg_type:^10}]{Colors.END} {format_time(timestamp)} | {sender} | {content}...")

        if len(messages) > show_count:
            print(f"\n... and {len(messages) - show_count} more messages")


def cmd_stats(args):
    """Show inbox statistics."""
    print_header("Inbox Statistics")

    if not INBOX_DIR.exists():
        print_error(f"Inbox directory not found: {INBOX_DIR}")
        return

    inbox_files = list(INBOX_DIR.glob("*.json"))

    print(f"{Colors.BOLD}Inbox Directory:{Colors.END} {INBOX_DIR}")
    print(f"{Colors.BOLD}Total Inboxes:{Colors.END} {len(inbox_files)}")

    total_messages = 0
    total_unread = 0
    total_expired = 0
    msg_types = {}

    for inbox_file in inbox_files:
        data = read_inbox(inbox_file)
        for session_data in data.get("sessions", {}).values():
            for msg in session_data.get("messages", []):
                total_messages += 1
                if not msg.get("read", False):
                    total_unread += 1

                # Check expired
                stored_at = msg.get("stored_at", 0)
                if stored_at and time.time() - stored_at > MESSAGE_TTL_SECONDS:
                    total_expired += 1

                # Count types
                msg_type = msg.get("message_type", "unknown")
                msg_types[msg_type] = msg_types.get(msg_type, 0) + 1

    print(f"{Colors.BOLD}Total Messages:{Colors.END} {total_messages}")
    print(f"{Colors.BOLD}Unread Messages:{Colors.END} {total_unread}")
    print(f"{Colors.BOLD}Expired Messages:{Colors.END} {total_expired}")

    if msg_types:
        print(f"\n{Colors.BOLD}Message Types:{Colors.END}")
        for msg_type, count in sorted(msg_types.items(), key=lambda x: -x[1]):
            color = get_message_color(msg_type)
            print(f"  {color}{msg_type:<15}{Colors.END} {count:>5}")


def cmd_clear(args):
    """Clear an agent's inbox."""
    agent_id = args.agent_id

    inbox_file = find_agent_inbox(agent_id)
    if not inbox_file:
        print_error(f"Inbox not found for: {agent_id}")
        return

    data = read_inbox(inbox_file)
    sessions = data.get("sessions", {})

    total_messages = sum(len(s.get("messages", [])) for s in sessions.values())

    if total_messages == 0:
        print_info("Inbox is already empty")
        return

    if not args.force:
        print_warning(f"This will delete {total_messages} messages from {inbox_file.stem}")
        confirm = input("Are you sure? [y/N]: ")
        if confirm.lower() != 'y':
            print_info("Clear cancelled")
            return

    # Clear all messages but keep session structure
    for session_id in sessions:
        sessions[session_id]["messages"] = []

    data["sessions"] = sessions

    if write_inbox(inbox_file, data):
        print_success(f"Cleared {total_messages} messages from inbox")
    else:
        print_error("Failed to clear inbox")


def cmd_tail(args):
    """Watch an inbox in real-time."""
    agent_id = args.agent_id

    inbox_file = find_agent_inbox(agent_id)
    if not inbox_file:
        print_error(f"Inbox not found for: {agent_id}")
        return

    print_header(f"Watching: {inbox_file.stem[:40]}")
    print("Press Ctrl+C to stop\n")

    last_count = 0
    last_messages = set()

    try:
        while True:
            data = read_inbox(inbox_file)

            for session_id, session_data in data.get("sessions", {}).items():
                for msg in session_data.get("messages", []):
                    msg_id = msg.get("message_id", "")
                    if msg_id and msg_id not in last_messages:
                        last_messages.add(msg_id)

                        msg_type = msg.get("message_type", "unknown")
                        sender = msg.get("sender_id", "unknown")[:15]
                        color = get_message_color(msg_type)

                        payload = msg.get("payload", {})
                        content = ""
                        if isinstance(payload, dict):
                            content = payload.get("content", "")[:60] if payload.get("content") else ""
                        elif isinstance(payload, str):
                            content = payload[:60]

                        now = datetime.now().strftime("%H:%M:%S")
                        print(f"{now} {color}[{msg_type}]{Colors.END} from {sender}: {content}")

            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\nStopped watching")


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="RAMAS Inbox Inspector",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python inbox_inspector.py list
  python inbox_inspector.py read agent-12345
  python inbox_inspector.py read agent-12345 --last 20
  python inbox_inspector.py stats
  python inbox_inspector.py clear agent-12345
  python inbox_inspector.py clear agent-12345 --force
  python inbox_inspector.py tail agent-12345

Note: Partial agent ID matching is supported.
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # list
    list_parser = subparsers.add_parser("list", help="List all inboxes")
    list_parser.set_defaults(func=cmd_list)

    # read
    read_parser = subparsers.add_parser("read", help="Read agent inbox")
    read_parser.add_argument("agent_id", help="Agent ID (partial match supported)")
    read_parser.add_argument("--last", "-n", type=int, default=10, help="Show last N messages")
    read_parser.set_defaults(func=cmd_read)

    # stats
    stats_parser = subparsers.add_parser("stats", help="Show statistics")
    stats_parser.set_defaults(func=cmd_stats)

    # clear
    clear_parser = subparsers.add_parser("clear", help="Clear agent inbox")
    clear_parser.add_argument("agent_id", help="Agent ID (partial match supported)")
    clear_parser.add_argument("--force", "-f", action="store_true", help="Skip confirmation")
    clear_parser.set_defaults(func=cmd_clear)

    # tail
    tail_parser = subparsers.add_parser("tail", help="Watch inbox in real-time")
    tail_parser.add_argument("agent_id", help="Agent ID (partial match supported)")
    tail_parser.set_defaults(func=cmd_tail)

    args = parser.parse_args()

    if not args.command:
        cmd_list(args)
    else:
        args.func(args)


if __name__ == "__main__":
    main()
