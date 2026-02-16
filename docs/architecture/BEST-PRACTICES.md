# Best Practices Guide

## Multi-Agent Orchestration with RabbitMQ

This guide covers development, operational, and architectural best practices for building robust, scalable multi-agent systems using RabbitMQ.

---

## Table of Contents

1. [Development Best Practices](#1-development-best-practices)
2. [Operational Best Practices](#2-operational-best-practices)
3. [Message Queue Best Practices](#3-message-queue-best-practices)
4. [Agent Design Patterns](#4-agent-design-patterns)
5. [Performance Best Practices](#5-performance-best-practices)
6. [Security Best Practices](#6-security-best-practices)

---

## 1. Development Best Practices

### 1.1 Code Organization

#### Module Structure
```
plugin-ai-agent-rabbitmq/
├── scripts/
│   ├── rabbitmq-client.js      # Core messaging client
│   ├── orchestrator.js          # Agent orchestration logic
│   └── monitor.js               # Monitoring dashboard
├── agents/                      # Agent-specific implementations
├── skills/                      # Reusable agent skills
├── commands/                    # Slash commands for CLI
├── hooks/                       # Session lifecycle hooks
└── examples/                    # Usage examples
```

**Principles:**
- **Single Responsibility**: Each class handles one concern (client, orchestrator, monitor)
- **Separation of Concerns**: Messaging logic separate from business logic
- **Reusability**: Skills and utilities are modular and composable

#### Example: Clean Separation
```javascript
// Good: Messaging logic separated
class RabbitMQClient extends EventEmitter {
  async publishTask(task, queueName) { /* ... */ }
  async consumeTasks(queueName, handler) { /* ... */ }
}

class AgentOrchestrator {
  async handleTask(msg, { ack, nack }) {
    // Business logic here
    await this.client.publishResult(result);
    ack();
  }
}

// Bad: Mixing concerns
class Agent {
  async processTask(task) {
    const connection = await amqp.connect(/* ... */);  // ❌ Low-level details
    const channel = await connection.createChannel();
    // ... mixed with business logic
  }
}
```

### 1.2 Error Handling

#### Comprehensive Error Strategy

```
┌─────────────────────────────────────────────────┐
│                Error Flow                        │
│                                                  │
│  Task Received                                   │
│       │                                          │
│       ├─→ Try Process                            │
│       │        │                                 │
│       │        ├─→ Success → ACK → Complete      │
│       │        │                                 │
│       │        └─→ Error                         │
│       │               │                          │
│       │               ├─→ Retry? Yes → NACK(requeue) │
│       │               │                          │
│       │               └─→ Retry? No → REJECT → DLQ   │
│       │                                          │
│       └─→ Critical Error → Log & Alert           │
└─────────────────────────────────────────────────┘
```

#### Implementation Pattern
```javascript
async handleTask(msg, { ack, nack, reject }) {
  const { id, task } = msg;

  try {
    // 1. Validate input
    if (!task.title || !task.description) {
      throw new ValidationError('Missing required fields');
    }

    // 2. Process with timeout
    const result = await Promise.race([
      this.processTask(task),
      timeout(300000)  // 5 minutes
    ]);

    // 3. Publish result
    await this.publishResult(result);

    // 4. Acknowledge success
    ack();

  } catch (error) {
    console.error(`Task ${id} failed:`, error);

    // 5. Categorize error
    if (error instanceof ValidationError) {
      // Don't retry validation errors
      reject();
      await this.publishStatus({
        event: 'task_failed',
        taskId: id,
        error: error.message,
        retryable: false
      }, 'agent.status.task.failed');

    } else if (error instanceof TransientError) {
      // Retry transient errors
      const retryCount = task.retryCount || 3;
      if (retryCount > 0) {
        task.retryCount = retryCount - 1;
        nack(true);  // Requeue
      } else {
        reject();  // Send to DLQ
      }

    } else {
      // Unknown error - don't requeue
      reject();
      await this.alertCriticalError(error, task);
    }
  }
}
```

#### Error Categories
1. **Validation Errors**: Don't retry, reject immediately
2. **Transient Errors**: Network issues, temporary unavailability - retry
3. **Business Logic Errors**: Context-dependent retry strategy
4. **Critical Errors**: Alert immediately, don't requeue

### 1.3 Logging Strategies

#### Structured Logging
```javascript
// Good: Structured, searchable logs
logger.info('Task processing started', {
  taskId: msg.id,
  agentId: this.agentId,
  taskType: task.type,
  priority: task.priority,
  timestamp: Date.now()
});

logger.error('Task processing failed', {
  taskId: msg.id,
  agentId: this.agentId,
  error: error.message,
  stack: error.stack,
  duration: Date.now() - startTime,
  retryable: true
});

// Bad: Unstructured logs
console.log('Processing task...');
console.log('Error: ' + error);
```

#### Log Levels
```
TRACE → DEBUG → INFO → WARN → ERROR → FATAL

Development:  DEBUG and above
Staging:      INFO and above
Production:   WARN and above
```

#### Context Enrichment
```javascript
class LogContext {
  constructor(agentId, sessionId) {
    this.agentId = agentId;
    this.sessionId = sessionId;
    this.requestId = uuidv4();
  }

  log(level, message, data = {}) {
    console.log(JSON.stringify({
      level,
      message,
      agentId: this.agentId,
      sessionId: this.sessionId,
      requestId: this.requestId,
      timestamp: new Date().toISOString(),
      ...data
    }));
  }
}
```

### 1.4 Testing Approaches

#### Test Pyramid
```
         ┌─────────────┐
         │   E2E Tests │  5%  - Full multi-agent scenarios
         │             │
      ┌──┴─────────────┴──┐
      │ Integration Tests │  15% - Agent + RabbitMQ
      │                   │
   ┌──┴───────────────────┴──┐
   │     Unit Tests           │  80% - Individual functions
   │                          │
   └──────────────────────────┘
```

#### Unit Test Example
```javascript
// Test message handling in isolation
describe('AgentOrchestrator', () => {
  let orchestrator;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      publishResult: jest.fn(),
      publishStatus: jest.fn()
    };
    orchestrator = new AgentOrchestrator('worker');
    orchestrator.client = mockClient;
  });

  test('should acknowledge task on success', async () => {
    const msg = {
      id: 'task-123',
      task: { title: 'Test', description: 'Test task' }
    };
    const ack = jest.fn();

    await orchestrator.handleTask(msg, { ack, nack: jest.fn(), reject: jest.fn() });

    expect(ack).toHaveBeenCalled();
    expect(mockClient.publishResult).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-123', status: 'completed' })
    );
  });

  test('should requeue task on transient error', async () => {
    const msg = {
      id: 'task-123',
      task: { title: 'Test', description: 'Test task', retryCount: 2 }
    };
    const nack = jest.fn();

    // Mock transient error
    orchestrator.processTask = jest.fn().mockRejectedValue(
      new Error('Network timeout')
    );

    await orchestrator.handleTask(msg, { ack: jest.fn(), nack, reject: jest.fn() });

    expect(nack).toHaveBeenCalledWith(true);  // Requeue
  });
});
```

#### Integration Test Example
```javascript
// Test with real RabbitMQ instance
describe('RabbitMQ Integration', () => {
  let client1, client2;

  beforeAll(async () => {
    client1 = new RabbitMQClient({ agentId: 'test-agent-1' });
    client2 = new RabbitMQClient({ agentId: 'test-agent-2' });
    await client1.connect();
    await client2.connect();
  });

  afterAll(async () => {
    await client1.close();
    await client2.close();
  });

  test('should distribute tasks to workers', async (done) => {
    const queueName = 'test.tasks';
    await client1.setupTaskQueue(queueName);

    const received = [];

    // Worker subscribes
    await client2.consumeTasks(queueName, async (msg, { ack }) => {
      received.push(msg);
      ack();
      if (received.length === 3) done();
    });

    // Leader publishes
    await client1.publishTask({ title: 'Task 1' }, queueName);
    await client1.publishTask({ title: 'Task 2' }, queueName);
    await client1.publishTask({ title: 'Task 3' }, queueName);
  });
});
```

#### End-to-End Test Example
```javascript
// Full multi-agent scenario
test('5-agent collaboration scenario', async () => {
  const leader = new AgentOrchestrator('team-leader');
  const worker1 = new AgentOrchestrator('worker');
  const worker2 = new AgentOrchestrator('worker');
  const collaborator = new AgentOrchestrator('collaborator');
  const monitor = new MonitorDashboard();

  await Promise.all([
    leader.initialize(),
    worker1.initialize(),
    worker2.initialize(),
    collaborator.initialize(),
    monitor.start()
  ]);

  // Assign task requiring collaboration
  const taskId = await leader.assignTask({
    title: 'Design API',
    requiresCollaboration: true
  });

  // Wait for completion
  await waitFor(() => monitor.metrics.tasks.completed === 1, 10000);

  // Verify results
  expect(monitor.metrics.tasks.completed).toBe(1);
  expect(monitor.metrics.agents.size).toBe(5);

  // Cleanup
  await Promise.all([
    leader.shutdown(),
    worker1.shutdown(),
    worker2.shutdown(),
    collaborator.shutdown(),
    monitor.shutdown()
  ]);
});
```

---

## 2. Operational Best Practices

### 2.1 Deployment Strategies

#### Blue-Green Deployment
```
┌─────────────────────────────────────────────────┐
│               Load Balancer                      │
└────────────┬────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────┐       ┌───▼────┐
│ Blue   │       │ Green  │
│ v1.0   │       │ v1.1   │
│        │       │        │
│ Active │       │Standby │
└───┬────┘       └───┬────┘
    │                │
    └────────┬───────┘
             │
    ┌────────▼────────┐
    │   RabbitMQ      │
    └─────────────────┘

Steps:
1. Deploy v1.1 to Green (standby)
2. Test Green environment
3. Switch traffic to Green
4. Monitor for issues
5. Keep Blue running for rollback
6. After stable, update Blue to v1.1
```

#### Rolling Deployment
```javascript
// Graceful shutdown for zero-downtime deployment
class GracefulShutdown {
  constructor(orchestrator, gracePeriod = 30000) {
    this.orchestrator = orchestrator;
    this.gracePeriod = gracePeriod;
    this.isShuttingDown = false;
  }

  async start() {
    process.on('SIGTERM', async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log('Received SIGTERM, starting graceful shutdown...');

      // 1. Stop accepting new tasks
      await this.orchestrator.pauseConsumers();

      // 2. Wait for active tasks to complete
      const deadline = Date.now() + this.gracePeriod;
      while (this.orchestrator.activeTasks.size > 0 && Date.now() < deadline) {
        console.log(`Waiting for ${this.orchestrator.activeTasks.size} tasks...`);
        await sleep(1000);
      }

      // 3. NACK incomplete tasks (will be requeued for other workers)
      for (const [taskId, taskInfo] of this.orchestrator.activeTasks) {
        console.log(`Requeuing incomplete task: ${taskId}`);
        await taskInfo.nack(true);
      }

      // 4. Close connection
      await this.orchestrator.shutdown();

      process.exit(0);
    });
  }
}
```

### 2.2 Scaling Guidelines

#### Horizontal Scaling Decision Tree
```
                 Start
                   │
                   ▼
        ┌──────────────────┐
        │ Queue depth > 100? │
        └──────┬───────┬────┘
               │       │
           Yes │       │ No
               │       │
               ▼       ▼
        Add Workers   Monitor
               │
               ▼
        ┌──────────────────┐
        │ CPU < 80%?       │
        └──────┬───────┬───┘
               │       │
           Yes │       │ No
               │       │
               ▼       ▼
        Scale More   Optimize Code
```

#### Scaling Strategies
```javascript
// Auto-scaling configuration
const scalingPolicy = {
  minWorkers: 2,
  maxWorkers: 10,

  scaleUpThreshold: {
    queueDepth: 100,
    cpuUsage: 80,
    taskWaitTime: 30000  // 30 seconds
  },

  scaleDownThreshold: {
    queueDepth: 10,
    cpuUsage: 20,
    idleTime: 300000  // 5 minutes
  },

  cooldownPeriod: 60000  // 1 minute between scaling actions
};

class AutoScaler {
  async evaluate() {
    const metrics = await this.collectMetrics();

    if (this.shouldScaleUp(metrics)) {
      await this.scaleUp();
    } else if (this.shouldScaleDown(metrics)) {
      await this.scaleDown();
    }
  }

  shouldScaleUp(metrics) {
    return metrics.queueDepth > this.policy.scaleUpThreshold.queueDepth ||
           metrics.avgCpuUsage > this.policy.scaleUpThreshold.cpuUsage ||
           metrics.avgWaitTime > this.policy.scaleUpThreshold.taskWaitTime;
  }

  shouldScaleDown(metrics) {
    return metrics.queueDepth < this.policy.scaleDownThreshold.queueDepth &&
           metrics.avgCpuUsage < this.policy.scaleDownThreshold.cpuUsage &&
           metrics.idleTime > this.policy.scaleDownThreshold.idleTime;
  }
}
```

### 2.3 Monitoring Setup

#### Metrics Collection
```javascript
class MetricsCollector {
  constructor() {
    this.metrics = {
      // System metrics
      'agent.tasks.received': new Counter(),
      'agent.tasks.completed': new Counter(),
      'agent.tasks.failed': new Counter(),
      'agent.tasks.duration': new Histogram(),

      // Queue metrics
      'queue.depth': new Gauge(),
      'queue.consumers': new Gauge(),
      'queue.message_rate': new Rate(),

      // Connection metrics
      'connection.state': new Gauge(),
      'connection.reconnects': new Counter(),

      // Agent metrics
      'agent.active_tasks': new Gauge(),
      'agent.uptime': new Counter(),
      'agent.memory_usage': new Gauge()
    };
  }

  recordTaskCompleted(duration) {
    this.metrics['agent.tasks.completed'].inc();
    this.metrics['agent.tasks.duration'].observe(duration);
  }

  recordQueueDepth(depth) {
    this.metrics['queue.depth'].set(depth);
  }

  async export() {
    // Export to Prometheus, Grafana, etc.
    return Object.entries(this.metrics).map(([name, metric]) => ({
      name,
      value: metric.value,
      timestamp: Date.now()
    }));
  }
}
```

#### Health Checks
```javascript
class HealthChecker {
  async checkHealth() {
    const checks = {
      rabbitmq: await this.checkRabbitMQ(),
      agent: await this.checkAgent(),
      memory: await this.checkMemory(),
      tasks: await this.checkTasks()
    };

    const healthy = Object.values(checks).every(check => check.healthy);

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      checks,
      timestamp: Date.now()
    };
  }

  async checkRabbitMQ() {
    try {
      return {
        healthy: this.client.isHealthy(),
        message: 'Connected to RabbitMQ'
      };
    } catch (error) {
      return {
        healthy: false,
        message: error.message
      };
    }
  }

  async checkAgent() {
    return {
      healthy: this.orchestrator.activeTasks.size < 100,
      message: `${this.orchestrator.activeTasks.size} active tasks`
    };
  }

  async checkMemory() {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapLimitMB = 512;  // Example limit

    return {
      healthy: heapUsedMB < heapLimitMB,
      message: `${heapUsedMB.toFixed(2)}MB / ${heapLimitMB}MB`
    };
  }

  async checkTasks() {
    const stuck = Array.from(this.orchestrator.activeTasks.values())
      .filter(task => Date.now() - task.startedAt > 600000);  // 10 minutes

    return {
      healthy: stuck.length === 0,
      message: stuck.length > 0 ? `${stuck.length} stuck tasks` : 'All tasks progressing'
    };
  }
}
```

### 2.4 Backup Strategies

#### Configuration Backup
```bash
#!/bin/bash
# backup-config.sh

BACKUP_DIR="/backups/rabbitmq-config"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 1. Export RabbitMQ definitions
rabbitmqadmin export "$BACKUP_DIR/definitions_$TIMESTAMP.json"

# 2. Backup environment variables
cp .env "$BACKUP_DIR/env_$TIMESTAMP"

# 3. Backup agent configurations
tar -czf "$BACKUP_DIR/agent_config_$TIMESTAMP.tar.gz" \
  agents/ skills/ commands/ hooks/

# 4. Upload to S3 or remote storage
aws s3 sync "$BACKUP_DIR" "s3://my-bucket/rabbitmq-backups/"

# 5. Cleanup old backups (keep last 30 days)
find "$BACKUP_DIR" -mtime +30 -delete
```

#### Message Persistence
```javascript
// Ensure durable queues and persistent messages
async setupTaskQueue(queueName = 'agent.tasks') {
  await this.channel.assertQueue(queueName, {
    durable: true,              // ✅ Queue survives broker restart
    arguments: {
      'x-message-ttl': 3600000, // Messages expire after 1 hour
      'x-max-length': 10000,    // Max 10k messages
      'x-queue-mode': 'lazy'    // Persist to disk immediately
    }
  });
}

async publishTask(task, queueName = 'agent.tasks') {
  this.channel.sendToQueue(
    queueName,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,          // ✅ Message survives restart
      contentType: 'application/json',
      messageId: message.id,
      timestamp: Date.now(),
      expiration: '3600000'      // 1 hour TTL
    }
  );
}
```

---

## 3. Message Queue Best Practices

### 3.1 Queue Design

#### Queue Naming Convention
```
Pattern: <domain>.<type>.<subtype>

Examples:
  agent.tasks            - General task queue
  agent.tasks.high       - High-priority tasks
  agent.tasks.backend    - Backend-specific tasks
  agent.results          - Results from workers
  agent.brainstorm       - Collaboration messages
  agent.status           - Status updates
```

#### Queue Types and Use Cases
```
┌─────────────────────────────────────────────────┐
│              Queue Types                         │
├─────────────────────────────────────────────────┤
│                                                  │
│  Work Queue (Point-to-Point)                    │
│  ┌────────┐    ┌─────┐    ┌────────┐            │
│  │Producer│───▶│Queue│───▶│Consumer│            │
│  └────────┘    └─────┘    └────────┘            │
│  Use: Task distribution, load balancing          │
│                                                  │
│  ──────────────────────────────────────────     │
│                                                  │
│  Fanout Exchange (Broadcast)                    │
│  ┌────────┐    ┌────────┐   ┌──────────┐        │
│  │Producer│───▶│Exchange│──▶│Consumer 1│        │
│  └────────┘    └────┬───┘   └──────────┘        │
│                     │        ┌──────────┐        │
│                     └───────▶│Consumer 2│        │
│                              └──────────┘        │
│  Use: Brainstorming, broadcasts                 │
│                                                  │
│  ──────────────────────────────────────────     │
│                                                  │
│  Topic Exchange (Selective Routing)             │
│  ┌────────┐    ┌────────┐   ┌──────────┐        │
│  │Producer│───▶│Exchange│──▶│error.*   │        │
│  └────────┘    └────┬───┘   └──────────┘        │
│  routing:          │        ┌──────────┐        │
│  "agent.error"     └───────▶│agent.#   │        │
│                              └──────────┘        │
│  Use: Status updates, logging, alerts           │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 3.2 Message Persistence

#### Durability Configuration
```javascript
class DurableMessaging {
  async setupProduction() {
    // 1. Durable exchange
    await this.channel.assertExchange('agent.tasks.exchange', 'direct', {
      durable: true  // ✅ Survives broker restart
    });

    // 2. Durable queue
    await this.channel.assertQueue('agent.tasks', {
      durable: true,           // ✅ Queue definition persists
      arguments: {
        'x-queue-mode': 'lazy' // ✅ Messages written to disk immediately
      }
    });

    // 3. Persistent messages
    this.channel.publish(
      'agent.tasks.exchange',
      'tasks',
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,      // ✅ Message survives restart
        deliveryMode: 2        // ✅ Persistent delivery mode
      }
    );

    // 4. Publisher confirms
    await this.channel.confirmSelect();
    this.channel.on('return', (msg) => {
      console.error('Message returned:', msg);
    });
  }
}
```

### 3.3 Retry Strategies

#### Exponential Backoff with Dead Letter Queue
```javascript
async setupRetryStrategy() {
  // 1. Main queue
  await this.channel.assertQueue('agent.tasks', {
    durable: true,
    deadLetterExchange: 'agent.tasks.dlx',
    deadLetterRoutingKey: 'retry'
  });

  // 2. Retry queue with delay
  await this.channel.assertQueue('agent.tasks.retry', {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: 'agent.tasks',
    messageTtl: 5000  // 5 second delay before retry
  });

  // 3. Dead letter exchange
  await this.channel.assertExchange('agent.tasks.dlx', 'direct', {
    durable: true
  });

  // 4. Bind retry queue
  await this.channel.bindQueue('agent.tasks.retry', 'agent.tasks.dlx', 'retry');

  // 5. Final DLQ for failed messages
  await this.channel.assertQueue('agent.tasks.dead', {
    durable: true
  });
}

async handleTaskWithRetry(msg, { ack, nack, reject }) {
  try {
    await this.processTask(msg);
    ack();
  } catch (error) {
    const retryCount = msg.properties.headers?.['x-retry-count'] || 0;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      // Increment retry count
      nack(false);  // Don't requeue, goes to DLX

      // Publish to retry queue with updated count
      this.channel.publish(
        'agent.tasks.dlx',
        'retry',
        msg.content,
        {
          headers: {
            'x-retry-count': retryCount + 1,
            'x-first-failure': msg.properties.headers?.['x-first-failure'] || Date.now()
          }
        }
      );
    } else {
      // Max retries exceeded, send to dead letter queue
      reject();
      await this.alertFailedTask(msg, error);
    }
  }
}
```

#### Retry Strategy Matrix
```
┌────────────────┬──────────────┬─────────────┬──────────────┐
│ Error Type     │ Retry Count  │ Backoff     │ Final Action │
├────────────────┼──────────────┼─────────────┼──────────────┤
│ Network        │ 5            │ Exponential │ DLQ + Alert  │
│ Timeout        │ 3            │ Linear      │ DLQ          │
│ Validation     │ 0            │ None        │ DLQ          │
│ Rate Limit     │ 10           │ Fixed 60s   │ DLQ + Alert  │
│ Resource       │ 3            │ Exponential │ Scale Up     │
└────────────────┴──────────────┴─────────────┴──────────────┘
```

### 3.4 Dead Letter Handling

#### DLQ Setup and Monitoring
```javascript
class DeadLetterHandler {
  async setup() {
    // Create DLQ
    await this.channel.assertQueue('agent.tasks.dead', {
      durable: true,
      arguments: {
        'x-max-length': 10000,  // Limit DLQ size
        'x-message-ttl': 604800000  // Keep for 7 days
      }
    });

    // Monitor DLQ
    this.startDLQMonitoring();
  }

  startDLQMonitoring() {
    setInterval(async () => {
      const queueInfo = await this.getQueueInfo('agent.tasks.dead');

      if (queueInfo.messageCount > 100) {
        await this.alertHighDLQ(queueInfo);
      }

      // Analyze failed messages
      await this.analyzeDLQ();
    }, 60000);  // Check every minute
  }

  async analyzeDLQ() {
    await this.channel.consume('agent.tasks.dead', async (msg) => {
      if (!msg) return;

      const content = JSON.parse(msg.content.toString());
      const headers = msg.properties.headers || {};

      // Extract failure information
      const failure = {
        taskId: content.id,
        task: content.task,
        retryCount: headers['x-retry-count'] || 0,
        firstFailure: headers['x-first-failure'],
        lastError: headers['x-last-error'],
        duration: Date.now() - (headers['x-first-failure'] || Date.now())
      };

      // Log for analysis
      await this.logDLQMessage(failure);

      // Check if task should be retried manually
      if (this.shouldManualRetry(failure)) {
        await this.requeueForManualRetry(msg);
      }

      // Archive message
      await this.archiveDLQMessage(msg);
      this.channel.ack(msg);

    }, { noAck: false });
  }

  shouldManualRetry(failure) {
    // Retry if error was due to temporary system issue
    // and task is less than 1 hour old
    const isRecent = Date.now() - failure.firstFailure < 3600000;
    const isSystemError = failure.lastError?.includes('ECONNREFUSED');

    return isRecent && isSystemError;
  }
}
```

---

## 4. Agent Design Patterns

### 4.1 Task Decomposition

#### Hierarchical Task Breakdown
```
         ┌────────────────────┐
         │  Build Feature X   │  (Team Leader)
         └──────────┬─────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
    ┌───▼───┐   ┌──▼───┐   ┌───▼───┐
    │Backend│   │Front-│   │Tests  │  (Workers)
    │ API   │   │ end  │   │       │
    └───┬───┘   └──┬───┘   └───┬───┘
        │          │           │
    ┌───┴───┐  ┌───┴───┐   ┌───┴───┐
    │Routes │  │UI     │   │Unit   │  (Sub-tasks)
    │Models │  │State  │   │E2E    │
    │Logic  │  │Styles │   │       │
    └───────┘  └───────┘   └───────┘
```

#### Implementation
```javascript
class TaskDecomposer {
  async decomposeTask(task) {
    if (task.complexity === 'simple') {
      return [task];  // No decomposition needed
    }

    const subtasks = [];

    // Decompose based on task type
    switch (task.type) {
      case 'feature':
        subtasks.push(...this.decomposeFeature(task));
        break;
      case 'bug-fix':
        subtasks.push(...this.decomposeBugFix(task));
        break;
      case 'refactor':
        subtasks.push(...this.decomposeRefactor(task));
        break;
    }

    // Add dependencies
    this.addDependencies(subtasks);

    return subtasks;
  }

  decomposeFeature(task) {
    return [
      {
        id: `${task.id}-design`,
        type: 'design',
        title: `Design ${task.title}`,
        description: 'Create architecture and design',
        dependencies: []
      },
      {
        id: `${task.id}-backend`,
        type: 'implementation',
        title: `Backend for ${task.title}`,
        description: 'Implement backend API',
        dependencies: [`${task.id}-design`]
      },
      {
        id: `${task.id}-frontend`,
        type: 'implementation',
        title: `Frontend for ${task.title}`,
        description: 'Implement UI components',
        dependencies: [`${task.id}-design`, `${task.id}-backend`]
      },
      {
        id: `${task.id}-tests`,
        type: 'testing',
        title: `Tests for ${task.title}`,
        description: 'Write unit and integration tests',
        dependencies: [`${task.id}-backend`, `${task.id}-frontend`]
      }
    ];
  }

  addDependencies(subtasks) {
    // Build dependency graph
    const graph = new Map();

    for (const subtask of subtasks) {
      graph.set(subtask.id, {
        task: subtask,
        dependencies: subtask.dependencies || [],
        dependents: []
      });
    }

    // Link dependents
    for (const [id, node] of graph.entries()) {
      for (const depId of node.dependencies) {
        if (graph.has(depId)) {
          graph.get(depId).dependents.push(id);
        }
      }
    }

    return graph;
  }
}
```

### 4.2 Collaboration Patterns

#### Consensus Building Pattern
```javascript
class ConsensusBuilder {
  async buildConsensus(topic, question, requiredAgents = []) {
    const sessionId = uuidv4();
    const responses = [];

    // 1. Broadcast question
    await this.client.broadcastBrainstorm({
      sessionId,
      topic,
      question,
      requiredAgents,
      deadline: Date.now() + 60000  // 1 minute
    });

    // 2. Collect responses
    const responsePromise = new Promise((resolve) => {
      this.client.consumeResults('agent.results', async (msg) => {
        if (msg.result.sessionId === sessionId) {
          responses.push(msg.result);

          // Check if all required agents responded
          const responded = new Set(responses.map(r => r.from));
          const allResponded = requiredAgents.every(id => responded.has(id));

          if (allResponded || responses.length >= 3) {
            resolve(responses);
          }
        }
      });
    });

    // 3. Wait with timeout
    const results = await Promise.race([
      responsePromise,
      timeout(60000, [])  // Default to empty if timeout
    ]);

    // 4. Build consensus
    const consensus = this.analyzeResponses(results);

    return consensus;
  }

  analyzeResponses(responses) {
    // Extract suggestions
    const suggestions = responses.map(r => r.suggestion);

    // Find common themes
    const themes = this.extractThemes(suggestions);

    // Weight by agent expertise
    const weighted = this.weightByExpertise(responses);

    // Build final consensus
    return {
      decision: weighted[0].suggestion,
      confidence: this.calculateConfidence(responses),
      alternatives: weighted.slice(1, 3),
      allResponses: responses
    };
  }

  extractThemes(suggestions) {
    // Simple keyword extraction
    const keywords = new Map();

    for (const suggestion of suggestions) {
      const words = suggestion.toLowerCase().split(/\W+/);
      for (const word of words) {
        if (word.length > 4) {  // Skip short words
          keywords.set(word, (keywords.get(word) || 0) + 1);
        }
      }
    }

    // Return top themes
    return Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }
}
```

#### Specialized Agent Pattern
```
┌──────────────────────────────────────────────────┐
│              Agent Specialization                 │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │Team Leader  │  │ Coordinator  │               │
│  │             │  │              │               │
│  │• Assign     │  │• Workflow    │               │
│  │• Decide     │  │• Dependencies│               │
│  │• Aggregate  │  │• Checkpoints │               │
│  └─────────────┘  └──────────────┘               │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │Backend      │  │Frontend      │               │
│  │Specialist   │  │Specialist    │               │
│  │             │  │              │               │
│  │• APIs       │  │• UI/UX       │               │
│  │• Database   │  │• State       │               │
│  │• Services   │  │• Components  │               │
│  └─────────────┘  └──────────────┘               │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │Test         │  │DevOps        │               │
│  │Specialist   │  │Specialist    │               │
│  │             │  │              │               │
│  │• Unit tests │  │• CI/CD       │               │
│  │• E2E tests  │  │• Deploy      │               │
│  │• Coverage   │  │• Monitor     │               │
│  └─────────────┘  └──────────────┘               │
│                                                   │
└──────────────────────────────────────────────────┘
```

### 4.3 State Management

#### Distributed State Pattern
```javascript
class DistributedState {
  constructor(client, stateKey) {
    this.client = client;
    this.stateKey = stateKey;
    this.localState = new Map();
    this.version = 0;
  }

  async initialize() {
    // Subscribe to state updates
    await this.client.subscribeStatus(
      `state.${this.stateKey}.#`,
      'agent.state',
      async (msg) => {
        await this.handleStateUpdate(msg);
      }
    );

    // Request current state
    await this.client.publishStatus(
      { action: 'request-state', key: this.stateKey },
      `state.${this.stateKey}.request`
    );
  }

  async set(key, value) {
    this.version++;
    this.localState.set(key, { value, version: this.version });

    // Broadcast update
    await this.client.publishStatus(
      {
        action: 'state-update',
        key: this.stateKey,
        data: { key, value },
        version: this.version,
        timestamp: Date.now()
      },
      `state.${this.stateKey}.update`
    );
  }

  async get(key) {
    return this.localState.get(key)?.value;
  }

  async handleStateUpdate(msg) {
    const { data, version, timestamp } = msg.status;

    // Only accept newer versions
    const current = this.localState.get(data.key);
    if (!current || version > current.version) {
      this.localState.set(data.key, {
        value: data.value,
        version,
        timestamp
      });
    }
  }

  async snapshot() {
    return {
      state: Object.fromEntries(this.localState),
      version: this.version,
      timestamp: Date.now()
    };
  }

  async restore(snapshot) {
    this.localState = new Map(Object.entries(snapshot.state));
    this.version = snapshot.version;
  }
}
```

### 4.4 Error Recovery

#### Circuit Breaker Pattern
```javascript
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000;

    this.state = 'CLOSED';  // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        console.log(`Circuit breaker ${this.name} closed`);
      }
    }
  }

  onFailure() {
    this.failures++;
    this.successes = 0;

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.error(`Circuit breaker ${this.name} opened`);

      // Alert
      this.client.publishStatus({
        alert: 'circuit_breaker_open',
        breaker: this.name,
        failures: this.failures
      }, 'agent.status.alert');
    }
  }
}

// Usage
const taskProcessorBreaker = new CircuitBreaker('task-processor', {
  failureThreshold: 5,
  timeout: 60000
});

async handleTask(msg, { ack, nack }) {
  try {
    await taskProcessorBreaker.execute(async () => {
      return await this.processTask(msg.task);
    });
    ack();
  } catch (error) {
    if (error.message.includes('Circuit breaker')) {
      // Circuit is open, requeue for later
      nack(true);
    } else {
      // Other error
      nack(false);
    }
  }
}
```

---

## 5. Performance Best Practices

### 5.1 Prefetch Optimization

#### Finding Optimal Prefetch Count
```
Prefetch Too Low (=1):
┌────────┐        ┌────────┐
│Worker  │◄──────►│RabbitMQ│
└────────┘        └────────┘
   ▲  │
   │  └──ACK──┐
   │          │      High latency between
   └──TASK───┘      tasks (network RTT)

Prefetch Optimal (=5):
┌────────┐        ┌────────┐
│Worker  │◄──────►│RabbitMQ│
└────────┘        └────────┘
   ▲  │
   ├──┼──TASK 1
   ├──┼──TASK 2     Worker processes
   ├──┼──TASK 3     continuously without
   ├──┼──TASK 4     waiting for network
   └──┼──TASK 5
      │
      └──ACK 1-5    Batch acknowledgments

Prefetch Too High (=100):
┌────────┐        ┌────────┐
│Worker  │◄──────►│RabbitMQ│
└────────┘        └────────┘
   ▲
   ├──TASK 1...100   If worker crashes,
   │                 all 100 messages lost
   │                 and need redelivery
   └──(crash)        High memory usage
```

#### Configuration
```javascript
class PrefetchOptimizer {
  async optimizePrefetch() {
    const metrics = await this.collectMetrics();

    // Calculate optimal prefetch based on:
    // 1. Task processing time
    // 2. Network latency
    // 3. Available memory

    const avgProcessingTime = metrics.avgProcessingTime;  // ms
    const networkLatency = metrics.networkLatency;        // ms
    const availableMemory = metrics.availableMemory;      // MB
    const avgTaskSize = metrics.avgTaskSize;              // MB

    // Formula: prefetch = (2 * networkLatency) / avgProcessingTime
    // Ensures worker always has tasks to process
    let prefetch = Math.ceil((2 * networkLatency) / avgProcessingTime);

    // Limit by memory
    const maxByMemory = Math.floor(availableMemory / avgTaskSize);
    prefetch = Math.min(prefetch, maxByMemory);

    // Clamp between 1 and 50
    prefetch = Math.max(1, Math.min(50, prefetch));

    console.log(`Optimal prefetch count: ${prefetch}`);
    await this.channel.prefetch(prefetch);

    return prefetch;
  }
}

// Typical values:
// Fast tasks (<100ms): prefetch = 10-20
// Medium tasks (1s): prefetch = 5-10
// Slow tasks (>10s): prefetch = 1-3
// Memory-intensive: prefetch = 1
```

### 5.2 Connection Pooling

#### Connection Pool Implementation
```javascript
class RabbitMQConnectionPool {
  constructor(options = {}) {
    this.url = options.url || process.env.RABBITMQ_URL;
    this.poolSize = options.poolSize || 5;
    this.connections = [];
    this.channels = [];
    this.roundRobin = 0;
  }

  async initialize() {
    console.log(`Creating connection pool with ${this.poolSize} connections...`);

    // Create connections in parallel
    const promises = [];
    for (let i = 0; i < this.poolSize; i++) {
      promises.push(this.createConnection(i));
    }

    await Promise.all(promises);
    console.log(`Connection pool ready with ${this.connections.length} connections`);
  }

  async createConnection(index) {
    const connection = await amqp.connect(this.url, {
      clientProperties: {
        connection_name: `pool-${index}`
      }
    });

    connection.on('error', (err) => {
      console.error(`Connection ${index} error:`, err);
      this.reconnectConnection(index);
    });

    connection.on('close', () => {
      console.log(`Connection ${index} closed, reconnecting...`);
      this.reconnectConnection(index);
    });

    this.connections[index] = connection;

    // Create channel
    const channel = await connection.createChannel();
    this.channels[index] = channel;
  }

  async reconnectConnection(index) {
    await sleep(1000);
    await this.createConnection(index);
  }

  getChannel() {
    // Round-robin channel selection
    const channel = this.channels[this.roundRobin];
    this.roundRobin = (this.roundRobin + 1) % this.poolSize;
    return channel;
  }

  async publish(exchange, routingKey, content, options) {
    const channel = this.getChannel();
    return channel.publish(exchange, routingKey, content, options);
  }

  async sendToQueue(queue, content, options) {
    const channel = this.getChannel();
    return channel.sendToQueue(queue, content, options);
  }

  async close() {
    console.log('Closing connection pool...');
    for (const connection of this.connections) {
      await connection.close();
    }
  }
}
```

### 5.3 Batch Processing

#### Batch Message Processing
```javascript
class BatchProcessor {
  constructor(batchSize = 10, batchTimeout = 5000) {
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
    this.batch = [];
    this.batchTimer = null;
  }

  async addMessage(msg, ackCallback) {
    this.batch.push({ msg, ackCallback });

    // Process when batch is full
    if (this.batch.length >= this.batchSize) {
      await this.processBatch();
    } else {
      // Set timer for partial batch
      this.resetTimer();
    }
  }

  resetTimer() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(async () => {
      if (this.batch.length > 0) {
        await this.processBatch();
      }
    }, this.batchTimeout);
  }

  async processBatch() {
    if (this.batch.length === 0) return;

    const currentBatch = this.batch.splice(0, this.batchSize);

    console.log(`Processing batch of ${currentBatch.length} messages`);

    try {
      // Process all messages in batch
      const results = await Promise.all(
        currentBatch.map(({ msg }) => this.processMessage(msg))
      );

      // Acknowledge all successful messages
      for (const { ackCallback } of currentBatch) {
        ackCallback();
      }

      console.log(`Batch completed: ${results.length} messages processed`);

    } catch (error) {
      console.error('Batch processing error:', error);
      // Handle errors (could requeue or send to DLQ)
    }
  }

  async processMessage(msg) {
    // Process individual message
    const content = JSON.parse(msg.content.toString());
    // ... processing logic
    return content;
  }
}

// Usage
const batchProcessor = new BatchProcessor(10, 5000);

await client.consumeTasks('agent.tasks', async (msg, { ack }) => {
  await batchProcessor.addMessage(msg, ack);
});
```

### 5.4 Caching Strategies

#### Multi-Level Cache
```javascript
class CacheManager {
  constructor() {
    // L1: In-memory (fast, small)
    this.l1Cache = new Map();
    this.l1MaxSize = 1000;
    this.l1TTL = 60000;  // 1 minute

    // L2: Redis (medium, larger)
    this.l2Cache = null;  // Redis client
    this.l2TTL = 3600000;  // 1 hour

    // L3: Disk (slow, unlimited)
    this.l3Cache = null;  // File system
  }

  async get(key) {
    // Try L1 cache
    const l1Value = this.l1Cache.get(key);
    if (l1Value && Date.now() - l1Value.timestamp < this.l1TTL) {
      return l1Value.data;
    }

    // Try L2 cache (Redis)
    if (this.l2Cache) {
      const l2Value = await this.l2Cache.get(key);
      if (l2Value) {
        // Promote to L1
        this.l1Cache.set(key, {
          data: l2Value,
          timestamp: Date.now()
        });
        return l2Value;
      }
    }

    // Try L3 cache (Disk)
    if (this.l3Cache) {
      const l3Value = await this.l3Cache.get(key);
      if (l3Value) {
        // Promote to L2 and L1
        if (this.l2Cache) {
          await this.l2Cache.set(key, l3Value, this.l2TTL);
        }
        this.l1Cache.set(key, {
          data: l3Value,
          timestamp: Date.now()
        });
        return l3Value;
      }
    }

    return null;
  }

  async set(key, value) {
    // Write to all levels
    this.l1Cache.set(key, {
      data: value,
      timestamp: Date.now()
    });

    // Evict oldest if L1 full
    if (this.l1Cache.size > this.l1MaxSize) {
      const oldest = this.findOldestEntry();
      this.l1Cache.delete(oldest);
    }

    if (this.l2Cache) {
      await this.l2Cache.set(key, value, this.l2TTL);
    }

    if (this.l3Cache) {
      await this.l3Cache.set(key, value);
    }
  }

  findOldestEntry() {
    let oldest = null;
    let oldestTime = Infinity;

    for (const [key, value] of this.l1Cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldest = key;
        oldestTime = value.timestamp;
      }
    }

    return oldest;
  }

  async invalidate(key) {
    this.l1Cache.delete(key);
    if (this.l2Cache) {
      await this.l2Cache.del(key);
    }
    if (this.l3Cache) {
      await this.l3Cache.delete(key);
    }
  }
}
```

---

## 6. Security Best Practices

### 6.1 Authentication

#### RabbitMQ Authentication
```javascript
// 1. Connection with authentication
const client = new RabbitMQClient({
  url: 'amqps://username:password@rabbitmq.example.com:5671',
  // Or use environment variables
  host: process.env.RABBITMQ_HOST,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USER,
  password: process.env.RABBITMQ_PASSWORD,
  vhost: process.env.RABBITMQ_VHOST
});

// 2. Certificate-based authentication (TLS)
const client = new RabbitMQClient({
  url: 'amqps://rabbitmq.example.com:5671',
  cert: fs.readFileSync('/path/to/client-cert.pem'),
  key: fs.readFileSync('/path/to/client-key.pem'),
  ca: [fs.readFileSync('/path/to/ca-cert.pem')],
  passphrase: process.env.CERT_PASSPHRASE
});
```

#### Agent Authentication
```javascript
class AuthenticatedAgent {
  constructor() {
    this.agentId = process.env.AGENT_ID;
    this.apiKey = process.env.AGENT_API_KEY;
    this.secret = process.env.AGENT_SECRET;
  }

  generateAuthToken() {
    const payload = {
      agentId: this.agentId,
      timestamp: Date.now(),
      nonce: uuidv4()
    };

    // Sign with HMAC
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return {
      ...payload,
      signature
    };
  }

  verifyAuthToken(token) {
    const { signature, ...payload } = token;

    // Recreate signature
    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  async publishTask(task) {
    const authToken = this.generateAuthToken();

    await this.client.publishTask({
      ...task,
      auth: authToken
    });
  }
}
```

### 6.2 Authorization

#### Role-Based Access Control
```javascript
class RBACAuthorizer {
  constructor() {
    this.roles = {
      'team-leader': {
        permissions: [
          'task:assign',
          'task:reassign',
          'task:cancel',
          'agent:manage',
          'result:view',
          'status:view'
        ]
      },
      'worker': {
        permissions: [
          'task:view',
          'task:execute',
          'result:publish',
          'status:publish'
        ]
      },
      'collaborator': {
        permissions: [
          'brainstorm:participate',
          'suggestion:submit',
          'status:view'
        ]
      },
      'monitor': {
        permissions: [
          'status:view',
          'metrics:view',
          'alert:view'
        ]
      }
    };
  }

  hasPermission(agentType, permission) {
    const role = this.roles[agentType];
    return role && role.permissions.includes(permission);
  }

  async authorizeAction(agentType, action) {
    if (!this.hasPermission(agentType, action)) {
      throw new Error(`Agent type ${agentType} not authorized for action: ${action}`);
    }
  }
}

// Usage
const rbac = new RBACAuthorizer();

async assignTask(task) {
  await rbac.authorizeAction(this.agentType, 'task:assign');
  await this.client.publishTask(task);
}
```

### 6.3 Encryption

#### Message Encryption
```javascript
class MessageEncryption {
  constructor(encryptionKey) {
    this.algorithm = 'aes-256-gcm';
    this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
  }

  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }
}

// Usage
const encryption = new MessageEncryption(process.env.ENCRYPTION_KEY);

async publishTask(task) {
  const encrypted = encryption.encrypt(task);

  await this.client.publishTask({
    encrypted: true,
    payload: encrypted
  });
}

async handleTask(msg, { ack }) {
  if (msg.task.encrypted) {
    msg.task = encryption.decrypt(msg.task.payload);
  }

  await this.processTask(msg.task);
  ack();
}
```

### 6.4 Network Security

#### TLS Configuration
```bash
# RabbitMQ TLS Configuration
# /etc/rabbitmq/rabbitmq.conf

listeners.ssl.default = 5671

ssl_options.cacertfile = /path/to/ca_certificate.pem
ssl_options.certfile   = /path/to/server_certificate.pem
ssl_options.keyfile    = /path/to/server_key.pem
ssl_options.verify     = verify_peer
ssl_options.fail_if_no_peer_cert = true

# TLS versions
ssl_options.versions.1 = tlsv1.3
ssl_options.versions.2 = tlsv1.2

# Cipher suites (strong only)
ssl_options.ciphers.1 = ECDHE-ECDSA-AES256-GCM-SHA384
ssl_options.ciphers.2 = ECDHE-RSA-AES256-GCM-SHA384
```

#### VPN and Network Isolation
```
┌─────────────────────────────────────────────────┐
│              Network Topology                    │
│                                                  │
│  Internet                                        │
│     │                                            │
│     ├─────────┐                                  │
│     │         │                                  │
│  ┌──▼──┐   ┌─▼────┐                              │
│  │ WAF │   │ VPN  │                              │
│  └──┬──┘   └─┬────┘                              │
│     │        │                                   │
│     │    ┌───▼───────────────────┐               │
│     │    │  Private Network      │               │
│     │    │  (VPC/VNET)           │               │
│     │    │                       │               │
│     │    │  ┌─────────────────┐  │               │
│     │    │  │   RabbitMQ      │  │               │
│     │    │  │   (Internal)    │  │               │
│     │    │  └────────┬────────┘  │               │
│     │    │           │           │               │
│     │    │  ┌────────┴────────┐  │               │
│     │    │  │  Agent Cluster  │  │               │
│     │    │  │  (Private IPs)  │  │               │
│     │    │  └─────────────────┘  │               │
│     │    │                       │               │
│     │    └───────────────────────┘               │
│     │                                            │
│  ┌──▼──────────────┐                             │
│  │  Public API     │                             │
│  │  (Load Balanced)│                             │
│  └─────────────────┘                             │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### Firewall Rules
```bash
# Allow RabbitMQ AMQP (TLS)
iptables -A INPUT -p tcp --dport 5671 -s 10.0.0.0/8 -j ACCEPT

# Allow RabbitMQ Management (TLS)
iptables -A INPUT -p tcp --dport 15671 -s 10.0.0.0/8 -j ACCEPT

# Allow inter-cluster communication
iptables -A INPUT -p tcp --dport 25672 -s 10.0.0.0/8 -j ACCEPT

# Deny all other traffic to RabbitMQ ports
iptables -A INPUT -p tcp --dport 5672 -j DROP
iptables -A INPUT -p tcp --dport 15672 -j DROP
iptables -A INPUT -p tcp --dport 25672 -j DROP
```

---

## Summary Checklist

### Development
- [ ] Code is modular and follows single responsibility principle
- [ ] Comprehensive error handling with proper retry logic
- [ ] Structured logging with correlation IDs
- [ ] Unit tests (80%), integration tests (15%), E2E tests (5%)

### Operations
- [ ] Zero-downtime deployment strategy implemented
- [ ] Auto-scaling policies configured
- [ ] Health checks on all endpoints
- [ ] Backup and restore procedures tested

### Message Queue
- [ ] Durable queues with persistent messages
- [ ] Dead letter queues configured
- [ ] Exponential backoff retry strategy
- [ ] Message TTL and max length set

### Agent Design
- [ ] Task decomposition for complex work
- [ ] Collaboration patterns for consensus
- [ ] Distributed state management
- [ ] Circuit breakers for error recovery

### Performance
- [ ] Optimal prefetch count configured
- [ ] Connection pooling implemented
- [ ] Batch processing where applicable
- [ ] Multi-level caching strategy

### Security
- [ ] TLS encryption for all connections
- [ ] Strong authentication (certificates/keys)
- [ ] Role-based authorization
- [ ] Sensitive data encrypted at rest and in transit
- [ ] Network isolation and firewall rules

---

**Remember**: These are best practices, not rigid rules. Adapt based on your specific use case, scale, and requirements.
