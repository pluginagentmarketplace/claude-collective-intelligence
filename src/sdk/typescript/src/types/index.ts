/**
 * Type definitions for AI Agent SDK
 */

/**
 * Agent types
 */
export type AgentType =
  | 'ORCHESTRATOR'
  | 'WORKER'
  | 'BRAINSTORMER'
  | 'SPECIALIST'
  | 'REVIEWER'
  | 'MONITOR'
  | 'CUSTOM';

/**
 * Agent status
 */
export type AgentStatus =
  | 'INITIALIZING'
  | 'READY'
  | 'BUSY'
  | 'IDLE'
  | 'PAUSED'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'ERROR';

/**
 * Task status
 */
export type TaskStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT'
  | 'PAUSED'
  | 'RETRYING';

/**
 * Task priority
 */
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

/**
 * Agent interface
 */
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Agent creation parameters
 */
export interface AgentCreateParams {
  name: string;
  type: AgentType;
  capabilities: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Task interface
 */
export interface Task {
  id: string;
  name: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  payload: unknown;
  result?: TaskResult;
  error?: TaskError;
  createdAt: string;
  updatedAt: string;
  assignedAgentId?: string;
}

/**
 * Task result
 */
export interface TaskResult {
  taskId: string;
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'ERROR';
  output?: unknown;
  completedAt: string;
}

/**
 * Task error
 */
export interface TaskError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  retryable: boolean;
}

/**
 * Task submission parameters
 */
export interface TaskSubmitParams {
  name: string;
  type: string;
  description?: string;
  payload: unknown;
  priority?: TaskPriority;
  config?: {
    timeout?: number;
    retryPolicy?: {
      maxRetries: number;
      initialDelay: number;
      maxDelay: number;
      backoffMultiplier: number;
    };
  };
  metadata?: Record<string, unknown>;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Health check response
 */
export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: string;
  checks: Record<string, HealthCheckResult>;
}

export interface HealthCheckResult {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  responseTime?: number;
  details?: unknown;
}

/**
 * Client configuration
 */
export interface ClientConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
  retryConfig?: {
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  poolConfig?: {
    maxConnections: number;
    maxIdleTime: number;
  };
  requestInterceptors?: RequestInterceptor[];
  responseInterceptors?: ResponseInterceptor[];
}

/**
 * Request interceptor
 */
export type RequestInterceptor = (
  config: RequestConfig
) => Promise<RequestConfig> | RequestConfig;

/**
 * Response interceptor
 */
export type ResponseInterceptor = (
  response: ResponseConfig
) => Promise<ResponseConfig> | ResponseConfig;

/**
 * Request config
 */
export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Response config
 */
export interface ResponseConfig {
  status: number;
  headers: Record<string, string>;
  data: unknown;
}

/**
 * Request options
 */
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  cache?: {
    ttl: number;
    strategy: 'LRU' | 'FIFO' | 'TTL';
  };
  signal?: AbortSignal;
}

/**
 * Stream event
 */
export interface StreamEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: string;
}

/**
 * Metrics
 */
export interface ClientMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalErrors: number;
  averageLatency: number;
  successRate: number;
  errorRate: number;
  lastError?: {
    message: string;
    timestamp: string;
  };
}
