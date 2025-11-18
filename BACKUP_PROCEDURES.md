# Backup Procedures Manual
## AI Agent Orchestrator Platform - Complete Backup Operations Guide

**Document Version:** 1.0
**Last Updated:** November 2024
**Classification:** Internal - Operations
**Owner:** Database & DevOps Teams

---

## Table of Contents

1. [Backup Overview](#backup-overview)
2. [PostgreSQL Backup Procedures](#postgresql-backup-procedures)
3. [Redis Backup Procedures](#redis-backup-procedures)
4. [RabbitMQ Backup Procedures](#rabbitmq-backup-procedures)
5. [Configuration Backup Procedures](#configuration-backup-procedures)
6. [TLS Certificate Backup](#tls-certificate-backup)
7. [Backup Verification](#backup-verification)
8. [Backup Monitoring](#backup-monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Backup Retention Policy](#backup-retention-policy)

---

## Backup Overview

### Backup Architecture

```
┌─────────────────────────────────────────┐
│      AUTOMATED BACKUP SYSTEM            │
├─────────────────────────────────────────┤
│                                         │
│  Backup Trigger (Scheduler/Manual)      │
│           ↓                             │
│  ┌─────────────────────────────────┐   │
│  │ PostgreSQL Full + Incremental   │   │
│  ├─────────────────────────────────┤   │
│  │ - Custom dump format            │   │
│  │ - SQL text format               │   │
│  │ - Continuous WAL archiving      │   │
│  │ - Compression (gzip -9)         │   │
│  │ - Metadata JSON                 │   │
│  │ - Integrity verification        │   │
│  └─────────────────────────────────┘   │
│           ↓                             │
│  ┌─────────────────────────────────┐   │
│  │ Redis Full + Incremental        │   │
│  ├─────────────────────────────────┤   │
│  │ - RDB snapshots                 │   │
│  │ - AOF file backup               │   │
│  │ - Compression                   │   │
│  │ - Replication check             │   │
│  │ - Metadata                      │   │
│  └─────────────────────────────────┘   │
│           ↓                             │
│  ┌─────────────────────────────────┐   │
│  │ RabbitMQ Config + Messages      │   │
│  ├─────────────────────────────────┤   │
│  │ - Queue definitions             │   │
│  │ - Message persistence dump      │   │
│  │ - Configuration files           │   │
│  │ - Metadata                      │   │
│  └─────────────────────────────────┘   │
│           ↓                             │
│  ┌─────────────────────────────────┐   │
│  │ Application Configuration       │   │
│  ├─────────────────────────────────┤   │
│  │ - .env files (encrypted)        │   │
│  │ - Config files (.yml, .json)    │   │
│  │ - TLS certificates              │   │
│  │ - Deployment files              │   │
│  └─────────────────────────────────┘   │
│           ↓                             │
│  ┌─────────────────────────────────┐   │
│  │ Storage & Verification          │   │
│  ├─────────────────────────────────┤   │
│  │ - Local NFS (7-day retention)   │   │
│  │ - S3 Standard (30-day)          │   │
│  │ - S3 Glacier (90-day archive)   │   │
│  │ - Cross-region replication      │   │
│  │ - Integrity checks              │   │
│  │ - Alerts on failure             │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Backup Frequency Summary

| System | Full Backup | Incremental | Frequency | Retention |
|--------|-------------|-------------|-----------|-----------|
| PostgreSQL | 1 per day | Hourly WAL | 2:00 AM daily | 30 days |
| Redis | 1 per day | Hourly RDB | 2:00 AM daily | 30 days |
| RabbitMQ | 1 per day | On-demand | 2:00 AM daily | 30 days |
| Config | On-change | N/A | Continuous | 90 days |
| TLS Certs | On-change | N/A | Immediate | 7 years |

---

## PostgreSQL Backup Procedures

### Pre-Backup Checklist

- [ ] Database is healthy (pg_isready returns 0)
- [ ] Disk space available (min 2x database size)
- [ ] Backup destination mounted and writable
- [ ] Previous backup completed successfully
- [ ] No long-running transactions blocking backup
- [ ] Network connectivity to S3 (if uploading)
- [ ] All necessary credentials available

### Daily Full Backup Procedure

#### Step 1: Verify Database Connectivity

```bash
#!/bin/bash

# Check if database is accessible
export PGPASSWORD="${POSTGRES_PASSWORD}"

pg_isready \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}"

if [ $? -ne 0 ]; then
  echo "ERROR: Database not accessible"
  exit 1
fi

echo "✓ Database is accessible"
```

#### Step 2: Check Available Disk Space

```bash
#!/bin/bash

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
DB_SIZE=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" -t -c \
  "SELECT pg_database_size('$POSTGRES_DB') / 1024 / 1024" | xargs)

AVAILABLE_SPACE=$(df "$BACKUP_DIR" | tail -1 | awk '{print $4}')
REQUIRED_SPACE=$((DB_SIZE * 2))

echo "Database Size: ${DB_SIZE}MB"
echo "Available Space: ${AVAILABLE_SPACE}KB"
echo "Required Space: ${REQUIRED_SPACE}MB"

if [ "$AVAILABLE_SPACE" -lt $((REQUIRED_SPACE * 1024)) ]; then
  echo "ERROR: Insufficient disk space"
  exit 1
fi

echo "✓ Sufficient disk space available"
```

#### Step 3: Create Custom Format Backup (Primary)

```bash
#!/bin/bash

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.dump"

echo "Creating PostgreSQL backup: ${BACKUP_FILE}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --format=custom \
  --file="${BACKUP_FILE}" \
  --compress=9 \
  --blobs \
  --verbose \
  --no-password

echo "✓ Custom format backup created"
```

**Why Custom Format?**
- Fastest restore times (can parallelize)
- Selective object restoration possible
- Compression built-in
- Includes all metadata
- Industry standard for production

#### Step 4: Create SQL Format Backup (Secondary)

```bash
#!/bin/bash

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql"

echo "Creating SQL format backup: ${BACKUP_FILE}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --format=plain \
  --file="${BACKUP_FILE}" \
  --verbose \
  --no-password

# Compress after creation
gzip -9v "${BACKUP_FILE}"

echo "✓ SQL format backup created and compressed"
```

**Why SQL Format?**
- Human-readable for verification
- Portable between PostgreSQL versions
- Can be edited before restore
- Useful for selective restoration
- Good for compliance audits

#### Step 5: Generate Backup Metadata

```bash
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
METADATA_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.json"

# Get database information
DUMP_SIZE=$(stat -c%s "${BACKUP_FILE}.dump.gz" 2>/dev/null || stat -f%z "${BACKUP_FILE}.dump.gz")
SQL_SIZE=$(stat -c%s "${BACKUP_FILE}.sql.gz" 2>/dev/null || stat -f%z "${BACKUP_FILE}.sql.gz")
TABLE_COUNT=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" | xargs)
ROW_COUNT=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" -t -c \
  "SELECT sum(n_live_tup) FROM pg_stat_user_tables" | xargs)
SCHEMA_HASH=$(pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" -s -N public --no-password 2>/dev/null | \
  md5sum | cut -d' ' -f1)

cat > "${METADATA_FILE}" <<EOF
{
  "backup_type": "full_daily",
  "timestamp": "$(date -Iseconds)",
  "database": "${POSTGRES_DB}",
  "host": "${POSTGRES_HOST}",
  "version": "$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" -t -c "SELECT version()" | head -1 | xargs)",
  "backup_method": "pg_dump",
  "files": {
    "dump_custom": {
      "name": "backup_${DB_NAME}_${TIMESTAMP}.dump.gz",
      "size_bytes": ${DUMP_SIZE},
      "size_mb": $((DUMP_SIZE / 1024 / 1024))
    },
    "dump_sql": {
      "name": "backup_${DB_NAME}_${TIMESTAMP}.sql.gz",
      "size_bytes": ${SQL_SIZE},
      "size_mb": $((SQL_SIZE / 1024 / 1024))
    }
  },
  "database_stats": {
    "table_count": ${TABLE_COUNT},
    "row_count": ${ROW_COUNT},
    "schema_hash": "${SCHEMA_HASH}"
  },
  "backup_time_seconds": ${BACKUP_DURATION},
  "compression_ratio": $(echo "scale=2; 100 * (1 - ($DUMP_SIZE / $UNCOMPRESSED_SIZE))" | bc),
  "s3_uploaded": false,
  "s3_bucket": "${S3_BUCKET:-null}",
  "verification_status": "pending",
  "retention_days": ${BACKUP_RETENTION_DAYS:-30}
}
EOF

echo "✓ Metadata file created"
cat "${METADATA_FILE}"
```

#### Step 6: Compress and Archive

```bash
#!/bin/bash

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
ARCHIVE_DIR="${BACKUP_DIR}/archives"

mkdir -p "${ARCHIVE_DIR}"

# Create tar archive of all backup files
tar --create \
    --gzip \
    --file="${ARCHIVE_DIR}/backup_${TIMESTAMP}.tar.gz" \
    --directory="${BACKUP_DIR}" \
    "backup_${DB_NAME}_${TIMESTAMP}.dump.gz" \
    "backup_${DB_NAME}_${TIMESTAMP}.sql.gz" \
    "backup_${DB_NAME}_${TIMESTAMP}.json"

echo "✓ Backup archive created"
```

### Hourly Incremental Backup (WAL Archiving)

PostgreSQL Write-Ahead Log (WAL) archiving provides continuous backup capability.

#### Enable WAL Archiving in PostgreSQL

```sql
-- Connect as superuser
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command =
  'test ! -f /backups/postgres/wal/%f && cp %p /backups/postgres/wal/%f';
ALTER SYSTEM SET archive_timeout = 300;  -- 5 minutes

-- Restart PostgreSQL for settings to take effect
SELECT pg_reload_conf();
```

#### Monitor WAL Archiving

```bash
#!/bin/bash

# Check archiving status
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
  "SELECT archived_count, failed_count FROM pg_stat_archiver;"

# Expected output:
# archived_count | failed_count
# ───────────────┼──────────────
#      45672     |      0

# List recent WAL files
ls -lh /backups/postgres/wal/ | tail -10

# Check WAL archive size
du -sh /backups/postgres/wal/
```

### Upload to S3

```bash
#!/bin/bash

set -euo pipefail

S3_BUCKET="${BACKUP_S3_BUCKET:-backup-agent-platform-prod}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"

echo "Uploading PostgreSQL backups to S3..."

# Upload dump file
aws s3 cp \
  "${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.dump.gz" \
  "s3://${S3_BUCKET}/postgres/${TIMESTAMP}/backup.dump.gz" \
  --storage-class STANDARD_IA \
  --metadata "backup-type=postgresql,database=${POSTGRES_DB},timestamp=${TIMESTAMP}" \
  --sse AES256

# Upload SQL file
aws s3 cp \
  "${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz" \
  "s3://${S3_BUCKET}/postgres/${TIMESTAMP}/backup.sql.gz" \
  --storage-class STANDARD_IA \
  --metadata "backup-type=postgresql,database=${POSTGRES_DB},timestamp=${TIMESTAMP}" \
  --sse AES256

# Upload metadata
aws s3 cp \
  "${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.json" \
  "s3://${S3_BUCKET}/postgres/${TIMESTAMP}/metadata.json" \
  --metadata "backup-type=postgresql,database=${POSTGRES_DB},timestamp=${TIMESTAMP}" \
  --sse AES256

echo "✓ PostgreSQL backups uploaded to S3"

# Verify uploads
echo "Verifying S3 uploads..."
aws s3 ls "s3://${S3_BUCKET}/postgres/${TIMESTAMP}/" --recursive --human-readable
```

---

## Redis Backup Procedures

### Pre-Backup Checklist

- [ ] Redis is healthy and accessible
- [ ] Memory usage < max memory threshold
- [ ] Disk space available for snapshot
- [ ] No replication lag
- [ ] AOF file is healthy (if enabled)
- [ ] Network connectivity for S3 upload

### Redis Backup Methods

#### Method 1: RDB (Snapshots)

**When to use:** Fast backups, point-in-time recovery, small RPO needed

```bash
#!/bin/bash

echo "Creating Redis RDB snapshot..."

# Trigger background save (non-blocking)
docker exec agent_redis redis-cli BGSAVE

# Monitor save progress
while true; do
  SAVE_STATUS=$(docker exec agent_redis redis-cli \
    --raw LASTSAVE | tr -d '\r')

  CURRENT_TIME=$(date +%s)

  if [ $((CURRENT_TIME - SAVE_STATUS)) -lt 60 ]; then
    echo "✓ Snapshot created at $(date -d @$SAVE_STATUS)"
    break
  fi

  sleep 5
  echo "Snapshot in progress..."
done

# Copy snapshot from container
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker cp agent_redis:/data/dump.rdb \
  ./backups/redis/snapshot_${TIMESTAMP}.rdb

echo "✓ RDB snapshot backed up"
```

**RDB Advantages:**
- Fast, efficient snapshots
- Compact format
- Point-in-time recovery
- Easy to transfer

**RDB Disadvantages:**
- Data loss if crash occurs between snapshots
- CPU-intensive BGSAVE
- Large memory spike during fork

#### Method 2: AOF (Append-Only File)

**When to use:** Durability needed, minimal data loss

```bash
#!/bin/bash

echo "Backing up Redis AOF..."

# Optional: Rewrite AOF (compacts it)
docker exec agent_redis redis-cli BGREWRITEAOF

# Wait for rewrite to complete
while true; do
  REWRITE=$(docker exec agent_redis redis-cli \
    INFO persistence | grep aof_rewrite_in_progress | cut -d: -f2 | tr -d '\r')

  if [ "$REWRITE" -eq 0 ]; then
    echo "✓ AOF rewrite complete"
    break
  fi

  sleep 2
done

# Copy AOF file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker cp agent_redis:/data/appendonly.aof \
  ./backups/redis/aof_${TIMESTAMP}.aof

# Compress for storage
gzip -9 ./backups/redis/aof_${TIMESTAMP}.aof

echo "✓ AOF backed up and compressed"
```

**AOF Advantages:**
- Durable, minimal data loss
- Rewritable (compact format)
- Can recover point-in-time
- Human-readable (for first few lines)

**AOF Disadvantages:**
- Larger files than RDB
- Slower than RDB
- Rewriting blocks writes

#### Method 3: Hybrid (RDB + AOF)

**Current Configuration in docker-compose.yml:**

```yaml
redis:
  command: >
    redis-server
    --appendonly yes
    --appendfsync everysec
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
    --requirepass ${REDIS_PASSWORD:-redis123}
```

**This configuration:**
- RDB snapshots on shutdown/save
- AOF writes for every second
- Combined recovery capability

### Full Redis Backup Procedure

```bash
#!/bin/bash
# scripts/backup-redis.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/redis}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD}"

echo "========================================="
echo "Redis Backup Starting"
echo "========================================="

mkdir -p "$BACKUP_DIR"

# Step 1: Create RDB snapshot
echo "Creating RDB snapshot..."
docker exec agent_redis redis-cli -a "$REDIS_PASSWORD" \
  BGSAVE 2>/dev/null || redis-cli -a "$REDIS_PASSWORD" BGSAVE

# Wait for snapshot
for i in {1..60}; do
  LASTSAVE=$(docker exec agent_redis redis-cli \
    -a "$REDIS_PASSWORD" LASTSAVE 2>/dev/null | tail -1)

  CURRENT_TIME=$(date +%s)
  if [ $((CURRENT_TIME - LASTSAVE)) -lt 10 ]; then
    echo "✓ RDB snapshot completed"
    break
  fi

  [ $i -eq 60 ] && echo "⚠ RDB snapshot still pending..."
  sleep 1
done

# Step 2: Copy RDB snapshot
echo "Copying RDB snapshot..."
docker cp agent_redis:/data/dump.rdb \
  "$BACKUP_DIR/snapshot_${TIMESTAMP}.rdb"

# Step 3: Copy AOF file
echo "Copying AOF file..."
docker cp agent_redis:/data/appendonly.aof \
  "$BACKUP_DIR/aof_${TIMESTAMP}.aof" 2>/dev/null || true

# Step 4: Create metadata
echo "Creating metadata..."
cat > "$BACKUP_DIR/snapshot_${TIMESTAMP}.json" <<EOF
{
  "backup_type": "redis_full",
  "timestamp": "$(date -Iseconds)",
  "redis_version": "$(docker exec agent_redis redis-cli INFO server | grep redis_version | cut -d: -f2 | tr -d '\r')",
  "memory_used_mb": $(docker exec agent_redis redis-cli INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r'),
  "keys_count": $(docker exec agent_redis redis-cli DBSIZE | cut -d: -f2 | tr -d '\r'),
  "files": {
    "rdb": "snapshot_${TIMESTAMP}.rdb",
    "aof": "aof_${TIMESTAMP}.aof"
  },
  "replication_info": {
    "role": "$(docker exec agent_redis redis-cli INFO replication | grep role | cut -d: -f2 | tr -d '\r')",
    "connected_slaves": $(docker exec agent_redis redis-cli INFO replication | grep connected_slaves | cut -d: -f2 | tr -d '\r')
  }
}
EOF

# Step 5: Compress backups
echo "Compressing backups..."
gzip -9 "$BACKUP_DIR/snapshot_${TIMESTAMP}.rdb"
[ -f "$BACKUP_DIR/aof_${TIMESTAMP}.aof" ] && \
  gzip -9 "$BACKUP_DIR/aof_${TIMESTAMP}.aof"

echo "========================================="
echo "✓ Redis backup completed successfully"
echo "========================================="
```

### Redis S3 Upload

```bash
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
S3_BUCKET="backup-agent-platform-prod"

# Upload RDB snapshot
aws s3 cp \
  "./backups/redis/snapshot_${TIMESTAMP}.rdb.gz" \
  "s3://${S3_BUCKET}/redis/${TIMESTAMP}/snapshot.rdb.gz" \
  --storage-class STANDARD_IA

# Upload AOF
aws s3 cp \
  "./backups/redis/aof_${TIMESTAMP}.aof.gz" \
  "s3://${S3_BUCKET}/redis/${TIMESTAMP}/aof.aof.gz" \
  --storage-class STANDARD_IA

# Upload metadata
aws s3 cp \
  "./backups/redis/snapshot_${TIMESTAMP}.json" \
  "s3://${S3_BUCKET}/redis/${TIMESTAMP}/metadata.json"

echo "✓ Redis backups uploaded to S3"
```

---

## RabbitMQ Backup Procedures

### Pre-Backup Checklist

- [ ] RabbitMQ is healthy and accessible
- [ ] All nodes reachable in cluster
- [ ] No pending queue operations
- [ ] Disk space available
- [ ] Management API accessible

### RabbitMQ Configuration Export

```bash
#!/bin/bash
# Export complete RabbitMQ definitions

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups/rabbitmq}"

mkdir -p "$BACKUP_DIR"

echo "Exporting RabbitMQ definitions..."

# Export everything (queues, exchanges, bindings, policies, users)
docker exec agent_rabbitmq \
  rabbitmqctl export_definitions \
  "/tmp/definitions_${TIMESTAMP}.json"

# Copy to backup directory
docker cp \
  "agent_rabbitmq:/tmp/definitions_${TIMESTAMP}.json" \
  "$BACKUP_DIR/definitions_${TIMESTAMP}.json"

# Compress
gzip -9 "$BACKUP_DIR/definitions_${TIMESTAMP}.json"

echo "✓ RabbitMQ definitions exported"

# Verify export
echo "Verifying definitions file..."
gunzip -t "$BACKUP_DIR/definitions_${TIMESTAMP}.json.gz"

echo "✓ Definitions file verified"
```

### RabbitMQ Queue Information Export

```bash
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups/rabbitmq}"

echo "Exporting queue information..."

# Get detailed queue information
docker exec agent_rabbitmq \
  rabbitmqctl list_queues name durable auto_delete \
    arguments messages consumers > \
  "$BACKUP_DIR/queues_${TIMESTAMP}.txt"

# Get exchange information
docker exec agent_rabbitmq \
  rabbitmqctl list_exchanges name type durable \
    auto_delete > \
  "$BACKUP_DIR/exchanges_${TIMESTAMP}.txt"

# Get binding information
docker exec agent_rabbitmq \
  rabbitmqctl list_bindings source destination routing_key > \
  "$BACKUP_DIR/bindings_${TIMESTAMP}.txt"

# Compress all queue info
gzip -9 "$BACKUP_DIR/queues_${TIMESTAMP}.txt"
gzip -9 "$BACKUP_DIR/exchanges_${TIMESTAMP}.txt"
gzip -9 "$BACKUP_DIR/bindings_${TIMESTAMP}.txt"

echo "✓ Queue information exported"
```

### RabbitMQ Message Dump (Persistent Queues)

```bash
#!/bin/bash

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups/rabbitmq}"

echo "Exporting persistent messages..."

# Note: RabbitMQ stores persistent messages in Mnesia database
# We can get count and some info via management API

# Get message counts per queue
docker exec agent_rabbitmq \
  rabbitmqctl list_queues name messages > \
  "$BACKUP_DIR/message_counts_${TIMESTAMP}.txt"

# Export via management API (requires http credentials)
curl -s -u "${RABBITMQ_USER:-admin}:${RABBITMQ_PASSWORD}" \
  http://localhost:15672/api/queues \
  > "$BACKUP_DIR/api_queues_${TIMESTAMP}.json"

gzip -9 "$BACKUP_DIR/message_counts_${TIMESTAMP}.txt"
gzip -9 "$BACKUP_DIR/api_queues_${TIMESTAMP}.json"

echo "✓ Message information exported"
```

### Complete RabbitMQ Backup Script

```bash
#!/bin/bash
# scripts/backup-rabbitmq.sh

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups/rabbitmq}"

echo "========================================="
echo "RabbitMQ Backup Starting"
echo "========================================="

mkdir -p "$BACKUP_DIR"

# Step 1: Export definitions
echo "Step 1: Exporting RabbitMQ definitions..."
docker exec agent_rabbitmq \
  rabbitmqctl export_definitions "/tmp/definitions_${TIMESTAMP}.json" \
  --format json 2>/dev/null || true

docker cp "agent_rabbitmq:/tmp/definitions_${TIMESTAMP}.json" \
  "$BACKUP_DIR/definitions_${TIMESTAMP}.json" 2>/dev/null || true

# Step 2: Export queues
echo "Step 2: Exporting queue information..."
docker exec agent_rabbitmq \
  rabbitmqctl list_queues name durable auto_delete arguments \
    messages consumers > "$BACKUP_DIR/queues_${TIMESTAMP}.txt"

# Step 3: Export exchanges
echo "Step 3: Exporting exchanges..."
docker exec agent_rabbitmq \
  rabbitmqctl list_exchanges name type durable auto_delete \
    > "$BACKUP_DIR/exchanges_${TIMESTAMP}.txt"

# Step 4: Export bindings
echo "Step 4: Exporting bindings..."
docker exec agent_rabbitmq \
  rabbitmqctl list_bindings source destination routing_key \
    arguments > "$BACKUP_DIR/bindings_${TIMESTAMP}.txt"

# Step 5: Export policies
echo "Step 5: Exporting policies..."
docker exec agent_rabbitmq \
  rabbitmqctl list_policies > "$BACKUP_DIR/policies_${TIMESTAMP}.txt"

# Step 6: Export users and permissions
echo "Step 6: Exporting users..."
docker exec agent_rabbitmq \
  rabbitmqctl list_users > "$BACKUP_DIR/users_${TIMESTAMP}.txt"

# Step 7: Create metadata
echo "Step 7: Creating metadata..."
cat > "$BACKUP_DIR/backup_${TIMESTAMP}.json" <<EOF
{
  "backup_type": "rabbitmq_full",
  "timestamp": "$(date -Iseconds)",
  "rabbitmq_version": "$(docker exec agent_rabbitmq rabbitmqctl status | grep -i version | head -1 | xargs || echo 'unknown')",
  "files": {
    "definitions": "definitions_${TIMESTAMP}.json",
    "queues": "queues_${TIMESTAMP}.txt",
    "exchanges": "exchanges_${TIMESTAMP}.txt",
    "bindings": "bindings_${TIMESTAMP}.txt",
    "policies": "policies_${TIMESTAMP}.txt",
    "users": "users_${TIMESTAMP}.txt"
  },
  "cluster_info": {
    "nodes": $(docker exec agent_rabbitmq rabbitmqctl cluster_status 2>/dev/null | grep -c 'rabbit@' || echo "1"),
    "status": "$(docker exec agent_rabbitmq rabbitmqctl status 2>&1 | grep -E 'Status of|^ok' | tail -1 | xargs)"
  }
}
EOF

# Step 8: Compress all files
echo "Step 8: Compressing files..."
for file in "$BACKUP_DIR"/*_${TIMESTAMP}.{txt,json}; do
  [ -f "$file" ] && gzip -9 "$file"
done

echo "========================================="
echo "✓ RabbitMQ backup completed successfully"
echo "========================================="
```

---

## Configuration Backup Procedures

### Version-Controlled Configuration

The application configuration should be stored in Git for versioning and easy recovery.

```bash
#!/bin/bash
# scripts/backup-config.sh

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups/config}"

echo "========================================="
echo "Configuration Backup Starting"
echo "========================================="

mkdir -p "$BACKUP_DIR"

# Step 1: Create Git commit if changes exist
echo "Step 1: Committing configuration to Git..."
git add -A
git diff --quiet --exit-code HEAD || \
  git commit -m "Auto: Configuration backup ${TIMESTAMP}"

# Step 2: Export configuration files
echo "Step 2: Exporting configuration files..."
tar --create \
    --gzip \
    --file="$BACKUP_DIR/config_${TIMESTAMP}.tar.gz" \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude=".env" \
    . 2>/dev/null || true

# Step 3: Encrypt and backup .env file separately
if [ -f .env ]; then
  echo "Step 3: Backing up encrypted secrets..."
  openssl enc -aes-256-cbc \
    -in .env \
    -out "$BACKUP_DIR/.env.enc" \
    -k "${BACKUP_ENCRYPTION_KEY}"
fi

# Step 4: Backup environment-specific configs
echo "Step 4: Backing up environment configs..."
for env_file in .env.production .env.staging .env.development; do
  if [ -f "$env_file" ]; then
    openssl enc -aes-256-cbc \
      -in "$env_file" \
      -out "$BACKUP_DIR/${env_file}.enc" \
      -k "${BACKUP_ENCRYPTION_KEY}"
  fi
done

# Step 5: Create manifest
echo "Step 5: Creating backup manifest..."
cat > "$BACKUP_DIR/manifest_${TIMESTAMP}.json" <<EOF
{
  "backup_timestamp": "$(date -Iseconds)",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD)",
  "files_included": [
    "docker-compose.yml",
    "docker-compose.prod.yml",
    "Dockerfile",
    ".dockerignore",
    "nginx.conf",
    "redis.conf",
    "rabbitmq.conf",
    "migrations/*",
    "config/*",
    "scripts/*"
  ],
  "encrypted_files": [
    ".env",
    ".env.production",
    ".env.staging",
    ".env.development"
  ]
}
EOF

echo "========================================="
echo "✓ Configuration backup completed"
echo "========================================="
```

---

## TLS Certificate Backup

### Certificate Backup Procedure

```bash
#!/bin/bash
# scripts/backup-tls-certs.sh

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups/certs}"
CERT_DIR="${CERT_DIR:-.}"

echo "========================================="
echo "TLS Certificate Backup Starting"
echo "========================================="

mkdir -p "$BACKUP_DIR"

# Backup all TLS certificates and keys
echo "Backing up TLS certificates..."

# Find all certificate files
find "$CERT_DIR" \
  -type f \
  \( -name "*.crt" -o -name "*.key" -o -name "*.pem" \
     -o -name "*.p12" -o -name "*.pfx" \) \
  2>/dev/null | while read cert_file; do

  # Skip if in backup directory already
  [[ "$cert_file" == *"backups"* ]] && continue

  # Copy to backup directory preserving structure
  mkdir -p "$BACKUP_DIR/$(dirname "$cert_file")"
  cp "$cert_file" "$BACKUP_DIR/$cert_file"

  echo "✓ Backed up: $cert_file"
done

# Create certificate inventory
echo "Creating certificate inventory..."
cat > "$BACKUP_DIR/cert_inventory_${TIMESTAMP}.json" <<'EOF'
[
EOF

first=true
find "$BACKUP_DIR" -type f \( -name "*.crt" -o -name "*.pem" \) | while read cert; do
  # Extract certificate info
  SUBJECT=$(openssl x509 -in "$cert" -noout -subject 2>/dev/null | sed 's/subject=//g' || echo "")
  ISSUER=$(openssl x509 -in "$cert" -noout -issuer 2>/dev/null | sed 's/issuer=//g' || echo "")
  VALID_FROM=$(openssl x509 -in "$cert" -noout -startdate 2>/dev/null | sed 's/notBefore=//g' || echo "")
  VALID_TO=$(openssl x509 -in "$cert" -noout -enddate 2>/dev/null | sed 's/notAfter=//g' || echo "")

  [ "$first" = false ] && echo "," >> "$BACKUP_DIR/cert_inventory_${TIMESTAMP}.json"

  cat >> "$BACKUP_DIR/cert_inventory_${TIMESTAMP}.json" <<EOF
  {
    "file": "$cert",
    "subject": "$SUBJECT",
    "issuer": "$ISSUER",
    "valid_from": "$VALID_FROM",
    "valid_to": "$VALID_TO"
  }
EOF

  first=false
done

cat >> "$BACKUP_DIR/cert_inventory_${TIMESTAMP}.json" <<'EOF'
]
EOF

# Encrypt entire backup
echo "Encrypting certificate backup..."
tar --create \
    --gzip \
    --file - \
    --directory="$BACKUP_DIR" . | \
  openssl enc -aes-256-cbc \
    -out "$BACKUP_DIR/certificates_${TIMESTAMP}.tar.gz.enc" \
    -k "${BACKUP_ENCRYPTION_KEY}"

echo "========================================="
echo "✓ TLS certificate backup completed"
echo "========================================="
```

---

## Backup Verification

### Automated Backup Verification Script

```bash
#!/bin/bash
# scripts/backup-verify.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
REPORT_FILE="backup_verification_$(date +%Y%m%d_%H%M%S).report"

echo "========================================="
echo "Backup Verification Report"
echo "========================================="
echo "Generated: $(date -Iseconds)" | tee "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

PASSED=0
FAILED=0
WARNINGS=0

# PostgreSQL Backups
echo "=== PostgreSQL Backups ===" | tee -a "$REPORT_FILE"
for backup_file in "$BACKUP_DIR"/postgres/backup_*.dump.gz; do
  if [ -f "$backup_file" ]; then
    echo "Checking: $(basename "$backup_file")" | tee -a "$REPORT_FILE"

    # Check if file is readable
    if gzip -t "$backup_file" 2>/dev/null; then
      SIZE=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file")
      echo "  ✓ File integrity OK (Size: $((SIZE / 1024 / 1024))MB)" | tee -a "$REPORT_FILE"
      ((PASSED++))
    else
      echo "  ✗ File corruption detected!" | tee -a "$REPORT_FILE"
      ((FAILED++))
    fi

    # Check age
    AGE=$(($(date +%s) - $(stat -c%Y "$backup_file" 2>/dev/null || stat -f%m "$backup_file")))
    if [ $AGE -lt 86400 ]; then
      echo "  ✓ Age OK (< 24 hours)" | tee -a "$REPORT_FILE"
    else
      echo "  ⚠ Age WARNING (> 24 hours)" | tee -a "$REPORT_FILE"
      ((WARNINGS++))
    fi
  fi
done

# Redis Backups
echo "" | tee -a "$REPORT_FILE"
echo "=== Redis Backups ===" | tee -a "$REPORT_FILE"
for backup_file in "$BACKUP_DIR"/redis/snapshot_*.rdb.gz; do
  if [ -f "$backup_file" ]; then
    echo "Checking: $(basename "$backup_file")" | tee -a "$REPORT_FILE"

    if gzip -t "$backup_file" 2>/dev/null; then
      SIZE=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file")
      echo "  ✓ File integrity OK (Size: $((SIZE / 1024 / 1024))MB)" | tee -a "$REPORT_FILE"
      ((PASSED++))
    else
      echo "  ✗ File corruption detected!" | tee -a "$REPORT_FILE"
      ((FAILED++))
    fi
  fi
done

# RabbitMQ Backups
echo "" | tee -a "$REPORT_FILE"
echo "=== RabbitMQ Backups ===" | tee -a "$REPORT_FILE"
for backup_file in "$BACKUP_DIR"/rabbitmq/*.gz; do
  if [ -f "$backup_file" ]; then
    echo "Checking: $(basename "$backup_file")" | tee -a "$REPORT_FILE"

    if gzip -t "$backup_file" 2>/dev/null; then
      SIZE=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file")
      echo "  ✓ File integrity OK (Size: $((SIZE / 1024 / 1024))MB)" | tee -a "$REPORT_FILE"
      ((PASSED++))
    else
      echo "  ✗ File corruption detected!" | tee -a "$REPORT_FILE"
      ((FAILED++))
    fi
  fi
done

# Summary
echo "" | tee -a "$REPORT_FILE"
echo "=== SUMMARY ===" | tee -a "$REPORT_FILE"
echo "Passed Checks: $PASSED" | tee -a "$REPORT_FILE"
echo "Failed Checks: $FAILED" | tee -a "$REPORT_FILE"
echo "Warnings: $WARNINGS" | tee -a "$REPORT_FILE"

if [ $FAILED -eq 0 ]; then
  echo "Status: ✓ ALL BACKUPS VERIFIED SUCCESSFULLY" | tee -a "$REPORT_FILE"
  exit 0
else
  echo "Status: ✗ BACKUP VERIFICATION FAILED" | tee -a "$REPORT_FILE"
  exit 1
fi
```

---

## Backup Monitoring

### Backup Job Monitoring

```bash
#!/bin/bash
# scripts/monitor-backups.sh

# Monitor backup job status
docker exec postgres pg_dump --help > /dev/null && \
  echo "✓ PostgreSQL backup tools available"

docker exec redis redis-cli PING > /dev/null && \
  echo "✓ Redis is accessible"

docker exec rabbitmq rabbitmqctl status > /dev/null && \
  echo "✓ RabbitMQ is accessible"

# Check backup directory space
echo ""
echo "Backup Directory Space Usage:"
du -sh "$BACKUP_DIR"/*

# Check last backup times
echo ""
echo "Last Backup Times:"
echo "PostgreSQL: $(ls -t "$BACKUP_DIR"/postgres/backup_*.dump.gz 2>/dev/null | head -1 | xargs -I {} stat -c %y {} || echo 'No backup found')"
echo "Redis: $(ls -t "$BACKUP_DIR"/redis/snapshot_*.rdb.gz 2>/dev/null | head -1 | xargs -I {} stat -c %y {} || echo 'No backup found')"
echo "RabbitMQ: $(ls -t "$BACKUP_DIR"/rabbitmq/*.gz 2>/dev/null | head -1 | xargs -I {} stat -c %y {} || echo 'No backup found')"
```

---

## Troubleshooting

### Common Backup Issues & Solutions

#### Issue: Backup Process Running Out of Disk Space

**Symptoms:**
- Backup fails with "No space left on device"
- Backup files incomplete

**Solutions:**
```bash
# Check current disk usage
du -sh /backups/*

# Remove old backups
find /backups -name "backup_*" -mtime +30 -delete

# Check for large files taking space
find /backups -size +500M -type f

# Expand volume if needed
docker volume inspect backup_volume
```

#### Issue: PostgreSQL Backup Taking Too Long

**Symptoms:**
- Backup takes > 2 hours
- Database performance degraded

**Solutions:**
```bash
# Check for long-running transactions
psql -c "SELECT pid, duration FROM pg_stat_activity WHERE state='active'"

# Cancel blocking transaction
SELECT pg_terminate_backend(pid);

# Increase checkpoint_segments for faster WAL writing
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';

# Reload configuration
SELECT pg_reload_conf();
```

#### Issue: Redis Backup File Corrupted

**Symptoms:**
- Cannot load RDB snapshot
- redis-cli error on BGSAVE

**Solutions:**
```bash
# Check Redis logs
docker logs agent_redis

# Try using AOF backup instead
docker cp agent_redis:/data/appendonly.aof ./appendonly.aof
redis-cli --pipe < appendonly.aof

# Force memory cleanup
docker exec agent_redis redis-cli MEMORY PURGE
```

---

## Backup Retention Policy

### Retention Schedule

| Backup Type | Local Storage | S3 Standard | Glacier | Frequency |
|---|---|---|---|---|
| PostgreSQL Full | 7 days | 30 days | 7 years | Daily |
| PostgreSQL WAL | 1 day | 7 days | N/A | Continuous |
| Redis RDB | 7 days | 30 days | 90 days | Daily |
| RabbitMQ Config | 7 days | 30 days | 1 year | Daily |
| Application Config | 14 days | 90 days | 7 years | On-change |
| TLS Certificates | Indefinite | Indefinite | 7 years | On-change |

### Cleanup Procedures

```bash
#!/bin/bash
# scripts/cleanup-old-backups.sh

BACKUP_DIR="${BACKUP_DIR:-./backups}"
LOCAL_RETENTION_DAYS=${LOCAL_RETENTION_DAYS:-7}
S3_RETENTION_DAYS=${S3_RETENTION_DAYS:-30}

echo "Cleaning up old backups..."

# Remove local backups older than retention
find "$BACKUP_DIR" -name "backup_*" -mtime +$LOCAL_RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "snapshot_*" -mtime +$LOCAL_RETENTION_DAYS -delete

echo "✓ Local backup cleanup completed"

# Remove S3 backups older than retention
aws s3api list-objects-v2 \
  --bucket "backup-agent-platform-prod" \
  --prefix "postgres/" \
  --query "Contents[?LastModified<'$(date -d "$S3_RETENTION_DAYS days ago" +%Y-%m-%d)'].Key" \
  --output text | \
while read -r key; do
  [ -n "$key" ] && aws s3 rm "s3://backup-agent-platform-prod/$key"
done

echo "✓ S3 backup cleanup completed"
```

---

**END OF DOCUMENT**
