# Query Optimization Guide
## PostgreSQL Performance Tuning for AI Agent System

**Version:** 1.0.0
**Last Updated:** November 2024

---

## Table of Contents

1. [Index Strategy](#index-strategy)
2. [Query Optimization Examples](#query-optimization-examples)
3. [EXPLAIN Analysis Guide](#explain-analysis-guide)
4. [Slow Query Detection](#slow-query-detection)
5. [Query Patterns & Anti-Patterns](#query-patterns--anti-patterns)
6. [Query Performance Baseline](#query-performance-baseline)

---

## Index Strategy

### Critical Indexes for Agent System

#### Agent-Related Tables

```sql
-- agents table - Core performance indexes
CREATE INDEX idx_agents_status ON agents(status)
  TABLESPACE pg_default;

CREATE INDEX idx_agents_active ON agents(is_active)
  TABLESPACE pg_default;

CREATE INDEX idx_agents_created_at ON agents(created_at DESC)
  TABLESPACE pg_default;

-- Composite index for common filtered queries
CREATE INDEX idx_agents_status_active ON agents(status, is_active)
  TABLESPACE pg_default;

-- Index for leaderboard queries
CREATE INDEX idx_agents_reputation ON agents(reputation_score DESC NULLS LAST)
  TABLESPACE pg_default;

-- Partial index for active agents only (saves space)
CREATE INDEX idx_active_agents ON agents(id)
  WHERE is_active = true
  TABLESPACE pg_default;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'agents'
ORDER BY idx_scan DESC;
```

#### Task-Related Tables

```sql
-- tasks table - Most frequently queried
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id)
  TABLESPACE pg_default;

CREATE INDEX idx_tasks_status ON tasks(status)
  TABLESPACE pg_default;

CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC)
  TABLESPACE pg_default;

-- Composite index for agent status queries
CREATE INDEX idx_tasks_agent_status ON tasks(agent_id, status)
  TABLESPACE pg_default;

-- Composite with date for range queries
CREATE INDEX idx_tasks_agent_status_date ON tasks(agent_id, status, created_at DESC)
  TABLESPACE pg_default;

-- Partial index for active tasks
CREATE INDEX idx_active_tasks ON tasks(agent_id, status)
  WHERE status IN ('pending', 'processing')
  TABLESPACE pg_default;

-- Index for task result lookups
CREATE INDEX idx_tasks_result_id ON tasks(result_id)
  WHERE result_id IS NOT NULL
  TABLESPACE pg_default;

-- Verification query
SELECT
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  ROUND(100.0 * idx_tup_fetch / NULLIF(idx_tup_read, 0), 2) as fetch_ratio
FROM pg_stat_user_indexes
WHERE relname = 'tasks'
ORDER BY idx_scan DESC;
```

#### Session & User Tables

```sql
-- sessions table
CREATE INDEX idx_sessions_user_id ON sessions(user_id)
  TABLESPACE pg_default;

CREATE INDEX idx_sessions_token_hash ON sessions(token_hash)
  TABLESPACE pg_default;

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at DESC)
  TABLESPACE pg_default;

-- Partial index for valid sessions
CREATE INDEX idx_valid_sessions ON sessions(user_id)
  WHERE expires_at > NOW()
  TABLESPACE pg_default;

-- users table
CREATE INDEX idx_users_email ON users(email)
  TABLESPACE pg_default;

CREATE INDEX idx_users_created_at ON users(created_at DESC)
  TABLESPACE pg_default;

CREATE INDEX idx_users_active ON users(is_active)
  WHERE is_active = true
  TABLESPACE pg_default;
```

#### Voting & Metrics Tables

```sql
-- votes table
CREATE INDEX idx_votes_agent_id ON votes(agent_id)
  TABLESPACE pg_default;

CREATE INDEX idx_votes_round_id ON votes(round_id)
  TABLESPACE pg_default;

CREATE INDEX idx_votes_created_at ON votes(created_at DESC)
  TABLESPACE pg_default;

-- Composite for voting queries
CREATE INDEX idx_votes_round_agent ON votes(round_id, agent_id)
  TABLESPACE pg_default;

-- Index for vote aggregation
CREATE INDEX idx_votes_round_voter ON votes(round_id, voter_id)
  TABLESPACE pg_default;

-- leaderboard_rounds table
CREATE INDEX idx_rounds_status ON leaderboard_rounds(status)
  TABLESPACE pg_default;

CREATE INDEX idx_rounds_start_date ON leaderboard_rounds(start_date DESC)
  TABLESPACE pg_default;
```

### Index Monitoring & Maintenance

```sql
-- View unused indexes (candidates for deletion)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- View index size
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Rebuild fragmented indexes (>20% bloat)
REINDEX INDEX CONCURRENTLY idx_tasks_agent_status;

-- Update table statistics for better query planning
ANALYZE tasks;
ANALYZE agents;
ANALYZE sessions;
ANALYZE users;
ANALYZE votes;

-- Check index bloat
SELECT
  schemaname,
  tablename,
  indexname,
  ROUND(100.0 * (pg_relation_size(indexrelid) - pg_relation_size(indexrelid, 'main')) / NULLIF(pg_relation_size(indexrelid), 0), 2) as bloat_percent
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 1000000
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Query Optimization Examples

### Example 1: Agent Status with Task Count

**BEFORE - Subquery Inefficiency:**
```sql
-- SLOW: Subquery executes for every row
SELECT
  a.id,
  a.name,
  a.status,
  (SELECT COUNT(*) FROM tasks WHERE agent_id = a.id) as task_count
FROM agents a
WHERE a.is_active = true
ORDER BY a.reputation_score DESC
LIMIT 100;

-- Execution time: ~500ms (50 subqueries)
```

**AFTER - Efficient LEFT JOIN with aggregation:**
```sql
-- FAST: Single pass with group by
SELECT
  a.id,
  a.name,
  a.status,
  COUNT(t.id) as task_count,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks
FROM agents a
LEFT JOIN tasks t ON a.id = t.agent_id
WHERE a.is_active = true
GROUP BY a.id, a.name, a.status
ORDER BY a.reputation_score DESC
LIMIT 100;

-- Execution time: ~50ms (10x faster)
-- Uses index: idx_active_agents, idx_tasks_agent_id
```

### Example 2: Task List with Pagination

**BEFORE - Large Offset (Slow for deep pagination):**
```sql
-- SLOW: Offset requires scanning all previous rows
SELECT * FROM tasks
WHERE agent_id = $1
ORDER BY created_at DESC
LIMIT 20 OFFSET 10000;

-- Execution time: ~1000ms
-- Scans: 10,020 rows (10,000 offset + 20 limit)
```

**AFTER - Cursor-based Pagination:**
```sql
-- FAST: Cursor-based continuation
SELECT * FROM tasks
WHERE agent_id = $1
  AND created_at < $2  -- $2 is last row's created_at from previous page
ORDER BY created_at DESC
LIMIT 21;  -- +1 to check if more pages exist

-- Execution time: ~20ms
-- Scans: 21 rows only
-- Can handle arbitrary pagination depth efficiently
```

### Example 3: Leaderboard with Rank

**BEFORE - Calculating rank in application:**
```sql
-- Get all agents
SELECT id, name, reputation_score, vote_count
FROM agents
WHERE status = 'active'
ORDER BY reputation_score DESC;

-- Application code calculates rank (inefficient, all rows in memory)
const leaderboard = rows.map((row, index) => ({
  ...row,
  rank: index + 1
}));
```

**AFTER - Calculate rank in database:**
```sql
-- FAST: Database calculates rank
SELECT
  ROW_NUMBER() OVER (ORDER BY reputation_score DESC) as rank,
  id,
  name,
  reputation_score,
  vote_count
FROM agents
WHERE status = 'active'
ORDER BY reputation_score DESC
LIMIT 100;

-- Execution time: ~50ms
-- Can include percentile ranks
SELECT
  id,
  name,
  reputation_score,
  PERCENT_RANK() OVER (ORDER BY reputation_score) * 100 as percentile,
  ROW_NUMBER() OVER (ORDER BY reputation_score DESC) as rank
FROM agents
WHERE status = 'active';
```

### Example 4: Recent Tasks with Agent Info

**BEFORE - N+1 Problem (Application fetches agents after tasks):**
```javascript
const tasks = await db.query(
  'SELECT * FROM tasks WHERE created_at > NOW() - INTERVAL 24 hours ORDER BY created_at DESC LIMIT 100'
);

// N additional queries (one per task)
const tasksWithAgents = await Promise.all(
  tasks.map(task =>
    db.query('SELECT * FROM agents WHERE id = $1', [task.agent_id])
  )
);

// Total queries: 1 + 100 = 101 queries
// Total time: ~5000ms
```

**AFTER - Single JOIN query:**
```sql
-- FAST: Single query with join
SELECT
  t.id,
  t.status,
  t.created_at,
  t.data,
  json_build_object(
    'id', a.id,
    'name', a.name,
    'status', a.status,
    'reputation_score', a.reputation_score
  ) as agent
FROM tasks t
INNER JOIN agents a ON t.agent_id = a.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC
LIMIT 100;

-- Total queries: 1
-- Total time: ~50ms
-- Uses indexes: idx_tasks_created_at, idx_agents_status
```

### Example 5: Complex Aggregation Query

**BEFORE - Multiple queries then combine in app:**
```javascript
// Query 1: Get agents
const agents = await db.query('SELECT * FROM agents WHERE is_active = true');

// Query 2: Get task counts per agent
const taskCounts = await db.query(`
  SELECT agent_id, COUNT(*) as count
  FROM tasks
  GROUP BY agent_id
`);

// Query 3: Get vote counts per agent
const voteCounts = await db.query(`
  SELECT agent_id, COUNT(*) as count
  FROM votes
  GROUP BY agent_id
`);

// Combine in application (inefficient)
// Total time: ~3000ms + network overhead
```

**AFTER - Single aggregation query:**
```sql
-- FAST: Single query with multiple aggregations
SELECT
  a.id,
  a.name,
  a.status,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
  COUNT(DISTINCT CASE WHEN t.status = 'failed' THEN t.id END) as failed_tasks,
  COALESCE(SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END), 0)::float /
    NULLIF(COUNT(DISTINCT t.id), 0) as completion_rate,
  COUNT(DISTINCT v.id) as total_votes,
  ROUND(AVG(CASE WHEN v.is_upvote THEN 1 ELSE 0 END) * 100, 2) as upvote_percentage
FROM agents a
LEFT JOIN tasks t ON a.id = t.agent_id
LEFT JOIN votes v ON a.id = v.agent_id
WHERE a.is_active = true
GROUP BY a.id, a.name, a.status
ORDER BY total_votes DESC;

-- Total queries: 1
-- Total time: ~100ms
```

### Example 6: Search with Filters

**BEFORE - Multiple separate queries:**
```javascript
let tasks = await db.query('SELECT * FROM tasks');

// Filter in application
if (filters.status) {
  tasks = tasks.filter(t => t.status === filters.status);
}
if (filters.agentId) {
  tasks = tasks.filter(t => t.agentId === filters.agentId);
}
if (filters.minScore) {
  tasks = tasks.filter(t => t.score >= filters.minScore);
}

// Sort in application
tasks.sort((a, b) => b.created_at - a.created_at);
```

**AFTER - Parameterized query with all filters:**
```sql
-- FAST: Database handles all filtering
SELECT * FROM tasks
WHERE 1=1
  AND (agent_id = $1 OR $1::uuid IS NULL)
  AND (status = $2 OR $2 IS NULL)
  AND (score >= $3 OR $3 IS NULL)
  AND (created_at > NOW() - INTERVAL '1 day' * $4 OR $4 IS NULL)
ORDER BY created_at DESC
LIMIT $5;

-- Parameterized usage
db.query(queryString, [
  filters.agentId || null,
  filters.status || null,
  filters.minScore || null,
  filters.daysAgo || null,
  limit
]);

-- Total time: ~20ms
```

---

## EXPLAIN Analysis Guide

### Understanding EXPLAIN Output

```sql
EXPLAIN (ANALYZE, BUFFERS, TIMING, VERBOSE)
SELECT * FROM tasks
WHERE agent_id = $1 AND status = $2
ORDER BY created_at DESC
LIMIT 10;
```

**Output Breakdown:**

```
Index Scan using idx_tasks_agent_status_date on tasks  (cost=0.42..10.15 rows=5 width=100)
│         │                              │              │              │
│         │                              │              └─ Estimated cost range
│         │                              └─ Index used
│         └─ Scan type (Index Scan = Good, Seq Scan = Bad)
└─ Operation

  Index Cond: ((agent_id = 1) AND (status = 'processing'))
  │
  └─ Filter applied at index level (efficient)

  Buffers: shared hit=3
  │
  └─ Cache hits (good if high)

  Planning Time: 0.102 ms
  Execution Time: 0.234 ms
  │               │
  └─ Fast      └─ Very fast

Rows Analyzed: 5 (actual) 5 (planned)
└─ Good match between actual and planned (accurate stats)
```

### EXPLAIN Analysis Checklist

#### Check 1: Index Usage
```
GOOD: Index Scan, Index Only Scan
BAD: Seq Scan (full table scan)

If Seq Scan with large tables:
- Add missing index
- Update table statistics: ANALYZE table_name
- Check filter conditions match index
```

#### Check 2: Row Count Accuracy
```
GOOD: Actual rows ≈ Planned rows
BAD: Actual >> Planned (query plan underestimated) or vice versa

If inaccurate:
- Run ANALYZE table_name
- Consider using SET statistics ON column
- Check data distribution
```

#### Check 3: Buffer Usage
```
GOOD: High shared hit ratio
BAD: High I/O reads

If high reads:
- Increase shared_buffers in postgresql.conf
- Add covering index (includes all columns needed)
- Review query joins
```

#### Check 4: Join Strategy
```
GOOD: Hash Join (for large tables) or Nested Loop (for indexed lookups)
BAD: Merge Join requiring sorts

If inefficient join:
- Check join column indexes
- Consider query rewrite
- Check table statistics
```

### Example EXPLAIN Analysis

**Query:**
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT a.name, COUNT(t.id) as task_count
FROM agents a
LEFT JOIN tasks t ON a.id = t.agent_id
WHERE a.is_active = true
GROUP BY a.id, a.name;
```

**Poor Output (Needs Optimization):**
```
Seq Scan on agents a  (cost=0.00..50000.00 rows=1000)
  Filter: (is_active = true)
  Buffers: shared hit=100 read=500  <-- High reads!
  Execution Time: 2500.234 ms  <-- Slow!

  -> Hash Aggregate
    -> Hash Join  (cost=0.00..40000.00 rows=10000)
      Hash Cond: (a.id = t.agent_id)
      -> Seq Scan on tasks t
      -> Hash
        -> Seq Scan on agents a
```

**Solution: Add indexes**
```sql
CREATE INDEX idx_active_agents ON agents(id) WHERE is_active = true;
CREATE INDEX idx_tasks_agent_id ON tasks(agent_id);
```

**Good Output (After Optimization):**
```
Aggregate  (cost=100.42..100.50 rows=8)
  -> Hash Join  (cost=10.42..95.15 rows=50)
    Hash Cond: (t.agent_id = a.id)
    Buffers: shared hit=50  <-- Only cache hits!
    Execution Time: 50.234 ms  <-- Fast!

    -> Index Scan using idx_tasks_agent_id on tasks t
    -> Hash
      -> Index Scan using idx_active_agents on agents a
        Filter: (is_active = true)
```

---

## Slow Query Detection

### Enable Slow Query Logging

```sql
-- In postgresql.conf
log_min_duration_statement = 100    -- Log queries > 100ms
log_connections = on
log_disconnections = on
log_statement = 'mod'               -- Log DML operations
log_duration = off                  -- log_min_duration_statement is better
log_lock_waits = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

-- Apply settings
SELECT pg_reload_conf();
```

### Query for Slow Queries

```sql
-- View slowest queries (requires pg_stat_statements extension)
SELECT
  query,
  calls,
  mean_exec_time::decimal(10, 2) as mean_ms,
  max_exec_time::decimal(10, 2) as max_ms,
  total_exec_time::decimal(12, 2) as total_ms,
  stddev_exec_time::decimal(10, 2) as stddev_ms
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Reset statistics
SELECT pg_stat_statements_reset();

-- Detailed slow query analysis
SELECT
  query,
  calls,
  (total_exec_time / calls)::decimal(10, 2) as avg_ms,
  (max_exec_time)::decimal(10, 2) as max_ms,
  (stddev_exec_time)::decimal(10, 2) as stddev_ms,
  CASE
    WHEN calls > 1000 AND mean_exec_time > 50 THEN 'CRITICAL - High volume slow query'
    WHEN mean_exec_time > 1000 THEN 'CRITICAL - Very slow query'
    WHEN mean_exec_time > 500 THEN 'WARNING - Slow query'
    ELSE 'OK'
  END as severity
FROM pg_stat_statements
ORDER BY mean_exec_time DESC;
```

### Analyze Query Logs

```bash
#!/bin/bash
# Parse PostgreSQL logs for slow queries

LOG_FILE="/var/log/postgresql/postgresql.log"

echo "=== Slowest Queries (> 1 second) ==="
grep "duration:" $LOG_FILE | \
  grep -o "duration: [0-9]*\.[0-9]*" | \
  sort -t: -k2 -nr | \
  uniq | \
  head -20

echo ""
echo "=== Query frequency ==="
grep "statement:" $LOG_FILE | \
  sed 's/.*statement: //' | \
  sort | uniq -c | sort -nr | \
  head -20

echo ""
echo "=== Error frequency ==="
grep "ERROR" $LOG_FILE | \
  sed 's/.*ERROR: //' | \
  sort | uniq -c | sort -nr | \
  head -10
```

---

## Query Patterns & Anti-Patterns

### Good Patterns

#### 1. Use Indexes Effectively
```sql
-- GOOD: Uses index
SELECT * FROM tasks
WHERE agent_id = $1 AND status = $2
ORDER BY created_at DESC;

-- Uses indexes: idx_tasks_agent_status, idx_tasks_created_at
```

#### 2. Batch Operations
```sql
-- GOOD: Single batch insert
INSERT INTO tasks (agent_id, status, data) VALUES
  ($1, $2, $3),
  ($4, $5, $6),
  ($7, $8, $9)
RETURNING *;

-- Much faster than multiple individual inserts
```

#### 3. Use DISTINCT Sparingly
```sql
-- GOOD: When needed for actual deduplication
SELECT DISTINCT agent_id FROM tasks;

-- Instead of:
SELECT agent_id FROM tasks GROUP BY agent_id;
```

#### 4. Column Projection
```sql
-- GOOD: Only select needed columns
SELECT id, name, status FROM agents
WHERE is_active = true;

-- Instead of:
SELECT * FROM agents
WHERE is_active = true;
```

#### 5. Use LIMIT for Top-N Queries
```sql
-- GOOD: Efficient top-N
SELECT * FROM agents
ORDER BY reputation_score DESC
LIMIT 100;

-- Execution: uses index, stops at 100 rows
```

### Anti-Patterns to Avoid

#### 1. NOT IN with Subquery
```sql
-- BAD: Can produce unexpected results with NULL
SELECT * FROM tasks
WHERE agent_id NOT IN (SELECT id FROM agents WHERE status = 'inactive');

-- GOOD: Use NOT EXISTS or LEFT JOIN
SELECT t.* FROM tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM agents a
  WHERE a.id = t.agent_id AND a.status = 'inactive'
);

-- GOOD: Use LEFT JOIN with NULL check
SELECT t.* FROM tasks t
LEFT JOIN agents a ON t.agent_id = a.id AND a.status = 'inactive'
WHERE a.id IS NULL;
```

#### 2. Functions in WHERE Clause
```sql
-- BAD: Function disables index usage
SELECT * FROM tasks
WHERE LOWER(status) = 'processing';

-- GOOD: Store lowercase or use CITEXT type
SELECT * FROM tasks WHERE status = 'processing';

-- Or use case-insensitive type:
ALTER TABLE tasks ALTER COLUMN status TYPE citext;
```

#### 3. OR with Different Columns
```sql
-- BAD: Can't use indexes effectively
SELECT * FROM tasks
WHERE agent_id = $1 OR user_id = $2;

-- GOOD: Use UNION
SELECT * FROM tasks WHERE agent_id = $1
UNION
SELECT * FROM tasks WHERE user_id = $2;

-- Or rewrite to use better indexes
SELECT * FROM tasks
WHERE (agent_id = $1 AND user_id IS NOT NULL)
   OR (agent_id IS NULL AND user_id = $2);
```

#### 4. Type Mismatch in Joins
```sql
-- BAD: Type mismatch requires conversion
SELECT * FROM tasks t
JOIN agents a ON t.agent_id::text = a.id::text;

-- GOOD: Use correct types
SELECT * FROM tasks t
JOIN agents a ON t.agent_id = a.id;
```

#### 5. SELECT * in Joins
```sql
-- BAD: Retrieves all columns from all tables
SELECT * FROM tasks t
JOIN agents a ON t.agent_id = a.id;

-- GOOD: Select only needed columns
SELECT t.id, t.status, a.name, a.reputation_score
FROM tasks t
JOIN agents a ON t.agent_id = a.id;
```

#### 6. Unnecessary DISTINCT
```sql
-- BAD: DISTINCT adds overhead
SELECT DISTINCT t.* FROM tasks t
JOIN agents a ON t.agent_id = a.id;

-- GOOD: If no duplicates, omit DISTINCT
SELECT t.* FROM tasks t
JOIN agents a ON t.agent_id = a.id;
```

#### 7. Correlated Subqueries
```sql
-- BAD: Subquery executes once per row
SELECT a.*,
  (SELECT COUNT(*) FROM tasks t WHERE t.agent_id = a.id) as task_count
FROM agents a;

-- GOOD: Use JOIN with aggregate
SELECT a.*, COUNT(t.id) as task_count
FROM agents a
LEFT JOIN tasks t ON a.id = t.agent_id
GROUP BY a.id;
```

---

## Query Performance Baseline

### Benchmark Queries

Run these queries to establish baseline performance:

```sql
-- Query 1: Simple lookup (should be < 10ms)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM agents WHERE id = 'uuid-here';

-- Query 2: List with filter and sort (should be < 50ms)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM tasks
WHERE agent_id = 'uuid-here' AND status = 'processing'
ORDER BY created_at DESC
LIMIT 20;

-- Query 3: Aggregation (should be < 100ms)
EXPLAIN (ANALYZE, BUFFERS)
SELECT agent_id, COUNT(*) as count, AVG(duration) as avg_duration
FROM tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_id;

-- Query 4: Join query (should be < 100ms)
EXPLAIN (ANALYZE, BUFFERS)
SELECT t.*, a.name as agent_name
FROM tasks t
JOIN agents a ON t.agent_id = a.id
WHERE t.created_at > NOW() - INTERVAL '1 hour'
LIMIT 100;

-- Query 5: Complex aggregation (should be < 500ms)
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  a.id,
  a.name,
  COUNT(DISTINCT t.id) as total_tasks,
  COUNT(DISTINCT v.id) as total_votes,
  ROUND(100.0 * COUNT(CASE WHEN t.status = 'completed' THEN 1 END)
    / NULLIF(COUNT(DISTINCT t.id), 0), 2) as completion_rate
FROM agents a
LEFT JOIN tasks t ON a.id = t.agent_id
LEFT JOIN votes v ON a.id = v.agent_id
WHERE a.is_active = true
GROUP BY a.id, a.name
ORDER BY total_votes DESC
LIMIT 100;
```

### Performance Targets

| Query Type | Target Time | Notes |
|-----------|------------|-------|
| Simple Lookup | < 10ms | With index |
| Filtered List | < 50ms | 100 rows, indexed filter |
| Aggregation | < 100ms | Group by indexed column |
| Join (2 tables) | < 100ms | With indexes on join keys |
| Complex Query | < 500ms | Multiple joins/aggregations |
| Leaderboard | < 200ms | Top 100 with ranking |

---

**Document Version:** 1.0.0
**Last Updated:** November 2024
**Owner:** Database Performance Team
