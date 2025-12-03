import dbClient from '../db-client.js';

/**
 * Repository for Reputation data access
 * Handles trust scores, ratings, and reputation management
 */
export class ReputationRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create or get reputation profile
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Reputation profile
   */
  async getOrCreateProfile(agentId) {
    const existing = await this.findProfileByAgent(agentId);
    if (existing) return existing;

    const query = `
      INSERT INTO reputation_profiles (
        agent_id, trust_score, reliability_score, quality_score,
        collaboration_score, total_ratings, created_at, updated_at
      )
      VALUES ($1, 50.0, 50.0, 50.0, 50.0, 0, NOW(), NOW())
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
    const query = 'SELECT * FROM reputation_profiles WHERE agent_id = $1';
    const result = await this.db.query(query, [agentId]);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Add rating for agent
   * @param {Object} rating - Rating data
   * @returns {Promise<Object>} Created rating
   */
  async addRating(rating) {
    return await this.db.transaction(async (client) => {
      // Insert rating
      const insertQuery = `
        INSERT INTO reputation_ratings (
          agent_id, rated_by, rating_type, score,
          feedback, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const ratingResult = await client.query(insertQuery, [
        rating.agentId,
        rating.ratedBy,
        rating.ratingType,
        rating.score,
        rating.feedback || null,
        JSON.stringify(rating.metadata || {}),
      ]);

      // Update profile scores
      await this.recalculateScores(rating.agentId, client);

      return this.mapRatingRow(ratingResult.rows[0]);
    });
  }

  /**
   * Recalculate all scores for an agent
   * @param {string} agentId - Agent ID
   * @param {Object} client - Database client (for transactions)
   * @private
   */
  async recalculateScores(agentId, client = null) {
    const db = client || this.db;

    const query = `
      UPDATE reputation_profiles
      SET
        trust_score = (
          SELECT COALESCE(AVG(score), 50.0)
          FROM reputation_ratings
          WHERE agent_id = $1 AND rating_type = 'trust'
        ),
        reliability_score = (
          SELECT COALESCE(AVG(score), 50.0)
          FROM reputation_ratings
          WHERE agent_id = $1 AND rating_type = 'reliability'
        ),
        quality_score = (
          SELECT COALESCE(AVG(score), 50.0)
          FROM reputation_ratings
          WHERE agent_id = $1 AND rating_type = 'quality'
        ),
        collaboration_score = (
          SELECT COALESCE(AVG(score), 50.0)
          FROM reputation_ratings
          WHERE agent_id = $1 AND rating_type = 'collaboration'
        ),
        total_ratings = (
          SELECT COUNT(*)
          FROM reputation_ratings
          WHERE agent_id = $1
        ),
        updated_at = NOW()
      WHERE agent_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [agentId]);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Get ratings for agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of ratings
   */
  async getRatingsByAgent(agentId, options = {}) {
    let query = `
      SELECT * FROM reputation_ratings
      WHERE agent_id = $1
    `;

    const params = [agentId];

    if (options.ratingType) {
      query += ` AND rating_type = $${params.length + 1}`;
      params.push(options.ratingType);
    }

    if (options.ratedBy) {
      query += ` AND rated_by = $${params.length + 1}`;
      params.push(options.ratedBy);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRatingRow(row));
  }

  /**
   * Update trust score
   * @param {string} agentId - Agent ID
   * @param {number} scoreChange - Score change
   * @returns {Promise<Object>} Updated profile
   */
  async updateTrustScore(agentId, scoreChange) {
    const query = `
      UPDATE reputation_profiles
      SET trust_score = GREATEST(0, LEAST(100, trust_score + $1)),
          updated_at = NOW()
      WHERE agent_id = $2
      RETURNING *
    `;

    const result = await this.db.query(query, [scoreChange, agentId]);
    return result.rows[0] ? this.mapProfileRow(result.rows[0]) : null;
  }

  /**
   * Get top rated agents
   * @param {string} scoreType - Score type to rank by
   * @param {number} limit - Number of agents to return
   * @returns {Promise<Array>} Top rated agents
   */
  async getTopRated(scoreType = 'trust_score', limit = 10) {
    const validScores = ['trust_score', 'reliability_score', 'quality_score', 'collaboration_score'];
    const column = validScores.includes(scoreType) ? scoreType : 'trust_score';

    const query = `
      SELECT rp.*, a.agent_name
      FROM reputation_profiles rp
      JOIN agents a ON rp.agent_id = a.agent_id
      WHERE rp.total_ratings >= 5
      ORDER BY rp.${column} DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => ({
      ...this.mapProfileRow(row),
      agentName: row.agent_name,
    }));
  }

  /**
   * Create reputation event
   * @param {Object} event - Event data
   * @returns {Promise<Object>} Created event
   */
  async createEvent(event) {
    const query = `
      INSERT INTO reputation_events (
        agent_id, event_type, impact, description,
        metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const values = [
      event.agentId,
      event.eventType,
      event.impact || 0,
      event.description,
      JSON.stringify(event.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapEventRow(result.rows[0]);
  }

  /**
   * Get reputation events for agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of events
   */
  async getEventsByAgent(agentId, options = {}) {
    let query = `
      SELECT * FROM reputation_events
      WHERE agent_id = $1
    `;

    const params = [agentId];

    if (options.eventType) {
      query += ` AND event_type = $${params.length + 1}`;
      params.push(options.eventType);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapEventRow(row));
  }

  /**
   * Get reputation statistics
   * @returns {Promise<Object>} Reputation statistics
   */
  async getStats() {
    const query = `
      SELECT
        COUNT(*) as total_profiles,
        AVG(trust_score) as avg_trust_score,
        AVG(reliability_score) as avg_reliability_score,
        AVG(quality_score) as avg_quality_score,
        AVG(collaboration_score) as avg_collaboration_score,
        SUM(total_ratings) as total_ratings_given
      FROM reputation_profiles
    `;

    const result = await this.db.query(query);
    const row = result.rows[0];

    return {
      totalProfiles: parseInt(row.total_profiles) || 0,
      avgTrustScore: parseFloat(row.avg_trust_score) || 0,
      avgReliabilityScore: parseFloat(row.avg_reliability_score) || 0,
      avgQualityScore: parseFloat(row.avg_quality_score) || 0,
      avgCollaborationScore: parseFloat(row.avg_collaboration_score) || 0,
      totalRatingsGiven: parseInt(row.total_ratings_given) || 0,
    };
  }

  /**
   * Get agent's overall reputation score
   * @param {string} agentId - Agent ID
   * @returns {Promise<number>} Overall reputation score
   */
  async getOverallScore(agentId) {
    const profile = await this.findProfileByAgent(agentId);
    if (!profile) return 0;

    return (
      (profile.trustScore +
        profile.reliabilityScore +
        profile.qualityScore +
        profile.collaborationScore) / 4
    );
  }

  /**
   * Map database row to profile object
   * @private
   */
  mapProfileRow(row) {
    if (!row) return null;

    return {
      agentId: row.agent_id,
      trustScore: parseFloat(row.trust_score) || 0,
      reliabilityScore: parseFloat(row.reliability_score) || 0,
      qualityScore: parseFloat(row.quality_score) || 0,
      collaborationScore: parseFloat(row.collaboration_score) || 0,
      totalRatings: parseInt(row.total_ratings) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to rating object
   * @private
   */
  mapRatingRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agent_id,
      ratedBy: row.rated_by,
      ratingType: row.rating_type,
      score: parseFloat(row.score) || 0,
      feedback: row.feedback,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to event object
   * @private
   */
  mapEventRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agent_id,
      eventType: row.event_type,
      impact: parseFloat(row.impact) || 0,
      description: row.description,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}

export default new ReputationRepository();
