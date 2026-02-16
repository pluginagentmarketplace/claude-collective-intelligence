/**
 * Common Types
 * Shared type definitions used across the project
 */

/**
 * Base entity interface
 * All database entities should extend this
 */
export interface IEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generic response wrapper
 */
export interface IResponse<T> {
  success: boolean;
  data?: T;
  error?: IErrorResponse;
  timestamp: string;
}

/**
 * Error response structure
 */
export interface IErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path?: string;
}

/**
 * Pagination parameters
 */
export interface IPaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Paginated response
 */
export interface IPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Query filter
 */
export interface IQueryFilter {
  [key: string]: unknown;
}

/**
 * Sort options
 */
export type SortOrder = 'ASC' | 'DESC';

export interface ISortOption {
  field: string;
  order: SortOrder;
}

/**
 * Environment variables
 */
export interface IEnvConfig {
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;
  LOG_LEVEL: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  RABBITMQ_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  [key: string]: unknown;
}

/**
 * Callback function types
 */
export type Callback<T> = (error: Error | null, result?: T) => void;
export type AsyncCallback<T> = (error?: Error) => Promise<T>;

/**
 * Generic async operation result
 */
export interface IOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
}

/**
 * Health check status
 */
export type HealthStatus = 'UP' | 'DOWN' | 'DEGRADED';

export interface IHealthCheck {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  responseTime?: number;
  details?: unknown;
}

/**
 * Cache options
 */
export interface ICacheOptions {
  ttl?: number;
  key: string;
  strategy?: 'LRU' | 'FIFO' | 'TTL';
}

/**
 * Metadata for requests/responses
 */
export interface IMetadata {
  requestId: string;
  timestamp: string;
  userId?: string;
  agentId?: string;
  correlationId?: string;
  [key: string]: unknown;
}

/**
 * Async iterator
 */
export interface IAsyncIterator<T> {
  next(): Promise<IteratorResult<T>>;
}

/**
 * Event emitter types
 */
export type EventListener<T> = (data: T) => void | Promise<void>;
export type EventName = string | symbol;

/**
 * Job/Task execution result
 */
export interface IExecutionResult<T = unknown> {
  id: string;
  status: 'success' | 'failure' | 'timeout';
  result?: T;
  error?: Error;
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * Plugin interface
 */
export interface IPlugin {
  name: string;
  version: string;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

/**
 * Writable stream type
 */
export interface IWriteStream {
  write(chunk: unknown): Promise<void>;
  close(): Promise<void>;
}

/**
 * Readable stream type
 */
export interface IReadStream {
  read(): Promise<unknown>;
  close(): Promise<void>;
}

/**
 * Constructor type
 */
export type Constructor<T> = new (...args: unknown[]) => T;

/**
 * Tuple of promise-like values
 */
export type PromiseValue<T> = T extends Promise<infer U> ? U : T;

/**
 * Readonly deeply
 */
export type DeepReadonly<T> = T extends object
  ? {
      readonly [K in keyof T]: DeepReadonly<T[K]>;
    }
  : T;

/**
 * Partial deeply
 */
export type DeepPartial<T> = T extends object
  ? {
      [K in keyof T]?: DeepPartial<T[K]>;
    }
  : T;

/**
 * Require deeply
 */
export type DeepRequired<T> = T extends object
  ? {
      [K in keyof T]-?: DeepRequired<T[K]>;
    }
  : T;

/**
 * Make readonly
 */
export type Immutable<T> = {
  readonly [K in keyof T]: Immutable<T[K]>;
};
