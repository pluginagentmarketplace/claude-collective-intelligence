/**
 * Agent Repository
 * Manages agent data persistence and retrieval
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
  defaultMeta: { service: 'agent-repository' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Agent Repository Class
 */
class AgentRepository extends BaseRepository {
  constructor() {
    super('agents', 'agent');
  }

  /**
   * Find agent by name
   */
  async findByName(name) {
    try {
      const cacheKey = `cache:agent:name:${name}`;

      // Check cache
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for agent name: ${name}`);
        return cached;
      }

      // Query database
      const result = await this.findOne({ name });

      // Cache result
      if (result) {
        await this.redis.set(cacheKey, result, TTL_CONFIG.CACHE_QUERY);
      }

      return result;

    } catch (error) {
      logger.error('Error finding agent by name', { name, error });
      throw error;
    }
  }

  /**
   * Find agents by role
   */
  async findByRole(role, options = {}) {
    try {
      return await this.findAll({ role }, options);

    } catch (error) {
      logger.error('Error finding agents by role', { role, error });
      throw error;
    }
  }

  /**
   * Find agents by status
   */
  async findByStatus(status, options = {}) {
    try {
      return await this.findAll({ status }, options);

    } catch (error) {
      logger.error('Error finding agents by status', { status, error });
      throw error;
    }
  }

  /**
   * Find available agents for a specific capability
   */
  async findAvailableAgents(capability = null, limit = 5) {
    try {
      let query = `
        SELECT a.*,
               COUNT(t.id) as active_tasks,
               AVG(pm.value) as avg_performance
        FROM agents a
        LEFT JOIN tasks t ON a.id = t.agent_id AND t.status IN ('pending', 'in_progress')
        LEFT JOIN performance_metrics pm ON a.id = pm.agent_id
          AND pm.metric_type = 'task_completion_rate'
          AND pm.measured_at > NOW() - INTERVAL '7 days'
        WHERE a.status = 'active'
      `;

      const params = [];

      if (capability) {
        query += ` AND a.capabilities @> $1::jsonb`;
        params.push(JSON.stringify([capability]));
      }

      query += `
        GROUP BY a.id
        HAVING COUNT(t.id) < 5
        ORDER BY COUNT(t.id) ASC, AVG(pm.value) DESC NULLS LAST
        LIMIT $${params.length + 1}
      `;

      params.push(limit);

      const result = await this.db.query(query, params);

      return result.rows;

    } catch (error) {
      logger.error('Error finding available agents', { capability, error });
      throw error;
    }
  }

  /**
   * Update agent status
   */
  async updateStatus(agentId, status, metadata = {}) {
    try {
      const agent = await this.update(agentId, { status, metadata });

      // Update Redis state
      const stateKey = REDIS_KEYS.AGENT_STATE.replace('{agentId}', agentId);
      await this.redis.set(
        stateKey,
        { status, metadata, timestamp: new Date() },
        TTL_CONFIG.AGENT_STATE
      );

      // Publish status change event
      await this.redis.publish(
        REDIS_KEYS.CHANNEL_AGENT_STATUS,
        {
          agentId,
          status,
          metadata,
          timestamp: new Date()
        }
      );

      logger.info('Agent status updated', { agentId, status });

      return agent;

    } catch (error) {
      logger.error('Error updating agent status', { agentId, status, error });
      throw error;
    }
  }

  /**
   * Get agent with current state
   */
  async getWithState(agentId) {
    try {
      const [agent, state] = await Promise.all([
        this.findById(agentId),
        this.getAgentState(agentId)
      ]);

      if (!agent) return null;

      return {
        ...agent,
        currentState: state
      };

    } catch (error) {
      logger.error('Error getting agent with state', { agentId, error });
      throw error;
    }
  }

  /**
   * Get agent state from Redis
   */
  async getAgentState(agentId) {
    try {
      const stateKey = REDIS_KEYS.AGENT_STATE.replace('{agentId}', agentId);
      return await this.redis.get(stateKey);

    } catch (error) {
      logger.error('Error getting agent state', { agentId, error });
      return null;
    }
  }

  /**
   * Update agent capabilities
   */
  async updateCapabilities(agentId, capabilities) {
    try {
      const agent = await this.findById(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Merge capabilities
      const updatedCapabilities = [...new Set([
        ...(agent.capabilities || []),
        ...capabilities
      ])];

      return await this.update(agentId, {
        capabilities: updatedCapabilities
      });

    } catch (error) {
      logger.error('Error updating agent capabilities', { agentId, capabilities, error });
      throw error;
    }
  }

  /**
   * Remove agent capabilities
   */
  async removeCapabilities(agentId, capabilities) {
    try {
      const agent = await this.findById(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Remove specified capabilities
      const updatedCapabilities = (agent.capabilities || [])
        .filter(cap => !capabilities.includes(cap));

      return await this.update(agentId, {
        capabilities: updatedCapabilities
      });

    } catch (error) {
      logger.error('Error removing agent capabilities', { agentId, capabilities, error });
      throw error;
    }
  }

  /**
   * Get agent statistics
   */
  async getStatistics(agentId, dateRange = '7 days') {
    try {
      const query = `
        SELECT
          a.id,
          a.name,
          a.status,
          COUNT(DISTINCT t.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'failed' THEN t.id END) as failed_tasks,
          AVG(CASE WHEN t.status = 'completed'
            THEN EXTRACT(EPOCH FROM (t.completed_at - t.started_at))
            ELSE NULL END) as avg_completion_time,
          COUNT(DISTINCT ach.id) as achievements,
          SUM(ach.points) as total_points,
          COUNT(DISTINCT ac.id) as collaborations
        FROM agents a
        LEFT JOIN tasks t ON a.id = t.agent_id
          AND t.created_at > NOW() - INTERVAL '${dateRange}'
        LEFT JOIN achievements ach ON a.id = ach.agent_id
          AND ach.awarded_at > NOW() - INTERVAL '${dateRange}'
        LEFT JOIN agent_collaborations ac ON (a.id = ac.leader_id OR a.id = ac.member_id)
          AND ac.status = 'active'
        WHERE a.id = $1
        GROUP BY a.id, a.name, a.status
      `;

      const result = await this.db.query(query, [agentId]);

      if (result.rows.length === 0) {
        return null;
      }

      const stats = result.rows[0];

      // Calculate success rate
      stats.success_rate = stats.total_tasks > 0
        ? (stats.completed_tasks / stats.total_tasks * 100).toFixed(2)
        : 0;

      // Get recent performance metrics
      const metricsQuery = `
        SELECT metric_type, AVG(value) as avg_value, COUNT(*) as count
        FROM performance_metrics
        WHERE agent_id = $1 AND measured_at > NOW() - INTERVAL '${dateRange}'
        GROUP BY metric_type
      `;

      const metricsResult = await this.db.query(metricsQuery, [agentId]);

      stats.performance_metrics = {};
      for (const metric of metricsResult.rows) {
        stats.performance_metrics[metric.metric_type] = {
          average: parseFloat(metric.avg_value),
          count: parseInt(metric.count)
        };
      }

      return stats;

    } catch (error) {
      logger.error('Error getting agent statistics', { agentId, error });
      throw error;
    }
  }

  /**
   * Find agents with specific capabilities
   */
  async findByCapabilities(capabilities, matchAll = false) {
    try {
      let query;
      const params = [JSON.stringify(capabilities)];

      if (matchAll) {
        // Must have all specified capabilities
        query = `
          SELECT * FROM agents
          WHERE capabilities @> $1::jsonb
          ORDER BY status = 'active' DESC, created_at DESC
        `;
      } else {
        // Must have at least one of the specified capabilities
        query = `
          SELECT * FROM agents
          WHERE capabilities ?| $1::text[]
          ORDER BY status = 'active' DESC, created_at DESC
        `;
        params[0] = capabilities;
      }

      const result = await this.db.query(query, params);

      return result.rows;

    } catch (error) {
      logger.error('Error finding agents by capabilities', { capabilities, error });
      throw error;
    }
  }

  /**
   * Get agent workload
   */
  async getWorkload(agentId) {
    try {
      const query = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
          COUNT(*) FILTER (WHERE status = 'in_progress') as active_tasks,
          COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour') as recent_completed,
          AVG(priority) FILTER (WHERE status IN ('pending', 'in_progress')) as avg_priority
        FROM tasks
        WHERE agent_id = $1
      `;

      const result = await this.db.query(query, [agentId]);

      return {
        pending: parseInt(result.rows[0].pending_tasks || 0),
        active: parseInt(result.rows[0].active_tasks || 0),
        recentCompleted: parseInt(result.rows[0].recent_completed || 0),
        averagePriority: parseFloat(result.rows[0].avg_priority || 5)
      };

    } catch (error) {
      logger.error('Error getting agent workload', { agentId, error });
      throw error;
    }
  }

  /**
   * Find idle agents
   */
  async findIdleAgents(idleMinutes = 30) {
    try {
      const query = `
        SELECT a.*
        FROM agents a
        LEFT JOIN tasks t ON a.id = t.agent_id
          AND t.status IN ('pending', 'in_progress')
        WHERE a.status = 'active'
          AND t.id IS NULL
          AND (a.updated_at < NOW() - INTERVAL '${idleMinutes} minutes'
               OR NOT EXISTS (
                 SELECT 1 FROM tasks t2
                 WHERE t2.agent_id = a.id
                   AND t2.completed_at > NOW() - INTERVAL '${idleMinutes} minutes'
               ))
        ORDER BY a.updated_at ASC
      `;

      const result = await this.db.query(query);

      return result.rows;

    } catch (error) {
      logger.error('Error finding idle agents', { idleMinutes, error });
      throw error;
    }
  }

  /**
   * Get agent collaboration network
   */
  async getCollaborationNetwork(agentId) {
    try {
      const query = `
        WITH RECURSIVE collaboration_tree AS (
          -- Direct collaborations
          SELECT
            CASE
              WHEN leader_id = $1 THEN member_id
              ELSE leader_id
            END as collaborator_id,
            collaboration_type,
            1 as depth
          FROM agent_collaborations
          WHERE (leader_id = $1 OR member_id = $1) AND status = 'active'

          UNION

          -- Indirect collaborations (2nd degree)
          SELECT
            CASE
              WHEN ac.leader_id = ct.collaborator_id THEN ac.member_id
              ELSE ac.leader_id
            END as collaborator_id,
            ac.collaboration_type,
            ct.depth + 1
          FROM agent_collaborations ac
          JOIN collaboration_tree ct ON
            (ac.leader_id = ct.collaborator_id OR ac.member_id = ct.collaborator_id)
            AND ac.status = 'active'
          WHERE ct.depth < 2
        )
        SELECT DISTINCT
          a.id, a.name, a.role, a.status,
          MIN(ct.depth) as connection_degree,
          ARRAY_AGG(DISTINCT ct.collaboration_type) as collaboration_types
        FROM collaboration_tree ct
        JOIN agents a ON a.id = ct.collaborator_id
        GROUP BY a.id, a.name, a.role, a.status
        ORDER BY MIN(ct.depth), a.name
      `;

      const result = await this.db.query(query, [agentId]);

      return {
        agentId,
        network: result.rows,
        totalConnections: result.rows.length,
        directConnections: result.rows.filter(r => r.connection_degree === 1).length,
        indirectConnections: result.rows.filter(r => r.connection_degree === 2).length
      };

    } catch (error) {
      logger.error('Error getting collaboration network', { agentId, error });
      throw error;
    }
  }

  /**
   * Create or update agent (upsert)
   */
  async upsert(data) {
    try {
      const existing = await this.findByName(data.name);

      if (existing) {
        return await this.update(existing.id, data);
      } else {
        return await this.create(data);
      }

    } catch (error) {
      logger.error('Error upserting agent', { name: data.name, error });
      throw error;
    }
  }
}

// Export singleton instance
const agentRepository = new AgentRepository();

export default agentRepository;
export { AgentRepository };