#!/usr/bin/env python3
"""
RAMAS RabbitMQ Exchanges & Queues

Port from: ramas-exchanges.js (291 lines)

Defines RAMAS RabbitMQ topology using aio-pika.

Exchange topology:
- agent.ramas.status (fanout) - Broadcast status changes
- agent.ramas.interrupt (direct) - Route interrupts to workers
- agent.ramas.push (topic) - Pattern-based push notifications

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

import os
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

# aio-pika for async RabbitMQ
try:
    import aio_pika
    from aio_pika import ExchangeType, Message, DeliveryMode
    from aio_pika.abc import AbstractChannel, AbstractExchange, AbstractQueue
except ImportError:
    print("Error: aio-pika not installed.")
    print("Install with: uv pip install aio-pika")
    raise


# =============================================================================
# Configuration
# =============================================================================

RABBITMQ_URL = os.environ.get(
    "RABBITMQ_URL",
    "amqp://admin:rabbitmq123@localhost:5672"
)


# =============================================================================
# Exchange Definitions
# =============================================================================

@dataclass
class ExchangeConfig:
    """RabbitMQ Exchange configuration"""
    name: str
    type: ExchangeType
    durable: bool = True
    auto_delete: bool = False


class EXCHANGES:
    """RAMAS Exchange definitions"""

    # Worker status broadcast (fanout - all listeners receive)
    STATUS = ExchangeConfig(
        name="agent.ramas.status",
        type=ExchangeType.FANOUT,
        durable=True,
        auto_delete=False,
    )

    # Interrupt messages (direct - routed by workerId)
    INTERRUPT = ExchangeConfig(
        name="agent.ramas.interrupt",
        type=ExchangeType.DIRECT,
        durable=True,
        auto_delete=False,
    )

    # Push notifications (topic - pattern matching)
    PUSH = ExchangeConfig(
        name="agent.ramas.push",
        type=ExchangeType.TOPIC,
        durable=True,
        auto_delete=False,
    )

    # =========================================================================
    # NEW: Task Coordination Exchanges (Pattern 2 Implementation)
    # =========================================================================

    # Task distribution (direct - routed by workerId)
    # Team Leader sends tasks to specific workers
    TASKS = ExchangeConfig(
        name="agent.ramas.tasks",
        type=ExchangeType.DIRECT,
        durable=True,
        auto_delete=False,
    )

    # Result collection (direct - routed to team-leader)
    # Workers send completed results back
    RESULTS = ExchangeConfig(
        name="agent.ramas.results",
        type=ExchangeType.DIRECT,
        durable=True,
        auto_delete=False,
    )

    # =========================================================================
    # NEW: Global Broadcast Exchange (Pattern C-003 v6.4)
    # =========================================================================
    # All connected agents receive ALL messages (session-independent!)
    # Use for: session discovery, emergency announcements, cross-session comms
    BROADCAST = ExchangeConfig(
        name="agent.ramas.broadcast",
        type=ExchangeType.FANOUT,  # ALL bound queues receive EVERY message
        durable=True,
        auto_delete=False,
    )


# =============================================================================
# Queue Definitions
# =============================================================================

@dataclass
class QueueConfig:
    """RabbitMQ Queue configuration"""
    name: str
    durable: bool = True
    exclusive: bool = False
    auto_delete: bool = False
    arguments: Dict[str, Any] = field(default_factory=dict)


class QUEUES:
    """RAMAS Queue definitions"""

    # Status updates queue (daemon listens here)
    STATUS_UPDATES = QueueConfig(
        name="ramas.status.updates",
        durable=True,
        exclusive=False,
        auto_delete=False,
        arguments={
            "x-message-ttl": 300000,  # 5 minutes TTL
        },
    )

    # Interrupt commands queue (daemon listens here)
    INTERRUPTS = QueueConfig(
        name="ramas.interrupts",
        durable=True,
        exclusive=False,
        auto_delete=False,
        arguments={
            "x-message-ttl": 60000,  # 1 minute TTL (urgent messages)
        },
    )

    # Worker push queue template (created per worker)
    @staticmethod
    def push_queue(worker_id: str) -> QueueConfig:
        return QueueConfig(
            name=f"ramas.push.{worker_id}",
            durable=False,
            exclusive=True,
            auto_delete=True,
            arguments={
                "x-message-ttl": 600000,  # 10 minutes TTL
            },
        )

    # =========================================================================
    # NEW: Task Coordination Queues (Pattern 2 Implementation)
    # =========================================================================

    # Task queue template (created per worker)
    @staticmethod
    def task_queue(worker_id: str) -> QueueConfig:
        """Task inbox for a specific worker"""
        return QueueConfig(
            name=f"ramas.tasks.{worker_id}",
            durable=True,
            exclusive=False,
            auto_delete=False,
            arguments={
                "x-message-ttl": 3600000,  # 1 hour TTL
            },
        )

    # Result queue for team leader
    RESULTS_QUEUE = QueueConfig(
        name="ramas.results.team-leader",
        durable=True,
        exclusive=False,
        auto_delete=False,
        arguments={
            "x-message-ttl": 3600000,  # 1 hour TTL
        },
    )

    # =========================================================================
    # NEW: Global Broadcast Queue (Pattern C-003 v6.4)
    # =========================================================================
    @staticmethod
    def broadcast_queue(agent_id: str) -> QueueConfig:
        """
        Broadcast inbox for a specific agent.

        Fanout exchange = every message goes to ALL bound queues.
        Each agent creates their own exclusive queue.

        Args:
            agent_id: Unique agent identifier (e.g., "team-leader", "worker-001")

        Returns:
            QueueConfig for agent's broadcast inbox
        """
        return QueueConfig(
            name=f"ramas.broadcast.{agent_id}",
            durable=False,       # Transient - recreated on reconnect
            exclusive=True,      # Only this connection can use it
            auto_delete=True,    # Delete when connection closes
            arguments={
                "x-message-ttl": 300000,  # 5 minutes TTL (short-lived broadcasts)
            },
        )


# =============================================================================
# Routing Keys
# =============================================================================

class ROUTING_KEYS:
    """Routing key patterns"""

    # Status routing keys
    STATUS_ALL = "status.*"
    STATUS_GREEN = "status.green"
    STATUS_RED = "status.red"

    # Interrupt routing keys (workerId used directly)
    INTERRUPT_PREFIX = "interrupt."

    # Push routing keys
    PUSH_ALL = "push.#"
    PUSH_WORKER_PREFIX = "push.worker."
    PUSH_URGENT = "push.urgent.#"


# =============================================================================
# Setup Functions
# =============================================================================

async def setup_exchanges(channel: AbstractChannel) -> Dict[str, AbstractExchange]:
    """
    Set up RAMAS exchanges.

    Args:
        channel: RabbitMQ channel

    Returns:
        Dict mapping exchange name to exchange object
    """
    print("[RAMAS] Setting up exchanges...")
    exchanges = {}

    # Include all RAMAS exchanges
    all_exchanges = [
        EXCHANGES.STATUS,
        EXCHANGES.INTERRUPT,
        EXCHANGES.PUSH,
        EXCHANGES.TASKS,
        EXCHANGES.RESULTS,
        EXCHANGES.BROADCAST,  # NEW: Global broadcast (Pattern C-003 v6.4)
    ]

    for config in all_exchanges:
        exchange = await channel.declare_exchange(
            name=config.name,
            type=config.type,
            durable=config.durable,
            auto_delete=config.auto_delete,
        )
        exchanges[config.name] = exchange
        print(f"  ✅ Exchange: {config.name} ({config.type.value})")

    print("[RAMAS] Exchanges ready")
    return exchanges


async def setup_queues(channel: AbstractChannel) -> Dict[str, AbstractQueue]:
    """
    Set up RAMAS queues.

    Args:
        channel: RabbitMQ channel

    Returns:
        Dict mapping queue name to queue object
    """
    print("[RAMAS] Setting up queues...")
    queues = {}

    # Status updates queue
    status_queue = await channel.declare_queue(
        name=QUEUES.STATUS_UPDATES.name,
        durable=QUEUES.STATUS_UPDATES.durable,
        exclusive=QUEUES.STATUS_UPDATES.exclusive,
        auto_delete=QUEUES.STATUS_UPDATES.auto_delete,
        arguments=QUEUES.STATUS_UPDATES.arguments,
    )

    # Bind to status exchange
    await status_queue.bind(
        exchange=EXCHANGES.STATUS.name,
        routing_key="",  # Fanout doesn't use routing key
    )
    queues[QUEUES.STATUS_UPDATES.name] = status_queue
    print(f"  ✅ Queue: {QUEUES.STATUS_UPDATES.name}")

    # Interrupts queue
    interrupt_queue = await channel.declare_queue(
        name=QUEUES.INTERRUPTS.name,
        durable=QUEUES.INTERRUPTS.durable,
        exclusive=QUEUES.INTERRUPTS.exclusive,
        auto_delete=QUEUES.INTERRUPTS.auto_delete,
        arguments=QUEUES.INTERRUPTS.arguments,
    )
    queues[QUEUES.INTERRUPTS.name] = interrupt_queue
    print(f"  ✅ Queue: {QUEUES.INTERRUPTS.name}")

    print("[RAMAS] Queues ready")
    return queues


async def create_worker_push_queue(
    channel: AbstractChannel,
    worker_id: str
) -> AbstractQueue:
    """
    Create a push queue for a specific worker.

    Args:
        channel: RabbitMQ channel
        worker_id: Worker ID (e.g., "worker-001")

    Returns:
        Queue object
    """
    config = QUEUES.push_queue(worker_id)

    queue = await channel.declare_queue(
        name=config.name,
        durable=config.durable,
        exclusive=config.exclusive,
        auto_delete=config.auto_delete,
        arguments=config.arguments,
    )

    # Bind to interrupt exchange (direct routing by workerId)
    await queue.bind(
        exchange=EXCHANGES.INTERRUPT.name,
        routing_key=worker_id,
    )

    # Bind to push exchange (topic routing)
    await queue.bind(
        exchange=EXCHANGES.PUSH.name,
        routing_key=f"push.{worker_id}",
    )

    # Bind to urgent push messages
    await queue.bind(
        exchange=EXCHANGES.PUSH.name,
        routing_key="push.urgent.*",
    )

    print(f"[RAMAS] Worker queue created: {config.name}")
    return queue


async def delete_worker_push_queue(
    channel: AbstractChannel,
    worker_id: str
) -> bool:
    """
    Delete a worker's push queue.

    Args:
        channel: RabbitMQ channel
        worker_id: Worker ID

    Returns:
        bool: True if successful
    """
    queue_name = f"ramas.push.{worker_id}"

    try:
        await channel.queue_delete(queue_name)
        print(f"[RAMAS] Worker queue deleted: {queue_name}")
        return True
    except Exception:
        print(f"[RAMAS] Queue not found: {queue_name}")
        return False


async def setup_all(channel: AbstractChannel) -> Dict[str, Any]:
    """
    Set up all RAMAS infrastructure.

    Args:
        channel: RabbitMQ channel

    Returns:
        Dict with exchanges and queues
    """
    exchanges = await setup_exchanges(channel)
    queues = await setup_queues(channel)

    print("[RAMAS] Full infrastructure ready")

    return {
        "exchanges": exchanges,
        "queues": queues,
    }


async def bind_interrupt_queue_for_worker(
    channel: AbstractChannel,
    worker_id: str
) -> bool:
    """
    Bind interrupt queue to receive messages for a specific worker.

    Args:
        channel: RabbitMQ channel
        worker_id: Worker ID

    Returns:
        bool: True if successful
    """
    try:
        # Get the interrupts queue
        queue = await channel.get_queue(QUEUES.INTERRUPTS.name)

        # Bind with workerId as routing key
        await queue.bind(
            exchange=EXCHANGES.INTERRUPT.name,
            routing_key=worker_id,
        )

        print(f"  🔗 Interrupt binding: {worker_id}")
        return True
    except Exception as e:
        print(f"[RAMAS] Error binding interrupt queue: {e}")
        return False


async def check_status(channel: AbstractChannel) -> Dict[str, Any]:
    """
    Check exchange and queue status.

    Args:
        channel: RabbitMQ channel

    Returns:
        Status dict
    """
    status = {
        "exchanges": {},
        "queues": {},
    }

    # Check exchanges
    for config in [EXCHANGES.STATUS, EXCHANGES.INTERRUPT, EXCHANGES.PUSH]:
        try:
            await channel.declare_exchange(
                name=config.name,
                type=config.type,
                passive=True,  # Check only, don't create
            )
            status["exchanges"][config.name] = "ok"
        except Exception:
            status["exchanges"][config.name] = "missing"

    # Check queues
    for config in [QUEUES.STATUS_UPDATES, QUEUES.INTERRUPTS]:
        try:
            queue = await channel.declare_queue(
                name=config.name,
                passive=True,  # Check only, don't create
            )
            status["queues"][config.name] = {
                "status": "ok",
                "message_count": queue.declaration_result.message_count,
                "consumer_count": queue.declaration_result.consumer_count,
            }
        except Exception:
            status["queues"][config.name] = {"status": "missing"}

    return status


# =============================================================================
# Message Publishing Helpers
# =============================================================================

async def publish_status_update(
    channel: AbstractChannel,
    worker_id: str,
    status: str,
    changed_by: Optional[str] = None
) -> bool:
    """
    Publish a status update message.

    Args:
        channel: RabbitMQ channel
        worker_id: Worker ID
        status: New status ("green" or "red")
        changed_by: Who changed the status (optional)

    Returns:
        bool: True if successful
    """
    import json
    import time

    try:
        exchange = await channel.get_exchange(EXCHANGES.STATUS.name)

        message = Message(
            body=json.dumps({
                "workerId": worker_id,
                "status": status,
                "changedBy": changed_by,
                "timestamp": int(time.time() * 1000),
            }).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
        )

        await exchange.publish(message, routing_key="")
        return True
    except Exception as e:
        print(f"[RAMAS] Error publishing status update: {e}")
        return False


async def publish_interrupt(
    channel: AbstractChannel,
    worker_id: str,
    message_text: str,
    priority: str = "normal",
    from_agent: Optional[str] = None
) -> bool:
    """
    Publish an interrupt message.

    Args:
        channel: RabbitMQ channel
        worker_id: Target worker ID
        message_text: Message to send
        priority: "normal" or "urgent"
        from_agent: Sender name (optional)

    Returns:
        bool: True if successful
    """
    import json
    import time

    try:
        exchange = await channel.get_exchange(EXCHANGES.INTERRUPT.name)

        message = Message(
            body=json.dumps({
                "workerId": worker_id,
                "message": message_text,
                "priority": priority,
                "from": from_agent,
                "timestamp": int(time.time() * 1000),
            }).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
        )

        # Use workerId as routing key (direct exchange)
        await exchange.publish(message, routing_key=worker_id)
        return True
    except Exception as e:
        print(f"[RAMAS] Error publishing interrupt: {e}")
        return False


# =============================================================================
# Task Coordination Functions (Pattern 2 Implementation)
# =============================================================================

async def setup_task_queue(
    channel: AbstractChannel,
    worker_id: str
) -> AbstractQueue:
    """
    Set up a task queue for a specific worker.

    Args:
        channel: RabbitMQ channel
        worker_id: Worker ID (e.g., "worker-001")

    Returns:
        Queue object
    """
    config = QUEUES.task_queue(worker_id)

    queue = await channel.declare_queue(
        name=config.name,
        durable=config.durable,
        exclusive=config.exclusive,
        auto_delete=config.auto_delete,
        arguments=config.arguments,
    )

    # Bind to TASKS exchange with workerId as routing key
    await queue.bind(
        exchange=EXCHANGES.TASKS.name,
        routing_key=worker_id,
    )

    print(f"[RAMAS] Task queue created: {config.name}")
    return queue


async def setup_results_queue(channel: AbstractChannel) -> AbstractQueue:
    """
    Set up the results queue for team leader.

    Args:
        channel: RabbitMQ channel

    Returns:
        Queue object
    """
    config = QUEUES.RESULTS_QUEUE

    queue = await channel.declare_queue(
        name=config.name,
        durable=config.durable,
        exclusive=config.exclusive,
        auto_delete=config.auto_delete,
        arguments=config.arguments,
    )

    # Bind to RESULTS exchange with team-leader as routing key
    await queue.bind(
        exchange=EXCHANGES.RESULTS.name,
        routing_key="team-leader",
    )

    print(f"[RAMAS] Results queue created: {config.name}")
    return queue


async def publish_task(
    channel: AbstractChannel,
    worker_id: str,
    task_id: str,
    task_type: str,
    task_params: Dict[str, Any],
    from_leader: str = "team-leader"
) -> bool:
    """
    Publish a task to a specific worker.

    Args:
        channel: RabbitMQ channel
        worker_id: Target worker ID (e.g., "worker-001")
        task_id: Unique task ID (correlation ID)
        task_type: Type of task (e.g., "prime_numbers", "fibonacci")
        task_params: Task parameters
        from_leader: Who sent the task

    Returns:
        bool: True if successful
    """
    import json
    import time

    try:
        exchange = await channel.get_exchange(EXCHANGES.TASKS.name)

        message = Message(
            body=json.dumps({
                "taskId": task_id,
                "workerId": worker_id,
                "taskType": task_type,
                "params": task_params,
                "fromLeader": from_leader,
                "timestamp": int(time.time() * 1000),
            }).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
            correlation_id=task_id,  # For tracking
        )

        await exchange.publish(message, routing_key=worker_id)
        print(f"[RAMAS] Task published: {task_id} -> {worker_id}")
        return True
    except Exception as e:
        print(f"[RAMAS] Error publishing task: {e}")
        return False


async def publish_result(
    channel: AbstractChannel,
    task_id: str,
    worker_id: str,
    result_data: Any,
    success: bool = True,
    error_msg: Optional[str] = None
) -> bool:
    """
    Publish a result back to the team leader.

    Args:
        channel: RabbitMQ channel
        task_id: Task ID (correlation ID)
        worker_id: Worker who completed the task
        result_data: Result data (will be JSON serialized)
        success: Whether task was successful
        error_msg: Error message if failed

    Returns:
        bool: True if successful
    """
    import json
    import time

    try:
        exchange = await channel.get_exchange(EXCHANGES.RESULTS.name)

        message = Message(
            body=json.dumps({
                "taskId": task_id,
                "workerId": worker_id,
                "success": success,
                "result": result_data,
                "error": error_msg,
                "timestamp": int(time.time() * 1000),
            }).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
            correlation_id=task_id,  # For tracking
        )

        # Route to team-leader
        await exchange.publish(message, routing_key="team-leader")
        print(f"[RAMAS] Result published: {task_id} from {worker_id}")
        return True
    except Exception as e:
        print(f"[RAMAS] Error publishing result: {e}")
        return False


async def setup_task_coordination(
    channel: AbstractChannel,
    worker_ids: list
) -> Dict[str, Any]:
    """
    Set up complete task coordination infrastructure.

    Args:
        channel: RabbitMQ channel
        worker_ids: List of worker IDs (e.g., ["worker-001", "worker-002"])

    Returns:
        Dict with queues
    """
    print("[RAMAS] Setting up task coordination...")

    queues = {}

    # Setup task queues for each worker
    for worker_id in worker_ids:
        queue = await setup_task_queue(channel, worker_id)
        queues[f"tasks.{worker_id}"] = queue

    # Setup results queue for team leader
    results_queue = await setup_results_queue(channel)
    queues["results.team-leader"] = results_queue

    print("[RAMAS] Task coordination ready!")
    return queues


# =============================================================================
# Connection Helper
# =============================================================================

async def connect(url: Optional[str] = None) -> aio_pika.abc.AbstractConnection:
    """
    Connect to RabbitMQ.

    Args:
        url: RabbitMQ URL (defaults to RABBITMQ_URL env var)

    Returns:
        Connection object
    """
    connection_url = url or RABBITMQ_URL
    connection = await aio_pika.connect_robust(connection_url)
    return connection


# =============================================================================
# NEW: Global Broadcast Functions (Pattern C-003 v6.4)
# =============================================================================

async def declare_broadcast_exchange(channel: AbstractChannel) -> AbstractExchange:
    """
    Declare the global broadcast exchange.

    Called once during setup. Fanout exchange - all bound queues receive
    every message regardless of routing key.

    Args:
        channel: RabbitMQ channel

    Returns:
        Exchange object for publishing
    """
    config = EXCHANGES.BROADCAST
    exchange = await channel.declare_exchange(
        name=config.name,
        type=config.type,
        durable=config.durable,
        auto_delete=config.auto_delete,
    )
    print(f"[RAMAS] Broadcast exchange declared: {config.name}")
    return exchange


async def setup_broadcast_queue(
    channel: AbstractChannel,
    agent_id: str,
) -> AbstractQueue:
    """
    Set up broadcast inbox for a specific agent.

    Creates an exclusive queue bound to the fanout exchange.
    All broadcast messages will be delivered to this queue.

    Args:
        channel: RabbitMQ channel
        agent_id: Agent identifier (e.g., "team-leader", "worker-001")

    Returns:
        Queue object for consuming messages
    """
    # Get queue config
    config = QUEUES.broadcast_queue(agent_id)

    # Declare the queue
    queue = await channel.declare_queue(
        name=config.name,
        durable=config.durable,
        exclusive=config.exclusive,
        auto_delete=config.auto_delete,
        arguments=config.arguments,
    )

    # Bind to broadcast exchange (fanout = no routing key needed)
    await queue.bind(exchange=EXCHANGES.BROADCAST.name)

    print(f"[RAMAS] Broadcast queue ready: {agent_id}")
    return queue


async def publish_broadcast(
    channel: AbstractChannel,
    message: Dict[str, Any],
    message_type: str = "info",
) -> bool:
    """
    Publish a message to ALL connected agents.

    Uses fanout exchange - every agent with a bound queue will receive
    this message, regardless of session membership.

    Args:
        channel: RabbitMQ channel
        message: Message payload (dict)
        message_type: Message type (info, warning, question, announcement)

    Returns:
        True if published successfully, False otherwise
    """
    import time
    import json

    try:
        # Get or declare exchange
        exchange = await channel.get_exchange(EXCHANGES.BROADCAST.name)

        # Build message with metadata
        payload = {
            "type": message_type,
            "message": message.get("message", ""),
            "from": message.get("from", "unknown"),
            "timestamp": int(time.time() * 1000),
            "data": message.get("data", {}),
        }

        # Create message
        msg = Message(
            body=json.dumps(payload).encode(),
            delivery_mode=DeliveryMode.NOT_PERSISTENT,  # Transient for speed
            content_type="application/json",
        )

        # Publish to fanout (empty routing key = all bound queues)
        await exchange.publish(msg, routing_key="")
        print(f"[RAMAS] Broadcast sent from {payload['from']}: {message_type}")
        return True

    except Exception as e:
        print(f"[RAMAS] Broadcast error: {e}")
        return False


async def setup_broadcast_consumer(
    queue: AbstractQueue,
    callback,
) -> str:
    """
    Start consuming broadcast messages.

    The callback will be invoked for every broadcast message received.

    Args:
        queue: Broadcast queue (from setup_broadcast_queue)
        callback: Async function(message: IncomingMessage) -> None

    Returns:
        Consumer tag (for cancellation)
    """
    consumer_tag = await queue.consume(callback)
    print(f"[RAMAS] Broadcast consumer started: {consumer_tag}")
    return consumer_tag


# =============================================================================
# Main (for testing)
# =============================================================================

async def main():
    """Test the exchanges setup"""
    import asyncio

    print("Testing RAMAS RabbitMQ Exchanges...")
    print(f"Connecting to: {RABBITMQ_URL.replace(':rabbitmq123@', ':****@')}")

    try:
        connection = await connect()
        channel = await connection.channel()

        # Setup all
        await setup_all(channel)

        # Check status
        status = await check_status(channel)
        import json
        print(f"Status: {json.dumps(status, indent=2)}")

        await connection.close()
        print("✅ Test complete!")

    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
