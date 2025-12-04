/**
 * Redis Connection Manager
 * High-performance caching and session management
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import winston from 'winston';
import { LRUCache } from 'lru-cache';
import dotenv from 'dotenv';

dotenv.config();

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'redis-connection' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Redis key patterns
 */
export const REDIS_KEYS = {
  // Sessions
  SESSION: 'session:{sessionId}',
  SESSION_INDEX: 'sessions:user:{userId}',

  // Agents
  AGENT_STATE: 'agent:state:{agentId}',
  AGENT_CACHE: 'agent:cache:{agentId}',
  AGENT_LOCK: 'agent:lock:{agentId}',

  // Tasks
  TASK_QUEUE: 'tasks:queue:{priority}',
  TASK_PROCESSING: 'tasks:processing:{agentId}',
  TASK_RESULT: 'task:result:{taskId}',

  // Cache
  CACHE_QUERY: 'cache:query:{queryHash}',
  CACHE_STATS: 'cache:stats:{entityType}:{entityId}',

  // Rate Limiting
  RATE_LIMIT: 'rate:{userId}:{action}',

  // Metrics
  METRICS_COUNTER: 'metrics:counter:{metricName}',
  METRICS_HISTOGRAM: 'metrics:histogram:{metricName}',

  // Distributed Locks
  LOCK: 'lock:{resourceType}:{resourceId}',

  // Pub/Sub Channels
  CHANNEL_AGENT_STATUS: 'channel:agent:status',
  CHANNEL_TASK_EVENTS: 'channel:task:events',
  CHANNEL_SYSTEM_ALERTS: 'channel:system:alerts'
};

/**
 * TTL Configuration (in seconds)
 */
export const TTL_CONFIG = {
  SESSION: 3600,           // 1 hour
  AGENT_STATE: 300,        // 5 minutes
  CACHE_QUERY: 600,        // 10 minutes
  TASK_RESULT: 86400,      // 24 hours
  RATE_LIMIT: 60,          // 1 minute
  LOCK_DEFAULT: 30,        // 30 seconds
  METRICS: 3600            // 1 hour
};

/**
 * Redis Connection Manager
 */
class RedisConnectionManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: config.keyPrefix || process.env.REDIS_PREFIX || 'agent:',

      // Connection options
      maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
      enableReadyCheck: config.enableReadyCheck !== false,
      connectTimeout: config.connectTimeout || 10000,
      commandTimeout: config.commandTimeout || 5000,

      // Retry strategy
      retryStrategy: config.retryStrategy || this.defaultRetryStrategy,

      // Cluster configuration (if applicable)
      cluster: process.env.REDIS_CLUSTER === 'true' ? {
        nodes: JSON.parse(process.env.REDIS_CLUSTER_NODES || '[]'),
        redisOptions: {
          password: process.env.REDIS_PASSWORD
        }
      } : undefined,

      // Sentinel configuration (if applicable)
      sentinels: process.env.REDIS_SENTINEL === 'true' ?
        JSON.parse(process.env.REDIS_SENTINELS || '[]') : undefined,
      name: process.env.REDIS_SENTINEL_NAME
    };

    this.client = null;
    this.pubClient = null;
    this.subClient = null;
    this.connected = false;

    // L1 Cache (in-memory LRU)
    this.l1Cache = new LRUCache({
      max: 500,
      ttl: 60 * 1000, // 60 seconds
      updateAgeOnGet: true
    });

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      commandCount: 0
    };

    this.subscriptions = new Map();
  }

  /**
   * Default retry strategy
   */
  defaultRetryStrategy(times) {
    if (times > 3) {
      logger.error('Maximum Redis retry attempts reached');
      return null;
    }
    const delay = Math.min(times * 100, 3000);
    logger.info(`Retrying Redis connection in ${delay}ms (attempt ${times})`);
    return delay;
  }

  /**
   * Connect to Redis
   */
  async connect() {
    try {
      logger.info('Establishing Redis connection', {
        host: this.config.host,
        port: this.config.port
      });

      // Create main client
      if (this.config.cluster) {
        this.client = new Redis.Cluster(this.config.cluster.nodes, this.config);
      } else if (this.config.sentinels) {
        this.client = new Redis(this.config);
      } else {
        this.client = new Redis(this.config);
      }

      // Setup event handlers
      this.setupEventHandlers(this.client, 'main');

      // Wait for connection
      await this.waitForConnection(this.client);

      // Create pub/sub clients
      this.pubClient = this.client.duplicate();
      this.subClient = this.client.duplicate();

      await Promise.all([
        this.waitForConnection(this.pubClient),
        this.waitForConnection(this.subClient)
      ]);

      this.setupPubSubHandlers();

      this.connected = true;
      logger.info('Redis connection established successfully');
      this.emit('connected');

      // Start monitoring
      this.startMonitoring();

      return this.client;

    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Wait for client connection
   */
  async waitForConnection(client, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, timeout);

      if (client.status === 'ready') {
        clearTimeout(timer);
        resolve();
      } else {
        client.once('ready', () => {
          clearTimeout(timer);
          resolve();
        });

        client.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      }
    });
  }

  /**
   * Setup event handlers for a client
   */
  setupEventHandlers(client, name) {
    client.on('connect', () => {
      logger.info(`Redis ${name} client connected`);
      this.emit(`${name}:connected`);
    });

    client.on('ready', () => {
      logger.info(`Redis ${name} client ready`);
      this.emit(`${name}:ready`);
    });

    client.on('error', (error) => {
      logger.error(`Redis ${name} client error`, error);
      this.metrics.errors++;
      this.emit(`${name}:error`, error);
    });

    client.on('close', () => {
      logger.info(`Redis ${name} client connection closed`);
      this.emit(`${name}:closed`);
    });

    client.on('reconnecting', (delay) => {
      logger.info(`Redis ${name} client reconnecting in ${delay}ms`);
      this.emit(`${name}:reconnecting`, delay);
    });

    client.on('end', () => {
      logger.info(`Redis ${name} client connection ended`);
      this.emit(`${name}:ended`);
    });
  }

  /**
   * Setup pub/sub handlers
   */
  setupPubSubHandlers() {
    this.subClient.on('message', (channel, message) => {
      logger.debug(`Received message on channel ${channel}`);

      const handlers = this.subscriptions.get(channel);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            const parsed = JSON.parse(message);
            handler(parsed, channel);
          } catch (error) {
            logger.error('Error handling pub/sub message', error);
          }
        });
      }
    });

    this.subClient.on('pmessage', (pattern, channel, message) => {
      logger.debug(`Received pattern message on ${channel} (pattern: ${pattern})`);

      const handlers = this.subscriptions.get(pattern);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            const parsed = JSON.parse(message);
            handler(parsed, channel, pattern);
          } catch (error) {
            logger.error('Error handling pattern message', error);
          }
        });
      }
    });
  }

  /**
   * Get value with L1 and L2 cache
   */
  async get(key) {
    this.metrics.commandCount++;

    // Check L1 cache
    const l1Value = this.l1Cache.get(key);
    if (l1Value !== undefined) {
      this.metrics.hits++;
      logger.debug(`L1 cache hit for key: ${key}`);
      return l1Value;
    }

    // Check L2 cache (Redis)
    try {
      const value = await this.client.get(key);

      if (value !== null) {
        this.metrics.hits++;
        logger.debug(`L2 cache hit for key: ${key}`);

        // Parse JSON if applicable
        let parsed = value;
        try {
          parsed = JSON.parse(value);
        } catch {
          // Not JSON, use as-is
        }

        // Update L1 cache
        this.l1Cache.set(key, parsed);

        return parsed;
      }

      this.metrics.misses++;
      logger.debug(`Cache miss for key: ${key}`);
      return null;

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error getting key ${key}`, error);
      throw error;
    }
  }

  /**
   * Set value with optional TTL
   */
  async set(key, value, ttl = null) {
    this.metrics.commandCount++;
    this.metrics.sets++;

    try {
      // Serialize value if needed
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;

      // Set in Redis
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      // Update L1 cache
      this.l1Cache.set(key, value);

      logger.debug(`Set key: ${key}, TTL: ${ttl || 'none'}`);
      return true;

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error setting key ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete key(s)
   */
  async delete(...keys) {
    this.metrics.commandCount++;
    this.metrics.deletes++;

    try {
      const result = await this.client.del(...keys);

      // Remove from L1 cache
      keys.forEach(key => this.l1Cache.delete(key));

      logger.debug(`Deleted ${result} key(s)`);
      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error deleting keys`, error);
      throw error;
    }
  }

  /**
   * Set hash field
   */
  async hset(key, field, value) {
    this.metrics.commandCount++;

    try {
      const serialized = typeof value === 'object' ? JSON.stringify(value) : value;
      const result = await this.client.hset(key, field, serialized);

      // Invalidate L1 cache for the hash
      this.l1Cache.delete(key);

      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error setting hash field ${key}.${field}`, error);
      throw error;
    }
  }

  /**
   * Get hash field
   */
  async hget(key, field) {
    this.metrics.commandCount++;

    try {
      const value = await this.client.hget(key, field);

      if (value !== null) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return null;

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error getting hash field ${key}.${field}`, error);
      throw error;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall(key) {
    this.metrics.commandCount++;

    // Check L1 cache
    const cached = this.l1Cache.get(key);
    if (cached) {
      this.metrics.hits++;
      return cached;
    }

    try {
      const hash = await this.client.hgetall(key);

      if (Object.keys(hash).length > 0) {
        // Parse JSON values
        const parsed = {};
        for (const [field, value] of Object.entries(hash)) {
          try {
            parsed[field] = JSON.parse(value);
          } catch {
            parsed[field] = value;
          }
        }

        // Cache result
        this.l1Cache.set(key, parsed);

        return parsed;
      }

      return null;

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error getting hash ${key}`, error);
      throw error;
    }
  }

  /**
   * Increment counter
   */
  async incr(key, amount = 1) {
    this.metrics.commandCount++;

    try {
      const result = await this.client.incrby(key, amount);
      this.l1Cache.delete(key);
      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error incrementing ${key}`, error);
      throw error;
    }
  }

  /**
   * Add to sorted set
   */
  async zadd(key, score, member) {
    this.metrics.commandCount++;

    try {
      const result = await this.client.zadd(key, score, member);
      this.l1Cache.delete(key);
      return result;

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error adding to sorted set ${key}`, error);
      throw error;
    }
  }

  /**
   * Get sorted set range
   */
  async zrange(key, start, stop, withScores = false) {
    this.metrics.commandCount++;

    try {
      if (withScores) {
        return await this.client.zrange(key, start, stop, 'WITHSCORES');
      } else {
        return await this.client.zrange(key, start, stop);
      }

    } catch (error) {
      this.metrics.errors++;
      logger.error(`Error getting sorted set range ${key}`, error);
      throw error;
    }
  }

  /**
   * Publish message to channel
   */
  async publish(channel, message) {
    if (!this.pubClient) {
      throw new Error('Pub/Sub not initialized');
    }

    try {
      const serialized = typeof message === 'object' ? JSON.stringify(message) : message;
      const result = await this.pubClient.publish(channel, serialized);

      logger.debug(`Published to ${channel}, ${result} subscribers`);
      return result;

    } catch (error) {
      logger.error(`Error publishing to ${channel}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel, handler) {
    if (!this.subClient) {
      throw new Error('Pub/Sub not initialized');
    }

    try {
      // Store handler
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
        await this.subClient.subscribe(channel);
      }

      this.subscriptions.get(channel).add(handler);
      logger.info(`Subscribed to channel: ${channel}`);

      // Return unsubscribe function
      return () => {
        const handlers = this.subscriptions.get(channel);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            this.subscriptions.delete(channel);
            this.subClient.unsubscribe(channel);
          }
        }
      };

    } catch (error) {
      logger.error(`Error subscribing to ${channel}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to pattern
   */
  async psubscribe(pattern, handler) {
    if (!this.subClient) {
      throw new Error('Pub/Sub not initialized');
    }

    try {
      // Store handler
      if (!this.subscriptions.has(pattern)) {
        this.subscriptions.set(pattern, new Set());
        await this.subClient.psubscribe(pattern);
      }

      this.subscriptions.get(pattern).add(handler);
      logger.info(`Subscribed to pattern: ${pattern}`);

      // Return unsubscribe function
      return () => {
        const handlers = this.subscriptions.get(pattern);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            this.subscriptions.delete(pattern);
            this.subClient.punsubscribe(pattern);
          }
        }
      };

    } catch (error) {
      logger.error(`Error subscribing to pattern ${pattern}`, error);
      throw error;
    }
  }

  /**
   * Acquire distributed lock
   */
  async acquireLock(resource, ttl = TTL_CONFIG.LOCK_DEFAULT, retries = 5) {
    const lockKey = REDIS_KEYS.LOCK.replace('{resourceType}:{resourceId}', resource);
    const lockValue = `${process.pid}-${Date.now()}-${Math.random()}`;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.client.set(
          lockKey,
          lockValue,
          'EX',
          ttl,
          'NX'
        );

        if (result === 'OK') {
          logger.debug(`Lock acquired: ${resource}`);
          return {
            resource,
            value: lockValue,
            key: lockKey,
            release: async () => {
              await this.releaseLock(lockKey, lockValue);
            }
          };
        }

        // Wait before retry
        await this.delay(100 * (i + 1));

      } catch (error) {
        logger.error(`Error acquiring lock for ${resource}`, error);
        if (i === retries - 1) throw error;
      }
    }

    throw new Error(`Failed to acquire lock for ${resource} after ${retries} retries`);
  }

  /**
   * Release distributed lock
   */
  async releaseLock(key, value) {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await this.client.eval(script, 1, key, value);

      if (result === 1) {
        logger.debug(`Lock released: ${key}`);
      } else {
        logger.warn(`Failed to release lock: ${key} (value mismatch)`);
      }

      return result === 1;

    } catch (error) {
      logger.error(`Error releasing lock ${key}`, error);
      throw error;
    }
  }

  /**
   * Execute pipeline operations
   */
  async pipeline(operations) {
    const pipeline = this.client.pipeline();

    for (const op of operations) {
      pipeline[op.command](...(op.args || []));
    }

    try {
      const results = await pipeline.exec();
      return results.map(([err, result]) => {
        if (err) throw err;
        return result;
      });

    } catch (error) {
      logger.error('Pipeline execution failed', error);
      throw error;
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearByPattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.delete(...keys);
        logger.info(`Cleared ${keys.length} keys matching pattern: ${pattern}`);
      }

      // Clear L1 cache entries matching pattern
      for (const key of this.l1Cache.keys()) {
        if (this.matchPattern(key, pattern)) {
          this.l1Cache.delete(key);
        }
      }

      return keys.length;

    } catch (error) {
      logger.error(`Error clearing keys by pattern ${pattern}`, error);
      throw error;
    }
  }

  /**
   * Match key against pattern
   */
  matchPattern(key, pattern) {
    const regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(key);
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    setInterval(() => {
      this.emit('metrics', this.getMetrics());
    }, 60000); // Every minute
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0
      ? this.metrics.hits / (this.metrics.hits + this.metrics.misses)
      : 0;

    return {
      ...this.metrics,
      hitRate: (hitRate * 100).toFixed(2) + '%',
      l1CacheSize: this.l1Cache.size,
      uptime: process.uptime()
    };
  }

  /**
   * Get health status
   */
  async getHealth() {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      const info = await this.client.info();
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);

      return {
        status: 'healthy',
        latency,
        memory: memoryMatch ? memoryMatch[1].trim() : 'unknown',
        uptime: uptimeMatch ? parseInt(uptimeMatch[1]) : 0,
        metrics: this.getMetrics()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        metrics: this.getMetrics()
      };
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    try {
      logger.info('Disconnecting from Redis');

      // Clear L1 cache
      this.l1Cache.clear();

      // Unsubscribe from all channels
      for (const channel of this.subscriptions.keys()) {
        if (channel.includes('*')) {
          await this.subClient.punsubscribe(channel);
        } else {
          await this.subClient.unsubscribe(channel);
        }
      }
      this.subscriptions.clear();

      // Disconnect clients
      if (this.subClient) {
        this.subClient.disconnect();
        this.subClient = null;
      }

      if (this.pubClient) {
        this.pubClient.disconnect();
        this.pubClient = null;
      }

      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }

      this.connected = false;
      logger.info('Redis disconnected successfully');
      this.emit('disconnected');

    } catch (error) {
      logger.error('Error disconnecting from Redis', error);
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
const redisConnection = new RedisConnectionManager();

export default redisConnection;
export { RedisConnectionManager, TTL_CONFIG };