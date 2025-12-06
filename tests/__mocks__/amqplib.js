/**
 * Mock amqplib for Jest unit tests
 * Prevents real RabbitMQ connection attempts
 */
import { jest } from '@jest/globals';

// Store for test inspection
export const mockState = {
  connections: [],
  channels: [],
  queues: new Map(),
  exchanges: new Map(),
  messages: [],
  consumers: new Map(),
  lastPublished: null
};

// Reset mock state between tests
export function resetMockState() {
  mockState.connections = [];
  mockState.channels = [];
  mockState.queues.clear();
  mockState.exchanges.clear();
  mockState.messages = [];
  mockState.consumers.clear();
  mockState.lastPublished = null;
}

// Mock channel implementation
function createMockChannel() {
  const channel = {
    assertQueue: jest.fn().mockImplementation((queue, options) => {
      mockState.queues.set(queue, { options, messages: [] });
      return Promise.resolve({ queue, messageCount: 0, consumerCount: 0 });
    }),

    assertExchange: jest.fn().mockImplementation((exchange, type, options) => {
      mockState.exchanges.set(exchange, { type, options });
      return Promise.resolve({});
    }),

    bindQueue: jest.fn().mockResolvedValue({}),
    unbindQueue: jest.fn().mockResolvedValue({}),

    publish: jest.fn().mockImplementation((exchange, routingKey, content, options) => {
      mockState.lastPublished = { exchange, routingKey, content, options };
      mockState.messages.push({ exchange, routingKey, content, options });
      return true;
    }),

    sendToQueue: jest.fn().mockImplementation((queue, content, options) => {
      mockState.lastPublished = { queue, content, options };
      mockState.messages.push({ queue, content, options });
      return true;
    }),

    consume: jest.fn().mockImplementation((queue, callback, options) => {
      const consumerTag = `ctag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      mockState.consumers.set(consumerTag, { queue, callback, options });
      return Promise.resolve({ consumerTag });
    }),

    cancel: jest.fn().mockResolvedValue({}),

    ack: jest.fn(),
    nack: jest.fn(),
    reject: jest.fn(),

    prefetch: jest.fn(),

    close: jest.fn().mockResolvedValue({}),

    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),

    // For confirmChannel
    waitForConfirms: jest.fn().mockResolvedValue({}),

    // Additional methods
    checkQueue: jest.fn().mockImplementation((queue) => {
      return Promise.resolve({ queue, messageCount: 0, consumerCount: 0 });
    }),

    deleteQueue: jest.fn().mockImplementation((queue) => {
      mockState.queues.delete(queue);
      return Promise.resolve({ messageCount: 0 });
    }),

    purgeQueue: jest.fn().mockResolvedValue({ messageCount: 0 }),

    get: jest.fn().mockResolvedValue(false) // No message available
  };

  mockState.channels.push(channel);
  return channel;
}

// Mock connection implementation
function createMockConnection() {
  const connection = {
    createChannel: jest.fn().mockImplementation(() => {
      return Promise.resolve(createMockChannel());
    }),

    createConfirmChannel: jest.fn().mockImplementation(() => {
      return Promise.resolve(createMockChannel());
    }),

    close: jest.fn().mockResolvedValue({}),

    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),

    // Connection properties
    connection: {
      serverProperties: {
        product: 'RabbitMQ',
        version: '3.12.0-mock'
      }
    }
  };

  mockState.connections.push(connection);
  return connection;
}

// Main connect function
const connect = jest.fn().mockImplementation((url, options) => {
  return Promise.resolve(createMockConnection());
});

// Named export
export { connect };

// Default export for `import amqp from 'amqplib'` pattern
const amqplib = {
  connect,
  mockState,
  resetMockState
};

export default amqplib;
