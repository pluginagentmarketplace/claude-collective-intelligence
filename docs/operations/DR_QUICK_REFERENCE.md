# DR Quick Reference Guide
## AI Agent Orchestrator Platform - Emergency Procedures

**Last Updated:** November 2024
**For:** Emergency Responders & On-Call Engineers

---

## 🚨 EMERGENCY INCIDENT - IMMEDIATE ACTIONS

### Within First 5 Minutes

```bash
# 1. ACKNOWLEDGE INCIDENT
echo "Incident acknowledged at $(date)"

# 2. CHECK SYSTEM STATUS
./scripts/dr-status-check.sh

# 3. IDENTIFY SCOPE
# - Is it one component or entire platform?
# - Which systems are down?
# - Can users access the platform?

# 4. NOTIFY STAKEHOLDERS (Slack, email, phone)
# - CIO
# - Engineering lead
# - Operations team
# - On-call manager
```

### Contact Information
- **On-Call DBA:** [Primary: NAME PHONE] [Secondary: NAME PHONE]
- **On-Call DevOps:** [Primary: NAME PHONE] [Secondary: NAME PHONE]
- **CIO:** [NAME PHONE]
- **Incident Commander:** [Escalate if needed]

---

## 🔧 QUICK DECISION TREE

```
INCIDENT DETECTED
    ↓
[Run: ./scripts/dr-status-check.sh]
    ↓
What failed?
├─ PostgreSQL database
│  └─ Go to: Database Recovery (15 min)
│
├─ Redis cache
│  └─ Go to: Cache Recovery (10 min)
│
├─ RabbitMQ broker
│  └─ Go to: Message Broker Recovery (15 min)
│
├─ Single application node
│  └─ Go to: Node Recovery (30 min)
│
├─ Multiple components
│  └─ Go to: Complete Recovery (2 hours)
│
└─ Entire datacenter
   └─ Go to: Failover to DR (2+ hours)
```

---

## 🔄 RECOVERY PROCEDURES (Copy & Paste Commands)

### Database Recovery (PostgreSQL)

**Time: 30-60 minutes | Difficulty: Medium**

```bash
#!/bin/bash
# Step 1: Find latest backup
BACKUP_FILE=$(find ./backups/postgres -name "*.dump.gz" -printf '%T@ %p\n' | \
  sort -rn | head -1 | cut -d' ' -f2)
echo "Using backup: $BACKUP_FILE"

# Step 2: Restore database
./scripts/restore-from-backup.sh \
  --type postgresql \
  --backup "$BACKUP_FILE"

# Step 3: Verify
psql -h localhost -U admin -d agent_orchestrator \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# Should show number of tables (e.g., 42)
# If empty result, restoration failed
```

### Cache Recovery (Redis)

**Time: 5-15 minutes | Difficulty: Easy**

```bash
#!/bin/bash
# Step 1: Find latest snapshot
BACKUP_FILE=$(find ./backups/redis -name "*.rdb.gz" -printf '%T@ %p\n' | \
  sort -rn | head -1 | cut -d' ' -f2)
echo "Using backup: $BACKUP_FILE"

# Step 2: Restore from snapshot
./scripts/restore-from-backup.sh \
  --type redis \
  --backup "$BACKUP_FILE"

# Step 3: Verify
redis-cli DBSIZE
# Should show: "db0:keys=XXXX" (non-zero number)
```

### Message Broker Recovery (RabbitMQ)

**Time: 10-20 minutes | Difficulty: Medium**

```bash
#!/bin/bash
# Step 1: Find latest definitions
BACKUP_FILE=$(find ./backups/rabbitmq -name "definitions_*.json.gz" -printf '%T@ %p\n' | \
  sort -rn | head -1 | cut -d' ' -f2)
echo "Using backup: $BACKUP_FILE"

# Step 2: Restore queue definitions
./scripts/restore-from-backup.sh \
  --type rabbitmq \
  --backup "$BACKUP_FILE"

# Step 3: Verify
docker exec agent_rabbitmq rabbitmqctl list_queues
# Should show list of queues
```

### Complete Platform Recovery

**Time: 2 hours | Difficulty: High**

```bash
#!/bin/bash
# Use this if multiple systems are down

echo "COMPLETE PLATFORM RECOVERY STARTING"
echo "Time: $(date)"

# Step 1: Stop all services
docker-compose down

# Step 2: Restore PostgreSQL
PGBACKUP=$(find ./backups/postgres -name "*.dump.gz" -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2)
./scripts/restore-from-backup.sh --type postgresql --backup "$PGBACKUP"

# Step 3: Restore Redis
REDISBACKUP=$(find ./backups/redis -name "*.rdb.gz" -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2)
./scripts/restore-from-backup.sh --type redis --backup "$REDISBACKUP"

# Step 4: Restore RabbitMQ
RABBITBACKUP=$(find ./backups/rabbitmq -name "*.json.gz" -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2)
./scripts/restore-from-backup.sh --type rabbitmq --backup "$RABBITBACKUP"

# Step 5: Start services
docker-compose up -d

# Step 6: Wait for health
sleep 30

# Step 7: Verify
./scripts/dr-status-check.sh

echo "COMPLETE PLATFORM RECOVERY FINISHED"
echo "Time: $(date)"
```

### Failover to Disaster Recovery Site

**Time: 2-4 hours | Difficulty: Very High | Use Only When Primary Is Lost**

```bash
#!/bin/bash
# ONLY USE IF PRIMARY DATACENTER IS DOWN

# Get confirmation
read -p "Are you ABSOLUTELY SURE? Type 'yes' to proceed: " confirm
if [ "$confirm" != "yes" ]; then
  echo "Cancelled"
  exit 0
fi

# Execute failover
./scripts/failover-to-dr.sh \
  --region us-west-2 \
  --confirm

echo "Failover initiated. Monitor status at:"
echo "- https://console.aws.amazon.com"
echo "- ./failover_TIMESTAMP.log"
```

---

## ✅ VERIFICATION CHECKLIST

After any recovery, verify:

```
POST-RECOVERY VERIFICATION CHECKLIST
════════════════════════════════════════════════════════

[ ] Database is accessible
    $ psql -h localhost -U admin -d agent_orchestrator -c "SELECT 1;"

[ ] Database has data
    $ psql -h localhost -U admin -d agent_orchestrator \
      -c "SELECT COUNT(*) as total_rows FROM (
            SELECT 1 FROM agent_data UNION ALL
            SELECT 1 FROM agent_state
          ) AS t;"

[ ] Redis is responding
    $ redis-cli PING
    Expected: "PONG"

[ ] Redis has data
    $ redis-cli DBSIZE
    Expected: "db0:keys=XXXX" (non-zero)

[ ] RabbitMQ is online
    $ docker exec agent_rabbitmq rabbitmqctl status
    Expected: "Status of node..." (without errors)

[ ] Queues are restored
    $ docker exec agent_rabbitmq rabbitmqctl list_queues | wc -l
    Expected: Should match pre-incident count

[ ] Application services are running
    $ docker-compose ps
    Expected: All services showing "Up"

[ ] Application health check
    $ curl -f http://localhost:3000/health
    Expected: HTTP 200 with healthy response

[ ] Monitoring is active
    $ curl -f http://localhost:9090/api/v1/query?query=up
    Expected: Prometheus responding

[ ] No errors in logs
    $ docker-compose logs | grep ERROR | wc -l
    Expected: 0 (or very low count)

STATUS: [✓ PASSED / ⚠ WARNINGS / ✗ FAILED]
```

---

## 📊 CURRENT RTO/RPO TARGETS

| System | RTO Target | Actual Achievable | RPO Target | Current RPO |
|--------|-----------|-----------------|----------|------------|
| PostgreSQL | 60 min | ✓ 60 min | 1 hour | ✓ 1 hour |
| Redis | 30 min | ✓ 15 min | 15 min | ✓ 15 min |
| RabbitMQ | 45 min | ✓ 30 min | 1 hour | ✓ 1 hour |
| **Full Platform** | **2 hours** | **✓ 2 hours** | **1 hour** | **✓ 1 hour** |

**Status: ✓ All targets achievable with current backups and infrastructure**

---

## 🗂️ BACKUP LOCATIONS

### Local Backups (Fast Recovery)
```
Location: ./backups/
├── postgres/          (7-day retention)
│   ├── backup_*.dump.gz
│   └── backup_*.sql.gz
├── redis/             (7-day retention)
│   ├── snapshot_*.rdb.gz
│   └── aof_*.aof.gz
└── rabbitmq/          (7-day retention)
    ├── definitions_*.json.gz
    └── queues_*.txt.gz
```

**Recovery Time:** < 5 minutes
**Access:** Local disk or NFS mount

### S3 Backups (Offsite Protection)
```
Bucket: backup-agent-platform-prod
├── postgres/          (30-day retention, STANDARD_IA)
├── redis/             (30-day retention, STANDARD_IA)
└── rabbitmq/          (30-day retention, STANDARD_IA)
```

**Recovery Time:** 5 minutes (from S3)
**Access:** AWS CLI required

### Glacier Archive (Compliance)
```
Vault: agent-platform-compliance-archive
├── Monthly archives   (7-year retention)
└── Recovery time: 1-12 hours
```

**Access:** AWS CLI + IAM permissions

---

## 🔧 USEFUL COMMANDS

### Status & Monitoring

```bash
# Full DR status check
./scripts/dr-status-check.sh

# Verify all backups
./scripts/backup-verify.sh

# Check backup size and age
du -sh ./backups/* && find ./backups -name "*.gz" -printf "%T@ %p\n" | sort -rn | head -5

# Monitor backup jobs
tail -f logs/backup_all_*.log

# Check replication lag (PostgreSQL)
psql -h localhost -U admin -d agent_orchestrator -c \
  "SELECT slot_name, restart_lsn, confirmed_flush_lsn FROM pg_replication_slots;"

# Check Redis replication
redis-cli INFO replication
```

### Docker Utilities

```bash
# View all container logs
docker-compose logs -f --tail=50

# Check specific service
docker-compose logs postgres
docker-compose logs redis
docker-compose logs rabbitmq

# Restart a service
docker-compose restart postgres
docker-compose restart redis
docker-compose restart rabbitmq

# Force rebuild and restart
docker-compose up --force-recreate --build -d
```

### Database Utilities

```bash
# PostgreSQL Connection Test
export PGPASSWORD=admin_password
psql -h localhost -U admin -d agent_orchestrator -c "SELECT version();"

# Check for locks/blocking queries
psql -h localhost -U admin -d agent_orchestrator -c \
  "SELECT * FROM pg_stat_activity WHERE state='active';"

# Check disk usage
psql -h localhost -U admin -d agent_orchestrator -c \
  "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname='agent_orchestrator';"

# Run ANALYZE to update statistics
psql -h localhost -U admin -d agent_orchestrator -c "ANALYZE;"
```

---

## 📞 ESCALATION MATRIX

**Response Time Targets:**

```
P1 - CRITICAL (Complete platform down)
└─ On-call responds within: 5 minutes
   └─ If not resolved in 15 min → Escalate to manager
      └─ If not resolved in 30 min → Escalate to CIO
         └─ If not resolved in 60 min → Escalate to Executive

P2 - HIGH (One system down, others working)
└─ On-call responds within: 15 minutes
   └─ If not resolved in 45 min → Escalate to manager
      └─ If not resolved in 2 hours → Escalate to CIO

P3 - MEDIUM (Degraded performance, not critical path)
└─ On-call responds within: 1 hour
   └─ Can defer to business hours if after hours
```

---

## 📋 POST-RECOVERY ACTIONS

After successful recovery, do NOT forget:

```bash
# 1. Document what happened
echo "
INCIDENT REPORT
Date: $(date)
Duration: X hours
Cause: [describe]
Impact: [describe]
Resolution: [describe]
Root Cause: [describe]
Preventive Actions: [describe]
" > incident_report_$(date +%Y%m%d).txt

# 2. Update backup status
./scripts/backup-verify.sh

# 3. Notify stakeholders
# Email: All hands announcement that system is recovered

# 4. Schedule post-mortem
# Meeting: Engineering team review, usually within 24 hours

# 5. Create improvement backlog
# Items: What can we do better?
# - Automation improvements
# - Monitoring enhancements
# - Procedure updates
# - Documentation clarifications

# 6. Update on-call runbook
# File: This document and DISASTER_RECOVERY_PLAN.md
```

---

## 🎯 COMMON ISSUES & QUICK FIXES

### PostgreSQL Won't Start After Restore

```bash
# Check logs
docker logs agent_postgres | tail -50

# Common issue: Port already in use
docker port agent_postgres
# Kill existing process if needed
docker rm -f agent_postgres
docker-compose up -d postgres

# Check disk space
df -h /var/lib/postgresql/data

# Repair database if corrupted
docker exec agent_postgres pg_repair_cluster -d agent_orchestrator
```

### Redis Data Lost After Restore

```bash
# Clear cache and rebuild from database
redis-cli FLUSHDB

# Run cache warmer script (if available)
./scripts/warmup-cache.sh

# Or restart app to rebuild cache on-demand
docker-compose restart app
```

### RabbitMQ Queues Not Restored

```bash
# Check if definitions were loaded
docker exec agent_rabbitmq rabbitmqctl list_queues

# If empty, manually import again
docker exec agent_rabbitmq rabbitmqctl import_definitions /tmp/definitions.json

# If still failing, reset and reconfigure
docker exec agent_rabbitmq rabbitmqctl reset
docker exec agent_rabbitmq rabbitmqctl start_app
docker exec agent_rabbitmq rabbitmqctl import_definitions /tmp/definitions.json
```

### Disk Space Full

```bash
# Check what's using space
du -sh ./backups/* | sort -rh

# Remove oldest backups
find ./backups -name "*.gz" -mtime +30 -delete

# Clean Docker
docker system prune -f
docker volume prune -f

# Check inodes (if inode exhausted)
df -i
```

---

## 📚 DOCUMENTATION FILES

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **DISASTER_RECOVERY_PLAN.md** | Complete strategy, RTO/RPO definitions, roles | Planning, quarterly review |
| **BACKUP_PROCEDURES.md** | Detailed backup processes | Understanding backups |
| **RECOVERY_PROCEDURES.md** | Step-by-step recovery guides | During recovery |
| **RTO_RPO_ANALYSIS.md** | Financial analysis, target justification | Planning, budgeting |
| **DR_TESTING_SCHEDULE.md** | Testing procedures and schedule | Before drills |
| **DR_QUICK_REFERENCE.md** (this file) | Emergency procedures | **DURING INCIDENT** |

---

## 🎓 TRAINING & CERTIFICATION

**All on-call engineers must:**
- [ ] Read all DR documentation
- [ ] Practice recovery procedure (at least quarterly)
- [ ] Participate in monthly DR drills
- [ ] Complete certification test annually
- [ ] Maintain current version of this guide

**Certification Test Topics:**
1. Identify correct recovery procedure for failure type
2. Execute recovery procedure successfully
3. Verify recovered system integrity
4. Document incident timeline
5. Communicate with stakeholders

---

## 🔐 IMPORTANT SECURITY NOTES

⚠️ **NEVER commit to this repository:**
- Database passwords
- API keys or secrets
- AWS credentials
- Encryption keys

✓ **Store securely in:**
- AWS Secrets Manager
- HashiCorp Vault
- Encrypted config files
- Environment variables (not in repo)

---

## 🏁 FREQUENTLY CALLED PROCEDURES

```bash
# "The platform is down, what do I do?"
./scripts/dr-status-check.sh                # See what's broken

# "I need to restore PostgreSQL"
./scripts/restore-from-backup.sh --type postgresql --backup <FILE>

# "I need to restore Redis"
./scripts/restore-from-backup.sh --type redis --backup <FILE>

# "I need to restore RabbitMQ"
./scripts/restore-from-backup.sh --type rabbitmq --backup <FILE>

# "Complete failure, switch to DR site"
./scripts/failover-to-dr.sh --region us-west-2

# "Is everything working?"
./scripts/dr-status-check.sh

# "Did backups complete successfully?"
./scripts/backup-verify.sh
```

---

## 📞 24/7 SUPPORT

If you cannot resolve incident:

1. **Check this document** (you're reading it!)
2. **Call on-call DBA** (primary contact)
3. **Call on-call DevOps** (if DBA unavailable)
4. **Escalate to CIO** (if both unavailable or issue critical)
5. **Contact external support** (for infrastructure issues)

**Remember:** Every minute of downtime costs EUR 45,000. Act quickly, but verify carefully.

---

**Last Updated:** November 2024
**Next Review:** February 2025 (Q1)
**Document Owner:** Infrastructure Team

