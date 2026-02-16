# Staging Environment Setup & Infrastructure as Code (IaC)

Complete guide for deploying and managing the Multi-Agent AI Orchestrator in staging environments.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Local Staging (Docker Compose)](#local-staging-docker-compose)
5. [Kubernetes Staging](#kubernetes-staging)
6. [Helm Deployment](#helm-deployment)
7. [Deployment Automation](#deployment-automation)
8. [Verification & Monitoring](#verification--monitoring)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The staging environment provides a production-like setup for testing and validation before deploying to production. This guide covers multiple deployment methods:

- **Local Staging**: Docker Compose for rapid iteration
- **Kubernetes Staging**: Full Kubernetes manifests for cluster deployments
- **Helm Charts**: Templated deployments with environment-specific values
- **Automated Scripts**: Deployment, verification, rollback, and health checks

### Key Components

- **Agent Orchestrator**: Main application service
- **PostgreSQL**: Primary database with automated backups
- **Redis**: Caching and session store
- **RabbitMQ**: Message broker for agent communication
- **Prometheus/Grafana**: Monitoring and metrics visualization
- **Database Exporters**: PostgreSQL and Redis metrics exporters

---

## Architecture

### Service Dependencies

```
┌─────────────────────────────────────────────┐
│      Agent Orchestrator (Multi-instance)    │
├─────────────────────────────────────────────┤
│                                             │
├─────────────────┬──────────────┬────────────┤
│                 │              │            │
▼                 ▼              ▼            ▼
PostgreSQL      Redis         RabbitMQ    Monitoring
│                 │              │          │
├─ pgAdmin       │           │            ├─ Prometheus
├─ Backups       └─ RedisInsight         │  └─ Grafana
│                                        └─ Exporters
```

### Environment Tiers

| Tier | Resources | Purpose | Duration |
|------|-----------|---------|----------|
| Dev | Low | Development & testing | Persistent |
| Staging | Medium-High | Pre-production testing | Persistent |
| Production | High | Live traffic | Persistent |

---

## Prerequisites

### System Requirements

**Minimum for Local Staging:**
- 8GB RAM
- 4 CPU cores
- 30GB free disk space
- Docker 20.10+
- Docker Compose 1.29+

**Minimum for Kubernetes Staging:**
- Kubernetes 1.21+
- kubectl configured with cluster access
- 16GB available cluster memory
- 8 CPU cores available
- Helm 3.0+
- Persistent volume support

### Required Tools

```bash
# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install helpful tools
npm install -g dotenv-cli
```

### Environment Variables

Create `.env.staging` file:

```bash
cp .env.example .env.staging
```

Edit `.env.staging` with staging-specific values:

```bash
# Application
NODE_ENV=staging
LOG_LEVEL=info
APP_PORT=3000

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=agent_orchestrator_staging
POSTGRES_USER=staging_user
POSTGRES_PASSWORD=staging_secure_password_here
POSTGRES_POOL_MIN=5
POSTGRES_POOL_MAX=15

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_staging_password
REDIS_DB=1

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=staging_user
RABBITMQ_PASSWORD=rabbitmq_staging_password

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_USER=admin
GRAFANA_PASSWORD=staging_grafana_password

# Security
JWT_SECRET=your-staging-jwt-secret-key
ENCRYPTION_KEY=your-32-character-staging-key

# Monitoring & Alerts
ENABLE_ALERTS=true
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

---

## Local Staging (Docker Compose)

### Quick Start

1. **Prepare environment:**

```bash
cd /home/user/plugin-ai-agent-rabbitmq
cp .env.example .env.staging
# Edit .env.staging with staging values
```

2. **Start services:**

```bash
docker-compose -f docker-compose-staging.yml up -d
```

3. **Run database migrations:**

```bash
npm run migrate:up -- --env staging
```

4. **Seed initial data (optional):**

```bash
npm run db:seed -- --env staging
```

5. **Verify deployment:**

```bash
docker-compose -f docker-compose-staging.yml ps
docker-compose -f docker-compose-staging.yml logs
```

### Accessing Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Agent Orchestrator | `http://localhost:3000` | API Key (see logs) |
| RabbitMQ Management | `http://localhost:15672` | admin / rabbitmq123 |
| pgAdmin | `http://localhost:5050` | admin@example.com / pgadmin123 |
| Redis Insight | `http://localhost:8001` | Web UI |
| Prometheus | `http://localhost:9090` | No auth |
| Grafana | `http://localhost:3000` | admin / grafana123 |

### Stopping Services

```bash
# Stop all services (data persists)
docker-compose -f docker-compose-staging.yml stop

# Stop and remove containers (data persists in volumes)
docker-compose -f docker-compose-staging.yml down

# Full cleanup (removes volumes - data loss!)
docker-compose -f docker-compose-staging.yml down -v
```

---

## Kubernetes Staging

### Prerequisites

1. **Create namespace:**

```bash
kubectl create namespace staging
kubectl set-context --current --namespace=staging
```

2. **Create secrets for sensitive data:**

```bash
kubectl create secret generic postgres-credentials \
  --from-literal=username=staging_user \
  --from-literal=password='your-secure-password' \
  -n staging

kubectl create secret generic rabbitmq-credentials \
  --from-literal=username=staging_user \
  --from-literal=password='rabbitmq-secure-password' \
  -n staging

kubectl create secret generic app-secrets \
  --from-literal=jwt-secret='your-jwt-secret' \
  --from-literal=encryption-key='your-32-char-encryption-key' \
  -n staging
```

3. **Create persistent volumes (if not using dynamic provisioning):**

```bash
kubectl apply -f kubernetes/volumeclaims/postgres-pvc.yaml -n staging
kubectl apply -f kubernetes/volumeclaims/redis-pvc.yaml -n staging
kubectl apply -f kubernetes/volumeclaims/rabbitmq-pvc.yaml -n staging
```

### Deploy Kubernetes Manifests

```bash
# Deploy StatefulSets (databases)
kubectl apply -f kubernetes/statefulsets/ -n staging

# Wait for databases to be ready
kubectl wait --for=condition=ready pod \
  -l app=postgres \
  -n staging \
  --timeout=300s

# Deploy ConfigMaps
kubectl apply -f kubernetes/configmaps/ -n staging

# Deploy Services
kubectl apply -f kubernetes/services/ -n staging

# Deploy application
kubectl apply -f kubernetes/deployments/ -n staging

# Deploy Ingress
kubectl apply -f kubernetes/ingress/ -n staging
```

### Verify Kubernetes Deployment

```bash
# Check all resources
kubectl get all -n staging

# Check pod logs
kubectl logs -f deployment/agent-orchestrator -n staging

# Port forward for local testing
kubectl port-forward svc/agent-orchestrator 3000:3000 -n staging
```

---

## Helm Deployment

### Chart Structure

```
helm/agent-orchestrator/
├── Chart.yaml                 # Chart metadata
├── values.yaml               # Default values
├── values-dev.yaml           # Development values
├── values-staging.yaml       # Staging values
├── values-prod.yaml          # Production values
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml             # Horizontal Pod Autoscaler
│   ├── _helpers.tpl
│   └── NOTES.txt
└── charts/                   # Subchart dependencies
    ├── postgres/
    ├── redis/
    └── rabbitmq/
```

### Install Helm Chart

1. **Add repository (if using external charts):**

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

2. **Install chart for staging:**

```bash
# Validate chart
helm lint helm/agent-orchestrator

# Install
helm install agent-orchestrator \
  helm/agent-orchestrator \
  -f helm/agent-orchestrator/values-staging.yaml \
  -n staging \
  --create-namespace

# Or upgrade if already installed
helm upgrade agent-orchestrator \
  helm/agent-orchestrator \
  -f helm/agent-orchestrator/values-staging.yaml \
  -n staging
```

3. **Verify installation:**

```bash
helm status agent-orchestrator -n staging
helm get values agent-orchestrator -n staging
helm get manifest agent-orchestrator -n staging
```

### Helm Commands Reference

```bash
# List releases
helm list -n staging

# Get release history
helm history agent-orchestrator -n staging

# Rollback to previous release
helm rollback agent-orchestrator 1 -n staging

# Uninstall release
helm uninstall agent-orchestrator -n staging

# Package chart for distribution
helm package helm/agent-orchestrator

# Create archive with dependencies
helm dependency update helm/agent-orchestrator
```

---

## Deployment Automation

### Available Scripts

All scripts are located in `scripts/deployment/`:

#### 1. Deploy Staging Environment

```bash
./scripts/deployment/deploy-staging.sh
```

Features:
- Validates environment setup
- Creates/updates all resources
- Runs database migrations
- Executes smoke tests
- Generates deployment report

Options:
```bash
./scripts/deployment/deploy-staging.sh --env staging --skip-tests
./scripts/deployment/deploy-staging.sh --env staging --dry-run
./scripts/deployment/deploy-staging.sh --env staging --backup-first
```

#### 2. Verify Staging Deployment

```bash
./scripts/deployment/verify-staging.sh
```

Checks:
- All pods are running
- Services are accessible
- Health checks pass
- Database connectivity
- RabbitMQ connectivity
- Metrics collection active

#### 3. Rollback Deployment

```bash
./scripts/deployment/rollback-staging.sh [version]
```

Usage:
```bash
# Rollback to previous version
./scripts/deployment/rollback-staging.sh --previous

# Rollback to specific version
./scripts/deployment/rollback-staging.sh --version 1.0.0

# Show available versions
./scripts/deployment/rollback-staging.sh --list
```

#### 4. Health Checks

```bash
./scripts/deployment/health-check.sh
```

Monitors:
- Application readiness
- Database connectivity
- Redis availability
- RabbitMQ broker status
- Metrics endpoint health
- Memory and CPU usage

Options:
```bash
./scripts/deployment/health-check.sh --continuous 300  # Run for 5 minutes
./scripts/deployment/health-check.sh --alert-on-failure
./scripts/deployment/health-check.sh --generate-report health-report.json
```

### CI/CD Integration

#### GitHub Actions Example

```yaml
name: Deploy Staging

on:
  push:
    branches:
      - develop
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure kubectl
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > ~/.kube/config

      - name: Deploy staging
        run: ./scripts/deployment/deploy-staging.sh --env staging

      - name: Verify deployment
        run: ./scripts/deployment/verify-staging.sh

      - name: Run smoke tests
        run: npm run test:e2e:quick
```

---

## Verification & Monitoring

### Post-Deployment Verification

```bash
# Run health checks
./scripts/deployment/health-check.sh

# Check application status
curl -s http://localhost:3000/health | jq .

# Verify database
npm run migrate:status -- --env staging

# Test message broker
npm run test:integration:rabbitmq
```

### Monitoring Setup

#### Prometheus Metrics

```bash
# Query metrics
curl 'http://localhost:9090/api/v1/query?query=up'

# Common queries
# - Agent uptime: agent_uptime_seconds
# - Queue depth: rabbitmq_queue_messages_total
# - Database connections: pg_stat_activity_count
# - Redis memory: redis_memory_used_bytes
```

#### Grafana Dashboards

1. Import pre-built dashboards:
   - **Agent Orchestrator**: ID 11313
   - **PostgreSQL**: ID 9628
   - **Redis**: ID 11835
   - **RabbitMQ**: ID 4279

2. Create custom dashboards:
   - Application performance metrics
   - Agent health status
   - Queue depth and throughput
   - Error rates and exceptions

#### Alerts Configuration

Set up alerts in Prometheus/Grafana for:

```
- High memory usage (>80%)
- High CPU usage (>75%)
- Database connection pool exhaustion
- Queue depth > 10000
- Agent availability < 50%
- API response time > 5s (p95)
- Error rate > 1%
```

### Log Aggregation

Logs are collected from all containers:

```bash
# View orchestrator logs
docker-compose -f docker-compose-staging.yml logs agent-orchestrator

# View database logs
docker-compose -f docker-compose-staging.yml logs postgres

# View broker logs
docker-compose -f docker-compose-staging.yml logs rabbitmq

# Stream all logs
docker-compose -f docker-compose-staging.yml logs -f
```

For Kubernetes:
```bash
kubectl logs -f deployment/agent-orchestrator -n staging
kubectl logs -f statefulset/postgres -n staging
kubectl logs -f statefulset/rabbitmq -n staging
```

---

## Backup & Recovery

### Automated Backups

Backups are configured to run daily at 2:00 AM (see `docker-compose-staging.yml`).

### Manual Backup

```bash
# PostgreSQL backup
docker-compose -f docker-compose-staging.yml exec postgres \
  pg_dump -U staging_user agent_orchestrator_staging > backup.sql

# Redis backup
docker-compose -f docker-compose-staging.yml exec redis \
  redis-cli BGSAVE

# List backups
ls -lh ./backups/postgres/
ls -lh ./backups/redis/
```

### Restore from Backup

```bash
# PostgreSQL restore
docker-compose -f docker-compose-staging.yml exec -T postgres \
  psql -U staging_user agent_orchestrator_staging < backup.sql

# Redis restore
# Copy backup file to volume and restart Redis
docker-compose -f docker-compose-staging.yml restart redis
```

### Backup Retention Policy

- Daily backups kept for 7 days
- Weekly backups kept for 4 weeks
- Monthly backups kept for 12 months
- Automatic cleanup of old backups

Configure in `.env.staging`:
```bash
BACKUP_RETENTION_DAYS=7
BACKUP_RETENTION_WEEKS=4
BACKUP_RETENTION_MONTHS=12
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different ports in .env.staging
```

#### 2. Database Connection Fails

```bash
# Check database is running
docker-compose -f docker-compose-staging.yml ps postgres

# Check logs
docker-compose -f docker-compose-staging.yml logs postgres

# Test connection
docker-compose -f docker-compose-staging.yml exec postgres \
  psql -U staging_user -d agent_orchestrator_staging -c "SELECT 1"
```

#### 3. RabbitMQ Connection Issues

```bash
# Verify RabbitMQ is running
docker-compose -f docker-compose-staging.yml exec rabbitmq \
  rabbitmq-diagnostics status

# Check credentials
docker-compose -f docker-compose-staging.yml exec rabbitmq \
  rabbitmq-diagnostics auth_attempts
```

#### 4. Out of Memory

```bash
# Check resource usage
docker stats

# Increase Docker memory limit in Docker Desktop
# Settings > Resources > Memory > Increase to 8GB+

# Or limit services
# In docker-compose-staging.yml, add:
# resources:
#   limits:
#     memory: 1G
```

#### 5. Kubernetes Pod Pending

```bash
# Check events
kubectl describe pod <pod-name> -n staging

# Check resource availability
kubectl top nodes
kubectl top pods -n staging

# Check persistent volume availability
kubectl get pvc -n staging
```

### Debug Mode

Enable debug logging:

```bash
# Docker Compose
DEBUG=* docker-compose -f docker-compose-staging.yml up

# Kubernetes
kubectl set env deployment/agent-orchestrator \
  DEBUG=* \
  LOG_LEVEL=debug \
  -n staging

# Node.js
NODE_DEBUG=* npm start
```

### Performance Tuning

#### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'pending';

-- Create indexes
CREATE INDEX idx_tasks_status ON tasks(status);

-- Vacuum and analyze
VACUUM ANALYZE;
```

#### Redis Optimization

```bash
# Monitor Redis commands
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory

# Optimize memory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### RabbitMQ Optimization

```bash
# Monitor queue depth
rabbitmqctl list_queues

# Monitor connections
rabbitmqctl list_connections

# Monitor channel performance
rabbitmqctl list_channels
```

---

## Maintenance

### Regular Tasks

**Daily:**
- Monitor application logs
- Check error rates
- Verify backup completion

**Weekly:**
- Review performance metrics
- Analyze slow queries
- Check disk space usage

**Monthly:**
- Full health audit
- Capacity planning
- Security updates

### Upgrade Procedure

```bash
# 1. Create backup
./scripts/deployment/backup-staging.sh

# 2. Deploy new version
./scripts/deployment/deploy-staging.sh --env staging --version 1.1.0

# 3. Run smoke tests
npm run test:e2e:quick

# 4. Monitor for issues
./scripts/deployment/health-check.sh --continuous 600

# 5. Rollback if needed
./scripts/deployment/rollback-staging.sh --previous
```

---

## Production Checklist

Before deploying to production, ensure:

- [ ] All tests passing (unit, integration, e2e)
- [ ] Security scanning completed (SAST, dependency check)
- [ ] Performance testing completed (load, stress, soak)
- [ ] Backup and recovery tested
- [ ] Monitoring and alerting configured
- [ ] Runbook documentation complete
- [ ] Team trained on deployment procedures
- [ ] Staging environment fully validated
- [ ] Rollback procedure tested
- [ ] Change management approval obtained

---

## Support & Documentation

For more information:

- **Kubernetes Docs**: https://kubernetes.io/docs/
- **Helm Docs**: https://helm.sh/docs/
- **Docker Docs**: https://docs.docker.com/
- **Project README**: See `/home/user/plugin-ai-agent-rabbitmq/README.md`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-11-18 | Initial staging setup guide |

---

**Last Updated**: November 18, 2024
**Maintained By**: Ultra Agent Team
