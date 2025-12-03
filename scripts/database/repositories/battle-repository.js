import dbClient from '../db-client.js';

/**
 * Repository for Battle data access
 * Handles AI battles, matches, and ELO rating updates
 */
export class BattleRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create or get battle profile
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Battle profile
   */
  async getOrCreateProfile(agentId) {
    const existing = await this.findProfileByAgent(agentId);
    if (existing) return existing;

    const query = `
      INSERT INTO battle_profiles (
        agent_id, elo_rating, wins, losses, draws,
        total_matches, win_streak, longest_win_streak,
        created_at, updated_at
      )
      VALUES ($1, 1500, 0, 0, 0, 0, 0, 0, NOW(), NOW())
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
    const query = 'SELECT * FROM battle_profiles WHERE agent_id = $1';
    const result = await this.db.query(query, [agentId]);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Create a new battle match
   * @param {Object} match - Match data
   * @returns {Promise<Object>} Created match
   */
  async createMatch(match) {
    const query = `
      INSERT INTO battle_matches (
        match_id, agent1_id, agent2_id, match_type,
        status, challenge, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      match.matchId,
      match.agent1Id,
      match.agent2Id,
      match.matchType || 'standard',
      match.status || 'pending',
      match.challenge || null,
      JSON.stringify(match.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapMatchRow(result.rows[0]);
  }

  /**
   * Find match by ID
   * @param {string} matchId - Match ID
   * @returns {Promise<Object|null>} Match or null
   */
  async findMatchById(matchId) {
    const query = 'SELECT * FROM battle_matches WHERE match_id = $1';
    const result = await this.db.query(query, [matchId]);
    return result.rows[0] ? this.mapMatchRow(result.rows[0]) : null;
  }

  /**
   * Update match result
   * @param {string} matchId - Match ID
   * @param {Object} result - Match result
   * @returns {Promise<Object>} Updated match
   */
  async updateMatchResult(matchId, result) {
    return await this.db.transaction(async (client) => {
      // Update match
      const updateMatchQuery = `
        UPDATE battle_matches
        SET winner_id = $1,
            status = 'completed',
            agent1_score = $2,
            agent2_score = $3,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE match_id = $4
        RETURNING *
      `;

      const matchResult = await client.query(updateMatchQuery, [
        result.winnerId,
        result.agent1Score || 0,
        result.agent2Score || 0,
        matchId,
      ]);

      const match = this.mapMatchRow(matchResult.rows[0]);

      // Update ELO ratings
      if (result.winnerId) {
        await this.updateEloRatings(
          match.agent1Id,
          match.agent2Id,
          result.winnerId,
          result.isDraw || false,
          client
        );
      }

      return match;
    });
  }

  /**
   * Update ELO ratings for both agents
   * @param {string} agent1Id - Agent 1 ID
   * @param {string} agent2Id - Agent 2 ID
   * @param {string} winnerId - Winner ID
   * @param {boolean} isDraw - Is draw
   * @param {Object} client - Database client (for transactions)
   * @private
   */
  async updateEloRatings(agent1Id, agent2Id, winnerId, isDraw = false, client = null) {
    const db = client || this.db;

    // Get current ratings
    const profile1 = await this.findProfileByAgent(agent1Id);
    const profile2 = await this.findProfileByAgent(agent2Id);

    const K = 32; // K-factor for ELO calculation
    const rating1 = profile1?.eloRating || 1500;
    const rating2 = profile2?.eloRating || 1500;

    // Calculate expected scores
    const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
    const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));

    // Calculate actual scores
    let actual1, actual2;
    if (isDraw) {
      actual1 = actual2 = 0.5;
    } else {
      actual1 = winnerId === agent1Id ? 1 : 0;
      actual2 = winnerId === agent2Id ? 1 : 0;
    }

    // Calculate new ratings
    const newRating1 = Math.round(rating1 + K * (actual1 - expected1));
    const newRating2 = Math.round(rating2 + K * (actual2 - expected2));

    // Update agent 1
    await this.updateProfileAfterMatch(agent1Id, actual1, newRating1, db);

    // Update agent 2
    await this.updateProfileAfterMatch(agent2Id, actual2, newRating2, db);
  }

  /**
   * Update battle profile after match
   * @param {string} agentId - Agent ID
   * @param {number} actualScore - Actual score (1 = win, 0.5 = draw, 0 = loss)
   * @param {number} newRating - New ELO rating
   * @param {Object} client - Database client (for transactions)
   * @private
   */
  async updateProfileAfterMatch(agentId, actualScore, newRating, client = null) {
    const db = client || this.db;

    let updateFields = ['elo_rating = $1', 'total_matches = total_matches + 1'];
    const values = [newRating];
    let paramIndex = 2;

    if (actualScore === 1) {
      // Win
      updateFields.push('wins = wins + 1');
      updateFields.push('win_streak = win_streak + 1');
      updateFields.push('longest_win_streak = GREATEST(longest_win_streak, win_streak + 1)');
    } else if (actualScore === 0.5) {
      // Draw
      updateFields.push('draws = draws + 1');
      updateFields.push('win_streak = 0');
    } else {
      // Loss
      updateFields.push('losses = losses + 1');
      updateFields.push('win_streak = 0');
    }

    updateFields.push('updated_at = NOW()');
    values.push(agentId);

    const query = `
      UPDATE battle_profiles
      SET ${updateFields.join(', ')}
      WHERE agent_id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Get match history for agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Match history
   */
  async getMatchHistory(agentId, options = {}) {
    let query = `
      SELECT * FROM battle_matches
      WHERE (agent1_id = $1 OR agent2_id = $1)
      AND status = 'completed'
    `;

    const params = [agentId];

    query += ' ORDER BY completed_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapMatchRow(row));
  }

  /**
   * Get leaderboard by ELO rating
   * @param {number} limit - Number of agents to return
   * @returns {Promise<Array>} Leaderboard
   */
  async getLeaderboard(limit = 10) {
    const query = `
      SELECT bp.*, a.agent_name
      FROM battle_profiles bp
      JOIN agents a ON bp.agent_id = a.agent_id
      WHERE bp.total_matches >= 5
      ORDER BY bp.elo_rating DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => ({
      ...this.mapProfileRow(row),
      agentName: row.agent_name,
    }));
  }

  /**
   * Find pending matches
   * @returns {Promise<Array>} List of pending matches
   */
  async findPendingMatches() {
    const query = `
      SELECT * FROM battle_matches
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapMatchRow(row));
  }

  /**
   * Get battle statistics
   * @returns {Promise<Object>} Battle statistics
   */
  async getStats() {
    const query = `
      SELECT
        COUNT(*) as total_profiles,
        AVG(elo_rating) as avg_elo,
        MAX(elo_rating) as max_elo,
        MIN(elo_rating) as min_elo,
        SUM(total_matches) as total_matches_played,
        SUM(wins) as total_wins,
        SUM(losses) as total_losses,
        SUM(draws) as total_draws
      FROM battle_profiles
    `;

    const result = await this.db.query(query);
    const row = result.rows[0];

    return {
      totalProfiles: parseInt(row.total_profiles) || 0,
      avgElo: parseFloat(row.avg_elo) || 0,
      maxElo: parseInt(row.max_elo) || 0,
      minElo: parseInt(row.min_elo) || 0,
      totalMatchesPlayed: parseInt(row.total_matches_played) || 0,
      totalWins: parseInt(row.total_wins) || 0,
      totalLosses: parseInt(row.total_losses) || 0,
      totalDraws: parseInt(row.total_draws) || 0,
    };
  }

  /**
   * Delete match
   * @param {string} matchId - Match ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteMatch(matchId) {
    const query = 'DELETE FROM battle_matches WHERE match_id = $1 RETURNING match_id';
    const result = await this.db.query(query, [matchId]);
    return result.rowCount > 0;
  }

  /**
   * Map database row to profile object
   * @private
   */
  mapProfileRow(row) {
    if (!row) return null;

    return {
      agentId: row.agent_id,
      eloRating: parseInt(row.elo_rating) || 1500,
      wins: parseInt(row.wins) || 0,
      losses: parseInt(row.losses) || 0,
      draws: parseInt(row.draws) || 0,
      totalMatches: parseInt(row.total_matches) || 0,
      winStreak: parseInt(row.win_streak) || 0,
      longestWinStreak: parseInt(row.longest_win_streak) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to match object
   * @private
   */
  mapMatchRow(row) {
    if (!row) return null;

    return {
      matchId: row.match_id,
      agent1Id: row.agent1_id,
      agent2Id: row.agent2_id,
      matchType: row.match_type,
      status: row.status,
      challenge: row.challenge,
      winnerId: row.winner_id,
      agent1Score: parseFloat(row.agent1_score) || 0,
      agent2Score: parseFloat(row.agent2_score) || 0,
      metadata: row.metadata,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    };
  }
}

export default new BattleRepository();
