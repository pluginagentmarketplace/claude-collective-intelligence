#!/usr/bin/env python3
"""
Session Registry - File-Based Session Store for Pattern C

Solves the Session Not Found Problem (PATTERN-C-002):
- Each MCP server instance runs in isolation
- Session created in one instance not visible to others
- This file-based registry provides shared session state

File Location: /tmp/ramas-session-registry.json

Usage:
    # Create session (Team Leader)
    registry = SharedSessionRegistry()
    registry.register_session(session_id, config)

    # Join session (Worker)
    registry = SharedSessionRegistry()
    session_info = registry.get_session(session_id)

    # List all sessions
    sessions = registry.list_sessions()

Author: Dr. Umit Kacar
Date: 2026-01-03
Bug Fix: PATTERN-C-002 (Session Registry Isolation)
"""

import os
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from datetime import datetime
from threading import Lock
import fcntl
import logging

logger = logging.getLogger(__name__)

# =============================================================================
# Configuration
# =============================================================================

REGISTRY_FILE = Path("/tmp/ramas-session-registry.json")
SESSION_TTL_SECONDS = 3600 * 4  # 4 hours


# =============================================================================
# Session Info Structure
# =============================================================================

@dataclass
class SessionInfo:
    """Session information stored in the registry"""
    session_id: str
    session_name: str
    session_type: str
    creator_id: str
    created_at: str
    state: str = "active"
    participants: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionInfo":
        return cls(**data)

    def is_expired(self) -> bool:
        return time.time() - self.updated_at > SESSION_TTL_SECONDS


# =============================================================================
# Shared Session Registry
# =============================================================================

class SharedSessionRegistry:
    """
    File-based session registry for multi-process session sharing.

    Provides:
    - Shared session state across MCP server instances
    - File locking for safe concurrent access
    - Automatic expiration of old sessions
    - Participant tracking

    Pattern: PATTERN-C-002 (Session Registry Isolation Fix)
    """

    def __init__(self, registry_file: Path = REGISTRY_FILE):
        self.registry_file = registry_file
        self._lock = Lock()
        self._ensure_registry()

    def _ensure_registry(self) -> None:
        """Ensure registry file exists"""
        if not self.registry_file.exists():
            self._write_registry({"sessions": {}, "version": "1.0.0"})

    def _read_registry(self) -> Dict[str, Any]:
        """Read registry with file locking"""
        try:
            with open(self.registry_file, 'r') as f:
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                try:
                    data = json.load(f)
                finally:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                return data
        except (json.JSONDecodeError, FileNotFoundError):
            return {"sessions": {}, "version": "1.0.0"}

    def _write_registry(self, data: Dict[str, Any]) -> None:
        """Write registry with file locking"""
        with self._lock:
            with open(self.registry_file, 'w') as f:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    json.dump(data, f, indent=2)
                finally:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)

    def register_session(
        self,
        session_id: str,
        session_name: str,
        session_type: str,
        creator_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SessionInfo:
        """
        Register a new session in the shared registry.

        Args:
            session_id: Unique session identifier
            session_name: Human-readable session name
            session_type: Type of session (task_coordination, brainstorm, meeting)
            creator_id: Agent ID of the session creator
            metadata: Optional metadata

        Returns:
            SessionInfo object
        """
        session_info = SessionInfo(
            session_id=session_id,
            session_name=session_name,
            session_type=session_type,
            creator_id=creator_id,
            created_at=datetime.utcnow().isoformat(),
            participants=[creator_id],
            metadata=metadata or {}
        )

        registry = self._read_registry()
        registry["sessions"][session_id] = session_info.to_dict()
        self._write_registry(registry)

        logger.info(f"Session registered: {session_id} by {creator_id}")
        return session_info

    def get_session(self, session_id: str) -> Optional[SessionInfo]:
        """
        Get session info by ID.

        Args:
            session_id: Session identifier

        Returns:
            SessionInfo if found and not expired, None otherwise
        """
        registry = self._read_registry()
        session_data = registry.get("sessions", {}).get(session_id)

        if not session_data:
            return None

        session_info = SessionInfo.from_dict(session_data)

        if session_info.is_expired():
            self.unregister_session(session_id)
            return None

        return session_info

    def add_participant(self, session_id: str, agent_id: str) -> bool:
        """
        Add a participant to a session.

        Args:
            session_id: Session identifier
            agent_id: Agent joining the session

        Returns:
            True if successful, False otherwise
        """
        registry = self._read_registry()
        session_data = registry.get("sessions", {}).get(session_id)

        if not session_data:
            return False

        if agent_id not in session_data["participants"]:
            session_data["participants"].append(agent_id)
            session_data["updated_at"] = time.time()
            registry["sessions"][session_id] = session_data
            self._write_registry(registry)
            logger.info(f"Participant {agent_id} added to session {session_id}")

        return True

    def remove_participant(self, session_id: str, agent_id: str) -> bool:
        """
        Remove a participant from a session.

        Args:
            session_id: Session identifier
            agent_id: Agent leaving the session

        Returns:
            True if successful, False otherwise
        """
        registry = self._read_registry()
        session_data = registry.get("sessions", {}).get(session_id)

        if not session_data:
            return False

        if agent_id in session_data["participants"]:
            session_data["participants"].remove(agent_id)
            session_data["updated_at"] = time.time()
            registry["sessions"][session_id] = session_data
            self._write_registry(registry)
            logger.info(f"Participant {agent_id} removed from session {session_id}")

        return True

    def update_session_state(self, session_id: str, state: str) -> bool:
        """
        Update session state.

        Args:
            session_id: Session identifier
            state: New state (active, paused, closed)

        Returns:
            True if successful, False otherwise
        """
        registry = self._read_registry()
        session_data = registry.get("sessions", {}).get(session_id)

        if not session_data:
            return False

        session_data["state"] = state
        session_data["updated_at"] = time.time()
        registry["sessions"][session_id] = session_data
        self._write_registry(registry)
        logger.info(f"Session {session_id} state updated to {state}")

        return True

    def unregister_session(self, session_id: str) -> bool:
        """
        Remove a session from the registry.

        Args:
            session_id: Session identifier

        Returns:
            True if successful, False if not found
        """
        registry = self._read_registry()

        if session_id in registry.get("sessions", {}):
            del registry["sessions"][session_id]
            self._write_registry(registry)
            logger.info(f"Session unregistered: {session_id}")
            return True

        return False

    def list_sessions(self, include_expired: bool = False) -> List[SessionInfo]:
        """
        List all sessions in the registry.

        Args:
            include_expired: Include expired sessions

        Returns:
            List of SessionInfo objects
        """
        registry = self._read_registry()
        sessions = []

        for session_data in registry.get("sessions", {}).values():
            session_info = SessionInfo.from_dict(session_data)

            if include_expired or not session_info.is_expired():
                sessions.append(session_info)

        return sessions

    def cleanup_expired(self) -> int:
        """
        Remove expired sessions from the registry.

        Returns:
            Number of sessions removed
        """
        registry = self._read_registry()
        removed = 0

        sessions_to_remove = []
        for session_id, session_data in registry.get("sessions", {}).items():
            session_info = SessionInfo.from_dict(session_data)
            if session_info.is_expired():
                sessions_to_remove.append(session_id)

        for session_id in sessions_to_remove:
            del registry["sessions"][session_id]
            removed += 1

        if removed > 0:
            self._write_registry(registry)
            logger.info(f"Cleaned up {removed} expired sessions")

        return removed


# =============================================================================
# Module-level singleton
# =============================================================================

_registry_instance: Optional[SharedSessionRegistry] = None


def get_session_registry() -> SharedSessionRegistry:
    """Get the shared session registry instance"""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = SharedSessionRegistry()
    return _registry_instance


# =============================================================================
# CLI for testing
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Session Registry CLI")
    parser.add_argument("--list", action="store_true", help="List all sessions")
    parser.add_argument("--get", type=str, help="Get session by ID")
    parser.add_argument("--cleanup", action="store_true", help="Cleanup expired sessions")

    args = parser.parse_args()

    registry = get_session_registry()

    if args.list:
        sessions = registry.list_sessions()
        print(f"\n📋 Active Sessions ({len(sessions)}):")
        print("=" * 60)
        for s in sessions:
            print(f"  {s.session_id[:20]}... | {s.session_name} | {s.state}")
            print(f"    Creator: {s.creator_id} | Participants: {len(s.participants)}")
        print("=" * 60)

    elif args.get:
        session = registry.get_session(args.get)
        if session:
            print(f"\n📁 Session: {session.session_id}")
            print(f"   Name: {session.session_name}")
            print(f"   Type: {session.session_type}")
            print(f"   State: {session.state}")
            print(f"   Creator: {session.creator_id}")
            print(f"   Participants: {session.participants}")
        else:
            print(f"❌ Session not found: {args.get}")

    elif args.cleanup:
        removed = registry.cleanup_expired()
        print(f"🧹 Cleaned up {removed} expired sessions")

    else:
        parser.print_help()
