# PATTERN-C-003: Autonomous Multi-Agent Orchestration

**Version:** 6.0.0
**Date:** 2026-01-07
**Author:** Dr. Umit Kacar
**Status:** IMPLEMENTED & TESTED
**Dependencies:** PATTERN-C-001, PATTERN-C-002

---

## Executive Summary

PATTERN-C-003 solves the **Manual Intervention Problem** and **Circular Wait Deadlock** where agents wait indefinitely for each other without notification.

**Solution Evolution:**
- **v3:** iTerm2-based triggering (AppleScript)
- **v4:** Hybrid notification (Redis PRIMARY + Interrupt FALLBACK)
- **v5:** Two-phase wake check (catches PENDING signals) + Bidirectional wake
- **v6:** Stale wake cleanup + Task fallback + Session handshake protocol

---

## Quick Reference (MERKEZ)

> **TIP:** Günlük operasyonel kullanım için parent `workspace/docs/` klasörüne bakın:

| Document | Purpose | Lines |
|----------|---------|-------|
| [RAMAS-INDEX.md](../RAMAS-INDEX.md) | **MERKEZ** - Central navigation, quick start | ~250 |
| [PATTERN-C-003-v6.md](../PATTERN-C-003-v6.md) | v6 quick reference (condensed) | 159 |
| [MCP-TOOLS-REFERENCE.md](../MCP-TOOLS-REFERENCE.md) | 40+ tool signatures, patterns | 253 |
| [3-LEVEL-COMMUNICATION.md](../3-LEVEL-COMMUNICATION.md) | Emergency procedures, ESC stop | 215 |
| [CODEBASE-MAP.md](../CODEBASE-MAP.md) | File structure, component inventory | ~300 |

**This document (608 lines)** is for **deep dive** - full v1→v6 history, problem statements, implementation details.

---

## Version History

| Version | Date | Feature | Problem Solved |
|---------|------|---------|----------------|
| **v6** | 2026-01-07 | Stale wake cleanup + Task fallback + Handshake | Session not found + Task not found errors |
| **v5** | 2026-01-04 | Two-phase wake check + Bidirectional wake | Race condition where pending signals missed |
| **v4** | 2026-01-04 | Hybrid notification (Redis + Interrupt) | Circular wait deadlock between Leader/Workers |
| **v3** | 2026-01-03 | iTerm2 AppleScript triggering | Manual intervention required at each step |
| **v2** | 2026-01-02 | Session registry visibility | Agents couldn't see each other |
| **v1** | 2026-01-01 | Inbox file storage | MCP stateless connection problem |

---

## Problem Statement

### The Circular Wait Deadlock (v3 Problem)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CIRCULAR WAIT DEADLOCK (v3 Problem)                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Team Leader                                Workers                      │
│   ┌─────────────┐                           ┌─────────────┐              │
│   │ assign_task │─────────────────────────→ │             │              │
│   │             │                           │             │              │
│   │ wait_for_   │                           │ wait_for_   │              │
│   │ task()      │ ◄─── WAITING ────────────→│ task()      │              │
│   │             │                           │             │              │
│   │  ⏳ 30s     │                           │  ⏳ 30s     │              │
│   │  timeout!   │                           │  timeout!   │              │
│   └─────────────┘                           └─────────────┘              │
│                                                                           │
│   PROBLEM: Both sides WAIT for each other → DEADLOCK!                    │
│   assign_task() doesn't NOTIFY worker that task is ready.                │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### The Race Condition (v4 Problem)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    RACE CONDITION (v4 Problem)                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Timeline:                                                               │
│   0:00 - Team Leader: assign_task() + wake signal sent to Redis          │
│   0:01 - Wake signal arrives at ramas:wake:worker-001 stream             │
│   0:05 - Worker-001: starts wait_for_task() with "$" (new only)          │
│   0:05 - Worker reads stream from "$" → PENDING SIGNAL IGNORED!          │
│   0:35 - Worker timeout → Manual interrupt still needed                  │
│                                                                           │
│   ROOT CAUSE: wait_for_wake() used "$" which means "only NEW after now"  │
│   The pending signal was already in stream BEFORE worker started waiting │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Solution Architecture

### v5: Two-Phase Wake Check + Bidirectional Wake

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    PATTERN-C-003 v5 SOLUTION                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Team Leader                  Redis                 Workers              │
│   ┌─────────────┐          ┌─────────┐           ┌─────────────┐         │
│   │ assign_task │          │ STREAM  │           │             │         │
│   │     +       │─────────→│ XADD    │           │             │         │
│   │ notify_     │          │  ↓      │           │             │         │
│   │ worker()    │          │ PENDING │           │ wait_for_   │         │
│   │             │          │ signal  │           │ task()      │         │
│   │             │          │         │←──────────│ Phase 1:    │         │
│   │             │          │ FOUND!  │           │ XREAD "0"   │ ✅      │
│   │             │          │  ↓      │─────────→ │ (pending)   │         │
│   │             │          │ DELETE  │           │             │         │
│   │             │          └─────────┘           │ INSTANT     │         │
│   │             │                                │ WAKE!       │         │
│   │             │                                │             │         │
│   │             │          ┌─────────┐           │ process     │         │
│   │ wait_for_   │←─────────│ STREAM  │←──────────│ task        │         │
│   │ task()      │   ✅     │ XADD    │           │     +       │         │
│   │ (instant    │          │         │           │ broadcast() │         │
│   │  wake!)     │          └─────────┘           │             │         │
│   └─────────────┘                                └─────────────┘         │
│                                                                           │
│   KEY FEATURES:                                                          │
│   1. Two-phase wake: Check PENDING ("0") before blocking ("$")           │
│   2. Bidirectional wake: assign→worker AND result→team-leader            │
│   3. Inbox-based discovery: Uses actual inbox files, not session obj     │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. notify_worker() Helper (v4)

**Purpose:** Send wake signal with hybrid approach (Redis PRIMARY, Interrupt FALLBACK)

**Location:** `src/ramas/python/mcp_server.py`

```python
async def notify_worker(
    worker_id: str,
    session_id: str,
    task_id: str,
    task_title: str,
    notification_type: str = "task_assigned",
) -> Dict[str, Any]:
    """
    PATTERN-C-003 v4: Hybrid notification approach.

    STEP 1: Try Redis wake signal (PRIMARY)
       └─→ XADD to ramas:wake:{worker_id}
       └─→ wait_for_task() unblocks immediately

    STEP 2: If Redis fails → iTerm2 interrupt (FALLBACK)
       └─→ AppleScript sends message to terminal

    Returns:
        {
            "success": True/False,
            "method": "redis_wake" | "interrupt_fallback" | "none",
            "worker_id": "worker-001",
            "task_id": "task-123"
        }
    """
```

### 2. wait_for_wake() with Two-Phase Check (v5)

**Purpose:** Block until wake signal, catching PENDING signals first

**Location:** `src/ramas/python/redis_registry.py`

```python
async def wait_for_wake(
    self,
    agent_id: str,
    timeout_ms: int = 30000,
) -> Optional[Dict[str, Any]]:
    """
    PATTERN-C-003 v5: Two-phase approach to solve race condition.

    PHASE 1: Check PENDING signals first (non-blocking)
    ─────────────────────────────────────────────────────
    pending = await redis.xread(
        streams={stream_key: "0"},  # Read from BEGINNING
        block=0,                     # Non-blocking
        count=1,
    )
    if pending:
        return pending  # INSTANT return! No wait needed.

    PHASE 2: Block for NEW signals (if no pending)
    ─────────────────────────────────────────────────────
    result = await redis.xread(
        streams={stream_key: "$"},   # Only NEW from now
        block=timeout_ms,
        count=1,
    )

    This solves the race condition where Team Leader sends
    wake signal BEFORE worker starts waiting!
    """
```

### 3. Inbox-Based Participant Discovery (v5)

**Purpose:** Find registered agents reliably (not from session object)

**Location:** `src/ramas/python/session_inbox.py`

```python
def get_registered_agents_for_session(self, session_id: str) -> List[str]:
    """
    PATTERN-C-003 v5: Get agents from actual inbox files.

    Why not use session.participants?
    - Each agent has its OWN session object (not synced!)
    - Team Leader's session.participants may be empty
    - Workers register in their inbox files

    Solution: Scan all inbox files, check who registered for session.
    """
    registered = []
    for inbox_file in INBOX_DIR.glob("*.json"):
        agent_id = inbox_file.stem
        inbox = self.get_inbox(agent_id)
        if inbox.is_registered(session_id):
            registered.append(agent_id)
    return registered
```

---

## Bidirectional Wake (v5)

### Functions That Send Wake Signals

| Function | Notification Type | Who Gets Woken |
|----------|-------------------|----------------|
| `assign_session_task()` | `task_assigned` | Target worker only |
| `session_broadcast()` | `session_broadcast` | ALL registered agents |
| `session_message()` | `direct_message` | Target agent only |
| `report_task_completion()` | `task_completed` | ALL registered agents (especially Team Leader!) |

### Why Bidirectional Wake Matters

```
v4 (Unidirectional):
  Team Leader → Worker: ✅ Wake signal when task assigned
  Worker → Team Leader: ❌ No wake signal when result ready

  Result: Team Leader must poll or timeout to get results!

v5 (Bidirectional):
  Team Leader → Worker: ✅ Wake signal when task assigned
  Worker → Team Leader: ✅ Wake signal when result ready

  Result: INSTANT response cycle! No polling needed.
```

---

## Implementation Details

### File Locations

| File | Purpose |
|------|---------|
| `/tmp/ramas-session-inboxes/*.json` | Agent inbox files (PATTERN-C-001) |
| `src/ramas/python/redis_registry.py` | Redis Streams wake system (v5) |
| `src/ramas/python/session_inbox.py` | Inbox manager with participant discovery (v5) |
| `src/ramas/python/mcp_server.py` | MCP tools with notify_worker() (v4) |

### Redis Keys

| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `ramas:agents:{agent_id}` | HASH | Agent state (window_id, status, last_seen) |
| `ramas:wake:{agent_id}` | STREAM | Wake signals for agent |
| `ramas:sessions:{session_id}` | HASH | Session state |

### Critical: Enter Key for iTerm2

```python
# CRITICAL: Use \r (carriage return) NOT \n (newline)!

# WRONG - Session will HANG:
await session.async_send_text(command + "\n")  # \n = Shift+Enter

# CORRECT - Command executes:
await session.async_send_text(command)
await asyncio.sleep(1.0)
await session.async_send_text("\r")  # \r = Real Enter
```

---

## Deprecated Patterns

| Pattern | Status | Replacement |
|---------|--------|-------------|
| Manual polling every 10s | ⛔ DEPRECATED | `wait_for_task()` with Redis wake |
| Manual interrupt after assign | ⛔ DEPRECATED | Auto-notification via `notify_worker()` |
| `session.participants` for discovery | ⛔ DEPRECATED | `inbox_manager.get_registered_agents_for_session()` |
| `wait_for_wake(last_id="$")` | ⛔ DEPRECATED | Two-phase check (first "0", then "$") |
| Daemon-only message routing | ⛔ DEPRECATED | Hybrid: Daemon + Direct inbox write |

---

## Test Results (v5)

**Session:** `session-1767559560-45694086`
**Date:** 2026-01-04

| Metric | v3 (Manual) | v4 (Auto but race) | v5 (Fixed) |
|--------|-------------|---------------------|------------|
| Worker wake time | 30s+ timeout | 30s+ (race condition) | <1s instant |
| Team Leader wake time | Manual poll | Manual poll | <1s instant |
| Manual interrupts needed | 4+ per task | 0-2 per task | 0 |
| End-to-end latency | 60+ seconds | 35+ seconds | <15 seconds |

**Worker Results:**
- worker-001: 168 prime numbers (1-1000) ✅
- worker-002: 20 Fibonacci numbers with golden ratio ✅

**Wake Signals Verified:**
```bash
# Redis streams showed bidirectional wake
ramas:wake:worker-001  ← task_assigned from team-leader
ramas:wake:worker-002  ← task_assigned from team-leader
ramas:wake:team-leader ← task_completed from worker-001
ramas:wake:team-leader ← task_completed from worker-002
```

---

## Quick Reference

### Team Leader Workflow

```python
# 1. Register
register_agent(role="team-leader", name="team-leader")

# 2. Create session
session = create_session(sessionName="...", sessionType="task-coordination")

# 3. Assign tasks (AUTO-NOTIFIES workers!)
assign_session_task(
    sessionId=session.id,
    title="Compute primes",
    description="Find all primes 1-1000",
    assignTo="worker-001"
)
# Response includes: notification.method = "redis_wake" ✅

# 4. Wait for results (INSTANT wake when workers complete!)
result = wait_for_task(sessionId=session.id, timeoutMs=60000)
# result.woke = True when worker broadcasts result

# 5. Poll and aggregate
messages = poll_session_messages(sessionId=session.id)
```

### Worker Workflow

```python
# 1. Register
register_agent(role="worker", name="worker-001")

# 2. Wait for task (BLOCKS until Team Leader assigns!)
result = wait_for_task(sessionId="*", timeoutMs=60000)
# result.woke = True, result.event = "task_assigned"

# 3. Join session and poll
join_session(sessionId=result.data.session_id, agentRole="worker")
messages = poll_session_messages(sessionId=result.data.session_id)

# 4. Process task...

# 5. Broadcast result (AUTO-WAKES Team Leader!)
session_broadcast(
    sessionId=result.data.session_id,
    content="RESULT: [computed data]"
)
```

---

## v6: Stale Wake Cleanup + Task Fallback + Handshake Protocol

**Discovery Date:** 2026-01-07
**Discovery Method:** Collective Brainstorm (Team Leader + Worker-001 + Worker-002)

### v6 Problem #1: Stale Wake Signals

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    STALE WAKE SIGNAL PROBLEM (v5 Gap)                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Session #1 (CLOSED)              Session #2 (NEW)                      │
│   ┌─────────────────┐              ┌─────────────────┐                   │
│   │ Team Leader     │              │ Team Leader     │                   │
│   │ assign_task()   │              │ create_session  │                   │
│   │   ↓             │              │   ↓             │                   │
│   │ wake signal →   │              │                 │                   │
│   │ Redis stream    │              │                 │                   │
│   │ (session-old)   │              │                 │                   │
│   └─────────────────┘              └─────────────────┘                   │
│                                           ↑                              │
│                                    Worker reads OLD signal               │
│                                    tries to join session-old             │
│                                    "Session not found" ERROR!            │
│                                                                           │
│   ROOT CAUSE: Redis streams retain signals from old sessions             │
│   Worker reads stale signal, tries to join non-existent session          │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**v6 Solution: Clear Wake Streams on Session Creation**

```python
# redis_registry.py - New function
async def clear_wake_stream(self, agent_id: str) -> bool:
    """Clear all stale wake signals before new session"""
    stream_key = f"ramas:wake:{agent_id}"
    await self._redis.delete(stream_key)
    return True

# mcp_server.py - create_session now calls cleanup
async def handle_create_session(args):
    # v6: Clear stale wake streams FIRST
    for agent_id in expected_agents:
        await redis_registry.clear_wake_stream(agent_id)
    # Then create session...
```

### v6 Problem #2: Task Not Found

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    TASK NOT FOUND PROBLEM (v5 Gap)                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   MCP Instance #1                  MCP Instance #2                       │
│   ┌─────────────────┐              ┌─────────────────┐                   │
│   │ Team Leader     │              │ Worker          │                   │
│   │ assign_task()   │              │                 │                   │
│   │   ↓             │              │                 │                   │
│   │ task_id saved   │              │                 │                   │
│   │ in-memory dict  │              │ report_task_    │                   │
│   │                 │              │ completion()    │                   │
│   │                 │              │   ↓             │                   │
│   │                 │              │ "Task not found"│ ← Task dict empty!│
│   └─────────────────┘              └─────────────────┘                   │
│                                                                           │
│   ROOT CAUSE: Tasks stored in in-memory dict per MCP instance            │
│   Worker's MCP instance doesn't have Team Leader's task registry         │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**v6 Solution: Graceful Fallback to session_broadcast**

```python
# mcp_server.py - report_task_completion with fallback
async def handle_report_task_completion(args):
    completed = await session.complete_task(task_id, result)

    if not completed:
        # v6 FALLBACK: Broadcast result directly
        logger.warning(f"Task {task_id} not found, using fallback")
        await handle_session_broadcast({
            "sessionId": session_id,
            "content": f"TASK_RESULT_FALLBACK:{json.dumps(result)}",
            "messageType": "result",
        })
        return {"success": True, "fallback_used": True}

    return {"success": True, "taskId": task_id}
```

### v6 Problem #3: Session Initialization Race Condition

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    SESSION INIT RACE CONDITION (v5 Gap)                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Team Leader                                  Workers                    │
│   ───────────                                  ───────                    │
│       │                                           │                       │
│       │ create_session()                          │                       │
│       │ assign_task() immediately                 │ wait_for_task()       │
│       │───────────────────────────────────────────│                       │
│       │                                           │                       │
│       │                                    Worker MISSES session creation │
│       │                                    because it wasn't waiting yet! │
│       │                                           │                       │
│                                                                           │
│   ROOT CAUSE: No synchronization between session creation and workers    │
│   Workers may not be ready when Team Leader assigns tasks                │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

**v6 Solution: Session Handshake Protocol (MCP Tool)**

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    SESSION HANDSHAKE PROTOCOL (v6 Solution)               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   Team Leader                                  Workers                    │
│   ───────────                                  ───────                    │
│       │                                           │                       │
│       │ 1. create_session()                       │                       │
│       │                                           │                       │
│       │ 2. session_handshake(SESSION_READY)       │ wait_for_task()       │
│       │──────────────────────────────────────────→│ WAKES UP!             │
│       │                                           │                       │
│       │                                      3. join_session()            │
│       │                                           │                       │
│       │◄──────────────────────────────────────────│ 4. session_handshake  │
│       │    WORKER_READY from worker-001           │    (WORKER_READY)     │
│       │                                           │                       │
│       │◄──────────────────────────────────────────│ 4. session_handshake  │
│       │    WORKER_READY from worker-002           │    (WORKER_READY)     │
│       │                                           │                       │
│       │ 5. All workers ready!                     │                       │
│       │    Now safe to assign_task()              │                       │
│       │──────────────────────────────────────────→│                       │
│       │                                           │                       │
└──────────────────────────────────────────────────────────────────────────┘
```

**New MCP Tool: session_handshake**

```python
session_handshake(
    sessionId="session-xxx",
    handshakeType="SESSION_READY",  # or "WORKER_READY", "ACK"
    metadata={"expectedWorkers": 2}
)
```

### v6 Workflow Summary

```python
# Team Leader Workflow (v6)
register_agent(role="team-leader", name="team-leader")
session = create_session(sessionName="...", expectedWorkers=2)
# ↑ v6: Automatically clears stale wake streams

session_handshake(sessionId=session.id, handshakeType="SESSION_READY")
# Wait for WORKER_READY signals...

wait_for_task(sessionId=session.id)  # Wakes when workers ready
messages = poll_session_messages(sessionId=session.id)
# Count WORKER_READY messages...

# All workers ready → assign tasks
assign_session_task(sessionId=session.id, ...)

# Worker Workflow (v6)
register_agent(role="worker", name="worker-001")
result = wait_for_task(sessionId="*")  # Wakes on SESSION_READY

join_session(sessionId=result.sessionId, agentRole="worker")
session_handshake(sessionId=result.sessionId, handshakeType="WORKER_READY")

# Process task...
report_task_completion(sessionId=..., taskId=..., result=...)
# ↑ v6: Falls back to broadcast if task not found
```

---

## Related Patterns

| Pattern | Problem | Solution |
|---------|---------|----------|
| PATTERN-C-001 | MCP stateless connection | File-based inbox |
| PATTERN-C-002 | Session registry isolation | Shared session registry |
| **PATTERN-C-003** | **Manual intervention + Deadlock** | **Auto-wake with Redis Streams** |

---

## Debug Commands

```bash
# Check inbox files
ls -la /tmp/ramas-session-inboxes/

# View inbox contents
cat /tmp/ramas-session-inboxes/team-leader.json | python3 -m json.tool

# Check Redis wake streams
redis-cli -a redis123 XRANGE ramas:wake:worker-001 - +
redis-cli -a redis123 XRANGE ramas:wake:team-leader - +

# Monitor daemon logs
tail -f /tmp/ramas-daemon.log | grep -E "(wake|notify|PATTERN)"

# Check agent registry
redis-cli -a redis123 HGETALL ramas:agents:worker-001
```

---

*Last Updated: 2026-01-07*
*Pattern: PATTERN-C-003 v6 (Autonomous Multi-Agent Orchestration)*
*Status: Tested & Verified with stale wake cleanup + task fallback + handshake protocol*
