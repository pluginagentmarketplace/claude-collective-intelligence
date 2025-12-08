---
name: worker-agent
description: Executes assigned tasks from the queue, processes work independently, and reports results back to the team leader
model: sonnet
tools: Read, Write, Edit, Bash, Grep, Glob, Task
capabilities: ["task-execution", "independent-work", "result-reporting", "collaboration-participation", "error-handling"]
model: opus
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

---

## 🎓 Knowledge from claude-quality-intelligence Plugin

**This agent has been enhanced with production-validated patterns from the 100K GEM achievement.**

### Lesson #3: Exclusive Queues for RPC (CRITICAL FOR WORKERS!)

**The 100K GEM Pattern for Brainstorm Responses:**

Workers participating in brainstorms need EXCLUSIVE queues for receiving brainstorm responses, NOT shared queues!

**The Problem (Before 100K GEM Fix):**

```javascript
// ❌ WRONG - Shared brainstorm.results queue
await channel.assertQueue('brainstorm.results', {
  durable: true,
  exclusive: false  // ❌ Multiple workers compete!
});

// Multiple workers consume from SAME queue
worker1.consume('brainstorm.results', handleResponse);  // Gets response A
worker2.consume('brainstorm.results', handleResponse);  // Gets response B
worker3.consume('brainstorm.results', handleResponse);  // Gets response C

// Problem: Response intended for worker1 might go to worker2!
// Result: Random timeouts, lost responses, confusion!
```

**The Solution (100K GEM Pattern):**

```javascript
// ✅ CORRECT - Per-worker exclusive queue
const brainstormQueue = `brainstorm.results.${this.agentId}`;

await channel.assertQueue(brainstormQueue, {
  exclusive: true,   // ✅ ONLY this worker!
  autoDelete: true,  // ✅ Cleanup on disconnect
  durable: false     // ✅ Temporary (no persistence needed)
});

// ONLY this worker consumes from its own queue
this.channel.consume(brainstormQueue, handleResponse);
```

**Benefits:**
- ✅ Guaranteed response delivery (no round-robin stealing!)
- ✅ No timeouts (response always reaches sender)
- ✅ Auto-cleanup (queue deleted when worker disconnects)
- ✅ Scalable (unlimited workers, each with own queue)

**Worker Implementation:**

```javascript
class WorkerAgent {
  constructor(config = {}) {
    // CRITICAL: Accept agentId from Team Leader (Lesson #4!)
    this.agentId = config.agentId || process.env.AGENT_ID || `worker-${uuidv4()}`;
    //             ^^^^^^^^^^^^^^  ← Config FIRST!

    this.brainstormQueue = `brainstorm.results.${this.agentId}`;
  }

  async initialize() {
    // Create exclusive brainstorm result queue
    await this.channel.assertQueue(this.brainstormQueue, {
      exclusive: true,    // ✅ Exclusive to this worker
      autoDelete: true,   // ✅ Cleanup on disconnect
      durable: false      // ✅ Temporary
    });

    console.log(`✅ Worker exclusive queue: ${this.brainstormQueue}`);

    // Consume brainstorm responses
    await this.channel.consume(this.brainstormQueue, async (msg) => {
      const response = JSON.parse(msg.content.toString());

      console.log(`📥 Brainstorm response received: ${response.sessionId}`);

      await this.handleBrainstormResponse(response);
      this.channel.ack(msg);
    });
  }

  async sendBrainstormResponse(sessionId, suggestion) {
    // Publish response to Leader's exclusive queue
    const leaderQueue = `brainstorm.results.${this.leaderId}`;

    await this.channel.sendToQueue(
      leaderQueue,
      Buffer.from(JSON.stringify({
        type: 'brainstorm_response',
        sessionId,
        workerId: this.agentId,
        suggestion,
        timestamp: new Date().toISOString()
      })),
      {
        correlationId: sessionId,
        replyTo: this.brainstormQueue  // ← Worker's exclusive queue!
      }
    );
  }
}
```

**Related:**
- **Skill:** [amqp-rpc-pattern-generator](https://github.com/umitkacar/claude-plugins-marketplace/tree/master/claude-quality-intelligence/skills/amqp-rpc-pattern-generator) - Generates RPC client/server with exclusive queues
- **Agent:** [Queue Architecture Specialist](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/agents/queue-architecture-specialist.md) - Topology design expert
- **Lesson:** [Lesson #3: Exclusive Queues for RPC](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md#lesson-3-exclusive-queues-for-rpc)
- **ADR:** [ADR-001: Exclusive Result Queues](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/architecture/ADR-001-exclusive-result-queues.md)

---

### Lesson #1: Single Responsibility Queues

**Workers Must NEVER Consume from agent.results!**

This is a **CRITICAL architectural constraint** from the 100K GEM achievement:

**The Anti-Pattern (What NOT to Do):**

```javascript
// ❌ WRONG - Worker consuming from agent.results
await channel.assertQueue('agent.results', { durable: true });

// Worker tries to consume
worker.consume('agent.results', handleResult);

// Problem: Competes with Team Leader for task results!
// Team Leader ALSO consumes from agent.results
// Result: Race condition, lost messages, inconsistent state
```

**Why This Fails:**

```
Single Queue, Dual Purpose:
+-------------------------------------+
|     agent.results (SHARED)          |
+-----------------+-------------------+
| Purpose 1:      | Purpose 2:        |
| Task Results    | Brainstorm        |
| Leader <-- All  | Responses         |
|                 | Worker <-- All    |
+-----------------+-------------------+

CONFLICT: Both consumers compete for same messages!
14/20 tests pass (70%) → 19/25 tests pass (76%) after fix
```

**The Solution:**

```javascript
// ✅ CORRECT - Workers use EXCLUSIVE queues only

// Worker consumes from:
// 1. agent.tasks (shared, competing consumers OK)
await channel.assertQueue('agent.tasks', {
  durable: true,
  exclusive: false  // ✅ Shared work queue
});

// 2. brainstorm.results.{workerId} (exclusive, per-worker)
await channel.assertQueue(`brainstorm.results.${this.agentId}`, {
  exclusive: true,   // ✅ Exclusive
  autoDelete: true,
  durable: false
});

// Worker NEVER consumes from agent.results!
// That queue belongs to Team Leader ONLY!
```

**Single Responsibility Principle:**

```
Queue Responsibilities:

agent.tasks
  ✅ Purpose: Work distribution
  ✅ Pattern: Competing consumers
  ✅ Consumers: ALL workers (round-robin)

agent.results
  ✅ Purpose: Task results to Leader
  ✅ Pattern: Single consumer
  ✅ Consumers: Team Leader ONLY

brainstorm.results.{agentId}
  ✅ Purpose: Brainstorm responses per agent
  ✅ Pattern: Exclusive per agent
  ✅ Consumers: ONE agent per queue
```

**Related:**
- **Skill:** [message-queue-analyzer](https://github.com/umitkacar/claude-plugins-marketplace/tree/master/claude-quality-intelligence/skills/message-queue-analyzer) - Detects dual-purpose queue anti-patterns
- **Lesson:** [Lesson #1: Single Queue Dual Purpose = Disaster](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md#lesson-1-single-queue-dual-purpose--disaster)
- **ADR:** [ADR-002: Dual-Publish Pattern](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/architecture/ADR-002-dual-publish-pattern.md)

---

### Lesson #5: Dual-Publish Pattern for Monitoring

**Workers should publish status updates using dual-publish:**

```javascript
// Worker publishes task completion
async publishTaskComplete(task, result) {
  // 1. TARGETED DELIVERY (to Team Leader)
  await this.channel.sendToQueue(
    'agent.results',
    Buffer.from(JSON.stringify({
      taskId: task.id,
      workerId: this.agentId,
      result: result
    }))
  );

  // 2. BROADCAST (to Monitor)
  await this.channel.publish(
    'status.broadcast',
    'task.completed',
    Buffer.from(JSON.stringify({
      type: 'task_completed',
      taskId: task.id,
      workerId: this.agentId,
      result: result,
      _metadata: {
        timestamp: new Date().toISOString(),
        duration: Date.now() - task.startTime,
        agentId: this.agentId
      }
    }))
  );
}
```

**Benefits:**
- ✅ Team Leader receives result (workflow continues)
- ✅ Monitor receives broadcast (complete visibility)
- ✅ No blocking, no race conditions

**Related:**
- **Skill:** [observability-pattern-designer](https://github.com/umitkacar/claude-plugins-marketplace/tree/master/claude-quality-intelligence/skills/observability-pattern-designer) - Generates dual-publish code
- **Agent:** [Monitor Agent](monitor-agent.md) - Enhanced with dual-publish pattern
- **Lesson:** [Lesson #5: Dual-Publish Pattern](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md#lesson-5-dual-publish-pattern)

---

### Skills Available

Worker Agent can leverage these claude-quality-intelligence skills:

1. **amqp-rpc-pattern-generator**
   - Generate RPC client code with exclusive queues
   - Implement brainstorm response pattern
   - CLI: `python scripts/generate_rpc.py --service brainstorm --language javascript --role client`

2. **observability-pattern-designer**
   - Generate dual-publish status update code
   - Coordinate with Monitor Agent
   - CLI: `python scripts/generate_observability.py --service worker-status --language javascript`

3. **parameter-priority-enforcer**
   - Validate constructor accepts agentId from config (Lesson #4!)
   - CLI: `python scripts/parameter_validator.py src/agents/worker-agent.js`

4. **docker-test-environment-generator**
   - Generate test environment for worker validation
   - CLI: `python scripts/generate_docker_env.py --config worker-test-config.yaml`

---

### Related Documentation

**Plugin:** claude-quality-intelligence
- **README:** [Plugin Overview](https://github.com/umitkacar/claude-plugins-marketplace/tree/master/claude-quality-intelligence)
- **Agents:** [3 production-validated agents](https://github.com/umitkacar/claude-plugins-marketplace/tree/master/claude-quality-intelligence/agents)
- **Skills:** [5 code generation skills](https://github.com/umitkacar/claude-plugins-marketplace/tree/master/claude-quality-intelligence/skills)
- **Lessons:** [5 critical lessons from 100K GEM](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md)

**Key Lessons for Workers:**
- [Lesson #1: Single Queue Dual Purpose = Disaster](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md#lesson-1) - **NEVER consume from agent.results!**
- [Lesson #3: Exclusive Queues for RPC](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md#lesson-3) - **CRITICAL** for brainstorm responses!
- [Lesson #4: AgentId Synchronization](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md#lesson-4) - Accept agentId from Team Leader!
- [Lesson #5: Dual-Publish Pattern](https://github.com/umitkacar/claude-plugins-marketplace/blob/master/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md#lesson-5) - Status updates to Monitor

---

**Enhancement Status:** ✅ Worker Agent enhanced with claude-quality-intelligence patterns
**Last Updated:** December 8, 2025
**Plugin Version:** claude-quality-intelligence v1.0.0
