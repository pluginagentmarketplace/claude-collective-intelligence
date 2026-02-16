# Client SDKs for AI Agent Orchestrator

Production-grade SDKs for integrating with the AI Agent Orchestrator system.

## Available SDKs

### TypeScript SDK

Full-featured TypeScript SDK with type safety, async/await, connection pooling, and retry logic.

- **Location**: `./typescript/`
- **Package**: `@ai-agent/typescript-sdk`
- **Features**:
  - Type-safe API with full TypeScript support
  - Async/await syntax
  - Connection pooling
  - Automatic retry with exponential backoff
  - Typed error handling
  - Request metrics and monitoring
  - Request/response interceptors

**Quick Start**:
```bash
cd typescript
npm install
npm run build
```

**Documentation**: [TypeScript SDK README](./typescript/README.md)

### Python SDK

Modern Python SDK with asyncio support, type hints, and connection pooling.

- **Location**: `./python/`
- **Package**: `ai-agent-orchestrator`
- **Features**:
  - Full asyncio support
  - Type hints for Python 3.8+
  - Connection pooling
  - Automatic retry logic
  - Comprehensive error handling
  - Request metrics

**Quick Start**:
```bash
cd python
pip install -e .
```

**Documentation**: [Python SDK README](./python/README.md)

## File Structure

```
src/sdk/
├── README.md (this file)
├── typescript/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # Main exports
│   │   ├── client/
│   │   │   ├── AgentClient.ts       # Main client
│   │   │   ├── AgentsManager.ts     # Agent operations
│   │   │   └── TasksManager.ts      # Task operations
│   │   ├── types/
│   │   │   └── index.ts             # Type definitions
│   │   ├── errors/
│   │   │   └── AgentClientError.ts  # Error classes
│   │   └── utils/
│   │       ├── retry.ts             # Retry logic
│   │       └── pool.ts              # Connection pool
│   ├── examples/
│   │   └── basic-usage.ts           # Usage examples
│   ├── tests/
│   │   └── (test files)
│   └── README.md
├── python/
│   ├── setup.py
│   ├── requirements.txt
│   ├── ai_agent/
│   │   ├── __init__.py              # Main exports
│   │   ├── client.py                # Main client
│   │   ├── managers.py              # Agent/Task managers
│   │   ├── types.py                 # Type definitions
│   │   ├── errors.py                # Error classes
│   │   ├── retry.py                 # Retry logic
│   │   └── pool.py                  # Connection pool
│   ├── examples/
│   │   └── basic_usage.py           # Usage examples
│   ├── tests/
│   │   └── (test files)
│   └── README.md
```

## Installation

### TypeScript

```bash
npm install @ai-agent/typescript-sdk
```

### Python

```bash
pip install ai-agent-orchestrator
```

## Basic Usage

### TypeScript

```typescript
import { AgentClient } from '@ai-agent/typescript-sdk';

const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Create agent
const agent = await client.agents.create({
  name: 'My Agent',
  type: 'WORKER',
  capabilities: ['data-processing']
});

// Submit task
const task = await client.tasks.submit({
  name: 'Process Data',
  type: 'data-processing',
  payload: { data: [...] }
});

// Wait for completion
const result = await client.tasks.waitForCompletion(task.id);

await client.close();
```

### Python

```python
from ai_agent import AgentClient, AgentCreateParams, TaskSubmitParams
import asyncio

async def main():
    async with AgentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key"
    ) as client:
        # Create agent
        agent = await client.agents.create(
            AgentCreateParams(
                name="My Agent",
                type="WORKER",
                capabilities=["data-processing"]
            )
        )

        # Submit task
        task = await client.tasks.submit(
            TaskSubmitParams(
                name="Process Data",
                type="data-processing",
                payload={"data": [...]}
            )
        )

        # Wait for completion
        result = await client.tasks.wait_for_completion(task.id)

asyncio.run(main())
```

## Documentation

- **[SDK Development Guide](../../SDK_DEVELOPMENT_GUIDE.md)**: Complete development guide
- **[API Client Guide](../../API_CLIENT_GUIDE.md)**: Comprehensive API reference
- **[Integration Examples](../../INTEGRATION_EXAMPLES.md)**: Real-world integration examples

## Features Comparison

| Feature | TypeScript | Python |
|---------|-----------|--------|
| Type Safety | ✅ Full TypeScript | ✅ Type hints |
| Async/Await | ✅ Yes | ✅ Asyncio |
| Connection Pooling | ✅ Yes | ✅ Yes |
| Retry Logic | ✅ Exponential backoff | ✅ Exponential backoff |
| Error Handling | ✅ Typed errors | ✅ Exception classes |
| Metrics | ✅ Built-in | ✅ Built-in |
| Interceptors | ✅ Yes | ⚠️ Planned |

## Core Capabilities

### Agent Management
- Create and register agents
- List and filter agents
- Get agent status and capabilities
- Update agent configuration
- Delete agents

### Task Management
- Submit tasks with full configuration
- Monitor task progress
- Cancel tasks
- Retry failed tasks
- Get task results and errors
- Batch operations

### Error Handling
- Typed error classes
- Automatic retry with backoff
- Detailed error messages
- Request tracking

### Monitoring
- Performance metrics
- Health status
- Request latency tracking
- Error rate monitoring

## REST API Alternative

If you prefer to use REST APIs directly:

- **Fetch** (Browser/Node.js):
  ```typescript
  const response = await fetch('http://localhost:3000/agents', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer your-api-key' },
    body: JSON.stringify({...})
  });
  ```

- **Axios** (Node.js):
  ```typescript
  const response = await axios.post('/agents', {...});
  ```

- **Requests** (Python):
  ```python
  response = requests.post('http://localhost:3000/agents', json={...})
  ```

See [API Client Guide](../../API_CLIENT_GUIDE.md) for detailed examples.

## Examples

### TypeScript Examples

- Basic Usage: `typescript/examples/basic-usage.ts`
  - Create agents
  - Submit tasks
  - Wait for completion
  - Error handling
  - Metrics

### Python Examples

- Basic Usage: `python/examples/basic_usage.py`
  - Create agents
  - Submit tasks
  - Batch operations
  - Error handling

## Testing

### TypeScript

```bash
cd typescript
npm test                  # Run tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Python

```bash
cd python
pytest                  # Run tests
pytest --cov          # Coverage report
pytest -v             # Verbose output
```

## Building and Publishing

### TypeScript

```bash
cd typescript
npm run build          # Build
npm publish            # Publish to npm
```

### Python

```bash
cd python
python setup.py sdist bdist_wheel  # Build
pip install twine
twine upload dist/*                # Publish to PyPI
```

## Performance Optimization

### Connection Pooling
Both SDKs include connection pooling for optimal performance:

```typescript
// TypeScript
const client = new AgentClient({
  poolConfig: {
    maxConnections: 20,
    maxIdleTime: 60000
  }
});
```

```python
# Python
from ai_agent import AgentClient, PoolConfig

client = AgentClient(
    pool_config=PoolConfig(
        max_connections=20,
        max_idle_time=60000
    )
)
```

### Retry Configuration
Customize retry behavior:

```typescript
// TypeScript - Presets
import { RetryPresets } from '@ai-agent/typescript-sdk';

const client = new AgentClient({
  retryConfig: RetryPresets.aggressive  // or moderate, conservative
});
```

```python
# Python - Presets
from ai_agent import RetryPresets

client = AgentClient(
    retry_config=RetryPresets.MODERATE
)
```

## Best Practices

1. **Always cleanup resources**:
   - TypeScript: `await client.close()`
   - Python: Use `async with` context manager

2. **Use batch operations** for multiple items:
   - More efficient than individual requests
   - Better error handling

3. **Set appropriate timeouts**:
   - Short operations: 5-10 seconds
   - Long operations: 5-60 minutes

4. **Handle errors gracefully**:
   - Use typed error classes
   - Implement retry logic for transient failures

5. **Monitor metrics**:
   - Track success rates
   - Monitor latency
   - Alert on errors

## Support

- **Issues**: Report bugs on GitHub
- **Documentation**: See SDK-specific README files
- **Examples**: Check `examples/` directories
- **Integration**: See INTEGRATION_EXAMPLES.md

## License

MIT
