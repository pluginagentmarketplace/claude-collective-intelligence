#!/bin/bash

#
# Benchmark Performance Script
# Comprehensive performance benchmarking for the entire system
#
# Usage: ./scripts/benchmark-performance.sh [--quick|--full|--soak]
#

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_MODE="${1:-full}"  # quick, full, or soak
OUTPUT_DIR="${OUTPUT_DIR:-./performance-reports}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Test parameters by mode
case "$TEST_MODE" in
    quick)
        DURATION=60
        USERS=10
        RAMP_UP=30
        ;;
    full)
        DURATION=300
        USERS=50
        RAMP_UP=60
        ;;
    soak)
        DURATION=1800
        USERS=25
        RAMP_UP=120
        ;;
    *)
        echo "Usage: $0 [--quick|--full|--soak]"
        exit 1
        ;;
esac

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Performance Benchmark Tool${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "Test Configuration:"
echo "  Mode: $TEST_MODE"
echo "  Base URL: $BASE_URL"
echo "  Test Duration: ${DURATION}s"
echo "  Virtual Users: $USERS"
echo "  Ramp-up: ${RAMP_UP}s"
echo "  Output Directory: $OUTPUT_DIR"
echo ""

# Function to check tool availability
check_tool() {
    local tool="$1"
    local install_cmd="$2"

    if ! command -v "$tool" &> /dev/null; then
        echo -e "${YELLOW}⚠ $tool not found${NC}"
        echo "  Install with: $install_cmd"
        return 1
    fi
    return 0
}

# Check required tools
echo -e "${YELLOW}Checking required tools...${NC}"

TOOLS_AVAILABLE=true

if ! check_tool "k6" "npm install -g k6"; then
    TOOLS_AVAILABLE=false
fi

if ! check_tool "ab" "apt-get install apache2-utils"; then
    TOOLS_AVAILABLE=false
fi

if ! check_tool "wrk" "apt-get install wrk"; then
    TOOLS_AVAILABLE=false
fi

if [[ "$TOOLS_AVAILABLE" == false ]]; then
    echo -e "${YELLOW}Some tools missing. Attempting with available tools...${NC}"
fi

echo ""

# ============================================================
# SIMPLE CONNECTIVITY TEST
# ============================================================

echo -e "${YELLOW}=== CONNECTIVITY TEST ===${NC}"
echo ""

if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}✗ Cannot connect to $BASE_URL${NC}"
    echo "  Make sure the application is running"
    exit 1
fi

echo -e "${GREEN}✓ Connected to $BASE_URL${NC}"
echo ""

# ============================================================
# ENDPOINT PERFORMANCE TEST
# ============================================================

echo -e "${YELLOW}=== ENDPOINT PERFORMANCE TEST ===${NC}"
echo ""

test_endpoint() {
    local name="$1"
    local url="$2"
    local requests=1000
    local concurrency=100

    echo -e "${CYAN}Testing: $name${NC}"
    echo "  URL: $url"
    echo ""

    if command -v ab &> /dev/null; then
        ab -n "$requests" -c "$concurrency" -g "${OUTPUT_DIR}/endpoint_${name}_results.tsv" "$url" 2>/dev/null || true
    elif command -v wrk &> /dev/null; then
        wrk -t12 -c100 -d10s "$url" 2>/dev/null | head -20 || true
    else
        # Fallback: use curl in a loop
        echo "  Using curl for testing..."
        local times=()
        for ((i=1; i<=100; i++)); do
            local start=$(date +%s%N)
            curl -s -o /dev/null "$url" 2>/dev/null
            local end=$(date +%s%N)
            local duration=$(((end - start) / 1000000))
            times+=($duration)
        done

        # Calculate stats
        local sum=0
        for time in "${times[@]}"; do
            sum=$((sum + time))
        done
        local avg=$((sum / 100))
        echo "  Average Response Time: ${avg}ms"
    fi

    echo ""
}

# Test key endpoints
test_endpoint "get_agents" "$BASE_URL/api/agents?limit=20"
test_endpoint "get_tasks" "$BASE_URL/api/tasks?limit=20"
test_endpoint "get_leaderboard" "$BASE_URL/api/leaderboard"

echo ""

# ============================================================
# LOAD TEST WITH K6 (if available)
# ============================================================

if command -v k6 &> /dev/null; then
    echo -e "${YELLOW}=== LOAD TEST (K6) ===${NC}"
    echo ""

    # Create K6 test script
    K6_SCRIPT="${OUTPUT_DIR}/k6_benchmark_${TIMESTAMP}.js"

    cat > "$K6_SCRIPT" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const getAgentsTime = new Trend('get_agents_time');
const getTasksTime = new Trend('get_tasks_time');
const getLeaderboardTime = new Trend('get_leaderboard_time');

export const options = {
    stages: [
        { duration: '1m', target: 10 },   // Ramp up
        { duration: '3m', target: 50 },   // Stay at load
        { duration: '1m', target: 0 },    // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'errors': ['count<10'],
    },
};

export default function () {
    // Test GET /api/agents
    const agentRes = http.get(__ENV.BASE_URL + '/api/agents?limit=20');
    responseTime.add(agentRes.timings.duration);
    getAgentsTime.add(agentRes.timings.duration);
    errorRate.add(agentRes.status !== 200);
    check(agentRes, {
        'agents endpoint status ok': (r) => r.status === 200,
    });

    sleep(1);

    // Test GET /api/tasks
    const taskRes = http.get(__ENV.BASE_URL + '/api/tasks?limit=20');
    responseTime.add(taskRes.timings.duration);
    getTasksTime.add(taskRes.timings.duration);
    errorRate.add(taskRes.status !== 200);
    check(taskRes, {
        'tasks endpoint status ok': (r) => r.status === 200,
    });

    sleep(1);

    // Test GET /api/leaderboard
    const lbRes = http.get(__ENV.BASE_URL + '/api/leaderboard');
    responseTime.add(lbRes.timings.duration);
    getLeaderboardTime.add(lbRes.timings.duration);
    errorRate.add(lbRes.status !== 200);
    check(lbRes, {
        'leaderboard endpoint status ok': (r) => r.status === 200,
    });

    sleep(1);
}
EOF

    echo -e "${YELLOW}Running K6 load test...${NC}"
    k6 run \
        --vus "$USERS" \
        --duration "${DURATION}s" \
        -e "BASE_URL=$BASE_URL" \
        --out json="${OUTPUT_DIR}/k6_results_${TIMESTAMP}.json" \
        "$K6_SCRIPT" 2>&1 | tee "${OUTPUT_DIR}/k6_output_${TIMESTAMP}.log"

    echo -e "${GREEN}✓ K6 test complete${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠ K6 not available. Skipping load test.${NC}"
    echo ""
fi

# ============================================================
# REQUEST RATE TEST
# ============================================================

echo -e "${YELLOW}=== REQUEST RATE TEST ===${NC}"
echo ""

test_request_rate() {
    local name="$1"
    local url="$2"
    local duration="$3"

    echo -e "${CYAN}Testing: $name (${duration}s)${NC}"

    if command -v wrk &> /dev/null; then
        wrk -t8 -c50 -d"${duration}s" "$url" 2>&1 | grep -E "Requests/sec|Latency" || true
    else
        echo "  Performing sequential requests..."
        local total_requests=0
        local start_time=$(date +%s)

        while true; do
            curl -s -o /dev/null "$url" 2>/dev/null
            ((total_requests++))

            local current_time=$(date +%s)
            local elapsed=$((current_time - start_time))

            if [[ $elapsed -ge $duration ]]; then
                break
            fi
        done

        local rps=$((total_requests / duration))
        echo "  Requests/sec: $rps"
        echo "  Total Requests: $total_requests"
    fi

    echo ""
}

test_request_rate "Agents Endpoint" "$BASE_URL/api/agents?limit=10" 30
test_request_rate "Tasks Endpoint" "$BASE_URL/api/tasks?limit=10" 30

# ============================================================
# SYSTEM METRICS COLLECTION
# ============================================================

echo -e "${YELLOW}=== SYSTEM METRICS ===${NC}"
echo ""

METRICS_FILE="${OUTPUT_DIR}/system_metrics_${TIMESTAMP}.txt"

{
    echo "System Metrics (collected during benchmark)"
    echo "Timestamp: $(date)"
    echo "================================================"
    echo ""

    # CPU info
    echo "CPU Information:"
    if command -v nproc &> /dev/null; then
        echo "  CPU Cores: $(nproc)"
    fi
    if [[ -f /proc/cpuinfo ]]; then
        echo "  CPU Model: $(grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2)"
    fi
    echo ""

    # Memory info
    echo "Memory Information:"
    if command -v free &> /dev/null; then
        free -h
    fi
    echo ""

    # Disk info
    echo "Disk Information:"
    if command -v df &> /dev/null; then
        df -h | head -5
    fi
    echo ""

    # Process info
    echo "Node.js Process Info:"
    if command -v ps &> /dev/null; then
        ps aux | grep -E "node|npm" | grep -v grep || true
    fi

} > "$METRICS_FILE"

echo -e "${GREEN}✓ Metrics saved to: $METRICS_FILE${NC}"
echo ""

# ============================================================
# SUMMARY REPORT
# ============================================================

REPORT_FILE="${OUTPUT_DIR}/benchmark_report_${TIMESTAMP}.txt"

{
    echo "Performance Benchmark Report"
    echo "Generated: $(date)"
    echo "Base URL: $BASE_URL"
    echo "Test Mode: $TEST_MODE"
    echo "================================================"
    echo ""
    echo "Test Parameters:"
    echo "  Duration: ${DURATION}s"
    echo "  Virtual Users: $USERS"
    echo "  Ramp-up Time: ${RAMP_UP}s"
    echo ""
    echo "Files Generated:"
    ls -lh "$OUTPUT_DIR"/ 2>/dev/null | grep -E "${TIMESTAMP}" || echo "  (no files yet)"
    echo ""
    echo "Next Steps:"
    echo "  1. Review detailed results in output files"
    echo "  2. Identify performance bottlenecks"
    echo "  3. Apply optimization recommendations"
    echo "  4. Re-run benchmark to measure improvements"
    echo ""

} > "$REPORT_FILE"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Benchmark Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Report saved to: $REPORT_FILE"
echo ""
echo "Test Results Files:"
ls -lh "$OUTPUT_DIR"/ | tail -10
echo ""
echo "Interpreting Results:"
echo "  - Response time: Target <500ms p99, <250ms p95"
echo "  - Request rate: Target >100 requests/sec at normal load"
echo "  - Error rate: Target <0.1%"
echo "  - CPU usage: Target <70%"
echo "  - Memory usage: Target <80%"
echo ""
echo "Next steps:"
echo "  1. Run: ./scripts/analyze-slow-queries.sh"
echo "  2. Run: ./scripts/tune-cache.sh"
echo "  3. Review PERFORMANCE_TUNING_GUIDE.md for optimization"
echo ""

exit 0
