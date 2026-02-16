#!/bin/bash
###############################################################################
# Health Check Script
# Checks the health status of all Docker services
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration
RABBITMQ_HOST="${RABBITMQ_HOST:-localhost}"
RABBITMQ_PORT="${RABBITMQ_MANAGEMENT_PORT:-15672}"
RABBITMQ_USER="${RABBITMQ_USER:-admin}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-admin123}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Banner
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     AI Agent Orchestrator - Health Check                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to check service health
check_service() {
    local service_name=$1
    local check_command=$2

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

    echo -ne "${BLUE}Checking ${service_name}...${NC} "

    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ HEALTHY${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}✗ UNHEALTHY${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        return 1
    fi
}

# Function to get container status
get_container_status() {
    local container_name=$1
    docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "not found"
}

# Function to get container health
get_container_health() {
    local container_name=$1
    local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")

    case $health in
        "healthy")
            echo -e "${GREEN}healthy${NC}"
            ;;
        "unhealthy")
            echo -e "${RED}unhealthy${NC}"
            ;;
        "starting")
            echo -e "${YELLOW}starting${NC}"
            ;;
        *)
            echo -e "${YELLOW}no healthcheck${NC}"
            ;;
    esac
}

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Docker Containers                  ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check Docker containers
containers=("ai-agent-rabbitmq" "ai-agent-postgres" "ai-agent-redis" "ai-agent-adminer")

for container in "${containers[@]}"; do
    status=$(get_container_status "$container")
    health=$(get_container_health "$container")

    echo -e "${CYAN}${container}:${NC}"
    echo -e "  Status: $status"
    echo -e "  Health: $health"
    echo ""
done

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Service Connectivity               ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Check RabbitMQ
check_service "RabbitMQ (AMQP)" \
    "docker exec ai-agent-rabbitmq rabbitmq-diagnostics -q ping"

check_service "RabbitMQ (Management API)" \
    "curl -sf -u ${RABBITMQ_USER}:${RABBITMQ_PASSWORD} http://${RABBITMQ_HOST}:${RABBITMQ_PORT}/api/healthchecks/node"

# Check PostgreSQL
check_service "PostgreSQL" \
    "docker exec ai-agent-postgres pg_isready -U ${POSTGRES_USER:-aiagent} -d ${POSTGRES_DB:-ai_orchestrator}"

# Check Redis
check_service "Redis" \
    "docker exec ai-agent-redis redis-cli -a ${REDIS_PASSWORD:-redis123} ping 2>/dev/null | grep -q PONG"

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Resource Usage                     ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Get resource usage
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
    ai-agent-rabbitmq ai-agent-postgres ai-agent-redis 2>/dev/null || echo "Unable to retrieve stats"

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Service Details                    ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# RabbitMQ details
if docker exec ai-agent-rabbitmq rabbitmq-diagnostics -q ping > /dev/null 2>&1; then
    echo -e "${CYAN}RabbitMQ:${NC}"

    # Get queue count
    queue_count=$(docker exec ai-agent-rabbitmq rabbitmqctl list_queues 2>/dev/null | wc -l)
    queue_count=$((queue_count - 2)) # Remove header and footer
    echo -e "  Queues: ${queue_count}"

    # Get connection count
    conn_count=$(docker exec ai-agent-rabbitmq rabbitmqctl list_connections 2>/dev/null | wc -l)
    conn_count=$((conn_count - 2))
    echo -e "  Connections: ${conn_count}"

    # Get message count
    msg_count=$(docker exec ai-agent-rabbitmq rabbitmqctl list_queues messages 2>/dev/null | awk '{sum+=$2} END {print sum}')
    echo -e "  Total Messages: ${msg_count:-0}"
    echo ""
fi

# PostgreSQL details
if docker exec ai-agent-postgres pg_isready -U ${POSTGRES_USER:-aiagent} > /dev/null 2>&1; then
    echo -e "${CYAN}PostgreSQL:${NC}"

    # Get database size
    db_size=$(docker exec ai-agent-postgres psql -U ${POSTGRES_USER:-aiagent} -d ${POSTGRES_DB:-ai_orchestrator} -t -c "SELECT pg_size_pretty(pg_database_size('${POSTGRES_DB:-ai_orchestrator}'));" 2>/dev/null | xargs)
    echo -e "  Database Size: ${db_size}"

    # Get connection count
    conn_count=$(docker exec ai-agent-postgres psql -U ${POSTGRES_USER:-aiagent} -d ${POSTGRES_DB:-ai_orchestrator} -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='${POSTGRES_DB:-ai_orchestrator}';" 2>/dev/null | xargs)
    echo -e "  Active Connections: ${conn_count}"

    # Get table count
    table_count=$(docker exec ai-agent-postgres psql -U ${POSTGRES_USER:-aiagent} -d ${POSTGRES_DB:-ai_orchestrator} -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | xargs)
    echo -e "  Tables: ${table_count}"
    echo ""
fi

# Redis details
if docker exec ai-agent-redis redis-cli -a ${REDIS_PASSWORD:-redis123} ping 2>/dev/null | grep -q PONG; then
    echo -e "${CYAN}Redis:${NC}"

    # Get key count
    key_count=$(docker exec ai-agent-redis redis-cli -a ${REDIS_PASSWORD:-redis123} DBSIZE 2>/dev/null | awk '{print $2}')
    echo -e "  Keys: ${key_count:-0}"

    # Get memory usage
    mem_used=$(docker exec ai-agent-redis redis-cli -a ${REDIS_PASSWORD:-redis123} INFO memory 2>/dev/null | grep "used_memory_human:" | cut -d: -f2 | tr -d '\r')
    echo -e "  Memory Used: ${mem_used}"

    # Get uptime
    uptime=$(docker exec ai-agent-redis redis-cli -a ${REDIS_PASSWORD:-redis123} INFO server 2>/dev/null | grep "uptime_in_seconds:" | cut -d: -f2 | tr -d '\r')
    uptime_mins=$((uptime / 60))
    echo -e "  Uptime: ${uptime_mins} minutes"
    echo ""
fi

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Summary                            ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

echo -e "Total Checks: ${TOTAL_CHECKS}"
echo -e "${GREEN}Passed: ${PASSED_CHECKS}${NC}"
echo -e "${RED}Failed: ${FAILED_CHECKS}${NC}"
echo ""

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✓ All services are healthy!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some services are unhealthy. Check logs with: docker-compose logs${NC}"
    exit 1
fi
