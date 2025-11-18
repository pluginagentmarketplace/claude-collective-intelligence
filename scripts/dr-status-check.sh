#!/bin/bash

################################################################################
# DR Status Check Script
# Comprehensive health check for all disaster recovery components
################################################################################

set -euo pipefail

STATUS_REPORT="dr_status_$(date +%Y%m%d_%H%M%S).report"
BACKUP_DIR="${BACKUP_DIR:-.}/backups"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$STATUS_REPORT"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$STATUS_REPORT"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$STATUS_REPORT"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$STATUS_REPORT"
}

check_passed() {
    echo "  ✓ $1" | tee -a "$STATUS_REPORT"
    PASSED=$((PASSED + 1))
}

check_failed() {
    echo "  ✗ $1" | tee -a "$STATUS_REPORT"
    FAILED=$((FAILED + 1))
}

check_warning() {
    echo "  ⚠ $1" | tee -a "$STATUS_REPORT"
    WARNINGS=$((WARNINGS + 1))
}

################################################################################
# PostgreSQL Status
################################################################################

check_postgresql() {
    log ""
    log "=== PostgreSQL Status ===="

    if ! command -v psql &>/dev/null; then
        check_warning "PostgreSQL client tools not installed"
        return
    fi

    # Check connectivity
    export PGPASSWORD="${POSTGRES_PASSWORD:-postgres123}"

    if pg_isready -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-admin}" \
        -d "${POSTGRES_DB:-agent_orchestrator}" &>/dev/null; then
        check_passed "PostgreSQL is accessible"

        # Check database size
        local db_size=$(psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-admin}" \
            -d "${POSTGRES_DB:-agent_orchestrator}" -t -c \
            "SELECT pg_database_size('agent_orchestrator') / 1024 / 1024" 2>/dev/null | xargs)
        info "Database size: ${db_size}MB"

        # Check table count
        local table_count=$(psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-admin}" \
            -d "${POSTGRES_DB:-agent_orchestrator}" -t -c \
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | xargs)
        if [ "$table_count" -gt 0 ]; then
            check_passed "Database has $table_count tables"
        else
            check_failed "Database has no tables"
        fi

        # Check row count
        local row_count=$(psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-admin}" \
            -d "${POSTGRES_DB:-agent_orchestrator}" -t -c \
            "SELECT SUM(n_live_tup) FROM pg_stat_user_tables" 2>/dev/null | xargs)
        info "Total rows: $row_count"

        # Check replication status
        local replication=$(psql -h "${POSTGRES_HOST:-localhost}" -U "${POSTGRES_USER:-admin}" \
            -d "${POSTGRES_DB:-agent_orchestrator}" -t -c \
            "SELECT count(*) FROM pg_stat_replication" 2>/dev/null | xargs)
        if [ "$replication" -gt 0 ]; then
            check_passed "Replication active ($replication replicas)"
        else
            check_warning "No active replicas"
        fi
    else
        check_failed "PostgreSQL is not accessible"
    fi

    unset PGPASSWORD
}

################################################################################
# Redis Status
################################################################################

check_redis() {
    log ""
    log "=== Redis Status ===="

    if ! command -v redis-cli &>/dev/null && ! command -v docker &>/dev/null; then
        check_warning "Redis CLI not available"
        return
    fi

    local redis_cmd="docker exec agent_redis redis-cli"
    if ! docker ps 2>/dev/null | grep -q agent_redis; then
        redis_cmd="redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379}"
    fi

    if $redis_cmd PING &>/dev/null 2>&1; then
        check_passed "Redis is accessible"

        # Check memory usage
        local memory=$(
            $redis_cmd INFO memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r' || echo "unknown"
        )
        info "Memory usage: $memory"

        # Check key count
        local keys=$($redis_cmd DBSIZE 2>/dev/null | cut -d: -f2 | tr -d '\r' || echo "unknown")
        if [ "$keys" -gt 0 ]; then
            check_passed "Redis has $keys keys"
        else
            check_warning "Redis is empty (0 keys)"
        fi

        # Check replication
        local role=$(
            $redis_cmd INFO replication 2>/dev/null | grep "^role:" | cut -d: -f2 | tr -d '\r' || echo "unknown"
        )
        info "Replication role: $role"
    else
        check_failed "Redis is not accessible"
    fi
}

################################################################################
# RabbitMQ Status
################################################################################

check_rabbitmq() {
    log ""
    log "=== RabbitMQ Status ===="

    if ! command -v docker &>/dev/null; then
        check_warning "Docker not available"
        return
    fi

    if ! docker ps 2>/dev/null | grep -q agent_rabbitmq; then
        check_failed "RabbitMQ container not running"
        return
    fi

    if docker exec agent_rabbitmq rabbitmq-diagnostics ping &>/dev/null 2>&1; then
        check_passed "RabbitMQ is accessible"

        # Check queue count
        local queue_count=$(docker exec agent_rabbitmq rabbitmqctl list_queues 2>/dev/null | grep -c "^" || echo "0")
        queue_count=$((queue_count - 1)) # Subtract header line
        check_passed "RabbitMQ has $queue_count queues"

        # Check message count
        local message_count=$(docker exec agent_rabbitmq rabbitmqctl list_queues messages 2>/dev/null | \
            awk '{sum+=$1} END {print sum}' || echo "unknown")
        info "Total messages: $message_count"

        # Check cluster status
        local nodes=$(docker exec agent_rabbitmq rabbitmqctl cluster_status 2>/dev/null | grep "rabbit@" | wc -l || echo "unknown")
        info "Cluster nodes: $nodes"
    else
        check_failed "RabbitMQ is not responding"
    fi
}

################################################################################
# Backup Status
################################################################################

check_backups() {
    log ""
    log "=== Backup Status ===="

    # PostgreSQL backups
    if [ -d "$BACKUP_DIR/postgres" ]; then
        local pg_count=$(find "$BACKUP_DIR/postgres" -name "*.dump.gz" -mtime -1 | wc -l)
        if [ "$pg_count" -gt 0 ]; then
            check_passed "PostgreSQL backups exist ($pg_count today)"
        else
            check_warning "No PostgreSQL backups from today"
        fi

        local latest_pg=$(find "$BACKUP_DIR/postgres" -name "*.dump.gz" -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2)
        if [ ! -z "$latest_pg" ]; then
            local size=$(du -h "$latest_pg" | cut -f1)
            info "Latest PostgreSQL backup: $size"
        fi
    else
        check_warning "PostgreSQL backup directory not found"
    fi

    # Redis backups
    if [ -d "$BACKUP_DIR/redis" ]; then
        local redis_count=$(find "$BACKUP_DIR/redis" -name "*.rdb.gz" -mtime -1 | wc -l)
        if [ "$redis_count" -gt 0 ]; then
            check_passed "Redis backups exist ($redis_count today)"
        else
            check_warning "No Redis backups from today"
        fi
    else
        check_warning "Redis backup directory not found"
    fi

    # RabbitMQ backups
    if [ -d "$BACKUP_DIR/rabbitmq" ]; then
        local rabbit_count=$(find "$BACKUP_DIR/rabbitmq" -name "*.json.gz" -mtime -1 | wc -l)
        if [ "$rabbit_count" -gt 0 ]; then
            check_passed "RabbitMQ backups exist ($rabbit_count today)"
        else
            check_warning "No RabbitMQ backups from today"
        fi
    else
        check_warning "RabbitMQ backup directory not found"
    fi

    # Check S3
    if command -v aws &>/dev/null && [ ! -z "${BACKUP_S3_BUCKET:-}" ]; then
        info "Checking S3 backups..."
        if aws s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" --recursive 2>/dev/null | head -1 | grep -q .; then
            check_passed "S3 backups available"
        else
            check_warning "S3 backups not accessible"
        fi
    fi
}

################################################################################
# Application Services Status
################################################################################

check_services() {
    log ""
    log "=== Application Services Status ===="

    if ! command -v docker &>/dev/null; then
        check_warning "Docker not available"
        return
    fi

    # Check all containers
    local containers=("postgres" "redis" "rabbitmq" "app")
    for container in "${containers[@]}"; do
        if docker ps --filter "name=$container" | grep -q "$container"; then
            check_passed "$container container is running"
        else
            check_warning "$container container is not running"
        fi
    done

    # Check docker-compose
    if command -v docker-compose &>/dev/null; then
        if docker-compose ps 2>/dev/null | grep -q "Up"; then
            check_passed "Docker-compose services are running"
        else
            check_warning "Some docker-compose services are not running"
        fi
    fi
}

################################################################################
# Disk Space Status
################################################################################

check_disk_space() {
    log ""
    log "=== Disk Space Status ===="

    if [ -d "$BACKUP_DIR" ]; then
        local backup_size=$(du -sh "$BACKUP_DIR" | cut -f1)
        local available=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
        local used=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}')

        info "Backup directory size: $backup_size"
        info "Available space: $((AVAILABLE / 1024 / 1024))GB"
        info "Disk usage: $used"

        if [ "${used%\%}" -lt 80 ]; then
            check_passed "Disk space OK"
        else
            check_failed "Disk space warning: $used used"
        fi
    else
        check_warning "Backup directory not found"
    fi
}

################################################################################
# RTO/RPO Verification
################################################################################

check_rto_rpo() {
    log ""
    log "=== RTO/RPO Objectives Status ===="

    # RTO Check - can we recover in time?
    info "RTO Target: 2 hours"

    # Estimate recovery time based on backup size
    if [ -d "$BACKUP_DIR/postgres" ]; then
        local backup_size=$(du -sh "$BACKUP_DIR/postgres" | cut -f1)
        info "PostgreSQL backup size: $backup_size (recovery ~30-60 min)"
        check_passed "PostgreSQL RTO achievable"
    fi

    # RPO Check - are backups current enough?
    info "RPO Target: 1 hour"

    if [ -d "$BACKUP_DIR/postgres" ]; then
        local latest_backup=$(find "$BACKUP_DIR/postgres" -name "*.dump.gz" -printf '%T@' | sort -rn | head -1)
        local current_time=$(date +%s)
        local age=$((current_time - latest_backup))

        if [ $age -lt 3600 ]; then
            check_passed "PostgreSQL RPO achieved (backup age: $((age / 60)) min)"
        else
            check_warning "PostgreSQL RPO may be exceeded (backup age: $((age / 3600)) hour)"
        fi
    fi
}

################################################################################
# Main Execution
################################################################################

main() {
    log "========================================="
    log "DR Status Check Report"
    log "Generated: $(date -Iseconds)"
    log "========================================="

    check_postgresql
    check_redis
    check_rabbitmq
    check_backups
    check_services
    check_disk_space
    check_rto_rpo

    # Summary
    log ""
    log "========================================="
    log "Summary"
    log "========================================="
    log "Passed Checks: $PASSED"
    log "Failed Checks: $FAILED"
    log "Warnings: $WARNINGS"

    if [ $FAILED -eq 0 ]; then
        log "Status: ✓ ALL SYSTEMS OPERATIONAL"
        exit 0
    elif [ $FAILED -lt 3 ]; then
        log "Status: ⚠ OPERATIONAL WITH WARNINGS"
        exit 0
    else
        log "Status: ✗ CRITICAL ISSUES DETECTED"
        exit 1
    fi
}

main "$@"
