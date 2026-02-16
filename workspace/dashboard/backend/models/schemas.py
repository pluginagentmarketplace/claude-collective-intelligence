"""RAMAS Dashboard - Pydantic Schemas

Shared TypeScript-compatible interfaces for Backend/Frontend integration.
Matches the agreed API contract from brainstorm session.
"""

from datetime import datetime
from typing import List, Literal, Optional, Any
from pydantic import BaseModel, Field


# =============================================================================
# Core Entity Models (Match TypeScript interfaces)
# =============================================================================

class Agent(BaseModel):
    """Agent status model - maps to /tmp/ramas-windows.json"""
    id: str = Field(..., description="Agent identifier (e.g., 'team-leader', 'worker-001')")
    name: str = Field(..., description="Display name")
    status: Literal["green", "red"] = Field(..., description="Agent status indicator")
    role: Literal["team-leader", "worker", "monitor"] = Field(..., description="Agent role")
    windowId: str = Field(..., description="iTerm2 window/session ID")
    lastUpdate: str = Field(..., description="ISO8601 timestamp of last update")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "worker-001",
                "name": "worker-001",
                "status": "green",
                "role": "worker",
                "windowId": "pty-12345",
                "lastUpdate": "2026-01-08T21:30:00Z"
            }
        }


class Session(BaseModel):
    """Session info model - maps to /tmp/ramas-session-registry.json"""
    id: str = Field(..., description="Session identifier")
    name: str = Field(..., description="Session name/title")
    state: Literal["active", "closed", "waiting", "initializing"] = Field(..., description="Session state")
    participants: List[str] = Field(default_factory=list, description="List of participant agent IDs")
    createdAt: str = Field(..., description="ISO8601 timestamp of creation")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "session-1767907358-74458436",
                "name": "RAMAS Dashboard Development",
                "state": "active",
                "participants": ["team-leader", "worker-001", "worker-002"],
                "createdAt": "2026-01-08T21:22:38Z"
            }
        }


class Message(BaseModel):
    """Message model - maps to /tmp/ramas-session-inboxes/*.json"""
    id: str = Field(..., description="Message identifier")
    senderId: str = Field(..., description="Sender agent ID")
    type: str = Field(..., description="Message type (task, status, announcement, etc.)")
    content: str = Field(..., description="Message content")
    timestamp: str = Field(..., description="ISO8601 timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "msg-abc123",
                "senderId": "team-leader",
                "type": "announcement",
                "content": "Brainstorm session started!",
                "timestamp": "2026-01-08T21:23:49Z"
            }
        }


# =============================================================================
# API Response Models
# =============================================================================

class AgentListResponse(BaseModel):
    """Response for GET /api/v1/agents"""
    agents: List[Agent] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    count: int = Field(default=0)


class SessionListResponse(BaseModel):
    """Response for GET /api/v1/sessions"""
    sessions: List[Session] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    count: int = Field(default=0)


class SessionHistoryResponse(BaseModel):
    """Response for GET /api/v1/sessions/history"""
    active: List[Session] = Field(default_factory=list, description="Currently active sessions")
    closed: List[Session] = Field(default_factory=list, description="Previously closed sessions")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    activeCount: int = Field(default=0)
    closedCount: int = Field(default=0)
    totalCount: int = Field(default=0)


class PaginationMeta(BaseModel):
    """Pagination metadata for paginated responses"""
    page: int = Field(default=1, description="Current page number (1-indexed)")
    limit: int = Field(default=20, description="Items per page")
    total: int = Field(default=0, description="Total items available")
    totalPages: int = Field(default=0, description="Total number of pages")
    hasNext: bool = Field(default=False, description="Whether there's a next page")
    hasPrev: bool = Field(default=False, description="Whether there's a previous page")


class MessageListResponse(BaseModel):
    """Response for GET /api/v1/messages/{agent_id}"""
    agentId: str
    messages: List[Message] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    count: int = Field(default=0)
    pagination: Optional[PaginationMeta] = Field(None, description="Pagination info when page param used")


class HealthResponse(BaseModel):
    """Response for GET /api/v1/health"""
    status: Literal["ok", "degraded", "error"] = "ok"
    uptime: float = Field(..., description="Server uptime in seconds")
    version: str = "1.0.0"
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


class ErrorResponse(BaseModel):
    """Standard error response"""
    error: bool = True
    code: str = Field(..., description="Error code (FILE_NOT_FOUND, PARSE_ERROR, etc.)")
    message: str = Field(..., description="Human-readable error message")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")


# =============================================================================
# WebSocket Models
# =============================================================================

class WebSocketMessage(BaseModel):
    """WebSocket message format - matches agreed contract"""
    type: Literal["update", "ping", "pong", "error"] = Field(..., description="Message type")
    entity: Optional[Literal["agent", "session", "message"]] = Field(None, description="Entity type for updates")
    action: Optional[Literal["create", "update", "delete"]] = Field(None, description="Action type")
    data: Optional[Any] = Field(None, description="Payload data")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    class Config:
        json_schema_extra = {
            "example": {
                "type": "update",
                "entity": "agent",
                "action": "update",
                "data": {"id": "worker-001", "status": "green"},
                "timestamp": "2026-01-08T21:30:00Z"
            }
        }
