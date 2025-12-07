/**
 * Unit Tests for Achievement System
 * Comprehensive tests for badge tracking and achievement unlocking
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

describe('AchievementSystem', () => {
  let AchievementSystem, ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES;
  let achievementSystem;

  beforeAll(async () => {
    const module = await import('../../../src/systems/gamification/achievement-system.js');
    AchievementSystem = module.AchievementSystem;
    ACHIEVEMENTS = module.ACHIEVEMENTS;
    ACHIEVEMENT_CATEGORIES = module.ACHIEVEMENT_CATEGORIES;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    achievementSystem = new AchievementSystem(mockClient);
    await achievementSystem.initialize();
  });

  afterEach(() => {
    achievementSystem.removeAllListeners();
  });

  describe('Initialization', () => {
    test('should initialize successfully with RabbitMQ client', async () => {
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'gamification.achievements',
        'topic',
        { durable: true }
      );
    });

    test('should throw error if client not connected', async () => {
      const badSystem = new AchievementSystem({ channel: null });
      await expect(badSystem.initialize()).rejects.toThrow('RabbitMQ client not connected');
    });

    test('should use custom exchange if provided', async () => {
      const customSystem = new AchievementSystem(mockClient, { exchange: 'custom.achievements' });
      await customSystem.initialize();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'custom.achievements',
        'topic',
        { durable: true }
      );
    });
  });

  describe('Achievement Definitions', () => {
    test('should have at least 50 achievements', () => {
      const count = Object.keys(ACHIEVEMENTS).length;
      expect(count).toBeGreaterThanOrEqual(50);
    });

    test('should cover all 8+ categories', () => {
      const categories = new Set();
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        categories.add(achievement.category);
      });

      expect(categories.has('speed')).toBe(true);
      expect(categories.has('quality')).toBe(true);
      expect(categories.has('collaboration')).toBe(true);
      expect(categories.has('innovation')).toBe(true);
      expect(categories.has('battle')).toBe(true);
      expect(categories.has('consistency')).toBe(true);
      expect(categories.has('milestone')).toBe(true);
      expect(categories.has('reputation')).toBe(true);
      expect(categories.size).toBeGreaterThanOrEqual(8);
    });

    test('should have bronze, silver, and gold tiers', () => {
      const tiers = new Set();
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        tiers.add(achievement.tier);
      });

      expect(tiers.has('bronze')).toBe(true);
      expect(tiers.has('silver')).toBe(true);
      expect(tiers.has('gold')).toBe(true);
    });

    test('should have unique IDs', () => {
      const ids = Object.values(ACHIEVEMENTS).map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('should have points assigned to each achievement', () => {
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        expect(achievement.points).toBeGreaterThan(0);
        expect(typeof achievement.points).toBe('number');
      });
    });

    test('should have criteria for each achievement', () => {
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        expect(achievement.criteria).toBeDefined();
        expect(typeof achievement.criteria).toBe('object');
        expect(Object.keys(achievement.criteria).length).toBeGreaterThan(0);
      });
    });

    test('should have icons for each achievement', () => {
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        expect(achievement.icon).toBeDefined();
        expect(achievement.icon.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Achievement Categories', () => {
    test('should define all expected categories', () => {
      expect(ACHIEVEMENT_CATEGORIES).toContain('speed');
      expect(ACHIEVEMENT_CATEGORIES).toContain('quality');
      expect(ACHIEVEMENT_CATEGORIES).toContain('collaboration');
      expect(ACHIEVEMENT_CATEGORIES).toContain('innovation');
      expect(ACHIEVEMENT_CATEGORIES).toContain('battle');
      expect(ACHIEVEMENT_CATEGORIES).toContain('consistency');
      expect(ACHIEVEMENT_CATEGORIES).toContain('milestone');
      expect(ACHIEVEMENT_CATEGORIES).toContain('reputation');
      expect(ACHIEVEMENT_CATEGORIES).toContain('special');
    });
  });

  describe('Check Achievements', () => {
    test('should unlock FIRST_BLOOD achievement on first task', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: [],
        stats: { tasksCompleted: 1 }
      };

      const unlocked = await achievementSystem.checkAchievements(agent);

      expect(unlocked.length).toBeGreaterThan(0);
      expect(unlocked.some(u => u.achievementId === 'first-blood')).toBe(true);
    });

    test('should not unlock already achieved achievements', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: [{ id: 'first-blood', unlockedAt: Date.now() }],
        stats: { tasksCompleted: 1 }
      };

      const unlocked = await achievementSystem.checkAchievements(agent);

      expect(unlocked.every(u => u.achievementId !== 'first-blood')).toBe(true);
    });

    test('should unlock multiple achievements at once', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: [],
        stats: {
          tasksCompleted: 100,
          successRate: 80,
          consecutiveDays: 7
        },
        points: { total: 5000 },
        reputation: { score: 500 }
      };

      const unlocked = await achievementSystem.checkAchievements(agent);

      expect(unlocked.length).toBeGreaterThan(1);
    });

    test('should publish unlock events to RabbitMQ', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: [],
        stats: { tasksCompleted: 10 }
      };

      await achievementSystem.checkAchievements(agent);

      expect(mockChannel.publish).toHaveBeenCalled();
    });
  });

  describe('Has Achievement', () => {
    test('should return true if agent has achievement', () => {
      const agent = {
        achievements: [
          { id: 'speed-demon', unlockedAt: Date.now() }
        ]
      };

      expect(achievementSystem.hasAchievement(agent, 'speed-demon')).toBe(true);
    });

    test('should return false if agent does not have achievement', () => {
      const agent = {
        achievements: []
      };

      expect(achievementSystem.hasAchievement(agent, 'speed-demon')).toBe(false);
    });

    test('should handle missing achievements array', () => {
      const agent = {};

      expect(achievementSystem.hasAchievement(agent, 'speed-demon')).toBe(false);
    });
  });

  describe('Check Criteria', () => {
    test('should check tasks completed criterion', () => {
      const agent = {
        stats: { tasksCompleted: 100 }
      };

      const meetsReq = achievementSystem.checkCriterion(agent, 'tasksCompleted', 50);
      expect(meetsReq).toBe(true);

      const doesNotMeetReq = achievementSystem.checkCriterion(agent, 'tasksCompleted', 200);
      expect(doesNotMeetReq).toBe(false);
    });

    test('should check battles won criterion', () => {
      const agent = {
        stats: { battlesWon: 50 }
      };

      expect(achievementSystem.checkCriterion(agent, 'battlesWon', 30)).toBe(true);
      expect(achievementSystem.checkCriterion(agent, 'battlesWon', 100)).toBe(false);
    });

    test('should check consecutive days criterion', () => {
      const agent = {
        stats: { consecutiveDays: 30 }
      };

      expect(achievementSystem.checkCriterion(agent, 'consecutiveDays', 7)).toBe(true);
      expect(achievementSystem.checkCriterion(agent, 'consecutiveDays', 365)).toBe(false);
    });

    test('should check reputation score criterion', () => {
      const agent = {
        reputation: { score: 750 }
      };

      expect(achievementSystem.checkCriterion(agent, 'reputationScore', 500)).toBe(true);
      expect(achievementSystem.checkCriterion(agent, 'reputationScore', 900)).toBe(false);
    });

    test('should check collaboration criterion', () => {
      const agent = {
        stats: { collaborationsCompleted: 50 }
      };

      expect(achievementSystem.checkCriterion(agent, 'collaborations', 25)).toBe(true);
      expect(achievementSystem.checkCriterion(agent, 'collaborations', 100)).toBe(false);
    });

    test('should check win rate criterion', () => {
      const agent = {
        stats: { battlesWon: 80, battlesLost: 20 }
      };

      expect(achievementSystem.checkCriterion(agent, 'minWinRate', 0.7)).toBe(true);
      expect(achievementSystem.checkCriterion(agent, 'minWinRate', 0.9)).toBe(false);
    });

    test('should check global rank criterion', () => {
      const agent = {
        rankings: { global: 5 }
      };

      expect(achievementSystem.checkCriterion(agent, 'globalRank', 10)).toBe(true);
      expect(achievementSystem.checkCriterion(agent, 'globalRank', 3)).toBe(false);
    });

    test('should check total points criterion', () => {
      const agent = {
        points: { total: 100000 }
      };

      expect(achievementSystem.checkCriterion(agent, 'totalPoints', 50000)).toBe(true);
      expect(achievementSystem.checkCriterion(agent, 'totalPoints', 200000)).toBe(false);
    });

    test('should return false for unknown criterion', () => {
      const agent = {};
      expect(achievementSystem.checkCriterion(agent, 'unknownCriterion', 10)).toBe(false);
    });
  });

  describe('Unlock Achievement', () => {
    test('should create unlock event with all required fields', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent'
      };
      const achievement = ACHIEVEMENTS.SPEED_DEMON;

      const event = await achievementSystem.unlockAchievement(agent, achievement);

      expect(event.eventId).toBeDefined();
      expect(event.agentId).toBe('agent-123');
      expect(event.agentName).toBe('Test Agent');
      expect(event.achievementId).toBe('speed-demon');
      expect(event.achievementName).toBe('Speed Demon');
      expect(event.achievementTier).toBe('bronze');
      expect(event.achievementCategory).toBe('speed');
      expect(event.points).toBe(100);
      expect(event.timestamp).toBeDefined();
    });

    test('should publish unlock event to correct routing key', async () => {
      const agent = { id: 'agent-123', name: 'Test Agent' };
      const achievement = ACHIEVEMENTS.QUALITY_MASTER;

      await achievementSystem.unlockAchievement(agent, achievement);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'gamification.achievements',
        'achievement.unlocked.quality',
        expect.any(Buffer),
        { persistent: true }
      );
    });

    test('should emit achievement_unlocked event', async () => {
      const listener = jest.fn();
      achievementSystem.on('achievement_unlocked', listener);

      const agent = { id: 'agent-123', name: 'Test Agent' };
      const achievement = ACHIEVEMENTS.TEAM_PLAYER;

      await achievementSystem.unlockAchievement(agent, achievement);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-123',
          achievementId: 'team-player'
        })
      );
    });
  });

  describe('Get Achievement Progress', () => {
    test('should show 100% for unlocked achievement', () => {
      const agent = {
        achievements: [
          { id: 'centurion', unlockedAt: Date.now() }
        ],
        stats: { tasksCompleted: 100 }
      };

      const progress = achievementSystem.getAchievementProgress(agent, 'centurion');

      expect(progress.unlocked).toBe(true);
      expect(progress.progress).toBe(100);
    });

    test('should show partial progress for locked achievement', () => {
      const agent = {
        achievements: [],
        stats: { tasksCompleted: 50 }
      };

      const progress = achievementSystem.getAchievementProgress(agent, 'centurion');

      expect(progress.unlocked).toBe(false);
      expect(progress.progress).toBe(50);
      expect(progress.details.tasksCompleted).toBeDefined();
      expect(progress.details.tasksCompleted.current).toBe(50);
      expect(progress.details.tasksCompleted.required).toBe(100);
    });

    test('should return null for invalid achievement ID', () => {
      const agent = { achievements: [], stats: {} };

      const progress = achievementSystem.getAchievementProgress(agent, 'invalid-id');

      expect(progress).toBeNull();
    });

    test('should calculate progress for multiple criteria', () => {
      const agent = {
        achievements: [],
        stats: {
          battlesWon: 25,
          battlesLost: 15
        }
      };

      const progress = achievementSystem.getAchievementProgress(agent, 'champion');

      expect(progress.details.battlesWon).toBeDefined();
      expect(progress.details.minWinRate).toBeDefined();
    });
  });

  describe('Get Current Value', () => {
    test('should get current value for various criteria', () => {
      const agent = {
        stats: {
          tasksCompleted: 100,
          battlesWon: 50,
          consecutiveDays: 30,
          collaborationsCompleted: 25
        },
        points: { total: 10000 },
        reputation: { score: 750 },
        rankings: { global: 15 }
      };

      expect(achievementSystem.getCurrentValue(agent, 'tasksCompleted')).toBe(100);
      expect(achievementSystem.getCurrentValue(agent, 'battlesWon')).toBe(50);
      expect(achievementSystem.getCurrentValue(agent, 'consecutiveDays')).toBe(30);
      expect(achievementSystem.getCurrentValue(agent, 'collaborations')).toBe(25);
      expect(achievementSystem.getCurrentValue(agent, 'totalPoints')).toBe(10000);
      expect(achievementSystem.getCurrentValue(agent, 'reputationScore')).toBe(750);
      expect(achievementSystem.getCurrentValue(agent, 'globalRank')).toBe(15);
    });

    test('should return 0 for missing values', () => {
      const agent = {};

      expect(achievementSystem.getCurrentValue(agent, 'tasksCompleted')).toBe(0);
      expect(achievementSystem.getCurrentValue(agent, 'battlesWon')).toBe(0);
    });
  });

  describe('Get Achievements By Category', () => {
    test('should return all speed achievements', () => {
      const speedAchievements = achievementSystem.getAchievementsByCategory('speed');

      expect(speedAchievements.length).toBeGreaterThan(0);
      expect(speedAchievements.every(a => a.category === 'speed')).toBe(true);
    });

    test('should return all quality achievements', () => {
      const qualityAchievements = achievementSystem.getAchievementsByCategory('quality');

      expect(qualityAchievements.length).toBeGreaterThan(0);
      expect(qualityAchievements.every(a => a.category === 'quality')).toBe(true);
    });

    test('should return all collaboration achievements', () => {
      const collabAchievements = achievementSystem.getAchievementsByCategory('collaboration');

      expect(collabAchievements.length).toBeGreaterThan(0);
      expect(collabAchievements.every(a => a.category === 'collaboration')).toBe(true);
    });

    test('should return all milestone achievements', () => {
      const milestoneAchievements = achievementSystem.getAchievementsByCategory('milestone');

      expect(milestoneAchievements.length).toBeGreaterThan(0);
      expect(milestoneAchievements.every(a => a.category === 'milestone')).toBe(true);
    });

    test('should return empty array for invalid category', () => {
      const achievements = achievementSystem.getAchievementsByCategory('invalid');

      expect(achievements).toEqual([]);
    });
  });

  describe('Get Agent Achievement Stats', () => {
    test('should calculate achievement statistics', () => {
      const agent = {
        achievements: [
          { id: 'speed-demon', unlockedAt: Date.now() - 1000, tier: 'bronze' },
          { id: 'quality-master', unlockedAt: Date.now(), tier: 'bronze' },
          { id: 'team-player', unlockedAt: Date.now() - 500, tier: 'bronze' }
        ]
      };

      const stats = achievementSystem.getAgentAchievementStats(agent);

      expect(stats.total).toBe(3);
      expect(stats.totalPossible).toBeGreaterThan(50);
      expect(stats.percentage).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.byTier).toBeDefined();
      expect(stats.byTier.bronze).toBe(3);
      expect(stats.recentlyUnlocked).toHaveLength(3);
    });

    test('should sort recently unlocked by date', () => {
      const now = Date.now();
      const agent = {
        achievements: [
          { id: 'first', unlockedAt: now - 3000 },
          { id: 'second', unlockedAt: now - 1000 },
          { id: 'third', unlockedAt: now - 2000 }
        ]
      };

      const stats = achievementSystem.getAgentAchievementStats(agent);

      expect(stats.recentlyUnlocked[0].id).toBe('second');
      expect(stats.recentlyUnlocked[1].id).toBe('third');
      expect(stats.recentlyUnlocked[2].id).toBe('first');
    });

    test('should limit recently unlocked to 5', () => {
      const agent = {
        achievements: Array(10).fill(null).map((_, i) => ({
          id: `achievement-${i}`,
          unlockedAt: Date.now() - i * 1000
        }))
      };

      const stats = achievementSystem.getAgentAchievementStats(agent);

      expect(stats.recentlyUnlocked).toHaveLength(5);
    });

    test('should count achievements by category', () => {
      const agent = {
        achievements: [
          { id: 'speed-demon' },
          { id: 'lightning-fast' },
          { id: 'quality-master' },
          { id: 'team-player' }
        ]
      };

      const stats = achievementSystem.getAgentAchievementStats(agent);

      expect(stats.byCategory.speed).toBe(2);
      expect(stats.byCategory.quality).toBe(1);
      expect(stats.byCategory.collaboration).toBe(1);
    });
  });

  describe('Get Rarest Achievements', () => {
    test('should identify rarest achievements', () => {
      const agents = [
        {
          achievements: [
            { id: 'first-blood' },
            { id: 'speed-demon' }
          ]
        },
        {
          achievements: [
            { id: 'first-blood' }
          ]
        },
        {
          achievements: [
            { id: 'first-blood' },
            { id: 'speed-demon' }
          ]
        }
      ];

      const rarest = achievementSystem.getRarestAchievements(agents);

      expect(rarest).toBeDefined();
      expect(Array.isArray(rarest)).toBe(true);
      expect(rarest.length).toBeGreaterThan(0);
    });

    test('should sort achievements by unlock count', () => {
      const agents = [
        { achievements: [{ id: 'first-blood' }] },
        { achievements: [{ id: 'first-blood' }] },
        { achievements: [{ id: 'speed-demon' }] }
      ];

      const rarest = achievementSystem.getRarestAchievements(agents);

      // Achievement with 1 unlock should be rarer than one with 2 unlocks
      const speedDemon = rarest.find(r => r.achievement?.id === 'speed-demon');
      const firstBlood = rarest.find(r => r.achievement?.id === 'first-blood');

      if (speedDemon && firstBlood) {
        expect(speedDemon.unlockedBy).toBeLessThan(firstBlood.unlockedBy);
      }
    });

    test('should calculate percentage correctly', () => {
      const agents = [
        { achievements: [{ id: 'first-blood' }] },
        { achievements: [{ id: 'first-blood' }] },
        { achievements: [] },
        { achievements: [] }
      ];

      const rarest = achievementSystem.getRarestAchievements(agents);
      const firstBlood = rarest.find(r => r.achievement?.id === 'first-blood');

      expect(firstBlood?.percentage).toBe(50); // 2 out of 4 agents
    });
  });

  describe('Specific Achievement Tests', () => {
    test('should unlock CENTURION at 100 tasks', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: [],
        stats: { tasksCompleted: 100 }
      };

      const unlocked = await achievementSystem.checkAchievements(agent);

      expect(unlocked.some(u => u.achievementId === 'centurion')).toBe(true);
    });

    test('should unlock RELIABLE at 7 consecutive days', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: [],
        stats: { consecutiveDays: 7 }
      };

      const unlocked = await achievementSystem.checkAchievements(agent);

      expect(unlocked.some(u => u.achievementId === 'reliable')).toBe(true);
    });

    test('should unlock TRUSTED at 500 reputation', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: [],
        reputation: { score: 500 }
      };

      const unlocked = await achievementSystem.checkAchievements(agent);

      expect(unlocked.some(u => u.achievementId === 'trusted')).toBe(true);
    });

    test('should have progressive tiers for similar achievements', () => {
      const speedAchievements = achievementSystem.getAchievementsByCategory('speed');
      const tiers = speedAchievements.map(a => a.tier);

      expect(tiers).toContain('bronze');
      expect(tiers).toContain('silver');
      expect(tiers).toContain('gold');
    });
  });

  describe('Edge Cases', () => {
    test('should handle agent with no achievements array', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        stats: { tasksCompleted: 10 }
      };

      const unlocked = await achievementSystem.checkAchievements(agent);

      expect(Array.isArray(unlocked)).toBe(true);
    });

    test('should handle agent with no stats', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: []
      };

      const unlocked = await achievementSystem.checkAchievements(agent);

      expect(Array.isArray(unlocked)).toBe(true);
    });

    test('should handle empty context parameter', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        achievements: [],
        stats: { tasksCompleted: 1 }
      };

      const unlocked = await achievementSystem.checkAchievements(agent, {});

      expect(Array.isArray(unlocked)).toBe(true);
    });
  });
});
