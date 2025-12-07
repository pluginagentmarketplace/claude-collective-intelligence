# Development Environment Setup

One-time initialization scripts for setting up development environment.

## Quick Start

```bash
# Complete setup (all services)
./setup-database.sh && \
./setup-rabbitmq.sh && \
./start-dev.sh
```

---

## Scripts Overview

### setup-database.sh
**Purpose:** Initialize PostgreSQL database
**Actions:**
- Create database schemas
- Run initial migrations
- Create default users and roles
- Seed development data (if applicable)
- Configure connection pooling

**Prerequisites:**
- PostgreSQL 15+ installed
- Superuser credentials available

**Example:**
```bash
./setup-database.sh
# Creating database 'claude_collective'...
# ✅ Database created
# Running migrations...
# ✅ 23 migrations applied
# Creating roles...
# ✅ Roles: admin, agent_user, readonly
# Seeding development data...
# ✅ 500 sample agents created
# ✅ 1,200 sample tasks created
#
# Database setup complete!
# Connection: postgresql://localhost:5432/claude_collective
```

**Configuration:**
```bash
# Environment variables
export DB_NAME=claude_collective
export DB_USER=admin
export DB_PASSWORD=secret
export DB_HOST=localhost
export DB_PORT=5432
```

---

### setup-rabbitmq.sh
**Purpose:** Initialize RabbitMQ message broker
**Actions:**
- Create virtual hosts
- Create queues (tasks, results, brainstorm)
- Create exchanges (fanout, topic, direct)
- Configure bindings
- Create users and permissions
- Enable management plugin
- Set resource limits

**Prerequisites:**
- RabbitMQ 3.12+ installed
- Admin credentials available

**Example:**
```bash
./setup-rabbitmq.sh
# Creating virtual host '/claude'...
# ✅ Virtual host created
# Creating queues...
# ✅ Queue: agent.tasks (durable)
# ✅ Queue: agent.results (durable)
# ✅ Queue: agent.brainstorm (fanout)
# Creating exchanges...
# ✅ Exchange: agent.direct (direct)
# ✅ Exchange: agent.fanout (fanout)
# ✅ Exchange: agent.topic (topic)
# Creating users...
# ✅ User: admin (administrator)
# ✅ User: agent_user (read/write)
# Enabling plugins...
# ✅ rabbitmq_management enabled
#
# RabbitMQ setup complete!
# Management UI: http://localhost:15672
# Login: admin / rabbitmq123
```

**Configuration:**
```bash
# Environment variables
export RABBITMQ_HOST=localhost
export RABBITMQ_PORT=5672
export RABBITMQ_MGMT_PORT=15672
export RABBITMQ_USER=admin
export RABBITMQ_PASSWORD=rabbitmq123
export RABBITMQ_VHOST=/claude
```

---

### start-dev.sh
**Purpose:** Start all development services
**Starts:**
- PostgreSQL database
- RabbitMQ message broker
- Redis cache
- Monitoring stack (Prometheus, Grafana)
- All application containers

**Example:**
```bash
./start-dev.sh
# Starting development environment...
# ✅ PostgreSQL: Started (port 5432)
# ✅ RabbitMQ: Started (port 5672, management 15672)
# ✅ Redis: Started (port 6379)
# ✅ Prometheus: Started (port 9090)
# ✅ Grafana: Started (port 3000)
# ✅ Application: Started (port 8080)
#
# Development environment ready!
#
# Services:
#   - API: http://localhost:8080
#   - RabbitMQ Management: http://localhost:15672
#   - Grafana: http://localhost:3000
#   - Prometheus: http://localhost:9090
#
# Logs:
#   docker-compose logs -f
#
# Stop:
#   ./stop-dev.sh
```

**Docker Compose Integration:**
```bash
# Uses docker-compose with dev override
docker-compose \
  -f infrastructure/docker/compose/docker-compose.yml \
  -f infrastructure/docker/compose/override.dev.yml \
  up -d
```

---

### stop-dev.sh
**Purpose:** Stop all development services gracefully
**Stops:**
- All Docker containers
- Preserves data (volumes not deleted)
- Optionally cleans up

**Example:**
```bash
./stop-dev.sh
# Stopping development environment...
# ✅ Application: Stopped
# ✅ Grafana: Stopped
# ✅ Prometheus: Stopped
# ✅ Redis: Stopped
# ✅ RabbitMQ: Stopped
# ✅ PostgreSQL: Stopped
#
# Development environment stopped.
# Data preserved in volumes.
#
# To remove all data (DESTRUCTIVE):
#   ./stop-dev.sh --clean
```

**Clean Shutdown:**
```bash
# Stop and remove all data
./stop-dev.sh --clean

# Removes:
#   - All containers
#   - All volumes
#   - All networks
#
# ⚠️  WARNING: This will DELETE all development data!
```

---

## First-Time Setup Workflow

### Step 1: Install Dependencies

**macOS:**
```bash
brew install docker docker-compose postgresql@15 rabbitmq redis
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install docker.io docker-compose postgresql-15 rabbitmq-server redis-server
```

**Arch Linux:**
```bash
sudo pacman -S docker docker-compose postgresql rabbitmq redis
```

---

### Step 2: Clone Repository

```bash
git clone https://github.com/pluginagentmarketplace/claude-collective-intelligence.git
cd claude-collective-intelligence
```

---

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env

# Required variables:
#   DB_PASSWORD=<secure_password>
#   RABBITMQ_PASSWORD=<secure_password>
#   REDIS_PASSWORD=<secure_password>
```

---

### Step 4: Install Dependencies

```bash
npm install
```

---

### Step 5: Run Setup Scripts

```bash
# Setup database
./scripts/setup/setup-database.sh

# Setup RabbitMQ
./scripts/setup/setup-rabbitmq.sh
```

---

### Step 6: Start Development Environment

```bash
./scripts/setup/start-dev.sh
```

---

### Step 7: Verify Installation

```bash
# Check all services healthy
../infrastructure/health-check.sh

# Expected output:
# ✅ RabbitMQ: Healthy
# ✅ PostgreSQL: Healthy
# ✅ Redis: Healthy
# Overall: HEALTHY
```

---

## Development Workflow

### Daily Development

```bash
# Morning: Start services
./scripts/setup/start-dev.sh

# Work on code...
# Services running in background

# Evening: Stop services
./scripts/setup/stop-dev.sh
```

### Database Migrations

```bash
# Create new migration
npm run migration:create -- add_agent_status

# Run pending migrations
npm run migration:run

# Rollback last migration
npm run migration:revert
```

### Reset Development Data

```bash
# Stop services
./scripts/setup/stop-dev.sh

# Clean all data
./scripts/setup/stop-dev.sh --clean

# Rebuild from scratch
./scripts/setup/setup-database.sh
./scripts/setup/setup-rabbitmq.sh
./scripts/setup/start-dev.sh
```

---

## Troubleshooting

### PostgreSQL Setup Fails

**Symptom:** `setup-database.sh` exits with error

**Common Causes:**
1. PostgreSQL not running
   ```bash
   sudo systemctl start postgresql
   ```

2. Wrong credentials
   ```bash
   # Check .env file
   cat .env | grep DB_
   ```

3. Database already exists
   ```bash
   # Drop and recreate
   dropdb claude_collective
   ./scripts/setup/setup-database.sh
   ```

---

### RabbitMQ Setup Fails

**Symptom:** `setup-rabbitmq.sh` exits with error

**Common Causes:**
1. RabbitMQ not running
   ```bash
   sudo systemctl start rabbitmq-server
   ```

2. Management plugin not enabled
   ```bash
   sudo rabbitmq-plugins enable rabbitmq_management
   ```

3. Port already in use
   ```bash
   # Check what's using port 5672
   sudo lsof -i :5672
   # Kill process or change RabbitMQ port
   ```

---

### Docker Containers Won't Start

**Symptom:** `start-dev.sh` hangs or fails

**Common Causes:**
1. Docker daemon not running
   ```bash
   sudo systemctl start docker
   ```

2. Port conflicts
   ```bash
   # Check ports
   sudo netstat -tulpn | grep -E '5432|5672|6379|9090|3000|8080'
   ```

3. Insufficient resources
   ```bash
   # Check Docker resource limits
   docker system df
   docker system prune -a  # Clean up if needed
   ```

---

## Environment Variables Reference

### Database Configuration
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=claude_collective
DB_USER=admin
DB_PASSWORD=<secure_password>
DB_POOL_MIN=2
DB_POOL_MAX=10
```

### RabbitMQ Configuration
```bash
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_MGMT_PORT=15672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=<secure_password>
RABBITMQ_VHOST=/claude
RABBITMQ_HEARTBEAT=30
```

### Redis Configuration
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<secure_password>
REDIS_DB=0
```

### Application Configuration
```bash
NODE_ENV=development
PORT=8080
LOG_LEVEL=debug
```

---

## Additional Resources

- [Database Migrations Guide](../../docs/guides/DATABASE-MIGRATIONS.md)
- [RabbitMQ Configuration Guide](../../docs/guides/RABBITMQ-CONFIG.md)
- [Docker Development Guide](../../docs/guides/DOCKER-DEV.md)
- [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)

---

*Last Updated: 2025-12-07*
*Part of Repository Reorganization Phase 1*
