"""RAMAS Dashboard - WebSocket Connection Manager

Manages WebSocket connections with heartbeat and broadcast functionality.
Efficient real-time updates for the dashboard frontend.
"""

import asyncio
import json
from typing import List, Dict, Any, Set, Optional
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    WebSocket connection manager with broadcast and heartbeat support.

    Features:
    - Multiple client connections
    - JSON message broadcasting
    - Configurable heartbeat ping/pong
    - Connection statistics
    - Graceful disconnect handling
    """

    def __init__(self, heartbeat_interval: float = 5.0):
        self.active_connections: Set[WebSocket] = set()
        self._heartbeat_interval: float = heartbeat_interval
        self._ping_count: int = 0
        self._pong_count: int = 0
        self._last_ping_time: Optional[datetime] = None
        self._connection_errors: int = 0

    async def connect(self, websocket: WebSocket):
        """Accept and track a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

        # Send welcome message
        await self._send_json(websocket, {
            "type": "update",
            "entity": "connection",
            "action": "create",
            "data": {"message": "Connected to RAMAS Dashboard"},
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection from tracking."""
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def _send_json(self, websocket: WebSocket, data: Dict[str, Any]):
        """Send JSON data to a single WebSocket."""
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.error(f"Error sending to WebSocket: {e}")
            self.disconnect(websocket)

    async def broadcast(self, data: Dict[str, Any]):
        """Broadcast data to all connected clients."""
        if not self.active_connections:
            return

        message = {
            "type": "update",
            "entity": "bulk",
            "action": "update",
            "data": data,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        # Create tasks for parallel broadcast
        disconnected = set()

        for websocket in self.active_connections.copy():
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to broadcast to client: {e}")
                disconnected.add(websocket)

        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(ws)

    async def broadcast_entity_update(
        self,
        entity: str,
        action: str,
        data: Any
    ):
        """Broadcast an entity-specific update."""
        message = {
            "type": "update",
            "entity": entity,
            "action": action,
            "data": data,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        disconnected = set()

        for websocket in self.active_connections.copy():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.add(websocket)

        for ws in disconnected:
            self.disconnect(ws)

    async def send_ping(self):
        """Send heartbeat ping to all clients with statistics."""
        self._ping_count += 1
        self._last_ping_time = datetime.utcnow()

        message = {
            "type": "ping",
            "pingId": self._ping_count,
            "timestamp": self._last_ping_time.isoformat() + "Z"
        }

        disconnected = set()

        for websocket in self.active_connections.copy():
            try:
                await websocket.send_json(message)
            except Exception:
                self._connection_errors += 1
                disconnected.add(websocket)

        for ws in disconnected:
            self.disconnect(ws)

        logger.debug(f"Ping #{self._ping_count} sent to {len(self.active_connections)} clients")

    async def handle_client_message(self, websocket: WebSocket, data: Dict[str, Any]):
        """Handle incoming messages from clients."""
        msg_type = data.get("type", "")

        if msg_type == "pong":
            self._pong_count += 1
            ping_id = data.get("pingId", "unknown")
            logger.debug(f"Received pong for ping #{ping_id} from client")
        elif msg_type == "ping":
            # Client-initiated ping - respond with pong
            await self._send_json(websocket, {
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            })
        elif msg_type == "subscribe":
            # Future: handle subscription to specific entities
            logger.info(f"Client subscribed to: {data.get('entities', [])}")
        else:
            logger.debug(f"Received unknown message type: {msg_type}")

    @property
    def connection_count(self) -> int:
        """Return the number of active connections."""
        return len(self.active_connections)

    def get_status(self) -> Dict[str, Any]:
        """Get detailed connection manager status with heartbeat statistics."""
        return {
            "active_connections": self.connection_count,
            "heartbeat_interval": self._heartbeat_interval,
            "stats": {
                "pings_sent": self._ping_count,
                "pongs_received": self._pong_count,
                "connection_errors": self._connection_errors,
                "last_ping": self._last_ping_time.isoformat() + "Z" if self._last_ping_time else None,
                "health_ratio": round(self._pong_count / max(self._ping_count, 1), 2)
            }
        }

    def set_heartbeat_interval(self, interval: float):
        """Update heartbeat interval (in seconds)."""
        if 1.0 <= interval <= 60.0:
            self._heartbeat_interval = interval
            logger.info(f"Heartbeat interval updated to {interval}s")
        else:
            raise ValueError("Heartbeat interval must be between 1 and 60 seconds")
