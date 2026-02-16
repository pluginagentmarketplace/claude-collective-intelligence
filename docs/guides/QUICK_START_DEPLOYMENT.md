# Quick Start: Deployment Commands Reference

## Essential Commands

### Deploy to Staging (Blue-Green)

```bash
# Automatic (push to staging branch)
git push origin feature:staging

# Manual deployment
./scripts/deploy.sh \
  --environment staging \
  --image-tag ghcr.io/myorg/app:v1.2.3 \
  --strategy blue-green
```

### Deploy to Production

```bash
# Via GitHub UI (recommended)
1. Go to Actions → Deploy to Production
2. Click "Run workflow"
3. Enter version: v1.2.3
4. Select type: full/canary/rolling
5. Approve deployment

# Or via CLI
gh workflow run deploy-production.yml \
  -f version=v1.2.3 \
  -f deployment_type=full
```

### Verify Deployment

```bash
# Quick health check
./scripts/verify-deployment.sh \
  --endpoint https://api.example.com

# Full verification
./scripts/verify-deployment.sh \
  --endpoint https://api.example.com \
  --full-verification

# Smoke tests only
./scripts/verify-deployment.sh \
  --endpoint https://api.example.com \
  --smoke-tests
```

### Rollback to Previous Version

```bash
# Automatic rollback
./scripts/rollback.sh \
  --environment production \
  --to-previous-version

# Rollback to specific version
./scripts/rollback.sh \
  --environment production \
  --to-specific-version v1.0.5

# Dry-run (preview without changes)
./scripts/rollback.sh \
  --environment production \
  --to-previous-version \
  --dry-run
```

---

## Common Workflows

### Develop & Test New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push to staging for testing
git push origin feature/my-feature:staging

# 4. Wait for CI/CD to complete
# Monitor: GitHub Actions → Workflows

# 5. Verify staging deployment
./scripts/verify-deployment.sh \
  --endpoint https://staging.example.com \
  --full-verification

# 6. If all good, merge to main
git push origin feature/my-feature:main
```

### Create Release & Deploy to Production

```bash
# 1. Ensure all tests pass on main
git checkout main
git pull origin main

# 2. Create release tag
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# 3. Trigger production deployment
# Via GitHub UI: Actions → Deploy to Production

# 4. Approve when prompted
# Go to: Environments → production

# 5. Monitor deployment
watch -n 5 'gh run list --workflow=deploy-production.yml -L1'

# 6. Verify production
./scripts/verify-deployment.sh \
  --endpoint https://api.example.com \
  --environment production \
  --full-verification
```

### Emergency Rollback

```bash
# If production deployment fails:
./scripts/rollback.sh \
  --environment production \
  --to-previous-version \
  --wait-for-health-check

# Verify rollback
./scripts/verify-deployment.sh \
  --endpoint https://api.example.com \
  --full-verification

# Post-mortem
# Check logs: GitHub Actions → Failed Workflow
# Review: DEPLOYMENT_GUIDE.md → Troubleshooting
```

---

## CI/CD Pipeline Status

### Check Current Deployments

```bash
# Last 10 workflow runs
gh run list -L10

# Last staging deployment
gh run list -w deploy-staging.yml -L1

# Last production deployment
gh run list -w deploy-production.yml -L1

# Specific workflow status
gh run view <RUN_ID>

# View logs
gh run view <RUN_ID> --log
```

### View Test Coverage

```bash
# Latest coverage report
gh run list -w advanced-ci.yml -L1

# Download coverage
gh run download <RUN_ID> -n coverage-node-20.x

# View in Codecov
open https://codecov.io/gh/myorg/myrepo
```

---

## Pre-deployment Checklist

Before deploying to production:

- [ ] All tests passing (green checkmarks on main)
- [ ] Code reviewed and approved (2+ reviewers)
- [ ] Security scans passed (no critical vulnerabilities)
- [ ] Staging deployment verified
- [ ] Monitoring/alerts configured
- [ ] Database backups current
- [ ] Rollback plan reviewed
- [ ] Team notified (Slack message)

---

## Post-deployment Checklist

After deploying to production:

- [ ] Health checks passing
- [ ] Error rate < 0.1%
- [ ] Response times normal (P95 < 500ms)
- [ ] Database queries performant
- [ ] No unusual logs/errors
- [ ] Monitoring active and alerting
- [ ] Team notified of successful deployment
- [ ] Document deployment details

---

## Deployment Strategy Comparison

### Blue-Green (Recommended for most cases)

```bash
./scripts/deploy.sh --strategy blue-green
```

**Pros**:
- Zero downtime
- Instant rollback
- Fast deployment

**Cons**:
- Requires 2x resources
- No gradual validation

---

### Canary (For high-risk changes)

```bash
./scripts/deploy.sh --strategy canary --canary-percentage 5
```

**Pros**:
- Risk mitigation
- Gradual validation
- Real user testing

**Cons**:
- Takes longer
- Complex monitoring

---

### Rolling (For stateful apps)

```bash
./scripts/deploy.sh --strategy rolling
```

**Pros**:
- Resource efficient
- Graceful updates
- User session preservation

**Cons**:
- Takes longer
- Brief service degradation

---

## Environment Variables

### Staging

```bash
NODE_ENV=staging
ENVIRONMENT=staging
LOG_LEVEL=info
```

### Production

```bash
NODE_ENV=production
ENVIRONMENT=production
LOG_LEVEL=warn
ENABLE_MONITORING=true
```

---

## Secrets Configuration

### Add GitHub Secrets

```bash
# Slack webhook
gh secret set SLACK_WEBHOOK_URL

# SSH keys
gh secret set DEPLOY_SSH_PRIVATE_KEY
gh secret set DEPLOY_SSH_PRIVATE_KEY_PROD

# Cloud credentials
gh secret set AWS_ROLE_ARN
gh secret set AWS_REGION

# Deployment hosts
gh secret set STAGING_HOST
gh secret set PROD_HOST_PRIMARY

# Database/Cache/Queue
gh secret set POSTGRES_PASSWORD
gh secret set REDIS_PASSWORD
gh secret set RABBITMQ_PASSWORD
```

### List Secrets

```bash
gh secret list
```

---

## Troubleshooting Quick Guide

### Deployment Timeout

```bash
# Increase timeout
./scripts/deploy.sh \
  --environment staging \
  --image-tag v1.2.3 \
  --timeout 900

# Check service health
./scripts/verify-deployment.sh \
  --endpoint http://localhost:3000 \
  --comprehensive-check
```

### Health Check Failures

```bash
# Test health endpoint manually
curl -v http://localhost:3000/health

# Check service dependencies
nc -zv localhost 5432  # Database
nc -zv localhost 5672  # RabbitMQ
nc -zv localhost 6379  # Redis
```

### SSH Connection Failed

```bash
# Verify SSH key
chmod 600 ~/.ssh/deploy_key
ssh-add ~/.ssh/deploy_key

# Test connection
ssh -i ~/.ssh/deploy_key deploy@staging-host "echo OK"
```

### Docker Image Pull Failed

```bash
# Authenticate
docker login ghcr.io

# Verify image exists
docker pull ghcr.io/myorg/app:v1.2.3

# Check GitHub token
gh auth token
```

### Database Migration Failed

```bash
# Rollback migrations
npm run migrate:down

# Check migration status
npm run migrate:status

# Re-run migrations
npm run migrate:up
```

---

## Useful Commands

### View Live Deployment

```bash
# SSH into deployment server
ssh -i ~/.ssh/deploy_key deploy@staging-host

# View container logs
docker-compose logs -f app

# Check container status
docker-compose ps

# View resource usage
docker stats
```

### Monitor Metrics

```bash
# Prometheus
open http://localhost:9090

# Grafana
open http://localhost:3000

# Application logs
tail -f logs/application.log

# Deployment history
tail -f logs/deployment-*.log
```

### Database Operations

```bash
# Connect to database
psql -h localhost -U admin -d agent_orchestrator

# View migrations
npm run migrate:list

# Create backup
pg_dump -h localhost -U admin agent_orchestrator > backup.sql

# Restore backup
psql -h localhost -U admin agent_orchestrator < backup.sql
```

---

## Useful Links

- **GitHub Actions**: https://github.com/myorg/myrepo/actions
- **Deployment Guide**: See `DEPLOYMENT_GUIDE.md`
- **Implementation Summary**: See `CI_CD_IMPLEMENTATION_SUMMARY.md`
- **Codecov**: https://codecov.io/gh/myorg/myrepo
- **Grafana Dashboard**: https://grafana.example.com
- **Slack Channel**: #deployments

---

## Need Help?

1. **Check Logs**: GitHub Actions → Workflows → View logs
2. **Review Guide**: Read `DEPLOYMENT_GUIDE.md`
3. **Test Locally**: Run scripts with `--dry-run` flag
4. **Ask Team**: Ping @devops or #deployments
5. **Escalate**: Contact on-call engineer

---

## Scripts Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy.sh` | Deploy app | `./scripts/deploy.sh --help` |
| `rollback.sh` | Rollback app | `./scripts/rollback.sh --help` |
| `verify-deployment.sh` | Verify deployment | `./scripts/verify-deployment.sh --help` |

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
**Status**: Production Ready
