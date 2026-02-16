/**
 * Validation Middleware
 *
 * RabbitMQ message validation middleware with error handling,
 * logging, and automatic retry logic
 */

import { MessageValidator } from '../validators/message-validator.js';
import { PayloadValidator } from '../validators/payload-validator.js';
import { sanitizeMessage } from '../sanitizers/sanitizer.js';
import { EventEmitter } from 'events';

/**
 * Validation Middleware Class
 */
export class ValidationMiddleware extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enabled: true,
      sanitize: true,
      strict: false,
      logErrors: true,
      rejectInvalid: true,
      deadLetterInvalid: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };

    this.messageValidator = new MessageValidator({
      sanitize: this.options.sanitize,
      stripUnknown: !this.options.strict
    });

    this.payloadValidator = new PayloadValidator({
      strictMode: this.options.strict
    });

    this.stats = {
      processed: 0,
      valid: 0,
      invalid: 0,
      sanitized: 0,
      rejected: 0,
      retried: 0
    };

    this.errorLog = [];
  }

  /**
   * Create middleware function for RabbitMQ consumer
   * @returns {Function} Middleware function
   */
  createConsumerMiddleware() {
    return async (msg, channel, next) => {
      if (!this.options.enabled) {
        return next(msg, channel);
      }

      try {
        const result = await this.processMessage(msg, channel);

        if (result.valid) {
          // Replace message content with validated/sanitized version
          msg.validatedContent = result.value;
          msg.validation = {
            validated: true,
            type: result.type,
            sanitized: result.sanitized
          };

          return next(msg, channel);
        } else {
          return this.handleInvalidMessage(msg, channel, result.error, next);
        }
      } catch (error) {
        return this.handleError(msg, channel, error, next);
      }
    };
  }

  /**
   * Process and validate message
   * @param {Object} msg - RabbitMQ message
   * @param {Object} channel - RabbitMQ channel
   * @returns {Object} Validation result
   */
  async processMessage(msg, channel) {
    this.stats.processed++;

    // Parse message content
    let content;
    try {
      content = JSON.parse(msg.content.toString());
    } catch (error) {
      return {
        valid: false,
        error: {
          code: 'PARSE_ERROR',
          message: 'Invalid JSON in message content'
        }
      };
    }

    // Sanitize if enabled
    let processedContent = content;
    if (this.options.sanitize) {
      processedContent = await sanitizeMessage(content);
      this.stats.sanitized++;
    }

    // Validate message structure
    const messageValidation = await this.messageValidator.validate(processedContent);

    if (!messageValidation.valid) {
      this.stats.invalid++;
      return messageValidation;
    }

    // Validate payload
    const payloadValidation = await this.payloadValidator.validate(
      messageValidation.value.payload || messageValidation.value
    );

    if (!payloadValidation.valid) {
      this.stats.invalid++;
      return payloadValidation;
    }

    this.stats.valid++;

    return {
      valid: true,
      value: messageValidation.value,
      type: messageValidation.type,
      sanitized: this.options.sanitize
    };
  }

  /**
   * Handle invalid message
   * @param {Object} msg - RabbitMQ message
   * @param {Object} channel - RabbitMQ channel
   * @param {Object} error - Validation error
   * @param {Function} next - Next middleware function
   */
  async handleInvalidMessage(msg, channel, error, next) {
    // Log error
    if (this.options.logErrors) {
      this.logError(msg, error);
    }

    // Emit event
    this.emit('validation:failed', {
      message: msg,
      error,
      timestamp: new Date().toISOString()
    });

    // Check retry count
    const retryCount = this.getRetryCount(msg);

    if (retryCount < this.options.maxRetries) {
      // Retry message
      return this.retryMessage(msg, channel, retryCount + 1);
    }

    // Handle based on options
    if (this.options.deadLetterInvalid) {
      // Send to dead letter queue
      return this.deadLetterMessage(msg, channel, error);
    } else if (this.options.rejectInvalid) {
      // Reject message
      this.stats.rejected++;
      channel.reject(msg, false);
      return;
    } else {
      // Pass through with error attached
      msg.validationError = error;
      return next(msg, channel);
    }
  }

  /**
   * Handle middleware error
   * @param {Object} msg - RabbitMQ message
   * @param {Object} channel - RabbitMQ channel
   * @param {Error} error - Error object
   * @param {Function} next - Next middleware function
   */
  async handleError(msg, channel, error, next) {
    console.error('Validation middleware error:', error);

    this.emit('middleware:error', {
      message: msg,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Pass through on error if not strict
    if (!this.options.strict) {
      msg.validationError = {
        code: 'MIDDLEWARE_ERROR',
        message: error.message
      };
      return next(msg, channel);
    }

    // Reject in strict mode
    channel.reject(msg, false);
  }

  /**
   * Retry message with delay
   * @param {Object} msg - RabbitMQ message
   * @param {Object} channel - RabbitMQ channel
   * @param {number} retryCount - Current retry count
   */
  async retryMessage(msg, channel, retryCount) {
    this.stats.retried++;

    // Add retry headers
    const headers = msg.properties.headers || {};
    headers['x-retry-count'] = retryCount;
    headers['x-retry-at'] = new Date().toISOString();

    // Calculate delay with exponential backoff
    const delay = this.options.retryDelay * Math.pow(2, retryCount - 1);

    setTimeout(() => {
      // Republish message
      channel.publish(
        msg.fields.exchange || '',
        msg.fields.routingKey,
        msg.content,
        {
          ...msg.properties,
          headers,
          expiration: String(delay)
        }
      );

      // Acknowledge original
      channel.ack(msg);
    }, delay);

    this.emit('message:retried', {
      message: msg,
      retryCount,
      delay,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send message to dead letter queue
   * @param {Object} msg - RabbitMQ message
   * @param {Object} channel - RabbitMQ channel
   * @param {Object} error - Validation error
   */
  async deadLetterMessage(msg, channel, error) {
    const deadLetterExchange = 'dlx.validation';
    const deadLetterQueue = 'dlq.validation';

    try {
      // Ensure dead letter exchange exists
      await channel.assertExchange(deadLetterExchange, 'topic', { durable: true });
      await channel.assertQueue(deadLetterQueue, { durable: true });
      await channel.bindQueue(deadLetterQueue, deadLetterExchange, '#');

      // Add error headers
      const headers = msg.properties.headers || {};
      headers['x-death-reason'] = 'validation-failed';
      headers['x-death-error'] = JSON.stringify(error);
      headers['x-death-time'] = new Date().toISOString();

      // Publish to dead letter exchange
      channel.publish(
        deadLetterExchange,
        msg.fields.routingKey || 'unknown',
        msg.content,
        {
          ...msg.properties,
          headers
        }
      );

      // Acknowledge original
      channel.ack(msg);

      this.emit('message:deadlettered', {
        message: msg,
        error,
        timestamp: new Date().toISOString()
      });
    } catch (dlError) {
      console.error('Failed to dead letter message:', dlError);
      // Reject without requeue as last resort
      channel.reject(msg, false);
    }
  }

  /**
   * Get retry count from message headers
   * @param {Object} msg - RabbitMQ message
   * @returns {number} Retry count
   */
  getRetryCount(msg) {
    return msg.properties?.headers?.['x-retry-count'] || 0;
  }

  /**
   * Log validation error
   * @param {Object} msg - RabbitMQ message
   * @param {Object} error - Validation error
   */
  logError(msg, error) {
    const entry = {
      timestamp: new Date().toISOString(),
      messageId: msg.properties?.messageId,
      routingKey: msg.fields?.routingKey,
      error,
      content: msg.content.toString().substring(0, 200)
    };

    this.errorLog.push(entry);

    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    console.error('Message validation failed:', entry);
  }

  /**
   * Create publisher middleware
   * @returns {Function} Middleware function
   */
  createPublisherMiddleware() {
    return async (exchange, routingKey, content, options = {}) => {
      if (!this.options.enabled) {
        return { valid: true, content, options };
      }

      try {
        // Parse content if it's a buffer
        let message = content;
        if (Buffer.isBuffer(content)) {
          message = JSON.parse(content.toString());
        }

        // Validate message
        const result = await this.messageValidator.validate(message);

        if (!result.valid) {
          if (this.options.rejectInvalid) {
            throw new Error(`Invalid message: ${JSON.stringify(result.error)}`);
          }
          // Log but allow in non-reject mode
          console.warn('Publishing invalid message:', result.error);
        }

        // Return validated content
        return {
          valid: result.valid,
          content: Buffer.from(JSON.stringify(result.value || message)),
          options: {
            ...options,
            headers: {
              ...options.headers,
              'x-validated': result.valid,
              'x-validated-at': new Date().toISOString()
            }
          }
        };
      } catch (error) {
        if (this.options.strict) {
          throw error;
        }
        // Return original in non-strict mode
        return { valid: false, content, options, error };
      }
    };
  }

  /**
   * Get middleware statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      validRate: this.stats.processed > 0
        ? (this.stats.valid / this.stats.processed) * 100
        : 0,
      recentErrors: this.errorLog.slice(-10)
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      processed: 0,
      valid: 0,
      invalid: 0,
      sanitized: 0,
      rejected: 0,
      retried: 0
    };
    this.errorLog = [];
  }
}

/**
 * Create validation middleware for RabbitMQ
 * @param {Object} options - Middleware options
 * @returns {Object} Middleware functions
 */
export function createValidationMiddleware(options = {}) {
  const middleware = new ValidationMiddleware(options);

  return {
    consumer: middleware.createConsumerMiddleware(),
    publisher: middleware.createPublisherMiddleware(),
    instance: middleware
  };
}

/**
 * Export default middleware
 */
export default ValidationMiddleware;