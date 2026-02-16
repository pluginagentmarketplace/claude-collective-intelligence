/**
 * Error Types
 * Type definitions for error handling system
 */

/**
 * Severity levels for errors
 */
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Error categories
 */
export type ErrorCategory =
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'SECURITY_ERROR'
  | 'BUSINESS_ERROR'
  | 'SYSTEM_ERROR'
  | 'QUEUE_ERROR'
  | 'AGENT_ERROR'
  | 'DATABASE_ERROR'
  | 'AUTH_ERROR';

/**
 * Base error interface
 */
export interface IBaseError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly severity: ErrorSeverity;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly category?: ErrorCategory;
  context: Record<string, unknown>;
  details?: unknown;

  withContext(context: Record<string, unknown>): this;
  withDetails(details: unknown): this;
  toJSON(): Record<string, unknown>;
}

/**
 * Validation error interface
 */
export interface IValidationError extends IBaseError {
  field?: string;
  value?: unknown;
  validationErrors?: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  constraint?: string;
  value?: unknown;
}

/**
 * Network error interface
 */
export interface INetworkError extends IBaseError {
  endpoint?: string;
  retryable: boolean;
  retryCount: number;
  lastRetryAt?: string;

  incrementRetry(): this;
}

/**
 * Connection error
 */
export interface IConnectionError extends INetworkError {
  host: string;
  port: number;
  timeout?: number;
}

/**
 * Security error interface
 */
export interface ISecurityError extends IBaseError {
  resource?: string;
  logSecurity?: boolean;
}

/**
 * Authentication error
 */
export interface IAuthenticationError extends ISecurityError {
  method?: string;
  userId?: string;
}

/**
 * Authorization error
 */
export interface IAuthorizationError extends ISecurityError {
  requiredPermission?: string;
  userPermissions?: string[];
}

/**
 * Token error
 */
export interface ITokenError extends ISecurityError {
  tokenId?: string;
  expiresAt?: string;
  issuedAt?: string;
}

/**
 * Business logic error
 */
export interface IBusinessLogicError extends IBaseError {
  rule?: string;
  reason?: string;
}

/**
 * Conflict error
 */
export interface IConflictError extends IBusinessLogicError {
  conflictingResource?: unknown;
  existingValue?: unknown;
}

/**
 * Rate limit error
 */
export interface IRateLimitError extends IBusinessLogicError {
  limit: number;
  window: number;
  retryAfter: number;
}

/**
 * Database error interface
 */
export interface IDatabaseError extends IBaseError {
  query?: string;
  dbCode?: string;
  constraint?: string;
}

/**
 * Agent error interface
 */
export interface IAgentError extends IBaseError {
  agentId?: string;
  taskId?: string;
  reason?: string;
}

/**
 * Queue error interface
 */
export interface IQueueError extends IBaseError {
  queue?: string;
  exchange?: string;
  routingKey?: string;
}

/**
 * Error context
 */
export interface IErrorContext {
  userId?: string;
  agentId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

/**
 * Error handler callback
 */
export type ErrorHandler = (error: IBaseError) => void | Promise<void>;

/**
 * Error recovery strategy
 */
export interface IErrorRecoveryStrategy {
  canRecover(error: IBaseError): boolean;
  recover(error: IBaseError): Promise<unknown>;
}

/**
 * Error formatter result
 */
export interface IErrorFormatted {
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  correlationId: string;
  details?: unknown;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * Error factory creation map
 */
export interface IErrorTypeMap {
  [key: string]: new (...args: unknown[]) => IBaseError;
}

/**
 * Timeout error details
 */
export interface ITimeoutErrorDetails {
  operation: string;
  duration: number;
  limit: number;
}

/**
 * Insufficient resources error details
 */
export interface IInsufficientResourcesDetails {
  resource: string;
  required: number;
  available: number;
}

/**
 * Error statistics
 */
export interface IErrorStatistics {
  totalErrors: number;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  mostCommonErrors: Array<{
    code: string;
    count: number;
  }>;
  avgResponseTime: number;
}

/**
 * Error recovery result
 */
export interface IErrorRecoveryResult {
  recovered: boolean;
  strategy: string;
  result?: unknown;
  error?: Error;
  duration: number;
}

/**
 * Error chain (for error hierarchies)
 */
export interface IErrorChain {
  errors: IBaseError[];
  rootCause?: IBaseError;
  resolution?: string;
}
