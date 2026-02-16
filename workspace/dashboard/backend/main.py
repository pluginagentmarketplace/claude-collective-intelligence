"""RAMAS Dashboard - FastAPI Backend

Real-time dashboard backend for monitoring RAMAS multi-agent system.

Features:
- REST API endpoints for agents, sessions, messages
- WebSocket for real-time updates (1s polling interval)
- Efficient JSON file reading with mtime change detection
- CORS configured for frontend development

Usage:
    uvicorn main:app --reload --port 8000

Endpoints:
    GET  /api/v1/agents              - All agent statuses
    GET  /api/v1/agents/{id}         - Specific agent
    GET  /api/v1/sessions            - All sessions
    GET  /api/v1/sessions/{id}       - Specific session
    GET  /api/v1/messages/{agent_id} - Agent inbox messages
    GET  /api/v1/health              - Server health check
    WS   /ws/realtime                - Real-time updates
"""

import asyncio
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from routers import agents_router, sessions_router, messages_router
from services.json_reader import RamasJsonReader
from services.websocket import ConnectionManager
from models.schemas import HealthResponse, ErrorResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Global instances
manager = ConnectionManager()
reader = RamasJsonReader()
start_time = time.time()

# Background task handle
broadcast_task = None


async def broadcast_updates():
    """Background task to broadcast updates to WebSocket clients."""
    logger.info("Starting WebSocket broadcast loop")

    while True:
        try:
            if manager.connection_count > 0:
                data = reader.get_all_data()

                # Only broadcast if there are changes
                if data["agents_changed"] or data["sessions_changed"]:
                    await manager.broadcast(data)

                # Send periodic heartbeat
                await manager.send_ping()

            await asyncio.sleep(1)  # 1 second polling interval

        except asyncio.CancelledError:
            logger.info("Broadcast loop cancelled")
            break
        except Exception as e:
            logger.error(f"Broadcast error: {e}")
            await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - startup/shutdown events."""
    global broadcast_task

    # Startup
    logger.info("RAMAS Dashboard Backend starting...")
    broadcast_task = asyncio.create_task(broadcast_updates())

    yield

    # Shutdown
    logger.info("RAMAS Dashboard Backend shutting down...")
    if broadcast_task:
        broadcast_task.cancel()
        try:
            await broadcast_task
        except asyncio.CancelledError:
            pass


# Create FastAPI app
app = FastAPI(
    title="RAMAS Dashboard API",
    description="Real-time monitoring API for RAMAS multi-agent orchestration system",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # React default
        "http://localhost:3001",   # Vite fallback port
        "http://localhost:3002",   # Vite fallback port 2
        "http://localhost:5173",   # Vite default
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agents_router)
app.include_router(sessions_router)
app.include_router(messages_router)


# =============================================================================
# Health Check Endpoint
# =============================================================================

@app.get(
    "/api/v1/health",
    response_model=HealthResponse,
    tags=["health"],
    summary="Health check",
    description="Returns server health status and uptime"
)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        uptime=time.time() - start_time,
        version="1.0.0"
    )


# =============================================================================
# WebSocket Endpoint
# =============================================================================

@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time dashboard updates.

    Message Types:
    - update: Data changes (agents, sessions, messages)
    - ping/pong: Heartbeat for connection health

    The server broadcasts updates every 1 second when changes are detected.
    """
    await manager.connect(websocket)

    try:
        while True:
            # Wait for client messages (pong, subscribe, etc.)
            data = await websocket.receive_json()
            await manager.handle_client_message(websocket, data)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# =============================================================================
# Root Endpoint
# =============================================================================

@app.get("/", tags=["root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": "RAMAS Dashboard API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
        "websocket": "/ws/realtime",
        "endpoints": {
            "agents": "/api/v1/agents",
            "sessions": "/api/v1/sessions",
            "messages": "/api/v1/messages/{agent_id}"
        }
    }


# =============================================================================
# Error Handlers
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            code="INTERNAL_ERROR",
            message=str(exc)
        ).model_dump()
    )


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
