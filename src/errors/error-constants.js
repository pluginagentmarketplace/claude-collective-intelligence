/**
 * Error Constants and Configuration
 * Central repository for all error-related constants
 */

// Error Categories
const ERROR_CATEGORIES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BUSINESS_ERROR: 'BUSINESS_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  SECURITY_ERROR: 'SECURITY_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  QUEUE_ERROR: 'QUEUE_ERROR',
  AGENT_ERROR: 'AGENT_ERROR'
};

// Error Codes
const ERROR_CODES = {
  // General
  UNKNOWN_ERROR: 'ERR_UNKNOWN',

  // Validation
  VALIDATION_ERROR: 'ERR_VALIDATION',
  SCHEMA_VALIDATION_ERROR: 'ERR_SCHEMA_VALIDATION',
  INPUT_VALIDATION_ERROR: 'ERR_INPUT_VALIDATION',

  // Network
  NETWORK_ERROR: 'ERR_NETWORK',
  CONNECTION_ERROR: 'ERR_CONNECTION',
  TIMEOUT_ERROR: 'ERR_TIMEOUT',
  DNS_ERROR: 'ERR_DNS',

  // Security
  SECURITY_ERROR: 'ERR_SECURITY',
  AUTHENTICATION_ERROR: 'ERR_AUTH',
  AUTHORIZATION_ERROR: 'ERR_AUTHZ',
  TOKEN_EXPIRED: 'ERR_TOKEN_EXPIRED',

  // Business Logic
  BUSINESS_ERROR: 'ERR_BUSINESS',
  INSUFFICIENT_RESOURCES: 'ERR_INSUFFICIENT_RESOURCES',
  CONFLICT_ERROR: 'ERR_CONFLICT',
  RATE_LIMIT_ERROR: 'ERR_RATE_LIMIT',

  // System
  SYSTEM_ERROR: 'ERR_SYSTEM',
  DATABASE_ERROR: 'ERR_DATABASE',
  FILESYSTEM_ERROR: 'ERR_FILESYSTEM',
  MEMORY_ERROR: 'ERR_MEMORY',

  // Queue (RabbitMQ)
  QUEUE_ERROR: 'ERR_QUEUE',
  PUBLISH_ERROR: 'ERR_PUBLISH',
  CONSUME_ERROR: 'ERR_CONSUME',
  CHANNEL_ERROR: 'ERR_CHANNEL',

  // Agent
  AGENT_ERROR: 'ERR_AGENT',
  AGENT_INIT_ERROR: 'ERR_AGENT_INIT',
  AGENT_COMM_ERROR: 'ERR_AGENT_COMM',
  AGENT_TASK_ERROR: 'ERR_AGENT_TASK'
};

// Severity Levels
const SEVERITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

// Severity Weights (for prioritization)
const SEVERITY_WEIGHTS = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

// HTTP Status Code Mapping
const HTTP_STATUS_CODES = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// Retry Configuration
const RETRY_CONFIG = {
  DEFAULT: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterRange: [0.8, 1.2]
  },
  NETWORK: {
    maxAttempts: 5,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitterRange: [0.7, 1.3]
  },
  DATABASE: {
    maxAttempts: 3,
    initialDelay: 500,
    maxDelay: 10000,
    backoffMultiplier: 1.5,
    jitterRange: [0.9, 1.1]
  },
  QUEUE: {
    maxAttempts: 4,
    initialDelay: 1500,
    maxDelay: 45000,
    backoffMultiplier: 2.5,
    jitterRange: [0.8, 1.2]
  }
};

// Retryable Error Categories
const RETRYABLE_ERRORS = [
  ERROR_CATEGORIES.NETWORK_ERROR,
  ERROR_CATEGORIES.TIMEOUT_ERROR,
  ERROR_CATEGORIES.DATABASE_ERROR,
  ERROR_CATEGORIES.QUEUE_ERROR
];

// Non-Retryable Error Categories
const NON_RETRYABLE_ERRORS = [
  ERROR_CATEGORIES.VALIDATION_ERROR,
  ERROR_CATEGORIES.SECURITY_ERROR,
  ERROR_CATEGORIES.BUSINESS_ERROR
];

// Circuit Breaker Configuration
const CIRCUIT_BREAKER_CONFIG = {
  DEFAULT: {
    threshold: 5,
    timeout: 60000,
    resetTimeout: 120000,
    monitoringPeriod: 20000,
    buckets: 10,
    percentile: 0.5
  },
  DATABASE: {
    threshold: 3,
    timeout: 30000,
    resetTimeout: 60000,
    monitoringPeriod: 10000,
    buckets: 10,
    percentile: 0.5
  },
  API: {
    threshold: 10,
    timeout: 120000,
    resetTimeout: 180000,
    monitoringPeriod: 30000,
    buckets: 10,
    percentile: 0.5
  }
};

// Circuit Breaker States
const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

// Alert Thresholds
const ALERT_THRESHOLDS = {
  CRITICAL: {
    errorCount: 1,
    timeWindow: 60000, // 1 minute
    severity: SEVERITY_LEVELS.CRITICAL
  },
  HIGH: {
    errorCount: 10,
    timeWindow: 60000, // 1 minute
    severity: SEVERITY_LEVELS.HIGH
  },
  MEDIUM: {
    errorCount: 50,
    timeWindow: 300000, // 5 minutes
    severity: SEVERITY_LEVELS.MEDIUM
  },
  LOW: {
    errorCount: 100,
    timeWindow: 3600000, // 1 hour
    severity: SEVERITY_LEVELS.LOW
  }
};

// Error Message Templates
const ERROR_MESSAGES = {
  // Validation
  REQUIRED_FIELD: (field) => `${field} is required`,
  INVALID_FORMAT: (field) => `${field} has invalid format`,
  OUT_OF_RANGE: (field, min, max) => `${field} must be between ${min} and ${max}`,

  // Network
  CONNECTION_FAILED: (host) => `Failed to connect to ${host}`,
  TIMEOUT: (operation) => `Operation ${operation} timed out`,

  // Security
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to perform this action',
  TOKEN_EXPIRED: 'Your session has expired. Please login again',

  // Business
  INSUFFICIENT_RESOURCES: (resource) => `Insufficient ${resource} available`,
  CONFLICT: (resource) => `${resource} already exists`,
  RATE_LIMIT: 'Too many requests. Please try again later',

  // System
  INTERNAL_ERROR: 'An internal error occurred. Please try again later',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',

  // Queue
  QUEUE_CONNECTION: 'Failed to connect to message queue',
  PUBLISH_FAILED: 'Failed to publish message',

  // Agent
  AGENT_INIT: (agentId) => `Failed to initialize agent ${agentId}`,
  AGENT_COMM: 'Agent communication failed',
  AGENT_TASK: (taskId) => `Agent task ${taskId} failed`
};

// Monitoring Configuration
const MONITORING_CONFIG = {
  // Metrics collection interval
  COLLECTION_INTERVAL: 60000, // 1 minute

  // Metrics retention
  RETENTION_PERIOD: 86400000, // 24 hours

  // Aggregation windows
  AGGREGATION_WINDOWS: {
    REALTIME: 60000,      // 1 minute
    SHORT: 300000,        // 5 minutes
    MEDIUM: 3600000,      // 1 hour
    LONG: 86400000        // 24 hours
  },

  // Metric types
  METRIC_TYPES: {
    COUNTER: 'COUNTER',
    GAUGE: 'GAUGE',
    HISTOGRAM: 'HISTOGRAM',
    SUMMARY: 'SUMMARY'
  }
};

// Error Logging Configuration
const LOGGING_CONFIG = {
  // Log levels
  LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
    TRACE: 'trace'
  },

  // Log targets
  TARGETS: {
    CONSOLE: 'console',
    FILE: 'file',
    REMOTE: 'remote',
    DATABASE: 'database'
  },

  // Log formatting
  FORMAT: {
    JSON: 'json',
    PLAIN: 'plain',
    PRETTY: 'pretty'
  },

  // Sensitive data patterns to redact
  REDACTION_PATTERNS: [
    /password["\s]*[:=]["\s]*["'][^"']+["']/gi,
    /token["\s]*[:=]["\s]*["'][^"']+["']/gi,
    /api[_-]?key["\s]*[:=]["\s]*["'][^"']+["']/gi,
    /secret["\s]*[:=]["\s]*["'][^"']+["']/gi,
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  ]
};

// Recovery Strategies
const RECOVERY_STRATEGIES = {
  RETRY: 'RETRY',
  CIRCUIT_BREAK: 'CIRCUIT_BREAK',
  FALLBACK: 'FALLBACK',
  CACHE: 'CACHE',
  DEGRADE: 'DEGRADE',
  QUEUE: 'QUEUE',
  IGNORE: 'IGNORE',
  FAIL_FAST: 'FAIL_FAST'
};

// Fallback Configuration
const FALLBACK_CONFIG = {
  // Cache fallback
  CACHE: {
    maxAge: 300000, // 5 minutes
    staleWhileRevalidate: 600000, // 10 minutes
    staleIfError: 86400000 // 24 hours
  },

  // Default values
  DEFAULTS: {
    timeout: 30000,
    retries: 3,
    pageSize: 20,
    maxResults: 100
  }
};

module.exports = {
  ERROR_CATEGORIES,
  ERROR_CODES,
  SEVERITY_LEVELS,
  SEVERITY_WEIGHTS,
  HTTP_STATUS_CODES,
  RETRY_CONFIG,
  RETRYABLE_ERRORS,
  NON_RETRYABLE_ERRORS,
  CIRCUIT_BREAKER_CONFIG,
  CIRCUIT_STATES,
  ALERT_THRESHOLDS,
  ERROR_MESSAGES,
  MONITORING_CONFIG,
  LOGGING_CONFIG,
  RECOVERY_STRATEGIES,
  FALLBACK_CONFIG
};