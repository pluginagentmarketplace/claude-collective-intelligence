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
        "RABBITMQ_URL": "amqp://localhost:5672"
      }
    }
  }
}
```

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
   - Login: guest / guest

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
