import dbClient from '../client.js';

/**
 * Repository for Agent data access
 * Handles CRUD operations and statistics updates for agents
 */
export class AgentRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create a new agent
   * @param {Object} agent - Agent data
   * @returns {Promise<Object>} Created agent
   */
  async create(agent) {
    const query = `
      INSERT INTO agents (
        agent_id, agent_name, agent_type, status, capabilities,
        current_task_id, heartbeat_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      agent.agentId,
      agent.agentName,
      agent.agentType || 'worker',
      agent.status || 'idle',
      JSON.stringify(agent.capabilities || []),
      agent.currentTaskId || null,
      agent.heartbeatAt || new Date(),
    ];

    const result = await this.db.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find agent by ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object|null>} Agent or null
   */
  async findById(agentId) {
    const query = 'SELECT * FROM agents WHERE agent_id = $1';
    const result = await this.db.query(query, [agentId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find all agents
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of agents
   */
  async findAll(options = {}) {
    let query = 'SELECT * FROM agents';
    const params = [];

    if (options.status) {
      query += ' WHERE status = $1';
      params.push(options.status);
    }

    if (options.agentType) {
      query += params.length > 0 ? ' AND' : ' WHERE';
      query += ` agent_type = $${params.length + 1}`;
      params.push(options.agentType);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Update agent
   * @param {string} agentId - Agent ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated agent
   */
  async update(agentId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      const dbKey = this.camelToSnake(key);
      if (key === 'capabilities') {
        fields.push(`${dbKey} = $${paramIndex}`);
        values.push(JSON.stringify(updates[key]));
      } else {
        fields.push(`${dbKey} = $${paramIndex}`);
        values.push(updates[key]);
      }
      paramIndex++;
    });

    fields.push('updated_at = NOW()');
    values.push(agentId);

    const query = `
      UPDATE agents
      SET ${fields.join(', ')}
      WHERE agent_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update agent status
   * @param {string} agentId - Agent ID
   * @param {string} status - New status
   * @returns {Promise<Object>} Updated agent
   */
  async updateStatus(agentId, status) {
    const query = `
      UPDATE agents
      SET status = $1, updated_at = NOW()
      WHERE agent_id = $2
      RETURNING *
    `;

    const result = await this.db.query(query, [status, agentId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update agent heartbeat
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Updated agent
   */
  async updateHeartbeat(agentId) {
    const query = `
      UPDATE agents
      SET heartbeat_at = NOW(), updated_at = NOW()
      WHERE agent_id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [agentId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Increment agent statistics
   * @param {string} agentId - Agent ID
   * @param {Object} stats - Statistics to increment
   * @returns {Promise<Object>} Updated agent
   */
  async incrementStats(agentId, stats) {
    const increments = [];
    const values = [];
    let paramIndex = 1;

    if (stats.tasksCompleted) {
      increments.push(`tasks_completed = COALESCE(tasks_completed, 0) + $${paramIndex}`);
      values.push(stats.tasksCompleted);
      paramIndex++;
    }

    if (stats.tasksFailed) {
      increments.push(`tasks_failed = COALESCE(tasks_failed, 0) + $${paramIndex}`);
      values.push(stats.tasksFailed);
      paramIndex++;
    }

    if (stats.messagesProcessed) {
      increments.push(`messages_processed = COALESCE(messages_processed, 0) + $${paramIndex}`);
      values.push(stats.messagesProcessed);
      paramIndex++;
    }

    values.push(agentId);

    const query = `
      UPDATE agents
      SET ${increments.join(', ')}, updated_at = NOW()
      WHERE agent_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Get agent statistics
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Agent statistics
   */
  async getStats(agentId) {
    const query = `
      SELECT
        tasks_completed,
        tasks_failed,
        messages_processed,
        uptime_seconds,
        created_at,
        heartbeat_at
      FROM agents
      WHERE agent_id = $1
    `;

    const result = await this.db.query(query, [agentId]);
    return result.rows[0] || null;
  }

  /**
   * Find inactive agents (no heartbeat for specified duration)
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Array>} List of inactive agents
   */
  async findInactive(timeoutMs = 60000) {
    const query = `
      SELECT * FROM agents
      WHERE heartbeat_at < NOW() - INTERVAL '${timeoutMs} milliseconds'
      AND status != 'offline'
      ORDER BY heartbeat_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Delete agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(agentId) {
    const query = 'DELETE FROM agents WHERE agent_id = $1 RETURNING agent_id';
    const result = await this.db.query(query, [agentId]);
    return result.rowCount > 0;
  }

  /**
   * Get agent count by status
   * @returns {Promise<Object>} Status counts
   */
  async getCountByStatus() {
    const query = `
      SELECT status, COUNT(*) as count
      FROM agents
      GROUP BY status
    `;

    const result = await this.db.query(query);
    return result.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});
  }

  /**
   * Map database row to agent object
   * @private
   */
  mapRow(row) {
    if (!row) return null;

    return {
      agentId: row.agent_id,
      agentName: row.agent_name,
      agentType: row.agent_type,
      status: row.status,
      capabilities: row.capabilities,
      currentTaskId: row.current_task_id,
      tasksCompleted: row.tasks_completed,
      tasksFailed: row.tasks_failed,
      messagesProcessed: row.messages_processed,
      uptimeSeconds: row.uptime_seconds,
      heartbeatAt: row.heartbeat_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert camelCase to snake_case
   * @private
   */
  camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default new AgentRepository();
