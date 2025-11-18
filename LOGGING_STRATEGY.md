# Enterprise-Grade Logging Strategy 📊

## Architecture Overview

This document outlines the production-grade structured logging implementation using Winston for the AI Agent RabbitMQ Orchestration System.

## Core Principles

### 1. Structured Logging
- **JSON Format**: All logs are structured as JSON for easy parsing
- **Consistent Schema**: Standardized log format across all modules
- **Machine-Readable**: Optimized for log aggregation tools

### 2. Contextual Information
- **Correlation IDs**: Track requests across distributed systems
- **Request/Task IDs**: Unique identifiers for each operation
- **Agent Context**: Include agent-specific metadata
- **User Context**: Track user-related information

### 3. Performance Optimization
- **Async Logging**: Non-blocking log operations
- **Buffering**: Batch writes for better performance
- **Log Rotation**: Automatic file rotation to manage disk space

## Log Levels

### Standard Levels
```javascript
{
  error: 0,    // System errors, exceptions
  warn: 1,     // Warning conditions
  info: 2,     // Informational messages
  http: 3,     // HTTP request logging
  verbose: 4,  // Verbose debugging
  debug: 5,    // Debug-level messages
  silly: 6     // Extremely detailed logging
}
```

### Usage Guidelines

#### ERROR Level
- Unhandled exceptions
- Critical system failures
- Data corruption issues
- Service unavailability

```javascript
logger.error('Database connection failed', {
  error: err.message,
  stack: err.stack,
  service: 'database',
  retryCount: 3
});
```

#### WARN Level
- Deprecated API usage
- Poor performance metrics
- Retry scenarios
- Resource constraints

```javascript
logger.warn('High memory usage detected', {
  memoryUsage: process.memoryUsage(),
  threshold: '80%',
  action: 'monitoring'
});
```

#### INFO Level
- Service start/stop
- Configuration changes
- Business transactions
- System health checks

```javascript
logger.info('Agent task completed', {
  taskId: '123',
  agentId: 'agent-1',
  duration: 1500,
  result: 'success'
});
```

#### DEBUG Level
- Method entry/exit
- Variable state
- Decision points
- Detailed flow

```javascript
logger.debug('Processing vote', {
  voteId: '456',
  agentVotes: votes,
  consensusThreshold: 0.7
});
```

## Module-Specific Loggers

### 1. Agent Logger
```javascript
const agentLogger = createLogger('agent');
agentLogger.info('Agent initialized', {
  agentId,
  capabilities,
  status: 'ready'
});
```

### 2. RabbitMQ Logger
```javascript
const mqLogger = createLogger('rabbitmq');
mqLogger.info('Message published', {
  queue,
  messageId,
  correlationId,
  size: Buffer.byteLength(message)
});
```

### 3. Voting Logger
```javascript
const votingLogger = createLogger('voting');
votingLogger.info('Consensus reached', {
  sessionId,
  votes: voteCount,
  consensus: percentage,
  decision
});
```

### 4. Performance Logger
```javascript
const perfLogger = createLogger('performance');
perfLogger.info('Performance metrics', {
  operation,
  duration,
  cpu: process.cpuUsage(),
  memory: process.memoryUsage()
});
```

## Log Formatting

### Development Format
```
2024-01-15 10:30:45 [INFO] [agent] Agent initialized {agentId: "agent-1", status: "ready"}
```

### Production Format (JSON)
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "service": "agent-orchestration",
  "module": "agent",
  "message": "Agent initialized",
  "correlationId": "abc-123",
  "metadata": {
    "agentId": "agent-1",
    "status": "ready"
  }
}
```

## Contextual Logging

### Request Context
```javascript
// Middleware to add request context
app.use((req, res, next) => {
  const requestId = uuidv4();
  req.context = {
    requestId,
    userId: req.user?.id,
    sessionId: req.session?.id,
    ip: req.ip
  };

  logger.child({ context: req.context });
  next();
});
```

### Async Context
```javascript
const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();

function runWithContext(context, fn) {
  return asyncLocalStorage.run(context, fn);
}
```

## Log Aggregation Integration

### CloudWatch Integration
```javascript
const CloudWatchTransport = require('winston-cloudwatch');

new CloudWatchTransport({
  logGroupName: '/aws/lambda/agent-orchestration',
  logStreamName: `${process.env.NODE_ENV}-${new Date().toISOString()}`,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsRegion: process.env.AWS_REGION
});
```

### ELK Stack Format
```javascript
const ElasticsearchTransport = require('winston-elasticsearch');

new ElasticsearchTransport({
  level: 'info',
  clientOpts: { node: process.env.ELASTICSEARCH_URL },
  index: 'agent-logs',
  dataStream: true
});
```

### Datadog Integration
```javascript
const DatadogTransport = require('datadog-winston');

new DatadogTransport({
  apiKey: process.env.DATADOG_API_KEY,
  hostname: os.hostname(),
  service: 'agent-orchestration',
  ddsource: 'nodejs',
  ddtags: 'env:production'
});
```

## Performance Monitoring

### Metrics Collection
```javascript
// Log performance metrics
function logPerformance(operation, startTime) {
  const duration = Date.now() - startTime;
  perfLogger.info('Operation completed', {
    operation,
    duration,
    timestamp: new Date().toISOString(),
    metrics: {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  });
}
```

### Slow Query Detection
```javascript
// Monitor slow operations
if (duration > SLOW_THRESHOLD) {
  logger.warn('Slow operation detected', {
    operation,
    duration,
    threshold: SLOW_THRESHOLD,
    trace: new Error().stack
  });
}
```

## Log Rotation Strategy

### File Rotation Configuration
```javascript
{
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  auditFile: 'logs/.audit/log-audit.json'
}
```

### Retention Policies
- **Error Logs**: 30 days
- **Combined Logs**: 14 days
- **Debug Logs**: 7 days
- **Archived Logs**: Compressed after 1 day

## Security Considerations

### Sensitive Data Filtering
```javascript
// Redact sensitive information
const redactKeys = ['password', 'token', 'apiKey', 'secret'];

function redactSensitive(obj) {
  const clone = { ...obj };
  redactKeys.forEach(key => {
    if (clone[key]) {
      clone[key] = '[REDACTED]';
    }
  });
  return clone;
}
```

### PII Protection
```javascript
// Mask personally identifiable information
function maskPII(data) {
  return {
    ...data,
    email: data.email?.replace(/(.{2}).*@/, '$1***@'),
    phone: data.phone?.replace(/\d(?=\d{4})/g, '*')
  };
}
```

## Query Examples

### Search by Correlation ID
```javascript
// Find all logs for a specific request
grep "correlationId\":\"abc-123" combined.log
```

### Error Analysis
```javascript
// Count errors by type
jq 'select(.level=="error") | .error' error.log | sort | uniq -c
```

### Performance Analysis
```javascript
// Find slow operations
jq 'select(.duration > 1000) | {operation, duration}' combined.log
```

## Debugging Guidelines

### Enable Debug Logging
```javascript
// Set via environment variable
LOG_LEVEL=debug npm start

// Or programmatically
logger.level = 'debug';
```

### Conditional Logging
```javascript
if (logger.isDebugEnabled()) {
  logger.debug('Expensive debug info', {
    data: expensiveOperation()
  });
}
```

## Best Practices

### 1. Consistent Structure
- Always use structured logging
- Include context in every log
- Use appropriate log levels

### 2. Performance
- Avoid synchronous logging in critical paths
- Use child loggers for context
- Implement log sampling for high-volume operations

### 3. Monitoring
- Set up alerts for ERROR level logs
- Monitor log volume trends
- Track performance metrics

### 4. Development vs Production
- Use pretty printing in development
- Use JSON format in production
- Adjust log levels per environment

## Troubleshooting

### Common Issues

#### High Memory Usage
```javascript
// Implement log buffering
const buffer = [];
const BUFFER_SIZE = 100;

function bufferLog(entry) {
  buffer.push(entry);
  if (buffer.length >= BUFFER_SIZE) {
    flushBuffer();
  }
}
```

#### Disk Space Management
```javascript
// Monitor disk usage
const checkDiskSpace = require('check-disk-space').default;

async function monitorDiskSpace() {
  const { free } = await checkDiskSpace('/');
  if (free < 1000000000) { // Less than 1GB
    logger.error('Low disk space', { free });
  }
}
```

## Implementation Checklist

- [ ] Configure Winston with appropriate transports
- [ ] Set up log rotation
- [ ] Implement context management
- [ ] Create module-specific loggers
- [ ] Add performance monitoring
- [ ] Configure log aggregation
- [ ] Set up alerts and monitoring
- [ ] Document log queries
- [ ] Test error scenarios
- [ ] Validate production configuration

## Conclusion

This logging strategy provides a comprehensive foundation for production-grade logging in the AI Agent RabbitMQ Orchestration System. By following these guidelines, we ensure consistent, performant, and useful logging across all components of the system.