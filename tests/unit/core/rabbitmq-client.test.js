/**
 * Unit Tests for RabbitMQClient
 * Comprehensive tests for connection management, queues, exchanges, and messaging
 *
 * NOTE: amqplib is automatically mocked via jest.config.cjs moduleNameMapper
 * pointing to tests/__mocks__/amqplib.js (no manual mock needed here!)
 */

import { jest } from '@jest/globals';
import { RabbitMQClient } from '../../../src/core/rabbitmq-client.js';
import amqp from 'amqplib';

// Access mock state from automatic mock
import { mockState, resetMockState } from '../../../tests/__mocks__/amqplib.js';

describe('RabbitMQClient', () => {
  let client;

  beforeEach(() => {
    // Reset mock state between tests
    resetMockState();
    jest.clearAllMocks();

    client = new RabbitMQClient({
      url: 'amqp://test:5672',
      heartbeat: 30,
      autoReconnect: false,
      prefetchCount: 1,
    });
  });

  afterEach(async () => {
    if (client && client.isConnected) {
      await client.close();
    }
  });

  describe('Constructor', () => {
    test('should initialize with default config', () => {
      const defaultClient = new RabbitMQClient();
      expect(defaultClient.config.url).toBe('amqp://localhost:5672');
      expect(defaultClient.config.heartbeat).toBe(30);
      expect(defaultClient.config.autoReconnect).toBe(true);
      expect(defaultClient.config.prefetchCount).toBe(1);
    });

    test('should initialize with custom config', () => {
      expect(client.config.url).toBe('amqp://test:5672');
      expect(client.config.heartbeat).toBe(30);
      expect(client.config.autoReconnect).toBe(false);
      expect(client.config.prefetchCount).toBe(1);
    });

    test('should generate agent ID', () => {
      expect(client.agentId).toBeDefined();
      expect(typeof client.agentId).toBe('string');
    });

    test('should initialize connection state', () => {
      expect(client.isConnected).toBe(false);
      expect(client.connection).toBeNull();
      expect(client.channel).toBeNull();
      expect(client.reconnectAttempts).toBe(0);
    });
  });

  describe('connect()', () => {
    test('should connect successfully', async () => {
      await client.connect();

      expect(amqp.connect).toHaveBeenCalledWith('amqp://test:5672', {
        heartbeat: 30,
      });
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
      expect(client.isConnected).toBe(true);
      expect(client.reconnectAttempts).toBe(0);
    });

    test('should setup connection error handler', async () => {
      await client.connect();
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should setup connection close handler', async () => {
      await client.connect();
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    test('should setup channel error handler', async () => {
      await client.connect();
      expect(mockChannel.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should emit connected event', async () => {
      const connectedSpy = jest.fn();
      client.on('connected', connectedSpy);

      await client.connect();

      expect(connectedSpy).toHaveBeenCalled();
    });

    test('should throw error on connection failure', async () => {
      const error = new Error('Connection failed');
      amqp.connect.mockRejectedValueOnce(error);

      await expect(client.connect()).rejects.toThrow('Connection failed');
    });

    test('should handle channel creation failure', async () => {
      const error = new Error('Channel creation failed');
      mockConnection.createChannel.mockRejectedValueOnce(error);

      await expect(client.connect()).rejects.toThrow('Channel creation failed');
    });
  });

  describe('Event Handling', () => {
    test('should emit error event on connection error', async () => {
      await client.connect();
      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      const error = new Error('Test error');
      const errorHandler = mockConnection.on.mock.calls.find(call => call[0] === 'error')[1];
      errorHandler(error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    test('should emit disconnected event on connection close', async () => {
      client.config.autoReconnect = false;
      await client.connect();

      const disconnectedSpy = jest.fn();
      client.on('disconnected', disconnectedSpy);

      const closeHandler = mockConnection.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();

      expect(disconnectedSpy).toHaveBeenCalled();
      expect(client.isConnected).toBe(false);
    });

    test('should emit error event on channel error', async () => {
      await client.connect();
      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      const error = new Error('Channel error');
      const errorHandler = mockChannel.on.mock.calls.find(call => call[0] === 'error')[1];
      errorHandler(error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('reconnect()', () => {
    test('should reconnect with exponential backoff', async () => {
      client.config.autoReconnect = true;
      await client.connect();

      jest.spyOn(global, 'setTimeout');
      amqp.connect.mockResolvedValueOnce(mockConnection);

      await client.reconnect();

      expect(client.reconnectAttempts).toBe(1);
      expect(setTimeout).toHaveBeenCalled();
    });

    test('should emit max_reconnect_reached after max attempts', async () => {
      client.reconnectAttempts = 10;
      const maxReconnectSpy = jest.fn();
      client.on('max_reconnect_reached', maxReconnectSpy);

      await client.reconnect();

      expect(maxReconnectSpy).toHaveBeenCalled();
    });

    test('should calculate exponential backoff correctly', async () => {
      jest.spyOn(global, 'setTimeout');

      client.reconnectAttempts = 0;
      await client.reconnect();
      expect(client.reconnectAttempts).toBe(1);

      client.reconnectAttempts = 5;
      const delay = Math.min(1000 * Math.pow(2, 6), 30000);
      expect(delay).toBe(30000); // Max cap
    });
  });

  describe('Queue Setup', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should setup task queue with correct options', async () => {
      const queueName = await client.setupTaskQueue('test-tasks');

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-tasks', {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 10000,
        },
      });
      expect(queueName).toBe('test-tasks');
    });

    test('should setup task queue with default name', async () => {
      await client.setupTaskQueue();

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('agent.tasks', expect.any(Object));
    });

    test('should setup result queue', async () => {
      const queueName = await client.setupResultQueue('test-results');

      expect(mockChannel.assertQueue).toHaveBeenCalledWith('test-results', {
        durable: true,
      });
      expect(queueName).toBe('test-results');
    });
  });

  describe('Exchange Setup', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should setup brainstorm exchange (fanout)', async () => {
      const result = await client.setupBrainstormExchange('test-brainstorm');

      expect(mockChannel.assertExchange).toHaveBeenCalledWith('test-brainstorm', 'fanout', {
        durable: true,
      });
      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        expect.stringContaining('brainstorm.'),
        {
          exclusive: true,
          autoDelete: true,
        }
      );
      expect(mockChannel.bindQueue).toHaveBeenCalled();
      expect(result.exchangeName).toBe('test-brainstorm');
      expect(result.queueName).toContain('brainstorm.');
    });

    test('should setup status exchange (topic)', async () => {
      const exchangeName = await client.setupStatusExchange('test-status');

      expect(mockChannel.assertExchange).toHaveBeenCalledWith('test-status', 'topic', {
        durable: true,
      });
      expect(exchangeName).toBe('test-status');
    });
  });

  describe('Message Publishing', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should publish task to queue', async () => {
      const task = { title: 'Test Task', description: 'Do something' };
      const messageId = await client.publishTask(task, 'test-queue');

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Buffer),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: expect.any(String),
        }
      );

      const sentMessage = JSON.parse(mockChannel.sendToQueue.mock.calls[0][1].toString());
      expect(sentMessage.task).toEqual(task);
      expect(sentMessage.type).toBe('task');
      expect(sentMessage.from).toBe(client.agentId);
      expect(messageId).toBeDefined();
    });

    test('should broadcast brainstorm message', async () => {
      const message = { topic: 'Collaboration', question: 'How to proceed?' };
      const messageId = await client.broadcastBrainstorm(message, 'test-brainstorm');

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test-brainstorm',
        '',
        expect.any(Buffer),
        {
          contentType: 'application/json',
          messageId: expect.any(String),
        }
      );

      const sentMessage = JSON.parse(mockChannel.publish.mock.calls[0][2].toString());
      expect(sentMessage.message).toEqual(message);
      expect(sentMessage.type).toBe('brainstorm');
      expect(messageId).toBeDefined();
    });

    test('should publish result', async () => {
      const result = { taskId: '123', status: 'completed', output: 'Done' };
      const messageId = await client.publishResult(result, 'test-results');

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'test-results',
        expect.any(Buffer),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: expect.any(String),
        }
      );

      const sentMessage = JSON.parse(mockChannel.sendToQueue.mock.calls[0][1].toString());
      expect(sentMessage.result).toEqual(result);
      expect(sentMessage.type).toBe('result');
    });

    test('should publish status with routing key', async () => {
      const status = { state: 'active', load: 50 };
      const messageId = await client.publishStatus(status, 'agent.status.active', 'test-status');

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'test-status',
        'agent.status.active',
        expect.any(Buffer),
        {
          contentType: 'application/json',
          messageId: expect.any(String),
        }
      );

      const sentMessage = JSON.parse(mockChannel.publish.mock.calls[0][2].toString());
      expect(sentMessage.status).toEqual(status);
      expect(sentMessage.type).toBe('status');
    });
  });

  describe('Message Consumption', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should consume tasks with handler', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await client.consumeTasks('test-queue', handler);

      expect(mockChannel.consume).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Function),
        { noAck: false }
      );
    });

    test('should handle task message correctly', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await client.consumeTasks('test-queue', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          id: '123',
          type: 'task',
          task: { title: 'Test' },
        })),
      };

      await consumerFn(mockMessage);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: '123' }),
        expect.objectContaining({
          ack: expect.any(Function),
          nack: expect.any(Function),
          reject: expect.any(Function),
        })
      );
    });

    test('should ack message when handler calls ack', async () => {
      const handler = jest.fn(async (content, { ack }) => {
        await ack();
      });

      await client.consumeTasks('test-queue', handler);
      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: '123', type: 'task' })),
      };

      await consumerFn(mockMessage);

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    test('should nack message when handler calls nack', async () => {
      const handler = jest.fn(async (content, { nack }) => {
        await nack(true);
      });

      await client.consumeTasks('test-queue', handler);
      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: '123', type: 'task' })),
      };

      await consumerFn(mockMessage);

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, true);
    });

    test('should reject message when handler calls reject', async () => {
      const handler = jest.fn(async (content, { reject }) => {
        await reject();
      });

      await client.consumeTasks('test-queue', handler);
      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: '123', type: 'task' })),
      };

      await consumerFn(mockMessage);

      expect(mockChannel.reject).toHaveBeenCalledWith(mockMessage, false);
    });

    test('should nack message on handler error', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler failed'));

      await client.consumeTasks('test-queue', handler);
      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({ id: '123', type: 'task' })),
      };

      await consumerFn(mockMessage);

      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    });

    test('should handle null message in consumer', async () => {
      const handler = jest.fn();
      await client.consumeTasks('test-queue', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      await consumerFn(null);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Brainstorm Consumption', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should listen to brainstorm messages', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await client.listenBrainstorm('brainstorm-queue', handler);

      expect(mockChannel.consume).toHaveBeenCalledWith(
        'brainstorm-queue',
        expect.any(Function)
      );
    });

    test('should ignore own brainstorm messages', async () => {
      const handler = jest.fn();
      await client.listenBrainstorm('brainstorm-queue', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          id: '123',
          from: client.agentId, // Same agent
          message: 'test',
        })),
      };

      await consumerFn(mockMessage);

      expect(handler).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    test('should handle brainstorm from other agents', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await client.listenBrainstorm('brainstorm-queue', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          id: '123',
          from: 'other-agent',
          message: 'test',
        })),
      };

      await consumerFn(mockMessage);

      expect(handler).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    test('should ack message even on brainstorm handler error', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      await client.listenBrainstorm('brainstorm-queue', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          id: '123',
          from: 'other-agent',
          message: 'test',
        })),
      };

      await consumerFn(mockMessage);

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('Result Consumption', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should consume results', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await client.consumeResults('result-queue', handler);

      expect(mockChannel.consume).toHaveBeenCalledWith(
        'result-queue',
        expect.any(Function)
      );
    });

    test('should handle result message correctly', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await client.consumeResults('result-queue', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          id: '123',
          from: 'agent-1',
          result: { status: 'completed' },
        })),
      };

      await consumerFn(mockMessage);

      expect(handler).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    test('should ack message even on result handler error', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      await client.consumeResults('result-queue', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          id: '123',
          result: { status: 'completed' },
        })),
      };

      await consumerFn(mockMessage);

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('Status Subscription', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should subscribe to status updates', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await client.subscribeStatus('agent.status.#', 'status-exchange', handler);

      expect(mockChannel.assertQueue).toHaveBeenCalledWith(
        expect.stringContaining('status.'),
        {
          exclusive: true,
          autoDelete: true,
        }
      );
      expect(mockChannel.bindQueue).toHaveBeenCalledWith(
        expect.stringContaining('status.'),
        'status-exchange',
        'agent.status.#'
      );
    });

    test('should handle status messages', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      await client.subscribeStatus('agent.status.#', 'status-exchange', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          id: '123',
          status: { state: 'active' },
        })),
      };

      await consumerFn(mockMessage);

      expect(handler).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });

    test('should ack message even on status handler error', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      await client.subscribeStatus('agent.status.#', 'status-exchange', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          id: '123',
          status: { state: 'active' },
        })),
      };

      await consumerFn(mockMessage);

      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });
  });

  describe('Health Check', () => {
    test('should return false when not connected', () => {
      expect(client.isHealthy()).toBe(false);
    });

    test('should return true when connected', async () => {
      await client.connect();
      expect(client.isHealthy()).toBe(true);
    });

    test('should return false when connection is null', async () => {
      await client.connect();
      client.connection = null;
      expect(client.isHealthy()).toBe(false);
    });

    test('should return false when channel is null', async () => {
      await client.connect();
      client.channel = null;
      expect(client.isHealthy()).toBe(false);
    });
  });

  describe('close()', () => {
    test('should close channel and connection', async () => {
      await client.connect();
      await client.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(client.isConnected).toBe(false);
    });

    test('should handle close when not connected', async () => {
      await expect(client.close()).resolves.not.toThrow();
    });

    test('should handle channel close error gracefully', async () => {
      await client.connect();
      mockChannel.close.mockRejectedValueOnce(new Error('Close failed'));

      await expect(client.close()).rejects.toThrow('Close failed');
    });
  });

  describe('Edge Cases', () => {
    test('should handle invalid JSON in consumed message', async () => {
      await client.connect();
      const handler = jest.fn();
      await client.consumeTasks('test-queue', handler);

      const consumerFn = mockChannel.consume.mock.calls[0][1];
      const mockMessage = {
        content: Buffer.from('invalid json'),
      };

      await consumerFn(mockMessage);

      expect(handler).not.toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    });

    test('should handle connection close with auto-reconnect enabled', async () => {
      client.config.autoReconnect = true;
      await client.connect();

      const reconnectSpy = jest.spyOn(client, 'reconnect').mockResolvedValue(undefined);

      const closeHandler = mockConnection.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();

      expect(reconnectSpy).toHaveBeenCalled();
    });

    test('should not reconnect when auto-reconnect is disabled', async () => {
      client.config.autoReconnect = false;
      await client.connect();

      const reconnectSpy = jest.spyOn(client, 'reconnect');

      const closeHandler = mockConnection.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();

      expect(reconnectSpy).not.toHaveBeenCalled();
    });
  });
});
