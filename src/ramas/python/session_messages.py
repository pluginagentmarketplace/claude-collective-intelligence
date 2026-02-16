#!/usr/bin/env python3
"""
Session Message Types for Pattern C

Defines message structures for session-based multi-agent communication.

Message Types:
    - CHAT: General discussion messages
    - TASK: Task assignment and updates
    - RESULT: Task completion results
    - CONTROL: Session control messages
    - PRESENCE: Join/leave/heartbeat

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

from enum import Enum
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
from datetime import datetime
from uuid import uuid4
import json


# =============================================================================
# Message Types
# =============================================================================

class MessageType(Enum):
    """Types of session messages"""

    CHAT = "chat"
    TASK = "task"
    RESULT = "result"
    CONTROL = "control"
    PRESENCE = "presence"
    MEETING = "meeting"
    VOTE = "vote"
    HISTORY = "history"


class PresenceAction(Enum):
    """Presence message actions"""

    JOIN = "join"
    LEAVE = "leave"
    HEARTBEAT = "heartbeat"
    RECONNECT = "reconnect"
    READY = "ready"


class ControlAction(Enum):
    """Control message actions"""

    SESSION_START = "session_start"
    SESSION_CLOSING = "session_closing"
    SESSION_CLOSED = "session_closed"
    STATE_SYNC = "state_sync"
    CHECKPOINT = "checkpoint"
    LEADER_ELECTION = "leader_election"
    LEADER_ELECTED = "leader_elected"
    RECOVERY_START = "recovery_start"
    RECOVERY_COMPLETE = "recovery_complete"


class TaskStatus(Enum):
    """Task statuses"""

    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"


class MeetingStatus(Enum):
    """Meeting statuses"""

    SCHEDULED = "scheduled"
    STARTING = "starting"
    IN_PROGRESS = "in_progress"
    VOTING = "voting"
    CONCLUDED = "concluded"


# =============================================================================
# Base Session Message
# =============================================================================

@dataclass
class SessionMessage:
    """
    Base message for all session communication.

    All messages flow through RabbitMQ with routing key:
    session.{session_id}.{message_type}.{target_agent}
    """

    # Required fields
    session_id: str
    message_type: MessageType
    sender_id: str
    payload: Any

    # Auto-generated
    message_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    sequence: Optional[int] = None  # Set by RabbitMQ stream

    # Optional routing
    target_agent: Optional[str] = None  # None = broadcast to all
    reply_to: Optional[str] = None  # For request/response patterns
    correlation_id: Optional[str] = None

    # Message properties
    ttl: int = 3600  # seconds
    priority: int = 5  # 1-10 (10 = highest)

    # History/replay
    is_replay: bool = False
    original_timestamp: Optional[str] = None

    def to_routing_key(self) -> str:
        """Generate RabbitMQ routing key"""
        target = self.target_agent or "all"
        return f"session.{self.session_id}.{self.message_type.value}.{target}"

    def to_headers(self) -> Dict[str, str]:
        """Generate message headers for RabbitMQ"""
        # Note: Don't include 'timestamp' here - aio_pika Message has its own timestamp parameter
        # Including it in headers can cause type conflicts with some aio_pika versions
        return {
            "session_id": self.session_id,
            "message_type": self.message_type.value,
            "sender_id": self.sender_id,
            "message_id": self.message_id,
            "x-match": "all",
        }

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary"""
        data = asdict(self)
        data["message_type"] = self.message_type.value
        return data

    def to_json(self) -> str:
        """Serialize to JSON string"""
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionMessage":
        """Deserialize from dictionary"""
        data = data.copy()
        data["message_type"] = MessageType(data["message_type"])
        return cls(**data)

    @classmethod
    def from_json(cls, json_str: str) -> "SessionMessage":
        """Deserialize from JSON string"""
        return cls.from_dict(json.loads(json_str))


# =============================================================================
# Specialized Message Types
# =============================================================================

@dataclass
class ChatMessage(SessionMessage):
    """Message for general discussion in session"""

    def __post_init__(self):
        # Set message type
        object.__setattr__(self, 'message_type', MessageType.CHAT)
        if isinstance(self.payload, str):
            self.payload = {"content": self.payload}
        self.payload.setdefault("mentions", [])
        self.payload.setdefault("thread_id", None)
        self.payload.setdefault("attachments", [])


@dataclass
class PresenceMessage(SessionMessage):
    """Message for presence updates (join/leave/heartbeat)"""

    def __post_init__(self):
        object.__setattr__(self, 'message_type', MessageType.PRESENCE)
        if not isinstance(self.payload, dict):
            self.payload = {}
        self.payload.setdefault("action", PresenceAction.HEARTBEAT.value)
        self.payload.setdefault("agent_role", "worker")
        self.payload.setdefault("capabilities", [])
        self.payload.setdefault("status", "ready")


@dataclass
class ControlMessage(SessionMessage):
    """Message for session control (state changes, sync)"""

    def __post_init__(self):
        object.__setattr__(self, 'message_type', MessageType.CONTROL)
        if not isinstance(self.payload, dict):
            self.payload = {"action": self.payload}
        self.payload.setdefault("action", ControlAction.STATE_SYNC.value)


@dataclass
class TaskMessage(SessionMessage):
    """Message for task assignment and updates"""

    def __post_init__(self):
        object.__setattr__(self, 'message_type', MessageType.TASK)
        if not isinstance(self.payload, dict):
            self.payload = {}
        self.payload.setdefault("task_id", str(uuid4()))
        self.payload.setdefault("status", TaskStatus.PENDING.value)
        self.payload.setdefault("task_type", "general")
        self.payload.setdefault("title", "Untitled Task")
        self.payload.setdefault("description", "")
        self.payload.setdefault("priority", "normal")
        self.payload.setdefault("estimated_minutes", None)
        self.payload.setdefault("dependencies", [])
        self.payload.setdefault("acceptance_criteria", [])


@dataclass
class ResultMessage(SessionMessage):
    """Message for task completion results"""

    def __post_init__(self):
        object.__setattr__(self, 'message_type', MessageType.RESULT)
        if not isinstance(self.payload, dict):
            self.payload = {"result": self.payload}
        self.payload.setdefault("task_id", None)
        self.payload.setdefault("success", True)
        self.payload.setdefault("error", None)
        self.payload.setdefault("deliverables", [])
        self.payload.setdefault("notes", "")


@dataclass
class MeetingMessage(SessionMessage):
    """Message for meeting coordination"""

    def __post_init__(self):
        object.__setattr__(self, 'message_type', MessageType.MEETING)
        if not isinstance(self.payload, dict):
            self.payload = {}
        self.payload.setdefault("meeting_id", str(uuid4()))
        self.payload.setdefault("meeting_type", "general")
        self.payload.setdefault("status", MeetingStatus.SCHEDULED.value)
        self.payload.setdefault("agenda", [])
        self.payload.setdefault("participants", [])
        self.payload.setdefault("decisions", [])


@dataclass
class VoteMessage(SessionMessage):
    """Message for voting in meetings"""

    def __post_init__(self):
        object.__setattr__(self, 'message_type', MessageType.VOTE)
        if not isinstance(self.payload, dict):
            self.payload = {}
        self.payload.setdefault("proposal_id", str(uuid4()))
        self.payload.setdefault("vote", None)  # approve, reject, abstain
        self.payload.setdefault("reasoning", "")
        self.payload.setdefault("options", [])


# =============================================================================
# Message Factory
# =============================================================================

class SessionMessageFactory:
    """Factory for creating session messages"""

    @staticmethod
    def chat(
        session_id: str,
        sender_id: str,
        content: str,
        target_agent: Optional[str] = None,
        mentions: Optional[List[str]] = None,
        thread_id: Optional[str] = None,
    ) -> ChatMessage:
        """Create a chat message"""
        return ChatMessage(
            session_id=session_id,
            message_type=MessageType.CHAT,
            sender_id=sender_id,
            target_agent=target_agent,
            payload={
                "content": content,
                "mentions": mentions or [],
                "thread_id": thread_id,
            }
        )

    @staticmethod
    def presence(
        session_id: str,
        sender_id: str,
        action: PresenceAction,
        agent_role: str = "worker",
        capabilities: Optional[List[str]] = None,
    ) -> PresenceMessage:
        """Create a presence message"""
        return PresenceMessage(
            session_id=session_id,
            message_type=MessageType.PRESENCE,
            sender_id=sender_id,
            payload={
                "action": action.value,
                "agent_role": agent_role,
                "capabilities": capabilities or [],
                "status": "ready",
            }
        )

    @staticmethod
    def control(
        session_id: str,
        sender_id: str,
        action: ControlAction,
        data: Optional[Dict[str, Any]] = None,
    ) -> ControlMessage:
        """Create a control message"""
        payload = {"action": action.value}
        if data:
            payload.update(data)
        return ControlMessage(
            session_id=session_id,
            message_type=MessageType.CONTROL,
            sender_id=sender_id,
            payload=payload
        )

    @staticmethod
    def task(
        session_id: str,
        sender_id: str,
        target_agent: str,
        title: str,
        description: str,
        task_type: str = "general",
        priority: str = "normal",
        dependencies: Optional[List[str]] = None,
    ) -> TaskMessage:
        """Create a task assignment message"""
        return TaskMessage(
            session_id=session_id,
            message_type=MessageType.TASK,
            sender_id=sender_id,
            target_agent=target_agent,
            payload={
                "task_id": str(uuid4()),
                "title": title,
                "description": description,
                "task_type": task_type,
                "priority": priority,
                "status": TaskStatus.ASSIGNED.value,
                "dependencies": dependencies or [],
            }
        )

    @staticmethod
    def result(
        session_id: str,
        sender_id: str,
        target_agent: str,
        task_id: str,
        success: bool,
        result: Any,
        error: Optional[str] = None,
    ) -> ResultMessage:
        """Create a result message"""
        return ResultMessage(
            session_id=session_id,
            message_type=MessageType.RESULT,
            sender_id=sender_id,
            target_agent=target_agent,
            payload={
                "task_id": task_id,
                "success": success,
                "result": result,
                "error": error,
            }
        )

    @staticmethod
    def meeting_start(
        session_id: str,
        sender_id: str,
        title: str,
        meeting_type: str = "general",
        agenda: Optional[List[Dict[str, Any]]] = None,
    ) -> MeetingMessage:
        """Create a meeting start message"""
        return MeetingMessage(
            session_id=session_id,
            message_type=MessageType.MEETING,
            sender_id=sender_id,
            payload={
                "meeting_id": str(uuid4()),
                "title": title,
                "meeting_type": meeting_type,
                "status": MeetingStatus.STARTING.value,
                "agenda": agenda or [],
            }
        )

    @staticmethod
    def vote(
        session_id: str,
        sender_id: str,
        proposal_id: str,
        vote: str,
        reasoning: Optional[str] = None,
    ) -> VoteMessage:
        """Create a vote message"""
        return VoteMessage(
            session_id=session_id,
            message_type=MessageType.VOTE,
            sender_id=sender_id,
            payload={
                "proposal_id": proposal_id,
                "vote": vote,
                "reasoning": reasoning or "",
            }
        )


# =============================================================================
# Message Validation
# =============================================================================

def validate_message(msg: SessionMessage) -> List[str]:
    """Validate a session message, return list of errors"""
    errors = []

    if not msg.session_id:
        errors.append("session_id is required")

    if not msg.sender_id:
        errors.append("sender_id is required")

    if not isinstance(msg.message_type, MessageType):
        errors.append("invalid message_type")

    if msg.priority < 1 or msg.priority > 10:
        errors.append("priority must be between 1 and 10")

    if msg.ttl < 0:
        errors.append("ttl must be non-negative")

    return errors


def is_broadcast(msg: SessionMessage) -> bool:
    """Check if message is broadcast (no specific target)"""
    return msg.target_agent is None or msg.target_agent == "all"


def is_direct(msg: SessionMessage) -> bool:
    """Check if message is direct (has specific target)"""
    return msg.target_agent is not None and msg.target_agent != "all"
