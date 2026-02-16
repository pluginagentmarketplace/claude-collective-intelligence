# End-to-End Tests

Comprehensive E2E tests for the multi-agent orchestration system with RabbitMQ.

## Test Suites

### 1. 5-Terminal Scenario Test (`5-terminal-scenario.test.js`)

Tests the complete multi-agent collaborative workflow.

**What it tests:**
- Starting 5 agents (1 leader, 2 workers, 2 collaborators)
- Assigning collaborative tasks
- Worker picking up task and initiating brainstorm
- Collaborators responding to brainstorm
- Worker aggregating responses
- Leader receiving final result
- End-to-end message flow verification

**Run:**
```bash
node tests/e2e/5-terminal-scenario.test.js
```

**Expected output:**
- All 5 agents start successfully
- Task is assigned and picked up by a worker
- Brainstorm is initiated and collaborators respond
- Task completes successfully
- Performance metrics reported

---

### 2. Git Worktree Integration Test (`git-worktree.test.js`)

Tests agent coordination across multiple git worktrees.

**What it tests:**
- Setting up multiple git worktrees
- Starting agents in different worktrees
- Coordinating work across worktrees
- Verifying no conflicts between worktrees
- Ensuring proper isolation
- Cleanup of worktrees

**Run:**
```bash
node tests/e2e/git-worktree.test.js
```

**Expected output:**
- Creates 3 worktrees with separate branches
- Starts agents in each worktree
- Processes tasks in isolated environments
- No merge conflicts detected
- Clean teardown

---

### 3. Failure Recovery Test (`failure-recovery.test.js`)

Tests system resilience and recovery mechanisms.

**What it tests:**
- Killing agent mid-task
- Auto-retry logic with exponential backoff
- Task reassignment to another worker
- Network interruption recovery
- Message persistence during failures
- Complete recovery flow

**Run:**
```bash
node tests/e2e/failure-recovery.test.js
```

**Expected output:**
- Agent fails while processing task
- Task is requeued and reassigned
- Another worker picks up the task
- Task completes successfully
- Retry mechanisms work correctly

---

### 4. Scaling Test (`scaling.test.js`)

Tests dynamic scaling and load balancing.

**What it tests:**
- Starting with 2 workers
- Processing tasks with initial scale
- Adding 3 more workers dynamically
- Load balancing across 5 workers
- Removing workers (scale down)
- Rebalancing after scale changes
- Performance comparison at different scales

**Run:**
```bash
node tests/e2e/scaling.test.js
```

**Expected output:**
- System scales from 2 to 5 workers
- Tasks are evenly distributed
- Throughput improves with more workers
- System handles scale-down gracefully
- Load balancing score > 70/100

---

### 5. Performance Benchmark (`performance.test.js`)

Comprehensive performance testing and analysis.

**What it tests:**
- Processing 100 tasks across 5 workers
- Measuring throughput (tasks/sec)
- Measuring latency (p50, p95, p99)
- Tracking resource usage (CPU, memory)
- Concurrent task execution
- Generating detailed performance report

**Run:**
```bash
node tests/e2e/performance.test.js
```

**Expected output:**
- 100 tasks processed successfully
- Throughput metrics calculated
- Latency percentiles (p50, p75, p90, p95, p99)
- Resource usage tracked
- Performance report generated (JSON)

**Report location:** `tests/e2e/performance-report.json`

---

## Prerequisites

### 1. RabbitMQ Running

Start RabbitMQ using Docker:

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
```

Verify RabbitMQ is running:
```bash
curl http://localhost:15672
# Login: guest / guest
```

### 2. Dependencies Installed

```bash
npm install
```

### 3. Environment Variables (Optional)

Create `.env` file in project root:

```env
RABBITMQ_URL=amqp://localhost:5672
AGENT_ID=test-agent-001
PREFETCH_COUNT=1
HEARTBEAT_INTERVAL=30
AUTO_RECONNECT=true
```

---

## Running Tests

### Run Individual Test

```bash
# 5-terminal scenario
node tests/e2e/5-terminal-scenario.test.js

# Git worktree
node tests/e2e/git-worktree.test.js

# Failure recovery
node tests/e2e/failure-recovery.test.js

# Scaling
node tests/e2e/scaling.test.js

# Performance
node tests/e2e/performance.test.js
```

### Run All Tests

```bash
node tests/e2e/run-all.js
```

### Run Specific Test Suite

```bash
# Run only quick tests (no performance)
node tests/e2e/run-all.js --quick

# Run only performance tests
node tests/e2e/run-all.js --perf

# Run with verbose output
node tests/e2e/run-all.js --verbose
```

---

## Test Output

### Success Example

```
═══════════════════════════════════════════
  E2E TEST: 5-Terminal Scenario
═══════════════════════════════════════════

🚀 Starting team-leader: Test-Leader
✅ Test-Leader started in 1234.56ms

🚀 Starting worker: Test-Worker-1
✅ Test-Worker-1 started in 987.65ms

...

✅ All 5 agents initialized successfully

───────────────────────────────────────────
  TEST: Collaborative Task Flow
───────────────────────────────────────────

📋 Leader assigning collaborative task...
✅ Task assigned: abc123

⏳ Waiting for worker to pick up task...
✅ Task picked up by Test-Worker-1

...

═══════════════════════════════════════════
  TEST SUMMARY
═══════════════════════════════════════════

✅ Tests passed: 4
❌ Tests failed: 0
⏱️  Total time: 15234.56ms

═══════════════════════════════════════════
```

### Failure Example

```
❌ TEST FAILED: Timeout waiting for condition
    at TestHelpers.waitFor (/path/to/test.js:123:11)
    at testCollaborativeTask (/path/to/test.js:456:22)
```

---

## Debugging Tests

### Enable Verbose Logging

Set environment variable:

```bash
DEBUG=* node tests/e2e/5-terminal-scenario.test.js
```

### Check RabbitMQ Management UI

Open browser: `http://localhost:15672`
- View queues
- Monitor message rates
- Check connections
- Inspect exchanges

### View RabbitMQ Logs

```bash
docker logs rabbitmq
```

### Common Issues

#### Issue: Connection refused

**Solution:**
```bash
# Check RabbitMQ is running
docker ps | grep rabbitmq

# Restart RabbitMQ
docker restart rabbitmq
```

#### Issue: Tests timeout

**Solution:**
- Increase `TEST_CONFIG.TIMEOUT` in test file
- Check RabbitMQ has sufficient resources
- Verify network connectivity

#### Issue: Memory errors

**Solution:**
```bash
# Increase Node.js memory
node --max-old-space-size=4096 tests/e2e/performance.test.js
```

---

## Performance Benchmarks

Expected performance on standard hardware (4 CPU, 8GB RAM):

| Metric | Expected Value |
|--------|----------------|
| Throughput | 5-15 tasks/sec |
| P95 Latency | < 3000ms |
| P99 Latency | < 5000ms |
| Worker Startup | < 3000ms |
| Max Concurrency | 3-5 tasks |
| Memory Usage | < 200 MB |

**Note:** Actual values depend on:
- Hardware specifications
- RabbitMQ configuration
- Network latency
- System load

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      rabbitmq:
        image: rabbitmq:3-management
        ports:
          - 5672:5672
          - 15672:15672

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run E2E tests
        run: node tests/e2e/run-all.js
        env:
          RABBITMQ_URL: amqp://localhost:5672

      - name: Upload performance report
        uses: actions/upload-artifact@v2
        with:
          name: performance-report
          path: tests/e2e/performance-report.json
```

---

## Test Data Cleanup

Tests automatically clean up:
- Agent connections
- RabbitMQ queues (auto-delete)
- Temporary worktrees
- Test results

Manual cleanup if needed:

```bash
# Remove RabbitMQ queues
docker exec rabbitmq rabbitmqctl purge_queue agent.tasks
docker exec rabbitmq rabbitmqctl purge_queue agent.results

# Remove test worktrees
rm -rf /tmp/worktree-test

# Restart RabbitMQ (nuclear option)
docker restart rabbitmq
```

---

## Contributing

When adding new tests:

1. Follow existing test structure
2. Include proper cleanup in `finally` block
3. Add timing measurements
4. Document expected behavior
5. Add assertions for verification
6. Update this README

### Test Template

```javascript
async function testNewFeature() {
  console.log('\\n─────────────────');
  console.log('  TEST: New Feature');
  console.log('─────────────────\\n');

  const startTime = performance.now();

  try {
    // Test implementation
    // ...

    const duration = performance.now() - startTime;
    console.log(`✅ Test passed in ${duration.toFixed(2)}ms\\n`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}
```

---

## Support

For issues or questions:
- Check RabbitMQ logs
- Review test output
- Verify prerequisites
- Check GitHub issues

---

## License

MIT
