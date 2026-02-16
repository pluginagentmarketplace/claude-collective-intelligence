# Integration Tests - Quick Start Guide

This guide will help you quickly get started with running integration tests for the RabbitMQ AI Agent Orchestration System.

## Prerequisites Checklist

- [ ] Docker installed and running
- [ ] Node.js v18+ installed
- [ ] Project dependencies installed (`npm install`)

## Quick Test Commands

### Run All Integration Tests
```bash
npm run test:integration
```

This will:
1. Start a RabbitMQ Docker container
2. Run all 5 test suites
3. Display comprehensive results
4. Clean up Docker resources
5. Exit with appropriate code (0 = success, 1 = failure)

### Run Individual Test Suites

```bash
# Task Distribution Tests (5 tests)
npm run test:integration:task-distribution

# Brainstorming Tests (5 tests)
npm run test:integration:brainstorming

# Failure Handling Tests (5 tests)
npm run test:integration:failure-handling

# Multi-Agent Coordination Tests (5 tests)
npm run test:integration:multi-agent

# Monitoring Tests (5 tests)
npm run test:integration:monitoring
```

## What to Expect

### First Run
```
╔════════════════════════════════════════════════════════════╗
║       INTEGRATION TEST: TASK DISTRIBUTION                  ║
╚════════════════════════════════════════════════════════════╝

🐰 Starting RabbitMQ container for integration tests...
Starting new RabbitMQ container...
RabbitMQ container started
Waiting for RabbitMQ to be ready...
..........
✅ RabbitMQ is ready!

📝 Test 1: Basic Task Distribution
────────────────────────────────────────────────────────────
  → Leader assigning task...
  → Task assigned: abc-123-def
  ✅ Basic task distribution test passed

... (more tests)

╔════════════════════════════════════════════════════════════╗
║                    TEST RESULTS                            ║
╚════════════════════════════════════════════════════════════╝

  Total Tests: 5
  ✅ Passed: 5
  ❌ Failed: 0

══════════════════════════════════════════════════════════════
```

### Typical Duration
- Single test suite: 20-60 seconds
- All test suites: 3-5 minutes
- Includes Docker startup/shutdown time

## Common Issues & Solutions

### Issue: Docker Not Running
```
Error: Docker is not available. Please install Docker to run integration tests.
```
**Solution**: Start Docker Desktop or Docker daemon
```bash
# Check Docker status
docker --version
docker ps
```

### Issue: Port Already in Use
```
Error: Bind for 0.0.0.0:5672 failed: port is already allocated
```
**Solution**: Stop existing RabbitMQ containers
```bash
docker stop rabbitmq-test-integration
docker rm rabbitmq-test-integration
```

### Issue: Tests Timeout
```
Error: RabbitMQ failed to become ready in time
```
**Solutions**:
1. Increase Docker resources (Memory: 4GB+, CPU: 2+ cores)
2. Check Docker logs: `docker logs rabbitmq-test-integration`
3. Verify network connectivity
4. Wait a bit and retry

## Understanding Test Output

### Test Structure
Each test suite follows this pattern:

```
📝 Test N: Test Name
────────────────────────────────────────────────────────────
  → Action 1...
  → Action 2...
  → Action 3...
  ✅ Test passed
```

### Status Indicators
- `🚀` - Initialization
- `🐰` - RabbitMQ operations
- `📋` - Task operations
- `🧠` - Brainstorming operations
- `⚙️` - Processing
- `✅` - Success
- `❌` - Failure
- `⚠️` - Warning

## Test Coverage

### What These Tests Verify

1. **Task Distribution** (5 tests)
   - Basic task flow
   - Priority handling
   - Sequential processing
   - Context preservation
   - Queue acknowledgements

2. **Brainstorming** (5 tests)
   - Session initiation
   - Multi-collaborator participation
   - Task integration
   - Response aggregation
   - Concurrent sessions

3. **Failure Handling** (5 tests)
   - Retry mechanisms
   - Disconnection recovery
   - Queue overflow
   - Message TTL
   - Requeue behavior

4. **Multi-Agent Coordination** (5 tests)
   - Multi-agent setup
   - Task distribution
   - Load balancing
   - Concurrent execution
   - Result aggregation

5. **Monitoring** (5 tests)
   - Status updates
   - Health checks
   - Metrics collection
   - Alert generation
   - Dashboard integration

**Total: 25 Integration Tests**

## Docker Container Details

The tests automatically manage a Docker container with these specs:

```yaml
Container Name: rabbitmq-test-integration
Image: rabbitmq:3-management-alpine
Ports:
  - 5672:5672   # AMQP
  - 15672:15672 # Management UI
Credentials:
  - User: guest
  - Pass: guest
```

### Manual Docker Management (Optional)

```bash
# Start container manually
docker run -d --name rabbitmq-test-integration \
  -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  rabbitmq:3-management-alpine

# Check container status
docker ps | grep rabbitmq-test-integration

# View logs
docker logs rabbitmq-test-integration

# Access management UI
open http://localhost:15672

# Stop and remove
docker stop rabbitmq-test-integration
docker rm rabbitmq-test-integration
```

## Debugging Tests

### Enable Verbose Logging
Tests log detailed information by default. For even more details:

```bash
# Run with Node.js debugging
node --inspect tests/integration/task-distribution.test.js
```

### Check RabbitMQ State
While tests are running:

```bash
# List queues
docker exec rabbitmq-test-integration rabbitmqctl list_queues

# List exchanges
docker exec rabbitmq-test-integration rabbitmqctl list_exchanges

# List connections
docker exec rabbitmq-test-integration rabbitmqctl list_connections
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Run integration tests
      run: npm run test:integration
```

## Next Steps

1. **Run Your First Test**
   ```bash
   npm run test:integration:task-distribution
   ```

2. **Review Test Results**
   - Check console output
   - Verify all tests passed
   - Review any error messages

3. **Explore Test Code**
   - Open `tests/integration/task-distribution.test.js`
   - Understand test structure
   - Review assertions and expectations

4. **Read Full Documentation**
   - See `tests/integration/README.md` for detailed information
   - Understand test architecture
   - Learn about writing new tests

## Quick Reference

```bash
# Install dependencies
npm install

# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration:task-distribution
npm run test:integration:brainstorming
npm run test:integration:failure-handling
npm run test:integration:multi-agent
npm run test:integration:monitoring

# Check Docker
docker ps
docker logs rabbitmq-test-integration

# Clean up Docker
docker stop rabbitmq-test-integration
docker rm rabbitmq-test-integration
```

## Support

For issues or questions:
- Check the full README: `tests/integration/README.md`
- Review Docker logs for RabbitMQ errors
- Ensure Docker has sufficient resources
- Verify ports 5672 and 15672 are available

## Success Criteria

✅ All tests should pass on a properly configured system
✅ Expected duration: 3-5 minutes for full suite
✅ Exit code: 0 (success) or 1 (failure)
✅ Docker container automatically cleaned up after tests

Happy testing! 🎉
