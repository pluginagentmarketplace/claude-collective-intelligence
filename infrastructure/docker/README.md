# Docker Infrastructure Documentation

**Claude Collective Intelligence - Multi-Agent RabbitMQ Orchestrator**
**Last Updated:** December 7, 2025 (Week 2 Phase 4)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Docker Compose Files](#docker-compose-files)
4. [Quick Start](#quick-start)
5. [Environment-Specific Usage](#environment-specific-usage)
6. [Service Descriptions](#service-descriptions)
7. [Configuration Files](#configuration-files)
8. [Networking](#networking)
9. [Volumes & Persistence](#volumes--persistence)
10. [Monitoring & Observability](#monitoring--observability)
11. [Security Best Practices](#security-best-practices)
12. [Troubleshooting](#troubleshooting)
13. [Production Deployment](#production-deployment)

---

## Overview

This directory contains the complete Docker infrastructure for the AI Agent RabbitMQ Orchestrator platform, organized using **Docker Compose override pattern** for environment-specific configurations.

**Key Benefits:**
- ✅ **Single Base File** - Core services defined once
- ✅ **Environment Overrides** - Dev, test, staging, production configs
- ✅ **Comprehensive Monitoring** - Prometheus, Grafana, ELK, Jaeger unified
- ✅ **Production-Ready** - Security hardening, performance tuning, resource limits
- ✅ **Well-Documented** - Clear separation of concerns

---

## Directory Structure

```
infrastructure/docker/
├── compose/
│   ├── docker-compose.yml              # BASE - Core services
│   ├── override.dev.yml                # Development extras
│   ├── override.test.yml               # Testing environment
│   ├── override.staging.yml            # Staging configuration
│   ├── override.production.yml         # Production optimizations
│   └── override.monitoring.yml         # Complete observability stack
│
├── postgres/
│   ├── init/                           # Initialization scripts
│   ├── migrations/                     # Database migrations
│   │   └── 001_initial_schema.sql
│   ├── seeds/                          # Development seed data
│   │   └── dev_data.sql
│   ├── schema.sql                      # Complete schema reference
│   ├── setup.sh                        # Setup automation
│   ├── DATABASE_README.md              # PostgreSQL documentation
│   └── QUICKSTART.md                   # Quick setup guide
│
├── rabbitmq/
│   ├── rabbitmq.conf                   # RabbitMQ configuration
│   ├── enabled_plugins                 # Enabled plugins list
│   └── setup.sh                        # RabbitMQ setup script
│
└── monitoring/
    ├── prometheus.yml                  # Prometheus config
    ├── alert.rules.yml                 # Alert rules (11 groups)
    ├── recording.rules.yml             # Recording rules (pre-computed metrics)
    ├── grafana/
    │   ├── dashboards/                 # Grafana dashboards
    │   └── provisioning/               # Auto-provisioning configs
    └── logstash/
        ├── pipeline/                   # Logstash pipelines
        └── patterns/                   # Grok patterns
```

---

## Docker Compose Files

### Base File: `docker-compose.yml` (297 lines)

**Core Services:**
- `postgres` - PostgreSQL 15 database
- `redis` - Redis 7 cache & session store
- `rabbitmq` - RabbitMQ 3.12 message broker
- `pgadmin` - PostgreSQL management UI
- `redis-insight` - Redis visualization
- `redis-commander` - Redis management
- `prometheus` - Metrics collection
- `grafana` - Metrics visualization
- `postgres-exporter` - PostgreSQL metrics
- `redis-exporter` - Redis metrics

**Networks:**
- `agent_network` (172.28.0.0/16)

**Volumes:**
- `postgres_data`, `redis_data`, `rabbitmq_data`, `rabbitmq_logs`
- `pgadmin_data`, `redis_insight_data`
- `prometheus_data`, `grafana_data`

---

### Override Files

#### 1. `override.dev.yml` (89 lines)

**Purpose:** Development environment enhancements

**Features:**
- Verbose logging (DEBUG level)
- Auto-restart on code changes
- Development seed data loading
- Redis Commander UI
- Exposed management ports

**Usage:**
```bash
docker-compose -f docker-compose.yml -f override.dev.yml up
```

---

#### 2. `override.test.yml` (121 lines)

**Purpose:** Testing environment isolation

**Features:**
- Minimal service set (no UIs)
- Ephemeral containers (restart: no)
- Test database isolation
- Fast startup optimization
- No persistent volumes

**Usage:**
```bash
docker-compose -f docker-compose.yml -f override.test.yml up --abort-on-container-exit
```

---

#### 3. `override.staging.yml` (419 lines)

**Purpose:** Pre-production staging environment

**Features:**
- Production-like configuration
- Secure credentials (env-based)
- Resource limits enforced
- Comprehensive logging
- Staging-specific networking

**Usage:**
```bash
docker-compose -f docker-compose.yml -f override.staging.yml up
```

---

#### 4. `override.production.yml` (365 lines)

**Purpose:** Production-grade optimizations and security

**Features:**

**PostgreSQL:**
- `max_connections=500`
- `shared_buffers=2GB`
- `effective_cache_size=6GB`
- Connection pooling optimizations
- Resource limits (4 CPU, 8GB RAM)

**RabbitMQ:**
- Erlang cookie for clustering
- File descriptor limits (65536)
- Memory watermark: 60%
- Disk free limit: 2GB

**Redis:**
- AOF persistence + RDB snapshots
- `maxmemory=4GB`
- LRU eviction policy
- Connection limits: 10,000

**Security:**
- No exposed ports (internal networking only)
- Strong password requirements
- TLS/SSL ready
- Secrets from environment

**Logging:**
- Compressed JSON logs
- Max size: 50MB per file
- Max files: 5
- Rotation enabled

**Usage:**
```bash
docker-compose -f docker-compose.yml -f override.production.yml up -d
```

**Required Environment Variables:**
```bash
POSTGRES_PASSWORD
RABBITMQ_ERLANG_COOKIE
RABBITMQ_USER
RABBITMQ_PASSWORD
REDIS_PASSWORD
PGADMIN_EMAIL
PGADMIN_PASSWORD
REDIS_COMMANDER_USER
REDIS_COMMANDER_PASSWORD
GRAFANA_USER
GRAFANA_PASSWORD
GRAFANA_SECRET_KEY
```

---

#### 5. `override.monitoring.yml` (469 lines)

**Purpose:** Complete enterprise observability stack

**Components:**

**Metrics & Alerting:**
- Prometheus (metrics collection)
- Grafana (visualization)
- Alertmanager (alert routing)
- Node Exporter (system metrics)
- cAdvisor (container metrics)

**Logging (ELK Stack):**
- Elasticsearch (3-node cluster)
- Logstash (log processing)
- Kibana (log visualization)

**Distributed Tracing:**
- Jaeger Agent (span collection)
- Jaeger Collector (span storage)
- Jaeger Query (span retrieval)
- Jaeger UI (tracing visualization)

**APM:**
- Elastic APM Server

**Exporters:**
- PostgreSQL Exporter
- Redis Exporter
- RabbitMQ Exporter
- Blackbox Exporter (endpoint monitoring)

**Usage:**
```bash
# Development + Monitoring
docker-compose -f docker-compose.yml -f override.dev.yml -f override.monitoring.yml up

# Production + Monitoring
docker-compose -f docker-compose.yml -f override.production.yml -f override.monitoring.yml up -d
```

---

## Quick Start

### Prerequisites

```bash
# Install Docker and Docker Compose
docker --version  # >= 20.10
docker-compose --version  # >= 1.29

# Clone repository
git clone <repository-url>
cd project-12-plugin-ai-agent-rabbitmq
```

### Development Setup

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start development environment
cd infrastructure/docker
docker-compose -f compose/docker-compose.yml -f compose/override.dev.yml up

# 3. Verify services
docker ps  # Check all containers running
docker logs agent_rabbitmq  # Check RabbitMQ logs
```

### Access Services

- **RabbitMQ Management:** http://localhost:15672 (admin / rabbitmq123)
- **PostgreSQL:** localhost:5432 (admin / postgres123)
- **pgAdmin:** http://localhost:5050 (admin@example.com / pgadmin123)
- **Redis Commander:** http://localhost:8081 (admin / commander123)
- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000 (admin / grafana123)

---

## Environment-Specific Usage

### Development

```bash
docker-compose -f compose/docker-compose.yml -f compose/override.dev.yml up
```

**Features:** Hot reload, debug logging, seed data

### Testing

```bash
docker-compose -f compose/docker-compose.yml -f compose/override.test.yml up --abort-on-container-exit
npm test  # Run integration tests
```

**Features:** Isolated environment, ephemeral containers

### Staging

```bash
docker-compose -f compose/docker-compose.yml -f compose/override.staging.yml up -d
```

**Features:** Production-like, secure credentials

### Production

```bash
# Set required environment variables
export POSTGRES_PASSWORD="$(openssl rand -base64 32)"
export RABBITMQ_PASSWORD="$(openssl rand -base64 32)"
export REDIS_PASSWORD="$(openssl rand -base64 32)"
# ... (set all required vars)

# Deploy
docker-compose -f compose/docker-compose.yml -f compose/override.production.yml up -d

# Verify
docker-compose -f compose/docker-compose.yml -f compose/override.production.yml ps
```

### Production + Full Monitoring

```bash
docker-compose \
  -f compose/docker-compose.yml \
  -f compose/override.production.yml \
  -f compose/override.monitoring.yml \
  up -d
```

---

## Service Descriptions

### PostgreSQL

**Purpose:** Primary relational database

**Configuration:**
- Image: `postgres:15-alpine`
- Port: 5432 (internal only in production)
- Volume: `postgres_data:/var/lib/postgresql/data`

**Environment Variables:**
- `POSTGRES_DB` - Database name
- `POSTGRES_USER` - Admin username
- `POSTGRES_PASSWORD` - Admin password

**Migrations:**
Located in `postgres/migrations/`, automatically run on first start via `/docker-entrypoint-initdb.d`

---

### RabbitMQ

**Purpose:** Message broker for multi-agent communication

**Configuration:**
- Image: `rabbitmq:3.12-management-alpine`
- Ports: 5672 (AMQP), 15672 (Management UI)
- Volume: `rabbitmq_data:/var/lib/rabbitmq`

**Plugins Enabled:**
- `rabbitmq_management` - Web UI
- `rabbitmq_prometheus` - Metrics export
- `rabbitmq_shovel` - Message forwarding

**Configuration File:** `rabbitmq/rabbitmq.conf`

---

### Redis

**Purpose:** Cache and session store

**Configuration:**
- Image: `redis:7-alpine`
- Port: 6379
- Volume: `redis_data:/data`

**Persistence:**
- AOF (Append-Only File) enabled
- RDB snapshots configured

---

### Prometheus

**Purpose:** Metrics collection and storage

**Scrape Targets:**
- PostgreSQL Exporter (port 9187)
- Redis Exporter (port 9121)
- RabbitMQ (port 15692)
- Node Exporter (port 9100)
- cAdvisor (port 8080)

**Configuration:** `monitoring/prometheus.yml`
**Alert Rules:** `monitoring/alert.rules.yml` (11 groups, 30+ alerts)
**Recording Rules:** `monitoring/recording.rules.yml` (pre-computed metrics)

---

### Grafana

**Purpose:** Metrics visualization and dashboards

**Data Sources:**
- Prometheus (metrics)
- Loki (logs)
- Elasticsearch (logs)
- Jaeger (traces)

**Dashboards:** Located in `monitoring/grafana/dashboards/`

---

## Configuration Files

### `rabbitmq/rabbitmq.conf`

**Key Settings:**
```conf
loopback_users.guest = false
listeners.tcp.default = 5672
management.tcp.port = 15672
vm_memory_high_watermark.relative = 0.6
disk_free_limit.absolute = 2GB
heartbeat = 60
channel_max = 2048
```

### `monitoring/prometheus.yml`

**Scrape Interval:** 15s
**Evaluation Interval:** 15s
**Retention:** 15 days (dev), 90 days (production)

### `monitoring/alert.rules.yml`

**Alert Groups:**
1. Service Availability (ServiceDown, ServiceFlapping)
2. RabbitMQ (HighQueueSize, MemoryHigh, ConsumerDown)
3. PostgreSQL (HighConnections, SlowQueries, Deadlocks)
4. Redis (MemoryHigh, EvictionIncreased)
5. System Resources (HighCPU, HighMemory, DiskSpaceLow)
6. Orchestrator (HighTaskBacklog, TaskFailureRate)
7. Network (HighTraffic, InterfaceDown)
8. Security (FailedLogins, UnauthorizedAccess)
9. Containers (ContainerDown, HighMemory, Restarting)

---

## Networking

### Bridge Network: `agent_network`

**Subnet:** 172.28.0.0/16
**Driver:** bridge

**Service Communication:**
```
app → rabbitmq:5672 (AMQP)
app → postgres:5432 (SQL)
app → redis:6379 (Cache)
prometheus → exporters:9xxx (Metrics)
```

**DNS Resolution:**
Services communicate using container names (e.g., `postgres`, `rabbitmq`, `redis`)

---

## Volumes & Persistence

### Volume Types

**Named Volumes (Persistent):**
- `postgres_data` - PostgreSQL data directory
- `redis_data` - Redis AOF and RDB files
- `rabbitmq_data` - RabbitMQ queues and messages
- `prometheus_data` - Time-series metrics
- `grafana_data` - Dashboards and settings

**Bind Mounts (Configuration):**
- `./postgres/migrations` → `/docker-entrypoint-initdb.d`
- `./rabbitmq/rabbitmq.conf` → `/etc/rabbitmq/rabbitmq.conf`
- `./monitoring/prometheus.yml` → `/etc/prometheus/prometheus.yml`

### Backup Strategy

```bash
# PostgreSQL Backup
docker exec agent_postgres pg_dump -U admin agent_orchestrator > backup_$(date +%Y%m%d).sql

# Redis Backup
docker exec agent_redis redis-cli --rdb /data/backup.rdb

# Volume Backup
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz /data
```

---

## Monitoring & Observability

### Access Points

- **Prometheus:** http://localhost:9090
- **Grafana:** http://localhost:3000
- **Alertmanager:** http://localhost:9093
- **Jaeger UI:** http://localhost:16686
- **Kibana:** http://localhost:5601

### Key Metrics

**RabbitMQ:**
- Queue depth (alert if > 10,000)
- Message publishing rate
- Consumer count

**PostgreSQL:**
- Active connections (alert if > 200)
- Slow queries (alert if > 60s)
- Deadlocks

**Redis:**
- Hit rate (should be > 80%)
- Eviction rate
- Memory usage

**System:**
- CPU usage (alert if > 80%)
- Memory usage (alert if > 90%)
- Disk space (alert if < 10% free)

---

## Security Best Practices

### Development

✅ Use `.env` file for secrets (gitignored)
✅ Default passwords for local development
✅ All ports exposed for debugging

### Production

✅ **Strong Passwords:** 20+ characters, randomly generated
✅ **No Exposed Ports:** Use reverse proxy (nginx/traefik)
✅ **TLS/SSL:** Enable for all external communication
✅ **Secrets Management:** Use Vault, AWS Secrets Manager, or similar
✅ **Network Segmentation:** Separate internal/external networks
✅ **Resource Limits:** CPU/memory constraints enforced
✅ **Audit Logging:** Enable for all services
✅ **Regular Updates:** Automated security patching

### Environment Variables

**Required for Production:**
```bash
# PostgreSQL
export POSTGRES_PASSWORD="..."

# RabbitMQ
export RABBITMQ_ERLANG_COOKIE="..."
export RABBITMQ_USER="..."
export RABBITMQ_PASSWORD="..."

# Redis
export REDIS_PASSWORD="..."

# Grafana
export GRAFANA_USER="..."
export GRAFANA_PASSWORD="..."
export GRAFANA_SECRET_KEY="..."
```

---

## Troubleshooting

### Common Issues

#### 1. "Port already in use"

**Problem:** Another service is using the same port

**Solution:**
```bash
# Find process using port 5432
lsof -i :5432
# Kill process or change port in docker-compose
```

#### 2. "Container exits immediately"

**Problem:** Service configuration error

**Solution:**
```bash
# Check logs
docker-compose -f compose/docker-compose.yml logs postgres

# Validate config
docker-compose -f compose/docker-compose.yml config
```

#### 3. "Cannot connect to database"

**Problem:** Database not ready or wrong credentials

**Solution:**
```bash
# Check database health
docker exec agent_postgres pg_isready -U admin

# Verify environment variables
docker exec agent_postgres env | grep POSTGRES
```

#### 4. "RabbitMQ management UI not accessible"

**Problem:** Management plugin not enabled

**Solution:**
```bash
# Enable plugin
docker exec agent_rabbitmq rabbitmq-plugins enable rabbitmq_management

# Restart RabbitMQ
docker-compose -f compose/docker-compose.yml restart rabbitmq
```

#### 5. "Out of memory error"

**Problem:** Insufficient Docker resources

**Solution:**
```bash
# Increase Docker memory limit (Docker Desktop settings)
# Or adjust service limits in override.production.yml
```

### Debug Commands

```bash
# View all containers
docker-compose -f compose/docker-compose.yml ps

# Tail logs
docker-compose -f compose/docker-compose.yml logs -f

# Execute command in container
docker exec -it agent_postgres psql -U admin -d agent_orchestrator

# Inspect network
docker network inspect agent_network

# Check resource usage
docker stats
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All environment variables set
- [ ] Strong passwords generated
- [ ] TLS/SSL certificates acquired
- [ ] Reverse proxy configured (nginx/traefik)
- [ ] Firewall rules configured
- [ ] Backup strategy defined
- [ ] Monitoring alerts configured
- [ ] Log aggregation enabled
- [ ] Disaster recovery plan documented
- [ ] Team trained on operations

### Deployment Steps

1. **Prepare Environment**
   ```bash
   # Generate strong passwords
   export POSTGRES_PASSWORD="$(openssl rand -base64 32)"
   export RABBITMQ_PASSWORD="$(openssl rand -base64 32)"
   export REDIS_PASSWORD="$(openssl rand -base64 32)"
   # ... (all required variables)

   # Save to secure storage (Vault, AWS Secrets Manager)
   ```

2. **Deploy Services**
   ```bash
   docker-compose \
     -f compose/docker-compose.yml \
     -f compose/override.production.yml \
     -f compose/override.monitoring.yml \
     up -d
   ```

3. **Verify Deployment**
   ```bash
   # Check all containers running
   docker-compose ps

   # Verify health checks
   docker inspect agent_postgres | grep -A 10 Health

   # Test connectivity
   docker exec agent_postgres pg_isready
   docker exec agent_rabbitmq rabbitmqctl status
   docker exec agent_redis redis-cli ping
   ```

4. **Configure Monitoring**
   ```bash
   # Access Grafana
   # Import dashboards from monitoring/grafana/dashboards/
   # Configure alert notifications (email, Slack, PagerDuty)
   ```

5. **Enable Backups**
   ```bash
   # Set up automated backups (cron job)
   crontab -e
   # Add: 0 2 * * * /path/to/backup-script.sh
   ```

### Post-Deployment

- Monitor logs for first 24 hours
- Verify all alerts functioning
- Test disaster recovery procedures
- Document operational runbooks
- Schedule regular security audits

---

## Additional Resources

- **PostgreSQL Documentation:** `postgres/DATABASE_README.md`
- **RabbitMQ Setup:** `rabbitmq/setup.sh`
- **Monitoring Dashboards:** `monitoring/grafana/dashboards/`
- **Alert Rules:** `monitoring/alert.rules.yml`

---

**Last Updated:** December 7, 2025
**Maintained By:** Infrastructure Team
**Version:** 2.0.0 (Professional Override Pattern)
