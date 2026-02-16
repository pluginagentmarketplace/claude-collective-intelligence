# Staging Environment - Quick Start Guide

Fast-track setup for testing and validation of the Multi-Agent AI Orchestrator.

---

## Quick Start - Docker Compose (Local Staging)

### 1. Setup Environment

```bash
cd /home/user/plugin-ai-agent-rabbitmq

# Copy environment file
cp .env.example .env.staging

# Edit with staging values (optional)
# vi .env.staging
```

### 2. Start Services

```bash
# Deploy entire staging environment
docker-compose -f docker-compose-staging.yml up -d

# Wait for services to be healthy (check logs)
docker-compose -f docker-compose-staging.yml logs -f
```

### 3. Run Migrations

```bash
# Run database migrations
npm run migrate:up -- --env staging

# Or with Docker
docker-compose -f docker-compose-staging.yml exec agent-orchestrator npm run migrate:up
```

### 4. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose-staging.yml ps

# Run health checks
./scripts/deployment/health-check.sh --type docker-compose
```

### 5. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Application | http://localhost:3000 | API keys in logs |
| RabbitMQ | http://localhost:15672 | admin / rabbitmq123 |
| pgAdmin | http://localhost:5050 | admin@example.com / pgadmin123 |
| Redis Insight | http://localhost:8001 | Web UI |
| Grafana | http://localhost:3001 | admin / grafana123 |
| Prometheus | http://localhost:9090 | No auth |

### 6. Stop Services

```bash
# Stop all services (preserve data)
docker-compose -f docker-compose-staging.yml stop

# Clean up (preserve data in volumes)
docker-compose -f docker-compose-staging.yml down

# Full cleanup (WARNING: deletes all data!)
docker-compose -f docker-compose-staging.yml down -v
```

---

## Quick Start - Kubernetes

### 1. Prerequisites

```bash
# Ensure kubectl is configured
kubectl config current-context

# Ensure Helm is installed
helm version
```

### 2. Create Namespace

```bash
kubectl create namespace staging
kubectl set-context --current --namespace=staging
```

### 3. Create Secrets

```bash
# Create database credentials
kubectl create secret generic postgres-credentials \
  --from-literal=username=staging_user \
  --from-literal=password='secure-password-here' \
  -n staging

# Create cache credentials
kubectl create secret generic redis-credentials \
  --from-literal=password='redis-password-here' \
  -n staging

# Create broker credentials
kubectl create secret generic rabbitmq-credentials \
  --from-literal=username=staging_user \
  --from-literal=password='rabbitmq-password-here' \
  --from-literal=erlang-cookie='erlang-cookie-here' \
  -n staging

# Create app secrets
kubectl create secret generic app-secrets \
  --from-literal=jwt-secret='jwt-secret-here' \
  --from-literal=encryption-key='32-character-encryption-key' \
  -n staging
```

### 4. Deploy with Helm

```bash
# Validate chart
helm lint ./helm/agent-orchestrator

# Install or upgrade
helm upgrade --install agent-orchestrator \
  ./helm/agent-orchestrator \
  -f ./helm/agent-orchestrator/values-staging.yaml \
  -n staging \
  --create-namespace

# Wait for deployment
kubectl wait --for=condition=ready pod \
  -l app=agent-orchestrator \
  -n staging \
  --timeout=300s
```

### 5. Verify Deployment

```bash
# Check resources
kubectl get all -n staging

# View logs
kubectl logs -f deployment/agent-orchestrator -n staging

# Run health checks
./scripts/deployment/verify-staging.sh
```

### 6. Access Services

```bash
# Port forward to application
kubectl port-forward svc/agent-orchestrator 3000:3000 -n staging

# In another terminal, access
curl http://localhost:3000/health
```

---

## Automated Deployment Scripts

### Deploy Staging

```bash
# Simple deployment
./scripts/deployment/deploy-staging.sh

# Kubernetes deployment
./scripts/deployment/deploy-staging.sh --type kubernetes

# Docker Compose with tests
./scripts/deployment/deploy-staging.sh --type docker-compose --backup-first

# Dry run (preview changes)
./scripts/deployment/deploy-staging.sh --dry-run

# Skip tests for faster deployment
./scripts/deployment/deploy-staging.sh --skip-tests
```

### Verify Deployment

```bash
./scripts/deployment/verify-staging.sh
```

### Health Checks

```bash
# Single health check
./scripts/deployment/health-check.sh

# Continuous monitoring (5 minutes)
./scripts/deployment/health-check.sh --continuous 300

# Generate report
./scripts/deployment/health-check.sh --generate-report health-report.json
```

### Rollback

```bash
# Rollback to previous version
./scripts/deployment/rollback-staging.sh --previous

# List available versions
./scripts/deployment/rollback-staging.sh --list

# Rollback to specific version
./scripts/deployment/rollback-staging.sh --version 1.0.0
```

---

## Common Tasks

### View Logs

**Docker Compose:**
```bash
docker-compose -f docker-compose-staging.yml logs -f agent-orchestrator
```

**Kubernetes:**
```bash
kubectl logs -f deployment/agent-orchestrator -n staging
kubectl logs --all-containers=true -n staging
```

### Database Access

**Docker Compose:**
```bash
docker-compose -f docker-compose-staging.yml exec postgres psql -U staging_user -d agent_orchestrator_staging
```

**Kubernetes:**
```bash
kubectl exec -n staging postgres-0 -- psql -U staging_user -d agent_orchestrator_staging
```

### Run Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E quick tests
npm run test:e2e:quick

# Performance tests
npm run test:e2e:perf
```

### Database Migrations

```bash
# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate:status

# Create new migration
npm run migrate:create -- add_new_table
```

### Backup Database

```bash
# PostgreSQL backup
docker-compose -f docker-compose-staging.yml exec -T postgres \
  pg_dump -U staging_user agent_orchestrator_staging > backup.sql

# Redis backup
docker-compose -f docker-compose-staging.yml exec redis redis-cli BGSAVE
```

---

## Monitoring & Metrics

### Grafana Dashboards

1. Open http://localhost:3001 (Docker) or port-forward for Kubernetes
2. Login with admin / grafana123
3. Import dashboards:
   - Agent Orchestrator Dashboard
   - PostgreSQL Monitoring
   - Redis Monitoring
   - RabbitMQ Monitoring

### Prometheus Queries

```
# Agent uptime
up{job="agent-orchestrator"}

# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Database connections
pg_stat_activity_count

# Redis memory
redis_memory_used_bytes
```

### Check Metrics

```bash
# Access Prometheus
curl http://localhost:9090/api/v1/query?query=up

# Access metrics endpoint
curl http://localhost:3000/metrics
```

---

## Troubleshooting

### Service Won't Start

1. Check logs:
```bash
docker-compose -f docker-compose-staging.yml logs postgres
```

2. Check resources:
```bash
docker stats
```

3. Check port conflicts:
```bash
lsof -i :5432
```

### Database Connection Failed

1. Verify database is running:
```bash
docker-compose -f docker-compose-staging.yml ps postgres
```

2. Test connection:
```bash
docker-compose -f docker-compose-staging.yml exec postgres pg_isready -U staging_user
```

3. Check credentials in .env.staging

### Out of Memory

Increase Docker memory:
- Docker Desktop: Settings > Resources > Memory > Increase
- Or limit services in docker-compose-staging.yml

### Performance Issues

1. Check metrics:
```bash
./scripts/deployment/health-check.sh
```

2. Review Grafana dashboards

3. Check slow queries:
```sql
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

---

## Production Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Performance tests completed
- [ ] Security scanning done
- [ ] Backup procedure tested
- [ ] Monitoring configured
- [ ] Team trained
- [ ] Runbook documented
- [ ] Rollback tested
- [ ] Change approval obtained

---

## Documentation

- **Full Guide**: See `STAGING_SETUP_GUIDE.md`
- **Kubernetes Manifests**: See `kubernetes/` directory
- **Helm Charts**: See `helm/agent-orchestrator/`
- **Scripts**: See `scripts/deployment/`

---

## Getting Help

1. Check logs: `docker-compose -f docker-compose-staging.yml logs`
2. Run health checks: `./scripts/deployment/health-check.sh`
3. Review monitoring dashboards: Grafana (http://localhost:3001)
4. Check Prometheus metrics: http://localhost:9090
5. See full documentation: `STAGING_SETUP_GUIDE.md`

---

**Quick Links:**
- [Full Setup Guide](./STAGING_SETUP_GUIDE.md)
- [Kubernetes Manifests](./kubernetes/)
- [Helm Charts](./helm/agent-orchestrator/)
- [Deployment Scripts](./scripts/deployment/)
- [Project README](./README.md)
