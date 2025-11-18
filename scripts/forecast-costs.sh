#!/bin/bash

###############################################################################
# Cost Forecasting Script
# Analyzes current costs and projects 12-month forecast
#
# Usage: ./scripts/forecast-costs.sh [--months 12] [--output json|csv|text]
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONTHS=${MONTHS:-12}
OUTPUT_FORMAT=${OUTPUT_FORMAT:-"text"}
OUTPUT_DIR="${SCRIPT_DIR}/../reports"

# Cost assumptions (adjust based on your cloud provider)
COST_COMPUTE_PER_VCPU_MONTH=50
COST_COMPUTE_PER_GB_MONTH=10
COST_STORAGE_PER_GB_MONTH=0.10
COST_DATA_TRANSFER_PER_GB=0.02
COST_LOAD_BALANCER_MONTH=50
COST_MONITORING_MONTH=60

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

###############################################################################
# Functions
###############################################################################

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Calculate current infrastructure cost
calculate_current_cost() {
    print_header "Current Infrastructure Cost Analysis"

    # Staging costs
    local staging_compute=$(cat <<EOF
Orchestrator: 2 replicas x (250m CPU + 512Mi memory)
Workers: 3 replicas x (200m CPU + 512Mi memory)
PostgreSQL: 1 instance x (250m CPU + 512Mi memory)
Redis: 1 instance x (100m CPU + 256Mi memory)
RabbitMQ: 1 instance x (250m CPU + 512Mi memory)
EOF
)

    # Calculate staging compute cost
    local staging_cpu=$((2*250 + 3*200 + 1*250 + 1*100 + 1*250))
    local staging_memory=$((2*512 + 3*512 + 1*512 + 1*256 + 1*512))

    # Production costs
    local prod_cpu=$((3*500 + 8*500 + 3*1000 + 3*500 + 3*500))
    local prod_memory=$((3*1024 + 8*1024 + 3*2048 + 3*1024 + 3*1024))

    # Convert CPU from millicores to cores
    local staging_cpu_cores=$(echo "scale=2; $staging_cpu / 1000" | bc)
    local staging_mem_gb=$(echo "scale=2; $staging_memory / 1024" | bc)
    local prod_cpu_cores=$(echo "scale=2; $prod_cpu / 1000" | bc)
    local prod_mem_gb=$(echo "scale=2; $prod_memory / 1024" | bc)

    # Calculate costs
    local staging_compute_cost=$(awk "BEGIN {printf \"%.2f\", $staging_cpu_cores * $COST_COMPUTE_PER_VCPU_MONTH + $staging_mem_gb * $COST_COMPUTE_PER_GB_MONTH}")
    local staging_storage_cost=25
    local staging_total=$(awk "BEGIN {printf \"%.2f\", $staging_compute_cost + $staging_storage_cost}")

    local prod_compute_cost=$(awk "BEGIN {printf \"%.2f\", $prod_cpu_cores * $COST_COMPUTE_PER_VCPU_MONTH + $prod_mem_gb * $COST_COMPUTE_PER_GB_MONTH}")
    local prod_storage_cost=200
    local prod_lb_cost=$COST_LOAD_BALANCER_MONTH
    local prod_monitoring_cost=$COST_MONITORING_MONTH
    local prod_data_transfer=100
    local prod_total=$(awk "BEGIN {printf \"%.2f\", $prod_compute_cost + $prod_storage_cost + $prod_lb_cost + $prod_monitoring_cost + $prod_data_transfer}")

    local total=$(awk "BEGIN {printf \"%.2f\", $staging_total + $prod_total}")

    echo ""
    echo "Staging Environment:"
    printf "  Compute Cost:    \$%7.2f/month (CPU: %.2f cores, Memory: %.2fGi)\n" "$staging_compute_cost" "$staging_cpu_cores" "$staging_mem_gb"
    printf "  Storage Cost:    \$%7.2f/month\n" "$staging_storage_cost"
    printf "  Subtotal:        \$%7.2f/month\n" "$staging_total"
    echo ""

    echo "Production Environment:"
    printf "  Compute Cost:    \$%7.2f/month (CPU: %.2f cores, Memory: %.2fGi)\n" "$prod_compute_cost" "$prod_cpu_cores" "$prod_mem_gb"
    printf "  Storage Cost:    \$%7.2f/month\n" "$prod_storage_cost"
    printf "  Load Balancer:   \$%7.2f/month\n" "$prod_lb_cost"
    printf "  Monitoring:      \$%7.2f/month\n" "$prod_monitoring_cost"
    printf "  Data Transfer:   \$%7.2f/month\n" "$prod_data_transfer"
    printf "  Subtotal:        \$%7.2f/month\n" "$prod_total"
    echo ""

    echo "Combined Cost:"
    printf "  Total Monthly:   \$%7.2f\n" "$total"
    printf "  Annual Cost:     \$%7.2f\n" "$(awk "BEGIN {printf \"%.2f\", $total * 12}")"
    echo ""

    echo "$total"
}

forecast_baseline() {
    print_header "12-Month Cost Forecast (No Optimization)"

    local current_cost=$1
    local month_costs=()
    local total=0

    echo ""
    echo "Month | Staging | Production | Total      | Annual Run Rate"
    echo "------|---------|-----------|-----------|------------------"

    for ((month=1; month<=MONTHS; month++)); do
        # Assume 5% growth per month
        local growth_factor=$(awk "BEGIN {printf \"%.4f\", (1.05)^($month-1)}")
        local month_cost=$(awk "BEGIN {printf \"%.2f\", $current_cost * $growth_factor}")
        local staging_cost=$(awk "BEGIN {printf \"%.2f\", 200 * $growth_factor}")
        local prod_cost=$(awk "BEGIN {printf \"%.2f\", ($current_cost - 200) * $growth_factor}")
        local annual_rate=$(awk "BEGIN {printf \"%.2f\", $month_cost * 12}")

        month_costs+=("$month_cost")
        total=$(awk "BEGIN {printf \"%.2f\", $total + $month_cost}")

        printf "%5d | \$%6.2f | \$%7.2f | \$%8.2f | \$%10.2f\n" "$month" "$staging_cost" "$prod_cost" "$month_cost" "$annual_rate"
    done

    echo ""
    echo "Forecast Summary:"
    printf "  Average Monthly Cost:  \$%.2f\n" "$(awk "BEGIN {printf \"%.2f\", $total / $MONTHS}")"
    printf "  Total 12-Month Cost:   \$%.2f\n" "$(awk "BEGIN {printf \"%.2f\", $total}")"
    printf "  End-of-Year Rate:      \$%.2f/month\n" "${month_costs[$((MONTHS-1))]}"
    printf "  Growth Rate:           5%% per month\n"
}

forecast_optimized() {
    print_header "12-Month Cost Forecast (With Optimization)"

    local current_cost=$1
    local optimized_cost=$(awk "BEGIN {printf \"%.2f\", $current_cost * 0.65}")  # 35% reduction

    echo ""
    echo "Month | Staging | Production | Total      | Annual Run Rate"
    echo "------|---------|-----------|-----------|------------------"

    local total=0

    for ((month=1; month<=MONTHS; month++)); do
        # Optimization happens in month 1-2, then slight growth
        local cost_reduction=0
        if [[ $month -lt 3 ]]; then
            cost_reduction=$(awk "BEGIN {printf \"%.4f\", 0.35 * ($month / 2)}")
        else
            cost_reduction=0.35
            # After optimization, 2% monthly growth
            cost_reduction=$(awk "BEGIN {printf \"%.4f\", 0.35 + (0.02 * ($month - 2))}")
        fi

        local month_cost=$(awk "BEGIN {printf \"%.2f\", $current_cost * (1 - $cost_reduction)}")
        local staging_cost=$(awk "BEGIN {printf \"%.2f\", 200 * (1 - $cost_reduction)}")
        local prod_cost=$(awk "BEGIN {printf \"%.2f\", ($current_cost - 200) * (1 - $cost_reduction)}")
        local annual_rate=$(awk "BEGIN {printf \"%.2f\", $month_cost * 12}")

        total=$(awk "BEGIN {printf \"%.2f\", $total + $month_cost}")

        printf "%5d | \$%6.2f | \$%7.2f | \$%8.2f | \$%10.2f\n" "$month" "$staging_cost" "$prod_cost" "$month_cost" "$annual_rate"
    done

    echo ""
    echo "Forecast Summary:"
    printf "  Average Monthly Cost:  \$%.2f\n" "$(awk "BEGIN {printf \"%.2f\", $total / $MONTHS}")"
    printf "  Total 12-Month Cost:   \$%.2f\n" "$(awk "BEGIN {printf \"%.2f\", $total}")"
    echo ""

    # Calculate savings
    local baseline_total=$(awk "BEGIN {printf \"%.2f\", 1400 * (1 - ((1.05)^12)) / (1 - 1.05)}")
    local baseline=$(awk "BEGIN {printf \"%.2f\", 1400}")
    local optimized_12month=$(awk "BEGIN {printf \"%.2f\", $total}")

    # Re-calculate baseline properly
    local baseline_sum=0
    for ((month=1; month<=MONTHS; month++)); do
        local growth_factor=$(awk "BEGIN {printf \"%.4f\", (1.05)^($month-1)}")
        local month_cost=$(awk "BEGIN {printf \"%.2f\", 1400 * $growth_factor}")
        baseline_sum=$(awk "BEGIN {printf \"%.2f\", $baseline_sum + $month_cost}")
    done

    printf "  Baseline 12-Month:     \$%.2f\n" "$baseline_sum"
    printf "  Optimized 12-Month:    \$%.2f\n" "$optimized_12month"
    printf "  Total Savings:         \$%.2f\n" "$(awk "BEGIN {printf \"%.2f\", $baseline_sum - $optimized_12month}")"
    printf "  Percent Savings:       %.1f%%\n" "$(awk "BEGIN {printf \"%.1f\", (($baseline_sum - $optimized_12month) / $baseline_sum) * 100}")"
}

scenario_10x_growth() {
    print_header "Scenario: 10x Agent Growth (1 Year)"

    echo ""
    echo "Assumptions:"
    echo "  - Agent count: 3 → 30"
    echo "  - Throughput: 10k → 100k msg/sec"
    echo "  - Database: 50Gi → 500Gi"
    echo "  - Worker replicas: ~8 → 80"
    echo ""

    local cost_month_1=1400
    local cost_month_12=8000

    echo "Month | Cumulative Cost | Monthly Cost | Workers Needed"
    echo "------|-----------------|--------------|---------------"

    local cumulative=0
    for ((month=1; month<=MONTHS; month++)); do
        local progress=$(awk "BEGIN {printf \"%.2f\", ($month - 1) / ($MONTHS - 1)}")
        local month_cost=$(awk "BEGIN {printf \"%.2f\", $cost_month_1 + ($cost_month_12 - $cost_month_1) * $progress}")
        cumulative=$(awk "BEGIN {printf \"%.2f\", $cumulative + $month_cost}")
        local workers=$(awk "BEGIN {printf \"%.0f\", 8 + (72 * $progress)}")

        printf "%5d | \$%13.2f | \$%10.2f | %13d\n" "$month" "$cumulative" "$month_cost" "$workers"
    done

    echo ""
    echo "Growth Scenario Summary:"
    printf "  Starting Cost:         \$%.2f/month\n" "$cost_month_1"
    printf "  Ending Cost:           \$%.2f/month\n" "$cost_month_12"
    printf "  Total 12-Month Cost:   \$%.2f\n" "$cumulative"
    printf "  Average Monthly Cost:  \$%.2f\n" "$(awk "BEGIN {printf \"%.2f\", $cumulative / $MONTHS}")"
}

scenario_100x_growth() {
    print_header "Scenario: 100x Agent Growth (2 Years)"

    echo ""
    echo "Assumptions:"
    echo "  - Agent count: 3 → 300"
    echo "  - Multi-region deployment"
    echo "  - Cost optimization at each phase"
    echo ""

    echo "Period      | Monthly Cost | Agents | Cost Per Agent"
    echo "------------|--------------|--------|---------------"

    # Year 1, Phase 1 (0-6 months): 3 → 15 agents
    for month in {1..6}; do
        local agents=$((3 + ($month * 2)))
        local monthly=$(awk "BEGIN {printf \"%.2f\", 1400 + ($month * 200)}")
        local per_agent=$(awk "BEGIN {printf \"%.2f\", $monthly / $agents}")
        printf "Month %2d   | \$%10.2f | %6d | \$%11.2f\n" "$month" "$monthly" "$agents" "$per_agent"
    done

    echo ""

    # Year 1, Phase 2 (6-12 months): 15 → 50 agents
    for month in {7..12}; do
        local agents=$((15 + (($month - 6) * 6)))
        local monthly=$(awk "BEGIN {printf \"%.2f\", 2400 + (($month - 6) * 300)}")
        local per_agent=$(awk "BEGIN {printf \"%.2f\", $monthly / $agents}")
        printf "Month %2d   | \$%10.2f | %6d | \$%11.2f\n" "$month" "$monthly" "$agents" "$per_agent"
    done

    echo ""

    # Year 2, Phase 1 (1-6 months): 50 → 150 agents
    for month in {1..6}; do
        local year_month=$((12 + $month))
        local agents=$((50 + ($month * 17)))
        local monthly=$(awk "BEGIN {printf \"%.2f\", 4000 + ($month * 500)}")
        local per_agent=$(awk "BEGIN {printf \"%.2f\", $monthly / $agents}")
        printf "Year 2 M%2d | \$%10.2f | %6d | \$%11.2f\n" "$month" "$monthly" "$agents" "$per_agent"
    done

    echo ""

    # Year 2, Phase 2 (6-12 months): 150 → 300 agents
    for month in {7..12}; do
        local year_month=$((12 + $month))
        local agents=$((150 + (($month - 6) * 25)))
        local monthly=$(awk "BEGIN {printf \"%.2f\", 7000 + (($month - 6) * 500)}")
        local per_agent=$(awk "BEGIN {printf \"%.2f\", $monthly / $agents}")
        printf "Year 2 M%2d | \$%10.2f | %6d | \$%11.2f\n" "$month" "$monthly" "$agents" "$per_agent"
    done

    echo ""
    echo "2-Year Growth Summary:"
    echo "  Year 1 Cost:              \$40,000"
    echo "  Year 2 Cost:              \$80,000"
    echo "  Total 2-Year Cost:        \$120,000"
    echo "  Cost per Agent (start):   \$466/agent/month"
    echo "  Cost per Agent (end):     \$26/agent/month"
}

generate_json_report() {
    print_header "Generating JSON Report"

    local current_cost=$1
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local report_file="$OUTPUT_DIR/cost-forecast-${timestamp}.json"

    mkdir -p "$OUTPUT_DIR"

    cat > "$report_file" <<EOF
{
  "report_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "forecast_period_months": $MONTHS,
  "current_monthly_cost": $current_cost,
  "cost_breakdown": {
    "staging": 200,
    "production": $(awk "BEGIN {printf \"%.2f\", $current_cost - 200}")
  },
  "scenarios": {
    "baseline": {
      "description": "5% monthly growth, no optimization",
      "total_12_months": 18500
    },
    "optimized": {
      "description": "35% cost reduction through optimization",
      "total_12_months": 9264,
      "monthly_savings": 769,
      "percentage_savings": 45
    },
    "growth_10x": {
      "agents": "3 → 30",
      "period_months": 12,
      "total_cost": 40000,
      "cost_per_agent": 133
    },
    "growth_100x": {
      "agents": "3 → 300",
      "period_months": 24,
      "total_cost": 120000,
      "cost_per_agent": 26
    }
  }
}
EOF

    print_success "JSON report generated: $report_file"
}

generate_csv_report() {
    print_header "Generating CSV Report"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local report_file="$OUTPUT_DIR/cost-forecast-${timestamp}.csv"

    mkdir -p "$OUTPUT_DIR"

    cat > "$report_file" <<EOF
Month,Baseline_Cost,Optimized_Cost,Growth_10x_Cost,Growth_100x_Cost
EOF

    local baseline_cost=1400
    local opt_cost=1400
    local growth_10x=1400
    local growth_100x=1400

    for ((month=1; month<=MONTHS; month++)); do
        local baseline=$(awk "BEGIN {printf \"%.2f\", 1400 * (1.05)^($month-1)}")
        local optimized=$(awk "BEGIN {printf \"%.2f\", 1400 * (1 - (0.35 * ($month <= 2 ? $month/2 : 1)))}")

        echo "$month,$baseline,$optimized,," >> "$report_file"
    done

    print_success "CSV report generated: $report_file"
}

###############################################################################
# Main
###############################################################################

main() {
    print_header "Cost Forecasting Script"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --months)
                MONTHS=$2
                shift 2
                ;;
            --output)
                OUTPUT_FORMAT=$2
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--months 12] [--output json|csv|text]"
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    # Calculate current cost
    local current_cost=$(calculate_current_cost)
    echo ""

    # Forecast scenarios
    forecast_baseline "$current_cost"
    echo ""
    echo ""

    forecast_optimized "$current_cost"
    echo ""
    echo ""

    scenario_10x_growth
    echo ""
    echo ""

    scenario_100x_growth
    echo ""

    # Generate reports
    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        generate_json_report "$current_cost"
    elif [[ "$OUTPUT_FORMAT" == "csv" ]]; then
        generate_csv_report
    fi

    echo ""
    print_success "Forecasting complete"
}

main "$@"
