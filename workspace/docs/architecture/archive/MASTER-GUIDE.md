# AI Agent Orchestrator - MASTER GUIDE

**The Complete Reference for Multi-Agent Orchestration with RabbitMQ**

Version: 1.0.0
Last Updated: 2025-11-17

---

## Table of Contents

1. [Complete System Overview](#complete-system-overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [Quick Start Tutorial](#quick-start-tutorial)
5. [Advanced Tutorials](#advanced-tutorials)
6. [Core Concepts & Patterns](#core-concepts--patterns)
7. [Complete Feature Reference](#complete-feature-reference)
8. [Real-World Use Cases](#real-world-use-cases)
9. [Monitoring & Operations](#monitoring--operations)
10. [Troubleshooting](#troubleshooting)
11. [API Reference](#api-reference)
12. [Configuration Guide](#configuration-guide)
13. [Best Practices](#best-practices)
14. [Performance Tuning](#performance-tuning)
15. [Security](#security)
16. [Appendix](#appendix)

---

## Complete System Overview

### What Is This?

The **AI Agent Orchestrator** is an ultra-advanced multi-agent orchestration system that transforms independent Claude Code sessions into a **collaborative AI team** through RabbitMQ message queues.

### The Problem It Solves

Traditional Claude Code sessions are isolated:
- **No communication** between sessions
- **No work distribution** across terminals
- **No collaborative decision-making**
- **No result aggregation** from parallel work
- **No failure recovery** when tasks fail

Even with `git worktree`, you still can't coordinate work between Claude Code instances effectively.

### The Solution

This plugin enables:
- **Multi-terminal orchestration** - 5+ terminals working as one team
- **Task distribution** - Queue-based work assignment with load balancing
- **Real-time communication** - Agents message each other via RabbitMQ
- **Collaborative brainstorming** - Multiple agents discuss and decide together
- **Result aggregation** - Team leader collects and synthesizes outputs
- **Failure handling** - Automatic retry, reassignment, dead-letter queues
- **Git worktree compatible** - Perfect for parallel development
- **Always active** - Hooks keep system running continuously

### Why It Exists

Because you wanted a **microservices-style orchestration** where multiple Claude sessions work together like a real distributed team!

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Parallel Execution** | Multiple agents work simultaneously |
| **Load Balancing** | Fair work distribution across workers |
| **Fault Tolerance** | Automatic retry and failure recovery |
| **Scalability** | Add workers anytime to increase capacity |
| **Observability** | Real-time monitoring and metrics |
| **Collaboration** | Agents discuss complex problems together |
| **Production-Ready** | Persistent queues, health checks, alerts |
| **Git Integration** | Works seamlessly with worktrees |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RabbitMQ Broker                              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Task Queue   │  │ Brainstorm   │  │ Result Queue │              │
│  │ (Work Pool)  │  │  Exchange    │  │ (Aggregation)│              │
│  │              │  │  (Fanout)    │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │ Status       │  │ DLX (Failed  │                                │
│  │  Exchange    │  │   Messages)  │                                │
│  │  (Topic)     │  │              │                                │
│  └──────────────┘  └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
         ▲                  ▲                  ▲
         │                  │                  │
    ┌────┴────┬─────────────┴──────────┬──────┴────┐
    │         │                        │           │
┌───▼───┐ ┌──▼────┐ ┌────────┐  ┌─────▼──┐  ┌────▼────┐
│Leader │ │Worker │ │Worker  │  │Collab  │  │Monitor  │
│Term 1 │ │Term 2 │ │Term 3  │  │Term 4  │  │Term 5   │
│       │ │       │ │        │  │        │  │         │
│Assign │ │Execute│ │Execute │  │Analyze │  │Observe  │
│Agg    │ │Report │ │Report  │  │Suggest │  │Alert    │
└───────┘ └───────┘ └────────┘  └────────┘  └─────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code Plugin                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Agent Orchestrator                       │   │
│  │  - Task Assignment                                    │   │
│  │  - Status Tracking                                    │   │
│  │  - Result Aggregation                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              RabbitMQ Client                          │   │
│  │  - Connection Management                              │   │
│  │  - Queue Operations                                   │   │
│  │  - Message Routing                                    │   │
│  │  - Auto-Reconnection                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Skills & Hooks                           │   │
│  │  - Task Distribution                                  │   │
│  │  - Collaboration                                      │   │
│  │  - Health Monitoring                                  │   │
│  │  - Result Aggregation                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
           ┌─────────────────────────────────┐
           │        RabbitMQ Server           │
           │     amqp://localhost:5672        │
           └─────────────────────────────────┘
```

### Message Flow Diagrams

#### Task Distribution Flow

```
Team Leader                RabbitMQ              Worker Pool
    │                         │                      │
    │──── assignTask() ────→  │                      │
    │                         │                      │
    │                      [Queue]                   │
    │                         │                      │
    │                         │ ←──── consume() ──── Worker 1
    │                         │                      │
    │                         │ ─── task msg ───→   Worker 1
    │                         │                      │
    │                         │                  [Processing]
    │                         │                      │
    │                      [Result Queue]            │
    │                         │                      │
    │                         │ ←──── result ─────── Worker 1
    │                         │                      │
    │ ←─── consumeResult() ── │                      │
    │                         │                      │
    │     [Aggregation]       │                      │
```

#### Brainstorm Flow

```
Worker                 Brainstorm Exchange        Collaborators
  │                           │                        │
  │── broadcastBrainstorm()→  │                        │
  │                           │                        │
  │                    [Fanout Exchange]               │
  │                           │                        │
  │                           │ ──────→ Queue 1 ───→ Collab 1
  │                           │ ──────→ Queue 2 ───→ Collab 2
  │                           │ ──────→ Queue 3 ───→ Collab 3
  │                           │                        │
  │                           │                   [Analysis]
  │                           │                        │
  │                      [Result Queue]                │
  │                           │                        │
  │                           │ ←────── response ──── Collab 1
  │                           │ ←────── response ──── Collab 2
  │                           │ ←────── response ──── Collab 3
  │                           │                        │
  │ ←── consumeResults() ───  │                        │
  │                           │                        │
  │    [Synthesize]           │                        │
```

#### Status Update Flow

```
All Agents            Status Exchange          Monitor Agent
    │                       │                      │
    │── publishStatus() ──→ │                      │
    │                       │                      │
    │                  [Topic Exchange]            │
    │                       │                      │
    │           (routing: agent.status.*)          │
    │                       │                      │
    │                       │ ── subscribe('#') ──→ Monitor
    │                       │                      │
    │                       │                   [Display]
```

### Data Model

#### Task Message Structure

```javascript
{
  id: "uuid",
  type: "task",
  from: "agent-team-leader-123",
  timestamp: 1700000000000,
  task: {
    title: "Implement authentication",
    description: "JWT-based auth with refresh tokens",
    priority: "high",              // critical, high, normal, low
    assignedBy: "agent-leader-123",
    assignedAt: 1700000000000,
    context: {
      framework: "Express.js",
      database: "PostgreSQL"
    },
    requiresCollaboration: false,
    collaborationQuestion: "",
    retryCount: 3,
    retryDelay: 5000
  }
}
```

#### Result Message Structure

```javascript
{
  id: "uuid",
  type: "result",
  from: "agent-worker-456",
  timestamp: 1700000000000,
  result: {
    taskId: "task-uuid",
    task: "Implement authentication",
    status: "completed",           // completed, failed
    output: "Implementation details...",
    processedBy: "agent-worker-456",
    completedAt: 1700000000000,
    duration: 12543,               // milliseconds
    metrics: {
      linesOfCode: 250,
      testsAdded: 15
    }
  }
}
```

#### Brainstorm Message Structure

```javascript
{
  id: "uuid",
  type: "brainstorm",
  from: "agent-worker-789",
  timestamp: 1700000000000,
  message: {
    sessionId: "session-uuid",
    topic: "API Design",
    question: "REST vs GraphQL?",
    initiatedBy: "agent-worker-789",
    requiredAgents: ["backend", "frontend"],
    timeout: 60000
  }
}
```

#### Brainstorm Response Structure

```javascript
{
  id: "uuid",
  type: "result",
  from: "agent-collab-101",
  timestamp: 1700000000000,
  result: {
    type: "brainstorm_response",
    sessionId: "session-uuid",
    from: "agent-collab-101",
    agentType: "collaborator",
    agentSpecialty: "backend-architecture",
    response: {
      analysis: "Detailed analysis...",
      pros: ["Advantage 1", "Advantage 2"],
      cons: ["Concern 1", "Concern 2"],
      recommendation: "Use GraphQL for...",
      alternatives: ["REST for simple CRUD"],
      confidence: 0.85,
      priority: "high"
    },
    timestamp: 1700000000000
  }
}
```

#### Status Message Structure

```javascript
{
  id: "uuid",
  type: "status",
  from: "agent-worker-456",
  timestamp: 1700000000000,
  status: {
    event: "task_started",         // connected, task_started, task_completed, etc.
    agentId: "agent-worker-456",
    agentType: "worker",
    taskId: "task-uuid",
    task: "Implement authentication",
    stats: {
      tasksReceived: 10,
      tasksCompleted: 8,
      tasksFailed: 1,
      brainstormsParticipated: 3,
      resultsPublished: 8
    }
  }
}
```

---

## Installation & Setup

### Prerequisites

#### System Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 18.0.0 | LTS version recommended |
| RabbitMQ | >= 3.12.0 | Can run in Docker |
| Git | >= 2.30.0 | For worktree support |
| Claude Code | Latest | Plugin host |

#### Optional Requirements

- Docker (recommended for RabbitMQ)
- Docker Compose (for multi-service setups)
- PostgreSQL (for task persistence - future feature)

### Step 1: Install RabbitMQ

#### Option A: Docker (Recommended)

```bash
# Pull and run RabbitMQ with management plugin
docker run -d \
  --name rabbitmq \
  --hostname rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3.12-management

# Verify it's running
docker ps | grep rabbitmq

# Check logs
docker logs rabbitmq
```

#### Option B: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3.12-management
    container_name: rabbitmq
    hostname: rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin123
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  rabbitmq_data:
```

```bash
# Start RabbitMQ
docker-compose up -d

# Check status
docker-compose ps
```

#### Option C: Native Installation

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y rabbitmq-server
sudo systemctl enable rabbitmq-server
sudo systemctl start rabbitmq-server
sudo rabbitmq-plugins enable rabbitmq_management
```

**macOS (Homebrew):**
```bash
brew install rabbitmq
brew services start rabbitmq
```

**Windows:**
1. Download installer from https://www.rabbitmq.com/download.html
2. Run installer
3. Start RabbitMQ service from Services panel

### Step 2: Verify RabbitMQ Installation

```bash
# Check RabbitMQ is running
curl http://localhost:15672

# You should see RabbitMQ Management UI
# Default credentials: guest / guest (Docker: admin / admin123)

# Test AMQP connection
telnet localhost 5672
# Should connect successfully (Ctrl+C to exit)
```

Access Management UI:
- URL: http://localhost:15672
- Username: `guest` (or `admin` if using Docker config)
- Password: `guest` (or `admin123`)

### Step 3: Install Plugin

#### Option A: Clone to Claude Code Plugins Directory

```bash
# Clone repository
cd ~/.claude-code/plugins/
git clone https://github.com/umitkacar/plugin-ai-agent-rabbitmq.git ai-agent-orchestrator

# Install dependencies
cd ai-agent-orchestrator
npm install
```

#### Option B: Local Development

```bash
# Clone to your development directory
cd ~/projects
git clone https://github.com/umitkacar/plugin-ai-agent-rabbitmq.git
cd plugin-ai-agent-rabbitmq

# Install dependencies
npm install

# Link to Claude Code (if needed)
# Claude Code will detect the plugin in your current directory
```

### Step 4: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Basic `.env` configuration:**

```bash
# RabbitMQ Connection
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/

# Agent Configuration
AGENT_ID=agent-${RANDOM}
AGENT_TYPE=worker
AGENT_NAME=Claude-Agent-1

# Queue Configuration
TASK_QUEUE=agent.tasks
BRAINSTORM_EXCHANGE=agent.brainstorm
RESULT_QUEUE=agent.results
STATUS_EXCHANGE=agent.status

# Monitoring
HEARTBEAT_INTERVAL=30000
HEALTH_CHECK_INTERVAL=10000
MESSAGE_TIMEOUT=300000

# Features
AUTO_RECONNECT=true
PERSISTENT_MESSAGES=true
PREFETCH_COUNT=1
```

### Step 5: Verify Installation

```bash
# Test RabbitMQ client
node scripts/orchestrator.js worker

# You should see:
# 🚀 Initializing worker orchestrator...
# Agent ID: agent-xxx
# ✅ Connected to RabbitMQ as agent: agent-xxx
# ⚙️ Worker ready - waiting for tasks
```

Press `Ctrl+C` to stop.

### Step 6: Setup Multiple Terminals (Optional)

For full orchestration, open 5 terminals:

```bash
# Terminal 1 - Team Leader
cd ~/plugin-ai-agent-rabbitmq
node scripts/orchestrator.js team-leader

# Terminal 2 - Worker
cd ~/plugin-ai-agent-rabbitmq
AGENT_NAME="Worker-1" node scripts/orchestrator.js worker

# Terminal 3 - Worker
cd ~/plugin-ai-agent-rabbitmq
AGENT_NAME="Worker-2" node scripts/orchestrator.js worker

# Terminal 4 - Collaborator
cd ~/plugin-ai-agent-rabbitmq
AGENT_NAME="Collaborator-1" node scripts/orchestrator.js collaborator

# Terminal 5 - Monitor
cd ~/plugin-ai-agent-rabbitmq
node scripts/monitor.js
```

### Verification Checklist

- [ ] RabbitMQ running and accessible on port 5672
- [ ] Management UI accessible on port 15672
- [ ] Plugin installed in Claude Code directory
- [ ] Dependencies installed (`npm install` successful)
- [ ] Environment file configured (`.env`)
- [ ] Test orchestrator connects successfully
- [ ] Multiple terminals can run different agent types

---

## Quick Start Tutorial

### 3-Terminal Basic Setup

This tutorial demonstrates the minimal setup: one team leader and two workers.

#### Setup

**Terminal 1 - Team Leader:**
```bash
cd ~/plugin-ai-agent-rabbitmq
node scripts/orchestrator.js team-leader
```

Output:
```
🚀 Initializing team-leader orchestrator...
Agent ID: agent-team-leader-abc123
✅ Connected to RabbitMQ
👔 Team Leader ready - waiting for results and status updates
```

**Terminal 2 - Worker:**
```bash
cd ~/plugin-ai-agent-rabbitmq
AGENT_NAME="Backend-Worker" node scripts/orchestrator.js worker
```

Output:
```
🚀 Initializing worker orchestrator...
Agent ID: agent-worker-xyz789
✅ Connected to RabbitMQ
⚙️ Worker ready - waiting for tasks
```

**Terminal 3 - Worker:**
```bash
cd ~/plugin-ai-agent-rabbitmq
AGENT_NAME="Frontend-Worker" node scripts/orchestrator.js worker
```

Output:
```
🚀 Initializing worker orchestrator...
Agent ID: agent-worker-def456
✅ Connected to RabbitMQ
⚙️ Worker ready - waiting for tasks
```

#### First Task Assignment

In Terminal 1 (Team Leader), open Node REPL or create a script:

```javascript
// In Terminal 1, press Ctrl+C first, then run:
node

// Import orchestrator
const AgentOrchestrator = (await import('./scripts/orchestrator.js')).default;

// Create team leader
const leader = new AgentOrchestrator('team-leader');
await leader.initialize();
await leader.startTeamLeader();

// Assign a task
await leader.assignTask({
  title: "Implement user authentication",
  description: "Create JWT-based authentication with refresh tokens",
  priority: "high"
});
```

**What happens:**

1. Team Leader publishes task to `agent.tasks` queue
2. Either Worker (Terminal 2 or 3) picks up the task
3. Worker processes the task
4. Worker publishes result to `agent.results` queue
5. Team Leader receives and displays the result

#### Expected Output

**Terminal 1 (Leader):**
```
📋 Assigning task: Implement user authentication
📤 Published task: task-uuid-123

📊 Result received:
   Task: Implement user authentication
   Status: completed
   From: agent-worker-xyz789
   Duration: 12543ms
```

**Terminal 2 (Worker who picked it up):**
```
📥 Received task: Implement user authentication
   Description: Create JWT-based authentication with refresh tokens
   Priority: high

⚙️ Processing task...
✅ Task completed: Implement user authentication
📊 Publishing result to team leader...
```

**Terminal 3 (Other worker):**
```
(No output - task was already picked up by Terminal 2)
```

#### First Brainstorm

Now let's try collaborative problem-solving:

```javascript
// In Terminal 1 (Leader)
await leader.assignTask({
  title: "Design API architecture",
  description: "Choose communication pattern for microservices",
  priority: "high",
  requiresCollaboration: true,
  collaborationQuestion: "Should we use REST, GraphQL, or gRPC?",
  requiredAgents: []
});
```

**What happens:**

1. Team Leader assigns collaborative task
2. Worker picks up task
3. Worker broadcasts brainstorm request
4. All agents (including the other worker) receive brainstorm
5. Each agent analyzes and responds
6. Original worker aggregates responses
7. Worker makes decision and reports to leader

**Expected Output:**

**Terminal 2 (Worker processing task):**
```
📥 Received task: Design API architecture
🤝 Task requires collaboration - initiating brainstorm
🧠 Initiating brainstorm: Design API architecture
🧠 Brainstorm broadcasted to all agents

🧠 Brainstorm response from agent-worker-def456:
   Consider GraphQL for flexible queries...

📊 Decision: Use GraphQL for client-facing API
✅ Task completed: Design API architecture
```

**Terminal 3 (Worker as collaborator):**
```
🧠 Brainstorm request received:
   Topic: Design API architecture
   Question: Should we use REST, GraphQL, or gRPC?

💡 Suggestion: GraphQL provides better client-side developer experience
🧠 Brainstorm response sent
```

#### Result Aggregation

Assign multiple tasks and see load balancing:

```javascript
// In Terminal 1 (Leader)
await leader.assignTask({ title: "Task 1", description: "First task", priority: "normal" });
await leader.assignTask({ title: "Task 2", description: "Second task", priority: "normal" });
await leader.assignTask({ title: "Task 3", description: "Third task", priority: "normal" });
await leader.assignTask({ title: "Task 4", description: "Fourth task", priority: "normal" });
```

**What happens:**

- Tasks distributed fairly between Terminal 2 and Terminal 3
- Each worker processes ~2 tasks
- Results come back to leader
- Leader aggregates all results

**Summary:**

You now know how to:
- Start agents (leader and workers)
- Assign tasks
- Handle collaborative tasks with brainstorming
- Aggregate results from multiple workers

---

## Advanced Tutorials

### 5-Terminal Full Orchestration

This tutorial demonstrates the full power of the system with all agent types.

#### Setup All Agents

**Terminal 1 - Team Leader:**
```bash
cd ~/plugin-ai-agent-rabbitmq
node scripts/orchestrator.js team-leader
```

**Terminal 2 - Worker (Backend Specialist):**
```bash
cd ~/plugin-ai-agent-rabbitmq
AGENT_NAME="Backend-Worker" \
AGENT_SPECIALTY="backend" \
node scripts/orchestrator.js worker
```

**Terminal 3 - Worker (Frontend Specialist):**
```bash
cd ~/plugin-ai-agent-rabbitmq
AGENT_NAME="Frontend-Worker" \
AGENT_SPECIALTY="frontend" \
node scripts/orchestrator.js worker
```

**Terminal 4 - Collaborator (Architecture Expert):**
```bash
cd ~/plugin-ai-agent-rabbitmq
AGENT_NAME="Architecture-Expert" \
AGENT_SPECIALTY="architecture" \
node scripts/orchestrator.js collaborator
```

**Terminal 5 - Monitor:**
```bash
cd ~/plugin-ai-agent-rabbitmq
node scripts/monitor.js
```

#### Complex Workflow Example

Now let's orchestrate a complex feature implementation:

```javascript
// Terminal 1 (Leader)
const leader = new AgentOrchestrator('team-leader');
await leader.initialize();
await leader.startTeamLeader();

// Assign architecture decision (requires collaboration)
await leader.assignTask({
  title: "Design payment processing architecture",
  description: "Design secure, scalable payment system with PCI compliance",
  priority: "critical",
  requiresCollaboration: true,
  collaborationQuestion: "What architecture ensures security, scalability, and compliance?",
  requiredAgents: ["architecture"]
});

// After architecture is decided, assign implementation tasks
await leader.assignTask({
  title: "Implement backend payment API",
  description: "Create payment endpoints with Stripe integration",
  priority: "high",
  context: {
    specialty: "backend",
    framework: "Express.js"
  }
});

await leader.assignTask({
  title: "Implement frontend payment UI",
  description: "Create payment form with validation",
  priority: "high",
  context: {
    specialty: "frontend",
    framework: "React"
  }
});

await leader.assignTask({
  title: "Write integration tests",
  description: "Test end-to-end payment flow",
  priority: "normal",
  context: {
    specialty: "testing"
  }
});
```

**Flow:**

1. Architecture task triggers brainstorm (Terminal 4 responds)
2. Backend task picked up by Terminal 2 (backend specialist)
3. Frontend task picked up by Terminal 3 (frontend specialist)
4. All results aggregated by Terminal 1
5. Terminal 5 monitors the entire process

### Git Worktree Integration

This tutorial shows how to use git worktree for true parallel development.

#### Setup Worktrees

```bash
# Main repository - Terminal 1
cd ~/my-project
git worktree add ../my-project-worker1 feature/authentication
git worktree add ../my-project-worker2 feature/authentication
git worktree add ../my-project-collab1 feature/authentication

# Now you have 4 working directories:
# ~/my-project (main)
# ~/my-project-worker1 (worktree 1)
# ~/my-project-worker2 (worktree 2)
# ~/my-project-collab1 (worktree 3)
```

#### Start Agents in Each Directory

**Terminal 1 - Main (Team Leader):**
```bash
cd ~/my-project
node ~/plugin-ai-agent-rabbitmq/scripts/orchestrator.js team-leader
```

**Terminal 2 - Worktree 1 (Worker):**
```bash
cd ~/my-project-worker1
AGENT_NAME="Worker-1" \
node ~/plugin-ai-agent-rabbitmq/scripts/orchestrator.js worker
```

**Terminal 3 - Worktree 2 (Worker):**
```bash
cd ~/my-project-worker2
AGENT_NAME="Worker-2" \
node ~/plugin-ai-agent-rabbitmq/scripts/orchestrator.js worker
```

**Terminal 4 - Worktree 3 (Collaborator):**
```bash
cd ~/my-project-collab1
AGENT_NAME="Collaborator-1" \
node ~/plugin-ai-agent-rabbitmq/scripts/orchestrator.js collaborator
```

#### Parallel Development Workflow

```javascript
// Terminal 1 (Leader in main directory)
await leader.assignTask({
  title: "Implement login endpoint",
  description: "POST /api/auth/login with JWT generation",
  priority: "high"
});

await leader.assignTask({
  title: "Implement registration endpoint",
  description: "POST /api/auth/register with email validation",
  priority: "high"
});

await leader.assignTask({
  title: "Implement password reset",
  description: "Password reset flow with email verification",
  priority: "normal"
});
```

**What happens:**

1. Worker-1 (Terminal 2) picks up login task in `~/my-project-worker1`
2. Worker-2 (Terminal 3) picks up registration task in `~/my-project-worker2`
3. Both work independently on the same branch but different directories
4. No file conflicts because they're in separate worktrees
5. Results sent to leader in main directory
6. Leader can review both implementations

#### Collaborative Code Review

```javascript
// After implementation, do collaborative review
await leader.assignTask({
  title: "Review authentication implementation",
  description: "Review login, registration, and password reset endpoints",
  priority: "high",
  requiresCollaboration: true,
  collaborationQuestion: "Is the implementation secure and production-ready?"
});
```

**What happens:**

1. Worker picks up review task
2. Worker broadcasts brainstorm to collaborator
3. Collaborator (Terminal 4) reviews code in their worktree
4. Collaborator provides security analysis
5. Worker synthesizes feedback
6. Final review result sent to leader

### Specialized Workers

This tutorial demonstrates worker specialization.

#### Define Worker Specialties

Create specialty-specific workers:

**Terminal 2 - Database Specialist:**
```bash
AGENT_NAME="DB-Specialist" \
AGENT_SPECIALTY="database" \
node scripts/orchestrator.js worker
```

**Terminal 3 - Security Specialist:**
```bash
AGENT_NAME="Security-Specialist" \
AGENT_SPECIALTY="security" \
node scripts/orchestrator.js worker
```

**Terminal 4 - Performance Specialist:**
```bash
AGENT_NAME="Performance-Specialist" \
AGENT_SPECIALTY="performance" \
node scripts/orchestrator.js worker
```

#### Assign Specialty-Specific Tasks

```javascript
// Terminal 1 (Leader)
await leader.assignTask({
  title: "Optimize database queries",
  description: "Reduce query time from 500ms to 100ms",
  priority: "high",
  context: {
    requiredSpecialty: "database",
    currentPerformance: "500ms",
    targetPerformance: "100ms"
  }
});

await leader.assignTask({
  title: "Security audit",
  description: "Audit authentication system for vulnerabilities",
  priority: "critical",
  context: {
    requiredSpecialty: "security",
    scope: "authentication"
  }
});

await leader.assignTask({
  title: "Performance profiling",
  description: "Profile API endpoints under load",
  priority: "high",
  context: {
    requiredSpecialty: "performance",
    targetRPS: 1000
  }
});
```

Workers can filter tasks based on specialty:

```javascript
// In worker code
await client.consumeTasks('agent.tasks', async (msg, { ack, nack }) => {
  const { task } = msg;

  // Check if task matches my specialty
  if (task.context.requiredSpecialty &&
      task.context.requiredSpecialty !== process.env.AGENT_SPECIALTY) {
    nack(true); // Requeue for correct specialist
    return;
  }

  // Process task
  await executeTask(task);
  ack();
});
```

### Complex Workflows with Coordinator

This tutorial shows how to use the Coordinator agent for workflows with dependencies.

#### Start Coordinator

**Terminal 1 - Coordinator:**
```bash
node scripts/orchestrator.js coordinator
```

#### Define Multi-Step Workflow

```javascript
// Terminal 1 (Coordinator)
const coordinator = new AgentOrchestrator('coordinator');
await coordinator.initialize();

// Define workflow with dependencies
const workflow = {
  id: 'feature-deployment',
  steps: [
    {
      id: 'design',
      type: 'sequential',
      tasks: [
        { title: 'Design API', description: 'Design REST API' },
        { title: 'Design Database', description: 'Design schema' }
      ]
    },
    {
      id: 'implementation',
      type: 'parallel',
      dependsOn: ['design'],
      tasks: [
        { title: 'Implement Backend', description: 'Build API' },
        { title: 'Implement Frontend', description: 'Build UI' },
        { title: 'Write Tests', description: 'Unit and integration tests' }
      ]
    },
    {
      id: 'review',
      type: 'sequential',
      dependsOn: ['implementation'],
      tasks: [
        { title: 'Code Review', description: 'Review all code' },
        { title: 'Security Review', description: 'Security audit' }
      ]
    },
    {
      id: 'deployment',
      type: 'sequential',
      dependsOn: ['review'],
      tasks: [
        { title: 'Deploy Staging', description: 'Deploy to staging' },
        { title: 'E2E Tests', description: 'Run E2E tests' },
        { title: 'Deploy Production', description: 'Deploy to prod' }
      ]
    }
  ]
};

// Execute workflow
await coordinator.executeWorkflow(workflow);
```

**Execution Flow:**

```
┌─────────────────────────────────────────────────────┐
│ Step 1: Design (Sequential)                         │
│   - Design API ────────→ Complete                   │
│   - Design Database ───→ Complete                   │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ Step 2: Implementation (Parallel)                   │
│   - Implement Backend ─┐                            │
│   - Implement Frontend ├─→ All complete             │
│   - Write Tests ────────┘                           │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ Step 3: Review (Sequential)                         │
│   - Code Review ───────→ Complete                   │
│   - Security Review ────→ Complete                  │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│ Step 4: Deployment (Sequential)                     │
│   - Deploy Staging ────→ Complete                   │
│   - E2E Tests ──────────→ Complete                  │
│   - Deploy Production ──→ Complete                  │
└─────────────────────────────────────────────────────┘
```

---

## Core Concepts & Patterns

### Queue Patterns

#### Work Queue (Competing Consumers)

**Pattern:**
```
Producer → Queue → Consumer 1
                 → Consumer 2
                 → Consumer 3
```

**Characteristics:**
- Each message delivered to ONE consumer
- Load balancing across consumers
- Fair dispatch with prefetch=1
- Use for: Task distribution, work sharing

**Implementation:**
```javascript
// Producer
await client.publishTask({
  title: "Process data"
});

// Consumers (all compete for messages)
await client.consumeTasks('agent.tasks', async (msg, { ack }) => {
  await processTask(msg.task);
  ack();
});
```

**Use Cases:**
- Distributing work across worker pool
- Background job processing
- Load-balanced task execution

#### Publish-Subscribe (Fan-Out)

**Pattern:**
```
Publisher → Exchange → Queue 1 → Consumer 1
                     → Queue 2 → Consumer 2
                     → Queue 3 → Consumer 3
```

**Characteristics:**
- Each message delivered to ALL consumers
- Broadcasting pattern
- Fanout exchange
- Use for: Notifications, broadcasts

**Implementation:**
```javascript
// Publisher
await client.broadcastBrainstorm({
  topic: "Architecture decision",
  question: "Which approach?"
});

// Consumers (all receive message)
await client.listenBrainstorm(queue, async (msg) => {
  await analyzeBrainstorm(msg);
});
```

**Use Cases:**
- Brainstorming sessions
- System-wide announcements
- Event broadcasting

#### Topic-Based Routing

**Pattern:**
```
Publisher → Topic Exchange
   ↓ (routing key: agent.status.connected)
   → Queue (pattern: agent.status.#) → Consumer 1
   → Queue (pattern: agent.*.connected) → Consumer 2
```

**Characteristics:**
- Selective message routing
- Wildcard patterns (* = one word, # = zero or more words)
- Topic exchange
- Use for: Filtered subscriptions

**Implementation:**
```javascript
// Publisher
await client.publishStatus({
  event: 'task_completed'
}, 'agent.status.task.completed');

// Consumer 1 - All status messages
await client.subscribeStatus('agent.status.#', async (msg) => {
  // Receives all status updates
});

// Consumer 2 - Only task-related status
await client.subscribeStatus('agent.status.task.*', async (msg) => {
  // Receives only task status
});
```

**Use Cases:**
- Status updates
- Filtered logging
- Selective monitoring

### Exchange Types

#### Fanout Exchange

**Behavior:** Broadcasts to all bound queues (ignores routing key)

**Configuration:**
```javascript
await channel.assertExchange('agent.brainstorm', 'fanout', {
  durable: true
});
```

**Use Case:** Brainstorming, system broadcasts

#### Topic Exchange

**Behavior:** Routes based on routing key pattern matching

**Configuration:**
```javascript
await channel.assertExchange('agent.status', 'topic', {
  durable: true
});
```

**Routing Key Examples:**
- `agent.status.connected` - Agent connected
- `agent.status.task.started` - Task started
- `agent.status.task.completed` - Task completed
- `agent.status.error` - Error occurred

**Binding Patterns:**
- `agent.status.#` - All status messages
- `agent.status.task.*` - All task-related status
- `agent.*.connected` - All connection events

**Use Case:** Status updates, logging, monitoring

#### Direct Exchange

**Behavior:** Routes to queues with exact routing key match

**Configuration:**
```javascript
await channel.assertExchange('direct_tasks', 'direct', {
  durable: true
});
```

**Use Case:** Targeted message delivery (not used in this plugin, but available)

### Message Routing

#### Routing Decision Flow

```
Message Published
      │
      ▼
Exchange Type?
      │
      ├─→ Fanout ──→ Send to ALL bound queues
      │
      ├─→ Topic ───→ Match routing key pattern
      │              └─→ Send to matching queues
      │
      └─→ Direct ──→ Match exact routing key
                     └─→ Send to exact match queues
```

#### Routing Examples

**Example 1: Task Distribution**
```javascript
// Exchange: (none - direct to queue)
// Queue: agent.tasks
// Routing: Round-robin to consumers

await channel.sendToQueue('agent.tasks', message);
// → Delivered to one of N workers
```

**Example 2: Brainstorm Broadcast**
```javascript
// Exchange: agent.brainstorm (fanout)
// Queues: brainstorm.agent-1, brainstorm.agent-2, ...
// Routing: All queues receive message

await channel.publish('agent.brainstorm', '', message);
// → Delivered to ALL collaborators
```

**Example 3: Selective Status Updates**
```javascript
// Exchange: agent.status (topic)
// Routing Key: agent.status.task.completed
// Pattern: agent.status.#
// Result: Matches and delivers

await channel.publish('agent.status', 'agent.status.task.completed', message);
// → Delivered to subscribers with pattern agent.status.#
```

### Task Lifecycle

#### Complete Task Lifecycle

```
┌──────────────┐
│   Created    │ Task defined by team leader
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Queued     │ Published to agent.tasks
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Assigned   │ Worker consumes from queue
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ In Progress  │ Worker processing
└──────┬───────┘
       │
       ├─→ [Collaboration Required?]
       │         │
       │         ▼
       │   ┌──────────────┐
       │   │ Brainstorming│ Multi-agent discussion
       │   └──────┬───────┘
       │          │
       │          ▼
       │   ┌──────────────┐
       │   │ Synthesizing │ Aggregate responses
       │   └──────┬───────┘
       │          │
       ├──────────┘
       │
       ▼
┌──────────────┐
│  Completed   │ Result published
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Aggregated  │ Team leader receives result
└──────────────┘
```

#### Task State Transitions

```javascript
const taskStates = {
  // Initial states
  CREATED: 'created',
  QUEUED: 'queued',

  // Processing states
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COLLABORATING: 'collaborating',

  // Terminal states
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',

  // Error states
  RETRYING: 'retrying',
  DEAD_LETTER: 'dead_letter'
};
```

#### Error Handling Flow

```
Task Execution
      │
      ├─→ Success ────→ COMPLETED
      │                     │
      │                     ▼
      │              Publish Result
      │
      └─→ Failure
            │
            ├─→ Transient Error?
            │         │
            │         ├─→ Yes ──→ Has Retries?
            │         │             │
            │         │             ├─→ Yes ──→ RETRYING
            │         │             │             │
            │         │             │             └─→ Requeue
            │         │             │
            │         │             └─→ No ───→ DEAD_LETTER
            │         │
            │         └─→ No ───→ DEAD_LETTER
            │
            └─→ FAILED
                  │
                  ▼
           Publish Failure Status
```

### Collaboration Patterns

#### Pattern 1: Parallel Analysis

**Scenario:** Get multiple independent perspectives

```
Initiator → Broadcast Question
               │
               ├─→ Agent 1 → Security perspective
               ├─→ Agent 2 → Performance perspective
               ├─→ Agent 3 → Cost perspective
               └─→ Agent 4 → Maintainability perspective
                     │
                     ▼
               Aggregate All Responses
                     │
                     ▼
                Make Decision
```

**Implementation:**
```javascript
// Initiate brainstorm
await orchestrator.initiateBrainstorm({
  topic: "Database Selection",
  question: "PostgreSQL vs MongoDB?",
  requiredAgents: []
});

// All agents respond in parallel
// Initiator waits for all responses
// Synthesizes final decision
```

#### Pattern 2: Sequential Refinement

**Scenario:** Build upon previous responses

```
Question
   │
   ▼
Agent 1 → Initial Proposal
   │
   ▼
Agent 2 → Builds on Proposal 1
   │
   ▼
Agent 3 → Refines Combined Approach
   │
   ▼
Agent 4 → Final Optimization
```

**Implementation:**
```javascript
// Round 1: Initial proposals
const round1 = await brainstorm({ rounds: 3 });

// Round 2: Agents see round 1 responses, build upon them
// Round 3: Final refinement and consensus
```

#### Pattern 3: Consensus Voting

**Scenario:** Democratic decision-making

```
Question
   │
   ├─→ Agent 1 → Proposes Option A (vote: A)
   ├─→ Agent 2 → Proposes Option B (vote: B)
   ├─→ Agent 3 → Evaluates both (vote: A)
   └─→ Agent 4 → Evaluates both (vote: A)
         │
         ▼
   Count Votes: A=3, B=1
         │
         ▼
   Select Option A
```

**Implementation:**
```javascript
const votes = {};

// Each agent submits vote
responses.forEach(response => {
  const vote = response.recommendation;
  votes[vote] = (votes[vote] || 0) + 1;
});

// Select winner
const winner = Object.entries(votes)
  .sort((a, b) => b[1] - a[1])[0][0];
```

#### Pattern 4: Expert Panel

**Scenario:** Domain-specific expertise

```
Complex Problem
      │
      ├─→ Frontend Expert → UI/UX perspective
      ├─→ Backend Expert → API design perspective
      ├─→ Database Expert → Data modeling perspective
      ├─→ DevOps Expert → Infrastructure perspective
      └─→ Security Expert → Security perspective
            │
            ▼
      Synthesize All Perspectives
            │
            ▼
       Holistic Solution
```

**Implementation:**
```javascript
await orchestrator.initiateBrainstorm({
  topic: "Microservices Architecture",
  question: "How should we structure our services?",
  requiredAgents: [
    "frontend",
    "backend",
    "database",
    "devops",
    "security"
  ]
});

// Only specified specialists respond
// Each provides domain-specific analysis
// Coordinator synthesizes into complete solution
```

---

## Complete Feature Reference

### Agent Types

#### 1. Team Leader

**Role:** Orchestrates work distribution and aggregates results

**Capabilities:**
- Assign tasks to worker pool
- Monitor all agent status
- Aggregate results from workers
- Make final decisions
- Handle task failures and reassignments

**Startup:**
```bash
/orchestrate team-leader
# or
node scripts/orchestrator.js team-leader
```

**API:**
```javascript
// Initialize
const leader = new AgentOrchestrator('team-leader');
await leader.initialize();
await leader.startTeamLeader();

// Assign task
await leader.assignTask({
  title: "Task title",
  description: "Task description",
  priority: "high"
});

// Get statistics
const stats = leader.getStats();
```

**Message Flows:**
- **Publishes to:** `agent.tasks` (task assignments)
- **Consumes from:** `agent.results` (task results)
- **Subscribes to:** `agent.status.#` (all status updates)

**Use When:**
- Distributing work across multiple agents
- Aggregating results from parallel execution
- Making decisions based on team input
- Monitoring overall system health

#### 2. Worker

**Role:** Executes assigned tasks from the queue

**Capabilities:**
- Consume tasks from queue
- Process work independently
- Report results
- Participate in brainstorms
- Error handling and retry

**Startup:**
```bash
/orchestrate worker
# or
AGENT_NAME="Custom-Name" node scripts/orchestrator.js worker
```

**API:**
```javascript
// Initialize
const worker = new AgentOrchestrator('worker');
await worker.initialize();
await worker.startWorker();

// Worker automatically consumes and processes tasks
// Custom task handler (optional)
await worker.client.consumeTasks('agent.tasks', async (msg, { ack, nack }) => {
  try {
    await customTaskHandler(msg.task);
    ack();
  } catch (error) {
    nack(true); // Requeue
  }
});
```

**Message Flows:**
- **Consumes from:** `agent.tasks` (work assignments)
- **Publishes to:** `agent.results` (task results)
- **Subscribes to:** `brainstorm.{agentId}` (brainstorm requests)
- **Publishes to:** `agent.status.*` (status updates)

**Use When:**
- Executing tasks from the queue
- Processing work independently
- Scaling horizontally (add more workers)

#### 3. Collaborator

**Role:** Specializes in brainstorming and collaborative problem-solving

**Capabilities:**
- Listen for brainstorm requests
- Provide expert input
- Help build consensus
- Participate in multi-round discussions
- Can also execute tasks

**Startup:**
```bash
/orchestrate collaborator
# or
AGENT_NAME="Expert-Name" AGENT_SPECIALTY="domain" node scripts/orchestrator.js collaborator
```

**API:**
```javascript
// Initialize
const collaborator = new AgentOrchestrator('collaborator');
await collaborator.initialize();
await collaborator.startCollaborator();

// Custom brainstorm handler
await collaborator.client.listenBrainstorm(queue, async (msg) => {
  const { topic, question } = msg.message;

  // Analyze and respond
  const analysis = await customAnalysis(topic, question);

  await collaborator.publishResult({
    type: 'brainstorm_response',
    sessionId: msg.message.sessionId,
    from: collaborator.agentId,
    analysis
  });
});
```

**Message Flows:**
- **Subscribes to:** `brainstorm.{agentId}` (brainstorm broadcasts)
- **Publishes to:** `agent.results` (brainstorm responses)
- **Consumes from:** `agent.tasks` (optional - can also process tasks)

**Use When:**
- Complex decisions requiring multiple perspectives
- Architecture and design discussions
- Code review with multiple viewpoints
- Building consensus

#### 4. Coordinator

**Role:** Manages complex workflows with dependencies

**Capabilities:**
- Orchestrate multi-step workflows
- Handle task dependencies (A → B → C)
- Coordinate parallel execution
- Manage state and checkpoints
- Workflow rollback

**Startup:**
```bash
/orchestrate coordinator
# or
node scripts/orchestrator.js coordinator
```

**API:**
```javascript
// Initialize
const coordinator = new AgentOrchestrator('coordinator');
await coordinator.initialize();

// Define workflow
const workflow = {
  id: 'feature-deployment',
  steps: [
    {
      id: 'design',
      type: 'sequential',
      tasks: [...]
    },
    {
      id: 'implementation',
      type: 'parallel',
      dependsOn: ['design'],
      tasks: [...]
    },
    {
      id: 'deployment',
      type: 'sequential',
      dependsOn: ['implementation'],
      tasks: [...]
    }
  ]
};

// Execute workflow
await coordinator.executeWorkflow(workflow);
```

**Message Flows:**
- **Publishes to:** `agent.tasks` (workflow tasks)
- **Consumes from:** `agent.results` (task results)
- **Uses:** `coordinator.workflows` (workflow state)
- **Uses:** `coordinator.checkpoints` (state persistence)

**Use When:**
- Complex multi-step processes
- Tasks with dependencies
- Need for state management
- Workflow recovery and rollback

#### 5. Monitor

**Role:** Provides real-time system observability

**Capabilities:**
- Display real-time dashboard
- Track agent health
- Monitor queue metrics
- Generate alerts
- Performance tracking
- Anomaly detection

**Startup:**
```bash
/orchestrate monitor
# or
node scripts/monitor.js
```

**API:**
```javascript
// Start monitor
const monitor = new MonitorAgent();
await monitor.initialize();
await monitor.startMonitoring();

// Get system metrics
const metrics = await monitor.getMetrics();

// Configure alerts
await monitor.setupAlerts({
  rules: [
    {
      name: 'high_queue_depth',
      condition: 'queue.depth > 100',
      action: 'notify'
    }
  ]
});
```

**Message Flows:**
- **Subscribes to:** `agent.status.#` (all status updates)
- **Polls:** RabbitMQ Management API (queue metrics)
- **Publishes to:** `agent.status.alert` (alerts)

**Use When:**
- Monitoring system health
- Tracking performance
- Detecting bottlenecks
- Alerting on issues

### Commands

#### /orchestrate [type]

**Description:** Start an agent as part of the orchestration system

**Syntax:**
```bash
/orchestrate <agent-type>
```

**Agent Types:**
- `team-leader` - Orchestrator
- `worker` - Task executor
- `collaborator` - Brainstorm participant
- `coordinator` - Workflow manager
- `monitor` - System monitor

**Examples:**
```bash
/orchestrate team-leader
/orchestrate worker
/orchestrate collaborator
```

**Environment Variables:**
```bash
AGENT_ID=custom-id /orchestrate worker
AGENT_NAME="Custom Name" /orchestrate worker
AGENT_SPECIALTY="backend" /orchestrate collaborator
```

#### /assign-task

**Description:** Assign work to the worker pool

**Syntax:**
```bash
/assign-task title="Task Title" [options]
```

**Options:**
- `title` - Task title (required)
- `description` - Detailed description
- `priority` - `low`, `normal`, `high`, `critical`
- `collaboration` - `true`/`false`
- `question` - Collaboration question
- `context` - Additional context as JSON

**Examples:**
```bash
# Basic task
/assign-task title="Implement authentication" \
  description="JWT-based auth" \
  priority=high

# Collaborative task
/assign-task title="Design architecture" \
  collaboration=true \
  question="Microservices vs Monolith?"

# Task with context
/assign-task title="Optimize queries" \
  context='{"database":"PostgreSQL","target":"100ms"}'
```

**JavaScript API:**
```javascript
await orchestrator.assignTask({
  title: "Task title",
  description: "Task description",
  priority: "high",
  requiresCollaboration: true,
  collaborationQuestion: "Question?",
  context: {}
});
```

#### /brainstorm

**Description:** Initiate collaborative brainstorming session

**Syntax:**
```bash
/brainstorm topic="Topic" question="Question?" [options]
```

**Options:**
- `topic` - Brainstorm topic (required)
- `question` - Specific question (required)
- `agents` - Target specific agents
- `rounds` - Number of discussion rounds
- `timeout` - Max wait time in seconds

**Examples:**
```bash
# Basic brainstorm
/brainstorm topic="API Design" \
  question="REST vs GraphQL?"

# Targeted brainstorm
/brainstorm topic="Database Optimization" \
  question="How to reduce latency?" \
  agents="database,performance"

# Multi-round discussion
/brainstorm topic="Architecture" \
  question="System design?" \
  rounds=3
```

**JavaScript API:**
```javascript
await orchestrator.initiateBrainstorm({
  topic: "Topic",
  question: "Question?",
  requiredAgents: ["backend", "frontend"],
  timeout: 60000
});
```

#### /status

**Description:** View system status and metrics

**Syntax:**
```bash
/status [category] [options]
```

**Categories:**
- (none) - Overall system status
- `agents` - All agent statuses
- `queues` - Queue metrics
- `performance` - Performance metrics
- `alerts` - Active alerts

**Options:**
- `--compact` - Compact single-line view
- `--detailed` - Detailed full view
- `--watch` - Continuous updates
- `--interval=<ms>` - Update interval

**Examples:**
```bash
# Overall status
/status

# Agent status
/status agents

# Queue metrics
/status queues

# Performance report
/status performance --interval=1h

# Watch mode
/status --watch
```

**JavaScript API:**
```javascript
const stats = orchestrator.getStats();
console.log(stats);
```

#### /join-team [role]

**Description:** Quick command to join the team (alias for /orchestrate)

**Syntax:**
```bash
/join-team <role>
```

**Roles:**
- `leader` - Team leader
- `worker` - Worker
- `collaborator` - Collaborator

**Examples:**
```bash
/join-team worker
/join-team leader
/join-team collaborator
```

### Skills

#### 1. RabbitMQ Operations

**Description:** Manage RabbitMQ connections, queues, exchanges, and message routing

**Location:** `/home/user/plugin-ai-agent-rabbitmq/skills/rabbitmq-ops/SKILL.md`

**Key Functions:**
```javascript
import { RabbitMQClient } from './scripts/rabbitmq-client.js';

// Connection
const client = new RabbitMQClient({ url: 'amqp://localhost:5672' });
await client.connect();

// Queue operations
await client.setupTaskQueue('agent.tasks');
await client.publishTask(task);
await client.consumeTasks('agent.tasks', handler);

// Exchange operations
await client.setupBrainstormExchange();
await client.broadcastBrainstorm(message);
await client.listenBrainstorm(queue, handler);

// Status operations
await client.publishStatus(status, routingKey);
await client.subscribeStatus(pattern, handler);

// Connection management
await client.close();
```

**Use Cases:**
- Low-level queue operations
- Custom exchange configurations
- Advanced routing patterns
- Connection pooling

#### 2. Task Distribution

**Description:** Distribute work across multiple agents with load balancing

**Location:** `/home/user/plugin-ai-agent-rabbitmq/skills/task-distribution/SKILL.md`

**Key Functions:**
```javascript
import AgentOrchestrator from './scripts/orchestrator.js';

// Task assignment
await orchestrator.assignTask({
  title: "Task",
  priority: "high"
});

// Task consumption
await orchestrator.startWorker();

// Priority handling
await orchestrator.assignTask({
  title: "Critical task",
  priority: "critical"  // Processed first
});

// Retry configuration
await orchestrator.assignTask({
  title: "Retryable task",
  retryCount: 3,
  retryDelay: 5000
});
```

**Distribution Strategies:**
- Round-robin (default)
- Priority-based
- Capability-based routing
- Batch distribution

**Use Cases:**
- Parallel task execution
- Load balancing
- Work distribution
- Priority queues

#### 3. Collaboration

**Description:** Multi-agent brainstorming and consensus building

**Location:** `/home/user/plugin-ai-agent-rabbitmq/skills/collaboration/SKILL.md`

**Key Functions:**
```javascript
// Initiate brainstorm
await orchestrator.initiateBrainstorm({
  topic: "Architecture",
  question: "Best approach?",
  requiredAgents: ["backend", "frontend"]
});

// Participate in brainstorm
await orchestrator.handleBrainstormMessage(msg);

// Synthesize responses
const consensus = await orchestrator.synthesizeResponses(responses);

// Multi-round discussion
await orchestrator.initiateBrainstorm({
  topic: "Topic",
  question: "Question?",
  rounds: 3
});
```

**Collaboration Patterns:**
- Parallel analysis
- Sequential refinement
- Consensus voting
- Expert panel

**Use Cases:**
- Architecture decisions
- Design discussions
- Code review
- Problem-solving

#### 4. Result Aggregation

**Description:** Collect and synthesize results from multiple agents

**Location:** `/home/user/plugin-ai-agent-rabbitmq/skills/result-aggregation/SKILL.md`

**Key Functions:**
```javascript
// Collect results
await orchestrator.consumeResults('agent.results', async (msg) => {
  await orchestrator.handleResult(msg);
});

// Aggregate multiple results
const allResults = await orchestrator.aggregateResults(taskIds);

// Synthesize final output
const synthesis = await synthesizeResults(allResults);

// Track completion
let completed = 0;
const total = tasks.length;

await consumeResults('agent.results', (result) => {
  completed++;

  if (completed === total) {
    console.log('All tasks complete!');
    const finalResult = reduce(results);
  }
});
```

**Aggregation Strategies:**
- Map-reduce
- Consensus building
- Weighted voting
- Statistical analysis

**Use Cases:**
- Parallel result collection
- Multi-agent consensus
- Report generation
- Decision synthesis

#### 5. Health Monitoring

**Description:** Track metrics, detect anomalies, generate alerts

**Location:** `/home/user/plugin-ai-agent-rabbitmq/skills/health-monitoring/SKILL.md`

**Key Functions:**
```javascript
// Monitor agent health
await monitorAgentHealth({
  heartbeatInterval: 30000,
  timeout: 60000,
  onAgentDisconnected: (agent) => {
    sendAlert('agent_disconnected', agent);
  }
});

// Collect queue metrics
const queueMetrics = await collectQueueMetrics({
  queues: ['agent.tasks', 'agent.results'],
  metrics: ['messageCount', 'consumerCount', 'messageRate']
});

// Track performance
const performanceMetrics = {
  avgTaskDuration: calculateAverage(taskDurations),
  p95Duration: percentile(taskDurations, 95),
  tasksPerMinute: calculateRate(completedTasks),
  failureRate: calculateFailureRate()
};

// Setup alerts
await setupAlerts({
  rules: [
    {
      name: 'high_queue_depth',
      condition: 'queue.depth > 100',
      severity: 'warning',
      action: 'notify_team_leader'
    }
  ]
});

// Display dashboard
await displayDashboard({
  agents: agentMetrics,
  tasks: taskMetrics,
  queues: queueMetrics,
  performance: performanceMetrics,
  alerts: activeAlerts
});
```

**Metrics Tracked:**
- Agent metrics (count, status, uptime)
- Task metrics (queued, active, completed, failed)
- Queue metrics (depth, consumers, rates)
- Performance metrics (duration, throughput)

**Use Cases:**
- System monitoring
- Performance tracking
- Bottleneck detection
- Alert generation

### Hooks

#### session-start

**Description:** Initialize RabbitMQ connection when Claude Code session starts

**Enabled:** false (by default)

**Command:** `node scripts/hooks/session-start.js`

**Use Case:** Auto-connect to RabbitMQ on session start

**Configuration:**
```json
{
  "session-start": {
    "enabled": true,
    "command": "node scripts/hooks/session-start.js"
  }
}
```

#### pre-task

**Description:** Validate task before execution

**Enabled:** true

**Command:** `node scripts/hooks/pre-task.js`

**Use Case:** Task validation, prerequisite checking

#### post-task

**Description:** Report task completion to team leader

**Enabled:** true

**Command:** `node scripts/hooks/post-task.js`

**Use Case:** Automatic result reporting

#### health-check

**Description:** Periodic health check and heartbeat

**Enabled:** true

**Command:** `node scripts/hooks/health-check.js`

**Interval:** 30000ms (30 seconds)

**Use Case:** Keep agent connection alive, report health status

#### queue-monitor

**Description:** Monitor queue depth and alert on backlog

**Enabled:** true

**Command:** `node scripts/hooks/queue-monitor.js`

**Interval:** 10000ms (10 seconds)

**Use Case:** Detect queue buildup, trigger scaling

---

## Real-World Use Cases

### 1. Distributed Code Review

**Scenario:** Review 10 pull requests in parallel

**Setup:**
```bash
# Terminal 1 - Team Leader
/orchestrate team-leader

# Terminals 2-5 - Review Workers
/orchestrate worker
```

**Workflow:**
```javascript
// Terminal 1 - Assign reviews
const prs = [123, 124, 125, 126, 127, 128, 129, 130, 131, 132];

for (const pr of prs) {
  await leader.assignTask({
    title: `Review PR #${pr}`,
    description: `Comprehensive code review for PR #${pr}`,
    priority: "normal",
    context: {
      prNumber: pr,
      repository: "my-repo"
    }
  });
}

// Workers automatically pick up and process reviews
// Results aggregated by team leader
```

**Result:** 10 PRs reviewed in parallel by 4 workers = 2.5x faster than serial

### 2. Parallel Feature Development

**Scenario:** Implement full-stack feature with frontend, backend, database, and tests

**Setup:**
```bash
# Terminal 1 - Coordinator
/orchestrate coordinator

# Terminal 2 - Backend Specialist
AGENT_SPECIALTY="backend" /orchestrate worker

# Terminal 3 - Frontend Specialist
AGENT_SPECIALTY="frontend" /orchestrate worker

# Terminal 4 - Database Specialist
AGENT_SPECIALTY="database" /orchestrate worker

# Terminal 5 - Test Specialist
AGENT_SPECIALTY="testing" /orchestrate worker
```

**Workflow:**
```javascript
// Terminal 1 - Coordinator
const workflow = {
  id: 'user-authentication-feature',
  steps: [
    {
      id: 'database',
      type: 'sequential',
      tasks: [
        {
          title: 'Design user table schema',
          specialty: 'database'
        },
        {
          title: 'Create database migrations',
          specialty: 'database'
        }
      ]
    },
    {
      id: 'implementation',
      type: 'parallel',
      dependsOn: ['database'],
      tasks: [
        {
          title: 'Implement backend auth API',
          specialty: 'backend'
        },
        {
          title: 'Implement frontend login UI',
          specialty: 'frontend'
        }
      ]
    },
    {
      id: 'testing',
      type: 'sequential',
      dependsOn: ['implementation'],
      tasks: [
        {
          title: 'Write unit tests',
          specialty: 'testing'
        },
        {
          title: 'Write integration tests',
          specialty: 'testing'
        }
      ]
    }
  ]
};

await coordinator.executeWorkflow(workflow);
```

**Result:** Complete feature implemented with proper dependencies and parallel execution

### 3. Collaborative Architecture Decision

**Scenario:** Design microservices architecture with input from multiple experts

**Setup:**
```bash
# Terminal 1 - Team Leader
/orchestrate team-leader

# Terminal 2 - Backend Expert
AGENT_NAME="Backend-Expert" AGENT_SPECIALTY="backend" /orchestrate collaborator

# Terminal 3 - Frontend Expert
AGENT_NAME="Frontend-Expert" AGENT_SPECIALTY="frontend" /orchestrate collaborator

# Terminal 4 - DevOps Expert
AGENT_NAME="DevOps-Expert" AGENT_SPECIALTY="devops" /orchestrate collaborator

# Terminal 5 - Security Expert
AGENT_NAME="Security-Expert" AGENT_SPECIALTY="security" /orchestrate collaborator
```

**Workflow:**
```javascript
// Terminal 1 - Leader
await leader.assignTask({
  title: "Design e-commerce microservices architecture",
  description: "Design scalable, secure microservices architecture for e-commerce platform with 1M users",
  priority: "critical",
  requiresCollaboration: true,
  collaborationQuestion: "How should we structure microservices for user, product, order, payment, and notification services?",
  requiredAgents: ["backend", "frontend", "devops", "security"],
  context: {
    requirements: {
      users: 1000000,
      expectedTraffic: "10000 req/sec",
      availability: "99.9%",
      compliance: ["PCI-DSS", "GDPR"]
    }
  }
});
```

**Brainstorm Responses:**

**Backend Expert:**
```
Recommendation: Use event-driven architecture with Kafka
- User service (authentication, profiles)
- Product service (catalog, inventory)
- Order service (order management)
- Payment service (payment processing)
- Notification service (emails, SMS)

Pros:
- Loose coupling
- Scalability
- Fault isolation

Cons:
- Increased complexity
- Eventual consistency
```

**Frontend Expert:**
```
Recommendation: BFF (Backend for Frontend) pattern
- Separate gateways for web and mobile
- GraphQL for flexible queries
- REST fallback for simple operations

Pros:
- Optimized for each client
- Reduced over-fetching

Cons:
- Additional infrastructure
- Code duplication
```

**DevOps Expert:**
```
Recommendation: Kubernetes-based deployment
- Service mesh (Istio) for communication
- Auto-scaling for each service
- Separate databases per service

Pros:
- Easy scaling
- Service discovery
- Traffic management

Cons:
- Kubernetes complexity
- Resource overhead
```

**Security Expert:**
```
Recommendation: Zero-trust security model
- API gateway with JWT authentication
- Service-to-service mTLS
- Encrypt sensitive data at rest
- Payment service PCI-DSS compliant

Pros:
- Strong security posture
- Compliance ready

Cons:
- Performance impact
- Certificate management
```

**Synthesis (by Worker):**
```
Final Decision: Event-driven microservices with BFF

Architecture:
1. Services:
   - User Service (auth, profiles)
   - Product Service (catalog)
   - Order Service (orders)
   - Payment Service (PCI-compliant)
   - Notification Service (events)

2. Communication:
   - Sync: REST/gRPC via service mesh
   - Async: Kafka for events

3. Frontend:
   - BFF layer with GraphQL
   - Separate gateways for web/mobile

4. Infrastructure:
   - Kubernetes deployment
   - Istio service mesh
   - Separate databases per service

5. Security:
   - API gateway (Kong/Apigee)
   - JWT authentication
   - mTLS between services
   - Encryption at rest

6. Compliance:
   - Payment service isolated (PCI-DSS)
   - Data handling (GDPR)
```

**Result:** Well-rounded architecture decision with input from all experts

### 4. CI/CD Integration

**Scenario:** Integrate orchestration into CI/CD pipeline

**Setup:**

`.github/workflows/test-and-deploy.yml`:
```yaml
name: Test and Deploy

on:
  push:
    branches: [main]

jobs:
  orchestrate-tests:
    runs-on: ubuntu-latest
    services:
      rabbitmq:
        image: rabbitmq:3.12-management
        ports:
          - 5672:5672
          - 15672:15672

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Start Team Leader
        run: |
          node scripts/orchestrator.js team-leader &
          LEADER_PID=$!

      - name: Start Workers
        run: |
          node scripts/orchestrator.js worker &
          node scripts/orchestrator.js worker &
          node scripts/orchestrator.js worker &

      - name: Assign Test Tasks
        run: |
          node - <<EOF
          const leader = new (await import('./scripts/orchestrator.js')).default('team-leader');
          await leader.initialize();
          await leader.startTeamLeader();

          await leader.assignTask({ title: 'Run unit tests', priority: 'critical' });
          await leader.assignTask({ title: 'Run integration tests', priority: 'high' });
          await leader.assignTask({ title: 'Run E2E tests', priority: 'normal' });
          EOF

      - name: Wait for Completion
        run: sleep 60

      - name: Check Results
        run: node scripts/check-results.js

      - name: Deploy
        if: success()
        run: npm run deploy
```

**Result:** Parallel test execution in CI/CD, faster pipeline

### 5. Data Processing Pipeline

**Scenario:** Process large dataset in parallel

**Setup:**
```bash
# Terminal 1 - Coordinator
/orchestrate coordinator

# Terminals 2-5 - Data Processors
/orchestrate worker
```

**Workflow:**
```javascript
// Split large dataset into chunks
const dataset = loadLargeDataset(); // 1M records
const chunkSize = 10000;
const chunks = splitIntoChunks(dataset, chunkSize); // 100 chunks

// Assign each chunk as a task
for (let i = 0; i < chunks.length; i++) {
  await coordinator.assignTask({
    title: `Process chunk ${i + 1}/${chunks.length}`,
    description: `Transform and validate data chunk`,
    priority: "normal",
    context: {
      chunkId: i,
      data: chunks[i]
    }
  });
}

// Workers process chunks in parallel
// Results aggregated by coordinator

// Reduce phase
let processedCount = 0;
const results = [];

await coordinator.client.consumeResults('agent.results', async (msg) => {
  results.push(msg.result);
  processedCount++;

  console.log(`Progress: ${processedCount}/${chunks.length} (${(processedCount / chunks.length * 100).toFixed(1)}%)`);

  if (processedCount === chunks.length) {
    console.log('All chunks processed!');
    const finalDataset = mergeResults(results);
    await saveFinalDataset(finalDataset);
  }
});
```

**Result:** 1M records processed 4x faster (4 workers) than single-threaded

### 6. Multi-Repository Development

**Scenario:** Coordinate work across multiple repositories

**Setup:**
```bash
# Terminal 1 - Team Leader (main coordination repo)
cd ~/coordination-repo
/orchestrate team-leader

# Terminal 2 - Worker (backend repo)
cd ~/backend-repo
AGENT_SPECIALTY="backend" /orchestrate worker

# Terminal 3 - Worker (frontend repo)
cd ~/frontend-repo
AGENT_SPECIALTY="frontend" /orchestrate worker

# Terminal 4 - Worker (infrastructure repo)
cd ~/infrastructure-repo
AGENT_SPECIALTY="devops" /orchestrate worker
```

**Workflow:**
```javascript
// Terminal 1 - Assign cross-repo tasks
await leader.assignTask({
  title: "Add new API endpoint",
  description: "Add /api/users endpoint in backend repo",
  priority: "high",
  context: {
    repository: "backend",
    specialty: "backend"
  }
});

await leader.assignTask({
  title: "Update frontend to use new API",
  description: "Integrate /api/users endpoint in frontend",
  priority: "high",
  context: {
    repository: "frontend",
    specialty: "frontend",
    dependsOn: ["Add new API endpoint"]
  }
});

await leader.assignTask({
  title: "Update infrastructure for new service",
  description: "Add routing for new endpoint",
  priority: "normal",
  context: {
    repository: "infrastructure",
    specialty: "devops"
  }
});
```

**Result:** Coordinated changes across multiple repositories

---

## Monitoring & Operations

### Health Monitoring

#### Agent Health

**Monitor agent connectivity:**

```javascript
// Track agent heartbeats
const agents = new Map();

await client.subscribeStatus('agent.status.connected', async (msg) => {
  const { agentId, agentType } = msg.status;

  agents.set(agentId, {
    type: agentType,
    connectedAt: Date.now(),
    lastSeen: Date.now(),
    status: 'connected'
  });

  console.log(`✅ Agent connected: ${agentId} (${agentType})`);
});

await client.subscribeStatus('agent.status.disconnected', async (msg) => {
  const { agentId } = msg.status;

  if (agents.has(agentId)) {
    agents.get(agentId).status = 'disconnected';
    console.log(`❌ Agent disconnected: ${agentId}`);
  }
});

// Periodic health check
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 1 minute

  for (const [agentId, agent] of agents.entries()) {
    if (now - agent.lastSeen > timeout && agent.status === 'connected') {
      console.log(`⚠️ Agent unresponsive: ${agentId}`);
      agent.status = 'unresponsive';

      // Send alert
      sendAlert({
        type: 'agent_unresponsive',
        agentId,
        lastSeen: agent.lastSeen
      });
    }
  }
}, 30000);
```

**Agent health dashboard:**

```javascript
function displayAgentHealth() {
  console.log('\n📊 AGENT HEALTH');
  console.log('═══════════════════════════════════════');

  const byStatus = {};
  for (const agent of agents.values()) {
    byStatus[agent.status] = (byStatus[agent.status] || 0) + 1;
  }

  console.log(`Total: ${agents.size}`);
  console.log(`Connected: ${byStatus.connected || 0}`);
  console.log(`Disconnected: ${byStatus.disconnected || 0}`);
  console.log(`Unresponsive: ${byStatus.unresponsive || 0}`);

  console.log('\nAgents:');
  for (const [agentId, agent] of agents.entries()) {
    const statusIcon = agent.status === 'connected' ? '✅' :
                       agent.status === 'unresponsive' ? '⚠️' : '❌';
    const uptime = Math.floor((Date.now() - agent.connectedAt) / 1000);

    console.log(`  ${statusIcon} ${agentId} (${agent.type}) - ${agent.status} - Uptime: ${uptime}s`);
  }
}

// Update every 10 seconds
setInterval(displayAgentHealth, 10000);
```

#### Queue Metrics

**Monitor queue depths:**

```javascript
async function getQueueMetrics() {
  // Using RabbitMQ Management API
  const response = await fetch('http://localhost:15672/api/queues', {
    headers: {
      'Authorization': 'Basic ' + Buffer.from('guest:guest').toString('base64')
    }
  });

  const queues = await response.json();

  const metrics = {};
  for (const queue of queues) {
    if (queue.name.startsWith('agent.')) {
      metrics[queue.name] = {
        messages: queue.messages,
        messagesReady: queue.messages_ready,
        messagesUnacked: queue.messages_unacknowledged,
        consumers: queue.consumers,
        messageRate: queue.message_stats?.publish_details?.rate || 0,
        ackRate: queue.message_stats?.ack_details?.rate || 0
      };
    }
  }

  return metrics;
}

// Monitor and alert
setInterval(async () => {
  const metrics = await getQueueMetrics();

  for (const [queue, stats] of Object.entries(metrics)) {
    console.log(`\n📋 ${queue}`);
    console.log(`  Messages: ${stats.messages}`);
    console.log(`  Ready: ${stats.messagesReady}`);
    console.log(`  Unacked: ${stats.messagesUnacked}`);
    console.log(`  Consumers: ${stats.consumers}`);
    console.log(`  Rate: ${stats.messageRate.toFixed(2)}/s`);

    // Alert on high queue depth
    if (stats.messagesReady > 100) {
      console.log(`  ⚠️ HIGH QUEUE DEPTH: ${stats.messagesReady} messages`);
      sendAlert({
        type: 'high_queue_depth',
        queue,
        depth: stats.messagesReady,
        consumers: stats.consumers
      });
    }

    // Alert on no consumers
    if (stats.consumers === 0 && stats.messages > 0) {
      console.log(`  ⚠️ NO CONSUMERS: ${stats.messages} messages waiting`);
      sendAlert({
        type: 'no_consumers',
        queue,
        messages: stats.messages
      });
    }
  }
}, 10000);
```

### Performance Tuning

#### Prefetch Optimization

**Determine optimal prefetch count:**

```javascript
function calculateOptimalPrefetch(config) {
  const {
    avgTaskDuration,    // ms
    workerCount,
    targetLatency       // ms
  } = config;

  // Calculate tasks per worker per target latency period
  const tasksPerPeriod = targetLatency / avgTaskDuration;

  // Prefetch should allow worker to always have work
  // but not hoard tasks
  const optimalPrefetch = Math.max(1, Math.ceil(tasksPerPeriod));

  return {
    prefetch: optimalPrefetch,
    reasoning: `With ${avgTaskDuration}ms avg task duration and ${targetLatency}ms target latency, each worker should prefetch ${optimalPrefetch} task(s)`
  };
}

// Example
const result = calculateOptimalPrefetch({
  avgTaskDuration: 2000,   // 2 seconds
  workerCount: 5,
  targetLatency: 1000      // 1 second max wait
});

console.log(result);
// { prefetch: 1, reasoning: '...' }

// Apply
await channel.prefetch(result.prefetch);
```

**Prefetch strategies:**

```javascript
// Conservative (fair distribution, lower throughput)
await channel.prefetch(1);

// Balanced
await channel.prefetch(3);

// Aggressive (higher throughput, less fair)
await channel.prefetch(10);

// Dynamic (adjust based on load)
async function dynamicPrefetch() {
  const queueDepth = await getQueueDepth('agent.tasks');
  const workerCount = await getWorkerCount();

  if (queueDepth > 100) {
    // High load - increase prefetch
    return Math.min(10, Math.ceil(queueDepth / workerCount));
  } else if (queueDepth < 10) {
    // Low load - decrease prefetch for fairness
    return 1;
  } else {
    // Normal load
    return 3;
  }
}

setInterval(async () => {
  const prefetch = await dynamicPrefetch();
  await channel.prefetch(prefetch);
}, 60000);
```

#### Connection Pooling

**Multiple connections for high throughput:**

```javascript
class ConnectionPool {
  constructor(config) {
    this.config = config;
    this.connections = [];
    this.channels = [];
  }

  async initialize(poolSize = 5) {
    for (let i = 0; i < poolSize; i++) {
      const connection = await amqp.connect(this.config.url);
      const channel = await connection.createChannel();

      this.connections.push(connection);
      this.channels.push(channel);
    }
  }

  getChannel() {
    // Round-robin
    return this.channels[Math.floor(Math.random() * this.channels.length)];
  }

  async close() {
    for (const channel of this.channels) {
      await channel.close();
    }
    for (const connection of this.connections) {
      await connection.close();
    }
  }
}

// Usage
const pool = new ConnectionPool({ url: 'amqp://localhost:5672' });
await pool.initialize(5);

// Publish with different connections
for (let i = 0; i < 1000; i++) {
  const channel = pool.getChannel();
  await channel.sendToQueue('agent.tasks', Buffer.from(JSON.stringify(task)));
}
```

#### Message Batching

**Batch publish for better performance:**

```javascript
async function batchPublish(tasks, batchSize = 100) {
  const batches = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    batches.push(tasks.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    // Publish all in batch
    for (const task of batch) {
      channel.sendToQueue('agent.tasks', Buffer.from(JSON.stringify(task)), {
        persistent: true
      });
    }

    // Wait for confirms
    await channel.waitForConfirms();

    console.log(`Published batch of ${batch.length} tasks`);
  }
}

// Usage
await channel.confirmSelect();
await batchPublish(largeTasks Array, 100);
```

### Scaling Strategies

#### Horizontal Scaling

**Add more workers:**

```bash
# Start additional workers dynamically
for i in {6..10}; do
  AGENT_NAME="Worker-$i" node scripts/orchestrator.js worker &
done
```

**Auto-scaling based on queue depth:**

```javascript
async function autoScale() {
  const queueDepth = await getQueueDepth('agent.tasks');
  const workerCount = await getWorkerCount();
  const targetWorkersPerTask = 0.1; // 1 worker per 10 tasks

  const neededWorkers = Math.ceil(queueDepth * targetWorkersPerTask);

  if (neededWorkers > workerCount) {
    const toAdd = neededWorkers - workerCount;
    console.log(`⚡ Scaling up: Adding ${toAdd} workers`);

    // In Kubernetes, scale deployment
    // kubectl scale deployment worker --replicas=${neededWorkers}

    // Or start locally
    for (let i = 0; i < toAdd; i++) {
      startWorker();
    }
  } else if (neededWorkers < workerCount - 2) {
    console.log(`⚡ Scaling down: Queue depth low`);
    // Signal workers to gracefully shutdown
  }
}

setInterval(autoScale, 60000);
```

#### Vertical Scaling

**Increase worker capacity:**

```javascript
// More concurrent tasks per worker
await channel.prefetch(10);

// Multiple processing threads (if applicable)
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  // Worker process
  const worker = new AgentOrchestrator('worker');
  await worker.initialize();
  await worker.startWorker();
}
```

#### Queue Partitioning

**Separate queues by priority or specialty:**

```javascript
// Priority queues
await setupTaskQueue('agent.tasks.critical');
await setupTaskQueue('agent.tasks.high');
await setupTaskQueue('agent.tasks.normal');
await setupTaskQueue('agent.tasks.low');

// Workers consume by priority
await consumeTasks('agent.tasks.critical', handler, { priority: 10 });
await consumeTasks('agent.tasks.high', handler, { priority: 5 });
await consumeTasks('agent.tasks.normal', handler, { priority: 1 });
await consumeTasks('agent.tasks.low', handler, { priority: 0 });

// Specialty queues
await setupTaskQueue('agent.tasks.backend');
await setupTaskQueue('agent.tasks.frontend');
await setupTaskQueue('agent.tasks.database');

// Specialized workers
AGENT_SPECIALTY="backend" consumeTasks('agent.tasks.backend', handler);
```

---

## Troubleshooting

### Common Issues

#### 1. Cannot Connect to RabbitMQ

**Symptoms:**
```
❌ Failed to connect: Error: connect ECONNREFUSED 127.0.0.1:5672
```

**Solutions:**

**Check RabbitMQ is running:**
```bash
# Docker
docker ps | grep rabbitmq

# If not running
docker start rabbitmq

# Check logs
docker logs rabbitmq

# Native
sudo systemctl status rabbitmq-server

# If not running
sudo systemctl start rabbitmq-server
```

**Verify connection:**
```bash
# Test AMQP port
telnet localhost 5672

# Test Management UI
curl http://localhost:15672

# Check firewall
sudo ufw status
```

**Check environment:**
```bash
# Verify .env file
cat .env | grep RABBITMQ_URL

# Test with explicit URL
RABBITMQ_URL=amqp://localhost:5672 node scripts/orchestrator.js worker
```

#### 2. Tasks Not Being Picked Up

**Symptoms:**
- Tasks published but no workers process them
- Queue depth increasing

**Solutions:**

**Check workers are connected:**
```bash
/status agents
```

**Check queue consumers:**
```javascript
const info = await channel.checkQueue('agent.tasks');
console.log('Consumers:', info.consumerCount);

// If 0, start workers
```

**Verify queue name:**
```javascript
// Publisher
await channel.sendToQueue('agent.tasks', msg);

// Consumer - must match!
await channel.consume('agent.tasks', handler);
```

**Check prefetch:**
```javascript
// Ensure prefetch is set
await channel.prefetch(1);
```

#### 3. High Queue Depth

**Symptoms:**
- Queue depth > 100
- Tasks backing up
- Slow processing

**Solutions:**

**Start more workers:**
```bash
# Terminals 6-10
for i in {6..10}; do
  AGENT_NAME="Worker-$i" node scripts/orchestrator.js worker &
done
```

**Check worker performance:**
```bash
/status performance
```

**Investigate slow tasks:**
```javascript
// Add timing
const start = Date.now();
await processTask(task);
const duration = Date.now() - start;

if (duration > 10000) {
  console.log(`⚠️ Slow task: ${task.title} took ${duration}ms`);
}
```

**Optimize task processing:**
```javascript
// Parallel processing where possible
await Promise.all([
  subtask1(),
  subtask2(),
  subtask3()
]);

// Instead of:
await subtask1();
await subtask2();
await subtask3();
```

#### 4. Messages Lost

**Symptoms:**
- Tasks published but never received
- No errors, but tasks disappear

**Solutions:**

**Use persistent messages:**
```javascript
await channel.sendToQueue('agent.tasks', msg, {
  persistent: true  // Survive broker restart
});
```

**Use durable queues:**
```javascript
await channel.assertQueue('agent.tasks', {
  durable: true  // Queue survives restart
});
```

**Acknowledge only after success:**
```javascript
await consumeTasks('agent.tasks', async (msg, { ack, nack }) => {
  try {
    await processTask(msg.task);
    ack();  // Only after success!
  } catch (error) {
    nack(true);  // Requeue on failure
  }
});
```

**Use publisher confirms:**
```javascript
await channel.confirmSelect();
await channel.sendToQueue('agent.tasks', msg);
await channel.waitForConfirms();  // Ensure delivered
```

#### 5. Agent Keeps Disconnecting

**Symptoms:**
- Agent connects then disconnects repeatedly
- Connection timeout errors

**Solutions:**

**Enable auto-reconnect:**
```javascript
const client = new RabbitMQClient({
  autoReconnect: true,
  maxReconnectAttempts: 10
});
```

**Increase heartbeat:**
```javascript
const client = new RabbitMQClient({
  heartbeat: 60  // 60 seconds (default is 30)
});
```

**Check network stability:**
```bash
# Ping RabbitMQ host
ping -c 10 localhost

# Check for packet loss
```

**Monitor connection:**
```javascript
client.on('disconnected', () => {
  console.log('Disconnected - will retry...');
});

client.on('connected', () => {
  console.log('Reconnected successfully');
});
```

#### 6. Brainstorm No Responses

**Symptoms:**
- Brainstorm broadcast but no responses
- Timeout waiting for input

**Solutions:**

**Check collaborators are connected:**
```bash
/status agents
```

**Verify exchange binding:**
```javascript
// Exchange must be fanout
await channel.assertExchange('agent.brainstorm', 'fanout', {
  durable: true
});

// Each agent must bind their queue
await channel.bindQueue(queueName, 'agent.brainstorm', '');
```

**Check collaborators are listening:**
```javascript
// In collaborator
await client.listenBrainstorm(queue, async (msg) => {
  console.log('Received brainstorm:', msg);
  // ... handle and respond
});
```

**Increase timeout:**
```javascript
await initiateBrainstorm({
  topic: "...",
  question: "...",
  timeout: 120000  // 2 minutes instead of default 1 minute
});
```

#### 7. Results Not Aggregated

**Symptoms:**
- Workers complete tasks but leader doesn't receive results
- Results queue empty

**Solutions:**

**Verify result publishing:**
```javascript
// In worker
await publishResult({
  taskId: task.id,
  status: 'completed',
  output: result
});
```

**Check team leader is consuming:**
```javascript
// In team leader
await client.consumeResults('agent.results', async (msg) => {
  console.log('Received result:', msg.result);
});
```

**Verify queue names match:**
```javascript
// Publisher
await channel.sendToQueue('agent.results', msg);

// Consumer
await channel.consume('agent.results', handler);
```

### Debug Mode

**Enable verbose logging:**

```bash
# Set debug environment
DEBUG=rabbitmq:* node scripts/orchestrator.js worker

# Or in code
process.env.DEBUG = 'rabbitmq:*';
```

**Add detailed logging:**

```javascript
class RabbitMQClient extends EventEmitter {
  async connect() {
    console.log('[DEBUG] Connecting to:', this.config.url);

    this.connection = await amqp.connect(this.config.url);
    console.log('[DEBUG] Connection established');

    this.channel = await this.connection.createChannel();
    console.log('[DEBUG] Channel created');

    // ... rest of setup
  }

  async publishTask(task) {
    console.log('[DEBUG] Publishing task:', task.title);
    // ... publish
    console.log('[DEBUG] Task published successfully');
  }

  async consumeTasks(queue, handler) {
    console.log('[DEBUG] Starting consumer on:', queue);

    await this.channel.consume(queue, async (msg) => {
      console.log('[DEBUG] Received message:', msg.properties.messageId);
      // ... handle
      console.log('[DEBUG] Message handled');
    });
  }
}
```

### Diagnostic Commands

**Check RabbitMQ status:**
```bash
# List queues
rabbitmqctl list_queues name messages consumers

# List exchanges
rabbitmqctl list_exchanges name type

# List bindings
rabbitmqctl list_bindings

# Node status
rabbitmqctl status

# Cluster status (if clustered)
rabbitmqctl cluster_status
```

**Monitor RabbitMQ:**
```bash
# Management UI
open http://localhost:15672

# CLI monitoring
watch -n 1 'rabbitmqctl list_queues name messages consumers'
```

**Test message flow:**
```javascript
// Test script
const client = new RabbitMQClient();
await client.connect();

// Publish test message
console.log('Publishing test message...');
await client.publishTask({ title: 'Test task' });

// Consume test message
console.log('Waiting for test message...');
await client.consumeTasks('agent.tasks', async (msg, { ack }) => {
  console.log('Received test message:', msg.task.title);
  ack();
  process.exit(0);
});

// Timeout
setTimeout(() => {
  console.error('Timeout - message not received');
  process.exit(1);
}, 10000);
```

---

## API Reference

### RabbitMQClient

**Constructor:**
```javascript
new RabbitMQClient(config)
```

**Parameters:**
- `config.url` - RabbitMQ connection URL (default: `amqp://localhost:5672`)
- `config.heartbeat` - Heartbeat interval in seconds (default: 30)
- `config.autoReconnect` - Enable auto-reconnect (default: true)
- `config.prefetchCount` - Prefetch count (default: 1)

**Methods:**

```javascript
// Connection
async connect()
async reconnect()
async close()
boolean isHealthy()

// Queue operations
async setupTaskQueue(queueName = 'agent.tasks')
async setupResultQueue(queueName = 'agent.results')
async publishTask(task, queueName = 'agent.tasks')
async consumeTasks(queueName, handler)
async consumeResults(queueName, handler)

// Exchange operations
async setupBrainstormExchange(exchangeName = 'agent.brainstorm')
async setupStatusExchange(exchangeName = 'agent.status')
async broadcastBrainstorm(message, exchangeName = 'agent.brainstorm')
async listenBrainstorm(queueName, handler)
async publishStatus(status, routingKey, exchangeName = 'agent.status')
async subscribeStatus(pattern, handler, exchangeName = 'agent.status')
```

**Events:**
- `connected` - Connection established
- `disconnected` - Connection lost
- `error` - Error occurred
- `max_reconnect_reached` - Max reconnect attempts reached

**Example:**
```javascript
const client = new RabbitMQClient({
  url: 'amqp://localhost:5672',
  heartbeat: 30,
  autoReconnect: true,
  prefetchCount: 1
});

client.on('connected', () => {
  console.log('Connected!');
});

client.on('error', (error) => {
  console.error('Error:', error);
});

await client.connect();
```

### AgentOrchestrator

**Constructor:**
```javascript
new AgentOrchestrator(agentType)
```

**Parameters:**
- `agentType` - Agent type: `'team-leader'`, `'worker'`, `'collaborator'`, `'coordinator'`

**Methods:**

```javascript
// Initialization
async initialize()
async shutdown()

// Agent types
async startTeamLeader()
async startWorker()
async startCollaborator()

// Task operations
async assignTask(task)
async handleTask(msg, { ack, nack, reject })

// Brainstorming
async initiateBrainstorm(session)
async handleBrainstormMessage(msg)

// Results
async publishResult(result)
async handleResult(msg)

// Status
async publishStatus(status, routingKey)
async handleStatusUpdate(msg)

// Statistics
object getStats()
```

**Example:**
```javascript
// Team Leader
const leader = new AgentOrchestrator('team-leader');
await leader.initialize();
await leader.startTeamLeader();

await leader.assignTask({
  title: "Implement feature",
  description: "Details...",
  priority: "high"
});

// Worker
const worker = new AgentOrchestrator('worker');
await worker.initialize();
await worker.startWorker();

// Stats
const stats = worker.getStats();
console.log(stats);
// {
//   tasksReceived: 10,
//   tasksCompleted: 8,
//   tasksFailed: 1,
//   brainstormsParticipated: 3,
//   resultsPublished: 8,
//   activeTasks: 1,
//   activeBrainstorms: 0,
//   totalResults: 8
// }
```

---

## Configuration Guide

### Environment Variables

**RabbitMQ Connection:**
```bash
RABBITMQ_URL=amqp://localhost:5672      # Full connection URL
RABBITMQ_HOST=localhost                 # Host (if not using URL)
RABBITMQ_PORT=5672                      # Port
RABBITMQ_USER=guest                     # Username
RABBITMQ_PASSWORD=guest                 # Password
RABBITMQ_VHOST=/                        # Virtual host
```

**Agent Configuration:**
```bash
AGENT_ID=agent-${RANDOM}                # Agent ID (auto-generated if not set)
AGENT_TYPE=worker                       # Agent type
AGENT_NAME=Claude-Agent-1               # Agent display name
AGENT_SPECIALTY=backend                 # Agent specialty (optional)
```

**Queue Configuration:**
```bash
TASK_QUEUE=agent.tasks                  # Task queue name
BRAINSTORM_EXCHANGE=agent.brainstorm    # Brainstorm exchange name
RESULT_QUEUE=agent.results              # Result queue name
STATUS_EXCHANGE=agent.status            # Status exchange name
```

**Monitoring:**
```bash
HEARTBEAT_INTERVAL=30000                # Heartbeat interval (ms)
HEALTH_CHECK_INTERVAL=10000             # Health check interval (ms)
MESSAGE_TIMEOUT=300000                  # Message timeout (ms)
```

**Features:**
```bash
AUTO_RECONNECT=true                     # Enable auto-reconnect
PERSISTENT_MESSAGES=true                # Use persistent messages
PREFETCH_COUNT=1                        # Prefetch count for fair dispatch
```

### Configuration Files

**.env.example:**
```bash
# Copy to .env and customize
cp .env.example .env
nano .env
```

**hooks/hooks.json:**
```json
{
  "hooks": {
    "session-start": {
      "description": "Initialize RabbitMQ connection",
      "enabled": false,
      "command": "node scripts/hooks/session-start.js"
    },
    "health-check": {
      "description": "Periodic health check",
      "enabled": true,
      "command": "node scripts/hooks/health-check.js",
      "interval": 30000
    }
  }
}
```

**.claude-plugin/plugin.json:**
```json
{
  "name": "ai-agent-orchestrator-rabbitmq",
  "version": "1.0.0",
  "description": "Multi-agent orchestration system",
  "agents": [
    "agents/team-leader.md",
    "agents/worker-agent.md",
    "agents/collaborator-agent.md",
    "agents/coordinator-agent.md",
    "agents/monitor-agent.md"
  ],
  "commands": [
    "commands/orchestrate.md",
    "commands/assign-task.md",
    "commands/brainstorm.md",
    "commands/status.md",
    "commands/join-team.md"
  ],
  "skills": [
    "skills/rabbitmq-ops/SKILL.md",
    "skills/task-distribution/SKILL.md",
    "skills/collaboration/SKILL.md",
    "skills/result-aggregation/SKILL.md",
    "skills/health-monitoring/SKILL.md"
  ]
}
```

---

## Best Practices

### 1. Message Design

**Keep messages small:**
```javascript
// Good - reference data
await publishTask({
  title: "Process file",
  fileId: "file-123",
  bucket: "s3://data"
});

// Bad - embed large data
await publishTask({
  title: "Process file",
  fileContents: largeDataBuffer  // Too large!
});
```

**Use JSON for structured data:**
```javascript
await publishTask({
  title: "Task",
  context: {
    database: "PostgreSQL",
    table: "users",
    action: "migrate"
  }
});
```

**Include metadata:**
```javascript
await publishTask({
  title: "Task",
  metadata: {
    assignedAt: Date.now(),
    assignedBy: agentId,
    priority: "high",
    retryCount: 3
  }
});
```

### 2. Error Handling

**Categorize errors:**
```javascript
class TransientError extends Error {
  constructor(message) {
    super(message);
    this.isTransient = true;  // Retryable
  }
}

class PermanentError extends Error {
  constructor(message) {
    super(message);
    this.isPermanent = true;  // Not retryable
  }
}

// In handler
try {
  await processTask(task);
  ack();
} catch (error) {
  if (error.isTransient) {
    nack(true);  // Requeue
  } else {
    reject();  // Dead letter
  }
}
```

**Implement circuit breaker:**
```javascript
let consecutiveFailures = 0;
const threshold = 5;

await consumeTasks('agent.tasks', async (msg, { ack, nack }) => {
  try {
    await processTask(msg.task);
    consecutiveFailures = 0;  // Reset on success
    ack();
  } catch (error) {
    consecutiveFailures++;

    if (consecutiveFailures >= threshold) {
      console.error('Circuit breaker open - stopping consumer');
      await channel.cancel(consumerTag);

      // Wait before retry
      setTimeout(async () => {
        consecutiveFailures = 0;
        // Restart consumer
      }, 60000);
    }

    nack(true);
  }
});
```

**Log errors with context:**
```javascript
try {
  await processTask(task);
} catch (error) {
  console.error('Task processing failed:', {
    taskId: task.id,
    taskTitle: task.title,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Send to error tracking service
  await trackError(error, { task });
}
```

### 3. Performance

**Batch operations:**
```javascript
// Batch publish
const tasks = [...];
for (const task of tasks) {
  channel.sendToQueue('agent.tasks', Buffer.from(JSON.stringify(task)));
}
await channel.waitForConfirms();

// Instead of:
for (const task of tasks) {
  await channel.sendToQueue(...);  // Slow!
}
```

**Use connection pooling:**
```javascript
// Multiple channels for parallel publishing
const channels = await Promise.all([
  connection.createChannel(),
  connection.createChannel(),
  connection.createChannel()
]);

// Round-robin publish
let channelIndex = 0;
for (const task of tasks) {
  const channel = channels[channelIndex % channels.length];
  await channel.sendToQueue('agent.tasks', ...);
  channelIndex++;
}
```

**Optimize prefetch:**
```javascript
// Fair distribution
await channel.prefetch(1);

// High throughput (if workers can handle it)
await channel.prefetch(10);
```

### 4. Reliability

**Use persistent messages:**
```javascript
await channel.sendToQueue('agent.tasks', msg, {
  persistent: true
});
```

**Use durable queues:**
```javascript
await channel.assertQueue('agent.tasks', {
  durable: true
});
```

**Implement dead letter queue:**
```javascript
await channel.assertQueue('agent.tasks', {
  arguments: {
    'x-dead-letter-exchange': 'dlx',
    'x-dead-letter-routing-key': 'failed'
  }
});

// Monitor DLQ
await channel.consume('dlq.tasks', async (msg) => {
  console.error('Task failed permanently:', msg);
  // Alert, log, investigate
});
```

**Use publisher confirms:**
```javascript
await channel.confirmSelect();
await channel.sendToQueue('agent.tasks', msg);
await channel.waitForConfirms();  // Ensure delivered
```

### 5. Monitoring

**Track key metrics:**
```javascript
const metrics = {
  tasksPublished: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  avgDuration: 0,
  queueDepth: 0
};

// Update on publish
metrics.tasksPublished++;

// Update on completion
metrics.tasksCompleted++;
metrics.avgDuration = calculateAverage(durations);

// Monitor queue
setInterval(async () => {
  const info = await channel.checkQueue('agent.tasks');
  metrics.queueDepth = info.messageCount;
}, 10000);
```

**Set up alerts:**
```javascript
// Alert on high queue depth
if (queueDepth > 100) {
  sendAlert('High queue depth', { depth: queueDepth });
}

// Alert on high failure rate
const failureRate = tasksFailed / (tasksCompleted + tasksFailed);
if (failureRate > 0.1) {
  sendAlert('High failure rate', { rate: failureRate });
}

// Alert on agent disconnect
agent.on('disconnected', () => {
  sendAlert('Agent disconnected', { agentId: agent.id });
});
```

### 6. Security

**Use authentication:**
```javascript
const client = new RabbitMQClient({
  url: 'amqp://username:password@localhost:5672'
});
```

**Use TLS:**
```javascript
const client = new RabbitMQClient({
  url: 'amqps://localhost:5671',
  tls: {
    ca: fs.readFileSync('ca.pem'),
    cert: fs.readFileSync('cert.pem'),
    key: fs.readFileSync('key.pem')
  }
});
```

**Validate messages:**
```javascript
await consumeTasks('agent.tasks', async (msg, { ack, reject }) => {
  // Validate structure
  if (!msg.task || !msg.task.title) {
    console.error('Invalid message structure');
    reject();  // Don't requeue
    return;
  }

  // Validate content
  if (msg.task.title.length > 200) {
    console.error('Title too long');
    reject();
    return;
  }

  // Process
  await processTask(msg.task);
  ack();
});
```

---

## Performance Tuning

(Content covered in Monitoring & Operations section)

---

## Security

### Authentication

**Configure RabbitMQ users:**

```bash
# Create user
rabbitmqctl add_user orchestrator secure_password

# Set permissions
rabbitmqctl set_permissions -p / orchestrator ".*" ".*" ".*"

# Remove default guest user (production)
rabbitmqctl delete_user guest
```

**Use in client:**
```bash
RABBITMQ_URL=amqp://orchestrator:secure_password@localhost:5672
```

### TLS/SSL

**Enable TLS in RabbitMQ:**

rabbitmq.conf:
```
listeners.ssl.default = 5671
ssl_options.cacertfile = /path/to/ca.pem
ssl_options.certfile = /path/to/cert.pem
ssl_options.keyfile = /path/to/key.pem
ssl_options.verify = verify_peer
ssl_options.fail_if_no_peer_cert = true
```

**Connect with TLS:**
```javascript
const client = new RabbitMQClient({
  url: 'amqps://localhost:5671',
  tls: {
    ca: fs.readFileSync('ca.pem'),
    cert: fs.readFileSync('cert.pem'),
    key: fs.readFileSync('key.pem')
  }
});
```

### Message Validation

**Validate all incoming messages:**

```javascript
const Joi = require('joi');

const taskSchema = Joi.object({
  title: Joi.string().required().max(200),
  description: Joi.string().max(2000),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical'),
  context: Joi.object()
});

await consumeTasks('agent.tasks', async (msg, { ack, reject }) => {
  // Validate
  const { error, value } = taskSchema.validate(msg.task);

  if (error) {
    console.error('Invalid task:', error);
    reject();  // Don't requeue invalid messages
    return;
  }

  // Process validated task
  await processTask(value);
  ack();
});
```

### Access Control

**Virtual hosts for isolation:**

```bash
# Create vhost for production
rabbitmqctl add_vhost production

# Create vhost for development
rabbitmqctl add_vhost development

# Set permissions
rabbitmqctl set_permissions -p production orchestrator ".*" ".*" ".*"
```

**Use different vhosts:**
```bash
# Production
RABBITMQ_URL=amqp://user:pass@localhost:5672/production

# Development
RABBITMQ_URL=amqp://user:pass@localhost:5672/development
```

---

## Appendix

### Glossary

- **Agent** - A Claude Code instance running as part of the orchestration system
- **AMQP** - Advanced Message Queuing Protocol, used by RabbitMQ
- **Brainstorm** - Collaborative problem-solving session with multiple agents
- **Channel** - Lightweight connection within a RabbitMQ connection
- **Consumer** - Agent that consumes messages from a queue
- **Dead Letter Queue (DLQ)** - Queue for messages that failed processing
- **Exchange** - RabbitMQ component that routes messages to queues
- **Fanout** - Exchange type that broadcasts to all bound queues
- **Orchestrator** - Component that coordinates multi-agent tasks
- **Prefetch** - Number of unacknowledged messages a consumer can have
- **Producer** - Agent that publishes messages to a queue
- **Queue** - FIFO buffer for messages
- **Routing Key** - Key used to route messages to queues
- **Topic** - Exchange type with pattern-based routing
- **Worker** - Agent that executes tasks from the queue

### References

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [amqplib Documentation](https://amqp-node.github.io/amqplib/)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/getstarted.html)
- [Claude Code Documentation](https://claude.ai/docs)

### Change Log

**v1.0.0 (2025-11-17)**
- Initial release
- Multi-agent orchestration
- Task distribution
- Collaborative brainstorming
- Result aggregation
- Health monitoring
- 5 agent types
- 5 slash commands
- 5 skills

### Support

- **GitHub Issues:** https://github.com/umitkacar/plugin-ai-agent-rabbitmq/issues
- **Discussions:** https://github.com/umitkacar/plugin-ai-agent-rabbitmq/discussions

### License

MIT License - see LICENSE file for details

---

**End of Master Guide**

*This guide is comprehensive and covers all aspects of the AI Agent Orchestrator plugin. For specific use cases or advanced scenarios, refer to the relevant sections above.*
