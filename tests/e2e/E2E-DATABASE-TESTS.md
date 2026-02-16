# E2E Integration Tests with Database Persistence

Comprehensive end-to-end tests using **real RabbitMQ + PostgreSQL** infrastructure.

## Overview

These tests verify complete system integration including:
- Real RabbitMQ message broker
- Real PostgreSQL database
- Complete agent lifecycles
- Data persistence and consistency
- Audit trail verification

## New Database-Backed Tests

### 1. Complete Agent Lifecycle (`complete-agent-lifecycle.test.js`)

Full agent journey from registration to rewards:
- ✅ Agent registration in database
- ✅ Task assignment via RabbitMQ
- ✅ Points awarded across categories
- ✅ Tier progression (Bronze → Silver → Gold)
- ✅ Achievement unlocking
- ✅ Leaderboard updates with database queries

**Run:**
```bash
node tests/e2e/complete-agent-lifecycle.test.js
```

### 2. Mentorship Flow (`mentorship-flow.test.js`)

Complete mentorship lifecycle with persistence:
- ✅ Mentor/mentee pairing in database
- ✅ Training sessions via RabbitMQ
- ✅ Progress tracking in PostgreSQL
- ✅ Skill development metrics
- ✅ Graduation process
- ✅ Rewards and recognition

**Run:**
```bash
node tests/e2e/mentorship-flow.test.js
```

### 3. Gamification Flow (`gamification-flow.test.js`)

Comprehensive gamification with database:
- ✅ Points across all 5 categories
- ✅ Tier progression (Bronze → Diamond)
- ✅ Streak bonuses and multipliers
- ✅ Penalty system with rehabilitation
- ✅ Leaderboard rankings
- ✅ Points history audit trail

**Run:**
```bash
node tests/e2e/gamification-flow.test.js
```

### 4. Voting Persistence (`voting-persistence.test.js`)

Democratic voting with full audit trail:
- ✅ Voting sessions in database
- ✅ Vote casting via RabbitMQ
- ✅ Multiple algorithms (majority, weighted, consensus)
- ✅ Quorum validation
- ✅ Results persistence
- ✅ Complete vote history

**Run:**
```bash
node tests/e2e/voting-persistence.test.js
```

### 5. Battle System E2E (`battle-system-e2e.test.js`)

Competitive battles with ELO persistence:
- ✅ Initial ELO ratings (1000)
- ✅ 1v1 and multi-agent battles
- ✅ ELO calculations and updates
- ✅ Multiple battle modes
- ✅ Battle history tracking
- ✅ ELO leaderboard

**Run:**
```bash
node tests/e2e/battle-system-e2e.test.js
```

## Quick Start

### 1. Start Test Infrastructure

```bash
# Start RabbitMQ and PostgreSQL
docker-compose -f docker-compose.test.yml up -d

# Wait for services (10-15 seconds)
docker-compose -f docker-compose.test.yml ps
```

### 2. Verify Services

**RabbitMQ Management:**
- URL: http://localhost:15673
- User: `test_user`
- Pass: `test_password`

**PostgreSQL:**
- Host: `localhost`
- Port: `5433`
- Database: `ai_agents_test`
- User: `test_user`

### 3. Run Tests

```bash
# Run all database tests
npm run test:e2e

# Or run individually
node tests/e2e/complete-agent-lifecycle.test.js
node tests/e2e/mentorship-flow.test.js
node tests/e2e/gamification-flow.test.js
node tests/e2e/voting-persistence.test.js
node tests/e2e/battle-system-e2e.test.js
```

### 4. Cleanup

```bash
# Stop and remove containers + volumes
docker-compose -f docker-compose.test.yml down -v
```

## Database Schema

The PostgreSQL test database includes:

### Core Tables
- `agents` - Agent profiles with stats and ELO
- `agent_points` - Current point balances
- `points_history` - Complete audit trail

### Gamification
- `achievements` - Achievement definitions
- `agent_achievements` - Unlocked achievements
- `penalties` - Violations and rehabilitation

### Collaboration
- `voting_sessions` - Democratic decisions
- `votes` - Vote records with audit
- `mentorships` - Training programs
- `brainstorm_sessions` - Idea generation

### Competition
- `battles` - Battle records
- `battle_participants` - Participant stats
- ELO rating tracking

### Performance
- `leaderboard` - Materialized view for fast queries

See `tests/e2e/sql/init.sql` for complete schema.

## Test Infrastructure

```
┌──────────────────────────────────────────┐
│           Test Script                     │
└─────────────┬────────────────────────────┘
              │
        ┌─────┴──────┐
        │            │
        ▼            ▼
   ┌─────────┐  ┌──────────┐
   │RabbitMQ │  │PostgreSQL│
   │ (5673)  │  │  (5433)  │
   └─────────┘  └──────────┘
        │            │
        └──── ✓ ─────┘
     Real Integration
```

## Key Features

### 1. No Mocks - Real Infrastructure
- Actual RabbitMQ message passing
- Real PostgreSQL transactions
- True data persistence verification

### 2. Complete Workflows
- Multi-step agent lifecycles
- Cross-system data flow
- End-to-end verification

### 3. Audit Trails
- All point transactions logged
- Vote history maintained
- Battle results persisted
- Complete transparency

### 4. Automatic Cleanup
- Database tables truncated
- Queues deleted
- No test pollution

## Environment Variables

Configure if needed (defaults shown):

```bash
# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5673
RABBITMQ_USER=test_user
RABBITMQ_PASS=test_password

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=test_user
POSTGRES_PASSWORD=test_password
POSTGRES_DB=ai_agents_test
```

## Test Helpers

Located in `tests/helpers/test-setup.js`:

```javascript
import { setupTestEnvironment, teardownTestEnvironment } from './helpers/test-setup.js';

// Setup
const { db, mq } = await setupTestEnvironment();

// Use database
await db.createAgent(agentId, { name: 'Test Agent' });
await db.awardPoints(agentId, 'speed', 100, {});

// Use RabbitMQ
await mq.publish('agent.tasks', 'task.new', { taskId });

// Cleanup
await teardownTestEnvironment({ db, mq });
```

## Performance

Typical execution times with real infrastructure:

| Test | Duration |
|------|----------|
| Complete Agent Lifecycle | ~2-3s |
| Mentorship Flow | ~2-3s |
| Gamification Flow | ~3-4s |
| Voting Persistence | ~2-3s |
| Battle System E2E | ~2-3s |
| **Total Suite** | **~15s** |

## Troubleshooting

### Connection Errors

```bash
# Check containers
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs rabbitmq-test
docker-compose -f docker-compose.test.yml logs postgres-test

# Restart
docker-compose -f docker-compose.test.yml restart
```

### Database Not Initialized

```bash
# Recreate everything
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
sleep 15
```

### Port Conflicts

Edit `docker-compose.test.yml`:
```yaml
ports:
  - "5674:5672"  # Change 5673 to 5674
  - "5434:5432"  # Change 5433 to 5434
```

## CI/CD Integration

```yaml
name: E2E Database Tests

jobs:
  test:
    steps:
      - uses: actions/checkout@v3

      - name: Start infrastructure
        run: docker-compose -f docker-compose.test.yml up -d

      - name: Wait for services
        run: sleep 15

      - name: Run tests
        run: npm run test:e2e

      - name: Cleanup
        run: docker-compose -f docker-compose.test.yml down -v
```

## What's Tested

✅ **Data Persistence**
- Agent profiles survive system restarts
- Points accurately tracked in database
- Voting results permanently stored

✅ **Message + Database Sync**
- RabbitMQ events trigger DB updates
- Database changes reflected in messages
- Consistency maintained

✅ **Audit Trails**
- Every point transaction logged
- Complete vote history
- Battle outcome records

✅ **Complex Workflows**
- Multi-step agent journeys
- Cross-system integrations
- State management

✅ **Constraints & Validation**
- Database constraints enforced
- Foreign keys prevent orphans
- Data integrity maintained

## Best Practices

1. **Always use setupTestEnvironment()** - Ensures clean state
2. **Generate unique IDs** - Prevent test conflicts
3. **Verify database after RabbitMQ** - Check persistence
4. **Check audit trails** - Ensure complete logging
5. **Always cleanup** - Use teardownTestEnvironment()

## License

MIT
