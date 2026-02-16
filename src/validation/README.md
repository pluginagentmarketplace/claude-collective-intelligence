# Input Validation System

Production-ready input validation system using Joi with comprehensive security features, error handling, and Express/RabbitMQ integration.

## Overview

The validation system provides:

- **Joi-based schema validation** for structured data
- **Security sanitization** (XSS, SQL Injection, Command Injection, Path Traversal)
- **Payload validation** with custom business rules
- **Message validation** with type detection
- **Express middleware** for HTTP requests
- **RabbitMQ middleware** for message queue validation
- **User-friendly error messages** with suggestions
- **Comprehensive metrics and logging**

## Quick Start

### Basic Usage

```javascript
import { Validator } from './validators/validator.js';

const validator = new Validator();
const result = await validator.validate(data, 'agent.create');

if (result.valid) {
  console.log('Valid data:', result.value);
} else {
  console.error('Validation failed:', result.error);
}
```

### With Express

```javascript
import express from 'express';
import { setupValidation, validateRequest } from './middleware/express-middleware.js';

const app = express();
setupValidation(app);

app.post('/agents', validateRequest('agent.create'), (req, res) => {
  const agent = req.validated; // Validated data
  // ... handle agent creation
});
```

### With RabbitMQ

```javascript
import { createValidationMiddleware } from './middleware/validation-middleware.js';

const { consumer, publisher } = createValidationMiddleware({
  sanitize: true,
  rejectInvalid: true,
  deadLetterInvalid: true
});

channel.consume('task.queue', consumer);
```

## Directory Structure

```
src/validation/
├── schemas/                 # Joi validation schemas
│   ├── agent-schemas.js    # Agent-related validations
│   ├── task-schemas.js     # Task-related validations
│   ├── message-schemas.js  # Message type validations
│   ├── voting-schemas.js   # Voting system schemas
│   ├── achievement-schemas.js
│   └── index.js            # Central schema registry
│
├── validators/             # Validation logic
│   ├── validator.js        # Unified validator (NEW)
│   ├── message-validator.js # Message type detection
│   └── payload-validator.js # Custom business rules
│
├── sanitizers/             # Input sanitization
│   └── sanitizer.js        # XSS, SQL Injection, etc.
│
├── middleware/             # Integration middleware
│   ├── validation-middleware.js  # RabbitMQ middleware
│   └── express-middleware.js     # Express middleware (NEW)
│
├── utils/                  # Helper utilities
│   ├── validation-helpers.js     # Test helpers, mock data
│   └── error-formatter.js        # Error formatting (NEW)
│
├── config.js              # Configuration management (NEW)
├── README.md              # This file
└── EXAMPLES.md            # Usage examples
```

## Validation Types

### 1. Agent Validation

```javascript
// Create/register an agent
const agentData = {
  name: 'WorkerAgent-001',
  role: 'worker',
  capabilities: ['compute', 'analyze'],
  resources: { cpu: 20, memory: 20 }
};

await validator.validate(agentData, 'agent.create');
```

**Available schemas:**
- `agent.create` - Agent creation
- `agent.update` - Agent updates
- `agent.status` - Status messages
- `agent.auth` - Authentication
- `agent.communication` - Inter-agent messages

### 2. Task Validation

```javascript
// Submit a task
const taskData = {
  title: 'Analyze Data',
  type: 'analyze',
  description: 'Analyze the provided dataset',
  priority: 'high',
  requirements: {
    resources: { cpu: { min: 10, preferred: 20, max: 50 } }
  }
};

await validator.validate(taskData, 'task.submit');
```

**Available schemas:**
- `task.submit` - Task submission
- `task.update` - Task updates
- `task.result` - Task results
- `task.assign` - Task assignments
- `task.cancel` - Task cancellation

### 3. Message Validation

```javascript
// Brainstorm message
const message = {
  type: 'brainstorm',
  from: 'agent-123',
  payload: {
    sessionId: 'uuid',
    action: 'initiate',
    initiation: {
      topic: 'System Design',
      question: 'How should we design the cache layer?'
    }
  }
};

await validator.validateMessage(message);
```

**Message types:**
- `brainstorm` - Brainstorming sessions
- `status` - Status updates
- `result` - Task results
- `command` - Agent commands
- `heartbeat` - Health checks
- `notification` - Notifications

## Configuration

### Environment-based Configuration

```javascript
import { getValidationConfig } from './config.js';

// Automatically loads config for current environment
const config = getValidationConfig(); // Uses NODE_ENV

// Or specify environment
const prodConfig = getValidationConfig('production');
const devConfig = getValidationConfig('development');
```

### Custom Configuration

```javascript
import { ConfigBuilder, PRESETS } from './config.js';

// Using presets
const strictConfig = PRESETS.strict;
const securityConfig = PRESETS.security;
const performanceConfig = PRESETS.performance;

// Custom builder
const customConfig = new ConfigBuilder()
  .setValidation({ validateSchema: true, sanitize: true })
  .setSecurity({ blockOnDetection: true })
  .setErrorHandling({ userFriendlyMessages: true })
  .build();
```

### Environment Variables

```bash
# Validation settings
VALIDATION_SANITIZE=true
VALIDATION_STRICT=false
VALIDATION_SECURITY=true
VALIDATION_MAX_SIZE=10485760  # 10MB
```

## Error Handling

### User-Friendly Errors

The system automatically converts validation errors to user-friendly messages:

```javascript
// Input
{ name: 'x' } // Too short

// Error response
{
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: [
      {
        field: 'name',
        message: 'name must be at least 3 characters',
        type: 'string.min'
      }
    ]
  }
}
```

### Error Formatting

```javascript
import { ErrorFormatter } from './utils/error-formatter.js';

const formatter = new ErrorFormatter();

// Format for API response
const apiError = formatter.formatForAPI(joiError, { code: 'VALIDATION_ERROR' });

// Format for logging
const logEntry = formatter.formatForLog(joiError, { context: { path: '/agents' } });

// Format for user display
const userMessage = formatter.formatForUser(joiError);
```

## Security Features

### Automatic Sanitization

The system prevents:

- **XSS Attacks**: HTML encoding and script removal
- **SQL Injection**: Pattern detection and removal
- **Command Injection**: Shell command detection
- **Path Traversal**: Directory traversal prevention
- **NoSQL Injection**: NoSQL operator detection

```javascript
// Malicious input
const malicious = {
  name: "<script>alert('XSS')</script>",
  query: "'; DROP TABLE users; --"
};

// Automatically sanitized
const sanitized = await validator.sanitizeData(malicious);
// Returns safe version of data
```

### Security Configuration

```javascript
const config = {
  security: {
    blockOnDetection: true,        // Block suspicious input
    enableSQLInjectionCheck: true,
    enableXSSCheck: true,
    enableCommandInjectionCheck: true,
    enablePathTraversalCheck: true,
    logSecurityEvents: true
  }
};
```

## Express Integration

### Basic Setup

```javascript
import express from 'express';
import { setupValidation, validateRequest } from './middleware/express-middleware.js';

const app = express();
app.use(express.json());

// Setup validation middleware
setupValidation(app, { enableStats: true });

// Validate request body
app.post('/agents', validateRequest('agent.create'), (req, res) => {
  const agent = req.validated;
  res.json({ success: true, agent });
});

// Validate params
app.put('/agents/:id', validateRequest('agent.update'), (req, res) => {
  res.json({ success: true });
});
```

### Advanced Usage

```javascript
import {
  validateBody,
  validateParams,
  validateMultiple
} from './middleware/express-middleware.js';

// Validate multiple parts
app.post('/tasks/:taskId/result',
  validateMultiple({
    body: 'task.result',
    params: 'task.params'
  }),
  (req, res) => {
    // req.body and req.params are validated
  }
);

// Validate with custom options
app.post('/votes',
  validateBody('voting.submit', {
    storeAs: 'validatedVote'
  }),
  (req, res) => {
    const vote = req.validatedVote;
  }
);
```

## RabbitMQ Integration

### Message Consumer

```javascript
import { createValidationMiddleware } from './middleware/validation-middleware.js';
import amqp from 'amqplib';

const connection = await amqp.connect('amqp://localhost');
const channel = await connection.createChannel();

const { consumer } = createValidationMiddleware({
  sanitize: true,
  rejectInvalid: true,
  deadLetterInvalid: true,
  maxRetries: 3
});

await channel.assertQueue('task.queue');
await channel.consume('task.queue', (msg) => {
  // Message is automatically validated
  const validated = msg.validatedContent;
  console.log('Valid task:', validated);
  channel.ack(msg);
}, { noAck: false });
```

### Message Publisher

```javascript
const { publisher } = createValidationMiddleware({
  rejectInvalid: true
});

// Validate before publishing
const result = await publisher(
  'tasks',
  'task.submit',
  JSON.stringify(taskData),
  { persistent: true }
);

if (result.valid) {
  channel.publish(result.options.exchange, result.options.routingKey, result.content);
}
```

## Testing

### With Mock Data

```javascript
import { MockDataGenerators } from './utils/validation-helpers.js';

const validAgent = MockDataGenerators.generateAgent({
  name: 'TestAgent',
  role: 'worker'
});

const validTask = MockDataGenerators.generateTask({
  title: 'Test Task',
  priority: 'high'
});
```

### Testing Security

```javascript
import { ValidationTestHelper, MaliciousInputs } from './utils/validation-helpers.js';

const schema = agentCreationSchema;
const testData = MockDataGenerators.generateAgent();

// Test with malicious inputs
const results = await ValidationTestHelper.testSecurityValidation(
  schema,
  testData,
  'name' // field to test
);

results.forEach(r => {
  console.log(`${r.type}: ${r.blocked ? 'Blocked' : 'Allowed'}`);
});
```

### Performance Testing

```javascript
const benchmark = await ValidationTestHelper.benchmarkValidation(
  schema,
  validData,
  10000 // iterations
);

console.log(`Average validation time: ${benchmark.averageTime}ms`);
console.log(`Ops per second: ${benchmark.opsPerSecond}`);
```

## Metrics and Monitoring

### Get Validation Metrics

```javascript
const validator = new Validator();
await validator.validate(data, 'agent.create');

const metrics = validator.getMetrics();
console.log(metrics);
// {
//   total: 100,
//   passed: 98,
//   failed: 2,
//   cached: 50,
//   successRate: "98.00%",
//   avgTime: "2.34ms"
// }
```

### Middleware Statistics

```javascript
const { instance } = createValidationMiddleware();

setInterval(() => {
  const stats = instance.getStats();
  console.log(`Valid: ${stats.valid}/${stats.processed}`);
}, 60000);
```

## Best Practices

1. **Always sanitize before validating**
   ```javascript
   const validator = new Validator({ sanitize: true });
   ```

2. **Use schema types consistently**
   ```javascript
   // Good: Use consistent types
   await validator.validate(data, 'agent.create');

   // Bad: Inconsistent naming
   await validator.validate(data, 'create-agent');
   ```

3. **Enable security checks in production**
   ```javascript
   const config = PRESETS.security; // Use security preset
   ```

4. **Validate at boundaries**
   - Express routes
   - RabbitMQ consumers
   - External API calls

5. **Log validation failures**
   ```javascript
   if (!result.valid) {
     logger.warn('Validation failed', {
       type,
       errors: result.error,
       data: sanitizeForLog(data)
     });
   }
   ```

6. **Cache schemas in production**
   ```javascript
   validation: {
     cacheSchemas: true,
     cacheSize: 100
   }
   ```

7. **Provide user-friendly error messages**
   ```javascript
   const formatter = new ErrorFormatter();
   const userMessage = formatter.formatForUser(error);
   ```

## Troubleshooting

### Validation always fails

Check that you're using the correct type:
```javascript
// List all valid types
import { getSchemaTypes } from './schemas/index.js';
const types = getSchemaTypes();
console.log(types);
```

### Performance issues

Use performance preset:
```javascript
import { PRESETS } from './config.js';
const config = PRESETS.performance;
```

### Security warnings

Ensure security validation is enabled:
```javascript
const config = PRESETS.security;
// Or
const validator = new Validator({
  validateSecurity: true
});
```

## Contributing

To add new validation schemas:

1. Create schema in appropriate file (e.g., `schemas/custom-schemas.js`)
2. Register in `schemas/index.js` SCHEMA_REGISTRY
3. Add test cases in test suite
4. Document in README

## License

MIT
