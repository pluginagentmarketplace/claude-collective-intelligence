# Starter Test Suite Guide

## Overview

Bu rehber, yeni oluşturulan starter test files ve test infrastructure'ı kullanmaya yönelik kapsamlı bir kılavuzdur.

---

## 📁 Dosya Yapısı

### Core Module Tests
```
tests/core/
├── orchestrator.test.js          # Agent orchestration tests
└── rabbitmq-client.test.js       # RabbitMQ client tests
```

### Domain-Specific Tests
```
tests/voting/
└── voting-system.test.js         # Voting & consensus mechanism tests

tests/gamification/
├── achievement-system.test.js    # Existing achievement tests
└── achievement-system-starter.test.js  # Starter suite with examples

tests/integration/
├── multi-agent.test.js           # Existing multi-agent tests
└── multi-agent-starter.test.js   # Starter suite with examples
```

### Test Helpers & Mocks
```
tests/helpers/
├── test-mocks.js                 # Centralized mock factories
├── rabbitmq-helpers.js           # RabbitMQ specific helpers
├── agent-helpers.js              # Agent-related helpers
├── message-factories.js           # Message factory patterns
└── assertion-helpers.js           # Custom assertions
```

---

## 🚀 Quick Start

### 1. Run Individual Test Files

```bash
# Test core orchestrator
npm run test:unit -- tests/core/orchestrator.test.js

# Test RabbitMQ client
npm run test:unit -- tests/core/rabbitmq-client.test.js

# Test voting system
npm run test:unit -- tests/voting/voting-system.test.js

# Test gamification
npm run test:unit -- tests/gamification/achievement-system-starter.test.js

# Test multi-agent integration
npm run test:unit -- tests/integration/multi-agent-starter.test.js
```

### 2. Run All Tests with Coverage

```bash
# Unit tests with coverage
npm run test:unit -- --coverage

# Generate HTML coverage report
npm run test:coverage

# View coverage by module
npm run test:unit -- tests/core/ --coverage
```

### 3. Debug Specific Tests

```bash
# Debug orchestrator tests
npm run test:debug -- tests/core/orchestrator.test.js

# Debug with inspector
node --inspect-brk node_modules/.bin/jest tests/core/orchestrator.test.js
```

---

## 📊 Test Suites Overview

### Test Suite 1: Core Modules

#### tests/core/orchestrator.test.js
**8 Test Suites, 25+ Tests**

```javascript
1. Initialization & Setup
   ✓ Initialize with default worker type
   ✓ Initialize with custom agent type
   ✓ Initialize stats tracking
   ✓ Initialize data structures

2. Connection Management
   ✓ Establish RabbitMQ connection
   ✓ Handle connection failures
   ✓ Cleanup resources on shutdown

3. Task Handling
   ✓ Execute tasks successfully
   ✓ Track active tasks
   ✓ Handle task timeouts
   ✓ Handle concurrent tasks

4. Agent Collaboration
   ✓ Start brainstorm sessions
   ✓ Track participation
   ✓ Collect ideas

5. Error Handling & Recovery
   ✓ Handle invalid tasks
   ✓ Track failed tasks
   ✓ Implement retry mechanism

6. Performance & Scaling
   ✓ Handle high volume without leaks
   ✓ Maintain performance under load
   ✓ Cleanup completed tasks
```

#### tests/core/rabbitmq-client.test.js
**8 Test Suites, 35+ Tests**

```javascript
1. Configuration & Initialization
   ✓ Default configuration
   ✓ Custom configuration
   ✓ Data structure initialization

2. Connection Management
   ✓ Successful connection
   ✓ Connection timeout
   ✓ Connection refused
   ✓ Graceful close

3. Queue Management
   ✓ Create queue
   ✓ Durable queues
   ✓ Message TTL
   ✓ Prefetch count

4. Exchange Management
   ✓ Topic exchange
   ✓ Direct exchange
   ✓ Fanout exchange
   ✓ Queue binding

5. Message Publishing
   ✓ Publish to queue
   ✓ Publish with persistence
   ✓ Publish to exchange
   ✓ Serialize complex objects
   ✓ Large message handling

6. Message Consumption
   ✓ Consume messages
   ✓ Message acknowledgment
   ✓ Message rejection (nack)
   ✓ Concurrent consumers

7. Error Handling & Recovery
   ✓ Handle processing errors
   ✓ Retry logic
   ✓ Channel closure

8. Performance & Limits
   ✓ Backpressure handling
   ✓ Rapid publishing
   ✓ Memory efficiency
```

### Test Suite 2: Voting System

#### tests/voting/voting-system.test.js
**8 Test Suites, 35+ Tests**

```javascript
1. Voter Registration
   ✓ Register voter
   ✓ Custom voter weight
   ✓ Multiple voters
   ✓ Duplicate registration handling

2. Session Management
   ✓ Start voting session
   ✓ Session metadata
   ✓ Close session
   ✓ Prevent operations on closed session

3. Vote Casting
   ✓ Cast vote successfully
   ✓ Custom weight voting
   ✓ Multiple votes
   ✓ Reject invalid sessions
   ✓ Change vote

4. Result Calculation
   ✓ Calculate results correctly
   ✓ Weighted results
   ✓ Calculate percentages
   ✓ Zero votes handling

5. Winner Determination & Tie-Breaking
   ✓ Determine clear winner
   ✓ Detect ties
   ✓ Three-way ties
   ✓ Weighted tie-breaking

6. Concurrent Voting
   ✓ Concurrent votes
   ✓ Rapid-fire voting

7. Vote History & Audit
   ✓ Maintain vote history
   ✓ Track timestamps

8. Error Handling
   ✓ Empty sessions
   ✓ Single vote results
   ✓ Reset sessions
```

### Test Suite 3: Gamification

#### tests/gamification/achievement-system-starter.test.js
**7 Test Suites, 40+ Tests**

```javascript
1. Achievement Creation & Registration
   ✓ Create achievement
   ✓ Default values
   ✓ Multiple achievements
   ✓ Retrieve by ID

2. Achievement Unlock Conditions
   ✓ Unlock achievement
   ✓ Prevent duplicate unlocks
   ✓ Award points
   ✓ Track unlock timestamp
   ✓ Handle invalid agents

3. Progress Tracking
   ✓ Track progress
   ✓ Auto-unlock on target
   ✓ Prevent early unlock

4. Points & Rewards
   ✓ Accumulate points
   ✓ Award bonuses
   ✓ Track history
   ✓ Detect milestones

5. Agent Achievement Management
   ✓ Get unlocked achievements
   ✓ Empty achievement list
   ✓ Get statistics

6. Achievement Tiers & Categories
   ✓ Organize by tier
   ✓ Categorize achievements

7. Error Handling & Edge Cases
   ✓ Zero-point achievements
   ✓ Large point values
   ✓ Many achievements
```

### Test Suite 4: Multi-Agent Integration

#### tests/integration/multi-agent-starter.test.js
**8 Test Suites, 40+ Tests**

```javascript
1. Agent Registration & Discovery
   ✓ Register agents
   ✓ Track capabilities
   ✓ Query agent status
   ✓ Get all agent statuses

2. Task Distribution
   ✓ Distribute single task
   ✓ Distribute multiple tasks
   ✓ Track completed tasks
   ✓ Load balancing
   ✓ Handle task failure

3. Brainstorming
   ✓ Start brainstorm session
   ✓ Collect ideas
   ✓ Track session state
   ✓ Variable participant counts

4. Voting & Consensus
   ✓ Start voting session
   ✓ Track votes
   ✓ Calculate results
   ✓ Determine consensus

5. Performance & Scaling
   ✓ Concurrent task execution
   ✓ Scale to many agents
   ✓ Track metrics

6. Agent Health & Monitoring
   ✓ Monitor health
   ✓ Detect unhealthy agents
   ✓ Update heartbeats

7. Error Handling & Recovery
   ✓ Handle no available agents
   ✓ Recover from failures
   ✓ Maintain consistency

8. End-to-End Scenarios
   ✓ Complete collaboration workflow
   ✓ Complex multi-phase operations
```

---

## 🧪 Mock & Stub Usage

### RabbitMQ Mock

```javascript
import { RabbitMQMock } from '../helpers/test-mocks.js';

describe('RabbitMQ Tests', () => {
  let mqMock;

  beforeEach(() => {
    mqMock = new RabbitMQMock();
  });

  test('should publish message', async () => {
    const result = await mqMock.publish('exchange', 'key', { data: 'test' });
    expect(result.success).toBe(true);
  });

  test('should simulate network failure', async () => {
    mqMock.simulateNetworkFailure();
    await expect(mqMock.connect()).rejects.toThrow('Connection failed');
  });
});
```

### State Mock

```javascript
import { StateMock } from '../helpers/test-mocks.js';

describe('State Management', () => {
  let state;

  beforeEach(() => {
    state = new StateMock();
  });

  test('should set and get value', async () => {
    await state.set('key', 'value');
    const value = await state.get('key');
    expect(value).toBe('value');
  });

  test('should handle transactions', async () => {
    await state.transaction(async (s) => {
      await s.set('key1', 'value1');
      await s.set('key2', 'value2');
    });
    expect(await state.get('key1')).toBe('value1');
  });
});
```

### Test Factories

```javascript
import { factories } from '../helpers/test-mocks.js';

describe('Using Factories', () => {
  test('should create task', () => {
    const task = factories.task({ type: 'compute' });
    expect(task.id).toBeDefined();
    expect(task.type).toBe('compute');
  });

  test('should create agent', () => {
    const agent = factories.agent({ type: 'specialist' });
    expect(agent.id).toBeDefined();
    expect(agent.type).toBe('specialist');
  });

  test('should create vote', () => {
    const vote = factories.vote({ choice: 'option-b', weight: 2 });
    expect(vote.choice).toBe('option-b');
    expect(vote.weight).toBe(2);
  });
});
```

### Assertion Helpers

```javascript
import { assertionHelpers } from '../helpers/test-mocks.js';

test('should validate schema', () => {
  const obj = { id: 'test-123', name: 'Test', count: 42 };
  const schema = { id: 'string', name: 'string', count: 'number' };

  expect(assertionHelpers.matchesSchema(obj, schema)).toBe(true);
});

test('should check value range', () => {
  expect(assertionHelpers.isInRange(50, 0, 100)).toBe(true);
  expect(assertionHelpers.isInRange(150, 0, 100)).toBe(false);
});
```

---

## 📈 Coverage Goals

### Week 1 Target: 40%
```
- Core Modules (orchestrator, rabbitmq-client): 45%+
- Foundation for gamification and voting: 30%+
- Basic error handling coverage
```

**Files to Focus On:**
- tests/core/orchestrator.test.js
- tests/core/rabbitmq-client.test.js

### Week 2 Target: 60%
```
- Gamification systems: 60%+
- Voting system: 55%+
- Integration tests: 40%+
```

**Files to Focus On:**
- tests/voting/voting-system.test.js
- tests/gamification/achievement-system-starter.test.js

### Week 3 Target: 75%
```
- Error scenarios: 70%+
- Edge cases: 75%+
- Performance tests: 65%+
```

**New Tests to Add:**
- Error handling edge cases
- Boundary condition tests
- Stress tests

### Week 4 Target: 85%
```
- Integration tests: 80%+
- End-to-end scenarios: 85%+
- Overall coverage: 85%+
```

**Files to Focus On:**
- tests/integration/multi-agent-starter.test.js
- Complete integration scenarios

---

## 🔧 Best Practices

### 1. Test Organization

```javascript
describe('Feature Area', () => {
  describe('Specific Behavior', () => {
    test('should do something', () => {
      // Arrange
      const input = ...;

      // Act
      const result = ...;

      // Assert
      expect(result).toBe(...);
    });
  });
});
```

### 2. Mock Usage

```javascript
// Good: Clear mock setup
const mock = new RabbitMQMock();
mock.simulateNetworkFailure();

// Good: Specific error scenario
mockClient.publish.mockRejectedValue(new Error('Network error'));

// Avoid: Overly complex mocks
// Keep mocks simple and focused
```

### 3. Cleanup

```javascript
afterEach(() => {
  jest.clearAllMocks();
  mqMock?.reset();
  agentMock?.reset();
});
```

### 4. Test Naming

```javascript
// Good: Describes behavior
test('should unlock achievement when target is reached', () => {});

// Good: Describes failure scenario
test('should throw error when agent not found', () => {});

// Avoid: Unclear or vague names
test('test achievement', () => {});
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Tests Timing Out

**Solution:**
```javascript
// Increase timeout for slow tests
jest.setTimeout(15000);

// Or increase specific test
test('slow operation', async () => {
  // ...
}, 20000);
```

### Issue 2: Flaky Tests

**Solution:**
```javascript
// Use deterministic delays
await new Promise(resolve => setTimeout(resolve, 100));

// Avoid: Random waits
// await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

// Use fixed test data
const testData = { id: 'test-123', value: 42 };
```

### Issue 3: Mock Not Resetting

**Solution:**
```javascript
beforeEach(() => {
  jest.clearAllMocks();
  mqMock = new RabbitMQMock(); // Create fresh instance
});
```

---

## 📝 Adding New Tests

### Step 1: Create Test File

```javascript
// tests/myfeature/my-feature.test.js
import { jest } from '@jest/globals';
import { factories, RabbitMQMock } from '../helpers/test-mocks.js';

describe('My Feature', () => {
  let myFeature;

  beforeEach(() => {
    myFeature = new MyFeature();
  });

  test('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Step 2: Add Test Cases

```javascript
describe('Feature Behavior', () => {
  test('happy path', () => {
    // Arrange
    const input = factories.task();

    // Act
    const result = myFeature.process(input);

    // Assert
    expect(result).toBeDefined();
  });

  test('error handling', () => {
    expect(() => {
      myFeature.process(null);
    }).toThrow();
  });
});
```

### Step 3: Run and Verify

```bash
npm run test:unit -- tests/myfeature/my-feature.test.js
npm run test:unit -- tests/myfeature/my-feature.test.js --coverage
```

---

## 📚 References

- **Jest Documentation:** https://jestjs.io/
- **Testing Best Practices:** https://jestjs.io/docs/getting-started
- **Mock Functions:** https://jestjs.io/docs/jest-object
- **Coverage Reports:** https://jestjs.io/docs/coverage

---

## ✅ Checklist

### Before Committing Tests

- [ ] All tests pass locally
- [ ] Coverage meets targets for the module
- [ ] No hardcoded values (use factories)
- [ ] Proper setup and teardown
- [ ] Descriptive test names
- [ ] Comments for complex logic
- [ ] Mocks are properly reset
- [ ] No console.log() statements left

---

## 🎯 Next Steps

1. **Week 1:** Focus on core modules
   - Enhance orchestrator.test.js
   - Enhance rabbitmq-client.test.js

2. **Week 2:** Expand gamification coverage
   - Complete achievement-system tests
   - Add voting system tests

3. **Week 3:** Add error scenarios
   - Error handling tests
   - Edge case coverage
   - Stress tests

4. **Week 4:** Integration & Polish
   - Complete integration tests
   - End-to-end scenarios
   - Performance benchmarks

---

*Last Updated: November 2024*
*Maintained by: Test Engineering Team*
