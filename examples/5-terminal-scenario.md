# 5-Terminal Orchestration Scenario

This is the **EXACT scenario** you described - demonstrating the full power of multi-agent orchestration with RabbitMQ!

## The Scenario

5 terminals, 5 Claude Code sessions, all communicating through RabbitMQ:

1. **Terminal 1** - Team Leader (assigns work, aggregates results)
2. **Terminal 2** - Worker (picks up task, initiates brainstorm)
3. **Terminal 3** - Collaborator (participates in brainstorm)
4. **Terminal 4** - Collaborator (participates in brainstorm)
5. **Terminal 5** - Worker (attempts task, fails, reports back)

## Step-by-Step Execution

### Step 1: Start RabbitMQ

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management

# Verify
curl http://localhost:15672
# Username: guest, Password: guest
```

### Step 2: Terminal 1 - Team Leader

```bash
# Clone and setup
cd ~/plugin-ai-agent-rabbitmq
npm install

# Start as team leader
node src/core/orchestrator.js team-leader
```

**Output:**
```
🚀 Initializing team-leader orchestrator...
Agent ID: agent-team-leader-abc123
Agent Name: Agent-team-leader

✅ Connected to RabbitMQ as agent: agent-team-leader-abc123
📋 Setting up queues and exchanges...

📋 Task queue ready: agent.tasks
🧠 Brainstorm exchange ready: agent.brainstorm
📊 Result queue ready: agent.results
📡 Status exchange ready: agent.status

✅ All queues and exchanges ready

👔 Starting as TEAM LEADER...

👔 Team Leader ready - waiting for results and status updates
```

**Now assign a task:**
```javascript
// In Terminal 1 (after starting)
// The orchestrator exposes an API

await orchestrator.assignTask({
  title: "Design microservices architecture",
  description: "Choose between REST, GraphQL, and gRPC for inter-service communication",
  priority: "high",
  requiresCollaboration: true,
  collaborationQuestion: "What's the best approach for our microservices communication?",
  requiredAgents: ["backend", "frontend", "devops"]
});
```

### Step 3: Terminal 2 - Worker (Picks Up Task)

```bash
# In new terminal
cd ~/plugin-ai-agent-rabbitmq

# Start as worker
AGENT_NAME="Backend-Worker" node src/core/orchestrator.js worker
```

**Output:**
```
🚀 Initializing worker orchestrator...
Agent ID: agent-worker-xyz789
Agent Name: Backend-Worker

✅ Connected to RabbitMQ
⚙️  Starting as WORKER...
⚙️  Worker ready - waiting for tasks

📥 Received task: Design microservices architecture
   Description: Choose between REST, GraphQL, and gRPC...
   Priority: high

⚙️  Processing task...

🤝 Task requires collaboration - initiating brainstorm
🧠 Initiating brainstorm: Design microservices architecture
🧠 Brainstorm broadcasted to all agents
```

### Step 4: Terminal 3 - Collaborator (Joins Brainstorm)

```bash
# In new terminal
cd ~/plugin-ai-agent-rabbitmq

# Start as collaborator
AGENT_NAME="Frontend-Expert" node src/core/orchestrator.js collaborator
```

**Output:**
```
🚀 Initializing collaborator orchestrator...
Agent ID: agent-collab-def456
Agent Name: Frontend-Expert

✅ Connected to RabbitMQ
🤝 Starting as COLLABORATOR...
🤝 Collaborator ready - waiting for brainstorm sessions

🧠 Brainstorm request received:
   Topic: Design microservices architecture
   Question: What's the best approach for our microservices communication?
   From: agent-worker-xyz789

🤔 Analyzing...

💡 Frontend-Expert suggests:
   "GraphQL provides better client-side developer experience.
    Single endpoint, type-safe queries, reduced over-fetching.
    However, adds complexity on the backend."

🧠 Brainstorm response sent
```

### Step 5: Terminal 4 - Another Collaborator

```bash
# In new terminal
cd ~/plugin-ai-agent-rabbitmq

# Start as collaborator
AGENT_NAME="DevOps-Expert" node src/core/orchestrator.js collaborator
```

**Output:**
```
🚀 Initializing collaborator orchestrator...
Agent ID: agent-collab-ghi789
Agent Name: DevOps-Expert

✅ Connected to RabbitMQ
🤝 Starting as COLLABORATOR...

🧠 Brainstorm request received:
   Topic: Design microservices architecture
   Question: What's the best approach for our microservices communication?
   From: agent-worker-xyz789

🤔 Analyzing...

💡 DevOps-Expert suggests:
   "gRPC for internal services (high performance, efficient).
    REST for external APIs (wide compatibility).
    GraphQL adds operational complexity - monitoring, caching harder."

🧠 Brainstorm response sent
```

### Step 6: Terminal 2 - Worker Aggregates Brainstorm

**Back in Terminal 2:**
```
🧠 Brainstorm response from agent-collab-def456:
   Frontend-Expert suggests: GraphQL provides better client-side...

🧠 Brainstorm response from agent-collab-ghi789:
   DevOps-Expert suggests: gRPC for internal services...

🧠 Aggregating brainstorm responses...

📊 Decision: Hybrid approach
   - gRPC for internal service-to-service communication (performance)
   - REST for external APIs (compatibility)
   - Consider GraphQL for client-facing API later

✅ Task completed: Design microservices architecture

📊 Publishing result to team leader...
```

### Step 7: Terminal 1 - Team Leader Receives Result

**Back in Terminal 1:**
```
📊 Result received:
   Task: Design microservices architecture
   Status: completed
   From: agent-worker-xyz789
   Duration: 12543ms

   Decision: Hybrid approach
   - gRPC for internal communication
   - REST for external APIs
   - GraphQL for future consideration

   Brainstorm participants:
   - Frontend-Expert (agent-collab-def456)
   - DevOps-Expert (agent-collab-ghi789)

✅ Task successfully completed with team collaboration
```

### Step 8: Terminal 5 - Worker Fails Task

```bash
# In new terminal
cd ~/plugin-ai-agent-rabbitmq

# Start another worker
AGENT_NAME="Database-Worker" node src/core/orchestrator.js worker
```

**Assign a task that will fail:**
```javascript
// In Terminal 1
await orchestrator.assignTask({
  title: "Migrate database to new schema",
  description: "Update production database schema",
  priority: "critical"
});
```

**Terminal 5 output:**
```
📥 Received task: Migrate database to new schema
   Description: Update production database schema
   Priority: critical

⚙️  Processing task...

❌ Task failed: Connection timeout - database unreachable

📡 Publishing failure status to team leader...
```

### Step 9: Terminal 1 - Team Leader Updates Task

**Terminal 1 receives failure:**
```
🚨 Task failed:
   Task: Migrate database to new schema
   Agent: agent-worker-db-555
   Error: Connection timeout - database unreachable

👔 Updating task with retry strategy...
📋 Reassigning task with updated context...

📋 Task reassigned:
   - Added connection pool configuration
   - Increased timeout to 60s
   - Priority: critical (unchanged)
   - Retry count: 2
```

## Message Flow Diagram

```
Terminal 1 (Leader)
    │
    ├─► [Publishes] Task to agent.tasks queue
    │
    ▼
Terminal 2 (Worker)
    │
    ├─► [Consumes] Task from queue
    │
    ├─► [Publishes] Brainstorm to agent.brainstorm (fanout)
    │
    ├────────────────┬────────────────┐
    │                │                │
    ▼                ▼                ▼
Terminal 3       Terminal 4       Terminal 5
(Collaborator)   (Collaborator)   (Worker - fails)
    │                │                │
    ├─► Response     ├─► Response     ├─► Failure
    │                │                │
    └────────────────┴────────────────┘
                     │
                     ▼
              [agent.results queue]
                     │
                     ▼
              Terminal 1 (Leader)
                     │
                     ├─► Aggregates results
                     ├─► Makes decision
                     └─► Updates task (for Terminal 5 failure)
```

## Git Worktree Integration

Want to use git worktree for true parallel development?

```bash
# Main repo - Terminal 1
cd ~/my-project
/join-team leader

# Worktree 1 - Terminal 2
git worktree add ../my-project-worker1 feature-branch
cd ../my-project-worker1
/join-team worker

# Worktree 2 - Terminal 3
git worktree add ../my-project-collab1 feature-branch
cd ../my-project-collab1
/join-team collaborator

# Worktree 3 - Terminal 4
git worktree add ../my-project-collab2 feature-branch
cd ../my-project-collab2
/join-team collaborator

# Worktree 4 - Terminal 5
git worktree add ../my-project-worker2 feature-branch
cd ../my-project-worker2
/join-team worker
```

**Now all 5 terminals:**
- Work on the same repo
- Independent working directories
- Communicate via RabbitMQ
- Can collaborate in real-time
- No conflicts!

## Advanced: Keep Claude Active (No Sleep)

Create a monitoring script to keep agents active:

```bash
# scripts/keep-active.sh
#!/bin/bash

while true; do
  # Send heartbeat every 30 seconds
  node scripts/hooks/health-check.js

  sleep 30
done
```

Run in each terminal:
```bash
# Start agent in background
node src/core/orchestrator.js worker &

# Keep active in foreground
./scripts/keep-active.sh
```

## Real-World Example

Let's say you're building a full-stack feature:

```bash
# Terminal 1 - Team Leader
/orchestrate team-leader

# Assign feature components
/assign-task title="Backend API endpoints" specialty="backend"
/assign-task title="Frontend UI components" specialty="frontend"
/assign-task title="Database migrations" specialty="database"
/assign-task title="Integration tests" specialty="testing"

# Terminal 2 - Backend Specialist
AGENT_SPECIALTY="backend" /join-team worker
# Picks up: Backend API endpoints

# Terminal 3 - Frontend Specialist
AGENT_SPECIALTY="frontend" /join-team worker
# Picks up: Frontend UI components

# Terminal 4 - Database Specialist
AGENT_SPECIALTY="database" /join-team worker
# Picks up: Database migrations

# Terminal 5 - Test Specialist
AGENT_SPECIALTY="testing" /join-team worker
# Picks up: Integration tests

# All work in parallel!
# All communicate when needed!
# Team leader aggregates results!
```

## Monitoring Everything

Terminal 6 (bonus) - Monitor:
```bash
/orchestrate monitor

# See everything in real-time:
# - All 5 agents connected
# - Tasks being processed
# - Brainstorms happening
# - Results flowing
# - Performance metrics
```

## Key Features Demonstrated

✅ **Multi-terminal orchestration**
✅ **Task distribution and load balancing**
✅ **Real-time agent-to-agent communication**
✅ **Collaborative brainstorming (Terminals 2,3,4)**
✅ **Result aggregation (Terminal 1)**
✅ **Failure handling and task reassignment (Terminal 5)**
✅ **Independent agents that communicate**
✅ **Works with git worktree**
✅ **Microservice-like architecture**
✅ **Fully automated orchestration**

This is the **ULTRA ORCHESTRATION SYSTEM** you envisioned! 🚀
