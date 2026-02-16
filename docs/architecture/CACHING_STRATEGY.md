# Redis Caching Strategy Guide
## Advanced Cache Optimization for AI Agent System

**Version:** 1.0.0
**Last Updated:** November 2024

---

## Table of Contents

1. [Cache Architecture](#cache-architecture)
2. [Key Strategy](#key-strategy)
3. [TTL Optimization](#ttl-optimization)
4. [Cache Invalidation](#cache-invalidation)
5. [Memory Management](#memory-management)
6. [Performance Monitoring](#performance-monitoring)
7. [Cache Warming](#cache-warming)
8. [Advanced Patterns](#advanced-patterns)

---

## Cache Architecture

### Multi-Level Caching Strategy

```
┌─────────────────────────────────────────────┐
│         Application Layer                    │
├─────────────────────────────────────────────┤
│  L1 Cache: LRU In-Memory (Node.js)           │
│  - 1000 hot items                           │
│  - 50MB max size                            │
│  - 5 minute TTL                             │
│  - Response time: <1ms                      │
├─────────────────────────────────────────────┤
│  L2 Cache: Redis (Distributed)              │
│  - 100,000 items                            │
│  - 512MB Redis instance                     │
│  - Variable TTL (5 min to 24 hours)         │
│  - Response time: 1-5ms                     │
├─────────────────────────────────────────────┤
│  L3 Store: PostgreSQL Database              │
│  - 100M+ rows                               │
│  - Persistent storage                       │
│  - Source of truth                          │
│  - Response time: 10-100ms+                 │
└─────────────────────────────────────────────┘
```

### Implementation Pattern

```javascript
// L1/L2/L3 Caching Implementation
class CacheManager {
  constructor(l1CacheConfig, l2Client) {
    this.l1 = new LRUCache(l1CacheConfig);
    this.l2 = l2Client;  // Redis
  }

  async get(key, fetchFn) {
    // Try L1 (fastest)
    let value = this.l1.get(key);
    if (value) {
      metrics.recordL1Hit();
      return value;
    }

    // Try L2 (fast)
    try {
      value = await this.l2.get(key);
      if (value) {
        metrics.recordL2Hit();
        this.l1.set(key, value);  // Repopulate L1
        return value;
      }
    } catch (error) {
      logger.warn('L2 cache error, continuing to L3', error);
    }

    // Fetch from L3 (slow)
    metrics.recordMiss();
    value = await fetchFn();

    // Populate both L1 and L2
    const ttl = getTTLForKey(key);
    this.l1.set(key, value);
    if (value) {
      await this.l2.set(key, JSON.stringify(value), 'EX', ttl)
        .catch(err => logger.warn('L2 set failed', err));
    }

    return value;
  }

  async invalidate(key) {
    this.l1.delete(key);
    await this.l2.del(key).catch(err => logger.warn('L2 delete failed', err));
  }
}
```

---

## Key Strategy

### Hierarchical Key Naming Convention

```javascript
// Consistent, hierarchical key patterns
const CACHE_KEYS = {
  // Resource keys (entity-specific data)
  USER: (userId) => `user:${userId}`,
  AGENT: (agentId) => `agent:${agentId}`,
  TASK: (taskId) => `task:${taskId}`,
  SESSION: (sessionId) => `session:${sessionId}`,

  // List/collection keys
  TASKS_AGENT: (agentId) => `tasks:agent:${agentId}`,
  VOTES_AGENT: (agentId) => `votes:agent:${agentId}`,
  AGENTS_ACTIVE: () => `agents:active`,

  // Computed/aggregated keys
  AGENT_STATS: (agentId) => `stats:agent:${agentId}`,
  AGENT_METRICS: (agentId, period) => `metrics:agent:${agentId}:${period}`,
  LEADERBOARD: (period) => `leaderboard:${period}`,
  LEADERBOARD_PERCENTILE: (period) => `lb:percentile:${period}`,

  // Query result keys
  QUERY: (hash) => `query:${hash}`,

  // Lock keys
  LOCK: (resource) => `lock:${resource}`,

  // Rate limit keys
  RATE_LIMIT: (userId, action) => `rl:${userId}:${action}`,

  // Pub/Sub channels
  CHANNEL_UPDATES: (resource) => `updates:${resource}`,

  // Temporary/session keys
  TEMP_DATA: (sessionId, dataId) => `temp:${sessionId}:${dataId}`,

  // Tag-based invalidation
  TAG: (tag) => `tag:${tag}`,
  ENTITY_TAGS: (entityId) => `tags:${entityId}`
};

// Usage with proper formatting
const cacheKey = CACHE_KEYS.AGENT('550e8400-e29b-41d4-a716-446655440000');
// Result: agent:550e8400-e29b-41d4-a716-446655440000

const statsKey = CACHE_KEYS.AGENT_STATS('550e8400-e29b-41d4-a716-446655440000');
// Result: stats:agent:550e8400-e29b-41d4-a716-446655440000
```

### Key Size Optimization

```javascript
// INEFFICIENT: Long keys waste memory
const badKey = `cache:query:full:hash:value:${queryHash}:with:params:${JSON.stringify(params)}`;
// Size: 150+ bytes

// EFFICIENT: Short, compressed keys
const goodKey = `q:${queryHash}:${paramHash}`;
// Size: 30 bytes (80% reduction)

// Key compression function
function generateCompressedKey(prefix, ...parts) {
  const hash = crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 8);  // Use first 8 chars only
  return `${prefix}:${hash}`;
}

const compressedKey = generateCompressedKey('q', queryString, JSON.stringify(params));
// Result: q:a1b2c3d4 (12 bytes)
```

### Key Prefix Strategy for Multi-Tenancy

```javascript
// Support multi-tenant caching with namespace isolation
const createKeyWithTenant = (tenantId, entityType, entityId) => {
  return `t:${tenantId}:${entityType}:${entityId}`;
};

// Usage
const userKey = createKeyWithTenant('acme-corp', 'user', 'user-123');
// Result: t:acme-corp:user:user-123

// Clear all keys for a tenant
async function clearTenantCache(tenantId) {
  const pattern = `t:${tenantId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

---

## TTL Optimization

### Dynamic TTL Strategy

```javascript
// TTL Configuration
const TTL_CONFIG = {
  // User/Account data (stable, long TTL)
  USER_PROFILE: 3600,              // 1 hour
  USER_PREFERENCES: 3600,          // 1 hour
  SESSION: 1800,                   // 30 minutes

  // Entity state (moderately volatile, medium TTL)
  AGENT_STATE: 300,                // 5 minutes
  AGENT_STATS: 300,                // 5 minutes
  TASK_DETAILS: 600,               // 10 minutes

  // Computed/aggregated data (volatile, short TTL)
  LEADERBOARD: 60,                 // 1 minute
  METRICS: 60,                     // 1 minute
  AGENT_METRICS: 60,               // 1 minute

  // Query results (depends on query, configurable)
  QUERY_DEFAULT: 600,              // 10 minutes
  QUERY_VOLATILE: 60,              // 1 minute (for frequently changing queries)
  QUERY_STABLE: 3600,              // 1 hour (for rarely changing queries)

  // Locks (must be short)
  LOCK_DEFAULT: 30,                // 30 seconds
  LOCK_LONG: 300,                  // 5 minutes (for long operations)

  // Rate limits
  RATE_LIMIT: 60,                  // 1 minute

  // Temporary data
  TEMP_DATA: 300,                  // 5 minutes
  VERIFICATION_CODE: 900           // 15 minutes
};

// Adaptive TTL based on data age
function calculateAdaptiveTTL(dataType, lastModified) {
  const now = Date.now();
  const ageSeconds = (now - lastModified) / 1000;

  if (ageSeconds < 60) {
    // Data < 1 minute old - very volatile
    return 60;
  } else if (ageSeconds < 3600) {
    // Data 1-60 minutes old - moderately volatile
    return 300;
  } else if (ageSeconds < 86400) {
    // Data 1-24 hours old - stable
    return 1800;
  } else {
    // Data > 24 hours old - very stable
    return 3600;
  }
}

// Usage
const ttl = calculateAdaptiveTTL('agent:stats', agent.lastModified);
await redis.set(cacheKey, agentData, 'EX', ttl);
```

### Per-Endpoint TTL Configuration

```javascript
// Configure cache TTL at the endpoint level
const ENDPOINT_CACHE_CONFIG = {
  // GET /api/agents/:id
  'GET_AGENT': {
    enabled: true,
    ttl: 300,        // 5 minutes
    keyFn: (id) => `agent:${id}`,
    invalidateOn: ['AGENT_UPDATED', 'AGENT_DELETED']
  },

  // GET /api/agents/:id/stats
  'GET_AGENT_STATS': {
    enabled: true,
    ttl: 60,         // 1 minute (changes frequently)
    keyFn: (id) => `stats:agent:${id}`,
    invalidateOn: ['TASK_COMPLETED', 'TASK_FAILED']
  },

  // GET /api/leaderboard
  'GET_LEADERBOARD': {
    enabled: true,
    ttl: 60,         // 1 minute
    keyFn: (period) => `leaderboard:${period}`,
    invalidateOn: ['VOTE_SUBMITTED', 'AGENT_REPUTATION_CHANGED']
  },

  // GET /api/tasks?agent_id=xxx&status=yyy
  'GET_TASKS': {
    enabled: true,
    ttl: 300,        // 5 minutes
    keyFn: (agentId, status) => `tasks:agent:${agentId}:${status}`,
    invalidateOn: ['TASK_CREATED', 'TASK_STATUS_CHANGED']
  }
};
```

---

## Cache Invalidation

### Strategy 1: Time-Based Invalidation (TTL)

**When to use:** Non-critical data, frequently changing data

```javascript
// Simplest approach - automatic expiration via TTL
await redis.set(
  CACHE_KEYS.AGENT(agentId),
  agentData,
  'EX',
  300  // Expires in 5 minutes automatically
);

// No manual invalidation needed
// Pros: Simple, prevents stale data
// Cons: May serve stale data for up to TTL duration
```

### Strategy 2: Event-Based Invalidation

**When to use:** Critical data, high update frequency

```javascript
// Invalidate on database changes
class DataLayerWithInvalidation {
  async updateAgent(agentId, updates) {
    // Update database
    const agent = await db.updateAgent(agentId, updates);

    // Invalidate related caches immediately
    await redis.del(CACHE_KEYS.AGENT(agentId));
    await redis.del(CACHE_KEYS.AGENT_STATS(agentId));
    await redis.del(CACHE_KEYS.AGENT_METRICS(agentId));

    // Emit event for other services
    eventEmitter.emit('agent:updated', { agentId, agent });

    return agent;
  }

  async createTask(task) {
    // Insert to database
    const newTask = await db.createTask(task);

    // Invalidate agent's task list
    await redis.del(CACHE_KEYS.TASKS_AGENT(task.agentId));

    // Invalidate leaderboard (might change)
    await redis.del(CACHE_KEYS.LEADERBOARD('daily'));

    // Emit event
    eventEmitter.emit('task:created', { task: newTask });

    return newTask;
  }
}

// Listen for events and handle invalidation
eventEmitter.on('task:completed', async (event) => {
  const { taskId, agentId } = event;

  // Invalidate affected caches
  await redis.del(CACHE_KEYS.TASK(taskId));
  await redis.del(CACHE_KEYS.AGENT_STATS(agentId));
  await redis.del(CACHE_KEYS.LEADERBOARD('daily'));
});
```

### Strategy 3: Tag-Based Invalidation

**When to use:** Complex data relationships, cascading invalidation

```javascript
// Store tags for efficient batch invalidation
async function cacheWithTags(key, value, tags, ttl) {
  // Store main value
  await redis.set(key, JSON.stringify(value), 'EX', ttl);

  // Store tags for invalidation
  for (const tag of tags) {
    await redis.sadd(`tag:${tag}`, key);
  }

  // Store key-to-tags mapping for cleanup
  await redis.set(`tags:${key}`, JSON.stringify(tags), 'EX', ttl);
}

// Invalidate by tag
async function invalidateByTag(tag) {
  try {
    // Get all keys with this tag
    const keys = await redis.smembers(`tag:${tag}`);

    if (keys.length > 0) {
      // Delete all keys with this tag
      await redis.del(...keys);

      // Clean up tag membership
      for (const key of keys) {
        await redis.del(`tag:${key}`);
      }
    }

    // Clean up the tag set
    await redis.del(`tag:${tag}`);
  } catch (error) {
    logger.error('Tag invalidation failed', error);
  }
}

// Usage example
async function updateAgentReputation(agentId, newScore) {
  // Update database
  const agent = await db.updateAgentReputation(agentId, newScore);

  // Invalidate all related caches at once
  await invalidateByTag(`agent:${agentId}`);
  await invalidateByTag('leaderboard');
  await invalidateByTag('metrics');

  return agent;
}

// Cache with multiple tags for complex invalidation
async function cacheAgentStats(agentId, stats) {
  const ttl = 300;
  const tags = [
    `agent:${agentId}`,
    `stats:agent:${agentId}`,
    'leaderboard',
    'metrics',
    'agent:all'
  ];

  await cacheWithTags(
    CACHE_KEYS.AGENT_STATS(agentId),
    stats,
    tags,
    ttl
  );
}
```

### Strategy 4: Pattern-Based Invalidation

**When to use:** Bulk operations, namespace cleanup

```javascript
// Pattern-based key scanning and deletion
async function invalidateByPattern(pattern) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
    logger.info(`Invalidated ${keys.length} keys matching ${pattern}`);
  }
}

// Usage examples
await invalidateByPattern(`tasks:agent:${agentId}:*`);
await invalidateByPattern('leaderboard:*');
await invalidateByPattern('metrics:agent:*');

// For large keyspaces, use SCAN instead of KEYS
async function invalidateByPatternScan(pattern) {
  let cursor = 0;
  let deletedCount = 0;

  do {
    const [newCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100
    );

    if (keys.length > 0) {
      await redis.del(...keys);
      deletedCount += keys.length;
    }

    cursor = newCursor;
  } while (cursor !== '0');

  logger.info(`Invalidated ${deletedCount} keys matching ${pattern}`);
}
```

### Invalidation Strategy Comparison

| Strategy | Latency | Coverage | Complexity | Use Case |
|----------|---------|----------|-----------|----------|
| TTL | Moderate | Eventual | Low | Non-critical data |
| Event-Based | Very Low | Precise | Medium | Critical real-time data |
| Tag-Based | Low | Flexible | Medium | Complex relationships |
| Pattern-Based | Low | Broad | Low | Bulk operations |

---

## Memory Management

### Memory Usage Monitoring

```javascript
// Monitor Redis memory continuously
async function monitorRedisMemory() {
  setInterval(async () => {
    try {
      const info = await redis.info('memory');
      const lines = info.split('\r\n');
      const memoryStats = {};

      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryStats[key] = parseInt(value) || value;
        }
      }

      const used = memoryStats.used_memory;
      const maxMemory = memoryStats.maxmemory;
      const usagePercent = (used / maxMemory) * 100;

      logger.info('Redis Memory Usage', {
        usedMB: Math.round(used / 1024 / 1024),
        maxMB: Math.round(maxMemory / 1024 / 1024),
        usagePercent: Math.round(usagePercent * 100) / 100,
        fragmentation: memoryStats.mem_fragmentation_ratio
      });

      // Alert if usage exceeds threshold
      if (usagePercent > 85) {
        logger.warn('Redis memory usage critical', { usagePercent });
        eventEmitter.emit('redis:memory:critical', { usagePercent });
      }

    } catch (error) {
      logger.error('Memory monitoring failed', error);
    }
  }, 60000);  // Check every minute
}

// Start monitoring
monitorRedisMemory();
```

### Memory Optimization Techniques

#### 1. Key Compression

```javascript
// Compress large values before caching
const zlib = require('zlib');

async function setCompressed(key, value, ttl) {
  const json = JSON.stringify(value);
  const compressed = zlib.gzipSync(json);

  // Only store compressed if it saves space
  if (compressed.length < json.length * 0.8) {
    await redis.set(key, compressed, 'EX', ttl, 'COMPRESSED', true);
    logger.debug(`Compressed ${key}: ${json.length} -> ${compressed.length} bytes`);
  } else {
    await redis.set(key, json, 'EX', ttl);
  }
}

async function getCompressed(key) {
  let data = await redis.getBuffer(key);

  if (data) {
    try {
      // Try to decompress
      return JSON.parse(zlib.gunzipSync(data).toString());
    } catch {
      // Not compressed, parse as JSON
      return JSON.parse(data.toString());
    }
  }

  return null;
}
```

#### 2. Data Structure Selection

```javascript
// Use most memory-efficient data structure for each use case

// Instead of STRING with JSON object (high memory)
// {"userId": "123", "count": 5, "status": "active"}  // 40 bytes

// Use HASH (more efficient for objects)
await redis.hset('user:123', 'count', 5, 'status', 'active');
// Saves ~25% memory

// Instead of STRING with JSON array (high memory)
// ["item1", "item2", "item3", "item4", "item5"]  // 50 bytes

// Use SET (more efficient for collections)
await redis.sadd('items', 'item1', 'item2', 'item3', 'item4', 'item5');
// Saves ~30% memory

// Use ZSET for sorted data (e.g., leaderboard)
await redis.zadd('leaderboard', 100, 'agent1', 95, 'agent2', 90, 'agent3');
// More efficient than storing JSON array

// Comparison example:
// JSON array: 5 items × 20 bytes each = 100 bytes
// Redis SET: Same data uses 70 bytes
// Savings: 30%
```

#### 3. Memory Eviction Policies

```bash
# In redis.conf - Set maximum memory and eviction policy

# Maximum memory
maxmemory 512mb

# Eviction policy selection:
# allkeys-lru (RECOMMENDED) - Evict any key, LRU algorithm
# volatile-lru - Evict keys with TTL, LRU algorithm
# allkeys-lfu - Evict any key, LFU algorithm
# volatile-lfu - Evict keys with TTL, LFU algorithm
# volatile-ttl - Evict keys with TTL, expire soonest first
# volatile-random - Evict random keys with TTL
# allkeys-random - Evict random keys
# noeviction - Don't evict, just return errors

maxmemory-policy allkeys-lru

# Monitor evictions
redis-cli INFO stats | grep evicted
```

---

## Performance Monitoring

### Cache Metrics Collection

```javascript
class CacheMetrics {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.l1Hits = 0;
    this.l2Hits = 0;
    this.evictions = 0;
    this.startTime = Date.now();
  }

  recordL1Hit() {
    this.l1Hits++;
    this.hits++;
  }

  recordL2Hit() {
    this.l2Hits++;
    this.hits++;
  }

  recordMiss() {
    this.misses++;
  }

  recordEviction() {
    this.evictions++;
  }

  getMetrics() {
    const total = this.hits + this.misses;
    const uptime = (Date.now() - this.startTime) / 1000;

    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total === 0 ? 0 : ((this.hits / total) * 100).toFixed(2) + '%',
      l1HitPercent: this.hits === 0 ? 0 : ((this.l1Hits / this.hits) * 100).toFixed(2) + '%',
      l2HitPercent: this.hits === 0 ? 0 : ((this.l2Hits / this.hits) * 100).toFixed(2) + '%',
      avgHitRate: (total / (uptime / 60)).toFixed(2) + ' hits/min',
      avgMissRate: (this.misses / (uptime / 60)).toFixed(2) + ' misses/min'
    };
  }

  reset() {
    this.hits = 0;
    this.misses = 0;
    this.l1Hits = 0;
    this.l2Hits = 0;
    this.evictions = 0;
    this.startTime = Date.now();
  }
}

const metrics = new CacheMetrics();

// Export metrics endpoint
app.get('/metrics/cache', (req, res) => {
  res.json(metrics.getMetrics());
});

// Target metrics:
// - Hit Rate: > 85%
// - L1 Hit Percent: > 70% (indicates good hot data locality)
// - Miss Rate: < 15%
// - Eviction Rate: < 5% (indicates good memory management)
```

### Cache Effectiveness Analysis

```javascript
// Analyze cache effectiveness by endpoint/operation
class CacheAnalyzer {
  constructor() {
    this.stats = new Map();
  }

  recordAccess(operation, cacheHit) {
    if (!this.stats.has(operation)) {
      this.stats.set(operation, { hits: 0, misses: 0 });
    }

    const stat = this.stats.get(operation);
    if (cacheHit) {
      stat.hits++;
    } else {
      stat.misses++;
    }
  }

  getAnalysis() {
    const analysis = {};

    for (const [operation, stat] of this.stats) {
      const total = stat.hits + stat.misses;
      const hitRate = (stat.hits / total) * 100;

      analysis[operation] = {
        total,
        hits: stat.hits,
        misses: stat.misses,
        hitRate: hitRate.toFixed(2) + '%',
        recommendation: this.getRecommendation(hitRate, total)
      };
    }

    return analysis;
  }

  getRecommendation(hitRate, count) {
    if (count < 100) {
      return 'Insufficient data (< 100 accesses)';
    }
    if (hitRate > 90) {
      return 'Excellent - Consider increasing TTL';
    }
    if (hitRate > 80) {
      return 'Good - Current configuration optimal';
    }
    if (hitRate > 70) {
      return 'Fair - Consider increasing TTL or cache size';
    }
    return 'Poor - Investigate cache strategy or data volatility';
  }
}
```

---

## Cache Warming

### Startup Cache Warming

```javascript
// Pre-populate cache during application startup
async function warmCache() {
  const logger = winston.createLogger({ defaultMeta: { service: 'cache-warmer' } });

  try {
    logger.info('Starting cache warming...');

    // 1. Warm active agents (frequently accessed)
    logger.info('Warming active agents...');
    const agents = await db.query(
      'SELECT id, name, status, reputation_score FROM agents WHERE is_active = true'
    );
    for (const agent of agents.rows) {
      await cacheManager.set(
        CACHE_KEYS.AGENT(agent.id),
        agent,
        TTL_CONFIG.AGENT_STATE
      );
    }
    logger.info(`Warmed ${agents.rows.length} active agents`);

    // 2. Warm active sessions
    logger.info('Warming active sessions...');
    const sessions = await db.query(
      'SELECT * FROM sessions WHERE expires_at > NOW() LIMIT 10000'
    );
    for (const session of sessions.rows) {
      await cacheManager.set(
        CACHE_KEYS.SESSION(session.id),
        session,
        TTL_CONFIG.SESSION
      );
    }
    logger.info(`Warmed ${sessions.rows.length} active sessions`);

    // 3. Warm leaderboard
    logger.info('Warming leaderboard...');
    const leaderboard = await db.query(`
      SELECT
        id,
        name,
        reputation_score,
        ROW_NUMBER() OVER (ORDER BY reputation_score DESC) as rank
      FROM agents
      WHERE is_active = true
      ORDER BY reputation_score DESC
      LIMIT 100
    `);
    await cacheManager.set(
      CACHE_KEYS.LEADERBOARD('daily'),
      leaderboard.rows,
      TTL_CONFIG.LEADERBOARD
    );
    logger.info('Warmed daily leaderboard');

    // 4. Warm hot query results
    logger.info('Warming hot query results...');
    const hotQueries = [
      {
        key: 'popular-agents',
        query: 'SELECT * FROM agents WHERE reputation_score > 500 ORDER BY reputation_score DESC LIMIT 50',
        ttl: TTL_CONFIG.QUERY_STABLE
      },
      {
        key: 'recent-tasks',
        query: 'SELECT * FROM tasks WHERE created_at > NOW() - INTERVAL 1 hour ORDER BY created_at DESC LIMIT 100',
        ttl: TTL_CONFIG.QUERY_VOLATILE
      }
    ];

    for (const { key, query, ttl } of hotQueries) {
      const result = await db.query(query);
      await cacheManager.set(key, result.rows, ttl);
    }
    logger.info(`Warmed ${hotQueries.length} hot query results`);

    logger.info('Cache warming completed successfully');

  } catch (error) {
    logger.error('Cache warming failed', error);
    throw error;
  }
}

// Run during application startup
export async function initializeApplication() {
  // ... other initialization ...
  await warmCache();
  // ... continue ...
}
```

### Periodic Cache Refresh

```javascript
// Refresh cache for frequently-accessed hot data
async function refreshHotCache() {
  const refreshIntervals = [
    {
      key: CACHE_KEYS.LEADERBOARD('daily'),
      queryFn: () => db.getLeaderboard('daily'),
      interval: 60000  // Every minute
    },
    {
      key: CACHE_KEYS.LEADERBOARD('weekly'),
      queryFn: () => db.getLeaderboard('weekly'),
      interval: 300000  // Every 5 minutes
    },
    {
      key: 'recent-activity',
      queryFn: () => db.getRecentActivity(100),
      interval: 120000  // Every 2 minutes
    }
  ];

  for (const { key, queryFn, interval } of refreshIntervals) {
    setInterval(async () => {
      try {
        const data = await queryFn();
        await cacheManager.set(key, data, getTTLForKey(key));
        logger.debug(`Refreshed cache: ${key}`);
      } catch (error) {
        logger.warn(`Cache refresh failed for ${key}`, error);
      }
    }, interval);
  }
}

// Start periodic refresh
refreshHotCache();
```

---

## Advanced Patterns

### Cache-Aside Pattern with Write-Through

```javascript
// Cache-Aside (Lazy) - Read from cache, load from DB if missing
async function readWithCacheAside(key, queryFn, ttl) {
  // Try cache
  let data = await cacheManager.get(key);
  if (data) return data;

  // Cache miss - load from database
  data = await queryFn();

  // Populate cache
  if (data) {
    await cacheManager.set(key, data, ttl);
  }

  return data;
}

// Write-Through Pattern - Write to cache AND database
async function writeThrough(key, data, writeFn, ttl) {
  // Write to database first
  const result = await writeFn(data);

  // Then update cache
  await cacheManager.set(key, result, ttl);

  return result;
}

// Write-Behind Pattern (Async write to database)
async function writeBehind(key, data, writeFn, ttl) {
  // Update cache immediately
  await cacheManager.set(key, data, ttl);

  // Asynchronously write to database
  setImmediate(async () => {
    try {
      await writeFn(data);
    } catch (error) {
      logger.error('Write-behind failed', error);
      // Could implement retry logic here
    }
  });

  return data;
}
```

### Distributed Locking

```javascript
// Implement distributed locking with Redis
class DistributedLock {
  constructor(redis, lockKey, ttl = 30000) {
    this.redis = redis;
    this.lockKey = lockKey;
    this.ttl = ttl;
    this.lockValue = `${Date.now()}-${Math.random()}`;
  }

  async acquire() {
    const acquired = await this.redis.set(
      this.lockKey,
      this.lockValue,
      'PX',
      this.ttl,
      'NX'  // Only set if not exists
    );

    return acquired === 'OK';
  }

  async release() {
    // Only delete if value matches (prevent deleting other's locks)
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    return this.redis.eval(luaScript, 1, this.lockKey, this.lockValue);
  }

  async executeWithLock(fn) {
    const startTime = Date.now();
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      if (await this.acquire()) {
        try {
          return await fn();
        } finally {
          await this.release();
        }
      }

      retries++;
      // Exponential backoff
      await new Promise(resolve =>
        setTimeout(resolve, Math.min(100 * Math.pow(2, retries), 5000))
      );
    }

    throw new Error(`Could not acquire lock after ${maxRetries} retries`);
  }
}

// Usage
const lock = new DistributedLock(redis, 'resource:important-operation', 30000);
await lock.executeWithLock(async () => {
  // Only one process can execute this at a time
  await performCriticalOperation();
});
```

### Bloom Filters for Cache Efficiency

```javascript
// Use Bloom filter to reduce cache misses for non-existent keys
// Prevents cache lookups for keys that definitely don't exist

const BloomFilter = require('bloom-filters').BloomFilter;

class SmartCache {
  constructor(redis, bloomSize = 100000) {
    this.redis = redis;
    this.bloomFilter = BloomFilter.create(bloomSize, 4);  // 4 hash functions
  }

  async get(key) {
    // Check if key might exist
    if (!this.bloomFilter.has(key)) {
      // Definitely doesn't exist, don't check cache
      return null;
    }

    // Might exist, check Redis
    return await this.redis.get(key);
  }

  async set(key, value, ttl) {
    // Add to Bloom filter
    this.bloomFilter.add(key);

    // Store in Redis
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  }
}
```

---

**Document Version:** 1.0.0
**Last Updated:** November 2024
**Owner:** Cache Performance Team
