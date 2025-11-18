# API Client Guide

Comprehensive guide for using Client SDKs and REST API clients to interact with the AI Agent Orchestrator.

## Table of Contents

1. [TypeScript SDK](#typescript-sdk)
2. [Python SDK](#python-sdk)
3. [REST API Clients](#rest-api-clients)
4. [Error Handling](#error-handling)
5. [Advanced Features](#advanced-features)
6. [Best Practices](#best-practices)

## TypeScript SDK

### Installation

```bash
npm install @ai-agent/typescript-sdk
```

### Basic Setup

```typescript
import { AgentClient } from '@ai-agent/typescript-sdk';

const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
  timeout: 30000,
  maxRetries: 3
});
```

### Creating and Managing Agents

```typescript
// Create an agent
const agent = await client.agents.create({
  name: 'Data Processor',
  type: 'WORKER',
  capabilities: ['data-processing', 'analysis']
});

// Get agent details
const agentDetails = await client.agents.get(agent.id);

// List all agents
const agents = await client.agents.list({
  page: 1,
  limit: 10,
  type: 'WORKER'
});

// Update agent
const updated = await client.agents.update(agent.id, {
  name: 'Updated Data Processor'
});

// Check agent capabilities
const hasCapability = await client.agents.hasCapability(
  agent.id,
  'data-processing'
);

// Delete agent
await client.agents.delete(agent.id);
```

### Submitting and Managing Tasks

```typescript
// Submit a task
const task = await client.tasks.submit({
  name: 'Process Customer Data',
  type: 'data-processing',
  priority: 'HIGH',
  payload: {
    customers: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]
  },
  config: {
    timeout: 60000,
    retryPolicy: {
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2
    }
  }
});

// Get task details
const taskDetails = await client.tasks.get(task.id);

// Get task status
const status = await client.tasks.getStatus(task.id);

// Wait for completion (with timeout)
const completed = await client.tasks.waitForCompletion(task.id, 60000);

// Get task result
const result = await client.tasks.getResult(task.id);

// Get task error (if any)
const error = await client.tasks.getError(task.id);

// Cancel a task
await client.tasks.cancel(task.id, 'User requested cancellation');

// Retry a task
await client.tasks.retry(task.id);
```

### Batch Operations

```typescript
// Submit multiple tasks
const tasks = await client.tasks.submitBatch([
  {
    name: 'Task 1',
    type: 'processing',
    payload: { data: 'content1' }
  },
  {
    name: 'Task 2',
    type: 'processing',
    payload: { data: 'content2' }
  }
]);

// Wait for all tasks
const results = await client.tasks.waitForAll(
  tasks.map(t => t.id),
  120000 // 2 minute timeout
);
```

## Python SDK

### Installation

```bash
pip install ai-agent-orchestrator
```

### Basic Setup

```python
from ai_agent import AgentClient

client = AgentClient(
    api_url="http://localhost:3000",
    api_key="your-api-key",
    timeout=30,
    max_retries=3
)
```

### Creating and Managing Agents

```python
from ai_agent import AgentCreateParams

# Create an agent
agent = await client.agents.create(
    AgentCreateParams(
        name="Data Processor",
        type="WORKER",
        capabilities=["data-processing", "analysis"]
    )
)

# Get agent details
agent_details = await client.agents.get(agent.id)

# List agents
agents = await client.agents.list(
    page=1,
    limit=10,
    agent_type="WORKER"
)

# Check capabilities
has_capability = await client.agents.has_capability(
    agent.id,
    "data-processing"
)

# Delete agent
await client.agents.delete(agent.id)
```

### Submitting and Managing Tasks

```python
from ai_agent import TaskSubmitParams

# Submit a task
task = await client.tasks.submit(
    TaskSubmitParams(
        name="Process Data",
        type="data-processing",
        priority="HIGH",
        payload={
            "customers": [
                {"id": 1, "name": "Alice"},
                {"id": 2, "name": "Bob"}
            ]
        }
    )
)

# Wait for completion
completed = await client.tasks.wait_for_completion(task.id, timeout=60)

# Get result
result = await client.tasks.get_result(task.id)

# Cancel task
await client.tasks.cancel(task.id, "User requested")

# Retry task
await client.tasks.retry(task.id)
```

### Async Context Manager

```python
async with AgentClient(
    api_url="http://localhost:3000",
    api_key="your-api-key"
) as client:
    agent = await client.agents.create(...)
    task = await client.tasks.submit(...)
    # Resources automatically cleaned up
```

## REST API Clients

### Fetch-based Client (Browser/Node.js)

```typescript
// Create agent via fetch
const createAgent = async (name: string, type: string) => {
  const response = await fetch('http://localhost:3000/agents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      name,
      type,
      capabilities: []
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create agent: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
};

// Submit task via fetch
const submitTask = async (name: string, type: string, payload: any) => {
  const response = await fetch('http://localhost:3000/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      name,
      type,
      payload
    })
  });

  const data = await response.json();
  return data.data;
};
```

### Axios-based Client

```typescript
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Authorization': 'Bearer your-api-key'
  }
});

// Create agent
const agent = await axiosInstance.post('/agents', {
  name: 'Agent Name',
  type: 'WORKER',
  capabilities: []
});

// List agents
const agents = await axiosInstance.get('/agents', {
  params: {
    page: 1,
    limit: 10
  }
});

// Submit task
const task = await axiosInstance.post('/tasks', {
  name: 'Task Name',
  type: 'processing',
  payload: {}
});

// Wait for task (polling)
const waitForTask = async (taskId: string) => {
  let task;
  while (true) {
    const response = await axiosInstance.get(`/tasks/${taskId}`);
    task = response.data.data;

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)) {
      return task;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
};
```

### Python Requests Client

```python
import requests
import time

BASE_URL = 'http://localhost:3000'
API_KEY = 'your-api-key'
HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}'
}

def create_agent(name: str, agent_type: str) -> dict:
    """Create an agent"""
    response = requests.post(
        f'{BASE_URL}/agents',
        headers=HEADERS,
        json={
            'name': name,
            'type': agent_type,
            'capabilities': []
        }
    )
    response.raise_for_status()
    return response.json()['data']

def submit_task(name: str, task_type: str, payload: dict) -> dict:
    """Submit a task"""
    response = requests.post(
        f'{BASE_URL}/tasks',
        headers=HEADERS,
        json={
            'name': name,
            'type': task_type,
            'payload': payload
        }
    )
    response.raise_for_status()
    return response.json()['data']

def wait_for_task(task_id: str, timeout: int = 3600) -> dict:
    """Wait for task completion"""
    start_time = time.time()

    while time.time() - start_time < timeout:
        response = requests.get(
            f'{BASE_URL}/tasks/{task_id}',
            headers=HEADERS
        )
        response.raise_for_status()
        task = response.json()['data']

        if task['status'] in ['COMPLETED', 'FAILED', 'CANCELLED']:
            return task

        time.sleep(1)

    raise TimeoutError(f'Task {task_id} did not complete within {timeout}s')
```

## Error Handling

### TypeScript

```typescript
import {
  ValidationError,
  NotFoundError,
  TimeoutError,
  RateLimitError,
  AgentClientError
} from '@ai-agent/typescript-sdk';

try {
  const task = await client.tasks.submit(taskParams);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.details);
  } else if (error instanceof NotFoundError) {
    console.error('Resource not found');
  } else if (error instanceof TimeoutError) {
    console.error('Request timeout:', error.timeout);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after:', error.retryAfter);
  } else if (error instanceof AgentClientError) {
    console.error('Client error:', error.code, error.message);
  }
}
```

### Python

```python
from ai_agent import (
    ValidationError,
    NotFoundError,
    TimeoutError,
    RateLimitError,
    AgentClientError
)

try:
    task = await client.tasks.submit(task_params)
except ValidationError as e:
    print(f"Validation failed: {e.details}")
except NotFoundError as e:
    print(f"Not found: {e}")
except TimeoutError as e:
    print(f"Timeout after {e.timeout}ms")
except RateLimitError as e:
    print(f"Rate limited, retry after {e.retry_after}s")
except AgentClientError as e:
    print(f"Error: {e.code} - {e.message}")
```

## Advanced Features

### Connection Pooling

```typescript
const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
  poolConfig: {
    maxConnections: 20,
    maxIdleTime: 60000
  }
});
```

### Request Interceptors

```typescript
const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
  requestInterceptors: [
    async (config) => {
      // Add custom headers
      config.headers = {
        ...config.headers,
        'X-Request-ID': generateUUID()
      };
      return config;
    }
  ]
});
```

### Retry Configuration

```typescript
import { RetryPresets } from '@ai-agent/typescript-sdk';

const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
  retryConfig: RetryPresets.aggressive // or moderate, conservative, none
});
```

### Metrics and Monitoring

```typescript
// Get client metrics
const metrics = client.getMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Success rate: ${metrics.successRate.toFixed(2)}%`);
console.log(`Average latency: ${metrics.averageLatency.toFixed(2)}ms`);

// Health check
const health = await client.health();
console.log(`API Health: ${health.status}`);
```

## Best Practices

### 1. Connection Management

```typescript
// Always close client when done
try {
  const client = new AgentClient({...});
  // Use client
} finally {
  await client.close();
}

// Or use async context manager
async with AgentClient(...) as client:
    # Use client
```

### 2. Error Handling

Always handle specific errors:

```typescript
try {
  const task = await client.tasks.submit(params);
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout
  } else if (error instanceof ValidationError) {
    // Handle validation
  } else {
    // Handle other errors
  }
}
```

### 3. Batch Operations

Use batch operations for multiple items:

```typescript
// Good - single request for multiple tasks
const tasks = await client.tasks.submitBatch(taskArray);

// Avoid - multiple requests
for (const params of taskArray) {
  await client.tasks.submit(params);
}
```

### 4. Retry Logic

Use SDK's built-in retry:

```typescript
// SDK handles retries automatically
const task = await client.tasks.submit(params);

// Avoid - manual retry loops
let attempts = 0;
while (attempts < 3) {
  try {
    break;
  } catch {
    attempts++;
  }
}
```

### 5. Timeout Configuration

Set appropriate timeouts:

```typescript
// Short operations
await client.tasks.get(taskId, { timeout: 5000 });

// Long operations
await client.tasks.waitForCompletion(taskId, 300000); // 5 minutes
```

### 6. Resource Cleanup

Always cleanup resources:

```typescript
// TypeScript
await client.close();

// Python
async with AgentClient(...) as client:
    # Automatic cleanup
```

## API Endpoints Reference

### Agents

- `POST /agents` - Create agent
- `GET /agents` - List agents
- `GET /agents/:id` - Get agent
- `PUT /agents/:id` - Update agent
- `DELETE /agents/:id` - Delete agent
- `GET /agents/:id/status` - Get agent status

### Tasks

- `POST /tasks` - Submit task
- `GET /tasks` - List tasks
- `GET /tasks/:id` - Get task
- `POST /tasks/:id/cancel` - Cancel task
- `POST /tasks/:id/retry` - Retry task
- `GET /tasks/:id/result` - Get task result

### System

- `GET /health` - Health check
- `GET /metrics` - System metrics
- `GET /status` - System status

## More Resources

- [SDK Development Guide](./SDK_DEVELOPMENT_GUIDE.md)
- [Integration Examples](./INTEGRATION_EXAMPLES.md)
- [API Examples](./API_EXAMPLES.md)
