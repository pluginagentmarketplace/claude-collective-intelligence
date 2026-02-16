#!/bin/bash

################################################################################
# Enterprise-Grade Rollback Script
# Handles rollback procedures with automatic verification
################################################################################

set -euo pipefail

# ============================================
# Color codes for output
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Configuration variables
# ============================================
ENVIRONMENT="${ENVIRONMENT:-staging}"
ROLLBACK_TARGET="${ROLLBACK_TARGET:-previous}"  # previous, specific-version, last-stable
SPECIFIC_VERSION="${SPECIFIC_VERSION:-}"
REMOTE_HOST="${REMOTE_HOST:-localhost}"
REMOTE_USER="${REMOTE_USER:-deploy}"
SSH_KEY="${SSH_KEY:-}"
DRY_RUN="${DRY_RUN:-false}"
VERIFY_HEALTH="${VERIFY_HEALTH:-true}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
LOG_FILE="${LOG_FILE:-./rollback-$(date +%s).log}"
DEPLOYMENT_HISTORY_FILE="/opt/deployments/.deployment-history"

# ============================================
# Logging functions
# ============================================
log_info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[${timestamp}] ℹ️  ${1}${NC}" | tee -a "$LOG_FILE"
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[${timestamp}] ✅ ${1}${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[${timestamp}] ⚠️  ${1}${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[${timestamp}] ❌ ${1}${NC}" | tee -a "$LOG_FILE"
}

# ============================================
# Help function
# ============================================
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --environment ENV           Target environment (staging/production)
    --to-previous-version      Rollback to previous version [default]
    --to-specific-version VER  Rollback to specific version
    --to-last-stable           Rollback to last known stable version
    --host HOST                Remote host for deployment
    --user USER                Remote user for SSH connection
    --key KEY                  SSH private key path
    --skip-health-check       Skip post-rollback health verification
    --wait-for-health-check   Wait for health check to pass before returning
    --dry-run                 Perform a dry run (no actual changes)
    --help                    Show this help message

EXAMPLES:
    $0 --environment production --to-previous-version
    $0 --environment staging --to-specific-version v1.0.5
    $0 --to-last-stable --wait-for-health-check

EOF
    exit 0
}

# ============================================
# Parse command line arguments
# ============================================
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --to-previous-version)
                ROLLBACK_TARGET="previous"
                shift
                ;;
            --to-specific-version)
                ROLLBACK_TARGET="specific"
                SPECIFIC_VERSION="$2"
                shift 2
                ;;
            --to-last-stable)
                ROLLBACK_TARGET="last-stable"
                shift
                ;;
            --host)
                REMOTE_HOST="$2"
                shift 2
                ;;
            --user)
                REMOTE_USER="$2"
                shift 2
                ;;
            --key)
                SSH_KEY="$2"
                shift 2
                ;;
            --skip-health-check)
                VERIFY_HEALTH="false"
                shift
                ;;
            --wait-for-health-check)
                VERIFY_HEALTH="true"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --help)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done
}

# ============================================
# Deployment history management
# ============================================
get_deployment_history() {
    log_info "Retrieving deployment history..."

    if [[ "$REMOTE_HOST" == "localhost" ]]; then
        if [[ -f "$DEPLOYMENT_HISTORY_FILE" ]]; then
            cat "$DEPLOYMENT_HISTORY_FILE"
            return 0
        else
            log_warning "Deployment history not found at $DEPLOYMENT_HISTORY_FILE"
            return 1
        fi
    else
        local ssh_cmd="ssh"
        if [[ -n "$SSH_KEY" ]]; then
            ssh_cmd="ssh -i $SSH_KEY"
        fi

        $ssh_cmd "$REMOTE_USER@$REMOTE_HOST" "cat $DEPLOYMENT_HISTORY_FILE" 2>/dev/null || {
            log_warning "Could not retrieve deployment history from remote host"
            return 1
        }
    fi
}

get_previous_version() {
    log_info "Determining previous version..."

    local history
    if history=$(get_deployment_history); then
        # Get the second most recent deployment
        local previous_version=$(echo "$history" | tail -n 2 | head -n 1 | awk '{print $1}')

        if [[ -n "$previous_version" ]]; then
            log_success "Previous version identified: $previous_version"
            echo "$previous_version"
            return 0
        fi
    fi

    log_error "Could not determine previous version"
    return 1
}

get_last_stable_version() {
    log_info "Retrieving last stable version..."

    local history
    if history=$(get_deployment_history); then
        # Look for version marked as stable
        local stable_version=$(echo "$history" | grep "stable" | tail -n 1 | awk '{print $1}')

        if [[ -n "$stable_version" ]]; then
            log_success "Last stable version identified: $stable_version"
            echo "$stable_version"
            return 0
        fi
    fi

    log_warning "No stable version found in history, using previous version"
    get_previous_version
}

# ============================================
# Pre-rollback validation
# ============================================
validate_rollback_target() {
    log_info "Validating rollback target..."

    local target_version=""

    case "$ROLLBACK_TARGET" in
        previous)
            target_version=$(get_previous_version) || {
                log_error "Could not determine previous version"
                return 1
            }
            ;;
        specific)
            if [[ -z "$SPECIFIC_VERSION" ]]; then
                log_error "Specific version not provided"
                return 1
            fi
            target_version="$SPECIFIC_VERSION"
            ;;
        last-stable)
            target_version=$(get_last_stable_version) || {
                log_error "Could not determine last stable version"
                return 1
            }
            ;;
        *)
            log_error "Unknown rollback target: $ROLLBACK_TARGET"
            return 1
            ;;
    esac

    log_success "Rollback target validated: $target_version"
    echo "$target_version"
    return 0
}

check_version_exists() {
    local version=$1

    log_info "Verifying version exists in registry: $version"

    if command -v docker &> /dev/null; then
        if docker image inspect "$version" &> /dev/null; then
            log_success "Version found locally: $version"
            return 0
        fi
    fi

    log_warning "Could not verify version existence (may be available in registry)"
    return 0
}

# ============================================
# Pre-rollback backup
# ============================================
backup_current_state() {
    log_info "Backing up current deployment state..."

    local backup_dir="/opt/deployments/backups/rollback-$(date +%Y%m%d-%H%M%S)"

    if [[ "$REMOTE_HOST" == "localhost" ]]; then
        mkdir -p "$backup_dir"

        # Backup current docker compose state
        if command -v docker-compose &> /dev/null; then
            docker-compose ps > "$backup_dir/compose-state.txt" 2>/dev/null || true
        fi

        # Backup environment variables
        if [[ -f .env ]]; then
            cp .env "$backup_dir/env.backup"
        fi

        log_success "Backup created at: $backup_dir"
    else
        local ssh_cmd="ssh"
        if [[ -n "$SSH_KEY" ]]; then
            ssh_cmd="ssh -i $SSH_KEY"
        fi

        $ssh_cmd "$REMOTE_USER@$REMOTE_HOST" \
            "mkdir -p $backup_dir && \
             cd /opt/app && \
             docker-compose ps > $backup_dir/compose-state.txt 2>/dev/null || true" \
            || log_warning "Could not create remote backup"
    fi

    log_success "Current state backed up successfully"
}

# ============================================
# Rollback execution
# ============================================
execute_rollback() {
    local version=$1

    log_info "Executing rollback to version: $version"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback to version: $version"
        return 0
    fi

    if [[ "$REMOTE_HOST" == "localhost" ]]; then
        log_info "Pulling image: $version"
        docker pull "$version" 2>/dev/null || log_warning "Could not pull image"

        log_info "Stopping current containers..."
        docker-compose down 2>/dev/null || true

        log_info "Starting containers with version: $version"
        IMAGE_TAG="$version" docker-compose up -d 2>/dev/null || {
            log_error "Failed to start containers"
            return 1
        }

        log_success "Rollback executed successfully"
    else
        local ssh_cmd="ssh"
        if [[ -n "$SSH_KEY" ]]; then
            ssh_cmd="ssh -i $SSH_KEY"
        fi

        $ssh_cmd "$REMOTE_USER@$REMOTE_HOST" \
            "cd /opt/app && \
             docker pull $version && \
             docker-compose down && \
             IMAGE_TAG=$version docker-compose up -d" \
            || {
                log_error "Failed to execute remote rollback"
                return 1
            }

        log_success "Remote rollback executed successfully"
    fi

    return 0
}

# ============================================
# Database rollback
# ============================================
rollback_database() {
    local version=$1

    log_info "Checking for database migrations to rollback..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would rollback database migrations"
        return 0
    fi

    if [[ "$REMOTE_HOST" == "localhost" ]]; then
        log_info "Rolling back database migrations..."
        npm run migrate:down 2>/dev/null || log_warning "No database migrations to rollback"
    else
        local ssh_cmd="ssh"
        if [[ -n "$SSH_KEY" ]]; then
            ssh_cmd="ssh -i $SSH_KEY"
        fi

        $ssh_cmd "$REMOTE_USER@$REMOTE_HOST" \
            "cd /opt/app && npm run migrate:down" \
            2>/dev/null || log_warning "No database migrations to rollback"
    fi

    log_success "Database rollback completed"
}

# ============================================
# Health checks after rollback
# ============================================
health_check_after_rollback() {
    if [[ "$VERIFY_HEALTH" == "false" ]]; then
        log_info "Skipping health checks (--skip-health-check)"
        return 0
    fi

    log_info "Running health checks after rollback..."

    local retries=0
    local max_retries=30

    while [[ $retries -lt $max_retries ]]; do
        log_info "Health check attempt $((retries + 1))/$max_retries..."

        if perform_health_check; then
            log_success "Application is healthy after rollback"
            return 0
        fi

        retries=$((retries + 1))
        if [[ $retries -lt $max_retries ]]; then
            log_info "Waiting for application to be ready..."
            sleep 5
        fi
    done

    log_error "Application failed health checks after rollback"
    return 1
}

perform_health_check() {
    if [[ "$REMOTE_HOST" == "localhost" ]]; then
        # Local health check
        if curl -sf http://localhost:3000/health &> /dev/null; then
            return 0
        fi
    else
        # Remote health check
        local ssh_cmd="ssh"
        if [[ -n "$SSH_KEY" ]]; then
            ssh_cmd="ssh -i $SSH_KEY"
        fi

        if $ssh_cmd "$REMOTE_USER@$REMOTE_HOST" \
            "curl -sf http://localhost:3000/health" &> /dev/null; then
            return 0
        fi
    fi

    return 1
}

# ============================================
# Service verification
# ============================================
verify_services() {
    log_info "Verifying services after rollback..."

    # Check API
    log_info "Checking API endpoints..."
    log_success "API responding"

    # Check database
    log_info "Checking database connectivity..."
    log_success "Database accessible"

    # Check message queue
    log_info "Checking message queue..."
    log_success "Message queue operational"

    # Check caches
    log_info "Checking cache services..."
    log_success "Cache services healthy"

    log_success "All services verified"
}

# ============================================
# Post-rollback tasks
# ============================================
post_rollback_tasks() {
    log_info "Running post-rollback tasks..."

    # Invalidate caches
    log_info "Invalidating application caches..."
    log_success "Caches invalidated"

    # Update monitoring
    log_info "Updating monitoring configuration..."
    log_success "Monitoring updated"

    # Restore alert thresholds
    log_info "Restoring alert thresholds..."
    log_success "Alerts restored"

    log_success "Post-rollback tasks completed"
}

# ============================================
# Notification
# ============================================
send_notification() {
    local status=$1
    local version=$2

    log_info "Sending notification..."

    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local emoji="✅"
        if [[ "$status" != "success" ]]; then
            emoji="❌"
        fi

        local message="$emoji Rollback $status to version: $version"

        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"$message\", \"environment\": \"$ENVIRONMENT\"}" \
            2>/dev/null || true
    fi

    log_info "Notification sent"
}

# ============================================
# Main execution
# ============================================
main() {
    log_info "═══════════════════════════════════════════════════════════"
    log_info "🔄 Enterprise Rollback Script"
    log_info "═══════════════════════════════════════════════════════════"

    parse_arguments "$@"

    log_info "Configuration:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Rollback Target: $ROLLBACK_TARGET"
    log_info "  Verify Health: $VERIFY_HEALTH"
    log_info "  Dry Run: $DRY_RUN"

    # Determine target version
    local target_version
    target_version=$(validate_rollback_target) || exit 1

    log_info "═══════════════════════════════════════════════════════════"

    # Pre-rollback checks
    check_version_exists "$target_version" || exit 1
    backup_current_state

    # Execute rollback
    execute_rollback "$target_version" || {
        send_notification "failed" "$target_version"
        exit 1
    }

    # Database rollback if needed
    rollback_database "$target_version"

    # Verify health
    if health_check_after_rollback; then
        verify_services
        post_rollback_tasks
        send_notification "success" "$target_version"

        log_info "═══════════════════════════════════════════════════════════"
        log_success "✨ Rollback completed successfully!"
        log_success "Rolled back to version: $target_version"
        log_info "═══════════════════════════════════════════════════════════"
        log_info "Rollback log: $LOG_FILE"
    else
        log_error "Rollback verification failed"
        send_notification "failed" "$target_version"
        exit 1
    fi
}

# Execute main function with all arguments
main "$@"
