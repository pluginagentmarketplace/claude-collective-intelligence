/**
 * Error Middleware
 * Express/Connect middleware for handling errors in HTTP requests
 */

const { errorHandler } = require('../errors/error-handler');
const { ErrorFactory } = require('../errors/custom-errors');
const { HTTP_STATUS_CODES } = require('../errors/error-constants');

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validation error middleware
 * Handles validation errors from request validation
 */
const validationErrorMiddleware = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    const error = ErrorFactory.create('VALIDATION', 'Invalid JSON in request body');
    error.statusCode = HTTP_STATUS_CODES.BAD_REQUEST;
    return errorHandler.handle(error, {
      path: req.path,
      method: req.method,
      ip: req.ip
    }).then(result => {
      res.status(error.statusCode).json(result.error);
    });
  }

  if (err.name === 'ValidationError' || err.type === 'validation') {
    const error = ErrorFactory.create('VALIDATION', err.message);
    error.statusCode = HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY;
    error.validationErrors = err.errors || err.details;

    return errorHandler.handle(error, {
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query
    }).then(result => {
      res.status(error.statusCode).json(result.error);
    });
  }

  next(err);
};

/**
 * Authentication error middleware
 * Handles authentication and authorization errors
 */
const authErrorMiddleware = (err, req, res, next) => {
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    const error = ErrorFactory.create('AUTHENTICATION', err.message || 'Authentication required');
    error.statusCode = HTTP_STATUS_CODES.UNAUTHORIZED;

    return errorHandler.handle(error, {
      path: req.path,
      method: req.method,
      headers: req.headers.authorization ? '[PRESENT]' : '[MISSING]'
    }).then(result => {
      res.status(error.statusCode).json(result.error);
    });
  }

  if (err.name === 'ForbiddenError' || err.status === 403) {
    const error = ErrorFactory.create('AUTHORIZATION', err.message || 'Access forbidden');
    error.statusCode = HTTP_STATUS_CODES.FORBIDDEN;

    return errorHandler.handle(error, {
      path: req.path,
      method: req.method,
      user: req.user?.id
    }).then(result => {
      res.status(error.statusCode).json(result.error);
    });
  }

  next(err);
};

/**
 * Rate limit error middleware
 * Handles rate limiting errors
 */
const rateLimitErrorMiddleware = (err, req, res, next) => {
  if (err.status === 429 || err.name === 'RateLimitError') {
    const error = ErrorFactory.create('BUSINESS', 'Too many requests');
    error.code = 'RATE_LIMIT_ERROR';
    error.statusCode = HTTP_STATUS_CODES.TOO_MANY_REQUESTS;
    error.retryAfter = err.retryAfter || 60;

    return errorHandler.handle(error, {
      path: req.path,
      method: req.method,
      ip: req.ip,
      limit: err.limit,
      remaining: err.remaining
    }).then(result => {
      res.set('Retry-After', error.retryAfter);
      res.set('X-RateLimit-Limit', err.limit || '100');
      res.set('X-RateLimit-Remaining', err.remaining || '0');
      res.set('X-RateLimit-Reset', new Date(Date.now() + error.retryAfter * 1000).toISOString());
      res.status(error.statusCode).json(result.error);
    });
  }

  next(err);
};

/**
 * Database error middleware
 * Handles database-related errors
 */
const databaseErrorMiddleware = (err, req, res, next) => {
  const dbErrorPatterns = [
    { pattern: /ER_DUP_ENTRY/, type: 'CONFLICT', message: 'Resource already exists' },
    { pattern: /ER_NO_REFERENCED/, type: 'VALIDATION', message: 'Referenced resource not found' },
    { pattern: /ECONNREFUSED.*3306/, type: 'DATABASE', message: 'Database connection failed' },
    { pattern: /ECONNREFUSED.*5432/, type: 'DATABASE', message: 'Database connection failed' },
    { pattern: /ETIMEDOUT/, type: 'DATABASE', message: 'Database operation timed out' }
  ];

  for (const { pattern, type, message } of dbErrorPatterns) {
    if (pattern.test(err.message || err.code)) {
      const error = ErrorFactory.create(type, message);
      error.statusCode = type === 'CONFLICT' ? HTTP_STATUS_CODES.CONFLICT : HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;
      error.originalError = err.message;

      return errorHandler.handle(error, {
        path: req.path,
        method: req.method,
        operation: err.sql ? 'SQL_QUERY' : 'DATABASE_OPERATION'
      }).then(result => {
        res.status(error.statusCode).json(result.error);
      });
    }
  }

  next(err);
};

/**
 * Queue error middleware
 * Handles RabbitMQ and message queue errors
 */
const queueErrorMiddleware = (err, req, res, next) => {
  if (err.name === 'QueueError' || err.code?.startsWith('AMQP')) {
    const error = ErrorFactory.create('QUEUE', err.message || 'Queue operation failed');
    error.statusCode = HTTP_STATUS_CODES.SERVICE_UNAVAILABLE;
    error.queueName = err.queue;
    error.exchange = err.exchange;

    return errorHandler.handle(error, {
      path: req.path,
      method: req.method,
      operation: err.operation || 'QUEUE_OPERATION'
    }).then(result => {
      res.status(error.statusCode).json(result.error);
    });
  }

  next(err);
};

/**
 * Not found error middleware
 * Handles 404 errors
 */
const notFoundMiddleware = (req, res, next) => {
  const error = ErrorFactory.create('SYSTEM', `Resource not found: ${req.path}`);
  error.code = 'NOT_FOUND';
  error.statusCode = HTTP_STATUS_CODES.NOT_FOUND;

  errorHandler.handle(error, {
    path: req.path,
    method: req.method,
    query: req.query
  }).then(result => {
    res.status(error.statusCode).json(result.error);
  });
};

/**
 * Final error handler middleware
 * Catches any unhandled errors
 */
const finalErrorMiddleware = (err, req, res, next) => {
  // Don't handle if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Convert to custom error
  const error = ErrorFactory.fromError(err, 'SYSTEM');
  error.statusCode = err.statusCode || err.status || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;

  // Set request context
  const context = {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id || req.headers['x-request-id'],
    userId: req.user?.id,
    sessionId: req.session?.id
  };

  // Handle error
  errorHandler.handle(error, context).then(result => {
    // Set response headers
    res.set('X-Error-Code', result.error.error.code);
    res.set('X-Correlation-ID', result.error.correlationId);

    if (result.recovered) {
      res.set('X-Error-Recovered', 'true');
    }

    // Send response
    res.status(error.statusCode).json(result.error);
  }).catch(handlerError => {
    // Fallback if error handler fails
    console.error('Error handler failed:', handlerError);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred'
      }
    });
  });
};

/**
 * Request logging middleware
 * Logs incoming requests for error correlation
 */
const requestLoggingMiddleware = (req, res, next) => {
  req.requestStart = Date.now();

  // Generate request ID if not present
  if (!req.id && !req.headers['x-request-id']) {
    req.id = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Log request
  console.log(`[${req.id}] ${req.method} ${req.path}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.requestStart;
    const level = res.statusCode >= 400 ? 'ERROR' : 'INFO';
    console.log(`[${req.id}] ${level}: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

/**
 * Error context middleware
 * Adds context to errors
 */
const errorContextMiddleware = (req, res, next) => {
  // Add context to error handler
  errorHandler.setGlobalContext({
    environment: process.env.NODE_ENV,
    service: process.env.SERVICE_NAME || 'ai-agent-rabbitmq',
    version: process.env.APP_VERSION || '1.0.0',
    region: process.env.AWS_REGION || process.env.REGION,
    instance: process.env.INSTANCE_ID || process.hostname
  });

  next();
};

/**
 * Recovery middleware
 * Attempts to recover from errors before sending response
 */
const recoveryMiddleware = (err, req, res, next) => {
  // Skip if not retryable
  if (err.retryable === false) {
    return next(err);
  }

  // Define recovery operation
  const recoveryOperation = async () => {
    // Attempt to retry the original request
    // This would need to be implemented based on your specific needs
    return null;
  };

  // Attempt recovery
  const context = {
    operation: recoveryOperation,
    maxRetries: 3,
    fallback: { error: 'Service temporarily unavailable' }
  };

  // Pass to next handler for now
  next(err);
};

/**
 * Setup all error middleware for an Express app
 */
const setupErrorMiddleware = (app, options = {}) => {
  // Request logging
  if (options.logging !== false) {
    app.use(requestLoggingMiddleware);
  }

  // Error context
  app.use(errorContextMiddleware);

  // Error handlers (order matters)
  app.use(validationErrorMiddleware);
  app.use(authErrorMiddleware);
  app.use(rateLimitErrorMiddleware);
  app.use(databaseErrorMiddleware);
  app.use(queueErrorMiddleware);

  // Recovery attempt
  if (options.recovery !== false) {
    app.use(recoveryMiddleware);
  }

  // 404 handler (should be second to last)
  app.use(notFoundMiddleware);

  // Final error handler (must be last)
  app.use(finalErrorMiddleware);
};

module.exports = {
  asyncHandler,
  validationErrorMiddleware,
  authErrorMiddleware,
  rateLimitErrorMiddleware,
  databaseErrorMiddleware,
  queueErrorMiddleware,
  notFoundMiddleware,
  finalErrorMiddleware,
  requestLoggingMiddleware,
  errorContextMiddleware,
  recoveryMiddleware,
  setupErrorMiddleware
};