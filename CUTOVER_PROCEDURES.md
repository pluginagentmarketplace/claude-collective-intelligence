# PRODUCTION CUTOVER PROCEDURES
## AI Agent Orchestrator with RabbitMQ - Traffic Switching & Health Validation

**Document Version:** 2.0.0
**Last Updated:** 2025-11-18
**Classification:** OPERATIONAL - SENSITIVE

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Pre-Cutover Requirements](#pre-cutover-requirements)
3. [DNS Cutover Strategy](#dns-cutover-strategy)
4. [Load Balancer Cutover Strategy](#load-balancer-cutover-strategy)
5. [Health Check Procedures](#health-check-procedures)
6. [Monitoring During Cutover](#monitoring-during-cutover)
7. [Instant Rollback Capability](#instant-rollback-capability)
8. [DNS/Load Balancer Changes](#dnsload-balancer-changes)
9. [Cutover Execution Timeline](#cutover-execution-timeline)
10. [Common Issues & Solutions](#common-issues--solutions)
11. [Post-Cutover Validation](#post-cutover-validation)

---

## EXECUTIVE SUMMARY

The cutover procedure manages the transition of production traffic from the current environment (Green) to the new environment (Blue). This must be executed with precision to ensure:

- **Zero downtime** for end users
- **Continuous service availability** throughout transition
- **Data consistency** maintained
- **Instant rollback** capability at all times
- **Real-time monitoring** of all metrics

**Cutover Duration:** 10-15 minutes (normal case)
**Rollback Capability:** < 2 minutes
**Risk Mitigation:** Multi-stage traffic shift with health validation

---

## PRE-CUTOVER REQUIREMENTS

### Blue Environment Validation

Before initiating cutover, verify blue environment is production-ready:

```bash
# 1. Application health check
curl -s http://blue-app:3000/health | jq .
# Expected: status = "ok", version = "2.1.0", all services = "ok"

# 2. Database connectivity
psql -h blue-db -U postgres -d production -c "SELECT NOW();" | grep -q "2025"
# Expected: Current date/time returned

# 3. RabbitMQ connectivity
curl -s -u guest:guest http://blue-rabbitmq:15672/api/overview | jq .users
# Expected: JSON object with user list

# 4. Redis connectivity
redis-cli -h blue-redis ping
# Expected: PONG

# 5. API endpoint responsiveness
curl -s -w "HTTP %{http_code}\n" http://blue-app:3000/api/agents
# Expected: HTTP 200

# 6. Error rate verification
curl -s http://prometheus:9090/api/v1/query?query=rate(http_requests_total%7Binstance=%22blue-app:3000%22,status=~%225..%22%7D%5B5m%5D)
# Expected: < 0.1% error rate
```

### Green Environment Baseline

Capture current production metrics before traffic switch:

```bash
# Green environment baseline metrics
echo "=== GREEN ENVIRONMENT BASELINE ===" > /tmp/baseline.txt
echo "Timestamp: $(date)" >> /tmp/baseline.txt

# Request rate
curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total%5B1m%5D)' \
  | jq '.data.result[] | select(.metric.instance == "green-app:3000")' >> /tmp/baseline.txt

# Error rate
curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[1m])' \
  | jq '.data.result[] | select(.metric.instance == "green-app:3000")' >> /tmp/baseline.txt

# Response time P95
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))' \
  | jq '.data.result[] | select(.metric.instance == "green-app:3000")' >> /tmp/baseline.txt

# Database connections
psql -h green-db -U postgres -d production -c "SELECT count(*) as connections FROM pg_stat_activity;" >> /tmp/baseline.txt

# Cache hit rate
redis-cli -h green-redis INFO stats | grep "keyspace_hits\|keyspace_misses" >> /tmp/baseline.txt

cat /tmp/baseline.txt
```

### Communication Readiness

- [ ] All team members in communication channels
- [ ] Slack `#prod-deployment` channel active
- [ ] Status page (StatusPage.io) accessible
- [ ] External notifications prepared
- [ ] Incident commander designated
- [ ] Decision authority confirmed present

### Monitoring Dashboard Readiness

```bash
# Verify monitoring is active and collecting data
curl -s http://prometheus:9090/api/v1/targets | jq '.data.activeTargets | length'
# Expected: > 20 targets active

# Verify Grafana accessible
curl -s http://grafana:3000/api/health | jq .
# Expected: {"status": "ok"}

# Verify alerting rules loaded
curl -s http://prometheus:9090/api/v1/rules | jq '.data.groups | length'
# Expected: > 10 rule groups
```

---

## DNS CUTOVER STRATEGY

**Applicable If:** Using DNS-based routing (vs. load balancer)

### DNS Pre-Cutover Preparation

**Execute T-24 hours before cutover:**

```bash
# 1. Reduce TTL to enable quick failover
nsupdate -k /etc/bind/keys/tsig.key << EOF
server ns1.example.com
zone example.com
update delete app.example.com A
update add app.example.com 300 A 10.0.2.50  # Blue IP
send
quit
EOF

# Expected: DNS update successful

# 2. Verify TTL reduced
dig app.example.com +nocmd +noall +answer
# Expected: app.example.com.     300    IN      A       10.0.2.50

# 3. Document current DNS state
nslookup app.example.com > /tmp/dns_baseline.txt
cat /tmp/dns_baseline.txt
```

### DNS Cutover Execution

**Execute during cutover window:**

```bash
# 1. Pre-cutover health check of both environments
dig blue.example.com +short  # Should resolve to blue IP
dig green.example.com +short # Should resolve to green IP

# 2. Prepare DNS update command
nsupdate -k /etc/bind/keys/tsig.key << EOF
server ns1.example.com
zone example.com
update delete app.example.com A
update add app.example.com 300 A 10.0.2.50  # Blue IP address
send
quit
EOF

# Expected: "update successful"

# 3. Verify DNS change propagated
nslookup app.example.com
# Expected: app.example.com resolves to blue IP within 5 seconds

# 4. Monitor DNS propagation to all nameservers
for ns in ns1 ns2 ns3; do
  dig @${ns}.example.com app.example.com +short
  # Expected: All return blue IP
done

# 5. Verify DNS resolvers updated
curl -s http://8.8.8.8/dns-query?name=app.example.com&type=A | jq .
# May take up to 300 seconds (TTL value) for full propagation
```

### DNS Rollback (If Needed)

```bash
# Immediate rollback to green environment
nsupdate -k /etc/bind/keys/tsig.key << EOF
server ns1.example.com
zone example.com
update delete app.example.com A
update add app.example.com 60 A 10.0.1.50  # Green IP address (restore TTL to 60s)
send
quit
EOF

# Verify rollback
nslookup app.example.com
# Expected: Returns green IP
```

---

## LOAD BALANCER CUTOVER STRATEGY

**Applicable If:** Using AWS ALB/NLB or similar load balancer

### Load Balancer Pre-Cutover Setup

**Execute T-1 hour before cutover:**

```bash
# 1. Verify target group weights set correctly
aws elbv2 describe-target-groups \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:...:loadbalancer/app/prod/... \
  --region us-east-1

# Expected output:
# Green target group weight: 100
# Blue target group weight: 0

# 2. Verify health check configuration
aws elbv2 describe-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/blue-prod/...

# Expected:
# - HealthCheckEnabled: true
# - HealthCheckPath: /health
# - HealthCheckProtocol: HTTP
# - HealthCheckPort: 3000
# - HealthyThresholdCount: 2
# - UnhealthyThresholdCount: 3
# - HealthCheckIntervalSeconds: 30
# - HealthCheckTimeoutSeconds: 5

# 3. Record current state
aws elbv2 describe-rules \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:...:loadbalancer/app/prod/... \
  > /tmp/alb_baseline.json
```

### Phase 1: 50% Traffic Shift (Canary Release)

**Duration:** T+56 to T+58 min (2 minutes duration)

```bash
#!/bin/bash
# Phase 1: Shift 50% traffic to blue

TARGET_GROUP_ARN_BLUE="arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/blue-prod/..."
TARGET_GROUP_ARN_GREEN="arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/green-prod/..."
RULE_ARN="arn:aws:elasticloadbalancing:us-east-1:...:listener-rule/app/prod/..."

echo "=== PHASE 1: 50% TRAFFIC SHIFT ==="
echo "Start time: $(date)"

# Execute weight change
aws elbv2 modify-rule \
  --rule-arn $RULE_ARN \
  --actions '[
    {
      "Type": "forward",
      "TargetGroups": [
        {
          "TargetGroupArn": "'$TARGET_GROUP_ARN_GREEN'",
          "Weight": 50
        },
        {
          "TargetGroupArn": "'$TARGET_GROUP_ARN_BLUE'",
          "Weight": 50
        }
      ]
    }
  ]'

echo "Weight change command executed"
echo "Waiting for propagation... (30 seconds)"
sleep 30

# Verify weights updated
aws elbv2 describe-rules --rule-arns $RULE_ARN | jq '.Rules[0].ForwardConfig.TargetGroups'

# Expected output:
# [
#   {
#     "TargetGroupArn": "arn:aws:.../green-prod/...",
#     "Weight": 50
#   },
#   {
#     "TargetGroupArn": "arn:aws:.../blue-prod/...",
#     "Weight": 50
#   }
# ]

echo "Phase 1 complete: $(date)"
```

### Phase 2: 100% Traffic Shift to Blue

**Duration:** T+58 to T+60 min (2 minutes duration)

```bash
#!/bin/bash
# Phase 2: Shift 100% traffic to blue

TARGET_GROUP_ARN_BLUE="arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/blue-prod/..."
TARGET_GROUP_ARN_GREEN="arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/green-prod/..."
RULE_ARN="arn:aws:elasticloadbalancing:us-east-1:...:listener-rule/app/prod/..."

echo "=== PHASE 2: 100% TRAFFIC SHIFT TO BLUE ==="
echo "Start time: $(date)"

# Pre-shift validation
echo "Pre-shift validation:"
echo "  Error rate (50/50 split): CHECKING..."
error_rate=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[1m])' | jq '.data.result[0].value[1]' 2>/dev/null || echo "0")
echo "  Error rate: $error_rate (must be < 0.001)"

echo "  Response time P95: CHECKING..."
p95=$(curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[1m]))' | jq '.data.result[0].value[1]' 2>/dev/null || echo "0.200")
echo "  P95 response time: ${p95}s (must be < 0.200s)"

# If metrics acceptable, proceed with weight change
echo "  Metrics acceptable, proceeding with weight change..."

aws elbv2 modify-rule \
  --rule-arn $RULE_ARN \
  --actions '[
    {
      "Type": "forward",
      "TargetGroupArn": "'$TARGET_GROUP_ARN_BLUE'",
      "Weight": 100
    }
  ]'

echo "Weight change command executed (100% to blue)"
echo "Waiting for propagation... (15 seconds)"
sleep 15

# Verify weights updated
aws elbv2 describe-rules --rule-arns $RULE_ARN | jq '.Rules[0].ForwardConfig.TargetGroups'

# Expected output:
# [
#   {
#     "TargetGroupArn": "arn:aws:.../blue-prod/...",
#     "Weight": 100
#   }
# ]

echo "Phase 2 complete: $(date)"
echo "All traffic now flowing to blue environment"
```

### Load Balancer Rollback (If Needed)

```bash
#!/bin/bash
# Emergency rollback to green

TARGET_GROUP_ARN_GREEN="arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/green-prod/..."
RULE_ARN="arn:aws:elasticloadbalancing:us-east-1:...:listener-rule/app/prod/..."

echo "=== EMERGENCY ROLLBACK ==="
echo "Rollback initiated: $(date)"
echo "Reason: $1"

# Immediate weight change back to green
aws elbv2 modify-rule \
  --rule-arn $RULE_ARN \
  --actions '[
    {
      "Type": "forward",
      "TargetGroupArn": "'$TARGET_GROUP_ARN_GREEN'",
      "Weight": 100
    }
  ]'

echo "Rollback command executed"
sleep 10

# Verify weights changed
aws elbv2 describe-rules --rule-arns $RULE_ARN | jq '.Rules[0].ForwardConfig.TargetGroups'

echo "Rollback complete: $(date)"
echo "All traffic restored to green environment"
```

---

## HEALTH CHECK PROCEDURES

### Pre-Cutover Health Checks (T+45 to T+50 min)

Run before initiating cutover:

```bash
#!/bin/bash
# Comprehensive pre-cutover health checks

echo "=== PRE-CUTOVER HEALTH CHECKS ==="
echo "Time: $(date)"

HEALTH_CHECKS_PASSED=0
HEALTH_CHECKS_FAILED=0

# Check 1: Blue Application Health
echo -e "\n[1/10] Blue Application Health"
response=$(curl -s -w "\n%{http_code}" http://blue-app:3000/health)
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -eq 200 ]; then
  version=$(echo "$body" | jq -r '.version // "unknown"')
  echo "✓ Blue app responding: HTTP 200 (v$version)"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Blue app not responding: HTTP $http_code"
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 2: Blue Database Health
echo -e "\n[2/10] Blue Database Connectivity"
db_health=$(echo "$body" | jq -r '.database // "unknown"')
if [ "$db_health" = "ok" ]; then
  echo "✓ Blue database connected and healthy"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Blue database issue: $db_health"
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 3: Blue RabbitMQ Health
echo -e "\n[3/10] Blue RabbitMQ Connectivity"
rabbitmq_health=$(echo "$body" | jq -r '.rabbitmq // "unknown"')
if [ "$rabbitmq_health" = "ok" ]; then
  echo "✓ Blue RabbitMQ connected and healthy"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Blue RabbitMQ issue: $rabbitmq_health"
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 4: Blue Redis Health
echo -e "\n[4/10] Blue Redis Connectivity"
redis_health=$(echo "$body" | jq -r '.redis // "unknown"')
if [ "$redis_health" = "ok" ]; then
  echo "✓ Blue Redis connected and healthy"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Blue Redis issue: $redis_health"
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 5: Green Application Health
echo -e "\n[5/10] Green Application Health"
green_response=$(curl -s -w "\n%{http_code}" http://green-app:3000/health)
green_http=$(echo "$green_response" | tail -1)

if [ "$green_http" -eq 200 ]; then
  echo "✓ Green app responding: HTTP 200"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Green app not responding: HTTP $green_http"
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 6: Blue API Endpoints
echo -e "\n[6/10] Blue API Endpoints"
api_endpoints=("/api/agents" "/api/messages" "/api/status")
api_failed=0
for endpoint in "${api_endpoints[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "http://blue-app:3000${endpoint}")
  if [ "$response" -eq 200 ] || [ "$response" -eq 401 ]; then
    echo "  ✓ $endpoint: $response"
  else
    echo "  ✗ $endpoint: $response"
    ((api_failed++))
  fi
done
if [ $api_failed -eq 0 ]; then
  ((HEALTH_CHECKS_PASSED++))
else
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 7: Blue Error Rate
echo -e "\n[7/10] Blue Error Rate"
error_rate=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total%7Binstance=%22blue-app:3000%22,status=~%225..%22%7D%5B1m%5D)' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0.05")
if [ $(echo "$error_rate < 0.01" | bc 2>/dev/null) -eq 1 ] || [ -z "$error_rate" ]; then
  echo "✓ Blue error rate: ${error_rate}% (< 1%)"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Blue error rate: ${error_rate}% (> 1%)"
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 8: Blue Response Time
echo -e "\n[8/10] Blue Response Time P95"
p95=$(curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket%5B1m%5D))' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0.150")
if [ $(echo "$p95 < 0.200" | bc 2>/dev/null) -eq 1 ] || [ -z "$p95" ]; then
  echo "✓ Blue P95 response time: ${p95}s (< 200ms)"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Blue P95 response time: ${p95}s (> 200ms)"
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 9: Load Balancer Configuration
echo -e "\n[9/10] Load Balancer Configuration"
lb_status=$(aws elbv2 describe-target-groups --query 'TargetGroups[*].[TargetGroupName,TargetType]' --output text 2>/dev/null || echo "unknown")
if [ "$lb_status" != "unknown" ]; then
  echo "✓ Load balancer responding"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Load balancer not accessible"
  ((HEALTH_CHECKS_FAILED++))
fi

# Check 10: Database Replication Lag
echo -e "\n[10/10] Database Replication Lag"
repl_lag=$(psql -h blue-db -U postgres -d production -t -c "SELECT EXTRACT(EPOCH FROM NOW() - pg_last_wal_receive_lsn());" 2>/dev/null || echo "999")
if [ $(echo "$repl_lag < 1" | bc 2>/dev/null) -eq 1 ]; then
  echo "✓ Replication lag: ${repl_lag}s (< 1s)"
  ((HEALTH_CHECKS_PASSED++))
else
  echo "✗ Replication lag: ${repl_lag}s (> 1s)"
  ((HEALTH_CHECKS_FAILED++))
fi

# Summary
echo -e "\n=== HEALTH CHECK SUMMARY ==="
echo "Checks Passed: $HEALTH_CHECKS_PASSED/10"
echo "Checks Failed: $HEALTH_CHECKS_FAILED/10"

if [ $HEALTH_CHECKS_FAILED -eq 0 ]; then
  echo "Status: ✓ ALL CHECKS PASSED - READY FOR CUTOVER"
  exit 0
else
  echo "Status: ✗ SOME CHECKS FAILED - DO NOT PROCEED"
  exit 1
fi
```

### During-Cutover Health Monitoring (T+56 to T+65 min)

Real-time monitoring during traffic shift:

```bash
#!/bin/bash
# Real-time monitoring during cutover

DURATION=120  # Monitor for 2 minutes
INTERVAL=5    # Check every 5 seconds
ELAPSED=0

echo "=== CUTOVER MONITORING ==="
echo "Start: $(date)"
echo "Duration: $DURATION seconds"
echo ""

while [ $ELAPSED -lt $DURATION ]; do
  echo "[$(date '+%H:%M:%S')] Cutover Progress: $((ELAPSED * 100 / DURATION))%"

  # Error rate check
  error_rate=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[1m])' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0")
  echo "  Error Rate: $error_rate"

  if [ $(echo "$error_rate > 0.05" | bc 2>/dev/null) -eq 1 ]; then
    echo "  ⚠ WARNING: Error rate elevated!"
  fi

  # Response time check
  p95=$(curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[1m]))' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0.150")
  echo "  P95 Response: ${p95}s"

  if [ $(echo "$p95 > 1" | bc 2>/dev/null) -eq 1 ]; then
    echo "  ⚠ WARNING: Response time degraded!"
  fi

  # CPU/Memory check
  cpu=$(docker stats --no-stream | grep app | awk '{print $3}' 2>/dev/null || echo "0%")
  mem=$(docker stats --no-stream | grep app | awk '{print $7}' 2>/dev/null || echo "0%")
  echo "  Blue App CPU: $cpu Memory: $mem"

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "=== CUTOVER MONITORING COMPLETE ==="
echo "End: $(date)"
```

---

## MONITORING DURING CUTOVER

### Grafana Dashboards to Monitor

1. **Overview Dashboard**
   - Request rate (req/sec)
   - Error rate (%)
   - Response time (P50, P95, P99)

2. **Infrastructure Dashboard**
   - CPU usage per host
   - Memory usage per host
   - Disk I/O
   - Network I/O

3. **Database Dashboard**
   - Connection count
   - Query latency
   - Replication lag
   - Lock count

4. **RabbitMQ Dashboard**
   - Queue depth
   - Message rate
   - Consumer count
   - Connection count

5. **Deployment Dashboard** (custom)
   - Blue vs. Green traffic split (%)
   - Blue vs. Green error rate
   - Health check status
   - Cutover timeline

### Alert Rules Active During Cutover

```yaml
# Alert configuration (Prometheus)
groups:
  - name: deployment_alerts
    rules:
      # Critical: High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[1m]) > 0.05
        for: 1m
        annotations:
          severity: critical
          summary: "Error rate > 5% during deployment"

      # Critical: Response time degradation
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[1m])) > 1
        for: 1m
        annotations:
          severity: critical
          summary: "P95 response time > 1s"

      # Critical: Database connection loss
      - alert: DatabaseConnectionLoss
        expr: pg_up == 0
        for: 30s
        annotations:
          severity: critical
          summary: "Database connection lost"

      # Warning: Memory usage high
      - alert: HighMemoryUsage
        expr: (memory_used_bytes / memory_total_bytes) > 0.85
        for: 2m
        annotations:
          severity: warning
          summary: "Memory usage > 85%"
```

---

## INSTANT ROLLBACK CAPABILITY

### Rollback Decision Criteria

**Automatic Rollback Triggers:**
- Error rate > 10% for > 30 seconds
- Response time P95 > 2 seconds for > 30 seconds
- Database connectivity loss > 10 seconds
- Application crash detected
- Memory exhaustion detected
- CPU throttling detected

**Manual Rollback Reasons:**
- Data corruption detected
- Security incident
- Critical bug identified
- Business decision to rollback
- External system failure

### Rollback Execution (< 2 minutes)

**Step 1: Alert & Notification (10 seconds)**

```bash
#!/bin/bash
# Notify all teams of rollback

echo "ROLLBACK INITIATED: $(date)" | tee /tmp/rollback.log

# PagerDuty alert
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H 'Content-Type: application/json' \
  -d '{
    "routing_key": "YOUR_PAGERDUTY_KEY",
    "event_action": "trigger",
    "payload": {
      "summary": "PRODUCTION ROLLBACK - AI Agent Orchestrator v2.1.0",
      "severity": "critical",
      "source": "deployment-system"
    }
  }'

# Slack notification
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "🚨 PRODUCTION ROLLBACK IN PROGRESS",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*ROLLBACK INITIATED*\nDue to: High error rate during v2.1.0 deployment\nAction: Traffic reverting to v2.0.5"
        }
      }
    ]
  }'

# Status page update
curl -X PATCH https://api.statuspage.io/v1/pages/YOUR_PAGE_ID/incidents \
  -H 'Authorization: OAuth YOUR_TOKEN' \
  -d '{
    "incident": {
      "name": "Deployment Rollback in Progress",
      "status": "investigating",
      "impact_override": "minor"
    }
  }'
```

**Step 2: Load Balancer Rollback (20 seconds)**

```bash
#!/bin/bash
# Immediate traffic shift back to green

RULE_ARN="arn:aws:elasticloadbalancing:us-east-1:...:listener-rule/app/prod/..."
TARGET_GROUP_ARN_GREEN="arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/green-prod/..."

echo "Step 1: Shifting traffic to green..."

aws elbv2 modify-rule \
  --rule-arn $RULE_ARN \
  --actions '[
    {
      "Type": "forward",
      "TargetGroupArn": "'$TARGET_GROUP_ARN_GREEN'",
      "Weight": 100
    }
  ]'

sleep 5

# Verify change
aws elbv2 describe-rules --rule-arns $RULE_ARN | jq '.Rules[0].ForwardConfig.TargetGroups'

echo "Traffic shifted to green: $(date)"
```

**Step 3: Verification (30 seconds)**

```bash
#!/bin/bash
# Verify rollback successful

echo "Step 2: Verifying rollback..."

# Health check
health=$(curl -s http://green-app:3000/health | jq .status)
echo "Green health status: $health"

# Error rate check
error_rate=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[1m])' | jq '.data.result[0].value[1]' || echo "error")
echo "Error rate: $error_rate"

# Verify version
version=$(curl -s http://green-app:3000/health | jq -r .version)
echo "Application version: $version (expected: 2.0.5)"

if [ "$health" = "ok" ] && [ "$version" = "2.0.5" ]; then
  echo "✓ Rollback verified - System operational"
  return 0
else
  echo "✗ Rollback verification FAILED"
  return 1
fi
```

**Step 4: Communication (30 seconds)**

```bash
# Update status page
curl -X PATCH https://api.statuspage.io/v1/pages/YOUR_PAGE_ID/incidents \
  -H 'Authorization: OAuth YOUR_TOKEN' \
  -d '{
    "incident": {
      "status": "resolved",
      "body": "Deployment v2.1.0 has been rolled back. Service fully operational on v2.0.5."
    }
  }'

# Slack update
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -d '{"text": "✓ Rollback completed - Service restored to v2.0.5"}'
```

---

## DNS/LOAD BALANCER CHANGES

### Change Summary Table

```
┌──────────────┬─────────────┬──────────────┬──────────────────────┐
│ Component    │ Current (G) │ Target (B)   │ Method               │
├──────────────┼─────────────┼──────────────┼──────────────────────┤
│ DNS          │ green IP    │ blue IP      │ nsupdate (if used)   │
│ ALB Weight   │ 100%        │ 0%           │ aws elbv2 modify     │
│ Traffic      │ 100%        │ 0%           │ Automatic            │
│ Sticky Sess. │ Enabled     │ -            │ Drain on timeout     │
│ Connection   │ Active      │ New          │ 30s drain timeout    │
│ DB           │ Master      │ Replica      │ No change needed     │
└──────────────┴─────────────┴──────────────┴──────────────────────┘
```

### Connection Draining Configuration

```bash
# Configure connection draining for graceful shift
aws elbv2 modify-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/green-prod/... \
  --attributes \
    Key=deregistration_delay.timeout_seconds,Value=30 \
    Key=deregistration_delay.connection_termination.enabled,Value=true

# Expected: Old connections drain over 30 seconds
# New connections route to blue
```

### Session Handling

```bash
# Check current session affinity setting
aws elbv2 describe-target-group-attributes \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/green-prod/...

# Expected:
# "Key": "stickiness.enabled"
# "Value": "false"

# If stickiness enabled, users may stick to green during cutover
# This is OK - they'll eventually timeout and reconnect to blue
```

---

## CUTOVER EXECUTION TIMELINE

### Detailed Minute-by-Minute Timeline

```
T+45min: PRE-CUTOVER HEALTH CHECKS
         ├─ Run health check dashboard
         ├─ Verify blue environment: ✓
         ├─ Verify green environment: ✓
         ├─ Verify monitoring: ✓
         └─ Decision: GO for cutover

T+50min: TEAM BRIEFING & DECISION GATE
         ├─ Team assembled and ready
         ├─ Communication channels active
         ├─ Deployment lead final approval
         └─ Cutover window officially open

T+51min: PREPARE LOAD BALANCER
         ├─ Connect to AWS/ALB console
         ├─ Verify current weights (Green: 100%, Blue: 0%)
         ├─ Prepare weight modification commands
         └─ Ready to shift traffic

T+52min: PREPARE MONITORING
         ├─ Grafana dashboard open (auto-refresh 5s)
         ├─ Prometheus queries ready
         ├─ Alert rules active
         ├─ Logs streaming to terminal
         ├─ Slack channel monitored
         └─ Everyone watching dashboards

T+53min: EXECUTE 50% SHIFT
         ├─ Execute: aws elbv2 modify-rule (50/50 split)
         ├─ Wait 5 seconds for propagation
         ├─ Verify weights updated: Green 50%, Blue 50%
         ├─ Monitor metrics: error rate, P95, CPU, memory
         ├─ Duration: Monitor for 60 seconds
         └─ Metrics must remain healthy

T+54min: MONITOR 50% SPLIT
         ├─ Error rate: MONITOR (must stay < 1%)
         ├─ Response time: MONITOR (must stay < 200ms P95)
         ├─ CPU/Memory: MONITOR (must stay < 80%)
         ├─ Logs: MONITOR (no new errors)
         ├─ Team: READY to rollback if needed
         └─ At 60 seconds: Approve for 100% shift

T+55min: EXECUTE 100% SHIFT
         ├─ Team decision: GO for 100% shift
         ├─ Execute: aws elbv2 modify-rule (0/100 split)
         ├─ Wait 5 seconds for propagation
         ├─ Verify weights: Green 0%, Blue 100%
         ├─ All traffic now on blue
         └─ Closely monitor for anomalies

T+56min: INTENSIVE MONITORING
         ├─ Monitor error rate (CRITICAL)
         ├─ Monitor P95 response time (CRITICAL)
         ├─ Monitor database connections (WARNING)
         ├─ Monitor queue depths (WARNING)
         ├─ Monitor memory usage (WARNING)
         ├─ Check logs for new errors
         ├─ Duration: 120 seconds
         └─ Ready to rollback immediately

T+58min: CUTOVER COMPLETE
         ├─ Verify traffic 100% on blue
         ├─ Verify error rate: < 0.1%
         ├─ Verify response time: < 200ms P95
         ├─ Verify no anomalies detected
         ├─ Update status page: "Deployment successful"
         ├─ Slack notification: "Traffic cutover complete"
         └─ Handoff to monitoring

T+59min: CONTINUE MONITORING
         ├─ Monitor for 60 more minutes
         ├─ Check for memory leaks (trend analysis)
         ├─ Verify business metrics stable
         ├─ Verify cache hit rates normal
         ├─ Ready to escalate if issues
         └─ Periodic status updates to team

T+65min: EXTENDED MONITORING
         ├─ Verify system stable for 10 minutes
         ├─ Check database replication lag
         ├─ Verify RabbitMQ queue processing
         ├─ Check external API integrations
         └─ System operating normally

T+90min: DEPLOYMENT COMPLETE
         ├─ Post-deployment validation passed
         ├─ All SLA metrics met
         ├─ Team sign-off obtained
         ├─ Green environment deprecated
         └─ Deployment officially closed
```

---

## COMMON ISSUES & SOLUTIONS

### Issue 1: High Error Rate Post-Cutover

**Symptom:** Error rate jumps to 5%+ after traffic shift

**Investigation:**
```bash
# Check blue application logs
docker logs blue-app | grep -i "error" | tail -50

# Check database connection count
psql -h blue-db -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check RabbitMQ queue status
curl -s -u guest:guest http://blue-rabbitmq:15672/api/queues | jq '.[] | {name, messages}'

# Check error tracking system
curl http://sentry.internal/api/projects/1/events/?query=is%3Aunresolved | jq '.[] | {title, count}'
```

**Solution:**
1. Execute immediate rollback
2. Investigate root cause in pre-deployment testing
3. Fix issue and redeploy

---

### Issue 2: Response Time Degradation

**Symptom:** P95 response time increases from 150ms to 500ms+

**Investigation:**
```bash
# Check database query performance
psql -h blue-db -U postgres -d production -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check cache hit rate
redis-cli -h blue-redis INFO stats | grep "keyspace_hits\|keyspace_misses"

# Check CPU usage
docker stats blue-app --no-stream

# Check active connections
netstat -an | grep ESTABLISHED | wc -l
```

**Solution:**
1. If issue critical: Rollback immediately
2. If issue minor: Optimize problematic query/cache
3. Monitor closely for improvement

---

### Issue 3: Database Replication Lag

**Symptom:** Replication lag increases to 5+ seconds

**Investigation:**
```bash
# Check replication status
psql -h blue-db -U postgres -c "SELECT * FROM pg_stat_replication;"

# Check WAL activity
psql -h blue-db -U postgres -c "SELECT * FROM pg_stat_wal_receiver;"

# Check slow queries on green
psql -h green-db -U postgres -d production -c "SELECT query, calls, mean_time FROM pg_stat_statements WHERE mean_time > 100 ORDER BY calls DESC LIMIT 10;"
```

**Solution:**
1. Increase available resources (CPU/RAM) for replication
2. Optimize slow queries causing lag
3. If unresolvable: Rollback

---

### Issue 4: Memory Leak Detected

**Symptom:** Memory usage increases steadily over time

**Investigation:**
```bash
# Monitor memory trend
watch -n 5 'docker stats blue-app --no-stream | grep blue-app'

# Check for connection leaks
psql -h blue-db -U postgres -d production -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Check Node.js heap
curl http://blue-app:3000/debug/heap | jq '.heap_used, .heap_limit'
```

**Solution:**
1. Identify memory leak source (code review, profiling)
2. If memory nearing limit: Restart application
3. Implement fix and redeploy

---

## POST-CUTOVER VALIDATION

### Immediate Validation (T+65 to T+75 min)

```bash
#!/bin/bash
# Post-cutover validation checks

echo "=== POST-CUTOVER VALIDATION ==="
echo "Start time: $(date)"

# 1. Traffic verification
traffic=$(aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/blue-prod/... | jq '.TargetHealthDescriptions | length')
echo "✓ Blue targets: $traffic"

# 2. Error rate
error_rate=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[1m])' | jq '.data.result[0].value[1]')
echo "✓ Error rate: $error_rate"

# 3. Response time
p95=$(curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[1m]))' | jq '.data.result[0].value[1]')
echo "✓ P95 Response: ${p95}s"

# 4. Database health
db_connections=$(psql -h blue-db -U postgres -t -c "SELECT count(*) FROM pg_stat_activity;")
echo "✓ DB connections: $db_connections"

# 5. RabbitMQ health
queue_depth=$(curl -s -u guest:guest http://blue-rabbitmq:15672/api/queues | jq '.[] | .messages' | awk '{sum+=$1} END {print sum}')
echo "✓ Queue depth: $queue_depth"

# 6. Cache hit rate
cache_hits=$(redis-cli -h blue-redis INFO stats | grep "keyspace_hits" | cut -d: -f2)
echo "✓ Cache hits: $cache_hits"

echo "=== VALIDATION COMPLETE ==="
```

### Extended Validation (T+75 to T+90 min)

- [ ] Run full smoke test suite
- [ ] Verify all critical features
- [ ] Check data consistency
- [ ] Monitor resource usage (trends)
- [ ] Verify external integrations
- [ ] Check business metrics
- [ ] Final team sign-off

---

**Document prepared by:** _______________________
**Date:** _______________________
**Approved by:** _______________________

---

*This is a CONTROLLED DOCUMENT. Updates require authorization.*
*For questions or updates: production-team@company.com*
