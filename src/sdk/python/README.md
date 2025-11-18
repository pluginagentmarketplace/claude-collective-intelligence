# Python SDK for AI Agent Orchestrator

Production-grade Python SDK with asyncio support for the AI Agent Orchestrator system.

## Features

- **Async/Await**: Full asyncio support for async operations
- **Type Hints**: Complete type hints for Python 3.8+
- **Connection Pooling**: Efficient HTTP connection management
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: Typed exception classes
- **Metrics**: Built-in request metrics and monitoring

## Installation

```bash
pip install ai-agent-orchestrator
```

Or from source:

```bash
git clone <repo>
cd src/sdk/python
pip install -e .
```

## Quick Start

```python
import asyncio
from ai_agent import AgentClient, AgentCreateParams, TaskSubmitParams

async def main():
    async with AgentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key"
    ) as client:
        # Create an agent
        agent = await client.agents.create(
            AgentCreateParams(
                name="My Agent",
                type="WORKER",
                capabilities=["data-processing"]
            )
        )

        # Submit a task
        task = await client.tasks.submit(
            TaskSubmitParams(
                name="Process Data",
                type="data-processing",
                payload={"data": [...]}
            )
        )

        # Wait for completion
        result = await client.tasks.wait_for_completion(task.id)
        print(f"Task completed: {result.status}")

asyncio.run(main())
```

## API Overview

### Agents

```python
# Create agent
agent = await client.agents.create(AgentCreateParams(...))

# List agents
agents = await client.agents.list(page=1, limit=10)

# Get agent
agent = await client.agents.get(agent_id)

# Update agent
updated = await client.agents.update(agent_id, updates)

# Delete agent
await client.agents.delete(agent_id)

# Get capabilities
caps = await client.agents.get_capabilities(agent_id)

# Check capability
has_it = await client.agents.has_capability(agent_id, 'cap')
```

### Tasks

```python
# Submit task
task = await client.tasks.submit(TaskSubmitParams(...))

# Get task
task = await client.tasks.get(task_id)

# List tasks
tasks = await client.tasks.list(page=1, limit=10)

# Wait for completion
task = await client.tasks.wait_for_completion(task_id, timeout=60)

# Cancel task
await client.tasks.cancel(task_id)

# Retry task
await client.tasks.retry(task_id)

# Batch operations
tasks = await client.tasks.submit_batch([...])
results = await client.tasks.wait_for_all([...])
```

## Error Handling

```python
from ai_agent import (
    ValidationError,
    NotFoundError,
    TimeoutError,
    AgentClientError
)

try:
    task = await client.tasks.submit(params)
except ValidationError as e:
    print(f"Validation failed: {e.details}")
except NotFoundError as e:
    print(f"Not found: {e}")
except TimeoutError as e:
    print(f"Timeout after {e.timeout}ms")
except AgentClientError as e:
    print(f"Error: {e.code} - {e.message}")
```

## Configuration

```python
client = AgentClient(
    api_url="http://localhost:3000",
    api_key="your-api-key",
    timeout=30,              # Request timeout in seconds
    max_retries=3,           # Max retry attempts
    retry_config=RetryConfig(
        max_retries=3,
        initial_delay=100,   # ms
        max_delay=10000,     # ms
        backoff_multiplier=2.0
    ),
    pool_config=PoolConfig(
        max_connections=10,
        max_idle_time=60000  # ms
    )
)
```

## Async Context Manager

The SDK supports async context managers for automatic resource cleanup:

```python
async with AgentClient(...) as client:
    # Use client
    agent = await client.agents.create(...)
    # Resources automatically cleaned up on exit
```

## Metrics

```python
metrics = client.get_metrics()
print(f"Total requests: {metrics.total_requests}")
print(f"Success rate: {metrics.success_rate:.2f}%")
print(f"Average latency: {metrics.average_latency:.2f}ms")
```

## Health Check

```python
health = await client.health()
print(health.status)  # 'UP', 'DOWN', or 'DEGRADED'
print(health.checks)  # Status of individual checks
```

## Testing

```bash
# Install development dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Watch mode
pytest-watch

# Coverage
pytest --cov=ai_agent
```

## Documentation

- [API Client Guide](../../API_CLIENT_GUIDE.md)
- [SDK Development Guide](../../SDK_DEVELOPMENT_GUIDE.md)
- [Integration Examples](../../INTEGRATION_EXAMPLES.md)

## License

MIT
