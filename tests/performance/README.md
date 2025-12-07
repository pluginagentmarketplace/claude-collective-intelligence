# K6 Performance Testing Scripts

Production-grade performance testing framework for the multi-agent orchestration system.

## Overview

This directory contains comprehensive K6 performance test scripts for testing:

1. **Load Testing** - Gradual ramp from 10 to 1000 req/sec
2. **Spike Testing** - Sudden 5x load increase and recovery
3. **Soak Testing** - 30-minute sustained load for leak detection
4. **Scenario Testing** - Specific agent system scenarios

## Quick Start

### Prerequisites

```bash
# Install K6
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo apt-get install k6

# Windows
choco install k6
# OR download from https://k6.io/docs/getting-started/installation/
```

### Run Tests

**Linux/macOS:**
```bash
./run-all.sh
```

**Windows (PowerShell):**
```powershell
.\run-all.ps1
```

**Individual Tests:**
```bash
# Load test
k6 run load-test.js

# Spike test
k6 run spike-test.js

# Soak test
k6 run soak-test.js
```

## Test Files

### `load-test.js`

**Purpose:** Find system capacity through gradual load increase

**Profile:**
- Duration: 15 minutes
- Ramp pattern: 10 → 50 → 100 → 500 → 1000 VUs
- Phases: Warm-up → Low → Medium → High → Peak → Cool-down

**Metrics:**
- Response time (P50/P95/P99)
- Throughput (req/sec)
- Error rate
- Agent task latency
- Database query latency
- Cache hit ratio
- RabbitMQ latency

**Targets:**
- P95 response time < 500ms (critical)
- Throughput > 1000 req/sec
- Error rate < 0.1%

### `spike-test.js`

**Purpose:** Test system resilience to traffic spikes

**Profile:**
- Duration: 10 minutes
- Pattern: 2 min normal → 3 min spike (5x) → 5 min recovery

**Metrics:**
- Latency during spike
- Error rate during spike
- Recovery time
- Memory usage changes
- Queue depth monitoring

**Targets:**
- P95 latency < 1000ms during spike
- Error rate < 5% during spike
- Recovery within 5 minutes

### `soak-test.js`

**Purpose:** Detect memory leaks and performance degradation

**Profile:**
- Duration: 30 minutes
- Load: 50 VUs (sustained)
- Periodic health checks every 100 iterations

**Metrics:**
- Memory growth over time
- GC pause duration
- Connection pool health
- Cache hit ratio stability
- Error rate consistency

**Targets:**
- No linear memory growth (< 100MB total)
- Error rate < 1% over 30 min
- Connection pool < 80% utilization

### `common.js`

Shared utilities for all tests:
- Duration parsing
- Statistics calculation
- Payload generation
- Performance metrics definitions
- Environment configuration

## Usage

### Basic Test Run

```bash
k6 run load-test.js
```

### With Custom Configuration

```bash
# Set API base URL
k6 run -e API_BASE_URL=https://api.example.com load-test.js

# Set custom VU and duration
k6 run -u 100 -d 5m load-test.js

# Enable verbose output
k6 run -e VERBOSE=true load-test.js
```

### Generate JSON Results

```bash
k6 run --out json=results.json load-test.js
```

### Run Multiple Tests in Sequence

```bash
# Using provided scripts
./run-all.sh                    # Linux/macOS
.\run-all.ps1                   # Windows

# Custom sequence
k6 run --out json=load.json load-test.js
k6 run --out json=spike.json spike-test.js
k6 run --out json=soak.json soak-test.js
```

## Environment Variables

Configure tests via environment variables:

```bash
# API Configuration
API_BASE_URL=http://localhost:3000

# Test Configuration
DURATION=15m
VERBOSE=true
TEST_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=orchestrator_test

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
```

Example:
```bash
API_BASE_URL=https://api.example.com k6 run load-test.js
```

## Results Analysis

### View Results

Results are saved to JSON format:

```bash
# Run test with results
k6 run --out json=results.json load-test.js

# Parse results (requires jq)
cat results.json | jq '.metrics'
```

### Compare with Baseline

```bash
# Compare against baseline
node ../benchmarks/compare.js results.json

# Generate HTML report
node ../benchmarks/compare.js results.json --baseline ../benchmarks/baseline.json
```

## Performance Targets

### Response Time SLA

| Metric | Target |
|--------|--------|
| P50 | < 100ms |
| **P95** | **< 500ms** (critical) |
| P99 | < 2000ms |
| Max | < 5000ms |

### Throughput SLA

| Metric | Target |
|--------|--------|
| Minimum | > 1000 req/sec |
| Target | > 2000 req/sec |
| Peak | > 5000 req/sec |

### Error Rate SLA

| Scenario | Target |
|----------|--------|
| Normal | < 0.1% |
| High load | < 1% |
| Spike | < 5% |

### Resource SLA

| Resource | Target |
|----------|--------|
| Memory per worker | < 500MB |
| CPU usage | < 80% |
| DB connections | < 80% pool |
| RabbitMQ latency | < 100ms (P95) |

## Test Scenarios

### Agent Task Distribution (1000 concurrent)

Tests task distribution to agents:
- Task enqueue latency: P95 < 100ms
- Processing latency: P95 < 500ms
- Agent availability: > 99.9%

### Voting Consensus (100 agents)

Tests voting system:
- Vote submission: P95 < 200ms
- Consensus time: < 5 seconds
- Accuracy: 100%

### Database CRUD (10K operations)

Tests database performance:
- Insert latency: P95 < 50ms
- Batch throughput: > 2000 ops/sec
- Connection utilization: < 80%

### Cache Performance (10K requests)

Tests caching:
- Cache hit ratio: > 80%
- Redis latency: P95 < 5ms
- Memory footprint: < 500MB

## Troubleshooting

### Error: Too Many Open Files

```bash
# Increase file descriptor limit (Linux/macOS)
ulimit -n 65536

# Verify
ulimit -a
```

### Error: Connection Timeout

```bash
# Check if service is running
netstat -an | grep LISTEN

# Test connectivity
curl http://localhost:3000/health
```

### Error: Out of Memory

- Reduce VU count
- Reduce test duration
- Check for response body accumulation
- Monitor system resources: `top`, `iostat`

### Inconsistent Results

- Eliminate background processes
- Use same hardware for baselines
- Repeat tests 3+ times
- Average results for analysis

## Integration with CI/CD

### GitHub Actions

```yaml
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: grafana/setup-k6-action@v1
      - run: k6 run k6-scripts/load-test.js --out json=results.json
      - uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: results.json
```

### Docker

```bash
docker run -v $(pwd)/k6-scripts:/scripts \
           -e API_BASE_URL=http://host.docker.internal:3000 \
           grafana/k6:latest \
           run /scripts/load-test.js
```

## Monitoring During Tests

### Real-time Metrics

K6 provides real-time output:

```
█ load-test.js
  scenarios: (100.00%) 1000 max VUs, 15m30s max duration
  http_reqs....................: 900000  1541.5/s
  http_req_duration.............: avg=647ms p(95)=1.5s
  iterations....................: 900000  1541.5/s
```

### System Monitoring (parallel terminal)

```bash
# Monitor CPU/Memory
top

# Monitor disk I/O
iotop

# Monitor network
nethogs

# Monitor processes
ps aux | grep -E "node|k6|postgres|redis"
```

## Best Practices

1. **Warm-up Phase:** Tests include warm-up to stabilize metrics
2. **Realistic Data:** Use realistic payload sizes and patterns
3. **Baseline Comparison:** Compare against previous baselines
4. **Multiple Runs:** Run tests 3+ times for consistency
5. **Isolated Environment:** Test in isolated environment
6. **Gradual Ramp:** Ramp gradually to avoid cascading failures
7. **Thresholds:** Define clear performance criteria
8. **Analysis:** Investigate anomalies and regressions

## Performance Baselines

Baselines are defined in `../benchmarks/baseline.json`:

```json
{
  "responseTime": {
    "p95": 500,      // Critical SLA
    "p99": 2000
  },
  "throughput": 1000,        // req/sec minimum
  "errorRate": 0.1,          // %
  "memory": 500              // MB per worker
}
```

## Further Reading

- [K6 Documentation](https://k6.io/docs/)
- [Performance Testing Guide](../PERFORMANCE_TESTING_GUIDE.md)
- [Performance Report](../performance-report.md)
- [K6 Best Practices](https://k6.io/docs/testing-guides/load-testing/)
- [RabbitMQ Performance](https://www.rabbitmq.com/blog/2012/04/25/rabbitmq-performance-measurements-v2-0/)
- [PostgreSQL Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)

## File Structure

```
k6-scripts/
├── load-test.js          # Gradual load increase test
├── spike-test.js         # Traffic spike test
├── soak-test.js          # 30-minute sustained load test
├── common.js             # Shared utilities
├── run-all.sh            # Test runner (Linux/macOS)
├── run-all.ps1           # Test runner (Windows)
├── README.md             # This file
└── examples/
    └── custom-test.js    # Example custom test
```

## Support

For issues or questions:

1. Check K6 logs: `k6 run --logformat json script.js > logs.json`
2. Enable verbose mode: `VERBOSE=true k6 run script.js`
3. Review error messages
4. Check system resources: `top`, `free`, `df`
5. Consult K6 documentation

## License

Part of the multi-agent orchestration system. See main LICENSE file.

---

**Version:** 1.0.0
**Last Updated:** 2024-11-18
**Maintained By:** Performance Testing Team
