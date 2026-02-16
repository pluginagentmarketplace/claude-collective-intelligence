# Enterprise Logging Best Practices Guide

## Table of Contents
1. [General Principles](#general-principles)
2. [Log Level Guidelines](#log-level-guidelines)
3. [Structured Logging](#structured-logging)
4. [Performance Optimization](#performance-optimization)
5. [Security & Compliance](#security--compliance)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Troubleshooting](#troubleshooting)

---

## General Principles

### 1. Purpose-Driven Logging
Every log entry should answer one of these questions:
- **What happened?** - Describe the event
- **When did it happen?** - Include timestamps
- **Why did it happen?** - Include context and cause
- **Who was affected?** - Include user/agent context
- **How to fix it?** - Include actionable information

### 2. Log at the Right Level
```javascript
// GOOD: Clear intent and level
logger.warn('Database connection timeout', {
  timeout: 5000,
  retries: 3,
  nextRetryIn: 2000
});

// BAD: Wrong level, unclear information
logger.info('Something failed');
```

### 3. Avoid Log Noise
```javascript
// BAD: Too much logging, not useful
for (let i = 0; i < 1000; i++) {
  logger.debug(`Processing item ${i}`);
}

// GOOD: Summary and exceptions
const processed = [];
for (let i = 0; i < 1000; i++) {
  try {
    processed.push(await processItem(i));
  } catch (error) {
    logger.error(`Item ${i} failed`, { error: error.message });
  }
}
logger.info(`Batch complete`, { processed: processed.length });
```

---

## Log Level Guidelines

### ERROR Level
**When to use:** Serious problems that need immediate attention

```javascript
// Database errors
logger.error('Database connection failed', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  error: error.message,
  code: error.code,
  retry: true
});

// Service unavailability
logger.error('External service unavailable', {
  service: 'payment-gateway',
  statusCode: 503,
  retryAfter: 60
});

// Data corruption
logger.error('Data integrity check failed', {
  entity: 'user',
  entityId: userId,
  checksum: 'invalid',
  action: 'quarantine'
});
```

### WARN Level
**When to use:** Unexpected but recoverable situations

```javascript
// Retry scenarios
logger.warn('Request failed, retrying', {
  attempt: 2,
  maxAttempts: 3,
  delay: 1000,
  reason: 'timeout'
});

// Performance degradation
logger.warn('Slow operation detected', {
  operation: 'database_query',
  duration: 1500,
  threshold: 1000
});

// Resource constraints
logger.warn('Memory usage high', {
  heapUsed: process.memoryUsage().heapUsed,
  heapTotal: process.memoryUsage().heapTotal,
  percentage: 85
});

// Deprecated usage
logger.warn('Deprecated API used', {
  endpoint: '/api/v1/users',
  deprecatedIn: 'v2.0.0',
  removedIn: 'v3.0.0',
  migration: 'Use /api/v2/users instead'
});
```

### INFO Level
**When to use:** Important business events and state changes

```javascript
// Service lifecycle
logger.info('Agent initialized', {
  agentId: 'agent-001',
  type: 'research',
  capabilities: ['analysis', 'synthesis'],
  version: '1.0.0'
});

// Business transactions
logger.info('Task completed', {
  taskId: 'task-123',
  agentId: 'agent-001',
  duration: 2500,
  result: 'success',
  output_size: 1024
});

// Configuration changes
logger.info('Configuration updated', {
  setting: 'max_concurrent_tasks',
  oldValue: 5,
  newValue: 10,
  changedBy: 'admin-user'
});

// State transitions
logger.info('Workflow transitioned', {
  workflowId: 'wf-123',
  fromState: 'pending',
  toState: 'processing',
  duration: 500
});
```

### DEBUG Level
**When to use:** Detailed information for debugging

```javascript
// Method execution
logger.debug('Processing message', {
  messageId: 'msg-123',
  type: 'task',
  size: 2048,
  priority: 'high'
});

// Variable state
logger.debug('Vote received', {
  sessionId: 'voting-session-1',
  voterId: 'agent-2',
  vote: 'approved',
  weight: 1.5
});

// Decision points
logger.debug('Consensus threshold reached', {
  sessionId: 'voting-session-1',
  currentVotes: 7,
  requiredVotes: 6,
  unanimity: false
});

// Data flow
logger.debug('Transform applied', {
  transformer: 'markdown_to_html',
  inputSize: 5000,
  outputSize: 8000
});
```

### Logging Disabled in Production
```javascript
// GOOD: Log that would help in debugging
const isDebugEnabled = process.env.LOG_LEVEL === 'debug';
if (isDebugEnabled) {
  logger.debug('Expensive operation started', {
    data: heavyComputationForLogging()
  });
}

// Better: Use logger level check
if (logger.isDebugEnabled) {
  logger.debug('Operation details', { complex: data });
}
```

---

## Structured Logging

### 1. Consistent Structure
```javascript
// GOOD: Structured format
logger.info('Request processed', {
  requestId: 'req-123',
  method: 'POST',
  path: '/api/tasks',
  statusCode: 201,
  duration: 145,
  userId: 'user-456'
});

// BAD: Unstructured format
logger.info('POST /api/tasks returned 201 in 145ms');
```

### 2. Context Information
```javascript
import { getContext, runWithContext, createContext } from './src/logger/index.js';

// Automatic context inclusion
const context = createContext({
  userId: 'user-123',
  sessionId: 'session-456',
  correlationId: 'corr-789'
});

await runWithContext(context, async () => {
  // All logs within this context automatically include:
  // - userId
  // - sessionId
  // - correlationId
  logger.info('Operation started');

  // ... do work

  logger.info('Operation completed'); // Context auto-included
});
```

### 3. Metadata Organization
```javascript
// GOOD: Well-organized metadata
logger.info('Agent task completed', {
  // Core identifiers
  agentId: 'agent-001',
  taskId: 'task-123',

  // Business metrics
  tasksCompleted: 150,
  successRate: 0.98,

  // Performance metrics
  duration: 2500,
  cpuUsage: 45,
  memoryUsage: 128,

  // Additional context
  result: 'success',
  outputSize: 2048
});

// BAD: Flat, unclear structure
logger.info('Task completed', {
  a: 1,
  b: 2,
  c: 3,
  x: 'value',
  y: 'another'
});
```

---

## Performance Optimization

### 1. Lazy Evaluation
```javascript
// BAD: Expensive operation always executed
logger.debug('Processing data', {
  parsedJson: JSON.parse(largeString)
});

// GOOD: Conditional expensive operation
if (logger.isDebugEnabled) {
  logger.debug('Processing data', {
    parsedJson: JSON.parse(largeString)
  });
}

// BEST: Lazy evaluation function
logger.debug('Processing data', {
  parsedJson: () => JSON.parse(largeString)
});
```

### 2. Performance Monitoring
```javascript
import { performance } from './src/logger/index.js';

// Timer-based monitoring
performance.startTimer('api-call');
const result = await fetch('/api/endpoint');
const duration = performance.endTimer('api-call', {
  endpoint: '/api/endpoint',
  statusCode: result.status
});

// Context-based monitoring
import { performanceContext } from './src/logger/index.js';

await performanceContext('heavy-operation', async () => {
  // Automatically logged with duration, memory, CPU
  return await heavyComputation();
});
```

### 3. Batch Operations
```javascript
import { batchContext } from './src/logger/index.js';

const items = [/* ... */];
const results = await batchContext('process-batch', items, async (item) => {
  // Automatically logs batch start and completion
  // Includes duration, success rate, errors
  return await processItem(item);
});
```

---

## Security & Compliance

### 1. Automatic Redaction
```javascript
// These are automatically redacted:
logger.info('User login', {
  username: 'john@example.com',
  password: 'secret123',           // [REDACTED]
  apiKey: 'sk-1234567890',         // [REDACTED]
  token: 'eyJhbGc...',             // [REDACTED]
  authorization: 'Bearer ...',      // [REDACTED]
  creditCard: '4111-1111-1111-1111' // [REDACTED]
});
```

### 2. PII Masking
```javascript
// These are automatically masked:
logger.info('User registered', {
  email: 'user@example.com',        // us***@example.com
  phone: '555-123-4567',            // 555-***-4567
  ssn: '123-45-6789',               // ***-**-6789
  ipAddress: '192.168.1.100'        // 192.168.1.***
});
```

### 3. Audit Logging
```javascript
import { audit } from './src/logger/index.js';

// Log security-relevant events
audit('USER_LOGIN', userId, {
  ip: request.ip,
  userAgent: request.headers['user-agent'],
  success: true,
  method: 'password'
});

audit('ROLE_CHANGE', userId, {
  oldRole: 'user',
  newRole: 'admin',
  changedBy: adminId,
  reason: 'promotion'
});

audit('DATA_EXPORT', userId, {
  resource: 'user_data',
  count: 1000,
  format: 'csv',
  ip: request.ip
});
```

### 4. Compliance Requirements
```javascript
// Ensure audit logs are retained
// Configure in .env:
AUDIT_LOG_RETENTION_DAYS=90

// Ensure sensitive data is protected
REDACT_PASSWORDS=true
REDACT_TOKENS=true
MASK_PII=true

// Enable security event logging
LOG_AUTHENTICATION_EVENTS=true
LOG_AUTHORIZATION_EVENTS=true
LOG_SECURITY_EVENTS=true
```

---

## Monitoring & Alerting

### 1. Error Detection
```javascript
// Monitor errors by setting up alerts
// In your monitoring tool, create alerts for:
{
  "condition": "level == 'error'",
  "severity": "critical",
  "action": "notify_on_call"
}

// Log errors with actionable context
logger.error('Payment processing failed', {
  paymentId: 'pay-123',
  amount: 99.99,
  currency: 'USD',
  reason: 'insufficient_funds',
  action: 'retry_later', // What should be done
  retryAfter: 3600
});
```

### 2. Performance Monitoring
```javascript
// Alert on slow operations
{
  "condition": "duration > 5000 AND operation == 'database_query'",
  "severity": "warning",
  "action": "log_to_performance_team"
}

// Log performance issues with context
logger.warn('Slow database query', {
  operation: 'fetch_user_data',
  duration: 5500,
  threshold: 1000,
  query: 'SELECT * FROM users WHERE...',
  rowCount: 50000,
  recommendation: 'Add index on status column'
});
```

### 3. Resource Monitoring
```javascript
// Start system metrics collection
import { startMetrics } from './src/logger/index.js';

startMetrics(60000); // Log every 60 seconds

// Configure alerts
{
  "condition": "memory.heapUsed > 500MB",
  "severity": "warning",
  "action": "trigger_gc"
}
```

### 4. Log Volume Monitoring
```javascript
// Monitor log volume to detect issues
{
  "condition": "log_count > 10000 per_minute",
  "severity": "warning",
  "action": "notify_engineering"
}

// Implement sampling for high-volume operations
const shouldLog = Math.random() < 0.1; // Log 10% of entries
if (shouldLog) {
  logger.debug('High-frequency operation', { data });
}
```

---

## Troubleshooting

### Common Issues

#### 1. High Memory Usage
```javascript
// Problem: Logs accumulating in memory

// Solution 1: Enable log rotation
// In .env:
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
LOG_ARCHIVE=true

// Solution 2: Reduce log level
LOG_LEVEL=info  // Instead of debug

// Solution 3: Implement sampling
const SAMPLE_RATE = 0.1;
if (Math.random() < SAMPLE_RATE) {
  logger.debug('Sampled log entry', { data });
}
```

#### 2. Slow Logging
```javascript
// Problem: Logging is blocking operations

// Solution 1: Ensure async logging
// Winston is async by default

// Solution 2: Buffer logs
// Already implemented in winston-daily-rotate-file

// Solution 3: Use external logging service
// Configure in .env:
ENABLE_DATADOG_LOGGING=true
DATADOG_API_KEY=your-key
```

#### 3. Missing Context
```javascript
// Problem: Context not propagating through async code

// Solution: Use context management
import { runWithContext, createContext } from './src/logger/index.js';

const context = createContext({ userId: 'user-123' });
await runWithContext(context, async () => {
  // All logs here have context
  logger.info('Operation started');
});

// Or use context wrappers
import { agentContext } from './src/logger/index.js';

await agentContext('agent-001', 'task-123', async (context) => {
  // Automatic context for agent operations
});
```

#### 4. Disk Space Issues
```javascript
// Problem: Logs consuming too much disk space

// Solution 1: Shorter retention
LOG_MAX_FILES=7d  // Instead of 14d

// Solution 2: Compression
LOG_ARCHIVE=true

// Solution 3: External storage
ENABLE_ELASTICSEARCH_LOGGING=true

// Solution 4: Log level reduction
LOG_LEVEL=warn  // Only warnings and errors
```

---

## Checklist for Production Deployment

### Before Going Live
- [ ] Log level set to INFO or higher
- [ ] File logging enabled with rotation
- [ ] Exception handling configured
- [ ] Sensitive data redaction enabled
- [ ] PII masking enabled
- [ ] Audit logging enabled
- [ ] Error alerts configured
- [ ] Performance thresholds set
- [ ] Disk space monitoring enabled
- [ ] Log retention policies configured
- [ ] External logging service configured (if applicable)
- [ ] Backup strategy for logs in place
- [ ] Access controls for logs implemented

### Monitoring Setup
- [ ] Error rate tracking
- [ ] Performance metrics dashboard
- [ ] Log volume alerting
- [ ] Resource usage monitoring
- [ ] Security event alerting
- [ ] Business metric tracking

### Documentation
- [ ] Team trained on logging standards
- [ ] Runbook for common issues created
- [ ] Log query examples documented
- [ ] Alert procedures documented
- [ ] Escalation paths defined

---

## Example: Complete Logging Setup

```javascript
// app.js
import { initializeLogging, expressMiddleware, errorHandler } from './src/logger/index.js';
import express from 'express';

const app = express();

// Initialize logging
await initializeLogging({
  level: process.env.LOG_LEVEL || 'info',
  enableMetrics: true,
  metricsInterval: 60000,
  globalContext: {
    appVersion: process.env.APP_VERSION,
    environment: process.env.NODE_ENV,
    region: process.env.AWS_REGION
  }
});

// Add logging middleware
app.use(expressMiddleware());

// Your routes here
app.get('/api/tasks', async (req, res, next) => {
  try {
    const tasks = await getTasks();
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('Shutting down gracefully');
  await log.close();
  process.exit(0);
});

app.listen(3000);
```

---

## Conclusion

Following these best practices ensures:
- **Reliability**: Clear, actionable error information
- **Security**: Sensitive data protection and audit trails
- **Performance**: Minimal logging overhead
- **Compliance**: Audit trails and retention policies
- **Maintainability**: Consistent, structured logging
- **Debuggability**: Rich context for troubleshooting

Remember: **Good logging is invisible but invaluable during troubleshooting.**
