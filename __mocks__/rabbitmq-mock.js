/**
 * Reusable RabbitMQ Mock
 * Comprehensive mock implementation for testing
 */

import { EventEmitter } from 'events';

export class RabbitMQMock extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.connected = false;
    this.channels = new Map();
    this.queues = new Map();
    this.exchanges = new Map();
    this.consumers = new Map();
    this.messages = [];
    this.errorScenarios = {};
    this.metrics = {
      messagesPublished: 0,
      messagesConsumed: 0,
      errors: 0,
      reconnections: 0,
    };
  }

  // ==================== CONNECTION MANAGEMENT ====================

  async connect() {
    if (this.errorScenarios.connectionError) {
      this.metrics.errors++;
      throw new Error(this.errorScenarios.connectionError);
    }

    if (this.connected) {
      return; // Already connected
    }

    this.connected = true;
    this.emit('connected');
    return this;
  }

  async close() {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.channels.clear();
    this.consumers.clear();
    this.emit('disconnected');
  }

  async reconnect() {
    this.metrics.reconnections++;
    await this.close();
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.connect();
  }

  isHealthy() {
    return this.connected && !this.errorScenarios.unhealthy;
  }

  // ==================== CHANNEL MANAGEMENT ====================

  async createChannel() {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    if (this.errorScenarios.channelError) {
      throw new Error('Channel creation failed');
    }

    const channel = new ChannelMock(this);
    const channelId = `channel-${Date.now()}-${Math.random()}`;
    this.channels.set(channelId, channel);
    return channel;
  }

  async getChannel(name = 'default') {
    if (!this.channels.has(name)) {
      const channel = await this.createChannel();
      this.channels.set(name, channel);
    }
    return this.channels.get(name);
  }

  // ==================== QUEUE OPERATIONS ====================

  async setupQueue(queueName, options = {}) {
    if (this.errorScenarios.setupQueueError) {
      throw new Error('Queue setup failed');
    }

    this.queues.set(queueName, {
      name: queueName,
      options,
      messages: [],
      consumers: [],
    });

    return queueName;
  }

  async setupTaskQueue(queueName = 'agent.tasks') {
    return this.setupQueue(queueName, {
      durable: true,
      arguments: {
        'x-message-ttl': 300000,
        'x-max-length': 10000,
      },
    });
  }

  async deleteQueue(queueName) {
    this.queues.delete(queueName);
    return { messageCount: 0 };
  }

  // ==================== EXCHANGE OPERATIONS ====================

  async setupExchange(exchangeName, type = 'topic', options = {}) {
    if (this.errorScenarios.setupExchangeError) {
      throw new Error('Exchange setup failed');
    }

    this.exchanges.set(exchangeName, {
      name: exchangeName,
      type,
      options,
      bindings: new Set(),
    });

    return exchangeName;
  }

  async setupBrainstormExchange(exchangeName = 'agent.brainstorm', agentId = 'test-agent') {
    await this.setupExchange(exchangeName, 'fanout');
    const queueName = `brainstorm.${agentId}`;
    await this.setupQueue(queueName);
    return { exchangeName, queueName };
  }

  // ==================== PUBLISHING ====================

  async publishTask(task) {
    if (this.errorScenarios.publishError) {
      this.metrics.errors++;
      throw new Error('Publish failed');
    }

    const messageId = `msg-${Date.now()}-${Math.random()}`;
    const message = {
      ...task,
      messageId,
      timestamp: Date.now(),
    };

    this.messages.push(message);
    this.metrics.messagesPublished++;

    // Simulate routing to queue
    const queue = this.queues.get('agent.tasks');
    if (queue) {
      queue.messages.push(message);
      this._triggerConsumers('agent.tasks', message);
    }

    return messageId;
  }

  async publishResult(result) {
    return this.publishTask({ ...result, type: 'result' });
  }

  async broadcastBrainstorm(message) {
    const messageId = `broadcast-${Date.now()}`;

    // Send to all brainstorm queues
    for (const [queueName, queue] of this.queues.entries()) {
      if (queueName.startsWith('brainstorm.')) {
        queue.messages.push({ ...message, messageId });
        this._triggerConsumers(queueName, message);
      }
    }

    return messageId;
  }

  async publishWithRetry(queue, message, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.publishTask(message);
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }

    throw lastError;
  }

  // ==================== CONSUMPTION ====================

  async consumeTasks(callback, options = {}) {
    return this.consume('agent.tasks', callback, options);
  }

  async consume(queueName, callback, options = {}) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const consumerTag = `consumer-${Date.now()}`;

    this.consumers.set(consumerTag, {
      queue: queueName,
      callback,
      options,
    });

    const queue = this.queues.get(queueName);
    if (queue) {
      queue.consumers.push(consumerTag);
    }

    return { consumerTag };
  }

  async cancel(consumerTag) {
    const consumer = this.consumers.get(consumerTag);
    if (consumer) {
      const queue = this.queues.get(consumer.queue);
      if (queue) {
        queue.consumers = queue.consumers.filter(tag => tag !== consumerTag);
      }
      this.consumers.delete(consumerTag);
    }
  }

  _triggerConsumers(queueName, message) {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    for (const consumerTag of queue.consumers) {
      const consumer = this.consumers.get(consumerTag);
      if (consumer) {
        setImmediate(() => {
          try {
            consumer.callback(message);
            this.metrics.messagesConsumed++;
          } catch (error) {
            this.metrics.errors++;
            this.emit('consumerError', { consumerTag, error });
          }
        });
      }
    }
  }

  // ==================== TEST HELPERS ====================

  simulateError(scenario) {
    this.errorScenarios[scenario] = true;
  }

  clearErrors() {
    this.errorScenarios = {};
  }

  simulateIncomingMessage(queueName, message) {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.messages.push(message);
      this._triggerConsumers(queueName, message);
    }
  }

  simulateDisconnect() {
    this.connected = false;
    this.emit('disconnected');
    this.emit('error', new Error('Connection lost'));
  }

  async simulateReconnect() {
    await this.reconnect();
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getQueueDepth(queueName) {
    const queue = this.queues.get(queueName);
    return queue ? queue.messages.length : 0;
  }

  clearQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (queue) {
      queue.messages = [];
    }
  }

  getAllMessages() {
    return [...this.messages];
  }

  getConsumerCount() {
    return this.consumers.size;
  }

  reset() {
    this.connected = false;
    this.channels.clear();
    this.queues.clear();
    this.exchanges.clear();
    this.consumers.clear();
    this.messages = [];
    this.errorScenarios = {};
    this.metrics = {
      messagesPublished: 0,
      messagesConsumed: 0,
      errors: 0,
      reconnections: 0,
    };
  }
}

// ==================== CHANNEL MOCK ====================

class ChannelMock extends EventEmitter {
  constructor(connection) {
    super();
    this.connection = connection;
    this.closed = false;
    this.prefetchCount = 0;
    this.confirmMode = false;
  }

  async assertQueue(queue, options = {}) {
    if (this.closed) throw new Error('Channel is closed');

    await this.connection.setupQueue(queue, options);

    return {
      queue,
      messageCount: 0,
      consumerCount: 0,
    };
  }

  async assertExchange(exchange, type, options = {}) {
    if (this.closed) throw new Error('Channel is closed');

    await this.connection.setupExchange(exchange, type, options);
  }

  async bindQueue(queue, exchange, routingKey) {
    if (this.closed) throw new Error('Channel is closed');

    const ex = this.connection.exchanges.get(exchange);
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
    };

    this.connection.messages.push(message);
    this.connection.metrics.messagesPublished++;

    if (this.confirmMode) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 10);
      });
    }

    return true;
  }

  async sendToQueue(queue, content, options = {}) {
    return this.publish('', queue, content, options);
  }

  async consume(queue, onMessage, options = {}) {
    if (this.closed) throw new Error('Channel is closed');

    return this.connection.consume(queue, onMessage, options);
  }

  async cancel(consumerTag) {
    return this.connection.cancel(consumerTag);
  }

  async ack(message) {
    // Acknowledge message
    return true;
  }

  async nack(message, allUpTo = false, requeue = true) {
    // Negative acknowledge
    if (requeue) {
      // Requeue message logic
    }
    return true;
  }

  async prefetch(count) {
    this.prefetchCount = count;
  }

  async close() {
    this.closed = true;
    this.emit('close');
  }

  confirmSelect() {
    this.confirmMode = true;
  }
}

// ==================== FACTORY FUNCTIONS ====================

export function createMockRabbitMQClient(config = {}) {
  return new RabbitMQMock(config);
}

export function createMockChannel(connection) {
  return new ChannelMock(connection || createMockRabbitMQClient());
}

// ==================== DEFAULT EXPORT ====================

export default RabbitMQMock;