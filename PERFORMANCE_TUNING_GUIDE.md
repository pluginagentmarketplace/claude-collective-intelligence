# Enterprise Performance Tuning Guide
## AI Agent Orchestration System - Comprehensive Optimization Strategy

**Version:** 1.0.0
**Last Updated:** November 2024
**Target Audience:** DevOps, Database Administrators, Performance Engineers
**Scope:** Production optimization for RabbitMQ, PostgreSQL, Redis, and Node.js stack

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Performance Baseline & Metrics](#performance-baseline--metrics)
3. [System Architecture Overview](#system-architecture-overview)
4. [Database Optimization Strategy](#database-optimization-strategy)
5. [Caching Optimization](#caching-optimization)
6. [API Performance Optimization](#api-performance-optimization)
7. [Memory & CPU Tuning](#memory--cpu-tuning)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Performance Benchmarking](#performance-benchmarking)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Quick Reference](#quick-reference)

---

## Executive Summary

This guide provides enterprise-grade performance optimization strategies for the AI Agent Orchestration System. The system processes distributed tasks through a multi-agent architecture using:

- **Message Queue:** RabbitMQ for task distribution
- **Database:** PostgreSQL for persistent storage
- **Cache:** Redis for session management and query results
- **Runtime:** Node.js with Winston logging

### Key Performance Goals

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API Response Time (p99) | <500ms | TBD | TBD |
| Database Query Time (p99) | <100ms | TBD | TBD |
| Cache Hit Ratio | >85% | TBD | TBD |
| Message Throughput | >1000 msg/sec | TBD | TBD |
| System Availability | 99.9% | TBD | TBD |

---

## Performance Baseline & Metrics

### Essential Metrics to Track

#### 1. Response Time Metrics
```
- API endpoint response times (by endpoint)
- Database query execution time
- Cache lookup time
- Message processing time
- Network latency
```

#### 2. Throughput Metrics
```
- Requests per second (RPS)
- Messages processed per second
- Database transactions per second
- Cache operations per second
```

#### 3. Resource Metrics
```
- CPU utilization (by process)
- Memory usage (by process)
- Disk I/O operations
- Network bandwidth
- Connection pool usage
```

#### 4. Cache Metrics
```
- Cache hit rate
- Cache miss rate
- Average cache lookup time
- Memory fragmentation ratio
```

#### 5. Database Metrics
```
- Query execution time distribution
- Slow query count (>100ms)
- Deadlock frequency
- Connection pool saturation
- Index usage statistics
```

### Metric Collection Points

#### PostgreSQL Metrics
```sql
-- Query performance statistics
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time,
    total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 10
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Connection statistics
SELECT
    datname,
    count(*) as connections,
    max(query_duration) as max_query_duration
FROM pg_stat_activity
GROUP BY datname;
```

#### Redis Metrics
```bash
# Get comprehensive statistics
redis-cli INFO all

# Key memory analysis
redis-cli --bigkeys

# Slow command analysis
redis-cli SLOWLOG GET 10

# Memory fragmentation
redis-cli INFO memory
```

---

## System Architecture Overview

### Component Interaction Flow

```
┌─────────────────────────────────────────────────────┐
│                  External Clients                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              API Layer (Node.js)                     │
│        - Express.js handlers                        │
│        - Rate limiting (50 req/sec per user)        │
│        - Request/Response compression               │
└────────┬─────────────────────────────────┬──────────┘
         │                                 │
    ┌────▼────┐                     ┌──────▼──────┐
    │          │                     │             │
    ▼          ▼                     ▼             ▼
┌─────────┐ ┌──────────┐      ┌──────────────┐ ┌─────────┐
│PostgreSQL│ │RabbitMQ  │      │   Redis L1   │ │Winston  │
│Database  │ │  Queue   │      │   Cache      │ │Logging  │
│(Primary) │ │(100s/sec)│      │(100,000 keys)│ │         │
└─────────┘ └──────────┘      └──────────────┘ └─────────┘
    │            │                   │
    └────┬───────┴───────────────────┘
         │
    ┌────▼──────────┐
    │  Distributed  │
    │    Agents     │
    │  (7 agents)   │
    └───────────────┘
```

### Current Bottlenecks (Typical)

1. **N+1 Query Problem** - Agent queries causing multiple DB hits
2. **Connection Pool Exhaustion** - Under load, pool becomes saturated
3. **Cache Invalidation Overhead** - Complex invalidation logic
4. **Logging Overhead** - Winston logging can add 5-10% overhead
5. **Message Queue Serialization** - JSON serialization overhead

---

## Database Optimization Strategy

### Connection Pool Tuning

The connection pool is critical for performance. Current configuration in `src/db/connection-pool.js`:

```javascript
// CURRENT SETTINGS (from code review)
max_connections_per_pool: 20        // PostgreSQL pool size
command_timeout: 5000               // Command timeout in ms
connect_timeout: 10000              // Connection timeout in ms
health_check_interval: 30000        // Health check every 30s
```

#### Recommended Configuration by Load

**Development Environment:**
```javascript
max: 5,
min: 2,
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 5000,
statement_timeout: 10000,
query_timeout: 30000
```

**Staging Environment:**
```javascript
max: 20,
min: 5,
idleTimeoutMillis: 60000,
connectionTimeoutMillis: 5000,
statement_timeout: 5000,
query_timeout: 20000
```

**Production Environment:**
```javascript
max: 50,
min: 10,
idleTimeoutMillis: 120000,
connectionTimeoutMillis: 3000,
statement_timeout: 3000,
query_timeout: 15000
```

#### Calculate Optimal Pool Size

The ideal pool size formula:
```
pool_size = (core_count * 2) + effective_spindle_count

For AI Agent System:
- If running on 8-core CPU: (8 * 2) + 2 = 18 connections
- If running on 16-core CPU: (16 * 2) + 2 = 34 connections
- Recommended production: 40-50 for multi-server setup
```

### Query Optimization Techniques

#### 1. Index Strategy

**Essential Indexes (MUST HAVE):**
```sql
-- Task table indexes
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_agent_status ON tasks(agent_id, status);

-- Agent table indexes
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_active ON agents(is_active);
CREATE INDEX idx_agents_created_at ON agents(created_at DESC);

-- User table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Session table indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);

-- Voting table indexes
CREATE INDEX idx_votes_agent_id ON votes(agent_id);
CREATE INDEX idx_votes_round_id ON votes(round_id);
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);
```

**Composite Indexes (HIGH VALUE):**
```sql
-- For filtered queries with sorting
CREATE INDEX idx_tasks_agent_status_date ON tasks(agent_id, status, created_at DESC);

-- For leaderboard queries
CREATE INDEX idx_agents_score_rank ON agents(reputation_score DESC, created_at);

-- For session queries
CREATE INDEX idx_sessions_user_expires ON sessions(user_id, expires_at DESC);

-- For vote aggregation
CREATE INDEX idx_votes_round_agent ON votes(round_id, agent_id);
```

**Partial Indexes (SPACE EFFICIENT):**
```sql
-- Only index active agents
CREATE INDEX idx_active_agents ON agents(status)
WHERE is_active = true;

-- Only index recent tasks
CREATE INDEX idx_recent_tasks ON tasks(agent_id, status)
WHERE created_at > NOW() - INTERVAL '30 days';

-- Only index non-expired sessions
CREATE INDEX idx_valid_sessions ON sessions(user_id)
WHERE expires_at > NOW();
```

#### 2. Query Analysis with EXPLAIN

**EXPLAIN ANALYZE Format:**
```sql
EXPLAIN (ANALYZE, BUFFERS, TIMING, VERBOSE)
SELECT * FROM tasks
WHERE agent_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT 10;
```

**What to Look For:**
- **Seq Scan** (bad) vs **Index Scan** (good)
- **Actual Rows** matching **Planned Rows** (discrepancy = bad stats)
- **Buffers** hits vs **Backend Reads** (high reads = slow)
- **Planning Time + Execution Time** (both should be <100ms)

**Example Good EXPLAIN Output:**
```
Index Scan using idx_tasks_agent_status_date on tasks  (cost=0.42..10.15 rows=5 width=100)
  Index Cond: ((agent_id = 1) AND (status = 'processing'))
  Buffers: shared hit=3
  Planning Time: 0.102 ms
  Execution Time: 0.234 ms
```

**Example Bad EXPLAIN Output:**
```
Seq Scan on tasks  (cost=0.00..50000.00 rows=100000 width=100)
  Filter: ((agent_id = 1) AND (status = 'processing'))
  Buffers: shared hit=1000 read=500
  Planning Time: 0.502 ms
  Execution Time: 5234.234 ms  <-- TOO SLOW
```

#### 3. Query Optimization Examples

**BEFORE - N+1 Problem:**
```javascript
// SLOW: Makes N+1 queries (1 for agents + N for each agent's tasks)
const agents = await db.query('SELECT * FROM agents LIMIT 10');
const agentsWithTasks = await Promise.all(
  agents.map(agent =>
    db.query('SELECT * FROM tasks WHERE agent_id = $1', [agent.id])
  )
);
```

**AFTER - Single Join Query:**
```javascript
// FAST: Single query with join
const result = await db.query(`
  SELECT
    a.id, a.name, a.status,
    json_agg(json_build_object('id', t.id, 'status', t.status)) as tasks
  FROM agents a
  LEFT JOIN tasks t ON a.id = t.agent_id
  WHERE a.limit = $1
  GROUP BY a.id
`, [10]);
```

**BEFORE - Missing WHERE Clause:**
```javascript
// SLOW: Retrieves all rows then filters in application
const allTasks = await db.query('SELECT * FROM tasks');
const activeTasks = allTasks.filter(t => t.status === 'active');
```

**AFTER - Filter in Database:**
```javascript
// FAST: Database handles filtering
const activeTasks = await db.query(
  'SELECT * FROM tasks WHERE status = $1',
  ['active']
);
```

**BEFORE - Inefficient Sorting:**
```javascript
// SLOW: Sorting in application memory
const tasks = await db.query('SELECT * FROM tasks');
const sorted = tasks.sort((a, b) => b.created_at - a.created_at);
```

**AFTER - Index-Backed Sorting:**
```javascript
// FAST: Index handles sorting
const tasks = await db.query(
  'SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100'
);
```

#### 4. Slow Query Log Analysis

Enable PostgreSQL slow query logging:
```sql
-- PostgreSQL configuration
log_min_duration_statement = 100  -- Log queries > 100ms
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_connections = on
log_disconnections = on
log_statement = 'mod'  -- Log DML (SELECT, INSERT, UPDATE, DELETE)

-- View slow queries
SELECT
    query,
    calls,
    mean_exec_time::decimal(10, 2) as mean_ms,
    max_exec_time::decimal(10, 2) as max_ms,
    stddev_exec_time::decimal(10, 2) as stddev_ms
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Partitioning Strategy

For large tables (>100GB), implement partitioning:

**Range Partitioning on Tasks Table (by date):**
```sql
CREATE TABLE tasks_partition (
    id uuid PRIMARY KEY,
    agent_id uuid,
    status text,
    created_at timestamp,
    data jsonb
) PARTITION BY RANGE (created_at);

CREATE TABLE tasks_2024_q1 PARTITION OF tasks_partition
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE tasks_2024_q2 PARTITION OF tasks_partition
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

-- Index each partition
CREATE INDEX idx_tasks_2024_q1_agent
ON tasks_2024_q1(agent_id, status);
```

**List Partitioning on Agents Table (by status):**
```sql
CREATE TABLE agents_partition (
    id uuid PRIMARY KEY,
    status text,
    reputation_score integer
) PARTITION BY LIST (status);

CREATE TABLE agents_active PARTITION OF agents_partition
    FOR VALUES IN ('active', 'processing');

CREATE TABLE agents_inactive PARTITION OF agents_partition
    FOR VALUES IN ('inactive', 'paused');
```

### Vacuum & Analyze Strategy

PostgreSQL maintenance is critical for performance:

```sql
-- Vacuum (reclaim disk space)
-- Full vacuum (exclusive lock - run during maintenance window)
VACUUM FULL ANALYZE;

-- Regular vacuum (online, minimal locking)
VACUUM ANALYZE;

-- Aggressive vacuum for high-update tables
VACUUM (ANALYZE, VERBOSE) tasks;

-- Auto-vacuum tuning (in postgresql.conf)
autovacuum = on
autovacuum_naptime = '10s'  -- Check every 10 seconds
autovacuum_vacuum_threshold = 50  -- Run vacuum after 50 changes
autovacuum_analyze_threshold = 50  -- Run analyze after 50 changes
autovacuum_vacuum_scale_factor = 0.05  -- 5% of table size
autovacuum_analyze_scale_factor = 0.02  -- 2% of table size
```

---

## Caching Optimization

### Redis Memory Strategy

Current Redis configuration limits memory to 512MB. Optimize based on data patterns:

#### Memory Usage Calculation

```
Estimated Memory = (Average Key Size + Average Value Size) × Number of Keys

For Agent System:
- Session keys: 100 bytes × 10,000 sessions = 1 MB
- Cache keys: 256 bytes × 50,000 queries = 12.8 MB
- Lock keys: 50 bytes × 1,000 locks = 50 KB
- Metrics: 256 bytes × 100,000 metrics = 25.6 MB
- Total estimated: ~40 MB for normal operations
```

#### Memory Optimization Techniques

**1. Key Compression:**
```javascript
// INEFFICIENT: Large keys
cache:query:full_long_hash_value:with_params:...  // 100+ bytes

// EFFICIENT: Compressed keys
q:fgh7d8f9g8d7f8:p:123,456  // 30 bytes
c:agents:123:metrics       // 20 bytes
s:usr:abc:data            // 18 bytes
```

**2. Value Serialization:**
```javascript
// INEFFICIENT: JSON string storage
await redis.set('agent:state:123', JSON.stringify(largeObject));  // 5KB

// EFFICIENT: Compressed JSON or MessagePack
const packed = msgpack.encode(largeObject);  // 2KB
await redis.set('agent:state:123', packed);
```

**3. Data Structure Selection:**
```javascript
// Instead of STRING with JSON (uses more memory)
// { userId: "123", count: 5 } = 25 bytes string

// Use HASH (more efficient)
redis.hset('user:123', 'count', 5);  // 15 bytes

// Instead of SET with JSON array
// ["item1", "item2", "item3"] = 30 bytes string

// Use native SET
redis.sadd('items', 'item1', 'item2', 'item3');  // 20 bytes
```

### Cache Key Strategy

Implement hierarchical cache keys for easy invalidation:

```javascript
// Cache key patterns
const CACHE_KEYS = {
  // Resource caches
  USER: (userId) => `u:${userId}`,
  AGENT: (agentId) => `ag:${agentId}`,
  TASK: (taskId) => `t:${taskId}`,
  SESSION: (sessionId) => `s:${sessionId}`,

  // Computed caches
  AGENT_STATS: (agentId) => `stats:ag:${agentId}`,
  LEADERBOARD: (period) => `lb:${period}`,
  USER_TASKS: (userId) => `ut:${userId}`,

  // Query results
  QUERY_RESULT: (queryHash) => `q:${queryHash}`,

  // Distributed locks
  LOCK: (resource) => `lock:${resource}`,

  // Rate limits
  RATE_LIMIT: (userId, action) => `rl:${userId}:${action}`
};

// Usage
await redis.set(CACHE_KEYS.USER('123'), userData, 'EX', 3600);
await redis.get(CACHE_KEYS.USER('123'));
```

### TTL Optimization

Optimize TTL based on data change frequency:

```javascript
// TTL Configuration
const TTL = {
  // User/Session data (frequently accessed, rarely changes)
  USER_PROFILE: 3600,         // 1 hour
  SESSION: 1800,              // 30 minutes

  // Agent state (changes frequently)
  AGENT_STATE: 300,           // 5 minutes
  AGENT_METRICS: 60,          // 1 minute

  // Query results (depends on query volatility)
  QUERY_RESULT: 600,          // 10 minutes (configurable per query)
  TASK_RESULT: 86400,         // 24 hours (immutable)

  // Distributed locks
  LOCK: 30,                   // 30 seconds (must be short)

  // Rate limits
  RATE_LIMIT: 60,             // 1 minute

  // Leaderboards (updated periodically)
  LEADERBOARD: 3600           // 1 hour
};

// Dynamic TTL based on data freshness
function calculateTTL(dataType, lastModified) {
  const now = Date.now();
  const age = (now - lastModified) / 1000;  // seconds

  if (age < 60) {
    return 300;      // 5 minutes - recently modified
  } else if (age < 3600) {
    return 1800;     // 30 minutes - modified within hour
  } else {
    return 3600;     // 1 hour - older data
  }
}
```

### Cache Hit/Miss Analysis

Monitor and optimize cache effectiveness:

```javascript
// Track cache metrics
class CacheMetrics {
  constructor() {
    this.hits = 0;
    this.misses = 0;
    this.deletes = 0;
  }

  recordHit() {
    this.hits++;
  }

  recordMiss() {
    this.misses++;
  }

  getHitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : (this.hits / total) * 100;
  }

  getMetrics() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      totalRequests: this.hits + this.misses,
      evictionRate: this.deletes / (this.hits + this.misses)
    };
  }
}

// Target metrics:
// - Hit Rate: > 85%
// - Miss Rate: < 15%
// - Eviction Rate: < 5%
```

### L1/L2 Cache Configuration

Implement multi-level caching:

```javascript
// L1: In-memory LRU cache (ultra-fast, limited size)
const l1Cache = new LRUCache({
  max: 1000,                  // 1000 items max
  maxAge: 5 * 60 * 1000,      // 5 minutes
  maxSize: 50 * 1024 * 1024   // 50MB
});

// L2: Redis (fast, persistent)
const l2Cache = redis;

// L3: Database (slow, source of truth)
const l3Store = postgres;

async function getWithFallback(key, fetchFn) {
  // Try L1
  let data = l1Cache.get(key);
  if (data) {
    metrics.recordL1Hit();
    return data;
  }

  // Try L2
  data = await l2Cache.get(key);
  if (data) {
    metrics.recordL2Hit();
    l1Cache.set(key, data);  // Populate L1
    return data;
  }

  // Fetch from L3
  metrics.recordMiss();
  data = await fetchFn();

  // Populate both L1 and L2
  l1Cache.set(key, data);
  await l2Cache.set(key, data, 'EX', 600);

  return data;
}
```

### Cache Invalidation Strategies

Implement efficient cache invalidation:

**Pattern 1: Time-Based Invalidation (Simplest)**
```javascript
// Automatically expires via TTL - no manual invalidation needed
// Use for: Non-critical data, frequently changing data
// TTL: 5-60 minutes
await redis.set(key, value, 'EX', 300);
```

**Pattern 2: Tag-Based Invalidation (Most Flexible)**
```javascript
// Tag-based invalidation strategy
async function cacheWithTags(key, value, tags, ttl) {
  // Store value
  await redis.set(key, value, 'EX', ttl);

  // Store tags for invalidation
  for (const tag of tags) {
    await redis.sadd(`tag:${tag}`, key);
  }
}

async function invalidateByTag(tag) {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.del(`tag:${tag}`);
}

// Usage
cacheWithTags(
  'user:123:tasks',
  userData,
  ['user:123', 'tasks', 'user-data'],
  3600
);

// Invalidate when user is updated
invalidateByTag('user:123');
```

**Pattern 3: Event-Based Invalidation (Real-time)**
```javascript
// Invalidate on database changes
async function updateTask(taskId, updates) {
  // Update database
  const task = await db.updateTask(taskId, updates);

  // Emit invalidation event
  eventEmitter.emit('task:updated', { taskId, task });

  // Invalidate related caches
  await redis.del(`task:${taskId}`);
  await redis.del(`tasks:agent:${task.agentId}`);
  await invalidateByTag(`agent:${task.agentId}`);
}

// Listen for invalidation
eventEmitter.on('task:updated', async (event) => {
  // Invalidate related caches
  await invalidateByTag(`tasks:agent:${event.task.agentId}`);
});
```

### Cache Warming Procedures

Pre-populate cache for better performance:

```javascript
async function warmCache() {
  const logger = winston.createLogger({ defaultMeta: { service: 'cache-warmer' } });

  try {
    // Warm user sessions
    logger.info('Warming user sessions...');
    const activeSessions = await db.query(
      'SELECT * FROM sessions WHERE expires_at > NOW()'
    );
    for (const session of activeSessions.rows) {
      await redis.set(
        CACHE_KEYS.SESSION(session.id),
        session,
        'EX',
        3600
      );
    }
    logger.info(`Warmed ${activeSessions.rows.length} sessions`);

    // Warm active agents
    logger.info('Warming active agents...');
    const agents = await db.query(
      'SELECT * FROM agents WHERE status = $1',
      ['active']
    );
    for (const agent of agents.rows) {
      await redis.set(
        CACHE_KEYS.AGENT(agent.id),
        agent,
        'EX',
        300
      );
    }
    logger.info(`Warmed ${agents.rows.length} agents`);

    // Warm leaderboard
    logger.info('Warming leaderboard...');
    const leaderboard = await db.query(
      'SELECT * FROM agents ORDER BY reputation_score DESC LIMIT 100'
    );
    await redis.set(
      CACHE_KEYS.LEADERBOARD('monthly'),
      leaderboard.rows,
      'EX',
      3600
    );
    logger.info('Leaderboard warmed');

  } catch (error) {
    logger.error('Cache warming failed', error);
    throw error;
  }
}

// Run during application startup
await warmCache();
```

---

## API Performance Optimization

### Response Time Optimization

#### 1. Payload Size Reduction

**BEFORE - Returning full objects:**
```javascript
// 5KB per response
app.get('/api/agents/:id', async (req, res) => {
  const agent = await db.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
  res.json(agent);
  // Returns: 100+ fields per agent
});
```

**AFTER - Returning only needed fields:**
```javascript
// 500 bytes per response (90% reduction)
app.get('/api/agents/:id', async (req, res) => {
  const agent = await db.query(
    'SELECT id, name, status, reputation_score FROM agents WHERE id = $1',
    [req.params.id]
  );
  res.json(agent);
});

// Or use field selection
app.get('/api/agents/:id', async (req, res) => {
  const fields = req.query.fields ? req.query.fields.split(',') : ['id', 'name', 'status'];
  const selectClause = fields.join(', ');
  const agent = await db.query(
    `SELECT ${selectClause} FROM agents WHERE id = $1`,
    [req.params.id]
  );
  res.json(agent);
});
```

#### 2. Compression Strategy

```javascript
const compression = require('compression');

// Enable compression with optimization
app.use(compression({
  level: 6,           // Balance: 6 is optimal (1-9)
  threshold: 1024,    // Only compress > 1KB
  filter: (req, res) => {
    // Don't compress streaming responses
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Manual compression for large responses
app.get('/api/leaderboard', async (req, res) => {
  const data = await db.getLeaderboard();

  // Compress large payloads
  if (data.length > 10000) {
    res.set('Content-Encoding', 'gzip');
    const compressed = zlib.gzipSync(JSON.stringify(data));
    res.send(compressed);
  } else {
    res.json(data);
  }
});
```

#### 3. Pagination Optimization

```javascript
// Efficient cursor-based pagination
app.get('/api/tasks', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || 20), 100);  // Max 100
  const cursor = req.query.cursor;

  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  // Use cursor for pagination
  if (cursor) {
    query += ` AND id > $${paramIndex}`;
    params.push(cursor);
    paramIndex++;
  }

  query += ` ORDER BY id ASC LIMIT $${paramIndex}`;
  params.push(limit + 1);

  const result = await db.query(query, params);

  const hasMore = result.rows.length > limit;
  const data = result.rows.slice(0, limit);
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  res.json({
    data,
    pagination: {
      cursor: nextCursor,
      hasMore
    }
  });
});

// Offset-based pagination (less efficient for large datasets)
// Use only if data size < 1 million rows
app.get('/api/tasks-offset', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || 1));
  const limit = Math.min(parseInt(req.query.limit || 20), 100);
  const offset = (page - 1) * limit;

  const [data, count] = await Promise.all([
    db.query('SELECT * FROM tasks ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
    db.query('SELECT COUNT(*) FROM tasks')
  ]);

  res.json({
    data: data.rows,
    pagination: {
      page,
      pageSize: limit,
      totalRecords: count.rows[0].count,
      totalPages: Math.ceil(count.rows[0].count / limit)
    }
  });
});
```

### Database Query Optimization

#### 1. N+1 Problem Detection

```javascript
// Enable query logging to detect N+1
class QueryLogger {
  constructor() {
    this.queries = [];
    this.callStack = {};
  }

  logQuery(query, params, duration) {
    const stack = new Error().stack.split('\n')[2].trim();
    this.queries.push({ query, params, duration, stack });

    if (!this.callStack[stack]) {
      this.callStack[stack] = 0;
    }
    this.callStack[stack]++;
  }

  detectNPlus1() {
    const suspicious = Object.entries(this.callStack)
      .filter(([_, count]) => count > 10)
      .map(([stack, count]) => ({ stack, count }));

    return suspicious;
  }
}

// Middleware to detect N+1
app.use((req, res, next) => {
  const queryLogger = new QueryLogger();
  req.queryLogger = queryLogger;

  res.on('finish', () => {
    const issues = queryLogger.detectNPlus1();
    if (issues.length > 0) {
      logger.warn('Potential N+1 detected', issues);
    }
  });

  next();
});
```

#### 2. Connection Pooling Tuning

```javascript
// Monitor connection pool usage
setInterval(async () => {
  const stats = connectionPool.getStats();

  if (stats.postgres) {
    const usage = (stats.postgres.totalConnectionCount / stats.postgres.max) * 100;

    if (usage > 80) {
      logger.warn('Connection pool near exhaustion', { usage: `${usage}%` });
    }
  }
}, 60000);

// Implement connection timeout handling
const executeWithTimeout = async (query, params, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    try {
      const result = db.query(query, params);
      clearTimeout(timer);
      resolve(result);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
};
```

#### 3. Batch Operations

```javascript
// Instead of multiple individual inserts
async function insertTasksInefficient(tasks) {
  const results = [];
  for (const task of tasks) {
    const result = await db.query(
      'INSERT INTO tasks (agent_id, status, data) VALUES ($1, $2, $3)',
      [task.agentId, task.status, task.data]
    );
    results.push(result);
  }
  return results;
}

// Use batch insert
async function insertTasksEfficient(tasks) {
  const query = `
    INSERT INTO tasks (agent_id, status, data) VALUES
    ${tasks.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ')}
    RETURNING *
  `;

  const params = tasks.flatMap(t => [t.agentId, t.status, t.data]);
  return db.query(query, params);
}

// Performance comparison:
// - Individual: 1000 inserts = 5000ms
// - Batch: 1000 inserts = 50ms (100x faster)
```

### Connection Pooling Best Practices

```javascript
// Configure connection pool correctly
const pool = new Pool({
  // Connection limits
  max: 50,           // Max connections
  min: 10,           // Min connections to maintain

  // Timeouts
  idleTimeoutMillis: 120000,      // Close idle after 2 min
  connectionTimeoutMillis: 5000,  // Connect timeout
  statement_timeout: 5000,        // Query timeout

  // Query configuration
  query_timeout: 15000,

  // SSL for production
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Monitor pool health
pool.on('error', (err, client) => {
  logger.error('Pool error', err);
});

pool.on('connect', () => {
  logger.debug('New connection established');
});

// Graceful pool shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
```

---

## Memory & CPU Tuning

### Node.js Memory Optimization

```javascript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  const metrics = {
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`
  };

  if (usage.heapUsed > usage.heapTotal * 0.9) {
    logger.warn('Heap memory critical', metrics);
  }
}, 30000);

// Set appropriate heap sizes (in Node.js startup)
// node --max-old-space-size=4096 app.js  // 4GB heap
```

### CPU Optimization

```javascript
// Implement request queuing to prevent CPU overload
const pQueue = require('p-queue');

const queue = new pQueue({
  concurrency: os.cpus().length * 2  // CPU cores * 2
});

// Route heavy operations through queue
app.post('/api/complex-operation', async (req, res) => {
  try {
    const result = await queue.add(() => complexOperation(req.body));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

```javascript
// Prometheus metrics export
const prometheus = require('prom-client');

// Create custom metrics
const httpDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const dbQueryDuration = new prometheus.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1]
});

const cacheHitRate = new prometheus.Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type']
});

// Middleware to capture metrics
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
  });

  next();
});

// Export metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

### Alert Thresholds

```yaml
# Prometheus alert rules (prometheus.yml)
- name: Performance
  rules:
    - alert: HighResponseTime
      expr: http_request_duration_seconds{quantile="0.99"} > 0.5
      for: 5m
      annotations:
        summary: "API response time exceeds 500ms"

    - alert: LowCacheHitRate
      expr: cache_hit_rate < 0.80
      for: 10m
      annotations:
        summary: "Cache hit rate below 80%"

    - alert: SlowDatabaseQueries
      expr: db_query_duration_seconds{quantile="0.99"} > 0.1
      for: 5m
      annotations:
        summary: "Database query p99 exceeds 100ms"

    - alert: ConnectionPoolExhaustion
      expr: db_connection_pool_usage > 0.8
      for: 2m
      annotations:
        summary: "Database connection pool usage above 80%"
```

---

## Performance Benchmarking

### Load Testing with K6

See `k6-scripts/load-test.js` for detailed load testing configuration.

Key load test scenarios:
- **Smoke Test:** 2 users, 1 minute
- **Load Test:** 100 users, 10 minutes
- **Stress Test:** 500 users, escalating to max
- **Soak Test:** 50 users, 24+ hours

### Benchmark Tools

```bash
# ApacheBench (for simple tests)
ab -n 1000 -c 100 http://localhost:3000/api/agents

# wrk (for sustained load)
wrk -t12 -c400 -d30s http://localhost:3000/api/agents

# K6 (for detailed scenario testing)
k6 run k6-scripts/load-test.js

# pgBench (for database performance)
pgbench -c 10 -j 2 -T 300 -M extended database_name
```

---

## Troubleshooting Guide

### Common Performance Issues & Solutions

#### Issue 1: High CPU Usage

**Symptoms:**
- CPU usage > 80% constantly
- Response times degrading

**Diagnosis:**
```bash
# Check which process consuming CPU
top -o %CPU

# Check Node.js CPU profile
node --prof app.js
node --prof-process isolate-*.log | head -50
```

**Solutions:**
1. Reduce request concurrency with queue
2. Optimize algorithm complexity
3. Implement caching
4. Add more CPU resources

#### Issue 2: Memory Leak

**Symptoms:**
- Memory usage constantly increasing
- Heap grows even during idle time
- Service crashes after 24+ hours

**Diagnosis:**
```bash
# Enable memory debugging
node --inspect app.js

# Use heapdump module
const heapdump = require('heapdump');
heapdump.writeSnapshot(`./heap-${Date.now()}.heapsnapshot`);
```

**Solutions:**
1. Check for circular references
2. Ensure all timers/intervals cleared
3. Verify stream cleanup
4. Check for unbounded cache growth

#### Issue 3: Database Connection Pool Exhaustion

**Symptoms:**
```
Error: Error: no more connections available in the pool
```

**Diagnosis:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- See what's holding connections
SELECT pid, usename, application_name, state, query
FROM pg_stat_activity
WHERE state != 'idle';
```

**Solutions:**
1. Increase pool size
2. Reduce query execution time
3. Implement connection timeout
4. Use connection read replicas

#### Issue 4: Slow Cache Operations

**Symptoms:**
- Redis operations taking >100ms
- Memory fragmentation high

**Diagnosis:**
```bash
# Check Redis stats
redis-cli INFO memory

# Analyze keys
redis-cli --bigkeys

# Check slow log
redis-cli SLOWLOG GET 10
```

**Solutions:**
1. Implement eviction policy
2. Defragment Redis memory
3. Use cluster for sharding
4. Reduce key size/complexity

---

## Quick Reference

### Configuration Checklists

#### PostgreSQL Production Configuration
```sql
-- Connection limits
max_connections = 200
idle_in_transaction_session_timeout = 600000  -- 10 minutes

-- Query optimization
jit = on                              -- Enable JIT compilation
work_mem = 64MB                       -- Memory per operation
shared_buffers = 1GB                  -- Shared cache
effective_cache_size = 4GB            -- Estimated cache

-- Logging
log_min_duration_statement = 100      -- Log slow queries
log_connections = on
log_disconnections = on

-- Maintenance
autovacuum = on
autovacuum_naptime = 10s
maintenance_work_mem = 512MB
```

#### Redis Production Configuration
```
maxmemory 2gb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
slowlog-log-slower-than 10000
timeout 300
```

#### Node.js Production Environment
```bash
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096 --enable-source-maps"
LOG_LEVEL=warn
DB_POOL_SIZE=50
REDIS_MAX_RETRIES=3
```

### Performance Checklist

- [ ] Indexes created on all frequent query columns
- [ ] N+1 queries eliminated
- [ ] API response payloads < 1MB
- [ ] Cache hit rate > 85%
- [ ] Response time p99 < 500ms
- [ ] Database query p99 < 100ms
- [ ] Connection pool utilization < 80%
- [ ] Memory usage stable (no leaks)
- [ ] Logging overhead < 5%
- [ ] Slow query monitoring enabled
- [ ] Connection timeout configured
- [ ] Compression enabled for responses
- [ ] Pagination implemented
- [ ] Cache warming on startup
- [ ] Monitoring/alerting configured

---

## Appendix: Scripts Reference

See accompanying scripts for implementation:
- `scripts/analyze-slow-queries.sh` - Detect and analyze slow queries
- `scripts/optimize-indexes.sh` - Create and optimize database indexes
- `scripts/tune-cache.sh` - Analyze and optimize cache performance
- `scripts/benchmark-performance.sh` - Run comprehensive benchmarks

---

**Document Version:** 1.0.0
**Last Updated:** November 2024
**Review Date:** Quarterly
**Owner:** Platform Performance Team
