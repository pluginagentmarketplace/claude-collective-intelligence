# Docker Development Environment

Complete Docker-based development environment for the AI Agent Orchestrator with RabbitMQ, PostgreSQL, and Redis.

## Quick Start

### One-Command Setup

```bash
./scripts/start-dev.sh
```

This single command will:
- Create necessary directories and configuration files
- Start all Docker containers (RabbitMQ, PostgreSQL, Redis)
- Wait for services to be healthy
- Initialize RabbitMQ exchanges and queues
- Set up PostgreSQL database schema
- Display all service URLs and credentials

### Manual Setup

If you prefer to run steps individually:

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Start containers
docker-compose up -d

# 3. Wait for services to be healthy (30-60 seconds)

# 4. Initialize RabbitMQ
./scripts/setup-rabbitmq.sh

# 5. Initialize PostgreSQL
./scripts/setup-database.sh
```

## Architecture

### Services

| Service | Port | Purpose |
|---------|------|---------|
| RabbitMQ | 5672 | Message broker (AMQP) |
| RabbitMQ Management | 15672 | Web UI for RabbitMQ |
| PostgreSQL | 5432 | Relational database |
| Redis | 6379 | Cache & collective consciousness |
| Adminer | 8080 | Lightweight database UI |
| PgAdmin* | 5050 | Advanced PostgreSQL UI |
| Redis Commander* | 8081 | Redis management UI |

*Only available in development mode

### Network

All services are connected via a custom bridge network (`ai-agent-network`), allowing containers to communicate using service names as hostnames.

### Volumes

Persistent data is stored in named Docker volumes:

- `ai-agent-rabbitmq-data` - RabbitMQ messages and metadata
- `ai-agent-rabbitmq-logs` - RabbitMQ logs
- `ai-agent-postgres-data` - PostgreSQL database files
- `ai-agent-redis-data` - Redis persistence
- `ai-agent-pgadmin-data` - PgAdmin settings (dev only)

## Configuration

### Environment Variables

All configuration is managed through the `.env` file. Key variables:

#### RabbitMQ
```bash
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin123
RABBITMQ_MANAGEMENT_PORT=15672
```

#### PostgreSQL
```bash
POSTGRES_USER=aiagent
POSTGRES_PASSWORD=aiagent123
POSTGRES_DB=ai_orchestrator
```

#### Redis
```bash
REDIS_PASSWORD=redis123
```

### RabbitMQ Setup

The `setup-rabbitmq.sh` script creates:

**Exchanges:**
- `agent.tasks` (topic) - Task distribution
- `agent.brainstorm` (fanout) - Collective brainstorming
- `agent.status` (topic) - Agent status updates
- `agent.results` (topic) - Task results
- `agent.deadletter` (topic) - Failed messages
- `agent.collective` (topic) - Collective intelligence
- `agent.voting` (fanout) - Voting system

**Queues:**
- `agent.tasks.high` - High priority tasks
- `agent.tasks.normal` - Normal priority tasks
- `agent.tasks.low` - Low priority tasks
- `agent.results` - Task results
- `agent.brainstorm.responses` - Brainstorming responses
- `agent.status.updates` - Status updates
- `agent.deadletter.queue` - Dead letter queue
- `agent.collective.insights` - Collective insights
- `agent.voting.ballots` - Voting ballots

All task queues include dead-letter exchange configuration with 5-minute TTL.

### Database Schema

The `setup-database.sh` script creates:

**Tables:**
- `agents` - Agent registry and status
- `tasks` - Task tracking and history
- `collective_insights` - Shared knowledge base
- `voting_sessions` - Voting system data
- `agent_metrics` - Performance metrics

**Features:**
- UUID primary keys
- JSONB columns for flexible data
- Automatic `updated_at` triggers
- Comprehensive indexes
- Foreign key relationships

## Usage

### Starting the Environment

```bash
# Development mode (with UI tools)
./scripts/start-dev.sh

# Production mode (minimal services)
./scripts/start-dev.sh --prod

# Detached mode (background)
./scripts/start-dev.sh -d

# Rebuild containers
./scripts/start-dev.sh --rebuild

# Setup only (don't show logs)
./scripts/start-dev.sh --setup-only
```

### Accessing Services

#### RabbitMQ Management UI
```
URL: http://localhost:15672
Username: admin
Password: admin123
```

Features:
- Queue monitoring
- Message inspection
- Connection tracking
- Exchange management

#### PostgreSQL (via Adminer)
```
URL: http://localhost:8080
System: PostgreSQL
Server: postgres
Username: aiagent
Password: aiagent123
Database: ai_orchestrator
```

#### PostgreSQL (via PgAdmin - Dev Only)
```
URL: http://localhost:5050
Email: admin@aiagent.local
Password: admin123
```

Pre-configured server connection available in left sidebar.

#### Redis (via Redis Commander - Dev Only)
```
URL: http://localhost:8081
Username: admin
Password: admin123
```

### Managing Containers

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f rabbitmq
docker-compose logs -f postgres
docker-compose logs -f redis

# Stop all services
docker-compose down

# Stop and remove volumes (DESTRUCTIVE)
docker-compose down -v

# Restart specific service
docker-compose restart rabbitmq

# Check service health
docker-compose ps
```

### Database Operations

```bash
# Connect to PostgreSQL
docker exec -it ai-agent-postgres psql -U aiagent -d ai_orchestrator

# Run SQL file
docker exec -i ai-agent-postgres psql -U aiagent -d ai_orchestrator < yourfile.sql

# Backup database
docker exec ai-agent-postgres pg_dump -U aiagent ai_orchestrator > backup.sql

# Restore database
docker exec -i ai-agent-postgres psql -U aiagent -d ai_orchestrator < backup.sql
```

### RabbitMQ Operations

```bash
# Access RabbitMQ CLI
docker exec -it ai-agent-rabbitmq rabbitmqctl status

# List queues
docker exec ai-agent-rabbitmq rabbitmqctl list_queues

# List exchanges
docker exec ai-agent-rabbitmq rabbitmqctl list_exchanges

# Purge queue
docker exec ai-agent-rabbitmq rabbitmqctl purge_queue agent.tasks.high
```

### Redis Operations

```bash
# Access Redis CLI
docker exec -it ai-agent-redis redis-cli -a redis123

# Monitor commands
docker exec ai-agent-redis redis-cli -a redis123 MONITOR

# Get info
docker exec ai-agent-redis redis-cli -a redis123 INFO
```

## Development Workflow

### 1. Start Environment
```bash
./scripts/start-dev.sh -d
```

### 2. Develop Your Application
```bash
# Install dependencies
npm install

# Run tests
npm test

# Start orchestrator
npm start
```

### 3. Monitor Services
- RabbitMQ UI: http://localhost:15672
- Database UI: http://localhost:8080
- Redis UI: http://localhost:8081

### 4. Stop Environment
```bash
docker-compose down
```

## Database Migrations

### Creating Migrations

1. Create a new SQL file in `docker/postgres/migrations/`:
```bash
touch docker/postgres/migrations/002_add_feature.sql
```

2. Write your migration:
```sql
-- Migration: Add feature X
ALTER TABLE agents ADD COLUMN IF NOT EXISTS feature_x TEXT;
CREATE INDEX IF NOT EXISTS idx_agents_feature ON agents(feature_x);

SELECT 'Migration 002 completed' AS status;
```

3. Run migrations:
```bash
./scripts/setup-database.sh
```

Migrations are executed in alphabetical order and are idempotent (safe to run multiple times).

### Seed Data

For development, place SQL files in `docker/postgres/seed/`:

```bash
# Create seed data
cat > docker/postgres/seed/test_data.sql << 'EOF'
INSERT INTO agents (agent_id, agent_name, agent_type, status) VALUES
    ('test-001', 'Test Agent', 'worker', 'online')
ON CONFLICT (agent_id) DO NOTHING;
EOF

# Reload seed data
./scripts/setup-database.sh
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker info

# Check for port conflicts
lsof -i :5672  # RabbitMQ
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# View container logs
docker-compose logs
```

### RabbitMQ Connection Issues

```bash
# Check RabbitMQ is ready
docker exec ai-agent-rabbitmq rabbitmq-diagnostics ping

# Check user permissions
docker exec ai-agent-rabbitmq rabbitmqctl list_permissions

# Reset RabbitMQ
docker-compose restart rabbitmq
./scripts/setup-rabbitmq.sh
```

### Database Connection Issues

```bash
# Check PostgreSQL is ready
docker exec ai-agent-postgres pg_isready -U aiagent

# Check connections
docker exec ai-agent-postgres psql -U aiagent -d ai_orchestrator -c "SELECT count(*) FROM pg_stat_activity;"

# Reset database
docker-compose down postgres
docker volume rm ai-agent-postgres-data
docker-compose up -d postgres
./scripts/setup-database.sh
```

### Redis Connection Issues

```bash
# Check Redis is ready
docker exec ai-agent-redis redis-cli -a redis123 ping

# Check memory usage
docker exec ai-agent-redis redis-cli -a redis123 INFO memory

# Reset Redis
docker-compose restart redis
```

### Clean Slate Reset

To completely reset the environment:

```bash
# Stop everything
docker-compose down -v

# Remove all volumes
docker volume rm ai-agent-rabbitmq-data
docker volume rm ai-agent-rabbitmq-logs
docker volume rm ai-agent-postgres-data
docker volume rm ai-agent-redis-data

# Start fresh
./scripts/start-dev.sh --rebuild
```

## Production Deployment

For production deployment:

1. **Update credentials** in `.env`:
```bash
# Use strong passwords
RABBITMQ_PASSWORD=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
```

2. **Use production mode**:
```bash
./scripts/start-dev.sh --prod -d
```

3. **Configure resource limits** in `docker-compose.yml`:
```yaml
services:
  rabbitmq:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

4. **Enable SSL/TLS** for connections

5. **Set up monitoring** and alerting

6. **Configure backups** for persistent volumes

## Health Checks

All services include health checks:

```bash
# Check all services
docker-compose ps

# Detailed health status
docker inspect --format='{{.State.Health.Status}}' ai-agent-rabbitmq
docker inspect --format='{{.State.Health.Status}}' ai-agent-postgres
docker inspect --format='{{.State.Health.Status}}' ai-agent-redis
```

## Resource Usage

Typical resource consumption:

| Service | CPU | Memory | Disk |
|---------|-----|--------|------|
| RabbitMQ | 5-15% | 200-500 MB | 100 MB |
| PostgreSQL | 2-10% | 100-300 MB | 500 MB |
| Redis | 1-5% | 50-200 MB | 50 MB |

## Directory Structure

```
project/
├── docker/
│   ├── README.md                    # This file
│   ├── rabbitmq/
│   │   ├── enabled_plugins          # RabbitMQ plugins
│   │   └── rabbitmq.conf           # RabbitMQ configuration
│   ├── postgres/
│   │   ├── init/                   # Initialization scripts
│   │   ├── migrations/             # Schema migrations
│   │   └── seed/                   # Development seed data
│   └── pgadmin/
│       └── servers.json            # PgAdmin server config
├── scripts/
│   ├── start-dev.sh               # Main startup script
│   ├── setup-rabbitmq.sh          # RabbitMQ initialization
│   └── setup-database.sh          # Database initialization
├── docker-compose.yml             # Main compose file
├── docker-compose.dev.yml         # Development overrides
└── .env.example                   # Environment template
```

## Support

For issues or questions:

1. Check logs: `docker-compose logs -f`
2. Verify health: `docker-compose ps`
3. Review this README
4. Check the main project README

## License

This Docker setup is part of the AI Agent Orchestrator project and shares the same MIT license.
