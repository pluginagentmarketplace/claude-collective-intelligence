# Infrastructure Operations Scripts

Operational scripts for system health monitoring, performance optimization, and analytics.

## Directory Structure

```
infrastructure/
├── health-check.sh          # Canonical health check (MAIN)
├── dashboard.sh             # Real-time monitoring dashboard
├── benchmark.sh             # Performance benchmarking
├── dr/                      # Disaster Recovery
│   ├── status-check.sh      # DR site status
│   └── failover.sh          # Failover to DR
├── optimize/                # Performance Optimization
│   ├── indexes.sh           # Database index optimization
│   ├── cache.sh             # Cache tuning
│   └── slow-queries.sh      # Slow query analysis
└── analytics/               # System Analytics
    ├── resource-usage.sh    # Resource usage analysis
    ├── cost-forecast.sh     # Cost forecasting
    └── opportunities.sh     # Optimization opportunities
```

---

## Core Scripts

### health-check.sh (CANONICAL)
**Purpose:** Comprehensive system health check
**This is the SINGLE source of truth for health checks!**

**Checks:**
- RabbitMQ connectivity and queue health
- PostgreSQL database health
- Redis cache health
- Disk space (warn at 80%, critical at 90%)
- Memory usage
- API endpoints responding
- Service processes running

**Exit Codes:**
- `0`: System healthy
- `1`: Warning (degraded but operational)
- `2`: Critical (immediate action required)

**Example:**
```bash
./health-check.sh
# ✅ RabbitMQ: Healthy (3 queues, 2 connections)
# ✅ PostgreSQL: Healthy (23 connections, 2ms avg query)
# ✅ Redis: Healthy (1.2GB used, 453ms avg response)
# ⚠️  Disk: 82% used (warning threshold)
# ✅ Memory: 45% used
#
# Overall: HEALTHY (1 warning)
```

**Automation:**
```bash
# Run every 5 minutes via cron
*/5 * * * * /path/to/health-check.sh >> /var/log/health.log 2>&1
```

---

### dashboard.sh
**Purpose:** Real-time monitoring dashboard
**Displays:**
- System metrics (CPU, memory, disk)
- RabbitMQ queue depth
- Active connections
- Recent errors
- Performance metrics

**Example:**
```bash
./dashboard.sh
# Opens real-time TUI dashboard
# Press 'q' to quit
```

---

### benchmark.sh
**Purpose:** Performance benchmarking
**Tests:**
- Message throughput (msgs/sec)
- Database query performance
- API response times
- Cache hit rates

**Example:**
```bash
./benchmark.sh
# Running performance benchmarks...
# Message throughput: 1,250 msgs/sec
# DB query avg: 15ms
# API p95 latency: 120ms
# Cache hit rate: 87%
```

---

## Disaster Recovery (dr/)

### dr/status-check.sh
**Purpose:** Check DR site status
**Verifies:**
- DR site reachable
- Data replication lag
- Backup recency
- DR services ready

**Example:**
```bash
./dr/status-check.sh
# ✅ DR site reachable
# ✅ Replication lag: 2 seconds
# ✅ Last backup: 15 minutes ago
# ✅ DR services: Ready
```

---

### dr/failover.sh
**Purpose:** Execute failover to DR site
**CRITICAL:** Only use during primary site failure!

**Actions:**
- Promote DR to primary
- Update DNS records
- Redirect traffic
- Notify team

**Example:**
```bash
./dr/failover.sh
# ⚠️  FAILOVER INITIATED
# Promoting DR to primary...
# ✅ Failover complete (RTO: 3m 45s)
```

---

## Performance Optimization (optimize/)

### optimize/indexes.sh
**Purpose:** Optimize database indexes
**Actions:**
- Analyze index usage
- Identify missing indexes
- Remove unused indexes
- Rebuild fragmented indexes

**Example:**
```bash
./optimize/indexes.sh
# Analyzing 47 indexes...
# ✅ 3 missing indexes created
# ✅ 2 unused indexes removed
# ✅ 5 indexes rebuilt
# Performance improvement: +23%
```

---

### optimize/cache.sh
**Purpose:** Redis cache tuning
**Actions:**
- Analyze cache hit rate
- Identify cache misses
- Adjust TTL values
- Evict stale entries

**Example:**
```bash
./optimize/cache.sh
# Current hit rate: 87%
# Optimizing cache policies...
# ✅ Hit rate improved to 92%
```

---

### optimize/slow-queries.sh
**Purpose:** Analyze and fix slow database queries
**Actions:**
- Identify queries > 1000ms
- Suggest optimization strategies
- Generate explain plans
- Recommend indexes

**Example:**
```bash
./optimize/slow-queries.sh
# Found 12 slow queries
# Top 3:
#   1. SELECT * FROM tasks (2,300ms) - Missing index on created_at
#   2. JOIN agents ON votes (1,800ms) - Table scan detected
#   3. COUNT(*) on messages (1,200ms) - Use cached counter
```

---

## System Analytics (analytics/)

### analytics/resource-usage.sh
**Purpose:** Analyze resource consumption patterns
**Generates:**
- CPU usage trends
- Memory consumption
- Disk I/O patterns
- Network bandwidth

**Example:**
```bash
./analytics/resource-usage.sh
# Resource usage analysis (last 7 days):
# CPU: Avg 45%, Peak 87% (Wed 14:00)
# Memory: Avg 6.2GB, Peak 8.1GB (Tue 10:30)
# Disk I/O: 120 MB/s avg, 340 MB/s peak
# Network: 45 Mbps avg, 180 Mbps peak
```

---

### analytics/cost-forecast.sh
**Purpose:** Infrastructure cost forecasting
**Analyzes:**
- Current resource usage
- Growth trends
- Cost projections (3/6/12 months)
- Optimization opportunities

**Example:**
```bash
./analytics/cost-forecast.sh
# Current monthly cost: $450
# 3-month forecast: $520 (+16%)
# 6-month forecast: $680 (+51%)
# Optimization potential: -$120/month (-27%)
```

---

### analytics/opportunities.sh
**Purpose:** Identify optimization opportunities
**Recommends:**
- Unused resources to remove
- Over-provisioned services to downsize
- Under-utilized capacity
- Cost-saving strategies

**Example:**
```bash
./analytics/opportunities.sh
# Found 8 optimization opportunities:
# 1. Redis over-provisioned by 40% - Save $45/month
# 2. 3 inactive agents consuming resources - Save $25/month
# 3. Database connection pool too large - Save $15/month
# Total potential savings: $120/month
```

---

## Monitoring Best Practices

### 1. Regular Health Checks
```bash
# Run health-check.sh every 5 minutes
*/5 * * * * /path/to/infrastructure/health-check.sh
```

### 2. Weekly Performance Audits
```bash
# Every Monday at 09:00
0 9 * * 1 /path/to/infrastructure/optimize/slow-queries.sh
0 9 * * 1 /path/to/infrastructure/analytics/resource-usage.sh
```

### 3. Monthly Cost Reviews
```bash
# First day of month at 08:00
0 8 1 * * /path/to/infrastructure/analytics/cost-forecast.sh
0 8 1 * * /path/to/infrastructure/analytics/opportunities.sh
```

### 4. Continuous Dashboard Monitoring
```bash
# Keep dashboard running in dedicated terminal
./infrastructure/dashboard.sh
```

---

## Troubleshooting

### Health Check Failing

**Symptom:** health-check.sh exits with code 2 (critical)

**Steps:**
1. Check which component failed:
   ```bash
   ./health-check.sh --verbose
   ```

2. For RabbitMQ issues:
   ```bash
   sudo systemctl status rabbitmq-server
   sudo rabbitmqctl status
   ```

3. For PostgreSQL issues:
   ```bash
   sudo systemctl status postgresql
   psql -c "SELECT pg_is_in_recovery();"
   ```

4. For disk space issues:
   ```bash
   df -h
   # Clean up if needed:
   ../backup/cleanup-old-backups.sh
   ```

### Performance Degradation

**Symptom:** benchmark.sh shows degraded performance

**Steps:**
1. Check slow queries:
   ```bash
   ./optimize/slow-queries.sh
   ```

2. Analyze resource usage:
   ```bash
   ./analytics/resource-usage.sh
   ```

3. Optimize indexes:
   ```bash
   ./optimize/indexes.sh
   ```

4. Tune cache:
   ```bash
   ./optimize/cache.sh
   ```

### DR Site Unreachable

**Symptom:** dr/status-check.sh fails

**CRITICAL:** Primary site has no backup!

**Immediate Actions:**
1. Alert DevOps team
2. Check network connectivity to DR site
3. Verify DR site services:
   ```bash
   ssh dr-server "systemctl status"
   ```
4. If DR site down, escalate to emergency procedures

---

## Integration with Monitoring Tools

### Prometheus Integration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'health-check'
    static_configs:
      - targets: ['localhost:9090']
    script: '/path/to/infrastructure/health-check.sh'
```

### Grafana Dashboards
- **System Health**: Real-time health-check.sh metrics
- **Performance**: benchmark.sh results over time
- **Cost Tracking**: cost-forecast.sh trends
- **DR Status**: dr/status-check.sh monitoring

---

## Security Considerations

1. **Credential Management:** All scripts use environment variables, never hardcoded credentials
2. **Audit Logging:** All script executions logged to `/var/log/infrastructure/`
3. **Access Control:** Only DevOps team should have execute permissions
4. **DR Secrets:** Failover credentials stored in encrypted vault only

---

*Last Updated: 2025-12-07*
*Part of Repository Reorganization Phase 1*
