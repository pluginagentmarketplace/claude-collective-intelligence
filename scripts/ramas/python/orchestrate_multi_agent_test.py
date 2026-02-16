#!/usr/bin/env python3
"""
RAMAS: Multi-Agent Test Orchestrator

Orchestrates a complete multi-agent test with:
1. Team Leader creates session
2. Workers join session
3. Worker-001 calculates prime numbers
4. Worker-002 calculates Fibonacci numbers
5. Team Leader aggregates and reports intersection

CRITICAL: Uses \r for Enter key, NOT \n!

Usage:
    python orchestrate_multi_agent_test.py
    python orchestrate_multi_agent_test.py --step-by-step
    python orchestrate_multi_agent_test.py --dry-run

Author: Dr. Umit Kacar
Date: 2026-01-02
"""

import asyncio
import sys
import argparse
import time
from pathlib import Path
from typing import List, Tuple

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import iterm2
except ImportError:
    print("Error: iTerm2 Python API not installed.")
    sys.exit(1)

from src.ramas.python import registry

# =============================================================================
# CRITICAL: Enter key configuration
# =============================================================================
ENTER_KEY = "\r"  # Carriage Return = Real Enter (NOT \n!)
ESC_KEY = "\x1b"


# =============================================================================
# Test Steps Definition
# =============================================================================

STEP_REGISTER_TEAM_LEADER = """
Sen TEAM-LEADER'sın. register_agent MCP tool'unu kullanarak team_leader rolünde RabbitMQ'ya bağlan. agent_id olarak "team-leader" kullan.
"""

STEP_REGISTER_WORKER_001 = """
Sen WORKER-001'sin. register_agent MCP tool'unu kullanarak worker rolünde RabbitMQ'ya bağlan. agent_id olarak "worker-001" kullan.
"""

STEP_REGISTER_WORKER_002 = """
Sen WORKER-002'sin. register_agent MCP tool'unu kullanarak worker rolünde RabbitMQ'ya bağlan. agent_id olarak "worker-002" kullan.
"""

STEP_CREATE_SESSION = """
Session oluştur: create_session MCP tool'unu kullan. sessionName="multi-agent-test", sessionType="task_coordination", autoJoin=true olsun.
"""

STEP_JOIN_SESSION_WORKER_001 = """
Team Leader'ın oluşturduğu session'a katıl: join_session MCP tool'unu kullan. Session ID'yi Team Leader'dan al.
"""

STEP_JOIN_SESSION_WORKER_002 = """
Team Leader'ın oluşturduğu session'a katıl: join_session MCP tool'unu kullan. Session ID'yi Team Leader'dan al.
"""

STEP_BROADCAST_TASKS = """
Worker'lara görev dağıt: session_broadcast MCP tool'unu kullan.

Görev:
- Worker-001: 1-1000 arası ASAL SAYILARI hesapla
- Worker-002: 1-1000 arası FİBONACCİ SAYILARINI hesapla

Her iki worker da sonuçlarını report_task_completion ile bildirsin.
"""

STEP_POLL_WORKER_001 = """
Görev al: poll_session_messages MCP tool'unu kullan. Unread mesajları al.
Sonra görevini yap: 1-1000 arası ASAL SAYILARI hesapla.
Sonucu report_task_completion ile bildir.
"""

STEP_POLL_WORKER_002 = """
Görev al: poll_session_messages MCP tool'unu kullan. Unread mesajları al.
Sonra görevini yap: 1-1000 arası FİBONACCİ SAYILARINI hesapla.
Sonucu report_task_completion ile bildir.
"""

STEP_AGGREGATE_RESULTS = """
Worker sonuçlarını topla ve kesişimi hesapla:
- Worker-001'den asal sayıları al
- Worker-002'den Fibonacci sayılarını al
- Kesişimi bul (hem asal hem Fibonacci olan sayılar)
- Sonucu rapor et

Beklenen kesişim: 2, 3, 5, 13, 89, 233
"""


# =============================================================================
# Test Orchestration Steps
# =============================================================================

TEST_STEPS: List[Tuple[str, str, str, float]] = [
    # (agent_id, step_name, message, wait_after)
    ("team-leader", "1. Register Team Leader", STEP_REGISTER_TEAM_LEADER.strip(), 10.0),
    ("worker-001", "2. Register Worker-001", STEP_REGISTER_WORKER_001.strip(), 10.0),
    ("worker-002", "3. Register Worker-002", STEP_REGISTER_WORKER_002.strip(), 10.0),
    ("team-leader", "4. Create Session", STEP_CREATE_SESSION.strip(), 15.0),
    ("worker-001", "5. Worker-001 Join Session", STEP_JOIN_SESSION_WORKER_001.strip(), 10.0),
    ("worker-002", "6. Worker-002 Join Session", STEP_JOIN_SESSION_WORKER_002.strip(), 10.0),
    ("team-leader", "7. Broadcast Tasks", STEP_BROADCAST_TASKS.strip(), 15.0),
    ("worker-001", "8. Worker-001 Execute Task", STEP_POLL_WORKER_001.strip(), 30.0),
    ("worker-002", "9. Worker-002 Execute Task", STEP_POLL_WORKER_002.strip(), 30.0),
    ("team-leader", "10. Aggregate Results", STEP_AGGREGATE_RESULTS.strip(), 20.0),
]


# =============================================================================
# Core Functions
# =============================================================================

async def find_session(connection: iterm2.Connection, session_id: str):
    """Find an iTerm2 session by its ID."""
    app = await iterm2.async_get_app(connection)
    for window in app.windows:
        for tab in window.tabs:
            for session in tab.sessions:
                if session.session_id == session_id:
                    return session
    return None


async def send_to_agent(
    connection: iterm2.Connection,
    agent_id: str,
    message: str,
    windows: dict
) -> bool:
    """Send message to a specific agent."""
    if agent_id not in windows:
        print(f"❌ Agent '{agent_id}' not found")
        return False

    # WindowInfo is a dataclass, use attribute access
    session_id = windows[agent_id].session_id
    if not session_id:
        print(f"❌ No session ID for '{agent_id}'")
        return False

    session = await find_session(connection, session_id)
    if not session:
        print(f"❌ Session not found for '{agent_id}'")
        return False

    try:
        # Send ESC first to clear any pending input
        await session.async_send_text(ESC_KEY)
        await asyncio.sleep(0.3)

        # Send the message
        await session.async_send_text(message)
        await asyncio.sleep(0.3)

        # Press Enter (CRITICAL: Use \r!)
        await session.async_send_text(ENTER_KEY)
        await asyncio.sleep(0.3)

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


async def run_orchestration(
    step_by_step: bool = False,
    dry_run: bool = False,
    start_from: int = 1
):
    """Run the full test orchestration."""
    print("\n" + "="*70)
    print("🚀 RAMAS MULTI-AGENT TEST ORCHESTRATOR")
    print("="*70)
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print(f"Step-by-step: {step_by_step}")
    print("="*70 + "\n")

    # Get registered windows
    windows = registry.get_all_windows()

    if not windows:
        print("❌ No agents registered! Run launch_windows.py first.")
        return False

    print("📋 Registered agents:")
    for agent_id, info in windows.items():
        # WindowInfo is a dataclass, use attribute access
        print(f"   • {agent_id}: {info.status or 'unknown'}")
    print()

    if dry_run:
        print("🔍 DRY RUN - Showing steps without executing:\n")
        for i, (agent_id, step_name, message, wait) in enumerate(TEST_STEPS, 1):
            if i < start_from:
                continue
            print(f"{'='*60}")
            print(f"Step {i}: {step_name}")
            print(f"Target: {agent_id}")
            print(f"Wait after: {wait}s")
            print(f"Message:\n{message[:200]}...")
            print()
        return True

    # Run live orchestration
    try:
        connection = await iterm2.Connection.async_create()
    except Exception as e:
        print(f"❌ Could not connect to iTerm2: {e}")
        return False

    for i, (agent_id, step_name, message, wait) in enumerate(TEST_STEPS, 1):
        if i < start_from:
            continue

        print(f"\n{'='*60}")
        print(f"📌 STEP {i}: {step_name}")
        print(f"   Target: {agent_id}")
        print(f"{'='*60}")

        if step_by_step:
            input(f"\n⏸️  Press Enter to execute step {i}...")

        success = await send_to_agent(connection, agent_id, message, windows)

        if success:
            print(f"✅ Sent to {agent_id}")
            print(f"⏳ Waiting {wait}s for Claude to process...")
            await asyncio.sleep(wait)
        else:
            print(f"❌ Failed to send to {agent_id}")
            if step_by_step:
                response = input("Continue? (y/n): ")
                if response.lower() != 'y':
                    return False

    print("\n" + "="*70)
    print("🎉 ORCHESTRATION COMPLETE!")
    print("="*70)
    print("\nCheck each terminal for results.")
    print("Expected intersection: 2, 3, 5, 13, 89, 233")

    return True


# =============================================================================
# Quick Single Commands
# =============================================================================

QUICK_COMMANDS = {
    "register-all": [
        ("team-leader", "register_agent tool ile team_leader rolünde kayıt ol, agent_id=team-leader"),
        ("worker-001", "register_agent tool ile worker rolünde kayıt ol, agent_id=worker-001"),
        ("worker-002", "register_agent tool ile worker rolünde kayıt ol, agent_id=worker-002"),
    ],
    "status-all": [
        ("team-leader", "get_connection_status tool ile bağlantı durumunu göster"),
        ("worker-001", "get_connection_status tool ile bağlantı durumunu göster"),
        ("worker-002", "get_connection_status tool ile bağlantı durumunu göster"),
    ],
}


async def run_quick_command(command_name: str):
    """Run a quick predefined command set."""
    if command_name not in QUICK_COMMANDS:
        print(f"Unknown command: {command_name}")
        print(f"Available: {list(QUICK_COMMANDS.keys())}")
        return

    windows = registry.get_all_windows()
    steps = QUICK_COMMANDS[command_name]

    try:
        connection = await iterm2.Connection.async_create()
    except Exception as e:
        print(f"❌ Could not connect to iTerm2: {e}")
        return

    for agent_id, message in steps:
        print(f"📤 Sending to {agent_id}...")
        success = await send_to_agent(connection, agent_id, message, windows)
        if success:
            print(f"✅ {agent_id}: Done")
        else:
            print(f"❌ {agent_id}: Failed")
        await asyncio.sleep(2.0)


# =============================================================================
# Main CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="RAMAS Multi-Agent Test Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                    Run full orchestration
  %(prog)s --step-by-step     Run with manual confirmation
  %(prog)s --dry-run          Show steps without executing
  %(prog)s --start-from 5     Start from step 5
  %(prog)s --quick register-all   Quick: Register all agents
        """
    )

    parser.add_argument(
        "--step-by-step",
        action="store_true",
        help="Pause and wait for confirmation before each step"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show steps without executing"
    )

    parser.add_argument(
        "--start-from",
        type=int,
        default=1,
        help="Start from step N (default: 1)"
    )

    parser.add_argument(
        "--quick",
        type=str,
        choices=list(QUICK_COMMANDS.keys()),
        help="Run a quick predefined command"
    )

    parser.add_argument(
        "--list-steps",
        action="store_true",
        help="List all orchestration steps"
    )

    args = parser.parse_args()

    # List steps
    if args.list_steps:
        print("\n📋 Orchestration Steps:")
        print("="*60)
        for i, (agent_id, step_name, _, wait) in enumerate(TEST_STEPS, 1):
            print(f"  {i:2}. [{agent_id:12}] {step_name} (wait: {wait}s)")
        print("="*60)
        return

    # Quick command
    if args.quick:
        asyncio.run(run_quick_command(args.quick))
        return

    # Full orchestration
    asyncio.run(run_orchestration(
        step_by_step=args.step_by_step,
        dry_run=args.dry_run,
        start_from=args.start_from
    ))


if __name__ == "__main__":
    main()
