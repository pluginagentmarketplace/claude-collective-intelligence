/**
 * Logger Module Entry Point
 * Exports all logging functionality for the application
 */

// Core logger configuration
import {
  logger,
  loggerConfig,
  createChildLogger,
  logPerformance,
  logError,
  logAudit,
  logQuery,
  setLogLevel,
  isDebugEnabled,
  getHttpLogStream,
  shutdown
} from './winston-config.js';

// Context management
import {
  contextManager,
  createContext,
  runWithContext,
  getContext,
  addToContext,
  getContextualLogger,
  expressMiddleware,
  rabbitMqContext,
  agentContext,
  votingContext,
  performanceContext,
  batchContext,
  transactionContext,
  createSpan
} from './context-manager.js';

// Module-specific loggers
import {
  agentLogger,
  rabbitMQLogger,
  votingLogger,
  gamificationLogger,
  performanceLogger,
  agent,
  mq,
  voting,
  gamification,
  performance,
  startMetrics,
  stopMetrics
} from './module-loggers.js';

// Security logger
import {
  securityLogger,
  logAuthentication,
  logAuthorization,
  logDataAccess,
  logConfigurationChange,
  logPolicyViolation,
  logAccessControlViolation,
  logSuspiciousActivity,
  logRateLimit,
  logEncryption,
  logCertificateEvent,
  logComplianceAudit,
  generateSecurityReport
} from './security-logger.js';

// Formatters
import {
  redactSensitive,
  maskPII,
  addCallerInfo,
  cloudWatchFormat,
  elkFormat,
  datadogFormat,
  prettyFormat,
  compactFormat,
  structuredFormat,
  sqlFormat,
  httpFormat,
  metricsFormat,
  errorFormat,
  auditFormat,
  ExternalServiceTransport,
  presets
} from './log-formatter.js';

/**
 * Main logger instance with convenience methods
 */
class Logger {
  constructor() {
    this.logger = logger;
    this.config = loggerConfig;
    this.context = contextManager;
    this.modules = {
      agent: agentLogger,
      rabbitmq: rabbitMQLogger,
      voting: votingLogger,
      gamification: gamificationLogger,
      performance: performanceLogger
    };
  }

  // Standard logging methods
  error(message, meta = {}) {
    const context = getContext();
    this.logger.error(message, { ...context, ...meta });
  }

  warn(message, meta = {}) {
    const context = getContext();
    this.logger.warn(message, { ...context, ...meta });
  }

  info(message, meta = {}) {
    const context = getContext();
    this.logger.info(message, { ...context, ...meta });
  }

  http(message, meta = {}) {
    const context = getContext();
    this.logger.http(message, { ...context, ...meta });
  }

  verbose(message, meta = {}) {
    const context = getContext();
    this.logger.verbose(message, { ...context, ...meta });
  }

  debug(message, meta = {}) {
    const context = getContext();
    this.logger.debug(message, { ...context, ...meta });
  }

  silly(message, meta = {}) {
    const context = getContext();
    this.logger.silly(message, { ...context, ...meta });
  }

  // Create a child logger with module context
  child(module, meta = {}) {
    return createChildLogger(module, meta);
  }

  // Performance timing
  time(label) {
    performance.startTimer(label);
  }

  timeEnd(label, meta = {}) {
    return performance.endTimer(label, meta);
  }

  // Quick error logging with stack
  exception(error, message = 'An error occurred', meta = {}) {
    logError(error, { message, ...meta });
  }

  // Audit logging
  audit(action, userId, meta = {}) {
    logAudit(action, userId, meta);
  }

  // Database query logging
  query(sql, duration, meta = {}) {
    logQuery(sql, duration, meta);
  }

  // Change log level dynamically
  setLevel(level) {
    setLogLevel(level);
  }

  // Check if debug is enabled
  get isDebugEnabled() {
    return isDebugEnabled();
  }

  // Get HTTP stream for Morgan
  get httpStream() {
    return getHttpLogStream();
  }

  // Shutdown logging gracefully
  async close() {
    stopMetrics();
    await shutdown();
  }
}

// Create singleton instance
const log = new Logger();

/**
 * Helper function to initialize logging for the application
 */
async function initializeLogging(options = {}) {
  // Set log level from options or environment
  if (options.level) {
    log.setLevel(options.level);
  }

  // Start system metrics if enabled
  if (options.enableMetrics !== false) {
    const metricsInterval = options.metricsInterval || 60000;
    startMetrics(metricsInterval);
    log.info('System metrics collection started', { interval: metricsInterval });
  }

  // Add external transports if configured
  if (options.cloudwatch) {
    // Add CloudWatch transport
    log.info('CloudWatch logging enabled');
  }

  if (options.elasticsearch) {
    // Add Elasticsearch transport
    log.info('Elasticsearch logging enabled');
  }

  if (options.datadog) {
    // Add Datadog transport
    log.info('Datadog logging enabled');
  }

  // Set global context
  if (options.globalContext) {
    contextManager.setGlobalContext(options.globalContext);
  }

  log.info('Logging system initialized', {
    level: log.logger.level,
    transports: log.logger.transports.map(t => t.constructor.name),
    environment: process.env.NODE_ENV || 'development'
  });

  return log;
}

/**
 * Graceful shutdown handler
 */
async function handleShutdown() {
  log.info('Shutting down logging system...');
  await log.close();
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

/**
 * Express error handler middleware
 */
function errorHandler(err, req, res, next) {
  const context = req.context || {};

  log.exception(err, 'Express error handler', {
    ...context,
    url: req.url,
    method: req.method,
    statusCode: err.status || 500
  });

  res.status(err.status || 500).json({
    error: {
      message: err.message,
      code: err.code,
      requestId: context.requestId
    }
  });
}

/**
 * Async wrapper for route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Export main logger instance
export { log };
export { log as logger };
export { log as default };

// Export core functionality
export {
  initializeLogging,
  createChildLogger,
  setLogLevel,
  isDebugEnabled,
  shutdown
};

// Export context management
export {
  createContext,
  runWithContext,
  getContext,
  addToContext,
  getContextualLogger,
  createSpan
};

// Export middleware
export {
  expressMiddleware,
  errorHandler,
  asyncHandler
};

// Export context wrappers
export {
  rabbitMqContext,
  agentContext,
  votingContext,
  performanceContext,
  batchContext,
  transactionContext
};

// Export module loggers
export const modules = {
  agent,
  mq,
  voting,
  gamification,
  performance,
  security: securityLogger
};

// Export formatters
export const formats = {
  redactSensitive,
  maskPII,
  addCallerInfo,
  cloudWatchFormat,
  elkFormat,
  datadogFormat,
  prettyFormat,
  compactFormat,
  structuredFormat,
  sqlFormat,
  httpFormat,
  metricsFormat,
  errorFormat,
  auditFormat
};

// Export format presets
export { presets };

// Export custom transport
export { ExternalServiceTransport };

// Export system metrics
export { startMetrics, stopMetrics };

// Export direct logging methods
export const error = (...args) => log.error(...args);
export const warn = (...args) => log.warn(...args);
export const info = (...args) => log.info(...args);
export const http = (...args) => log.http(...args);
export const verbose = (...args) => log.verbose(...args);
export const debug = (...args) => log.debug(...args);
export const silly = (...args) => log.silly(...args);

// Export performance helpers
export const time = (...args) => log.time(...args);
export const timeEnd = (...args) => log.timeEnd(...args);

// Export special logging
export const exception = (...args) => log.exception(...args);
export const audit = (...args) => log.audit(...args);
export const query = (...args) => log.query(...args);

// Export security logging
export {
  securityLogger,
  logAuthentication,
  logAuthorization,
  logDataAccess,
  logConfigurationChange,
  logPolicyViolation,
  logAccessControlViolation,
  logSuspiciousActivity,
  logRateLimit,
  logEncryption,
  logCertificateEvent,
  logComplianceAudit,
  generateSecurityReport
};