#!/usr/bin/env node
/**
 * EigenTrust-Based Reputation System
 *
 * Based on Stanford's EigenTrust algorithm for distributed trust computation
 * Reference: "The EigenTrust Algorithm for Reputation Management in P2P Networks"
 *
 * Mathematical Foundation:
 * - Trust scores computed as principal eigenvector of normalized trust matrix
 * - Formula: t^(k+1) = C^T × t^(k)
 *   where C is the normalized local trust matrix
 *   and t is the global trust vector
 *
 * Five-Dimensional Trust Calculation:
 * 1. Persistence (20%): Consistency and engagement over time
 * 2. Competence (30%): Skill, quality, and success rate
 * 3. Reputation (25%): Historical performance and achievements
 * 4. Credibility (15%): Peer validation and ratings
 * 5. Integrity (10%): Error-free execution and reliability
 */

import { EventEmitter } from 'events';

export class ReputationSystem extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      eigentrustIterations: options.eigentrustIterations || 10,
      convergenceThreshold: options.convergenceThreshold || 0.001,
      decayFactor: options.decayFactor || 0.95, // Daily decay for inactive agents
      ratingWeight: options.ratingWeight || 0.3, // New rating vs historical (0.3 = 30% new)
      ...options
    };

    // Trust graph: Map<fromAgentId, Map<toAgentId, localTrust>>
    this.trustGraph = new Map();

    // Global trust scores: Map<agentId, trustScore>
    this.globalTrust = new Map();

    // Agent statistics for multi-dimensional scoring
    this.agentStats = new Map();

    // Historical interactions for time-based analysis
    this.interactions = [];

    // Peer ratings: Map<toAgentId, Array<{from, rating, timestamp, context}>>
    this.peerRatings = new Map();
  }

  /**
   * Initialize or register an agent in the reputation system
   */
  registerAgent(agentId, initialData = {}) {
    if (!this.agentStats.has(agentId)) {
      this.agentStats.set(agentId, {
        id: agentId,
        name: initialData.name || agentId,
        registeredAt: Date.now(),
        lastActiveAt: Date.now(),
        stats: {
          tasksCompleted: 0,
          tasksAttempted: 0,
          successRate: 100, // Start optimistic
          averageQualityScore: 50,
          averageTaskTime: 300000, // 5 minutes default
          consecutiveDays: 0,
          totalPoints: 0,
          collaborations: 0,
          innovations: 0,
          errors: 0
        },
        reputation: {
          score: 500, // Start at neutral 500/1000
          eigentrust: 0,
          trustLevel: 'neutral',
          trend: 'stable'
        }
      });

      // Initialize in global trust with uniform distribution
      const currentAgents = Array.from(this.agentStats.keys());
      const uniformTrust = 1.0 / currentAgents.length;
      currentAgents.forEach(id => {
        this.globalTrust.set(id, uniformTrust);
      });

      this.emit('agent.registered', { agentId, timestamp: Date.now() });
    }

    return this.agentStats.get(agentId);
  }

  /**
   * Record an interaction between agents
   * This builds the trust graph for EigenTrust computation
   */
  addInteraction(fromAgentId, toAgentId, localTrust, context = {}) {
    // Normalize trust to [0, 1] if needed
    const normalizedTrust = Math.max(0, Math.min(1, localTrust));

    // Ensure both agents are registered
    this.registerAgent(fromAgentId);
    this.registerAgent(toAgentId);

    // Initialize trust graph entry for fromAgent if needed
    if (!this.trustGraph.has(fromAgentId)) {
      this.trustGraph.set(fromAgentId, new Map());
    }

    const agentTrust = this.trustGraph.get(fromAgentId);
    const hasPriorTrust = agentTrust.has(toAgentId);
    const currentTrust = agentTrust.get(toAgentId);

    let updatedTrust;
    if (!hasPriorTrust) {
      // First interaction - use the trust value directly
      updatedTrust = normalizedTrust;
    } else {
      // Update trust using exponential moving average
      // Formula: newTrust = oldTrust × (1 - α) + newRating × α
      const alpha = this.options.ratingWeight;
      updatedTrust = currentTrust * (1 - alpha) + normalizedTrust * alpha;
    }

    agentTrust.set(toAgentId, updatedTrust);

    // Record interaction history
    this.interactions.push({
      from: fromAgentId,
      to: toAgentId,
      trust: normalizedTrust,
      timestamp: Date.now(),
      context
    });

    // Update last active timestamp
    const fromAgent = this.agentStats.get(fromAgentId);
    if (fromAgent) {
      fromAgent.lastActiveAt = Date.now();
    }

    this.emit('interaction.added', {
      fromAgentId,
      toAgentId,
      trust: normalizedTrust,
      timestamp: Date.now()
    });
  }

  /**
   * Compute EigenTrust scores using power iteration method
   *
   * Mathematical Algorithm:
   * 1. Initialize trust vector t^(0) with uniform distribution
   * 2. Iterate: t^(k+1) = C^T × t^(k)
   * 3. Normalize after each iteration
   * 4. Stop when ||t^(k+1) - t^(k)|| < threshold
   *
   * Where C is the column-normalized trust matrix:
   * C[i,j] = localTrust(i,j) / Σ_k localTrust(i,k)
   */
  async computeEigenTrust() {
    // Get all agents (both givers and receivers of trust)
    const allAgents = new Set([...this.agentStats.keys()]);
    const agents = Array.from(allAgents);
    const n = agents.length;

    if (n === 0) {
      return this.globalTrust;
    }

    // Build normalized trust matrix C
    const normalizedMatrix = this.buildNormalizedTrustMatrix(agents);

    // Initialize trust vector with uniform distribution
    let trust = new Map();
    agents.forEach(agent => trust.set(agent, 1.0 / n));

    // Power iteration
    let iteration = 0;
    let converged = false;

    while (iteration < this.options.eigentrustIterations && !converged) {
      const newTrust = new Map();
      let maxDiff = 0;

      // Compute t^(k+1) = C^T × t^(k)
      for (const agentJ of agents) {
        let sum = 0;

        for (const agentI of agents) {
          const trustValue = trust.get(agentI) || 0;
          const matrixValue = normalizedMatrix.get(agentI)?.get(agentJ) || 0;
          sum += trustValue * matrixValue;
        }

        newTrust.set(agentJ, sum);

        // Check convergence
        const diff = Math.abs(sum - (trust.get(agentJ) || 0));
        maxDiff = Math.max(maxDiff, diff);
      }

      // Normalize the trust vector
      const totalTrust = Array.from(newTrust.values()).reduce((a, b) => a + b, 0);
      if (totalTrust > 0) {
        for (const [agent, value] of newTrust) {
          newTrust.set(agent, value / totalTrust);
        }
      }

      trust = newTrust;
      iteration++;

      // Check if converged
      if (maxDiff < this.options.convergenceThreshold) {
        converged = true;
      }
    }

    // Update global trust scores
    this.globalTrust = trust;

    // Update agent reputation with EigenTrust scores
    for (const [agentId, eigentrustScore] of trust) {
      const agent = this.agentStats.get(agentId);
      if (agent) {
        agent.reputation.eigentrust = eigentrustScore;
      }
    }

    this.emit('eigentrust.computed', {
      iterations: iteration,
      converged,
      timestamp: Date.now()
    });

    return trust;
  }

  /**
   * Build column-normalized trust matrix
   * C[i,j] = localTrust(i,j) / Σ_k localTrust(i,k)
   */
  buildNormalizedTrustMatrix(agents) {
    const matrix = new Map();

    for (const agentI of agents) {
      const localTrusts = this.trustGraph.get(agentI) || new Map();
      const rowSum = Array.from(localTrusts.values()).reduce((a, b) => a + b, 0);

      const normalizedRow = new Map();

      if (rowSum > 0) {
        for (const agentJ of agents) {
          const trust = localTrusts.get(agentJ) || 0;
          normalizedRow.set(agentJ, trust / rowSum);
        }
      } else {
        // Agent hasn't rated anyone - uniform distribution
        for (const agentJ of agents) {
          normalizedRow.set(agentJ, 1.0 / agents.length);
        }
      }

      matrix.set(agentI, normalizedRow);
    }

    return matrix;
  }

  /**
   * Calculate comprehensive reputation score using 5 dimensions
   *
   * Final Score = w1×Persistence + w2×Competence + w3×Reputation +
   *               w4×Credibility + w5×Integrity
   *
   * where weights: w1=0.20, w2=0.30, w3=0.25, w4=0.15, w5=0.10
   */
  calculateReputationScore(agentId) {
    const agent = this.agentStats.get(agentId);
    if (!agent) return 0;

    // 1. Persistence (20%): Consistency over time
    const persistence = this.calculatePersistence(agent);

    // 2. Competence (30%): Skill and capability
    const competence = this.calculateCompetence(agent);

    // 3. Reputation (25%): Historical performance
    const reputation = this.calculateHistoricalReputation(agent);

    // 4. Credibility (15%): Peer validation
    const credibility = this.calculateCredibility(agent);

    // 5. Integrity (10%): Error-free execution
    const integrity = this.calculateIntegrity(agent);

    // Weighted sum
    const baseScore = (
      persistence * 0.20 +
      competence * 0.30 +
      reputation * 0.25 +
      credibility * 0.15 +
      integrity * 0.10
    );

    // Apply decay factor for inactivity
    const decayFactor = this.calculateDecayFactor(agent);

    // Apply EigenTrust boost (if computed)
    const eigentrustBoost = (agent.reputation.eigentrust || 0) * 100;

    const finalScore = (baseScore * decayFactor) + eigentrustBoost;

    // Clamp to [0, 1000] range
    return Math.min(1000, Math.max(0, Math.round(finalScore * 10)));
  }

  /**
   * Calculate Persistence Score (0-100)
   *
   * Formula: P = min(100, log(days + 1) × 30)
   *
   * Measures long-term engagement and consistency
   */
  calculatePersistence(agent) {
    const days = agent.stats.consecutiveDays || 0;
    const tasksCompleted = agent.stats.tasksCompleted || 0;

    // Logarithmic scale: persistence increases with days but with diminishing returns
    const dayScore = Math.min(60, Math.log(days + 1) * 20);

    // Activity score based on tasks
    const activityScore = Math.min(40, Math.log(tasksCompleted + 1) * 15);

    return dayScore + activityScore;
  }

  /**
   * Calculate Competence Score (0-100)
   *
   * Formula: C = 0.4×Quality + 0.3×Speed + 0.3×SuccessRate
   *
   * Measures technical skill and capability
   */
  calculateCompetence(agent) {
    const avgQuality = agent.stats.averageQualityScore || 0;
    const avgSpeed = Math.min(1, 300000 / (agent.stats.averageTaskTime || 300000));
    const successRate = agent.stats.successRate || 0;

    const competenceScore = (
      avgQuality * 0.40 +
      avgSpeed * 30 +
      successRate * 0.30
    );

    return competenceScore;
  }

  /**
   * Calculate Historical Reputation (0-100)
   *
   * Formula: R = (totalPoints / 100) × 0.7 + innovations × 0.3
   *
   * Based on accumulated points and innovations
   */
  calculateHistoricalReputation(agent) {
    const points = agent.stats.totalPoints || 0;
    const innovations = agent.stats.innovations || 0;

    const pointScore = Math.min(70, (points / 100) * 0.7);
    const innovationScore = Math.min(30, innovations * 3);

    return pointScore + innovationScore;
  }

  /**
   * Calculate Credibility Score (0-100)
   *
   * Formula: Cr = (avgPeerRating / 5) × 100
   *
   * Based on peer ratings and validations
   */
  calculateCredibility(agent) {
    const ratings = this.peerRatings.get(agent.id) || [];

    if (ratings.length === 0) return 50; // Neutral default

    const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

    // Normalize to 0-100 (assuming ratings are 0-5 stars)
    return (avgRating / 5) * 100;
  }

  /**
   * Calculate Integrity Score (0-100)
   *
   * Formula: I = max(0, 100 - errorRate × 2)
   *
   * High integrity means low error rate
   */
  calculateIntegrity(agent) {
    const successRate = agent.stats.successRate || 0;
    const errorRate = 100 - successRate;

    // Integrity is inversely proportional to errors
    const integrityScore = Math.max(0, 100 - errorRate * 2);

    return integrityScore;
  }

  /**
   * Calculate time-based decay factor
   *
   * Formula: D = decayRate^(daysSinceActive)
   *
   * Recent activity is weighted more heavily
   */
  calculateDecayFactor(agent) {
    const now = Date.now();
    const lastActive = agent.lastActiveAt || now;
    const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24);

    // Exponential decay: score decays by 5% per day of inactivity
    const decayFactor = Math.pow(this.options.decayFactor, daysSinceActive);

    return Math.max(0.5, decayFactor); // Minimum 50% retention
  }

  /**
   * Add peer rating
   */
  addPeerRating(fromAgentId, toAgentId, rating, context = {}) {
    // Ensure agents are registered
    this.registerAgent(fromAgentId);
    this.registerAgent(toAgentId);

    // Normalize rating to [0, 5] scale
    const normalizedRating = Math.max(0, Math.min(5, rating));

    if (!this.peerRatings.has(toAgentId)) {
      this.peerRatings.set(toAgentId, []);
    }

    this.peerRatings.get(toAgentId).push({
      from: fromAgentId,
      rating: normalizedRating,
      timestamp: Date.now(),
      context
    });

    // Also add to trust graph (convert 0-5 rating to 0-1 trust)
    const trustValue = normalizedRating / 5.0;
    this.addInteraction(fromAgentId, toAgentId, trustValue, context);

    this.emit('peer.rating.added', {
      fromAgentId,
      toAgentId,
      rating: normalizedRating,
      timestamp: Date.now()
    });
  }

  /**
   * Update agent statistics
   */
  updateAgentStats(agentId, updates) {
    const agent = this.agentStats.get(agentId);
    if (!agent) return;

    // Merge updates into stats
    Object.assign(agent.stats, updates);

    // Recalculate reputation score
    const newScore = this.calculateReputationScore(agentId);
    const oldScore = agent.reputation.score;

    agent.reputation.score = newScore;
    agent.reputation.trustLevel = this.getTrustLevel(newScore);
    agent.reputation.trend = newScore > oldScore ? 'rising' :
                            newScore < oldScore ? 'falling' : 'stable';

    this.emit('stats.updated', {
      agentId,
      oldScore,
      newScore,
      timestamp: Date.now()
    });
  }

  /**
   * Get trust level category
   */
  getTrustLevel(score) {
    if (score >= 800) return 'exceptional';
    if (score >= 650) return 'excellent';
    if (score >= 500) return 'good';
    if (score >= 350) return 'fair';
    if (score >= 200) return 'poor';
    return 'untrusted';
  }

  /**
   * Get comprehensive reputation summary for an agent
   */
  getReputationSummary(agentId) {
    const agent = this.agentStats.get(agentId);
    if (!agent) return null;

    return {
      agentId: agent.id,
      agentName: agent.name,
      reputationScore: agent.reputation.score,
      trustLevel: agent.reputation.trustLevel,
      eigentrust: agent.reputation.eigentrust,
      trend: agent.reputation.trend,
      breakdown: {
        persistence: this.calculatePersistence(agent),
        competence: this.calculateCompetence(agent),
        reputation: this.calculateHistoricalReputation(agent),
        credibility: this.calculateCredibility(agent),
        integrity: this.calculateIntegrity(agent)
      },
      stats: agent.stats,
      peerRatings: this.peerRatings.get(agentId) || [],
      lastActiveAt: agent.lastActiveAt,
      registeredAt: agent.registeredAt
    };
  }

  /**
   * Get top agents by reputation
   */
  getLeaderboard(limit = 10) {
    const agents = Array.from(this.agentStats.values());

    agents.sort((a, b) => b.reputation.score - a.reputation.score);

    return agents.slice(0, limit).map(agent => ({
      agentId: agent.id,
      agentName: agent.name,
      reputationScore: agent.reputation.score,
      trustLevel: agent.reputation.trustLevel,
      eigentrust: agent.reputation.eigentrust,
      trend: agent.reputation.trend
    }));
  }

  /**
   * Get agents with reputation below threshold (potential issues)
   */
  getLowReputationAgents(threshold = 300) {
    const agents = Array.from(this.agentStats.values());

    return agents
      .filter(agent => agent.reputation.score < threshold)
      .map(agent => ({
        agentId: agent.id,
        agentName: agent.name,
        reputationScore: agent.reputation.score,
        trustLevel: agent.reputation.trustLevel,
        issues: this.identifyReputationIssues(agent)
      }));
  }

  /**
   * Identify specific reputation issues
   */
  identifyReputationIssues(agent) {
    const issues = [];

    if (this.calculatePersistence(agent) < 30) {
      issues.push('low_persistence');
    }
    if (this.calculateCompetence(agent) < 40) {
      issues.push('low_competence');
    }
    if (this.calculateCredibility(agent) < 40) {
      issues.push('low_credibility');
    }
    if (this.calculateIntegrity(agent) < 50) {
      issues.push('low_integrity');
    }
    if (this.calculateDecayFactor(agent) < 0.8) {
      issues.push('inactive');
    }

    return issues;
  }

  /**
   * Export reputation data for persistence
   */
  exportData() {
    return {
      trustGraph: Array.from(this.trustGraph.entries()).map(([from, trusts]) => ({
        from,
        trusts: Array.from(trusts.entries())
      })),
      globalTrust: Array.from(this.globalTrust.entries()),
      agentStats: Array.from(this.agentStats.entries()),
      peerRatings: Array.from(this.peerRatings.entries()),
      interactions: this.interactions
    };
  }

  /**
   * Import reputation data from persistence
   */
  importData(data) {
    if (data.trustGraph) {
      this.trustGraph = new Map(
        data.trustGraph.map(({ from, trusts }) => [from, new Map(trusts)])
      );
    }
    if (data.globalTrust) {
      this.globalTrust = new Map(data.globalTrust);
    }
    if (data.agentStats) {
      this.agentStats = new Map(data.agentStats);
    }
    if (data.peerRatings) {
      this.peerRatings = new Map(data.peerRatings);
    }
    if (data.interactions) {
      this.interactions = data.interactions;
    }
  }
}

export default ReputationSystem;
