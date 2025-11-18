#!/bin/bash

################################################################################
# Backup Verification Script
# Validates backup integrity and generates verification report
################################################################################

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-.}/backups"
REPORT_FILE="backup_verification_$(date +%Y%m%d_%H%M%S).report"
ALERT_EMAIL="${ALERT_EMAIL:-ops-team@example.com}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

echo "=========================================" | tee "$REPORT_FILE"
echo "Backup Verification Report" | tee -a "$REPORT_FILE"
echo "Generated: $(date -Iseconds)" | tee -a "$REPORT_FILE"
echo "=========================================" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# PostgreSQL Verification
echo "=== PostgreSQL Backups ===" | tee -a "$REPORT_FILE"
if [ -d "$BACKUP_DIR/postgres" ]; then
    for backup_file in "$BACKUP_DIR"/postgres/backup_*.dump.gz; do
        [ -f "$backup_file" ] || continue

        echo "Checking: $(basename "$backup_file")" | tee -a "$REPORT_FILE"

        # Integrity check
        if gzip -t "$backup_file" 2>/dev/null; then
            SIZE=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file")
            echo "  ✓ File integrity OK (Size: $((SIZE / 1024 / 1024))MB)" | tee -a "$REPORT_FILE"
            PASSED=$((PASSED + 1))
        else
            echo "  ✗ File corruption detected!" | tee -a "$REPORT_FILE"
            FAILED=$((FAILED + 1))
        fi

        # Age check
        CURRENT_TIME=$(date +%s)
        BACKUP_TIME=$(stat -c%Y "$backup_file" 2>/dev/null || stat -f%m "$backup_file")
        AGE=$((CURRENT_TIME - BACKUP_TIME))

        if [ $AGE -lt 86400 ]; then
            echo "  ✓ Age OK (< 24 hours)" | tee -a "$REPORT_FILE"
            PASSED=$((PASSED + 1))
        else
            echo "  ⚠ Age WARNING (> 24 hours: $((AGE / 3600))h)" | tee -a "$REPORT_FILE"
            WARNINGS=$((WARNINGS + 1))
        fi
    done
else
    echo "⚠ PostgreSQL backup directory not found" | tee -a "$REPORT_FILE"
    WARNINGS=$((WARNINGS + 1))
fi

echo "" | tee -a "$REPORT_FILE"

# Redis Verification
echo "=== Redis Backups ===" | tee -a "$REPORT_FILE"
if [ -d "$BACKUP_DIR/redis" ]; then
    for backup_file in "$BACKUP_DIR"/redis/snapshot_*.rdb.gz; do
        [ -f "$backup_file" ] || continue

        echo "Checking: $(basename "$backup_file")" | tee -a "$REPORT_FILE"

        if gzip -t "$backup_file" 2>/dev/null; then
            SIZE=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file")
            echo "  ✓ File integrity OK (Size: $((SIZE / 1024 / 1024))MB)" | tee -a "$REPORT_FILE"
            PASSED=$((PASSED + 1))
        else
            echo "  ✗ File corruption detected!" | tee -a "$REPORT_FILE"
            FAILED=$((FAILED + 1))
        fi
    done
else
    echo "⚠ Redis backup directory not found" | tee -a "$REPORT_FILE"
    WARNINGS=$((WARNINGS + 1))
fi

echo "" | tee -a "$REPORT_FILE"

# RabbitMQ Verification
echo "=== RabbitMQ Backups ===" | tee -a "$REPORT_FILE"
if [ -d "$BACKUP_DIR/rabbitmq" ]; then
    for backup_file in "$BACKUP_DIR"/rabbitmq/*.gz; do
        [ -f "$backup_file" ] || continue

        echo "Checking: $(basename "$backup_file")" | tee -a "$REPORT_FILE"

        if gzip -t "$backup_file" 2>/dev/null; then
            SIZE=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file")
            echo "  ✓ File integrity OK (Size: $((SIZE / 1024))KB)" | tee -a "$REPORT_FILE"
            PASSED=$((PASSED + 1))
        else
            echo "  ✗ File corruption detected!" | tee -a "$REPORT_FILE"
            FAILED=$((FAILED + 1))
        fi
    done
else
    echo "⚠ RabbitMQ backup directory not found" | tee -a "$REPORT_FILE"
    WARNINGS=$((WARNINGS + 1))
fi

echo "" | tee -a "$REPORT_FILE"

# Disk Space Check
echo "=== Disk Space ===" | tee -a "$REPORT_FILE"
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
AVAILABLE=$(df "$BACKUP_DIR" 2>/dev/null | tail -1 | awk '{print $4}')
USED_PERCENT=$(df "$BACKUP_DIR" 2>/dev/null | tail -1 | awk '{print $5}')

echo "Backup directory size: $BACKUP_SIZE" | tee -a "$REPORT_FILE"
echo "Available space: $((AVAILABLE / 1024 / 1024))GB" | tee -a "$REPORT_FILE"
echo "Disk usage: $USED_PERCENT" | tee -a "$REPORT_FILE"

if [ "${USED_PERCENT%\%}" -lt 80 ]; then
    echo "✓ Disk space OK" | tee -a "$REPORT_FILE"
    PASSED=$((PASSED + 1))
else
    echo "✗ Disk space warning: $USED_PERCENT used" | tee -a "$REPORT_FILE"
    FAILED=$((FAILED + 1))
fi

echo "" | tee -a "$REPORT_FILE"

# S3 Verification (if AWS CLI available)
echo "=== S3 Backups ===" | tee -a "$REPORT_FILE"
if command -v aws &>/dev/null && [ ! -z "${BACKUP_S3_BUCKET:-}" ]; then
    S3_BUCKET="${BACKUP_S3_BUCKET}"
    if aws s3 ls "s3://$S3_BUCKET/postgres/" --recursive 2>/dev/null | head -5 | grep -q .; then
        echo "✓ S3 backups detected" | tee -a "$REPORT_FILE"
        PASSED=$((PASSED + 1))
        LATEST=$(aws s3 ls "s3://$S3_BUCKET/postgres/" --recursive | tail -1)
        echo "  Latest: $LATEST" | tee -a "$REPORT_FILE"
    else
        echo "✗ No S3 backups found" | tee -a "$REPORT_FILE"
        FAILED=$((FAILED + 1))
    fi
else
    echo "⚠ AWS CLI not available or S3_BUCKET not configured" | tee -a "$REPORT_FILE"
    WARNINGS=$((WARNINGS + 1))
fi

echo "" | tee -a "$REPORT_FILE"

# Summary
echo "=========================================" | tee -a "$REPORT_FILE"
echo "Summary" | tee -a "$REPORT_FILE"
echo "=========================================" | tee -a "$REPORT_FILE"
echo "Passed Checks: $PASSED" | tee -a "$REPORT_FILE"
echo "Failed Checks: $FAILED" | tee -a "$REPORT_FILE"
echo "Warnings: $WARNINGS" | tee -a "$REPORT_FILE"

if [ $FAILED -eq 0 ]; then
    echo "Status: ✓ ALL BACKUPS VERIFIED SUCCESSFULLY" | tee -a "$REPORT_FILE"
    exit 0
else
    echo "Status: ✗ BACKUP VERIFICATION FAILED" | tee -a "$REPORT_FILE"
    if [ ! -z "$ALERT_EMAIL" ]; then
        mail -s "ALERT: Backup Verification FAILED" "$ALERT_EMAIL" <"$REPORT_FILE"
    fi
    exit 1
fi
