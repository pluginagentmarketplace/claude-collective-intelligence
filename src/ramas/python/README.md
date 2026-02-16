# RAMAS Python Implementation

**Version:** 3.5.0 (PATTERN-C-003 v6 + Terminal Configuration)
**Date:** 2026-01-07
**Author:** Dr. Umit Kacar

---

## Overview

Complete Python implementation of RAMAS (Reactive Agent Messaging & Automation System) with PATTERN-C-003 v6 autonomous multi-agent orchestration.

**Key Features:**
- **Bidirectional Wake Signals** - Team Leader ↔ Workers instant notification
- **Two-Phase Wake Check** - Catches PENDING signals (race condition fix)
- **Redis Streams** - Sub-100ms wake latency (no polling!)
- **40+ MCP Tools** - Full session, task, and meeting management
- **Stale Wake Cleanup (v6)** - Clears old session signals on create_session
- **Task Fallback (v6)** - Graceful broadcast if task not found
- **Session Handshake (v6)** - SESSION_READY / WORKER_READY protocol

---

## Module Overview

```
src/ramas/python/
├── __init__.py              # Package exports
├── mcp_server.py            # MCP Server (2500+ lines, 40+ tools)
├── daemon.py                # Status daemon (async, RabbitMQ listener)
├── controller.py            # iTerm2 Python API controller
├── registry.py              # Window registry (JSON-based)
├── exchanges.py             # RabbitMQ topology
├── task_coordinator.py      # Task distribution
│
├── # Pattern C Modules (Session-Based Architecture)
├── session_manager.py       # Core session lifecycle (1125 lines)
├── session_state.py         # State machine (11 states, 28 events)
├── session_messages.py      # Message types (7 types)
├── session_inbox.py         # File-based inbox (PATTERN-C-001 + v5)
├── session_registry.py      # Shared registry (PATTERN-C-002)
│
├── # Pattern C-003 v6: Autonomous Multi-Agent Orchestration
├── redis_registry.py        # Redis Streams wake system (v6 + stale cleanup)
├── agent_trigger.py         # iTerm2 session triggering (500+ lines)
├── workflow_engine.py       # Workflow state management (430+ lines)
│
└── requirements.txt         # Dependencies
```

---

## PATTERN-C-003 v6: Autonomous Multi-Agent Orchestration

### Version History

| Version | Date | Feature | Problem Solved |
|---------|------|---------|----------------|
| **v6** | 2026-01-07 | Stale cleanup + Task fallback + Handshake | Session/Task not found errors |
| **v5** | 2026-01-04 | Two-phase wake + Bidirectional | Race condition + Team Leader not waking |
| **v4** | 2026-01-04 | Hybrid notification | Circular wait deadlock |
| **v3** | 2026-01-03 | iTerm2 triggering | Manual intervention at each step |

### v5 Architecture

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
│   KEY v5 FEATURES:                                                       │
│   1. Two-phase wake: Check PENDING ("0") before blocking ("$")           │
│   2. Bidirectional wake: assign→worker AND result→team-leader            │
│   3. Inbox-based discovery: Uses actual inbox files, not session obj     │
│   4. Hybrid notification: Redis PRIMARY + Interrupt FALLBACK             │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Core v5 Components

#### 1. Two-Phase Wake Check (`redis_registry.py`)

```python
async def wait_for_wake(self, agent_id: str, timeout_ms: int = 30000):
    """
    PATTERN-C-003 v5: Two-phase approach to solve race condition.
    """
    stream_key = f"ramas:wake:{agent_id}"

    # PHASE 1: Check PENDING signals first (non-blocking)
    pending = await redis.xread(
        streams={stream_key: "0"},  # Read from BEGINNING
        block=0,                     # Non-blocking
        count=1,
    )
    if pending:
        # Found pending signal! Return immediately
        await redis.xdel(stream_key, message_id)  # Cleanup
        return pending  # INSTANT return!

    # PHASE 2: Block for NEW signals (if no pending)
    result = await redis.xread(
        streams={stream_key: "$"},   # Only NEW from now
        block=timeout_ms,
        count=1,
    )
    return result
```

#### 2. Hybrid Notification (`mcp_server.py`)

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
    """
    # STEP 1: Try Redis wake signal (PRIMARY - <100ms latency)
    try:
        redis_registry = await get_redis_registry()
        if redis_registry.is_connected:
            wake_success = await redis_registry.publish_wake(
                agent_id=worker_id,
                event_type=notification_type,
                data={"session_id": session_id, "task_id": task_id, ...},
            )
            if wake_success:
                return {"success": True, "method": "redis_wake"}
    except Exception:
        pass  # Fallback to interrupt

    # STEP 2: Fallback to iTerm2 interrupt (SECONDARY)
    interrupt_result = await handle_interrupt_worker({
        "workerId": worker_id,
        "message": f"TASK ASSIGNED: {task_title}",
        "priority": "normal",
    })
    return {"success": True, "method": "interrupt_fallback"}
```

#### 3. Inbox-Based Participant Discovery (`session_inbox.py`)

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

#### 4. Bidirectional Wake (Functions That Send Wake Signals)

| Function | Notification Type | Who Gets Woken |
|----------|-------------------|----------------|
| `assign_session_task()` | `task_assigned` | Target worker only |
| `session_broadcast()` | `session_broadcast` | ALL registered agents |
| `session_message()` | `direct_message` | Target agent only |
| `report_task_completion()` | `task_completed` | ALL registered agents |

---

## Pattern C Modules

### Architecture

| Module | Purpose | Lines | Key Features |
|--------|---------|-------|--------------|
| `mcp_server.py` | MCP tools + notify_worker | 2500+ | 40+ tools, v4/v5 wake integration |
| `redis_registry.py` | Redis Streams wake system | 570+ | Two-phase wake, agent state |
| `session_manager.py` | Core session lifecycle | 1125 | Participant tracking, task management |
| `session_state.py` | State machine | 514 | 11 states, 28 events |
| `session_messages.py` | Message types | 470 | 7 message types, factory pattern |
| `session_inbox.py` | File-based inbox | 500+ | PATTERN-C-001 + v5 discovery |
| `session_registry.py` | Shared registry | 393 | PATTERN-C-002 fix |

### Session State Machine

```
INITIALIZING ──► WAITING_FOR_WORKERS ──► ACTIVE ──► CLOSING ──► CLOSED
                                           │
                                           ├──► DEGRADED (error recovery)
                                           ├──► SUSPENDED
                                           └──► RECOVERING
```

### Message Types

| Type | Purpose | Example Use |
|------|---------|-------------|
| `ChatMessage` | General discussion | Session chat |
| `PresenceMessage` | Join/leave/heartbeat | Agent joining session |
| `ControlMessage` | Session control | State sync, checkpoint |
| `TaskMessage` | Task assignment | Assign work to worker |
| `ResultMessage` | Task completion | Report task result |
| `MeetingMessage` | Meeting coordination | Start/end meeting |
| `VoteMessage` | Voting in meetings | Cast vote |

---

## Quick Start

### Team Leader Workflow

```python
# 1. Register
register_agent(role="team-leader", name="team-leader")

# 2. Create session
session = create_session(sessionName="...", sessionType="task-coordination")

# 3. Assign tasks (AUTO-NOTIFIES workers!)
result = assign_session_task(
    sessionId=session.id,
    title="Compute primes",
    description="Find all primes 1-1000",
    assignTo="worker-001"
)
# result.notification.method = "redis_wake" ✅

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
set_worker_status(workerId="worker-001", status="green")

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

## MCP Server Tools

### Session Lifecycle (5 tools)

| Tool | Description |
|------|-------------|
| `create_session` | Create new session (Team Leader) |
| `join_session` | Join existing session (Workers) |
| `leave_session` | Leave session gracefully |
| `close_session` | Close session (Team Leader) |
| `get_session_status` | Get session state and participants |

### Session Messaging (4 tools)

| Tool | Description |
|------|-------------|
| `session_broadcast` | Broadcast to all + **WAKE all agents (v5)** |
| `session_message` | Send direct message + **WAKE target (v5)** |
| `poll_session_messages` | Poll inbox for new messages |
| `wait_for_task` | **BLOCK until wake signal (v5)** |

### Task Management (4 tools)

| Tool | Description |
|------|-------------|
| `assign_session_task` | Assign task + **AUTO-NOTIFY worker (v4)** |
| `report_task_completion` | Report result + **WAKE all agents (v5)** |
| `report_task_progress` | Update task progress |
| `request_task_help` | Request help from other agents |

### Meeting & Voting (5 tools)

| Tool | Description |
|------|-------------|
| `start_meeting` | Start meeting in session |
| `conclude_meeting` | End meeting with summary |
| `vote_on_proposal` | Cast vote on proposal |
| `get_session_history` | Get message history |
| `checkpoint_session` | Create session checkpoint |

### RAMAS Status (3 tools)

| Tool | Description |
|------|-------------|
| `set_worker_status` | Set green/red status badge |
| `interrupt_worker` | Send interrupt message (fallback) |
| `get_worker_statuses` | Get all worker statuses |

---

## Redis Keys (v5)

| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `ramas:agents:{agent_id}` | HASH | Agent state (window_id, status, last_seen) |
| `ramas:wake:{agent_id}` | STREAM | Wake signals for agent |
| `ramas:sessions:{session_id}` | HASH | Session state |

---

## File Locations

| File | Purpose |
|------|---------|
| `/tmp/ramas-session-registry.json` | Shared session registry (PATTERN-C-002) |
| `/tmp/ramas-session-inboxes/*.json` | Agent inbox files (PATTERN-C-001 + v5) |
| `/tmp/ramas-windows.json` | iTerm2 window registry |
| `/tmp/ramas-workflow-state.json` | Workflow state persistence |
| `/tmp/ramas-daemon.log` | Status daemon logs |

---

## Terminal Configuration (launch_windows.py)

| Setting | Value | Description |
|---------|-------|-------------|
| **SCREEN_WIDTH** | 1920px | External monitor width |
| **SCREEN_HEIGHT** | 1080px | External monitor height |
| **WINDOW_WIDTH** | 640px | 1920 / 3 terminals |
| **WINDOW_HEIGHT** | 1055px | Full height (1080 - 25 menu bar) |
| **FONT_NAME** | Monaco | iTerm2 font family |
| **FONT_SIZE** | 16pt | Increased from 12pt default |
| **SCREEN_2_OFFSET_X** | 1440px | Offset for Screen 2 positioning |

### Layout Visualization

```
Screen 2 (1920x1080)
┌──────────────┬──────────────┬──────────────┐
│ TEAM LEADER  │  WORKER-001  │  WORKER-002  │
│   640x1055   │   640x1055   │   640x1055   │
│  Monaco 16pt │  Monaco 16pt │  Monaco 16pt │
└──────────────┴──────────────┴──────────────┘
```

---

## Deprecated Patterns (v5)

| Pattern | Status | Replacement |
|---------|--------|-------------|
| Manual polling every 10s | ⛔ DEPRECATED | `wait_for_task()` with Redis wake |
| Manual interrupt after assign | ⛔ DEPRECATED | Auto-notification via `notify_worker()` |
| `session.participants` for discovery | ⛔ DEPRECATED | `inbox_manager.get_registered_agents_for_session()` |
| `wait_for_wake(last_id="$")` | ⛔ DEPRECATED | Two-phase check (first "0", then "$") |

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

---

## Installation

```bash
# Install dependencies
uv pip install -r src/ramas/python/requirements.txt

# Or with pip
pip install -r src/ramas/python/requirements.txt
```

### Dependencies

- `iterm2>=2.7` - Official iTerm2 Python API
- `aio-pika>=9.0` - Async RabbitMQ client
- `mcp>=1.0` - Anthropic MCP Python SDK
- `redis>=4.5.0` - Redis async client (for v5 wake signals)

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

# Check agent registry in Redis
redis-cli -a redis123 HGETALL ramas:agents:worker-001

# Check session registry
cat /tmp/ramas-session-registry.json | python3 -m json.tool
```

---

## Related Documentation

**MERKEZ (workspace/docs/):**
- [RAMAS-INDEX.md](../../../workspace/docs/RAMAS-INDEX.md) - Central navigation, quick start
- [PATTERN-C-003-v6.md](../../../workspace/docs/PATTERN-C-003-v6.md) - v6 quick reference
- [MCP-TOOLS-REFERENCE.md](../../../workspace/docs/MCP-TOOLS-REFERENCE.md) - 40+ tool signatures
- [3-LEVEL-COMMUNICATION.md](../../../workspace/docs/3-LEVEL-COMMUNICATION.md) - Emergency procedures

**Deep Dive (workspace/docs/architecture/):**
- [PATTERN-C-003-Autonomous-Orchestration.md](../../../workspace/docs/architecture/PATTERN-C-003-Autonomous-Orchestration.md) - Full v6 documentation
- [RAMAS-GUIDE.md](../../../workspace/docs/architecture/RAMAS-GUIDE.md) - Main RAMAS documentation

**Templates:**
- [TEAM_LEADER.md](../../../workspace/templates/TEAM_LEADER.md) - Team Leader workflow
- [WORKER.md](../../../workspace/templates/WORKER.md) - Worker workflow
- [TASK.md](../../../workspace/templates/TASK.md) - Generic task template

---

## Changelog

### 3.4.0 (2026-01-07) - PATTERN-C-003 v6

- **Added:** Stale wake cleanup - `clear_wake_stream()` on create_session
- **Added:** Task fallback - broadcasts result if task not found in memory
- **Added:** Session handshake protocol - SESSION_READY / WORKER_READY
- **Added:** `session_handshake` MCP tool for handshake protocol
- **Fixed:** "Session not found" errors from stale wake signals
- **Fixed:** "Task not found" errors when task completes before registration
- **Updated:** `redis_registry.py` with v6 stale cleanup
- **Updated:** `mcp_server.py` with v6 fallback and handshake

### 3.2.0 (2026-01-04) - PATTERN-C-003 v5

- **Added:** Two-phase wake check - catches PENDING signals before blocking
- **Added:** Bidirectional wake - workers wake Team Leader on completion
- **Added:** Inbox-based participant discovery - `get_registered_agents_for_session()`
- **Added:** Wake signals in `session_broadcast()` and `report_task_completion()`
- **Fixed:** Race condition where pending wake signals were missed
- **Fixed:** Team Leader not waking when workers complete tasks
- **Updated:** `redis_registry.py` with v5 two-phase approach
- **Updated:** `session_inbox.py` with participant discovery
- **Updated:** `mcp_server.py` with v5 bidirectional wake

### 3.1.0 (2026-01-04) - PATTERN-C-003 v4

- **Added:** Hybrid notification - Redis PRIMARY + Interrupt FALLBACK
- **Added:** `notify_worker()` helper function
- **Added:** Auto-notification in `assign_session_task()`
- **Fixed:** Circular wait deadlock between Team Leader and Workers
- **Updated:** Worker prompts to use `wait_for_task()` instead of polling

### 3.0.0 (2026-01-03)

- **Added:** PATTERN-C-002 Session Registry Isolation Fix
- **Added:** `session_registry.py` module
- **Added:** Shared session registry at `/tmp/ramas-session-registry.json`
- **Fixed:** "Session not found" error when workers join

### 2.1.0 (2026-01-02)

- **Added:** PATTERN-C-001 Hybrid Inbox Fix
- **Added:** `session_inbox.py` module
- **Fixed:** Message delivery to MCP tools

### 2.0.0 (2026-01-01)

- **Breaking:** Complete Python rewrite
- **Added:** Pattern C session modules
- **Removed:** AppleScript/osascript dependencies
- **Added:** iTerm2 Python API integration

---

*Last Updated: 2026-01-07*
*Pattern: PATTERN-C-003 v6 (Autonomous Multi-Agent Orchestration)*
*Status: Production Ready with stale cleanup, task fallback, and session handshake*
