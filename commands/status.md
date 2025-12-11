---
description: Display real-time status of the multi-agent orchestration system
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [agents|queues|tasks|performance|alerts] [--detailed|--compact|--watch]
---

# Status - System Monitoring and Metrics

Display real-time status of the multi-agent orchestration system, including agents, queues, tasks, and performance metrics.

## Usage

```bash
/status [component] [options]
```

## Components

- `agents` - Show all agent statuses
- `queues` - Show queue metrics
- `tasks` - Show task statistics
- `performance` - Show performance metrics
- `alerts` - Show active alerts
- `workflow` - Show workflow status

## Options

- `--detailed` - Show detailed information
- `--compact` - Show minimal summary
- `--watch` - Continuously update display
- `--interval=<duration>` - Time period for metrics (e.g., 5m, 1h, 24h)
- `--export=<file>` - Export metrics to file

## Examples

### Overall System Status
```bash
/status
```

**Output:**
```
═══════════════════════════════════════════════════════
📊 MULTI-AGENT ORCHESTRATION SYSTEM
═══════════════════════════════════════════════════════

🤖 AGENTS
   Total: 5
   Connected: 4 ✅
   Disconnected: 1 ❌
   Active: 3 ⚙️
   Idle: 1 💤

📋 TASKS
   Queued: 12
   Active: 3
   Completed: 156 ✅
   Failed: 4 ❌

⚡ PERFORMANCE (last 5min)
   Tasks/min: 8.5
   Avg duration: 2.3s
   Success rate: 97.5%

🚨 ALERTS: 1 active

Last updated: 2025-11-17 19:45:32
═══════════════════════════════════════════════════════
```

### Agent Status
```bash
/status agents
```

**Output:**
```
🤖 AGENT STATUS

┌─────────────────┬──────────────┬────────┬──────────────┬────────────┐
│ Agent ID        │ Type         │ Status │ Tasks Done   │ Last Seen  │
├─────────────────┼──────────────┼────────┼──────────────┼────────────┤
│ team-leader-01  │ team-leader  │ ✅ UP  │ N/A          │ Just now   │
│ worker-01       │ worker       │ ⚙️ BUSY│ 45 (2 fail)  │ Just now   │
│ worker-02       │ worker       │ ⚙️ BUSY│ 52 (1 fail)  │ Just now   │
│ collaborator-01 │ collaborator │ 💤 IDLE│ 12 (0 fail)  │ Just now   │
│ worker-03       │ worker       │ ❌ DOWN│ 47 (1 fail)  │ 2m ago     │
└─────────────────┴──────────────┴────────┴──────────────┴────────────┘

Total: 5 agents (4 connected, 1 disconnected)
```

### Detailed Agent Status
```bash
/status agents --detailed
```

**Output:**
```
🤖 AGENT: worker-01
   Type: worker
   Status: ✅ ACTIVE
   Connected: 2h 15m ago
   Uptime: 99.5%

   📊 Statistics:
      Tasks received: 47
      Tasks completed: 45
      Tasks failed: 2
      Success rate: 95.7%
      Avg duration: 2.1s

   ⚙️ Current Task:
      ID: task-1234
      Title: "Implement authentication"
      Started: 45s ago
      Progress: Processing...

   🧠 Brainstorms:
      Participated: 8
      Responses sent: 8
      Avg response time: 12s
```

### Queue Status
```bash
/status queues
```

**Output:**
```
📋 QUEUE STATUS

┌─────────────────┬───────────┬───────────┬──────────┬─────────────┐
│ Queue Name      │ Messages  │ Consumers │ Rate/min │ Unacked     │
├─────────────────┼───────────┼───────────┼──────────┼─────────────┤
│ agent.tasks     │ 12        │ 3         │ 8.5      │ 3           │
│ agent.results   │ 0         │ 1         │ 8.2      │ 0           │
│ brainstorm.*    │ 0         │ 4         │ 1.2      │ 0           │
└─────────────────┴───────────┴───────────┴──────────┴─────────────┘

⚠️ agent.tasks: Queue depth growing (12 messages, only 3 consumers)
   Recommendation: Start additional workers
```

### Task Statistics
```bash
/status tasks
```

**Output:**
```
📋 TASK STATISTICS

Current:
   Queued: 12 tasks waiting
   Active: 3 tasks in progress

Historical (last 1 hour):
   Total: 85 tasks
   Completed: 82 ✅ (96.5%)
   Failed: 3 ❌ (3.5%)

By Priority:
   Critical: 2
   High: 25
   Normal: 45
   Low: 13

Recent Tasks:
   [Just now] ✅ Implement user authentication (worker-01, 45s)
   [1m ago]   ✅ Add caching layer (worker-02, 2.1s)
   [2m ago]   ❌ Deploy to production (worker-03, timeout)
   [3m ago]   ✅ Write unit tests (worker-01, 1.8s)
   [5m ago]   ✅ Update documentation (worker-02, 3.2s)
```

### Performance Metrics
```bash
/status performance
```

**Output:**
```
⚡ PERFORMANCE METRICS

Duration Statistics:
   Min: 0.5s
   Max: 45.2s
   Avg: 2.3s ⬆️ (+0.2s from baseline)
   Median: 1.8s
   P95: 5.1s
   P99: 12.3s

Throughput:
   Current: 8.5 tasks/min
   Peak: 15.2 tasks/min (at 14:30)
   Avg: 7.8 tasks/min

Success Rate:
   Overall: 97.5% ✅
   Last hour: 96.5% ⚠️
   Last 5min: 100% ✅

Bottlenecks Detected:
   ⚠️ Database tasks 3x slower than average
   ⚠️ worker-03 offline, reducing capacity by 25%

Recommendations:
   1. Investigate database performance
   2. Restart worker-03 or start new worker
   3. Consider adding caching for DB-heavy tasks
```

### Performance Over Time
```bash
/status performance --interval=1h
```

Shows metrics for the last hour with trend indicators.

### Compact Status
```bash
/status --compact
```

**Output:**
```
🟢 5 agents | 12 queued | 3 active | 156 done | 4 failed | 97.5% success
```

Perfect for status bars or quick checks.

### Watch Mode
```bash
/status --watch
```

Continuously updates display every 2 seconds. Press Ctrl+C to stop.

```
🔄 Auto-updating every 2s... (Press Ctrl+C to stop)

═══════════════════════════════════════════════════════
📊 MULTI-AGENT ORCHESTRATION SYSTEM
═══════════════════════════════════════════════════════
[Updates automatically...]
```

### Alert Status
```bash
/status alerts
```

**Output:**
```
🚨 ACTIVE ALERTS (3)

CRITICAL:
   ⛔ worker-03 disconnected
      Time: 2m ago
      Impact: 25% capacity reduction
      Action: Restart worker or start replacement

WARNING:
   ⚠️ High queue depth
      Queue: agent.tasks (24 messages)
      Consumers: 3
      Trend: Growing ↗️
      Action: Scale up workers

   ⚠️ Degraded performance
      Avg duration: 3.2s (baseline: 2.0s)
      Increase: +60%
      Action: Investigate recent changes

INFO:
   ℹ️ New agent connected
      Agent: worker-04
      Time: 30s ago
```

### Workflow Status
```bash
/status workflow
```

**Output:**
```
🔄 ACTIVE WORKFLOWS (2)

Workflow: feature-implementation-1234
   Status: ⚙️ IN PROGRESS
   Progress: Step 2 of 4 (50%)
   Started: 15m ago

   ✅ Step 1: Design (completed in 5m)
   ⚙️ Step 2: Implementation (in progress, 10m elapsed)
      ├─ ✅ Backend (worker-01, done)
      └─ ⚙️ Frontend (worker-02, active)
   ⏳ Step 3: Testing (pending)
   ⏳ Step 4: Deployment (pending)

Workflow: hotfix-5678
   Status: ⚠️ BLOCKED
   Progress: Step 1 of 3 (33%)
   Started: 5m ago

   ❌ Step 1: Database migration (failed)
      Error: Connection timeout
      Retries: 2/3
   ⏳ Step 2: Code deployment (waiting)
   ⏳ Step 3: Smoke tests (waiting)
```

## Export Metrics

### Export to File
```bash
/status --export=metrics.json
```

Creates JSON file with all metrics:

```json
{
  "timestamp": "2025-11-17T19:45:32Z",
  "agents": {
    "total": 5,
    "connected": 4,
    "byType": {
      "team-leader": 1,
      "worker": 3,
      "collaborator": 1
    }
  },
  "tasks": {
    "queued": 12,
    "active": 3,
    "completed": 156,
    "failed": 4
  },
  "performance": {
    "avgDuration": 2.3,
    "tasksPerMinute": 8.5,
    "successRate": 0.975
  }
}
```

### Export CSV
```bash
/status performance --export=performance.csv --interval=24h
```

Time-series data for external analysis.

## Real-Time Monitoring

### Dashboard in Dedicated Terminal
```bash
# Terminal 5 - Dedicated Monitor
/orchestrate monitor
/status --watch
```

Keep this terminal visible for continuous monitoring during orchestration.

### Status Checks During Work
```bash
# Terminal 1 - Team Leader
/assign-task title="Build feature"

# Quick check
/status --compact
# 🟢 5 agents | 1 queued | 1 active | ...

# Detailed check if needed
/status agents
```

## Historical Data

```bash
# Performance over last 24 hours
/status performance --interval=24h

# Task completion over last week
/status tasks --interval=7d

# Agent uptime over last month
/status agents --interval=30d
```

## Alerts and Thresholds

Automatic alerts triggered when:

- Agent disconnected unexpectedly
- Queue depth > 50 messages
- Performance degradation > 50%
- Task failure rate > 10%
- Worker unresponsive > 1 minute

Configure thresholds:

```bash
# In .env
ALERT_QUEUE_DEPTH=100
ALERT_FAILURE_RATE=0.15
ALERT_PERFORMANCE_DEGRADATION=0.5
```

## Integration with Monitoring Tools

Export to external monitoring:

```bash
# Prometheus
/status --export=prometheus --endpoint=http://prometheus:9090

# Grafana
/status --export=grafana --endpoint=http://grafana:3000

# DataDog
/status --export=datadog --api-key=$DD_API_KEY
```

## Troubleshooting

### Status not updating
```bash
# Check monitor agent is running
ps aux | grep monitor

# Restart monitor
/orchestrate monitor
```

### Metrics seem incorrect
```bash
# Reset metrics
/status --reset

# Recalculate
/status --recalculate
```

### Cannot see agent
```bash
# Agent may not be publishing status
# Check agent logs
# Restart agent with /orchestrate
```

## Best Practices

1. **Regular Monitoring**: Check status periodically during orchestration
2. **Dedicated Monitor**: Keep a monitor terminal visible
3. **Export Data**: Regularly export metrics for historical analysis
4. **Alert Response**: Act on alerts promptly
5. **Baseline Metrics**: Establish performance baselines
6. **Capacity Planning**: Use metrics to plan worker scaling

## See Also

- `/orchestrate monitor` - Start dedicated monitor agent
- `/alerts` - Detailed alert management
- `/metrics` - Advanced metrics analysis
