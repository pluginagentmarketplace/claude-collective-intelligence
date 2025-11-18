/**
 * Task Repository
 * Manages task data persistence and retrieval
 */

import BaseRepository from './base-repository.js';
import { REDIS_KEYS, TTL_CONFIG } from '../db/redis-connection.js';
import winston from 'winston';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'task-repository' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Task Repository Class
 */
class TaskRepository extends BaseRepository {
  constructor() {
    super('tasks', 'task');
  }

  /**
   * Find tasks by agent
   */
  async findByAgent(agentId, options = {}) {
    try {
      return await this.findAll({ agent_id: agentId }, {
        orderBy: 'priority DESC, created_at ASC',
        ...options
      });

    } catch (error) {
      logger.error('Error finding tasks by agent', { agentId, error });
      throw error;
    }
  }

  /**
   * Find tasks by status
   */
  async findByStatus(status, options = {}) {
    try {
      return await this.findAll({ status }, {
        orderBy: 'priority DESC, created_at ASC',
        ...options
      });

    } catch (error) {
      logger.error('Error finding tasks by status', { status, error });
      throw error;
    }
  }

  /**
   * Find pending tasks for assignment
   */
  async findPendingTasks(limit = 10) {
    try {
      const query = `
        SELECT t.*,
               td.depends_on_task_id,
               dt.status as dependency_status
        FROM tasks t
        LEFT JOIN task_dependencies td ON t.id = td.task_id
        LEFT JOIN tasks dt ON td.depends_on_task_id = dt.id
        WHERE t.status = 'pending'
          AND t.agent_id IS NULL
          AND (td.depends_on_task_id IS NULL OR dt.status = 'completed')
        ORDER BY t.priority DESC, t.created_at ASC
        LIMIT $1
      `;

      const result = await this.db.query(query, [limit]);

      return result.rows;

    } catch (error) {
      logger.error('Error finding pending tasks', { error });
      throw error;
    }
  }

  /**
   * Assign task to agent
   */
  async assignToAgent(taskId, agentId) {
    try {
      const task = await this.update(taskId, {
        agent_id: agentId,
        status: 'assigned',
        started_at: new Date()
      });

      // Add to processing queue in Redis
      const processingKey = REDIS_KEYS.TASK_PROCESSING
        .replace('{agentId}', agentId);

      await this.redis.zadd(
        processingKey,
        Date.now(),
        taskId
      );

      // Publish task assignment event
      await this.redis.publish(
        REDIS_KEYS.CHANNEL_TASK_EVENTS,
        {
          event: 'task_assigned',
          taskId,
          agentId,
          timestamp: new Date()
        }
      );

      logger.info('Task assigned to agent', { taskId, agentId });

      return task;

    } catch (error) {
      logger.error('Error assigning task to agent', { taskId, agentId, error });
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateStatus(taskId, status, result = null, error = null) {
    try {
      const updateData = { status };

      if (status === 'in_progress' && !updateData.started_at) {
        updateData.started_at = new Date();
      }

      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date();
      }

      if (result !== null) {
        updateData.result = result;
      }

      if (error !== null) {
        updateData.error_message = error;
      }

      const task = await this.update(taskId, updateData);

      // Store result in Redis with TTL
      if (status === 'completed' || status === 'failed') {
        const resultKey = REDIS_KEYS.TASK_RESULT
          .replace('{taskId}', taskId);

        await this.redis.set(
          resultKey,
          { status, result, error, completedAt: updateData.completed_at },
          TTL_CONFIG.TASK_RESULT
        );

        // Remove from processing queue
        if (task.agent_id) {
          const processingKey = REDIS_KEYS.TASK_PROCESSING
            .replace('{agentId}', task.agent_id);

          await this.redis.zrem(processingKey, taskId);
        }
      }

      // Publish status change event
      await this.redis.publish(
        REDIS_KEYS.CHANNEL_TASK_EVENTS,
        {
          event: 'task_status_changed',
          taskId,
          status,
          agentId: task.agent_id,
          timestamp: new Date()
        }
      );

      logger.info('Task status updated', { taskId, status });

      return task;

    } catch (error) {
      logger.error('Error updating task status', { taskId, status, error });
      throw error;
    }
  }

  /**
   * Retry failed task
   */
  async retryTask(taskId) {
    try {
      const task = await this.findById(taskId);

      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.retry_count >= task.max_retries) {
        throw new Error(`Task ${taskId} has exceeded maximum retry limit`);
      }

      const updatedTask = await this.update(taskId, {
        status: 'pending',
        retry_count: task.retry_count + 1,
        error_message: null,
        agent_id: null,
        started_at: null,
        completed_at: null
      });

      logger.info('Task scheduled for retry', {
        taskId,
        retryCount: updatedTask.retry_count
      });

      return updatedTask;

    } catch (error) {
      logger.error('Error retrying task', { taskId, error });
      throw error;
    }
  }

  /**
   * Get task dependencies
   */
  async getDependencies(taskId) {
    try {
      const query = `
        SELECT t.*, td.dependency_type
        FROM task_dependencies td
        JOIN tasks t ON td.depends_on_task_id = t.id
        WHERE td.task_id = $1
        ORDER BY t.created_at
      `;

      const result = await this.db.query(query, [taskId]);

      return result.rows;

    } catch (error) {
      logger.error('Error getting task dependencies', { taskId, error });
      throw error;
    }
  }

  /**
   * Get dependent tasks
   */
  async getDependentTasks(taskId) {
    try {
      const query = `
        SELECT t.*, td.dependency_type
        FROM task_dependencies td
        JOIN tasks t ON td.task_id = t.id
        WHERE td.depends_on_task_id = $1
        ORDER BY t.priority DESC, t.created_at
      `;

      const result = await this.db.query(query, [taskId]);

      return result.rows;

    } catch (error) {
      logger.error('Error getting dependent tasks', { taskId, error });
      throw error;
    }
  }

  /**
   * Add task dependency
   */
  async addDependency(taskId, dependsOnTaskId, dependencyType = 'blocking') {
    try {
      const query = `
        INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (task_id, depends_on_task_id) DO UPDATE
        SET dependency_type = $3
        RETURNING *
      `;

      const result = await this.db.query(query, [taskId, dependsOnTaskId, dependencyType]);

      logger.info('Task dependency added', { taskId, dependsOnTaskId, dependencyType });

      return result.rows[0];

    } catch (error) {
      logger.error('Error adding task dependency', { taskId, dependsOnTaskId, error });
      throw error;
    }
  }

  /**
   * Remove task dependency
   */
  async removeDependency(taskId, dependsOnTaskId) {
    try {
      const query = `
        DELETE FROM task_dependencies
        WHERE task_id = $1 AND depends_on_task_id = $2
        RETURNING *
      `;

      const result = await this.db.query(query, [taskId, dependsOnTaskId]);

      if (result.rows.length > 0) {
        logger.info('Task dependency removed', { taskId, dependsOnTaskId });
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error removing task dependency', { taskId, dependsOnTaskId, error });
      throw error;
    }
  }

  /**
   * Get task statistics by type
   */
  async getStatisticsByType(dateRange = '7 days') {
    try {
      const query = `
        SELECT
          type,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          AVG(CASE
            WHEN status = 'completed' AND completed_at IS NOT NULL AND started_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - started_at))
            ELSE NULL
          END) as avg_completion_time,
          AVG(retry_count) as avg_retries
        FROM tasks
        WHERE created_at > NOW() - INTERVAL '${dateRange}'
        GROUP BY type
        ORDER BY total DESC
      `;

      const result = await this.db.query(query);

      return result.rows.map(row => ({
        ...row,
        success_rate: row.total > 0
          ? (row.completed / row.total * 100).toFixed(2)
          : 0
      }));

    } catch (error) {
      logger.error('Error getting task statistics by type', { error });
      throw error;
    }
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(hoursOverdue = 24) {
    try {
      const query = `
        SELECT t.*, a.name as agent_name
        FROM tasks t
        LEFT JOIN agents a ON t.agent_id = a.id
        WHERE t.status IN ('pending', 'in_progress')
          AND t.created_at < NOW() - INTERVAL '${hoursOverdue} hours'
        ORDER BY t.created_at ASC
      `;

      const result = await this.db.query(query);

      return result.rows;

    } catch (error) {
      logger.error('Error getting overdue tasks', { hoursOverdue, error });
      throw error;
    }
  }

  /**
   * Get task execution timeline
   */
  async getExecutionTimeline(taskId) {
    try {
      const query = `
        SELECT
          al.action,
          al.timestamp,
          al.metadata,
          a.name as actor_name
        FROM audit_logs al
        LEFT JOIN agents a ON al.actor_id = a.id::text
        WHERE al.resource_type = 'task'
          AND al.resource_id = $1
        ORDER BY al.timestamp ASC
      `;

      const result = await this.db.query(query, [taskId]);

      return result.rows;

    } catch (error) {
      logger.error('Error getting task execution timeline', { taskId, error });
      throw error;
    }
  }

  /**
   * Create task with dependencies
   */
  async createWithDependencies(taskData, dependencies = []) {
    try {
      return await this.db.transaction(async (client) => {
        // Create the task
        const task = await this.create(taskData, { transaction: client });

        // Add dependencies
        for (const dep of dependencies) {
          const query = `
            INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
            VALUES ($1, $2, $3)
          `;

          await client.query(query, [
            task.id,
            dep.taskId,
            dep.type || 'blocking'
          ]);
        }

        // Return task with dependencies
        task.dependencies = dependencies;

        return task;
      });

    } catch (error) {
      logger.error('Error creating task with dependencies', { taskData, error });
      throw error;
    }
  }

  /**
   * Get task queue status
   */
  async getQueueStatus() {
    try {
      const query = `
        WITH priority_groups AS (
          SELECT
            CASE
              WHEN priority >= 8 THEN 'high'
              WHEN priority >= 5 THEN 'medium'
              ELSE 'low'
            END as priority_group,
            COUNT(*) as count,
            AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) as avg_age_hours
          FROM tasks
          WHERE status = 'pending'
          GROUP BY priority_group
        )
        SELECT
          priority_group,
          count,
          ROUND(avg_age_hours::numeric, 2) as avg_age_hours
        FROM priority_groups

        UNION ALL

        SELECT
          'total' as priority_group,
          COUNT(*) as count,
          ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600)::numeric, 2) as avg_age_hours
        FROM tasks
        WHERE status = 'pending'
      `;

      const result = await this.db.query(query);

      const status = {
        high: { count: 0, avgAgeHours: 0 },
        medium: { count: 0, avgAgeHours: 0 },
        low: { count: 0, avgAgeHours: 0 },
        total: { count: 0, avgAgeHours: 0 }
      };

      for (const row of result.rows) {
        status[row.priority_group] = {
          count: parseInt(row.count),
          avgAgeHours: parseFloat(row.avg_age_hours) || 0
        };
      }

      return status;

    } catch (error) {
      logger.error('Error getting queue status', { error });
      throw error;
    }
  }

  /**
   * Clean up old completed tasks
   */
  async cleanupOldTasks(daysToKeep = 30) {
    try {
      const query = `
        DELETE FROM tasks
        WHERE status IN ('completed', 'failed')
          AND completed_at < NOW() - INTERVAL '${daysToKeep} days'
        RETURNING id
      `;

      const result = await this.db.query(query);

      if (result.rows.length > 0) {
        logger.info(`Cleaned up ${result.rows.length} old tasks`);

        // Clear related Redis data
        for (const row of result.rows) {
          const resultKey = REDIS_KEYS.TASK_RESULT
            .replace('{taskId}', row.id);
          await this.redis.delete(resultKey);
        }
      }

      return result.rows.length;

    } catch (error) {
      logger.error('Error cleaning up old tasks', { daysToKeep, error });
      throw error;
    }
  }
}

// Export singleton instance
const taskRepository = new TaskRepository();

export default taskRepository;
export { TaskRepository };