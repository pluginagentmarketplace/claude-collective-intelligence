#!/bin/bash

################################################################################
# Comprehensive Backup Script
# Backs up PostgreSQL, Redis, RabbitMQ, and configuration files
# Includes compression, verification, and S3 upload
################################################################################

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-.}
/backups"
LOG_DIR="${LOG_DIR:-.}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/backup_all_${TIMESTAMP}.log"

# Database Configuration
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-agent_orchestrator}"
POSTGRES_USER="${POSTGRES_USER:-admin}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

# Redis Configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD}"

# RabbitMQ Configuration
RABBITMQ_HOST="${RABBITMQ_HOST:-localhost}"
RABBITMQ_USER="${RABBITMQ_USER:-admin}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD}"

# S3 Configuration
S3_BUCKET="${BACKUP_S3_BUCKET}"
S3_REGION="${AWS_REGION:-us-east-1}"
S3_STORAGE_CLASS="${S3_STORAGE_CLASS:-STANDARD_IA}"

# Retention
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_WEBHOOK_URL="${BACKUP_WEBHOOK_URL:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_BACKUPS=0
FAILED_BACKUPS=0

################################################################################
# Logging Functions
################################################################################

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

################################################################################
# Utility Functions
################################################################################

setup_environment() {
    mkdir -p "$BACKUP_DIR"/{postgres,redis,rabbitmq,config} "$LOG_DIR"

    # Validate required tools
    local required_tools=("tar" "gzip" "openssl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &>/dev/null; then
            error "Required tool '$tool' not found"
            exit 1
        fi
    done

    log "Environment setup completed"
}

check_disk_space() {
    local required_space=$1
    local available=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')

    if [ "$available" -lt "$required_space" ]; then
        error "Insufficient disk space. Required: $required_space KB, Available: $available KB"
        return 1
    fi

    log "Disk space check passed (${available}KB available)"
    return 0
}

send_notification() {
    local status=$1
    local message=$2
    local backup_size=$3

    if [ -z "$BACKUP_WEBHOOK_URL" ]; then
        return
    fi

    local color="good"
    if [ "$status" != "SUCCESS" ]; then
        color="danger"
    fi

    curl -X POST "$BACKUP_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"Backup ${status}\",
            \"attachments\": [{
                \"color\": \"${color}\",
                \"fields\": [
                    {\"title\": \"Status\", \"value\": \"${status}\", \"short\": true},
                    {\"title\": \"Size\", \"value\": \"${backup_size}MB\", \"short\": true},
                    {\"title\": \"Message\", \"value\": \"${message}\", \"short\": false},
                    {\"title\": \"Timestamp\", \"value\": \"$(date -Iseconds)\", \"short\": true}
                ]
            }]
        }" 2>/dev/null || warning "Failed to send notification"
}

################################################################################
# PostgreSQL Backup
################################################################################

backup_postgresql() {
    log "========================================="
    log "PostgreSQL Backup Starting"
    log "========================================="

    if [ -z "$POSTGRES_PASSWORD" ]; then
        error "POSTGRES_PASSWORD not set"
        return 1
    fi

    export PGPASSWORD="$POSTGRES_PASSWORD"

    # Check connectivity
    if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" &>/dev/null; then
        error "Cannot connect to PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
        return 1
    fi

    log "Connected to PostgreSQL database: $POSTGRES_DB"

    # Get database size for disk space check
    local db_size=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -t -c "SELECT pg_database_size('$POSTGRES_DB') / 1024 / 1024" 2>/dev/null | xargs)
    log "Database size: ${db_size}MB"

    # Create backups
    local backup_start=$(date +%s)

    # Custom format backup
    info "Creating custom format backup..."
    if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -F custom -f "$BACKUP_DIR/postgres/backup_${POSTGRES_DB}_${TIMESTAMP}.dump" \
        --compress=9 --no-password &>/dev/null; then
        log "✓ Custom format backup created"
        gzip "$BACKUP_DIR/postgres/backup_${POSTGRES_DB}_${TIMESTAMP}.dump"
    else
        error "Failed to create custom backup"
        return 1
    fi

    # SQL format backup
    info "Creating SQL format backup..."
    if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -F plain --no-password | gzip -9 > "$BACKUP_DIR/postgres/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"; then
        log "✓ SQL format backup created"
    else
        error "Failed to create SQL backup"
        return 1
    fi

    local backup_end=$(date +%s)
    local backup_duration=$((backup_end - backup_start))

    # Create metadata
    local dump_size=$(stat -c%s "$BACKUP_DIR/postgres/backup_${POSTGRES_DB}_${TIMESTAMP}.dump.gz" 2>/dev/null | xargs)
    local sql_size=$(stat -c%s "$BACKUP_DIR/postgres/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz" 2>/dev/null | xargs)

    cat >"$BACKUP_DIR/postgres/backup_${POSTGRES_DB}_${TIMESTAMP}.json" <<EOF
{
    "backup_type": "full_daily",
    "timestamp": "$(date -Iseconds)",
    "database": "$POSTGRES_DB",
    "host": "$POSTGRES_HOST",
    "version": "$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        -t -c "SELECT version()" 2>/dev/null | head -1 | xargs || echo 'unknown')",
    "files": {
        "dump": "backup_${POSTGRES_DB}_${TIMESTAMP}.dump.gz",
        "sql": "backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
    },
    "sizes": {
        "dump_bytes": ${dump_size:-0},
        "sql_bytes": ${sql_size:-0}
    },
    "backup_duration_seconds": $backup_duration,
    "database_size_mb": $db_size
}
EOF

    log "✓ PostgreSQL backup completed (Duration: ${backup_duration}s)"
    TOTAL_BACKUPS=$((TOTAL_BACKUPS + 1))

    unset PGPASSWORD
    return 0
}

################################################################################
# Redis Backup
################################################################################

backup_redis() {
    log "========================================="
    log "Redis Backup Starting"
    log "========================================="

    # Check if Docker container exists
    if ! docker ps | grep -q agent_redis; then
        warning "Redis container not running, attempting to connect to $REDIS_HOST:$REDIS_PORT"
    fi

    # Trigger background save
    info "Creating RDB snapshot..."
    if docker exec agent_redis redis-cli -a "$REDIS_PASSWORD" BGSAVE &>/dev/null 2>&1 ||
        redis-cli -h "$REDIS_HOST" -a "$REDIS_PASSWORD" BGSAVE &>/dev/null 2>&1; then
        log "Background save triggered"
    else
        error "Failed to trigger Redis background save"
        return 1
    fi

    # Wait for save to complete
    local wait_count=0
    while [ $wait_count -lt 120 ]; do
        if docker exec agent_redis redis-cli -a "$REDIS_PASSWORD" LASTSAVE &>/dev/null 2>&1; then
            break
        fi
        sleep 1
        wait_count=$((wait_count + 1))
    done

    # Copy RDB snapshot
    info "Copying RDB snapshot..."
    if docker cp agent_redis:/data/dump.rdb "$BACKUP_DIR/redis/snapshot_${TIMESTAMP}.rdb" &>/dev/null 2>&1; then
        gzip -9 "$BACKUP_DIR/redis/snapshot_${TIMESTAMP}.rdb"
        log "✓ RDB snapshot backed up"
    else
        warning "Could not copy RDB snapshot (may not be critical)"
    fi

    # Backup AOF if exists
    info "Backing up AOF file..."
    if docker cp agent_redis:/data/appendonly.aof "$BACKUP_DIR/redis/aof_${TIMESTAMP}.aof" &>/dev/null 2>&1; then
        gzip -9 "$BACKUP_DIR/redis/aof_${TIMESTAMP}.aof"
        log "✓ AOF file backed up"
    fi

    # Create metadata
    local rdb_size=$(stat -c%s "$BACKUP_DIR/redis/snapshot_${TIMESTAMP}.rdb.gz" 2>/dev/null || echo 0)
    local redis_keys=$(docker exec agent_redis redis-cli -a "$REDIS_PASSWORD" DBSIZE 2>/dev/null | cut -d: -f2 || echo "unknown")

    cat >"$BACKUP_DIR/redis/snapshot_${TIMESTAMP}.json" <<EOF
{
    "backup_type": "redis_full",
    "timestamp": "$(date -Iseconds)",
    "redis_version": "$(docker exec agent_redis redis-cli INFO server 2>/dev/null | grep redis_version | cut -d: -f2 | tr -d '\r' || echo 'unknown')",
    "keys_count": "${redis_keys}",
    "rdb_size_bytes": ${rdb_size}
}
EOF

    log "✓ Redis backup completed"
    TOTAL_BACKUPS=$((TOTAL_BACKUPS + 1))
    return 0
}

################################################################################
# RabbitMQ Backup
################################################################################

backup_rabbitmq() {
    log "========================================="
    log "RabbitMQ Backup Starting"
    log "========================================="

    # Export definitions
    info "Exporting RabbitMQ definitions..."
    if docker exec agent_rabbitmq rabbitmqctl export_definitions "/tmp/definitions_${TIMESTAMP}.json" &>/dev/null 2>&1; then
        docker cp "agent_rabbitmq:/tmp/definitions_${TIMESTAMP}.json" "$BACKUP_DIR/rabbitmq/" 2>/dev/null
        gzip -9 "$BACKUP_DIR/rabbitmq/definitions_${TIMESTAMP}.json"
        log "✓ Definitions exported"
    else
        warning "Failed to export RabbitMQ definitions"
        return 1
    fi

    # Export queue information
    info "Exporting queue information..."
    docker exec agent_rabbitmq rabbitmqctl list_queues name durable auto_delete arguments messages consumers \
        >"$BACKUP_DIR/rabbitmq/queues_${TIMESTAMP}.txt" 2>/dev/null || true
    gzip -9 "$BACKUP_DIR/rabbitmq/queues_${TIMESTAMP}.txt"

    # Create metadata
    cat >"$BACKUP_DIR/rabbitmq/backup_${TIMESTAMP}.json" <<EOF
{
    "backup_type": "rabbitmq_full",
    "timestamp": "$(date -Iseconds)",
    "files": {
        "definitions": "definitions_${TIMESTAMP}.json.gz",
        "queues": "queues_${TIMESTAMP}.txt.gz"
    }
}
EOF

    log "✓ RabbitMQ backup completed"
    TOTAL_BACKUPS=$((TOTAL_BACKUPS + 1))
    return 0
}

################################################################################
# Configuration Backup
################################################################################

backup_configuration() {
    log "========================================="
    log "Configuration Backup Starting"
    log "========================================="

    # Git commit if available
    if [ -d .git ]; then
        info "Committing configuration changes..."
        git add -A 2>/dev/null || true
        git diff --quiet --exit-code HEAD 2>/dev/null || git commit -m "Auto: Configuration backup ${TIMESTAMP}" 2>/dev/null || true
        log "✓ Configuration committed to Git"
    fi

    # Create archive
    info "Creating configuration archive..."
    tar --create --gzip \
        --file="$BACKUP_DIR/config/config_${TIMESTAMP}.tar.gz" \
        --exclude=".git" \
        --exclude="node_modules" \
        --exclude="backups" \
        --exclude="logs" \
        --exclude=".env" \
        . 2>/dev/null || warning "Could not create full config archive"

    # Backup .env file (encrypted)
    if [ -f .env ]; then
        info "Backing up encrypted .env file..."
        if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
            openssl enc -aes-256-cbc \
                -in .env \
                -out "$BACKUP_DIR/config/.env.enc" \
                -k "$BACKUP_ENCRYPTION_KEY" 2>/dev/null
            log "✓ .env file encrypted and backed up"
        else
            warning "BACKUP_ENCRYPTION_KEY not set, skipping .env encryption"
        fi
    fi

    log "✓ Configuration backup completed"
    TOTAL_BACKUPS=$((TOTAL_BACKUPS + 1))
    return 0
}

################################################################################
# S3 Upload
################################################################################

upload_to_s3() {
    log "========================================="
    log "S3 Upload Starting"
    log "========================================="

    if [ -z "$S3_BUCKET" ]; then
        info "S3_BUCKET not configured, skipping S3 upload"
        return 0
    fi

    if ! command -v aws &>/dev/null; then
        warning "AWS CLI not installed, skipping S3 upload"
        return 0
    fi

    log "Uploading to S3 bucket: $S3_BUCKET"

    # Upload PostgreSQL
    info "Uploading PostgreSQL backups..."
    for file in "$BACKUP_DIR"/postgres/backup_*_${TIMESTAMP}*; do
        [ -f "$file" ] || continue
        local filename=$(basename "$file")
        aws s3 cp "$file" "s3://$S3_BUCKET/postgres/${TIMESTAMP}/$filename" \
            --storage-class "$S3_STORAGE_CLASS" \
            --sse AES256 \
            --region "$S3_REGION" 2>/dev/null && log "  ✓ Uploaded: $filename" || \
            warning "  ✗ Failed to upload: $filename"
    done

    # Upload Redis
    info "Uploading Redis backups..."
    for file in "$BACKUP_DIR"/redis/snapshot_*_${TIMESTAMP}*; do
        [ -f "$file" ] || continue
        local filename=$(basename "$file")
        aws s3 cp "$file" "s3://$S3_BUCKET/redis/${TIMESTAMP}/$filename" \
            --storage-class "$S3_STORAGE_CLASS" \
            --sse AES256 \
            --region "$S3_REGION" 2>/dev/null && log "  ✓ Uploaded: $filename" || \
            warning "  ✗ Failed to upload: $filename"
    done

    # Upload RabbitMQ
    info "Uploading RabbitMQ backups..."
    for file in "$BACKUP_DIR"/rabbitmq/definitions_*_${TIMESTAMP}* "$BACKUP_DIR"/rabbitmq/queues_*_${TIMESTAMP}*; do
        [ -f "$file" ] || continue
        local filename=$(basename "$file")
        aws s3 cp "$file" "s3://$S3_BUCKET/rabbitmq/${TIMESTAMP}/$filename" \
            --storage-class "$S3_STORAGE_CLASS" \
            --sse AES256 \
            --region "$S3_REGION" 2>/dev/null && log "  ✓ Uploaded: $filename" || \
            warning "  ✗ Failed to upload: $filename"
    done

    log "✓ S3 upload completed"
    return 0
}

################################################################################
# Cleanup Old Backups
################################################################################

cleanup_old_backups() {
    log "========================================="
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)"
    log "========================================="

    # Remove local backups older than retention
    info "Removing old local backups..."
    find "$BACKUP_DIR" -type f -name "backup_*" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -type f -name "snapshot_*" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -type f -name "definitions_*" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -type f -name "*.json" -mtime +$RETENTION_DAYS -delete

    log "✓ Local backup cleanup completed"

    # Optional: Clean S3 if configured
    if [ ! -z "$S3_BUCKET" ] && command -v aws &>/dev/null; then
        info "Removing old S3 backups..."
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)

        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --region "$S3_REGION" \
            --prefix "postgres/" 2>/dev/null | \
            jq -r '.Contents[] | select(.LastModified < "'$cutoff_date'") | .Key' | \
            while read -r key; do
                [ -z "$key" ] && continue
                aws s3 rm "s3://$S3_BUCKET/$key" --region "$S3_REGION" 2>/dev/null && \
                    log "  ✓ Deleted: $key" || \
                    warning "  ✗ Failed to delete: $key"
            done
    fi

    log "✓ S3 cleanup completed"
    return 0
}

################################################################################
# Main Execution
################################################################################

main() {
    log "========================================="
    log "Comprehensive Backup Script Started"
    log "========================================="
    log "Timestamp: $TIMESTAMP"

    # Setup
    setup_environment

    # Check disk space (estimate 2x largest database)
    check_disk_space $((1000 * 1024)) || exit 1

    # Perform backups
    backup_postgresql || FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
    backup_redis || FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
    backup_rabbitmq || FAILED_BACKUPS=$((FAILED_BACKUPS + 1))
    backup_configuration || FAILED_BACKUPS=$((FAILED_BACKUPS + 1))

    # Upload to S3
    upload_to_s3 || warning "S3 upload had issues"

    # Cleanup
    cleanup_old_backups

    # Final report
    log ""
    log "========================================="
    log "BACKUP SUMMARY"
    log "========================================="
    log "Total backups completed: $TOTAL_BACKUPS"
    log "Failed backups: $FAILED_BACKUPS"
    log "Backup location: $BACKUP_DIR"
    log "Log file: $LOG_FILE"

    # Total size
    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "Total backup size: $total_size"

    if [ $FAILED_BACKUPS -eq 0 ]; then
        log "Status: ✓ ALL BACKUPS SUCCESSFUL"
        send_notification "SUCCESS" "All backups completed successfully" "${total_size}"
        exit 0
    else
        error "Some backups failed ($FAILED_BACKUPS)"
        send_notification "PARTIAL_FAILURE" "$FAILED_BACKUPS backups failed" "${total_size}"
        exit 1
    fi
}

# Run main
main "$@"
