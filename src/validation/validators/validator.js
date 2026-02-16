/**
 * Unified Validator Module
 *
 * Central validation interface combining all validation types
 * - Schema validation (Joi)
 * - Payload validation (custom business rules)
 * - Message validation (type-specific)
 * - Security validation (sanitization + pattern detection)
 *
 * Production-ready with error handling, caching, and metrics
 */

import { MessageValidator } from './message-validator.js';
import { PayloadValidator } from './payload-validator.js';
import { sanitizeMessage, Sanitizer } from '../sanitizers/sanitizer.js';
import {
  getSchema,
  validateByType,
  hasSchema,
  ValidationHelpers
} from '../schemas/index.js';

/**
 * Unified Validator Class
 * Combines all validation strategies into a single interface
 */
export class Validator {
  constructor(options = {}) {
    this.options = {
      sanitize: true,
      validateSchema: true,
      validatePayload: true,
      validateSecurity: true,
      throwOnError: false,
      cacheSchemas: true,
      enableMetrics: true,
      maxValidationTime: 5000, // 5 seconds
      ...options
    };

    // Initialize sub-validators
    this.messageValidator = new MessageValidator({
      sanitize: this.options.sanitize,
      stripUnknown: true
    });

    this.payloadValidator = new PayloadValidator({
      strictMode: false
    });

    this.sanitizer = new Sanitizer({
      stripHtml: true,
      detectPatterns: true,
      throwOnDetection: false
    });

    // Metrics
    this.metrics = {
      total: 0,
      passed: 0,
      failed: 0,
      cached: 0,
      avgTime: 0,
      errors: []
    };

    // Schema cache
    this.schemaCache = new Map();
  }

  /**
   * Main validation method - validates using all enabled strategies
   * @param {Object} data - Data to validate
   * @param {string} type - Schema type (e.g., 'agent.create', 'task.submit')
   * @param {Object} options - Optional validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(data, type, options = {}) {
    const startTime = Date.now();
    this.metrics.total++;

    try {
      const validationOptions = { ...this.options, ...options };

      // Step 1: Sanitize
      let sanitizedData = data;
      if (validationOptions.sanitize) {
        sanitizedData = await this.sanitizeData(data);
      }

      // Step 2: Validate schema
      let schemaValidation = null;
      if (validationOptions.validateSchema && type) {
        if (!hasSchema(type)) {
          return this.formatError(
            `Unknown validation type: ${type}`,
            'UNKNOWN_TYPE',
            data
          );
        }
        schemaValidation = this.validateSchema(sanitizedData, type);
        if (!schemaValidation.valid) {
          this.metrics.failed++;
          return schemaValidation;
        }
      }

      // Step 3: Validate payload (custom business rules)
      if (validationOptions.validatePayload) {
        const payloadValidation = await this.payloadValidator.validate(
          sanitizedData,
          { validators: this.getValidatorsForType(type) }
        );
        if (!payloadValidation.valid) {
          this.metrics.failed++;
          return {
            valid: false,
            error: payloadValidation.error,
            type,
            validated: false
          };
        }
      }

      // All validations passed
      this.metrics.passed++;
      const duration = Date.now() - startTime;
      this.updateMetrics(duration);

      return {
        valid: true,
        value: schemaValidation?.value || sanitizedData,
        type,
        validated: true,
        metadata: {
          sanitized: validationOptions.sanitize,
          duration,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.metrics.failed++;
      if (this.options.throwOnError) {
        throw error;
      }
      return this.formatError(error.message, 'VALIDATION_ERROR', data);
    }
  }

  /**
   * Validate with schema only
   * @param {Object} data - Data to validate
   * @param {string} type - Schema type
   * @returns {Object} Validation result
   */
  validateSchema(data, type) {
    const schema = this.getOrCacheSchema(type);
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return {
        valid: false,
        error: this.formatValidationError(error),
        type,
        validated: false
      };
    }

    return {
      valid: true,
      value,
      type,
      validated: true
    };
  }

  /**
   * Validate payload with custom rules
   * @param {Object} payload - Payload to validate
   * @param {string} type - Payload type
   * @returns {Promise<Object>} Validation result
   */
  async validatePayload(payload, type) {
    const validators = this.getValidatorsForType(type);
    const result = await this.payloadValidator.validate(payload, { validators });
    return result;
  }

  /**
   * Validate message (type detection + validation)
   * @param {Object} message - Message to validate
   * @param {string} type - Optional explicit type
   * @returns {Promise<Object>} Validation result
   */
  async validateMessage(message, type = null) {
    return this.messageValidator.validate(message, type);
  }

  /**
   * Batch validation
   * @param {Array} items - Array of { type, data } objects
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Batch result
   */
  async validateBatch(items, options = {}) {
    const results = await Promise.all(
      items.map(item => this.validate(item.data, item.type, options))
    );

    return {
      total: items.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length,
      results
    };
  }

  /**
   * Sanitize data
   * @param {any} data - Data to sanitize
   * @returns {Promise<any>} Sanitized data
   */
  async sanitizeData(data) {
    if (typeof data === 'string') {
      return this.sanitizer.sanitizeString(data);
    } else if (Array.isArray(data)) {
      return this.sanitizer.sanitizeArray(data);
    } else if (typeof data === 'object' && data !== null) {
      return this.sanitizer.sanitizeObject(data);
    }
    return data;
  }

  /**
   * Get or cache schema
   * @param {string} type - Schema type
   * @returns {Object} Joi schema
   */
  getOrCacheSchema(type) {
    const cacheKey = `schema_${type}`;

    if (this.options.cacheSchemas && this.schemaCache.has(cacheKey)) {
      this.metrics.cached++;
      return this.schemaCache.get(cacheKey);
    }

    const schema = getSchema(type);

    if (this.options.cacheSchemas) {
      this.schemaCache.set(cacheKey, schema);
    }

    return schema;
  }

  /**
   * Get validators for a specific type
   * @param {string} type - Data type
   * @returns {Array} List of validator names
   */
  getValidatorsForType(type) {
    const typeValidators = {
      'task.submit': ['task.deadline', 'resource.allocation'],
      'task.update': ['task.deadline', 'resource.allocation'],
      'voting.submit': ['voting.quorum', 'quadratic.tokens'],
      'voting.create': ['voting.quorum'],
      'agent.create': ['agent.capabilities', 'resource.allocation'],
      'agent.update': ['agent.capabilities', 'resource.allocation'],
      'achievement.claim': ['achievement.evidence']
    };

    return typeValidators[type] || [];
  }

  /**
   * Format validation errors into user-friendly messages
   * @param {Object} error - Joi error object
   * @returns {Object} Formatted error
   */
  formatValidationError(error) {
    const details = [];

    if (error.details && Array.isArray(error.details)) {
      for (const detail of error.details) {
        details.push({
          field: detail.path.join('.'),
          message: this.getUserFriendlyMessage(detail),
          type: detail.type,
          context: detail.context
        });
      }
    }

    return {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details,
      count: details.length
    };
  }

  /**
   * Get user-friendly error message
   * @param {Object} detail - Error detail
   * @returns {string} User-friendly message
   */
  getUserFriendlyMessage(detail) {
    const field = detail.path.join('.');
    const { type, context } = detail;

    const messages = {
      'any.required': `${field} is required`,
      'any.only': `${field} must be one of: ${context.valids?.join(', ') || 'valid options'}`,
      'string.empty': `${field} cannot be empty`,
      'string.min': `${field} must be at least ${context.limit} characters`,
      'string.max': `${field} must be at most ${context.limit} characters`,
      'string.pattern.base': `${field} has an invalid format`,
      'number.base': `${field} must be a number`,
      'number.min': `${field} must be at least ${context.limit}`,
      'number.max': `${field} must be at most ${context.limit}`,
      'array.min': `${field} must have at least ${context.limit} items`,
      'array.max': `${field} must have at most ${context.limit} items`,
      'object.unknown': `${field} is not allowed`,
      'date.base': `${field} must be a valid date`,
      'date.min': `${field} must be after ${context.limit}`,
      'date.max': `${field} must be before ${context.limit}`
    };

    return messages[type] || detail.message;
  }

  /**
   * Format validation error for API response
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {any} data - Original data
   * @returns {Object} Error response
   */
  formatError(message, code, data = null) {
    const error = {
      valid: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString()
      },
      validated: false
    };

    if (data && typeof data === 'object') {
      error.originalData = data;
    }

    return error;
  }

  /**
   * Update metrics
   * @param {number} duration - Validation duration in ms
   */
  updateMetrics(duration) {
    if (this.options.enableMetrics) {
      const total = this.metrics.total;
      this.metrics.avgTime = (this.metrics.avgTime * (total - 1) + duration) / total;
    }
  }

  /**
   * Get validation metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.total > 0
        ? (this.metrics.passed / this.metrics.total * 100).toFixed(2) + '%'
        : 'N/A',
      avgTime: this.metrics.avgTime.toFixed(2) + 'ms'
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      total: 0,
      passed: 0,
      failed: 0,
      cached: 0,
      avgTime: 0,
      errors: []
    };
  }

  /**
   * Clear schema cache
   */
  clearCache() {
    this.schemaCache.clear();
  }

  /**
   * Test if data is valid for a type without throwing
   * @param {Object} data - Data to test
   * @param {string} type - Schema type
   * @returns {boolean} True if valid
   */
  isValid(data, type) {
    const result = this.validateSchema(data, type);
    return result.valid;
  }

  /**
   * Get validation suggestions for common errors
   * @param {Object} error - Validation error
   * @returns {Array} Array of suggestions
   */
  getSuggestions(error) {
    const suggestions = [];

    if (!error.details) {
      return suggestions;
    }

    for (const detail of error.details) {
      const field = detail.path.join('.');

      if (detail.type === 'string.pattern.base') {
        suggestions.push(`${field}: Check the format. Expected pattern like "abc-123"`);
      } else if (detail.type === 'array.min') {
        suggestions.push(`${field}: Need at least ${detail.context.limit} items`);
      } else if (detail.type === 'string.min') {
        suggestions.push(`${field}: Add more text (at least ${detail.context.limit} chars)`);
      } else if (detail.type === 'any.only') {
        suggestions.push(`${field}: Choose from: ${detail.context.valids.join(', ')}`);
      }
    }

    return suggestions;
  }
}

/**
 * Create singleton instance
 */
const defaultValidator = new Validator();

/**
 * Convenience functions
 */
export async function validate(data, type, options = {}) {
  const validator = new Validator(options);
  return validator.validate(data, type);
}

export async function validateBatch(items, options = {}) {
  const validator = new Validator(options);
  return validator.validateBatch(items);
}

export async function validateMessage(message, type = null, options = {}) {
  const validator = new Validator(options);
  return validator.validateMessage(message, type);
}

export function isValid(data, type) {
  return defaultValidator.isValid(data, type);
}

/**
 * Export default instance and class
 */
export default defaultValidator;
export { Validator as ValidatorClass };
