import dbClient from '../db-client.js';

/**
 * Repository for Brainstorm data access
 * Handles brainstorming sessions and ideas
 */
export class BrainstormRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create a new brainstorm session
   * @param {Object} session - Session data
   * @returns {Promise<Object>} Created session
   */
  async createSession(session) {
    const query = `
      INSERT INTO brainstorm_sessions (
        session_id, topic, description, initiated_by,
        status, max_ideas, duration_ms, expires_at,
        metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      session.sessionId,
      session.topic,
      session.description || null,
      session.initiatedBy,
      session.status || 'active',
      session.maxIdeas || 100,
      session.durationMs || 300000,
      session.expiresAt || new Date(Date.now() + 300000),
      JSON.stringify(session.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapSessionRow(result.rows[0]);
  }

  /**
   * Find session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session or null
   */
  async findSessionById(sessionId) {
    const query = 'SELECT * FROM brainstorm_sessions WHERE session_id = $1';
    const result = await this.db.query(query, [sessionId]);
    return result.rows[0] ? this.mapSessionRow(result.rows[0]) : null;
  }

  /**
   * Find all sessions
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of sessions
   */
  async findAllSessions(options = {}) {
    let query = 'SELECT * FROM brainstorm_sessions';
    const params = [];
    const conditions = [];

    if (options.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.status);
    }

    if (options.initiatedBy) {
      conditions.push(`initiated_by = $${params.length + 1}`);
      params.push(options.initiatedBy);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapSessionRow(row));
  }

  /**
   * Create an idea
   * @param {Object} idea - Idea data
   * @returns {Promise<Object>} Created idea
   */
  async createIdea(idea) {
    const query = `
      INSERT INTO brainstorm_ideas (
        idea_id, session_id, content, contributed_by,
        score, votes, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const values = [
      idea.ideaId,
      idea.sessionId,
      idea.content,
      idea.contributedBy,
      idea.score || 0,
      idea.votes || 0,
      JSON.stringify(idea.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapIdeaRow(result.rows[0]);
  }

  /**
   * Find ideas by session
   * @param {string} sessionId - Session ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of ideas
   */
  async findIdeasBySession(sessionId, options = {}) {
    let query = 'SELECT * FROM brainstorm_ideas WHERE session_id = $1';
    const params = [sessionId];

    if (options.orderBy === 'score') {
      query += ' ORDER BY score DESC, created_at ASC';
    } else if (options.orderBy === 'votes') {
      query += ' ORDER BY votes DESC, created_at ASC';
    } else {
      query += ' ORDER BY created_at ASC';
    }

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapIdeaRow(row));
  }

  /**
   * Find idea by ID
   * @param {string} ideaId - Idea ID
   * @returns {Promise<Object|null>} Idea or null
   */
  async findIdeaById(ideaId) {
    const query = 'SELECT * FROM brainstorm_ideas WHERE idea_id = $1';
    const result = await this.db.query(query, [ideaId]);
    return result.rows[0] ? this.mapIdeaRow(result.rows[0]) : null;
  }

  /**
   * Update idea score
   * @param {string} ideaId - Idea ID
   * @param {number} scoreDelta - Score change
   * @returns {Promise<Object>} Updated idea
   */
  async updateIdeaScore(ideaId, scoreDelta) {
    const query = `
      UPDATE brainstorm_ideas
      SET score = score + $1,
          votes = votes + 1
      WHERE idea_id = $2
      RETURNING *
    `;

    const result = await this.db.query(query, [scoreDelta, ideaId]);
    return result.rows[0] ? this.mapIdeaRow(result.rows[0]) : null;
  }

  /**
   * Update session status
   * @param {string} sessionId - Session ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated session
   */
  async updateSessionStatus(sessionId, status) {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const values = [status];

    if (status === 'completed') {
      fields.push('completed_at = NOW()');
    }

    values.push(sessionId);

    const query = `
      UPDATE brainstorm_sessions
      SET ${fields.join(', ')}
      WHERE session_id = $${values.length}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapSessionRow(result.rows[0]) : null;
  }

  /**
   * Get session with ideas
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session with ideas
   */
  async getSessionWithIdeas(sessionId) {
    const session = await this.findSessionById(sessionId);
    if (!session) return null;

    const ideas = await this.findIdeasBySession(sessionId, { orderBy: 'score' });
    return { ...session, ideas };
  }

  /**
   * Get session statistics
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStats(sessionId) {
    const query = `
      SELECT
        COUNT(*) as total_ideas,
        COUNT(DISTINCT contributed_by) as unique_contributors,
        AVG(score) as avg_score,
        MAX(score) as max_score,
        MIN(score) as min_score,
        SUM(votes) as total_votes
      FROM brainstorm_ideas
      WHERE session_id = $1
    `;

    const result = await this.db.query(query, [sessionId]);
    const row = result.rows[0];

    return {
      totalIdeas: parseInt(row.total_ideas) || 0,
      uniqueContributors: parseInt(row.unique_contributors) || 0,
      avgScore: parseFloat(row.avg_score) || 0,
      maxScore: parseFloat(row.max_score) || 0,
      minScore: parseFloat(row.min_score) || 0,
      totalVotes: parseInt(row.total_votes) || 0,
    };
  }

  /**
   * Find expired sessions
   * @returns {Promise<Array>} List of expired sessions
   */
  async findExpiredSessions() {
    const query = `
      SELECT * FROM brainstorm_sessions
      WHERE status = 'active'
      AND expires_at < NOW()
      ORDER BY expires_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapSessionRow(row));
  }

  /**
   * Get top ideas across all sessions
   * @param {number} limit - Number of ideas to return
   * @returns {Promise<Array>} Top ideas
   */
  async getTopIdeas(limit = 10) {
    const query = `
      SELECT i.*, s.topic as session_topic
      FROM brainstorm_ideas i
      JOIN brainstorm_sessions s ON i.session_id = s.session_id
      ORDER BY i.score DESC, i.votes DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => ({
      ...this.mapIdeaRow(row),
      sessionTopic: row.session_topic,
    }));
  }

  /**
   * Delete session and associated ideas
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteSession(sessionId) {
    return await this.db.transaction(async (client) => {
      // Delete ideas first
      await client.query('DELETE FROM brainstorm_ideas WHERE session_id = $1', [sessionId]);

      // Delete session
      const result = await client.query(
        'DELETE FROM brainstorm_sessions WHERE session_id = $1 RETURNING session_id',
        [sessionId]
      );

      return result.rowCount > 0;
    });
  }

  /**
   * Map database row to session object
   * @private
   */
  mapSessionRow(row) {
    if (!row) return null;

    return {
      sessionId: row.session_id,
      topic: row.topic,
      description: row.description,
      initiatedBy: row.initiated_by,
      status: row.status,
      maxIdeas: row.max_ideas,
      durationMs: row.duration_ms,
      expiresAt: row.expires_at,
      metadata: row.metadata,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to idea object
   * @private
   */
  mapIdeaRow(row) {
    if (!row) return null;

    return {
      ideaId: row.idea_id,
      sessionId: row.session_id,
      content: row.content,
      contributedBy: row.contributed_by,
      score: parseFloat(row.score) || 0,
      votes: parseInt(row.votes) || 0,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}

export default new BrainstormRepository();
