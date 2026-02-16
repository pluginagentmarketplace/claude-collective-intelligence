# API Reference

Comprehensive API documentation for the Multi-Agent Orchestration System with RabbitMQ.

## Table of Contents

1. [RabbitMQ Client API](#rabbitmq-client-api)
2. [Orchestrator API](#orchestrator-api)
3. [Message Formats](#message-formats)
4. [Queue & Exchange Reference](#queue--exchange-reference)
5. [Hooks API](#hooks-api)
6. [Plugin API (Claude Code)](#plugin-api-claude-code)

---

## RabbitMQ Client API

The `RabbitMQClient` class provides the core messaging infrastructure for multi-agent communication.

### Type Definitions

```typescript
interface ClientConfig {
  url?: string;                // RabbitMQ connection URL
  heartbeat?: number;          // Heartbeat interval in seconds
  autoReconnect?: boolean;     // Enable automatic reconnection
  prefetchCount?: number;      // Number of messages to prefetch
}

interface MessageControl {
  ack: () => void;            // Acknowledge message
  nack: (requeue?: boolean) => void;  // Negative acknowledge
  reject: () => void;         // Reject message
}

type EventHandler<T> = (message: T, control?: MessageControl) => void | Promise<void>;
```

### Constructor

```typescript
constructor(config?: ClientConfig)
```

Creates a new RabbitMQ client instance.

**Parameters:**
- `config` (optional): Configuration object
  - `url` (string, default: `process.env.RABBITMQ_URL` or `'amqp://localhost:5672'`)
  - `heartbeat` (number, default: `30`)
  - `autoReconnect` (boolean, default: `true`)
  - `prefetchCount` (number, default: `1`)

**Returns:** `RabbitMQClient` instance

**Example:**

```javascript
import { RabbitMQClient } from './scripts/rabbitmq-client.js';

const client = new RabbitMQClient({
  url: 'amqp://localhost:5672',
  heartbeat: 30,
  autoReconnect: true,
  prefetchCount: 1
});
```

---

### Connection Methods

#### connect()

```typescript
async connect(): Promise<RabbitMQClient>
```

Establishes connection to RabbitMQ server and creates a channel.

**Returns:** Promise resolving to the client instance

**Throws:** Error if connection fails

**Events Emitted:**
- `'connected'` - When connection is established
- `'error'` - On connection errors
- `'disconnected'` - When connection is closed

**Example:**

```javascript
try {
  await client.connect();
  console.log('Connected to RabbitMQ');
} catch (error) {
  console.error('Connection failed:', error);
}
```

---

#### close()

```typescript
async close(): Promise<void>
```

Gracefully closes the channel and connection.

**Returns:** Promise that resolves when connection is closed

**Example:**

```javascript
await client.close();
console.log('Connection closed');
```

---

#### reconnect()

```typescript
async reconnect(): Promise<void>
```

Attempts to reconnect with exponential backoff.

**Returns:** Promise that resolves when reconnected

**Retry Logic:**
- Max attempts: 10
- Backoff: `Math.min(1000 * 2^attempt, 30000)` ms
- Emits `'max_reconnect_reached'` when attempts exhausted

**Example:**

```javascript
client.on('disconnected', async () => {
  console.log('Disconnected, will attempt reconnect...');
});

client.on('max_reconnect_reached', () => {
  console.error('Failed to reconnect after maximum attempts');
});
```

---

#### isHealthy()

```typescript
isHealthy(): boolean
```

Checks if the client is connected and healthy.

**Returns:** `true` if connected, `false` otherwise

**Example:**

```javascript
if (client.isHealthy()) {
  console.log('Client is ready');
} else {
  console.warn('Client is not connected');
}
```

---

### Queue Setup Methods

#### setupTaskQueue()

```typescript
async setupTaskQueue(queueName?: string): Promise<string>
```

Creates and configures the task distribution queue.

**Parameters:**
- `queueName` (string, default: `'agent.tasks'`): Name of the queue

**Queue Properties:**
- `durable: true` - Survives broker restarts
- `x-message-ttl: 3600000` - Messages expire after 1 hour
- `x-max-length: 10000` - Maximum 10,000 messages in queue

**Returns:** Promise resolving to queue name

**Example:**

```javascript
const queueName = await client.setupTaskQueue('agent.tasks');
console.log(`Task queue ready: ${queueName}`);
```

---

#### setupBrainstormExchange()

```typescript
async setupBrainstormExchange(exchangeName?: string): Promise<{
  exchangeName: string;
  queueName: string;
}>
```

Creates fanout exchange for broadcasting brainstorm messages.

**Parameters:**
- `exchangeName` (string, default: `'agent.brainstorm'`): Exchange name

**Exchange Properties:**
- Type: `fanout` - Broadcasts to all bound queues
- `durable: true` - Survives broker restarts

**Queue Properties:**
- `exclusive: true` - Only this connection can access
- `autoDelete: true` - Deleted when connection closes

**Returns:** Promise resolving to exchange and queue names

**Example:**

```javascript
const { exchangeName, queueName } = await client.setupBrainstormExchange();
console.log(`Brainstorm exchange: ${exchangeName}`);
console.log(`Personal queue: ${queueName}`);
```

---

#### setupResultQueue()

```typescript
async setupResultQueue(queueName?: string): Promise<string>
```

Creates queue for collecting agent results.

**Parameters:**
- `queueName` (string, default: `'agent.results'`): Queue name

**Queue Properties:**
- `durable: true` - Persists across restarts

**Returns:** Promise resolving to queue name

**Example:**

```javascript
const resultQueue = await client.setupResultQueue();
console.log(`Result queue ready: ${resultQueue}`);
```

---

#### setupStatusExchange()

```typescript
async setupStatusExchange(exchangeName?: string): Promise<string>
```

Creates topic exchange for selective status broadcasting.

**Parameters:**
- `exchangeName` (string, default: `'agent.status'`): Exchange name

**Exchange Properties:**
- Type: `topic` - Routes based on routing key patterns
- `durable: true` - Survives restarts

**Returns:** Promise resolving to exchange name

**Example:**

```javascript
const statusExchange = await client.setupStatusExchange();
console.log(`Status exchange ready: ${statusExchange}`);
```

---

### Publishing Methods

#### publishTask()

```typescript
async publishTask(task: object, queueName?: string): Promise<string>
```

Publishes a task to the task queue.

**Parameters:**
- `task` (object): Task data
- `queueName` (string, default: `'agent.tasks'`): Target queue

**Message Properties:**
- `persistent: true` - Survives broker restarts
- `contentType: 'application/json'`

**Returns:** Promise resolving to message ID (UUID)

**Example:**

```javascript
const taskId = await client.publishTask({
  title: 'Code Review',
  description: 'Review authentication module',
  priority: 'high',
  context: {
    files: ['auth.js', 'middleware.js']
  }
});

console.log(`Task published: ${taskId}`);
```

---

#### broadcastBrainstorm()

```typescript
async broadcastBrainstorm(message: object, exchangeName?: string): Promise<string>
```

Broadcasts a brainstorm request to all collaborators.

**Parameters:**
- `message` (object): Brainstorm data
- `exchangeName` (string, default: `'agent.brainstorm'`): Exchange name

**Returns:** Promise resolving to message ID (UUID)

**Example:**

```javascript
const sessionId = await client.broadcastBrainstorm({
  topic: 'API Design',
  question: 'Should we use REST or GraphQL?',
  requiredAgents: ['backend', 'frontend']
});

console.log(`Brainstorm initiated: ${sessionId}`);
```

---

#### publishResult()

```typescript
async publishResult(result: object, queueName?: string): Promise<string>
```

Publishes a task result or brainstorm response.

**Parameters:**
- `result` (object): Result data
- `queueName` (string, default: `'agent.results'`): Target queue

**Message Properties:**
- `persistent: true`
- `contentType: 'application/json'`

**Returns:** Promise resolving to message ID (UUID)

**Example:**

```javascript
const resultId = await client.publishResult({
  taskId: 'task-123',
  status: 'completed',
  output: 'Code review complete. Found 3 issues.',
  recommendations: ['Fix SQL injection', 'Add input validation', 'Update tests']
});

console.log(`Result published: ${resultId}`);
```

---

#### publishStatus()

```typescript
async publishStatus(
  status: object,
  routingKey?: string,
  exchangeName?: string
): Promise<string>
```

Publishes status update with topic routing.

**Parameters:**
- `status` (object): Status data
- `routingKey` (string, default: `'agent.status.info'`): Routing key for topic exchange
- `exchangeName` (string, default: `'agent.status'`): Exchange name

**Routing Key Patterns:**
- `agent.status.connected` - Agent connection
- `agent.status.disconnected` - Agent disconnection
- `agent.status.task.started` - Task started
- `agent.status.task.completed` - Task completed
- `agent.status.task.failed` - Task failed
- `agent.status.result` - Result published
- `agent.status.shutdown` - Agent shutdown

**Returns:** Promise resolving to message ID (UUID)

**Example:**

```javascript
await client.publishStatus(
  {
    agentId: 'agent-123',
    state: 'connected',
    agentType: 'worker'
  },
  'agent.status.connected'
);
```

---

### Consuming Methods

#### consumeTasks()

```typescript
async consumeTasks(
  queueName?: string,
  handler: (message: TaskMessage, control: MessageControl) => Promise<void>
): Promise<void>
```

Starts consuming tasks from the queue.

**Parameters:**
- `queueName` (string, default: `'agent.tasks'`): Queue to consume from
- `handler` (function): Async handler for messages

**Handler Parameters:**
- `message` (TaskMessage): Parsed message content
- `control` (MessageControl): Message acknowledgment controls
  - `ack()` - Acknowledge successful processing
  - `nack(requeue)` - Negative acknowledge (optionally requeue)
  - `reject()` - Reject message (send to dead letter)

**Returns:** Promise that resolves when consumer is set up

**Example:**

```javascript
await client.consumeTasks('agent.tasks', async (msg, { ack, nack, reject }) => {
  try {
    console.log(`Processing task: ${msg.task.title}`);

    // Process the task
    await processTask(msg.task);

    // Acknowledge success
    ack();
  } catch (error) {
    console.error('Task failed:', error);

    // Requeue if retries available
    if (msg.task.retryCount > 0) {
      msg.task.retryCount--;
      nack(true); // Requeue
    } else {
      reject(); // Send to dead letter
    }
  }
});
```

---

#### listenBrainstorm()

```typescript
async listenBrainstorm(
  queueName: string,
  handler: (message: BrainstormMessage) => Promise<void>
): Promise<void>
```

Listens for brainstorm broadcasts.

**Parameters:**
- `queueName` (string): Personal brainstorm queue name
- `handler` (function): Async handler for brainstorm messages

**Behavior:**
- Automatically filters out own messages
- Auto-acknowledges messages

**Returns:** Promise that resolves when listener is set up

**Example:**

```javascript
await client.listenBrainstorm(queueName, async (msg) => {
  console.log(`Brainstorm from ${msg.from}: ${msg.message.topic}`);
  console.log(`Question: ${msg.message.question}`);

  // Analyze and respond
  const response = await analyzeQuestion(msg.message);

  await client.publishResult({
    type: 'brainstorm_response',
    sessionId: msg.message.sessionId,
    suggestion: response
  });
});
```

---

#### consumeResults()

```typescript
async consumeResults(
  queueName?: string,
  handler: (message: ResultMessage) => Promise<void>
): Promise<void>
```

Consumes results from agents.

**Parameters:**
- `queueName` (string, default: `'agent.results'`): Queue to consume from
- `handler` (function): Async handler for result messages

**Returns:** Promise that resolves when consumer is set up

**Example:**

```javascript
await client.consumeResults('agent.results', async (msg) => {
  console.log(`Result from ${msg.from}`);
  console.log(`Task: ${msg.result.task}`);
  console.log(`Status: ${msg.result.status}`);

  // Store or aggregate results
  await storeResult(msg.result);
});
```

---

#### subscribeStatus()

```typescript
async subscribeStatus(
  pattern?: string,
  exchangeName?: string,
  handler: (message: StatusMessage) => Promise<void>
): Promise<void>
```

Subscribes to status updates using topic patterns.

**Parameters:**
- `pattern` (string, default: `'agent.status.#'`): Topic pattern
- `exchangeName` (string, default: `'agent.status'`): Exchange name
- `handler` (function): Async handler for status messages

**Pattern Matching:**
- `#` - Matches zero or more words
- `*` - Matches exactly one word
- Examples:
  - `agent.status.#` - All status messages
  - `agent.status.task.*` - All task-related status
  - `agent.status.connected` - Only connection events

**Returns:** Promise that resolves when subscription is set up

**Example:**

```javascript
// Subscribe to all status updates
await client.subscribeStatus('agent.status.#', 'agent.status', async (msg) => {
  console.log(`Status: ${msg.status.event} from ${msg.status.agentId}`);
});

// Subscribe to task events only
await client.subscribeStatus('agent.status.task.*', 'agent.status', async (msg) => {
  console.log(`Task event: ${msg.status.event}`);
});
```

---

### Events

The RabbitMQClient extends EventEmitter and emits the following events:

```typescript
client.on('connected', () => {
  console.log('Connected to RabbitMQ');
});

client.on('disconnected', () => {
  console.log('Disconnected from RabbitMQ');
});

client.on('error', (error: Error) => {
  console.error('Client error:', error);
});

client.on('max_reconnect_reached', () => {
  console.error('Failed to reconnect');
  process.exit(1);
});
```

---

## Orchestrator API

The `AgentOrchestrator` class manages agent lifecycle, task handling, and collaboration.

### Type Definitions

```typescript
interface Task {
  title: string;
  description: string;
  priority?: 'low' | 'normal' | 'high';
  requiresCollaboration?: boolean;
  collaborationQuestion?: string;
  requiredAgents?: string[];
  retryCount?: number;
  context?: object;
}

interface BrainstormSession {
  taskId?: string;
  topic: string;
  question: string;
  requiredAgents?: string[];
}

interface AgentStats {
  tasksReceived: number;
  tasksCompleted: number;
  tasksFailed: number;
  brainstormsParticipated: number;
  resultsPublished: number;
  activeTasks: number;
  activeBrainstorms: number;
  totalResults: number;
}

type AgentType = 'worker' | 'team-leader' | 'collaborator' | 'coordinator' | 'monitor';
```

---

### Constructor

```typescript
constructor(agentType?: AgentType)
```

Creates a new orchestrator instance.

**Parameters:**
- `agentType` (string, default: `'worker'`): Type of agent

**Agent Types:**
- `worker` - Executes tasks from queue
- `team-leader` - Coordinates and assigns tasks
- `collaborator` - Participates in brainstorming
- `coordinator` - Manages workflows
- `monitor` - System monitoring

**Returns:** `AgentOrchestrator` instance

**Example:**

```javascript
import AgentOrchestrator from './scripts/orchestrator.js';

const orchestrator = new AgentOrchestrator('worker');
```

---

### Initialization Methods

#### initialize()

```typescript
async initialize(): Promise<AgentOrchestrator>
```

Initializes the orchestrator and connects to RabbitMQ.

**Steps:**
1. Creates RabbitMQ client
2. Connects to RabbitMQ
3. Sets up queues and exchanges
4. Registers event handlers
5. Publishes connection status

**Returns:** Promise resolving to orchestrator instance

**Example:**

```javascript
const orchestrator = new AgentOrchestrator('worker');
await orchestrator.initialize();
console.log('Orchestrator initialized');
```

---

#### setupQueuesAndExchanges()

```typescript
async setupQueuesAndExchanges(): Promise<void>
```

Sets up all required queues and exchanges.

**Creates:**
- Task queue (`agent.tasks`)
- Brainstorm exchange and personal queue
- Result queue (`agent.results`)
- Status exchange (`agent.status`)

**Returns:** Promise that resolves when setup is complete

**Example:**

```javascript
await orchestrator.setupQueuesAndExchanges();
console.log('All queues and exchanges ready');
```

---

### Agent Role Methods

#### startTeamLeader()

```typescript
async startTeamLeader(): Promise<void>
```

Starts the agent as a team leader.

**Responsibilities:**
- Consumes results from `agent.results`
- Subscribes to all status updates
- Coordinates task distribution
- Aggregates results
- Makes decisions

**Returns:** Promise that resolves when started

**Example:**

```javascript
const leader = new AgentOrchestrator('team-leader');
await leader.initialize();
await leader.startTeamLeader();

// Now ready to assign tasks
await leader.assignTask({
  title: 'Code Review',
  description: 'Review authentication module',
  priority: 'high'
});
```

---

#### startWorker()

```typescript
async startWorker(): Promise<void>
```

Starts the agent as a worker.

**Responsibilities:**
- Consumes tasks from `agent.tasks`
- Processes tasks independently
- Publishes results
- Participates in brainstorms when requested

**Returns:** Promise that resolves when started

**Example:**

```javascript
const worker = new AgentOrchestrator('worker');
await worker.initialize();
await worker.startWorker();

// Now waiting for tasks from queue
console.log('Worker ready for tasks');
```

---

#### startCollaborator()

```typescript
async startCollaborator(): Promise<void>
```

Starts the agent as a collaborator.

**Responsibilities:**
- Listens for brainstorm requests
- Provides expert input
- Can also handle tasks
- Helps build consensus

**Returns:** Promise that resolves when started

**Example:**

```javascript
const collaborator = new AgentOrchestrator('collaborator');
await collaborator.initialize();
await collaborator.startCollaborator();

console.log('Collaborator ready for brainstorms');
```

---

### Task Management Methods

#### assignTask()

```typescript
async assignTask(task: Task): Promise<string>
```

Assigns a task to the worker pool (Team Leader function).

**Parameters:**
- `task` (Task): Task object

**Task Properties:**
- `title` (string, required): Task title
- `description` (string, required): Task description
- `priority` (string, optional): `'low'`, `'normal'`, or `'high'`
- `requiresCollaboration` (boolean, optional): Trigger brainstorming
- `collaborationQuestion` (string, optional): Question for brainstorm
- `requiredAgents` (string[], optional): Required agent types
- `retryCount` (number, optional): Number of retries on failure
- `context` (object, optional): Additional context

**Returns:** Promise resolving to task ID

**Example:**

```javascript
// Simple task
const taskId = await leader.assignTask({
  title: 'Fix bug #123',
  description: 'Fix null pointer exception in payment module',
  priority: 'high'
});

// Collaborative task
const taskId2 = await leader.assignTask({
  title: 'Design API',
  description: 'Design RESTful API for user management',
  priority: 'high',
  requiresCollaboration: true,
  collaborationQuestion: 'Should we use JWT or session-based auth?',
  requiredAgents: ['backend', 'security'],
  retryCount: 3,
  context: {
    framework: 'Express.js',
    database: 'PostgreSQL'
  }
});
```

---

#### handleTask()

```typescript
async handleTask(
  message: TaskMessage,
  control: MessageControl
): Promise<void>
```

Handles incoming task (Worker function).

**Parameters:**
- `message` (TaskMessage): Task message from queue
- `control` (MessageControl): Message acknowledgment controls

**Workflow:**
1. Parse task
2. Update statistics
3. Publish task started status
4. Execute task (initiate brainstorm if required)
5. Publish result
6. Acknowledge or reject message

**Returns:** Promise that resolves when task is handled

**Example:**

```javascript
// This is called automatically by startWorker()
// You don't typically call this directly

// Internal implementation handles:
// - Task execution
// - Brainstorming if needed
// - Result publishing
// - Error handling and retries
```

---

### Brainstorming Methods

#### initiateBrainstorm()

```typescript
async initiateBrainstorm(session: BrainstormSession): Promise<string>
```

Initiates a brainstorming session.

**Parameters:**
- `session` (BrainstormSession): Session configuration
  - `taskId` (string, optional): Associated task ID
  - `topic` (string, required): Brainstorm topic
  - `question` (string, required): Question to answer
  - `requiredAgents` (string[], optional): Required agent types

**Returns:** Promise resolving to session ID

**Example:**

```javascript
const sessionId = await orchestrator.initiateBrainstorm({
  topic: 'Performance Optimization',
  question: 'How can we reduce API latency from 500ms to 100ms?',
  requiredAgents: ['performance', 'database', 'caching']
});

console.log(`Brainstorm initiated: ${sessionId}`);
```

---

#### handleBrainstormMessage()

```typescript
async handleBrainstormMessage(message: BrainstormMessage): Promise<void>
```

Handles brainstorm request (Collaborator function).

**Parameters:**
- `message` (BrainstormMessage): Brainstorm message

**Workflow:**
1. Parse brainstorm request
2. Analyze question
3. Formulate response
4. Publish response to results queue

**Returns:** Promise that resolves when handled

**Example:**

```javascript
// This is called automatically by startCollaborator()
// Agent analyzes and responds automatically
```

---

### Result Management Methods

#### publishResult()

```typescript
async publishResult(result: object): Promise<void>
```

Publishes a result to the results queue.

**Parameters:**
- `result` (object): Result data

**Returns:** Promise that resolves when published

**Example:**

```javascript
await orchestrator.publishResult({
  taskId: 'task-123',
  task: 'Code Review',
  status: 'completed',
  output: 'Review complete',
  processedBy: 'agent-456',
  completedAt: Date.now(),
  duration: 5000,
  findings: ['SQL injection vulnerability', 'Missing input validation']
});
```

---

#### handleResult()

```typescript
async handleResult(message: ResultMessage): Promise<void>
```

Handles incoming result (Team Leader function).

**Parameters:**
- `message` (ResultMessage): Result message

**Workflow:**
1. Parse result
2. Determine type (task result or brainstorm response)
3. Store result
4. Display or aggregate

**Returns:** Promise that resolves when handled

**Example:**

```javascript
// This is called automatically by startTeamLeader()
// Results are aggregated automatically
```

---

### Status Methods

#### publishStatus()

```typescript
async publishStatus(status: object, routingKey: string): Promise<void>
```

Publishes status update.

**Parameters:**
- `status` (object): Status data
- `routingKey` (string): Topic routing key

**Returns:** Promise that resolves when published

**Example:**

```javascript
await orchestrator.publishStatus(
  {
    event: 'task_started',
    taskId: 'task-123',
    task: 'Code Review'
  },
  'agent.status.task.started'
);
```

---

#### handleStatusUpdate()

```typescript
async handleStatusUpdate(message: StatusMessage): Promise<void>
```

Handles status update from other agents.

**Parameters:**
- `message` (StatusMessage): Status message

**Returns:** Promise that resolves when handled

**Example:**

```javascript
// This is called automatically when subscribed to status updates
// Status updates are logged automatically
```

---

### Statistics Methods

#### getStats()

```typescript
getStats(): AgentStats
```

Returns current agent statistics.

**Returns:** AgentStats object

**Example:**

```javascript
const stats = orchestrator.getStats();
console.log(`Tasks completed: ${stats.tasksCompleted}`);
console.log(`Tasks failed: ${stats.tasksFailed}`);
console.log(`Active tasks: ${stats.activeTasks}`);
console.log(`Brainstorms participated: ${stats.brainstormsParticipated}`);
```

---

### Lifecycle Methods

#### shutdown()

```typescript
async shutdown(): Promise<void>
```

Gracefully shuts down the orchestrator.

**Workflow:**
1. Publish shutdown status with final stats
2. Close RabbitMQ connection
3. Clean up resources

**Returns:** Promise that resolves when shutdown is complete

**Example:**

```javascript
process.on('SIGINT', async () => {
  await orchestrator.shutdown();
  process.exit(0);
});
```

---

## Message Formats

All messages follow a standard envelope format with type-specific payloads.

### Base Message Format

```typescript
interface BaseMessage {
  id: string;              // UUID v4
  type: string;            // Message type
  from: string;            // Sender agent ID
  timestamp: number;       // Unix timestamp in milliseconds
}
```

---

### Task Message

Published to `agent.tasks` queue.

```typescript
interface TaskMessage extends BaseMessage {
  type: 'task';
  task: {
    title: string;
    description: string;
    priority: 'low' | 'normal' | 'high';
    assignedBy: string;
    assignedAt: number;
    requiresCollaboration?: boolean;
    collaborationQuestion?: string;
    requiredAgents?: string[];
    retryCount?: number;
    context?: object;
  };
}
```

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "type", "from", "timestamp", "task"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "type": { "type": "string", "enum": ["task"] },
    "from": { "type": "string" },
    "timestamp": { "type": "number" },
    "task": {
      "type": "object",
      "required": ["title", "description", "priority", "assignedBy", "assignedAt"],
      "properties": {
        "title": { "type": "string" },
        "description": { "type": "string" },
        "priority": { "type": "string", "enum": ["low", "normal", "high"] },
        "assignedBy": { "type": "string" },
        "assignedAt": { "type": "number" },
        "requiresCollaboration": { "type": "boolean" },
        "collaborationQuestion": { "type": "string" },
        "requiredAgents": { "type": "array", "items": { "type": "string" } },
        "retryCount": { "type": "number" },
        "context": { "type": "object" }
      }
    }
  }
}
```

**Example:**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "type": "task",
  "from": "agent-team-leader-01",
  "timestamp": 1699564800000,
  "task": {
    "title": "Code Review",
    "description": "Review authentication module for security vulnerabilities",
    "priority": "high",
    "assignedBy": "agent-team-leader-01",
    "assignedAt": 1699564800000,
    "requiresCollaboration": false,
    "retryCount": 3,
    "context": {
      "files": ["auth.js", "middleware.js"],
      "branch": "feature/auth-update"
    }
  }
}
```

---

### Brainstorm Message

Published to `agent.brainstorm` exchange.

```typescript
interface BrainstormMessage extends BaseMessage {
  type: 'brainstorm';
  message: {
    sessionId: string;
    topic: string;
    question: string;
    initiatedBy: string;
    requiredAgents?: string[];
  };
}
```

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "type", "from", "timestamp", "message"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "type": { "type": "string", "enum": ["brainstorm"] },
    "from": { "type": "string" },
    "timestamp": { "type": "number" },
    "message": {
      "type": "object",
      "required": ["sessionId", "topic", "question", "initiatedBy"],
      "properties": {
        "sessionId": { "type": "string", "format": "uuid" },
        "topic": { "type": "string" },
        "question": { "type": "string" },
        "initiatedBy": { "type": "string" },
        "requiredAgents": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

**Example:**

```json
{
  "id": "223e4567-e89b-12d3-a456-426614174001",
  "type": "brainstorm",
  "from": "agent-worker-02",
  "timestamp": 1699564900000,
  "message": {
    "sessionId": "323e4567-e89b-12d3-a456-426614174002",
    "topic": "API Design",
    "question": "Should we use REST, GraphQL, or gRPC for our microservices API?",
    "initiatedBy": "agent-worker-02",
    "requiredAgents": ["backend", "frontend", "architecture"]
  }
}
```

---

### Result Message

Published to `agent.results` queue.

```typescript
interface ResultMessage extends BaseMessage {
  type: 'result';
  result: {
    taskId?: string;
    sessionId?: string;
    task?: string;
    status?: 'completed' | 'failed' | 'partial';
    output?: string;
    processedBy?: string;
    completedAt?: number;
    duration?: number;
    // Brainstorm response fields
    type?: 'brainstorm_response';
    agentType?: string;
    suggestion?: string;
    // Additional fields
    [key: string]: any;
  };
}
```

**JSON Schema (Task Result):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "type", "from", "timestamp", "result"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "type": { "type": "string", "enum": ["result"] },
    "from": { "type": "string" },
    "timestamp": { "type": "number" },
    "result": {
      "type": "object",
      "required": ["taskId", "status", "processedBy"],
      "properties": {
        "taskId": { "type": "string", "format": "uuid" },
        "task": { "type": "string" },
        "status": { "type": "string", "enum": ["completed", "failed", "partial"] },
        "output": { "type": "string" },
        "processedBy": { "type": "string" },
        "completedAt": { "type": "number" },
        "duration": { "type": "number" }
      }
    }
  }
}
```

**Example (Task Result):**

```json
{
  "id": "423e4567-e89b-12d3-a456-426614174003",
  "type": "result",
  "from": "agent-worker-03",
  "timestamp": 1699565000000,
  "result": {
    "taskId": "123e4567-e89b-12d3-a456-426614174000",
    "task": "Code Review",
    "status": "completed",
    "output": "Code review complete. Found 3 security issues.",
    "processedBy": "agent-worker-03",
    "completedAt": 1699565000000,
    "duration": 5000,
    "findings": [
      "SQL injection vulnerability in auth.js line 45",
      "Missing input validation in middleware.js line 23",
      "Weak password hashing algorithm"
    ]
  }
}
```

**Example (Brainstorm Response):**

```json
{
  "id": "523e4567-e89b-12d3-a456-426614174004",
  "type": "result",
  "from": "agent-collaborator-04",
  "timestamp": 1699565100000,
  "result": {
    "type": "brainstorm_response",
    "sessionId": "323e4567-e89b-12d3-a456-426614174002",
    "agentType": "collaborator",
    "suggestion": "GraphQL provides better flexibility for frontend teams while REST is simpler to implement. Recommend GraphQL for public API, REST for internal services.",
    "pros": ["Flexible queries", "Strong typing", "Single endpoint"],
    "cons": ["Learning curve", "Caching complexity", "Overhead for simple queries"],
    "confidence": 0.85
  }
}
```

---

### Status Message

Published to `agent.status` exchange.

```typescript
interface StatusMessage extends BaseMessage {
  type: 'status';
  status: {
    agentId: string;
    agentType: AgentType;
    event?: string;
    state?: string;
    taskId?: string;
    task?: string;
    error?: string;
    stats?: AgentStats;
    [key: string]: any;
  };
}
```

**JSON Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "type", "from", "timestamp", "status"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "type": { "type": "string", "enum": ["status"] },
    "from": { "type": "string" },
    "timestamp": { "type": "number" },
    "status": {
      "type": "object",
      "required": ["agentId", "agentType"],
      "properties": {
        "agentId": { "type": "string" },
        "agentType": { "type": "string", "enum": ["worker", "team-leader", "collaborator", "coordinator", "monitor"] },
        "event": { "type": "string" },
        "state": { "type": "string" },
        "taskId": { "type": "string", "format": "uuid" },
        "task": { "type": "string" },
        "error": { "type": "string" },
        "stats": { "type": "object" }
      }
    }
  }
}
```

**Example (Connection):**

```json
{
  "id": "623e4567-e89b-12d3-a456-426614174005",
  "type": "status",
  "from": "agent-worker-05",
  "timestamp": 1699565200000,
  "status": {
    "agentId": "agent-worker-05",
    "agentType": "worker",
    "state": "connected",
    "stats": {
      "tasksReceived": 0,
      "tasksCompleted": 0,
      "tasksFailed": 0,
      "brainstormsParticipated": 0,
      "resultsPublished": 0
    }
  }
}
```

**Example (Task Event):**

```json
{
  "id": "723e4567-e89b-12d3-a456-426614174006",
  "type": "status",
  "from": "agent-worker-05",
  "timestamp": 1699565300000,
  "status": {
    "agentId": "agent-worker-05",
    "agentType": "worker",
    "event": "task_started",
    "taskId": "123e4567-e89b-12d3-a456-426614174000",
    "task": "Code Review"
  }
}
```

---

## Queue & Exchange Reference

### Queues

#### agent.tasks

**Purpose:** Distributes tasks to worker agents

**Type:** Work queue (point-to-point)

**Properties:**
- `durable: true` - Survives broker restarts
- `x-message-ttl: 3600000` - Messages expire after 1 hour
- `x-max-length: 10000` - Max queue size

**Routing:**
- Direct queue binding
- Round-robin distribution to consumers

**Consumers:** Worker agents, Collaborator agents, Coordinator agents

**Publishers:** Team Leader agents

**Message Format:** TaskMessage

**Example Usage:**

```javascript
// Publisher (Team Leader)
await client.publishTask({
  title: 'Code Review',
  description: 'Review auth module',
  priority: 'high'
});

// Consumer (Worker)
await client.consumeTasks('agent.tasks', async (msg, { ack }) => {
  // Process task
  ack();
});
```

---

#### agent.results

**Purpose:** Collects results and responses from agents

**Type:** Result queue (point-to-point)

**Properties:**
- `durable: true` - Survives broker restarts

**Consumers:** Team Leader agents

**Publishers:** Worker agents, Collaborator agents

**Message Format:** ResultMessage

**Example Usage:**

```javascript
// Publisher (Worker)
await client.publishResult({
  taskId: 'task-123',
  status: 'completed',
  output: 'Task complete'
});

// Consumer (Team Leader)
await client.consumeResults('agent.results', async (msg) => {
  console.log(`Result: ${msg.result.output}`);
});
```

---

#### brainstorm.{agentId}

**Purpose:** Personal queue for brainstorm broadcasts

**Type:** Temporary fanout queue

**Properties:**
- `exclusive: true` - Only this connection
- `autoDelete: true` - Deleted when connection closes

**Binding:** Bound to `agent.brainstorm` exchange

**Consumers:** Agent that created it

**Publishers:** Via `agent.brainstorm` exchange

**Message Format:** BrainstormMessage

**Example Usage:**

```javascript
// Setup
const { queueName } = await client.setupBrainstormExchange();

// Listen
await client.listenBrainstorm(queueName, async (msg) => {
  console.log(`Brainstorm: ${msg.message.question}`);
});
```

---

#### status.{agentId}

**Purpose:** Personal queue for status updates

**Type:** Temporary topic queue

**Properties:**
- `exclusive: true` - Only this connection
- `autoDelete: true` - Deleted when connection closes

**Binding:** Bound to `agent.status` exchange with pattern

**Consumers:** Agent that created it

**Publishers:** Via `agent.status` exchange

**Message Format:** StatusMessage

**Example Usage:**

```javascript
// Subscribe to all status updates
await client.subscribeStatus('agent.status.#', 'agent.status', async (msg) => {
  console.log(`Status: ${msg.status.event}`);
});

// Subscribe to task events only
await client.subscribeStatus('agent.status.task.*', 'agent.status', async (msg) => {
  console.log(`Task event: ${msg.status.event}`);
});
```

---

### Exchanges

#### agent.brainstorm

**Purpose:** Broadcasts brainstorm requests to all collaborators

**Type:** `fanout`

**Properties:**
- `durable: true` - Survives broker restarts

**Routing:** Broadcasts to all bound queues

**Bound Queues:** `brainstorm.{agentId}` (one per agent)

**Publishers:** Any agent initiating brainstorm

**Example Usage:**

```javascript
// Broadcast to all agents
await client.broadcastBrainstorm({
  sessionId: 'session-123',
  topic: 'API Design',
  question: 'REST or GraphQL?'
});
```

**Routing Pattern:**

```
Publisher → agent.brainstorm exchange
                ↓
    ┌───────────┼───────────┐
    ↓           ↓           ↓
brainstorm.  brainstorm.  brainstorm.
agent-1      agent-2      agent-3
    ↓           ↓           ↓
 Agent 1     Agent 2     Agent 3
```

---

#### agent.status

**Purpose:** Selective broadcasting of status updates

**Type:** `topic`

**Properties:**
- `durable: true` - Survives broker restarts

**Routing Keys:**
- `agent.status.connected` - Agent connected
- `agent.status.disconnected` - Agent disconnected
- `agent.status.task.started` - Task started
- `agent.status.task.completed` - Task completed
- `agent.status.task.failed` - Task failed
- `agent.status.result` - Result published
- `agent.status.shutdown` - Agent shutdown

**Binding Patterns:**
- `agent.status.#` - All status updates
- `agent.status.task.*` - All task-related updates
- `agent.status.task.completed` - Only completed tasks

**Publishers:** All agents

**Example Usage:**

```javascript
// Publish status
await client.publishStatus(
  { event: 'task_completed', taskId: 'task-123' },
  'agent.status.task.completed'
);

// Subscribe to pattern
await client.subscribeStatus('agent.status.task.*', 'agent.status', async (msg) => {
  console.log(`Task event: ${msg.status.event}`);
});
```

**Routing Pattern:**

```
Publisher → agent.status exchange
                ↓
        (topic routing)
                ↓
    ┌───────────┼───────────┐
    ↓           ↓           ↓
Pattern: #   Pattern:    Pattern:
            task.*   task.completed
    ↓           ↓           ↓
Monitor     Leader    Analytics
```

---

### Routing Keys

#### Status Routing Keys

| Routing Key | Description | Example Event |
|------------|-------------|---------------|
| `agent.status.connected` | Agent connected to system | New agent joins |
| `agent.status.disconnected` | Agent disconnected | Agent graceful shutdown |
| `agent.status.task.assigned` | Task assigned by leader | Leader assigns work |
| `agent.status.task.started` | Worker started processing task | Worker begins execution |
| `agent.status.task.completed` | Task completed successfully | Worker finishes task |
| `agent.status.task.failed` | Task failed with error | Worker encountered error |
| `agent.status.result` | Result published | Worker submits result |
| `agent.status.shutdown` | Agent shutting down | Graceful shutdown |

---

### Binding Patterns

#### Topic Pattern Matching

Topic exchanges use routing key patterns:

- `#` - Matches zero or more words
- `*` - Matches exactly one word

**Examples:**

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `agent.status.#` | All status messages | (none, matches all) |
| `agent.status.task.*` | `agent.status.task.started`<br>`agent.status.task.completed` | `agent.status.connected`<br>`agent.status.task.worker.started` |
| `agent.status.*.completed` | `agent.status.task.completed` | `agent.status.task.started`<br>`agent.status.worker.task.completed` |
| `#.failed` | `agent.status.task.failed`<br>`agent.status.connection.failed` | `agent.status.task.completed` |

---

## Hooks API

Hooks allow you to execute custom scripts at specific lifecycle points.

### Hook Configuration

Hooks are defined in `/home/user/plugin-ai-agent-rabbitmq/hooks/hooks.json`:

```typescript
interface HookConfig {
  description: string;
  enabled: boolean;
  command: string;
  interval?: number;  // For periodic hooks (milliseconds)
}

interface HooksConfig {
  hooks: {
    [hookName: string]: HookConfig;
  };
}
```

---

### Available Hooks

#### session-start

**Trigger:** When Claude Code session starts

**Purpose:** Initialize RabbitMQ connection and verify system health

**Configuration:**

```json
{
  "session-start": {
    "description": "Initialize RabbitMQ connection when Claude Code session starts",
    "enabled": false,
    "command": "node scripts/hooks/session-start.js"
  }
}
```

**Example Implementation:**

```javascript
// scripts/hooks/session-start.js
import { RabbitMQClient } from '../rabbitmq-client.js';

async function main() {
  const client = new RabbitMQClient();
  await client.connect();

  if (client.isHealthy()) {
    console.log('✅ RabbitMQ connection established');
    console.log(`   Agent ID: ${client.agentId}`);
  } else {
    console.error('❌ RabbitMQ connection failed');
    process.exit(1);
  }

  await client.close();
  process.exit(0);
}

main();
```

---

#### pre-task

**Trigger:** Before each task execution

**Purpose:** Validate task before execution

**Configuration:**

```json
{
  "pre-task": {
    "description": "Validate task before execution",
    "enabled": true,
    "command": "node scripts/hooks/pre-task.js"
  }
}
```

**Example Implementation:**

```javascript
// scripts/hooks/pre-task.js
const task = JSON.parse(process.env.TASK_DATA);

// Validate task
if (!task.title || !task.description) {
  console.error('❌ Invalid task: missing required fields');
  process.exit(1);
}

// Check prerequisites
if (task.requiresCollaboration && !process.env.BRAINSTORM_ENABLED) {
  console.warn('⚠️  Task requires collaboration but brainstorming is disabled');
}

console.log('✅ Task validation passed');
process.exit(0);
```

---

#### post-task

**Trigger:** After task completion

**Purpose:** Report task completion to team leader

**Configuration:**

```json
{
  "post-task": {
    "description": "Report task completion to team leader",
    "enabled": true,
    "command": "node scripts/hooks/post-task.js"
  }
}
```

**Example Implementation:**

```javascript
// scripts/hooks/post-task.js
const result = JSON.parse(process.env.TASK_RESULT);

// Send notification
console.log(`✅ Task completed: ${result.task}`);
console.log(`   Duration: ${result.duration}ms`);
console.log(`   Status: ${result.status}`);

// Optional: Send to external system
// await sendToSlack(result);
// await updateJira(result);

process.exit(0);
```

---

#### health-check

**Trigger:** Periodic (every 30 seconds by default)

**Purpose:** Periodic health check and heartbeat

**Configuration:**

```json
{
  "health-check": {
    "description": "Periodic health check and heartbeat",
    "enabled": true,
    "command": "node scripts/hooks/health-check.js",
    "interval": 30000
  }
}
```

**Example Implementation:**

```javascript
// scripts/hooks/health-check.js
import { RabbitMQClient } from '../rabbitmq-client.js';

async function healthCheck() {
  const client = new RabbitMQClient();

  try {
    await client.connect();

    const healthy = client.isHealthy();

    if (healthy) {
      console.log('✅ Health check passed');

      // Publish heartbeat
      await client.publishStatus(
        {
          health: 'healthy',
          timestamp: Date.now(),
          uptime: process.uptime()
        },
        'agent.status.heartbeat'
      );
    } else {
      console.error('❌ Health check failed');
      process.exit(1);
    }

    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Health check error:', error);
    process.exit(1);
  }
}

healthCheck();
```

---

#### queue-monitor

**Trigger:** Periodic (every 10 seconds by default)

**Purpose:** Monitor queue depth and alert on backlog

**Configuration:**

```json
{
  "queue-monitor": {
    "description": "Monitor queue depth and alert on backlog",
    "enabled": true,
    "command": "node scripts/hooks/queue-monitor.js",
    "interval": 10000
  }
}
```

**Example Implementation:**

```javascript
// scripts/hooks/queue-monitor.js
import fetch from 'node-fetch';

const RABBITMQ_API = 'http://localhost:15672/api';
const AUTH = Buffer.from('guest:guest').toString('base64');

async function getQueueDepth(queueName) {
  const response = await fetch(`${RABBITMQ_API}/queues/%2F/${queueName}`, {
    headers: { 'Authorization': `Basic ${AUTH}` }
  });

  const data = await response.json();
  return data.messages;
}

async function monitor() {
  try {
    const taskQueueDepth = await getQueueDepth('agent.tasks');

    console.log(`📊 Queue depth: ${taskQueueDepth}`);

    // Alert on backlog
    if (taskQueueDepth > 100) {
      console.warn(`⚠️  HIGH QUEUE DEPTH: ${taskQueueDepth} tasks pending`);
      console.warn('   Consider starting more workers');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Queue monitoring failed:', error);
    process.exit(1);
  }
}

monitor();
```

---

### Custom Hook Creation

Create your own hooks by following this pattern:

**1. Create hook script:**

```javascript
// scripts/hooks/my-custom-hook.js
async function customHook() {
  // Hook logic here
  console.log('Custom hook executed');

  // Access environment variables
  const agentId = process.env.AGENT_ID;
  const data = process.env.CUSTOM_DATA;

  // Perform custom actions

  // Exit with status
  process.exit(0); // Success
  // process.exit(1); // Failure
}

customHook();
```

**2. Register in hooks.json:**

```json
{
  "hooks": {
    "my-custom-hook": {
      "description": "My custom hook description",
      "enabled": true,
      "command": "node scripts/hooks/my-custom-hook.js"
    }
  }
}
```

**3. (Optional) For periodic hooks:**

```json
{
  "my-periodic-hook": {
    "description": "Runs every 60 seconds",
    "enabled": true,
    "command": "node scripts/hooks/my-periodic-hook.js",
    "interval": 60000
  }
}
```

---

### Hook Execution Order

For task-related hooks:

```
1. pre-task hook
   ↓
2. Task execution
   ↓
3. post-task hook
```

For periodic hooks:

```
Session Start
   ↓
Initial execution
   ↓
Wait (interval)
   ↓
Execute again
   ↓
Repeat...
```

---

### Hook Environment Variables

Hooks have access to these environment variables:

| Variable | Description | Available In |
|----------|-------------|--------------|
| `AGENT_ID` | Current agent ID | All hooks |
| `AGENT_TYPE` | Agent type (worker, leader, etc.) | All hooks |
| `RABBITMQ_URL` | RabbitMQ connection URL | All hooks |
| `TASK_DATA` | Task JSON (for pre-task) | pre-task |
| `TASK_RESULT` | Result JSON (for post-task) | post-task |

**Example Usage:**

```javascript
// Access in hook script
const agentId = process.env.AGENT_ID;
const taskData = JSON.parse(process.env.TASK_DATA || '{}');
```

---

## Plugin API (Claude Code)

Integration with Claude Code for multi-agent orchestration.

### Slash Commands

Slash commands provide user-facing commands for agent control.

---

#### /orchestrate

Start an agent with a specific role.

**Syntax:**

```bash
/orchestrate [agent-type]
```

**Agent Types:**
- `team-leader` - Coordinates and assigns tasks
- `worker` - Executes tasks from queue
- `collaborator` - Participates in brainstorming
- `coordinator` - Manages workflows
- `monitor` - System monitoring dashboard

**Examples:**

```bash
# Start as team leader
/orchestrate team-leader

# Start as worker
/orchestrate worker

# Start as collaborator
/orchestrate collaborator
```

**Implementation:**

Location: `/home/user/plugin-ai-agent-rabbitmq/commands/orchestrate.md`

The command expands to instructions for the agent to execute:

```javascript
import AgentOrchestrator from './scripts/orchestrator.js';

const agentType = '{{ agent-type }}';
const orchestrator = new AgentOrchestrator(agentType);

await orchestrator.initialize();

switch (agentType) {
  case 'team-leader':
    await orchestrator.startTeamLeader();
    break;
  case 'worker':
    await orchestrator.startWorker();
    break;
  case 'collaborator':
    await orchestrator.startCollaborator();
    break;
  // ... other types
}
```

---

#### /assign-task

Assign a task to the worker pool (team leader only).

**Syntax:**

```bash
/assign-task title="Task Title" description="Description" [priority=high|normal|low]
```

**Parameters:**
- `title` (required): Task title
- `description` (required): Task description
- `priority` (optional): Task priority (default: normal)
- `collaboration` (optional): Require collaboration (true/false)

**Examples:**

```bash
# Simple task
/assign-task title="Fix bug #123" description="Fix null pointer in payment" priority=high

# Collaborative task
/assign-task title="Design API" description="Design REST API" collaboration=true
```

**Implementation:**

```javascript
const taskId = await orchestrator.assignTask({
  title: '{{ title }}',
  description: '{{ description }}',
  priority: '{{ priority }}' || 'normal'
});

console.log(`Task assigned: ${taskId}`);
```

---

#### /brainstorm

Initiate a collaborative brainstorming session.

**Syntax:**

```bash
/brainstorm topic="Topic" question="Question" [agents="agent1,agent2"]
```

**Parameters:**
- `topic` (required): Brainstorm topic
- `question` (required): Question to answer
- `agents` (optional): Target specific agent types
- `rounds` (optional): Number of discussion rounds
- `timeout` (optional): Timeout in seconds

**Examples:**

```bash
# Basic brainstorm
/brainstorm topic="API Design" question="REST or GraphQL?"

# Targeted brainstorm
/brainstorm topic="Performance" question="How to optimize?" agents="performance,database"

# Multi-round
/brainstorm topic="Architecture" question="Microservices approach?" rounds=3
```

**Implementation:**

```javascript
const sessionId = await orchestrator.initiateBrainstorm({
  topic: '{{ topic }}',
  question: '{{ question }}',
  requiredAgents: '{{ agents }}'.split(',').filter(Boolean)
});

console.log(`Brainstorm session: ${sessionId}`);
```

---

#### /status

View system status and statistics.

**Syntax:**

```bash
/status [component]
```

**Components:**
- `agents` - List all connected agents
- `queues` - Queue depths and statistics
- `tasks` - Active and completed tasks
- (no component) - Overall system status

**Examples:**

```bash
# Overall status
/status

# Agent status
/status agents

# Queue status
/status queues
```

**Implementation:**

```javascript
const stats = orchestrator.getStats();

console.log('System Status:');
console.log(`  Active tasks: ${stats.activeTasks}`);
console.log(`  Completed: ${stats.tasksCompleted}`);
console.log(`  Failed: ${stats.tasksFailed}`);
console.log(`  Brainstorms: ${stats.brainstormsParticipated}`);
```

---

#### /join-team

Alternative command to /orchestrate for joining as worker.

**Syntax:**

```bash
/join-team [specialty]
```

**Parameters:**
- `specialty` (optional): Worker specialty

**Examples:**

```bash
# Join as generic worker
/join-team

# Join as specialist
/join-team backend
/join-team frontend
```

**Implementation:**

```javascript
const orchestrator = new AgentOrchestrator('worker');
orchestrator.agentName = '{{ specialty }}' || 'Worker';
await orchestrator.initialize();
await orchestrator.startWorker();
```

---

### Agent Invocation

Agents are defined in `/home/user/plugin-ai-agent-rabbitmq/agents/` directory.

#### Agent Definition Format

```markdown
---
description: Agent description
capabilities: ["capability1", "capability2"]
---

# Agent Name

Agent documentation and instructions...
```

**Example:**

```markdown
---
description: Executes tasks from the queue independently
capabilities: ["task-execution", "brainstorm-participation", "result-reporting"]
---

# Worker Agent

The Worker Agent consumes tasks from the queue and executes them...
```

---

#### Available Agents

| Agent | File | Description |
|-------|------|-------------|
| Team Leader | `agents/team-leader.md` | Coordinates tasks and aggregates results |
| Worker | `agents/worker-agent.md` | Executes tasks from queue |
| Collaborator | `agents/collaborator-agent.md` | Participates in brainstorming |
| Coordinator | `agents/coordinator-agent.md` | Manages complex workflows |
| Monitor | `agents/monitor-agent.md` | System monitoring and alerts |

---

### Skill Invocation

Skills provide specialized capabilities for agents.

#### Skill Definition Format

Skills are defined in `skills/*/SKILL.md`:

```markdown
# Skill Name

Skill description and instructions...

## Usage

How to use this skill...

## Examples

Code examples...
```

---

#### Available Skills

| Skill | Path | Description |
|-------|------|-------------|
| RabbitMQ Ops | `skills/rabbitmq-ops/` | RabbitMQ operations and management |
| Task Distribution | `skills/task-distribution/` | Efficient task distribution strategies |
| Collaboration | `skills/collaboration/` | Multi-agent collaboration patterns |
| Result Aggregation | `skills/result-aggregation/` | Aggregate and synthesize results |
| Health Monitoring | `skills/health-monitoring/` | System health monitoring |

---

### Configuration

Plugin configuration is defined in `/home/user/plugin-ai-agent-rabbitmq/.claude-plugin/plugin.json`:

```json
{
  "name": "ai-agent-orchestrator-rabbitmq",
  "version": "1.0.0",
  "description": "Multi-agent orchestration with RabbitMQ",
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
  ],
  "hooks": "hooks/hooks.json"
}
```

---

### Environment Configuration

Configure via environment variables or `.env` file:

```bash
# RabbitMQ connection
RABBITMQ_URL=amqp://localhost:5672

# Agent configuration
AGENT_ID=custom-agent-id
AGENT_NAME=My Custom Agent
AGENT_TYPE=worker

# Connection settings
HEARTBEAT_INTERVAL=30
AUTO_RECONNECT=true
PREFETCH_COUNT=1
```

**Example .env file:**

```ini
# .env
RABBITMQ_URL=amqp://localhost:5672
AGENT_TYPE=worker
AGENT_NAME=Backend Worker
HEARTBEAT_INTERVAL=30
AUTO_RECONNECT=true
PREFETCH_COUNT=1
```

---

## Complete Usage Example

Here's a complete example demonstrating all APIs together:

```javascript
import { RabbitMQClient } from './scripts/rabbitmq-client.js';
import AgentOrchestrator from './scripts/orchestrator.js';

// ============================================
// TEAM LEADER (Terminal 1)
// ============================================
async function startTeamLeader() {
  const leader = new AgentOrchestrator('team-leader');
  await leader.initialize();
  await leader.startTeamLeader();

  // Assign a task
  const taskId = await leader.assignTask({
    title: 'Code Review',
    description: 'Review authentication module',
    priority: 'high',
    context: {
      files: ['auth.js', 'middleware.js']
    }
  });

  console.log(`Task assigned: ${taskId}`);

  // Initiate brainstorm
  const sessionId = await leader.initiateBrainstorm({
    topic: 'Security Review',
    question: 'Are there any security vulnerabilities?',
    requiredAgents: ['security', 'backend']
  });

  console.log(`Brainstorm initiated: ${sessionId}`);
}

// ============================================
// WORKER (Terminal 2)
// ============================================
async function startWorker() {
  const worker = new AgentOrchestrator('worker');
  await worker.initialize();
  await worker.startWorker();

  // Worker automatically:
  // 1. Consumes tasks from queue
  // 2. Processes tasks
  // 3. Publishes results
  // 4. Listens for brainstorms

  console.log('Worker ready');
}

// ============================================
// COLLABORATOR (Terminal 3)
// ============================================
async function startCollaborator() {
  const collaborator = new AgentOrchestrator('collaborator');
  collaborator.agentName = 'Security Expert';
  await collaborator.initialize();
  await collaborator.startCollaborator();

  // Collaborator automatically:
  // 1. Listens for brainstorm requests
  // 2. Provides expert input
  // 3. Can also handle tasks

  console.log('Collaborator ready');
}

// ============================================
// MONITOR (Terminal 4)
// ============================================
async function startMonitor() {
  const client = new RabbitMQClient({ agentId: 'monitor' });
  await client.connect();

  // Subscribe to all status updates
  await client.subscribeStatus('agent.status.#', 'agent.status', async (msg) => {
    console.log(`[${new Date().toISOString()}] ${msg.status.event}: ${msg.status.agentId}`);
  });

  console.log('Monitor ready');
}

// ============================================
// CUSTOM CLIENT (Terminal 5)
// ============================================
async function customClient() {
  const client = new RabbitMQClient();
  await client.connect();

  // Setup queues
  await client.setupTaskQueue();
  await client.setupResultQueue();

  // Publish a custom task
  await client.publishTask({
    title: 'Custom Task',
    description: 'Process custom data',
    priority: 'normal',
    customField: 'custom value'
  });

  // Listen for results
  await client.consumeResults('agent.results', async (msg) => {
    console.log('Result received:', msg.result);
  });
}

// Start based on role
const role = process.argv[2] || 'worker';

switch (role) {
  case 'leader':
    startTeamLeader();
    break;
  case 'worker':
    startWorker();
    break;
  case 'collaborator':
    startCollaborator();
    break;
  case 'monitor':
    startMonitor();
    break;
  case 'custom':
    customClient();
    break;
}
```

---

## Error Handling

All APIs use Promise-based error handling:

```javascript
try {
  await client.connect();
  await client.publishTask({ title: 'Task' });
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    console.error('RabbitMQ not running');
  } else if (error.message.includes('channel closed')) {
    console.error('Channel closed, reconnecting...');
    await client.reconnect();
  } else {
    console.error('Unexpected error:', error);
  }
}
```

Common error scenarios:

- Connection refused: RabbitMQ not running
- Authentication failed: Invalid credentials
- Channel closed: Lost connection
- Queue not found: Queue not created
- Message timeout: No consumers available

---

## Best Practices

1. **Always close connections gracefully:**
   ```javascript
   process.on('SIGINT', async () => {
     await client.close();
     process.exit(0);
   });
   ```

2. **Use message acknowledgment properly:**
   ```javascript
   await client.consumeTasks('agent.tasks', async (msg, { ack, nack }) => {
     try {
       await processTask(msg.task);
       ack(); // Only after successful processing
     } catch (error) {
       nack(true); // Requeue for retry
     }
   });
   ```

3. **Handle reconnection:**
   ```javascript
   client.on('disconnected', () => {
     console.log('Disconnected, will auto-reconnect');
   });
   ```

4. **Validate messages:**
   ```javascript
   if (!msg.task || !msg.task.title) {
     console.error('Invalid task message');
     reject();
     return;
   }
   ```

5. **Use appropriate queue properties:**
   - Set TTL for time-sensitive messages
   - Set max length to prevent memory issues
   - Use durable queues for important messages

---

## Appendix: Type Reference

Complete TypeScript type definitions:

```typescript
// Client Configuration
interface ClientConfig {
  url?: string;
  heartbeat?: number;
  autoReconnect?: boolean;
  prefetchCount?: number;
}

// Message Control
interface MessageControl {
  ack: () => void;
  nack: (requeue?: boolean) => void;
  reject: () => void;
}

// Base Message
interface BaseMessage {
  id: string;
  type: string;
  from: string;
  timestamp: number;
}

// Task Message
interface TaskMessage extends BaseMessage {
  type: 'task';
  task: {
    title: string;
    description: string;
    priority: 'low' | 'normal' | 'high';
    assignedBy: string;
    assignedAt: number;
    requiresCollaboration?: boolean;
    collaborationQuestion?: string;
    requiredAgents?: string[];
    retryCount?: number;
    context?: object;
  };
}

// Brainstorm Message
interface BrainstormMessage extends BaseMessage {
  type: 'brainstorm';
  message: {
    sessionId: string;
    topic: string;
    question: string;
    initiatedBy: string;
    requiredAgents?: string[];
  };
}

// Result Message
interface ResultMessage extends BaseMessage {
  type: 'result';
  result: {
    taskId?: string;
    sessionId?: string;
    task?: string;
    status?: 'completed' | 'failed' | 'partial';
    output?: string;
    processedBy?: string;
    completedAt?: number;
    duration?: number;
    type?: 'brainstorm_response';
    agentType?: string;
    suggestion?: string;
    [key: string]: any;
  };
}

// Status Message
interface StatusMessage extends BaseMessage {
  type: 'status';
  status: {
    agentId: string;
    agentType: AgentType;
    event?: string;
    state?: string;
    taskId?: string;
    task?: string;
    error?: string;
    stats?: AgentStats;
    [key: string]: any;
  };
}

// Agent Types
type AgentType = 'worker' | 'team-leader' | 'collaborator' | 'coordinator' | 'monitor';

// Agent Statistics
interface AgentStats {
  tasksReceived: number;
  tasksCompleted: number;
  tasksFailed: number;
  brainstormsParticipated: number;
  resultsPublished: number;
  activeTasks: number;
  activeBrainstorms: number;
  totalResults: number;
}

// Task Definition
interface Task {
  title: string;
  description: string;
  priority?: 'low' | 'normal' | 'high';
  requiresCollaboration?: boolean;
  collaborationQuestion?: string;
  requiredAgents?: string[];
  retryCount?: number;
  context?: object;
}

// Brainstorm Session
interface BrainstormSession {
  taskId?: string;
  topic: string;
  question: string;
  requiredAgents?: string[];
}

// Hook Configuration
interface HookConfig {
  description: string;
  enabled: boolean;
  command: string;
  interval?: number;
}

// Hooks Configuration
interface HooksConfig {
  hooks: {
    [hookName: string]: HookConfig;
  };
}
```

---

**End of API Reference**

For examples and tutorials, see:
- README.md - Getting started guide
- examples/ - Example scenarios
- commands/ - Slash command documentation
- agents/ - Agent role documentation
