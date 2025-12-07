#!/bin/bash
#
# Claude Code Multi-Agent Demo Launcher
# Opens terminals with real Claude Code instances using MCP
#

PROJECT_DIR="/home/umit/github-umitkacar/project-12-plugin-ai-agent-rabbitmq"

echo "=========================================="
echo "  Claude Code Multi-Agent Demo"
echo "=========================================="
echo ""

# Check if Docker services are running (try with sudo if needed)
echo "Checking Docker services..."
if docker ps 2>/dev/null | grep -q agent_rabbitmq; then
    echo "Docker services OK"
elif sudo docker ps 2>/dev/null | grep -q agent_rabbitmq; then
    echo "Docker services OK (via sudo)"
else
    echo "Docker services not detected. Checking RabbitMQ directly..."
    if curl -s -u admin:rabbitmq123 "http://localhost:15672/api/overview" | grep -q "rabbitmq_version"; then
        echo "RabbitMQ is running - OK"
    else
        echo "Docker services not running. Please start them first:"
        echo "  sudo docker compose up -d"
        exit 1
    fi
fi
echo ""

# Clean any existing queues
echo "Cleaning existing queues..."
curl -s -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.tasks" 2>/dev/null
curl -s -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.results" 2>/dev/null
echo "Queues cleaned"
echo ""

echo "Opening Claude Code terminals..."
echo ""

# Terminal 1: Team Leader Claude
gnome-terminal \
    --title="TEAM LEADER - Claude Code" \
    --geometry=100x30+0+0 \
    -- bash -c "
        cd $PROJECT_DIR
        clear
        echo '╔══════════════════════════════════════════════════════════════════╗'
        echo '║               TEAM LEADER - Claude Code                          ║'
        echo '║   Multi-Agent Orchestration System                               ║'
        echo '╠══════════════════════════════════════════════════════════════════╣'
        echo '║   ROLE: team-leader                                              ║'
        echo '║   Tell Claude: MCP tool ile team-leader olarak register ol.      ║'
        echo '║   Then: Worker a gorev gonder (send_task)                        ║'
        echo '╚══════════════════════════════════════════════════════════════════╝'
        echo ''
        echo 'Starting Claude Code...'
        sleep 2
        claude
    " &

sleep 2

# Terminal 2: Worker Claude
gnome-terminal \
    --title="WORKER - Claude Code" \
    --geometry=100x30+850+0 \
    -- bash -c "
        cd $PROJECT_DIR
        clear
        echo '╔══════════════════════════════════════════════════════════════════╗'
        echo '║                  WORKER - Claude Code                            ║'
        echo '║   Multi-Agent Orchestration System                               ║'
        echo '╠══════════════════════════════════════════════════════════════════╣'
        echo '║   ROLE: worker                                                   ║'
        echo '║   Tell Claude: MCP tool ile worker olarak register ol.           ║'
        echo '║   Then: Bekleyen gorevleri kontrol et (get_pending_tasks)        ║'
        echo '╚══════════════════════════════════════════════════════════════════╝'
        echo ''
        echo 'Starting Claude Code...'
        sleep 4
        claude
    " &

sleep 1

# Terminal 3: Monitor - Real-time queue watcher
gnome-terminal \
    --title="MONITOR - Queue Watcher" \
    --geometry=100x25+0+550 \
    -- bash -c "
        cd $PROJECT_DIR
        clear
        echo '╔══════════════════════════════════════════════════════════════════╗'
        echo '║              MONITOR - Real-time Queue Watcher                   ║'
        echo '╠══════════════════════════════════════════════════════════════════╣'
        echo '║   RabbitMQ Management: http://localhost:15672                    ║'
        echo '║   User: admin / Pass: rabbitmq123                                ║'
        echo '╚══════════════════════════════════════════════════════════════════╝'
        echo ''
        echo 'Starting real-time queue monitoring...'
        echo ''

        # Real-time monitoring loop
        while true; do
            clear
            echo '═══════════════════════════════════════════════════════════════════'
            echo '                    RABBITMQ QUEUE MONITOR'
            echo '═══════════════════════════════════════════════════════════════════'
            echo ''
            echo \"Last update: \$(date '+%H:%M:%S')\"
            echo ''

            # Get queue stats
            echo '📋 QUEUES:'
            echo '─────────────────────────────────────────────────────────────────'
            curl -s -u admin:rabbitmq123 'http://localhost:15672/api/queues' 2>/dev/null | \
                python3 -c \"
import sys, json
try:
    queues = json.load(sys.stdin)
    for q in queues:
        name = q.get('name', 'unknown')
        msgs = q.get('messages', 0)
        consumers = q.get('consumers', 0)
        state = q.get('state', 'unknown')
        print(f'  {name}: {msgs} msgs, {consumers} consumers [{state}]')
    if not queues:
        print('  (no queues yet)')
except:
    print('  (waiting for data...)')
\"
            echo ''

            # Get connection count
            echo '🔌 CONNECTIONS:'
            echo '─────────────────────────────────────────────────────────────────'
            CONN_COUNT=\$(curl -s -u admin:rabbitmq123 'http://localhost:15672/api/connections' 2>/dev/null | python3 -c \"import sys,json; print(len(json.load(sys.stdin)))\" 2>/dev/null || echo '0')
            echo \"  Active connections: \$CONN_COUNT\"
            echo ''

            echo '─────────────────────────────────────────────────────────────────'
            echo 'Refreshing every 3 seconds... (Ctrl+C to stop)'

            sleep 3
        done
    " &

echo ""
echo "Demo launched!"
echo ""
echo "WORKFLOW:"
echo "  1. Team Leader terminal: Type 'claude' and register as team-leader"
echo "  2. Worker terminal: Type 'claude' and register as worker"
echo "  3. Team Leader: Send a task using send_task MCP tool"
echo "  4. Worker: Check pending tasks and complete them"
echo "  5. Team Leader: Check results using get_messages"
echo ""
echo "MCP Tools available in Claude Code:"
echo "  - register_agent, send_task, get_pending_tasks"
echo "  - complete_task, start_brainstorm, propose_idea"
echo "  - get_messages, get_system_status, broadcast_message"
echo ""
