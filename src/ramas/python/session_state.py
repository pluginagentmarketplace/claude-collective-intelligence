#!/usr/bin/env python3
"""
Session State Machine for Pattern C

Defines the session lifecycle states, transitions, and events
for multi-agent Claude Code orchestration.

States:
    INITIALIZING -> WAITING_FOR_WORKERS -> ACTIVE -> CLOSING -> CLOSED
    Error paths: SUSPENDED, RECOVERING, LEADER_ELECTION, DEGRADED, FAILED

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Callable, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# Session States
# =============================================================================

class SessionState(Enum):
    """All possible session states"""

    # Lifecycle states (happy path)
    INITIALIZING = "initializing"
    WAITING_FOR_WORKERS = "waiting_for_workers"
    ACTIVE = "active"
    CLOSING = "closing"
    CLOSED = "closed"

    # Error/recovery states
    SUSPENDED = "suspended"
    RECOVERING = "recovering"
    LEADER_ELECTION = "leader_election"
    PARTITIONED = "partitioned"
    DEGRADED = "degraded"
    FAILED = "failed"


class SubState(Enum):
    """Sub-states when in ACTIVE state"""

    IDLE = "idle"
    PROCESSING = "processing"
    BRAINSTORMING = "brainstorming"
    MEETING = "meeting"


class ParticipantStatus(Enum):
    """Status of a session participant"""

    JOINING = "joining"
    ACTIVE = "active"
    BUSY = "busy"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"
    LEFT = "left"


# =============================================================================
# Session Events (Triggers)
# =============================================================================

class SessionEvent(Enum):
    """Events that trigger state transitions"""

    # Lifecycle events
    CREATE_SESSION = "create_session"
    LEADER_READY = "leader_ready"
    WORKER_JOINED = "worker_joined"
    ALL_WORKERS_JOINED = "all_workers_joined"
    FORCE_START = "force_start"
    CLOSE_REQUEST = "close_request"
    ALL_TASKS_COMPLETE = "all_tasks_complete"
    SESSION_CLOSED = "session_closed"

    # Timeout events
    INIT_TIMEOUT = "init_timeout"
    JOIN_TIMEOUT = "join_timeout"
    SESSION_TIMEOUT = "session_timeout"
    DRAIN_TIMEOUT = "drain_timeout"
    CLOSE_TIMEOUT = "close_timeout"
    RESUME_TIMEOUT = "resume_timeout"
    RECOVERY_TIMEOUT = "recovery_timeout"
    ELECTION_TIMEOUT = "election_timeout"

    # Error/recovery events
    WORKER_DISCONNECTED = "worker_disconnected"
    ALL_WORKERS_DISCONNECTED = "all_workers_disconnected"
    WORKER_RECONNECTED = "worker_reconnected"
    LEADER_CRASH = "leader_crash"
    LEADER_ELECTED = "leader_elected"
    ORIGINAL_LEADER_RECOVERED = "original_leader_recovered"
    NETWORK_PARTITION = "network_partition"
    PARTITION_HEALED = "partition_healed"
    RECOVERY_COMPLETE = "recovery_complete"
    RECOVERY_FAILED = "recovery_failed"
    FATAL_ERROR = "fatal_error"

    # Task events
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"

    # Heartbeat events
    HEARTBEAT = "heartbeat"
    HEARTBEAT_TIMEOUT = "heartbeat_timeout"


# =============================================================================
# State Transition Matrix
# =============================================================================

# Define valid transitions: {current_state: {event: next_state}}
TRANSITIONS: Dict[SessionState, Dict[SessionEvent, SessionState]] = {
    SessionState.INITIALIZING: {
        SessionEvent.LEADER_READY: SessionState.WAITING_FOR_WORKERS,
        SessionEvent.INIT_TIMEOUT: SessionState.FAILED,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
    },

    SessionState.WAITING_FOR_WORKERS: {
        SessionEvent.ALL_WORKERS_JOINED: SessionState.ACTIVE,
        SessionEvent.FORCE_START: SessionState.ACTIVE,
        SessionEvent.JOIN_TIMEOUT: SessionState.DEGRADED,
        SessionEvent.LEADER_CRASH: SessionState.LEADER_ELECTION,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
    },

    SessionState.ACTIVE: {
        SessionEvent.CLOSE_REQUEST: SessionState.CLOSING,
        SessionEvent.SESSION_TIMEOUT: SessionState.CLOSING,
        SessionEvent.ALL_WORKERS_DISCONNECTED: SessionState.SUSPENDED,
        SessionEvent.LEADER_CRASH: SessionState.LEADER_ELECTION,
        SessionEvent.NETWORK_PARTITION: SessionState.PARTITIONED,
        SessionEvent.WORKER_DISCONNECTED: SessionState.DEGRADED,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
        # Internal transitions (stay in ACTIVE)
        SessionEvent.TASK_ASSIGNED: SessionState.ACTIVE,
        SessionEvent.TASK_COMPLETED: SessionState.ACTIVE,
        SessionEvent.TASK_FAILED: SessionState.ACTIVE,
        SessionEvent.HEARTBEAT: SessionState.ACTIVE,
        SessionEvent.WORKER_JOINED: SessionState.ACTIVE,
    },

    SessionState.DEGRADED: {
        SessionEvent.WORKER_JOINED: SessionState.ACTIVE,
        SessionEvent.ALL_WORKERS_JOINED: SessionState.ACTIVE,
        SessionEvent.CLOSE_REQUEST: SessionState.CLOSING,
        SessionEvent.SESSION_TIMEOUT: SessionState.CLOSING,
        SessionEvent.ALL_WORKERS_DISCONNECTED: SessionState.SUSPENDED,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
    },

    SessionState.SUSPENDED: {
        SessionEvent.WORKER_RECONNECTED: SessionState.RECOVERING,
        SessionEvent.RESUME_TIMEOUT: SessionState.CLOSING,
        SessionEvent.CLOSE_REQUEST: SessionState.CLOSED,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
    },

    SessionState.RECOVERING: {
        SessionEvent.RECOVERY_COMPLETE: SessionState.ACTIVE,
        SessionEvent.RECOVERY_FAILED: SessionState.FAILED,
        SessionEvent.RECOVERY_TIMEOUT: SessionState.FAILED,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
    },

    SessionState.LEADER_ELECTION: {
        SessionEvent.LEADER_ELECTED: SessionState.RECOVERING,
        SessionEvent.ORIGINAL_LEADER_RECOVERED: SessionState.ACTIVE,
        SessionEvent.ELECTION_TIMEOUT: SessionState.FAILED,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
    },

    SessionState.PARTITIONED: {
        SessionEvent.PARTITION_HEALED: SessionState.RECOVERING,
        SessionEvent.CLOSE_REQUEST: SessionState.CLOSED,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
    },

    SessionState.CLOSING: {
        SessionEvent.ALL_TASKS_COMPLETE: SessionState.CLOSED,
        SessionEvent.DRAIN_TIMEOUT: SessionState.CLOSED,
        SessionEvent.CLOSE_TIMEOUT: SessionState.CLOSED,
        SessionEvent.FATAL_ERROR: SessionState.FAILED,
    },

    # Terminal states - no transitions
    SessionState.CLOSED: {},
    SessionState.FAILED: {},
}


# =============================================================================
# Timeout Configuration
# =============================================================================

@dataclass
class TimeoutConfig:
    """Configuration for session timeouts"""

    init_timeout: float = 30.0           # INITIALIZING timeout
    join_timeout: float = 60.0           # WAITING_FOR_WORKERS timeout
    heartbeat_interval: float = 5.0      # Heartbeat send interval
    heartbeat_timeout: float = 15.0      # Per-agent heartbeat timeout
    session_timeout: float = 3600.0      # Max session duration (1 hour)
    drain_timeout: float = 30.0          # Wait for tasks in CLOSING
    close_timeout: float = 60.0          # Force close timeout
    resume_timeout: float = 300.0        # SUSPENDED timeout (5 min)
    recovery_timeout: float = 30.0       # RECOVERING timeout
    election_timeout: float = 15.0       # LEADER_ELECTION timeout
    partition_timeout: float = 120.0     # PARTITIONED timeout (2 min)


@dataclass
class SessionConfig:
    """Configuration for a session"""

    session_id: str
    session_name: str
    session_type: str = "general"

    # Worker configuration
    expected_worker_count: int = 2
    min_worker_count: int = 1
    max_worker_count: int = 10

    # Behavior flags
    allow_late_join: bool = True
    auto_close_on_complete: bool = True
    enable_brainstorm: bool = True
    enable_leader_election: bool = True
    enable_history_replay: bool = True

    # Timeouts
    timeouts: TimeoutConfig = field(default_factory=TimeoutConfig)

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


# =============================================================================
# State Transition Record
# =============================================================================

@dataclass
class StateTransition:
    """Record of a state transition"""

    from_state: SessionState
    to_state: SessionState
    event: SessionEvent
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    actor_agent_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "from_state": self.from_state.value,
            "to_state": self.to_state.value,
            "event": self.event.value,
            "timestamp": self.timestamp,
            "actor_agent_id": self.actor_agent_id,
            "metadata": self.metadata,
        }


# =============================================================================
# State Machine
# =============================================================================

class SessionStateMachine:
    """
    State machine for session lifecycle management.

    Handles state transitions, validates events, and maintains history.
    """

    def __init__(self, session_id: str, initial_state: SessionState = SessionState.INITIALIZING):
        self.session_id = session_id
        self._state = initial_state
        self._sub_state: Optional[SubState] = None
        self._history: List[StateTransition] = []
        self._callbacks: Dict[SessionState, List[Callable]] = {}
        self._on_transition_callbacks: List[Callable] = []

        # Record initial state
        self._history.append(StateTransition(
            from_state=initial_state,
            to_state=initial_state,
            event=SessionEvent.CREATE_SESSION,
            metadata={"initial": True}
        ))

    @property
    def state(self) -> SessionState:
        """Current state"""
        return self._state

    @property
    def sub_state(self) -> Optional[SubState]:
        """Current sub-state (when in ACTIVE)"""
        return self._sub_state

    @property
    def history(self) -> List[StateTransition]:
        """State transition history"""
        return self._history.copy()

    @property
    def is_terminal(self) -> bool:
        """Check if in terminal state"""
        return self._state in (SessionState.CLOSED, SessionState.FAILED)

    @property
    def is_active(self) -> bool:
        """Check if session is active (can process tasks)"""
        return self._state in (SessionState.ACTIVE, SessionState.DEGRADED)

    def can_transition(self, event: SessionEvent) -> bool:
        """Check if transition is valid for current state"""
        if self.is_terminal:
            return False

        valid_events = TRANSITIONS.get(self._state, {})
        return event in valid_events

    def get_valid_events(self) -> List[SessionEvent]:
        """Get list of valid events for current state"""
        if self.is_terminal:
            return []
        return list(TRANSITIONS.get(self._state, {}).keys())

    def transition(
        self,
        event: SessionEvent,
        actor_agent_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[SessionState]:
        """
        Attempt state transition.

        Args:
            event: The triggering event
            actor_agent_id: Agent that triggered the event
            metadata: Additional context

        Returns:
            New state if transition successful, None otherwise
        """
        if not self.can_transition(event):
            logger.warning(
                f"Invalid transition: {self._state.value} + {event.value} "
                f"(session: {self.session_id})"
            )
            return None

        old_state = self._state
        new_state = TRANSITIONS[self._state][event]

        # Record transition
        transition = StateTransition(
            from_state=old_state,
            to_state=new_state,
            event=event,
            actor_agent_id=actor_agent_id,
            metadata=metadata or {}
        )
        self._history.append(transition)

        # Update state
        self._state = new_state

        # Clear sub-state if leaving ACTIVE
        if old_state == SessionState.ACTIVE and new_state != SessionState.ACTIVE:
            self._sub_state = None

        logger.info(
            f"Session {self.session_id}: {old_state.value} -> {new_state.value} "
            f"(event: {event.value})"
        )

        # Execute callbacks
        self._execute_callbacks(old_state, new_state, event)

        return new_state

    def set_sub_state(self, sub_state: SubState) -> bool:
        """Set sub-state (only valid when in ACTIVE)"""
        if self._state != SessionState.ACTIVE:
            logger.warning(f"Cannot set sub-state when not ACTIVE (current: {self._state.value})")
            return False

        old_sub = self._sub_state
        self._sub_state = sub_state
        logger.info(f"Session {self.session_id}: sub-state {old_sub} -> {sub_state.value}")
        return True

    def on_state(self, state: SessionState, callback: Callable) -> None:
        """Register callback for entering a specific state"""
        if state not in self._callbacks:
            self._callbacks[state] = []
        self._callbacks[state].append(callback)

    def on_transition(self, callback: Callable) -> None:
        """Register callback for any transition"""
        self._on_transition_callbacks.append(callback)

    def _execute_callbacks(
        self,
        old_state: SessionState,
        new_state: SessionState,
        event: SessionEvent
    ) -> None:
        """Execute registered callbacks"""
        # State-specific callbacks
        for callback in self._callbacks.get(new_state, []):
            try:
                callback(self, old_state, event)
            except Exception as e:
                logger.error(f"Callback error: {e}")

        # General transition callbacks
        for callback in self._on_transition_callbacks:
            try:
                callback(self, old_state, new_state, event)
            except Exception as e:
                logger.error(f"Transition callback error: {e}")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize state machine to dict"""
        return {
            "session_id": self.session_id,
            "state": self._state.value,
            "sub_state": self._sub_state.value if self._sub_state else None,
            "is_terminal": self.is_terminal,
            "is_active": self.is_active,
            "history_count": len(self._history),
            "last_transition": self._history[-1].to_dict() if self._history else None,
        }


# =============================================================================
# Helper Functions
# =============================================================================

def get_timeout_for_state(state: SessionState, config: TimeoutConfig) -> Optional[float]:
    """Get the timeout duration for a given state"""
    timeout_map = {
        SessionState.INITIALIZING: config.init_timeout,
        SessionState.WAITING_FOR_WORKERS: config.join_timeout,
        SessionState.ACTIVE: config.session_timeout,
        SessionState.CLOSING: config.drain_timeout,
        SessionState.SUSPENDED: config.resume_timeout,
        SessionState.RECOVERING: config.recovery_timeout,
        SessionState.LEADER_ELECTION: config.election_timeout,
        SessionState.PARTITIONED: config.partition_timeout,
    }
    return timeout_map.get(state)


def get_timeout_event_for_state(state: SessionState) -> Optional[SessionEvent]:
    """Get the timeout event for a given state"""
    event_map = {
        SessionState.INITIALIZING: SessionEvent.INIT_TIMEOUT,
        SessionState.WAITING_FOR_WORKERS: SessionEvent.JOIN_TIMEOUT,
        SessionState.ACTIVE: SessionEvent.SESSION_TIMEOUT,
        SessionState.CLOSING: SessionEvent.DRAIN_TIMEOUT,
        SessionState.SUSPENDED: SessionEvent.RESUME_TIMEOUT,
        SessionState.RECOVERING: SessionEvent.RECOVERY_TIMEOUT,
        SessionState.LEADER_ELECTION: SessionEvent.ELECTION_TIMEOUT,
    }
    return event_map.get(state)


def is_error_state(state: SessionState) -> bool:
    """Check if state is an error/recovery state"""
    return state in (
        SessionState.SUSPENDED,
        SessionState.RECOVERING,
        SessionState.LEADER_ELECTION,
        SessionState.PARTITIONED,
        SessionState.DEGRADED,
        SessionState.FAILED,
    )


def get_state_description(state: SessionState) -> str:
    """Get human-readable state description"""
    descriptions = {
        SessionState.INITIALIZING: "Session is being created",
        SessionState.WAITING_FOR_WORKERS: "Waiting for workers to join",
        SessionState.ACTIVE: "Session is active and processing",
        SessionState.CLOSING: "Session is closing, draining tasks",
        SessionState.CLOSED: "Session has ended successfully",
        SessionState.SUSPENDED: "Session suspended, waiting for reconnection",
        SessionState.RECOVERING: "Session is recovering from error",
        SessionState.LEADER_ELECTION: "Electing new leader",
        SessionState.PARTITIONED: "Network partition detected",
        SessionState.DEGRADED: "Running with fewer workers than expected",
        SessionState.FAILED: "Session failed due to error",
    }
    return descriptions.get(state, "Unknown state")
