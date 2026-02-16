# Performance Testing - Quick Start Guide

## 5-Minute Setup

### 1. Install K6

```bash
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo apt-get install k6

# Windows
choco install k6
# OR download: https://k6.io/docs/getting-started/installation/
```

### 2. Run Load Test

```bash
# Quick load test
npm run perf:load

# Or directly
k6 run k6-scripts/load-test.js
```

### 3. View Results

Results appear in console output and are saved to `reports/` directory.

---

## Available Commands

### Individual Tests

```bash
# Load Test (15 min) - Find system capacity
npm run perf:load
k6 run k6-scripts/load-test.js

# Spike Test (10 min) - Test resilience to traffic spikes
npm run perf:spike
k6 run k6-scripts/spike-test.js

# Soak Test (30 min) - Find memory leaks and degradation
npm run perf:soak
k6 run k6-scripts/soak-test.js
```

### Run All Tests

```bash
# Linux/macOS
npm run perf:all
./k6-scripts/run-all.sh

# Windows
.\k6-scripts\run-all.ps1
```

### Compare Results

```bash
# Compare with baseline
npm run perf:compare
node benchmarks/compare.js results.json

# Generate HTML report
node benchmarks/compare.js results.json --baseline benchmarks/baseline.json
```

---

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| **P95 Response Time** | **< 500ms** | ✓ Critical SLA |
| Throughput | > 1000 req/sec | ✓ Minimum |
| Error Rate | < 0.1% | ✓ Normal ops |
| Memory/Worker | < 500MB | ✓ Limit |

---

## What Gets Tested

### Load Test (k6-scripts/load-test.js)
- **Duration:** 15 minutes
- **Load:** 10 → 1000 concurrent users
- **Measures:** Response time, throughput, errors, memory, DB connections
- **Target:** Find system capacity

### Spike Test (k6-scripts/spike-test.js)
- **Duration:** 10 minutes
- **Pattern:** 2 min normal → 3 min spike (5x) → 5 min recovery
- **Measures:** Spike impact, recovery time, error rate
- **Target:** Test resilience

### Soak Test (k6-scripts/soak-test.js)
- **Duration:** 30 minutes
- **Load:** Sustained 50 VUs
- **Measures:** Memory growth, connection pool, cache hit ratio
- **Target:** Find memory leaks

---

## Example Output

```
scenarios: (100.00%) 1000 max VUs, 15m30s max duration

✓ data_received..................: 1.2 GB  1.3 MB/s
✓ data_sent........................: 180 MB  193 kB/s
✓ http_reqs.........................: 900000  1541/s
✓ http_req_duration.................: avg=647ms   p(95)=450ms  ← CRITICAL
✓ http_req_failed..................: 0       0%       ← CRITICAL

Status: All thresholds passed ✓
```

---

## Configuration

### Environment Variables

```bash
# API Configuration
API_BASE_URL=http://localhost:3000

# Test Options
DURATION=15m
VERBOSE=true

# Database
DB_HOST=localhost
DB_PORT=5432
```

### Example with Custom Settings

```bash
API_BASE_URL=https://api.example.com k6 run k6-scripts/load-test.js
```

---

## Troubleshooting

### "Too Many Open Files" Error

```bash
# Increase file descriptor limit
ulimit -n 65536
k6 run k6-scripts/load-test.js
```

### Connection Timeout

```bash
# Check if service is running
curl http://localhost:3000/health

# Check network
ping localhost
```

### Out of Memory

- Reduce VU count: `k6 run -u 50 ...`
- Reduce duration: `k6 run -d 5m ...`
- Monitor: `top` or `free -h`

---

## Monitoring During Tests

### Option 1: Console Output (Real-time)
K6 provides live metrics in terminal

### Option 2: External Monitor
```bash
# Terminal 2: Monitor system resources
top          # macOS/Linux
htop         # Linux (better)
Get-Process  # Windows
```

### Option 3: Cloud (Grafana)
```bash
k6 cloud k6-scripts/load-test.js  # Requires LoadImpact account
```

---

## Performance Baselines

**Production-grade baseline established:**

```json
{
  "responseTime": {
    "p50": 95,
    "p95": 450,      // Critical - monitor this!
    "p99": 1850,
    "max": 4200
  },
  "throughput": 1541,         // req/sec
  "errorRate": 0.1,           // %
  "memory": {
    "initial": 250,
    "final": 320,
    "growth": 70                // MB
  }
}
```

See `benchmarks/baseline.json` for full baseline.

---

## File Structure

```
Performance Testing Framework:
├── PERFORMANCE_TESTING_GUIDE.md        # Comprehensive guide
├── PERFORMANCE_TESTING_QUICKSTART.md   # This file
├── performance-report.md               # Sample report
│
├── k6-scripts/
│   ├── load-test.js                   # Load testing (15 min)
│   ├── spike-test.js                  # Spike testing (10 min)
│   ├── soak-test.js                   # Soak testing (30 min)
│   ├── common.js                      # Shared utilities
│   ├── example-custom-test.js         # Template
│   ├── run-all.sh                     # Test runner (Linux/macOS)
│   ├── run-all.ps1                    # Test runner (Windows)
│   └── README.md                      # K6 scripts guide
│
└── benchmarks/
    ├── baseline.json                  # Baseline metrics
    └── compare.js                     # Comparison tool
```

---

## Common Commands Cheat Sheet

```bash
# 1. Run single test
k6 run k6-scripts/load-test.js

# 2. Run with custom VUs and duration
k6 run -u 100 -d 5m k6-scripts/load-test.js

# 3. Save results
k6 run --out json=results.json k6-scripts/load-test.js

# 4. Run all tests
npm run perf:all

# 5. Compare with baseline
npm run perf:compare

# 6. View test file
cat k6-scripts/load-test.js

# 7. Get K6 version
k6 version

# 8. Get K6 help
k6 help run
```

---

## Integration with CI/CD

### GitHub Actions
```yaml
- run: npm run perf:load
  with:
    API_BASE_URL: http://localhost:3000
```

### Docker
```bash
docker run -v $(pwd):/workspace grafana/k6 run /workspace/k6-scripts/load-test.js
```

---

## Next Steps

1. **First Run:** `npm run perf:load` (15 min)
2. **Review Results:** Check console output and HTML report
3. **Compare:** `npm run perf:compare` vs baseline
4. **Full Suite:** `npm run perf:all` (55 min total)
5. **Custom Tests:** Use `k6-scripts/example-custom-test.js` as template
6. **Automate:** Add to CI/CD pipeline

---

## Resources

- **K6 Docs:** https://k6.io/docs/
- **Full Guide:** See `PERFORMANCE_TESTING_GUIDE.md`
- **Sample Report:** See `performance-report.md`
- **K6 Community:** https://community.k6.io/

---

## Key Metrics Explained

| Metric | What It Means | Target |
|--------|---------------|--------|
| **P95** | 95% of requests faster than this | < 500ms |
| **Throughput** | Requests per second | > 1000 |
| **Error Rate** | % of failed requests | < 0.1% |
| **Memory** | RAM usage per worker | < 500MB |

---

**Version:** 1.0.0
**Last Updated:** 2024-11-18
**Status:** Production-Ready
