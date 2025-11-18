/**
 * Achievement Repository
 * Manages achievement data persistence and retrieval
 */

import BaseRepository from './base-repository.js';
import { REDIS_KEYS } from '../db/redis-connection.js';
import winston from 'winston';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'achievement-repository' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Achievement Types
 */
export const ACHIEVEMENT_TYPES = {
  TASK_COMPLETION: 'task_completion',
  MILESTONE: 'milestone',
  COLLABORATION: 'collaboration',
  PERFORMANCE: 'performance',
  STREAK: 'streak',
  SPECIAL: 'special',
  LEVEL_UP: 'level_up',
  FIRST_TIME: 'first_time'
};

/**
 * Achievement Repository Class
 */
class AchievementRepository extends BaseRepository {
  constructor() {
    super('achievements', 'achievement');

    // Achievement definitions
    this.achievementDefinitions = {
      // Task achievements
      'first_task': {
        name: 'First Step',
        description: 'Complete your first task',
        type: ACHIEVEMENT_TYPES.FIRST_TIME,
        points: 10,
        criteria: { tasksCompleted: 1 }
      },
      'task_master_10': {
        name: 'Task Master',
        description: 'Complete 10 tasks',
        type: ACHIEVEMENT_TYPES.TASK_COMPLETION,
        points: 25,
        criteria: { tasksCompleted: 10 }
      },
      'task_master_100': {
        name: 'Centurion',
        description: 'Complete 100 tasks',
        type: ACHIEVEMENT_TYPES.MILESTONE,
        points: 100,
        criteria: { tasksCompleted: 100 }
      },
      'task_master_1000': {
        name: 'Task Legend',
        description: 'Complete 1000 tasks',
        type: ACHIEVEMENT_TYPES.MILESTONE,
        points: 500,
        criteria: { tasksCompleted: 1000 }
      },

      // Performance achievements
      'perfect_day': {
        name: 'Perfect Day',
        description: 'Complete all assigned tasks in a day without failures',
        type: ACHIEVEMENT_TYPES.PERFORMANCE,
        points: 50,
        criteria: { perfectDays: 1 }
      },
      'speed_demon': {
        name: 'Speed Demon',
        description: 'Complete a task in under 1 minute',
        type: ACHIEVEMENT_TYPES.PERFORMANCE,
        points: 30,
        criteria: { fastCompletion: true }
      },
      'efficiency_expert': {
        name: 'Efficiency Expert',
        description: 'Maintain 95% success rate over 100 tasks',
        type: ACHIEVEMENT_TYPES.PERFORMANCE,
        points: 75,
        criteria: { successRate: 95, minTasks: 100 }
      },

      // Collaboration achievements
      'team_player': {
        name: 'Team Player',
        description: 'Collaborate with 5 different agents',
        type: ACHIEVEMENT_TYPES.COLLABORATION,
        points: 40,
        criteria: { uniqueCollaborators: 5 }
      },
      'collaboration_master': {
        name: 'Collaboration Master',
        description: 'Successfully complete 50 collaborative tasks',
        type: ACHIEVEMENT_TYPES.COLLABORATION,
        points: 80,
        criteria: { collaborativeTasks: 50 }
      },

      // Streak achievements
      'weekly_streak': {
        name: 'Weekly Warrior',
        description: 'Complete tasks every day for a week',
        type: ACHIEVEMENT_TYPES.STREAK,
        points: 35,
        criteria: { dailyStreak: 7 }
      },
      'monthly_streak': {
        name: 'Monthly Marathon',
        description: 'Complete tasks every day for a month',
        type: ACHIEVEMENT_TYPES.STREAK,
        points: 150,
        criteria: { dailyStreak: 30 }
      },

      // Level achievements
      'level_5': {
        name: 'Rising Star',
        description: 'Reach level 5',
        type: ACHIEVEMENT_TYPES.LEVEL_UP,
        points: 50,
        criteria: { level: 5 }
      },
      'level_10': {
        name: 'Experienced',
        description: 'Reach level 10',
        type: ACHIEVEMENT_TYPES.LEVEL_UP,
        points: 100,
        criteria: { level: 10 }
      },
      'level_25': {
        name: 'Veteran',
        description: 'Reach level 25',
        type: ACHIEVEMENT_TYPES.LEVEL_UP,
        points: 250,
        criteria: { level: 25 }
      },
      'level_50': {
        name: 'Master',
        description: 'Reach level 50',
        type: ACHIEVEMENT_TYPES.LEVEL_UP,
        points: 500,
        criteria: { level: 50 }
      },
      'level_100': {
        name: 'Grandmaster',
        description: 'Reach level 100',
        type: ACHIEVEMENT_TYPES.LEVEL_UP,
        points: 1000,
        criteria: { level: 100 }
      }
    };
  }

  /**
   * Award achievement to agent
   */
  async awardAchievement(agentId, achievementKey, metadata = {}) {
    try {
      // Check if achievement exists
      const definition = this.achievementDefinitions[achievementKey];
      if (!definition) {
        throw new Error(`Achievement ${achievementKey} not defined`);
      }

      // Check if already awarded
      const existing = await this.findOne({
        agent_id: agentId,
        type: definition.type,
        name: definition.name
      });

      if (existing) {
        logger.debug('Achievement already awarded', { agentId, achievementKey });
        return existing;
      }

      // Create achievement
      const achievement = await this.create({
        agent_id: agentId,
        type: definition.type,
        name: definition.name,
        description: definition.description,
        points: definition.points,
        level: metadata.level || 1,
        metadata: {
          ...metadata,
          achievementKey,
          criteria: definition.criteria
        }
      });

      // Publish achievement event
      await this.redis.publish(
        REDIS_KEYS.CHANNEL_SYSTEM_ALERTS,
        {
          event: 'achievement_unlocked',
          agentId,
          achievement: {
            id: achievement.id,
            name: achievement.name,
            points: achievement.points
          },
          timestamp: new Date()
        }
      );

      // Update agent's total points
      await this.updateAgentPoints(agentId);

      logger.info('Achievement awarded', {
        agentId,
        achievementKey,
        points: definition.points
      });

      return achievement;

    } catch (error) {
      logger.error('Error awarding achievement', { agentId, achievementKey, error });
      throw error;
    }
  }

  /**
   * Check and award achievements based on agent statistics
   */
  async checkAndAwardAchievements(agentId, stats) {
    try {
      const awarded = [];

      // Check task completion achievements
      if (stats.tasksCompleted >= 1 && !(await this.hasAchievement(agentId, 'first_task'))) {
        awarded.push(await this.awardAchievement(agentId, 'first_task'));
      }

      if (stats.tasksCompleted >= 10 && !(await this.hasAchievement(agentId, 'task_master_10'))) {
        awarded.push(await this.awardAchievement(agentId, 'task_master_10'));
      }

      if (stats.tasksCompleted >= 100 && !(await this.hasAchievement(agentId, 'task_master_100'))) {
        awarded.push(await this.awardAchievement(agentId, 'task_master_100'));
      }

      if (stats.tasksCompleted >= 1000 && !(await this.hasAchievement(agentId, 'task_master_1000'))) {
        awarded.push(await this.awardAchievement(agentId, 'task_master_1000'));
      }

      // Check performance achievements
      if (stats.successRate >= 95 && stats.tasksCompleted >= 100 &&
          !(await this.hasAchievement(agentId, 'efficiency_expert'))) {
        awarded.push(await this.awardAchievement(agentId, 'efficiency_expert'));
      }

      // Check collaboration achievements
      if (stats.uniqueCollaborators >= 5 && !(await this.hasAchievement(agentId, 'team_player'))) {
        awarded.push(await this.awardAchievement(agentId, 'team_player'));
      }

      if (stats.collaborativeTasks >= 50 && !(await this.hasAchievement(agentId, 'collaboration_master'))) {
        awarded.push(await this.awardAchievement(agentId, 'collaboration_master'));
      }

      // Check streak achievements
      if (stats.dailyStreak >= 7 && !(await this.hasAchievement(agentId, 'weekly_streak'))) {
        awarded.push(await this.awardAchievement(agentId, 'weekly_streak'));
      }

      if (stats.dailyStreak >= 30 && !(await this.hasAchievement(agentId, 'monthly_streak'))) {
        awarded.push(await this.awardAchievement(agentId, 'monthly_streak'));
      }

      // Check level achievements
      const levelAchievements = [
        { level: 5, key: 'level_5' },
        { level: 10, key: 'level_10' },
        { level: 25, key: 'level_25' },
        { level: 50, key: 'level_50' },
        { level: 100, key: 'level_100' }
      ];

      for (const { level, key } of levelAchievements) {
        if (stats.level >= level && !(await this.hasAchievement(agentId, key))) {
          awarded.push(await this.awardAchievement(agentId, key, { level: stats.level }));
        }
      }

      return awarded;

    } catch (error) {
      logger.error('Error checking achievements', { agentId, error });
      throw error;
    }
  }

  /**
   * Check if agent has specific achievement
   */
  async hasAchievement(agentId, achievementKey) {
    try {
      const definition = this.achievementDefinitions[achievementKey];
      if (!definition) return false;

      const achievement = await this.findOne({
        agent_id: agentId,
        name: definition.name
      });

      return !!achievement;

    } catch (error) {
      logger.error('Error checking achievement', { agentId, achievementKey, error });
      return false;
    }
  }

  /**
   * Get agent achievements
   */
  async getAgentAchievements(agentId, options = {}) {
    try {
      return await this.findAll({ agent_id: agentId }, {
        orderBy: 'awarded_at DESC',
        ...options
      });

    } catch (error) {
      logger.error('Error getting agent achievements', { agentId, error });
      throw error;
    }
  }

  /**
   * Get agent total points
   */
  async getAgentTotalPoints(agentId) {
    try {
      const query = `
        SELECT SUM(points) as total_points
        FROM achievements
        WHERE agent_id = $1
      `;

      const result = await this.db.query(query, [agentId]);

      return parseInt(result.rows[0].total_points || 0);

    } catch (error) {
      logger.error('Error getting agent total points', { agentId, error });
      throw error;
    }
  }

  /**
   * Update agent's cached points
   */
  async updateAgentPoints(agentId) {
    try {
      const totalPoints = await this.getAgentTotalPoints(agentId);

      // Cache in Redis
      const cacheKey = `cache:agent:points:${agentId}`;
      await this.redis.set(cacheKey, totalPoints, 3600); // 1 hour cache

      return totalPoints;

    } catch (error) {
      logger.error('Error updating agent points', { agentId, error });
      throw error;
    }
  }

  /**
   * Get achievement leaderboard
   */
  async getLeaderboard(limit = 10, type = null) {
    try {
      let query = `
        SELECT
          a.id as agent_id,
          a.name as agent_name,
          a.role as agent_role,
          COUNT(ach.id) as achievement_count,
          SUM(ach.points) as total_points,
          MAX(ach.awarded_at) as latest_achievement
        FROM agents a
        LEFT JOIN achievements ach ON a.id = ach.agent_id
      `;

      const params = [];

      if (type) {
        query += ` WHERE ach.type = $1`;
        params.push(type);
      }

      query += `
        GROUP BY a.id, a.name, a.role
        ORDER BY total_points DESC NULLS LAST, achievement_count DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);

      const result = await this.db.query(query, params);

      return result.rows.map((row, index) => ({
        rank: index + 1,
        agentId: row.agent_id,
        agentName: row.agent_name,
        agentRole: row.agent_role,
        achievementCount: parseInt(row.achievement_count),
        totalPoints: parseInt(row.total_points || 0),
        latestAchievement: row.latest_achievement
      }));

    } catch (error) {
      logger.error('Error getting leaderboard', { limit, type, error });
      throw error;
    }
  }

  /**
   * Get achievement statistics
   */
  async getStatistics() {
    try {
      const query = `
        SELECT
          COUNT(DISTINCT agent_id) as agents_with_achievements,
          COUNT(*) as total_achievements,
          SUM(points) as total_points_awarded,
          AVG(points) as avg_points_per_achievement,
          type,
          COUNT(*) as count_by_type
        FROM achievements
        GROUP BY ROLLUP(type)
        ORDER BY type NULLS FIRST
      `;

      const result = await this.db.query(query);

      const statistics = {
        agentsWithAchievements: 0,
        totalAchievements: 0,
        totalPointsAwarded: 0,
        avgPointsPerAchievement: 0,
        byType: {}
      };

      for (const row of result.rows) {
        if (!row.type) {
          // Overall statistics
          statistics.agentsWithAchievements = parseInt(row.agents_with_achievements);
          statistics.totalAchievements = parseInt(row.total_achievements);
          statistics.totalPointsAwarded = parseInt(row.total_points_awarded || 0);
          statistics.avgPointsPerAchievement = parseFloat(row.avg_points_per_achievement || 0);
        } else {
          // Per-type statistics
          statistics.byType[row.type] = parseInt(row.count_by_type);
        }
      }

      // Get most common achievements
      const commonQuery = `
        SELECT name, COUNT(*) as award_count
        FROM achievements
        GROUP BY name
        ORDER BY award_count DESC
        LIMIT 5
      `;

      const commonResult = await this.db.query(commonQuery);
      statistics.mostCommonAchievements = commonResult.rows;

      // Get recent achievements
      const recentQuery = `
        SELECT
          ach.name,
          a.name as agent_name,
          ach.points,
          ach.awarded_at
        FROM achievements ach
        JOIN agents a ON ach.agent_id = a.id
        ORDER BY ach.awarded_at DESC
        LIMIT 10
      `;

      const recentResult = await this.db.query(recentQuery);
      statistics.recentAchievements = recentResult.rows;

      return statistics;

    } catch (error) {
      logger.error('Error getting achievement statistics', { error });
      throw error;
    }
  }

  /**
   * Calculate agent level based on points
   */
  calculateLevel(totalPoints) {
    // Simple level calculation: every 100 points = 1 level
    return Math.floor(totalPoints / 100) + 1;
  }

  /**
   * Get agent progress towards next achievement
   */
  async getProgress(agentId) {
    try {
      // Get agent statistics
      const statsQuery = `
        SELECT
          COUNT(DISTINCT t.id) as tasks_completed,
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as successful_tasks,
          COUNT(DISTINCT ac.leader_id) + COUNT(DISTINCT ac.member_id) as unique_collaborators,
          COUNT(DISTINCT DATE(t.completed_at)) as days_active
        FROM agents a
        LEFT JOIN tasks t ON a.id = t.agent_id
        LEFT JOIN agent_collaborations ac ON a.id = ac.leader_id OR a.id = ac.member_id
        WHERE a.id = $1
        GROUP BY a.id
      `;

      const statsResult = await this.db.query(statsQuery, [agentId]);
      const stats = statsResult.rows[0] || {};

      // Get current achievements
      const achievements = await this.getAgentAchievements(agentId);
      const earnedKeys = achievements.map(a => a.metadata?.achievementKey).filter(Boolean);

      // Calculate progress for each achievement
      const progress = {};

      for (const [key, definition] of Object.entries(this.achievementDefinitions)) {
        if (earnedKeys.includes(key)) continue;

        const criteria = definition.criteria;
        let currentProgress = 0;
        let targetProgress = 0;

        if (criteria.tasksCompleted) {
          currentProgress = parseInt(stats.tasks_completed || 0);
          targetProgress = criteria.tasksCompleted;
        } else if (criteria.uniqueCollaborators) {
          currentProgress = parseInt(stats.unique_collaborators || 0);
          targetProgress = criteria.uniqueCollaborators;
        } else if (criteria.dailyStreak) {
          currentProgress = parseInt(stats.days_active || 0);
          targetProgress = criteria.dailyStreak;
        }

        if (targetProgress > 0) {
          progress[key] = {
            name: definition.name,
            description: definition.description,
            points: definition.points,
            current: currentProgress,
            target: targetProgress,
            percentage: Math.min(100, (currentProgress / targetProgress) * 100)
          };
        }
      }

      // Sort by percentage completion
      const sortedProgress = Object.entries(progress)
        .sort((a, b) => b[1].percentage - a[1].percentage)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

      return sortedProgress;

    } catch (error) {
      logger.error('Error getting achievement progress', { agentId, error });
      throw error;
    }
  }
}

// Export singleton instance
const achievementRepository = new AchievementRepository();

export default achievementRepository;
export { AchievementRepository, ACHIEVEMENT_TYPES };