# Winston Logging - Quick Reference Guide

## Import Logging
```javascript
import { log } from './src/logger/index.js';
import { modules } from './src/logger/index.js';
```

## Basic Logging

### Log Levels
```javascript
log.error('Error message', { errorCode: 'ERR001' });
log.warn('Warning message', { issue: 'deprecated_api' });
log.info('Info message', { event: 'user_login' });
log.http('HTTP request', { method: 'GET', path: '/api/data' });
log.debug('Debug message', { variable: value });
log.silly('Detailed message', { data: complexData });
```

### With Context
```javascript
import { runWithContext, createContext } from './src/logger/index.js';

const context = createContext({ userId: 'user-123', sessionId: 'sess-456' });
await runWithContext(context, () => {
  log.info('This log includes user and session context');
});
```

---

## Module-Specific Loggers

### Agent Logger
```javascript
import { modules } from './src/logger/index.js';

// Initialize
modules.agent.logInit('agent-001', { type: 'researcher' });

// Task execution
modules.agent.logTaskStart('agent-001', 'task-123', 'analysis');
modules.agent.logTaskComplete('agent-001', 'task-123', { success: true }, 2500);

// State changes
modules.agent.logStateChange('agent-001', 'idle', 'processing', 'task_received');

// Errors
modules.agent.logError('agent-001', error, { context });

// Metrics
modules.agent.logMetrics('agent-001', {
  tasksCompleted: 150,
  successRate: 0.98,
  avgResponseTime: 2000
});

// Health
modules.agent.logHealthCheck('agent-001', {
  healthy: true,
  checks: { connection: 'ok', memory: 'ok' }
});
```

### RabbitMQ Logger
```javascript
import { modules } from './src/logger/index.js';

// Connection
modules.mq.logConnection('connected', 'amqp://localhost:5672');
modules.mq.logConnection('disconnected', 'amqp://localhost:5672');

// Publishing
modules.mq.logPublish('task.exchange', 'task.route', message, {
  messageId: 'msg-123',
  persistent: true
});

// Consuming
modules.mq.logConsume('task.queue', message, 145);

// Acknowledgment
modules.mq.logAck(deliveryTag);
modules.mq.logNack(deliveryTag, true, 'retry_later');

// Metrics
modules.mq.logQueueMetrics('task.queue', {
  messageCount: 50,
  consumerCount: 5
});

// Errors
modules.mq.logConnectionError(error);
modules.mq.logRetry(2, 3, 1000);
```

### Voting Logger
```javascript
import { modules } from './src/logger/index.js';

// Session management
modules.voting.logSessionStart('session-1', 'approve_proposal', agents);
modules.voting.logSessionComplete('session-1', 'approved', {
  duration: 2000,
  participationRate: 100
});

// Voting
modules.voting.logVoteCast('session-1', 'agent-1', 'approved', 1.0);
modules.voting.logProgress('session-1', 3, 5);
modules.voting.logConsensus('session-1', 'approved', {
  totalVotes: 5,
  consensusPercentage: 100
});

// Issues
modules.voting.logTimeout('session-1', 2, 5);
modules.voting.logConflict('session-1', conflicts);
```

### Performance Logger
```javascript
import { modules } from './src/logger/index.js';

// Timer
modules.performance.startTimer('operation-1');
// ... do work
modules.performance.endTimer('operation-1', { type: 'database' });

// API timing
modules.performance.logApiResponseTime('/api/users', 'GET', 145, 200);

// Query timing
modules.performance.logQueryPerformance(query, 45, 1000);

// Cache
modules.performance.logCachePerformance('get', 'user:123', true, 2);

// Batch
modules.performance.logBatchPerformance('batch-1', 1000, 5000);

// System metrics
modules.performance.logSystemMetrics();
modules.performance.startMetricsInterval(60000);
modules.performance.stopMetricsInterval();
```

### Security Logger
```javascript
import { modules } from './src/logger/index.js';

// Authentication
modules.security.logAuthentication({
  username: 'john@example.com',
  method: 'password',
  success: true,
  ip: '192.168.1.1',
  mfaUsed: true
});

// Authorization
modules.security.logAuthorization({
  userId: 'user-123',
  resource: 'admin_panel',
  action: 'access',
  allowed: false,
  requiredRole: 'admin',
  userRole: 'user'
});

// Data access
modules.security.logDataAccess({
  userId: 'user-123',
  dataType: 'customer_records',
  recordCount: 1000,
  operation: 'export'
});

// Configuration changes
modules.security.logConfigurationChange({
  setting: 'max_users',
  oldValue: 100,
  newValue: 500
});

// Policy violations
modules.security.logPolicyViolation({
  policy: 'data_retention',
  violation: 'old_data_not_deleted',
  severity: 'high'
});

// Access control
modules.security.logAccessControlViolation({
  userId: 'user-456',
  resource: 'confidential_file',
  action: 'read'
});

// Suspicious activity
modules.security.logSuspiciousActivity({
  userId: 'user-789',
  activityType: 'brute_force',
  description: 'Multiple failed login attempts',
  riskScore: 0.9
});

// Rate limiting
modules.security.logRateLimit({
  endpoint: '/api/login',
  requestCount: 100,
  limit: 10
});

// Encryption
modules.security.logEncryption({
  operation: 'encrypt',
  dataType: 'user_data',
  size: 5000,
  algorithm: 'aes-256-gcm'
});

// Certificate events
modules.security.logCertificateEvent({
  certificate: 'example.com',
  eventType: 'renewal',
  expiresIn: 365
});

// Compliance audit
modules.security.logComplianceAudit({
  auditType: 'GDPR_CHECK',
  status: 'pass',
  findings: []
});

// Security report
const report = modules.security.generateSecurityReport('daily');
```

---

## Context Management

### Creating Context
```javascript
import { createContext, runWithContext, getContext } from './src/logger/index.js';

const context = createContext({
  userId: 'user-123',
  requestId: 'req-456',
  correlationId: 'corr-789'
});
```

### Running with Context
```javascript
import { runWithContext } from './src/logger/index.js';

await runWithContext(context, async () => {
  // All logs here automatically include context
  log.info('Operation started');

  // Sub-operations inherit context
  const result = await someOperation();

  log.info('Operation completed');
});
```

### Getting Current Context
```javascript
import { getContext } from './src/logger/index.js';

const currentContext = getContext();
console.log(currentContext.userId);
console.log(currentContext.requestId);
```

### Context Wrappers
```javascript
import { agentContext, rabbitMqContext, votingContext } from './src/logger/index.js';

// Agent context
await agentContext('agent-001', 'task-123', async (context) => {
  // Automatic agent context
  log.info('Agent task started');
});

// RabbitMQ context
await rabbitMqContext(message, async (msg, context) => {
  // Automatic message context
  log.info('Message processed');
});

// Voting context
await votingContext('session-1', agents, async () => {
  // Automatic voting context
  log.info('Vote cast');
});
```

---

## Performance Monitoring

### Simple Timer
```javascript
import { time, timeEnd } from './src/logger/index.js';

time('operation');
// ... do work
const duration = timeEnd('operation');
```

### Performance Context
```javascript
import { performanceContext } from './src/logger/index.js';

await performanceContext('heavy-operation', async () => {
  // Automatically logs duration, memory, CPU
  return await heavyComputation();
});
```

### Batch Operations
```javascript
import { batchContext } from './src/logger/index.js';

const items = [item1, item2, item3];
const results = await batchContext('process-batch', items, async (item) => {
  // Automatically tracks batch progress
  return await processItem(item);
});
```

---

## Error Handling

### Log Error with Context
```javascript
import { exception } from './src/logger/index.js';

try {
  await risky();
} catch (error) {
  exception(error, 'Operation failed', { context });
}
```

### Automatic Exception Handling
```javascript
// Uncaught exceptions automatically logged to exceptions.log
// Unhandled rejections automatically logged to rejections.log
```

---

## Audit Logging

### Audit Events
```javascript
import { audit } from './src/logger/index.js';

audit('USER_LOGIN', 'user-123', {
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  success: true
});

audit('DATA_EXPORT', 'user-456', {
  resource: 'reports',
  count: 100,
  format: 'csv'
});
```

---

## Express Integration

### Middleware
```javascript
import express from 'express';
import { expressMiddleware, errorHandler } from './src/logger/index.js';

const app = express();

// Add logging middleware
app.use(expressMiddleware());

// Your routes
app.get('/api/data', (req, res) => {
  // Request automatically logged with context
  res.json({ data: 'example' });
});

// Error handler
app.use(errorHandler);
```

### Request Context
```javascript
app.get('/api/data', (req, res) => {
  const { requestId, correlationId, userId } = req.context;

  // Use context in your code
  log.info('Request processing', {
    requestId,
    correlationId,
    userId
  });
});
```

---

## Configuration

### Initialize Logging
```javascript
import { initializeLogging } from './src/logger/index.js';

await initializeLogging({
  level: 'debug',
  enableMetrics: true,
  metricsInterval: 60000,
  globalContext: {
    appVersion: '1.0.0',
    environment: 'production'
  }
});
```

### Change Log Level
```javascript
import { setLogLevel } from './src/logger/index.js';

setLogLevel('debug');
```

### Check Log Level
```javascript
import { isDebugEnabled } from './src/logger/index.js';

if (isDebugEnabled()) {
  log.debug('Expensive operation', { data });
}
```

---

## Environment Variables

### Essential
```bash
LOG_LEVEL=info
LOG_TO_CONSOLE=true
LOG_TO_FILE=true
SERVICE_NAME=my-service
```

### Security
```bash
REDACT_PASSWORDS=true
REDACT_TOKENS=true
MASK_PII=true
ENABLE_AUDIT_LOG=true
```

### Performance
```bash
ENABLE_PERFORMANCE_LOGGING=true
PERFORMANCE_LOG_THRESHOLD_MS=1000
METRICS_INTERVAL_MS=60000
```

### External Services
```bash
ENABLE_ELASTICSEARCH_LOGGING=true
ELASTICSEARCH_URL=https://elasticsearch.example.com

ENABLE_DATADOG_LOGGING=true
DATADOG_API_KEY=your-api-key
```

---

## Common Patterns

### Request/Response Logging
```javascript
app.get('/api/users/:id', async (req, res) => {
  const { requestId } = req.context;
  const startTime = Date.now();

  try {
    const user = await getUser(req.params.id);
    const duration = Date.now() - startTime;

    log.info('User fetched', {
      requestId,
      userId: req.params.id,
      duration
    });

    res.json(user);
  } catch (error) {
    exception(error, 'Failed to fetch user', {
      requestId,
      userId: req.params.id
    });
    res.status(500).json({ error: error.message });
  }
});
```

### Database Operation Logging
```javascript
async function queryDatabase(sql, params) {
  const startTime = Date.now();

  try {
    const result = await db.query(sql, params);
    const duration = Date.now() - startTime;

    log.query(sql, duration, {
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    log.query(sql, Date.now() - startTime, {
      error: error.message
    });
    throw error;
  }
}
```

### Task Execution Logging
```javascript
async function executeTask(taskId, taskData) {
  return await agentContext(agentId, taskId, async (context) => {
    modules.agent.logTaskStart(agentId, taskId, taskData.type);

    const startTime = Date.now();
    try {
      const result = await processTask(taskData);
      const duration = Date.now() - startTime;

      modules.agent.logTaskComplete(agentId, taskId, result, duration);
      return result;
    } catch (error) {
      modules.agent.logError(agentId, error, { taskId });
      throw error;
    }
  });
}
```

### Security Event Logging
```javascript
async function loginUser(email, password) {
  try {
    const user = await authenticateUser(email, password);

    modules.security.logAuthentication({
      username: email,
      success: true,
      ip: request.ip
    });

    return createSession(user);
  } catch (error) {
    modules.security.logAuthentication({
      username: email,
      success: false,
      ip: request.ip,
      reason: error.message
    });

    throw error;
  }
}
```

---

## Shutdown

### Graceful Shutdown
```javascript
import { shutdown } from './src/logger/index.js';

process.on('SIGTERM', async () => {
  log.info('Shutting down gracefully');
  await shutdown();
  process.exit(0);
});
```

---

## Log Files

### File Locations
```
logs/
├── error-2024-01-15.log           # Error-level logs
├── combined-2024-01-15.log        # All logs
├── debug-2024-01-15.log           # Debug logs
├── http-2024-01-15.log            # HTTP requests
├── performance.log                # Performance metrics
├── exceptions.log                 # Uncaught exceptions
├── rejections.log                 # Unhandled rejections
└── .audit/
    ├── error-audit.json           # Rotation audit
    ├── combined-audit.json
    └── debug-audit.json
```

### Accessing Logs
```bash
# View latest logs
tail -f logs/combined-*.log

# Search by correlation ID
grep "correlationId\":\"abc-123" logs/combined-*.log

# Search by log level
grep "\"level\":\"error\"" logs/combined-*.log

# Count errors
grep "\"level\":\"error\"" logs/combined-*.log | wc -l

# View JSON logs with jq
jq 'select(.level=="error")' logs/combined-*.log
```

---

## Tips & Tricks

1. **Always include context** - Use `createContext` and `runWithContext`
2. **Use appropriate levels** - ERROR for failures, INFO for events, DEBUG for details
3. **Include IDs** - correlationId, requestId, userId, etc.
4. **Lazy evaluate** - Use `if (logger.isDebugEnabled)` for expensive operations
5. **Batch logs** - Group related log entries together
6. **Test logging** - Verify logs in development before production
7. **Monitor alerts** - Set up alerts for ERROR and WARN levels
8. **Rotate logs** - Ensure log rotation is configured
9. **Redact data** - Automatic redaction for passwords, tokens, keys
10. **Archive logs** - Old logs compressed to save space

---

## Troubleshooting

### Logs not appearing
1. Check `LOG_LEVEL` matches the level you're logging
2. Verify `LOG_TO_CONSOLE=true` for development
3. Check `LOG_TO_FILE=true` for file logging
4. Verify `LOG_DIR` directory exists and is writable

### High memory usage
1. Reduce `LOG_LEVEL` to `warn`
2. Enable `LOG_ARCHIVE=true`
3. Reduce `LOG_MAX_FILES` (retention)
4. Disable `ENABLE_PERFORMANCE_LOGGING`

### Missing context
1. Use `createContext` and `runWithContext`
2. Use context wrappers (`agentContext`, `rabbitMqContext`, etc.)
3. Call `initializeLogging` before making requests

### Performance issues
1. Set `LOG_LEVEL=info` or higher
2. Disable debug logging
3. Use external log service
4. Implement log sampling

---

## Resources

- Main Documentation: `LOGGING_STRATEGY.md`
- Best Practices: `LOGGING_BEST_PRACTICES.md`
- Configuration: `LOGGING_CONFIGURATION_GUIDE.md`
- Implementation: `LOGGING_IMPLEMENTATION_SUMMARY.md`

---

This quick reference covers the most common logging scenarios. For detailed information, refer to the complete documentation files.
