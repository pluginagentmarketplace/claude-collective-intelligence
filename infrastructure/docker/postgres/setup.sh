#!/bin/bash
# ============================================================================
# Database Setup Script
# ============================================================================
# Description: Initialize PostgreSQL database for AI Agent Orchestrator
# Usage: ./database/setup.sh [options]
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${DB_NAME:-ai_agent_orchestrator}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
LOAD_SEED_DATA="${LOAD_SEED_DATA:-false}"

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}→${NC} $1"
}

print_header() {
    echo ""
    echo "============================================"
    echo "$1"
    echo "============================================"
    echo ""
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if PostgreSQL is installed
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL client (psql) is not installed"
        exit 1
    fi
    print_success "PostgreSQL client found"

    # Check if PostgreSQL server is running
    if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" &> /dev/null; then
        print_error "PostgreSQL server is not running on $DB_HOST:$DB_PORT"
        exit 1
    fi
    print_success "PostgreSQL server is running"

    # Check PostgreSQL version
    PG_VERSION=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -t -c "SELECT version();" 2>/dev/null | head -n 1)
    print_success "PostgreSQL version: $PG_VERSION"
}

create_database() {
    print_header "Creating Database"

    # Check if database exists
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        print_info "Database '$DB_NAME' already exists"
        read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Dropping database '$DB_NAME'..."
            dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
            print_success "Database dropped"
        else
            print_info "Skipping database creation"
            return
        fi
    fi

    print_info "Creating database '$DB_NAME'..."
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    print_success "Database '$DB_NAME' created"
}

run_migration() {
    print_header "Running Database Migration"

    print_info "Applying migration: 001_initial_schema.sql"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/migrations/001_initial_schema.sql" > /dev/null
    print_success "Migration completed successfully"

    # Verify tables were created
    TABLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | xargs)
    print_success "Created $TABLE_COUNT tables"
}

load_seed_data() {
    if [ "$LOAD_SEED_DATA" = "true" ]; then
        print_header "Loading Seed Data"

        print_info "Loading development seed data..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCRIPT_DIR/seeds/dev_data.sql" > /dev/null
        print_success "Seed data loaded successfully"

        # Show loaded data counts
        print_info "Data Summary:"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT '  - Agents: ' || COUNT(*) FROM agents
            UNION ALL
            SELECT '  - Tasks: ' || COUNT(*) FROM tasks
            UNION ALL
            SELECT '  - Achievements: ' || COUNT(*) FROM achievements
            UNION ALL
            SELECT '  - Battles: ' || COUNT(*) FROM battles
            UNION ALL
            SELECT '  - Mentorships: ' || COUNT(*) FROM mentorship_pairings;
        "
    else
        print_info "Skipping seed data (use LOAD_SEED_DATA=true to load)"
    fi
}

verify_setup() {
    print_header "Verifying Setup"

    # Check extensions
    print_info "Checking extensions..."
    EXTENSIONS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm', 'btree_gin');" | xargs)
    if [ "$EXTENSIONS" -eq "3" ]; then
        print_success "All required extensions installed"
    else
        print_error "Missing required extensions"
    fi

    # Check custom types
    print_info "Checking custom types..."
    TYPES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_type WHERE typname IN ('agent_type', 'task_status', 'voting_algorithm', 'battle_mode');" | xargs)
    if [ "$TYPES" -ge "4" ]; then
        print_success "Custom types created"
    else
        print_error "Missing custom types"
    fi

    # Check indexes
    print_info "Checking indexes..."
    INDEX_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" | xargs)
    print_success "$INDEX_COUNT indexes created"

    # Check views
    print_info "Checking views..."
    VIEW_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public';" | xargs)
    print_success "$VIEW_COUNT views created"
}

print_connection_info() {
    print_header "Setup Complete"

    echo "Database is ready! Connection details:"
    echo ""
    echo "  Host:     $DB_HOST"
    echo "  Port:     $DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  User:     $DB_USER"
    echo ""
    echo "Connection string:"
    echo "  postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    echo ""
    echo "Example connection:"
    echo "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    echo ""

    if [ "$LOAD_SEED_DATA" = "true" ]; then
        echo "Sample agent credentials:"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT agent_id, name, type, current_tier, total_points
            FROM agents
            ORDER BY total_points DESC
            LIMIT 5;
        "
    fi
}

show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -s, --seed          Load seed data"
    echo "  -f, --force         Force recreation of database"
    echo ""
    echo "Environment variables:"
    echo "  DB_NAME             Database name (default: ai_agent_orchestrator)"
    echo "  DB_USER             Database user (default: postgres)"
    echo "  DB_HOST             Database host (default: localhost)"
    echo "  DB_PORT             Database port (default: 5432)"
    echo "  LOAD_SEED_DATA      Load seed data (default: false)"
    echo ""
    echo "Examples:"
    echo "  $0                                  # Basic setup"
    echo "  $0 --seed                           # Setup with seed data"
    echo "  DB_NAME=mydb $0                     # Custom database name"
    echo "  DB_HOST=db.example.com $0           # Remote database"
}

# Main execution
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -s|--seed)
                LOAD_SEED_DATA=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Run setup steps
    check_prerequisites
    create_database
    run_migration
    load_seed_data
    verify_setup
    print_connection_info

    print_success "Database setup completed successfully!"
}

# Run main function
main "$@"
