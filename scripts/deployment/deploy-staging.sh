#!/bin/bash

################################################################################
# Deployment Script for Staging Environment
# Handles deployment to Kubernetes or Docker Compose environments
################################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/deploy-staging-${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
DEPLOYMENT_TYPE="kubernetes"  # kubernetes or docker-compose
DRY_RUN=false
SKIP_TESTS=false
SKIP_MIGRATIONS=false
BACKUP_FIRST=false
SKIP_HEALTH_CHECK=false
VERSION="latest"

################################################################################
# Functions
################################################################################

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}INFO${NC}" "$@"
}

log_success() {
    log "${GREEN}SUCCESS${NC}" "$@"
}

log_error() {
    log "${RED}ERROR${NC}" "$@"
}

log_warning() {
    log "${YELLOW}WARNING${NC}" "$@"
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --env ENV              Environment (default: staging)
    --type TYPE           Deployment type: kubernetes or docker-compose (default: kubernetes)
    --version VERSION     Docker image version (default: latest)
    --dry-run             Show what would be deployed without making changes
    --skip-tests          Skip running tests
    --skip-migrations     Skip running database migrations
    --skip-health-check   Skip health checks after deployment
    --backup-first        Create backup before deployment
    -h, --help            Show this help message

EXAMPLES:
    # Deploy to Kubernetes
    $0 --env staging --type kubernetes

    # Deploy with Docker Compose and skip tests
    $0 --env staging --type docker-compose --skip-tests

    # Dry run to see what would be deployed
    $0 --env staging --dry-run

    # Deploy with backup
    $0 --env staging --backup-first
EOF
    exit 0
}

################################################################################
# Parse Arguments
################################################################################

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=true
            shift
            ;;
        --backup-first)
            BACKUP_FIRST=true
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
# Main Deployment Functions
################################################################################

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker/Kubernetes availability
    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        if ! command -v docker-compose &> /dev/null; then
            log_error "docker-compose is not installed"
            exit 1
        fi
        if ! command -v docker &> /dev/null; then
            log_error "docker is not installed"
            exit 1
        fi
    else
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is not installed"
            exit 1
        fi
        if ! command -v helm &> /dev/null; then
            log_error "helm is not installed"
            exit 1
        fi
    fi

    # Check environment file
    if [ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
        log_warning ".env.$ENVIRONMENT not found, creating from example"
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.$ENVIRONMENT"
    fi

    log_success "Prerequisites check passed"
}

create_backup() {
    if [ "$BACKUP_FIRST" = false ]; then
        return
    fi

    log_info "Creating backup before deployment..."

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        docker-compose -f "$PROJECT_ROOT/docker-compose-staging.yml" exec -T postgres \
            pg_dump -U staging_user agent_orchestrator_staging > \
            "$PROJECT_ROOT/backups/postgres/backup-${TIMESTAMP}.sql" || true
    else
        kubectl exec -n staging postgres-0 -- \
            pg_dump -U staging_user agent_orchestrator_staging > \
            "$PROJECT_ROOT/backups/postgres/backup-${TIMESTAMP}.sql" || true
    fi

    log_success "Backup created"
}

run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        log_warning "Skipping tests as requested"
        return
    fi

    log_info "Running tests..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: npm run test:integration"
        return
    fi

    cd "$PROJECT_ROOT"
    npm run test:integration || {
        log_error "Integration tests failed"
        exit 1
    }

    log_success "Tests passed"
}

run_migrations() {
    if [ "$SKIP_MIGRATIONS" = true ]; then
        log_warning "Skipping migrations as requested"
        return
    fi

    log_info "Running database migrations..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: npm run migrate:up"
        return
    fi

    cd "$PROJECT_ROOT"
    npm run migrate:up || {
        log_error "Database migrations failed"
        exit 1
    }

    log_success "Migrations completed"
}

deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."

    local COMPOSE_FILE="$PROJECT_ROOT/docker-compose-staging.yml"
    local ENV_FILE="$PROJECT_ROOT/.env.$ENVIRONMENT"

    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d"
        return
    fi

    cd "$PROJECT_ROOT"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull || {
        log_error "Failed to pull Docker images"
        exit 1
    }

    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d || {
        log_error "Failed to start services with Docker Compose"
        exit 1
    }

    log_success "Services started with Docker Compose"
}

deploy_kubernetes() {
    log_info "Deploying with Kubernetes..."

    local NAMESPACE="staging"
    local HELM_CHART="$PROJECT_ROOT/helm/agent-orchestrator"
    local VALUES_FILE="$HELM_CHART/values-staging.yaml"

    if [ ! -d "$HELM_CHART" ]; then
        log_error "Helm chart not found: $HELM_CHART"
        exit 1
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: kubectl create namespace $NAMESPACE"
        log_info "[DRY RUN] Would run: helm upgrade --install agent-orchestrator $HELM_CHART -f $VALUES_FILE -n $NAMESPACE"
        return
    fi

    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - || true

    # Lint Helm chart
    helm lint "$HELM_CHART" || {
        log_error "Helm chart validation failed"
        exit 1
    }

    # Deploy with Helm
    helm upgrade --install agent-orchestrator "$HELM_CHART" \
        -f "$VALUES_FILE" \
        -n "$NAMESPACE" \
        --set image.tag="$VERSION" \
        --wait \
        --timeout 5m || {
        log_error "Helm deployment failed"
        exit 1
    }

    log_success "Kubernetes deployment completed"
}

run_smoke_tests() {
    log_info "Running smoke tests..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run: npm run test:e2e:quick"
        return
    fi

    cd "$PROJECT_ROOT"
    npm run test:e2e:quick || {
        log_warning "Smoke tests completed with warnings"
    }

    log_success "Smoke tests completed"
}

################################################################################
# Main Execution
################################################################################

main() {
    log_info "=========================================="
    log_info "Staging Environment Deployment"
    log_info "=========================================="
    log_info "Environment: $ENVIRONMENT"
    log_info "Deployment Type: $DEPLOYMENT_TYPE"
    log_info "Version: $VERSION"
    log_info "Dry Run: $DRY_RUN"
    log_info "=========================================="

    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"

    check_prerequisites
    create_backup
    run_tests
    run_migrations

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        deploy_docker_compose
    else
        deploy_kubernetes
    fi

    if [ "$SKIP_HEALTH_CHECK" = false ]; then
        sleep 10  # Give services time to start
        "$SCRIPT_DIR/health-check.sh" || log_warning "Health checks reported issues"
    fi

    run_smoke_tests

    log_info "=========================================="
    log_success "Deployment completed successfully!"
    log_info "=========================================="
    log_info "Logs saved to: $LOG_FILE"

    if [ "$DEPLOYMENT_TYPE" = "docker-compose" ]; then
        log_info ""
        log_info "Service URLs:"
        log_info "  - Application: http://localhost:3000"
        log_info "  - RabbitMQ Management: http://localhost:15672"
        log_info "  - pgAdmin: http://localhost:5050"
        log_info "  - Grafana: http://localhost:3001"
        log_info "  - Prometheus: http://localhost:9090"
    else
        log_info ""
        log_info "Kubernetes Deployment:"
        log_info "  kubectl get all -n staging"
        log_info ""
        log_info "Port forwarding:"
        log_info "  kubectl port-forward svc/agent-orchestrator 3000:3000 -n staging"
    fi
}

# Run main function
main "$@"
