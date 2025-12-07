# Backup & Restore Scripts

Automated backup, verification, and restore procedures for all system data.

## Scripts Overview

### backup.sh (UNIFIED BACKUP)
**Purpose:** Complete system backup
**Backs up:**
- PostgreSQL database (all schemas)
- RabbitMQ configuration and queues
- Redis data (if persistence enabled)
- Application configuration files
- Docker volumes

**Retention Policy:**
- Daily backups: Keep last 7 days
- Weekly backups: Keep last 4 weeks
- Monthly backups: Keep last 12 months

**Example:**
```bash
./backup.sh
# Starting backup...
# ✅ PostgreSQL backup: 450 MB (12,450 records)
# ✅ RabbitMQ config: 2.3 MB
# ✅ Redis snapshot: 85 MB
# ✅ App config: 1.2 MB
# ✅ Docker volumes: 120 MB
#
# Backup complete: /backups/2025-12-07_14-30-00.tar.gz (658 MB)
# Retention: 7 daily, 4 weekly, 12 monthly backups kept
```

**Automation:**
```bash
# Daily backup at 02:00 AM
0 2 * * * /path/to/backup/backup.sh >> /var/log/backup.log 2>&1
```

---

### verify.sh
**Purpose:** Verify backup integrity
**Checks:**
- Backup file exists and is not corrupted
- Archive can be extracted
- Database dump is valid
- All expected files present
- Checksums match

**Example:**
```bash
./verify.sh /backups/2025-12-07_14-30-00.tar.gz
# Verifying backup integrity...
# ✅ Archive integrity: Valid (CRC check passed)
# ✅ PostgreSQL dump: Valid (12,450 records)
# ✅ RabbitMQ config: Valid (23 queues, 5 exchanges)
# ✅ Redis snapshot: Valid (45,230 keys)
# ✅ All files present: 47/47
# ✅ Checksums match: 100%
#
# Backup verification: PASSED
```

**Automation:**
```bash
# Verify daily backup at 03:00 AM
0 3 * * * /path/to/backup/verify.sh /backups/latest.tar.gz
```

---

### restore.sh
**Purpose:** Restore system from backup
**CRITICAL:** This will OVERWRITE current data!

**Restores:**
- PostgreSQL database (full restore)
- RabbitMQ configuration
- Redis data
- Application configuration
- Docker volumes

**Prerequisites:**
1. Stop all services first
2. Backup current state (just in case)
3. Verify backup integrity with verify.sh
4. Have rollback plan ready

**Example:**
```bash
# Stop services first
docker-compose down

# Restore from backup
./restore.sh /backups/2025-12-07_14-30-00.tar.gz

# Restoring from backup...
# ⚠️  This will OVERWRITE current data!
# Are you sure? (yes/no): yes
#
# ✅ PostgreSQL restored: 12,450 records
# ✅ RabbitMQ config restored: 23 queues
# ✅ Redis restored: 45,230 keys
# ✅ App config restored
# ✅ Docker volumes restored
#
# Restore complete. Start services:
#   docker-compose up -d

# Start services
docker-compose up -d
```

---

### postgres-specific.sh
**Purpose:** PostgreSQL-specific backup operations
**Features:**
- Schema-only backups
- Data-only backups
- Table-level backups
- Point-in-time recovery (PITR)
- Backup compression options

**Example:**
```bash
# Full backup
./postgres-specific.sh --full

# Schema only
./postgres-specific.sh --schema-only

# Specific table
./postgres-specific.sh --table agents

# Point-in-time recovery
./postgres-specific.sh --pitr "2025-12-07 14:00:00"
```

---

## Backup Strategy

### What Gets Backed Up

#### PostgreSQL Database
- All schemas (public, auth, analytics)
- All tables with data
- Indexes and constraints
- Stored procedures and triggers
- User roles and permissions

#### RabbitMQ
- Queue definitions
- Exchange configurations
- Bindings
- User accounts
- Virtual hosts
- Policies

#### Redis (if persistent)
- All keys and values
- Keyspace configuration
- Persistence settings

#### Application
- Environment files (.env)
- Configuration files (config/*.yml)
- SSL certificates
- Custom scripts

#### Docker
- Volume data
- Network configurations
- Container state (if needed)

### What Does NOT Get Backed Up

- Temporary files (/tmp)
- Log files (backed up separately)
- Cache data (Redis ephemeral keys)
- Build artifacts
- node_modules (rebuild from package.json)
- Passwords in plain text (use secrets management)

---

## Backup Locations

### Local Backups
```
/backups/
├── daily/
│   ├── 2025-12-07_02-00-00.tar.gz
│   ├── 2025-12-06_02-00-00.tar.gz
│   └── ... (last 7 days)
├── weekly/
│   ├── 2025-week-49.tar.gz
│   └── ... (last 4 weeks)
├── monthly/
│   ├── 2025-12.tar.gz
│   └── ... (last 12 months)
└── latest.tar.gz -> daily/2025-12-07_02-00-00.tar.gz
```

### Remote Backups (RECOMMENDED)
- S3-compatible object storage
- Encrypted before upload
- Cross-region replication
- Lifecycle policies applied

**Setup remote backup:**
```bash
# In backup.sh, add remote sync
aws s3 sync /backups/ s3://my-backups/ --encrypt
```

---

## Disaster Recovery Scenarios

### Scenario 1: Single Table Corruption

**Recovery:**
```bash
# Extract specific table from backup
./postgres-specific.sh --restore-table agents \
  --from /backups/2025-12-07_02-00-00.tar.gz
```

### Scenario 2: Database Completely Lost

**Recovery:**
```bash
# Stop services
docker-compose down

# Full restore
./restore.sh /backups/latest.tar.gz

# Verify data
psql -c "SELECT COUNT(*) FROM agents;"

# Restart services
docker-compose up -d
```

### Scenario 3: Accidental Data Deletion (< 24 hours ago)

**Recovery:**
```bash
# Find backup before deletion
ls -lt /backups/daily/ | head -10

# Restore from point before deletion
./restore.sh /backups/daily/2025-12-06_14-00-00.tar.gz
```

### Scenario 4: Complete System Failure

**Recovery:**
```bash
# 1. Provision new server
# 2. Install dependencies
# 3. Clone repository
# 4. Download backup from S3
aws s3 cp s3://my-backups/latest.tar.gz /backups/

# 5. Restore
./restore.sh /backups/latest.tar.gz

# 6. Start services
docker-compose up -d

# 7. Verify
../infrastructure/health-check.sh
```

---

## Backup Best Practices

### 1. Test Restores Regularly
```bash
# Monthly restore test
# Create isolated test environment
docker-compose -f docker-compose.test.yml up -d

# Restore to test environment
./restore.sh /backups/latest.tar.gz --target test

# Verify integrity
# Teardown test environment
docker-compose -f docker-compose.test.yml down
```

### 2. Monitor Backup Success
```bash
# Check last backup status
if [ -f /var/log/backup.log ]; then
  tail -20 /var/log/backup.log
fi

# Alert on backup failure
if ! grep -q "Backup complete" /var/log/backup.log; then
  echo "⚠️  Last backup FAILED!" | mail -s "Backup Alert" devops@company.com
fi
```

### 3. Encrypt Backups
```bash
# Encrypt before storage
gpg --encrypt --recipient devops@company.com backup.tar.gz

# Decrypt for restore
gpg --decrypt backup.tar.gz.gpg > backup.tar.gz
```

### 4. Verify Before Purging
```bash
# Before deleting old backups, verify new backup
./verify.sh /backups/latest.tar.gz
if [ $? -eq 0 ]; then
  # Safe to delete old backups
  find /backups/daily/ -mtime +7 -delete
fi
```

---

## Monitoring & Alerting

### Backup Failure Alerts
```bash
# Add to backup.sh
if [ $BACKUP_STATUS -ne 0 ]; then
  curl -X POST https://alerts.company.com/api/alert \
    -d '{"severity": "high", "message": "Backup failed"}'
fi
```

### Backup Size Monitoring
```bash
# Alert if backup size changes significantly
CURRENT_SIZE=$(du -sb /backups/latest.tar.gz | cut -f1)
EXPECTED_SIZE=650000000  # 650 MB
VARIANCE=$(echo "scale=2; ($CURRENT_SIZE - $EXPECTED_SIZE) / $EXPECTED_SIZE * 100" | bc)

if [ ${VARIANCE#-} -gt 20 ]; then
  echo "⚠️  Backup size anomaly: ${VARIANCE}%"
fi
```

### Backup Age Monitoring
```bash
# Alert if latest backup is too old
BACKUP_AGE=$(find /backups/latest.tar.gz -mmin +1440)  # 24 hours
if [ -n "$BACKUP_AGE" ]; then
  echo "⚠️  Latest backup is older than 24 hours!"
fi
```

---

## Troubleshooting

### Backup Fails with "Disk Full"

**Solution:**
```bash
# Check disk space
df -h /backups

# Clean old backups
find /backups/daily/ -mtime +7 -delete

# Increase compression
./backup.sh --compress=9
```

### Restore Fails with "Checksum Mismatch"

**Solution:**
```bash
# Verify backup integrity
./verify.sh /backups/latest.tar.gz

# If corrupted, try previous backup
./verify.sh /backups/daily/2025-12-06_02-00-00.tar.gz

# If all local backups corrupted, fetch from S3
aws s3 cp s3://my-backups/daily/2025-12-06_02-00-00.tar.gz /backups/
```

### PostgreSQL Restore Fails

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Try restore with verbose logging
./postgres-specific.sh --restore --verbose

# If schema conflicts, drop and recreate
psql -c "DROP SCHEMA public CASCADE;"
psql -c "CREATE SCHEMA public;"
./postgres-specific.sh --restore
```

---

## Compliance & Retention

### GDPR Compliance
- Personal data in backups encrypted
- Backup retention: Maximum 12 months
- User data deletion requests: Reprocess all backups

### Data Protection
- Backups encrypted at rest (AES-256)
- Backups encrypted in transit (TLS 1.3)
- Access logs maintained for 90 days
- Only authorized personnel can access backups

---

*Last Updated: 2025-12-07*
*Part of Repository Reorganization Phase 1*
