# OPERATIONAL RUNBOOKS
## AI Agent Orchestrator with RabbitMQ - Production Operations Guide

**Last Updated:** November 18, 2025
**Version:** 1.0.0
**Status:** PRODUCTION READY

---

## TABLE OF CONTENTS

1. [Daily Operations Procedures](#daily-operations-procedures)
2. [Weekly Maintenance Tasks](#weekly-maintenance-tasks)
3. [Monthly Operations](#monthly-operations)
4. [Emergency Procedures](#emergency-procedures)
5. [Common Issues & Solutions](#common-issues--solutions)
6. [Escalation Paths](#escalation-paths)
7. [Backup & Recovery](#backup--recovery)
8. [Performance Optimization](#performance-optimization)
9. [Security Hardening](#security-hardening)
10. [Quick Reference Commands](#quick-reference-commands)

---

## DAILY OPERATIONS PROCEDURES

### Morning Health Check (08:00 AM)

**Duration:** 15-20 minutes
**Frequency:** Daily
**Responsibility:** Operations Team / On-Call Engineer

#### 1. Service Status Verification

```bash
# Check system health
curl http://localhost:3000/health
# Expected response: HTTP 200 with {"status":"operational"}

# Verify all containers running
docker-compose ps
# Expected: All services in "Up" state

# Check RabbitMQ management console
curl -u guest:guest http://localhost:15672/api/overview
# Response should include queue and connection statistics
```

#### 2. Database Connection Pool

```bash
# Check PostgreSQL connections
psql -U orchestrator -d ai_agent_db -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Expected: Total connections < max_connections (default 100)
# Critical threshold: > 80 connections

# Check Redis connections
redis-cli INFO clients | grep connected_clients
# Expected: connected_clients < 1000
```

#### 3. Memory and Disk Usage

```bash
# Check Node.js memory usage
docker stats orchestrator --no-stream | head -2
# Expected: Memory usage < 1.5GB for standard operations

# Check disk space
df -h /var/lib/docker/volumes
# Expected: Free space > 10GB

# Check PostgreSQL data directory
du -sh /var/lib/postgresql/data
# Track growth rate for capacity planning
```

#### 4. Log Review for Overnight Issues

```bash
# Check ERROR and CRITICAL logs from last 24 hours
docker-compose logs orchestrator | grep -E "ERROR|CRITICAL" | tail -50

# Check RabbitMQ logs
docker-compose logs rabbitmq | grep -E "ERROR|WARNING" | tail -30

# Check PostgreSQL logs
docker-compose logs postgres | grep -E "ERROR|FATAL" | tail -30
```

#### 5. Active Agent Verification

```bash
# Query running agents from database
psql -U orchestrator -d ai_agent_db -c "
SELECT agent_id, status, count(*) as task_count
FROM agents
WHERE status='active'
GROUP BY agent_id, status;"

# Expected: All registered agents should be active
# Log any agents not responding
```

#### 6. Queue Depth Analysis

```bash
# Check RabbitMQ queue depths
curl -u guest:guest -s http://localhost:15672/api/queues \
  | jq '.[] | {name: .name, messages: .messages, consumers: .consumers}'

# Acceptable levels:
# - brainstorm_queue: < 100 messages
# - task_distribution_queue: < 500 messages
# - result_queue: < 50 messages
```

#### 7. Dashboard Verification

```
Open Grafana dashboard: http://localhost:3001
Verify all panels loading:
- System CPU: Should be < 60% under normal load
- Memory Usage: Should be < 70%
- Active Agents: Should show all registered agents
- Queue Depths: All within acceptable ranges
- Error Rate: Should be < 0.5%
```

#### 8. Create Morning Report

```bash
# Generate health report
cat > /var/log/operations/morning-check-$(date +%Y%m%d).log << 'EOF'
MORNING HEALTH CHECK - $(date)

Services Status: [OK/DEGRADED/CRITICAL]
- Application: [status]
- RabbitMQ: [status]
- PostgreSQL: [status]
- Redis: [status]

Resource Utilization:
- CPU Usage: [percentage]
- Memory Usage: [percentage]
- Disk Usage: [percentage]

Active Agents: [count]
Queue Depths:
- brainstorm: [count]
- task_distribution: [count]
- result: [count]

Overnight Issues:
[List any errors or issues]

Actions Taken:
[List any corrective actions]

Operator: [name]
Time: [timestamp]
EOF
```

### Hourly Monitoring (Every Hour)

**Duration:** 5-10 minutes
**Frequency:** Hourly (24/7 automated, manual verification 3 times during business hours)

#### Automated Monitoring

```bash
#!/bin/bash
# Save as scripts/hourly-check.sh

# Function to check service health
check_health() {
  local service=$1
  local endpoint=$2
  local response=$(curl -s -o /dev/null -w "%{http_code}" $endpoint)

  if [ "$response" = "200" ]; then
    echo "[OK] $service is healthy"
  else
    echo "[ALERT] $service health check failed: HTTP $response"
    # Trigger alert
  fi
}

# Run checks
check_health "Application" "http://localhost:3000/health"
check_health "RabbitMQ" "http://localhost:15672/api/overview"

# Check queue depths
QUEUE_DEPTH=$(curl -s -u guest:guest http://localhost:15672/api/overview | jq '.queue_totals.messages')
if [ $QUEUE_DEPTH -gt 1000 ]; then
  echo "[WARNING] Queue depth high: $QUEUE_DEPTH messages"
fi

# Check error rate in last hour
ERROR_COUNT=$(docker-compose logs --since 1h orchestrator | grep -c "ERROR")
if [ $ERROR_COUNT -gt 10 ]; then
  echo "[ALERT] High error rate detected: $ERROR_COUNT errors in 1 hour"
fi
```

### Evening Shutdown Check (17:00 PM)

**Duration:** 10 minutes
**Frequency:** Daily (Monday-Friday)
**Responsibility:** Operations Team

#### Pre-Shutdown Verification

```bash
# 1. No active processing tasks
curl -s -u guest:guest http://localhost:15672/api/overview | jq '.queue_totals.messages'
# Should be close to 0 for safe shutdown

# 2. All consumers healthy
docker-compose logs orchestrator | grep -c "consumer_ready" | tail -5

# 3. Recent successful completions
psql -U orchestrator -d ai_agent_db -c "
SELECT count(*) as completed_today
FROM task_results
WHERE DATE(created_at) = CURRENT_DATE
AND status='completed';"

# 4. No pending database transactions
psql -U orchestrator -d ai_agent_db -c "
SELECT pid, query, query_start
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < NOW() - INTERVAL '10 minutes';"

# If there are long-running transactions, investigate before shutdown

# 5. Redis cache flush (optional - based on retention policy)
redis-cli DBSIZE  # Check size before flush
# Only flush if size exceeds expected limits

# 6. Backup verification
ls -lh /backups/daily/
# Ensure today's backup completed successfully
```

#### Graceful Shutdown Procedure

```bash
#!/bin/bash
# Save as scripts/graceful-shutdown.sh

echo "Starting graceful shutdown..."

# Step 1: Stop accepting new work
# Set maintenance flag in application

# Step 2: Allow in-flight tasks to complete (max 5 minutes)
echo "Waiting for in-flight tasks to complete..."
for i in {1..300}; do
  QUEUE_DEPTH=$(curl -s -u guest:guest http://localhost:15672/api/overview | jq '.queue_totals.messages')
  if [ "$QUEUE_DEPTH" = "0" ]; then
    echo "All queues empty, proceeding with shutdown"
    break
  fi
  echo "Queue depth: $QUEUE_DEPTH, waiting... ($((i))/300)"
  sleep 1
done

# Step 3: Flush and close Redis connections
redis-cli SHUTDOWN

# Step 4: Stop RabbitMQ gracefully
docker-compose exec rabbitmq rabbitmqctl stop
sleep 5

# Step 5: Stop application
docker-compose stop orchestrator

# Step 6: Stop remaining services
docker-compose down

echo "Shutdown complete"
```

---

## WEEKLY MAINTENANCE TASKS

### Monday 10:00 AM - Connection Pool Maintenance

**Duration:** 20-30 minutes

```bash
#!/bin/bash
# Weekly pool maintenance

# 1. Analyze connection pool health
echo "=== CONNECTION POOL ANALYSIS ==="

# PostgreSQL
psql -U orchestrator -d ai_agent_db << 'SQL'
-- Check idle connections
SELECT datname, usename, application_name, state, count(*)
FROM pg_stat_activity
GROUP BY datname, usename, application_name, state
ORDER BY count(*) DESC;

-- Check connection time
SELECT datname, usename, backend_start, xact_start
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY xact_start DESC;
SQL

# 2. Restart connection pools to clear stale connections
docker-compose restart orchestrator-pool-manager

# 3. Verify Redis connection health
redis-cli INFO stats | grep -E "total_commands_processed|instantaneous_ops_per_sec"

# 4. Clear expired sessions
psql -U orchestrator -d ai_agent_db -c "
DELETE FROM sessions
WHERE expires_at < NOW();"

# 5. RabbitMQ connection audit
curl -u guest:guest http://localhost:15672/api/connections | jq '.[].name' | wc -l
```

### Tuesday 14:00 PM - Log Rotation and Archival

**Duration:** 15-20 minutes

```bash
#!/bin/bash
# Save as scripts/weekly-log-rotation.sh

# 1. Archive logs from previous week
LOG_DIR="/var/log/orchestrator"
ARCHIVE_DIR="/var/log/orchestrator/archive"
WEEK_AGO=$(date -d "7 days ago" +%Y%m%d)

# Archive logs
tar -czf "$ARCHIVE_DIR/logs-${WEEK_AGO}.tar.gz" \
  --files-from <(find "$LOG_DIR" -maxdepth 1 -type f -name "*.log" -mtime +7)

# Remove original archived logs
find "$LOG_DIR" -maxdepth 1 -type f -name "*.log" -mtime +7 -delete

# 2. Verify log rotation
ls -lh "$LOG_DIR" | head -20

# 3. Check disk space after archival
du -sh "$LOG_DIR"
du -sh "$ARCHIVE_DIR"

# 4. Generate weekly log summary
docker-compose logs --since "7 days ago" orchestrator | grep -E "ERROR|CRITICAL" | wc -l > /tmp/weekly-errors.txt
```

### Wednesday 09:00 AM - Database Maintenance

**Duration:** 30-45 minutes

```bash
#!/bin/bash
# Save as scripts/weekly-db-maintenance.sh

# 1. VACUUM and ANALYZE (during low-traffic window)
echo "Starting database maintenance..."

psql -U orchestrator -d ai_agent_db << 'SQL'
-- Run VACUUM to reclaim space
VACUUM ANALYZE;

-- Check table sizes
SELECT schemaname, tablename,
       ROUND(pg_total_relation_size(schemaname||'.'||tablename) / 1024 / 1024) AS size_mb
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check for unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
SQL

# 2. Update table statistics
psql -U orchestrator -d ai_agent_db -c "ANALYZE;"

# 3. Check for autovacuum performance
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT schemaname, relname,
       last_vacuum, last_autovacuum,
       last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY last_autovacuum DESC;
SQL

# 4. Generate size report
echo "=== DATABASE SIZE REPORT ===" > /tmp/db-size-report.txt
psql -U orchestrator -d ai_agent_db -c "SELECT
  pg_database.datname,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database;" >> /tmp/db-size-report.txt

cat /tmp/db-size-report.txt
```

### Thursday 11:00 AM - Cache Validation and Optimization

**Duration:** 20-25 minutes

```bash
#!/bin/bash
# Save as scripts/weekly-cache-optimization.sh

# 1. Analyze cache hit rates
echo "=== CACHE PERFORMANCE ANALYSIS ==="
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Calculate hit rate
HITS=$(redis-cli INFO stats | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
MISSES=$(redis-cli INFO stats | grep keyspace_misses | cut -d: -f2 | tr -d '\r')
if [ $((HITS + MISSES)) -gt 0 ]; then
  HIT_RATE=$(echo "scale=2; $HITS * 100 / ($HITS + $MISSES)" | bc)
  echo "Cache hit rate: $HIT_RATE%"
fi

# 2. Check memory fragmentation
redis-cli INFO memory | grep -E "used_memory|used_memory_rss|mem_fragmentation_ratio"

# 3. Identify large keys
redis-cli --bigkeys

# 4. Check key expiration effectiveness
echo "=== KEY EXPIRATION CHECK ==="
redis-cli INFO keyspace | grep -E "keys|expires"

# 5. Analyze cache eviction policy
EVICTION_POLICY=$(redis-cli CONFIG GET maxmemory-policy | tail -1)
echo "Current eviction policy: $EVICTION_POLICY"

# If fragmentation > 1.5, recommend restart
FRAG=$(redis-cli INFO memory | grep mem_fragmentation_ratio | cut -d: -f2)
echo "Memory fragmentation ratio: $FRAG"

# 6. Clear expired keys proactively
redis-cli EVAL "
local cursor = 0
repeat
  local result = redis.call('SCAN', cursor, 'TYPE', 'string')
  cursor = tonumber(result[1])
  for _, key in ipairs(result[2]) do
    local ttl = redis.call('TTL', key)
    if ttl == -1 then
      redis.call('EXPIRE', key, 86400)  -- Set 24h default TTL
    end
  end
until cursor == 0
" 0
```

### Friday 15:00 PM - Weekly Security Audit

**Duration:** 25-35 minutes

```bash
#!/bin/bash
# Save as scripts/weekly-security-audit.sh

echo "=== WEEKLY SECURITY AUDIT ==="

# 1. Check authentication logs
docker-compose logs orchestrator | grep -E "auth_failed|unauthorized" | tail -20

# 2. Verify TLS certificates
openssl s_client -connect localhost:3000 -tls1_2 2>/dev/null | grep -E "Issuer|Validity|Subject"

# 3. Check for exposed secrets in logs
docker-compose logs orchestrator | grep -E "password|secret|token|key" | grep -v "INFO" | head -10

# 4. Verify password policies
psql -U orchestrator -d ai_agent_db -c "
SELECT username, created_at, last_login
FROM users
WHERE password_changed_at < NOW() - INTERVAL '90 days';"

# 5. Check database user privileges
psql -U orchestrator -d ai_agent_db -c "
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_catalog = 'ai_agent_db';"

# 6. Verify RabbitMQ user permissions
curl -u guest:guest http://localhost:15672/api/users | jq '.[] | {name: .name, tags: .tags}'

# 7. Check firewall rules
echo "=== FIREWALL RULES ==="
iptables -L -n | grep -E "ALLOW|DENY|ACCEPT|DROP"

# 8. Generate security report
echo "Security audit completed at $(date)" > /var/log/security-audit-$(date +%Y%m%d).log
```

---

## MONTHLY OPERATIONS

### First Monday - Full System Audit

**Duration:** 2-3 hours

```bash
#!/bin/bash
# Save as scripts/monthly-full-audit.sh

# 1. Capacity Planning Review
echo "=== CAPACITY ANALYSIS ==="

# Disk usage growth
du -sh /var/lib/docker/volumes/
df -h /

# Database size growth (compare with previous month)
psql -U orchestrator -d ai_agent_db -c "
SELECT
  pg_database.datname,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size,
  (SELECT sum(heap_blks_read) FROM pg_statio_user_tables) as disk_reads
FROM pg_database
WHERE datname = 'ai_agent_db';"

# 2. Performance Metrics Review
echo "=== PERFORMANCE REVIEW ==="

# Average task completion time (last 30 days)
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT
  DATE_TRUNC('day', created_at) as day,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds,
  COUNT(*) as task_count
FROM task_results
WHERE created_at > NOW() - INTERVAL '30 days'
  AND status = 'completed'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
SQL

# 3. Error Rate Analysis
echo "=== ERROR ANALYSIS ==="
ERROR_LOGS=$(docker-compose logs --since 30 days orchestrator | grep -c "ERROR")
WARN_LOGS=$(docker-compose logs --since 30 days orchestrator | grep -c "WARNING")
echo "Errors in last 30 days: $ERROR_LOGS"
echo "Warnings in last 30 days: $WARN_LOGS"

# 4. Agent Performance Review
echo "=== AGENT PERFORMANCE ==="
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT
  agent_id,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN status='completed' THEN 1 END) as successful_tasks,
  COUNT(CASE WHEN status='failed' THEN 1 END) as failed_tasks,
  ROUND(100.0 * COUNT(CASE WHEN status='completed' THEN 1 END) / COUNT(*), 2) as success_rate
FROM task_results
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_id
ORDER BY total_tasks DESC;
SQL

# 5. Resource Utilization Trends
echo "=== RESOURCE TRENDS ==="
# This data should come from Prometheus/monitoring system
curl -s 'http://localhost:9090/api/v1/query_range?query=avg(node_memory_MemAvailable_bytes)&start=NOW-30d&step=1d' \
  | jq '.data.result'

# 6. Configuration Review
echo "=== CONFIGURATION AUDIT ==="
# Check if all required environment variables are set
grep -E "^[A-Z_]+=" /var/env/orchestrator.env | wc -l

# 7. Dependency Updates Check
echo "=== DEPENDENCY STATUS ==="
npm outdated

# 8. Disaster Recovery Drill (Quarterly - skip if not month)
if [ $(date +%m) = "01" ]; then
  echo "Performing quarterly DR drill..."
  bash scripts/disaster-recovery-test.sh
fi
```

### Second Wednesday - Performance Tuning Review

**Duration:** 1.5-2 hours

```bash
#!/bin/bash
# Save as scripts/monthly-performance-tuning.sh

echo "=== PERFORMANCE TUNING REVIEW ==="

# 1. Analyze slow queries
psql -U orchestrator -d ai_agent_db << 'SQL'
-- Enable logging of slow queries
ALTER DATABASE ai_agent_db SET log_min_duration_statement = 1000; -- 1 second

-- View slow query statistics
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
SQL

# 2. Index usage analysis
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
SQL

# 3. RabbitMQ performance metrics
echo "=== RABBITMQ METRICS ==="
curl -u guest:guest -s http://localhost:15672/api/connections | jq 'length'
curl -u guest:guest -s http://localhost:15672/api/channels | jq 'length'

# 4. Message acknowledgement analysis
curl -u guest:guest -s http://localhost:15672/api/queues | jq '.[] | {name, messages_ready, messages_unacked}'

# 5. Connection pool efficiency
# Check for connection leaks
ACTIVE_CONNECTIONS=$(curl -u guest:guest -s http://localhost:15672/api/overview | jq '.object_totals.connections')
echo "Active RabbitMQ connections: $ACTIVE_CONNECTIONS"

# 6. Memory optimization review
echo "=== MEMORY ANALYSIS ==="
docker stats --no-stream | grep orchestrator

# If Node.js process memory > 1.5GB, recommend analysis
NODE_MEMORY=$(docker stats --no-stream | grep orchestrator | awk '{print $4}')
echo "Node.js memory: $NODE_MEMORY"

# 7. Response time analysis (last 30 days)
curl -s 'http://localhost:9090/api/v1/query?query=avg(rate(http_request_duration_seconds_sum[30d]))' \
  | jq '.data.result'

# 8. Generate tuning recommendations
cat > /tmp/tuning-recommendations.txt << 'EOF'
PERFORMANCE TUNING RECOMMENDATIONS
Generated: $(date)

1. Query Optimization:
   - Review slow queries identified above
   - Consider adding composite indexes for high-frequency queries

2. Connection Pool Tuning:
   - Current pool size: [number]
   - Recommended size: [number]

3. Memory Optimization:
   - Current peak memory: [value]
   - Recommended heap size: [value]

4. Cache Effectiveness:
   - Current hit rate: [percentage]
   - Target: 90%+

5. Message Queue Performance:
   - Average queue depth: [number]
   - Peak queue depth: [number]
   - Recommendation: [action]
EOF
cat /tmp/tuning-recommendations.txt
```

### Third Friday - Backup Verification & DR Planning

**Duration:** 2-2.5 hours

```bash
#!/bin/bash
# Save as scripts/monthly-backup-verification.sh

echo "=== MONTHLY BACKUP VERIFICATION ==="

# 1. Verify all daily backups exist
echo "Checking daily backups..."
ls -lh /backups/daily/ | tail -35  # Show last 30 days + header

# 2. Test backup restoration (on staging)
echo "Testing backup restoration..."
LATEST_BACKUP=$(ls -t /backups/daily/*.tar.gz | head -1)
echo "Testing restoration of: $LATEST_BACKUP"

# Create temporary database for test
createdb -U orchestrator ai_agent_db_restore_test

# Restore backup
tar -xzf $LATEST_BACKUP -C /tmp/
pg_restore -d ai_agent_db_restore_test /tmp/ai_agent_db_backup.sql

# Run quick validation
psql -U orchestrator -d ai_agent_db_restore_test << 'SQL'
SELECT count(*) FROM agents;
SELECT count(*) FROM task_results;
SELECT count(*) FROM users;
SQL

# Clean up test database
dropdb -U orchestrator ai_agent_db_restore_test

# 3. Verify backup storage
echo "=== BACKUP STORAGE VERIFICATION ==="
du -sh /backups/
df -h /backups/

# Alert if backup storage > 80% full
USAGE=$(df /backups/ | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $USAGE -gt 80 ]; then
  echo "WARNING: Backup storage $USAGE% full"
fi

# 4. Test incremental backup process
echo "Testing incremental backup..."
bash scripts/incremental-backup.sh --test

# 5. RabbitMQ backup verification
echo "Verifying RabbitMQ definitions backup..."
curl -u guest:guest http://localhost:15672/api/definitions > /tmp/rabbitmq-definitions-$(date +%Y%m%d).json

# 6. Redis persistence check
redis-cli LASTSAVE
redis-cli BGSAVE
sleep 5

# 7. Generate backup status report
cat > /var/log/backup-verification-$(date +%Y%m%d).log << EOF
BACKUP VERIFICATION REPORT
Date: $(date)

Daily Backups: $(ls /backups/daily/*.tar.gz | wc -l)
Latest Backup: $(ls -lh /backups/daily/*.tar.gz | tail -1 | awk '{print $9, $5}')
Backup Storage Usage: $USAGE%

Restoration Test: PASSED
RabbitMQ Backup: $(ls -lh /tmp/rabbitmq-definitions-*.json | tail -1)
Redis Persistence: $(redis-cli LASTSAVE)

Recommendations:
- Continue current backup schedule
- Monitor storage usage
- Schedule off-site backup replication
EOF
cat /var/log/backup-verification-$(date +%Y%m%d).log
```

### Fourth Monday - Disaster Recovery Review

**Duration:** 1.5-2 hours (Quarterly Deep Dive - Monthly Review)

```bash
#!/bin/bash
# Save as scripts/monthly-dr-review.sh

echo "=== DISASTER RECOVERY READINESS REVIEW ==="

# 1. Review DR Plan Documentation
echo "Checking DR documentation..."
ls -lh /docs/disaster-recovery/
grep -l "last_updated" /docs/disaster-recovery/*.md

# 2. Validate RTO/RPO targets
echo "=== RTO/RPO ANALYSIS ==="
cat > /tmp/rto-rpo-report.txt << 'EOF'
Recovery Target Objectives:
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 hour

Recent Performance:
- Last backup: $(redis-cli LASTSAVE)
- Backup size: $(du -sh /backups/latest | awk '{print $1}')
- Estimated recovery time: [calculated based on backup size]
EOF

# 3. Verify alternate site readiness
echo "Checking standby infrastructure..."
# If using multi-region setup
# kubectl get nodes --context=dr-cluster

# 4. Review incident logs for lessons learned
echo "Analyzing recent incidents..."
tail -100 /var/log/incidents/incident-log.txt | grep -E "resolved_time|impact|root_cause"

# 5. Capacity for disaster recovery
echo "=== DISASTER RECOVERY CAPACITY CHECK ==="
BACKUP_SIZE=$(du -sh /backups/latest | awk '{print $1}')
DISK_AVAILABLE=$(df /backups/ | awk 'NR==2 {print $4}')
echo "Backup size: $BACKUP_SIZE"
echo "Storage available: $DISK_AVAILABLE"

# 6. Document recovery procedures are current
echo "Verifying recovery procedures..."
for script in scripts/*recovery*.sh; do
  if [ -f "$script" ]; then
    echo "Found: $script"
    head -5 "$script" | grep "Last tested:"
  fi
done

# 7. Team DR drill readiness
echo "=== DR DRILL SCHEDULE ==="
echo "Next scheduled DR drill: $(grep "next_dr_drill" /etc/orchestrator/config.yml)"
```

---

## EMERGENCY PROCEDURES

### Critical Alert Response (P1 - CRITICAL)

**Activation Criteria:**
- Application service down
- All agents unresponsive
- Database unavailable
- Complete data loss

**Initial Response (First 5 Minutes):**

```bash
#!/bin/bash
# Save as scripts/emergency-response-p1.sh

echo "=== P1 CRITICAL EMERGENCY RESPONSE ==="
echo "Time: $(date)" >> /var/log/emergency.log

# 1. IMMEDIATE NOTIFICATION
# Send alerts to entire on-call chain
# PagerDuty, Slack, SMS notifications

# 2. Gather diagnostics
echo "=== SYSTEM STATUS ===" | tee -a /var/log/emergency.log

# Get immediate health status
curl -s -m 5 http://localhost:3000/health 2>&1 | tee -a /var/log/emergency.log
echo "HTTP Status: $?" | tee -a /var/log/emergency.log

# Docker status
docker-compose ps 2>&1 | tee -a /var/log/emergency.log

# 3. Attempt automatic recovery
echo "Attempting automatic recovery..." | tee -a /var/log/emergency.log

# Restart application container
docker-compose restart orchestrator 2>&1 | tee -a /var/log/emergency.log

# Wait for recovery
sleep 30
curl -s -m 5 http://localhost:3000/health 2>&1 | tee -a /var/log/emergency.log

# 4. If recovery fails, escalate
if [ $? -ne 0 ]; then
  echo "CRITICAL: Application recovery failed" | tee -a /var/log/emergency.log
  # Escalate to Level 2 support
  bash scripts/escalation-level2.sh
fi

# 5. Preserve logs and state
docker-compose logs > /var/log/emergency-docker-logs-$(date +%s).log
mkdir -p /var/log/emergency-dumps
docker-compose exec postgres pg_dump orchestrator > /var/log/emergency-dumps/db-dump-$(date +%s).sql
```

### High Error Rate Response (P2 - URGENT)

**Activation Criteria:**
- Error rate > 5% (15+ errors/minute)
- More than 20% of messages failing
- Database query errors > 10%

**Response Timeline:**

```bash
#!/bin/bash
# Save as scripts/emergency-response-p2.sh

echo "=== P2 URGENT ERROR RATE RESPONSE ==="

# 1. ALERT notification (first 1 minute)
# Notify on-call engineer and team lead

# 2. Investigate root cause (minutes 1-10)
echo "=== ROOT CAUSE INVESTIGATION ==="

# Check recent error spike
docker-compose logs --since 10m orchestrator | grep -E "ERROR|EXCEPTION" | head -50 | tee /tmp/errors.log

# Check specific error types
echo "Error distribution:"
docker-compose logs --since 10m orchestrator | grep "ERROR" | cut -d' ' -f7-8 | sort | uniq -c | sort -rn | head -10

# 3. Identify affected services
echo "=== SERVICE STATUS ==="
curl -s -u guest:guest http://localhost:15672/api/queues | jq '.[] | {name: .name, messages: .messages, consumers: .consumers}' | grep -A2 messages

# 4. Implement temporary mitigation
echo "=== MITIGATION STEPS ==="

# Option A: Reduce traffic
# Enable rate limiting
curl -X POST http://localhost:3000/admin/rate-limit \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true, "limit": 10}'

# Option B: Restart failing service
SERVICE=$(cat /tmp/errors.log | grep "service=" | cut -d= -f2 | head -1)
docker-compose restart $SERVICE

# Option C: Enable circuit breaker
curl -X POST http://localhost:3000/admin/circuit-breaker \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true}'

# 5. Monitor recovery
echo "Monitoring error rate..."
for i in {1..30}; do
  ERROR_COUNT=$(docker-compose logs --since 1m orchestrator | grep -c "ERROR")
  echo "$i: Errors in last minute: $ERROR_COUNT"
  if [ $ERROR_COUNT -lt 5 ]; then
    echo "Error rate recovered"
    break
  fi
  sleep 10
done

# 6. Investigate and document
# Collect full diagnostics for post-incident review
bash scripts/collect-diagnostics.sh
```

### Database Connection Pool Exhaustion (P2)

**Activation Criteria:**
- Active connections > 80% of max
- New connections being rejected
- Application receiving "connection pool exhausted" errors

**Response Procedure:**

```bash
#!/bin/bash
# Save as scripts/emergency-db-pool-exhaustion.sh

echo "=== DATABASE POOL EXHAUSTION RESPONSE ==="

# 1. Verify the issue
echo "=== CONNECTION ANALYSIS ==="
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT
  count(*) as total_connections,
  sum(CASE WHEN state = 'active' THEN 1 ELSE 0 END) as active,
  sum(CASE WHEN state = 'idle' THEN 1 ELSE 0 END) as idle,
  sum(CASE WHEN state = 'idle in transaction' THEN 1 ELSE 0 END) as idle_in_transaction
FROM pg_stat_activity;

-- Find long-running transactions
SELECT pid, usename, application_name, state, query_start, query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 minutes'
ORDER BY query_start;
SQL

# 2. Kill idle connections
echo "Killing idle connections..."
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '30 minutes'
  AND datname = 'ai_agent_db';
SQL

# 3. Kill idle-in-transaction connections (if safe)
echo "Killing idle-in-transaction connections..."
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND query_start < NOW() - INTERVAL '10 minutes';
SQL

# 4. Restart application connection pool
echo "Restarting application connection pool..."
docker-compose exec orchestrator curl -X POST http://localhost:3000/admin/pool-reset \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Monitor recovery
echo "Monitoring connection count..."
for i in {1..20}; do
  ACTIVE=$(psql -U orchestrator -d ai_agent_db -t -c "
    SELECT count(*) FROM pg_stat_activity WHERE datname = 'ai_agent_db'")
  echo "$i: Active connections: $ACTIVE"
  if [ $ACTIVE -lt 50 ]; then
    echo "Connection pool recovered"
    break
  fi
  sleep 10
done

# 6. Increase max connections if needed
MAX_CONN=$(psql -U orchestrator -d postgres -t -c "SHOW max_connections")
echo "Current max_connections: $MAX_CONN"
if [ $ACTIVE -gt $((MAX_CONN * 80 / 100)) ]; then
  echo "Consider increasing max_connections"
  echo "ALTER SYSTEM SET max_connections = $((MAX_CONN + 50));" | \
    psql -U orchestrator -d postgres
  docker-compose restart postgres
fi
```

### Memory Leak Detection & Mitigation

**Activation Criteria:**
- Memory usage increasing 5%+ per hour
- Application process memory > 2GB
- Garbage collection pauses increasing

**Response Procedure:**

```bash
#!/bin/bash
# Save as scripts/emergency-memory-leak.sh

echo "=== MEMORY LEAK DETECTION & MITIGATION ==="

# 1. Verify memory growth
echo "=== MEMORY ANALYSIS ==="
docker stats --no-stream orchestrator

# Get memory history from monitoring
curl -s 'http://localhost:9090/api/v1/query_range?query=container_memory_usage_bytes{name="orchestrator"}&start='$(date -u -d '2 hours ago' +%s)'&step=5m' \
  | jq '.data.result[0].values' | tail -10

# 2. Identify which component is leaking
echo "=== HEAP DUMP ==="
# Get heap snapshot
curl -X GET http://localhost:3000/admin/heap-dump \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o /tmp/heap-dump-$(date +%s).heapsnapshot

# 3. Analyze heap dump
# Use Node.js built-in analysis
node --eval "
const fs = require('fs');
const heapDump = JSON.parse(fs.readFileSync('/tmp/heap-dump-*.heapsnapshot', 'utf8'));
console.log('Heap size:', heapDump.snapshot.meta.total_size);
"

# 4. Check for common memory leak patterns
docker-compose logs orchestrator | grep -E "retained|reference|subscription" | tail -20

# 5. Implement temporary mitigation
echo "=== MITIGATION ==="

# Option A: Reduce cache TTL
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Option B: Restart application (if necessary)
echo "Scheduling graceful restart..."
curl -X POST http://localhost:3000/admin/graceful-restart \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"drain_timeout": 300}'

# Wait for restart
sleep 60
docker-compose restart orchestrator
sleep 30

# 6. Verify memory is recovered
echo "Post-restart memory check..."
docker stats --no-stream orchestrator | head -1
```

### RabbitMQ Queue Backup (P2 - URGENT)

**Activation Criteria:**
- Queue depth > 10,000 messages
- Queue memory > 500MB
- Message processing rate < input rate

**Response Procedure:**

```bash
#!/bin/bash
# Save as scripts/emergency-queue-backup.sh

echo "=== RABBITMQ QUEUE BACKUP RESPONSE ==="

# 1. Assess queue situation
echo "=== QUEUE STATUS ==="
curl -u guest:guest -s http://localhost:15672/api/overview | jq '{
  queue_totals: .queue_totals,
  object_totals: .object_totals
}'

# Identify problematic queues
curl -u guest:guest -s http://localhost:15672/api/queues | jq '.[] | select(.messages > 1000) | {name, messages, consumers}' | tee /tmp/backed-up-queues.json

# 2. Backup queue definitions
echo "Backing up queue configuration..."
curl -u guest:guest http://localhost:15672/api/definitions > /tmp/rabbitmq-definitions-backup-$(date +%s).json

# 3. Identify and scale consumers
echo "=== CONSUMER ANALYSIS ==="
curl -u guest:guest -s http://localhost:15672/api/queues | jq '.[] | select(.messages > 1000) | {name, messages, consumers, message_bytes}' > /tmp/queue-analysis.json

# Scale up consumers for backed-up queues
for queue in $(jq -r '.[].name' /tmp/queue-analysis.json); do
  CONSUMER_COUNT=$(curl -u guest:guest -s http://localhost:15672/api/queues | jq ".[] | select(.name == \"$queue\") | .consumers")
  echo "Queue: $queue, current consumers: $CONSUMER_COUNT"

  # Scale up (e.g., from 2 to 4 consumers)
  NEW_CONSUMER_COUNT=$((CONSUMER_COUNT * 2))
  docker-compose up -d --scale consumer-$queue=$NEW_CONSUMER_COUNT
done

# 4. Enable priority processing for backed-up queues
echo "Enabling priority processing..."
for queue in $(jq -r '.[].name' /tmp/queue-analysis.json | head -5); do
  curl -u guest:guest -X PUT http://localhost:15672/api/queues/%2f/$queue \
    -H 'content-type: application/json' \
    -d '{"arguments": {"x-max-priority": 10}}'
done

# 5. Monitor queue depth reduction
echo "Monitoring queue drain..."
for i in {1..60}; do
  TOTAL_MESSAGES=$(curl -u guest:guest -s http://localhost:15672/api/overview | jq '.queue_totals.messages')
  echo "$i: Total queue messages: $TOTAL_MESSAGES"
  if [ $TOTAL_MESSAGES -lt 1000 ]; then
    echo "Queue backup resolved"
    break
  fi
  sleep 10
done

# 6. Rebalance consumers back to normal
echo "Rebalancing consumers..."
docker-compose up -d --scale consumer-task-distribution=3

# 7. Review and optimize
echo "Recommendation: Analyze processing bottlenecks"
```

### Cache Invalidation Issues (P3)

**Activation Criteria:**
- Stale cache data being served
- Cache hit rate drops > 20%
- Users report inconsistent data

**Response Procedure:**

```bash
#!/bin/bash
# Save as scripts/emergency-cache-invalidation.sh

echo "=== CACHE INVALIDATION ISSUES RESPONSE ==="

# 1. Analyze cache state
echo "=== CACHE ANALYSIS ==="
redis-cli INFO stats | grep -E "keyspace_hits|keyspace_misses"

# List all keys
redis-cli KEYS "*" | head -20

# 2. Identify stale keys
echo "Finding potentially stale keys..."
redis-cli EVAL "
local cursor = 0
local stale_count = 0
repeat
  local result = redis.call('SCAN', cursor, 'COUNT', 100)
  cursor = tonumber(result[1])
  for _, key in ipairs(result[2]) do
    local ttl = redis.call('TTL', key)
    if ttl == -1 then
      stale_count = stale_count + 1
      redis.call('EXPIRE', key, 3600)  -- Set 1 hour TTL
    end
  end
until cursor == 0
return stale_count
" 0

# 3. Selective invalidation (by pattern)
echo "Invalidating specific cache patterns..."

# Invalidate user cache
redis-cli EVAL "
local keys = redis.call('KEYS', 'user:*')
for i, key in ipairs(keys) do
  redis.call('DEL', key)
end
return #keys
" 0

# 4. Rebuild cache from database
echo "Rebuilding cache from primary data..."
curl -X POST http://localhost:3000/admin/cache-rebuild \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"patterns": ["user:*", "agent:*"]}'

# 5. Verify cache correctness
echo "Verifying cache..."
SAMPLE_KEY=$(redis-cli KEYS "*" | head -1)
CACHE_VALUE=$(redis-cli GET $SAMPLE_KEY)
# Compare with database value
DB_VALUE=$(psql -U orchestrator -d ai_agent_db -t -c "SELECT value FROM cache WHERE key='$SAMPLE_KEY'")

if [ "$CACHE_VALUE" != "$DB_VALUE" ]; then
  echo "WARNING: Cache/DB mismatch detected"
  echo "Flushing entire cache..."
  redis-cli FLUSHDB
fi

# 6. Monitor cache recovery
echo "Monitoring cache hit rate..."
for i in {1..15}; do
  HITS=$(redis-cli INFO stats | grep keyspace_hits | cut -d: -f2 | tr -d '\r')
  MISSES=$(redis-cli INFO stats | grep keyspace_misses | cut -d: -f2 | tr -d '\r')
  HIT_RATE=$(echo "scale=2; $HITS * 100 / ($HITS + $MISSES)" | bc)
  echo "$i: Cache hit rate: $HIT_RATE%"
  sleep 5
done
```

---

## COMMON ISSUES & SOLUTIONS

### Issue 1: Agent Not Responding

**Symptoms:**
- Agent status shows "inactive" in dashboard
- Tasks assigned to agent not being processed
- Agent heartbeat missing

**Resolution Steps:**

```bash
# 1. Verify agent connection
curl -s http://localhost:3000/agents/{agent_id}/status

# 2. Check RabbitMQ queue for agent
curl -u guest:guest -s http://localhost:15672/api/queues/%2f/agent_{agent_id}_tasks | jq '.messages'

# 3. View agent logs
docker-compose logs orchestrator | grep "agent_$agent_id" | tail -20

# 4. Restart agent
# If agent is microservice:
docker-compose restart agent-{agent_id}

# If agent is process:
# Kill and restart the process
pkill -f "agent.*{agent_id}"
npm run start:agent -- --id {agent_id}

# 5. Verify recovery
sleep 5
curl -s http://localhost:3000/agents/{agent_id}/status

# If still not responding:
# 6. Force re-registration
curl -X POST http://localhost:3000/admin/agents/{agent_id}/register \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"force": true}'
```

### Issue 2: High Latency

**Symptoms:**
- Task completion time increased 2-3x
- Users report slow response times
- API response time > 2 seconds

**Root Cause Analysis:**

```bash
# 1. Check database query time
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
SQL

# 2. Check RabbitMQ message latency
curl -u guest:guest -s http://localhost:15672/api/queues | jq '.[] | {name: .name, messages: .messages, consumers: .consumers}'

# 3. Check network latency
ping -c 5 postgres
ping -c 5 rabbitmq
ping -c 5 redis

# 4. Check node.js event loop lag
curl -X GET http://localhost:3000/admin/metrics/event-loop | jq '.event_loop_lag'

# 5. Identify slow endpoints
curl -s 'http://localhost:9090/api/v1/query?query=topk(5,http_request_duration_seconds_sum)' | jq '.data.result'
```

**Resolution:**

```bash
# If database is slow:
# 1. Increase work_mem for large queries
ALTER USER orchestrator SET work_mem = '256MB';

# 2. Add missing indexes
CREATE INDEX idx_task_results_status ON task_results(status) WHERE status != 'completed';

# If RabbitMQ is slow:
# 1. Increase network buffer size
rabbitmqctl set_vm_memory_high_watermark 0.7

# If network is slow:
# 1. Enable compression
# 2. Increase network buffers
# 3. Consider moving services to same host/network
```

### Issue 3: Disk Space Running Out

**Symptoms:**
- Disk usage > 90%
- Application unable to write logs
- Database cannot create new pages

**Emergency Cleanup:**

```bash
#!/bin/bash
# Save as scripts/emergency-disk-cleanup.sh

echo "=== EMERGENCY DISK CLEANUP ==="

# 1. Identify large files
du -sh /* | sort -rh | head -20

# 2. Identify large directories
du -sh /var/log/* | sort -rh

# 3. Compress old logs
find /var/log -name "*.log" -mtime +7 -exec gzip {} \;

# 4. Delete very old logs
find /var/log -name "*.log.gz" -mtime +30 -delete

# 5. Clean Docker artifacts
docker system prune -a --volumes

# 6. Clean up PostgreSQL VACUUM
psql -U orchestrator -d ai_agent_db << 'SQL'
VACUUM FULL;
EOF
```

```bash

# 7. Verify free space
df -h /

# If still critical:
# 8. Increase volume size (cloud/VM specific)
```

### Issue 4: Message Duplication

**Symptoms:**
- Same task processed multiple times
- Duplicate entries in database
- Users see duplicate results

**Resolution:**

```bash
#!/bin/bash

# 1. Verify issue
curl -s -u guest:guest http://localhost:15672/api/overview | jq '.{"queue_totals": .queue_totals}'

# 2. Enable idempotency keys
curl -X PUT http://localhost:3000/admin/idempotency \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"enabled": true, "ttl": 3600}'

# 3. Check for duplicate processing
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT task_id, count(*) as occurrence_count
FROM task_results
GROUP BY task_id
HAVING count(*) > 1
LIMIT 20;
SQL

# 4. Clean up duplicates
psql -U orchestrator -d ai_agent_db << 'SQL'
DELETE FROM task_results
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM task_results
  GROUP BY task_id, agent_id
);
SQL

# 5. Enable deduplication in application
# Update configuration
cat >> .env << 'EOF'
ENABLE_DEDUPLICATION=true
DEDUPLICATION_TTL=3600
EOF

# 6. Restart services
docker-compose restart orchestrator
```

---

## ESCALATION PATHS

### Escalation Matrix

```
SEVERITY │ DETECTION TIME │ RESPONSE TIME │ POINT OF CONTACT
─────────┼────────────────┼───────────────┼─────────────────────
P1       │ Immediate      │ 5 minutes     │ VP Engineering
CRITICAL │ < 1 minute     │ (On-call SMS) │ Team Lead (alert)
         │                │               │ On-call Engineer
         │                │               │ VP Eng (notify)
─────────┼────────────────┼───────────────┼─────────────────────
P2       │ 5 minutes      │ 15 minutes    │ Team Lead
URGENT   │                │ (Slack alert) │ On-call Engineer
         │                │               │ Engineering Manager
─────────┼────────────────┼───────────────┼───────────────────────
P3       │ 1 hour         │ 1 hour        │ On-call Engineer
HIGH     │                │               │ Team Lead
         │                │               │ Engineering Manager
─────────┼────────────────┼───────────────┼───────────────────────
P4       │ 24 hours       │ 4 hours       │ Team / Ticket System
MEDIUM   │                │               │
```

### Level 1 → Level 2 Escalation

**When to Escalate:**
- Issue not resolved within 20 minutes of detection
- Requires component restart that affects users
- Root cause unknown after initial investigation

**Process:**

```bash
#!/bin/bash
# Save as scripts/escalation-level2.sh

# 1. Document current state
INCIDENT_ID=$(uuidgen)
mkdir -p /var/log/incidents/$INCIDENT_ID

# Collect all diagnostics
docker-compose logs > /var/log/incidents/$INCIDENT_ID/docker-logs.txt
docker stats --no-stream > /var/log/incidents/$INCIDENT_ID/docker-stats.txt
curl -u guest:guest http://localhost:15672/api/overview > /var/log/incidents/$INCIDENT_ID/rabbitmq-status.json
psql -U orchestrator -d ai_agent_db -c "SELECT * FROM error_log ORDER BY created_at DESC LIMIT 100;" > /var/log/incidents/$INCIDENT_ID/db-errors.txt

# 2. Send escalation notice
curl -X POST https://slack.com/api/chat.postMessage \
  -H 'Content-type: application/json' \
  -d '{
    "channel": "#incidents",
    "text": "ESCALATION: Issue '$(echo $INCIDENT_ID | cut -c1-8)' escalated to Level 2",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Issue Escalated to Level 2*\nIncident ID: '$(echo $INCIDENT_ID | cut -c1-8)'\nTime: '$(date)'\nInitial findings: [summary]"
        }
      }
    ]
  }' \
  -H "Authorization: Bearer $SLACK_TOKEN"

# 3. Page Level 2 on-call
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-type: application/json' \
  -d '{
    "routing_key": "'$PAGERDUTY_ESCALATION_KEY'",
    "event_action": "trigger",
    "payload": {
      "summary": "Issue escalation to Level 2: '$(echo $INCIDENT_ID | cut -c1-8)'",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "severity": "critical",
      "source": "Orchestrator Operations"
    }
  }'

# 4. Prepare handoff documentation
cat > /var/log/incidents/$INCIDENT_ID/handoff.md << EOF
# Incident Handoff - Level 1 to Level 2

**Incident ID:** $INCIDENT_ID
**Detection Time:** $(date)
**Escalation Time:** $(date)
**Escalated By:** $USER

## Symptoms
- [List symptoms]

## Initial Investigation
- [Findings]
- [Actions taken]
- [Incomplete areas]

## Diagnostics Collected
- Docker logs
- RabbitMQ status
- Database errors
- System metrics

## Recommended Next Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Service Impact
- Affected users: [estimate]
- Service degradation: [describe]
EOF

echo "Escalation complete. Handoff available at: /var/log/incidents/$INCIDENT_ID/"
```

---

## BACKUP & RECOVERY

### Automated Backup Schedule

```
Daily Backup:     02:00 AM UTC (Full backup)
Incremental:      Every 4 hours
RabbitMQ backup:  Daily 01:00 AM + hourly defs
Redis snapshot:   Every 6 hours
Transaction logs: Continuous WAL archiving
```

### Manual Full Recovery

```bash
#!/bin/bash
# Save as scripts/full-recovery.sh

echo "=== FULL SYSTEM RECOVERY ==="

# 1. Stop all services
docker-compose down

# 2. Create recovery environment
mkdir -p /recovery
cd /recovery

# 3. Extract latest backup
LATEST_BACKUP=$(ls -t /backups/daily/*.tar.gz | head -1)
tar -xzf $LATEST_BACKUP

# 4. Create fresh database
createdb -U postgres ai_agent_db

# 5. Restore database
pg_restore -d ai_agent_db /recovery/ai_agent_db_backup.sql

# 6. Restore RabbitMQ definitions
curl -u guest:guest -X POST http://localhost:15672/api/definitions \
  -H "content-type: application/json" \
  -d @/recovery/rabbitmq-definitions.json

# 7. Start services
docker-compose up -d

# 8. Verify recovery
sleep 30
curl -s http://localhost:3000/health
psql -U orchestrator -d ai_agent_db -c "SELECT COUNT(*) FROM agents;"

echo "Recovery complete"
```

---

## PERFORMANCE OPTIMIZATION

### Query Optimization Process

```sql
-- 1. Find slow queries
SELECT query, mean_exec_time, calls, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- 2. Explain slow query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM task_results WHERE status='pending' LIMIT 10;

-- 3. Create index if needed
CREATE INDEX CONCURRENTLY idx_task_results_status
ON task_results(status)
WHERE status='pending';

-- 4. Verify index usage
SELECT idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE indexrelname='idx_task_results_status';
```

### Memory Optimization

```javascript
// 1. Use streaming for large datasets
fs.createReadStream('/data/large-file.txt')
  .pipe(transform())
  .pipe(fs.createWriteStream('/output.txt'));

// 2. Implement object pooling
const pooledConnections = new LRUCache({ max: 100 });

// 3. Enable garbage collection tuning
// node --max-old-space-size=2048 app.js

// 4. Monitor heap usage
const heapUsed = process.memoryUsage().heapUsed;
if (heapUsed > 1.5 * 1024 * 1024 * 1024) {
  // Trigger cleanup
  gc();
}
```

---

## SECURITY HARDENING

### Regular Security Checks

```bash
#!/bin/bash
# Save as scripts/security-hardening.sh

# 1. Rotate credentials monthly
echo "=== CREDENTIAL ROTATION ==="
# Database passwords
psql -U postgres -c "ALTER ROLE orchestrator WITH PASSWORD '$(openssl rand -base64 24)';"

# RabbitMQ users
docker-compose exec rabbitmq rabbitmqctl change_password guest $(openssl rand -base64 24)

# 2. Check for exposed secrets
echo "=== SECRET SCANNING ==="
grep -r "password\|secret\|token\|key" .env | grep -v "^#"

# 3. Verify TLS certificates
echo "=== CERTIFICATE AUDIT ==="
openssl x509 -in certs/server.crt -noout -text | grep -E "Subject|Issuer|Not Before|Not After"

# 4. Check file permissions
echo "=== PERMISSION AUDIT ==="
find /var/lib/postgresql -type f ! -perm 600 -ls
find /var/lib/redis -type f ! -perm 600 -ls

# 5. Audit database user privileges
psql -U postgres << 'SQL'
SELECT * FROM information_schema.role_table_grants WHERE grantee != 'postgres';
SQL

# 6. Network security check
echo "=== NETWORK SECURITY ==="
netstat -tlnp | grep -E "3000|5432|5672|6379"
```

---

## QUICK REFERENCE COMMANDS

### Health & Status

```bash
# Full system health
curl http://localhost:3000/health

# Service status
docker-compose ps

# RabbitMQ summary
curl -u guest:guest http://localhost:15672/api/overview

# Database connections
psql -U orchestrator -d ai_agent_db -c "SELECT COUNT(*) FROM pg_stat_activity;"

# Redis info
redis-cli INFO

# Agent count
psql -U orchestrator -d ai_agent_db -c "SELECT COUNT(*) FROM agents WHERE status='active';"
```

### Log Analysis

```bash
# Recent errors
docker-compose logs --since 1h | grep ERROR

# Follow logs
docker-compose logs -f

# Search logs
docker-compose logs | grep "task_id:123"

# Tail and count
docker-compose logs | grep -c "ERROR"
```

### Service Management

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart orchestrator

# View service logs
docker-compose logs rabbitmq -f

# Clean up Docker
docker system prune -a --volumes
```

### Emergency

```bash
# Create incident
/scripts/emergency-response-p1.sh

# Quick diagnostic dump
docker-compose logs > /tmp/incident-$(date +%s).log

# Memory check
docker stats --no-stream

# Disk check
df -h /
```

---

**Document Version:** 1.0
**Last Updated:** November 18, 2025
**Next Review Date:** December 18, 2025
**Author:** Operations Team
**Status:** APPROVED FOR PRODUCTION
