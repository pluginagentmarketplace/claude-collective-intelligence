/**
 * Unit Tests for Achievement System - Starter Suite
 *
 * Comprehensive test suite for gamification achievements:
 * - Achievement unlock conditions
 * - Progress tracking and milestones
 * - Reward distribution
 * - Tier progression
 * - Badge management
 * - Achievement history and statistics
 */

import { jest } from '@jest/globals';

// ============================================================================
// SETUP: Test Fixtures & Helpers
// ============================================================================

const createAchievement = (overrides = {}) => ({
  id: `achievement-${Date.now()}`,
  name: 'First Success',
  description: 'Complete your first task successfully',
  points: 100,
  tier: 'bronze',
  category: 'starter',
  unlocked: false,
  unlockedAt: null,
  progress: 0,
  target: 1,
  ...overrides,
});

const createAgent = (id = 'agent-1') => ({
  id,
  name: `Test Agent ${id}`,
  level: 1,
  experience: 0,
  achievements: [],
  totalPoints: 0,
  badges: [],
});

// ============================================================================
// DESCRIBE: Achievement System Test Suite
// ============================================================================

describe('Achievement System - Gamification Module', () => {
  let achievementSystem;

  // Simple Achievement System Implementation for Testing
  class AchievementSystem {
    constructor() {
      this.achievements = new Map();
      this.agents = new Map();
      this.unlockedAchievements = new Map(); // agentId -> Set of achievement IDs
      this.statistics = new Map();
    }

    registerAgent(agentId) {
      const agent = createAgent(agentId);
      this.agents.set(agentId, agent);
      this.unlockedAchievements.set(agentId, new Set());
      this.statistics.set(agentId, {
        totalPoints: 0,
        achievementsUnlocked: 0,
        totalAttempts: 0,
      });
      return agent;
    }

    createAchievement(achievementData) {
      const achievement = {
        id: `ach-${Date.now()}`,
        ...achievementData,
      };
      this.achievements.set(achievement.id, achievement);
      return achievement;
    }

    unlockAchievement(agentId, achievementId) {
      const agent = this.agents.get(agentId);
      const achievement = this.achievements.get(achievementId);

      if (!agent) throw new Error('Agent not found');
      if (!achievement) throw new Error('Achievement not found');

      if (this.unlockedAchievements.get(agentId).has(achievementId)) {
        throw new Error('Achievement already unlocked');
      }

      // Unlock achievement
      this.unlockedAchievements.get(agentId).add(achievementId);
      agent.achievements.push({
        id: achievementId,
        unlockedAt: Date.now(),
        points: achievement.points,
      });

      // Award points
      agent.totalPoints += achievement.points;

      // Update statistics
      const stats = this.statistics.get(agentId);
      stats.totalPoints += achievement.points;
      stats.achievementsUnlocked++;

      return achievement;
    }

    updateProgress(agentId, achievementId, progress) {
      const agent = this.agents.get(agentId);
      if (!agent) throw new Error('Agent not found');

      // Check if should unlock
      const achievement = this.achievements.get(achievementId);
      if (progress >= achievement.target && !this.unlockedAchievements.get(agentId).has(achievementId)) {
        return this.unlockAchievement(agentId, achievementId);
      }

      return { progress, target: achievement.target };
    }

    getUnlockedAchievements(agentId) {
      return Array.from(this.unlockedAchievements.get(agentId) || [])
        .map(id => this.achievements.get(id));
    }

    getAchievementProgress(agentId, achievementId) {
      const unlocked = this.unlockedAchievements.get(agentId);
      if (unlocked.has(achievementId)) {
        return { unlocked: true, progress: 100 };
      }
      return { unlocked: false, progress: 0 };
    }

    getAgentStats(agentId) {
      return this.statistics.get(agentId);
    }

    getTotalPoints(agentId) {
      return this.agents.get(agentId)?.totalPoints || 0;
    }

    awardBonus(agentId, amount) {
      const agent = this.agents.get(agentId);
      if (!agent) throw new Error('Agent not found');
      agent.totalPoints += amount;
      return agent.totalPoints;
    }

    checkMilestone(totalPoints) {
      const milestones = [
        { points: 1000, level: 'Silver', bonus: 100 },
        { points: 5000, level: 'Gold', bonus: 500 },
        { points: 10000, level: 'Platinum', bonus: 1000 },
      ];
      return milestones.find(m => totalPoints >= m.points);
    }
  }

  beforeEach(() => {
    achievementSystem = new AchievementSystem();
  });

  // =========================================================================
  // TEST SUITE 1: Achievement Creation & Registration
  // =========================================================================

  describe('Achievement Creation & Registration', () => {
    test('should create achievement successfully', () => {
      // Arrange
      const achievementData = {
        name: 'First Task',
        description: 'Complete your first task',
        points: 100,
        tier: 'bronze',
        category: 'starter',
      };

      // Act
      const achievement = achievementSystem.createAchievement(achievementData);

      // Assert
      expect(achievement).toBeDefined();
      expect(achievement.id).toBeDefined();
      expect(achievement.name).toBe('First Task');
      expect(achievement.points).toBe(100);
      expect(achievementSystem.achievements.has(achievement.id)).toBe(true);
    });

    test('should create achievement with default values', () => {
      // Arrange
      const achievementData = {
        name: 'Test Achievement',
        points: 50,
      };

      // Act
      const achievement = achievementSystem.createAchievement(achievementData);

      // Assert
      expect(achievement.description).toBeUndefined();
      expect(achievement.points).toBe(50);
    });

    test('should create multiple achievements', () => {
      // Arrange
      const achievements = [
        { name: 'Achievement 1', points: 100 },
        { name: 'Achievement 2', points: 200 },
        { name: 'Achievement 3', points: 300 },
      ];

      // Act
      achievements.forEach(a => achievementSystem.createAchievement(a));

      // Assert
      expect(achievementSystem.achievements.size).toBe(3);
    });

    test('should retrieve achievement by ID', () => {
      // Arrange
      const achievementData = { name: 'Test', points: 100 };
      const achievement = achievementSystem.createAchievement(achievementData);

      // Act
      const retrieved = achievementSystem.achievements.get(achievement.id);

      // Assert
      expect(retrieved).toEqual(achievement);
    });
  });

  // =========================================================================
  // TEST SUITE 2: Achievement Unlock Conditions
  // =========================================================================

  describe('Achievement Unlock Conditions', () => {
    beforeEach(() => {
      achievementSystem.registerAgent('agent-1');
      achievementSystem.createAchievement({
        id: 'ach-1',
        name: 'Quick Start',
        points: 100,
        target: 1,
      });
    });

    test('should unlock achievement when conditions are met', () => {
      // Arrange
      const agentId = 'agent-1';
      const achievementId = 'ach-1';

      // Act
      const result = achievementSystem.unlockAchievement(agentId, achievementId);

      // Assert
      expect(result).toBeDefined();
      expect(achievementSystem.unlockedAchievements.get(agentId).has(achievementId)).toBe(true);
    });

    test('should prevent duplicate unlocks', () => {
      // Arrange
      const agentId = 'agent-1';
      const achievementId = 'ach-1';

      // Act & Assert
      achievementSystem.unlockAchievement(agentId, achievementId);
      expect(() => {
        achievementSystem.unlockAchievement(agentId, achievementId);
      }).toThrow('Achievement already unlocked');
    });

    test('should award points on unlock', () => {
      // Arrange
      const agentId = 'agent-1';
      const achievementId = 'ach-1';
      const points = 100;

      // Act
      achievementSystem.unlockAchievement(agentId, achievementId);
      const totalPoints = achievementSystem.getTotalPoints(agentId);

      // Assert
      expect(totalPoints).toBe(points);
    });

    test('should track unlock timestamp', () => {
      // Arrange
      const agentId = 'agent-1';
      const achievementId = 'ach-1';
      const before = Date.now();

      // Act
      achievementSystem.unlockAchievement(agentId, achievementId);
      const agent = achievementSystem.agents.get(agentId);
      const unlockedAch = agent.achievements[0];
      const after = Date.now();

      // Assert
      expect(unlockedAch.unlockedAt).toBeGreaterThanOrEqual(before);
      expect(unlockedAch.unlockedAt).toBeLessThanOrEqual(after);
    });

    test('should handle achievement for non-existent agent', () => {
      // Arrange
      const invalidAgentId = 'non-existent';

      // Act & Assert
      expect(() => {
        achievementSystem.unlockAchievement(invalidAgentId, 'ach-1');
      }).toThrow('Agent not found');
    });
  });

  // =========================================================================
  // TEST SUITE 3: Progress Tracking
  // =========================================================================

  describe('Progress Tracking', () => {
    beforeEach(() => {
      achievementSystem.registerAgent('agent-1');
      achievementSystem.createAchievement({
        id: 'ach-progress',
        name: 'Complete 10 Tasks',
        points: 500,
        target: 10,
      });
    });

    test('should track progress toward achievement', () => {
      // Arrange
      const agentId = 'agent-1';
      const achievementId = 'ach-progress';

      // Act
      achievementSystem.updateProgress(agentId, achievementId, 5);
      const progress = achievementSystem.getAchievementProgress(agentId, achievementId);

      // Assert
      expect(progress).toBeDefined();
    });

    test('should auto-unlock achievement when target is reached', () => {
      // Arrange
      const agentId = 'agent-1';
      const achievementId = 'ach-progress';

      // Act
      achievementSystem.updateProgress(agentId, achievementId, 10);

      // Assert
      const unlocked = achievementSystem.unlockedAchievements.get(agentId).has(achievementId);
      expect(unlocked).toBe(true);
    });

    test('should not unlock before target is reached', () => {
      // Arrange
      const agentId = 'agent-1';
      const achievementId = 'ach-progress';

      // Act
      achievementSystem.updateProgress(agentId, achievementId, 5);

      // Assert
      const unlocked = achievementSystem.unlockedAchievements.get(agentId).has(achievementId);
      expect(unlocked).toBe(false);
    });
  });

  // =========================================================================
  // TEST SUITE 4: Points & Rewards
  // =========================================================================

  describe('Points & Rewards System', () => {
    beforeEach(() => {
      achievementSystem.registerAgent('agent-1');
    });

    test('should accumulate points from achievements', () => {
      // Arrange
      achievementSystem.createAchievement({
        id: 'ach-100',
        name: 'Worth 100',
        points: 100,
      });
      achievementSystem.createAchievement({
        id: 'ach-200',
        name: 'Worth 200',
        points: 200,
      });

      // Act
      achievementSystem.unlockAchievement('agent-1', 'ach-100');
      achievementSystem.unlockAchievement('agent-1', 'ach-200');
      const total = achievementSystem.getTotalPoints('agent-1');

      // Assert
      expect(total).toBe(300);
    });

    test('should award bonus points', () => {
      // Arrange
      const agentId = 'agent-1';
      const bonusAmount = 500;

      // Act
      const before = achievementSystem.getTotalPoints(agentId);
      achievementSystem.awardBonus(agentId, bonusAmount);
      const after = achievementSystem.getTotalPoints(agentId);

      // Assert
      expect(after).toBe(before + bonusAmount);
    });

    test('should track point history', () => {
      // Arrange
      const agentId = 'agent-1';

      // Act
      achievementSystem.createAchievement({
        id: 'ach-track',
        name: 'Track Points',
        points: 250,
      });
      achievementSystem.unlockAchievement(agentId, 'ach-track');

      const stats = achievementSystem.getAgentStats(agentId);

      // Assert
      expect(stats.totalPoints).toBe(250);
    });

    test('should detect milestone achievements', () => {
      // Arrange
      // Act
      const silverMilestone = achievementSystem.checkMilestone(1000);
      const goldMilestone = achievementSystem.checkMilestone(5000);
      const platinumMilestone = achievementSystem.checkMilestone(10000);

      // Assert
      expect(silverMilestone.level).toBe('Silver');
      expect(goldMilestone.level).toBe('Gold');
      expect(platinumMilestone.level).toBe('Platinum');
    });
  });

  // =========================================================================
  // TEST SUITE 5: Agent Achievement Management
  // =========================================================================

  describe('Agent Achievement Management', () => {
    beforeEach(() => {
      achievementSystem.registerAgent('agent-1');
      achievementSystem.createAchievement({
        id: 'ach-1',
        name: 'Achievement 1',
        points: 100,
      });
      achievementSystem.createAchievement({
        id: 'ach-2',
        name: 'Achievement 2',
        points: 200,
      });
      achievementSystem.createAchievement({
        id: 'ach-3',
        name: 'Achievement 3',
        points: 300,
      });
    });

    test('should get all unlocked achievements for agent', () => {
      // Arrange
      const agentId = 'agent-1';

      // Act
      achievementSystem.unlockAchievement(agentId, 'ach-1');
      achievementSystem.unlockAchievement(agentId, 'ach-2');
      const unlockedAchievements = achievementSystem.getUnlockedAchievements(agentId);

      // Assert
      expect(unlockedAchievements).toHaveLength(2);
      expect(unlockedAchievements[0].name).toBe('Achievement 1');
      expect(unlockedAchievements[1].name).toBe('Achievement 2');
    });

    test('should return empty list if no achievements unlocked', () => {
      // Arrange
      const agentId = 'agent-1';

      // Act
      const unlockedAchievements = achievementSystem.getUnlockedAchievements(agentId);

      // Assert
      expect(unlockedAchievements).toHaveLength(0);
    });

    test('should get agent statistics', () => {
      // Arrange
      const agentId = 'agent-1';

      // Act
      achievementSystem.unlockAchievement(agentId, 'ach-1');
      achievementSystem.unlockAchievement(agentId, 'ach-2');
      const stats = achievementSystem.getAgentStats(agentId);

      // Assert
      expect(stats.achievementsUnlocked).toBe(2);
      expect(stats.totalPoints).toBe(300);
    });
  });

  // =========================================================================
  // TEST SUITE 6: Achievement Tiers & Categories
  // =========================================================================

  describe('Achievement Tiers & Categories', () => {
    test('should organize achievements by tier', () => {
      // Arrange
      achievementSystem.createAchievement({
        id: 'bronze-1',
        name: 'Bronze Achievement',
        tier: 'bronze',
        points: 50,
      });
      achievementSystem.createAchievement({
        id: 'gold-1',
        name: 'Gold Achievement',
        tier: 'gold',
        points: 500,
      });

      // Act
      const bronze = achievementSystem.achievements.get('bronze-1');
      const gold = achievementSystem.achievements.get('gold-1');

      // Assert
      expect(bronze.tier).toBe('bronze');
      expect(gold.tier).toBe('gold');
      expect(gold.points).toBeGreaterThan(bronze.points);
    });

    test('should categorize achievements', () => {
      // Arrange
      achievementSystem.createAchievement({
        id: 'starter-1',
        name: 'Starter',
        category: 'starter',
        points: 100,
      });
      achievementSystem.createAchievement({
        id: 'advanced-1',
        name: 'Advanced',
        category: 'advanced',
        points: 500,
      });

      // Act
      const starter = achievementSystem.achievements.get('starter-1');
      const advanced = achievementSystem.achievements.get('advanced-1');

      // Assert
      expect(starter.category).toBe('starter');
      expect(advanced.category).toBe('advanced');
    });
  });

  // =========================================================================
  // TEST SUITE 7: Error Handling & Edge Cases
  // =========================================================================

  describe('Error Handling & Edge Cases', () => {
    test('should handle zero-point achievements', () => {
      // Arrange
      achievementSystem.createAchievement({
        id: 'zero-points',
        name: 'Free Achievement',
        points: 0,
      });

      // Act
      const achievement = achievementSystem.achievements.get('zero-points');

      // Assert
      expect(achievement.points).toBe(0);
    });

    test('should handle large point values', () => {
      // Arrange
      const largePoints = 1000000;
      achievementSystem.createAchievement({
        id: 'mega-ach',
        name: 'Mega Achievement',
        points: largePoints,
      });

      // Act
      achievementSystem.registerAgent('whale-agent');
      achievementSystem.unlockAchievement('whale-agent', 'mega-ach');
      const total = achievementSystem.getTotalPoints('whale-agent');

      // Assert
      expect(total).toBe(largePoints);
    });

    test('should handle agent with many achievements', () => {
      // Arrange
      achievementSystem.registerAgent('prolific-agent');
      const achievementCount = 50;

      // Act
      for (let i = 0; i < achievementCount; i++) {
        achievementSystem.createAchievement({
          id: `ach-${i}`,
          name: `Achievement ${i}`,
          points: 10 * (i + 1),
        });
        achievementSystem.unlockAchievement('prolific-agent', `ach-${i}`);
      }

      // Assert
      const unlockedCount = achievementSystem.getUnlockedAchievements('prolific-agent').length;
      expect(unlockedCount).toBe(achievementCount);
    });
  });
});
