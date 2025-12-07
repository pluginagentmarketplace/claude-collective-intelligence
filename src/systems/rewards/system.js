/**
 * Rewards System - Main implementation
 * Handles points, achievements, streaks, and tier progression
 */

import { EventEmitter } from 'events';
import { PermissionManager, PERMISSION_TIERS } from './rewards/permission-manager.js';
import { ResourceAllocator, COMPUTE_TIERS } from './rewards/resource-allocator.js';

// Priority levels for tasks
export const PRIORITY_LEVELS = {
  CRITICAL: {
    value: 5,
    weight: 1000,
    ttl: 300000,      // 5 minutes
    retries: 5,
    pointReward: 500,
    requiredTier: 'SILVER',
    label: 'Critical Priority',
    icon: '🔥'
  },
  HIGH: {
    value: 4,
    weight: 100,
    ttl: 1800000,     // 30 minutes
    retries: 3,
    pointReward: 200,
    requiredTier: 'BRONZE',
    label: 'High Priority',
    icon: '⚡'
  },
  NORMAL: {
    value: 3,
    weight: 10,
    ttl: 3600000,     // 1 hour
    retries: 2,
    pointReward: 100,
    requiredTier: 'BRONZE',
    label: 'Normal Priority',
    icon: '📋'
  },
  LOW: {
    value: 2,
    weight: 5,
    ttl: 7200000,     // 2 hours
    retries: 1,
    pointReward: 50,
    requiredTier: 'BRONZE',
    label: 'Low Priority',
    icon: '📝'
  },
  BACKGROUND: {
    value: 1,
    weight: 1,
    ttl: 86400000,    // 24 hours
    retries: 0,
    pointReward: 25,
    requiredTier: 'BRONZE',
    label: 'Background',
    icon: '⏳'
  }
};

// Point awards configuration
export const POINT_AWARDS = {
  TASK_COMPLETION: {
    base: 100,
    multipliers: {
      priority: {
        CRITICAL: 5.0,
        HIGH: 2.0,
        NORMAL: 1.0,
        LOW: 0.5,
        BACKGROUND: 0.25
      },
      quality: {
        perfect: 2.0,      // 100% success, no retries
        excellent: 1.5,    // 95%+ success
        good: 1.0,         // 80%+ success
        acceptable: 0.7,   // 70%+ success
        poor: 0.3          // < 70% success
      },
      speed: {
        blazing: 1.5,      // Top 10%
        fast: 1.25,        // Top 25%
        average: 1.0,      // Top 50%
        slow: 0.75         // Bottom 50%
      }
    }
  },
  BRAINSTORM_PARTICIPATION: 50,
  BRAINSTORM_INITIATION: 100,
  BRAINSTORM_BEST_SOLUTION: 200,
  HELP_ANOTHER_AGENT: 75,
  FIRST_TASK_OF_DAY: 25,
  UPTIME_HOUR: 10,
  BUG_REPORT: 150,
  IMPROVEMENT_SUGGESTION: 100
};

// Achievements catalog
export const ACHIEVEMENTS = {
  // Beginner Achievements
  FIRST_TASK: {
    id: 'first_task',
    name: 'First Steps',
    description: 'Complete your first task',
    points: 100,
    icon: '🎯',
    tier: 'BRONZE'
  },
  TEAM_PLAYER: {
    id: 'team_player',
    name: 'Team Player',
    description: 'Participate in 5 brainstorm sessions',
    points: 250,
    icon: '🤝',
    tier: 'BRONZE'
  },

  // Intermediate Achievements
  RELIABLE_AGENT: {
    id: 'reliable_agent',
    name: 'Reliable Agent',
    description: 'Achieve 90% success rate over 50 tasks',
    points: 500,
    icon: '✅',
    tier: 'SILVER'
  },
  SPEED_DEMON: {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Complete 10 tasks in top 10% speed',
    points: 750,
    icon: '⚡',
    tier: 'SILVER'
  },
  COLLABORATOR: {
    id: 'collaborator',
    name: 'Collaborator',
    description: 'Initiate 10 brainstorm sessions',
    points: 600,
    icon: '🧠',
    tier: 'SILVER'
  },

  // Advanced Achievements
  MASTER_AGENT: {
    id: 'master_agent',
    name: 'Master Agent',
    description: 'Complete 500 tasks with 85%+ success rate',
    points: 2000,
    icon: '🏆',
    tier: 'GOLD'
  },
  PERFECTIONIST: {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete 100 tasks with 100% success rate',
    points: 3000,
    icon: '💎',
    tier: 'GOLD'
  },
  MENTOR: {
    id: 'mentor',
    name: 'Mentor',
    description: 'Help 25 other agents complete tasks',
    points: 1500,
    icon: '👨‍🏫',
    tier: 'GOLD'
  },
  MARATHON_RUNNER: {
    id: 'marathon_runner',
    name: 'Marathon Runner',
    description: 'Maintain 24 hours continuous uptime',
    points: 2500,
    icon: '🏃',
    tier: 'GOLD'
  },

  // Elite Achievements
  LEGENDARY: {
    id: 'legendary',
    name: 'Legendary Agent',
    description: 'Complete 5000 tasks with 90%+ success rate',
    points: 10000,
    icon: '👑',
    tier: 'PLATINUM'
  },
  VISIONARY: {
    id: 'visionary',
    name: 'Visionary',
    description: 'Initiate 100 successful brainstorm sessions',
    points: 8000,
    icon: '🔮',
    tier: 'PLATINUM'
  },
  GUARDIAN: {
    id: 'guardian',
    name: 'Guardian',
    description: 'Prevent 50 task failures through assistance',
    points: 7500,
    icon: '🛡️',
    tier: 'PLATINUM'
  },
  ARCHITECT: {
    id: 'architect',
    name: 'Architect',
    description: 'Design and execute 50 complex workflows',
    points: 9000,
    icon: '🏗️',
    tier: 'PLATINUM'
  }
};

// Streak system configuration
export const STREAK_SYSTEM = {
  MULTIPLIERS: {
    5: 1.1,    // +10%
    10: 1.25,  // +25%
    25: 1.5,   // +50%
    50: 2.0,   // +100%
    100: 3.0,  // +200%
    250: 5.0,  // +400%
    500: 10.0  // +900%
  },
  STREAK_PROTECTION: {
    enabled: true,
    freeFailures: {
      BRONZE: 0,
      SILVER: 1,
      GOLD: 2,
      PLATINUM: 3,
      DIAMOND: 5
    },
    resetGracePeriod: 3600000  // 1 hour
  },
  STREAK_ACHIEVEMENTS: {
    10: { badge: 'hot_streak', points: 200 },
    25: { badge: 'on_fire', points: 500 },
    50: { badge: 'unstoppable', points: 1000 },
    100: { badge: 'legendary_streak', points: 5000 }
  }
};

/**
 * Rewards System Main Class
 */
export class RewardsSystem extends EventEmitter {
  constructor() {
    super();

    this.permissionManager = new PermissionManager();
    this.resourceAllocator = new ResourceAllocator(this.permissionManager);

    this.agentStats = new Map();
    this.streakData = new Map();
    this.taskHistory = new Map();

    // Forward events
    this.permissionManager.on('tier_upgraded', (data) => this.emit('tier_upgraded', data));
    this.permissionManager.on('points_awarded', (data) => this.emit('points_awarded', data));
    this.permissionManager.on('achievement_unlocked', (data) => this.emit('achievement_unlocked', data));
    this.resourceAllocator.on('resources_allocated', (data) => this.emit('resources_allocated', data));
  }

  /**
   * Initialize agent in rewards system
   */
  initializeAgent(agentId) {
    this.permissionManager.initializeAgent(agentId);

    this.agentStats.set(agentId, {
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksReceived: 0,
      brainstormsParticipated: 0,
      brainstormsInitiated: 0,
      agentsHelped: 0,
      uptime: 0,
      startTime: Date.now()
    });

    this.streakData.set(agentId, {
      currentStreak: 0,
      longestStreak: 0,
      lastSuccess: null,
      freeFailuresUsed: 0
    });

    this.taskHistory.set(agentId, []);

    return {
      tier: 'BRONZE',
      points: 0,
      resources: this.resourceAllocator.calculateAllocation(agentId)
    };
  }

  /**
   * Calculate quality multiplier
   */
  calculateQualityMultiplier(result) {
    const quality = result.quality || result.qualityScore || 0.8;

    if (quality >= 1.0 && !result.retries) {
      return POINT_AWARDS.TASK_COMPLETION.multipliers.quality.perfect;
    }
    if (quality >= 0.95) {
      return POINT_AWARDS.TASK_COMPLETION.multipliers.quality.excellent;
    }
    if (quality >= 0.80) {
      return POINT_AWARDS.TASK_COMPLETION.multipliers.quality.good;
    }
    if (quality >= 0.70) {
      return POINT_AWARDS.TASK_COMPLETION.multipliers.quality.acceptable;
    }
    return POINT_AWARDS.TASK_COMPLETION.multipliers.quality.poor;
  }

  /**
   * Calculate speed multiplier
   */
  calculateSpeedMultiplier(task, result) {
    const duration = result.duration || 1000;
    const expected = task.expectedDuration || 5000;
    const ratio = duration / expected;

    if (ratio <= 0.5) {
      return POINT_AWARDS.TASK_COMPLETION.multipliers.speed.blazing;
    }
    if (ratio <= 0.75) {
      return POINT_AWARDS.TASK_COMPLETION.multipliers.speed.fast;
    }
    if (ratio <= 1.0) {
      return POINT_AWARDS.TASK_COMPLETION.multipliers.speed.average;
    }
    return POINT_AWARDS.TASK_COMPLETION.multipliers.speed.slow;
  }

  /**
   * Calculate complexity bonus
   */
  calculateComplexityBonus(task) {
    const complexity = task.complexity || 1;
    return Math.max(1.0, complexity * 0.5);
  }

  /**
   * Get current streak multiplier
   */
  getStreakMultiplier(agentId) {
    const streak = this.streakData.get(agentId);
    if (!streak) return 1.0;

    const streakMultipliers = Object.entries(STREAK_SYSTEM.MULTIPLIERS)
      .sort(([a], [b]) => Number(b) - Number(a));

    for (const [threshold, multiplier] of streakMultipliers) {
      if (streak.currentStreak >= Number(threshold)) {
        return multiplier;
      }
    }

    return 1.0;
  }

  /**
   * Calculate task points
   */
  calculateTaskPoints(agentId, task, result) {
    const basePoints = POINT_AWARDS.TASK_COMPLETION.base;
    const priority = task.priority || 'NORMAL';

    const priorityMultiplier =
      POINT_AWARDS.TASK_COMPLETION.multipliers.priority[priority] || 1.0;

    const qualityMultiplier = this.calculateQualityMultiplier(result);
    const speedMultiplier = this.calculateSpeedMultiplier(task, result);
    const complexityBonus = this.calculateComplexityBonus(task);
    const collaborationBonus = task.collaboration ? 1.5 : 1.0;
    const streakMultiplier = this.getStreakMultiplier(agentId);

    const totalPoints = Math.floor(
      basePoints *
      priorityMultiplier *
      qualityMultiplier *
      speedMultiplier *
      complexityBonus *
      collaborationBonus *
      streakMultiplier
    );

    return {
      points: totalPoints,
      breakdown: {
        base: basePoints,
        priority: priorityMultiplier,
        quality: qualityMultiplier,
        speed: speedMultiplier,
        complexity: complexityBonus,
        collaboration: collaborationBonus,
        streak: streakMultiplier
      }
    };
  }

  /**
   * Award points for task completion
   */
  async awardTaskPoints(agentId, task, result) {
    const pointResult = this.calculateTaskPoints(agentId, task, result);

    await this.permissionManager.awardPoints(
      agentId,
      pointResult.points,
      'task_completion'
    );

    // Update stats
    const stats = this.agentStats.get(agentId);
    if (stats) {
      stats.tasksCompleted++;
      this.agentStats.set(agentId, stats);
    }

    // Update streak
    await this.updateStreak(agentId, true);

    // Update resource allocator metrics
    const metrics = this.getAgentMetrics(agentId);
    this.resourceAllocator.updatePerformanceMetrics(agentId, {
      successRate: metrics.successRate,
      avgCompletionTime: result.duration || 1000,
      currentStreak: this.streakData.get(agentId).currentStreak,
      contribution: stats.tasksCompleted,
      tasksCompleted: stats.tasksCompleted
    });

    return pointResult;
  }

  /**
   * Update agent streak
   */
  async updateStreak(agentId, success) {
    const streak = this.streakData.get(agentId);
    if (!streak) return;

    if (success) {
      streak.currentStreak++;
      streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
      streak.lastSuccess = Date.now();

      // Check for streak achievements
      const achievement = STREAK_SYSTEM.STREAK_ACHIEVEMENTS[streak.currentStreak];
      if (achievement) {
        await this.permissionManager.awardAchievement(agentId, achievement.badge);
        await this.permissionManager.awardPoints(agentId, achievement.points, 'streak_achievement');
      }
    } else {
      // Check for streak protection
      const tier = this.permissionManager.getAgentTier(agentId);
      const freeFailures = STREAK_SYSTEM.STREAK_PROTECTION.freeFailures[tier];

      if (streak.freeFailuresUsed < freeFailures) {
        streak.freeFailuresUsed++;
        this.emit('streak_protected', { agentId, failuresRemaining: freeFailures - streak.freeFailuresUsed });
      } else {
        // Reset streak
        const oldStreak = streak.currentStreak;
        streak.currentStreak = 0;
        streak.freeFailuresUsed = 0;
        this.emit('streak_broken', { agentId, oldStreak });
      }
    }

    this.streakData.set(agentId, streak);
  }

  /**
   * Record task failure
   */
  async recordTaskFailure(agentId) {
    const stats = this.agentStats.get(agentId);
    if (stats) {
      stats.tasksFailed++;
      this.agentStats.set(agentId, stats);
    }

    await this.updateStreak(agentId, false);
  }

  /**
   * Get agent metrics
   */
  getAgentMetrics(agentId) {
    const stats = this.agentStats.get(agentId);
    if (!stats) {
      return {
        tasksCompleted: 0,
        successRate: 0,
        brainstormsParticipated: 0,
        brainstormsInitiated: 0,
        uptime: 0,
        agentsHelped: 0
      };
    }

    const total = stats.tasksCompleted + stats.tasksFailed;
    const successRate = total > 0 ? stats.tasksCompleted / total : 0;
    const uptime = Date.now() - stats.startTime;

    return {
      tasksCompleted: stats.tasksCompleted,
      successRate,
      brainstormsParticipated: stats.brainstormsParticipated,
      brainstormsInitiated: stats.brainstormsInitiated,
      uptime,
      agentsHelped: stats.agentsHelped
    };
  }

  /**
   * Check for tier upgrade
   */
  async checkTierUpgrade(agentId) {
    const metrics = this.getAgentMetrics(agentId);
    return await this.permissionManager.checkTierUpgrade(agentId, metrics);
  }

  /**
   * Check achievements
   */
  async checkAchievements(agentId) {
    const stats = this.agentStats.get(agentId);
    const metrics = this.getAgentMetrics(agentId);
    const unlocked = [];

    // Check first task
    if (stats.tasksCompleted === 1) {
      const result = await this.permissionManager.awardAchievement(agentId, 'first_task');
      if (result.success) {
        await this.permissionManager.awardPoints(agentId, ACHIEVEMENTS.FIRST_TASK.points, 'achievement');
        unlocked.push(ACHIEVEMENTS.FIRST_TASK);
      }
    }

    // Check team player
    if (stats.brainstormsParticipated === 5) {
      const result = await this.permissionManager.awardAchievement(agentId, 'team_player');
      if (result.success) {
        await this.permissionManager.awardPoints(agentId, ACHIEVEMENTS.TEAM_PLAYER.points, 'achievement');
        unlocked.push(ACHIEVEMENTS.TEAM_PLAYER);
      }
    }

    // Check reliable agent
    if (stats.tasksCompleted >= 50 && metrics.successRate >= 0.90) {
      const result = await this.permissionManager.awardAchievement(agentId, 'reliable_agent');
      if (result.success) {
        await this.permissionManager.awardPoints(agentId, ACHIEVEMENTS.RELIABLE_AGENT.points, 'achievement');
        unlocked.push(ACHIEVEMENTS.RELIABLE_AGENT);
      }
    }

    // Check collaborator
    if (stats.brainstormsInitiated >= 10) {
      const result = await this.permissionManager.awardAchievement(agentId, 'collaborator');
      if (result.success) {
        await this.permissionManager.awardPoints(agentId, ACHIEVEMENTS.COLLABORATOR.points, 'achievement');
        unlocked.push(ACHIEVEMENTS.COLLABORATOR);
      }
    }

    // Check master agent
    if (stats.tasksCompleted >= 500 && metrics.successRate >= 0.85) {
      const result = await this.permissionManager.awardAchievement(agentId, 'master_agent');
      if (result.success) {
        await this.permissionManager.awardPoints(agentId, ACHIEVEMENTS.MASTER_AGENT.points, 'achievement');
        unlocked.push(ACHIEVEMENTS.MASTER_AGENT);
      }
    }

    // Check mentor
    if (stats.agentsHelped >= 25) {
      const result = await this.permissionManager.awardAchievement(agentId, 'mentor');
      if (result.success) {
        await this.permissionManager.awardPoints(agentId, ACHIEVEMENTS.MENTOR.points, 'achievement');
        unlocked.push(ACHIEVEMENTS.MENTOR);
      }
    }

    return unlocked;
  }

  /**
   * Award brainstorm points
   */
  async awardBrainstormPoints(agentId, isInitiator = false, isBestSolution = false) {
    let points = POINT_AWARDS.BRAINSTORM_PARTICIPATION;

    if (isInitiator) {
      points = POINT_AWARDS.BRAINSTORM_INITIATION;
    }
    if (isBestSolution) {
      points += POINT_AWARDS.BRAINSTORM_BEST_SOLUTION;
    }

    await this.permissionManager.awardPoints(agentId, points, 'brainstorm');

    const stats = this.agentStats.get(agentId);
    if (stats) {
      if (isInitiator) {
        stats.brainstormsInitiated++;
      }
      stats.brainstormsParticipated++;
      this.agentStats.set(agentId, stats);
    }

    return points;
  }

  /**
   * Get agent's full status
   */
  getAgentStatus(agentId) {
    const permissions = this.permissionManager.getAgentPermissions(agentId);
    const stats = this.agentStats.get(agentId);
    const streak = this.streakData.get(agentId);
    const allocation = this.resourceAllocator.calculateAllocation(agentId);
    const metrics = this.getAgentMetrics(agentId);

    return {
      agentId,
      tier: permissions?.tier || 'BRONZE',
      level: permissions?.level || 1,
      points: permissions?.points || 0,
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      stats: stats || {},
      metrics,
      allocation,
      capabilities: permissions?.capabilities || [],
      specialAbilities: permissions?.specialAbilities || []
    };
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(limit = 10) {
    const agents = [];

    for (const [agentId, permissions] of this.permissionManager.agentPermissions) {
      const stats = this.agentStats.get(agentId);
      const metrics = this.getAgentMetrics(agentId);

      agents.push({
        agentId,
        tier: permissions.tier,
        points: permissions.points,
        tasksCompleted: stats?.tasksCompleted || 0,
        successRate: metrics.successRate
      });
    }

    agents.sort((a, b) => b.points - a.points);

    return agents.slice(0, limit);
  }
}

export default RewardsSystem;
