/**
 * Test Setup Configuration
 * Global setup for Jest tests with comprehensive utilities
 */

import { jest } from '@jest/globals';

// ==============================================================
// MOCK EXTERNAL SERVICES (Must be before any imports that use them)
// ==============================================================

// Mock amqplib for RabbitMQ-dependent tests
jest.unstable_mockModule('amqplib', () => {
  const mockState = {
    connections: [],
    channels: [],
    queues: new Map(),
    messages: [],
    lastPublished: null
  };

  function createMockChannel() {
    return {
      assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue', messageCount: 0, consumerCount: 0 }),
      assertExchange: jest.fn().mockResolvedValue({}),
      bindQueue: jest.fn().mockResolvedValue({}),
      unbindQueue: jest.fn().mockResolvedValue({}),
      publish: jest.fn().mockReturnValue(true),
      sendToQueue: jest.fn().mockReturnValue(true),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'test-consumer' }),
      cancel: jest.fn().mockResolvedValue({}),
      ack: jest.fn(),
      nack: jest.fn(),
      reject: jest.fn(),
      prefetch: jest.fn(),
      close: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn(),
      checkQueue: jest.fn().mockResolvedValue({ queue: 'test-queue', messageCount: 0, consumerCount: 0 }),
      deleteQueue: jest.fn().mockResolvedValue({ messageCount: 0 }),
      purgeQueue: jest.fn().mockResolvedValue({ messageCount: 0 }),
      get: jest.fn().mockResolvedValue(false)
    };
  }

  function createMockConnection() {
    return {
      createChannel: jest.fn().mockResolvedValue(createMockChannel()),
      createConfirmChannel: jest.fn().mockResolvedValue(createMockChannel()),
      close: jest.fn().mockResolvedValue({}),
      on: jest.fn(),
      once: jest.fn(),
      removeListener: jest.fn()
    };
  }

  const connect = jest.fn().mockResolvedValue(createMockConnection());

  return {
    default: { connect, mockState },
    connect,
    mockState
  };
});

// Mock ioredis for Redis-dependent tests
jest.unstable_mockModule('ioredis', () => {
  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    expire: jest.fn().mockResolvedValue(1),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    incr: jest.fn().mockResolvedValue(1),
    zadd: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    publish: jest.fn().mockResolvedValue(1),
    subscribe: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn()
  };
  return {
    default: jest.fn(() => mockRedis),
    Redis: jest.fn(() => mockRedis)
  };
});

// Mock pg for PostgreSQL-dependent tests
jest.unstable_mockModule('pg', () => {
  const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue({}),
    release: jest.fn(),
    end: jest.fn().mockResolvedValue({})
  };
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue({}),
    on: jest.fn()
  };
  return {
    default: { Pool: jest.fn(() => mockPool), Client: jest.fn(() => mockClient) },
    Pool: jest.fn(() => mockPool),
    Client: jest.fn(() => mockClient)
  };
});

// ==============================================================
// ENVIRONMENT VARIABLES
// ==============================================================

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.RABBITMQ_HOST = 'localhost';
process.env.RABBITMQ_PORT = '5672';
process.env.RABBITMQ_USER = 'test_user';
process.env.RABBITMQ_PASS = 'test_pass';
process.env.RABBITMQ_URL = 'amqp://localhost:5672';
process.env.ORCHESTRATOR_QUEUE = 'test_orchestrator';
process.env.TASK_EXCHANGE = 'test_tasks';
process.env.RESULT_EXCHANGE = 'test_results';
process.env.AGENT_ID = 'test-agent-001';
process.env.AGENT_NAME = 'Test Agent';
process.env.HEARTBEAT_INTERVAL = '30';
process.env.AUTO_RECONNECT = 'false';
process.env.PREFETCH_COUNT = '1';

// Global test utilities
global.testUtils = {
  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Create test timeout
  timeout: (ms = 5000) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Test timeout')), ms)
  ),

  // Mock console methods to reduce noise
  silenceConsole: () => {
    global.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  },

  // Restore console methods
  restoreConsole: () => {
    if (global.originalConsole) {
      console.log = global.originalConsole.log;
      console.error = global.originalConsole.error;
      console.warn = global.originalConsole.warn;
      console.info = global.originalConsole.info;
    }
  }
};

// Suppress console logs during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.testUtils.silenceConsole();
}

// Global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  global.testUtils.restoreConsole();
  // Close any open connections
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Global error handler
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection in tests:', error);
});
