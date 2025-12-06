# 🧠 Claude Collective Intelligence

### AI Agent Swarm Framework for Claude Code

**Transform isolated Claude Code sessions into a collaborative AI collective** via RabbitMQ message queues. Brainstorming, democratic voting, mentorship acceleration, competitive battles, and gamification - achieving emergent intelligence greater than any single agent.

> *"Collective Intelligence: When multiple Claude instances collaborate through brainstorming, voting, and mentorship, the whole becomes exponentially greater than the sum of its parts."*

## 🎯 8 AI Mechanisms

| Mechanism | Description |
|-----------|-------------|
| 🧠 **Brainstorm** | Multi-agent idea generation & combination |
| 🗳️ **Voting** | 5 algorithms (Simple, Confidence, Quadratic, Consensus, Ranked) |
| 🎁 **Rewards** | Gamification with tiers (Bronze → Silver → Gold → Platinum) |
| ⚠️ **Penalties** | 6 progressive levels + retraining curriculum |
| 🎓 **Mentorship** | 10x training acceleration (30 days → 3 days) |
| ⚔️ **Battle** | 1v1 duels, Speed Race, Leaderboards, Hall of Fame |
| 📊 **Leaderboard** | ELO ratings, rankings, performance tracking |
| 🎭 **Orchestrator** | Task distribution, agent coordination |

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-%3E%3D3.12.0-orange)](https://www.rabbitmq.com/)

## 🎯 The Problem

Claude Code sessions are **isolated** - they can't communicate with each other. Even with git worktree, there's:
- ❌ No task queuing
- ❌ No agent communication
- ❌ No work distribution
- ❌ No collaborative decision-making
- ❌ No result aggregation

You wanted a **microservices-style orchestration** where multiple Claude sessions work together like a real team!

## ✨ The Solution

This plugin transforms isolated Claude sessions into an **orchestrated AI team** using RabbitMQ:

- ✅ **Multi-terminal orchestration** - 5 terminals, 5 agents, one team
- ✅ **Task distribution** - Team leader assigns work to worker pool
- ✅ **Real-time communication** - Agents message each other via RabbitMQ
- ✅ **Collaborative brainstorming** - Multiple agents discuss and decide together
- ✅ **Result aggregation** - Team leader collects and synthesizes outputs
- ✅ **Failure handling** - Automatic retry, reassignment, dead-letter queues
- ✅ **Git worktree compatible** - Perfect for parallel development
- ✅ **Always active** - Hooks keep system running continuously

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      RabbitMQ Broker                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Task Queue  │  │ Brainstorm  │  │ Result Queue│         │
│  │             │  │  Exchange   │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
         ▲                  ▲                  ▲
         │                  │                  │
    ┌────┴────┬─────────────┴──────────┬──────┴────┐
    │         │                        │           │
┌───▼───┐ ┌──▼────┐ ┌────────┐  ┌─────▼──┐  ┌────▼────┐
│Leader │ │Worker │ │Worker  │  │Collab  │  │Monitor  │
│Term 1 │ │Term 2 │ │Term 3  │  │Term 4  │  │Term 5   │
└───────┘ └───────┘ └────────┘  └────────┘  └─────────┘
```

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install dependencies
npm install

# Start all services (RabbitMQ, PostgreSQL, Redis, etc.)
sudo docker compose up -d

# Verify RabbitMQ is running
curl http://localhost:15672
# Login: admin / rabbitmq123
```

### 1b. Quick Demo (Recommended!)

```bash
# Launch multi-terminal Claude Code demo
./scripts/launch-claude-demo.sh
```

This opens 3 terminals with Claude Code instances that communicate via RabbitMQ!

### 2. Basic 3-Terminal Setup

**Terminal 1 - Team Leader:**
```bash
cd ~/plugin-ai-agent-rabbitmq
node scripts/orchestrator.js team-leader
```

**Terminal 2 - Worker:**
```bash
cd ~/plugin-ai-agent-rabbitmq
node scripts/orchestrator.js worker
```

**Terminal 3 - Worker:**
```bash
cd ~/plugin-ai-agent-rabbitmq
node scripts/orchestrator.js worker
```

### 3. Assign Your First Task

In Terminal 1 (Team Leader):
```javascript
// Task will be automatically picked up by Terminal 2 or 3
await orchestrator.assignTask({
  title: "Implement authentication",
  description: "Create JWT-based auth with refresh tokens",
  priority: "high"
});
```

**That's it!** Workers automatically process tasks and report results! 🎉

## 📚 Full 5-Terminal Scenario

See [examples/5-terminal-scenario.md](examples/5-terminal-scenario.md) for the complete scenario including:

- Team leader assigning work
- Workers picking up tasks
- Collaborative brainstorming between agents
- Result aggregation
- Failure handling and task reassignment

## 🎭 Agent Types

### 1. Team Leader
**Role:** Orchestrates work, assigns tasks, aggregates results

```bash
node scripts/orchestrator.js team-leader
```

**Capabilities:**
- Assign tasks to worker pool
- Monitor all agent status
- Aggregate results from workers
- Make final decisions
- Handle task failures and reassignments

### 2. Worker
**Role:** Executes tasks from queue

```bash
node scripts/orchestrator.js worker
```

**Capabilities:**
- Consume tasks from queue
- Process work independently
- Report results
- Participate in brainstorms

### 3. Collaborator
**Role:** Brainstorming and collaborative problem-solving

```bash
node scripts/orchestrator.js collaborator
```

**Capabilities:**
- Listen for brainstorm requests
- Provide expert input
- Help build consensus
- Can also execute tasks

### 4. Coordinator
**Role:** Manage complex workflows with dependencies

```bash
node scripts/orchestrator.js coordinator
```

**Capabilities:**
- Orchestrate multi-step workflows
- Handle task dependencies (A → B → C)
- Coordinate parallel execution
- Manage state and checkpoints

### 5. Monitor
**Role:** Real-time observability

```bash
node scripts/orchestrator.js monitor
```

**Capabilities:**
- Display real-time dashboard
- Track agent health
- Monitor queue metrics
- Generate alerts

## 🔧 Claude Code Plugin Usage

### Install Plugin

```bash
# Clone to your Claude Code plugins directory
git clone https://github.com/umitkacar/claude-collective-intelligence.git \
  ~/.claude-code/plugins/claude-collective-intelligence

# Or use locally
# In Claude Code, load from ./claude-collective-intelligence
```

### Slash Commands

#### `/orchestrate [type]`
Start an agent as part of the orchestration system.

```bash
/orchestrate team-leader
/orchestrate worker
/orchestrate collaborator
/orchestrate monitor
```

#### `/assign-task`
Assign work to the worker pool.

```bash
/assign-task title="Implement feature X" priority=high
```

#### `/brainstorm`
Initiate collaborative brainstorming.

```bash
/brainstorm topic="API Design" question="REST vs GraphQL?"
```

#### `/status`
View system status and metrics.

```bash
/status
/status agents
/status queues
/status performance
```

#### `/join-team [role]`
Quick command to join the team.

```bash
/join-team worker
/join-team leader
```

## 🧠 Agent Skills

The plugin includes 5 specialized skills:

### 1. RabbitMQ Operations
Manage connections, queues, exchanges, and messaging.

```javascript
import { RabbitMQClient } from './scripts/rabbitmq-client.js';
```

### 2. Task Distribution
Distribute work with load balancing and priority queues.

```javascript
await orchestrator.assignTask({...});
```

### 3. Collaboration
Multi-agent brainstorming and consensus building.

```javascript
await orchestrator.initiateBrainstorm({...});
```

### 4. Result Aggregation
Collect and synthesize results from multiple agents.

```javascript
const results = await collectAllResults(taskIds);
```

### 5. Health Monitoring
Track metrics, detect anomalies, generate alerts.

```javascript
const dashboard = new MonitorDashboard();
```

## 🌳 Git Worktree Integration

Perfect for parallel development on the same repo:

```bash
# Main repo - Terminal 1 (Team Leader)
cd ~/my-project
/orchestrate team-leader

# Worktree 1 - Terminal 2 (Worker)
git worktree add ../my-project-worker1 feature-branch
cd ../my-project-worker1
/orchestrate worker

# Worktree 2 - Terminal 3 (Worker)
git worktree add ../my-project-worker2 feature-branch
cd ../my-project-worker2
/orchestrate worker

# All agents work independently but communicate via RabbitMQ!
```

## 🔄 Message Flow

### Task Distribution
```
Team Leader → agent.tasks queue → Worker 1, 2, 3 (load balanced)
```

### Brainstorming
```
Worker → agent.brainstorm exchange (fanout) → All Collaborators
Collaborators → agent.results queue → Worker (aggregate)
```

### Status Updates
```
All Agents → agent.status exchange (topic) → Subscribers
```

## 📊 Real-Time Monitoring

Start a monitor agent to see everything in real-time:

```bash
node scripts/orchestrator.js monitor
```

**Dashboard shows:**
- Connected agents and their status
- Task queue depth and consumers
- Active tasks and completion rate
- Performance metrics (duration, throughput)
- Active alerts and issues

## 🎯 Use Cases

### 1. Distributed Code Review
```bash
# Terminal 1 - Assign reviews
/assign-task title="Review PR #123"
/assign-task title="Review PR #124"
/assign-task title="Review PR #125"

# Terminals 2,3,4 - Process reviews in parallel
# Terminal 1 - Aggregate feedback
```

### 2. Parallel Feature Development
```bash
# Assign feature components
/assign-task title="Backend API" specialty="backend"
/assign-task title="Frontend UI" specialty="frontend"
/assign-task title="Database schema" specialty="database"
/assign-task title="Tests" specialty="testing"

# 4 workers handle in parallel!
```

### 3. Collaborative Architecture Design
```bash
/assign-task title="Design system architecture" \
  collaboration=true \
  question="Microservices vs Monolith?"

# Worker initiates brainstorm
# Multiple collaborators provide input
# Worker synthesizes and decides
```

### 4. Continuous Integration
```bash
# CI pipeline runs workers
# Workers pick up: test, build, deploy tasks
# Monitor tracks progress
# Leader aggregates results
```

## 🛠️ Configuration

### Environment Variables

Create `.env` file:

```bash
# RabbitMQ Connection
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672

# Agent Configuration
AGENT_ID=agent-${RANDOM}
AGENT_TYPE=worker
AGENT_NAME=My-Worker

# Queue Configuration
TASK_QUEUE=agent.tasks
BRAINSTORM_EXCHANGE=agent.brainstorm
RESULT_QUEUE=agent.results

# Monitoring
HEARTBEAT_INTERVAL=30000
HEALTH_CHECK_INTERVAL=10000
```

### Custom Agent Names

```bash
AGENT_NAME="Backend Specialist" node scripts/orchestrator.js worker
AGENT_NAME="Frontend Expert" node scripts/orchestrator.js collaborator
```

## 📖 Documentation

- **[MASTER-GUIDE.md](docs/MASTER-GUIDE.md)** - Complete system documentation
- [Quick Start](docs/guides/QUICK-START.md) - 5-minute setup guide
- [Troubleshooting](docs/guides/TROUBLESHOOTING.md) - Problem solving
- [MCP Server Guide](docs/architecture/MCP-SERVER-GUIDE.md) - MCP tools reference
- [Architecture](docs/architecture/ARCHITECTURE.md) - System design

## 🔌 MCP Tools (Claude Code Integration)

When using Claude Code in this project, these MCP tools are available:

| Tool | Description |
|------|-------------|
| `register_agent` | Register as team-leader/worker/collaborator/monitor |
| `send_task` | Send task to worker queue |
| `get_pending_tasks` | Get tasks waiting to be processed |
| `complete_task` | Mark task as done with result |
| `start_brainstorm` | Start collaborative brainstorm |
| `propose_idea` | Add idea to brainstorm |
| `create_vote` | Create voting session |
| `cast_vote` | Vote on decision |
| `get_messages` | Get received messages/results |
| `get_system_status` | System overview |

**Example Usage:**
```
# In Claude Code, tell it:
"MCP tool ile team-leader olarak register ol, sonra worker'a görev gönder"
```

## 🚀 Advanced Features

### Priority Queues
```javascript
await assignTask({ title: "Critical bug", priority: "critical" });
await assignTask({ title: "New feature", priority: "normal" });
// Critical tasks processed first
```

### Task Retries
```javascript
await assignTask({
  title: "Deploy to production",
  retryCount: 3,
  retryDelay: 5000
});
// Retries 3 times with 5s delay
```

### Workflow Coordination
```javascript
// Sequential workflow with dependencies
/workflow-execute <<EOF
{
  "steps": [
    {"id": "test", "tasks": ["unit-tests", "integration-tests"]},
    {"id": "build", "dependsOn": ["test"], "tasks": ["build"]},
    {"id": "deploy", "dependsOn": ["build"], "tasks": ["deploy"]}
  ]
}
EOF
```

### Keep Active (No Sleep)
```bash
# Continuous heartbeat to keep agent active
while true; do
  node scripts/hooks/health-check.js
  sleep 30
done &

# Start orchestrator
node scripts/orchestrator.js worker
```

## 🔍 Troubleshooting

### Cannot connect to RabbitMQ
```bash
# Check RabbitMQ is running
docker ps | grep rabbitmq

# Start RabbitMQ
docker start rabbitmq

# Check connection
telnet localhost 5672
```

### Tasks not being picked up
```bash
# Check workers are connected
/status agents

# Check queue depth
/status queues

# Start more workers if needed
node scripts/orchestrator.js worker
```

### High queue depth
```bash
# Solution: Start more workers
# Terminal 4,5,6...
node scripts/orchestrator.js worker
```

## 🤝 Contributing

This is an ultra-powerful orchestration system! Contributions welcome:

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test with multi-terminal setup
5. Submit pull request

## 📝 License

Proprietary License - Copyright (c) 2025 Dr. Umit Kacar - see [LICENSE](LICENSE) file

## 🌟 Features Summary

| Feature | Status |
|---------|--------|
| Multi-terminal orchestration | ✅ Complete |
| Task distribution & load balancing | ✅ Complete |
| Agent-to-agent communication | ✅ Complete |
| Collaborative brainstorming | ✅ Complete |
| Result aggregation | ✅ Complete |
| Failure handling & retry | ✅ Complete |
| Priority queues | ✅ Complete |
| Workflow coordination | ✅ Complete |
| Real-time monitoring | ✅ Complete |
| Git worktree integration | ✅ Complete |
| Persistent messaging | ✅ Complete |
| Health monitoring | ✅ Complete |
| Auto-reconnection | ✅ Complete |

## 💡 What Makes This ULTRA?

1. **True Microservices**: Each Claude session = independent service
2. **Real Communication**: Not just shared files, actual messaging
3. **Load Balancing**: Fair work distribution across workers
4. **Fault Tolerance**: Retries, dead-letter queues, circuit breakers
5. **Observability**: Real-time monitoring and metrics
6. **Scalability**: Add more workers anytime
7. **Collaboration**: Agents actually discuss and decide together
8. **Production-Ready**: Persistent queues, health checks, alerts

## 🎉 Get Started Now!

```bash
# 1. Clone
git clone https://github.com/umitkacar/claude-collective-intelligence.git
cd claude-collective-intelligence

# 2. Install
npm install

# 3. Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# 4. Run your first orchestration!
node scripts/orchestrator.js team-leader &
node scripts/orchestrator.js worker &
node scripts/orchestrator.js worker &

# 5. Watch the magic happen! 🚀
```

---

**Built with** 💙 **for the Claude Code community**

**Questions?** Open an issue!
**Ideas?** Open a discussion!
**Success story?** We'd love to hear it!

🚀 **Transform your Claude Code sessions into an orchestrated AI team today!**
