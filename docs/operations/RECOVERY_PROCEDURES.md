# Recovery Procedures Manual
## AI Agent Orchestrator Platform - Complete Recovery & Restoration Guide

**Document Version:** 1.0
**Last Updated:** November 2024
**Classification:** Internal - Operations Critical
**Owner:** Database & DevOps Teams

---

## Table of Contents

1. [Recovery Overview](#recovery-overview)
2. [Pre-Recovery Checklist](#pre-recovery-checklist)
3. [PostgreSQL Recovery Procedures](#postgresql-recovery-procedures)
4. [Redis Recovery Procedures](#redis-recovery-procedures)
5. [RabbitMQ Recovery Procedures](#rabbitmq-recovery-procedures)
6. [Application Configuration Recovery](#application-configuration-recovery)
7. [Complete Platform Recovery](#complete-platform-recovery)
8. [Cross-Region Failover](#cross-region-failover)
9. [Data Validation After Recovery](#data-validation-after-recovery)
10. [Recovery Testing](#recovery-testing)

---

## Recovery Overview

### Recovery Tier Classification

**Tier 1: Component-Level Recovery** (< 1 hour RTO)
- Single database table recovery
- Cache node restart/recovery
- RabbitMQ queue restoration
- Typical data loss: < 1 hour

**Tier 2: Service-Level Recovery** (< 2 hours RTO)
- Complete database recovery
- Cache cluster failover
- Message broker cluster rebuild
- Typical data loss: < 2 hours

**Tier 3: Platform-Level Recovery** (2-4 hours RTO)
- Complete infrastructure rebuild
- Multi-region failover
- Full data restoration
- Typical data loss: 1-24 hours depending on backup available

**Tier 4: Disaster Recovery** (4-24 hours RTO)
- Recovery from DR site
- Geographic relocation
- Compliance verification
- Possible data loss: 24 hours (using daily backups)

### Decision Tree for Recovery

```
┌─ Has System Failed? ─No→ Exit (not a recovery situation)
│
├─Yes─→ What failed?
│       ├─ Single Table Data Corruption
│       │  └→ Use Point-in-Time Recovery (PITR)
│       │
│       ├─ Complete Database
│       │  └→ Full Database Restore from Backup
│       │
│       ├─ Redis Cache
│       │  └→ RDB/AOF Snapshot Restore
│       │
│       ├─ RabbitMQ Broker
│       │  └→ Configuration + Message Restore
│       │
│       ├─ Application Node
│       │  └→ Rebuild Infrastructure + Deploy
│       │
│       ├─ Multiple Components
│       │  └→ Coordinated Multi-Service Recovery
│       │
│       └─ Entire Datacenter
│          └→ Cross-Region Failover
│
└─→ Execute Appropriate Recovery Procedure
    ├─ Validate Data Integrity
    ├─ Run Health Checks
    ├─ Update Monitoring
    └─ Document Incident
```

---

## Pre-Recovery Checklist

### Immediate Assessment (First 5 minutes)

- [ ] **Confirm the Problem**
  - Verify system is actually down/corrupted
  - Check monitoring alerts
  - Test connectivity
  - Review error logs

- [ ] **Scope of Impact**
  - How many services affected?
  - How many users impacted?
  - Critical business processes down?
  - Data loss confirmed or potential?

- [ ] **Notify Stakeholders**
  - Incident commander
  - Engineering lead
  - Operations team
  - Management (if critical)

- [ ] **Preserve Evidence**
  - Capture error messages
  - Export logs
  - Take screenshots
  - Note exact failure time

### Technical Preparation (5-15 minutes)

- [ ] **Backup Verification**
  ```bash
  # Verify latest backups exist
  ls -lh /backups/postgres/backup_*.dump.gz | head -1
  ls -lh /backups/redis/snapshot_*.rdb.gz | head -1
  ls -lh /backups/rabbitmq/definitions_*.json.gz | head -1
  ```

- [ ] **Disk Space Check**
  ```bash
  # Ensure sufficient space for restoration
  df -h /backups
  df -h /var/lib/postgresql
  df -h /var/lib/redis
  ```

- [ ] **Service Status**
  ```bash
  # Check health of all services
  docker-compose ps
  docker ps -a
  ```

- [ ] **Network Connectivity**
  ```bash
  # Test network access
  ping 8.8.8.8
  curl -I https://api.example.com
  ```

- [ ] **Credentials Available**
  - Database passwords
  - AWS credentials (for S3)
  - Encryption keys
  - SSH keys (if needed)

---

## PostgreSQL Recovery Procedures

### Scenario 1: Recover Specific Table from Corruption

**RTO: 15 minutes | RPO: 1 hour**

#### Step 1: Identify Corrupted Data

```bash
#!/bin/bash

# Check for database integrity issues
docker exec agent_postgres psql -U admin -d agent_orchestrator \
  -c "SELECT * FROM pg_stat_database WHERE datname='agent_orchestrator';"

# Look for errors in table
docker exec agent_postgres psql -U admin -d agent_orchestrator \
  -c "SELECT COUNT(*) FROM corrupted_table;"

# Run integrity check on table
docker exec agent_postgres psql -U admin -d agent_orchestrator \
  <<EOF
  -- Analyze the table to detect issues
  ANALYZE corrupted_table;

  -- Check constraints
  SELECT constraint_name, constraint_type
  FROM information_schema.table_constraints
  WHERE table_name='corrupted_table';

  -- Check for orphaned rows
  SELECT * FROM corrupted_table
  WHERE parent_id NOT IN (SELECT id FROM parent_table);
EOF
```

#### Step 2: Create Point-in-Time Recovery (PITR) Instance

```bash
#!/bin/bash

# PostgreSQL PITR requires:
# 1. Full backup from before corruption
# 2. WAL archiving enabled
# 3. All WAL files available up to target time

RECOVERY_TARGET_TIME="2024-11-18 12:00:00"
BACKUP_FILE="/backups/postgres/backup_agent_orchestrator_20241118_020000.dump.gz"

echo "Step 1: Extract backup file"
gunzip -c "$BACKUP_FILE" > /tmp/backup_extracted.dump

echo "Step 2: Create temporary recovery database"
docker exec agent_postgres createdb \
  -U admin \
  -T agent_orchestrator \
  agent_orchestrator_recovery

echo "Step 3: Restore backup to recovery database"
docker exec agent_postgres pg_restore \
  -U admin \
  -d agent_orchestrator_recovery \
  -j 4 \
  /tmp/backup_extracted.dump

echo "✓ Recovery database created"
```

#### Step 3: Validate Recovered Data

```bash
#!/bin/bash

# Compare row counts
echo "Comparing row counts..."
PROD_COUNT=$(docker exec agent_postgres psql -U admin \
  -d agent_orchestrator -t -c \
  "SELECT COUNT(*) FROM corrupted_table;")

RECOVERY_COUNT=$(docker exec agent_postgres psql -U admin \
  -d agent_orchestrator_recovery -t -c \
  "SELECT COUNT(*) FROM corrupted_table;")

echo "Production: $PROD_COUNT rows"
echo "Recovery: $RECOVERY_COUNT rows"

if [ "$PROD_COUNT" == "$RECOVERY_COUNT" ]; then
  echo "✓ Row counts match"
else
  echo "⚠ Row counts differ - possible data loss"
fi
```

#### Step 4: Restore Specific Table

```bash
#!/bin/bash

# Option A: Using pg_dump on recovery database
echo "Dumping recovered table..."
docker exec agent_postgres pg_dump \
  -U admin \
  -d agent_orchestrator_recovery \
  -t corrupted_table \
  --data-only \
  > /tmp/recovered_data.sql

# Option B: Copy table directly (if same server)
echo "Copying recovered table..."
docker exec agent_postgres psql -U admin \
  -d agent_orchestrator \
  <<EOF
  -- Backup old table
  ALTER TABLE corrupted_table RENAME TO corrupted_table_OLD;

  -- Copy recovered table
  CREATE TABLE corrupted_table AS
  SELECT * FROM dblink(
    'dbname=agent_orchestrator_recovery',
    'SELECT * FROM corrupted_table'
  ) AS t(/*columns here*/);

  -- Add constraints back
  ALTER TABLE corrupted_table ADD PRIMARY KEY (id);
EOF

echo "✓ Table restored"
```

#### Step 5: Verify and Clean Up

```bash
#!/bin/bash

# Verify data
docker exec agent_postgres psql -U admin \
  -d agent_orchestrator \
  -c "SELECT COUNT(*) FROM corrupted_table;"

# Drop recovery database
docker exec agent_postgres dropdb \
  -U admin \
  agent_orchestrator_recovery

echo "✓ Recovery completed"
```

### Scenario 2: Restore Entire Database

**RTO: 30 minutes | RPO: 1 hour**

#### Step 1: Stop Application Access

```bash
#!/bin/bash

echo "Stopping application..."
docker-compose stop app

echo "Waiting for connections to close..."
sleep 10

# Check for remaining connections
docker exec agent_postgres psql -U admin -d agent_orchestrator \
  -c "SELECT * FROM pg_stat_activity WHERE datname='agent_orchestrator';"
```

#### Step 2: Backup Current State (if not corrupted)

```bash
#!/bin/bash

# Create emergency backup of current state before recovery
docker exec agent_postgres pg_dump \
  -U admin \
  -d agent_orchestrator \
  -F custom \
  -f /backups/postgres/emergency_backup_$(date +%Y%m%d_%H%M%S).dump

echo "✓ Emergency backup created"
```

#### Step 3: Drop and Restore Database

```bash
#!/bin/bash

echo "Dropping corrupted database..."
docker exec agent_postgres dropdb \
  -U admin \
  --if-exists \
  agent_orchestrator

echo "Waiting for cleanup..."
sleep 5

echo "Recreating database..."
docker exec agent_postgres createdb \
  -U admin \
  agent_orchestrator

echo "Restoring from backup..."
BACKUP_FILE="/backups/postgres/backup_agent_orchestrator_YYYYMMDD_HHMMSS.dump.gz"
gunzip -c "$BACKUP_FILE" | \
docker exec -i agent_postgres pg_restore \
  -U admin \
  -d agent_orchestrator \
  -j 4 \
  -v

echo "✓ Database restored"
```

#### Step 4: Verify Restoration

```bash
#!/bin/bash

# Check table count
TABLE_COUNT=$(docker exec agent_postgres psql -U admin \
  -d agent_orchestrator -t -c \
  "SELECT COUNT(*) FROM information_schema.tables \
   WHERE table_schema='public';")

echo "Tables in restored database: $TABLE_COUNT"

# Check data integrity
docker exec agent_postgres psql -U admin \
  -d agent_orchestrator \
  <<EOF
  -- Run basic checks
  SELECT tablename FROM pg_tables WHERE schemaname='public' LIMIT 5;
  SELECT COUNT(*) as total_rows FROM (
    SELECT 1 FROM agent_data
    UNION ALL
    SELECT 1 FROM agent_state
  ) AS all_rows;
EOF

echo "✓ Verification completed"
```

#### Step 5: Restart Application

```bash
#!/bin/bash

echo "Restarting application..."
docker-compose up -d app

echo "Waiting for application health..."
sleep 30

# Check health
curl -f http://localhost:3000/health || exit 1

echo "✓ Application is online"
```

### Scenario 3: Point-in-Time Recovery (PITR)

**RTO: 45 minutes | RPO: Transaction-level**

#### Prerequisites

```
✓ WAL archiving enabled
✓ Full backup from before recovery target
✓ All WAL files from backup to target time
✓ Recovery target time known (< current time)
```

#### Recovery Procedure

```bash
#!/bin/bash
# scripts/restore-pitr.sh

TARGET_TIME="2024-11-18 11:30:00"
BACKUP_FILE="/backups/postgres/backup_agent_orchestrator_20241118_020000.dump.gz"
WAL_DIRECTORY="/backups/postgres/wal"
RECOVERY_CONF="/tmp/recovery.conf"

echo "========================================="
echo "Point-in-Time Recovery Starting"
echo "========================================="

# Step 1: Stop database
docker-compose stop postgres

# Step 2: Back up current data directory (for emergency restore)
docker run --rm \
  -v postgres_data:/data \
  -v /backups:/backups \
  alpine tar czf /backups/postgres_data_before_pitr.tar.gz /data

# Step 3: Clear data directory
docker exec postgres_backup bash -c "rm -rf /var/lib/postgresql/data/*"

# Step 4: Restore base backup
echo "Restoring base backup..."
gunzip -c "$BACKUP_FILE" | \
  docker exec -i postgres pg_restore \
    -U admin \
    -C \
    -j 4

# Step 5: Create recovery.conf
cat > "$RECOVERY_CONF" <<EOF
restore_command = 'cp $WAL_DIRECTORY/%f %p'
recovery_target_timeline = 'latest'
recovery_target_time = '$TARGET_TIME'
recovery_target_inclusive = true
EOF

# Step 6: Copy recovery.conf to data directory
docker cp "$RECOVERY_CONF" postgres:/var/lib/postgresql/data/recovery.conf

# Step 7: Start database in recovery mode
docker-compose up -d postgres

# Step 8: Monitor recovery progress
echo "Monitoring recovery..."
for i in {1..300}; do  # Wait up to 5 minutes
  if docker exec postgres psql -U admin -c "SELECT 1" 2>/dev/null; then
    echo "✓ Database recovered and online"
    break
  fi
  echo "Recovering... ($i/300)"
  sleep 1
done

# Step 9: Verify recovery target was met
docker exec postgres psql -U admin -c \
  "SELECT now();"

echo "========================================="
echo "✓ PITR Recovery completed at $(date)"
echo "========================================="
```

---

## Redis Recovery Procedures

### Scenario 1: Recover from RDB Snapshot

**RTO: 10 minutes | RPO: 1 hour**

#### Step 1: Stop Redis (if corrupted)

```bash
#!/bin/bash

echo "Stopping Redis..."
docker-compose stop redis

echo "Waiting for graceful shutdown..."
sleep 5
```

#### Step 2: Restore RDB Snapshot

```bash
#!/bin/bash

SNAPSHOT_FILE="/backups/redis/snapshot_20241118.rdb.gz"

echo "Extracting snapshot..."
gunzip -c "$SNAPSHOT_FILE" > /tmp/dump.rdb

echo "Copying snapshot to Redis data directory..."
docker cp /tmp/dump.rdb agent_redis:/data/dump.rdb

echo "Fixing permissions..."
docker exec agent_redis chown redis:redis /data/dump.rdb
docker exec agent_redis chmod 600 /data/dump.rdb

rm /tmp/dump.rdb
```

#### Step 3: Start Redis and Verify

```bash
#!/bin/bash

echo "Starting Redis..."
docker-compose up -d redis

echo "Waiting for Redis startup..."
sleep 5

# Check Redis health
docker exec agent_redis redis-cli PING

# Check data loaded
KEYS=$(docker exec agent_redis redis-cli DBSIZE | cut -d: -f2)
echo "Keys in Redis: $KEYS"

echo "✓ Redis recovery completed"
```

### Scenario 2: Recover from AOF File

**RTO: 15 minutes | RPO: Seconds (depending on fsync)**

#### Step 1: Validate AOF File

```bash
#!/bin/bash

AOF_FILE="/backups/redis/aof_20241118.aof"

echo "Validating AOF file..."
redis-check-aof --fix "$AOF_FILE"

# Create backup of original
cp "$AOF_FILE" "${AOF_FILE}.backup"

echo "✓ AOF file validated and fixed if needed"
```

#### Step 2: Restore from AOF

```bash
#!/bin/bash

echo "Stopping Redis..."
docker-compose stop redis

# Backup current AOF
docker cp agent_redis:/data/appendonly.aof \
  ./data/appendonly.aof.old || true

# Copy restored AOF
docker cp "/backups/redis/aof_${TIMESTAMP}.aof" \
  agent_redis:/data/appendonly.aof

echo "Starting Redis..."
docker-compose up -d redis

echo "Waiting for AOF replay..."
sleep 10

# Verify
docker exec agent_redis redis-cli DBSIZE
docker exec agent_redis redis-cli INFO persistence

echo "✓ AOF recovery completed"
```

### Scenario 3: Partial Cache Recovery (Key-by-Key)

**RTO: 5 minutes (for commonly used keys)**

```bash
#!/bin/bash
# Recover specific keys from RDB dump

SNAPSHOT_FILE="/backups/redis/snapshot_latest.rdb.gz"
KEY_PATTERN="session:*"

echo "Extracting RDB snapshot..."
gunzip -c "$SNAPSHOT_FILE" > /tmp/dump.rdb

# Use redis-dump tool to extract specific keys
echo "Extracting keys matching pattern: $KEY_PATTERN"
redis-cli --rdb /tmp/dump.rdb \
  EVAL "return redis.call('keys', '$KEY_PATTERN')" 0

# Alternative: Use redis-migration tool to copy keys
echo "Copying keys to production Redis..."
redis-cli --pipe < /tmp/recovered_keys.resp

echo "✓ Partial cache recovery completed"
```

---

## RabbitMQ Recovery Procedures

### Scenario 1: Restore Queue Definitions

**RTO: 5 minutes | RPO: 1 hour**

#### Step 1: Export Current State (if available)

```bash
#!/bin/bash

echo "Exporting current RabbitMQ state..."
docker exec agent_rabbitmq \
  rabbitmqctl export_definitions /tmp/current_defs.json

docker cp agent_rabbitmq:/tmp/current_defs.json \
  ./data/rabbitmq_current_defs.json.backup

echo "✓ Current state backed up"
```

#### Step 2: Reset RabbitMQ (if needed)

```bash
#!/bin/bash

echo "WARNING: This will clear all definitions and data"
read -p "Continue? (y/n)" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 1
fi

echo "Resetting RabbitMQ..."
docker exec agent_rabbitmq rabbitmqctl reset
docker exec agent_rabbitmq rabbitmqctl start_app

echo "✓ RabbitMQ reset"
```

#### Step 3: Import Definitions

```bash
#!/bin/bash

DEFINITIONS_FILE="/backups/rabbitmq/definitions_20241118.json.gz"

echo "Decompressing definitions..."
gunzip -c "$DEFINITIONS_FILE" > /tmp/definitions.json

echo "Importing definitions..."
docker cp /tmp/definitions.json agent_rabbitmq:/tmp/definitions.json

docker exec agent_rabbitmq \
  rabbitmqctl import_definitions /tmp/definitions.json

# Wait for import to complete
sleep 5

echo "Verifying definitions..."
docker exec agent_rabbitmq rabbitmqctl list_exchanges
docker exec agent_rabbitmq rabbitmqctl list_queues

echo "✓ Queue definitions restored"
```

### Scenario 2: Recover Message Queue Data

**RTO: 15 minutes | RPO: 1 hour**

#### Step 1: Check Persistent Messages

```bash
#!/bin/bash

echo "Checking current queue message counts..."
docker exec agent_rabbitmq \
  rabbitmqctl list_queues name messages

echo "Checking persistent queue status..."
docker exec agent_rabbitmq \
  rabbitmqctl list_queues name durable arguments
```

#### Step 2: Restore Queue Definitions First

```bash
# Follow Scenario 1 steps to restore definitions
scripts/restore-rabbitmq-definitions.sh
```

#### Step 3: Re-publish Critical Messages

```bash
#!/bin/bash

# If message dump is available (from backup)
MESSAGE_DUMP="/backups/rabbitmq/messages_20241118.json"

if [ -f "$MESSAGE_DUMP" ]; then
  echo "Re-publishing messages from backup..."

  # Parse message dump and republish
  python3 << PYTHON
import json
import pika

with open("$MESSAGE_DUMP") as f:
    messages = json.load(f)

connection = pika.BlockingConnection(
    pika.ConnectionParameters('localhost')
)
channel = connection.channel()

for message in messages:
    channel.basic_publish(
        exchange=message.get('exchange', ''),
        routing_key=message['routing_key'],
        body=message['body'],
        properties=pika.BasicProperties(
            delivery_mode=2  # Persistent
        )
    )

connection.close()
echo "✓ Messages republished"
PYTHON
fi
```

---

## Application Configuration Recovery

### Scenario 1: Restore from Git History

```bash
#!/bin/bash

echo "Recovering configuration from Git..."

# List recent commits
git log --oneline -10

# Restore specific file from commit
git checkout <commit-hash> -- .env

# Or restore entire directory from point in time
git checkout <commit-hash>

# Verify restoration
git status

echo "✓ Configuration restored from Git"
```

### Scenario 2: Restore Encrypted .env File

```bash
#!/bin/bash

ENV_FILE_ENCRYPTED="/backups/config/.env.enc"
ENV_DECRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}"

echo "Decrypting .env file..."
openssl enc -aes-256-cbc -d \
  -in "$ENV_FILE_ENCRYPTED" \
  -out .env \
  -k "$ENV_DECRYPTION_KEY"

echo "✓ .env file decrypted and restored"

# Verify contents (but don't display)
wc -l .env
```

### Scenario 3: Restore TLS Certificates

```bash
#!/bin/bash

CERT_BACKUP_ENCRYPTED="/backups/certs/certificates_20241118.tar.gz.enc"

echo "Decrypting certificate backup..."
openssl enc -aes-256-cbc -d \
  -in "$CERT_BACKUP_ENCRYPTED" \
  -k "${BACKUP_ENCRYPTION_KEY}" | \
  tar xz -C ./

echo "✓ TLS certificates restored"

# Verify certificates
openssl x509 -in ./certs/server.crt -text -noout
```

---

## Complete Platform Recovery

### Full Platform Recovery Procedure

**RTO: 2 hours | RPO: 1 hour**

```bash
#!/bin/bash
# scripts/recover-platform.sh

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="recovery_${TIMESTAMP}.log"

echo "=========================================" | tee "$LOG_FILE"
echo "COMPLETE PLATFORM RECOVERY"
echo "Started: $(date -Iseconds)" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"

# Step 1: Stop all services
echo "" | tee -a "$LOG_FILE"
echo "Step 1: Stopping all services..." | tee -a "$LOG_FILE"
docker-compose down 2>&1 | tee -a "$LOG_FILE"

# Step 2: Recover PostgreSQL
echo "" | tee -a "$LOG_FILE"
echo "Step 2: Recovering PostgreSQL database..." | tee -a "$LOG_FILE"
scripts/restore-from-backup.sh \
  --backup s3://backup-agent-platform-prod/postgres/latest \
  --type postgresql 2>&1 | tee -a "$LOG_FILE"

# Step 3: Recover Redis
echo "" | tee -a "$LOG_FILE"
echo "Step 3: Recovering Redis cache..." | tee -a "$LOG_FILE"
scripts/restore-from-backup.sh \
  --backup /backups/redis/snapshot_latest.rdb.gz \
  --type redis 2>&1 | tee -a "$LOG_FILE"

# Step 4: Recover RabbitMQ
echo "" | tee -a "$LOG_FILE"
echo "Step 4: Recovering RabbitMQ broker..." | tee -a "$LOG_FILE"
scripts/restore-from-backup.sh \
  --backup /backups/rabbitmq/definitions_latest.json.gz \
  --type rabbitmq 2>&1 | tee -a "$LOG_FILE"

# Step 5: Restore configuration
echo "" | tee -a "$LOG_FILE"
echo "Step 5: Restoring application configuration..." | tee -a "$LOG_FILE"
git checkout main -- .env docker-compose.yml 2>&1 | tee -a "$LOG_FILE"

# Step 6: Start all services
echo "" | tee -a "$LOG_FILE"
echo "Step 6: Starting all services..." | tee -a "$LOG_FILE"
docker-compose up -d 2>&1 | tee -a "$LOG_FILE"

# Step 7: Wait for services to be healthy
echo "" | tee -a "$LOG_FILE"
echo "Step 7: Waiting for services to become healthy..." | tee -a "$LOG_FILE"
for i in {1..60}; do
  if docker-compose exec -T postgres pg_isready -U admin > /dev/null 2>&1 && \
     docker-compose exec -T redis redis-cli PING > /dev/null 2>&1 && \
     docker-compose exec -T rabbitmq rabbitmq-diagnostics ping > /dev/null 2>&1; then
    echo "✓ All services healthy" | tee -a "$LOG_FILE"
    break
  fi
  echo "Waiting for services... ($i/60)" | tee -a "$LOG_FILE"
  sleep 2
done

# Step 8: Run validation checks
echo "" | tee -a "$LOG_FILE"
echo "Step 8: Running validation checks..." | tee -a "$LOG_FILE"
scripts/dr-status-check.sh 2>&1 | tee -a "$LOG_FILE"

# Step 9: Final status report
echo "" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"
echo "RECOVERY COMPLETED" | tee -a "$LOG_FILE"
echo "Completed: $(date -Iseconds)" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "=========================================" | tee -a "$LOG_FILE"
```

---

## Cross-Region Failover

### Activate Disaster Recovery Site

**RTO: 2 hours | RPO: Daily**

```bash
#!/bin/bash
# scripts/failover-to-dr.sh

TARGET_REGION="${1:-us-west-2}"

echo "========================================="
echo "ACTIVATING DISASTER RECOVERY SITE"
echo "Target Region: $TARGET_REGION"
echo "========================================="

# Step 1: Verify DR site infrastructure exists
echo "Verifying DR infrastructure in $TARGET_REGION..."
aws ec2 describe-instances \
  --region "$TARGET_REGION" \
  --filters "Name=tag:Environment,Values=dr" \
  --query 'Reservations[0].Instances[0].[InstanceId,State.Name]' \
  --output text

# Step 2: Restore latest backups from S3
echo "Restoring backups from S3..."

# Download PostgreSQL backup
aws s3 cp \
  "s3://backup-agent-platform-prod/postgres/latest/backup.dump.gz" \
  "./backups/postgres_dr.dump.gz" \
  --region "$TARGET_REGION"

# Download Redis backup
aws s3 cp \
  "s3://backup-agent-platform-prod/redis/latest/snapshot.rdb.gz" \
  "./backups/redis_dr.rdb.gz" \
  --region "$TARGET_REGION"

# Download RabbitMQ backup
aws s3 cp \
  "s3://backup-agent-platform-prod/rabbitmq/latest/definitions.json.gz" \
  "./backups/rabbitmq_dr.json.gz" \
  --region "$TARGET_REGION"

# Step 3: Deploy infrastructure in DR region
echo "Deploying infrastructure in DR region..."
terraform apply \
  -target=aws_instance.dr_app_server \
  -target=aws_rds_instance.dr_postgres \
  -target=aws_elasticache_cluster.dr_redis \
  -var="region=$TARGET_REGION"

# Step 4: Restore data
echo "Restoring data to DR infrastructure..."

# PostgreSQL
pg_restore \
  --host=dr-postgres.region.rds.amazonaws.com \
  --username=admin \
  --dbname=agent_orchestrator \
  --jobs=4 \
  < backups/postgres_dr.dump

# Redis (via Elasticache)
redis-cli -h dr-redis.region.cache.amazonaws.com \
  --rdb /tmp/dump.rdb

# RabbitMQ
rabbitmqctl import_definitions \
  --hostname=dr-rabbitmq.region.compute.amazonaws.com \
  backups/rabbitmq_dr.json

# Step 5: Update DNS
echo "Updating DNS to point to DR site..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"api.example.com\",
        \"Type\": \"CNAME\",
        \"TTL\": 60,
        \"ResourceRecords\": [{
          \"Value\": \"dr-app.region.compute.amazonaws.com\"
        }]
      }
    }]
  }"

# Step 6: Health checks
echo "Running health checks..."
curl -f "https://api.example.com/health" || exit 1

echo "========================================="
echo "✓ FAILOVER TO DR SITE COMPLETED"
echo "========================================="
```

---

## Data Validation After Recovery

### Post-Recovery Validation Checklist

```bash
#!/bin/bash
# scripts/validate-recovery.sh

set -euo pipefail

echo "========================================="
echo "POST-RECOVERY VALIDATION"
echo "========================================="

# PostgreSQL Validation
echo ""
echo "=== PostgreSQL Validation ===="
docker exec agent_postgres psql -U admin -d agent_orchestrator <<EOF
  -- Check table count
  SELECT COUNT(*) as table_count
  FROM information_schema.tables
  WHERE table_schema='public';

  -- Check row counts for critical tables
  SELECT tablename, n_live_tup as rows
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC
  LIMIT 10;

  -- Check for constraint violations
  SELECT constraint_name, constraint_type
  FROM information_schema.table_constraints
  WHERE table_schema='public';

  -- Run ANALYZE to update statistics
  ANALYZE;

  -- Check autovacuum status
  SELECT datname, last_autovacuum
  FROM pg_stat_user_tables;
EOF

# Redis Validation
echo ""
echo "=== Redis Validation ===="
docker exec agent_redis redis-cli <<EOF
  INFO
  DBSIZE
  LASTSAVE
EOF

# RabbitMQ Validation
echo ""
echo "=== RabbitMQ Validation ===="
docker exec agent_rabbitmq rabbitmqctl list_queues name durable messages

# Application Connectivity
echo ""
echo "=== Application Connectivity ===="
curl -s http://localhost:3000/health | jq .

echo ""
echo "========================================="
echo "✓ Validation completed"
echo "========================================="
```

---

## Recovery Testing

### Monthly Recovery Drill Procedure

```bash
#!/bin/bash
# scripts/monthly-dr-drill.sh

echo "========================================="
echo "MONTHLY DISASTER RECOVERY DRILL"
echo "Date: $(date)"
echo "========================================="

# 1. Announce drill
echo "Sending notification to team..."
slack send "#ops-notifications" "DR Drill started - $(date)"

# 2. Create isolated test environment
echo "Creating test environment..."
docker-compose -f docker-compose.test.yml up -d

# 3. Simulate recovery
echo "Simulating full recovery..."
TEST_START=$(date +%s)

scripts/recover-platform.sh \
  --target test \
  --source /backups/postgres/backup_latest.dump.gz

TEST_END=$(date +%s)
TEST_RTO=$((TEST_END - TEST_START))

# 4. Validate
echo "Validating recovery..."
scripts/validate-recovery.sh

# 5. Measure metrics
echo "Recovery Time: ${TEST_RTO}s"
if [ $TEST_RTO -le 7200 ]; then
  echo "✓ RTO ACHIEVED (within 2 hour target)"
else
  echo "✗ RTO MISSED (exceeded 2 hour target)"
fi

# 6. Cleanup
echo "Cleaning up test environment..."
docker-compose -f docker-compose.test.yml down -v

# 7. Report results
echo "Sending report..."
slack send "#ops-notifications" \
  "DR Drill completed. RTO: ${TEST_RTO}s. Status: PASSED"

echo "========================================="
echo "✓ Drill completed"
echo "========================================="
```

---

**END OF DOCUMENT**
