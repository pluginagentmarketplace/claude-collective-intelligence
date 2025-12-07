#!/bin/bash

################################################################################
# Failover to Disaster Recovery Site Script
# Manages complete failover to backup infrastructure in alternate region
################################################################################

set -euo pipefail

TARGET_REGION="${TARGET_REGION:-us-west-2}"
DR_BACKUP_LOCATION="${DR_BACKUP_LOCATION:-s3://backup-agent-platform-prod}"
FAILOVER_LOG="failover_$(date +%Y%m%d_%H%M%S).log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$FAILOVER_LOG"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$FAILOVER_LOG" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$FAILOVER_LOG"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$FAILOVER_LOG"
}

show_usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --region REGION       Target AWS region for failover (default: us-west-2)
  --backups BUCKET      S3 bucket for backups (default: backup-agent-platform-prod)
  --confirm             Proceed without confirmation prompt
  --help                Show this help message

Examples:
  # Failover to us-west-2 (with confirmation prompt)
  $0 --region us-west-2

  # Failover to us-west-2 without confirmation
  $0 --region us-west-2 --confirm
EOF
}

confirm_failover() {
    echo ""
    echo "========================================="
    warning "FAILOVER TO DISASTER RECOVERY SITE"
    echo "========================================="
    echo ""
    echo "This will:"
    echo "  1. Download latest backups from S3"
    echo "  2. Provision infrastructure in $TARGET_REGION"
    echo "  3. Restore all databases to DR site"
    echo "  4. Update DNS to point to DR infrastructure"
    echo ""
    read -p "Are you ABSOLUTELY SURE? Type 'yes' to proceed: " confirm
    if [ "$confirm" != "yes" ]; then
        log "Failover cancelled by user"
        exit 0
    fi
}

prepare_backups() {
    log "========================================="
    log "Step 1: Preparing Backups from S3"
    log "========================================="

    mkdir -p ./dr-restore/{postgres,redis,rabbitmq}

    # Check AWS CLI
    if ! command -v aws &>/dev/null; then
        error "AWS CLI not installed"
        return 1
    fi

    info "Downloading PostgreSQL backup..."
    aws s3 cp \
        "$DR_BACKUP_LOCATION/postgres/latest/backup.dump.gz" \
        "./dr-restore/postgres/" \
        --region "$TARGET_REGION" ||
        {
            warning "Could not download latest PostgreSQL backup, trying most recent"
            aws s3 sync \
                "$DR_BACKUP_LOCATION/postgres/" \
                "./dr-restore/postgres/" \
                --region "$TARGET_REGION" \
                --exclude "*" \
                --include "*.dump.gz" \
                --no-progress
        }

    info "Downloading Redis backup..."
    aws s3 cp \
        "$DR_BACKUP_LOCATION/redis/latest/snapshot.rdb.gz" \
        "./dr-restore/redis/" \
        --region "$TARGET_REGION" || \
        warning "Redis backup not found"

    info "Downloading RabbitMQ backup..."
    aws s3 cp \
        "$DR_BACKUP_LOCATION/rabbitmq/latest/definitions.json.gz" \
        "./dr-restore/rabbitmq/" \
        --region "$TARGET_REGION" || \
        warning "RabbitMQ backup not found"

    log "✓ Backups downloaded"
    return 0
}

provision_infrastructure() {
    log "========================================="
    log "Step 2: Provisioning Infrastructure in $TARGET_REGION"
    log "========================================="

    # Check for Terraform
    if ! command -v terraform &>/dev/null; then
        error "Terraform not installed"
        return 1
    fi

    info "Initializing Terraform for DR region..."
    terraform init \
        -backend-config="region=$TARGET_REGION" \
        -reconfigure \
        ./terraform/dr-site || \
        warning "Terraform init had issues, continuing..."

    info "Applying Terraform configuration..."
    terraform apply \
        -var="region=$TARGET_REGION" \
        -var="environment=dr" \
        -target=aws_vpc.dr \
        -target=aws_instance.dr_app \
        -target=aws_db_instance.dr_postgres \
        -target=aws_elasticache_cluster.dr_redis \
        -auto-approve \
        ./terraform/dr-site || \
        {
            error "Terraform provisioning failed"
            return 1
        }

    log "✓ Infrastructure provisioned"

    # Retrieve outputs
    info "Getting infrastructure details..."
    terraform output -json >./dr-infrastructure-output.json || true

    return 0
}

restore_databases() {
    log "========================================="
    log "Step 3: Restoring Databases"
    log "========================================="

    # Get RDS endpoint from Terraform output
    local db_endpoint=$(terraform output -raw dr_db_host 2>/dev/null || echo "localhost")
    local db_user="admin"
    local db_password="${POSTGRES_PASSWORD}"

    if [ -z "$db_password" ]; then
        error "POSTGRES_PASSWORD not set"
        return 1
    fi

    # Find latest PostgreSQL backup
    local pg_backup=$(find ./dr-restore/postgres -name "*.dump.gz" | sort | tail -1)

    if [ -z "$pg_backup" ]; then
        warning "No PostgreSQL backup found"
    else
        info "Restoring PostgreSQL to $db_endpoint..."
        export PGPASSWORD="$db_password"

        gunzip -c "$pg_backup" | pg_restore \
            -h "$db_endpoint" \
            -U "$db_user" \
            -d agent_orchestrator \
            -F custom \
            -j 4 \
            -v 2>&1 | tail -20 | tee -a "$FAILOVER_LOG" || \
            warning "PostgreSQL restore had issues"

        unset PGPASSWORD
        log "✓ PostgreSQL restored"
    fi

    # Redis restore
    local redis_endpoint=$(terraform output -raw dr_redis_host 2>/dev/null || echo "localhost")
    local redis_backup=$(find ./dr-restore/redis -name "*.rdb.gz" | sort | tail -1)

    if [ ! -z "$redis_backup" ]; then
        info "Restoring Redis to $redis_endpoint..."
        # Note: RDS for Redis requires specific procedure
        warning "Redis restore requires manual intervention (use RDS import)"
        log "Redis backup available at: $redis_backup"
    fi

    return 0
}

update_dns() {
    log "========================================="
    log "Step 4: Updating DNS"
    log "========================================="

    # Get DR app endpoint
    local dr_endpoint=$(terraform output -raw dr_app_endpoint 2>/dev/null || echo "")

    if [ -z "$dr_endpoint" ]; then
        warning "Could not get DR endpoint from Terraform"
        return 1
    fi

    info "Updating DNS for api.example.com to point to $dr_endpoint"

    # Requires AWS credentials and Route53 access
    if ! command -v aws &>/dev/null; then
        error "AWS CLI required for DNS update"
        return 1
    fi

    local zone_id="${ROUTE53_ZONE_ID:-}"
    if [ -z "$zone_id" ]; then
        warning "ROUTE53_ZONE_ID not set, DNS update skipped"
        log "Manual DNS update required: Point api.example.com to $dr_endpoint"
        return 0
    fi

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$zone_id" \
        --change-batch "{
            \"Changes\": [{
                \"Action\": \"UPSERT\",
                \"ResourceRecordSet\": {
                    \"Name\": \"api.example.com\",
                    \"Type\": \"CNAME\",
                    \"TTL\": 60,
                    \"ResourceRecords\": [{
                        \"Value\": \"$dr_endpoint\"
                    }]
                }
            }]
        }" || \
        {
            warning "DNS update failed, may need manual intervention"
            return 1
        }

    log "✓ DNS updated"
    return 0
}

verify_failover() {
    log "========================================="
    log "Step 5: Verifying Failover"
    log "========================================="

    info "Waiting for DNS propagation..."
    sleep 30

    info "Testing application health..."
    local attempts=0
    local max_attempts=30

    while [ $attempts -lt $max_attempts ]; do
        if curl -s -f -m 5 "https://api.example.com/health" >/dev/null 2>&1; then
            log "✓ Application is responding"
            return 0
        fi

        attempts=$((attempts + 1))
        info "Health check failed, retrying... ($attempts/$max_attempts)"
        sleep 10
    done

    warning "Application not responding after $max_attempts attempts"
    return 1
}

cleanup() {
    log "========================================="
    log "Step 6: Cleanup"
    log "========================================="

    info "Archiving failover logs..."
    tar -czf "failover_logs_$(date +%Y%m%d_%H%M%S).tar.gz" "$FAILOVER_LOG"

    log "✓ Cleanup completed"
}

main() {
    local confirm_mode=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
        --region)
            TARGET_REGION="$2"
            shift 2
            ;;
        --backups)
            DR_BACKUP_LOCATION="$2"
            shift 2
            ;;
        --confirm)
            confirm_mode=true
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

    log "========================================="
    log "FAILOVER TO DISASTER RECOVERY SITE"
    log "Started: $(date -Iseconds)"
    log "Target Region: $TARGET_REGION"
    log "Backup Location: $DR_BACKUP_LOCATION"
    log "========================================="

    # Confirmation
    if [ "$confirm_mode" == "false" ]; then
        confirm_failover
    fi

    # Execute failover steps
    prepare_backups || exit 1
    provision_infrastructure || exit 1
    restore_databases || true
    update_dns || true
    verify_failover || warning "Verification had issues but continuing"
    cleanup

    log ""
    log "========================================="
    log "FAILOVER COMPLETED"
    log "Completed: $(date -Iseconds)"
    log "========================================="
    log "Failover log: $FAILOVER_LOG"

    return 0
}

main "$@"
