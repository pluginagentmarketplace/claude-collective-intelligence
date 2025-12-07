#!/usr/bin/env node
/**
 * Points Engine - Multi-dimensional Gamification Points System
 * Calculates and awards points across 5 dimensions with dynamic multipliers
 *
 * @module gamification/points-engine
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Point categories with weights and calculation formulas
 */
export const POINT_CATEGORIES = {
  SPEED: {
    weight: 1.0,
    description: 'Task completion speed',
    basePoints: 50
  },
  QUALITY: {
    weight: 1.5,
    description: 'Output quality score',
    basePoints: 50
  },
  COLLABORATION: {
    weight: 1.2,
    description: 'Team participation',
    basePoints: 30
  },
  INNOVATION: {
    weight: 2.0,
    description: 'Novel solutions',
    basePoints: 75
  },
  RELIABILITY: {
    weight: 1.3,
    description: 'Consistency & uptime',
    basePoints: 20
  }
};

/**
 * Global multipliers for various conditions
 */
export const GLOBAL_MULTIPLIERS = {
  // Time-based multipliers
  WEEKEND_BONUS: 1.2,
  NIGHT_OWL_BONUS: 1.15,      // 10pm - 6am
  EARLY_BIRD_BONUS: 1.1,      // 5am - 8am

  // Priority multipliers
  CRITICAL_TASK: 2.0,
  HIGH_PRIORITY: 1.5,
  NORMAL_PRIORITY: 1.0,
  LOW_PRIORITY: 0.8,

  // Streak multipliers
  STREAK_3_DAYS: 1.1,
  STREAK_7_DAYS: 1.25,
  STREAK_30_DAYS: 1.5,
  STREAK_100_DAYS: 2.0,

  // Combo multipliers (multiple actions in sequence)
  COMBO_2X: 1.2,
  COMBO_3X: 1.5,
  COMBO_5X: 2.0,
  COMBO_10X: 3.0,

  // Tier multipliers
  BRONZE: 1.0,
  SILVER: 1.1,
  GOLD: 1.25,
  PLATINUM: 1.5,
  DIAMOND: 2.0
};

/**
 * Task complexity estimation factors
 */
const COMPLEXITY_DURATIONS = {
  simple: 60000,      // 1 minute
  moderate: 300000,   // 5 minutes
  complex: 900000,    // 15 minutes
  veryComplex: 1800000 // 30 minutes
};

/**
 * Points Engine - Main class for calculating and awarding points
 */
export class PointsEngine extends EventEmitter {
  constructor(rabbitMQClient, options = {}) {
    super();
    this.client = rabbitMQClient;
    this.exchange = options.exchange || 'gamification.points';
    this.agentProfiles = new Map(); // In-memory cache (should use DB in production)
  }

  /**
   * Initialize the points engine
   */
  async initialize() {
    if (!this.client || !this.client.channel) {
      throw new Error('RabbitMQ client not connected');
    }

    await this.client.channel.assertExchange(this.exchange, 'topic', { durable: true });
    console.log(`✅ Points Engine initialized with exchange: ${this.exchange}`);
  }

  /**
   * Calculate speed points based on task completion time
   * @param {Object} task - Task object with metadata
   * @param {number} completionTime - Time taken in milliseconds
   * @returns {number} Speed points earned
   */
  calculateSpeedPoints(task, completionTime) {
    const priority = task.priority || 'normal';
    const basePoints = priority === 'critical' ? 100 :
                      priority === 'high' ? 50 :
                      priority === 'normal' ? 25 : 10;

    // Expected time based on task complexity
    const expectedTime = this.estimateTaskDuration(task);

    // Normalized duration (1.0 = exactly on time, 0.5 = twice as fast)
    const normalizedDuration = completionTime / expectedTime;

    // Speed multiplier (faster = higher multiplier)
    const speedMultiplier = normalizedDuration <= 0.5 ? 3.0 :
                           normalizedDuration <= 0.75 ? 2.0 :
                           normalizedDuration <= 1.0 ? 1.5 :
                           normalizedDuration <= 1.5 ? 1.0 : 0.5;

    // Bonus for exceptional speed
    const speedBonus = normalizedDuration <= 0.3 ? 50 : 0;

    const speedPoints = Math.round(
      basePoints * (1 / Math.max(normalizedDuration, 0.1)) * speedMultiplier + speedBonus
    );

    return Math.max(speedPoints, 5); // Minimum 5 points
  }

  /**
   * Estimate task duration based on complexity
   * @param {Object} task - Task object
   * @returns {number} Estimated duration in milliseconds
   */
  estimateTaskDuration(task) {
    const complexity = task.complexity || 'moderate';
    return COMPLEXITY_DURATIONS[complexity] || COMPLEXITY_DURATIONS.moderate;
  }

  /**
   * Calculate quality points based on output assessment
   * @param {Object} result - Task result with quality metrics
   * @returns {number} Quality points earned
   */
  calculateQualityPoints(result) {
    const basePoints = POINT_CATEGORIES.QUALITY.basePoints;

    // Multi-factor quality assessment (normalized 0-1)
    const qualityFactors = {
      accuracy: result.accuracy || 0.5,
      completeness: result.completeness || 0.5,
      codeStyle: result.codeStyle || 0.5,
      documentation: result.documentation || 0.5,
      testCoverage: result.testCoverage || 0
    };

    // Weighted quality score
    const qualityScore = (
      qualityFactors.accuracy * 0.30 +
      qualityFactors.completeness * 0.25 +
      qualityFactors.codeStyle * 0.20 +
      qualityFactors.documentation * 0.15 +
      qualityFactors.testCoverage * 0.10
    );

    // Quality tier multiplier
    const qualityMultiplier = qualityScore >= 0.95 ? 3.0 :
                             qualityScore >= 0.85 ? 2.0 :
                             qualityScore >= 0.75 ? 1.5 :
                             qualityScore >= 0.60 ? 1.0 : 0.5;

    // Perfection bonus
    const perfectionBonus = qualityScore >= 0.98 ? 100 : 0;

    const qualityPoints = Math.round(
      basePoints * qualityScore * qualityMultiplier + perfectionBonus
    );

    return qualityPoints;
  }

  /**
   * Calculate collaboration points for team participation
   * @param {Object} collaboration - Collaboration event data
   * @returns {number} Collaboration points earned
   */
  calculateCollaborationPoints(collaboration) {
    const basePoints = POINT_CATEGORIES.COLLABORATION.basePoints;

    // Collaboration type weights
    const typeMultipliers = {
      brainstorm: 1.5,
      peerReview: 1.3,
      taskAssist: 1.0,
      knowledgeShare: 1.2,
      mentoring: 1.8
    };

    const typeMultiplier = typeMultipliers[collaboration.type] || 1.0;

    // Participation quality (0-1)
    const messagesScore = Math.min((collaboration.messagesCount || 0) / 10, 1.0);
    const helpfulnessScore = Math.min((collaboration.helpfulness || 0) / 5, 1.0);
    const responsivenessScore = Math.min((collaboration.responsiveness || 0) / 5, 1.0);

    const participationQuality = (
      messagesScore * 0.3 +
      helpfulnessScore * 0.4 +
      responsivenessScore * 0.3
    );

    // Team size bonus (larger teams = more collaboration value)
    const teamSizeBonus = Math.min((collaboration.teamSize || 1) / 5, 2.0);

    // Consensus contribution (did your input lead to decision?)
    const consensusBonus = collaboration.ledToConsensus ? 50 : 0;

    const collabPoints = Math.round(
      basePoints * typeMultiplier * participationQuality * teamSizeBonus + consensusBonus
    );

    return Math.max(collabPoints, 5);
  }

  /**
   * Calculate innovation points for novel solutions
   * @param {Object} solution - Solution metadata
   * @param {Array} historicalSolutions - Past solutions for comparison
   * @returns {number} Innovation points earned
   */
  calculateInnovationPoints(solution, historicalSolutions = []) {
    const basePoints = POINT_CATEGORIES.INNOVATION.basePoints;

    // Novelty detection (how different from historical solutions?)
    const noveltyScore = this.calculateNoveltyScore(solution, historicalSolutions);

    // Approach uniqueness
    const approachFactors = {
      standard: 0.5,      // Common approach
      creative: 1.0,      // Creative twist
      novel: 2.0,         // New approach
      breakthrough: 3.0   // Paradigm shift
    };

    const approachMultiplier = approachFactors[solution.approach] || 1.0;

    // Impact score (how much does this improve things?)
    const impactScore = solution.performanceGain || 1.0;

    // First-of-kind bonus
    const pioneerBonus = noveltyScore >= 0.9 ? 200 : 0;

    // Rarity bonus (fewer similar solutions = higher rarity)
    const rarityBonus = historicalSolutions.length < 3 ? 1.5 : 1.0;

    const innovationPoints = Math.round(
      basePoints * noveltyScore * approachMultiplier * impactScore * rarityBonus + pioneerBonus
    );

    return innovationPoints;
  }

  /**
   * Calculate novelty score using similarity comparison
   * @param {Object} solution - Current solution
   * @param {Array} historicalSolutions - Historical solutions
   * @returns {number} Novelty score (0-1)
   */
  calculateNoveltyScore(solution, historicalSolutions) {
    if (historicalSolutions.length === 0) return 1.0;

    // Compare solution features to historical ones
    const similarities = historicalSolutions.map(historical =>
      this.calculateSimilarity(solution, historical)
    );

    const maxSimilarity = Math.max(...similarities);

    // Novelty is inverse of similarity
    return 1.0 - maxSimilarity;
  }

  /**
   * Simple similarity calculation between solutions
   * @param {Object} solution1 - First solution
   * @param {Object} solution2 - Second solution
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(solution1, solution2) {
    // Feature comparison (simplified)
    const features = ['approach', 'libraries', 'patterns', 'architecture'];
    let matchCount = 0;

    features.forEach(feature => {
      if (solution1[feature] === solution2[feature]) {
        matchCount++;
      }
    });

    return matchCount / features.length;
  }

  /**
   * Calculate reliability points based on consistency
   * @param {Object} agent - Agent profile with stats
   * @returns {number} Reliability points earned (daily award)
   */
  calculateReliabilityPoints(agent) {
    const basePoints = POINT_CATEGORIES.RELIABILITY.basePoints;

    // Success rate factor
    const successRate = agent.stats?.successRate || 0;
    const successFactor = successRate / 100;

    // Uptime factor
    const uptimeFactor = (agent.stats?.uptime || 0) / 100;

    // Consecutive days streak bonus
    const streakDays = agent.stats?.consecutiveDays || 0;
    const streakBonus = Math.min(streakDays * 5, 100);

    // Consistency score (low variance in performance)
    const consistencyScore = (agent.reputation?.consistency || 0) / 100;

    // Zero-error bonus
    const tasksCompleted = agent.stats?.tasksCompleted || 0;
    const errorCount = tasksCompleted - (tasksCompleted * successRate / 100);
    const zeroErrorBonus = errorCount === 0 && tasksCompleted > 0 ? 50 : 0;

    const reliabilityPoints = Math.round(
      basePoints * successFactor * uptimeFactor * consistencyScore +
      streakBonus +
      zeroErrorBonus
    );

    return Math.max(reliabilityPoints, 0);
  }

  /**
   * Apply global multipliers to base points
   * @param {number} basePoints - Base points before multipliers
   * @param {Object} context - Context with timestamp, priority, agent info
   * @returns {number} Final points after multipliers
   */
  applyMultipliers(basePoints, context) {
    let finalPoints = basePoints;

    // Time-based multipliers
    const timestamp = context.timestamp || Date.now();
    if (this.isWeekend(timestamp)) {
      finalPoints *= GLOBAL_MULTIPLIERS.WEEKEND_BONUS;
    }

    const hour = new Date(timestamp).getHours();
    if (hour >= 22 || hour <= 6) {
      finalPoints *= GLOBAL_MULTIPLIERS.NIGHT_OWL_BONUS;
    } else if (hour >= 5 && hour <= 8) {
      finalPoints *= GLOBAL_MULTIPLIERS.EARLY_BIRD_BONUS;
    }

    // Priority multiplier
    const priority = context.priority || 'normal';
    const priorityKey = `${priority.toUpperCase()}_PRIORITY`;
    if (GLOBAL_MULTIPLIERS[priorityKey]) {
      finalPoints *= GLOBAL_MULTIPLIERS[priorityKey];
    }

    // Streak multiplier
    const agent = context.agent || {};
    const streakDays = agent.stats?.consecutiveDays || 0;
    if (streakDays >= 100) finalPoints *= GLOBAL_MULTIPLIERS.STREAK_100_DAYS;
    else if (streakDays >= 30) finalPoints *= GLOBAL_MULTIPLIERS.STREAK_30_DAYS;
    else if (streakDays >= 7) finalPoints *= GLOBAL_MULTIPLIERS.STREAK_7_DAYS;
    else if (streakDays >= 3) finalPoints *= GLOBAL_MULTIPLIERS.STREAK_3_DAYS;

    // Combo multiplier
    const comboCount = agent.currentCombo || 0;
    if (comboCount >= 10) finalPoints *= GLOBAL_MULTIPLIERS.COMBO_10X;
    else if (comboCount >= 5) finalPoints *= GLOBAL_MULTIPLIERS.COMBO_5X;
    else if (comboCount >= 3) finalPoints *= GLOBAL_MULTIPLIERS.COMBO_3X;
    else if (comboCount >= 2) finalPoints *= GLOBAL_MULTIPLIERS.COMBO_2X;

    // Tier multiplier
    const tier = agent.tier || 'BRONZE';
    const tierKey = tier.toUpperCase();
    if (GLOBAL_MULTIPLIERS[tierKey]) {
      finalPoints *= GLOBAL_MULTIPLIERS[tierKey];
    }

    return Math.round(finalPoints);
  }

  /**
   * Check if timestamp is on weekend
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {boolean} True if weekend
   */
  isWeekend(timestamp) {
    const day = new Date(timestamp).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Award points and emit event to RabbitMQ
   * @param {string} agentId - Agent ID
   * @param {string} category - Point category (speed, quality, etc.)
   * @param {number} points - Points to award
   * @param {Object} context - Additional context
   * @returns {Object} Points event
   */
  async awardPoints(agentId, category, points, context = {}) {
    const event = {
      eventId: uuidv4(),
      agentId,
      category,
      points,
      context,
      timestamp: Date.now()
    };

    // Publish to RabbitMQ
    const routingKey = `points.earned.${category}`;
    await this.client.channel.publish(
      this.exchange,
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { persistent: true }
    );

    this.emit('points_awarded', event);

    return event;
  }

  /**
   * Process task completion and award points
   * @param {Object} task - Task object
   * @param {Object} result - Task result
   * @param {number} completionTime - Time taken in milliseconds
   * @param {Object} agent - Agent profile
   * @returns {Object} Points breakdown
   */
  async processTaskCompletion(task, result, completionTime, agent) {
    const context = {
      task,
      result,
      completionTime,
      priority: task.priority,
      timestamp: Date.now(),
      agent
    };

    // Calculate all point categories
    const speedPoints = this.calculateSpeedPoints(task, completionTime);
    const qualityPoints = this.calculateQualityPoints(result);
    const reliabilityBonus = result.errorFree ? 10 : 0;

    // Apply multipliers to total
    const totalBasePoints = speedPoints + qualityPoints + reliabilityBonus;
    const finalPoints = this.applyMultipliers(totalBasePoints, context);

    // Award points by category
    await this.awardPoints(result.agentId, 'speed', speedPoints, context);
    await this.awardPoints(result.agentId, 'quality', qualityPoints, context);
    await this.awardPoints(result.agentId, 'total', finalPoints, context);

    return {
      speedPoints,
      qualityPoints,
      reliabilityBonus,
      totalBasePoints,
      finalPoints,
      multipliers: this.getActiveMultipliers(context)
    };
  }

  /**
   * Get list of active multipliers for transparency
   * @param {Object} context - Context with timestamp, priority, agent
   * @returns {Array} Active multipliers
   */
  getActiveMultipliers(context) {
    const active = [];
    const timestamp = context.timestamp || Date.now();
    const agent = context.agent || {};

    if (this.isWeekend(timestamp)) {
      active.push({ name: 'Weekend Bonus', multiplier: GLOBAL_MULTIPLIERS.WEEKEND_BONUS });
    }

    const hour = new Date(timestamp).getHours();
    if (hour >= 22 || hour <= 6) {
      active.push({ name: 'Night Owl', multiplier: GLOBAL_MULTIPLIERS.NIGHT_OWL_BONUS });
    } else if (hour >= 5 && hour <= 8) {
      active.push({ name: 'Early Bird', multiplier: GLOBAL_MULTIPLIERS.EARLY_BIRD_BONUS });
    }

    const streakDays = agent.stats?.consecutiveDays || 0;
    if (streakDays >= 100) {
      active.push({ name: '100 Day Streak', multiplier: GLOBAL_MULTIPLIERS.STREAK_100_DAYS });
    } else if (streakDays >= 30) {
      active.push({ name: '30 Day Streak', multiplier: GLOBAL_MULTIPLIERS.STREAK_30_DAYS });
    } else if (streakDays >= 7) {
      active.push({ name: '7 Day Streak', multiplier: GLOBAL_MULTIPLIERS.STREAK_7_DAYS });
    } else if (streakDays >= 3) {
      active.push({ name: '3 Day Streak', multiplier: GLOBAL_MULTIPLIERS.STREAK_3_DAYS });
    }

    const tier = agent.tier || 'BRONZE';
    if (tier !== 'BRONZE') {
      active.push({ name: `${tier} Tier`, multiplier: GLOBAL_MULTIPLIERS[tier.toUpperCase()] });
    }

    return active;
  }

  /**
   * Close the points engine
   */
  async close() {
    console.log('🔌 Points Engine shutting down');
  }
}

export default PointsEngine;
