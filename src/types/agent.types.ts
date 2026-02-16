/**
 * Agent Types
 * Type definitions for agent system, roles, and status
 */

import { IEntity } from './common.types';

/**
 * Agent type/role
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
 * Agent health status
 */
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

/**
 * Core agent interface
 */
export interface IAgent extends IEntity {
  name: string;
  type: AgentType;
  status: AgentStatus;
  healthStatus: HealthStatus;
  priority: number;
  maxConcurrentTasks: number;
  currentTaskCount: number;
  capabilities: string[];
  metadata: Record<string, unknown>;
  config: IAgentConfig;
  lastHeartbeat: Date;
  error?: string;
}

/**
 * Agent configuration
 */
export interface IAgentConfig {
  timeout: number;
  retryPolicy: IRetryPolicy;
  rateLimit?: IRateLimit;
  resourceLimits?: IResourceLimits;
  securityContext?: ISecurityContext;
  customConfig?: Record<string, unknown>;
}

/**
 * Retry policy
 */
export interface IRetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Rate limiting configuration
 */
export interface IRateLimit {
  requestsPerSecond: number;
  burstSize: number;
  windowSize: number;
}

/**
 * Resource limits
 */
export interface IResourceLimits {
  maxMemoryMB: number;
  maxCPUPercent: number;
  maxNetworkBandwidthMBps: number;
  maxOpenConnections: number;
}

/**
 * Security context for agent
 */
export interface ISecurityContext {
  userId: string;
  role: string;
  permissions: string[];
  organizationId?: string;
  dataAccess?: 'FULL' | 'RESTRICTED' | 'NONE';
}

/**
 * Agent capability
 */
export interface IAgentCapability {
  name: string;
  version: string;
  description: string;
  parameters?: Record<string, unknown>;
}

/**
 * Agent resource usage
 */
export interface IAgentResourceUsage {
  agentId: string;
  cpuPercent: number;
  memoryMB: number;
  networkBandwidthMBps: number;
  diskUsageMB: number;
  timestamp: Date;
}

/**
 * Agent performance metrics
 */
export interface IAgentPerformanceMetrics {
  agentId: string;
  successRate: number;
  averageExecutionTime: number;
  totalTasksProcessed: number;
  tasksInLastHour: number;
  averageResponseTime: number;
  errorRate: number;
  lastUpdated: Date;
}

/**
 * Agent role definition
 */
export interface IAgentRole {
  type: AgentType;
  description: string;
  capabilities: IAgentCapability[];
  permissions: string[];
  defaultConfig: IAgentConfig;
}

/**
 * Agent initialization parameters
 */
export interface IAgentInitParams {
  name: string;
  type: AgentType;
  capabilities: string[];
  config?: Partial<IAgentConfig>;
  metadata?: Record<string, unknown>;
}

/**
 * Agent state snapshot
 */
export interface IAgentStateSnapshot {
  agentId: string;
  status: AgentStatus;
  healthStatus: HealthStatus;
  timestamp: Date;
  taskMetrics: {
    active: number;
    queued: number;
    completed: number;
    failed: number;
  };
  resourceUsage: IAgentResourceUsage;
  lastError?: {
    code: string;
    message: string;
    timestamp: Date;
  };
}

/**
 * Agent communication message
 */
export interface IAgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  messageType: string;
  payload: unknown;
  timestamp: Date;
  priority: number;
  replyTo?: string;
}

/**
 * Agent response
 */
export interface IAgentResponse {
  id: string;
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  status: 'success' | 'failure' | 'timeout' | 'rejected';
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
  timestamp: Date;
}

/**
 * Agent discovery info
 */
export interface IAgentDiscoveryInfo {
  agentId: string;
  name: string;
  type: AgentType;
  version: string;
  capabilities: string[];
  endpoint: string;
  port: number;
  discoveredAt: Date;
  lastSeen: Date;
  healthy: boolean;
}

/**
 * Agent pool interface
 */
export interface IAgentPool {
  agents: IAgent[];
  size: number;
  activeCount: number;
  idleCount: number;
  degradedCount: number;
  offlineCount: number;
}

/**
 * Agent scaling policy
 */
export interface IAgentScalingPolicy {
  minInstances: number;
  maxInstances: number;
  targetCPUPercent: number;
  targetMemoryPercent: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
}

/**
 * Agent deployment spec
 */
export interface IAgentDeploymentSpec {
  agentType: AgentType;
  version: string;
  replicas: number;
  resources: IResourceLimits;
  env: Record<string, string>;
  labels: Record<string, string>;
  affinity?: Record<string, unknown>;
}

/**
 * Agent event
 */
export type AgentEventType =
  | 'AGENT_REGISTERED'
  | 'AGENT_READY'
  | 'AGENT_BUSY'
  | 'AGENT_IDLE'
  | 'AGENT_ERROR'
  | 'AGENT_OFFLINE'
  | 'AGENT_DEGRADED'
  | 'AGENT_RECOVERED'
  | 'AGENT_UNREGISTERED';

export interface IAgentEvent {
  eventId: string;
  type: AgentEventType;
  agentId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Agent registry interface
 */
export interface IAgentRegistry {
  register(agent: IAgent): Promise<void>;
  unregister(agentId: string): Promise<void>;
  getAgent(agentId: string): Promise<IAgent | null>;
  listAgents(filter?: Record<string, unknown>): Promise<IAgent[]>;
  findAgentsByCapability(capability: string): Promise<IAgent[]>;
  updateAgent(agentId: string, updates: Partial<IAgent>): Promise<void>;
}

/**
 * Agent orchestrator interface
 */
export interface IAgentOrchestrator {
  registerAgent(agent: IAgent): Promise<void>;
  deregisterAgent(agentId: string): Promise<void>;
  assignTask(agentId: string, task: unknown): Promise<string>;
  selectAgent(taskType: string, requirements?: Record<string, unknown>): Promise<IAgent | null>;
  broadcast(message: unknown): Promise<void>;
  getAgentStatus(agentId: string): Promise<AgentStatus>;
  getClusterStatus(): Promise<IAgentPool>;
}

/**
 * Agent monitoring interface
 */
export interface IAgentMonitor {
  monitorAgent(agentId: string): Promise<IAgentStateSnapshot>;
  startMonitoring(agentId: string, interval: number): void;
  stopMonitoring(agentId: string): void;
  getAgentMetrics(agentId: string): Promise<IAgentPerformanceMetrics>;
  alertOnThreshold(agentId: string, threshold: Record<string, number>): void;
}

/**
 * Agent lifecycle hooks
 */
export interface IAgentLifecycleHooks {
  onInitialize?(): Promise<void>;
  onReady?(): Promise<void>;
  onError?(error: Error): Promise<void>;
  onShutdown?(): Promise<void>;
  onTaskStart?(taskId: string): Promise<void>;
  onTaskComplete?(taskId: string, result: unknown): Promise<void>;
  onTaskError?(taskId: string, error: Error): Promise<void>;
}
