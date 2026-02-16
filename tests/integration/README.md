# Integration Tests

Comprehensive integration tests for the RabbitMQ AI Agent Orchestration System.

## Overview

These integration tests verify the complete functionality of the multi-agent orchestration system using real RabbitMQ instances running in Docker containers.

## Test Suites

### 1. Task Distribution (`task-distribution.test.js`)
Tests the complete task distribution flow:
- Leader assigns tasks
- Workers pick up tasks
- Workers process tasks
- Workers report results
- Leader receives results

**Test Cases:**
- Basic task distribution
- Priority task distribution
- Multiple tasks sequential processing
- Task with context data
- Task acknowledgement and queue state

### 2. Brainstorming (`brainstorming.test.js`)
Tests the collaborative brainstorming flow:
- Worker initiates brainstorm
- Collaborators receive broadcast
- Collaborators respond
- Response aggregation
- Consensus building

**Test Cases:**
- Basic brainstorm session
- Multiple collaborators
- Brainstorm within task flow
- Response aggregation
- Concurrent brainstorm sessions

### 3. Failure Handling (`failure-handling.test.js`)
Tests various failure scenarios:
- Task failure and retry
- Agent disconnection
- Queue overflow
- Message timeout
- Dead letter queue

**Test Cases:**
- Task failure and retry mechanism
- Agent disconnection and reconnection
- Queue overflow handling
- Message timeout (TTL)
- Task requeue behavior

### 4. Multi-Agent Coordination (`multi-agent.test.js`)
Tests coordination between multiple agents:
- 3-agent setup (1 leader, 2 workers)
- Task distribution across workers
- Load balancing
- Concurrent execution
- Result aggregation

**Test Cases:**
- Three-agent setup
- Task distribution across workers
- Load balancing
- Concurrent task execution
- Result aggregation from multiple workers

### 5. Monitoring (`monitoring.test.js`)
Tests monitoring and observability features:
- Status updates
- Health checks
- Metrics collection
- Alert generation
- Dashboard integration

**Test Cases:**
- Status update broadcasting
- Agent health checks
- Metrics collection and aggregation
- Alert generation on failures
- Monitor dashboard integration

## Prerequisites

### Required Software
- **Docker**: Required to run RabbitMQ container
- **Node.js**: v18.0.0 or higher
- **npm**: Latest version

### Verify Docker Installation
```bash
docker --version
```

If Docker is not installed, download from [docker.com](https://www.docker.com/get-started).

## Running Tests

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Individual Test Suites
```bash
# Task Distribution Tests
node tests/integration/task-distribution.test.js

# Brainstorming Tests
node tests/integration/brainstorming.test.js

# Failure Handling Tests
node tests/integration/failure-handling.test.js

# Multi-Agent Tests
node tests/integration/multi-agent.test.js

# Monitoring Tests
node tests/integration/monitoring.test.js
```

### Run All Tests with Custom Runner
```bash
node tests/integration/run-all.js
```

## Test Architecture

### Setup (`setup.js`)
The setup module provides:
- Docker RabbitMQ container management
- Automatic container lifecycle (start/stop)
- Connection health checks
- Queue management utilities
- Test helpers and assertions

### Test Flow
1. **Setup Phase**: Start RabbitMQ Docker container
2. **Initialization**: Wait for RabbitMQ to be ready
3. **Test Execution**: Run test cases
4. **Cleanup**: Stop and remove container
5. **Reporting**: Display test results

### Container Management
- **Container Name**: `rabbitmq-test-integration`
- **RabbitMQ Port**: 5672
- **Management Port**: 15672
- **Credentials**: guest/guest
- **Image**: `rabbitmq:3-management-alpine`

## Test Features

### Real RabbitMQ Connection
All tests use actual RabbitMQ instances, not mocks:
- Real message passing
- Actual queue states
- True concurrency
- Authentic timing behaviors

### Timing and Timeouts
Tests include proper timing mechanisms:
- Conditional waits with timeouts
- Message acknowledgement verification
- Queue state validation
- Performance benchmarks

### Queue State Verification
Tests verify queue states:
- Message counts
- Queue creation/deletion
- TTL expiration
- Overflow handling

### Error Handling
Comprehensive error scenarios:
- Task failures and retries
- Connection failures
- Queue overflow
- Message expiration
- Agent disconnection

## Writing New Tests

### Test Template
```javascript
import AgentOrchestrator from '../../scripts/orchestrator.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';

class MyTest {
  constructor() {
    this.setup = new TestSetup();
    this.agents = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTests() {
    try {
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      await this.testMyFeature();

      this.printResults();
      return this.testResults.failed === 0;
    } catch (error) {
      console.error('Test suite failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }

  async testMyFeature() {
    try {
      // Your test code here
      this.testResults.passed++;
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    } finally {
      await this.cleanupAgents();
    }
  }

  async cleanupAgents() {
    // Cleanup logic
  }

  async cleanup() {
    await this.cleanupAgents();
    await this.setup.stopRabbitMQ();
  }

  printResults() {
    // Print test results
  }
}

export default MyTest;
```

### Best Practices

1. **Always Cleanup**: Use try/finally to ensure cleanup
2. **Use Timeouts**: All waits should have maximum timeouts
3. **Verify States**: Check queue states and agent health
4. **Meaningful Assertions**: Use descriptive assertion messages
5. **Track Agents**: Keep references to all agents for cleanup
6. **Wait Appropriately**: Use `waitForCondition` for async operations
7. **Isolate Tests**: Each test should be independent

## Troubleshooting

### Docker Not Running
```
Error: Docker is not available
```
**Solution**: Start Docker Desktop or Docker daemon

### Port Already in Use
```
Error: Port 5672 already in use
```
**Solution**: Stop existing RabbitMQ containers
```bash
docker stop rabbitmq-test-integration
docker rm rabbitmq-test-integration
```

### RabbitMQ Timeout
```
Error: RabbitMQ failed to become ready in time
```
**Solutions**:
- Wait longer (increase timeout)
- Check Docker resources
- Verify network connectivity
- Check Docker logs: `docker logs rabbitmq-test-integration`

### Test Failures
- Check Docker logs for RabbitMQ errors
- Verify no other instances are running
- Ensure adequate system resources
- Check for port conflicts

## Performance Considerations

### Test Duration
- Individual test suites: 20-60 seconds
- Full suite: 3-5 minutes
- Includes Docker container startup/shutdown

### Resource Usage
- Memory: ~500MB (RabbitMQ container)
- CPU: Minimal during tests
- Disk: ~100MB (Docker image)

### Optimization Tips
- Run suites in parallel (if resources allow)
- Reuse containers between test runs (development only)
- Adjust timeouts based on system performance

## Continuous Integration

### CI/CD Integration
```yaml
# Example GitHub Actions
- name: Run Integration Tests
  run: |
    docker --version
    npm run test:integration
```

### Requirements for CI
- Docker must be available
- Sufficient memory (2GB+)
- Network access for Docker Hub
- Port 5672 and 15672 available

## Output Format

### Test Results
```
╔════════════════════════════════════════════════════════════╗
║                    TEST RESULTS                            ║
╚════════════════════════════════════════════════════════════╝

  Total Tests: 5
  ✅ Passed: 5
  ✅ Failed: 0

══════════════════════════════════════════════════════════════
```

### Exit Codes
- `0`: All tests passed
- `1`: One or more tests failed

## Contributing

When adding new tests:
1. Follow the test template structure
2. Add to `run-all.js` test suite list
3. Update this README with test description
4. Ensure cleanup is properly implemented
5. Add meaningful assertions with messages
6. Test both success and failure scenarios

## Support

For issues or questions:
- Check Docker logs: `docker logs rabbitmq-test-integration`
- Review test output for specific errors
- Verify RabbitMQ is accessible: `docker ps`
- Check queue states: `docker exec rabbitmq-test-integration rabbitmqctl list_queues`
