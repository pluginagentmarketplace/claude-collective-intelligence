/**
 * Mock amqplib for Jest unit tests
 * Prevents real RabbitMQ connection attempts
 *
 * Uses EventEmitter for proper event handling
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

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

// Mock channel implementation (extends EventEmitter)
function createMockChannel() {
  const channel = new EventEmitter();

  // RabbitMQ channel methods
  channel.assertQueue = jest.fn().mockImplementation((queue, options) => {
    mockState.queues.set(queue, { options, messages: [] });
    return Promise.resolve({ queue, messageCount: 0, consumerCount: 0 });
  });

  channel.assertExchange = jest.fn().mockImplementation((exchange, type, options) => {
    mockState.exchanges.set(exchange, { type, options });
    return Promise.resolve({});
  });

  channel.bindQueue = jest.fn().mockResolvedValue({});
  channel.unbindQueue = jest.fn().mockResolvedValue({});

  channel.publish = jest.fn().mockImplementation((exchange, routingKey, content, options) => {
    mockState.lastPublished = { exchange, routingKey, content, options };
    mockState.messages.push({ exchange, routingKey, content, options });
    return true;
  });

  channel.sendToQueue = jest.fn().mockImplementation((queue, content, options) => {
    mockState.lastPublished = { queue, content, options };
    mockState.messages.push({ queue, content, options });
    return true;
  });

  channel.consume = jest.fn().mockImplementation((queue, callback, options) => {
    const consumerTag = `ctag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    mockState.consumers.set(consumerTag, { queue, callback, options });
    return Promise.resolve({ consumerTag });
  });

  channel.cancel = jest.fn().mockResolvedValue({});

  channel.ack = jest.fn();
  channel.nack = jest.fn();
  channel.reject = jest.fn();

  channel.prefetch = jest.fn();

  channel.close = jest.fn().mockImplementation(async () => {
    channel.emit('close');
    return {};
  });

  // For confirmChannel
  channel.waitForConfirms = jest.fn().mockResolvedValue({});

  // Additional methods
  channel.checkQueue = jest.fn().mockImplementation((queue) => {
    return Promise.resolve({ queue, messageCount: 0, consumerCount: 0 });
  });

  channel.deleteQueue = jest.fn().mockImplementation((queue) => {
    mockState.queues.delete(queue);
    return Promise.resolve({ messageCount: 0 });
  });

  channel.purgeQueue = jest.fn().mockResolvedValue({ messageCount: 0 });

  channel.get = jest.fn().mockResolvedValue(false); // No message available

  mockState.channels.push(channel);
  return channel;
}

// Mock connection implementation (extends EventEmitter)
function createMockConnection() {
  const connection = new EventEmitter();

  // RabbitMQ connection methods
  connection.createChannel = jest.fn().mockImplementation(() => {
    return Promise.resolve(createMockChannel());
  });

  connection.createConfirmChannel = jest.fn().mockImplementation(() => {
    return Promise.resolve(createMockChannel());
  });

  connection.close = jest.fn().mockImplementation(async () => {
    connection.emit('close');
    return {};
  });

  // Connection properties
  connection.connection = {
    serverProperties: {
      product: 'RabbitMQ',
      version: '3.12.0-mock'
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
