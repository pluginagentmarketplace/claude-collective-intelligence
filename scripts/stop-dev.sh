#!/bin/bash
###############################################################################
# Stop Development Environment Script
# Safely stops and optionally cleans Docker containers and volumes
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     AI Agent Orchestrator - Stop Environment             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Parse command line arguments
REMOVE_VOLUMES=false
REMOVE_IMAGES=false
CLEAN_ALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--volumes)
            REMOVE_VOLUMES=true
            shift
            ;;
        -i|--images)
            REMOVE_IMAGES=true
            shift
            ;;
        --clean-all)
            CLEAN_ALL=true
            REMOVE_VOLUMES=true
            REMOVE_IMAGES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --volumes    Remove volumes (DESTRUCTIVE - deletes all data)"
            echo "  -i, --images     Remove images (frees disk space)"
            echo "  --clean-all      Remove everything (containers, volumes, images)"
            echo "  -h, --help       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Stop containers only"
            echo "  $0 --volumes          # Stop and remove data volumes"
            echo "  $0 --clean-all        # Complete cleanup"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Warn about destructive operations
if [ "$REMOVE_VOLUMES" = true ]; then
    echo -e "${RED}⚠️  WARNING: This will DELETE ALL DATA in the volumes!${NC}"
    echo -e "${YELLOW}   - RabbitMQ messages and configuration${NC}"
    echo -e "${YELLOW}   - PostgreSQL database${NC}"
    echo -e "${YELLOW}   - Redis data${NC}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${GREEN}Cancelled.${NC}"
        exit 0
    fi
fi

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Stopping Services                  ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Determine compose files
COMPOSE_FILES="-f docker-compose.yml"
if [ -f docker-compose.dev.yml ]; then
    COMPOSE_FILES="${COMPOSE_FILES} -f docker-compose.dev.yml"
fi

# Stop containers
echo -e "${YELLOW}🛑 Stopping containers...${NC}"
docker-compose $COMPOSE_FILES stop

echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Remove containers
echo -e "${YELLOW}🗑️  Removing containers...${NC}"
docker-compose $COMPOSE_FILES rm -f

echo -e "${GREEN}✓ Containers removed${NC}"
echo ""

# Remove volumes if requested
if [ "$REMOVE_VOLUMES" = true ]; then
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  Removing Volumes                   ${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""

    volumes=(
        "ai-agent-rabbitmq-data"
        "ai-agent-rabbitmq-logs"
        "ai-agent-postgres-data"
        "ai-agent-redis-data"
        "ai-agent-pgadmin-data"
    )

    for volume in "${volumes[@]}"; do
        if docker volume ls | grep -q "$volume"; then
            echo -e "${YELLOW}Removing volume: ${volume}${NC}"
            docker volume rm "$volume" 2>/dev/null || echo -e "${YELLOW}  (volume may not exist)${NC}"
        fi
    done

    echo -e "${GREEN}✓ Volumes removed${NC}"
    echo ""
fi

# Remove images if requested
if [ "$REMOVE_IMAGES" = true ]; then
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}  Removing Images                    ${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo ""

    images=(
        "rabbitmq:3.12-management-alpine"
        "postgres:14-alpine"
        "redis:7-alpine"
        "adminer:latest"
        "dpage/pgadmin4:latest"
        "rediscommander/redis-commander:latest"
    )

    for image in "${images[@]}"; do
        if docker images | grep -q "$image"; then
            echo -e "${YELLOW}Removing image: ${image}${NC}"
            docker rmi "$image" 2>/dev/null || echo -e "${YELLOW}  (image may be in use)${NC}"
        fi
    done

    echo -e "${GREEN}✓ Images removed${NC}"
    echo ""
fi

# Clean up network
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Cleaning Network                   ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

if docker network ls | grep -q "ai-agent-network"; then
    echo -e "${YELLOW}Removing network: ai-agent-network${NC}"
    docker network rm ai-agent-network 2>/dev/null || echo -e "${YELLOW}  (network may be in use)${NC}"
    echo -e "${GREEN}✓ Network removed${NC}"
else
    echo -e "${YELLOW}Network ai-agent-network not found${NC}"
fi

echo ""

# Show remaining resources
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Summary                            ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

echo -e "${CYAN}Docker Resources:${NC}"
echo -e "${BLUE}───────────────────────────────────────────${NC}"

# Count containers
CONTAINER_COUNT=$(docker ps -a --filter "name=ai-agent" --format "{{.Names}}" | wc -l)
echo -e "Containers: ${CONTAINER_COUNT}"

# Count volumes
VOLUME_COUNT=$(docker volume ls --filter "name=ai-agent" --format "{{.Name}}" | wc -l)
echo -e "Volumes: ${VOLUME_COUNT}"

# Count networks
NETWORK_COUNT=$(docker network ls --filter "name=ai-agent" --format "{{.Name}}" | wc -l)
echo -e "Networks: ${NETWORK_COUNT}"

echo -e "${BLUE}───────────────────────────────────────────${NC}"
echo ""

if [ "$CLEAN_ALL" = true ]; then
    echo -e "${GREEN}✓ Complete cleanup finished!${NC}"
    echo -e "${YELLOW}Run './scripts/start-dev.sh --rebuild' to start fresh.${NC}"
elif [ "$REMOVE_VOLUMES" = true ]; then
    echo -e "${GREEN}✓ Stopped and cleaned volumes!${NC}"
    echo -e "${YELLOW}Run './scripts/start-dev.sh' to restart with fresh data.${NC}"
else
    echo -e "${GREEN}✓ Stopped services!${NC}"
    echo -e "${YELLOW}Run './scripts/start-dev.sh' to restart.${NC}"
fi

echo ""
