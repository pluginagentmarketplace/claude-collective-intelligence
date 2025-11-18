"""
Managers for agents and tasks
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any

from .types import Agent, AgentCreateParams, Task, TaskSubmitParams, TaskStatus
from .errors import TimeoutError as ClientTimeoutError

logger = logging.getLogger(__name__)


class AgentsManager:
    """Manage agent operations"""

    def __init__(self, client):
        self.client = client

    async def create(self, params: AgentCreateParams) -> Agent:
        """Create a new agent"""
        data = {
            "name": params.name,
            "type": params.type,
            "capabilities": params.capabilities,
            **({"metadata": params.metadata} if params.metadata else {}),
        }
        result = await self.client.request("POST", "/agents", data)
        return self._to_agent(result)

    async def get(self, agent_id: str) -> Agent:
        """Get agent by ID"""
        result = await self.client.request("GET", f"/agents/{agent_id}")
        return self._to_agent(result)

    async def list(
        self,
        page: int = 1,
        limit: int = 10,
        agent_type: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List agents"""
        params = [f"page={page}", f"limit={limit}"]
        if agent_type:
            params.append(f"type={agent_type}")
        if status:
            params.append(f"status={status}")

        query = "&".join(params)
        result = await self.client.request("GET", f"/agents?{query}")
        return result

    async def update(self, agent_id: str, updates: Dict[str, Any]) -> Agent:
        """Update agent"""
        result = await self.client.request("PUT", f"/agents/{agent_id}", updates)
        return self._to_agent(result)

    async def delete(self, agent_id: str) -> None:
        """Delete agent"""
        await self.client.request("DELETE", f"/agents/{agent_id}")

    async def get_status(self, agent_id: str) -> str:
        """Get agent status"""
        agent = await self.get(agent_id)
        return agent.status

    async def get_capabilities(self, agent_id: str) -> List[str]:
        """Get agent capabilities"""
        agent = await self.get(agent_id)
        return agent.capabilities

    async def has_capability(self, agent_id: str, capability: str) -> bool:
        """Check if agent has capability"""
        capabilities = await self.get_capabilities(agent_id)
        return capability in capabilities

    @staticmethod
    def _to_agent(data: Dict[str, Any]) -> Agent:
        """Convert dict to Agent"""
        return Agent(
            id=data["id"],
            name=data["name"],
            type=data["type"],
            status=data["status"],
            capabilities=data["capabilities"],
            created_at=data["createdAt"],
            updated_at=data["updatedAt"],
        )


class TasksManager:
    """Manage task operations"""

    def __init__(self, client):
        self.client = client
        self.poll_interval = 1  # 1 second
        self.max_poll_wait = 3600  # 1 hour

    async def submit(self, params: TaskSubmitParams) -> Task:
        """Submit a task"""
        data = {
            "name": params.name,
            "type": params.type,
            "payload": params.payload,
            **({"description": params.description} if params.description else {}),
            **({"priority": params.priority} if params.priority else {}),
            **({"config": params.config} if params.config else {}),
            **({"metadata": params.metadata} if params.metadata else {}),
        }
        result = await self.client.request("POST", "/tasks", data)
        return self._to_task(result)

    async def get(self, task_id: str) -> Task:
        """Get task by ID"""
        result = await self.client.request("GET", f"/tasks/{task_id}")
        return self._to_task(result)

    async def list(
        self,
        page: int = 1,
        limit: int = 10,
        status: Optional[str] = None,
        agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """List tasks"""
        params = [f"page={page}", f"limit={limit}"]
        if status:
            params.append(f"status={status}")
        if agent_id:
            params.append(f"agentId={agent_id}")

        query = "&".join(params)
        result = await self.client.request("GET", f"/tasks?{query}")
        return result

    async def get_status(self, task_id: str) -> TaskStatus:
        """Get task status"""
        task = await self.get(task_id)
        return task.status

    async def wait_for_completion(
        self, task_id: str, timeout: Optional[int] = None
    ) -> Task:
        """Wait for task completion"""
        start_time = asyncio.get_event_loop().time()
        effective_timeout = timeout or self.max_poll_wait

        while True:
            task = await self.get(task_id)

            # Task completed or failed
            if task.status in [
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                "TIMED_OUT",
            ]:
                return task

            # Check timeout
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed > effective_timeout:
                raise ClientTimeoutError(
                    f"Task {task_id} did not complete within {effective_timeout}s",
                    int(effective_timeout * 1000),
                )

            # Wait before next poll
            await asyncio.sleep(self.poll_interval)

    async def cancel(self, task_id: str, reason: Optional[str] = None) -> Task:
        """Cancel a task"""
        data = {"reason": reason or "Cancelled by client"}
        result = await self.client.request(
            "POST", f"/tasks/{task_id}/cancel", data
        )
        return self._to_task(result)

    async def retry(self, task_id: str) -> Task:
        """Retry a task"""
        result = await self.client.request("POST", f"/tasks/{task_id}/retry")
        return self._to_task(result)

    async def get_result(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task result"""
        task = await self.get(task_id)
        return task.result

    async def get_error(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task error"""
        task = await self.get(task_id)
        return task.error

    async def submit_batch(self, task_params: List[TaskSubmitParams]) -> List[Task]:
        """Submit multiple tasks"""
        return await asyncio.gather(
            *[self.submit(params) for params in task_params]
        )

    async def wait_for_all(
        self, task_ids: List[str], timeout: Optional[int] = None
    ) -> List[Task]:
        """Wait for multiple tasks"""
        return await asyncio.gather(
            *[self.wait_for_completion(task_id, timeout) for task_id in task_ids]
        )

    @staticmethod
    def _to_task(data: Dict[str, Any]) -> Task:
        """Convert dict to Task"""
        return Task(
            id=data["id"],
            name=data["name"],
            type=data["type"],
            status=data["status"],
            priority=data.get("priority", "NORMAL"),
            payload=data["payload"],
            created_at=data["createdAt"],
            updated_at=data["updatedAt"],
            result=data.get("result"),
            error=data.get("error"),
            assigned_agent_id=data.get("assignedAgentId"),
        )
