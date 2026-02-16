# Multi-Agent Orchestration System - Master Guide

**Version:** 2.0.0
**Last Updated:** December 2025
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Docker Setup](#docker-setup)
6. [MCP Server & Tools](#mcp-server--tools)
7. [Demo Scripts](#demo-scripts)
8. [Agent Types & Roles](#agent-types--roles)
9. [Message Flow](#message-flow)
10. [Troubleshooting](#troubleshooting)
11. [Advanced Configuration](#advanced-configuration)
12. [API Reference](#api-reference)

---

## Overview

### What is This?

A **production-ready multi-agent orchestration system** that enables multiple Claude Code instances to communicate, collaborate, and coordinate work through RabbitMQ message queues.

### Key Features

| Feature | Description |
|---------|-------------|
| **Real-time Communication** | Claude instances communicate via RabbitMQ |
| **MCP Integration** | Full Model Context Protocol support |
| **Task Distribution** | Load-balanced task queue system |
| **Brainstorming** | Multi-agent collaborative sessions |
| **Voting System** | Democratic decision making |
| **Live Monitoring** | Real-time queue and connection stats |
| **Auto Demo** | One-command multi-terminal demo |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                         RabbitMQ Broker                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ agent.tasks │  │  brainstorm │  │agent.results│             │
│  │   (queue)   │  │  (fanout)   │  │   (queue)   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
    ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
    │           │    │           │    │           │
┌───▼───┐   ┌───▼───┐         ┌───▼───┐       ┌───▼───┐
│ Team  │   │Worker │         │Worker │       │Monitor│
│Leader │   │ Alpha │         │ Beta  │       │       │
│Claude │   │Claude │         │Claude │       │(Stats)│
└───────┘   └───────┘         └───────┘       └───────┘
```

---

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| **MCP Server** | `scripts/mcp-server.js` | Exposes RabbitMQ tools to Claude Code |
| **RabbitMQ Client** | `scripts/rabbitmq-client.js` | Connection management & messaging |
| **Orchestrator** | `scripts/orchestrator.js` | Agent role management |
| **Demo Launcher** | `scripts/launch-claude-demo.sh` | Auto-opens terminals |
| **Task Sender** | `scripts/send-task.js` | Interactive task sender |

### Queue Architecture

```
Exchanges:
├── agent.brainstorm (fanout) - All agents receive
├── agent.status (topic) - Selective subscription
│
Queues:
├── agent.tasks - Work distribution (load balanced)
├── agent.results - Result collection
├── brainstorm.{agentId} - Per-agent brainstorm queue
└── status.{agentId} - Per-agent status queue
```

---

## Prerequisites

### Required Software

| Software | Minimum Version | Installation |
|----------|----------------|--------------|
| Node.js | 18.0.0+ | `nvm install 18` |
| npm | 9.0.0+ | Comes with Node.js |
| Docker | 24.0.0+ | See [Docker Setup](#docker-setup) |
| Docker Compose | 2.0.0+ | Comes with Docker Desktop |
| Claude Code | Latest | `npm install -g @anthropic-ai/claude-code` |

### Verify Installation

```bash
# Check versions
node --version    # Should be >= 18.0.0
npm --version     # Should be >= 9.0.0
docker --version  # Should be >= 24.0.0
claude --version  # Should show version

# Check Docker is running
docker ps
```

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/umitkacar/project-12-plugin-ai-agent-rabbitmq.git
cd project-12-plugin-ai-agent-rabbitmq

# Install dependencies
npm install
```

### 2. Start Docker Services

```bash
# Start all services (RabbitMQ, PostgreSQL, Redis, etc.)
sudo docker compose up -d

# Verify services are running
sudo docker compose ps
```

### 3. Run the Demo

```bash
# Launch multi-terminal Claude Code demo
./scripts/launch-claude-demo.sh
```

This opens 3 terminals:
- **TEAM LEADER** - Claude Code with team-leader role
- **WORKER** - Claude Code with worker role
- **MONITOR** - Real-time queue statistics

### 4. Test Communication

**In Team Leader terminal, tell Claude:**
```
MCP tool ile team-leader olarak register ol,
sonra worker'a bir görev gönder: README.md dosyasını analiz et
```

**In Worker terminal, tell Claude:**
```
MCP tool ile worker olarak register ol,
sonra bekleyen görevleri kontrol et ve tamamla
```

---

## Docker Setup

### Docker Compose Services

The `docker-compose.yml` provides:

| Service | Port | Purpose |
|---------|------|---------|
| **RabbitMQ** | 5672 (AMQP), 15672 (UI) | Message broker |
| **PostgreSQL** | 5432 | Database |
| **Redis** | 6379 | Caching |
| **Grafana** | 3000 | Monitoring UI |
| **Prometheus** | 9090 | Metrics |

### Start Services

```bash
# Start all services
sudo docker compose up -d

# Check status
sudo docker compose ps

# View logs
sudo docker compose logs -f rabbitmq
```

### Stop Services

```bash
# Stop all services
sudo docker compose down

# Stop and remove volumes (full reset)
sudo docker compose down -v
```

### RabbitMQ Management UI

- **URL:** http://localhost:15672
- **Username:** admin
- **Password:** rabbitmq123

### Docker Permission Fix (Linux)

If you get permission errors:

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Apply changes (logout/login or run)
newgrp docker

# Or use sudo for docker commands
sudo docker compose up -d
```

---

## MCP Server & Tools

### Configuration

The MCP server is configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "rabbitmq-orchestrator": {
      "command": "node",
      "args": ["scripts/mcp-server.js"],
      "env": {
        "RABBITMQ_URL": "amqp://admin:rabbitmq123@localhost:5672"
      }
    }
  }
}
```

### Available MCP Tools

#### Connection & Registration

| Tool | Description | Parameters |
|------|-------------|------------|
| `register_agent` | Register as agent | `role`: team-leader/worker/collaborator/monitor, `name`: optional |
| `get_connection_status` | Check connection | None |
| `disconnect` | Leave system | None |

**Example:**
```
Use register_agent tool with role="team-leader" and name="Main-Orchestrator"
```

#### Task Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `send_task` | Send task to workers | `title`, `description`, `priority`, `context` |
| `get_pending_tasks` | Get pending tasks | `limit`: optional |
| `complete_task` | Mark task complete | `taskId`, `result`, `status` |

**Example - Send Task:**
```
Use send_task with:
- title: "Analyze Code"
- description: "Review the authentication module and suggest improvements"
- priority: "high"
```

**Example - Complete Task:**
```
Use complete_task with:
- taskId: "bb0e000b-a05e-4aac-b7e5-5abaa9fd0045"
- result: "Analysis complete. Found 3 security issues..."
- status: "completed"
```

#### Brainstorming

| Tool | Description | Parameters |
|------|-------------|------------|
| `start_brainstorm` | Start session | `topic`, `question`, `duration` |
| `propose_idea` | Add idea | `sessionId`, `idea`, `reasoning` |
| `get_brainstorm_ideas` | Get ideas | `sessionId`: optional |

**Example:**
```
Use start_brainstorm with:
- topic: "API Design"
- question: "REST vs GraphQL for our use case?"
- duration: 10
```

#### Voting

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_vote` | Create vote | `question`, `options`, `votingMethod` |
| `cast_vote` | Cast vote | `voteId`, `choice`, `confidence` |

#### Communication

| Tool | Description | Parameters |
|------|-------------|------------|
| `broadcast_message` | Broadcast to all | `message`, `type` |
| `get_messages` | Get messages | `type`, `limit`, `since` |

#### Status & Monitoring

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_system_status` | System overview | None |
| `publish_status` | Update status | `status`, `activity` |

---

## Demo Scripts

### 1. Claude Code Demo (`launch-claude-demo.sh`)

Opens 3 terminals with Claude Code instances:

```bash
./scripts/launch-claude-demo.sh
```

**What it does:**
1. Checks Docker/RabbitMQ status
2. Cleans existing queues
3. Opens Team Leader terminal (Claude starts automatically)
4. Opens Worker terminal (Claude starts automatically)
5. Opens Monitor terminal (real-time queue stats)

### 2. Node.js Demo (`launch-demo.sh`)

Opens 5 terminals with Node.js orchestrators:

```bash
./scripts/launch-demo.sh
```

**Terminals:**
- MCP Server
- Team Leader (Node.js orchestrator)
- Worker Alpha
- Worker Beta
- Task Sender (interactive)

### 3. Interactive Task Sender (`send-task.js`)

```bash
node scripts/send-task.js
```

**Commands:**
- `1` - Send single task
- `5` - Send 5 tasks (batch)
- `10` - Send 10 tasks (load test)
- `s` - Show statistics
- `q` - Quit

### 4. tmux Demo (`demo-multi-agent.sh`)

Uses tmux for split-pane view:

```bash
./scripts/demo-multi-agent.sh

# Attach to session
tmux attach -t agent-demo

# Kill session
tmux kill-session -t agent-demo
```

---

## Agent Types & Roles

### Team Leader

**Role:** Coordinates work, assigns tasks, aggregates results

**Capabilities:**
- Assign tasks to worker pool
- Monitor all agent status
- Start brainstorm sessions
- Create votes
- Aggregate results

**Registration:**
```
register_agent with role="team-leader"
```

### Worker

**Role:** Executes tasks from queue

**Capabilities:**
- Consume tasks
- Process work
- Report results
- Participate in brainstorms
- Cast votes

**Registration:**
```
register_agent with role="worker"
```

### Collaborator

**Role:** Brainstorming and collaborative problem-solving

**Capabilities:**
- Listen for brainstorms
- Provide expert input
- Help build consensus
- Can also execute tasks

**Registration:**
```
register_agent with role="collaborator"
```

### Monitor

**Role:** Observability and metrics

**Capabilities:**
- View system status
- Track metrics
- Generate reports
- Monitor health

**Registration:**
```
register_agent with role="monitor"
```

---

## Message Flow

### Task Distribution Flow

```
1. Team Leader calls send_task
   ↓
2. Task published to agent.tasks queue
   ↓
3. Worker(s) consume from queue (load balanced)
   ↓
4. Worker processes task
   ↓
5. Worker calls complete_task
   ↓
6. Result published to agent.results queue
   ↓
7. Team Leader retrieves via get_messages
```

### Brainstorm Flow

```
1. Anyone calls start_brainstorm
   ↓
2. Message broadcast via agent.brainstorm exchange
   ↓
3. All agents receive (fanout)
   ↓
4. Agents call propose_idea
   ↓
5. Ideas collected via get_brainstorm_ideas
```

### Status Flow

```
1. Agent calls publish_status
   ↓
2. Published to agent.status exchange with routing key
   ↓
3. Subscribers receive based on topic pattern
```

---

## Troubleshooting

### Common Issues

#### 1. Cannot Connect to RabbitMQ

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5672
```

**Solutions:**
```bash
# Check if RabbitMQ is running
sudo docker compose ps

# Start RabbitMQ
sudo docker compose up -d rabbitmq

# Check RabbitMQ logs
sudo docker compose logs rabbitmq

# Verify connection
curl -u admin:rabbitmq123 http://localhost:15672/api/overview
```

#### 2. ACCESS_REFUSED (403)

**Symptoms:**
```
ACCESS_REFUSED - Login was refused using authentication mechanism PLAIN
```

**Cause:** Wrong credentials or missing RABBITMQ_URL

**Solution:**
```bash
# Check .env file has correct URL
cat .env | grep RABBITMQ_URL

# Should be:
RABBITMQ_URL=amqp://admin:rabbitmq123@localhost:5672
```

#### 3. PRECONDITION_FAILED (406)

**Symptoms:**
```
PRECONDITION_FAILED - inequivalent arg 'x-message-ttl' for queue 'agent.tasks'
```

**Cause:** Queue created with different options

**Solution:**
```bash
# Delete the queue via API
curl -u admin:rabbitmq123 -X DELETE \
  "http://localhost:15672/api/queues/%2F/agent.tasks"

# Or via Management UI
# Go to http://localhost:15672 > Queues > Delete queue
```

#### 4. Exchange NOT_FOUND (404)

**Symptoms:**
```
NOT_FOUND - no exchange 'agent.status' in vhost '/'
```

**Cause:** Race condition - trying to publish before exchange created

**Solution:** Ensure proper initialization order in code. The fix is in `orchestrator.js` - status publish is deferred until after `setupQueuesAndExchanges()`.

#### 5. Docker Permission Denied

**Symptoms:**
```
permission denied while trying to connect to the Docker daemon socket
```

**Solutions:**
```bash
# Option 1: Use sudo
sudo docker compose up -d

# Option 2: Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Option 3: Fix socket permissions
sudo chmod 666 /var/run/docker.sock
```

#### 6. Tasks Not Being Picked Up

**Check:**
```bash
# 1. Verify workers are connected
curl -u admin:rabbitmq123 http://localhost:15672/api/connections

# 2. Check queue consumers
curl -u admin:rabbitmq123 http://localhost:15672/api/queues/%2F/agent.tasks

# 3. Verify message format matches
# send-task.js must use same format as orchestrator.js expects
```

#### 7. MCP Server Not Loading

**Symptoms:** Tools not available in Claude Code

**Solutions:**
```bash
# 1. Check .mcp.json exists and is valid
cat .mcp.json | python3 -m json.tool

# 2. Verify MCP server starts manually
node scripts/mcp-server.js

# 3. Check Claude Code MCP configuration
# Restart Claude Code to reload MCP servers
```

### Queue Cleanup

```bash
# Delete all queues (clean slate)
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.tasks"
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.results"

# Or restart RabbitMQ (clears all queues)
sudo docker compose restart rabbitmq
```

### Health Check Commands

```bash
# RabbitMQ status
curl -s -u admin:rabbitmq123 http://localhost:15672/api/overview | python3 -m json.tool

# List queues
curl -s -u admin:rabbitmq123 http://localhost:15672/api/queues | python3 -c "
import sys, json
for q in json.load(sys.stdin):
    print(f\"{q['name']}: {q['messages']} msgs, {q['consumers']} consumers\")
"

# List connections
curl -s -u admin:rabbitmq123 http://localhost:15672/api/connections | python3 -c "
import sys, json
conns = json.load(sys.stdin)
print(f'Active connections: {len(conns)}')
"
```

---

## Advanced Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RABBITMQ_URL` | `amqp://localhost:5672` | Full connection URL |
| `RABBITMQ_HOST` | `localhost` | RabbitMQ host |
| `RABBITMQ_PORT` | `5672` | RabbitMQ AMQP port |
| `RABBITMQ_USER` | `admin` | Username |
| `RABBITMQ_PASSWORD` | `rabbitmq123` | Password |
| `AGENT_ID` | Auto-generated | Unique agent identifier |
| `AGENT_NAME` | Auto-generated | Human-readable name |
| `AGENT_TYPE` | `worker` | Default agent type |
| `HEARTBEAT_INTERVAL` | `30000` | Heartbeat in ms |
| `PREFETCH_COUNT` | `1` | Messages per consumer |

### Custom Agent Configuration

```bash
# Start with custom name
AGENT_NAME="Backend-Expert" node scripts/orchestrator.js worker

# Start with specific ID
AGENT_ID="worker-backend-001" node scripts/orchestrator.js worker

# Full custom config
AGENT_ID="specialist-001" \
AGENT_NAME="Database-Specialist" \
AGENT_TYPE="worker" \
node scripts/orchestrator.js
```

### Queue Options

Default queue configuration in `rabbitmq-client.js`:

```javascript
// Task queue options
{
  durable: true,
  arguments: {
    'x-message-ttl': 3600000,  // 1 hour TTL
    'x-max-length': 10000      // Max 10k messages
  }
}

// Result queue options
{
  durable: true
}
```

---

## API Reference

### RabbitMQClient Class

```javascript
import { RabbitMQClient } from './scripts/rabbitmq-client.js';

const client = new RabbitMQClient({
  url: 'amqp://admin:rabbitmq123@localhost:5672',
  heartbeat: 30,
  prefetchCount: 1
});

// Connect
await client.connect();

// Setup queues
await client.setupTaskQueue('agent.tasks');
await client.setupResultQueue('agent.results');
await client.setupStatusExchange('agent.status');
await client.setupBrainstormExchange('agent.brainstorm');

// Publish task
const taskId = await client.publishTask({
  title: 'My Task',
  description: 'Do something',
  priority: 'high'
});

// Consume tasks
await client.consumeTasks('agent.tasks', async (msg, { ack, nack }) => {
  console.log('Received:', msg);
  ack();
});

// Publish result
await client.publishResult({
  taskId: 'xxx',
  result: 'Done!',
  status: 'completed'
});

// Close connection
await client.close();
```

### AgentOrchestrator Class

```javascript
import AgentOrchestrator from './scripts/orchestrator.js';

// Create orchestrator
const orchestrator = new AgentOrchestrator('worker');

// Initialize
await orchestrator.initialize();

// Start as specific role
await orchestrator.startWorker();
// or
await orchestrator.startTeamLeader();
// or
await orchestrator.startCollaborator();

// Assign task (team leader)
const taskId = await orchestrator.assignTask({
  title: 'Review Code',
  description: 'Review PR #123',
  priority: 'high'
});

// Initiate brainstorm
const sessionId = await orchestrator.initiateBrainstorm({
  topic: 'Architecture',
  question: 'Microservices vs Monolith?'
});

// Get stats
const stats = orchestrator.getStats();

// Shutdown
await orchestrator.shutdown();
```

---

## Best Practices

### 1. Agent Naming

Use descriptive names for easier debugging:
```bash
AGENT_NAME="Backend-Worker-1" node scripts/orchestrator.js worker
AGENT_NAME="Frontend-Worker-1" node scripts/orchestrator.js worker
AGENT_NAME="Main-Orchestrator" node scripts/orchestrator.js team-leader
```

### 2. Task Priority

Use priorities appropriately:
- `critical` - Production issues
- `high` - Important features
- `normal` - Regular work
- `low` - Nice-to-have

### 3. Error Handling

Always handle task failures:
```javascript
try {
  // Process task
  await processTask(task);
  ack();
} catch (error) {
  if (task.retryCount > 0) {
    task.retryCount--;
    nack(true);  // Requeue
  } else {
    reject();    // Dead letter
  }
}
```

### 4. Monitoring

Always run a monitor in production:
```bash
# Dedicated monitor terminal
node scripts/orchestrator.js monitor
```

### 5. Resource Cleanup

Clean up when done:
```javascript
process.on('SIGINT', async () => {
  await orchestrator.shutdown();
  process.exit(0);
});
```

---

## Quick Reference Card

### Start Everything
```bash
sudo docker compose up -d
./scripts/launch-claude-demo.sh
```

### Stop Everything
```bash
sudo docker compose down
```

### Check Status
```bash
curl -u admin:rabbitmq123 http://localhost:15672/api/overview
```

### Clean Queues
```bash
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.tasks"
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.results"
```

### MCP Tools Quick Reference
```
register_agent    → Join as team-leader/worker/collaborator/monitor
send_task         → Send task to workers
get_pending_tasks → Check pending tasks
complete_task     → Mark task done
get_messages      → Get results
start_brainstorm  → Start brainstorm
get_system_status → System overview
```

---

## Support

- **Issues:** https://github.com/umitkacar/project-12-plugin-ai-agent-rabbitmq/issues
- **Documentation:** `/docs` directory
- **Examples:** `/examples` directory

---

*Built for the Claude Code community*
