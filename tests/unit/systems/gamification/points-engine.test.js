/**
 * Unit Tests for Points Engine
 * Comprehensive tests for multi-dimensional points calculation and awarding
 */

import { jest } from '@jest/globals';

// Mock RabbitMQ client
const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  publish: jest.fn().mockResolvedValue(true)
};

const mockClient = {
  channel: mockChannel,
  isHealthy: jest.fn().mockReturnValue(true)
};

describe('PointsEngine', () => {
  let PointsEngine, POINT_CATEGORIES, GLOBAL_MULTIPLIERS;
  let pointsEngine;

  beforeAll(async () => {
    const module = await import('../../../src/systems/gamification/points.js');
    PointsEngine = module.PointsEngine;
    POINT_CATEGORIES = module.POINT_CATEGORIES;
    GLOBAL_MULTIPLIERS = module.GLOBAL_MULTIPLIERS;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    pointsEngine = new PointsEngine(mockClient);
    await pointsEngine.initialize();
  });

  afterEach(() => {
    pointsEngine.removeAllListeners();
  });

  describe('Initialization', () => {
    test('should initialize successfully with RabbitMQ client', async () => {
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'gamification.points',
        'topic',
        { durable: true }
      );
    });

    test('should throw error if client not connected', async () => {
      const badEngine = new PointsEngine({ channel: null });
      await expect(badEngine.initialize()).rejects.toThrow('RabbitMQ client not connected');
    });

    test('should use custom exchange if provided', async () => {
      const customEngine = new PointsEngine(mockClient, { exchange: 'custom.points' });
      await customEngine.initialize();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'custom.points',
        'topic',
        { durable: true }
      );
    });
  });

  describe('Speed Points Calculation', () => {
    test('should calculate speed points for fast task completion', () => {
      const task = { priority: 'normal', complexity: 'moderate' };
      const completionTime = 150000; // 2.5 minutes (half expected time)

      const points = pointsEngine.calculateSpeedPoints(task, completionTime);

      expect(points).toBeGreaterThan(25); // Should be more than base
      expect(points).toBeLessThan(200);
    });

    test('should award bonus for exceptional speed (3x faster)', () => {
      const task = { priority: 'critical', complexity: 'moderate' };
      const expectedTime = 300000; // 5 minutes
      const completionTime = expectedTime * 0.25; // 4x faster

      const points = pointsEngine.calculateSpeedPoints(task, completionTime);

      expect(points).toBeGreaterThan(150); // Should include speed bonus
    });

    test('should give minimum points for slow completion', () => {
      const task = { priority: 'low', complexity: 'simple' };
      const completionTime = 600000; // Very slow

      const points = pointsEngine.calculateSpeedPoints(task, completionTime);

      expect(points).toBe(5); // Minimum points
    });

    test('should scale points based on task priority', () => {
      const completionTime = 150000;

      const criticalPoints = pointsEngine.calculateSpeedPoints(
        { priority: 'critical', complexity: 'moderate' },
        completionTime
      );
      const normalPoints = pointsEngine.calculateSpeedPoints(
        { priority: 'normal', complexity: 'moderate' },
        completionTime
      );

      expect(criticalPoints).toBeGreaterThan(normalPoints);
    });

    test('should estimate task duration based on complexity', () => {
      expect(pointsEngine.estimateTaskDuration({ complexity: 'simple' })).toBe(60000);
      expect(pointsEngine.estimateTaskDuration({ complexity: 'moderate' })).toBe(300000);
      expect(pointsEngine.estimateTaskDuration({ complexity: 'complex' })).toBe(900000);
      expect(pointsEngine.estimateTaskDuration({ complexity: 'veryComplex' })).toBe(1800000);
      expect(pointsEngine.estimateTaskDuration({})).toBe(300000); // Default
    });
  });

  describe('Quality Points Calculation', () => {
    test('should calculate quality points based on multiple factors', () => {
      const result = {
        accuracy: 0.9,
        completeness: 0.85,
        codeStyle: 0.8,
        documentation: 0.9,
        testCoverage: 0.7
      };

      const points = pointsEngine.calculateQualityPoints(result);

      expect(points).toBeGreaterThan(50);
      expect(points).toBeLessThan(200);
    });

    test('should award perfection bonus for near-perfect quality', () => {
      const result = {
        accuracy: 1.0,
        completeness: 1.0,
        codeStyle: 1.0,
        documentation: 1.0,
        testCoverage: 0.9
      };

      const points = pointsEngine.calculateQualityPoints(result);

      expect(points).toBeGreaterThan(100); // Should include perfection bonus
    });

    test('should apply quality tier multipliers correctly', () => {
      const excellentResult = { accuracy: 0.95, completeness: 0.95, codeStyle: 0.95, documentation: 0.95, testCoverage: 0.95 };
      const goodResult = { accuracy: 0.75, completeness: 0.75, codeStyle: 0.75, documentation: 0.75, testCoverage: 0.75 };
      const poorResult = { accuracy: 0.5, completeness: 0.5, codeStyle: 0.5, documentation: 0.5, testCoverage: 0.5 };

      const excellentPoints = pointsEngine.calculateQualityPoints(excellentResult);
      const goodPoints = pointsEngine.calculateQualityPoints(goodResult);
      const poorPoints = pointsEngine.calculateQualityPoints(poorResult);

      expect(excellentPoints).toBeGreaterThan(goodPoints);
      expect(goodPoints).toBeGreaterThan(poorPoints);
    });

    test('should handle missing quality metrics with defaults', () => {
      const result = {}; // No metrics

      const points = pointsEngine.calculateQualityPoints(result);

      expect(points).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Collaboration Points Calculation', () => {
    test('should calculate collaboration points for brainstorming', () => {
      const collaboration = {
        type: 'brainstorm',
        messagesCount: 15,
        helpfulness: 4,
        responsiveness: 5,
        teamSize: 5
      };

      const points = pointsEngine.calculateCollaborationPoints(collaboration);

      expect(points).toBeGreaterThan(30);
    });

    test('should award consensus bonus', () => {
      const withConsensus = {
        type: 'brainstorm',
        messagesCount: 10,
        helpfulness: 3,
        responsiveness: 3,
        teamSize: 4,
        ledToConsensus: true
      };

      const withoutConsensus = {
        ...withConsensus,
        ledToConsensus: false
      };

      const pointsWithBonus = pointsEngine.calculateCollaborationPoints(withConsensus);
      const pointsWithoutBonus = pointsEngine.calculateCollaborationPoints(withoutConsensus);

      expect(pointsWithBonus).toBe(pointsWithoutBonus + 50);
    });

    test('should scale with team size', () => {
      const smallTeam = {
        type: 'taskAssist',
        messagesCount: 10,
        helpfulness: 3,
        responsiveness: 3,
        teamSize: 2
      };

      const largeTeam = {
        ...smallTeam,
        teamSize: 10
      };

      const smallTeamPoints = pointsEngine.calculateCollaborationPoints(smallTeam);
      const largeTeamPoints = pointsEngine.calculateCollaborationPoints(largeTeam);

      expect(largeTeamPoints).toBeGreaterThan(smallTeamPoints);
    });

    test('should apply type multipliers correctly', () => {
      const baseCollab = {
        messagesCount: 10,
        helpfulness: 3,
        responsiveness: 3,
        teamSize: 3
      };

      const mentoringPoints = pointsEngine.calculateCollaborationPoints({ ...baseCollab, type: 'mentoring' });
      const brainstormPoints = pointsEngine.calculateCollaborationPoints({ ...baseCollab, type: 'brainstorm' });
      const assistPoints = pointsEngine.calculateCollaborationPoints({ ...baseCollab, type: 'taskAssist' });

      expect(mentoringPoints).toBeGreaterThan(brainstormPoints);
      expect(brainstormPoints).toBeGreaterThan(assistPoints);
    });
  });

  describe('Innovation Points Calculation', () => {
    test('should calculate innovation points for novel solution', () => {
      const solution = {
        approach: 'novel',
        performanceGain: 2.0
      };
      const historicalSolutions = [];

      const points = pointsEngine.calculateInnovationPoints(solution, historicalSolutions);

      expect(points).toBeGreaterThan(75);
    });

    test('should award pioneer bonus for highly novel solutions', () => {
      const solution = {
        approach: 'breakthrough',
        performanceGain: 3.0
      };
      const historicalSolutions = [];

      const points = pointsEngine.calculateInnovationPoints(solution, historicalSolutions);

      expect(points).toBeGreaterThan(200); // Should include pioneer bonus
    });

    test('should calculate novelty score based on similarity', () => {
      const solution = { approach: 'novel', libraries: 'react', patterns: 'mvc', architecture: 'microservices' };
      const historicalSolutions = [
        { approach: 'standard', libraries: 'angular', patterns: 'mvvm', architecture: 'monolith' }
      ];

      const noveltyScore = pointsEngine.calculateNoveltyScore(solution, historicalSolutions);

      expect(noveltyScore).toBeGreaterThan(0);
      expect(noveltyScore).toBeLessThanOrEqual(1);
    });

    test('should return max novelty for first solution', () => {
      const solution = { approach: 'novel' };
      const historicalSolutions = [];

      const noveltyScore = pointsEngine.calculateNoveltyScore(solution, historicalSolutions);

      expect(noveltyScore).toBe(1.0);
    });

    test('should calculate similarity between solutions', () => {
      const solution1 = { approach: 'novel', libraries: 'react', patterns: 'mvc', architecture: 'microservices' };
      const solution2 = { approach: 'novel', libraries: 'react', patterns: 'mvc', architecture: 'microservices' };

      const similarity = pointsEngine.calculateSimilarity(solution1, solution2);

      expect(similarity).toBe(1.0); // Identical
    });
  });

  describe('Reliability Points Calculation', () => {
    test('should calculate reliability points for consistent agent', () => {
      const agent = {
        stats: {
          successRate: 95,
          uptime: 98,
          consecutiveDays: 30,
          tasksCompleted: 100
        },
        reputation: {
          consistency: 90
        }
      };

      const points = pointsEngine.calculateReliabilityPoints(agent);

      expect(points).toBeGreaterThan(20);
    });

    test('should award streak bonus for consecutive days', () => {
      const shortStreak = {
        stats: { successRate: 90, uptime: 95, consecutiveDays: 5, tasksCompleted: 50 },
        reputation: { consistency: 80 }
      };

      const longStreak = {
        stats: { successRate: 90, uptime: 95, consecutiveDays: 50, tasksCompleted: 200 },
        reputation: { consistency: 80 }
      };

      const shortStreakPoints = pointsEngine.calculateReliabilityPoints(shortStreak);
      const longStreakPoints = pointsEngine.calculateReliabilityPoints(longStreak);

      expect(longStreakPoints).toBeGreaterThan(shortStreakPoints);
    });

    test('should award zero-error bonus', () => {
      const zeroErrors = {
        stats: { successRate: 100, uptime: 100, consecutiveDays: 10, tasksCompleted: 50 },
        reputation: { consistency: 100 }
      };

      const points = pointsEngine.calculateReliabilityPoints(zeroErrors);

      expect(points).toBeGreaterThan(50);
    });

    test('should handle missing stats gracefully', () => {
      const agent = {};

      const points = pointsEngine.calculateReliabilityPoints(agent);

      expect(points).toBe(0);
    });
  });

  describe('Global Multipliers', () => {
    test('should apply weekend bonus', () => {
      const basePoints = 100;
      const saturdayTimestamp = new Date('2025-11-22T12:00:00').getTime(); // Saturday
      const context = {
        timestamp: saturdayTimestamp,
        priority: 'normal',
        agent: { tier: 'bronze', stats: {} }
      };

      const finalPoints = pointsEngine.applyMultipliers(basePoints, context);

      expect(finalPoints).toBeGreaterThan(basePoints);
    });

    test('should apply night owl bonus', () => {
      const basePoints = 100;
      const nightTimestamp = new Date('2025-11-17T23:00:00').getTime(); // 11 PM
      const context = {
        timestamp: nightTimestamp,
        priority: 'normal',
        agent: { tier: 'bronze', stats: {} }
      };

      const finalPoints = pointsEngine.applyMultipliers(basePoints, context);

      expect(finalPoints).toBeGreaterThan(basePoints);
    });

    test('should apply early bird bonus', () => {
      const basePoints = 100;
      const morningTimestamp = new Date('2025-11-17T06:00:00').getTime(); // 6 AM
      const context = {
        timestamp: morningTimestamp,
        priority: 'normal',
        agent: { tier: 'bronze', stats: {} }
      };

      const finalPoints = pointsEngine.applyMultipliers(basePoints, context);

      expect(finalPoints).toBeGreaterThan(basePoints);
    });

    test('should apply priority multipliers', () => {
      const basePoints = 100;
      const mondayNoon = new Date('2025-11-17T12:00:00').getTime(); // Monday at noon, no time bonuses
      const criticalContext = {
        priority: 'critical',
        timestamp: mondayNoon,
        agent: { tier: 'bronze', stats: {} }
      };
      const normalContext = {
        priority: 'normal',
        timestamp: mondayNoon,
        agent: { tier: 'bronze', stats: {} }
      };

      const criticalPoints = pointsEngine.applyMultipliers(basePoints, criticalContext);
      const normalPoints = pointsEngine.applyMultipliers(basePoints, normalContext);

      expect(criticalPoints).toBe(200); // 2x multiplier
      expect(normalPoints).toBe(100); // 1x multiplier
    });

    test('should apply streak multipliers', () => {
      const basePoints = 100;
      const streak100Context = {
        priority: 'normal',
        agent: { tier: 'bronze', stats: { consecutiveDays: 100 } }
      };
      const streak30Context = {
        priority: 'normal',
        agent: { tier: 'bronze', stats: { consecutiveDays: 30 } }
      };
      const streak7Context = {
        priority: 'normal',
        agent: { tier: 'bronze', stats: { consecutiveDays: 7 } }
      };

      const points100 = pointsEngine.applyMultipliers(basePoints, streak100Context);
      const points30 = pointsEngine.applyMultipliers(basePoints, streak30Context);
      const points7 = pointsEngine.applyMultipliers(basePoints, streak7Context);

      expect(points100).toBeGreaterThan(points30);
      expect(points30).toBeGreaterThan(points7);
      expect(points7).toBeGreaterThan(basePoints);
    });

    test('should apply tier multipliers', () => {
      const basePoints = 100;
      const diamondContext = {
        priority: 'normal',
        agent: { tier: 'diamond', stats: {} }
      };
      const goldContext = {
        priority: 'normal',
        agent: { tier: 'gold', stats: {} }
      };
      const bronzeContext = {
        priority: 'normal',
        agent: { tier: 'bronze', stats: {} }
      };

      const diamondPoints = pointsEngine.applyMultipliers(basePoints, diamondContext);
      const goldPoints = pointsEngine.applyMultipliers(basePoints, goldContext);
      const bronzePoints = pointsEngine.applyMultipliers(basePoints, bronzeContext);

      expect(diamondPoints).toBe(200); // 2x
      expect(goldPoints).toBe(125); // 1.25x
      expect(bronzePoints).toBe(100); // 1x
    });

    test('should apply combo multipliers', () => {
      const basePoints = 100;
      const combo10Context = {
        priority: 'normal',
        agent: { tier: 'bronze', stats: {}, currentCombo: 10 }
      };

      const points = pointsEngine.applyMultipliers(basePoints, combo10Context);

      expect(points).toBe(300); // 3x combo
    });

    test('should stack multiple multipliers', () => {
      const basePoints = 100;
      const saturdayNightDiamond = new Date('2025-11-22T23:00:00').getTime();
      const context = {
        timestamp: saturdayNightDiamond,
        priority: 'critical',
        agent: {
          tier: 'diamond',
          stats: { consecutiveDays: 100 },
          currentCombo: 10
        }
      };

      const finalPoints = pointsEngine.applyMultipliers(basePoints, context);

      expect(finalPoints).toBeGreaterThan(1000); // Multiple multipliers stacked
    });
  });

  describe('Award Points', () => {
    test('should award points and publish to RabbitMQ', async () => {
      const event = await pointsEngine.awardPoints('agent-123', 'speed', 150, { task: 'test' });

      expect(event).toMatchObject({
        agentId: 'agent-123',
        category: 'speed',
        points: 150
      });
      expect(event.eventId).toBeDefined();
      expect(event.timestamp).toBeDefined();

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'gamification.points',
        'points.earned.speed',
        expect.any(Buffer),
        { persistent: true }
      );
    });

    test('should emit points_awarded event', async () => {
      const listener = jest.fn();
      pointsEngine.on('points_awarded', listener);

      await pointsEngine.awardPoints('agent-123', 'quality', 200);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-123',
          category: 'quality',
          points: 200
        })
      );
    });
  });

  describe('Process Task Completion', () => {
    test('should process task completion and award points', async () => {
      const task = { priority: 'normal', complexity: 'moderate' };
      const result = {
        agentId: 'agent-123',
        accuracy: 0.9,
        completeness: 0.85,
        errorFree: true
      };
      const completionTime = 200000;
      const agent = { tier: 'silver', stats: { consecutiveDays: 10 } };

      const breakdown = await pointsEngine.processTaskCompletion(task, result, completionTime, agent);

      expect(breakdown.speedPoints).toBeGreaterThan(0);
      expect(breakdown.qualityPoints).toBeGreaterThan(0);
      expect(breakdown.finalPoints).toBeGreaterThan(0);
      expect(breakdown.multipliers).toBeDefined();

      expect(mockChannel.publish).toHaveBeenCalledTimes(3); // speed, quality, total
    });

    test('should include reliability bonus for error-free tasks', async () => {
      const task = { priority: 'normal', complexity: 'simple' };
      const result = { agentId: 'agent-123', errorFree: true, accuracy: 0.8, completeness: 0.8 };
      const agent = { tier: 'bronze', stats: {} };

      const breakdown = await pointsEngine.processTaskCompletion(task, result, 50000, agent);

      expect(breakdown.reliabilityBonus).toBe(10);
    });
  });

  describe('Helper Methods', () => {
    test('should correctly identify weekends', () => {
      const saturday = new Date('2025-11-22').getTime();
      const sunday = new Date('2025-11-23').getTime();
      const monday = new Date('2025-11-24').getTime();

      expect(pointsEngine.isWeekend(saturday)).toBe(true);
      expect(pointsEngine.isWeekend(sunday)).toBe(true);
      expect(pointsEngine.isWeekend(monday)).toBe(false);
    });

    test('should get active multipliers for transparency', () => {
      const saturdayNight = new Date('2025-11-22T23:00:00').getTime();
      const context = {
        timestamp: saturdayNight,
        priority: 'critical',
        agent: {
          tier: 'gold',
          stats: { consecutiveDays: 30 }
        }
      };

      const multipliers = pointsEngine.getActiveMultipliers(context);

      expect(multipliers.length).toBeGreaterThan(0);
      expect(multipliers.some(m => m.name.includes('Weekend'))).toBe(true);
      expect(multipliers.some(m => m.name.includes('Night'))).toBe(true);
      expect(multipliers.some(m => m.name.includes('30 Day'))).toBe(true);
      expect(multipliers.some(m => m.name.toLowerCase().includes('gold'))).toBe(true);
    });
  });

  describe('Point Categories', () => {
    test('should define all required point categories', () => {
      expect(POINT_CATEGORIES.SPEED).toBeDefined();
      expect(POINT_CATEGORIES.QUALITY).toBeDefined();
      expect(POINT_CATEGORIES.COLLABORATION).toBeDefined();
      expect(POINT_CATEGORIES.INNOVATION).toBeDefined();
      expect(POINT_CATEGORIES.RELIABILITY).toBeDefined();
    });

    test('should have proper weights for each category', () => {
      expect(POINT_CATEGORIES.SPEED.weight).toBe(1.0);
      expect(POINT_CATEGORIES.QUALITY.weight).toBe(1.5);
      expect(POINT_CATEGORIES.COLLABORATION.weight).toBe(1.2);
      expect(POINT_CATEGORIES.INNOVATION.weight).toBe(2.0);
      expect(POINT_CATEGORIES.RELIABILITY.weight).toBe(1.3);
    });
  });

  describe('Global Multiplier Constants', () => {
    test('should define time-based multipliers', () => {
      expect(GLOBAL_MULTIPLIERS.WEEKEND_BONUS).toBe(1.2);
      expect(GLOBAL_MULTIPLIERS.NIGHT_OWL_BONUS).toBe(1.15);
      expect(GLOBAL_MULTIPLIERS.EARLY_BIRD_BONUS).toBe(1.1);
    });

    test('should define tier multipliers', () => {
      expect(GLOBAL_MULTIPLIERS.BRONZE).toBe(1.0);
      expect(GLOBAL_MULTIPLIERS.SILVER).toBe(1.1);
      expect(GLOBAL_MULTIPLIERS.GOLD).toBe(1.25);
      expect(GLOBAL_MULTIPLIERS.PLATINUM).toBe(1.5);
      expect(GLOBAL_MULTIPLIERS.DIAMOND).toBe(2.0);
    });

    test('should define streak multipliers', () => {
      expect(GLOBAL_MULTIPLIERS.STREAK_3_DAYS).toBe(1.1);
      expect(GLOBAL_MULTIPLIERS.STREAK_7_DAYS).toBe(1.25);
      expect(GLOBAL_MULTIPLIERS.STREAK_30_DAYS).toBe(1.5);
      expect(GLOBAL_MULTIPLIERS.STREAK_100_DAYS).toBe(2.0);
    });
  });
});
