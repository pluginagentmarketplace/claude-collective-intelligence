/**
 * Rewards System Unit Tests
 * Comprehensive tests for permissions, resources, points, achievements, and streaks
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RewardsSystem, PRIORITY_LEVELS, POINT_AWARDS, ACHIEVEMENTS, STREAK_SYSTEM } from '../../scripts/rewards-system.js';
import { PermissionManager, PERMISSION_TIERS, UNLOCK_CRITERIA } from '../../scripts/rewards/permission-manager.js';
import { ResourceAllocator, COMPUTE_TIERS, COMPUTE_BOOSTS } from '../../scripts/rewards/resource-allocator.js';

describe('PermissionManager', () => {
  let permissionManager;

  beforeEach(() => {
    permissionManager = new PermissionManager();
  });

  describe('Agent Initialization', () => {
    it('should initialize agent with Bronze tier', () => {
      const agentId = 'test-agent-1';
      const permissions = permissionManager.initializeAgent(agentId);

      expect(permissions.tier).toBe('BRONZE');
      expect(permissions.level).toBe(1);
      expect(permissions.points).toBe(0);
      expect(permissions.capabilities).toContain('task.consume');
    });

    it('should not reinitialize existing agent', () => {
      const agentId = 'test-agent-2';
      const first = permissionManager.initializeAgent(agentId);
      permissionManager.awardPoints(agentId, 100);
      const second = permissionManager.initializeAgent(agentId);

      expect(second.points).toBe(100);
    });

    it('should emit agent_initialized event', (done) => {
      const agentId = 'test-agent-3';
      permissionManager.on('agent_initialized', (data) => {
        expect(data.agentId).toBe(agentId);
        expect(data.tier).toBe('BRONZE');
        done();
      });

      permissionManager.initializeAgent(agentId);
    });
  });

  describe('Permission Checking', () => {
    it('should allow Bronze tier basic permissions', () => {
      const agentId = 'test-agent-4';
      permissionManager.initializeAgent(agentId);

      expect(permissionManager.hasPermission(agentId, 'task.consume')).toBe(true);
      expect(permissionManager.hasPermission(agentId, 'result.publish')).toBe(true);
      expect(permissionManager.hasPermission(agentId, 'status.publish')).toBe(true);
    });

    it('should deny Bronze tier advanced permissions', () => {
      const agentId = 'test-agent-5';
      permissionManager.initializeAgent(agentId);

      expect(permissionManager.hasPermission(agentId, 'brainstorm.initiate')).toBe(false);
      expect(permissionManager.hasPermission(agentId, 'workflow.create')).toBe(false);
    });

    it('should handle wildcard permissions for Diamond tier', async () => {
      const agentId = 'test-agent-6';
      permissionManager.initializeAgent(agentId);
      await permissionManager.upgradeTier(agentId, 'DIAMOND');

      expect(permissionManager.hasPermission(agentId, 'any.permission')).toBe(true);
      expect(permissionManager.hasPermission(agentId, 'custom.capability')).toBe(true);
    });

    it('should handle prefix matching for permissions', async () => {
      const agentId = 'test-agent-7';
      permissionManager.initializeAgent(agentId);
      await permissionManager.upgradeTier(agentId, 'PLATINUM');

      expect(permissionManager.hasPermission(agentId, 'task.consume')).toBe(true);
      expect(permissionManager.hasPermission(agentId, 'task.assign')).toBe(true);
      expect(permissionManager.hasPermission(agentId, 'task.anything')).toBe(true);
    });
  });

  describe('Points System', () => {
    it('should award points to agent', async () => {
      const agentId = 'test-agent-8';
      permissionManager.initializeAgent(agentId);

      const points = await permissionManager.awardPoints(agentId, 100);
      expect(points).toBe(100);
      expect(permissionManager.getAgentPoints(agentId)).toBe(100);
    });

    it('should accumulate points', async () => {
      const agentId = 'test-agent-9';
      permissionManager.initializeAgent(agentId);

      await permissionManager.awardPoints(agentId, 100);
      await permissionManager.awardPoints(agentId, 200);
      await permissionManager.awardPoints(agentId, 300);

      expect(permissionManager.getAgentPoints(agentId)).toBe(600);
    });

    it('should emit points_awarded event', (done) => {
      const agentId = 'test-agent-10';
      permissionManager.initializeAgent(agentId);

      permissionManager.on('points_awarded', (data) => {
        expect(data.agentId).toBe(agentId);
        expect(data.points).toBe(150);
        expect(data.reason).toBe('test');
        expect(data.totalPoints).toBe(150);
        done();
      });

      permissionManager.awardPoints(agentId, 150, 'test');
    });
  });

  describe('Achievements', () => {
    it('should award achievement to agent', async () => {
      const agentId = 'test-agent-11';
      permissionManager.initializeAgent(agentId);

      const result = await permissionManager.awardAchievement(agentId, 'first_task');
      expect(result.success).toBe(true);
    });

    it('should not award duplicate achievements', async () => {
      const agentId = 'test-agent-12';
      permissionManager.initializeAgent(agentId);

      await permissionManager.awardAchievement(agentId, 'first_task');
      const result = await permissionManager.awardAchievement(agentId, 'first_task');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('already_unlocked');
    });

    it('should check required achievements', async () => {
      const agentId = 'test-agent-13';
      permissionManager.initializeAgent(agentId);

      expect(permissionManager.hasRequiredAchievements(agentId, ['first_task'])).toBe(false);

      await permissionManager.awardAchievement(agentId, 'first_task');
      expect(permissionManager.hasRequiredAchievements(agentId, ['first_task'])).toBe(true);
    });

    it('should emit achievement_unlocked event', (done) => {
      const agentId = 'test-agent-14';
      permissionManager.initializeAgent(agentId);

      permissionManager.on('achievement_unlocked', (data) => {
        expect(data.agentId).toBe(agentId);
        expect(data.achievementId).toBe('team_player');
        done();
      });

      permissionManager.awardAchievement(agentId, 'team_player');
    });
  });

  describe('Tier Upgrades', () => {
    it('should upgrade tier when criteria met', async () => {
      const agentId = 'test-agent-15';
      permissionManager.initializeAgent(agentId);

      // Award required points
      await permissionManager.awardPoints(agentId, 1000);

      // Award required achievements
      await permissionManager.awardAchievement(agentId, 'first_task');
      await permissionManager.awardAchievement(agentId, 'team_player');

      const metrics = {
        tasksCompleted: 50,
        successRate: 0.85,
        brainstormsParticipated: 10,
        uptime: 3600000
      };

      const result = await permissionManager.checkTierUpgrade(agentId, metrics);

      expect(result).toBeTruthy();
      expect(result.newTier).toBe('SILVER');
      expect(result.bonusPoints).toBe(2000);
    });

    it('should not upgrade without sufficient points', async () => {
      const agentId = 'test-agent-16';
      permissionManager.initializeAgent(agentId);

      const metrics = {
        tasksCompleted: 50,
        successRate: 0.85,
        brainstormsParticipated: 10,
        uptime: 3600000
      };

      const result = await permissionManager.checkTierUpgrade(agentId, metrics);
      expect(result).toBeNull();
    });

    it('should not upgrade without required achievements', async () => {
      const agentId = 'test-agent-17';
      permissionManager.initializeAgent(agentId);
      await permissionManager.awardPoints(agentId, 1000);

      const metrics = {
        tasksCompleted: 50,
        successRate: 0.85,
        brainstormsParticipated: 10,
        uptime: 3600000
      };

      const result = await permissionManager.checkTierUpgrade(agentId, metrics);
      expect(result).toBeNull();
    });

    it('should update capabilities on tier upgrade', async () => {
      const agentId = 'test-agent-18';
      permissionManager.initializeAgent(agentId);

      const result = await permissionManager.upgradeTier(agentId, 'SILVER');

      const permissions = permissionManager.getAgentPermissions(agentId);
      expect(permissions.capabilities).toContain('brainstorm.participate');
      expect(permissions.apiAccess.brainstorm).toBe(true);
    });

    it('should emit tier_upgraded event', (done) => {
      const agentId = 'test-agent-19';
      permissionManager.initializeAgent(agentId);

      permissionManager.on('tier_upgraded', (data) => {
        expect(data.agentId).toBe(agentId);
        expect(data.oldTier).toBe('BRONZE');
        expect(data.newTier).toBe('GOLD');
        done();
      });

      permissionManager.upgradeTier(agentId, 'GOLD');
    });
  });

  describe('Temporary Elevations', () => {
    it('should grant temporary privilege elevation', async () => {
      const agentId = 'test-agent-20';
      permissionManager.initializeAgent(agentId);

      const elevation = await permissionManager.grantTemporaryElevation(
        agentId,
        'workflow.create',
        5000,
        'special_task'
      );

      expect(elevation.privilege).toBe('workflow.create');
      expect(permissionManager.hasTemporaryElevation(agentId, 'workflow.create')).toBe(true);
    });

    it('should revoke elevation after duration', async () => {
      const agentId = 'test-agent-21';
      permissionManager.initializeAgent(agentId);

      await permissionManager.grantTemporaryElevation(
        agentId,
        'workflow.create',
        100,
        'special_task'
      );

      expect(permissionManager.hasTemporaryElevation(agentId, 'workflow.create')).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(permissionManager.hasTemporaryElevation(agentId, 'workflow.create')).toBe(false);
    });

    it('should allow permission with temporary elevation', async () => {
      const agentId = 'test-agent-22';
      permissionManager.initializeAgent(agentId);

      expect(permissionManager.hasPermission(agentId, 'workflow.create')).toBe(false);

      await permissionManager.grantTemporaryElevation(
        agentId,
        'workflow.create',
        5000,
        'special_task'
      );

      expect(permissionManager.hasPermission(agentId, 'workflow.create')).toBe(true);
    });
  });

  describe('Tier Statistics', () => {
    it('should return agents by tier', () => {
      permissionManager.initializeAgent('agent-1');
      permissionManager.initializeAgent('agent-2');
      permissionManager.initializeAgent('agent-3');

      const bronzeAgents = permissionManager.getAgentsByTier('BRONZE');
      expect(bronzeAgents).toHaveLength(3);
    });

    it('should return tier distribution', async () => {
      permissionManager.initializeAgent('agent-1');
      permissionManager.initializeAgent('agent-2');
      await permissionManager.upgradeTier('agent-2', 'SILVER');

      const stats = permissionManager.getTierStats();
      expect(stats.BRONZE).toBe(1);
      expect(stats.SILVER).toBe(1);
    });
  });
});

describe('ResourceAllocator', () => {
  let resourceAllocator;
  let permissionManager;

  beforeEach(() => {
    permissionManager = new PermissionManager();
    resourceAllocator = new ResourceAllocator(permissionManager);
  });

  describe('Base Allocation', () => {
    it('should return Bronze tier base allocation', () => {
      const agentId = 'test-agent-30';
      permissionManager.initializeAgent(agentId);

      const config = resourceAllocator.getBaseAllocation(agentId);
      expect(config.prefetchCount).toBe(1);
      expect(config.timeoutMultiplier).toBe(1.0);
      expect(config.messageRateLimit).toBe(10);
    });

    it('should return higher allocation for higher tiers', async () => {
      const agentId = 'test-agent-31';
      permissionManager.initializeAgent(agentId);
      await permissionManager.upgradeTier(agentId, 'GOLD');

      const config = resourceAllocator.getBaseAllocation(agentId);
      expect(config.prefetchCount).toBe(5);
      expect(config.timeoutMultiplier).toBe(2.0);
      expect(config.messageRateLimit).toBe(50);
    });
  });

  describe('Performance-Based Allocation', () => {
    it('should increase allocation for high success rate', () => {
      const agentId = 'test-agent-32';
      permissionManager.initializeAgent(agentId);

      resourceAllocator.updatePerformanceMetrics(agentId, {
        successRate: 0.95,
        avgCompletionTime: 1000,
        currentStreak: 5,  // Add a streak to get bonus
        speedMultiplier: 1.2
      });

      const allocation = resourceAllocator.calculateAllocation(agentId);
      expect(allocation.prefetchCount).toBeGreaterThan(1);
      expect(allocation.breakdown.successRateBonus).toBeGreaterThan(0);
    });

    it('should apply streak bonuses', () => {
      const agentId = 'test-agent-33';
      permissionManager.initializeAgent(agentId);

      resourceAllocator.updatePerformanceMetrics(agentId, {
        successRate: 0.8,
        avgCompletionTime: 1000,
        currentStreak: 10
      });

      const allocation = resourceAllocator.calculateAllocation(agentId);
      expect(allocation.breakdown.streakBonus).toBe(2);
    });

    it('should apply shaped difference rewards', () => {
      const agent1 = 'test-agent-34';
      const agent2 = 'test-agent-35';

      permissionManager.initializeAgent(agent1);
      permissionManager.initializeAgent(agent2);

      resourceAllocator.updatePerformanceMetrics(agent1, {
        successRate: 0.8,
        contribution: 100
      });

      resourceAllocator.updatePerformanceMetrics(agent2, {
        successRate: 0.8,
        contribution: 50
      });

      const allocation1 = resourceAllocator.calculateAllocation(agent1);
      const allocation2 = resourceAllocator.calculateAllocation(agent2);

      expect(allocation1.breakdown.shapedBonus).toBeGreaterThan(allocation2.breakdown.shapedBonus);
    });
  });

  describe('Resource Allocation', () => {
    it('should allocate resources to agent', async () => {
      const agentId = 'test-agent-36';
      permissionManager.initializeAgent(agentId);

      const result = await resourceAllocator.allocateResources(agentId);

      expect(result.success).toBe(true);
      expect(result.allocated).toBeGreaterThan(0);
      expect(result.config).toBeDefined();
    });

    it('should emit resources_allocated event', (done) => {
      const agentId = 'test-agent-37';
      permissionManager.initializeAgent(agentId);

      resourceAllocator.on('resources_allocated', (data) => {
        expect(data.agentId).toBe(agentId);
        expect(data.allocation).toBeGreaterThan(0);
        done();
      });

      resourceAllocator.allocateResources(agentId);
    });
  });

  describe('Team Pool', () => {
    it('should allow contribution to team pool', async () => {
      const agentId = 'test-agent-38';
      permissionManager.initializeAgent(agentId);
      await resourceAllocator.allocateResources(agentId);

      const result = await resourceAllocator.contributeToTeamPool(agentId, 1);

      expect(result.success).toBe(true);
      expect(result.contributed).toBe(1);
    });

    it('should track team pool statistics', async () => {
      const agentId = 'test-agent-39';
      permissionManager.initializeAgent(agentId);
      await resourceAllocator.allocateResources(agentId);
      await resourceAllocator.contributeToTeamPool(agentId, 2);

      const stats = resourceAllocator.getPoolStats();
      expect(stats.team.total).toBe(2);
      expect(stats.team.available).toBe(2);
    });
  });

  describe('Timeouts and Rate Limits', () => {
    it('should calculate timeout based on tier', () => {
      const agentId = 'test-agent-40';
      permissionManager.initializeAgent(agentId);

      const timeout = resourceAllocator.getAgentTimeout(agentId, 30000);
      expect(timeout).toBe(30000); // Bronze: 1.0x
    });

    it('should increase timeout for higher tiers', async () => {
      const agentId = 'test-agent-41';
      permissionManager.initializeAgent(agentId);
      await permissionManager.upgradeTier(agentId, 'PLATINUM');

      const timeout = resourceAllocator.getAgentTimeout(agentId, 30000);
      expect(timeout).toBe(90000); // Platinum: 3.0x
    });

    it('should return message rate limit', () => {
      const agentId = 'test-agent-42';
      permissionManager.initializeAgent(agentId);

      const rateLimit = resourceAllocator.getMessageRateLimit(agentId);
      expect(rateLimit).toBe(10);
    });
  });
});

describe('RewardsSystem', () => {
  let rewardsSystem;

  beforeEach(() => {
    rewardsSystem = new RewardsSystem();
  });

  describe('System Initialization', () => {
    it('should initialize agent in rewards system', () => {
      const agentId = 'test-agent-50';
      const result = rewardsSystem.initializeAgent(agentId);

      expect(result.tier).toBe('BRONZE');
      expect(result.points).toBe(0);
      expect(result.resources).toBeDefined();
    });
  });

  describe('Point Calculation', () => {
    it('should calculate task points with all multipliers', () => {
      const agentId = 'test-agent-51';
      rewardsSystem.initializeAgent(agentId);

      const task = { priority: 'HIGH', complexity: 2, collaboration: true };
      const result = { quality: 0.95, duration: 2000, retries: 0 };

      const pointResult = rewardsSystem.calculateTaskPoints(agentId, task, result);

      expect(pointResult.points).toBeGreaterThan(100);
      expect(pointResult.breakdown.priority).toBe(2.0);
      expect(pointResult.breakdown.quality).toBeGreaterThan(1.0);
    });

    it('should apply priority multipliers correctly', () => {
      const agentId = 'test-agent-52';
      rewardsSystem.initializeAgent(agentId);

      const criticalTask = { priority: 'CRITICAL' };
      const normalTask = { priority: 'NORMAL' };
      const result = { quality: 0.8, duration: 1000 };

      const critical = rewardsSystem.calculateTaskPoints(agentId, criticalTask, result);
      const normal = rewardsSystem.calculateTaskPoints(agentId, normalTask, result);

      expect(critical.points).toBeGreaterThan(normal.points);
    });

    it('should apply streak multipliers', async () => {
      const agentId = 'test-agent-53';
      rewardsSystem.initializeAgent(agentId);

      // Build up a streak
      const task = { priority: 'NORMAL' };
      const result = { quality: 0.8, duration: 1000 };

      for (let i = 0; i < 10; i++) {
        await rewardsSystem.updateStreak(agentId, true);
      }

      const pointResult = rewardsSystem.calculateTaskPoints(agentId, task, result);
      expect(pointResult.breakdown.streak).toBeGreaterThan(1.0);
    });
  });

  describe('Streak Management', () => {
    it('should increment streak on success', async () => {
      const agentId = 'test-agent-54';
      rewardsSystem.initializeAgent(agentId);

      await rewardsSystem.updateStreak(agentId, true);
      await rewardsSystem.updateStreak(agentId, true);
      await rewardsSystem.updateStreak(agentId, true);

      const status = rewardsSystem.getAgentStatus(agentId);
      expect(status.currentStreak).toBe(3);
    });

    it('should reset streak on failure', async () => {
      const agentId = 'test-agent-55';
      rewardsSystem.initializeAgent(agentId);

      await rewardsSystem.updateStreak(agentId, true);
      await rewardsSystem.updateStreak(agentId, true);
      await rewardsSystem.updateStreak(agentId, false);

      const status = rewardsSystem.getAgentStatus(agentId);
      expect(status.currentStreak).toBe(0);
    });

    it('should protect streak for higher tiers', async () => {
      const agentId = 'test-agent-56';
      rewardsSystem.initializeAgent(agentId);
      await rewardsSystem.permissionManager.upgradeTier(agentId, 'SILVER');

      await rewardsSystem.updateStreak(agentId, true);
      await rewardsSystem.updateStreak(agentId, true);
      await rewardsSystem.updateStreak(agentId, false); // Protected

      const status = rewardsSystem.getAgentStatus(agentId);
      expect(status.currentStreak).toBe(2); // Streak preserved
    });

    it('should track longest streak', async () => {
      const agentId = 'test-agent-57';
      rewardsSystem.initializeAgent(agentId);

      for (let i = 0; i < 5; i++) {
        await rewardsSystem.updateStreak(agentId, true);
      }
      await rewardsSystem.updateStreak(agentId, false);

      const status = rewardsSystem.getAgentStatus(agentId);
      expect(status.longestStreak).toBe(5);
    });
  });

  describe('Achievement System', () => {
    it('should unlock first_task achievement', async () => {
      const agentId = 'test-agent-58';
      rewardsSystem.initializeAgent(agentId);

      const task = { priority: 'NORMAL' };
      const result = { quality: 0.8, duration: 1000 };

      await rewardsSystem.awardTaskPoints(agentId, task, result);
      const achievements = await rewardsSystem.checkAchievements(agentId);

      expect(achievements.some(a => a.id === 'first_task')).toBe(true);
    });

    it('should not duplicate achievements', async () => {
      const agentId = 'test-agent-59';
      rewardsSystem.initializeAgent(agentId);

      const task = { priority: 'NORMAL' };
      const result = { quality: 0.8, duration: 1000 };

      await rewardsSystem.awardTaskPoints(agentId, task, result);
      const first = await rewardsSystem.checkAchievements(agentId);
      const second = await rewardsSystem.checkAchievements(agentId);

      expect(second).toHaveLength(0);
    });
  });

  describe('Brainstorm Points', () => {
    it('should award participation points', async () => {
      const agentId = 'test-agent-60';
      rewardsSystem.initializeAgent(agentId);

      const points = await rewardsSystem.awardBrainstormPoints(agentId);
      expect(points).toBe(POINT_AWARDS.BRAINSTORM_PARTICIPATION);
    });

    it('should award more points for initiators', async () => {
      const agentId = 'test-agent-61';
      rewardsSystem.initializeAgent(agentId);

      const points = await rewardsSystem.awardBrainstormPoints(agentId, true);
      expect(points).toBe(POINT_AWARDS.BRAINSTORM_INITIATION);
    });

    it('should award bonus for best solution', async () => {
      const agentId = 'test-agent-62';
      rewardsSystem.initializeAgent(agentId);

      const points = await rewardsSystem.awardBrainstormPoints(agentId, false, true);
      expect(points).toBeGreaterThan(POINT_AWARDS.BRAINSTORM_PARTICIPATION);
    });
  });

  describe('Leaderboard', () => {
    it('should return ranked agents', async () => {
      rewardsSystem.initializeAgent('agent-1');
      rewardsSystem.initializeAgent('agent-2');
      rewardsSystem.initializeAgent('agent-3');

      await rewardsSystem.permissionManager.awardPoints('agent-1', 300);
      await rewardsSystem.permissionManager.awardPoints('agent-2', 100);
      await rewardsSystem.permissionManager.awardPoints('agent-3', 200);

      const leaderboard = rewardsSystem.getLeaderboard();

      expect(leaderboard[0].agentId).toBe('agent-1');
      expect(leaderboard[1].agentId).toBe('agent-3');
      expect(leaderboard[2].agentId).toBe('agent-2');
    });

    it('should limit leaderboard size', () => {
      for (let i = 0; i < 20; i++) {
        rewardsSystem.initializeAgent(`agent-${i}`);
      }

      const leaderboard = rewardsSystem.getLeaderboard(5);
      expect(leaderboard).toHaveLength(5);
    });
  });

  describe('Full Agent Status', () => {
    it('should return complete agent status', async () => {
      const agentId = 'test-agent-63';
      rewardsSystem.initializeAgent(agentId);

      const task = { priority: 'NORMAL' };
      const result = { quality: 0.8, duration: 1000 };
      await rewardsSystem.awardTaskPoints(agentId, task, result);

      const status = rewardsSystem.getAgentStatus(agentId);

      expect(status.agentId).toBe(agentId);
      expect(status.tier).toBe('BRONZE');
      expect(status.points).toBeGreaterThan(0);
      expect(status.stats).toBeDefined();
      expect(status.allocation).toBeDefined();
    });
  });
});
