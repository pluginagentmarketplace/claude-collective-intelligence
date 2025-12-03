import dbClient from '../db-client.js';

/**
 * Repository for Gamification data access
 * Handles points, achievements, and tier management
 */
export class GamificationRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create or update agent gamification profile
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Gamification profile
   */
  async getOrCreateProfile(agentId) {
    const existing = await this.findProfileByAgent(agentId);
    if (existing) return existing;

    const query = `
      INSERT INTO gamification_profiles (
        agent_id, points, level, tier, experience,
        streak_days, created_at, updated_at
      )
      VALUES ($1, 0, 1, 'bronze', 0, 0, NOW(), NOW())
      RETURNING *
    `;

    const result = await this.db.query(query, [agentId]);
    return this.mapProfileRow(result.rows[0]);
  }

  /**
   * Find profile by agent ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object|null>} Profile or null
   */
  async findProfileByAgent(agentId) {
    const query = 'SELECT * FROM gamification_profiles WHERE agent_id = $1';
    const result = await this.db.query(query, [agentId]);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Add points to agent
   * @param {string} agentId - Agent ID
   * @param {number} points - Points to add
   * @param {string} reason - Reason for points
   * @returns {Promise<Object>} Updated profile
   */
  async addPoints(agentId, points, reason = null) {
    return await this.db.transaction(async (client) => {
      // Update profile points and experience
      const updateQuery = `
        UPDATE gamification_profiles
        SET points = points + $1,
            experience = experience + $1,
            updated_at = NOW()
        WHERE agent_id = $2
        RETURNING *
      `;

      const result = await client.query(updateQuery, [points, agentId]);
      const profile = this.mapProfileRow(result.rows[0]);

      // Create points transaction record
      await client.query(
        `INSERT INTO gamification_transactions (
          agent_id, points, transaction_type, reason, created_at
        ) VALUES ($1, $2, 'earn', $3, NOW())`,
        [agentId, points, reason]
      );

      // Check for level up
      await this.checkLevelUp(agentId, profile.experience, client);

      return profile;
    });
  }

  /**
   * Deduct points from agent
   * @param {string} agentId - Agent ID
   * @param {number} points - Points to deduct
   * @param {string} reason - Reason for deduction
   * @returns {Promise<Object>} Updated profile
   */
  async deductPoints(agentId, points, reason = null) {
    return await this.db.transaction(async (client) => {
      const updateQuery = `
        UPDATE gamification_profiles
        SET points = GREATEST(0, points - $1),
            updated_at = NOW()
        WHERE agent_id = $2
        RETURNING *
      `;

      const result = await client.query(updateQuery, [points, agentId]);

      // Create points transaction record
      await client.query(
        `INSERT INTO gamification_transactions (
          agent_id, points, transaction_type, reason, created_at
        ) VALUES ($1, $2, 'spend', $3, NOW())`,
        [agentId, points, reason]
      );

      return this.mapProfileRow(result.rows[0]);
    });
  }

  /**
   * Check and apply level up if needed
   * @param {string} agentId - Agent ID
   * @param {number} experience - Current experience
   * @param {Object} client - Database client (for transactions)
   * @private
   */
  async checkLevelUp(agentId, experience, client = null) {
    const db = client || this.db;
    const newLevel = Math.floor(Math.sqrt(experience / 100)) + 1;

    const query = `
      UPDATE gamification_profiles
      SET level = $1, updated_at = NOW()
      WHERE agent_id = $2 AND level < $1
      RETURNING *
    `;

    const result = await db.query(query, [newLevel, agentId]);
    return result.rowCount > 0;
  }

  /**
   * Update agent tier
   * @param {string} agentId - Agent ID
   * @param {string} tier - New tier
   * @returns {Promise<Object>} Updated profile
   */
  async updateTier(agentId, tier) {
    const query = `
      UPDATE gamification_profiles
      SET tier = $1, updated_at = NOW()
      WHERE agent_id = $2
      RETURNING *
    `;

    const result = await this.db.query(query, [tier, agentId]);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Increment streak
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Updated profile
   */
  async incrementStreak(agentId) {
    const query = `
      UPDATE gamification_profiles
      SET streak_days = streak_days + 1,
          last_activity_at = NOW(),
          updated_at = NOW()
      WHERE agent_id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [agentId]);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Reset streak
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Updated profile
   */
  async resetStreak(agentId) {
    const query = `
      UPDATE gamification_profiles
      SET streak_days = 0, updated_at = NOW()
      WHERE agent_id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [agentId]);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Award achievement to agent
   * @param {string} agentId - Agent ID
   * @param {string} achievementId - Achievement ID
   * @param {Object} metadata - Achievement metadata
   * @returns {Promise<Object>} Achievement record
   */
  async awardAchievement(agentId, achievementId, metadata = {}) {
    const query = `
      INSERT INTO gamification_achievements (
        agent_id, achievement_id, metadata, earned_at
      )
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (agent_id, achievement_id) DO NOTHING
      RETURNING *
    `;

    const result = await this.db.query(query, [
      agentId,
      achievementId,
      JSON.stringify(metadata),
    ]);

    return result.rows[0] ? this.mapAchievementRow(result.rows[0]) : null;
  }

  /**
   * Get agent achievements
   * @param {string} agentId - Agent ID
   * @returns {Promise<Array>} List of achievements
   */
  async getAchievements(agentId) {
    const query = `
      SELECT * FROM gamification_achievements
      WHERE agent_id = $1
      ORDER BY earned_at DESC
    `;

    const result = await this.db.query(query, [agentId]);
    return result.rows.map(row => this.mapAchievementRow(row));
  }

  /**
   * Get points transaction history
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(agentId, options = {}) {
    let query = `
      SELECT * FROM gamification_transactions
      WHERE agent_id = $1
    `;

    const params = [agentId];

    if (options.transactionType) {
      query += ` AND transaction_type = $${params.length + 1}`;
      params.push(options.transactionType);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapTransactionRow(row));
  }

  /**
   * Get leaderboard by points
   * @param {number} limit - Number of agents to return
   * @returns {Promise<Array>} Leaderboard
   */
  async getLeaderboardByPoints(limit = 10) {
    const query = `
      SELECT gp.*, a.agent_name
      FROM gamification_profiles gp
      JOIN agents a ON gp.agent_id = a.agent_id
      ORDER BY gp.points DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => ({
      ...this.mapProfileRow(row),
      agentName: row.agent_name,
    }));
  }

  /**
   * Get statistics
   * @returns {Promise<Object>} Gamification statistics
   */
  async getStats() {
    const query = `
      SELECT
        COUNT(*) as total_profiles,
        AVG(points) as avg_points,
        MAX(points) as max_points,
        AVG(level) as avg_level,
        MAX(level) as max_level,
        COUNT(*) FILTER (WHERE tier = 'bronze') as bronze_count,
        COUNT(*) FILTER (WHERE tier = 'silver') as silver_count,
        COUNT(*) FILTER (WHERE tier = 'gold') as gold_count,
        COUNT(*) FILTER (WHERE tier = 'platinum') as platinum_count,
        COUNT(*) FILTER (WHERE tier = 'diamond') as diamond_count
      FROM gamification_profiles
    `;

    const result = await this.db.query(query);
    const row = result.rows[0];

    return {
      totalProfiles: parseInt(row.total_profiles) || 0,
      avgPoints: parseFloat(row.avg_points) || 0,
      maxPoints: parseInt(row.max_points) || 0,
      avgLevel: parseFloat(row.avg_level) || 0,
      maxLevel: parseInt(row.max_level) || 0,
      tierDistribution: {
        bronze: parseInt(row.bronze_count) || 0,
        silver: parseInt(row.silver_count) || 0,
        gold: parseInt(row.gold_count) || 0,
        platinum: parseInt(row.platinum_count) || 0,
        diamond: parseInt(row.diamond_count) || 0,
      },
    };
  }

  /**
   * Map database row to profile object
   * @private
   */
  mapProfileRow(row) {
    if (!row) return null;

    return {
      agentId: row.agent_id,
      points: parseInt(row.points) || 0,
      level: parseInt(row.level) || 1,
      tier: row.tier,
      experience: parseInt(row.experience) || 0,
      streakDays: parseInt(row.streak_days) || 0,
      lastActivityAt: row.last_activity_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to achievement object
   * @private
   */
  mapAchievementRow(row) {
    if (!row) return null;

    return {
      agentId: row.agent_id,
      achievementId: row.achievement_id,
      metadata: row.metadata,
      earnedAt: row.earned_at,
    };
  }

  /**
   * Map database row to transaction object
   * @private
   */
  mapTransactionRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agent_id,
      points: parseInt(row.points) || 0,
      transactionType: row.transaction_type,
      reason: row.reason,
      createdAt: row.created_at,
    };
  }
}

export default new GamificationRepository();
