/**
 * 🏆 LEADERBOARD SYSTEM
 * Agent 13 - Rankings & Hall of Fame
 *
 * Features:
 * - ELO rating system with time decay
 * - 8 category leaderboards
 * - Hall of Fame (permanent records)
 * - Weekly/Monthly/Quarterly/Yearly rankings
 * - Real-time ranking updates
 */

import { EventEmitter } from 'events';

// ============================================
// CONFIGURATION
// ============================================

const LEADERBOARD_CATEGORIES = {
  OVERALL: {
    id: 'overall',
    name: 'Overall Performance',
    description: 'Comprehensive score across all metrics',
    icon: '🏆',
    weights: {
      taskCompletion: 0.25,
      quality: 0.25,
      speed: 0.15,
      collaboration: 0.15,
      innovation: 0.10,
      consistency: 0.10
    }
  },

  SPEED: {
    id: 'speed',
    name: 'Speed Champion',
    description: 'Fastest task completion',
    icon: '⚡',
    metric: 'speedScore'
  },

  QUALITY: {
    id: 'quality',
    name: 'Quality Master',
    description: 'Highest quality outputs',
    icon: '💎',
    metric: 'qualityScore'
  },

  COLLABORATION: {
    id: 'collaboration',
    name: 'Collaboration King',
    description: 'Best team player',
    icon: '🤝',
    metric: 'collaborationScore'
  },

  INNOVATION: {
    id: 'innovation',
    name: 'Innovation Leader',
    description: 'Most creative solutions',
    icon: '💡',
    metric: 'innovationScore'
  },

  CONSISTENCY: {
    id: 'consistency',
    name: 'Consistency Award',
    description: 'Most reliable performance',
    icon: '🎖️',
    metric: 'consistencyScore'
  },

  IMPROVED: {
    id: 'improved',
    name: 'Most Improved',
    description: 'Greatest performance growth',
    icon: '📈',
    metric: 'improvementScore'
  },

  RELIABILITY: {
    id: 'reliability',
    name: 'Reliability Expert',
    description: 'Lowest failure rate',
    icon: '🛡️',
    metric: 'reliabilityScore'
  }
};

const RANKING_PERIODS = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
  ALL_TIME: 'all-time'
};

const HALL_OF_FAME_TIERS = {
  LEGEND: {
    title: 'Legend',
    minPoints: 50000,
    minYearsActive: 3,
    minQuality: 98,
    badge: '👑'
  },
  MASTER: {
    title: 'Master',
    minPoints: 20000,
    minYearsActive: 1,
    minQuality: 95,
    badge: '⭐'
  },
  EXPERT: {
    title: 'Expert',
    minPoints: 10000,
    minMonths: 6,
    minQuality: 92,
    badge: '🌟'
  }
};

// ============================================
// ELO RATING SYSTEM
// ============================================

class ELORatingSystem {
  constructor(config = {}) {
    this.defaultRating = config.defaultRating || 1500;
    this.kFactor = config.kFactor || 32;
    this.decayHalfLife = config.decayHalfLife || 30; // days
    this.decayConstant = Math.log(2) / this.decayHalfLife;
  }

  /**
   * Calculate expected score between two agents
   */
  calculateExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Update rating after a match
   */
  updateRating(currentRating, expectedScore, actualScore, kFactor = null) {
    const k = kFactor || this.getKFactor(currentRating);
    const newRating = currentRating + k * (actualScore - expectedScore);
    return Math.max(0, Math.round(newRating));
  }

  /**
   * Get K-factor based on rating and experience
   */
  getKFactor(rating, tasksCompleted = 0) {
    // New agents: high volatility
    if (tasksCompleted < 10) return 40;
    if (tasksCompleted < 50) return 32;

    // Established agents: medium volatility
    if (tasksCompleted < 200) return 24;

    // Veterans: low volatility
    return 16;
  }

  /**
   * Calculate actual score from performance
   */
  calculateActualScore(performance, benchmark) {
    if (performance >= benchmark * 1.2) return 1.0; // Exceeded
    if (performance >= benchmark * 0.8) return 0.5; // Met
    return 0.0; // Below
  }

  /**
   * Calculate time decay weight
   */
  calculateDecayWeight(daysAgo) {
    return Math.exp(-this.decayConstant * daysAgo);
  }

  /**
   * Calculate weighted score with time decay
   */
  calculateWeightedScore(performances) {
    if (!performances || performances.length === 0) return 0;

    const now = Date.now();
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const perf of performances) {
      const daysAgo = (now - perf.timestamp) / (1000 * 60 * 60 * 24);
      const weight = this.calculateDecayWeight(daysAgo);

      totalWeightedScore += perf.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  }

  /**
   * Apply time decay to rating
   */
  applyTimeDecay(rating, daysSinceLastActive) {
    if (daysSinceLastActive < 13 * 7) return rating; // No decay before 13 weeks

    // Decay 20% of rating above default every 13 weeks
    const decayPeriods = Math.floor(daysSinceLastActive / (13 * 7));
    const ratingAboveDefault = rating - this.defaultRating;
    const decay = ratingAboveDefault * 0.20 * decayPeriods;

    return Math.round(Math.max(this.defaultRating, rating - decay));
  }
}

// ============================================
// LEADERBOARD ENTRY
// ============================================

class LeaderboardEntry {
  constructor(agent, category, period) {
    this.agentId = agent.id;
    this.agentName = agent.name;
    this.agentType = agent.type;
    this.category = category;
    this.period = period;

    this.rank = 0;
    this.previousRank = 0;
    this.score = 0;
    this.eloRating = agent.eloRating || 1500;

    this.metrics = {
      tasksCompleted: 0,
      averageQuality: 0,
      averageSpeed: 0,
      battlesWon: 0,
      collaborations: 0
    };

    this.trend = 'stable'; // rising, stable, falling
    this.badges = agent.badges || [];
    this.tier = agent.tier || 'Bronze';

    this.lastUpdated = Date.now();
  }

  /**
   * Update entry with new data
   */
  update(metrics, score) {
    this.previousRank = this.rank;
    this.score = score;
    this.metrics = { ...this.metrics, ...metrics };
    this.lastUpdated = Date.now();

    return this;
  }

  /**
   * Calculate rank change
   */
  getRankChange() {
    if (this.previousRank === 0) return 0;
    return this.previousRank - this.rank;
  }

  /**
   * Get display object
   */
  toDisplay() {
    return {
      rank: this.rank,
      agentId: this.agentId,
      agentName: this.agentName,
      score: Math.round(this.score),
      eloRating: this.eloRating,
      rankChange: this.getRankChange(),
      trend: this.trend,
      tier: this.tier,
      badges: this.badges.slice(0, 3), // Top 3 badges
      metrics: this.metrics
    };
  }
}

// ============================================
// LEADERBOARD
// ============================================

class Leaderboard extends EventEmitter {
  constructor(category, period = RANKING_PERIODS.ALL_TIME) {
    super();

    this.category = category;
    this.period = period;
    this.config = LEADERBOARD_CATEGORIES[category.toUpperCase()];

    this.entries = new Map(); // agentId -> LeaderboardEntry
    this.rankings = []; // Sorted array of entries

    this.periodStart = this.calculatePeriodStart(period);
    this.periodEnd = null;

    this.lastUpdate = Date.now();
    this.updateCount = 0;
  }

  /**
   * Calculate period start date
   */
  calculatePeriodStart(period) {
    const now = new Date();

    switch (period) {
      case RANKING_PERIODS.WEEKLY:
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.setDate(diff)).setHours(0, 0, 0, 0);

      case RANKING_PERIODS.MONTHLY:
        return new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      case RANKING_PERIODS.QUARTERLY:
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 1).getTime();

      case RANKING_PERIODS.YEARLY:
        return new Date(now.getFullYear(), 0, 1).getTime();

      default:
        return 0; // All-time
    }
  }

  /**
   * Add or update agent entry
   */
  upsertEntry(agent, metrics, score) {
    let entry = this.entries.get(agent.id);

    if (!entry) {
      entry = new LeaderboardEntry(agent, this.category, this.period);
      this.entries.set(agent.id, entry);
    }

    entry.update(metrics, score);

    // Recalculate rankings
    this.updateRankings();

    this.emit('entry-updated', { entry });

    return entry;
  }

  /**
   * Update all rankings
   */
  updateRankings() {
    // Convert to array and sort by score
    this.rankings = Array.from(this.entries.values())
      .sort((a, b) => b.score - a.score);

    // Assign ranks and calculate trends
    this.rankings.forEach((entry, index) => {
      entry.rank = index + 1;

      // Calculate trend
      if (entry.previousRank === 0) {
        entry.trend = 'new';
      } else {
        const change = entry.getRankChange();
        if (change > 0) entry.trend = 'rising';
        else if (change < 0) entry.trend = 'falling';
        else entry.trend = 'stable';
      }
    });

    this.lastUpdate = Date.now();
    this.updateCount++;

    this.emit('rankings-updated', { rankings: this.rankings });
  }

  /**
   * Get top N entries
   */
  getTop(n = 10) {
    return this.rankings.slice(0, n).map(e => e.toDisplay());
  }

  /**
   * Get agent's ranking
   */
  getAgentRank(agentId) {
    const entry = this.entries.get(agentId);
    return entry ? entry.toDisplay() : null;
  }

  /**
   * Get entries by rank range
   */
  getRange(start, end) {
    return this.rankings
      .slice(start - 1, end)
      .map(e => e.toDisplay());
  }

  /**
   * Get trending agents (biggest movers)
   */
  getTrending(n = 5) {
    return this.rankings
      .filter(e => e.previousRank > 0)
      .sort((a, b) => b.getRankChange() - a.getRankChange())
      .slice(0, n)
      .map(e => e.toDisplay());
  }

  /**
   * Reset leaderboard for new period
   */
  reset() {
    this.periodEnd = Date.now();

    // Archive current rankings
    const archive = {
      category: this.category,
      period: this.period,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      rankings: this.getTop(100),
      archivedAt: Date.now()
    };

    // Clear entries
    this.entries.clear();
    this.rankings = [];

    // Start new period
    this.periodStart = this.calculatePeriodStart(this.period);
    this.periodEnd = null;

    this.emit('leaderboard-reset', { archive });

    return archive;
  }

  /**
   * Get leaderboard summary
   */
  getSummary() {
    return {
      category: this.category,
      name: this.config.name,
      period: this.period,
      totalAgents: this.entries.size,
      lastUpdate: this.lastUpdate,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      top3: this.getTop(3),
      trending: this.getTrending(3)
    };
  }
}

// ============================================
// LEADERBOARD MANAGER
// ============================================

class LeaderboardManager extends EventEmitter {
  constructor() {
    super();

    this.eloSystem = new ELORatingSystem();
    this.leaderboards = new Map(); // category:period -> Leaderboard
    this.hallOfFame = new Map(); // agentId -> HallOfFameEntry

    this.initializeLeaderboards();
  }

  /**
   * Initialize all leaderboard categories and periods
   */
  initializeLeaderboards() {
    for (const category of Object.keys(LEADERBOARD_CATEGORIES)) {
      for (const period of Object.values(RANKING_PERIODS)) {
        const key = `${category}:${period}`;
        const leaderboard = new Leaderboard(category, period);

        // Forward events
        leaderboard.on('rankings-updated', (data) => {
          this.emit('rankings-updated', {
            category,
            period,
            ...data
          });
        });

        this.leaderboards.set(key, leaderboard);
      }
    }
  }

  /**
   * Get leaderboard by category and period
   */
  getLeaderboard(category, period = RANKING_PERIODS.ALL_TIME) {
    const key = `${category.toUpperCase()}:${period}`;
    return this.leaderboards.get(key);
  }

  /**
   * Update agent rankings across all leaderboards
   */
  updateAgentRankings(agent, metrics) {
    const scores = this.calculateCategoryScores(agent, metrics);

    // Update each category leaderboard
    for (const [category, score] of Object.entries(scores)) {
      // Update all periods
      for (const period of Object.values(RANKING_PERIODS)) {
        const leaderboard = this.getLeaderboard(category, period);
        if (leaderboard) {
          leaderboard.upsertEntry(agent, metrics, score);
        }
      }
    }

    // Check Hall of Fame eligibility
    this.checkHallOfFameEligibility(agent);

    return scores;
  }

  /**
   * Calculate scores for all categories
   */
  calculateCategoryScores(agent, metrics) {
    const scores = {};

    // Overall score (weighted)
    const overallConfig = LEADERBOARD_CATEGORIES.OVERALL;
    scores.OVERALL = Object.entries(overallConfig.weights).reduce((sum, [key, weight]) => {
      return sum + (metrics[key] || 0) * weight;
    }, 0) * 100;

    // Category-specific scores
    scores.SPEED = this.calculateSpeedScore(metrics);
    scores.QUALITY = this.calculateQualityScore(metrics);
    scores.COLLABORATION = this.calculateCollaborationScore(metrics);
    scores.INNOVATION = this.calculateInnovationScore(metrics);
    scores.CONSISTENCY = this.calculateConsistencyScore(metrics);
    scores.IMPROVED = this.calculateImprovementScore(agent, metrics);
    scores.RELIABILITY = this.calculateReliabilityScore(metrics);

    // Apply ELO rating influence
    const eloMultiplier = agent.eloRating / 1500;
    for (const category in scores) {
      scores[category] *= eloMultiplier;
    }

    return scores;
  }

  /**
   * Calculate speed score
   */
  calculateSpeedScore(metrics) {
    if (!metrics.averageSpeed) return 0;

    const speedScore = (1 / metrics.averageSpeed) * 1000;
    const qualityMultiplier = metrics.averageQuality >= 95 ? 1.5 :
                             metrics.averageQuality >= 90 ? 1.2 :
                             metrics.averageQuality >= 85 ? 1.0 : 0.8;

    return speedScore * qualityMultiplier;
  }

  /**
   * Calculate quality score
   */
  calculateQualityScore(metrics) {
    const factors = {
      successRate: metrics.successRate || 0,
      firstTimeSuccess: metrics.firstTimeSuccess || 0,
      codeQuality: metrics.codeQuality || 0,
      peerReview: metrics.peerReviewScore || 0
    };

    return (
      factors.successRate * 0.4 +
      factors.firstTimeSuccess * 0.3 +
      factors.codeQuality * 0.2 +
      factors.peerReview * 0.1
    );
  }

  /**
   * Calculate collaboration score
   */
  calculateCollaborationScore(metrics) {
    return (
      (metrics.brainstormParticipation || 0) * 0.3 +
      (metrics.helpGiven || 0) * 0.3 +
      (metrics.positiveFeedback || 0) * 0.2 +
      (metrics.crossTeamProjects || 0) * 0.2
    );
  }

  /**
   * Calculate innovation score
   */
  calculateInnovationScore(metrics) {
    return (
      (metrics.newApproaches || 0) * 0.35 +
      (metrics.creativeSolutions || 0) * 0.30 +
      (metrics.systemImprovements || 0) * 0.25 +
      (metrics.peerRecognition || 0) * 0.10
    );
  }

  /**
   * Calculate consistency score
   */
  calculateConsistencyScore(metrics) {
    const performanceVariance = metrics.stdDev ?
      1 - (metrics.stdDev / metrics.mean) : 0.5;

    return (
      (metrics.uptime || 0) * 0.3 +
      performanceVariance * 0.3 +
      Math.min((metrics.dailyStreak || 0) / 365, 1) * 0.2 +
      (metrics.predictability || 0) * 0.2
    ) * 100;
  }

  /**
   * Calculate improvement score
   */
  calculateImprovementScore(agent, metrics) {
    if (!metrics.baseline || !metrics.currentScore) return 0;

    const improvementPct = ((metrics.currentScore - metrics.baseline) /
                           metrics.baseline) * 100;

    return Math.max(0, improvementPct);
  }

  /**
   * Calculate reliability score
   */
  calculateReliabilityScore(metrics) {
    return (
      (metrics.uptime || 0) * 0.4 +
      (1 - (metrics.failureRate || 0)) * 0.3 +
      Math.min((metrics.mtbf || 0) / 1000, 1) * 0.2 +
      (metrics.recoverySpeed || 0) * 0.1
    ) * 100;
  }

  /**
   * Get agent's rankings across all categories
   */
  getAgentRankings(agentId, period = RANKING_PERIODS.ALL_TIME) {
    const rankings = {};

    for (const category of Object.keys(LEADERBOARD_CATEGORIES)) {
      const leaderboard = this.getLeaderboard(category, period);
      if (leaderboard) {
        rankings[category] = leaderboard.getAgentRank(agentId);
      }
    }

    return rankings;
  }

  /**
   * Get all leaderboards summary
   */
  getAllLeaderboards(period = RANKING_PERIODS.ALL_TIME) {
    const summaries = {};

    for (const category of Object.keys(LEADERBOARD_CATEGORIES)) {
      const leaderboard = this.getLeaderboard(category, period);
      if (leaderboard) {
        summaries[category] = leaderboard.getSummary();
      }
    }

    return summaries;
  }

  /**
   * Check if agent qualifies for Hall of Fame
   */
  checkHallOfFameEligibility(agent) {
    for (const [tier, criteria] of Object.entries(HALL_OF_FAME_TIERS)) {
      if (this.meetsHallOfFameCriteria(agent, criteria)) {
        this.inductToHallOfFame(agent, tier);
        break; // Only highest tier
      }
    }
  }

  /**
   * Check if agent meets Hall of Fame criteria
   */
  meetsHallOfFameCriteria(agent, criteria) {
    // Check points
    if (agent.points && agent.points.total < criteria.minPoints) {
      return false;
    }

    // Check quality
    if (agent.stats && agent.stats.averageQuality < criteria.minQuality) {
      return false;
    }

    // Check time active
    if (criteria.minYearsActive) {
      const yearsActive = agent.stats.daysActive / 365;
      if (yearsActive < criteria.minYearsActive) {
        return false;
      }
    }

    return true;
  }

  /**
   * Induct agent to Hall of Fame
   */
  inductToHallOfFame(agent, tier) {
    // Check if already inducted
    if (this.hallOfFame.has(agent.id)) {
      const existing = this.hallOfFame.get(agent.id);
      // Only upgrade tier if higher
      const tiers = Object.keys(HALL_OF_FAME_TIERS);
      if (tiers.indexOf(tier) > tiers.indexOf(existing.tier)) {
        return;
      }
    }

    const entry = {
      agentId: agent.id,
      agentName: agent.name,
      tier,
      badge: HALL_OF_FAME_TIERS[tier].badge,
      inductionDate: Date.now(),
      achievements: {
        totalPoints: agent.points?.total || 0,
        totalTasks: agent.stats?.tasksCompleted || 0,
        averageQuality: agent.stats?.averageQuality || 0,
        yearsActive: (agent.stats?.daysActive || 0) / 365,
        battlesWon: agent.stats?.battlesWon || 0
      },
      legacy: agent.legacy || ''
    };

    this.hallOfFame.set(agent.id, entry);

    this.emit('hall-of-fame-induction', { entry });

    return entry;
  }

  /**
   * Get Hall of Fame members
   */
  getHallOfFame(tier = null) {
    const members = Array.from(this.hallOfFame.values());

    if (tier) {
      return members.filter(m => m.tier === tier.toUpperCase());
    }

    // Sort by tier (LEGEND > MASTER > EXPERT) then by induction date
    return members.sort((a, b) => {
      const tierOrder = { LEGEND: 0, MASTER: 1, EXPERT: 2 };
      const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.inductionDate - a.inductionDate;
    });
  }

  /**
   * Reset period-based leaderboards
   */
  resetPeriod(period) {
    const archives = [];

    for (const category of Object.keys(LEADERBOARD_CATEGORIES)) {
      const leaderboard = this.getLeaderboard(category, period);
      if (leaderboard) {
        const archive = leaderboard.reset();
        archives.push(archive);
      }
    }

    this.emit('period-reset', { period, archives });

    return archives;
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    const stats = {
      totalAgents: 0,
      totalLeaderboards: this.leaderboards.size,
      hallOfFameMembers: this.hallOfFame.size,
      byCategory: {},
      byPeriod: {}
    };

    for (const [key, leaderboard] of this.leaderboards) {
      const [category, period] = key.split(':');

      if (!stats.byCategory[category]) {
        stats.byCategory[category] = 0;
      }
      stats.byCategory[category] += leaderboard.entries.size;

      if (!stats.byPeriod[period]) {
        stats.byPeriod[period] = 0;
      }
      stats.byPeriod[period] += leaderboard.entries.size;

      stats.totalAgents = Math.max(stats.totalAgents, leaderboard.entries.size);
    }

    return stats;
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  ELORatingSystem,
  Leaderboard,
  LeaderboardEntry,
  LeaderboardManager,
  LEADERBOARD_CATEGORIES,
  RANKING_PERIODS,
  HALL_OF_FAME_TIERS
};
