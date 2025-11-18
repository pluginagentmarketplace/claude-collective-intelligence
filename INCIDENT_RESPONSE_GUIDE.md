# INCIDENT RESPONSE GUIDE
## AI Agent Orchestrator with RabbitMQ - 20+ Scenarios

**Last Updated:** November 18, 2025
**Version:** 1.0.0
**Status:** PRODUCTION READY

---

## TABLE OF CONTENTS

1. [Quick Incident Response](#quick-incident-response)
2. [Severity Classification](#severity-classification)
3. [Scenario 1-10: Critical System Issues](#scenario-1-10-critical-system-issues)
4. [Scenario 11-20: Data & Infrastructure](#scenario-11-20-data--infrastructure)
5. [Scenario 21-30: Performance & Reliability](#scenario-21-30-performance--reliability)
6. [Post-Incident Procedures](#post-incident-procedures)
7. [RCA & Prevention](#rca--prevention)

---

## QUICK INCIDENT RESPONSE

### Immediate Actions (First 2 Minutes)

```
1. Declare incident → Create incident ID → Page team lead
2. Assess severity → Route to appropriate team
3. Begin logging → Start screen capture & logs
4. Notify stakeholders → Update status page
5. Begin mitigation → Implement immediate fixes
```

### Communication Template

```
INCIDENT DECLARED: [ID]
Time: [timestamp]
Severity: [P1/P2/P3/P4]
Service Impact: [what's broken]
Customer Impact: [users affected]
Mitigation Status: [investigating/implementing/monitoring]
ETA Resolution: [estimate]
```

---

## SEVERITY CLASSIFICATION

### P1 - CRITICAL (5 min response)
- **Criteria:** Service completely unavailable, massive data loss risk
- **Scope:** All users affected, revenue impact immediate
- **Response:** All hands, VP Engineering notified, customer comms active
- **Example:** Database down, all APIs returning 500s

### P2 - URGENT (15 min response)
- **Criteria:** Major functionality broken, partial user impact
- **Scope:** 30%+ of users affected, business impact significant
- **Response:** Team lead + engineers, management aware
- **Example:** Agent task processing stalled, search unavailable

### P3 - HIGH (1 hour response)
- **Criteria:** Feature degraded, workaround available
- **Scope:** <30% users, business impact limited
- **Response:** Regular on-call team, manager notified
- **Example:** Agent response time increased 2x, cache slow

### P4 - MEDIUM (4 hour response)
- **Criteria:** Minor issue, cosmetic or edge case
- **Scope:** <5% users or internal only
- **Response:** Normal engineering process
- **Example:** Log message not formatting correctly

---

## SCENARIO 1-10: CRITICAL SYSTEM ISSUES

### SCENARIO 1: Application Service Down

**Symptoms:**
- HTTP 502/503 on all endpoints
- Application container exiting
- Cannot connect to application port 3000

**Time to Detect:** < 1 minute (automated alert)
**P-Level:** P1 - CRITICAL
**Response Time Target:** 5 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-1.sh

INCIDENT_ID="APP-DOWN-$(date +%s)"
echo "=== SCENARIO 1: Application Service Down ==="
echo "Incident ID: $INCIDENT_ID" | tee /tmp/$INCIDENT_ID.log

# STEP 1: Verify the issue (30 seconds)
echo "[VERIFY] Checking application status..."
curl -s -m 2 http://localhost:3000/health || echo "Service unavailable" | tee -a /tmp/$INCIDENT_ID.log
docker-compose ps orchestrator | tee -a /tmp/$INCIDENT_ID.log

# STEP 2: Collect logs (30 seconds)
echo "[DIAGNOSE] Collecting error logs..."
docker-compose logs orchestrator 2>&1 | tail -100 > /tmp/$INCIDENT_ID-logs.txt
# Look for:
# - Out of memory
# - Port already in use
# - Startup errors
# - Connection failures

STARTUP_ERROR=$(grep -i "error\|failed\|cannot" /tmp/$INCIDENT_ID-logs.txt | head -1)
echo "First error: $STARTUP_ERROR" | tee -a /tmp/$INCIDENT_ID.log

# STEP 3: Automatic restart (1 minute)
echo "[REMEDIATE] Attempting automatic restart..."
docker-compose restart orchestrator
RESTART_WAIT=0
while [ $RESTART_WAIT -lt 30 ]; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "[SUCCESS] Application recovered" | tee -a /tmp/$INCIDENT_ID.log
    exit 0
  fi
  sleep 1
  RESTART_WAIT=$((RESTART_WAIT + 1))
done

# STEP 4: If restart fails, manual investigation (2-3 minutes)
echo "[ESCALATE] Restart failed, investigating root cause..."

# Check disk space
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}')
echo "Disk usage: $DISK_USAGE" | tee -a /tmp/$INCIDENT_ID.log

# Check memory
MEMORY_USAGE=$(free -h | grep Mem | awk '{print $3/$2*100}')
echo "Memory usage: $MEMORY_USAGE%" | tee -a /tmp/$INCIDENT_ID.log

# Check recent errors
docker-compose logs orchestrator --since 10m 2>&1 | grep -E "OOM|ENOMEM|ENOSPC" && \
  echo "[ALERT] Out of resources detected" | tee -a /tmp/$INCIDENT_ID.log

# STEP 5: Resource recovery if needed
if [[ "$DISK_USAGE" == "100%" ]]; then
  echo "[REMEDIATE] Clearing disk space..."
  # Emergency cleanup
  docker system prune -a --volumes -f
  find /var/log -name "*.log" -mtime +7 -delete
fi

# STEP 6: Second restart attempt
echo "[REMEDIATE] Second restart attempt..."
docker-compose restart orchestrator
sleep 10
curl -s http://localhost:3000/health || {
  echo "[CRITICAL] Restart failed, escalating to Level 2"
  bash scripts/escalation-level2.sh
}
```

**Recovery Actions Priority:**
1. Restart container (often fixes transient issues)
2. Check & free up disk/memory
3. Review recent changes/deployments
4. Restore from last known good state
5. Escalate to engineering team

**Success Criteria:**
- HTTP 200 on `/health` endpoint
- Application accepting requests
- All services responding

**Post-Incident:**
- [ ] Review application logs for root cause
- [ ] Check if OOM kill happened: `dmesg | grep -i "killed"`
- [ ] Verify deployment was healthy before incident
- [ ] Schedule RCA meeting

---

### SCENARIO 2: Database Connection Pool Exhausted

**Symptoms:**
- "Connection pool exhausted" errors
- New requests queuing indefinitely
- Error logs: "ECONNREFUSED" to PostgreSQL
- Tasks getting queued but never executing

**Time to Detect:** 2-5 minutes (automated alerts)
**P-Level:** P1 - CRITICAL (if all tasks blocked), P2 - URGENT (if partial)
**Response Time Target:** 5 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-2.sh

INCIDENT_ID="POOL-EXHAUST-$(date +%s)"
echo "=== SCENARIO 2: Database Connection Pool Exhausted ==="

# STEP 1: Verify pool exhaustion (30 seconds)
echo "[VERIFY] Checking connection pool..."
psql -U orchestrator -d ai_agent_db << 'SQL' 2>&1 | tee /tmp/$INCIDENT_ID.log
SELECT datname, count(*) as total_connections,
  sum(CASE WHEN state='active' THEN 1 ELSE 0 END) as active,
  sum(CASE WHEN state='idle' THEN 1 ELSE 0 END) as idle,
  sum(CASE WHEN state='idle in transaction' THEN 1 ELSE 0 END) as idle_tx
FROM pg_stat_activity
GROUP BY datname;
SQL

# STEP 2: Identify long-running transactions (30 seconds)
echo "[DIAGNOSE] Finding problematic connections..."
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT pid, usename, application_name, state,
  EXTRACT(EPOCH FROM (NOW() - state_change))::int as seconds_in_state,
  query
FROM pg_stat_activity
WHERE datname='ai_agent_db'
  AND state IN ('active', 'idle in transaction')
  AND state_change < NOW() - INTERVAL '5 minutes'
ORDER BY state_change;
SQL

# STEP 3: Kill idle connections (1 minute)
echo "[REMEDIATE] Killing idle connections..."
KILLED=$(psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT count(pg_terminate_backend(pid))
FROM pg_stat_activity
WHERE datname='ai_agent_db'
  AND state='idle'
  AND state_change < NOW() - INTERVAL '5 minutes';
SQL
)
echo "Killed: $KILLED idle connections" | tee -a /tmp/$INCIDENT_ID.log

# STEP 4: Kill idle-in-transaction connections (with caution)
echo "[REMEDIATE] Killing idle-in-transaction connections..."
KILLED_TX=$(psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT count(pg_terminate_backend(pid))
FROM pg_stat_activity
WHERE datname='ai_agent_db'
  AND state='idle in transaction'
  AND xact_start < NOW() - INTERVAL '10 minutes';
SQL
)
echo "Killed: $KILLED_TX idle-in-transaction connections" | tee -a /tmp/$INCIDENT_ID.log

# STEP 5: Restart application pool manager
echo "[REMEDIATE] Restarting connection pool..."
docker-compose restart orchestrator-pool-manager 2>/dev/null || \
  docker-compose restart orchestrator

# STEP 6: Monitor recovery
echo "[MONITOR] Checking connection pool recovery..."
for i in {1..20}; do
  ACTIVE=$(psql -U orchestrator -d ai_agent_db -t -c \
    "SELECT count(*) FROM pg_stat_activity WHERE datname='ai_agent_db'")
  echo "Attempt $i: $ACTIVE connections"
  if [ "$ACTIVE" -lt 30 ]; then
    echo "[SUCCESS] Pool recovered" | tee -a /tmp/$INCIDENT_ID.log
    exit 0
  fi
  sleep 3
done

# STEP 7: If recovery fails, increase max_connections
echo "[REMEDIATE] Pool recovery slow, increasing max_connections..."
CURRENT_MAX=$(psql -U postgres -d postgres -t -c "SHOW max_connections")
NEW_MAX=$((CURRENT_MAX + 50))
psql -U postgres -d postgres -c "ALTER SYSTEM SET max_connections = $NEW_MAX;"
docker-compose restart postgres
sleep 15
```

**Root Cause Possibilities:**
1. **Idle connections not being closed:** Application doesn't close connections
2. **Long-running queries:** Queries taking too long, connections held
3. **Connection leak:** Bug in connection management code
4. **Spike in traffic:** More concurrent users than pool can handle

**Recovery Actions:**
1. Kill idle/long-running transactions (immediate)
2. Restart connection pool manager (1-2 min)
3. Restart application if needed
4. Increase pool size if persistent (5 min)
5. Investigate application code for leak

**Prevention:**
- Monitor connection count continuously
- Set idle connection timeout
- Use connection pooling library (pgBouncer)
- Code review for connection leak patterns

---

### SCENARIO 3: RabbitMQ Broker Down/Unreachable

**Symptoms:**
- Cannot publish messages to queues
- Consumer connections failing
- "Connection refused" to rabbitmq:5672
- Queue management UI unavailable

**Time to Detect:** < 1 minute
**P-Level:** P1 - CRITICAL
**Response Time Target:** 5 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-3.sh

INCIDENT_ID="RABBITMQ-DOWN-$(date +%s)"
echo "=== SCENARIO 3: RabbitMQ Broker Down ==="

# STEP 1: Verify connectivity (20 seconds)
echo "[VERIFY] Checking RabbitMQ status..."
{
  # Check Docker container
  docker-compose ps rabbitmq

  # Check port availability
  nc -zv localhost 5672
  nc -zv localhost 15672

  # Check socket
  netstat -tlnp | grep 5672
} 2>&1 | tee /tmp/$INCIDENT_ID.log

# STEP 2: Check RabbitMQ health internally
echo "[DIAGNOSE] Checking RabbitMQ internal status..."
docker-compose exec rabbitmq rabbitmq-diagnostics -q ping 2>&1 | tee -a /tmp/$INCIDENT_ID.log || echo "Ping failed"

# STEP 3: Check disk space (RabbitMQ issue often caused by full disk)
echo "[DIAGNOSE] Checking disk space..."
df -h | tee -a /tmp/$INCIDENT_ID.log

DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
  echo "[ALERT] Disk usage critical: $DISK_USAGE%" | tee -a /tmp/$INCIDENT_ID.log
  # RabbitMQ shuts down when disk is full
  # Need to free space first
  docker system prune -a --volumes -f
  find /var/log -name "*.log" -mtime +7 -delete
fi

# STEP 4: Check memory
echo "[DIAGNOSE] Checking memory..."
docker stats --no-stream rabbitmq | tee -a /tmp/$INCIDENT_ID.log

# STEP 5: Review recent logs
echo "[DIAGNOSE] Reviewing RabbitMQ logs..."
docker-compose logs rabbitmq --since 5m 2>&1 | tail -50 | tee -a /tmp/$INCIDENT_ID.log

# Look for specific errors
grep -i "terminating\|shutdown\|error\|warning" /tmp/$INCIDENT_ID.log | head -5

# STEP 6: Restart RabbitMQ
echo "[REMEDIATE] Restarting RabbitMQ..."
docker-compose restart rabbitmq

# Wait for startup
sleep 10

# STEP 7: Verify recovery
echo "[VERIFY] Checking RabbitMQ is responding..."
for i in {1..20}; do
  if curl -s -u guest:guest http://localhost:15672/api/overview > /dev/null 2>&1; then
    echo "[SUCCESS] RabbitMQ recovered" | tee -a /tmp/$INCIDENT_ID.log

    # Check queues are intact
    QUEUE_COUNT=$(curl -s -u guest:guest http://localhost:15672/api/queues | jq 'length')
    echo "Queues present: $QUEUE_COUNT" | tee -a /tmp/$INCIDENT_ID.log
    exit 0
  fi
  echo "Waiting for RabbitMQ... (attempt $i/20)"
  sleep 1
done

# STEP 8: If restart fails, escalate
echo "[ESCALATE] RabbitMQ failed to recover"
bash scripts/escalation-level2.sh
```

**RabbitMQ-Specific Checks:**

```bash
# Check RabbitMQ memory limits
curl -u guest:guest http://localhost:15672/api/nodes | jq '.[] | {name, memory_used, disk_free}'

# Check if in flow control (disk/memory issue)
curl -u guest:guest http://localhost:15672/api/connections | jq '.[] | {name, channels, blocked}'

# Check file descriptor usage
curl -u guest:guest http://localhost:15672/api/nodes | jq '.[] | {fd_used, fd_total}'
```

**Root Cause Possibilities:**
1. Disk full (RabbitMQ force-shutdown)
2. Memory exhausted
3. Network issue (connectivity check)
4. Process crashed/killed
5. Configuration invalid after deploy

---

### SCENARIO 4: Redis Cache Down

**Symptoms:**
- Cache operations timing out
- "Connection refused" to localhost:6379
- Cache hit rate drops to 0%
- Application slowness increases 5-10x

**Time to Detect:** 2-5 minutes
**P-Level:** P2 - URGENT (cache is non-critical but impacts performance)
**Response Time Target:** 15 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-4.sh

INCIDENT_ID="REDIS-DOWN-$(date +%s)"
echo "=== SCENARIO 4: Redis Cache Down ==="

# STEP 1: Verify Redis is down
echo "[VERIFY] Testing Redis connectivity..."
{
  redis-cli ping
  redis-cli INFO server | head -5
} 2>&1 | tee /tmp/$INCIDENT_ID.log || echo "Redis unreachable"

# STEP 2: Check container status
echo "[DIAGNOSE] Checking Redis container..."
docker-compose ps redis | tee -a /tmp/$INCIDENT_ID.log

# STEP 3: Check logs
echo "[DIAGNOSE] Reviewing Redis logs..."
docker-compose logs redis --since 5m 2>&1 | tail -30 | tee -a /tmp/$INCIDENT_ID.log

# STEP 4: Check if memory issue
echo "[DIAGNOSE] Checking memory usage..."
redis-cli INFO memory 2>/dev/null | grep -E "used_memory|memory_limit" || \
  docker stats --no-stream redis | tee -a /tmp/$INCIDENT_ID.log

# STEP 5: Restart Redis
echo "[REMEDIATE] Restarting Redis..."
docker-compose restart redis

# Wait for startup
sleep 5

# STEP 6: Verify Redis recovery
echo "[VERIFY] Testing Redis after restart..."
for i in {1..10}; do
  if redis-cli ping; then
    KEYS=$(redis-cli DBSIZE | awk '{print $2}')
    echo "[SUCCESS] Redis recovered, keys present: $KEYS" | tee -a /tmp/$INCIDENT_ID.log

    # Warm up cache from database
    echo "[REMEDIATE] Rebuilding cache from database..."
    curl -X POST http://localhost:3000/admin/cache-rebuild \
      -H "Authorization: Bearer $ADMIN_TOKEN"
    exit 0
  fi
  echo "Waiting for Redis... (attempt $i/10)"
  sleep 1
done

# STEP 7: If Redis won't start, drop and restart
echo "[REMEDIATE] Forcing Redis reset..."
docker-compose down -v
docker-compose up -d redis
sleep 5
```

**Cache Recovery Strategy:**

```bash
# If Redis came back but cache is empty:
# 1. Rebuild cache from database
curl -X POST http://localhost:3000/admin/cache-rebuild

# 2. Monitor cache warming
watch -n 1 'redis-cli DBSIZE'

# 3. Eventually system will warm cache as requests come in
```

**Note:** Unlike RabbitMQ, Redis is a cache (non-persistent), so loss is recoverable. System continues but slower.

---

### SCENARIO 5: Database Completely Unavailable

**Symptoms:**
- PostgreSQL port not responding (5432)
- "Connection refused" to database
- All database queries failing
- Application cannot start

**Time to Detect:** < 1 minute
**P-Level:** P1 - CRITICAL
**Response Time Target:** 5 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-5.sh

INCIDENT_ID="DB-DOWN-$(date +%s)"
echo "=== SCENARIO 5: Database Completely Unavailable ==="

# STEP 1: Verify database is down
echo "[VERIFY] Testing database connectivity..."
{
  pg_isready -h localhost -p 5432
  psql -U orchestrator -d postgres -c "SELECT 1;"
} 2>&1 | tee /tmp/$INCIDENT_ID.log || echo "Database unavailable"

# STEP 2: Check container
echo "[DIAGNOSE] Checking PostgreSQL container..."
docker-compose ps postgres 2>&1 | tee -a /tmp/$INCIDENT_ID.log

# STEP 3: Check logs for startup errors
echo "[DIAGNOSE] Checking PostgreSQL logs..."
docker-compose logs postgres --since 5m 2>&1 | tail -50 | tee -a /tmp/$INCIDENT_ID.log

# Look for specific issues
grep -i "PANIC\|FATAL\|ERROR" /tmp/$INCIDENT_ID.log | head -10

# STEP 4: Check disk space (major cause)
echo "[DIAGNOSE] Checking disk space..."
df -h /var/lib/postgresql/ 2>&1 | tee -a /tmp/$INCIDENT_ID.log

DISK_FREE=$(df /var/lib/postgresql | tail -1 | awk '{print $4}')
if [ $DISK_FREE -lt 1000000 ]; then
  echo "[ALERT] Low disk space: $(numfmt --to=iec $DISK_FREE) free" | tee -a /tmp/$INCIDENT_ID.log
fi

# STEP 5: Check if database is in recovery
echo "[DIAGNOSE] Checking database state..."
docker-compose exec postgres pg_controldata /var/lib/postgresql/data | \
  grep -E "state|shutdown" 2>&1 | tee -a /tmp/$INCIDENT_ID.log

# STEP 6: Attempt gentle restart
echo "[REMEDIATE] Attempting graceful restart..."
docker-compose restart postgres

# Wait for recovery
sleep 15

# STEP 7: Test connectivity
echo "[VERIFY] Testing connectivity after restart..."
pg_isready -h localhost -p 5432

if [ $? -eq 0 ]; then
  echo "[SUCCESS] Database recovered" | tee -a /tmp/$INCIDENT_ID.log

  # Run integrity check
  echo "[VERIFY] Running integrity check..."
  psql -U orchestrator -d ai_agent_db << 'SQL'
    SELECT COUNT(*) FROM agents;
    SELECT COUNT(*) FROM task_results;
    SELECT COUNT(*) FROM users;
  SQL
  exit 0
fi

# STEP 8: If restart fails, force recovery
echo "[REMEDIATE] Force recovery mode..."
docker-compose exec postgres sudo -u postgres pg_ctl \
  -D /var/lib/postgresql/data \
  -o "-c recovery_target_timeline=latest" \
  start

sleep 20

# STEP 9: Verify recovery again
pg_isready -h localhost -p 5432 || {
  echo "[CRITICAL] Database recovery failed, escalating"
  bash scripts/escalation-level2.sh
}
```

**Database Recovery Options (in order):**

1. **Restart (usually works):** `docker-compose restart postgres`
2. **Force recovery:** PostgreSQL runs WAL recovery on startup
3. **Restore from backup:** If database corrupted beyond recovery
4. **Switch to standby:** If multi-region setup available

---

### SCENARIO 6: High Error Rate / Cascading Failures

**Symptoms:**
- Error rate > 5% (alerts trigger at 1%)
- Errors cascading (one failure causes more)
- Specific error types trending up
- Some operations completely fail

**Time to Detect:** 1-2 minutes
**P-Level:** P2 - URGENT
**Response Time Target:** 15 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-6.sh

INCIDENT_ID="ERROR-CASCADE-$(date +%s)"
echo "=== SCENARIO 6: High Error Rate / Cascading Failures ==="

# STEP 1: Quantify the issue
echo "[VERIFY] Analyzing error rate..."
{
  docker-compose logs --since 5m orchestrator | grep -c "ERROR"
  docker-compose logs --since 5m orchestrator | grep -c "WARNING"
  docker-compose logs --since 5m orchestrator | grep -c "EXCEPTION"
} 2>&1 | tee /tmp/$INCIDENT_ID.log

# STEP 2: Identify error types
echo "[DIAGNOSE] Analyzing error distribution..."
docker-compose logs --since 10m orchestrator | grep "ERROR" | \
  sed 's/.*ERROR: \([^:]*\).*/\1/' | sort | uniq -c | sort -rn | \
  tee /tmp/$INCIDENT_ID-errors.txt

# STEP 3: Check for specific patterns
ERROR_TYPE=$(head -1 /tmp/$INCIDENT_ID-errors.txt | awk '{print $3}')
echo "Primary error: $ERROR_TYPE" | tee -a /tmp/$INCIDENT_ID.log

# STEP 4: Correlate with infrastructure metrics
echo "[DIAGNOSE] Checking infrastructure..."
# CPU
docker stats --no-stream | awk 'NR>1 {print $1, "CPU:", $3}'

# Memory
free -h | grep Mem

# Disk I/O
iostat -xz 1 2 | tail -5

# Network
netstat -s | grep -E "dropped|error"

# STEP 5: Identify the root cause
case "$ERROR_TYPE" in
  "DATABASE_ERROR")
    echo "[DIAGNOSE] Database error detected"
    psql -U orchestrator -d ai_agent_db -c "SELECT 1;" || {
      echo "Database unreachable"
      bash scripts/incident-response-scenario-5.sh
    }
    ;;
  "RABBITMQ_ERROR")
    echo "[DIAGNOSE] RabbitMQ error detected"
    curl -s -u guest:guest http://localhost:15672/api/overview > /dev/null || {
      bash scripts/incident-response-scenario-3.sh
    }
    ;;
  "TIMEOUT_ERROR")
    echo "[DIAGNOSE] Timeout detected - likely cascading failure"
    # Too many requests → slow responses → requests timeout → cascades

    # Implement circuit breaker
    echo "[REMEDIATE] Enabling circuit breaker..."
    curl -X POST http://localhost:3000/admin/circuit-breaker \
      -d '{"enabled": true, "threshold": 50}'
    ;;
  *)
    echo "[DIAGNOSE] Unknown error type, investigating..."
    ;;
esac

# STEP 6: Implement immediate mitigation
echo "[REMEDIATE] Implementing mitigation..."

# Option 1: Enable rate limiting
curl -X POST http://localhost:3000/admin/rate-limit \
  -d '{"enabled": true, "requests_per_second": 10}'

# Option 2: Increase timeout values
export REQUEST_TIMEOUT=30000
export DB_POOL_TIMEOUT=10000

# Option 3: Restart offending service
docker-compose restart orchestrator

# STEP 7: Monitor recovery
echo "[MONITOR] Monitoring error recovery..."
for i in {1..30}; do
  ERROR_COUNT=$(docker-compose logs --since 1m orchestrator | grep -c "ERROR")
  echo "$i: Errors in last minute: $ERROR_COUNT"
  if [ $ERROR_COUNT -lt 5 ]; then
    echo "[SUCCESS] Error rate recovered" | tee -a /tmp/$INCIDENT_ID.log
    exit 0
  fi
  sleep 2
done

echo "[ESCALATE] Error rate not recovering, escalating"
bash scripts/escalation-level2.sh
```

---

### SCENARIO 7: Agent Task Processing Stalled

**Symptoms:**
- Tasks assigned but not being processed
- Queue has messages but no movement
- Agent status shows "ready" but not accepting tasks
- Task completion rate at 0

**Time to Detect:** 5-10 minutes
**P-Level:** P2 - URGENT
**Response Time Target:** 15 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-7.sh

INCIDENT_ID="AGENT-STALL-$(date +%s)"
echo "=== SCENARIO 7: Agent Task Processing Stalled ==="

# STEP 1: Verify the stall
echo "[VERIFY] Checking agent processing status..."
{
  # Check queue depth
  curl -s -u guest:guest http://localhost:15672/api/queues | \
    jq '.[] | select(.name=="task_distribution_queue") | {name, messages, consumers}'

  # Check agent status
  psql -U orchestrator -d ai_agent_db -c \
    "SELECT agent_id, status, COUNT(*) FROM agents GROUP BY agent_id, status;"

  # Check task status
  psql -U orchestrator -d ai_agent_db -c \
    "SELECT status, COUNT(*) FROM task_results WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY status;"
} 2>&1 | tee /tmp/$INCIDENT_ID.log

# STEP 2: Check if agents are consuming messages
echo "[DIAGNOSE] Checking message consumption..."
curl -s -u guest:guest http://localhost:15672/api/queues/%2f/task_distribution_queue | \
  jq '{messages_ready, consumers}' | tee -a /tmp/$INCIDENT_ID.log

# If consumers=0, no one is listening
CONSUMERS=$(curl -s -u guest:guest http://localhost:15672/api/queues/%2f/task_distribution_queue | jq '.consumers')
if [ "$CONSUMERS" = "0" ]; then
  echo "[DIAGNOSE] No consumers connected!" | tee -a /tmp/$INCIDENT_ID.log
  echo "[REMEDIATE] Restarting agent services..."
  docker-compose restart agent-brainstorm agent-worker
  sleep 10
fi

# STEP 3: Check agent heartbeats
echo "[DIAGNOSE] Checking agent heartbeats..."
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT agent_id, MAX(heartbeat_at) as last_heartbeat, NOW() - MAX(heartbeat_at) as age
FROM agent_heartbeats
GROUP BY agent_id
ORDER BY last_heartbeat;
SQL

# STEP 4: Check for stuck tasks
echo "[DIAGNOSE] Checking for stuck processing tasks..."
psql -U orchestrator -d ai_agent_db << 'SQL'
SELECT task_id, agent_id, status, created_at,
  NOW() - created_at as age
FROM task_results
WHERE status='processing'
  AND created_at < NOW() - INTERVAL '5 minutes'
LIMIT 10;
SQL

# STEP 5: Check RabbitMQ for unacknowledged messages
echo "[DIAGNOSE] Checking unacknowledged messages..."
curl -s -u guest:guest http://localhost:15672/api/queues/%2f/task_distribution_queue | \
  jq '{messages_unacked}' | tee -a /tmp/$INCIDENT_ID.log

if [ "$(curl -s -u guest:guest http://localhost:15672/api/queues/%2f/task_distribution_queue | jq '.messages_unacked')" -gt 100 ]; then
  echo "[DIAGNOSE] High unacked message count - possible consumer crash" | tee -a /tmp/$INCIDENT_ID.log

  # Purge queue to reset (DANGEROUS - will lose tasks)
  echo "[REMEDIATE] Purging queue to reset..."
  # Backup messages first
  curl -s -u guest:guest http://localhost:15672/api/queues/%2f/task_distribution_queue | \
    > /tmp/$INCIDENT_ID-queue-backup.json

  # Purge
  curl -u guest:guest -X DELETE http://localhost:15672/api/queues/%2f/task_distribution_queue/contents
fi

# STEP 6: Restart agent services
echo "[REMEDIATE] Restarting all agent services..."
docker-compose restart orchestrator
sleep 10

# STEP 7: Resubmit stuck tasks
echo "[REMEDIATE] Resubmitting stuck processing tasks..."
psql -U orchestrator -d ai_agent_db << 'SQL'
UPDATE task_results
SET status='pending'
WHERE status='processing'
  AND created_at < NOW() - INTERVAL '10 minutes';
SQL

# STEP 8: Monitor recovery
echo "[MONITOR] Monitoring task processing recovery..."
for i in {1..30}; do
  PROCESSING=$(psql -U orchestrator -d ai_agent_db -t -c \
    "SELECT COUNT(*) FROM task_results WHERE status='processing'")
  COMPLETED=$(psql -U orchestrator -d ai_agent_db -t -c \
    "SELECT COUNT(*) FROM task_results WHERE status='completed' AND created_at > NOW() - INTERVAL '5 minutes'")
  echo "$i: Processing: $PROCESSING, Completed (5min): $COMPLETED"
  if [ "$PROCESSING" -lt 5 ] && [ "$COMPLETED" -gt 0 ]; then
    echo "[SUCCESS] Processing resumed" | tee -a /tmp/$INCIDENT_ID.log
    exit 0
  fi
  sleep 2
done

echo "[ESCALATE] Processing still stalled, escalating"
```

---

### SCENARIO 8: Data Corruption Detected

**Symptoms:**
- Database constraint violations
- Data appearing in wrong format
- Checksums not matching
- Foreign key violations detected

**Time to Detect:** 5-30 minutes (depends on validation)
**P-Level:** P1 - CRITICAL
**Response Time Target:** 15 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-8.sh

INCIDENT_ID="DATA-CORRUPT-$(date +%s)"
echo "=== SCENARIO 8: Data Corruption Detected ==="

# STEP 1: Verify corruption
echo "[VERIFY] Checking data integrity..."
psql -U orchestrator -d ai_agent_db << 'SQL' 2>&1 | tee /tmp/$INCIDENT_ID.log
-- Check constraints
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE constraint_type = 'UNIQUE'
  AND table_schema = 'public';

-- Check foreign key violations
SELECT *
FROM task_results tr
WHERE agent_id NOT IN (SELECT agent_id FROM agents)
LIMIT 10;
SQL

# STEP 2: Identify scope of corruption
echo "[DIAGNOSE] Determining corruption scope..."
CORRUPTED_ROWS=$(psql -U orchestrator -d ai_agent_db -t -c \
  "SELECT COUNT(*) FROM task_results WHERE agent_id NOT IN (SELECT agent_id FROM agents);")
echo "Corrupted rows: $CORRUPTED_ROWS" | tee -a /tmp/$INCIDENT_ID.log

# STEP 3: CRITICAL: Stop writes to avoid spreading corruption
echo "[REMEDIATE] Setting database to read-only mode..."
psql -U postgres -d ai_agent_db -c "ALTER DATABASE ai_agent_db SET default_transaction_read_only = on;"

# Inform users
curl -X POST http://localhost:3000/admin/maintenance-mode \
  -d '{"enabled": true, "reason": "Data integrity check in progress"}'

# STEP 4: Preserve corrupted data for investigation
echo "[PRESERVE] Backing up corrupted data..."
psql -U orchestrator -d ai_agent_db -c \
  "COPY (SELECT * FROM task_results WHERE agent_id NOT IN (SELECT agent_id FROM agents)) \
   TO PROGRAM 'tee /tmp/$INCIDENT_ID-corrupted-rows.sql'"

# Full database backup
pg_dump -U orchestrator -d ai_agent_db > /tmp/$INCIDENT_ID-db-backup.sql

# STEP 5: Attempt automatic repair (depends on corruption type)
echo "[REMEDIATE] Attempting automatic repair..."

# Option 1: Delete corrupted rows
psql -U orchestrator -d ai_agent_db << 'SQL'
DELETE FROM task_results
WHERE agent_id NOT IN (SELECT agent_id FROM agents);
SQL

# Option 2: Rebuild indexes
REINDEX DATABASE ai_agent_db;

# Option 3: Check table consistency
ANALYZE;

# STEP 6: Run comprehensive integrity check
echo "[VERIFY] Running full integrity check..."
psql -U orchestrator -d ai_agent_db << 'SQL'
-- Check all constraints
SELECT COUNT(*) as issues FROM (
  SELECT * FROM task_results WHERE agent_id NOT IN (SELECT agent_id FROM agents)
  UNION ALL
  SELECT * FROM task_results WHERE created_by NOT IN (SELECT user_id FROM users)
) t;
SQL

# STEP 7: Return to normal if clean
if [ $(psql -U orchestrator -d ai_agent_db -t -c "SELECT COUNT(*) FROM task_results WHERE agent_id NOT IN (SELECT agent_id FROM agents);") -eq 0 ]; then
  echo "[SUCCESS] Corruption repaired" | tee -a /tmp/$INCIDENT_ID.log

  # Return to read-write
  psql -U postgres -d ai_agent_db -c "ALTER DATABASE ai_agent_db SET default_transaction_read_only = off;"

  # Exit maintenance mode
  curl -X POST http://localhost:3000/admin/maintenance-mode -d '{"enabled": false}'
  exit 0
fi

# STEP 8: If repair failed, restore from backup
echo "[REMEDIATE] Restoration from backup required"
echo "[CRITICAL] Need to restore database from backup"
echo "Latest clean backup: $(ls -t /backups/daily/*.tar.gz | head -1)"

# Escalate
bash scripts/escalation-level2.sh
```

---

### SCENARIO 9: Message Loss Detected

**Symptoms:**
- Tasks submitted but never appear in queue
- Queue depth decreasing but tasks not completed
- Missing task IDs in results table
- Users report tasks not being processed

**Time to Detect:** 10-30 minutes
**P-Level:** P1 - CRITICAL (if data loss)
**Response Time Target:** 15 minutes

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-9.sh

INCIDENT_ID="MSG-LOSS-$(date +%s)"
echo "=== SCENARIO 9: Message Loss Detected ==="

# STEP 1: Confirm message loss
echo "[VERIFY] Checking for lost messages..."
psql -U orchestrator -d ai_agent_db << 'SQL' 2>&1 | tee /tmp/$INCIDENT_ID.log
-- Find tasks that don't have corresponding queue records
SELECT COUNT(*) as lost_tasks
FROM task_submissions
WHERE task_id NOT IN (SELECT task_id FROM task_results);

-- Check for large gaps in task IDs
SELECT COUNT(*), MAX(task_id) - MIN(task_id) as id_gap
FROM task_submissions;
SQL

# STEP 2: Check RabbitMQ acknowledgment settings
echo "[DIAGNOSE] Checking RabbitMQ configuration..."
{
  curl -s -u guest:guest http://localhost:15672/api/queues | \
    jq '.[] | select(.name=="task_distribution_queue") | {durable, auto_delete, arguments}'
} 2>&1 | tee -a /tmp/$INCIDENT_ID.log

# STEP 3: Check application code for ack handling
echo "[DIAGNOSE] Reviewing application message handling..."
docker-compose logs orchestrator --since 30m | grep -E "ack|nack|reject" | tail -20

# STEP 4: Enable RabbitMQ persistence for affected queues
echo "[REMEDIATE] Ensuring queue persistence..."
curl -u guest:guest -X PUT http://localhost:15672/api/queues/%2f/task_distribution_queue \
  -H 'content-type: application/json' \
  -d '{"durable": true}'

# STEP 5: Enable message persistence
curl -u guest:guest -X PUT http://localhost:15672/api/policies/persistence \
  -H 'content-type: application/json' \
  -d '{"pattern": ".*", "priority": 0, "apply-to": "all", "definition": {"ha-mode": "all", "ha-sync-mode": "automatic"}}'

# STEP 6: Resubmit lost tasks
echo "[REMEDIATE] Resubmitting lost tasks..."
psql -U orchestrator -d ai_agent_db << 'SQL'
INSERT INTO task_submissions (task_id, payload, submitted_at)
SELECT task_id, payload, submitted_at
FROM task_submissions
WHERE task_id NOT IN (SELECT task_id FROM task_results)
  AND submitted_at > NOW() - INTERVAL '1 hour';
SQL

# STEP 7: Monitor for further loss
echo "[MONITOR] Monitoring for message loss..."
for i in {1..20}; do
  NEW_LOSS=$(psql -U orchestrator -d ai_agent_db -t -c \
    "SELECT COUNT(*) FROM task_submissions WHERE task_id NOT IN (SELECT task_id FROM task_results) AND submitted_at > NOW() - INTERVAL '5 minutes';")
  echo "$i: New loss detected: $NEW_LOSS"
  if [ "$NEW_LOSS" = "0" ]; then
    echo "[SUCCESS] No further message loss detected" | tee -a /tmp/$INCIDENT_ID.log
    exit 0
  fi
  sleep 10
done

echo "[ESCALATE] Continued message loss detected, escalating"
```

---

### SCENARIO 10: Memory Leak Causing OOM Killer

**Symptoms:**
- Application process memory continuously increasing
- Eventually process killed by OOM killer
- Restart temporarily fixes but memory grows again
- Garbage collection logs show increasing heap

**Time to Detect:** 30 minutes - 2 hours
**P-Level:** P2 - URGENT
**Response Time Target:** 1 hour

**Response Checklist:**

```bash
#!/bin/bash
# scripts/incident-response-scenario-10.sh

INCIDENT_ID="MEMLEAK-$(date +%s)"
echo "=== SCENARIO 10: Memory Leak Causing OOM Killer ==="

# STEP 1: Verify memory leak
echo "[VERIFY] Checking memory usage trend..."
# Get historical memory from monitoring
curl -s 'http://localhost:9090/api/v1/query_range?query=container_memory_usage_bytes{name="orchestrator"}&start='$(date -u -d '2 hours ago' +%s)'&step=5m' \
  | jq '.data.result[0].values[-10:]' | tee /tmp/$INCIDENT_ID.log

# STEP 2: Confirm OOM killer involvement
echo "[DIAGNOSE] Checking for OOM killer evidence..."
dmesg | grep -E "killed|OOM|memory" | tail -10 | tee -a /tmp/$INCIDENT_ID.log

# STEP 3: Get heap dump for analysis
echo "[DIAGNOSE] Collecting heap snapshot..."
curl -X GET http://localhost:3000/admin/heap-dump \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o /tmp/$INCIDENT_ID-heap.heapsnapshot

echo "Heap dump size: $(du -h /tmp/$INCIDENT_ID-heap.heapsnapshot)" | tee -a /tmp/$INCIDENT_ID.log

# Analyze for largest objects
node --eval "
const fs = require('fs');
try {
  const heap = JSON.parse(fs.readFileSync('/tmp/$INCIDENT_ID-heap.heapsnapshot'));
  const strings = heap.strings;
  const entries = {};
  heap.snapshot.edges.forEach(edge => {
    const name = strings[edge.name_or_index];
    entries[name] = (entries[name] || 0) + 1;
  });
  Object.entries(entries)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([name, count]) => console.log(\`\${name}: \${count}\`));
} catch(e) {}
" | tee -a /tmp/$INCIDENT_ID-analysis.txt

# STEP 4: Check for common leak patterns
echo "[DIAGNOSE] Checking for common memory leak patterns..."
docker-compose logs orchestrator --since 2h | grep -E "listener|retained|subscription|cache|timeout" | wc -l

# STEP 5: Temporary mitigation: graceful restart
echo "[REMEDIATE] Scheduling graceful restart..."
curl -X POST http://localhost:3000/admin/graceful-restart \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"drain_timeout": 300}'

# Wait for graceful shutdown
sleep 30

# If still running, force restart
ps aux | grep "node.*orchestrator" | grep -v grep && docker-compose restart orchestrator

# STEP 6: Check memory after restart
sleep 10
echo "[VERIFY] Memory status after restart..."
docker stats --no-stream orchestrator | tee -a /tmp/$INCIDENT_ID.log

# STEP 7: Monitor for memory growth
echo "[MONITOR] Monitoring memory trend..."
for i in {1..60}; do
  MEM=$(docker stats --no-stream orchestrator | awk 'NR==2 {print $4}' | sed 's/[A-Za-z]*$//')
  echo "$i min: Memory = $MEM"
  if (( $(echo "$MEM > 1500" | bc -l) )); then
    echo "[WARNING] Memory growing again: $MEM" | tee -a /tmp/$INCIDENT_ID.log
    # Need code fix - escalate
    break
  fi
  sleep 60
done

# STEP 8: Escalate for code review
echo "[ESCALATE] Memory leak requires code investigation"
cat > /tmp/$INCIDENT_ID-findings.md << EOF
# Memory Leak Investigation

**Heap Dump:** $INCIDENT_ID-heap.heapsnapshot
**Top Objects:** See analysis above
**Potential Causes:**
1. Event listeners not being removed
2. Cache growing without eviction
3. Connection references not being freed
4. Circular references preventing GC

**Action Items:**
- Review code changes from last 48 hours
- Check for event listeners in main loop
- Verify cache invalidation logic
- Check connection cleanup code
EOF

cat /tmp/$INCIDENT_ID-findings.md
```

---

## SCENARIO 11-20: DATA & INFRASTRUCTURE

### SCENARIO 11: Data Inconsistency Between Services

**Symptoms:**
- Cache data differs from database
- Different agents returning different results
- Search results don't match database query
- Users see stale information

**Detection:** Business logic tests, data reconciliation
**P-Level:** P3 - HIGH
**Response:** Review cache invalidation, rebuild cache from source of truth

---

### SCENARIO 12: Backup Failure

**Symptoms:**
- Daily backup not completing
- Backup file corrupted
- Restore fails
- Backup storage full

**Response:**

```bash
# 1. Verify backup failure
ls -lh /backups/daily/ | tail -5
# Check if today's backup exists

# 2. Check backup process logs
tail -100 /var/log/backup.log

# 3. Try manual backup
pg_dump -U orchestrator -d ai_agent_db > /tmp/manual-backup-$(date +%s).sql
tar -czf /tmp/manual-backup-$(date +%s).tar.gz /tmp/manual-backup-*.sql

# 4. Verify backup viability
pg_restore --list /tmp/manual-backup-*.tar.gz | head -20
```

---

### SCENARIO 13: Network Partition (Multi-Region)

**Symptoms:**
- Region cannot reach other regions
- Split-brain conditions
- Data divergence between regions
- Failover not working

**Response:**
- Isolate affected region to read-only
- Route traffic to healthy region
- Monitor replication lag
- Manual failover if primary down

---

### SCENARIO 14: Certificate Expiration

**Symptoms:**
- TLS handshake failures
- HTTPS connections rejected
- ACME renewal failed
- Certificate warnings in logs

**Response:**

```bash
# Check cert expiration
openssl x509 -in certs/server.crt -noout -dates

# Renew certificate (if Let's Encrypt)
certbot renew --force-renewal

# Or generate self-signed (dev)
openssl req -new -newkey rsa:2048 -days 365 -nodes \
  -x509 -keyout server.key -out server.crt
```

---

### SCENARIO 15: Database Replication Lag

**Symptoms:**
- Read replicas behind by hours
- Queries returning stale data
- Replication lag increasing
- Connection loss between primary and replica

**Response:**

```sql
-- Check replication status
SELECT slot_name, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots;

-- Check lag
SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_time()))::INT as lag_seconds;

-- If lag is increasing, may need to increase:
-- - shared_buffers
-- - max_wal_senders
-- - Network bandwidth
```

---

### SCENARIO 16: Queue Corruption (Unrecoverable Poison Message)

**Symptoms:**
- Specific queue stuck
- Message causes consumer to crash
- Same message keeps being redelivered
- Queue won't empty

**Response:**

```bash
#!/bin/bash
# Identify poison message
curl -s -u guest:guest http://localhost:15672/api/queues/%2f/task_distribution_queue | jq

# Get peek at messages
rabbitmqctl list_queues name messages consumers

# If message is poison, need to:
# 1. Stop all consumers
# 2. Drain queue to file
# 3. Filter out poison message
# 4. Replay clean messages
# 5. Resume consumers

# Drain queue (destructive)
curl -u guest:guest -X DELETE http://localhost:15672/api/queues/%2f/task_distribution_queue/contents

# Rebuild queue from database
psql -U orchestrator -d ai_agent_db -c \
  "SELECT * FROM task_queue WHERE status='pending';" | while read task; do
  # Publish task back to queue
  echo $task | docker-compose exec -T orchestrator node -e \
    "const amqp = require('amqplib'); /* publish logic */"
done
```

---

### SCENARIO 17: Monitoring System Failure

**Symptoms:**
- No alerts being generated
- Dashboard showing no data
- Prometheus unable to scrape metrics
- Historical metrics missing

**Response:**

```bash
# 1. Verify Prometheus is running
curl -s http://localhost:9090/-/healthy

# 2. Check scrape status
curl -s http://localhost:9090/api/v1/targets

# 3. Verify Grafana connectivity
curl -s -u admin:admin http://localhost:3001/api/health

# 4. Check metric storage
du -sh /var/lib/prometheus/

# 5. Restart monitoring stack
docker-compose restart prometheus grafana
```

---

### SCENARIO 18: Slow Database Queries

**Symptoms:**
- Database queries taking 5-10x longer
- Query response time inconsistent
- High CPU usage on database server
- Transaction locks detected

**Response:** Enable query logging, identify slow queries, add indexes, optimize code

---

### SCENARIO 19: Storage Quota Exceeded

**Symptoms:**
- Write operations failing
- "Disk full" errors
- Application cannot create files
- Backups failing

**Response:**

```bash
# Identify large files/directories
du -sh /* | sort -rh

# Cleanup old data
find /var/log -mtime +30 -delete
find /tmp -mtime +7 -delete
docker system prune -a

# If still critical, migrate to larger volume
```

---

### SCENARIO 20: Authentication System Failure

**Symptoms:**
- All login requests failing
- JWT validation errors
- User cannot authenticate
- API authentication bypassed

**Response:**

```bash
# 1. Check auth service
curl -s http://localhost:3000/health/auth

# 2. Verify JWT secret
echo $JWT_SECRET

# 3. Check auth database
psql -U orchestrator -d ai_agent_db -c "SELECT COUNT(*) FROM users;"

# 4. Verify token in Redis
redis-cli KEYS "auth:*" | head -10

# 5. Restart auth service
docker-compose restart orchestrator
```

---

## POST-INCIDENT PROCEDURES

### Immediate After Incident (Minutes after resolution)

```bash
#!/bin/bash
# scripts/post-incident-immediate.sh

INCIDENT_ID=$1

echo "=== POST-INCIDENT IMMEDIATE ACTIONS ==="

# 1. Collect all logs and diagnostics
mkdir -p /var/log/incidents/$INCIDENT_ID
docker-compose logs > /var/log/incidents/$INCIDENT_ID/full-logs.txt
docker stats --no-stream > /var/log/incidents/$INCIDENT_ID/final-stats.txt

# 2. Verify system health
curl -s http://localhost:3000/health > /var/log/incidents/$INCIDENT_ID/final-health.json
docker-compose ps > /var/log/incidents/$INCIDENT_ID/final-services.txt

# 3. Document timeline
cat > /var/log/incidents/$INCIDENT_ID/timeline.md << EOF
# Incident Timeline - $INCIDENT_ID

## Detection
Time: [DETECTION_TIME]
Method: [Alert/User Report/Automated]
Severity: [P1/P2/P3]

## Investigation
- [Timeline of investigation steps]
- [Key findings]
- [Hypothesis testing]

## Mitigation
- [Actions taken]
- [Time each action took]
- [Results of each action]

## Resolution
- [Final resolution action]
- [Time to recovery]
- [Verification steps]
EOF

# 4. Send incident summary
curl -X POST https://slack.com/api/chat.postMessage \
  -H 'Content-type: application/json' \
  -d '{
    "channel": "#incidents",
    "text": "INCIDENT RESOLVED: '$INCIDENT_ID'",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Incident Resolved*\nID: '$INCIDENT_ID'\nResolved at: '$(date)'\nLogs: /var/log/incidents/'$INCIDENT_ID'/"
        }
      }
    ]
  }'
```

### Root Cause Analysis (24-48 hours after)

```bash
#!/bin/bash
# scripts/rca-process.sh

INCIDENT_ID=$1

echo "=== ROOT CAUSE ANALYSIS ==="

# 1. Gather RCA team
# - On-call engineer who handled it
# - Tech lead
# - Component owner
# - Ops representative

# 2. Review timeline and logs
# /var/log/incidents/$INCIDENT_ID/

# 3. Create RCA document
cat > /var/log/incidents/$INCIDENT_ID/RCA.md << 'EOF'
# Root Cause Analysis - [INCIDENT_ID]

## Summary
[1-2 line summary]

## Timeline
[Detailed timeline from detection to resolution]

## Impact
- Users affected: [number]
- Duration: [minutes]
- Data loss: [yes/no/estimate]
- Financial impact: [if applicable]

## Root Cause
[What actually caused the incident]
[Why the root cause wasn't prevented by existing systems]
[Contributing factors]

## Contributing Factors
1. [Factor 1]
2. [Factor 2]
3. [Factor 3]

## Resolution
[How it was fixed]
[Duration of fix]

## Preventive Actions
1. [Action 1] - Owner: [Name] - Target date: [Date]
2. [Action 2] - Owner: [Name] - Target date: [Date]
3. [Action 3] - Owner: [Name] - Target date: [Date]

## Detection Improvements
- [How we should have detected sooner]
- [Alerts needed]
- [Monitoring improvements]

## Learning Points
- [What did we learn]
- [What went well]
- [What could be better]
EOF

# 4. Share RCA with team
cat /var/log/incidents/$INCIDENT_ID/RCA.md
```

### Follow-Up Actions (1-2 weeks after)

```bash
# 1. Verify all preventive actions are in progress
grep "Preventive Actions" /var/log/incidents/*/RCA.md | while read action; do
  echo "Checking: $action"
  # Verify action taken
done

# 2. Update runbooks based on learnings
# Edit OPERATIONAL_RUNBOOKS.md with new procedures

# 3. Update alerting based on detection improvements
# Review Prometheus rules and Grafana dashboards

# 4. Schedule training session on incident for team
# Ensure team learns from incident
```

---

## RCA & PREVENTION

### Building Incident Prevention

**For each incident:**

```
Detect → Respond → Resolve → Learn → Prevent
  ↓                                      ↓
 Alert                           System changes
                                 Code changes
                                 Process changes
                                 Runbook updates
```

**Prevention Framework:**

```bash
# 1. Automated Detection
# Add alert if not present
curl -X PUT http://localhost:9090/alerts \
  -d '{
    "name": "High[ErrorRate",
    "expr": "rate(errors_total[5m]) > 0.01",
    "severity": "warning"
  }'

# 2. Automated Response
# Add circuit breaker, rate limiter, or auto-scale

# 3. Monitoring
# Add dashboard panel for early warning signs

# 4. Testing
# Add test case to prevent regression
# npm test -- --testNamePattern="Scenario 5"

# 5. Documentation
# Update runbooks, playbooks, procedures
```

---

**Document Version:** 1.0
**Last Updated:** November 18, 2025
**Total Scenarios:** 20+
**Average Resolution Time (Target):** <30 minutes for P2
**Status:** APPROVED FOR PRODUCTION
