#!/bin/bash

# =============================================
# PostgreSQL Backup Script
# Production-grade backup with rotation and S3 upload
# =============================================

set -euo pipefail

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-agent_orchestrator}"
DB_USER="${POSTGRES_USER:-admin}"
DB_PASSWORD="${POSTGRES_PASSWORD}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
S3_BUCKET="${BACKUP_S3_BUCKET}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DB_NAME}_${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to perform backup
perform_backup() {
    log "Starting PostgreSQL backup for database: $DB_NAME"

    # Set PGPASSWORD for authentication
    export PGPASSWORD="$DB_PASSWORD"

    # Perform full backup
    log "Creating full backup..."
    pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -F custom \
        -b \
        -v \
        -f "$BACKUP_DIR/${BACKUP_FILE}.dump" \
        --no-password \
        2>&1 | while read line; do
            echo "  $line"
        done

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        log "Database dump completed successfully"
    else
        error "Database dump failed"
        exit 1
    fi

    # Create SQL format backup as well
    log "Creating SQL format backup..."
    pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -F plain \
        --no-password \
        > "$BACKUP_DIR/${BACKUP_FILE}.sql" \
        2>/dev/null

    # Compress backups
    log "Compressing backups..."
    gzip -9 "$BACKUP_DIR/${BACKUP_FILE}.dump"
    gzip -9 "$BACKUP_DIR/${BACKUP_FILE}.sql"

    # Create backup metadata
    cat > "$BACKUP_DIR/${BACKUP_FILE}.json" <<EOF
{
    "timestamp": "$(date -Iseconds)",
    "database": "$DB_NAME",
    "host": "$DB_HOST",
    "size_dump": "$(stat -f%z "$BACKUP_DIR/${BACKUP_FILE}.dump.gz" 2>/dev/null || stat -c%s "$BACKUP_DIR/${BACKUP_FILE}.dump.gz" 2>/dev/null)",
    "size_sql": "$(stat -f%z "$BACKUP_DIR/${BACKUP_FILE}.sql.gz" 2>/dev/null || stat -c%s "$BACKUP_DIR/${BACKUP_FILE}.sql.gz" 2>/dev/null)",
    "pg_version": "$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c 'SELECT version()' --no-password | head -1 | xargs)",
    "schema_hash": "$(pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -s --no-password | md5sum | cut -d' ' -f1)"
}
EOF

    log "Backup files created:"
    log "  - ${BACKUP_FILE}.dump.gz"
    log "  - ${BACKUP_FILE}.sql.gz"
    log "  - ${BACKUP_FILE}.json"
}

# Function to upload to S3
upload_to_s3() {
    if [ -z "$S3_BUCKET" ]; then
        warning "S3_BUCKET not configured, skipping S3 upload"
        return
    fi

    log "Uploading backups to S3 bucket: $S3_BUCKET"

    for file in "$BACKUP_DIR/${BACKUP_FILE}"*; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            aws s3 cp "$file" "s3://$S3_BUCKET/postgres/${TIMESTAMP}/$filename" \
                --storage-class STANDARD_IA \
                --metadata "backup-type=postgresql,database=$DB_NAME,timestamp=$TIMESTAMP"

            if [ $? -eq 0 ]; then
                log "  ✓ Uploaded: $filename"
            else
                error "  ✗ Failed to upload: $filename"
            fi
        fi
    done
}

# Function to clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)"

    # Clean local backups
    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.json" -mtime +$RETENTION_DAYS -delete

    deleted_count=$(find "$BACKUP_DIR" -name "backup_${DB_NAME}_*" -mtime +$RETENTION_DAYS | wc -l)
    if [ "$deleted_count" -gt 0 ]; then
        log "Deleted $deleted_count old backup files"
    fi

    # Clean S3 backups if configured
    if [ ! -z "$S3_BUCKET" ]; then
        log "Cleaning S3 backups older than $RETENTION_DAYS days"
        cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)

        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "postgres/" \
            --query "Contents[?LastModified<'$cutoff_date'].Key" \
            --output text | \
        while read -r key; do
            if [ ! -z "$key" ]; then
                aws s3 rm "s3://$S3_BUCKET/$key"
                log "  Deleted from S3: $key"
            fi
        done
    fi
}

# Function to verify backup
verify_backup() {
    log "Verifying backup integrity..."

    # Test if we can read the backup
    pg_restore \
        -l "$BACKUP_DIR/${BACKUP_FILE}.dump.gz" \
        > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        log "✓ Backup verification successful"
        return 0
    else
        error "✗ Backup verification failed"
        return 1
    fi
}

# Function to send notification
send_notification() {
    local status=$1
    local message=$2

    # Send to webhook if configured
    if [ ! -z "${BACKUP_WEBHOOK_URL}" ]; then
        curl -X POST "$BACKUP_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"text\": \"PostgreSQL Backup ${status}\",
                \"attachments\": [{
                    \"color\": \"$([ "$status" == "SUCCESS" ] && echo "good" || echo "danger")\",
                    \"fields\": [
                        {\"title\": \"Database\", \"value\": \"$DB_NAME\", \"short\": true},
                        {\"title\": \"Timestamp\", \"value\": \"$TIMESTAMP\", \"short\": true},
                        {\"title\": \"Message\", \"value\": \"$message\", \"short\": false}
                    ]
                }]
            }" 2>/dev/null
    fi
}

# Main execution
main() {
    log "========================================="
    log "PostgreSQL Backup Script Started"
    log "========================================="

    # Check prerequisites
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi

    if [ -z "$DB_PASSWORD" ]; then
        error "POSTGRES_PASSWORD not set"
        exit 1
    fi

    # Perform backup
    if perform_backup; then
        # Verify backup
        if verify_backup; then
            # Upload to S3
            upload_to_s3

            # Clean old backups
            cleanup_old_backups

            # Calculate backup size
            total_size=$(du -sh "$BACKUP_DIR/${BACKUP_FILE}"* | awk '{sum+=$1} END {print sum}')

            log "========================================="
            log "Backup completed successfully!"
            log "Total backup size: ${total_size}MB"
            log "========================================="

            send_notification "SUCCESS" "Backup completed successfully. Size: ${total_size}MB"
            exit 0
        else
            error "Backup verification failed"
            send_notification "FAILED" "Backup verification failed"
            exit 1
        fi
    else
        error "Backup failed"
        send_notification "FAILED" "Backup process failed"
        exit 1
    fi
}

# Run main function
main