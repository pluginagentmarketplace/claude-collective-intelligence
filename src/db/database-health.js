/**
 * Database Health Check Utility
 * Provides detailed health status for PostgreSQL and Redis
 */

import connectionPool from './connection-pool.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'database-health' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class DatabaseHealthChecker {
  constructor(pool = connectionPool) {
    this.pool = pool;
  }

  /**
   * Get comprehensive health status
   */
  async getFullHealth() {
    try {
      const health = await this.pool.getHealthStatus();

      return {
        timestamp: new Date().toISOString(),
        overall: this.getOverallStatus(health),
        postgres: await this.getPostgresHealth(health),
        redis: await this.getRedisHealth(health),
        connections: this.getConnectionStats(),
        metrics: this.getMetrics()
      };

    } catch (error) {
      logger.error('Health check failed', error);
      return {
        timestamp: new Date().toISOString(),
        overall: 'critical',
        error: error.message
      };
    }
  }

  /**
   * Get overall system status
   */
  getOverallStatus(health) {
    const pgStatus = health.databases?.postgres?.status;
    const redisStatus = health.databases?.redis?.status;

    if (pgStatus === 'healthy' && redisStatus === 'healthy') {
      return 'healthy';
    }
    if (pgStatus === 'unhealthy' || redisStatus === 'unhealthy') {
      return 'critical';
    }
    return 'degraded';
  }

  /**
   * Get PostgreSQL specific health info
   */
  async getPostgresHealth(health) {
    const pgHealth = health.databases?.postgres || {};

    return {
      status: pgHealth.status || 'unknown',
      latency: pgHealth.latency || null,
      connections: pgHealth.connections || {},
      uptime: pgHealth.uptime || null,
      version: await this.getPostgresVersion(),
      error: pgHealth.error || null
    };
  }

  /**
   * Get PostgreSQL version
   */
  async getPostgresVersion() {
    try {
      if (!this.pool.postgres || !this.pool.postgres.connected) {
        return null;
      }

      const result = await this.pool.postgres.query(
        'SELECT version() as version'
      );

      return result.rows[0]?.version || null;

    } catch (error) {
      logger.debug('Could not retrieve PostgreSQL version', error.message);
      return null;
    }
  }

  /**
   * Get Redis specific health info
   */
  async getRedisHealth(health) {
    const redisHealth = health.databases?.redis || {};

    return {
      status: redisHealth.status || 'unknown',
      latency: redisHealth.latency || null,
      memory: redisHealth.memory || null,
      uptime: redisHealth.uptime || null,
      metrics: redisHealth.metrics || {},
      error: redisHealth.error || null
    };
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const stats = this.pool.getStats() || {};

    return {
      postgres: stats.postgres || {},
      redis: stats.redis || {},
      initialized: stats.initialized || false,
      uptime: stats.uptime || 0
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const pgMetrics = this.pool.postgres?.metrics || {};
    const redisMetrics = this.pool.redis?.getMetrics() || {};

    return {
      postgres: {
        totalQueries: pgMetrics.totalQueries || 0,
        errorCount: pgMetrics.errorCount || 0,
        totalConnections: pgMetrics.totalConnections || 0
      },
      redis: {
        hits: redisMetrics.hits || 0,
        misses: redisMetrics.misses || 0,
        hitRate: redisMetrics.hitRate || '0%',
        commandCount: redisMetrics.commandCount || 0,
        errors: redisMetrics.errors || 0
      }
    };
  }

  /**
   * Validate database connectivity
   */
  async validateConnectivity() {
    const results = {
      postgres: false,
      redis: false,
      timestamp: new Date().toISOString()
    };

    try {
      // Test PostgreSQL
      const pgResult = await this.pool.postgres.query('SELECT 1');
      results.postgres = pgResult.rowCount === 1;
      logger.info('PostgreSQL connectivity test passed');

    } catch (error) {
      logger.error('PostgreSQL connectivity test failed', error.message);
    }

    try {
      // Test Redis
      await this.pool.redis.client.ping();
      results.redis = true;
      logger.info('Redis connectivity test passed');

    } catch (error) {
      logger.error('Redis connectivity test failed', error.message);
    }

    return results;
  }

  /**
   * Check cache hit rates
   */
  getCacheHitRates() {
    const redisMetrics = this.pool.redis?.getMetrics() || {};

    return {
      redisHitRate: redisMetrics.hitRate || '0%',
      totalHits: redisMetrics.hits || 0,
      totalMisses: redisMetrics.misses || 0,
      l1CacheSize: redisMetrics.l1CacheSize || 0
    };
  }

  /**
   * Check database size and stats
   */
  async getDatabaseStats() {
    try {
      const result = await this.pool.postgres.query(`
        SELECT
          datname,
          pg_size_pretty(pg_database_size(datname)) as size,
          (SELECT COUNT(*) FROM agents) as agents_count,
          (SELECT COUNT(*) FROM tasks) as tasks_count,
          (SELECT COUNT(*) FROM sessions) as sessions_count
        FROM pg_database
        WHERE datname = current_database()
      `);

      return result.rows[0] || {};

    } catch (error) {
      logger.error('Could not retrieve database stats', error.message);
      return {};
    }
  }

  /**
   * Generate health report
   */
  async generateReport() {
    const health = await this.getFullHealth();
    const stats = await this.getDatabaseStats();

    return {
      report: 'Database Health Report',
      timestamp: new Date().toISOString(),
      health,
      statistics: {
        database: stats,
        cache: this.getCacheHitRates(),
        connections: this.getConnectionStats()
      }
    };
  }
}

export default DatabaseHealthChecker;
