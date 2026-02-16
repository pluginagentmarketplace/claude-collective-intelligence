/**
 * Custom Log Formatters
 * Advanced formatting options for different logging scenarios
 */

import winston from 'winston';
const { format } = winston;
import chalk from 'chalk';
import util from 'util';
import os from 'os';
import crypto from 'crypto';

/**
 * Redact sensitive information from logs
 */
const redactSensitive = format((info) => {
  const sensitiveKeys = [
    'password',
    'token',
    'apiKey',
    'api_key',
    'secret',
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'privateKey',
    'private_key',
    'clientSecret',
    'client_secret',
    'refreshToken',
    'refresh_token',
    'accessToken',
    'access_token'
  ];

  const redactValue = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;

    const result = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in result) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (typeof result[key] === 'object') {
        result[key] = redactValue(result[key]);
      }
    }

    return result;
  };

  return redactValue(info);
});

/**
 * Mask personally identifiable information (PII)
 */
const maskPII = format((info) => {
  const maskEmail = (email) => {
    if (typeof email !== 'string') return email;
    return email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
  };

  const maskPhone = (phone) => {
    if (typeof phone !== 'string') return phone;
    return phone.replace(/\d(?=\d{4})/g, '*');
  };

  const maskSSN = (ssn) => {
    if (typeof ssn !== 'string') return ssn;
    return ssn.replace(/^\d{3}-?\d{2}/, '***-**');
  };

  const maskCreditCard = (cc) => {
    if (typeof cc !== 'string') return cc;
    return cc.replace(/\d(?=\d{4})/g, '*');
  };

  const maskIP = (ip) => {
    if (typeof ip !== 'string') return ip;
    // Mask last octet of IPv4
    return ip.replace(/(\d+\.\d+\.\d+\.)\d+/, '$1***');
  };

  const maskData = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;

    const result = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key in result) {
      const lowerKey = key.toLowerCase();

      if (lowerKey.includes('email')) {
        result[key] = maskEmail(result[key]);
      } else if (lowerKey.includes('phone')) {
        result[key] = maskPhone(result[key]);
      } else if (lowerKey.includes('ssn') || lowerKey.includes('social')) {
        result[key] = maskSSN(result[key]);
      } else if (lowerKey.includes('card') || lowerKey.includes('credit')) {
        result[key] = maskCreditCard(result[key]);
      } else if (lowerKey === 'ip' || lowerKey.includes('ipaddress')) {
        result[key] = maskIP(result[key]);
      } else if (typeof result[key] === 'object') {
        result[key] = maskData(result[key]);
      }
    }

    return result;
  };

  return maskData(info);
});

/**
 * Add caller information (file, line, function)
 */
const addCallerInfo = format((info) => {
  const stack = new Error().stack;
  const callerLine = stack.split('\n')[3]; // Get caller line
  const match = callerLine.match(/at (.+) \((.+):(\d+):(\d+)\)/);

  if (match) {
    info.caller = {
      function: match[1],
      file: match[2].split('/').pop(),
      line: match[3],
      column: match[4]
    };
  }

  return info;
});

/**
 * Format for CloudWatch
 */
const cloudWatchFormat = format.combine(
  format.timestamp(),
  format.json(),
  format((info) => {
    return {
      timestamp: info.timestamp,
      message: info.message,
      level: info.level.toUpperCase(),
      logger: info.module || 'default',
      ...info,
      '@metadata': {
        correlationId: info.correlationId,
        requestId: info.requestId,
        version: process.env.APP_VERSION || '1.0.0'
      }
    };
  })()
);

/**
 * Format for ELK Stack (Elasticsearch, Logstash, Kibana)
 */
const elkFormat = format.combine(
  format.timestamp(),
  format.json(),
  format((info) => {
    return {
      '@timestamp': info.timestamp,
      '@version': '1',
      message: info.message,
      severity: info.level,
      logger_name: info.module || 'default',
      thread_name: `pid-${process.pid}`,
      level: info.level.toUpperCase(),
      level_value: getLogLevelValue(info.level),
      ...info,
      environment: process.env.NODE_ENV || 'development',
      application: process.env.APP_NAME || 'agent-orchestration',
      hostname: os.hostname()
    };
  })()
);

/**
 * Format for Datadog
 */
const datadogFormat = format.combine(
  format.timestamp(),
  format.json(),
  format((info) => {
    return {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: info.service || 'agent-orchestration',
      dd: {
        trace_id: info.correlationId,
        span_id: info.requestId,
        env: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0'
      },
      usr: {
        id: info.userId,
        name: info.userName,
        email: info.userEmail
      },
      ...info
    };
  })()
);

/**
 * Pretty print format for development
 */
const prettyFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true }),
  format.colorize(),
  format.printf(({ timestamp, level, message, module, error, ...meta }) => {
    let output = `${chalk.gray(timestamp)} ${level}`;

    if (module) {
      output += ` ${chalk.cyan(`[${module}]`)}`;
    }

    output += ` ${chalk.white(message)}`;

    // Add error stack if present
    if (error && error.stack) {
      output += `\n${chalk.red(error.stack)}`;
    }

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      const formattedMeta = util.inspect(meta, {
        colors: true,
        depth: 3,
        compact: false
      });
      output += `\n${formattedMeta}`;
    }

    return output;
  })
);

/**
 * Compact format for production console
 */
const compactFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, module, ...meta }) => {
    const moduleStr = module ? `[${module}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level.toUpperCase()}] ${moduleStr} ${message}${metaStr}`;
  })
);

/**
 * Format for structured logging with correlation
 */
const structuredFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.json(),
  format((info) => {
    // Add structured metadata
    const structured = {
      timestamp: info.timestamp,
      level: info.level,
      service: info.service || 'agent-orchestration',
      module: info.module,
      message: info.message,
      correlationId: info.correlationId,
      requestId: info.requestId,
      traceId: info.traceId,
      spanId: info.spanId,
      parentSpanId: info.parentSpanId,
      userId: info.userId,
      sessionId: info.sessionId,
      environment: process.env.NODE_ENV || 'development'
    };

    // Add error details if present
    if (info.error) {
      structured.error = {
        message: info.error.message || info.error,
        stack: info.error.stack,
        code: info.error.code,
        type: info.error.name || 'Error'
      };
    }

    // Add performance metrics if present
    if (info.duration !== undefined) {
      structured.performance = {
        duration: info.duration,
        durationMs: info.duration,
        slow: info.duration > 1000
      };
    }

    // Add custom metadata
    Object.keys(info).forEach(key => {
      if (!structured[key] && !['timestamp', 'level', 'message', 'error'].includes(key)) {
        structured[key] = info[key];
      }
    });

    return structured;
  })()
);

/**
 * SQL query format (for logging database queries)
 */
const sqlFormat = format.combine(
  format.timestamp(),
  format.json(),
  format((info) => {
    if (info.query) {
      return {
        ...info,
        query: info.query.replace(/\s+/g, ' ').trim(),
        queryHash: crypto
          .createHash('md5')
          .update(info.query)
          .digest('hex'),
        duration: info.duration,
        slow: info.duration > 100
      };
    }
    return info;
  })()
);

/**
 * HTTP request format
 */
const httpFormat = format.combine(
  format.timestamp(),
  format.json(),
  format((info) => {
    if (info.req) {
      return {
        ...info,
        request: {
          method: info.req.method,
          url: info.req.url,
          headers: sanitizeHeaders(info.req.headers),
          body: info.req.body ? '[BODY]' : undefined,
          ip: info.req.ip,
          userAgent: info.req.get('user-agent')
        },
        response: info.res ? {
          statusCode: info.res.statusCode,
          headers: info.res.getHeaders()
        } : undefined
      };
    }
    return info;
  })()
);

/**
 * Metrics format for performance monitoring
 */
const metricsFormat = format.combine(
  format.timestamp(),
  format.json(),
  format((info) => {
    if (info.metrics) {
      return {
        ...info,
        metrics: {
          ...info.metrics,
          timestamp: info.timestamp,
          tags: info.tags || {},
          fields: info.fields || {}
        }
      };
    }
    return info;
  })()
);

/**
 * Error format with stack trace parsing
 */
const errorFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
  format((info) => {
    if (info.stack) {
      const stackLines = info.stack.split('\n');
      const stackTrace = stackLines.slice(1).map(line => {
        const match = line.match(/at (.+) \((.+):(\d+):(\d+)\)/);
        if (match) {
          return {
            function: match[1].trim(),
            file: match[2],
            line: parseInt(match[3]),
            column: parseInt(match[4])
          };
        }
        return { raw: line.trim() };
      });

      return {
        ...info,
        error: {
          message: info.message,
          type: info.name || 'Error',
          stackTrace
        }
      };
    }
    return info;
  })()
);

/**
 * Audit log format for compliance
 */
const auditFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.json(),
  format((info) => {
    return {
      timestamp: info.timestamp,
      eventType: 'AUDIT',
      action: info.action,
      userId: info.userId,
      userName: info.userName,
      resource: info.resource,
      resourceId: info.resourceId,
      result: info.result || 'success',
      ip: info.ip,
      userAgent: info.userAgent,
      details: info.details,
      checksum: generateChecksum(info)
    };
  })()
);

/**
 * Helper functions
 */

function getLogLevelValue(level) {
  const levels = {
    error: 40000,
    warn: 30000,
    info: 20000,
    http: 15000,
    verbose: 10000,
    debug: 5000,
    silly: 1000
  };
  return levels[level] || 0;
}

function sanitizeHeaders(headers) {
  const sensitive = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  const sanitized = { ...headers };

  sensitive.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

function generateChecksum(data) {
  const content = JSON.stringify({
    timestamp: data.timestamp,
    action: data.action,
    userId: data.userId,
    resource: data.resource,
    result: data.result
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Custom transport for external services
 */
class ExternalServiceTransport extends winston.Transport {
  constructor(options) {
    super(options);
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey;
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 5000;
    this.buffer = [];
    this.timer = null;
  }

  log(info, callback) {
    this.buffer.push(info);

    if (this.buffer.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }

    callback();
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0) return;

    const logs = [...this.buffer];
    this.buffer = [];

    try {
      // Send logs to external service
      // This is a placeholder - implement actual HTTP request
      console.log(`Sending ${logs.length} logs to ${this.endpoint}`);
    } catch (error) {
      // Re-add logs to buffer on failure
      this.buffer.unshift(...logs);
      console.error('Failed to send logs:', error);
    }
  }

  close() {
    this.flush();
  }
}

/**
 * Export formatters and utilities
 */

// Export formatters
export {
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

// Export custom transport
export { ExternalServiceTransport };

// Export utility functions
export {
  sanitizeHeaders,
  generateChecksum,
  getLogLevelValue
};

// Export preset combinations
export const presets = {
  development: format.combine(
    redactSensitive(),
    maskPII(),
    addCallerInfo(),
    prettyFormat
  ),
  production: format.combine(
    redactSensitive(),
    maskPII(),
    structuredFormat
  ),
  cloudwatch: format.combine(
    redactSensitive(),
    maskPII(),
    cloudWatchFormat
  ),
  elk: format.combine(
    redactSensitive(),
    maskPII(),
    elkFormat
  ),
  datadog: format.combine(
    redactSensitive(),
    maskPII(),
    datadogFormat
  ),
  audit: format.combine(
    maskPII(),
    auditFormat
  )
};