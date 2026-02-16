import dbClient from '../client.js';

/**
 * Repository for Leaderboard data access
 * Handles rankings, Hall of Fame, and leaderboard snapshots
 */
export class LeaderboardRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Get current leaderboard
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Leaderboard entries
   */
  async getCurrentLeaderboard(options = {}) {
    const metric = options.metric || 'points';
    const limit = options.limit || 10;

    let query = '';

    switch (metric) {
      case 'points':
        query = `
          SELECT
            gp.agent_id,
            a.agent_name,
            gp.points as score,
            gp.level,
            gp.tier,
            ROW_NUMBER() OVER (ORDER BY gp.points DESC) as rank
          FROM gamification_profiles gp
          JOIN agents a ON gp.agent_id = a.agent_id
          ORDER BY gp.points DESC
          LIMIT $1
        `;
        break;

      case 'elo':
        query = `
          SELECT
            bp.agent_id,
            a.agent_name,
            bp.elo_rating as score,
            bp.wins,
            bp.losses,
            ROW_NUMBER() OVER (ORDER BY bp.elo_rating DESC) as rank
          FROM battle_profiles bp
          JOIN agents a ON bp.agent_id = a.agent_id
          WHERE bp.total_matches >= 5
          ORDER BY bp.elo_rating DESC
          LIMIT $1
        `;
        break;

      case 'reputation':
        query = `
          SELECT
            rp.agent_id,
            a.agent_name,
            (rp.trust_score + rp.reliability_score + rp.quality_score + rp.collaboration_score) / 4 as score,
            rp.trust_score,
            rp.total_ratings,
            ROW_NUMBER() OVER (ORDER BY (rp.trust_score + rp.reliability_score + rp.quality_score + rp.collaboration_score) DESC) as rank
          FROM reputation_profiles rp
          JOIN agents a ON rp.agent_id = a.agent_id
          WHERE rp.total_ratings >= 5
          ORDER BY score DESC
          LIMIT $1
        `;
        break;

      case 'tasks':
        query = `
          SELECT
            a.agent_id,
            a.agent_name,
            a.tasks_completed as score,
            a.tasks_failed,
            ROW_NUMBER() OVER (ORDER BY a.tasks_completed DESC) as rank
          FROM agents a
          WHERE a.tasks_completed > 0
          ORDER BY a.tasks_completed DESC
          LIMIT $1
        `;
        break;

      default:
        throw new Error(`Unknown metric: ${metric}`);
    }

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => this.mapLeaderboardRow(row));
  }

  /**
   * Get agent rank for a specific metric
   * @param {string} agentId - Agent ID
   * @param {string} metric - Metric to rank by
   * @returns {Promise<Object|null>} Agent rank info
   */
  async getAgentRank(agentId, metric = 'points') {
    let query = '';

    switch (metric) {
      case 'points':
        query = `
          SELECT
            agent_id,
            points as score,
            (SELECT COUNT(*) + 1 FROM gamification_profiles WHERE points > gp.points) as rank,
            (SELECT COUNT(*) FROM gamification_profiles) as total
          FROM gamification_profiles gp
          WHERE agent_id = $1
        `;
        break;

      case 'elo':
        query = `
          SELECT
            agent_id,
            elo_rating as score,
            (SELECT COUNT(*) + 1 FROM battle_profiles WHERE elo_rating > bp.elo_rating AND total_matches >= 5) as rank,
            (SELECT COUNT(*) FROM battle_profiles WHERE total_matches >= 5) as total
          FROM battle_profiles bp
          WHERE agent_id = $1
        `;
        break;

      case 'reputation':
        query = `
          SELECT
            agent_id,
            (trust_score + reliability_score + quality_score + collaboration_score) / 4 as score,
            (SELECT COUNT(*) + 1 FROM reputation_profiles WHERE
              (trust_score + reliability_score + quality_score + collaboration_score) / 4 >
              (rp.trust_score + rp.reliability_score + rp.quality_score + rp.collaboration_score) / 4
              AND total_ratings >= 5) as rank,
            (SELECT COUNT(*) FROM reputation_profiles WHERE total_ratings >= 5) as total
          FROM reputation_profiles rp
          WHERE agent_id = $1
        `;
        break;

      default:
        throw new Error(`Unknown metric: ${metric}`);
    }

    const result = await this.db.query(query, [agentId]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      agentId: row.agent_id,
      score: parseFloat(row.score) || 0,
      rank: parseInt(row.rank) || 0,
      total: parseInt(row.total) || 0,
      metric,
    };
  }

  /**
   * Create leaderboard snapshot
   * @param {string} period - Period identifier (e.g., '2024-W01', '2024-01')
   * @param {string} metric - Metric type
   * @returns {Promise<number>} Number of entries created
   */
  async createSnapshot(period, metric = 'points') {
    const leaderboard = await this.getCurrentLeaderboard({ metric, limit: 100 });

    const values = leaderboard.map((entry, index) => {
      return `('${period}', '${metric}', '${entry.agentId}', ${index + 1}, ${entry.score}, NOW())`;
    });

    if (values.length === 0) return 0;

    const query = `
      INSERT INTO leaderboard_snapshots (
        period, metric, agent_id, rank, score, created_at
      )
      VALUES ${values.join(', ')}
      ON CONFLICT (period, metric, agent_id) DO UPDATE
      SET rank = EXCLUDED.rank, score = EXCLUDED.score
    `;

    const result = await this.db.query(query);
    return result.rowCount;
  }

  /**
   * Get historical snapshot
   * @param {string} period - Period identifier
   * @param {string} metric - Metric type
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Snapshot entries
   */
  async getSnapshot(period, metric, options = {}) {
    let query = `
      SELECT ls.*, a.agent_name
      FROM leaderboard_snapshots ls
      JOIN agents a ON ls.agent_id = a.agent_id
      WHERE ls.period = $1 AND ls.metric = $2
      ORDER BY ls.rank ASC
    `;

    const params = [period, metric];

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => ({
      agentId: row.agent_id,
      agentName: row.agent_name,
      rank: parseInt(row.rank),
      score: parseFloat(row.score),
      period: row.period,
      metric: row.metric,
      createdAt: row.created_at,
    }));
  }

  /**
   * Add agent to Hall of Fame
   * @param {Object} entry - Hall of Fame entry
   * @returns {Promise<Object>} Created entry
   */
  async addToHallOfFame(entry) {
    const query = `
      INSERT INTO hall_of_fame (
        agent_id, achievement_type, description, metric,
        value, metadata, inducted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const values = [
      entry.agentId,
      entry.achievementType,
      entry.description,
      entry.metric || null,
      entry.value || null,
      JSON.stringify(entry.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapHallOfFameRow(result.rows[0]);
  }

  /**
   * Get Hall of Fame entries
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Hall of Fame entries
   */
  async getHallOfFame(options = {}) {
    let query = `
      SELECT hof.*, a.agent_name
      FROM hall_of_fame hof
      JOIN agents a ON hof.agent_id = a.agent_id
    `;

    const params = [];

    if (options.achievementType) {
      query += ' WHERE hof.achievement_type = $1';
      params.push(options.achievementType);
    }

    query += ' ORDER BY hof.inducted_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => ({
      ...this.mapHallOfFameRow(row),
      agentName: row.agent_name,
    }));
  }

  /**
   * Get combined rankings (multi-metric)
   * @param {number} limit - Number of agents to return
   * @returns {Promise<Array>} Combined rankings
   */
  async getCombinedRankings(limit = 10) {
    const query = `
      WITH normalized_scores AS (
        SELECT
          a.agent_id,
          a.agent_name,
          COALESCE(gp.points, 0) / NULLIF((SELECT MAX(points) FROM gamification_profiles), 0) as points_norm,
          COALESCE(bp.elo_rating, 1500) / NULLIF((SELECT MAX(elo_rating) FROM battle_profiles), 0) as elo_norm,
          COALESCE((rp.trust_score + rp.reliability_score + rp.quality_score + rp.collaboration_score) / 4, 50) / 100 as rep_norm
        FROM agents a
        LEFT JOIN gamification_profiles gp ON a.agent_id = gp.agent_id
        LEFT JOIN battle_profiles bp ON a.agent_id = bp.agent_id
        LEFT JOIN reputation_profiles rp ON a.agent_id = rp.agent_id
      )
      SELECT
        agent_id,
        agent_name,
        (points_norm + elo_norm + rep_norm) / 3 as combined_score,
        points_norm,
        elo_norm,
        rep_norm
      FROM normalized_scores
      ORDER BY combined_score DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map((row, index) => ({
      rank: index + 1,
      agentId: row.agent_id,
      agentName: row.agent_name,
      combinedScore: parseFloat(row.combined_score) || 0,
      pointsNormalized: parseFloat(row.points_norm) || 0,
      eloNormalized: parseFloat(row.elo_norm) || 0,
      reputationNormalized: parseFloat(row.rep_norm) || 0,
    }));
  }

  /**
   * Get available periods for snapshots
   * @param {string} metric - Metric type
   * @returns {Promise<Array>} List of periods
   */
  async getAvailablePeriods(metric) {
    const query = `
      SELECT DISTINCT period
      FROM leaderboard_snapshots
      WHERE metric = $1
      ORDER BY period DESC
    `;

    const result = await this.db.query(query, [metric]);
    return result.rows.map(row => row.period);
  }

  /**
   * Map database row to leaderboard object
   * @private
   */
  mapLeaderboardRow(row) {
    if (!row) return null;

    return {
      rank: parseInt(row.rank) || 0,
      agentId: row.agent_id,
      agentName: row.agent_name,
      score: parseFloat(row.score) || 0,
      level: row.level ? parseInt(row.level) : undefined,
      tier: row.tier,
      wins: row.wins ? parseInt(row.wins) : undefined,
      losses: row.losses ? parseInt(row.losses) : undefined,
      trustScore: row.trust_score ? parseFloat(row.trust_score) : undefined,
      totalRatings: row.total_ratings ? parseInt(row.total_ratings) : undefined,
    };
  }

  /**
   * Map database row to Hall of Fame object
   * @private
   */
  mapHallOfFameRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agent_id,
      achievementType: row.achievement_type,
      description: row.description,
      metric: row.metric,
      value: row.value ? parseFloat(row.value) : null,
      metadata: row.metadata,
      inductedAt: row.inducted_at,
    };
  }
}

export default new LeaderboardRepository();
