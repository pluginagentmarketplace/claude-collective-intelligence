/**
 * RabbitMQ Test Helpers
 * Utilities for mocking and testing RabbitMQ interactions
 */

import { jest } from '@jest/globals';

/**
 * Create mock RabbitMQ connection
 */
export function createMockConnection() {
  const mockChannel = createMockChannel();

  return {
    createChannel: jest.fn().mockResolvedValue(mockChannel),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    connection: {
      stream: {
        on: jest.fn()
      }
    }
  };
}

/**
 * Create mock RabbitMQ channel
 */
export function createMockChannel() {
  const messageHandlers = new Map();

  return {
    assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue', messageCount: 0, consumerCount: 0 }),
    assertExchange: jest.fn().mockResolvedValue({ exchange: 'test-exchange' }),
    bindQueue: jest.fn().mockResolvedValue({}),
    unbindQueue: jest.fn().mockResolvedValue({}),
    sendToQueue: jest.fn().mockReturnValue(true),
    publish: jest.fn().mockReturnValue(true),
    consume: jest.fn((queue, handler, options) => {
      messageHandlers.set(queue, handler);
      return Promise.resolve({ consumerTag: 'test-consumer-' + Date.now() });
    }),
    cancel: jest.fn().mockResolvedValue(undefined),
    ack: jest.fn(),
    nack: jest.fn(),
    reject: jest.fn(),
    prefetch: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    removeListener: jest.fn(),

    // Helper to simulate receiving a message
    simulateMessage: (queue, content, properties = {}) => {
      const handler = messageHandlers.get(queue);
      if (handler) {
        const message = createMockMessage(content, properties);
        handler(message);
        return message;
      }
      throw new Error(`No consumer registered for queue: ${queue}`);
    },

    // Get registered handlers
    getHandlers: () => messageHandlers
  };
}

/**
 * Create mock RabbitMQ message
 */
export function createMockMessage(content, properties = {}) {
  const contentBuffer = Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));

  return {
    content: contentBuffer,
    fields: {
      deliveryTag: Math.floor(Math.random() * 1000000),
      redelivered: false,
      exchange: properties.exchange || 'test-exchange',
      routingKey: properties.routingKey || 'test.route',
      ...properties.fields
    },
    properties: {
      contentType: 'application/json',
      contentEncoding: 'utf-8',
      headers: {},
      deliveryMode: 2,
      priority: 0,
      correlationId: properties.correlationId || null,
      replyTo: properties.replyTo || null,
      expiration: properties.expiration || null,
      messageId: properties.messageId || `msg-${Date.now()}`,
      timestamp: Date.now(),
      type: properties.type || 'test',
      userId: properties.userId || 'test-user',
      appId: properties.appId || 'test-app',
      ...properties.properties
    }
  };
}

/**
 * Create mock amqplib module
 */
export function createMockAmqplib() {
  const mockConnection = createMockConnection();

  return {
    connect: jest.fn().mockResolvedValue(mockConnection),
    connection: mockConnection
  };
}

/**
 * Wait for a message to be consumed
 */
export async function waitForConsume(channel, queue, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const handlers = channel.getHandlers();
    if (handlers && handlers.has(queue)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout waiting for consumer on queue: ${queue}`);
}

/**
 * Wait for a message to be sent
 */
export async function waitForMessage(channel, predicate, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const calls = channel.sendToQueue.mock.calls;
    if (calls.some(call => predicate(call))) {
      return calls.find(call => predicate(call));
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timeout waiting for message');
}

/**
 * Extract message content from mock call
 */
export function extractMessageContent(call) {
  if (!call || call.length < 2) return null;
  const buffer = call[1];
  const content = buffer.toString('utf-8');
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

/**
 * Verify queue was asserted with correct options
 */
export function verifyQueueAsserted(channel, queueName, options = {}) {
  const calls = channel.assertQueue.mock.calls;
  const call = calls.find(c => c[0] === queueName);

  if (!call) {
    throw new Error(`Queue ${queueName} was not asserted`);
  }

  if (options) {
    const actualOptions = call[1] || {};
    for (const [key, value] of Object.entries(options)) {
      if (actualOptions[key] !== value) {
        throw new Error(`Queue ${queueName} option ${key} expected ${value} but got ${actualOptions[key]}`);
      }
    }
  }

  return true;
}

/**
 * Verify exchange was asserted with correct options
 */
export function verifyExchangeAsserted(channel, exchangeName, type, options = {}) {
  const calls = channel.assertExchange.mock.calls;
  const call = calls.find(c => c[0] === exchangeName && c[1] === type);

  if (!call) {
    throw new Error(`Exchange ${exchangeName} of type ${type} was not asserted`);
  }

  if (options) {
    const actualOptions = call[2] || {};
    for (const [key, value] of Object.entries(options)) {
      if (actualOptions[key] !== value) {
        throw new Error(`Exchange ${exchangeName} option ${key} expected ${value} but got ${actualOptions[key]}`);
      }
    }
  }

  return true;
}

export default {
  createMockConnection,
  createMockChannel,
  createMockMessage,
  createMockAmqplib,
  waitForConsume,
  waitForMessage,
  extractMessageContent,
  verifyQueueAsserted,
  verifyExchangeAsserted
};
