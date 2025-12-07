/**
 * Unit Tests for Tier System
 * Comprehensive tests for tier progression and management
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

describe('TierSystem', () => {
  let TierSystem, TIERS, TIER_ORDER;
  let tierSystem;

  beforeAll(async () => {
    const module = await import('../../../src/systems/gamification/tier-system.js');
    TierSystem = module.TierSystem;
    TIERS = module.TIERS;
    TIER_ORDER = module.TIER_ORDER;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    tierSystem = new TierSystem(mockClient);
    await tierSystem.initialize();
  });

  afterEach(() => {
    tierSystem.removeAllListeners();
  });

  describe('Initialization', () => {
    test('should initialize successfully with RabbitMQ client', async () => {
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'gamification.tiers',
        'topic',
        { durable: true }
      );
    });

    test('should throw error if client not connected', async () => {
      const badSystem = new TierSystem({ channel: null });
      await expect(badSystem.initialize()).rejects.toThrow('RabbitMQ client not connected');
    });

    test('should use custom exchange if provided', async () => {
      const customSystem = new TierSystem(mockClient, { exchange: 'custom.tiers' });
      await customSystem.initialize();
      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'custom.tiers',
        'topic',
        { durable: true }
      );
    });
  });

  describe('Tier Definitions', () => {
    test('should define all 5 tiers', () => {
      expect(TIERS.BRONZE).toBeDefined();
      expect(TIERS.SILVER).toBeDefined();
      expect(TIERS.GOLD).toBeDefined();
      expect(TIERS.PLATINUM).toBeDefined();
      expect(TIERS.DIAMOND).toBeDefined();
    });

    test('should have correct tier levels', () => {
      expect(TIERS.BRONZE.level).toBe(1);
      expect(TIERS.SILVER.level).toBe(2);
      expect(TIERS.GOLD.level).toBe(3);
      expect(TIERS.PLATINUM.level).toBe(4);
      expect(TIERS.DIAMOND.level).toBe(5);
    });

    test('should have ascending point requirements', () => {
      expect(TIERS.BRONZE.pointsRequired).toBe(0);
      expect(TIERS.SILVER.pointsRequired).toBe(1000);
      expect(TIERS.GOLD.pointsRequired).toBe(5000);
      expect(TIERS.PLATINUM.pointsRequired).toBe(15000);
      expect(TIERS.DIAMOND.pointsRequired).toBe(50000);
    });

    test('should have ascending multipliers', () => {
      expect(TIERS.BRONZE.multiplier).toBe(1.0);
      expect(TIERS.SILVER.multiplier).toBe(1.1);
      expect(TIERS.GOLD.multiplier).toBe(1.25);
      expect(TIERS.PLATINUM.multiplier).toBe(1.5);
      expect(TIERS.DIAMOND.multiplier).toBe(2.0);
    });

    test('should have unique icons for each tier', () => {
      const icons = [
        TIERS.BRONZE.icon,
        TIERS.SILVER.icon,
        TIERS.GOLD.icon,
        TIERS.PLATINUM.icon,
        TIERS.DIAMOND.icon
      ];
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(5);
    });

    test('should have perks defined for each tier', () => {
      Object.values(TIERS).forEach(tier => {
        expect(Array.isArray(tier.perks)).toBe(true);
        expect(tier.perks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tier Order', () => {
    test('should define tier order array', () => {
      expect(TIER_ORDER).toEqual(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']);
    });
  });

  describe('Calculate Tier', () => {
    test('should return Bronze tier for new agent', () => {
      const agent = {
        points: { total: 0 },
        stats: { tasksCompleted: 0, successRate: 0 }
      };

      const tier = tierSystem.calculateTier(agent);

      expect(tier.id).toBe('bronze');
      expect(tier.level).toBe(1);
    });

    test('should return Silver tier when requirements met', () => {
      const agent = {
        points: { total: 1500 },
        stats: {
          tasksCompleted: 60,
          successRate: 75,
          collaborationsCompleted: 10
        }
      };

      const tier = tierSystem.calculateTier(agent);

      expect(tier.id).toBe('silver');
      expect(tier.level).toBe(2);
    });

    test('should return Gold tier when requirements met', () => {
      const agent = {
        points: { total: 6000, innovation: 30 },
        stats: {
          tasksCompleted: 250,
          successRate: 85,
          collaborationsCompleted: 30
        }
      };

      const tier = tierSystem.calculateTier(agent);

      expect(tier.id).toBe('gold');
      expect(tier.level).toBe(3);
    });

    test('should return Platinum tier when requirements met', () => {
      const agent = {
        points: { total: 18000, innovation: 60 },
        stats: {
          tasksCompleted: 600,
          successRate: 88,
          collaborationsCompleted: 120
        }
      };

      const tier = tierSystem.calculateTier(agent);

      expect(tier.id).toBe('platinum');
      expect(tier.level).toBe(4);
    });

    test('should return Diamond tier when requirements met', () => {
      const agent = {
        points: { total: 60000, innovation: 200 },
        stats: {
          tasksCompleted: 1500,
          successRate: 92,
          collaborationsCompleted: 300,
          battlesWon: 150
        }
      };

      const tier = tierSystem.calculateTier(agent);

      expect(tier.id).toBe('diamond');
      expect(tier.level).toBe(5);
    });

    test('should not promote if success rate too low', () => {
      const agent = {
        points: { total: 10000 },
        stats: {
          tasksCompleted: 300,
          successRate: 60, // Too low for Gold (requires 80%)
          collaborationsCompleted: 30
        }
      };

      const tier = tierSystem.calculateTier(agent);

      expect(tier.level).toBeLessThan(3); // Not Gold
    });

    test('should not promote if tasks completed too low', () => {
      const agent = {
        points: { total: 10000 },
        stats: {
          tasksCompleted: 50, // Too low for Gold (requires 200)
          successRate: 90,
          collaborationsCompleted: 30
        }
      };

      const tier = tierSystem.calculateTier(agent);

      expect(tier.level).toBeLessThan(3); // Not Gold
    });
  });

  describe('Meets Requirements', () => {
    test('should return true when all requirements met', () => {
      const agent = {
        points: { total: 1200 },
        stats: {
          tasksCompleted: 60,
          successRate: 75,
          collaborationsCompleted: 10
        }
      };

      const meetsReq = tierSystem.meetsRequirements(agent, TIERS.SILVER);

      expect(meetsReq).toBe(true);
    });

    test('should return false when points insufficient', () => {
      const agent = {
        points: { total: 800 }, // Below Silver requirement
        stats: {
          tasksCompleted: 60,
          successRate: 75
        }
      };

      const meetsReq = tierSystem.meetsRequirements(agent, TIERS.SILVER);

      expect(meetsReq).toBe(false);
    });

    test('should return false when success rate too low', () => {
      const agent = {
        points: { total: 1200 },
        stats: {
          tasksCompleted: 60,
          successRate: 60 // Below Silver requirement (70%)
        }
      };

      const meetsReq = tierSystem.meetsRequirements(agent, TIERS.SILVER);

      expect(meetsReq).toBe(false);
    });

    test('should return true for Bronze tier (no requirements)', () => {
      const agent = {
        points: { total: 0 },
        stats: {}
      };

      const meetsReq = tierSystem.meetsRequirements(agent, TIERS.BRONZE);

      expect(meetsReq).toBe(true);
    });

    test('should check innovation score requirement', () => {
      const agentWithInnovation = {
        points: { total: 20000, innovation: 100 },
        stats: {
          tasksCompleted: 600,
          successRate: 88,
          collaborationsCompleted: 120
        }
      };

      const agentWithoutInnovation = {
        points: { total: 20000, innovation: 20 },
        stats: {
          tasksCompleted: 600,
          successRate: 88,
          collaborationsCompleted: 120
        }
      };

      expect(tierSystem.meetsRequirements(agentWithInnovation, TIERS.PLATINUM)).toBe(true);
      expect(tierSystem.meetsRequirements(agentWithoutInnovation, TIERS.PLATINUM)).toBe(false);
    });

    test('should check battles won requirement', () => {
      const agentWithBattles = {
        points: { total: 60000, innovation: 200 },
        stats: {
          tasksCompleted: 1500,
          successRate: 92,
          collaborationsCompleted: 300,
          battlesWon: 120
        }
      };

      const agentWithoutBattles = {
        points: { total: 60000, innovation: 200 },
        stats: {
          tasksCompleted: 1500,
          successRate: 92,
          collaborationsCompleted: 300,
          battlesWon: 50
        }
      };

      expect(tierSystem.meetsRequirements(agentWithBattles, TIERS.DIAMOND)).toBe(true);
      expect(tierSystem.meetsRequirements(agentWithoutBattles, TIERS.DIAMOND)).toBe(false);
    });
  });

  describe('Progress to Next Tier', () => {
    test('should calculate progress towards Silver from Bronze', () => {
      const agent = {
        tier: 'bronze',
        points: { total: 500 },
        stats: {
          tasksCompleted: 25,
          successRate: 70
        }
      };

      const progress = tierSystem.getProgressToNextTier(agent);

      expect(progress.currentTier.id).toBe('bronze');
      expect(progress.nextTier.id).toBe('silver');
      expect(progress.progress).toBeGreaterThan(0);
      expect(progress.progress).toBeLessThan(100);
      expect(progress.requirements).toBeDefined();
    });

    test('should show 100% progress at max tier', () => {
      const agent = {
        tier: 'diamond',
        points: { total: 100000, innovation: 300 },
        stats: {
          tasksCompleted: 2000,
          successRate: 95,
          collaborationsCompleted: 400,
          battlesWon: 200
        }
      };

      const progress = tierSystem.getProgressToNextTier(agent);

      expect(progress.currentTier.id).toBe('diamond');
      expect(progress.nextTier).toBeNull();
      expect(progress.progress).toBe(100);
      expect(progress.message).toContain('Maximum tier');
    });

    test('should show detailed progress for each requirement', () => {
      const agent = {
        tier: 'bronze',
        points: { total: 500 },
        stats: {
          tasksCompleted: 30,
          successRate: 75
        }
      };

      const progress = tierSystem.getProgressToNextTier(agent);

      expect(progress.requirements.totalPoints).toBeDefined();
      expect(progress.requirements.totalPoints.current).toBe(500);
      expect(progress.requirements.totalPoints.required).toBe(1000);
      expect(progress.requirements.totalPoints.progress).toBe(50);

      expect(progress.requirements.tasksCompleted).toBeDefined();
      expect(progress.requirements.successRate).toBeDefined();
    });

    test('should cap progress at 100% per requirement', () => {
      const agent = {
        tier: 'bronze',
        points: { total: 2000 }, // Exceeds Silver requirement
        stats: {
          tasksCompleted: 100,
          successRate: 90
        }
      };

      const progress = tierSystem.getProgressToNextTier(agent);

      expect(progress.requirements.totalPoints.progress).toBe(100);
    });
  });

  describe('Update Agent Tier', () => {
    test('should promote agent when qualified', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        tier: 'bronze',
        points: { total: 1500 },
        stats: {
          tasksCompleted: 60,
          successRate: 75
        }
      };

      const result = await tierSystem.updateAgentTier(agent);

      expect(result.promoted).toBe(true);
      expect(result.oldTier).toBe('bronze');
      expect(result.newTier).toBe('silver');
      expect(result.event).toBeDefined();

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'gamification.tiers',
        'tier.promoted.silver',
        expect.any(Buffer),
        { persistent: true }
      );
    });

    test('should not promote agent when not qualified', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        tier: 'bronze',
        points: { total: 500 },
        stats: {
          tasksCompleted: 20,
          successRate: 60
        }
      };

      const result = await tierSystem.updateAgentTier(agent);

      expect(result.promoted).toBe(false);
      expect(result.demoted).toBe(false);
      expect(result.currentTier).toBe('bronze');
    });

    test('should emit tier_promoted event', async () => {
      const listener = jest.fn();
      tierSystem.on('tier_promoted', listener);

      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        tier: 'silver',
        points: { total: 6000, innovation: 30 },
        stats: {
          tasksCompleted: 250,
          successRate: 85,
          collaborationsCompleted: 30
        }
      };

      await tierSystem.updateAgentTier(agent);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-123',
          oldTier: 'silver',
          newTier: 'gold'
        })
      );
    });

    test('should handle demotion if performance drops', async () => {
      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        tier: 'silver',
        points: { total: 500 }, // Dropped below Silver requirement
        stats: {
          tasksCompleted: 30,
          successRate: 60
        }
      };

      const result = await tierSystem.updateAgentTier(agent);

      expect(result.demoted).toBe(true);
      expect(result.oldTier).toBe('silver');
      expect(result.newTier).toBe('bronze');
    });

    test('should emit tier_demoted event', async () => {
      const listener = jest.fn();
      tierSystem.on('tier_demoted', listener);

      const agent = {
        id: 'agent-123',
        name: 'Test Agent',
        tier: 'gold',
        points: { total: 1000 },
        stats: {
          tasksCompleted: 60,
          successRate: 70
        }
      };

      await tierSystem.updateAgentTier(agent);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Get Tier', () => {
    test('should get tier by name', () => {
      const tier = tierSystem.getTier('gold');
      expect(tier.id).toBe('gold');
      expect(tier.level).toBe(3);
    });

    test('should get tier by level', () => {
      const tier = tierSystem.getTier(3);
      expect(tier.id).toBe('gold');
      expect(tier.level).toBe(3);
    });

    test('should return Bronze for invalid tier', () => {
      const tier = tierSystem.getTier('invalid');
      expect(tier.id).toBe('bronze');
    });

    test('should be case insensitive', () => {
      const tier = tierSystem.getTier('PLATINUM');
      expect(tier.id).toBe('platinum');
    });
  });

  describe('Get All Tiers', () => {
    test('should return all tiers in order', () => {
      const allTiers = tierSystem.getAllTiers();

      expect(allTiers).toHaveLength(5);
      expect(allTiers[0].id).toBe('bronze');
      expect(allTiers[1].id).toBe('silver');
      expect(allTiers[2].id).toBe('gold');
      expect(allTiers[3].id).toBe('platinum');
      expect(allTiers[4].id).toBe('diamond');
    });
  });

  describe('Tier Statistics', () => {
    test('should calculate tier distribution', () => {
      const agents = [
        { id: '1', points: { total: 100 }, stats: { tasksCompleted: 10, successRate: 70 } },
        { id: '2', points: { total: 1500 }, stats: { tasksCompleted: 60, successRate: 75 } },
        { id: '3', points: { total: 2000 }, stats: { tasksCompleted: 80, successRate: 80 } },
        { id: '4', points: { total: 500 }, stats: { tasksCompleted: 20, successRate: 65 } }
      ];

      const stats = tierSystem.getTierStatistics(agents);

      expect(stats.total).toBe(4);
      expect(stats.distribution.bronze).toBeGreaterThan(0);
      expect(stats.distribution.silver).toBeGreaterThan(0);
      expect(stats.percentages).toBeDefined();
      expect(stats.averageLevel).toBeGreaterThan(0);
    });

    test('should handle empty agent list', () => {
      const stats = tierSystem.getTierStatistics([]);

      expect(stats.total).toBe(0);
      expect(stats.averageLevel).toBe(1);
    });

    test('should calculate correct percentages', () => {
      const agents = [
        { id: '1', points: { total: 100 }, stats: { tasksCompleted: 10, successRate: 70 } },
        { id: '2', points: { total: 100 }, stats: { tasksCompleted: 10, successRate: 70 } },
        { id: '3', points: { total: 1500 }, stats: { tasksCompleted: 60, successRate: 75 } },
        { id: '4', points: { total: 1500 }, stats: { tasksCompleted: 60, successRate: 75 } }
      ];

      const stats = tierSystem.getTierStatistics(agents);

      expect(stats.percentages.bronze + stats.percentages.silver).toBeCloseTo(100, 1);
    });
  });

  describe('Average Level', () => {
    test('should calculate average tier level', () => {
      const agents = [
        { id: '1', points: { total: 100 }, stats: { tasksCompleted: 10, successRate: 70 } }, // Bronze = 1
        { id: '2', points: { total: 1500 }, stats: { tasksCompleted: 60, successRate: 75 } }, // Silver = 2
        { id: '3', points: { total: 6000, innovation: 30 }, stats: { tasksCompleted: 250, successRate: 85, collaborationsCompleted: 30 } } // Gold = 3
      ];

      const avgLevel = tierSystem.calculateAverageLevel(agents);

      expect(avgLevel).toBeCloseTo(2, 1);
    });

    test('should return 1 for empty list', () => {
      const avgLevel = tierSystem.calculateAverageLevel([]);
      expect(avgLevel).toBe(1);
    });
  });

  describe('Has Benefit', () => {
    test('should check if agent has benefit', () => {
      const goldAgent = {
        points: { total: 6000, innovation: 30 },
        stats: {
          tasksCompleted: 250,
          successRate: 85,
          collaborationsCompleted: 30
        }
      };

      expect(tierSystem.hasBenefit(goldAgent, 'battle arena')).toBe(true);
      expect(tierSystem.hasBenefit(goldAgent, 'priority support')).toBe(true);
    });

    test('should return false for benefit not in tier', () => {
      const bronzeAgent = {
        points: { total: 100 },
        stats: { tasksCompleted: 10, successRate: 70 }
      };

      expect(tierSystem.hasBenefit(bronzeAgent, 'tournament')).toBe(false);
    });

    test('should be case insensitive', () => {
      const silverAgent = {
        points: { total: 1500 },
        stats: { tasksCompleted: 60, successRate: 75 }
      };

      expect(tierSystem.hasBenefit(silverAgent, 'PRIORITY SUPPORT')).toBe(true);
      expect(tierSystem.hasBenefit(silverAgent, 'priority support')).toBe(true);
    });
  });

  describe('Tier Perks', () => {
    test('should have increasing perks at higher tiers', () => {
      expect(TIERS.SILVER.perks.length).toBeGreaterThan(TIERS.BRONZE.perks.length);
      expect(TIERS.GOLD.perks.length).toBeGreaterThan(TIERS.SILVER.perks.length);
      expect(TIERS.PLATINUM.perks.length).toBeGreaterThan(TIERS.GOLD.perks.length);
      expect(TIERS.DIAMOND.perks.length).toBeGreaterThan(TIERS.PLATINUM.perks.length);
    });

    test('should include previous tier perks', () => {
      expect(TIERS.SILVER.perks.some(p => p.includes('Bronze'))).toBe(true);
      expect(TIERS.GOLD.perks.some(p => p.includes('Silver'))).toBe(true);
      expect(TIERS.PLATINUM.perks.some(p => p.includes('Gold'))).toBe(true);
      expect(TIERS.DIAMOND.perks.some(p => p.includes('Platinum'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle agent with no stats', () => {
      const agent = {
        id: 'agent-123',
        tier: 'bronze'
      };

      const tier = tierSystem.calculateTier(agent);
      expect(tier.id).toBe('bronze');

      const progress = tierSystem.getProgressToNextTier(agent);
      expect(progress.progress).toBeGreaterThanOrEqual(0);
    });

    test('should handle agent with undefined tier', async () => {
      const agent = {
        id: 'agent-123',
        points: { total: 1500 },
        stats: { tasksCompleted: 60, successRate: 75 }
      };

      const result = await tierSystem.updateAgentTier(agent);
      expect(result).toBeDefined();
    });

    test('should handle exact requirement match', () => {
      const agent = {
        points: { total: 5000, innovation: 30 },
        stats: {
          tasksCompleted: 200,
          successRate: 80,
          collaborationsCompleted: 25
        }
      };

      const tier = tierSystem.calculateTier(agent);
      expect(tier.id).toBe('gold');
    });
  });
});
