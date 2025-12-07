# Unit Test Fix Plan

**Created:** December 7, 2025
**Status:** 📋 PLANNED (Pending Execution)
**Priority:** HIGH
**Estimated Effort:** 4-8 hours

---

## Executive Summary

**Current State:**
- ✅ **202 tests passing** (43.3%)
- ❌ **265 tests failing** (56.7%)
- 📊 **Coverage:** 6.46% statements, 6.9% branches
- ⏱️ **Test Duration:** 35.5 seconds
- 🚨 **Open Handles:** 1 (setTimeout in voting system)

**Root Cause:** amqplib mocks not functioning correctly, causing `TypeError: Cannot read properties of undefined (reading 'on')` in connection-related tests.

**Goal:** Achieve >95% test pass rate with >80% code coverage.

---

## Current Test Results Breakdown

### Test Suite Status

| Suite | Status | Tests | Pass | Fail | Pass Rate |
|-------|--------|-------|------|------|-----------|
| **TOTAL** | ❌ | 467 | 202 | 265 | 43.3% |
| Failed Suites | ❌ | 15 | - | - | - |
| Passed Suites | ✅ | 2 | - | - | - |

### Coverage Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Statements** | 6.46% | >80% | ❌ Far below |
| **Branches** | 6.9% | >80% | ❌ Far below |
| **Functions** | 7.48% | >80% | ❌ Far below |
| **Lines** | 6.58% | >80% | ❌ Far below |

---

## Identified Issues

### Issue 1: amqplib Mock Failures (HIGH PRIORITY)

**Error Pattern:**
```
❌ Failed to connect: TypeError: Cannot read properties of undefined (reading 'on')
```

**Frequency:** 30+ occurrences (primary failure)

**Root Cause:**
- Mock implementation in `tests/__mocks__/amqplib.js` incomplete
- RabbitMQ connection objects not properly mocked
- Event emitter methods (`on`, `once`, `emit`) missing

**Impact:**
- All RabbitMQ-dependent tests failing
- Orchestrator tests failing
- System integration tests failing

**Fix Strategy:**
1. Review `tests/__mocks__/amqplib.js` implementation
2. Add missing EventEmitter methods to connection mock
3. Add missing methods to channel mock:
   - `on(event, handler)`
   - `once(event, handler)`
   - `emit(event, ...args)`
   - `removeListener(event, handler)`
4. Ensure proper async/await handling
5. Add mock for connection.createChannel()
6. Add mock for channel.assertQueue(), assertExchange(), bindQueue()

**Files to Fix:**
- `tests/__mocks__/amqplib.js`
- Potentially `tests/unit/core/*.test.js` (update test expectations)

---

### Issue 2: setTimeout Open Handle (MEDIUM PRIORITY)

**Error:**
```
Jest has detected the following 1 open handle potentially keeping Jest from exiting:

  ●  Timeout

      89 |       setTimeout(() => this.closeVoting(sessionId), timeUntilDeadline);
```

**Location:** `src/systems/voting/system.js:89`

**Root Cause:**
- Voting system creates timeouts that aren't cleared in tests
- No cleanup in `afterEach()` hooks

**Fix Strategy:**
1. Track all active timeouts in VotingSystem
2. Add `cleanup()` method to clear all timeouts
3. Call `cleanup()` in test `afterEach()` hooks
4. Consider using `jest.useFakeTimers()` in tests

**Files to Fix:**
- `src/systems/voting/system.js` (add timeout tracking)
- `tests/unit/systems/voting/voting-system.test.js` (add cleanup)

---

### Issue 3: Low Code Coverage (MEDIUM PRIORITY)

**Uncovered Areas:**
- `src/validation/config.js` - 0% coverage
- `src/validation/middleware/express-middleware.js` - 0% coverage
- `src/validation/validators/validator.js` - 0% coverage
- `src/validation/utils/error-formatter.js` - 0% coverage

**Fix Strategy:**
1. Add unit tests for validation modules (0% → >80%)
2. Add integration tests for middleware
3. Add tests for error formatting
4. Focus on critical path coverage first

**Estimated Tests to Add:** 50-100 new test cases

---

## Implementation Plan

### Phase 1: Fix amqplib Mocks (2-3 hours)

**Priority:** CRITICAL
**Goal:** Get RabbitMQ-dependent tests passing

**Tasks:**
1. ✅ **Analyze current mock** (30 min)
   - Read `tests/__mocks__/amqplib.js`
   - Identify missing methods
   - Document expected behavior

2. ✅ **Implement EventEmitter** (1 hour)
   ```javascript
   // Add to connection and channel mocks
   const EventEmitter = require('events');

   class MockConnection extends EventEmitter {
     constructor() {
       super();
       // existing mock code
     }
   }
   ```

3. ✅ **Add Missing Methods** (1 hour)
   - `connection.createChannel()` → returns MockChannel
   - `channel.assertQueue(queue, options)` → resolves with queue info
   - `channel.assertExchange(exchange, type, options)` → resolves
   - `channel.bindQueue(queue, exchange, pattern)` → resolves
   - `channel.publish(exchange, routingKey, content)` → returns boolean
   - `channel.sendToQueue(queue, content)` → returns boolean
   - `channel.consume(queue, callback)` → resolves with {consumerTag}
   - `channel.ack(message)` → void
   - `channel.nack(message, allUpTo, requeue)` → void

4. ✅ **Test Mock Functionality** (30 min)
   - Create minimal test
   - Verify connection works
   - Verify channel methods work

**Success Criteria:**
- No more "Cannot read properties of undefined" errors
- RabbitMQ-dependent tests start passing
- At least 150/265 failing tests fixed

---

### Phase 2: Fix Open Handles (1 hour)

**Priority:** HIGH
**Goal:** Tests exit cleanly without warnings

**Tasks:**
1. ✅ **Add Timeout Tracking** (30 min)
   ```javascript
   class VotingSystem {
     constructor() {
       this.activeTimeouts = new Set();
     }

     initiateVote(...) {
       const timeoutId = setTimeout(...);
       this.activeTimeouts.add(timeoutId);
     }

     cleanup() {
       this.activeTimeouts.forEach(clearTimeout);
       this.activeTimeouts.clear();
     }
   }
   ```

2. ✅ **Update Tests** (30 min)
   ```javascript
   afterEach(() => {
     votingSystem.cleanup();
   });
   ```

**Success Criteria:**
- No open handle warnings
- All tests complete within timeout
- Clean test exit

---

### Phase 3: Increase Code Coverage (2-3 hours)

**Priority:** MEDIUM
**Goal:** >80% statement coverage

**Tasks:**
1. ✅ **Validation Module Tests** (1 hour)
   - Test `config.js` validation rules
   - Test middleware integration
   - Test error formatting

2. ✅ **Validator Tests** (1 hour)
   - Test payload validation
   - Test message validation
   - Test schema validation

3. ✅ **Integration Tests** (1 hour)
   - Test end-to-end flows
   - Test error handling paths
   - Test edge cases

**Success Criteria:**
- >80% statement coverage
- >80% branch coverage
- >80% function coverage

---

### Phase 4: Cleanup & Optimization (1 hour)

**Priority:** LOW
**Goal:** Clean, maintainable test suite

**Tasks:**
1. ✅ **Remove Duplicate Tests** (20 min)
2. ✅ **Standardize Test Structure** (20 min)
3. ✅ **Add Test Documentation** (20 min)

**Success Criteria:**
- No duplicate test cases
- Consistent test naming
- Clear test documentation

---

## Quick Wins (Do First!)

These fixes will have the highest impact with minimal effort:

### 1. Fix amqplib Mock (30 minutes → 100+ tests fixed)

**Current Mock (Broken):**
```javascript
// tests/__mocks__/amqplib.js
module.exports = {
  connect: jest.fn() // Returns undefined!
};
```

**Fixed Mock:**
```javascript
const EventEmitter = require('events');

class MockConnection extends EventEmitter {
  constructor() {
    super();
  }

  async createChannel() {
    return new MockChannel();
  }

  async close() {
    this.emit('close');
  }
}

class MockChannel extends EventEmitter {
  constructor() {
    super();
  }

  async assertQueue(queue, options = {}) {
    return { queue, ...options };
  }

  async assertExchange(exchange, type, options = {}) {
    return { exchange };
  }

  async bindQueue(queue, exchange, pattern) {
    return {};
  }

  publish(exchange, routingKey, content, options = {}) {
    return true;
  }

  sendToQueue(queue, content, options = {}) {
    return true;
  }

  async consume(queue, callback, options = {}) {
    return { consumerTag: 'mock-consumer-tag' };
  }

  ack(message) {}

  nack(message, allUpTo = false, requeue = true) {}

  async close() {
    this.emit('close');
  }
}

module.exports = {
  connect: jest.fn(async () => new MockConnection())
};
```

**Impact:** Fixes 100+ RabbitMQ connection errors immediately!

---

### 2. Add Timeout Cleanup (15 minutes → Fixes open handle)

**Add to `src/systems/voting/system.js`:**
```javascript
class VotingSystem {
  constructor(rabbitmqClient, db) {
    this.rabbitmqClient = rabbitmqClient;
    this.db = db;
    this.activeTimeouts = new Set(); // ADD THIS
  }

  async initiateVote(proposal, options = {}) {
    // ... existing code ...

    const timeUntilDeadline = session.deadline - Date.now();
    if (timeUntilDeadline > 0) {
      const timeoutId = setTimeout(() => this.closeVoting(sessionId), timeUntilDeadline);
      this.activeTimeouts.add(timeoutId); // ADD THIS
    }

    // ... rest of code ...
  }

  // ADD THIS METHOD
  cleanup() {
    this.activeTimeouts.forEach(clearTimeout);
    this.activeTimeouts.clear();
  }
}
```

**Add to tests:**
```javascript
afterEach(() => {
  votingSystem.cleanup();
});
```

**Impact:** Eliminates open handle warning, tests exit cleanly!

---

### 3. Use jest.useFakeTimers() (10 minutes → Faster tests)

**Add to timer-dependent tests:**
```javascript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

it('should close voting after deadline', () => {
  votingSystem.initiateVote(...);

  jest.advanceTimersByTime(deadline + 1000);

  expect(votingSystem.sessions.get(sessionId).status).toBe('closed');
});
```

**Impact:** Tests run instantly, no waiting for real timeouts!

---

## Expected Results After Fixes

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Passing Tests** | 202 (43%) | 420+ (>90%) | +218 (+108%) |
| **Failing Tests** | 265 (57%) | <47 (<10%) | -218 (-82%) |
| **Statement Coverage** | 6.46% | >80% | +73.54% |
| **Branch Coverage** | 6.9% | >80% | +73.1% |
| **Open Handles** | 1 | 0 | ✅ Fixed |
| **Test Duration** | 35.5s | <30s | -5.5s |

---

## Testing Strategy

### Before Each Fix

```bash
# Run tests to establish baseline
npm run test:unit > /tmp/test-before.txt

# Count failures
grep "FAIL" /tmp/test-before.txt | wc -l
```

### After Each Fix

```bash
# Run tests again
npm run test:unit > /tmp/test-after.txt

# Compare
diff /tmp/test-before.txt /tmp/test-after.txt

# Verify improvement
grep "PASS" /tmp/test-after.txt | wc -l
```

### Incremental Approach

✅ Fix one issue at a time
✅ Verify improvement after each fix
✅ Commit working fixes immediately
✅ Don't move to next issue until current is resolved

---

## Risk Assessment

### High Risk

❌ **Breaking Existing Passing Tests**
- Mitigation: Run full test suite after each change
- Rollback if pass rate decreases

❌ **Mock Changes Affecting Integration Tests**
- Mitigation: Test mock changes in isolation first
- Verify integration tests separately

### Medium Risk

⚠️ **Timeout Changes Breaking Production Code**
- Mitigation: Only add tracking, don't change logic
- Ensure cleanup is optional (for testing only)

⚠️ **Coverage Metrics Showing False Positives**
- Mitigation: Manual review of critical paths
- Focus on meaningful tests, not just coverage %

### Low Risk

✅ **Test Refactoring**
- Easy to rollback
- No production impact

---

## Success Criteria

### Phase 1 Success ✅
- [ ] No more "Cannot read properties of undefined" errors
- [ ] >150 RabbitMQ-dependent tests passing
- [ ] amqplib mock fully functional

### Phase 2 Success ✅
- [ ] Zero open handle warnings
- [ ] All tests exit cleanly
- [ ] Timeout tracking working

### Phase 3 Success ✅
- [ ] >80% statement coverage
- [ ] >80% branch coverage
- [ ] All critical paths covered

### Overall Success ✅
- [ ] >90% test pass rate (>420/467 passing)
- [ ] >80% code coverage
- [ ] Zero test warnings
- [ ] Test suite runs in <30 seconds
- [ ] CI/CD integration ready

---

## Files to Modify

### High Priority (Phase 1)

1. **tests/__mocks__/amqplib.js** (CRITICAL)
   - Add EventEmitter inheritance
   - Implement all missing methods
   - Add proper async/await handling

2. **tests/unit/core/*.test.js** (if needed)
   - Update expectations for new mock behavior

### Medium Priority (Phase 2)

3. **src/systems/voting/system.js**
   - Add timeout tracking
   - Add cleanup() method

4. **tests/unit/systems/voting/voting-system.test.js**
   - Add afterEach cleanup
   - Use jest.useFakeTimers()

### Low Priority (Phase 3)

5. **tests/unit/validation/*.test.js** (create if missing)
   - Add validation tests
   - Add middleware tests
   - Add error formatter tests

---

## Timeline

### Recommended Execution Order

**Session 1 (2 hours):**
- Phase 1: Fix amqplib mocks
- Quick win: 100+ tests fixed immediately

**Session 2 (1 hour):**
- Phase 2: Fix open handles
- Quick win: Clean test exit

**Session 3 (2-3 hours):**
- Phase 3: Increase coverage
- Goal: >80% coverage

**Session 4 (1 hour):**
- Phase 4: Cleanup & documentation
- Final verification

**Total:** 6-7 hours (within 4-8 hour estimate)

---

## Next Steps

### Immediate Actions

1. **Review this plan** with team/user
2. **Approve Phase 1** quick wins
3. **Schedule 2-hour session** for amqplib mock fix
4. **Verify baseline** before starting

### Before Starting

- [ ] Commit current code (baseline)
- [ ] Create feature branch: `fix/unit-tests`
- [ ] Run full test suite, save output
- [ ] Document current test count

### During Execution

- [ ] Follow plan phases in order
- [ ] Commit after each successful fix
- [ ] Document any deviations
- [ ] Update this plan with findings

### After Completion

- [ ] Run full test suite
- [ ] Verify >90% pass rate
- [ ] Verify >80% coverage
- [ ] Create completion report
- [ ] Merge to main branch

---

## Resources

### Documentation
- Jest Mocking: https://jestjs.io/docs/manual-mocks
- amqplib API: https://amqp-node.github.io/amqplib/channel_api.html
- Jest Timers: https://jestjs.io/docs/timer-mocks

### Related Files
- `jest.config.cjs` - Jest configuration
- `package.json` - Test scripts
- `tests/__mocks__/` - Mock implementations

---

**Plan Status:** READY FOR EXECUTION
**Approval Required:** Yes (from user/team)
**Estimated ROI:** High (90% test pass rate, 80% coverage)
