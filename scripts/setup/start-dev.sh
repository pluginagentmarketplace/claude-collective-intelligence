#!/bin/bash
###############################################################################
# Development Environment Startup Script
# One-command setup for RabbitMQ + PostgreSQL + Redis development environment
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     AI Agent Orchestrator - Development Environment      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ docker-compose is not installed. Please install it and try again.${NC}"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ .env file created${NC}"
    else
        echo -e "${RED}✗ .env.example not found${NC}"
        exit 1
    fi
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Parse command line arguments
REBUILD=false
DETACHED=false
DEV_MODE=true
SETUP_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --rebuild)
            REBUILD=true
            shift
            ;;
        -d|--detached)
            DETACHED=true
            shift
            ;;
        --prod)
            DEV_MODE=false
            shift
            ;;
        --setup-only)
            SETUP_ONLY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --rebuild      Rebuild containers from scratch"
            echo "  -d, --detached Run in detached mode"
            echo "  --prod         Run in production mode (without dev overrides)"
            echo "  --setup-only   Only run setup scripts, don't start containers"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Compose files to use
COMPOSE_FILES="-f docker-compose.yml"
if [ "$DEV_MODE" = true ]; then
    COMPOSE_FILES="${COMPOSE_FILES} -f docker-compose.dev.yml"
    echo -e "${BLUE}🔧 Running in DEVELOPMENT mode${NC}"
else
    echo -e "${BLUE}🚀 Running in PRODUCTION mode${NC}"
fi

# Stop and remove containers if rebuild is requested
if [ "$REBUILD" = true ]; then
    echo -e "${YELLOW}🔄 Rebuilding containers...${NC}"
    docker-compose $COMPOSE_FILES down -v
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating directory structure...${NC}"
mkdir -p docker/rabbitmq
mkdir -p docker/postgres/init
mkdir -p docker/postgres/migrations
mkdir -p docker/postgres/seed
mkdir -p docker/pgadmin
mkdir -p logs

# Create RabbitMQ enabled_plugins file
if [ ! -f docker/rabbitmq/enabled_plugins ]; then
    echo -e "${BLUE}🐰 Creating RabbitMQ plugins configuration...${NC}"
    cat > docker/rabbitmq/enabled_plugins << EOF
[rabbitmq_management,rabbitmq_management_agent,rabbitmq_prometheus,rabbitmq_shovel,rabbitmq_shovel_management].
EOF
    echo -e "${GREEN}✓ RabbitMQ plugins configured${NC}"
fi

# Create RabbitMQ configuration file
if [ ! -f docker/rabbitmq/rabbitmq.conf ]; then
    echo -e "${BLUE}🐰 Creating RabbitMQ configuration...${NC}"
    cat > docker/rabbitmq/rabbitmq.conf << EOF
# RabbitMQ Configuration for Development

# Network and listening
listeners.tcp.default = 5672
management.tcp.port = 15672

# Logging
log.console = true
log.console.level = info
log.file.level = info

# Memory and disk limits
vm_memory_high_watermark.relative = 0.6
disk_free_limit.absolute = 2GB

# Connection settings
heartbeat = 60
frame_max = 131072
channel_max = 2047

# Queue settings
queue_master_locator = min-masters
EOF
    echo -e "${GREEN}✓ RabbitMQ configuration created${NC}"
fi

# Create PgAdmin servers.json
if [ ! -f docker/pgadmin/servers.json ]; then
    echo -e "${BLUE}🗄️  Creating PgAdmin configuration...${NC}"
    cat > docker/pgadmin/servers.json << EOF
{
    "Servers": {
        "1": {
            "Name": "AI Orchestrator DB",
            "Group": "Servers",
            "Host": "postgres",
            "Port": 5432,
            "MaintenanceDB": "ai_orchestrator",
            "Username": "aiagent",
            "SSLMode": "prefer",
            "PassFile": "/pgpass"
        }
    }
}
EOF
    echo -e "${GREEN}✓ PgAdmin configuration created${NC}"
fi

# Create sample migration file
if [ ! -f docker/postgres/migrations/001_initial_schema.sql ]; then
    echo -e "${BLUE}🗄️  Creating sample migration...${NC}"
    cat > docker/postgres/migrations/001_initial_schema.sql << 'EOF'
-- Initial schema migration
-- This file is automatically created and can be modified as needed

-- Add any custom migrations here
-- Example:
-- ALTER TABLE agents ADD COLUMN IF NOT EXISTS custom_field TEXT;

SELECT 'Migration 001 completed' AS status;
EOF
    echo -e "${GREEN}✓ Sample migration created${NC}"
fi

# Create sample seed data
if [ ! -f docker/postgres/seed/dev_data.sql ]; then
    echo -e "${BLUE}🌱 Creating seed data...${NC}"
    cat > docker/postgres/seed/dev_data.sql << 'EOF'
-- Development seed data
-- This file is loaded only in development mode

-- Insert sample agents
INSERT INTO agents (agent_id, agent_name, agent_type, status, capabilities) VALUES
    ('agent-dev-001', 'Dev Agent 1', 'worker', 'online', '["coding", "testing"]'::jsonb),
    ('agent-dev-002', 'Dev Agent 2', 'coordinator', 'online', '["orchestration", "monitoring"]'::jsonb)
ON CONFLICT (agent_id) DO NOTHING;

SELECT 'Seed data loaded' AS status;
EOF
    echo -e "${GREEN}✓ Seed data created${NC}"
fi

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Starting Docker Containers         ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Start containers
if [ "$DETACHED" = true ]; then
    docker-compose $COMPOSE_FILES up -d
else
    # Start in background for setup, will bring to foreground later
    docker-compose $COMPOSE_FILES up -d
fi

echo ""
echo -e "${GREEN}✓ Containers started${NC}"
echo ""

# Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
sleep 5

# Check RabbitMQ health
echo -e "${YELLOW}Checking RabbitMQ...${NC}"
until docker exec ai-agent-rabbitmq rabbitmq-diagnostics -q ping 2>/dev/null; do
    echo -e "${YELLOW}  Waiting for RabbitMQ...${NC}"
    sleep 2
done
echo -e "${GREEN}✓ RabbitMQ is healthy${NC}"

# Check PostgreSQL health
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
until docker exec ai-agent-postgres pg_isready -U aiagent -d ai_orchestrator 2>/dev/null; do
    echo -e "${YELLOW}  Waiting for PostgreSQL...${NC}"
    sleep 2
done
echo -e "${GREEN}✓ PostgreSQL is healthy${NC}"

# Check Redis health
echo -e "${YELLOW}Checking Redis...${NC}"
until docker exec ai-agent-redis redis-cli ping 2>/dev/null | grep -q PONG; do
    echo -e "${YELLOW}  Waiting for Redis...${NC}"
    sleep 2
done
echo -e "${GREEN}✓ Redis is healthy${NC}"

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Running Setup Scripts              ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Make setup scripts executable
chmod +x scripts/setup-rabbitmq.sh
chmod +x scripts/setup-database.sh

# Run RabbitMQ setup
echo -e "${BLUE}🐰 Setting up RabbitMQ...${NC}"
./scripts/setup-rabbitmq.sh

echo ""

# Run Database setup
echo -e "${BLUE}🗄️  Setting up PostgreSQL...${NC}"
./scripts/setup-database.sh

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  ✓ Development Environment Ready!  ${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Display service URLs
echo -e "${CYAN}📡 Service URLs:${NC}"
echo -e "${BLUE}───────────────────────────────────────────${NC}"
echo -e "${GREEN}RabbitMQ Management:${NC} http://localhost:15672"
echo -e "  ${YELLOW}Username:${NC} ${RABBITMQ_USER:-admin}"
echo -e "  ${YELLOW}Password:${NC} ${RABBITMQ_PASSWORD:-admin123}"
echo ""
echo -e "${GREEN}PostgreSQL:${NC} postgresql://localhost:5432/ai_orchestrator"
echo -e "  ${YELLOW}Username:${NC} ${POSTGRES_USER:-aiagent}"
echo -e "  ${YELLOW}Password:${NC} ${POSTGRES_PASSWORD:-aiagent123}"
echo ""
echo -e "${GREEN}Redis:${NC} redis://localhost:6379"
echo -e "  ${YELLOW}Password:${NC} ${REDIS_PASSWORD:-redis123}"
echo ""
echo -e "${GREEN}Adminer (DB UI):${NC} http://localhost:8080"
echo ""

if [ "$DEV_MODE" = true ]; then
    echo -e "${GREEN}PgAdmin:${NC} http://localhost:5050"
    echo -e "  ${YELLOW}Email:${NC} ${PGADMIN_EMAIL:-admin@aiagent.local}"
    echo -e "  ${YELLOW}Password:${NC} ${PGADMIN_PASSWORD:-admin123}"
    echo ""
    echo -e "${GREEN}Redis Commander:${NC} http://localhost:8081"
    echo -e "  ${YELLOW}Username:${NC} ${REDIS_COMMANDER_USER:-admin}"
    echo -e "  ${YELLOW}Password:${NC} ${REDIS_COMMANDER_PASSWORD:-admin123}"
    echo ""
fi

echo -e "${BLUE}───────────────────────────────────────────${NC}"
echo ""

# Display useful commands
echo -e "${CYAN}🔧 Useful Commands:${NC}"
echo -e "${BLUE}───────────────────────────────────────────${NC}"
echo -e "  ${YELLOW}View logs:${NC}          docker-compose logs -f"
echo -e "  ${YELLOW}Stop services:${NC}      docker-compose down"
echo -e "  ${YELLOW}Restart services:${NC}   docker-compose restart"
echo -e "  ${YELLOW}Run tests:${NC}          npm test"
echo -e "  ${YELLOW}Start orchestrator:${NC} npm start"
echo -e "${BLUE}───────────────────────────────────────────${NC}"
echo ""

# If setup-only, stop here
if [ "$SETUP_ONLY" = true ]; then
    echo -e "${GREEN}✓ Setup complete! Services are running in detached mode.${NC}"
    exit 0
fi

# If not detached, show logs
if [ "$DETACHED" = false ]; then
    echo -e "${YELLOW}📋 Showing container logs (Ctrl+C to stop)...${NC}"
    echo ""
    docker-compose $COMPOSE_FILES logs -f
else
    echo -e "${GREEN}✓ Services are running in detached mode.${NC}"
    echo -e "${YELLOW}Run 'docker-compose logs -f' to view logs.${NC}"
fi
