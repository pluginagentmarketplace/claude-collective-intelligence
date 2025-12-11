---
description: Quick command to join the orchestration team with auto-configuration
allowed-tools: Read, Write, Bash, Task
argument-hint: [leader|worker|collaborator|coordinator|monitor]
---

# Join Team - Quick Agent Onboarding

Quick command to join the orchestration team. Simplified alternative to `/orchestrate`.

## Usage

```bash
/join-team [role]
```

## Roles

- `leader` - Join as team leader
- `worker` - Join as worker (default)
- `collaborator` - Join as brainstorm participant
- `coordinator` - Join as workflow coordinator
- `monitor` - Join as system monitor

## Examples

### Join as Worker (Default)
```bash
/join-team

# or explicitly
/join-team worker
```

**Auto-configuration:**
- Connects to RabbitMQ
- Generates unique agent ID
- Starts consuming tasks
- Ready to work!

### Join as Team Leader
```bash
/join-team leader
```

**Auto-configuration:**
- Becomes task distributor
- Monitors all agents
- Aggregates results
- Coordinates team

### Join as Collaborator
```bash
/join-team collaborator
```

**Auto-configuration:**
- Listens for brainstorms
- Participates in discussions
- Provides expert input

### Custom Agent Name
```bash
AGENT_NAME="Database Expert" /join-team collaborator
```

## Difference from /orchestrate

| Feature | /join-team | /orchestrate |
|---------|-----------|--------------|
| Simplicity | ✅ One command | Requires role |
| Auto-config | ✅ Yes | Manual config |
| Best for | Quick start | Advanced use |
| Customization | Limited | Full control |

## Quick Multi-Terminal Setup

### 2-Terminal Team
```bash
# Terminal 1
/join-team leader

# Terminal 2
/join-team worker
```

### 3-Terminal Team
```bash
# Terminal 1
/join-team leader

# Terminal 2
/join-team worker

# Terminal 3
/join-team worker
```

### 5-Terminal Full Team
```bash
# Terminal 1 - Orchestrator
/join-team leader

# Terminal 2,3 - Workers
/join-team worker

# Terminal 4 - Collaboration
/join-team collaborator

# Terminal 5 - Monitoring
/join-team monitor
```

## Auto-Detection Mode

```bash
# Let system decide best role
/join-team auto
```

**Logic:**
- If no leader exists → Become leader
- If leader exists but few workers → Become worker
- If many workers → Become collaborator
- If no monitor → Suggest monitor

## Git Worktree Integration

Perfect for git worktree setups:

```bash
# Main repo - Terminal 1
cd ~/project
/join-team leader

# Worktree 1 - Terminal 2
git worktree add ../project-feature1 feature-branch
cd ../project-feature1
/join-team worker

# Worktree 2 - Terminal 3
git worktree add ../project-feature2 feature-branch
cd ../project-feature2
/join-team worker

# All working on same project, independent branches!
```

## Session Persistence

```bash
# Join with session ID (resume previous session)
/join-team worker --session=my-session-123

# Rejoins with same agent ID
# Recovers previous state
# Continues from where left off
```

## Quick Start Checklist

**Before joining:**
```bash
# 1. RabbitMQ running?
docker ps | grep rabbitmq

# 2. Dependencies installed?
npm install

# 3. Environment configured?
cat .env

# All good? Join team!
/join-team worker
```

## Common Workflows

### Workflow 1: Solo Developer with Distributed Tasks
```bash
# Terminal 1 - Main work
/join-team leader

# Assign tasks to self
/assign-task title="Implement feature A"
/assign-task title="Write tests"
/assign-task title="Update docs"

# Terminal 2 - Auto worker
/join-team worker
# Picks up tasks automatically

# Terminal 3 - Auto worker
/join-team worker
# Helps process queue
```

### Workflow 2: Team Collaboration
```bash
# Developer 1 - Terminal 1
AGENT_NAME="Alice" /join-team leader

# Developer 2 - Terminal 2
AGENT_NAME="Bob" /join-team worker

# Developer 3 - Terminal 3
AGENT_NAME="Carol" /join-team collaborator

# Real team working together through RabbitMQ!
```

### Workflow 3: CI/CD Integration
```bash
# CI pipeline runs workers automatically
/join-team worker --ci-mode

# Workers process test/build/deploy tasks
# Results aggregated by leader
# Pipeline succeeds/fails based on results
```

## Specialized Workers

### Frontend Specialist
```bash
AGENT_NAME="Frontend Expert" \
AGENT_SPECIALTY="frontend" \
/join-team worker
```

### Backend Specialist
```bash
AGENT_NAME="Backend Expert" \
AGENT_SPECIALTY="backend" \
/join-team worker
```

### Test Specialist
```bash
AGENT_NAME="QA Engineer" \
AGENT_SPECIALTY="testing" \
/join-team worker
```

## Environment Variables

Customize behavior:

```bash
# Custom agent name
AGENT_NAME="My Worker" /join-team worker

# Custom RabbitMQ
RABBITMQ_URL=amqp://prod:5672 /join-team worker

# Custom prefetch (tasks at once)
PREFETCH_COUNT=5 /join-team worker

# Quiet mode
QUIET=true /join-team worker
```

## Auto-Restart on Disconnect

```bash
# Keep rejoining until manually stopped
while true; do
  /join-team worker
  echo "Disconnected, rejoining in 5s..."
  sleep 5
done
```

## Team Status After Joining

```bash
# After joining, check team
/join-team worker

# Then immediately
/status agents

# See yourself in the team list
# 🤖 AGENT STATUS
#    ✅ worker-abc123 (you!) [connected, idle]
```

## Leaving Team

```bash
# Graceful exit
Press Ctrl+C

# Agent will:
# 1. Finish current task (if any)
# 2. Notify team of departure
# 3. Close connections
# 4. Exit cleanly
```

## Quick Reference

| Command | Role | Best For |
|---------|------|----------|
| `/join-team` | worker | Default, task execution |
| `/join-team leader` | team-leader | Coordination, distribution |
| `/join-team collaborator` | collaborator | Brainstorming, discussion |
| `/join-team coordinator` | coordinator | Complex workflows |
| `/join-team monitor` | monitor | Observability |

## Tips

1. **Start Simple**: Begin with leader + 1-2 workers
2. **Scale Gradually**: Add more workers as needed
3. **Use Worktrees**: Perfect for parallel development
4. **Name Your Agents**: Makes debugging easier
5. **Monitor Always**: Keep a monitor terminal visible
6. **Auto-Restart**: Use for production/long-running tasks

## Troubleshooting

### Cannot join - RabbitMQ not running
```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 rabbitmq

# Then join
/join-team worker
```

### Multiple leaders warning
```bash
# Warning: Team leader already exists
# Continue as worker instead? [Y/n]

# System detects existing leader
# Suggests alternative role
```

### Connection timeout
```bash
# Check RabbitMQ URL
echo $RABBITMQ_URL

# Test connection
telnet localhost 5672

# Update URL if needed
RABBITMQ_URL=amqp://correct-host:5672 /join-team worker
```

## See Also

- `/orchestrate` - Advanced agent configuration
- `/status agents` - See team members
- `/assign-task` - Distribute work (as leader)
- `/brainstorm` - Collaborate with team
