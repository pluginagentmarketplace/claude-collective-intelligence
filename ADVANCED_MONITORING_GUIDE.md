# Enterprise-Grade Observability Stack: ELK + Jaeger + APM

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [ELK Stack Setup](#elk-stack-setup)
4. [Jaeger Distributed Tracing](#jaeger-distributed-tracing)
5. [Elastic APM](#elastic-apm)
6. [Integration & Correlation](#integration--correlation)
7. [Deployment Guide](#deployment-guide)
8. [Troubleshooting](#troubleshooting)
9. [Performance Tuning](#performance-tuning)
10. [Security Hardening](#security-hardening)

## Overview

This enterprise observability stack combines three powerful monitoring solutions:

- **ELK Stack**: Centralized log aggregation, processing, and visualization
- **Jaeger**: Distributed tracing for microservices call tracking
- **Elastic APM**: Application Performance Monitoring with real-time transaction insights

### Key Benefits

- **Unified Observability**: Logs, metrics, traces, and APM in one platform
- **Root Cause Analysis**: Correlate logs, traces, and metrics for faster troubleshooting
- **Performance Insights**: Detailed transaction timing and bottleneck identification
- **Scalability**: Handles high-volume logs and traces from distributed systems
- **Enterprise Features**: Security, multi-tenancy, advanced analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Services                      │
│  (Node.js with OpenTelemetry + Winston Logging)              │
└──────────┬──────────────────┬──────────────────┬──────────────┘
           │                  │                  │
      ┌────▼────┐        ┌────▼────┐      ┌────▼────┐
      │  Logs   │        │ Traces  │      │   APM   │
      │(Winston)│        │(OTEL)   │      │  Spans  │
      └────┬────┘        └────┬────┘      └────┬────┘
           │                  │                  │
    ┌──────▼─────────────────▼────────────────▼──────────┐
    │              Collection Layer                       │
    │  Logstash ◄──────► Jaeger Agent ◄─────► APM Agent │
    └─────┬──────────────────┬────────────────┬──────────┘
          │                  │                 │
    ┌─────▼──┐         ┌─────▼──┐      ┌──────▼────────┐
    │   ES   │         │ Jaeger │      │ APM Server    │
    │Cluster │         │Storage │      │ (Elasticsearch│
    │(3x)    │         │(ES)    │      │  Backend)     │
    └─────┬──┘         └─────┬──┘      └──────┬────────┘
          │                  │                 │
    ┌─────▴──────────────────▴─────────────────▴──────────┐
    │           Elasticsearch Data Store                    │
    │  (Unified indices for logs, traces, APM spans)       │
    └─────┬──────────────────────────────────────────────┘
          │
    ┌─────▴────────────────────────────┐
    │         Visualization              │
    │  Kibana + Grafana + Jaeger UI      │
    │  (Pre-built dashboards & alerts)   │
    └────────────────────────────────────┘
```

## ELK Stack Setup

### 1. Elasticsearch Cluster Configuration

**Elasticsearch** is the core data store for logs, metrics, and traces.

#### Multi-Node Cluster
- 3-node cluster for high availability
- Different node roles: master-eligible, data, ingest, ml
- Cross-cluster search for federated queries

#### Index Management
- **Index Lifecycle Management (ILM)**: Automatic rollover and retention
- **Template Mappings**: Predefined field types and analyzers
- **Index Naming Convention**: `logs-{service}-{environment}-{date}`

### 2. Logstash Pipeline Architecture

Logstash handles log processing in multiple stages:

#### Input Plugins
- **Beats**: Receive from Filebeat, Auditbeat, Metricbeat
- **TCP/UDP Syslog**: Standard syslog protocol
- **HTTP/REST**: Application-generated events
- **Kafka**: High-volume event streaming
- **RabbitMQ**: Queue-based log collection

#### Filter Plugins (Processing Chain)
1. **Parsing & Structuring**
   - Grok patterns for unstructured logs
   - JSON codec for structured logs
   - Mutate filters for field transformations

2. **Enrichment**
   - GeoIP lookup for source IP enrichment
   - Translate filters for enum mappings
   - Database lookups for context

3. **Correlation**
   - Trace ID injection
   - Request ID correlation
   - Session ID linking

#### Output Plugins
- **Elasticsearch**: Main data store
- **Backup Index**: Secondary index for DR
- **Alerting**: Push to webhook/email
- **Metrics**: Send to monitoring system

### 3. Kibana Dashboard Suite

Pre-built dashboards for observability:

#### Dashboard 1: System Overview
- Log volume trends
- Error rate monitoring
- Service health status
- Infrastructure metrics

#### Dashboard 2: Application Performance
- Request latency percentiles (p50, p95, p99)
- Throughput and request rates
- Error types and frequencies
- Top slow queries

#### Dashboard 3: Log Analysis
- Real-time log stream
- Log level distribution
- Error stack trace analysis
- Searchable log discovery

#### Dashboard 4: Distributed Tracing
- Service dependency map
- Trace timeline visualization
- Critical path analysis
- Latency breakdown by service

#### Dashboard 5: Infrastructure & Resources
- CPU and memory usage
- Disk I/O metrics
- Network throughput
- Container metrics (if using Docker)

### 4. Index Lifecycle Management (ILM)

```yaml
Phases:
  Hot:     # Recent data, full indexing, frequent access
    - Rollover: 30GB or 1 day
    - Refresh: 1s
    - Replicas: 1

  Warm:    # Historical data, occasional access
    - Move to warm nodes
    - Rollover: 30GB or 7 days
    - Refresh: 30s
    - Replicas: 1

  Cold:    # Archival data, rare access
    - Move to cold storage
    - Searchable snapshots
    - Replicas: 0

  Delete:  # Retention expiry
    - Delete after 90 days (configurable)
```

### 5. Log Aggregation Configuration

#### Service Log Collection

```javascript
// Winston Transports for Logstash
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'error.log',
    level: 'error'
  }),
  // Send to Logstash via HTTP
  new LogstashTransport({
    host: 'logstash',
    port: 5000,
    type: 'nodejs-app'
  })
];
```

#### Log Fields Standardization
- `@timestamp`: Event timestamp
- `message`: Log message
- `level`: Severity (error, warn, info, debug)
- `service`: Service name
- `environment`: Deployment environment
- `trace_id`: Distributed trace ID
- `request_id`: Request correlation ID
- `user_id`: User identifier
- `duration_ms`: Operation duration

## Jaeger Distributed Tracing

### 1. Architecture Overview

Jaeger components:
- **Jaeger Agent**: Local UDP endpoint for trace span collection
- **Jaeger Collector**: Receives spans from agents, stores in Elasticsearch
- **Jaeger Query**: API for querying spans and traces
- **Jaeger UI**: Web interface for trace visualization

### 2. OpenTelemetry Instrumentation

```javascript
// Initialize OpenTelemetry
const { BasicTracerProvider, BatchSpanProcessor } = require('@opentelemetry/node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const jaegerExporter = new JaegerExporter({
  host: 'jaeger-agent',
  port: 6831,
});

const tracerProvider = new BasicTracerProvider();
tracerProvider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
```

### 3. Instrumentation Patterns

#### HTTP Server Tracing
- Automatic span creation for incoming requests
- Span tags: method, URL, status code, duration
- Baggage propagation across services

#### Database Query Tracing
- Query execution spans
- Query text and duration
- Connection pool metrics
- Row count tracking

#### Message Queue Tracing
- Producer spans for message publishing
- Consumer spans for message processing
- Queue latency tracking
- Batch processing metrics

#### External API Calls
- HTTP client span creation
- Request/response headers
- Timeout and retry tracking
- Error categorization

### 4. Service Dependency Mapping

- Automatically generated from trace relationships
- Visual representation in Jaeger UI
- Critical path analysis
- Service call frequency

### 5. Latency Analysis

- Breakdown by service tier
- Percentile calculations (p50, p95, p99)
- Outlier detection
- Trend analysis

## Elastic APM

### 1. APM Server Setup

Elastic APM Server is a standalone service that:
- Receives APM data from applications
- Validates and processes spans/transactions
- Stores in Elasticsearch indices
- Provides API for Kibana visualization

### 2. Application Instrumentation

```javascript
// Initialize Elastic APM Agent
const apm = require('elastic-apm-node');

apm.start({
  serviceName: 'ai-agent-platform',
  serverUrl: 'http://apm-server:8200',
  environment: process.env.NODE_ENV,
  logLevel: 'info',
  transactionSampleRate: 1.0, // Sample all transactions in dev
});
```

### 3. Transaction Monitoring

APM automatically captures:
- **HTTP Requests**: Incoming API calls
- **Database Queries**: SQL execution
- **External Requests**: Outbound API calls
- **Message Queue Operations**: RabbitMQ/Kafka
- **Custom Transactions**: Application-specific workflows

### 4. Error Tracking

- Automatic error capture with stack traces
- Error grouping and deduplication
- Error rate monitoring
- Top error sources identification

### 5. Performance Profiling

- CPU profiling for hotspot identification
- Memory profiling for leak detection
- Garbage collection metrics
- Thread/async operation tracking

## Integration & Correlation

### 1. Trace ID Correlation

All three systems use the same trace ID format:
- W3C Trace Context standard
- 128-bit trace ID propagation
- Links logs, traces, and APM spans

### 2. Cross-Stack Queries

#### Kibana to Jaeger
```
Log contains trace_id:abc123
→ Click link in Kibana
→ Opens Jaeger UI with full trace
```

#### APM to Logs
```
APM transaction shows slow database query
→ Click to see query span
→ View application logs during query execution
→ Check infrastructure metrics
```

#### Dashboard Correlation
```
Grafana metric spike
→ Click to Kibana logs
→ Filter by time range
→ Correlate with APM errors
→ View trace details
```

### 3. Unified Alerting

Alerts triggered by:
- Log pattern matching (Logstash)
- Metric thresholds (Prometheus → Grafana)
- Error rate increase (APM)
- Trace latency SLA breaches (Jaeger)
- Index performance degradation (ES)

## Deployment Guide

### Prerequisites

- Docker & Docker Compose
- Minimum 8GB RAM
- 50GB disk space
- Linux kernel 4.4+

### Quick Start

```bash
# Start ELK stack
docker-compose -f docker-compose-elk.yml up -d

# Start Jaeger
docker-compose -f docker-compose-jaeger.yml up -d

# Start full monitoring stack
docker-compose -f docker-compose-full-monitoring.yml up -d
```

### Environment Configuration

Create `.env` file:

```env
# Elasticsearch
ES_HEAP_SIZE=2g
ES_JAVA_OPTS=-Xms2g -Xmx2g
ELASTICSEARCH_CLUSTER_NAME=ai-agent-cluster
ELASTICSEARCH_NODES=3

# Kibana
KIBANA_DEFAULTAPPID=discover
KIBANA_ENABLE_SECURITY=true

# Logstash
LOGSTASH_HEAP_SIZE=1g
LOGSTASH_PIPELINE_BATCH_SIZE=1000
LOGSTASH_PIPELINE_BATCH_DELAY=50

# Jaeger
JAEGER_SAMPLING_RATE=1.0
JAEGER_STORAGE_TYPE=elasticsearch

# APM Server
APM_SAMPLE_RATE=1.0
APM_TRANSACTION_SAMPLE_RATE=1.0

# Retention Policies
LOG_RETENTION_DAYS=30
TRACE_RETENTION_DAYS=7
APM_RETENTION_DAYS=14
```

### Verification Steps

1. **Elasticsearch Health**
   ```bash
   curl http://localhost:9200/_cluster/health
   ```

2. **Kibana Access**
   ```
   http://localhost:5601
   ```

3. **Jaeger UI**
   ```
   http://localhost:16686
   ```

4. **APM Server Health**
   ```bash
   curl http://localhost:8200/
   ```

## Troubleshooting

### Common Issues

#### 1. Elasticsearch Memory Issues
**Problem**: OOMKilled container
**Solution**:
```bash
# Increase heap size in docker-compose
ES_JAVA_OPTS: -Xms4g -Xmx4g

# Check actual memory usage
curl http://localhost:9200/_nodes/stats/jvm
```

#### 2. High Latency in Log Ingestion
**Problem**: Logs appearing 10+ seconds late
**Solution**:
```yaml
# Logstash: Reduce batch delay
pipeline.batch.delay: 10ms
pipeline.batch.size: 2000

# Elasticsearch: Increase refresh interval
index.refresh_interval: 5s
```

#### 3. Jaeger Storage Issues
**Problem**: Traces not showing in Jaeger UI
**Solution**:
```bash
# Check Jaeger collector logs
docker logs jaeger-collector

# Verify Elasticsearch indices
curl http://localhost:9200/_cat/indices?v | grep jaeger
```

#### 4. APM No Data Appearing
**Problem**: APM server running but no data
**Solution**:
```javascript
// Verify APM agent initialization
console.log('APM Active:', apm.isStarted());
console.log('Service:', apm.getServiceName());

// Check APM server connectivity
curl http://apm-server:8200/intake/v2/events -X POST
```

### Debugging Commands

```bash
# Check log pipeline performance
curl 'localhost:5000/_stats' | jq '.logstash.pipelines'

# View Elasticsearch cluster status
curl http://localhost:9200/_cat/nodes?v

# List all indices and their sizes
curl http://localhost:9200/_cat/indices?v&h=index,docs.count,store.size

# Check index mappings
curl http://localhost:9200/logs-*/_mapping?pretty

# Query APM indices
curl 'http://localhost:9200/apm-*/_search?pretty' -d '{
  "query": { "match_all": {} },
  "size": 1
}'

# View Jaeger sampling rates
curl http://localhost:14269/metrics | grep sampler

# Check cross-cluster search status
curl http://localhost:9200/_remote/info
```

## Performance Tuning

### 1. Elasticsearch Optimization

#### Index Settings
```json
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "index.refresh_interval": "30s",
    "index.codec": "best_compression",
    "index.max_result_window": 50000,
    "analysis": {
      "analyzer": {
        "logs_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "stop"]
        }
      }
    }
  }
}
```

#### JVM Tuning
- Set Xms = Xmx (prevent heap reallocation)
- Use 50% of available system RAM
- Enable G1GC for heaps > 31GB
- Monitor GC pause times

### 2. Logstash Performance

```yaml
pipeline:
  batch:
    size: 2000        # Increase from 125
    delay: 50         # Milliseconds
  workers: 4          # CPU cores
  ordered: false      # Allow parallel processing

queue:
  type: persisted
  checkpoint.writes: 0  # Disable for speed
```

### 3. Jaeger Optimization

```yaml
# Sampling strategy
sampling:
  default_strategy:
    type: probabilistic
    param: 0.1  # 10% sampling in production

# Storage
storage:
  type: elasticsearch
  options:
    es.bulk.size: 2000
    es.bulk.actions: 1000
```

### 4. APM Server Tuning

```yaml
apm-server:
  auth:
    anonymous:
      enabled: true
      allow_agent: ['RUM', 'JS']

  api:
    request_pool_size: 1024
```

## Security Hardening

### 1. Elasticsearch Security

```yaml
xpack:
  security:
    enabled: true
    enrollment:
      enabled: true

  authc:
    providers:
      basic.basic1:
        order: 0

  transport:
    ssl:
      enabled: true
      verification_mode: certificate
      keystore:
        path: /usr/share/elasticsearch/config/certs/elastic-certificates.p12
      truststore:
        path: /usr/share/elasticsearch/config/certs/elastic-certificates.p12
```

### 2. Kibana Authentication

```yaml
elasticsearch.username: kibana_system
elasticsearch.password: ${KIBANA_PASSWORD}

xpack.security.enabled: true
xpack.security.sessionTimeout: 1h
```

### 3. APM Server Security

```yaml
apm-server:
  auth:
    api_key:
      enabled: true
      limit: 100

  ssl:
    enabled: true
    certificate: /path/to/cert.pem
    key: /path/to/key.pem
```

### 4. Network Isolation

```yaml
networks:
  monitoring:
    driver: bridge
    ipam:
      config:
        - subnet: 172.30.0.0/16

  internal:
    driver: bridge
    internal: true  # No external access
```

### 5. TLS/SSL Configuration

```bash
# Generate self-signed certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/certs/elasticsearch.key \
  -out /etc/certs/elasticsearch.crt

# Enable TLS in Elasticsearch
xpack.security.http.ssl:
  enabled: true
  keystore.path: certs/elasticsearch.p12
```

### 6. Secret Management

```bash
# Use environment variables
export ELASTICSEARCH_PASSWORD=secure_password
export APM_SECRET_TOKEN=generated_token

# Or use Docker secrets
docker secret create es_password /dev/stdin
```

## Monitoring the Monitoring System

### Meta-Monitoring

Monitor the observability stack itself:

```yaml
# Prometheus scrapes monitoring services
scrape_configs:
  - job_name: 'elasticsearch'
    static_configs:
      - targets: ['localhost:9200']

  - job_name: 'kibana'
    metrics_path: '/api/status'
    static_configs:
      - targets: ['localhost:5601']

  - job_name: 'jaeger'
    static_configs:
      - targets: ['localhost:14269']

  - job_name: 'apm-server'
    static_configs:
      - targets: ['localhost:8200']
```

### Alerts to Configure

1. **Elasticsearch**
   - Cluster health RED
   - Disk usage > 85%
   - JVM heap usage > 80%
   - Unassigned shards > 0

2. **Logstash**
   - Pipeline stuck (no output > 60s)
   - Dead letter queue building up
   - Processing latency > 5s

3. **Jaeger**
   - Collector queue size > 1000
   - Storage operation failures
   - Sampling rate drift

4. **APM Server**
   - No events received (5 min)
   - Storage write failures
   - Memory usage > 80%

## Advanced Topics

### 1. Cross-Cluster Search
Connect multiple Elasticsearch clusters for federated search.

### 2. Machine Learning Detection
Use Elasticsearch ML for anomaly detection in logs and metrics.

### 3. Custom Dashboards
Build correlation dashboards linking logs, traces, and metrics.

### 4. Integration with External Systems
- Send alerts to PagerDuty
- Webhook integration with Slack
- SIEM integration with Splunk

### 5. Cost Optimization
- Index lifecycle management for data tiering
- Searchable snapshots for cold data
- Sampling strategies for high-volume environments

## References

- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Kibana User Guide](https://www.elastic.co/guide/en/kibana/current/index.html)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Specification](https://opentelemetry.io/docs/reference/specification/)
- [Elastic APM Guide](https://www.elastic.co/guide/en/apm/get-started/current/index.html)

---

**Last Updated**: 2025-11-18
**Version**: 1.0 Enterprise Edition
