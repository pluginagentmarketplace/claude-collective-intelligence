/**
 * Message Factory Helpers
 * Factories for creating test messages
 */

import { randomUUID } from 'crypto';

/**
 * Create orchestrator task message
 */
export function createOrchestratorTask(overrides = {}) {
  return {
    taskId: overrides.taskId || randomUUID(),
    type: 'orchestrator.task',
    action: overrides.action || 'process',
    priority: overrides.priority || 5,
    payload: {
      description: 'Test task',
      requirements: [],
      deadline: null,
      ...overrides.payload
    },
    metadata: {
      createdAt: Date.now(),
      createdBy: 'test-orchestrator',
      version: '1.0',
      ...overrides.metadata
    },
    routing: {
      targetAgent: overrides.targetAgent || null,
      targetCapability: overrides.targetCapability || null,
      broadcast: overrides.broadcast || false
    },
    ...overrides
  };
}

/**
 * Create agent task message
 */
export function createAgentTask(agentId, overrides = {}) {
  return {
    taskId: overrides.taskId || randomUUID(),
    agentId,
    type: 'agent.task',
    action: overrides.action || 'execute',
    priority: overrides.priority || 5,
    data: overrides.data || {},
    timestamp: Date.now(),
    timeout: overrides.timeout || 30000,
    retries: overrides.retries || 0,
    maxRetries: overrides.maxRetries || 3,
    ...overrides
  };
}

/**
 * Create task result message
 */
export function createTaskResult(taskId, agentId, overrides = {}) {
  return {
    taskId,
    agentId,
    type: 'task.result',
    status: overrides.status || 'completed',
    result: overrides.result || {
      success: true,
      data: {},
      message: 'Task completed successfully'
    },
    timestamp: Date.now(),
    duration: overrides.duration || 1000,
    metadata: {
      attempts: 1,
      errors: [],
      ...overrides.metadata
    },
    ...overrides
  };
}

/**
 * Create heartbeat message
 */
export function createHeartbeat(agentId, overrides = {}) {
  return {
    type: 'heartbeat',
    agentId,
    timestamp: Date.now(),
    status: overrides.status || 'active',
    metrics: {
      tasksProcessed: overrides.tasksProcessed || 0,
      tasksInProgress: overrides.tasksInProgress || 0,
      errors: overrides.errors || 0,
      uptime: overrides.uptime || 1000,
      memoryUsage: overrides.memoryUsage || process.memoryUsage(),
      ...overrides.metrics
    },
    capabilities: overrides.capabilities || ['general'],
    ...overrides
  };
}

/**
 * Create error message
 */
export function createErrorMessage(taskId, agentId, error, overrides = {}) {
  return {
    type: 'error',
    taskId,
    agentId,
    error: {
      name: error.name || 'Error',
      message: error.message || 'An error occurred',
      stack: error.stack || null,
      code: error.code || 'UNKNOWN_ERROR'
    },
    timestamp: Date.now(),
    severity: overrides.severity || 'error',
    ...overrides
  };
}

/**
 * Create coordination message
 */
export function createCoordinationMessage(fromAgent, toAgent, overrides = {}) {
  return {
    type: 'coordination',
    messageId: randomUUID(),
    from: fromAgent,
    to: toAgent,
    action: overrides.action || 'request',
    payload: overrides.payload || {},
    timestamp: Date.now(),
    expiresAt: overrides.expiresAt || (Date.now() + 60000),
    ...overrides
  };
}

/**
 * Create status update message
 */
export function createStatusUpdate(agentId, overrides = {}) {
  return {
    type: 'status.update',
    agentId,
    status: overrides.status || 'active',
    details: overrides.details || {},
    timestamp: Date.now(),
    ...overrides
  };
}

/**
 * Create batch of messages
 */
export function createMessageBatch(factory, count, baseConfig = {}) {
  return Array.from({ length: count }, (_, i) =>
    factory({ ...baseConfig, sequenceNumber: i })
  );
}

/**
 * Create workflow message chain
 */
export function createWorkflowChain(steps) {
  const workflowId = randomUUID();
  return steps.map((step, index) => ({
    workflowId,
    stepId: step.stepId || `step-${index}`,
    type: 'workflow.step',
    action: step.action,
    data: step.data || {},
    dependencies: step.dependencies || (index > 0 ? [`step-${index - 1}`] : []),
    timestamp: Date.now(),
    sequenceNumber: index
  }));
}

export default {
  createOrchestratorTask,
  createAgentTask,
  createTaskResult,
  createHeartbeat,
  createErrorMessage,
  createCoordinationMessage,
  createStatusUpdate,
  createMessageBatch,
  createWorkflowChain
};
