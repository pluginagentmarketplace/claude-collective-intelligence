#!/bin/bash
################################################################################
# HEALTH CHECK DASHBOARD SCRIPT
# AI Agent Orchestrator with RabbitMQ - Real-Time Monitoring
#
# This script provides a real-time health check dashboard for monitoring
# application status during deployment.
#
# Usage:
#   ./scripts/health-check-dashboard.sh              # Monitor current env
#   ./scripts/health-check-dashboard.sh --environment=blue
#   ./scripts/health-check-dashboard.sh --continuous # Continuous mode
#   ./scripts/health-check-dashboard.sh --interval=5 # 5-second refresh
#
# Exit codes:
#   0: All checks passed
#   1: Some checks failed
#   2: Critical checks failed
################################################################################

set -euo pipefail

# Configuration
ENVIRONMENT="${ENVIRONMENT:-blue}"
APP_PORT="${APP_PORT:-3000}"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-10}"
CONTINUOUS_MODE=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Helper functions

format_duration() {
  local seconds=$1
  local days=$((seconds / 86400))
  local hours=$(((seconds % 86400) / 3600))
  local minutes=$(((seconds % 3600) / 60))
  local secs=$((seconds % 60))

  if [ $days -gt 0 ]; then
    echo "${days}d ${hours}h ${minutes}m"
  elif [ $hours -gt 0 ]; then
    echo "${hours}h ${minutes}m ${secs}s"
  else
    echo "${minutes}m ${secs}s"
  fi
}

format_memory() {
  local bytes=$1
  if [ "$bytes" -lt 1024 ]; then
    echo "${bytes}B"
  elif [ "$bytes" -lt 1048576 ]; then
    echo "$((bytes / 1024))KB"
  else
    echo "$((bytes / 1048576))MB"
  fi
}

get_status_color() {
  local value=$1
  local threshold_warn=$2
  local threshold_crit=$3

  if [ "$(echo "$value < $threshold_crit" | bc 2>/dev/null)" -eq 1 ]; then
    echo -e "${GREEN}✓${NC}"
  elif [ "$(echo "$value < $threshold_warn" | bc 2>/dev/null)" -eq 1 ]; then
    echo -e "${YELLOW}⚠${NC}"
  else
    echo -e "${RED}✗${NC}"
  fi
}

clear_screen() {
  clear || printf "\033[2J\033[0;0H"
}

print_header() {
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE} HEALTH CHECK DASHBOARD - $ENVIRONMENT Environment${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
}

print_section_header() {
  local title=$1
  echo ""
  echo -e "${CYAN}▶ $title${NC}"
  echo -e "${CYAN}─────────────────────────────────────────────────────────────────${NC}"
}

# Health check functions

check_application_health() {
  print_section_header "APPLICATION HEALTH"

  local host="${ENVIRONMENT}-app"
  local response=$(curl -s -w "\n%{http_code}" "http://${host}:${APP_PORT}/health" 2>/dev/null || echo "000")
  local http_code=$(echo "$response" | tail -1)
  local body=$(echo "$response" | head -n -1)

  if [ "$http_code" = "200" ]; then
    local version=$(echo "$body" | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown")
    local status=$(echo "$body" | jq -r '.status // "unknown"' 2>/dev/null)
    local uptime=$(echo "$body" | jq -r '.uptime // 0' 2>/dev/null)

    echo -e "  Status:      $(echo -e "${GREEN}✓ HEALTHY${NC}")"
    echo -e "  Version:     ${CYAN}v${version}${NC}"
    echo -e "  HTTP Code:   ${GREEN}${http_code}${NC}"

    if [ "$uptime" != "0" ] && [ "$uptime" != "null" ]; then
      local uptime_str=$(format_duration "$uptime")
      echo -e "  Uptime:      ${CYAN}${uptime_str}${NC}"
    fi

    return 0
  else
    echo -e "  Status:      $(echo -e "${RED}✗ UNHEALTHY${NC}")"
    echo -e "  HTTP Code:   ${RED}${http_code}${NC}"
    echo -e "  Message:     ${RED}Application not responding${NC}"
    return 1
  fi
}

check_database_status() {
  print_section_header "DATABASE STATUS"

  local host="${ENVIRONMENT}-db"
  local body=$(curl -s -w "\n%{http_code}" "http://${ENVIRONMENT}-app:${APP_PORT}/health" 2>/dev/null | head -n -1)
  local db_status=$(echo "$body" | jq -r '.database // "unknown"' 2>/dev/null || echo "unknown")

  if [ "$db_status" = "ok" ]; then
    echo -e "  Status:      $(echo -e "${GREEN}✓ CONNECTED${NC}")"

    # Try to get connection count
    local conn_count=$(psql -h "$host" -U postgres -d production -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "N/A")
    echo -e "  Connections: ${CYAN}${conn_count}${NC}"

    # Try to get database size
    local db_size=$(psql -h "$host" -U postgres -d production -t -c "SELECT pg_size_pretty(pg_database_size('production'));" 2>/dev/null || echo "N/A")
    echo -e "  Size:        ${CYAN}${db_size}${NC}"

    return 0
  else
    echo -e "  Status:      $(echo -e "${RED}✗ CONNECTION FAILED${NC}")"
    echo -e "  Message:     ${RED}${db_status}${NC}"
    return 1
  fi
}

check_rabbitmq_status() {
  print_section_header "RABBITMQ STATUS"

  local host="${ENVIRONMENT}-rabbitmq"
  local body=$(curl -s -w "\n%{http_code}" "http://${ENVIRONMENT}-app:${APP_PORT}/health" 2>/dev/null | head -n -1)
  local rabbitmq_status=$(echo "$body" | jq -r '.rabbitmq // "unknown"' 2>/dev/null || echo "unknown")

  if [ "$rabbitmq_status" = "ok" ]; then
    echo -e "  Status:      $(echo -e "${GREEN}✓ CONNECTED${NC}")"

    # Try to get queue stats
    local queue_depth=$(curl -s -u guest:guest "http://${host}:15672/api/queues" 2>/dev/null | jq '.[] | .messages' 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
    echo -e "  Queue Depth: ${CYAN}${queue_depth}${NC} messages"

    # Try to get consumer count
    local consumers=$(curl -s -u guest:guest "http://${host}:15672/api/consumers" 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
    echo -e "  Consumers:   ${CYAN}${consumers}${NC}"

    return 0
  else
    echo -e "  Status:      $(echo -e "${YELLOW}⚠ UNAVAILABLE${NC}")"
    echo -e "  Message:     ${YELLOW}${rabbitmq_status}${NC}"
    return 0  # Not critical
  fi
}

check_redis_status() {
  print_section_header "REDIS STATUS"

  local host="${ENVIRONMENT}-redis"
  local body=$(curl -s -w "\n%{http_code}" "http://${ENVIRONMENT}-app:${APP_PORT}/health" 2>/dev/null | head -n -1)
  local redis_status=$(echo "$body" | jq -r '.redis // "unknown"' 2>/dev/null || echo "unknown")

  if [ "$redis_status" = "ok" ]; then
    echo -e "  Status:      $(echo -e "${GREEN}✓ CONNECTED${NC}")"

    # Try to get memory info
    local memory=$(redis-cli -h "$host" INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r' || echo "N/A")
    echo -e "  Memory:      ${CYAN}${memory}${NC}"

    # Try to get hit rate
    local stats=$(redis-cli -h "$host" INFO stats 2>/dev/null)
    local hits=$(echo "$stats" | grep "keyspace_hits:" | cut -d: -f2 | tr -d '\r' || echo "0")
    local misses=$(echo "$stats" | grep "keyspace_misses:" | cut -d: -f2 | tr -d '\r' || echo "0")

    if [ "$((hits + misses))" -gt 0 ]; then
      local hit_rate=$((hits * 100 / (hits + misses)))
      echo -e "  Hit Rate:    ${CYAN}${hit_rate}%${NC}"
    fi

    return 0
  else
    echo -e "  Status:      $(echo -e "${YELLOW}⚠ UNAVAILABLE${NC}")"
    echo -e "  Message:     ${YELLOW}${redis_status}${NC}"
    return 0  # Not critical
  fi
}

check_api_endpoints() {
  print_section_header "API ENDPOINTS"

  local endpoints=(
    "/api/agents:200"
    "/api/messages:200"
    "/api/status:200"
    "/api/health:200"
  )

  local failed=0

  for endpoint_spec in "${endpoints[@]}"; do
    local endpoint=$(echo "$endpoint_spec" | cut -d: -f1)
    local expected_code=$(echo "$endpoint_spec" | cut -d: -f2)
    local response=$(curl -s -o /dev/null -w "%{http_code}" "http://${ENVIRONMENT}-app:${APP_PORT}${endpoint}" 2>/dev/null || echo "000")

    if [ "$response" = "$expected_code" ]; then
      echo -e "  ${GREEN}✓${NC} $endpoint (HTTP $response)"
    else
      echo -e "  ${RED}✗${NC} $endpoint (HTTP $response, expected $expected_code)"
      ((failed++))
    fi
  done

  return $failed
}

check_performance_metrics() {
  print_section_header "PERFORMANCE METRICS"

  # Error rate
  local error_rate=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[1m])' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0.001")

  if [ -z "$error_rate" ] || [ "$error_rate" = "null" ]; then
    echo -e "  Error Rate:  ${CYAN}N/A${NC}"
  else
    local error_pct=$(echo "$error_rate * 100" | bc 2>/dev/null | cut -d. -f1 || echo "0")
    if [ "$error_pct" -lt 1 ]; then
      echo -e "  Error Rate:  $(echo -e "${GREEN}✓ ${error_pct}%${NC}")"
    else
      echo -e "  Error Rate:  $(echo -e "${YELLOW}⚠ ${error_pct}%${NC}")"
    fi
  fi

  # Response time P95
  local p95=$(curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[1m]))' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0.200")

  if [ -z "$p95" ] || [ "$p95" = "null" ]; then
    echo -e "  P95 Response:${CYAN}N/A${NC}"
  else
    local p95_ms=$(echo "$p95 * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "200")
    if [ "$p95_ms" -lt 200 ]; then
      echo -e "  P95 Response:$(echo -e " ${GREEN}✓ ${p95_ms}ms${NC}")"
    else
      echo -e "  P95 Response:$(echo -e " ${YELLOW}⚠ ${p95_ms}ms${NC}")"
    fi
  fi

  # Request rate
  local req_rate=$(curl -s 'http://prometheus:9090/api/v1/query?query=rate(http_requests_total[1m])' 2>/dev/null | jq '.data.result[0].value[1]' 2>/dev/null || echo "0")

  if [ -z "$req_rate" ] || [ "$req_rate" = "null" ]; then
    echo -e "  Request Rate:${CYAN}N/A${NC}"
  else
    local req_per_sec=$(echo "$req_rate" | cut -d. -f1)
    echo -e "  Request Rate:${CYAN}${req_per_sec} req/s${NC}"
  fi
}

check_container_stats() {
  print_section_header "CONTAINER STATS"

  if ! command -v docker &> /dev/null; then
    echo -e "  ${YELLOW}Docker not available${NC}"
    return 0
  fi

  local stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | tail -1 || echo "N/A")
  local cpu=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
  local mem=$(echo "$stats" | awk '{print $2}' | sed 's/MiB.*//')

  if [ "$cpu" != "N/A" ] && [ -n "$cpu" ]; then
    local cpu_int=$(echo "$cpu" | cut -d. -f1)
    if [ "$cpu_int" -lt 80 ]; then
      echo -e "  CPU Usage:   ${GREEN}✓ ${cpu}${NC}"
    else
      echo -e "  CPU Usage:   ${YELLOW}⚠ ${cpu}${NC}"
    fi
  fi

  if [ "$mem" != "N/A" ] && [ -n "$mem" ]; then
    local mem_int=$(echo "$mem" | cut -d. -f1)
    if [ "$mem_int" -lt 2048 ]; then
      echo -e "  Memory Usage:${GREEN}✓ ${mem}MB${NC}"
    else
      echo -e "  Memory Usage:${YELLOW}⚠ ${mem}MB${NC}"
    fi
  fi
}

print_footer() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
  echo "Next refresh: $(date -d "+${REFRESH_INTERVAL} seconds" '+%H:%M:%S' 2>/dev/null || echo 'in ${REFRESH_INTERVAL}s')"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
}

# Main execution

main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --environment=*) ENVIRONMENT="${1#*=}"; shift ;;
      --environment) ENVIRONMENT="$2"; shift 2 ;;
      --continuous) CONTINUOUS_MODE=true; shift ;;
      --interval=*) REFRESH_INTERVAL="${1#*=}"; shift ;;
      *) shift ;;
    esac
  done

  # Run dashboard
  if [ "$CONTINUOUS_MODE" = true ]; then
    while true; do
      clear_screen
      print_header
      check_application_health
      check_database_status
      check_rabbitmq_status
      check_redis_status
      check_api_endpoints
      check_performance_metrics
      check_container_stats
      print_footer
      echo "Press Ctrl+C to exit"
      sleep "$REFRESH_INTERVAL"
    done
  else
    print_header
    check_application_health
    check_database_status
    check_rabbitmq_status
    check_redis_status
    check_api_endpoints
    check_performance_metrics
    check_container_stats
    print_footer
  fi
}

# Run main function
main "$@"
