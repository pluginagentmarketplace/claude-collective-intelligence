/**
 * RabbitMQ Integration Example
 * Demonstrates how to integrate logging with RabbitMQ operations
 */

const amqp = require('amqplib');
const { log, rabbitMqContext, modules } = require('../src/logger');
const { mq: mqLogger } = modules;

/**
 * RabbitMQ Manager with Integrated Logging
 */
class RabbitMQManager {
  constructor(config = {}) {
    this.config = {
      url: config.url || 'amqp://localhost',
      exchange: config.exchange || 'agent-exchange',
      prefetch: config.prefetch || 10,
      heartbeat: config.heartbeat || 60,
      ...config
    };

    this.logger = log.child('rabbitmq', {
      exchange: this.config.exchange
    });

    this.connection = null;
    this.channel = null;
    this.consumers = new Map();
  }

  /**
   * Connect to RabbitMQ with logging
   */
  async connect() {
    try {
      this.logger.info('Connecting to RabbitMQ', {
        url: this.config.url.replace(/:[^:]*@/, ':***@')
      });

      // Establish connection
      this.connection = await amqp.connect(this.config.url, {
        heartbeat: this.config.heartbeat
      });

      // Log successful connection
      mqLogger.logConnection('connected', this.config.url, {
        vhost: this.connection.connection.vhost,
        heartbeat: this.config.heartbeat
      });

      // Set up connection event handlers
      this.connection.on('error', (err) => {
        mqLogger.logConnectionError(err);
      });

      this.connection.on('close', () => {
        mqLogger.logConnection('closed', this.config.url);
        this.reconnect();
      });

      // Create channel
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(this.config.prefetch);

      mqLogger.logChannel('created', 'default', {
        prefetch: this.config.prefetch
      });

      // Setup exchanges and queues
      await this.setupInfrastructure();

      this.logger.info('RabbitMQ connected and configured successfully');

      return true;

    } catch (error) {
      mqLogger.logConnectionError(error);
      throw error;
    }
  }

  /**
   * Setup exchanges and queues with logging
   */
  async setupInfrastructure() {
    const startTime = Date.now();

    try {
      // Assert exchange
      await this.channel.assertExchange(this.config.exchange, 'topic', {
        durable: true
      });

      this.logger.debug('Exchange asserted', {
        exchange: this.config.exchange,
        type: 'topic'
      });

      // Setup common queues
      const queues = [
        'agent.tasks',
        'agent.responses',
        'voting.sessions',
        'system.events'
      ];

      for (const queueName of queues) {
        const { queue } = await this.channel.assertQueue(queueName, {
          durable: true,
          arguments: {
            'x-message-ttl': 3600000, // 1 hour
            'x-max-length': 10000
          }
        });

        // Bind queue to exchange
        await this.channel.bindQueue(
          queue,
          this.config.exchange,
          `${queueName}.*`
        );

        this.logger.debug('Queue configured', {
          queue,
          routingPattern: `${queueName}.*`
        });
      }

      const duration = Date.now() - startTime;
      this.logger.info('Infrastructure setup completed', {
        duration,
        queues: queues.length
      });

    } catch (error) {
      this.logger.error('Infrastructure setup failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Publish message with logging
   */
  async publish(routingKey, message, options = {}) {
    const messageId = options.messageId || require('crypto').randomUUID();
    const correlationId = options.correlationId || require('crypto').randomUUID();

    const publishOptions = {
      persistent: true,
      messageId,
      correlationId,
      timestamp: Date.now(),
      contentType: 'application/json',
      ...options
    };

    try {
      // Log before publishing
      mqLogger.logPublish(
        this.config.exchange,
        routingKey,
        message,
        publishOptions
      );

      // Publish message
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const published = this.channel.publish(
        this.config.exchange,
        routingKey,
        messageBuffer,
        publishOptions
      );

      if (!published) {
        this.logger.warn('Message publish blocked by backpressure', {
          routingKey,
          messageId
        });
      }

      this.logger.debug('Message published successfully', {
        messageId,
        correlationId,
        routingKey
      });

      return { messageId, correlationId, published };

    } catch (error) {
      this.logger.error('Failed to publish message', {
        error: error.message,
        routingKey,
        messageId
      });
      throw error;
    }
  }

  /**
   * Consume messages with logging context
   */
  async consume(queueName, handler, options = {}) {
    try {
      const consumerTag = options.consumerTag || `consumer-${Date.now()}`;

      this.logger.info('Starting consumer', {
        queue: queueName,
        consumerTag
      });

      const { consumerTag: tag } = await this.channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          const startTime = Date.now();

          // Use RabbitMQ context for message processing
          await rabbitMqContext(msg, async (message, context) => {
            try {
              // Parse message content
              const content = JSON.parse(message.content.toString());

              this.logger.debug('Processing message', {
                queue: queueName,
                messageId: context.messageId,
                correlationId: context.correlationId,
                redelivered: context.redelivered
              });

              // Call handler with content and context
              await handler(content, context, message);

              // Acknowledge message
              this.channel.ack(msg);
              mqLogger.logAck(msg.fields.deliveryTag);

              // Log successful consumption
              const processingTime = Date.now() - startTime;
              mqLogger.logConsume(queueName, msg, processingTime);

            } catch (error) {
              const processingTime = Date.now() - startTime;

              this.logger.error('Message processing failed', {
                error: error.message,
                queue: queueName,
                messageId: context.messageId,
                processingTime
              });

              // Reject message with requeue based on error type
              const shouldRequeue = !error.fatal;
              this.channel.nack(msg, false, shouldRequeue);

              mqLogger.logNack(
                msg.fields.deliveryTag,
                shouldRequeue,
                error.message
              );
            }
          });
        },
        {
          consumerTag,
          noAck: false,
          ...options
        }
      );

      this.consumers.set(queueName, tag);

      this.logger.info('Consumer started successfully', {
        queue: queueName,
        consumerTag: tag
      });

      return tag;

    } catch (error) {
      this.logger.error('Failed to start consumer', {
        error: error.message,
        queue: queueName
      });
      throw error;
    }
  }

  /**
   * Get queue metrics with logging
   */
  async getQueueMetrics(queueName) {
    try {
      const { messageCount, consumerCount } = await this.channel.checkQueue(queueName);

      const metrics = {
        messageCount,
        consumerCount,
        messagesReady: messageCount,
        messagesUnacknowledged: 0 // Would need additional API call
      };

      mqLogger.logQueueMetrics(queueName, metrics);

      return metrics;

    } catch (error) {
      this.logger.error('Failed to get queue metrics', {
        error: error.message,
        queue: queueName
      });
      throw error;
    }
  }

  /**
   * Reconnect with exponential backoff and logging
   */
  async reconnect() {
    let attempt = 1;
    const maxAttempts = 5;
    const baseDelay = 1000;

    while (attempt <= maxAttempts) {
      const delay = baseDelay * Math.pow(2, attempt - 1);

      mqLogger.logRetry(attempt, maxAttempts, delay);

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        await this.connect();
        this.logger.info('Reconnection successful', { attempt });
        return;
      } catch (error) {
        this.logger.error('Reconnection attempt failed', {
          attempt,
          maxAttempts,
          error: error.message
        });
      }

      attempt++;
    }

    this.logger.error('All reconnection attempts failed', { maxAttempts });
    throw new Error('Failed to reconnect to RabbitMQ');
  }

  /**
   * Close connection with logging
   */
  async close() {
    try {
      // Cancel all consumers
      for (const [queue, tag] of this.consumers) {
        await this.channel.cancel(tag);
        this.logger.debug('Consumer cancelled', { queue, consumerTag: tag });
      }

      // Close channel and connection
      if (this.channel) {
        await this.channel.close();
        mqLogger.logChannel('closed', 'default');
      }

      if (this.connection) {
        await this.connection.close();
        mqLogger.logConnection('disconnected', this.config.url);
      }

      this.logger.info('RabbitMQ connection closed successfully');

    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection', {
        error: error.message
      });
    }
  }

  /**
   * Implement RPC pattern with logging
   */
  async rpcCall(method, params, timeout = 30000) {
    const correlationId = require('crypto').randomUUID();
    const replyQueue = await this.channel.assertQueue('', { exclusive: true });

    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        this.logger.error('RPC call timeout', {
          method,
          correlationId,
          timeout
        });
        reject(new Error('RPC timeout'));
      }, timeout);

      // Set up reply consumer
      await this.channel.consume(
        replyQueue.queue,
        (msg) => {
          if (msg.properties.correlationId === correlationId) {
            clearTimeout(timer);
            const response = JSON.parse(msg.content.toString());

            this.logger.debug('RPC response received', {
              method,
              correlationId,
              responseTime: Date.now() - startTime
            });

            resolve(response);
          }
        },
        { noAck: true }
      );

      const startTime = Date.now();

      // Send RPC request
      await this.publish('rpc.request', {
        method,
        params
      }, {
        correlationId,
        replyTo: replyQueue.queue
      });

      this.logger.debug('RPC request sent', {
        method,
        correlationId,
        replyTo: replyQueue.queue
      });
    });
  }
}

/**
 * Usage Example
 */
async function example() {
  // Initialize logging
  const { initializeLogging } = require('../src/logger');
  await initializeLogging({
    level: 'debug',
    enableMetrics: true
  });

  const manager = new RabbitMQManager({
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    exchange: 'test-exchange'
  });

  try {
    // Connect to RabbitMQ
    await manager.connect();

    // Publish a message
    const { messageId } = await manager.publish('agent.tasks.new', {
      type: 'RESEARCH',
      query: 'AI trends',
      priority: 'high'
    });

    log.info('Task published', { messageId });

    // Set up consumer
    await manager.consume('agent.tasks', async (content, context) => {
      log.info('Processing task', {
        taskType: content.type,
        correlationId: context.correlationId
      });

      // Simulate task processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Publish response
      await manager.publish('agent.responses', {
        taskId: context.messageId,
        result: 'Task completed successfully'
      }, {
        correlationId: context.correlationId
      });
    });

    // Get queue metrics
    const metrics = await manager.getQueueMetrics('agent.tasks');
    log.info('Queue metrics', metrics);

    // Make RPC call
    const rpcResult = await manager.rpcCall('getAgentStatus', {
      agentId: 'agent-1'
    });

    log.info('RPC result', rpcResult);

    // Keep running for demo
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    log.exception(error, 'RabbitMQ example failed');
  } finally {
    await manager.close();
  }
}

// Export for use in other modules
module.exports = {
  RabbitMQManager,
  example
};

// Run example if executed directly
if (require.main === module) {
  example()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}