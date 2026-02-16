#!/usr/bin/env python3
"""
RAMAS Window Launcher (Python API)

Replaces: scripts/demo/launch-iterm2-3windows.sh (381 lines)

Creates 3 side-by-side iTerm2 windows for multi-agent demo:
- LEFT: Team Leader
- CENTER: Worker 1
- RIGHT: Worker 2

Features:
- Uses iTerm2 Python API (no AppleScript)
- Automatic window positioning
- RAMAS registry integration
- Status daemon startup

Usage:
    python scripts/ramas/python/launch_windows.py
    python -m scripts.ramas.python.launch_windows

Author: Dr. Umit Kacar
Date: 2026-01-01
Platform: macOS only
"""

import asyncio
import sys
import os
import json
import time
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    import iterm2
except ImportError:
    print("Error: iTerm2 Python API not installed.")
    print("Install with: uv pip install iterm2")
    sys.exit(1)

# Import RAMAS modules
from src.ramas.python import registry
from src.ramas.python import controller


# =============================================================================
# Configuration
# =============================================================================

# Screen 2 dimensions (1920x1080 Full HD - user configured)
# For 3 side-by-side windows: each window 640px wide
SCREEN_WIDTH = 1920
SCREEN_HEIGHT = 1080
MENU_BAR_HEIGHT = 25
DOCK_HEIGHT = 0  # Set to ~70 if Dock is visible at bottom
WINDOW_WIDTH = 640
WINDOW_HEIGHT = SCREEN_HEIGHT - MENU_BAR_HEIGHT - DOCK_HEIGHT  # 1055px (was 800!)

# Font Configuration (iTerm2 default: Monaco 12)
# User requested larger font for better readability
FONT_NAME = "Monaco"
FONT_SIZE = 16  # Increased from 12 (iTerm2 default) - User preference

# Screen 2 offset (if Screen 2 is to the right of Screen 1)
# Set this to 0 if Screen 2 is primary, or SCREEN_1_WIDTH if secondary
SCREEN_2_OFFSET_X = 1440  # Adjust based on your Screen 1 width

# Worker definitions
# PATTERN-C-003 v3: RAMAS_AGENT_ID + Polling Loop Prompt
# Each agent is given behavioral instructions to actively poll their inbox
#
# Key insight: Claude Code PULLS from inbox instead of being PUSHED to
# This is more reliable because Claude Code is an LLM, not a shell interpreter

# Agent prompts for PATTERN-C-003 v5
# Keypoint Annotation Project Health Check
# Preferred: wait_for_task (instant) with poll_session_messages fallback

TEAM_LEADER_PROMPT = """You are the TEAM LEADER - the OWNER of this team. You are RESPONSIBLE for worker-001 and worker-002.

YOUR MISSION: Keypoint Annotation Project Health Check with Collective Intelligence.

YOUR FIRST ACTION: Read your task template:
Read: workspace/tasks/current/TEAM_LEADER.md

This template contains:
- Session setup instructions
- Task distribution for 2 workers
- Result collection workflow
- Final report format

PATTERN-C-003 v6: Handshake protocol + Bidirectional wake - workers will auto-wake YOU when they complete!
Timeout: 120 seconds per task.

START NOW by reading workspace/tasks/current/TEAM_LEADER.md"""

WORKER_PROMPT_001 = """You are WORKER-001 - Environment & Dependency Specialist.

YOUR MISSION: Check technical environment of Keypoint Annotation project.

YOUR FIRST ACTION: Read your task template:
Read: workspace/tasks/current/WORKER_001.md

This template contains:
- Session join instructions
- Environment checklist (Python, venv, dependencies, port, cache)
- Report format (JSON)
- Communication workflow

PATTERN-C-003 v6: Handshake protocol! Send WORKER_READY after join_session.
wait_for_task() blocks until task arrives - no polling needed.

You are agent ID: worker-001

START NOW: Read workspace/tasks/current/WORKER_001.md then register and wait_for_task."""

WORKER_PROMPT_002 = """You are WORKER-002 - Code Quality & Documentation Specialist.

YOUR MISSION: Analyze code quality of Keypoint Annotation project.

YOUR FIRST ACTION: Read your task template:
Read: workspace/tasks/current/WORKER_002.md

This template contains:
- Session join instructions
- Code analysis checklist (main script, docs, CLAUDE.md, CHANGELOG)
- Report format (JSON)
- Communication workflow

PATTERN-C-003 v6: Handshake protocol! Send WORKER_READY after join_session.
wait_for_task() blocks until task arrives - no polling needed.

You are agent ID: worker-002

START NOW: Read workspace/tasks/current/WORKER_002.md then register and wait_for_task."""

WORKERS = [
    {
        "id": "team-leader",
        "name": "[GREEN] TEAM-LEADER",
        "position": "left",
        "x": SCREEN_2_OFFSET_X + 0,  # Screen 2, left
        "command": f"cd {PROJECT_ROOT} && export RAMAS_AGENT_ID=team-leader && echo '=== TEAM LEADER (ID: team-leader) ===' && claude --dangerously-skip-permissions",
        "initial_prompt": TEAM_LEADER_PROMPT,
    },
    {
        "id": "worker-001",
        "name": "[GREEN] WORKER-001",
        "position": "center",
        "x": SCREEN_2_OFFSET_X + WINDOW_WIDTH,  # Screen 2, center
        "command": f"cd {PROJECT_ROOT} && export RAMAS_AGENT_ID=worker-001 && echo '=== WORKER 1 (ID: worker-001) ===' && claude --dangerously-skip-permissions",
        "initial_prompt": WORKER_PROMPT_001,
    },
    {
        "id": "worker-002",
        "name": "[GREEN] WORKER-002",
        "position": "right",
        "x": SCREEN_2_OFFSET_X + WINDOW_WIDTH * 2,  # Screen 2, right
        "command": f"cd {PROJECT_ROOT} && export RAMAS_AGENT_ID=worker-002 && echo '=== WORKER 2 (ID: worker-002) ===' && claude --dangerously-skip-permissions",
        "initial_prompt": WORKER_PROMPT_002,
    },
]


# =============================================================================
# Docker Check
# =============================================================================

def check_docker_services() -> bool:
    """Check if Docker RabbitMQ is running"""
    print("Checking Docker services...")

    try:
        result = subprocess.run(
            ["docker", "ps"],
            capture_output=True,
            text=True,
        )
        if "agent_rabbitmq" in result.stdout or "rabbitmq" in result.stdout:
            print("✅ RabbitMQ Docker: Running")
            return True
        else:
            print("❌ RabbitMQ not running. Starting...")
            start_docker_services()
            return True
    except Exception as e:
        print(f"⚠️  Docker check failed: {e}")
        return False


def start_docker_services():
    """Start Docker services"""
    compose_file = PROJECT_ROOT / "infrastructure" / "docker" / "compose" / "docker-compose.yml"

    if compose_file.exists():
        subprocess.run([
            "docker", "compose", "-f", str(compose_file),
            "up", "-d", "rabbitmq", "redis", "postgres"
        ])
        print("Waiting for services to start...")
        time.sleep(10)
        print("✅ Docker services started")
    else:
        print("⚠️  Docker compose file not found")


def clean_queues():
    """Clean existing RabbitMQ queues"""
    print("Cleaning existing queues...")
    try:
        subprocess.run([
            "curl", "-s", "-u", "admin:rabbitmq123",
            "-X", "DELETE",
            "http://localhost:15672/api/queues/%2F/agent.tasks"
        ], capture_output=True)
        subprocess.run([
            "curl", "-s", "-u", "admin:rabbitmq123",
            "-X", "DELETE",
            "http://localhost:15672/api/queues/%2F/agent.results"
        ], capture_output=True)
        print("✅ Queues cleaned")
    except Exception:
        print("⚠️  Queue cleanup failed (may not exist)")


# =============================================================================
# Window Creation
# =============================================================================

async def create_worker_window(
    connection: iterm2.Connection,
    worker: Dict
) -> Tuple[iterm2.Window, iterm2.Session, str]:
    """
    Create a single worker window.

    Returns:
        Tuple of (window, session, window_id)
    """
    # Create window
    window = await iterm2.Window.async_create(connection)

    # Wait for window to be fully initialized (iTerm2 API quirk)
    # The tabs list may be empty immediately after creation
    retry_count = 0
    while not window.tabs and retry_count < 10:
        await asyncio.sleep(0.1)
        retry_count += 1

    if not window.tabs:
        raise RuntimeError(f"Failed to create window for {worker['id']}: no tabs after 1s")

    tab = window.tabs[0]

    # Wait for session to be ready (may also take time)
    session = tab.current_session
    retry_count = 0
    while not session and retry_count < 10:
        await asyncio.sleep(0.1)
        session = tab.current_session
        retry_count += 1

    if not session:
        # Try getting session from tab.sessions list
        if tab.sessions:
            session = tab.sessions[0]
        else:
            raise RuntimeError(f"Failed to get session for {worker['id']}")

    # Set name (this also sets tab title - NO TAB TITLE TRAP!)
    await session.async_set_name(worker["name"])

    # Set font size (iTerm2 Python API)
    # Format: "FontName Size" (e.g., "Monaco 14")
    font_string = f"{FONT_NAME} {FONT_SIZE}"
    try:
        await session.async_set_profile_property("Normal Font", font_string)
        print(f"  🔤 Font set to {font_string}")
    except Exception as e:
        print(f"  ⚠️  Font setting failed: {e} (using iTerm2 default)")

    # Position window using iterm2.util.Frame (not the protobuf Frame)
    # window.frame returns api_pb2.Frame which doesn't have .dict attribute
    # Screen 2 (1920x1080): 3 windows of 640x1055 each (full height!)
    new_frame = iterm2.util.Frame(
        origin=iterm2.util.Point(x=worker["x"], y=MENU_BAR_HEIGHT),
        size=iterm2.util.Size(width=WINDOW_WIDTH, height=WINDOW_HEIGHT)
    )
    await window.async_set_frame(new_frame)

    # Run command with reliable ENTER pattern
    # (text → delay → enter - critical for Claude Code!)
    if worker.get("command"):
        await controller.send_command_reliable(session, worker["command"])

    # PATTERN-C-003 v3: Send initial prompt after Claude Code starts
    # This teaches the agent its polling loop behavior
    if worker.get("initial_prompt"):
        # Wait for Claude Code to fully start (shows prompt)
        await asyncio.sleep(8)  # Claude Code needs ~5-8 seconds to initialize

        # Send the initial prompt with reliable ENTER pattern
        # Using \r (carriage return) which is the REAL Enter key in iTerm2
        await session.async_send_text(worker["initial_prompt"])
        await asyncio.sleep(0.3)
        await session.async_send_text("\r")  # REAL Enter key (NOT \n!)

        print(f"  📤 Sent polling loop prompt to {worker['id']}")

    return window, session, window.window_id


async def create_all_windows(
    connection: iterm2.Connection
) -> List[Tuple[str, str, str]]:
    """
    Create all worker windows.

    Returns:
        List of (worker_id, window_id, session_id) tuples
    """
    results = []

    for i, worker in enumerate(WORKERS):
        print(f"Creating window for {worker['id']}...")

        window, session, window_id = await create_worker_window(connection, worker)

        results.append((
            worker["id"],
            window_id,
            session.session_id,
        ))

        # Brief delay between windows
        if i < len(WORKERS) - 1:
            await asyncio.sleep(1)

    return results


# =============================================================================
# Registry Update
# =============================================================================

def save_to_registry(windows: List[Tuple[str, str, str]]):
    """Save window information to RAMAS registry"""
    print("🔧 RAMAS: Saving window registry...")

    registry.clear_registry()

    for worker_id, window_id, session_id in windows:
        registry.save_window(
            worker_id=worker_id,
            window_id=window_id,
            session_id=session_id,
            status="green",
        )

    print(f"✅ RAMAS Registry saved: {registry.REGISTRY_PATH}")


# =============================================================================
# Daemon Startup
# =============================================================================

def start_daemon():
    """Start RAMAS status daemon"""
    print("🚀 RAMAS: Starting Status Daemon...")

    # Kill any existing daemon
    subprocess.run(
        ["pkill", "-f", "status-daemon"],
        capture_output=True,
    )

    # Start Python daemon as module (required for relative imports)
    log_file = Path("/tmp/ramas-daemon.log")

    # Get the venv python path
    venv_python = PROJECT_ROOT / ".venv-ramas" / "bin" / "python3"
    python_exe = str(venv_python) if venv_python.exists() else sys.executable

    with open(log_file, "w") as log:
        # Run as module: python -m src.ramas.python.daemon
        # Use PYTHONUNBUFFERED=1 and -u flag to see output immediately
        daemon_env = {
            **os.environ,
            "PYTHONPATH": str(PROJECT_ROOT),
            "PYTHONUNBUFFERED": "1",
        }
        process = subprocess.Popen(
            [python_exe, "-u", "-m", "src.ramas.python.daemon"],
            stdout=log,
            stderr=log,
            cwd=str(PROJECT_ROOT),
            env=daemon_env,
        )

    # Wait for daemon to start and connect to services
    time.sleep(3)

    if process.poll() is None:
        print(f"✅ RAMAS Daemon started (PID: {process.pid})")
        print(f"   Logs: {log_file}")
    else:
        print("⚠️  RAMAS Daemon failed to start")
        # Show last few lines of log for debugging
        try:
            with open(log_file, "r") as f:
                print(f"   Log: {f.read()[:500]}")
        except Exception:
            pass


# =============================================================================
# Display Functions
# =============================================================================

def display_banner():
    """Display startup banner"""
    print("═" * 68)
    print("     Claude Code Multi-Agent Demo (iTerm2 Python API)")
    print("     3 Windows Side-by-Side Layout with Push Notifications")
    print("═" * 68)
    print()
    print("  RAMAS: Reactive Agent Messaging & Automation System")
    print("  Features: green/red status, ESC interrupt, push notifications")
    print()


def display_window_info(windows: List[Tuple[str, str, str]]):
    """Display window information"""
    print()
    print("═" * 68)
    print("                    TERMINAL IDs (for automation)")
    print("═" * 68)
    print()

    for worker_id, window_id, session_id in windows:
        role = worker_id.upper()
        status = "[GREEN]"
        print(f"  {role} {status}")
        print(f"    Window ID:  {window_id}")
        print(f"    Session ID: {session_id}")
        print()


def display_layout():
    """Display layout diagram"""
    print("═" * 68)
    print("                      WINDOW LAYOUT (Screen 2)")
    print("═" * 68)
    print()
    print("  ┌────────────────┬────────────────┬────────────────┐")
    print("  │  TEAM LEADER   │   WORKER-001   │   WORKER-002   │")
    print(f"  │  (640x{WINDOW_HEIGHT})   │  (640x{WINDOW_HEIGHT})   │  (640x{WINDOW_HEIGHT})   │")
    print("  │      LEFT      │    CENTER      │     RIGHT      │")
    print("  │   Coordinator  │   Environment  │  Code Quality  │")
    print("  └────────────────┴────────────────┴────────────────┘")
    print(f"  Screen 2: {SCREEN_WIDTH}x{SCREEN_HEIGHT} Full HD | Font: {FONT_NAME} {FONT_SIZE}pt")
    print()


def display_workflow():
    """Display workflow instructions"""
    print("═" * 68)
    print("         AUTONOMOUS WORKFLOW (PATTERN-C-003 v5 - Bidirectional)")
    print("═" * 68)
    print()
    print("  ⚡ INSTANT WAKE - No polling! Redis Streams + Two-Phase Check")
    print()
    print("  Window 1 (TEAM LEADER - Coordinator):")
    print("    1. Reads workspace/KEYPOINT_TEAM_LEADER.md")
    print("    2. Creates session with create_session()")
    print("    3. Assigns tasks with assign_session_task() → AUTO-WAKE workers!")
    print("    4. wait_for_task() → INSTANT wake when workers complete!")
    print("    5. Aggregates results into unified health report")
    print()
    print("  Window 2 (WORKER-001 - Environment):")
    print("    1. Reads workspace/KEYPOINT_WORKER_001.md")
    print("    2. wait_for_task() blocks until Team Leader assigns task")
    print("    3. Checks Python, venv, dependencies, port, cache")
    print("    4. session_broadcast() → AUTO-WAKE Team Leader!")
    print()
    print("  Window 3 (WORKER-002 - Code Quality):")
    print("    1. Reads workspace/KEYPOINT_WORKER_002.md")
    print("    2. wait_for_task() blocks until Team Leader assigns task")
    print("    3. Analyzes main script, docs, CLAUDE.md, CHANGELOG")
    print("    4. session_broadcast() → AUTO-WAKE Team Leader!")
    print()
    print("  🎯 v5 FEATURES:")
    print("     - Two-phase wake: catches PENDING signals before blocking")
    print("     - Bidirectional wake: workers wake Team Leader on completion")
    print("     - <1s latency (vs 30s+ timeout in v3)")
    print()


def display_mcp_tools():
    """Display MCP tools reference"""
    print("═" * 68)
    print()
    print("MCP Tools (Core):")
    print("  - register_agent, send_task, get_pending_tasks")
    print("  - complete_task, start_brainstorm, propose_idea")
    print("  - get_messages, get_system_status, broadcast_message")
    print()
    print("MCP Tools (RAMAS - Push Notifications):")
    print("  - set_worker_status   : Worker'ı green/red durumuna ayarla")
    print("  - interrupt_worker    : ESC + acil mesaj gönder (priority=urgent)")
    print("  - get_worker_statuses : Tüm worker durumlarını görüntüle")
    print()
    print("RabbitMQ Management: http://localhost:15672")
    print("  User: admin / Pass: rabbitmq123")
    print()
    print(f"RAMAS Registry: {registry.REGISTRY_PATH}")
    print("RAMAS Daemon Logs: /tmp/ramas-daemon.log")
    print()
    print("═" * 68)


# =============================================================================
# Main
# =============================================================================

async def main():
    """Main entry point"""
    display_banner()

    # Check Docker services
    check_docker_services()

    # Clean queues
    clean_queues()

    print()
    print("Opening 3 iTerm2 windows side-by-side...")
    print()

    # Connect to iTerm2 and create windows
    connection = await iterm2.Connection.async_create()
    windows = await create_all_windows(connection)

    print()
    print("✅ Demo launched!")

    # Wait for windows to settle
    await asyncio.sleep(2)

    # Save to registry
    save_to_registry(windows)

    # Start daemon
    start_daemon()

    # Display information
    display_window_info(windows)
    display_layout()
    display_workflow()
    display_mcp_tools()


def run():
    """Run the launcher"""
    # Use asyncio.run() since we create our own iTerm2 connection inside main()
    asyncio.run(main())


if __name__ == "__main__":
    run()
