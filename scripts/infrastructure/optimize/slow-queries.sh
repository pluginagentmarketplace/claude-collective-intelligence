#!/bin/bash

#
# Analyze Slow Queries Script
# Identifies and analyzes slow database queries in PostgreSQL
#
# Usage: ./scripts/analyze-slow-queries.sh
#

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-agent_db}"
DB_USER="${DB_USER:-postgres}"
SLOW_QUERY_THRESHOLD="${SLOW_QUERY_THRESHOLD:-100}"  # milliseconds
OUTPUT_DIR="${OUTPUT_DIR:-./performance-reports}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}PostgreSQL Slow Query Analysis Tool${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "Configuration:"
echo "  Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "  User: $DB_USER"
echo "  Slow Query Threshold: ${SLOW_QUERY_THRESHOLD}ms"
echo "  Output Directory: $OUTPUT_DIR"
echo ""

# Function to execute SQL
execute_sql() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Function to export SQL results to file
export_sql_to_file() {
    local query="$1"
    local filename="$2"

    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -c "COPY ($query) TO STDOUT WITH (FORMAT CSV, HEADER)" \
        > "${OUTPUT_DIR}/${filename}"

    echo -e "${GREEN}✓ Saved to ${filename}${NC}"
}

# Check if pg_stat_statements extension is available
echo -e "${YELLOW}Checking for pg_stat_statements extension...${NC}"
if execute_sql "SELECT * FROM pg_stat_statements LIMIT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ pg_stat_statements is available${NC}"
else
    echo -e "${YELLOW}⚠ pg_stat_statements not available, installing...${NC}"
    execute_sql "CREATE EXTENSION IF NOT EXISTS pg_stat_statements"
    execute_sql "ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'"
    execute_sql "SELECT pg_reload_conf()"
    echo -e "${GREEN}✓ pg_stat_statements installed${NC}"
fi

echo ""
echo -e "${YELLOW}=== TOP 20 SLOWEST QUERIES ===${NC}"
echo ""

SLOW_QUERIES_SQL="
SELECT
    SUBSTRING(query, 1, 80) as query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) as mean_ms,
    ROUND(max_exec_time::numeric, 2) as max_ms,
    ROUND(total_exec_time::numeric, 2) as total_ms,
    ROUND(stddev_exec_time::numeric, 2) as stddev_ms
FROM pg_stat_statements
WHERE mean_exec_time > $SLOW_QUERY_THRESHOLD
ORDER BY mean_exec_time DESC
LIMIT 20;
"

execute_sql "$SLOW_QUERIES_SQL"

# Export to file
export_sql_to_file "$SLOW_QUERIES_SQL" "slow_queries_top20.csv"

echo ""
echo -e "${YELLOW}=== QUERIES BY TOTAL TIME ===${NC}"
echo ""

TOTAL_TIME_SQL="
SELECT
    SUBSTRING(query, 1, 80) as query_preview,
    calls,
    ROUND(total_exec_time::numeric, 2) as total_ms,
    ROUND(mean_exec_time::numeric, 2) as mean_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
"

execute_sql "$TOTAL_TIME_SQL"
export_sql_to_file "$TOTAL_TIME_SQL" "queries_by_total_time.csv"

echo ""
echo -e "${YELLOW}=== MOST FREQUENTLY CALLED SLOW QUERIES ===${NC}"
echo ""

FREQUENT_SLOW_QUERIES="
SELECT
    SUBSTRING(query, 1, 80) as query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) as mean_ms,
    ROUND(max_exec_time::numeric, 2) as max_ms
FROM pg_stat_statements
WHERE mean_exec_time > $SLOW_QUERY_THRESHOLD
ORDER BY calls DESC
LIMIT 20;
"

execute_sql "$FREQUENT_SLOW_QUERIES"
export_sql_to_file "$FREQUENT_SLOW_QUERIES" "frequent_slow_queries.csv"

echo ""
echo -e "${YELLOW}=== QUERIES WITH HIGH VARIANCE ===${NC}"
echo ""

HIGH_VARIANCE_QUERIES="
SELECT
    SUBSTRING(query, 1, 80) as query_preview,
    calls,
    ROUND(mean_exec_time::numeric, 2) as mean_ms,
    ROUND(stddev_exec_time::numeric, 2) as stddev_ms,
    ROUND(stddev_exec_time / NULLIF(mean_exec_time, 0), 2) as variance_ratio
FROM pg_stat_statements
WHERE stddev_exec_time > 0 AND calls > 10
ORDER BY variance_ratio DESC
LIMIT 20;
"

execute_sql "$HIGH_VARIANCE_QUERIES"
export_sql_to_file "$HIGH_VARIANCE_QUERIES" "high_variance_queries.csv"

echo ""
echo -e "${YELLOW}=== SEQUENTIAL SCANS (Index Opportunities) ===${NC}"
echo ""

# Reset pg_stat_statements for fresh analysis
execute_sql "SELECT pg_stat_statements_reset();"

# Run workload
echo -e "${YELLOW}Monitoring queries for 60 seconds...${NC}"
sleep 60

# Get queries doing sequential scans
echo ""
execute_sql "
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE
        WHEN seq_scan > 0 AND idx_scan = 0 THEN 'NEEDS INDEX'
        WHEN seq_scan > idx_scan * 10 THEN 'INDEX MISSING OR INEFFICIENT'
        ELSE 'OK'
    END as recommendation
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_scan DESC
LIMIT 20;
"

echo ""
echo -e "${YELLOW}=== INDEX USAGE ANALYSIS ===${NC}"
echo ""

INDEX_ANALYSIS="
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_tup_fetch::float / NULLIF(idx_tup_read, 0) < 0.01 THEN 'INEFFICIENT'
        WHEN idx_tup_fetch::float / NULLIF(idx_tup_read, 0) > 0.5 THEN 'EFFICIENT'
        ELSE 'MODERATE'
    END as efficiency
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
"

execute_sql "$INDEX_ANALYSIS"
export_sql_to_file "$INDEX_ANALYSIS" "index_analysis.csv"

echo ""
echo -e "${YELLOW}=== UNUSED INDEXES ===${NC}"
echo ""

UNUSED_INDEXES="
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
"

execute_sql "$UNUSED_INDEXES"
export_sql_to_file "$UNUSED_INDEXES" "unused_indexes.csv"

echo ""
echo -e "${YELLOW}=== TABLE SIZE & BLOAT ===${NC}"
echo ""

TABLE_BLOAT="
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    ROUND(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_ratio
FROM pg_stat_user_tables
WHERE n_live_tup > 1000
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
"

execute_sql "$TABLE_BLOAT"
export_sql_to_file "$TABLE_BLOAT" "table_bloat.csv"

echo ""
echo -e "${YELLOW}=== CONNECTION POOL STATUS ===${NC}"
echo ""

CONNECTION_STATUS="
SELECT
    datname,
    usename,
    count(*) as connection_count,
    state,
    max(backend_start) as oldest_connection
FROM pg_stat_activity
GROUP BY datname, usename, state
ORDER BY connection_count DESC;
"

execute_sql "$CONNECTION_STATUS"

echo ""
echo -e "${YELLOW}=== LOCK ANALYSIS ===${NC}"
echo ""

LOCK_ANALYSIS="
SELECT
    l.locktype,
    l.database,
    l.relation,
    l.mode,
    l.granted,
    a.usename,
    a.query,
    a.query_start
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT l.granted OR l.locktype = 'ExclusiveLock'
ORDER BY a.query_start DESC;
"

execute_sql "$LOCK_ANALYSIS"

echo ""
echo -e "${YELLOW}=== VACUUM & AUTOVACUUM STATUS ===${NC}"
echo ""

VACUUM_STATUS="
SELECT
    schemaname,
    relname,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY last_vacuum DESC
LIMIT 20;
"

execute_sql "$VACUUM_STATUS"
export_sql_to_file "$VACUUM_STATUS" "vacuum_status.csv"

echo ""
echo -e "${YELLOW}=== CACHE HIT RATIO ===${NC}"
echo ""

CACHE_HIT="
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio,
    ROUND(100 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2) as cache_hit_ratio
FROM pg_statio_user_tables;
"

execute_sql "$CACHE_HIT"

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Analysis Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Reports saved to: $OUTPUT_DIR"
echo ""
echo "Files generated:"
ls -lh "$OUTPUT_DIR"/*.csv 2>/dev/null || echo "No CSV files generated"

echo ""
echo -e "${YELLOW}Recommendations:${NC}"
echo ""
echo "1. Review slow_queries_top20.csv for optimization opportunities"
echo "2. Check index_analysis.csv for unused or inefficient indexes"
echo "3. Look for sequential scans in high-traffic tables"
echo "4. Consider VACUUM on tables with high dead_ratio"
echo "5. Review unused_indexes.csv - consider dropping unused indexes"
echo ""
echo "Next steps:"
echo "  - Run: ./scripts/optimize-indexes.sh"
echo "  - Run: ./scripts/tune-cache.sh"
echo ""

exit 0
