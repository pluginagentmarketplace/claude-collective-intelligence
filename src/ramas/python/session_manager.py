#!/usr/bin/env python3
"""
Session Manager for Pattern C

Core class that manages session lifecycle, RabbitMQ communication,
participant tracking, and message routing.

Features:
    - Session creation and lifecycle management
    - Participant join/leave with history replay
    - Message broadcasting and direct messaging
    - Meeting support with voting
    - Error recovery and state synchronization

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Set
from uuid import uuid4

import aio_pika
from aio_pika import ExchangeType, Message, DeliveryMode
from aio_pika.abc import AbstractChannel, AbstractConnection, AbstractExchange, AbstractQueue

from .session_state import (
    SessionState,
    SessionEvent,
    SubState,
    ParticipantStatus,
    SessionStateMachine,
    SessionConfig,
    TimeoutConfig,
    get_timeout_for_state,
    get_timeout_event_for_state,
    is_error_state,
)
from .session_messages import (
    SessionMessage,
    MessageType,
    PresenceAction,
    ControlAction,
    TaskStatus,
    MeetingStatus,
    ChatMessage,
    PresenceMessage,
    ControlMessage,
    TaskMessage,
    ResultMessage,
    MeetingMessage,
    VoteMessage,
    SessionMessageFactory,
    is_broadcast,
)

logger = logging.getLogger(__name__)

# =============================================================================
# Constants
# =============================================================================

RABBITMQ_URL = "amqp://admin:rabbitmq123@localhost:5672"

# Exchange names
EXCHANGE_SESSIONS = "agent.sessions"
EXCHANGE_HISTORY = "agent.sessions.history"

# Queue TTLs (in milliseconds)
QUEUE_TTL_HISTORY = 86400000  # 24 hours
QUEUE_TTL_INBOX = 3600000     # 1 hour
QUEUE_TTL_CONTROL = 3600000   # 1 hour


# =============================================================================
# Participant
# =============================================================================

@dataclass
class Participant:
    """Represents a session participant"""

    agent_id: str
    agent_role: str  # team-leader, worker, collaborator, monitor
    status: ParticipantStatus = ParticipantStatus.JOINING
    capabilities: List[str] = field(default_factory=list)

    joined_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    last_heartbeat: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    disconnect_count: int = 0

    current_task: Optional[str] = None
    tasks_completed: int = 0
    tasks_failed: int = 0

    inbox_queue: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "agent_role": self.agent_role,
            "status": self.status.value,
            "capabilities": self.capabilities,
            "joined_at": self.joined_at,
            "last_heartbeat": self.last_heartbeat,
            "disconnect_count": self.disconnect_count,
            "current_task": self.current_task,
            "tasks_completed": self.tasks_completed,
            "tasks_failed": self.tasks_failed,
        }

    def update_heartbeat(self) -> None:
        self.last_heartbeat = datetime.utcnow().isoformat()


# =============================================================================
# Session Task
# =============================================================================

@dataclass
class SessionTask:
    """Represents a task within a session"""

    task_id: str
    title: str
    description: str
    task_type: str = "general"
    priority: str = "normal"
    status: TaskStatus = TaskStatus.PENDING

    assigned_to: Optional[str] = None
    assigned_by: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    dependencies: List[str] = field(default_factory=list)
    acceptance_criteria: List[str] = field(default_factory=list)
    result: Optional[Any] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "title": self.title,
            "description": self.description,
            "task_type": self.task_type,
            "priority": self.priority,
            "status": self.status.value,
            "assigned_to": self.assigned_to,
            "assigned_by": self.assigned_by,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "dependencies": self.dependencies,
        }


# =============================================================================
# Meeting
# =============================================================================

@dataclass
class Meeting:
    """Represents a meeting within a session"""

    meeting_id: str
    title: str
    meeting_type: str = "general"
    status: MeetingStatus = MeetingStatus.SCHEDULED

    started_at: Optional[str] = None
    concluded_at: Optional[str] = None

    agenda: List[Dict[str, Any]] = field(default_factory=list)
    participants: Set[str] = field(default_factory=set)
    decisions: List[Dict[str, Any]] = field(default_factory=list)
    votes: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)  # proposal_id -> votes

    def to_dict(self) -> Dict[str, Any]:
        return {
            "meeting_id": self.meeting_id,
            "title": self.title,
            "meeting_type": self.meeting_type,
            "status": self.status.value,
            "started_at": self.started_at,
            "concluded_at": self.concluded_at,
            "agenda": self.agenda,
            "participants": list(self.participants),
            "decisions": self.decisions,
        }


# =============================================================================
# Session Manager
# =============================================================================

class SessionManager:
    """
    Core session management class.

    Manages the complete session lifecycle including:
    - RabbitMQ connection and messaging
    - Participant tracking and heartbeats
    - Task coordination
    - Meeting support
    - History replay for late joiners
    """

    def __init__(self, amqp_url: str = RABBITMQ_URL):
        self.amqp_url = amqp_url

        # RabbitMQ resources
        self.connection: Optional[AbstractConnection] = None
        self.channel: Optional[AbstractChannel] = None
        self.session_exchange: Optional[AbstractExchange] = None
        self.history_exchange: Optional[AbstractExchange] = None

        # Active sessions
        self.sessions: Dict[str, "Session"] = {}

        # Global message handlers
        self.global_handlers: List[Callable] = []

    async def connect(self) -> None:
        """Establish connection to RabbitMQ"""
        self.connection = await aio_pika.connect_robust(self.amqp_url)
        self.channel = await self.connection.channel()
        await self.channel.set_qos(prefetch_count=100)

        # Declare main exchanges
        self.session_exchange = await self.channel.declare_exchange(
            EXCHANGE_SESSIONS,
            ExchangeType.TOPIC,
            durable=True,
        )

        self.history_exchange = await self.channel.declare_exchange(
            EXCHANGE_HISTORY,
            ExchangeType.HEADERS,
            durable=True,
        )

        logger.info("SessionManager connected to RabbitMQ")

    async def disconnect(self) -> None:
        """Disconnect from RabbitMQ"""
        if self.connection:
            await self.connection.close()
            logger.info("SessionManager disconnected")

    async def create_session(self, config: SessionConfig) -> "Session":
        """Create a new session"""
        session = Session(
            config=config,
            manager=self,
            channel=self.channel,
            session_exchange=self.session_exchange,
        )

        await session.initialize()
        self.sessions[config.session_id] = session

        logger.info(f"Session created: {config.session_id}")
        return session

    async def get_session(self, session_id: str) -> Optional["Session"]:
        """Get an existing session"""
        return self.sessions.get(session_id)

    async def close_session(self, session_id: str, reason: str = "closed") -> bool:
        """Close a session"""
        session = self.sessions.get(session_id)
        if not session:
            return False

        await session.close(reason)
        del self.sessions[session_id]
        return True

    def list_sessions(self) -> List[Dict[str, Any]]:
        """List all active sessions"""
        return [
            {
                "session_id": s.session_id,
                "name": s.config.session_name,
                "state": s.state_machine.state.value,
                "participants": len(s.participants),
            }
            for s in self.sessions.values()
        ]


# =============================================================================
# Session Class
# =============================================================================

class Session:
    """
    Represents a single session.

    Manages state, participants, tasks, and messaging for one session.
    """

    def __init__(
        self,
        config: SessionConfig,
        manager: SessionManager,
        channel: AbstractChannel,
        session_exchange: AbstractExchange,
    ):
        self.config = config
        self.manager = manager
        self.channel = channel
        self.session_exchange = session_exchange

        # Session identity
        self.session_id = config.session_id

        # State machine
        self.state_machine = SessionStateMachine(config.session_id)

        # Participants
        self.participants: Dict[str, Participant] = {}
        self.leader_id: Optional[str] = None

        # Tasks
        self.tasks: Dict[str, SessionTask] = {}

        # Meetings
        self.meetings: Dict[str, Meeting] = {}
        self.current_meeting: Optional[str] = None

        # Message history (in-memory, for quick replay)
        self.message_history: List[SessionMessage] = []
        self.max_history_size: int = 1000

        # RabbitMQ queues
        self.broadcast_exchange: Optional[AbstractExchange] = None
        self.history_queue: Optional[AbstractQueue] = None
        self.control_queue: Optional[AbstractQueue] = None
        self.results_queue: Optional[AbstractQueue] = None

        # Timeout tasks
        self.timeout_tasks: Dict[str, asyncio.Task] = {}

        # Message handlers
        self.message_handlers: Dict[MessageType, List[Callable]] = {}

        # Metrics
        self.created_at = datetime.utcnow().isoformat()
        self.message_count = 0

    # -------------------------------------------------------------------------
    # Initialization
    # -------------------------------------------------------------------------

    async def initialize(self) -> None:
        """Initialize session infrastructure"""
        logger.info(f"Initializing session: {self.session_id}")

        # Create session-specific broadcast exchange
        self.broadcast_exchange = await self.channel.declare_exchange(
            f"agent.sessions.{self.session_id}.broadcast",
            ExchangeType.FANOUT,
            durable=True,
            auto_delete=True,
        )

        # Create history stream queue
        self.history_queue = await self.channel.declare_queue(
            f"agent.sessions.{self.session_id}.history",
            durable=True,
            arguments={
                "x-queue-type": "stream",
                "x-max-age": "24h",
                "x-max-length-bytes": 104857600,  # 100MB
            },
        )

        # Bind history to capture all messages
        await self.history_queue.bind(
            self.session_exchange,
            routing_key=f"session.{self.session_id}.#",
        )

        # Create control queue
        self.control_queue = await self.channel.declare_queue(
            f"agent.sessions.{self.session_id}.control",
            durable=True,
            arguments={
                "x-queue-type": "quorum",
                "x-message-ttl": QUEUE_TTL_CONTROL,
            },
        )

        await self.control_queue.bind(
            self.session_exchange,
            routing_key=f"session.{self.session_id}.control.#",
        )

        # Create results queue
        self.results_queue = await self.channel.declare_queue(
            f"agent.sessions.{self.session_id}.results",
            durable=True,
            arguments={
                "x-queue-type": "quorum",
                "x-message-ttl": QUEUE_TTL_INBOX,
            },
        )

        await self.results_queue.bind(
            self.session_exchange,
            routing_key=f"session.{self.session_id}.result.#",
        )

        # Start control queue listener
        await self.control_queue.consume(self._handle_control_message)

        # Start timeout for initialization
        await self._start_state_timeout()

        logger.info(f"Session initialized: {self.session_id}")

    # -------------------------------------------------------------------------
    # Participant Management
    # -------------------------------------------------------------------------

    async def join(
        self,
        agent_id: str,
        agent_role: str = "worker",
        capabilities: Optional[List[str]] = None,
        replay_history: bool = True,
    ) -> Dict[str, Any]:
        """
        Join an agent to this session.

        Args:
            agent_id: Unique agent identifier
            agent_role: Role (team-leader, worker, collaborator, monitor)
            capabilities: Agent capabilities
            replay_history: Whether to replay message history

        Returns:
            Join result with session info
        """
        # Check if session accepts joins
        if self.state_machine.state == SessionState.CLOSED:
            return {"success": False, "error": "Session is closed"}

        if self.state_machine.state == SessionState.ACTIVE and not self.config.allow_late_join:
            return {"success": False, "error": "Session does not allow late joins"}

        # Check capacity
        if len(self.participants) >= self.config.max_worker_count:
            return {"success": False, "error": "Session is full"}

        # Create participant
        participant = Participant(
            agent_id=agent_id,
            agent_role=agent_role,
            capabilities=capabilities or [],
            status=ParticipantStatus.ACTIVE,
        )

        # Create inbox queue for this agent
        inbox_queue = await self.channel.declare_queue(
            f"agent.sessions.{self.session_id}.inbox.{agent_id}",
            durable=True,
            arguments={
                "x-queue-type": "quorum",
                "x-message-ttl": QUEUE_TTL_INBOX,
            },
        )

        # Bind to direct messages
        await inbox_queue.bind(
            self.session_exchange,
            routing_key=f"session.{self.session_id}.*.{agent_id}",
        )

        # Bind to broadcast
        await inbox_queue.bind(self.broadcast_exchange)

        participant.inbox_queue = inbox_queue.name
        self.participants[agent_id] = participant

        # Track leader
        if agent_role == "team-leader":
            self.leader_id = agent_id

            # Leader ready - transition state
            if self.state_machine.state == SessionState.INITIALIZING:
                self.state_machine.transition(
                    SessionEvent.LEADER_READY,
                    actor_agent_id=agent_id,
                )
                await self._start_state_timeout()

        # Broadcast join announcement
        await self.broadcast(
            SessionMessageFactory.presence(
                session_id=self.session_id,
                sender_id=agent_id,
                action=PresenceAction.JOIN,
                agent_role=agent_role,
                capabilities=capabilities,
            )
        )

        # Check if all workers joined
        await self._check_workers_joined()

        # Replay history if requested
        replayed_count = 0
        if replay_history and self.config.enable_history_replay:
            replayed_count = await self._replay_history_to_agent(agent_id)

        logger.info(f"Agent {agent_id} joined session {self.session_id}")

        return {
            "success": True,
            "session_id": self.session_id,
            "session_name": self.config.session_name,
            "agent_id": agent_id,
            "agent_role": agent_role,
            "inbox_queue": inbox_queue.name,
            "replayed_messages": replayed_count,
            "participants": [p.to_dict() for p in self.participants.values()],
            "state": self.state_machine.state.value,
        }

    async def leave(
        self,
        agent_id: str,
        reason: str = "left",
    ) -> Dict[str, Any]:
        """Remove an agent from the session"""
        if agent_id not in self.participants:
            return {"success": False, "error": "Agent not in session"}

        participant = self.participants[agent_id]
        participant.status = ParticipantStatus.LEFT

        # Broadcast leave announcement
        await self.broadcast(
            SessionMessageFactory.presence(
                session_id=self.session_id,
                sender_id=agent_id,
                action=PresenceAction.LEAVE,
            )
        )

        # Reassign tasks
        orphaned_tasks = [t for t in self.tasks.values() if t.assigned_to == agent_id]
        for task in orphaned_tasks:
            task.status = TaskStatus.PENDING
            task.assigned_to = None

        # Delete inbox queue
        # Note: Quorum queues don't support if_unused flag, so we use force delete
        try:
            queue = await self.channel.declare_queue(
                f"agent.sessions.{self.session_id}.inbox.{agent_id}",
                passive=True,
            )
            await queue.delete(if_unused=False, if_empty=False)
        except Exception:
            pass

        del self.participants[agent_id]

        # Check if session should transition
        await self._check_participants_state()

        logger.info(f"Agent {agent_id} left session {self.session_id}")

        return {
            "success": True,
            "tasks_reassigned": len(orphaned_tasks),
            "remaining_participants": len(self.participants),
        }

    async def _check_workers_joined(self) -> None:
        """Check if enough workers have joined"""
        worker_count = sum(
            1 for p in self.participants.values()
            if p.agent_role == "worker" and p.status == ParticipantStatus.ACTIVE
        )

        if self.state_machine.state == SessionState.WAITING_FOR_WORKERS:
            if worker_count >= self.config.expected_worker_count:
                self.state_machine.transition(SessionEvent.ALL_WORKERS_JOINED)
                await self._cancel_state_timeout()
                await self._broadcast_session_active()

    async def _check_participants_state(self) -> None:
        """Check participant state for potential session transitions"""
        active_count = sum(
            1 for p in self.participants.values()
            if p.status == ParticipantStatus.ACTIVE
        )

        if active_count == 0 and self.state_machine.is_active:
            self.state_machine.transition(SessionEvent.ALL_WORKERS_DISCONNECTED)

    # -------------------------------------------------------------------------
    # Messaging
    # -------------------------------------------------------------------------

    async def broadcast(self, message: SessionMessage) -> str:
        """Broadcast a message to all session participants"""
        message.target_agent = None  # Ensure broadcast

        await self._publish_message(message)
        self._record_history(message)

        return message.message_id

    async def send_direct(
        self,
        message: SessionMessage,
        target_agent: str,
    ) -> str:
        """Send a direct message to a specific agent"""
        message.target_agent = target_agent

        await self._publish_message(message)
        self._record_history(message)

        return message.message_id

    async def _publish_message(self, message: SessionMessage) -> None:
        """Publish message to RabbitMQ"""
        routing_key = message.to_routing_key()

        rmq_message = Message(
            body=message.to_json().encode(),
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
            headers=message.to_headers(),
            message_id=message.message_id,
            timestamp=datetime.utcnow(),
            expiration=message.ttl,  # aio_pika expects int (seconds), converts to ms internally
            priority=message.priority,
        )

        await self.session_exchange.publish(
            rmq_message,
            routing_key=routing_key,
        )

        self.message_count += 1

    def _record_history(self, message: SessionMessage) -> None:
        """Record message in history"""
        self.message_history.append(message)

        # Trim if too large
        if len(self.message_history) > self.max_history_size:
            self.message_history = self.message_history[-self.max_history_size:]

    async def _replay_history_to_agent(self, agent_id: str) -> int:
        """Replay message history to a late-joining agent"""
        count = 0

        for msg in self.message_history:
            # Mark as replay
            replay_msg = SessionMessage.from_dict(msg.to_dict())
            replay_msg.is_replay = True
            replay_msg.original_timestamp = msg.timestamp
            replay_msg.target_agent = agent_id

            await self.send_direct(replay_msg, agent_id)
            count += 1

        return count

    async def _broadcast_session_active(self) -> None:
        """Broadcast that session is now active"""
        await self.broadcast(
            SessionMessageFactory.control(
                session_id=self.session_id,
                sender_id="system",
                action=ControlAction.SESSION_START,
                data={
                    "participants": [p.to_dict() for p in self.participants.values()],
                    "config": {
                        "session_name": self.config.session_name,
                        "session_type": self.config.session_type,
                    },
                },
            )
        )

    async def _handle_control_message(self, message: aio_pika.IncomingMessage) -> None:
        """Handle incoming control messages"""
        async with message.process():
            try:
                msg = SessionMessage.from_json(message.body.decode())
                logger.debug(f"Control message: {msg.payload}")

                # Handle based on action
                action = msg.payload.get("action")

                if action == ControlAction.STATE_SYNC.value:
                    await self._handle_state_sync(msg)
                elif action == ControlAction.CHECKPOINT.value:
                    await self._handle_checkpoint(msg)

            except Exception as e:
                logger.error(f"Error handling control message: {e}")

    async def _handle_state_sync(self, msg: SessionMessage) -> None:
        """Handle state sync request"""
        # Send current state to requesting agent
        state_data = self.get_status()
        await self.send_direct(
            SessionMessageFactory.control(
                session_id=self.session_id,
                sender_id="system",
                action=ControlAction.STATE_SYNC,
                data=state_data,
            ),
            target_agent=msg.sender_id,
        )

    async def _handle_checkpoint(self, msg: SessionMessage) -> None:
        """Handle checkpoint request"""
        checkpoint = {
            "checkpoint_id": str(uuid4()),
            "session_id": self.session_id,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": msg.sender_id,
            "state": self.get_status(),
        }

        # Broadcast checkpoint created
        await self.broadcast(
            SessionMessageFactory.control(
                session_id=self.session_id,
                sender_id="system",
                action=ControlAction.CHECKPOINT,
                data=checkpoint,
            )
        )

    # -------------------------------------------------------------------------
    # Task Management
    # -------------------------------------------------------------------------

    async def assign_task(
        self,
        title: str,
        description: str,
        assigned_to: Optional[str] = None,
        assigned_by: Optional[str] = None,
        task_type: str = "general",
        priority: str = "normal",
        dependencies: Optional[List[str]] = None,
    ) -> SessionTask:
        """Create and assign a task"""
        task = SessionTask(
            task_id=str(uuid4()),
            title=title,
            description=description,
            task_type=task_type,
            priority=priority,
            status=TaskStatus.ASSIGNED if assigned_to else TaskStatus.PENDING,
            assigned_to=assigned_to,
            assigned_by=assigned_by or self.leader_id or "system",
            dependencies=dependencies or [],
        )

        self.tasks[task.task_id] = task

        # Update participant
        if assigned_to and assigned_to in self.participants:
            self.participants[assigned_to].current_task = task.task_id

        # Broadcast task assignment
        if assigned_to:
            await self.send_direct(
                SessionMessageFactory.task(
                    session_id=self.session_id,
                    sender_id=task.assigned_by,
                    target_agent=assigned_to,
                    title=title,
                    description=description,
                    task_type=task_type,
                    priority=priority,
                    dependencies=dependencies,
                ),
                target_agent=assigned_to,
            )

        # Update state machine
        self.state_machine.transition(SessionEvent.TASK_ASSIGNED)
        self.state_machine.set_sub_state(SubState.PROCESSING)

        return task

    async def complete_task(
        self,
        task_id: str,
        result: Any,
        success: bool = True,
        error: Optional[str] = None,
    ) -> bool:
        """Mark a task as completed"""
        if task_id not in self.tasks:
            return False

        task = self.tasks[task_id]
        task.status = TaskStatus.COMPLETED if success else TaskStatus.FAILED
        task.completed_at = datetime.utcnow().isoformat()
        task.result = result
        task.error = error

        # Update participant
        if task.assigned_to and task.assigned_to in self.participants:
            participant = self.participants[task.assigned_to]
            participant.current_task = None
            if success:
                participant.tasks_completed += 1
            else:
                participant.tasks_failed += 1

        # Send result to leader
        if self.leader_id:
            await self.send_direct(
                SessionMessageFactory.result(
                    session_id=self.session_id,
                    sender_id=task.assigned_to or "system",
                    target_agent=self.leader_id,
                    task_id=task_id,
                    success=success,
                    result=result,
                    error=error,
                ),
                target_agent=self.leader_id,
            )

        # Update state
        event = SessionEvent.TASK_COMPLETED if success else SessionEvent.TASK_FAILED
        self.state_machine.transition(event)

        # Check if all tasks complete
        await self._check_all_tasks_complete()

        return True

    async def _check_all_tasks_complete(self) -> None:
        """Check if all tasks are complete"""
        pending = sum(
            1 for t in self.tasks.values()
            if t.status in (TaskStatus.PENDING, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS)
        )

        if pending == 0 and self.config.auto_close_on_complete and len(self.tasks) > 0:
            self.state_machine.transition(SessionEvent.ALL_TASKS_COMPLETE)

    # -------------------------------------------------------------------------
    # Meeting Support
    # -------------------------------------------------------------------------

    async def start_meeting(
        self,
        title: str,
        meeting_type: str = "general",
        agenda: Optional[List[Dict[str, Any]]] = None,
        started_by: Optional[str] = None,
    ) -> Meeting:
        """Start a meeting within the session"""
        meeting = Meeting(
            meeting_id=str(uuid4()),
            title=title,
            meeting_type=meeting_type,
            status=MeetingStatus.IN_PROGRESS,
            started_at=datetime.utcnow().isoformat(),
            agenda=agenda or [],
            participants=set(self.participants.keys()),
        )

        self.meetings[meeting.meeting_id] = meeting
        self.current_meeting = meeting.meeting_id

        # Update state
        self.state_machine.set_sub_state(SubState.MEETING)

        # Broadcast meeting start
        await self.broadcast(
            SessionMessageFactory.meeting_start(
                session_id=self.session_id,
                sender_id=started_by or self.leader_id or "system",
                title=title,
                meeting_type=meeting_type,
                agenda=agenda,
            )
        )

        return meeting

    async def vote(
        self,
        meeting_id: str,
        proposal_id: str,
        voter_id: str,
        vote: str,
        reasoning: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Cast a vote in a meeting"""
        if meeting_id not in self.meetings:
            return {"success": False, "error": "Meeting not found"}

        meeting = self.meetings[meeting_id]

        if proposal_id not in meeting.votes:
            meeting.votes[proposal_id] = []

        meeting.votes[proposal_id].append({
            "voter_id": voter_id,
            "vote": vote,
            "reasoning": reasoning,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Broadcast vote
        await self.broadcast(
            SessionMessageFactory.vote(
                session_id=self.session_id,
                sender_id=voter_id,
                proposal_id=proposal_id,
                vote=vote,
                reasoning=reasoning,
            )
        )

        return {
            "success": True,
            "votes_count": len(meeting.votes[proposal_id]),
        }

    async def conclude_meeting(
        self,
        meeting_id: str,
        summary: str,
        decisions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Conclude a meeting"""
        if meeting_id not in self.meetings:
            return {"success": False, "error": "Meeting not found"}

        meeting = self.meetings[meeting_id]
        meeting.status = MeetingStatus.CONCLUDED
        meeting.concluded_at = datetime.utcnow().isoformat()
        meeting.decisions = decisions or []

        if self.current_meeting == meeting_id:
            self.current_meeting = None
            self.state_machine.set_sub_state(SubState.IDLE)

        # Broadcast conclusion
        await self.broadcast(
            SessionMessageFactory.control(
                session_id=self.session_id,
                sender_id="system",
                action=ControlAction.SESSION_CLOSED,
                data={
                    "meeting_id": meeting_id,
                    "summary": summary,
                    "decisions": decisions,
                },
            )
        )

        return {
            "success": True,
            "meeting_id": meeting_id,
            "duration_minutes": self._calculate_duration(meeting.started_at, meeting.concluded_at),
        }

    def _calculate_duration(self, start: str, end: str) -> int:
        """Calculate duration in minutes"""
        try:
            start_dt = datetime.fromisoformat(start)
            end_dt = datetime.fromisoformat(end)
            return int((end_dt - start_dt).total_seconds() / 60)
        except Exception:
            return 0

    # -------------------------------------------------------------------------
    # Timeout Management
    # -------------------------------------------------------------------------

    async def _start_state_timeout(self) -> None:
        """Start timeout for current state"""
        state = self.state_machine.state
        timeout = get_timeout_for_state(state, self.config.timeouts)
        event = get_timeout_event_for_state(state)

        if timeout and event:
            await self._cancel_state_timeout()

            async def timeout_handler():
                await asyncio.sleep(timeout)
                self.state_machine.transition(event)

            self.timeout_tasks[state.value] = asyncio.create_task(timeout_handler())

    async def _cancel_state_timeout(self) -> None:
        """Cancel current state timeout"""
        for task in self.timeout_tasks.values():
            task.cancel()
        self.timeout_tasks.clear()

    # -------------------------------------------------------------------------
    # Session Lifecycle
    # -------------------------------------------------------------------------

    async def close(self, reason: str = "closed") -> None:
        """Close the session"""
        logger.info(f"Closing session {self.session_id}: {reason}")

        # Transition to closing
        self.state_machine.transition(SessionEvent.CLOSE_REQUEST)

        # Broadcast closing
        await self.broadcast(
            SessionMessageFactory.control(
                session_id=self.session_id,
                sender_id="system",
                action=ControlAction.SESSION_CLOSING,
                data={"reason": reason},
            )
        )

        # Wait for tasks to drain
        await asyncio.sleep(self.config.timeouts.drain_timeout)

        # Cleanup
        await self._cleanup()

        # Transition to closed
        self.state_machine.transition(SessionEvent.SESSION_CLOSED)

    async def _cleanup(self) -> None:
        """Cleanup session resources"""
        await self._cancel_state_timeout()

        # Delete queues
        # Note: Quorum queues don't support if_unused flag, so we use force delete
        for agent_id in list(self.participants.keys()):
            try:
                queue = await self.channel.declare_queue(
                    f"agent.sessions.{self.session_id}.inbox.{agent_id}",
                    passive=True,
                )
                await queue.delete(if_unused=False, if_empty=False)
            except Exception:
                pass

        # Delete control and results queues
        for queue_type in ["control", "results"]:
            try:
                queue = await self.channel.declare_queue(
                    f"agent.sessions.{self.session_id}.{queue_type}",
                    passive=True,
                )
                await queue.delete(if_unused=False, if_empty=False)
            except Exception:
                pass

        # Delete broadcast exchange
        try:
            await self.broadcast_exchange.delete()
        except Exception:
            pass

        logger.info(f"Session cleanup complete: {self.session_id}")

    # -------------------------------------------------------------------------
    # Status
    # -------------------------------------------------------------------------

    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive session status"""
        return {
            "session_id": self.session_id,
            "session_name": self.config.session_name,
            "session_type": self.config.session_type,
            "state": self.state_machine.state.value,
            "sub_state": self.state_machine.sub_state.value if self.state_machine.sub_state else None,
            "created_at": self.created_at,
            "participants": {
                "count": len(self.participants),
                "list": [p.to_dict() for p in self.participants.values()],
            },
            "tasks": {
                "total": len(self.tasks),
                "pending": sum(1 for t in self.tasks.values() if t.status == TaskStatus.PENDING),
                "in_progress": sum(1 for t in self.tasks.values() if t.status == TaskStatus.IN_PROGRESS),
                "completed": sum(1 for t in self.tasks.values() if t.status == TaskStatus.COMPLETED),
                "failed": sum(1 for t in self.tasks.values() if t.status == TaskStatus.FAILED),
            },
            "meetings": {
                "total": len(self.meetings),
                "current": self.current_meeting,
            },
            "metrics": {
                "message_count": self.message_count,
                "history_size": len(self.message_history),
            },
        }

    def to_dict(self) -> Dict[str, Any]:
        """Serialize session to dictionary"""
        return self.get_status()
