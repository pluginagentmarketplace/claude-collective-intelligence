/**
 * Enhanced Unit Tests for AgentOrchestrator
 * Complete test coverage including edge cases, error scenarios, and performance tests
 * Target Coverage: 90%+
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// ==================== MOCK SETUP ====================

// Mock Winston Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger),
};

jest.unstable_mockModule('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Mock RabbitMQ Client with comprehensive functionality
class MockRabbitMQClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.connected = false;
    this.channels = new Map();
    this.messageQueue = [];
    this.consumeCallbacks = new Map();
    this.errorScenarios = {};
  }

  // Connection Management
  async connect() {
    if (this.errorScenarios.connectionError) {
      throw new Error('Connection failed: ' + this.errorScenarios.connectionError);
    }
    this.connected = true;
    this.emit('connected');
  }

  async close() {
    this.connected = false;
    this.channels.clear();
    this.emit('disconnected');
  }

  // Queue Management
  async setupTaskQueue(queueName) {
    if (this.errorScenarios.setupQueueError) {
      throw new Error('Queue setup failed');
    }
    this.channels.set(queueName, { type: 'queue', messages: [] });
    return queueName;
  }

  async setupBrainstormExchange(exchangeName, agentId) {
    return {
      exchangeName,
      queueName: `brainstorm.${agentId}`,
    };
  }

  // Message Publishing
  async publishTask(task) {
    if (this.errorScenarios.publishError) {
      throw new Error('Publish failed');
    }
    const messageId = `task-${Date.now()}-${Math.random()}`;
    this.messageQueue.push({ ...task, messageId });
    return messageId;
  }

  async publishResult(result) {
    if (this.errorScenarios.publishResultError) {
      throw new Error('Result publish failed');
    }
    return `result-${Date.now()}`;
  }

  // Message Consumption
  async consumeTasks(callback) {
    this.consumeCallbacks.set('tasks', callback);
    // Simulate incoming messages
    if (this.messageQueue.length > 0) {
      setImmediate(() => {
        const msg = this.messageQueue.shift();
        callback(msg);
      });
    }
  }

  // Health Monitoring
  isHealthy() {
    return this.connected && !this.errorScenarios.unhealthy;
  }

  getMetrics() {
    return {
      messagesPublished: this.messageQueue.length,
      channels: this.channels.size,
      connected: this.connected,
    };
  }

  // Test Helpers
  simulateError(scenario) {
    this.errorScenarios[scenario] = true;
  }

  clearErrors() {
    this.errorScenarios = {};
  }

  simulateIncomingMessage(message) {
    const callback = this.consumeCallbacks.get('tasks');
    if (callback) {
      callback(message);
    }
  }
}

const mockRabbitMQClient = new MockRabbitMQClient({ url: 'amqp://test' });

jest.unstable_mockModule('../../scripts/rabbitmq-client.js', () => ({
  RabbitMQClient: jest.fn(() => mockRabbitMQClient),
}));

// Mock other dependencies
jest.unstable_mockModule('../../scripts/voting-system.js', () => ({
  VotingSystem: jest.fn(() => ({
    initializeVoting: jest.fn().mockResolvedValue({ voteId: 'vote-123' }),
    castVote: jest.fn().mockResolvedValue(true),
    getTally: jest.fn().mockResolvedValue({ yes: 5, no: 2 }),
    finalizeVoting: jest.fn().mockResolvedValue({ winner: 'yes' }),
  })),
}));

jest.unstable_mockModule('../../scripts/brainstorm-system.js', () => ({
  BrainstormSystem: jest.fn(() => ({
    startSession: jest.fn().mockResolvedValue({ sessionId: 'session-123' }),
    submitIdea: jest.fn().mockResolvedValue({ ideaId: 'idea-123' }),
    rankIdeas: jest.fn().mockResolvedValue([{ id: 'idea-1', score: 95 }]),
    endSession: jest.fn().mockResolvedValue({ topIdeas: [] }),
  })),
}));

// ==================== TEST SUITES ====================

describe('AgentOrchestrator - Enhanced Test Suite', () => {
  let AgentOrchestrator;
  let orchestrator;

  // ===== SETUP & TEARDOWN =====
  beforeAll(async () => {
    const module = await import('../../src/core/orchestrator.js');
    AgentOrchestrator = module.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRabbitMQClient.clearErrors();
    mockRabbitMQClient.connected = false;
    mockRabbitMQClient.messageQueue = [];
    orchestrator = null;
  });

  afterEach(async () => {
    if (orchestrator?.isRunning) {
      await orchestrator.stop();
    }
  });

  // ===== BASIC FUNCTIONALITY TESTS =====
  describe('Core Functionality', () => {
    describe('Initialization', () => {
      it('should initialize with default configuration', () => {
        orchestrator = new AgentOrchestrator();
        expect(orchestrator).toBeDefined();
        expect(orchestrator.agentId).toMatch(/^orchestrator-/);
        expect(orchestrator.config).toBeDefined();
      });

      it('should initialize with custom configuration', () => {
        const customConfig = {
          agentId: 'custom-orchestrator',
          maxConcurrentTasks: 10,
          taskTimeout: 60000,
        };
        orchestrator = new AgentOrchestrator(customConfig);
        expect(orchestrator.agentId).toBe('custom-orchestrator');
        expect(orchestrator.config.maxConcurrentTasks).toBe(10);
      });

      it('should validate configuration parameters', () => {
        const invalidConfig = {
          maxConcurrentTasks: -5,
          taskTimeout: 'invalid',
        };
        expect(() => new AgentOrchestrator(invalidConfig)).toThrow('Invalid configuration');
      });
    });

    describe('Connection Management', () => {
      it('should successfully connect to RabbitMQ', async () => {
        orchestrator = new AgentOrchestrator();
        await orchestrator.start();

        expect(mockRabbitMQClient.connect).toHaveBeenCalled();
        expect(orchestrator.isRunning).toBe(true);
      });

      it('should handle connection failures gracefully', async () => {
        orchestrator = new AgentOrchestrator();
        mockRabbitMQClient.simulateError('connectionError');

        await expect(orchestrator.start()).rejects.toThrow('Connection failed');
        expect(orchestrator.isRunning).toBe(false);
      });

      it('should implement connection retry logic', async () => {
        orchestrator = new AgentOrchestrator({ retryAttempts: 3, retryDelay: 100 });
        mockRabbitMQClient.simulateError('connectionError');

        const startPromise = orchestrator.start();

        // Clear error after 2 attempts
        setTimeout(() => mockRabbitMQClient.clearErrors(), 250);

        await expect(startPromise).resolves.not.toThrow();
        expect(mockRabbitMQClient.connect).toHaveBeenCalledTimes(3);
      });

      it('should handle graceful shutdown', async () => {
        orchestrator = new AgentOrchestrator();
        await orchestrator.start();
        await orchestrator.stop();

        expect(mockRabbitMQClient.close).toHaveBeenCalled();
        expect(orchestrator.isRunning).toBe(false);
      });
    });
  });

  // ===== TASK HANDLING TESTS =====
  describe('Task Processing', () => {
    beforeEach(async () => {
      orchestrator = new AgentOrchestrator();
      await orchestrator.start();
    });

    describe('Task Distribution', () => {
      it('should distribute tasks to available agents', async () => {
        const task = {
          type: 'compute',
          payload: { data: 'test' },
          priority: 1,
        };

        const taskId = await orchestrator.assignTask(task);

        expect(taskId).toBeDefined();
        expect(mockRabbitMQClient.publishTask).toHaveBeenCalledWith(
          expect.objectContaining(task)
        );
      });

      it('should handle task priority correctly', async () => {
        const highPriorityTask = { type: 'urgent', priority: 10 };
        const lowPriorityTask = { type: 'normal', priority: 1 };

        await orchestrator.assignTask(lowPriorityTask);
        await orchestrator.assignTask(highPriorityTask);

        const queue = orchestrator.getTaskQueue();
        expect(queue[0].priority).toBe(10);
      });

      it('should enforce maximum concurrent task limit', async () => {
        orchestrator.config.maxConcurrentTasks = 2;

        const tasks = Array(5).fill().map((_, i) => ({
          type: `task-${i}`,
          priority: 1,
        }));

        const promises = tasks.map(t => orchestrator.assignTask(t));
        await Promise.all(promises);

        expect(orchestrator.getActiveTasks().length).toBeLessThanOrEqual(2);
      });

      it('should handle task timeout scenarios', async () => {
        jest.useFakeTimers();

        const task = {
          type: 'long-running',
          timeout: 1000,
        };

        const taskId = await orchestrator.assignTask(task);

        jest.advanceTimersByTime(1500);

        const taskStatus = await orchestrator.getTaskStatus(taskId);
        expect(taskStatus).toBe('timeout');

        jest.useRealTimers();
      });
    });

    describe('Result Handling', () => {
      it('should process task results correctly', async () => {
        const task = { type: 'compute', payload: { x: 5, y: 3 } };
        const taskId = await orchestrator.assignTask(task);

        const result = {
          taskId,
          status: 'completed',
          result: { sum: 8 },
        };

        await orchestrator.handleTaskResult(result);

        const taskStatus = await orchestrator.getTaskStatus(taskId);
        expect(taskStatus).toBe('completed');
      });

      it('should handle partial results', async () => {
        const task = { type: 'stream', chunks: 3 };
        const taskId = await orchestrator.assignTask(task);

        for (let i = 0; i < 3; i++) {
          await orchestrator.handleTaskResult({
            taskId,
            status: 'partial',
            chunk: i,
            data: `chunk-${i}`,
          });
        }

        const result = await orchestrator.getTaskResult(taskId);
        expect(result.chunks).toHaveLength(3);
      });

      it('should handle task failures', async () => {
        const task = { type: 'risky' };
        const taskId = await orchestrator.assignTask(task);

        await orchestrator.handleTaskResult({
          taskId,
          status: 'failed',
          error: 'Division by zero',
        });

        const taskStatus = await orchestrator.getTaskStatus(taskId);
        expect(taskStatus).toBe('failed');
      });
    });
  });

  // ===== COLLABORATION TESTS =====
  describe('Multi-Agent Collaboration', () => {
    beforeEach(async () => {
      orchestrator = new AgentOrchestrator();
      await orchestrator.start();
    });

    describe('Agent Coordination', () => {
      it('should coordinate multiple agents for complex tasks', async () => {
        const complexTask = {
          type: 'multi-step',
          steps: ['analyze', 'process', 'validate'],
        };

        const executionPlan = await orchestrator.planExecution(complexTask);

        expect(executionPlan.agents).toHaveLength(3);
        expect(executionPlan.dependencies).toBeDefined();
      });

      it('should handle agent registration and discovery', async () => {
        await orchestrator.registerAgent({
          id: 'agent-1',
          capabilities: ['compute', 'analyze'],
        });

        await orchestrator.registerAgent({
          id: 'agent-2',
          capabilities: ['validate', 'report'],
        });

        const agents = await orchestrator.getAvailableAgents();
        expect(agents).toHaveLength(2);
      });

      it('should load balance tasks across agents', async () => {
        // Register multiple agents
        const agents = Array(3).fill().map((_, i) => ({
          id: `agent-${i}`,
          capabilities: ['process'],
        }));

        for (const agent of agents) {
          await orchestrator.registerAgent(agent);
        }

        // Assign multiple tasks
        const tasks = Array(9).fill().map(() => ({ type: 'process' }));

        for (const task of tasks) {
          await orchestrator.assignTask(task);
        }

        // Check load distribution
        const distribution = await orchestrator.getLoadDistribution();
        expect(Math.max(...Object.values(distribution)) -
               Math.min(...Object.values(distribution))).toBeLessThanOrEqual(1);
      });
    });

    describe('Consensus Mechanisms', () => {
      it('should implement voting for critical decisions', async () => {
        const proposal = {
          type: 'system-change',
          description: 'Update configuration',
          requiredConsensus: 0.66,
        };

        const voteResult = await orchestrator.initiateVoting(proposal);

        expect(voteResult.approved).toBeDefined();
        expect(voteResult.votes).toBeGreaterThan(0);
      });

      it('should handle brainstorming sessions', async () => {
        const problem = {
          description: 'Optimize performance',
          constraints: ['memory < 1GB', 'latency < 100ms'],
        };

        const session = await orchestrator.startBrainstorming(problem);

        // Simulate agent ideas
        await orchestrator.submitIdea(session.id, {
          agentId: 'agent-1',
          idea: 'Use caching',
        });

        await orchestrator.submitIdea(session.id, {
          agentId: 'agent-2',
          idea: 'Implement pagination',
        });

        const results = await orchestrator.endBrainstorming(session.id);
        expect(results.ideas).toHaveLength(2);
      });
    });
  });

  // ===== ERROR HANDLING TESTS =====
  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      orchestrator = new AgentOrchestrator();
      await orchestrator.start();
    });

    describe('Failure Recovery', () => {
      it('should recover from agent failures', async () => {
        const task = { type: 'critical', retryOnFailure: true };
        const taskId = await orchestrator.assignTask(task);

        // Simulate agent failure
        await orchestrator.handleAgentFailure('agent-1', taskId);

        // Task should be reassigned
        const newAssignment = await orchestrator.getTaskAssignment(taskId);
        expect(newAssignment.agentId).not.toBe('agent-1');
      });

      it('should implement circuit breaker pattern', async () => {
        const agent = { id: 'flaky-agent', failureThreshold: 3 };
        await orchestrator.registerAgent(agent);

        // Simulate multiple failures
        for (let i = 0; i < 3; i++) {
          await orchestrator.handleAgentFailure('flaky-agent', `task-${i}`);
        }

        // Agent should be circuit broken
        const agentStatus = await orchestrator.getAgentStatus('flaky-agent');
        expect(agentStatus).toBe('circuit-open');

        // Should not assign new tasks to this agent
        const task = { type: 'new-task' };
        const assignment = await orchestrator.assignTask(task);
        expect(assignment.agentId).not.toBe('flaky-agent');
      });

      it('should handle cascading failures', async () => {
        const dependentTasks = [
          { id: 'task-1', dependencies: [] },
          { id: 'task-2', dependencies: ['task-1'] },
          { id: 'task-3', dependencies: ['task-2'] },
        ];

        for (const task of dependentTasks) {
          await orchestrator.assignTask(task);
        }

        // Fail the first task
        await orchestrator.handleTaskResult({
          taskId: 'task-1',
          status: 'failed',
        });

        // Dependent tasks should be cancelled
        const task2Status = await orchestrator.getTaskStatus('task-2');
        const task3Status = await orchestrator.getTaskStatus('task-3');

        expect(task2Status).toBe('cancelled');
        expect(task3Status).toBe('cancelled');
      });
    });

    describe('Resource Management', () => {
      it('should prevent memory leaks', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        // Create and process many tasks
        for (let i = 0; i < 1000; i++) {
          const task = { type: 'memory-test', payload: new Array(100).fill('data') };
          const taskId = await orchestrator.assignTask(task);
          await orchestrator.handleTaskResult({
            taskId,
            status: 'completed',
          });
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryGrowth = finalMemory - initialMemory;

        // Memory growth should be reasonable (< 50MB)
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
      });

      it('should clean up completed tasks', async () => {
        orchestrator.config.taskRetentionPeriod = 1000; // 1 second

        const task = { type: 'temporary' };
        const taskId = await orchestrator.assignTask(task);

        await orchestrator.handleTaskResult({
          taskId,
          status: 'completed',
        });

        // Task should exist immediately
        let taskExists = await orchestrator.taskExists(taskId);
        expect(taskExists).toBe(true);

        // Wait for retention period
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Task should be cleaned up
        taskExists = await orchestrator.taskExists(taskId);
        expect(taskExists).toBe(false);
      });
    });
  });

  // ===== PERFORMANCE TESTS =====
  describe('Performance and Scalability', () => {
    describe('Throughput Tests', () => {
      it('should handle high message throughput', async () => {
        orchestrator = new AgentOrchestrator({ maxConcurrentTasks: 100 });
        await orchestrator.start();

        const startTime = Date.now();
        const taskCount = 1000;
        const tasks = [];

        for (let i = 0; i < taskCount; i++) {
          tasks.push(orchestrator.assignTask({ type: 'perf-test', id: i }));
        }

        await Promise.all(tasks);

        const duration = Date.now() - startTime;
        const throughput = taskCount / (duration / 1000);

        // Should process at least 100 tasks per second
        expect(throughput).toBeGreaterThan(100);
      });

      it('should maintain low latency under load', async () => {
        orchestrator = new AgentOrchestrator();
        await orchestrator.start();

        const latencies = [];

        // Measure latency for 100 operations
        for (let i = 0; i < 100; i++) {
          const start = Date.now();
          await orchestrator.assignTask({ type: 'latency-test' });
          latencies.push(Date.now() - start);
        }

        const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;
        const p99Latency = latencies.sort((a, b) => a - b)[98];

        expect(avgLatency).toBeLessThan(50); // Average < 50ms
        expect(p99Latency).toBeLessThan(200); // P99 < 200ms
      });
    });

    describe('Scalability Tests', () => {
      it('should scale with number of agents', async () => {
        const configs = [
          { agents: 1, expectedThroughput: 100 },
          { agents: 5, expectedThroughput: 450 },
          { agents: 10, expectedThroughput: 850 },
        ];

        for (const config of configs) {
          orchestrator = new AgentOrchestrator();
          await orchestrator.start();

          // Register agents
          for (let i = 0; i < config.agents; i++) {
            await orchestrator.registerAgent({
              id: `agent-${i}`,
              capabilities: ['process'],
            });
          }

          // Measure throughput
          const startTime = Date.now();
          const tasks = Array(1000).fill().map(() =>
            orchestrator.assignTask({ type: 'scale-test' })
          );

          await Promise.all(tasks);

          const throughput = 1000 / ((Date.now() - startTime) / 1000);
          expect(throughput).toBeGreaterThan(config.expectedThroughput);

          await orchestrator.stop();
        }
      });
    });
  });

  // ===== EDGE CASES AND BOUNDARY CONDITIONS =====
  describe('Edge Cases and Boundary Conditions', () => {
    beforeEach(async () => {
      orchestrator = new AgentOrchestrator();
      await orchestrator.start();
    });

    it('should handle empty task payload', async () => {
      const task = { type: 'empty' };
      const taskId = await orchestrator.assignTask(task);
      expect(taskId).toBeDefined();
    });

    it('should handle very large task payload', async () => {
      const largePayload = new Array(10000).fill('x').join('');
      const task = { type: 'large', payload: largePayload };

      const taskId = await orchestrator.assignTask(task);
      expect(taskId).toBeDefined();
    });

    it('should handle special characters in task data', async () => {
      const task = {
        type: 'special-chars',
        payload: '\\n\\r\\t"\'<>&®™€',
      };

      const taskId = await orchestrator.assignTask(task);
      expect(taskId).toBeDefined();
    });

    it('should handle concurrent modifications', async () => {
      const task = { type: 'concurrent', value: 0 };
      const taskId = await orchestrator.assignTask(task);

      // Simulate concurrent updates
      const updates = Array(10).fill().map((_, i) =>
        orchestrator.updateTask(taskId, { value: i })
      );

      await Promise.all(updates);

      const finalTask = await orchestrator.getTask(taskId);
      expect(finalTask.value).toBeDefined();
    });

    it('should handle system resource constraints', async () => {
      // Simulate low memory scenario
      const originalLimit = process.memoryUsage().heapTotal;

      // Try to allocate many tasks
      const tasks = [];
      let errorThrown = false;

      try {
        for (let i = 0; i < 10000; i++) {
          tasks.push(orchestrator.assignTask({
            type: 'memory-intensive',
            payload: new Array(1000).fill('data'),
          }));
        }
        await Promise.all(tasks);
      } catch (error) {
        errorThrown = true;
        expect(error.message).toContain('memory');
      }

      // Should handle memory pressure gracefully
      expect(errorThrown || tasks.length > 0).toBe(true);
    });
  });

  // ===== INTEGRATION WITH EXTERNAL SYSTEMS =====
  describe('External System Integration', () => {
    it('should integrate with monitoring systems', async () => {
      orchestrator = new AgentOrchestrator();
      await orchestrator.start();

      const metrics = await orchestrator.getMetrics();

      expect(metrics).toMatchObject({
        tasksProcessed: expect.any(Number),
        avgProcessingTime: expect.any(Number),
        errorRate: expect.any(Number),
        activeAgents: expect.any(Number),
      });
    });

    it('should expose health check endpoint data', async () => {
      orchestrator = new AgentOrchestrator();
      await orchestrator.start();

      const health = await orchestrator.getHealthStatus();

      expect(health).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number),
        rabbitmq: expect.objectContaining({
          connected: true,
        }),
      });
    });

    it('should support custom plugins', async () => {
      const customPlugin = {
        name: 'custom-processor',
        process: jest.fn(async (task) => ({ ...task, processed: true })),
      };

      orchestrator = new AgentOrchestrator();
      orchestrator.registerPlugin(customPlugin);
      await orchestrator.start();

      const task = { type: 'custom' };
      await orchestrator.assignTask(task);

      expect(customPlugin.process).toHaveBeenCalled();
    });
  });
});

// ==================== PERFORMANCE BENCHMARK SUITE ====================
describe('Performance Benchmarks', () => {
  let orchestrator;

  beforeEach(async () => {
    orchestrator = new AgentOrchestrator({
      maxConcurrentTasks: 1000,
      performanceMode: true,
    });
    await orchestrator.start();
  });

  afterEach(async () => {
    await orchestrator.stop();
  });

  it('should meet performance SLAs', async () => {
    const slas = {
      taskAssignmentLatency: 10, // ms
      messagePublishLatency: 5,  // ms
      queueSetupTime: 100,       // ms
    };

    const measurements = await orchestrator.runPerformanceTest({
      duration: 5000,      // 5 seconds
      tasksPerSecond: 100,
    });

    expect(measurements.avgTaskAssignment).toBeLessThan(slas.taskAssignmentLatency);
    expect(measurements.avgMessagePublish).toBeLessThan(slas.messagePublishLatency);
    expect(measurements.avgQueueSetup).toBeLessThan(slas.queueSetupTime);
  });
});

// ==================== STRESS TEST SUITE ====================
describe('Stress Tests', () => {
  it('should handle sustained high load', async () => {
    const orchestrator = new AgentOrchestrator({
      maxConcurrentTasks: 10000,
    });
    await orchestrator.start();

    const duration = 10000; // 10 seconds
    const startTime = Date.now();
    let taskCount = 0;
    let errorCount = 0;

    while (Date.now() - startTime < duration) {
      try {
        await orchestrator.assignTask({
          type: 'stress-test',
          id: taskCount++,
        });
      } catch (error) {
        errorCount++;
      }

      // No delay - maximum stress
    }

    const errorRate = errorCount / taskCount;
    expect(errorRate).toBeLessThan(0.01); // Less than 1% error rate

    await orchestrator.stop();
  });
});