/**
 * Global Jest Setup
 * Common setup for all test suites
 */

import { jest } from '@jest/globals';

// ==================== GLOBAL TEST CONFIGURATION ====================

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.DEBUG ? 'debug' : 'error';

// ==================== GLOBAL MOCKS ====================

// Mock console methods to reduce noise in tests
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for important messages
    error: console.error,
  };
}

// ==================== GLOBAL HELPERS ====================

// Async test helper
global.asyncTest = (name, fn, timeout) => {
  test(name, async () => {
    try {
      await fn();
    } catch (error) {
      console.error(`Test "${name}" failed:`, error);
      throw error;
    }
  }, timeout);
};

// Wait helper
global.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry helper for flaky operations
global.retry = async (fn, times = 3, delay = 100) => {
  let lastError;
  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < times - 1) {
        await wait(delay);
      }
    }
  }
  throw lastError;
};

// ==================== PERFORMANCE MONITORING ====================

// Track test performance
const testPerformance = new Map();

beforeEach(() => {
  const currentTest = expect.getState().currentTestName;
  testPerformance.set(currentTest, {
    startTime: Date.now(),
    startMemory: process.memoryUsage().heapUsed,
  });
});

afterEach(() => {
  const currentTest = expect.getState().currentTestName;
  const perf = testPerformance.get(currentTest);

  if (perf) {
    const duration = Date.now() - perf.startTime;
    const memoryGrowth = process.memoryUsage().heapUsed - perf.startMemory;

    // Log slow tests
    if (duration > 5000) {
      console.warn(`⚠️ Slow test detected: "${currentTest}" took ${duration}ms`);
    }

    // Log memory-intensive tests
    if (memoryGrowth > 50 * 1024 * 1024) { // 50MB
      console.warn(`⚠️ Memory-intensive test: "${currentTest}" used ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
    }

    testPerformance.delete(currentTest);
  }
});

// ==================== CLEANUP ====================

// Global cleanup after all tests
afterAll(async () => {
  // Clean up any remaining connections
  if (global.__rabbitConnections) {
    for (const conn of global.__rabbitConnections) {
      try {
        await conn.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  // Clear all timers
  jest.clearAllTimers();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// ==================== ERROR HANDLING ====================

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection in test:', reason);
  // Fail the test
  throw reason;
});

// ==================== CUSTOM EXPECTATIONS ====================

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },

  toContainObject(received, expected) {
    const pass = received.some(item =>
      Object.keys(expected).every(key => item[key] === expected[key])
    );
    return {
      pass,
      message: () =>
        pass
          ? `expected array not to contain object matching ${JSON.stringify(expected)}`
          : `expected array to contain object matching ${JSON.stringify(expected)}`,
    };
  },

  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
    };
  },

  async toEventuallyBe(received, expected, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    let lastValue = await received();

    while (Date.now() - startTime < timeout) {
      if (lastValue === expected) {
        return {
          pass: true,
          message: () => `expected value not to eventually be ${expected}`,
        };
      }
      await new Promise(resolve => setTimeout(resolve, interval));
      lastValue = await received();
    }

    return {
      pass: false,
      message: () => `expected value to eventually be ${expected}, but got ${lastValue} after ${timeout}ms`,
    };
  },
});

// ==================== TEST DATA FACTORIES ====================

global.TestFactory = {
  // Create test agent
  createAgent: (overrides = {}) => ({
    id: `test-agent-${Math.random().toString(36).substr(2, 9)}`,
    status: 'active',
    capabilities: ['compute', 'analyze'],
    createdAt: Date.now(),
    ...overrides,
  }),

  // Create test task
  createTask: (overrides = {}) => ({
    id: `test-task-${Math.random().toString(36).substr(2, 9)}`,
    type: 'compute',
    priority: 1,
    payload: {},
    createdAt: Date.now(),
    ...overrides,
  }),

  // Create test message
  createMessage: (overrides = {}) => ({
    id: `test-msg-${Math.random().toString(36).substr(2, 9)}`,
    content: 'Test message',
    timestamp: Date.now(),
    ...overrides,
  }),

  // Create test voting session
  createVotingSession: (overrides = {}) => ({
    id: `test-vote-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Vote',
    options: ['yes', 'no'],
    status: 'active',
    createdAt: Date.now(),
    ...overrides,
  }),
};

// ==================== MOCK UTILITIES ====================

global.MockUtils = {
  // Create mock RabbitMQ connection
  createMockConnection: () => ({
    createChannel: jest.fn().mockResolvedValue({
      assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
      assertExchange: jest.fn().mockResolvedValue(true),
      publish: jest.fn().mockReturnValue(true),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'test-consumer' }),
      close: jest.fn().mockResolvedValue(true),
    }),
    close: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
  }),

  // Create mock logger
  createMockLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => this),
  }),

  // Create mock event emitter
  createMockEventEmitter: () => {
    const events = {};
    return {
      on: jest.fn((event, handler) => {
        if (!events[event]) events[event] = [];
        events[event].push(handler);
      }),
      emit: jest.fn((event, ...args) => {
        if (events[event]) {
          events[event].forEach(handler => handler(...args));
        }
      }),
      once: jest.fn(),
      off: jest.fn(),
      removeListener: jest.fn(),
    };
  },
};

// ==================== ASYNC UTILITIES ====================

global.AsyncUtils = {
  // Wait for condition
  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Timeout wrapper
  withTimeout: (promise, timeout = 5000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      ),
    ]);
  },

  // Parallel execution with limit
  parallel: async (tasks, limit = 5) => {
    const results = [];
    const executing = [];

    for (const task of tasks) {
      const promise = Promise.resolve().then(task);
      results.push(promise);

      if (tasks.length >= limit) {
        executing.push(promise);
        if (executing.length >= limit) {
          await Promise.race(executing);
          executing.splice(executing.findIndex(p => p === promise), 1);
        }
      }
    }

    return Promise.all(results);
  },
};

// ==================== ENVIRONMENT VALIDATION ====================

// Ensure required environment variables for tests
const requiredEnvVars = [
  'NODE_ENV',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️ Missing environment variable: ${envVar}`);
  }
}

// Set default test environment variables
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
process.env.TEST_TIMEOUT = process.env.TEST_TIMEOUT || '30000';

console.log('✅ Global Jest setup completed');