/**
 * Error Formatter
 * Formats errors for different output contexts (API responses, logs, etc.)
 */

const { HTTP_STATUS_CODES, ERROR_MESSAGES } = require('./error-constants');

class ErrorFormatter {
  constructor(config = {}) {
    this.config = {
      includeStack: process.env.NODE_ENV === 'development',
      includeContext: false,
      includeTimestamp: true,
      includeCorrelationId: true,
      sanitize: true,
      format: 'standard', // standard, detailed, minimal, custom
      ...config
    };
  }

  /**
   * Main format method
   */
  format(error, options = {}) {
    const formatOptions = { ...this.config, ...options };

    switch (formatOptions.format) {
      case 'detailed':
        return this.formatDetailed(error, formatOptions);
      case 'minimal':
        return this.formatMinimal(error, formatOptions);
      case 'custom':
        return this.formatCustom(error, formatOptions);
      case 'standard':
      default:
        return this.formatStandard(error, formatOptions);
    }
  }

  /**
   * Standard format for API responses
   */
  formatStandard(error, options) {
    const formatted = {
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: this.getUserFriendlyMessage(error),
        type: error.name || 'Error'
      }
    };

    // Add optional fields
    if (options.includeTimestamp) {
      formatted.timestamp = error.timestamp || new Date().toISOString();
    }

    if (options.includeCorrelationId && error.correlationId) {
      formatted.correlationId = error.correlationId;
    }

    // Add details if available
    if (error.details) {
      formatted.error.details = this.sanitizeDetails(error.details, options);
    }

    // Add validation errors
    if (error.validationErrors) {
      formatted.error.validation = this.formatValidationErrors(error.validationErrors);
    }

    // Add recovery information
    if (options.recovery) {
      formatted.recovery = this.formatRecoveryInfo(options.recovery);
    }

    // Add stack trace in development
    if (options.includeStack && error.stack) {
      formatted.error.stack = this.formatStackTrace(error.stack);
    }

    return formatted;
  }

  /**
   * Detailed format with all information
   */
  formatDetailed(error, options) {
    const formatted = {
      error: {
        id: error.id || this.generateErrorId(),
        code: error.code,
        message: error.message,
        userMessage: this.getUserFriendlyMessage(error),
        type: error.name,
        category: error.category,
        severity: error.severity,
        statusCode: error.statusCode || 500
      },
      metadata: {
        timestamp: error.timestamp || new Date().toISOString(),
        correlationId: error.correlationId,
        environment: process.env.NODE_ENV,
        host: process.env.HOSTNAME,
        service: process.env.SERVICE_NAME || 'ai-agent-rabbitmq'
      }
    };

    // Add context if requested
    if (options.includeContext && error.context) {
      formatted.context = this.sanitizeContext(error.context, options);
    }

    // Add details
    if (error.details) {
      formatted.error.details = this.sanitizeDetails(error.details, options);
    }

    // Add original error info
    if (error.originalError) {
      formatted.originalError = {
        message: error.originalError.message,
        type: error.originalError.name,
        code: error.originalError.code
      };
    }

    // Add stack trace
    if (options.includeStack && error.stack) {
      formatted.debug = {
        stack: this.formatStackTrace(error.stack),
        file: this.extractFileInfo(error.stack),
        line: this.extractLineNumber(error.stack)
      };
    }

    // Add recovery information
    if (options.recovery) {
      formatted.recovery = this.formatRecoveryInfo(options.recovery);
    }

    // Add suggestions
    formatted.suggestions = this.generateSuggestions(error);

    // Add documentation link
    formatted.documentation = this.getDocumentationLink(error);

    return formatted;
  }

  /**
   * Minimal format with essential information only
   */
  formatMinimal(error, options) {
    return {
      error: this.getUserFriendlyMessage(error),
      code: error.code || 'ERROR'
    };
  }

  /**
   * Custom format using provided formatter
   */
  formatCustom(error, options) {
    if (!options.customFormatter || typeof options.customFormatter !== 'function') {
      return this.formatStandard(error, options);
    }

    try {
      return options.customFormatter(error, options);
    } catch (formatError) {
      console.error('Custom formatter failed:', formatError);
      return this.formatStandard(error, options);
    }
  }

  /**
   * Format for logging
   */
  formatForLog(error, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: this.getLogLevel(error),
      error: {
        code: error.code,
        message: error.message,
        category: error.category,
        severity: error.severity,
        stack: error.stack
      },
      context: this.sanitizeContext(context),
      correlationId: error.correlationId,
      metadata: {
        environment: process.env.NODE_ENV,
        service: process.env.SERVICE_NAME,
        version: process.env.APP_VERSION
      }
    };
  }

  /**
   * Format for monitoring systems
   */
  formatForMonitoring(error) {
    return {
      timestamp: Date.now(),
      error_code: error.code,
      error_category: error.category,
      error_severity: error.severity,
      error_message: error.message,
      correlation_id: error.correlationId,
      tags: {
        environment: process.env.NODE_ENV,
        service: process.env.SERVICE_NAME,
        category: error.category,
        severity: error.severity
      },
      fields: {
        status_code: error.statusCode,
        retry_count: error.retryCount || 0,
        recovered: error.recovered || false
      }
    };
  }

  /**
   * Format validation errors
   */
  formatValidationErrors(validationErrors) {
    if (!Array.isArray(validationErrors)) {
      return validationErrors;
    }

    return validationErrors.map(err => ({
      field: err.field || err.path,
      message: err.message,
      value: process.env.NODE_ENV === 'production' ? '[REDACTED]' : err.value,
      constraint: err.constraint || err.type
    }));
  }

  /**
   * Format recovery information
   */
  formatRecoveryInfo(recovery) {
    if (!recovery) return null;

    const info = {
      attempted: true,
      success: recovery.success,
      strategy: recovery.strategy
    };

    if (recovery.success) {
      info.message = 'Error was successfully recovered';
      if (recovery.attempts) {
        info.attempts = recovery.attempts;
      }
    } else {
      info.message = recovery.reason || 'Recovery failed';
      if (recovery.retryAfter) {
        info.retryAfter = recovery.retryAfter;
      }
    }

    return info;
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error) {
    // Check for custom user message
    if (error.userMessage) {
      return error.userMessage;
    }

    // Check for predefined messages
    const template = ERROR_MESSAGES[error.code];
    if (template) {
      return typeof template === 'function'
        ? template(error.field || error.resource || 'resource')
        : template;
    }

    // Sanitize technical message
    if (error.message) {
      return this.sanitizeMessage(error.message);
    }

    // Default message
    return 'An error occurred while processing your request';
  }

  /**
   * Sanitize error message
   */
  sanitizeMessage(message) {
    // Remove sensitive patterns
    const patterns = [
      /password["\s]*[:=]["\s]*["'][^"']+["']/gi,
      /token["\s]*[:=]["\s]*["'][^"']+["']/gi,
      /api[_-]?key["\s]*[:=]["\s]*["'][^"']+["']/gi,
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      /\b\d{3}-\d{2}-\d{4}\b/g
    ];

    let sanitized = message;
    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Remove file paths in production
    if (process.env.NODE_ENV === 'production') {
      sanitized = sanitized.replace(/\/[\w\/\-\.]+/g, '[PATH]');
    }

    return sanitized;
  }

  /**
   * Sanitize error details
   */
  sanitizeDetails(details, options = {}) {
    if (!options.sanitize) return details;

    const sanitized = { ...details };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard', 'ssn'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeDetails(sanitized[key], options);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize context
   */
  sanitizeContext(context, options = {}) {
    if (!options.sanitize) return context;

    return this.sanitizeDetails(context, options);
  }

  /**
   * Format stack trace
   */
  formatStackTrace(stack) {
    if (!stack) return null;

    // In production, limit stack trace
    if (process.env.NODE_ENV === 'production') {
      const lines = stack.split('\n');
      return lines.slice(0, 5).join('\n');
    }

    // In development, clean up paths
    return stack
      .replace(/\\/g, '/')
      .replace(/\s+at\s+/g, '\n  at ')
      .trim();
  }

  /**
   * Extract file info from stack
   */
  extractFileInfo(stack) {
    if (!stack) return null;

    const match = stack.match(/at\s+.*\s+\((.*):(\d+):(\d+)\)/);
    if (match) {
      return {
        path: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3])
      };
    }

    return null;
  }

  /**
   * Extract line number from stack
   */
  extractLineNumber(stack) {
    const fileInfo = this.extractFileInfo(stack);
    return fileInfo ? fileInfo.line : null;
  }

  /**
   * Generate suggestions based on error
   */
  generateSuggestions(error) {
    const suggestions = [];

    switch (error.category) {
      case 'VALIDATION_ERROR':
        suggestions.push('Check the input data format and required fields');
        suggestions.push('Refer to the API documentation for valid input schemas');
        break;

      case 'AUTHENTICATION_ERROR':
        suggestions.push('Verify your authentication credentials');
        suggestions.push('Check if your token has expired');
        suggestions.push('Ensure you have the correct permissions');
        break;

      case 'NETWORK_ERROR':
        suggestions.push('Check your internet connection');
        suggestions.push('Verify the service endpoint is correct');
        suggestions.push('Try again in a few moments');
        break;

      case 'RATE_LIMIT_ERROR':
        suggestions.push('Reduce the frequency of your requests');
        suggestions.push('Implement exponential backoff');
        suggestions.push(`Wait ${error.retryAfter || 60} seconds before retrying`);
        break;

      case 'DATABASE_ERROR':
        suggestions.push('Check database connection settings');
        suggestions.push('Verify database is running and accessible');
        suggestions.push('Check for database locks or deadlocks');
        break;

      case 'QUEUE_ERROR':
        suggestions.push('Verify RabbitMQ connection settings');
        suggestions.push('Check queue configuration and permissions');
        suggestions.push('Ensure RabbitMQ service is running');
        break;

      default:
        suggestions.push('Try again later');
        suggestions.push('Contact support if the problem persists');
    }

    return suggestions;
  }

  /**
   * Get documentation link for error
   */
  getDocumentationLink(error) {
    const baseUrl = process.env.DOCS_URL || 'https://docs.example.com';
    return `${baseUrl}/errors/${error.code || 'UNKNOWN_ERROR'}`;
  }

  /**
   * Get appropriate log level
   */
  getLogLevel(error) {
    const severityToLevel = {
      'CRITICAL': 'error',
      'HIGH': 'error',
      'MEDIUM': 'warn',
      'LOW': 'info'
    };

    return severityToLevel[error.severity] || 'error';
  }

  /**
   * Generate error ID
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format error for HTML response
   */
  formatHTML(error, options = {}) {
    const data = this.formatStandard(error, options);

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Error ${data.error.code}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .error { background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 5px; }
    .code { color: #721c24; font-weight: bold; }
    .message { color: #721c24; margin: 10px 0; }
    .suggestions { margin-top: 20px; }
    .suggestions ul { margin: 10px 0; }
  </style>
</head>
<body>
  <div class="error">
    <div class="code">Error Code: ${data.error.code}</div>
    <div class="message">${data.error.message}</div>
    ${data.recovery ? `<div class="recovery">Recovery: ${data.recovery.message}</div>` : ''}
    ${options.includeStack ? `<pre>${data.error.stack || ''}</pre>` : ''}
  </div>
</body>
</html>`;
  }

  /**
   * Format error for CLI output
   */
  formatCLI(error, options = {}) {
    const colors = {
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      reset: '\x1b[0m',
      bold: '\x1b[1m'
    };

    let output = `${colors.red}${colors.bold}✖ Error: ${error.code}${colors.reset}\n`;
    output += `${colors.red}${error.message}${colors.reset}\n`;

    if (error.details) {
      output += `\n${colors.yellow}Details:${colors.reset}\n`;
      output += JSON.stringify(error.details, null, 2);
    }

    if (options.includeStack && error.stack) {
      output += `\n${colors.yellow}Stack Trace:${colors.reset}\n`;
      output += error.stack;
    }

    return output;
  }
}

module.exports = ErrorFormatter;