#!/bin/bash
#
# Multi-Agent Demo Launcher
# Opens 5 independent terminal windows with different roles
#

PROJECT_DIR="/path/to/project"

echo "=========================================="
echo "  🚀 Multi-Agent Orchestration Demo"
echo "=========================================="
echo ""

# Check if Docker services are running
echo "Checking Docker services..."
if ! docker ps | grep -q agent_rabbitmq; then
    echo "⚠️  Docker services not running. Starting..."
    cd $PROJECT_DIR
    sudo docker compose up -d
    sleep 5
fi
echo "✅ Docker services OK"
echo ""

# Terminal positions (adjust for your screen)
# Format: --geometry=COLSxROWS+X+Y

echo "🖥️  Opening terminal windows..."
echo ""

# Terminal 1: MCP Server (top-left)
gnome-terminal \
    --title="🔌 MCP SERVER" \
    --geometry=80x20+0+0 \
    -- bash -c "
        cd $PROJECT_DIR
        echo '╔══════════════════════════════════════╗'
        echo '║        🔌 MCP SERVER                 ║'
        echo '║   Model Context Protocol Server      ║'
        echo '╚══════════════════════════════════════╝'
        echo ''
        echo 'Starting MCP Server...'
        sleep 2
        node scripts/mcp-server.js
        exec bash
    " &

sleep 1

# Terminal 2: Team Leader (top-center)
gnome-terminal \
    --title="👔 TEAM LEADER" \
    --geometry=80x20+700+0 \
    -- bash -c "
        cd $PROJECT_DIR
        echo '╔══════════════════════════════════════╗'
        echo '║        👔 TEAM LEADER                ║'
        echo '║   Coordinates tasks & results        ║'
        echo '╚══════════════════════════════════════╝'
        echo ''
        echo 'Starting Team Leader...'
        sleep 3
        AGENT_ID=leader-001 AGENT_NAME='Team-Leader' AGENT_TYPE=leader node scripts/orchestrator.js
        exec bash
    " &

sleep 1

# Terminal 3: Worker 1 (bottom-left)
gnome-terminal \
    --title="⚙️ WORKER-1 (Alpha)" \
    --geometry=80x20+0+450 \
    -- bash -c "
        cd $PROJECT_DIR
        echo '╔══════════════════════════════════════╗'
        echo '║        ⚙️  WORKER 1 - Alpha          ║'
        echo '║   Processes assigned tasks           ║'
        echo '╚══════════════════════════════════════╝'
        echo ''
        echo 'Starting Worker Alpha...'
        sleep 4
        AGENT_ID=worker-001 AGENT_NAME='Worker-Alpha' node scripts/orchestrator.js
        exec bash
    " &

sleep 1

# Terminal 4: Worker 2 (bottom-center)
gnome-terminal \
    --title="⚙️ WORKER-2 (Beta)" \
    --geometry=80x20+700+450 \
    -- bash -c "
        cd $PROJECT_DIR
        echo '╔══════════════════════════════════════╗'
        echo '║        ⚙️  WORKER 2 - Beta           ║'
        echo '║   Processes assigned tasks           ║'
        echo '╚══════════════════════════════════════╝'
        echo ''
        echo 'Starting Worker Beta...'
        sleep 5
        AGENT_ID=worker-002 AGENT_NAME='Worker-Beta' node scripts/orchestrator.js
        exec bash
    " &

sleep 1

# Terminal 5: Task Sender / Monitor (right side)
gnome-terminal \
    --title="📋 TASK SENDER" \
    --geometry=80x45+1400+0 \
    -- bash -c "
        cd $PROJECT_DIR
        echo '╔══════════════════════════════════════╗'
        echo '║        📋 TASK SENDER                ║'
        echo '║   Send tasks & monitor results       ║'
        echo '╚══════════════════════════════════════╝'
        echo ''
        echo 'Waiting for all agents to start...'
        sleep 8
        echo ''
        echo '✅ All agents should be ready!'
        echo ''
        echo 'Starting Task Sender...'
        echo ''
        node scripts/send-task.js
        exec bash
    " &

echo ""
echo "✅ Demo launched!"
echo ""
echo "Terminal Windows:"
echo "  🔌 MCP Server     - Model Context Protocol"
echo "  👔 Team Leader    - Coordinates everything"
echo "  ⚙️  Worker Alpha   - Processes tasks"
echo "  ⚙️  Worker Beta    - Processes tasks"
echo "  📋 Task Sender    - Send tasks interactively"
echo ""
echo "In Task Sender terminal:"
echo "  Press 1 → Send single task"
echo "  Press 5 → Send 5 tasks"
echo "  Press 10 → Send 10 tasks (load test)"
echo ""
