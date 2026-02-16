# Test Suite Documentation - Claude Collective Intelligence

**Project:** Multi-Agent RabbitMQ Orchestrator with AI Systems
**Test Framework:** Jest (Unit/Integration) + K6 (Performance)
**Last Updated:** December 7, 2025 (Repository Reorganization - Week 2 Phase 3)

---

## 📋 Table of Contents

1. [Directory Structure](#directory-structure)
2. [Quick Start](#quick-start)
3. [Test Organization Philosophy](#test-organization-philosophy)
4. [Running Tests](#running-tests)
5. [Adding New Tests](#adding-new-tests)
6. [Coverage Targets](#coverage-targets)
7. [Test Types Explained](#test-types-explained)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Related Documentation](#related-documentation)

---

## 📁 Directory Structure

```
tests/
├── unit/                           # Unit tests (isolated component testing)
│   ├── core/                       # Core orchestration components
│   │   ├── orchestrator.test.js
│   │   ├── rabbitmq-client.test.js
│   │   └── message-handlers.test.js
│   │
│   ├── systems/                    # AI system tests
│   │   ├── brainstorm/
│   │   │   └── brainstorm-system.test.js
│   │   ├── voting/
│   │   │   └── voting-system.test.js
│   │   ├── mentorship/
│   │   │   └── mentorship-system.test.js
│   │   ├── rewards/
│   │   │   └── rewards-system.test.js
│   │   ├── penalties/
│   │   │   └── penalties-system.test.js
│   │   └── gamification/
│   │       ├── achievement-system.test.js
│   │       ├── battle-system.test.js
│   │       ├── leaderboard-system.test.js
│   │       ├── points-engine.test.js
│   │       ├── reputation-system.test.js
│   │       └── tier-system.test.js
│   │
│   ├── database/                   # Database layer tests
│   │   └── repositories.test.js
│   │
│   ├── utils/                      # Utility function tests
│   │   └── utils.test.js
│   │
│   └── validation/                 # Validation system tests
│       └── validation-system.test.js
│
├── integration/                    # Integration tests (multi-component)
│   ├── brainstorming.test.js
│   ├── brainstorm-system.test.js
│   ├── end-to-end.test.js
│   ├── failure-handling.test.js
│   ├── logging.test.js            # NEW: Converted from test-logging.js
│   ├── mentorship-system.test.js
│   ├── monitoring.test.js
│   ├── multi-agent.test.js
│   ├── multi-agent-starter.test.js
│   ├── penalties-system.test.js
│   ├── rewards-system.test.js
│   ├── task-distribution.test.js
│   ├── voting-system.test.js
│   ├── run-all.js
│   └── setup.js
│
├── e2e/                            # End-to-end workflow tests
│   ├── workflow/
│   │   ├── agent-lifecycle.test.js
│   │   ├── collective-decision.test.js
│   │   ├── task-workflow.test.js
│   │   └── voting-workflow.test.js
│   └── scenarios/
│       └── complete-session.test.js
│
├── performance/                    # K6 load and stress tests
│   ├── load-test.js               # Standard load testing
│   ├── soak-test.js               # Long-duration stability
│   ├── spike-test.js              # Sudden traffic spikes
│   ├── example-custom-test.js     # Template for custom tests
│   ├── common.js                  # Shared test utilities
│   ├── run-all.sh                 # Unix test runner
│   ├── run-all.ps1                # Windows test runner
│   └── README.md                  # K6 test documentation
│
├── security/                       # Security testing
│   └── injection.test.js
│
├── auth/                           # Authentication tests
│   └── README.md
│
├── voting/                         # Voting system tests
│   └── README.md
│
├── core/                           # Core system tests
│   └── README.md
│
├── gamification/                   # Gamification tests
│   └── README.md
│
├── fixtures/                       # Test data and fixtures
│   ├── tasks.json
│   ├── messages.json
│   └── agent-configs.json
│
├── helpers/                        # Test helper utilities
│   ├── test-mocks.js
│   ├── test-setup.js
│   └── rabbitmq-helpers.js
│
├── __mocks__/                      # Jest mock implementations
│   └── amqplib.js
│
├── setup/                          # Test setup scripts
│   └── ... (various setup files)
│
├── global-setup.js                 # Jest global setup
├── global-teardown.js              # Jest global teardown
├── setup.js                        # Test environment setup
├── jest.config.cjs                 # Jest configuration
├── README.md                       # This file
├── QUICKSTART.md                   # Quick start guide
├── UNIT_TESTS_SUMMARY.md          # Unit test documentation
└── TEST-SUITE-SUMMARY.md          # Integration test summary
```

---

## 🚀 Quick Start

### Run All Tests
```bash
# All tests (unit + integration)
npm test

# With coverage
npm run test:coverage
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Security tests
npm run test:security
```

### Run Specific Test Files
```bash
# Single test file
npm test tests/unit/core/orchestrator.test.js

# Pattern matching
npm test -- --testPathPattern=gamification

# Watch mode for development
npm run test:watch
```

### Performance Tests (K6)
```bash
# Install K6 first: https://k6.io/docs/getting-started/installation/

# Run load test
k6 run tests/performance/load-test.js

# Run all performance tests
cd tests/performance
./run-all.sh  # Unix
./run-all.ps1 # Windows
```

---

## 🎯 Test Organization Philosophy

### Separation of Concerns

**Unit Tests (`tests/unit/`)**
- Test individual components in isolation
- Mock all external dependencies
- Fast execution (< 5 minutes for full suite)
- High coverage of business logic

**Integration Tests (`tests/integration/`)**
- Test multiple components working together
- Use real dependencies when possible
- Validate workflows and interactions
- Moderate execution time (5-15 minutes)

**E2E Tests (`tests/e2e/`)**
- Test complete user scenarios
- Real services (RabbitMQ, databases)
- Full workflow validation
- Slower execution (15-30 minutes)

**Performance Tests (`tests/performance/`)**
- Load, stress, and soak testing
- K6 framework (not Jest)
- Run separately from unit/integration
- CI/CD integration optional

---

### Directory Mapping to Source Code

Test directory structure **mirrors** the source code structure:

| Source Code | Unit Tests | Purpose |
|-------------|------------|---------|
| `src/core/orchestrator.js` | `tests/unit/core/orchestrator.test.js` | Core orchestration |
| `src/systems/voting/system.js` | `tests/unit/systems/voting/voting-system.test.js` | Voting system |
| `src/database/repositories/agent-repository.js` | `tests/unit/database/repositories.test.js` | Database layer |

**Why This Matters:**
- Easy to find tests for specific code
- Consistent organization
- Clear ownership of test files
- Scales well as project grows

---

## 🧪 Running Tests

### Standard Commands

```bash
# Run all Jest tests (unit + integration + e2e + security)
npm test

# Run with verbose output
npm test -- --verbose

# Run with coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Advanced Options

```bash
# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with debugger
npm run test:debug

# Run tests in CI mode (no watch, strict)
npm run test:ci

# Run specific test suites
npm run test:unit           # Only unit tests
npm run test:integration    # Only integration tests
npm run test:e2e            # Only E2E tests
npm run test:security       # Only security tests

# Run tests matching pattern
npm test -- --testNamePattern="should handle errors"
npm test -- --testPathPattern="voting"

# Run tests for changed files only
npm test -- --onlyChanged

# Update snapshots
npm test -- --updateSnapshot
```

### Performance Testing (K6)

K6 tests are **separate** from Jest and require the K6 CLI:

```bash
# Install K6
# macOS: brew install k6
# Ubuntu: sudo apt install k6
# Windows: choco install k6

# Run individual performance tests
k6 run tests/performance/load-test.js
k6 run tests/performance/soak-test.js
k6 run tests/performance/spike-test.js

# Run with custom configuration
k6 run --vus 100 --duration 5m tests/performance/load-test.js

# Run all performance tests
cd tests/performance
./run-all.sh  # Unix/Linux/macOS
./run-all.ps1 # Windows PowerShell
```

**K6 Test Types:**
- **load-test.js**: Standard load testing (ramp up, sustain, ramp down)
- **soak-test.js**: Long-duration stability testing (hours)
- **spike-test.js**: Sudden traffic spike handling
- **example-custom-test.js**: Template for custom scenarios

---

## ➕ Adding New Tests

### Step 1: Choose Test Type

**Unit Test** (component in isolation):
- Testing a single function/class
- No external dependencies
- Fast execution
- Location: `tests/unit/[category]/`

**Integration Test** (multiple components):
- Testing component interactions
- Real or mocked dependencies
- Moderate execution time
- Location: `tests/integration/`

**E2E Test** (complete workflow):
- Testing user scenarios
- Real services
- Slow execution
- Location: `tests/e2e/`

---

### Step 2: Create Test File

**Naming Convention:**
```
[component-name].test.js  // Unit/Integration tests
[scenario-name].test.js   // E2E tests
```

**File Location Examples:**
```
# Unit test for new system
tests/unit/systems/new-system/new-system.test.js

# Integration test for workflow
tests/integration/new-workflow.test.js

# E2E test for user scenario
tests/e2e/scenarios/new-user-flow.test.js
```

---

### Step 3: Write Test (Template)

```javascript
/**
 * Unit Test Template
 * Tests: [Component Name]
 * Location: tests/unit/[category]/[name].test.js
 */

import { Component } from '../../../src/[category]/[component].js';

describe('[Component Name] - Unit Tests', () => {
  let component;

  beforeEach(() => {
    // Setup before each test
    component = new Component();
  });

  afterEach(() => {
    // Cleanup after each test
    jest.clearAllMocks();
  });

  describe('[Feature Group]', () => {
    it('should [expected behavior]', async () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = await component.method(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
    });

    it('should handle [error case]', async () => {
      // Test error handling
      await expect(component.method(invalidInput))
        .rejects
        .toThrow('Expected error message');
    });
  });

  describe('[Another Feature Group]', () => {
    it('should [another expected behavior]', () => {
      // Test implementation
    });
  });
});
```

---

### Step 4: Run and Verify

```bash
# Run your new test
npm test tests/unit/systems/new-system/new-system.test.js

# Check coverage
npm run test:coverage

# Verify test passes in CI mode
npm run test:ci
```

---

## 📊 Coverage Targets

### Current Coverage Goals

| Test Type | Lines | Branches | Functions | Statements |
|-----------|-------|----------|-----------|------------|
| **Unit** | 80%+ | 75%+ | 80%+ | 80%+ |
| **Integration** | 60%+ | 55%+ | 60%+ | 60%+ |
| **Combined** | 70%+ | 65%+ | 70%+ | 70%+ |

### Coverage by Module

| Module | Current | Target | Priority |
|--------|---------|--------|----------|
| `src/core/*` | TBD | 85%+ | High |
| `src/systems/*` | TBD | 75%+ | High |
| `src/database/*` | TBD | 80%+ | Medium |
| `scripts/*` | TBD | 60%+ | Low |

**Check Current Coverage:**
```bash
npm run test:coverage
open coverage/index.html
```

---

### Improving Coverage

**Focus Areas (Priority Order):**
1. **Core Orchestration** (`src/core/`)
   - orchestrator.js
   - rabbitmq-client.js
   - mcp-server.js

2. **AI Systems** (`src/systems/`)
   - voting/system.js
   - brainstorm/system.js
   - gamification/*

3. **Database Layer** (`src/database/`)
   - repositories/*
   - client.js

4. **Integration Points**
   - Message handlers
   - Event emitters
   - Error boundaries

---

## 📚 Test Types Explained

### Unit Tests

**Purpose:** Test individual components in complete isolation

**Characteristics:**
- ✅ Fast execution (milliseconds per test)
- ✅ Mock ALL external dependencies
- ✅ Test business logic thoroughly
- ✅ High code coverage possible

**Example:**
```javascript
// Unit test - mocked dependencies
jest.mock('../../../src/database/client.js');

describe('AgentRepository', () => {
  it('should create agent in database', async () => {
    const mockDb = { insert: jest.fn().mockResolvedValue({ id: 1 }) };
    const repo = new AgentRepository(mockDb);

    const result = await repo.createAgent({ name: 'test' });

    expect(result.id).toBe(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});
```

---

### Integration Tests

**Purpose:** Test multiple components working together

**Characteristics:**
- ⚡ Moderate execution time (seconds per test)
- ⚡ Some mocks, some real dependencies
- ⚡ Test component interactions
- ⚡ Validate workflows

**Example:**
```javascript
// Integration test - real components
import { VotingSystem } from '../../src/systems/voting/system.js';
import { RabbitMQClient } from '../../src/core/rabbitmq-client.js';

describe('Voting System Integration', () => {
  let votingSystem;
  let mqClient;

  beforeAll(async () => {
    mqClient = new RabbitMQClient(config);
    await mqClient.connect();
    votingSystem = new VotingSystem(mqClient);
  });

  it('should publish vote to message queue', async () => {
    const session = await votingSystem.createSession('test');
    await votingSystem.castVote(session.id, 'agent-1', 'option-a');

    // Verify message was published to RabbitMQ
  });
});
```

---

### E2E Tests

**Purpose:** Test complete user scenarios end-to-end

**Characteristics:**
- 🐢 Slow execution (minutes per test)
- 🐢 Real services (RabbitMQ, PostgreSQL, Redis)
- 🐢 Full workflow validation
- 🐢 User perspective

**Example:**
```javascript
// E2E test - complete workflow
describe('Collective Decision Making Workflow', () => {
  it('should complete agent registration -> task -> vote -> result', async () => {
    // 1. Register agents
    const agent1 = await orchestrator.registerAgent('worker', 'agent-1');
    const agent2 = await orchestrator.registerAgent('worker', 'agent-2');

    // 2. Create and distribute task
    const task = await orchestrator.createTask('decision-task');

    // 3. Agents vote
    await votingSystem.castVote(task.voteId, 'agent-1', 'approve');
    await votingSystem.castVote(task.voteId, 'agent-2', 'approve');

    // 4. Verify result
    const result = await votingSystem.getResult(task.voteId);
    expect(result.decision).toBe('approve');
    expect(result.consensus).toBe(true);
  });
});
```

---

### Performance Tests (K6)

**Purpose:** Validate system performance under load

**Characteristics:**
- 📊 Load, stress, and soak testing
- 📊 K6 JavaScript DSL
- 📊 Metrics: throughput, latency, errors
- 📊 Run separately from Jest tests

**Example:**
```javascript
// K6 load test
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
};

export default function () {
  const res = http.post('http://localhost:3000/api/tasks', {
    title: 'Load test task',
    priority: 5,
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

---

## ✅ Best Practices

### 1. Test Organization

```javascript
// ✅ GOOD - Clear structure with describe blocks
describe('VotingSystem', () => {
  describe('Session Management', () => {
    it('should create session with valid config', () => {});
    it('should reject session with invalid config', () => {});
  });

  describe('Vote Casting', () => {
    it('should accept valid vote', () => {});
    it('should reject duplicate vote', () => {});
  });
});

// ❌ BAD - Flat structure
it('test1', () => {});
it('test2', () => {});
it('test3', () => {});
```

---

### 2. Test Naming

```javascript
// ✅ GOOD - Descriptive names
it('should reject vote when session is closed', () => {});
it('should calculate consensus using majority rule', () => {});

// ❌ BAD - Vague names
it('test voting', () => {});
it('works', () => {});
```

---

### 3. AAA Pattern (Arrange-Act-Assert)

```javascript
// ✅ GOOD - Clear AAA structure
it('should process task successfully', async () => {
  // Arrange
  const task = createTestTask();
  const agent = createTestAgent();

  // Act
  const result = await orchestrator.processTask(task, agent);

  // Assert
  expect(result.status).toBe('completed');
  expect(result.assignedTo).toBe(agent.id);
});

// ❌ BAD - Mixed logic
it('should work', async () => {
  expect(await orchestrator.processTask(createTestTask(), createTestAgent()).status).toBe('completed');
});
```

---

### 4. Mock Strategy

```javascript
// ✅ GOOD - Mock external dependencies only
jest.mock('../../src/core/rabbitmq-client.js');

const mockMQClient = {
  publish: jest.fn().mockResolvedValue(true),
};

// ❌ BAD - Over-mocking internal logic
jest.mock('../../src/systems/voting/system.js');  // Don't mock what you're testing!
```

---

### 5. Async Testing

```javascript
// ✅ GOOD - Proper async/await
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

// ✅ GOOD - Test rejections properly
it('should reject invalid input', async () => {
  await expect(asyncFunction(invalid))
    .rejects
    .toThrow('Expected error');
});

// ❌ BAD - Missing await
it('should work', () => {
  asyncFunction();  // Test completes before function finishes!
  expect(result).toBe(expected);  // Will likely fail
});
```

---

### 6. Test Data Management

```javascript
// ✅ GOOD - Use factories or fixtures
const createTestAgent = (overrides = {}) => ({
  id: `agent-${Date.now()}`,
  name: 'Test Agent',
  type: 'worker',
  ...overrides,
});

it('should create custom agent', () => {
  const agent = createTestAgent({ type: 'leader' });
  expect(agent.type).toBe('leader');
});

// ❌ BAD - Hardcoded data everywhere
it('test1', () => {
  const agent = { id: '123', name: 'Agent', type: 'worker' };
});
it('test2', () => {
  const agent = { id: '456', name: 'Agent', type: 'worker' };  // Duplicate!
});
```

---

### 7. Cleanup

```javascript
// ✅ GOOD - Clean up after each test
describe('DatabaseTests', () => {
  let dbClient;

  beforeEach(async () => {
    dbClient = await createTestDatabase();
  });

  afterEach(async () => {
    await dbClient.close();
    jest.clearAllMocks();
  });

  it('should insert record', async () => {
    // Test implementation
  });
});

// ❌ BAD - No cleanup (tests interfere with each other)
let sharedState = {};
it('test1', () => {
  sharedState.value = 10;
});
it('test2', () => {
  expect(sharedState.value).toBe(0);  // Fails due to test1!
});
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Tests Timing Out

**Problem:** Tests exceed 30-second timeout

**Solutions:**
```javascript
// Increase timeout for specific test
it('long operation', async () => {
  // Test implementation
}, 60000);  // 60 second timeout

// Or in jest.config.cjs
module.exports = {
  testTimeout: 60000,  // Global timeout
};
```

---

#### 2. Module Not Found Errors

**Problem:** Cannot find module errors during import

**Solutions:**
```javascript
// Check import paths match new structure
// ❌ OLD
import { Orchestrator } from '../../scripts/orchestrator.js';

// ✅ NEW
import { Orchestrator } from '../../src/core/orchestrator.js';

// See MIGRATION.md for complete path mapping
```

---

#### 3. Mock Not Working

**Problem:** Mocks not being applied

**Solutions:**
```javascript
// Ensure mock is defined BEFORE import
jest.mock('../../src/core/rabbitmq-client.js');

const { RabbitMQClient } = await import('../../src/core/rabbitmq-client.js');

// Clear mocks between tests
afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
```

---

#### 4. Flaky Tests

**Problem:** Tests pass/fail randomly

**Root Causes:**
- Timing issues (race conditions)
- Shared state between tests
- External service dependencies
- Non-deterministic test data

**Solutions:**
```javascript
// Use deterministic data
const timestamp = new Date('2025-01-01').getTime();  // Fixed timestamp

// Await all async operations
await Promise.all([operation1(), operation2()]);

// Mock time-dependent functions
jest.useFakeTimers();
jest.setSystemTime(new Date('2025-01-01'));
```

---

#### 5. Coverage Not Increasing

**Problem:** Adding tests but coverage stays low

**Solutions:**
```bash
# Check which lines are uncovered
npm run test:coverage
open coverage/lcov-report/index.html

# Focus on untested branches
npm test -- --coverage --collectCoverageFrom='src/core/orchestrator.js'

# Identify critical paths
# - Error handling paths
# - Edge cases
# - Conditional branches
```

---

## 📖 Related Documentation

### Internal Documentation

- **QUICKSTART.md**: Get started with testing quickly
- **UNIT_TESTS_SUMMARY.md**: Unit test detailed documentation
- **TEST-SUITE-SUMMARY.md**: Integration test summary
- **MIGRATION.md**: Import path migration guide (Week 1 reorganization)
- **tests/performance/README.md**: K6 performance testing guide
- **docs/examples/test-templates/README.md**: Reference test patterns

### External Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [K6 Documentation](https://k6.io/docs/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [JavaScript Testing Guide](https://testingjavascript.com/)

### Project Documentation

- **README.md**: Project overview
- **CONTRIBUTING.md**: Contribution guidelines
- **CHANGELOG.md**: Project history

---

## 📝 Maintenance Notes

### Recent Changes (December 7, 2025)

**Week 2 Phase 3: Test Consolidation**

✅ **Completed:**
- Moved test-logging.js → tests/integration/logging.test.js (Jest format)
- Moved test-starter-files/ → docs/examples/test-templates/ (reference material)
- Organized tests/unit/ into subdirectories (core, systems, database, utils, validation)
- Moved K6 tests from k6-scripts/ → tests/performance/ (8 files)
- Updated jest.config.cjs for new structure
- Created this comprehensive TEST_STRUCTURE_README.md

**Files Reorganized:** 26 test files + 8 K6 files
**New Documentation:** 493 lines (test-templates README) + this file

---

### Future Work

**Week 2 Phase 4: Infrastructure Organization** (Next)
- Docker Compose consolidation
- MCP server infrastructure
- Kubernetes configuration
- Monitoring setup

**Week 3: Documentation & Polish**
- API documentation
- Comprehensive testing
- Performance validation
- Team review

---

*Last Updated: December 7, 2025 (Repository Reorganization - Week 2 Phase 3)*
*Maintained by: Test Engineering Team*
*Version: 2.0.0 (Professional Structure)*
