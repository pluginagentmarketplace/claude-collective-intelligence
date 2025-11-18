# OpenTelemetry Instrumentation Guide

Complete guide for instrumenting Node.js applications with OpenTelemetry for distributed tracing and monitoring.

## Table of Contents
1. [Setup & Installation](#setup--installation)
2. [Basic Configuration](#basic-configuration)
3. [Service Instrumentation](#service-instrumentation)
4. [Custom Spans & Attributes](#custom-spans--attributes)
5. [Error Handling](#error-handling)
6. [Performance Best Practices](#performance-best-practices)
7. [Testing & Validation](#testing--validation)

## Setup & Installation

### 1. Install Required Packages

```bash
npm install \
  @opentelemetry/api \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/exporter-jaeger \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/sdk-metrics \
  @opentelemetry/sdk-trace-node \
  elastic-apm-node
```

### 2. Create Instrumentation Module

Create `src/instrumentation/tracing.js`:

```javascript
'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { BasicTracerProvider, BatchSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

// Initialize Jaeger exporter
const jaegerExporter = new JaegerExporter({
  host: process.env.TRACES_AGENT_HOST || 'localhost',
  port: parseInt(process.env.TRACES_AGENT_PORT || '6831'),
  maxPacketSize: 65000,
});

// Create tracer provider with resource info
const tracerProvider = new BasicTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.APM_SERVICE_NAME || 'ai-agent-platform',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'us-east-1',
  }),
});

// Add span processors
tracerProvider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter, {
  maxQueueSize: 2000,
  maxExportBatchSize: 512,
  scheduledDelayMillis: 5000,
  exportTimeoutMillis: 30000,
}));

// Create SDK with auto-instrumentation
const sdk = new NodeSDK({
  tracerProvider,
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-express': {
      enabled: true,
    },
    '@opentelemetry/instrumentation-pg': {
      enabled: true,
      responseHook: (span, result) => {
        span.setAttribute('db.result_size', result?.rowCount || 0);
      },
    },
    '@opentelemetry/instrumentation-amqplib': {
      enabled: true,
      consumeHook: (span, msg) => {
        if (msg.properties?.correlationId) {
          span.setAttribute('messaging.correlation_id', msg.properties.correlationId);
        }
      },
    },
    '@opentelemetry/instrumentation-http': {
      enabled: true,
      requestHook: (span, request) => {
        span.setAttribute('http.request.body.size', request.headers['content-length'] || 0);
      },
      responseHook: (span, response) => {
        span.setAttribute('http.response.body.size', response.headers['content-length'] || 0);
      },
    },
    '@opentelemetry/instrumentation-ioredis': {
      enabled: true,
      responseHook: (span, cmdName, cmdArgs, response) => {
        span.setAttribute('redis.command', cmdName);
      },
    },
  })],
});

// Initialize SDK
sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing initialized'))
    .catch((error) => console.error('Error shutting down tracing', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
```

### 3. Initialize in Application Entry Point

Create `src/app.js` and add at the very top:

```javascript
// MUST be the first import
require('./instrumentation/tracing');

// Elastic APM initialization
const apm = require('elastic-apm-node');

if (process.env.APM_SERVER_URL) {
  apm.start({
    serviceName: process.env.APM_SERVICE_NAME || 'ai-agent-platform',
    serverUrl: process.env.APM_SERVER_URL,
    environment: process.env.NODE_ENV,
    logLevel: process.env.APM_LOG_LEVEL || 'info',
    transactionSampleRate: parseFloat(process.env.APM_TRANSACTION_SAMPLE_RATE || '1.0'),
    metricsInterval: '60s',
    errorOnAbortedRequests: false,
    errorMessageMaxLength: 500,
    stackTraceLimit: 50,
    serviceNodeName: process.env.HOSTNAME || 'unknown',
    captureHeaders: true,
    captureBody: 'transactions',
  });
}

// Rest of your application code...
const express = require('express');
const app = express();

// ... configure app
```

## Basic Configuration

### 1. Environment Variables

Create `.env.instrumentation`:

```bash
# OpenTelemetry/Jaeger Configuration
TRACES_AGENT_HOST=jaeger-agent
TRACES_AGENT_PORT=6831
TRACES_COLLECTOR_HOST=jaeger-collector
TRACES_COLLECTOR_PORT=14250

# Elastic APM Configuration
APM_SERVER_URL=http://apm-server:8200
APM_SERVICE_NAME=ai-agent-platform
APM_SERVICE_VERSION=1.0.0
APM_ENVIRONMENT=production
APM_LOG_LEVEL=info
APM_TRANSACTION_SAMPLE_RATE=1.0
APM_METRICS_INTERVAL=60s

# Application Configuration
SERVICE_VERSION=1.0.0
NODE_ENV=production
HOSTNAME=app-instance-1
```

### 2. Configuration Module

Create `src/config/instrumentation.js`:

```javascript
module.exports = {
  jaeger: {
    serviceName: process.env.APM_SERVICE_NAME || 'ai-agent-platform',
    host: process.env.TRACES_AGENT_HOST || 'localhost',
    port: parseInt(process.env.TRACES_AGENT_PORT || '6831'),
    sampler: {
      type: 'const',
      param: 1,
    },
    logSpans: process.env.TRACE_LOG_SPANS === 'true',
  },
  apm: {
    serverUrl: process.env.APM_SERVER_URL,
    serviceName: process.env.APM_SERVICE_NAME,
    environment: process.env.APM_ENVIRONMENT,
    transactionSampleRate: parseFloat(process.env.APM_TRANSACTION_SAMPLE_RATE || '1.0'),
  },
  logging: {
    logstashHost: process.env.LOGS_HOST || 'localhost',
    logstashPort: parseInt(process.env.LOGS_PORT || '5000'),
    logstashProtocol: process.env.LOGS_PROTOCOL || 'tcp',
  },
};
```

## Service Instrumentation

### 1. Express Middleware

Create `src/middleware/tracing.js`:

```javascript
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('express-middleware', '1.0.0');

module.exports = {
  // Middleware to add trace context to responses
  traceResponseHeaders: (req, res, next) => {
    const span = tracer.startSpan('http.request', {
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.client_ip': req.ip,
        'http.user_agent': req.get('user-agent'),
      },
    });

    // Extract trace context from request
    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;

    // Add to response headers
    res.setHeader('X-Trace-ID', traceId);
    res.setHeader('X-Span-ID', spanId);

    // Store in request for logging
    req.traceId = traceId;
    req.spanId = spanId;

    res.on('finish', () => {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_content_length': res.get('content-length') || 0,
      });
      span.end();
    });

    next();
  },

  // Middleware to inject trace context into logs
  injectTraceContext: (req, res, next) => {
    req.traceContext = {
      traceId: req.traceId,
      spanId: req.spanId,
      trace_id: req.traceId,
      span_id: req.spanId,
      request_id: req.get('x-request-id') || req.traceId,
    };
    next();
  },
};
```

### 2. Database Instrumentation

Create `src/instrumentation/database.js`:

```javascript
const { trace, context } = require('@opentelemetry/api');

const tracer = trace.getTracer('database', '1.0.0');

async function executeQuery(pool, query, params, operation = 'query') {
  const span = tracer.startSpan(`db.${operation}`, {
    attributes: {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.statement': query,
      'db.params_count': params?.length || 0,
    },
  });

  return context.with(trace.setSpan(context.active(), span), async () => {
    const startTime = Date.now();
    try {
      const result = operation === 'query'
        ? await pool.query(query, params)
        : await pool.execute(query, params);

      span.setAttributes({
        'db.result_rows': result.rowCount || result.rows?.length || 0,
        'db.affected_rows': result.rowCount || 0,
        'db.duration_ms': Date.now() - startTime,
      });

      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

module.exports = { executeQuery };
```

### 3. Message Queue Instrumentation

Create `src/instrumentation/messaging.js`:

```javascript
const { trace, context } = require('@opentelemetry/api');

const tracer = trace.getTracer('messaging', '1.0.0');

async function publishMessage(channel, exchange, routingKey, message, options = {}) {
  const span = tracer.startSpan('messaging.publish', {
    attributes: {
      'messaging.system': 'rabbitmq',
      'messaging.destination': exchange,
      'messaging.message_id': options.messageId || 'unknown',
      'messaging.correlation_id': options.correlationId,
      'messaging.message_payload_size_bytes': JSON.stringify(message).length,
    },
  });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const published = channel.publish(
        exchange,
        routingKey,
        messageBuffer,
        {
          persistent: true,
          contentType: 'application/json',
          correlationId: options.correlationId,
          timestamp: Date.now(),
          ...options,
        }
      );

      span.setAttributes({
        'messaging.message_sent': published,
      });

      return published;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function consumeMessage(channel, queue, callback) {
  return channel.consume(queue, async (msg) => {
    if (!msg) return;

    const span = tracer.startSpan('messaging.process', {
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.destination': msg.fields.exchange,
        'messaging.message_id': msg.properties.messageId,
        'messaging.correlation_id': msg.properties.correlationId,
        'messaging.routing_key': msg.fields.routingKey,
      },
    });

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const content = JSON.parse(msg.content.toString());
        await callback(content, msg);
        channel.ack(msg);

        span.setStatus({ code: 0 });
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message });
        channel.nack(msg, false, true);
        throw error;
      } finally {
        span.end();
      }
    });
  });
}

module.exports = { publishMessage, consumeMessage };
```

### 4. HTTP Client Instrumentation

Create `src/instrumentation/http-client.js`:

```javascript
const { trace, context } = require('@opentelemetry/api');
const axios = require('axios');

const tracer = trace.getTracer('http-client', '1.0.0');

const createTracedAxiosInstance = (config = {}) => {
  const instance = axios.create(config);

  instance.interceptors.request.use((config) => {
    const span = tracer.startSpan('http.client', {
      attributes: {
        'http.method': config.method?.toUpperCase(),
        'http.url': config.url,
        'http.target': new URL(config.url).pathname,
      },
    });

    // Inject trace context into headers
    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;

    config.headers['X-Trace-ID'] = traceId;
    config.headers['X-Span-ID'] = spanId;
    config.headers['W3C-Trace-Context'] = `00-${traceId}-${spanId}-01`;

    // Store span in request
    config.__span = span;
    config.__startTime = Date.now();

    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      const { __span, __startTime } = response.config;
      if (__span) {
        __span.setAttributes({
          'http.status_code': response.status,
          'http.response_content_length': response.headers['content-length'] || 0,
          'http.duration_ms': Date.now() - __startTime,
        });
        __span.end();
      }
      return response;
    },
    (error) => {
      const { __span, __startTime } = error.config;
      if (__span) {
        __span.recordException(error);
        __span.setStatus({ code: 2, message: error.message });
        __span.setAttributes({
          'http.status_code': error.response?.status || 0,
          'http.duration_ms': Date.now() - __startTime,
        });
        __span.end();
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

module.exports = { createTracedAxiosInstance };
```

## Custom Spans & Attributes

### 1. Creating Custom Spans

```javascript
const { trace } = require('@opentelemetry/api');

const tracer = trace.getTracer('my-service', '1.0.0');

async function processData(data) {
  const span = tracer.startSpan('data.processing', {
    attributes: {
      'data.size': data.length,
      'data.type': typeof data,
    },
  });

  try {
    // Your processing logic
    const result = data.map(item => ({...item, processed: true}));

    span.addEvent('data.processed', {
      'result.count': result.length,
      'result.size': JSON.stringify(result).length,
    });

    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

### 2. Span Attributes Best Practices

```javascript
// Good: Use semantic conventions
span.setAttributes({
  'service.name': 'order-processor',
  'service.version': '1.0.0',
  'db.system': 'postgresql',
  'db.operation': 'query',
  'http.method': 'GET',
  'http.status_code': 200,
  'rpc.service': 'UserService',
  'rpc.method': 'GetUser',
});

// Include business context
span.setAttributes({
  'user.id': userId,
  'order.id': orderId,
  'transaction.amount': amount,
  'transaction.currency': 'USD',
});

// Include performance metrics
span.setAttributes({
  'performance.memory_used_mb': process.memoryUsage().heapUsed / 1024 / 1024,
  'performance.duration_ms': endTime - startTime,
});
```

## Error Handling

### 1. Recording Exceptions

```javascript
try {
  // operation that might fail
} catch (error) {
  // Record the exception in the current span
  span.recordException(error);

  // Set error status
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });

  // Add error attributes
  span.setAttributes({
    'error.type': error.constructor.name,
    'error.message': error.message,
    'error.stack': error.stack,
  });

  throw error;
}
```

### 2. Error Context in APM

```javascript
const apm = require('elastic-apm-node');

try {
  // operation
} catch (error) {
  // Capture error with context
  apm.captureError(error, {
    user: {
      id: userId,
      email: userEmail,
    },
    custom: {
      operation: 'processPayment',
      amount: 99.99,
    },
    request: req,
  });
}
```

## Performance Best Practices

### 1. Sampling Strategy

```javascript
const sdk = new NodeSDK({
  tracerProvider: new BasicTracerProvider({
    sampler: new ProbabilitySampler({
      probability: process.env.TRACE_SAMPLE_RATE || 0.1, // 10% in production
    }),
  }),
  // ...
});
```

### 2. Batch Span Processing

```javascript
const processor = new BatchSpanProcessor(exporter, {
  maxQueueSize: 2000,           // Max spans in queue
  maxExportBatchSize: 512,      // Max spans per export
  scheduledDelayMillis: 5000,   // Wait 5s before exporting
  exportTimeoutMillis: 30000,   // 30s timeout for export
});
```

### 3. Memory Management

```javascript
// Use resource limits
apm.start({
  transactionMaxSpans: 128,        // Max spans per transaction
  stackTraceLimit: 50,             // Limit stack trace depth
  errorMessageMaxLength: 500,      // Limit error message size
  metricsInterval: '60s',          // Metrics collection interval
});
```

## Testing & Validation

### 1. Test Trace Generation

```javascript
const assert = require('assert');
const { trace } = require('@opentelemetry/api');

describe('Tracing', () => {
  it('should create spans with correct attributes', () => {
    const tracer = trace.getTracer('test', '1.0.0');
    const span = tracer.startSpan('test.span');

    span.setAttributes({
      'test.key': 'test.value',
      'test.number': 123,
    });

    assert.ok(span.spanContext().traceId);
    span.end();
  });
});
```

### 2. Verify Jaeger Integration

```bash
# Check Jaeger is receiving spans
curl http://localhost:16686/api/services

# Query traces for a service
curl "http://localhost:16686/api/traces?service=ai-agent-platform&limit=10"

# Get span details
curl "http://localhost:16686/api/traces/{traceId}"
```

### 3. Verify APM Integration

```bash
# Check APM server health
curl http://localhost:8200/

# View APM indices
curl "http://localhost:9200/_cat/indices?v&h=index,docs.count" | grep apm

# Query APM transactions
curl "http://localhost:9200/apm-*/_search?pretty" -d '{
  "query": {
    "match": {
      "processor.event": "transaction"
    }
  }
}'
```

## Advanced Topics

### 1. Baggage Propagation

```javascript
const { baggage, context } = require('@opentelemetry/api');

// Set baggage
const baggage_obj = baggage.createBaggage({
  'user.id': { value: userId },
  'request.id': { value: requestId },
});

context.with(baggage.setBaggage(context.active(), baggage_obj), async () => {
  // Execute with baggage context
});

// Get baggage
const user_id = baggage.getBaggage(context.active())?.getEntry('user.id')?.value;
```

### 2. Manual Instrumentation Template

```javascript
module.exports = class MyCustomInstrumentation {
  constructor(config = {}) {
    this.config = config;
  }

  install() {
    const tracer = trace.getTracer('my-instrumentation', '1.0.0');

    // Patch/instrument your code here
    // Use tracer.startSpan() to create spans
  }
};
```

---

**Last Updated**: 2025-11-18
**Version**: 1.0 Enterprise Edition
