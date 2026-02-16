# RAMAS Codebase Map

**Version:** 3.5.0 | **Updated:** 2026-01-10

> Tüm RAMAS dosyalarının detaylı haritası. Kod nerede, ne yapıyor?

---

## Overview

```
project-12-plugin-ai-agent-rabbitmq/
├── src/ramas/python/        # Core implementation (14 modules, ~350K LOC)
├── scripts/ramas/python/    # Executable scripts (13 files)
├── tests/ramas/python/      # Test modules (3 files)
├── docs/architecture/       # Deep dive documentation
├── workspace/docs/          # MERKEZ - Operational docs (you are here!)
├── CLAUDE.md               # Project config + 3-Level Communication
└── Makefile                # 15+ ramas-* targets
```

---

## 1. Source Code: `src/ramas/python/`

### Core Modules (14 files)

| Module | Size | Purpose | Key Classes/Functions |
|--------|------|---------|----------------------|
| **mcp_server.py** | 113K | MCP Server - 40+ tools | `create_session()`, `assign_session_task()`, `wait_for_task()` |
| **daemon.py** | 47K | RabbitMQ async listener | `StatusDaemon`, `consume_messages()` |
| **session_manager.py** | 37K | Session lifecycle | `SessionManager`, 11 state machine |
| **controller.py** | 20K | iTerm2 Python API | `iTerm2Controller`, `send_text()`, `create_window()` |
| **exchanges.py** | 21K | RabbitMQ topology | `setup_exchanges()`, `declare_queues()` |
| **redis_registry.py** | 21K | Wake signals (v5/v6) | `notify_worker()`, `wait_for_wake()`, `clear_wake_stream()` |
| **agent_trigger.py** | 18K | Agent startup | `trigger_agent()`, `create_agent_window()` |
| **task_coordinator.py** | 17K | Task distribution | `TaskCoordinator`, `assign_task()` |
| **workflow_engine.py** | 16K | State machine | `WorkflowEngine`, 28 events |
| **session_inbox.py** | 16K | PATTERN-C-001 inbox | `SessionInbox`, `write_message()`, `read_messages()` |
| **session_messages.py** | 14K | 7 message types | `ChatMessage`, `TaskMessage`, `ResultMessage` |
| **session_registry.py** | 12K | PATTERN-C-002 | `SessionRegistry`, shared registry |
| **session_state.py** | 18K | 11 states | `SessionState`, `WAITING_FOR_WORKERS`, `ACTIVE` |
| **registry.py** | 13K | Window registry | `WindowRegistry`, iTerm2 mapping |

### Module Dependencies

```
mcp_server.py
├── session_manager.py
│   ├── session_state.py (11 states)
│   ├── session_messages.py (7 types)
│   ├── session_inbox.py (PATTERN-C-001)
│   └── session_registry.py (PATTERN-C-002)
├── redis_registry.py (wake signals)
├── task_coordinator.py
├── controller.py (iTerm2 API)
└── daemon.py (RabbitMQ listener)
```

### PATTERN-C Implementations

| Pattern | File | Line Range | Purpose |
|---------|------|------------|---------|
| **PATTERN-C-001** | session_inbox.py | Full | File-based inbox |
| **PATTERN-C-002** | session_registry.py | Full | Session isolation |
| **PATTERN-C-003 v6** | redis_registry.py | 1-500 | Wake signals |
| **PATTERN-C-003 v6** | mcp_server.py | assign_session_task() | Bidirectional wake |

---

## 2. Scripts: `scripts/ramas/python/`

### Executable Scripts (13 files)

#### Demo & Control
| Script | Size | Purpose | Usage |
|--------|------|---------|-------|
| **launch_windows.py** | 18K | 3 iTerm2 windows launch (Font 16pt, 640x1055) | `python launch_windows.py` |
| **demo_runner.py** | 20K | Full demo automation | `python demo_runner.py [--step-by-step]` |
| **shutdown_demo.py** | 12K | Graceful shutdown | `python shutdown_demo.py [--force]` |
| **stop_agent.py** | 13K | Emergency ESC (Level 3) | `python stop_agent.py <agent-id>` |

#### iTerm2 Terminal Configuration (launch_windows.py)

> **Added:** 2026-01-10 - User preference for larger font and full-height windows

| Constant | Value | Description |
|----------|-------|-------------|
| `SCREEN_WIDTH` | 1920 | Screen 2 (Full HD) width |
| `SCREEN_HEIGHT` | 1080 | Screen 2 (Full HD) height |
| `MENU_BAR_HEIGHT` | 25 | macOS menu bar height |
| `DOCK_HEIGHT` | 0 | Set to ~70 if Dock visible |
| `WINDOW_WIDTH` | 640 | Each of 3 windows (1920/3) |
| `WINDOW_HEIGHT` | 1055 | `SCREEN_HEIGHT - MENU_BAR_HEIGHT - DOCK_HEIGHT` |
| `FONT_NAME` | Monaco | iTerm2 default font |
| `FONT_SIZE` | 16 | Increased from iTerm2 default 12pt |

**Window Layout (Screen 2):**
```
┌────────────────┬────────────────┬────────────────┐
│  TEAM LEADER   │   WORKER-001   │   WORKER-002   │
│  (640x1055)    │  (640x1055)    │  (640x1055)    │
│      LEFT      │    CENTER      │     RIGHT      │
│   Coordinator  │   Environment  │  Code Quality  │
└────────────────┴────────────────┴────────────────┘
Screen 2: 1920x1080 Full HD | Font: Monaco 16pt
```

#### Agent Management
| Script | Size | Purpose |
|--------|------|---------|
| **send_to_claude.py** | 11K | Send message to session |
| **session_manager_cli.py** | 12K | Registry CLI management |
| **quick_connect.py** | 12K | RabbitMQ + Redis test |

#### Debugging
| Script | Size | Purpose |
|--------|------|---------|
| **inbox_inspector.py** | 14K | Inspect inbox files |
| **monitor_claude_sessions.py** | 7.8K | Monitor logs |
| **safe_cache_delete.py** | 14K | Safe cleanup (Trash) |

#### Testing
| Script | Size | Purpose |
|--------|------|---------|
| **test_pattern_c_live.py** | 8.0K | Live integration test |
| **test_session_tanisma.py** | 14K | Session meeting test |
| **orchestrate_multi_agent_test.py** | 12K | Manual orchestration |

---

## 3. Tests: `tests/ramas/python/`

| Test File | Coverage |
|-----------|----------|
| test_agent_trigger.py | Agent trigger functions |
| test_autonomous_workflow.py | Workflow execution |
| test_workflow_engine.py | State machine transitions |

---

## 4. Configuration Files

### Project Root

| File | RAMAS Content |
|------|---------------|
| **CLAUDE.md** | 3-Level Communication (lines 300-365), Makefile commands |
| **Makefile** | 15+ `ramas-*` targets (lines 226-290) |
| **.mcp.json** | MCP server configuration |
| **.venv-ramas/** | Python virtual environment |

### Makefile Targets

```makefile
##@ RAMAS Multi-Agent Orchestration

ramas-check         # RabbitMQ + Redis connectivity
ramas-launch        # 3 iTerm2 windows
ramas-shutdown      # Graceful shutdown
ramas-sessions      # List sessions
ramas-inbox         # Inspect inboxes
ramas-monitor       # Monitor logs
ramas-demo          # Full demo
ramas-demo-step     # Step-by-step demo
ramas-full          # Docker + connectivity + launch
ramas-stop          # Stop specific agent (AGENT=xxx)
ramas-stop-all      # Stop ALL agents
ramas-send          # Send message (AGENT=xxx MSG="...")
ramas-clean         # Clean temp files
```

---

## 5. Runtime Files

Çalışma zamanında oluşturulan dosyalar:

| Location | Purpose | Created By |
|----------|---------|------------|
| `/tmp/ramas-session-inboxes/` | Agent inbox files | session_inbox.py |
| `/tmp/ramas-session-inboxes/{agent_id}.json` | Per-agent inbox | session_inbox.py |
| `/tmp/ramas-session-registry.json` | Shared registry | session_registry.py |
| `/tmp/ramas-windows.json` | iTerm2 mapping | registry.py |
| `/tmp/ramas-workflow-state.json` | Workflow state | workflow_engine.py |
| `/tmp/ramas-daemon.log` | Daemon logs | daemon.py |

### Redis Keys

| Key Pattern | Purpose |
|-------------|---------|
| `ramas:wake:{agent_id}` | Wake signal stream (v5/v6) |
| `ramas:session:{session_id}` | Session state |
| `ramas:agent:{agent_id}:status` | Agent status |

---

## 6. Documentation Structure

### workspace/docs/ (MERKEZ)

```
workspace/docs/
├── RAMAS-INDEX.md           # Central navigation (this links here)
├── CODEBASE-MAP.md          # You are here!
├── PATTERN-C-003-v6.md      # Quick reference
├── MCP-TOOLS-REFERENCE.md   # Tool catalog
└── 3-LEVEL-COMMUNICATION.md # Emergency procedures
```

### docs/architecture/ (Deep Dive)

```
docs/architecture/
├── PATTERN-C-003-Autonomous-Orchestration.md  # Full v6 spec
├── PATTERN-C-002-Session-Registry.md          # Registry pattern
├── RAMAS-GUIDE.md                             # Implementation guide
├── MCP-SERVER-GUIDE.md                        # Server architecture
├── TASK-COORDINATION-GUIDE.md                 # Task patterns
└── archive/
    └── MASTER-GUIDE.md                        # DEPRECATED (v1.0)
```

---

## 7. MCP Tools Inventory (40+)

### Session Lifecycle (5 tools)
- `create_session` - Session oluştur
- `join_session` - Session'a katıl
- `leave_session` - Session'dan ayrıl
- `close_session` - Session kapat
- `get_session_status` - Status al

### Messaging (4 tools)
- `session_broadcast` - Herkese gönder
- `session_message` - Birine gönder
- `poll_session_messages` - Mesajları oku
- `wait_for_task` - Blocking bekle (v5+)

### Task Management (4 tools)
- `assign_session_task` - Task ata
- `report_task_completion` - Sonuç bildir
- `report_task_progress` - İlerleme bildir
- `request_task_help` - Yardım iste

### Control (3 tools)
- `session_handshake` - Handshake (v6)
- `interrupt_worker` - Acil mesaj (Level 2)
- `set_worker_status` - Status güncelle

### Full list: [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md)

---

## 8. Key Functions Quick Reference

### Wake Signals (redis_registry.py)

```python
# v5: Two-phase wake check
async def wait_for_wake(agent_id: str, timeout_ms: int) -> dict:
    # Phase 1: Check pending (non-blocking)
    pending = await redis.xread(streams={key: "0"}, block=0)
    if pending:
        return pending
    # Phase 2: Block for new
    return await redis.xread(streams={key: "$"}, block=timeout_ms)

# v6: Stale wake cleanup
async def clear_wake_stream(agent_id: str) -> bool:
    key = f"ramas:wake:{agent_id}"
    return await redis.delete(key) > 0

# v6: Bidirectional notify
async def notify_worker(agent_id: str, message: dict) -> dict:
    key = f"ramas:wake:{agent_id}"
    await redis.xadd(key, message)
    return {"success": True, "method": "redis_wake"}
```

### Task Assignment (mcp_server.py)

```python
async def assign_session_task(session_id, title, description, assign_to, ...):
    # 1. Create task
    task = await session_manager.create_task(...)

    # 2. Notify worker (v5+ bidirectional wake)
    notification = await notify_worker(assign_to, {
        "type": "task_assigned",
        "task_id": task.id
    })

    return {
        "success": True,
        "taskId": task.id,
        "notification": notification  # Shows redis_wake or interrupt fallback
    }
```

---

## 9. Entry Points

| Use Case | Entry Point |
|----------|-------------|
| **Full Demo** | `make ramas-demo` or `python scripts/ramas/python/demo_runner.py` |
| **Manual Launch** | `python scripts/ramas/python/launch_windows.py` |
| **Emergency Stop** | `make ramas-stop AGENT=xxx` or `python scripts/ramas/python/stop_agent.py xxx` |
| **Debug Inbox** | `python scripts/ramas/python/inbox_inspector.py list` |
| **Test Connection** | `python scripts/ramas/python/quick_connect.py` |

---

## 10. Archived Code

`src/ramas/archived/` - Deprecated Node.js/AppleScript v1 implementation:

| File | Status |
|------|--------|
| status-daemon.js | Replaced by Python daemon.py |
| applescript-controller.js | Replaced by Python controller.py + iTerm2 API |
| ramas-exchanges.js | Replaced by Python exchanges.py |
| window-registry.js | Replaced by Python registry.py |

---

## Related Docs

- [RAMAS-INDEX.md](RAMAS-INDEX.md) - Central navigation
- [PATTERN-C-003-v6.md](PATTERN-C-003-v6.md) - v6 features
- [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md) - Tool catalog
- [3-LEVEL-COMMUNICATION.md](3-LEVEL-COMMUNICATION.md) - Emergency procedures

---

*RAMAS v3.5.0 | workspace/docs/CODEBASE-MAP.md*
*Terminal Configuration (Font 16pt, 640x1055) documented: 2026-01-10*
