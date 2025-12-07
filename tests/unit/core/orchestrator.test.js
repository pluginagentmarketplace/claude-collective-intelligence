/**
 * Unit Tests for AgentOrchestrator
 * Comprehensive tests for agent coordination, task handling, and collaboration
 */

import { jest } from '@jest/globals';

// Mock RabbitMQClient
const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  setupTaskQueue: jest.fn().mockResolvedValue('agent.tasks'),
  setupBrainstormExchange: jest.fn().mockResolvedValue({
    exchangeName: 'agent.brainstorm',
    queueName: 'brainstorm.test-agent',
  }),
  setupResultQueue: jest.fn().mockResolvedValue('agent.results'),
  setupStatusExchange: jest.fn().mockResolvedValue('agent.status'),
  consumeTasks: jest.fn().mockResolvedValue(undefined),
  consumeResults: jest.fn().mockResolvedValue(undefined),
  listenBrainstorm: jest.fn().mockResolvedValue(undefined),
  subscribeStatus: jest.fn().mockResolvedValue(undefined),
  publishTask: jest.fn().mockResolvedValue('task-123'),
  publishResult: jest.fn().mockResolvedValue('result-123'),
  publishStatus: jest.fn().mockResolvedValue('status-123'),
  broadcastBrainstorm: jest.fn().mockResolvedValue('brainstorm-123'),
  on: jest.fn(),
  isHealthy: jest.fn().mockReturnValue(true),
};

// Mock RabbitMQClient module
jest.unstable_mockModule('../../../src/core/rabbitmq-client.js', () => ({
  RabbitMQClient: jest.fn(() => mockClient),
}));

describe('AgentOrchestrator', () => {
  let AgentOrchestrator;
  let orchestrator;

  beforeAll(async () => {
    // Import after mocking
    const module = await import('../../../src/core/orchestrator.js');
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

  describe('Constructor', () => {
    test('should initialize with default worker type', () => {
      orchestrator = new AgentOrchestrator();

      expect(orchestrator.agentType).toBe('worker');
      expect(orchestrator.agentId).toBeDefined();
      expect(orchestrator.agentName).toBeDefined();
      expect(orchestrator.client).toBeNull();
    });

    test('should initialize with custom agent type', () => {
      orchestrator = new AgentOrchestrator('team-leader');

      expect(orchestrator.agentType).toBe('team-leader');
    });

    test('should initialize data structures', () => {
      orchestrator = new AgentOrchestrator();

      expect(orchestrator.activeTasks).toBeInstanceOf(Map);
      expect(orchestrator.brainstormSessions).toBeInstanceOf(Map);
      expect(orchestrator.results).toBeInstanceOf(Map);
      expect(orchestrator.activeTasks.size).toBe(0);
      expect(orchestrator.brainstormSessions.size).toBe(0);
      expect(orchestrator.results.size).toBe(0);
    });

    test('should initialize stats', () => {
      orchestrator = new AgentOrchestrator();

      expect(orchestrator.stats).toEqual({
        tasksReceived: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        brainstormsParticipated: 0,
        resultsPublished: 0,
      });
    });
  });

  describe('initialize()', () => {
    test('should connect to RabbitMQ', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      expect(mockClient.connect).toHaveBeenCalled();
    });

    test('should setup queues and exchanges', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      expect(mockClient.setupTaskQueue).toHaveBeenCalled();
      expect(mockClient.setupBrainstormExchange).toHaveBeenCalled();
      expect(mockClient.setupResultQueue).toHaveBeenCalled();
      expect(mockClient.setupStatusExchange).toHaveBeenCalled();
    });

    test('should setup event listeners', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      expect(mockClient.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should store brainstorm queue name', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      expect(orchestrator.brainstormQueue).toBe('brainstorm.test-agent');
    });

    test('should return orchestrator instance', async () => {
      orchestrator = new AgentOrchestrator('worker');
      const result = await orchestrator.initialize();

      expect(result).toBe(orchestrator);
    });
  });

  describe('Event Handlers', () => {
    test('should publish status on connected event', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const connectedHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'connected'
      )[1];
      await connectedHandler();

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'connected', agentType: 'worker' }),
        'agent.status.connected'
      );
    });

    test('should publish status on disconnected event', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const disconnectedHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'disconnected'
      )[1];
      await disconnectedHandler();

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'disconnected', agentType: 'worker' }),
        'agent.status.disconnected'
      );
    });

    test('should handle error event', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')[1];
      const error = new Error('Test error');
      errorHandler(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Client error:', error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('startTeamLeader()', () => {
    test('should consume results', async () => {
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();
      await orchestrator.startTeamLeader();

      expect(mockClient.consumeResults).toHaveBeenCalledWith(
        'agent.results',
        expect.any(Function)
      );
    });

    test('should subscribe to status updates', async () => {
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();
      await orchestrator.startTeamLeader();

      expect(mockClient.subscribeStatus).toHaveBeenCalledWith(
        'agent.status.#',
        'agent.status',
        expect.any(Function)
      );
    });
  });

  describe('startWorker()', () => {
    test('should consume tasks', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();
      await orchestrator.startWorker();

      expect(mockClient.consumeTasks).toHaveBeenCalledWith(
        'agent.tasks',
        expect.any(Function)
      );
    });

    test('should listen to brainstorms', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();
      await orchestrator.startWorker();

      expect(mockClient.listenBrainstorm).toHaveBeenCalledWith(
        'brainstorm.test-agent',
        expect.any(Function)
      );
    });
  });

  describe('startCollaborator()', () => {
    test('should listen to brainstorms', async () => {
      orchestrator = new AgentOrchestrator('collaborator');
      await orchestrator.initialize();
      await orchestrator.startCollaborator();

      expect(mockClient.listenBrainstorm).toHaveBeenCalledWith(
        'brainstorm.test-agent',
        expect.any(Function)
      );
    });

    test('should consume tasks', async () => {
      orchestrator = new AgentOrchestrator('collaborator');
      await orchestrator.initialize();
      await orchestrator.startCollaborator();

      expect(mockClient.consumeTasks).toHaveBeenCalledWith(
        'agent.tasks',
        expect.any(Function)
      );
    });
  });

  describe('assignTask()', () => {
    test('should publish task with correct format', async () => {
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();

      const task = {
        title: 'Test Task',
        description: 'Do something',
        priority: 'high',
      };

      const taskId = await orchestrator.assignTask(task);

      expect(mockClient.publishTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Task',
          description: 'Do something',
          priority: 'high',
          assignedBy: orchestrator.agentId,
        })
      );
      expect(taskId).toBe('task-123');
    });

    test('should use default priority if not provided', async () => {
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();

      const task = {
        title: 'Test Task',
        description: 'Do something',
      };

      await orchestrator.assignTask(task);

      expect(mockClient.publishTask).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'normal',
        })
      );
    });

    test('should publish status after task assignment', async () => {
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();

      const task = {
        title: 'Test Task',
        description: 'Do something',
      };

      await orchestrator.assignTask(task);

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'task_assigned',
          taskId: 'task-123',
          task: 'Test Task',
        }),
        'agent.status.task.assigned'
      );
    });
  });

  describe('handleTask()', () => {
    let ack, nack, reject;

    beforeEach(() => {
      ack = jest.fn();
      nack = jest.fn();
      reject = jest.fn();
    });

    test('should process task successfully', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const msg = {
        id: 'task-123',
        task: {
          title: 'Test Task',
          description: 'Do something',
          priority: 'normal',
        },
      };

      await orchestrator.handleTask(msg, { ack, nack, reject });

      expect(orchestrator.stats.tasksReceived).toBe(1);
      expect(orchestrator.stats.tasksCompleted).toBe(1);
      expect(ack).toHaveBeenCalled();
    });

    test('should track active task', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const msg = {
        id: 'task-123',
        task: {
          title: 'Test Task',
          description: 'Do something',
          priority: 'normal',
        },
      };

      // Mock a delay to check active tasks
      const originalPublishResult = orchestrator.publishResult;
      orchestrator.publishResult = jest.fn().mockImplementation(async () => {
        expect(orchestrator.activeTasks.has('task-123')).toBe(true);
        return originalPublishResult.call(orchestrator, ...arguments);
      });

      await orchestrator.handleTask(msg, { ack, nack, reject });
    });

    test('should publish task started status', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const msg = {
        id: 'task-123',
        task: {
          title: 'Test Task',
          description: 'Do something',
          priority: 'normal',
        },
      };

      await orchestrator.handleTask(msg, { ack, nack, reject });

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'task_started',
          taskId: 'task-123',
          task: 'Test Task',
        }),
        'agent.status.task.started'
      );
    });

    test('should publish result after completion', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const msg = {
        id: 'task-123',
        task: {
          title: 'Test Task',
          description: 'Do something',
          priority: 'normal',
        },
      };

      await orchestrator.handleTask(msg, { ack, nack, reject });

      expect(mockClient.publishResult).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-123',
          status: 'completed',
          processedBy: orchestrator.agentId,
        })
      );
    });

    test('should handle collaboration requirement', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const msg = {
        id: 'task-123',
        task: {
          title: 'Test Task',
          description: 'Do something',
          priority: 'normal',
          requiresCollaboration: true,
          collaborationQuestion: 'How to proceed?',
        },
      };

      await orchestrator.handleTask(msg, { ack, nack, reject });

      expect(mockClient.broadcastBrainstorm).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-123',
          topic: 'Test Task',
          question: 'How to proceed?',
        })
      );
    });

    test('should handle task failure', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      // Force an error by mocking publishStatus to throw
      const error = new Error('Processing failed');
      mockClient.publishStatus.mockRejectedValueOnce(error);

      const msg = {
        id: 'task-123',
        task: {
          title: 'Test Task',
          description: 'Do something',
          priority: 'normal',
        },
      };

      await orchestrator.handleTask(msg, { ack, nack, reject });

      expect(orchestrator.stats.tasksFailed).toBe(1);
      expect(reject).toHaveBeenCalled();
    });

    test('should retry failed task if retryCount > 0', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const error = new Error('Processing failed');
      mockClient.publishStatus.mockRejectedValueOnce(error);

      const msg = {
        id: 'task-123',
        task: {
          title: 'Test Task',
          description: 'Do something',
          priority: 'normal',
          retryCount: 2,
        },
      };

      await orchestrator.handleTask(msg, { ack, nack, reject });

      expect(nack).toHaveBeenCalledWith(true);
      expect(reject).not.toHaveBeenCalled();
    });

    test('should remove task from active tasks after completion', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const msg = {
        id: 'task-123',
        task: {
          title: 'Test Task',
          description: 'Do something',
          priority: 'normal',
        },
      };

      await orchestrator.handleTask(msg, { ack, nack, reject });

      expect(orchestrator.activeTasks.has('task-123')).toBe(false);
    });
  });

  describe('initiateBrainstorm()', () => {
    test('should create brainstorm session', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const session = {
        taskId: 'task-123',
        topic: 'Collaboration',
        question: 'How to proceed?',
        requiredAgents: ['agent-1', 'agent-2'],
      };

      const sessionId = await orchestrator.initiateBrainstorm(session);

      expect(sessionId).toBeDefined();
      expect(orchestrator.brainstormSessions.has(sessionId)).toBe(true);
    });

    test('should broadcast brainstorm message', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const session = {
        taskId: 'task-123',
        topic: 'Collaboration',
        question: 'How to proceed?',
      };

      await orchestrator.initiateBrainstorm(session);

      expect(mockClient.broadcastBrainstorm).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'Collaboration',
          question: 'How to proceed?',
          initiatedBy: orchestrator.agentId,
        })
      );
    });
  });

  describe('handleBrainstormMessage()', () => {
    test('should process brainstorm message', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const msg = {
        message: {
          sessionId: 'session-123',
          topic: 'Collaboration',
          question: 'How to proceed?',
          initiatedBy: 'other-agent',
        },
      };

      await orchestrator.handleBrainstormMessage(msg);

      expect(orchestrator.stats.brainstormsParticipated).toBe(1);
    });

    test('should publish brainstorm response', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const msg = {
        message: {
          sessionId: 'session-123',
          topic: 'Collaboration',
          question: 'How to proceed?',
          initiatedBy: 'other-agent',
        },
      };

      await orchestrator.handleBrainstormMessage(msg);

      expect(mockClient.publishResult).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'brainstorm_response',
          sessionId: 'session-123',
          from: orchestrator.agentId,
        })
      );
    });
  });

  describe('publishResult()', () => {
    test('should publish result to client', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const result = {
        taskId: 'task-123',
        status: 'completed',
        output: 'Done',
      };

      await orchestrator.publishResult(result);

      expect(mockClient.publishResult).toHaveBeenCalledWith(result);
    });

    test('should store result locally', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const result = {
        taskId: 'task-123',
        status: 'completed',
        output: 'Done',
      };

      await orchestrator.publishResult(result);

      expect(orchestrator.results.has('task-123')).toBe(true);
      expect(orchestrator.results.get('task-123')).toEqual(result);
    });

    test('should increment resultsPublished stat', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const result = {
        taskId: 'task-123',
        status: 'completed',
        output: 'Done',
      };

      await orchestrator.publishResult(result);

      expect(orchestrator.stats.resultsPublished).toBe(1);
    });

    test('should publish result status', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const result = {
        taskId: 'task-123',
        status: 'completed',
        output: 'Done',
      };

      await orchestrator.publishResult(result);

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'result_published',
          resultId: 'task-123',
        }),
        'agent.status.result'
      );
    });
  });

  describe('handleResult()', () => {
    test('should handle task result', async () => {
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();

      const msg = {
        result: {
          taskId: 'task-123',
          task: 'Test Task',
          status: 'completed',
          processedBy: 'worker-1',
          duration: 1000,
        },
      };

      await orchestrator.handleResult(msg);

      expect(orchestrator.results.has('task-123')).toBe(true);
    });

    test('should handle brainstorm response', async () => {
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();

      const msg = {
        result: {
          type: 'brainstorm_response',
          sessionId: 'session-123',
          from: 'agent-1',
          suggestion: 'Consider this approach',
        },
      };

      await orchestrator.handleResult(msg);

      expect(orchestrator.results.has('session-123')).toBe(true);
    });
  });

  describe('publishStatus()', () => {
    test('should publish status with agent info', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      await orchestrator.publishStatus({ state: 'active' }, 'agent.status.active');

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'active',
          agentId: orchestrator.agentId,
          agentType: 'worker',
          stats: orchestrator.stats,
        }),
        'agent.status.active'
      );
    });
  });

  describe('handleStatusUpdate()', () => {
    test('should process status updates from other agents', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();

      const msg = {
        status: {
          agentId: 'other-agent',
          event: 'task_completed',
        },
      };

      await orchestrator.handleStatusUpdate(msg);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status update from other-agent')
      );
      consoleLogSpy.mockRestore();
    });

    test('should ignore own status updates', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      orchestrator = new AgentOrchestrator('team-leader');
      await orchestrator.initialize();

      const msg = {
        status: {
          agentId: orchestrator.agentId,
          event: 'task_completed',
        },
      };

      await orchestrator.handleStatusUpdate(msg);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Status update')
      );
      consoleLogSpy.mockRestore();
    });
  });

  describe('getStats()', () => {
    test('should return current statistics', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      orchestrator.stats.tasksReceived = 5;
      orchestrator.stats.tasksCompleted = 3;
      orchestrator.activeTasks.set('task-1', {});
      orchestrator.brainstormSessions.set('session-1', {});
      orchestrator.results.set('result-1', {});

      const stats = orchestrator.getStats();

      expect(stats).toEqual({
        tasksReceived: 5,
        tasksCompleted: 3,
        tasksFailed: 0,
        brainstormsParticipated: 0,
        resultsPublished: 0,
        activeTasks: 1,
        activeBrainstorms: 1,
        totalResults: 1,
      });
    });
  });

  describe('shutdown()', () => {
    test('should publish shutdown status', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      await orchestrator.shutdown();

      expect(mockClient.publishStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'shutdown',
          finalStats: expect.any(Object),
        }),
        'agent.status.shutdown'
      );
    });

    test('should close client connection', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      await orchestrator.shutdown();

      expect(mockClient.close).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle initialization without connection', async () => {
      mockClient.connect.mockRejectedValueOnce(new Error('Connection failed'));

      orchestrator = new AgentOrchestrator('worker');

      await expect(orchestrator.initialize()).rejects.toThrow('Connection failed');
    });

    test('should handle empty task', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const ack = jest.fn();
      const nack = jest.fn();
      const reject = jest.fn();

      const msg = {
        id: 'task-123',
        task: {},
      };

      await orchestrator.handleTask(msg, { ack, nack, reject });

      expect(ack).toHaveBeenCalled();
    });

    test('should handle brainstorm with default question', async () => {
      orchestrator = new AgentOrchestrator('worker');
      await orchestrator.initialize();

      const session = {
        taskId: 'task-123',
        topic: 'Collaboration',
      };

      await orchestrator.initiateBrainstorm(session);

      expect(mockClient.broadcastBrainstorm).toHaveBeenCalledWith(
        expect.objectContaining({
          question: undefined,
        })
      );
    });
  });
});
