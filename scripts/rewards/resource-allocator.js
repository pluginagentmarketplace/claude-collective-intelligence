/**
 * Resource Allocator - Manages compute resources based on performance
 * Implements shaped difference rewards and hierarchical resource distribution
 */

import { EventEmitter } from 'events';

// Compute tier configurations
export const COMPUTE_TIERS = {
  BRONZE: {
    prefetchCount: 1,
    maxConcurrentTasks: 1,
    timeoutMultiplier: 1.0,
    messageRateLimit: 10,  // messages/second
    label: 'Bronze Tier',
    color: '#CD7F32'
  },
  SILVER: {
    prefetchCount: 3,
    maxConcurrentTasks: 3,
    timeoutMultiplier: 1.5,
    messageRateLimit: 25,
    label: 'Silver Tier',
    color: '#C0C0C0'
  },
  GOLD: {
    prefetchCount: 5,
    maxConcurrentTasks: 5,
    timeoutMultiplier: 2.0,
    messageRateLimit: 50,
    label: 'Gold Tier',
    color: '#FFD700'
  },
  PLATINUM: {
    prefetchCount: 10,
    maxConcurrentTasks: 10,
    timeoutMultiplier: 3.0,
    messageRateLimit: 100,
    label: 'Platinum Tier',
    color: '#E5E4E2'
  },
  DIAMOND: {
    prefetchCount: 20,
    maxConcurrentTasks: 20,
    timeoutMultiplier: 5.0,
    messageRateLimit: 200,
    label: 'Diamond Tier',
    color: '#B9F2FF'
  }
};

// Compute boost configurations
export const COMPUTE_BOOSTS = {
  STREAK_BONUS: {
    5: { prefetchCountBonus: 1, label: '5-Task Streak' },
    10: { prefetchCountBonus: 2, label: '10-Task Streak' },
    25: { prefetchCountBonus: 3, label: '25-Task Streak' },
    50: { prefetchCountBonus: 5, label: '50-Task Streak' },
    100: { prefetchCountBonus: 10, label: 'Century Streak' },
    250: { prefetchCountBonus: 15, label: 'Legendary Streak' },
    500: { prefetchCountBonus: 20, label: 'Mythic Streak' }
  },
  QUALITY_MULTIPLIER: {
    excellent: 1.5,  // 95%+ success rate
    good: 1.25,      // 85-94% success rate
    average: 1.0,    // 70-84% success rate
    poor: 0.75       // < 70% success rate
  },
  SPEED_BONUS: {
    blazing: { timeoutMultiplier: 2.0, label: 'Top 10% speed' },
    fast: { timeoutMultiplier: 1.5, label: 'Top 25% speed' },
    normal: { timeoutMultiplier: 1.0, label: 'Average speed' }
  }
};

// Compute sharing configuration
export const COMPUTE_SHARING = {
  TEAM_POOL: {
    enabled: true,
    sharePercentage: 10,  // 10% of compute donated to team pool
    distributionStrategy: 'needBased',  // or 'equalShare', 'meritBased'
    minContribution: 1
  },
  BORROWING: {
    enabled: true,
    maxBorrowRatio: 0.5,  // Can borrow up to 50% of base compute
    interestRate: 0.05,   // 5% task completion fee
    requireApproval: false
  }
};

/**
 * Resource Allocator Class
 */
export class ResourceAllocator extends EventEmitter {
  constructor(permissionManager) {
    super();
    this.permissionManager = permissionManager;

    this.globalPool = {
      totalCompute: 1000,
      available: 1000,
      reserved: 0,
      borrowed: 0
    };

    this.teamPool = {
      total: 0,
      available: 0,
      contributions: new Map()
    };

    this.agentAllocations = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Get base allocation for agent tier
   */
  getBaseAllocation(agentId) {
    const tier = this.permissionManager.getAgentTier(agentId);
    return COMPUTE_TIERS[tier];
  }

  /**
   * Calculate quality multiplier based on success rate
   */
  calculateQualityMultiplier(successRate) {
    if (successRate >= 0.95) return COMPUTE_BOOSTS.QUALITY_MULTIPLIER.excellent;
    if (successRate >= 0.85) return COMPUTE_BOOSTS.QUALITY_MULTIPLIER.good;
    if (successRate >= 0.70) return COMPUTE_BOOSTS.QUALITY_MULTIPLIER.average;
    return COMPUTE_BOOSTS.QUALITY_MULTIPLIER.poor;
  }

  /**
   * Calculate speed bonus based on completion time percentile
   */
  calculateSpeedBonus(avgCompletionTime, allAgentTimes = []) {
    if (allAgentTimes.length === 0) return 1.0;

    const sortedTimes = allAgentTimes.sort((a, b) => a - b);
    const percentile = sortedTimes.indexOf(avgCompletionTime) / sortedTimes.length;

    if (percentile <= 0.10) return COMPUTE_BOOSTS.SPEED_BONUS.blazing.timeoutMultiplier;
    if (percentile <= 0.25) return COMPUTE_BOOSTS.SPEED_BONUS.fast.timeoutMultiplier;
    return COMPUTE_BOOSTS.SPEED_BONUS.normal.timeoutMultiplier;
  }

  /**
   * Calculate streak bonus
   */
  calculateStreakBonus(currentStreak) {
    const streakBonuses = Object.entries(COMPUTE_BOOSTS.STREAK_BONUS)
      .sort(([a], [b]) => Number(b) - Number(a));

    for (const [threshold, bonus] of streakBonuses) {
      if (currentStreak >= Number(threshold)) {
        return bonus.prefetchCountBonus;
      }
    }

    return 0;
  }

  /**
   * Calculate team average contribution
   */
  calculateTeamAverage() {
    const metrics = Array.from(this.performanceMetrics.values());
    if (metrics.length === 0) return 0;

    const totalContribution = metrics.reduce((sum, m) => sum + (m.contribution || 0), 0);
    return totalContribution / metrics.length;
  }

  /**
   * Update agent performance metrics
   */
  updatePerformanceMetrics(agentId, metrics) {
    this.performanceMetrics.set(agentId, {
      ...this.performanceMetrics.get(agentId),
      ...metrics,
      lastUpdated: Date.now()
    });

    this.emit('metrics_updated', { agentId, metrics });
  }

  /**
   * Get agent performance metrics
   */
  getPerformanceMetrics(agentId) {
    return this.performanceMetrics.get(agentId) || {
      successRate: 0.8,
      avgCompletionTime: 1000,
      currentStreak: 0,
      contribution: 0,
      tasksCompleted: 0
    };
  }

  /**
   * Calculate agent's compute allocation based on performance
   * Uses shaped difference rewards methodology
   */
  calculateAllocation(agentId) {
    const baseConfig = this.getBaseAllocation(agentId);
    const baseAllocation = baseConfig.prefetchCount;
    const metrics = this.getPerformanceMetrics(agentId);

    // Performance factors
    const successRateBonus = this.calculateQualityMultiplier(metrics.successRate) - 1.0;
    const speedBonus = (metrics.speedMultiplier || 1.0) - 1.0;
    const streakBonus = this.calculateStreakBonus(metrics.currentStreak);

    // Shaped difference reward:
    // Agent's contribution minus team average
    const teamAverage = this.calculateTeamAverage();
    const differenceReward = (metrics.contribution || 0) - teamAverage;
    const shapedBonus = Math.max(0, differenceReward * 0.1);

    const totalAllocation = Math.floor(
      baseAllocation *
      (1 + successRateBonus + speedBonus) +
      streakBonus +
      shapedBonus
    );

    return {
      prefetchCount: Math.max(1, Math.min(totalAllocation, 50)),
      maxConcurrentTasks: Math.max(1, Math.min(totalAllocation, 50)),
      timeoutMultiplier: baseConfig.timeoutMultiplier * (metrics.speedMultiplier || 1.0),
      messageRateLimit: baseConfig.messageRateLimit,
      breakdown: {
        base: baseAllocation,
        successRateBonus,
        speedBonus,
        streakBonus,
        shapedBonus,
        total: totalAllocation
      }
    };
  }

  /**
   * Allocate resources to agent
   */
  async allocateResources(agentId, requestedCompute = null) {
    const currentAllocation = this.agentAllocations.get(agentId) || {
      allocated: 0,
      used: 0,
      borrowed: 0
    };

    const allocation = this.calculateAllocation(agentId);
    const maxAllocation = allocation.prefetchCount;

    // If no specific request, allocate max
    const requested = requestedCompute !== null ? requestedCompute : maxAllocation;

    // Check if within limits
    if (currentAllocation.allocated + requested <= maxAllocation) {
      currentAllocation.allocated = maxAllocation;
      this.agentAllocations.set(agentId, currentAllocation);

      this.emit('resources_allocated', {
        agentId,
        allocation: maxAllocation,
        breakdown: allocation.breakdown
      });

      return {
        success: true,
        allocated: maxAllocation,
        config: allocation
      };
    }

    // Try borrowing from team pool
    if (COMPUTE_SHARING.BORROWING.enabled) {
      const borrowAmount = Math.min(
        requested - maxAllocation,
        maxAllocation * COMPUTE_SHARING.BORROWING.maxBorrowRatio
      );

      if (this.teamPool.available >= borrowAmount) {
        currentAllocation.borrowed += borrowAmount;
        this.teamPool.available -= borrowAmount;
        this.agentAllocations.set(agentId, currentAllocation);

        this.emit('resources_borrowed', {
          agentId,
          borrowed: borrowAmount,
          interestDue: borrowAmount * COMPUTE_SHARING.BORROWING.interestRate
        });

        return {
          success: true,
          allocated: maxAllocation,
          borrowed: borrowAmount,
          interestDue: borrowAmount * COMPUTE_SHARING.BORROWING.interestRate,
          config: allocation
        };
      }
    }

    return {
      success: true,
      allocated: maxAllocation,
      config: allocation,
      reason: 'max_allocation_reached'
    };
  }

  /**
   * Contribute to team pool
   */
  async contributeToTeamPool(agentId, amount) {
    const allocation = this.agentAllocations.get(agentId);
    if (!allocation) {
      return { success: false, reason: 'no_allocation' };
    }

    if (amount < COMPUTE_SHARING.TEAM_POOL.minContribution) {
      return { success: false, reason: 'below_minimum' };
    }

    this.teamPool.total += amount;
    this.teamPool.available += amount;

    const contributions = this.teamPool.contributions.get(agentId) || 0;
    this.teamPool.contributions.set(agentId, contributions + amount);

    this.emit('team_contribution', {
      agentId,
      amount,
      totalContributed: contributions + amount
    });

    return { success: true, contributed: amount };
  }

  /**
   * Release agent resources
   */
  releaseResources(agentId) {
    const allocation = this.agentAllocations.get(agentId);
    if (!allocation) return;

    // Return borrowed resources to team pool
    if (allocation.borrowed > 0) {
      const interest = allocation.borrowed * COMPUTE_SHARING.BORROWING.interestRate;
      this.teamPool.available += allocation.borrowed;
      allocation.borrowed = 0;

      this.emit('resources_returned', {
        agentId,
        interest
      });
    }

    allocation.used = 0;
    this.agentAllocations.set(agentId, allocation);
  }

  /**
   * Get agent's current resource allocation
   */
  getAgentAllocation(agentId) {
    return this.agentAllocations.get(agentId) || null;
  }

  /**
   * Get all allocations
   */
  getAllAllocations() {
    const allocations = {};
    for (const [agentId, allocation] of this.agentAllocations) {
      allocations[agentId] = allocation;
    }
    return allocations;
  }

  /**
   * Get resource pool statistics
   */
  getPoolStats() {
    return {
      global: { ...this.globalPool },
      team: {
        total: this.teamPool.total,
        available: this.teamPool.available,
        contributors: this.teamPool.contributions.size
      }
    };
  }

  /**
   * Get timeout for agent based on tier and performance
   */
  getAgentTimeout(agentId, baseTimeout = 30000) {
    const allocation = this.calculateAllocation(agentId);
    return Math.floor(baseTimeout * allocation.timeoutMultiplier);
  }

  /**
   * Get message rate limit for agent
   */
  getMessageRateLimit(agentId) {
    const baseConfig = this.getBaseAllocation(agentId);
    return baseConfig.messageRateLimit;
  }
}

export default ResourceAllocator;
