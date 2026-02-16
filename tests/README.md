# Test Infrastructure Documentation

## Overview

This project includes comprehensive test infrastructure targeting **95%+ code coverage** with unit, integration, and end-to-end tests.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── rabbitmq-client.test.js
│   ├── orchestrator.test.js
│   └── message-handlers.test.js
├── integration/             # Integration tests for agent communication
│   ├── task-distribution.test.js
│   ├── brainstorming.test.js
│   ├── multi-agent.test.js
│   └── failure-handling.test.js
├── e2e/                     # End-to-end workflow tests
│   ├── 5-terminal-scenario.test.js
│   ├── git-worktree.test.js
│   ├── failure-recovery.test.js
│   └── scaling.test.js
├── helpers/                 # Test utility functions
│   ├── rabbitmq-helpers.js
│   ├── agent-helpers.js
│   ├── message-factories.js
│   └── assertion-helpers.js
├── fixtures/                # Test data and configurations
│   ├── tasks.json
│   ├── messages.json
│   ├── agent-configs.json
│   └── mock-responses.json
├── setup.js                 # Global test setup
├── global-setup.js          # Pre-test initialization
├── global-teardown.js       # Post-test cleanup
└── README.md               # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### E2E Tests Only
```bash
npm run test:e2e
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### CI Mode
```bash
npm run test:ci
```

### Debug Mode
```bash
npm run test:debug
```

## Test Categories

### Unit Tests

Unit tests validate individual components in isolation with mocked dependencies.

**Files:**
- `rabbitmq-client.test.js` - Tests RabbitMQ connection, queues, and messaging
- `orchestrator.test.js` - Tests agent orchestration logic
- `message-handlers.test.js` - Tests message processing functions

**Coverage Target:** 98%+

**Example:**
```javascript
import { RabbitMQClient } from '../../scripts/rabbitmq-client.js';

describe('RabbitMQClient', () => {
  it('should connect to RabbitMQ', async () => {
    const client = new RabbitMQClient();
    await client.connect();
    expect(client.isConnected).toBe(true);
  });
});
```

### Integration Tests

Integration tests validate communication between multiple agents and RabbitMQ.

**Files:**
- `task-distribution.test.js` - Tests task routing between agents
- `brainstorming.test.js` - Tests multi-agent collaboration
- `multi-agent.test.js` - Tests concurrent agent operations
- `failure-handling.test.js` - Tests error scenarios and recovery

**Coverage Target:** 95%+

**Example:**
```javascript
describe('Task Distribution', () => {
  it('should distribute tasks to multiple workers', async () => {
    const leader = new AgentOrchestrator('team-leader');
    const worker1 = new AgentOrchestrator('worker');
    const worker2 = new AgentOrchestrator('worker');

    await Promise.all([
      leader.initialize(),
      worker1.initialize(),
      worker2.initialize()
    ]);

    await leader.assignTask({ title: 'Test Task' });
    // Verify task is received by workers
  });
});
```

### E2E Tests

End-to-end tests validate complete workflows from start to finish.

**Files:**
- `5-terminal-scenario.test.js` - Tests multi-agent terminal workflow
- `git-worktree.test.js` - Tests Git worktree coordination
- `failure-recovery.test.js` - Tests system recovery scenarios
- `scaling.test.js` - Tests system performance under load

**Coverage Target:** 95%+

**Example:**
```javascript
describe('Complete Workflow', () => {
  it('should complete a multi-agent task end-to-end', async () => {
    // Setup multiple agents
    // Assign complex task
    // Verify task completion
    // Check results aggregation
  });
});
```

## Test Helpers

### RabbitMQ Helpers

Located in `helpers/rabbitmq-helpers.js`

```javascript
import {
  createMockConnection,
  createMockChannel,
  createMockMessage,
  verifyQueueAsserted,
  verifyExchangeAsserted
} from './helpers/rabbitmq-helpers.js';

// Create mock connection
const mockConnection = createMockConnection();

// Create mock channel
const mockChannel = createMockChannel();

// Create mock message
const message = createMockMessage({ id: 'test-1', data: {} });

// Verify queue was asserted
verifyQueueAsserted(channel, 'test-queue', { durable: true });
```

### Agent Helpers

Located in `helpers/agent-helpers.js`

```javascript
import {
  spawnTestAgent,
  createMockTask,
  createMockTaskResult,
  waitForAgentReady
} from './helpers/agent-helpers.js';

// Spawn test agent
const agent = spawnTestAgent('./scripts/orchestrator.js', ['worker']);

// Wait for agent to be ready
await waitForAgentReady(agent);

// Create mock task
const task = createMockTask({ title: 'Test Task' });
```

### Message Factories

Located in `helpers/message-factories.js`

```javascript
import {
  createOrchestratorTask,
  createAgentTask,
  createTaskResult,
  createHeartbeat
} from './helpers/message-factories.js';

// Create orchestrator task
const task = createOrchestratorTask({ action: 'process', priority: 5 });

// Create task result
const result = createTaskResult('task-id', 'agent-id', { status: 'completed' });

// Create heartbeat
const heartbeat = createHeartbeat('agent-id', { tasksProcessed: 10 });
```

### Custom Assertions

Located in `helpers/assertion-helpers.js`

```javascript
import {
  assertMessageSent,
  assertMessagePublished,
  assertTaskCompleted,
  assertValidHeartbeat
} from './helpers/assertion-helpers.js';

// Assert message was sent
assertMessageSent(channel, 'queue-name', msg => msg.type === 'task');

// Assert task completed successfully
assertTaskCompleted(result, { output: 'expected' });

// Assert valid heartbeat
assertValidHeartbeat(heartbeat, 'agent-id');
```

## Test Fixtures

Test fixtures provide consistent test data:

- **tasks.json** - Sample tasks (simple, complex, error cases)
- **messages.json** - Sample messages (orchestrator, agent, heartbeat)
- **agent-configs.json** - Agent configurations (worker, coordinator, monitor)
- **mock-responses.json** - Mock responses (success, failure, timeout)

**Usage:**
```javascript
import tasks from '../fixtures/tasks.json' assert { type: 'json' };

const simpleTask = tasks.simpleTasks[0];
```

## Writing New Tests

### Test Template

```javascript
/**
 * Test Description
 */

import { jest } from '@jest/globals';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Feature Name', () => {
  let testSubject;

  beforeEach(() => {
    // Setup before each test
    testSubject = new TestSubject();
  });

  afterEach(() => {
    // Cleanup after each test
    jest.clearAllMocks();
  });

  describe('Method Name', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = { foo: 'bar' };

      // Act
      const result = await testSubject.method(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle error cases', async () => {
      // Test error scenarios
      await expect(testSubject.method(null)).rejects.toThrow();
    });
  });
});
```

### Best Practices

1. **AAA Pattern** - Arrange, Act, Assert
2. **Descriptive Names** - Use clear, descriptive test names
3. **One Assertion Per Test** - Focus each test on one behavior
4. **Mock External Dependencies** - Isolate the code under test
5. **Clean Up Resources** - Always clean up in afterEach/afterAll
6. **Test Edge Cases** - Include boundary conditions and error scenarios
7. **Use Helpers** - Leverage test helpers for common operations
8. **Avoid Test Interdependence** - Each test should be independent

## Coverage Goals

### Overall Target: 95%+

- **Branches:** 95%
- **Functions:** 95%
- **Lines:** 95%
- **Statements:** 95%

### Critical Modules: 98%+

- `rabbitmq-client.js` - 98%
- `orchestrator.js` - 98%

### Coverage Reports

Coverage reports are generated in:
- `coverage/` directory (HTML, LCOV, JSON)
- `coverage/index.html` - View detailed coverage report

## CI/CD Integration

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Daily scheduled runs (2 AM UTC)

**GitHub Actions Workflow:** `.github/workflows/test.yml`

**Test Matrix:**
- Node.js 18.x
- Node.js 20.x
- Node.js 21.x

**Services:**
- RabbitMQ 3 (management-alpine)

## Performance Benchmarks

Performance tests validate:
- Message throughput
- Concurrent agent handling
- System scalability
- Resource utilization

**Run Benchmarks:**
```bash
node scripts/test-orchestration.js
```

## Debugging Tests

### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--testPathPattern", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Single Test

```bash
npm run test:debug -- tests/unit/rabbitmq-client.test.js
```

### Enable Verbose Logging

```bash
DEBUG=* npm test
```

## Troubleshooting

### Tests Hanging

- Check for unclosed connections
- Verify timeouts are set
- Use `forceExit: true` in jest.config.js

### RabbitMQ Connection Issues

- Ensure RabbitMQ is running: `docker ps`
- Check connection URL: `RABBITMQ_URL=amqp://localhost:5672`
- Verify credentials match test environment

### Coverage Not Generating

- Run with coverage flag: `npm run test:coverage`
- Check `collectCoverageFrom` in jest.config.js
- Ensure all source files are imported

### Mock Issues

- Clear mocks in beforeEach: `jest.clearAllMocks()`
- Reset mocks: `jest.resetAllMocks()`
- Restore mocks: `jest.restoreAllMocks()`

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [RabbitMQ Testing Guide](https://www.rabbitmq.com/testing.html)

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure 95%+ coverage
3. Update test documentation
4. Run full test suite before committing

---

**Last Updated:** 2025-11-17
**Maintainer:** TEST AGENT 8
**Coverage Target:** 95%+ (All tests passing)
