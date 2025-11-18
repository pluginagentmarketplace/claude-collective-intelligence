# PRODUCTION DEPLOYMENT CHECKLIST
## AI Agent Orchestrator with RabbitMQ v2.1.0

**Deployment Date:** _______________________
**Deployment Lead:** _______________________
**Deployment Window:** _________________ to _________________

---

## PHASE 1: PRE-DEPLOYMENT CHECKLIST (T-24 hours to T-0)

### Infrastructure Readiness

- [ ] Blue environment provisioned and online
- [ ] Green environment (current prod) healthy and baseline captured
- [ ] Network connectivity verified between all components
- [ ] Load balancer health checks configured
- [ ] DNS TTL reduced to 60 seconds (if planning DNS switchover)
- [ ] SSL/TLS certificates valid for > 30 days
- [ ] Firewall rules tested and verified
- [ ] VPC routing tables verified
- [ ] Monitoring agents deployed to blue environment
- [ ] Backup systems operational and tested

### Application & Code

- [ ] Code review completed and approved
- [ ] All pull requests merged to main branch
- [ ] Semantic versioning correct (v2.1.0)
- [ ] Git tag created: `git tag -a v2.1.0`
- [ ] Docker image built and pushed to registry
- [ ] Container image vulnerability scan passed (0 critical)
- [ ] Image size acceptable (< 500MB)
- [ ] Changelog updated with all features/fixes
- [ ] Release notes prepared for customers
- [ ] API documentation updated

### Database & Schema

- [ ] Forward migration scripts tested on replica
- [ ] Backward migration scripts prepared
- [ ] Migration scripts reviewed and approved
- [ ] Data validation queries prepared
- [ ] Database backup completed and verified
  - Full backup: _______________________
  - Backup location: _______________________
  - Backup size: _______________________
- [ ] Backup integrity verified with restore test
- [ ] Transaction log backups enabled
- [ ] Replication lag < 100ms
- [ ] Database indexes optimized for new queries

### Security & Compliance

- [ ] Dependency vulnerability scan passed
  ```bash
  npm audit --audit-level=moderate
  # Expected: 0 vulnerabilities
  ```
- [ ] Container image scan passed
- [ ] No hardcoded secrets found
  ```bash
  git log --all -S "password\|secret\|key" --oneline | head
  # Expected: Empty output
  ```
- [ ] OWASP Top 10 compliance verified
- [ ] Data encryption enabled (at-rest and in-transit)
- [ ] Access control policies reviewed
- [ ] Secrets rotated and deployed
- [ ] Certificate authority trust verified
- [ ] HSTS headers configured
- [ ] Security team sign-off obtained

### Configuration & Secrets

- [ ] Environment variables staged in blue
- [ ] RabbitMQ credentials rotated
- [ ] Database passwords changed
- [ ] API keys rotated
- [ ] OAuth credentials updated
- [ ] Configuration validation passed
  ```bash
  scripts/pre-deployment-check.sh --config-validation
  # Expected: All validations PASS
  ```
- [ ] Feature flags configured (disable if needed)
- [ ] Rate limiting configured
- [ ] Log levels appropriate (INFO for prod)
- [ ] Debug mode disabled

### Testing & Validation

- [ ] Unit tests passing (100%)
  ```bash
  npm run test:unit
  # Expected: All tests pass, coverage > 85%
  ```
- [ ] Integration tests passing (100%)
  ```bash
  npm run test:integration
  # Expected: All tests pass
  ```
- [ ] End-to-end tests passing (100%)
  ```bash
  npm run test:e2e
  # Expected: All tests pass
  ```
- [ ] Load testing completed
  - Peak load: 1000 concurrent users
  - Results: PASS / FAIL
  - Response time P95: _________________ ms
  - Error rate: _________________ %
- [ ] Performance baselines captured
  - CPU usage: _________________ %
  - Memory usage: _________________ %
  - Database query time: _________________ ms
- [ ] Security testing completed (OWASP scan)
- [ ] Smoke tests prepared and tested
- [ ] Database migration tested on replica

### Team & Communication

- [ ] Deployment lead assigned and confirmed
- [ ] Operations engineer assigned and confirmed
- [ ] DBA assigned and confirmed
- [ ] Monitoring engineer assigned and confirmed
- [ ] Network engineer assigned and confirmed
- [ ] QA engineer assigned and confirmed
- [ ] On-call team for 24h post-deploy: _______________________
- [ ] All team members briefed on procedures
- [ ] Escalation contacts verified and available
- [ ] Communication channels tested (#prod-deploy)
- [ ] Status page integration ready
- [ ] Customer notification prepared (if applicable)

### Monitoring & Observability

- [ ] Prometheus targets configured for blue environment
- [ ] Grafana dashboards imported and tested
- [ ] CloudWatch log groups created
- [ ] Log aggregation pipeline active
- [ ] APM agents configured
- [ ] Distributed tracing enabled
- [ ] Alert rules configured
- [ ] PagerDuty integration tested
  ```bash
  curl -X POST https://events.pagerduty.com/v2/enqueue \
    -d '{"routing_key":"...","event_action":"trigger"}'
  # Expected: 202 Accepted
  ```
- [ ] Slack webhook tested
- [ ] Email alerts tested

### Runbooks & Documentation

- [ ] This checklist reviewed and printed
- [ ] PRODUCTION_DEPLOYMENT_RUNBOOK.md reviewed by all
- [ ] CUTOVER_PROCEDURES.md reviewed by network team
- [ ] Rollback procedures documented and tested
- [ ] Troubleshooting guide prepared
- [ ] FAQ document available
- [ ] Deployment timeline visible to team

### Blue Environment Validation

- [ ] Blue application starts successfully
- [ ] Health check endpoint responds (HTTP 200)
  ```bash
  curl -s http://blue-app:3000/health | jq .
  # Expected: status = "ok"
  ```
- [ ] Database connectivity verified
  ```bash
  psql -h blue-db -U postgres -c "SELECT 1;"
  # Expected: "1"
  ```
- [ ] RabbitMQ connectivity verified
  ```bash
  curl -u guest:guest http://blue-rabbitmq:15672/api/overview
  # Expected: HTTP 200
  ```
- [ ] Redis connectivity verified
  ```bash
  redis-cli -h blue-redis ping
  # Expected: PONG
  ```
- [ ] All API endpoints responding
- [ ] No errors in blue application logs
- [ ] Memory usage acceptable (< 70%)
- [ ] CPU usage acceptable (< 60%)

### Final Pre-Deployment Verification

- [ ] All checklist items completed
- [ ] No critical issues identified
- [ ] All approvals obtained:
  - [ ] Release Manager: _______________________
  - [ ] Technical Lead: _______________________
  - [ ] Product Manager: _______________________
  - [ ] Security Lead: _______________________
  - [ ] Operations Manager: _______________________
- [ ] Go/No-Go decision: **[ ] GO  [ ] NO-GO**
- [ ] Deployment authorized by: _______________________
- [ ] Time authorized: _______________________
- [ ] Rollback plan understood by all
- [ ] Team ready for deployment

---

## PHASE 2: DEPLOYMENT CHECKLIST (During Deployment)

### Phase 2a: Pre-Deployment System Verification (T+0 to T+5 min)

**Current Time: _______ | Expected End Time: _______**

- [ ] Final system health check
  ```bash
  scripts/pre-deployment-check.sh --final
  ```
- [ ] Green (production) environment healthy
- [ ] Blue environment ready
- [ ] All team members in communication channels
- [ ] Monitoring dashboards active and visible
- [ ] Deployment window official start confirmed
- [ ] All systems: GO for deployment

**Status at T+5min: ✓ VERIFIED / ✗ ISSUES FOUND**

### Phase 2b: Blue Environment Deployment (T+5 to T+25 min)

**Current Time: _______ | Expected End Time: _______**

- [ ] Pull container image
  ```bash
  docker pull ghcr.io/yourcompany/app:v2.1.0
  ```
- [ ] Stop old containers on blue (if applicable)
- [ ] Deploy new containers
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  ```
- [ ] Verify container started
  ```bash
  docker ps | grep app
  ```
- [ ] Wait for application startup (30-60 seconds)
- [ ] Check application logs
  ```bash
  docker logs app | tail -20
  ```
- [ ] Health check passes
  ```bash
  curl -s http://blue-app:3000/health | jq .
  # Expected: status = "ok", version = "2.1.0"
  ```
- [ ] Run smoke tests
  ```bash
  npm run test:smoke -- --environment=blue
  # Expected: All tests PASS
  ```
- [ ] All critical endpoints responding
- [ ] No errors in application logs

**Blue Deployment Status: ✓ SUCCESSFUL / ✗ FAILED**

**Time to Deploy: _______ minutes**

### Phase 2c: Database Migration (T+25 to T+35 min)

**Current Time: _______ | Expected End Time: _______**

- [ ] Enable read-only mode on application
  ```bash
  curl -X POST http://blue-app:3000/admin/readonly \
    -H "Authorization: Bearer $TOKEN"
  ```
- [ ] Verify read-only mode enabled
- [ ] Create pre-migration backup
  ```bash
  pg_dump -h blue-db -U postgres -Fc \
    -f /backups/pre_2.1.0_backup.dump production
  ```
- [ ] Verify backup created and accessible
- [ ] Execute forward migration
  ```bash
  psql -h blue-db -U postgres -d production \
    -f /migrations/forward_2.1.0.sql
  ```
- [ ] Verify migration completed without errors
- [ ] Verify new schema version
  ```bash
  psql -h blue-db -U postgres -d production \
    -c "SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1;"
  # Expected: 2.1.0
  ```
- [ ] Run data integrity checks
  ```bash
  psql -h blue-db -U postgres -d production \
    -f /scripts/data_integrity_checks.sql
  # Expected: All checks PASS
  ```
- [ ] Create rollback savepoint
- [ ] Disable read-only mode
  ```bash
  curl -X POST http://blue-app:3000/admin/readonly \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"readonly": false}'
  ```
- [ ] Verify read-write mode enabled

**Database Migration Status: ✓ SUCCESSFUL / ✗ FAILED**

**Time to Migrate: _______ minutes**

### Phase 2d: Health Check & Validation (T+35 to T+50 min)

**Current Time: _______ | Expected End Time: _______**

- [ ] Run comprehensive health checks
  ```bash
  scripts/health-check-dashboard.sh --environment=blue
  ```
- [ ] Application health: PASS
- [ ] Database connectivity: PASS
- [ ] RabbitMQ connectivity: PASS
- [ ] Redis connectivity: PASS
- [ ] All API endpoints: PASS
- [ ] Memory usage acceptable
- [ ] CPU usage acceptable
- [ ] Disk usage acceptable
- [ ] Run full smoke test suite
  ```bash
  npm run test:smoke -- --environment=blue --verbose
  ```
- [ ] All smoke tests: PASS
- [ ] Performance metrics within baseline
  - Response time P95: _________________ ms (baseline: _________)
  - CPU usage: _________________ % (baseline: ______%)
  - Memory usage: _________________ MB (baseline: _______MB)
- [ ] No errors detected in logs
- [ ] Blue environment: READY FOR CUTOVER

**Health Check Status: ✓ ALL PASS / ✗ ISSUES FOUND**

**If Issues Found:**
- [ ] Investigate issue
- [ ] Resolve or decide rollback
- [ ] Document issue and resolution

### Phase 2e: Pre-Cutover Final Check (T+50 to T+55 min)

**Current Time: _______ | Expected End Time: _______**

- [ ] Verify green environment (current prod) still healthy
- [ ] Confirm all team members ready for cutover
- [ ] Final decision: Ready for traffic switch
- [ ] Go/No-Go approval from deployment lead
- [ ] Approval timestamp: _______________________
- [ ] All monitoring dashboards active
- [ ] All alert channels active
- [ ] Communication channels active

**Pre-Cutover Status: ✓ READY / ✗ NOT READY**

---

## PHASE 3: TRAFFIC CUTOVER CHECKLIST (T+55 to T+65 min)

**Current Time: _______ | Expected End Time: _______**

### Step 1: Initial State Verification

- [ ] Green: 100% traffic, Blue: 0% traffic
- [ ] All metrics captured (error rate, response time, etc.)
- [ ] Monitoring dashboard refreshing
- [ ] Alert channels active

### Step 2: Prepare Load Balancer (T+55 to T+56 min)

- [ ] Connect to load balancer console
- [ ] Locate blue and green target groups
- [ ] Record current weights:
  - Green weight: _______ (expected: 100)
  - Blue weight: _______ (expected: 0)
- [ ] Prepare weight adjustment commands
- [ ] Test credentials (if needed)

### Step 3: 50% Traffic Shift (T+56 to T+57 min)

- [ ] Update load balancer weights
  ```bash
  aws elbv2 modify-rule --rule-arn ... \
    --actions '[{"Type":"forward","TargetGroupArn":"...green...","Weight":50},{"Type":"forward","TargetGroupArn":"...blue...","Weight":50}]'
  ```
- [ ] Verify weights updated in console
- [ ] Wait 5 seconds for weight propagation
- [ ] Verify traffic flowing to both environments
- [ ] Monitor error rate (must remain < 0.1%)
- [ ] Monitor response time (must remain < 200ms p95)
- [ ] Check CPU/memory on both (no spike)
- [ ] Monitor queue depths (must remain normal)

**50% Shift Status: ✓ SUCCESSFUL / ✗ ISSUES**

**Error Rate at 50%: _________________ %**
**Response Time P95: _________________ ms**

### Step 4: 100% Traffic Shift to Blue (T+57 to T+60 min)

- [ ] All metrics stable with 50% shift
- [ ] Approval from deployment lead
- [ ] Update load balancer weights to 100/0
  ```bash
  aws elbv2 modify-rule --rule-arn ... \
    --actions '[{"Type":"forward","TargetGroupArn":"...blue...","Weight":100},{"Type":"forward","TargetGroupArn":"...green...","Weight":0}]'
  ```
- [ ] Verify weights updated (Blue: 100, Green: 0)
- [ ] Wait for traffic propagation (30 seconds)
- [ ] Verify all traffic now on blue
- [ ] Monitor error rate closely
- [ ] Monitor response time closely
- [ ] Check blue CPU/memory (no overload)
- [ ] Check database load (must be acceptable)

**100% Shift Status: ✓ SUCCESSFUL / ✗ ROLLBACK TRIGGERED**

**Error Rate at 100%: _________________ %**
**Response Time P95: _________________ ms**
**Blue CPU Usage: _________________ %**
**Blue Memory Usage: _________________ %**

### Step 5: Post-Cutover Immediate Validation (T+60 to T+65 min)

- [ ] Error rate stable (< 0.1%)
- [ ] Response time acceptable (p95 < 200ms)
- [ ] No memory leak observed
- [ ] No error spikes in logs
- [ ] Database performing well
- [ ] RabbitMQ queues processing normally
- [ ] Cache hit rates normal
- [ ] All health checks passing
- [ ] No customer complaints reported

**Cutover Status: ✓ SUCCESSFUL / ✗ ISSUES REQUIRING INVESTIGATION**

**Cutover Completion Time: _______________________**

---

## PHASE 4: POST-DEPLOYMENT CHECKLIST (T+65 to T+90 min)

### Immediate Post-Deployment (T+65 to T+80 min)

**Current Time: _______ | Expected End Time: _______**

- [ ] Run post-deployment verification
  ```bash
  scripts/post-deployment-verify.sh --immediate
  ```
- [ ] All checks passed
- [ ] Error rate trending downward or stable
- [ ] Response times stable
- [ ] Database replication lag normal (< 100ms)
- [ ] RabbitMQ queue depths normal
- [ ] Memory usage stable (no leak detected)
- [ ] CPU usage stable
- [ ] No memory pressure detected
- [ ] Cache performance normal
- [ ] External API integrations working
- [ ] All team members acknowledge success
- [ ] Deployment lead approves deployment

**Immediate Post-Deploy Status: ✓ SUCCESSFUL / ✗ ISSUES FOUND**

### Extended Post-Deployment Verification (T+80 to T+90 min)

- [ ] Deploy feature flags enabled/disabled as planned
- [ ] All new features working correctly
- [ ] All critical user flows verified
- [ ] Data integrity spot-checked
  ```bash
  scripts/post-deployment-verify.sh --data-integrity
  ```
- [ ] No unexpected behavior observed
- [ ] Support/customer service: No complaints
- [ ] Logging and monitoring: All normal
- [ ] Performance metrics: All within SLA
- [ ] Business metrics: No unexpected changes

**Extended Verification Status: ✓ PASSED / ✗ ISSUES FOUND**

### Documentation & Handoff

- [ ] Deployment metrics documented:
  - Start time: _______________________
  - End time: _______________________
  - Total duration: _________________ minutes
  - Downtime: 0 minutes
  - Issues encountered: [ ] None [ ] See notes below
- [ ] Issues documented (if any):
  - Issue 1: _______________________
  - Resolution: _______________________
- [ ] Performance baseline updated
- [ ] Deployment log filed in system
- [ ] Green environment decommissioned (or kept as backup)
- [ ] Database backup created post-deploy
- [ ] Post-deployment handoff meeting held (if needed)

### Team Sign-Off

- [ ] Deployment Lead: _______________________ (Signature)
- [ ] Operations Lead: _______________________ (Signature)
- [ ] DBA: _______________________ (Signature)
- [ ] QA Lead: _______________________ (Signature)

---

## PHASE 5: 24-HOUR MONITORING CHECKLIST

**Date:** _______________________

### Hour 1-6 Post-Deployment

- [ ] Monitor error rate (target: < 0.1%)
- [ ] Monitor response time (target: p95 < 200ms)
- [ ] Monitor CPU usage (target: < 70%)
- [ ] Monitor memory usage (target: < 75%)
- [ ] Check for memory leaks (trend analysis)
- [ ] Verify database performance (query times)
- [ ] Verify RabbitMQ queue processing
- [ ] Confirm no unplanned errors in logs
- [ ] Verify cache hit rates normal
- [ ] Check third-party integrations

**Status at 6 hours: ✓ HEALTHY / ⚠ WARNINGS / ✗ ISSUES**

### Hour 6-12 Post-Deployment

- [ ] Continue monitoring all metrics
- [ ] Verify business metrics normal
- [ ] Check customer feedback (support tickets)
- [ ] Review error tracking (Sentry/DataDog)
- [ ] Verify data consistency (spot checks)
- [ ] Monitor cost metrics (if applicable)
- [ ] Confirm performance trends stable

**Status at 12 hours: ✓ HEALTHY / ⚠ WARNINGS / ✗ ISSUES**

### Hour 12-24 Post-Deployment

- [ ] Finalize 24-hour post-deploy validation
  ```bash
  scripts/post-deployment-verify.sh --extended
  ```
- [ ] All metrics within normal range
- [ ] SLA compliance verified
- [ ] No unresolved issues
- [ ] Green environment officially deprecated
- [ ] Deployment declared SUCCESSFUL

**Status at 24 hours: ✓ SUCCESSFUL / ✗ ISSUES REQUIRING ATTENTION**

### Post-Deployment Meeting

- [ ] Schedule post-deployment review (if needed)
- [ ] Attendees: Deployment team + stakeholders
- [ ] Review deployment success metrics
- [ ] Discuss any issues and resolutions
- [ ] Document learnings for next deployment
- [ ] Update procedures if needed

---

## ROLLBACK DECISION POINT

**Rollback Criteria Triggered?**
- [ ] NO - Proceed with deployment completion
- [ ] YES - See ROLLBACK section below

### If Rollback Needed:

**Rollback Reason:** _______________________

**Rollback Initiated By:** _______________________

**Rollback Start Time:** _______________________

- [ ] Execute traffic rollback (Green: 100%, Blue: 0%)
- [ ] Verify traffic returned to green
- [ ] Monitor error rate returns to normal
- [ ] Check green application logs
- [ ] Verify database consistency (if needed)
- [ ] Notify all stakeholders
- [ ] Document root cause
- [ ] Schedule post-mortem

**Rollback Completion Time:** _______________________

**Rollback Status: ✓ SUCCESSFUL / ✗ PARTIAL / ✗ FAILED**

---

## CRITICAL DECISION GATES

### Gate 1: Pre-Deployment Go/No-Go (T-1 hour)

**Decision Authority:** Release Manager

- [ ] All critical items checked and verified
- [ ] No blocking issues identified
- [ ] Team ready
- [ ] Systems healthy

**Decision: [ ] GO [ ] NO-GO**

**Decided By:** _________________________ **Date/Time:** _________

---

### Gate 2: Pre-Cutover Go/No-Go (T+50 min)

**Decision Authority:** Deployment Lead

- [ ] Blue deployment successful
- [ ] Database migration successful
- [ ] Health checks all passing
- [ ] Ready for traffic switch

**Decision: [ ] GO [ ] NO-GO**

**Decided By:** _________________________ **Date/Time:** _________

---

### Gate 3: Post-Deployment Success (T+90 min)

**Decision Authority:** Deployment Lead

- [ ] All validations passed
- [ ] Error rate < 0.1%
- [ ] No critical issues
- [ ] Business metrics normal

**Decision: [ ] SUCCESS [ ] ISSUES REQUIRE ATTENTION**

**Decided By:** _________________________ **Date/Time:** _________

---

## NOTES & COMMENTS

```
[Space for deployment notes, issues, decisions, and observations]

Time: __________ Note: __________________________________________________________

Time: __________ Note: __________________________________________________________

Time: __________ Note: __________________________________________________________

Time: __________ Note: __________________________________________________________

Time: __________ Note: __________________________________________________________
```

---

## APPENDIX: QUICK REFERENCE

### Useful Commands

```bash
# Pre-deployment check
scripts/pre-deployment-check.sh --final

# Health check
scripts/health-check-dashboard.sh --environment=blue

# Post-deployment verification
scripts/post-deployment-verify.sh --immediate

# Rollback (emergency)
scripts/rollback.sh --version=2.0.5 --immediate=true

# Verify deployment
scripts/verify-deployment.sh --environment=green
```

### Contact Information

- Deployment Lead: _________________________ Phone: _________________
- On-Call Engineer: _________________________ Phone: _________________
- Engineering Lead: _________________________ Phone: _________________
- VP Engineering: _________________________ Phone: _________________

---

**Checklist Printed:** _______________________

**Printed By:** _______________________

**Location:** _______________________

---

*This checklist must be completed in full for each production deployment.*
*Keep this document for audit purposes for minimum 1 year.*
