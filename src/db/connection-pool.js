/**
 * Connection Pool Manager
 * Centralized management for all database connections
 */

import postgresConnection from './postgres-connection.js';
import redisConnection from './redis-connection.js';
import { EventEmitter } from 'events';
import winston from 'winston';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'connection-pool' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Connection Pool Manager
 * Manages all database connections and provides health monitoring
 */
class ConnectionPoolManager extends EventEmitter {
  constructor() {
    super();

    this.postgres = postgresConnection;
    this.redis = redisConnection;
    this.initialized = false;
    this.healthCheckInterval = null;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
  }

  /**
   * Initialize all connections
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('Connection pool already initialized');
      return;
    }

    logger.info('Initializing connection pool manager');

    try {
      // Connect to databases in parallel
      const [pgPool, redisClient] = await Promise.all([
        this.connectPostgres(),
        this.connectRedis()
      ]);

      // Setup cross-database event handlers
      this.setupEventHandlers();

      // Start health monitoring
      this.startHealthMonitoring();

      this.initialized = true;
      logger.info('Connection pool manager initialized successfully');
      this.emit('initialized', { postgres: pgPool, redis: redisClient });

      return {
        postgres: pgPool,
        redis: redisClient
      };

    } catch (error) {
      logger.error('Failed to initialize connection pool', error);
      this.emit('initializationError', error);

      // Retry initialization
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        this.connectionAttempts++;
        logger.info(`Retrying initialization (${this.connectionAttempts}/${this.maxConnectionAttempts})`);
        await this.delay(5000 * this.connectionAttempts);
        return this.initialize();
      }

      throw error;
    }
  }

  /**
   * Connect to PostgreSQL
   */
  async connectPostgres() {
    try {
      const pool = await this.postgres.connect();

      // Subscribe to PostgreSQL events
      this.postgres.on('error', (error) => {
        logger.error('PostgreSQL error', error);
        this.emit('postgres:error', error);
        this.handleDatabaseError('postgres', error);
      });

      this.postgres.on('disconnected', () => {
        logger.warn('PostgreSQL disconnected');
        this.emit('postgres:disconnected');
      });

      this.postgres.on('connected', () => {
        logger.info('PostgreSQL reconnected');
        this.emit('postgres:reconnected');
      });

      return pool;

    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', error);
      throw error;
    }
  }

  /**
   * Connect to Redis
   */
  async connectRedis() {
    try {
      const client = await this.redis.connect();

      // Subscribe to Redis events
      this.redis.on('error', (error) => {
        logger.error('Redis error', error);
        this.emit('redis:error', error);
        this.handleDatabaseError('redis', error);
      });

      this.redis.on('disconnected', () => {
        logger.warn('Redis disconnected');
        this.emit('redis:disconnected');
      });

      this.redis.on('connected', () => {
        logger.info('Redis reconnected');
        this.emit('redis:reconnected');
      });

      return client;

    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  /**
   * Setup cross-database event handlers
   */
  setupEventHandlers() {
    // Cache invalidation on database changes
    this.postgres.on('queryExecuted', async ({ text, duration }) => {
      // Clear relevant cache on write operations
      if (this.isWriteQuery(text)) {
        await this.invalidateCache(text);
      }

      // Log slow queries
      if (duration > 1000) {
        logger.warn('Slow query detected', { query: text, duration });
        this.emit('slowQuery', { database: 'postgres', query: text, duration });
      }
    });

    // Monitor pool exhaustion
    this.postgres.on('poolExhausted', () => {
      logger.warn('PostgreSQL connection pool exhausted');
      this.emit('poolExhausted', { database: 'postgres' });
    });

    // Monitor Redis memory usage
    this.redis.on('memoryWarning', (usage) => {
      logger.warn('Redis memory usage high', { usage });
      this.emit('memoryWarning', { database: 'redis', usage });
    });
  }

  /**
   * Check if query is a write operation
   */
  isWriteQuery(query) {
    const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE'];
    const upperQuery = query.toUpperCase().trim();
    return writeKeywords.some(keyword => upperQuery.startsWith(keyword));
  }

  /**
   * Invalidate cache based on query
   */
  async invalidateCache(query) {
    try {
      // Extract table name from query
      const tableMatch = query.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        const pattern = `cache:*:${tableName}:*`;

        const cleared = await this.redis.clearByPattern(pattern);
        if (cleared > 0) {
          logger.info(`Cleared ${cleared} cache entries for table ${tableName}`);
        }
      }
    } catch (error) {
      logger.error('Error invalidating cache', error);
    }
  }

  /**
   * Handle database errors
   */
  async handleDatabaseError(database, error) {
    logger.error(`Database error in ${database}`, error);

    // Check if this is a connection error
    if (this.isConnectionError(error)) {
      logger.info(`Attempting to reconnect ${database}`);

      try {
        if (database === 'postgres') {
          await this.postgres.handleReconnect();
        } else if (database === 'redis') {
          await this.redis.connect();
        }
      } catch (reconnectError) {
        logger.error(`Failed to reconnect ${database}`, reconnectError);
        this.emit('reconnectFailed', { database, error: reconnectError });
      }
    }
  }

  /**
   * Check if error is connection-related
   */
  isConnectionError(error) {
    const connectionErrorPatterns = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'Connection lost',
      'Connection terminated'
    ];

    const errorMessage = error.message || error.toString();
    return connectionErrorPatterns.some(pattern =>
      errorMessage.includes(pattern)
    );
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();

        if (health.status !== 'healthy') {
          logger.warn('System health degraded', health);
          this.emit('healthDegraded', health);
        }

        // Emit metrics
        this.emit('healthCheck', health);

      } catch (error) {
        logger.error('Health check failed', error);
        this.emit('healthCheckError', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus() {
    const [pgHealth, redisHealth] = await Promise.allSettled([
      this.postgres.getHealth(),
      this.redis.getHealth()
    ]);

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      databases: {
        postgres: pgHealth.status === 'fulfilled' ? pgHealth.value : {
          status: 'unhealthy',
          error: pgHealth.reason?.message
        },
        redis: redisHealth.status === 'fulfilled' ? redisHealth.value : {
          status: 'unhealthy',
          error: redisHealth.reason?.message
        }
      }
    };

    // Determine overall status
    if (health.databases.postgres.status !== 'healthy' ||
        health.databases.redis.status !== 'healthy') {
      health.status = 'degraded';
    }

    if (health.databases.postgres.status === 'unhealthy' &&
        health.databases.redis.status === 'unhealthy') {
      health.status = 'critical';
    }

    return health;
  }

  /**
   * Execute a query with caching
   */
  async cachedQuery(query, params = [], options = {}) {
    const cacheKey = this.generateCacheKey(query, params);
    const ttl = options.ttl || 600; // 10 minutes default

    // Check cache first
    if (options.cache !== false) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit for query', { cacheKey });
        return cached;
      }
    }

    // Execute query
    const result = await this.postgres.query(query, params, options);

    // Cache the result
    if (options.cache !== false && result.rows) {
      await this.redis.set(cacheKey, result.rows, ttl);
      logger.debug('Cached query result', { cacheKey, ttl });
    }

    return result.rows;
  }

  /**
   * Generate cache key for query
   */
  generateCacheKey(query, params) {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(query);
    hash.update(JSON.stringify(params));
    return `cache:query:${hash.digest('hex')}`;
  }

  /**
   * Execute a transaction with distributed locking
   */
  async transactionWithLock(resourceId, callback, options = {}) {
    const lock = await this.redis.acquireLock(resourceId, options.lockTTL);

    try {
      const result = await this.postgres.transaction(callback, options);
      return result;

    } finally {
      await lock.release();
    }
  }

  /**
   * Bulk insert with batching
   */
  async bulkInsert(table, records, batchSize = 100) {
    const results = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      await this.postgres.transaction(async (client) => {
        for (const record of batch) {
          const columns = Object.keys(record);
          const values = Object.values(record);
          const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

          const query = `
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES (${placeholders})
            RETURNING *
          `;

          const result = await client.query(query, values);
          results.push(result.rows[0]);
        }
      });

      logger.info(`Inserted batch ${Math.floor(i / batchSize) + 1}`, {
        table,
        processed: Math.min(i + batchSize, records.length),
        total: records.length
      });
    }

    // Clear cache for the table
    await this.redis.clearByPattern(`cache:*:${table}:*`);

    return results;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      postgres: this.postgres.getStats(),
      redis: this.redis.getMetrics(),
      initialized: this.initialized,
      uptime: process.uptime()
    };
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down connection pool manager');

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Disconnect from databases
      await Promise.all([
        this.postgres.disconnect(),
        this.redis.disconnect()
      ]);

      this.initialized = false;
      logger.info('Connection pool manager shut down successfully');
      this.emit('shutdown');

    } catch (error) {
      logger.error('Error during shutdown', error);
      throw error;
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
const connectionPool = new ConnectionPoolManager();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await connectionPool.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await connectionPool.shutdown();
  process.exit(0);
});

export default connectionPool;
export { ConnectionPoolManager };