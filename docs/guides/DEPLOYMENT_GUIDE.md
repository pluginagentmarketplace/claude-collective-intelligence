# Enterprise CI/CD Deployment Guide

## Overview

This guide covers the complete CI/CD pipeline infrastructure for the AI Agent Orchestrator with RabbitMQ. The system implements enterprise-grade deployment strategies including blue-green deployments, canary releases, and automatic rollback procedures.

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [GitHub Actions Workflows](#github-actions-workflows)
4. [Deployment Strategies](#deployment-strategies)
5. [Configuration & Secrets](#configuration--secrets)
6. [Deployment Scripts](#deployment-scripts)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Architecture

### Pipeline Stages

```
LINT → TEST → SECURITY → BUILD → PUSH → STAGING_DEPLOY → SMOKE_TESTS → APPROVAL → PROD_DEPLOY
```

### Key Components

```
├── .github/workflows/
│   ├── advanced-ci.yml           # Comprehensive CI pipeline
│   ├── deploy-staging.yml        # Staging environment deployment
│   └── deploy-production.yml     # Production deployment with approval
├── scripts/
│   ├── deploy.sh                 # Deployment automation script
│   ├── rollback.sh               # Automatic rollback procedures
│   └── verify-deployment.sh      # Post-deployment verification
├── Dockerfile                    # Multi-stage Docker build
└── .dockerignore                 # Docker build optimization
```

---

## Prerequisites

### System Requirements

- **Node.js**: v18.x or later
- **Docker**: 20.10+ with Docker Compose v2.0+
- **Git**: v2.30+
- **SSH**: For remote deployments
- **PostgreSQL**: 15+ (production)
- **RabbitMQ**: 3.12+ (management plugin enabled)
- **Redis**: 7+ (for caching)

### GitHub Setup

1. Repository with GitHub Actions enabled
2. GitHub Container Registry (GHCR) access
3. Required secrets configured (see [Configuration](#configuration--secrets))
4. Branch protection rules for main/staging branches
5. Required status checks enforced

### AWS Setup (for production)

1. IAM role with ECR and EC2 permissions
2. VPC with public and private subnets
3. Application Load Balancer (ALB)
4. Auto Scaling Groups for deployment targets
5. CloudFront distribution (optional)

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your local configuration

# Start services
docker-compose up -d

# Run tests
npm test

# View logs
docker-compose logs -f
```

---

## GitHub Actions Workflows

### 1. Advanced CI Pipeline (`advanced-ci.yml`)

Triggered on every push to main/develop/staging and pull requests.

#### Stages

**LINT & Code Quality**
- ESLint configuration checks
- Code formatting validation
- Complexity analysis
- Security scanning

**Test Suite**
- Multi-version Node.js testing (18.x, 20.x, 21.x)
- Unit tests with coverage
- Integration tests
- E2E tests
- Performance benchmarks

**Security Analysis**
- npm audit (npm registry)
- OWASP Dependency Check
- Secret scanning (TruffleHog)
- Snyk vulnerability assessment
- Container image scanning (Trivy)

**Build & Docker Image**
- Multi-stage Docker build
- Image tagging (branch, SHA, semver)
- Layer caching for optimization
- SBOM generation

**Performance Testing**
- Benchmark execution
- Memory profiling
- Load testing simulation
- Performance reports

**Release Creation**
- Semantic versioning
- Changelog generation
- GitHub Release creation

#### Artifacts

- Coverage reports (uploaded to Codecov)
- Test results and junit.xml
- Performance reports
- Security scan results (SARIF format)
- Docker image metadata

---

### 2. Staging Deployment (`deploy-staging.yml`)

Triggered on push to staging/develop branches.

#### Deployment Strategy

- **Default**: Blue-Green deployment
- **Optional**: Canary deployment (5% traffic)

#### Process

1. **Pre-deployment Checks**
   - Verify deployment files exist
   - Check staging readiness
   - Validate configuration

2. **Image Build & Push**
   - Build Docker image with staging suffix
   - Push to GHCR
   - Generate image metadata

3. **Blue-Green Deployment**
   ```
   [Blue - Active] → [Green - New] → Health Checks → Traffic Switch
   ```

4. **Verification**
   - Health checks (30 retries, 10s interval)
   - Smoke tests execution
   - Service dependency verification
   - Database migration check

5. **Traffic Switch** (if healthy)
   - Load balancer routing update
   - Session persistence handling
   - Cache invalidation

6. **Monitoring**
   - Real-time metrics collection
   - Error rate monitoring
   - Performance baselines

#### Environment

- **Staging Blue Endpoint**: `https://blue-staging.example.com`
- **Staging Green Endpoint**: `https://green-staging.example.com`
- **Staging Live Endpoint**: `https://staging.example.com`

---

### 3. Production Deployment (`deploy-production.yml`)

Manual workflow dispatch with approval gates.

#### Deployment Options

1. **Full Deployment** (0 → 100% traffic)
   ```
   Blue [0%] → Green [100%] → Complete
   ```

2. **Canary Release** (gradual rollout)
   ```
   Blue [90%] → Canary [10%] → Monitor → Blue [50%] → Canary [50%] → Full rollout
   ```

3. **Rolling Deployment** (per-replica updates)
   ```
   Replica 1 → Replica 2 → Replica 3 → Complete
   ```

#### Mandatory Gates

1. **Pre-production Validation**
   - Version format verification
   - Staging success confirmation
   - Production readiness checklist

2. **Manual Approval**
   - GitHub environment approval required
   - Teams/Slack notification
   - Audit logging

3. **Image Verification**
   - Container scanning (Trivy)
   - Signature verification
   - Registry validation

#### Deployment Process

1. **Pre-deployment Tasks**
   - Database backup creation
   - Configuration validation
   - Secret verification

2. **Application Deployment**
   - Pull latest image
   - Execute deployment script
   - Run comprehensive health checks
   - Execute database migrations

3. **Traffic Routing**
   - Switch 100% traffic to new version
   - Verify traffic flow
   - Monitor error rates (< 1%)

4. **Post-deployment**
   - Service verification
   - Monitoring alert configuration
   - Performance baseline establishment

5. **Automatic Rollback** (if health checks fail)
   - Revert to previous version
   - Database rollback
   - Traffic re-routing
   - Alert notifications

---

## Deployment Strategies

### Blue-Green Deployment

**Best for**: Zero-downtime deployments, quick rollbacks

```
STAGE 1: Deploy to Green                    STAGE 2: Health Check
  [Blue - Production] ────────────────────────→ Health: ✓
  [Green - New Version]

STAGE 3: Switch Traffic                     STAGE 4: Complete
  [Blue - Old] ← (0%)                         [Green - Production]
  [Green - New] ← (100%) ─────────────────────→ ✓ Active
```

**Rollback Procedure**:
```
Old Blue still running → Traffic switch back → Zero impact
```

**Configuration**:
```bash
./scripts/deploy.sh \
  --environment production \
  --image-tag v1.2.3 \
  --strategy blue-green
```

---

### Canary Deployment

**Best for**: High-risk changes, metric-driven validation

```
STAGE 1: Deploy Canary                      STAGE 2: Monitor Metrics
  [Stable - 90%] ──────────────────────────────→ Error Rate: 0.05%
  [Canary - 10%]                               Response Time: 120ms

STAGE 3: Gradual Rollout
  [Stable - 50%] → [Stable - 25%] → [Stable - 0%]
  [Canary - 50%] → [Canary - 75%] → [Canary - 100%]
```

**Metrics Monitored**:
- Error rate (target: < 0.5%)
- P95/P99 latency
- CPU/Memory usage
- Database query time

**Configuration**:
```bash
./scripts/deploy.sh \
  --environment production \
  --image-tag v1.2.3 \
  --strategy canary \
  --canary-percentage 10
```

---

### Rolling Deployment

**Best for**: Stateful applications, gradual updates

```
STAGE 1: Update Replica 1                   STAGE 2: Update Replica 2
  [Replica 1 - New] ─→ [Replica 2 - New] ─→ [Replica 3 - New]
  [Replica 2 - Old]    [Replica 3 - Old]
  [Replica 3 - Old]
```

**Configuration**:
```bash
./scripts/deploy.sh \
  --environment production \
  --image-tag v1.2.3 \
  --strategy rolling
```

---

## Configuration & Secrets

### GitHub Repository Secrets

```yaml
# AWS Configuration
AWS_ROLE_ARN: arn:aws:iam::ACCOUNT:role/github-actions
AWS_REGION: us-east-1
AWS_ROLE_ARN_PROD: arn:aws:iam::ACCOUNT:role/github-actions-prod

# Staging Deployment
STAGING_HOST: staging-deploy.example.com
STAGING_USER: deploy
STAGING_BLUE_ENDPOINT: https://blue-staging.example.com
STAGING_GREEN_ENDPOINT: https://green-staging.example.com
DEPLOY_SSH_PRIVATE_KEY: |
  -----BEGIN OPENSSH PRIVATE KEY-----
  [SSH private key content]
  -----END OPENSSH PRIVATE KEY-----

# Production Deployment
PROD_HOST_PRIMARY: prod-01.example.com
PROD_HOST_SECONDARY: prod-02.example.com
PROD_USER: deploy
PROD_BLUE_ENDPOINT: https://blue-prod.example.com
PROD_ENDPOINT: https://api.example.com
DEPLOY_SSH_PRIVATE_KEY_PROD: |
  -----BEGIN OPENSSH PRIVATE KEY-----
  [SSH private key content]
  -----END OPENSSH PRIVATE KEY-----

# Monitoring & Notifications
SLACK_WEBHOOK_URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SNYK_TOKEN: [Snyk API token]

# Codecov
CODECOV_TOKEN: [Codecov token]

# Database
POSTGRES_HOST: postgres.example.com
POSTGRES_USER: admin
POSTGRES_PASSWORD: [secure password]

# Cache
REDIS_HOST: redis.example.com
REDIS_PASSWORD: [secure password]

# Message Queue
RABBITMQ_HOST: rabbitmq.example.com
RABBITMQ_USER: admin
RABBITMQ_PASSWORD: [secure password]

# CDN (optional)
CLOUDFRONT_DISTRIBUTION_ID: E1234ABCD
```

### Environment Variables

**Staging .env**:
```bash
NODE_ENV=staging
ENVIRONMENT=staging
LOG_LEVEL=info
API_PORT=3000
POSTGRES_HOST=staging-db.example.com
RABBITMQ_HOST=staging-rabbitmq.example.com
REDIS_HOST=staging-redis.example.com
```

**Production .env**:
```bash
NODE_ENV=production
ENVIRONMENT=production
LOG_LEVEL=warn
API_PORT=3000
POSTGRES_HOST=prod-db.example.com
RABBITMQ_HOST=prod-rabbitmq.example.com
REDIS_HOST=prod-redis.example.com
ENABLE_MONITORING=true
ALERT_EMAIL=ops@example.com
```

---

## Deployment Scripts

### deploy.sh - Deployment Automation

Handles blue-green, canary, and rolling deployments.

#### Usage

```bash
./scripts/deploy.sh [OPTIONS]
```

#### Options

```
--environment ENV              Target environment (staging/production)
--image-tag TAG              Docker image tag
--strategy STRATEGY          blue-green, canary, rolling
--canary-percentage PCT      Canary traffic percentage (1-100)
--host HOST                  Remote deployment host
--user USER                  Remote SSH user
--key KEY                    SSH private key path
--timeout SECONDS            Deployment timeout
--dry-run                   Preview without changes
--verbose                   Enable debug output
```

#### Examples

```bash
# Blue-green staging deployment
./scripts/deploy.sh \
  --environment staging \
  --image-tag ghcr.io/myorg/app:v1.2.3 \
  --strategy blue-green

# Canary production deployment (10%)
./scripts/deploy.sh \
  --environment production \
  --image-tag ghcr.io/myorg/app:v1.2.3 \
  --strategy canary \
  --canary-percentage 10

# Dry run to preview changes
./scripts/deploy.sh \
  --environment staging \
  --image-tag v1.2.3 \
  --dry-run \
  --verbose
```

#### Output Example

```
[2024-01-15 14:32:01] ℹ️  Starting Blue-Green deployment...
[2024-01-15 14:32:02] ℹ️  Deploying to Green environment...
[2024-01-15 14:32:05] ✅ Deployment to green initiated
[2024-01-15 14:32:10] ℹ️  Waiting for green to become healthy...
[2024-01-15 14:32:35] ✅ green is healthy
[2024-01-15 14:32:40] ✅ Blue-Green deployment completed successfully!
```

---

### rollback.sh - Rollback Automation

Automatically reverts to previous versions with verification.

#### Usage

```bash
./scripts/rollback.sh [OPTIONS]
```

#### Options

```
--environment ENV               Target environment
--to-previous-version          Rollback to previous version (default)
--to-specific-version VER      Rollback to specific version
--to-last-stable               Rollback to last stable version
--host HOST                    Remote host
--user USER                    Remote SSH user
--key KEY                      SSH private key
--skip-health-check           Skip post-rollback verification
--wait-for-health-check       Wait for health checks before returning
--dry-run                     Preview without changes
```

#### Examples

```bash
# Rollback to previous version
./scripts/rollback.sh \
  --environment production \
  --to-previous-version \
  --wait-for-health-check

# Rollback to specific version
./scripts/rollback.sh \
  --environment staging \
  --to-specific-version v1.0.5

# Dry run rollback
./scripts/rollback.sh \
  --environment staging \
  --to-previous-version \
  --dry-run
```

#### Automatic Triggers

Rollback is automatically triggered when:
- Health checks fail post-deployment
- Error rate exceeds 1%
- Response time > 2000ms
- Manual approval denied

---

### verify-deployment.sh - Verification & Smoke Tests

Comprehensive post-deployment verification suite.

#### Usage

```bash
./scripts/verify-deployment.sh [OPTIONS]
```

#### Options

```
--environment ENV            Target environment
--endpoint URL              Application endpoint
--timeout SECONDS           Health check timeout
--smoke-tests              Run smoke tests
--comprehensive-check      Run comprehensive health checks
--full-verification        Run all checks
--verbose                 Enable debug output
```

#### Examples

```bash
# Basic health checks
./scripts/verify-deployment.sh \
  --endpoint https://staging.example.com \
  --timeout 300

# Full verification suite
./scripts/verify-deployment.sh \
  --endpoint https://api.example.com \
  --environment production \
  --full-verification

# Smoke tests only
./scripts/verify-deployment.sh \
  --endpoint http://localhost:3000 \
  --smoke-tests
```

#### Verification Checks

**Basic Checks**:
- Health endpoint availability
- API HTTP response codes
- SSL certificate validation
- Response time performance

**Service Dependency Checks**:
- Database connectivity
- Redis cache connectivity
- RabbitMQ connectivity
- External API availability

**Smoke Tests**:
- API endpoint responses
- Authentication flows
- Data operations (CRUD)
- Error handling

**Comprehensive Checks**:
- Environment variables
- Disk space availability
- Memory usage
- System resources

---

## Monitoring & Alerts

### Metrics to Monitor

```yaml
Application Metrics:
  - Error rate (target: < 0.1%)
  - Response time P95 (target: < 500ms)
  - Request throughput (baseline + 20%)
  - Active connections

Infrastructure Metrics:
  - CPU usage (target: < 70%)
  - Memory usage (target: < 80%)
  - Disk usage (target: < 85%)
  - Network I/O

Database Metrics:
  - Query response time
  - Connection pool usage
  - Replication lag
  - Backup status

Queue Metrics:
  - Message queue depth
  - Processing rate
  - Error rate
  - Consumer lag
```

### Alert Configuration

**Critical Alerts**:
- Error rate > 1%
- Response time > 2 seconds
- Service unavailable
- Database connection failed

**Warning Alerts**:
- Error rate > 0.5%
- Response time > 1 second
- CPU > 80%
- Memory > 85%

### Slack Integration

Deployment events are automatically posted to Slack:

```
✅ Advanced CI Pipeline - Success
   Branch: main
   Commit: a1b2c3d
   Tests: Passed (150 tests)
   Coverage: 95%

🚀 Staging Deployment - Success
   Version: v1.2.3
   Environment: staging
   Duration: 4m 32s
   Endpoint: https://staging.example.com

✅ Production Deployment - Success
   Version: v1.2.3
   Type: Blue-Green
   Duration: 8m 15s
   Approved by: john.doe
```

---

## Troubleshooting

### Common Issues

#### 1. Deployment Timeout

**Symptoms**: Deployment fails with timeout error

**Solutions**:
```bash
# Increase timeout
./scripts/deploy.sh \
  --environment staging \
  --image-tag v1.2.3 \
  --timeout 900  # 15 minutes

# Check service health
./scripts/verify-deployment.sh \
  --endpoint http://localhost:3000 \
  --comprehensive-check

# Review application logs
docker-compose logs -f app
```

#### 2. Health Check Failures

**Symptoms**: Deployment successful but health checks fail

**Solutions**:
```bash
# Run manual health checks
curl -v http://localhost:3000/health

# Check service dependencies
nc -zv localhost 5432  # Database
nc -zv localhost 5672  # RabbitMQ
nc -zv localhost 6379  # Redis

# Review application logs
docker logs agent_app
```

#### 3. SSH Connection Failed

**Symptoms**: Cannot connect to deployment host

**Solutions**:
```bash
# Verify SSH key permissions
chmod 600 ~/.ssh/deploy_key
ssh-add ~/.ssh/deploy_key

# Test SSH connection
ssh -i ~/.ssh/deploy_key deploy@staging-host "echo 'Connected'"

# Check GitHub secret configuration
gh secret list
```

#### 4. Docker Image Pull Failed

**Symptoms**: Cannot pull Docker image from registry

**Solutions**:
```bash
# Authenticate to GHCR
docker login ghcr.io

# Verify image exists
docker pull ghcr.io/myorg/app:v1.2.3

# Check GHCR token permissions
gh auth token --hostname github.com
```

#### 5. Database Migration Failed

**Symptoms**: Deployment succeeds but migrations fail

**Solutions**:
```bash
# Check migration status
npm run migrate:down  # Rollback failed migration
npm run migrate:up    # Re-run migrations

# Verify database connection
psql -h localhost -U admin -d agent_orchestrator -c "SELECT version();"

# Review migration logs
cat logs/migrations.log
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Verbose deployment
./scripts/deploy.sh \
  --environment staging \
  --image-tag v1.2.3 \
  --verbose

# Enable container logs
docker-compose logs -f --tail=100

# SSH with debug
ssh -v -i ~/.ssh/deploy_key deploy@staging-host
```

### Rollback Procedures

#### Manual Rollback

```bash
# Rollback to previous version
./scripts/rollback.sh \
  --environment production \
  --to-previous-version \
  --wait-for-health-check

# Rollback to specific version
./scripts/rollback.sh \
  --environment production \
  --to-specific-version v1.0.5

# Verify rollback
./scripts/verify-deployment.sh \
  --environment production \
  --full-verification
```

#### Automatic Rollback Triggers

```bash
# GitHub Actions automatically triggers rollback if:
# 1. Health checks fail after 30 retries
# 2. Smoke tests fail
# 3. Error rate exceeds threshold
# 4. Response time > acceptable limit
```

---

## Best Practices

### Pre-deployment

1. **Always test in staging first**
   ```bash
   # Push to staging/develop branch
   git push origin feature-branch:staging
   # Wait for staging deployment
   # Test thoroughly
   ```

2. **Review code changes**
   ```bash
   # Create pull request
   # Require 2+ approvals
   # Pass all CI checks
   ```

3. **Verify database backups**
   ```bash
   # Production
   aws rds describe-db-instances \
     --db-instance-identifier prod-db \
     --query 'DBInstances[0].LatestRestorableTime'
   ```

4. **Check system capacity**
   ```bash
   # Ensure adequate resources
   kubectl top nodes  # Kubernetes
   docker stats      # Docker Swarm
   ```

### During Deployment

1. **Monitor in real-time**
   ```bash
   # Watch deployment progress
   watch -n 1 'docker-compose ps'

   # Monitor metrics
   open https://grafana.example.com
   ```

2. **Have rollback ready**
   - Keep previous version accessible
   - Test rollback procedure beforehand
   - Team on standby

3. **Gradual rollout** (for canary)
   - Start with 5% traffic
   - Monitor for 10+ minutes
   - Gradually increase to 100%

### Post-deployment

1. **Verify all systems**
   ```bash
   ./scripts/verify-deployment.sh \
     --full-verification
   ```

2. **Monitor for 1 hour**
   - Watch error rates
   - Track response times
   - Monitor resource usage

3. **Document deployment**
   - Record version deployed
   - Note deployment duration
   - Document any issues

4. **Team communication**
   - Update status page
   - Notify stakeholders
   - Log deployment details

### Performance Optimization

1. **Docker Image Optimization**
   ```bash
   # Use multi-stage builds (implemented)
   # Minimize layers (implemented)
   # Remove build artifacts (implemented)

   # Check image size
   docker images ghcr.io/myorg/app
   ```

2. **Health Check Optimization**
   ```bash
   # Adjust timeout based on startup time
   healthcheck:
     interval: 30s
     timeout: 10s
     retries: 3
     start_period: 40s
   ```

3. **Deployment Speed**
   - Cache Docker layers
   - Parallel testing
   - Async notifications

### Security Best Practices

1. **Secret Management**
   - Use GitHub Secrets (implemented)
   - Rotate credentials regularly
   - Never commit secrets

2. **Image Security**
   - Scan for vulnerabilities
   - Use non-root user (implemented)
   - Keep base images updated

3. **Access Control**
   - Limit deployment permissions
   - Require approval gates
   - Audit all deployments

4. **Network Security**
   - Use SSH keys (not passwords)
   - Restrict SSH access by IP
   - Monitor deployment activity

---

## Support & References

### Documentation
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS Deployment Guide](https://aws.amazon.com/getting-started/)

### Tools
- Slack: Post deployment notifications
- Grafana: Metrics visualization
- Prometheus: Metrics collection
- CloudWatch: AWS monitoring

### Team Contacts
- DevOps Lead: devops@example.com
- On-call Engineer: oncall@example.com
- Platform Team: platform@example.com

---

## Changelog

**v1.0.0** - Initial release
- Advanced CI/CD pipeline
- Blue-green deployments
- Canary releases
- Automatic rollback
- Comprehensive monitoring

---

**Last Updated**: 2024-01-15
**Maintained By**: Platform Engineering Team
