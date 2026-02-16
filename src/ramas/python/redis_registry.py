#!/usr/bin/env python3
"""
Redis Registry - PATTERN-C-003 v5 (Race Condition Fix)

Fast, reliable state management and wake signal system for multi-agent orchestration.

ARCHITECTURE:
┌─────────────────────────────────────────────────────────────────┐
│ Redis (Registry + Wake Signal)                                   │
├─────────────────────────────────────────────────────────────────┤
│ HASH: ramas:agents:{agent_id}                                    │
│   - window_id, session_id, status, last_seen                    │
│   - TTL: 30 min (auto-expire inactive agents)                   │
│                                                                  │
│ STREAMS: ramas:wake:{agent_id}                                   │
│   - Lightweight "task available" signals                         │
│   - XREAD BLOCK for instant notification                         │
│   - v5: Two-phase check (pending "0" + new "$")                 │
└─────────────────────────────────────────────────────────────────┘

USAGE:
    # In daemon.py - when message arrives
    registry = await get_redis_registry()
    await registry.publish_wake(agent_id, "new_message")

    # In MCP tool wait_for_task - blocks until wake signal
    result = await registry.wait_for_wake(agent_id, timeout_ms=30000)

VERSION HISTORY:
    v3 (2026-01-04) - Initial Redis Streams implementation
    v4 (2026-01-04) - Hybrid notification (Redis + Interrupt fallback)
    v5 (2026-01-04) - Two-phase wake check (pending + new signals)
                      Race condition fix: catches PENDING signals!

Author: Dr. Umit Kacar
Date: 2026-01-04
Pattern: PATTERN-C-003 v5
"""

import asyncio
import json
import time
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

# Try to import redis.asyncio (redis>=4.5.0)
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("redis.asyncio not available. Install with: uv pip install redis>=4.5.0")


# =============================================================================
# Configuration
# =============================================================================

REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_PASSWORD = "redis123"  # From docker-compose.yml
REDIS_DB = 0

# Key prefixes
PREFIX_AGENTS = "ramas:agents"      # Hash for agent state
PREFIX_WAKE = "ramas:wake"          # Stream for wake signals
PREFIX_SESSIONS = "ramas:sessions"  # Hash for session state

# TTL settings
AGENT_TTL_SECONDS = 1800  # 30 minutes - agents auto-expire if no heartbeat
WAKE_STREAM_MAXLEN = 100  # Keep last 100 wake signals per agent


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class AgentState:
    """Agent state stored in Redis"""
    agent_id: str
    window_id: Optional[str] = None
    session_id: Optional[str] = None
    status: str = "idle"  # idle, busy, polling
    last_seen: float = 0.0
    current_task_id: Optional[str] = None

    def to_dict(self) -> Dict[str, str]:
        """Convert to Redis-compatible dict (all values must be strings)"""
        return {
            "agent_id": self.agent_id,
            "window_id": self.window_id or "",
            "session_id": self.session_id or "",
            "status": self.status,
            "last_seen": str(self.last_seen),
            "current_task_id": self.current_task_id or "",
        }

    @classmethod
    def from_dict(cls, data: Dict[bytes, bytes]) -> "AgentState":
        """Create from Redis hash result (bytes keys/values)"""
        # Decode bytes to strings
        decoded = {k.decode(): v.decode() for k, v in data.items()}
        return cls(
            agent_id=decoded.get("agent_id", ""),
            window_id=decoded.get("window_id") or None,
            session_id=decoded.get("session_id") or None,
            status=decoded.get("status", "idle"),
            last_seen=float(decoded.get("last_seen", 0)),
            current_task_id=decoded.get("current_task_id") or None,
        )


# =============================================================================
# Redis Registry Class
# =============================================================================

class RedisRegistry:
    """
    Redis-based registry for agent state and wake signals.

    PATTERN-C-003 v3 Phase 2:
    - Replaces static JSON file registry
    - Auto-expires inactive agents via TTL
    - Provides instant wake signals via Redis Streams
    """

    def __init__(
        self,
        host: str = REDIS_HOST,
        port: int = REDIS_PORT,
        password: str = REDIS_PASSWORD,
        db: int = REDIS_DB,
    ):
        self.host = host
        self.port = port
        self.password = password
        self.db = db
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False

    async def connect(self) -> bool:
        """Connect to Redis"""
        if not REDIS_AVAILABLE:
            logger.error("redis.asyncio not available")
            return False

        try:
            self._redis = aioredis.Redis(
                host=self.host,
                port=self.port,
                password=self.password,
                db=self.db,
                decode_responses=False,  # We handle decoding manually
            )
            # Test connection
            await self._redis.ping()
            self._connected = True
            logger.info(f"Connected to Redis at {self.host}:{self.port}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._connected = False
            return False

    async def disconnect(self):
        """Disconnect from Redis"""
        if self._redis:
            await self._redis.close()
            self._connected = False
            logger.info("Disconnected from Redis")

    @property
    def is_connected(self) -> bool:
        return self._connected

    # =========================================================================
    # Agent State Management
    # =========================================================================

    async def register_agent(
        self,
        agent_id: str,
        window_id: Optional[str] = None,
        session_id: Optional[str] = None,
        status: str = "idle",
    ) -> bool:
        """
        Register or update an agent in Redis.

        Sets TTL so agent auto-expires if no heartbeat.
        """
        if not self._connected:
            return False

        try:
            key = f"{PREFIX_AGENTS}:{agent_id}"
            state = AgentState(
                agent_id=agent_id,
                window_id=window_id,
                session_id=session_id,
                status=status,
                last_seen=time.time(),
            )

            # Store as hash
            await self._redis.hset(key, mapping=state.to_dict())

            # Set TTL for auto-expiration
            await self._redis.expire(key, AGENT_TTL_SECONDS)

            logger.debug(f"Registered agent {agent_id} in Redis")
            return True

        except Exception as e:
            logger.error(f"Failed to register agent {agent_id}: {e}")
            return False

    async def get_agent(self, agent_id: str) -> Optional[AgentState]:
        """Get agent state from Redis"""
        if not self._connected:
            return None

        try:
            key = f"{PREFIX_AGENTS}:{agent_id}"
            data = await self._redis.hgetall(key)

            if not data:
                return None

            return AgentState.from_dict(data)

        except Exception as e:
            logger.error(f"Failed to get agent {agent_id}: {e}")
            return None

    async def update_agent_status(
        self,
        agent_id: str,
        status: str,
        current_task_id: Optional[str] = None,
    ) -> bool:
        """Update agent status and refresh TTL"""
        if not self._connected:
            return False

        try:
            key = f"{PREFIX_AGENTS}:{agent_id}"

            # Update specific fields
            updates = {
                "status": status,
                "last_seen": str(time.time()),
            }
            if current_task_id is not None:
                updates["current_task_id"] = current_task_id

            await self._redis.hset(key, mapping=updates)

            # Refresh TTL
            await self._redis.expire(key, AGENT_TTL_SECONDS)

            return True

        except Exception as e:
            logger.error(f"Failed to update agent {agent_id}: {e}")
            return False

    async def heartbeat(self, agent_id: str) -> bool:
        """Refresh agent's TTL (keep-alive)"""
        if not self._connected:
            return False

        try:
            key = f"{PREFIX_AGENTS}:{agent_id}"

            # Update last_seen
            await self._redis.hset(key, "last_seen", str(time.time()))

            # Refresh TTL
            await self._redis.expire(key, AGENT_TTL_SECONDS)

            return True

        except Exception as e:
            logger.error(f"Failed to heartbeat agent {agent_id}: {e}")
            return False

    async def list_agents(self) -> List[AgentState]:
        """List all registered agents"""
        if not self._connected:
            return []

        try:
            # Find all agent keys
            pattern = f"{PREFIX_AGENTS}:*"
            keys = []
            async for key in self._redis.scan_iter(match=pattern):
                keys.append(key)

            agents = []
            for key in keys:
                data = await self._redis.hgetall(key)
                if data:
                    agents.append(AgentState.from_dict(data))

            return agents

        except Exception as e:
            logger.error(f"Failed to list agents: {e}")
            return []

    # =========================================================================
    # Wake Signal System (Redis Streams)
    # =========================================================================

    async def publish_wake(
        self,
        agent_id: str,
        event_type: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Publish a wake signal to an agent.

        Uses Redis Streams (XADD) for reliable, ordered delivery.

        Args:
            agent_id: Target agent
            event_type: Type of event (new_message, task_assigned, all_complete)
            data: Optional additional data

        Returns:
            True if signal was published
        """
        if not self._connected:
            return False

        try:
            stream_key = f"{PREFIX_WAKE}:{agent_id}"

            # Build message
            message = {
                "event": event_type,
                "timestamp": str(time.time()),
                "data": json.dumps(data or {}),
            }

            # Add to stream with MAXLEN to prevent unbounded growth
            await self._redis.xadd(
                stream_key,
                message,
                maxlen=WAKE_STREAM_MAXLEN,
            )

            logger.debug(f"Published wake signal to {agent_id}: {event_type}")
            return True

        except Exception as e:
            logger.error(f"Failed to publish wake to {agent_id}: {e}")
            return False

    async def wait_for_wake(
        self,
        agent_id: str,
        timeout_ms: int = 30000,
    ) -> Optional[Dict[str, Any]]:
        """
        Block until a wake signal arrives for this agent.

        Uses Redis Streams (XREAD BLOCK) for efficient waiting.

        PATTERN-C-003 v5: Two-phase approach to solve race condition!
        1. FIRST: Check for PENDING signals (non-blocking read from "0")
        2. THEN: If no pending, block for NEW signals (blocking read with "$")

        This solves the race condition where Team Leader sends wake signal
        BEFORE worker starts waiting - the pending signal is now caught!

        Args:
            agent_id: Agent to wait for
            timeout_ms: Maximum wait time in milliseconds

        Returns:
            Wake signal data if received, None if timeout
        """
        if not self._connected:
            return None

        try:
            stream_key = f"{PREFIX_WAKE}:{agent_id}"

            # ─────────────────────────────────────────────────────────────
            # PATTERN-C-003 v5: PHASE 1 - Check for PENDING signals first!
            # This catches wake signals sent BEFORE worker started waiting.
            # ─────────────────────────────────────────────────────────────
            pending_result = await self._redis.xread(
                streams={stream_key: "0"},  # Read from beginning
                count=1,
                block=0,  # Non-blocking check
            )

            if pending_result:
                # Found a pending signal! Process it immediately
                stream_name, messages = pending_result[0]
                if messages:
                    message_id, fields = messages[0]

                    # Decode fields
                    decoded = {k.decode(): v.decode() for k, v in fields.items()}

                    logger.info(f"Found PENDING wake signal for {agent_id}: {decoded.get('event')}")

                    # Delete the processed message to avoid reprocessing
                    await self._redis.xdel(stream_key, message_id)

                    return {
                        "message_id": message_id.decode(),
                        "event": decoded.get("event", "unknown"),
                        "timestamp": float(decoded.get("timestamp", 0)),
                        "data": json.loads(decoded.get("data", "{}")),
                    }

            # ─────────────────────────────────────────────────────────────
            # PATTERN-C-003 v5: PHASE 2 - No pending, block for NEW signals
            # ─────────────────────────────────────────────────────────────
            result = await self._redis.xread(
                streams={stream_key: "$"},  # Only new messages from now
                block=timeout_ms,
                count=1,
            )

            if not result:
                # Timeout - no message
                return None

            # Parse result: [(stream_name, [(message_id, fields), ...])]
            stream_name, messages = result[0]
            if not messages:
                return None

            message_id, fields = messages[0]

            # Decode fields
            decoded = {k.decode(): v.decode() for k, v in fields.items()}

            # Delete the processed message to avoid reprocessing
            await self._redis.xdel(stream_key, message_id)

            return {
                "message_id": message_id.decode(),
                "event": decoded.get("event", "unknown"),
                "timestamp": float(decoded.get("timestamp", 0)),
                "data": json.loads(decoded.get("data", "{}")),
            }

        except Exception as e:
            logger.error(f"Failed to wait for wake on {agent_id}: {e}")
            return None

    async def clear_wake_stream(self, agent_id: str) -> bool:
        """
        Clear all wake signals for an agent before new session.

        PATTERN-C-003 v6: Stale Wake Signal Fix!

        This solves the problem where workers receive wake signals from OLD sessions
        and try to join sessions that no longer exist ("Session not found" error).

        Call this BEFORE creating a new session for each expected worker.

        Args:
            agent_id: Agent whose wake stream to clear (e.g., "worker-001")

        Returns:
            True if cleared successfully

        Example:
            # In create_session, clear all expected workers' wake streams
            for worker_id in ["worker-001", "worker-002"]:
                await registry.clear_wake_stream(worker_id)
        """
        if not self._connected:
            return False

        try:
            stream_key = f"{PREFIX_WAKE}:{agent_id}"
            deleted_count = await self._redis.delete(stream_key)

            if deleted_count > 0:
                logger.info(f"v6: Cleared stale wake stream for {agent_id}")

            return True

        except Exception as e:
            logger.error(f"Failed to clear wake stream for {agent_id}: {e}")
            return False

    async def clear_all_wake_streams(self, agent_ids: list) -> dict:
        """
        Clear wake streams for multiple agents at once.

        PATTERN-C-003 v6: Bulk cleanup before session creation.

        Args:
            agent_ids: List of agent IDs to clear (e.g., ["worker-001", "worker-002"])

        Returns:
            Dict with agent_id -> success status
        """
        results = {}
        for agent_id in agent_ids:
            results[agent_id] = await self.clear_wake_stream(agent_id)

        cleared = sum(1 for v in results.values() if v)
        logger.info(f"v6: Cleared {cleared}/{len(agent_ids)} wake streams")

        return results


# =============================================================================
# Singleton Instance
# =============================================================================

_redis_registry: Optional[RedisRegistry] = None


async def get_redis_registry() -> RedisRegistry:
    """Get singleton RedisRegistry instance (auto-connects)"""
    global _redis_registry

    if _redis_registry is None:
        _redis_registry = RedisRegistry()

    if not _redis_registry.is_connected:
        await _redis_registry.connect()

    return _redis_registry


def get_redis_registry_sync() -> RedisRegistry:
    """Get singleton without connecting (for use in sync code)"""
    global _redis_registry

    if _redis_registry is None:
        _redis_registry = RedisRegistry()

    return _redis_registry


# =============================================================================
# CLI Test
# =============================================================================

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    async def main():
        print("Testing RedisRegistry...")

        registry = await get_redis_registry()

        if not registry.is_connected:
            print("Failed to connect to Redis")
            print("Make sure Redis is running: docker compose up -d redis")
            return

        print("Connected to Redis!")

        # Test agent registration
        print("\n1. Registering test agent...")
        await registry.register_agent(
            agent_id="test-agent",
            window_id="win-123",
            session_id="session-abc",
            status="idle",
        )

        # Test get agent
        print("2. Getting agent state...")
        agent = await registry.get_agent("test-agent")
        if agent:
            print(f"   Agent: {agent.agent_id}, Status: {agent.status}")
        else:
            print("   Agent not found!")

        # Test wake signal
        print("\n3. Testing wake signal...")
        print("   Publishing wake signal...")
        await registry.publish_wake(
            agent_id="test-agent",
            event_type="new_message",
            data={"task_id": "task-123"},
        )

        # Test wait for wake (should return immediately since we just published)
        print("   Waiting for wake (with 1s timeout)...")
        wake = await registry.wait_for_wake(
            agent_id="test-agent",
            timeout_ms=1000,
            last_id="0",  # Read from beginning to get our test message
        )
        if wake:
            print(f"   Received wake: {wake['event']}")
        else:
            print("   No wake received (timeout)")

        # List all agents
        print("\n4. Listing all agents...")
        agents = await registry.list_agents()
        print(f"   Found {len(agents)} agents:")
        for a in agents:
            print(f"   - {a.agent_id}: {a.status}")

        # Cleanup
        await registry.disconnect()
        print("\n✅ Test complete!")

    asyncio.run(main())
