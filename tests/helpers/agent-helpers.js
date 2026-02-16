/**
 * Agent Test Helpers
 * Utilities for spawning and testing agents
 */

import { spawn } from 'child_process';
import { jest } from '@jest/globals';

/**
 * Spawn a test agent
 */
export function spawnTestAgent(agentPath, args = [], env = {}) {
  const agentProcess = spawn('node', [agentPath, ...args], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      ...env
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const output = {
    stdout: [],
    stderr: []
  };

  agentProcess.stdout.on('data', (data) => {
    output.stdout.push(data.toString());
  });

  agentProcess.stderr.on('data', (data) => {
    output.stderr.push(data.toString());
  });

  return {
    process: agentProcess,
    output,
    kill: () => {
      return new Promise((resolve) => {
        agentProcess.once('exit', resolve);
        agentProcess.kill('SIGTERM');
      });
    },
    waitForOutput: (text, timeout = 5000) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for output: ${text}`));
        }, timeout);

        const checkOutput = () => {
          const allOutput = output.stdout.join('') + output.stderr.join('');
          if (allOutput.includes(text)) {
            clearTimeout(timer);
            resolve(allOutput);
          }
        };

        agentProcess.stdout.on('data', checkOutput);
        agentProcess.stderr.on('data', checkOutput);
        checkOutput();
      });
    }
  };
}

/**
 * Create mock agent configuration
 */
export function createMockAgentConfig(overrides = {}) {
  return {
    agentId: 'test-agent-' + Math.random().toString(36).substr(2, 9),
    agentName: 'Test Agent',
    capabilities: ['test', 'mock'],
    maxConcurrentTasks: 5,
    heartbeatInterval: 30000,
    autoReconnect: false,
    prefetchCount: 1,
    ...overrides
  };
}

/**
 * Create mock task
 */
export function createMockTask(overrides = {}) {
  return {
    taskId: 'task-' + Math.random().toString(36).substr(2, 9),
    type: 'test-task',
    priority: 5,
    data: {
      action: 'test',
      params: {}
    },
    timestamp: Date.now(),
    timeout: 30000,
    retries: 0,
    maxRetries: 3,
    ...overrides
  };
}

/**
 * Create mock task result
 */
export function createMockTaskResult(taskId, overrides = {}) {
  return {
    taskId,
    agentId: 'test-agent',
    status: 'completed',
    result: {
      success: true,
      data: {}
    },
    timestamp: Date.now(),
    duration: 1000,
    ...overrides
  };
}

/**
 * Create mock heartbeat message
 */
export function createMockHeartbeat(agentId, overrides = {}) {
  return {
    agentId,
    timestamp: Date.now(),
    status: 'active',
    metrics: {
      tasksProcessed: 0,
      tasksInProgress: 0,
      errors: 0,
      uptime: 1000
    },
    ...overrides
  };
}

/**
 * Wait for agent to be ready
 */
export async function waitForAgentReady(agent, timeout = 10000) {
  try {
    await agent.waitForOutput('Agent ready', timeout);
    return true;
  } catch (error) {
    throw new Error('Agent failed to become ready: ' + error.message);
  }
}

/**
 * Wait for agent to process task
 */
export async function waitForTaskProcessed(agent, taskId, timeout = 10000) {
  try {
    await agent.waitForOutput(`Task ${taskId}`, timeout);
    return true;
  } catch (error) {
    throw new Error(`Agent failed to process task ${taskId}: ` + error.message);
  }
}

/**
 * Mock agent state
 */
export function createMockAgentState(overrides = {}) {
  return {
    agentId: 'test-agent',
    status: 'active',
    activeTasks: [],
    completedTasks: 0,
    failedTasks: 0,
    lastHeartbeat: Date.now(),
    startTime: Date.now(),
    ...overrides
  };
}

/**
 * Verify agent metrics
 */
export function verifyAgentMetrics(metrics, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (metrics[key] !== value) {
      throw new Error(`Metric ${key} expected ${value} but got ${metrics[key]}`);
    }
  }
  return true;
}

export default {
  spawnTestAgent,
  createMockAgentConfig,
  createMockTask,
  createMockTaskResult,
  createMockHeartbeat,
  waitForAgentReady,
  waitForTaskProcessed,
  createMockAgentState,
  verifyAgentMetrics
};
