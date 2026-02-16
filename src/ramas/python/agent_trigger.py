#!/usr/bin/env python3
"""
RAMAS: Agent Trigger

PATTERN-C-003: Autonomous Multi-Agent Orchestration

Triggers Claude Code sessions via iTerm2 API when RabbitMQ messages arrive.
Enables fully autonomous workflow without manual intervention.

DUAL-MODE TRIGGERING:
- urgent=True  → FORCE_TRIGGER: Immediately, ignore busy status
- urgent=False → QUEUE_AND_RETRY: Wait for green status

CRITICAL RULE:
- Use \\r (carriage return) for Enter, NEVER \\n (newline)!
- \\n causes sessions to hang (Shift+Enter instead of real Enter)

Author: Dr. Umit Kacar
Date: 2026-01-03
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Any

try:
    import iterm2
except ImportError:
    iterm2 = None  # Will be checked at runtime

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

# File paths
WINDOW_REGISTRY_PATH = Path("/tmp/ramas-windows.json")
PENDING_TRIGGERS_PATH = Path("/tmp/ramas-pending-triggers.json")

# Timing configuration
DEFAULT_TRIGGER_DELAY = 0.5    # Delay between multiple triggers
DEFAULT_COMMAND_DELAY = 1.0    # Delay before sending Enter
DEFAULT_QUEUE_CHECK_INTERVAL = 1.0  # How often to check pending queue

# THE MOST IMPORTANT CONSTANTS
ENTER_KEY = "\r"   # CORRECT: Carriage return = Real Enter
CTRL_C = "\x03"    # Interrupt current command
ESC_KEY = "\x1b"   # Escape key to clear input

# Command template
TRIGGER_COMMAND_TEMPLATE = "poll_session_messages tool ile session {session_id} mesajlarını oku"


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class TriggerRequest:
    """A pending trigger request."""
    agent_id: str
    session_id: str
    message_type: str
    created_at: float = field(default_factory=time.time)
    retry_count: int = 0
    max_retries: int = 5


@dataclass
class WindowInfo:
    """Information about an agent's iTerm2 window."""
    window_id: str
    session_id: str
    status: str
    registered_at: int


# =============================================================================
# AgentTrigger Class
# =============================================================================

class AgentTrigger:
    """
    Triggers Claude Code sessions via iTerm2 API.

    DUAL-MODE TRIGGERING:
    - urgent=True  → FORCE_TRIGGER: Immediately, ignore busy status
    - urgent=False → QUEUE_AND_RETRY: Wait for green status

    Usage:
        trigger = AgentTrigger()

        # Normal trigger (respects busy status)
        await trigger.trigger_agent("worker-001", "session-123")

        # Urgent trigger (ignores busy status)
        await trigger.trigger_agent("worker-001", "session-123", urgent=True)

        # Force interrupt (sends Ctrl+C first)
        await trigger.force_interrupt("worker-001", "URGENT: Stop immediately!")
    """

    def __init__(
        self,
        registry_path: Path = WINDOW_REGISTRY_PATH,
        pending_path: Path = PENDING_TRIGGERS_PATH,
        trigger_delay: float = DEFAULT_TRIGGER_DELAY,
        command_delay: float = DEFAULT_COMMAND_DELAY,
        queue_check_interval: float = DEFAULT_QUEUE_CHECK_INTERVAL,
    ):
        self.registry_path = registry_path
        self.pending_path = pending_path
        self.trigger_delay = trigger_delay
        self.command_delay = command_delay
        self.queue_check_interval = queue_check_interval

        # Pending triggers queue (agent_id -> list of TriggerRequest)
        self.pending_triggers: Dict[str, List[TriggerRequest]] = {}

        # Background task for processing pending triggers
        self._queue_processor_task: Optional[asyncio.Task] = None

        # Load pending triggers from disk
        self._load_pending_triggers()

    # =========================================================================
    # Public API
    # =========================================================================

    async def trigger_agent(
        self,
        agent_id: str,
        session_id: str,
        message_type: str = "message",
        urgent: bool = False,
    ) -> bool:
        """
        Send poll command to agent's Claude session.

        Args:
            agent_id: Target agent identifier (e.g., "worker-001")
            session_id: Session containing the message
            message_type: Type of message (task, result, chat, etc.)
            urgent: If True, force trigger. If False, queue if busy.

        Returns:
            True if trigger sent (or queued) successfully
        """
        logger.info(f"Trigger request: agent={agent_id}, session={session_id}, urgent={urgent}")

        # Get agent info from registry
        window_info = self._get_window_info(agent_id)
        if not window_info:
            logger.warning(f"Agent {agent_id} not found in registry")
            return False

        # Check agent status
        status = window_info.status.lower()

        if status == "green" or urgent:
            # Send immediately
            return await self._send_trigger(agent_id, session_id, window_info)
        else:
            # Agent is busy (red), queue the trigger
            logger.info(f"Agent {agent_id} is busy (status={status}), queueing trigger")
            self._queue_trigger(agent_id, session_id, message_type)
            return True  # Queued successfully

    async def trigger_multiple(
        self,
        agent_ids: List[str],
        session_id: str,
        message_type: str = "message",
        urgent: bool = False,
    ) -> Dict[str, bool]:
        """
        Trigger multiple agents.

        Args:
            agent_ids: List of agent identifiers
            session_id: Session containing the message
            message_type: Type of message
            urgent: If True, force trigger all

        Returns:
            Dict mapping agent_id to success status
        """
        results = {}
        for agent_id in agent_ids:
            results[agent_id] = await self.trigger_agent(
                agent_id, session_id, message_type, urgent
            )
            await asyncio.sleep(self.trigger_delay)
        return results

    async def force_interrupt(self, agent_id: str, message: str) -> bool:
        """
        Send Ctrl+C interrupt then message - for critical alerts.

        This interrupts whatever the agent is doing and sends an urgent message.

        Args:
            agent_id: Target agent identifier
            message: Urgent message to send

        Returns:
            True if interrupt and message sent successfully
        """
        logger.warning(f"Force interrupt: agent={agent_id}, message={message[:50]}...")

        window_info = self._get_window_info(agent_id)
        if not window_info:
            logger.error(f"Agent {agent_id} not found for force interrupt")
            return False

        try:
            session = await self._find_iterm_session(window_info.session_id)
            if not session:
                logger.error(f"iTerm2 session not found for {agent_id}")
                return False

            # 1. Send Ctrl+C to stop current command
            await session.async_send_text(CTRL_C)
            await asyncio.sleep(0.3)

            # 2. Send ESC to clear any partial input
            await session.async_send_text(ESC_KEY)
            await asyncio.sleep(0.2)

            # 3. Send urgent message
            await session.async_send_text(message)
            await asyncio.sleep(self.command_delay)

            # 4. Send Enter (CRITICAL: Use \r not \n!)
            await session.async_send_text(ENTER_KEY)

            logger.info(f"Force interrupt sent to {agent_id}")
            return True

        except Exception as e:
            logger.error(f"Force interrupt failed for {agent_id}: {e}")
            return False

    async def start_queue_processor(self):
        """Start background task to process pending triggers."""
        if self._queue_processor_task is None:
            self._queue_processor_task = asyncio.create_task(self._process_pending_triggers_loop())
            logger.info("Queue processor started")

    async def stop_queue_processor(self):
        """Stop background queue processor."""
        if self._queue_processor_task:
            self._queue_processor_task.cancel()
            try:
                await self._queue_processor_task
            except asyncio.CancelledError:
                pass
            self._queue_processor_task = None
            logger.info("Queue processor stopped")

    # =========================================================================
    # Private: Trigger Sending
    # =========================================================================

    async def _send_trigger(
        self,
        agent_id: str,
        session_id: str,
        window_info: WindowInfo,
    ) -> bool:
        """Send trigger command to agent's iTerm2 session."""
        try:
            # Find the iTerm2 session
            session = await self._find_iterm_session(window_info.session_id)
            if not session:
                logger.error(f"iTerm2 session not found for {agent_id}")
                return False

            # Build command
            command = TRIGGER_COMMAND_TEMPLATE.format(session_id=session_id)

            # Send command text
            await session.async_send_text(command)
            await asyncio.sleep(self.command_delay)

            # Send Enter (CRITICAL: Use \r not \n!)
            await session.async_send_text(ENTER_KEY)

            logger.info(f"Trigger sent to {agent_id}: {command[:50]}...")
            return True

        except Exception as e:
            logger.error(f"Failed to send trigger to {agent_id}: {e}")
            return False

    async def _find_iterm_session(self, target_session_id: str) -> Optional[Any]:
        """Find iTerm2 session by ID."""
        if iterm2 is None:
            logger.error("iterm2 module not available")
            return None

        try:
            connection = await iterm2.Connection.async_create()
            app = await iterm2.async_get_app(connection)

            for window in app.windows:
                for tab in window.tabs:
                    for session in tab.sessions:
                        if session.session_id == target_session_id:
                            return session

            logger.warning(f"Session {target_session_id} not found in iTerm2")
            return None

        except Exception as e:
            logger.error(f"Error finding iTerm2 session: {e}")
            return None

    # =========================================================================
    # Private: Queue Management
    # =========================================================================

    def _queue_trigger(self, agent_id: str, session_id: str, message_type: str):
        """Add trigger to pending queue."""
        if agent_id not in self.pending_triggers:
            self.pending_triggers[agent_id] = []

        request = TriggerRequest(
            agent_id=agent_id,
            session_id=session_id,
            message_type=message_type,
        )
        self.pending_triggers[agent_id].append(request)

        # Persist to disk
        self._save_pending_triggers()

        logger.info(f"Trigger queued for {agent_id} (queue size: {len(self.pending_triggers[agent_id])})")

    async def _process_pending_triggers_loop(self):
        """Background loop to process pending triggers."""
        logger.info("Starting pending triggers processor loop")

        while True:
            try:
                await asyncio.sleep(self.queue_check_interval)
                await self._process_pending_triggers()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in pending triggers loop: {e}")

    async def _process_pending_triggers(self):
        """Process all pending triggers for agents that are now available."""
        agents_to_remove = []

        for agent_id, requests in list(self.pending_triggers.items()):
            if not requests:
                agents_to_remove.append(agent_id)
                continue

            # Check if agent is now available
            window_info = self._get_window_info(agent_id)
            if not window_info:
                continue

            if window_info.status.lower() == "green":
                # Agent available! Send all pending triggers
                logger.info(f"Agent {agent_id} now available, processing {len(requests)} pending triggers")

                for request in requests:
                    success = await self._send_trigger(
                        request.agent_id,
                        request.session_id,
                        window_info,
                    )
                    if not success:
                        request.retry_count += 1
                        if request.retry_count >= request.max_retries:
                            logger.error(f"Trigger for {agent_id} exceeded max retries, discarding")

                    await asyncio.sleep(self.trigger_delay)

                # Clear processed triggers
                agents_to_remove.append(agent_id)

        # Remove processed agents from pending
        for agent_id in agents_to_remove:
            if agent_id in self.pending_triggers:
                del self.pending_triggers[agent_id]

        if agents_to_remove:
            self._save_pending_triggers()

    # =========================================================================
    # Private: Registry Access
    # =========================================================================

    def _get_window_info(self, agent_id: str) -> Optional[WindowInfo]:
        """Get window info for agent from registry."""
        try:
            if not self.registry_path.exists():
                logger.warning(f"Window registry not found: {self.registry_path}")
                return None

            with open(self.registry_path, 'r') as f:
                data = json.load(f)

            windows = data.get("windows", {})
            if agent_id not in windows:
                return None

            w = windows[agent_id]
            return WindowInfo(
                window_id=w.get("windowId", ""),
                session_id=w.get("sessionId", ""),
                status=w.get("status", "unknown"),
                registered_at=w.get("registeredAt", 0),
            )

        except Exception as e:
            logger.error(f"Error reading window registry: {e}")
            return None

    # =========================================================================
    # Private: Persistence
    # =========================================================================

    def _save_pending_triggers(self):
        """Save pending triggers to disk."""
        try:
            data = {
                "pending": {
                    agent_id: [
                        {
                            "agent_id": r.agent_id,
                            "session_id": r.session_id,
                            "message_type": r.message_type,
                            "created_at": r.created_at,
                            "retry_count": r.retry_count,
                        }
                        for r in requests
                    ]
                    for agent_id, requests in self.pending_triggers.items()
                },
                "saved_at": time.time(),
            }

            with open(self.pending_path, 'w') as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            logger.error(f"Error saving pending triggers: {e}")

    def _load_pending_triggers(self):
        """Load pending triggers from disk."""
        try:
            if not self.pending_path.exists():
                return

            with open(self.pending_path, 'r') as f:
                data = json.load(f)

            pending = data.get("pending", {})
            for agent_id, requests in pending.items():
                self.pending_triggers[agent_id] = [
                    TriggerRequest(
                        agent_id=r["agent_id"],
                        session_id=r["session_id"],
                        message_type=r["message_type"],
                        created_at=r.get("created_at", time.time()),
                        retry_count=r.get("retry_count", 0),
                    )
                    for r in requests
                ]

            if self.pending_triggers:
                logger.info(f"Loaded {sum(len(r) for r in self.pending_triggers.values())} pending triggers from disk")

        except Exception as e:
            logger.error(f"Error loading pending triggers: {e}")


# =============================================================================
# Singleton Instance
# =============================================================================

_agent_trigger_instance: Optional[AgentTrigger] = None


def get_agent_trigger() -> AgentTrigger:
    """Get singleton AgentTrigger instance."""
    global _agent_trigger_instance
    if _agent_trigger_instance is None:
        _agent_trigger_instance = AgentTrigger()
    return _agent_trigger_instance


# =============================================================================
# Main (for testing)
# =============================================================================

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    async def main():
        trigger = get_agent_trigger()

        if len(sys.argv) >= 3:
            agent_id = sys.argv[1]
            session_id = sys.argv[2]
            urgent = "--urgent" in sys.argv

            print(f"Triggering {agent_id} for session {session_id} (urgent={urgent})")
            result = await trigger.trigger_agent(agent_id, session_id, urgent=urgent)
            print(f"Result: {result}")
        else:
            print("Usage: python agent_trigger.py <agent_id> <session_id> [--urgent]")

    asyncio.run(main())
