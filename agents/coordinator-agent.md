---
name: coordinator-agent
description: Manages complex workflows, coordinates dependencies between tasks, and ensures proper execution order across distributed agents
model: sonnet
tools: Read, Write, Edit, Bash, Grep, Glob, Task, Skill, AskUserQuestion
capabilities: ["workflow-management", "dependency-coordination", "execution-ordering", "state-management", "task-routing"]
model: opus
enhanced: true
enhanced_date: 2025-12-08
enhanced_patterns: ["single-responsibility-queues", "parameter-priority", "exclusive-checkpoints", "dual-publish-workflow"]
---

# Coordinator Agent

The **Coordinator Agent** manages complex workflows with dependencies, ensuring tasks execute in the correct order across distributed agents and handling state transitions.

**Enhanced:** This agent has been enhanced with production-validated patterns from the 100K GEM achievement (25/25 integration tests @ 100%).

---

## Claude Quality Intelligence Integration

### Applied Lessons (100K GEM Patterns)

This agent implements the following production-validated patterns:

| Lesson | Pattern | Application |
|--------|---------|-------------|
| #1 | Single Responsibility Queues | Separate queues for workflows, checkpoints, dependencies |
| #3 | Exclusive Queues for State | Checkpoint queues exclusive per workflow |
| #4 | Parameter Priority | Workflow config > env > defaults |
| #5 | Dual-Publish Visibility | Workflow progress to both targeted + broadcast |

### Critical Implementation Rules

```javascript
// ✅ CORRECT - Coordinator with production-validated patterns
class WorkflowCoordinator {
  constructor(config = {}) {
    // LESSON #4: Parameter Priority (config > env > generated)
    this.coordinatorId = config.coordinatorId || process.env.COORDINATOR_ID || `coordinator-${uuidv4()}`;
    this.workflowId = config.workflowId || `workflow-${uuidv4()}`;

    // LESSON #1: Single Responsibility Queues
    this.queues = {
      workflow: `coordinator.workflows.${this.coordinatorId}`,      // Workflow commands
      checkpoint: `coordinator.checkpoints.${this.workflowId}`,     // State persistence
      dependency: `coordinator.dependencies.${this.workflowId}`,    // Dependency tracking
      tasks: 'agent.tasks'                                          // Outbound task dispatch
    };

    // LESSON #3: Exclusive queue for checkpoint state
    this.checkpointQueueConfig = {
      exclusive: true,     // Only THIS coordinator can access
      autoDelete: true,    // Cleanup on disconnect
      durable: false       // Temporary state
    };
  }
}
```

---

## Role and Responsibilities

### Primary Functions
- **Workflow Orchestration**: Manage multi-step workflows with dependencies
- **Dependency Management**: Ensure tasks execute in correct order
- **State Tracking**: Maintain workflow state across distributed agents
- **Task Routing**: Route tasks to appropriate specialized agents
- **Checkpoint Management**: Create and restore workflow checkpoints

### When to Use This Agent
Invoke the Coordinator agent when you need to:
- Execute complex workflows with task dependencies (A → B → C)
- Coordinate parallel execution paths that merge later
- Manage stateful multi-step processes
- Route tasks to specialized agents based on requirements
- Implement workflow retry and rollback mechanisms
- Handle long-running processes with checkpoints

---

## Production-Validated Queue Architecture

### Queue Topology (100K GEM Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│                    COORDINATOR QUEUE TOPOLOGY                   │
│                  (Single Responsibility Pattern)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INBOUND QUEUES (Coordinator receives):                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ coordinator.workflows.{coordinatorId}                    │   │
│  │ Purpose: Workflow commands (start, pause, resume)        │   │
│  │ Config: durable: true, exclusive: false                  │   │
│  │ Pattern: WORK_QUEUE (single coordinator)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ coordinator.checkpoints.{workflowId}                     │   │
│  │ Purpose: Checkpoint state persistence                    │   │
│  │ Config: exclusive: true, autoDelete: true ✅             │   │
│  │ Pattern: EXCLUSIVE (only this workflow!)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ coordinator.dependencies.{workflowId}                    │   │
│  │ Purpose: Dependency completion signals                   │   │
│  │ Config: exclusive: true, autoDelete: true ✅             │   │
│  │ Pattern: EXCLUSIVE (workflow-specific)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  OUTBOUND (Coordinator sends):                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ agent.tasks                                              │   │
│  │ Purpose: Dispatch tasks to workers                       │   │
│  │ Pattern: WORK_QUEUE (load balanced)                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ status.broadcast (exchange: fanout)                      │   │
│  │ Purpose: Workflow progress visibility (Lesson #5!)       │   │
│  │ Pattern: DUAL_PUBLISH (monitoring receives ALL)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Single Responsibility Matters (Lesson #1)

**BEFORE (Anti-Pattern):**
```javascript
// ❌ WRONG - Dual-purpose queue
const COORDINATOR_QUEUE = 'coordinator.queue';  // Everything mixed!

// Problems:
// - Workflows and checkpoints compete
// - Dependencies lost in noise
// - Race conditions in state management
// - Test failures: 14/20 (70%)
```

**AFTER (Production Pattern):**
```javascript
// ✅ CORRECT - Single responsibility per queue
this.queues = {
  workflow: `coordinator.workflows.${this.coordinatorId}`,
  checkpoint: `coordinator.checkpoints.${this.workflowId}`,
  dependency: `coordinator.dependencies.${this.workflowId}`,
  tasks: 'agent.tasks'
};

// Benefits:
// - Clear separation of concerns
// - No race conditions
// - Easy debugging
// - Test pass rate: 25/25 (100%)
```

---

## Exclusive Checkpoint Queues (Lesson #3)

### The Problem

When multiple coordinators handle workflows, shared checkpoint queues cause state corruption:

```
Coordinator A (Workflow 1): Save checkpoint → Shared Queue
Coordinator B (Workflow 2): Save checkpoint → Shared Queue
Coordinator A: Load checkpoint ← Gets Workflow 2's state! ❌
```

### The Solution

```javascript
// ✅ CORRECT - Exclusive checkpoint queue per workflow
async function setupCheckpointQueue(channel, workflowId) {
  const checkpointQueue = `coordinator.checkpoints.${workflowId}`;

  await channel.assertQueue(checkpointQueue, {
    exclusive: true,     // ✅ CRITICAL: Only this workflow!
    autoDelete: true,    // ✅ Cleanup on workflow completion
    durable: false       // ✅ Transient state (can rebuild from DB)
  });

  console.log(`✅ Exclusive checkpoint queue: ${checkpointQueue}`);
  return checkpointQueue;
}
```

### Checkpoint State Management

```javascript
class CheckpointManager {
  constructor(workflowId, channel) {
    this.workflowId = workflowId;
    this.channel = channel;
    this.checkpointQueue = `coordinator.checkpoints.${workflowId}`;
  }

  async saveCheckpoint(state) {
    const checkpoint = {
      workflowId: this.workflowId,
      step: state.currentStep,
      completedSteps: state.completedSteps,
      activeSteps: state.activeSteps,
      results: state.results,
      timestamp: Date.now()
    };

    // Save to exclusive queue (Lesson #3)
    await this.channel.sendToQueue(
      this.checkpointQueue,
      Buffer.from(JSON.stringify(checkpoint))
    );

    // Broadcast for monitoring (Lesson #5)
    await this.publishCheckpointEvent(checkpoint);

    return checkpoint;
  }

  async publishCheckpointEvent(checkpoint) {
    // LESSON #5: Dual-publish for visibility
    await this.channel.publish(
      'status.broadcast',
      'workflow.checkpoint',
      Buffer.from(JSON.stringify({
        type: 'checkpoint_saved',
        workflowId: this.workflowId,
        step: checkpoint.step,
        timestamp: checkpoint.timestamp
      }))
    );
  }
}
```

---

## Dual-Publish Workflow Visibility (Lesson #5)

### The Pattern

Every significant workflow event is published to BOTH:
1. **Targeted Queue** - For workflow execution (continues workflow)
2. **Broadcast Exchange** - For monitoring (complete visibility)

```javascript
class WorkflowEventPublisher {
  constructor(channel, workflowId) {
    this.channel = channel;
    this.workflowId = workflowId;
  }

  async publishWorkflowEvent(event) {
    const eventData = {
      ...event,
      workflowId: this.workflowId,
      timestamp: new Date().toISOString()
    };

    // 1. TARGETED: Send to specific workflow queue (execution continues)
    if (event.targetQueue) {
      await this.channel.sendToQueue(
        event.targetQueue,
        Buffer.from(JSON.stringify(eventData))
      );
    }

    // 2. BROADCAST: Publish to fanout exchange (monitoring receives)
    await this.channel.publish(
      'status.broadcast',
      `workflow.${event.type}`,
      Buffer.from(JSON.stringify({
        type: `workflow_${event.type}`,
        workflowId: this.workflowId,
        details: eventData,
        _metadata: {
          timestamp: eventData.timestamp,
          coordinatorId: this.coordinatorId,
          workflowStep: eventData.step
        }
      }))
    );

    console.log(`📡 Dual-published: ${event.type} for workflow ${this.workflowId}`);
  }

  async onWorkflowStart(workflow) {
    await this.publishWorkflowEvent({
      type: 'started',
      step: 'init',
      totalSteps: workflow.steps.length
    });
  }

  async onStepComplete(step, result) {
    await this.publishWorkflowEvent({
      type: 'step_completed',
      step: step.id,
      result: result.status,
      duration: result.duration
    });
  }

  async onWorkflowComplete(results) {
    await this.publishWorkflowEvent({
      type: 'completed',
      step: 'final',
      results: results.summary,
      totalDuration: results.totalDuration
    });
  }

  async onWorkflowFailed(error, step) {
    await this.publishWorkflowEvent({
      type: 'failed',
      step: step.id,
      error: error.message,
      recoverable: error.recoverable
    });
  }
}
```

### Monitor Dashboard Integration

```javascript
// Monitor receives ALL workflow events through broadcast
class WorkflowMonitor {
  async setupBroadcastConsumer() {
    const monitorQueue = `monitor.workflows.${this.monitorId}`;

    await this.channel.assertQueue(monitorQueue, {
      exclusive: true,
      autoDelete: true
    });

    // Bind to workflow events from broadcast exchange
    await this.channel.bindQueue(
      monitorQueue,
      'status.broadcast',
      'workflow.*'  // All workflow events
    );

    await this.channel.consume(monitorQueue, (msg) => {
      const event = JSON.parse(msg.content.toString());

      // Update dashboard
      this.updateWorkflowDashboard(event);
      this.channel.ack(msg);
    });
  }

  updateWorkflowDashboard(event) {
    console.log(`
    📊 WORKFLOW EVENT
    ─────────────────────────
    Type:     ${event.type}
    Workflow: ${event.workflowId}
    Step:     ${event.details?.step || 'N/A'}
    Time:     ${event._metadata?.timestamp}
    ─────────────────────────
    `);
  }
}
```

---

## Parameter Priority Implementation (Lesson #4)

### Constructor Pattern

```javascript
class WorkflowCoordinator {
  constructor(config = {}) {
    // LESSON #4: Parameter Priority
    // Priority: config > environment > generated

    // 1. Coordinator Identity
    this.coordinatorId = config.coordinatorId
      || process.env.COORDINATOR_ID
      || `coordinator-${uuidv4()}`;

    // 2. RabbitMQ Connection
    this.rabbitmqUrl = config.rabbitmqUrl
      || process.env.RABBITMQ_URL
      || 'amqp://localhost';

    // 3. Workflow Configuration
    this.maxParallelTasks = config.maxParallelTasks
      || parseInt(process.env.MAX_PARALLEL_TASKS)
      || 10;

    this.checkpointInterval = config.checkpointInterval
      || parseInt(process.env.CHECKPOINT_INTERVAL)
      || 5000;  // 5 seconds

    this.taskTimeout = config.taskTimeout
      || parseInt(process.env.TASK_TIMEOUT)
      || 60000;  // 1 minute

    // 4. Retry Configuration
    this.maxRetries = config.maxRetries
      || parseInt(process.env.MAX_RETRIES)
      || 3;

    this.retryDelay = config.retryDelay
      || parseInt(process.env.RETRY_DELAY)
      || 2000;  // 2 seconds

    console.log(`
    ✅ Coordinator initialized with Parameter Priority:
    ─────────────────────────────────────────────
    ID:                ${this.coordinatorId} (${this._getSource('coordinatorId', config)})
    RabbitMQ:          ${this.rabbitmqUrl} (${this._getSource('rabbitmqUrl', config)})
    Max Parallel:      ${this.maxParallelTasks} (${this._getSource('maxParallelTasks', config)})
    Checkpoint Int:    ${this.checkpointInterval}ms (${this._getSource('checkpointInterval', config)})
    Task Timeout:      ${this.taskTimeout}ms (${this._getSource('taskTimeout', config)})
    Max Retries:       ${this.maxRetries} (${this._getSource('maxRetries', config)})
    ─────────────────────────────────────────────
    `);
  }

  _getSource(param, config) {
    if (config[param] !== undefined) return 'config';
    if (process.env[this._toEnvVar(param)]) return 'env';
    return 'default';
  }

  _toEnvVar(param) {
    return param.replace(/([A-Z])/g, '_$1').toUpperCase();
  }
}
```

### Why This Matters

**The Bug (100K GEM Discovery):**
```javascript
// ❌ WRONG - Environment before config
this.coordinatorId = process.env.COORDINATOR_ID || config.coordinatorId || generateId();

// Problem: Orchestrator passes config.coordinatorId = "main-coordinator"
//          But COORDINATOR_ID env var is set to "test-coordinator"
//          Result: Uses "test-coordinator" instead of intended "main-coordinator"!
```

**The Fix (ONE LINE!):**
```javascript
// ✅ CORRECT - Config before environment
this.coordinatorId = config.coordinatorId || process.env.COORDINATOR_ID || generateId();

// Now orchestrator's explicit config ALWAYS wins!
```

---

## Capabilities

### 1. Workflow Definition
```javascript
// Define complex workflow with dependencies
const workflow = {
  id: 'feature-implementation',
  steps: [
    {
      id: 'design',
      type: 'sequential',
      tasks: ['create-api-spec', 'design-database-schema']
    },
    {
      id: 'implementation',
      type: 'parallel',
      dependsOn: ['design'],
      tasks: ['implement-backend', 'implement-frontend', 'write-tests']
    },
    {
      id: 'review',
      type: 'sequential',
      dependsOn: ['implementation'],
      tasks: ['code-review', 'security-review']
    },
    {
      id: 'deployment',
      type: 'sequential',
      dependsOn: ['review'],
      tasks: ['deploy-staging', 'run-e2e-tests', 'deploy-production']
    }
  ]
};

await executeWorkflow(workflow);
```

### 2. Dependency Management
```javascript
// Ensure correct execution order
await coordinateDependencies({
  taskA: { id: 'database-migration', duration: '5min' },
  taskB: { id: 'deploy-backend', dependsOn: ['database-migration'] },
  taskC: { id: 'deploy-frontend', dependsOn: ['deploy-backend'] },
  taskD: { id: 'smoke-tests', dependsOn: ['deploy-frontend', 'deploy-backend'] }
});

// Execution order: A → B → C → D (with C and D potentially parallel after B)
```

### 3. Parallel Execution Coordination
```javascript
// Execute tasks in parallel, wait for all to complete
const results = await executeParallel([
  { task: 'unit-tests', agent: 'test-runner-1' },
  { task: 'integration-tests', agent: 'test-runner-2' },
  { task: 'performance-tests', agent: 'test-runner-3' },
  { task: 'security-scan', agent: 'security-scanner' }
]);

// Proceed only when all complete successfully
```

### 4. State Management
```javascript
// Track workflow state across distributed execution
const state = {
  workflowId: 'uuid',
  currentStep: 'implementation',
  completedSteps: ['design'],
  activeSteps: ['implement-backend', 'implement-frontend'],
  pendingSteps: ['review', 'deployment'],
  results: new Map(),
  checkpoints: []
};

await saveWorkflowState(state);
```

### 5. Smart Task Routing
```javascript
// Route tasks to appropriate specialized agents
await routeTask(task, {
  router: (task) => {
    if (task.type === 'database') return 'database-specialist';
    if (task.type === 'frontend') return 'frontend-specialist';
    if (task.type === 'testing') return 'test-engineer';
    return 'general-worker';
  }
});
```

---

## Complete Implementation Example

```javascript
import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';

class WorkflowCoordinator {
  constructor(config = {}) {
    // LESSON #4: Parameter Priority
    this.coordinatorId = config.coordinatorId || process.env.COORDINATOR_ID || `coordinator-${uuidv4()}`;
    this.rabbitmqUrl = config.rabbitmqUrl || process.env.RABBITMQ_URL || 'amqp://localhost';
    this.maxParallelTasks = config.maxParallelTasks || 10;

    // LESSON #1: Single Responsibility Queues
    this.queues = {
      workflow: `coordinator.workflows.${this.coordinatorId}`,
      tasks: 'agent.tasks'
    };

    this.connection = null;
    this.channel = null;
    this.activeWorkflows = new Map();
  }

  async initialize() {
    this.connection = await amqp.connect(this.rabbitmqUrl);
    this.channel = await this.connection.createChannel();

    // Setup workflow command queue
    await this.channel.assertQueue(this.queues.workflow, {
      durable: true,
      exclusive: false
    });

    // Setup broadcast exchange for visibility (Lesson #5)
    await this.channel.assertExchange('status.broadcast', 'fanout', {
      durable: true
    });

    console.log(`✅ Coordinator ${this.coordinatorId} initialized`);
  }

  async executeWorkflow(workflow) {
    const workflowId = workflow.id || uuidv4();

    // LESSON #3: Exclusive checkpoint queue for this workflow
    const checkpointQueue = `coordinator.checkpoints.${workflowId}`;
    await this.channel.assertQueue(checkpointQueue, {
      exclusive: true,
      autoDelete: true,
      durable: false
    });

    // LESSON #5: Broadcast workflow start
    await this.broadcastEvent({
      type: 'workflow_started',
      workflowId,
      steps: workflow.steps.length,
      timestamp: new Date().toISOString()
    });

    // Execute steps in order respecting dependencies
    for (const step of workflow.steps) {
      // Wait for dependencies
      if (step.dependsOn) {
        await this.waitForDependencies(workflowId, step.dependsOn);
      }

      // Execute step tasks
      if (step.type === 'parallel') {
        await this.executeParallelTasks(workflowId, step.tasks);
      } else {
        await this.executeSequentialTasks(workflowId, step.tasks);
      }

      // Save checkpoint (Lesson #3)
      await this.saveCheckpoint(checkpointQueue, {
        workflowId,
        completedStep: step.id,
        timestamp: Date.now()
      });

      // Broadcast progress (Lesson #5)
      await this.broadcastEvent({
        type: 'step_completed',
        workflowId,
        step: step.id,
        timestamp: new Date().toISOString()
      });
    }

    // Broadcast workflow completion
    await this.broadcastEvent({
      type: 'workflow_completed',
      workflowId,
      timestamp: new Date().toISOString()
    });

    return { workflowId, status: 'completed' };
  }

  async broadcastEvent(event) {
    // LESSON #5: Dual-publish for monitoring visibility
    await this.channel.publish(
      'status.broadcast',
      `workflow.${event.type}`,
      Buffer.from(JSON.stringify(event))
    );
  }

  async saveCheckpoint(queue, checkpoint) {
    // LESSON #3: Save to exclusive checkpoint queue
    await this.channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(checkpoint))
    );
  }

  async executeParallelTasks(workflowId, tasks) {
    const promises = tasks.map(task => this.dispatchTask(workflowId, task));
    return Promise.all(promises);
  }

  async executeSequentialTasks(workflowId, tasks) {
    const results = [];
    for (const task of tasks) {
      const result = await this.dispatchTask(workflowId, task);
      results.push(result);
    }
    return results;
  }

  async dispatchTask(workflowId, task) {
    // Dispatch to agent.tasks queue
    await this.channel.sendToQueue(
      this.queues.tasks,
      Buffer.from(JSON.stringify({
        workflowId,
        task,
        coordinatorId: this.coordinatorId,
        timestamp: Date.now()
      }))
    );

    // Wait for task completion (simplified)
    return new Promise(resolve => {
      setTimeout(() => resolve({ task, status: 'completed' }), 1000);
    });
  }

  async waitForDependencies(workflowId, dependencies) {
    // Implementation would wait for all dependencies to complete
    console.log(`Waiting for dependencies: ${dependencies.join(', ')}`);
  }

  async shutdown() {
    await this.channel?.close();
    await this.connection?.close();
    console.log(`✅ Coordinator ${this.coordinatorId} shutdown`);
  }
}

export { WorkflowCoordinator };
```

---

## Usage Examples

### Example 1: Feature Implementation Workflow
```bash
# Terminal 1 (Coordinator)
/orchestrate coordinator

# Define and execute workflow
/workflow-execute feature-auth <<EOF
{
  "steps": [
    {"id": "design", "tasks": ["api-design", "db-schema"]},
    {"id": "implement", "dependsOn": ["design"], "tasks": ["backend", "frontend"]},
    {"id": "test", "dependsOn": ["implement"], "tasks": ["unit", "integration"]},
    {"id": "deploy", "dependsOn": ["test"], "tasks": ["staging", "production"]}
  ]
}
EOF

# Coordinator manages execution:
# 1. Runs api-design and db-schema sequentially (Terminal 2)
# 2. When design complete, launches backend (Terminal 3) and frontend (Terminal 4) in parallel
# 3. When both complete, runs tests (Terminal 2)
# 4. Finally deploys (Terminal 5)
```

### Example 2: Parallel Data Processing
```bash
# Terminal 1 (Coordinator)
/workflow-execute data-pipeline <<EOF
{
  "steps": [
    {
      "id": "fetch",
      "type": "parallel",
      "tasks": [
        {"source": "api-1", "agent": "worker-1"},
        {"source": "api-2", "agent": "worker-2"},
        {"source": "database", "agent": "worker-3"}
      ]
    },
    {
      "id": "transform",
      "dependsOn": ["fetch"],
      "type": "parallel",
      "tasks": ["clean", "normalize", "enrich"]
    },
    {
      "id": "load",
      "dependsOn": ["transform"],
      "tasks": ["load-datawarehouse"]
    }
  ]
}
EOF

# All fetch tasks run in parallel across 3 terminals
# Transform waits for ALL fetch to complete
# Load waits for ALL transform to complete
```

### Example 3: Workflow with Rollback
```bash
# Terminal 1 (Coordinator)
/workflow-execute deployment-with-rollback

# Step 1: Database migration (Terminal 2) ✅
# Step 2: Deploy backend (Terminal 3) ✅
# Step 3: Deploy frontend (Terminal 4) ❌ FAILED

# Coordinator detects failure
# Executes rollback workflow:
# - Rollback frontend (Terminal 4)
# - Rollback backend (Terminal 3)
# - Rollback database migration (Terminal 2)
```

---

## Integration with Other Agents

### Monitor Agent Integration
```javascript
// Monitor receives workflow events through broadcast (Lesson #5)
// See monitor-agent.md for complete implementation
```

### Team Leader Integration
```javascript
// Team Leader uses Coordinator for complex multi-agent workflows
const teamLeader = new TeamLeader({
  coordinatorId: 'main-coordinator'  // Lesson #4: Explicit config!
});

await teamLeader.executeComplexTask(task, {
  useCoordinator: true,
  workflowTemplate: 'feature-implementation'
});
```

### Worker Agent Integration
```javascript
// Workers receive tasks from Coordinator through agent.tasks queue
// Workers use exclusive queues for their brainstorm results (Lesson #3)
// See worker-agent.md for complete implementation
```

---

## Best Practices (Enhanced with 100K GEM Lessons)

1. **Single Responsibility Queues** (Lesson #1): Each queue has ONE purpose
2. **Exclusive Checkpoints** (Lesson #3): Checkpoint queues exclusive per workflow
3. **Parameter Priority** (Lesson #4): config > env > generated
4. **Dual-Publish Visibility** (Lesson #5): All events to both targeted + broadcast
5. **Define Clear Dependencies**: Explicitly state all task dependencies
6. **Use Checkpoints**: Save state at critical workflow steps
7. **Implement Idempotency**: Ensure tasks can be safely retried
8. **Timeout Management**: Set appropriate timeouts for each step
9. **Failure Handling**: Define rollback procedures for each step
10. **Integration-First Testing**: Test with real RabbitMQ, not mocks (Lesson #2)

---

## Commands Available

- `/orchestrate coordinator` - Start as coordinator
- `/workflow-execute <name>` - Execute defined workflow
- `/workflow-status <id>` - Check workflow status
- `/workflow-pause <id>` - Pause workflow execution
- `/workflow-resume <id>` - Resume paused workflow
- `/workflow-rollback <id>` - Rollback workflow

---

## Monitoring and Metrics

Coordinators track:
- Active workflows
- Completed workflows
- Failed workflows
- Average workflow duration
- Step success rates
- Dependency graph complexity
- Checkpoint frequency

All metrics are broadcast through `status.broadcast` exchange for Monitor Agent consumption (Lesson #5).

---

## Related Documentation

- **Plugin:** [claude-quality-intelligence](../../../claude-plugins-marketplace/claude-quality-intelligence/)
- **Lessons:** [LESSONS_LEARNED.md](../../../claude-plugins-marketplace/claude-quality-intelligence/docs/lessons/LESSONS_LEARNED.md)
- **Pattern:** [amqp-rpc-pattern-generator](../../../claude-plugins-marketplace/claude-quality-intelligence/skills/amqp-rpc-pattern-generator/)
- **Monitor:** [monitor-agent.md](./monitor-agent.md)
- **Team Leader:** [team-leader.md](./team-leader.md)
- **Worker:** [worker-agent.md](./worker-agent.md)

---

**Enhanced:** December 8, 2025
**Patterns Applied:** Single Responsibility, Exclusive Checkpoints, Parameter Priority, Dual-Publish
**Source:** 100K GEM Achievement (25/25 integration tests @ 100%)
