#!/bin/bash

################################################################################
# Health Check Script for Staging Environment
# Continuous monitoring of system health and performance
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/health-check-${TIMESTAMP}.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOYMENT_TYPE="kubernetes"
CONTINUOUS=false
DURATION=0
CHECK_INTERVAL=10
ALERT_ON_FAILURE=false
GENERATE_REPORT=false
REPORT_FILE=""

# Thresholds
CPU_THRESHOLD=70
MEMORY_THRESHOLD=75
DISK_THRESHOLD=80
RESPONSE_TIME_THRESHOLD=5000

# Counters
TOTAL_CHECKS=0
FAILED_CHECKS=0

################################################################################
# Functions
################################################################################

log() {
    local level=$1
    shift
    echo -e "${*}" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $@"
}

log_success() {
    log "${GREEN}[✓]${NC} $@"
}

log_error() {
    log "${RED}[✗]${NC} $@"
}

log_warning() {
    log "${YELLOW}[!]${NC} $@"
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --type TYPE              Deployment type: kubernetes or docker-compose
    --continuous SECONDS    Run continuous checks for N seconds
    --interval SECONDS      Check interval in seconds (default: 10)
    --alert-on-failure      Send alerts on failures
    --generate-report FILE  Generate JSON report
    -h, --help              Show this help message

EXAMPLES:
    # Single health check
    $0

    # Continuous checks for 5 minutes
    $0 --continuous 300

    # Check every 30 seconds for 10 minutes
    $0 --continuous 600 --interval 30

    # Generate report
    $0 --generate-report health-report.json
EOF
    exit 0
}

################################################################################
# Parse Arguments
################################################################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        --continuous)
            CONTINUOUS=true
            DURATION=$2
            shift 2
            ;;
        --interval)
            CHECK_INTERVAL=$2
            shift 2
            ;;
        --alert-on-failure)
            ALERT_ON_FAILURE=true
            shift
            ;;
        --generate-report)
            GENERATE_REPORT=true
            REPORT_FILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

################################################################################
# Health Check Functions
################################################################################

check_service_health_kubernetes() {
    local deployment=$1
    ((TOTAL_CHECKS++))

    local ready=$(kubectl get deployment "$deployment" -n staging \
        -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || echo "Unknown")

    if [ "$ready" = "True" ]; then
        local replicas=$(kubectl get deployment "$deployment" -n staging \
            -o jsonpath='{.status.readyReplicas}')
        log_success "$deployment deployment is ready ($replicas replicas)"
    else
        log_error "$deployment deployment is not ready"
        ((FAILED_CHECKS++))
    fi
}

check_service_health_docker() {
    local service=$1
    ((TOTAL_CHECKS++))

    local status=$(docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" \
        ps "$service" --format "json" 2>/dev/null | grep -o '"State":"[^"]*' | cut -d'"' -f4 || echo "unknown")

    if [ "$status" = "running" ]; then
        log_success "$service is running"
    else
        log_error "$service is not running (state: $status)"
        ((FAILED_CHECKS++))
    fi
}

check_database_connectivity() {
    ((TOTAL_CHECKS++))

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        if kubectl exec -n staging postgres-0 -- \
            pg_isready -U staging_user -d agent_orchestrator_staging > /dev/null 2>&1; then
            log_success "PostgreSQL connectivity OK"
        else
            log_error "PostgreSQL connectivity failed"
            ((FAILED_CHECKS++))
        fi
    else
        if docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" exec -T postgres \
            pg_isready -U staging_user -d agent_orchestrator_staging > /dev/null 2>&1; then
            log_success "PostgreSQL connectivity OK"
        else
            log_error "PostgreSQL connectivity failed"
            ((FAILED_CHECKS++))
        fi
    fi
}

check_redis_connectivity() {
    ((TOTAL_CHECKS++))

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        if kubectl exec -n staging redis-0 -- \
            redis-cli --raw incr ping > /dev/null 2>&1; then
            log_success "Redis connectivity OK"
        else
            log_error "Redis connectivity failed"
            ((FAILED_CHECKS++))
        fi
    else
        if docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" exec -T redis \
            redis-cli --raw incr ping > /dev/null 2>&1; then
            log_success "Redis connectivity OK"
        else
            log_error "Redis connectivity failed"
            ((FAILED_CHECKS++))
        fi
    fi
}

check_rabbitmq_connectivity() {
    ((TOTAL_CHECKS++))

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        if kubectl exec -n staging rabbitmq-0 -- \
            rabbitmq-diagnostics ping > /dev/null 2>&1; then
            log_success "RabbitMQ connectivity OK"
        else
            log_error "RabbitMQ connectivity failed"
            ((FAILED_CHECKS++))
        fi
    else
        if docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" exec -T rabbitmq \
            rabbitmq-diagnostics ping > /dev/null 2>&1; then
            log_success "RabbitMQ connectivity OK"
        else
            log_error "RabbitMQ connectivity failed"
            ((FAILED_CHECKS++))
        fi
    fi
}

check_api_responsiveness() {
    ((TOTAL_CHECKS++))

    local start_time=$(date +%s%N)
    local response=$(curl -s -w "%{http_code}" -o /dev/null "http://localhost:3000/health" 2>/dev/null || echo "000")
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))

    if [ "$response" = "200" ]; then
        if [ "$response_time" -lt "$RESPONSE_TIME_THRESHOLD" ]; then
            log_success "API is healthy (response time: ${response_time}ms)"
        else
            log_warning "API is slow (response time: ${response_time}ms, threshold: ${RESPONSE_TIME_THRESHOLD}ms)"
        fi
    else
        log_error "API health check failed (HTTP $response)"
        ((FAILED_CHECKS++))
    fi
}

check_cpu_usage() {
    ((TOTAL_CHECKS++))

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        local cpu=$(kubectl top nodes 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/%$//' || echo "0")
        if [ -n "$cpu" ] && [ "$cpu" -gt 0 ]; then
            if [ "$cpu" -lt "$CPU_THRESHOLD" ]; then
                log_success "CPU usage OK ($cpu%)"
            else
                log_warning "High CPU usage ($cpu%, threshold: $CPU_THRESHOLD%)"
            fi
        fi
    else
        local cpu=$(docker stats --no-stream --format "{{.CPUPerc}}" 2>/dev/null | head -1 | sed 's/%$//' || echo "0")
        if [ -n "$cpu" ] && [ "$cpu" -gt 0 ]; then
            if (( $(echo "$cpu < $CPU_THRESHOLD" | bc -l) )); then
                log_success "CPU usage OK ($cpu%)"
            else
                log_warning "High CPU usage ($cpu%, threshold: $CPU_THRESHOLD%)"
            fi
        fi
    fi
}

check_memory_usage() {
    ((TOTAL_CHECKS++))

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        local memory=$(kubectl top nodes 2>/dev/null | awk 'NR==2 {print $5}' | sed 's/%$//' || echo "0")
        if [ -n "$memory" ] && [ "$memory" -gt 0 ]; then
            if [ "$memory" -lt "$MEMORY_THRESHOLD" ]; then
                log_success "Memory usage OK ($memory%)"
            else
                log_warning "High memory usage ($memory%, threshold: $MEMORY_THRESHOLD%)"
            fi
        fi
    else
        local memory=$(docker stats --no-stream --format "{{.MemPerc}}" 2>/dev/null | head -1 | sed 's/%$//' || echo "0")
        if [ -n "$memory" ] && [ "$memory" -gt 0 ]; then
            if (( $(echo "$memory < $MEMORY_THRESHOLD" | bc -l) )); then
                log_success "Memory usage OK ($memory%)"
            else
                log_warning "High memory usage ($memory%, threshold: $MEMORY_THRESHOLD%)"
            fi
        fi
    fi
}

check_disk_space() {
    ((TOTAL_CHECKS++))

    local usage=$(df / | awk 'NR==2 {print int($5)}')
    if [ "$usage" -lt "$DISK_THRESHOLD" ]; then
        log_success "Disk space OK ($usage% used)"
    else
        log_error "Low disk space ($usage% used, threshold: $DISK_THRESHOLD%)"
        ((FAILED_CHECKS++))
    fi
}

run_all_checks() {
    log_info "=========================================="
    log_info "Running health checks..."
    log_info "=========================================="

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        check_service_health_kubernetes "agent-orchestrator"
        check_service_health_kubernetes "agent-workers"
    else
        check_service_health_docker "postgres"
        check_service_health_docker "redis"
        check_service_health_docker "rabbitmq"
        check_service_health_docker "agent-orchestrator"
    fi

    check_database_connectivity
    check_redis_connectivity
    check_rabbitmq_connectivity
    check_api_responsiveness
    check_cpu_usage
    check_memory_usage
    check_disk_space

    log_info ""
    log_info "Check Summary:"
    log_info "  Total Checks: $TOTAL_CHECKS"
    log_info "  Passed: $((TOTAL_CHECKS - FAILED_CHECKS))"
    log_info "  Failed: $FAILED_CHECKS"
}

generate_json_report() {
    if [ ! "$GENERATE_REPORT" = true ]; then
        return
    fi

    log_info "Generating JSON report: $REPORT_FILE"

    cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployment_type": "$DEPLOYMENT_TYPE",
  "total_checks": $TOTAL_CHECKS,
  "passed_checks": $((TOTAL_CHECKS - FAILED_CHECKS)),
  "failed_checks": $FAILED_CHECKS,
  "status": "$([ $FAILED_CHECKS -eq 0 ] && echo 'healthy' || echo 'unhealthy')"
}
EOF

    log_success "Report generated: $REPORT_FILE"
}

################################################################################
# Main Execution
################################################################################

main() {
    mkdir -p "$(dirname "$LOG_FILE")"

    log_info "Health Check Service Started"
    log_info "Logs: $LOG_FILE"

    if [ "$CONTINUOUS" = true ]; then
        log_info "Running continuous checks for ${DURATION}s (interval: ${CHECK_INTERVAL}s)"
        local elapsed=0
        while [ $elapsed -lt "$DURATION" ]; do
            run_all_checks
            log_info "Next check in ${CHECK_INTERVAL}s... (elapsed: ${elapsed}s/$DURATION)"
            sleep "$CHECK_INTERVAL"
            elapsed=$((elapsed + CHECK_INTERVAL))
            TOTAL_CHECKS=0
            FAILED_CHECKS=0
        done
    else
        run_all_checks
    fi

    generate_json_report

    log_info ""
    if [ $FAILED_CHECKS -eq 0 ]; then
        log_success "All health checks passed!"
        exit 0
    else
        log_error "Some health checks failed!"
        exit 1
    fi
}

# Run main function
main "$@"
