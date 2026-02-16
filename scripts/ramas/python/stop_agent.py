#!/usr/bin/env python3
"""
RAMAS: Stop/Pause Agent - Send ESC to interrupt Claude Code session

═══════════════════════════════════════════════════════════════════════════════
                    3-LEVEL COMMUNICATION HIERARCHY
═══════════════════════════════════════════════════════════════════════════════

  Level 1: RabbitMQ Task Distribution (assign_session_task)
           - Normal task assignment
           - Agent must be waiting (wait_for_task)
           - Async, queued delivery

  Level 2: RabbitMQ Interrupt (interrupt_worker MCP tool)
           - Urgent notifications/messages
           - Agent must be polling for messages
           - Message appears when agent checks inbox

  Level 3: Direct ESC Keystroke (THIS SCRIPT - stop_agent.py)  ⚡ EMERGENCY
           - ALWAYS WORKS - even during "Thinking..." state!
           - Sends ESC directly to iTerm2 terminal
           - Bypasses all message queues
           - Use for: emergencies, wrong tasks, stuck agents

═══════════════════════════════════════════════════════════════════════════════

WHEN TO USE THIS SCRIPT:

  🚨 EMERGENCY SITUATIONS:
     - Agent executing WRONG task (immediate stop needed)
     - Agent stuck in infinite loop
     - Agent doing something dangerous (wrong file operations)
     - Need to abort operation IMMEDIATELY

  ⏸️  NORMAL PAUSE SITUATIONS:
     - Task completed, agent still waiting unnecessarily
     - Need to reassign agent to different task
     - Session ending, need clean shutdown
     - Debugging/testing scenarios

  ❌ WHEN NOT TO USE:
     - For normal task communication (use RabbitMQ Level 1)
     - For status updates (use RabbitMQ Level 2)
     - Just want to send a message (use send_to_claude.py)

WHO CAN USE THIS:
  - Team Leader: To control workers
  - VS Code Session (Monitor): To control all agents
  - Any orchestrator with iTerm2 access

═══════════════════════════════════════════════════════════════════════════════

Usage:
    python stop_agent.py <agent_id>           # Stop specific agent
    python stop_agent.py --all                # Stop all agents
    python stop_agent.py worker-002           # Stop worker-002
    python stop_agent.py team-leader --msg "Dur bekle"  # ESC + message

    # Makefile shortcuts:
    make ramas-stop AGENT=worker-002          # Stop specific agent
    make ramas-stop-all                       # Stop all agents

Options:
    --all           Stop all registered agents
    --msg MESSAGE   Optional message to display after ESC
    --delay SECS    Delay between ESC keystrokes (default: 0.5)
    --repeat N      Send ESC N times (default: 1)

═══════════════════════════════════════════════════════════════════════════════
                         CRITICAL: ESC KEY BEHAVIOR
═══════════════════════════════════════════════════════════════════════════════

  1x ESC = Interrupt current operation (CORRECT!)
  2x ESC = Opens "Rewind" menu in Claude Code (WRONG - avoid!)

  DEFAULT_REPEAT = 1  ← This is intentional! Do not change to 2!

═══════════════════════════════════════════════════════════════════════════════

Author: Dr. Umit Kacar
Date: 2026-01-07
Platform: macOS only (requires iTerm2 Python API)

LESSON LEARNED (2026-01-07):
    - MCP interrupt_worker sends RabbitMQ message - agent must poll for it
    - Direct ESC keystroke to terminal ALWAYS works, even during "Thinking..."
    - 2x ESC triggers Rewind menu - use only 1x ESC!
    - This is the LAST RESORT for stopping agents - always works!
"""

import asyncio
import sys
import argparse
from pathlib import Path
from typing import Optional, List, Dict

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
# Constants
# =============================================================================

ESC_KEY = "\x1b"          # ESC character - interrupts Claude Code
ENTER_KEY = "\r"          # Carriage Return = Real Enter
DEFAULT_DELAY = 0.5       # Delay between ESC keystrokes
DEFAULT_REPEAT = 1        # CRITICAL: Only 1 ESC! 2x ESC = Rewind menu in Claude Code!


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


async def send_esc_to_session(
    connection: iterm2.Connection,
    session_id: str,
    repeat: int = DEFAULT_REPEAT,
    delay: float = DEFAULT_DELAY,
    message: Optional[str] = None
) -> bool:
    """
    Send ESC keystroke(s) to an iTerm2 session.

    Args:
        connection: iTerm2 connection
        session_id: iTerm2 session ID
        repeat: Number of times to send ESC (default: 2)
        delay: Delay between keystrokes
        message: Optional message to send after ESC

    Returns:
        True if successful, False otherwise
    """
    session = await find_session(connection, session_id)

    if not session:
        print(f"  Error: Session {session_id[:12]}... not found")
        return False

    try:
        # Send ESC keystroke(s)
        for i in range(repeat):
            await session.async_send_text(ESC_KEY)
            if i < repeat - 1:
                await asyncio.sleep(delay)

        # Optional: Send message after ESC
        if message:
            await asyncio.sleep(delay)
            await session.async_send_text(message)
            await asyncio.sleep(delay / 2)
            await session.async_send_text(ENTER_KEY)

        return True

    except Exception as e:
        print(f"  Error sending ESC: {e}")
        return False


async def stop_agent(
    agent_id: str,
    repeat: int = DEFAULT_REPEAT,
    delay: float = DEFAULT_DELAY,
    message: Optional[str] = None
) -> bool:
    """
    Stop a specific agent by sending ESC to its terminal.

    Args:
        agent_id: Agent ID (team-leader, worker-001, worker-002)
        repeat: Number of times to send ESC
        delay: Delay between keystrokes
        message: Optional message after ESC

    Returns:
        True if successful, False otherwise
    """
    # Get agent info from registry
    windows = registry.get_all_windows()

    if agent_id not in windows:
        print(f"Error: Agent '{agent_id}' not found in registry")
        print(f"Available agents: {list(windows.keys())}")
        return False

    agent_info = windows[agent_id]
    session_id = agent_info.session_id

    if not session_id:
        print(f"Error: No session ID for agent '{agent_id}'")
        return False

    print(f"🛑 Stopping {agent_id}...")

    try:
        connection = await iterm2.Connection.async_create()
    except Exception as e:
        print(f"  Could not connect to iTerm2: {e}")
        return False

    success = await send_esc_to_session(
        connection,
        session_id,
        repeat=repeat,
        delay=delay,
        message=message
    )

    if success:
        print(f"  ✅ ESC sent to {agent_id} ({repeat}x)")
        if message:
            print(f"  📝 Message: {message}")
    else:
        print(f"  ❌ Failed to stop {agent_id}")

    return success


async def stop_all_agents(
    repeat: int = DEFAULT_REPEAT,
    delay: float = DEFAULT_DELAY,
    message: Optional[str] = None,
    agent_delay: float = 1.0
) -> Dict[str, bool]:
    """
    Stop all registered agents.

    Args:
        repeat: Number of times to send ESC per agent
        delay: Delay between ESC keystrokes
        message: Optional message after ESC
        agent_delay: Delay between stopping different agents

    Returns:
        Dict with agent_id -> success status
    """
    windows = registry.get_all_windows()

    if not windows:
        print("Error: No agents registered in RAMAS registry")
        return {}

    print(f"\n🛑 Stopping all agents ({len(windows)} total)...\n")

    results = {}

    try:
        connection = await iterm2.Connection.async_create()
    except Exception as e:
        print(f"Could not connect to iTerm2: {e}")
        return results

    for agent_id, agent_info in windows.items():
        session_id = agent_info.session_id

        if not session_id:
            print(f"⚠️  Skipping {agent_id}: No session ID")
            results[agent_id] = False
            continue

        print(f"🛑 {agent_id}...")

        success = await send_esc_to_session(
            connection,
            session_id,
            repeat=repeat,
            delay=delay,
            message=message
        )

        results[agent_id] = success

        if success:
            print(f"  ✅ Stopped")
        else:
            print(f"  ❌ Failed")

        # Wait before stopping next agent
        await asyncio.sleep(agent_delay)

    # Summary
    success_count = sum(1 for v in results.values() if v)
    print(f"\n📊 Stop complete: {success_count}/{len(results)} agents stopped")

    return results


# =============================================================================
# Main CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Stop/Pause Claude Code agent by sending ESC keystroke",
        epilog="""
This script sends actual ESC keystroke to iTerm2 terminal, which
ALWAYS interrupts Claude Code (even during "Thinking..." state).

Different from MCP interrupt_worker which sends RabbitMQ message!

Examples:
  %(prog)s worker-002              # Stop worker-002
  %(prog)s --all                   # Stop all agents
  %(prog)s team-leader --msg "Bekle"  # Stop + message
  %(prog)s --all --repeat 3        # Stop all, send ESC 3 times
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "agent_id",
        nargs="?",
        help="Agent ID (team-leader, worker-001, worker-002) or use --all"
    )

    parser.add_argument(
        "--all",
        action="store_true",
        help="Stop all registered agents"
    )

    parser.add_argument(
        "--msg",
        type=str,
        default=None,
        help="Optional message to send after ESC"
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"Delay between ESC keystrokes (default: {DEFAULT_DELAY}s)"
    )

    parser.add_argument(
        "--repeat",
        type=int,
        default=DEFAULT_REPEAT,
        help=f"Number of times to send ESC (default: {DEFAULT_REPEAT})"
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
            status = info.status or "unknown"
            session = (info.session_id or "N/A")[:12] + "..."
            print(f"  {agent_id}: [{status.upper()}] session={session}")
        print("="*50)
        return

    # Validate arguments
    if not args.all and not args.agent_id:
        parser.error("Either agent_id or --all is required (or use --list)")

    # Stop agent(s)
    if args.all:
        asyncio.run(stop_all_agents(
            repeat=args.repeat,
            delay=args.delay,
            message=args.msg
        ))
    else:
        asyncio.run(stop_agent(
            agent_id=args.agent_id,
            repeat=args.repeat,
            delay=args.delay,
            message=args.msg
        ))


if __name__ == "__main__":
    main()
