#!/bin/bash

#
# Optimize Indexes Script
# Creates necessary indexes and removes unused ones
#
# Usage: ./scripts/optimize-indexes.sh [--dry-run]
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
DRY_RUN="${1:-}"
OUTPUT_DIR="${OUTPUT_DIR:-./performance-reports}"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check for dry-run flag
if [[ "$DRY_RUN" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}DRY RUN MODE - No changes will be applied${NC}"
else
    DRY_RUN=false
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}PostgreSQL Index Optimization Tool${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to execute SQL
execute_sql() {
    local query="$1"
    local description="$2"

    echo -e "${YELLOW}$description${NC}"

    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}[DRY RUN] Would execute:${NC}"
        echo "$query"
        echo ""
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$query"
        echo ""
    fi
}

# Function to check if index exists
index_exists() {
    local index_name="$1"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        -t -c "SELECT 1 FROM pg_indexes WHERE indexname = '$index_name' LIMIT 1" | grep -q 1
}

# ============================================================
# ESSENTIAL INDEXES FOR AGENT SYSTEM
# ============================================================

echo -e "${BLUE}=== Creating Essential Indexes ===${NC}"
echo ""

# Task table indexes
if ! index_exists "idx_tasks_agent_id"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_tasks_agent_id ON tasks(agent_id)" \
        "Creating index: idx_tasks_agent_id"
fi

if ! index_exists "idx_tasks_status"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_tasks_status ON tasks(status)" \
        "Creating index: idx_tasks_status"
fi

if ! index_exists "idx_tasks_created_at"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_tasks_created_at ON tasks(created_at DESC)" \
        "Creating index: idx_tasks_created_at"
fi

# Composite index for agent + status queries
if ! index_exists "idx_tasks_agent_status"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_tasks_agent_status ON tasks(agent_id, status)" \
        "Creating index: idx_tasks_agent_status"
fi

# Composite index with date for range queries
if ! index_exists "idx_tasks_agent_status_date"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_tasks_agent_status_date ON tasks(agent_id, status, created_at DESC)" \
        "Creating index: idx_tasks_agent_status_date"
fi

# Agent table indexes
if ! index_exists "idx_agents_status"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_agents_status ON agents(status)" \
        "Creating index: idx_agents_status"
fi

if ! index_exists "idx_agents_active"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_agents_active ON agents(is_active)" \
        "Creating index: idx_agents_active"
fi

if ! index_exists "idx_agents_created_at"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_agents_created_at ON agents(created_at DESC)" \
        "Creating index: idx_agents_created_at"
fi

# Reputation leaderboard
if ! index_exists "idx_agents_reputation"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_agents_reputation ON agents(reputation_score DESC NULLS LAST)" \
        "Creating index: idx_agents_reputation"
fi

# Session table indexes
if ! index_exists "idx_sessions_user_id"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(user_id)" \
        "Creating index: idx_sessions_user_id"
fi

if ! index_exists "idx_sessions_token_hash"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_sessions_token_hash ON sessions(token_hash)" \
        "Creating index: idx_sessions_token_hash"
fi

if ! index_exists "idx_sessions_expires_at"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_sessions_expires_at ON sessions(expires_at DESC)" \
        "Creating index: idx_sessions_expires_at"
fi

# User table indexes
if ! index_exists "idx_users_email"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_users_email ON users(email)" \
        "Creating index: idx_users_email"
fi

if ! index_exists "idx_users_created_at"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_users_created_at ON users(created_at DESC)" \
        "Creating index: idx_users_created_at"
fi

# Vote table indexes
if ! index_exists "idx_votes_agent_id"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_votes_agent_id ON votes(agent_id)" \
        "Creating index: idx_votes_agent_id"
fi

if ! index_exists "idx_votes_round_id"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_votes_round_id ON votes(round_id)" \
        "Creating index: idx_votes_round_id"
fi

if ! index_exists "idx_votes_created_at"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_votes_created_at ON votes(created_at DESC)" \
        "Creating index: idx_votes_created_at"
fi

# Composite for voting queries
if ! index_exists "idx_votes_round_agent"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_votes_round_agent ON votes(round_id, agent_id)" \
        "Creating index: idx_votes_round_agent"
fi

echo ""
echo -e "${BLUE}=== Creating Partial Indexes (Space-Efficient) ===${NC}"
echo ""

# Partial indexes for active items
if ! index_exists "idx_active_agents"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_active_agents ON agents(id) WHERE is_active = true" \
        "Creating partial index: idx_active_agents"
fi

if ! index_exists "idx_active_tasks"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_active_tasks ON tasks(agent_id, status) WHERE status IN ('pending', 'processing')" \
        "Creating partial index: idx_active_tasks"
fi

if ! index_exists "idx_valid_sessions"; then
    execute_sql \
        "CREATE INDEX CONCURRENTLY idx_valid_sessions ON sessions(user_id) WHERE expires_at > NOW()" \
        "Creating partial index: idx_valid_sessions"
fi

echo ""
echo -e "${BLUE}=== Analyzing Index Efficiency ===${NC}"
echo ""

# Get index statistics
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_tup_fetch::float / NULLIF(idx_tup_read, 0) < 0.01 THEN 'INEFFICIENT'
        WHEN idx_tup_fetch::float / NULLIF(idx_tup_read, 0) > 0.5 THEN 'EFFICIENT'
        ELSE 'MODERATE'
    END as efficiency
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
EOF

echo ""
echo -e "${BLUE}=== Removing Unused Indexes ===${NC}"
echo ""

# Find unused indexes (scan count = 0)
UNUSED_INDEXES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -t -c "
    SELECT indexname
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
    AND indexname NOT LIKE '%pkey'
    ORDER BY pg_relation_size(indexrelid) DESC;
    ")

if [[ -z "$UNUSED_INDEXES" ]]; then
    echo -e "${GREEN}✓ No unused indexes found${NC}"
else
    echo -e "${YELLOW}Found unused indexes:${NC}"
    while IFS= read -r index_name; do
        if [[ -n "$index_name" ]]; then
            execute_sql \
                "DROP INDEX CONCURRENTLY $index_name" \
                "Dropping unused index: $index_name"
        fi
    done <<< "$UNUSED_INDEXES"
fi

echo ""
echo -e "${BLUE}=== Reindexing Fragmented Indexes ===${NC}"
echo ""

# Check for index bloat
FRAGMENTED_INDEXES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -t -c "
    SELECT indexname
    FROM pg_stat_user_indexes
    WHERE pg_relation_size(indexrelid) > 1000000
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 10;
    ")

if [[ -z "$FRAGMENTED_INDEXES" ]]; then
    echo -e "${GREEN}✓ No large indexes to reindex${NC}"
else
    echo -e "${YELLOW}Reindexing large indexes:${NC}"
    while IFS= read -r index_name; do
        if [[ -n "$index_name" ]]; then
            execute_sql \
                "REINDEX INDEX CONCURRENTLY $index_name" \
                "Reindexing: $index_name"
        fi
    done <<< "$FRAGMENTED_INDEXES"
fi

echo ""
echo -e "${BLUE}=== Updating Table Statistics ===${NC}"
echo ""

# Analyze tables to update statistics
TABLES=("tasks" "agents" "sessions" "users" "votes" "leaderboard_rounds")

for table in "${TABLES[@]}"; do
    execute_sql \
        "ANALYZE $table" \
        "Analyzing table: $table"
done

echo ""
echo -e "${BLUE}=== Index Size Report ===${NC}"
echo ""

# Generate index size report
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as scans
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 30;
EOF

echo ""
echo -e "${BLUE}=== Index Recommendations ===${NC}"
echo ""

# Check for tables without indexes
echo -e "${YELLOW}Tables with high sequential scans (may need indexes):${NC}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    CASE
        WHEN seq_scan > 1000 THEN 'CRITICAL - Add indexes'
        WHEN seq_scan > 100 THEN 'HIGH - Consider indexes'
        WHEN seq_scan > 10 THEN 'MEDIUM - Monitor'
        ELSE 'LOW'
    END as recommendation
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_scan DESC
LIMIT 20;
EOF

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Index Optimization Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}This was a DRY RUN. No changes were applied.${NC}"
    echo -e "${YELLOW}Run without --dry-run flag to apply changes.${NC}"
else
    echo -e "${GREEN}All indexes have been created and optimized.${NC}"
    echo -e "${GREEN}Statistics updated for better query planning.${NC}"
fi

echo ""
echo "Next steps:"
echo "  1. Monitor query performance after index creation"
echo "  2. Run: ./scripts/analyze-slow-queries.sh"
echo "  3. Run: ./scripts/tune-cache.sh"
echo ""

exit 0
