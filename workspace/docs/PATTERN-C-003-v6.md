# PATTERN-C-003 v6 - Quick Reference

**Version:** 6.0.1 | **Updated:** 2026-01-08

---

## Overview

PATTERN-C-003 solves the **Manual Intervention Problem** and **Circular Wait Deadlock** in multi-agent orchestration.

---

## Solution Evolution

| Version | Feature | Problem Solved |
|---------|---------|----------------|
| **v6** | Stale wake cleanup + Task fallback + Handshake | Session/Task not found errors |
| v5 | Two-phase wake check + Bidirectional wake | Race condition (pending signals missed) |
| v4 | Hybrid notification (Redis + Interrupt) | Circular wait deadlock |
| v3 | iTerm2 AppleScript triggering | Manual intervention required |

---

## v6 Key Features

### 1. Stale Wake Cleanup
- `create_session()` automatically clears old wake signals
- Prevents "Session not found" errors from old sessions

### 2. Task Completion Fallback
- If task not found in memory, result is broadcasted directly
- Prevents "Task not found" errors

### 3. Session Handshake Protocol
```
Team Leader: session_handshake(type="SESSION_READY")
Workers:     session_handshake(type="WORKER_READY")
Team Leader: (waits for all workers) → assign_session_task()
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    PATTERN-C-003 v6 WORKFLOW                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Team Leader                              Workers            │
│  ───────────                              ───────            │
│       │                                       │              │
│       │ 1. create_session()                   │              │
│       │    (clears stale wake signals!)       │              │
│       │                                       │              │
│       │ 2. session_handshake(SESSION_READY)   │              │
│       │──────────────────────────────────────→│              │
│       │                                       │              │
│       │                          3. join_session()           │
│       │◀──────────────────────────────────────│              │
│       │    session_handshake(WORKER_READY)    │              │
│       │                                       │              │
│       │ 4. assign_session_task()              │              │
│       │──────────────────────────────────────→│              │
│       │    + notify_worker() → Redis XADD     │              │
│       │                                       │              │
│       │                          5. wait_for_task() wakes    │
│       │                             poll_session_messages()  │
│       │                             process task             │
│       │                                       │              │
│       │◀──────────────────────────────────────│              │
│       │ 6. session_broadcast(RESULT)          │              │
│       │    report_task_completion()           │              │
│       │    (fallback if task not found!)      │              │
│       │                                       │              │
│       │ 7. Aggregate results                  │              │
│       │                                       │              │
└─────────────────────────────────────────────────────────────┘
```

---

## Notification Methods

| Method | When Used | Latency |
|--------|-----------|---------|
| **Redis XADD** | PRIMARY - Always tried first | <100ms |
| **interrupt_worker** | FALLBACK - If Redis fails | ~500ms |

### Response Example

```json
{
  "success": true,
  "taskId": "abc-123",
  "notification": {
    "success": true,
    "method": "redis_wake",
    "message": "Redis wake signal delivered"
  }
}
```

---

## Two-Phase Wake (v5+)

Workers use two-phase check to catch PENDING signals:

```python
# PHASE 1: Check for pending signals (non-blocking)
pending = await redis.xread(streams={key: "0"}, block=0)
if pending:
    return pending  # INSTANT return!

# PHASE 2: Block for new signals
result = await redis.xread(streams={key: "$"}, block=timeout)
```

---

## Bidirectional Wake (v5+)

Both directions now send wake signals:

| Event | Who Wakes |
|-------|-----------|
| `assign_session_task()` | Workers wake |
| `session_broadcast()` | Team Leader wakes |
| `report_task_completion()` | Team Leader wakes |

---

## Debug Commands

```bash
# Check Redis wake streams
redis-cli -a redis123 XRANGE ramas:wake:worker-001 - +
redis-cli -a redis123 XRANGE ramas:wake:team-leader - +

# Check inbox files
ls -la /tmp/ramas-session-inboxes/

# Monitor daemon logs
tail -f /tmp/ramas-daemon.log | grep -E "(wake|notify|v6)"
```

---

## ⚠️ MCP Server Hot-Reload (CRITICAL!)

**Added:** 2026-01-08 | **Discovery:** datetime import bug persisted despite code fix!

### MCP Server Does NOT Hot-Reload!

```
PROBLEM PATTERN:
1. Edit mcp_server.py
2. Save file
3. Run RAMAS command
4. OLD CODE STILL RUNS! ❌
```

**Root Cause:**
- MCP server runs as subprocess of Claude Code
- Subprocess loads code at startup
- File changes NOT automatically picked up

### Solution: Full Restart Required

```bash
# After ANY edit to mcp_server.py:
make ramas-shutdown    # Not stop-all!
sleep 3
claude                 # Fresh subprocess loads NEW code
```

### Local Import Pattern (Workaround)

For critical functions, use local imports:

```python
# SAFER - Local import inside function
async def handle_session_handshake(...):
    import json
    from datetime import datetime  # Local import!
    timestamp = datetime.now().isoformat()
```

This bypasses subprocess caching issues.

---

## Related Documentation

**workspace/docs/ (MERKEZ):**
- [RAMAS-INDEX.md](RAMAS-INDEX.md) - Central navigation, quick start
- [CODEBASE-MAP.md](CODEBASE-MAP.md) - File structure, component inventory
- [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md) - 40+ tool signatures
- [3-LEVEL-COMMUNICATION.md](3-LEVEL-COMMUNICATION.md) - Emergency procedures

**architecture/ (Deep Dive):**
- [Full PATTERN-C-003 Specification](architecture/PATTERN-C-003-Autonomous-Orchestration.md) - v1→v6 history, 608 lines
- [PATTERN-C-002-Session-Registry](architecture/PATTERN-C-002-Session-Registry.md) - Registry pattern

---

*Pattern: PATTERN-C-003 v6 | Status: Production Ready | MERKEZ: workspace/docs/*
