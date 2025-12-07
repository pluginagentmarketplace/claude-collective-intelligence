#!/bin/bash
###############################################################################
# RabbitMQ Setup Script
# Initializes exchanges, queues, and bindings for AI Agent Orchestration
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
RABBITMQ_HOST="${RABBITMQ_HOST:-localhost}"
RABBITMQ_PORT="${RABBITMQ_MANAGEMENT_PORT:-15672}"
RABBITMQ_USER="${RABBITMQ_USER:-admin}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-admin123}"
RABBITMQ_VHOST="${RABBITMQ_VHOST:-/}"
RABBITMQ_API="http://${RABBITMQ_HOST}:${RABBITMQ_PORT}/api"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  RabbitMQ Setup for AI Orchestrator ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Function to wait for RabbitMQ to be ready
wait_for_rabbitmq() {
    echo -e "${YELLOW}⏳ Waiting for RabbitMQ to be ready...${NC}"
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s -u "${RABBITMQ_USER}:${RABBITMQ_PASSWORD}" \
            "${RABBITMQ_API}/healthchecks/node" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ RabbitMQ is ready!${NC}"
            return 0
        fi
        echo -e "${YELLOW}  Attempt ${attempt}/${max_attempts}...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}✗ RabbitMQ failed to start within timeout${NC}"
    return 1
}

# Function to create exchange
create_exchange() {
    local name=$1
    local type=$2
    local durable=${3:-true}

    echo -e "${BLUE}📢 Creating exchange: ${name} (${type})${NC}"

    curl -s -u "${RABBITMQ_USER}:${RABBITMQ_PASSWORD}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -d "{\"type\":\"${type}\",\"durable\":${durable},\"auto_delete\":false}" \
        "${RABBITMQ_API}/exchanges/${RABBITMQ_VHOST}/${name}" || {
        echo -e "${RED}✗ Failed to create exchange: ${name}${NC}"
        return 1
    }

    echo -e "${GREEN}✓ Exchange created: ${name}${NC}"
}

# Function to create queue
create_queue() {
    local name=$1
    local durable=${2:-true}
    local args=${3:-'{}'}

    echo -e "${BLUE}📮 Creating queue: ${name}${NC}"

    curl -s -u "${RABBITMQ_USER}:${RABBITMQ_PASSWORD}" \
        -X PUT \
        -H "Content-Type: application/json" \
        -d "{\"durable\":${durable},\"auto_delete\":false,\"arguments\":${args}}" \
        "${RABBITMQ_API}/queues/${RABBITMQ_VHOST}/${name}" || {
        echo -e "${RED}✗ Failed to create queue: ${name}${NC}"
        return 1
    }

    echo -e "${GREEN}✓ Queue created: ${name}${NC}"
}

# Function to create binding
create_binding() {
    local queue=$1
    local exchange=$2
    local routing_key=${3:-""}

    echo -e "${BLUE}🔗 Binding queue '${queue}' to exchange '${exchange}'${NC}"

    local binding_data="{\"routing_key\":\"${routing_key}\"}"

    curl -s -u "${RABBITMQ_USER}:${RABBITMQ_PASSWORD}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "${binding_data}" \
        "${RABBITMQ_API}/bindings/${RABBITMQ_VHOST}/e/${exchange}/q/${queue}" || {
        echo -e "${RED}✗ Failed to create binding${NC}"
        return 1
    }

    echo -e "${GREEN}✓ Binding created${NC}"
}

# Wait for RabbitMQ
wait_for_rabbitmq || exit 1

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Creating Exchanges                 ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Create exchanges
create_exchange "agent.tasks" "topic" "true"
create_exchange "agent.brainstorm" "fanout" "true"
create_exchange "agent.status" "topic" "true"
create_exchange "agent.results" "topic" "true"
create_exchange "agent.deadletter" "topic" "true"
create_exchange "agent.collective" "topic" "true"
create_exchange "agent.voting" "fanout" "true"

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Creating Queues                    ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Dead Letter Queue arguments
DLQ_ARGS='{"x-dead-letter-exchange":"agent.deadletter","x-message-ttl":300000}'

# Create queues with dead-letter support
create_queue "agent.tasks.high" "true" "${DLQ_ARGS}"
create_queue "agent.tasks.normal" "true" "${DLQ_ARGS}"
create_queue "agent.tasks.low" "true" "${DLQ_ARGS}"
create_queue "agent.results" "true" "true"
create_queue "agent.brainstorm.responses" "true" "true"
create_queue "agent.status.updates" "true" "true"
create_queue "agent.deadletter.queue" "true" "true"
create_queue "agent.collective.insights" "true" "true"
create_queue "agent.voting.ballots" "true" "true"

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}  Creating Bindings                  ${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Create bindings
create_binding "agent.tasks.high" "agent.tasks" "priority.high"
create_binding "agent.tasks.normal" "agent.tasks" "priority.normal"
create_binding "agent.tasks.low" "agent.tasks" "priority.low"
create_binding "agent.results" "agent.results" "task.#"
create_binding "agent.brainstorm.responses" "agent.brainstorm" ""
create_binding "agent.status.updates" "agent.status" "agent.#"
create_binding "agent.deadletter.queue" "agent.deadletter" "#"
create_binding "agent.collective.insights" "agent.collective" "insight.#"
create_binding "agent.voting.ballots" "agent.voting" ""

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  ✓ RabbitMQ Setup Complete!        ${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${BLUE}Management UI: http://${RABBITMQ_HOST}:${RABBITMQ_PORT}${NC}"
echo -e "${BLUE}Username: ${RABBITMQ_USER}${NC}"
echo -e "${BLUE}Password: ${RABBITMQ_PASSWORD}${NC}"
echo ""

# Display summary
echo -e "${BLUE}📊 Summary:${NC}"
curl -s -u "${RABBITMQ_USER}:${RABBITMQ_PASSWORD}" \
    "${RABBITMQ_API}/overview" | \
    grep -E '"queue_totals"|"message_stats"' || echo ""

echo ""
echo -e "${GREEN}✓ Setup complete! You can now start your agents.${NC}"
