/**
 * Global Error Handler
 * Centralized error handling with categorization, logging, and recovery
 */

const {
  ERROR_CATEGORIES,
  SEVERITY_LEVELS,
  RETRYABLE_ERRORS,
  LOGGING_CONFIG,
  RECOVERY_STRATEGIES
} = require('./error-constants');

const { BaseError, ErrorFactory } = require('./custom-errors');
const ErrorMonitor = require('./error-monitor');
const ErrorRecovery = require('./error-recovery');
const ErrorFormatter = require('./error-formatter');

class ErrorHandler {
  constructor() {
    this.monitor = new ErrorMonitor();
    this.recovery = new ErrorRecovery();
    this.formatter = new ErrorFormatter();
    this.handlers = new Map();
    this.globalContext = {};
    this.initialized = false;
  }

  /**
   * Initialize the error handler
   */
  async initialize(config = {}) {
    if (this.initialized) return;

    this.config = {
      logLevel: process.env.LOG_LEVEL || 'error',
      enableMonitoring: config.enableMonitoring !== false,
      enableRecovery: config.enableRecovery !== false,
      enableAlerts: config.enableAlerts !== false,
      customHandlers: config.handlers || {},
      ...config
    };

    // Initialize monitor
    if (this.config.enableMonitoring) {
      await this.monitor.initialize(this.config.monitoring);
    }

    // Initialize recovery
    if (this.config.enableRecovery) {
      await this.recovery.initialize(this.config.recovery);
    }

    // Register custom handlers
    this.registerHandlers(this.config.customHandlers);

    // Set up process error handlers
    this.setupProcessHandlers();

    this.initialized = true;
    console.log('Error Handler initialized successfully');
  }

  /**
   * Main error handling method
   */
  async handle(error, context = {}) {
    try {
      // Convert to custom error if needed
      const customError = this.normalizeError(error);

      // Merge context
      const fullContext = {
        ...this.globalContext,
        ...context,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };

      // Categorize error
      const category = this.categorizeError(customError);
      customError.category = category;

      // Log error
      await this.logError(customError, fullContext);

      // Monitor error
      if (this.config.enableMonitoring) {
        await this.monitor.recordError(customError, fullContext);
      }

      // Check for custom handler
      const handled = await this.applyCustomHandler(customError, fullContext);
      if (handled) return handled;

      // Determine recovery strategy
      const strategy = this.determineRecoveryStrategy(customError, fullContext);

      // Apply recovery if enabled
      let recoveryResult = null;
      if (this.config.enableRecovery && strategy !== RECOVERY_STRATEGIES.FAIL_FAST) {
        recoveryResult = await this.recovery.recover(customError, strategy, fullContext);
      }

      // Check alerts
      if (this.config.enableAlerts) {
        await this.checkAlerts(customError, fullContext);
      }

      // Format response
      const response = this.formatter.format(customError, {
        includeStack: process.env.NODE_ENV === 'development',
        includeContext: fullContext.includeContext,
        recovery: recoveryResult
      });

      return {
        error: response,
        handled: true,
        recovered: recoveryResult?.success || false
      };

    } catch (handlerError) {
      console.error('Error in error handler:', handlerError);
      return this.fallbackError(error, handlerError);
    }
  }

  /**
   * Normalize error to custom error type
   */
  normalizeError(error) {
    if (error instanceof BaseError) {
      return error;
    }

    // Check common error types
    if (error.code === 'ECONNREFUSED') {
      return ErrorFactory.create('NETWORK', error.message);
    }

    if (error.code === 'ETIMEDOUT') {
      return ErrorFactory.create('NETWORK', 'Operation timed out');
    }

    if (error.name === 'ValidationError') {
      return ErrorFactory.create('VALIDATION', error.message);
    }

    if (error.name === 'UnauthorizedError') {
      return ErrorFactory.create('AUTHENTICATION', error.message);
    }

    // Default to system error
    return ErrorFactory.fromError(error, 'SYSTEM');
  }

  /**
   * Categorize error
   */
  categorizeError(error) {
    if (error.category) return error.category;

    const errorName = error.constructor.name;
    const categoryMap = {
      'ValidationError': ERROR_CATEGORIES.VALIDATION_ERROR,
      'NetworkError': ERROR_CATEGORIES.NETWORK_ERROR,
      'SecurityError': ERROR_CATEGORIES.SECURITY_ERROR,
      'DatabaseError': ERROR_CATEGORIES.DATABASE_ERROR,
      'QueueError': ERROR_CATEGORIES.QUEUE_ERROR,
      'AgentError': ERROR_CATEGORIES.AGENT_ERROR,
      'BusinessLogicError': ERROR_CATEGORIES.BUSINESS_ERROR,
      'TimeoutError': ERROR_CATEGORIES.TIMEOUT_ERROR
    };

    return categoryMap[errorName] || ERROR_CATEGORIES.SYSTEM_ERROR;
  }

  /**
   * Determine recovery strategy
   */
  determineRecoveryStrategy(error, context) {
    // Check if error is retryable
    if (!RETRYABLE_ERRORS.includes(error.category)) {
      return RECOVERY_STRATEGIES.FAIL_FAST;
    }

    // Check retry count
    if (context.retryCount >= (context.maxRetries || 3)) {
      return RECOVERY_STRATEGIES.CIRCUIT_BREAK;
    }

    // Check for specific strategies
    if (error.category === ERROR_CATEGORIES.NETWORK_ERROR) {
      return RECOVERY_STRATEGIES.RETRY;
    }

    if (error.category === ERROR_CATEGORIES.DATABASE_ERROR) {
      return context.allowFallback ? RECOVERY_STRATEGIES.FALLBACK : RECOVERY_STRATEGIES.RETRY;
    }

    if (error.category === ERROR_CATEGORIES.QUEUE_ERROR) {
      return RECOVERY_STRATEGIES.QUEUE;
    }

    if (error.severity === SEVERITY_LEVELS.LOW) {
      return RECOVERY_STRATEGIES.IGNORE;
    }

    return RECOVERY_STRATEGIES.RETRY;
  }

  /**
   * Log error with appropriate level
   */
  async logError(error, context) {
    const logLevel = this.getLogLevel(error);
    const logData = {
      error: error.toJSON(),
      context: this.sanitizeContext(context),
      correlationId: error.correlationId,
      timestamp: new Date().toISOString()
    };

    switch (logLevel) {
      case LOGGING_CONFIG.LEVELS.ERROR:
        console.error('ERROR:', JSON.stringify(logData, null, 2));
        break;
      case LOGGING_CONFIG.LEVELS.WARN:
        console.warn('WARNING:', JSON.stringify(logData, null, 2));
        break;
      case LOGGING_CONFIG.LEVELS.INFO:
        console.info('INFO:', JSON.stringify(logData, null, 2));
        break;
      default:
        console.log('LOG:', JSON.stringify(logData, null, 2));
    }

    // Send to external logging if configured
    if (this.config.externalLogger) {
      await this.config.externalLogger.log(logLevel, logData);
    }
  }

  /**
   * Get appropriate log level for error
   */
  getLogLevel(error) {
    const severityToLogLevel = {
      [SEVERITY_LEVELS.CRITICAL]: LOGGING_CONFIG.LEVELS.ERROR,
      [SEVERITY_LEVELS.HIGH]: LOGGING_CONFIG.LEVELS.ERROR,
      [SEVERITY_LEVELS.MEDIUM]: LOGGING_CONFIG.LEVELS.WARN,
      [SEVERITY_LEVELS.LOW]: LOGGING_CONFIG.LEVELS.INFO
    };

    return severityToLogLevel[error.severity] || LOGGING_CONFIG.LEVELS.ERROR;
  }

  /**
   * Sanitize context to remove sensitive data
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeContext(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Register custom error handlers
   */
  registerHandlers(handlers) {
    for (const [errorType, handler] of Object.entries(handlers)) {
      this.registerHandler(errorType, handler);
    }
  }

  /**
   * Register a single custom handler
   */
  registerHandler(errorType, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler for ${errorType} must be a function`);
    }
    this.handlers.set(errorType, handler);
  }

  /**
   * Apply custom handler if available
   */
  async applyCustomHandler(error, context) {
    const handler = this.handlers.get(error.constructor.name) ||
                   this.handlers.get(error.code) ||
                   this.handlers.get(error.category);

    if (handler) {
      try {
        return await handler(error, context);
      } catch (handlerError) {
        console.error(`Custom handler failed for ${error.constructor.name}:`, handlerError);
      }
    }

    return null;
  }

  /**
   * Check and trigger alerts
   */
  async checkAlerts(error, context) {
    const shouldAlert = await this.monitor.shouldAlert(error);

    if (shouldAlert) {
      const alert = {
        error: error.toJSON(),
        context: this.sanitizeContext(context),
        timestamp: new Date().toISOString(),
        severity: error.severity,
        environment: process.env.NODE_ENV
      };

      // Send alerts through configured channels
      await this.sendAlerts(alert);
    }
  }

  /**
   * Send alerts through various channels
   */
  async sendAlerts(alert) {
    const channels = this.config.alertChannels || [];

    for (const channel of channels) {
      try {
        await channel.send(alert);
      } catch (error) {
        console.error(`Failed to send alert via ${channel.name}:`, error);
      }
    }
  }

  /**
   * Fallback error response
   */
  fallbackError(originalError, handlerError) {
    return {
      error: {
        message: 'An error occurred while processing your request',
        code: 'HANDLER_ERROR',
        originalError: process.env.NODE_ENV === 'development' ? originalError.message : undefined,
        handlerError: process.env.NODE_ENV === 'development' ? handlerError.message : undefined
      },
      handled: false,
      recovered: false
    };
  }

  /**
   * Setup process-level error handlers
   */
  setupProcessHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.handle(error, { type: 'uncaughtException' });

      // Give time to log before exit
      setTimeout(() => process.exit(1), 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.handle(reason, { type: 'unhandledRejection' });
    });

    // Handle warnings
    process.on('warning', (warning) => {
      console.warn('Process Warning:', warning);
      this.handle(warning, { type: 'warning', severity: SEVERITY_LEVELS.LOW });
    });
  }

  /**
   * Set global context for all errors
   */
  setGlobalContext(context) {
    this.globalContext = { ...this.globalContext, ...context };
  }

  /**
   * Clear global context
   */
  clearGlobalContext() {
    this.globalContext = {};
  }

  /**
   * Get error statistics
   */
  async getStatistics() {
    return this.monitor.getStatistics();
  }

  /**
   * Get error metrics
   */
  async getMetrics() {
    return this.monitor.getMetrics();
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      handler: 'healthy',
      monitor: await this.monitor.healthCheck(),
      recovery: await this.recovery.healthCheck()
    };
  }

  /**
   * Shutdown handler
   */
  async shutdown() {
    console.log('Shutting down error handler...');

    if (this.monitor) {
      await this.monitor.shutdown();
    }

    if (this.recovery) {
      await this.recovery.shutdown();
    }

    this.initialized = false;
    console.log('Error handler shutdown complete');
  }
}

// Export singleton instance
const errorHandler = new ErrorHandler();

// Export both class and instance
module.exports = {
  ErrorHandler,
  errorHandler,

  // Convenience method for direct handling
  handle: (error, context) => errorHandler.handle(error, context),

  // Initialization
  initialize: (config) => errorHandler.initialize(config),

  // Handler registration
  registerHandler: (errorType, handler) => errorHandler.registerHandler(errorType, handler),

  // Context management
  setGlobalContext: (context) => errorHandler.setGlobalContext(context),

  // Statistics
  getStatistics: () => errorHandler.getStatistics(),
  getMetrics: () => errorHandler.getMetrics()
};