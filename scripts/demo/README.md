# Demo Scripts

Interactive demonstrations of the Claude Collective Intelligence system.

## Available Demos

### launch-claude-demo.sh (RECOMMENDED)
**Purpose:** Launch real Claude Code multi-agent demonstration
**Opens:** 3 terminals with Claude Code instances communicating via MCP

**What it demonstrates:**
- Real Claude Code instances using MCP tools
- Team Leader assigns tasks via `send_task`
- Worker processes tasks via `get_pending_tasks`
- Real-time queue monitoring via RabbitMQ

**Prerequisites:**
- Claude Code CLI installed
- RabbitMQ running (port 5672)
- MCP server configured in `.mcp.json`

**Usage:**
```bash
./launch-claude-demo.sh
```

**What happens:**
1. **Terminal 1 - Team Leader:** Opens with Claude Code
   - Instructions shown for registering as team-leader
   - Commands: `register_agent`, `send_task`, `get_messages`

2. **Terminal 2 - Worker:** Opens with Claude Code
   - Instructions shown for registering as worker
   - Commands: `register_agent`, `get_pending_tasks`, `complete_task`

3. **Terminal 3 - Monitor:** Real-time queue watcher
   - Shows queue depth, message counts, connections
   - Refreshes every 3 seconds

**Workflow Demo:**
```
Terminal 1 (Team Leader):
> MCP tool ile team-leader olarak register ol.
> Worker'a görev gönder: "Analyze user authentication patterns"

Terminal 2 (Worker):
> MCP tool ile worker olarak register ol.
> Bekleyen görevleri kontrol et.
> Görevi complete et.

Terminal 3 (Monitor):
# Shows real-time queue activity:
# agent.tasks: 1 msg → 0 msgs (worker consumed it)
# agent.results: 0 msgs → 1 msg (worker sent result)
```

---

### launch-demo.sh
**Purpose:** Quick launch script wrapper
**Simplified version of launch-claude-demo.sh**

**Usage:**
```bash
./launch-demo.sh
```

---

### demo-multi-agent.sh
**Purpose:** Legacy 4-pane Tmux demo using orchestrator.js
**Note:** Uses programmatic API, not Claude Code native

**Opens:** 4-pane Tmux window
- Pane 1: Team Leader (orchestrator.js team-leader)
- Pane 2: Worker 1 (orchestrator.js worker)
- Pane 3: Worker 2 (orchestrator.js worker)
- Pane 4: Monitor (orchestrator.js monitor)

**Usage:**
```bash
./demo-multi-agent.sh
```

**Note:** This demo uses the Node.js orchestrator.js script, not Claude Code.
For Claude Code-native demo, use `launch-claude-demo.sh` instead.

---

## Demo Scenarios

### Scenario 1: Task Distribution

**Goal:** Demonstrate load-balanced task distribution to worker pool

**Steps:**
```bash
# Terminal 1 (Team Leader)
> register_agent("team-leader")
> send_task({
    title: "Review PR #123",
    description: "Check code quality and test coverage"
  })
> send_task({
    title: "Review PR #124",
    description: "Security audit for authentication changes"
  })

# Terminal 2 (Worker 1) - Picks up first task
> register_agent("worker")
> get_pending_tasks()
# Returns: Review PR #123
> complete_task({taskId: "123", result: "PR approved"})

# Terminal 3 (Worker 2) - Picks up second task
> register_agent("worker")
> get_pending_tasks()
# Returns: Review PR #124
> complete_task({taskId: "124", result: "Security issue found"})

# Terminal 1 (Team Leader)
> get_messages()
# Returns: Both task results
```

---

### Scenario 2: Collaborative Brainstorming

**Goal:** Demonstrate multi-agent brainstorm session

**Steps:**
```bash
# Terminal 1 (Team Leader)
> register_agent("team-leader")
> start_brainstorm({
    topic: "API Design",
    question: "Should we use REST, GraphQL, or gRPC?",
    duration: 5
  })

# Terminal 2 (Collaborator 1)
> register_agent("collaborator")
# Receives brainstorm invitation automatically
> propose_idea({
    sessionId: "abc123",
    idea: "REST for simplicity, GraphQL for flexibility"
  })

# Terminal 3 (Collaborator 2)
> register_agent("collaborator")
> propose_idea({
    sessionId: "abc123",
    idea: "gRPC for performance-critical microservices"
  })

# After 5 minutes
> get_brainstorm_ideas({sessionId: "abc123"})
# Returns: All proposed ideas with timestamps
```

---

### Scenario 3: Voting & Consensus

**Goal:** Demonstrate democratic decision-making

**Steps:**
```bash
# Terminal 1 (Team Leader)
> register_agent("team-leader")
> create_vote({
    question: "Which database for production?",
    options: ["PostgreSQL", "MongoDB", "MySQL"],
    votingMethod: "confidence_weighted"
  })

# Terminal 2 (Agent 1)
> register_agent("worker")
> cast_vote({
    voteId: "vote123",
    choice: "PostgreSQL",
    confidence: 90
  })

# Terminal 3 (Agent 2)
> register_agent("worker")
> cast_vote({
    voteId: "vote123",
    choice: "PostgreSQL",
    confidence: 85
  })

# Terminal 4 (Agent 3)
> register_agent("collaborator")
> cast_vote({
    voteId: "vote123",
    choice: "MongoDB",
    confidence: 60
  })

# After voting period
> get_vote_results({voteId: "vote123"})
# Winner: PostgreSQL (confidence-weighted consensus)
```

---

## Troubleshooting

### Demo Won't Launch

**Symptom:** `launch-claude-demo.sh` fails to open terminals

**Solutions:**
1. Check if gnome-terminal installed:
   ```bash
   which gnome-terminal
   # If not found:
   sudo apt install gnome-terminal  # Ubuntu/Debian
   ```

2. Try alternative terminal:
   ```bash
   # Edit launch-claude-demo.sh
   # Replace 'gnome-terminal' with:
   #   - 'xterm' (Linux)
   #   - 'konsole' (KDE)
   #   - 'alacritty' (Modern)
   ```

3. Run in tmux instead:
   ```bash
   ./demo-multi-agent.sh
   ```

---

### Claude Code Not Responding

**Symptom:** Claude Code terminals open but don't respond to commands

**Solutions:**
1. Check Claude Code CLI installed:
   ```bash
   which claude
   claude --version
   ```

2. Verify MCP server running:
   ```bash
   ps aux | grep mcp-server
   # If not running:
   node src/core/mcp-server.js &
   ```

3. Check .mcp.json configuration:
   ```bash
   cat .mcp.json
   # Verify rabbitmq-orchestrator server configured
   ```

---

### RabbitMQ Connection Failed

**Symptom:** MCP tools report "Connection refused"

**Solutions:**
1. Check RabbitMQ running:
   ```bash
   sudo systemctl status rabbitmq-server
   # If not running:
   sudo systemctl start rabbitmq-server
   ```

2. Verify port 5672 accessible:
   ```bash
   telnet localhost 5672
   # Should connect successfully
   ```

3. Check credentials:
   ```bash
   # Test connection
   curl -u admin:rabbitmq123 http://localhost:15672/api/overview
   # Should return JSON response
   ```

---

### Monitor Pane Shows No Data

**Symptom:** Terminal 3 monitor shows "(waiting for data...)"

**Solutions:**
1. Check RabbitMQ API accessible:
   ```bash
   curl -u admin:rabbitmq123 http://localhost:15672/api/queues
   # Should return queue list
   ```

2. Enable management plugin:
   ```bash
   sudo rabbitmq-plugins enable rabbitmq_management
   ```

3. Restart RabbitMQ:
   ```bash
   sudo systemctl restart rabbitmq-server
   ```

---

## Customization

### Change Terminal Layout

Edit `launch-claude-demo.sh`:
```bash
# Current: 3 terminals (team-leader, worker, monitor)
# Add 4th terminal (collaborator):

gnome-terminal \
    --title="COLLABORATOR - Claude Code" \
    --geometry=100x30+850+550 \
    -- bash -c "
        cd $PROJECT_DIR
        echo 'Role: collaborator'
        claude
    " &
```

### Change Demo Scenario

Edit instructions shown in terminals:
```bash
# In launch-claude-demo.sh, modify echo statements:
echo '║   Tell Claude: Start brainstorm session instead     ║'
```

### Add More Workers

```bash
# Launch additional worker terminals
for i in {3..5}; do
  gnome-terminal --title="WORKER $i" -- bash -c "
    cd $PROJECT_DIR
    claude
  " &
done
```

---

## Demo Video & Slides

### Record Demo Session

```bash
# Install asciinema
sudo apt install asciinema

# Record terminal session
asciinema rec demo-session.cast

# Run demo
./launch-claude-demo.sh
# ... perform demo steps ...

# Stop recording (Ctrl+D)

# Upload to asciinema.org
asciinema upload demo-session.cast
```

### Create Presentation Slides

```bash
# Install reveal-md
npm install -g reveal-md

# Create slides
cat > demo-slides.md << 'EOF'
# Claude Collective Intelligence Demo

---

## Architecture

- Multi-agent AI collaboration
- RabbitMQ message queues
- MCP protocol integration

---

## Live Demo

(Switch to terminal)

EOF

# Present
reveal-md demo-slides.md
```

---

## Additional Demo Scenarios

See `../../examples/` for more demo scenarios:
- `5-terminal-scenario.md` - Comprehensive 5-terminal walkthrough
- `brainstorm-scenario.js` - Programmatic brainstorm example
- `voting-scenario.js` - Democratic decision-making
- `battle-scenario.js` - Competitive agent battles

---

*Last Updated: 2025-12-07*
*Part of Repository Reorganization Phase 1*
