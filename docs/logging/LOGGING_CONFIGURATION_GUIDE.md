# Enterprise Logging Configuration Guide

## Table of Contents
1. [Quick Start](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Log Levels](#log-levels)
4. [Transport Configuration](#transport-configuration)
5. [Module-Specific Configuration](#module-specific-configuration)
6. [Security Configuration](#security-configuration)
7. [Performance Tuning](#performance-tuning)
8. [Integration Guides](#integration-guides)

---

## Quick Start

### Development Environment
```bash
# .env
NODE_ENV=development
LOG_LEVEL=debug
LOG_TO_CONSOLE=true
LOG_TO_FILE=true
ENABLE_PERFORMANCE_LOGGING=true
METRICS_INTERVAL_MS=60000
```

### Production Environment
```bash
# .env
NODE_ENV=production
LOG_LEVEL=info
LOG_TO_CONSOLE=false
LOG_TO_FILE=true
ENABLE_PERFORMANCE_LOGGING=true
METRICS_INTERVAL_MS=60000

# Security
REDACT_PASSWORDS=true
REDACT_TOKENS=true
MASK_PII=true

# Audit
ENABLE_AUDIT_LOG=true
AUDIT_LOG_RETENTION_DAYS=90
```

### High-Performance Environment
```bash
# .env
NODE_ENV=production
LOG_LEVEL=warn
LOG_TO_CONSOLE=false
LOG_TO_FILE=true
LOG_MAX_SIZE=50m
LOG_MAX_FILES=7d

# External logging
ENABLE_ELASTICSEARCH_LOGGING=true
ELASTICSEARCH_URL=https://elasticsearch.example.com
```

---

## Environment Variables

### Core Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, http, verbose, debug, silly) |
| `LOG_TO_CONSOLE` | `true` (dev) / `false` (prod) | Enable console output |
| `LOG_TO_FILE` | `true` | Enable file logging |
| `SERVICE_NAME` | `agent-orchestration` | Service identifier in logs |
| `DISABLE_LOGGING` | `false` | Disable all logging |

### File Management

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_DIR` | `./logs` | Log directory path |
| `LOG_MAX_SIZE` | `20m` | Max file size before rotation |
| `LOG_MAX_FILES` | `14d` | Retention period (days or count) |
| `LOG_ARCHIVE` | `true` | Archive old logs as gzip |

### Exception Handling

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_EXCEPTIONS` | `true` | Log uncaught exceptions |
| `LOG_REJECTIONS` | `true` | Log unhandled promise rejections |

### HTTP Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_HTTP_REQUESTS` | `true` | Log HTTP requests |
| `LOG_HTTP_HEADERS` | `true` | Log request/response headers |
| `LOG_HTTP_BODY` | `false` | Log request/response body |

### Performance Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_PERFORMANCE_LOGGING` | `true` | Enable performance metrics |
| `PERFORMANCE_LOG_THRESHOLD_MS` | `1000` | Threshold for slow operation warning |
| `ENABLE_SYSTEM_METRICS` | `true` | Enable system metrics collection |
| `METRICS_INTERVAL_MS` | `60000` | System metrics collection interval |

### Database Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_DATABASE_QUERIES` | `true` | Log database queries |
| `LOG_SLOW_QUERY_THRESHOLD_MS` | `100` | Threshold for slow query warning |
| `LOG_QUERY_PARAMS` | `true` | Log query parameters |

### Security & Audit

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUDIT_LOG` | `true` | Enable audit logging |
| `LOG_AUTHENTICATION_EVENTS` | `true` | Log authentication events |
| `LOG_AUTHORIZATION_EVENTS` | `true` | Log authorization events |
| `LOG_SECURITY_EVENTS` | `true` | Log security events |
| `AUDIT_LOG_RETENTION_DAYS` | `90` | Audit log retention period |

### Data Protection

| Variable | Default | Description |
|----------|---------|-------------|
| `REDACT_PASSWORDS` | `true` | Redact password fields |
| `REDACT_TOKENS` | `true` | Redact token fields |
| `REDACT_API_KEYS` | `true` | Redact API key fields |
| `MASK_PII` | `true` | Mask personally identifiable information |
| `MASK_EMAIL_ADDRESSES` | `true` | Mask email addresses |
| `MASK_PHONE_NUMBERS` | `true` | Mask phone numbers |
| `MASK_IP_ADDRESSES` | `true` | Mask IP addresses |

### CloudWatch Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_CLOUDWATCH_LOGGING` | `false` | Enable AWS CloudWatch logs |
| `CLOUDWATCH_GROUP` | `/aws/lambda/agent-orchestration` | CloudWatch log group |
| `CLOUDWATCH_STREAM` | `nodejs-logs` | CloudWatch log stream |
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | - | AWS secret key |

### Elasticsearch Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_ELASTICSEARCH_LOGGING` | `false` | Enable Elasticsearch logging |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch URL |
| `ELASTICSEARCH_INDEX` | `agent-logs` | Elasticsearch index name |
| `ELASTICSEARCH_USERNAME` | - | Elasticsearch username |
| `ELASTICSEARCH_PASSWORD` | - | Elasticsearch password |

### Datadog Integration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_DATADOG_LOGGING` | `false` | Enable Datadog logging |
| `DATADOG_API_KEY` | - | Datadog API key |

### Custom Transports

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_CUSTOM_TRANSPORTS` | `false` | Enable custom transports |
| `CUSTOM_LOG_ENDPOINT` | - | Custom log endpoint URL |
| `CUSTOM_LOG_API_KEY` | - | Custom log API key |

### Application Metadata

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment (development, production, staging) |
| `APP_NAME` | `AI-Agent-RabbitMQ-Orchestrator` | Application name |
| `APP_VERSION` | `1.0.0` | Application version |

---

## Log Levels

### Level Hierarchy
```
error (0) > warn (1) > info (2) > http (3) > verbose (4) > debug (5) > silly (6)
```

### Recommended Levels by Environment

#### Development
```bash
LOG_LEVEL=debug  # See everything
```

#### Staging
```bash
LOG_LEVEL=info   # Business events and errors
```

#### Production
```bash
LOG_LEVEL=warn   # Only warnings and errors
# or
LOG_LEVEL=info   # Include business events
```

---

## Transport Configuration

### Console Transport (Development)
```javascript
// Automatically configured in development
// Pretty-printed output with colors
2024-01-15 10:30:45 info [agent] Agent initialized {
  agentId: 'agent-1',
  status: 'ready'
}
```

### File Transport (All Environments)
```javascript
// Logs written to disk
// Configured transports:
// - error.log: Only error-level logs
// - combined.log: All logs (info and above)
// - debug.log: Debug-level logs (when enabled)
// - http.log: HTTP requests
// - performance.log: Performance metrics
```

### Daily Rotation
```javascript
// Format: filename-%DATE%.log
// Examples:
// - error-2024-01-15.log
// - combined-2024-01-15.log

// Compression
// Old logs automatically compressed:
// - error-2024-01-14.log.gz
// - combined-2024-01-14.log.gz
```

---

## Module-Specific Configuration

### Agent Logger
```javascript
import { modules } from './src/logger/index.js';

modules.agent.logInit('agent-001', {
  type: 'researcher',
  capabilities: ['analysis', 'synthesis'],
  version: '1.0.0'
});

modules.agent.logTaskStart('agent-001', 'task-123', 'research');
modules.agent.logTaskComplete('agent-001', 'task-123', { success: true }, 2500);
modules.agent.logStateChange('agent-001', 'ready', 'processing', 'task_received');
modules.agent.logMetrics('agent-001', {
  tasksCompleted: 150,
  successRate: 0.98,
  avgResponseTime: 2000,
  uptime: 86400,
  memoryUsage: 256
});
```

### RabbitMQ Logger
```javascript
import { modules } from './src/logger/index.js';

modules.mq.logConnection('connected', 'amqp://localhost:5672', {
  vhost: '/',
  heartbeat: 30,
  prefetch: 1
});

modules.mq.logPublish('task.exchange', 'task.route', message, {
  messageId: 'msg-123',
  correlationId: 'corr-456'
});

modules.mq.logConsume('task.queue', message, 145);
modules.mq.logQueueMetrics('task.queue', {
  messageCount: 50,
  consumerCount: 5,
  messagesReady: 10,
  messagesUnacknowledged: 40
});
```

### Voting Logger
```javascript
import { modules } from './src/logger/index.js';

modules.voting.logSessionStart('session-1', 'approve_proposal', agents, {
  type: 'consensus',
  quorum: 0.7,
  timeout: 30000
});

modules.voting.logVoteCast('session-1', 'agent-1', 'approved', 1.0);
modules.voting.logConsensus('session-1', 'approved', {
  totalVotes: 5,
  consensusPercentage: 100,
  voteDistribution: { approved: 5, rejected: 0 },
  duration: 1500
});
```

### Performance Logger
```javascript
import { modules } from './src/logger/index.js';

modules.performance.startTimer('operation-1');
// ... do work
modules.performance.endTimer('operation-1', {
  operationType: 'database_query',
  itemCount: 1000
});

modules.performance.logSystemMetrics();
modules.performance.startMetricsInterval(60000);
```

### Security Logger
```javascript
import { modules } from './src/logger/index.js';

modules.security.logAuthentication({
  userId: 'user-123',
  username: 'john@example.com',
  method: 'password',
  success: true,
  ip: '192.168.1.1',
  mfaUsed: true
});

modules.security.logAuthorization({
  userId: 'user-123',
  resource: 'admin_panel',
  action: 'access',
  allowed: false,
  requiredRole: 'admin',
  userRole: 'user'
});

modules.security.logDataAccess({
  userId: 'user-123',
  dataType: 'customer_records',
  recordCount: 1000,
  operation: 'export',
  ip: '192.168.1.1'
});
```

---

## Security Configuration

### Sensitive Data Redaction
```javascript
// Automatically redacted fields:
const sensitiveFields = [
  'password',
  'token',
  'apiKey',
  'secret',
  'authorization',
  'privateKey',
  'clientSecret',
  'refreshToken',
  'accessToken'
];

// Example:
logger.info('Login attempt', {
  username: 'john@example.com',
  password: 'secret123'  // Automatically becomes [REDACTED]
});
```

### PII Masking
```javascript
// Automatically masked fields:
const maskedFields = {
  email: 'us***@example.com',
  phone: '555-***-4567',
  ssn: '***-**-6789',
  ipAddress: '192.168.1.***'
};

// Enable/disable in .env:
MASK_PII=true
MASK_EMAIL_ADDRESSES=true
MASK_PHONE_NUMBERS=true
MASK_IP_ADDRESSES=true
```

### Audit Trail Configuration
```bash
# Enable audit logging
ENABLE_AUDIT_LOG=true

# Set retention period
AUDIT_LOG_RETENTION_DAYS=90

# Enable security event types
LOG_AUTHENTICATION_EVENTS=true
LOG_AUTHORIZATION_EVENTS=true
LOG_SECURITY_EVENTS=true
```

---

## Performance Tuning

### For High-Volume Logging
```bash
# Reduce log level
LOG_LEVEL=warn

# Disable console logging
LOG_TO_CONSOLE=false

# Increase file rotation thresholds
LOG_MAX_SIZE=50m
LOG_MAX_FILES=7d

# Disable expensive operations
ENABLE_PERFORMANCE_LOGGING=false
LOG_QUERY_PARAMS=false

# Use async transports
ENABLE_ELASTICSEARCH_LOGGING=false
```

### For Debugging
```bash
# Increase verbosity
LOG_LEVEL=debug

# Enable all transports
LOG_TO_CONSOLE=true
LOG_TO_FILE=true

# Enable performance monitoring
ENABLE_PERFORMANCE_LOGGING=true
PERFORMANCE_LOG_THRESHOLD_MS=100

# Log query parameters
LOG_QUERY_PARAMS=true
LOG_HTTP_BODY=true
```

### Memory Optimization
```javascript
// Implement log sampling
const SAMPLE_RATE = 0.1; // Log 10% of high-volume operations
if (Math.random() < SAMPLE_RATE) {
  logger.debug('Sampled operation', data);
}

// Disable metrics collection if not needed
ENABLE_SYSTEM_METRICS=false

// Use shorter retention
LOG_MAX_FILES=7d
```

---

## Integration Guides

### Express/Node.js Application
```javascript
import express from 'express';
import { initializeLogging, expressMiddleware, errorHandler } from './src/logger/index.js';

const app = express();

// Initialize logging
await initializeLogging({
  level: process.env.LOG_LEVEL,
  enableMetrics: true,
  globalContext: {
    appVersion: process.env.APP_VERSION,
    environment: process.env.NODE_ENV
  }
});

// Add logging middleware
app.use(expressMiddleware());

// Routes
app.get('/api/data', (req, res) => {
  // Automatic request logging
  res.json({ data: 'example' });
});

// Error handling
app.use(errorHandler);
```

### RabbitMQ Consumer
```javascript
import { rabbitMqContext, modules } from './src/logger/index.js';

channel.consume('task.queue', async (msg) => {
  await rabbitMqContext(msg, async (message, context) => {
    // Automatic RabbitMQ context logging
    modules.mq.logConsume('task.queue', message, 0);

    // Process message
    const result = await processTask(message);

    // Acknowledge message
    channel.ack(message);
    modules.mq.logAck(message.fields.deliveryTag);
  });
});
```

### Agent Task Execution
```javascript
import { agentContext, modules } from './src/logger/index.js';

async function executeTask(agentId, taskId) {
  return await agentContext(agentId, taskId, async (context) => {
    // Automatic agent context logging
    modules.agent.logTaskStart(agentId, taskId, 'research');

    const startTime = Date.now();
    try {
      const result = await performTask();
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
import { modules } from './src/logger/index.js';

// Authentication
app.post('/login', async (req, res) => {
  try {
    const user = await authenticateUser(req.body);
    modules.security.logAuthentication({
      userId: user.id,
      username: user.email,
      success: true,
      ip: req.ip,
      method: 'password'
    });
    res.json({ token: createToken(user) });
  } catch (error) {
    modules.security.logAuthentication({
      username: req.body.email,
      success: false,
      ip: req.ip,
      reason: error.message
    });
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Data access
app.get('/api/users/:id', async (req, res) => {
  modules.security.logDataAccess({
    userId: req.user.id,
    dataType: 'user_records',
    recordCount: 1,
    operation: 'read',
    ip: req.ip
  });
  res.json(await getUser(req.params.id));
});
```

---

## Checklist for Production

- [ ] `LOG_LEVEL` set to `info` or `warn`
- [ ] `LOG_TO_CONSOLE` set to `false`
- [ ] `LOG_TO_FILE` set to `true`
- [ ] `LOG_MAX_SIZE` configured appropriately
- [ ] `LOG_MAX_FILES` configured for retention
- [ ] `REDACT_PASSWORDS` set to `true`
- [ ] `REDACT_TOKENS` set to `true`
- [ ] `MASK_PII` set to `true`
- [ ] `ENABLE_AUDIT_LOG` set to `true`
- [ ] `AUDIT_LOG_RETENTION_DAYS` configured
- [ ] External logging service configured (if applicable)
- [ ] Monitoring and alerting configured
- [ ] Log rotation tested and working
- [ ] Error alerts configured
- [ ] Performance thresholds set

---

## Example .env Files

### Development
```bash
NODE_ENV=development
LOG_LEVEL=debug
LOG_TO_CONSOLE=true
LOG_TO_FILE=true
SERVICE_NAME=agent-dev
ENABLE_PERFORMANCE_LOGGING=true
```

### Staging
```bash
NODE_ENV=staging
LOG_LEVEL=info
LOG_TO_CONSOLE=false
LOG_TO_FILE=true
SERVICE_NAME=agent-staging
ENABLE_PERFORMANCE_LOGGING=true
ENABLE_AUDIT_LOG=true
REDACT_PASSWORDS=true
MASK_PII=true
ENABLE_ELASTICSEARCH_LOGGING=true
ELASTICSEARCH_URL=https://elasticsearch-staging.example.com
```

### Production
```bash
NODE_ENV=production
LOG_LEVEL=info
LOG_TO_CONSOLE=false
LOG_TO_FILE=true
LOG_MAX_SIZE=50m
LOG_MAX_FILES=30d
SERVICE_NAME=agent-prod
ENABLE_PERFORMANCE_LOGGING=true
ENABLE_AUDIT_LOG=true
AUDIT_LOG_RETENTION_DAYS=90
REDACT_PASSWORDS=true
REDACT_TOKENS=true
MASK_PII=true
LOG_AUTHENTICATION_EVENTS=true
LOG_AUTHORIZATION_EVENTS=true
LOG_SECURITY_EVENTS=true
ENABLE_DATADOG_LOGGING=true
DATADOG_API_KEY=<your-key>
```

---

## Conclusion

This guide provides a comprehensive approach to configuring Enterprise logging for the AI Agent RabbitMQ Orchestration System. Configure based on your environment and requirements, and adjust as needed based on operational experience.
