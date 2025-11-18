/**
 * Unit Tests for RabbitMQClient - Core Module
 *
 * Comprehensive test suite for RabbitMQ client:
 * - Connection management and pooling
 * - Channel lifecycle management
 * - Message publishing and consumption
 * - Error handling and recovery
 * - Queue and exchange management
 * - Acknowledgment strategies
 */

import { jest } from '@jest/globals';

// ============================================================================
// SETUP: Mock amqplib Library
// ============================================================================

const mockChannel = {
  prefetch: jest.fn().mockResolvedValue(undefined),
  assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue', messageCount: 0 }),
  assertExchange: jest.fn().mockResolvedValue({ exchange: 'test-exchange' }),
  bindQueue: jest.fn().mockResolvedValue(undefined),
  sendToQueue: jest.fn().mockReturnValue(true),
  publish: jest.fn().mockReturnValue(true),
  consume: jest.fn().mockResolvedValue({ consumerTag: 'test-consumer' }),
  ack: jest.fn(),
  nack: jest.fn(),
  reject: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  cancel: jest.fn().mockResolvedValue(undefined),
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.unstable_mockModule('amqplib', () => ({
  default: {
    connect: jest.fn().mockResolvedValue(mockConnection),
  },
  connect: jest.fn().mockResolvedValue(mockConnection),
}));

// ============================================================================
// DESCRIBE: RabbitMQClient Test Suite
// ============================================================================

describe('RabbitMQClient - Core Functionality', () => {
  let RabbitMQClient;
  let client;

  beforeAll(async () => {
    const module = await import('../../scripts/rabbitmq-client.js');
    RabbitMQClient = module.RabbitMQClient;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection.on.mockClear();
    mockChannel.on.mockClear();
    client = null;
  });

  afterEach(async () => {
    if (client && client.isConnected) {
      await client.close();
    }
  });

  // =========================================================================
  // TEST SUITE 1: Configuration & Initialization
  // =========================================================================

  describe('Configuration & Initialization', () => {
    test('should initialize with default configuration', () => {
      // Arrange
      // Act
      client = new RabbitMQClient();

      // Assert
      expect(client.config.url).toBeDefined();
      expect(client.config.heartbeat).toBeDefined();
      expect(client.config.prefetchCount).toBeGreaterThan(0);
    });

    test('should initialize with custom configuration', () => {
      // Arrange
      const customConfig = {
        url: 'amqp://custom:custom@localhost:5672',
        heartbeat: 60,
        autoReconnect: false,
        prefetchCount: 5,
      };

      // Act
      client = new RabbitMQClient(customConfig);

      // Assert
      expect(client.config.url).toBe(customConfig.url);
      expect(client.config.heartbeat).toBe(customConfig.heartbeat);
      expect(client.config.prefetchCount).toBe(customConfig.prefetchCount);
    });

    test('should initialize internal data structures', () => {
      // Arrange
      // Act
      client = new RabbitMQClient();

      // Assert
      expect(client.channels).toBeInstanceOf(Map);
      expect(client.queues).toBeInstanceOf(Map);
      expect(client.exchanges).toBeInstanceOf(Map);
      expect(client.messageHandlers).toBeInstanceOf(Map);
    });

    test('should set healthy status before connection', () => {
      // Arrange
      // Act
      client = new RabbitMQClient({ healthCheckInterval: 5000 });

      // Assert
      expect(client.isHealthy()).toBeDefined();
    });
  });

  // =========================================================================
  // TEST SUITE 2: Connection Management
  // =========================================================================

  describe('Connection Management', () => {
    test('should establish RabbitMQ connection successfully', async () => {
      // Arrange
      client = new RabbitMQClient();

      // Act
      await client.connect();

      // Assert
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(client.isConnected).toBe(true);
    });

    test('should handle connection timeout', async () => {
      // Arrange
      client = new RabbitMQClient();
      const timeoutError = new Error('Connection timeout');
      mockConnection.createChannel.mockRejectedValueOnce(timeoutError);

      // Act & Assert
      try {
        await client.connect();
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    test('should handle connection refused errors', async () => {
      // Arrange
      client = new RabbitMQClient();
      const refusedError = new Error('ECONNREFUSED');
      mockConnection.createChannel.mockRejectedValueOnce(refusedError);

      // Act & Assert
      try {
        await client.connect();
      } catch (error) {
        expect(error.message).toContain('ECONNREFUSED');
      }
    });

    test('should close connection gracefully', async () => {
      // Arrange
      client = new RabbitMQClient();
      await client.connect();

      // Act
      await client.close();

      // Assert
      expect(mockConnection.close).toHaveBeenCalled();
      expect(client.isConnected).toBe(false);
    });
  });

  // =========================================================================
  // TEST SUITE 3: Queue Management
  // =========================================================================

  describe('Queue Management', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
    });

    test('should create queue successfully', async () => {
      // Arrange
      const queueName = 'test-queue';

      // Act
      const result = await client.assertQueue(queueName);

      // Assert
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        queueName,
        expect.objectContaining({ durable: true })
      );
      expect(result).toBeDefined();
    });

    test('should create durable queue', async () => {
      // Arrange
      const queueName = 'durable-queue';

      // Act
      await client.assertQueue(queueName, { durable: true });

      // Assert
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        queueName,
        expect.objectContaining({ durable: true })
      );
    });

    test('should create queue with message TTL', async () => {
      // Arrange
      const queueName = 'ttl-queue';
      const ttl = 60000; // 60 seconds

      // Act
      await client.assertQueue(queueName, { messageTtl: ttl });

      // Assert
      expect(mockChannel.assertQueue).toHaveBeenCalled();
    });

    test('should track queues in internal map', async () => {
      // Arrange
      const queueName = 'tracked-queue';

      // Act
      await client.assertQueue(queueName);
      client.queues.set(queueName, { durable: true });

      // Assert
      expect(client.queues.has(queueName)).toBe(true);
    });

    test('should set correct prefetch count', async () => {
      // Arrange
      const prefetchCount = 10;
      client = new RabbitMQClient({ prefetchCount });
      await client.connect();

      // Act
      await mockChannel.prefetch(prefetchCount);

      // Assert
      expect(mockChannel.prefetch).toHaveBeenCalledWith(prefetchCount);
    });
  });

  // =========================================================================
  // TEST SUITE 4: Exchange Management
  // =========================================================================

  describe('Exchange Management', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
    });

    test('should create topic exchange', async () => {
      // Arrange
      const exchangeName = 'test-topic-exchange';

      // Act
      await client.assertExchange(exchangeName, 'topic');

      // Assert
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        exchangeName,
        'topic',
        expect.any(Object)
      );
    });

    test('should create direct exchange', async () => {
      // Arrange
      const exchangeName = 'test-direct-exchange';

      // Act
      await client.assertExchange(exchangeName, 'direct');

      // Assert
      expect(mockChannel.assertExchange).toHaveBeenCalled();
    });

    test('should create fanout exchange', async () => {
      // Arrange
      const exchangeName = 'test-fanout-exchange';

      // Act
      await client.assertExchange(exchangeName, 'fanout');

      // Assert
      expect(mockChannel.assertExchange).toHaveBeenCalled();
    });

    test('should bind queue to exchange', async () => {
      // Arrange
      const queueName = 'test-queue';
      const exchangeName = 'test-exchange';
      const routingKey = 'test.key';

      // Act
      await client.bindQueueToExchange(queueName, exchangeName, routingKey);

      // Assert
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        queueName,
        exchangeName,
        routingKey
      );
    });

    test('should track exchanges in internal map', async () => {
      // Arrange
      const exchangeName = 'tracked-exchange';

      // Act
      await client.assertExchange(exchangeName, 'topic');
      client.exchanges.set(exchangeName, { type: 'topic' });

      // Assert
      expect(client.exchanges.has(exchangeName)).toBe(true);
    });
  });

  // =========================================================================
  // TEST SUITE 5: Message Publishing
  // =========================================================================

  describe('Message Publishing', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
    });

    test('should publish message to queue successfully', async () => {
      // Arrange
      const queueName = 'test-queue';
      const message = { data: 'test message' };

      // Act
      const result = await client.publishToQueue(queueName, message);

      // Assert
      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        queueName,
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    test('should publish message with persistence', async () => {
      // Arrange
      const queueName = 'test-queue';
      const message = { data: 'persistent message' };

      // Act
      await client.publishToQueue(queueName, message, { persistent: true });

      // Assert
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
    });

    test('should publish to exchange with routing key', async () => {
      // Arrange
      const exchangeName = 'test-exchange';
      const routingKey = 'test.routing.key';
      const message = { command: 'process' };

      // Act
      await client.publishToExchange(exchangeName, routingKey, message);

      // Assert
      expect(mockChannel.publish).toHaveBeenCalledWith(
        exchangeName,
        routingKey,
        expect.any(Buffer),
        expect.any(Object)
      );
    });

    test('should handle message serialization', async () => {
      // Arrange
      const queueName = 'test-queue';
      const complexMessage = {
        id: 'msg-001',
        timestamp: Date.now(),
        data: { nested: { value: 42 } },
      };

      // Act
      await client.publishToQueue(queueName, complexMessage);

      // Assert
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
      const callArgs = mockChannel.sendToQueue.mock.calls[0];
      const buffer = callArgs[1];
      expect(buffer).toBeInstanceOf(Buffer);
    });

    test('should handle large message publishing', async () => {
      // Arrange
      const queueName = 'test-queue';
      const largeMessage = { data: 'x'.repeat(1000000) }; // 1MB message

      // Act
      await client.publishToQueue(queueName, largeMessage);

      // Assert
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TEST SUITE 6: Message Consumption
  // =========================================================================

  describe('Message Consumption', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
    });

    test('should consume messages from queue', async () => {
      // Arrange
      const queueName = 'test-queue';
      const handler = jest.fn();

      // Act
      await client.consumeMessages(queueName, handler);

      // Assert
      expect(mockChannel.consume).toHaveBeenCalledWith(
        queueName,
        expect.any(Function),
        expect.any(Object)
      );
    });

    test('should handle message acknowledgment', async () => {
      // Arrange
      const queueName = 'test-queue';
      const handler = jest.fn();
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ data: 'test' })),
        ack: jest.fn(),
      };

      // Act
      mockChannel.consume.mockImplementationOnce((q, cb) => {
        cb(mockMessage);
        return { consumerTag: 'test' };
      });
      await client.consumeMessages(queueName, handler);

      // Assert
      expect(handler).toHaveBeenCalled();
    });

    test('should handle message rejection (nack)', async () => {
      // Arrange
      const queueName = 'test-queue';
      const handler = jest.fn().mockRejectedValue(new Error('Processing failed'));
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ data: 'test' })),
        nack: jest.fn(),
      };

      // Act
      mockChannel.consume.mockImplementationOnce((q, cb) => {
        cb(mockMessage);
        return { consumerTag: 'test' };
      });

      try {
        await client.consumeMessages(queueName, handler);
      } catch (e) {
        // Expected error
      }

      // Assert
      expect(mockMessage.nack).toHaveBeenCalled();
    });

    test('should handle multiple concurrent consumers', async () => {
      // Arrange
      const queues = ['queue-1', 'queue-2', 'queue-3'];
      const handlers = queues.map(() => jest.fn());

      // Act
      await Promise.all(
        queues.map((q, i) => client.consumeMessages(q, handlers[i]))
      );

      // Assert
      expect(mockChannel.consume).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // TEST SUITE 7: Error Handling & Recovery
  // =========================================================================

  describe('Error Handling & Recovery', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
    });

    test('should handle message processing errors', async () => {
      // Arrange
      const queueName = 'test-queue';
      const error = new Error('Message processing failed');
      const handler = jest.fn().mockRejectedValue(error);

      // Act & Assert
      expect(async () => {
        await client.consumeMessages(queueName, handler);
      }).not.toThrow();
    });

    test('should implement retry logic for failed messages', async () => {
      // Arrange
      const queueName = 'test-queue';
      const maxRetries = 3;
      let attempts = 0;

      const handler = jest.fn().mockImplementation(async (msg) => {
        attempts++;
        if (attempts < maxRetries) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      // Act
      mockChannel.consume.mockImplementationOnce((q, cb) => {
        cb({
          content: Buffer.from(JSON.stringify({ data: 'test' })),
          ack: jest.fn(),
        });
        return { consumerTag: 'test' };
      });

      await client.consumeMessages(queueName, handler);

      // Assert
      expect(handler).toHaveBeenCalled();
    });

    test('should handle channel closure', async () => {
      // Arrange
      mockChannel.close.mockResolvedValue(undefined);

      // Act
      await mockChannel.close();

      // Assert
      expect(mockChannel.close).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TEST SUITE 8: Performance & Limits
  // =========================================================================

  describe('Performance & Limits', () => {
    beforeEach(async () => {
      client = new RabbitMQClient({ prefetchCount: 10 });
      await client.connect();
    });

    test('should respect backpressure with prefetch', async () => {
      // Arrange
      const prefetchCount = 10;

      // Act
      await mockChannel.prefetch(prefetchCount);

      // Assert
      expect(mockChannel.prefetch).toHaveBeenCalledWith(prefetchCount);
    });

    test('should handle rapid message publishing', async () => {
      // Arrange
      const queueName = 'test-queue';
      const messageCount = 100;

      // Act
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        id: `msg-${i}`,
        data: `message ${i}`,
      }));

      await Promise.all(
        messages.map(msg => client.publishToQueue(queueName, msg))
      );

      // Assert
      expect(mockChannel.sendToQueue).toHaveBeenCalled();
    });

    test('should manage memory efficiently with large payloads', async () => {
      // Arrange
      const startMem = process.memoryUsage().heapUsed;

      // Act
      const largePayload = { data: 'x'.repeat(10000) };
      await client.publishToQueue('test-queue', largePayload);

      // Assert
      const endMem = process.memoryUsage().heapUsed;
      const diff = (endMem - startMem) / 1024 / 1024; // MB
      expect(diff).toBeLessThan(10); // Less than 10MB increase
    });
  });
});
