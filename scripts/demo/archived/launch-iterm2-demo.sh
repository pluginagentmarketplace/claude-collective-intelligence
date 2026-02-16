#!/bin/bash
#
# Claude Code Multi-Agent Demo Launcher (macOS iTerm2 Version)
# Opens 3 iTerm2 tabs with Claude Code instances using MCP
# Uses --dangerously-skip-permissions for seamless demo
#

PROJECT_DIR="/path/to/project"

echo "=========================================="
echo "  Claude Code Multi-Agent Demo (iTerm2)"
echo "=========================================="
echo ""

# Check if Docker services are running
echo "Checking Docker services..."
if docker ps 2>/dev/null | grep -q agent_rabbitmq; then
    echo "✅ RabbitMQ Docker: Running"
else
    echo "❌ RabbitMQ not running. Starting..."
    cd "$PROJECT_DIR"
    docker compose -f infrastructure/docker/compose/docker-compose.yml up -d rabbitmq redis postgres
    sleep 10
    echo "✅ Docker services started"
fi
echo ""

# Clean any existing queues
echo "Cleaning existing queues..."
curl -s -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.tasks" 2>/dev/null
curl -s -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.results" 2>/dev/null
echo "✅ Queues cleaned"
echo ""

echo "Opening iTerm2 with 3 Claude Code sessions..."
echo ""

# Use AppleScript to open iTerm2 with 3 tabs
osascript <<EOF
tell application "iTerm2"
    activate

    -- Create new window
    set newWindow to (create window with default profile)

    tell newWindow
        -- Tab 1: TEAM LEADER
        tell current session
            write text "clear"
            write text "echo '╔══════════════════════════════════════════════════════════════════╗'"
            write text "echo '║               TEAM LEADER - Claude Code                          ║'"
            write text "echo '║   Multi-Agent Orchestration System                               ║'"
            write text "echo '╠══════════════════════════════════════════════════════════════════╣'"
            write text "echo '║   ROLE: team-leader                                              ║'"
            write text "echo '║   Claude will auto-register and can send tasks to workers        ║'"
            write text "echo '╚══════════════════════════════════════════════════════════════════╝'"
            write text "echo ''"
            write text "cd $PROJECT_DIR"
            write text "echo 'Starting Claude Code as TEAM LEADER...'"
            write text "sleep 2 && claude --dangerously-skip-permissions"
        end tell

        -- Tab 2: WORKER 1
        delay 1
        set worker1Tab to (create tab with default profile)
        tell current session
            write text "clear"
            write text "echo '╔══════════════════════════════════════════════════════════════════╗'"
            write text "echo '║               WORKER 1 - Claude Code                             ║'"
            write text "echo '║   Multi-Agent Orchestration System                               ║'"
            write text "echo '╠══════════════════════════════════════════════════════════════════╣'"
            write text "echo '║   ROLE: worker                                                   ║'"
            write text "echo '║   Claude will auto-register and process pending tasks            ║'"
            write text "echo '╚══════════════════════════════════════════════════════════════════╝'"
            write text "echo ''"
            write text "cd $PROJECT_DIR"
            write text "echo 'Starting Claude Code as WORKER 1...'"
            write text "sleep 4 && claude --dangerously-skip-permissions"
        end tell

        -- Tab 3: WORKER 2
        delay 1
        set worker2Tab to (create tab with default profile)
        tell current session
            write text "clear"
            write text "echo '╔══════════════════════════════════════════════════════════════════╗'"
            write text "echo '║               WORKER 2 - Claude Code                             ║'"
            write text "echo '║   Multi-Agent Orchestration System                               ║'"
            write text "echo '╠══════════════════════════════════════════════════════════════════╣'"
            write text "echo '║   ROLE: worker                                                   ║'"
            write text "echo '║   Claude will auto-register and process pending tasks            ║'"
            write text "echo '╚══════════════════════════════════════════════════════════════════╝'"
            write text "echo ''"
            write text "cd $PROJECT_DIR"
            write text "echo 'Starting Claude Code as WORKER 2...'"
            write text "sleep 6 && claude --dangerously-skip-permissions"
        end tell
    end tell
end tell
EOF

echo ""
echo "✅ Demo launched!"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "                         WORKFLOW"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  Tab 1 (TEAM LEADER):"
echo "    > MCP tool ile team-leader olarak register ol"
echo "    > Worker'lara task gönder: send_task"
echo ""
echo "  Tab 2 (WORKER 1):"
echo "    > MCP tool ile worker olarak register ol"
echo "    > Bekleyen task'ları al: get_pending_tasks"
echo "    > Task'ı tamamla: complete_task"
echo ""
echo "  Tab 3 (WORKER 2):"
echo "    > MCP tool ile worker olarak register ol"
echo "    > Bekleyen task'ları al: get_pending_tasks"
echo "    > Task'ı tamamla: complete_task"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "MCP Tools:"
echo "  - register_agent, send_task, get_pending_tasks"
echo "  - complete_task, start_brainstorm, propose_idea"
echo "  - get_messages, get_system_status, broadcast_message"
echo ""
echo "RabbitMQ Management: http://localhost:15672"
echo "  User: admin / Pass: rabbitmq123"
echo ""
