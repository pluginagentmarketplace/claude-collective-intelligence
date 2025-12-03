# Database Quick Start Guide

Get your AI Agent Orchestrator database up and running in minutes!

## Quick Start Options

### Option 1: Docker (Recommended)

Fastest way to get started with zero PostgreSQL installation required.

```bash
# Start PostgreSQL + pgAdmin + Redis
cd database
docker-compose up -d

# Wait for services to be healthy (about 10 seconds)
docker-compose ps

# Database is now running!
# PostgreSQL: localhost:5432
# pgAdmin: http://localhost:5050
# Redis: localhost:6379
```

**Default Credentials:**
- PostgreSQL User: `ai_agent_app`
- PostgreSQL Password: `changeme_in_production`
- Database: `ai_agent_orchestrator`
- pgAdmin Email: `admin@example.com`
- pgAdmin Password: `admin`

The migration will run automatically on first startup!

### Option 2: Local PostgreSQL

If you have PostgreSQL already installed:

```bash
# Run the setup script
cd database
./setup.sh --seed

# Or with custom settings
DB_NAME=mydb DB_USER=myuser ./setup.sh --seed
```

### Option 3: Manual Setup

```bash
# 1. Create database
createdb ai_agent_orchestrator

# 2. Run migration
psql ai_agent_orchestrator < migrations/001_initial_schema.sql

# 3. Load seed data (optional)
psql ai_agent_orchestrator < seeds/dev_data.sql
```

---

## Verify Installation

### Check Tables

```bash
psql ai_agent_orchestrator -c "\dt"
```

You should see 50+ tables.

### Check Sample Data

```bash
psql ai_agent_orchestrator -c "SELECT agent_id, name, type, current_tier FROM agents LIMIT 5;"
```

### Check Views

```bash
psql ai_agent_orchestrator -c "SELECT * FROM v_active_agents LIMIT 5;"
```

---

## Connect from Application

### Node.js (pg)

```javascript
import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'ai_agent_orchestrator',
  user: 'ai_agent_app',
  password: 'changeme_in_production',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
const client = await pool.connect();
const result = await client.query('SELECT COUNT(*) FROM agents');
console.log(`Total agents: ${result.rows[0].count}`);
client.release();
```

### Environment Variables

Create a `.env` file:

```bash
# Database
DATABASE_URL=postgresql://ai_agent_app:changeme_in_production@localhost:5432/ai_agent_orchestrator
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_agent_orchestrator
DB_USER=ai_agent_app
DB_PASSWORD=changeme_in_production

# Redis (for caching)
REDIS_URL=redis://localhost:6379
```

---

## Common Operations

### Create an Agent

```sql
INSERT INTO agents (agent_id, name, type, specializations)
VALUES ('agent-custom-001', 'My Custom Agent', 'worker', ARRAY['coding', 'testing']);
```

### Create a Task

```sql
INSERT INTO tasks (task_id, title, description, priority, complexity)
VALUES ('task-custom-001', 'Implement new feature', 'Add user authentication', 'high', 'complex');
```

### Assign Task to Agent

```sql
UPDATE tasks
SET assigned_to = (SELECT id FROM agents WHERE agent_id = 'agent-custom-001'),
    status = 'assigned',
    assigned_at = NOW()
WHERE task_id = 'task-custom-001';
```

### Award Points

```sql
INSERT INTO point_transactions (agent_id, category, action, base_points, multiplier, final_points)
VALUES (
  (SELECT id FROM agents WHERE agent_id = 'agent-custom-001'),
  'SPEED',
  'fast_completion',
  100,
  1.5,
  150
);

-- Update agent's total points
UPDATE agents
SET total_points = total_points + 150
WHERE agent_id = 'agent-custom-001';
```

---

## Management Tools

### pgAdmin (Web UI)

If using Docker:
1. Open http://localhost:5050
2. Login with admin@example.com / admin
3. Add Server:
   - Name: AI Agent DB
   - Host: postgres (if in Docker) or localhost
   - Port: 5432
   - Database: ai_agent_orchestrator
   - Username: ai_agent_app
   - Password: changeme_in_production

### psql (Command Line)

```bash
# Connect
psql -h localhost -U ai_agent_app -d ai_agent_orchestrator

# List tables
\dt

# Describe table
\d agents

# View indexes
\di

# View views
\dv

# Quit
\q
```

---

## Sample Queries

### Top Performing Agents

```sql
SELECT
  agent_id,
  name,
  current_tier,
  total_points,
  success_rate,
  tasks_completed
FROM v_active_agents
ORDER BY total_points DESC
LIMIT 10;
```

### Recent Task Activity

```sql
SELECT
  t.task_id,
  t.title,
  t.status,
  a.name AS assigned_to,
  t.created_at,
  t.quality_score
FROM tasks t
LEFT JOIN agents a ON a.id = t.assigned_to
WHERE t.created_at > NOW() - INTERVAL '7 days'
ORDER BY t.created_at DESC;
```

### Leaderboard

```sql
SELECT * FROM v_current_leaderboard
WHERE category = 'overall'
ORDER BY rank
LIMIT 10;
```

### Agent Reputation

```sql
SELECT
  agent_id,
  name,
  trust_score,
  eigentrust_score,
  trust_level,
  total_ratings_received
FROM v_agent_reputation
WHERE trust_level IN ('excellent', 'outstanding')
ORDER BY eigentrust_score DESC;
```

### Active Mentorships

```sql
SELECT
  mentor_name,
  mentee_name,
  skill_focus,
  completed_sessions,
  total_sessions,
  completion_percentage
FROM v_active_mentorships
ORDER BY completion_percentage DESC;
```

---

## Troubleshooting

### Connection Refused

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# If using Docker
docker-compose ps
docker-compose logs postgres
```

### Permission Denied

```bash
# Grant permissions
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ai_agent_orchestrator TO ai_agent_app;"
```

### Slow Queries

```sql
-- Enable query logging
ALTER DATABASE ai_agent_orchestrator
  SET log_min_duration_statement = 1000;

-- View slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Table Not Found

```bash
# Check if migration ran
psql ai_agent_orchestrator -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Re-run migration if needed
psql ai_agent_orchestrator < migrations/001_initial_schema.sql
```

---

## Backup & Restore

### Backup

```bash
# Full backup
pg_dump -Fc ai_agent_orchestrator > backup.dump

# Schema only
pg_dump -s ai_agent_orchestrator > schema.sql

# Data only
pg_dump -a ai_agent_orchestrator > data.sql
```

### Restore

```bash
# Full restore
pg_restore -d ai_agent_orchestrator backup.dump

# From SQL file
psql ai_agent_orchestrator < backup.sql
```

---

## Next Steps

1. **Integrate with Application**: Use connection details above
2. **Load Real Data**: Replace seed data with production data
3. **Setup Monitoring**: Configure pg_stat_statements
4. **Configure Backups**: Setup automated backup schedule
5. **Optimize Performance**: Review and tune postgresql.conf
6. **Setup Read Replicas**: For high-traffic scenarios

---

## Resources

- Full Documentation: `database/README.md`
- Schema Reference: `database/schema.sql`
- Migration Scripts: `database/migrations/`
- Seed Data: `database/seeds/dev_data.sql`

---

## Getting Help

If you encounter issues:

1. Check logs: `docker-compose logs postgres` (if using Docker)
2. Verify connection: `pg_isready -h localhost`
3. Check permissions: `psql -c "\du"` (list users)
4. Review README: `database/README.md`

---

**Ready to build?** Your database is all set up!

Next: Start the RabbitMQ services and connect your agents! 🚀
