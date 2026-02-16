"""RAMAS Dashboard - Messages Router

GET /api/v1/messages/{agent_id} - Returns messages from an agent's inbox
"""

from fastapi import APIRouter, Response, Query
from typing import List, Optional
import math

from models.schemas import Message, MessageListResponse, PaginationMeta
from services.json_reader import RamasJsonReader

router = APIRouter(prefix="/api/v1/messages", tags=["messages"])

# Shared reader instance
reader = RamasJsonReader()


@router.get(
    "/{agent_id}",
    response_model=MessageListResponse,
    summary="Get agent messages",
    description="Returns messages from an agent's inbox with optional pagination"
)
async def get_messages(
    agent_id: str,
    response: Response,
    page: Optional[int] = Query(default=None, ge=1, description="Page number (1-indexed). If provided, enables pagination."),
    limit: int = Query(default=20, ge=1, le=200, description="Messages per page (default 20)")
) -> MessageListResponse:
    """
    Get messages from an agent's inbox.

    Reads from /tmp/ramas-session-inboxes/{agent_id}.json and returns:
    - Message ID, sender, type
    - Content (extracted from payload)
    - Timestamp

    Messages are sorted by timestamp (newest first).

    **Pagination:** Add `?page=1&limit=20` for paginated results.
    """
    # Get all messages first (for total count when paginating)
    all_messages, changed = reader.get_messages(agent_id, limit=1000)
    total = len(all_messages)

    # Add warning header if inbox was empty/missing
    if not all_messages:
        response.headers["X-Warning"] = f"No messages found for agent '{agent_id}'"

    # Handle pagination
    pagination = None
    if page is not None:
        total_pages = math.ceil(total / limit) if total > 0 else 1
        offset = (page - 1) * limit
        messages = all_messages[offset:offset + limit]

        pagination = PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            totalPages=total_pages,
            hasNext=page < total_pages,
            hasPrev=page > 1
        )
    else:
        # No pagination - return up to limit
        messages = all_messages[:limit]

    return MessageListResponse(
        agentId=agent_id,
        messages=[Message(**m) for m in messages],
        count=len(messages),
        pagination=pagination
    )
