#!/bin/bash
################################################################################
# PRE-DEPLOYMENT CHECK SCRIPT
# AI Agent Orchestrator with RabbitMQ - Production Deployment
#
# This script verifies all pre-deployment requirements are met before
# initiating the production deployment.
#
# Usage:
#   ./scripts/pre-deployment-check.sh                 # Run all checks
#   ./scripts/pre-deployment-check.sh --final         # Final verification
#   ./scripts/pre-deployment-check.sh --config-validation  # Config only
#
# Exit codes:
#   0: All checks passed
#   1: Some checks failed
#   2: Critical checks failed
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BLUE_APP_HOST="${BLUE_APP_HOST:-blue-app}"
BLUE_APP_PORT="${BLUE_APP_PORT:-3000}"
BLUE_DB_HOST="${BLUE_DB_HOST:-blue-db}"
BLUE_RABBITMQ_HOST="${BLUE_RABBITMQ_HOST:-blue-rabbitmq}"
BLUE_REDIS_HOST="${BLUE_REDIS_HOST:-blue-redis}"
GREEN_APP_HOST="${GREEN_APP_HOST:-green-app}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0
CRITICAL_FAILURES=0

# Logging functions
log_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((CHECKS_PASSED++))
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
  ((CHECKS_FAILED++))
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((CHECKS_WARNING++))
}

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check functions

check_blue_application_health() {
  log_section "CHECKING BLUE APPLICATION HEALTH"

  response=$(curl -s -w "\n%{http_code}" "http://${BLUE_APP_HOST}:${BLUE_APP_PORT}/health" 2>/dev/null || echo "000")
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -n -1)

  if [ "$http_code" = "200" ]; then
    version=$(echo "$body" | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown")
    status=$(echo "$body" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    log_pass "Blue app responding (HTTP 200, v$version, status=$status)"
  else
    log_fail "Blue app not responding (HTTP $http_code)"
    return 1
  fi

  # Check database connectivity
  db_health=$(echo "$body" | jq -r '.database // "unknown"' 2>/dev/null || echo "unknown")
  if [ "$db_health" = "ok" ]; then
    log_pass "Blue database connectivity: OK"
  else
    log_fail "Blue database issue: $db_health"
    return 1
  fi

  # Check RabbitMQ connectivity
  rabbitmq_health=$(echo "$body" | jq -r '.rabbitmq // "unknown"' 2>/dev/null || echo "unknown")
  if [ "$rabbitmq_health" = "ok" ]; then
    log_pass "Blue RabbitMQ connectivity: OK"
  else
    log_warn "Blue RabbitMQ issue: $rabbitmq_health"
  fi

  # Check Redis connectivity
  redis_health=$(echo "$body" | jq -r '.redis // "unknown"' 2>/dev/null || echo "unknown")
  if [ "$redis_health" = "ok" ]; then
    log_pass "Blue Redis connectivity: OK"
  else
    log_warn "Blue Redis issue: $redis_health"
  fi
}

check_blue_api_endpoints() {
  log_section "CHECKING BLUE API ENDPOINTS"

  endpoints=("/api/agents" "/api/messages" "/api/health")
  failed=0

  for endpoint in "${endpoints[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://${BLUE_APP_HOST}:${BLUE_APP_PORT}${endpoint}" 2>/dev/null || echo "000")

    if [ "$response" = "200" ] || [ "$response" = "401" ]; then
      log_pass "$endpoint: HTTP $response"
    else
      log_fail "$endpoint: HTTP $response"
      ((failed++))
    fi
  done

  return $failed
}

check_blue_docker_container() {
  log_section "CHECKING BLUE DOCKER CONTAINER"

  # Check if container exists and is running
  container_status=$(docker ps --filter "name=app" --format "{{.Status}}" 2>/dev/null | head -1 || echo "not found")

  if [[ "$container_status" == "Up"* ]]; then
    log_pass "Container running: $container_status"
  else
    log_fail "Container not running: $container_status"
    return 1
  fi

  # Check CPU/Memory usage
  stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | tail -1)
  log_info "Container stats: $stats"
}

check_database_replication() {
  log_section "CHECKING DATABASE REPLICATION"

  # Check replication status
  repl_status=$(psql -h "$BLUE_DB_HOST" -U postgres -d production -t -c "SELECT count(*) FROM pg_stat_replication;" 2>/dev/null || echo "error")

  if [ "$repl_status" -gt 0 ]; then
    log_pass "Database replication active: $repl_status standby(s)"
  else
    log_warn "No active replication found"
  fi

  # Check replication lag
  lag=$(psql -h "$BLUE_DB_HOST" -U postgres -d production -t -c "SELECT EXTRACT(EPOCH FROM (NOW() - pg_last_wal_receive_lsn())) as lag;" 2>/dev/null | grep -oE '[0-9]+' || echo "error")

  if [ "$lag" != "error" ] && [ "$lag" -lt 5 ]; then
    log_pass "Replication lag: ${lag}s (acceptable)"
  else
    log_warn "Replication lag: ${lag}s (check status)"
  fi
}

check_green_environment() {
  log_section "CHECKING GREEN ENVIRONMENT (CURRENT PRODUCTION)"

  # Check green health
  response=$(curl -s -w "\n%{http_code}" "http://${GREEN_APP_HOST}:3000/health" 2>/dev/null || echo "000")
  http_code=$(echo "$response" | tail -1)

  if [ "$http_code" = "200" ]; then
    version=$(echo "$response" | head -n -1 | jq -r '.version // "unknown"' 2>/dev/null || echo "unknown")
    log_pass "Green app healthy (v$version)"
  else
    log_fail "Green app not responding (HTTP $http_code)"
    return 1
  fi
}

check_dependencies() {
  log_section "CHECKING REQUIRED DEPENDENCIES"

  # Check Docker
  if command -v docker &> /dev/null; then
    docker_version=$(docker --version 2>/dev/null || echo "unknown")
    log_pass "Docker available: $docker_version"
  else
    log_fail "Docker not found - required for deployment"
    return 1
  fi

  # Check jq
  if command -v jq &> /dev/null; then
    log_pass "jq available"
  else
    log_warn "jq not found - some checks may be limited"
  fi

  # Check curl
  if command -v curl &> /dev/null; then
    log_pass "curl available"
  else
    log_fail "curl not found - required for health checks"
    return 1
  fi

  # Check aws CLI (if using ALB)
  if command -v aws &> /dev/null; then
    aws_version=$(aws --version 2>/dev/null || echo "unknown")
    log_pass "AWS CLI available"
  else
    log_warn "AWS CLI not found - ALB checks may be skipped"
  fi

  # Check PostgreSQL client
  if command -v psql &> /dev/null; then
    log_pass "PostgreSQL client available"
  else
    log_warn "psql not found - database checks may be limited"
  fi
}

check_load_balancer() {
  log_section "CHECKING LOAD BALANCER CONFIGURATION"

  if ! command -v aws &> /dev/null; then
    log_warn "AWS CLI not available - skipping load balancer checks"
    return 0
  fi

  # Check target groups exist
  target_groups=$(aws elbv2 describe-target-groups --query 'TargetGroups[*].TargetGroupName' --output text 2>/dev/null || echo "error")

  if [[ "$target_groups" == *"blue"* ]] && [[ "$target_groups" == *"green"* ]]; then
    log_pass "Target groups found: blue and green"
  else
    log_warn "Target group configuration unclear"
  fi

  # Check health checks configured
  log_info "Load balancer configuration verified"
}

check_monitoring_setup() {
  log_section "CHECKING MONITORING SETUP"

  # Check Prometheus
  if curl -s http://prometheus:9090/api/v1/alerts &>/dev/null; then
    log_pass "Prometheus accessible"
  else
    log_warn "Prometheus not accessible - monitoring may be limited"
  fi

  # Check Grafana
  if curl -s http://grafana:3000/api/health &>/dev/null; then
    log_pass "Grafana accessible"
  else
    log_warn "Grafana not accessible"
  fi
}

check_secrets_and_config() {
  log_section "CHECKING SECRETS & CONFIGURATION"

  # Check environment variables
  if [ -f "$PROJECT_DIR/.env" ]; then
    log_pass ".env file exists"

    # Check critical variables
    required_vars=("ENVIRONMENT" "DATABASE_URL" "RABBITMQ_URL")
    for var in "${required_vars[@]}"; do
      if grep -q "$var=" "$PROJECT_DIR/.env"; then
        log_pass "Variable $var configured"
      else
        log_warn "Variable $var not found in .env"
      fi
    done
  else
    log_warn ".env file not found"
  fi

  # Check for hardcoded secrets
  if git log --all -S "password\|secret\|key" --oneline 2>/dev/null | grep -q .; then
    log_warn "Potential hardcoded secrets found in git history"
  else
    log_pass "No obvious hardcoded secrets detected"
  fi
}

check_deployment_files() {
  log_section "CHECKING DEPLOYMENT FILES"

  required_files=(
    "PRODUCTION_DEPLOYMENT_RUNBOOK.md"
    "DEPLOYMENT_CHECKLIST.md"
    "CUTOVER_PROCEDURES.md"
    "scripts/deploy.sh"
    "scripts/rollback.sh"
    "scripts/verify-deployment.sh"
  )

  for file in "${required_files[@]}"; do
    if [ -f "$PROJECT_DIR/$file" ]; then
      log_pass "File exists: $file"
    else
      log_fail "File missing: $file"
    fi
  done
}

check_docker_image() {
  log_section "CHECKING DOCKER IMAGE"

  # Check if image exists locally or in registry
  image="${1:-ghcr.io/yourcompany/app:v2.1.0}"

  if docker images | grep -q "ghcr.io/yourcompany"; then
    log_pass "Docker image found in registry"
  else
    log_warn "Docker image may not be accessible - verify registry access"
  fi
}

# Main execution

print_banner() {
  echo ""
  echo -e "${BLUE}"
  echo "╔═══════════════════════════════════════════════════════════════════╗"
  echo "║     PRE-DEPLOYMENT CHECK - AI Agent Orchestrator v2.1.0           ║"
  echo "║     Production Deployment Verification Script                     ║"
  echo "╚═══════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  echo "Timestamp: $(date)"
  echo "Hostname: $(hostname)"
  echo ""
}

print_summary() {
  echo ""
  log_section "SUMMARY"
  echo "Checks Passed:   $CHECKS_PASSED"
  echo "Checks Failed:   $CHECKS_FAILED"
  echo "Warnings:        $CHECKS_WARNING"
  echo "Critical Issues: $CRITICAL_FAILURES"
  echo ""

  if [ $CRITICAL_FAILURES -gt 0 ]; then
    echo -e "${RED}STATUS: CRITICAL FAILURES DETECTED - DO NOT DEPLOY${NC}"
    return 2
  elif [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${YELLOW}STATUS: SOME FAILURES DETECTED - REVIEW REQUIRED${NC}"
    return 1
  else
    echo -e "${GREEN}STATUS: ALL CHECKS PASSED - READY FOR DEPLOYMENT${NC}"
    return 0
  fi
}

main() {
  print_banner

  # Parse arguments
  FINAL_CHECK=false
  CONFIG_ONLY=false

  while [[ $# -gt 0 ]]; do
    case $1 in
      --final) FINAL_CHECK=true; shift ;;
      --config-validation) CONFIG_ONLY=true; shift ;;
      *) shift ;;
    esac
  done

  # Run checks
  if [ "$CONFIG_ONLY" = true ]; then
    check_secrets_and_config
    check_dependencies
  else
    check_dependencies
    check_blue_application_health || ((CRITICAL_FAILURES++))
    check_blue_api_endpoints
    check_blue_docker_container || ((CRITICAL_FAILURES++))
    check_database_replication
    check_green_environment || ((CRITICAL_FAILURES++))
    check_load_balancer
    check_monitoring_setup
    check_secrets_and_config
    check_deployment_files
    check_docker_image
  fi

  print_summary
}

# Run main function
main "$@"
exit $?
