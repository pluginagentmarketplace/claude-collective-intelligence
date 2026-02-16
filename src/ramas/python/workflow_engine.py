#!/usr/bin/env python3
"""
RAMAS: Workflow Engine

PATTERN-C-003: Autonomous Multi-Agent Orchestration

Manages autonomous workflow execution - tracks tasks and triggers
agents at appropriate times without human intervention.

WORKFLOW LIFECYCLE:
1. Team Leader assigns task → WorkflowEngine.on_task_assigned()
2. Worker is AUTO-TRIGGERED via AgentTrigger
3. Worker completes task → WorkflowEngine.on_task_completed()
4. If all tasks complete → Team Leader is AUTO-TRIGGERED

PERSISTENCE:
State is saved to /tmp/ramas-workflow-state.json
Survives daemon restart!

Author: Dr. Umit Kacar
Date: 2026-01-03
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Set, Optional, Any

from .agent_trigger import AgentTrigger, get_agent_trigger

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

WORKFLOW_STATE_PATH = Path("/tmp/ramas-workflow-state.json")
WORKFLOW_TTL_SECONDS = 3600 * 24  # 24 hours - completed workflows cleaned up after this


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class WorkflowState:
    """Tracks state of a workflow (session)."""
    session_id: str
    leader_id: str
    pending_tasks: Set[str] = field(default_factory=set)
    completed_tasks: Set[str] = field(default_factory=set)
    worker_assignments: Dict[str, str] = field(default_factory=dict)  # task_id -> worker_id
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        return {
            "session_id": self.session_id,
            "leader_id": self.leader_id,
            "pending_tasks": list(self.pending_tasks),
            "completed_tasks": list(self.completed_tasks),
            "worker_assignments": self.worker_assignments,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkflowState":
        """Create from JSON dict."""
        return cls(
            session_id=data["session_id"],
            leader_id=data["leader_id"],
            pending_tasks=set(data.get("pending_tasks", [])),
            completed_tasks=set(data.get("completed_tasks", [])),
            worker_assignments=data.get("worker_assignments", {}),
            created_at=data.get("created_at", time.time()),
            completed_at=data.get("completed_at"),
        )


# =============================================================================
# WorkflowEngine Class
# =============================================================================

class WorkflowEngine:
    """
    Manages autonomous workflow execution.

    RESPONSIBILITIES:
    1. Track task assignments (who is doing what)
    2. Track task completions
    3. Auto-trigger workers when tasks are assigned
    4. Auto-trigger leader when all tasks complete

    USAGE:
        engine = WorkflowEngine()

        # When Team Leader assigns task
        await engine.on_task_assigned(
            session_id="session-123",
            task_id="task-456",
            worker_id="worker-001",
            leader_id="team-leader",
        )
        # → Worker-001 is AUTO-TRIGGERED!

        # When Worker completes task
        await engine.on_task_completed(
            session_id="session-123",
            task_id="task-456",
        )
        # → If all tasks done, Team Leader is AUTO-TRIGGERED!
    """

    def __init__(
        self,
        agent_trigger: AgentTrigger = None,
        state_path: Path = WORKFLOW_STATE_PATH,
    ):
        self.trigger = agent_trigger or get_agent_trigger()
        self.state_path = state_path

        # Active workflows: session_id -> WorkflowState
        self.workflows: Dict[str, WorkflowState] = {}

        # Load state from disk
        self._load_state()

    # =========================================================================
    # Public API
    # =========================================================================

    async def on_task_assigned(
        self,
        session_id: str,
        task_id: str,
        worker_id: str,
        leader_id: str,
        urgent: bool = False,
    ):
        """
        Called when Team Leader assigns a task to a worker.

        ACTIONS:
        1. Create/update workflow state
        2. Track task assignment
        3. AUTO-TRIGGER the worker!

        Args:
            session_id: Session identifier
            task_id: Unique task identifier
            worker_id: Worker being assigned (e.g., "worker-001")
            leader_id: Team Leader identifier
            urgent: If True, force trigger worker even if busy
        """
        logger.info(f"Task assigned: session={session_id}, task={task_id}, worker={worker_id}")

        # Get or create workflow
        if session_id not in self.workflows:
            self.workflows[session_id] = WorkflowState(
                session_id=session_id,
                leader_id=leader_id,
            )
            logger.info(f"Created new workflow for session {session_id}")

        workflow = self.workflows[session_id]

        # Skip if task already assigned (idempotency)
        if task_id in workflow.pending_tasks or task_id in workflow.completed_tasks:
            logger.warning(f"Task {task_id} already tracked, skipping")
            return

        # Track assignment
        workflow.pending_tasks.add(task_id)
        workflow.worker_assignments[task_id] = worker_id

        # Save state
        self._save_state()

        # PATTERN-C-003 v3 Phase 1: Disable iTerm2 trigger
        # Workers now PULL from inbox (polling loop) instead of being PUSHED to
        # This is more reliable because Claude Code is an LLM, not a command interpreter
        #
        # TODO Phase 2: Replace with Redis wake signal for instant notification
        #   redis.xadd(f"ramas:wake:{worker_id}", {"event": "task_assigned"})
        #
        # OLD CODE (iTerm2 text injection - unreliable):
        # success = await self.trigger.trigger_agent(
        #     agent_id=worker_id,
        #     session_id=session_id,
        #     message_type="task",
        #     urgent=urgent,
        # )
        # if success:
        #     logger.info(f"Worker {worker_id} triggered for task {task_id}")
        # else:
        #     logger.warning(f"Failed to trigger worker {worker_id} for task {task_id}")

        logger.info(f"Task {task_id} assigned to {worker_id} - worker will poll inbox")

    async def on_task_completed(
        self,
        session_id: str,
        task_id: str,
        result: Optional[Dict[str, Any]] = None,
    ):
        """
        Called when a Worker completes a task.

        ACTIONS:
        1. Move task from pending to completed
        2. Check if all tasks are done
        3. If all done, AUTO-TRIGGER the leader!

        Args:
            session_id: Session identifier
            task_id: Task that was completed
            result: Optional task result data
        """
        logger.info(f"Task completed: session={session_id}, task={task_id}")

        workflow = self.workflows.get(session_id)
        if not workflow:
            logger.warning(f"No workflow found for session {session_id}")
            return

        # Skip if task not in pending (already completed or unknown)
        if task_id not in workflow.pending_tasks:
            if task_id in workflow.completed_tasks:
                logger.info(f"Task {task_id} already completed, skipping")
            else:
                logger.warning(f"Task {task_id} not found in workflow")
            return

        # Move to completed
        workflow.pending_tasks.discard(task_id)
        workflow.completed_tasks.add(task_id)

        # Save state
        self._save_state()

        logger.info(f"Workflow {session_id}: {len(workflow.completed_tasks)} completed, {len(workflow.pending_tasks)} pending")

        # Check if ALL tasks complete
        if len(workflow.pending_tasks) == 0:
            await self._on_all_tasks_complete(workflow)

    async def get_workflow_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a workflow."""
        workflow = self.workflows.get(session_id)
        if not workflow:
            return None

        return {
            "session_id": workflow.session_id,
            "leader_id": workflow.leader_id,
            "pending_count": len(workflow.pending_tasks),
            "completed_count": len(workflow.completed_tasks),
            "pending_tasks": list(workflow.pending_tasks),
            "completed_tasks": list(workflow.completed_tasks),
            "is_complete": len(workflow.pending_tasks) == 0 and len(workflow.completed_tasks) > 0,
        }

    def list_active_workflows(self) -> List[Dict[str, Any]]:
        """List all active (incomplete) workflows."""
        return [
            {
                "session_id": w.session_id,
                "leader_id": w.leader_id,
                "pending": len(w.pending_tasks),
                "completed": len(w.completed_tasks),
            }
            for w in self.workflows.values()
            if w.completed_at is None
        ]

    async def cleanup_completed_workflows(self, max_age_seconds: float = WORKFLOW_TTL_SECONDS):
        """Remove old completed workflows."""
        now = time.time()
        to_remove = []

        for session_id, workflow in self.workflows.items():
            if workflow.completed_at is not None:
                age = now - workflow.completed_at
                if age > max_age_seconds:
                    to_remove.append(session_id)

        for session_id in to_remove:
            del self.workflows[session_id]
            logger.info(f"Cleaned up completed workflow: {session_id}")

        if to_remove:
            self._save_state()

    # =========================================================================
    # Private: Workflow Completion
    # =========================================================================

    async def _on_all_tasks_complete(self, workflow: WorkflowState):
        """
        Called when all tasks in a workflow are complete.

        ACTION: Auto-trigger the Team Leader to aggregate results!
        """
        logger.info(f"All tasks complete for session {workflow.session_id}! Triggering leader...")

        # Mark workflow as complete
        workflow.completed_at = time.time()
        self._save_state()

        # PATTERN-C-003 v3 Phase 1: Disable iTerm2 trigger
        # Team Leader now PULLS from inbox (polling loop) instead of being PUSHED to
        #
        # TODO Phase 2: Replace with Redis wake signal for instant notification
        #   redis.xadd(f"ramas:wake:{workflow.leader_id}", {"event": "all_tasks_complete"})
        #
        # OLD CODE (iTerm2 text injection - unreliable):
        # success = await self.trigger.trigger_agent(
        #     agent_id=workflow.leader_id,
        #     session_id=workflow.session_id,
        #     message_type="result",
        #     urgent=False,
        # )
        # if success:
        #     logger.info(f"Team Leader {workflow.leader_id} triggered for result aggregation")
        # else:
        #     logger.warning(f"Failed to trigger Team Leader {workflow.leader_id}")

        logger.info(f"All tasks complete for {workflow.session_id} - leader will poll inbox for results")

    # =========================================================================
    # Private: Persistence
    # =========================================================================

    def _save_state(self):
        """Save workflow state to disk."""
        try:
            data = {
                "workflows": {
                    session_id: workflow.to_dict()
                    for session_id, workflow in self.workflows.items()
                },
                "saved_at": time.time(),
                "version": "1.0.0",
            }

            with open(self.state_path, 'w') as f:
                json.dump(data, f, indent=2)

            logger.debug(f"Saved {len(self.workflows)} workflows to disk")

        except Exception as e:
            logger.error(f"Error saving workflow state: {e}")

    def _load_state(self):
        """Load workflow state from disk."""
        try:
            if not self.state_path.exists():
                logger.info("No workflow state file found, starting fresh")
                return

            with open(self.state_path, 'r') as f:
                data = json.load(f)

            workflows_data = data.get("workflows", {})
            for session_id, workflow_data in workflows_data.items():
                self.workflows[session_id] = WorkflowState.from_dict(workflow_data)

            if self.workflows:
                logger.info(f"Loaded {len(self.workflows)} workflows from disk")

                # Log active workflows
                active = [w for w in self.workflows.values() if w.completed_at is None]
                if active:
                    logger.info(f"Active workflows: {[w.session_id for w in active]}")

        except Exception as e:
            logger.error(f"Error loading workflow state: {e}")


# =============================================================================
# Singleton Instance
# =============================================================================

_workflow_engine_instance: Optional[WorkflowEngine] = None


def get_workflow_engine() -> WorkflowEngine:
    """Get singleton WorkflowEngine instance."""
    global _workflow_engine_instance
    if _workflow_engine_instance is None:
        _workflow_engine_instance = WorkflowEngine()
    return _workflow_engine_instance


# =============================================================================
# Main (for testing)
# =============================================================================

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    async def main():
        engine = get_workflow_engine()

        if len(sys.argv) >= 2:
            command = sys.argv[1]

            if command == "status":
                workflows = engine.list_active_workflows()
                print(f"\nActive Workflows: {len(workflows)}")
                for w in workflows:
                    print(f"  - {w['session_id']}: {w['completed']}/{w['completed']+w['pending']} tasks complete")

            elif command == "get" and len(sys.argv) >= 3:
                session_id = sys.argv[2]
                status = await engine.get_workflow_status(session_id)
                if status:
                    print(f"\nWorkflow: {session_id}")
                    print(f"  Leader: {status['leader_id']}")
                    print(f"  Completed: {status['completed_count']}")
                    print(f"  Pending: {status['pending_count']}")
                    print(f"  Is Complete: {status['is_complete']}")
                else:
                    print(f"Workflow {session_id} not found")

            elif command == "cleanup":
                await engine.cleanup_completed_workflows()
                print("Cleanup complete")

            else:
                print("Unknown command")
        else:
            print("Usage:")
            print("  python workflow_engine.py status")
            print("  python workflow_engine.py get <session_id>")
            print("  python workflow_engine.py cleanup")

    asyncio.run(main())
