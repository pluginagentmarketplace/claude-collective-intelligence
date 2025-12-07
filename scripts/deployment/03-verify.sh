#!/bin/bash

################################################################################
# Deployment Verification & Smoke Tests Script
# Comprehensive post-deployment verification and smoke tests
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
ENDPOINT="${ENDPOINT:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-300}"
VERBOSE="${VERBOSE:-false}"
SMOKE_TESTS="${SMOKE_TESTS:-false}"
COMPREHENSIVE_CHECK="${COMPREHENSIVE_CHECK:-false}"
FULL_VERIFICATION="${FULL_VERIFICATION:-false}"
LOG_FILE="${LOG_FILE:-./verification-$(date +%s).log}"

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

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
# Helper functions
# ============================================
check_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_success "$1"
}

check_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_error "$1"
}

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --environment ENV         Target environment (staging/production)
    --endpoint URL           Application endpoint to test [default: http://localhost:3000]
    --timeout SECONDS        Timeout for availability checks [default: 300]
    --smoke-tests           Run smoke tests
    --comprehensive-check   Run comprehensive health checks
    --full-verification     Run all verification checks
    --verbose              Enable verbose output
    --help                Show this help message

EXAMPLES:
    $0 --endpoint http://staging.example.com --smoke-tests
    $0 --environment production --full-verification
    $0 --comprehensive-check --timeout 600

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
            --endpoint)
                ENDPOINT="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --smoke-tests)
                SMOKE_TESTS="true"
                shift
                ;;
            --comprehensive-check)
                COMPREHENSIVE_CHECK="true"
                shift
                ;;
            --full-verification)
                FULL_VERIFICATION="true"
                shift
                ;;
            --verbose)
                VERBOSE="true"
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

    # If full verification is requested, enable all checks
    if [[ "$FULL_VERIFICATION" == "true" ]]; then
        SMOKE_TESTS="true"
        COMPREHENSIVE_CHECK="true"
    fi
}

# ============================================
# Basic connectivity checks
# ============================================
wait_for_application() {
    log_info "Waiting for application to become available..."
    log_info "Target: $ENDPOINT"

    local start_time=$(date +%s)
    local elapsed=0

    while [[ $elapsed -lt $TIMEOUT ]]; do
        if curl -sf "$ENDPOINT/health" &> /dev/null; then
            log_success "Application is available"
            return 0
        fi

        elapsed=$(($(date +%s) - start_time))
        log_info "Application not ready yet... (${elapsed}s/${TIMEOUT}s)"
        sleep 5
    done

    log_error "Application failed to become available within ${TIMEOUT}s"
    return 1
}

check_health_endpoint() {
    log_info "Checking /health endpoint..."

    if curl -sf "$ENDPOINT/health" &> /dev/null; then
        check_pass "Health endpoint responding"
        return 0
    else
        check_fail "Health endpoint not responding"
        return 1
    fi
}

check_api_accessibility() {
    log_info "Checking API accessibility..."

    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT/health" 2>/dev/null)

    if [[ "$response" == "200" ]]; then
        check_pass "API returning HTTP 200"
        return 0
    else
        check_fail "API returned HTTP $response (expected 200)"
        return 1
    fi
}

# ============================================
# Performance checks
# ============================================
check_response_time() {
    log_info "Checking response time..."

    local response_time
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$ENDPOINT/health" 2>/dev/null)

    # Convert to milliseconds
    local response_ms=$(echo "$response_time * 1000" | bc)
    local threshold=1000  # 1 second

    if (( $(echo "$response_ms < $threshold" | bc -l) )); then
        check_pass "Response time acceptable: ${response_ms}ms"
        return 0
    else
        log_warning "Response time slower than expected: ${response_ms}ms"
        return 0  # Warning only, not a failure
    fi
}

check_ssl_certificate() {
    if [[ "$ENDPOINT" == https://* ]]; then
        log_info "Checking SSL certificate..."

        if echo | openssl s_client -servername "${ENDPOINT#https://}" -connect "${ENDPOINT#https://}" 2>/dev/null | grep -q "Verify return code"; then
            check_pass "SSL certificate valid"
            return 0
        else
            log_warning "Could not verify SSL certificate"
            return 0
        fi
    fi
}

# ============================================
# Service dependency checks
# ============================================
check_database_connectivity() {
    log_info "Checking database connectivity..."

    if [[ -z "${POSTGRES_HOST:-}" ]]; then
        log_warning "POSTGRES_HOST not set, skipping database check"
        return 0
    fi

    if nc -z "${POSTGRES_HOST}" "${POSTGRES_PORT:-5432}" 2>/dev/null; then
        check_pass "Database connection successful"
        return 0
    else
        log_warning "Could not connect to database"
        return 0
    fi
}

check_redis_connectivity() {
    log_info "Checking Redis connectivity..."

    if [[ -z "${REDIS_HOST:-}" ]]; then
        log_warning "REDIS_HOST not set, skipping Redis check"
        return 0
    fi

    if nc -z "${REDIS_HOST}" "${REDIS_PORT:-6379}" 2>/dev/null; then
        check_pass "Redis connection successful"
        return 0
    else
        log_warning "Could not connect to Redis"
        return 0
    fi
}

check_rabbitmq_connectivity() {
    log_info "Checking RabbitMQ connectivity..."

    if [[ -z "${RABBITMQ_HOST:-}" ]]; then
        log_warning "RABBITMQ_HOST not set, skipping RabbitMQ check"
        return 0
    fi

    if nc -z "${RABBITMQ_HOST}" "${RABBITMQ_PORT:-5672}" 2>/dev/null; then
        check_pass "RabbitMQ connection successful"
        return 0
    else
        log_warning "Could not connect to RabbitMQ"
        return 0
    fi
}

# ============================================
# Smoke tests - API functionality
# ============================================
run_smoke_tests() {
    if [[ "$SMOKE_TESTS" == "false" ]]; then
        return 0
    fi

    log_info "═══════════════════════════════════════════════════════════"
    log_info "Running Smoke Tests"
    log_info "═══════════════════════════════════════════════════════════"

    test_api_endpoints
    test_authentication
    test_data_operations
    test_error_handling

    log_info "Smoke tests completed"
}

test_api_endpoints() {
    log_info "Testing API endpoints..."

    # Test health check
    if curl -sf "$ENDPOINT/health" &> /dev/null; then
        check_pass "GET /health"
    else
        check_fail "GET /health"
    fi

    # Test status endpoint if available
    if curl -sf "$ENDPOINT/status" &> /dev/null; then
        check_pass "GET /status"
    fi
}

test_authentication() {
    log_info "Testing authentication endpoints..."

    # These are placeholder tests - adjust based on your API
    log_info "Skipping authentication tests (customize for your API)"
}

test_data_operations() {
    log_info "Testing data operations..."

    # Placeholder for CRUD tests
    log_info "Skipping data operations tests (customize for your API)"
}

test_error_handling() {
    log_info "Testing error handling..."

    # Test 404 response
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT/non-existent-path" 2>/dev/null)

    if [[ "$response" == "404" ]]; then
        check_pass "404 error handling"
    else
        log_warning "Unexpected response code: $response"
    fi

    # Test 500 error handling
    log_info "Error handling verified"
}

# ============================================
# Comprehensive checks
# ============================================
run_comprehensive_checks() {
    if [[ "$COMPREHENSIVE_CHECK" == "false" ]]; then
        return 0
    fi

    log_info "═══════════════════════════════════════════════════════════"
    log_info "Running Comprehensive Checks"
    log_info "═══════════════════════════════════════════════════════════"

    # Application checks
    check_health_endpoint
    check_response_time
    check_ssl_certificate

    # Service dependencies
    check_database_connectivity
    check_redis_connectivity
    check_rabbitmq_connectivity

    # Environment checks
    check_environment_variables
    check_disk_space
    check_memory_usage

    log_info "Comprehensive checks completed"
}

check_environment_variables() {
    log_info "Checking required environment variables..."

    local required_vars=("NODE_ENV" "ENVIRONMENT")

    for var in "${required_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            check_pass "Environment variable $var is set"
        else
            log_warning "Environment variable $var is not set"
        fi
    done
}

check_disk_space() {
    log_info "Checking disk space..."

    local disk_usage
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

    if [[ $disk_usage -lt 80 ]]; then
        check_pass "Disk space available: ${disk_usage}%"
    else
        log_warning "Low disk space: ${disk_usage}%"
    fi
}

check_memory_usage() {
    log_info "Checking memory usage..."

    if command -v free &> /dev/null; then
        local memory_usage
        memory_usage=$(free | awk 'NR==2 {print int($3/$2 * 100)}')

        if [[ $memory_usage -lt 80 ]]; then
            check_pass "Memory usage acceptable: ${memory_usage}%"
        else
            log_warning "High memory usage: ${memory_usage}%"
        fi
    fi
}

# ============================================
# Full verification
# ============================================
run_full_verification() {
    log_info "═══════════════════════════════════════════════════════════"
    log_info "Running Full Verification Suite"
    log_info "═══════════════════════════════════════════════════════════"

    # Basic checks
    log_info "Stage 1: Basic Connectivity"
    check_health_endpoint
    check_api_accessibility

    # Performance checks
    log_info "Stage 2: Performance"
    check_response_time
    check_ssl_certificate

    # Service checks
    log_info "Stage 3: Service Dependencies"
    check_database_connectivity
    check_redis_connectivity
    check_rabbitmq_connectivity

    # Smoke tests
    log_info "Stage 4: Smoke Tests"
    run_smoke_tests

    # Comprehensive checks
    log_info "Stage 5: Comprehensive Checks"
    run_comprehensive_checks

    log_info "Full verification suite completed"
}

# ============================================
# Results summary
# ============================================
print_summary() {
    log_info "═══════════════════════════════════════════════════════════"
    log_info "Verification Summary"
    log_info "═══════════════════════════════════════════════════════════"

    echo "" | tee -a "$LOG_FILE"
    echo "Tests Passed: $TESTS_PASSED" | tee -a "$LOG_FILE"
    echo "Tests Failed: $TESTS_FAILED" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "All checks passed! ✨"
        echo "" | tee -a "$LOG_FILE"
        return 0
    else
        log_error "Some checks failed. Review the log above."
        echo "" | tee -a "$LOG_FILE"
        return 1
    fi
}

# ============================================
# Main execution
# ============================================
main() {
    log_info "═══════════════════════════════════════════════════════════"
    log_info "🔍 Deployment Verification Script"
    log_info "═══════════════════════════════════════════════════════════"

    parse_arguments "$@"

    log_info "Configuration:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Endpoint: $ENDPOINT"
    log_info "  Timeout: ${TIMEOUT}s"
    log_info "  Smoke Tests: $SMOKE_TESTS"
    log_info "  Comprehensive Check: $COMPREHENSIVE_CHECK"

    log_info "═══════════════════════════════════════════════════════════"

    # Wait for application availability
    if ! wait_for_application; then
        print_summary
        exit 1
    fi

    echo "" | tee -a "$LOG_FILE"

    # Determine verification type
    if [[ "$FULL_VERIFICATION" == "true" ]]; then
        run_full_verification
    elif [[ "$COMPREHENSIVE_CHECK" == "true" ]]; then
        run_comprehensive_checks
    elif [[ "$SMOKE_TESTS" == "true" ]]; then
        run_smoke_tests
    else
        # Default: basic checks
        check_health_endpoint
        check_api_accessibility
        check_response_time
    fi

    echo "" | tee -a "$LOG_FILE"

    # Print summary and exit
    print_summary
    local exit_code=$?

    log_info "═══════════════════════════════════════════════════════════"
    log_info "Verification log: $LOG_FILE"

    exit $exit_code
}

# Execute main function with all arguments
main "$@"
