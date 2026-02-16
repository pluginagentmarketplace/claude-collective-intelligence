#!/usr/bin/env python3
"""
RAMAS: Send Message to Claude Code Session

Sends a message to a Claude Code session running in iTerm2.

CRITICAL: Uses \r (carriage return) for Enter, NOT \n (newline)!
- \r = Real Enter key = Submits/executes the command
- \n = Shift+Enter = Just adds new line, does NOT submit!

This is a common mistake that causes sessions to hang!

Usage:
    python send_to_claude.py <agent_id> "<message>"
    python send_to_claude.py team-leader "create_session tool ile session oluştur"
    python send_to_claude.py worker-001 "register_agent tool ile worker olarak kayıt ol"
    python send_to_claude.py --all "Hepiniz RabbitMQ'ya bağlanın"
    python send_to_claude.py --all --no-enter "Bu mesajı gönder ama Enter basma"

Options:
    --all           Send to all registered agents
    --no-enter      Don't press Enter after message (useful for partial input)
    --esc-first     Send ESC before message (clears any pending input)
    --delay SECS    Wait SECS seconds between operations (default: 0.3)

Author: Dr. Umit Kacar
Date: 2026-01-02
Platform: macOS only

LESSON LEARNED (2026-01-01):
    iTerm2 Python API'de \n yerine \r kullanmak ZORUNLU!
    Bu hata 2 saat debug'a mal oldu. Bir daha yapma!
"""

import asyncio
import sys
import argparse
from pathlib import Path
from typing import Optional, List

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import iterm2
except ImportError:
    print("Error: iTerm2 Python API not installed.")
    print("Install with: uv pip install iterm2")
    sys.exit(1)

from src.ramas.python import registry


# =============================================================================
# Constants - CRITICAL!
# =============================================================================

# CRITICAL: Use \r for Enter, NOT \n!
# \r (CR) = Carriage Return = Real Enter = Submits command
# \n (LF) = Line Feed = Shift+Enter = Just new line, NO submit!
ENTER_KEY = "\r"  # DO NOT CHANGE TO \n !!!

# ESC key for clearing pending input
ESC_KEY = "\x1b"

# Default delay between operations (seconds)
DEFAULT_DELAY = 0.3


# =============================================================================
# Core Functions
# =============================================================================

async def find_session(connection: iterm2.Connection, session_id: str) -> Optional[iterm2.Session]:
    """Find an iTerm2 session by its ID."""
    app = await iterm2.async_get_app(connection)

    for window in app.windows:
        for tab in window.tabs:
            for session in tab.sessions:
                if session.session_id == session_id:
                    return session
    return None


async def send_message(
    connection: iterm2.Connection,
    session_id: str,
    message: str,
    send_enter: bool = True,
    send_esc_first: bool = False,
    delay: float = DEFAULT_DELAY
) -> bool:
    """
    Send a message to an iTerm2 session.

    Args:
        connection: iTerm2 connection
        session_id: iTerm2 session ID
        message: Message to send
        send_enter: Whether to press Enter after message (default: True)
        send_esc_first: Whether to send ESC before message (default: False)
        delay: Delay between operations in seconds

    Returns:
        True if successful, False otherwise
    """
    session = await find_session(connection, session_id)

    if not session:
        print(f"Error: Session {session_id} not found")
        return False

    try:
        # Step 1: Send ESC if requested (clears any pending input)
        if send_esc_first:
            await session.async_send_text(ESC_KEY)
            await asyncio.sleep(delay)

        # Step 2: Send the message
        await session.async_send_text(message)
        await asyncio.sleep(delay)

        # Step 3: Send Enter (CRITICAL: Use \r, not \n!)
        if send_enter:
            await session.async_send_text(ENTER_KEY)  # \r = Real Enter!
            await asyncio.sleep(delay)

        return True

    except Exception as e:
        print(f"Error sending to session: {e}")
        return False


async def send_to_agent(
    agent_id: str,
    message: str,
    send_enter: bool = True,
    send_esc_first: bool = False,
    delay: float = DEFAULT_DELAY
) -> bool:
    """
    Send a message to a registered RAMAS agent.

    Args:
        agent_id: Agent ID (team-leader, worker-001, worker-002)
        message: Message to send
        send_enter: Whether to press Enter after message
        send_esc_first: Whether to send ESC before message
        delay: Delay between operations

    Returns:
        True if successful, False otherwise
    """
    # Get agent info from registry
    windows = registry.get_all_windows()

    if agent_id not in windows:
        print(f"Error: Agent '{agent_id}' not found in registry")
        print(f"Available agents: {list(windows.keys())}")
        return False

    # WindowInfo is a dataclass, use attribute access
    agent_info = windows[agent_id]
    session_id = agent_info.session_id

    if not session_id:
        print(f"Error: No session ID for agent '{agent_id}'")
        return False

    print(f"📤 Sending to {agent_id} (session: {session_id[:8]}...)")

    try:
        connection = await iterm2.Connection.async_create()
    except Exception as e:
        print(f"❌ Could not connect to iTerm2: {e}")
        return False

    success = await send_message(
        connection,
        session_id,
        message,
        send_enter=send_enter,
        send_esc_first=send_esc_first,
        delay=delay
    )

    if success:
        print(f"✅ Message sent to {agent_id}")
    else:
        print(f"❌ Failed to send to {agent_id}")

    return success


async def send_to_all_agents(
    message: str,
    send_enter: bool = True,
    send_esc_first: bool = False,
    delay: float = DEFAULT_DELAY,
    agent_delay: float = 1.0
) -> dict:
    """
    Send a message to all registered RAMAS agents.

    Args:
        message: Message to send
        send_enter: Whether to press Enter after message
        send_esc_first: Whether to send ESC before message
        delay: Delay between operations within each send
        agent_delay: Delay between sending to different agents

    Returns:
        Dict with agent_id -> success status
    """
    windows = registry.get_all_windows()

    if not windows:
        print("Error: No agents registered in RAMAS registry")
        return {}

    results = {}

    try:
        connection = await iterm2.Connection.async_create()
    except Exception as e:
        print(f"❌ Could not connect to iTerm2: {e}")
        return results

    for agent_id, agent_info in windows.items():
        # WindowInfo is a dataclass, use attribute access
        session_id = agent_info.session_id

        if not session_id:
            print(f"⚠️ Skipping {agent_id}: No session ID")
            results[agent_id] = False
            continue

        print(f"📤 Sending to {agent_id}...")

        success = await send_message(
            connection,
            session_id,
            message,
            send_enter=send_enter,
            send_esc_first=send_esc_first,
            delay=delay
        )

        results[agent_id] = success

        if success:
            print(f"✅ {agent_id}: Sent")
        else:
            print(f"❌ {agent_id}: Failed")

        # Wait before sending to next agent
        await asyncio.sleep(agent_delay)

    return results


# =============================================================================
# Convenience Functions for Common Tasks
# =============================================================================

async def broadcast_task(task_message: str, delay: float = 1.0):
    """Send a task to all agents."""
    print("\n" + "="*60)
    print("📢 BROADCASTING TO ALL AGENTS")
    print("="*60)

    results = await send_to_all_agents(
        message=task_message,
        send_enter=True,
        send_esc_first=True,
        agent_delay=delay
    )

    success_count = sum(1 for v in results.values() if v)
    print(f"\n📊 Broadcast complete: {success_count}/{len(results)} successful")

    return results


async def send_task_to_worker(worker_id: str, task: str):
    """Send a specific task to a worker."""
    return await send_to_agent(
        agent_id=worker_id,
        message=task,
        send_enter=True,
        send_esc_first=True
    )


# =============================================================================
# Main CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Send message to Claude Code session in iTerm2",
        epilog="""
CRITICAL: This script uses \\r (carriage return) for Enter key.
DO NOT confuse with \\n (newline) which is Shift+Enter!

Examples:
  %(prog)s team-leader "create_session ile session oluştur"
  %(prog)s worker-001 "register_agent ile worker olarak kayıt ol"
  %(prog)s --all "Hepiniz görevinizi bildirin"
  %(prog)s --all --no-enter "Partial message"
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "agent_id",
        nargs="?",
        help="Agent ID (team-leader, worker-001, worker-002) or use --all"
    )

    parser.add_argument(
        "message",
        nargs="?",
        help="Message to send"
    )

    parser.add_argument(
        "--all",
        action="store_true",
        help="Send to all registered agents"
    )

    parser.add_argument(
        "--no-enter",
        action="store_true",
        help="Don't press Enter after message"
    )

    parser.add_argument(
        "--esc-first",
        action="store_true",
        help="Send ESC before message to clear pending input"
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"Delay between operations in seconds (default: {DEFAULT_DELAY})"
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help="List all registered agents"
    )

    args = parser.parse_args()

    # List agents
    if args.list:
        windows = registry.get_all_windows()
        print("\n📋 Registered RAMAS Agents:")
        print("="*50)
        for agent_id, info in windows.items():
            # WindowInfo is a dataclass, use attribute access
            status = info.status or "unknown"
            session = (info.session_id or "N/A")[:8] + "..."
            print(f"  {agent_id}: [{status.upper()}] session={session}")
        print("="*50)
        return

    # Validate arguments
    if not args.message:
        if not args.all:
            parser.error("Message is required unless using --list")
        else:
            parser.error("Message is required")

    if not args.all and not args.agent_id:
        parser.error("Either agent_id or --all is required")

    # Send message
    send_enter = not args.no_enter

    if args.all:
        asyncio.run(send_to_all_agents(
            message=args.message,
            send_enter=send_enter,
            send_esc_first=args.esc_first,
            delay=args.delay
        ))
    else:
        asyncio.run(send_to_agent(
            agent_id=args.agent_id,
            message=args.message,
            send_enter=send_enter,
            send_esc_first=args.esc_first,
            delay=args.delay
        ))


if __name__ == "__main__":
    main()
