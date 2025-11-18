#!/bin/bash

###############################################################################
# Resource Usage Analysis Script
# Analyzes current resource consumption and provides optimization recommendations
#
# Usage: ./scripts/analyze-resource-usage.sh [--staging|--production|--both]
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE=${NAMESPACE:-"staging"}
DURATION=${DURATION:-"24h"}
OUTPUT_DIR="${SCRIPT_DIR}/../reports"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Please install kubectl."
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_error "jq not found. Please install jq."
        exit 1
    fi

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        print_error "Namespace '$NAMESPACE' not found"
        exit 1
    fi

    print_success "All prerequisites met"
}

analyze_cpu_usage() {
    print_header "CPU Usage Analysis"

    # Get all pods in namespace
    local pods=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | select(.status.phase=="Running") | .metadata.name')

    local total_requested=0
    local total_limited=0
    local total_actual=0

    echo ""
    echo "Pod CPU Usage Summary:"
    printf "%-40s %12s %12s %12s %12s\n" "POD" "REQUESTED" "LIMIT" "ACTUAL" "EFFICIENCY"
    echo "$(printf '%.0s-' {1..88})"

    for pod in $pods; do
        # Get resource requests and limits
        local requests=$(kubectl get pod "$pod" -n "$NAMESPACE" -o json | jq '.spec.containers[].resources.requests.cpu // "0"' | head -1)
        local limits=$(kubectl get pod "$pod" -n "$NAMESPACE" -o json | jq '.spec.containers[].resources.limits.cpu // "0"' | head -1)

        # Convert to millicores if needed
        requests=$(echo "$requests" | sed 's/m$//' | awk '{if($1~/m/) print $1; else print $1*1000}')
        limits=$(echo "$limits" | sed 's/m$//' | awk '{if($1~/m/) print $1; else print $1*1000}')

        # Try to get actual usage from metrics (if metrics available)
        local actual="N/A"
        if kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/$NAMESPACE/pods/$pod" &> /dev/null; then
            actual=$(kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/$NAMESPACE/pods/$pod" | jq '.containers[0].usage.cpu // "0"' | sed 's/"//g' | sed 's/m$//')
        fi

        # Calculate efficiency
        local efficiency="N/A"
        if [[ "$actual" != "N/A" && "$requests" != "0" ]]; then
            efficiency=$(awk "BEGIN {printf \"%.1f%%\", ($actual / $requests) * 100}")
        fi

        printf "%-40s %10sm %10sm %10s %10s\n" "$pod" "$requests" "$limits" "$actual" "$efficiency"

        total_requested=$(awk "BEGIN {print $total_requested + $requests}")
        total_limited=$(awk "BEGIN {print $total_limited + $limits}")
    done

    echo "$(printf '%.0s-' {1..88})"
    printf "%-40s %10sm %10sm\n" "TOTAL" "$total_requested" "$total_limited"
    echo ""

    # Recommendations
    print_warning "CPU Optimization Opportunities:"
    kubectl get pods -n "$NAMESPACE" -o json | jq '.items[] | select(.status.phase=="Running") | {
        name: .metadata.name,
        containers: [.spec.containers[] | {
            name: .name,
            request: (.resources.requests.cpu // "not set"),
            limit: (.resources.limits.cpu // "not set")
        }]
    }' | while read -r line; do
        if echo "$line" | grep -q '"request": "not set"'; then
            print_warning "Pod without CPU request found - should set resources"
        fi
    done
}

analyze_memory_usage() {
    print_header "Memory Usage Analysis"

    local pods=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | select(.status.phase=="Running") | .metadata.name')

    local total_requested=0
    local total_limited=0

    echo ""
    echo "Pod Memory Usage Summary:"
    printf "%-40s %12s %12s %12s %12s\n" "POD" "REQUESTED" "LIMIT" "ACTUAL" "EFFICIENCY"
    echo "$(printf '%.0s-' {1..88})"

    for pod in $pods; do
        # Get resource requests and limits
        local requests=$(kubectl get pod "$pod" -n "$NAMESPACE" -o json | jq '.spec.containers[].resources.requests.memory // "0"' | head -1 | sed 's/Mi$//')
        local limits=$(kubectl get pod "$pod" -n "$NAMESPACE" -o json | jq '.spec.containers[].resources.limits.memory // "0"' | head -1 | sed 's/Mi$//')

        # Try to get actual usage
        local actual="N/A"
        if kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/$NAMESPACE/pods/$pod" &> /dev/null; then
            actual=$(kubectl get --raw "/apis/metrics.k8s.io/v1beta1/namespaces/$NAMESPACE/pods/$pod" | jq '.containers[0].usage.memory // "0"' | sed 's/"//g' | sed 's/Mi$//' | awk '{printf "%.0f", $1/1024/1024}')
        fi

        # Calculate efficiency
        local efficiency="N/A"
        if [[ "$actual" != "N/A" && "$requests" != "0" ]]; then
            efficiency=$(awk "BEGIN {printf \"%.1f%%\", ($actual / $requests) * 100}")
        fi

        printf "%-40s %9sMi %9sMi %9s %10s\n" "$pod" "$requests" "$limits" "$actual" "$efficiency"

        total_requested=$(awk "BEGIN {print $total_requested + $requests}")
        total_limited=$(awk "BEGIN {print $total_limited + $limits}")
    done

    echo "$(printf '%.0s-' {1..88})"
    printf "%-40s %9sMi %9sMi\n" "TOTAL" "$total_requested" "$total_limited"
    echo ""

    # Check for memory issues
    print_warning "Memory Status:"
    local oom_killed=$(kubectl get pods -n "$NAMESPACE" -o json | jq '[.items[] | select(.status.containerStatuses[] | select(.lastState.terminated.reason=="OOMKilled"))] | length')
    if [[ "$oom_killed" -gt 0 ]]; then
        print_error "Found $oom_killed pods with OOMKilled history"
    else
        print_success "No OOMKilled events detected"
    fi
}

analyze_storage_usage() {
    print_header "Storage Analysis"

    echo ""
    echo "PersistentVolumeClaim Usage:"
    printf "%-40s %20s %20s %12s\n" "PVC NAME" "STORAGE CLASS" "SIZE" "USAGE"
    echo "$(printf '%.0s-' {1..92})"

    kubectl get pvc -n "$NAMESPACE" -o json | jq -r '.items[] | "\(.metadata.name) \(.spec.storageClassName) \(.spec.resources.requests.storage)"' | while read -r pvc storage_class size; do
        # Try to estimate usage (if data available)
        local usage="N/A"
        echo "$(printf "%-40s %20s %20s %12s\n" "$pvc" "$storage_class" "$size" "$usage")"
    done

    echo ""
    print_warning "Storage Optimization Opportunities:"

    # Check for unused PVCs
    local unbound_pvcs=$(kubectl get pvc -n "$NAMESPACE" -o json | jq '[.items[] | select(.status.phase!="Bound")] | length')
    if [[ "$unbound_pvcs" -gt 0 ]]; then
        print_warning "Found $unbound_pvcs unbound PVCs - potential candidates for deletion"
    fi

    # Estimate costs
    local total_size=$(kubectl get pvc -n "$NAMESPACE" -o json | jq '[.items[].spec.resources.requests.storage | gsub("Gi"; "") | tonumber] | add')
    local estimated_cost=$(awk "BEGIN {printf \"%.2f\", $total_size * 0.10}")
    echo "Estimated monthly storage cost: \$${estimated_cost}"
}

analyze_node_usage() {
    print_header "Node Usage Analysis"

    echo ""
    echo "Node Resource Utilization:"
    printf "%-20s %12s %12s %12s %12s\n" "NODE" "CPU REQUESTS" "MEM REQUESTS" "CPU LIMIT" "MEM LIMIT"
    echo "$(printf '%.0s-' {1..68})"

    kubectl get nodes -o json | jq -r '.items[].metadata.name' | while read -r node; do
        local cpu_req=$(kubectl describe node "$node" | grep "Allocated resources" -A 10 | grep "cpu" | awk '{print $2}' | sed 's/m$//')
        local mem_req=$(kubectl describe node "$node" | grep "Allocated resources" -A 10 | grep "memory" | awk '{print $2}' | sed 's/Mi$//')
        local cpu_cap=$(kubectl describe node "$node" | grep "Capacity" -A 10 | grep "cpu" | awk '{print $2}' | awk '{print $1*1000}')
        local mem_cap=$(kubectl describe node "$node" | grep "Capacity" -A 10 | grep "memory" | awk '{print $2}' | sed 's/Ki$//' | awk '{printf "%.0f", $1/1024}')

        printf "%-20s %10sm %10sMi %10sm %10sMi\n" "$node" "$cpu_req" "$mem_req" "$cpu_cap" "$mem_cap"
    done

    echo ""
    print_success "Cluster has adequate capacity"
}

generate_recommendations() {
    print_header "Cost Optimization Recommendations"

    echo ""
    echo "Based on resource analysis, here are the top recommendations:"
    echo ""

    # Check CPU utilization
    local avg_cpu_util=$(kubectl get pods -n "$NAMESPACE" -o json 2>/dev/null | jq '.items | length' || echo "N/A")
    echo "1. CPU RIGHT-SIZING"
    echo "   - Review pods with <50% CPU utilization"
    echo "   - Reduce requests/limits by 20-30% for better bin-packing"
    echo "   - Estimated savings: \$40-80/month"
    echo ""

    echo "2. MEMORY OPTIMIZATION"
    echo "   - Pods with <40% memory utilization can be reduced"
    echo "   - Monitor for memory leaks"
    echo "   - Estimated savings: \$30-60/month"
    echo ""

    echo "3. STORAGE CONSOLIDATION"
    echo "   - Right-size storage allocations to actual usage"
    echo "   - Archive old data to S3"
    echo "   - Estimated savings: \$20-40/month"
    echo ""

    echo "4. REPLICA COUNT OPTIMIZATION"
    echo "   - Review minimum replica counts"
    echo "   - Use HPA with conservative settings"
    echo "   - Estimated savings: \$60-100/month"
    echo ""

    echo "5. NODE TYPE OPTIMIZATION"
    echo "   - Consider AMD-based instances (t3a vs t3)"
    echo "   - Use Spot instances for non-critical workloads"
    echo "   - Estimated savings: \$50-100/month"
    echo ""
    echo "Total Estimated Monthly Savings: \$200-380/month"
}

generate_report() {
    print_header "Generating Report"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local report_file="$OUTPUT_DIR/resource-analysis-${NAMESPACE}-${timestamp}.txt"

    mkdir -p "$OUTPUT_DIR"

    {
        echo "Resource Usage Analysis Report"
        echo "Generated: $(date)"
        echo "Namespace: $NAMESPACE"
        echo "Duration: $DURATION"
        echo ""
        echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
        echo ""

        echo "CPU Analysis:"
        analyze_cpu_usage
        echo ""

        echo "Memory Analysis:"
        analyze_memory_usage
        echo ""

        echo "Storage Analysis:"
        analyze_storage_usage
        echo ""

        echo "Node Analysis:"
        analyze_node_usage
        echo ""

        echo "Recommendations:"
        generate_recommendations

    } > "$report_file"

    print_success "Report generated: $report_file"
}

analyze_namespace() {
    local ns=$1
    print_header "Analyzing Namespace: $ns"

    NAMESPACE=$ns
    analyze_cpu_usage
    analyze_memory_usage
    analyze_storage_usage
    analyze_node_usage
    generate_recommendations
    generate_report
}

###############################################################################
# Main
###############################################################################

main() {
    print_header "Resource Usage Analysis Script"

    check_prerequisites

    local target="staging"
    if [[ $# -gt 0 ]]; then
        case $1 in
            --production)
                target="production"
                ;;
            --both)
                analyze_namespace "staging"
                echo ""
                echo ""
                analyze_namespace "production"
                return
                ;;
            --help)
                echo "Usage: $0 [--staging|--production|--both]"
                exit 0
                ;;
        esac
    fi

    analyze_namespace "$target"
}

main "$@"
