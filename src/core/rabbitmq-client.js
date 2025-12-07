#!/usr/bin/env node
/**
 * RabbitMQ Client for Multi-Agent Orchestration
 * Handles connection, queues, exchanges, and message routing
 */

import amqp from 'amqplib';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export class RabbitMQClient extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      heartbeat: parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 30,
      autoReconnect: process.env.AUTO_RECONNECT !== 'false',
      prefetchCount: parseInt(process.env.PREFETCH_COUNT, 10) || 1,
      ...config
    };

    this.connection = null;
    this.channel = null;
    this.agentId = process.env.AGENT_ID || `agent-${uuidv4()}`;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * Connect to RabbitMQ and setup channel
   */
  async connect() {
    try {
      console.log(`🔌 Connecting to RabbitMQ: ${this.config.url}`);

      this.connection = await amqp.connect(this.config.url, {
        heartbeat: this.config.heartbeat
      });

      this.connection.on('error', (err) => {
        console.error('❌ Connection error:', err);
        this.emit('error', err);
      });

      this.connection.on('close', () => {
        console.log('🔌 Connection closed');
        this.isConnected = false;
        this.emit('disconnected');

        if (this.config.autoReconnect) {
          this.reconnect();
        }
      });

      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(this.config.prefetchCount);

      this.channel.on('error', (err) => {
        console.error('❌ Channel error:', err);
        this.emit('error', err);
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log(`✅ Connected to RabbitMQ as agent: ${this.agentId}`);
      this.emit('connected');

      return this;
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Reconnect with exponential backoff
   */
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached');
      this.emit('max_reconnect_reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();
    } catch (error) {
      console.error('❌ Reconnect failed:', error);
      await this.reconnect();
    }
  }

  /**
   * Setup task queue for work distribution
   */
  async setupTaskQueue(queueName = 'agent.tasks') {
    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1 hour
        'x-max-length': 10000
      }
    });

    console.log(`📋 Task queue ready: ${queueName}`);
    return queueName;
  }

  /**
   * Setup brainstorm exchange (fanout for multi-agent collaboration)
   */
  async setupBrainstormExchange(exchangeName = 'agent.brainstorm') {
    await this.channel.assertExchange(exchangeName, 'fanout', {
      durable: true
    });

    // Create unique queue for this agent
    const queueName = `brainstorm.${this.agentId}`;
    await this.channel.assertQueue(queueName, {
      exclusive: true,
      autoDelete: true
    });

    await this.channel.bindQueue(queueName, exchangeName, '');

    console.log(`🧠 Brainstorm exchange ready: ${exchangeName}`);
    return { exchangeName, queueName };
  }

  /**
   * Setup result queue for aggregation
   */
  async setupResultQueue(queueName = 'agent.results') {
    await this.channel.assertQueue(queueName, {
      durable: true
    });

    console.log(`📊 Result queue ready: ${queueName}`);
    return queueName;
  }

  /**
   * Setup status exchange (topic for selective broadcasting)
   */
  async setupStatusExchange(exchangeName = 'agent.status') {
    await this.channel.assertExchange(exchangeName, 'topic', {
      durable: true
    });

    console.log(`📡 Status exchange ready: ${exchangeName}`);
    return exchangeName;
  }

  /**
   * Publish task to queue
   */
  async publishTask(task, queueName = 'agent.tasks') {
    const message = {
      id: uuidv4(),
      type: 'task',
      from: this.agentId,
      timestamp: Date.now(),
      task
    };

    const sent = this.channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: message.id
      }
    );

    console.log(`📤 Published task: ${message.id}`);
    return message.id;
  }

  /**
   * Consume tasks from queue
   */
  async consumeTasks(queueName = 'agent.tasks', handler) {
    console.log(`👂 Listening for tasks on: ${queueName}`);

    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        console.log(`📥 Received task: ${content.id}`);

        await handler(content, {
          ack: () => this.channel.ack(msg),
          nack: (requeue = false) => this.channel.nack(msg, false, requeue),
          reject: () => this.channel.reject(msg, false)
        });
      } catch (error) {
        console.error('❌ Task handling error:', error);
        this.channel.nack(msg, false, false);
      }
    }, {
      noAck: false
    });
  }

  /**
   * Broadcast brainstorm message
   */
  async broadcastBrainstorm(message, exchangeName = 'agent.brainstorm') {
    const msg = {
      id: uuidv4(),
      type: 'brainstorm',
      from: this.agentId,
      timestamp: Date.now(),
      message
    };

    this.channel.publish(
      exchangeName,
      '',
      Buffer.from(JSON.stringify(msg)),
      {
        contentType: 'application/json',
        messageId: msg.id
      }
    );

    console.log(`🧠 Broadcasted brainstorm: ${msg.id}`);
    return msg.id;
  }

  /**
   * Listen to brainstorm messages
   */
  async listenBrainstorm(queueName, handler) {
    console.log(`👂 Listening for brainstorm on: ${queueName}`);

    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());

        // Ignore own messages
        if (content.from === this.agentId) {
          this.channel.ack(msg);
          return;
        }

        console.log(`🧠 Received brainstorm from ${content.from}: ${content.id}`);
        await handler(content);
        this.channel.ack(msg);
      } catch (error) {
        console.error('❌ Brainstorm handling error:', error);
        this.channel.ack(msg);
      }
    });
  }

  /**
   * Publish result
   */
  async publishResult(result, queueName = 'agent.results') {
    const message = {
      id: uuidv4(),
      type: 'result',
      from: this.agentId,
      timestamp: Date.now(),
      result
    };

    this.channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: message.id
      }
    );

    console.log(`📊 Published result: ${message.id}`);
    return message.id;
  }

  /**
   * Consume results
   */
  async consumeResults(queueName = 'agent.results', handler) {
    console.log(`👂 Listening for results on: ${queueName}`);

    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        console.log(`📊 Received result from ${content.from}: ${content.id}`);

        await handler(content);
        this.channel.ack(msg);
      } catch (error) {
        console.error('❌ Result handling error:', error);
        this.channel.ack(msg);
      }
    });
  }

  /**
   * Publish status update
   */
  async publishStatus(status, routingKey = 'agent.status.info', exchangeName = 'agent.status') {
    const message = {
      id: uuidv4(),
      type: 'status',
      from: this.agentId,
      timestamp: Date.now(),
      status
    };

    this.channel.publish(
      exchangeName,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        contentType: 'application/json',
        messageId: message.id
      }
    );

    return message.id;
  }

  /**
   * Subscribe to status updates
   */
  async subscribeStatus(pattern = 'agent.status.#', exchangeName = 'agent.status', handler) {
    const queueName = `status.${this.agentId}`;

    await this.channel.assertQueue(queueName, {
      exclusive: true,
      autoDelete: true
    });

    await this.channel.bindQueue(queueName, exchangeName, pattern);

    console.log(`📡 Subscribed to status: ${pattern}`);

    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        this.channel.ack(msg);
      } catch (error) {
        console.error('❌ Status handling error:', error);
        this.channel.ack(msg);
      }
    });
  }

  /**
   * Close connection
   */
  async close() {
    console.log('🔌 Closing connection...');

    if (this.channel) {
      await this.channel.close();
    }

    if (this.connection) {
      await this.connection.close();
    }

    this.isConnected = false;
    console.log('✅ Connection closed');
  }

  /**
   * Health check
   */
  isHealthy() {
    return this.isConnected && this.connection && this.channel;
  }
}

export default RabbitMQClient;
