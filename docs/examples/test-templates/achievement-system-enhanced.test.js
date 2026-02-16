/**
 * Enhanced Unit Tests for Achievement System
 * Comprehensive testing of gamification, rewards, and progression mechanics
 * Target Coverage: 80%+
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// ==================== MOCK SETUP ====================

// Mock Points Engine
const mockPointsEngine = {
  addPoints: jest.fn().mockResolvedValue({ total: 100 }),
  getPoints: jest.fn().mockResolvedValue(100),
  deductPoints: jest.fn().mockResolvedValue({ total: 50 }),
  getLeaderboard: jest.fn().mockResolvedValue([]),
};

jest.unstable_mockModule('../../scripts/gamification/points-engine.js', () => ({
  PointsEngine: jest.fn(() => mockPointsEngine),
}));

// Mock Tier System
const mockTierSystem = {
  getCurrentTier: jest.fn().mockResolvedValue({ name: 'Bronze', level: 1 }),
  checkPromotion: jest.fn().mockResolvedValue({ promoted: false }),
  getTierBenefits: jest.fn().mockResolvedValue([]),
};

jest.unstable_mockModule('../../scripts/gamification/tier-system.js', () => ({
  TierSystem: jest.fn(() => mockTierSystem),
}));

// Mock Reputation System
const mockReputationSystem = {
  updateReputation: jest.fn().mockResolvedValue(100),
  getReputation: jest.fn().mockResolvedValue(100),
};

jest.unstable_mockModule('../../scripts/gamification/reputation-system.js', () => ({
  ReputationSystem: jest.fn(() => mockReputationSystem),
}));

// ==================== TEST SUITES ====================

describe('AchievementSystem - Enhanced Test Suite', () => {
  let AchievementSystem;
  let achievementSystem;

  // ===== SETUP & TEARDOWN =====
  beforeAll(async () => {
    const module = await import('../../scripts/gamification/achievement-system.js');
    AchievementSystem = module.AchievementSystem;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    achievementSystem = null;
  });

  afterEach(() => {
    if (achievementSystem) {
      achievementSystem.cleanup();
    }
  });

  // ===== INITIALIZATION TESTS =====
  describe('System Initialization', () => {
    it('should initialize with default configuration', () => {
      achievementSystem = new AchievementSystem();

      expect(achievementSystem).toBeDefined();
      expect(achievementSystem.achievements).toBeDefined();
      expect(achievementSystem.config).toMatchObject({
        persistProgress: true,
        notificationsEnabled: true,
        retroactiveUnlock: false,
      });
    });

    it('should load predefined achievements', async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();

      const achievements = await achievementSystem.getAllAchievements();

      expect(achievements).toContainEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          category: expect.any(String),
          points: expect.any(Number),
        })
      );
    });

    it('should support custom achievement definitions', async () => {
      const customAchievements = [
        {
          id: 'custom-1',
          name: 'Custom Achievement',
          description: 'A custom test achievement',
          category: 'custom',
          points: 500,
          criteria: {
            type: 'counter',
            target: 10,
          },
        },
      ];

      achievementSystem = new AchievementSystem({
        customAchievements,
      });

      await achievementSystem.initialize();

      const achievement = await achievementSystem.getAchievement('custom-1');
      expect(achievement.name).toBe('Custom Achievement');
    });
  });

  // ===== ACHIEVEMENT TRACKING TESTS =====
  describe('Achievement Tracking', () => {
    beforeEach(async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();
    });

    describe('Progress Tracking', () => {
      it('should track simple counter achievements', async () => {
        const achievementId = 'task-master';
        await achievementSystem.registerAgent('agent-1');

        // Increment progress
        for (let i = 0; i < 5; i++) {
          await achievementSystem.incrementProgress('agent-1', achievementId);
        }

        const progress = await achievementSystem.getProgress('agent-1', achievementId);

        expect(progress).toMatchObject({
          current: 5,
          target: expect.any(Number),
          percentage: expect.any(Number),
        });
      });

      it('should track cumulative achievements', async () => {
        await achievementSystem.registerAgent('agent-1');

        // Track cumulative points
        await achievementSystem.trackEvent('agent-1', 'points-earned', {
          amount: 100,
        });
        await achievementSystem.trackEvent('agent-1', 'points-earned', {
          amount: 150,
        });

        const progress = await achievementSystem.getProgress('agent-1', 'point-collector');

        expect(progress.current).toBe(250);
      });

      it('should track threshold achievements', async () => {
        await achievementSystem.registerAgent('agent-1');

        // Track win rate
        for (let i = 0; i < 8; i++) {
          await achievementSystem.trackEvent('agent-1', 'battle-won');
        }
        for (let i = 0; i < 2; i++) {
          await achievementSystem.trackEvent('agent-1', 'battle-lost');
        }

        const achievement = await achievementSystem.checkAchievement(
          'agent-1',
          'victory-streak'
        );

        expect(achievement.unlocked).toBe(true);
        expect(achievement.stats.winRate).toBe(0.8);
      });

      it('should track time-based achievements', async () => {
        jest.useFakeTimers();
        await achievementSystem.registerAgent('agent-1');

        // Start tracking
        await achievementSystem.startTimeTracking('agent-1', 'dedication');

        // Advance time
        jest.advanceTimersByTime(3600000); // 1 hour

        const progress = await achievementSystem.getProgress('agent-1', 'dedication');

        expect(progress.timeSpent).toBeGreaterThanOrEqual(3600000);

        jest.useRealTimers();
      });

      it('should track composite achievements', async () => {
        await achievementSystem.registerAgent('agent-1');

        // Complete multiple sub-achievements
        await achievementSystem.unlockAchievement('agent-1', 'first-task');
        await achievementSystem.unlockAchievement('agent-1', 'team-player');
        await achievementSystem.unlockAchievement('agent-1', 'problem-solver');

        const composite = await achievementSystem.checkCompositeAchievement(
          'agent-1',
          'jack-of-all-trades'
        );

        expect(composite.progress).toBe(3);
        expect(composite.required).toBe(5);
      });
    });

    describe('Achievement Unlocking', () => {
      it('should unlock achievement when criteria met', async () => {
        await achievementSystem.registerAgent('agent-1');

        const unlockEvent = await achievementSystem.unlockAchievement(
          'agent-1',
          'first-blood'
        );

        expect(unlockEvent).toMatchObject({
          achievementId: 'first-blood',
          agentId: 'agent-1',
          unlockedAt: expect.any(Number),
          rewards: expect.any(Object),
        });
      });

      it('should prevent duplicate unlocks', async () => {
        await achievementSystem.registerAgent('agent-1');

        await achievementSystem.unlockAchievement('agent-1', 'unique-achievement');

        await expect(
          achievementSystem.unlockAchievement('agent-1', 'unique-achievement')
        ).rejects.toThrow('already unlocked');
      });

      it('should handle conditional unlocks', async () => {
        await achievementSystem.registerAgent('agent-1');

        // Set prerequisites
        await achievementSystem.unlockAchievement('agent-1', 'prerequisite-1');

        const conditional = await achievementSystem.tryUnlock(
          'agent-1',
          'advanced-achievement',
          { checkPrerequisites: true }
        );

        expect(conditional.unlocked).toBe(false);
        expect(conditional.missingPrerequisites).toContain('prerequisite-2');
      });

      it('should support secret achievements', async () => {
        await achievementSystem.registerAgent('agent-1');

        // Trigger secret achievement
        await achievementSystem.trackEvent('agent-1', 'secret-action', {
          hidden: true,
        });

        const unlocked = await achievementSystem.getUnlockedAchievements('agent-1');

        const secretAchievement = unlocked.find(a => a.secret === true);
        expect(secretAchievement).toBeDefined();
        expect(secretAchievement.hidden).toBe(false); // Revealed after unlock
      });
    });

    describe('Achievement Categories', () => {
      it('should organize achievements by category', async () => {
        const categories = await achievementSystem.getCategories();

        expect(categories).toContain('combat');
        expect(categories).toContain('exploration');
        expect(categories).toContain('social');
        expect(categories).toContain('mastery');
      });

      it('should track category completion', async () => {
        await achievementSystem.registerAgent('agent-1');

        // Unlock all combat achievements
        const combatAchievements = await achievementSystem.getAchievementsByCategory('combat');

        for (const achievement of combatAchievements) {
          await achievementSystem.unlockAchievement('agent-1', achievement.id);
        }

        const categoryProgress = await achievementSystem.getCategoryProgress(
          'agent-1',
          'combat'
        );

        expect(categoryProgress.percentage).toBe(100);
        expect(categoryProgress.completed).toBe(true);
      });
    });
  });

  // ===== REWARDS SYSTEM TESTS =====
  describe('Rewards System', () => {
    beforeEach(async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();
      await achievementSystem.registerAgent('agent-1');
    });

    describe('Point Rewards', () => {
      it('should award points for achievements', async () => {
        const unlock = await achievementSystem.unlockAchievement(
          'agent-1',
          'point-achievement'
        );

        expect(unlock.rewards.points).toBe(100);
        expect(mockPointsEngine.addPoints).toHaveBeenCalledWith(
          'agent-1',
          100,
          expect.objectContaining({ source: 'achievement' })
        );
      });

      it('should apply point multipliers', async () => {
        await achievementSystem.setMultiplier('agent-1', 2.0);

        const unlock = await achievementSystem.unlockAchievement(
          'agent-1',
          'multiplied-achievement'
        );

        expect(unlock.rewards.points).toBe(200); // Base 100 * 2.0
      });

      it('should handle bonus points for speed', async () => {
        jest.useFakeTimers();
        const startTime = Date.now();

        await achievementSystem.startChallenge('agent-1', 'speed-run');

        // Complete quickly
        jest.advanceTimersByTime(5000); // 5 seconds

        const unlock = await achievementSystem.completeChallenge(
          'agent-1',
          'speed-run'
        );

        expect(unlock.rewards.speedBonus).toBeGreaterThan(0);

        jest.useRealTimers();
      });
    });

    describe('Badge Rewards', () => {
      it('should award badges', async () => {
        const unlock = await achievementSystem.unlockAchievement(
          'agent-1',
          'badge-worthy'
        );

        expect(unlock.rewards.badge).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          tier: expect.any(String),
          icon: expect.any(String),
        });
      });

      it('should track badge collection', async () => {
        await achievementSystem.unlockAchievement('agent-1', 'badge-1');
        await achievementSystem.unlockAchievement('agent-1', 'badge-2');

        const badges = await achievementSystem.getBadges('agent-1');

        expect(badges).toHaveLength(2);
        expect(badges[0].displayOrder).toBeDefined();
      });

      it('should support badge tiers', async () => {
        // Unlock bronze tier
        await achievementSystem.unlockAchievement('agent-1', 'tiered-bronze');

        // Unlock silver tier (upgrades bronze)
        await achievementSystem.unlockAchievement('agent-1', 'tiered-silver');

        const badges = await achievementSystem.getBadges('agent-1');

        const tieredBadge = badges.find(b => b.id === 'tiered-badge');
        expect(tieredBadge.tier).toBe('silver');
      });
    });

    describe('Title Rewards', () => {
      it('should award titles', async () => {
        const unlock = await achievementSystem.unlockAchievement(
          'agent-1',
          'legendary-achievement'
        );

        expect(unlock.rewards.title).toBe('Legend');
      });

      it('should track equipped title', async () => {
        await achievementSystem.unlockAchievement('agent-1', 'title-1');
        await achievementSystem.unlockAchievement('agent-1', 'title-2');

        await achievementSystem.equipTitle('agent-1', 'Master');

        const profile = await achievementSystem.getAgentProfile('agent-1');
        expect(profile.equippedTitle).toBe('Master');
      });
    });

    describe('Special Rewards', () => {
      it('should unlock special abilities', async () => {
        const unlock = await achievementSystem.unlockAchievement(
          'agent-1',
          'ability-unlock'
        );

        expect(unlock.rewards.ability).toMatchObject({
          id: 'double-vote',
          name: 'Double Vote',
          description: expect.any(String),
        });
      });

      it('should grant cosmetic rewards', async () => {
        const unlock = await achievementSystem.unlockAchievement(
          'agent-1',
          'stylish-achievement'
        );

        expect(unlock.rewards.cosmetic).toMatchObject({
          type: 'avatar-border',
          id: expect.any(String),
          rarity: 'epic',
        });
      });
    });
  });

  // ===== LEADERBOARD INTEGRATION TESTS =====
  describe('Leaderboard Integration', () => {
    beforeEach(async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();
    });

    it('should update achievement leaderboard', async () => {
      // Register multiple agents
      const agents = ['agent-1', 'agent-2', 'agent-3'];
      for (const agent of agents) {
        await achievementSystem.registerAgent(agent);
      }

      // Unlock different numbers of achievements
      await achievementSystem.unlockAchievement('agent-1', 'ach-1');
      await achievementSystem.unlockAchievement('agent-1', 'ach-2');
      await achievementSystem.unlockAchievement('agent-1', 'ach-3');

      await achievementSystem.unlockAchievement('agent-2', 'ach-1');
      await achievementSystem.unlockAchievement('agent-2', 'ach-2');

      await achievementSystem.unlockAchievement('agent-3', 'ach-1');

      const leaderboard = await achievementSystem.getAchievementLeaderboard();

      expect(leaderboard[0].agentId).toBe('agent-1');
      expect(leaderboard[0].achievementCount).toBe(3);
    });

    it('should calculate achievement scores', async () => {
      await achievementSystem.registerAgent('agent-1');

      // Unlock achievements with different point values
      await achievementSystem.unlockAchievement('agent-1', 'common-ach'); // 10 points
      await achievementSystem.unlockAchievement('agent-1', 'rare-ach'); // 50 points
      await achievementSystem.unlockAchievement('agent-1', 'legendary-ach'); // 200 points

      const score = await achievementSystem.getAchievementScore('agent-1');

      expect(score).toBe(260);
    });

    it('should track completion percentage', async () => {
      await achievementSystem.registerAgent('agent-1');

      const totalAchievements = await achievementSystem.getTotalAchievementCount();

      // Unlock 25% of achievements
      const toUnlock = Math.floor(totalAchievements * 0.25);
      for (let i = 0; i < toUnlock; i++) {
        await achievementSystem.unlockAchievement('agent-1', `ach-${i}`);
      }

      const stats = await achievementSystem.getAgentStats('agent-1');

      expect(stats.completionPercentage).toBeCloseTo(25, 1);
    });
  });

  // ===== MILESTONE SYSTEM TESTS =====
  describe('Milestone System', () => {
    beforeEach(async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();
      await achievementSystem.registerAgent('agent-1');
    });

    it('should track milestone progress', async () => {
      const milestoneId = 'task-milestone';

      // Complete tasks toward milestone
      for (let i = 0; i < 50; i++) {
        await achievementSystem.incrementMilestone('agent-1', milestoneId);
      }

      const milestone = await achievementSystem.getMilestoneProgress(
        'agent-1',
        milestoneId
      );

      expect(milestone).toMatchObject({
        current: 50,
        nextTarget: 100,
        tier: 1, // Completed first tier (50 tasks)
        rewards: expect.any(Array),
      });
    });

    it('should award tiered milestone rewards', async () => {
      const milestoneId = 'collection-milestone';

      // Reach first tier
      for (let i = 0; i < 10; i++) {
        await achievementSystem.incrementMilestone('agent-1', milestoneId);
      }

      let rewards = await achievementSystem.claimMilestoneRewards(
        'agent-1',
        milestoneId
      );

      expect(rewards.tier).toBe(1);
      expect(rewards.points).toBe(50);

      // Reach second tier
      for (let i = 0; i < 15; i++) {
        await achievementSystem.incrementMilestone('agent-1', milestoneId);
      }

      rewards = await achievementSystem.claimMilestoneRewards(
        'agent-1',
        milestoneId
      );

      expect(rewards.tier).toBe(2);
      expect(rewards.points).toBe(100);
    });
  });

  // ===== CHALLENGES SYSTEM TESTS =====
  describe('Challenges System', () => {
    beforeEach(async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();
    });

    describe('Daily Challenges', () => {
      it('should generate daily challenges', async () => {
        const challenges = await achievementSystem.getDailyChallenges();

        expect(challenges).toHaveLength(3);
        expect(challenges[0]).toMatchObject({
          id: expect.any(String),
          type: 'daily',
          description: expect.any(String),
          requirements: expect.any(Object),
          rewards: expect.any(Object),
          expiresAt: expect.any(Number),
        });
      });

      it('should track daily challenge progress', async () => {
        await achievementSystem.registerAgent('agent-1');

        const challenges = await achievementSystem.getDailyChallenges();
        const challenge = challenges[0];

        await achievementSystem.progressChallenge(
          'agent-1',
          challenge.id,
          { increment: 5 }
        );

        const progress = await achievementSystem.getChallengeProgress(
          'agent-1',
          challenge.id
        );

        expect(progress.current).toBe(5);
      });

      it('should reset daily challenges', async () => {
        jest.useFakeTimers();

        const day1Challenges = await achievementSystem.getDailyChallenges();

        // Advance to next day
        jest.advanceTimersByTime(24 * 60 * 60 * 1000);

        const day2Challenges = await achievementSystem.getDailyChallenges();

        expect(day1Challenges[0].id).not.toBe(day2Challenges[0].id);

        jest.useRealTimers();
      });
    });

    describe('Weekly Challenges', () => {
      it('should track weekly challenge streaks', async () => {
        await achievementSystem.registerAgent('agent-1');

        // Complete weekly challenges for multiple weeks
        for (let week = 0; week < 4; week++) {
          await achievementSystem.completeWeeklyChallenge('agent-1', `week-${week}`);
        }

        const streak = await achievementSystem.getWeeklyStreak('agent-1');

        expect(streak.current).toBe(4);
        expect(streak.rewards).toBeDefined();
      });
    });

    describe('Special Events', () => {
      it('should handle limited-time events', async () => {
        const event = await achievementSystem.createSpecialEvent({
          id: 'holiday-event',
          name: 'Holiday Special',
          startTime: Date.now(),
          endTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week
          achievements: ['event-ach-1', 'event-ach-2'],
          bonusMultiplier: 2.0,
        });

        expect(event.active).toBe(true);

        await achievementSystem.registerAgent('agent-1');
        await achievementSystem.unlockAchievement('agent-1', 'event-ach-1');

        const rewards = await achievementSystem.getEventRewards('agent-1', 'holiday-event');

        expect(rewards.multipliedPoints).toBeGreaterThan(0);
      });
    });
  });

  // ===== STATISTICS AND ANALYTICS TESTS =====
  describe('Statistics and Analytics', () => {
    beforeEach(async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();
    });

    it('should track achievement statistics', async () => {
      await achievementSystem.registerAgent('agent-1');

      // Unlock various achievements
      await achievementSystem.unlockAchievement('agent-1', 'common-1');
      await achievementSystem.unlockAchievement('agent-1', 'rare-1');
      await achievementSystem.unlockAchievement('agent-1', 'legendary-1');

      const stats = await achievementSystem.getStatistics('agent-1');

      expect(stats).toMatchObject({
        totalUnlocked: 3,
        byRarity: {
          common: 1,
          rare: 1,
          legendary: 1,
        },
        averageUnlockTime: expect.any(Number),
        favoriteCategory: expect.any(String),
      });
    });

    it('should generate achievement reports', async () => {
      const report = await achievementSystem.generateGlobalReport();

      expect(report).toMatchObject({
        totalAchievements: expect.any(Number),
        totalUnlocks: expect.any(Number),
        mostUnlocked: expect.any(Array),
        leastUnlocked: expect.any(Array),
        averageCompletion: expect.any(Number),
      });
    });

    it('should track achievement velocity', async () => {
      await achievementSystem.registerAgent('agent-1');

      // Unlock achievements over time
      const timestamps = [0, 1000, 3000, 6000, 10000];
      jest.useFakeTimers();

      for (let i = 0; i < timestamps.length; i++) {
        jest.advanceTimersByTime(timestamps[i]);
        await achievementSystem.unlockAchievement('agent-1', `ach-${i}`);
      }

      const velocity = await achievementSystem.getUnlockVelocity('agent-1');

      expect(velocity.rate).toBeGreaterThan(0);
      expect(velocity.trend).toBeDefined();

      jest.useRealTimers();
    });
  });

  // ===== PERSISTENCE AND RECOVERY TESTS =====
  describe('Persistence and Recovery', () => {
    it('should persist achievement progress', async () => {
      achievementSystem = new AchievementSystem({ persistProgress: true });
      await achievementSystem.initialize();
      await achievementSystem.registerAgent('agent-1');

      await achievementSystem.unlockAchievement('agent-1', 'persistent-ach');

      // Save state
      const state = await achievementSystem.saveState();

      // Create new instance and restore
      const newSystem = new AchievementSystem();
      await newSystem.restoreState(state);

      const achievements = await newSystem.getUnlockedAchievements('agent-1');
      expect(achievements).toContainEqual(
        expect.objectContaining({ id: 'persistent-ach' })
      );
    });

    it('should handle corruption recovery', async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();

      // Simulate corrupted data
      const corruptedState = {
        agents: { 'agent-1': 'invalid-data' },
        achievements: null,
      };

      await expect(
        achievementSystem.restoreState(corruptedState)
      ).rejects.toThrow('Corrupted state');

      // Should fall back to clean state
      const isHealthy = await achievementSystem.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  // ===== PERFORMANCE TESTS =====
  describe('Performance and Optimization', () => {
    it('should handle large number of achievements efficiently', async () => {
      achievementSystem = new AchievementSystem();

      // Add many custom achievements
      const achievements = Array(1000).fill().map((_, i) => ({
        id: `perf-ach-${i}`,
        name: `Achievement ${i}`,
        points: Math.floor(Math.random() * 100),
      }));

      await achievementSystem.bulkAddAchievements(achievements);

      const startTime = Date.now();
      const all = await achievementSystem.getAllAchievements();
      const loadTime = Date.now() - startTime;

      expect(all).toHaveLength(1000);
      expect(loadTime).toBeLessThan(100); // Should load in < 100ms
    });

    it('should optimize unlock checks', async () => {
      achievementSystem = new AchievementSystem();
      await achievementSystem.initialize();
      await achievementSystem.registerAgent('agent-1');

      // Track many events
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        await achievementSystem.trackEvent('agent-1', 'test-event', {
          value: i,
        });
      }

      const duration = Date.now() - startTime;
      const eventsPerSecond = 1000 / (duration / 1000);

      // Should process at least 100 events per second
      expect(eventsPerSecond).toBeGreaterThan(100);
    });
  });
});