#!/usr/bin/env python3
"""
RAMAS Task Coordinator

Pattern 2 Implementation: RabbitMQ Result Queue

This module provides:
1. TaskCoordinator - Main coordinator class for team leader
2. WorkerAgent - Worker agent that listens for tasks
3. Task state management and result aggregation

Flow:
    Team Leader:
        1. Receives main task
        2. Splits into subtasks
        3. Distributes via RabbitMQ
        4. Collects results
        5. Aggregates and completes

    Worker:
        1. Listens for tasks on queue
        2. Executes task
        3. Sends result back

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum

import aio_pika
from aio_pika.abc import AbstractIncomingMessage

from . import exchanges
from . import registry
from . import controller


# =============================================================================
# Task State
# =============================================================================

class TaskState(Enum):
    """Task lifecycle states"""
    PENDING = "pending"
    DISPATCHED = "dispatched"
    IN_PROGRESS = "in_progress"
    COLLECTING = "collecting"
    AGGREGATING = "aggregating"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SubTask:
    """A subtask assigned to a worker"""
    task_id: str
    worker_id: str
    task_type: str
    params: Dict[str, Any]
    state: TaskState = TaskState.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class CoordinatedTask:
    """Main task with subtasks"""
    task_id: str
    description: str
    state: TaskState = TaskState.PENDING
    subtasks: Dict[str, SubTask] = field(default_factory=dict)
    expected_workers: List[str] = field(default_factory=list)
    received_results: Dict[str, Any] = field(default_factory=dict)
    final_result: Optional[Any] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None

    def all_subtasks_complete(self) -> bool:
        """Check if all subtasks are complete"""
        if not self.subtasks:
            return False
        return all(
            st.state in [TaskState.COMPLETED, TaskState.FAILED]
            for st in self.subtasks.values()
        )

    def get_results(self) -> Dict[str, Any]:
        """Get all successful results"""
        return {
            worker_id: st.result
            for worker_id, st in self.subtasks.items()
            if st.state == TaskState.COMPLETED and st.result is not None
        }


# =============================================================================
# Task Coordinator (Team Leader)
# =============================================================================

class TaskCoordinator:
    """
    Task coordinator for team leader.

    Responsibilities:
    - Split main task into subtasks
    - Distribute subtasks to workers via RabbitMQ
    - Listen for results
    - Aggregate results when all workers complete
    """

    def __init__(self, coordinator_id: str = "team-leader"):
        self.coordinator_id = coordinator_id
        self.connection: Optional[aio_pika.Connection] = None
        self.channel: Optional[aio_pika.Channel] = None
        self.tasks: Dict[str, CoordinatedTask] = {}
        self.result_handlers: Dict[str, Callable] = {}
        self._result_queue = None
        self._listening = False

    async def connect(self) -> bool:
        """Connect to RabbitMQ"""
        try:
            self.connection = await exchanges.connect()
            self.channel = await self.connection.channel()

            # Setup exchanges
            await exchanges.setup_exchanges(self.channel)

            print(f"[TaskCoordinator] Connected as {self.coordinator_id}")
            return True
        except Exception as e:
            print(f"[TaskCoordinator] Connection error: {e}")
            return False

    async def setup_result_listener(self):
        """Setup listener for worker results"""
        if self._listening:
            return

        # Create results queue
        self._result_queue = await exchanges.setup_results_queue(self.channel)

        # Start consuming
        await self._result_queue.consume(self._on_result_message)
        self._listening = True

        print(f"[TaskCoordinator] Listening for results on {self._result_queue.name}")

    async def _on_result_message(self, message: AbstractIncomingMessage):
        """Handle incoming result message"""
        async with message.process():
            try:
                data = json.loads(message.body.decode())
                task_id = data.get("taskId")
                worker_id = data.get("workerId")
                success = data.get("success", True)
                result = data.get("result")
                error = data.get("error")

                print(f"[TaskCoordinator] Result received: {task_id} from {worker_id}")

                # Find the coordinated task
                for ctask in self.tasks.values():
                    if worker_id in ctask.subtasks:
                        subtask = ctask.subtasks[worker_id]
                        if subtask.task_id == task_id:
                            subtask.state = TaskState.COMPLETED if success else TaskState.FAILED
                            subtask.result = result
                            subtask.error = error
                            subtask.completed_at = datetime.now()

                            ctask.received_results[worker_id] = result

                            # Check if all subtasks complete
                            if ctask.all_subtasks_complete():
                                ctask.state = TaskState.AGGREGATING
                                await self._aggregate_results(ctask)

                            break

            except Exception as e:
                print(f"[TaskCoordinator] Error processing result: {e}")

    async def _aggregate_results(self, task: CoordinatedTask):
        """Aggregate results from all workers"""
        print(f"[TaskCoordinator] Aggregating results for task {task.task_id}")

        # Call custom handler if registered
        handler = self.result_handlers.get(task.task_id)
        if handler:
            try:
                task.final_result = await handler(task.get_results())
                task.state = TaskState.COMPLETED
            except Exception as e:
                task.state = TaskState.FAILED
                print(f"[TaskCoordinator] Aggregation error: {e}")
        else:
            # Default: just collect results
            task.final_result = task.get_results()
            task.state = TaskState.COMPLETED

        task.completed_at = datetime.now()
        print(f"[TaskCoordinator] Task {task.task_id} completed!")

    async def create_task(
        self,
        description: str,
        subtask_definitions: List[Dict[str, Any]],
        aggregation_handler: Optional[Callable] = None
    ) -> CoordinatedTask:
        """
        Create a new coordinated task.

        Args:
            description: Human-readable task description
            subtask_definitions: List of subtask definitions:
                [
                    {"worker_id": "worker-001", "task_type": "prime_numbers", "params": {...}},
                    {"worker_id": "worker-002", "task_type": "fibonacci", "params": {...}},
                ]
            aggregation_handler: Optional async function to aggregate results

        Returns:
            CoordinatedTask object
        """
        task_id = f"task-{uuid.uuid4().hex[:8]}"

        # Create coordinated task
        task = CoordinatedTask(
            task_id=task_id,
            description=description,
            expected_workers=[d["worker_id"] for d in subtask_definitions],
        )

        # Create subtasks
        for defn in subtask_definitions:
            subtask_id = f"{task_id}-{defn['worker_id']}"
            subtask = SubTask(
                task_id=subtask_id,
                worker_id=defn["worker_id"],
                task_type=defn["task_type"],
                params=defn.get("params", {}),
            )
            task.subtasks[defn["worker_id"]] = subtask

        self.tasks[task_id] = task

        # Register handler
        if aggregation_handler:
            self.result_handlers[task_id] = aggregation_handler

        return task

    async def dispatch_task(self, task: CoordinatedTask) -> bool:
        """
        Dispatch all subtasks to workers.

        Args:
            task: CoordinatedTask to dispatch

        Returns:
            bool: True if all dispatched successfully
        """
        print(f"[TaskCoordinator] Dispatching task: {task.task_id}")

        task.state = TaskState.DISPATCHED

        success = True
        for worker_id, subtask in task.subtasks.items():
            result = await exchanges.publish_task(
                channel=self.channel,
                worker_id=worker_id,
                task_id=subtask.task_id,
                task_type=subtask.task_type,
                task_params=subtask.params,
                from_leader=self.coordinator_id,
            )

            if result:
                subtask.state = TaskState.DISPATCHED
                subtask.dispatched_at = datetime.now()
            else:
                subtask.state = TaskState.FAILED
                success = False

        task.state = TaskState.COLLECTING
        return success

    async def wait_for_completion(
        self,
        task: CoordinatedTask,
        timeout: float = 300.0
    ) -> bool:
        """
        Wait for task to complete.

        Args:
            task: Task to wait for
            timeout: Maximum wait time in seconds

        Returns:
            bool: True if completed, False if timeout
        """
        start = asyncio.get_event_loop().time()

        while task.state not in [TaskState.COMPLETED, TaskState.FAILED]:
            if asyncio.get_event_loop().time() - start > timeout:
                print(f"[TaskCoordinator] Timeout waiting for task {task.task_id}")
                return False
            await asyncio.sleep(0.5)

        return task.state == TaskState.COMPLETED

    async def close(self):
        """Close connection"""
        if self.connection:
            await self.connection.close()
            self.connection = None
            self.channel = None
            print("[TaskCoordinator] Disconnected")


# =============================================================================
# Worker Agent
# =============================================================================

class WorkerAgent:
    """
    Worker agent that listens for tasks.

    Responsibilities:
    - Listen for tasks on queue
    - Execute task
    - Send result back
    - Update status (badge)
    """

    def __init__(self, worker_id: str):
        self.worker_id = worker_id
        self.connection: Optional[aio_pika.Connection] = None
        self.channel: Optional[aio_pika.Channel] = None
        self._task_queue = None
        self._task_handlers: Dict[str, Callable] = {}
        self._listening = False

    async def connect(self) -> bool:
        """Connect to RabbitMQ"""
        try:
            self.connection = await exchanges.connect()
            self.channel = await self.connection.channel()

            # Setup exchanges
            await exchanges.setup_exchanges(self.channel)

            print(f"[WorkerAgent] Connected as {self.worker_id}")
            return True
        except Exception as e:
            print(f"[WorkerAgent] Connection error: {e}")
            return False

    def register_handler(self, task_type: str, handler: Callable):
        """
        Register a handler for a task type.

        Args:
            task_type: Type of task (e.g., "prime_numbers")
            handler: Async function that takes params and returns result
        """
        self._task_handlers[task_type] = handler
        print(f"[WorkerAgent] Registered handler for: {task_type}")

    async def start_listening(self):
        """Start listening for tasks"""
        if self._listening:
            return

        # Create task queue for this worker
        self._task_queue = await exchanges.setup_task_queue(self.channel, self.worker_id)

        # Start consuming
        await self._task_queue.consume(self._on_task_message)
        self._listening = True

        print(f"[WorkerAgent] Listening for tasks on {self._task_queue.name}")

    async def _on_task_message(self, message: AbstractIncomingMessage):
        """Handle incoming task message"""
        async with message.process():
            try:
                data = json.loads(message.body.decode())
                task_id = data.get("taskId")
                task_type = data.get("taskType")
                params = data.get("params", {})

                print(f"[WorkerAgent] Task received: {task_id} ({task_type})")

                # Update status to RED (working)
                await self._update_status("red")

                # Find handler
                handler = self._task_handlers.get(task_type)
                if not handler:
                    print(f"[WorkerAgent] No handler for task type: {task_type}")
                    await self._send_result(task_id, None, False, f"Unknown task type: {task_type}")
                    return

                # Execute task
                try:
                    result = await handler(params)
                    await self._send_result(task_id, result, True)
                except Exception as e:
                    await self._send_result(task_id, None, False, str(e))

                # Update status to GREEN (available)
                await self._update_status("green")

            except Exception as e:
                print(f"[WorkerAgent] Error processing task: {e}")
                await self._update_status("green")

    async def _send_result(
        self,
        task_id: str,
        result: Any,
        success: bool,
        error: Optional[str] = None
    ):
        """Send result back to team leader"""
        await exchanges.publish_result(
            channel=self.channel,
            task_id=task_id,
            worker_id=self.worker_id,
            result_data=result,
            success=success,
            error_msg=error,
        )

    async def _update_status(self, status: str):
        """Update worker status via RabbitMQ"""
        try:
            await exchanges.publish_status_update(
                channel=self.channel,
                worker_id=self.worker_id,
                status=status,
                changed_by="worker-agent",
            )
        except Exception as e:
            print(f"[WorkerAgent] Status update error: {e}")

    async def close(self):
        """Close connection"""
        if self.connection:
            await self.connection.close()
            self.connection = None
            self.channel = None
            print(f"[WorkerAgent] {self.worker_id} disconnected")


# =============================================================================
# Main (for testing)
# =============================================================================

async def main():
    """Test task coordination"""
    print("=" * 60)
    print("  RAMAS Task Coordinator Test")
    print("=" * 60)

    # Test coordinator
    coordinator = TaskCoordinator()
    if not await coordinator.connect():
        print("Failed to connect coordinator")
        return

    # Setup result listener
    await coordinator.setup_result_listener()

    # Create test task
    async def aggregate_intersection(results: Dict[str, Any]) -> Any:
        """Aggregate prime and fibonacci results"""
        primes = set(results.get("worker-001", {}).get("numbers", []))
        fibs = set(results.get("worker-002", {}).get("numbers", []))
        intersection = sorted(primes & fibs)
        return {
            "intersection": intersection,
            "count": len(intersection),
            "primes_count": len(primes),
            "fibs_count": len(fibs),
        }

    task = await coordinator.create_task(
        description="Find intersection of primes and fibonacci",
        subtask_definitions=[
            {
                "worker_id": "worker-001",
                "task_type": "prime_numbers",
                "params": {"max_value": 1000},
            },
            {
                "worker_id": "worker-002",
                "task_type": "fibonacci",
                "params": {"max_value": 1000},
            },
        ],
        aggregation_handler=aggregate_intersection,
    )

    print(f"Created task: {task.task_id}")

    # Dispatch
    await coordinator.dispatch_task(task)

    print("Waiting for workers to complete...")
    print("(Run worker agents in separate terminals)")

    # Wait for completion
    success = await coordinator.wait_for_completion(task, timeout=60)

    if success:
        print(f"\n✅ Task completed!")
        print(f"Result: {json.dumps(task.final_result, indent=2)}")
    else:
        print(f"\n❌ Task failed or timeout")

    await coordinator.close()


if __name__ == "__main__":
    asyncio.run(main())
