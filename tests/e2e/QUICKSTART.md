# E2E Tests Quick Start Guide

## Prerequisites

### 1. Start RabbitMQ

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
```

Verify it's running:
```bash
curl http://localhost:15672
# Should return HTML (login page)
```

### 2. Install Dependencies

```bash
cd /home/user/plugin-ai-agent-rabbitmq
npm install
```

## Running Tests

### Quick Test (Recommended First Run)

```bash
npm run test:e2e:quick
```

This runs all tests except performance (faster, ~2-3 minutes).

### Full Test Suite

```bash
npm test
# or
npm run test:e2e
```

Runs all tests including performance (~3-5 minutes).

### Individual Tests

```bash
# 5-Terminal Scenario (best demo of the system)
npm run test:e2e:5-terminal

# Git Worktree Integration
npm run test:e2e:worktree

# Failure Recovery
npm run test:e2e:failure

# Scaling Tests
npm run test:e2e:scaling

# Performance Benchmark
npm run test:e2e:performance
```

### Performance Only

```bash
npm run test:e2e:perf
```

### Verbose Output

```bash
npm run test:e2e:verbose
```

## What to Expect

### Successful Run

```
╔════════════════════════════════════════════════════════════╗
║        E2E Test Suite - Multi-Agent Orchestration         ║
╚════════════════════════════════════════════════════════════╝

🔍 Checking prerequisites...

✅ RabbitMQ is running and accessible

📝 Running 5 test suite(s)...

============================================================
  Running: 5-Terminal Scenario
  Category: functional
  Estimated time: 15-30s
============================================================

🚀 Starting team-leader: Test-Leader
✅ Test-Leader started in 1234.56ms

...

✅ PASSED: 5-Terminal Scenario
⏱️  Duration: 18.45s

...

╔════════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                            ║
╚════════════════════════════════════════════════════════════╝

📊 Overall Results:
   Total tests:    5
   ✅ Passed:      5
   ❌ Failed:      0
   ⏭️  Skipped:     0
   ⏱️  Total time:  142.67s

🎉 All tests passed! System is working correctly.
```

### Common Output

Each test will show:
- Agent startup logs
- Task assignments
- Message flow
- Timing metrics
- Test assertions
- Pass/fail status

## Understanding Test Results

### 5-Terminal Scenario Test

**What it does:**
- Starts 5 agents (1 leader, 2 workers, 2 collaborators)
- Leader assigns a collaborative task
- Worker picks it up and initiates brainstorm
- Collaborators respond with suggestions
- Worker aggregates and completes task
- Leader receives final result

**Success criteria:**
- All 5 agents start successfully
- Task is picked up by a worker
- Brainstorm receives collaborator responses
- Task completes with aggregated result
- Leader receives the final result

### Git Worktree Test

**What it does:**
- Creates 3 git worktrees with separate branches
- Starts agents in each worktree
- Coordinates work across worktrees
- Verifies no conflicts
- Cleans up worktrees

**Success criteria:**
- Worktrees created successfully
- Agents work in isolated directories
- Tasks complete without conflicts
- Proper cleanup

### Failure Recovery Test

**What it does:**
- Starts 3 workers and 1 leader
- Assigns task to a worker
- Kills worker mid-task
- Verifies task is reassigned
- Tests network interruption recovery
- Tests retry logic

**Success criteria:**
- Agent killed successfully
- Task requeued and reassigned
- Another worker completes the task
- Network interruption handled
- Retry logic works correctly

### Scaling Test

**What it does:**
- Starts with 2 workers
- Processes tasks and measures performance
- Adds 3 more workers (scale to 5)
- Verifies load balancing
- Removes workers (scale down to 2)
- Tests rebalancing

**Success criteria:**
- System scales up successfully
- Load is balanced across workers
- Throughput improves with more workers
- System handles scale-down gracefully
- Rebalancing works correctly

### Performance Test

**What it does:**
- Processes 100 tasks across 5 workers
- Measures throughput (tasks/sec)
- Measures latency percentiles (p50, p95, p99)
- Tracks resource usage (CPU, memory)
- Generates detailed report

**Success criteria:**
- 100 tasks complete successfully
- Throughput > 5 tasks/sec
- P95 latency < 5 seconds
- Memory usage < 500 MB
- Report generated

**Report location:** `tests/e2e/performance-report.json`

## Troubleshooting

### RabbitMQ Not Running

**Error:**
```
❌ RabbitMQ is not accessible on localhost:15672
```

**Solution:**
```bash
docker start rabbitmq
# or if doesn't exist
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### Tests Timeout

**Error:**
```
⚠️  Timeout reached: X/Y completed
```

**Solutions:**
1. Check RabbitMQ has enough resources:
   ```bash
   docker stats rabbitmq
   ```

2. Increase memory for Node.js:
   ```bash
   node --max-old-space-size=4096 tests/e2e/5-terminal-scenario.test.js
   ```

3. Restart RabbitMQ:
   ```bash
   docker restart rabbitmq
   ```

### Connection Errors

**Error:**
```
❌ Failed to connect: ECONNREFUSED
```

**Solution:**
```bash
# Check RabbitMQ is running
docker ps | grep rabbitmq

# Check RabbitMQ logs
docker logs rabbitmq

# Verify port is accessible
telnet localhost 5672
```

### Memory Errors

**Error:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solution:**
```bash
# Increase Node.js heap size
node --max-old-space-size=4096 tests/e2e/performance.test.js

# Or set environment variable
export NODE_OPTIONS="--max-old-space-size=4096"
npm run test:e2e:performance
```

## Performance Expectations

### Expected Metrics (Standard Hardware)

- **Agent startup time:** < 3 seconds per agent
- **Task assignment time:** < 50ms per task
- **Task processing time:** 1-5 seconds per task
- **Throughput:** 5-15 tasks/sec (5 workers)
- **P95 latency:** < 3 seconds
- **P99 latency:** < 5 seconds
- **Memory usage:** < 200 MB
- **Max concurrency:** 3-5 tasks

### Performance by Worker Count

| Workers | Expected Throughput |
|---------|---------------------|
| 2       | 3-6 tasks/sec       |
| 5       | 8-15 tasks/sec      |
| 10      | 15-25 tasks/sec     |

### Test Duration

| Test | Expected Duration |
|------|-------------------|
| 5-Terminal | 15-30s |
| Git Worktree | 20-40s |
| Failure Recovery | 25-45s |
| Scaling | 30-60s |
| Performance | 60-120s |
| **Total (Quick)** | **90-175s** |
| **Total (Full)** | **150-295s** |

## Tips for Best Results

### 1. Clean Environment

```bash
# Stop all running tests
pkill -f "node tests/e2e"

# Restart RabbitMQ
docker restart rabbitmq

# Wait for RabbitMQ to be ready
sleep 5
```

### 2. Run Tests Sequentially

Don't run multiple test suites in parallel. The test runner handles this automatically.

### 3. Monitor RabbitMQ

Open management UI during tests:
```bash
open http://localhost:15672
# Login: guest / guest
```

Watch:
- Connections (should be 5-10 during tests)
- Queues (agent.tasks, agent.results)
- Message rates
- Memory usage

### 4. Check System Resources

```bash
# Monitor during tests
watch -n 1 'docker stats rabbitmq --no-stream'
```

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    services:
      rabbitmq:
        image: rabbitmq:3-management
        ports:
          - 5672:5672
          - 15672:15672
        options: >-
          --health-cmd "rabbitmq-diagnostics ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run E2E tests
        run: npm run test:e2e:quick

      - name: Upload performance report
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: performance-report
          path: tests/e2e/performance-report.json
```

### Local CI Simulation

```bash
# Run tests like CI would
docker run -d --name rabbitmq-ci \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management

# Wait for RabbitMQ
sleep 10

# Run tests
npm run test:e2e:quick

# Cleanup
docker rm -f rabbitmq-ci
```

## Next Steps

1. **Start simple:** Run `npm run test:e2e:5-terminal` first
2. **Understand flow:** Watch the agent interactions
3. **Run quick suite:** Try `npm run test:e2e:quick`
4. **Check performance:** Run `npm run test:e2e:performance`
5. **View report:** Open `tests/e2e/performance-report.json`

## Need Help?

- Check RabbitMQ logs: `docker logs rabbitmq`
- View test output in detail: `npm run test:e2e:verbose`
- Run single test with debug: `node --inspect tests/e2e/5-terminal-scenario.test.js`
- Check RabbitMQ UI: http://localhost:15672

## Success Indicators

You'll know tests are working when you see:

1. ✅ All agents start successfully
2. 📋 Tasks are assigned and picked up
3. 🧠 Brainstorms receive responses
4. 📊 Results are received by leader
5. ⏱️ Performance metrics within expected ranges
6. 🎉 "All tests passed" message

Enjoy testing the multi-agent orchestration system!
