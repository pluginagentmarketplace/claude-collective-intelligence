/**
 * PostgreSQL Connection Manager
 * Production-grade database connection with pooling and monitoring
 */

import pg from 'pg';
import { EventEmitter } from 'events';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Configure Winston logger for database operations
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'postgres-connection' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * PostgreSQL Connection Pool Manager
 */
class PostgresConnectionManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      host: config.host || process.env.POSTGRES_HOST || 'localhost',
      port: config.port || process.env.POSTGRES_PORT || 5432,
      database: config.database || process.env.POSTGRES_DB || 'agent_orchestrator',
      user: config.user || process.env.POSTGRES_USER || 'admin',
      password: config.password || process.env.POSTGRES_PASSWORD,

      // Pool configuration
      max: config.max || parseInt(process.env.POSTGRES_POOL_MAX || '20'),
      min: config.min || parseInt(process.env.POSTGRES_POOL_MIN || '5'),
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,

      // Statement timeout to prevent long-running queries
      statement_timeout: config.statement_timeout || 30000,

      // SSL configuration for production
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: config.sslRejectUnauthorized !== false,
        ca: config.sslCa || process.env.POSTGRES_CA_CERT
      } : false
    };

    this.pool = null;
    this.connected = false;
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingConnections: 0,
      totalQueries: 0,
      errorCount: 0
    };

    this.healthCheckInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }

  /**
   * Initialize connection pool
   */
  async connect() {
    try {
      if (this.pool) {
        logger.warn('Connection pool already exists');
        return this.pool;
      }

      logger.info('Creating PostgreSQL connection pool', {
        host: this.config.host,
        database: this.config.database,
        poolSize: `${this.config.min}-${this.config.max}`
      });

      this.pool = new Pool(this.config);

      // Set up event handlers
      this.setupPoolEvents();

      // Test connection
      await this.testConnection();

      // Start health monitoring
      this.startHealthCheck();

      this.connected = true;
      this.reconnectAttempts = 0;

      logger.info('PostgreSQL connection pool established successfully');
      this.emit('connected');

      return this.pool;

    } catch (error) {
      logger.error('Failed to create connection pool', error);
      this.emit('error', error);

      // Attempt reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.handleReconnect();
      } else {
        throw error;
      }
    }
  }

  /**
   * Setup pool event handlers
   */
  setupPoolEvents() {
    if (!this.pool) return;

    this.pool.on('connect', (client) => {
      this.metrics.totalConnections++;
      logger.debug('New client connected to pool');
    });

    this.pool.on('acquire', (client) => {
      this.metrics.activeConnections++;
      logger.debug('Client acquired from pool');
    });

    this.pool.on('release', (client) => {
      this.metrics.activeConnections--;
      logger.debug('Client released back to pool');
    });

    this.pool.on('remove', (client) => {
      this.metrics.totalConnections--;
      logger.debug('Client removed from pool');
    });

    this.pool.on('error', (error, client) => {
      this.metrics.errorCount++;
      logger.error('PostgreSQL pool error', error);
      this.emit('poolError', error);
    });
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const result = await this.pool.query('SELECT NOW() as now, version() as version');
      logger.info('Database connection test successful', {
        serverTime: result.rows[0].now,
        version: result.rows[0].version
      });
      return true;
    } catch (error) {
      logger.error('Database connection test failed', error);
      throw error;
    }
  }

  /**
   * Execute a query with automatic retry logic
   */
  async query(text, params = [], options = {}) {
    if (!this.pool || !this.connected) {
      throw new Error('Database connection not established');
    }

    const startTime = Date.now();
    const maxRetries = options.maxRetries || 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.metrics.totalQueries++;

        const result = await this.pool.query(text, params);

        const duration = Date.now() - startTime;
        logger.debug('Query executed successfully', {
          duration,
          rows: result.rowCount,
          attempt
        });

        this.emit('queryExecuted', { text, duration, rows: result.rowCount });

        return result;

      } catch (error) {
        lastError = error;
        this.metrics.errorCount++;

        logger.error(`Query failed (attempt ${attempt}/${maxRetries})`, {
          error: error.message,
          query: text.substring(0, 100)
        });

        // Don't retry for certain errors
        if (!this.shouldRetryError(error) || attempt === maxRetries) {
          throw error;
        }

        // Wait before retrying
        await this.delay(Math.min(1000 * attempt, 5000));
      }
    }

    throw lastError;
  }

  /**
   * Execute a transaction
   */
  async transaction(callback, options = {}) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      if (options.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }

      const result = await callback(client);

      await client.query('COMMIT');
      return result;

    } catch (error) {
      await client.query('ROLLBACK');

      if (options.retryOnConflict && this.isSerializationError(error)) {
        logger.info('Retrying transaction due to serialization error');
        return this.transaction(callback, {
          ...options,
          retryCount: (options.retryCount || 0) + 1
        });
      }

      throw error;

    } finally {
      client.release();
    }
  }

  /**
   * Check if error should trigger retry
   */
  shouldRetryError(error) {
    const retryableCodes = [
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
      '40001', // serialization_failure
      '40P01', // deadlock_detected
    ];

    return retryableCodes.includes(error.code);
  }

  /**
   * Check if error is serialization error
   */
  isSerializationError(error) {
    return error.code === '40001' || error.code === '40P01';
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealth();

        if (health.status !== 'healthy') {
          logger.warn('Database health check warning', health);
          this.emit('unhealthy', health);
        }

      } catch (error) {
        logger.error('Health check failed', error);
        this.emit('healthCheckFailed', error);

        if (!this.connected) {
          await this.handleReconnect();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get connection health status
   */
  async getHealth() {
    try {
      const startTime = Date.now();
      const result = await this.pool.query('SELECT 1');
      const latency = Date.now() - startTime;

      const poolStats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      };

      const status = latency > 1000 ? 'degraded' : 'healthy';

      return {
        status,
        latency,
        connections: poolStats,
        metrics: this.metrics,
        uptime: process.uptime()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        metrics: this.metrics
      };
    }
  }

  /**
   * Handle reconnection attempts
   */
  async handleReconnect() {
    this.reconnectAttempts++;

    logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    await this.delay(this.reconnectDelay * this.reconnectAttempts);

    try {
      await this.disconnect();
      await this.connect();
      logger.info('Reconnection successful');
    } catch (error) {
      logger.error('Reconnection failed', error);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('maxReconnectAttemptsReached');
        throw new Error('Maximum reconnection attempts reached');
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
      metrics: this.metrics
    };
  }

  /**
   * Gracefully disconnect from database
   */
  async disconnect() {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      if (this.pool) {
        await this.pool.end();
        this.pool = null;
        this.connected = false;
        logger.info('PostgreSQL connection pool closed');
        this.emit('disconnected');
      }

    } catch (error) {
      logger.error('Error disconnecting from database', error);
      throw error;
    }
  }

  /**
   * Utility function for delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
const postgresConnection = new PostgresConnectionManager();

export default postgresConnection;
export { PostgresConnectionManager };