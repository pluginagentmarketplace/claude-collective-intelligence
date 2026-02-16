/**
 * Message Validator
 *
 * Central message validation logic with type detection,
 * schema selection, and detailed error reporting
 */

import Joi from 'joi';
import { getSchema, hasSchema, SCHEMA_VERSIONS } from '../schemas/index.js';
import { sanitizeMessage } from '../sanitizers/sanitizer.js';

/**
 * Message Validator Class
 */
export class MessageValidator {
  constructor(options = {}) {
    this.options = {
      sanitize: true,
      stripUnknown: true,
      abortEarly: false,
      presence: 'required',
      allowUnknown: false,
      version: SCHEMA_VERSIONS.current,
      ...options
    };

    this.stats = {
      validated: 0,
      passed: 0,
      failed: 0,
      sanitized: 0,
      errors: []
    };

    // Cache for compiled schemas
    this.schemaCache = new Map();
  }

  /**
   * Identify message type from structure
   * @param {Object} message - Message to identify
   * @returns {string|null} Message type or null
   */
  identifyType(message) {
    if (!message || typeof message !== 'object') {
      return null;
    }

    // Check explicit type field
    if (message.type) {
      // Map message type to schema type
      const typeMapping = {
        'brainstorm': 'message.brainstorm',
        'status': 'message.status',
        'result': 'message.result',
        'command': 'message.command',
        'heartbeat': 'message.heartbeat',
        'notification': 'message.notification',
        'task': 'task.submit',
        'voting': 'voting.submit',
        'achievement': 'achievement.claim'
      };

      return typeMapping[message.type] || null;
    }

    // Try to infer type from structure
    if (message.taskId && message.status) return 'task.result';
    if (message.sessionId && message.vote) return 'voting.submit';
    if (message.agentId && message.achievementId) return 'achievement.claim';
    if (message.command && message.target) return 'message.command';

    return null;
  }

  /**
   * Validate a message
   * @param {Object} message - Message to validate
   * @param {string} type - Optional explicit type
   * @returns {Object} Validation result
   */
  async validate(message, type = null) {
    this.stats.validated++;

    try {
      // Step 1: Sanitize if enabled
      let processedMessage = message;
      if (this.options.sanitize) {
        processedMessage = await sanitizeMessage(message);
        this.stats.sanitized++;
      }

      // Step 2: Identify type
      const messageType = type || this.identifyType(processedMessage);
      if (!messageType) {
        throw new ValidationError('Unable to identify message type', 'UNKNOWN_TYPE');
      }

      // Step 3: Check if schema exists
      if (!hasSchema(messageType)) {
        throw new ValidationError(`No schema found for type: ${messageType}`, 'NO_SCHEMA');
      }

      // Step 4: Get schema (from cache if available)
      const schema = this.getOrCompileSchema(messageType);

      // Step 5: Validate
      const { error, value } = schema.validate(processedMessage, this.options);

      if (error) {
        this.stats.failed++;
        this.stats.errors.push({
          type: messageType,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        return {
          valid: false,
          error: this.formatError(error, messageType),
          originalMessage: message,
          sanitizedMessage: processedMessage
        };
      }

      this.stats.passed++;

      return {
        valid: true,
        value,
        type: messageType,
        metadata: {
          validated: true,
          sanitized: this.options.sanitize,
          version: this.options.version,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      this.stats.failed++;
      return {
        valid: false,
        error: {
          code: error.code || 'VALIDATION_ERROR',
          message: error.message,
          type: type || 'UNKNOWN'
        },
        originalMessage: message
      };
    }
  }

  /**
   * Get or compile schema with caching
   * @param {string} type - Schema type
   * @returns {Object} Compiled schema
   */
  getOrCompileSchema(type) {
    const cacheKey = `${type}_${this.options.version}`;

    if (!this.schemaCache.has(cacheKey)) {
      const schema = getSchema(type, this.options.version);
      this.schemaCache.set(cacheKey, schema);
    }

    return this.schemaCache.get(cacheKey);
  }

  /**
   * Format validation error for response
   * @param {Object} error - Joi validation error
   * @param {string} type - Message type
   * @returns {Object} Formatted error
   */
  formatError(error, type) {
    const formatted = {
      code: 'VALIDATION_FAILED',
      message: 'Message validation failed',
      type,
      details: [],
      timestamp: new Date().toISOString()
    };

    if (error.details && Array.isArray(error.details)) {
      formatted.details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type,
        value: detail.context?.value,
        label: detail.context?.label
      }));
    }

    return formatted;
  }

  /**
   * Batch validate multiple messages
   * @param {Array} messages - Array of messages
   * @returns {Object} Batch validation results
   */
  async validateBatch(messages) {
    if (!Array.isArray(messages)) {
      throw new TypeError('Messages must be an array');
    }

    const results = await Promise.all(
      messages.map(msg => this.validate(msg))
    );

    const summary = {
      total: messages.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      results
    };

    return summary;
  }

  /**
   * Validate with custom schema
   * @param {Object} message - Message to validate
   * @param {Object} schema - Joi schema
   * @returns {Object} Validation result
   */
  async validateWithSchema(message, schema) {
    if (!Joi.isSchema(schema)) {
      throw new TypeError('Schema must be a Joi schema');
    }

    let processedMessage = message;
    if (this.options.sanitize) {
      processedMessage = await sanitizeMessage(message);
    }

    const { error, value } = schema.validate(processedMessage, this.options);

    if (error) {
      return {
        valid: false,
        error: this.formatError(error, 'custom'),
        originalMessage: message
      };
    }

    return {
      valid: true,
      value,
      type: 'custom'
    };
  }

  /**
   * Get validation statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.validated > 0
        ? (this.stats.passed / this.stats.validated) * 100
        : 0,
      recentErrors: this.stats.errors.slice(-10)
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      validated: 0,
      passed: 0,
      failed: 0,
      sanitized: 0,
      errors: []
    };
  }

  /**
   * Clear schema cache
   */
  clearCache() {
    this.schemaCache.clear();
  }
}

/**
 * Custom Validation Error
 */
class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

/**
 * Create a singleton instance
 */
const defaultValidator = new MessageValidator();

/**
 * Convenience validation functions
 */
export async function validateMessage(message, type = null, options = {}) {
  const validator = new MessageValidator(options);
  return validator.validate(message, type);
}

export async function validateBatch(messages, options = {}) {
  const validator = new MessageValidator(options);
  return validator.validateBatch(messages);
}

/**
 * Message type validators
 */
export const validators = {
  agent: async (message) => validateMessage(message, 'agent.create'),
  task: async (message) => validateMessage(message, 'task.submit'),
  voting: async (message) => validateMessage(message, 'voting.submit'),
  brainstorm: async (message) => validateMessage(message, 'message.brainstorm'),
  achievement: async (message) => validateMessage(message, 'achievement.claim')
};

/**
 * Export default validator instance and class
 */
export default defaultValidator;
export { ValidationError };