# RAMAS Task Coordination Guide

**Version:** 1.0.0
**Date:** 2026-01-01
**Author:** Dr. Umit Kacar

## Overview

This guide documents the **Pattern 2: RabbitMQ Result Queue** implementation for multi-agent task coordination in RAMAS (Reactive Agent Messaging & Automation System).

### Problem Statement

When multiple Claude Code agents work on subtasks:
- How does the Team Leader distribute tasks?
- How do Workers receive tasks automatically?
- How are results collected without message collision?
- How does aggregation happen when all workers complete?

### Solution: Pattern 2 (RabbitMQ Result Queue)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TASK COORDINATION FLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐                                                  │
│   │ Team Leader  │                                                  │
│   │   (You)      │                                                  │
│   └──────┬───────┘                                                  │
│          │                                                          │
│          │ 1. dispatch_tasks()                                      │
│          ▼                                                          │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │   RabbitMQ   │     │   RabbitMQ   │     │   RabbitMQ   │       │
│   │ tasks.worker │     │ tasks.worker │     │   results.   │       │
│   │     -001     │     │     -002     │     │ team-leader  │       │
│   └──────┬───────┘     └──────┬───────┘     └──────▲───────┘       │
│          │                    │                    │                │
│          │ 2. Daemon          │ 2. Daemon          │                │
│          │    routes          │    routes          │                │
│          ▼                    ▼                    │                │
│   ┌──────────────┐     ┌──────────────┐           │                │
│   │  Worker-001  │     │  Worker-002  │           │                │
│   │ (Claude Code)│     │ (Claude Code)│           │                │
│   │              │     │              │           │                │
│   │ Prime Numbers│     │  Fibonacci   │           │                │
│   └──────┬───────┘     └──────┬───────┘           │                │
│          │                    │                    │                │
│          │ 3. Write result    │ 3. Write result   │                │
│          │    to /tmp/        │    to /tmp/       │                │
│          │                    │                    │                │
│          └────────────────────┴────────────────────┘                │
│                                                                      │
│   4. Test script polls /tmp/ for result files                       │
│   5. Aggregates: primes ∩ fibonacci = [2, 3, 5, 13, 89, 233]       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Architecture

### New Components

| Component | File | Description |
|-----------|------|-------------|
| `EXCHANGES.TASKS` | `exchanges.py` | Direct exchange for task distribution |
| `EXCHANGES.RESULTS` | `exchanges.py` | Direct exchange for result collection |
| `QUEUES.task_queue()` | `exchanges.py` | Per-worker task inbox |
| `QUEUES.RESULTS_QUEUE` | `exchanges.py` | Team Leader result inbox |
| `TaskCoordinator` | `task_coordinator.py` | Task orchestration class |
| `WorkerAgent` | `task_coordinator.py` | Worker task handler class |
| `handle_task_message()` | `daemon.py` | Routes tasks to iTerm2 |

### RabbitMQ Topology

```
Exchanges:
├── agent.ramas.status (fanout)     # Status broadcast [existing]
├── agent.ramas.interrupt (direct)  # Interrupt routing [existing]
├── agent.ramas.push (topic)        # Push notifications [existing]
├── agent.ramas.tasks (direct)      # Task distribution [NEW]
└── agent.ramas.results (direct)    # Result collection [NEW]

Queues:
├── ramas.status.updates            # Status listener [existing]
├── ramas.interrupts                # Interrupt listener [existing]
├── ramas.tasks.team-leader         # Team Leader task inbox [NEW]
├── ramas.tasks.worker-001          # Worker-001 task inbox [NEW]
├── ramas.tasks.worker-002          # Worker-002 task inbox [NEW]
└── ramas.results.team-leader       # Result aggregation [NEW]
```

## Usage

### Quick Start

```bash
# 1. Launch 3 iTerm2 windows
python scripts/ramas/python/launch_windows.py

# 2. Start daemon (in background)
python -m src.ramas.python.daemon &

# 3. Run task coordination test
python scripts/ramas/python/test_task_coordination.py
```

### Programmatic Usage

```python
from src.ramas.python import exchanges

async def main():
    connection = await exchanges.connect()
    channel = await connection.channel()

    # Setup exchanges
    await exchanges.setup_exchanges(channel)

    # Dispatch task to worker
    await exchanges.publish_task(
        channel=channel,
        worker_id="worker-001",
        task_id="task-001",
        task_type="prime_numbers",
        task_params={"max_value": 1000},
        from_leader="team-leader",
    )

    await connection.close()
```

## Message Formats

### Task Message

```json
{
    "taskId": "task-1767290433-worker-001",
    "workerId": "worker-001",
    "taskType": "prime_numbers",
    "params": {
        "max_value": 1000,
        "worker_id": "worker-001"
    },
    "fromLeader": "team-leader",
    "timestamp": 1767290433000
}
```

### Result Message

```json
{
    "taskId": "task-1767290433-worker-001",
    "workerId": "worker-001",
    "success": true,
    "result": {
        "numbers": [2, 3, 5, 7, ...],
        "count": 168
    },
    "error": null,
    "timestamp": 1767290445000
}
```

## Task Types

### `prime_numbers`

Finds all prime numbers up to `max_value`.

**Params:**
- `max_value` (int): Upper limit for search

**Result:**
- `numbers` (list): All prime numbers found
- `count` (int): Total count

### `fibonacci`

Finds all Fibonacci numbers less than `max_value`.

**Params:**
- `max_value` (int): Upper limit

**Result:**
- `numbers` (list): All Fibonacci numbers found
- `count` (int): Total count

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DETAILED MESSAGE FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. TEST SCRIPT                                                      │
│     │                                                                │
│     ├─► publish_task(worker-001, prime_numbers, {max: 1000})        │
│     └─► publish_task(worker-002, fibonacci, {max: 1000})            │
│                                                                      │
│  2. RABBITMQ                                                         │
│     │                                                                │
│     ├─► agent.ramas.tasks exchange                                  │
│     ├─► routes to ramas.tasks.worker-001                            │
│     └─► routes to ramas.tasks.worker-002                            │
│                                                                      │
│  3. DAEMON                                                           │
│     │                                                                │
│     ├─► listen_task_messages() receives task                        │
│     ├─► handle_task_message() formats prompt                        │
│     ├─► controller.interrupt_and_message() sends to iTerm2          │
│     └─► Uses \r (carriage return) for proper ENTER                  │
│                                                                      │
│  4. CLAUDE CODE (in iTerm2)                                          │
│     │                                                                │
│     ├─► Receives: "GÖREV [task-id]: Python ile 1'den 1000'e..."     │
│     ├─► Processes task                                               │
│     └─► Writes result to /tmp/result_{task_id}.json                 │
│                                                                      │
│  5. TEST SCRIPT                                                      │
│     │                                                                │
│     ├─► Polls /tmp/ for result files                                │
│     ├─► Reads both results                                          │
│     ├─► Calculates intersection: primes ∩ fibonacci                 │
│     └─► Saves report to /tmp/task_coordination_report.json          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Critical Bug Fixes

### ENTER Key Issue

**Problem:** `\n` sends Shift+Enter in Claude Code, not Enter.

**Solution:** Use `\r` (carriage return) instead:

```python
# WRONG - Shift+Enter
await session.async_send_text(text + "\n")

# CORRECT - Real Enter
await session.async_send_text(text)
await asyncio.sleep(1.0)  # Wait for buffer
await session.async_send_text("\r")  # Carriage return
```

**Location:** `controller.py` - `send_command_reliable()`, `send_message()`, `interrupt_and_message()`

### Message Collision Prevention

**Problem:** Two workers complete at different times - messages could collide.

**Solution:** RabbitMQ queue naturally serializes messages:
- Messages wait in queue until consumer is ready
- ACK ensures message is processed before next
- No additional locking needed

## Test Results

### Integration Test (2026-01-01)

| Metric | Value |
|--------|-------|
| Workers | 2 (worker-001, worker-002) |
| Prime Numbers Found | 168 |
| Fibonacci Numbers Found | 17 |
| Intersection | [2, 3, 5, 13, 89, 233] |
| Intersection Count | 6 |
| Test Duration | ~15 seconds |
| Status | ✅ PASSED |

### Expected Intersection

Numbers that are both prime AND Fibonacci (< 1000):
- **2** - Prime ✅, Fibonacci ✅
- **3** - Prime ✅, Fibonacci ✅
- **5** - Prime ✅, Fibonacci ✅
- **13** - Prime ✅, Fibonacci ✅
- **89** - Prime ✅, Fibonacci ✅
- **233** - Prime ✅, Fibonacci ✅

## Files Reference

### Source Files

```
src/ramas/python/
├── exchanges.py          # RabbitMQ topology + publish functions
├── task_coordinator.py   # TaskCoordinator + WorkerAgent classes
├── daemon.py            # Updated with task queue listeners
├── controller.py        # iTerm2 API (with \r fix)
└── registry.py          # Worker registry
```

### Script Files

```
scripts/ramas/python/
├── launch_windows.py           # Launch 3 iTerm2 windows
├── test_task_coordination.py   # Integration test
├── interrupt_worker.py         # CLI interrupt tool
├── update_title.py            # CLI status tool
└── shutdown_demo.py           # Safe shutdown
```

## Troubleshooting

### Tasks Not Received

1. Check daemon is running: `ps aux | grep daemon`
2. Check daemon log: `tail -f /tmp/ramas-daemon.log`
3. Check RabbitMQ queues: http://localhost:15672

### ENTER Not Working

1. Ensure using `\r` not `\n`
2. Check controller.py has the fix
3. Restart daemon after code changes

### Results Not Collected

1. Check Claude Code actually processed task
2. Look for `/tmp/result_*.json` files
3. Check file format matches expected JSON

## Team Leader Flow (Full Pattern 2)

### Overview

The **complete Pattern 2** implementation allows Team Leader to orchestrate the entire workflow using MCP tools:

```
┌──────────────┐    interrupt     ┌──────────────┐
│   External   │ ──────────────▶  │ Team Leader  │
│   Script     │     (urgent)     │   (Claude)   │
└──────────────┘                  └──────┬───────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │ dispatch_subtask         │ dispatch_subtask         │
              │ (MCP Tool)               │ (MCP Tool)               │
              ▼                          │                          ▼
       ┌──────────────┐                  │                   ┌──────────────┐
       │  Worker-001  │                  │                   │  Worker-002  │
       │ (prime_nums) │                  │                   │ (fibonacci)  │
       └──────┬───────┘                  │                   └──────┬───────┘
              │ write result             │                          │ write result
              ▼                          │                          ▼
       /tmp/result_*                     │                    /tmp/result_*
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         │ collect + aggregate
                                         │ (MCP Tools)
                                         ▼
                              ┌──────────────────────┐
                              │ Final Result:        │
                              │ [2, 3, 5, 13, 89, 233] │
                              └──────────────────────┘
```

### MCP Tools for Team Leader

| Tool | Description | When to Use |
|------|-------------|-------------|
| `dispatch_subtask` | Send task to specific worker via RabbitMQ | Splitting main task |
| `collect_results` | Collect results from /tmp/ files | After workers complete |
| `aggregate_results` | Compute intersection/union/merge | Final aggregation |

### Test Script

```bash
# Run the Team Leader flow test
python scripts/ramas/python/test_team_leader_flow.py
```

### Sample Team Leader Task

When Team Leader receives a main task via interrupt:

```markdown
## GÖREV: Multi-Agent Sayı Analizi

1. dispatch_subtask kullan worker-001'e:
   - workerId: "worker-001"
   - taskType: "prime_numbers"
   - params: {"max_value": 1000}

2. dispatch_subtask kullan worker-002'ye:
   - workerId: "worker-002"
   - taskType: "fibonacci"
   - params: {"max_value": 1000}

3. collect_results ile sonuçları topla

4. aggregate_results ile kesişimi hesapla
```

### Test Results (2026-01-01)

| Step | Duration | Status |
|------|----------|--------|
| Main task → Team Leader | <1s | ✅ |
| Team Leader dispatch → Workers | ~2s | ✅ |
| Workers complete | ~45s | ✅ |
| Collect + Aggregate | ~10s | ✅ |
| **Total** | **~60s** | **✅ PASSED** |

### Final Result

```json
{
  "task": "Find numbers that are both Prime AND Fibonacci (1-1000)",
  "team_leader": "NumberAnalysis-TeamLeader",
  "workers": {
    "worker-001": {"taskType": "prime_numbers", "result": "168 prime numbers found"},
    "worker-002": {"taskType": "fibonacci", "result": "17 fibonacci numbers found"}
  },
  "aggregation": {
    "operation": "intersection",
    "result": [2, 3, 5, 13, 89, 233],
    "count": 6
  }
}
```

### Key Differences from Basic Pattern 2

| Aspect | Basic Pattern 2 | Full Pattern 2 (Team Leader) |
|--------|-----------------|------------------------------|
| Task Source | External script | Team Leader Claude |
| Dispatch Method | Direct via Python | MCP `dispatch_subtask` tool |
| Aggregation | External script | MCP `aggregate_results` tool |
| Autonomy | Script-driven | Agent-driven |

## Future Improvements

1. **Result via RabbitMQ**: Workers publish results to queue instead of files
2. **Timeout Handling**: Auto-retry failed tasks
3. **Progress Tracking**: Real-time progress via WebSocket
4. **Task History**: Store completed tasks in database
5. **Dashboard**: Web UI for monitoring
6. **Dynamic Task Splitting**: Team Leader decides how to split based on task complexity

## Related Documentation

- [RAMAS-GUIDE.md](./RAMAS-GUIDE.md) - Main RAMAS documentation
- [MCP-SERVER-GUIDE.md](./MCP-SERVER-GUIDE.md) - MCP tool usage
- [README.md](../../src/ramas/python/README.md) - Python implementation

---

**Pattern 2 Implementation: Complete and Tested!** ✅
