# RAMAS Python Scripts

**Version:** 3.5.0 (PATTERN-C-003 v6 + Terminal Configuration)
**Date:** 2026-01-07
**Author:** Dr. Umit Kacar

---

## Quick Start (3 Minutes)

```bash
# 1. Activate virtual environment
source .venv-ramas/bin/activate

# 2. Check RabbitMQ + Redis are running
python scripts/ramas/python/quick_connect.py

# 3. Run full demo with ONE COMMAND!
python scripts/ramas/python/launch_windows.py
```

### Terminal Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| **Screen** | 1920x1080 (Full HD) | Screen 2 (external monitor) |
| **Window Width** | 640px | 1920 / 3 = 640 |
| **Window Height** | 1055px | 1080 - 25 (menu bar) |
| **Font** | Monaco 16pt | Increased from 12pt for readability |
| **Layout** | 3 side-by-side | Team Leader \| Worker-001 \| Worker-002 |

Edit `scripts/ramas/python/launch_windows.py` to customize:
```python
SCREEN_WIDTH = 1920
SCREEN_HEIGHT = 1080
FONT_NAME = "Monaco"
FONT_SIZE = 16  # User preference
```

That's it! The demo will:
1. Launch 3 iTerm2 windows (team-leader, worker-001, worker-002)
2. Each window gets a prompt with PATTERN-C-003 v6 workflow
3. Workers use `wait_for_task()` - **instant wake via Redis!**
4. Team Leader assigns tasks - **auto-notifies workers!**
5. Session handshake ensures all workers ready before task assignment!

---

## PATTERN-C-003 v6 Features

| Feature | Description |
|---------|-------------|
| **Bidirectional Wake** | Team Leader ↔ Workers instant notification |
| **Two-Phase Wake** | Catches PENDING signals (race condition fix) |
| **Redis Streams** | Sub-100ms wake latency (no polling!) |
| **Hybrid Notification** | Redis PRIMARY + Interrupt FALLBACK |
| **Stale Wake Cleanup** | v6: Clears old session signals on create_session |
| **Task Fallback** | v6: Graceful broadcast if task not found |
| **Session Handshake** | v6: SESSION_READY / WORKER_READY protocol |

### v6 Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PATTERN-C-003 v6 WORKFLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Team Leader                                  Workers            │
│  ───────────                                  ───────            │
│       │                                           │              │
│       │ 1. create_session                         │              │
│       │                                           │              │
│       │ 2. assign_session_task ─────────────────► │              │
│       │    + notify_worker() ──► Redis XADD      │              │
│       │                              │            │              │
│       │                              ▼            │              │
│       │                         wait_for_task()   │              │
│       │                         PHASE 1: XREAD "0" (pending)     │
│       │                         FOUND! ──────────►│              │
│       │                                           │              │
│       │                                      3. Process task     │
│       │                                           │              │
│       │◄──────────────────────────────────────────│              │
│       │         4. session_broadcast              │              │
│       │            + notify_worker() ──► Redis    │              │
│       │                                           │              │
│       │ wait_for_task() ◄─── INSTANT WAKE!        │              │
│       │                                           │              │
│       │ 5. Aggregate results                      │              │
│       │                                           │              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **macOS with iTerm2** installed
2. **Docker** running with RabbitMQ + Redis:
   ```bash
   docker compose -f infrastructure/docker/compose/docker-compose.yml up -d
   ```
3. **Python venv** activated:
   ```bash
   source .venv-ramas/bin/activate
   ```
4. **Dependencies** installed:
   ```bash
   uv pip install -r scripts/ramas/python/requirements.txt
   ```

---

## Script Reference

### Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `launch_windows.py` | Open 3 iTerm2 windows with v5 prompts | `python launch_windows.py` |
| `shutdown_demo.py` | Gracefully close all windows | `python shutdown_demo.py [--force]` |
| `send_to_claude.py` | Send message to Claude Code session | `python send_to_claude.py <agent-id> "message"` |
| **`stop_agent.py`** | 🚨 **EMERGENCY STOP** - Send ESC to interrupt agent | `python stop_agent.py <agent-id>` |

### Agent Control (3-Level Communication)

| Level | Script/Tool | Purpose | Reliability |
|-------|-------------|---------|-------------|
| **1** | `assign_session_task` MCP | Normal task distribution | Agent must be waiting |
| **2** | `interrupt_worker` MCP | Urgent RabbitMQ messages | Agent must be polling |
| **3** | **`stop_agent.py`** | 🚨 Direct ESC keystroke | **ALWAYS WORKS!** |

#### stop_agent.py Usage:
```bash
# Stop specific agent
python stop_agent.py worker-002

# Stop ALL agents
python stop_agent.py --all

# Stop with message
python stop_agent.py worker-001 --msg "Bekle, yeni görev geliyor"

# Makefile shortcuts
make ramas-stop AGENT=worker-002
make ramas-stop-all
```

**CRITICAL:** `stop_agent.py` sends ESC keystroke directly to iTerm2 terminal.
This ALWAYS works, even when agent is in "Thinking..." state!

**ESC Behavior:**
- 1x ESC = Interrupt operation ✅ (CORRECT)
- 2x ESC = Opens Rewind menu ❌ (WRONG - avoid!)

### Demo & Orchestration

| Script | Purpose | Usage |
|--------|---------|-------|
| `demo_runner.py` | **Single command full demo!** | `python demo_runner.py [--step-by-step]` |
| `orchestrate_multi_agent_test.py` | Manual step-by-step orchestration | `python orchestrate_multi_agent_test.py` |

### Debug & Monitoring

| Script | Purpose | Usage |
|--------|---------|-------|
| `quick_connect.py` | RabbitMQ + Redis connection test | `python quick_connect.py` |
| `session_manager_cli.py` | Session registry management | `python session_manager_cli.py list` |
| `inbox_inspector.py` | Inbox file inspection | `python inbox_inspector.py list` |
| `monitor_claude_sessions.py` | Claude Code session log monitor | `python monitor_claude_sessions.py` |
| `safe_cache_delete.py` | Safe cache cleanup (Trash, not rm -rf!) | `python safe_cache_delete.py` |

### Tests

| Script | Purpose | Usage |
|--------|---------|-------|
| `test_pattern_c_live.py` | Live Pattern C test | `python test_pattern_c_live.py` |
| `test_session_tanisma.py` | Session introduction meeting test | `python test_session_tanisma.py` |

---

## launch_windows.py - v5 Prompts

The launch script now includes PATTERN-C-003 v5 prompts for each agent:

### Team Leader Prompt

```python
TEAM_LEADER_PROMPT = """You are TEAM LEADER...

STARTUP:
1. register_agent(role="team-leader", name="team-leader")
2. Read /workspace/CURRENT_TASK.md
3. create_session(sessionName="...", sessionType="task-coordination")

ASSIGN TASKS (AUTO-NOTIFIES workers!):
4. assign_session_task(...) for each worker
   - Check notification.success in response
   - method="redis_wake" = instant delivery ✅

WAIT FOR RESULTS (INSTANT wake when workers complete!):
5. wait_for_task(sessionId="...", timeoutMs=60000)
   - When woke=true, poll_session_messages()

AGGREGATE & REPORT:
6. Combine all worker results
7. session_broadcast final summary
"""
```

### Worker Prompt

```python
WORKER_PROMPT = """You are WORKER-XXX...

STARTUP:
1. register_agent(role="worker", name="worker-XXX")
2. set_worker_status(workerId="worker-XXX", status="green")

WAIT FOR TASKS (use wait_for_task - instant wake via Redis!):
3. wait_for_task(sessionId="*", timeoutMs=60000)
   - BLOCKS until Team Leader assigns task
   - Returns with woke=true when task ready

PROCESS TASK:
4. poll_session_messages() to read the task
5. join_session(sessionId="...", agentRole="worker")
6. Execute the assigned task
7. session_broadcast your result (AUTO-WAKES Team Leader!)

PATTERN-C-003 v5: You will be INSTANTLY woken when Team Leader assigns a task!
No more polling every 10 seconds - Redis wake signal unblocks wait_for_task().
"""
```

---

## Pattern C Architecture

### Version History

| Pattern | Version | Feature | Problem Solved |
|---------|---------|---------|----------------|
| **C-003** | **v5** | Two-phase wake + Bidirectional | Race condition + Team Leader not waking |
| **C-003** | v4 | Hybrid notification | Circular wait deadlock |
| **C-003** | v3 | iTerm2 triggering | Manual intervention |
| **C-002** | - | Shared session registry | Session isolation |
| **C-001** | - | File-based inbox | MCP stateless connection |

### Message Flow (v5)

```
┌─────────────────────────────────────────────────────────────────┐
│                  PATTERN C v5 MESSAGE FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Team Leader                     Workers                         │
│  ───────────                     ───────                         │
│       │                              │                           │
│       │ 1. create_session            │                           │
│       ├──────────────────────────────┼─► Shared Registry         │
│       │                              │                           │
│       │                         2. join_session                  │
│       │◄─────────────────────────────┤   (reads from registry)   │
│       │                              │                           │
│       │ 3. assign_session_task       │                           │
│       ├──────────────────────────────┼─► Worker Inboxes          │
│       │   + notify_worker() ─────────┼─► Redis XADD (v4)         │
│       │                              │                           │
│       │                         4. wait_for_task()               │
│       │                              ├─► PHASE 1: XREAD "0" (v5) │
│       │                              │   (catches PENDING!)      │
│       │                              │                           │
│       │                         5. poll_session_messages         │
│       │                              ├─► (reads from inbox)      │
│       │                              │                           │
│       │                         6. session_broadcast             │
│       │◄─────────────────────────────┤   + notify_worker() (v5)  │
│       │   (Redis XADD to leader!)    │   WAKES TEAM LEADER!      │
│       │                              │                           │
│       │ 7. wait_for_task() wakes!    │                           │
│       │    Aggregate results         │                           │
│       │                              │                           │
└─────────────────────────────────────────────────────────────────┘
```

### File Locations

| File | Purpose |
|------|---------|
| `/tmp/ramas-session-registry.json` | Shared session registry (PATTERN-C-002) |
| `/tmp/ramas-session-inboxes/*.json` | Agent inbox files (PATTERN-C-001 + v5) |
| `/tmp/ramas-windows.json` | iTerm2 window registry |
| `/tmp/ramas-daemon.log` | Status daemon logs |

### Redis Keys (v5)

| Key Pattern | Type | Purpose |
|-------------|------|---------|
| `ramas:agents:{agent_id}` | HASH | Agent state |
| `ramas:wake:{agent_id}` | STREAM | Wake signals |

---

## Critical Lessons Learned

### 1. Enter Key: Use `\r` NOT `\n`!

```python
# ✅ CORRECT - Real Enter (submits command)
ENTER_KEY = "\r"

# ❌ WRONG - Shift+Enter (just new line, does NOT submit!)
ENTER_KEY = "\n"
```

This is **THE** most common mistake! `\n` appears to work but doesn't submit the command.

### 2. Two-Phase Wake Check (v5)

```python
# ❌ OLD (v4) - Race condition!
result = await redis.xread(streams={key: "$"}, block=timeout)
# Misses PENDING signals sent BEFORE worker starts waiting!

# ✅ NEW (v5) - Two-phase approach
# PHASE 1: Check pending first (non-blocking)
pending = await redis.xread(streams={key: "0"}, block=0)
if pending:
    return pending  # INSTANT return!

# PHASE 2: Block for new signals
result = await redis.xread(streams={key: "$"}, block=timeout)
```

### 3. Bidirectional Wake (v5)

```python
# v4: Only assign_session_task() sends wake signal
# v5: ALSO session_broadcast() and report_task_completion() send wake signals!

# This means Team Leader wakes when workers complete!
```

### 4. Inbox-Based Participant Discovery (v5)

```python
# ❌ OLD - session.participants (not synced across agents!)
for agent in session.participants:
    await notify_worker(agent, ...)

# ✅ NEW (v5) - Scan actual inbox files
registered = inbox_manager.get_registered_agents_for_session(session_id)
for agent in registered:
    await notify_worker(agent, ...)
```

### 5. MCP Stateless Problem (PATTERN-C-001)

**Problem:** MCP tools have no persistent connection. Each tool invocation is isolated.

**Solution:** File-based inbox at `/tmp/ramas-session-inboxes/{agent_id}.json`

### 6. Session Registry Isolation (PATTERN-C-002)

**Problem:** Each MCP server instance has its own memory.

**Solution:** Shared file registry at `/tmp/ramas-session-registry.json`

---

## Troubleshooting

### Workers Not Waking (v5)

**Check Redis wake streams:**
```bash
redis-cli -a redis123 XRANGE ramas:wake:worker-001 - +
redis-cli -a redis123 XRANGE ramas:wake:team-leader - +
```

**Check notification response:**
```json
{
  "notification": {
    "success": true,
    "method": "redis_wake"  // or "interrupt_fallback"
  }
}
```

### Team Leader Not Waking (v5)

**Cause:** session_broadcast() or report_task_completion() not sending wake signals

**Solution:** Ensure v5 code with bidirectional wake is deployed

### "Session not found" Error

**Cause:** Session registry not shared between MCP instances

**Check:**
```bash
cat /tmp/ramas-session-registry.json | python3 -m json.tool
```

### Messages Not Delivered

**Check inbox files:**
```bash
python inbox_inspector.py list
python inbox_inspector.py read <agent-id>
```

### RabbitMQ/Redis Connection Failed

**Check:**
```bash
python quick_connect.py
docker compose ps
```

---

## Deprecated Patterns (v5)

| Pattern | Status | Replacement |
|---------|--------|-------------|
| Manual polling every 10s | ⛔ DEPRECATED | `wait_for_task()` |
| Manual interrupt after assign | ⛔ DEPRECATED | Auto-notification |
| `session.participants` | ⛔ DEPRECATED | Inbox-based discovery |
| `wait_for_wake(last_id="$")` | ⛔ DEPRECATED | Two-phase check |

---

## Related Documentation

- [PATTERN-C-003-Autonomous-Orchestration.md](../../../docs/architecture/PATTERN-C-003-Autonomous-Orchestration.md) - Full v6 documentation
- [src/ramas/python/README.md](../../../src/ramas/python/README.md) - Python implementation
- [TEAM_LEADER_GUIDE.md](../../../workspace/TEAM_LEADER_GUIDE.md) - Team Leader workflow
- [WORKER_GUIDE.md](../../../workspace/WORKER_GUIDE.md) - Worker workflow
- [TASK_TEMPLATE.md](../../../workspace/TASK_TEMPLATE.md) - Generic task template

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **3.4.0** | 2026-01-07 | **PATTERN-C-003 v6:** Stale wake cleanup, task fallback, session_handshake MCP tool |
| 3.3.0 | 2026-01-07 | 3-Level Communication: Added `stop_agent.py` for emergency ESC stop, `make ramas-stop` |
| 3.2.0 | 2026-01-04 | PATTERN-C-003 v5: Two-phase wake, bidirectional wake, v5 prompts |
| 3.1.0 | 2026-01-04 | PATTERN-C-003 v4: Hybrid notification, auto-notify workers |
| 3.0.0 | 2026-01-03 | Added demo_runner.py, CLI tools, PATTERN-C-002 |
| 2.0.0 | 2026-01-02 | Added send_to_claude.py, orchestration, PATTERN-C-001 |
| 1.0.0 | 2026-01-01 | Initial Python version (replaced AppleScript) |

---

*Last Updated: 2026-01-07*
*Pattern: PATTERN-C-003 v6 + Session Handshake Protocol*
