import dbClient from '../db-client.js';

/**
 * Repository for Rewards data access
 * Handles reward allocations, redemptions, and permission management
 */
export class RewardsRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create a reward allocation
   * @param {Object} allocation - Allocation data
   * @returns {Promise<Object>} Created allocation
   */
  async createAllocation(allocation) {
    const query = `
      INSERT INTO reward_allocations (
        allocation_id, agent_id, reward_type, amount,
        reason, expires_at, status, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

    const values = [
      allocation.allocationId,
      allocation.agentId,
      allocation.rewardType,
      allocation.amount,
      allocation.reason || null,
      allocation.expiresAt || null,
      allocation.status || 'pending',
      JSON.stringify(allocation.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapAllocationRow(result.rows[0]);
  }

  /**
   * Find allocation by ID
   * @param {string} allocationId - Allocation ID
   * @returns {Promise<Object|null>} Allocation or null
   */
  async findAllocationById(allocationId) {
    const query = 'SELECT * FROM reward_allocations WHERE allocation_id = $1';
    const result = await this.db.query(query, [allocationId]);
    return result.rows[0] ? this.mapAllocationRow(result.rows[0]) : null;
  }

  /**
   * Find allocations by agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of allocations
   */
  async findAllocationsByAgent(agentId, options = {}) {
    let query = 'SELECT * FROM reward_allocations WHERE agent_id = $1';
    const params = [agentId];

    if (options.status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    if (options.rewardType) {
      query += ` AND reward_type = $${params.length + 1}`;
      params.push(options.rewardType);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapAllocationRow(row));
  }

  /**
   * Update allocation status
   * @param {string} allocationId - Allocation ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated allocation
   */
  async updateAllocationStatus(allocationId, status) {
    const fields = ['status = $1'];
    const values = [status];

    if (status === 'redeemed') {
      fields.push('redeemed_at = NOW()');
    }

    values.push(allocationId);

    const query = `
      UPDATE reward_allocations
      SET ${fields.join(', ')}
      WHERE allocation_id = $${values.length}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapAllocationRow(result.rows[0]) : null;
  }

  /**
   * Redeem reward
   * @param {string} allocationId - Allocation ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Redemption record
   */
  async redeemReward(allocationId, agentId) {
    return await this.db.transaction(async (client) => {
      // Check if allocation exists and is pending
      const allocationQuery = `
        SELECT * FROM reward_allocations
        WHERE allocation_id = $1 AND agent_id = $2 AND status = 'pending'
        FOR UPDATE
      `;

      const allocationResult = await client.query(allocationQuery, [allocationId, agentId]);

      if (allocationResult.rows.length === 0) {
        throw new Error('Allocation not found or already redeemed');
      }

      const allocation = this.mapAllocationRow(allocationResult.rows[0]);

      // Check expiration
      if (allocation.expiresAt && new Date(allocation.expiresAt) < new Date()) {
        throw new Error('Allocation has expired');
      }

      // Update allocation status
      await client.query(
        'UPDATE reward_allocations SET status = $1, redeemed_at = NOW() WHERE allocation_id = $2',
        ['redeemed', allocationId]
      );

      // Create redemption record
      const redemptionQuery = `
        INSERT INTO reward_redemptions (
          allocation_id, agent_id, reward_type, amount, redeemed_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;

      const redemptionResult = await client.query(redemptionQuery, [
        allocationId,
        agentId,
        allocation.rewardType,
        allocation.amount,
      ]);

      return this.mapRedemptionRow(redemptionResult.rows[0]);
    });
  }

  /**
   * Get redemption history for agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Redemption history
   */
  async getRedemptionHistory(agentId, options = {}) {
    let query = 'SELECT * FROM reward_redemptions WHERE agent_id = $1';
    const params = [agentId];

    if (options.rewardType) {
      query += ` AND reward_type = $${params.length + 1}`;
      params.push(options.rewardType);
    }

    query += ' ORDER BY redeemed_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRedemptionRow(row));
  }

  /**
   * Grant permission to agent
   * @param {Object} permission - Permission data
   * @returns {Promise<Object>} Created permission
   */
  async grantPermission(permission) {
    const query = `
      INSERT INTO reward_permissions (
        agent_id, permission_type, granted_by, expires_at,
        metadata, granted_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const values = [
      permission.agentId,
      permission.permissionType,
      permission.grantedBy,
      permission.expiresAt || null,
      JSON.stringify(permission.metadata || {}),
    ];

    const result = await this.db.query(query, values);
    return this.mapPermissionRow(result.rows[0]);
  }

  /**
   * Check if agent has permission
   * @param {string} agentId - Agent ID
   * @param {string} permissionType - Permission type
   * @returns {Promise<boolean>} Has permission
   */
  async hasPermission(agentId, permissionType) {
    const query = `
      SELECT COUNT(*) as count
      FROM reward_permissions
      WHERE agent_id = $1
      AND permission_type = $2
      AND (expires_at IS NULL OR expires_at > NOW())
      AND revoked_at IS NULL
    `;

    const result = await this.db.query(query, [agentId, permissionType]);
    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Get permissions for agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of permissions
   */
  async getPermissionsByAgent(agentId, options = {}) {
    let query = `
      SELECT * FROM reward_permissions
      WHERE agent_id = $1
      AND revoked_at IS NULL
    `;

    const params = [agentId];

    if (options.permissionType) {
      query += ` AND permission_type = $${params.length + 1}`;
      params.push(options.permissionType);
    }

    if (!options.includeExpired) {
      query += ' AND (expires_at IS NULL OR expires_at > NOW())';
    }

    query += ' ORDER BY granted_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapPermissionRow(row));
  }

  /**
   * Revoke permission
   * @param {number} permissionId - Permission ID
   * @param {string} revokedBy - Who revoked it
   * @returns {Promise<Object>} Updated permission
   */
  async revokePermission(permissionId, revokedBy) {
    const query = `
      UPDATE reward_permissions
      SET revoked_at = NOW(), revoked_by = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.db.query(query, [revokedBy, permissionId]);
    return result.rows[0] ? this.mapPermissionRow(result.rows[0]) : null;
  }

  /**
   * Find expired allocations
   * @returns {Promise<Array>} List of expired allocations
   */
  async findExpiredAllocations() {
    const query = `
      SELECT * FROM reward_allocations
      WHERE status = 'pending'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
      ORDER BY expires_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapAllocationRow(row));
  }

  /**
   * Get reward statistics
   * @returns {Promise<Object>} Reward statistics
   */
  async getStats() {
    const allocationQuery = `
      SELECT
        COUNT(*) as total_allocations,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_allocations,
        COUNT(*) FILTER (WHERE status = 'redeemed') as redeemed_allocations,
        SUM(amount) FILTER (WHERE status = 'redeemed') as total_redeemed_amount
      FROM reward_allocations
    `;

    const permissionQuery = `
      SELECT
        COUNT(*) as total_permissions,
        COUNT(*) FILTER (WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) as active_permissions
      FROM reward_permissions
    `;

    const allocationResult = await this.db.query(allocationQuery);
    const permissionResult = await this.db.query(permissionQuery);

    const allocRow = allocationResult.rows[0];
    const permRow = permissionResult.rows[0];

    return {
      totalAllocations: parseInt(allocRow.total_allocations) || 0,
      pendingAllocations: parseInt(allocRow.pending_allocations) || 0,
      redeemedAllocations: parseInt(allocRow.redeemed_allocations) || 0,
      totalRedeemedAmount: parseFloat(allocRow.total_redeemed_amount) || 0,
      totalPermissions: parseInt(permRow.total_permissions) || 0,
      activePermissions: parseInt(permRow.active_permissions) || 0,
    };
  }

  /**
   * Map database row to allocation object
   * @private
   */
  mapAllocationRow(row) {
    if (!row) return null;

    return {
      allocationId: row.allocation_id,
      agentId: row.agent_id,
      rewardType: row.reward_type,
      amount: parseFloat(row.amount) || 0,
      reason: row.reason,
      expiresAt: row.expires_at,
      status: row.status,
      metadata: row.metadata,
      redeemedAt: row.redeemed_at,
      createdAt: row.created_at,
    };
  }

  /**
   * Map database row to redemption object
   * @private
   */
  mapRedemptionRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      allocationId: row.allocation_id,
      agentId: row.agent_id,
      rewardType: row.reward_type,
      amount: parseFloat(row.amount) || 0,
      redeemedAt: row.redeemed_at,
    };
  }

  /**
   * Map database row to permission object
   * @private
   */
  mapPermissionRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      agentId: row.agent_id,
      permissionType: row.permission_type,
      grantedBy: row.granted_by,
      expiresAt: row.expires_at,
      metadata: row.metadata,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
      revokedBy: row.revoked_by,
    };
  }
}

export default new RewardsRepository();
