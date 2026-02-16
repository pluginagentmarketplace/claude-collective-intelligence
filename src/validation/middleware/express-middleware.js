/**
 * Express Validation Middleware
 *
 * Production-ready Express middleware for request validation
 * - Validates request body, params, and query
 * - Supports multiple validation strategies
 * - User-friendly error responses
 * - Metrics and logging integration
 *
 * Usage:
 * app.post('/agents', validateRequest('agent.create'), agentController.create);
 */

import { Validator } from '../validators/validator.js';
import { ValidationErrorFormatter } from '../utils/validation-helpers.js';
import logger from '../../logger/module-loggers.js';

/**
 * Create Express validation middleware for a specific schema type
 * @param {string} type - Schema type (e.g., 'agent.create')
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware function
 */
export function validateRequest(type, options = {}) {
  const validationOptions = {
    bodyRequired: true,
    validateQuery: false,
    validateParams: false,
    returnValidated: true,
    ...options
  };

  return async (req, res, next) => {
    try {
      const validator = new Validator({
        sanitize: true,
        validateSchema: true,
        validatePayload: true,
        throwOnError: false
      });

      let dataToValidate = req.body;

      // Combine body, query, and params if needed
      if (validationOptions.validateQuery || validationOptions.validateParams) {
        dataToValidate = {
          ...dataToValidate,
          ...(validationOptions.validateQuery && req.query),
          ...(validationOptions.validateParams && req.params)
        };
      }

      // Validate
      const result = await validator.validate(dataToValidate, type);

      if (!result.valid) {
        // Log validation failure
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          type,
          errors: result.error,
          ip: req.ip
        });

        // Return error response
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: result.error.details,
            timestamp: new Date().toISOString(),
            requestId: req.id || req.headers['x-request-id']
          }
        });
      }

      // Store validated data
      if (validationOptions.returnValidated) {
        req.validated = result.value;
      }

      // Store validation metadata
      req.validationMetadata = result.metadata;

      // Continue
      next();
    } catch (error) {
      logger.error('Validation middleware error', {
        error: error.message,
        path: req.path,
        stack: error.stack
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during validation',
          timestamp: new Date().toISOString(),
          requestId: req.id || req.headers['x-request-id']
        }
      });
    }
  };
}

/**
 * Create middleware for validating specific request part
 * @param {string} part - 'body', 'query', or 'params'
 * @param {string} type - Schema type
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
export function validateRequestPart(part, type, options = {}) {
  return async (req, res, next) => {
    const validator = new Validator({
      sanitize: true,
      validateSchema: true,
      throwOnError: false
    });

    const data = req[part];
    const result = await validator.validate(data, type);

    if (!result.valid) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `${part} validation failed`,
          details: result.error.details,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Store validated data
    if (options.storeAs) {
      req[options.storeAs] = result.value;
    } else {
      req[part] = result.value;
    }

    next();
  };
}

/**
 * Validate request body
 * @param {string} type - Schema type
 * @param {Object} options - Options
 * @returns {Function} Middleware
 */
export function validateBody(type, options = {}) {
  return validateRequestPart('body', type, options);
}

/**
 * Validate request params
 * @param {string} type - Schema type
 * @param {Object} options - Options
 * @returns {Function} Middleware
 */
export function validateParams(type, options = {}) {
  return validateRequestPart('params', type, options);
}

/**
 * Validate request query
 * @param {string} type - Schema type
 * @param {Object} options - Options
 * @returns {Function} Middleware
 */
export function validateQuery(type, options = {}) {
  return validateRequestPart('query', type, options);
}

/**
 * Validate multiple parts with different schemas
 * @param {Object} config - { body?, params?, query? } with type strings
 * @param {Object} options - Options
 * @returns {Function} Middleware
 */
export function validateMultiple(config, options = {}) {
  return async (req, res, next) => {
    const validator = new Validator({
      sanitize: true,
      validateSchema: true,
      throwOnError: false
    });

    const errors = [];
    const validated = {};

    // Validate each part
    for (const [part, type] of Object.entries(config)) {
      if (!req[part]) continue;

      const result = await validator.validate(req[part], type);
      if (!result.valid) {
        errors.push({
          part,
          error: result.error
        });
      } else {
        validated[part] = result.value;
      }
    }

    // Return errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          errors: errors.map(e => ({
            part: e.part,
            details: e.error.details
          })),
          timestamp: new Date().toISOString()
        }
      });
    }

    // Store validated data
    Object.assign(req, validated);
    next();
  };
}

/**
 * Error handling middleware for validation
 * Should be used at the end of route definitions
 */
export function validationErrorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString(),
        requestId: req.id || req.headers['x-request-id']
      }
    });
  }

  // Pass to next error handler
  next(err);
}

/**
 * Validation statistics middleware
 * Tracks validation metrics
 */
export function validationStatsMiddleware() {
  const stats = {
    total: 0,
    successful: 0,
    failed: 0,
    startTime: Date.now()
  };

  return (req, res, next) => {
    stats.total++;

    // Hook into response
    const originalJson = res.json.bind(res);
    res.json = function(body) {
      if (body.error && body.error.code === 'VALIDATION_ERROR') {
        stats.failed++;
      } else {
        stats.successful++;
      }

      // Attach stats to response headers (optional)
      res.setHeader('X-Validation-Stats', JSON.stringify({
        total: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        uptime: Date.now() - stats.startTime
      }));

      return originalJson(body);
    };

    next();
  };
}

/**
 * Custom validation middleware factory
 * Allows creating custom validation middleware with specific options
 */
export class ValidationMiddlewareFactory {
  constructor(defaultOptions = {}) {
    this.defaultOptions = {
      sanitize: true,
      validateSchema: true,
      validatePayload: true,
      throwOnError: false,
      ...defaultOptions
    };
  }

  /**
   * Create middleware for a schema type
   */
  createMiddleware(type, options = {}) {
    const finalOptions = { ...this.defaultOptions, ...options };

    return async (req, res, next) => {
      const validator = new Validator(finalOptions);
      const result = await validator.validate(req.body, type);

      if (!result.valid) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: result.error.details,
            suggestions: validator.getSuggestions(result.error),
            timestamp: new Date().toISOString()
          }
        });
      }

      req.validated = result.value;
      next();
    };
  }

  /**
   * Create middleware with custom validator function
   */
  createCustomMiddleware(validatorFn) {
    return async (req, res, next) => {
      try {
        const result = await validatorFn(req.body);

        if (!result.valid) {
          return res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: result.error || 'Validation failed',
              timestamp: new Date().toISOString()
            }
          });
        }

        req.validated = result.value;
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

/**
 * Express app setup helper
 */
export function setupValidation(app, options = {}) {
  const defaultOptions = {
    enableStats: true,
    enableErrorHandler: true,
    errorFormatter: true,
    ...options
  };

  // Add statistics middleware
  if (defaultOptions.enableStats) {
    app.use(validationStatsMiddleware());
  }

  // Create and expose validator factory
  const factory = new ValidationMiddlewareFactory(options);
  app.validateRequest = factory.createMiddleware.bind(factory);
  app.validateCustom = factory.createCustomMiddleware.bind(factory);

  // Add error handler
  if (defaultOptions.enableErrorHandler) {
    app.use(validationErrorHandler);
  }

  return app;
}

/**
 * Express validation middleware utilities
 */
export default {
  validateRequest,
  validateRequestPart,
  validateBody,
  validateParams,
  validateQuery,
  validateMultiple,
  validationErrorHandler,
  validationStatsMiddleware,
  ValidationMiddlewareFactory,
  setupValidation
};
