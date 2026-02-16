#!/usr/bin/env python3
"""
RAMAS: Demo Runner - Single Command Full Demo

One command to run the complete multi-agent demo!
Automates all steps from Docker check to result aggregation.

Usage:
    python demo_runner.py                    # Run full demo
    python demo_runner.py --step-by-step     # Pause between steps
    python demo_runner.py --dry-run          # Show steps without executing
    python demo_runner.py --skip-launch      # Skip window launch (if already open)

Demo Flow:
    1. Check Docker services (RabbitMQ)
    2. Launch 3 iTerm2 windows (team-leader, worker-001, worker-002)
    3. Wait for Claude Code to start
    4. Register all agents with RabbitMQ
    5. Create session (Team Leader)
    6. Join session (Workers)
    7. Broadcast tasks (primes + fibonacci)
    8. Poll and execute tasks
    9. Aggregate results and show intersection

Expected Result: Intersection of primes and fibonacci (1-100) = {2, 3, 5, 13, 89}

Author: Dr. Umit Kacar
Date: 2026-01-03
Patterns: PATTERN-C-001 (Inbox), PATTERN-C-002 (Registry)
"""

import argparse
import asyncio
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# =============================================================================
# Configuration
# =============================================================================

REGISTRY_FILE = Path("/tmp/ramas-session-registry.json")
WINDOWS_FILE = Path("/tmp/ramas-windows.json")
INBOX_DIR = Path("/tmp/ramas-session-inboxes")

# Timing (seconds)
WAIT_CLAUDE_START = 15      # Wait for Claude Code to start
WAIT_AFTER_REGISTER = 10    # Wait after registering each agent
WAIT_AFTER_SESSION = 15     # Wait after session creation
WAIT_AFTER_JOIN = 10        # Wait after workers join
WAIT_AFTER_BROADCAST = 15   # Wait after task broadcast
WAIT_TASK_EXECUTION = 45    # Wait for task execution
WAIT_AGGREGATION = 20       # Wait for aggregation

# Enter key (CRITICAL: Use \r not \n!)
ENTER_KEY = "\r"
ESC_KEY = "\x1b"


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


def print_step(step_num: int, total: int, text: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}[Step {step_num}/{total}]{Colors.END} {Colors.BOLD}{text}{Colors.END}")
    print("-" * 60)


def print_success(text: str):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")


def print_error(text: str):
    print(f"{Colors.RED}❌ {text}{Colors.END}")


def print_warning(text: str):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")


def print_info(text: str):
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")


def print_waiting(seconds: int, message: str = ""):
    msg = f" ({message})" if message else ""
    print(f"{Colors.DIM}⏳ Waiting {seconds}s{msg}...{Colors.END}")


# =============================================================================
# Demo Steps
# =============================================================================

DEMO_STEPS = [
    ("Check Docker & RabbitMQ", "check_docker"),
    ("Launch iTerm2 Windows", "launch_windows"),
    ("Wait for Claude Code", "wait_claude"),
    ("Register Team Leader", "register_team_leader"),
    ("Register Worker-001", "register_worker_001"),
    ("Register Worker-002", "register_worker_002"),
    ("Create Session", "create_session"),
    ("Worker-001 Join Session", "worker_001_join"),
    ("Worker-002 Join Session", "worker_002_join"),
    ("Broadcast Tasks", "broadcast_tasks"),
    ("Worker-001 Execute", "worker_001_execute"),
    ("Worker-002 Execute", "worker_002_execute"),
    ("Aggregate Results", "aggregate_results"),
]


# =============================================================================
# Helper Functions
# =============================================================================

def check_docker() -> bool:
    """Check if Docker and RabbitMQ are running."""
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=rabbitmq", "--format", "{{.Names}}"],
            capture_output=True, text=True, timeout=10
        )
        if result.stdout.strip():
            print_success("RabbitMQ Docker container is running")
            return True
        else:
            print_error("RabbitMQ container not found")
            print_info("Start with: docker compose up -d agent_rabbitmq")
            return False
    except Exception as e:
        print_error(f"Docker check failed: {e}")
        return False


def get_session_id() -> Optional[str]:
    """Get the current session ID from registry."""
    if not REGISTRY_FILE.exists():
        return None
    try:
        with open(REGISTRY_FILE) as f:
            data = json.load(f)
            sessions = data.get("sessions", {})
            if sessions:
                # Return the most recent session
                return list(sessions.keys())[-1]
    except:
        pass
    return None


async def send_to_agent(agent_id: str, message: str, dry_run: bool = False) -> bool:
    """Send a message to a Claude Code agent via iTerm2."""
    if dry_run:
        print(f"  [DRY RUN] Would send to {agent_id}:")
        print(f"    {message[:100]}...")
        return True

    try:
        import iterm2

        # Get session ID from registry
        if not WINDOWS_FILE.exists():
            print_error("Window registry not found")
            return False

        with open(WINDOWS_FILE) as f:
            windows = json.load(f).get("windows", {})

        if agent_id not in windows:
            print_error(f"Agent '{agent_id}' not found in registry")
            return False

        session_id = windows[agent_id].get("sessionId")
        if not session_id:
            print_error(f"No session ID for '{agent_id}'")
            return False

        # Connect to iTerm2
        connection = await iterm2.Connection.async_create()
        app = await iterm2.async_get_app(connection)

        # Find the session
        session = None
        for window in app.windows:
            for tab in window.tabs:
                for s in tab.sessions:
                    if s.session_id == session_id:
                        session = s
                        break

        if not session:
            print_error(f"Session not found for '{agent_id}'")
            return False

        # Send ESC to clear any pending input
        await session.async_send_text(ESC_KEY)
        await asyncio.sleep(0.3)

        # Send the message
        await session.async_send_text(message)
        await asyncio.sleep(0.3)

        # Press Enter (CRITICAL: Use \r!)
        await session.async_send_text(ENTER_KEY)
        await asyncio.sleep(0.3)

        print_success(f"Message sent to {agent_id}")
        return True

    except ImportError:
        print_error("iterm2 module not installed")
        print_info("Install with: uv pip install iterm2")
        return False
    except Exception as e:
        print_error(f"Failed to send to {agent_id}: {e}")
        return False


# =============================================================================
# Demo Step Implementations
# =============================================================================

class DemoRunner:
    def __init__(self, step_by_step: bool = False, dry_run: bool = False, skip_launch: bool = False):
        self.step_by_step = step_by_step
        self.dry_run = dry_run
        self.skip_launch = skip_launch
        self.session_id: Optional[str] = None

    def pause_if_needed(self, step_name: str):
        """Pause for confirmation if step-by-step mode."""
        if self.step_by_step and not self.dry_run:
            input(f"\n{Colors.YELLOW}Press Enter to continue to: {step_name}...{Colors.END}")

    async def step_check_docker(self) -> bool:
        """Step 1: Check Docker and RabbitMQ."""
        return check_docker()

    async def step_launch_windows(self) -> bool:
        """Step 2: Launch iTerm2 windows."""
        if self.skip_launch:
            print_info("Skipping window launch (--skip-launch)")
            if WINDOWS_FILE.exists():
                print_success("Using existing windows")
                return True
            else:
                print_error("No existing windows found")
                return False

        if self.dry_run:
            print("[DRY RUN] Would launch 3 iTerm2 windows")
            return True

        try:
            result = subprocess.run(
                [sys.executable, str(PROJECT_ROOT / "scripts/ramas/python/launch_windows.py")],
                capture_output=True, text=True, timeout=60
            )
            if result.returncode == 0:
                print_success("Windows launched successfully")
                return True
            else:
                print_error("Failed to launch windows")
                print(result.stderr)
                return False
        except Exception as e:
            print_error(f"Launch failed: {e}")
            return False

    async def step_wait_claude(self) -> bool:
        """Step 3: Wait for Claude Code to start."""
        if self.dry_run:
            print(f"[DRY RUN] Would wait {WAIT_CLAUDE_START}s for Claude Code")
            return True

        print_waiting(WAIT_CLAUDE_START, "Claude Code starting")
        await asyncio.sleep(WAIT_CLAUDE_START)
        print_success("Wait complete")
        return True

    async def step_register_team_leader(self) -> bool:
        """Step 4: Register Team Leader."""
        message = "register_agent MCP tool'unu kullan. agent_id='team-leader', role='team_leader' olarak kayıt ol."
        result = await send_to_agent("team-leader", message, self.dry_run)
        if result and not self.dry_run:
            print_waiting(WAIT_AFTER_REGISTER, "registration")
            await asyncio.sleep(WAIT_AFTER_REGISTER)
        return result

    async def step_register_worker_001(self) -> bool:
        """Step 5: Register Worker-001."""
        message = "register_agent MCP tool'unu kullan. agent_id='worker-001', role='worker' olarak kayıt ol."
        result = await send_to_agent("worker-001", message, self.dry_run)
        if result and not self.dry_run:
            print_waiting(WAIT_AFTER_REGISTER, "registration")
            await asyncio.sleep(WAIT_AFTER_REGISTER)
        return result

    async def step_register_worker_002(self) -> bool:
        """Step 6: Register Worker-002."""
        message = "register_agent MCP tool'unu kullan. agent_id='worker-002', role='worker' olarak kayıt ol."
        result = await send_to_agent("worker-002", message, self.dry_run)
        if result and not self.dry_run:
            print_waiting(WAIT_AFTER_REGISTER, "registration")
            await asyncio.sleep(WAIT_AFTER_REGISTER)
        return result

    async def step_create_session(self) -> bool:
        """Step 7: Create session (Team Leader)."""
        message = "create_session MCP tool'unu kullan. sessionName='demo-primes-fibonacci', sessionType='task_coordination' olsun."
        result = await send_to_agent("team-leader", message, self.dry_run)
        if result and not self.dry_run:
            print_waiting(WAIT_AFTER_SESSION, "session creation")
            await asyncio.sleep(WAIT_AFTER_SESSION)

            # Get session ID
            self.session_id = get_session_id()
            if self.session_id:
                print_success(f"Session created: {self.session_id}")
            else:
                print_warning("Could not detect session ID from registry")

        return result

    async def step_worker_001_join(self) -> bool:
        """Step 8: Worker-001 joins session."""
        if not self.session_id and not self.dry_run:
            self.session_id = get_session_id()
            if not self.session_id:
                print_error("No session ID available")
                return False

        message = f"join_session MCP tool'unu kullan. session_id='{self.session_id}' olarak session'a katıl."
        result = await send_to_agent("worker-001", message, self.dry_run)
        if result and not self.dry_run:
            print_waiting(WAIT_AFTER_JOIN, "join")
            await asyncio.sleep(WAIT_AFTER_JOIN)
        return result

    async def step_worker_002_join(self) -> bool:
        """Step 9: Worker-002 joins session."""
        if not self.session_id and not self.dry_run:
            self.session_id = get_session_id()
            if not self.session_id:
                print_error("No session ID available")
                return False

        message = f"join_session MCP tool'unu kullan. session_id='{self.session_id}' olarak session'a katıl."
        result = await send_to_agent("worker-002", message, self.dry_run)
        if result and not self.dry_run:
            print_waiting(WAIT_AFTER_JOIN, "join")
            await asyncio.sleep(WAIT_AFTER_JOIN)
        return result

    async def step_broadcast_tasks(self) -> bool:
        """Step 10: Broadcast tasks to workers."""
        if not self.session_id and not self.dry_run:
            self.session_id = get_session_id()

        message = f"""session_broadcast MCP tool'unu kullan. session_id='{self.session_id}' ile şu mesajı gönder:

'Görevler:
- worker-001: 1-100 arası ASAL SAYILARI hesapla
- worker-002: 1-100 arası FİBONACCİ SAYILARINI hesapla

Sonuçlarınızı report_task_completion ile bildirin.'"""

        result = await send_to_agent("team-leader", message, self.dry_run)
        if result and not self.dry_run:
            print_waiting(WAIT_AFTER_BROADCAST, "broadcast")
            await asyncio.sleep(WAIT_AFTER_BROADCAST)
        return result

    async def step_worker_001_execute(self) -> bool:
        """Step 11: Worker-001 executes prime task."""
        if not self.session_id and not self.dry_run:
            self.session_id = get_session_id()

        message = f"poll_session_messages MCP tool'unu kullan. session_id='{self.session_id}' ile mesajları oku. Görevini yap: 1-100 arası ASAL sayıları hesapla ve report_task_completion ile bildir."
        result = await send_to_agent("worker-001", message, self.dry_run)
        if result and not self.dry_run:
            print_waiting(WAIT_TASK_EXECUTION, "task execution")
            await asyncio.sleep(WAIT_TASK_EXECUTION)
        return result

    async def step_worker_002_execute(self) -> bool:
        """Step 12: Worker-002 executes fibonacci task."""
        if not self.session_id and not self.dry_run:
            self.session_id = get_session_id()

        message = f"poll_session_messages MCP tool'unu kullan. session_id='{self.session_id}' ile mesajları oku. Görevini yap: 1-100 arası FİBONACCİ sayılarını hesapla ve report_task_completion ile bildir."
        result = await send_to_agent("worker-002", message, self.dry_run)
        # Don't wait here, aggregation will do the waiting
        return result

    async def step_aggregate_results(self) -> bool:
        """Step 13: Team Leader aggregates results."""
        if not self.session_id and not self.dry_run:
            self.session_id = get_session_id()

        if not self.dry_run:
            print_waiting(WAIT_AGGREGATION, "task completion")
            await asyncio.sleep(WAIT_AGGREGATION)

        message = f"poll_session_messages MCP tool'unu kullan. session_id='{self.session_id}' ile worker sonuçlarını oku. Sonra kesişimi hesapla: hem asal hem Fibonacci olan sayılar hangileri? Beklenen: 2, 3, 5, 13, 89"
        return await send_to_agent("team-leader", message, self.dry_run)

    async def run(self) -> bool:
        """Run all demo steps."""
        print(f"\n{Colors.BOLD}{Colors.MAGENTA}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.MAGENTA}{'RAMAS Demo Runner':^60}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.MAGENTA}{'='*60}{Colors.END}")
        print(f"\nMode: {'DRY RUN' if self.dry_run else 'LIVE'}")
        print(f"Step-by-step: {self.step_by_step}")
        print(f"Skip launch: {self.skip_launch}")
        print(f"Total steps: {len(DEMO_STEPS)}")

        step_methods = {
            "check_docker": self.step_check_docker,
            "launch_windows": self.step_launch_windows,
            "wait_claude": self.step_wait_claude,
            "register_team_leader": self.step_register_team_leader,
            "register_worker_001": self.step_register_worker_001,
            "register_worker_002": self.step_register_worker_002,
            "create_session": self.step_create_session,
            "worker_001_join": self.step_worker_001_join,
            "worker_002_join": self.step_worker_002_join,
            "broadcast_tasks": self.step_broadcast_tasks,
            "worker_001_execute": self.step_worker_001_execute,
            "worker_002_execute": self.step_worker_002_execute,
            "aggregate_results": self.step_aggregate_results,
        }

        start_time = time.time()
        failed_steps = []

        for i, (step_name, step_key) in enumerate(DEMO_STEPS, 1):
            self.pause_if_needed(step_name)
            print_step(i, len(DEMO_STEPS), step_name)

            method = step_methods.get(step_key)
            if not method:
                print_error(f"Unknown step: {step_key}")
                continue

            try:
                success = await method()
                if not success:
                    failed_steps.append(step_name)
                    if not self.dry_run and step_key == "check_docker":
                        print_error("Cannot continue without Docker")
                        break
            except Exception as e:
                print_error(f"Step failed: {e}")
                failed_steps.append(step_name)

        # Summary
        elapsed = time.time() - start_time
        print(f"\n{Colors.BOLD}{Colors.MAGENTA}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.MAGENTA}{'Demo Complete':^60}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.MAGENTA}{'='*60}{Colors.END}")

        print(f"\nElapsed time: {elapsed:.1f}s")

        if failed_steps:
            print_error(f"Failed steps: {', '.join(failed_steps)}")
        else:
            print_success("All steps completed successfully!")

        if not self.dry_run:
            print(f"\n{Colors.BOLD}Expected Result:{Colors.END}")
            print("  Intersection of primes and fibonacci (1-100):")
            print(f"  {Colors.GREEN}{{2, 3, 5, 13, 89}}{Colors.END}")

            print(f"\n{Colors.BOLD}Next Steps:{Colors.END}")
            print("  - Check Team Leader window for aggregated results")
            print("  - Use: python session_manager_cli.py list")
            print("  - Use: python inbox_inspector.py stats")

        return len(failed_steps) == 0


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="RAMAS Demo Runner - Single Command Full Demo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python demo_runner.py                    # Run full demo
  python demo_runner.py --step-by-step     # Pause between steps
  python demo_runner.py --dry-run          # Show steps without executing
  python demo_runner.py --skip-launch      # Use existing windows

Expected Result:
  Intersection of primes and fibonacci (1-100) = {2, 3, 5, 13, 89}
        """
    )

    parser.add_argument(
        "--step-by-step", "-s",
        action="store_true",
        help="Pause and wait for confirmation before each step"
    )

    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="Show steps without executing"
    )

    parser.add_argument(
        "--skip-launch", "-S",
        action="store_true",
        help="Skip window launch (use existing windows)"
    )

    args = parser.parse_args()

    runner = DemoRunner(
        step_by_step=args.step_by_step,
        dry_run=args.dry_run,
        skip_launch=args.skip_launch
    )

    success = asyncio.run(runner.run())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
