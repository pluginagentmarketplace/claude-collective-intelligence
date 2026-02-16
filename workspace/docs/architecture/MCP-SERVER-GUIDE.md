# MCP Server Guide: Claude Code Multi-Agent Communication

This guide explains how to use the MCP Server to enable communication between multiple Claude Code terminals via RabbitMQ.

## Overview

The MCP Server bridges Claude Code instances with RabbitMQ, enabling:
- Real-time communication between Claude Code terminals
- Task distribution and load balancing
- Collaborative brainstorming sessions
- Democratic voting for decision making
- System-wide status monitoring

## Architecture

```
Terminal 1                    Terminal 2                    Terminal 3
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│   Claude Code       │      │   Claude Code       │      │   Claude Code       │
│         │           │      │         │           │      │         │           │
│   MCP Client        │      │   MCP Client        │      │   MCP Client        │
│         │           │      │         │           │      │         │           │
│   mcp__rabbitmq_*   │      │   mcp__rabbitmq_*   │      │   mcp__rabbitmq_*   │
└─────────┬───────────┘      └─────────┬───────────┘      └─────────┬───────────┘
          │                            │                            │
          └────────────────────────────┼────────────────────────────┘
                                       │
                              ┌────────▼────────┐
                              │   MCP Server    │
                              │ (mcp-server.js) │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │    RabbitMQ     │
                              │  Message Broker │
                              └─────────────────┘
```

## Prerequisites

1. **RabbitMQ Running:**
   ```bash
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
   ```

2. **Dependencies Installed:**
   ```bash
   npm install
   ```

## Configuration

The MCP Server is configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "rabbitmq-orchestrator": {
      "command": "node",
      "args": ["scripts/mcp-server.js"],
      "env": {
        "RABBITMQ_URL": "amqp://admin:rabbitmq123@localhost:5672"
      }
    }
  }
}
```

> **Note:** The URL includes credentials (admin:rabbitmq123) which match the Docker Compose configuration.

## Available Tools

### Connection & Registration

| Tool | Description |
|------|-------------|
| `register_agent` | Register as an agent (team-leader, worker, collaborator, monitor) |
| `get_connection_status` | Check connection status and agent info |
| `disconnect` | Gracefully disconnect from the system |

### Task Management

| Tool | Description |
|------|-------------|
| `send_task` | Send a task to worker agents |
| `get_pending_tasks` | Get list of pending tasks |
| `complete_task` | Mark a task as completed with result |

### Brainstorming

| Tool | Description |
|------|-------------|
| `start_brainstorm` | Start a new brainstorming session |
| `propose_idea` | Propose an idea in an active session |
| `get_brainstorm_ideas` | Get all ideas from a session |

### Voting

| Tool | Description |
|------|-------------|
| `create_vote` | Create a new voting session |
| `cast_vote` | Cast your vote |

### Communication

| Tool | Description |
|------|-------------|
| `broadcast_message` | Broadcast message to all agents |
| `get_messages` | Get received messages |

### Status & Monitoring

| Tool | Description |
|------|-------------|
| `get_system_status` | Get overall system status |
| `publish_status` | Publish your current status |

## Usage Examples

### Example 1: Basic Task Distribution

**Terminal 1 (Team Leader):**
```
1. Register as team leader:
   Use: register_agent with role="team-leader"

2. Send a task:
   Use: send_task with title="Analyze code" description="Review main.js for bugs"
```

**Terminal 2 (Worker):**
```
1. Register as worker:
   Use: register_agent with role="worker"

2. Get pending tasks:
   Use: get_pending_tasks

3. Complete the task:
   Use: complete_task with taskId="..." result="Found 3 bugs..."
```

### Example 2: Collaborative Brainstorming

**Terminal 1 (Initiator):**
```
1. Register:
   Use: register_agent with role="team-leader"

2. Start brainstorm:
   Use: start_brainstorm with topic="Architecture Design" question="How should we structure the API?"
```

**Terminal 2 (Participant):**
```
1. Register:
   Use: register_agent with role="collaborator"

2. Propose idea:
   Use: propose_idea with sessionId="..." idea="Use REST with versioning" reasoning="Better compatibility"
```

**Terminal 3 (Participant):**
```
1. Register:
   Use: register_agent with role="collaborator"

2. Propose idea:
   Use: propose_idea with sessionId="..." idea="Use GraphQL" reasoning="More flexible queries"
```

**Any Terminal - View Ideas:**
```
Use: get_brainstorm_ideas
```

### Example 3: Democratic Voting

**Terminal 1:**
```
1. Create vote:
   Use: create_vote with question="Which API style?" options=["REST", "GraphQL", "gRPC"]
```

**Terminal 2:**
```
Use: cast_vote with voteId="..." choice="GraphQL" confidence=80
```

**Terminal 3:**
```
Use: cast_vote with voteId="..." choice="REST" confidence=90
```

## Agent Roles

| Role | Capabilities |
|------|-------------|
| **team-leader** | Assign tasks, aggregate results, initiate brainstorms, create votes |
| **worker** | Execute tasks, report results, participate in brainstorms, cast votes |
| **collaborator** | Propose ideas, participate in brainstorms, cast votes, review work |
| **monitor** | View status, track metrics, generate reports |

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Multi-Agent Workflow                           │
└─────────────────────────────────────────────────────────────────────────┘

  Team Leader                    Workers                    Collaborators
  ───────────                    ───────                    ─────────────
       │                            │                            │
       │  1. register_agent         │  1. register_agent         │  1. register_agent
       │     (team-leader)          │     (worker)               │     (collaborator)
       │                            │                            │
       │  2. send_task ─────────────►  2. get_pending_tasks      │
       │     "Analyze feature X"    │     [receives task]        │
       │                            │                            │
       │                            │  3. [executes task]        │
       │                            │                            │
       │  4. [receives result] ◄────│  4. complete_task          │
       │                            │     "Analysis complete"    │
       │                            │                            │
       │  5. start_brainstorm ──────┼────────────────────────────►
       │     "Review decisions"     │                            │
       │                            │                            │
       │  6. get_brainstorm_ideas ◄─┼───── propose_idea ─────────│
       │     [aggregates ideas]     │                            │
       │                            │                            │
       │  7. create_vote ───────────┼────────────────────────────►
       │     "Select best approach" │                            │
       │                            │                            │
       │  8. [counts votes] ◄───────┼───── cast_vote ────────────│
       │                            │                            │
       ▼                            ▼                            ▼
```

## Troubleshooting

### Connection Issues

1. **RabbitMQ not running:**
   ```bash
   docker start rabbitmq
   # or
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
   ```

2. **Check RabbitMQ status:**
   - Open http://localhost:15672
   - Login: admin / rabbitmq123

3. **Connection refused:**
   - Verify RABBITMQ_URL in .mcp.json
   - Check firewall settings

### MCP Server Issues

1. **Server not starting:**
   ```bash
   node scripts/mcp-server.js
   # Should output: "RabbitMQ MCP Server started"
   ```

2. **Tools not appearing:**
   - Restart Claude Code
   - Check .mcp.json configuration

## Best Practices

1. **Always register first:** Call `register_agent` before using other tools
2. **Use appropriate roles:** Choose role based on intended function
3. **Clean disconnect:** Call `disconnect` when done
4. **Monitor status:** Use `get_system_status` to track system health
5. **Descriptive tasks:** Provide clear titles and descriptions for tasks

## Security Considerations

- RabbitMQ should be secured in production (not using guest/guest)
- Consider TLS for RabbitMQ connections
- Limit agent capabilities based on trust level

---

## macOS iTerm2 Demo (Tested & Verified)

**Date Tested:** 2025-12-31
**Status:** ✅ SUCCESS

### Quick Start (macOS)

```bash
# Run the iTerm2 demo script
./scripts/demo/launch-iterm2-3windows.sh
```

This script:
1. Checks Docker RabbitMQ status
2. Cleans existing queues
3. Opens 3 side-by-side iTerm2 windows (480x875 each)
4. Lists Window IDs for automation

### Verified Multi-Agent Configuration

| Terminal | Role | Plugin | Agent Name | Status |
|----------|------|--------|------------|--------|
| LEFT | team-leader | custom-plugin-ai-red-teaming | AI-Red-Team-Commander | ✅ Connected |
| CENTER | worker | custom-plugin-ai-engineer | AI-Engineer-Worker-1 | ✅ Connected |
| RIGHT | worker | custom-plugin-ai-data-scientist | WORKER-2-DataScience | ✅ Connected |

### Step-by-Step Instructions

**IMPORTANT: After sending instructions to Claude, press ENTER to execute!**

1. **Assign Role (Example for Team Leader):**
```
Sen TEAM LEADER rolündesin. Görevin:

1. Önce şu plugin'i oku ve anla: /path/to/custom-plugin-ai-red-teaming

2. Bu plugin'den sorumlusun - AI Red Teaming ve güvenlik testleri

3. Sonra RabbitMQ'ya bağlan. Şu dokümantasyonu oku:
   /path/to/docs/architecture/MCP-SERVER-GUIDE.md

4. MCP tool ile team-leader olarak register ol: register_agent role=team-leader

Başla!
```

2. **Claude will execute:**
   - Read the assigned plugin
   - Read MCP-SERVER-GUIDE.md
   - Call `register_agent` with appropriate role
   - Call `publish_status` to announce availability
   - Call `get_pending_tasks` (for workers)

### Successful Registration Output

```json
{
  "success": true,
  "agentId": "agent-b4b6d3da-9108-4be3-8962-232a81dd312c",
  "agentName": "AI-Red-Team-Commander",
  "role": "team-leader",
  "message": "Connected as AI-Red-Team-Commander (team-leader)"
}
```

---

## Known Issues & Workarounds

### Issue 1: Circular JSON Error

**Symptom:**
```
"error": "Converting circular structure to JSON
    --> starting at object with constructor 'Channel'
    |     property 'connection' -> object with constructor 'Connection'
    --- property 'channel' closes the circle"
```

**Affected Tools:**
- `get_system_status`
- `get_connection_status`

**Workaround:** These tools have a JSON serialization bug. Use alternative methods:
- Check RabbitMQ Management UI: http://localhost:15672
- Use `get_messages` and `get_pending_tasks` which work correctly

**Status:** Bug in MCP server - needs fix in `src/core/mcp-server.js`

### Issue 2: AppleScript ENTER Key

**Symptom:** Instructions sent to iTerm2 but not executed

**Cause:** `write text` in AppleScript sends text but may not always trigger execution

**Solution:** Always send an empty `write text ""` after instructions to ensure ENTER is pressed

```applescript
tell current session
    write text "your command here"
    write text ""  -- Press ENTER
end tell
```

---

## Related Files

| File | Purpose |
|------|---------|
| `.mcp.json` | MCP server configuration |
| `src/core/mcp-server.js` | MCP server implementation |
| `scripts/demo/launch-iterm2-3windows.sh` | macOS iTerm2 demo (3 windows) |
| `scripts/demo/launch-iterm2-demo.sh` | macOS iTerm2 demo (3 tabs) |
| `scripts/demo/launch-claude-demo.sh` | Linux gnome-terminal demo |
| `scripts/demo/README.md` | Demo scenarios documentation |

---

## RabbitMQ Management

**URL:** http://localhost:15672
**Credentials:** admin / rabbitmq123

### Useful API Endpoints

```bash
# Check queues
curl -s -u admin:rabbitmq123 http://localhost:15672/api/queues

# Check connections
curl -s -u admin:rabbitmq123 http://localhost:15672/api/connections

# Check overview
curl -s -u admin:rabbitmq123 http://localhost:15672/api/overview
```

---

*Last Updated: 2025-12-31*
*Tested on: macOS with iTerm2, Claude Code v2.0.76, Opus 4.5*
