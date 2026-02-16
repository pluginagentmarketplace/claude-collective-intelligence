# Test Template Reference Library 📚

**Location**: `docs/examples/test-templates/`
**Status**: Reference Material (Not Active Tests)
**Purpose**: Learning, Patterns, Historical Reference

---

## ⚠️ IMPORTANT: These Are NOT Active Tests

**What This Directory Contains:**
- **Reference templates** for test development
- **Historical examples** of comprehensive test patterns
- **Learning material** for testing best practices
- **Pattern library** for common testing scenarios

**What This Directory Is NOT:**
- ❌ NOT part of the active test suite
- ❌ NOT executed by `npm test`
- ❌ NOT maintained or updated regularly
- ❌ NOT meant to be copied directly

---

## 🎯 Purpose & Usage

### Why These Files Are Here

During repository reorganization (December 2025), these comprehensive test boilerplates were moved from `test-starter-files/` to `docs/examples/test-templates/` to:

1. **Preserve Knowledge**: Maintain comprehensive testing patterns developed during initial test strategy
2. **Reference Material**: Provide examples of well-structured tests for learning
3. **Pattern Library**: Document common testing patterns (AAA, mocking, integration)
4. **Historical Context**: Keep early testing approaches for comparison

### How to Use These Templates

**❌ DON'T:**
- Copy these files directly to your tests/ directory
- Run these as part of your test suite
- Expect them to work without modification
- Use outdated import paths shown in examples

**✅ DO:**
- Read them to understand testing patterns
- Extract specific patterns or approaches
- Learn from the structure and organization
- Use as inspiration for new tests

---

## 📁 Template Files Included

### 1. orchestrator-enhanced.test.js
**Coverage Target: 90%+**

**Key Patterns Demonstrated:**
- Core orchestrator functionality testing
- Connection management with retry logic
- Task distribution and load balancing strategies
- Multi-agent coordination testing
- Comprehensive error handling scenarios
- Performance benchmarking approaches
- Stress testing methodologies

**Learning Focus:** Integration testing, async patterns, mock isolation

---

### 2. rabbitmq-client-enhanced.test.js
**Coverage Target: 90%+**

**Key Patterns Demonstrated:**
- Connection pooling and resilience testing
- Queue and exchange management patterns
- Message publishing with confirmations
- Consumer patterns and acknowledgment strategies
- Circuit breaker implementation testing
- Performance optimization validation
- Integration patterns (Request-Reply, Pub-Sub, Work Queue)

**Learning Focus:** Messaging patterns, resilience testing, integration testing

---

### 3. voting-system-enhanced.test.js
**Coverage Target: 85%+**

**Key Patterns Demonstrated:**
- Session lifecycle management testing
- Multiple voting algorithms (simple, weighted, ranked choice)
- Consensus algorithms (majority, supermajority, IRV, Condorcet)
- Vote delegation and chain validation
- Timeout and scheduling edge cases
- Security and integrity checks
- Analytics and reporting validation

**Learning Focus:** Algorithm testing, edge cases, state machine testing

---

### 4. achievement-system-enhanced.test.js
**Coverage Target: 80%+**

**Key Patterns Demonstrated:**
- Achievement tracking and unlocking logic
- Multi-tier rewards system validation
- Badges, titles, and special ability testing
- Milestone progression tracking
- Daily/weekly challenge scheduling
- Special event handling patterns
- Leaderboard integration testing
- Statistics aggregation and analytics

**Learning Focus:** Gamification logic, time-based testing, data aggregation

---

### 5. integration-tests-enhanced.test.js
**Coverage Target: Cross-module**

**Key Patterns Demonstrated:**
- Multi-agent task distribution workflows
- Voting and consensus integration scenarios
- Collaborative brainstorming patterns
- Gamification system integration
- Failure recovery and resilience workflows
- Performance under load testing
- Complete end-to-end workflow validation

**Learning Focus:** E2E testing, workflow testing, system integration

---

## 🧪 Testing Patterns Reference

### Pattern 1: AAA (Arrange-Act-Assert)

```javascript
it('should follow AAA pattern', async () => {
  // ✅ Arrange - Set up test conditions
  const input = createTestData();
  const expectedOutput = calculateExpected(input);

  // ✅ Act - Execute the operation
  const result = await performAction(input);

  // ✅ Assert - Verify the outcome
  expect(result).toEqual(expectedOutput);
});
```

**When to Use:**
- Unit tests with clear input/output
- Tests requiring explicit setup
- Tests with complex assertions

---

### Pattern 2: Mock Isolation

```javascript
// ✅ Complete mock isolation for unit testing
jest.unstable_mockModule('../../src/core/module.js', () => ({
  Module: jest.fn(() => mockImplementation),
}));

const module = await import('../../src/core/module.js');
```

**When to Use:**
- Unit tests requiring dependency isolation
- Testing error handling paths
- Performance-critical test suites

**⚠️ NOTE:** Import paths in these examples are OUTDATED. See MIGRATION.md for current paths.

---

### Pattern 3: Integration Testing

```javascript
// ✅ Real component interaction testing
describe('Integration: System Components', () => {
  let realSystem;

  beforeAll(async () => {
    realSystem = new System();
    await realSystem.initialize();
  });

  afterAll(async () => {
    await realSystem.shutdown();
  });

  it('should interact with real components', async () => {
    // Test actual integration points
  });
});
```

**When to Use:**
- Testing component interactions
- Validating workflow integration
- End-to-end feature testing

---

### Pattern 4: Performance Testing

```javascript
// ✅ Measure and assert performance metrics
it('should complete operation within performance budget', async () => {
  const startTime = Date.now();
  await performOperation();
  const duration = Date.now() - startTime;

  expect(duration).toBeLessThan(THRESHOLD_MS);
});
```

**When to Use:**
- Performance-critical operations
- Regression testing for performance
- Validating optimization efforts

---

## 📊 Historical Coverage Targets

These were the **original coverage goals** when these templates were created:

| Module | Week 1 | Week 2 | Week 3 | Week 4 |
|--------|--------|--------|--------|--------|
| orchestrator.js | 40% | 60% | 75% | 90% |
| rabbitmq-client.js | 40% | 60% | 75% | 90% |
| voting-system.js | 35% | 55% | 70% | 85% |
| achievement-system.js | 30% | 50% | 65% | 80% |

**Current Coverage:** See `tests/README.md` for actual test coverage metrics.

---

## 🛠️ Test Development Best Practices (from Templates)

### 1. Test Organization
- ✅ Group related tests in describe blocks
- ✅ Use clear, descriptive test names
- ✅ Follow consistent naming conventions
- ✅ Separate unit, integration, and E2E tests

### 2. Mock Strategy
- ✅ Mock external dependencies only
- ✅ Use factory patterns for test data
- ✅ Implement mock utilities for reusability
- ✅ Clean up mocks between tests

### 3. Assertion Guidelines
- ✅ Test both success and failure cases
- ✅ Verify edge cases and boundaries
- ✅ Check error messages and types
- ✅ Validate async behavior properly

### 4. Performance Considerations
- ✅ Use `beforeAll` for expensive setup
- ✅ Clean up in `afterEach` to prevent leaks
- ✅ Run tests in parallel when possible
- ✅ Monitor test execution time

---

## 🔧 Utility Patterns Reference

### Async Test Wrapper
```javascript
function asyncTest(name, testFn) {
  return test(name, async () => {
    try {
      await testFn();
    } catch (error) {
      // Enhanced error reporting
      throw error;
    }
  });
}
```

### Retry Helper for Flaky Operations
```javascript
async function retry(fn, times = 3, delay = 100) {
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === times - 1) throw error;
      await wait(delay);
    }
  }
}
```

### Test Data Factory Pattern
```javascript
class TestFactory {
  static createAgent(overrides = {}) {
    return {
      id: `agent-${Date.now()}`,
      name: 'Test Agent',
      type: 'worker',
      ...overrides
    };
  }

  static createTask(overrides = {}) {
    return {
      id: `task-${Date.now()}`,
      priority: 5,
      description: 'Test task',
      ...overrides
    };
  }
}
```

---

## 📚 Learning Resources

### Official Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [JavaScript Testing Guide](https://testingjavascript.com/)

### Internal Documentation
- **Active Tests**: See `/tests/README.md`
- **Migration Guide**: See `/MIGRATION.md` for updated import paths
- **Test Quickstart**: See `/tests/QUICKSTART.md`

### Key Concepts
1. **Unit Testing**: Isolate and test individual functions/modules
2. **Integration Testing**: Test component interactions
3. **E2E Testing**: Test complete user workflows
4. **Performance Testing**: Validate speed and resource usage
5. **Mocking**: Isolate dependencies for focused testing

---

## ⚙️ Adapting Patterns to Current Structure

### Updating Import Paths

**❌ OLD (shown in templates):**
```javascript
import { Orchestrator } from '../../scripts/orchestrator.js';
import { RabbitMQClient } from '../../scripts/rabbitmq-client.js';
```

**✅ NEW (current structure):**
```javascript
import { Orchestrator } from '../../src/core/orchestrator.js';
import { RabbitMQClient } from '../../src/core/rabbitmq-client.js';
```

**📖 See**: `MIGRATION.md` for complete path mapping

---

### Updating Test Locations

**OLD Structure:**
```
test-starter-files/
├── orchestrator-enhanced.test.js
└── rabbitmq-client-enhanced.test.js
```

**NEW Structure (current):**
```
tests/
├── unit/
│   ├── core/
│   │   ├── orchestrator.test.js
│   │   └── rabbitmq-client.test.js
│   └── systems/
├── integration/
└── e2e/
```

**📖 See**: `tests/README.md` for current test organization

---

## 🎯 When to Reference These Templates

### Good Use Cases ✅

1. **Learning Jest Patterns**
   - Study how describe/it blocks are organized
   - Understand beforeAll/afterAll usage
   - Learn async/await testing patterns

2. **Understanding Mock Strategies**
   - See how to mock RabbitMQ connections
   - Learn module mocking with Jest
   - Study spy and stub patterns

3. **Exploring Test Coverage Approaches**
   - Understand comprehensive coverage strategies
   - Learn edge case identification
   - Study error path testing

4. **Researching Integration Patterns**
   - See multi-component testing approaches
   - Learn workflow testing strategies
   - Study E2E test organization

### Bad Use Cases ❌

1. **Copying Files Directly**
   - Import paths are outdated
   - May not match current architecture
   - Not part of active test suite

2. **Expecting Tests to Run**
   - Not integrated with test runner
   - Dependencies may have changed
   - Mock implementations may be stale

3. **Using as Production Tests**
   - These are boilerplates, not final tests
   - Need customization for actual use
   - May not reflect current requirements

---

## 📝 Historical Context

### Original Purpose (November 2024)
These files were created as **comprehensive boilerplates** to accelerate test development and achieve 80%+ coverage quickly.

### Evolution (December 2025)
During repository reorganization (Week 1 Phase 3), these files were:
- Moved from `/test-starter-files/` to `/docs/examples/test-templates/`
- Reclassified from "active boilerplates" to "reference material"
- Preserved for educational and historical value
- Maintained as pattern library for testing best practices

### Current Status
- **Active Tests**: Located in `/tests/` directory
- **Reference Material**: This directory (`/docs/examples/test-templates/`)
- **Documentation**: See `/tests/README.md` for current testing strategy

---

## 🤝 Contributing to Test Documentation

If you develop new testing patterns worth documenting:

1. **Create Minimal Example**: Extract the core pattern
2. **Document Pattern**: Explain when/why to use it
3. **Add to Active Tests**: Include in `/tests/` if reusable
4. **Update Documentation**: Add to `/tests/README.md`

---

## 📌 Quick Reference Card

| Question | Answer |
|----------|--------|
| **Are these active tests?** | ❌ No, reference material only |
| **Should I run these?** | ❌ No, use tests/ directory |
| **Can I copy them?** | ⚠️ Not directly, adapt patterns only |
| **Are import paths current?** | ❌ No, see MIGRATION.md for updates |
| **Where are active tests?** | ✅ `/tests/` directory |
| **Should I update these?** | ❌ No, they're historical reference |
| **Can I learn from them?** | ✅ Yes, that's their purpose! |

---

## 📖 Related Documentation

- **Active Test Suite**: `/tests/README.md`
- **Test Quickstart**: `/tests/QUICKSTART.md`
- **Migration Guide**: `/MIGRATION.md`
- **Repository Structure**: `/README.md`
- **Contribution Guide**: `/CONTRIBUTING.md`

---

*Moved to docs/examples/: December 7, 2025*
*Original Creation: November 2024*
*Status: Reference Material (Preserved)*
*Last Updated: December 7, 2025 (Repository Reorganization - Week 1 Phase 3)*
