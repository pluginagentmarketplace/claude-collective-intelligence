#!/usr/bin/env python3
"""
RAMAS: Claude Code Session Monitor

Monitors live Claude Code sessions by reading their JSONL log files.

This is a GAME-CHANGING discovery! Claude Code stores session logs at:
~/.claude/projects/<project-path>/<session-uuid>.jsonl

We can monitor what each Claude Code instance is doing in real-time!

Usage:
    python monitor_claude_sessions.py
    python monitor_claude_sessions.py --watch
    python monitor_claude_sessions.py --last 5
    python monitor_claude_sessions.py --session 296f0c13

Author: Dr. Umit Kacar
Date: 2026-01-02

Discovery: Session logs are stored per-project in JSONL format!
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Project paths
CLAUDE_DIR = Path.home() / ".claude"
PROJECTS_DIR = CLAUDE_DIR / "projects"

# Our project (can be made configurable)
PROJECT_PATH = "-Users-umitkacar-Documents-project-12-plugin-ai-agent-rabbitmq"


def get_project_sessions_dir() -> Path:
    """Get the directory containing session logs for our project."""
    return PROJECTS_DIR / PROJECT_PATH


def list_sessions(minutes_ago: int = 60) -> List[Tuple[str, Path, datetime, int]]:
    """
    List recent session log files.

    Returns list of (session_id, path, modified_time, size_bytes)
    """
    sessions_dir = get_project_sessions_dir()
    if not sessions_dir.exists():
        print(f"❌ Project directory not found: {sessions_dir}")
        return []

    sessions = []
    cutoff_time = time.time() - (minutes_ago * 60)

    for file in sessions_dir.glob("*.jsonl"):
        stat = file.stat()
        if stat.st_mtime > cutoff_time:
            session_id = file.stem[:8]  # First 8 chars of UUID
            modified = datetime.fromtimestamp(stat.st_mtime)
            sessions.append((session_id, file, modified, stat.st_size))

    # Sort by modification time (newest first)
    sessions.sort(key=lambda x: x[2], reverse=True)
    return sessions


def read_last_messages(file_path: Path, count: int = 5) -> List[Dict]:
    """Read the last N messages from a session log."""
    messages = []

    try:
        with open(file_path, 'r') as f:
            lines = f.readlines()
            for line in lines[-count:]:
                try:
                    msg = json.loads(line.strip())
                    messages.append(msg)
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

    return messages


def format_message(msg: Dict) -> str:
    """Format a message for display."""
    msg_type = msg.get('type', 'unknown')

    if msg_type == 'user':
        content = msg.get('message', {}).get('content', '')
        if isinstance(content, list):
            content = content[0].get('text', '') if content else ''
        return f"👤 USER: {content[:100]}..."

    elif msg_type == 'assistant':
        content = msg.get('message', {}).get('content', [])
        if isinstance(content, list):
            for item in content:
                if item.get('type') == 'text':
                    return f"🤖 ASSISTANT: {item.get('text', '')[:100]}..."
                elif item.get('type') == 'tool_use':
                    return f"🔧 TOOL CALL: {item.get('name', 'unknown')}"
        return f"🤖 ASSISTANT: {str(content)[:100]}..."

    elif 'tool_result' in str(msg):
        # Tool result
        content = msg
        if isinstance(content, list) and content:
            first = content[0]
            if 'tool_result' in first.get('type', ''):
                result_content = first.get('content', [])
                if isinstance(result_content, list) and result_content:
                    text = result_content[0].get('text', '')[:100]
                    return f"📤 TOOL RESULT: {text}..."
        return f"📤 TOOL RESULT: (complex)"

    else:
        return f"❓ {msg_type}: {str(msg)[:80]}..."


def identify_agent(messages: List[Dict]) -> str:
    """Try to identify which agent this session is (team-leader, worker-001, etc.)."""
    for msg in messages:
        content = json.dumps(msg)
        if 'team-leader' in content.lower() or 'team_leader' in content.lower():
            return "TEAM-LEADER"
        elif 'worker-001' in content:
            return "WORKER-001"
        elif 'worker-002' in content:
            return "WORKER-002"
    return "UNKNOWN"


def monitor_sessions(watch: bool = False, interval: int = 3):
    """Monitor all active sessions."""
    print("\n" + "="*70)
    print("🔍 CLAUDE CODE SESSION MONITOR")
    print("="*70)
    print(f"Project: {PROJECT_PATH}")
    print(f"Watch mode: {watch}")
    print("="*70 + "\n")

    while True:
        sessions = list_sessions(minutes_ago=30)

        if not sessions:
            print("No recent sessions found.")
        else:
            print(f"\n📋 Found {len(sessions)} recent sessions:\n")

            for session_id, path, modified, size in sessions:
                messages = read_last_messages(path, count=10)
                agent = identify_agent(messages)

                print(f"{'─'*60}")
                print(f"📁 Session: {session_id}... | Agent: {agent}")
                print(f"   Modified: {modified.strftime('%H:%M:%S')} | Size: {size:,} bytes")
                print(f"{'─'*60}")

                # Show last 3 messages
                for msg in messages[-3:]:
                    formatted = format_message(msg)
                    print(f"   {formatted}")
                print()

        if not watch:
            break

        print(f"⏳ Refreshing in {interval} seconds... (Ctrl+C to stop)")
        time.sleep(interval)
        print("\033[H\033[J")  # Clear screen


def tail_session(session_id: str, lines: int = 10):
    """Tail a specific session's log."""
    sessions_dir = get_project_sessions_dir()

    # Find session file
    matching = list(sessions_dir.glob(f"{session_id}*.jsonl"))
    if not matching:
        print(f"❌ Session not found: {session_id}")
        return

    file_path = matching[0]
    print(f"\n📄 Tailing session: {file_path.name}")
    print("="*60)

    messages = read_last_messages(file_path, count=lines)
    agent = identify_agent(messages)
    print(f"Agent identified as: {agent}\n")

    for msg in messages:
        formatted = format_message(msg)
        print(f"  {formatted}")


def main():
    parser = argparse.ArgumentParser(
        description="Monitor Claude Code sessions in real-time"
    )

    parser.add_argument(
        "--watch", "-w",
        action="store_true",
        help="Watch mode: continuously refresh"
    )

    parser.add_argument(
        "--interval", "-i",
        type=int,
        default=3,
        help="Refresh interval in seconds (default: 3)"
    )

    parser.add_argument(
        "--session", "-s",
        type=str,
        help="Show specific session (first 8 chars of UUID)"
    )

    parser.add_argument(
        "--last", "-l",
        type=int,
        default=5,
        help="Number of messages to show (default: 5)"
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help="Just list sessions without details"
    )

    args = parser.parse_args()

    if args.list:
        sessions = list_sessions(minutes_ago=60)
        print("\n📋 Recent Sessions:")
        print("="*60)
        for session_id, path, modified, size in sessions:
            messages = read_last_messages(path, count=5)
            agent = identify_agent(messages)
            print(f"  {session_id}... | {agent:12} | {modified.strftime('%H:%M:%S')} | {size:,} bytes")
        print("="*60)
        return

    if args.session:
        tail_session(args.session, args.last)
    else:
        monitor_sessions(watch=args.watch, interval=args.interval)


if __name__ == "__main__":
    main()
