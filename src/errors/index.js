/**
 * Error Handling System - Main Export
 * Central export point for all error handling components
 */

// Custom Errors
const CustomErrors = require('./custom-errors');

// Error Handler
const { ErrorHandler, errorHandler, handle, initialize } = require('./error-handler');

// Error Recovery
const ErrorRecovery = require('./error-recovery');

// Error Monitor
const ErrorMonitor = require('./error-monitor');

// Error Formatter
const ErrorFormatter = require('./error-formatter');

// Error Constants
const Constants = require('./error-constants');

// Re-export everything
module.exports = {
  // Custom Error Classes
  ...CustomErrors,

  // Error Handler
  ErrorHandler,
  errorHandler,
  handle,
  initialize,

  // Recovery System
  ErrorRecovery,

  // Monitoring System
  ErrorMonitor,

  // Formatter
  ErrorFormatter,

  // Constants
  ...Constants,

  // Quick access to commonly used items
  Errors: CustomErrors,
  Handler: errorHandler,
  Recovery: new ErrorRecovery(),
  Monitor: new ErrorMonitor(),
  Formatter: new ErrorFormatter(),

  // Convenience methods
  /**
   * Create and handle an error in one step
   */
  throwError: async (type, message, context = {}) => {
    const error = CustomErrors.ErrorFactory.create(type, message);
    return handle(error, context);
  },

  /**
   * Create custom error
   */
  createError: (type, message, ...args) => {
    return CustomErrors.ErrorFactory.create(type, message, ...args);
  },

  /**
   * Check if object is a custom error
   */
  isCustomError: (obj) => {
    return obj instanceof CustomErrors.BaseError;
  },

  /**
   * Get error statistics
   */
  getStatistics: async () => {
    return errorHandler.getStatistics();
  },

  /**
   * Get error metrics
   */
  getMetrics: async () => {
    return errorHandler.getMetrics();
  },

  /**
   * Setup Express middleware
   */
  setupMiddleware: (app, options) => {
    const middleware = require('../middleware/error-middleware');
    middleware.setupErrorMiddleware(app, options);
  }
};