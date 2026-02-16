/**
 * Base error class for Agent Client
 */
export class AgentClientError extends Error {
  constructor(
    message: string,
    public code: string = 'AGENT_CLIENT_ERROR',
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AgentClientError';
    Object.setPrototypeOf(this, AgentClientError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}

/**
 * Validation error
 */
export class ValidationError extends AgentClientError {
  constructor(message: string, public details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AgentClientError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AgentClientError {
  constructor(message: string = 'Not authorized') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AgentClientError {
  constructor(message: string, public resourceType?: string, public resourceId?: string) {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends AgentClientError {
  constructor(message: string = 'Request timeout', public timeout?: number) {
    super(message, 'TIMEOUT', 408);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AgentClientError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Server error
 */
export class ServerError extends AgentClientError {
  constructor(message: string, statusCode: number = 500) {
    super(message, 'SERVER_ERROR', statusCode);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Network error
 */
export class NetworkError extends AgentClientError {
  constructor(message: string, public originalError?: Error) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Connection error
 */
export class ConnectionError extends AgentClientError {
  constructor(message: string = 'Failed to connect') {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Stream error
 */
export class StreamError extends AgentClientError {
  constructor(message: string) {
    super(message, 'STREAM_ERROR');
    this.name = 'StreamError';
    Object.setPrototypeOf(this, StreamError.prototype);
  }
}
