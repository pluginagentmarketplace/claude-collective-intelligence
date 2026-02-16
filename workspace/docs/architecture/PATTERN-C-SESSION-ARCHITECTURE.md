# Pattern C: Session-Based Multi-Agent Architecture

**Version:** 1.0.0
**Date:** 2026-01-01
**Author:** Dr. Umit Kacar
**Status:** DESIGN COMPLETE - Ready for Implementation

---

## Executive Summary

Pattern C implements a **session-based orchestration system** where:
1. All 3 Claude Code instances connect to RabbitMQ on startup
2. Each receives a role from the session coordinator
3. All communication happens within isolated session contexts
4. Full message history is preserved for late joiners
5. Robust error recovery handles crashes and network partitions

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PATTERN C: SESSION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ Team Leader  │    │  Worker-001  │    │  Worker-002  │                   │
│  │   (Claude)   │    │   (Claude)   │    │   (Claude)   │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │ MCP               │ MCP               │ MCP                       │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    SESSION MANAGER (Python)                          │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │ State Machine: INIT → WAITING → ACTIVE → CLOSING → CLOSED    │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         RabbitMQ                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │    │
│  │  │  sessions   │  │  broadcast  │  │   history   │  │  control   │  │    │
│  │  │   (topic)   │  │  (fanout)   │  │  (stream)   │  │  (direct)  │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Session State Machine

### 2.1 State Diagram

```
                    ┌─────────────────┐
                    │   INITIALIZING  │
                    └────────┬────────┘
                             │ LEADER_READY
                             ▼
                    ┌─────────────────┐
                    │ WAITING_FOR_    │◄───── WORKER_JOINED (partial)
                    │    WORKERS      │
                    └────────┬────────┘
                             │ ALL_WORKERS_JOINED
                             ▼
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│   DEGRADED   │◄──►│     ACTIVE      │◄──►│  SUSPENDED   │
│ (< workers)  │    │  (processing)   │    │ (all disconn)│
└──────────────┘    └────────┬────────┘    └──────────────┘
                             │                     │
                    ┌────────┴────────┐    ┌──────┴──────┐
                    ▼                 ▼    ▼             │
           ┌─────────────┐    ┌────────────┐            │
           │  CLOSING    │    │ RECOVERING │◄───────────┘
           └──────┬──────┘    └────────────┘
                  │
                  ▼
           ┌─────────────┐        ┌─────────────┐
           │   CLOSED    │        │   FAILED    │
           │  (success)  │        │   (error)   │
           └─────────────┘        └─────────────┘
```

### 2.2 States and Transitions

| State | Description | Entry Actions | Exit Triggers |
|-------|-------------|---------------|---------------|
| INITIALIZING | Session being created | Generate ID, create queues | LEADER_READY, TIMEOUT |
| WAITING_FOR_WORKERS | Leader ready, waiting for workers | Broadcast join request | ALL_JOINED, TIMEOUT |
| ACTIVE | Session running | Start heartbeats, accept tasks | CLOSE, TIMEOUT, ERROR |
| DEGRADED | Running with fewer workers | Accept late joins | WORKERS_FULL, CLOSE |
| SUSPENDED | All workers disconnected | Preserve state | RECONNECT, TIMEOUT |
| RECOVERING | Rebuilding after failure | Re-sync state | COMPLETE, FAIL |
| CLOSING | Draining tasks | Wait for completion | DRAINED, TIMEOUT |
| CLOSED | Successfully ended | Archive, cleanup | (terminal) |
| FAILED | Error occurred | Log, alert | (terminal) |

### 2.3 Timeouts

| Timeout | Duration | State | Action |
|---------|----------|-------|--------|
| init_timeout | 30s | INITIALIZING | → FAILED |
| join_timeout | 60s | WAITING | → DEGRADED |
| heartbeat | 15s | ACTIVE (per agent) | Mark disconnected |
| session | 3600s | ACTIVE | → CLOSING |
| drain | 30s | CLOSING | Force close |
| resume | 300s | SUSPENDED | → CLOSING |

---

## 3. RabbitMQ Topology

### 3.1 Exchanges

```python
EXCHANGES = {
    # Main session routing
    "agent.sessions": {
        "type": "topic",
        "durable": True,
        "routing_pattern": "session.{sid}.{type}.{target}"
    },

    # Per-session broadcast (created dynamically)
    "agent.sessions.{sid}.broadcast": {
        "type": "fanout",
        "durable": True,
        "auto_delete": True
    },

    # History capture
    "agent.sessions.history": {
        "type": "headers",
        "durable": True
    }
}
```

### 3.2 Queue Patterns

| Queue Pattern | Type | Purpose | TTL |
|---------------|------|---------|-----|
| `agent.sessions.{sid}.history` | Stream | Message history | 24h |
| `agent.sessions.{sid}.inbox.{agent}` | Quorum | Agent inbox | 1h |
| `agent.sessions.{sid}.control` | Quorum | Control messages | 1h |
| `agent.sessions.{sid}.results` | Quorum | Task results | 1h |

### 3.3 Routing Keys

```
session.{sessionId}.{messageType}.{targetAgent}

Examples:
- session.meeting-123.chat.all          # Broadcast
- session.meeting-123.task.worker-001   # Direct task
- session.meeting-123.result.team-leader # Result
- session.meeting-123.presence.all      # Join/leave
```

---

## 4. MCP Tools (17 Tools)

### 4.1 Session Lifecycle (4 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `create_session` | Create new session | session_name, session_type |
| `join_session` | Join existing session | session_id, agent_role |
| `leave_session` | Leave gracefully | session_id, reason |
| `close_session` | Close session | session_id, final_status |

### 4.2 Communication (3 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `session_broadcast` | Message to all | session_id, content |
| `session_message` | Direct message | session_id, to_agent, content |
| `get_session_history` | Get past messages | session_id, limit |

### 4.3 Session State (3 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `get_session_status` | Current status | session_id |
| `update_session_progress` | Update progress | session_id, progress |
| `checkpoint_session` | Create checkpoint | session_id, name |

### 4.4 Task Coordination (4 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `assign_session_task` | Create/assign task | session_id, title, description |
| `report_task_progress` | Report progress | session_id, task_id, progress |
| `report_task_completion` | Mark complete | session_id, task_id, result |
| `request_task_help` | Request assistance | session_id, help_type |

### 4.5 Meeting (3 tools)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `start_meeting` | Begin meeting | session_id, title, agenda |
| `vote_on_proposal` | Cast vote | meeting_id, proposal_id, vote |
| `conclude_meeting` | End meeting | meeting_id, summary |

---

## 5. Session Message Format

```python
@dataclass
class SessionMessage:
    # Required
    session_id: str
    message_type: MessageType  # CHAT, TASK, RESULT, CONTROL, PRESENCE
    sender_id: str
    payload: Any

    # Auto-generated
    message_id: str = uuid4()
    timestamp: str = datetime.utcnow().isoformat()
    sequence: Optional[int] = None  # Stream sequence

    # Optional
    target_agent: Optional[str] = None  # None = broadcast
    reply_to: Optional[str] = None
    priority: int = 5  # 1-10
    is_replay: bool = False

    def to_routing_key(self) -> str:
        target = self.target_agent or "all"
        return f"session.{self.session_id}.{self.message_type.value}.{target}"
```

---

## 6. Implementation Plan

### Phase 1: Core Infrastructure (Day 1-2)

```
src/ramas/python/
├── session_manager.py      # NEW: SessionManager class
├── session_state.py        # NEW: State machine
├── session_messages.py     # NEW: Message types
└── exchanges.py            # UPDATE: Session exchanges
```

**Files to create:**
1. `session_state.py` - State enum and transitions
2. `session_messages.py` - SessionMessage dataclass
3. `session_manager.py` - Main SessionManager class

### Phase 2: MCP Tools (Day 2-3)

```
mcp_server.py additions:
├── create_session          # Lifecycle
├── join_session
├── leave_session
├── close_session
├── session_broadcast       # Communication
├── session_message
├── get_session_history
├── get_session_status      # State
├── update_session_progress
├── checkpoint_session
├── assign_session_task     # Tasks
├── report_task_progress
├── report_task_completion
├── request_task_help
├── start_meeting           # Meetings
├── vote_on_proposal
└── conclude_meeting
```

### Phase 3: Daemon Updates (Day 3-4)

```
daemon.py updates:
├── setup_session_infrastructure()
├── listen_session_messages()
├── handle_session_lifecycle()
├── handle_session_recovery()
└── cleanup_expired_sessions()
```

### Phase 4: Testing (Day 4-5)

```
scripts/ramas/python/
├── test_session_creation.py
├── test_session_meeting.py
├── test_session_recovery.py
└── test_full_session_flow.py
```

---

## 7. Key Design Decisions

### 7.1 History Storage: RabbitMQ Streams

**Why Streams over Database-only:**
- Built-in time-based retention (24h)
- Offset-based replay for late joiners
- No separate database queries needed
- Automatic cleanup

### 7.2 Queue Type: Quorum Queues

**Why Quorum over Classic:**
- Replicated for high availability
- Built-in message deduplication
- Delivery limit for retry control
- Better durability guarantees

### 7.3 Session Isolation: Per-Session Broadcast Exchange

**Why Dynamic Fanout:**
- Complete isolation between sessions
- No routing key complexity
- Auto-delete on session close
- Simpler late-joiner implementation

---

## 8. Startup Flow (Tanışma Toplantısı)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STARTUP SEQUENCE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  T=0    External: "RabbitMQ'ya bağlan ve görevini al"               │
│                                                                      │
│  T=5s   Team Leader:                                                │
│         ├─► create_session("sprint-planning")                       │
│         └─► Waits for workers                                       │
│                                                                      │
│  T=7s   Worker-001:                                                 │
│         ├─► join_session(session_id, role="worker")                │
│         ├─► get_session_history() // Catch up                       │
│         └─► "Merhaba, ben Worker-001, hazırım"                      │
│                                                                      │
│  T=9s   Worker-002:                                                 │
│         ├─► join_session(session_id, role="worker")                │
│         ├─► get_session_history() // See W1's message               │
│         └─► "Merhaba, ben Worker-002, hazırım"                      │
│                                                                      │
│  T=12s  Team Leader:                                                │
│         ├─► Session → ACTIVE                                        │
│         ├─► start_meeting(agenda=["Tanışma", "Görev dağıtımı"])    │
│         └─► "Hoş geldiniz! Toplantı başlıyor..."                   │
│                                                                      │
│  T=15s  All Ready for Tasks                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Error Recovery Scenarios

### 9.1 Worker Crash

```python
# Daemon detects heartbeat timeout
async def handle_worker_crash(session_id, worker_id):
    session = await get_session(session_id)

    # Mark worker disconnected
    session.mark_participant_disconnected(worker_id)

    # Broadcast to others
    await session_broadcast(session_id, {
        "type": "WORKER_DISCONNECTED",
        "worker_id": worker_id
    })

    # Re-assign their tasks
    orphaned_tasks = session.get_tasks_by_worker(worker_id)
    for task in orphaned_tasks:
        await reassign_task(session_id, task.id)

    # Check if degraded
    if session.active_worker_count < session.min_workers:
        await transition_to_degraded(session_id)
```

### 9.2 Leader Crash (Election)

```python
async def handle_leader_crash(session_id):
    session = await get_session(session_id)

    # Transition to election
    session.state = SessionState.LEADER_ELECTION

    # Workers announce candidacy
    candidates = []
    async for msg in listen_for_candidates(session_id, timeout=15):
        candidates.append(msg.sender_id)

    # Deterministic election: lowest agent_id wins
    if candidates:
        new_leader = sorted(candidates)[0]
        await elect_leader(session_id, new_leader)
        await transition_to_recovering(session_id)
    else:
        await transition_to_failed(session_id, "No leader candidates")
```

---

## 10. Session Metadata Schema

```json
{
  "session_id": "uuid-v4",
  "state": "ACTIVE",
  "created_at": "2026-01-01T10:00:00Z",
  "leader": {
    "agent_id": "team-leader",
    "agent_type": "team-leader"
  },
  "participants": [
    {
      "agent_id": "worker-001",
      "status": "ACTIVE",
      "joined_at": "2026-01-01T10:00:05Z",
      "current_task": null,
      "tasks_completed": 3
    }
  ],
  "config": {
    "expected_worker_count": 2,
    "session_timeout_seconds": 3600,
    "heartbeat_interval_seconds": 5,
    "allow_late_join": true
  },
  "tasks": {
    "total_assigned": 5,
    "completed": 3,
    "in_progress": 2
  },
  "metrics": {
    "duration_seconds": 1234,
    "message_count": 45
  }
}
```

---

## 11. KNOWN BUG: MCP Stateless Connection (2026-01-01)

### 11.1 Problem Description

**Bug ID:** PATTERN-C-001
**Severity:** Critical
**Status:** Identified - Solution Designed
**Discovered:** 2026-01-01 (Live Test with 3 Claude instances)

**Symptom:**
- `create_session` works ✅
- `join_session` appears to succeed but workers never "join" from Team Leader's perspective
- Team Leader shows "Waiting for workers to join..." indefinitely
- Workers calculate results but can't communicate via session

**Root Cause:**
MCP tools are **stateless** - each tool call creates a new RabbitMQ connection that closes after execution:

```
MCP Tool Lifecycle:
┌─────────────────────────────────────────────────────────────┐
│  Tool Call Start                                             │
│       ↓                                                      │
│  connect() ──► execute() ──► disconnect()                   │
│       ↓              ↓              ↓                        │
│   New conn      Send/Recv      Connection CLOSED!            │
└─────────────────────────────────────────────────────────────┘

Problem: Session messages require PERSISTENT consumer to receive!
         After disconnect(), no consumer → messages not delivered
```

**Why Pattern A/B Works:**
- `broadcast_message`: Connect → Send → Disconnect (stateless OK)
- `get_messages`: Connect → Poll queue → Return → Disconnect (stateless OK)

**Why Pattern C Fails:**
- `join_session`: Connect → Declare queue → **Disconnect** → No consumer!
- Session expects persistent listener for incoming messages

### 11.2 Solution: Daemon-Based Session Listener

**Architecture Fix:**

```
┌──────────────────────────────────────────────────────────────────┐
│                    SOLUTION: DAEMON LISTENER                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐     ┌─────────────────────────────────────────┐ │
│  │ MCP Tool    │     │        Session Daemon (persistent)       │ │
│  │ join_session│────►│  - Maintains RabbitMQ connection         │ │
│  └─────────────┘     │  - Consumes session.*.inbox.{agent}      │ │
│                      │  - Stores messages in memory/SQLite      │ │
│  ┌─────────────┐     │  - Exposes via local HTTP or file        │ │
│  │ MCP Tool    │────►│                                          │ │
│  │ get_session │     └─────────────────────────────────────────┘ │
│  │ _messages   │                        │                        │
│  └─────────────┘                        ▼                        │
│                      ┌─────────────────────────────────────────┐ │
│                      │   /tmp/session-{id}-messages.json        │ │
│                      │   or SQLite: sessions.db                 │ │
│                      └─────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 11.3 Implementation Plan

**Phase 1: Session Listener Daemon** (daemon.py update)
```python
class SessionListenerDaemon:
    """Persistent listener for session messages"""

    def __init__(self):
        self.connection = None
        self.sessions = {}  # session_id -> messages[]

    async def start(self):
        self.connection = await aio_pika.connect_robust(RABBITMQ_URL)
        # Start consuming for registered sessions

    async def register_session(self, session_id: str, agent_id: str):
        """Called by join_session MCP tool"""
        queue_name = f"agent.sessions.{session_id}.inbox.{agent_id}"
        # Create consumer, store messages in self.sessions[session_id]

    def get_messages(self, session_id: str) -> List[dict]:
        """Called by get_session_messages MCP tool"""
        return self.sessions.get(session_id, [])
```

**Phase 2: MCP Tool Updates**
```python
# join_session now tells daemon to start listening
async def handle_join_session(args):
    # ... existing logic ...

    # NEW: Tell daemon to start listening for this session
    daemon.register_session(session_id, agent_id)

# get_session_messages reads from daemon's message store
async def handle_get_session_messages(args):
    return daemon.get_messages(session_id)
```

**Phase 3: Alternative - Polling Mode**
If daemon is too complex, use polling:
```python
async def handle_get_session_messages(args):
    """Poll session inbox queue directly"""
    queue = await channel.declare_queue(inbox_queue, passive=True)
    messages = []
    while True:
        msg = await queue.get(timeout=0.1)
        if msg is None:
            break
        messages.append(json.loads(msg.body))
        await msg.ack()
    return messages
```

### 11.4 Temporary Workaround

Until fix is implemented, use **Pattern A** for multi-agent communication:

```python
# Instead of Pattern C session:
create_session()  # ❌ Doesn't work with MCP

# Use Pattern A broadcast:
register_agent(role="team-leader")  # ✅ Works
broadcast_message("Task: Calculate primes")  # ✅ Works
get_messages(type="all")  # ✅ Works
```

### 11.5 Test Results (2026-01-01)

| Test | Pattern A | Pattern C |
|------|-----------|-----------|
| RabbitMQ Connection | ✅ | ✅ |
| Send Message | ✅ | ✅ |
| Receive Message | ✅ | ❌ (no persistent consumer) |
| Multi-Agent Coordination | ✅ | ❌ |
| Session State Machine | N/A | ✅ (logic works) |
| Task Distribution | ✅ | ❌ |

**Conclusion:** Pattern C requires daemon-based listener for production use.

---

## 12. Next Steps (Updated)

1. **Implement `session_state.py`** - State machine enums and transitions
2. **Implement `session_messages.py`** - Message dataclasses
3. **Implement `session_manager.py`** - Core SessionManager
4. **Add MCP tools to `mcp_server.py`** - 17 new tools
5. **Update `daemon.py`** - Session listeners
6. **Create test script** - Full session flow test

---

## 12. Success Criteria

- [ ] 3 Claude instances can create and join a session
- [ ] Session history available for late joiners
- [ ] Tasks dispatched and results collected via session
- [ ] Graceful handling of worker disconnect/reconnect
- [ ] Meeting functionality works (agenda, voting)
- [ ] Session closes cleanly with archived history

---

**Pattern C Design: COMPLETE** ✅

**Ready for Implementation!** 🚀
