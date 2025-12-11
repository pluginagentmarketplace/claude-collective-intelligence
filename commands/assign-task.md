---
description: Assign a task to the worker pool for distributed execution
allowed-tools: Read, Write, Bash, Task
argument-hint: title="<task>" [priority=high|normal|low] [collaboration=true]
---

# Assign Task - Distribute Work to Agents

Assign a task to the worker pool. Available workers will pick up and execute the task.

## Usage

```bash
/assign-task [options]
```

## Options

- `title` - Task title (required)
- `description` - Detailed task description
- `priority` - Task priority: `low`, `normal`, `high`, `critical`
- `collaboration` - Whether task requires brainstorming: `true`/`false`
- `question` - Collaboration question (if collaboration=true)
- `context` - Additional context as JSON

## Examples

### Basic Task Assignment
```bash
/assign-task title="Implement user authentication" \
  description="Create JWT-based authentication with refresh tokens" \
  priority=high
```

**Result:**
- Task published to queue
- Available worker picks it up
- Worker processes and reports result
- Team leader receives completion notification

### Task with Context
```bash
/assign-task title="Add caching layer" \
  priority=normal \
  context='{"technology":"Redis","use-case":"API responses"}'
```

### Collaborative Task
```bash
/assign-task title="Design microservices architecture" \
  collaboration=true \
  question="Should we use event-driven or request-driven communication?" \
  priority=high
```

**Result:**
- Task assigned to worker
- Worker initiates brainstorm
- All collaborators provide input
- Worker synthesizes responses
- Reports final decision to team leader

### Bulk Task Assignment
```bash
# Assign multiple tasks at once

/assign-task title="Write unit tests for auth module" priority=high
/assign-task title="Write unit tests for payment module" priority=high
/assign-task title="Write integration tests" priority=normal
/assign-task title="Update API documentation" priority=low
```

**Result:**
- All tasks go to queue
- Multiple workers pick up tasks in parallel
- Work distributed based on availability
- Fair load balancing across workers

## Task Priority

Priority determines processing order:

- `critical` - Processed immediately, pre-empts other work
- `high` - Processed before normal tasks
- `normal` - Standard processing (default)
- `low` - Processed when no higher priority tasks available

```bash
# Critical hotfix
/assign-task title="Fix production bug" priority=critical

# Regular feature
/assign-task title="Add new endpoint" priority=normal

# Nice-to-have
/assign-task title="Refactor old code" priority=low
```

## Task Lifecycle

1. **Assigned**: Task published to `agent.tasks` queue
2. **Picked Up**: Worker consumes task from queue
3. **In Progress**: Worker processing
4. **Brainstorm** (if required): Multi-agent collaboration
5. **Completed**: Result published to `agent.results`
6. **Aggregated**: Team leader receives result

## Collaboration Mode

For complex tasks requiring multiple perspectives:

```bash
/assign-task title="Choose database technology" \
  collaboration=true \
  question="PostgreSQL vs MongoDB vs Cassandra?" \
  context='{"requirements":["high-throughput","ACID","scalability"]}'
```

**Collaboration Flow:**
```
Team Leader assigns task
    ↓
Worker picks up task
    ↓
Worker broadcasts brainstorm
    ↓
Collaborators respond with analysis
    ↓
Worker aggregates responses
    ↓
Worker makes decision
    ↓
Result sent to Team Leader
```

## Task Context

Provide context to help workers execute effectively:

```bash
/assign-task title="Optimize database queries" \
  context='{
    "database": "PostgreSQL",
    "current_latency": "500ms",
    "target_latency": "100ms",
    "query_patterns": ["user lookup", "transaction history"],
    "constraints": ["no schema changes", "backward compatible"]
  }'
```

## Real-World Scenarios

### Scenario 1: Feature Implementation Team
```bash
# Terminal 1 (Team Leader)
/orchestrate team-leader

# Assign feature components to workers
/assign-task title="Implement backend API" priority=high
/assign-task title="Implement frontend UI" priority=high
/assign-task title="Write tests" priority=normal
/assign-task title="Update documentation" priority=low

# Terminals 2,3,4 (Workers) automatically pick up tasks
# Work proceeds in parallel
```

### Scenario 2: Architecture Decision
```bash
# Terminal 1 (Team Leader)
/assign-task title="Design payment processing architecture" \
  collaboration=true \
  question="What's the best approach for PCI compliance and scalability?" \
  priority=critical

# Worker in Terminal 2 gets task
# Initiates brainstorm to Terminals 3,4,5
# - Terminal 3 (Security expert): PCI compliance requirements
# - Terminal 4 (Architecture expert): Scalability patterns
# - Terminal 5 (DevOps expert): Operational considerations
# Worker synthesizes and decides
```

### Scenario 3: Code Review Distribution
```bash
# Distribute code review tasks
/assign-task title="Review PR #123 - Auth Module"
/assign-task title="Review PR #124 - Payment Integration"
/assign-task title="Review PR #125 - Notification Service"

# Three workers each pick up one PR
# Reviews happen in parallel
# Results aggregated by team leader
```

## Task Retries

Tasks can be retried on failure:

```bash
/assign-task title="Deploy to staging" \
  context='{"retryCount":3,"retryDelay":5000}'
```

If task fails:
1. Worker nacks message with requeue=true
2. Task goes back to queue
3. Retry count decremented
4. Another worker picks it up
5. Process repeats until success or retries exhausted

## Monitoring Task Progress

```bash
# In Monitor terminal (Terminal 5)
/orchestrate monitor

# Shows real-time task status:
# 📋 TASK QUEUES
#    agent.tasks: 5 messages, 3 consumers
#
# 🎯 ACTIVE TASKS
#    - Task #1234: Implement backend API (worker-01, 45s)
#    - Task #1235: Implement frontend UI (worker-02, 30s)
#    - Task #1236: Write tests (worker-03, 15s)
```

## Task Assignment Strategies

### Strategy 1: Parallel Execution
```bash
# Assign independent tasks
/assign-task title="Build module A"
/assign-task title="Build module B"
/assign-task title="Build module C"

# All execute in parallel
```

### Strategy 2: Sequential with Dependencies
```bash
# Use Coordinator for dependencies
/orchestrate coordinator

/workflow-execute <<EOF
{
  "steps": [
    {"task": "Database migration"},
    {"task": "Deploy backend", "dependsOn": "Database migration"},
    {"task": "Deploy frontend", "dependsOn": "Deploy backend"}
  ]
}
EOF
```

### Strategy 3: Hybrid
```bash
# Sequential + Parallel
# Step 1: Database setup (sequential)
/assign-task title="Setup database schema" priority=critical

# Step 2: Parallel implementation (after DB ready)
/assign-task title="Implement user service"
/assign-task title="Implement product service"
/assign-task title="Implement order service"

# Step 3: Integration tests (after all services ready)
/assign-task title="Run integration tests"
```

## Best Practices

1. **Clear Titles**: Use descriptive task titles
2. **Detailed Descriptions**: Provide sufficient context
3. **Appropriate Priority**: Don't overuse critical priority
4. **Use Collaboration**: For complex decisions requiring multiple perspectives
5. **Idempotent Tasks**: Design tasks to be safely retryable
6. **Reasonable Scope**: Break large tasks into smaller units
7. **Monitor Queue**: Use `/status` to avoid queue buildup

## Troubleshooting

### Tasks not being picked up
```bash
# Check workers are connected
/status agents

# If no workers, start some
# Terminal 2,3,4
/orchestrate worker
```

### Tasks failing repeatedly
```bash
# Check worker logs
# Adjust retry strategy
# Reduce task complexity
```

### Queue backing up
```bash
# Start additional workers
# Increase worker count in Terminals 6,7,8

# Or reprioritize
/assign-task title="Critical fix" priority=critical
```

## See Also

- `/orchestrate` - Start agent
- `/brainstorm` - Initiate brainstorm manually
- `/status` - Check system status
- `/workflow-execute` - For complex workflows with dependencies
