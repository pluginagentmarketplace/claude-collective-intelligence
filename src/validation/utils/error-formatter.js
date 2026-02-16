/**
 * Advanced Error Formatting Utilities
 *
 * Provides comprehensive error formatting for different contexts:
 * - User-friendly messages
 * - API responses
 * - Logging entries
 * - Documentation/suggestions
 *
 * Ensures consistent error handling across the application
 */

import logger from '../../logger/module-loggers.js';

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Error codes for different scenarios
 */
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_TYPE: 'UNKNOWN_TYPE',
  PARSE_ERROR: 'PARSE_ERROR',
  SCHEMA_NOT_FOUND: 'SCHEMA_NOT_FOUND',

  // Security errors
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  MALICIOUS_PATTERN_DETECTED: 'MALICIOUS_PATTERN_DETECTED',
  SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT: 'XSS_ATTEMPT',
  COMMAND_INJECTION_ATTEMPT: 'COMMAND_INJECTION_ATTEMPT',

  // Type errors
  INVALID_TYPE: 'INVALID_TYPE',
  TYPE_MISMATCH: 'TYPE_MISMATCH',

  // Range errors
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',
  VALUE_TOO_SMALL: 'VALUE_TOO_SMALL',
  VALUE_TOO_LARGE: 'VALUE_TOO_LARGE',

  // Business logic errors
  BUSINESS_LOGIC_VIOLATION: 'BUSINESS_LOGIC_VIOLATION',
  DEPENDENCY_FAILED: 'DEPENDENCY_FAILED',
  INVALID_STATE: 'INVALID_STATE'
};

/**
 * Main Error Formatter Class
 */
export class ErrorFormatter {
  constructor(options = {}) {
    this.options = {
      includeStackTrace: false,
      includeContext: true,
      locale: 'en',
      maxDetailLength: 200,
      ...options
    };

    this.messages = this.loadMessages();
  }

  /**
   * Load localized messages
   */
  loadMessages() {
    return {
      en: {
        'any.required': '{field} is required',
        'any.only': '{field} must be one of: {options}',
        'string.empty': '{field} cannot be empty',
        'string.min': '{field} must be at least {limit} characters',
        'string.max': '{field} must be at most {limit} characters',
        'string.pattern.base': '{field} has an invalid format',
        'string.email': '{field} must be a valid email',
        'string.uri': '{field} must be a valid URL',
        'string.uuid': '{field} must be a valid UUID',
        'string.ip': '{field} must be a valid IP address',
        'number.base': '{field} must be a number',
        'number.min': '{field} must be at least {limit}',
        'number.max': '{field} must be at most {limit}',
        'number.integer': '{field} must be an integer',
        'array.base': '{field} must be an array',
        'array.min': '{field} must have at least {limit} items',
        'array.max': '{field} must have at most {limit} items',
        'array.unique': '{field} items must be unique',
        'object.base': '{field} must be an object',
        'object.unknown': '{field} is not allowed',
        'date.base': '{field} must be a valid date',
        'date.min': '{field} must be after {limit}',
        'date.max': '{field} must be before {limit}'
      }
    };
  }

  /**
   * Get message for a locale
   */
  getMessage(key, locale = this.options.locale) {
    return this.messages[locale]?.[key] || this.messages['en'][key];
  }

  /**
   * Format single validation error detail
   */
  formatDetail(detail, context = {}) {
    const field = detail.path.join('.');
    const type = detail.type;
    const ctx = detail.context || {};

    // Get template message
    let message = this.getMessage(type) || detail.message;

    // Replace placeholders
    message = message.replace('{field}', field);
    message = message.replace('{limit}', ctx.limit);
    message = message.replace('{options}', ctx.valids?.join(', ') || 'valid options');
    message = message.replace('{value}', this.formatValue(ctx.value));

    return {
      field,
      message,
      type,
      severity: this.getErrorSeverity(type),
      ...(this.options.includeContext && {
        context: {
          limit: ctx.limit,
          value: ctx.value ? this.formatValue(ctx.value) : null,
          label: ctx.label
        }
      })
    };
  }

  /**
   * Format multiple validation errors
   */
  formatValidationErrors(joiError) {
    if (!joiError.details) {
      return [
        {
          message: joiError.message || 'Validation failed',
          severity: ERROR_SEVERITY.ERROR
        }
      ];
    }

    return joiError.details.map(detail => this.formatDetail(detail));
  }

  /**
   * Format error for API response
   */
  formatForAPI(error, context = {}) {
    const isValidationError = error.details !== undefined;

    return {
      error: {
        code: context.code || (isValidationError ? ERROR_CODES.VALIDATION_FAILED : 'INTERNAL_ERROR'),
        message: context.message || (isValidationError ? 'Validation failed' : 'An error occurred'),
        ...(isValidationError && {
          details: this.formatValidationErrors(error),
          validationCount: error.details.length
        }),
        timestamp: new Date().toISOString(),
        ...(context.requestId && { requestId: context.requestId }),
        ...(context.path && { path: context.path })
      }
    };
  }

  /**
   * Format error for logging
   */
  formatForLog(error, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: context.level || ERROR_SEVERITY.ERROR,
      code: context.code || 'UNKNOWN_ERROR',
      message: error.message || String(error),
      context: context.context || {}
    };

    if (error.details) {
      entry.validationErrors = this.formatValidationErrors(error);
    }

    if (this.options.includeStackTrace && error.stack) {
      entry.stack = error.stack.split('\n').slice(0, 5); // First 5 lines
    }

    return entry;
  }

  /**
   * Format for user display
   */
  formatForUser(error) {
    if (!error.details) {
      return 'An error occurred. Please try again.';
    }

    const messages = this.formatValidationErrors(error);
    if (messages.length === 0) {
      return 'Validation failed. Please check your input.';
    }

    if (messages.length === 1) {
      return messages[0].message;
    }

    // Multiple errors - return as list
    return {
      summary: `${messages.length} error(s) found:`,
      errors: messages.map(m => m.message)
    };
  }

  /**
   * Get error severity based on error type
   */
  getErrorSeverity(type) {
    const severityMap = {
      'any.required': ERROR_SEVERITY.ERROR,
      'string.empty': ERROR_SEVERITY.ERROR,
      'number.base': ERROR_SEVERITY.ERROR,
      'string.pattern.base': ERROR_SEVERITY.WARNING,
      'string.min': ERROR_SEVERITY.WARNING,
      'string.max': ERROR_SEVERITY.WARNING,
      'any.only': ERROR_SEVERITY.ERROR
    };

    return severityMap[type] || ERROR_SEVERITY.WARNING;
  }

  /**
   * Format value for display
   */
  formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
      return value.length > this.options.maxDetailLength
        ? value.substring(0, this.options.maxDetailLength) + '...'
        : `"${value}"`;
    }
    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      return str.length > this.options.maxDetailLength
        ? str.substring(0, this.options.maxDetailLength) + '...'
        : str;
    }
    return String(value);
  }

  /**
   * Create error with consistent structure
   */
  createError(code, message, details = {}) {
    return {
      code,
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log and format error
   */
  logAndFormat(error, context = {}) {
    const formatted = this.formatForLog(error, context);
    logger.log(formatted.level, formatted.message, formatted);
    return this.formatForAPI(error, context);
  }
}

/**
 * Security-focused error formatter
 */
export class SecurityErrorFormatter extends ErrorFormatter {
  /**
   * Format security error
   */
  formatSecurityError(type, details = {}) {
    const message = this.getSecurityErrorMessage(type);

    return {
      error: {
        code: this.getSecurityErrorCode(type),
        message,
        severity: ERROR_SEVERITY.CRITICAL,
        timestamp: new Date().toISOString(),
        ...(details.attemptedValue && {
          context: {
            attemptedValueLength: String(details.attemptedValue).length,
            detectedPatterns: details.patterns || []
          }
        })
      }
    };
  }

  /**
   * Get security error message
   */
  getSecurityErrorMessage(type) {
    const messages = {
      'sql_injection': 'Potential SQL injection detected. Request blocked.',
      'xss_attack': 'Potential XSS attack detected. Request blocked.',
      'command_injection': 'Potential command injection detected. Request blocked.',
      'path_traversal': 'Path traversal attempt detected. Request blocked.',
      'nosql_injection': 'Potential NoSQL injection detected. Request blocked.'
    };

    return messages[type] || 'Security violation detected. Request blocked.';
  }

  /**
   * Get security error code
   */
  getSecurityErrorCode(type) {
    const codes = {
      'sql_injection': ERROR_CODES.SQL_INJECTION_ATTEMPT,
      'xss_attack': ERROR_CODES.XSS_ATTEMPT,
      'command_injection': ERROR_CODES.COMMAND_INJECTION_ATTEMPT,
      'path_traversal': ERROR_CODES.SECURITY_VIOLATION,
      'nosql_injection': ERROR_CODES.SECURITY_VIOLATION
    };

    return codes[type] || ERROR_CODES.SECURITY_VIOLATION;
  }
}

/**
 * Create singleton instances
 */
const defaultFormatter = new ErrorFormatter();
const securityFormatter = new SecurityErrorFormatter();

/**
 * Convenience functions
 */
export function formatError(error, context = {}) {
  return defaultFormatter.formatForAPI(error, context);
}

export function formatValidationError(joiError, context = {}) {
  return defaultFormatter.formatForAPI(joiError, context);
}

export function formatForUser(error) {
  return defaultFormatter.formatForUser(error);
}

export function logError(error, context = {}) {
  return defaultFormatter.logAndFormat(error, context);
}

export function formatSecurityError(type, details = {}) {
  return securityFormatter.formatSecurityError(type, details);
}

/**
 * Export instances and classes
 */
export default {
  ErrorFormatter,
  SecurityErrorFormatter,
  ERROR_SEVERITY,
  ERROR_CODES,
  formatError,
  formatValidationError,
  formatForUser,
  logError,
  formatSecurityError
};
