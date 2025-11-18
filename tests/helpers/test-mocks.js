/**
 * Centralized Mock & Stub Library for Testing
 *
 * This module provides reusable mock factories and test utilities
 * for common components used throughout the test suite.
 */

// ============================================================================
// RabbitMQ Mock Factory
// ============================================================================

export class RabbitMQMock {
  constructor(options = {}) {
    this.options = options;
    this.messageQueue = [];
    this.channels = new Map();
    this.errorScenarios = options.errorScenarios || {};
    this.connected = false;
  }

  async connect() {
    if (this.errorScenarios.connectionFail) {
      throw new Error('Connection failed');
    }
    this.connected = true;
    return { connection: true };
  }

  async publish(exchange, routingKey, message, options = {}) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const msg = {
      exchange,
      routingKey,
      message,
      timestamp: Date.now(),
      options,
    };
    this.messageQueue.push(msg);
    return { success: true, messageId: msg.timestamp };
  }

  async consume(queue, handler) {
    if (this.errorScenarios.consumeFail) {
      throw new Error('Consume failed');
    }
    this.consumerHandler = handler;
    return { consumerTag: 'mock-consumer' };
  }

  simulateIncomingMessage(message) {
    if (this.consumerHandler) {
      this.consumerHandler(message);
    }
  }

  getMessageHistory() {
    return [...this.messageQueue];
  }

  simulateNetworkFailure() {
    this.errorScenarios.connectionFail = true;
    this.connected = false;
  }

  reset() {
    this.messageQueue = [];
    this.channels.clear();
    this.errorScenarios = {};
    this.connected = false;
  }

  async close() {
    this.connected = false;
  }
}

// ============================================================================
// State Management Mock
// ============================================================================

export class StateMock {
  constructor() {
    this.store = new Map();
    this.transactions = [];
    this.listeners = [];
  }

  async get(key) {
    return this.store.get(key);
  }

  async set(key, value) {
    this.store.set(key, value);
    this.notifyListeners({ key, value, type: 'set' });
  }

  async delete(key) {
    const existed = this.store.has(key);
    this.store.delete(key);
    if (existed) {
      this.notifyListeners({ key, type: 'delete' });
    }
    return existed;
  }

  async transaction(fn) {
    const snapshot = new Map(this.store);
    try {
      const result = await fn(this);
      this.transactions.push({ timestamp: Date.now(), status: 'success', result });
      return result;
    } catch (error) {
      this.store = snapshot;
      this.transactions.push({ timestamp: Date.now(), status: 'failed', error: error.message });
      throw error;
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(event) {
    this.listeners.forEach(l => {
      try {
        l(event);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  reset() {
    this.store.clear();
    this.transactions = [];
  }

  snapshot() {
    return new Map(this.store);
  }

  getTransactionLog() {
    return [...this.transactions];
  }

  getSize() {
    return this.store.size;
  }
}

// ============================================================================
// Agent Mock Factory
// ============================================================================

export class AgentMock {
  constructor(id = 'test-agent', type = 'worker') {
    this.id = id;
    this.type = type;
    this.status = 'active';
    this.tasks = new Map();
    this.results = new Map();
    this.capabilities = ['process', 'analyze'];
  }

  async executeTask(taskId, payload) {
    this.tasks.set(taskId, { status: 'running', payload, startTime: Date.now() });

    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 50));

    const result = { success: true, data: { processed: payload } };
    this.results.set(taskId, result);
    this.tasks.set(taskId, {
      status: 'completed',
      payload,
      endTime: Date.now(),
    });

    return result;
  }

  async failTask(taskId, error) {
    this.results.set(taskId, { success: false, error });
    this.tasks.set(taskId, { status: 'failed', error });
  }

  getTaskStatus(taskId) {
    return this.tasks.get(taskId) || null;
  }

  getResult(taskId) {
    return this.results.get(taskId) || null;
  }

  getCompletedCount() {
    return Array.from(this.tasks.values()).filter(t => t.status === 'completed').length;
  }

  getFailedCount() {
    return Array.from(this.tasks.values()).filter(t => t.status === 'failed').length;
  }

  reset() {
    this.tasks.clear();
    this.results.clear();
  }
}

// ============================================================================
// Test Data Factories
// ============================================================================

export const factories = {
  task: (overrides = {}) => ({
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'default',
    priority: 1,
    payload: { data: 'test' },
    createdAt: new Date(),
    timeout: 30000,
    retries: 3,
    ...overrides,
  }),

  agent: (overrides = {}) => ({
    id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'test-agent',
    type: 'worker',
    status: 'active',
    capabilities: ['process', 'analyze'],
    ...overrides,
  }),

  message: (overrides = {}) => ({
    id: `msg-${Date.now()}`,
    type: 'task',
    content: { command: 'process' },
    timestamp: Date.now(),
    sender: 'orchestrator',
    ...overrides,
  }),

  vote: (overrides = {}) => ({
    id: `vote-${Date.now()}`,
    voterId: 'agent-1',
    choice: 'option-a',
    weight: 1,
    timestamp: Date.now(),
    ...overrides,
  }),

  achievement: (overrides = {}) => ({
    id: `achievement-${Date.now()}`,
    name: 'First Task',
    description: 'Complete first task',
    points: 100,
    tier: 'bronze',
    unlocked: false,
    ...overrides,
  }),

  session: (overrides = {}) => ({
    id: `session-${Date.now()}`,
    topic: 'Test Topic',
    startTime: Date.now(),
    duration: 60000,
    status: 'active',
    ...overrides,
  }),
};

// ============================================================================
// Assertion Helpers
// ============================================================================

export const assertionHelpers = {
  /**
   * Assert that a value is a valid UUID/ID
   */
  isValidId(value) {
    return typeof value === 'string' && value.length > 0;
  },

  /**
   * Assert that an object has required properties
   */
  hasProperties(obj, properties) {
    return properties.every(prop => prop in obj);
  },

  /**
   * Assert that an object matches a schema
   */
  matchesSchema(obj, schema) {
    return Object.entries(schema).every(([key, type]) => {
      return typeof obj[key] === type;
    });
  },

  /**
   * Assert that array contains only unique items
   */
  isUnique(array) {
    return new Set(array).size === array.length;
  },

  /**
   * Assert that a value is within range
   */
  isInRange(value, min, max) {
    return value >= min && value <= max;
  },
};

// ============================================================================
// Test Utilities
// ============================================================================

export const testUtils = {
  /**
   * Wait for a condition to be true
   */
  async waitFor(condition, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timeout waiting for condition');
  },

  /**
   * Generate random string
   */
  randomString(length = 10) {
    return Math.random().toString(36).substring(2, 2 + length);
  },

  /**
   * Generate random number in range
   */
  randomNumber(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Deep clone an object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Measure function execution time
   */
  async measureTime(fn) {
    const startTime = Date.now();
    await fn();
    return Date.now() - startTime;
  },

  /**
   * Create a Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};

// ============================================================================
// Exports
// ============================================================================

export default {
  RabbitMQMock,
  StateMock,
  AgentMock,
  factories,
  assertionHelpers,
  testUtils,
};
