# Performance Testing Guide - K6 Framework

## Overview

This guide provides comprehensive performance testing for the multi-agent orchestration system. We use K6 for load testing, benchmarking, and performance analysis across multiple scenarios.

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Test Scenarios](#test-scenarios)
4. [Performance Targets](#performance-targets)
5. [Running Tests](#running-tests)
6. [Analyzing Results](#analyzing-results)
7. [Best Practices](#best-practices)

## Installation

### Prerequisites

- Node.js >= 18.0.0
- K6 binary installed (https://k6.io/docs/getting-started/installation/)
- RabbitMQ running locally or accessible
- PostgreSQL running locally or accessible
- Redis running locally or accessible

### Install K6

```bash
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo apt-get install k6

# Windows
choco install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

### Install K6 JavaScript modules

```bash
# Install required K6 modules
npm install --save-dev k6
```

## Configuration

### Environment Variables

Create a `.env.test` file for performance testing configuration:

```env
# RabbitMQ Configuration
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/

# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=orchestrator_test
DB_USER=postgres
DB_PASSWORD=postgres

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Test Configuration
API_BASE_URL=http://localhost:3000
TEST_ENV=performance
VERBOSE=true
```

### K6 Configuration

Default configuration is in each test file. Key parameters:

- **Virtual Users (VUs)**: Number of concurrent users/agents
- **Duration**: How long the test runs
- **Ramp-up**: Gradual increase in load
- **Thresholds**: Performance criteria that must be met

## Test Scenarios

### 1. Load Test (`load-test.js`)

Gradually increases load to find system capacity.

**Profile:**
- Ramp up from 10 → 100 → 1000 req/sec
- Duration: 15 minutes total
- Phases: Warm-up (2 min) → Steady (5 min) → Peak (5 min) → Cool-down (3 min)

**Measures:**
- P50/P95/P99 response times
- Error rate at each load level
- RabbitMQ message latency
- Database connection pool utilization

**Use Case:** Determine maximum sustainable load

### 2. Spike Test (`spike-test.js`)

Sudden 5x increase in load to test resilience.

**Profile:**
- Normal load: 100 req/sec
- Spike load: 500 req/sec (5x)
- Duration: 10 minutes
- Phases: Normal (2 min) → Spike (3 min) → Recovery (5 min)

**Measures:**
- How system handles sudden load spikes
- Recovery time to normal performance
- Memory usage under spike
- Error rate during spike

**Use Case:** Test system resilience and auto-scaling

### 3. Soak Test (`soak-test.js`)

Long-duration test to find memory leaks and degradation.

**Profile:**
- Sustained load: 200 req/sec
- Duration: 30 minutes
- Single VU with continuous requests

**Measures:**
- Memory growth over time
- GC pause duration
- Connection pool health
- Cache hit/miss ratios over time

**Use Case:** Detect memory leaks, connection pool issues

### 4. Test Scenarios

#### Scenario A: Agent Task Distribution (1000 concurrent)

Tests the orchestrator's ability to distribute tasks to agents.

```
Test: Distribute 1000 concurrent tasks
Measure:
  - Task enqueue latency (P95 < 100ms)
  - Task processing latency (P95 < 500ms)
  - Queue message rate
  - Agent availability
```

#### Scenario B: Voting Consensus (100 agents voting)

Tests the voting system under concurrent voting.

```
Test: 100 agents voting on 50 proposals
Measure:
  - Vote submission latency
  - Vote counting accuracy
  - Consensus achievement time
  - Database write performance
```

#### Scenario C: Database CRUD Operations (10K inserts)

Tests database performance under bulk operations.

```
Test: Insert 10,000 records
Measure:
  - Insert latency (P95 < 50ms per insert)
  - Batch operation efficiency
  - Connection pool saturation
  - Transaction throughput
```

#### Scenario D: Cache Performance (hits/misses)

Tests caching effectiveness.

```
Test: 10,000 requests with varying cache hit rates
Measure:
  - Cache hit ratio
  - Cache miss penalty
  - Redis latency
  - Memory footprint
```

## Performance Targets

### Response Time SLAs

| Metric | Target | Action |
|--------|--------|--------|
| P50 Response Time | < 100ms | Optimize if exceeded |
| P95 Response Time | < 500ms | **Critical - Must meet** |
| P99 Response Time | < 2000ms | Investigate if exceeded |
| Max Response Time | < 5000ms | Severe performance issue |

### Throughput SLAs

| Metric | Target | Action |
|--------|--------|--------|
| Minimum Throughput | > 1000 req/sec | Scale horizontally |
| Target Throughput | > 2000 req/sec | Good performance |
| Peak Throughput | > 5000 req/sec | Ideal state |

### Error Rate SLAs

| Metric | Target | Action |
|--------|--------|--------|
| Normal Operations | < 0.1% errors | Critical threshold |
| High Load | < 1% errors | Acceptable temporarily |
| Spike Load | < 5% errors | Acceptable during spike |

### Resource Utilization

| Resource | Per Worker | Action |
|----------|-----------|--------|
| Memory | < 500MB | Monitor growth |
| CPU | < 80% | Investigate hotspots |
| DB Connections | < 80% pool | Tune pool size |
| RabbitMQ Prefetch | 10-100 | Tune per scenario |

## Running Tests

### Quick Start

```bash
# Load test
k6 run k6-scripts/load-test.js

# Spike test
k6 run k6-scripts/spike-test.js

# Soak test
k6 run k6-scripts/soak-test.js
```

### With Custom Configuration

```bash
# Set VUs and duration
k6 run -u 100 -d 5m k6-scripts/load-test.js

# With custom options
k6 run -e API_BASE_URL=https://api.example.com \
       -e DB_HOST=db.example.com \
       k6-scripts/load-test.js
```

### Continuous Integration

```bash
# Run all tests with thresholds
npm run test:performance

# Generate HTML report
k6 run --out json=results.json k6-scripts/load-test.js
k6-merge results.json > combined.json
k6-html-reporter -i combined.json -o reports/
```

### Docker Execution

```bash
# Run K6 in Docker
docker run -v /home/user/plugin-ai-agent-rabbitmq/k6-scripts:/scripts \
           -e API_BASE_URL=http://host.docker.internal:3000 \
           grafana/k6:latest \
           run /scripts/load-test.js
```

## Analyzing Results

### Metrics Collected

#### HTTP Metrics
- `http_req_duration`: Total request duration
- `http_req_waiting`: Time to first byte
- `http_req_connecting`: Connection establishment time
- `http_req_tls_handshaking`: TLS handshake time
- `http_req_sending`: Request sending time
- `http_req_receiving`: Response receiving time

#### RabbitMQ Metrics
- `rabbitmq_publish_latency`: Time to publish message
- `rabbitmq_consume_latency`: Time to consume message
- `rabbitmq_queue_length`: Current queue depth
- `rabbitmq_ack_latency`: ACK latency

#### Database Metrics
- `db_query_duration`: Query execution time
- `db_connection_pool_size`: Current pool connections
- `db_transaction_duration`: Transaction time

#### Custom Metrics
- `agent_task_latency`: Task distribution latency
- `voting_latency`: Vote processing latency
- `cache_hit_ratio`: Cache effectiveness

### Result Analysis

#### Expected Output

```
scenarios: (100.00%) 1 scenario, 1000 max VUs, 15m30s max duration (includes 30s graceful stop)

data_received..................: 1.2 GB  1.3 MB/s
data_sent........................: 180 MB  193 kB/s
http_inflight....................: 0       0/s
http_reqs.........................: 900000  1541/s
http_req_blocked..................: avg=124µs   min=0s     med=9µs    max=8.3s   p(90)=14µs   p(95)=23µs
http_req_connecting...............: avg=122µs   min=0s     med=0s     max=8.3s   p(90)=0s     p(95)=0s
http_req_duration.................: avg=647ms   min=0s     med=450ms  max=12s    p(90)=1.1s   p(95)=1.5s    ← Target: P95 < 500ms
http_req_receiving................: avg=3.2ms   min=0s     med=3ms    max=15ms   p(90)=5ms    p(95)=6ms
http_req_sending..................: avg=150µs   min=0s     med=50µs   max=600ms  p(90)=100µs  p(95)=200µs
http_req_tls_handshaking..........: avg=0s      min=0s     med=0s     max=0s     p(90)=0s     p(95)=0s
http_req_waiting..................: avg=644ms   min=0s     med=447ms  max=12s    p(90)=1.1s   p(95)=1.5s
http_reqs_rate....................: 1541/s  ← Target: > 1000 req/sec
rabbitmq_publish_latency..........: avg=45ms    min=1ms    med=40ms   max=500ms  p(95)=85ms
rabbitmq_queue_length.............: avg=245     min=0      med=220    max=1200
vus_max...........................: 1000     100%
```

### Red Flags

- **P95 > 500ms**: Investigate bottleneck (DB, cache, RabbitMQ)
- **Error rate > 0.1%**: Check logs for failure patterns
- **Memory growing linearly**: Possible memory leak
- **Queue length growing**: Consumer lag, scale consumers
- **Connection pool exhausted**: Increase pool size or reduce connections

## Best Practices

### 1. Test Environment Setup

- Use dedicated test database (not production)
- Reset state between test runs
- Monitor background processes
- Ensure stable network conditions
- Isolate test environment from other workloads

### 2. Test Design

- Warm up system before measuring
- Use realistic test data
- Test both happy and sad paths
- Include think time between requests
- Test edge cases and limit conditions

### 3. Test Execution

- Run tests multiple times for consistency
- Test during off-peak hours if using shared resources
- Monitor system metrics in parallel
- Capture detailed logs for failures
- Save baseline results for comparison

### 4. Analysis

- Compare against previous baselines
- Identify performance regressions
- Investigate anomalies
- Document findings and recommendations
- Track improvements over time

### 5. Scaling Considerations

| VU Count | Use Case |
|----------|----------|
| 1-10 | Sanity check, endpoint validation |
| 10-100 | Normal load testing |
| 100-1000 | Stress testing, capacity planning |
| 1000+ | Breaking point analysis |

## Troubleshooting

### Issue: Too Many Open Files

```bash
# Increase file descriptor limit
ulimit -n 65536

# Verify
ulimit -a
```

### Issue: Connection Timeout

```bash
# Check if service is running
netstat -an | grep LISTEN

# Verify network connectivity
ping host
telnet host port
```

### Issue: Memory Out of Bounds

- Reduce VU count
- Reduce test duration
- Check for response body accumulation
- Enable K6 garbage collection

### Issue: Inconsistent Results

- Eliminate background processes
- Ensure consistent network conditions
- Use same hardware/VM for baselines
- Repeat tests 3+ times
- Average results for analysis

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Performance Tests

on: [push, pull_request]

jobs:
  performance-test:
    runs-on: ubuntu-latest
    services:
      rabbitmq:
        image: rabbitmq:3-management
      postgres:
        image: postgres:15
      redis:
        image: redis:7

    steps:
      - uses: actions/checkout@v3
      - uses: grafana/setup-k6-action@v1
      - run: k6 run k6-scripts/load-test.js
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: k6-scripts/load-test.js
```

## Resources

- [K6 Documentation](https://k6.io/docs/)
- [K6 Best Practices](https://k6.io/docs/testing-guides/load-testing/)
- [RabbitMQ Performance](https://www.rabbitmq.com/blog/2012/04/25/rabbitmq-performance-measurements-v2-0/)
- [PostgreSQL Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Performance](https://redis.io/topics/benchmarks)

## Support

For issues or questions:
1. Check K6 logs: `k6 run --logformat json script.js > logs.json`
2. Enable verbose mode: `VERBOSE=true k6 run script.js`
3. Monitor system resources: `top`, `iotop`, `nethogs`
4. Review application logs

---

**Last Updated:** 2024-11-18
**Version:** 1.0.0
