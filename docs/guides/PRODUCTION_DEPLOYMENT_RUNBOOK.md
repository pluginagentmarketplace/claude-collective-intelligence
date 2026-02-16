# ENTERPRISE PRODUCTION DEPLOYMENT RUNBOOK
## AI Agent Orchestrator with RabbitMQ - Go-Live Procedures

**Document Version:** 2.1.0
**Last Updated:** 2025-11-18
**Status:** PRODUCTION READY
**Classification:** INTERNAL - OPERATIONAL

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Pre-Deployment Checklist (60+ Items)](#pre-deployment-checklist)
3. [Deployment Timeline & Phases](#deployment-timeline--phases)
4. [Team Roles & Responsibilities](#team-roles--responsibilities)
5. [Communication Plan](#communication-plan)
6. [Deployment Procedures](#deployment-procedures)
7. [Blue-Green Deployment Strategy](#blue-green-deployment-strategy)
8. [Database Migration Procedures](#database-migration-procedures)
9. [Cutover Strategy](#cutover-strategy)
10. [Rollback Criteria & Procedures](#rollback-criteria--procedures)
11. [Post-Deployment Validation](#post-deployment-validation)
12. [Emergency Contacts & Escalation](#emergency-contacts--escalation)
13. [Sign-Off & Approval](#sign-off--approval)

---

## EXECUTIVE SUMMARY

This runbook provides comprehensive procedures for deploying the AI Agent Orchestrator with RabbitMQ to production. The system uses blue-green deployment with instant rollback capability, ensuring zero-downtime deployments while maintaining service stability.

**Key Features:**
- Blue-green deployment architecture
- Automated database migrations with rollback capability
- Comprehensive health checks and validation
- Traffic switching with DNS/Load Balancer management
- Multi-stage rollback procedures
- Real-time monitoring during deployment
- Automated smoke testing

**Deployment Duration:** 45-90 minutes (depending on data volume)
**Estimated Downtime:** 0 minutes (blue-green strategy)
**Risk Level:** LOW (with strict validation gates)

---

## PRE-DEPLOYMENT CHECKLIST

### A. INFRASTRUCTURE & ENVIRONMENT (12 items)

**[  ] 1. Blue Environment Provisioning**
- [ ] Blue servers provisioned and online
- [ ] Blue database replicated from production
- [ ] Blue network interfaces configured
- [ ] Blue load balancer pools created
- [ ] Blue monitoring agents deployed
- [ ] Blue firewall rules configured
- [ ] Verification: `scripts/pre-deployment-check.sh --check-infrastructure`

**[  ] 2. Green Environment Verification**
- [ ] Current production (Green) environment baseline captured
- [ ] Green environment health checks passing (100%)
- [ ] Green database backup completed
- [ ] Green current transaction log positions recorded
- [ ] Green monitoring dashboards accessible
- [ ] Verification: `curl http://green-alb/health -v`

**[  ] 3. Network & Security Configuration**
- [ ] DNS switchover plan documented
- [ ] DNS TTL reduced to 60 seconds
- [ ] Load balancer health check paths verified
- [ ] SSL/TLS certificates valid for 30+ days
- [ ] Security groups rules tested
- [ ] VPC routing tables verified
- [ ] Verification: `openssl s_client -connect blue-alb:443 -showcerts`

**[  ] 4. Container Registry & Image**
- [ ] Docker image built and pushed to registry
- [ ] Image SHA digest recorded
- [ ] Image scanned for vulnerabilities (PASS)
- [ ] Image size acceptable (<500MB)
- [ ] Base image patches up-to-date
- [ ] Multi-architecture images available (amd64, arm64)
- [ ] Verification: `docker inspect <image:sha256>`

**[  ] 5. Database Preparation**
- [ ] Database backups completed (full + incremental)
- [ ] Backup integrity verified
- [ ] Backup locations documented
- [ ] Migration scripts tested on replica
- [ ] Rollback scripts prepared
- [ ] Data validation queries prepared
- [ ] Verification: `pg_dump -h blue-db -U postgres --dry-run | head -100`

**[  ] 6. SSL/TLS & Certificates**
- [ ] All certificates valid and renewed
- [ ] Certificate chain complete
- [ ] HSTS headers configured
- [ ] Certificate deployment tested
- [ ] Intermediate certs deployed
- [ ] CRL/OCSP stapling configured
- [ ] Verification: `certinfo --check blue-alb.example.com`

**[  ] 7. Configuration Management**
- [ ] Environment variables staged
- [ ] Secrets rotated and deployed
- [ ] Configuration files validated
- [ ] Feature flags configured
- [ ] Rate limiting configured
- [ ] Timeouts adjusted for load
- [ ] Verification: `scripts/pre-deployment-check.sh --config-validation`

**[  ] 8. Secrets & Credentials**
- [ ] RabbitMQ credentials rotated
- [ ] Database passwords changed
- [ ] API keys rotated
- [ ] OAuth credentials updated
- [ ] SSH keys configured
- [ ] Secrets manager synced
- [ ] Verification: Manual review by SecOps

**[  ] 9. Monitoring & Observability Setup**
- [ ] Prometheus monitoring configured
- [ ] Grafana dashboards deployed
- [ ] CloudWatch metrics enabled
- [ ] Log aggregation pipeline active
- [ ] APM agents configured
- [ ] Distributed tracing enabled
- [ ] Verification: Dashboard accessible and showing data

**[  ] 10. Load Balancer & Traffic Management**
- [ ] Load balancer weights configured (Blue: 0%, Green: 100%)
- [ ] Target group health checks enabled
- [ ] Connection draining timeout set to 30s
- [ ] Request routing rules configured
- [ ] Session stickiness disabled/configured
- [ ] Rate limiting rules deployed
- [ ] Verification: `aws elbv2 describe-target-groups`

**[  ] 11. Database Replication & Failover**
- [ ] Replication lag < 100ms
- [ ] Standby replica verified
- [ ] Automatic failover tested (on staging)
- [ ] Failover procedures documented
- [ ] Transaction log archiving active
- [ ] WAL retention configured
- [ ] Verification: `SELECT * FROM pg_stat_replication;`

**[  ] 12. Rollback Environment Preparation**
- [ ] Rollback scripts tested end-to-end
- [ ] Rollback timing documented
- [ ] Previous version container ready
- [ ] Database rollback points validated
- [ ] Rollback communication template prepared
- [ ] Verification: Mock rollback execution

---

### B. APPLICATION & CODE (14 items)

**[  ] 13. Code & Dependency Review**
- [ ] All code changes reviewed and approved
- [ ] Dependency security scan passed
- [ ] License compliance verified
- [ ] No breaking changes identified
- [ ] Semantic versioning correct
- [ ] Changelog updated
- [ ] Git tags created and signed
- [ ] Verification: `npm audit --audit-level=moderate`

**[  ] 14. Application Configuration**
- [ ] Node.js version verified (v18+)
- [ ] npm dependencies pinned
- [ ] Environment variables documented
- [ ] Log levels set appropriately
- [ ] Debug mode disabled
- [ ] Performance optimizations applied
- [ ] Verification: `npm list --depth=0`

**[  ] 15. RabbitMQ Configuration**
- [ ] Exchange declarations verified
- [ ] Queue bindings configured
- [ ] Dead-letter queues set up
- [ ] Message TTL configured
- [ ] Prefetch counts optimized
- [ ] Connection pooling configured
- [ ] Verification: `rabbitmqctl list_exchanges`

**[  ] 16. Database Schema Migration**
- [ ] Migration scripts written and tested
- [ ] Forward and backward migrations validated
- [ ] Schema changes documented
- [ ] Indexes created for new columns
- [ ] Constraints properly defined
- [ ] Data type changes handled
- [ ] Verification: Execute on blue replica

**[  ] 17. API Endpoint Validation**
- [ ] All REST endpoints documented
- [ ] GraphQL schema validated
- [ ] WebSocket endpoints tested
- [ ] Rate limits configured per endpoint
- [ ] CORS policies set
- [ ] API versioning correct
- [ ] Verification: `npm run validate:api`

**[  ] 18. Health Check Endpoints**
- [ ] Liveness probe returns 200 OK
- [ ] Readiness probe functional
- [ ] Startup probe working
- [ ] Database connectivity checked
- [ ] RabbitMQ connectivity checked
- [ ] Redis connectivity checked
- [ ] Verification: `curl http://blue-app:3000/health`

**[  ] 19. Error Handling & Logging**
- [ ] Error handlers configured
- [ ] Logging levels appropriate
- [ ] Structured logging enabled
- [ ] Error tracking (Sentry, DataDog) working
- [ ] Log rotation configured
- [ ] PII scrubbing enabled
- [ ] Verification: `npm run test:error-handling`

**[  ] 20. Performance Testing**
- [ ] Load testing completed
- [ ] Memory usage within limits
- [ ] CPU usage acceptable
- [ ] Database query performance verified
- [ ] Cache hit rates acceptable
- [ ] Response times within SLA
- [ ] Verification: Review load test reports

**[  ] 21. Feature Flags & Toggles**
- [ ] Feature flags configured
- [ ] Gradual rollout strategy defined
- [ ] Emergency disable procedures ready
- [ ] Flag state verified in blue environment
- [ ] Toggle testing completed
- [ ] Verification: Feature flag dashboard review

**[  ] 22. Caching Strategy**
- [ ] Redis cluster verified
- [ ] Cache keys documented
- [ ] TTLs configured
- [ ] Cache invalidation strategy defined
- [ ] Warm-up procedures prepared
- [ ] Cache hit ratio targets met
- [ ] Verification: `redis-cli INFO stats`

**[  ] 23. Security Scanning & Compliance**
- [ ] Dependency vulnerability scan (0 critical)
- [ ] Container image scan (0 critical)
- [ ] SAST scan completed
- [ ] Secrets scan passed (no hardcoded secrets)
- [ ] DAST scan passed
- [ ] Compliance checklist completed
- [ ] Verification: Review scan reports

**[  ] 24. Documentation & Knowledge Transfer**
- [ ] Deployment guide updated
- [ ] Runbook walkthroughs completed
- [ ] Team training completed
- [ ] FAQ document prepared
- [ ] Troubleshooting guide available
- [ ] Contact list updated
- [ ] Verification: Team sign-off obtained

**[  ] 25. Backup & Recovery Procedures**
- [ ] Full database backup < 4 hours old
- [ ] Transaction log backups ongoing
- [ ] Application state backup created
- [ ] Recovery Time Objective (RTO): 30 min
- [ ] Recovery Point Objective (RPO): 5 min
- [ ] Backup retention policy: 30 days
- [ ] Verification: `aws s3 ls s3://backups/`

**[  ] 26. Disaster Recovery Plan**
- [ ] Alternate site availability verified
- [ ] Geo-redundancy tested
- [ ] Failover time < 5 minutes
- [ ] Data consistency guaranteed
- [ ] Staff procedures documented
- [ ] Communication channels tested
- [ ] Verification: Mock disaster recovery test

---

### C. TESTING & VALIDATION (13 items)

**[  ] 27. Unit Tests**
- [ ] Unit test suite passes 100%
- [ ] Code coverage > 85%
- [ ] Critical paths covered
- [ ] Edge cases tested
- [ ] Mocking/stubbing verified
- [ ] Test data verified
- [ ] Verification: `npm run test:unit`

**[  ] 28. Integration Tests**
- [ ] Integration test suite passes 100%
- [ ] Database integration tested
- [ ] RabbitMQ integration tested
- [ ] Redis integration tested
- [ ] External API mocks working
- [ ] Test coverage adequate
- [ ] Verification: `npm run test:integration`

**[  ] 29. End-to-End Tests**
- [ ] E2E test suite passes 100%
- [ ] User workflows tested
- [ ] Happy path scenarios covered
- [ ] Error scenarios tested
- [ ] Multi-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsiveness verified
- [ ] Verification: `npm run test:e2e`

**[  ] 30. Performance & Load Tests**
- [ ] Load test: 1000 concurrent users (PASS)
- [ ] Stress test: 5000 concurrent users (PASS)
- [ ] Endurance test: 24-hour run (PASS)
- [ ] Database query performance verified
- [ ] API response time < 200ms (p95)
- [ ] Error rate < 0.1%
- [ ] Verification: Review k6/JMeter reports

**[  ] 31. Security Testing**
- [ ] OWASP Top 10 vulnerabilities: NONE
- [ ] SQL injection tests: PASS
- [ ] XSS protection tests: PASS
- [ ] CSRF protection tests: PASS
- [ ] Authentication tests: PASS
- [ ] Authorization tests: PASS
- [ ] Verification: Review OWASP scan results

**[  ] 32. Database Migration Tests**
- [ ] Forward migration tested on replica
- [ ] Backward migration tested
- [ ] Data integrity verified post-migration
- [ ] Performance impact assessed
- [ ] Index creation time measured
- [ ] Lock duration acceptable
- [ ] Verification: `npm run migrate:test`

**[  ] 33. Smoke Tests**
- [ ] Application startup: PASS
- [ ] Health check endpoint: PASS
- [ ] Database connection: PASS
- [ ] RabbitMQ connection: PASS
- [ ] API endpoints (top 10): PASS
- [ ] Critical user flows: PASS
- [ ] Verification: `scripts/post-deployment-verify.sh`

**[  ] 34. Configuration Testing**
- [ ] Environment variables correctly loaded
- [ ] Secrets properly mounted
- [ ] Feature flags functioning
- [ ] Log levels appropriate
- [ ] Performance settings optimized
- [ ] Rate limits working
- [ ] Verification: `scripts/pre-deployment-check.sh --config`

**[  ] 35. Rollback Testing**
- [ ] Rollback script executes without errors
- [ ] Previous version deployable
- [ ] Database rollback procedures verified
- [ ] Traffic rollback mechanisms tested
- [ ] Full rollback < 5 minutes
- [ ] Data consistency post-rollback
- [ ] Verification: Staged rollback test

**[  ] 36. Blue Environment Validation**
- [ ] Blue environment fully functional
- [ ] All tests pass on blue
- [ ] Performance baselines met
- [ ] Health checks: 100% pass
- [ ] No errors in logs
- [ ] Memory/CPU within limits
- [ ] Verification: `scripts/health-check-dashboard.sh`

**[  ] 37. Green Environment Baseline**
- [ ] Green environment metrics captured
- [ ] Current performance baseline recorded
- [ ] Error rate baseline established
- [ ] Response time baseline documented
- [ ] Database connection count baseline
- [ ] Cache hit rate baseline
- [ ] Verification: Export dashboards to PDF

**[  ] 38. Integration with External Systems**
- [ ] Third-party API connectivity tested
- [ ] Webhooks functioning correctly
- [ ] Authentication with external systems verified
- [ ] Data sync mechanisms working
- [ ] Error handling for external failures
- [ ] Fallback mechanisms active
- [ ] Verification: Integration test suite

**[  ] 39. User Acceptance Testing (UAT)**
- [ ] Stakeholder sign-off obtained
- [ ] Business scenarios tested
- [ ] Critical workflows validated
- [ ] User feedback incorporated
- [ ] UAT defects: 0 critical, <5 minor
- [ ] Performance acceptable to users
- [ ] Verification: UAT sign-off document

---

### D. OPERATIONAL & MONITORING (21 items)

**[  ] 40. Monitoring Infrastructure Setup**
- [ ] Prometheus scrape targets configured
- [ ] Grafana dashboards imported
- [ ] CloudWatch log groups created
- [ ] Log retention set appropriately
- [ ] Alert rules configured
- [ ] Threshold values tuned
- [ ] Verification: Dashboard accessible

**[  ] 41. Alerting & Notification Configuration**
- [ ] PagerDuty integration configured
- [ ] Slack notifications setup
- [ ] Email alerts configured
- [ ] Escalation paths defined
- [ ] On-call rotation active
- [ ] Alert templates created
- [ ] Verification: Send test alert

**[  ] 42. Logging Infrastructure**
- [ ] ELK stack/Log aggregation running
- [ ] Log shipper (Filebeat/Logstash) configured
- [ ] Log indexing strategy defined
- [ ] Retention policies set
- [ ] Search capability verified
- [ ] Performance impact minimal
- [ ] Verification: `curl http://elasticsearch:9200/_health`

**[  ] 43. Distributed Tracing Setup**
- [ ] Jaeger/Zipkin collector running
- [ ] Instrumentation agents deployed
- [ ] Trace sampling configured
- [ ] Trace data flowing correctly
- [ ] Trace UI accessible
- [ ] Retention policies set
- [ ] Verification: Generate test trace

**[  ] 44. Metrics Collection & Storage**
- [ ] Prometheus retention configured
- [ ] Metrics cardinality acceptable
- [ ] Data points stored correctly
- [ ] Query performance acceptable
- [ ] Long-term storage (S3/GCS) configured
- [ ] Backup of metrics configured
- [ ] Verification: Query Prometheus API

**[  ] 45. Dashboard Configuration**
- [ ] Overview dashboard created
- [ ] Service health dashboard
- [ ] Business metrics dashboard
- [ ] Infrastructure dashboard
- [ ] Database performance dashboard
- [ ] RabbitMQ dashboard
- [ ] Verification: All dashboards load correctly

**[  ] 46. SLA & Metrics Definition**
- [ ] Availability SLA: 99.95% defined
- [ ] Response time SLA: P95 < 200ms
- [ ] Error rate SLA: < 0.1%
- [ ] Throughput targets: 10k req/s
- [ ] Metrics for each SLA tracking
- [ ] Dashboard showing current compliance
- [ ] Verification: Review with stakeholders

**[  ] 47. Incident Response Plan**
- [ ] Incident classification defined
- [ ] Response procedures documented
- [ ] Escalation matrix created
- [ ] Communication templates ready
- [ ] Status page integration ready
- [ ] Post-incident review process defined
- [ ] Verification: Tabletop exercise completed

**[  ] 48. On-Call Schedule & Contacts**
- [ ] On-call team assigned
- [ ] Primary on-call: ________
- [ ] Secondary on-call: ________
- [ ] Manager on-call: ________
- [ ] Contact information verified
- [ ] Escalation numbers active
- [ ] Verification: Test calls placed

**[  ] 49. Performance Baseline Metrics**
- [ ] CPU usage baseline: < 60%
- [ ] Memory usage baseline: < 70%
- [ ] Disk I/O baseline recorded
- [ ] Network bandwidth baseline
- [ ] Database connection count: < 50
- [ ] Queue depth baseline: < 1000
- [ ] Verification: Captured in monitoring system

**[  ] 50. Business Continuity Planning**
- [ ] Backup infrastructure online
- [ ] Geographic redundancy verified
- [ ] Data replication lag < 100ms
- [ ] Failover procedures tested
- [ ] Communication with customers prepared
- [ ] Service degradation mode defined
- [ ] Verification: Failover test completed

**[  ] 51. Capacity Planning & Scaling**
- [ ] Current capacity assessed
- [ ] Peak load requirements identified
- [ ] Auto-scaling policies configured
- [ ] Horizontal scaling tested
- [ ] Vertical scaling procedure documented
- [ ] Cost impact analyzed
- [ ] Verification: Scaling test completed

**[  ] 52. Change Log & Deployment Notes**
- [ ] Release notes prepared
- [ ] Known issues documented
- [ ] Breaking changes noted
- [ ] Migration guide available
- [ ] Feature documentation updated
- [ ] API changelog updated
- [ ] Verification: Reviewed with product team

**[  ] 53. Communication Infrastructure**
- [ ] Slack channels active (#prod-deploy)
- [ ] Status page (StatusPage.io) ready
- [ ] Email distribution lists configured
- [ ] Conference bridge scheduled (if needed)
- [ ] Communication template prepared
- [ ] Verification: Test message sent

**[  ] 54. Access Control & Permissions**
- [ ] Deploy permissions verified
- [ ] SSH access to all servers
- [ ] Database access credentials
- [ ] Load balancer access
- [ ] DNS management access
- [ ] Monitoring system access
- [ ] Verification: Access test for each service

**[  ] 55. Documentation & Runbooks**
- [ ] This runbook reviewed and approved
- [ ] Deployment checklist printed/accessible
- [ ] Cutover procedures documented
- [ ] Rollback procedures accessible
- [ ] Troubleshooting guide available
- [ ] FAQs updated
- [ ] Verification: Team briefing completed

**[  ] 56. Approval & Sign-Off**
- [ ] Technical lead approval: _________ ________
- [ ] Release manager approval: _________ ________
- [ ] Product manager approval: _________ ________
- [ ] Security approval: _________ ________
- [ ] Operations approval: _________ ________
- [ ] All approvals documented in JIRA
- [ ] Verification: JIRA ticket updated

**[  ] 57. Go/No-Go Decision Meeting**
- [ ] Meeting scheduled: _________ at _________
- [ ] All stakeholders present
- [ ] All checklist items reviewed
- [ ] Risk assessment completed
- [ ] Mitigation strategies confirmed
- [ ] Go decision documented
- [ ] Verification: Meeting notes filed

**[  ] 58. Pre-Deployment Briefing**
- [ ] All team members briefed
- [ ] Roles and responsibilities confirmed
- [ ] Communication procedures reviewed
- [ ] Escalation procedures practiced
- [ ] Contingency plans understood
- [ ] Q&A session completed
- [ ] Verification: Attendance sheet signed

**[  ] 59. Deployment Execution Authority**
- [ ] Deployment authorized by: _________
- [ ] Authorization timestamp: _________
- [ ] Authorization document filed
- [ ] Contingency authorization obtained
- [ ] Decision maker available during deployment
- [ ] Escalation authority confirmed
- [ ] Verification: Authority confirmation received

**[  ] 60. Final System Health Verification**
- [ ] Green (production) environment: HEALTHY
- [ ] Blue environment: READY
- [ ] Network: OPERATIONAL
- [ ] Database: HEALTHY
- [ ] RabbitMQ: OPERATIONAL
- [ ] Monitoring: ACTIVE
- [ ] Verification: `scripts/pre-deployment-check.sh --final`

---

## DEPLOYMENT TIMELINE & PHASES

### Phase 0: PRE-DEPLOYMENT GATE (T-24 hours to T-0)

**T-24 hours:**
- Final checklist review
- Team briefing scheduled
- Communication channels tested
- Go/no-go decision meeting

**T-4 hours:**
- Final verification of all systems
- Team arrival on-site/online
- Communication channels opened
- Monitoring dashboards loaded

**T-1 hour:**
- Final smoke tests on blue environment
- Green environment baseline captured
- Database backups verified
- Team ready status confirmation

### Phase 1: PRE-DEPLOYMENT VALIDATION (T+0 to T+5 min)

**Timeline:**
```
T+0 min:  Deployment starts - All systems monitoring
T+0 min:  Run pre-deployment checks
T+1 min:  Verify network connectivity
T+2 min:  Validate database status
T+3 min:  Confirm RabbitMQ status
T+5 min:  Final go/no-go approval
```

**Actions:**
- Execute: `scripts/pre-deployment-check.sh`
- Verify: All checks return SUCCESS
- Decisions: GO or NO-GO

### Phase 2: BLUE DEPLOYMENT (T+5 to T+25 min)

**Timeline:**
```
T+5 min:  Start blue environment deployment
T+7 min:  Pull container images
T+9 min:  Deploy application containers
T+12 min: Initialize application startup
T+15 min: Wait for health check readiness
T+20 min: Run smoke tests on blue
T+25 min: Blue environment ready for traffic
```

**Actions:**
- Execute: `scripts/deploy.sh --environment=blue`
- Monitor: Deployment logs in real-time
- Validate: Health checks returning 200 OK
- Trigger: Smoke test suite execution

**Failure Handling:**
- If deployment fails: Investigate, fix, retry
- Maximum retries: 2
- Time limit: 20 minutes
- Escalation: Technical lead review

### Phase 3: DATABASE MIGRATION (T+25 to T+35 min)

**Timeline:**
```
T+25 min: Lock application (read-only mode)
T+26 min: Backup database state
T+27 min: Execute migration scripts (forward)
T+30 min: Verify data integrity
T+32 min: Create rollback savepoint
T+35 min: Resume application (read-write mode)
```

**Actions:**
- Set feature flag: `ENABLE_READ_ONLY=true`
- Execute: `npm run migrate:up`
- Validate: `scripts/post-deployment-verify.sh --db-validation`
- Create: Rollback savepoint

**Failure Handling:**
- If migration fails: Execute rollback migration
- Restore: Previous database state
- Rollback: Blue deployment
- Notify: All stakeholders

### Phase 4: HEALTH CHECK & VALIDATION (T+35 to T+45 min)

**Timeline:**
```
T+35 min: Run comprehensive health checks
T+37 min: Validate API endpoints
T+39 min: Run smoke test suite
T+41 min: Performance baseline test
T+45 min: Final validation complete
```

**Actions:**
- Execute: `scripts/health-check-dashboard.sh`
- Validate: All checks PASS
- Monitor: Metrics and logs
- Decision: Ready for cutover

**Failure Handling:**
- If validation fails: Investigate
- Rollback: To previous version
- Restore: Database to pre-migration state
- Notify: Stakeholders

### Phase 5: TRAFFIC CUTOVER (T+45 to T+55 min)

**Timeline:**
```
T+45 min: Final pre-cutover checks
T+47 min: DNS TTL reduction (if needed)
T+48 min: Load balancer weight adjustment (start)
T+50 min: Route 50% traffic to blue
T+51 min: Monitor error rates (must be 0)
T+52 min: Route 100% traffic to blue
T+55 min: Cutover complete
```

**Actions:**
- Update: Load balancer target group weights
- Monitor: Error rates in real-time
- Verify: Traffic routing correctly
- Document: Cutover completion time

**Failure Handling:**
- If errors detected: Rollback immediately
- Revert: Load balancer weights to green
- Investigate: Root cause
- Execute: Rollback procedure

### Phase 6: POST-DEPLOYMENT VERIFICATION (T+55 to T+90 min)

**Timeline:**
```
T+55 min: Monitor system stability
T+60 min: Verify no spike in errors
T+65 min: Check performance metrics
T+70 min: Database consistency verification
T+75 min: Monitor queue depths
T+80 min: Verify external integrations
T+90 min: Deployment complete
```

**Actions:**
- Monitor: All dashboards
- Validate: SLA metrics
- Run: Final validation checks
- Document: Deployment completion
- Notify: Stakeholders

**Success Criteria:**
- Error rate < 0.1%
- Response time P95 < 200ms
- No data integrity issues
- All health checks PASS
- Customer impact: NONE

---

## TEAM ROLES & RESPONSIBILITIES

### 1. DEPLOYMENT LEAD (Decision Authority)
**Name:** _______________________
**Phone:** _______________________
**Email:** _______________________

**Responsibilities:**
- Overall deployment coordination
- Go/no-go decision authority
- Escalation decision maker
- Communication with stakeholders
- Incident command (if issues arise)

**Pre-Deployment:**
- [ ] Confirm all checklist items complete
- [ ] Review risk assessment
- [ ] Approve deployment window
- [ ] Brief the team

**During Deployment:**
- [ ] Monitor overall progress
- [ ] Make critical decisions
- [ ] Escalate issues immediately
- [ ] Communicate status to leadership

**Post-Deployment:**
- [ ] Confirm deployment success
- [ ] Sign off on completion
- [ ] Schedule post-mortem (if needed)

---

### 2. OPERATIONS ENGINEER (Primary Executor)
**Name:** _______________________
**Phone:** _______________________
**Email:** _______________________

**Responsibilities:**
- Execute deployment scripts
- Monitor infrastructure
- Perform health checks
- Execute rollback if needed

**Pre-Deployment:**
- [ ] Prepare deployment commands
- [ ] Verify all access credentials
- [ ] Test deployment scripts
- [ ] Prepare rollback commands

**During Deployment:**
- [ ] Execute deployment steps
- [ ] Monitor logs in real-time
- [ ] Report status to lead
- [ ] Execute rollback if triggered

**Post-Deployment:**
- [ ] Verify all systems operational
- [ ] Document deployment metrics
- [ ] Complete deployment log

---

### 3. DATABASE ADMINISTRATOR (DBA)
**Name:** _______________________
**Phone:** _______________________
**Email:** _______________________

**Responsibilities:**
- Database migration execution
- Data integrity verification
- Backup management
- Rollback procedures

**Pre-Deployment:**
- [ ] Verify migration scripts
- [ ] Create pre-migration backups
- [ ] Test rollback procedures
- [ ] Prepare data validation queries

**During Deployment:**
- [ ] Execute database migration
- [ ] Monitor migration progress
- [ ] Validate data integrity
- [ ] Create rollback savepoints

**Post-Deployment:**
- [ ] Verify database consistency
- [ ] Run data validation tests
- [ ] Create final backups
- [ ] Document migration completion

---

### 4. MONITORING & OBSERVABILITY ENGINEER
**Name:** _______________________
**Phone:** _______________________
**Email:** _______________________

**Responsibilities:**
- Real-time monitoring
- Alert management
- Dashboard management
- Performance analysis

**Pre-Deployment:**
- [ ] Prepare monitoring dashboards
- [ ] Test alert channels
- [ ] Configure baseline metrics
- [ ] Prepare runbooks for alerts

**During Deployment:**
- [ ] Monitor all dashboards 24/7
- [ ] Alert on any anomalies
- [ ] Track metrics in real-time
- [ ] Report status to lead

**Post-Deployment:**
- [ ] Verify SLA compliance
- [ ] Document performance metrics
- [ ] Archive monitoring data

---

### 5. QUALITY ASSURANCE ENGINEER
**Name:** _______________________
**Phone:** _______________________
**Email:** _______________________

**Responsibilities:**
- Smoke testing
- Validation testing
- Issue triage
- Test reporting

**Pre-Deployment:**
- [ ] Prepare test scripts
- [ ] Test smoke test suite
- [ ] Document test cases
- [ ] Set up test data

**During Deployment:**
- [ ] Execute smoke tests after blue deployment
- [ ] Execute validation tests after cutover
- [ ] Triage any failures
- [ ] Report test results

**Post-Deployment:**
- [ ] Execute final UAT verification
- [ ] Document test results
- [ ] Create final test report

---

### 6. NETWORK ENGINEER
**Name:** _______________________
**Phone:** _______________________
**Email:** _______________________

**Responsibilities:**
- DNS management
- Load balancer configuration
- Network routing
- Firewall rule management

**Pre-Deployment:**
- [ ] Verify DNS configuration
- [ ] Prepare DNS switchover plan
- [ ] Configure load balancer weights
- [ ] Verify network routing

**During Deployment:**
- [ ] Adjust load balancer weights
- [ ] Monitor network traffic
- [ ] Handle DNS switchover (if needed)
- [ ] Monitor network latency

**Post-Deployment:**
- [ ] Verify all DNS entries
- [ ] Verify load balancer status
- [ ] Monitor network performance

---

### 7. SECURITY ENGINEER
**Name:** _______________________
**Phone:** _______________________
**Email:** _______________________

**Responsibilities:**
- Security validation
- Secrets management
- Compliance verification
- Incident security response

**Pre-Deployment:**
- [ ] Verify security scanning passed
- [ ] Validate secrets rotation
- [ ] Confirm compliance checklist
- [ ] Audit deployment access

**During Deployment:**
- [ ] Monitor security alerts
- [ ] Verify no unauthorized access
- [ ] Monitor suspicious activities
- [ ] Alert on security issues

**Post-Deployment:**
- [ ] Complete security verification
- [ ] Audit deployment actions
- [ ] Document security findings

---

### 8. COMMUNICATION LEAD
**Name:** _______________________
**Phone:** _______________________
**Email:** _______________________

**Responsibilities:**
- Stakeholder communication
- Status page updates
- Customer notifications
- Documentation of communications

**Pre-Deployment:**
- [ ] Prepare status page message
- [ ] Draft customer notification
- [ ] Prepare internal update template
- [ ] Test all communication channels

**During Deployment:**
- [ ] Update status page every 15 minutes
- [ ] Send customer notifications (if applicable)
- [ ] Update internal chat channels
- [ ] Respond to inquiries

**Post-Deployment:**
- [ ] Final status page update
- [ ] Send completion notification
- [ ] Document all communications
- [ ] Archive for review

---

## COMMUNICATION PLAN

### Communication Channels

**Primary Channels:**
- Slack: `#prod-deployment` (real-time updates)
- Email: `production-team@company.com` (formal notifications)
- Status Page: `status.company.com` (external visibility)
- Conference Line: `+1-XXX-XXX-XXXX` (audio if needed)

**Escalation Channels:**
- Engineering Lead: Direct call/SMS
- VP Engineering: Email + Slack
- Executive On-Call: Company phone system

### Pre-Deployment Communication (T-24 hours)

**Message Template:**

```
SUBJECT: Production Deployment Scheduled - [Date] at [Time] UTC

ANNOUNCEMENT TO: All stakeholders

Dear Team,

We are pleased to announce the production deployment of AI Agent
Orchestrator v2.1.0 scheduled for:

Date: [Date]
Time: [Time] UTC (EST/PST equivalents)
Expected Duration: 45-90 minutes
Expected Downtime: 0 minutes (blue-green deployment)

Key Changes:
- Feature 1: [description]
- Feature 2: [description]
- Bug fixes: [count] issues resolved

Impact:
- Service availability: MAINTAINED
- Data access: MAINTAINED
- API endpoints: MAINTAINED

Deployment Team:
- Deployment Lead: [Name]
- Operations: [Name]
- Database: [Name]
- Monitoring: [Name]

Questions? Contact: [Email]

Thank you,
Production Team
```

### During-Deployment Communication (Every 15 minutes)

**Status Update Template:**

```
TIMESTAMP: [Time] UTC
STATUS: [IN PROGRESS / COMPLETE]
CURRENT PHASE: [Phase Name]

Progress:
✓ Phase 1: Pre-deployment validation - COMPLETE (5 min)
→ Phase 2: Blue deployment - IN PROGRESS (12/20 min)
  Phase 3: Database migration - PENDING
  Phase 4: Health checks - PENDING
  Phase 5: Traffic cutover - PENDING
  Phase 6: Post-deployment - PENDING

Metrics:
- Blue environment: HEALTHY
- Green environment: OPERATIONAL
- Error rate: 0.02%
- Response time (p95): 145ms

Next Update: [Time] UTC
```

### Issue Communication (If Needed)

**Issue Alert Template:**

```
PRIORITY: [CRITICAL / HIGH / MEDIUM]
TIMESTAMP: [Time] UTC
ISSUE: [Issue Description]

Symptom:
- [Observation 1]
- [Observation 2]

Investigation Status: [In Progress / Identified / Resolved]

Action:
- [Action 1]
- [Action 2]

Estimated Time to Resolution: [Time]

Owner: [Name]
Next Update: [Time]
```

### Post-Deployment Communication

**Success Message Template:**

```
SUBJECT: Production Deployment Complete - [Date]

ANNOUNCEMENT TO: All stakeholders

Great news! The AI Agent Orchestrator v2.1.0 has been successfully
deployed to production.

Deployment Summary:
- Duration: [Actual time]
- Start time: [Time] UTC
- End time: [Time] UTC
- Downtime: 0 minutes
- Errors: 0 critical
- Rollback needed: NO

Validation Results:
✓ All health checks passed
✓ Data integrity verified
✓ Performance within SLA
✓ No error spikes detected

New Features Available:
- [Feature 1]
- [Feature 2]

Documentation:
- Release notes: [Link]
- API documentation: [Link]
- Migration guide: [Link]

Thank you all for your coordination and effort!

Production Team
```

---

## DEPLOYMENT PROCEDURES

### Procedure 1: Blue Environment Deployment

**Execution Time:** 20 minutes
**Risk Level:** LOW (no traffic yet)
**Rollback Capability:** YES (revert image)

**Steps:**

1. **Prepare Deployment**
   ```bash
   # Set environment variables
   export ENVIRONMENT=blue
   export IMAGE_VERSION=2.1.0
   export REGISTRY=ghcr.io/yourcompany

   # Verify image exists
   docker pull $REGISTRY/app:$IMAGE_VERSION
   ```

2. **Stop Old Containers (if any)**
   ```bash
   # Connect to blue environment
   ssh ops@blue-app-1.prod.internal

   # Gracefully stop containers
   docker stop app
   docker rm app

   # Verify stopped
   docker ps | grep app
   ```

3. **Deploy New Application**
   ```bash
   # Deploy via Docker Compose or orchestration
   docker-compose -f docker-compose.prod.yml up -d app

   # Verify container started
   docker ps | grep app
   docker logs app (first 50 lines)
   ```

4. **Wait for Application Startup**
   ```bash
   # Monitor startup logs
   docker logs -f app

   # Wait for: "Application ready to accept connections"
   # Expected startup time: 30-60 seconds
   ```

5. **Health Check**
   ```bash
   # Check application health
   curl -s http://localhost:3000/health | jq .

   # Expected response:
   # {
   #   "status": "ok",
   #   "timestamp": "2025-11-18T...",
   #   "version": "2.1.0",
   #   "database": "ok",
   #   "rabbitmq": "ok",
   #   "redis": "ok"
   # }

   # Verify all components: OK
   ```

6. **Smoke Tests on Blue**
   ```bash
   # Run smoke test suite
   npm run test:smoke -- --environment=blue

   # Expected: All tests pass (100%)
   # Duration: 5-10 minutes
   ```

7. **Verify Logs**
   ```bash
   # Check for errors
   docker logs app | grep -i error | tail -20

   # Expected: No critical errors
   ```

8. **Document Status**
   ```bash
   # Record metrics
   docker stats app (capture baseline)
   df -h (disk usage)
   free -h (memory usage)

   # Blue deployment status: READY
   ```

---

### Procedure 2: Database Migration

**Execution Time:** 10 minutes
**Risk Level:** MEDIUM (data modification)
**Rollback Capability:** YES (backward migration)

**Pre-Migration Verification:**

```bash
# 1. Check current schema version
psql -h blue-db-1.prod.internal -U postgres -d production \
  -c "SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1;"

# Expected: Last version before migration

# 2. Verify migration scripts exist
ls -la /migrations/
# Expected: forward_*.sql and backward_*.sql files

# 3. Test migration on replica (CRITICAL)
pg_basebackup -h blue-db-1.prod.internal -D /tmp/db_replica -P
psql -h /tmp/db_replica -U postgres -d production \
  -f /migrations/forward_2.1.0.sql

# Expected: No errors
```

**Migration Execution:**

```bash
# 1. Enable read-only mode
curl -X POST http://blue-app-1:3000/admin/readonly \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify mode change
sleep 5
curl http://blue-app-1:3000/status | jq .readonly

# Expected: true

# 2. Create backup before migration
pg_dump -h blue-db-1.prod.internal -U postgres \
  -Fc -f /backups/pre_2.1.0_backup.dump production

# Verify backup
pg_restore --list /backups/pre_2.1.0_backup.dump | head -20

# 3. Execute migration
psql -h blue-db-1.prod.internal -U postgres -d production \
  -f /migrations/forward_2.1.0.sql

# Expected: No errors, migration takes < 5 minutes

# 4. Verify migration
psql -h blue-db-1.prod.internal -U postgres -d production \
  -c "SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1;"

# Expected: 2.1.0

# 5. Data integrity check
psql -h blue-db-1.prod.internal -U postgres -d production \
  -f /scripts/data_integrity_checks.sql

# Expected: All checks pass

# 6. Disable read-only mode
curl -X POST http://blue-app-1:3000/admin/readonly \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"readonly": false}'

# Verify
curl http://blue-app-1:3000/status | jq .readonly
# Expected: false
```

**Rollback (If Needed):**

```bash
# 1. Enable read-only mode immediately
curl -X POST http://blue-app-1:3000/admin/readonly \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Execute backward migration
psql -h blue-db-1.prod.internal -U postgres -d production \
  -f /migrations/backward_2.1.0.sql

# Expected: No errors

# 3. Verify rollback
psql -h blue-db-1.prod.internal -U postgres -d production \
  -c "SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1;"

# Expected: Previous version

# 4. Disable read-only mode
curl -X POST http://blue-app-1:3000/admin/readonly \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"readonly": false}'
```

---

### Procedure 3: Health Check Validation

**Execution Time:** 10 minutes
**Command:** `scripts/health-check-dashboard.sh`

**Validation Checks:**

```bash
#!/bin/bash
# Health Check Dashboard Script

ENVIRONMENT=${1:-blue}
CHECKS_PASSED=0
CHECKS_FAILED=0

echo "======================================"
echo "Health Check Dashboard - $ENVIRONMENT"
echo "======================================"

# Application Health
echo -e "\n1. APPLICATION HEALTH"
response=$(curl -s -w "\n%{http_code}" http://$ENVIRONMENT-app:3000/health)
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -eq 200 ]; then
  echo "✓ Application responding: 200 OK"
  echo "  Version: $(echo $body | jq -r .version)"
  echo "  Uptime: $(echo $body | jq -r .uptime)"
  ((CHECKS_PASSED++))
else
  echo "✗ Application not responding: $http_code"
  ((CHECKS_FAILED++))
fi

# Database Connectivity
echo -e "\n2. DATABASE CONNECTIVITY"
db_status=$(echo $body | jq -r .database)
if [ "$db_status" = "ok" ]; then
  echo "✓ Database connected"
  ((CHECKS_PASSED++))
else
  echo "✗ Database issue: $db_status"
  ((CHECKS_FAILED++))
fi

# RabbitMQ Connectivity
echo -e "\n3. RABBITMQ CONNECTIVITY"
rabbitmq_status=$(echo $body | jq -r .rabbitmq)
if [ "$rabbitmq_status" = "ok" ]; then
  echo "✓ RabbitMQ connected"
  ((CHECKS_PASSED++))
else
  echo "✗ RabbitMQ issue: $rabbitmq_status"
  ((CHECKS_FAILED++))
fi

# Redis Connectivity
echo -e "\n4. REDIS CONNECTIVITY"
redis_status=$(echo $body | jq -r .redis)
if [ "$redis_status" = "ok" ]; then
  echo "✓ Redis connected"
  ((CHECKS_PASSED++))
else
  echo "✗ Redis issue: $redis_status"
  ((CHECKS_FAILED++))
fi

# Memory Usage
echo -e "\n5. MEMORY USAGE"
memory_percent=$(docker stats --no-stream | grep app | awk '{print $7}')
if [ $(echo "$memory_percent < 80" | bc) -eq 1 ]; then
  echo "✓ Memory usage: $memory_percent (< 80%)"
  ((CHECKS_PASSED++))
else
  echo "✗ High memory usage: $memory_percent"
  ((CHECKS_FAILED++))
fi

# CPU Usage
echo -e "\n6. CPU USAGE"
cpu_percent=$(docker stats --no-stream | grep app | awk '{print $3}')
if [ $(echo "$cpu_percent < 80" | bc) -eq 1 ]; then
  echo "✓ CPU usage: $cpu_percent (< 80%)"
  ((CHECKS_PASSED++))
else
  echo "✗ High CPU usage: $cpu_percent"
  ((CHECKS_FAILED++))
fi

# API Endpoints
echo -e "\n7. API ENDPOINTS"
endpoints=("/api/agents" "/api/messages" "/api/health")
for endpoint in "${endpoints[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" http://$ENVIRONMENT-app:3000$endpoint)
  if [ "$response" -eq 200 ] || [ "$response" -eq 401 ]; then
    echo "✓ $endpoint: $response"
    ((CHECKS_PASSED++))
  else
    echo "✗ $endpoint: $response"
    ((CHECKS_FAILED++))
  fi
done

# Summary
echo -e "\n======================================"
echo "SUMMARY"
echo "======================================"
echo "Checks Passed: $CHECKS_PASSED"
echo "Checks Failed: $CHECKS_FAILED"

if [ $CHECKS_FAILED -eq 0 ]; then
  echo "Status: ✓ ALL CHECKS PASSED"
  exit 0
else
  echo "Status: ✗ SOME CHECKS FAILED"
  exit 1
fi
```

---

## BLUE-GREEN DEPLOYMENT STRATEGY

### Overview

Blue-green deployment strategy ensures zero-downtime deployments by:
1. Maintaining two identical production environments (blue and green)
2. Deploying new version to inactive environment (blue)
3. Validating new version thoroughly
4. Switching traffic to new environment
5. Keeping old environment as instant rollback target

### Architecture Diagram

```
                    ┌─────────────────────┐
                    │  DNS / Load Balancer │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐         ┌─────▼─────┐
              │   GREEN   │         │    BLUE   │
              │ (Current) │         │   (Next)  │
              └───────────┘         └───────────┘
              ├─ App v2.0.5         ├─ App v2.1.0
              ├─ DB v5 Schema       ├─ DB v6 Schema
              ├─ 100% Traffic       ├─ 0% Traffic
              └─ Running            └─ Ready

              CUTOVER:
              GREEN ◀─────────────────────► BLUE
              100% Traffic    ────────►    100% Traffic
              0% Traffic      ◄────────    0% Traffic
```

### Deployment Sequence

**Step 1: Initial State (Green Active, Blue Idle)**
```
Load Balancer Target Groups:
  green-target-group: 100 (weight)
  blue-target-group:  0 (weight)

Result: All traffic goes to green environment
```

**Step 2: Deploy to Blue (Green Still Active)**
```
Actions:
  1. Deploy app v2.1.0 to blue servers
  2. Run migrations on blue database
  3. Execute smoke tests on blue
  4. Validate blue environment thoroughly

Load Balancer: UNCHANGED
  green-target-group: 100 (weight)
  blue-target-group:  0 (weight)

Result: Blue ready but inactive, no user impact
```

**Step 3: Health Check (Pre-Cutover)**
```
Validate:
  1. Blue application: HEALTHY
  2. Blue database: CONSISTENT
  3. Blue health checks: ALL PASS
  4. Blue API endpoints: RESPONSIVE
  5. Blue error rate: < 0.1%

Decision: GO or NO-GO for cutover
```

**Step 4: Traffic Cutover**
```
Transition Phase 1 (50% traffic):
  green-target-group: 50 (weight)
  blue-target-group:  50 (weight)

  Wait: 60 seconds
  Monitor: Error rate, response time, CPU/memory
  Validate: No degradation

Transition Phase 2 (100% to blue):
  green-target-group: 0 (weight)
  blue-target-group:  100 (weight)

  Result: All traffic routed to blue
```

**Step 5: Post-Cutover Monitoring**
```
Monitor for:
  ✓ Error rate stable (< 0.1%)
  ✓ Response time acceptable (p95 < 200ms)
  ✓ No memory leaks detected
  ✓ No resource exhaustion
  ✓ Database performing well
  ✓ RabbitMQ queue depths normal
  ✓ Customer complaints: NONE

Duration: Continuous monitoring for 24 hours
Alert: Any anomalies trigger incident response
```

**Step 6: Rollback Readiness (Keep Green Standby)**
```
Green Environment:
  ✓ Kept running as backup
  ✓ Database kept in sync (via replication)
  ✓ Ready for instant rollback
  ✓ Maintained for 24-48 hours post-deployment

Rollback Trigger:
  - Critical error rate (> 5%)
  - Critical system failure
  - Data corruption detected
  - Security incident
  - Business decision to rollback

Rollback Execution:
  1. Traffic: Blue → Green (1-2 minutes)
  2. Database: Blue → Green (if needed)
  3. Verification: All checks pass
  4. Root cause analysis: Post-incident
```

---

## CUTOVER STRATEGY

*(Details continued in next section - see CUTOVER_PROCEDURES.md)*

---

## ROLLBACK CRITERIA & PROCEDURES

### Automatic Rollback Criteria

**Critical Errors (Immediate Rollback):**
- Application error rate > 10% for > 2 minutes
- Application response time p95 > 5 seconds
- Database connectivity loss > 30 seconds
- RabbitMQ connectivity loss > 30 seconds
- Unhandled exception in critical path (authentication, payment)
- Data corruption detected
- Security breach detected
- Out of memory condition
- CPU usage > 95% sustained

**High Priority Errors (Review + Rollback):**
- Error rate > 5% for > 5 minutes
- Response time p95 > 1 second for > 5 minutes
- Cache hit rate drops > 50%
- Database query performance degraded > 100%
- Memory usage > 85% sustained
- Disk usage > 90%

**Medium Priority (Investigation):**
- Error rate 1-5% for > 10 minutes
- Response time p95 500-1000ms
- Non-critical feature failures
- Warning-level alerts

### Rollback Decision Authority

**Automatic Rollback Authority:**
- On-call monitoring engineer
- Deployment lead
- Incident commander

**Manual Rollback Authority:**
- Product manager (business decision)
- Engineering lead
- CTO/VP Engineering (executive decision)

### Rollback Execution Procedure

**Pre-Rollback Steps:**

```bash
# 1. Verify rollback decision documented
echo "Rollback initiated by: $(whoami) at $(date)" >> deployment.log

# 2. Alert all teams
curl -X POST https://slack.webhook.url \
  -d '{"text": "🚨 ROLLBACK IN PROGRESS - AI Agent Orchestrator v2.1.0"}'

# 3. Start incident timer
echo "Rollback start time: $(date)" > incident_log.txt
```

**Traffic Rollback (Load Balancer):**

```bash
# 1. Update load balancer weights
aws elbv2 modify-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/blue-prod/... \
  --attributes Key=deregistration_delay.timeout_seconds,Value=30

# 2. Shift traffic to green
aws elbv2 modify-rule \
  --rule-arn arn:aws:elasticloadbalancing:... \
  --actions '[{"Type":"forward","TargetGroupArn":"arn:.../green-prod/...","Weight":100},{"Type":"forward","TargetGroupArn":"arn:.../blue-prod/...","Weight":0}]'

# 3. Verify traffic shifted
curl -s http://green-alb/health | jq .version
# Expected: 2.0.5 (previous version)
```

**Application Rollback:**

```bash
# 1. Stop blue application
docker stop app
docker rm app

# 2. Verify green application responsive
curl -s http://green-app:3000/health

# 3. Verify database consistency
psql -h production-db -c "SELECT COUNT(*) FROM users;" | head -1
# Expected: Reasonable number, no massive changes

# 4. Check green application logs
docker logs green-app | tail -50 | grep -i error
# Expected: No new errors
```

**Database Rollback (If Schema Change):**

```bash
# 1. Check if data rollback needed
if [ $MIGRATION_FAILED = true ]; then

  # 2. Restore from pre-migration backup
  pg_restore -d production /backups/pre_2.1.0_backup.dump

  # 3. Verify database state
  psql -h production-db -c "SELECT version FROM schema_versions LIMIT 1;"
  # Expected: Previous version

  # 4. Data integrity check
  psql -h production-db -f /scripts/integrity_checks.sql
fi
```

**Post-Rollback Verification:**

```bash
# 1. Application health check
curl -s http://green-app:3000/health | jq .

# 2. Database health check
psql -h production-db -c "SELECT * FROM pg_stat_replication;"

# 3. API endpoints check
curl -s http://green-app:3000/api/agents | jq .total_count

# 4. Error monitoring
curl -s http://prometheus:9090/api/v1/query?query=rate(http_requests_total%5B1m%5D)

# 5. Final status
echo "Rollback completed at: $(date)"
echo "Application version: $(curl -s http://green-app:3000/health | jq -r .version)"
echo "Database version: $(psql -h production-db -t -c "SELECT version FROM schema_versions LIMIT 1")"
```

---

## POST-DEPLOYMENT VALIDATION

### Immediate Post-Deployment (T+0 to T+30 min)

**Validations:**
- [ ] Application started successfully
- [ ] All health checks passing
- [ ] Error rate < 0.1%
- [ ] Response time within SLA
- [ ] Database replication lag < 100ms
- [ ] RabbitMQ queues processing normally
- [ ] Cache hit rates normal
- [ ] Memory usage stable
- [ ] CPU usage acceptable

**Command:**
```bash
scripts/post-deployment-verify.sh --immediate
```

### Short-Term Validation (T+30 min to T+2 hours)

**Validations:**
- [ ] No error rate spike
- [ ] No memory leaks detected
- [ ] Performance stable
- [ ] Database consistency verified
- [ ] All features working
- [ ] No customer reports
- [ ] Monitoring dashboards stable
- [ ] Log volume normal

**Command:**
```bash
scripts/post-deployment-verify.sh --short-term
```

### Extended Validation (T+2 hours to T+24 hours)

**Validations:**
- [ ] SLA metrics met
- [ ] Data integrity verified
- [ ] No performance degradation
- [ ] Business metrics normal
- [ ] User adoption normal
- [ ] Support ticket volume normal
- [ ] No unidentified issues
- [ ] Green environment deprecated

**Command:**
```bash
scripts/post-deployment-verify.sh --extended
```

---

## EMERGENCY CONTACTS & ESCALATION

### On-Call Team

**Deployment Lead (Decision Maker)**
- Name: _______________________
- Phone: _______________________
- Email: _______________________
- Slack: _______________________

**Engineering Lead (Technical Authority)**
- Name: _______________________
- Phone: _______________________
- Email: _______________________
- Slack: _______________________

**VP Engineering (Executive Authority)**
- Name: _______________________
- Phone: _______________________
- Email: _______________________
- Slack: _______________________

**Database Administrator (DBA)**
- Name: _______________________
- Phone: _______________________
- Email: _______________________
- Slack: _______________________

**Operations Engineer #1**
- Name: _______________________
- Phone: _______________________
- Email: _______________________
- Slack: _______________________

**Operations Engineer #2 (Backup)**
- Name: _______________________
- Phone: _______________________
- Email: _______________________
- Slack: _______________________

**Monitoring Engineer**
- Name: _______________________
- Phone: _______________________
- Email: _______________________
- Slack: _______________________

**Network Engineer**
- Name: _______________________
- Phone: _______________________
- Email: _______________________
- Slack: _______________________

### Escalation Procedure

**Level 1: On-Call Engineer (0-15 minutes)**
- Investigate issue
- Execute standard troubleshooting
- Escalate if unresolved

**Level 2: Engineering Lead (15-30 minutes)**
- Provide technical guidance
- Authorize emergency changes
- Escalate if critical

**Level 3: VP Engineering (30+ minutes)**
- Business decision authority
- Executive communication
- Authorize emergency procedures

**Escalation Trigger:**
- Issue unresolved after 15 minutes
- Critical business impact
- Customer SLA violation imminent
- Security incident
- Data loss risk

---

## SIGN-OFF & APPROVAL

### Pre-Deployment Approvals

**Release Manager Approval:**
- Name: _______________________
- Signature: _______________________
- Date: _______________________
- Time: _______________________

**Technical Lead Approval:**
- Name: _______________________
- Signature: _______________________
- Date: _______________________
- Time: _______________________

**Product Manager Approval:**
- Name: _______________________
- Signature: _______________________
- Date: _______________________
- Time: _______________________

**Security Lead Approval:**
- Name: _______________________
- Signature: _______________________
- Date: _______________________
- Time: _______________________

**Operations Manager Approval:**
- Name: _______________________
- Signature: _______________________
- Date: _______________________
- Time: _______________________

### Go/No-Go Decision

**Go Decision:**
- [ ] All checklist items complete
- [ ] No critical issues identified
- [ ] All approvals obtained
- [ ] Team ready
- [ ] Monitoring prepared
- [ ] Rollback procedures verified

**No-Go Decision:**
- [ ] Issue identified: _______________________
- [ ] Risk mitigation: _______________________
- [ ] Rescheduled date: _______________________
- [ ] Notification: All stakeholders informed

**Final Authority Sign-Off:**

Name: _______________________
Title: _______________________
Signature: _______________________
Date: _______________________
Time: _______________________

**Decision: [  ] GO  [  ] NO-GO**

---

## APPENDIX A: USEFUL COMMANDS

### Monitoring Commands
```bash
# Real-time container monitoring
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check application logs
docker logs -f --tail=100 app

# Verify health
curl -s http://app:3000/health | jq .

# Check database connection
psql -h db -U postgres -d production -c "SELECT 1;"
```

### Rollback Commands
```bash
# Quick rollback script
./scripts/rollback.sh --version=2.0.5 --immediate=true

# Verify rollback
./scripts/verify-deployment.sh --environment=green
```

### Monitoring Dashboard
```bash
# Open monitoring dashboard
open https://grafana.prod.internal/d/deployment

# Check alert status
curl http://prometheus:9090/api/v1/alerts
```

---

## APPENDIX B: DEPLOYMENT CHECKLIST PRINTABLE

[See DEPLOYMENT_CHECKLIST.md for printable format]

---

## APPENDIX C: INCIDENT RESPONSE EXAMPLES

### Incident Example 1: High Error Rate Post-Deployment

**Symptom:** Error rate jumps to 15% at T+5 minutes

**Response:**
1. [T+0] Alert triggered, incident created (CRITICAL)
2. [T+1] Engineering lead notified
3. [T+2] Root cause analysis: New database query slow
4. [T+3] Options evaluated:
   - Fix query (30 min)
   - Rollback immediately (5 min)
5. [T+4] Decision: ROLLBACK (business impact too high)
6. [T+5] Rollback executed
7. [T+10] Service restored, error rate < 0.1%
8. [T+24h] Post-mortem: Index missing on new column

**Learning:** Add new index to pre-deployment checklist

### Incident Example 2: Database Replication Lag

**Symptom:** Replication lag increases to 5 seconds at T+12 minutes

**Response:**
1. [T+0] Alert triggered (HIGH priority)
2. [T+1] DBA notified
3. [T+2] Investigation: New migrations creating lock
4. [T+3] Options evaluated:
   - Increase RAM allocation
   - Optimize query
   - Rollback database changes
5. [T+4] Decision: Increase RAM allocation
6. [T+5] Change deployed
7. [T+7] Lag returns to < 100ms
8. [T+24h] Post-mortem: Need capacity planning for new workload

**Learning:** Capacity test for new database operations

---

**Document prepared by:** _______________________
**Date:** _______________________
**Status:** APPROVED FOR PRODUCTION USE

**Version History:**
- 2.0.0 (2025-10-01): Initial version
- 2.1.0 (2025-11-18): Enhanced with detailed procedures

---

*This is a CONTROLLED DOCUMENT. Keep current copies only. Outdated copies must be destroyed.*
*For updates or corrections, contact: production-team@company.com*
