# 3-Level Communication Hierarchy

**Version:** 1.1.0 | **Updated:** 2026-01-08 | **Pattern:** PATTERN-C-003 v6

---

## Overview

Multi-agent orchestration sisteminde 3 seviyeli iletişim hiyerarşisi vardır.
Her seviye farklı güvenilirlik ve kullanım senaryolarına sahiptir.

---

## Communication Levels

| Level | Method | Reliability | When to Use |
|-------|--------|-------------|-------------|
| **1** | `assign_session_task` | Agent must be waiting | Normal task distribution |
| **2** | `interrupt_worker` | Agent must be polling | Urgent notifications |
| **3** | **Direct ESC** | **ALWAYS WORKS!** | Emergency stop |

---

## Level 1: RabbitMQ Task Distribution

**Tool:** `assign_session_task()`

**How it works:**
1. Team Leader calls `assign_session_task()`
2. Task is stored in session registry
3. Wake signal sent to Redis stream
4. Worker's `wait_for_task()` unblocks
5. Worker reads task via `poll_session_messages()`

**Reliability:**
- Worker must be in `wait_for_task()` state
- Works instantly (<100ms) when worker is waiting
- May miss if worker not ready yet

**Example:**
```python
assign_session_task(
    sessionId="session-xxx",
    title="Analyze Code",
    description="...",
    assignTo="worker-001",
    priority="high"
)
```

---

## Level 2: RabbitMQ Interrupt

**Tool:** `interrupt_worker()`

**How it works:**
1. Team Leader calls `interrupt_worker()`
2. Urgent message sent via RabbitMQ
3. Daemon routes to worker's iTerm2 terminal
4. Message appears in worker's inbox

**Reliability:**
- Worker must be polling for messages
- Good for reminders and status requests
- May not work if worker is stuck in long operation

**When to use:**
- Worker unresponsive for >30 seconds
- Need status update from worker
- Want to change task priority

**Example:**
```python
interrupt_worker(
    workerId="worker-001",
    message="URGENT: Report your progress NOW!",
    priority="urgent"
)
```

---

## Level 3: Direct ESC Keystroke (EMERGENCY!)

**Tools:**
- `make ramas-stop AGENT=worker-001`
- `python scripts/ramas/python/stop_agent.py worker-001`

**How it works:**
1. Python script sends ESC keystroke to iTerm2
2. ESC goes directly to terminal (bypasses RabbitMQ)
3. Claude Code receives interrupt signal
4. Current operation stops immediately

**Reliability:**
- **ALWAYS WORKS!**
- Bypasses all message queues
- Works even when agent is in "Thinking..." state

**When to use:**
- Worker executing WRONG task
- Worker stuck in infinite loop
- Worker doing dangerous operations
- Need to reassign worker immediately
- Session ending, need clean shutdown

---

## Emergency Stop Commands

### Stop Specific Agent
```bash
# Using Makefile
make ramas-stop AGENT=worker-001
make ramas-stop AGENT=worker-002

# Using Python script directly
python scripts/ramas/python/stop_agent.py worker-001
python scripts/ramas/python/stop_agent.py worker-002
```

### Stop ALL Agents (ESC Only!)
```bash
# Using Makefile - SENDS ESC, TERMINALS STAY OPEN!
make ramas-stop-all

# Using Python script
python scripts/ramas/python/stop_agent.py --all
```

---

## 🛑 STOP vs SHUTDOWN (CRITICAL!)

**Added:** 2026-01-08 | **Discovery:** User frustrated by terminals staying open!

### Command Comparison

| Command | Action | Claude Code | Terminal | Use Case |
|---------|--------|-------------|----------|----------|
| `make ramas-stop-all` | ESC keystroke | **INTERRUPTED but RUNNING** | OPEN | Quick interrupt |
| `make ramas-shutdown` | `/exit` + close | **EXITS** | **CLOSED** | End session |
| `make ramas-stop AGENT=x` | ESC to one | Interrupted | Open | Targeted stop |

### When to Use Which

```
make ramas-stop-all    → Interrupt all, give new instructions, continue session
make ramas-shutdown    → End session completely, clean exit
```

**Memory Aid:**
```
STOP     = "Suspend Temporarily, Operation Paused" (ESC only!)
SHUTDOWN = Full power off, session complete
```

### Full Shutdown Command
```bash
# CORRECT way to end session completely:
make ramas-shutdown

# What it does:
# 1. Sends /exit to each Claude Code
# 2. Waits for graceful exit
# 3. Closes iTerm2 terminals
# 4. Cleans up temp files
```

---

## CRITICAL: ESC Key Behavior

```
1x ESC = Interrupt current operation  (CORRECT)
2x ESC = Opens "Rewind" menu          (WRONG!)
```

**Why this matters:**
- `DEFAULT_REPEAT = 1` in stop_agent.py is **INTENTIONAL**
- Never change to 2 - it triggers Claude Code's Rewind menu
- One ESC is enough to interrupt any operation

---

## Decision Tree

```
Worker not responding?
    │
    ├── Was task just assigned (<30s)?
    │   └── WAIT - Level 1 notification takes time
    │
    ├── Worker might be processing?
    │   └── Level 2: interrupt_worker() with status request
    │
    ├── Worker seems stuck (>60s)?
    │   └── Level 3: make ramas-stop AGENT=worker-xxx
    │
    └── Worker doing WRONG thing?
        └── Level 3: make ramas-stop AGENT=worker-xxx (IMMEDIATELY!)
```

---

## Who Can Use These Commands

| Role | Level 1 | Level 2 | Level 3 |
|------|---------|---------|---------|
| **Team Leader** | Assign tasks | Interrupt workers | Stop workers only |
| **VS Code (Monitor)** | Read only | Read only | Stop ANY agent |
| **Worker** | No | No | No |

---

## Response Times

| Level | Expected Response |
|-------|-------------------|
| Level 1 | <100ms (Redis) or ~500ms (interrupt fallback) |
| Level 2 | ~500ms to 2s (depends on daemon routing) |
| Level 3 | **INSTANT** (direct keystroke) |

---

## Troubleshooting

### Level 1 not working
- Check: Is worker in `wait_for_task()`?
- Check: `notification.success` in response
- Solution: Use Level 2 interrupt

### Level 2 not working
- Check: Is RabbitMQ daemon running?
- Check: Is worker polling messages?
- Solution: Use Level 3 ESC

### Level 3 not working
- Check: Is iTerm2 terminal open?
- Check: Is window focused correctly?
- Solution: Manually switch to terminal and press ESC

---

## Related Documentation

- [PATTERN-C-003 v6](PATTERN-C-003-v6.md)
- [MCP Tools Reference](MCP-TOOLS-REFERENCE.md)
- [stop_agent.py Source](../../scripts/ramas/python/stop_agent.py)

---

*3-Level Communication | PATTERN-C-003 v6 | Critical for Team Leaders!*
