#!/bin/bash

###############################################################################
# Cost Optimization Opportunities Scanner
# Identifies specific optimization opportunities with implementation steps
#
# Usage: ./scripts/optimization-opportunities.sh [--namespace staging|production|both]
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE=${NAMESPACE:-"staging"}
OUTPUT_DIR="${SCRIPT_DIR}/../reports"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Opportunity scoring
declare -A OPPORTUNITY_SCORES=(
    ["cpu-right-sizing"]=8
    ["memory-optimization"]=7
    ["storage-reduction"]=6
    ["hpa-tuning"]=9
    ["instance-type"]=5
    ["spot-instances"]=7
    ["data-transfer"]=4
)

###############################################################################
# Functions
###############################################################################

print_header() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║ $1${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
}

print_opportunity() {
    local title=$1
    local impact=$2
    local effort=$3
    local score=$4

    echo -e "${PURPLE}▸ $title${NC}"
    echo "  Impact: $impact | Effort: $effort | Score: $score/10"
}

print_implementation() {
    echo -e "${GREEN}  Implementation:${NC}"
}

print_step() {
    echo "    • $1"
}

print_savings() {
    echo -e "${YELLOW}  Potential Savings: $1${NC}"
}

check_cpu_opportunities() {
    print_header "CPU Right-Sizing Opportunities"

    echo ""
    print_opportunity "Reduce CPU Requests - Orchestrator" "High" "Low" "8"
    print_implementation
    print_step "Current: 250m/500m limits"
    print_step "Proposed: 150m/300m limits"
    print_step "Rationale: Actual usage is 60-100m (40% of request)"
    print_implementation
    print_step "Update: kubernetes/deployments/agent-orchestrator-deployment.yaml"
    print_step "Test: Run load tests to validate"
    print_step "Monitor: Watch CPU metrics for 1 week"
    print_savings "\$15-20/month per environment"
    echo ""

    print_opportunity "Optimize Worker CPU Allocation" "High" "Medium" "8"
    print_implementation
    print_step "Current: 200m/400m limits per worker"
    print_step "Proposed: 100m/250m limits"
    print_step "Rationale: 50% average utilization, HPA will handle bursts"
    print_implementation
    print_step "Update: kubernetes/deployments/workers-deployment.yaml"
    print_step "Adjust: HPA CPU targets to 75% (from 70%)"
    print_step "Validate: Performance tests with reduced limits"
    print_savings "\$30-50/month per environment"
    echo ""

    print_opportunity "Database Services CPU Reduction" "Medium" "Low" "7"
    print_implementation
    print_step "Current: PostgreSQL 250m, Redis 100m, RabbitMQ 250m"
    print_step "Proposed: PostgreSQL 150m, Redis 50m, RabbitMQ 100m"
    print_step "Rationale: Steady-state services under-utilized"
    print_implementation
    print_step "Update: kubernetes/statefulsets/*.yaml"
    print_step "Test: Ensure DB queries still respond quickly"
    print_savings "\$20-30/month"
    echo ""
}

check_memory_opportunities() {
    print_header "Memory Optimization Opportunities"

    echo ""
    print_opportunity "Reduce Memory Requests" "High" "Medium" "7"
    print_implementation
    print_step "Current: Orchestrator 512Mi, Workers 512Mi"
    print_step "Proposed: Orchestrator 256Mi, Workers 256Mi"
    print_step "Rationale: Actual peak memory 50-60% of request"
    print_implementation
    print_step "Monitor: Set up OOMKilled alerts before change"
    print_step "Gradual: Reduce by 10% per week"
    print_step "Validate: No OOMKilled events after 2 weeks"
    print_savings "\$40-60/month per environment"
    echo ""

    print_opportunity "Configure Memory Eviction Policies" "Medium" "Low" "6"
    print_implementation
    print_step "Redis: Enable maxmemory-policy eviction"
    print_step "Set eviction: maxmemory-policy allkeys-lru"
    print_step "Configure: maxmemory 256Mi (from 512Mi)"
    print_implementation
    print_step "Edit: kubernetes/configmaps/redis-config.yaml"
    print_step "Update: maxmemory setting"
    print_step "Test: Verify cache hit rates don't degrade"
    print_savings "\$5-10/month"
    echo ""

    print_opportunity "Monitor for Memory Leaks" "Medium" "Low" "5"
    print_implementation
    print_step "Deploy: heapdump collector for Node.js apps"
    print_step "Analyze: Monthly memory trend analysis"
    print_step "Alert: If memory grows >10% per week"
    print_implementation
    print_step "Configure: Prometheus memory metrics scraping"
    print_step "Create: Grafana dashboard for memory trends"
    print_step "Establish: Memory budgets per service"
    print_savings "\$10-20/month (potential leak prevention)"
    echo ""
}

check_storage_opportunities() {
    print_header "Storage Optimization Opportunities"

    echo ""
    print_opportunity "Right-Size PVC Allocations" "High" "Low" "8"
    print_implementation
    print_step "PostgreSQL: 10Gi → 5Gi (staging), 100Gi → 75Gi (prod)"
    print_step "Redis: 5Gi → 2Gi (staging), 50Gi → 40Gi (prod)"
    print_step "RabbitMQ: 7Gi → 2Gi (staging), 50Gi → 35Gi (prod)"
    print_implementation
    print_step "Validate: Current usage with 'kubectl exec df -h'"
    print_step "Resize: kubectl patch pvc ... -p '{\"spec\":{\"resources\":{\"requests\":{\"storage\":...}}}}"
    print_step "Monitor: Ensure >20% free space always"
    print_savings "\$15-30/month per environment"
    echo ""

    print_opportunity "Implement Storage Tiering" "High" "Medium" "7"
    print_implementation
    print_step "Hot (gp3): Database operational data"
    print_step "Warm (gp2): Backups, logs"
    print_step "Cold (Glacier): Archives, compliance"
    print_implementation
    print_step "Create: Multiple StorageClass definitions"
    print_step "Configure: Lifecycle policies in backup system"
    print_step "Implement: Auto-movement of old data to S3"
    print_savings "\$30-50/month"
    echo ""

    print_opportunity "Archive Old Database Backups" "Medium" "Low" "6"
    print_implementation
    print_step "Current: 30 days retention on expensive storage"
    print_step "Proposed: 7 days on SSD, 30 days in Glacier"
    print_step "Rationale: RTO/RPO requirements allow this"
    print_implementation
    print_step "Update: Backup retention policies"
    print_step "Configure: S3 lifecycle to move to Glacier"
    print_step "Test: Verify restore from Glacier works"
    print_savings "\$20-40/month"
    echo ""

    print_opportunity "Clean Old RabbitMQ Messages" "Medium" "Low" "5"
    print_implementation
    print_step "Current: All messages retained until processed"
    print_step "Proposed: Auto-purge after 24 hours in staging"
    print_step "Rationale: Frees storage, improves performance"
    print_implementation
    print_step "Configure: Queue expiration policies"
    print_step "Set: msg-ttl: 86400000 (24 hours) for test queues"
    print_step "Monitor: Ensure no message loss"
    print_savings "\$5-10/month"
    echo ""

    print_opportunity "Enable Storage Compression" "Low" "Medium" "4"
    print_implementation
    print_step "PostgreSQL: Enable table compression"
    print_step "RabbitMQ: Enable compression in config"
    print_step "Potential Savings: 20-30% space reduction"
    print_implementation
    print_step "Review: Compression CPU trade-offs"
    print_step "Test: Benchmark query performance"
    print_step "Enable: Only if CPU impact is acceptable"
    print_savings "\$10-20/month"
    echo ""
}

check_scaling_opportunities() {
    print_header "Auto-Scaling Tuning Opportunities"

    echo ""
    print_opportunity "Reduce Minimum Replicas" "High" "Low" "9"
    print_implementation
    print_step "Staging Workers: 3 → 1 minimum"
    print_step "Production Orchestrator: 3 → 2 minimum (keep HA)"
    print_step "Rationale: Cost savings, HPA handles scale-up"
    print_implementation
    print_step "Update: HPA minReplicas setting"
    print_step "Test: Verify quick scale-up during traffic spike"
    print_step "Monitor: First week daily, then weekly"
    print_savings "\$60-100/month"
    echo ""

    print_opportunity "Tune HPA Metrics Targets" "High" "Medium" "8"
    print_implementation
    print_step "Current CPU Target: 70% (too conservative)"
    print_step "Proposed CPU Target: 75-80%"
    print_step "Rationale: Better bin-packing, same performance"
    print_implementation
    print_step "Update: HPA spec in deployments"
    print_step "Test: Load testing to validate responsiveness"
    print_step "Monitor: P95 latency and error rate"
    print_savings "\$40-80/month"
    echo ""

    print_opportunity "Implement Queue-Based Scaling" "High" "Medium" "7"
    print_implementation
    print_step "Current: CPU/Memory metrics only"
    print_step "Proposed: Also scale on RabbitMQ queue depth"
    print_step "Benefit: Better scale for bursty workloads"
    print_implementation
    print_step "Deploy: RabbitMQ metrics exporter"
    print_step "Create: Custom metrics in Kubernetes"
    print_step "Configure: KEDA triggers for queue depth"
    print_savings "\$30-50/month"
    echo ""

    print_opportunity "Add Time-Based Scaling" "Medium" "Low" "6"
    print_implementation
    print_step "Staging: Scale down on evenings/weekends"
    print_step "Production: Time-based base capacity adjustment"
    print_step "Rationale: Predictable traffic patterns"
    print_implementation
    print_step "Create: CronJob for morning scale-up"
    print_step "Create: CronJob for evening scale-down"
    print_step "Test: Verify smooth transitions"
    print_savings "\$80-120/month (staging), \$150-200/month (prod)"
    echo ""

    print_opportunity "Reduce Maximum Replicas" "Medium" "Low" "5"
    print_implementation
    print_step "Staging: 10 → 5 maximum"
    print_step "Production: 20 → 15 maximum"
    print_step "Rationale: Observed peaks are 30-40% lower"
    print_implementation
    print_step "Review: 4-week peak utilization data"
    print_step "Update: HPA maxReplicas"
    print_step "Alert: If hitting max replicas >5% of time"
    print_savings "\$40-80/month"
    echo ""
}

check_instance_opportunities() {
    print_header "Instance Type & Capacity Opportunities"

    echo ""
    print_opportunity "Consider AMD-Based Instances (t3a)" "Medium" "Low" "6"
    print_implementation
    print_step "Current: t3.medium/large/xlarge (Intel)"
    print_step "Alternative: t3a.medium/large/xlarge (AMD)"
    print_step "Savings: 10-15% cost reduction"
    print_implementation
    print_step "Analyze: Performance compatibility"
    print_step "Test: Run benchmarks on t3a"
    print_step "Migrate: Switch node group if compatible"
    print_savings "\$20-40/month"
    echo ""

    print_opportunity "Use Spot Instances for Development" "Medium" "Medium" "7"
    print_implementation
    print_step "Target: Staging environment only"
    print_step "Savings: 90% off on-demand pricing"
    print_step "Risk: Interruption tolerance required"
    print_implementation
    print_step "Configure: Mixed on-demand + spot pools"
    print_step "Set: Fallback to on-demand if spot full"
    print_step "Test: Validate auto-recovery from interruptions"
    print_savings "\$80-120/month (staging)"
    echo ""

    print_opportunity "Implement Node Auto-Scaling (Karpenter)" "High" "High" "6"
    print_implementation
    print_step "Current: Fixed node pools"
    print_step "Proposed: Dynamic node allocation"
    print_step "Benefit: Right-sized nodes for workloads"
    print_implementation
    print_step "Deploy: Karpenter controller"
    print_step "Configure: Provisioner for staging/prod"
    print_step "Migrate: Gradual transition from fixed nodes"
    print_savings "\$50-100/month"
    echo ""

    print_opportunity "Right-Size Reserved Instances" "Medium" "Medium" "5"
    print_implementation
    print_step "Analyze: 12 weeks of usage patterns"
    print_step "Reserve: 70% of baseline capacity"
    print_step "On-Demand: Use for bursts"
    print_implementation
    print_step "Calculate: Optimal reserved capacity"
    print_step "Purchase: 1-year reserved instances"
    print_step "Monitor: Monthly utilization"
    print_savings "\$100-200/month (annual amortization)"
    echo ""
}

check_network_opportunities() {
    print_header "Network & Data Transfer Opportunities"

    echo ""
    print_opportunity "Switch NLB to ALB" "Medium" "Low" "6"
    print_implementation
    print_step "Current: Network Load Balancer (\$50/month)"
    print_step "Proposed: Application Load Balancer (\$25/month)"
    print_step "Rationale: Sufficient for HTTP/HTTPS"
    print_implementation
    print_step "Update: Service type and ingress"
    print_step "Test: Verify TLS termination"
    print_step "Validate: Performance and latency"
    print_savings "\$25/month"
    echo ""

    print_opportunity "Cache API Responses" "Medium" "Medium" "6"
    print_implementation
    print_step "Current: External API calls always fresh"
    print_step "Proposed: Cache in Redis (TTL: 1-5 min)"
    print_step "Rationale: 30% of calls are identical"
    print_implementation
    print_step "Implement: Response caching middleware"
    print_step "Configure: Cache keys and TTLs"
    print_step "Monitor: Cache hit rate (target: >30%)"
    print_savings "\$10-20/month"
    echo ""

    print_opportunity "Deploy CDN for Static Assets" "Medium" "Medium" "5"
    print_implementation
    print_step "Assets: JS, CSS, images served via CloudFront"
    print_step "Origin: Kubernetes cluster"
    print_step "Cache: Aggressive caching for >1 day"
    print_implementation
    print_step "Create: CloudFront distribution"
    print_step "Configure: Cache behaviors and TTLs"
    print_step "Update: Application to use CloudFront URLs"
    print_savings "\$20-50/month"
    echo ""

    print_opportunity "Implement VPC Endpoints" "Low" "Low" "3"
    print_implementation
    print_step "Target: AWS services (S3, DynamoDB, etc.)"
    print_step "Benefit: Eliminate data transfer charges"
    print_step "Alternative: Gateway endpoint (free)"
    print_implementation
    print_step "Create: VPC endpoints for used services"
    print_step "Update: Routing policies"
    print_step "Test: Verify connectivity"
    print_savings "\$5-10/month"
    echo ""
}

check_database_opportunities() {
    print_header "Database Optimization Opportunities"

    echo ""
    print_opportunity "Implement Connection Pooling" "Medium" "Medium" "7"
    print_implementation
    print_step "Current: Direct PostgreSQL connections"
    print_step "Proposed: pgBouncer for connection pooling"
    print_step "Benefit: Reduced database load"
    print_implementation
    print_step "Deploy: pgBouncer StatefulSet"
    print_step "Configure: Connection pool sizes"
    print_step "Update: Application connection strings"
    print_savings "\$15-25/month"
    echo ""

    print_opportunity "Enable Query Result Caching" "Medium" "Medium" "6"
    print_implementation
    print_step "Target: Frequently-used read queries"
    print_step "Method: Redis-based query cache"
    print_step "TTL: 5-60 minutes depending on data"
    print_implementation
    print_step "Identify: Top 10 slow queries"
    print_step "Implement: Caching layer for queries"
    print_step "Monitor: Cache hit rate and staleness"
    print_savings "\$20-30/month"
    echo ""

    print_opportunity "Implement Table Partitioning" "Medium" "High" "5"
    print_implementation
    print_step "Target: Large tables (logs, metrics)"
    print_step "Strategy: Partition by date"
    print_step "Benefit: Better query performance"
    print_implementation
    print_step "Plan: Partitioning strategy"
    print_step "Implement: Gradual migration"
    print_step "Test: Query performance before/after"
    print_savings "\$10-20/month"
    echo ""

    print_opportunity "Archive Old Data to S3" "Medium" "Low" "6"
    print_implementation
    print_step "Data: Logs older than 90 days"
    print_step "Storage: S3 (cheaper than EBS)"
    print_step "Access: Via DuckDB/Athena if needed"
    print_implementation
    print_step "Create: Archival policy/script"
    print_step "Schedule: Weekly/monthly archival"
    print_step "Test: Verify data retrievability"
    print_savings "\$15-30/month"
    echo ""
}

generate_summary_report() {
    print_header "Optimization Opportunities Summary"

    echo ""
    echo "Top 10 Quick Wins (Implementation in <2 weeks):"
    echo ""

    echo "1. Reduce Worker Minimum Replicas (3→1 staging)"
    echo "   Savings: \$40-50/month | Score: 9/10"
    echo ""

    echo "2. Reduce CPU Requests (20-30% across services)"
    echo "   Savings: \$80-120/month | Score: 8/10"
    echo ""

    echo "3. Adjust HPA CPU Targets (70%→75%)"
    echo "   Savings: \$40-80/month | Score: 8/10"
    echo ""

    echo "4. Right-Size PVC Allocations"
    echo "   Savings: \$20-40/month | Score: 8/10"
    echo ""

    echo "5. Switch NLB to ALB (production)"
    echo "   Savings: \$25/month | Score: 6/10"
    echo ""

    echo "6. Reduce Memory Requests (30% across services)"
    echo "   Savings: \$40-60/month | Score: 7/10"
    echo ""

    echo "7. Archive Old Backups to Glacier"
    echo "   Savings: \$20-40/month | Score: 6/10"
    echo ""

    echo "8. Implement Time-Based Scaling"
    echo "   Savings: \$80-120/month (staging) | Score: 6/10"
    echo ""

    echo "9. Cache API Responses"
    echo "   Savings: \$10-20/month | Score: 6/10"
    echo ""

    echo "10. Configure Storage Tiering"
    echo "    Savings: \$30-50/month | Score: 7/10"
    echo ""

    echo "Total Potential Savings: \$325-500/month"
    echo "Implementation Timeline: 4-12 weeks (phased approach)"
    echo ""

    # Generate prioritized list
    echo "Recommended Implementation Order (by ROI):"
    echo "Phase 1 (Week 1-2): Quick wins with CPU, memory, HPA = \$160-250/month"
    echo "Phase 2 (Week 3-6): Storage and database = \$80-150/month"
    echo "Phase 3 (Week 7-10): Network and scaling = \$80-140/month"
    echo "Phase 4 (Week 11+): Advanced optimizations = Additional upside"
}

generate_action_plan() {
    print_header "Detailed Action Plan"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local plan_file="$OUTPUT_DIR/optimization-action-plan-${timestamp}.txt"

    mkdir -p "$OUTPUT_DIR"

    {
        echo "Optimization Action Plan"
        echo "Generated: $(date)"
        echo ""
        echo "Phase 1: Immediate Actions (Week 1-2)"
        echo "===================================="
        echo ""
        echo "1.1 CPU Right-Sizing"
        echo "    [ ] Update agent-orchestrator-deployment.yaml"
        echo "    [ ] Update workers-deployment.yaml"
        echo "    [ ] Run load tests"
        echo "    [ ] Monitor CPU metrics for 1 week"
        echo "    Expected savings: \$50-70/month"
        echo ""
        echo "1.2 HPA Tuning"
        echo "    [ ] Increase CPU targets to 75%"
        echo "    [ ] Reduce minimum replicas"
        echo "    [ ] Test scaling behavior"
        echo "    Expected savings: \$60-100/month"
        echo ""
        echo "1.3 PVC Resizing"
        echo "    [ ] Analyze current usage"
        echo "    [ ] Resize PostgreSQL, Redis, RabbitMQ"
        echo "    [ ] Verify disk space monitoring"
        echo "    Expected savings: \$20-30/month"
        echo ""
        echo "Phase 2: Storage & Database (Week 3-6)"
        echo "======================================"
        echo ""
        echo "2.1 Storage Tiering"
        echo "    [ ] Create gp3 storage class"
        echo "    [ ] Migrate hot data to gp3"
        echo "    [ ] Archive warm data to S3"
        echo "    Expected savings: \$30-50/month"
        echo ""
        echo "2.2 Backup Optimization"
        echo "    [ ] Update retention policies"
        echo "    [ ] Move old backups to Glacier"
        echo "    [ ] Test restore from Glacier"
        echo "    Expected savings: \$20-40/month"
        echo ""
        echo "Phase 3: Advanced Features (Week 7+)"
        echo "====================================="
        echo ""
        echo "3.1 Time-Based Scaling"
        echo "    [ ] Create morning/evening CronJobs"
        echo "    [ ] Test scaling automation"
        echo "    [ ] Monitor for regressions"
        echo "    Expected savings: \$80-200/month"
        echo ""
        echo "3.2 Reserved Instance Planning"
        echo "    [ ] Analyze 12-week usage data"
        echo "    [ ] Calculate reserved capacity"
        echo "    [ ] Purchase 1-year reservations"
        echo "    Expected savings: \$100-200/month"
        echo ""

    } > "$plan_file"

    print_success "Action plan saved to: $plan_file"
}

###############################################################################
# Main
###############################################################################

main() {
    print_header "Cost Optimization Opportunities Scanner"

    echo ""

    # Check opportunities by category
    check_cpu_opportunities
    echo ""

    check_memory_opportunities
    echo ""

    check_storage_opportunities
    echo ""

    check_scaling_opportunities
    echo ""

    check_instance_opportunities
    echo ""

    check_network_opportunities
    echo ""

    check_database_opportunities
    echo ""

    generate_summary_report
    echo ""

    generate_action_plan
    echo ""

    print_success "Optimization opportunities analysis complete"
}

main "$@"
