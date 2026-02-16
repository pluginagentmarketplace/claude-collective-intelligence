#!/bin/bash
###############################################################################
# Database Setup Script
# Initializes PostgreSQL database with schema and migrations
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-aiagent}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-aiagent123}"
POSTGRES_DB="${POSTGRES_DB:-ai_orchestrator}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Database Setup for AI Orchestrator ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PostgreSQL is ready!${NC}"
            return 0
        fi
        echo -e "${YELLOW}  Attempt ${attempt}/${max_attempts}...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}✗ PostgreSQL failed to start within timeout${NC}"
    return 1
}

# Function to run SQL command
run_sql() {
    psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "$1"
}

# Function to run SQL file
run_sql_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo -e "${BLUE}📄 Running SQL file: ${file}${NC}"
        psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "$file"
        echo -e "${GREEN}✓ SQL file executed: ${file}${NC}"
    else
        echo -e "${YELLOW}⚠ SQL file not found: ${file}${NC}"
    fi
}

# Wait for PostgreSQL
wait_for_postgres || exit 1

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Creating Database Schema           ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Create extensions
echo -e "${BLUE}🔧 Enabling PostgreSQL extensions...${NC}"
run_sql "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
run_sql "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";"
echo -e "${GREEN}✓ Extensions enabled${NC}"

echo ""

# Create agents table
echo -e "${BLUE}📋 Creating 'agents' table...${NC}"
run_sql "
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'offline',
    capabilities JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_agents_heartbeat ON agents(last_heartbeat);
"
echo -e "${GREEN}✓ 'agents' table created${NC}"

# Create tasks table
echo -e "${BLUE}📋 Creating 'tasks' table...${NC}"
run_sql "
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(255) UNIQUE NOT NULL,
    task_type VARCHAR(100) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'pending',
    assigned_agent_id UUID REFERENCES agents(id),
    payload JSONB NOT NULL,
    result JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
"
echo -e "${GREEN}✓ 'tasks' table created${NC}"

# Create collective_insights table
echo -e "${BLUE}📋 Creating 'collective_insights' table...${NC}"
run_sql "
CREATE TABLE IF NOT EXISTS collective_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    insight_type VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    confidence_score DECIMAL(5,4),
    contributing_agents JSONB DEFAULT '[]'::jsonb,
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'proposed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_insights_type ON collective_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_status ON collective_insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_confidence ON collective_insights(confidence_score);
"
echo -e "${GREEN}✓ 'collective_insights' table created${NC}"

# Create voting_sessions table
echo -e "${BLUE}📋 Creating 'voting_sessions' table...${NC}"
run_sql "
CREATE TABLE IF NOT EXISTS voting_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    topic VARCHAR(255) NOT NULL,
    options JSONB NOT NULL,
    votes JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    result JSONB
);
CREATE INDEX IF NOT EXISTS idx_voting_status ON voting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voting_started ON voting_sessions(started_at);
"
echo -e "${GREEN}✓ 'voting_sessions' table created${NC}"

# Create agent_metrics table
echo -e "${BLUE}📋 Creating 'agent_metrics' table...${NC}"
run_sql "
CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES agents(id),
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4),
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON agent_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON agent_metrics(recorded_at);
"
echo -e "${GREEN}✓ 'agent_metrics' table created${NC}"

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Creating Functions & Triggers      ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Create updated_at trigger function
echo -e "${BLUE}🔧 Creating update trigger...${NC}"
run_sql "
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
\$\$ language 'plpgsql';
"

# Apply triggers to tables
run_sql "
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_insights_updated_at ON collective_insights;
CREATE TRIGGER update_insights_updated_at BEFORE UPDATE ON collective_insights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
"
echo -e "${GREEN}✓ Triggers created${NC}"

echo ""

# Run custom migration files if they exist
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Running Custom Migrations          ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

MIGRATIONS_DIR="./docker/postgres/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration_file" ]; then
            run_sql_file "$migration_file"
        fi
    done
else
    echo -e "${YELLOW}⚠ No migrations directory found${NC}"
fi

# Run seed data if in development mode
if [ "$NODE_ENV" = "development" ] || [ -d "./docker/postgres/seed" ]; then
    echo ""
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  Loading Seed Data                  ${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""

    SEED_DIR="./docker/postgres/seed"
    if [ -d "$SEED_DIR" ]; then
        for seed_file in "$SEED_DIR"/*.sql; do
            if [ -f "$seed_file" ]; then
                run_sql_file "$seed_file"
            fi
        done
    else
        echo -e "${YELLOW}⚠ No seed directory found${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  ✓ Database Setup Complete!        ${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Display summary
echo -e "${BLUE}📊 Database Summary:${NC}"
run_sql "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo -e "${BLUE}Connection: postgresql://${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}${NC}"
echo ""

unset PGPASSWORD
