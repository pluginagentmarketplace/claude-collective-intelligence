# Persistence Layer: Complete Implementation Guide

## Project Overview

This document provides a complete overview of the production-grade persistence layer for the Multi-Agent Orchestration System using PostgreSQL and Redis.

## File Structure

### Configuration Files

```
.env.example                       - Environment variables template
redis.conf                        - Redis configuration (production-ready)
docker-compose.yml                - Complete Docker service setup
```

### Database Connection Layer

```
src/db/
├── postgres-connection.js         - PostgreSQL pool manager
├── redis-connection.js            - Redis connection manager
├── connection-pool.js             - Centralized connection management
├── database-init.js               - Database initialization script
└── database-health.js             - Health check utility
```

### Data Access Layer (Repositories)

```
src/repositories/
├── base-repository.js             - Abstract base class (17KB)
├── agent-repository.js            - Agent CRUD operations
├── task-repository.js             - Task management
├── session-repository.js          - Session persistence
└── achievement-repository.js      - Achievement tracking
```

### Database Schema & Migrations

```
migrations/
├── 001-initial-schema.sql         - Core tables (agents, tasks, sessions, audit_logs)
├── 002-indexes.sql                - Performance indexes and monitoring views
└── 003-audit-tables.sql           - Security, compliance, and audit tables
```

### Documentation

```
DATABASE_STRATEGY.md               - Complete persistence strategy
PERSISTENCE_LAYER.md               - This file
```

## Quick Start

### 1. Copy Environment Configuration

```bash
cp .env.example .env
# Edit .env with your values
```

### 2. Start Services

```bash
docker-compose up -d
```

### 3. Initialize Database

```bash
npm run db:init
# Or manually
node src/db/database-init.js
```

### 4. Verify Health

```bash
npm run db:health
# Or via API
curl http://localhost:3000/api/v1/health/database
```

## Technology Stack

### PostgreSQL (Primary Data Store)

- **Version**: 15-alpine
- **Port**: 5432
- **Container**: agent_postgres
- **Volume**: postgres_data
- **Features**:
  - ACID transactions
  - JSONB support
  - Full-text search
  - Row-level security
  - Advanced indexing

### Redis (Cache & Session Store)

- **Version**: 7-alpine
- **Port**: 6379
- **Container**: agent_redis
- **Volume**: redis_data
- **Features**:
  - AOF persistence
  - Pub/Sub messaging
  - Distributed locking
  - LRU memory management
  - Pipeline operations

### Connection Pool Management

- **PostgreSQL Pool**: 5-20 connections
- **Redis Clients**: Main + Pub/Sub + Backup
- **Health Checks**: Every 30 seconds
- **Reconnection Strategy**: Exponential backoff

## Core Features

### 1. Multi-Level Caching

```
Request
  ↓
L1 Cache (In-Memory LRU) ← 500 items, 60s TTL
  ↓ (miss)
L2 Cache (Redis) ← 10min TTL
  ↓ (miss)
PostgreSQL (Database) ← 30s query timeout
```

### 2. Transaction Support

```javascript
// ACID transactions with isolation levels
await db.transaction(async (client) => {
  // Multiple operations
}, { isolationLevel: 'SERIALIZABLE' });

// Automatic retry on deadlock
await db.transaction(callback, { retryOnConflict: true });
```

### 3. Distributed Locking

```javascript
// Redis-based locks for concurrent operations
const lock = await redis.acquireLock('resource:123', 30);
try {
  await criticalOperation();
} finally {
  await lock.release();
}
```

### 4. Pub/Sub Real-time Communication

```javascript
// Publish events
await redis.publish('channel:agent:status', { agentId, status });

// Subscribe to events
await redis.subscribe('channel:*', (message) => {
  console.log('Received:', message);
});
```

### 5. Repository Pattern

```javascript
// All data access through repositories
const agent = await agentRepository.findById('123');
const tasks = await taskRepository.findAll({ status: 'pending' });
const sessions = await sessionRepository.createSession(userId, data);
```

## API Endpoints

### Health Checks

```bash
# Check database health
GET /api/v1/health/database

# Get detailed metrics
GET /api/v1/metrics/database

# Check specific service
GET /api/v1/health/postgres
GET /api/v1/health/redis
```

### Database Operations

```bash
# Query agents
GET /api/v1/agents
GET /api/v1/agents/:id
POST /api/v1/agents

# Query tasks
GET /api/v1/tasks
GET /api/v1/tasks/:id
POST /api/v1/tasks

# Manage sessions
GET /api/v1/sessions/:id
DELETE /api/v1/sessions/:id
```

## Monitoring & Observability

### Available Dashboards

| Tool | Port | Purpose |
|------|------|---------|
| Grafana | 3000 | Metrics visualization |
| pgAdmin | 5050 | PostgreSQL management |
| Redis Commander | 8081 | Redis management |
| RedisInsight | 8001 | Advanced Redis analytics |
| Prometheus | 9090 | Metrics collection |

### Metrics Tracked

**PostgreSQL**:
- Query execution time
- Connection pool usage
- Cache hit ratios
- Lock wait times
- Slow query detection

**Redis**:
- Memory usage and eviction
- Hit/miss ratios
- Command latency
- Connected clients
- Key expiration rate

## Backup & Recovery

### Automated Backups

```bash
# Daily PostgreSQL backup
docker-compose exec postgres pg_dump -U admin agent_orchestrator > backup.sql

# Redis backup (AOF)
docker cp agent_redis:/data/appendonly.aof ./backup/

# Restore PostgreSQL
docker-compose exec postgres psql -U admin agent_orchestrator < backup.sql

# Restore Redis
docker cp backup/appendonly.aof agent_redis:/data/
docker-compose restart redis
```

### Backup Locations

- **PostgreSQL**: `./backups/postgres/`
- **Redis**: `./backups/redis/`
- **Retention**: 7 days

## Performance Optimization

### Index Strategy

- **B-tree**: For equality/range queries (status, role, type, priority)
- **GIN**: For JSONB queries (capabilities, metadata, payload)
- **Partial**: For specific conditions (status = 'active')
- **Covering**: For index-only scans

### Query Optimization

1. Use indexed columns in WHERE clauses
2. Limit result sets with LIMIT and OFFSET
3. Cache query results (10min TTL)
4. Use bulk operations for multiple records
5. Avoid N+1 queries with proper joins

### Slow Query Detection

Queries exceeding 1 second are automatically logged:

```json
{
  "level": "warn",
  "message": "Slow query detected",
  "duration": 1500,
  "database": "postgres"
}
```

## Security

### Connection Security

- All connections require authentication
- SSL/TLS enabled in production
- Network isolation via Docker bridge network
- Statement timeout prevents query DoS

### Data Protection

- No sensitive data in logs
- Audit trail for all changes
- Parameterized queries prevent SQL injection
- Session tokens stored in Redis with TTL

### Access Control

- Connection pooling limits concurrent connections
- Rate limiting via Redis
- Query parameterization
- Audit logging for compliance

## Troubleshooting

### Connection Issues

```bash
# Test PostgreSQL
docker-compose exec postgres psql -U admin -c "SELECT version();"

# Test Redis
docker-compose exec redis redis-cli ping

# Check logs
docker-compose logs postgres
docker-compose logs redis
```

### Performance Issues

1. Check slow queries in logs
2. Analyze query plans: `EXPLAIN ANALYZE ...`
3. Review index usage: `SELECT * FROM index_usage_stats;`
4. Monitor cache hit rates (target >80%)
5. Check connection pool exhaustion

### Data Consistency

```javascript
// Force cache invalidation if needed
await redis.clearByPattern('cache:*');

// Verify data matches
await verifyDataConsistency();
```

## Production Deployment

### Pre-deployment Checklist

- [ ] Update all passwords in .env
- [ ] Set NODE_ENV=production
- [ ] Enable SSL/TLS for PostgreSQL
- [ ] Configure automated backups
- [ ] Set up monitoring/alerts
- [ ] Configure log aggregation
- [ ] Tune connection pool sizes
- [ ] Test disaster recovery
- [ ] Review and optimize cache TTLs
- [ ] Verify index performance

### Deployment Steps

```bash
# 1. Build and start services
docker-compose up -d

# 2. Run migrations
npm run migrate:up

# 3. Initialize database
node src/db/database-init.js

# 4. Verify health
npm run db:health

# 5. Monitor metrics
docker-compose logs -f prometheus grafana
```

## Development & Testing

### Unit Tests

```bash
# Mock database connections
jest tests/unit/repositories.test.js
```

### Integration Tests

```bash
# Test with real PostgreSQL and Redis
npm run test:integration
```

### Load Testing

```bash
# Stress test connection pools
npm run test:e2e:performance
```

## Migration Guide

### Create New Migration

```bash
npm run migrate:create -- migration_name
```

### Run Migrations

```bash
npm run migrate:up
npm run migrate:down
npm run migrate:create -- migration_name
```

### Migration Rollback

```bash
# Rollback last migration
npm run migrate:down

# Rollback specific number
npm run migrate:down -- -s 3
```

## Common Issues & Solutions

### Connection Pool Exhausted

**Symptoms**: "Client not available" errors

**Solution**:
1. Increase pool size in .env
2. Check for connection leaks
3. Review query timeouts

### High Memory Usage (Redis)

**Symptoms**: Keys being evicted unexpectedly

**Solution**:
1. Increase max_memory in redis.conf
2. Review cache TTLs
3. Reduce L1 cache size
4. Implement cache invalidation

### Slow Queries

**Symptoms**: Database latency >1s

**Solution**:
1. Add missing indexes
2. Use EXPLAIN ANALYZE
3. Limit result sets
4. Review query logic

### Data Consistency

**Symptoms**: Cache/database mismatch

**Solution**:
1. Force cache invalidation
2. Check replication lag
3. Verify transaction isolation
4. Review audit logs

## Support & Resources

- PostgreSQL Docs: https://www.postgresql.org/docs/
- Redis Docs: https://redis.io/documentation
- pg Library: https://node-postgres.com/
- ioredis: https://github.com/luin/ioredis

## Version History

- **1.0.0** (2024): Initial production release
  - PostgreSQL 15 with advanced indexing
  - Redis 7 with AOF persistence
  - Multi-level caching strategy
  - Complete audit trail
  - Distributed locking support

