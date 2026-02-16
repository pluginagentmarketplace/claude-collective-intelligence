# RAMAS: Reactive Agent Messaging & Automation System

**Version:** 3.5.0 (Python + PATTERN-C-003 v6.1)
**Date:** 2026-01-10
**Author:** Dr. Umit Kacar

---

## Quick Reference (MERKEZ)

> **TIP:** Günlük operasyonel kullanım için [RAMAS-INDEX.md](../RAMAS-INDEX.md) kullanın.

| Document | Purpose |
|----------|---------|
| [RAMAS-INDEX.md](../RAMAS-INDEX.md) | **MERKEZ** - Central navigation |
| [PATTERN-C-003-v6.md](../PATTERN-C-003-v6.md) | v6 quick reference |
| [MCP-TOOLS-REFERENCE.md](../MCP-TOOLS-REFERENCE.md) | 40+ tool signatures |
| [3-LEVEL-COMMUNICATION.md](../3-LEVEL-COMMUNICATION.md) | Emergency procedures |
| [CODEBASE-MAP.md](../CODEBASE-MAP.md) | File structure |

---

## 🐍 RAMAS 2.0 - Python Implementation

> **As of 2026-01-01, RAMAS has been completely rewritten in Python.**
> The JavaScript/AppleScript implementation is now archived.

### What Changed?

| Component | Old (v1.0) | New (v2.0) |
|-----------|------------|------------|
| iTerm2 Control | AppleScript via osascript | **iTerm2 Python API** |
| RabbitMQ | amqplib (Node.js) | **aio-pika (Python async)** |
| MCP Server | Node.js MCP SDK | **Python MCP SDK** |
| Status Daemon | Node.js | **Python asyncio** |

### Key Improvements

- ✅ **Tab Title Trap FIXED** - Python API uses `session.async_set_name()` correctly
- ✅ **Quote Hell ELIMINATED** - Python handles strings natively
- ✅ **Single Runtime** - 100% Python (no Node.js/Python hybrid)
- ✅ **Modern Async** - asyncio + aio-pika + iTerm2 async API

### iTerm2 Terminal Configuration (v3.5.0)

> **Added:** 2026-01-10 - User preference for larger font and full-height windows

**Window Parameters:**
```python
# Screen 2 dimensions (1920x1080 Full HD)
SCREEN_WIDTH = 1920
SCREEN_HEIGHT = 1080
MENU_BAR_HEIGHT = 25
DOCK_HEIGHT = 0  # Set to ~70 if Dock is visible at bottom

# Window sizing (3 side-by-side windows)
WINDOW_WIDTH = 640               # 1920 / 3 = 640px each
WINDOW_HEIGHT = 1055             # Full height minus menu bar (was 800!)

# Font Configuration (increased for readability)
FONT_NAME = "Monaco"
FONT_SIZE = 16                   # iTerm2 default: 12pt
```

**Font Setting via Python API:**
```python
async def create_worker_window(connection, worker):
    # ...
    font_string = f"{FONT_NAME} {FONT_SIZE}"
    await session.async_set_profile_property("Normal Font", font_string)
```

**Window Layout:**
```
┌────────────────┬────────────────┬────────────────┐
│  TEAM LEADER   │   WORKER-001   │   WORKER-002   │
│  (640x1055)    │  (640x1055)    │  (640x1055)    │
│      LEFT      │    CENTER      │     RIGHT      │
└────────────────┴────────────────┴────────────────┘
Screen 2: 1920x1080 Full HD | Font: Monaco 16pt
```

### New File Locations

```
src/ramas/python/
├── controller.py     # iTerm2 Python API
├── daemon.py         # Status daemon
├── registry.py       # Window registry
├── exchanges.py      # RabbitMQ
├── mcp_server.py     # MCP Server
└── README.md         # Full documentation

scripts/ramas/python/
├── launch_windows.py
├── interrupt_worker.py
└── update_title.py
```

### Quick Start (Python)

```bash
# Install dependencies
cd src/ramas/python
uv pip install -r requirements.txt

# Launch demo
python scripts/ramas/python/launch_windows.py

# Start daemon
python -m src.ramas.python.daemon
```

### Related Documentation

| Document | Description |
|----------|-------------|
| **[src/ramas/python/README.md](../../src/ramas/python/README.md)** | Full Python implementation documentation |
| **[APPLESCRIPT-ITERM2-COOKBOOK.md](./APPLESCRIPT-ITERM2-COOKBOOK.md)** | Historical reference (AppleScript lessons learned) |

### Test Results (2026-01-01)

All integration tests passed successfully:

| Test Category | Test | Method | Result |
|--------------|------|--------|--------|
| **Badge Status** | GREEN badge | CLI | ✅ |
| **Badge Status** | RED badge | CLI | ✅ |
| **Interrupt** | Normal message | CLI | ✅ |
| **Interrupt** | Urgent message (Ctrl+C) | CLI | ✅ |
| **RabbitMQ** | Status update → Daemon | RabbitMQ | ✅ |
| **RabbitMQ** | Normal interrupt → Daemon | RabbitMQ | ✅ |
| **RabbitMQ** | Urgent interrupt → Daemon | RabbitMQ | ✅ |
| **MCP Server** | get_worker_statuses | MCP Tool | ✅ |
| **MCP Server** | set_worker_status | MCP Tool | ✅ |
| **MCP Server** | interrupt_worker | MCP Tool | ✅ |

**Architecture Validation:**

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│  CLI Scripts   │     │   MCP Server   │     │   RabbitMQ     │
│  (Direct API)  │     │   (18 tools)   │     │   (Exchanges)  │
└───────┬────────┘     └───────┬────────┘     └───────┬────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    RAMAS Daemon     │
                    │  (Python asyncio)   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   iTerm2 Python API │
                    │   (Badge + Message) │
                    └─────────────────────┘
```

### Known Issues Resolved

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Tab Title not updating | Claude Code overrides tab title | Use iTerm2 **Badge** instead |
| Daemon stdout buffered | Python buffers non-TTY output | Use `PYTHONUNBUFFERED=1` |
| Module import errors | Relative imports need package context | Run with `python -m` |
| Window.frame API error | Wrong Frame object type | Use `iterm2.util.Frame` |

---

## PATTERN-C-003 v5: Session Messaging & Wake Signals (NEW!)

> **Added in v2.1.0 (2026-01-04):** Autonomous multi-agent orchestration with bidirectional wake signals.

### Key Features

| Feature | Description |
|---------|-------------|
| **wait_for_task()** | Blocks until wake signal arrives (no polling!) |
| **notify_worker()** | Hybrid notification: Redis PRIMARY + Interrupt FALLBACK |
| **Two-phase wake** | Catches PENDING signals before blocking for NEW |
| **Bidirectional wake** | Task→Worker AND Result→Team Leader |

### Quick Start

```python
# TEAM LEADER: Assign task (AUTO-NOTIFIES worker!)
assign_session_task(sessionId="...", title="...", assignTo="worker-001")
# Response includes: notification.method = "redis_wake" ✅

# WORKER: Wait for task (BLOCKS until assigned!)
result = wait_for_task(sessionId="*", timeoutMs=60000)
# Returns instantly when task assigned: result.woke = True

# WORKER: Broadcast result (AUTO-WAKES Team Leader!)
session_broadcast(sessionId="...", content="RESULT: ...")
```

### How Two-Phase Wake Works

```
┌───────────────────────────────────────────────────────────┐
│  PHASE 1: Check PENDING signals first (non-blocking)      │
│  ─────────────────────────────────────────────────────    │
│  pending = redis.XREAD(streams={key: "0"}, block=0)       │
│  if pending: return pending  # INSTANT return!            │
│                                                            │
│  PHASE 2: Block for NEW signals (if no pending)           │
│  ─────────────────────────────────────────────────────    │
│  result = redis.XREAD(streams={key: "$"}, block=timeout)  │
└───────────────────────────────────────────────────────────┘
```

### MCP Tools for Session Messaging

| Tool | Purpose |
|------|---------|
| `create_session` | Create coordination session |
| `join_session` | Join existing session |
| `assign_session_task` | Assign task + AUTO-NOTIFY worker |
| `wait_for_task` | BLOCK until wake signal |
| `poll_session_messages` | Read messages from inbox |
| `session_broadcast` | Send to all + WAKE all agents |
| `report_task_completion` | Report result + WAKE Team Leader |

### Related Documentation

- **[PATTERN-C-003-Autonomous-Orchestration.md](./PATTERN-C-003-Autonomous-Orchestration.md)** - Full v5 documentation
- **[/workspace/TEAM_LEADER_GUIDE.md](../../workspace/TEAM_LEADER_GUIDE.md)** - Team Leader workflow
- **[/workspace/WORKER_GUIDE.md](../../workspace/WORKER_GUIDE.md)** - Worker workflow

---

## Historical: RAMAS 1.0 (JavaScript/AppleScript)

> **⚠️ ARCHIVED:** The following documentation is for the legacy JavaScript/AppleScript
> implementation. Files have been moved to `archived/` directories.

### Legacy Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAMAS SYSTEM (Push-Based) - LEGACY           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐                                              │
│   │ Status Daemon │ ◄── RabbitMQ agent.ramas.* exchanges        │
│   │  (Node.js)   │  [ARCHIVED: src/ramas/archived/]            │
│   └──────┬───────┘                                              │
│          │                                                      │
│          ▼                                                      │
│   ┌──────────────┐                                              │
│   │  AppleScript │ ──► iTerm2 Terminals                        │
│   │   Trigger    │     • ESC (key code 53)                     │
│   └──────────────┘     • Title Update [GREEN]/[RED]            │
│                        • Message Injection                      │
│                                                                 │
│   Window Registry: /tmp/ramas-windows.json                     │
│   {                                                             │
│     "worker-001": {"windowId": "4039", "status": "green"},     │
│     "worker-002": {"windowId": "4040", "status": "red"}        │
│   }                                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Components

### 2.1 Status Daemon (`src/ramas/status-daemon.js`)

The core background service that:
- Listens to RabbitMQ `agent.ramas.*` exchanges
- Triggers AppleScript commands to control iTerm2
- Manages pending message queue for busy workers
- Updates terminal titles based on status

**Starting the Daemon:**
```bash
# Foreground (for debugging)
node src/ramas/status-daemon.js

# Background (production)
node src/ramas/status-daemon.js > /tmp/ramas-daemon.log 2>&1 &

# With custom RabbitMQ URL
RABBITMQ_URL=amqp://admin:pass@host:5672 node src/ramas/status-daemon.js
```

### 2.2 Window Registry (`src/ramas/window-registry.js`)

JSON file-based registry that maps worker IDs to iTerm2 window IDs:

```json
{
  "team-leader": {
    "windowId": "4039",
    "sessionId": "session-uuid",
    "status": "green",
    "registeredAt": 1735660800
  },
  "worker-001": {
    "windowId": "4040",
    "sessionId": "session-uuid",
    "status": "red",
    "registeredAt": 1735660800
  }
}
```

**Location:** `/tmp/ramas-windows.json`

### 2.3 AppleScript Controller (`src/ramas/applescript-controller.js`)

Wrapper for iTerm2 automation via AppleScript:

| Function | Description |
|----------|-------------|
| `sendESC(windowId)` | Send ESC key (key code 53) |
| `sendCtrlC(windowId)` | Send Ctrl+C (key code 8 + control) |
| `sendMessage(windowId, text)` | Type text + Enter |
| `updateTitle(windowId, title)` | Set window/tab title |
| `interruptAndMessage(windowId, msg)` | ESC + delay + message |
| `urgentInterrupt(windowId, msg)` | Ctrl+C + ESC + message |

### 2.4 RabbitMQ Exchanges (`src/ramas/ramas-exchanges.js`)

Three new exchanges for RAMAS:

| Exchange | Type | Purpose |
|----------|------|---------|
| `agent.ramas.status` | fanout | Broadcast status changes to all listeners |
| `agent.ramas.interrupt` | direct | Route interrupts to specific workers |
| `agent.ramas.push` | topic | Pattern-based push notifications |

---

## 3. MCP Tools

### 3.1 `set_worker_status`

Set a worker's availability status.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| workerId | string | Yes | Worker ID (e.g., "worker-001") |
| status | string | Yes | "green" (available) or "red" (busy) |

**Example:**
```
set_worker_status workerId=worker-001 status=red
```

**Behavior:**
- Updates terminal title to `[RED] WORKER-001` or `[GREEN] WORKER-001`
- Publishes status change to `agent.ramas.status` exchange
- When changing to green: flushes any pending messages

### 3.2 `interrupt_worker`

Send an interrupt message to a worker.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| workerId | string | Yes | Target worker ID |
| message | string | Yes | Message to send |
| priority | string | No | "normal" (default) or "urgent" |

**Example:**
```
# Normal interrupt (respects worker status)
interrupt_worker workerId=worker-001 message="New task available"

# Urgent interrupt (bypasses status, forces delivery)
interrupt_worker workerId=worker-001 message="STOP!" priority=urgent
```

**Behavior:**

| Priority | Worker Status | Action |
|----------|---------------|--------|
| normal | green | ESC + message immediately |
| normal | red | Queue message for later |
| urgent | any | Ctrl+C + ESC + message immediately |

### 3.3 `get_worker_statuses`

Get all registered workers and their statuses.

**Parameters:** None

**Example:**
```
get_worker_statuses
```

**Response:**
```json
{
  "registryPath": "/tmp/ramas-windows.json",
  "workerCount": 3,
  "workers": [
    {"workerId": "team-leader", "windowId": "4039", "status": "green"},
    {"workerId": "worker-001", "windowId": "4040", "status": "red"},
    {"workerId": "worker-002", "windowId": "4041", "status": "green"}
  ],
  "greenCount": 2,
  "redCount": 1
}
```

---

## 4. Workflow Examples

### 4.1 Basic Status Management

```
# 1. Check current statuses
> get_worker_statuses
  → worker-001: green, worker-002: green

# 2. Worker-001 starts a long task
> set_worker_status workerId=worker-001 status=red
  → Terminal title changes: [RED] WORKER-001

# 3. Worker-001 finishes
> set_worker_status workerId=worker-001 status=green
  → Terminal title changes: [GREEN] WORKER-001
  → Any queued messages are delivered
```

### 4.2 Normal Interrupt Flow

```
# Team Leader sends a task notification
> interrupt_worker workerId=worker-001 message="New analysis task ready"

# If worker-001 is GREEN:
  → ESC key sent (exits current prompt)
  → Message typed: "📩 MESSAGE: New analysis task ready"
  → ENTER pressed

# If worker-001 is RED:
  → Message queued
  → Delivered when worker becomes green
```

### 4.3 Urgent Interrupt (Emergency)

```
# Team Leader needs immediate attention
> interrupt_worker workerId=worker-001 message="STOP! Critical bug found" priority=urgent

# Regardless of status:
  → Ctrl+C sent (kills current process)
  → ESC sent (clears prompt)
  → Message typed: "🚨 URGENT: STOP! Critical bug found"
  → ENTER pressed
```

### 4.4 Multi-Worker Coordination

```
# Team Leader coordinates multiple workers

# 1. Check availability
> get_worker_statuses
  → worker-001: green, worker-002: red

# 2. Send to available worker
> interrupt_worker workerId=worker-001 message="Start code review"

# 3. Queue for busy worker
> interrupt_worker workerId=worker-002 message="When ready, check PR #42"
  → Queued (worker-002 is red)

# 4. Worker-002 finishes current task
> set_worker_status workerId=worker-002 status=green
  → Queued message delivered automatically
```

---

## 5. Demo Setup

### 5.1 Quick Start

```bash
# 1. Start Docker services
docker compose -f infrastructure/docker/compose/docker-compose.yml up -d

# 2. Launch demo (opens 3 iTerm2 windows + starts RAMAS daemon)
./scripts/demo/launch-iterm2-3windows.sh

# 3. Register agents in each window
# Window 1 (Team Leader):
> register_agent role=team-leader

# Window 2 (Worker 1):
> register_agent role=worker

# Window 3 (Worker 2):
> register_agent role=worker

# 4. Test RAMAS
> get_worker_statuses
> set_worker_status workerId=worker-001 status=red
> interrupt_worker workerId=worker-001 message="Test message" priority=urgent
```

### 5.2 Manual Daemon Start

If the daemon doesn't start automatically:

```bash
# Check if daemon is running
ps aux | grep status-daemon

# Start manually
cd /path/to/project
node src/ramas/status-daemon.js &

# View logs
tail -f /tmp/ramas-daemon.log
```

### 5.3 Troubleshooting

| Problem | Solution |
|---------|----------|
| Daemon won't start | Check RabbitMQ is running: `docker ps \| grep rabbitmq` |
| Title not updating | Verify window ID in registry: `cat /tmp/ramas-windows.json` |
| Messages not delivered | Check daemon logs: `tail -f /tmp/ramas-daemon.log` |
| ESC not working | Ensure iTerm2 is frontmost application |

---

## 6. File Structure

```
project-12-plugin-ai-agent-rabbitmq/
├── src/
│   ├── core/
│   │   └── mcp-server.js         # + RAMAS tools (3 new cases)
│   └── ramas/                    # RAMAS MODULE
│       ├── status-daemon.js      # Main daemon service
│       ├── window-registry.js    # Window ID management
│       ├── applescript-controller.js  # iTerm2 control
│       └── ramas-exchanges.js    # RabbitMQ definitions
├── scripts/
│   ├── demo/
│   │   └── launch-iterm2-3windows.sh  # + RAMAS integration
│   └── ramas/                    # RAMAS SCRIPTS
│       ├── interrupt-worker.sh   # Manual interrupt script
│       └── update-title.sh       # Manual title update
└── docs/
    └── architecture/
        └── RAMAS-GUIDE.md        # This document
```

---

## 7. RabbitMQ Integration

### Exchanges

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAMAS RabbitMQ Topology                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  agent.ramas.status (fanout)                                   │
│  └── ramas.status.updates (queue)                              │
│      → Status Daemon listens here                              │
│                                                                 │
│  agent.ramas.interrupt (direct)                                │
│  └── ramas.interrupts (queue)                                  │
│      → Routing key = workerId                                  │
│                                                                 │
│  agent.ramas.push (topic)                                      │
│  └── ramas.push.{workerId} (dynamic queues)                    │
│      → Created per worker on demand                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Message Formats

**Status Update:**
```json
{
  "workerId": "worker-001",
  "status": "green",
  "timestamp": 1735660800000
}
```

**Interrupt:**
```json
{
  "workerId": "worker-001",
  "message": "New task available",
  "priority": "normal"
}
```

---

## 8. Compatibility

| Requirement | Version |
|-------------|---------|
| macOS | 10.15+ (Catalina) |
| iTerm2 | 3.0+ |
| Node.js | 18+ |
| RabbitMQ | 3.8+ |

**Note:** RAMAS is macOS-only due to AppleScript/iTerm2 dependency.

---

## 9. Security Considerations

- Window registry is stored in `/tmp` (cleared on reboot)
- RabbitMQ credentials should be secured via environment variables
- ESC/Ctrl+C commands execute immediately without confirmation
- Urgent interrupts can disrupt running processes

---

## 10. Future Enhancements

- [ ] Linux support via xdotool/wmctrl
- [ ] Windows support via PowerShell/SendKeys
- [ ] Web-based status dashboard
- [ ] Message acknowledgment from workers
- [ ] Priority-based message ordering
- [ ] Historical status logging

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAMAS Quick Reference                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STATUS MANAGEMENT                                              │
│  ────────────────                                               │
│  get_worker_statuses              # List all workers            │
│  set_worker_status ... status=red   # Mark busy                 │
│  set_worker_status ... status=green # Mark available            │
│                                                                 │
│  MESSAGING                                                      │
│  ─────────                                                      │
│  interrupt_worker ... message="..."              # Normal       │
│  interrupt_worker ... message="..." priority=urgent # Force     │
│                                                                 │
│  TERMINAL TITLES                                                │
│  ───────────────                                                │
│  [GREEN] WORKER-001  = Available, accepting messages            │
│  [RED] WORKER-001    = Busy, messages queued                    │
│                                                                 │
│  FILES                                                          │
│  ─────                                                          │
│  /tmp/ramas-windows.json    # Window registry                   │
│  /tmp/ramas-daemon.log      # Daemon logs                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
