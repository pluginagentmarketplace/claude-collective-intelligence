# SDK Development Guide

## Overview

This guide covers the development and usage of Client SDKs for the AI Agent Orchestrator system. We provide production-grade SDKs for TypeScript, Python, and REST-based clients.

## Architecture

### TypeScript SDK
- **Type-safe** with full TypeScript support
- **Async/await** syntax for all operations
- **Connection pooling** for optimal resource usage
- **Typed error handling** with custom error classes
- **Retry logic** with exponential backoff
- **Request/response** type safety
- **npm** distribution

### Python SDK
- **Asyncio** support for async operations
- **Type hints** for Python 3.8+
- **Connection pooling** using aiohttp
- **Error handling** with typed exceptions
- **Retry logic** with backoff strategies
- **PyPI** distribution

### REST API Clients
- **Fetch-based** client (browser & Node.js)
- **Axios-based** client (Node.js)
- **Requests** alternative (Python standard library)

## Installation

### TypeScript SDK
```bash
npm install @ai-agent/typescript-sdk
```

### Python SDK
```bash
pip install ai-agent-orchestrator
```

## Quick Start

### TypeScript
```typescript
import { AgentClient } from '@ai-agent/typescript-sdk';

const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Create an agent
const agent = await client.agents.create({
  name: 'My Agent',
  type: 'WORKER',
  capabilities: ['data-processing']
});

// Submit a task
const task = await client.tasks.submit({
  name: 'Process Data',
  type: 'data-processing',
  payload: { data: [...] }
});

// Wait for completion
const result = await client.tasks.waitForCompletion(task.id);
```

### Python
```python
from ai_agent_orchestrator import AgentClient

client = AgentClient(
    api_url="http://localhost:3000",
    api_key="your-api-key"
)

# Create an agent
agent = await client.agents.create(
    name="My Agent",
    type="WORKER",
    capabilities=["data-processing"]
)

# Submit a task
task = await client.tasks.submit(
    name="Process Data",
    type="data-processing",
    payload={"data": [...]}
)

# Wait for completion
result = await client.tasks.wait_for_completion(task.id)
```

## Core Features

### 1. Agent Management
- Create and register agents
- List and filter agents
- Get agent status and metrics
- Update agent configuration
- Delete agents

### 2. Task Management
- Submit tasks with full configuration
- Monitor task progress
- Cancel tasks
- Retry failed tasks
- Get task results and errors

### 3. Error Handling
- Typed error classes for different scenarios
- Automatic retry with backoff
- Detailed error messages with context
- Request tracking with correlation IDs

### 4. Connection Management
- Connection pooling
- Keep-alive connections
- Automatic reconnection
- Health checks

### 5. Monitoring
- Performance metrics
- Health status tracking
- Event streaming
- Real-time notifications

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone repository
git clone <repo-url>
cd plugin-ai-agent-rabbitmq

# Install dependencies
npm install

# Setup environment
cp .env.example .env
npm run setup
```

### 2. Build SDKs

```bash
# Build TypeScript SDK
npm run build:sdk:ts

# Build Python SDK
npm run build:sdk:python

# Build all SDKs
npm run build:sdks
```

### 3. Run Tests

```bash
# Test TypeScript SDK
npm run test:sdk:ts

# Test Python SDK
npm run test:sdk:python

# Integration tests
npm run test:sdks:integration
```

### 4. Publish to Registries

```bash
# Publish to npm
npm run publish:sdk:ts

# Publish to PyPI
npm run publish:sdk:python
```

## Configuration

### TypeScript SDK Config

```typescript
interface ClientConfig {
  apiUrl: string;           // Base API URL
  apiKey: string;           // API authentication key
  timeout?: number;         // Request timeout (ms)
  retryConfig?: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  poolConfig?: {
    maxConnections: number;
    maxIdleTime: number;
  };
  logger?: Logger;          // Custom logger instance
  requestInterceptor?: Interceptor;
  responseInterceptor?: Interceptor;
}
```

### Python SDK Config

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class ClientConfig:
    api_url: str              # Base API URL
    api_key: str              # API authentication key
    timeout: int = 30000      # Request timeout (ms)
    max_retries: int = 3      # Max retry attempts
    initial_delay: int = 100  # Initial retry delay (ms)
    max_delay: int = 10000    # Max retry delay (ms)
    backoff_multiplier: float = 2.0
    max_connections: int = 10 # Pool size
    logger: Optional[Logger] = None
```

## Patterns

### Request/Response Pattern

```typescript
// Request
const response = await client.request<TaskResponse>({
  method: 'POST',
  path: '/tasks',
  body: taskPayload
});

// Streaming responses
const stream = client.stream<AgentEvent>({
  method: 'GET',
  path: '/events',
  query: { agentId: 'agent-1' }
});

for await (const event of stream) {
  console.log(event);
}
```

### Event Streaming

```typescript
// Subscribe to agent events
const unsubscribe = client.events.subscribe('agent.*', (event) => {
  console.log('Agent event:', event);
});

// Unsubscribe when done
unsubscribe();
```

### Batch Operations

```typescript
// Submit multiple tasks
const tasks = await client.tasks.submitBatch([
  { name: 'Task 1', type: 'processing' },
  { name: 'Task 2', type: 'processing' },
  { name: 'Task 3', type: 'processing' }
]);

// Wait for all to complete
const results = await Promise.all(
  tasks.map(t => client.tasks.waitForCompletion(t.id))
);
```

## Error Handling

### TypeScript

```typescript
import {
  AgentClientError,
  TimeoutError,
  ValidationError,
  RateLimitError
} from '@ai-agent/typescript-sdk';

try {
  const task = await client.tasks.submit(payload);
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.details);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded');
  } else if (error instanceof AgentClientError) {
    console.error('Client error:', error.message);
  }
}
```

### Python

```python
from ai_agent_orchestrator.errors import (
    AgentClientError,
    TimeoutError,
    ValidationError,
    RateLimitError
)

try:
    task = await client.tasks.submit(payload)
except TimeoutError:
    print("Request timed out")
except ValidationError as e:
    print(f"Invalid input: {e.details}")
except RateLimitError:
    print("Rate limit exceeded")
except AgentClientError as e:
    print(f"Client error: {e}")
```

## Testing

### Unit Tests

```bash
npm run test:sdk:ts -- --coverage
npm run test:sdk:python -- --coverage
```

### Integration Tests

```bash
npm run test:sdks:integration
```

### E2E Tests

```bash
npm run test:sdks:e2e
```

## Performance Optimization

### Connection Pooling

The SDKs automatically manage connection pools:

```typescript
// Customize pool size
const client = new AgentClient({
  poolConfig: {
    maxConnections: 20,
    maxIdleTime: 60000
  }
});
```

### Request Batching

```typescript
// Batch multiple requests
const results = await client.batch([
  { method: 'GET', path: '/agents/1' },
  { method: 'GET', path: '/agents/2' },
  { method: 'GET', path: '/agents/3' }
]);
```

### Caching

```typescript
// Enable response caching
const agent = await client.agents.get('agent-1', {
  cache: {
    ttl: 30000,  // 30 second TTL
    strategy: 'LRU'
  }
});
```

## Security

### Authentication

```typescript
// API Key authentication
const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: process.env.API_KEY
});

// Bearer token
const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Request Signing

```typescript
// Enable request signing for additional security
const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: process.env.API_KEY,
  requestSigning: {
    enabled: true,
    algorithm: 'sha256'
  }
});
```

## Monitoring

### Metrics

```typescript
// Get client metrics
const metrics = client.getMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Success rate: ${metrics.successRate}%`);
console.log(`Average latency: ${metrics.averageLatency}ms`);
```

### Logging

```typescript
import { Logger } from '@ai-agent/typescript-sdk';

const logger = new Logger({
  level: 'debug',
  transports: [
    new ConsoleTransport(),
    new FileTransport({ filename: 'client.log' })
  ]
});

const client = new AgentClient({
  logger
});
```

## Troubleshooting

### Connection Issues

1. Verify API endpoint is accessible
2. Check API key validity
3. Review firewall/proxy settings
4. Check network connectivity

### Timeout Issues

1. Increase request timeout
2. Check server response times
3. Review network latency
4. Consider batch operations for large workloads

### Rate Limiting

1. Implement exponential backoff
2. Use request batching
3. Reduce request frequency
4. Consider service tier upgrade

## Migration Guide

### From v0.x to v1.x

```typescript
// Old style
client.createTask(taskData, (err, result) => {
  if (err) handleError(err);
  else processResult(result);
});

// New style (async/await)
try {
  const result = await client.tasks.create(taskData);
  processResult(result);
} catch (error) {
  handleError(error);
}
```

## Contributing

To contribute to the SDKs:

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request
5. Follow the coding style guide

## Support

- Documentation: [API_CLIENT_GUIDE.md](./API_CLIENT_GUIDE.md)
- Examples: [INTEGRATION_EXAMPLES.md](./INTEGRATION_EXAMPLES.md)
- Issues: GitHub Issues
- Community: Discord/Slack channel

## License

MIT
