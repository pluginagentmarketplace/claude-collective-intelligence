import dbClient from '../db-client.js';

/**
 * Repository for Task data access
 * Handles queue operations, task history, and task management
 */
export class TaskRepository {
  constructor(db = dbClient) {
    this.db = db;
  }

  /**
   * Create a new task
   * @param {Object} task - Task data
   * @returns {Promise<Object>} Created task
   */
  async create(task) {
    const query = `
      INSERT INTO tasks (
        task_id, task_type, priority, status, payload,
        assigned_agent_id, created_by, retry_count,
        max_retries, timeout_ms, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      task.taskId,
      task.taskType,
      task.priority || 'normal',
      task.status || 'pending',
      JSON.stringify(task.payload || {}),
      task.assignedAgentId || null,
      task.createdBy || null,
      task.retryCount || 0,
      task.maxRetries || 3,
      task.timeoutMs || 300000,
    ];

    const result = await this.db.query(query, values);
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find task by ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Object|null>} Task or null
   */
  async findById(taskId) {
    const query = 'SELECT * FROM tasks WHERE task_id = $1';
    const result = await this.db.query(query, [taskId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find all tasks
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of tasks
   */
  async findAll(options = {}) {
    let query = 'SELECT * FROM tasks';
    const params = [];
    const conditions = [];

    if (options.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(options.status);
    }

    if (options.taskType) {
      conditions.push(`task_type = $${params.length + 1}`);
      params.push(options.taskType);
    }

    if (options.assignedAgentId) {
      conditions.push(`assigned_agent_id = $${params.length + 1}`);
      params.push(options.assignedAgentId);
    }

    if (options.priority) {
      conditions.push(`priority = $${params.length + 1}`);
      params.push(options.priority);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY priority DESC, created_at ASC';

    if (options.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Get next pending task from queue
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object|null>} Next task or null
   */
  async dequeue(agentId) {
    return await this.db.transaction(async (client) => {
      // Lock and get the next pending task with highest priority
      const query = `
        SELECT * FROM tasks
        WHERE status = 'pending'
        AND (assigned_agent_id IS NULL OR assigned_agent_id = $1)
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      const result = await client.query(query, [agentId]);

      if (result.rows.length === 0) {
        return null;
      }

      const task = result.rows[0];

      // Update task status and assign to agent
      const updateQuery = `
        UPDATE tasks
        SET status = 'in_progress',
            assigned_agent_id = $1,
            started_at = NOW(),
            updated_at = NOW()
        WHERE task_id = $2
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [agentId, task.task_id]);
      return this.mapRow(updateResult.rows[0]);
    });
  }

  /**
   * Update task
   * @param {string} taskId - Task ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated task
   */
  async update(taskId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      const dbKey = this.camelToSnake(key);
      if (key === 'payload' || key === 'result') {
        fields.push(`${dbKey} = $${paramIndex}`);
        values.push(JSON.stringify(updates[key]));
      } else {
        fields.push(`${dbKey} = $${paramIndex}`);
        values.push(updates[key]);
      }
      paramIndex++;
    });

    fields.push('updated_at = NOW()');
    values.push(taskId);

    const query = `
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE task_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Update task status
   * @param {string} taskId - Task ID
   * @param {string} status - New status
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated task
   */
  async updateStatus(taskId, status, options = {}) {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let paramIndex = 2;

    if (status === 'completed') {
      fields.push('completed_at = NOW()');
    } else if (status === 'failed') {
      fields.push('failed_at = NOW()');
    }

    if (options.result) {
      fields.push(`result = $${paramIndex}`);
      values.push(JSON.stringify(options.result));
      paramIndex++;
    }

    if (options.error) {
      fields.push(`error = $${paramIndex}`);
      values.push(options.error);
      paramIndex++;
    }

    values.push(taskId);

    const query = `
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE task_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Increment task retry count
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Updated task
   */
  async incrementRetry(taskId) {
    const query = `
      UPDATE tasks
      SET retry_count = retry_count + 1,
          status = CASE
            WHEN retry_count + 1 >= max_retries THEN 'failed'
            ELSE 'pending'
          END,
          assigned_agent_id = NULL,
          updated_at = NOW()
      WHERE task_id = $1
      RETURNING *
    `;

    const result = await this.db.query(query, [taskId]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Get task history for an agent
   * @param {string} agentId - Agent ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Task history
   */
  async getHistoryByAgent(agentId, options = {}) {
    let query = `
      SELECT * FROM tasks
      WHERE assigned_agent_id = $1
      ORDER BY created_at DESC
    `;

    const params = [agentId];

    if (options.limit) {
      query += ` LIMIT $2`;
      params.push(options.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Get task statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Task statistics
   */
  async getStats(filters = {}) {
    let query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
      FROM tasks
    `;

    const params = [];
    const conditions = [];

    if (filters.taskType) {
      conditions.push(`task_type = $${params.length + 1}`);
      params.push(filters.taskType);
    }

    if (filters.agentId) {
      conditions.push(`assigned_agent_id = $${params.length + 1}`);
      params.push(filters.agentId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.db.query(query, params);
    const row = result.rows[0];

    return {
      total: parseInt(row.total) || 0,
      pending: parseInt(row.pending) || 0,
      inProgress: parseInt(row.in_progress) || 0,
      completed: parseInt(row.completed) || 0,
      failed: parseInt(row.failed) || 0,
      avgDurationSeconds: parseFloat(row.avg_duration_seconds) || 0,
    };
  }

  /**
   * Find stale tasks (in progress but no update for timeout)
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Array>} List of stale tasks
   */
  async findStale(timeoutMs = 300000) {
    const query = `
      SELECT * FROM tasks
      WHERE status = 'in_progress'
      AND updated_at < NOW() - INTERVAL '${timeoutMs} milliseconds'
      ORDER BY updated_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * Delete task
   * @param {string} taskId - Task ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(taskId) {
    const query = 'DELETE FROM tasks WHERE task_id = $1 RETURNING task_id';
    const result = await this.db.query(query, [taskId]);
    return result.rowCount > 0;
  }

  /**
   * Clean up old completed tasks
   * @param {number} daysOld - Days old to keep
   * @returns {Promise<number>} Number of deleted tasks
   */
  async cleanupOld(daysOld = 30) {
    const query = `
      DELETE FROM tasks
      WHERE status IN ('completed', 'failed')
      AND completed_at < NOW() - INTERVAL '${daysOld} days'
      RETURNING task_id
    `;

    const result = await this.db.query(query);
    return result.rowCount;
  }

  /**
   * Map database row to task object
   * @private
   */
  mapRow(row) {
    if (!row) return null;

    return {
      taskId: row.task_id,
      taskType: row.task_type,
      priority: row.priority,
      status: row.status,
      payload: row.payload,
      result: row.result,
      error: row.error,
      assignedAgentId: row.assigned_agent_id,
      createdBy: row.created_by,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      timeoutMs: row.timeout_ms,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
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

export default new TaskRepository();
