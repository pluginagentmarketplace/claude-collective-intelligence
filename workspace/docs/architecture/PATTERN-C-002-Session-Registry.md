# PATTERN-C-002: Session Registry Isolation Fix

**Version:** 1.0.0
**Date:** 2026-01-03
**Author:** Dr. Umit Kacar
**Status:** IMPLEMENTED & VERIFIED

## Executive Summary

PATTERN-C-002 solves the **Session Registry Isolation Problem** where sessions created in one MCP server instance are invisible to other instances.

**Solution:** File-based shared registry at `/tmp/ramas-session-registry.json`

---

## Problem Statement

### Observed Behavior

```
Team Leader: create_session → Success! Session ID: session-12345
Worker-001:  join_session(session-12345) → ERROR: "Session not found"
Worker-002:  join_session(session-12345) → ERROR: "Session not found"
```

### Root Cause

Each Claude Code terminal runs its own MCP server process. The `SessionManager` stores sessions in an in-memory dictionary:

```python
# session_manager.py:225
class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, Session] = {}  # IN-MEMORY!
```

When Team Leader creates a session:
- Team Leader's `SessionManager.sessions = {"session-12345": Session}`
- Worker-001's `SessionManager.sessions = {}` (EMPTY!)
- Worker-002's `SessionManager.sessions = {}` (EMPTY!)

**Each process has its own isolated memory space.**

---

## Solution

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PATTERN-C-002 SOLUTION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Team Leader Process         Worker Processes                   │
│   ───────────────────         ────────────────                   │
│   SessionManager ─────┐                                          │
│   (in-memory)         │       SessionManager ─────┐              │
│                       │       (in-memory)         │              │
│                       ▼                           ▼              │
│              ┌────────────────────────────────────────┐          │
│              │    Shared File Registry                │          │
│              │    /tmp/ramas-session-registry.json    │          │
│              │                                        │          │
│              │    fcntl file locking                  │          │
│              │    (thread-safe, cross-process)        │          │
│              └────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

#### 1. New Module: `session_registry.py`

```python
# src/ramas/python/session_registry.py

REGISTRY_FILE = Path("/tmp/ramas-session-registry.json")
SESSION_TTL_SECONDS = 3600 * 4  # 4 hours

class SharedSessionRegistry:
    """File-based cross-process session registry"""

    def register_session(self, session_id, session_name, session_type, creator_id):
        """Write session to shared file"""
        data = self._read_registry()
        data["sessions"][session_id] = SessionInfo(...)
        self._write_registry(data)

    def get_session(self, session_id) -> Optional[SessionInfo]:
        """Read session from shared file"""
        data = self._read_registry()
        return data["sessions"].get(session_id)

    def add_participant(self, session_id, agent_id):
        """Track participant across processes"""
```

#### 2. MCP Server Integration

**In `handle_create_session`:**

```python
# After creating session locally
shared_registry = get_session_registry()
shared_registry.register_session(
    session_id=session_id,
    session_name=session_name,
    session_type=session_type,
    creator_id=STATE.agent_id,
)
```

**In `_get_session`:**

```python
async def _get_session(session_id: str) -> Optional[Session]:
    manager = await _ensure_session_manager()

    # First check local manager
    session = await manager.get_session(session_id)
    if session:
        return session

    # PATTERN-C-002: Check shared registry
    shared_registry = get_session_registry()
    session_info = shared_registry.get_session(session_id)

    if session_info:
        # Create local session from registry info
        config = SessionConfig(
            session_id=session_info.session_id,
            session_name=session_info.session_name,
            session_type=session_info.session_type,
        )
        session = await manager.create_session(config)
        return session

    return None
```

**In `handle_join_session`:**

```python
# After joining session
shared_registry = get_session_registry()
shared_registry.add_participant(session_id, STATE.agent_id)
```

---

## File Locking

Critical for thread safety across processes:

```python
import fcntl

def _read_registry(self) -> Dict:
    with open(self.registry_file, 'r') as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_SH)  # Shared lock
        try:
            return json.load(f)
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)

def _write_registry(self, data: Dict):
    with open(self.registry_file, 'w') as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)  # Exclusive lock
        try:
            json.dump(data, f, indent=2)
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
```

---

## Registry File Format

```json
{
  "sessions": {
    "session-1767470353-8879ff4d": {
      "session_id": "session-1767470353-8879ff4d",
      "session_name": "pattern-c-002-test",
      "session_type": "task-coordination",
      "creator_id": "agent-59d5d91f-...",
      "created_at": "2026-01-03T19:59:13.741174",
      "state": "active",
      "participants": [
        "agent-59d5d91f-...",
        "agent-1518b38b-...",
        "agent-8fbfe631-..."
      ],
      "metadata": {
        "expectedWorkers": 2
      },
      "updated_at": 1767470396.9646442
    }
  },
  "version": "1.0.0"
}
```

---

## Verification

### Test Results (2026-01-03)

```
📋 Active Sessions: 1
   ✅ session-1767470353-8879ff4d
      Name: pattern-c-002-test
      Creator: agent-59d5d91f-50b1-48c2-bb06-af3219037ff6
      Participants (3):
         - agent-59d5d91f-50b1-48c2-bb06-af3219037ff6  (Team Leader)
         - agent-1518b38b-2818-44d8-800a-8537493aeed0  (Worker-001)
         - agent-8fbfe631-e4c2-4ff4-97fe-08d21378c7b3  (Worker-002)
```

**Before Fix:**
- Worker: "Session session-12345 not found" ❌

**After Fix:**
- Worker: "Successfully joined session" ✅
- All 3 agents visible in registry ✅

---

## Related Patterns

| Pattern | Problem | Solution |
|---------|---------|----------|
| PATTERN-C-001 | MCP stateless connection | File-based inbox |
| **PATTERN-C-002** | **Session registry isolation** | **File-based shared registry** |

---

## Debug Commands

```bash
# View registry contents
cat /tmp/ramas-session-registry.json | python3 -m json.tool

# List sessions via CLI
python scripts/ramas/python/session_manager_cli.py list

# Get session details
python scripts/ramas/python/session_manager_cli.py get session-12345

# Cleanup expired sessions
python scripts/ramas/python/session_manager_cli.py cleanup
```

---

## Lessons Learned

1. **In-memory state doesn't survive process boundaries**
   - Each MCP server is a separate process
   - Dictionary state is not shared

2. **File-based state sharing works**
   - Simple, reliable, cross-platform
   - File locking handles concurrency

3. **Pattern consistency**
   - PATTERN-C-001 used files for inbox
   - PATTERN-C-002 uses same pattern for registry
   - Consistent architecture, easy to understand

---

## Files Changed

| File | Change |
|------|--------|
| `src/ramas/python/session_registry.py` | NEW: Shared registry module |
| `src/ramas/python/mcp_server.py` | Modified: Import registry, update handlers |

---

*Last Updated: 2026-01-03*
