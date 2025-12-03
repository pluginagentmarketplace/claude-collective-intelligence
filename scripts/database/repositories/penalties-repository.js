import dbClient from '../db-client.js';

/**
 * Repository for Penalties data access
 * Handles violations, appeals, and penalty management
 */
export class PenaltiesRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create a violation record
   * @param {Object} violation - Violation data
   * @returns {Promise<Object>} Created violation
   */
  async createViolation(violation) {
    const query = `
      INSERT INTO penalty_violations (
        violation_id, agent_id, violation_type, severity,
        description, evidence, reported_by, status,
        metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `;

    const values = [
      violation.violationId,
      violation.agentId,
      violation.violationType,
      violation.severity || 'medium',
      violation.description,
      JSON.stringify(violation.evidence || {}),
      violation.reportedBy,
      violation.status || 'pending',
      JSON.stringify(violation.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapViolationRow(result.rows[0]);
  }

  /**
   * Find violation by ID
   * @param {string} violationId - Violation ID
   * @returns {Promise<Object|null>} Violation or null
   */
  async findViolationById(violationId) {
    const query = 'SELECT * FROM penalty_violations WHERE violation_id = $1';
    const result = await this.db.query(query, [violationId]);
    return result.rows[0] ? this.mapViolationRow(result.rows[0]) : null;
  }

  /**
   * Find violations by agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of violations
   */
  async findViolationsByAgent(agentId, options = {}) {
    let query = 'SELECT * FROM penalty_violations WHERE agent_id = $1';
    const params = [agentId];

    if (options.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    if (options.violationType) {
      query += ` AND violation_type = $${params.length + 1}`;
      params.push(options.violationType);
    }

    if (options.severity) {
      query += ` AND severity = $${params.length + 1}`;
      params.push(options.severity);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapViolationRow(row));
  }

  /**
   * Update violation status
   * @param {string} violationId - Violation ID
   * @param {string} status - New status
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated violation
   */
  async updateViolationStatus(violationId, status, options = {}) {
    const fields = ['status = $1'];
    const values = [status];
    let paramIndex = 2;

    if (status === 'confirmed') {
      fields.push('confirmed_at = NOW()');
    } else if (status === 'dismissed') {
      fields.push('dismissed_at = NOW()');
    }

    if (options.resolution) {
      fields.push(`resolution = $${paramIndex}`);
      values.push(options.resolution);
      paramIndex++;
    }

    values.push(violationId);

    const query = `
      UPDATE penalty_violations
      SET ${fields.join(', ')}
      WHERE violation_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapViolationRow(result.rows[0]) : null;
  }

  /**
   * Apply penalty for violation
   * @param {Object} penalty - Penalty data
   * @returns {Promise<Object>} Created penalty
   */
  async applyPenalty(penalty) {
    const query = `
      INSERT INTO penalties (
        violation_id, agent_id, penalty_type, duration_ms,
        points_deducted, description, applied_by,
        expires_at, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `;

    const values = [
      penalty.violationId,
      penalty.agentId,
      penalty.penaltyType,
      penalty.durationMs || null,
      penalty.pointsDeducted || 0,
      penalty.description || null,
      penalty.appliedBy,
      penalty.expiresAt || null,
      penalty.status || 'active',
    ];

    const result = await this.db.query(query, values);
    return this.mapPenaltyRow(result.rows[0]);
  }

  /**
   * Find penalties by agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of penalties
   */
  async findPenaltiesByAgent(agentId, options = {}) {
    let query = 'SELECT * FROM penalties WHERE agent_id = $1';
    const params = [agentId];

    if (options.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    if (options.penaltyType) {
      query += ` AND penalty_type = $${params.length + 1}`;
      params.push(options.penaltyType);
    }

    if (options.activeOnly) {
      query += ' AND status = \'active\' AND (expires_at IS NULL OR expires_at > NOW())';
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapPenaltyRow(row));
  }

  /**
   * Lift penalty
   * @param {number} penaltyId - Penalty ID
   * @param {string} liftedBy - Who lifted it
   * @param {string} reason - Reason for lifting
   * @returns {Promise<Object>} Updated penalty
   */
  async liftPenalty(penaltyId, liftedBy, reason = null) {
    const query = `
      UPDATE penalties
      SET status = 'lifted',
          lifted_at = NOW(),
          lifted_by = $1,
          lift_reason = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await this.db.query(query, [liftedBy, reason, penaltyId]);
    return result.rows[0] ? this.mapPenaltyRow(result.rows[0]) : null;
  }

  /**
   * Create an appeal
   * @param {Object} appeal - Appeal data
   * @returns {Promise<Object>} Created appeal
   */
  async createAppeal(appeal) {
    const query = `
      INSERT INTO penalty_appeals (
        appeal_id, violation_id, agent_id, reason,
        supporting_evidence, status, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const values = [
      appeal.appealId,
      appeal.violationId,
      appeal.agentId,
      appeal.reason,
      JSON.stringify(appeal.supportingEvidence || {}),
      appeal.status || 'pending',
      JSON.stringify(appeal.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapAppealRow(result.rows[0]);
  }

  /**
   * Find appeal by ID
   * @param {string} appealId - Appeal ID
   * @returns {Promise<Object|null>} Appeal or null
   */
  async findAppealById(appealId) {
    const query = 'SELECT * FROM penalty_appeals WHERE appeal_id = $1';
    const result = await this.db.query(query, [appealId]);
    return result.rows[0] ? this.mapAppealRow(result.rows[0]) : null;
  }

  /**
   * Find appeals by agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of appeals
   */
  async findAppealsByAgent(agentId, options = {}) {
    let query = 'SELECT * FROM penalty_appeals WHERE agent_id = $1';
    const params = [agentId];

    if (options.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapAppealRow(row));
  }

  /**
   * Update appeal status
   * @param {string} appealId - Appeal ID
   * @param {string} status - New status
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated appeal
   */
  async updateAppealStatus(appealId, status, options = {}) {
    const fields = ['status = $1'];
    const values = [status];
    let paramIndex = 2;

    if (status === 'approved' || status === 'rejected') {
      fields.push('reviewed_at = NOW()');
    }

    if (options.reviewedBy) {
      fields.push(`reviewed_by = $${paramIndex}`);
      values.push(options.reviewedBy);
      paramIndex++;
    }

    if (options.reviewNotes) {
      fields.push(`review_notes = $${paramIndex}`);
      values.push(options.reviewNotes);
      paramIndex++;
    }

    values.push(appealId);

    const query = `
      UPDATE penalty_appeals
      SET ${fields.join(', ')}
      WHERE appeal_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapAppealRow(result.rows[0]) : null;
  }

  /**
   * Find expired penalties
   * @returns {Promise<Array>} List of expired penalties
   */
  async findExpiredPenalties() {
    const query = `
      SELECT * FROM penalties
      WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
      ORDER BY expires_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapPenaltyRow(row));
  }

  /**
   * Get penalty statistics
   * @returns {Promise<Object>} Penalty statistics
   */
  async getStats() {
    const violationQuery = `
      SELECT
        COUNT(*) as total_violations,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_violations,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_violations,
        COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_violations,
        COUNT(*) FILTER (WHERE severity = 'low') as low_severity,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium_severity,
        COUNT(*) FILTER (WHERE severity = 'high') as high_severity,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_severity
      FROM penalty_violations
    `;

    const penaltyQuery = `
      SELECT
        COUNT(*) as total_penalties,
        COUNT(*) FILTER (WHERE status = 'active') as active_penalties,
        COUNT(*) FILTER (WHERE status = 'lifted') as lifted_penalties,
        SUM(points_deducted) as total_points_deducted
      FROM penalties
    `;

    const appealQuery = `
      SELECT
        COUNT(*) as total_appeals,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_appeals,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_appeals,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_appeals
      FROM penalty_appeals
    `;

    const violationResult = await this.db.query(violationQuery);
    const penaltyResult = await this.db.query(penaltyQuery);
    const appealResult = await this.db.query(appealQuery);

    const violRow = violationResult.rows[0];
    const penRow = penaltyResult.rows[0];
    const appRow = appealResult.rows[0];

    return {
      violations: {
        total: parseInt(violRow.total_violations) || 0,
        pending: parseInt(violRow.pending_violations) || 0,
        confirmed: parseInt(violRow.confirmed_violations) || 0,
        dismissed: parseInt(violRow.dismissed_violations) || 0,
        bySeverity: {
          low: parseInt(violRow.low_severity) || 0,
          medium: parseInt(violRow.medium_severity) || 0,
          high: parseInt(violRow.high_severity) || 0,
          critical: parseInt(violRow.critical_severity) || 0,
        },
      },
      penalties: {
        total: parseInt(penRow.total_penalties) || 0,
        active: parseInt(penRow.active_penalties) || 0,
        lifted: parseInt(penRow.lifted_penalties) || 0,
        totalPointsDeducted: parseInt(penRow.total_points_deducted) || 0,
      },
      appeals: {
        total: parseInt(appRow.total_appeals) || 0,
        pending: parseInt(appRow.pending_appeals) || 0,
        approved: parseInt(appRow.approved_appeals) || 0,
        rejected: parseInt(appRow.rejected_appeals) || 0,
      },
    };
  }

  /**
   * Get agent penalty summary
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Agent penalty summary
   */
  async getAgentSummary(agentId) {
    const violationsQuery = `
      SELECT COUNT(*) as count, severity
      FROM penalty_violations
      WHERE agent_id = $1
      GROUP BY severity
    `;

    const penaltiesQuery = `
      SELECT
        COUNT(*) as total_penalties,
        COUNT(*) FILTER (WHERE status = 'active') as active_penalties,
        SUM(points_deducted) as total_points_deducted
      FROM penalties
      WHERE agent_id = $1
    `;

    const violationsResult = await this.db.query(violationsQuery, [agentId]);
    const penaltiesResult = await this.db.query(penaltiesQuery, [agentId]);

    const violationsBySeverity = violationsResult.rows.reduce((acc, row) => {
      acc[row.severity] = parseInt(row.count);
      return acc;
    }, {});

    const penRow = penaltiesResult.rows[0] || {};

    return {
      agentId,
      violationsBySeverity,
      totalPenalties: parseInt(penRow.total_penalties) || 0,
      activePenalties: parseInt(penRow.active_penalties) || 0,
      totalPointsDeducted: parseInt(penRow.total_points_deducted) || 0,
    };
  }

  /**
   * Map database row to violation object
   * @private
   */
  mapViolationRow(row) {
    if (!row) return null;

    return {
      violationId: row.violation_id,
      agentId: row.agent_id,
      violationType: row.violation_type,
      severity: row.severity,
      description: row.description,
      evidence: row.evidence,
      reportedBy: row.reported_by,
      status: row.status,
      resolution: row.resolution,
      metadata: row.metadata,
      confirmedAt: row.confirmed_at,
      dismissedAt: row.dismissed_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to penalty object
   * @private
   */
  mapPenaltyRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      violationId: row.violation_id,
      agentId: row.agent_id,
      penaltyType: row.penalty_type,
      durationMs: row.duration_ms,
      pointsDeducted: parseInt(row.points_deducted) || 0,
      description: row.description,
      appliedBy: row.applied_by,
      expiresAt: row.expires_at,
      status: row.status,
      liftedAt: row.lifted_at,
      liftedBy: row.lifted_by,
      liftReason: row.lift_reason,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to appeal object
   * @private
   */
  mapAppealRow(row) {
    if (!row) return null;

    return {
      appealId: row.appeal_id,
      violationId: row.violation_id,
      agentId: row.agent_id,
      reason: row.reason,
      supportingEvidence: row.supporting_evidence,
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewNotes: row.review_notes,
      metadata: row.metadata,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
    };
  }
}

export default new PenaltiesRepository();
