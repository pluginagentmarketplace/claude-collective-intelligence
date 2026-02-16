"""RAMAS Dashboard - Agents Router

GET /api/v1/agents - Returns all agent statuses from ramas-windows.json
"""

from fastapi import APIRouter, Response
from typing import List

from models.schemas import Agent, AgentListResponse
from services.json_reader import RamasJsonReader

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])

# Shared reader instance
reader = RamasJsonReader()


@router.get(
    "",
    response_model=AgentListResponse,
    summary="Get all agents",
    description="Returns all RAMAS agents with their current status"
)
async def get_agents(response: Response) -> AgentListResponse:
    """
    Get all agent statuses.

    Reads from /tmp/ramas-windows.json and returns:
    - Agent ID, name, status (green/red)
    - Role (team-leader, worker, monitor)
    - Window ID for iTerm2 reference
    - Last update timestamp
    """
    agents, changed = reader.get_agents()

    # Add warning header if file was missing
    if not agents:
        response.headers["X-Warning"] = "No agents found - JSON file may be missing"

    return AgentListResponse(
        agents=[Agent(**a) for a in agents],
        count=len(agents)
    )


@router.get(
    "/{agent_id}",
    response_model=Agent,
    summary="Get specific agent",
    description="Returns a specific agent by ID"
)
async def get_agent(agent_id: str, response: Response) -> Agent:
    """Get a specific agent by ID."""
    agents, _ = reader.get_agents()

    for agent in agents:
        if agent["id"] == agent_id:
            return Agent(**agent)

    # Agent not found - return empty with 404
    response.status_code = 404
    response.headers["X-Warning"] = f"Agent '{agent_id}' not found"
    return Agent(
        id=agent_id,
        name=agent_id,
        status="red",
        role="worker",
        windowId="unknown",
        lastUpdate=""
    )
