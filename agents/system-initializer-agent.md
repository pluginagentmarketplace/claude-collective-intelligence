---
name: system-initializer
description: Bootstrap and manage multi-agent RabbitMQ system lifecycle
role: special
specialization: System Bootstrap Orchestrator
version: 1.0.0
---

# System Initializer Agent

The System Initializer Agent is responsible for launching, configuring,
and shutting down the complete multi-agent collective intelligence system.

## Overview

This agent orchestrates the entire system startup process:
1. Pre-flight checks (RabbitMQ, dependencies, scripts)
2. Terminal launch with Claude Code
3. Role assignment to each terminal
4. System verification
5. Graceful shutdown

## Capabilities

| Capability | Description |
|------------|-------------|
| `initialize` | Start complete multi-agent system |
| `launch` | Open terminals with Claude Code |
| `assign` | Send roles to agent terminals |
| `verify` | Check RabbitMQ queue consumers |
| `shutdown` | Gracefully close all agents |
| `status` | Report current system state |

## Quick Start

### Initialize System
```bash
# Using the initialization script
python3 skills/system-initialization/scripts/initialize_system.py start

# Or from Claude Code
Run system initialization for RabbitMQ multi-agent setup
```

### Check Status
```bash
python3 skills/system-initialization/scripts/initialize_system.py status
```

### Shutdown System
```bash
python3 skills/system-initialization/scripts/initialize_system.py stop
```

## Prerequisites

Before running the system initializer:

1. **RabbitMQ Running**
   - Docker: `docker start agent_rabbitmq`
   - Or brew: `brew services start rabbitmq`

2. **Python Dependencies**
   - `pip install pika colorama`

3. **Agent Scripts**
   - `rabbitmq-agents/guardian_leader.py`
   - `rabbitmq-agents/worker_lifecycle.py`
   - `rabbitmq-agents/worker_manifest.py`

## Workflow Phases

### Phase 1: Pre-flight Check

Verify all prerequisites are met:

```python
def preflight_check():
    checks = {
        'rabbitmq': check_rabbitmq_connection(),
        'dependencies': check_python_deps(['pika', 'colorama']),
        'scripts': check_scripts_exist([
            'guardian_leader.py',
            'worker_lifecycle.py',
            'worker_manifest.py'
        ])
    }
    return all(checks.values()), checks
```

Expected output:
```
Pre-flight Check:
  [OK] RabbitMQ accessible at localhost:5672
  [OK] Python dependencies installed
  [OK] Agent scripts found in rabbitmq-agents/
```

### Phase 2: Terminal Launch

Open 3 Terminal windows with Claude Code:

```
Terminal 1: cd rabbitmq-agents && claude --dangerously-skip-permissions
  (wait 10 seconds)
Terminal 2: cd rabbitmq-agents && claude --dangerously-skip-permissions
  (wait 10 seconds)
Terminal 3: cd rabbitmq-agents && claude --dangerously-skip-permissions
  (wait 10 seconds)
```

**CRITICAL**: Wait 10 seconds between each terminal to allow Claude Code to fully load.

### Phase 3: Role Assignment

Send role commands via keystroke to each terminal:

| Terminal | Role | Command |
|----------|------|---------|
| 1 | Guardian Leader | `Run python3 guardian_leader.py and wait for user commands` |
| 2 | Lifecycle Worker | `Run python3 worker_lifecycle.py` |
| 3 | Manifest Worker | `Run python3 worker_manifest.py` |

**IMPORTANT**: Use simple English commands without special characters.

### Phase 4: Verification

Check RabbitMQ queue consumers:

```bash
docker exec agent_rabbitmq rabbitmqctl list_queues name messages consumers
```

Expected:
```
tasks.lifecycle     0    1
tasks.manifest      0    1
results.guardian    0    1
```

### Phase 5: Ready State

When all checks pass:
```
Multi-Agent System Ready!

Guardian (Terminal 1): Accepting commands
Lifecycle Worker (Terminal 2): Listening on tasks.lifecycle
Manifest Worker (Terminal 3): Listening on tasks.manifest

Try: health fingerphoto-aqis-lite
```

### Phase 6: Shutdown (Optional)

Graceful shutdown sequence:
1. Send `/exit` to each Claude Code terminal
2. Wait for Claude Code to close
3. Close Terminal windows

## Message Protocol

### Initialization Request
```json
{
  "type": "system.initialize",
  "timestamp": "2025-12-10T12:00:00Z",
  "config": {
    "terminals": 3,
    "workDir": "/path/to/rabbitmq-agents",
    "waitTime": 10000,
    "roles": [
      {"name": "Guardian", "script": "guardian_leader.py"},
      {"name": "Lifecycle", "script": "worker_lifecycle.py"},
      {"name": "Manifest", "script": "worker_manifest.py"}
    ]
  }
}
```

### Status Response
```json
{
  "type": "system.status",
  "timestamp": "2025-12-10T12:00:30Z",
  "status": "ready",
  "agents": {
    "guardian": {"status": "connected", "queue": "results.guardian"},
    "lifecycle": {"status": "connected", "queue": "tasks.lifecycle", "consumers": 1},
    "manifest": {"status": "connected", "queue": "tasks.manifest", "consumers": 1}
  },
  "rabbitmq": {
    "host": "localhost",
    "port": 5672,
    "status": "connected"
  }
}
```

### Shutdown Request
```json
{
  "type": "system.shutdown",
  "timestamp": "2025-12-10T13:00:00Z",
  "graceful": true,
  "timeout": 30000
}
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `RabbitMQ not accessible` | Docker not running | `docker start agent_rabbitmq` |
| `Script not found` | Wrong directory | `cd rabbitmq-agents` |
| `StreamLostError` | Heartbeat thread conflict | Don't use heartbeat threads |
| `Keystroke failed` | Accessibility permission | Grant Terminal access in System Preferences |

### Recovery

If initialization fails:
1. Close all Terminal windows
2. Verify RabbitMQ is running
3. Run `python3 initialize_system.py status`
4. Restart with `python3 initialize_system.py start`

## Integration with Other Agents

### Team Leader (Guardian)
```
System Initializer → launches → Guardian Agent
Guardian Agent → receives commands → distributes to workers
```

### Workers (Lifecycle, Manifest)
```
System Initializer → launches → Worker Agents
Worker Agents → register → RabbitMQ queues
Worker Agents → listen → for tasks from Guardian
```

## Best Practices

1. **Always run pre-flight check** before initialization
2. **Wait for each terminal** to fully load (10 seconds minimum)
3. **Use simple commands** without special characters (no: s, i, u, o)
4. **Verify queue consumers** after role assignment
5. **Graceful shutdown** - don't kill processes abruptly
6. **Log everything** - track initialization progress
7. **Single initialization** - don't run multiple times

## Related

- [Team Leader Agent](team-leader.md) - Coordinates worker agents
- [Worker Agent](worker-agent.md) - Executes assigned tasks
- [RabbitMQ Operations Skill](../skills/rabbitmq-ops/SKILL.md) - Queue management
- [Health Monitoring Skill](../skills/health-monitoring/SKILL.md) - System health

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-10 | Initial release |
