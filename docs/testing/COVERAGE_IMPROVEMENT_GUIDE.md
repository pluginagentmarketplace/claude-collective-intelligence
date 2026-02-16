# Coverage Improvement Guide: 14% → 80%+ 📈

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run tests with coverage report
npm run test:coverage

# Run specific test suite
npm test tests/unit/orchestrator.test.js

# Run tests in watch mode
npm run test:watch

# Generate HTML coverage report
npm test -- --coverage --coverageReporters=html
open coverage/index.html
```

## Current Coverage Status (14%)

### Covered Modules ✅
- Basic unit tests exist for core modules
- Some integration tests written
- E2E tests partially implemented

### Coverage Gaps ❌
1. **monitor.js** - 0% coverage
2. **peer-rating.js** - 0% coverage
3. Limited error scenario testing
4. Missing edge case coverage
5. No performance benchmarks

## Implementation Priority

### 🔴 Critical (Week 1)
Focus on core modules that are essential for system operation:

#### 1. orchestrator.js Enhancement
```bash
# Use the enhanced boilerplate
cp test-starter-files/orchestrator-enhanced.test.js tests/unit/orchestrator-enhanced.test.js

# Run tests
npm test tests/unit/orchestrator-enhanced.test.js
```

**Key Test Areas:**
- Connection retry logic
- Task priority queue
- Agent failure recovery
- Load balancing
- Circuit breaker implementation

#### 2. rabbitmq-client.js Enhancement
```bash
# Use the enhanced boilerplate
cp test-starter-files/rabbitmq-client-enhanced.test.js tests/unit/rabbitmq-client-enhanced.test.js

# Run tests
npm test tests/unit/rabbitmq-client-enhanced.test.js
```

**Key Test Areas:**
- Connection pooling
- Channel management
- Message acknowledgment
- Error propagation
- Reconnection logic

#### 3. monitor.js (NEW)
```javascript
// Create new test file: tests/unit/monitor.test.js
describe('Monitor', () => {
  describe('Metrics Collection', () => {
    it('should collect system metrics', async () => {
      const monitor = new Monitor();
      const metrics = await monitor.collectMetrics();
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('messageQueue');
    });
  });

  describe('Alert System', () => {
    it('should trigger alerts on threshold breach', async () => {
      const monitor = new Monitor({ cpuThreshold: 80 });
      const alert = await monitor.checkThresholds({ cpu: 85 });
      expect(alert).toBeTruthy();
      expect(alert.type).toBe('cpu-high');
    });
  });
});
```

### 🟡 High Priority (Week 2)

#### 4. Gamification System
```bash
# Copy gamification test templates
cp test-starter-files/achievement-system-enhanced.test.js tests/unit/gamification/

# Create peer-rating tests
cat > tests/unit/gamification/peer-rating.test.js << 'EOF'
describe('PeerRating', () => {
  it('should calculate weighted ratings', async () => {
    const rating = new PeerRating();
    const score = await rating.calculateScore([
      { rating: 5, weight: 2 },
      { rating: 4, weight: 1 },
    ]);
    expect(score).toBeCloseTo(4.67, 2);
  });
});
EOF
```

#### 5. Integration Tests Enhancement
```bash
# Use enhanced integration template
cp test-starter-files/integration-tests-enhanced.test.js tests/integration/

# Run integration tests
npm run test:integration
```

### 🟢 Medium Priority (Week 3)

#### 6. Error Scenarios
Add comprehensive error testing to all modules:

```javascript
// Template for error testing
describe('Error Handling', () => {
  it('should handle network failures', async () => {
    mockClient.simulateError('network');
    await expect(module.operation()).rejects.toThrow('Network error');
  });

  it('should implement retry logic', async () => {
    let attempts = 0;
    mockClient.onCall = () => {
      attempts++;
      if (attempts < 3) throw new Error('Temporary failure');
      return 'success';
    };

    const result = await module.operationWithRetry();
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should handle timeout scenarios', async () => {
    jest.useFakeTimers();
    const promise = module.operationWithTimeout(1000);
    jest.advanceTimersByTime(1500);
    await expect(promise).rejects.toThrow('Timeout');
    jest.useRealTimers();
  });
});
```

### 🔵 Low Priority (Week 4)

#### 7. Performance Tests
```javascript
describe('Performance', () => {
  it('should handle 1000 operations/second', async () => {
    const operations = Array(1000).fill().map(() => module.operation());
    const start = Date.now();
    await Promise.all(operations);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
  });

  it('should maintain memory efficiency', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    for (let i = 0; i < 10000; i++) {
      await module.operation();
    }
    const memoryGrowth = process.memoryUsage().heapUsed - initialMemory;
    expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // < 100MB
  });
});
```

## Mock Strategy Implementation

### Step 1: Use Shared Mock Library
```javascript
// Import reusable mock
import { createMockRabbitMQClient } from '../../__mocks__/rabbitmq-mock.js';

// Use in tests
const mockClient = createMockRabbitMQClient({
  errorScenarios: { publishError: true }
});
```

### Step 2: Mock External Dependencies
```javascript
// Mock all external modules
jest.unstable_mockModule('amqplib', () => ({
  connect: jest.fn().mockResolvedValue(mockConnection)
}));

jest.unstable_mockModule('winston', () => ({
  createLogger: jest.fn().mockReturnValue(mockLogger)
}));
```

### Step 3: Use Test Factories
```javascript
// Create consistent test data
const agent = TestFactory.createAgent({ role: 'worker' });
const task = TestFactory.createTask({ priority: 10 });
const session = TestFactory.createVotingSession({ type: 'weighted' });
```

## Coverage Improvement Checklist

### For Each Module:
- [ ] ✅ Happy path tests (basic functionality)
- [ ] ✅ Error handling tests (all catch blocks)
- [ ] ✅ Edge cases (boundary values, empty inputs)
- [ ] ✅ Async behavior (promises, callbacks)
- [ ] ✅ State management (initialization, cleanup)
- [ ] ✅ Integration points (module interactions)
- [ ] ✅ Performance benchmarks (throughput, latency)
- [ ] ✅ Memory management (no leaks)
- [ ] ✅ Concurrency (race conditions)
- [ ] ✅ Security (input validation, sanitization)

## Running Coverage Reports

### Generate Different Report Formats
```bash
# Text summary in console
npm test -- --coverage --coverageReporters=text

# HTML report (visual)
npm test -- --coverage --coverageReporters=html
open coverage/index.html

# LCOV for CI/CD
npm test -- --coverage --coverageReporters=lcov

# JSON for programmatic access
npm test -- --coverage --coverageReporters=json
```

### Check Specific Module Coverage
```bash
# Test single file with coverage
npm test tests/unit/orchestrator.test.js -- --coverage --collectCoverageFrom=scripts/orchestrator.js

# Test directory with coverage
npm test tests/unit/gamification -- --coverage --collectCoverageFrom=scripts/gamification/**
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test-coverage.yml
name: Test Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm run test:ci

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          fail_ci_if_error: true

      - name: Check coverage thresholds
        run: |
          COVERAGE=$(npm test -- --coverage --silent | grep "All files" | awk '{print $10}' | sed 's/%//')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage is below 80%"
            exit 1
          fi
```

## Progressive Threshold Updates

### Week 1: jest.config.js
```javascript
coverageThreshold: {
  global: {
    branches: 40,
    functions: 40,
    lines: 40,
    statements: 40
  }
}
```

### Week 2: jest.config.js
```javascript
coverageThreshold: {
  global: {
    branches: 60,
    functions: 60,
    lines: 60,
    statements: 60
  }
}
```

### Week 3: jest.config.js
```javascript
coverageThreshold: {
  global: {
    branches: 75,
    functions: 75,
    lines: 75,
    statements: 75
  }
}
```

### Week 4: jest.config.js
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

## Troubleshooting Common Issues

### Issue: Tests Timeout
```javascript
// Increase timeout for specific tests
it('should handle long operations', async () => {
  // Test code
}, 60000); // 60 second timeout
```

### Issue: Async Tests Not Completing
```javascript
// Ensure proper async handling
it('should complete async operation', async () => {
  await expect(asyncOperation()).resolves.toBeDefined();
});
```

### Issue: Memory Leaks
```javascript
// Proper cleanup
afterEach(async () => {
  await client.close();
  await orchestrator.stop();
  jest.clearAllMocks();
});
```

### Issue: Flaky Tests
```javascript
// Use retry mechanism
it('should eventually succeed', async () => {
  await retry(async () => {
    const result = await unstableOperation();
    expect(result).toBeDefined();
  }, 3);
});
```

## Success Metrics

### Target Achievement Timeline
| Week | Coverage | Tests | Duration | Status |
|------|----------|-------|----------|--------|
| 0 | 14% | 50 | 2min | 🔴 Current |
| 1 | 40% | 150 | 3min | 🟡 Target |
| 2 | 60% | 250 | 4min | 🟡 Target |
| 3 | 75% | 350 | 4.5min | 🟡 Target |
| 4 | 85% | 450 | 5min | 🟢 Goal |

### Quality Indicators
- ✅ All critical paths tested
- ✅ Error scenarios covered
- ✅ Performance benchmarks established
- ✅ No flaky tests
- ✅ Documentation complete
- ✅ CI/CD integrated
- ✅ Coverage badges displayed

## Next Steps

1. **Immediate Actions:**
   - Run `npm run test:coverage` to see current state
   - Copy boilerplate files to test directories
   - Start with highest-impact modules

2. **Daily Goals:**
   - Add 10-15 new test cases
   - Increase coverage by 5-10%
   - Fix any failing tests

3. **Weekly Reviews:**
   - Update coverage thresholds
   - Review and refactor tests
   - Document learnings

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Coverage Reports](./coverage/index.html)
- [Test Roadmap](./TEST_COVERAGE_ROADMAP.md)
- [Boilerplate Tests](./test-starter-files/)

---

*Remember: Quality over quantity. Write meaningful tests that catch real bugs, not just increase numbers.*