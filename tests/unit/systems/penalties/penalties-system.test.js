/**
 * Unit Tests for Penalties System
 * Comprehensive tests for all components: PenaltySystem, PerformanceEvaluator, RetrainingManager
 * 40+ test cases covering all functionality
 */

import { jest } from '@jest/globals';
import { PenaltySystem, ResourceThrottle } from '../../../../src/systems/penalties/system.js';
import { PerformanceEvaluator } from '../../scripts/penalties/performance-evaluator.js';
import { RetrainingManager } from '../../scripts/penalties/retraining-manager.js';

describe('PenaltySystem', () => {
  let penaltySystem;
  let mockClient;
  let mockMonitor;

  beforeEach(() => {
    mockClient = {
      isHealthy: jest.fn().mockReturnValue(true),
      publish: jest.fn().mockResolvedValue('msg-123'),
      publishMessage: jest.fn().mockResolvedValue('msg-456')
    };

    mockMonitor = {
      getAgentMetrics: jest.fn().mockResolvedValue({
        agentId: 'agent-1',
        errorRate: 0.05,
        timeoutRate: 0.10,
        successRate: 0.95,
        qualityScore: 0.90,
        baselineQuality: 0.90,
        currentQuality: 0.90,
        collaborationSuccessRate: 0.95,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
        taskCount: 20,
        avgResponseTime: 1000
      })
    };

    penaltySystem = new PenaltySystem(mockClient, mockMonitor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with RabbitMQ client and monitor', () => {
      expect(penaltySystem.client).toBe(mockClient);
      expect(penaltySystem.monitor).toBe(mockMonitor);
      expect(penaltySystem.penalties).toBeInstanceOf(Map);
      expect(penaltySystem.appeals).toBeInstanceOf(Map);
      expect(penaltySystem.throttles).toBeInstanceOf(Map);
    });

    test('should have 6 penalty levels configured', () => {
      expect(penaltySystem.penaltyLevels).toHaveProperty('1');
      expect(penaltySystem.penaltyLevels).toHaveProperty('2');
      expect(penaltySystem.penaltyLevels).toHaveProperty('3');
      expect(penaltySystem.penaltyLevels).toHaveProperty('4');
      expect(penaltySystem.penaltyLevels).toHaveProperty('5');
      expect(penaltySystem.penaltyLevels).toHaveProperty('6');
    });

    test('should initialize evaluator and retraining manager', () => {
      expect(penaltySystem.evaluator).toBeInstanceOf(PerformanceEvaluator);
      expect(penaltySystem.retrainingManager).toBeInstanceOf(RetrainingManager);
    });
  });

  describe('evaluateAgentPerformance()', () => {
    test('should return null when no triggers detected', async () => {
      const result = await penaltySystem.evaluateAgentPerformance('agent-1');
      expect(result).toBeNull();
    });

    test('should apply penalty when error rate exceeds threshold', async () => {
      mockMonitor.getAgentMetrics.mockResolvedValue({
        agentId: 'agent-1',
        errorRate: 0.15, // Above 10% threshold
        timeoutRate: 0.05,
        successRate: 0.85,
        qualityScore: 0.85,
        baselineQuality: 0.90,
        currentQuality: 0.85,
        collaborationSuccessRate: 0.95,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
        taskCount: 20,
        avgResponseTime: 1000
      });

      const penalty = await penaltySystem.evaluateAgentPerformance('agent-1');

      expect(penalty).toBeDefined();
      expect(penalty.agentId).toBe('agent-1');
      expect(penalty.level).toBeGreaterThanOrEqual(1);
      expect(penalty.triggeredBy).toContain('error_rate');
    });

    test('should apply penalty when timeout rate exceeds threshold', async () => {
      mockMonitor.getAgentMetrics.mockResolvedValue({
        agentId: 'agent-1',
        errorRate: 0.05,
        timeoutRate: 0.25, // Above 20% threshold
        successRate: 0.75,
        qualityScore: 0.85,
        baselineQuality: 0.90,
        currentQuality: 0.85,
        collaborationSuccessRate: 0.95,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
        taskCount: 20,
        avgResponseTime: 1000
      });

      const penalty = await penaltySystem.evaluateAgentPerformance('agent-1');

      expect(penalty).toBeDefined();
      expect(penalty.triggeredBy).toContain('timeout_frequency');
    });

    test('should apply penalty when quality drops significantly', async () => {
      mockMonitor.getAgentMetrics.mockResolvedValue({
        agentId: 'agent-1',
        errorRate: 0.05,
        timeoutRate: 0.10,
        successRate: 0.90,
        qualityScore: 0.70,
        baselineQuality: 0.90,
        currentQuality: 0.70, // 22% drop
        collaborationSuccessRate: 0.95,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
        taskCount: 20,
        avgResponseTime: 1000
      });

      const penalty = await penaltySystem.evaluateAgentPerformance('agent-1');

      expect(penalty).toBeDefined();
      expect(penalty.triggeredBy).toContain('quality_drop');
    });

    test('should apply penalty for collaboration failures', async () => {
      mockMonitor.getAgentMetrics.mockResolvedValue({
        agentId: 'agent-1',
        errorRate: 0.05,
        timeoutRate: 0.10,
        successRate: 0.90,
        qualityScore: 0.85,
        baselineQuality: 0.90,
        currentQuality: 0.85,
        collaborationSuccessRate: 0.65,
        collaborationFailureRate: 0.35, // Above 30% threshold
        resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
        taskCount: 20,
        avgResponseTime: 1000
      });

      const penalty = await penaltySystem.evaluateAgentPerformance('agent-1');

      expect(penalty).toBeDefined();
      expect(penalty.triggeredBy).toContain('collaboration_failure');
    });

    test('should apply penalty for resource abuse', async () => {
      mockMonitor.getAgentMetrics.mockResolvedValue({
        agentId: 'agent-1',
        errorRate: 0.05,
        timeoutRate: 0.10,
        successRate: 0.90,
        qualityScore: 0.85,
        baselineQuality: 0.90,
        currentQuality: 0.85,
        collaborationSuccessRate: 0.95,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 2.0, memory: 1.8, network: 1.0 }, // Exceeding limits
        taskCount: 20,
        avgResponseTime: 1000
      });

      const penalty = await penaltySystem.evaluateAgentPerformance('agent-1');

      expect(penalty).toBeDefined();
      expect(penalty.triggeredBy).toContain('resource_abuse');
    });
  });

  describe('applyPenalty()', () => {
    test('should create penalty with correct level', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      const penalty = await penaltySystem.applyPenalty('agent-1', 2, triggers, context);

      expect(penalty.level).toBe(2);
      expect(penalty.agentId).toBe('agent-1');
      expect(penalty.name).toBe('COMPUTE_REDUCTION');
    });

    test('should store penalty in map', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      expect(penaltySystem.penalties.has('agent-1')).toBe(true);
    });

    test('should create improvement plan', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      const penalty = await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      expect(penalty.improvementPlan).toBeDefined();
      expect(penalty.improvementPlan.targetMetrics).toHaveProperty('errorRate');
      expect(penalty.improvementPlan.targetMetrics.errorRate).toBe(0.05);
    });

    test('should start retraining for level 5 penalties', async () => {
      const startRetrainingSpy = jest.spyOn(penaltySystem.retrainingManager, 'startRetraining')
        .mockResolvedValue('session-123');

      const triggers = [{ type: 'error_rate', value: 0.45, threshold: 0.10, severity: 4 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      await penaltySystem.applyPenalty('agent-1', 5, triggers, context);

      expect(startRetrainingSpy).toHaveBeenCalledWith('agent-1', triggers);

      startRetrainingSpy.mockRestore();
    });

    test('should publish penalty event to RabbitMQ', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      expect(mockClient.publish).toHaveBeenCalledWith(
        'agent.penalties',
        expect.stringContaining('penalty.applied'),
        expect.objectContaining({ type: 'penalty_applied' })
      );
    });

    test('should emit penalty_applied event', async () => {
      const listener = jest.fn();
      penaltySystem.on('penalty_applied', listener);

      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('checkForRecovery()', () => {
    test('should remove penalty when targets are met', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      // Mock improved metrics
      mockMonitor.getAgentMetrics.mockResolvedValue({
        agentId: 'agent-1',
        errorRate: 0.03, // Below target of 0.05
        timeoutRate: 0.05,
        successRate: 0.97,
        qualityScore: 0.90,
        baselineQuality: 0.90,
        currentQuality: 0.90,
        collaborationSuccessRate: 0.95,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
        taskCount: 20,
        avgResponseTime: 1000
      });

      await penaltySystem.checkForRecovery('agent-1');

      expect(penaltySystem.penalties.has('agent-1')).toBe(false);
    });

    test('should not remove penalty when targets not met', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      // Mock still poor metrics
      mockMonitor.getAgentMetrics.mockResolvedValue({
        agentId: 'agent-1',
        errorRate: 0.08, // Still above target of 0.05
        timeoutRate: 0.05,
        successRate: 0.92,
        qualityScore: 0.85,
        baselineQuality: 0.90,
        currentQuality: 0.85,
        collaborationSuccessRate: 0.95,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
        taskCount: 20,
        avgResponseTime: 1000
      });

      await penaltySystem.checkForRecovery('agent-1');

      expect(penaltySystem.penalties.has('agent-1')).toBe(true);
    });
  });

  describe('fileAppeal()', () => {
    test('should create appeal successfully', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});
      const penalty = await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      const grounds = {
        type: 'environmental_factors',
        explanation: 'Network issues during evaluation',
        evidence: {}
      };

      const appealId = await penaltySystem.fileAppeal(penalty.id, 'agent-1', grounds);

      expect(appealId).toBeDefined();
      expect(penaltySystem.appeals.has(appealId)).toBe(true);
    });

    test('should update penalty status to pending', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});
      const penalty = await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      const grounds = { type: 'unfair_metrics', explanation: 'Test', evidence: {} };

      await penaltySystem.fileAppeal(penalty.id, 'agent-1', grounds);

      const storedPenalty = penaltySystem.penalties.get('agent-1');
      expect(storedPenalty.appealStatus).toBe('pending');
    });

    test('should throw error if penalty not found', async () => {
      await expect(
        penaltySystem.fileAppeal('invalid-id', 'agent-1', {})
      ).rejects.toThrow('Penalty not found');
    });

    test('should emit appeal_filed event', async () => {
      const listener = jest.fn();
      penaltySystem.on('appeal_filed', listener);

      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});
      const penalty = await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      const grounds = { type: 'unfair_metrics', explanation: 'Test', evidence: {} };
      await penaltySystem.fileAppeal(penalty.id, 'agent-1', grounds);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('reviewAppeal()', () => {
    test('should approve appeal and reverse penalty', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});
      const penalty = await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      const grounds = { type: 'unfair_metrics', explanation: 'Test', evidence: {} };
      const appealId = await penaltySystem.fileAppeal(penalty.id, 'agent-1', grounds);

      await penaltySystem.reviewAppeal(appealId, 'coordinator', 'approved', ['Valid appeal']);

      expect(penaltySystem.penalties.has('agent-1')).toBe(false);
    });

    test('should deny appeal and keep penalty', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});
      const penalty = await penaltySystem.applyPenalty('agent-1', 1, triggers, context);

      const grounds = { type: 'unfair_metrics', explanation: 'Test', evidence: {} };
      const appealId = await penaltySystem.fileAppeal(penalty.id, 'agent-1', grounds);

      await penaltySystem.reviewAppeal(appealId, 'coordinator', 'denied', ['Invalid appeal']);

      expect(penaltySystem.penalties.has('agent-1')).toBe(true);
    });
  });

  describe('getDashboard()', () => {
    test('should return dashboard statistics', () => {
      const dashboard = penaltySystem.getDashboard();

      expect(dashboard).toHaveProperty('totalPenalties');
      expect(dashboard).toHaveProperty('byLevel');
      expect(dashboard).toHaveProperty('appeals');
      expect(dashboard).toHaveProperty('probation');
      expect(dashboard).toHaveProperty('retraining');
    });

    test('should count penalties by level', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15, threshold: 0.10, severity: 1 }];
      const context = await penaltySystem.evaluator.analyzeContext('agent-1', {});

      await penaltySystem.applyPenalty('agent-1', 1, triggers, context);
      await penaltySystem.applyPenalty('agent-2', 2, triggers, context);

      const dashboard = penaltySystem.getDashboard();

      expect(dashboard.byLevel.level1).toBe(1);
      expect(dashboard.byLevel.level2).toBe(1);
    });
  });

  describe('ResourceThrottle', () => {
    let throttle;

    beforeEach(() => {
      throttle = new ResourceThrottle(100, 10);
    });

    test('should initialize with capacity and refill rate', () => {
      expect(throttle.bucket.capacity).toBe(100);
      expect(throttle.bucket.refillRate).toBe(10);
      expect(throttle.bucket.tokens).toBe(100);
    });

    test('should consume tokens successfully', async () => {
      const result = await throttle.consumeTokens(50);

      expect(result).toBe(true);
      expect(throttle.bucket.tokens).toBe(50);
    });

    test('should fail to consume when insufficient tokens', async () => {
      await throttle.consumeTokens(80);
      const result = await throttle.consumeTokens(30);

      expect(result).toBe(false);
    });

    test('should apply penalty multiplier', () => {
      throttle.applyPenalty(3);

      expect(throttle.penaltyMultiplier).toBe(0.8);
    });

    test('should refill tokens over time', async () => {
      await throttle.consumeTokens(50);

      // Wait a bit and refill
      await new Promise(resolve => setTimeout(resolve, 1000));

      const status = throttle.getStatus();
      expect(status.available).toBeGreaterThan(50);
    });

    test('should reset to full capacity', () => {
      throttle.consumeTokens(50);
      throttle.applyPenalty(5);

      throttle.reset();

      expect(throttle.bucket.tokens).toBe(100);
      expect(throttle.penaltyMultiplier).toBe(1.0);
    });
  });
});

describe('PerformanceEvaluator', () => {
  let evaluator;

  beforeEach(() => {
    evaluator = new PerformanceEvaluator();
  });

  describe('Constructor', () => {
    test('should initialize with 5 trigger configurations', () => {
      expect(evaluator.triggers).toHaveProperty('errorRate');
      expect(evaluator.triggers).toHaveProperty('timeoutFrequency');
      expect(evaluator.triggers).toHaveProperty('qualityDrop');
      expect(evaluator.triggers).toHaveProperty('collaborationFailure');
      expect(evaluator.triggers).toHaveProperty('resourceAbuse');
    });

    test('should have minimum resource guarantees', () => {
      expect(evaluator.minimumResources).toHaveProperty('cpu');
      expect(evaluator.minimumResources).toHaveProperty('memory');
      expect(evaluator.minimumResources).toHaveProperty('network');
    });
  });

  describe('analyzeContext()', () => {
    test('should analyze task difficulty', async () => {
      const context = await evaluator.analyzeContext('agent-1', {});

      expect(context.taskDifficulty).toBeDefined();
      expect(context.taskDifficulty.averageDifficulty).toBeDefined();
    });

    test('should analyze system conditions', async () => {
      const context = await evaluator.analyzeContext('agent-1', {});

      expect(context.systemConditions).toBeDefined();
      expect(context.systemConditions.systemLoad).toBeDefined();
    });

    test('should analyze agent state', async () => {
      const context = await evaluator.analyzeContext('agent-1', {});

      expect(context.agentState).toBeDefined();
      expect(context.agentState.historicalPerformance).toBeDefined();
    });
  });

  describe('evaluateTriggers()', () => {
    test('should return empty array for insufficient samples', async () => {
      const metrics = { taskCount: 5 };
      const context = await evaluator.analyzeContext('agent-1', metrics);

      const triggers = await evaluator.evaluateTriggers(metrics, context);

      expect(triggers).toEqual([]);
    });

    test('should detect error rate trigger', async () => {
      const metrics = {
        taskCount: 20,
        errorRate: 0.15,
        timeoutRate: 0.05,
        baselineQuality: 0.90,
        currentQuality: 0.90,
        collaborationFailureRate: 0.05,
        resourceUsage: { cpu: 1.0, memory: 1.0 }
      };
      const context = await evaluator.analyzeContext('agent-1', metrics);

      const triggers = await evaluator.evaluateTriggers(metrics, context);

      expect(triggers.some(t => t.type === 'error_rate')).toBe(true);
    });

    test('should detect multiple triggers', async () => {
      const metrics = {
        taskCount: 20,
        errorRate: 0.15,
        timeoutRate: 0.25,
        baselineQuality: 0.90,
        currentQuality: 0.70,
        collaborationFailureRate: 0.35,
        resourceUsage: { cpu: 2.0, memory: 1.8 }
      };
      const context = await evaluator.analyzeContext('agent-1', metrics);

      const triggers = await evaluator.evaluateTriggers(metrics, context);

      expect(triggers.length).toBeGreaterThan(1);
    });
  });

  describe('detectAnomalies()', () => {
    test('should detect anomalies in penalty', async () => {
      const penalty = {
        level: 6,
        triggeredBy: ['error_rate'],
        metricsAtStart: { baselineQuality: 0.90, currentQuality: 0.50 }
      };
      const context = await evaluator.analyzeContext('agent-1', {});

      const result = await evaluator.detectAnomalies(penalty, context);

      expect(result).toHaveProperty('anomalies');
      expect(result).toHaveProperty('anomalyScore');
      expect(result).toHaveProperty('autoReviewTriggered');
    });

    test('should trigger auto review for high anomaly score', async () => {
      const penalty = {
        level: 6,
        triggeredBy: ['error_rate'],
        metricsAtStart: { baselineQuality: 0.90, currentQuality: 0.50 }
      };
      const context = {
        systemConditions: { systemLoad: 0.9 },
        externalFactors: { networkIssues: true, rabbitmqIssues: true },
        agentState: {}
      };

      const result = await evaluator.detectAnomalies(penalty, context);

      expect(result.autoReviewTriggered).toBe(true);
    });
  });

  describe('Statistical Methods', () => {
    test('should calculate mean correctly', () => {
      const values = [1, 2, 3, 4, 5];
      const mean = evaluator.mean(values);

      expect(mean).toBe(3);
    });

    test('should calculate standard deviation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const stdDev = evaluator.standardDeviation(values);

      expect(stdDev).toBeGreaterThan(0);
    });

    test('should detect outliers using z-score', () => {
      const population = [10, 12, 11, 13, 12, 11, 10, 12];
      const outlierValue = 25;

      const isOutlier = evaluator.isOutlier(outlierValue, population);

      expect(isOutlier).toBe(true);
    });

    test('should not flag normal values as outliers', () => {
      const population = [10, 12, 11, 13, 12, 11, 10, 12];
      const normalValue = 11;

      const isOutlier = evaluator.isOutlier(normalValue, population);

      expect(isOutlier).toBe(false);
    });
  });

  describe('validateMinimumResources()', () => {
    test('should enforce minimum CPU allocation', () => {
      const allocation = { cpu: 0.05, memory: 0.5, network: 0.5, taskRate: 0.5 };

      const validated = evaluator.validateMinimumResources(allocation);

      expect(validated.cpu).toBe(evaluator.minimumResources.cpu);
    });

    test('should not change values above minimum', () => {
      const allocation = { cpu: 0.5, memory: 0.5, network: 0.5, taskRate: 0.5 };

      const validated = evaluator.validateMinimumResources(allocation);

      expect(validated.cpu).toBe(0.5);
    });
  });

  describe('getFairnessMetrics()', () => {
    test('should calculate fairness metrics', () => {
      const penalties = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const appeals = [
        { review: { status: 'approved' } },
        { review: { status: 'denied' } }
      ];

      const metrics = evaluator.getFairnessMetrics(penalties, appeals);

      expect(metrics).toHaveProperty('falsePositiveRate');
      expect(metrics).toHaveProperty('appealSuccessRate');
      expect(metrics).toHaveProperty('fairnessScore');
    });

    test('should calculate high fairness score for good system', () => {
      const penalties = Array(100).fill({ id: '1' });
      const appeals = Array(5).fill({ review: { status: 'denied' } });

      const metrics = evaluator.getFairnessMetrics(penalties, appeals);

      expect(metrics.fairnessScore).toBeGreaterThan(90);
    });
  });
});

describe('RetrainingManager', () => {
  let retrainingManager;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      isHealthy: jest.fn().mockReturnValue(true),
      publish: jest.fn().mockResolvedValue('msg-123'),
      publishMessage: jest.fn().mockResolvedValue('msg-456')
    };

    retrainingManager = new RetrainingManager(mockClient);
  });

  describe('Constructor', () => {
    test('should initialize with 4 curriculum stages', () => {
      expect(retrainingManager.curriculum.stages).toHaveLength(4);
    });

    test('should have Diagnosis as first stage', () => {
      const firstStage = retrainingManager.curriculum.stages[0];
      expect(firstStage.name).toBe('Diagnosis');
    });

    test('should have graduation requirements', () => {
      expect(retrainingManager.curriculum.graduation).toBeDefined();
      expect(retrainingManager.curriculum.graduation.minimumScore).toBe(0.85);
    });
  });

  describe('startRetraining()', () => {
    test('should create retraining session', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15 }];

      const sessionId = await retrainingManager.startRetraining('agent-1', triggers);

      expect(sessionId).toBeDefined();
      expect(retrainingManager.activeSessions.has('agent-1')).toBe(true);
    });

    test('should identify deficiencies from triggers', async () => {
      const triggers = [
        { type: 'error_rate', value: 0.15 },
        { type: 'quality_drop', value: 0.20 }
      ];

      await retrainingManager.startRetraining('agent-1', triggers);

      const session = retrainingManager.activeSessions.get('agent-1');
      expect(session.deficiencies).toContain('error_handling');
      expect(session.deficiencies).toContain('quality_assurance');
    });

    test('should emit retraining_started event', async () => {
      const listener = jest.fn();
      retrainingManager.on('retraining_started', listener);

      const triggers = [{ type: 'error_rate', value: 0.15 }];
      await retrainingManager.startRetraining('agent-1', triggers);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getProgress()', () => {
    test('should return null for non-existent session', () => {
      const progress = retrainingManager.getProgress('non-existent');

      expect(progress).toBeNull();
    });

    test('should return progress for active session', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15 }];
      await retrainingManager.startRetraining('agent-1', triggers);

      const progress = retrainingManager.getProgress('agent-1');

      expect(progress).toBeDefined();
      expect(progress.currentStage).toBe('Diagnosis');
      expect(progress.totalStages).toBe(4);
    });
  });

  describe('getStatistics()', () => {
    test('should return statistics', () => {
      const stats = retrainingManager.getStatistics();

      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('graduationRate');
    });

    test('should track active sessions count', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15 }];

      await retrainingManager.startRetraining('agent-1', triggers);
      await retrainingManager.startRetraining('agent-2', triggers);

      const stats = retrainingManager.getStatistics();
      expect(stats.active).toBe(2);
    });
  });

  describe('getActiveCount()', () => {
    test('should return 0 initially', () => {
      expect(retrainingManager.getActiveCount()).toBe(0);
    });

    test('should increment with new sessions', async () => {
      const triggers = [{ type: 'error_rate', value: 0.15 }];

      await retrainingManager.startRetraining('agent-1', triggers);

      expect(retrainingManager.getActiveCount()).toBe(1);
    });
  });
});
