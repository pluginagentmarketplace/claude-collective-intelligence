# Service Access Guide

**AI Agent RabbitMQ Orchestrator - Development Environment**
**Last Updated:** December 7, 2025
**Environment:** Development (Docker Compose)

---

## 🎯 Quick Access Dashboard

| Service | URL | Status |
|---------|-----|--------|
| **PostgreSQL** | `localhost:5432` | ✅ Operational |
| **pgAdmin** | http://localhost:5050 | ✅ Operational |
| **Redis** | `localhost:6379` | ✅ Operational |
| **RedisInsight** | http://localhost:8001 | ✅ Operational |
| **Redis Commander** | http://localhost:8081 | ✅ Operational |
| **RabbitMQ AMQP** | `localhost:5672` | ✅ Operational |
| **RabbitMQ Management** | http://localhost:15672 | ✅ Operational |
| **Prometheus** | http://localhost:9090 | ✅ Operational |
| **Grafana** | http://localhost:3000 | ✅ Operational |

---

## 🗄️ PostgreSQL Database

### Connection Details

**Service:** PostgreSQL 15.3
**Host:** `localhost`
**Port:** `5432`
**Database:** `agent_orchestrator`

### Default Credentials (Development)

```
Username: admin
Password: postgres123
```

### Connection String

```bash
# psql CLI
psql -h localhost -p 5432 -U admin -d agent_orchestrator

# Connection URL
postgresql://admin:postgres123@localhost:5432/agent_orchestrator
```

### Common Operations

```bash
# List all databases
docker exec -it agent_postgres psql -U admin -l

# Connect to database
docker exec -it agent_postgres psql -U admin -d agent_orchestrator

# List all tables
docker exec -it agent_postgres psql -U admin -d agent_orchestrator -c '\dt'

# Table count
docker exec -it agent_postgres psql -U admin -d agent_orchestrator -c "SELECT COUNT(*) FROM agents;"

# View schema
docker exec -it agent_postgres psql -U admin -d agent_orchestrator -c '\d+ agents'
```

### Health Check

```bash
# Quick health check
docker exec agent_postgres pg_isready -U admin

# Detailed health
curl -f http://localhost:5432 2>&1 | grep -q "postgres" && echo "PostgreSQL is running"
```

---

## 🎨 pgAdmin - PostgreSQL Web UI

### Access Information

**URL:** http://localhost:5050
**Service:** pgAdmin 4

### Default Credentials (Development)

```
Email: admin@example.com
Password: pgadmin123
```

### First-Time Server Setup

After logging in, add server connection:

1. **Right-click "Servers" → Create → Server**
2. **General Tab:**
   - Name: `AI Agent Orchestrator`
3. **Connection Tab:**
   - Host: `postgres` (Docker network name)
   - Port: `5432`
   - Maintenance database: `agent_orchestrator`
   - Username: `admin`
   - Password: `postgres123`
   - Save password: ✓

### Features

- Visual query builder
- Database schema explorer
- SQL query editor with syntax highlighting
- Query history and favorites
- Export data (CSV, JSON, Excel)
- Database backup/restore
- Performance monitoring

---

## 🔴 Redis Cache

### Connection Details

**Service:** Redis 7.0
**Host:** `localhost`
**Port:** `6379`

### Default Credentials (Development)

```
Password: redis123
```

### Connection Commands

```bash
# redis-cli (requires password)
redis-cli -h localhost -p 6379 -a redis123

# Test connection
redis-cli -h localhost -p 6379 -a redis123 PING
# Expected output: PONG

# Connection URL
redis://:redis123@localhost:6379/0
```

### Common Operations

```bash
# Get all keys
docker exec agent_redis redis-cli -a redis123 KEYS '*'

# Get value
docker exec agent_redis redis-cli -a redis123 GET mykey

# Set value
docker exec agent_redis redis-cli -a redis123 SET mykey myvalue

# Database info
docker exec agent_redis redis-cli -a redis123 INFO

# Monitor commands in real-time
docker exec -it agent_redis redis-cli -a redis123 MONITOR

# Clear all data (⚠️ DEVELOPMENT ONLY)
docker exec agent_redis redis-cli -a redis123 FLUSHALL
```

### Health Check

```bash
# Quick ping
docker exec agent_redis redis-cli -a redis123 PING

# Detailed health
docker exec agent_redis redis-cli -a redis123 INFO server
```

---

## 🔍 RedisInsight - Redis Web UI

### Access Information

**URL:** http://localhost:8001
**Service:** RedisInsight (Latest)

### First-Time Setup

1. Open http://localhost:8001
2. Click **"Add Redis Database"**
3. **Connection Settings:**
   - Host: `redis` (Docker network name) or `localhost`
   - Port: `6379`
   - Database Alias: `AI Agent Cache`
   - Username: _(leave empty)_
   - Password: `redis123`
4. Click **"Add Redis Database"**

### Features

- Real-time key browser with search
- Visual data viewer (strings, hashes, lists, sets, sorted sets)
- CLI terminal built-in
- Memory analysis and profiling
- Slow log analyzer
- Pub/Sub monitor
- Command execution with auto-complete

### Common Tasks

- **Browse Keys:** Click database → Browser tab
- **Execute Commands:** CLI tab → type command
- **Monitor Performance:** Analysis → Memory
- **View Slow Queries:** Analysis → Slow Log

---

## 🎮 Redis Commander - Alternative Redis UI

### Access Information

**URL:** http://localhost:8081
**Service:** Redis Commander

### Default Credentials (Development)

```
Username: admin
Password: commander123
```

### Features

- Lightweight web-based Redis management
- Key-value editor with JSON formatting
- Tree view for hierarchical keys
- Command line interface
- Multiple database support
- Import/Export capabilities

### When to Use

- Quick key inspection
- Editing JSON values with syntax highlighting
- Lightweight alternative to RedisInsight
- CI/CD integration (headless mode)

---

## 🐰 RabbitMQ Message Broker

### AMQP Connection (Application)

**Service:** RabbitMQ 3.12.14
**Protocol:** AMQP 0-9-1
**Host:** `localhost`
**Port:** `5672`

### Default Credentials (Development)

```
Username: admin
Password: rabbitmq123
```

### Connection String

```bash
# AMQP URL
amqp://admin:rabbitmq123@localhost:5672

# With vhost
amqp://admin:rabbitmq123@localhost:5672/%2F
```

### Application Integration

```javascript
// Node.js example (amqplib)
const amqp = require('amqplib');

const connection = await amqp.connect('amqp://admin:rabbitmq123@localhost:5672');
const channel = await connection.createChannel();
```

```python
# Python example (pika)
import pika

credentials = pika.PlainCredentials('admin', 'rabbitmq123')
parameters = pika.ConnectionParameters('localhost', 5672, '/', credentials)
connection = pika.BlockingConnection(parameters)
channel = connection.channel()
```

### Health Check

```bash
# Quick health
docker exec agent_rabbitmq rabbitmq-diagnostics ping

# Node health
docker exec agent_rabbitmq rabbitmq-diagnostics check_running

# Full health check
docker exec agent_rabbitmq rabbitmq-diagnostics status
```

---

## 🎛️ RabbitMQ Management UI

### Access Information

**URL:** http://localhost:15672
**Service:** RabbitMQ Management Plugin

### Default Credentials (Development)

```
Username: admin
Password: rabbitmq123
```

### Features

- **Overview Dashboard:**
  - Message rates (publish/deliver/ack)
  - Queue totals and states
  - Node health and memory usage
  - Connection and channel counts

- **Queues Tab:**
  - Create/delete queues
  - Publish/get messages manually
  - Purge queue contents
  - View message details

- **Exchanges Tab:**
  - List all exchanges
  - Create custom exchanges
  - View bindings
  - Publish test messages

- **Connections Tab:**
  - Active client connections
  - Channel details per connection
  - Force close connections

- **Admin Tab:**
  - User management
  - Virtual host (vhost) management
  - Policies and limits
  - Federation and clustering

### Common Tasks

**Check Message Queue:**
1. Navigate to **Queues** tab
2. Click queue name (e.g., `tasks`)
3. View message count, rates, consumers

**Publish Test Message:**
1. **Exchanges** tab → Click exchange name
2. **Publish message** section
3. Set routing key and payload
4. Click **Publish message**

**Monitor Message Flow:**
1. **Overview** tab
2. View **Message rates** graph
3. Check **Queued messages** chart

### API Access

```bash
# Get overview (requires auth)
curl -u admin:rabbitmq123 http://localhost:15672/api/overview

# List queues
curl -u admin:rabbitmq123 http://localhost:15672/api/queues

# List exchanges
curl -u admin:rabbitmq123 http://localhost:15672/api/exchanges

# Get queue details
curl -u admin:rabbitmq123 http://localhost:15672/api/queues/%2F/tasks
```

---

## 📊 Prometheus - Metrics & Monitoring

### Access Information

**URL:** http://localhost:9090
**Service:** Prometheus 2.x

### Authentication

**None** (Development environment)

### Features

- Time-series metrics database
- PromQL query language
- Built-in expression browser
- Target health monitoring
- Alert rule evaluation

### Quick Start

**View All Metrics:**
1. Open http://localhost:9090
2. Click **Graph** tab
3. Start typing metric name (auto-complete)
4. Click **Execute**

**Common Queries:**

```promql
# CPU usage
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100

# Disk usage
(node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes * 100

# PostgreSQL connections
pg_stat_database_numbackends{datname="agent_orchestrator"}

# Redis memory
redis_memory_used_bytes

# RabbitMQ queue messages
rabbitmq_queue_messages{queue="tasks"}
```

### Scrape Targets

Navigate to **Status → Targets** to view:

| Target | Endpoint | Status |
|--------|----------|--------|
| prometheus | localhost:9090/metrics | ✅ UP |
| postgres | postgres-exporter:9187/metrics | ✅ UP |
| rabbitmq | rabbitmq:15692/metrics | ✅ UP |
| redis | redis-exporter:9121/metrics | ✅ UP |
| node | node-exporter:9100/metrics | ✅ UP |
| cadvisor | cadvisor:8080/metrics | ✅ UP |

### Alert Rules

Alert rules loaded from:
- `/etc/prometheus/alert.rules.yml`
- `/etc/prometheus/recording.rules.yml`

View active alerts: **Alerts** tab

### Health Check

```bash
# Prometheus health
curl http://localhost:9090/-/healthy

# Readiness
curl http://localhost:9090/-/ready

# Config status
curl http://localhost:9090/api/v1/status/config
```

---

## 📈 Grafana - Visualization & Dashboards

### Access Information

**URL:** http://localhost:3000
**Service:** Grafana OSS

### Default Credentials (Development)

```
Username: admin
Password: grafana123
```

### First-Time Setup

**Add Prometheus Data Source:**

1. Login to Grafana
2. **Configuration** (⚙️) → **Data Sources**
3. Click **Add data source**
4. Select **Prometheus**
5. **Settings:**
   - Name: `Prometheus`
   - URL: `http://prometheus:9090`
   - Access: `Server (default)`
6. Click **Save & Test**
7. Should show: ✅ "Data source is working"

### Pre-Built Dashboards

**Import Popular Dashboards:**

1. **Dashboards** (☰) → **Import**
2. Enter dashboard ID:
   - **1860** - Node Exporter Full
   - **9628** - PostgreSQL Database
   - **10991** - RabbitMQ Overview
   - **11835** - Redis Dashboard
   - **193** - Docker Container Monitoring
3. Select **Prometheus** data source
4. Click **Import**

### Creating Custom Dashboard

```
1. Dashboards → New Dashboard → Add visualization
2. Select "Prometheus" data source
3. Enter PromQL query
4. Configure visualization type (graph, gauge, table)
5. Set time range and refresh interval
6. Save dashboard
```

### Common Dashboards

**System Metrics:**
- CPU, Memory, Disk, Network per node
- Container resource usage (cAdvisor)

**Application Metrics:**
- RabbitMQ queue depth, message rates
- PostgreSQL connections, query performance
- Redis hit/miss ratio, memory usage

**Custom Metrics:**
- Agent task completion rates
- Brainstorm session activity
- Voting system participation

### Health Check

```bash
# Grafana API health
curl http://localhost:3000/api/health

# Check data sources
curl -u admin:grafana123 http://localhost:3000/api/datasources
```

---

## 🔧 Monitoring Exporters

### PostgreSQL Exporter

**Service:** postgres-exporter
**Port:** `9187` (internal only)
**Endpoint:** `http://postgres-exporter:9187/metrics`

**Metrics Provided:**
- Database connections and activity
- Table sizes and row counts
- Query performance statistics
- Replication lag (if configured)

**Access from host:**
```bash
# Via Prometheus
curl http://localhost:9090/api/v1/query?query=pg_stat_database_numbackends

# Direct (if exposed)
docker exec agent_postgres_exporter wget -qO- http://localhost:9187/metrics
```

### Redis Exporter

**Service:** redis-exporter
**Port:** `9121` (internal only)
**Endpoint:** `http://redis-exporter:9121/metrics`

**Metrics Provided:**
- Memory usage and fragmentation
- Key statistics (total, expires, evicted)
- Command statistics
- Replication info (if configured)

**Access from host:**
```bash
# Via Prometheus
curl http://localhost:9090/api/v1/query?query=redis_memory_used_bytes

# Direct (if exposed)
docker exec agent_redis_exporter wget -qO- http://localhost:9121/metrics
```

### Node Exporter

**Service:** node-exporter
**Port:** `9100` (internal only)
**Endpoint:** `http://node-exporter:9100/metrics`

**Metrics Provided:**
- CPU usage by mode (user, system, idle, iowait)
- Memory and swap usage
- Disk I/O and filesystem usage
- Network interface statistics
- System load averages

### cAdvisor (Container Metrics)

**Service:** cadvisor
**Port:** `8080` (internal only)
**Endpoint:** `http://cadvisor:8080/metrics`

**Metrics Provided:**
- Container CPU usage
- Container memory usage and limits
- Container network I/O
- Container filesystem I/O
- Container process counts

---

## 🚀 Quick Start Guide

### Starting All Services

```bash
# Development environment (recommended)
docker compose \
  -f infrastructure/docker/compose/docker-compose.yml \
  -f infrastructure/docker/compose/override.dev.yml \
  up -d

# With monitoring stack
docker compose \
  -f infrastructure/docker/compose/docker-compose.yml \
  -f infrastructure/docker/compose/override.dev.yml \
  -f infrastructure/docker/compose/override.monitoring.yml \
  up -d

# Check all services
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Verifying Services

```bash
# PostgreSQL
docker exec agent_postgres pg_isready -U admin

# Redis
docker exec agent_redis redis-cli -a redis123 PING

# RabbitMQ
docker exec agent_rabbitmq rabbitmq-diagnostics ping

# Prometheus
curl -s http://localhost:9090/-/healthy

# Grafana
curl -s http://localhost:3000/api/health
```

### Stopping Services

```bash
# Stop all services
docker compose \
  -f infrastructure/docker/compose/docker-compose.yml \
  -f infrastructure/docker/compose/override.dev.yml \
  down

# Stop and remove volumes (⚠️ DATA LOSS)
docker compose \
  -f infrastructure/docker/compose/docker-compose.yml \
  -f infrastructure/docker/compose/override.dev.yml \
  down -v
```

---

## 🔒 Security Notes

### ⚠️ Development Credentials Warning

**All credentials listed in this document are FOR DEVELOPMENT ONLY.**

**DO NOT use these credentials in production environments!**

### Production Deployment

For production:

1. **Generate Strong Passwords:**
   ```bash
   # Generate random password
   openssl rand -base64 32
   ```

2. **Use Environment Variables:**
   - Store in `.env.production` (not committed to git)
   - Use Docker secrets for sensitive data
   - Rotate credentials regularly

3. **Enable SSL/TLS:**
   - PostgreSQL: Require SSL connections
   - Redis: Enable TLS mode
   - RabbitMQ: Configure SSL listeners
   - Prometheus/Grafana: Use reverse proxy with HTTPS

4. **Network Isolation:**
   - Use internal Docker networks
   - Expose only necessary ports
   - Configure firewall rules

5. **Access Control:**
   - Implement role-based access (RBAC)
   - Use VPN for remote access
   - Enable audit logging

---

## 🐛 Troubleshooting

### Service Not Accessible

**Problem:** Can't access service on expected port

**Solutions:**

1. **Check if container is running:**
   ```bash
   docker ps | grep agent_
   ```

2. **Check port mapping:**
   ```bash
   docker port agent_postgres
   docker port agent_rabbitmq
   ```

3. **Check container logs:**
   ```bash
   docker logs agent_postgres --tail 50
   docker logs agent_rabbitmq --tail 50
   ```

4. **Verify network connectivity:**
   ```bash
   docker network inspect agent_network
   ```

### Authentication Failed

**Problem:** Invalid credentials error

**Solutions:**

1. **Verify credentials** from this document
2. **Check environment variables** in docker-compose file
3. **Reset admin user:**
   ```bash
   # PostgreSQL
   docker exec -it agent_postgres psql -U postgres -c "ALTER USER admin PASSWORD 'postgres123';"

   # RabbitMQ
   docker exec agent_rabbitmq rabbitmqctl change_password admin rabbitmq123
   ```

### Performance Issues

**Problem:** Slow response times

**Solutions:**

1. **Check resource usage:**
   ```bash
   docker stats
   ```

2. **View service metrics** in Grafana dashboards
3. **Check PostgreSQL connections:**
   ```bash
   docker exec agent_postgres psql -U admin -d agent_orchestrator -c \
     "SELECT count(*) FROM pg_stat_activity;"
   ```

4. **Check Redis memory:**
   ```bash
   docker exec agent_redis redis-cli -a redis123 INFO memory
   ```

5. **Check RabbitMQ queues:**
   ```bash
   docker exec agent_rabbitmq rabbitmqctl list_queues
   ```

---

## 📚 Additional Resources

### Official Documentation

- **PostgreSQL:** https://www.postgresql.org/docs/
- **Redis:** https://redis.io/documentation
- **RabbitMQ:** https://www.rabbitmq.com/documentation.html
- **Prometheus:** https://prometheus.io/docs/
- **Grafana:** https://grafana.com/docs/

### Internal Documentation

- **Architecture:** `docs/ARCHITECTURE.md`
- **Database Schema:** `infrastructure/docker/postgres/migrations/001_initial_schema.sql`
- **Docker Compose:** `infrastructure/docker/compose/`
- **Monitoring Setup:** `infrastructure/docker/monitoring/`

### Health Check Script

Automated health check for all services:

```bash
./scripts/infrastructure/health-check.sh
```

Or run integration tests:

```bash
/tmp/test_service_integration.sh
```

---

**Document Version:** 1.0.0
**Last Updated:** December 7, 2025
**Environment:** Development (Docker Compose)
**Status:** ✅ All Services Operational
