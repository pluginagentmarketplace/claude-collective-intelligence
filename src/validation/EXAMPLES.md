# Validation System Examples

Complete examples demonstrating all validation features in production scenarios.

## Table of Contents

1. [Basic Validation](#basic-validation)
2. [Express Integration](#express-integration)
3. [RabbitMQ Integration](#rabbitmq-integration)
4. [Security Examples](#security-examples)
5. [Error Handling](#error-handling)
6. [Advanced Patterns](#advanced-patterns)

---

## Basic Validation

### Simple Agent Validation

```javascript
import { Validator } from './validators/validator.js';

// Create validator instance
const validator = new Validator({
  sanitize: true,
  validateSchema: true,
  validatePayload: true
});

// Agent data
const agentData = {
  name: 'AIWorker-001',
  role: 'worker',
  capabilities: ['compute', 'analyze'],
  resources: {
    cpu: 20,
    memory: 30,
    network: 100
  },
  metadata: {
    description: 'Worker agent for data processing',
    team: 'DataTeam',
    version: '1.0.0'
  },
  config: {
    autoStart: true,
    maxConcurrentTasks: 5,
    taskTimeout: 60000
  }
};

// Validate
const result = await validator.validate(agentData, 'agent.create');

if (result.valid) {
  console.log('Agent is valid!');
  console.log('Validated data:', result.value);
  console.log('Metadata:', result.metadata);
} else {
  console.error('Validation errors:');
  result.error.details.forEach(detail => {
    console.error(`- ${detail.field}: ${detail.message}`);
  });
}
```

### Task Submission

```javascript
import { validate } from './validators/validator.js';

const taskData = {
  title: 'Analyze Customer Behavior',
  type: 'analyze',
  priority: 'high',
  description: 'Analyze customer purchase patterns for Q4 2024',
  input: {
    dataset: 'customer_transactions_q4',
    dateRange: ['2024-10-01', '2024-12-31']
  },
  config: {
    timeout: 300000,
    retryCount: 3,
    parallelizable: true
  },
  requirements: {
    resources: {
      cpu: { min: 20, preferred: 40, max: 80 },
      memory: { min: 2048, preferred: 4096, max: 8192 }
    },
    agents: {
      min: 1,
      max: 5,
      capabilities: ['analyze', 'compute']
    }
  },
  scheduling: {
    startAfter: new Date(Date.now() + 60000).toISOString(),
    deadline: new Date(Date.now() + 3600000).toISOString()
  },
  metadata: {
    submittedBy: 'user-123',
    project: 'Q4-Analysis',
    tags: ['analytics', 'customer-insights']
  }
};

const result = await validate(taskData, 'task.submit');
console.log('Task valid:', result.valid);
```

### Batch Validation

```javascript
import { Validator } from './validators/validator.js';

const validator = new Validator();

// Multiple items to validate
const items = [
  { type: 'agent.create', data: { name: 'Agent1', role: 'worker', ... } },
  { type: 'agent.create', data: { name: 'Agent2', role: 'leader', ... } },
  { type: 'agent.create', data: { name: 'Agent3', role: 'observer', ... } }
];

// Batch validate
const batchResult = await validator.validateBatch(items);

console.log(`Total: ${batchResult.total}`);
console.log(`Valid: ${batchResult.valid}`);
console.log(`Invalid: ${batchResult.invalid}`);

// Process results
batchResult.results.forEach((result, index) => {
  if (result.valid) {
    console.log(`Item ${index}: Valid`);
  } else {
    console.log(`Item ${index}: Invalid - ${result.error.message}`);
  }
});
```

---

## Express Integration

### Complete Express Application

```javascript
import express from 'express';
import { setupValidation, validateRequest } from './middleware/express-middleware.js';
import logger from '../logger/module-loggers.js';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup validation
setupValidation(app, {
  enableStats: true,
  enableErrorHandler: true
});

// Routes with validation

// Create agent
app.post('/api/agents',
  validateRequest('agent.create'),
  async (req, res) => {
    try {
      const agent = req.validated;
      logger.info('Creating agent', { name: agent.name });

      // Create agent in database
      const created = await db.agents.create(agent);

      res.status(201).json({
        success: true,
        agent: created
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Update agent
app.put('/api/agents/:id',
  validateRequest('agent.update'),
  async (req, res) => {
    const { id } = req.params;
    const updates = req.validated;

    const updated = await db.agents.update(id, updates);
    res.json({ success: true, agent: updated });
  }
);

// Get agent
app.get('/api/agents/:id',
  async (req, res) => {
    const agent = await db.agents.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(agent);
  }
);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Multiple Field Validation

```javascript
import { validateMultiple, validateBody, validateParams } from './middleware/express-middleware.js';

// Validate body and params separately
app.put('/api/tasks/:taskId/results',
  validateBody('task.result'),
  validateParams('task.params'),
  (req, res) => {
    const result = req.body;
    const { taskId } = req.params;

    // Save result
    db.tasks.saveResult(taskId, result);
    res.json({ success: true });
  }
);

// Validate multiple parts at once
app.post('/api/agents/:agentId/tasks',
  validateMultiple({
    body: 'task.submit',
    params: { agentId: 'string' }
  }),
  (req, res) => {
    const task = req.body;
    const { agentId } = req.params;

    assignTask(agentId, task);
    res.json({ success: true });
  }
);
```

### Custom Validation Middleware

```javascript
import { ValidationMiddlewareFactory } from './middleware/express-middleware.js';

const factory = new ValidationMiddlewareFactory({
  sanitize: true,
  validateSchema: true
});

// Create custom middleware with options
const validateAgent = factory.createMiddleware('agent.create', {
  throwOnError: false
});

// Use with suggestions
app.post('/api/agents', validateAgent, (req, res) => {
  if (req.validationError) {
    // Validation failed but passed through
    return res.status(400).json({
      error: req.validationError,
      suggestions: req.validationSuggestions
    });
  }

  const agent = req.validated;
  // ... create agent
});
```

---

## RabbitMQ Integration

### Message Consumer with Validation

```javascript
import amqp from 'amqplib';
import { createValidationMiddleware } from './middleware/validation-middleware.js';

async function setupConsumer() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Create validation middleware
  const { consumer, instance } = createValidationMiddleware({
    sanitize: true,
    rejectInvalid: true,
    deadLetterInvalid: true,
    maxRetries: 3
  });

  // Listen to validation events
  instance.on('validation:failed', (data) => {
    console.warn('Message validation failed', data);
  });

  instance.on('message:deadlettered', (data) => {
    console.error('Message sent to DLQ', data);
  });

  // Setup queue
  await channel.assertQueue('tasks.queue', { durable: true });
  await channel.assertExchange('dlx.validation', 'topic', { durable: true });

  // Consume with validation
  await channel.consume('tasks.queue', async (msg) => {
    if (!msg) return;

    // Message is automatically validated and sanitized
    const task = msg.validatedContent;

    try {
      console.log('Processing task:', task);

      // Process task
      await processTask(task);

      // Acknowledge
      channel.ack(msg);
    } catch (error) {
      console.error('Task processing failed:', error);
      channel.nack(msg, false); // Don't requeue
    }
  }, { noAck: false });

  // Get statistics
  setInterval(() => {
    const stats = instance.getStats();
    console.log('Validation stats:', stats);
  }, 60000);
}

setupConsumer().catch(console.error);
```

### Message Publishing with Validation

```javascript
import { createValidationMiddleware } from './middleware/validation-middleware.js';

const { publisher } = createValidationMiddleware({
  rejectInvalid: true
});

async function publishTask(taskData) {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Validate before publishing
  const validationResult = await publisher(
    'tasks',           // exchange
    'task.submit',    // routing key / schema type
    JSON.stringify(taskData),
    { persistent: true }
  );

  if (!validationResult.valid) {
    throw new Error(`Invalid task data: ${validationResult.error}`);
  }

  // Publish validated content
  channel.publish(
    'tasks',
    'submit',
    validationResult.content,
    validationResult.options
  );

  console.log('Task published successfully');
}

// Usage
publishTask({
  title: 'Data Processing',
  type: 'compute',
  priority: 'high',
  description: 'Process data for reporting'
}).catch(console.error);
```

### Complex Message Routing

```javascript
import { MessageValidator } from './validators/message-validator.js';

const messageValidator = new MessageValidator({
  sanitize: true,
  stripUnknown: true
});

async function processIncomingMessage(msg) {
  // Validate and identify message type
  const validation = await messageValidator.validate(msg);

  if (!validation.valid) {
    console.error('Invalid message:', validation.error);
    return;
  }

  const { type, value } = validation;

  // Route based on type
  switch (type) {
    case 'message.brainstorm':
      await handleBrainstorm(value);
      break;
    case 'message.status':
      await handleStatus(value);
      break;
    case 'task.submit':
      await handleTaskSubmission(value);
      break;
    case 'achievement.claim':
      await handleAchievementClaim(value);
      break;
    default:
      console.log('Unknown message type:', type);
  }
}
```

---

## Security Examples

### Malicious Input Detection

```javascript
import { Validator } from './validators/validator.js';
import { Sanitizer } from './sanitizers/sanitizer.js';

const validator = new Validator({
  sanitize: true,
  validateSecurity: true
});

// Attempt SQL Injection
const sqlInjection = {
  name: "Agent'; DROP TABLE users; --",
  role: 'worker'
};

const result = await validator.validate(sqlInjection, 'agent.create');
console.log('SQL Injection blocked:', !result.valid);

// Attempt XSS
const xssAttempt = {
  name: '<script>alert("XSS")</script>',
  role: 'worker'
};

const xssResult = await validator.validate(xssAttempt, 'agent.create');
console.log('XSS blocked:', !xssResult.valid);

// Attempt command injection
const commandInjection = {
  description: 'Task; rm -rf /',
  type: 'compute'
};

const cmdResult = await validator.validate(commandInjection, 'task.submit');
console.log('Command injection blocked:', !cmdResult.valid);

// Attempt path traversal
const pathTraversal = {
  name: '../../../../etc/passwd',
  role: 'worker'
};

const pathResult = await validator.validate(pathTraversal, 'agent.create');
console.log('Path traversal blocked:', !pathResult.valid);
```

### Custom Security Validation

```javascript
import { PayloadValidator } from './validators/payload-validator.js';

const payloadValidator = new PayloadValidator();

// Register custom security validator
payloadValidator.registerValidator('custom.sql-safe', (payload) => {
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP'];
  const found = sqlKeywords.filter(kw =>
    JSON.stringify(payload).includes(kw)
  );

  if (found.length > 0) {
    return {
      valid: false,
      error: `Detected SQL keywords: ${found.join(', ')}`
    };
  }

  return { valid: true };
});

// Use custom validator
const result = await payloadValidator.validate(data, {
  validators: ['custom.sql-safe']
});
```

### Sanitization Logging

```javascript
import { Sanitizer } from './sanitizers/sanitizer.js';

const sanitizer = new Sanitizer({
  detectPatterns: true,
  throwOnDetection: false
});

const malicious = {
  name: '<img src=x onerror="alert()">',
  description: 'Task; kill -9 $$'
};

const sanitized = sanitizer.sanitizeObject(malicious);

// Check what was detected
const detectionLog = sanitizer.getDetectionLog();
detectionLog.forEach(entry => {
  console.log(`Detected ${entry.type}:`, entry.sample);
});

console.log('Sanitized data:', sanitized);
```

---

## Error Handling

### User-Friendly Error Responses

```javascript
import { ErrorFormatter } from './utils/error-formatter.js';

const formatter = new ErrorFormatter({
  includeStackTrace: false,
  userFriendlyMessages: true
});

// In Express middleware
app.post('/api/agents', validateRequest('agent.create'), (req, res) => {
  if (req.validationError) {
    // Format error for user
    const userMessage = formatter.formatForUser(req.validationError);

    if (Array.isArray(userMessage.errors)) {
      // Multiple errors
      res.status(400).json({
        error: userMessage.summary,
        details: userMessage.errors
      });
    } else {
      // Single error
      res.status(400).json({
        error: userMessage
      });
    }
  }
});
```

### API Error Response Format

```javascript
import { ErrorFormatter } from './utils/error-formatter.js';

const formatter = new ErrorFormatter();

// Validation error
const joiError = {
  details: [
    { path: ['name'], type: 'string.min', context: { limit: 3 } },
    { path: ['role'], type: 'any.only', context: { valids: ['worker', 'leader'] } }
  ]
};

const apiError = formatter.formatForAPI(joiError, {
  code: 'VALIDATION_ERROR',
  requestId: 'req-123',
  path: '/api/agents'
});

console.log(JSON.stringify(apiError, null, 2));
// Output:
// {
//   "error": {
//     "code": "VALIDATION_ERROR",
//     "message": "Validation failed",
//     "requestId": "req-123",
//     "path": "/api/agents",
//     "timestamp": "2024-01-15T10:30:00Z",
//     "details": [
//       {
//         "field": "name",
//         "message": "name must be at least 3 characters",
//         "type": "string.min"
//       },
//       {
//         "field": "role",
//         "message": "role must be one of: worker, leader",
//         "type": "any.only"
//       }
//     ]
//   }
// }
```

### Error Logging and Monitoring

```javascript
import { ErrorFormatter } from './utils/error-formatter.js';
import logger from '../logger/module-loggers.js';

const formatter = new ErrorFormatter({
  includeStackTrace: true
});

try {
  const result = await validator.validate(data, 'agent.create');
  if (!result.valid) {
    throw result.error;
  }
} catch (error) {
  // Log with full context
  const logEntry = formatter.formatForLog(error, {
    context: {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    }
  });

  logger.error('Validation error', logEntry);

  // Send user-friendly response
  const userError = formatter.formatForUser(error);
  res.status(400).json({ error: userError });
}
```

---

## Advanced Patterns

### Custom Validator Factory

```javascript
import { Validator } from './validators/validator.js';
import { PRESETS } from './config.js';

class AgentValidator {
  constructor() {
    this.baseValidator = new Validator(PRESETS.security);
  }

  async validateCreation(agentData) {
    return this.baseValidator.validate(agentData, 'agent.create');
  }

  async validateUpdate(agentId, updates) {
    const result = await this.baseValidator.validate(updates, 'agent.update');
    if (result.valid) {
      // Additional business logic validation
      const existing = await db.agents.findById(agentId);
      if (updates.role && updates.role !== existing.role) {
        // Validate role change
        if (!canChangeRole(existing.role, updates.role)) {
          return {
            valid: false,
            error: { message: 'Invalid role transition' }
          };
        }
      }
    }
    return result;
  }

  async validateBatch(agents) {
    return this.baseValidator.validateBatch(
      agents.map(a => ({ type: 'agent.create', data: a }))
    );
  }
}

// Usage
const agentValidator = new AgentValidator();
const result = await agentValidator.validateCreation(agentData);
```

### Conditional Validation

```javascript
import { Validator } from './validators/validator.js';

const validator = new Validator();

async function validateTask(task) {
  // First pass: basic schema validation
  let result = await validator.validate(task, 'task.submit');
  if (!result.valid) return result;

  // Second pass: conditional validation based on task type
  if (task.type === 'compute') {
    if (!task.requirements?.resources?.cpu) {
      return {
        valid: false,
        error: {
          message: 'Compute tasks require CPU requirements'
        }
      };
    }
  }

  // Third pass: deadline validation based on priority
  if (task.priority === 'urgent') {
    const deadline = new Date(task.scheduling?.deadline);
    const now = new Date();
    const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

    if (hoursUntilDeadline > 24) {
      return {
        valid: false,
        error: {
          message: 'Urgent tasks must have deadline within 24 hours'
        }
      };
    }
  }

  return result;
}
```

### Validation with Database Lookups

```javascript
import { Validator } from './validators/validator.js';
import Joi from 'joi';

const validator = new Validator();

// Create custom schema with async validation
const taskWithAgentSchema = Joi.object({
  title: Joi.string().required(),
  assignedAgent: Joi.string().external(async (value) => {
    const agent = await db.agents.findById(value);
    if (!agent) {
      throw new Error('Agent not found');
    }
    if (!agent.capabilities.includes('compute')) {
      throw new Error('Agent does not have required capability');
    }
  })
});

async function validateTaskAssignment(task) {
  const { error, value } = taskWithAgentSchema.validate(task);

  if (error) {
    return {
      valid: false,
      error: {
        message: error.message
      }
    };
  }

  return {
    valid: true,
    value
  };
}
```

---

## Complete Integration Example

```javascript
import express from 'express';
import amqp from 'amqplib';
import { setupValidation, validateRequest } from './middleware/express-middleware.js';
import { createValidationMiddleware } from './middleware/validation-middleware.js';
import { Validator } from './validators/validator.js';
import { ErrorFormatter } from './utils/error-formatter.js';
import { getValidationConfig } from './config.js';

class ApplicationWithValidation {
  constructor() {
    this.config = getValidationConfig();
    this.validator = new Validator(this.config.validation);
    this.errorFormatter = new ErrorFormatter(this.config.error);
    this.app = express();
  }

  setupExpress() {
    this.app.use(express.json());
    setupValidation(this.app, this.config.express);
    this.setupRoutes();
  }

  setupRoutes() {
    // Create agent
    this.app.post('/api/agents',
      validateRequest('agent.create'),
      this.createAgent.bind(this)
    );

    // Submit task
    this.app.post('/api/tasks',
      validateRequest('task.submit'),
      this.submitTask.bind(this)
    );
  }

  async createAgent(req, res) {
    try {
      const agent = req.validated;
      const saved = await this.db.agents.create(agent);
      res.status(201).json({ success: true, agent: saved });
    } catch (error) {
      res.status(500).json(this.errorFormatter.formatForAPI(error));
    }
  }

  async submitTask(req, res) {
    try {
      const task = req.validated;
      const saved = await this.db.tasks.create(task);

      // Publish to RabbitMQ
      await this.publishTask(task);

      res.status(201).json({ success: true, task: saved });
    } catch (error) {
      res.status(500).json(this.errorFormatter.formatForAPI(error));
    }
  }

  async setupRabbitMQ() {
    this.connection = await amqp.connect('amqp://localhost');
    this.channel = await this.connection.createChannel();

    const { consumer } = createValidationMiddleware(this.config.rabbitmq);

    await this.channel.assertQueue('tasks.queue');
    await this.channel.consume('tasks.queue', this.handleTask.bind(this));
  }

  async handleTask(msg) {
    if (!msg) return;

    const task = msg.validatedContent;

    try {
      console.log('Processing task:', task.title);
      await this.processTask(task);
      this.channel.ack(msg);
    } catch (error) {
      console.error('Task failed:', error);
      this.channel.nack(msg, false);
    }
  }

  async publishTask(task) {
    await this.channel.assertExchange('tasks', 'topic');
    this.channel.publish(
      'tasks',
      'task.new',
      Buffer.from(JSON.stringify(task))
    );
  }

  async start() {
    this.setupExpress();
    await this.setupRabbitMQ();

    this.app.listen(3000, () => {
      console.log('Application started with validation system');
    });
  }
}

// Start
const app = new ApplicationWithValidation();
app.start().catch(console.error);
```

