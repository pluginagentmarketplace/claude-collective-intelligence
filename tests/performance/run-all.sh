#!/bin/bash

# K6 Performance Test Suite Runner
# Runs all performance tests and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TEST_ENV="${TEST_ENV:-development}"
VERBOSE="${VERBOSE:-false}"
REPORTS_DIR="reports"
BENCHMARKS_DIR="benchmarks"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          K6 Performance Testing Framework                     ║${NC}"
echo -e "${BLUE}║                    Production-Grade                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if K6 is installed
if ! command -v k6 &> /dev/null; then
  echo -e "${RED}✗ K6 is not installed${NC}"
  echo "  Install K6: https://k6.io/docs/getting-started/installation/"
  exit 1
fi

echo -e "${GREEN}✓ K6 found$(k6 version | grep -oP 'k6/\K[^ ]*')${NC}"

# Create directories
mkdir -p "$REPORTS_DIR" "$BENCHMARKS_DIR"

# Function to run test and capture results
run_test() {
  local test_name=$1
  local test_file=$2
  local duration=$3

  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Test: $test_name${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  if [ ! -f "$test_file" ]; then
    echo -e "${RED}✗ Test file not found: $test_file${NC}"
    return 1
  fi

  local result_file="$REPORTS_DIR/${test_name}_${TIMESTAMP}.json"
  local log_file="$REPORTS_DIR/${test_name}_${TIMESTAMP}.log"

  echo "⏱️  Duration: $duration"
  echo "📝 Results: $result_file"
  echo ""

  # Run K6 test
  if [ "$VERBOSE" = "true" ]; then
    k6 run \
      --out json="$result_file" \
      -e API_BASE_URL="$API_BASE_URL" \
      -e TEST_ENV="$TEST_ENV" \
      -e VERBOSE="$VERBOSE" \
      "$test_file" 2>&1 | tee "$log_file"
  else
    k6 run \
      --out json="$result_file" \
      -e API_BASE_URL="$API_BASE_URL" \
      -e TEST_ENV="$TEST_ENV" \
      -e VERBOSE="$VERBOSE" \
      "$test_file" > "$log_file" 2>&1
  fi

  local exit_code=$?

  if [ $exit_code -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ $test_name completed successfully${NC}"
    echo "  Results: $result_file"
    return 0
  else
    echo ""
    echo -e "${RED}✗ $test_name failed (exit code: $exit_code)${NC}"
    echo "  Log: $log_file"
    return 1
  fi
}

# Show test plan
echo -e "${YELLOW}📋 Test Plan:${NC}"
echo ""
echo "1. Load Test (15 min)"
echo "   └─ Gradual ramp: 10 → 100 → 1000 req/sec"
echo ""
echo "2. Spike Test (10 min)"
echo "   └─ Normal + 5x spike + recovery"
echo ""
echo "3. Soak Test (30 min)"
echo "   └─ Sustained 50-100 req/sec"
echo ""
echo "⚠️  Total runtime: ~55 minutes"
echo ""

# Check if tests should run
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted"
  exit 0
fi

echo ""
echo -e "${YELLOW}🚀 Starting tests...${NC}"
echo ""

# Run all tests
FAILED_TESTS=()
PASSED_TESTS=()

# Test 1: Load Test
if run_test "load-test" "k6-scripts/load-test.js" "15 minutes"; then
  PASSED_TESTS+=("Load Test")
else
  FAILED_TESTS+=("Load Test")
fi

# Test 2: Spike Test
if run_test "spike-test" "k6-scripts/spike-test.js" "10 minutes"; then
  PASSED_TESTS+=("Spike Test")
else
  FAILED_TESTS+=("Spike Test")
fi

# Test 3: Soak Test
if run_test "soak-test" "k6-scripts/soak-test.js" "30 minutes"; then
  PASSED_TESTS+=("Soak Test")
else
  FAILED_TESTS+=("Soak Test")
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                       TEST SUMMARY                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ ${#PASSED_TESTS[@]} -gt 0 ]; then
  echo -e "${GREEN}✓ Passed (${#PASSED_TESTS[@]}):${NC}"
  for test in "${PASSED_TESTS[@]}"; do
    echo "  ✓ $test"
  done
  echo ""
fi

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo -e "${RED}✗ Failed (${#FAILED_TESTS[@]}):${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo "  ✗ $test"
  done
  echo ""
fi

echo "📊 Report Directory: $(pwd)/$REPORTS_DIR"
echo ""

# Generate summary
echo -e "${YELLOW}📈 Generating analysis...${NC}"
echo ""

# List result files
if ls "$REPORTS_DIR"/*.json 1> /dev/null 2>&1; then
  echo "Available results:"
  ls -lh "$REPORTS_DIR"/*.json | awk '{print "  " $9 " (" $5 ")"}'
else
  echo "No result files generated"
fi

echo ""

# Instructions for comparison
if ls "$REPORTS_DIR"/*_${TIMESTAMP}.json 1> /dev/null 2>&1; then
  echo -e "${YELLOW}📊 To compare with baseline:${NC}"
  echo ""
  echo "  # Compare first result:"
  result_file=$(ls "$REPORTS_DIR"/*_${TIMESTAMP}.json | head -1)
  echo "  node benchmarks/compare.js \"$result_file\""
  echo ""
  echo "  # View HTML report:"
  echo "  open reports/performance-comparison.html"
  echo ""
fi

# Final status
echo ""
if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ All tests completed successfully!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Check logs for details.${NC}"
  exit 1
fi
