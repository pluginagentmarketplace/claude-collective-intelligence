#!/bin/bash

################################################################################
# Restore from Backup Script
# Restores PostgreSQL, Redis, or RabbitMQ from backup files
# Usage: ./restore-from-backup.sh --type postgresql --backup <backup_file>
################################################################################

set -euo pipefail

BACKUP_TYPE="${BACKUP_TYPE:-postgresql}"
BACKUP_FILE="${BACKUP_FILE:-}"
TARGET_TIME="${TARGET_TIME:-}"
TEST_MODE="${TEST_MODE:-false}"
RESTORE_LOG="restore_$(date +%Y%m%d_%H%M%S).log"

# Configuration
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-agent_orchestrator}"
POSTGRES_USER="${POSTGRES_USER:-admin}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$RESTORE_LOG"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$RESTORE_LOG" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$RESTORE_LOG"
}

show_usage() {
    cat <<EOF
Usage: $0 --type <TYPE> --backup <FILE> [OPTIONS]

Types:
  postgresql    Restore PostgreSQL database
  redis         Restore Redis cache
  rabbitmq      Restore RabbitMQ configuration

Options:
  --backup FILE         Path to backup file (required)
  --target-time TIME    Point-in-time recovery target (PostgreSQL only)
  --test                Test restore without modifying production
  --help                Show this help message

Examples:
  # Restore PostgreSQL from backup
  $0 --type postgresql --backup /backups/postgres/backup_20241118.dump.gz

  # Restore Redis from snapshot
  $0 --type redis --backup /backups/redis/snapshot_20241118.rdb.gz

  # Test restore without affecting production
  $0 --type postgresql --backup /backups/postgres/backup_20241118.dump.gz --test
EOF
}

restore_postgresql() {
    log "========================================="
    log "PostgreSQL Restore Starting"
    log "========================================="

    if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
        error "Backup file not found: $BACKUP_FILE"
        return 1
    fi

    if [ -z "$POSTGRES_PASSWORD" ]; then
        error "POSTGRES_PASSWORD not set"
        return 1
    fi

    export PGPASSWORD="$POSTGRES_PASSWORD"

    # Check connectivity
    log "Checking database connectivity..."
    if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" &>/dev/null; then
        error "Cannot connect to PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
        return 1
    fi

    # Create test database if in test mode
    if [ "$TEST_MODE" == "true" ]; then
        local test_db="${POSTGRES_DB}_restore_test_$(date +%s)"
        log "Creating test database: $test_db"
        createdb -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$test_db"
        POSTGRES_DB="$test_db"
    fi

    # Restore from backup
    log "Restoring from backup file: $BACKUP_FILE"
    local restore_start=$(date +%s)

    # Handle different backup formats
    if [[ "$BACKUP_FILE" == *.dump.gz ]]; then
        gunzip -c "$BACKUP_FILE" | pg_restore \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            -F custom \
            -j 4 \
            -v 2>&1 | tee -a "$RESTORE_LOG" || {
            error "PostgreSQL restore failed"
            return 1
        }
    elif [[ "$BACKUP_FILE" == *.sql.gz ]]; then
        gunzip -c "$BACKUP_FILE" | psql \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" 2>&1 | tee -a "$RESTORE_LOG" || {
            error "PostgreSQL restore failed"
            return 1
        }
    else
        error "Unsupported backup format: $BACKUP_FILE"
        return 1
    fi

    local restore_end=$(date +%s)
    local restore_time=$((restore_end - restore_start))

    log "✓ Restore completed in ${restore_time}s"

    # Validate restored data
    log "Validating restored data..."
    local table_count=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | xargs)

    log "Restored tables: $table_count"

    if [ "$table_count" -gt 0 ]; then
        log "✓ Data validation successful"
    else
        warning "No tables found in restored database"
    fi

    unset PGPASSWORD

    log "========================================="
    log "PostgreSQL Restore Complete"
    log "========================================="

    return 0
}

restore_redis() {
    log "========================================="
    log "Redis Restore Starting"
    log "========================================="

    if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
        error "Backup file not found: $BACKUP_FILE"
        return 1
    fi

    # Stop Redis
    log "Stopping Redis..."
    docker-compose stop redis 2>/dev/null || \
        docker stop agent_redis 2>/dev/null || \
        redis-cli -h "$REDIS_HOST" -a "$REDIS_PASSWORD" SHUTDOWN NOSAVE 2>/dev/null || true

    sleep 5

    # Restore RDB snapshot
    log "Restoring RDB snapshot..."

    if [ ! -d "data/redis" ]; then
        mkdir -p data/redis
    fi

    # Extract and copy
    if [[ "$BACKUP_FILE" == *.rdb.gz ]]; then
        gunzip -c "$BACKUP_FILE" >data/redis/dump.rdb
    else
        cp "$BACKUP_FILE" data/redis/dump.rdb
    fi

    # Copy to container if using Docker
    if docker ps | grep -q agent_redis; then
        docker cp data/redis/dump.rdb agent_redis:/data/dump.rdb
        docker exec agent_redis chown redis:redis /data/dump.rdb
        docker exec agent_redis chmod 600 /data/dump.rdb
    fi

    # Start Redis
    log "Starting Redis..."
    docker-compose up -d redis 2>/dev/null || \
        docker start agent_redis 2>/dev/null || \
        redis-server 2>/dev/null || true

    sleep 5

    # Verify
    log "Verifying Redis..."
    if docker exec agent_redis redis-cli PING &>/dev/null 2>&1 || \
        redis-cli -h "$REDIS_HOST" PING &>/dev/null 2>&1; then
        log "✓ Redis is online"

        # Check data
        local key_count=$(docker exec agent_redis redis-cli DBSIZE 2>/dev/null | cut -d: -f2 || echo "unknown")
        log "Keys in Redis: $key_count"
    else
        error "Redis is not responding"
        return 1
    fi

    log "========================================="
    log "Redis Restore Complete"
    log "========================================="

    return 0
}

restore_rabbitmq() {
    log "========================================="
    log "RabbitMQ Restore Starting"
    log "========================================="

    if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
        error "Backup file not found: $BACKUP_FILE"
        return 1
    fi

    log "Extracting definitions..."
    local temp_file="/tmp/rabbitmq_defs_$$.json"

    if [[ "$BACKUP_FILE" == *.gz ]]; then
        gunzip -c "$BACKUP_FILE" >"$temp_file"
    else
        cp "$BACKUP_FILE" "$temp_file"
    fi

    log "Importing RabbitMQ definitions..."
    docker cp "$temp_file" agent_rabbitmq:/tmp/defs.json

    if docker exec agent_rabbitmq rabbitmqctl import_definitions /tmp/defs.json &>/dev/null 2>&1; then
        log "✓ Definitions imported successfully"
    else
        warning "Failed to import definitions, trying reset first"
        docker exec agent_rabbitmq rabbitmqctl reset || true
        docker exec agent_rabbitmq rabbitmqctl start_app || true
        docker exec agent_rabbitmq rabbitmqctl import_definitions /tmp/defs.json || {
            error "Failed to import definitions"
            return 1
        }
    fi

    # Verify
    log "Verifying RabbitMQ..."
    docker exec agent_rabbitmq rabbitmqctl list_queues | wc -l
    local queue_count=$(docker exec agent_rabbitmq rabbitmqctl list_queues 2>/dev/null | grep -c "^" || echo "unknown")
    log "Queues: $queue_count"

    rm -f "$temp_file"

    log "========================================="
    log "RabbitMQ Restore Complete"
    log "========================================="

    return 0
}

main() {
    local type_set=false
    local backup_set=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
        --type)
            BACKUP_TYPE="$2"
            type_set=true
            shift 2
            ;;
        --backup)
            BACKUP_FILE="$2"
            backup_set=true
            shift 2
            ;;
        --target-time)
            TARGET_TIME="$2"
            shift 2
            ;;
        --test)
            TEST_MODE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        esac
    done

    # Validate arguments
    if [ "$type_set" == "false" ] || [ "$backup_set" == "false" ]; then
        error "Missing required arguments"
        show_usage
        exit 1
    fi

    log "========================================="
    log "Restore from Backup"
    log "Type: $BACKUP_TYPE"
    log "Backup: $BACKUP_FILE"
    [ "$TEST_MODE" == "true" ] && log "Mode: TEST (non-production)"
    log "========================================="

    # Execute restore
    case "$BACKUP_TYPE" in
    postgresql)
        restore_postgresql
        ;;
    redis)
        restore_redis
        ;;
    rabbitmq)
        restore_rabbitmq
        ;;
    *)
        error "Unknown backup type: $BACKUP_TYPE"
        show_usage
        exit 1
        ;;
    esac

    log "Restore log saved to: $RESTORE_LOG"
}

main "$@"
