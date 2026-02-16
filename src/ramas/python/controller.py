#!/usr/bin/env python3
"""
RAMAS iTerm2 Python API Controller

Replaces: applescript-controller.js (407 lines)
Uses: Official iTerm2 Python API (WebSocket-based)

Key improvements:
- No Quote Hell (Python handles strings natively)
- No Tab Title Trap (session.async_set_name works correctly)
- Async/await throughout
- Type hints for better IDE support
- Direct session control (no window ID lookup needed)

Author: Dr. Umit Kacar
Date: 2026-01-01
Platform: macOS only (requires iTerm2 with Python API enabled)
"""

import asyncio
import sys
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum

# iTerm2 Python API
try:
    import iterm2
except ImportError:
    print("Error: iTerm2 Python API not installed.")
    print("Install with: uv pip install iterm2")
    print("Also ensure iTerm2 > Preferences > General > Magic > Enable Python API")
    sys.exit(1)


# =============================================================================
# Constants
# =============================================================================

class KeyCode(Enum):
    """Key codes for special keys (same as AppleScript key codes)"""
    ESC = 53
    ENTER = 36
    TAB = 48
    SPACE = 49
    DELETE = 51
    C = 8  # 'c' key, used with Control for Ctrl+C


@dataclass
class Delays:
    """Default delay values (seconds)"""
    AFTER_ESC: float = 0.2
    AFTER_MESSAGE: float = 0.1
    BETWEEN_COMMANDS: float = 0.15
    AFTER_CTRL_C: float = 0.1
    BEFORE_ENTER: float = 1.0  # Critical: Wait before pressing ENTER for Claude Code


DELAYS = Delays()


# =============================================================================
# Session Management
# =============================================================================

@dataclass
class SessionInfo:
    """Information about an iTerm2 session"""
    session_id: str
    window_id: str
    tab_id: str
    name: str
    profile: str


async def get_app(connection: iterm2.Connection) -> iterm2.App:
    """Get the iTerm2 application object"""
    return await iterm2.async_get_app(connection)


async def get_all_sessions(connection: iterm2.Connection) -> List[iterm2.Session]:
    """Get all sessions from all windows"""
    app = await get_app(connection)
    sessions = []

    for window in app.windows:
        for tab in window.tabs:
            for session in tab.sessions:
                sessions.append(session)

    return sessions


async def get_session_by_name(
    connection: iterm2.Connection,
    name: str
) -> Optional[iterm2.Session]:
    """Find a session by its name (e.g., '[GREEN] WORKER-001')"""
    sessions = await get_all_sessions(connection)

    for session in sessions:
        session_name = await session.async_get_variable("name")
        if session_name == name:
            return session

    return None


async def get_session_by_worker_id(
    connection: iterm2.Connection,
    worker_id: str
) -> Optional[iterm2.Session]:
    """
    Find a session by worker ID (e.g., 'worker-001').

    Uses the RAMAS registry to get the session ID, then finds
    the matching session in iTerm2. This is more reliable than
    matching by session name since iTerm2 shows process names.
    """
    # Import registry here to avoid circular import
    from . import registry

    # Get session ID from registry
    worker_info = registry.get_window(worker_id)
    if not worker_info or not worker_info.session_id:
        print(f"[RAMAS] Worker {worker_id} not found in registry")
        return None

    target_session_id = worker_info.session_id

    # Find session by ID
    sessions = await get_all_sessions(connection)
    for session in sessions:
        if session.session_id == target_session_id:
            return session

    print(f"[RAMAS] Session {target_session_id} not found in iTerm2")
    return None


async def get_window_for_session(
    connection: iterm2.Connection,
    session: iterm2.Session
) -> Optional[iterm2.Window]:
    """Get the window containing a session"""
    app = await get_app(connection)

    for window in app.windows:
        for tab in window.tabs:
            if session in tab.sessions:
                return window

    return None


# =============================================================================
# Core Functions (Replacing AppleScript)
# =============================================================================

async def send_esc(session: iterm2.Session) -> bool:
    """
    Send ESC key to a session.

    Replaces AppleScript:
        tell application "System Events"
            key code 53
        end tell

    Returns:
        bool: True if successful
    """
    try:
        # Send ESC character (ASCII 27)
        await session.async_send_text("\x1b")
        return True
    except Exception as e:
        print(f"[RAMAS] Error sending ESC: {e}")
        return False


async def send_ctrl_c(session: iterm2.Session) -> bool:
    """
    Send Ctrl+C to a session (interrupt current process).

    Replaces AppleScript:
        tell application "System Events"
            key code 8 using control down
        end tell

    Returns:
        bool: True if successful
    """
    try:
        # Send Ctrl+C (ASCII 3)
        await session.async_send_text("\x03")
        return True
    except Exception as e:
        print(f"[RAMAS] Error sending Ctrl+C: {e}")
        return False


async def write_text(session: iterm2.Session, text: str) -> bool:
    """
    Write text to a session WITHOUT pressing Enter.

    Replaces AppleScript:
        write text "..." newline NO

    Note: No quote escaping needed! Python API handles it.

    Returns:
        bool: True if successful
    """
    try:
        await session.async_send_text(text)
        return True
    except Exception as e:
        print(f"[RAMAS] Error writing text: {e}")
        return False


async def send_command_reliable(
    session: iterm2.Session,
    command: str,
    enter_delay: float = DELAYS.BEFORE_ENTER
) -> bool:
    """
    Send a command to session with reliable ENTER key handling.

    CRITICAL: This function implements the "text → delay → enter" pattern
    that is REQUIRED for interactive programs like Claude Code.

    Pattern:
        1. Send command text (without Enter)
        2. Wait for terminal to process (1 second default)
        3. Send Enter key separately

    This pattern prevents race conditions where the Enter key
    is processed before the text is fully written.

    Args:
        session: iTerm2 session
        command: Command to send
        enter_delay: Delay before pressing Enter (default: 1.0s)

    Returns:
        bool: True if successful
    """
    try:
        # Step 1: Write command text WITHOUT Enter
        await session.async_send_text(command)

        # Step 2: Wait for terminal buffer to process
        await asyncio.sleep(enter_delay)

        # Step 3: Send Enter key SEPARATELY
        # CRITICAL: Use \r (carriage return) NOT \n (line feed)!
        # \n = Shift+Enter (new line), \r = Real Enter (submit)
        await session.async_send_text("\r")

        return True
    except Exception as e:
        print(f"[RAMAS] Error sending command: {e}")
        return False


async def send_message(
    session: iterm2.Session,
    text: str,
    enter_delay: float = DELAYS.BEFORE_ENTER
) -> bool:
    """
    Write text to a session AND press Enter.

    Replaces AppleScript:
        write text "..."

    IMPORTANT: Sends text first, waits, then presses Enter separately.
    This is critical for interactive programs like Claude Code.

    Args:
        session: iTerm2 session
        text: Text to send
        enter_delay: Delay before pressing Enter (default: 1.0s)

    Returns:
        bool: True if successful
    """
    try:
        # Step 1: Send text WITHOUT Enter
        await session.async_send_text(text)

        # Step 2: Wait for terminal to process
        await asyncio.sleep(enter_delay)

        # Step 3: Send Enter SEPARATELY
        # CRITICAL: \r = Real Enter, \n = Shift+Enter
        await session.async_send_text("\r")

        return True
    except Exception as e:
        print(f"[RAMAS] Error sending message: {e}")
        return False


async def update_title(session: iterm2.Session, title: str) -> bool:
    """
    Update session name (which also updates tab title).

    THIS SOLVES THE TAB TITLE TRAP!

    AppleScript (FAILS with Error -10000):
        tell current tab
            set title to "..."  -- ERROR!
        end tell

    Python API (WORKS):
        await session.async_set_name("...")  -- Correctly sets tab title!

    Returns:
        bool: True if successful
    """
    try:
        await session.async_set_name(title)
        return True
    except Exception as e:
        print(f"[RAMAS] Error updating title: {e}")
        return False


async def update_status_badge(
    session: iterm2.Session,
    worker_id: str,
    status: str
) -> bool:
    """
    Update session badge with status indicator.

    Uses iTerm2 badge feature (overlay text) instead of tab title
    because Claude Code overrides tab titles when running.

    Example: worker_id="worker-001", status="green"
             Result: Badge shows "🟢 GREEN" or "🔴 RED"

    Returns:
        bool: True if successful
    """
    try:
        # Get profile to set badge
        profile = await session.async_get_profile()

        # Set badge based on status
        if status.lower() == "green":
            badge_text = "🟢 GREEN"
        elif status.lower() == "red":
            badge_text = "🔴 RED"
        else:
            badge_text = f"⚪ {status.upper()}"

        await profile.async_set_badge_text(badge_text)

        # Also try to set title (may be overridden by Claude Code)
        title = f"[{status.upper()}] {worker_id.upper()}"
        await session.async_set_name(title)

        return True
    except Exception as e:
        print(f"[RAMAS] Error updating badge: {e}")
        return False


async def update_status_title(
    session: iterm2.Session,
    worker_id: str,
    status: str
) -> bool:
    """
    Update session status (uses badge for visibility).

    Wrapper for update_status_badge for backward compatibility.

    Returns:
        bool: True if successful
    """
    return await update_status_badge(session, worker_id, status)


async def interrupt_and_message(
    session: iterm2.Session,
    message: str,
    esc_delay: float = DELAYS.AFTER_ESC,
    press_enter: bool = True,
    enter_delay: float = DELAYS.BEFORE_ENTER
) -> bool:
    """
    Send ESC to clear current input, then write a message.

    Replaces AppleScript interruptAndMessage function.

    IMPORTANT: Uses separate text + delay + Enter pattern for reliability
    with interactive programs like Claude Code.

    Args:
        session: iTerm2 session
        message: Message to send
        esc_delay: Delay after ESC (seconds)
        press_enter: Whether to press Enter after message
        enter_delay: Delay before pressing Enter (default: 1.0s)

    Returns:
        bool: True if successful
    """
    try:
        # 1. Send ESC to clear current input
        await send_esc(session)
        await asyncio.sleep(esc_delay)

        # 2. Send message text
        message_text = f"📩 MESSAGE: {message}"
        await write_text(session, message_text)

        # 3. Wait and send Enter separately (critical for Claude Code!)
        # CRITICAL: \r = Real Enter key, \n = Shift+Enter (multiline)
        if press_enter:
            await asyncio.sleep(enter_delay)
            await session.async_send_text("\r")

        return True
    except Exception as e:
        print(f"[RAMAS] Error in interrupt_and_message: {e}")
        return False


async def urgent_interrupt(
    session: iterm2.Session,
    message: str
) -> bool:
    """
    Urgent interrupt: Ctrl+C + ESC + message.

    Replaces AppleScript urgentInterrupt function.

    This will:
    1. Send Ctrl+C to kill any running process
    2. Send ESC to clear input
    3. Send urgent message with emoji

    Returns:
        bool: True if successful
    """
    try:
        # 1. Send Ctrl+C to kill running process
        await send_ctrl_c(session)
        await asyncio.sleep(DELAYS.AFTER_CTRL_C)

        # 2. Send ESC to clear input
        await send_esc(session)
        await asyncio.sleep(DELAYS.AFTER_ESC)

        # 3. Send urgent message
        await send_message(session, f"🚨 URGENT: {message}")

        return True
    except Exception as e:
        print(f"[RAMAS] Error in urgent_interrupt: {e}")
        return False


# =============================================================================
# Window Management
# =============================================================================

async def focus_window(window: iterm2.Window) -> bool:
    """
    Bring window to front.

    Replaces AppleScript:
        tell application "iTerm2"
            activate
            set frontmost of window id ... to true
        end tell

    Returns:
        bool: True if successful
    """
    try:
        await window.async_activate()
        return True
    except Exception as e:
        print(f"[RAMAS] Error focusing window: {e}")
        return False


async def get_all_windows(connection: iterm2.Connection) -> List[iterm2.Window]:
    """
    Get all iTerm2 windows.

    Replaces AppleScript getAllWindowIds function.

    Returns:
        List of window objects
    """
    app = await get_app(connection)
    return list(app.windows)


async def get_window_info(window: iterm2.Window) -> Dict[str, Any]:
    """
    Get window information (position, size, session name).

    Replaces AppleScript getWindowInfo function.

    Returns:
        Dict with window info
    """
    try:
        frame = window.frame
        current_session = window.current_tab.current_session
        session_name = await current_session.async_get_variable("name")

        return {
            "x": frame.origin.x,
            "y": frame.origin.y,
            "width": frame.size.width,
            "height": frame.size.height,
            "session_name": session_name,
            "window_id": window.window_id,
        }
    except Exception as e:
        print(f"[RAMAS] Error getting window info: {e}")
        return {}


async def create_window(
    connection: iterm2.Connection,
    profile: Optional[str] = None
) -> Tuple[iterm2.Window, iterm2.Session]:
    """
    Create a new iTerm2 window.

    Args:
        connection: iTerm2 connection
        profile: Optional profile name

    Returns:
        Tuple of (window, session)
    """
    if profile:
        window = await iterm2.Window.async_create(connection, profile=profile)
    else:
        window = await iterm2.Window.async_create(connection)

    session = window.current_tab.current_session
    return window, session


async def set_window_position(
    window: iterm2.Window,
    x: int,
    y: int
) -> bool:
    """
    Set window position.

    Returns:
        bool: True if successful
    """
    try:
        frame = window.frame
        frame.origin.x = x
        frame.origin.y = y
        await window.async_set_frame(frame)
        return True
    except Exception as e:
        print(f"[RAMAS] Error setting window position: {e}")
        return False


async def set_window_size(
    window: iterm2.Window,
    width: int,
    height: int
) -> bool:
    """
    Set window size.

    Returns:
        bool: True if successful
    """
    try:
        frame = window.frame
        frame.size.width = width
        frame.size.height = height
        await window.async_set_frame(frame)
        return True
    except Exception as e:
        print(f"[RAMAS] Error setting window size: {e}")
        return False


# =============================================================================
# Platform Checks
# =============================================================================

def is_macos() -> bool:
    """Check if running on macOS"""
    return sys.platform == "darwin"


async def is_iterm2_running() -> bool:
    """
    Check if iTerm2 is running and Python API is enabled.

    Note: This will attempt to connect to iTerm2.
    """
    if not is_macos():
        return False

    try:
        # Try to connect to iTerm2
        connection = await iterm2.Connection.async_create()
        await connection.async_disconnect()
        return True
    except Exception:
        return False


# =============================================================================
# ITerm2Controller Class (Optional wrapper)
# =============================================================================

class ITerm2Controller:
    """
    High-level controller for iTerm2 automation.

    Usage:
        async with ITerm2Controller() as controller:
            session = await controller.get_session_by_worker_id("worker-001")
            await controller.update_status_title(session, "worker-001", "green")
    """

    def __init__(self):
        self.connection: Optional[iterm2.Connection] = None
        self.app: Optional[iterm2.App] = None

    async def __aenter__(self) -> "ITerm2Controller":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()

    async def connect(self) -> bool:
        """Connect to iTerm2"""
        try:
            self.connection = await iterm2.Connection.async_create()
            self.app = await iterm2.async_get_app(self.connection)
            return True
        except Exception as e:
            print(f"[RAMAS] Error connecting to iTerm2: {e}")
            return False

    async def disconnect(self):
        """Disconnect from iTerm2"""
        if self.connection:
            await self.connection.async_disconnect()
            self.connection = None
            self.app = None

    async def get_session_by_worker_id(self, worker_id: str) -> Optional[iterm2.Session]:
        """Find session by worker ID"""
        if not self.connection:
            return None
        return await get_session_by_worker_id(self.connection, worker_id)

    async def get_all_sessions(self) -> List[iterm2.Session]:
        """Get all sessions"""
        if not self.connection:
            return []
        return await get_all_sessions(self.connection)

    async def send_esc(self, session: iterm2.Session) -> bool:
        """Send ESC to session"""
        return await send_esc(session)

    async def send_ctrl_c(self, session: iterm2.Session) -> bool:
        """Send Ctrl+C to session"""
        return await send_ctrl_c(session)

    async def send_message(self, session: iterm2.Session, message: str) -> bool:
        """Send message to session"""
        return await send_message(session, message)

    async def update_title(self, session: iterm2.Session, title: str) -> bool:
        """Update session title"""
        return await update_title(session, title)

    async def update_status_title(
        self,
        session: iterm2.Session,
        worker_id: str,
        status: str
    ) -> bool:
        """Update session title with status"""
        return await update_status_title(session, worker_id, status)

    async def interrupt_and_message(
        self,
        session: iterm2.Session,
        message: str
    ) -> bool:
        """ESC + message"""
        return await interrupt_and_message(session, message)

    async def urgent_interrupt(
        self,
        session: iterm2.Session,
        message: str
    ) -> bool:
        """Ctrl+C + ESC + urgent message"""
        return await urgent_interrupt(session, message)

    async def create_window(
        self,
        profile: Optional[str] = None
    ) -> Tuple[Optional[iterm2.Window], Optional[iterm2.Session]]:
        """Create new window"""
        if not self.connection:
            return None, None
        return await create_window(self.connection, profile)


# =============================================================================
# Main (for testing)
# =============================================================================

async def main():
    """Test the controller"""
    print("Testing RAMAS iTerm2 Python Controller...")

    if not is_macos():
        print("Error: This script only works on macOS")
        return

    async with ITerm2Controller() as controller:
        sessions = await controller.get_all_sessions()
        print(f"Found {len(sessions)} sessions")

        for session in sessions:
            name = await session.async_get_variable("name")
            print(f"  - {name}")


if __name__ == "__main__":
    iterm2.run_until_complete(main)
