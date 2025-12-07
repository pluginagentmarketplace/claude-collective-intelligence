#!/usr/bin/env node
/**
 * Penalties System - Fair and Constructive Performance Management
 *
 * Implements a progressive penalty system with 6 levels, 5 performance triggers,
 * 7 fairness safeguards, token bucket throttling, and retraining protocols.
 *
 * Key Features:
 * - 6 progressive penalty levels (Warning → Suspension)
 * - 5 performance triggers (error rate, timeout, quality, collaboration, resources)
 * - 7 fairness safeguards (context analysis, peer comparison, anomaly detection, appeals)
 * - Token bucket throttling with gradual reduction
 * - 4-stage retraining curriculum
 * - Appeal process with automatic anomaly detection
 * - RabbitMQ integration for penalty events
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { PerformanceEvaluator } from './penalties/performance-evaluator.js';
import { RetrainingManager } from './penalties/retraining-manager.js';

/**
 * Resource throttle using token bucket algorithm
 */
export class ResourceThrottle {
  constructor(capacity = 100, refillRate = 10) {
    this.bucket = {
      capacity,
      tokens: capacity,
      refillRate,
      lastRefill: new Date()
    };
    this.penaltyMultiplier = 1.0;
  }

  /**
   * Apply penalty by reducing refill rate
   */
  applyPenalty(level) {
    const multipliers = {
      1: 1.0,    // No reduction
      2: 0.9,    // 10% reduction
      3: 0.8,    // 20% reduction
      4: 0.7,    // 30% reduction
      5: 0.5,    // 50% reduction
      6: 0.0     // No resources
    };

    this.penaltyMultiplier = multipliers[level] || 1.0;
  }

  /**
   * Attempt to consume tokens for a task
   */
  async consumeTokens(tokensRequired) {
    this.refillBucket();

    if (this.bucket.tokens >= tokensRequired) {
      this.bucket.tokens -= tokensRequired;
      return true;
    }

    return false;
  }

  /**
   * Refill tokens based on elapsed time and penalty
   */
  refillBucket() {
    const now = new Date();
    const elapsed = (now.getTime() - this.bucket.lastRefill.getTime()) / 1000;

    const tokensToAdd = elapsed * this.bucket.refillRate * this.penaltyMultiplier;
    this.bucket.tokens = Math.min(
      this.bucket.capacity,
      this.bucket.tokens + tokensToAdd
    );

    this.bucket.lastRefill = now;
  }

  /**
   * Get current throttle status
   */
  getStatus() {
    this.refillBucket();

    return {
      available: this.bucket.tokens,
      capacity: this.bucket.capacity,
      refillRate: this.bucket.refillRate,
      penaltyMultiplier: this.penaltyMultiplier,
      utilizationPercent: (this.bucket.tokens / this.bucket.capacity) * 100
    };
  }

  /**
   * Reset throttle to full capacity
   */
  reset() {
    this.bucket.tokens = this.bucket.capacity;
    this.penaltyMultiplier = 1.0;
    this.bucket.lastRefill = new Date();
  }
}

/**
 * Main Penalty System
 */
export class PenaltySystem extends EventEmitter {
  constructor(rabbitMQClient, monitorAgent) {
    super();
    this.client = rabbitMQClient;
    this.monitor = monitorAgent;

    this.penalties = new Map();
    this.appeals = new Map();
    this.throttles = new Map();
    this.probation = new Map();
    this.history = new Map();

    this.evaluator = new PerformanceEvaluator();
    this.retrainingManager = new RetrainingManager(rabbitMQClient);

    // Penalty level configurations
    this.penaltyLevels = {
      1: {
        name: 'WARNING',
        description: 'Tracking only, no actual penalty',
        duration: 3600000, // 1 hour
        computeReduction: 0,
        restrictions: {
          computeMultiplier: 1.0,
          taskPriority: 0,
          allowedTaskTypes: null,
          canLeadCollaboration: true,
          requiresSupervision: false
        }
      },
      2: {
        name: 'COMPUTE_REDUCTION',
        description: 'CPU/memory reduced by 10%',
        duration: 7200000, // 2 hours
        computeReduction: 0.1,
        restrictions: {
          computeMultiplier: 0.9,
          taskPriority: -1,
          allowedTaskTypes: null,
          canLeadCollaboration: true,
          requiresSupervision: false
        }
      },
      3: {
        name: 'PERMISSION_DOWNGRADE',
        description: 'Restricted to simpler tasks',
        duration: 14400000, // 4 hours
        computeReduction: 0.2,
        restrictions: {
          computeMultiplier: 0.8,
          taskPriority: -2,
          allowedTaskTypes: ['simple', 'routine'],
          canLeadCollaboration: false,
          requiresSupervision: false
        }
      },
      4: {
        name: 'TASK_DEPRIORITIZATION',
        description: 'Receives tasks only when no other agents available',
        duration: 28800000, // 8 hours
        computeReduction: 0.3,
        restrictions: {
          computeMultiplier: 0.7,
          taskPriority: -5,
          allowedTaskTypes: ['simple', 'routine', 'backup'],
          canLeadCollaboration: false,
          requiresSupervision: false
        }
      },
      5: {
        name: 'MANDATORY_RETRAINING',
        description: 'Removed from production queue, must complete retraining',
        duration: null, // Until graduation
        computeReduction: 0.5,
        restrictions: {
          computeMultiplier: 0.5,
          taskPriority: -10,
          allowedTaskTypes: ['training'],
          canLeadCollaboration: false,
          requiresSupervision: true
        }
      },
      6: {
        name: 'SUSPENSION',
        description: 'Removed from all queues, under investigation',
        duration: 86400000, // 24 hours
        computeReduction: 1.0,
        restrictions: {
          computeMultiplier: 0.0,
          taskPriority: -100,
          allowedTaskTypes: [],
          canLeadCollaboration: false,
          requiresSupervision: true
        }
      }
    };
  }

  /**
   * Main evaluation loop - evaluates agent performance
   */
  async evaluateAgentPerformance(agentId) {
    // 1. DETECT: Gather performance metrics
    const metrics = await this.getAgentMetrics(agentId);

    if (!metrics) {
      return null;
    }

    // 2. ANALYZE: Evaluate context
    const context = await this.evaluator.analyzeContext(agentId, metrics);

    // 3. CHECK TRIGGERS: Determine if penalty needed
    const triggers = await this.evaluator.evaluateTriggers(metrics, context);

    if (triggers.length === 0) {
      // Performance acceptable - check for recovery
      await this.checkForRecovery(agentId);
      return null;
    }

    // 4. CLASSIFY: Determine severity
    const penaltyLevel = this.evaluator.determinePenaltyLevel(triggers, context);

    // 5. APPLY: Apply penalty
    const penalty = await this.applyPenalty(agentId, penaltyLevel, triggers, context, metrics);

    // 6. MONITOR: Schedule monitoring
    await this.scheduleMonitoring(agentId);

    return penalty;
  }

  /**
   * Apply penalty to agent
   */
  async applyPenalty(agentId, level, triggers, context, metrics = null) {
    const penaltyId = uuidv4();
    const config = this.penaltyLevels[level];

    // Get metrics if not provided
    if (!metrics) {
      metrics = await this.getAgentMetrics(agentId);
    }

    const penalty = {
      id: penaltyId,
      agentId,
      level,
      name: config.name,
      description: config.description,
      reason: this.generateReason(triggers),
      triggeredBy: triggers.map(t => t.type),
      appliedAt: new Date(),
      expiresAt: config.duration ? new Date(Date.now() + config.duration) : null,

      // Restrictions
      restrictions: config.restrictions,

      // Improvement plan
      improvementPlan: this.createImprovementPlan(agentId, triggers),

      // Appeal info
      appealable: true,
      appealDeadline: new Date(Date.now() + 3600000), // 1 hour to appeal
      appealStatus: null,

      // Metadata
      metricsAtStart: metrics,
      context
    };

    // Store penalty
    this.penalties.set(agentId, penalty);
    this.addToHistory(agentId, penalty);

    // Apply restrictions
    await this.applyRestrictions(agentId, penalty.restrictions);

    // Setup retraining if needed
    if (level >= 5) {
      await this.retrainingManager.startRetraining(agentId, triggers);
    }

    // Notify agent
    await this.notifyAgent(agentId, penalty);

    // Publish event
    await this.publishPenaltyEvent(penalty);

    // Check for anomalies (auto-appeal)
    const anomalies = await this.evaluator.detectAnomalies(penalty, context);
    if (anomalies.autoReviewTriggered) {
      await this.createAutoAppeal(penalty, anomalies);
    }

    this.emit('penalty_applied', penalty);

    return penalty;
  }

  /**
   * Generate human-readable reason for penalty
   */
  generateReason(triggers) {
    const reasons = triggers.map(t => {
      switch (t.type) {
        case 'error_rate':
          return `Error rate (${(t.value * 100).toFixed(1)}%) exceeds threshold (${(t.threshold * 100).toFixed(0)}%)`;
        case 'timeout_frequency':
          return `Timeout frequency (${(t.value * 100).toFixed(1)}%) exceeds threshold (${(t.threshold * 100).toFixed(0)}%)`;
        case 'quality_drop':
          return `Quality score dropped by ${(t.value * 100).toFixed(1)}% (threshold: ${(t.threshold * 100).toFixed(0)}%)`;
        case 'collaboration_failure':
          return `Collaboration failure rate (${(t.value * 100).toFixed(1)}%) exceeds threshold (${(t.threshold * 100).toFixed(0)}%)`;
        case 'resource_abuse':
          return `Resource usage (${(t.value * 100).toFixed(0)}%) exceeds allocation threshold (${(t.threshold * 100).toFixed(0)}%)`;
        default:
          return `Performance issue detected: ${t.type}`;
      }
    });

    return reasons.join('; ');
  }

  /**
   * Create improvement plan for agent
   */
  createImprovementPlan(agentId, triggers) {
    const targetMetrics = {};

    for (const trigger of triggers) {
      switch (trigger.type) {
        case 'error_rate':
          targetMetrics.errorRate = 0.05; // Target 5%
          break;
        case 'timeout_frequency':
          targetMetrics.timeoutRate = 0.10; // Target 10%
          break;
        case 'quality_drop':
          targetMetrics.qualityScore = 0.85; // Target 0.85
          break;
        case 'collaboration_failure':
          targetMetrics.collaborationSuccessRate = 0.80; // Target 80%
          break;
        case 'resource_abuse':
          targetMetrics.resourceUsage = 1.0; // Target 100% of allocation
          break;
      }
    }

    return {
      targetMetrics,
      requiredImprovement: 0.30, // 30% improvement
      checkpoints: this.generateCheckpoints(),
      retrainingRequired: triggers.some(t => t.severity >= 4)
    };
  }

  /**
   * Generate improvement checkpoints
   */
  generateCheckpoints() {
    const now = Date.now();
    return [
      new Date(now + 1800000),  // 30 minutes
      new Date(now + 3600000),  // 1 hour
      new Date(now + 7200000),  // 2 hours
      new Date(now + 14400000)  // 4 hours
    ];
  }

  /**
   * Apply restrictions to agent
   */
  async applyRestrictions(agentId, restrictions) {
    // Setup or update throttle
    let throttle = this.throttles.get(agentId);
    if (!throttle) {
      throttle = new ResourceThrottle();
      this.throttles.set(agentId, throttle);
    }

    // Calculate penalty level from compute multiplier
    const level = this.computeLevelFromMultiplier(restrictions.computeMultiplier);
    throttle.applyPenalty(level);

    // Store restrictions for task assignment
    this.emit('restrictions_applied', { agentId, restrictions });
  }

  /**
   * Compute penalty level from multiplier
   */
  computeLevelFromMultiplier(multiplier) {
    if (multiplier >= 1.0) return 1;
    if (multiplier >= 0.9) return 2;
    if (multiplier >= 0.8) return 3;
    if (multiplier >= 0.7) return 4;
    if (multiplier >= 0.5) return 5;
    return 6;
  }

  /**
   * Get agent metrics from monitor
   */
  async getAgentMetrics(agentId) {
    if (this.monitor && this.monitor.getAgentMetrics) {
      return await this.monitor.getAgentMetrics(agentId);
    }

    // Mock metrics for testing
    return {
      agentId,
      errorRate: 0,
      timeoutRate: 0,
      successRate: 1.0,
      qualityScore: 0.90,
      baselineQuality: 0.90,
      currentQuality: 0.90,
      collaborationSuccessRate: 1.0,
      collaborationFailureRate: 0,
      resourceUsage: { cpu: 1.0, memory: 1.0, network: 1.0 },
      taskCount: 10,
      avgResponseTime: 1000
    };
  }

  /**
   * Check if agent has recovered and can have penalty lifted
   */
  async checkForRecovery(agentId, fastMode = true) {
    const penalty = this.penalties.get(agentId);
    if (!penalty) return;

    const metrics = await this.getAgentMetrics(agentId);
    const plan = penalty.improvementPlan;

    // Check if all targets met
    const targetsMet = Object.keys(plan.targetMetrics).every(metric => {
      const target = plan.targetMetrics[metric];
      const current = metrics[metric];

      // Different comparison based on metric type
      if (metric.includes('Rate') || metric.includes('error') || metric.includes('Failure')) {
        return current <= target; // Lower is better
      } else {
        return current >= target; // Higher is better
      }
    });

    if (targetsMet) {
      await this.removePenalty(agentId, 'performance_improved', fastMode);
    }
  }

  /**
   * Remove penalty and restore agent
   */
  async removePenalty(agentId, reason, fastMode = false) {
    const penalty = this.penalties.get(agentId);
    if (!penalty) return;

    // Gradual restoration
    await this.graduallyRestoreResources(agentId, fastMode);

    // Restore privileges
    await this.restorePrivileges(agentId);

    // End probation if applicable
    await this.endProbation(agentId);

    // Remove from tracking
    this.penalties.delete(agentId);

    // Notify agent
    await this.notifyAgent(agentId, {
      type: 'penalty_removed',
      reason,
      performance: await this.getAgentMetrics(agentId)
    });

    // Publish event
    await this.publishRecoveryEvent(agentId, reason);

    this.emit('penalty_removed', { agentId, reason, penalty });
  }

  /**
   * Gradually restore resources
   */
  async graduallyRestoreResources(agentId, fastMode = false) {
    const throttle = this.throttles.get(agentId);
    if (!throttle) return;

    // Gradual restoration over 10 steps
    const steps = 10;
    const stepDuration = fastMode ? 10 : 3000; // Fast mode for testing
    const currentMultiplier = throttle.penaltyMultiplier;

    for (let i = 1; i <= steps; i++) {
      const newMultiplier = currentMultiplier + ((1.0 - currentMultiplier) * (i / steps));
      throttle.penaltyMultiplier = newMultiplier;

      await this.sleep(stepDuration);
    }

    throttle.reset();
  }

  /**
   * Restore agent privileges
   */
  async restorePrivileges(agentId) {
    const fullPrivileges = {
      computeMultiplier: 1.0,
      taskPriority: 0,
      allowedTaskTypes: null,
      canLeadCollaboration: true,
      requiresSupervision: false
    };

    this.emit('privileges_restored', { agentId, privileges: fullPrivileges });
  }

  /**
   * End probation period
   */
  async endProbation(agentId) {
    if (this.probation.has(agentId)) {
      this.probation.delete(agentId);
      this.emit('probation_ended', { agentId });
    }
  }

  /**
   * Start probation period after retraining
   */
  async startProbation(agentId, duration = 14400000) {
    const probationPeriod = {
      agentId,
      startDate: new Date(),
      endDate: new Date(Date.now() + duration),
      duration,
      monitoring: {
        frequency: 'high',
        realTimeTracking: true,
        autoEscalateOnFailure: true
      },
      requirements: {
        minimumSuccessRate: 0.90,
        maximumErrorRate: 0.05,
        qualityThreshold: 0.85
      }
    };

    this.probation.set(agentId, probationPeriod);
    this.emit('probation_started', probationPeriod);

    return probationPeriod;
  }

  /**
   * File an appeal for a penalty
   */
  async fileAppeal(penaltyId, agentId, grounds) {
    const penalty = this.penalties.get(agentId);
    if (!penalty || penalty.id !== penaltyId) {
      throw new Error('Penalty not found or does not belong to agent');
    }

    if (new Date() > penalty.appealDeadline) {
      throw new Error('Appeal deadline has passed');
    }

    const appealId = uuidv4();
    const appeal = {
      id: appealId,
      penaltyId,
      agentId,
      submittedAt: new Date(),
      grounds,
      review: {
        reviewer: null,
        status: 'pending',
        reviewedAt: null,
        decision: null,
        reasoning: null
      }
    };

    this.appeals.set(appealId, appeal);
    penalty.appealStatus = 'pending';

    // Publish appeal event
    await this.publishAppealEvent(appeal);

    this.emit('appeal_filed', appeal);

    return appealId;
  }

  /**
   * Create automatic appeal based on anomaly detection
   */
  async createAutoAppeal(penalty, anomalies) {
    const grounds = {
      type: 'systemic_issue',
      explanation: 'Automatic appeal triggered by anomaly detection',
      evidence: {
        metrics: penalty.metricsAtStart,
        anomalies,
        systemicFactors: anomalies.recommendation
      }
    };

    return await this.fileAppeal(penalty.id, penalty.agentId, grounds);
  }

  /**
   * Review an appeal
   */
  async reviewAppeal(appealId, reviewer, decision, reasoning) {
    const appeal = this.appeals.get(appealId);
    if (!appeal) {
      throw new Error('Appeal not found');
    }

    appeal.review = {
      reviewer,
      status: decision === 'approved' ? 'approved' : 'denied',
      reviewedAt: new Date(),
      decision,
      reasoning
    };

    const penalty = this.penalties.get(appeal.agentId);
    if (penalty) {
      penalty.appealStatus = appeal.review.status;
    }

    if (decision === 'approved') {
      await this.reversePenalty(appeal.penaltyId, appeal, reasoning);
    }

    this.emit('appeal_reviewed', appeal);

    return appeal;
  }

  /**
   * Reverse a penalty (approved appeal)
   */
  async reversePenalty(penaltyId, appeal, reasoning, fastMode = true) {
    const penalty = Array.from(this.penalties.values()).find(p => p.id === penaltyId);
    if (!penalty) return;

    const agentId = penalty.agentId;

    // Remove penalty (use fast mode for tests)
    await this.removePenalty(agentId, 'appeal_approved', fastMode);

    // Provide compensation
    const compensation = {
      priorityBoost: 10,
      duration: 7200000, // 2 hours
      removeFromRecord: true,
      markAsUnfair: true
    };

    await this.applyCompensation(agentId, compensation);

    // Notify agent
    await this.notifyAgent(agentId, {
      type: 'penalty_reversed',
      penaltyId,
      reasoning,
      compensation,
      apology: true
    });

    // Publish reversal event
    await this.publishReversalEvent(penalty, appeal, reasoning);

    this.emit('penalty_reversed', { penalty, appeal, reasoning, compensation });
  }

  /**
   * Apply compensation to agent
   */
  async applyCompensation(agentId, compensation) {
    this.emit('compensation_applied', { agentId, compensation });
  }

  /**
   * Notify agent of penalty or event
   */
  async notifyAgent(agentId, notification) {
    if (this.client && this.client.isHealthy()) {
      await this.client.publishMessage(
        `agent.${agentId}.notifications`,
        notification
      );
    }

    this.emit('agent_notified', { agentId, notification });
  }

  /**
   * Publish penalty event to RabbitMQ
   */
  async publishPenaltyEvent(penalty) {
    if (this.client && this.client.isHealthy()) {
      const routingKey = `penalty.applied.level${penalty.level}.${penalty.agentId}`;

      await this.client.publish(
        'agent.penalties',
        routingKey,
        {
          type: 'penalty_applied',
          penalty,
          timestamp: new Date()
        }
      );
    }
  }

  /**
   * Publish recovery event
   */
  async publishRecoveryEvent(agentId, reason) {
    if (this.client && this.client.isHealthy()) {
      await this.client.publish(
        'agent.penalties',
        `penalty.removed.${agentId}`,
        {
          type: 'penalty_removed',
          agentId,
          reason,
          timestamp: new Date()
        }
      );
    }
  }

  /**
   * Publish appeal event
   */
  async publishAppealEvent(appeal) {
    if (this.client && this.client.isHealthy()) {
      await this.client.publish(
        'agent.penalties',
        `penalty.appeal.filed.${appeal.agentId}`,
        appeal
      );
    }
  }

  /**
   * Publish reversal event
   */
  async publishReversalEvent(penalty, appeal, reasoning) {
    if (this.client && this.client.isHealthy()) {
      await this.client.publish(
        'agent.penalties',
        `penalty.reversed.${penalty.agentId}`,
        {
          type: 'penalty_reversed',
          penalty,
          appeal,
          reasoning,
          timestamp: new Date()
        }
      );
    }
  }

  /**
   * Schedule monitoring for agent
   */
  async scheduleMonitoring(agentId) {
    // Schedule periodic checks
    this.emit('monitoring_scheduled', { agentId });
  }

  /**
   * Add penalty to agent history
   */
  addToHistory(agentId, penalty) {
    if (!this.history.has(agentId)) {
      this.history.set(agentId, []);
    }

    this.history.get(agentId).push({
      ...penalty,
      recordedAt: new Date()
    });
  }

  /**
   * Get penalty dashboard statistics
   */
  getDashboard() {
    const allPenalties = Array.from(this.penalties.values());
    const byLevel = {};

    for (let i = 1; i <= 6; i++) {
      byLevel[`level${i}`] = allPenalties.filter(p => p.level === i).length;
    }

    const allAppeals = Array.from(this.appeals.values());
    const pendingAppeals = allAppeals.filter(a => a.review.status === 'pending').length;
    const approvedAppeals = allAppeals.filter(a => a.review.status === 'approved').length;
    const deniedAppeals = allAppeals.filter(a => a.review.status === 'denied').length;

    return {
      totalPenalties: allPenalties.length,
      byLevel,
      appeals: {
        pending: pendingAppeals,
        approved: approvedAppeals,
        denied: deniedAppeals,
        total: allAppeals.length,
        approvalRate: allAppeals.length > 0 ? approvedAppeals / allAppeals.length : 0
      },
      probation: {
        count: this.probation.size,
        agents: Array.from(this.probation.keys())
      },
      retraining: {
        count: this.retrainingManager.getActiveCount()
      }
    };
  }

  /**
   * Get penalty status for specific agent
   */
  getPenaltyStatus(agentId) {
    const penalty = this.penalties.get(agentId);
    const throttle = this.throttles.get(agentId);
    const probationPeriod = this.probation.get(agentId);
    const history = this.history.get(agentId) || [];

    return {
      active: penalty || null,
      throttle: throttle ? throttle.getStatus() : null,
      probation: probationPeriod || null,
      history: history.length,
      recentPenalties: history.slice(-5)
    };
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup expired penalties
   */
  async cleanupExpiredPenalties() {
    const now = new Date();

    for (const [agentId, penalty] of this.penalties.entries()) {
      if (penalty.expiresAt && now > penalty.expiresAt) {
        await this.removePenalty(agentId, 'expired');
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup(interval = 300000) { // 5 minutes
    setInterval(() => {
      this.cleanupExpiredPenalties();
    }, interval);
  }
}

export default PenaltySystem;
