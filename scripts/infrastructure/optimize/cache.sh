#!/bin/bash

#
# Tune Cache Script
# Analyzes and optimizes Redis cache performance
#
# Usage: ./scripts/tune-cache.sh [--duration 300]
#

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_DB="${REDIS_DB:-0}"
DURATION="${1:-300}"  # Default 5 minutes
OUTPUT_DIR="${OUTPUT_DIR:-./performance-reports}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Redis Cache Optimization Tool${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "Configuration:"
echo "  Redis: $REDIS_HOST:$REDIS_PORT"
echo "  Database: $REDIS_DB"
echo "  Analysis Duration: ${DURATION}s"
echo "  Output Directory: $OUTPUT_DIR"
echo ""

# Function to execute Redis command
redis_cmd() {
    local cmd="$1"

    if [[ -z "$REDIS_PASSWORD" ]]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -n "$REDIS_DB" $cmd
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" -n "$REDIS_DB" $cmd
    fi
}

# Check Redis connectivity
echo -e "${YELLOW}Checking Redis connectivity...${NC}"
if ! redis_cmd "PING" > /dev/null 2>&1; then
    echo -e "${RED}✗ Cannot connect to Redis at $REDIS_HOST:$REDIS_PORT${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Connected to Redis${NC}"
echo ""

# ============================================================
# MEMORY ANALYSIS
# ============================================================

echo -e "${YELLOW}=== MEMORY ANALYSIS ===${NC}"
echo ""

# Get memory stats
echo -e "${YELLOW}Current Memory Usage:${NC}"
redis_cmd "INFO memory" | grep -E "^(used_memory|maxmemory|mem_fragmentation)"

# Calculate percentage
MEMORY_INFO=$(redis_cmd "INFO memory")
USED=$(echo "$MEMORY_INFO" | grep "^used_memory:" | cut -d: -f2)
MAX=$(redis_cmd "CONFIG GET maxmemory" | tail -1)

if [[ -n "$MAX" && "$MAX" != "0" ]]; then
    PERCENT=$((USED * 100 / MAX))
    echo ""
    echo "Memory Usage: $USED bytes / $MAX bytes (${PERCENT}%)"

    if [[ $PERCENT -gt 85 ]]; then
        echo -e "${RED}⚠ Memory usage critical (>85%)${NC}"
    elif [[ $PERCENT -gt 70 ]]; then
        echo -e "${YELLOW}⚠ Memory usage high (>70%)${NC}"
    else
        echo -e "${GREEN}✓ Memory usage normal${NC}"
    fi
fi

# Memory fragmentation
FRAGMENTATION=$(echo "$MEMORY_INFO" | grep "^mem_fragmentation_ratio:" | cut -d: -f2)
echo ""
echo "Memory Fragmentation Ratio: $FRAGMENTATION"
if (( $(echo "$FRAGMENTATION > 1.5" | bc -l) )); then
    echo -e "${YELLOW}⚠ High fragmentation. Consider MEMORY PURGE or Redis restart${NC}"
else
    echo -e "${GREEN}✓ Fragmentation normal${NC}"
fi

echo ""
echo -e "${YELLOW}=== KEY SPACE ANALYSIS ===${NC}"
echo ""

# Get keyspace info
echo -e "${YELLOW}Database Keyspace:${NC}"
redis_cmd "INFO keyspace"

# Find big keys
echo ""
echo -e "${YELLOW}Top 20 Largest Keys (sampling):${NC}"
redis_cmd "--bigkeys" | head -30

echo ""
echo -e "${YELLOW}=== COMMAND STATISTICS ===${NC}"
echo ""

# Command stats
echo -e "${YELLOW}Most Used Commands:${NC}"
redis_cmd "INFO commandstats" | grep "^cmdstat_" | sort -t= -k2 -rn | head -20

echo ""
echo -e "${YELLOW}=== SLOW QUERY ANALYSIS ===${NC}"
echo ""

# Reset slowlog
redis_cmd "SLOWLOG RESET" > /dev/null

echo -e "${YELLOW}Monitoring slow commands for ${DURATION}s...${NC}"
sleep "$DURATION"

echo ""
echo -e "${YELLOW}Top 20 Slowest Commands:${NC}"
SLOWLOG=$(redis_cmd "SLOWLOG GET 20")

if [[ -z "$SLOWLOG" ]]; then
    echo -e "${GREEN}✓ No slow commands detected${NC}"
else
    echo "$SLOWLOG"
fi

echo ""
echo -e "${YELLOW}=== EVICTION ANALYSIS ===${NC}"
echo ""

# Get eviction policy
POLICY=$(redis_cmd "CONFIG GET maxmemory-policy" | tail -1)
echo "Eviction Policy: $POLICY"

# Get eviction stats
EVICTION_INFO=$(redis_cmd "INFO stats")
EVICTED_KEYS=$(echo "$EVICTION_INFO" | grep "^evicted_keys:" | cut -d: -f2)
TOTAL_COMMANDS=$(echo "$EVICTION_INFO" | grep "^total_commands_processed:" | cut -d: -f2)

echo "Evicted Keys: $EVICTED_KEYS"

if [[ $EVICTED_KEYS -gt 0 ]]; then
    EVICTION_RATE=$((EVICTED_KEYS * 100 / TOTAL_COMMANDS))
    echo "Eviction Rate: ${EVICTION_RATE}% of total commands"

    if [[ $EVICTION_RATE -gt 5 ]]; then
        echo -e "${RED}⚠ High eviction rate. Cache size may be insufficient.${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}=== HIT RATE ANALYSIS ===${NC}"
echo ""

# Calculate hit rate
HITS=$(redis_cmd "INFO stats" | grep "^keyspace_hits:" | cut -d: -f2)
MISSES=$(redis_cmd "INFO stats" | grep "^keyspace_misses:" | cut -d: -f2)
TOTAL_ACCESSES=$((HITS + MISSES))

if [[ $TOTAL_ACCESSES -gt 0 ]]; then
    HIT_RATE=$((HITS * 100 / TOTAL_ACCESSES))
    echo "Cache Hit Rate: ${HIT_RATE}% (${HITS} hits, ${MISSES} misses)"

    if [[ $HIT_RATE -gt 85 ]]; then
        echo -e "${GREEN}✓ Excellent hit rate${NC}"
    elif [[ $HIT_RATE -gt 70 ]]; then
        echo -e "${YELLOW}⚠ Fair hit rate. Consider optimizing cache strategy.${NC}"
    else
        echo -e "${RED}⚠ Low hit rate. Review cache configuration.${NC}"
    fi
else
    echo -e "${YELLOW}Insufficient data for hit rate analysis${NC}"
fi

echo ""
echo -e "${YELLOW}=== CONNECTION ANALYSIS ===${NC}"
echo ""

# Connection stats
CONNECTIONS=$(redis_cmd "INFO clients" | grep "^connected_clients:" | cut -d: -f2)
MAX_CLIENTS=$(redis_cmd "CONFIG GET maxclients" | tail -1)
echo "Connected Clients: $CONNECTIONS"
echo "Max Clients: $MAX_CLIENTS"

if [[ $CONNECTIONS -gt $(($MAX_CLIENTS * 80 / 100)) ]]; then
    echo -e "${YELLOW}⚠ Client connections near limit${NC}"
fi

echo ""
echo -e "${YELLOW}=== PERSISTENCE ANALYSIS ===${NC}"
echo ""

# RDB persistence
SAVE_CONFIG=$(redis_cmd "CONFIG GET save" | tail -1)
BGSAVE_IN_PROGRESS=$(redis_cmd "BGSAVE" 2>&1 | grep -c "Background saving" || echo "0")

echo "RDB Save Config: $SAVE_CONFIG"

# AOF persistence
AOF_ENABLED=$(redis_cmd "CONFIG GET appendonly" | tail -1)
echo "AOF Enabled: $AOF_ENABLED"

if [[ "$AOF_ENABLED" == "yes" ]]; then
    AOF_SIZE=$(redis_cmd "INFO stats" | grep "^aof_current_size:" | cut -d: -f2)
    echo "AOF Size: $AOF_SIZE bytes"
fi

echo ""
echo -e "${YELLOW}=== OPTIMIZATION RECOMMENDATIONS ===${NC}"
echo ""

RECOMMENDATIONS=0

# Check memory usage
if [[ -n "$MAX" && "$MAX" != "0" && $PERCENT -gt 80 ]]; then
    echo "1. HIGH MEMORY USAGE"
    echo "   - Consider increasing maxmemory limit"
    echo "   - Review cache TTL strategy"
    echo "   - Implement more aggressive eviction policy"
    ((RECOMMENDATIONS++))
fi

# Check fragmentation
if (( $(echo "$FRAGMENTATION > 1.5" | bc -l) )); then
    echo "$((RECOMMENDATIONS + 1)). HIGH MEMORY FRAGMENTATION"
    echo "   - Run: MEMORY PURGE"
    echo "   - Or restart Redis server"
    ((RECOMMENDATIONS++))
fi

# Check hit rate
if [[ $TOTAL_ACCESSES -gt 0 && $HIT_RATE -lt 80 ]]; then
    echo "$((RECOMMENDATIONS + 1)). LOW CACHE HIT RATE"
    echo "   - Review cache key strategy"
    echo "   - Increase cache size (maxmemory)"
    echo "   - Implement cache warming"
    echo "   - Optimize TTL values"
    ((RECOMMENDATIONS++))
fi

# Check eviction
if [[ $EVICTION_RATE -gt 5 ]]; then
    echo "$((RECOMMENDATIONS + 1)). HIGH EVICTION RATE"
    echo "   - Increase Redis memory limit"
    echo "   - Review cache entry sizes"
    echo "   - Implement better eviction policy"
    ((RECOMMENDATIONS++))
fi

# Check connections
if [[ $CONNECTIONS -gt $(($MAX_CLIENTS * 80 / 100)) ]]; then
    echo "$((RECOMMENDATIONS + 1)). HIGH CLIENT CONNECTIONS"
    echo "   - Increase maxclients setting"
    echo "   - Review connection pooling strategy"
    ((RECOMMENDATIONS++))
fi

if [[ $RECOMMENDATIONS -eq 0 ]]; then
    echo -e "${GREEN}✓ No critical issues detected. Cache is well-tuned.${NC}"
fi

echo ""
echo -e "${YELLOW}=== SUGGESTED COMMANDS ===${NC}"
echo ""
echo "# Analyze memory usage in detail"
echo "redis-cli MEMORY DOCTOR"
echo ""
echo "# Find memory leaks"
echo "redis-cli MEMORY STATS"
echo ""
echo "# Purge memory fragmentation"
echo "redis-cli MEMORY PURGE"
echo ""
echo "# Force eviction of expired keys"
echo "redis-cli EVICT EXPIRED"
echo ""
echo "# Scan for specific key patterns"
echo "redis-cli --scan --pattern 'cache:*' | head -100"
echo ""

# Generate report file
REPORT_FILE="${OUTPUT_DIR}/redis_cache_analysis_$(date +%Y%m%d_%H%M%S).txt"

echo -e "${YELLOW}=== GENERATING REPORT ===${NC}"
echo ""
{
    echo "Redis Cache Analysis Report"
    echo "Generated: $(date)"
    echo "================================================"
    echo ""
    echo "Memory Usage: $PERCENT%"
    echo "Fragmentation: $FRAGMENTATION"
    echo "Hit Rate: ${HIT_RATE}%"
    echo "Evicted Keys: $EVICTED_KEYS"
    echo "Connected Clients: $CONNECTIONS"
    echo ""
    echo "Key Statistics:"
    redis_cmd "INFO keyspace"
    echo ""
    echo "Command Statistics (Top 10):"
    redis_cmd "INFO commandstats" | grep "^cmdstat_" | sort -t= -k2 -rn | head -10
} > "$REPORT_FILE"

echo -e "${GREEN}✓ Report saved to: $REPORT_FILE${NC}"
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Cache Optimization Analysis Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Review recommendations above"
echo "  2. Apply suggested configuration changes"
echo "  3. Run: ./scripts/benchmark-performance.sh"
echo "  4. Monitor Redis metrics continuously"
echo ""

exit 0
