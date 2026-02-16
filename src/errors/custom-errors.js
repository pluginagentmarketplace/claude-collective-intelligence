/**
 * Custom Error Classes for AI Agent RabbitMQ Plugin
 * Provides hierarchical error structure with detailed context
 */

const { ERROR_CODES, ERROR_CATEGORIES, SEVERITY_LEVELS } = require('./error-constants');

/**
 * Base Error Class
 * All custom errors extend from this class
 */
class BaseError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500, severity = 'MEDIUM') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.timestamp = new Date().toISOString();
    this.correlationId = this.generateCorrelationId();
    this.context = {};
    this.stack = this.captureStack();
    Error.captureStackTrace(this, this.constructor);
  }

  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  captureStack() {
    const stack = new Error().stack;
    return process.env.NODE_ENV === 'production'
      ? stack.split('\n').slice(0, 5).join('\n')
      : stack;
  }

  withContext(context) {
    this.context = { ...this.context, ...context };
    return this;
  }

  withDetails(details) {
    this.details = details;
    return this;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      severity: this.severity,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      context: this.context,
      details: this.details,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }
}

/**
 * Validation Error Classes
 */
class ValidationError extends BaseError {
  constructor(message, field = null, value = null) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, SEVERITY_LEVELS.LOW);
    this.category = ERROR_CATEGORIES.VALIDATION_ERROR;
    this.field = field;
    this.value = process.env.NODE_ENV === 'production' ? '[REDACTED]' : value;
  }
}

class SchemaValidationError extends ValidationError {
  constructor(message, schema, errors = []) {
    super(message);
    this.code = ERROR_CODES.SCHEMA_VALIDATION_ERROR;
    this.schema = schema;
    this.validationErrors = errors;
  }
}

class InputValidationError extends ValidationError {
  constructor(message, input, constraints = {}) {
    super(message);
    this.code = ERROR_CODES.INPUT_VALIDATION_ERROR;
    this.input = input;
    this.constraints = constraints;
  }
}

/**
 * Network Error Classes
 */
class NetworkError extends BaseError {
  constructor(message, endpoint = null, retryable = true) {
    super(message, ERROR_CODES.NETWORK_ERROR, 503, SEVERITY_LEVELS.HIGH);
    this.category = ERROR_CATEGORIES.NETWORK_ERROR;
    this.endpoint = endpoint;
    this.retryable = retryable;
    this.retryCount = 0;
    this.lastRetryAt = null;
  }

  incrementRetry() {
    this.retryCount++;
    this.lastRetryAt = new Date().toISOString();
    return this;
  }
}

class ConnectionError extends NetworkError {
  constructor(message, host, port) {
    super(message, `${host}:${port}`);
    this.code = ERROR_CODES.CONNECTION_ERROR;
    this.host = host;
    this.port = port;
  }
}

class TimeoutError extends NetworkError {
  constructor(message, operation, duration) {
    super(message, operation);
    this.code = ERROR_CODES.TIMEOUT_ERROR;
    this.operation = operation;
    this.duration = duration;
  }
}

class DNSError extends NetworkError {
  constructor(message, hostname) {
    super(message, hostname, false);
    this.code = ERROR_CODES.DNS_ERROR;
    this.hostname = hostname;
  }
}

/**
 * Security Error Classes
 */
class SecurityError extends BaseError {
  constructor(message, resource = null) {
    super(message, ERROR_CODES.SECURITY_ERROR, 403, SEVERITY_LEVELS.CRITICAL);
    this.category = ERROR_CATEGORIES.SECURITY_ERROR;
    this.resource = resource;
    this.logSecurity = true;
  }
}

class AuthenticationError extends SecurityError {
  constructor(message = 'Authentication failed', method = null) {
    super(message);
    this.code = ERROR_CODES.AUTHENTICATION_ERROR;
    this.statusCode = 401;
    this.method = method;
  }
}

class AuthorizationError extends SecurityError {
  constructor(message = 'Authorization failed', requiredPermission = null) {
    super(message);
    this.code = ERROR_CODES.AUTHORIZATION_ERROR;
    this.requiredPermission = requiredPermission;
  }
}

class TokenExpiredError extends SecurityError {
  constructor(message = 'Token has expired', expiresAt = null) {
    super(message);
    this.code = ERROR_CODES.TOKEN_EXPIRED;
    this.statusCode = 401;
    this.expiresAt = expiresAt;
  }
}

/**
 * Business Logic Error Classes
 */
class BusinessLogicError extends BaseError {
  constructor(message, rule = null) {
    super(message, ERROR_CODES.BUSINESS_ERROR, 422, SEVERITY_LEVELS.MEDIUM);
    this.category = ERROR_CATEGORIES.BUSINESS_ERROR;
    this.rule = rule;
  }
}

class InsufficientResourcesError extends BusinessLogicError {
  constructor(message, resource, required, available) {
    super(message, 'INSUFFICIENT_RESOURCES');
    this.code = ERROR_CODES.INSUFFICIENT_RESOURCES;
    this.resource = resource;
    this.required = required;
    this.available = available;
  }
}

class ConflictError extends BusinessLogicError {
  constructor(message, conflictingResource) {
    super(message, 'RESOURCE_CONFLICT');
    this.code = ERROR_CODES.CONFLICT_ERROR;
    this.statusCode = 409;
    this.conflictingResource = conflictingResource;
  }
}

class RateLimitError extends BusinessLogicError {
  constructor(message, limit, window, retryAfter) {
    super(message, 'RATE_LIMIT_EXCEEDED');
    this.code = ERROR_CODES.RATE_LIMIT_ERROR;
    this.statusCode = 429;
    this.limit = limit;
    this.window = window;
    this.retryAfter = retryAfter;
  }
}

/**
 * System Error Classes
 */
class SystemError extends BaseError {
  constructor(message, component = null) {
    super(message, ERROR_CODES.SYSTEM_ERROR, 500, SEVERITY_LEVELS.CRITICAL);
    this.category = ERROR_CATEGORIES.SYSTEM_ERROR;
    this.component = component;
  }
}

class DatabaseError extends SystemError {
  constructor(message, query = null, code = null) {
    super(message, 'DATABASE');
    this.code = code || ERROR_CODES.DATABASE_ERROR;
    this.query = process.env.NODE_ENV === 'production' ? '[QUERY_REDACTED]' : query;
    this.dbCode = code;
  }
}

class FileSystemError extends SystemError {
  constructor(message, path, operation) {
    super(message, 'FILESYSTEM');
    this.code = ERROR_CODES.FILESYSTEM_ERROR;
    this.path = path;
    this.operation = operation;
  }
}

class MemoryError extends SystemError {
  constructor(message, usage, limit) {
    super(message, 'MEMORY');
    this.code = ERROR_CODES.MEMORY_ERROR;
    this.memoryUsage = usage;
    this.memoryLimit = limit;
  }
}

/**
 * Queue Error Classes (RabbitMQ specific)
 */
class QueueError extends BaseError {
  constructor(message, queue = null, exchange = null) {
    super(message, ERROR_CODES.QUEUE_ERROR, 503, SEVERITY_LEVELS.HIGH);
    this.category = ERROR_CATEGORIES.QUEUE_ERROR;
    this.queue = queue;
    this.exchange = exchange;
  }
}

class PublishError extends QueueError {
  constructor(message, routingKey, messageId) {
    super(message);
    this.code = ERROR_CODES.PUBLISH_ERROR;
    this.routingKey = routingKey;
    this.messageId = messageId;
  }
}

class ConsumeError extends QueueError {
  constructor(message, consumerTag, deliveryTag) {
    super(message);
    this.code = ERROR_CODES.CONSUME_ERROR;
    this.consumerTag = consumerTag;
    this.deliveryTag = deliveryTag;
  }
}

class ChannelError extends QueueError {
  constructor(message, channelId, state) {
    super(message);
    this.code = ERROR_CODES.CHANNEL_ERROR;
    this.channelId = channelId;
    this.channelState = state;
  }
}

/**
 * Agent Error Classes (AI Agent specific)
 */
class AgentError extends BaseError {
  constructor(message, agentId = null, task = null) {
    super(message, ERROR_CODES.AGENT_ERROR, 500, SEVERITY_LEVELS.HIGH);
    this.category = ERROR_CATEGORIES.AGENT_ERROR;
    this.agentId = agentId;
    this.task = task;
  }
}

class AgentInitializationError extends AgentError {
  constructor(message, agentId, config) {
    super(message, agentId, 'INITIALIZATION');
    this.code = ERROR_CODES.AGENT_INIT_ERROR;
    this.config = config;
  }
}

class AgentCommunicationError extends AgentError {
  constructor(message, fromAgent, toAgent, messageType) {
    super(message, fromAgent, 'COMMUNICATION');
    this.code = ERROR_CODES.AGENT_COMM_ERROR;
    this.fromAgent = fromAgent;
    this.toAgent = toAgent;
    this.messageType = messageType;
  }
}

class AgentTaskError extends AgentError {
  constructor(message, agentId, taskId, reason) {
    super(message, agentId, taskId);
    this.code = ERROR_CODES.AGENT_TASK_ERROR;
    this.taskId = taskId;
    this.reason = reason;
  }
}

/**
 * Error Factory for creating errors dynamically
 */
class ErrorFactory {
  static create(type, message, ...args) {
    const errorMap = {
      'VALIDATION': ValidationError,
      'NETWORK': NetworkError,
      'AUTHENTICATION': AuthenticationError,
      'AUTHORIZATION': AuthorizationError,
      'BUSINESS': BusinessLogicError,
      'DATABASE': DatabaseError,
      'QUEUE': QueueError,
      'AGENT': AgentError,
      'SYSTEM': SystemError
    };

    const ErrorClass = errorMap[type] || BaseError;
    return new ErrorClass(message, ...args);
  }

  static fromError(error, defaultType = 'SYSTEM') {
    if (error instanceof BaseError) {
      return error;
    }

    const customError = this.create(defaultType, error.message);
    customError.originalError = error;
    customError.originalStack = error.stack;
    return customError;
  }
}

module.exports = {
  // Base Error
  BaseError,

  // Validation Errors
  ValidationError,
  SchemaValidationError,
  InputValidationError,

  // Network Errors
  NetworkError,
  ConnectionError,
  TimeoutError,
  DNSError,

  // Security Errors
  SecurityError,
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,

  // Business Logic Errors
  BusinessLogicError,
  InsufficientResourcesError,
  ConflictError,
  RateLimitError,

  // System Errors
  SystemError,
  DatabaseError,
  FileSystemError,
  MemoryError,

  // Queue Errors
  QueueError,
  PublishError,
  ConsumeError,
  ChannelError,

  // Agent Errors
  AgentError,
  AgentInitializationError,
  AgentCommunicationError,
  AgentTaskError,

  // Factory
  ErrorFactory
};