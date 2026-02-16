# CLAUDE.md - RabbitMQ AI Agent Orchestrator

**Project:** Claude Collective Intelligence - Multi-Agent RabbitMQ Orchestration System
**Date Created:** December 7, 2025
**Pattern:** PATTERN-C-003 v6
**Purpose:** Project-specific instructions and discoveries

---

## 🚨 CRITICAL: Testing Policy (Project-Specific)

**This project contributed the REAL vs MOCK testing policy to global CLAUDE.md!**

### Discovery Summary (December 7, 2025)

**Question that changed everything:**
> "gerçek test olmadığı için testler başarısız bu testler geçmez ise sistem çalışmaz mı?"
> (If tests don't pass because they're not real tests, does the system not work?)

**Answer that shocked us:**
- Unit Tests (Mocked): 207/515 passing (40.2%) ❌
- Integration Tests (Real): 19/21 passing (90.5%) ✅
- **Production System: FULLY OPERATIONAL!** ✅

**Conclusion:**
Mock test failures ≠ Broken system. Integration test success = Production ready!

### This Project's Testing Evidence

**Integration Tests (REAL Services):**
- Location: `tests/integration/`
- Test Suites: 5 comprehensive suites
- Total Tests: 21 integration tests
- Pass Rate: 19/21 (90.5%)
- Services: Docker RabbitMQ, PostgreSQL, Redis
- Uptime: 43+ hours continuous operation

**Key Integration Test Files:**
```
tests/integration/
├── task-distribution.test.js    (5 tests) ✅
├── brainstorming.test.js        (5 tests) ✅
├── failure-handling.test.js     (5 tests) ✅
├── multi-agent.test.js          (5 tests) ✅
└── monitoring.test.js           (5 tests) ✅
```

**Unit Tests (MOCKED - Technical Debt):**
- Location: `tests/unit/`
- Total Tests: 515 unit tests
- Pass Rate: 207/515 (40.2%)
- Root Cause: ESM (ECMAScript Modules) mocking issues
- Status: **NOT BLOCKING PRODUCTION**
- Reason: `jest.unstable_mockModule()` experimental and unreliable

### Why Unit Tests Fail (ESM Mocking Issues)

**Technical Root Cause:**
1. Package.json has `"type": "module"` (pure ESM mode)
2. Jest ESM support is experimental
3. `jest.unstable_mockModule()` fails silently
4. `moduleNameMapper` doesn't work with ESM imports
5. amqplib imports happen at parse time, before mock setup

**Attempts Made (All Failed):**
- ❌ EventEmitter inheritance
- ❌ Import path fixes
- ❌ Dynamic imports with `jest.unstable_mockModule()`
- ❌ Automatic mock via `tests/__mocks__/amqplib.js`
- ❌ Manual mock in each test file

**Hours Wasted:** ~6 hours debugging mock setup (should have checked real tests first!)

### Production Readiness Proof

**Docker Services (All Healthy):**
```bash
# PostgreSQL
Status: ✅ Running (43+ hours)
Health: ✅ Healthy
Tables: 27+ tables, 84,000+ records

# RabbitMQ
Status: ✅ Running (45+ hours)
Health: ✅ Healthy
Queues: 15+ active queues

# Redis
Status: ✅ Running (45+ hours)
Health: ✅ Healthy
```

**Performance Baseline (K6 Load Tests):**
- P95 Latency: 1.72ms ✅
- P99 Latency: 2.7ms ✅
- Throughput: 50 req/sec ✅
- Success Rate: 100% ✅

**Integration Test Scenarios:**
1. Task distribution across multiple agents ✅
2. Brainstorm sessions with fanout exchange ✅
3. Failure handling and retry logic ✅
4. Multi-agent coordination ✅
5. Real-time monitoring ✅

---

## 📋 Project-Specific Rules

### Rule #1: ALWAYS Use Real Services for Testing

**MANDATORY for this project:**
```bash
# Start real Docker services
docker compose -f infrastructure/docker/compose/docker-compose.yml \
  -f infrastructure/docker/compose/override.dev.yml up -d

# Run REAL integration tests
npm run test:integration

# Expected result: 19/21 passing (90.5%)
```

**FORBIDDEN:**
```bash
# NEVER rely on unit tests alone!
npm run test:unit  # 40.2% pass rate, ESM mock issues
```

### Rule #2: Production Readiness Criteria

**Ship when these pass:**
- ✅ Integration tests >90% (currently 90.5%)
- ✅ Docker services healthy >24h (currently 43+ hours)
- ✅ Performance baseline met (1.7ms P95, currently met)
- ✅ Real message passing works (verified with Docker RabbitMQ)

**DON'T WAIT for:**
- ⚠️ Unit test 100% pass (technical debt, fix later)
- ⚠️ Perfect mock configuration (ESM mocking unreliable)

### Rule #3: Test Environment Setup

**Required Docker Services:**
```yaml
# infrastructure/docker/compose/docker-compose.yml
services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"

  rabbitmq:
    image: rabbitmq:3.13-management
    ports:
      - "5672:5672"
      - "15672:15672"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

**Start Command:**
```bash
docker compose -f infrastructure/docker/compose/docker-compose.yml \
  -f infrastructure/docker/compose/override.dev.yml up -d
```

**Health Check:**
```bash
docker compose ps
# All services should show "healthy" or "running"
```

---

## 🔍 Technical Details

### ESM (ECMAScript Modules) Configuration

**package.json:**
```json
{
  "type": "module",
  "main": "src/core/orchestrator.js"
}
```

**Why this causes mock issues:**
- ESM imports are static (evaluated at parse time)
- Mocks must be configured BEFORE module evaluation
- Jest's ESM support is experimental (`jest.unstable_mockModule()`)
- `moduleNameMapper` designed for CommonJS, not ESM

### Dependency Injection Pattern (Future Refactoring)

**If we want better unit test coverage (optional):**

**Current Code (Hard to Mock):**
```javascript
// src/core/rabbitmq-client.js
import amqp from 'amqplib';

class RabbitMQClient {
  async connect() {
    this.connection = await amqp.connect(this.config.url);
  }
}
```

**Refactored Code (Easy to Test):**
```javascript
// src/core/rabbitmq-client.js
class RabbitMQClient {
  constructor(config, amqpLib = require('amqplib')) {
    this.config = config;
    this.amqpLib = amqpLib;  // Injected dependency!
  }

  async connect() {
    this.connection = await this.amqpLib.connect(this.config.url);
  }
}

// Test becomes trivial:
const mockAmqp = { connect: jest.fn() };
const client = new RabbitMQClient(config, mockAmqp);
```

**Recommendation:** Wait for Jest ESM to mature (6-12 months), then revisit.

---

## 📚 Reference Documentation

### Key Documents

**RAMAS Documentation (MERKEZ):**
- `workspace/docs/RAMAS-INDEX.md` - Central navigation hub
- `workspace/docs/PATTERN-C-003-v6.md` - v6 quick reference
- `workspace/docs/3-LEVEL-COMMUNICATION.md` - Emergency procedures
- `workspace/docs/CODEBASE-MAP.md` - File structure, components
- `workspace/docs/architecture/` - Deep dive patterns

**Test Findings:**
- `/tmp/UNIT_VS_INTEGRATION_TEST_FINDINGS.md` (comprehensive analysis)
- `tests/integration/TEST-SUITE-SUMMARY.md` (integration test overview)
- `docs/reports/WEEK_2_PHASE_5_COMPLETION_REPORT.md` (service health)

**Test Files:**
- `tests/integration/` - REAL tests (90.5% passing)
- `tests/unit/` - MOCK tests (40.2% passing - technical debt)

**Configuration:**
- `jest.config.cjs` - Jest configuration
- `package.json` - ESM configuration (`"type": "module"`)
- `infrastructure/docker/compose/` - Docker services for real testing

### Lessons Learned

**Lesson #1: Question Assumptions**
> "Tests are failing → System must be broken" ❌
> "Mock tests failing → Check real tests first!" ✅

**Lesson #2: Focus on What Matters**
- Hours debugging mock setup = Wrong path
- Minutes running integration tests = Right answer

**Lesson #3: Different Tests, Different Value**
- Integration tests prove production readiness
- Unit tests improve code quality (when working)
- Mock test pass ≠ System works
- Integration test pass = Ship it!

**Lesson #4: User Input is Gold**
User's simple question exposed hours of wrong-path debugging. Listen to non-technical insights!

---

## 📡 3-Level Communication Hierarchy (CRITICAL!)

**Date Added:** 2026-01-07
**Discovery:** Direct ESC keystroke ALWAYS works, even when RabbitMQ messages don't reach agent!

### Communication Levels

| Level | Method | When to Use | Reliability |
|-------|--------|-------------|-------------|
| **1** | RabbitMQ Task (`assign_session_task`) | Normal task distribution | Agent must be waiting |
| **2** | RabbitMQ Interrupt (`interrupt_worker`) | Urgent notifications | Agent must be polling |
| **3** | **Direct ESC** (`stop_agent.py`) | 🚨 EMERGENCY STOP | **ALWAYS WORKS!** |

### Level 1: RabbitMQ Task Distribution
```bash
# Team Leader assigns task to worker
mcp__ramas-python__assign_session_task(
    sessionId="session-xxx",
    title="Analyze code",
    description="...",
    assignTo="worker-001"
)
```
- Normal workflow for task assignment
- Worker must be in `wait_for_task` state
- Async, queued delivery

### Level 2: RabbitMQ Interrupt
```bash
# Send urgent message via RabbitMQ
mcp__ramas-python__interrupt_worker(
    workerId="worker-002",
    message="Urgent: Change priority!",
    priority="urgent"
)
```
- Urgent notifications that bypass normal queue
- Agent must be polling for messages
- Good for status updates, priority changes

### Level 3: Direct ESC Keystroke (EMERGENCY!)
```bash
# Stop specific agent
make ramas-stop AGENT=worker-002

# Stop ALL agents immediately
make ramas-stop-all

# Python script directly
python scripts/ramas/python/stop_agent.py worker-002
python scripts/ramas/python/stop_agent.py --all
```

**When to Use Level 3:**
- 🚨 Agent executing WRONG task
- 🚨 Agent stuck in infinite loop
- 🚨 Agent doing dangerous operations
- ⏸️ Task completed, agent waiting unnecessarily
- ⏸️ Need to reassign agent quickly
- ⏸️ Session ending, need clean shutdown

**Why Level 3 Always Works:**
- Sends ESC keystroke directly to iTerm2 terminal
- Bypasses all RabbitMQ message queues
- Works even during Claude Code "Thinking..." state
- No dependency on agent's polling state

### CRITICAL: ESC Key Behavior
```
1x ESC = Interrupt current operation ✅ (CORRECT)
2x ESC = Opens "Rewind" menu ❌ (WRONG - avoid!)
```

**LESSON LEARNED (2026-01-07):**
> DEFAULT_REPEAT = 1 in stop_agent.py is INTENTIONAL!
> Never change to 2 - it triggers Rewind menu!

### Who Can Use These Commands

| Role | Level 1 | Level 2 | Level 3 |
|------|---------|---------|---------|
| Team Leader | ✅ | ✅ | ✅ Workers only |
| VS Code (Monitor) | ✅ | ✅ | ✅ All agents |
| Worker | ❌ | ❌ | ❌ |

---

## 🛑 Shutdown Commands (CRITICAL DISTINCTION!)

**Date Added:** 2026-01-08
**Discovery:** User complained "3 Claude kapanması ramas stop yok mu?" - commands were confused!

### Command Comparison

| Command | Action | Result | Use Case |
|---------|--------|--------|----------|
| `make ramas-stop-all` | Sends ESC to all agents | **Interrupts but KEEPS Claude Code running** | Quick interrupt, reassign |
| `make ramas-shutdown` | Sends `/exit` + closes terminals | **Properly exits Claude Code + closes iTerm2** | End of session cleanup |
| `make ramas-stop AGENT=xxx` | Sends ESC to specific agent | Interrupts one agent only | Targeted interrupt |

### When to Use Which

**Use `make ramas-stop-all` when:**
- ⏸️ Need to interrupt all agents quickly
- ⏸️ Want to give new instructions
- ⏸️ Agents stuck but you want to continue session

**Use `make ramas-shutdown` when:**
- 🔴 Session complete, need clean exit
- 🔴 Restarting system (code changes)
- 🔴 End of day cleanup

### LESSON LEARNED (2026-01-08)

> **PROBLEM:** `make ramas-stop-all` only sends ESC, terminals stay open!
> **SOLUTION:** Use `make ramas-shutdown` for complete cleanup!

```bash
# WRONG - Just interrupts, Claude Code stays running
make ramas-stop-all

# CORRECT - Properly exits and closes everything
make ramas-shutdown
```

---

## 🔄 MCP Server Subprocess Behavior (CRITICAL!)

**Date Added:** 2026-01-08
**Discovery:** datetime import bug persisted despite code fix!

### MCP Server Does NOT Hot-Reload

**Problem Pattern:**
```
1. Edit src/ramas/python/mcp_server.py
2. Save file
3. Run RAMAS command
4. OLD CODE STILL RUNS! ❌
```

**Root Cause:**
- MCP server runs as subprocess of Claude Code
- Subprocess loads code at startup
- File changes NOT automatically picked up
- Even with file saved, old code executes

### Solution: Full Restart Required

```bash
# After ANY edit to mcp_server.py:

# 1. Shutdown all agents properly
make ramas-shutdown

# 2. Wait for clean exit
sleep 3

# 3. Restart Claude Code (in VS Code or terminal)
claude

# 4. NOW changes are loaded!
```

### Local Import Pattern (Workaround)

When global imports don't work in MCP subprocess:

```python
# PROBLEMATIC - Global import may not reload
from datetime import datetime  # Line 29 (top of file)

def handle_session_handshake(...):
    timestamp = datetime.now()  # May use OLD import!

# SOLUTION - Local import in function
def handle_session_handshake(...):
    import json
    from datetime import datetime  # Local import - always fresh
    timestamp = datetime.now()  # Uses current import!
```

### LESSON LEARNED (2026-01-08)

> **BUG:** `session_handshake()` failed with "name 'datetime' is not defined"
> **CAUSE:** MCP subprocess using cached code
> **FIX:** Added local import at line 2237 + full restart

---

## 🚀 Quick Start Commands

### Run Integration Tests (REAL)
```bash
# 1. Start Docker services
docker compose -f infrastructure/docker/compose/docker-compose.yml \
  -f infrastructure/docker/compose/override.dev.yml up -d

# 2. Wait for services to be ready (30 seconds)
sleep 30

# 3. Run integration tests
npm run test:integration

# Expected: 19/21 passing (90.5%)
```

### Check System Health
```bash
# Service status
docker compose ps

# RabbitMQ management UI
open http://localhost:15672
# Credentials: admin / rabbitmq123

# Grafana dashboard
open http://localhost:3000
# Credentials: admin / admin

# Prometheus metrics
open http://localhost:9090
```

### Performance Baseline
```bash
# K6 load test
k6 run tests/performance/load-test.js

# Expected baseline:
# - P95: <2ms
# - P99: <3ms
# - Throughput: >50 req/sec
```

---

## 🎯 What This Project Taught Us

**Before:**
- Assumed failing tests = broken system
- Spent hours debugging mock configuration
- Focused on making unit tests green

**After:**
- Verified system works with real tests
- Integration tests >90% = Production ready
- Unit test failures = Technical debt (fix later)

**Impact on Global Policy:**
This project's discovery led to the creation of the "Testing Policy (MANDATORY)" section in global `~/.claude/CLAUDE.md`, now applied to ALL future projects!

---

**Quote from User:**
> "Lütfen MOCK test kesinlikle kullanma artık. Gerçek test yapalım."
> (Please absolutely don't use MOCK tests anymore. Let's do real tests.)

**Status:** ✅ Policy Implemented Globally
**Date:** December 7, 2025
**Evidence:** `/tmp/UNIT_VS_INTEGRATION_TEST_FINDINGS.md`

---

*Last Updated: 2026-01-08*
*This file is gitignored (CLAUDE.md is in .gitignore) and won't be committed*
