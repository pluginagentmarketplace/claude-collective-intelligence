# TypeScript SDK for AI Agent Orchestrator

Production-grade, type-safe TypeScript SDK for the AI Agent Orchestrator system.

## Features

- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Async/Await**: Modern async/await syntax for all operations
- **Connection Pooling**: Efficient HTTP connection management
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: Typed error classes for different scenarios
- **Metrics**: Built-in request metrics and monitoring
- **Request Interceptors**: Customize requests and responses

## Installation

```bash
npm install @ai-agent/typescript-sdk
```

## Quick Start

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
console.log('Task completed:', result.status);

// Don't forget to cleanup
await client.close();
```

## API Overview

### Agents

```typescript
// Create agent
await client.agents.create({...});

// List agents
await client.agents.list();

// Get agent
await client.agents.get(agentId);

// Update agent
await client.agents.update(agentId, {...});

// Delete agent
await client.agents.delete(agentId);

// Get capabilities
await client.agents.getCapabilities(agentId);

// Check capability
await client.agents.hasCapability(agentId, 'capability');
```

### Tasks

```typescript
// Submit task
await client.tasks.submit({...});

// Get task
await client.tasks.get(taskId);

// List tasks
await client.tasks.list();

// Wait for completion
await client.tasks.waitForCompletion(taskId, timeout);

// Cancel task
await client.tasks.cancel(taskId);

// Retry task
await client.tasks.retry(taskId);

// Batch operations
await client.tasks.submitBatch([...]);
await client.tasks.waitForAll([...]);
```

## Error Handling

```typescript
import {
  ValidationError,
  NotFoundError,
  TimeoutError,
  AgentClientError
} from '@ai-agent/typescript-sdk';

try {
  const task = await client.tasks.submit(params);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.details);
  } else if (error instanceof NotFoundError) {
    console.error('Resource not found');
  } else if (error instanceof TimeoutError) {
    console.error('Request timeout');
  }
}
```

## Configuration

```typescript
const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
  timeout: 30000,                    // Request timeout in ms
  maxRetries: 3,                     // Max retry attempts
  retryConfig: {                     // Retry configuration
    initialDelay: 100,
    maxDelay: 10000,
    backoffMultiplier: 2
  },
  poolConfig: {                      // Connection pool
    maxConnections: 10,
    maxIdleTime: 60000
  }
});
```

## Advanced Usage

### Request Interceptors

```typescript
const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key',
  requestInterceptors: [
    async (config) => {
      config.headers = {
        ...config.headers,
        'X-Request-ID': generateUUID()
      };
      return config;
    }
  ]
});
```

### Metrics

```typescript
const metrics = client.getMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Success rate: ${metrics.successRate}%`);
console.log(`Average latency: ${metrics.averageLatency}ms`);
```

### Health Check

```typescript
const health = await client.health();
console.log(health.status);  // 'UP', 'DOWN', or 'DEGRADED'
```

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Build

```bash
# Build
npm run build

# Watch
npm run watch
```

## Documentation

- [API Client Guide](../../API_CLIENT_GUIDE.md)
- [SDK Development Guide](../../SDK_DEVELOPMENT_GUIDE.md)
- [Integration Examples](../../INTEGRATION_EXAMPLES.md)

## License

MIT
