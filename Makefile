.PHONY: help docker-up docker-down docker-restart docker-logs docker-clean docker-rebuild health setup test

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

##@ Docker Environment

docker-up: ## Start Docker development environment
	@echo "$(BLUE)Starting development environment...$(NC)"
	@./scripts/start-dev.sh -d

docker-up-prod: ## Start Docker production environment
	@echo "$(BLUE)Starting production environment...$(NC)"
	@./scripts/start-dev.sh --prod -d

docker-down: ## Stop Docker environment
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	@docker-compose down

docker-clean: ## Stop and remove all volumes (DESTRUCTIVE)
	@echo "$(YELLOW)Cleaning environment (removing volumes)...$(NC)"
	@./scripts/stop-dev.sh --volumes

docker-clean-all: ## Remove everything including images (DESTRUCTIVE)
	@echo "$(YELLOW)Complete cleanup (removing everything)...$(NC)"
	@./scripts/stop-dev.sh --clean-all

docker-restart: ## Restart all Docker services
	@echo "$(BLUE)Restarting services...$(NC)"
	@docker-compose restart

docker-rebuild: ## Rebuild and restart Docker environment
	@echo "$(BLUE)Rebuilding environment...$(NC)"
	@./scripts/start-dev.sh --rebuild -d

docker-logs: ## Show logs from all services
	@docker-compose logs -f

docker-logs-rabbitmq: ## Show RabbitMQ logs
	@docker-compose logs -f rabbitmq

docker-logs-postgres: ## Show PostgreSQL logs
	@docker-compose logs -f postgres

docker-logs-redis: ## Show Redis logs
	@docker-compose logs -f redis

docker-ps: ## Show status of all containers
	@docker-compose ps

health: ## Run health check on all services
	@./scripts/health-check.sh

##@ Setup & Configuration

setup: ## Run all setup scripts
	@echo "$(BLUE)Running setup scripts...$(NC)"
	@./scripts/setup-rabbitmq.sh
	@./scripts/setup-database.sh

setup-rabbitmq: ## Initialize RabbitMQ exchanges and queues
	@echo "$(BLUE)Setting up RabbitMQ...$(NC)"
	@./scripts/setup-rabbitmq.sh

setup-database: ## Initialize PostgreSQL database
	@echo "$(BLUE)Setting up database...$(NC)"
	@./scripts/setup-database.sh

env: ## Create .env file from template
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN).env file created from template$(NC)"; \
	else \
		echo "$(YELLOW).env file already exists$(NC)"; \
	fi

##@ Database Operations

db-connect: ## Connect to PostgreSQL database
	@docker exec -it ai-agent-postgres psql -U aiagent -d ai_orchestrator

db-backup: ## Backup PostgreSQL database
	@mkdir -p backups
	@docker exec ai-agent-postgres pg_dump -U aiagent ai_orchestrator > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Database backed up to backups/$(NC)"

db-restore: ## Restore PostgreSQL database (requires BACKUP_FILE=path/to/backup.sql)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(YELLOW)Usage: make db-restore BACKUP_FILE=path/to/backup.sql$(NC)"; \
		exit 1; \
	fi
	@docker exec -i ai-agent-postgres psql -U aiagent -d ai_orchestrator < $(BACKUP_FILE)
	@echo "$(GREEN)Database restored$(NC)"

db-reset: ## Reset database (DESTRUCTIVE)
	@echo "$(YELLOW)Resetting database...$(NC)"
	@docker-compose stop postgres
	@docker volume rm ai-agent-postgres-data || true
	@docker-compose up -d postgres
	@sleep 5
	@./scripts/setup-database.sh

##@ RabbitMQ Operations

rabbitmq-cli: ## Access RabbitMQ CLI
	@docker exec -it ai-agent-rabbitmq rabbitmqctl

rabbitmq-queues: ## List all RabbitMQ queues
	@docker exec ai-agent-rabbitmq rabbitmqctl list_queues

rabbitmq-exchanges: ## List all RabbitMQ exchanges
	@docker exec ai-agent-rabbitmq rabbitmqctl list_exchanges

rabbitmq-connections: ## List all RabbitMQ connections
	@docker exec ai-agent-rabbitmq rabbitmqctl list_connections

rabbitmq-purge-all: ## Purge all messages from all queues (DESTRUCTIVE)
	@echo "$(YELLOW)Purging all queues...$(NC)"
	@docker exec ai-agent-rabbitmq rabbitmqctl purge_queue agent.tasks.high || true
	@docker exec ai-agent-rabbitmq rabbitmqctl purge_queue agent.tasks.normal || true
	@docker exec ai-agent-rabbitmq rabbitmqctl purge_queue agent.tasks.low || true
	@docker exec ai-agent-rabbitmq rabbitmqctl purge_queue agent.results || true
	@docker exec ai-agent-rabbitmq rabbitmqctl purge_queue agent.brainstorm.responses || true
	@docker exec ai-agent-rabbitmq rabbitmqctl purge_queue agent.status.updates || true
	@echo "$(GREEN)All queues purged$(NC)"

rabbitmq-reset: ## Reset RabbitMQ (DESTRUCTIVE)
	@echo "$(YELLOW)Resetting RabbitMQ...$(NC)"
	@docker-compose stop rabbitmq
	@docker volume rm ai-agent-rabbitmq-data || true
	@docker volume rm ai-agent-rabbitmq-logs || true
	@docker-compose up -d rabbitmq
	@sleep 10
	@./scripts/setup-rabbitmq.sh

##@ Redis Operations

redis-cli: ## Access Redis CLI
	@docker exec -it ai-agent-redis redis-cli -a redis123

redis-monitor: ## Monitor Redis commands in real-time
	@docker exec ai-agent-redis redis-cli -a redis123 MONITOR

redis-info: ## Show Redis information
	@docker exec ai-agent-redis redis-cli -a redis123 INFO

redis-keys: ## List all Redis keys
	@docker exec ai-agent-redis redis-cli -a redis123 KEYS '*'

redis-flush: ## Flush all Redis data (DESTRUCTIVE)
	@echo "$(YELLOW)Flushing Redis...$(NC)"
	@docker exec ai-agent-redis redis-cli -a redis123 FLUSHALL
	@echo "$(GREEN)Redis flushed$(NC)"

redis-reset: ## Reset Redis (DESTRUCTIVE)
	@echo "$(YELLOW)Resetting Redis...$(NC)"
	@docker-compose stop redis
	@docker volume rm ai-agent-redis-data || true
	@docker-compose up -d redis
	@echo "$(GREEN)Redis reset$(NC)"

##@ Application

install: ## Install Node.js dependencies
	@npm install

test: ## Run all tests
	@npm test

test-unit: ## Run unit tests
	@npm run test:unit

test-integration: ## Run integration tests
	@npm run test:integration

test-e2e: ## Run end-to-end tests
	@npm run test:e2e

start: ## Start the orchestrator
	@npm start

monitor: ## Start the monitoring dashboard
	@npm run monitor

##@ URLs & Access

urls: ## Display all service URLs
	@echo "$(BLUE)=====================================$(NC)"
	@echo "$(BLUE)  Service URLs                      $(NC)"
	@echo "$(BLUE)=====================================$(NC)"
	@echo ""
	@echo "$(GREEN)RabbitMQ Management:$(NC) http://localhost:15672"
	@echo "  Username: admin"
	@echo "  Password: admin123"
	@echo ""
	@echo "$(GREEN)PostgreSQL:$(NC) postgresql://localhost:5432/ai_orchestrator"
	@echo "  Username: aiagent"
	@echo "  Password: aiagent123"
	@echo ""
	@echo "$(GREEN)Redis:$(NC) redis://localhost:6379"
	@echo "  Password: redis123"
	@echo ""
	@echo "$(GREEN)Adminer (DB UI):$(NC) http://localhost:8080"
	@echo "$(GREEN)PgAdmin:$(NC) http://localhost:5050"
	@echo "$(GREEN)Redis Commander:$(NC) http://localhost:8081"
	@echo ""

open-rabbitmq: ## Open RabbitMQ Management UI in browser
	@open http://localhost:15672 2>/dev/null || xdg-open http://localhost:15672 2>/dev/null || echo "Open http://localhost:15672"

open-adminer: ## Open Adminer in browser
	@open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null || echo "Open http://localhost:8080"

open-pgadmin: ## Open PgAdmin in browser
	@open http://localhost:5050 2>/dev/null || xdg-open http://localhost:5050 2>/dev/null || echo "Open http://localhost:5050"

open-redis: ## Open Redis Commander in browser
	@open http://localhost:8081 2>/dev/null || xdg-open http://localhost:8081 2>/dev/null || echo "Open http://localhost:8081"

##@ Help

help: ## Display this help
	@echo "$(BLUE)AI Agent Orchestrator - Makefile Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(BLUE)Quick Start:$(NC)"
	@echo "  1. make env              # Create .env file"
	@echo "  2. make docker-up        # Start all services"
	@echo "  3. make health           # Verify everything is running"
	@echo "  4. make urls             # View all service URLs"
	@echo ""
