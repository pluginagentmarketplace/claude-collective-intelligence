---
description: Start a Claude Code agent as part of the distributed orchestration system
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task, Skill
argument-hint: <agent-type> (team-leader|worker|collaborator|coordinator|monitor)
---

# Orchestrate - Start Multi-Agent Orchestration

Start a Claude Code agent as part of the distributed orchestration system.

## Usage

```bash
/orchestrate [agent-type]
```

## Agent Types

- `team-leader` - Coordinates work distribution and aggregates results
- `worker` - Executes assigned tasks from the queue
- `collaborator` - Participates in brainstorming and collaborative problem-solving
- `coordinator` - Manages complex workflows with dependencies
- `monitor` - Provides real-time system monitoring and alerts

## Examples

### Start as Team Leader
```bash
/orchestrate team-leader
```

**Terminal 1 becomes the orchestrator:**
- Assigns tasks to worker pool
- Monitors all agent status
- Aggregates results from workers
- Makes final decisions based on collaborative input

### Start as Worker
```bash
/orchestrate worker
```

**Terminal 2 becomes a worker:**
- Consumes tasks from queue
- Processes work independently
- Reports results back
- Participates in brainstorming when requested

### Start as Collaborator
```bash
/orchestrate collaborator
```

**Terminal 3 becomes a collaborator:**
- Listens for brainstorm requests
- Provides expert input
- Helps build consensus
- Can also execute tasks

### Start as Coordinator
```bash
/orchestrate coordinator
```

**Terminal 4 becomes a workflow coordinator:**
- Manages multi-step workflows
- Handles task dependencies
- Coordinates parallel execution
- Manages state and checkpoints

### Start as Monitor
```bash
/orchestrate monitor
```

**Terminal 5 becomes the system monitor:**
- Displays real-time dashboard
- Tracks all agent health
- Monitors queue metrics
- Generates alerts

## Prerequisites

1. **RabbitMQ Running**:
   ```bash
   # Docker
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

   # Or use existing RabbitMQ instance
   ```

2. **Environment Configuration**:
   ```bash
   # Copy and configure .env
   cp .env.example .env

   # Edit RABBITMQ_URL if needed
   # Default: amqp://localhost:5672
   ```

3. **Dependencies Installed**:
   ```bash
   npm install
   ```

## What Happens

When you run `/orchestrate [type]`:

1. ✅ Connects to RabbitMQ
2. ✅ Sets up required queues and exchanges
3. ✅ Registers agent with unique ID
4. ✅ Starts listening for messages based on agent type
5. ✅ Publishes connection status
6. ✅ Ready for orchestration!

## Multi-Terminal Setup

### Scenario 1: Basic Team (3 terminals)
```bash
# Terminal 1 - Leader
/orchestrate team-leader

# Terminal 2 - Worker
/orchestrate worker

# Terminal 3 - Worker
/orchestrate worker
```

### Scenario 2: Full Team (5 terminals)
```bash
# Terminal 1 - Leader
/orchestrate team-leader

# Terminal 2 - Worker
/orchestrate worker

# Terminal 3 - Collaborator
/orchestrate collaborator

# Terminal 4 - Coordinator
/orchestrate coordinator

# Terminal 5 - Monitor
/orchestrate monitor
```

## Git Worktree Integration

Use git worktree for true parallel development:

```bash
# Main repo (Terminal 1 - Leader)
cd ~/project
/orchestrate team-leader

# Worktree 1 (Terminal 2 - Worker)
git worktree add ../project-worker1 feature-branch
cd ../project-worker1
/orchestrate worker

# Worktree 2 (Terminal 3 - Worker)
git worktree add ../project-worker2 feature-branch
cd ../project-worker2
/orchestrate worker

# All agents can work on same repo independently!
```

## Configuration Options

Set environment variables before starting:

```bash
# Custom agent ID
AGENT_ID=my-custom-id /orchestrate worker

# Custom agent name
AGENT_NAME="Backend Specialist" /orchestrate worker

# Custom RabbitMQ URL
RABBITMQ_URL=amqp://user:pass@remote:5672 /orchestrate worker
```

## Stopping Agent

To gracefully shutdown:

```
Press Ctrl+C

# Agent will:
# 1. Finish current task (if any)
# 2. Publish disconnection status
# 3. Close RabbitMQ connection
# 4. Exit cleanly
```

## Troubleshooting

### Cannot connect to RabbitMQ
```bash
# Check RabbitMQ is running
docker ps | grep rabbitmq

# Test connection
curl http://localhost:15672
# Should show RabbitMQ management UI
```

### Agent not receiving tasks
```bash
# Check queue status
/status queues

# Verify agent is connected
/status agents
```

### Multiple agents same type
```bash
# This is OKAY! Multiple workers can run in parallel
# They will share the task queue (load balancing)

# Terminal 2, 3, 4 can all be workers
/orchestrate worker
```

## Next Steps

After starting orchestration:

1. **As Team Leader**: Use `/assign-task` to distribute work
2. **As Worker**: Wait for tasks or use `/status` to check queue
3. **As Collaborator**: Join brainstorms with `/brainstorm`
4. **As Monitor**: Watch the dashboard for system health

## See Also

- `/assign-task` - Assign work to agents (team leader)
- `/brainstorm` - Initiate collaborative session
- `/status` - Check system status
- `/join-team` - Alternative to /orchestrate
