# Database Integration Layer

Complete PostgreSQL data access layer for the AI Agent Orchestrator system.

## Overview

This module provides a production-ready database integration layer using `node-postgres (pg)` with the following features:

- **Connection Pooling**: Efficient connection management with configurable pool settings
- **Transaction Support**: Safe multi-operation transactions with automatic rollback
- **Query Builders**: Fluent API for building SELECT, INSERT, UPDATE, and DELETE queries
- **Repository Pattern**: Clean separation of data access logic per domain
- **Migration Management**: Schema versioning and migration runner
- **Error Handling**: Comprehensive error handling and query logging
- **Performance Monitoring**: Slow query detection and pool statistics

## Architecture

```
scripts/database/
├── db-client.js              # PostgreSQL client wrapper with pooling
├── migrations-runner.js      # Database migration management
└── repositories/
    ├── index.js              # Central export for all repositories
    ├── agent-repository.js
    ├── task-repository.js
    ├── voting-repository.js
    ├── brainstorm-repository.js
    ├── gamification-repository.js
    ├── reputation-repository.js
    ├── battle-repository.js
    ├── leaderboard-repository.js
    ├── mentorship-repository.js
    ├── rewards-repository.js
    └── penalties-repository.js
```

## Setup

### 1. Install Dependencies

```bash
npm install pg
```

### 2. Configure Environment

Add the following to your `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_orchestrator
DB_USER=aiagent
DB_PASSWORD=aiagent123
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=60000
DB_QUERY_TIMEOUT=60000
```

### 3. Initialize Database

```bash
# Connect to database client
node scripts/database/db-client.js

# Run migrations
node scripts/database/migrations-runner.js run
```

## Usage

### Basic Query Execution

```javascript
import dbClient from './scripts/database/db-client.js';

// Connect to database
await dbClient.connect();

// Execute a query
const result = await dbClient.query(
  'SELECT * FROM agents WHERE status = $1',
  ['active']
);

// Close connection
await dbClient.close();
```

### Using Query Builders

```javascript
// SELECT query
const agents = await dbClient.select('agents')
  .columns('agent_id', 'agent_name', 'status')
  .where('status', 'active')
  .orderBy('created_at', 'DESC')
  .limit(10)
  .execute();

// INSERT query
const newAgent = await dbClient.insert('agents')
  .values({
    agent_id: 'agent-1',
    agent_name: 'Test Agent',
    status: 'idle'
  })
  .returning('*')
  .execute();

// UPDATE query
const updatedAgent = await dbClient.update('agents')
  .set({ status: 'busy' })
  .where('agent_id', 'agent-1')
  .returning('*')
  .execute();

// DELETE query
const deleted = await dbClient.delete('agents')
  .where('agent_id', 'agent-1')
  .execute();
```

### Using Transactions

```javascript
import dbClient from './scripts/database/db-client.js';

const result = await dbClient.transaction(async (client) => {
  // All queries within this block are part of the transaction
  const agent = await client.query(
    'INSERT INTO agents (agent_id, agent_name) VALUES ($1, $2) RETURNING *',
    ['agent-1', 'Test Agent']
  );

  await client.query(
    'INSERT INTO tasks (task_id, assigned_agent_id) VALUES ($1, $2)',
    ['task-1', agent.rows[0].agent_id]
  );

  return agent.rows[0];
});
// Transaction automatically commits or rolls back on error
```

### Using Repositories

```javascript
import { agentRepository, taskRepository } from './scripts/database/repositories/index.js';

// Create an agent
const agent = await agentRepository.create({
  agentId: 'agent-1',
  agentName: 'Claude Agent',
  agentType: 'worker',
  capabilities: ['coding', 'testing']
});

// Find agent by ID
const foundAgent = await agentRepository.findById('agent-1');

// Update agent status
await agentRepository.updateStatus('agent-1', 'busy');

// Update heartbeat
await agentRepository.updateHeartbeat('agent-1');

// Create a task
const task = await taskRepository.create({
  taskId: 'task-1',
  taskType: 'code_review',
  priority: 'high',
  payload: { file: 'test.js' }
});

// Dequeue task (with locking)
const nextTask = await taskRepository.dequeue('agent-1');

// Update task status
await taskRepository.updateStatus('task-1', 'completed', {
  result: { success: true }
});
```

## Repositories

### AgentRepository
- **CRUD operations** for agents
- **Statistics updates** (tasks completed, messages processed)
- **Heartbeat management**
- **Status tracking**

### TaskRepository
- **Queue operations** (enqueue, dequeue with locking)
- **Task lifecycle** management
- **Retry handling**
- **Task history** and statistics

### VotingRepository
- **Proposal management**
- **Vote casting** and tallying
- **Audit logging**
- **Voting results** calculation

### BrainstormRepository
- **Session management**
- **Idea submission** and voting
- **Session statistics**
- **Top ideas** retrieval

### GamificationRepository
- **Points** and experience tracking
- **Level and tier** management
- **Achievement** awards
- **Leaderboards**

### ReputationRepository
- **Trust scores** and ratings
- **Reputation events**
- **Multi-dimensional scoring** (trust, reliability, quality, collaboration)

### BattleRepository
- **Match creation** and management
- **ELO rating** calculations
- **Battle history**
- **Leaderboard rankings**

### LeaderboardRepository
- **Multi-metric rankings** (points, ELO, reputation)
- **Snapshot creation** for historical tracking
- **Hall of Fame** management
- **Combined rankings**

### MentorshipRepository
- **Pairing management**
- **Progress tracking**
- **Session recording**
- **Mentorship statistics**

### RewardsRepository
- **Allocation management**
- **Redemption handling**
- **Permission grants** and revocations
- **Expiration tracking**

### PenaltiesRepository
- **Violation tracking**
- **Penalty application**
- **Appeal management**
- **Statistics and summaries**

## Migrations

### Run Migrations

```bash
node scripts/database/migrations-runner.js run
```

### Check Migration Status

```bash
node scripts/database/migrations-runner.js status
```

### Create New Migration

```bash
node scripts/database/migrations-runner.js create add_user_table
```

This creates two files:
- `YYYYMMDDHHMMSS_add_user_table.sql` - Forward migration
- `YYYYMMDDHHMMSS_add_user_table.rollback.sql` - Rollback migration

### Rollback Last Migration

```bash
node scripts/database/migrations-runner.js rollback
```

### Reset Database (DANGEROUS!)

```bash
node scripts/database/migrations-runner.js reset --confirm
```

## Performance Monitoring

### Pool Statistics

```javascript
const stats = dbClient.getPoolStats();
console.log('Pool Stats:', stats);
// { total: 10, idle: 8, waiting: 0 }
```

### Slow Query Detection

Queries taking longer than 1 second are automatically logged:

```
Slow query detected (1234ms): SELECT * FROM tasks WHERE...
```

## Error Handling

All repository methods include comprehensive error handling:

```javascript
try {
  const agent = await agentRepository.findById('agent-1');
} catch (error) {
  console.error('Database error:', error.message);
  // Error includes query details for debugging
}
```

## Testing

Run unit tests:

```bash
npm run test:unit -- tests/unit/database/repositories.test.js
```

## Best Practices

1. **Always use parameterized queries** to prevent SQL injection
2. **Use transactions** for multi-step operations
3. **Close connections** when done (especially in scripts)
4. **Monitor pool statistics** in production
5. **Use prepared statements** for frequently executed queries
6. **Handle errors gracefully** and log for debugging
7. **Keep migrations** in version control
8. **Test migrations** before deploying to production

## Connection Pool Configuration

Optimal settings depend on your workload:

- **DB_POOL_MAX**: Maximum connections (default: 20)
- **DB_POOL_MIN**: Minimum idle connections (default: 5)
- **DB_IDLE_TIMEOUT**: Time before idle connection is closed (default: 30s)
- **DB_CONNECTION_TIMEOUT**: Max time to wait for connection (default: 10s)
- **DB_STATEMENT_TIMEOUT**: Max execution time per statement (default: 60s)

## Troubleshooting

### Connection Issues

```javascript
// Test connection
try {
  await dbClient.connect();
  console.log('Database connected successfully');
} catch (error) {
  console.error('Connection failed:', error);
}
```

### Query Debugging

Enable query logging by setting:
```env
LOG_LEVEL=debug
```

### Pool Exhaustion

If you see "waiting" connections in pool stats:
- Increase `DB_POOL_MAX`
- Reduce `DB_CONNECTION_TIMEOUT`
- Check for connection leaks (unreleased clients)

## License

MIT
