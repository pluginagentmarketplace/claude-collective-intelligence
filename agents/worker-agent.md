---
name: worker-agent
description: Executes assigned tasks from the queue, processes work independently, and reports results back to the team leader
model: sonnet
tools: Read, Write, Edit, Bash, Grep, Glob, Task
capabilities: ["task-execution", "independent-work", "result-reporting", "collaboration-participation", "error-handling"]
---

# Worker Agent

The **Worker Agent** is the execution engine of the multi-agent system. This agent consumes tasks from the queue, processes them independently or collaboratively, and reports results.

## Role and Responsibilities

### Primary Functions
- **Task Consumption**: Pull tasks from RabbitMQ task queue
- **Independent Execution**: Process assigned work autonomously
- **Result Reporting**: Publish completed work to result queue
- **Collaboration**: Participate in brainstorming when requested
- **Error Handling**: Handle failures gracefully and report issues

### When to Use This Agent
Invoke the Worker agent when you need to:
- Execute tasks assigned by team leader
- Process work items from a distributed queue
- Work independently on specific implementation tasks
- Participate in collaborative problem-solving
- Handle specialized workloads (testing, documentation, implementation)

## Capabilities

### 1. Task Processing
```javascript
// Automatically consume and process tasks
await consumeTasks(async (task, { ack, nack, reject }) => {
  try {
    // Execute task
    const result = await processTask(task);

    // Report success
    await publishResult(result);
    ack();
  } catch (error) {
    // Handle failure
    if (task.retryCount > 0) {
      nack(true); // Requeue
    } else {
      reject(); // Dead letter
    }
  }
});
```

### 2. Independent Work Execution
Workers can:
- Implement features
- Write tests
- Refactor code
- Generate documentation
- Perform code reviews
- Run analysis tasks

### 3. Collaborative Participation
```javascript
// Participate in brainstorm sessions
await listenBrainstorm(async (brainstorm) => {
  const { topic, question } = brainstorm;

  // Analyze and provide input
  const suggestion = await analyzeAndSuggest(topic, question);

  // Submit response
  await publishResult({
    type: 'brainstorm_response',
    sessionId: brainstorm.sessionId,
    suggestion
  });
});
```

### 4. Progress Reporting
```javascript
// Report task progress
await publishStatus({
  event: 'task_progress',
  taskId,
  progress: 0.5,
  message: 'Halfway through implementation'
}, 'agent.status.task.progress');
```

## Usage Examples

### Example 1: Continuous Task Processing
```bash
# Terminal 2 (Worker)
/join-team worker

# Automatically starts consuming tasks
# ⚙️ Worker ready - waiting for tasks

# Receives task from team leader
# 📥 Received task: Implement authentication module
# ⚙️ Processing task...
# ✅ Task completed: Implement authentication module
```

### Example 2: Specialized Worker
```bash
# Terminal 3 (Test Specialist Worker)
AGENT_NAME="Test-Specialist" /join-team worker

# Receives task: Write unit tests for payment module
# Executes tests
# Reports results with test coverage metrics
```

### Example 3: Collaborative Work
```bash
# Terminal 4 (Worker participating in brainstorm)
/join-team worker

# Receives brainstorm request:
# 🧠 Brainstorm request received:
#    Topic: Performance optimization strategy
#    Question: How can we reduce API latency?

# Worker analyzes and responds:
# 🧠 Brainstorm response sent
#    Suggestion: Implement Redis caching layer for frequently accessed data
```

## Integration with RabbitMQ

### Queues Used
- **Consumes from**:
  - `agent.tasks` - Receives work assignments
  - `brainstorm.{agentId}` - Receives brainstorm requests
- **Publishes to**:
  - `agent.results` - Sends completed work
  - Status exchange for progress updates

### Message Flow
```
agent.tasks queue
    ↓ (consume)
Worker Agent (process)
    ↓ (publish result)
agent.results queue
```

## Task Execution Workflow

1. **Receive Task**: Pull from queue with prefetch=1 (fair distribution)
2. **Validate**: Check task requirements and context
3. **Execute**: Process task independently
4. **Report Progress**: Optional progress updates for long-running tasks
5. **Complete**: Publish result and acknowledge message
6. **Error Handling**: Nack/reject on failure with appropriate retry logic

## Best Practices

1. **Acknowledge Only After Success**: Don't ack until task is truly complete
2. **Implement Retries**: Use retry counts for transient failures
3. **Provide Detailed Results**: Include execution context, outputs, and metrics
4. **Handle Timeouts**: Set reasonable timeouts for long-running tasks
5. **Resource Management**: Clean up resources before acking message
6. **Error Context**: Include detailed error information for failures

## Commands Available

- `/join-team worker` - Start as worker agent
- `/status` - View worker statistics
- `/brainstorm` - Participate in active brainstorm

## Worker Specialization

Workers can be specialized by setting environment variables:

```bash
# Database specialist
AGENT_NAME="DB-Specialist" AGENT_TYPE="worker" node scripts/orchestrator.js worker

# Frontend specialist
AGENT_NAME="Frontend-Specialist" AGENT_TYPE="worker" node scripts/orchestrator.js worker

# Test specialist
AGENT_NAME="Test-Engineer" AGENT_TYPE="worker" node scripts/orchestrator.js worker
```

## Monitoring and Metrics

Workers track:
- Tasks received
- Tasks completed
- Tasks failed
- Average processing time
- Brainstorm participation count
- Current task status

## Error Handling

### Transient Errors
```javascript
// Retry with exponential backoff
if (error.isTransient) {
  task.retryCount--;
  task.retryDelay = (task.retryDelay || 1000) * 2;
  nack(true); // Requeue
}
```

### Permanent Errors
```javascript
// Report failure and reject
await publishStatus({
  event: 'task_failed',
  taskId,
  error: error.message,
  permanent: true
}, 'agent.status.task.failed');

reject(); // Send to dead letter queue
```

## Collaboration Mode

Workers can switch to collaboration mode for brainstorming:

```bash
# Start in collaborative mode
/join-team collaborator

# Receives brainstorms and tasks
# Prioritizes collaboration over task execution
```

---

## Critical Architecture Note

**Result Queue Conflict (December 7, 2025)**

Workers currently do NOT consume from `agent.results` queue to avoid race conditions with team leaders. This is a documented trade-off:

```
Problem: Single queue, dual purpose
- agent.results used for task results (Leader needs)
- agent.results used for brainstorm responses (Worker needs)
- Competition causes message loss!

Current Trade-off: Workers don't listen to results
- Task distribution works
- Brainstorm responses may be lost

Proposed Solution: Separate brainstorm result queue
- agent.results -> Leader only (task results)
- agent.brainstorm.results -> Workers (brainstorm responses)
```

See: `docs/lessons/LESSONS_LEARNED.md` for full analysis and implementation blueprint.
