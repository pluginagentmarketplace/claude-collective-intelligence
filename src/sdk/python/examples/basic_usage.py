"""
Basic usage examples for Python SDK
"""

import asyncio
from ai_agent import (
    AgentClient,
    AgentCreateParams,
    TaskSubmitParams,
    ValidationError,
    NotFoundError,
    TimeoutError,
    AgentClientError,
)


async def example1():
    """Example 1: Create an agent and submit a task"""
    async with AgentClient(
        api_url="http://localhost:3000", api_key="your-api-key"
    ) as client:
        try:
            # Create an agent
            agent = await client.agents.create(
                AgentCreateParams(
                    name="Data Processing Agent",
                    type="WORKER",
                    capabilities=["data-processing", "analysis"],
                )
            )
            print(f"Agent created: {agent.id}")

            # Submit a task
            task = await client.tasks.submit(
                TaskSubmitParams(
                    name="Process Customer Data",
                    type="data-processing",
                    payload={
                        "customers": [
                            {"id": 1, "name": "Alice", "email": "alice@example.com"},
                            {"id": 2, "name": "Bob", "email": "bob@example.com"},
                        ]
                    },
                )
            )
            print(f"Task submitted: {task.id}")

            # Wait for completion
            result = await client.tasks.wait_for_completion(task.id)
            print(f"Task completed: {result.status}")
            print(f"Result: {result.result}")
        except Exception as error:
            print(f"Error: {error}")


async def example2():
    """Example 2: List agents and filter by type"""
    async with AgentClient(
        api_url="http://localhost:3000", api_key="your-api-key"
    ) as client:
        try:
            # List all agents
            agents_response = await client.agents.list()
            print(f"Found {agents_response['pagination']['total']} agents")

            # Check agent statuses
            for agent_data in agents_response["data"]:
                agent = await client.agents.get(agent_data["id"])
                capabilities = await client.agents.get_capabilities(agent.id)
                print(
                    f"{agent.name}: {agent.status} - capabilities: {', '.join(capabilities)}"
                )
        except Exception as error:
            print(f"Error: {error}")


async def example3():
    """Example 3: Submit multiple tasks and wait for all"""
    async with AgentClient(
        api_url="http://localhost:3000", api_key="your-api-key"
    ) as client:
        try:
            task_params = [
                TaskSubmitParams(name="Task 1", type="processing", payload={"data": "content1"}),
                TaskSubmitParams(name="Task 2", type="processing", payload={"data": "content2"}),
                TaskSubmitParams(name="Task 3", type="processing", payload={"data": "content3"}),
            ]

            # Submit all tasks
            submitted_tasks = await client.tasks.submit_batch(task_params)
            print(f"Submitted {len(submitted_tasks)} tasks")

            # Wait for all to complete
            results = await client.tasks.wait_for_all(
                [t.id for t in submitted_tasks], timeout=60
            )

            # Process results
            for task in results:
                print(f"Task {task.id}: {task.status}")
                if task.result:
                    print(f"  Result: {task.result}")
                if task.error:
                    print(f"  Error: {task.error.message}")
        except Exception as error:
            print(f"Error: {error}")


async def example4():
    """Example 4: Error handling"""
    async with AgentClient(
        api_url="http://localhost:3000", api_key="your-api-key"
    ) as client:
        try:
            # Try to submit a task
            await client.tasks.submit(
                TaskSubmitParams(
                    name="My Task", type="invalid-type", payload={}
                )
            )
        except ValidationError as error:
            print(f"Validation failed: {error.details}")
        except NotFoundError as error:
            print(f"Resource not found: {error}")
        except TimeoutError as error:
            print(f"Request timed out after {error.timeout}ms")
        except AgentClientError as error:
            print(f"Client error: {error.code} - {error.message}")


async def example5():
    """Example 5: Check health and metrics"""
    async with AgentClient(
        api_url="http://localhost:3000", api_key="your-api-key"
    ) as client:
        try:
            # Check API health
            health = await client.health()
            print(f"Health status: {health.status}")
            print(f"Health checks: {health.checks}")

            # Get client metrics
            metrics = client.get_metrics()
            print("Client Metrics:")
            print(f"  Total requests: {metrics.total_requests}")
            print(f"  Success rate: {metrics.success_rate:.2f}%")
            print(f"  Error rate: {metrics.error_rate:.2f}%")
            print(f"  Average latency: {metrics.average_latency:.2f}ms")
        except Exception as error:
            print(f"Error: {error}")


async def example6():
    """Example 6: Task cancellation and retry"""
    async with AgentClient(
        api_url="http://localhost:3000", api_key="your-api-key"
    ) as client:
        try:
            # Submit a task
            task = await client.tasks.submit(
                TaskSubmitParams(
                    name="Long Running Task",
                    type="processing",
                    payload={"duration": 3600000},  # 1 hour
                )
            )
            print(f"Task started: {task.id}")

            # Wait a bit, then cancel
            await asyncio.sleep(5)

            cancelled = await client.tasks.cancel(task.id, "User cancelled")
            print(f"Task cancelled: {cancelled.status}")

            # Try again
            retried = await client.tasks.retry(task.id)
            print(f"Task retried: {retried.status}")
        except Exception as error:
            print(f"Error: {error}")


async def main():
    """Run all examples"""
    print("Running Python SDK Examples\n")

    print("=== Example 1: Basic Usage ===")
    await example1()

    print("\n=== Example 2: List and Query Agents ===")
    await example2()

    print("\n=== Example 3: Batch Operations ===")
    await example3()

    print("\n=== Example 4: Error Handling ===")
    await example4()

    print("\n=== Example 5: Health and Metrics ===")
    await example5()

    print("\n=== Example 6: Cancellation and Retry ===")
    await example6()


if __name__ == "__main__":
    asyncio.run(main())
