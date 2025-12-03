import dbClient from '../db-client.js';

/**
 * Repository for Mentorship data access
 * Handles mentor-mentee pairings and progress tracking
 */
export class MentorshipRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create a mentorship pairing
   * @param {Object} pairing - Pairing data
   * @returns {Promise<Object>} Created pairing
   */
  async createPairing(pairing) {
    const query = `
      INSERT INTO mentorship_pairings (
        pairing_id, mentor_id, mentee_id, status,
        started_at, goals, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      pairing.pairingId,
      pairing.mentorId,
      pairing.menteeId,
      pairing.status || 'active',
      JSON.stringify(pairing.goals || []),
      JSON.stringify(pairing.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapPairingRow(result.rows[0]);
  }

  /**
   * Find pairing by ID
   * @param {string} pairingId - Pairing ID
   * @returns {Promise<Object|null>} Pairing or null
   */
  async findPairingById(pairingId) {
    const query = 'SELECT * FROM mentorship_pairings WHERE pairing_id = $1';
    const result = await this.db.query(query, [pairingId]);
    return result.rows[0] ? this.mapPairingRow(result.rows[0]) : null;
  }

  /**
   * Find pairings by mentor
   * @param {string} mentorId - Mentor ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of pairings
   */
  async findPairingsByMentor(mentorId, options = {}) {
    let query = 'SELECT * FROM mentorship_pairings WHERE mentor_id = $1';
    const params = [mentorId];

    if (options.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    query += ' ORDER BY started_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapPairingRow(row));
  }

  /**
   * Find pairings by mentee
   * @param {string} menteeId - Mentee ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of pairings
   */
  async findPairingsByMentee(menteeId, options = {}) {
    let query = 'SELECT * FROM mentorship_pairings WHERE mentee_id = $1';
    const params = [menteeId];

    if (options.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    query += ' ORDER BY started_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapPairingRow(row));
  }

  /**
   * Update pairing status
   * @param {string} pairingId - Pairing ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated pairing
   */
  async updatePairingStatus(pairingId, status) {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const values = [status];

    if (status === 'completed') {
      fields.push('completed_at = NOW()');
    }

    values.push(pairingId);

    const query = `
      UPDATE mentorship_pairings
      SET ${fields.join(', ')}
      WHERE pairing_id = $${values.length}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapPairingRow(result.rows[0]) : null;
  }

  /**
   * Record progress entry
   * @param {Object} progress - Progress data
   * @returns {Promise<Object>} Created progress entry
   */
  async recordProgress(progress) {
    const query = `
      INSERT INTO mentorship_progress (
        pairing_id, milestone, description, completed,
        notes, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const values = [
      progress.pairingId,
      progress.milestone,
      progress.description || null,
      progress.completed || false,
      progress.notes || null,
      JSON.stringify(progress.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapProgressRow(result.rows[0]);
  }

  /**
   * Update progress entry
   * @param {number} progressId - Progress ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated progress entry
   */
  async updateProgress(progressId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.completed !== undefined) {
      fields.push(`completed = $${paramIndex}`);
      values.push(updates.completed);
      paramIndex++;
    }

    if (updates.notes !== undefined) {
      fields.push(`notes = $${paramIndex}`);
      values.push(updates.notes);
      paramIndex++;
    }

    if (updates.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(progressId);

    const query = `
      UPDATE mentorship_progress
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapProgressRow(result.rows[0]) : null;
  }

  /**
   * Get progress for pairing
   * @param {string} pairingId - Pairing ID
   * @returns {Promise<Array>} List of progress entries
   */
  async getProgressByPairing(pairingId) {
    const query = `
      SELECT * FROM mentorship_progress
      WHERE pairing_id = $1
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [pairingId]);
    return result.rows.map(row => this.mapProgressRow(row));
  }

  /**
   * Record session
   * @param {Object} session - Session data
   * @returns {Promise<Object>} Created session
   */
  async recordSession(session) {
    const query = `
      INSERT INTO mentorship_sessions (
        pairing_id, session_date, duration_minutes,
        topics_covered, feedback, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const values = [
      session.pairingId,
      session.sessionDate || new Date(),
      session.durationMinutes || 0,
      JSON.stringify(session.topicsCovered || []),
      session.feedback || null,
      JSON.stringify(session.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapSessionRow(result.rows[0]);
  }

  /**
   * Get sessions for pairing
   * @param {string} pairingId - Pairing ID
   * @returns {Promise<Array>} List of sessions
   */
  async getSessionsByPairing(pairingId) {
    const query = `
      SELECT * FROM mentorship_sessions
      WHERE pairing_id = $1
      ORDER BY session_date DESC
    `;

    const result = await this.db.query(query, [pairingId]);
    return result.rows.map(row => this.mapSessionRow(row));
  }

  /**
   * Get pairing with full details
   * @param {string} pairingId - Pairing ID
   * @returns {Promise<Object|null>} Pairing with progress and sessions
   */
  async getPairingWithDetails(pairingId) {
    const pairing = await this.findPairingById(pairingId);
    if (!pairing) return null;

    const progress = await this.getProgressByPairing(pairingId);
    const sessions = await this.getSessionsByPairing(pairingId);

    return { ...pairing, progress, sessions };
  }

  /**
   * Get mentorship statistics
   * @returns {Promise<Object>} Mentorship statistics
   */
  async getStats() {
    const query = `
      SELECT
        COUNT(*) as total_pairings,
        COUNT(*) FILTER (WHERE status = 'active') as active_pairings,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_pairings,
        COUNT(DISTINCT mentor_id) as unique_mentors,
        COUNT(DISTINCT mentee_id) as unique_mentees,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 86400) as avg_duration_days
      FROM mentorship_pairings
    `;

    const result = await this.db.query(query);
    const row = result.rows[0];

    return {
      totalPairings: parseInt(row.total_pairings) || 0,
      activePairings: parseInt(row.active_pairings) || 0,
      completedPairings: parseInt(row.completed_pairings) || 0,
      uniqueMentors: parseInt(row.unique_mentors) || 0,
      uniqueMentees: parseInt(row.unique_mentees) || 0,
      avgDurationDays: parseFloat(row.avg_duration_days) || 0,
    };
  }

  /**
   * Get top mentors (by number of successful mentorships)
   * @param {number} limit - Number of mentors to return
   * @returns {Promise<Array>} Top mentors
   */
  async getTopMentors(limit = 10) {
    const query = `
      SELECT
        mp.mentor_id,
        a.agent_name,
        COUNT(*) as total_mentorships,
        COUNT(*) FILTER (WHERE mp.status = 'completed') as completed_mentorships
      FROM mentorship_pairings mp
      JOIN agents a ON mp.mentor_id = a.agent_id
      GROUP BY mp.mentor_id, a.agent_name
      HAVING COUNT(*) FILTER (WHERE mp.status = 'completed') > 0
      ORDER BY completed_mentorships DESC, total_mentorships DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => ({
      mentorId: row.mentor_id,
      agentName: row.agent_name,
      totalMentorships: parseInt(row.total_mentorships),
      completedMentorships: parseInt(row.completed_mentorships),
    }));
  }

  /**
   * Delete pairing
   * @param {string} pairingId - Pairing ID
   * @returns {Promise<boolean>} Success status
   */
  async deletePairing(pairingId) {
    return await this.db.transaction(async (client) => {
      // Delete progress entries
      await client.query('DELETE FROM mentorship_progress WHERE pairing_id = $1', [pairingId]);

      // Delete sessions
      await client.query('DELETE FROM mentorship_sessions WHERE pairing_id = $1', [pairingId]);

      // Delete pairing
      const result = await client.query(
        'DELETE FROM mentorship_pairings WHERE pairing_id = $1 RETURNING pairing_id',
        [pairingId]
      );

      return result.rowCount > 0;
    });
  }

  /**
   * Map database row to pairing object
   * @private
   */
  mapPairingRow(row) {
    if (!row) return null;

    return {
      pairingId: row.pairing_id,
      mentorId: row.mentor_id,
      menteeId: row.mentee_id,
      status: row.status,
      goals: row.goals,
      metadata: row.metadata,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to progress object
   * @private
   */
  mapProgressRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      pairingId: row.pairing_id,
      milestone: row.milestone,
      description: row.description,
      completed: row.completed,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to session object
   * @private
   */
  mapSessionRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      pairingId: row.pairing_id,
      sessionDate: row.session_date,
      durationMinutes: parseInt(row.duration_minutes) || 0,
      topicsCovered: row.topics_covered,
      feedback: row.feedback,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}

export default new MentorshipRepository();
