# Database Schema Documentation

**AI Agent Orchestrator - PostgreSQL Database**

Version: 1.0.0
Database: PostgreSQL 14+
Last Updated: 2025-11-18

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Schema Design Principles](#schema-design-principles)
4. [Entity Relationship Diagrams](#entity-relationship-diagrams)
5. [Table Reference](#table-reference)
6. [Indexes & Performance](#indexes--performance)
7. [Partitioning Strategy](#partitioning-strategy)
8. [Views](#views)
9. [Triggers & Functions](#triggers--functions)
10. [Migration Guide](#migration-guide)
11. [Seed Data](#seed-data)
12. [Maintenance](#maintenance)

---

## Overview

This database schema supports a comprehensive multi-agent AI orchestration system with 11 major subsystems:

1. **Agent Management** - Agent profiles, skills, and activity tracking
2. **Task Distribution** - Queue management, execution history, dependencies
3. **Voting System** - Democratic decision-making with multiple algorithms
4. **Brainstorming** - Collaborative ideation and idea management
5. **Gamification** - Points, achievements, tiers, streaks
6. **Reputation** - EigenTrust algorithm, peer ratings, trust scores
7. **Battle System** - Competitive agent challenges with ELO ratings
8. **Leaderboards** - Rankings across multiple categories and time periods
9. **Mentorship** - Mentor-mentee pairings, curriculum, progress tracking
10. **Rewards** - Resource allocations, permissions, priority queues
11. **Penalties** - Violations, appeals, retraining programs

### Key Statistics

- **Total Tables**: 50+ tables
- **Partitioned Tables**: 5 high-volume tables
- **Custom Types**: 13 ENUMs
- **Indexes**: 50+ optimized indexes
- **Views**: 5 materialized views for common queries
- **Extensions**: uuid-ossp, pg_trgm, btree_gin

---

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│              (Node.js, RabbitMQ Clients)                 │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│                     Views Layer                          │
│  (v_active_agents, v_current_leaderboard, etc.)          │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Business Logic                         │
│            (Triggers, Functions, Constraints)            │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Core Tables                           │
│    (agents, tasks, voting_sessions, battles, etc.)       │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Partitioned History Tables                  │
│  (activity_log, task_history, point_transactions)        │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
Agent Activity
     │
     ▼
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Agents    │─────▶│    Tasks     │─────▶│   Results   │
└─────────────┘      └──────────────┘      └─────────────┘
     │                      │                      │
     │                      ▼                      ▼
     │               ┌──────────────┐      ┌─────────────┐
     │               │ Task History │      │   Points    │
     │               └──────────────┘      └─────────────┘
     │                                            │
     ▼                                            ▼
┌─────────────┐                          ┌─────────────┐
│ Trust Graph │                          │  Tier       │
│   (Peer)    │                          │  Upgrade    │
└─────────────┘                          └─────────────┘
     │
     ▼
┌─────────────┐
│  Reputation │
│ (EigenTrust)│
└─────────────┘
```

---

## Schema Design Principles

### 1. Normalization
- **3NF Compliance**: All tables follow Third Normal Form
- **Denormalization**: Strategic denormalization for performance (cached scores, aggregates)
- **JSONB Usage**: Flexible metadata storage without schema rigidity

### 2. Performance Optimization
- **Partitioning**: High-volume tables partitioned by time (monthly)
- **Indexes**: Covering indexes for common query patterns
- **JSONB GIN Indexes**: Fast JSON queries
- **Materialized Views**: Pre-computed aggregations

### 3. Data Integrity
- **Foreign Keys**: All relationships enforced
- **Check Constraints**: Data validation at DB level
- **Triggers**: Automatic timestamp updates, stat aggregation
- **Soft Deletes**: `deleted_at` for audit trail

### 4. Scalability
- **UUID Primary Keys**: Distributed system compatibility
- **Partitioning**: Horizontal scaling for time-series data
- **Connection Pooling**: Prepared for high concurrency
- **Read Replicas**: Schema supports read-write splitting

---

## Entity Relationship Diagrams

### Core Entities

```
┌──────────────┐         ┌──────────────┐
│    Agents    │────────▶│  Agent       │
│              │         │  Skills      │
│ - id         │         └──────────────┘
│ - agent_id   │
│ - name       │         ┌──────────────┐
│ - type       │────────▶│  Agent       │
│ - status     │         │  Activity    │
│ - tier       │         │  Log         │
│ - points     │         └──────────────┘
│ - elo_rating │
└──────────────┘
       │
       │ assigns
       ▼
┌──────────────┐         ┌──────────────┐
│    Tasks     │────────▶│  Task        │
│              │         │  Dependencies│
│ - id         │         └──────────────┘
│ - task_id    │
│ - title      │         ┌──────────────┐
│ - status     │────────▶│  Task        │
│ - assigned_to│         │  History     │
│ - priority   │         └──────────────┘
└──────────────┘
```

### Voting System

```
┌──────────────────┐
│ Voting Sessions  │
│                  │
│ - id             │
│ - session_id     │
│ - topic          │
│ - algorithm      │
│ - status         │
└──────────────────┘
         │
         │ contains
         ▼
┌──────────────────┐         ┌──────────────────┐
│     Votes        │────────▶│  Vote Audit      │
│                  │         │  Trail           │
│ - id             │         │                  │
│ - session_id     │         │ - event_type     │
│ - agent_id       │         │ - signature      │
│ - vote_option    │         └──────────────────┘
│ - confidence     │
│ - tokens_spent   │
└──────────────────┘
```

### Brainstorming System

```
┌───────────────────┐
│ Brainstorm        │
│ Sessions          │
│                   │
│ - id              │
│ - topic           │
│ - facilitator_id  │
└───────────────────┘
         │
         ├──────────────┬────────────────┐
         ▼              ▼                ▼
┌──────────────┐  ┌──────────┐  ┌──────────────┐
│ Brainstorm   │  │  Ideas   │  │    Idea      │
│ Participants │  │          │  │ Combinations │
└──────────────┘  └──────────┘  └──────────────┘
                       │                │
                       └────────┬───────┘
                                ▼
                        ┌──────────────┐
                        │  Idea Votes  │
                        └──────────────┘
```

### Gamification System

```
┌──────────────┐         ┌──────────────┐
│   Agents     │────────▶│   Point      │
│              │         │ Transactions │
└──────────────┘         └──────────────┘
       │                        │
       │                        │ triggers
       │                        ▼
       │                 ┌──────────────┐
       │                 │  Tier        │
       │                 │  Upgrade     │
       │                 └──────────────┘
       │
       ├────────────────▶┌──────────────┐
       │                 │ Agent        │
       │                 │ Achievements │
       │                 └──────────────┘
       │                        │
       │                        │ references
       │                        ▼
       │                 ┌──────────────┐
       │                 │ Achievements │
       │                 │ (Definitions)│
       │                 └──────────────┘
       │
       └────────────────▶┌──────────────┐
                         │   Streaks    │
                         └──────────────┘
```

### Reputation System

```
┌──────────────┐
│   Agents     │
└──────────────┘
       │
       ├──────────────┬──────────────┐
       ▼              ▼              ▼
┌──────────────┐ ┌────────────┐ ┌──────────────┐
│ Trust Graph  │ │   Peer     │ │   Global     │
│ (Local Trust)│ │  Ratings   │ │Trust Scores  │
│              │ │            │ │ (EigenTrust) │
│ - from_agent │ │ - rating   │ │ - eigentrust │
│ - to_agent   │ │ - context  │ │ - composite  │
│ - trust      │ │            │ │ - trust_level│
└──────────────┘ └────────────┘ └──────────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │ Reputation   │
                                │   History    │
                                └──────────────┘
```

### Battle System

```
┌──────────────┐
│   Battles    │
│              │
│ - id         │
│ - mode       │
│ - status     │
│ - winner_id  │
└──────────────┘
       │
       │ involves
       ▼
┌──────────────────┐         ┌──────────────┐
│ Battle           │────────▶│ ELO History  │
│ Participants     │         │              │
│                  │         │ - old_rating │
│ - score          │         │ - new_rating │
│ - rank           │         │ - change     │
│ - elo_change     │         └──────────────┘
└──────────────────┘
```

### Leaderboard System

```
┌──────────────────┐
│ Leaderboard      │
│ Rankings         │
│                  │
│ - category       │
│ - period         │
│ - agent_id       │
│ - rank           │
│ - score          │
│ - rank_change    │
└──────────────────┘

┌──────────────────┐
│ Hall of Fame     │
│                  │
│ - agent_id       │
│ - tier           │
│ - title          │
│ - badge          │
│ - citation       │
└──────────────────┘
```

### Mentorship System

```
┌──────────────────┐         ┌──────────────────┐
│ Mentorship       │────────▶│ Mentorship       │
│ Pairings         │         │ Sessions         │
│                  │         │                  │
│ - mentor_id      │         │ - session_number │
│ - mentee_id      │         │ - topic          │
│ - skill_focus    │         │ - objectives_met │
│ - status         │         │ - ratings        │
└──────────────────┘         └──────────────────┘
       │
       │ tracks
       ▼
┌──────────────────┐         ┌──────────────────┐
│ Mentee Progress  │────────▶│ Mentorship       │
│                  │         │ Curriculum       │
│ - curriculum_id  │         │                  │
│ - progress_%     │         │ - skill_name     │
│ - mastery_level  │         │ - level          │
└──────────────────┘         │ - objectives     │
                             └──────────────────┘
```

### Rewards & Penalties

```
┌──────────────────┐
│ Resource Pools   │
│                  │
│ - resource_type  │
│ - total_capacity │
│ - available      │
└──────────────────┘
         │
         │ allocates
         ▼
┌──────────────────┐
│ Resource         │
│ Allocations      │
│                  │
│ - agent_id       │
│ - resource_type  │
│ - amount         │
│ - expires_at     │
└──────────────────┘

┌──────────────────┐
│ Violations       │────────▶┌──────────────────┐
│                  │         │ Appeals          │
│ - agent_id       │         │                  │
│ - type           │         │ - status         │
│ - severity       │         │ - decision       │
│ - penalty_points │         └──────────────────┘
└──────────────────┘
         │
         │ triggers
         ▼
┌──────────────────┐
│ Retraining       │
│ Programs         │
│                  │
│ - curriculum     │
│ - progress_%     │
│ - assessment     │
└──────────────────┘
```

---

## Table Reference

### Core Tables

#### agents
Primary agent profiles and statistics.

**Key Columns:**
- `id` (UUID): Primary key
- `agent_id` (VARCHAR): External agent identifier
- `type` (ENUM): Agent type (team-leader, worker, etc.)
- `status` (ENUM): Current status
- `total_points` (INTEGER): Gamification points
- `current_tier` (ENUM): Performance tier
- `elo_rating` (INTEGER): Battle rating
- `trust_score` (DECIMAL): Overall trust score

**Indexes:**
- `idx_agents_agent_id` on `agent_id`
- `idx_agents_type_status` on `(type, status)`
- `idx_agents_elo` on `elo_rating DESC`

**Related Tables:**
- `agent_skills`: Skill proficiencies
- `agent_activity_log`: Activity history
- `agent_status_history`: Status changes

---

#### tasks
Task queue and execution history.

**Key Columns:**
- `id` (UUID): Primary key
- `task_id` (VARCHAR): External task identifier
- `status` (ENUM): Current status
- `priority` (ENUM): Task priority
- `assigned_to` (UUID): Assigned agent
- `quality_score` (DECIMAL): Result quality

**Indexes:**
- `idx_tasks_status` on `status`
- `idx_tasks_assigned_to` on `assigned_to`
- `idx_tasks_priority_status` on `(priority, status)`

**Related Tables:**
- `task_dependencies`: Task relationships
- `task_history`: Audit trail

---

#### voting_sessions
Democratic voting sessions.

**Key Columns:**
- `session_id` (VARCHAR): Session identifier
- `algorithm` (ENUM): Voting algorithm
- `status` (ENUM): Session status
- `options` (JSONB): Vote options
- `results` (JSONB): Final results

**Indexes:**
- `idx_voting_sessions_status` on `status`

**Related Tables:**
- `votes`: Individual votes
- `vote_audit_trail`: Complete audit history

---

#### brainstorm_sessions
Collaborative brainstorming sessions.

**Key Columns:**
- `session_id` (VARCHAR): Session identifier
- `topic` (VARCHAR): Session topic
- `total_ideas` (INTEGER): Ideas generated
- `participant_count` (INTEGER): Active participants

**Related Tables:**
- `brainstorm_participants`: Participation tracking
- `ideas`: Generated ideas
- `idea_combinations`: Combined ideas
- `idea_votes`: Voting on ideas

---

### Gamification Tables

#### achievements
Achievement definitions.

**Key Columns:**
- `achievement_id` (VARCHAR): Achievement identifier
- `category` (ENUM): Achievement category
- `requirements` (JSONB): Unlock requirements
- `points_reward` (INTEGER): Points awarded
- `rarity` (VARCHAR): Rarity level

---

#### point_transactions (Partitioned)
Point awards and deductions.

**Partitioning:** Monthly by `created_at`

**Key Columns:**
- `agent_id` (UUID): Agent reference
- `category` (VARCHAR): Point category
- `base_points` (INTEGER): Base point value
- `multiplier` (DECIMAL): Applied multiplier
- `final_points` (INTEGER): Final award

---

### Reputation Tables

#### trust_graph
EigenTrust local trust relationships.

**Key Columns:**
- `from_agent_id` (UUID): Trusting agent
- `to_agent_id` (UUID): Trusted agent
- `local_trust` (DECIMAL): Trust value [0-1]
- `interaction_count` (INTEGER): Number of interactions

**Constraints:**
- No self-trust (from ≠ to)
- Trust value between 0 and 1

---

#### global_trust_scores
Computed global trust scores.

**Key Columns:**
- `eigentrust_score` (DECIMAL): EigenTrust global score
- `persistence_score` (DECIMAL): Consistency score
- `competence_score` (DECIMAL): Skill score
- `trust_level` (VARCHAR): Trust classification

---

### Battle & Leaderboard Tables

#### battles
Competition events.

**Key Columns:**
- `mode` (ENUM): Battle mode
- `status` (ENUM): Battle status
- `prize_pool` (INTEGER): Total prizes
- `winner_id` (UUID): Winning agent

---

#### leaderboard_rankings
Period-based rankings.

**Key Columns:**
- `category` (VARCHAR): Ranking category
- `period` (VARCHAR): Time period
- `rank` (INTEGER): Current rank
- `rank_change` (INTEGER): Change from previous period

---

### Mentorship Tables

#### mentorship_pairings
Mentor-mentee relationships.

**Key Columns:**
- `mentor_id` (UUID): Mentor agent
- `mentee_id` (UUID): Mentee agent
- `skill_focus` (VARCHAR): Target skill
- `completed_sessions` (INTEGER): Sessions completed

---

#### mentorship_curriculum
Learning curriculum.

**Key Columns:**
- `skill_name` (VARCHAR): Skill name
- `level` (INTEGER): Difficulty level
- `objectives` (TEXT[]): Learning objectives
- `assessment_tasks` (JSONB): Assessment criteria

---

### Rewards & Penalties Tables

#### resource_allocations
Agent resource assignments.

**Key Columns:**
- `resource_type` (VARCHAR): Resource type
- `amount` (INTEGER): Allocated amount
- `performance_tier` (ENUM): Basis for allocation

---

#### violations
Recorded violations.

**Key Columns:**
- `violation_type` (ENUM): Type of violation
- `severity` (INTEGER): Severity level [1-5]
- `penalty_points` (INTEGER): Penalty assessed

**Related Tables:**
- `appeals`: Violation appeals
- `retraining_programs`: Remedial training

---

## Indexes & Performance

### Index Strategy

1. **Primary Indexes**: UUID primary keys on all tables
2. **Foreign Key Indexes**: Automatic on all FK columns
3. **Composite Indexes**: Multi-column for common queries
4. **Partial Indexes**: `WHERE` clauses for active records
5. **GIN Indexes**: JSONB and array columns

### Critical Indexes

```sql
-- Agent lookups
CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_type_status ON agents(type, status)
  WHERE deleted_at IS NULL;

-- Task queue optimization
CREATE INDEX idx_tasks_priority_status ON tasks(priority, status)
  WHERE deleted_at IS NULL;

-- Leaderboard queries
CREATE INDEX idx_leaderboard_category_period
  ON leaderboard_rankings(category, period, period_start);

-- Trust graph traversal
CREATE INDEX idx_trust_graph_from ON trust_graph(from_agent_id);
CREATE INDEX idx_trust_graph_to ON trust_graph(to_agent_id);
```

### Query Optimization Tips

1. **Use Views**: Pre-defined views for common patterns
2. **JSONB Indexing**: Create GIN indexes on frequently queried JSONB fields
3. **Analyze Plans**: Use `EXPLAIN ANALYZE` for slow queries
4. **Partition Pruning**: Always include time range in partitioned table queries

---

## Partitioning Strategy

### Partitioned Tables

5 high-volume tables use range partitioning by `created_at`:

1. `agent_activity_log` - Agent activity tracking
2. `task_history` - Task event history
3. `point_transactions` - Point awards/deductions
4. `reputation_history` - Reputation snapshots
5. `penalty_history` - Penalty events

### Partition Management

**Monthly Partitions:**
```sql
-- Example: Create partition for December 2025
CREATE TABLE agent_activity_log_y2025m12 PARTITION OF agent_activity_log
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

**Automated Partition Creation:**
```sql
-- Function to create next month's partitions
CREATE OR REPLACE FUNCTION create_next_month_partitions()
RETURNS void AS $$
DECLARE
  next_month DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
  following_month DATE := next_month + INTERVAL '1 month';
  table_name TEXT;
BEGIN
  -- Create partitions for all partitioned tables
  FOR table_name IN
    SELECT 'agent_activity_log' UNION ALL
    SELECT 'task_history' UNION ALL
    SELECT 'point_transactions' UNION ALL
    SELECT 'reputation_history' UNION ALL
    SELECT 'penalty_history'
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I_%s PARTITION OF %I
       FOR VALUES FROM (%L) TO (%L)',
      table_name,
      TO_CHAR(next_month, 'yYYYYmMM'),
      table_name,
      next_month,
      following_month
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**Scheduled Maintenance:**
```sql
-- Run monthly via cron or pg_cron
SELECT create_next_month_partitions();
```

---

## Views

### v_active_agents
Active agents with full statistics.

```sql
SELECT * FROM v_active_agents
WHERE current_tier >= 'gold'
ORDER BY total_points DESC;
```

### v_current_leaderboard
Current week's rankings across all categories.

```sql
SELECT * FROM v_current_leaderboard
WHERE category = 'overall'
ORDER BY rank;
```

### v_active_mentorships
Active mentorship pairings with progress.

```sql
SELECT * FROM v_active_mentorships
WHERE completion_percentage > 50;
```

### v_agent_reputation
Complete reputation profile for all agents.

```sql
SELECT * FROM v_agent_reputation
WHERE trust_level IN ('excellent', 'outstanding')
ORDER BY eigentrust_score DESC;
```

### v_task_queue_summary
Current task queue statistics.

```sql
SELECT * FROM v_task_queue_summary
WHERE status = 'pending'
ORDER BY priority DESC;
```

---

## Triggers & Functions

### Auto-Update Triggers

#### updated_at Trigger
Automatically updates `updated_at` timestamp on all updates.

```sql
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Business Logic Triggers

#### Task Completion Stats
Updates agent statistics when tasks are completed.

```sql
CREATE TRIGGER task_completion_updates_agent_stats
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (NEW.assigned_to IS NOT NULL)
  EXECUTE FUNCTION update_agent_stats_on_task_completion();
```

**Function Logic:**
- Increments `tasks_completed` on success
- Increments `tasks_failed` on failure
- Recalculates `success_rate`
- Updates `average_quality_score`
- Updates `average_task_time_ms`

---

## Migration Guide

### Initial Setup

```bash
# 1. Create database
createdb ai_agent_orchestrator

# 2. Connect and run migration
psql ai_agent_orchestrator < database/migrations/001_initial_schema.sql

# 3. Load seed data (optional, for development)
psql ai_agent_orchestrator < database/seeds/dev_data.sql
```

### Using Schema Directly

```bash
# For production: Use full schema
psql production_db < database/schema.sql
```

### Incremental Migrations

Future migrations should:
1. Be numbered sequentially (002, 003, etc.)
2. Include rollback scripts
3. Test on staging first
4. Use transactions

Example migration structure:
```sql
-- 002_add_new_feature.sql
BEGIN;

-- Migration code here
ALTER TABLE agents ADD COLUMN new_field VARCHAR(100);

-- Rollback point
-- To rollback: ALTER TABLE agents DROP COLUMN new_field;

COMMIT;
```

---

## Seed Data

### Development Data

The seed data includes:
- 10 sample agents (various tiers and types)
- 10 sample tasks (various states)
- 10 achievements
- 3 voting sessions
- 3 brainstorm sessions
- Trust relationships
- Sample battles and leaderboards
- Mentorship pairings

### Loading Seed Data

```bash
psql ai_agent_orchestrator < database/seeds/dev_data.sql
```

### Creating Custom Seed Data

```sql
-- Add your agents
INSERT INTO agents (agent_id, name, type, ...) VALUES (...);

-- Add tasks
INSERT INTO tasks (task_id, title, ...) VALUES (...);
```

---

## Maintenance

### Regular Maintenance Tasks

#### Daily
```sql
-- Vacuum analyze high-activity tables
VACUUM ANALYZE agents, tasks, point_transactions;
```

#### Weekly
```sql
-- Full vacuum on partitioned tables
VACUUM FULL agent_activity_log, task_history;

-- Reindex for performance
REINDEX TABLE agents;
REINDEX TABLE tasks;
```

#### Monthly
```sql
-- Create next month's partitions
SELECT create_next_month_partitions();

-- Archive old partitions (optional)
-- Detach partitions older than 12 months
ALTER TABLE agent_activity_log
  DETACH PARTITION agent_activity_log_y2024m01;
```

### Monitoring Queries

#### Table Sizes
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Index Usage
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

#### Slow Queries
```sql
-- Enable query logging
ALTER DATABASE ai_agent_orchestrator
  SET log_min_duration_statement = 1000; -- 1 second

-- View slow queries in logs
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## Performance Tuning

### PostgreSQL Configuration

Recommended settings for medium workload:

```ini
# postgresql.conf

# Memory
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
maintenance_work_mem = 1GB

# Checkpoint
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Query Planner
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200

# Autovacuum
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 10s
```

### Connection Pooling

Use PgBouncer for connection pooling:

```ini
# pgbouncer.ini
[databases]
ai_agent_orchestrator = host=localhost dbname=ai_agent_orchestrator

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

---

## Backup & Recovery

### Backup Strategy

#### Full Backup (Daily)
```bash
pg_dump -Fc ai_agent_orchestrator > backup_$(date +%Y%m%d).dump
```

#### Schema Only
```bash
pg_dump -s -Fc ai_agent_orchestrator > schema_$(date +%Y%m%d).dump
```

#### Data Only
```bash
pg_dump -a -Fc ai_agent_orchestrator > data_$(date +%Y%m%d).dump
```

### Restore

```bash
# Full restore
pg_restore -d ai_agent_orchestrator backup_20251118.dump

# Schema only
pg_restore -s -d ai_agent_orchestrator schema_20251118.dump
```

### Point-in-Time Recovery (PITR)

Enable WAL archiving for PITR:

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

---

## Security

### Recommended Permissions

```sql
-- Create application role
CREATE ROLE ai_agent_app WITH LOGIN PASSWORD 'secure_password_here';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE ai_agent_orchestrator TO ai_agent_app;
GRANT USAGE ON SCHEMA public TO ai_agent_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ai_agent_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ai_agent_app;

-- Read-only role for analytics
CREATE ROLE ai_agent_readonly WITH LOGIN PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE ai_agent_orchestrator TO ai_agent_readonly;
GRANT USAGE ON SCHEMA public TO ai_agent_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ai_agent_readonly;
```

### Row-Level Security (Optional)

```sql
-- Enable RLS on sensitive tables
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY agent_own_violations ON violations
  FOR SELECT
  USING (agent_id = current_setting('app.current_agent_id')::uuid);
```

---

## Troubleshooting

### Common Issues

#### Slow Queries
```sql
-- Find slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### Bloat
```sql
-- Check table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Lock Contention
```sql
-- View current locks
SELECT * FROM pg_locks WHERE NOT granted;
```

---

## Additional Resources

- [PostgreSQL 14 Documentation](https://www.postgresql.org/docs/14/)
- [EigenTrust Algorithm](https://nlp.stanford.edu/pubs/eigentrust.pdf)
- [Partitioning Best Practices](https://www.postgresql.org/docs/14/ddl-partitioning.html)
- [JSONB Performance](https://www.postgresql.org/docs/14/datatype-json.html)

---

## Change Log

### Version 1.0.0 (2025-11-18)
- Initial schema release
- All 11 subsystems implemented
- Partitioning strategy defined
- Full documentation

---

**Maintained by**: Agent 17 - Database Schema Designer
**Contact**: See PROJECT-STATUS.md for system details
**License**: See LICENSE file in project root
