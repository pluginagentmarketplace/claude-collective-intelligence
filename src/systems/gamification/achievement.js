#!/usr/bin/env node
/**
 * Achievement System - Badge and achievement tracking for agents
 * 50+ achievements across 8 categories with progression tiers
 *
 * @module gamification/achievement-system
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Achievement definitions across multiple categories
 */
export const ACHIEVEMENTS = {
  // ============ SPEED ACHIEVEMENTS ============
  SPEED_DEMON: {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Complete 10 tasks in under 1 minute each',
    category: 'speed',
    tier: 'bronze',
    criteria: { fastTasks: 10, maxTime: 60000 },
    points: 100,
    icon: '⚡'
  },
  LIGHTNING_FAST: {
    id: 'lightning-fast',
    name: 'Lightning Fast',
    description: 'Complete 50 tasks in under 30 seconds each',
    category: 'speed',
    tier: 'silver',
    criteria: { fastTasks: 50, maxTime: 30000 },
    points: 300,
    icon: '⚡⚡'
  },
  SPEED_OF_LIGHT: {
    id: 'speed-of-light',
    name: 'Speed of Light',
    description: 'Complete 100 tasks in under 15 seconds each',
    category: 'speed',
    tier: 'gold',
    criteria: { fastTasks: 100, maxTime: 15000 },
    points: 1000,
    icon: '⚡⚡⚡'
  },
  SONIC_BOOM: {
    id: 'sonic-boom',
    name: 'Sonic Boom',
    description: 'Complete a task 5x faster than expected',
    category: 'speed',
    tier: 'bronze',
    criteria: { speedMultiplier: 5.0 },
    points: 150,
    icon: '💨'
  },

  // ============ QUALITY ACHIEVEMENTS ============
  QUALITY_MASTER: {
    id: 'quality-master',
    name: 'Quality Master',
    description: 'Achieve 100% quality score on 25 tasks',
    category: 'quality',
    tier: 'bronze',
    criteria: { perfectTasks: 25 },
    points: 200,
    icon: '💎'
  },
  PERFECTION: {
    id: 'perfection',
    name: 'Perfection',
    description: 'Maintain 95%+ quality score for 100 tasks',
    category: 'quality',
    tier: 'silver',
    criteria: { highQualityStreak: 100, minQuality: 0.95 },
    points: 500,
    icon: '💎💎'
  },
  FLAWLESS: {
    id: 'flawless',
    name: 'Flawless',
    description: 'Zero errors in 1000 tasks',
    category: 'quality',
    tier: 'gold',
    criteria: { errorFreeTasks: 1000 },
    points: 2000,
    icon: '💎💎💎'
  },
  DETAIL_ORIENTED: {
    id: 'detail-oriented',
    name: 'Detail Oriented',
    description: 'Perfect documentation on 50 tasks',
    category: 'quality',
    tier: 'bronze',
    criteria: { perfectDocumentation: 50 },
    points: 150,
    icon: '📝'
  },
  CODE_ARTISAN: {
    id: 'code-artisan',
    name: 'Code Artisan',
    description: 'Perfect code style on 100 tasks',
    category: 'quality',
    tier: 'silver',
    criteria: { perfectCodeStyle: 100 },
    points: 400,
    icon: '🎨'
  },

  // ============ COLLABORATION ACHIEVEMENTS ============
  TEAM_PLAYER: {
    id: 'team-player',
    name: 'Team Player',
    description: 'Participate in 10 collaborative sessions',
    category: 'collaboration',
    tier: 'bronze',
    criteria: { collaborations: 10 },
    points: 150,
    icon: '🤝'
  },
  COLLABORATION_KING: {
    id: 'collaboration-king',
    name: 'Collaboration King',
    description: 'Lead consensus in 50 brainstorming sessions',
    category: 'collaboration',
    tier: 'silver',
    criteria: { leadConsensus: 50 },
    points: 400,
    icon: '🤝🤝'
  },
  ULTIMATE_COLLABORATOR: {
    id: 'ultimate-collaborator',
    name: 'Ultimate Collaborator',
    description: 'Achieve 5.0 rating in 100 collaborative sessions',
    category: 'collaboration',
    tier: 'gold',
    criteria: { highRatedCollabs: 100, minRating: 5.0 },
    points: 1500,
    icon: '🤝🤝🤝'
  },
  HELPFUL_SOUL: {
    id: 'helpful-soul',
    name: 'Helpful Soul',
    description: 'Assist 25 other agents with their tasks',
    category: 'collaboration',
    tier: 'bronze',
    criteria: { assistedAgents: 25 },
    points: 100,
    icon: '🆘'
  },
  MENTOR: {
    id: 'mentor',
    name: 'Mentor',
    description: 'Successfully mentor 10 new agents',
    category: 'collaboration',
    tier: 'silver',
    criteria: { mentoredAgents: 10 },
    points: 500,
    icon: '👨‍🏫'
  },
  KNOWLEDGE_SHARER: {
    id: 'knowledge-sharer',
    name: 'Knowledge Sharer',
    description: 'Share knowledge in 50 sessions',
    category: 'collaboration',
    tier: 'bronze',
    criteria: { knowledgeShares: 50 },
    points: 200,
    icon: '📚'
  },

  // ============ INNOVATION ACHIEVEMENTS ============
  INNOVATOR: {
    id: 'innovator',
    name: 'Innovator',
    description: 'Create 5 novel solutions',
    category: 'innovation',
    tier: 'bronze',
    criteria: { novelSolutions: 5 },
    points: 250,
    icon: '💡'
  },
  CREATIVE_GENIUS: {
    id: 'creative-genius',
    name: 'Creative Genius',
    description: 'Achieve 90%+ novelty score on 25 solutions',
    category: 'innovation',
    tier: 'silver',
    criteria: { highNovelty: 25, minNovelty: 0.9 },
    points: 750,
    icon: '💡💡'
  },
  PARADIGM_SHIFTER: {
    id: 'paradigm-shifter',
    name: 'Paradigm Shifter',
    description: 'Create breakthrough solution adopted by 50+ agents',
    category: 'innovation',
    tier: 'gold',
    criteria: { breakthroughAdoptions: 50 },
    points: 3000,
    icon: '💡💡💡'
  },
  FIRST_MOVER: {
    id: 'first-mover',
    name: 'First Mover',
    description: 'Be the first to solve a new type of problem',
    category: 'innovation',
    tier: 'bronze',
    criteria: { firstSolver: 1 },
    points: 200,
    icon: '🥇'
  },
  PATTERN_BREAKER: {
    id: 'pattern-breaker',
    name: 'Pattern Breaker',
    description: 'Create 10 solutions using unique approaches',
    category: 'innovation',
    tier: 'silver',
    criteria: { uniqueApproaches: 10 },
    points: 600,
    icon: '🔨'
  },

  // ============ BATTLE ACHIEVEMENTS ============
  WARRIOR: {
    id: 'warrior',
    name: 'Warrior',
    description: 'Win 10 battles',
    category: 'battle',
    tier: 'bronze',
    criteria: { battlesWon: 10 },
    points: 200,
    icon: '⚔️'
  },
  CHAMPION: {
    id: 'champion',
    name: 'Champion',
    description: 'Win 50 battles with 80%+ win rate',
    category: 'battle',
    tier: 'silver',
    criteria: { battlesWon: 50, minWinRate: 0.8 },
    points: 600,
    icon: '⚔️⚔️'
  },
  LEGEND: {
    id: 'legend',
    name: 'Legend',
    description: 'Win 200 battles, top 10 on battle leaderboard',
    category: 'battle',
    tier: 'gold',
    criteria: { battlesWon: 200, leaderboardRank: 10 },
    points: 2500,
    icon: '⚔️⚔️⚔️'
  },
  UNDEFEATED: {
    id: 'undefeated',
    name: 'Undefeated',
    description: 'Win 10 battles in a row without losing',
    category: 'battle',
    tier: 'silver',
    criteria: { winStreak: 10 },
    points: 800,
    icon: '🛡️'
  },
  COMEBACK_KID: {
    id: 'comeback-kid',
    name: 'Comeback Kid',
    description: 'Win 5 battles from behind',
    category: 'battle',
    tier: 'bronze',
    criteria: { comebackWins: 5 },
    points: 150,
    icon: '🔄'
  },
  TOURNAMENT_VICTOR: {
    id: 'tournament-victor',
    name: 'Tournament Victor',
    description: 'Win a tournament championship',
    category: 'battle',
    tier: 'gold',
    criteria: { tournamentsWon: 1 },
    points: 1000,
    icon: '🏆'
  },

  // ============ CONSISTENCY ACHIEVEMENTS ============
  RELIABLE: {
    id: 'reliable',
    name: 'Reliable',
    description: 'Active for 7 consecutive days',
    category: 'consistency',
    tier: 'bronze',
    criteria: { consecutiveDays: 7 },
    points: 100,
    icon: '📅'
  },
  DEDICATED: {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Active for 30 consecutive days',
    category: 'consistency',
    tier: 'silver',
    criteria: { consecutiveDays: 30 },
    points: 500,
    icon: '📅📅'
  },
  UNSTOPPABLE: {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Active for 365 consecutive days',
    category: 'consistency',
    tier: 'gold',
    criteria: { consecutiveDays: 365 },
    points: 5000,
    icon: '📅📅📅'
  },
  EARLY_BIRD: {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Complete 50 tasks before 8am',
    category: 'consistency',
    tier: 'bronze',
    criteria: { earlyMorningTasks: 50 },
    points: 100,
    icon: '🌅'
  },
  NIGHT_OWL: {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Complete 50 tasks after 10pm',
    category: 'consistency',
    tier: 'bronze',
    criteria: { lateNightTasks: 50 },
    points: 100,
    icon: '🦉'
  },
  WEEKEND_WARRIOR: {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Complete 100 tasks on weekends',
    category: 'consistency',
    tier: 'silver',
    criteria: { weekendTasks: 100 },
    points: 300,
    icon: '📆'
  },

  // ============ MILESTONE ACHIEVEMENTS ============
  FIRST_BLOOD: {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Complete your first task',
    category: 'milestone',
    tier: 'bronze',
    criteria: { tasksCompleted: 1 },
    points: 10,
    icon: '🎯'
  },
  GETTING_STARTED: {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Complete 10 tasks',
    category: 'milestone',
    tier: 'bronze',
    criteria: { tasksCompleted: 10 },
    points: 50,
    icon: '🎯'
  },
  CENTURION: {
    id: 'centurion',
    name: 'Centurion',
    description: 'Complete 100 tasks',
    category: 'milestone',
    tier: 'silver',
    criteria: { tasksCompleted: 100 },
    points: 200,
    icon: '🎯🎯'
  },
  VETERAN: {
    id: 'veteran',
    name: 'Veteran',
    description: 'Complete 500 tasks',
    category: 'milestone',
    tier: 'silver',
    criteria: { tasksCompleted: 500 },
    points: 800,
    icon: '🎖️'
  },
  THOUSAND_CLUB: {
    id: 'thousand-club',
    name: 'Thousand Club',
    description: 'Complete 1000 tasks',
    category: 'milestone',
    tier: 'gold',
    criteria: { tasksCompleted: 1000 },
    points: 3000,
    icon: '🎯🎯🎯'
  },
  POINTS_MILLIONAIRE: {
    id: 'points-millionaire',
    name: 'Points Millionaire',
    description: 'Earn 1,000,000 total points',
    category: 'milestone',
    tier: 'gold',
    criteria: { totalPoints: 1000000 },
    points: 10000,
    icon: '💰'
  },
  ELITE_FIFTY: {
    id: 'elite-fifty',
    name: 'Elite Fifty',
    description: 'Reach top 50 on global leaderboard',
    category: 'milestone',
    tier: 'silver',
    criteria: { globalRank: 50 },
    points: 500,
    icon: '🏅'
  },
  TOP_TEN: {
    id: 'top-ten',
    name: 'Top Ten',
    description: 'Reach top 10 on global leaderboard',
    category: 'milestone',
    tier: 'gold',
    criteria: { globalRank: 10 },
    points: 2000,
    icon: '🥇'
  },
  NUMBER_ONE: {
    id: 'number-one',
    name: 'Number One',
    description: 'Reach #1 on global leaderboard',
    category: 'milestone',
    tier: 'gold',
    criteria: { globalRank: 1 },
    points: 5000,
    icon: '👑'
  },

  // ============ REPUTATION ACHIEVEMENTS ============
  TRUSTED: {
    id: 'trusted',
    name: 'Trusted',
    description: 'Reach 500 reputation score',
    category: 'reputation',
    tier: 'bronze',
    criteria: { reputationScore: 500 },
    points: 100,
    icon: '⭐'
  },
  EXPERT: {
    id: 'expert',
    name: 'Expert',
    description: 'Reach 750 reputation score',
    category: 'reputation',
    tier: 'silver',
    criteria: { reputationScore: 750 },
    points: 300,
    icon: '⭐⭐'
  },
  LEGENDARY: {
    id: 'legendary',
    name: 'Legendary',
    description: 'Reach 900 reputation score',
    category: 'reputation',
    tier: 'gold',
    criteria: { reputationScore: 900 },
    points: 1000,
    icon: '⭐⭐⭐'
  },
  PEER_APPROVED: {
    id: 'peer-approved',
    name: 'Peer Approved',
    description: 'Receive 100 positive peer reviews',
    category: 'reputation',
    tier: 'silver',
    criteria: { positiveReviews: 100 },
    points: 400,
    icon: '👍'
  },
  COMMUNITY_FAVORITE: {
    id: 'community-favorite',
    name: 'Community Favorite',
    description: 'Receive 500 endorsements from other agents',
    category: 'reputation',
    tier: 'gold',
    criteria: { endorsements: 500 },
    points: 1500,
    icon: '❤️'
  },

  // ============ SPECIAL ACHIEVEMENTS ============
  JACK_OF_ALL_TRADES: {
    id: 'jack-of-all-trades',
    name: 'Jack of All Trades',
    description: 'Earn points in all 5 categories in one day',
    category: 'special',
    tier: 'silver',
    criteria: { allCategoriesInDay: 1 },
    points: 300,
    icon: '🌟'
  },
  OVERACHIEVER: {
    id: 'overachiever',
    name: 'Overachiever',
    description: 'Unlock 25 achievements',
    category: 'special',
    tier: 'silver',
    criteria: { achievementsUnlocked: 25 },
    points: 500,
    icon: '🏆'
  },
  COMPLETIONIST: {
    id: 'completionist',
    name: 'Completionist',
    description: 'Unlock all achievements',
    category: 'special',
    tier: 'gold',
    criteria: { achievementsUnlocked: 50 },
    points: 10000,
    icon: '👑'
  },
  LUCKY_SEVEN: {
    id: 'lucky-seven',
    name: 'Lucky Seven',
    description: 'Complete exactly 777 tasks',
    category: 'special',
    tier: 'bronze',
    criteria: { tasksCompleted: 777 },
    points: 777,
    icon: '🍀'
  },
  COMBO_MASTER: {
    id: 'combo-master',
    name: 'Combo Master',
    description: 'Achieve a 10x combo multiplier',
    category: 'special',
    tier: 'gold',
    criteria: { maxCombo: 10 },
    points: 1000,
    icon: '🔥'
  },
  MULTITASKER: {
    id: 'multitasker',
    name: 'Multitasker',
    description: 'Complete 5 tasks simultaneously',
    category: 'special',
    tier: 'silver',
    criteria: { simultaneousTasks: 5 },
    points: 400,
    icon: '🤹'
  },
  COMEBACK_STORY: {
    id: 'comeback-story',
    name: 'Comeback Story',
    description: 'Promoted from Bronze to Gold in one month',
    category: 'special',
    tier: 'gold',
    criteria: { rapidPromotion: 'gold' },
    points: 2000,
    icon: '📈'
  }
};

/**
 * Achievement categories
 */
export const ACHIEVEMENT_CATEGORIES = [
  'speed',
  'quality',
  'collaboration',
  'innovation',
  'battle',
  'consistency',
  'milestone',
  'reputation',
  'special'
];

/**
 * Achievement System - Manages badge tracking and unlocking
 */
export class AchievementSystem extends EventEmitter {
  constructor(rabbitMQClient, options = {}) {
    super();
    this.client = rabbitMQClient;
    this.exchange = options.exchange || 'gamification.achievements';
    this.achievements = ACHIEVEMENTS;
  }

  /**
   * Initialize the achievement system
   */
  async initialize() {
    if (!this.client || !this.client.channel) {
      throw new Error('RabbitMQ client not connected');
    }

    await this.client.channel.assertExchange(this.exchange, 'topic', { durable: true });
    console.log(`✅ Achievement System initialized with exchange: ${this.exchange}`);
  }

  /**
   * Check if agent unlocked any achievements
   * @param {Object} agent - Agent profile
   * @param {Object} context - Additional context (recent activity, stats)
   * @returns {Array} Newly unlocked achievements
   */
  async checkAchievements(agent, context = {}) {
    if (!agent) return [];

    const unlocked = [];

    for (const [id, achievement] of Object.entries(this.achievements)) {
      // Skip if already unlocked
      if (this.hasAchievement(agent, id)) continue;

      // Check criteria
      if (this.checkCriteria(agent, achievement.criteria, context)) {
        const unlockedAchievement = await this.unlockAchievement(agent, achievement);
        unlocked.push(unlockedAchievement);
      }
    }

    return unlocked;
  }

  /**
   * Check if agent has already unlocked an achievement
   * @param {Object} agent - Agent profile
   * @param {string} achievementId - Achievement ID
   * @returns {boolean} True if already unlocked
   */
  hasAchievement(agent, achievementId) {
    const achievements = agent.achievements || [];
    return achievements.some(a => a.id === achievementId);
  }

  /**
   * Check if agent meets achievement criteria
   * @param {Object} agent - Agent profile
   * @param {Object} criteria - Achievement criteria
   * @param {Object} context - Additional context
   * @returns {boolean} True if criteria met
   */
  checkCriteria(agent, criteria, context = {}) {
    for (const [key, value] of Object.entries(criteria)) {
      if (!this.checkCriterion(agent, key, value, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check individual criterion
   * @param {Object} agent - Agent profile
   * @param {string} key - Criterion key
   * @param {*} value - Required value
   * @param {Object} context - Additional context
   * @returns {boolean} True if criterion met
   */
  checkCriterion(agent, key, value, context) {
    const stats = agent.stats || {};
    const points = agent.points || {};
    const reputation = agent.reputation || {};
    const rankings = agent.rankings || {};

    switch (key) {
      case 'tasksCompleted':
        return stats.tasksCompleted >= value;

      case 'battlesWon':
        return stats.battlesWon >= value;

      case 'consecutiveDays':
        return stats.consecutiveDays >= value;

      case 'reputationScore':
        return reputation.score >= value;

      case 'collaborations':
        return stats.collaborationsCompleted >= value;

      case 'minQuality':
        return stats.averageQualityScore >= value;

      case 'minWinRate':
        const totalBattles = stats.battlesWon + stats.battlesLost;
        const winRate = totalBattles > 0 ? stats.battlesWon / totalBattles : 0;
        return winRate >= value;

      case 'fastTasks':
        return (stats.fastTasksCompleted || 0) >= value;

      case 'perfectTasks':
        return (stats.perfectQualityTasks || 0) >= value;

      case 'leadConsensus':
        return (stats.consensusLeadCount || 0) >= value;

      case 'novelSolutions':
        return (stats.novelSolutionsCreated || 0) >= value;

      case 'totalPoints':
        return points.total >= value;

      case 'globalRank':
        return rankings.global <= value && rankings.global > 0;

      case 'leaderboardRank':
        return rankings.global <= value;

      case 'highQualityStreak':
        return (stats.highQualityStreak || 0) >= value;

      case 'errorFreeTasks':
        return (stats.errorFreeTasks || 0) >= value;

      case 'highRatedCollabs':
        return (stats.highRatedCollabs || 0) >= value;

      case 'breakthroughAdoptions':
        return (stats.breakthroughAdoptions || 0) >= value;

      case 'winStreak':
        return (stats.battleWinStreak || 0) >= value;

      case 'achievementsUnlocked':
        return (agent.achievements?.length || 0) >= value;

      case 'maxCombo':
        return (stats.maxCombo || 0) >= value;

      default:
        return false;
    }
  }

  /**
   * Unlock achievement for agent
   * @param {Object} agent - Agent profile
   * @param {Object} achievement - Achievement definition
   * @returns {Object} Unlock event
   */
  async unlockAchievement(agent, achievement) {
    const unlockEvent = {
      eventId: uuidv4(),
      agentId: agent.id,
      agentName: agent.name,
      achievementId: achievement.id,
      achievementName: achievement.name,
      achievementTier: achievement.tier,
      achievementCategory: achievement.category,
      points: achievement.points,
      icon: achievement.icon,
      timestamp: Date.now()
    };

    // Publish achievement unlock event
    await this.client.channel.publish(
      this.exchange,
      `achievement.unlocked.${achievement.category}`,
      Buffer.from(JSON.stringify(unlockEvent)),
      { persistent: true }
    );

    this.emit('achievement_unlocked', unlockEvent);

    return unlockEvent;
  }

  /**
   * Get achievement progress for an agent
   * @param {Object} agent - Agent profile
   * @param {string} achievementId - Achievement ID
   * @returns {Object} Progress information
   */
  getAchievementProgress(agent, achievementId) {
    const achievement = this.achievements[achievementId.toUpperCase().replace(/-/g, '_')];
    if (!achievement) {
      return null;
    }

    if (this.hasAchievement(agent, achievement.id)) {
      return {
        achievement,
        unlocked: true,
        progress: 100,
        details: 'Achievement unlocked!'
      };
    }

    const criteria = achievement.criteria;
    const progressDetails = {};
    let totalProgress = 0;
    let criteriaCount = 0;

    for (const [key, value] of Object.entries(criteria)) {
      const current = this.getCurrentValue(agent, key);
      const progress = Math.min((current / value) * 100, 100);
      progressDetails[key] = { current, required: value, progress };
      totalProgress += progress;
      criteriaCount++;
    }

    const averageProgress = criteriaCount > 0 ? totalProgress / criteriaCount : 0;

    return {
      achievement,
      unlocked: false,
      progress: Math.round(averageProgress),
      details: progressDetails
    };
  }

  /**
   * Get current value for a criterion
   * @param {Object} agent - Agent profile
   * @param {string} key - Criterion key
   * @returns {number} Current value
   */
  getCurrentValue(agent, key) {
    const stats = agent.stats || {};
    const points = agent.points || {};
    const reputation = agent.reputation || {};
    const rankings = agent.rankings || {};

    const mapping = {
      tasksCompleted: stats.tasksCompleted || 0,
      battlesWon: stats.battlesWon || 0,
      consecutiveDays: stats.consecutiveDays || 0,
      reputationScore: reputation.score || 0,
      collaborations: stats.collaborationsCompleted || 0,
      fastTasks: stats.fastTasksCompleted || 0,
      perfectTasks: stats.perfectQualityTasks || 0,
      leadConsensus: stats.consensusLeadCount || 0,
      novelSolutions: stats.novelSolutionsCreated || 0,
      totalPoints: points.total || 0,
      globalRank: rankings.global || 999999
    };

    return mapping[key] || 0;
  }

  /**
   * Get all achievements by category
   * @param {string} category - Achievement category
   * @returns {Array} Achievements in category
   */
  getAchievementsByCategory(category) {
    return Object.values(this.achievements).filter(
      achievement => achievement.category === category
    );
  }

  /**
   * Get agent's achievement statistics
   * @param {Object} agent - Agent profile
   * @returns {Object} Achievement statistics
   */
  getAgentAchievementStats(agent) {
    const unlockedAchievements = agent.achievements || [];
    const totalAchievements = Object.keys(this.achievements).length;

    const byCategory = {};
    const byTier = { bronze: 0, silver: 0, gold: 0 };

    unlockedAchievements.forEach(unlocked => {
      const achievement = Object.values(this.achievements).find(a => a.id === unlocked.id);
      if (achievement) {
        byCategory[achievement.category] = (byCategory[achievement.category] || 0) + 1;
        byTier[achievement.tier] = (byTier[achievement.tier] || 0) + 1;
      }
    });

    return {
      total: unlockedAchievements.length,
      totalPossible: totalAchievements,
      percentage: (unlockedAchievements.length / totalAchievements) * 100,
      byCategory,
      byTier,
      recentlyUnlocked: unlockedAchievements
        .sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0))
        .slice(0, 5)
    };
  }

  /**
   * Get rarest achievements (least unlocked)
   * @param {Array} agents - All agents
   * @returns {Array} Rarest achievements with unlock counts
   */
  getRarestAchievements(agents) {
    const unlockCounts = {};

    // Initialize counts
    Object.keys(this.achievements).forEach(id => {
      unlockCounts[id] = 0;
    });

    // Count unlocks
    agents.forEach(agent => {
      const achievements = agent.achievements || [];
      achievements.forEach(a => {
        const key = a.id.toUpperCase().replace(/-/g, '_');
        if (unlockCounts[key] !== undefined) {
          unlockCounts[key]++;
        }
      });
    });

    // Sort by rarity
    return Object.entries(unlockCounts)
      .map(([id, count]) => ({
        achievement: this.achievements[id],
        unlockedBy: count,
        percentage: agents.length > 0 ? (count / agents.length) * 100 : 0
      }))
      .sort((a, b) => a.unlockedBy - b.unlockedBy);
  }

  /**
   * Close the achievement system
   */
  async close() {
    console.log('🔌 Achievement System shutting down');
  }
}

export default AchievementSystem;
