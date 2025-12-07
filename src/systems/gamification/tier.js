#!/usr/bin/env node
/**
 * Tier System - Agent progression through 5 tiers based on performance
 * Bronze → Silver → Gold → Platinum → Diamond
 *
 * @module gamification/tier-system
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tier definitions with requirements and benefits
 */
export const TIERS = {
  BRONZE: {
    id: 'bronze',
    name: 'Bronze',
    level: 1,
    pointsRequired: 0,
    multiplier: 1.0,
    color: '#CD7F32',
    icon: '🥉',
    perks: [
      'Basic task access',
      'Standard queue priority',
      'Community support'
    ],
    description: 'Starting tier for new agents'
  },
  SILVER: {
    id: 'silver',
    name: 'Silver',
    level: 2,
    pointsRequired: 1000,
    multiplier: 1.1,
    color: '#C0C0C0',
    icon: '🥈',
    perks: [
      'All Bronze perks',
      '10% point bonus',
      'Priority support',
      'Access to team challenges'
    ],
    description: 'Proven competence and consistency',
    requirements: {
      totalPoints: 1000,
      tasksCompleted: 50,
      successRate: 70
    }
  },
  GOLD: {
    id: 'gold',
    name: 'Gold',
    level: 3,
    pointsRequired: 5000,
    multiplier: 1.25,
    color: '#FFD700',
    icon: '🥇',
    perks: [
      'All Silver perks',
      '25% point bonus',
      'Premium support',
      'Battle arena access',
      'Custom agent profile'
    ],
    description: 'Elite performance and leadership',
    requirements: {
      totalPoints: 5000,
      tasksCompleted: 200,
      successRate: 80,
      collaborations: 25
    }
  },
  PLATINUM: {
    id: 'platinum',
    name: 'Platinum',
    level: 4,
    pointsRequired: 15000,
    multiplier: 1.5,
    color: '#E5E4E2',
    icon: '💎',
    perks: [
      'All Gold perks',
      '50% point bonus',
      'VIP support',
      'Tournament access',
      'Mentorship opportunities',
      'Featured on leaderboards'
    ],
    description: 'Exceptional mastery and innovation',
    requirements: {
      totalPoints: 15000,
      tasksCompleted: 500,
      successRate: 85,
      collaborations: 100,
      innovationScore: 50
    }
  },
  DIAMOND: {
    id: 'diamond',
    name: 'Diamond',
    level: 5,
    pointsRequired: 50000,
    multiplier: 2.0,
    color: '#B9F2FF',
    icon: '💠',
    perks: [
      'All Platinum perks',
      '100% point bonus',
      'Legendary status',
      'Exclusive events',
      'Beta feature access',
      'Agent hall of fame',
      'Custom challenges'
    ],
    description: 'Legendary status - peak performance',
    requirements: {
      totalPoints: 50000,
      tasksCompleted: 1000,
      successRate: 90,
      collaborations: 250,
      innovationScore: 150,
      battlesWon: 100
    }
  }
};

/**
 * Get tier order for progression
 */
export const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];

/**
 * Tier System Manager - Handles tier progression and management
 */
export class TierSystem extends EventEmitter {
  constructor(rabbitMQClient, options = {}) {
    super();
    this.client = rabbitMQClient;
    this.exchange = options.exchange || 'gamification.tiers';
    this.tiers = TIERS;
  }

  /**
   * Initialize the tier system
   */
  async initialize() {
    if (!this.client || !this.client.channel) {
      throw new Error('RabbitMQ client not connected');
    }

    await this.client.channel.assertExchange(this.exchange, 'topic', { durable: true });
    console.log(`✅ Tier System initialized with exchange: ${this.exchange}`);
  }

  /**
   * Calculate appropriate tier based on agent stats
   * @param {Object} agent - Agent profile with stats and points
   * @returns {Object} Tier information
   */
  calculateTier(agent) {
    const stats = agent.stats || {};
    const points = agent.points || {};
    const reputation = agent.reputation || {};

    let qualifiedTier = TIERS.BRONZE;

    // Check each tier from highest to lowest
    for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
      const tierKey = TIER_ORDER[i];
      const tier = TIERS[tierKey];

      if (this.meetsRequirements(agent, tier)) {
        qualifiedTier = tier;
        break;
      }
    }

    return qualifiedTier;
  }

  /**
   * Check if agent meets tier requirements
   * @param {Object} agent - Agent profile
   * @param {Object} tier - Tier definition
   * @returns {boolean} True if requirements are met
   */
  meetsRequirements(agent, tier) {
    const requirements = tier.requirements || {};
    const stats = agent.stats || {};
    const points = agent.points || {};

    // Check total points
    if (requirements.totalPoints && (points.total || 0) < requirements.totalPoints) {
      return false;
    }

    // Check tasks completed
    if (requirements.tasksCompleted && (stats.tasksCompleted || 0) < requirements.tasksCompleted) {
      return false;
    }

    // Check success rate
    if (requirements.successRate && (stats.successRate || 0) < requirements.successRate) {
      return false;
    }

    // Check collaborations
    if (requirements.collaborations && (stats.collaborationsCompleted || 0) < requirements.collaborations) {
      return false;
    }

    // Check innovation score
    if (requirements.innovationScore && (points.innovation || 0) < requirements.innovationScore) {
      return false;
    }

    // Check battles won
    if (requirements.battlesWon && (stats.battlesWon || 0) < requirements.battlesWon) {
      return false;
    }

    return true;
  }

  /**
   * Get progress towards next tier
   * @param {Object} agent - Agent profile
   * @returns {Object} Progress information
   */
  getProgressToNextTier(agent) {
    const currentTier = this.calculateTier(agent);
    const currentIndex = TIER_ORDER.indexOf(currentTier.id.toUpperCase());

    // Already at max tier
    if (currentIndex === TIER_ORDER.length - 1) {
      return {
        currentTier,
        nextTier: null,
        progress: 100,
        requirements: {},
        message: 'Maximum tier reached!'
      };
    }

    const nextTierKey = TIER_ORDER[currentIndex + 1];
    const nextTier = TIERS[nextTierKey];
    const requirements = nextTier.requirements || {};

    const stats = agent.stats || {};
    const points = agent.points || {};

    // Calculate progress for each requirement
    const progressDetails = {};
    let totalProgress = 0;
    let requirementCount = 0;

    if (requirements.totalPoints) {
      const current = points.total || 0;
      const required = requirements.totalPoints;
      progressDetails.totalPoints = {
        current,
        required,
        progress: Math.min((current / required) * 100, 100)
      };
      totalProgress += progressDetails.totalPoints.progress;
      requirementCount++;
    }

    if (requirements.tasksCompleted) {
      const current = stats.tasksCompleted || 0;
      const required = requirements.tasksCompleted;
      progressDetails.tasksCompleted = {
        current,
        required,
        progress: Math.min((current / required) * 100, 100)
      };
      totalProgress += progressDetails.tasksCompleted.progress;
      requirementCount++;
    }

    if (requirements.successRate) {
      const current = stats.successRate || 0;
      const required = requirements.successRate;
      progressDetails.successRate = {
        current,
        required,
        progress: Math.min((current / required) * 100, 100)
      };
      totalProgress += progressDetails.successRate.progress;
      requirementCount++;
    }

    if (requirements.collaborations) {
      const current = stats.collaborationsCompleted || 0;
      const required = requirements.collaborations;
      progressDetails.collaborations = {
        current,
        required,
        progress: Math.min((current / required) * 100, 100)
      };
      totalProgress += progressDetails.collaborations.progress;
      requirementCount++;
    }

    if (requirements.innovationScore) {
      const current = points.innovation || 0;
      const required = requirements.innovationScore;
      progressDetails.innovationScore = {
        current,
        required,
        progress: Math.min((current / required) * 100, 100)
      };
      totalProgress += progressDetails.innovationScore.progress;
      requirementCount++;
    }

    if (requirements.battlesWon) {
      const current = stats.battlesWon || 0;
      const required = requirements.battlesWon;
      progressDetails.battlesWon = {
        current,
        required,
        progress: Math.min((current / required) * 100, 100)
      };
      totalProgress += progressDetails.battlesWon.progress;
      requirementCount++;
    }

    const averageProgress = requirementCount > 0 ? totalProgress / requirementCount : 0;

    return {
      currentTier,
      nextTier,
      progress: Math.round(averageProgress),
      requirements: progressDetails,
      message: `${Math.round(averageProgress)}% towards ${nextTier.name}`
    };
  }

  /**
   * Update agent tier if they've qualified for promotion
   * @param {Object} agent - Agent profile
   * @returns {Object} Update result with promotion info
   */
  async updateAgentTier(agent) {
    const currentTierName = agent.tier || 'bronze';
    const newTier = this.calculateTier(agent);

    const oldTierLevel = TIERS[currentTierName.toUpperCase()]?.level || 1;
    const newTierLevel = newTier.level;

    // Check if promoted
    if (newTierLevel > oldTierLevel) {
      const promotionEvent = {
        eventId: uuidv4(),
        agentId: agent.id,
        agentName: agent.name,
        oldTier: currentTierName,
        newTier: newTier.id,
        timestamp: Date.now(),
        perks: newTier.perks,
        multiplier: newTier.multiplier
      };

      // Publish promotion event to RabbitMQ
      await this.client.channel.publish(
        this.exchange,
        `tier.promoted.${newTier.id}`,
        Buffer.from(JSON.stringify(promotionEvent)),
        { persistent: true }
      );

      this.emit('tier_promoted', promotionEvent);

      return {
        promoted: true,
        oldTier: currentTierName,
        newTier: newTier.id,
        event: promotionEvent
      };
    }

    // Check if demoted (optional - can disable demotion)
    if (newTierLevel < oldTierLevel) {
      const demotionEvent = {
        eventId: uuidv4(),
        agentId: agent.id,
        agentName: agent.name,
        oldTier: currentTierName,
        newTier: newTier.id,
        timestamp: Date.now()
      };

      await this.client.channel.publish(
        this.exchange,
        `tier.demoted.${newTier.id}`,
        Buffer.from(JSON.stringify(demotionEvent)),
        { persistent: true }
      );

      this.emit('tier_demoted', demotionEvent);

      return {
        demoted: true,
        oldTier: currentTierName,
        newTier: newTier.id,
        event: demotionEvent
      };
    }

    return {
      promoted: false,
      demoted: false,
      currentTier: newTier.id
    };
  }

  /**
   * Get tier by name or level
   * @param {string|number} tierIdentifier - Tier name or level
   * @returns {Object} Tier definition
   */
  getTier(tierIdentifier) {
    if (typeof tierIdentifier === 'number') {
      // Get by level
      return Object.values(TIERS).find(tier => tier.level === tierIdentifier);
    }

    // Get by name
    const tierKey = tierIdentifier.toUpperCase();
    return TIERS[tierKey] || TIERS.BRONZE;
  }

  /**
   * Get all tiers in order
   * @returns {Array} Array of tier objects
   */
  getAllTiers() {
    return TIER_ORDER.map(key => TIERS[key]);
  }

  /**
   * Get tier statistics for analytics
   * @param {Array} agents - Array of agent profiles
   * @returns {Object} Tier distribution statistics
   */
  getTierStatistics(agents) {
    const distribution = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
      diamond: 0
    };

    agents.forEach(agent => {
      const tier = this.calculateTier(agent);
      distribution[tier.id] = (distribution[tier.id] || 0) + 1;
    });

    const total = agents.length;
    const percentages = {};
    Object.keys(distribution).forEach(tier => {
      percentages[tier] = total > 0 ? (distribution[tier] / total) * 100 : 0;
    });

    return {
      total,
      distribution,
      percentages,
      averageLevel: this.calculateAverageLevel(agents)
    };
  }

  /**
   * Calculate average tier level across agents
   * @param {Array} agents - Array of agent profiles
   * @returns {number} Average tier level
   */
  calculateAverageLevel(agents) {
    if (agents.length === 0) return 1;

    const totalLevel = agents.reduce((sum, agent) => {
      const tier = this.calculateTier(agent);
      return sum + tier.level;
    }, 0);

    return totalLevel / agents.length;
  }

  /**
   * Check if agent is eligible for tier benefits
   * @param {Object} agent - Agent profile
   * @param {string} benefit - Benefit to check
   * @returns {boolean} True if eligible
   */
  hasBenefit(agent, benefit) {
    const tier = this.calculateTier(agent);
    return tier.perks.some(perk =>
      perk.toLowerCase().includes(benefit.toLowerCase())
    );
  }

  /**
   * Close the tier system
   */
  async close() {
    console.log('🔌 Tier System shutting down');
  }
}

export default TierSystem;
