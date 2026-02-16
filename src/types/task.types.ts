/**
 * Task Types
 * Type definitions for task management system
 */

import { IEntity } from './common.types';

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
 * Task result status
 */
export type TaskResultStatus = 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'ERROR';

/**
 * Core task interface
 */
export interface ITask extends IEntity {
  name: string;
  description?: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgentId?: string;
  parentTaskId?: string;
  subtasks: string[]; // Task IDs
  payload: unknown;
  result?: ITaskResult;
  error?: ITaskError;
  metadata: Record<string, unknown>;
  config: ITaskConfig;
  scheduling: ITaskScheduling;
  timestamps: ITaskTimestamps;
  retryCount: number;
  maxRetries: number;
}

/**
 * Task configuration
 */
export interface ITaskConfig {
  timeout: number;
  retryPolicy: ITaskRetryPolicy;
  dependencies?: string[]; // Task IDs
  parallelizable: boolean;
  idempotent: boolean;
  cacheable: boolean;
  cacheKey?: string;
  cacheExpiry?: number;
  rateLimit?: {
    maxConcurrent: number;
    requestsPerSecond: number;
  };
  notifications?: {
    onStart: boolean;
    onComplete: boolean;
    onError: boolean;
  };
}

/**
 * Task retry policy
 */
export interface ITaskRetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Task scheduling
 */
export interface ITaskScheduling {
  scheduledAt?: Date;
  startDeadline?: Date;
  endDeadline?: Date;
  cronExpression?: string;
  recurringTaskId?: string;
  priority: TaskPriority;
}

/**
 * Task timestamps
 */
export interface ITaskTimestamps {
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
  estimatedCompletionTime?: Date;
}

/**
 * Task result
 */
export interface ITaskResult {
  taskId: string;
  status: TaskResultStatus;
  output?: unknown;
  metrics?: ITaskMetrics;
  completedAt: Date;
  agentId?: string;
  version?: string;
}

/**
 * Task error
 */
export interface ITaskError {
  code: string;
  message: string;
  stack?: string;
  details?: unknown;
  timestamp: Date;
  retryable: boolean;
  attemptNumber: number;
  maxAttempts: number;
}

/**
 * Task metrics
 */
export interface ITaskMetrics {
  executionTime: number;
  queuedTime: number;
  totalTime: number;
  cpuUsage?: number;
  memoryUsage?: number;
  networkTraffic?: number;
  successRate?: number;
}

/**
 * Task creation parameters
 */
export interface ITaskCreateParams {
  name: string;
  type: string;
  description?: string;
  payload: unknown;
  priority?: TaskPriority;
  parentTaskId?: string;
  config?: Partial<ITaskConfig>;
  scheduling?: Partial<ITaskScheduling>;
  metadata?: Record<string, unknown>;
}

/**
 * Task update parameters
 */
export interface ITaskUpdateParams {
  name?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedAgentId?: string;
  payload?: unknown;
  result?: ITaskResult;
  error?: ITaskError;
  metadata?: Record<string, unknown>;
}

/**
 * Task filter parameters
 */
export interface ITaskFilterParams {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  agentId?: string;
  type?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Task batch operation
 */
export interface ITaskBatchOperation {
  operationType: 'CANCEL' | 'RETRY' | 'PAUSE' | 'RESUME' | 'DELETE';
  taskIds: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Task queue
 */
export interface ITaskQueue {
  queueId: string;
  name: string;
  priority: TaskPriority;
  pendingTasks: number;
  processingTasks: number;
  failedTasks: number;
  throughput: number; // tasks per second
  averageWaitTime: number;
  averageExecutionTime: number;
}

/**
 * Task distribution strategy
 */
export type TaskDistributionStrategy =
  | 'ROUND_ROBIN'
  | 'LEAST_LOADED'
  | 'CAPABILITY_MATCH'
  | 'RANDOM'
  | 'PRIORITY_BASED'
  | 'CUSTOM';

/**
 * Task orchestration
 */
export interface ITaskOrchestration {
  taskId: string;
  name: string;
  description?: string;
  steps: ITaskStep[];
  parallelGroups?: string[][];
  condition?: string;
  errorHandler?: IErrorHandlerConfig;
  rollbackSteps?: ITaskStep[];
}

/**
 * Task step in orchestration
 */
export interface ITaskStep {
  id: string;
  taskType: string;
  name: string;
  requiredCapabilities?: string[];
  timeout?: number;
  retryPolicy?: ITaskRetryPolicy;
  inputs?: Record<string, unknown>;
  outputs?: string[];
  condition?: string;
  compensation?: ITaskStep; // For saga pattern
}

/**
 * Error handler configuration
 */
export interface IErrorHandlerConfig {
  strategy: 'FAIL' | 'RETRY' | 'SKIP' | 'COMPENSATE' | 'ESCALATE';
  fallbackTask?: string;
  alertOnError: boolean;
  maxConsecutiveErrors: number;
}

/**
 * Task dependency graph
 */
export interface ITaskDependencyGraph {
  nodes: Map<string, ITask>;
  edges: Map<string, string[]>; // from taskId to dependent taskIds
}

/**
 * Task submission result
 */
export interface ITaskSubmissionResult {
  taskId: string;
  status: TaskStatus;
  queuePosition: number;
  estimatedStartTime?: Date;
  estimatedCompletionTime?: Date;
}

/**
 * Task progress
 */
export interface ITaskProgress {
  taskId: string;
  status: TaskStatus;
  progress: number; // 0-100
  startTime?: Date;
  estimatedCompletionTime?: Date;
  currentStep?: string;
  totalSteps?: number;
  elapsedTime: number;
  remainingTime?: number;
}

/**
 * Task event type
 */
export type TaskEventType =
  | 'TASK_CREATED'
  | 'TASK_QUEUED'
  | 'TASK_ASSIGNED'
  | 'TASK_STARTED'
  | 'TASK_PROGRESS'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_CANCELLED'
  | 'TASK_RETRIED'
  | 'TASK_TIMED_OUT'
  | 'TASK_PAUSED'
  | 'TASK_RESUMED';

/**
 * Task event
 */
export interface ITaskEvent {
  eventId: string;
  type: TaskEventType;
  taskId: string;
  timestamp: Date;
  agentId?: string;
  data?: Record<string, unknown>;
}

/**
 * Task statistics
 */
export interface ITaskStatistics {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  averageExecutionTime: number;
  successRate: number;
  failureRate: number;
  retryRate: number;
  timeoutRate: number;
  averageQueueWaitTime: number;
  throughput: number; // tasks per second
  p95ExecutionTime: number;
  p99ExecutionTime: number;
}

/**
 * Task health check
 */
export interface ITaskHealthCheck {
  taskId: string;
  healthy: boolean;
  status: TaskStatus;
  lastUpdate: Date;
  metrics: ITaskMetrics;
  warnings?: string[];
  errors?: string[];
}

/**
 * Task cancellation request
 */
export interface ITaskCancellationRequest {
  taskId: string;
  reason: string;
  force: boolean;
  timestamp: Date;
  requestedBy: string;
}

/**
 * Task repository interface
 */
export interface ITaskRepository {
  create(params: ITaskCreateParams): Promise<ITask>;
  findById(taskId: string): Promise<ITask | null>;
  findAll(filter?: ITaskFilterParams): Promise<ITask[]>;
  update(taskId: string, updates: ITaskUpdateParams): Promise<ITask>;
  delete(taskId: string): Promise<boolean>;
  cancel(taskId: string, reason: string): Promise<void>;
  getStatus(taskId: string): Promise<TaskStatus>;
  getResult(taskId: string): Promise<ITaskResult | null>;
}
