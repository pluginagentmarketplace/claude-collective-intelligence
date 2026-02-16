#!/bin/bash

################################################################################
# Rollback Script for Staging Environment
# Rolls back to previous deployment version
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/rollback-staging-${TIMESTAMP}.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOYMENT_TYPE="kubernetes"  # kubernetes or docker-compose
ROLLBACK_TARGET=""
ACTION="rollback"

################################################################################
# Functions
################################################################################

log() {
    local level=$1
    shift
    echo -e "${*}" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $@"
}

log_success() {
    log "${GREEN}[✓]${NC} $@"
}

log_error() {
    log "${RED}[✗]${NC} $@"
}

log_warning() {
    log "${YELLOW}[!]${NC} $@"
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --type TYPE              Deployment type: kubernetes or docker-compose (default: kubernetes)
    --previous              Rollback to previous version
    --version VERSION       Rollback to specific version
    --list                  List available versions
    -h, --help              Show this help message

EXAMPLES:
    # Rollback to previous version
    $0 --previous

    # Rollback to specific version
    $0 --version 1.0.0

    # List available versions
    $0 --list

    # Rollback Docker Compose deployment
    $0 --type docker-compose --previous
EOF
    exit 0
}

################################################################################
# Parse Arguments
################################################################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        --previous)
            ACTION="previous"
            shift
            ;;
        --version)
            ROLLBACK_TARGET="$2"
            ACTION="specific"
            shift 2
            ;;
        --list)
            ACTION="list"
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

################################################################################
# Rollback Functions
################################################################################

list_versions_kubernetes() {
    log_info "Available Helm releases:"
    helm history agent-orchestrator -n staging || {
        log_error "Failed to retrieve release history"
        return 1
    }
}

list_versions_docker_compose() {
    log_info "Docker images in use:"
    docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" images || {
        log_error "Failed to retrieve image information"
        return 1
    }
}

rollback_to_previous_kubernetes() {
    log_info "Rolling back to previous Helm release..."

    # Get current revision
    local current_revision=$(helm history agent-orchestrator -n staging | tail -1 | awk '{print $1}')
    local previous_revision=$((current_revision - 1))

    if [ "$previous_revision" -lt 1 ]; then
        log_error "No previous version to rollback to"
        return 1
    fi

    log_info "Rolling back from revision $current_revision to $previous_revision..."

    helm rollback agent-orchestrator "$previous_revision" -n staging || {
        log_error "Helm rollback failed"
        return 1
    }

    # Wait for rollback to complete
    kubectl rollout status deployment/agent-orchestrator -n staging --timeout=5m || {
        log_warning "Rollout status check timed out, but rollback may have succeeded"
    }

    log_success "Rollback to revision $previous_revision completed"
}

rollback_to_specific_kubernetes() {
    log_info "Rolling back to specific version: $ROLLBACK_TARGET"

    # Check if version exists
    local revision=$(helm history agent-orchestrator -n staging | grep "$ROLLBACK_TARGET" | awk '{print $1}' | head -1)

    if [ -z "$revision" ]; then
        log_error "Version $ROLLBACK_TARGET not found in history"
        list_versions_kubernetes
        return 1
    fi

    log_info "Rolling back to revision $revision..."

    helm rollback agent-orchestrator "$revision" -n staging || {
        log_error "Helm rollback failed"
        return 1
    }

    kubectl rollout status deployment/agent-orchestrator -n staging --timeout=5m || {
        log_warning "Rollout status check timed out, but rollback may have succeeded"
    }

    log_success "Rollback to revision $revision completed"
}

rollback_to_previous_docker_compose() {
    log_warning "Docker Compose automatic rollback not fully implemented"
    log_info "Available images:"
    docker images | grep plugin-ai-agent-rabbitmq

    log_info ""
    log_info "To rollback, you can:"
    log_info "1. Modify the docker-compose-staging.yml to use a previous image tag"
    log_info "2. Run: docker-compose -f docker-compose-staging.yml up -d agent-orchestrator"
    log_info ""
    log_info "For example:"
    log_info "  docker-compose -f docker-compose-staging.yml pull agent-orchestrator:v1.0.0"
    log_info "  docker-compose -f docker-compose-staging.yml up -d"
}

restore_backup() {
    log_info "Attempting to restore from most recent backup..."

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        local backup_file=$(ls -t "$PROJECT_ROOT/backups/postgres/backup-"*.sql 2>/dev/null | head -1)

        if [ -z "$backup_file" ]; then
            log_warning "No backup file found"
            return 1
        fi

        log_info "Restoring from backup: $backup_file"

        docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" exec -T postgres \
            psql -U staging_user agent_orchestrator_staging < "$backup_file" || {
            log_error "Backup restore failed"
            return 1
        }

        log_success "Backup restore completed"
    else
        log_info "Restoring Kubernetes backup..."
        # Kubernetes backup restoration would be similar
        log_info "Manual restoration may be required"
    fi
}

verify_rollback() {
    log_info "Verifying rollback..."

    sleep 5

    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        local ready=$(kubectl get deployment agent-orchestrator -n staging \
            -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null)

        if [ "$ready" = "True" ]; then
            log_success "Deployment is ready after rollback"
        else
            log_warning "Deployment may not be ready, check status manually"
        fi
    else
        if docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" \
            ps agent-orchestrator | grep -q "running"; then
            log_success "Service is running after rollback"
        else
            log_warning "Service may not be running, check logs"
        fi
    fi
}

################################################################################
# Main Execution
################################################################################

main() {
    mkdir -p "$(dirname "$LOG_FILE")"

    log_info "=========================================="
    log_info "Staging Environment Rollback"
    log_info "=========================================="
    log_info "Deployment Type: $DEPLOYMENT_TYPE"
    log_info "Action: $ACTION"
    log_info "=========================================="

    case "$ACTION" in
        list)
            if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
                list_versions_kubernetes
            else
                list_versions_docker_compose
            fi
            ;;
        previous)
            log_warning "This will rollback to the previous version. Continue? (y/n)"
            read -r response
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                log_info "Rollback cancelled"
                exit 0
            fi

            if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
                rollback_to_previous_kubernetes || {
                    log_error "Rollback failed"
                    exit 1
                }
            else
                rollback_to_previous_docker_compose || {
                    log_error "Rollback failed"
                    exit 1
                }
            fi
            ;;
        specific)
            if [ -z "$ROLLBACK_TARGET" ]; then
                log_error "No version specified with --version"
                usage
            fi

            log_warning "This will rollback to version $ROLLBACK_TARGET. Continue? (y/n)"
            read -r response
            if [ "$response" != "y" ] && [ "$response" != "Y" ]; then
                log_info "Rollback cancelled"
                exit 0
            fi

            if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
                rollback_to_specific_kubernetes || {
                    log_error "Rollback failed"
                    exit 1
                }
            else
                log_error "Specific version rollback not supported for Docker Compose"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown action: $ACTION"
            usage
            ;;
    esac

    verify_rollback

    log_info ""
    log_success "Rollback process completed"
    log_info "Logs saved to: $LOG_FILE"
}

# Run main function
main "$@"
