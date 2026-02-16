"""
Type definitions for AI Agent SDK
"""

from typing import Any, Dict, List, Optional, Literal
from dataclasses import dataclass
from datetime import datetime

# Agent types
AgentType = Literal[
    "ORCHESTRATOR", "WORKER", "BRAINSTORMER", "SPECIALIST", "REVIEWER", "MONITOR", "CUSTOM"
]

# Agent status
AgentStatus = Literal[
    "INITIALIZING", "READY", "BUSY", "IDLE", "PAUSED", "DEGRADED", "OFFLINE", "ERROR"
]

# Task status
TaskStatus = Literal[
    "PENDING",
    "QUEUED",
    "ASSIGNED",
    "IN_PROGRESS",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "TIMED_OUT",
    "PAUSED",
    "RETRYING",
]

# Task priority
TaskPriority = Literal["LOW", "NORMAL", "HIGH", "CRITICAL"]

# Task result status
TaskResultStatus = Literal["SUCCESS", "FAILURE", "PARTIAL", "ERROR"]


@dataclass
class Agent:
    """Agent model"""

    id: str
    name: str
    type: AgentType
    status: AgentStatus
    capabilities: List[str]
    created_at: str
    updated_at: str


@dataclass
class AgentCreateParams:
    """Parameters for creating an agent"""

    name: str
    type: AgentType
    capabilities: List[str]
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TaskResult:
    """Task result"""

    task_id: str
    status: TaskResultStatus
    output: Optional[Any] = None
    completed_at: Optional[str] = None


@dataclass
class TaskError:
    """Task error"""

    code: str
    message: str
    details: Optional[Any] = None
    timestamp: Optional[str] = None
    retryable: bool = False


@dataclass
class Task:
    """Task model"""

    id: str
    name: str
    type: str
    status: TaskStatus
    priority: TaskPriority
    payload: Any
    created_at: str
    updated_at: str
    result: Optional[TaskResult] = None
    error: Optional[TaskError] = None
    assigned_agent_id: Optional[str] = None


@dataclass
class TaskSubmitParams:
    """Parameters for submitting a task"""

    name: str
    type: str
    payload: Any
    description: Optional[str] = None
    priority: TaskPriority = "NORMAL"
    config: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class HealthCheckResult:
    """Health check result"""

    status: Literal["UP", "DOWN", "DEGRADED"]
    response_time: Optional[int] = None
    details: Optional[Any] = None


@dataclass
class HealthStatus:
    """Health status"""

    status: Literal["UP", "DOWN", "DEGRADED"]
    timestamp: str
    checks: Dict[str, HealthCheckResult]


@dataclass
class ClientMetrics:
    """Client metrics"""

    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_errors: int = 0
    average_latency: float = 0.0
    success_rate: float = 0.0
    error_rate: float = 0.0
    last_error: Optional[Dict[str, str]] = None
