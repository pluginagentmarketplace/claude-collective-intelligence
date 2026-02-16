#!/bin/bash

################################################################################
# Verification Script for Staging Environment
# Validates all components are running and healthy
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/verify-staging-${TIMESTAMP}.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Configuration
DEPLOYMENT_TYPE="kubernetes"  # kubernetes or docker-compose

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
    ((PASSED++))
}

log_error() {
    log "${RED}[✗]${NC} $@"
    ((FAILED++))
}

log_warning() {
    log "${YELLOW}[!]${NC} $@"
    ((WARNINGS++))
}

check_docker_compose_service() {
    local service=$1
    local expected_state=${2:-"running"}

    local status=$(docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" \
        ps "$service" --format "json" 2>/dev/null | grep -o '"State":"[^"]*' | cut -d'"' -f4 || echo "unknown")

    if [ "$status" = "running" ] && [ "$expected_state" = "running" ]; then
        log_success "Service '$service' is running"
    else
        log_error "Service '$service' is not running (state: $status)"
    fi
}

check_kubernetes_pod() {
    local deployment=$1
    local namespace=${2:-staging}

    local ready=$(kubectl get deployment "$deployment" -n "$namespace" \
        -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || echo "False")

    if [ "$ready" = "True" ]; then
        local replicas=$(kubectl get deployment "$deployment" -n "$namespace" \
            -o jsonpath='{.status.readyReplicas}')
        log_success "Deployment '$deployment' is ready ($replicas replicas)"
    else
        log_error "Deployment '$deployment' is not ready"
    fi
}

check_kubernetes_statefulset() {
    local statefulset=$1
    local namespace=${2:-staging}

    local ready=$(kubectl get statefulset "$statefulset" -n "$namespace" \
        -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired=$(kubectl get statefulset "$statefulset" -n "$namespace" \
        -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

    if [ "$ready" -eq "$desired" ] && [ "$desired" -gt 0 ]; then
        log_success "StatefulSet '$statefulset' is ready ($ready/$desired)"
    else
        log_error "StatefulSet '$statefulset' is not ready ($ready/$desired)"
    fi
}

check_port() {
    local host=$1
    local port=$2
    local service=$3

    if timeout 5 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
        log_success "Service '$service' is accessible at $host:$port"
    else
        log_error "Service '$service' is not accessible at $host:$port"
    fi
}

check_database_connectivity() {
    log_info "Checking database connectivity..."

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        if docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" exec -T postgres \
            psql -U staging_user -d agent_orchestrator_staging -c "SELECT 1" > /dev/null 2>&1; then
            log_success "PostgreSQL connectivity verified"
        else
            log_error "Failed to connect to PostgreSQL"
        fi
    else
        if kubectl exec -n staging postgres-0 -- \
            pg_isready -U staging_user -d agent_orchestrator_staging > /dev/null 2>&1; then
            log_success "PostgreSQL connectivity verified"
        else
            log_error "Failed to connect to PostgreSQL"
        fi
    fi
}

check_redis_connectivity() {
    log_info "Checking Redis connectivity..."

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        if docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" exec -T redis \
            redis-cli --raw incr ping > /dev/null 2>&1; then
            log_success "Redis connectivity verified"
        else
            log_error "Failed to connect to Redis"
        fi
    else
        if kubectl exec -n staging redis-0 -- \
            redis-cli --raw incr ping > /dev/null 2>&1; then
            log_success "Redis connectivity verified"
        else
            log_error "Failed to connect to Redis"
        fi
    fi
}

check_rabbitmq_connectivity() {
    log_info "Checking RabbitMQ connectivity..."

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        if docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" exec -T rabbitmq \
            rabbitmq-diagnostics ping > /dev/null 2>&1; then
            log_success "RabbitMQ connectivity verified"
        else
            log_error "Failed to connect to RabbitMQ"
        fi
    else
        if kubectl exec -n staging rabbitmq-0 -- \
            rabbitmq-diagnostics ping > /dev/null 2>&1; then
            log_success "RabbitMQ connectivity verified"
        else
            log_error "Failed to connect to RabbitMQ"
        fi
    fi
}

check_api_health() {
    log_info "Checking API health..."

    local url="http://localhost:3000/health"

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        # For Kubernetes, port-forward first
        local pf_pid=""
        kubectl port-forward -n staging svc/agent-orchestrator 3000:3000 &>/dev/null &
        pf_pid=$!
        sleep 2
    fi

    if curl -sf "$url" > /dev/null 2>&1; then
        log_success "API health check passed"
    else
        log_error "API health check failed"
    fi

    if [ -n "${pf_pid:-}" ]; then
        kill "$pf_pid" 2>/dev/null || true
    fi
}

check_metrics_endpoint() {
    log_info "Checking metrics endpoint..."

    local url="http://localhost:9091/metrics"

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        # For Kubernetes, port-forward first
        local pf_pid=""
        kubectl port-forward -n staging svc/agent-orchestrator 9091:9091 &>/dev/null &
        pf_pid=$!
        sleep 2
    fi

    if curl -sf "$url" > /dev/null 2>&1; then
        log_success "Metrics endpoint is accessible"
    else
        log_warning "Metrics endpoint is not accessible"
    fi

    if [ -n "${pf_pid:-}" ]; then
        kill "$pf_pid" 2>/dev/null || true
    fi
}

check_disk_space() {
    log_info "Checking disk space..."

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        local usage=$(docker system df --format "{{.UsedSize}}" 2>/dev/null || echo "unknown")
        if [ "$usage" != "unknown" ]; then
            log_info "Docker disk usage: $usage"
        fi
    fi

    local root_usage=$(df / | awk 'NR==2 {print int($5)}')
    if [ "$root_usage" -lt 80 ]; then
        log_success "Disk space is sufficient ($root_usage% used)"
    else
        log_warning "Disk space is running low ($root_usage% used)"
    fi
}

check_memory_usage() {
    log_info "Checking memory usage..."

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        local memory=$(docker stats --no-stream --format "{{.MemUsage}}" 2>/dev/null | head -1 || echo "unknown")
        log_info "Memory usage: $memory"
    else
        local memory=$(kubectl top nodes -n staging 2>/dev/null | awk 'NR==2 {print $5}' || echo "unknown")
        if [ "$memory" != "unknown" ]; then
            log_info "Kubernetes memory usage: $memory"
        fi
    fi
}

generate_report() {
    log_info ""
    log_info "=========================================="
    log_info "Verification Report"
    log_info "=========================================="
    log_info "Passed: ${GREEN}$PASSED${NC}"
    log_info "Failed: ${RED}$FAILED${NC}"
    log_info "Warnings: ${YELLOW}$WARNINGS${NC}"
    log_info "=========================================="

    if [ $FAILED -eq 0 ]; then
        log_success "All checks passed!"
        return 0
    else
        log_error "$FAILED checks failed"
        return 1
    fi
}

################################################################################
# Main Execution
################################################################################

main() {
    mkdir -p "$(dirname "$LOG_FILE")"

    log_info "=========================================="
    log_info "Staging Environment Verification"
    log_info "=========================================="
    log_info "Deployment Type: $DEPLOYMENT_TYPE"
    log_info "Timestamp: $TIMESTAMP"
    log_info "=========================================="

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        log_info ""
        log_info "Checking Docker Compose services..."
        check_docker_compose_service "postgres"
        check_docker_compose_service "redis"
        check_docker_compose_service "rabbitmq"
        check_docker_compose_service "agent-orchestrator"
        check_docker_compose_service "prometheus"
        check_docker_compose_service "grafana"

        log_info ""
        log_info "Checking service ports..."
        check_port "localhost" "5432" "PostgreSQL"
        check_port "localhost" "6379" "Redis"
        check_port "localhost" "5672" "RabbitMQ"
        check_port "localhost" "3000" "Agent Orchestrator"
        check_port "localhost" "9090" "Prometheus"
        check_port "localhost" "3001" "Grafana"
    else
        log_info ""
        log_info "Checking Kubernetes resources..."
        check_kubernetes_statefulset "postgres"
        check_kubernetes_statefulset "redis"
        check_kubernetes_statefulset "rabbitmq"
        check_kubernetes_pod "agent-orchestrator"
        check_kubernetes_pod "agent-workers"
    fi

    log_info ""
    log_info "Checking connectivity..."
    check_database_connectivity
    check_redis_connectivity
    check_rabbitmq_connectivity

    log_info ""
    log_info "Checking application..."
    check_api_health
    check_metrics_endpoint

    log_info ""
    log_info "Checking system resources..."
    check_disk_space
    check_memory_usage

    log_info ""
    generate_report
}

# Run main function
main "$@"
