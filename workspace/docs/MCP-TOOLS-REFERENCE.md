# MCP Tools Reference

**Version:** 1.0.0 | **Updated:** 2026-01-07 | **Pattern:** PATTERN-C-003 v6

---

## Tool Categories

| Category | Tools |
|----------|-------|
| Registration | `register_agent`, `get_connection_status` |
| Session Management | `create_session`, `join_session`, `leave_session`, `close_session` |
| Session Communication | `session_broadcast`, `session_message`, `poll_session_messages` |
| Task Management | `assign_session_task`, `report_task_completion`, `report_task_progress` |
| Wake/Wait | `wait_for_task`, `session_handshake` |
| Worker Control | `interrupt_worker`, `get_worker_statuses`, `set_worker_status` |

---

## Team Leader Tools

### Core Workflow

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `register_agent` | Register as team-leader | First action |
| `create_session` | Create coordination session | After registration |
| `assign_session_task` | Assign task + AUTO-NOTIFY | For each worker |
| `wait_for_task` | Wait for worker responses | After assigning |
| `poll_session_messages` | Read all messages | When woke=true |
| `close_session` | End session | When done |

### Control Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `interrupt_worker` | Send urgent message | Worker unresponsive (>30s) |
| `get_worker_statuses` | Check all workers | Monitor team status |
| `session_handshake` | v6: Sync with workers | After create_session |

---

## Worker Tools

### Core Workflow

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `register_agent` | Register as worker | First action |
| `wait_for_task` | BLOCK until task arrives | Main waiting loop |
| `join_session` | Join Team Leader's session | After wake signal |
| `poll_session_messages` | Read assigned task | After join |
| `session_broadcast` | Send results | When task complete |
| `report_task_completion` | Formal completion report | v6: Has fallback |

### Status Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `set_worker_status` | Set green/red status | After registration |
| `session_handshake` | v6: Notify Team Leader | After join_session |

---

## Tool Details

### register_agent

```javascript
register_agent(
  role: "team-leader" | "worker" | "collaborator" | "monitor",
  name: string  // e.g., "team-leader", "worker-001"
)
```

### create_session

```javascript
create_session(
  sessionName: string,           // e.g., "Keypoint Health Check"
  sessionType: "task-coordination" | "brainstorm" | "meeting",
  expectedWorkers: number        // default: 2
)
// v6: Automatically clears stale wake signals!
```

### assign_session_task

```javascript
assign_session_task(
  sessionId: string,
  title: string,
  description: string,
  assignTo: string,              // e.g., "worker-001"
  taskType: string,              // e.g., "analysis", "computation"
  priority: "critical" | "high" | "normal" | "low"
)
// AUTO-NOTIFIES worker via Redis wake signal!
```

### wait_for_task

```javascript
wait_for_task(
  sessionId: string,             // Use "*" for any session
  timeoutMs: number              // default: 30000
)
// Returns: { woke: boolean, event: string, sessionId: string, taskId: string }
// v5+: Two-phase check catches PENDING signals
```

### session_handshake (v6 NEW!)

```javascript
session_handshake(
  sessionId: string,
  handshakeType: "SESSION_READY" | "WORKER_READY" | "ACK",
  metadata: object               // e.g., { expectedWorkers: 2 }
)
// Team Leader: SESSION_READY after create_session
// Workers: WORKER_READY after join_session
```

### interrupt_worker

```javascript
interrupt_worker(
  workerId: string,              // e.g., "worker-001"
  message: string,
  priority: "normal" | "urgent"
)
// Use when worker unresponsive for 30+ seconds
```

### report_task_completion

```javascript
report_task_completion(
  sessionId: string,
  taskId: string,
  success: boolean,
  result: object,
  error: string                  // if success=false
)
// v6: Falls back to broadcast if task not found in memory
```

---

## Return Value Patterns

### Success Response

```json
{
  "success": true,
  "sessionId": "session-xxx",
  "message": "Operation completed"
}
```

### Wake Response (wait_for_task)

```json
{
  "success": true,
  "woke": true,
  "event": "task_assigned",
  "sessionId": "session-xxx",
  "taskId": "abc-123",
  "hint": "Call poll_session_messages to read the task"
}
```

### Notification Response (assign_session_task)

```json
{
  "success": true,
  "taskId": "abc-123",
  "notification": {
    "success": true,
    "method": "redis_wake",
    "message": "Worker notified successfully"
  }
}
```

### Fallback Response (report_task_completion v6)

```json
{
  "success": true,
  "taskId": "abc-123",
  "warning": "Task not found in memory, result broadcasted via fallback",
  "fallback_used": true
}
```

---

## Common Patterns

### Team Leader Pattern

```python
register_agent(role="team-leader", name="team-leader")
session = create_session(sessionName="...", expectedWorkers=2)
session_handshake(sessionId=session.id, handshakeType="SESSION_READY")

# Wait for workers to be ready
wait_for_task(sessionId=session.id)
messages = poll_session_messages(sessionId=session.id)
# Count WORKER_READY messages...

# Assign tasks
assign_session_task(sessionId=session.id, ..., assignTo="worker-001")
assign_session_task(sessionId=session.id, ..., assignTo="worker-002")

# Wait for results
wait_for_task(sessionId=session.id)
messages = poll_session_messages(sessionId=session.id)
# Aggregate results...

close_session(sessionId=session.id)
```

### Worker Pattern

```python
register_agent(role="worker", name="worker-001")
set_worker_status(workerId="worker-001", status="green")

# Wait for session
result = wait_for_task(sessionId="*")

# Join and signal ready
join_session(sessionId=result.sessionId, agentRole="worker")
session_handshake(sessionId=result.sessionId, handshakeType="WORKER_READY")

# Wait for task
result = wait_for_task(sessionId=result.sessionId)
messages = poll_session_messages(sessionId=result.sessionId)

# Process and report
# ... do work ...
session_broadcast(sessionId=..., content="RESULT: ...")
report_task_completion(sessionId=..., taskId=..., result=...)
```

---

*Reference: PATTERN-C-003 v6 | MCP Server: src/ramas/python/mcp_server.py*
