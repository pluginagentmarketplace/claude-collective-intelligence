/**
 * Winston Logger Configuration
 * Production-grade logging setup with multiple transports and formats
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
const auditDir = path.join(logsDir, '.audit');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

if (!fs.existsSync(auditDir)) {
  fs.mkdirSync(auditDir, { recursive: true });
}

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'gray'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

/**
 * Custom format for development environment
 */
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, module, ...meta }) => {
    const moduleStr = module ? `[${module}]` : '';
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} ${level} ${moduleStr} ${message} ${metaStr}`;
  })
);

/**
 * Custom format for production environment
 */
const prodFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({ fillWith: ['service', 'hostname', 'pid'] })
);

/**
 * Create a rotating file transport
 */
function createRotatingFileTransport(filename, level = 'info') {
  return new DailyRotateFile({
    filename: path.join(logsDir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level,
    format: prodFormat,
    auditFile: path.join(logsDir, '.audit', `${filename}-audit.json`)
  });
}

/**
 * Main logger configuration
 */
class LoggerConfig {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.logLevel = process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info');
    this.service = process.env.SERVICE_NAME || 'agent-orchestration';

    this.defaultMeta = {
      service: this.service,
      hostname: os.hostname(),
      pid: process.pid,
      nodeVersion: process.version
    };

    this.logger = this.createLogger();
  }

  /**
   * Create the main logger instance
   */
  createLogger() {
    const transports = this.getTransports();

    const logger = winston.createLogger({
      levels: customLevels.levels,
      level: this.logLevel,
      defaultMeta: this.defaultMeta,
      format: this.isDevelopment ? devFormat : prodFormat,
      transports,
      exitOnError: false,
      silent: process.env.DISABLE_LOGGING === 'true'
    });

    // Handle uncaught exceptions and rejections
    if (process.env.LOG_EXCEPTIONS !== 'false') {
      logger.exceptions.handle(
        new winston.transports.File({
          filename: path.join(logsDir, 'exceptions.log'),
          format: prodFormat
        })
      );

      logger.rejections.handle(
        new winston.transports.File({
          filename: path.join(logsDir, 'rejections.log'),
          format: prodFormat
        })
      );
    }

    return logger;
  }

  /**
   * Get transports based on environment
   */
  getTransports() {
    const transports = [];

    // Console transport
    if (this.isDevelopment || process.env.LOG_TO_CONSOLE === 'true') {
      transports.push(new winston.transports.Console({
        format: this.isDevelopment ? devFormat : prodFormat,
        handleExceptions: true,
        handleRejections: true
      }));
    }

    // File transports for production or when explicitly requested
    if (!this.isDevelopment || process.env.LOG_TO_FILE === 'true') {
      // Error log file
      transports.push(createRotatingFileTransport('error', 'error'));

      // Combined log file
      transports.push(createRotatingFileTransport('combined', 'info'));

      // Debug log file (only if debug level is enabled)
      if (this.logLevel === 'debug' || this.logLevel === 'silly') {
        transports.push(createRotatingFileTransport('debug', 'debug'));
      }

      // HTTP request log file
      transports.push(createRotatingFileTransport('http', 'http'));

      // Performance log file
      transports.push(new winston.transports.File({
        filename: path.join(logsDir, 'performance.log'),
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }));
    }

    return transports;
  }

  /**
   * Create a child logger with additional context
   */
  createChildLogger(module, additionalMeta = {}) {
    return this.logger.child({
      module,
      ...additionalMeta
    });
  }

  /**
   * Add a custom transport
   */
  addTransport(transport) {
    this.logger.add(transport);
  }

  /**
   * Remove a transport
   */
  removeTransport(transport) {
    this.logger.remove(transport);
  }

  /**
   * Update log level
   */
  setLogLevel(level) {
    this.logger.level = level;
    this.logLevel = level;
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level) {
    return customLevels.levels[level] <= customLevels.levels[this.logLevel];
  }

  /**
   * Stream for Morgan HTTP logging
   */
  getHttpLogStream() {
    return {
      write: (message) => {
        this.logger.http(message.trim());
      }
    };
  }

  /**
   * Performance logging helper
   */
  logPerformance(operation, duration, metadata = {}) {
    const perfLogger = this.createChildLogger('performance');

    const logData = {
      operation,
      duration,
      durationMs: duration,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    if (duration > 1000) {
      perfLogger.warn('Slow operation detected', logData);
    } else {
      perfLogger.info('Operation completed', logData);
    }
  }

  /**
   * Error logging with stack trace
   */
  logError(error, context = {}) {
    const errorLogger = this.createChildLogger('error');

    errorLogger.error(error.message || 'Unknown error', {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      },
      ...context
    });
  }

  /**
   * Audit logging for important events
   */
  logAudit(action, userId, metadata = {}) {
    const auditLogger = this.createChildLogger('audit');

    auditLogger.info(`Audit: ${action}`, {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      ...metadata
    });
  }

  /**
   * Query logger for database operations
   */
  logQuery(query, duration, metadata = {}) {
    const queryLogger = this.createChildLogger('database');

    const logData = {
      query: query.substring(0, 1000), // Truncate long queries
      duration,
      rows: metadata.rows,
      ...metadata
    };

    if (duration > 100) {
      queryLogger.warn('Slow query detected', logData);
    } else {
      queryLogger.debug('Query executed', logData);
    }
  }

  /**
   * Shutdown logger gracefully
   */
  async shutdown() {
    return new Promise((resolve) => {
      this.logger.end(() => {
        resolve();
      });
    });
  }
}

// Export singleton instance
const loggerConfig = new LoggerConfig();

export const logger = loggerConfig.logger;
export { loggerConfig };
export const createChildLogger = (module, meta) => loggerConfig.createChildLogger(module, meta);
export const logPerformance = (...args) => loggerConfig.logPerformance(...args);
export const logError = (...args) => loggerConfig.logError(...args);
export const logAudit = (...args) => loggerConfig.logAudit(...args);
export const logQuery = (...args) => loggerConfig.logQuery(...args);
export const setLogLevel = (level) => loggerConfig.setLogLevel(level);
export const isDebugEnabled = () => loggerConfig.isLevelEnabled('debug');
export const getHttpLogStream = () => loggerConfig.getHttpLogStream();
export const shutdown = () => loggerConfig.shutdown();