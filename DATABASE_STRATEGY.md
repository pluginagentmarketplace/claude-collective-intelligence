# Database Strategy: Redis + PostgreSQL Persistence Layer

## Overview

This document describes the comprehensive persistence layer strategy for the Multi-Agent Orchestration System, combining PostgreSQL for durable storage and Redis for high-performance caching and session management.

## Architecture

### Dual-Database Approach

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│               Connection Pool Manager (Orchestrator)         │
├──────────────────────────┬──────────────────────────────────┤
│   PostgreSQL (Primary)   │   Redis (L2 Cache + Sessions)    │
│  - Durable Storage       │  - Query Result Caching          │
│  - ACID Transactions     │  - Session Store                 │
│  - Complex Queries       │  - Distributed Locks             │
│  - Audit Logs            │  - Real-time Pub/Sub             │
│  - Data Analytics        │  - Rate Limiting                 │
└──────────────────────────┴──────────────────────────────────┘
```

### Multi-Level Caching Strategy

```
L1 Cache (In-Memory LRU)
    ↓
L2 Cache (Redis)
    ↓
Database (PostgreSQL)
```

## Database Responsibilities

### PostgreSQL - Primary Durable Store

**Purpose**: Authoritative data storage with strong consistency guarantees

**Data Stored**:
- **Agents**: Agent profiles, capabilities, status history
- **Tasks**: Task definitions, execution logs, results
- **Sessions**: User session metadata (actual session data in Redis)
- **Audit Logs**: Change history for compliance and debugging
- **Achievements**: Agent performance metrics and achievements

**Key Features**:
- ACID compliance with transaction support
- Full-text search capabilities
- JSONB support for flexible schema
- Indexes for query optimization
- Row-level security (optional)
- Automatic backup integration

**Connection Details**:
```
Host: postgres (Docker) / localhost (local)
Port: 5432
Database: agent_orchestrator
User: admin
Password: ${POSTGRES_PASSWORD}
Pool Size: 5-20 connections
Statement Timeout: 30 seconds
```

### Redis - High-Performance Cache & Session Store

**Purpose**: Ultra-fast caching and session management with automatic eviction

**Data Stored**:
- **Cache Layer**: Query results, computed data
- **Sessions**: User session data with TTL expiration
- **Agent State**: Current agent status and metrics
- **Task Queue**: Priority queues for task distribution
- **Locks**: Distributed locks for concurrent operations
- **Pub/Sub Channels**: Real-time event broadcasting
- **Rate Limiting**: Request rate tracking per user

**Key Features**:
- Automatic memory management with LRU eviction
- Persistence with AOF (Append-Only File)
- Pub/Sub for real-time communication
- Distributed locking with Lua scripts
- Key expiration with TTL
- Multi-level caching (L1 in-memory + L2 Redis)

**Connection Details**:
```
Host: redis (Docker) / localhost (local)
Port: 6379
Password: ${REDIS_PASSWORD}
Database: 0 (default)
Max Memory: 512MB
Eviction Policy: allkeys-lru
Persistence: AOF enabled (everysec)
```

## Schema Design

### Core Tables

#### 1. **agents** Table
```sql
id UUID PRIMARY KEY
name VARCHAR(255) UNIQUE NOT NULL
role VARCHAR(100) NOT NULL
status VARCHAR(50) -- idle, active, busy, offline, error
capabilities JSONB -- Array of agent capabilities
metadata JSONB -- Custom agent data
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 2. **tasks** Table
```sql
id UUID PRIMARY KEY
agent_id UUID FK -> agents.id
type VARCHAR(100) NOT NULL
payload JSONB NOT NULL
priority INTEGER 1-10
status VARCHAR(50) -- pending, assigned, in_progress, completed, failed
result JSONB
error_message TEXT
retry_count INTEGER
max_retries INTEGER
started_at TIMESTAMP
completed_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 3. **sessions** Table
```sql
id UUID PRIMARY KEY
session_key VARCHAR(255) UNIQUE NOT NULL
user_id VARCHAR(255)
data JSONB -- Session metadata
ip_address INET
user_agent TEXT
expires_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### 4. **audit_logs** Table
```sql
id UUID PRIMARY KEY
action VARCHAR(100)
actor_type VARCHAR(50)
actor_id VARCHAR(255)
resource_type VARCHAR(100)
resource_id VARCHAR(255)
old_value JSONB
new_value JSONB
metadata JSONB
ip_address INET
timestamp TIMESTAMP
```

#### 5. **achievements** Table
```sql
id UUID PRIMARY KEY
agent_id UUID FK -> agents.id
achievement_type VARCHAR(100)
points INTEGER
completed_at TIMESTAMP
metadata JSONB
created_at TIMESTAMP
```

## Caching Strategy

### Cache Key Patterns

```
cache:agent:{agentId}              -- Individual agent cache
cache:task:{taskId}                -- Individual task cache
cache:query:{queryHash}            -- Query result cache
cache:session:{sessionId}          -- Session metadata
cache:stats:{entityType}:{id}      -- Statistics/metrics
```

### TTL Configuration

| Entity | TTL | Rationale |
|--------|-----|-----------|
| Session | 1 hour | Standard session duration |
| Agent State | 5 minutes | Frequent updates needed |
| Query Results | 10 minutes | Moderate freshness requirement |
| Task Results | 24 hours | Long-term result caching |
| Rate Limits | 1 minute | Quick reset for rate windows |
| Locks | 30 seconds | Short-term distributed locks |
| Metrics | 1 hour | Aggregated metric retention |

### Cache Invalidation

**Automatic Invalidation Triggers**:
1. **On Write Operations**: INSERT, UPDATE, DELETE queries
2. **Pattern-based Clearing**: `cache:query:{entityType}:*`
3. **Manual Invalidation**: Via `BaseRepository.invalidateCaches()`
4. **TTL Expiration**: Automatic Redis expiration

## Connection Pool Management

### PostgreSQL Pool

```javascript
{
  min: 5,                        // Minimum connections
  max: 20,                       // Maximum connections
  idleTimeoutMillis: 30000,      // 30 second idle timeout
  connectionTimeoutMillis: 2000, // 2 second connection timeout
  statement_timeout: 30000       // 30 second query timeout
}
```

### Redis Connection

```javascript
{
  host: 'redis',
  port: 6379,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  commandTimeout: 5000,
  enableReadyCheck: true
}
```

## Transaction Handling

### PostgreSQL Transactions

**ACID Guarantee with Multiple Isolation Levels**:

```javascript
// Serializable isolation for critical operations
await db.transaction(async (client) => {
  await client.query('BEGIN');
  // Multiple operations here
  await client.query('COMMIT');
}, { isolationLevel: 'SERIALIZABLE' });
```

### Distributed Locking

**Redis-based Locks for Concurrent Operations**:

```javascript
const lock = await redis.acquireLock('resource:agent-123', 30);
try {
  // Critical section
  await executeTransaction();
} finally {
  await lock.release();
}
```

## Repository Pattern

All data access goes through repositories extending `BaseRepository`:
- `AgentRepository` - Agent CRUD and queries
- `TaskRepository` - Task management and tracking
- `SessionRepository` - Session management with Redis
- `AchievementRepository` - Achievement tracking

## Performance Optimization

### Indexing Strategy

**B-tree Indexes**: `status`, `role`, `type`, `priority`, `created_at`
**GIN Indexes**: `capabilities`, `metadata`, `payload`, `data`
**Partial Indexes**: For specific query patterns

### Slow Query Logging

Queries exceeding 1 second are logged with execution time and query text.

## Backup & Recovery Strategy

### PostgreSQL Backups

**Automated Daily Backups**:
```bash
docker-compose exec postgres pg_dump -U admin agent_orchestrator > backup.sql
```

### Redis Persistence

**AOF (Append-Only File)**: Enabled by default
- File: `/data/appendonly.aof`
- fsync: everysec

## Monitoring & Observability

### Metrics Collected

**PostgreSQL Metrics**: Query time, connection pool, cache hits, lock waits
**Redis Metrics**: Memory usage, hit/miss ratios, command latency

### Dashboards

- **Grafana**: Metrics visualization (port 3000)
- **pgAdmin**: PostgreSQL management (port 5050)
- **Redis Commander**: Redis management (port 8081)
- **RedisInsight**: Advanced Redis analytics (port 8001)

## Security Considerations

### Connection Security

- **SSL/TLS**: Enabled in production for PostgreSQL
- **Password Authentication**: All connections require passwords
- **Network Isolation**: Services on internal Docker network
- **Statement Timeout**: Prevents long-running query DoS

### Data Protection

- **No Sensitive Data in Logs**: Redacted in error messages
- **Audit Trail**: All changes logged in audit_logs table
- **Query Parameterization**: All queries use parameterized statements

## Migration Management

### Running Migrations

```bash
# Apply all pending migrations
npm run migrate:up

# Create new migration
npm run migrate:create -- create_agents_table

# Rollback last migration
npm run migrate:down
```

### Migration Files Location

- **Directory**: `/migrations/`
- **Naming**: `NNN-description.sql`
- **Examples**:
  - `001-initial-schema.sql` - Core tables
  - `002-indexes.sql` - Performance indexes
  - `003-audit-tables.sql` - Audit logging

## Production Checklist

- [ ] SSL/TLS enabled for PostgreSQL
- [ ] Database passwords set to strong values
- [ ] Redis persistence enabled (AOF)
- [ ] Automated backup system configured
- [ ] Monitoring/alerting configured
- [ ] Log aggregation enabled
- [ ] Connection pool sizes tuned
- [ ] Cache TTLs reviewed and optimized
- [ ] Indexes verified for query patterns
- [ ] Disaster recovery tested
- [ ] Query timeout set appropriately
- [ ] Rate limiting configured

## References

- PostgreSQL: https://www.postgresql.org/docs/
- Redis: https://redis.io/documentation
- Node.js pg: https://node-postgres.com/
- ioredis: https://github.com/luin/ioredis
