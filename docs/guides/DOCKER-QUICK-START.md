# Docker Quick Start Guide

Get your AI Agent Orchestrator development environment running in 60 seconds!

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed (comes with Docker Desktop)
- Bash shell (Mac/Linux/WSL)

## Quick Start

### Method 1: Automated Script (Recommended)

```bash
# Start everything with one command
./scripts/start-dev.sh
```

This will:
1. Create `.env` file if needed
2. Start RabbitMQ, PostgreSQL, and Redis
3. Initialize all exchanges, queues, and database schema
4. Display service URLs and credentials

### Method 2: Using Makefile

```bash
# Create environment file
make env

# Start Docker environment
make docker-up

# Check health
make health

# View URLs
make urls
```

### Method 3: Manual Docker Compose

```bash
# Copy environment template
cp .env.example .env

# Start services
docker-compose up -d

# Wait 30 seconds, then initialize
./scripts/setup-rabbitmq.sh
./scripts/setup-database.sh
```

## Access Your Services

After startup, access these URLs:

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| **RabbitMQ UI** | http://localhost:15672 | admin | admin123 |
| **Database UI** | http://localhost:8080 | aiagent | aiagent123 |
| **PgAdmin** | http://localhost:5050 | admin@aiagent.local | admin123 |
| **Redis UI** | http://localhost:8081 | admin | admin123 |

## Common Commands

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f rabbitmq

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Check health
./scripts/health-check.sh

# Stop and clean everything (DESTRUCTIVE)
./scripts/stop-dev.sh --clean-all
```

## With Makefile

```bash
make docker-up        # Start environment
make docker-down      # Stop environment
make docker-logs      # View logs
make health           # Health check
make urls             # Show all URLs
make rabbitmq-queues  # List RabbitMQ queues
make db-connect       # Connect to PostgreSQL
make redis-cli        # Access Redis CLI
```

## Run Your Application

Once Docker services are running:

```bash
# Install dependencies (first time only)
npm install

# Run tests
npm test

# Start the orchestrator
npm start

# Start monitoring
npm run monitor
```

## Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker info

# Check for port conflicts
lsof -i :5672 :5432 :6379 :15672
```

### Reset everything
```bash
# Complete reset (DESTRUCTIVE - deletes all data)
make docker-clean-all

# Start fresh
make docker-up
```

### View service status
```bash
# Container status
docker-compose ps

# Detailed health check
make health
```

## What Gets Created

### Docker Containers
- `ai-agent-rabbitmq` - Message broker
- `ai-agent-postgres` - Database
- `ai-agent-redis` - Cache/state
- `ai-agent-adminer` - DB UI
- `ai-agent-pgadmin` - Advanced DB UI (dev mode)
- `ai-agent-redis-commander` - Redis UI (dev mode)

### RabbitMQ Resources
- 7 exchanges (tasks, brainstorm, status, results, deadletter, collective, voting)
- 9 queues (high/normal/low priority, results, brainstorm, status, deadletter, collective, voting)
- Automatic bindings with routing keys

### Database Tables
- `agents` - Agent registry
- `tasks` - Task tracking
- `collective_insights` - Shared knowledge
- `voting_sessions` - Voting data
- `agent_metrics` - Performance metrics

### Persistent Volumes
- RabbitMQ data and logs
- PostgreSQL database
- Redis data
- PgAdmin settings

## Development Workflow

```bash
# 1. Start environment (once per session)
make docker-up

# 2. Develop your code
# ... make changes ...

# 3. Run tests
make test

# 4. Check service health
make health

# 5. View RabbitMQ queues
make rabbitmq-queues

# 6. When done, stop services
make docker-down
```

## Production Mode

Run without development UIs:

```bash
./scripts/start-dev.sh --prod -d
```

Or with Makefile:

```bash
make docker-up-prod
```

## Need Help?

- **Full Documentation**: See `/docker/README.md`
- **Makefile Commands**: Run `make help`
- **Script Options**: Run `./scripts/start-dev.sh --help`

## Environment Variables

All configuration is in `.env` file. Key variables:

```bash
# RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin123

# PostgreSQL
POSTGRES_USER=aiagent
POSTGRES_PASSWORD=aiagent123
POSTGRES_DB=ai_orchestrator

# Redis
REDIS_PASSWORD=redis123
```

**Security Note**: Change these passwords in production!

---

**That's it!** You're ready to develop with the AI Agent Orchestrator.

For advanced usage, see the [full Docker documentation](docker/README.md).
