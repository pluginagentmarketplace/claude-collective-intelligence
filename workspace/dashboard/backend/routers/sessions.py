"""RAMAS Dashboard - Sessions Router

GET /api/v1/sessions - Returns all active sessions from ramas-session-registry.json
"""

from fastapi import APIRouter, Response
from typing import List, Optional

from models.schemas import Session, SessionListResponse, SessionHistoryResponse
from services.json_reader import RamasJsonReader

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])

# Shared reader instance
reader = RamasJsonReader()


@router.get(
    "",
    response_model=SessionListResponse,
    summary="Get all sessions",
    description="Returns all RAMAS sessions from the registry"
)
async def get_sessions(response: Response) -> SessionListResponse:
    """
    Get all sessions.

    Reads from /tmp/ramas-session-registry.json and returns:
    - Session ID and name
    - State (active, closed, waiting, initializing)
    - Participant list
    - Creation timestamp
    """
    sessions, changed = reader.get_sessions()

    # Add warning header if file was missing
    if not sessions:
        response.headers["X-Warning"] = "No sessions found - JSON file may be missing"

    return SessionListResponse(
        sessions=[Session(**s) for s in sessions],
        count=len(sessions)
    )


@router.get(
    "/history",
    response_model=SessionHistoryResponse,
    summary="Get session history",
    description="Returns both active and closed sessions with statistics"
)
async def get_session_history(response: Response) -> SessionHistoryResponse:
    """
    Get session history including closed sessions.

    Returns:
    - active: Currently running sessions
    - closed: Previously ended sessions
    - Statistics (counts)
    """
    all_sessions, _ = reader.get_sessions()

    active = []
    closed = []

    for session in all_sessions:
        state = session.get("state", "")
        if state in ("closed", "terminated"):
            closed.append(Session(**session))
        else:
            active.append(Session(**session))

    # Sort closed by createdAt (newest first)
    closed.sort(key=lambda s: s.createdAt, reverse=True)

    return SessionHistoryResponse(
        active=active,
        closed=closed,
        activeCount=len(active),
        closedCount=len(closed),
        totalCount=len(all_sessions)
    )


@router.get(
    "/current",
    response_model=Optional[Session],
    summary="Get current/recent session",
    description="Returns the most recent session (active or closed) for dashboard display"
)
async def get_current_session(response: Response) -> Optional[Session]:
    """
    Get the most recent session regardless of state.

    This endpoint ensures the dashboard shows "Complete" for closed
    sessions instead of "No active session". Returns the session with
    the latest creation timestamp.

    Returns:
        The most recent session, or None if no sessions exist
    """
    session = reader.get_current_session()

    if not session:
        response.headers["X-Warning"] = "No sessions found"
        return None

    return Session(**session)


@router.get(
    "/{session_id}",
    response_model=Session,
    summary="Get specific session",
    description="Returns a specific session by ID"
)
async def get_session(session_id: str, response: Response) -> Session:
    """Get a specific session by ID."""
    sessions, _ = reader.get_sessions()

    for session in sessions:
        if session["id"] == session_id:
            return Session(**session)

    # Session not found - return 404
    response.status_code = 404
    response.headers["X-Warning"] = f"Session '{session_id}' not found"
    return Session(
        id=session_id,
        name="Unknown",
        state="closed",
        participants=[],
        createdAt=""
    )
