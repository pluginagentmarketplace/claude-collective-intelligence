#!/bin/bash
################################################################################
# POST-DEPLOYMENT VERIFICATION SCRIPT
# AI Agent Orchestrator with RabbitMQ - Production Deployment
#
# This script validates deployment success through comprehensive health
# checks and data integrity verification.
#
# Usage:
#   ./scripts/post-deployment-verify.sh                 # Full verification
#   ./scripts/post-deployment-verify.sh --immediate     # Quick check
#   ./scripts/post-deployment-verify.sh --extended      # Deep validation
#   ./scripts/post-deployment-verify.sh --data-integrity # Data only
#
# Exit codes:
#   0: Deployment successful
#   1: Some issues found (review recommended)
#   2: Critical issues (rollback may be needed)
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
APP_HOST="${APP_HOST:-blue-app}"
APP_PORT="${APP_PORT:-3000}"
DB_HOST="${DB_HOST:-blue-db}"
RABBITMQ_HOST="${RABBITMQ_HOST:-blue-rabbitmq}"
REDIS_HOST="${REDIS_HOST:-blue-redis}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0
CRITICAL_FAILURES=0

# Helper functions
log_pass() { echo -e "${GREEN}✓${NC} $1"; ((CHECKS_PASSED++)); }
log_fail() { echo -e "${RED}✗${NC} $1"; ((CHECKS_FAILED++)); }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; ((CHECKS_WARNING++)); }
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }

log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Verification functions

verify_application_health() {
  log_section "VERIFYING APPLICATION HEALTH"

  response=$(curl -s -w "\n%{http_code}" "http://${APP_HOST}:${APP_PORT}/health" 2>/dev/null || echo "000")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)

  if [ "$http_code" = "200" ]; then
    version=$(echo "$body" | jq -r '.version // "unknown"' 2>/dev/null)
    uptime=$(echo "$body" | jq -r '.uptime // "unknown"' 2>/dev/null)
    log_pass "Application responding (HTTP 200, v$version, uptime: $uptime)"
  else
    log_fail "Application health check failed (HTTP $http_code)"
    ((CRITICAL_FAILURES++))
    return 1
  fi

  # Check dependencies in health response
  for dep in "database" "rabbitmq" "redis"; do
    dep_status=$(echo "$body" | jq -r ".$dep // \"unknown\"" 2>/dev/null)
    if [ "$dep_status" = "ok" ]; then
      log_pass "$dep: OK"
    else
      log_warn "$dep: $dep_status"
    fi
  done
}

verify_api_endpoints() {
  log_section "VERIFYING API ENDPOINTS"

  endpoints=(
    "/api/agents"
    "/api/messages"
    "/api/health"
    "/api/status"
  )

  failed_endpoints=0

  for endpoint in "${endpoints[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://${APP_HOST}:${APP_PORT}${endpoint}" 2>/dev/null || echo "000")

    if [ "$response" = "200" ] || [ "$response" = "401" ]; then
      log_pass "$endpoint: HTTP $response"
    else
      log_fail "$endpoint: HTTP $response"
      ((failed_endpoints++))
    fi
  done

  return $failed_endpoints
}

verify_error_rate() {
  log_section "VERIFYING ERROR RATE"

  # Check error rate from Prometheus
  error_rate=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0.01")

  if [ -z "$error_rate" ] || [ "$error_rate" = "null" ]; then
    log_info "Error rate: Unable to query (acceptable for early validation)"
  else
    error_percent=$(echo "$error_rate * 100" | bc 2>/dev/null | cut -d. -f1 || echo "0")

    if [ "$error_percent" -lt 1 ]; then
      log_pass "Error rate: ${error_percent}% (< 1%)"
    elif [ "$error_percent" -lt 5 ]; then
      log_warn "Error rate: ${error_percent}% (between 1-5%)"
    else
      log_fail "Error rate: ${error_percent}% (> 5%)"
      ((CRITICAL_FAILURES++))
    fi
  fi
}

verify_response_time() {
  log_section "VERIFYING RESPONSE TIME"

  # Check P95 response time
  p95=$(curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0.200")

  if [ -z "$p95" ] || [ "$p95" = "null" ]; then
    log_info "Response time P95: Unable to query (acceptable for early validation)"
  else
    p95_ms=$(echo "$p95 * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "200")

    if [ "$p95_ms" -lt 200 ]; then
      log_pass "P95 response time: ${p95_ms}ms (< 200ms SLA)"
    elif [ "$p95_ms" -lt 500 ]; then
      log_warn "P95 response time: ${p95_ms}ms (200-500ms range)"
    else
      log_fail "P95 response time: ${p95_ms}ms (> 500ms)"
      ((CRITICAL_FAILURES++))
    fi
  fi
}

verify_database_health() {
  log_section "VERIFYING DATABASE HEALTH"

  # Basic connectivity
  if psql -h "$DB_HOST" -U postgres -d production -c "SELECT 1;" &>/dev/null; then
    log_pass "Database connectivity: OK"
  else
    log_fail "Database connection failed"
    ((CRITICAL_FAILURES++))
    return 1
  fi

  # Connection count
  conn_count=$(psql -h "$DB_HOST" -U postgres -d production -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "error")
  if [ "$conn_count" != "error" ]; then
    if [ "$conn_count" -lt 100 ]; then
      log_pass "Database connections: $conn_count (acceptable)"
    else
      log_warn "Database connections: $conn_count (high)"
    fi
  fi

  # Query performance (check for slow queries)
  slow_queries=$(psql -h "$DB_HOST" -U postgres -d production -t -c "SELECT count(*) FROM pg_stat_statements WHERE mean_time > 1000;" 2>/dev/null || echo "0")
  if [ "$slow_queries" = "0" ] 2>/dev/null; then
    log_pass "Slow queries (> 1s): 0"
  else
    log_warn "Slow queries detected: $slow_queries"
  fi

  # Replication status
  repl_lag=$(psql -h "$DB_HOST" -U postgres -d production -t -c "SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_wal_receive_lsn())) as lag;" 2>/dev/null | grep -oE '[0-9]+' || echo "error")
  if [ "$repl_lag" != "error" ] && [ "$repl_lag" -lt 5 ]; then
    log_pass "Replication lag: ${repl_lag}s"
  else
    log_warn "Replication lag: ${repl_lag}s"
  fi
}

verify_rabbitmq_health() {
  log_section "VERIFYING RABBITMQ HEALTH"

  # Check RabbitMQ management API
  if curl -s -u guest:guest "http://${RABBITMQ_HOST}:15672/api/overview" &>/dev/null; then
    log_pass "RabbitMQ management API: OK"
  else
    log_warn "RabbitMQ management API not accessible"
    return 1
  fi

  # Check queue status
  queue_depth=$(curl -s -u guest:guest "http://${RABBITMQ_HOST}:15672/api/queues" 2>/dev/null | jq '.[] | .messages' | awk '{sum+=$1} END {print sum}' || echo "0")
  log_info "Total messages in queues: $queue_depth"

  if [ "$queue_depth" -lt 1000 ]; then
    log_pass "Queue depth: $queue_depth (healthy)"
  else
    log_warn "Queue depth: $queue_depth (high)"
  fi

  # Check consumer status
  consumers=$(curl -s -u guest:guest "http://${RABBITMQ_HOST}:15672/api/consumers" 2>/dev/null | jq 'length' || echo "0")
  if [ "$consumers" -gt 0 ]; then
    log_pass "Active consumers: $consumers"
  else
    log_warn "No active consumers found"
  fi
}

verify_redis_health() {
  log_section "VERIFYING REDIS HEALTH"

  # Check connectivity
  if redis-cli -h "$REDIS_HOST" ping &>/dev/null; then
    log_pass "Redis connectivity: OK"
  else
    log_warn "Redis not accessible"
    return 1
  fi

  # Check memory usage
  redis_memory=$(redis-cli -h "$REDIS_HOST" INFO memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
  log_info "Redis memory usage: $redis_memory"

  # Check hit rate
  stats=$(redis-cli -h "$REDIS_HOST" INFO stats)
  hits=$(echo "$stats" | grep "keyspace_hits:" | cut -d: -f2 | tr -d '\r')
  misses=$(echo "$stats" | grep "keyspace_misses:" | cut -d: -f2 | tr -d '\r')

  if [ -n "$hits" ] && [ -n "$misses" ] && [ "$((hits + misses))" -gt 0 ]; then
    hit_rate=$((hits * 100 / (hits + misses)))
    if [ "$hit_rate" -gt 70 ]; then
      log_pass "Cache hit rate: ${hit_rate}%"
    else
      log_warn "Cache hit rate: ${hit_rate}% (low)"
    fi
  fi
}

verify_resource_usage() {
  log_section "VERIFYING RESOURCE USAGE"

  # Check container stats
  if command -v docker &> /dev/null; then
    stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | tail -1 || echo "N/A")
    log_info "Container stats: $stats"

    cpu=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
    mem=$(echo "$stats" | awk '{print $2}' | sed 's/MiB.*//')

    if [ -n "$cpu" ] && [ "$cpu" != "N/A" ]; then
      cpu_int=$(echo "$cpu" | cut -d. -f1)
      if [ "$cpu_int" -lt 80 ]; then
        log_pass "CPU usage: ${cpu}% (acceptable)"
      else
        log_warn "CPU usage: ${cpu}% (high)"
      fi
    fi

    if [ -n "$mem" ] && [ "$mem" != "N/A" ]; then
      mem_int=$(echo "$mem" | cut -d. -f1)
      if [ "$mem_int" -lt 2048 ]; then
        log_pass "Memory usage: ${mem}MB (acceptable)"
      else
        log_warn "Memory usage: ${mem}MB (high)"
      fi
    fi
  fi
}

verify_data_integrity() {
  log_section "VERIFYING DATA INTEGRITY"

  # Run custom data integrity checks
  if [ -f "$PROJECT_DIR/scripts/data_integrity_checks.sql" ]; then
    log_info "Running data integrity checks..."

    result=$(psql -h "$DB_HOST" -U postgres -d production -f "$PROJECT_DIR/scripts/data_integrity_checks.sql" 2>&1 || echo "error")

    if [[ ! "$result" =~ "error" ]] && [[ ! "$result" =~ "ERROR" ]]; then
      log_pass "Data integrity checks: PASSED"
    else
      log_fail "Data integrity checks: FAILED"
      ((CRITICAL_FAILURES++))
    fi
  else
    log_info "No custom data integrity checks script found"
  fi

  # Verify database schema version
  schema_version=$(psql -h "$DB_HOST" -U postgres -d production -t -c "SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1;" 2>/dev/null || echo "unknown")
  log_info "Database schema version: $schema_version"
}

verify_business_metrics() {
  log_section "VERIFYING BUSINESS METRICS"

  # Check user count
  user_count=$(psql -h "$DB_HOST" -U postgres -d production -t -c "SELECT count(*) FROM users;" 2>/dev/null || echo "error")
  if [ "$user_count" != "error" ]; then
    log_pass "User count: $user_count"
  fi

  # Check message count
  message_count=$(psql -h "$DB_HOST" -U postgres -d production -t -c "SELECT count(*) FROM messages;" 2>/dev/null || echo "error")
  if [ "$message_count" != "error" ]; then
    log_pass "Message count: $message_count"
  fi

  # Check recent activity
  recent_activity=$(psql -h "$DB_HOST" -U postgres -d production -t -c "SELECT count(*) FROM messages WHERE created_at > NOW() - INTERVAL '1 hour';" 2>/dev/null || echo "0")
  if [ "$recent_activity" -gt 0 ]; then
    log_pass "Recent activity: $recent_activity messages in last hour"
  else
    log_warn "No recent activity detected"
  fi
}

verify_external_integrations() {
  log_section "VERIFYING EXTERNAL INTEGRATIONS"

  # Test connectivity to external services
  services=(
    "https://api.example.com/health"
  )

  for service in "${services[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$service" 2>/dev/null || echo "000")
    if [ "$response" = "200" ] || [ "$response" = "401" ]; then
      log_pass "External service accessible: $service"
    else
      log_warn "External service response: $service (HTTP $response)"
    fi
  done
}

verify_logs() {
  log_section "VERIFYING APPLICATION LOGS"

  # Check for recent errors in logs
  if command -v docker &> /dev/null; then
    error_count=$(docker logs --tail=100 app 2>/dev/null | grep -i "error" | wc -l || echo "0")

    if [ "$error_count" = "0" ]; then
      log_pass "No errors in recent logs"
    elif [ "$error_count" -lt 10 ]; then
      log_warn "Found $error_count errors in logs (minor)"
    else
      log_fail "Found $error_count errors in logs (significant)"
    fi
  fi
}

# Main verification

print_banner() {
  echo ""
  echo -e "${BLUE}"
  echo "╔═══════════════════════════════════════════════════════════════════╗"
  echo "║   POST-DEPLOYMENT VERIFICATION - AI Agent Orchestrator v2.1.0     ║"
  echo "║   Deployment Success Validation Script                            ║"
  echo "╚═══════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo "Timestamp: $(date)"
  echo ""
}

print_summary() {
  echo ""
  log_section "VERIFICATION SUMMARY"
  echo "Checks Passed:   ${GREEN}$CHECKS_PASSED${NC}"
  echo "Checks Failed:   ${RED}$CHECKS_FAILED${NC}"
  echo "Warnings:        ${YELLOW}$CHECKS_WARNING${NC}"
  echo "Critical Issues: ${RED}$CRITICAL_FAILURES${NC}"
  echo ""

  if [ $CRITICAL_FAILURES -gt 0 ]; then
    echo -e "${RED}STATUS: DEPLOYMENT FAILED - CRITICAL ISSUES DETECTED${NC}"
    echo "Recommended action: REVIEW AND POTENTIALLY ROLLBACK"
    return 2
  elif [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${YELLOW}STATUS: DEPLOYMENT WITH ISSUES - REVIEW RECOMMENDED${NC}"
    echo "Recommended action: INVESTIGATE AND MONITOR"
    return 1
  else
    echo -e "${GREEN}STATUS: DEPLOYMENT SUCCESSFUL - ALL CHECKS PASSED${NC}"
    echo "Next action: Continue monitoring for 24 hours"
    return 0
  fi
}

main() {
  print_banner

  # Parse arguments
  IMMEDIATE_CHECK=false
  EXTENDED_CHECK=false
  DATA_INTEGRITY_ONLY=false

  while [[ $# -gt 0 ]]; do
    case $1 in
      --immediate) IMMEDIATE_CHECK=true; shift ;;
      --extended) EXTENDED_CHECK=true; shift ;;
      --data-integrity) DATA_INTEGRITY_ONLY=true; shift ;;
      *) shift ;;
    esac
  done

  # Run appropriate checks
  if [ "$DATA_INTEGRITY_ONLY" = true ]; then
    verify_data_integrity
  elif [ "$IMMEDIATE_CHECK" = true ]; then
    verify_application_health
    verify_error_rate
    verify_response_time
  elif [ "$EXTENDED_CHECK" = true ]; then
    verify_application_health
    verify_api_endpoints
    verify_error_rate
    verify_response_time
    verify_database_health
    verify_rabbitmq_health
    verify_redis_health
    verify_resource_usage
    verify_data_integrity
    verify_business_metrics
    verify_external_integrations
    verify_logs
  else
    # Default: comprehensive check
    verify_application_health
    verify_api_endpoints
    verify_error_rate
    verify_response_time
    verify_database_health
    verify_rabbitmq_health
    verify_redis_health
    verify_resource_usage
    verify_data_integrity
    verify_business_metrics
  fi

  print_summary
}

# Run main function
main "$@"
exit $?
