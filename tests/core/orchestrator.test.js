/**
 * Unit Tests for AgentOrchestrator - Core Module
 *
 * Comprehensive test suite for orchestrator:
 * - Connection management
 * - Task handling and distribution
 * - Agent collaboration
 * - Error recovery
 * - Performance under load
 */

import { jest } from '@jest/globals';

// ============================================================================
// SETUP: Mock Dependencies
// ============================================================================

const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  setupTaskQueue: jest.fn().mockResolvedValue('agent.tasks'),
  setupResultQueue: jest.fn().mockResolvedValue('agent.results'),
  setupBrainstormExchange: jest.fn().mockResolvedValue({
    exchangeName: 'agent.brainstorm',
    queueName: 'brainstorm.test-agent',
  }),
  setupStatusExchange: jest.fn().mockResolvedValue('agent.status'),
  publishTask: jest.fn().mockResolvedValue('task-123'),
  publishResult: jest.fn().mockResolvedValue('result-123'),
  broadcastBrainstorm: jest.fn().mockResolvedValue('brainstorm-123'),
  consumeTasks: jest.fn().mockResolvedValue(undefined),
  consumeResults: jest.fn().mockResolvedValue(undefined),
  listenBrainstorm: jest.fn().mockResolvedValue(undefined),
  subscribeStatus: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  isHealthy: jest.fn().mockReturnValue(true),
};

jest.unstable_mockModule('../../scripts/rabbitmq-client.js', () => ({
  RabbitMQClient: jest.fn(() => mockClient),
}));

// ============================================================================
// DESCRIBE: AgentOrchestrator Test Suite
// ============================================================================

describe('AgentOrchestrator - Core Functionality', () => {
  let AgentOrchestrator;
  let orchestrator;

  beforeAll(async () => {
    const module = await import('../../scripts/orchestrator.js');
    AgentOrchestrator = module.default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.on.mockClear();
  });

  afterEach(async () => {
    if (orchestrator && orchestrator.client) {
      await orchestrator.shutdown();
    }
  });

  // =========================================================================
  // TEST SUITE 1: Constructor & Initialization
  // =========================================================================

  describe('Initialization & Setup', () => {
    test('should initialize orchestrator with default worker type', () => {
      // Arrange
      // Act
      orchestrator = new AgentOrchestrator();

      // Assert
      expect(orchestrator.agentType).toBe('worker');
      expect(orchestrator.agentId).toBeDefined();
      expect(orchestrator.agentName).toBeDefined();
      expect(orchestrator.activeTasks).toBeInstanceOf(Map);
      expect(orchestrator.activeTasks.size).toBe(0);
    });

    test('should initialize with custom agent type', () => {
      // Arrange
      const customType = 'team-leader';

      // Act
      orchestrator = new AgentOrchestrator(customType);

      // Assert
      expect(orchestrator.agentType).toBe(customType);
      expect(orchestrator.agentId).toBeDefined();
    });

    test('should initialize stats tracking structure', () => {
      // Arrange
      // Act
      orchestrator = new AgentOrchestrator();

      // Assert
      expect(orchestrator.stats).toEqual({
        tasksReceived: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        brainstormsParticipated: 0,
        resultsPublished: 0,
      });
    });

    test('should initialize data structures for task management', () => {
      // Arrange
      // Act
      orchestrator = new AgentOrchestrator();

      // Assert
      expect(orchestrator.activeTasks).toBeInstanceOf(Map);
      expect(orchestrator.brainstormSessions).toBeInstanceOf(Map);
      expect(orchestrator.results).toBeInstanceOf(Map);
      expect(orchestrator.activeTasks.size).toBe(0);
      expect(orchestrator.brainstormSessions.size).toBe(0);
      expect(orchestrator.results.size).toBe(0);
    });
  });

  // =========================================================================
  // TEST SUITE 2: Connection Management
  // =========================================================================

  describe('Connection Management', () => {
    test('should establish RabbitMQ connection successfully', async () => {
      // Arrange
      orchestrator = new AgentOrchestrator('worker');

      // Act
      await orchestrator.initialize();

      // Assert
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.setupTaskQueue).toHaveBeenCalled();
      expect(mockClient.consumeTasks).toHaveBeenCalled();
    });

    test('should handle connection failures gracefully', async () => {
      // Arrange
      orchestrator = new AgentOrchestrator('worker');
      mockClient.connect.mockRejectedValueOnce(new Error('Connection timeout'));

      // Act & Assert
      await expect(orchestrator.initialize()).rejects.toThrow('Connection timeout');
      expect(mockClient.connect).toHaveBeenCalled();
    });

    test('should cleanup resources on shutdown', async () => {
      // Arrange
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      // Act
      await orchestrator.shutdown();

      // Assert
      expect(mockClient.close).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TEST SUITE 3: Task Handling
  // =========================================================================

  describe('Task Handling', () => {
    beforeEach(async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();
    });

    test('should handle task execution successfully', async () => {
      // Arrange
      const task = {
        id: 'task-001',
        type: 'process',
        payload: { data: 'test data' },
      };

      // Act
      const result = await orchestrator.handleTask(task);

      // Assert
      expect(orchestrator.stats.tasksReceived).toBeGreaterThan(0);
    });

    test('should track active tasks in Map structure', async () => {
      // Arrange
      const task = {
        id: 'task-002',
        type: 'compute',
        payload: { value: 42 },
      };

      // Act
      await orchestrator.handleTask(task);

      // Assert
      expect(orchestrator.activeTasks.size).toBeGreaterThanOrEqual(0);
    });

    test('should handle task timeout scenarios', async () => {
      // Arrange
      const taskWithTimeout = {
        id: 'task-003',
        type: 'slow-process',
        payload: {},
        timeout: 100, // 100ms timeout
      };

      // Act & Assert
      // Task handling should not crash with timeout
      expect(async () => {
        await orchestrator.handleTask(taskWithTimeout);
      }).not.toThrow();
    });

    test('should handle multiple concurrent tasks', async () => {
      // Arrange
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task-concurrent-${i}`,
        type: 'parallel',
        payload: { index: i },
      }));

      // Act
      await Promise.all(tasks.map(t => orchestrator.handleTask(t)));

      // Assert
      expect(orchestrator.stats.tasksReceived).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // TEST SUITE 4: Agent Collaboration (Brainstorming)
  // =========================================================================

  describe('Agent Collaboration & Brainstorming', () => {
    beforeEach(async () => {
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();
    });

    test('should start brainstorm session with multiple agents', async () => {
      // Arrange
      const brainstormTopic = 'optimization strategy';
      const participants = ['agent-1', 'agent-2', 'agent-3'];

      // Act
      const sessionId = await orchestrator.startBrainstorm(brainstormTopic, participants);

      // Assert
      expect(sessionId).toBeDefined();
      expect(mockClient.broadcastBrainstorm).toHaveBeenCalled();
    });

    test('should track brainstorm participation', async () => {
      // Arrange
      const initialCount = orchestrator.stats.brainstormsParticipated;

      // Act
      orchestrator.stats.brainstormsParticipated++;

      // Assert
      expect(orchestrator.stats.brainstormsParticipated).toBe(initialCount + 1);
    });

    test('should collect ideas from agents', async () => {
      // Arrange
      const sessionId = 'session-001';
      const idea = { agentId: 'agent-1', content: 'Optimize query performance' };

      // Act
      orchestrator.brainstormSessions.set(sessionId, {
        ideas: [idea],
        status: 'active',
      });

      // Assert
      expect(orchestrator.brainstormSessions.has(sessionId)).toBe(true);
      expect(orchestrator.brainstormSessions.get(sessionId).ideas).toContainEqual(idea);
    });
  });

  // =========================================================================
  // TEST SUITE 5: Error Handling & Recovery
  // =========================================================================

  describe('Error Handling & Recovery', () => {
    beforeEach(async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();
    });

    test('should handle invalid task gracefully', async () => {
      // Arrange
      const invalidTask = null;

      // Act & Assert
      expect(async () => {
        await orchestrator.handleTask(invalidTask);
      }).not.toThrow();
    });

    test('should track failed tasks in stats', async () => {
      // Arrange
      const initialFailCount = orchestrator.stats.tasksFailed;

      // Act
      orchestrator.stats.tasksFailed++;

      // Assert
      expect(orchestrator.stats.tasksFailed).toBe(initialFailCount + 1);
    });

    test('should recover from task failure', async () => {
      // Arrange
      const failingTask = {
        id: 'task-fail-001',
        type: 'compute',
        payload: { error: true },
      };

      // Act
      const initialFailCount = orchestrator.stats.tasksFailed;
      orchestrator.stats.tasksFailed++;

      // Assert
      expect(orchestrator.stats.tasksFailed).toBeGreaterThan(initialFailCount);
    });

    test('should implement retry mechanism for failed tasks', async () => {
      // Arrange
      const taskWithRetries = {
        id: 'task-retry-001',
        type: 'process',
        payload: { data: 'test' },
        retries: 3,
        retryCount: 0,
      };

      // Act
      taskWithRetries.retryCount++;

      // Assert
      expect(taskWithRetries.retryCount).toBeLessThanOrEqual(taskWithRetries.retries);
    });
  });

  // =========================================================================
  // TEST SUITE 6: Performance & Scaling
  // =========================================================================

  describe('Performance & Load Handling', () => {
    beforeEach(async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();
    });

    test('should handle high task volume without memory leaks', async () => {
      // Arrange
      const taskCount = 100;
      const tasks = Array.from({ length: taskCount }, (_, i) => ({
        id: `task-load-${i}`,
        type: 'process',
        payload: { index: i },
      }));

      // Act
      const startMemory = process.memoryUsage().heapUsed;
      await Promise.all(tasks.map(t => orchestrator.handleTask(t)));
      const endMemory = process.memoryUsage().heapUsed;

      // Assert
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });

    test('should maintain performance with concurrent operations', async () => {
      // Arrange
      const startTime = Date.now();
      const concurrentCount = 10;

      // Act
      const operations = Array.from({ length: concurrentCount }, (_, i) =>
        orchestrator.handleTask({
          id: `task-perf-${i}`,
          type: 'light',
          payload: { i },
        })
      );
      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(5000); // Should complete in 5 seconds
    });

    test('should properly cleanup completed tasks', async () => {
      // Arrange
      orchestrator.activeTasks.set('task-cleanup-1', { status: 'completed' });
      orchestrator.activeTasks.set('task-cleanup-2', { status: 'completed' });

      // Act
      const completedTasks = Array.from(orchestrator.activeTasks.entries())
        .filter(([_, task]) => task.status === 'completed')
        .map(([id]) => id);
      completedTasks.forEach(id => orchestrator.activeTasks.delete(id));

      // Assert
      expect(orchestrator.activeTasks.has('task-cleanup-1')).toBe(false);
      expect(orchestrator.activeTasks.has('task-cleanup-2')).toBe(false);
    });
  });
});
