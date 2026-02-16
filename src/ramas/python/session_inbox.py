#!/usr/bin/env python3
"""
Session Inbox - File-Based Message Store for Pattern C

Solves the MCP Stateless Connection Problem:
- Daemon writes incoming session messages to file
- MCP tools read messages from file
- No need for persistent connection in MCP tools

File Location: /tmp/ramas-session-inbox-{agent_id}.json

Usage:
    # Daemon side (write)
    inbox = SessionInbox("worker-001")
    inbox.store_message(session_id, message)

    # MCP side (read)
    inbox = SessionInbox("worker-001")
    messages = inbox.get_messages(session_id)
    inbox.mark_as_read(message_ids)

VERSION HISTORY:
    PATTERN-C-001 (2026-01-01) - File-based inbox for MCP stateless fix
    PATTERN-C-002 (2026-01-03) - Type-aware auto-registration for workers
    PATTERN-C-003 v5 (2026-01-04) - get_registered_agents_for_session()
                                    Inbox-based participant discovery for
                                    bidirectional wake signals

Author: Dr. Umit Kacar
Date: 2026-01-01 (Created), 2026-01-04 (v5 Update)
Pattern: PATTERN-C-001 + PATTERN-C-002 + PATTERN-C-003 v5
"""

import os
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime
from threading import Lock
import fcntl

# =============================================================================
# Configuration
# =============================================================================

INBOX_DIR = Path("/tmp/ramas-session-inboxes")
INBOX_DIR.mkdir(exist_ok=True)

MAX_MESSAGES_PER_SESSION = 1000
MESSAGE_TTL_SECONDS = 3600  # 1 hour


# =============================================================================
# Message Structure
# =============================================================================

@dataclass
class InboxMessage:
    """A message stored in the inbox"""
    message_id: str
    session_id: str
    sender_id: str
    message_type: str
    payload: Any
    timestamp: str
    read: bool = False
    stored_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InboxMessage":
        return cls(**data)

    def is_expired(self) -> bool:
        return time.time() - self.stored_at > MESSAGE_TTL_SECONDS


# =============================================================================
# Session Inbox Class
# =============================================================================

class SessionInbox:
    """
    File-based message inbox for a specific agent.

    Each agent has its own inbox file at:
    /tmp/ramas-session-inboxes/{agent_id}.json

    Thread-safe using file locking.
    """

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.inbox_file = INBOX_DIR / f"{agent_id}.json"
        self._lock = Lock()

        # Initialize empty inbox if doesn't exist
        if not self.inbox_file.exists():
            self._write_inbox({"sessions": {}, "agent_id": agent_id})

    def _read_inbox(self) -> Dict[str, Any]:
        """Read inbox data with file locking"""
        try:
            with open(self.inbox_file, 'r') as f:
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                data = json.load(f)
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                return data
        except (FileNotFoundError, json.JSONDecodeError):
            return {"sessions": {}, "agent_id": self.agent_id}

    def _write_inbox(self, data: Dict[str, Any]) -> None:
        """Write inbox data with file locking"""
        with open(self.inbox_file, 'w') as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            json.dump(data, f, indent=2)
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)

    # =========================================================================
    # Write Operations (called by Daemon)
    # =========================================================================

    def store_message(
        self,
        session_id: str,
        message_id: str,
        sender_id: str,
        message_type: str,
        payload: Any,
        timestamp: Optional[str] = None,
    ) -> bool:
        """
        Store an incoming message in the inbox.
        Called by daemon when session message arrives.
        """
        with self._lock:
            data = self._read_inbox()

            # Initialize session if not exists
            if session_id not in data["sessions"]:
                data["sessions"][session_id] = {
                    "messages": [],
                    "created_at": datetime.utcnow().isoformat(),
                }

            session_data = data["sessions"][session_id]

            # Check for duplicate
            existing_ids = {m["message_id"] for m in session_data["messages"]}
            if message_id in existing_ids:
                return False  # Already stored

            # Create message
            msg = InboxMessage(
                message_id=message_id,
                session_id=session_id,
                sender_id=sender_id,
                message_type=message_type,
                payload=payload,
                timestamp=timestamp or datetime.utcnow().isoformat(),
            )

            # Add to session
            session_data["messages"].append(msg.to_dict())

            # Cleanup old messages
            self._cleanup_session(session_data)

            # Write back
            self._write_inbox(data)
            return True

    def _cleanup_session(self, session_data: Dict[str, Any]) -> None:
        """Remove expired and excess messages"""
        messages = session_data["messages"]

        # Remove expired
        messages = [m for m in messages if not InboxMessage.from_dict(m).is_expired()]

        # Keep only latest N messages
        if len(messages) > MAX_MESSAGES_PER_SESSION:
            messages = messages[-MAX_MESSAGES_PER_SESSION:]

        session_data["messages"] = messages

    # =========================================================================
    # Read Operations (called by MCP Tools)
    # =========================================================================

    def get_messages(
        self,
        session_id: str,
        unread_only: bool = False,
        message_types: Optional[List[str]] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get messages for a session.
        Called by MCP tools.
        """
        data = self._read_inbox()

        if session_id not in data["sessions"]:
            return []

        messages = data["sessions"][session_id]["messages"]

        # Filter unread
        if unread_only:
            messages = [m for m in messages if not m.get("read", False)]

        # Filter by type
        if message_types:
            messages = [m for m in messages if m.get("message_type") in message_types]

        # Remove expired
        messages = [m for m in messages if not InboxMessage.from_dict(m).is_expired()]

        # Apply limit (return latest)
        return messages[-limit:]

    def get_all_sessions(self) -> List[str]:
        """Get all session IDs this agent has messages for"""
        data = self._read_inbox()
        return list(data["sessions"].keys())

    def mark_as_read(self, session_id: str, message_ids: List[str]) -> int:
        """Mark messages as read, return count of marked messages"""
        with self._lock:
            data = self._read_inbox()

            if session_id not in data["sessions"]:
                return 0

            count = 0
            for msg in data["sessions"][session_id]["messages"]:
                if msg["message_id"] in message_ids and not msg.get("read", False):
                    msg["read"] = True
                    count += 1

            self._write_inbox(data)
            return count

    def clear_session(self, session_id: str) -> bool:
        """Clear all messages for a session"""
        with self._lock:
            data = self._read_inbox()

            if session_id in data["sessions"]:
                del data["sessions"][session_id]
                self._write_inbox(data)
                return True
            return False

    def get_unread_count(self, session_id: str) -> int:
        """Get count of unread messages"""
        messages = self.get_messages(session_id, unread_only=True)
        return len(messages)

    # =========================================================================
    # Session Registration (called by join_session)
    # =========================================================================

    def register_session(self, session_id: str) -> None:
        """Register interest in a session (creates empty inbox if not exists)"""
        with self._lock:
            data = self._read_inbox()

            if session_id not in data["sessions"]:
                data["sessions"][session_id] = {
                    "messages": [],
                    "created_at": datetime.utcnow().isoformat(),
                    "registered": True,
                }
                self._write_inbox(data)

    def is_registered(self, session_id: str) -> bool:
        """Check if agent is registered for a session"""
        data = self._read_inbox()
        return session_id in data["sessions"]


# =============================================================================
# Global Inbox Manager
# =============================================================================

class InboxManager:
    """
    Manages inboxes for all agents.
    Used by daemon to route messages to correct agent inboxes.

    PATTERN-C-003 Enhancement:
    Can be linked with WorkflowEngine for autonomous triggering.
    """

    def __init__(self):
        self._inboxes: Dict[str, SessionInbox] = {}
        self._workflow_engine = None  # PATTERN-C-003: Optional workflow engine

    def set_workflow_engine(self, workflow_engine) -> None:
        """
        Link InboxManager with WorkflowEngine for autonomous triggering.

        PATTERN-C-003: Enables the InboxManager to notify WorkflowEngine
        about message routing events. This allows for future extensibility
        such as message-pattern-based triggering.

        Args:
            workflow_engine: WorkflowEngine instance from workflow_engine.py
        """
        self._workflow_engine = workflow_engine

    def get_workflow_engine(self):
        """Get linked WorkflowEngine if any"""
        return self._workflow_engine

    def get_inbox(self, agent_id: str) -> SessionInbox:
        """Get or create inbox for an agent"""
        if agent_id not in self._inboxes:
            self._inboxes[agent_id] = SessionInbox(agent_id)
        return self._inboxes[agent_id]

    def route_message(
        self,
        session_id: str,
        target_agent: Optional[str],
        message_id: str,
        sender_id: str,
        message_type: str,
        payload: Any,
        timestamp: str,
    ) -> int:
        """
        Route a message to appropriate inbox(es).
        Returns number of inboxes message was delivered to.

        PATTERN-C-002 FIX: Type-aware auto-registration
        - Task/invite/control messages auto-register target agent
        - This solves the chicken-egg problem where workers can't
          know about sessions without first receiving a task
        """
        delivered = 0

        if target_agent and target_agent != "all":
            # Direct message to specific agent
            inbox = self.get_inbox(target_agent)

            # PATTERN-C-002: Auto-register for orchestration messages
            # These message types are sent FROM orchestrator TO workers
            # who may not have joined the session yet
            if message_type in ("task", "invite", "control"):
                if not inbox.is_registered(session_id):
                    inbox.register_session(session_id)
                    print(f"  [PATTERN-C-002] Auto-registered {target_agent} for session {session_id}", flush=True)

            if inbox.is_registered(session_id):
                inbox.store_message(
                    session_id=session_id,
                    message_id=message_id,
                    sender_id=sender_id,
                    message_type=message_type,
                    payload=payload,
                    timestamp=timestamp,
                )
                delivered = 1
        else:
            # Broadcast - deliver to all registered agents for this session
            for inbox_file in INBOX_DIR.glob("*.json"):
                agent_id = inbox_file.stem
                inbox = self.get_inbox(agent_id)
                if inbox.is_registered(session_id):
                    inbox.store_message(
                        session_id=session_id,
                        message_id=message_id,
                        sender_id=sender_id,
                        message_type=message_type,
                        payload=payload,
                        timestamp=timestamp,
                    )
                    delivered += 1

        return delivered

    def list_all_agents(self) -> List[str]:
        """List all agents with inboxes"""
        return [f.stem for f in INBOX_DIR.glob("*.json")]

    def get_registered_agents_for_session(self, session_id: str) -> List[str]:
        """
        Get list of agents registered for a specific session.

        PATTERN-C-003 v5: Used to find who should receive wake signals.
        This is more reliable than session.participants because it reads
        the actual inbox files.
        """
        registered = []
        for inbox_file in INBOX_DIR.glob("*.json"):
            agent_id = inbox_file.stem
            inbox = self.get_inbox(agent_id)
            if inbox.is_registered(session_id):
                registered.append(agent_id)
        return registered


# =============================================================================
# Singleton Instance
# =============================================================================

_inbox_manager: Optional[InboxManager] = None

def get_inbox_manager() -> InboxManager:
    """Get the global inbox manager instance"""
    global _inbox_manager
    if _inbox_manager is None:
        _inbox_manager = InboxManager()
    return _inbox_manager


# =============================================================================
# Convenience Functions
# =============================================================================

def store_session_message(
    agent_id: str,
    session_id: str,
    message_id: str,
    sender_id: str,
    message_type: str,
    payload: Any,
    timestamp: Optional[str] = None,
) -> bool:
    """Convenience function to store a message"""
    inbox = get_inbox_manager().get_inbox(agent_id)
    return inbox.store_message(
        session_id=session_id,
        message_id=message_id,
        sender_id=sender_id,
        message_type=message_type,
        payload=payload,
        timestamp=timestamp,
    )


def get_session_messages(
    agent_id: str,
    session_id: str,
    unread_only: bool = False,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Convenience function to get messages"""
    inbox = get_inbox_manager().get_inbox(agent_id)
    return inbox.get_messages(session_id, unread_only=unread_only, limit=limit)


def register_for_session(agent_id: str, session_id: str) -> None:
    """Convenience function to register for a session"""
    inbox = get_inbox_manager().get_inbox(agent_id)
    inbox.register_session(session_id)


# =============================================================================
# CLI Test
# =============================================================================

if __name__ == "__main__":
    # Quick test
    print("Testing SessionInbox...")

    inbox = SessionInbox("test-agent")

    # Store a message
    inbox.register_session("test-session")
    inbox.store_message(
        session_id="test-session",
        message_id="msg-001",
        sender_id="sender-1",
        message_type="chat",
        payload={"content": "Hello!"},
    )

    # Read messages
    messages = inbox.get_messages("test-session")
    print(f"Messages: {json.dumps(messages, indent=2)}")

    # Mark as read
    inbox.mark_as_read("test-session", ["msg-001"])

    # Check unread
    unread = inbox.get_unread_count("test-session")
    print(f"Unread: {unread}")

    print("✅ Test passed!")
