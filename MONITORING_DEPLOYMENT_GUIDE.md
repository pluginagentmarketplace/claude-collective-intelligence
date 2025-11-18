# Enterprise Monitoring Stack - Deployment & Setup Guide

Complete step-by-step guide for deploying the observability stack in different environments.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Production Deployment](#production-deployment)
4. [Configuration Management](#configuration-management)
5. [Health Checks & Validation](#health-checks--validation)
6. [Dashboards & Alerts](#dashboards--alerts)
7. [Scaling & Performance](#scaling--performance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- Docker & Docker Compose 1.29+
- Minimum 16GB RAM (8GB minimum)
- 100GB disk space
- Linux kernel 4.4+
- Ports: 5000-5678, 8200-8201, 9090-9115, 9200-9300, 3000, 5601, 16686

### Network Requirements
- Internet connectivity (for base images)
- Private network for inter-container communication
- Optional: reverse proxy (Nginx/Caddy) for HTTPS

## Quick Start

### 1. Clone & Prepare

```bash
cd /path/to/plugin-ai-agent-rabbitmq

# Create monitoring config directory
mkdir -p monitoring/{logstash/pipeline,logstash/patterns,elasticsearch,kibana/dashboards,apm,grafana/{dashboards,provisioning}}

# Copy .env template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Environment Variables

Add to your `.env`:

```env
# Elasticsearch
ELASTICSEARCH_CLUSTER_NAME=ai-agent-cluster
ES_JAVA_OPTS=-Xms2g -Xmx2g
ELASTICSEARCH_USER=elastic
ELASTICSEARCH_PASSWORD=changeme

# Kibana
KIBANA_ADMIN_USER=admin
KIBANA_ADMIN_PASSWORD=kibana_password
KIBANA_ENCRYPTION_KEY=aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=grafana_password

# APM
APM_SERVER_URL=http://apm-server:8200
APM_SERVICE_NAME=ai-agent-platform
APM_SAMPLE_RATE=1.0
APM_TRANSACTION_SAMPLE_RATE=1.0

# Jaeger
JAEGER_SAMPLING_RATE=1.0

# Logstash
LOGSTASH_JAVA_OPTS=-Xmx1g -Xms1g

# Log Retention
LOG_RETENTION_DAYS=30
TRACE_RETENTION_DAYS=7
APM_RETENTION_DAYS=14
```

### 3. Start the Stack

```bash
# Start ELK Stack only
docker-compose -f docker-compose-elk.yml up -d

# Or start Jaeger only
docker-compose -f docker-compose-jaeger.yml up -d

# Or start full integrated stack
docker-compose -f docker-compose-full-monitoring.yml up -d

# View logs
docker-compose -f docker-compose-full-monitoring.yml logs -f

# Verify services are running
docker-compose -f docker-compose-full-monitoring.yml ps
```

### 4. Access Services

Once all services are running:

- **Kibana**: http://localhost:5601
- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Jaeger UI**: http://localhost:16686
- **APM Server Health**: http://localhost:8200
- **Elasticsearch**: http://localhost:9200

## Production Deployment

### 1. Hardware Sizing

```
Small Setup (< 10K events/sec):
- Master nodes: 1 x 2 CPU, 4GB RAM
- Data nodes: 2 x 4 CPU, 16GB RAM
- Logstash: 2 x 4 CPU, 8GB RAM
- Kibana: 1 x 2 CPU, 4GB RAM

Medium Setup (10K - 100K events/sec):
- Master nodes: 3 x 4 CPU, 8GB RAM
- Data nodes: 6 x 8 CPU, 32GB RAM
- Logstash: 4 x 8 CPU, 16GB RAM
- Kibana: 2 x 4 CPU, 8GB RAM
- Jaeger: 3 x 4 CPU, 8GB RAM

Large Setup (100K+ events/sec):
- Master nodes: 5 x 8 CPU, 16GB RAM
- Data nodes: 12 x 16 CPU, 64GB RAM
- Logstash: 8 x 16 CPU, 32GB RAM
- Kibana: 3 x 8 CPU, 16GB RAM
- Jaeger: 5 x 8 CPU, 16GB RAM
```

### 2. Docker Swarm/Kubernetes Deployment

#### Kubernetes Deployment

Create `monitoring-ns.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: elasticsearch-config
  namespace: monitoring
data:
  elasticsearch.yml: |
    cluster.name: ai-agent-cluster
    discovery.type: zen
    discovery.zen.ping.unicast.hosts: ["elasticsearch-0", "elasticsearch-1", "elasticsearch-2"]

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
  namespace: monitoring
spec:
  serviceName: elasticsearch
  replicas: 3
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
      - name: elasticsearch
        image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
        ports:
        - containerPort: 9200
          name: rest
        - containerPort: 9300
          name: inter-node
        env:
        - name: cluster.name
          value: ai-agent-cluster
        - name: ES_JAVA_OPTS
          value: -Xms2g -Xmx2g
        resources:
          limits:
            cpu: 1000m
            memory: 2Gi
          requests:
            cpu: 500m
            memory: 1Gi
        volumeMounts:
        - name: data
          mountPath: /usr/share/elasticsearch/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ReadWriteOnce]
      resources:
        requests:
          storage: 100Gi
```

### 3. SSL/TLS Configuration

Generate certificates:

```bash
# Create certificate directory
mkdir -p /etc/elasticsearch/certs

# Generate CA
openssl genrsa -out /etc/elasticsearch/certs/ca-key.pem 4096
openssl req -new -x509 -days 3650 -key /etc/elasticsearch/certs/ca-key.pem \
  -out /etc/elasticsearch/certs/ca.pem

# Generate certificates for each node
for i in 1 2 3; do
  openssl genrsa -out /etc/elasticsearch/certs/node-$i-key.pem 4096
  openssl req -new -key /etc/elasticsearch/certs/node-$i-key.pem \
    -out /etc/elasticsearch/certs/node-$i.csr \
    -subj "/CN=elasticsearch-$i"

  openssl x509 -req -days 3650 \
    -in /etc/elasticsearch/certs/node-$i.csr \
    -CA /etc/elasticsearch/certs/ca.pem \
    -CAkey /etc/elasticsearch/certs/ca-key.pem \
    -CAcreateserial \
    -out /etc/elasticsearch/certs/node-$i.pem
done

# Set permissions
chmod 600 /etc/elasticsearch/certs/*
```

Update docker-compose for SSL:

```yaml
elasticsearch:
  environment:
    - xpack.security.http.ssl.enabled=true
    - xpack.security.http.ssl.keystore.path=/usr/share/elasticsearch/config/certs/node.p12
    - xpack.security.http.ssl.keystore.password=changeme
  volumes:
    - /etc/elasticsearch/certs:/usr/share/elasticsearch/config/certs:ro
```

## Configuration Management

### 1. Logstash Pipeline Configuration

Create pipeline files in `monitoring/logstash/pipeline/`:

#### Standard Pipeline Structure

```
monitoring/logstash/pipeline/
├── 10-input.conf        # Input sources
├── 20-filter.conf       # Processing logic
├── 30-output.conf       # Output destinations
└── pipelines.yml        # Pipeline definitions
```

#### pipelines.yml

```yaml
- pipeline.id: main
  path.config: "/usr/share/logstash/pipeline/main.conf"
  queue.type: persisted
  queue.checkpoint.writes: 1
  queue.max_bytes: 1gb

- pipeline.id: security
  path.config: "/usr/share/logstash/pipeline/security.conf"
  queue.type: persisted

- pipeline.id: performance
  path.config: "/usr/share/logstash/pipeline/performance.conf"
  queue.type: persisted
```

### 2. Index Naming Convention

```
logs-{service}-{environment}-{date}
logs-ai-agent-production-2025.11.18
logs-rabbitmq-processor-staging-2025.11.18
```

### 3. Template Management

```bash
# Apply index templates
curl -X PUT "http://localhost:9200/_index_template/logs-template" \
  -H "Content-Type: application/json" \
  -d @monitoring/elasticsearch/logs-template.json

# Apply ILM policy
curl -X PUT "http://localhost:9200/_ilm/policy/logs-policy" \
  -H "Content-Type: application/json" \
  -d @monitoring/elasticsearch/ilm-policy.json

# Create initial index
curl -X PUT "http://localhost:9200/logs-ai-agent-production-2025.11.18"
```

## Health Checks & Validation

### 1. Elasticsearch Cluster Health

```bash
# Check cluster health
curl http://localhost:9200/_cluster/health?pretty

# Check node status
curl http://localhost:9200/_nodes/stats?pretty

# Check shard allocation
curl http://localhost:9200/_cat/shards?v

# Check indices
curl http://localhost:9200/_cat/indices?v&h=index,docs.count,store.size

# Check unassigned shards
curl http://localhost:9200/_cat/shards?v | grep UNASSIGNED
```

### 2. Logstash Health

```bash
# Check pipeline status
curl http://localhost:9600/api/v1/pipelines?pretty

# Check plugin metrics
curl http://localhost:9600/api/node/stats?pretty

# Monitoring API
curl http://localhost:9600/api/node/stats/jvm?pretty
```

### 3. Jaeger Health

```bash
# Check service availability
curl http://localhost:16686/api/services

# Query traces
curl "http://localhost:16686/api/traces?service=ai-agent-platform&limit=10"

# Check Jaeger agent
curl http://localhost:6831/metrics
```

### 4. APM Server Health

```bash
# Health check
curl http://localhost:8200/

# APM event intake
curl http://localhost:8200/intake/v2/events \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 5. Kibana Health

```bash
# Health endpoint
curl http://localhost:5601/api/status

# Check available indices
curl http://localhost:5601/api/index_patterns

# List installed plugins
curl http://localhost:5601/api/plugins
```

## Dashboards & Alerts

### 1. Import Pre-built Dashboards

```bash
# Import System Overview dashboard
curl -X POST "http://localhost:5601/api/saved_objects/dashboard" \
  -H "Content-Type: application/json" \
  -H "kbn-xsrf: true" \
  -d @monitoring/kibana/dashboards/dashboard-system-overview.json

# Import Application Performance dashboard
curl -X POST "http://localhost:5601/api/saved_objects/dashboard" \
  -H "Content-Type: application/json" \
  -H "kbn-xsrf: true" \
  -d @monitoring/kibana/dashboards/dashboard-app-performance.json
```

### 2. Configure Alerting

Create `monitoring/alerts/alert-rules.yml`:

```yaml
groups:
  - name: elasticsearch
    rules:
      - alert: ElasticsearchClusterRed
        expr: |
          count(elasticsearch_node_stats_node_info_node_id) == 0
        for: 2m
        annotations:
          summary: "Elasticsearch cluster is RED"
          description: "No Elasticsearch nodes available"

      - alert: ElasticsearchHighHeapUsage
        expr: |
          (elasticsearch_jvm_memory_used_bytes / elasticsearch_jvm_memory_max_bytes) > 0.8
        for: 5m
        annotations:
          summary: "High JVM heap usage"
          description: "JVM heap usage is above 80%"

  - name: logstash
    rules:
      - alert: LogstashPipelineStuck
        expr: |
          rate(logstash_pipeline_events_out_total[5m]) == 0
        for: 5m
        annotations:
          summary: "Logstash pipeline is stuck"

  - name: application
    rules:
      - alert: HighErrorRate
        expr: |
          (rate(apm_transactions_errors_total[5m]) / rate(apm_transactions_total[5m])) > 0.05
        for: 5m
        annotations:
          summary: "High error rate (>5%)"
```

### 3. Alerting Channels

Configure in `docker-compose.yml`:

```yaml
alertmanager:
  environment:
    - SLACK_WEBHOOK_URL=https://hooks.slack.com/...
    - PAGERDUTY_KEY=...
    - SMTP_HOST=smtp.gmail.com:587
    - SMTP_USER=your-email@gmail.com
    - SMTP_PASSWORD=app-password
```

## Scaling & Performance

### 1. Horizontal Scaling

```bash
# Scale Logstash
docker-compose -f docker-compose-full-monitoring.yml up -d --scale logstash=3

# Scale Elasticsearch data nodes
# Modify docker-compose to add elasticsearch-4, elasticsearch-5, etc.

# Scale Jaeger collector
docker-compose -f docker-compose-jaeger.yml up -d --scale jaeger-collector=2
```

### 2. Performance Tuning

```yaml
# Elasticsearch performance
elasticsearch:
  environment:
    - "ES_JAVA_OPTS=-Xms4g -Xmx4g"  # Increase heap
    - indices.memory.index_buffer_size=50%  # Increase indexing buffer
    - thread_pool.write.queue_size=10000

# Logstash performance
logstash:
  environment:
    - "LS_JAVA_OPTS=-Xmx2g -Xms2g"
    - LOGSTASH_WORKERS=8
    - LOGSTASH_BATCH_SIZE=2000
    - LOGSTASH_BATCH_DELAY=50

# Jaeger performance
jaeger-collector:
  environment:
    - COLLECTOR_NUM_WORKERS=20
    - COLLECTOR_QUEUE_SIZE=5000
```

### 3. Resource Monitoring

```bash
# Monitor Docker container resource usage
docker stats

# Monitor Elasticsearch cluster metrics
curl "http://localhost:9200/_nodes/stats?pretty" | jq '.nodes | .[] | {name: .name, jvm: .jvm.mem}'

# Monitor Logstash pipelines
curl "http://localhost:9600/api/v1/pipelines" | jq '.pipelines | .[] | {id: .id, events_in: .stats.events.in}'
```

## Troubleshooting

### Common Issues

#### 1. Elasticsearch - Out of Memory

```bash
# Check heap usage
curl "http://localhost:9200/_nodes/stats/jvm?pretty"

# Solution: Increase heap
ES_JAVA_OPTS=-Xms4g -Xmx4g

# Or reduce shard count
curl -X PUT "http://localhost:9200/logs-*/_settings" \
  -H "Content-Type: application/json" \
  -d '{"index": {"number_of_replicas": 0}}'
```

#### 2. Logstash - Dead Letter Queue Building Up

```bash
# Check DLQ
ls -lah /usr/share/logstash/dlq/

# View DLQ contents
tail -f /usr/share/logstash/dlq/dlq-*.log | jq .

# Solution: Fix filter issues and replay
docker exec logstash logstash-plugin list
```

#### 3. High Latency in Log Ingestion

```bash
# Reduce batch delay in Logstash
pipeline.batch.delay: 10ms
pipeline.batch.size: 2000

# Reduce index refresh interval
curl -X PUT "http://localhost:9200/logs-*/_settings" \
  -H "Content-Type: application/json" \
  -d '{"index": {"refresh_interval": "5s"}}'
```

#### 4. Jaeger - No Traces Appearing

```bash
# Check collector logs
docker logs jaeger-collector

# Verify connectivity
curl "http://localhost:14268/api/traces"

# Check Elasticsearch indices
curl "http://localhost:9200/_cat/indices?v" | grep jaeger
```

### Debugging Commands

```bash
# View service logs
docker-compose -f docker-compose-full-monitoring.yml logs -f elasticsearch-main
docker-compose -f docker-compose-full-monitoring.yml logs -f logstash
docker-compose -f docker-compose-full-monitoring.yml logs -f jaeger-collector
docker-compose -f docker-compose-full-monitoring.yml logs -f apm-server

# Enter service container
docker exec -it elasticsearch-main bash
docker exec -it logstash bash

# Check network connectivity
docker exec logstash curl http://elasticsearch-main:9200
docker exec jaeger-collector curl http://elasticsearch-jaeger:9200

# Check disk space
docker exec elasticsearch-main df -h /usr/share/elasticsearch/data
```

## Backup & Recovery

### 1. Elasticsearch Snapshots

```bash
# Create snapshot repository
curl -X PUT "http://localhost:9200/_snapshot/backup" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "fs",
    "settings": {
      "location": "/mnt/backups"
    }
  }'

# Create snapshot
curl -X PUT "http://localhost:9200/_snapshot/backup/snapshot-$(date +%s)"

# List snapshots
curl "http://localhost:9200/_snapshot/backup/_all?pretty"

# Restore from snapshot
curl -X POST "http://localhost:9200/_snapshot/backup/snapshot-123/_restore"
```

### 2. Logstash Persistent Queues

Logstash automatically persists queues:

```
/var/lib/docker/volumes/logstash-data/_data/queue/
```

Ensure adequate disk space and backups are taken regularly.

---

**Last Updated**: 2025-11-18
**Version**: 1.0 Enterprise Edition
