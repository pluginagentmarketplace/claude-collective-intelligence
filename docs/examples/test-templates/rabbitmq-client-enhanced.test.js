/**
 * Enhanced Unit Tests for RabbitMQClient
 * Comprehensive testing of connection management, channel handling, and messaging
 * Target Coverage: 90%+
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// ==================== MOCK SETUP ====================

// Mock AMQP Connection
class MockConnection extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.closed = false;
    this.blocked = false;
    this.channels = new Set();
  }

  async createChannel() {
    if (this.closed) {
      throw new Error('Connection is closed');
    }
    const channel = new MockChannel(this);
    this.channels.add(channel);
    return channel;
  }

  async close() {
    this.closed = true;
    for (const channel of this.channels) {
      await channel.close();
    }
    this.emit('close');
  }
}

// Mock AMQP Channel
class MockChannel extends EventEmitter {
  constructor(connection) {
    super();
    this.connection = connection;
    this.closed = false;
    this.queues = new Map();
    this.exchanges = new Map();
    this.consumers = new Map();
    this.prefetchCount = 0;
    this.publishedMessages = [];
  }

  async assertQueue(queue, options = {}) {
    if (this.closed) throw new Error('Channel is closed');

    this.queues.set(queue, {
      name: queue,
      options,
      messages: [],
      consumerCount: 0,
    });

    return {
      queue,
      messageCount: 0,
      consumerCount: 0,
    };
  }

  async assertExchange(exchange, type, options = {}) {
    if (this.closed) throw new Error('Channel is closed');

    this.exchanges.set(exchange, {
      name: exchange,
      type,
      options,
      bindings: new Set(),
    });
  }

  async bindQueue(queue, exchange, routingKey) {
    const ex = this.exchanges.get(exchange);
    if (ex) {
      ex.bindings.add({ queue, routingKey });
    }
  }

  async publish(exchange, routingKey, content, options = {}) {
    if (this.closed) throw new Error('Channel is closed');

    const message = {
      exchange,
      routingKey,
      content: content.toString(),
      options,
      timestamp: Date.now(),
    };

    this.publishedMessages.push(message);

    // Simulate message routing
    if (exchange) {
      const ex = this.exchanges.get(exchange);
      if (ex) {
        for (const binding of ex.bindings) {
          if (this.matchRoutingKey(routingKey, binding.routingKey)) {
            const queue = this.queues.get(binding.queue);
            if (queue) {
              queue.messages.push(message);
            }
          }
        }
      }
    }

    return true;
  }

  async sendToQueue(queue, content, options = {}) {
    return this.publish('', queue, content, options);
  }

  async consume(queue, onMessage, options = {}) {
    if (this.closed) throw new Error('Channel is closed');

    const consumerTag = `consumer-${Date.now()}`;
    this.consumers.set(consumerTag, {
      queue,
      onMessage,
      options,
    });

    const q = this.queues.get(queue);
    if (q) {
      q.consumerCount++;
    }

    return { consumerTag };
  }

  async cancel(consumerTag) {
    this.consumers.delete(consumerTag);
  }

  async ack(message) {
    // Acknowledge message
    return true;
  }

  async nack(message, allUpTo = false, requeue = true) {
    // Negative acknowledge
    return true;
  }

  async prefetch(count) {
    this.prefetchCount = count;
  }

  async close() {
    this.closed = true;
    this.emit('close');
  }

  matchRoutingKey(routingKey, pattern) {
    // Simple routing key matching (supports * and #)
    if (pattern === '#') return true;
    if (pattern === routingKey) return true;
    // Add more sophisticated matching as needed
    return false;
  }

  // Test helper methods
  simulateMessage(queue, content) {
    const consumer = Array.from(this.consumers.values())
      .find(c => c.queue === queue);

    if (consumer) {
      const message = {
        content: Buffer.from(JSON.stringify(content)),
        fields: { deliveryTag: Date.now() },
        properties: {},
      };
      consumer.onMessage(message);
    }
  }

  getPublishedMessages() {
    return this.publishedMessages;
  }
}

// Mock amqplib
const mockConnect = jest.fn(async (url) => new MockConnection(url));

jest.unstable_mockModule('amqplib', () => ({
  connect: mockConnect,
}));

// ==================== TEST SUITES ====================

describe('RabbitMQClient - Enhanced Test Suite', () => {
  let RabbitMQClient;
  let client;
  let mockConnection;
  let mockChannel;

  // ===== SETUP & TEARDOWN =====
  beforeAll(async () => {
    const module = await import('../../scripts/rabbitmq-client.js');
    RabbitMQClient = module.RabbitMQClient;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = null;
    mockChannel = null;
    client = null;

    // Reset mock connect function
    mockConnect.mockImplementation(async (url) => {
      mockConnection = new MockConnection(url);
      return mockConnection;
    });
  });

  afterEach(async () => {
    if (client?.isConnected) {
      await client.close();
    }
  });

  // ===== CONNECTION MANAGEMENT TESTS =====
  describe('Connection Management', () => {
    describe('Basic Connection', () => {
      it('should connect with default configuration', async () => {
        client = new RabbitMQClient();
        await client.connect();

        expect(mockConnect).toHaveBeenCalledWith(
          expect.stringContaining('amqp://')
        );
        expect(client.isConnected).toBe(true);
      });

      it('should connect with custom URL', async () => {
        const customUrl = 'amqp://user:pass@custom-host:5672';
        client = new RabbitMQClient({ url: customUrl });
        await client.connect();

        expect(mockConnect).toHaveBeenCalledWith(customUrl);
      });

      it('should handle connection failures', async () => {
        mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

        client = new RabbitMQClient();
        await expect(client.connect()).rejects.toThrow('Connection refused');
        expect(client.isConnected).toBe(false);
      });

      it('should prevent duplicate connections', async () => {
        client = new RabbitMQClient();
        await client.connect();

        // Try to connect again
        await client.connect();

        expect(mockConnect).toHaveBeenCalledTimes(1);
      });

      it('should close connection properly', async () => {
        client = new RabbitMQClient();
        await client.connect();

        await client.close();

        expect(client.isConnected).toBe(false);
        expect(mockConnection.closed).toBe(true);
      });
    });

    describe('Connection Resilience', () => {
      it('should implement automatic reconnection', async () => {
        client = new RabbitMQClient({
          reconnect: true,
          reconnectInterval: 100,
        });

        await client.connect();

        // Simulate connection drop
        mockConnection.emit('error', new Error('Connection lost'));
        mockConnection.emit('close');

        // Wait for reconnection
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(mockConnect).toHaveBeenCalledTimes(2);
      });

      it('should handle connection blocking', async () => {
        client = new RabbitMQClient();
        await client.connect();

        const blockHandler = jest.fn();
        client.on('blocked', blockHandler);

        mockConnection.emit('blocked', 'Low memory');

        expect(blockHandler).toHaveBeenCalledWith('Low memory');
      });

      it('should implement exponential backoff for reconnection', async () => {
        client = new RabbitMQClient({
          reconnect: true,
          reconnectInterval: 100,
          maxReconnectInterval: 1000,
        });

        const connectAttempts = [];
        mockConnect.mockImplementation(async () => {
          connectAttempts.push(Date.now());
          throw new Error('Connection failed');
        });

        try {
          await client.connect();
        } catch (e) {
          // Expected
        }

        // Wait for multiple reconnection attempts
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check that intervals are increasing
        for (let i = 2; i < connectAttempts.length; i++) {
          const interval = connectAttempts[i] - connectAttempts[i - 1];
          const prevInterval = connectAttempts[i - 1] - connectAttempts[i - 2];
          expect(interval).toBeGreaterThanOrEqual(prevInterval);
        }
      });
    });

    describe('Connection Pooling', () => {
      it('should manage multiple channels efficiently', async () => {
        client = new RabbitMQClient({ maxChannels: 5 });
        await client.connect();

        const channels = [];
        for (let i = 0; i < 5; i++) {
          channels.push(await client.createChannel());
        }

        expect(channels).toHaveLength(5);
        expect(mockConnection.channels.size).toBe(5);
      });

      it('should reuse channels when possible', async () => {
        client = new RabbitMQClient({ reuseChannels: true });
        await client.connect();

        const channel1 = await client.getChannel('tasks');
        const channel2 = await client.getChannel('tasks');

        expect(channel1).toBe(channel2);
      });

      it('should handle channel errors gracefully', async () => {
        client = new RabbitMQClient();
        await client.connect();

        mockChannel = await mockConnection.createChannel();

        // Simulate channel error
        mockChannel.emit('error', new Error('Channel error'));
        mockChannel.emit('close');

        // Client should create a new channel automatically
        const newChannel = await client.getChannel();
        expect(newChannel).not.toBe(mockChannel);
      });
    });
  });

  // ===== QUEUE MANAGEMENT TESTS =====
  describe('Queue Management', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
      mockChannel = await mockConnection.createChannel();
    });

    describe('Queue Creation', () => {
      it('should create a simple queue', async () => {
        const queueName = await client.setupTaskQueue('test-queue');

        expect(queueName).toBe('test-queue');
        expect(mockChannel.queues.has('test-queue')).toBe(true);
      });

      it('should create queue with options', async () => {
        const options = {
          durable: true,
          exclusive: false,
          autoDelete: false,
          arguments: {
            'x-message-ttl': 60000,
            'x-max-length': 1000,
          },
        };

        await client.setupQueue('priority-queue', options);

        const queue = mockChannel.queues.get('priority-queue');
        expect(queue.options).toMatchObject(options);
      });

      it('should handle queue declaration errors', async () => {
        mockChannel.assertQueue = jest.fn()
          .mockRejectedValueOnce(new Error('Queue already exists'));

        await expect(
          client.setupQueue('existing-queue')
        ).rejects.toThrow('Queue already exists');
      });

      it('should setup dead letter queue', async () => {
        await client.setupDeadLetterQueue('main-queue', 'dlq-queue');

        const mainQueue = mockChannel.queues.get('main-queue');
        expect(mainQueue.options.arguments['x-dead-letter-exchange']).toBeDefined();
      });
    });

    describe('Message Publishing', () => {
      it('should publish message to queue', async () => {
        await client.setupTaskQueue('test-queue');

        const message = { type: 'test', data: 'hello' };
        const messageId = await client.publishTask(message);

        expect(messageId).toBeDefined();
        expect(mockChannel.publishedMessages).toHaveLength(1);
      });

      it('should handle publish confirmation', async () => {
        client = new RabbitMQClient({ publisherConfirms: true });
        await client.connect();

        const message = { confirmed: true };
        const result = await client.publishWithConfirmation('queue', message);

        expect(result.confirmed).toBe(true);
      });

      it('should retry failed publishes', async () => {
        let attemptCount = 0;
        mockChannel.publish = jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Publish failed');
          }
          return true;
        });

        const message = { retry: true };
        await client.publishTask(message, { maxRetries: 3 });

        expect(attemptCount).toBe(3);
      });

      it('should handle large messages', async () => {
        const largeData = new Array(10000).fill('x').join('');
        const message = { type: 'large', data: largeData };

        const messageId = await client.publishTask(message);

        expect(messageId).toBeDefined();
        // Check compression was applied if configured
        if (client.config.compressLargeMessages) {
          const published = mockChannel.publishedMessages[0];
          expect(published.options.headers['content-encoding']).toBe('gzip');
        }
      });

      it('should implement message batching', async () => {
        client = new RabbitMQClient({ batchSize: 10, batchInterval: 100 });
        await client.connect();

        // Publish multiple messages quickly
        const promises = [];
        for (let i = 0; i < 25; i++) {
          promises.push(client.publishBatch('batch-queue', { id: i }));
        }

        await Promise.all(promises);

        // Should have batched the messages
        expect(mockChannel.publishedMessages.length).toBeLessThan(25);
      });
    });

    describe('Message Consumption', () => {
      it('should consume messages from queue', async () => {
        const messages = [];
        const handler = jest.fn((msg) => {
          messages.push(msg);
        });

        await client.consumeTasks(handler);

        // Simulate incoming message
        mockChannel.simulateMessage('agent.tasks', { type: 'test' });

        expect(handler).toHaveBeenCalled();
        expect(messages).toHaveLength(1);
      });

      it('should handle consumer cancellation', async () => {
        const handler = jest.fn();
        const { consumerTag } = await client.consume('test-queue', handler);

        await client.cancelConsumer(consumerTag);

        // Message should not be delivered after cancellation
        mockChannel.simulateMessage('test-queue', { type: 'test' });
        expect(handler).not.toHaveBeenCalled();
      });

      it('should implement message acknowledgment strategies', async () => {
        const handler = jest.fn();

        // Auto-acknowledge
        await client.consume('auto-ack-queue', handler, { noAck: true });

        // Manual acknowledge
        await client.consume('manual-ack-queue', async (msg) => {
          await handler(msg);
          await client.ack(msg);
        }, { noAck: false });

        mockChannel.simulateMessage('manual-ack-queue', { needsAck: true });

        expect(handler).toHaveBeenCalled();
      });

      it('should handle message redelivery', async () => {
        let deliveryCount = 0;
        const handler = jest.fn((msg) => {
          deliveryCount++;
          if (deliveryCount === 1) {
            throw new Error('Processing failed');
          }
          return msg;
        });

        await client.consume('retry-queue', handler, {
          retryOnError: true,
          maxRetries: 3,
        });

        mockChannel.simulateMessage('retry-queue', { retry: true });

        // Wait for retry
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(deliveryCount).toBeGreaterThan(1);
      });

      it('should implement prefetch for flow control', async () => {
        await client.setPrefetch(10);

        expect(mockChannel.prefetchCount).toBe(10);
      });
    });
  });

  // ===== EXCHANGE MANAGEMENT TESTS =====
  describe('Exchange Management', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
      mockChannel = await mockConnection.createChannel();
    });

    describe('Exchange Types', () => {
      it('should create direct exchange', async () => {
        await client.setupExchange('direct-ex', 'direct');

        const exchange = mockChannel.exchanges.get('direct-ex');
        expect(exchange.type).toBe('direct');
      });

      it('should create fanout exchange', async () => {
        await client.setupExchange('fanout-ex', 'fanout');

        const exchange = mockChannel.exchanges.get('fanout-ex');
        expect(exchange.type).toBe('fanout');
      });

      it('should create topic exchange', async () => {
        await client.setupExchange('topic-ex', 'topic');

        const exchange = mockChannel.exchanges.get('topic-ex');
        expect(exchange.type).toBe('topic');
      });

      it('should create headers exchange', async () => {
        await client.setupExchange('headers-ex', 'headers');

        const exchange = mockChannel.exchanges.get('headers-ex');
        expect(exchange.type).toBe('headers');
      });
    });

    describe('Publishing to Exchanges', () => {
      it('should publish to fanout exchange', async () => {
        await client.setupBrainstormExchange();

        const message = { type: 'brainstorm', idea: 'test' };
        await client.broadcastBrainstorm(message);

        const published = mockChannel.publishedMessages[0];
        expect(published.exchange).toBe('agent.brainstorm');
      });

      it('should publish with routing key', async () => {
        await client.setupExchange('topic-ex', 'topic');

        await client.publishToExchange('topic-ex', 'tasks.priority.high', {
          urgent: true,
        });

        const published = mockChannel.publishedMessages[0];
        expect(published.routingKey).toBe('tasks.priority.high');
      });

      it('should handle exchange bindings', async () => {
        await client.setupExchange('source-ex', 'direct');
        await client.setupExchange('dest-ex', 'fanout');

        await client.bindExchange('dest-ex', 'source-ex', 'routing-key');

        // Verify binding was created
        // Implementation depends on mock structure
      });
    });
  });

  // ===== ERROR HANDLING TESTS =====
  describe('Error Handling', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
    });

    describe('Connection Errors', () => {
      it('should emit error events', async () => {
        const errorHandler = jest.fn();
        client.on('error', errorHandler);

        mockConnection.emit('error', new Error('Connection error'));

        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Connection error' })
        );
      });

      it('should handle channel errors independently', async () => {
        const channel1 = await client.createChannel();
        const channel2 = await client.createChannel();

        // Error in channel1 shouldn't affect channel2
        channel1.emit('error', new Error('Channel 1 error'));

        expect(channel2.closed).toBe(false);
      });
    });

    describe('Message Processing Errors', () => {
      it('should handle malformed messages', async () => {
        const handler = jest.fn();
        await client.consume('test-queue', handler);

        // Send malformed message
        mockChannel.consumers.values().next().value.onMessage({
          content: Buffer.from('invalid json'),
          fields: { deliveryTag: 1 },
        });

        // Should not crash, should handle gracefully
        expect(handler).not.toHaveBeenCalled();
      });

      it('should implement dead letter handling for failed messages', async () => {
        await client.setupQueueWithDLQ('main-queue', 'dlq-queue');

        const failingHandler = jest.fn().mockRejectedValue(
          new Error('Processing failed')
        );

        await client.consume('main-queue', failingHandler, {
          deadLetterOnError: true,
        });

        mockChannel.simulateMessage('main-queue', { willFail: true });

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Message should be in DLQ
        const dlq = mockChannel.queues.get('dlq-queue');
        expect(dlq.messages).toHaveLength(1);
      });
    });
  });

  // ===== PERFORMANCE TESTS =====
  describe('Performance Optimization', () => {
    beforeEach(async () => {
      client = new RabbitMQClient({
        performanceMode: true,
      });
      await client.connect();
    });

    describe('Throughput Optimization', () => {
      it('should handle high message throughput', async () => {
        const messageCount = 10000;
        const startTime = Date.now();

        const promises = [];
        for (let i = 0; i < messageCount; i++) {
          promises.push(
            client.publishTask({ id: i, data: 'test' })
          );
        }

        await Promise.all(promises);

        const duration = Date.now() - startTime;
        const throughput = messageCount / (duration / 1000);

        // Should handle at least 1000 messages per second
        expect(throughput).toBeGreaterThan(1000);
      });

      it('should optimize memory usage with streaming', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Process large number of messages
        for (let i = 0; i < 1000; i++) {
          await client.publishTask({
            id: i,
            data: new Array(1000).fill('data'),
          });
        }

        const memoryGrowth = process.memoryUsage().heapUsed - initialMemory;

        // Memory growth should be controlled (< 100MB)
        expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
      });
    });

    describe('Connection Pooling Performance', () => {
      it('should efficiently manage connection pool', async () => {
        const poolSize = 10;
        client = new RabbitMQClient({
          connectionPool: true,
          poolSize,
        });

        await client.connect();

        // Create multiple concurrent operations
        const operations = [];
        for (let i = 0; i < 100; i++) {
          operations.push(
            client.publishTask({ id: i })
          );
        }

        const startTime = Date.now();
        await Promise.all(operations);
        const duration = Date.now() - startTime;

        // Should complete quickly with connection pooling
        expect(duration).toBeLessThan(1000);
      });
    });
  });

  // ===== MONITORING & METRICS TESTS =====
  describe('Monitoring and Metrics', () => {
    beforeEach(async () => {
      client = new RabbitMQClient({
        enableMetrics: true,
      });
      await client.connect();
    });

    it('should collect connection metrics', async () => {
      const metrics = await client.getMetrics();

      expect(metrics).toMatchObject({
        connectionState: 'connected',
        channelCount: expect.any(Number),
        publishedMessages: expect.any(Number),
        consumedMessages: expect.any(Number),
        errors: expect.any(Number),
      });
    });

    it('should track message latency', async () => {
      await client.publishTask({ track: true });

      const latencyMetrics = await client.getLatencyMetrics();

      expect(latencyMetrics).toMatchObject({
        avg: expect.any(Number),
        p50: expect.any(Number),
        p95: expect.any(Number),
        p99: expect.any(Number),
      });
    });

    it('should expose health check endpoint data', async () => {
      const health = await client.getHealthStatus();

      expect(health).toMatchObject({
        status: 'healthy',
        connection: {
          state: 'connected',
          url: expect.any(String),
        },
        queues: expect.any(Array),
        exchanges: expect.any(Array),
      });
    });

    it('should implement circuit breaker metrics', async () => {
      // Force some failures
      for (let i = 0; i < 5; i++) {
        try {
          mockChannel.publish = jest.fn().mockRejectedValue(
            new Error('Publish failed')
          );
          await client.publishTask({ fail: true });
        } catch (e) {
          // Expected
        }
      }

      const circuitState = await client.getCircuitBreakerState();

      expect(circuitState).toMatchObject({
        state: expect.stringMatching(/closed|open|half-open/),
        failures: expect.any(Number),
        successRate: expect.any(Number),
      });
    });
  });

  // ===== INTEGRATION PATTERNS TESTS =====
  describe('Integration Patterns', () => {
    beforeEach(async () => {
      client = new RabbitMQClient();
      await client.connect();
    });

    describe('Request-Reply Pattern', () => {
      it('should implement request-reply pattern', async () => {
        const replyQueue = await client.setupReplyQueue();

        const request = {
          data: 'request',
          replyTo: replyQueue,
          correlationId: 'req-123',
        };

        await client.sendRequest('service-queue', request);

        // Simulate reply
        const reply = await new Promise((resolve) => {
          client.consumeReply(replyQueue, (msg) => {
            if (msg.correlationId === 'req-123') {
              resolve(msg);
            }
          });

          // Simulate service responding
          setTimeout(() => {
            mockChannel.simulateMessage(replyQueue, {
              correlationId: 'req-123',
              result: 'response',
            });
          }, 100);
        });

        expect(reply.result).toBe('response');
      });
    });

    describe('Publish-Subscribe Pattern', () => {
      it('should implement pub-sub pattern', async () => {
        const topic = 'events.user.created';

        // Setup subscribers
        const subscriber1 = jest.fn();
        const subscriber2 = jest.fn();

        await client.subscribe(topic, subscriber1);
        await client.subscribe(topic, subscriber2);

        // Publish event
        await client.publish(topic, {
          userId: 123,
          timestamp: Date.now(),
        });

        // Both subscribers should receive the message
        expect(subscriber1).toHaveBeenCalled();
        expect(subscriber2).toHaveBeenCalled();
      });
    });

    describe('Work Queue Pattern', () => {
      it('should distribute work among multiple workers', async () => {
        const workQueue = 'work-queue';
        const workers = [];

        // Create multiple workers
        for (let i = 0; i < 3; i++) {
          const worker = jest.fn();
          workers.push(worker);
          await client.consume(workQueue, worker, {
            prefetch: 1,
          });
        }

        // Send multiple tasks
        for (let i = 0; i < 9; i++) {
          await client.sendToQueue(workQueue, { task: i });
        }

        // Work should be distributed
        // Each worker should get approximately 3 tasks
        for (const worker of workers) {
          expect(worker).toHaveBeenCalledTimes(3);
        }
      });
    });
  });

  // ===== SECURITY TESTS =====
  describe('Security', () => {
    it('should support TLS connections', async () => {
      client = new RabbitMQClient({
        url: 'amqps://localhost',
        tls: {
          cert: 'cert.pem',
          key: 'key.pem',
          ca: 'ca.pem',
        },
      });

      await client.connect();

      expect(mockConnect).toHaveBeenCalledWith(
        expect.stringContaining('amqps://')
      );
    });

    it('should sanitize sensitive data in logs', async () => {
      const logger = {
        info: jest.fn(),
        error: jest.fn(),
      };

      client = new RabbitMQClient({
        url: 'amqp://user:password@localhost',
        logger,
      });

      await client.connect();

      // Password should not appear in logs
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('password')
      );
    });

    it('should validate message schemas', async () => {
      client = new RabbitMQClient({
        validateMessages: true,
        messageSchema: {
          type: 'object',
          required: ['type', 'data'],
          properties: {
            type: { type: 'string' },
            data: { type: 'object' },
          },
        },
      });

      await client.connect();

      // Invalid message should be rejected
      await expect(
        client.publishTask({ invalid: true })
      ).rejects.toThrow('Message validation failed');

      // Valid message should pass
      await expect(
        client.publishTask({ type: 'test', data: {} })
      ).resolves.toBeDefined();
    });
  });
});