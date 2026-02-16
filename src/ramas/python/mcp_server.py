#!/usr/bin/env python3
"""
RAMAS MCP Server (Full Python)

Replaces: src/core/mcp-server.js (1093 lines)
Uses: Anthropic MCP Python SDK

This MCP server enables Claude Code instances to communicate
via RabbitMQ message broker.

Features:
- Agent registration (team-leader, worker, collaborator)
- Task distribution
- Brainstorming sessions
- Voting
- Status management (RAMAS green/red)
- Push notifications via iTerm2 Python API

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

import os
import sys
import json
import asyncio
import time
import logging
from datetime import datetime
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from uuid import uuid4

logger = logging.getLogger(__name__)

# MCP SDK
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("Error: MCP Python SDK not installed.")
    print("Install with: uv pip install mcp")
    sys.exit(1)

# aio-pika for RabbitMQ
try:
    import aio_pika
except ImportError:
    print("Error: aio-pika not installed.")
    print("Install with: uv pip install aio-pika")
    sys.exit(1)

# Import RAMAS modules
from . import controller
from . import registry
from . import exchanges

# Session-based architecture (Pattern C)
from .session_manager import SessionManager, Session
from .session_state import SessionConfig, SessionState, TimeoutConfig
from .session_messages import MessageType

# Pattern C Fix: File-based inbox for stateless MCP (PATTERN-C-001)
from .session_inbox import (
    SessionInbox,
    get_inbox_manager,
    register_for_session,
    get_session_messages as inbox_get_messages,
)

# Pattern C Fix: File-based session registry for multi-process (PATTERN-C-002)
from .session_registry import (
    SharedSessionRegistry,
    get_session_registry,
    SessionInfo,
)

# Pattern C-003 v3: Redis Registry for instant wake signals
from .redis_registry import (
    RedisRegistry,
    get_redis_registry,
)


# =============================================================================
# Configuration
# =============================================================================

RABBITMQ_URL = os.environ.get(
    "RABBITMQ_URL",
    "amqp://admin:rabbitmq123@localhost:5672"
)


# =============================================================================
# Global State
# =============================================================================

@dataclass
class AgentState:
    """Current agent state"""
    connection: Optional[aio_pika.abc.AbstractConnection] = None
    channel: Optional[aio_pika.abc.AbstractChannel] = None
    iterm_controller: Optional[controller.ITerm2Controller] = None

    # PATTERN-C-003: Use RAMAS_AGENT_ID env var if set, otherwise generate UUID
    # This enables autonomous triggering by matching window registry IDs
    agent_id: str = field(default_factory=lambda: os.environ.get("RAMAS_AGENT_ID", f"agent-{uuid4()}"))
    agent_name: Optional[str] = None
    agent_role: Optional[str] = None
    is_initialized: bool = False

    pending_tasks: List[Dict] = field(default_factory=list)
    received_messages: List[Dict] = field(default_factory=list)
    brainstorm_sessions: Dict[str, Dict] = field(default_factory=dict)
    vote_results: Dict[str, Dict] = field(default_factory=dict)

    # Pattern C: Session Manager
    session_manager: Optional[SessionManager] = None
    current_session_id: Optional[str] = None

    # Pattern C-003 v6.4: Global Broadcast Queue
    broadcast_queue: Optional[Any] = None  # aio_pika queue object


STATE = AgentState()


# =============================================================================
# Role Capabilities
# =============================================================================

ROLE_CAPABILITIES = {
    "team-leader": [
        "assign_tasks",
        "aggregate_results",
        "initiate_brainstorm",
        "create_votes",
    ],
    "worker": [
        "execute_tasks",
        "report_results",
        "participate_brainstorm",
        "cast_votes",
    ],
    "collaborator": [
        "propose_ideas",
        "participate_brainstorm",
        "cast_votes",
        "review_work",
    ],
    "monitor": [
        "view_status",
        "track_metrics",
        "generate_reports",
    ],
}


# =============================================================================
# MCP Server Setup
# =============================================================================

mcp_server = Server("ramas-python")


# =============================================================================
# Tool Definitions
# =============================================================================

@mcp_server.list_tools()
async def list_tools() -> List[Tool]:
    """List available MCP tools"""
    return [
        # === Connection & Registration ===
        Tool(
            name="register_agent",
            description="Register this Claude Code instance as an agent. Must be called first.",
            inputSchema={
                "type": "object",
                "properties": {
                    "role": {
                        "type": "string",
                        "enum": ["team-leader", "worker", "collaborator", "monitor"],
                        "description": "Agent role",
                    },
                    "name": {
                        "type": "string",
                        "description": "Optional custom name",
                    },
                },
                "required": ["role"],
            },
        ),
        Tool(
            name="get_connection_status",
            description="Check connection status and agent info",
            inputSchema={"type": "object", "properties": {}},
        ),

        # === Task Management ===
        Tool(
            name="send_task",
            description="Send a task to worker agents",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Task title"},
                    "description": {"type": "string", "description": "Task description"},
                    "priority": {
                        "type": "string",
                        "enum": ["critical", "high", "normal", "low"],
                    },
                    "context": {"type": "object", "description": "Additional context"},
                },
                "required": ["title", "description"],
            },
        ),
        Tool(
            name="get_pending_tasks",
            description="Get pending tasks assigned to this agent",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "number", "description": "Max tasks to return"},
                },
            },
        ),
        Tool(
            name="complete_task",
            description="Mark a task as completed",
            inputSchema={
                "type": "object",
                "properties": {
                    "taskId": {"type": "string"},
                    "result": {"type": "string"},
                    "status": {"type": "string", "enum": ["completed", "failed", "partial"]},
                },
                "required": ["taskId", "result"],
            },
        ),

        # === Brainstorming ===
        Tool(
            name="start_brainstorm",
            description="Start a brainstorming session",
            inputSchema={
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "question": {"type": "string"},
                    "duration": {"type": "number", "description": "Duration in minutes"},
                },
                "required": ["topic", "question"],
            },
        ),
        Tool(
            name="propose_idea",
            description="Propose an idea in a brainstorm session",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {"type": "string"},
                    "idea": {"type": "string"},
                    "reasoning": {"type": "string"},
                },
                "required": ["sessionId", "idea"],
            },
        ),
        Tool(
            name="get_brainstorm_ideas",
            description="Get ideas from a brainstorm session",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {"type": "string"},
                },
            },
        ),

        # === Voting ===
        Tool(
            name="create_vote",
            description="Create a voting session",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}},
                    "votingMethod": {
                        "type": "string",
                        "enum": ["simple_majority", "ranked_choice", "consensus"],
                    },
                },
                "required": ["question", "options"],
            },
        ),
        Tool(
            name="cast_vote",
            description="Cast a vote",
            inputSchema={
                "type": "object",
                "properties": {
                    "voteId": {"type": "string"},
                    "choice": {"type": "string"},
                    "confidence": {"type": "number"},
                },
                "required": ["voteId", "choice"],
            },
        ),

        # === Communication ===
        Tool(
            name="broadcast_message",
            description="Broadcast message to all agents",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": ["info", "warning", "question", "announcement"],
                    },
                },
                "required": ["message"],
            },
        ),
        Tool(
            name="get_messages",
            description="Get received messages",
            inputSchema={
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["all", "brainstorm", "result", "status"]},
                    "limit": {"type": "number"},
                    "since": {"type": "number"},
                },
            },
        ),

        # === Status & Monitoring ===
        Tool(
            name="get_system_status",
            description="Get overall system status",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="publish_status",
            description="Publish your status",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["available", "busy", "away", "do_not_disturb"],
                    },
                    "activity": {"type": "string"},
                },
                "required": ["status"],
            },
        ),

        # === RAMAS (Push Notifications) ===
        Tool(
            name="set_worker_status",
            description="Set worker availability (green/red). Updates terminal title.",
            inputSchema={
                "type": "object",
                "properties": {
                    "workerId": {"type": "string"},
                    "status": {"type": "string", "enum": ["green", "red"]},
                },
                "required": ["workerId", "status"],
            },
        ),

        # === Pattern 2: Task Coordination ===
        Tool(
            name="dispatch_subtask",
            description="[Team Leader] Dispatch a subtask to a specific worker via RabbitMQ. "
                        "The daemon will route the task to the worker's iTerm2 terminal.",
            inputSchema={
                "type": "object",
                "properties": {
                    "workerId": {
                        "type": "string",
                        "description": "Target worker ID (e.g., 'worker-001', 'worker-002')",
                    },
                    "taskType": {
                        "type": "string",
                        "description": "Task type (e.g., 'prime_numbers', 'fibonacci', 'analyze')",
                    },
                    "params": {
                        "type": "object",
                        "description": "Task parameters (e.g., {max_value: 1000})",
                    },
                    "taskId": {
                        "type": "string",
                        "description": "Optional custom task ID. Auto-generated if not provided.",
                    },
                },
                "required": ["workerId", "taskType", "params"],
            },
        ),
        Tool(
            name="collect_results",
            description="[Team Leader] Collect results from worker tasks. "
                        "Reads result files from /tmp/ directory.",
            inputSchema={
                "type": "object",
                "properties": {
                    "taskIds": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of task IDs to collect results for",
                    },
                    "timeout": {
                        "type": "number",
                        "description": "Max seconds to wait for results (default: 60)",
                    },
                },
                "required": ["taskIds"],
            },
        ),
        Tool(
            name="aggregate_results",
            description="[Team Leader] Aggregate collected results and compute intersection/union.",
            inputSchema={
                "type": "object",
                "properties": {
                    "results": {
                        "type": "object",
                        "description": "Results dict from collect_results",
                    },
                    "operation": {
                        "type": "string",
                        "enum": ["intersection", "union", "merge"],
                        "description": "Aggregation operation",
                    },
                },
                "required": ["results", "operation"],
            },
        ),
        Tool(
            name="interrupt_worker",
            description="Send interrupt message to worker terminal",
            inputSchema={
                "type": "object",
                "properties": {
                    "workerId": {"type": "string"},
                    "message": {"type": "string"},
                    "priority": {"type": "string", "enum": ["normal", "urgent"]},
                },
                "required": ["workerId", "message"],
            },
        ),
        Tool(
            name="get_worker_statuses",
            description="Get all worker statuses from registry",
            inputSchema={"type": "object", "properties": {}},
        ),

        # =====================================================================
        # PATTERN C: SESSION-BASED MULTI-AGENT TOOLS (17 tools)
        # =====================================================================

        # === Session Lifecycle (4 tools) ===
        Tool(
            name="create_session",
            description="[Team Leader] Create a new session for multi-agent collaboration. "
                        "Returns session_id for workers to join.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionName": {
                        "type": "string",
                        "description": "Human-readable session name (e.g., 'Sprint Planning Meeting')",
                    },
                    "sessionType": {
                        "type": "string",
                        "enum": ["general", "brainstorm", "meeting", "task-coordination"],
                        "description": "Type of session",
                    },
                    "expectedWorkers": {
                        "type": "number",
                        "description": "Number of workers expected to join (default: 2)",
                    },
                    "config": {
                        "type": "object",
                        "description": "Optional session configuration overrides",
                    },
                },
                "required": ["sessionName"],
            },
        ),
        Tool(
            name="join_session",
            description="[Worker/Collaborator] Join an existing session. "
                        "Receives role assignment and message history replay.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID to join",
                    },
                    "agentRole": {
                        "type": "string",
                        "enum": ["team-leader", "worker", "collaborator", "monitor"],
                        "description": "Role to take in the session",
                    },
                    "capabilities": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Agent capabilities (e.g., ['code-review', 'testing'])",
                    },
                    "replayHistory": {
                        "type": "boolean",
                        "description": "Whether to receive past messages (default: true)",
                    },
                },
                "required": ["sessionId", "agentRole"],
            },
        ),
        Tool(
            name="leave_session",
            description="[Any] Leave a session gracefully. Tasks are reassigned.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID to leave",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for leaving",
                    },
                },
                "required": ["sessionId"],
            },
        ),
        Tool(
            name="close_session",
            description="[Team Leader] Close a session. All tasks must be complete or will be abandoned.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID to close",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for closing",
                    },
                    "summary": {
                        "type": "string",
                        "description": "Session summary/outcome",
                    },
                },
                "required": ["sessionId"],
            },
        ),
        # PATTERN-C-003 v6: Session Handshake Protocol
        Tool(
            name="session_handshake",
            description="[Any] Session handshake protocol for reliable join. "
                        "Team Leader broadcasts SESSION_READY after create_session. "
                        "Workers respond with WORKER_READY after join_session. "
                        "Team Leader waits for all ready before assigning tasks. "
                        "Solves race condition where workers miss session creation!",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "handshakeType": {
                        "type": "string",
                        "enum": ["SESSION_READY", "WORKER_READY", "ACK"],
                        "description": "Type of handshake signal",
                    },
                    "metadata": {
                        "type": "object",
                        "description": "Optional metadata (e.g., expectedWorkers, capabilities)",
                    },
                },
                "required": ["sessionId", "handshakeType"],
            },
        ),

        # === Session Communication (3 tools) ===
        Tool(
            name="session_broadcast",
            description="[Any] Broadcast a message to all session participants.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "content": {
                        "type": "string",
                        "description": "Message content",
                    },
                    "messageType": {
                        "type": "string",
                        "enum": ["chat", "announcement", "question", "status"],
                        "description": "Type of message",
                    },
                },
                "required": ["sessionId", "content"],
            },
        ),
        Tool(
            name="session_message",
            description="[Any] Send a direct message to a specific agent in the session.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "toAgent": {
                        "type": "string",
                        "description": "Target agent ID",
                    },
                    "content": {
                        "type": "string",
                        "description": "Message content",
                    },
                },
                "required": ["sessionId", "toAgent", "content"],
            },
        ),
        Tool(
            name="get_session_history",
            description="[Any] Get message history from the session. Useful for catching up.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "limit": {
                        "type": "number",
                        "description": "Max messages to return (default: 50)",
                    },
                    "messageType": {
                        "type": "string",
                        "enum": ["all", "chat", "task", "result", "control", "meeting"],
                        "description": "Filter by message type",
                    },
                },
                "required": ["sessionId"],
            },
        ),
        Tool(
            name="poll_session_messages",
            description="[Any] Poll for NEW session messages from inbox. "
                        "Solves MCP stateless problem - messages are stored in file-based inbox by daemon. "
                        "Call this periodically to receive messages sent by other agents.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID to poll messages from",
                    },
                    "unreadOnly": {
                        "type": "boolean",
                        "description": "Only return unread messages (default: true)",
                    },
                    "messageTypes": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter by message types (e.g., ['chat', 'task'])",
                    },
                    "limit": {
                        "type": "number",
                        "description": "Max messages to return (default: 100)",
                    },
                    "markAsRead": {
                        "type": "boolean",
                        "description": "Mark returned messages as read (default: true)",
                    },
                },
                "required": ["sessionId"],
            },
        ),

        # === Pattern C-003 v3: Instant Wake (1 tool) ===
        Tool(
            name="wait_for_task",
            description="[Any] BLOCKING wait for new messages using Redis Streams. "
                        "Replaces 5s polling with <100ms instant notification! "
                        "Blocks until a wake signal arrives or timeout expires. "
                        "After waking, read messages with poll_session_messages.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID to wait for messages in",
                    },
                    "timeoutMs": {
                        "type": "number",
                        "description": "Max wait time in milliseconds (default: 30000 = 30s)",
                    },
                },
                "required": ["sessionId"],
            },
        ),

        # === Session State (3 tools) ===
        Tool(
            name="get_session_status",
            description="[Any] Get comprehensive session status including participants, tasks, meetings.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                },
                "required": ["sessionId"],
            },
        ),
        Tool(
            name="update_session_progress",
            description="[Worker] Update your progress on the current task within the session.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "progress": {
                        "type": "number",
                        "description": "Progress percentage (0-100)",
                    },
                    "message": {
                        "type": "string",
                        "description": "Progress update message",
                    },
                },
                "required": ["sessionId", "progress"],
            },
        ),
        Tool(
            name="checkpoint_session",
            description="[Team Leader] Create a session checkpoint for recovery purposes.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "checkpointName": {
                        "type": "string",
                        "description": "Name for the checkpoint",
                    },
                },
                "required": ["sessionId"],
            },
        ),

        # === Task Coordination (4 tools) ===
        Tool(
            name="assign_session_task",
            description="[Team Leader] Assign a task to a specific worker within the session.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "title": {
                        "type": "string",
                        "description": "Task title",
                    },
                    "description": {
                        "type": "string",
                        "description": "Detailed task description",
                    },
                    "assignTo": {
                        "type": "string",
                        "description": "Agent ID to assign the task to",
                    },
                    "taskType": {
                        "type": "string",
                        "description": "Task type (e.g., 'coding', 'review', 'research')",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["critical", "high", "normal", "low"],
                    },
                    "dependencies": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Task IDs that must complete first",
                    },
                },
                "required": ["sessionId", "title", "description"],
            },
        ),
        Tool(
            name="report_task_progress",
            description="[Worker] Report progress on an assigned task.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "taskId": {
                        "type": "string",
                        "description": "Task ID",
                    },
                    "progress": {
                        "type": "number",
                        "description": "Progress percentage (0-100)",
                    },
                    "status": {
                        "type": "string",
                        "enum": ["in_progress", "blocked", "needs_help"],
                    },
                    "notes": {
                        "type": "string",
                        "description": "Progress notes",
                    },
                },
                "required": ["sessionId", "taskId", "progress"],
            },
        ),
        Tool(
            name="report_task_completion",
            description="[Worker] Report task completion with results.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "taskId": {
                        "type": "string",
                        "description": "Task ID",
                    },
                    "success": {
                        "type": "boolean",
                        "description": "Whether task completed successfully",
                    },
                    "result": {
                        "type": "object",
                        "description": "Task result/deliverable",
                    },
                    "error": {
                        "type": "string",
                        "description": "Error message if failed",
                    },
                },
                "required": ["sessionId", "taskId", "success"],
            },
        ),
        Tool(
            name="request_task_help",
            description="[Worker] Request help on a task from other agents.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "taskId": {
                        "type": "string",
                        "description": "Task ID needing help",
                    },
                    "helpType": {
                        "type": "string",
                        "enum": ["clarification", "code-review", "debugging", "pair-work"],
                        "description": "Type of help needed",
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of what help is needed",
                    },
                },
                "required": ["sessionId", "helpType", "description"],
            },
        ),

        # === Meeting Tools (3 tools) ===
        Tool(
            name="start_meeting",
            description="[Team Leader] Start a meeting within the session.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "title": {
                        "type": "string",
                        "description": "Meeting title",
                    },
                    "meetingType": {
                        "type": "string",
                        "enum": ["introduction", "planning", "standup", "retrospective", "decision"],
                    },
                    "agenda": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "topic": {"type": "string"},
                                "duration": {"type": "number"},
                            },
                        },
                        "description": "Meeting agenda items",
                    },
                },
                "required": ["sessionId", "title"],
            },
        ),
        Tool(
            name="vote_on_proposal",
            description="[Any] Cast a vote on a proposal during a meeting.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "meetingId": {
                        "type": "string",
                        "description": "Meeting ID",
                    },
                    "proposalId": {
                        "type": "string",
                        "description": "Proposal to vote on",
                    },
                    "vote": {
                        "type": "string",
                        "enum": ["approve", "reject", "abstain"],
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Reason for vote",
                    },
                },
                "required": ["sessionId", "meetingId", "proposalId", "vote"],
            },
        ),
        Tool(
            name="conclude_meeting",
            description="[Team Leader] Conclude the meeting with summary and decisions.",
            inputSchema={
                "type": "object",
                "properties": {
                    "sessionId": {
                        "type": "string",
                        "description": "Session ID",
                    },
                    "meetingId": {
                        "type": "string",
                        "description": "Meeting ID",
                    },
                    "summary": {
                        "type": "string",
                        "description": "Meeting summary",
                    },
                    "decisions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "decision": {"type": "string"},
                                "owner": {"type": "string"},
                            },
                        },
                        "description": "Decisions made",
                    },
                    "actionItems": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "action": {"type": "string"},
                                "assignee": {"type": "string"},
                                "dueDate": {"type": "string"},
                            },
                        },
                        "description": "Action items from meeting",
                    },
                },
                "required": ["sessionId", "meetingId", "summary"],
            },
        ),

        # === Disconnect ===
        Tool(
            name="disconnect",
            description="Disconnect from multi-agent system",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


# =============================================================================
# Tool Handlers
# =============================================================================

@mcp_server.call_tool()
async def call_tool(name: str, arguments: Dict) -> List[TextContent]:
    """Handle tool calls"""

    try:
        # === Connection & Registration ===
        if name == "register_agent":
            result = await handle_register_agent(arguments)

        elif name == "get_connection_status":
            result = handle_get_connection_status()

        # === Task Management ===
        elif name == "send_task":
            result = await handle_send_task(arguments)

        elif name == "get_pending_tasks":
            result = handle_get_pending_tasks(arguments)

        elif name == "complete_task":
            result = await handle_complete_task(arguments)

        # === Brainstorming ===
        elif name == "start_brainstorm":
            result = await handle_start_brainstorm(arguments)

        elif name == "propose_idea":
            result = await handle_propose_idea(arguments)

        elif name == "get_brainstorm_ideas":
            result = handle_get_brainstorm_ideas(arguments)

        # === Voting ===
        elif name == "create_vote":
            result = await handle_create_vote(arguments)

        elif name == "cast_vote":
            result = await handle_cast_vote(arguments)

        # === Communication ===
        elif name == "broadcast_message":
            result = await handle_broadcast_message(arguments)

        elif name == "get_messages":
            result = handle_get_messages(arguments)

        # === Status ===
        elif name == "get_system_status":
            result = handle_get_system_status()

        elif name == "publish_status":
            result = await handle_publish_status(arguments)

        # === RAMAS ===
        elif name == "set_worker_status":
            result = await handle_set_worker_status(arguments)

        elif name == "interrupt_worker":
            result = await handle_interrupt_worker(arguments)

        elif name == "get_worker_statuses":
            result = handle_get_worker_statuses()

        # === Pattern 2: Task Coordination ===
        elif name == "dispatch_subtask":
            result = await handle_dispatch_subtask(arguments)

        elif name == "collect_results":
            result = await handle_collect_results(arguments)

        elif name == "aggregate_results":
            result = handle_aggregate_results(arguments)

        # === Pattern C: Session-Based Multi-Agent (17 tools) ===

        # Session Lifecycle
        elif name == "create_session":
            result = await handle_create_session(arguments)

        elif name == "join_session":
            result = await handle_join_session(arguments)

        elif name == "leave_session":
            result = await handle_leave_session(arguments)

        elif name == "close_session":
            result = await handle_close_session(arguments)

        # PATTERN-C-003 v6: Session Handshake Protocol
        elif name == "session_handshake":
            result = await handle_session_handshake(arguments)

        # Session Communication
        elif name == "session_broadcast":
            result = await handle_session_broadcast(arguments)

        elif name == "session_message":
            result = await handle_session_message(arguments)

        elif name == "get_session_history":
            result = handle_get_session_history(arguments)

        elif name == "poll_session_messages":
            result = handle_poll_session_messages(arguments)

        # Pattern C-003 v3: Instant Wake
        elif name == "wait_for_task":
            result = await handle_wait_for_task(arguments)

        # Session State
        elif name == "get_session_status":
            result = await handle_get_session_status(arguments)

        elif name == "update_session_progress":
            result = await handle_update_session_progress(arguments)

        elif name == "checkpoint_session":
            result = await handle_checkpoint_session(arguments)

        # Task Coordination
        elif name == "assign_session_task":
            result = await handle_assign_session_task(arguments)

        elif name == "report_task_progress":
            result = await handle_report_task_progress(arguments)

        elif name == "report_task_completion":
            result = await handle_report_task_completion(arguments)

        elif name == "request_task_help":
            result = await handle_request_task_help(arguments)

        # Meeting Tools
        elif name == "start_meeting":
            result = await handle_start_meeting(arguments)

        elif name == "vote_on_proposal":
            result = await handle_vote_on_proposal(arguments)

        elif name == "conclude_meeting":
            result = await handle_conclude_meeting(arguments)

        # === Disconnect ===
        elif name == "disconnect":
            result = await handle_disconnect()

        else:
            result = {"error": f"Unknown tool: {name}"}

        return [TextContent(type="text", text=json.dumps(result, indent=2))]

    except Exception as e:
        error_result = {"error": str(e), "tool": name}
        return [TextContent(type="text", text=json.dumps(error_result, indent=2))]


# =============================================================================
# NEW: Broadcast Consumer Callback (Pattern C-003 v6.4)
# =============================================================================

async def broadcast_consumer_callback(message: aio_pika.abc.AbstractIncomingMessage):
    """
    Handle incoming broadcast messages from RabbitMQ.

    This callback is invoked by aio-pika when a message arrives on the
    agent's broadcast queue. Messages are stored in STATE.received_messages
    for retrieval via get_messages MCP tool.

    Args:
        message: Incoming RabbitMQ message
    """
    import json
    from datetime import datetime

    async with message.process():
        try:
            # Parse message body
            payload = json.loads(message.body.decode())

            # Skip messages from ourselves
            if payload.get("from") == STATE.agent_name:
                return

            # Store in received_messages
            STATE.received_messages.append({
                "type": payload.get("type", "broadcast"),
                "message": payload.get("message", ""),
                "from": payload.get("from", "unknown"),
                "timestamp": payload.get("timestamp", int(datetime.now().timestamp() * 1000)),
                "data": payload.get("data", {}),
                "source": "rabbitmq_broadcast",  # Mark as real RabbitMQ message
            })

            print(f"[RAMAS] 📡 Broadcast received from {payload.get('from')}: {payload.get('message', '')[:50]}...")

        except json.JSONDecodeError as e:
            print(f"[RAMAS] Broadcast decode error: {e}")
        except Exception as e:
            print(f"[RAMAS] Broadcast callback error: {e}")


# =============================================================================
# Handler Implementations
# =============================================================================

async def handle_register_agent(args: Dict) -> Dict:
    """Register as an agent"""
    role = args.get("role", "worker")
    name = args.get("name")

    # Connect to RabbitMQ if not already connected
    if not STATE.connection or STATE.connection.is_closed:
        STATE.connection = await aio_pika.connect_robust(RABBITMQ_URL)
        STATE.channel = await STATE.connection.channel()

        # Setup exchanges (includes BROADCAST exchange now)
        await exchanges.setup_all(STATE.channel)

    STATE.agent_role = role
    STATE.agent_name = name or f"Claude-{role}-{STATE.agent_id[-6:]}"
    STATE.is_initialized = True

    # =========================================================================
    # NEW: Setup Global Broadcast Queue (Pattern C-003 v6.4)
    # =========================================================================
    # Create agent's broadcast inbox and start consuming
    try:
        STATE.broadcast_queue = await exchanges.setup_broadcast_queue(
            STATE.channel,
            STATE.agent_name,  # Use agent name for queue identification
        )

        # Start consuming broadcast messages
        await exchanges.setup_broadcast_consumer(
            STATE.broadcast_queue,
            broadcast_consumer_callback,
        )
        print(f"[RAMAS] Broadcast consumer active for {STATE.agent_name}")
    except Exception as e:
        print(f"[RAMAS] Warning: Broadcast setup failed: {e}")
        # Non-fatal - agent can still work without broadcast

    # Announce presence
    await exchanges.publish_status_update(
        STATE.channel,
        STATE.agent_id,
        "connected",
        STATE.agent_name,
    )

    return {
        "success": True,
        "agentId": STATE.agent_id,
        "agentName": STATE.agent_name,
        "role": STATE.agent_role,
        "message": f"Connected as {STATE.agent_name} ({role})",
        "broadcastEnabled": STATE.broadcast_queue is not None,
    }


def handle_get_connection_status() -> Dict:
    """Get connection status"""
    return {
        "connected": STATE.is_initialized and STATE.connection and not STATE.connection.is_closed,
        "agentId": STATE.agent_id,
        "agentName": STATE.agent_name,
        "role": STATE.agent_role,
        "isInitialized": STATE.is_initialized,
        "pendingTasksCount": len(STATE.pending_tasks),
        "receivedMessagesCount": len(STATE.received_messages),
        "activeBrainstorms": len(STATE.brainstorm_sessions),
    }


async def handle_send_task(args: Dict) -> Dict:
    """Send a task"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    task_id = str(uuid4())

    # Publish to task exchange (would need to set up task exchange)
    # For now, just track locally
    STATE.pending_tasks.append({
        "id": task_id,
        "title": args.get("title"),
        "description": args.get("description"),
        "priority": args.get("priority", "normal"),
        "context": args.get("context", {}),
        "assignedBy": STATE.agent_id,
        "createdAt": int(time.time() * 1000),
    })

    return {
        "success": True,
        "taskId": task_id,
        "message": f"Task '{args.get('title')}' sent",
    }


def handle_get_pending_tasks(args: Dict) -> Dict:
    """Get pending tasks"""
    limit = args.get("limit", 10)
    tasks = STATE.pending_tasks[:limit]

    return {
        "count": len(STATE.pending_tasks),
        "tasks": tasks,
    }


async def handle_complete_task(args: Dict) -> Dict:
    """Complete a task"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    task_id = args.get("taskId")

    # Remove from pending
    STATE.pending_tasks = [t for t in STATE.pending_tasks if t.get("id") != task_id]

    return {
        "success": True,
        "message": f"Task {task_id} marked as {args.get('status', 'completed')}",
    }


async def handle_start_brainstorm(args: Dict) -> Dict:
    """Start brainstorm session"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    session_id = str(uuid4())

    STATE.brainstorm_sessions[session_id] = {
        "id": session_id,
        "topic": args.get("topic"),
        "question": args.get("question"),
        "duration": args.get("duration", 10),
        "ideas": [],
        "startedAt": int(time.time() * 1000),
        "startedBy": STATE.agent_name,
    }

    return {
        "success": True,
        "sessionId": session_id,
        "message": f"Brainstorm started: {args.get('topic')}",
    }


async def handle_propose_idea(args: Dict) -> Dict:
    """Propose idea in brainstorm"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    session_id = args.get("sessionId")
    session = STATE.brainstorm_sessions.get(session_id)

    if session:
        session["ideas"].append({
            "from": STATE.agent_name,
            "idea": args.get("idea"),
            "reasoning": args.get("reasoning"),
            "timestamp": int(time.time() * 1000),
        })

    return {
        "success": True,
        "message": "Idea proposed",
    }


def handle_get_brainstorm_ideas(args: Dict) -> Dict:
    """Get brainstorm ideas"""
    session_id = args.get("sessionId")

    if session_id:
        session = STATE.brainstorm_sessions.get(session_id)
    else:
        # Get most recent session
        sessions = list(STATE.brainstorm_sessions.values())
        session = sessions[-1] if sessions else None

    if not session:
        return {"error": "No brainstorm session found"}

    return {
        "sessionId": session["id"],
        "topic": session["topic"],
        "question": session["question"],
        "ideasCount": len(session["ideas"]),
        "ideas": session["ideas"],
    }


async def handle_create_vote(args: Dict) -> Dict:
    """Create vote session"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    vote_id = str(uuid4())

    STATE.vote_results[vote_id] = {
        "id": vote_id,
        "question": args.get("question"),
        "options": args.get("options"),
        "method": args.get("votingMethod", "simple_majority"),
        "votes": [],
        "createdAt": int(time.time() * 1000),
        "createdBy": STATE.agent_name,
    }

    return {
        "success": True,
        "voteId": vote_id,
        "message": f"Vote created: {args.get('question')}",
        "options": args.get("options"),
    }


async def handle_cast_vote(args: Dict) -> Dict:
    """Cast vote"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    vote_id = args.get("voteId")
    vote = STATE.vote_results.get(vote_id)

    if vote:
        vote["votes"].append({
            "from": STATE.agent_name,
            "choice": args.get("choice"),
            "confidence": args.get("confidence", 100),
            "timestamp": int(time.time() * 1000),
        })

    return {
        "success": True,
        "message": f"Vote cast for '{args.get('choice')}'",
    }


async def handle_broadcast_message(args: Dict) -> Dict:
    """
    Broadcast message to ALL connected agents via RabbitMQ.

    Pattern C-003 v6.4: Uses fanout exchange for true global broadcast.
    All agents with bound queues will receive this message, regardless
    of their session membership.
    """
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    if not STATE.channel:
        return {"error": "RabbitMQ channel not available"}

    # Build message payload
    message_payload = {
        "message": args.get("message"),
        "from": STATE.agent_name,
        "data": args.get("data", {}),
    }
    message_type = args.get("type", "info")

    # Publish to RabbitMQ broadcast exchange (fanout = all bound queues)
    try:
        success = await exchanges.publish_broadcast(
            STATE.channel,
            message_payload,
            message_type,
        )

        if success:
            # Also store locally for sender's reference
            STATE.received_messages.append({
                "type": message_type,
                "message": args.get("message"),
                "from": STATE.agent_name,
                "timestamp": int(time.time() * 1000),
                "source": "local_send",  # Mark as sent by us
            })

            return {
                "success": True,
                "message": f"Broadcast sent to ALL connected agents via RabbitMQ",
                "recipients": "all_connected_agents",
            }
        else:
            return {
                "success": False,
                "error": "Failed to publish to RabbitMQ broadcast exchange",
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Broadcast failed: {str(e)}",
        }


def handle_get_messages(args: Dict) -> Dict:
    """Get messages"""
    messages = STATE.received_messages.copy()
    msg_type = args.get("type", "all")
    since = args.get("since")
    limit = args.get("limit", 20)

    if msg_type != "all":
        messages = [m for m in messages if m.get("type") == msg_type]

    if since:
        messages = [m for m in messages if m.get("timestamp", 0) > since]

    return {
        "count": len(messages[-limit:]),
        "messages": messages[-limit:],
    }


def handle_get_system_status() -> Dict:
    """Get system status"""
    return {
        "connection": {
            "connected": STATE.is_initialized,
            "agentId": STATE.agent_id,
            "agentName": STATE.agent_name,
            "role": STATE.agent_role,
        },
        "queues": {
            "pendingTasks": len(STATE.pending_tasks),
            "receivedMessages": len(STATE.received_messages),
            "activeBrainstorms": len(STATE.brainstorm_sessions),
            "activeVotes": len(STATE.vote_results),
        },
        "recentActivity": STATE.received_messages[-5:],
    }


async def handle_publish_status(args: Dict) -> Dict:
    """Publish status"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    await exchanges.publish_status_update(
        STATE.channel,
        STATE.agent_id,
        args.get("status"),
        STATE.agent_name,
    )

    return {
        "success": True,
        "message": f"Status updated to: {args.get('status')}",
    }


# =============================================================================
# RAMAS Handlers (Push Notifications)
# =============================================================================

async def handle_set_worker_status(args: Dict) -> Dict:
    """Set worker status (green/red)"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    worker_id = args.get("workerId")
    status = args.get("status")

    if status not in ["green", "red"]:
        return {"error": 'Status must be "green" or "red"'}

    # Publish to RAMAS status exchange
    await exchanges.publish_status_update(
        STATE.channel,
        worker_id,
        status,
        STATE.agent_name,
    )

    # Update local registry
    registry.update_status(worker_id, status)

    return {
        "success": True,
        "workerId": worker_id,
        "status": status,
        "message": f"Worker {worker_id} status set to {status.upper()}",
    }


async def handle_interrupt_worker(args: Dict) -> Dict:
    """Send interrupt message to worker"""
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    worker_id = args.get("workerId")
    message = args.get("message")
    priority = args.get("priority", "normal")

    # Publish to RAMAS interrupt exchange
    await exchanges.publish_interrupt(
        STATE.channel,
        worker_id,
        message,
        priority,
        STATE.agent_name,
    )

    return {
        "success": True,
        "workerId": worker_id,
        "priority": priority,
        "message": f"Interrupt sent to {worker_id} ({priority})",
    }


def handle_get_worker_statuses() -> Dict:
    """Get all worker statuses"""
    stats = registry.get_stats()
    windows = registry.get_all_windows()

    workers = [
        {
            "workerId": worker_id,
            "windowId": window.window_id,
            "status": window.status,
            "lastStatusChange": window.last_status_change,
        }
        for worker_id, window in windows.items()
    ]

    return {
        "registryPath": registry.REGISTRY_PATH,
        "workerCount": len(workers),
        "workers": workers,
        "greenCount": stats["green"],
        "redCount": stats["red"],
    }


# =============================================================================
# Pattern 2: Task Coordination Handlers
# =============================================================================

async def handle_dispatch_subtask(args: Dict) -> Dict:
    """
    Dispatch a subtask to a specific worker via RabbitMQ.

    This is the key Pattern 2 function that Team Leader uses to
    distribute work to workers. The daemon listens on task queues
    and routes messages to iTerm2 terminals.
    """
    if not STATE.is_initialized:
        return {"error": "Not connected. Call register_agent first."}

    worker_id = args.get("workerId")
    task_type = args.get("taskType")
    params = args.get("params", {})
    custom_task_id = args.get("taskId")

    # Generate task ID if not provided
    task_id = custom_task_id or f"task-{int(time.time())}-{worker_id}"

    # Publish task to RabbitMQ via exchanges module
    try:
        success = await exchanges.publish_task(
            channel=STATE.channel,
            worker_id=worker_id,
            task_id=task_id,
            task_type=task_type,
            task_params=params,
            from_leader=STATE.agent_name or "team-leader",
        )

        if success:
            # Track dispatched task
            STATE.pending_tasks.append({
                "taskId": task_id,
                "workerId": worker_id,
                "taskType": task_type,
                "params": params,
                "dispatchedAt": int(time.time() * 1000),
                "status": "dispatched",
            })

            return {
                "success": True,
                "taskId": task_id,
                "workerId": worker_id,
                "taskType": task_type,
                "message": f"Task {task_id} dispatched to {worker_id}",
                "resultFile": f"/tmp/result_{task_id}.json",
            }
        else:
            return {
                "success": False,
                "error": "Failed to publish task to RabbitMQ",
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Dispatch failed: {str(e)}",
        }


async def handle_collect_results(args: Dict) -> Dict:
    """
    Collect results from worker tasks.

    Reads result files from /tmp/ directory. Workers write their
    results to /tmp/result_{task_id}.json after completing tasks.
    """
    import os
    from pathlib import Path

    task_ids = args.get("taskIds", [])
    timeout = args.get("timeout", 60)

    if not task_ids:
        return {"error": "No task IDs provided"}

    results = {}
    pending = set(task_ids)
    start_time = time.time()

    while pending and (time.time() - start_time) < timeout:
        for task_id in list(pending):
            result_file = Path(f"/tmp/result_{task_id}.json")

            if result_file.exists():
                try:
                    with open(result_file) as f:
                        data = json.load(f)
                    results[task_id] = {
                        "success": True,
                        "data": data,
                        "collectedAt": int(time.time() * 1000),
                    }
                    pending.remove(task_id)
                except json.JSONDecodeError as e:
                    results[task_id] = {
                        "success": False,
                        "error": f"Invalid JSON: {str(e)}",
                    }
                    pending.remove(task_id)
                except Exception as e:
                    results[task_id] = {
                        "success": False,
                        "error": str(e),
                    }
                    pending.remove(task_id)

        if pending:
            await asyncio.sleep(2)  # Check every 2 seconds

    # Mark remaining as timeout
    for task_id in pending:
        results[task_id] = {
            "success": False,
            "error": "Timeout waiting for result",
        }

    return {
        "collected": len([r for r in results.values() if r.get("success")]),
        "failed": len([r for r in results.values() if not r.get("success")]),
        "results": results,
    }


def handle_aggregate_results(args: Dict) -> Dict:
    """
    Aggregate collected results.

    Supports intersection, union, and merge operations on numeric
    arrays from worker results.
    """
    results_dict = args.get("results", {})
    operation = args.get("operation", "intersection")

    # Extract numeric arrays from results
    arrays = []
    for task_id, result_info in results_dict.items():
        if result_info.get("success"):
            data = result_info.get("data", {})
            # Handle both "numbers" and "result" formats
            numbers = data.get("numbers") or data.get("result", [])
            if isinstance(numbers, list):
                arrays.append(set(numbers))

    if not arrays:
        return {
            "success": False,
            "error": "No valid numeric arrays found in results",
        }

    if operation == "intersection":
        # Intersection of all arrays
        result = arrays[0]
        for arr in arrays[1:]:
            result = result & arr
        aggregated = sorted(list(result))

    elif operation == "union":
        # Union of all arrays
        result = set()
        for arr in arrays:
            result = result | arr
        aggregated = sorted(list(result))

    elif operation == "merge":
        # Merge preserving order (list of dicts, etc.)
        aggregated = []
        for task_id, result_info in results_dict.items():
            if result_info.get("success"):
                aggregated.append({
                    "taskId": task_id,
                    "data": result_info.get("data"),
                })
    else:
        return {"error": f"Unknown operation: {operation}"}

    return {
        "success": True,
        "operation": operation,
        "inputCount": len(arrays),
        "resultCount": len(aggregated),
        "result": aggregated,
    }


async def handle_disconnect() -> Dict:
    """Disconnect from system"""
    if STATE.connection:
        await exchanges.publish_status_update(
            STATE.channel,
            STATE.agent_id,
            "disconnected",
            STATE.agent_name,
        )

        await STATE.channel.close()
        await STATE.connection.close()
        STATE.connection = None
        STATE.channel = None
        STATE.is_initialized = False

    return {
        "success": True,
        "message": "Disconnected from multi-agent system",
    }


# =============================================================================
# HYBRID NOTIFICATION SYSTEM (Çözüm 3 + Çözüm 2 Fallback)
# =============================================================================
#
# Problem: assign_session_task() task'ı atar ama worker'a notification göndermez
#          Worker wait_for_task() ile beklerken uyandırılması gerekir
#
# Solution: Hybrid approach
#   1. PRIMARY: Redis wake signal (fast, cross-platform, <100ms)
#   2. FALLBACK: iTerm2 interrupt (if Redis fails, macOS only)
#
# Author: Dr. Umit Kacar
# Date: 2026-01-04
# =============================================================================

async def notify_worker(
    worker_id: str,
    session_id: str,
    task_id: str,
    task_title: str,
    notification_type: str = "task_assigned",
) -> Dict[str, Any]:
    """
    PATTERN-C-003 v4: Notify a worker about a new task using hybrid approach.

    Added in v4 to solve the circular wait deadlock where Team Leader
    waited for workers who were also waiting for notifications.

    HYBRID NOTIFICATION FLOW:
    ┌─────────────────────────────────────────────────────────────┐
    │  1. Try Redis Wake Signal (PRIMARY)                         │
    │     └─→ XADD to ramas:wake:{worker_id}                      │
    │         └─→ wait_for_task() unblocks immediately            │
    │                                                              │
    │  2. If Redis fails → Fallback to Interrupt (SECONDARY)      │
    │     └─→ AppleScript to iTerm2 terminal                      │
    │         └─→ Sends visible message to terminal               │
    └─────────────────────────────────────────────────────────────┘

    Args:
        worker_id: Target worker identifier (e.g., "worker-001")
        session_id: Session containing the task
        task_id: ID of the assigned task
        task_title: Human-readable task title
        notification_type: Type of notification (task_assigned, urgent, etc.)

    Returns:
        Dict with:
            - success: bool
            - method: "redis_wake" | "interrupt_fallback" | "none"
            - message: Human-readable status
    """
    result = {
        "success": False,
        "method": "none",
        "worker_id": worker_id,
        "task_id": task_id,
        "message": "",
    }

    # ─────────────────────────────────────────────────────────────
    # STEP 1: Try Redis Wake Signal (PRIMARY - Fast, Cross-platform)
    # ─────────────────────────────────────────────────────────────
    try:
        redis_registry = await get_redis_registry()

        if redis_registry.is_connected:
            wake_success = await redis_registry.publish_wake(
                agent_id=worker_id,
                event_type=notification_type,
                data={
                    "session_id": session_id,
                    "task_id": task_id,
                    "task_title": task_title,
                    "assigned_by": STATE.agent_id,
                    "timestamp": time.time(),
                },
            )

            if wake_success:
                logger.info(f"✅ Redis wake signal sent to {worker_id} for task {task_id}")
                result["success"] = True
                result["method"] = "redis_wake"
                result["message"] = f"Redis wake signal delivered to {worker_id}"
                return result
            else:
                logger.warning(f"Redis wake publish returned False for {worker_id}")
        else:
            logger.warning("Redis not connected, will try interrupt fallback")

    except Exception as e:
        logger.warning(f"Redis wake failed for {worker_id}: {e}, trying interrupt fallback")

    # ─────────────────────────────────────────────────────────────
    # STEP 2: Fallback to Interrupt (SECONDARY - macOS only)
    # ─────────────────────────────────────────────────────────────
    try:
        # Build interrupt message
        interrupt_message = (
            f"📋 TASK ASSIGNED: {task_title}\n"
            f"Run: poll_session_messages(sessionId='{session_id}') to see details"
        )

        # Use existing interrupt mechanism
        interrupt_result = await handle_interrupt_worker({
            "workerId": worker_id,
            "message": interrupt_message,
            "priority": "normal",
        })

        if interrupt_result.get("success"):
            logger.info(f"✅ Interrupt fallback sent to {worker_id}")
            result["success"] = True
            result["method"] = "interrupt_fallback"
            result["message"] = f"Interrupt message delivered to {worker_id} terminal"
            return result
        else:
            logger.error(f"Interrupt fallback also failed for {worker_id}: {interrupt_result}")
            result["message"] = f"Interrupt failed: {interrupt_result.get('error', 'unknown')}"

    except Exception as e:
        logger.error(f"Interrupt fallback failed for {worker_id}: {e}")
        result["message"] = f"All notification methods failed: {e}"

    return result


async def notify_workers_batch(
    worker_ids: List[str],
    session_id: str,
    task_infos: Dict[str, Dict],  # worker_id -> {task_id, title}
) -> Dict[str, Dict]:
    """
    Notify multiple workers about their assigned tasks.

    Args:
        worker_ids: List of worker identifiers
        session_id: Session ID
        task_infos: Mapping of worker_id to task info {task_id, title}

    Returns:
        Dict mapping worker_id to notification result
    """
    results = {}

    for worker_id in worker_ids:
        task_info = task_infos.get(worker_id, {})
        results[worker_id] = await notify_worker(
            worker_id=worker_id,
            session_id=session_id,
            task_id=task_info.get("task_id", "unknown"),
            task_title=task_info.get("title", "Unknown Task"),
        )
        # Small delay between notifications to avoid overwhelming
        await asyncio.sleep(0.1)

    return results


# =============================================================================
# Pattern C: Session-Based Multi-Agent Handlers (17 handlers)
# =============================================================================

async def _ensure_session_manager() -> SessionManager:
    """Ensure SessionManager is initialized and connected"""
    if STATE.session_manager is None:
        STATE.session_manager = SessionManager(RABBITMQ_URL)
        await STATE.session_manager.connect()
    return STATE.session_manager


async def _get_session(session_id: str) -> Optional[Session]:
    """
    Get session by ID.

    PATTERN-C-002 Fix: If session not found in local manager,
    check shared registry and create local session from that info.
    This allows workers to join sessions created by other agents.
    """
    manager = await _ensure_session_manager()

    # First check local manager
    session = await manager.get_session(session_id)
    if session:
        return session

    # PATTERN-C-002: Check shared registry
    shared_registry = get_session_registry()
    session_info = shared_registry.get_session(session_id)

    if session_info:
        # Create local session from registry info
        config = SessionConfig(
            session_id=session_info.session_id,
            session_name=session_info.session_name,
            session_type=session_info.session_type,
        )
        session = await manager.create_session(config)
        logger.info(f"PATTERN-C-002: Created local session from shared registry: {session_id}")
        return session

    return None


# -----------------------------------------------------------------------------
# Session Lifecycle Handlers (4)
# -----------------------------------------------------------------------------

async def handle_create_session(args: Dict) -> Dict:
    """
    Create a new session for multi-agent collaboration.

    This is the Team Leader's first action - creates an isolated
    "meeting room" where workers can join and collaborate.

    PATTERN-C-003 v6: Clears stale wake signals before creating session
    to prevent "Session not found" errors from old sessions.
    """
    session_name = args.get("sessionName")
    session_type = args.get("sessionType", "general")
    expected_workers = args.get("expectedWorkers", 2)
    config_overrides = args.get("config", {})

    if not session_name:
        return {"error": "sessionName is required"}

    try:
        manager = await _ensure_session_manager()

        # =====================================================================
        # PATTERN-C-003 v6: Clear stale wake streams BEFORE session creation
        # This prevents workers from receiving old session signals
        # Root cause fix for "Session not found" error identified in brainstorm!
        # =====================================================================
        stale_cleanup_results = {}
        try:
            from .redis_registry import get_redis_registry
            redis_registry = await get_redis_registry()

            # Clear wake streams for expected workers (worker-001, worker-002, etc.)
            worker_ids = [f"worker-{str(i).zfill(3)}" for i in range(1, expected_workers + 1)]

            # Also clear team-leader's wake stream (for bidirectional wake)
            all_agents = worker_ids + ["team-leader"]

            for agent_id in all_agents:
                result = await redis_registry.clear_wake_stream(agent_id)
                stale_cleanup_results[agent_id] = result

            logger.info(f"v6: Cleared {sum(stale_cleanup_results.values())}/{len(all_agents)} stale wake streams")

        except Exception as cleanup_error:
            logger.warning(f"v6: Stale wake cleanup failed (non-blocking): {cleanup_error}")
            stale_cleanup_results = {"error": str(cleanup_error)}

        # Create session config
        session_id = f"session-{int(time.time())}-{uuid4().hex[:8]}"
        config = SessionConfig(
            session_id=session_id,
            session_name=session_name,
            session_type=session_type,
            expected_worker_count=expected_workers,
            **config_overrides,
        )

        # Create session
        session = await manager.create_session(config)

        # Store current session for this agent
        STATE.current_session_id = session_id

        # PATTERN-C-001 Fix: Register Team Leader's inbox for this session
        register_for_session(STATE.agent_id, session_id)

        # PATTERN-C-002 Fix: Register session in shared registry
        # This allows workers in other MCP server instances to find this session
        shared_registry = get_session_registry()
        shared_registry.register_session(
            session_id=session_id,
            session_name=session_name,
            session_type=session_type,
            creator_id=STATE.agent_id,
            metadata={"expectedWorkers": expected_workers},
        )

        # Auto-join as team leader
        join_result = await session.join(
            agent_id=STATE.agent_id,
            agent_role="team-leader",
            capabilities=["assign_tasks", "aggregate_results", "initiate_brainstorm"],
        )

        return {
            "success": True,
            "sessionId": session_id,
            "sessionName": session_name,
            "sessionType": session_type,
            "state": session.state_machine.state.value,
            "message": f"Session '{session_name}' created. Share session ID with workers.",
            "joinInfo": join_result,
            "inboxRegistered": True,
            "inboxPath": f"/tmp/ramas-session-inboxes/{STATE.agent_id}.json",
            "pollTip": "Use poll_session_messages tool to receive messages from workers",
            # PATTERN-C-003 v6: Stale wake cleanup info
            "v6_stale_cleanup": stale_cleanup_results,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_join_session(args: Dict) -> Dict:
    """
    Join an existing session.

    Workers use this after receiving session_id from Team Leader.
    Optionally replays message history for late joiners.

    PATTERN-C-001 Fix: Also registers agent's inbox to receive messages
    from the daemon's session message router.
    """
    session_id = args.get("sessionId")
    agent_role = args.get("agentRole", "worker")
    capabilities = args.get("capabilities", [])
    replay_history = args.get("replayHistory", True)

    if not session_id:
        return {"error": "sessionId is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        # PATTERN-C-001 Fix: Register inbox for this session
        # This allows the daemon to route session messages to this agent's inbox file
        # Location: /tmp/ramas-session-inboxes/{agent_id}.json
        register_for_session(STATE.agent_id, session_id)

        # PATTERN-C-002 Fix: Add participant to shared registry
        shared_registry = get_session_registry()
        shared_registry.add_participant(session_id, STATE.agent_id)

        # Join the session
        result = await session.join(
            agent_id=STATE.agent_id,
            agent_role=agent_role,
            capabilities=capabilities,
            replay_history=replay_history,
        )

        if result.get("success"):
            STATE.current_session_id = session_id
            result["inboxRegistered"] = True
            result["inboxPath"] = f"/tmp/ramas-session-inboxes/{STATE.agent_id}.json"
            result["pollTip"] = "Use poll_session_messages tool to receive messages from other agents"

        return result

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_leave_session(args: Dict) -> Dict:
    """
    Leave a session gracefully.

    Tasks assigned to this agent will be reassigned.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    reason = args.get("reason", "left")

    if not session_id:
        return {"error": "sessionId is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        result = await session.leave(
            agent_id=STATE.agent_id,
            reason=reason,
        )

        if result.get("success"):
            STATE.current_session_id = None

        return result

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_close_session(args: Dict) -> Dict:
    """
    Close a session (Team Leader only).

    All participants are notified and session is archived.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    reason = args.get("reason", "closed")
    summary = args.get("summary", "")

    if not session_id:
        return {"error": "sessionId is required"}

    try:
        manager = await _ensure_session_manager()

        success = await manager.close_session(session_id, reason)

        if success:
            STATE.current_session_id = None

        return {
            "success": success,
            "sessionId": session_id,
            "reason": reason,
            "summary": summary,
            "message": f"Session {session_id} closed",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# -----------------------------------------------------------------------------
# PATTERN-C-003 v6: Session Handshake Protocol Handler
# -----------------------------------------------------------------------------

async def handle_session_handshake(args: Dict) -> Dict:
    """
    Session handshake protocol for reliable join.

    PATTERN-C-003 v6: Solves race condition where workers miss session creation.

    Workflow:
    1. Team Leader: create_session()
    2. Team Leader: session_handshake(type="SESSION_READY") ← broadcasts to all
    3. Workers: wait_for_task() wakes up, join_session()
    4. Workers: session_handshake(type="WORKER_READY") ← notifies Team Leader
    5. Team Leader: waits until all expected workers are ready
    6. Team Leader: assign_session_task() ← safe to assign now!

    This prevents:
    - Workers trying to join non-existent sessions
    - Team Leader assigning tasks before workers are ready
    - Race conditions in session initialization
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    handshake_type = args.get("handshakeType")
    metadata = args.get("metadata", {})

    if not session_id:
        return {"error": "sessionId is required"}
    if not handshake_type:
        return {"error": "handshakeType is required (SESSION_READY, WORKER_READY, ACK)"}

    try:
        # Build handshake message
        import json
        from datetime import datetime  # Local import for MCP subprocess reload
        handshake_payload = {
            "type": handshake_type,
            "sender": STATE.agent_id,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata,
        }

        # Different behaviors based on handshake type
        if handshake_type == "SESSION_READY":
            # Team Leader broadcasts session is ready
            # This wakes all workers via wait_for_task()
            logger.info(f"v6 HANDSHAKE: Team Leader {STATE.agent_id} broadcasting SESSION_READY")

            # Use session_broadcast to notify all registered agents
            broadcast_result = await handle_session_broadcast({
                "sessionId": session_id,
                "content": f"HANDSHAKE:SESSION_READY:{json.dumps(handshake_payload)}",
                "messageType": "status",
            })

            # Also wake all expected workers via Redis
            from .redis_registry import get_redis_registry
            redis_registry = await get_redis_registry()
            expected_workers = metadata.get("expectedWorkers", 2)
            worker_ids = [f"worker-{str(i).zfill(3)}" for i in range(1, expected_workers + 1)]

            wake_results = {}
            for worker_id in worker_ids:
                result = await notify_worker(
                    worker_id=worker_id,
                    session_id=session_id,
                    task_id="handshake",
                    task_title="SESSION_READY - Please join session",
                    notification_type="session_ready",
                )
                wake_results[worker_id] = result.get("method", "none")

            return {
                "success": True,
                "handshakeType": handshake_type,
                "sessionId": session_id,
                "broadcastResult": broadcast_result.get("success", False),
                "wakeSignals": wake_results,
                "message": f"SESSION_READY broadcasted to {len(worker_ids)} workers",
            }

        elif handshake_type == "WORKER_READY":
            # Worker confirms they joined the session successfully
            logger.info(f"v6 HANDSHAKE: Worker {STATE.agent_id} sending WORKER_READY")

            # Notify Team Leader specifically
            team_leader_wake = await notify_worker(
                worker_id="team-leader",
                session_id=session_id,
                task_id="handshake",
                task_title=f"WORKER_READY from {STATE.agent_id}",
                notification_type="worker_ready",
            )

            # Also broadcast to session for logging
            broadcast_result = await handle_session_broadcast({
                "sessionId": session_id,
                "content": f"HANDSHAKE:WORKER_READY:{json.dumps(handshake_payload)}",
                "messageType": "status",
            })

            return {
                "success": True,
                "handshakeType": handshake_type,
                "sessionId": session_id,
                "teamLeaderWake": team_leader_wake.get("method", "none"),
                "message": f"WORKER_READY sent to Team Leader",
            }

        elif handshake_type == "ACK":
            # Acknowledgment for any handshake message
            logger.info(f"v6 HANDSHAKE: {STATE.agent_id} sending ACK")

            broadcast_result = await handle_session_broadcast({
                "sessionId": session_id,
                "content": f"HANDSHAKE:ACK:{json.dumps(handshake_payload)}",
                "messageType": "status",
            })

            return {
                "success": True,
                "handshakeType": handshake_type,
                "sessionId": session_id,
                "message": f"ACK broadcasted",
            }

        else:
            return {"error": f"Unknown handshake type: {handshake_type}"}

    except Exception as e:
        logger.error(f"v6 HANDSHAKE ERROR: {e}")
        return {"success": False, "error": str(e)}


# -----------------------------------------------------------------------------
# Session Communication Handlers (3)
# -----------------------------------------------------------------------------

async def handle_session_broadcast(args: Dict) -> Dict:
    """
    Broadcast a message to all session participants.

    All agents receive this message in their inbox queue.

    PATTERN-C-001 HYBRID FIX:
    1. Sends via RabbitMQ (for daemon to route)
    2. ALSO writes directly to inbox files (for MCP-only mode)
    This ensures messages are delivered even without daemon running.

    PATTERN-C-003 v5 ENHANCEMENT:
    After broadcast, wakes ALL registered agents so they read the message
    immediately. Uses inbox-based participant discovery instead of
    session.participants (which may not be synced across agents).
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    content = args.get("content")
    message_type = args.get("messageType", "chat")

    if not session_id:
        return {"error": "sessionId is required"}
    if not content:
        return {"error": "content is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        from .session_messages import SessionMessageFactory

        message = SessionMessageFactory.chat(
            session_id=session_id,
            sender_id=STATE.agent_id,
            content=content,
        )

        message_id = await session.broadcast(message)

        # ─────────────────────────────────────────────────────────
        # PATTERN-C-001 HYBRID FIX: Direct inbox write
        # Write to inbox files directly for MCP-only mode
        # Daemon also writes (redundancy), dedup handled by message_id
        # ─────────────────────────────────────────────────────────
        inbox_manager = get_inbox_manager()
        delivered_count = inbox_manager.route_message(
            session_id=session_id,
            target_agent=None,  # Broadcast to all registered agents
            message_id=message_id,
            sender_id=STATE.agent_id,
            message_type=message_type,
            payload={"content": content},
            timestamp=message.timestamp if hasattr(message, 'timestamp') else None,
        )

        # ─────────────────────────────────────────────────────────
        # PATTERN-C-003 v5: Wake all REGISTERED agents so they read the message!
        # Uses inbox_manager to get actual registered agents (more reliable
        # than session.participants which may not be synced across agents)
        # ─────────────────────────────────────────────────────────
        wake_results = {}
        registered_agents = inbox_manager.get_registered_agents_for_session(session_id)
        for agent_id in registered_agents:
            if agent_id != STATE.agent_id:  # Don't wake ourselves
                wake_result = await notify_worker(
                    worker_id=agent_id,
                    session_id=session_id,
                    task_id=message_id,
                    task_title=f"Broadcast: {content[:30]}..." if len(content) > 30 else f"Broadcast: {content}",
                    notification_type="session_broadcast",
                )
                wake_results[agent_id] = wake_result.get("method", "none")

        return {
            "success": True,
            "messageId": message_id,
            "recipients": len(session.participants),
            "deliveredTo": delivered_count,  # PATTERN-C-001: Inbox delivery count
            "wakeSignals": wake_results,  # PATTERN-C-003 v5: Wake signal results
            "message": f"Broadcast sent to {len(session.participants)} participants, delivered to {delivered_count} inboxes",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_session_message(args: Dict) -> Dict:
    """
    Send a direct message to a specific agent in the session.

    PATTERN-C-001 HYBRID FIX:
    1. Sends via RabbitMQ (for daemon to route)
    2. ALSO writes directly to target agent's inbox file
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    to_agent = args.get("toAgent")
    content = args.get("content")
    message_type = args.get("messageType", "direct_message")

    if not session_id:
        return {"error": "sessionId is required"}
    if not to_agent:
        return {"error": "toAgent is required"}
    if not content:
        return {"error": "content is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        if to_agent not in session.participants:
            return {"error": f"Agent {to_agent} not in session"}

        from .session_messages import SessionMessageFactory

        message = SessionMessageFactory.chat(
            session_id=session_id,
            sender_id=STATE.agent_id,
            content=content,
            target_agent=to_agent,
        )

        message_id = await session.send_direct(message, to_agent)

        # ─────────────────────────────────────────────────────────
        # PATTERN-C-001 HYBRID FIX: Direct inbox write
        # Write to target agent's inbox file directly
        # ─────────────────────────────────────────────────────────
        inbox_manager = get_inbox_manager()
        delivered_count = inbox_manager.route_message(
            session_id=session_id,
            target_agent=to_agent,  # Specific agent only
            message_id=message_id,
            sender_id=STATE.agent_id,
            message_type=message_type,
            payload={"content": content},
            timestamp=message.timestamp if hasattr(message, 'timestamp') else None,
        )

        # ─────────────────────────────────────────────────────────
        # PATTERN-C-003 v5: Wake target agent so they read the message!
        # ─────────────────────────────────────────────────────────
        wake_result = await notify_worker(
            worker_id=to_agent,
            session_id=session_id,
            task_id=message_id,
            task_title=f"Direct message from {STATE.agent_id}",
            notification_type="direct_message",
        )

        return {
            "success": True,
            "messageId": message_id,
            "to": to_agent,
            "deliveredTo": delivered_count,  # PATTERN-C-001: Inbox delivery count
            "wakeSignal": wake_result.get("method", "none"),  # PATTERN-C-003 v5
            "message": f"Message sent to {to_agent}, delivered to {delivered_count} inbox(es)",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def handle_get_session_history(args: Dict) -> Dict:
    """
    Get message history from the session.

    Useful for catching up after joining late.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    limit = args.get("limit", 50)
    message_type_filter = args.get("messageType", "all")

    if not session_id:
        return {"error": "sessionId is required"}

    # Note: This is synchronous because we access in-memory history
    # For async access, we'd need to read from RabbitMQ stream

    manager = STATE.session_manager
    if not manager:
        return {"error": "Not connected to session manager"}

    session = manager.sessions.get(session_id)
    if not session:
        return {"error": f"Session {session_id} not found"}

    # Filter messages
    messages = session.message_history[-limit:]

    if message_type_filter != "all":
        type_map = {
            "chat": MessageType.CHAT,
            "task": MessageType.TASK,
            "result": MessageType.RESULT,
            "control": MessageType.CONTROL,
            "meeting": MessageType.MEETING,
        }
        filter_type = type_map.get(message_type_filter)
        if filter_type:
            messages = [m for m in messages if m.message_type == filter_type]

    return {
        "sessionId": session_id,
        "count": len(messages),
        "messages": [m.to_dict() for m in messages],
    }


def handle_poll_session_messages(args: Dict) -> Dict:
    """
    Poll for NEW session messages from file-based inbox.

    PATTERN-C-001 Fix: This solves the MCP stateless connection problem.
    - Daemon maintains persistent connection to RabbitMQ session exchange
    - Daemon routes incoming messages to agent inbox files
    - This tool reads from the inbox file (no connection needed)

    Inbox Location: /tmp/ramas-session-inboxes/{agent_id}.json

    Call this periodically to receive messages from other agents.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    unread_only = args.get("unreadOnly", True)
    message_types = args.get("messageTypes")
    limit = args.get("limit", 100)
    mark_as_read = args.get("markAsRead", True)

    if not session_id:
        return {"error": "sessionId is required"}

    try:
        # Get inbox for this agent
        inbox = get_inbox_manager().get_inbox(STATE.agent_id)

        # Check if registered for this session
        if not inbox.is_registered(session_id):
            return {
                "error": f"Not registered for session {session_id}. Call join_session first.",
                "hint": "join_session automatically registers your inbox",
            }

        # Get messages from inbox
        messages = inbox.get_messages(
            session_id=session_id,
            unread_only=unread_only,
            message_types=message_types,
            limit=limit,
        )

        # Mark as read if requested
        if mark_as_read and messages:
            message_ids = [m.get("message_id") for m in messages if m.get("message_id")]
            marked_count = inbox.mark_as_read(session_id, message_ids)
        else:
            marked_count = 0

        # Separate by sender (filter out own messages)
        from_others = [m for m in messages if m.get("sender_id") != STATE.agent_id]
        from_self = [m for m in messages if m.get("sender_id") == STATE.agent_id]

        return {
            "success": True,
            "sessionId": session_id,
            "totalCount": len(messages),
            "fromOthers": len(from_others),
            "fromSelf": len(from_self),
            "markedAsRead": marked_count,
            "messages": from_others,  # Only return messages from others
            "unreadRemaining": inbox.get_unread_count(session_id),
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# -----------------------------------------------------------------------------
# Pattern C-003 v3: Instant Wake Handler
# -----------------------------------------------------------------------------

async def handle_wait_for_task(args: Dict) -> Dict:
    """
    BLOCKING wait for new messages using Redis Streams.

    PATTERN-C-003 v5: Fixed race condition - now checks PENDING signals first!

    How it works:
    1. MCP tool calls this function with a timeout
    2. FIRST: Check for any PENDING wake signals (non-blocking)
       - This catches signals sent BEFORE worker started waiting
    3. If no pending: Block on Redis XREAD for NEW signals
    4. When a signal is found, return immediately to Claude Code
    5. Claude Code then calls poll_session_messages to get the actual messages

    This solves the "circular wait" problem where:
    - Team Leader sends wake signal
    - Worker hasn't started wait_for_task() yet
    - Signal sits in stream unprocessed
    - Worker starts waiting with "$" (new only) → misses the signal!

    FIX: We now check stream from "0" (beginning) first, then block for new.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    timeout_ms = args.get("timeoutMs", 30000)  # Default 30 seconds

    if not session_id:
        return {"error": "sessionId is required"}

    try:
        # Get Redis registry (connects if needed)
        redis_registry = await get_redis_registry()

        if not redis_registry.is_connected:
            return {
                "success": False,
                "error": "Redis not available - use poll_session_messages instead",
                "fallback": "poll_session_messages",
            }

        logger.info(f"Worker {STATE.agent_id} waiting for task (timeout: {timeout_ms}ms)")

        # Wait for wake signal (v4: now checks pending first!)
        wake_result = await redis_registry.wait_for_wake(
            agent_id=STATE.agent_id,
            timeout_ms=timeout_ms,
        )

        if wake_result:
            # Wake signal received!
            event_type = wake_result.get("event", "unknown")
            task_id = wake_result.get("data", {}).get("task_id")
            task_title = wake_result.get("data", {}).get("task_title", "")

            logger.info(f"Worker {STATE.agent_id} woke up! Event: {event_type}, Task: {task_id}")

            return {
                "success": True,
                "woke": True,
                "event": event_type,
                "taskId": task_id,
                "taskTitle": task_title,
                "sessionId": wake_result.get("data", {}).get("session_id", session_id),
                "assignedBy": wake_result.get("data", {}).get("assigned_by"),
                "timestamp": wake_result.get("timestamp"),
                "hint": "Call poll_session_messages to read the task details",
            }
        else:
            # Timeout - no message
            logger.info(f"Worker {STATE.agent_id} wait timed out after {timeout_ms}ms")
            return {
                "success": True,
                "woke": False,
                "timedOut": True,
                "timeoutMs": timeout_ms,
                "hint": "No messages arrived within timeout. You can wait again or check inbox.",
            }

    except Exception as e:
        logger.error(f"wait_for_task error for {STATE.agent_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "fallback": "poll_session_messages",
        }


# -----------------------------------------------------------------------------
# Session State Handlers (3)
# -----------------------------------------------------------------------------

async def handle_get_session_status(args: Dict) -> Dict:
    """
    Get comprehensive session status.

    Includes participants, tasks, meetings, and metrics.
    """
    session_id = args.get("sessionId") or STATE.current_session_id

    if not session_id:
        return {"error": "sessionId is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        return session.get_status()

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_update_session_progress(args: Dict) -> Dict:
    """
    Update progress on current task in session.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    progress = args.get("progress", 0)
    message = args.get("message", "")

    if not session_id:
        return {"error": "sessionId is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        # Find current task for this agent
        participant = session.participants.get(STATE.agent_id)
        if not participant:
            return {"error": "Not a participant in this session"}

        current_task_id = participant.current_task
        if not current_task_id:
            return {"error": "No current task assigned"}

        # Broadcast progress update
        from .session_messages import SessionMessageFactory, ControlAction

        await session.broadcast(
            SessionMessageFactory.control(
                session_id=session_id,
                sender_id=STATE.agent_id,
                action=ControlAction.STATE_SYNC,
                data={
                    "type": "progress_update",
                    "task_id": current_task_id,
                    "progress": progress,
                    "message": message,
                },
            )
        )

        return {
            "success": True,
            "taskId": current_task_id,
            "progress": progress,
            "message": f"Progress updated to {progress}%",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_checkpoint_session(args: Dict) -> Dict:
    """
    Create a session checkpoint for recovery.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    checkpoint_name = args.get("checkpointName", f"checkpoint-{int(time.time())}")

    if not session_id:
        return {"error": "sessionId is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        # Create checkpoint via control message
        from .session_messages import SessionMessageFactory, ControlAction

        await session.broadcast(
            SessionMessageFactory.control(
                session_id=session_id,
                sender_id=STATE.agent_id,
                action=ControlAction.CHECKPOINT,
                data={"checkpoint_name": checkpoint_name},
            )
        )

        return {
            "success": True,
            "sessionId": session_id,
            "checkpointName": checkpoint_name,
            "state": session.get_status(),
            "message": f"Checkpoint '{checkpoint_name}' created",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# -----------------------------------------------------------------------------
# Task Coordination Handlers (4)
# -----------------------------------------------------------------------------

async def handle_assign_session_task(args: Dict) -> Dict:
    """
    Assign a task to a worker in the session.

    PATTERN-C-003 v4: Now includes automatic worker notification!

    After task is assigned:
    1. PRIMARY: Send Redis wake signal to unblock worker's wait_for_task()
    2. FALLBACK: If Redis fails, send iTerm2 interrupt to terminal

    This eliminates the deadlock where Team Leader waits for worker
    who is also waiting for notification.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    title = args.get("title")
    description = args.get("description")
    assign_to = args.get("assignTo")
    task_type = args.get("taskType", "general")
    priority = args.get("priority", "normal")
    dependencies = args.get("dependencies", [])

    if not session_id:
        return {"error": "sessionId is required"}
    if not title:
        return {"error": "title is required"}
    if not description:
        return {"error": "description is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        task = await session.assign_task(
            title=title,
            description=description,
            assigned_to=assign_to,
            assigned_by=STATE.agent_id,
            task_type=task_type,
            priority=priority,
            dependencies=dependencies,
        )

        # ─────────────────────────────────────────────────────────────
        # PATTERN-C-003 v4: Automatic Worker Notification
        # This is the KEY FIX for the circular wait problem!
        # ─────────────────────────────────────────────────────────────
        notification_result = None
        if assign_to:
            notification_result = await notify_worker(
                worker_id=assign_to,
                session_id=session_id,
                task_id=task.task_id,
                task_title=title,
                notification_type="task_assigned",
            )
            logger.info(
                f"Task {task.task_id} assigned to {assign_to}, "
                f"notification: {notification_result.get('method', 'none')}"
            )

        return {
            "success": True,
            "taskId": task.task_id,
            "title": title,
            "assignedTo": assign_to,
            "priority": priority,
            "message": f"Task assigned to {assign_to or 'unassigned'}",
            # NEW: Include notification info so Team Leader knows worker was notified
            "notification": notification_result if notification_result else None,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_report_task_progress(args: Dict) -> Dict:
    """
    Report progress on an assigned task.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    task_id = args.get("taskId")
    progress = args.get("progress", 0)
    status = args.get("status", "in_progress")
    notes = args.get("notes", "")

    if not session_id:
        return {"error": "sessionId is required"}
    if not task_id:
        return {"error": "taskId is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        task = session.tasks.get(task_id)
        if not task:
            return {"error": f"Task {task_id} not found"}

        # Update task
        from .session_state import TaskStatus
        task.status = TaskStatus.IN_PROGRESS
        if task.started_at is None:
            from datetime import datetime
            task.started_at = datetime.utcnow().isoformat()

        # Broadcast progress
        from .session_messages import SessionMessageFactory, ControlAction

        await session.broadcast(
            SessionMessageFactory.control(
                session_id=session_id,
                sender_id=STATE.agent_id,
                action=ControlAction.STATE_SYNC,
                data={
                    "type": "task_progress",
                    "task_id": task_id,
                    "progress": progress,
                    "status": status,
                    "notes": notes,
                },
            )
        )

        return {
            "success": True,
            "taskId": task_id,
            "progress": progress,
            "status": status,
            "message": f"Task progress: {progress}%",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_report_task_completion(args: Dict) -> Dict:
    """
    Report task completion with results.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    task_id = args.get("taskId")
    success = args.get("success", True)
    result = args.get("result", {})
    error = args.get("error")

    if not session_id:
        return {"error": "sessionId is required"}
    if not task_id:
        return {"error": "taskId is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        completed = await session.complete_task(
            task_id=task_id,
            result=result,
            success=success,
            error=error,
        )

        # ─────────────────────────────────────────────────────────
        # PATTERN-C-003 v6: Graceful fallback when task not found
        # Problem: Task stored in-memory, lost when MCP instance changes
        # Solution: Broadcast result directly, Team Leader still receives it!
        # ─────────────────────────────────────────────────────────
        fallback_used = False
        if not completed:
            logger.warning(
                f"v6 FALLBACK: Task {task_id} not found in session memory. "
                f"Broadcasting result directly to ensure Team Leader receives it."
            )
            fallback_used = True

            # Broadcast result via session_broadcast (bypasses task registry)
            import json
            result_payload = {
                "task_id": task_id,
                "success": success,
                "result": result,
                "error": error,
                "fallback": True,
                "reporter": STATE.agent_id,
            }

            broadcast_result = await handle_session_broadcast({
                "sessionId": session_id,
                "content": f"TASK_RESULT_FALLBACK:{json.dumps(result_payload)}",
                "messageType": "result",
            })

            if not broadcast_result.get("success"):
                logger.error(f"v6: Fallback broadcast also failed: {broadcast_result}")
                return {
                    "error": f"Task {task_id} not found and fallback broadcast failed",
                    "fallback_attempted": True,
                }

        # ─────────────────────────────────────────────────────────
        # PATTERN-C-003 v5: Wake all REGISTERED agents (especially Team Leader!)
        # When worker completes task, Team Leader needs to know immediately.
        # Uses inbox_manager to get actual registered agents.
        # ─────────────────────────────────────────────────────────
        inbox_manager = get_inbox_manager()
        registered_agents = inbox_manager.get_registered_agents_for_session(session_id)
        wake_results = {}
        for agent_id in registered_agents:
            if agent_id != STATE.agent_id:  # Don't wake ourselves
                wake_result = await notify_worker(
                    worker_id=agent_id,
                    session_id=session_id,
                    task_id=task_id,
                    task_title=f"Task completed by {STATE.agent_id}",
                    notification_type="task_completed",
                )
                wake_results[agent_id] = wake_result.get("method", "none")

        response = {
            "success": True,
            "taskId": task_id,
            "taskSuccess": success,
            "wakeSignals": wake_results,  # PATTERN-C-003 v5
            "message": f"Task {'completed successfully' if success else 'failed'}",
        }

        # PATTERN-C-003 v6: Add fallback info if used
        if fallback_used:
            response["warning"] = "Task not found in memory, result broadcasted via fallback"
            response["fallback_used"] = True

        return response

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_request_task_help(args: Dict) -> Dict:
    """
    Request help on a task from other agents.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    task_id = args.get("taskId")
    help_type = args.get("helpType", "clarification")
    description = args.get("description", "")

    if not session_id:
        return {"error": "sessionId is required"}
    if not description:
        return {"error": "description is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        # Broadcast help request
        from .session_messages import SessionMessageFactory

        message = SessionMessageFactory.chat(
            session_id=session_id,
            sender_id=STATE.agent_id,
            content=f"🆘 HELP REQUESTED ({help_type}): {description}",
        )

        if task_id:
            message.payload["task_id"] = task_id
        message.payload["help_type"] = help_type
        message.priority = 8  # High priority

        message_id = await session.broadcast(message)

        return {
            "success": True,
            "messageId": message_id,
            "helpType": help_type,
            "taskId": task_id,
            "message": f"Help request broadcast to session",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


# -----------------------------------------------------------------------------
# Meeting Handlers (3)
# -----------------------------------------------------------------------------

async def handle_start_meeting(args: Dict) -> Dict:
    """
    Start a meeting within the session.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    title = args.get("title")
    meeting_type = args.get("meetingType", "general")
    agenda = args.get("agenda", [])

    if not session_id:
        return {"error": "sessionId is required"}
    if not title:
        return {"error": "title is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        meeting = await session.start_meeting(
            title=title,
            meeting_type=meeting_type,
            agenda=agenda,
            started_by=STATE.agent_id,
        )

        return {
            "success": True,
            "meetingId": meeting.meeting_id,
            "title": title,
            "meetingType": meeting_type,
            "participants": list(meeting.participants),
            "agenda": agenda,
            "message": f"Meeting '{title}' started",
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_vote_on_proposal(args: Dict) -> Dict:
    """
    Cast a vote on a proposal during a meeting.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    meeting_id = args.get("meetingId")
    proposal_id = args.get("proposalId")
    vote = args.get("vote")
    reasoning = args.get("reasoning", "")

    if not session_id:
        return {"error": "sessionId is required"}
    if not meeting_id:
        return {"error": "meetingId is required"}
    if not proposal_id:
        return {"error": "proposalId is required"}
    if not vote:
        return {"error": "vote is required (approve/reject/abstain)"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        result = await session.vote(
            meeting_id=meeting_id,
            proposal_id=proposal_id,
            voter_id=STATE.agent_id,
            vote=vote,
            reasoning=reasoning,
        )

        return result

    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_conclude_meeting(args: Dict) -> Dict:
    """
    Conclude a meeting with summary and decisions.
    """
    session_id = args.get("sessionId") or STATE.current_session_id
    meeting_id = args.get("meetingId")
    summary = args.get("summary", "")
    decisions = args.get("decisions", [])
    action_items = args.get("actionItems", [])

    if not session_id:
        return {"error": "sessionId is required"}
    if not meeting_id:
        return {"error": "meetingId is required"}

    try:
        session = await _get_session(session_id)

        if not session:
            return {"error": f"Session {session_id} not found"}

        result = await session.conclude_meeting(
            meeting_id=meeting_id,
            summary=summary,
            decisions=decisions + [{"action_items": action_items}],
        )

        return result

    except Exception as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# Main
# =============================================================================

async def main():
    """Main entry point"""
    print("Starting RAMAS Python MCP Server...", file=sys.stderr)

    async with stdio_server() as (read_stream, write_stream):
        await mcp_server.run(
            read_stream,
            write_stream,
            mcp_server.create_initialization_options(),
        )


def run():
    """Run the MCP server"""
    asyncio.run(main())


if __name__ == "__main__":
    run()
