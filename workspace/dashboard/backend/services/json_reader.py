"""RAMAS Dashboard - JSON File Reader Service

Reads RAMAS JSON files from /tmp/ directory with efficient change detection.
Uses file modification time (mtime) to detect changes and minimize parsing.
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class RamasJsonReader:
    """
    Reads and parses RAMAS JSON files with change detection.

    JSON Sources:
    - /tmp/ramas-windows.json: Agent statuses and window info
    - /tmp/ramas-session-registry.json: Active sessions
    - /tmp/ramas-session-inboxes/*.json: Agent message inboxes
    """

    def __init__(self):
        self.windows_path = Path("/tmp/ramas-windows.json")
        self.registry_path = Path("/tmp/ramas-session-registry.json")
        self.inboxes_path = Path("/tmp/ramas-session-inboxes")

        # Cache for change detection
        self._cache: Dict[str, Tuple[float, Any]] = {}  # path -> (mtime, data)

    def _read_json_file(self, path: Path, default: Any = None) -> Tuple[Any, bool]:
        """
        Read JSON file with change detection.

        Returns:
            Tuple of (data, changed) where changed indicates if file was modified
        """
        if not path.exists():
            logger.debug(f"File not found: {path}")
            return default if default is not None else {}, False

        try:
            mtime = path.stat().st_mtime
            cache_key = str(path)

            # Check if file changed since last read
            if cache_key in self._cache:
                cached_mtime, cached_data = self._cache[cache_key]
                if mtime == cached_mtime:
                    return cached_data, False

            # File changed or not cached - read and parse
            data = json.loads(path.read_text(encoding="utf-8"))
            self._cache[cache_key] = (mtime, data)
            return data, True

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error in {path}: {e}")
            return default if default is not None else {}, False
        except Exception as e:
            logger.error(f"Error reading {path}: {e}")
            return default if default is not None else {}, False

    def get_agents(self) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Get all agent statuses from ramas-windows.json.

        Returns:
            Tuple of (agents_list, changed)
        """
        data, changed = self._read_json_file(self.windows_path, {"windows": {}})

        agents = []
        windows = data.get("windows", {})

        for agent_id, window_info in windows.items():
            # Parse agent data from window info
            # JSON uses camelCase: windowId, sessionId, lastStatusChange
            agent = {
                "id": agent_id,
                "name": window_info.get("name", agent_id),
                "status": window_info.get("status", "red"),
                "role": self._determine_role(agent_id),
                "windowId": window_info.get("windowId", window_info.get("window_id", "unknown")),
                "lastUpdate": window_info.get("lastStatusChange", window_info.get("last_update", datetime.utcnow().timestamp() * 1000))
            }
            # Convert timestamp from ms to ISO string if needed
            if isinstance(agent["lastUpdate"], (int, float)):
                agent["lastUpdate"] = datetime.utcfromtimestamp(agent["lastUpdate"] / 1000).isoformat() + "Z"
            agents.append(agent)

        return agents, changed

    def _determine_role(self, agent_id: str) -> str:
        """Determine agent role from ID."""
        if "leader" in agent_id.lower():
            return "team-leader"
        elif "monitor" in agent_id.lower():
            return "monitor"
        else:
            return "worker"

    def get_sessions(self) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Get all sessions from ramas-session-registry.json.

        Returns:
            Tuple of (sessions_list, changed)
        """
        data, changed = self._read_json_file(self.registry_path, {"sessions": {}})

        sessions = []
        sessions_data = data.get("sessions", {})

        for session_id, session_info in sessions_data.items():
            # Extract participants from session info
            participants = []
            if "participants" in session_info:
                for p in session_info["participants"]:
                    if isinstance(p, dict):
                        participants.append(p.get("agent_id", "unknown"))
                    else:
                        participants.append(str(p))

            session = {
                "id": session_id,
                # Check both naming conventions: session_name (MCP) and name (fallback)
                "name": session_info.get("session_name", session_info.get("name", "Unnamed Session")),
                "state": session_info.get("state", "unknown"),
                "participants": participants,
                "createdAt": session_info.get("created_at", datetime.utcnow().isoformat() + "Z")
            }
            sessions.append(session)

        return sessions, changed

    def get_current_session(self) -> Optional[Dict[str, Any]]:
        """
        Get the most recent session (active or closed).

        Returns the session with the latest created_at timestamp,
        regardless of its state. This ensures the dashboard shows
        "Complete" for closed sessions instead of "No active session".

        Returns:
            The most recent session dict, or None if no sessions exist
        """
        sessions, _ = self.get_sessions()

        if not sessions:
            return None

        # Sort by createdAt descending (most recent first)
        sorted_sessions = sorted(
            sessions,
            key=lambda s: s.get("createdAt", ""),
            reverse=True
        )

        return sorted_sessions[0] if sorted_sessions else None

    def get_messages(self, agent_id: str, limit: int = 50) -> Tuple[List[Dict[str, Any]], bool]:
        """
        Get messages from an agent's inbox.

        Args:
            agent_id: The agent ID to get messages for
            limit: Maximum number of messages to return

        Returns:
            Tuple of (messages_list, changed)
        """
        inbox_path = self.inboxes_path / f"{agent_id}.json"
        data, changed = self._read_json_file(inbox_path, {"sessions": {}})

        messages = []

        # Inbox structure: {"sessions": {"session-id": {"messages": [...]}}}
        for session_id, session_data in data.get("sessions", {}).items():
            for msg in session_data.get("messages", []):
                message = {
                    "id": msg.get("message_id", "unknown"),
                    "senderId": msg.get("sender_id", "unknown"),
                    "type": msg.get("message_type", "unknown"),
                    "content": self._extract_content(msg.get("payload", {})),
                    "timestamp": msg.get("timestamp", datetime.utcnow().isoformat() + "Z")
                }
                messages.append(message)

        # Sort by timestamp descending and limit
        messages.sort(key=lambda x: x["timestamp"], reverse=True)
        return messages[:limit], changed

    def _extract_content(self, payload: Dict[str, Any]) -> str:
        """Extract content from message payload."""
        if isinstance(payload, str):
            return payload
        return payload.get("content", str(payload))

    def get_all_data(self) -> Dict[str, Any]:
        """
        Get all RAMAS data for WebSocket broadcast.

        Returns:
            Combined data with change flags
        """
        agents, agents_changed = self.get_agents()
        sessions, sessions_changed = self.get_sessions()

        return {
            "agents": agents,
            "sessions": sessions,
            "agents_changed": agents_changed,
            "sessions_changed": sessions_changed,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

    def has_changes(self) -> bool:
        """Check if any JSON files have changed since last read."""
        data = self.get_all_data()
        return data["agents_changed"] or data["sessions_changed"]

    def clear_cache(self):
        """Clear the internal cache (useful for testing)."""
        self._cache.clear()
