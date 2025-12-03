import dbClient from '../db-client.js';

/**
 * Repository for Voting data access
 * Handles votes, proposals, and audit trail for democratic decision making
 */
export class VotingRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create a new proposal
   * @param {Object} proposal - Proposal data
   * @returns {Promise<Object>} Created proposal
   */
  async createProposal(proposal) {
    const query = `
      INSERT INTO voting_proposals (
        proposal_id, proposal_type, title, description,
        proposed_by, voting_threshold, expires_at,
        status, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      proposal.proposalId,
      proposal.proposalType,
      proposal.title,
      proposal.description,
      proposal.proposedBy,
      proposal.votingThreshold || 0.6,
      proposal.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
      proposal.status || 'active',
      JSON.stringify(proposal.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapProposalRow(result.rows[0]);
  }

  /**
   * Find proposal by ID
   * @param {string} proposalId - Proposal ID
   * @returns {Promise<Object|null>} Proposal or null
   */
  async findProposalById(proposalId) {
    const query = 'SELECT * FROM voting_proposals WHERE proposal_id = $1';
    const result = await this.db.query(query, [proposalId]);
    return result.rows[0] ? this.mapProposalRow(result.rows[0]) : null;
  }

  /**
   * Find all proposals
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of proposals
   */
  async findAllProposals(options = {}) {
    let query = 'SELECT * FROM voting_proposals';
    const params = [];
    const conditions = [];

    if (options.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.status);
    }

    if (options.proposalType) {
      conditions.push(`proposal_type = $${params.length + 1}`);
      params.push(options.proposalType);
    }

    if (options.proposedBy) {
      conditions.push(`proposed_by = $${params.length + 1}`);
      params.push(options.proposedBy);
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
    return result.rows.map(row => this.mapProposalRow(row));
  }

  /**
   * Cast a vote
   * @param {Object} vote - Vote data
   * @returns {Promise<Object>} Created vote
   */
  async castVote(vote) {
    const query = `
      INSERT INTO votes (
        vote_id, proposal_id, voter_id, vote_value,
        weight, reason, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const values = [
      vote.voteId,
      vote.proposalId,
      vote.voterId,
      vote.voteValue,
      vote.weight || 1.0,
      vote.reason || null,
    ];

    const result = await this.db.query(query, values);
    return this.mapVoteRow(result.rows[0]);
  }

  /**
   * Find votes for a proposal
   * @param {string} proposalId - Proposal ID
   * @returns {Promise<Array>} List of votes
   */
  async findVotesByProposal(proposalId) {
    const query = `
      SELECT * FROM votes
      WHERE proposal_id = $1
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [proposalId]);
    return result.rows.map(row => this.mapVoteRow(row));
  }

  /**
   * Get vote by voter and proposal
   * @param {string} proposalId - Proposal ID
   * @param {string} voterId - Voter ID
   * @returns {Promise<Object|null>} Vote or null
   */
  async findVoteByVoter(proposalId, voterId) {
    const query = `
      SELECT * FROM votes
      WHERE proposal_id = $1 AND voter_id = $2
    `;

    const result = await this.db.query(query, [proposalId, voterId]);
    return result.rows[0] ? this.mapVoteRow(result.rows[0]) : null;
  }

  /**
   * Get voting results for a proposal
   * @param {string} proposalId - Proposal ID
   * @returns {Promise<Object>} Voting results
   */
  async getVotingResults(proposalId) {
    const query = `
      SELECT
        COUNT(*) as total_votes,
        SUM(CASE WHEN vote_value = 'yes' THEN weight ELSE 0 END) as yes_votes,
        SUM(CASE WHEN vote_value = 'no' THEN weight ELSE 0 END) as no_votes,
        SUM(CASE WHEN vote_value = 'abstain' THEN weight ELSE 0 END) as abstain_votes,
        SUM(weight) as total_weight
      FROM votes
      WHERE proposal_id = $1
    `;

    const result = await this.db.query(query, [proposalId]);
    const row = result.rows[0];

    return {
      totalVotes: parseInt(row.total_votes) || 0,
      yesVotes: parseFloat(row.yes_votes) || 0,
      noVotes: parseFloat(row.no_votes) || 0,
      abstainVotes: parseFloat(row.abstain_votes) || 0,
      totalWeight: parseFloat(row.total_weight) || 0,
    };
  }

  /**
   * Update proposal status
   * @param {string} proposalId - Proposal ID
   * @param {string} status - New status
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated proposal
   */
  async updateProposalStatus(proposalId, status, options = {}) {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let paramIndex = 2;

    if (options.executedAt && status === 'executed') {
      fields.push('executed_at = NOW()');
    }

    if (options.rejectedAt && status === 'rejected') {
      fields.push('rejected_at = NOW()');
    }

    values.push(proposalId);

    const query = `
      UPDATE voting_proposals
      SET ${fields.join(', ')}
      WHERE proposal_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapProposalRow(result.rows[0]) : null;
  }

  /**
   * Create audit log entry
   * @param {Object} audit - Audit data
   * @returns {Promise<Object>} Created audit entry
   */
  async createAuditLog(audit) {
    const query = `
      INSERT INTO voting_audit (
        audit_id, proposal_id, action, performed_by,
        details, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const values = [
      audit.auditId,
      audit.proposalId,
      audit.action,
      audit.performedBy,
      JSON.stringify(audit.details || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapAuditRow(result.rows[0]);
  }

  /**
   * Get audit log for a proposal
   * @param {string} proposalId - Proposal ID
   * @returns {Promise<Array>} Audit log entries
   */
  async getAuditLog(proposalId) {
    const query = `
      SELECT * FROM voting_audit
      WHERE proposal_id = $1
      ORDER BY created_at ASC
    `;

    const result = await this.db.query(query, [proposalId]);
    return result.rows.map(row => this.mapAuditRow(row));
  }

  /**
   * Find expired proposals
   * @returns {Promise<Array>} List of expired proposals
   */
  async findExpiredProposals() {
    const query = `
      SELECT * FROM voting_proposals
      WHERE status = 'active'
      AND expires_at < NOW()
      ORDER BY expires_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapProposalRow(row));
  }

  /**
   * Get voting statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Voting statistics
   */
  async getStats(filters = {}) {
    let query = `
      SELECT
        COUNT(*) as total_proposals,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'executed') as executed,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'expired') as expired
      FROM voting_proposals
    `;

    const params = [];
    const conditions = [];

    if (filters.proposalType) {
      conditions.push(`proposal_type = $${params.length + 1}`);
      params.push(filters.proposalType);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.db.query(query, params);
    const row = result.rows[0];

    return {
      totalProposals: parseInt(row.total_proposals) || 0,
      active: parseInt(row.active) || 0,
      executed: parseInt(row.executed) || 0,
      rejected: parseInt(row.rejected) || 0,
      expired: parseInt(row.expired) || 0,
    };
  }

  /**
   * Delete proposal and associated votes
   * @param {string} proposalId - Proposal ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteProposal(proposalId) {
    return await this.db.transaction(async (client) => {
      // Delete votes first
      await client.query('DELETE FROM votes WHERE proposal_id = $1', [proposalId]);

      // Delete audit logs
      await client.query('DELETE FROM voting_audit WHERE proposal_id = $1', [proposalId]);

      // Delete proposal
      const result = await client.query(
        'DELETE FROM voting_proposals WHERE proposal_id = $1 RETURNING proposal_id',
        [proposalId]
      );

      return result.rowCount > 0;
    });
  }

  /**
   * Map database row to proposal object
   * @private
   */
  mapProposalRow(row) {
    if (!row) return null;

    return {
      proposalId: row.proposal_id,
      proposalType: row.proposal_type,
      title: row.title,
      description: row.description,
      proposedBy: row.proposed_by,
      votingThreshold: parseFloat(row.voting_threshold),
      expiresAt: row.expires_at,
      status: row.status,
      metadata: row.metadata,
      executedAt: row.executed_at,
      rejectedAt: row.rejected_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to vote object
   * @private
   */
  mapVoteRow(row) {
    if (!row) return null;

    return {
      voteId: row.vote_id,
      proposalId: row.proposal_id,
      voterId: row.voter_id,
      voteValue: row.vote_value,
      weight: parseFloat(row.weight),
      reason: row.reason,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to audit object
   * @private
   */
  mapAuditRow(row) {
    if (!row) return null;

    return {
      auditId: row.audit_id,
      proposalId: row.proposal_id,
      action: row.action,
      performedBy: row.performed_by,
      details: row.details,
      createdAt: row.created_at,
    };
  }
}

export default new VotingRepository();
