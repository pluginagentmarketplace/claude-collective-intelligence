#!/usr/bin/env python3
"""
RAMAS Status Daemon (Python)

Rewrite from: status-daemon.js (450 lines)

Listens to RabbitMQ and controls iTerm2 terminals.
Runs as a background service.

Key improvements over JS version:
- Direct iTerm2 Python API (no osascript subprocess)
- Unified async/await (asyncio + aio-pika + iterm2)
- Better error handling with Python exceptions
- Type hints throughout

Usage:
    python -m src.ramas.python.daemon
    RABBITMQ_URL=amqp://... python daemon.py

Author: Dr. Umit Kacar
Date: 2026-01-01
Platform: macOS only (requires iTerm2 with Python API enabled)
"""

import os
import sys
import json
import asyncio
import signal
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field

# Import RAMAS modules
from . import controller
from . import registry
from . import exchanges

# Pattern C: Session-based modules
from .session_manager import SessionManager
from .session_state import SessionState, SessionEvent
from .session_messages import MessageType
from .session_inbox import get_inbox_manager, InboxManager

# Pattern C-003: Autonomous Multi-Agent Orchestration
from .agent_trigger import AgentTrigger, get_agent_trigger
from .workflow_engine import WorkflowEngine, get_workflow_engine

# Pattern C-003 v3: Redis Registry for instant wake signals
from .redis_registry import RedisRegistry, get_redis_registry

# Third-party
try:
    import aio_pika
    from aio_pika.abc import AbstractIncomingMessage
except ImportError:
    print("Error: aio-pika not installed. Run: uv pip install aio-pika")
    sys.exit(1)

try:
    import iterm2
except ImportError:
    print("Error: iTerm2 Python API not installed. Run: uv pip install iterm2")
    sys.exit(1)


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class DaemonConfig:
    """Daemon configuration"""
    rabbitmq_url: str = field(
        default_factory=lambda: os.environ.get(
            "RABBITMQ_URL",
            "amqp://admin:rabbitmq123@localhost:5672"
        )
    )
    reconnect_delay: int = 5  # seconds
    max_reconnect_attempts: int = 10
    heartbeat: int = 30  # seconds

    # Pattern C: Session settings
    enable_sessions: bool = True
    session_cleanup_interval: int = 60  # seconds
    session_heartbeat_check_interval: int = 5  # seconds
    session_heartbeat_timeout: int = 15  # seconds

    # Pattern C-003: Autonomous Multi-Agent Orchestration settings
    auto_trigger_enabled: bool = True  # Enable automatic agent triggering
    trigger_delay: float = 0.5  # Delay between multiple triggers (seconds)
    command_delay: float = 1.0  # Delay before sending Enter key (seconds)
    queue_check_interval: float = 1.0  # How often to check pending trigger queue (seconds)

    # Pattern C-003 v3: Redis settings for instant wake signals
    redis_enabled: bool = True  # Enable Redis wake signals
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = "redis123"  # From docker-compose.yml


CONFIG = DaemonConfig()


# =============================================================================
# Pending Message Queue
# =============================================================================

@dataclass
class PendingMessage:
    """Message queued for a busy worker"""
    message: str
    priority: str
    timestamp: int
    from_agent: Optional[str] = None


# =============================================================================
# Status Daemon Class
# =============================================================================

class StatusDaemon:
    """
    RAMAS Status Daemon

    Listens to RabbitMQ for:
    - Status changes (green/red)
    - Interrupt messages

    Controls iTerm2 via Python API:
    - Updates terminal titles
    - Sends ESC/Ctrl+C
    - Types messages
    """

    def __init__(self, config: Optional[DaemonConfig] = None):
        self.config = config or CONFIG

        # RabbitMQ
        self.connection: Optional[aio_pika.abc.AbstractConnection] = None
        self.channel: Optional[aio_pika.abc.AbstractChannel] = None

        # iTerm2
        self.iterm_connection: Optional[iterm2.Connection] = None
        self.iterm_app: Optional[iterm2.App] = None

        # State
        self.is_running = False
        self.reconnect_attempts = 0

        # Pending messages for busy (red) workers
        # { worker_id: [PendingMessage, ...] }
        self.pending_messages: Dict[str, List[PendingMessage]] = {}

        # Pattern C: Session Manager
        self.session_manager: Optional[SessionManager] = None
        self.session_cleanup_task: Optional[asyncio.Task] = None
        self.session_heartbeat_task: Optional[asyncio.Task] = None

        # Pattern C: Session Inbox Manager (File-based message store)
        # Solves MCP Stateless Connection problem - PATTERN-C-001
        self.inbox_manager: InboxManager = get_inbox_manager()

        # Pattern C-003: Autonomous Multi-Agent Orchestration
        # Enables zero-intervention workflow execution
        self.agent_trigger: Optional[AgentTrigger] = None
        self.workflow_engine: Optional[WorkflowEngine] = None
        self.trigger_queue_task: Optional[asyncio.Task] = None

        # Pattern C-003 v3: Redis Registry for instant wake signals
        # Replaces 5s polling with <100ms instant notification
        self.redis_registry: Optional[RedisRegistry] = None

    # =========================================================================
    # Startup / Shutdown
    # =========================================================================

    async def start(self):
        """Start the daemon"""
        print("═" * 67)
        print("                    RAMAS Status Daemon (Python)")
        print("═" * 67)
        print()

        # Platform check
        if not controller.is_macos():
            print("❌ RAMAS Daemon only runs on macOS!")
            sys.exit(1)

        try:
            # Connect to RabbitMQ
            await self.connect_rabbitmq()

            # Connect to iTerm2
            await self.connect_iterm2()

            # Setup infrastructure
            await self.setup_infrastructure()

            # Pattern C: Initialize session manager
            if self.config.enable_sessions:
                await self.setup_session_manager()

            # Pattern C-003: Initialize autonomous triggering
            if self.config.auto_trigger_enabled:
                await self.setup_auto_trigger()

            # Pattern C-003 v3: Connect to Redis for instant wake signals
            if self.config.redis_enabled:
                await self.connect_redis()

            # Start listeners
            await self.start_listeners()

            # Pattern C: Start session background tasks
            if self.config.enable_sessions:
                await self.start_session_tasks()

            self.is_running = True
            print()
            print("✅ RAMAS Daemon started successfully!")
            print()
            print("Listening for:")
            print(f"  - Status changes ({exchanges.EXCHANGES.STATUS.name})")
            print(f"  - Interrupt commands ({exchanges.EXCHANGES.INTERRUPT.name})")
            if self.config.enable_sessions:
                print("  - Session messages (Pattern C)")
            if self.config.auto_trigger_enabled:
                print("  - Autonomous triggers (Pattern C-003) 🤖")
            if self.redis_registry and self.redis_registry.is_connected:
                print("  - Redis wake signals (Pattern C-003 v3) ⚡")
            print()
            print(f"Registry: {registry.REGISTRY_PATH}")
            if self.redis_registry and self.redis_registry.is_connected:
                print(f"Redis: {self.config.redis_host}:{self.config.redis_port}")
            print()
            print("Stop with: Ctrl+C")
            print("═" * 67)

            # Setup signal handlers
            self.setup_signal_handlers()

            # Keep running
            while self.is_running:
                await asyncio.sleep(1)

        except Exception as e:
            print(f"❌ Daemon startup error: {e}")
            await self.shutdown()
            sys.exit(1)

    async def shutdown(self):
        """Graceful shutdown"""
        print()
        print("Shutting down daemon...")
        self.is_running = False

        try:
            # Cancel session background tasks
            if self.session_cleanup_task:
                self.session_cleanup_task.cancel()
            if self.session_heartbeat_task:
                self.session_heartbeat_task.cancel()

            # Pattern C-003: Stop trigger queue processor
            if self.trigger_queue_task:
                self.trigger_queue_task.cancel()
            if self.agent_trigger:
                await self.agent_trigger.stop_queue_processor()

            # Disconnect session manager
            if self.session_manager:
                await self.session_manager.disconnect()

            # Pattern C-003 v3: Disconnect Redis
            if self.redis_registry:
                await self.redis_registry.disconnect()

            if self.channel:
                await self.channel.close()
            if self.connection:
                await self.connection.close()
            if self.iterm_connection:
                await self.iterm_connection.async_disconnect()

            print("✅ Clean shutdown complete")
        except Exception as e:
            print(f"❌ Shutdown error: {e}")

    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        loop = asyncio.get_event_loop()

        def signal_handler(sig):
            print(f"\n{sig.name} received. Shutting down...")
            asyncio.create_task(self.shutdown())

        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, signal_handler, sig)

    # =========================================================================
    # RabbitMQ Connection
    # =========================================================================

    async def connect_rabbitmq(self):
        """Connect to RabbitMQ"""
        print("📡 Connecting to RabbitMQ...")
        masked_url = self.config.rabbitmq_url.replace(
            ":rabbitmq123@", ":****@"
        )
        print(f"   URL: {masked_url}")

        self.connection = await aio_pika.connect_robust(
            self.config.rabbitmq_url,
            heartbeat=self.config.heartbeat,
        )

        # Handle connection loss
        self.connection.close_callbacks.add(self.on_connection_closed)

        self.channel = await self.connection.channel()
        await self.channel.set_qos(prefetch_count=10)

        print("✅ RabbitMQ connected")

    def on_connection_closed(self, connection, reason):
        """Handle RabbitMQ connection loss"""
        if not self.is_running:
            return

        print(f"⚠️  RabbitMQ connection closed: {reason}")
        asyncio.create_task(self.handle_reconnect())

    async def handle_reconnect(self):
        """Attempt to reconnect to RabbitMQ"""
        self.reconnect_attempts += 1

        if self.reconnect_attempts > self.config.max_reconnect_attempts:
            print("❌ Max reconnect attempts exceeded. Shutting down.")
            await self.shutdown()
            return

        print(f"🔄 Reconnecting... ({self.reconnect_attempts}/{self.config.max_reconnect_attempts})")
        await asyncio.sleep(self.config.reconnect_delay)

        try:
            await self.connect_rabbitmq()
            await self.setup_infrastructure()
            await self.start_listeners()
            self.reconnect_attempts = 0
            print("✅ Reconnected!")
        except Exception as e:
            print(f"❌ Reconnect failed: {e}")
            await self.handle_reconnect()

    # =========================================================================
    # Redis Connection (Pattern C-003 v3)
    # =========================================================================

    async def connect_redis(self):
        """
        Connect to Redis for instant wake signals.

        PATTERN-C-003 v3: Redis provides:
        - Agent state registry (with TTL for auto-expiration)
        - Wake signal streams (XREAD BLOCK for instant notification)
        """
        print("🔴 Connecting to Redis...")
        print(f"   Host: {self.config.redis_host}:{self.config.redis_port}")

        try:
            self.redis_registry = RedisRegistry(
                host=self.config.redis_host,
                port=self.config.redis_port,
                password=self.config.redis_password,
            )

            connected = await self.redis_registry.connect()

            if connected:
                print("✅ Redis connected (instant wake signals enabled)")
            else:
                print("⚠️  Redis not available - falling back to polling")
                self.redis_registry = None

        except Exception as e:
            print(f"⚠️  Redis connection failed: {e}")
            print("   Daemon will run but instant wake signals won't work.")
            self.redis_registry = None

    # =========================================================================
    # iTerm2 Connection
    # =========================================================================

    async def connect_iterm2(self):
        """Connect to iTerm2"""
        print("🖥️  Connecting to iTerm2...")

        try:
            self.iterm_connection = await iterm2.Connection.async_create()
            self.iterm_app = await iterm2.async_get_app(self.iterm_connection)
            print("✅ iTerm2 connected")
        except Exception as e:
            print(f"⚠️  iTerm2 not available: {e}")
            print("   Daemon will run but commands won't execute.")
            self.iterm_connection = None
            self.iterm_app = None

    async def get_session_for_worker(self, worker_id: str) -> Optional[iterm2.Session]:
        """Get iTerm2 session for a worker"""
        if not self.iterm_connection:
            return None

        return await controller.get_session_by_worker_id(
            self.iterm_connection,
            worker_id
        )

    # =========================================================================
    # Infrastructure Setup
    # =========================================================================

    async def setup_infrastructure(self):
        """Setup RAMAS RabbitMQ infrastructure"""
        print("🔧 Setting up RAMAS infrastructure...")
        await exchanges.setup_all(self.channel)
        await self.bind_interrupt_queue()
        await self.setup_task_queues()

    async def bind_interrupt_queue(self):
        """Bind interrupt queue for all registered workers"""
        workers = registry.get_all_windows()

        if not workers:
            print("  ⚠️  Registry empty - interrupt binding waiting")
            return

        for worker_id in workers:
            await exchanges.bind_interrupt_queue_for_worker(
                self.channel,
                worker_id
            )

    async def setup_task_queues(self):
        """Setup task queues for all registered workers (Pattern 2)"""
        workers = registry.get_all_windows()

        if not workers:
            print("  ⚠️  Registry empty - task queue setup waiting")
            return

        # Setup task queues for each worker
        for worker_id in workers:
            try:
                await exchanges.setup_task_queue(self.channel, worker_id)
                print(f"  📋 Task queue: {worker_id}")
            except Exception as e:
                print(f"  ⚠️  Task queue error for {worker_id}: {e}")

        # Setup results queue for team leader
        try:
            await exchanges.setup_results_queue(self.channel)
            print("  📋 Results queue: team-leader")
        except Exception as e:
            print(f"  ⚠️  Results queue error: {e}")

    # =========================================================================
    # Message Listeners
    # =========================================================================

    async def start_listeners(self):
        """Start message listeners"""
        print("👂 Starting listeners...")

        await self.listen_status_updates()
        await self.listen_interrupts()
        await self.listen_task_messages()  # Pattern 2: Task Coordination

        # Pattern C: Session message listener (routes to inbox files)
        if self.config.enable_sessions and self.session_manager:
            await self.listen_session_messages()

        print("✅ Listeners active")

    async def listen_status_updates(self):
        """Listen for status update messages"""
        queue = await self.channel.get_queue(exchanges.QUEUES.STATUS_UPDATES.name)

        async def callback(message: AbstractIncomingMessage):
            async with message.process():
                try:
                    content = json.loads(message.body.decode())
                    print(f"📊 Status update: {content.get('workerId')} -> {content.get('status')}")
                    await self.handle_status_change(content)
                except Exception as e:
                    print(f"❌ Status message error: {e}")

        await queue.consume(callback)

    async def listen_interrupts(self):
        """Listen for interrupt messages"""
        queue = await self.channel.get_queue(exchanges.QUEUES.INTERRUPTS.name)

        async def callback(message: AbstractIncomingMessage):
            async with message.process():
                try:
                    content = json.loads(message.body.decode())
                    print(f"🔔 Interrupt: {content.get('workerId')} - {content.get('priority', 'normal')}")
                    await self.handle_interrupt(content)
                except Exception as e:
                    print(f"❌ Interrupt message error: {e}")

        await queue.consume(callback)

    async def listen_task_messages(self):
        """
        Listen for task messages (Pattern 2 - Task Coordination).

        When a task arrives for a worker, send it as a message to their iTerm2 terminal.
        The worker (Claude Code) will process it and send results back.
        """
        workers = registry.get_all_windows()

        if not workers:
            print("  ⚠️  Registry empty - task listening waiting")
            return

        for worker_id in workers:
            try:
                queue_name = f"ramas.tasks.{worker_id}"
                queue = await self.channel.get_queue(queue_name)

                async def callback(message: AbstractIncomingMessage, wid=worker_id):
                    async with message.process():
                        try:
                            content = json.loads(message.body.decode())
                            print(f"📋 Task: {content.get('taskId')} -> {wid}")
                            await self.handle_task_message(wid, content)
                        except Exception as e:
                            print(f"❌ Task message error: {e}")

                await queue.consume(callback)
                print(f"  👂 Task listener: {worker_id}")
            except Exception as e:
                print(f"  ⚠️  Task listener error for {worker_id}: {e}")

    async def listen_session_messages(self):
        """
        Listen for session messages (Pattern C) and route to inbox files.

        This solves the MCP Stateless Connection problem (PATTERN-C-001):
        - Daemon maintains persistent connection to RabbitMQ
        - Consumes from session exchange (headers exchange)
        - Routes messages to file-based inboxes per agent
        - MCP tools read from inbox files (no connection needed)

        Inbox Location: /tmp/ramas-session-inboxes/{agent_id}.json
        """
        print("  🔗 Setting up session message listener (Pattern C)...")

        try:
            # Get the session channel from session_manager
            if not self.session_manager or not self.session_manager.channel:
                print("  ⚠️  Session manager not ready")
                return

            channel = self.session_manager.channel

            # Declare daemon's queue for session messages
            daemon_queue = await channel.declare_queue(
                "ramas.daemon.session-inbox-router",
                durable=True,
                arguments={
                    "x-message-ttl": 3600000,  # 1 hour
                    "x-max-length": 10000,  # Max 10k messages
                }
            )

            # Bind to session exchange to receive ALL session messages
            # Headers exchange with x-match: all would be too restrictive
            # We use a fanout-like binding to get all messages
            session_exchange = await channel.declare_exchange(
                "ramas.sessions",
                aio_pika.ExchangeType.HEADERS,
                durable=True,
            )

            # Bind with minimal headers to receive all session messages
            await daemon_queue.bind(
                session_exchange,
                arguments={"x-match": "any", "session_id": ""}  # Match any session
            )

            async def session_message_callback(message: AbstractIncomingMessage):
                """Route session messages to agent inboxes"""
                async with message.process():
                    try:
                        # Extract headers
                        headers = message.headers or {}
                        session_id = headers.get("session_id")
                        message_type = headers.get("message_type")
                        sender_id = headers.get("sender_id")
                        message_id = headers.get("message_id")
                        target_agent = headers.get("target_agent")  # Optional: for direct messages

                        if not session_id or not sender_id:
                            return  # Invalid message

                        # Parse payload
                        try:
                            payload = json.loads(message.body.decode())
                        except json.JSONDecodeError:
                            payload = {"raw": message.body.decode()}

                        timestamp = message.timestamp.isoformat() if message.timestamp else None

                        # Route to inbox(es) via InboxManager
                        delivered = self.inbox_manager.route_message(
                            session_id=session_id,
                            target_agent=target_agent,
                            message_id=message_id or f"msg-{int(message.timestamp.timestamp() * 1000) if message.timestamp else 0}",
                            sender_id=sender_id,
                            message_type=message_type or "unknown",
                            payload=payload,
                            timestamp=timestamp or "",
                        )

                        if delivered > 0:
                            print(f"  📥 Session message routed: {message_type} -> {delivered} inbox(es)")

                            # Pattern C-003 v3: Publish Redis wake signal for instant notification
                            # This wakes up any agent blocking on wait_for_task()
                            if self.redis_registry and self.redis_registry.is_connected:
                                if target_agent:
                                    # Direct message - wake specific agent
                                    await self.redis_registry.publish_wake(
                                        agent_id=target_agent,
                                        event_type=message_type or "new_message",
                                        data={"session_id": session_id, "message_id": message_id},
                                    )
                                    print(f"  ⚡ Wake signal sent to {target_agent}")
                                else:
                                    # Broadcast - wake all registered agents for this session
                                    # Get all agents from inbox files
                                    from .session_inbox import INBOX_DIR
                                    for inbox_file in INBOX_DIR.glob("*.json"):
                                        agent_id = inbox_file.stem
                                        if agent_id != sender_id:  # Don't wake sender
                                            await self.redis_registry.publish_wake(
                                                agent_id=agent_id,
                                                event_type=message_type or "broadcast",
                                                data={"session_id": session_id, "message_id": message_id},
                                            )
                                    print(f"  ⚡ Broadcast wake signals sent")

                        # Pattern C-003: Autonomous Workflow Tracking
                        # Track task lifecycle and auto-trigger agents
                        if self.workflow_engine and delivered > 0:
                            if message_type == "task" and target_agent:
                                # Task assigned → AUTO-TRIGGER WORKER!
                                task_id = payload.get("task_id") or message_id
                                await self.workflow_engine.on_task_assigned(
                                    session_id=session_id,
                                    task_id=task_id,
                                    worker_id=target_agent,
                                    leader_id=sender_id,
                                )
                                print(f"  🤖 Worker {target_agent} AUTO-TRIGGERED for task {task_id}")

                            elif message_type == "result":
                                # Task completed → Check if all done → AUTO-TRIGGER LEADER
                                task_id = payload.get("task_id")
                                if task_id:
                                    await self.workflow_engine.on_task_completed(
                                        session_id=session_id,
                                        task_id=task_id,
                                        result=payload,
                                    )
                                    print(f"  📊 Task {task_id} completed, checking workflow...")

                    except Exception as e:
                        print(f"  ❌ Session message routing error: {e}")

            await daemon_queue.consume(session_message_callback)
            print("  ✅ Session inbox router active")

        except Exception as e:
            print(f"  ⚠️  Session listener setup error: {e}")
            import traceback
            traceback.print_exc()

    # =========================================================================
    # Message Handlers
    # =========================================================================

    async def handle_status_change(self, data: Dict[str, Any]):
        """
        Handle status change message.

        Args:
            data: { workerId, status, timestamp }
        """
        worker_id = data.get("workerId")
        status = data.get("status")

        if not worker_id or not status:
            print("   ⚠️  Invalid status message")
            return

        # Get worker info from registry
        worker = registry.get_window(worker_id)
        if not worker:
            print(f"   ⚠️  Worker not found: {worker_id}")
            return

        # Update terminal title via iTerm2 API
        session = await self.get_session_for_worker(worker_id)
        if session:
            success = await controller.update_status_title(
                session,
                worker_id,
                status
            )
            if success:
                print(f"   ✅ Title updated: [{status.upper()}] {worker_id}")
        else:
            print(f"   ⚠️  Session not found for: {worker_id}")

        # Update registry
        registry.update_status(worker_id, status)

        # If green, flush pending messages
        if status == "green":
            await self.flush_pending_messages(worker_id)

    async def handle_interrupt(self, data: Dict[str, Any]):
        """
        Handle interrupt message.

        Args:
            data: { workerId, message, priority }
        """
        worker_id = data.get("workerId")
        message = data.get("message", "")
        priority = data.get("priority", "normal")
        from_agent = data.get("from")

        if not worker_id:
            print("   ⚠️  Invalid interrupt message")
            return

        # Get worker info from registry
        worker = registry.get_window(worker_id)
        if not worker:
            print(f"   ⚠️  Worker not found: {worker_id}")
            return

        # Get iTerm2 session
        session = await self.get_session_for_worker(worker_id)
        if not session:
            print(f"   ⚠️  Session not found for: {worker_id}")
            return

        # Priority or green status: send immediately
        if priority == "urgent" or worker.status == "green":
            if priority == "urgent":
                # Urgent: Ctrl+C + ESC + message
                success = await controller.urgent_interrupt(session, message)
            else:
                # Normal: ESC + message
                success = await controller.interrupt_and_message(session, message)

            if success:
                print(f"   ✅ Message sent: {worker_id}")
            else:
                print(f"   ❌ Message failed: {worker_id}")

        else:
            # Red status: queue message
            self.add_pending_message(worker_id, message, priority, from_agent)
            print(f"   📥 Message queued (worker red): {worker_id}")

    async def handle_task_message(self, worker_id: str, data: Dict[str, Any]):
        """
        Handle task message (Pattern 2 - Task Coordination).

        When a task arrives from RabbitMQ, send it to the worker's iTerm2 terminal.
        The worker (Claude Code) will process it and send results back.

        Args:
            worker_id: Target worker ID
            data: { taskId, taskType, params, fromLeader }
        """
        task_id = data.get("taskId")
        task_type = data.get("taskType")
        params = data.get("params", {})
        from_leader = data.get("fromLeader", "team-leader")

        if not task_id or not task_type:
            print("   ⚠️  Invalid task message")
            return

        # Get worker info from registry
        worker = registry.get_window(worker_id)
        if not worker:
            print(f"   ⚠️  Worker not found: {worker_id}")
            return

        # Get iTerm2 session
        session = await self.get_session_for_worker(worker_id)
        if not session:
            print(f"   ⚠️  Session not found for: {worker_id}")
            return

        # Format task message for Claude Code
        task_message = self._format_task_message(task_id, task_type, params, from_leader)

        # Send task to terminal (ESC + message + ENTER)
        success = await controller.interrupt_and_message(session, task_message)

        if success:
            print(f"   ✅ Task sent to {worker_id}: {task_type}")
            # Update status to red (working)
            await self._update_worker_status(worker_id, "red")
        else:
            print(f"   ❌ Task send failed: {worker_id}")

    def _format_task_message(
        self,
        task_id: str,
        task_type: str,
        params: Dict[str, Any],
        from_leader: str
    ) -> str:
        """Format task as a message for Claude Code"""
        # Create human-readable task description
        if task_type == "prime_numbers":
            max_val = params.get("max_value", 1000)
            return (
                f"GÖREV [{task_id}]: Python ile 1'den {max_val}'e kadar TÜM ASAL SAYILARI bul. "
                f"Sonucu /tmp/result_{task_id}.json dosyasına kaydet. "
                f"Format: {{\"worker_id\": \"{params.get('worker_id', 'unknown')}\", \"task_id\": \"{task_id}\", "
                f"\"numbers\": [2, 3, 5, ...], \"count\": N}}. "
                f"Bitince 'GÖREV TAMAMLANDI: {task_id}' yaz."
            )
        elif task_type == "fibonacci":
            max_val = params.get("max_value", 1000)
            return (
                f"GÖREV [{task_id}]: Python ile {max_val}'den küçük TÜM FİBONACCİ SAYILARINI bul. "
                f"Sonucu /tmp/result_{task_id}.json dosyasına kaydet. "
                f"Format: {{\"worker_id\": \"{params.get('worker_id', 'unknown')}\", \"task_id\": \"{task_id}\", "
                f"\"numbers\": [0, 1, 1, 2, 3, 5, ...], \"count\": N}}. "
                f"Bitince 'GÖREV TAMAMLANDI: {task_id}' yaz."
            )
        else:
            # Generic task format
            params_str = json.dumps(params, ensure_ascii=False)
            return (
                f"GÖREV [{task_id}] ({task_type}): {params_str}. "
                f"Bitince 'GÖREV TAMAMLANDI: {task_id}' yaz."
            )

    async def _update_worker_status(self, worker_id: str, status: str):
        """Update worker status via daemon"""
        try:
            session = await self.get_session_for_worker(worker_id)
            if session:
                await controller.update_status_badge(session, worker_id, status)
                registry.update_status(worker_id, status)
        except Exception as e:
            print(f"   ⚠️  Status update error: {e}")

    # =========================================================================
    # Pending Messages
    # =========================================================================

    def add_pending_message(
        self,
        worker_id: str,
        message: str,
        priority: str,
        from_agent: Optional[str] = None
    ):
        """Add a message to pending queue for a busy worker"""
        import time

        if worker_id not in self.pending_messages:
            self.pending_messages[worker_id] = []

        self.pending_messages[worker_id].append(PendingMessage(
            message=message,
            priority=priority,
            timestamp=int(time.time() * 1000),
            from_agent=from_agent,
        ))

    async def flush_pending_messages(self, worker_id: str):
        """Send all pending messages when worker becomes green"""
        pending = self.pending_messages.get(worker_id, [])

        if not pending:
            return

        session = await self.get_session_for_worker(worker_id)
        if not session:
            return

        print(f"   📤 Sending {len(pending)} pending messages: {worker_id}")

        for item in pending:
            await controller.interrupt_and_message(
                session,
                item.message,
                press_enter=True
            )
            await asyncio.sleep(0.5)  # Brief delay between messages

        # Clear queue
        self.pending_messages[worker_id] = []
        print(f"   ✅ Pending messages sent: {worker_id}")

    # =========================================================================
    # Status
    # =========================================================================

    def get_status(self) -> Dict[str, Any]:
        """Get daemon status"""
        pending_count = sum(
            len(msgs) for msgs in self.pending_messages.values()
        )

        status = {
            "isRunning": self.is_running,
            "reconnectAttempts": self.reconnect_attempts,
            "pendingMessagesCount": pending_count,
            "registryStats": registry.get_stats(),
            "itermConnected": self.iterm_connection is not None,
        }

        # Add session info if enabled
        if self.session_manager:
            status["sessions"] = {
                "active": len(self.session_manager.sessions),
                "list": self.session_manager.list_sessions(),
            }

        return status

    # =========================================================================
    # Pattern C: Session Management
    # =========================================================================

    async def setup_session_manager(self):
        """Initialize the session manager for Pattern C"""
        print("🔗 Setting up Session Manager (Pattern C)...")

        try:
            self.session_manager = SessionManager(self.config.rabbitmq_url)
            await self.session_manager.connect()
            print("✅ Session Manager connected")
        except Exception as e:
            print(f"⚠️  Session Manager error: {e}")
            print("   Daemon will run but sessions won't work.")
            self.session_manager = None

    async def setup_auto_trigger(self):
        """
        Initialize autonomous multi-agent triggering (PATTERN-C-003).

        This enables ZERO-INTERVENTION workflow execution:
        - Task assigned → Worker AUTO-TRIGGERED
        - All tasks complete → Leader AUTO-TRIGGERED

        Components:
        - AgentTrigger: Sends commands to Claude sessions via iTerm2 API
        - WorkflowEngine: Tracks task lifecycle, triggers appropriate agents
        """
        print("🤖 Setting up Autonomous Triggering (Pattern C-003)...")

        try:
            # Initialize AgentTrigger with config
            from pathlib import Path
            self.agent_trigger = AgentTrigger(
                registry_path=Path(registry.REGISTRY_PATH),
                trigger_delay=self.config.trigger_delay,
                command_delay=self.config.command_delay,
                queue_check_interval=self.config.queue_check_interval,
            )

            # Initialize WorkflowEngine with trigger
            self.workflow_engine = WorkflowEngine(
                agent_trigger=self.agent_trigger,
            )

            # Configure InboxManager with auto-trigger capability
            self.inbox_manager.set_workflow_engine(self.workflow_engine)

            print("✅ Autonomous Triggering initialized")
            print(f"   Trigger delay: {self.config.trigger_delay}s")
            print(f"   Command delay: {self.config.command_delay}s")

        except Exception as e:
            print(f"⚠️  Auto-trigger setup error: {e}")
            print("   Daemon will run but autonomous triggering won't work.")
            import traceback
            traceback.print_exc()
            self.agent_trigger = None
            self.workflow_engine = None

    async def start_session_tasks(self):
        """Start background tasks for session management"""
        print("🔄 Starting session background tasks...")

        # Session cleanup task (removes expired sessions)
        self.session_cleanup_task = asyncio.create_task(
            self._session_cleanup_loop()
        )

        # Session heartbeat check task (detects disconnected agents)
        self.session_heartbeat_task = asyncio.create_task(
            self._session_heartbeat_loop()
        )

        # Pattern C-003: Trigger queue processor (processes pending triggers)
        if self.agent_trigger:
            await self.agent_trigger.start_queue_processor()
            print("   🤖 Trigger queue processor started")

        print("✅ Session background tasks started")

    async def _session_cleanup_loop(self):
        """
        Periodically cleanup expired sessions.

        Runs every `session_cleanup_interval` seconds.
        """
        while self.is_running:
            try:
                await asyncio.sleep(self.config.session_cleanup_interval)

                if not self.session_manager:
                    continue

                # Check for expired sessions
                from datetime import datetime

                expired_sessions = []
                for session_id, session in self.session_manager.sessions.items():
                    # Check if session is in terminal state
                    if session.state_machine.is_terminal:
                        expired_sessions.append(session_id)
                        continue

                    # Check session timeout
                    if session.state_machine.state == SessionState.ACTIVE:
                        created = datetime.fromisoformat(session.created_at)
                        age = (datetime.utcnow() - created).total_seconds()

                        if age > session.config.timeouts.session_timeout:
                            print(f"⏰ Session timeout: {session_id}")
                            session.state_machine.transition(
                                SessionEvent.SESSION_TIMEOUT
                            )
                            expired_sessions.append(session_id)

                # Cleanup expired sessions
                for session_id in expired_sessions:
                    await self.session_manager.close_session(
                        session_id, "expired"
                    )
                    print(f"🗑️  Session cleaned up: {session_id}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"⚠️  Session cleanup error: {e}")

    async def _session_heartbeat_loop(self):
        """
        Check for disconnected agents in active sessions.

        Runs every `session_heartbeat_check_interval` seconds.
        """
        while self.is_running:
            try:
                await asyncio.sleep(self.config.session_heartbeat_check_interval)

                if not self.session_manager:
                    continue

                from datetime import datetime

                for session_id, session in self.session_manager.sessions.items():
                    if not session.state_machine.is_active:
                        continue

                    # Check each participant's heartbeat
                    from .session_state import ParticipantStatus

                    disconnected = []
                    now = datetime.utcnow()

                    for agent_id, participant in session.participants.items():
                        if participant.status != ParticipantStatus.ACTIVE:
                            continue

                        last_hb = datetime.fromisoformat(participant.last_heartbeat)
                        elapsed = (now - last_hb).total_seconds()

                        if elapsed > self.config.session_heartbeat_timeout:
                            disconnected.append(agent_id)
                            print(f"💔 Heartbeat timeout: {agent_id} in {session_id}")

                    # Mark disconnected participants
                    for agent_id in disconnected:
                        session.participants[agent_id].status = ParticipantStatus.DISCONNECTED
                        session.participants[agent_id].disconnect_count += 1

                        # Trigger state transition if needed
                        if len(disconnected) == len(session.participants):
                            session.state_machine.transition(
                                SessionEvent.ALL_WORKERS_DISCONNECTED
                            )
                        else:
                            session.state_machine.transition(
                                SessionEvent.WORKER_DISCONNECTED
                            )

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"⚠️  Session heartbeat error: {e}")

    async def handle_session_message(self, session_id: str, message: Dict[str, Any]):
        """
        Handle an incoming session message.

        Routes message to appropriate handler based on message type.
        """
        if not self.session_manager:
            return

        session = await self.session_manager.get_session(session_id)
        if not session:
            print(f"⚠️  Session not found: {session_id}")
            return

        msg_type = message.get("message_type")
        sender_id = message.get("sender_id")
        payload = message.get("payload", {})

        print(f"📨 Session message: {msg_type} from {sender_id} in {session_id}")

        # Route based on message type
        if msg_type == MessageType.PRESENCE.value:
            await self._handle_presence_message(session, sender_id, payload)
        elif msg_type == MessageType.TASK.value:
            await self._handle_task_message_session(session, sender_id, payload)
        elif msg_type == MessageType.RESULT.value:
            await self._handle_result_message(session, sender_id, payload)
        elif msg_type == MessageType.CONTROL.value:
            await self._handle_control_message(session, sender_id, payload)

    async def _handle_presence_message(
        self,
        session,
        sender_id: str,
        payload: Dict[str, Any]
    ):
        """Handle presence message (join/leave/heartbeat)"""
        action = payload.get("action")

        if action == "heartbeat":
            # Update heartbeat timestamp
            if sender_id in session.participants:
                session.participants[sender_id].update_heartbeat()
        elif action == "reconnect":
            # Handle reconnection
            if sender_id in session.participants:
                from .session_state import ParticipantStatus
                session.participants[sender_id].status = ParticipantStatus.ACTIVE
                session.participants[sender_id].update_heartbeat()

                # Trigger recovery if needed
                if session.state_machine.state == SessionState.SUSPENDED:
                    session.state_machine.transition(
                        SessionEvent.WORKER_RECONNECTED,
                        actor_agent_id=sender_id,
                    )

    async def _handle_task_message_session(
        self,
        session,
        sender_id: str,
        payload: Dict[str, Any]
    ):
        """Handle task message within session context"""
        target_agent = payload.get("assigned_to")

        if target_agent:
            # Route task to target agent's iTerm2 terminal
            iterm_session = await self.get_session_for_worker(target_agent)

            if iterm_session:
                task_text = (
                    f"GÖREV [{payload.get('task_id')}]: {payload.get('title')}\n"
                    f"{payload.get('description')}"
                )
                await controller.interrupt_and_message(iterm_session, task_text)
                print(f"   ✅ Task routed to {target_agent}")

    async def _handle_result_message(
        self,
        session,
        sender_id: str,
        payload: Dict[str, Any]
    ):
        """Handle result message from worker"""
        task_id = payload.get("task_id")
        success = payload.get("success", True)

        print(f"   📊 Result: {task_id} = {'✅' if success else '❌'}")

        # Update worker status to green (available)
        await self._update_worker_status(sender_id, "green")

    async def _handle_control_message(
        self,
        session,
        sender_id: str,
        payload: Dict[str, Any]
    ):
        """Handle control message (state sync, checkpoint)"""
        action = payload.get("action")
        print(f"   🎛️  Control: {action} from {sender_id}")


# =============================================================================
# Main
# =============================================================================

async def main():
    """Main entry point"""
    daemon = StatusDaemon()
    await daemon.start()


def run():
    """Run the daemon (for use as module entry point)"""
    asyncio.run(main())


if __name__ == "__main__":
    run()
