# Deployment Scripts

Production deployment automation with numbered execution order for clarity.

## Execution Order

**CRITICAL:** Execute scripts in this exact order:

```bash
# 1. Pre-deployment validation
./01-pre-check.sh

# 2. Deploy to production
./02-deploy.sh

# 3. Post-deployment verification (choose one or both)
./03-post-verify.sh  # Quick verification
./03-verify.sh       # Comprehensive smoke tests

# 4. Rollback (if deployment fails)
./04-rollback.sh
```

## Scripts Overview

### 01-pre-check.sh
**Purpose:** Pre-deployment validation
**Checks:**
- Environment variables configured
- Database connectivity
- RabbitMQ health
- Disk space availability
- Dependencies installed

**Exit Codes:**
- `0`: All checks passed, safe to deploy
- `1`: Critical check failed, DO NOT deploy

**Example:**
```bash
./01-pre-check.sh
# ✅ All checks passed
```

---

### 02-deploy.sh
**Purpose:** Execute production deployment
**Actions:**
- Pull latest code from repository
- Install/update dependencies
- Run database migrations
- Restart services
- Update configuration

**Prerequisites:** 01-pre-check.sh must pass first!

**Example:**
```bash
./02-deploy.sh
# Deploying to production...
# ✅ Deployment complete
```

---

### 03-post-verify.sh
**Purpose:** Quick post-deployment verification
**Checks:**
- Services running
- Health endpoints responding
- Basic API connectivity

**Example:**
```bash
./03-post-verify.sh
# ✅ Quick verification passed
```

---

### 03-verify.sh
**Purpose:** Comprehensive deployment verification & smoke tests
**Checks:**
- All services healthy
- Database queries working
- RabbitMQ queues operational
- API endpoints responding correctly
- No error logs
- Performance benchmarks

**Example:**
```bash
./03-verify.sh
# Running 50+ smoke tests...
# ✅ All tests passed
```

---

### 04-rollback.sh
**Purpose:** Rollback failed deployment
**Actions:**
- Restore previous version
- Revert database migrations
- Restart services with old configuration

**When to use:** If 03-post-verify.sh or 03-verify.sh fails!

**Example:**
```bash
./04-rollback.sh
# Rolling back to previous version...
# ✅ Rollback complete
```

---

### timeline.sh
**Purpose:** Display deployment timeline and history
**Shows:**
- Recent deployments
- Success/failure rates
- Deployment duration
- Rollback events

**Example:**
```bash
./timeline.sh
# Last 10 deployments:
# 2025-12-07 14:30 - SUCCESS (5m 23s)
# 2025-12-06 10:15 - ROLLBACK (deployment failed)
```

---

## Disaster Recovery (DR)

DR scripts located in `dr/` subdirectory. See [dr/README.md](dr/README.md) for details.

---

## Best Practices

1. **Always run 01-pre-check.sh first** - Never skip this step!
2. **Monitor deployment logs** - Watch for errors during 02-deploy.sh
3. **Run comprehensive verification** - Use 03-verify.sh for critical deployments
4. **Have rollback ready** - Keep 04-rollback.sh accessible
5. **Document changes** - Update CHANGELOG.md before deployment
6. **Notify team** - Alert team members before production deployment

---

## Troubleshooting

### Deployment Failed at 02-deploy.sh

1. Check error logs:
   ```bash
   tail -f /var/log/deployment.log
   ```

2. Run rollback:
   ```bash
   ./04-rollback.sh
   ```

3. Fix issue and retry:
   ```bash
   ./01-pre-check.sh
   ./02-deploy.sh
   ```

### Verification Failed at 03-verify.sh

1. Check service status:
   ```bash
   ../infrastructure/health-check.sh
   ```

2. Decide: Fix forward or rollback?
   - **Fix forward:** Patch issue and re-verify
   - **Rollback:** `./04-rollback.sh`

### Rollback Failed

**CRITICAL SITUATION!**

1. Contact DevOps team immediately
2. Check manual rollback procedures in DR documentation
3. Consider DR failover if primary site unrecoverable

---

## Environment-Specific Notes

### Development
- Use `../setup/start-dev.sh` instead of deployment scripts
- No need for pre-checks in development

### Staging
- Always test deployment scripts in staging first
- Run full 03-verify.sh suite

### Production
- **ALWAYS** run 01-pre-check.sh
- **ALWAYS** run 03-verify.sh
- **ALWAYS** have team member on standby for rollback

---

*Last Updated: 2025-12-07*
*Part of Repository Reorganization Phase 1*
