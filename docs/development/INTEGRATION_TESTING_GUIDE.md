# Integration Testing Guide

## Overview

This guide provides comprehensive instructions for running integration tests in the AI Agent Orchestrator system. Integration tests verify that all 7 core components work together seamlessly in a realistic multi-agent environment.

## 7 Core Components Under Test

1. **Auth Component** - JWT token generation, validation, and role-based access control
2. **RabbitMQ Component** - Message publishing, consumption, and queue management
3. **Database Component** - PostgreSQL persistence and Redis caching
4. **Validation Component** - Input validation and response schema validation
5. **Logging Component** - Comprehensive logging across all operations
6. **Monitoring Component** - Metrics collection and health checks
7. **Error Handling Component** - Error recovery, retry logic, and failure handling

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Docker and Docker Compose
- 4GB minimum RAM available
- Ports: 5432, 6379, 5672, 15672 available

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env

# 3. Start test environment
docker-compose -f docker-compose.test.yml up -d

# 4. Run integration tests
npm run test:integration:full

# 5. View results
# Tests will display detailed output with pass/fail status
```

### Cleanup

```bash
# Stop and remove test containers
docker-compose -f docker-compose.test.yml down

# Clean volumes (optional - removes test data)
docker-compose -f docker-compose.test.yml down -v
```

## Test Scenarios

### 1. Authentication & JWT Token Management

**Test Suite**: `auth-validation.test`
**Components**: Auth, Validation, Database

- JWT token generation with configurable expiry
- Token validation and signature verification
- Refresh token flow
- Token revocation
- Concurrent token management
- Security: rate limiting, token blacklist

**Sample Tests**:
- Generate access token and verify claims
- Validate token with tampered signature fails
- Refresh token generates new access token
- Revoked token cannot be used
- 100 concurrent token generations complete successfully

### 2. RabbitMQ Message Publishing & Consumption

**Test Suite**: `rabbitmq-messaging.test`
**Components**: RabbitMQ, Logging, Monitoring

- Task queue publish/consume
- Result exchange routing
- Brainstorm exchange broadcasting
- Status exchange subscriptions
- Message acknowledgment and persistence
- Queue recovery after failures

**Sample Tests**:
- Publish task, verify received in queue
- Multiple consumers receive brainstorm messages
- Unacknowledged messages persisted after consumer crash
- Message ordering preserved in queue
- Dead-letter queue receives rejected messages

### 3. Input Validation & Response Schemas

**Test Suite**: `validation-schemas.test`
**Components**: Validation, Error Handling

- Task schema validation
- Agent registration schema validation
- Vote schema validation
- Response schema validation
- Sanitization of XSS attempts
- Rate limiting enforcement

**Sample Tests**:
- Invalid task payload rejected with detailed error
- XSS payload sanitized before storage
- Missing required fields caught
- Type coercion works correctly
- Response validates against schema

### 4. Logging & Audit Trail

**Test Suite**: `logging-audit.test`
**Components**: Logging, Database, Monitoring

- All operations logged with context
- Security events logged
- Performance metrics logged
- Structured logging format
- Log persistence and query

**Sample Tests**:
- Auth failure logged with IP and timestamp
- Task completion logged with execution time
- Error with stack trace logged
- Log query returns all related events
- Log rotation works correctly

### 5. Error Handling & Recovery

**Test Suite**: `error-recovery.test`
**Components**: Error Handling, RabbitMQ, Database

- Graceful failure handling
- Automatic retry with exponential backoff
- Dead-letter queue processing
- Circuit breaker pattern
- Partial failure recovery
- Data consistency after failure

**Sample Tests**:
- RabbitMQ connection failure triggers reconnection
- Database transaction rolled back on error
- Task retry succeeds on second attempt
- Circuit breaker opens after 5 failures
- Failed task moved to DLQ after max retries

### 6. Monitoring & Metrics Collection

**Test Suite**: `monitoring-metrics.test`
**Components**: Monitoring, Database

- Metrics collection and reporting
- Health check endpoints
- Alert triggering on threshold
- Metrics persistence
- Performance baselines

**Sample Tests**:
- Task processing time recorded
- Queue depth monitored
- Memory usage tracked
- CPU usage monitored
- Alert triggers when response time > 500ms

### 7. Data Persistence & Integrity

**Test Suite**: `persistence-integrity.test`
**Components**: Database, Validation, Error Handling

- PostgreSQL persistence
- Redis caching coherence
- Transaction ACID compliance
- Data recovery after crash
- Concurrent write conflict resolution

**Sample Tests**:
- Agent data persists across restarts
- Cache invalidated when DB updated
- Transaction rollback on constraint violation
- Concurrent writes don't create duplicates
- Read-after-write consistency maintained

## End-to-End Workflows

### Workflow 1: Agent Registration → Task Creation → Processing → Completion

**Duration**: ~5 seconds
**Components**: All 7

1. New agent registers with system (Auth validates JWT)
2. Agent creates task (Validation checks schema)
3. Task published to queue (RabbitMQ routes to workers)
4. Worker agent claims task (Database transaction)
5. Task execution logged (Logging component)
6. Metrics collected (Monitoring component)
7. Results published (RabbitMQ routing)
8. Error handling applied if needed (Error Recovery)

**Success Criteria**:
- Task created, processed, and completed
- Data persists in PostgreSQL
- Logs contain all operations
- Metrics show task duration
- No errors or failed transactions

### Workflow 2: Voting Session - 100 Votes with Consensus

**Duration**: ~10 seconds
**Components**: All 7 + Voting System

1. Voting session initiated (JWT auth verified)
2. 100 agents receive vote request (RabbitMQ broadcast)
3. Each agent validates vote input (Validation component)
4. Votes stored in Redis cache (Database component)
5. Voting progress logged (Logging component)
6. Metrics updated in real-time (Monitoring component)
7. Consensus calculated when 60% voted
8. Results logged to audit trail (Logging component)

**Success Criteria**:
- All 100 votes recorded
- Consensus reached correctly
- Audit trail complete
- Results persisted
- Metrics show 100% participation

### Workflow 3: Brainstorming - 50 Suggestions with Voting

**Duration**: ~15 seconds
**Components**: All 7 + Brainstorm + Voting Systems

1. Brainstorm session created (Auth verified)
2. 50 agents submit suggestions (RabbitMQ fanout)
3. Each suggestion validated (Validation component)
4. Suggestions stored in PostgreSQL (Persistence)
5. Voting on suggestions initiated
6. Consensus voting completed
7. Top suggestions logged (Logging)
8. Performance metrics collected (Monitoring)

**Success Criteria**:
- 50 suggestions received and stored
- All validated successfully
- Voting results consistent
- Performance < 500ms response time
- No data loss or corruption

### Workflow 4: Error Recovery - Simulate Failure → Auto-Retry → Success

**Duration**: ~8 seconds
**Components**: All 7 + Error Recovery

1. Task published with simulated database failure
2. Error caught and logged (Error Handler)
3. Retry scheduled with exponential backoff (Error Recovery)
4. Database connection restored
5. Task retry succeeds
6. Success logged and metrics updated
7. Alert cleared (Monitoring)

**Success Criteria**:
- Failure detected and logged
- Retry executed automatically
- Task completes successfully on retry
- No manual intervention needed
- Metrics show single task count (not incremented by retry)

## Running Tests

### Run All Integration Tests

```bash
npm run test:integration:full
```

### Run Specific Test Suite

```bash
npm run test:integration:auth
npm run test:integration:rabbitmq
npm run test:integration:validation
npm run test:integration:logging
npm run test:integration:error-recovery
npm run test:integration:monitoring
npm run test:integration:persistence
npm run test:integration:e2e
```

### Run with Options

```bash
# Verbose output
npm run test:integration:full -- --verbose

# Performance profiling
npm run test:integration:full -- --perf

# Single threaded (for debugging)
npm run test:integration:full -- --single-thread

# Coverage report
npm run test:integration:full -- --coverage
```

### Run in CI/CD Pipeline

```bash
npm run test:ci
```

## Test Output & Reporting

### Console Output

Tests display:
- Test name and suite
- Progress indicator (passed/failed/total)
- Execution time
- Error details with stack traces
- Summary statistics

### Example Output

```
╔════════════════════════════════════════════════════════════╗
║          INTEGRATION TEST: AUTH & JWT TOKENS               ║
╚════════════════════════════════════════════════════════════╝

📝 Test 1: JWT Token Generation
  ✅ PASSED - Generated token with correct claims (23ms)
  ✅ PASSED - Token expiry set correctly (5ms)
  ✅ PASSED - Token ID tracking works (3ms)

📝 Test 2: Token Validation
  ✅ PASSED - Valid token accepted (12ms)
  ✅ PASSED - Tampered token rejected (4ms)
  ✅ PASSED - Expired token rejected (2ms)

═══════════════════════════════════════════════════════════════
Test Results: 6 PASSED, 0 FAILED in 847ms
═══════════════════════════════════════════════════════════════
```

### JUnit Report

```bash
# Generate JUnit XML for CI/CD
npm run test:integration:full -- --junit
```

### Coverage Report

```bash
# Generate coverage report
npm run test:integration:full -- --coverage

# View HTML coverage
open coverage/index.html
```

## Performance Expectations

### Response Times (Target: <500ms)

| Operation | Target | Threshold |
|-----------|--------|-----------|
| JWT Token Generation | 10ms | 50ms |
| Queue Publish | 5ms | 50ms |
| Queue Consume | 10ms | 100ms |
| Data Validation | 5ms | 50ms |
| Database Insert | 20ms | 100ms |
| Cache Hit | 2ms | 10ms |
| Cache Miss + Insert | 30ms | 150ms |
| Task Processing | 50ms | 500ms |

### Throughput Expectations

| Operation | Rate | Duration |
|-----------|------|----------|
| Token Generation | 1000/sec | Sustained |
| Message Publishing | 5000/sec | Sustained |
| Database Writes | 500/sec | Sustained |
| Validation | 10000/sec | Sustained |

## Troubleshooting

### Common Issues

#### 1. "RabbitMQ Connection Failed"

**Symptoms**: Tests fail with "Cannot connect to RabbitMQ"

**Solution**:
```bash
# Check container status
docker ps | grep rabbitmq

# Check logs
docker logs agent_rabbitmq

# Restart services
docker-compose -f docker-compose.test.yml restart rabbitmq
```

#### 2. "PostgreSQL Connection Timeout"

**Symptoms**: Database tests timeout

**Solution**:
```bash
# Check PostgreSQL status
docker logs agent_postgres

# Verify network connectivity
docker exec agent_postgres pg_isready

# Restart PostgreSQL
docker-compose -f docker-compose.test.yml restart postgres
```

#### 3. "Redis Connection Refused"

**Symptoms**: Cache tests fail

**Solution**:
```bash
# Check Redis status
docker logs agent_redis

# Verify Redis responds
docker exec agent_redis redis-cli ping

# Clear Redis memory
docker exec agent_redis redis-cli FLUSHALL
```

#### 4. "Tests Timeout or Hang"

**Symptoms**: Tests never complete

**Solution**:
```bash
# Kill hanging processes
pkill -f "node.*test"

# Check for resource exhaustion
docker stats

# Increase Docker memory if needed
# Edit Docker preferences and increase Memory allocation
```

#### 5. "Port Already in Use"

**Symptoms**: "Error: listen EADDRINUSE"

**Solution**:
```bash
# Find process using port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :5672  # RabbitMQ

# Kill process or change port in docker-compose.test.yml
```

### Debugging Tests

#### Enable Debug Logging

```bash
export DEBUG=*
npm run test:integration:full
```

#### Run Single Test

```bash
# Edit end-to-end.test.js and modify test function:
// async function runTests() {
// Only call one test:
// await testAuthTokenGeneration();
// await testRabbitMQMessaging();
// etc.

npm run test:integration:e2e
```

#### Inspect Database State

```bash
# Connect to PostgreSQL
docker exec -it agent_postgres psql -U admin -d agent_orchestrator

# Common queries:
SELECT * FROM agents;
SELECT * FROM tasks;
SELECT * FROM votes;
SELECT * FROM logs ORDER BY created_at DESC LIMIT 10;
```

#### Inspect Redis State

```bash
# Connect to Redis
docker exec -it agent_redis redis-cli

# Common commands:
KEYS *
GET agent:token:xyz
LLEN task:queue
HGETALL voting:session:xyz
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: postgres123
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      rabbitmq:
        image: rabbitmq:3-management-alpine
        env:
          RABBITMQ_DEFAULT_USER: guest
          RABBITMQ_DEFAULT_PASS: guest
        options: >-
          --health-cmd "rabbitmq-diagnostics ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2

      - uses: actions/setup-node@v2
        with:
          node-version: '18'

      - run: npm install

      - run: npm run test:integration:full

      - uses: actions/upload-artifact@v2
        if: always()
        with:
          name: test-results
          path: test-results/
```

### Jenkins Example

```groovy
pipeline {
  stages {
    stage('Integration Tests') {
      steps {
        sh 'docker-compose -f docker-compose.test.yml up -d'
        sh 'npm install'
        sh 'npm run test:integration:full'

        junit 'test-results/**/*.xml'
        publishHTML([
          reportDir: 'coverage',
          reportFiles: 'index.html',
          reportName: 'Coverage Report'
        ])
      }
      post {
        always {
          sh 'docker-compose -f docker-compose.test.yml down -v'
        }
      }
    }
  }
}
```

## Best Practices

### 1. Test Isolation

- Each test cleans up its data
- Queues are purged between tests
- Transactions are rolled back on failure

### 2. Realistic Data

- Use real payloads and workflows
- Test with production-like volumes
- Include edge cases and error scenarios

### 3. Deterministic Tests

- Avoid relying on timestamps (use fixed values)
- Use mocks for external APIs
- Reset state between tests

### 4. Performance Monitoring

- Log execution times
- Alert if tests exceed time thresholds
- Track trends over time

### 5. Failure Analysis

- Capture full logs on failure
- Screenshot container states
- Preserve test data for post-mortem

## Extending Integration Tests

### Adding New Test Suite

1. Create new file in `tests/integration/`
2. Import TestSetup and utilities
3. Implement test class with runTests() method
4. Add to `tests/integration/run-all.js`
5. Update npm scripts in package.json

### Example Test Template

```javascript
import TestSetup, { waitForCondition, wait, assert } from './setup.js';

class MyComponentTest {
  constructor() {
    this.setup = new TestSetup();
    this.testResults = { passed: 0, failed: 0, errors: [] };
  }

  async runTests() {
    try {
      await this.setup.startRabbitMQ();
      await this.testMyFeature1();
      await this.testMyFeature2();
      this.printResults();
      return this.testResults.failed === 0;
    } finally {
      await this.cleanup();
    }
  }

  async testMyFeature1() {
    console.log('\n📝 Test: My Feature 1');
    try {
      // Test implementation
      assert(true, 'Feature works');
      console.log('✅ Test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      this.testResults.failed++;
    }
  }

  async cleanup() {
    await this.setup.stopRabbitMQ();
  }

  printResults() {
    console.log('\n═══════════════════════════════════════════════');
    console.log(`Results: ${this.testResults.passed} PASSED, ${this.testResults.failed} FAILED`);
  }
}

const test = new MyComponentTest();
test.runTests().then(success => process.exit(success ? 0 : 1));
```

## Contact & Support

For issues, questions, or contributions:

- Create issue in repository
- Check existing test examples
- Review component documentation
- Contact testing team

---

**Last Updated**: November 2024
**Version**: 1.0.0
**Status**: Production Ready
