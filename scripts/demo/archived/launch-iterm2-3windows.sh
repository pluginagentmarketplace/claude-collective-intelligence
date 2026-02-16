#!/bin/bash
#
# Claude Code Multi-Agent Demo Launcher (macOS iTerm2 - 3 Windows Side-by-Side)
# Opens 3 separate iTerm2 windows with Claude Code instances
# Each window positioned: LEFT (Team Leader) | CENTER (Worker 1) | RIGHT (Worker 2)
#
# Screen: 1440 x 900 (Retina scaled from 2560x1600)
# Each window: 480 x 875 pixels
#
# RAMAS Integration (2025-12-31):
# - Terminal başlıkları [GREEN]/[RED] formatında
# - Window ID'ler /tmp/ramas-windows.json'a kaydedilir
# - RAMAS Status Daemon arka planda başlatılır
#
# Created: 2025-12-31
# Updated: 2025-12-31 (RAMAS Integration)
# Author: Dr. Umit Kacar
#

PROJECT_DIR="/path/to/project"
RAMAS_REGISTRY="/tmp/ramas-windows.json"

echo "════════════════════════════════════════════════════════════════════"
echo "     Claude Code Multi-Agent Demo (iTerm2) + RAMAS Integration"
echo "     3 Windows Side-by-Side Layout with Push Notifications"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "  RAMAS: Reactive Agent Messaging & Automation System"
echo "  Features: green/red status, ESC interrupt, push notifications"
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

echo "Opening 3 iTerm2 windows side-by-side..."
echo ""

# Use AppleScript to open iTerm2 with 3 separate windows
osascript <<EOF
-- Close existing iTerm windows for clean start
tell application "iTerm2"
    close every window
end tell

delay 1

-- Create 3 separate windows side-by-side
tell application "iTerm2"
    activate

    -- Screen dimensions (Retina scaled)
    set screenWidth to 1440
    set screenHeight to 900
    set menuBarHeight to 25
    set windowWidth to 480
    set windowHeight to screenHeight - menuBarHeight

    -- Window 1: TEAM LEADER (LEFT)
    set win1 to (create window with default profile)
    tell win1
        set bounds to {0, menuBarHeight, windowWidth, screenHeight}
        tell current session
            set name to "[GREEN] TEAM-LEADER"
            write text "cd $PROJECT_DIR && echo '=== TEAM LEADER ===' && claude --dangerously-skip-permissions"
        end tell
    end tell

    delay 1

    -- Window 2: WORKER 1 (CENTER)
    set win2 to (create window with default profile)
    tell win2
        set bounds to {windowWidth, menuBarHeight, windowWidth * 2, screenHeight}
        tell current session
            set name to "[GREEN] WORKER-001"
            write text "cd $PROJECT_DIR && echo '=== WORKER 1 ===' && claude --dangerously-skip-permissions"
        end tell
    end tell

    delay 1

    -- Window 3: WORKER 2 (RIGHT)
    set win3 to (create window with default profile)
    tell win3
        set bounds to {windowWidth * 2, menuBarHeight, screenWidth, screenHeight}
        tell current session
            set name to "[GREEN] WORKER-002"
            write text "cd $PROJECT_DIR && echo '=== WORKER 2 ===' && claude --dangerously-skip-permissions"
        end tell
    end tell

end tell
EOF

echo ""
echo "✅ Demo launched!"
echo ""

# Wait for windows to be ready
sleep 2

# ═══════════════════════════════════════════════════════════════════
# RAMAS: Window ID'leri registry'ye kaydet
# ═══════════════════════════════════════════════════════════════════

echo "🔧 RAMAS: Saving window registry..."

# Get current timestamp for registry
CURRENT_TIMESTAMP=$(date +%s)

# Create temporary AppleScript file
TEMP_SCRIPT=$(mktemp /tmp/ramas_get_windows.XXXXXX.scpt)
cat > "$TEMP_SCRIPT" << 'SCRIPT_CONTENT'
tell application "iTerm2"
    set outputLines to {}
    repeat with w in windows
        set winID to id of w
        set winBounds to bounds of w
        set xPos to item 1 of winBounds
        set sessionID to id of current session of current tab of w

        if xPos < 100 then
            set workerId to "team-leader"
        else if xPos < 600 then
            set workerId to "worker-001"
        else
            set workerId to "worker-002"
        end if

        set end of outputLines to workerId & "|" & winID & "|" & sessionID
    end repeat

    set oldDelim to AppleScript's text item delimiters
    set AppleScript's text item delimiters to linefeed
    set outputText to outputLines as text
    set AppleScript's text item delimiters to oldDelim

    return outputText
end tell
SCRIPT_CONTENT

# Run AppleScript from temp file
WINDOW_DATA=$(osascript "$TEMP_SCRIPT" 2>/dev/null)
rm -f "$TEMP_SCRIPT"

# Build JSON from window data using bash
RAMAS_JSON='{"version":"1.0.0","created":'$CURRENT_TIMESTAMP',"updated":'$CURRENT_TIMESTAMP',"windows":{'
FIRST=true
while IFS='|' read -r workerId windowId sessionId; do
    if [ -n "$workerId" ]; then
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            RAMAS_JSON+=','
        fi
        RAMAS_JSON+='"'$workerId'":{"windowId":"'$windowId'","sessionId":"'$sessionId'","status":"green","registeredAt":'$CURRENT_TIMESTAMP'}'
    fi
done <<< "$WINDOW_DATA"
RAMAS_JSON+='}}'

# Save to registry file
echo "$RAMAS_JSON" > "$RAMAS_REGISTRY"
echo "✅ RAMAS Registry saved: $RAMAS_REGISTRY"
echo ""

# ═══════════════════════════════════════════════════════════════════
# RAMAS: Status Daemon başlat
# ═══════════════════════════════════════════════════════════════════

echo "🚀 RAMAS: Starting Status Daemon..."

# Kill any existing daemon
pkill -f "status-daemon.js" 2>/dev/null || true

# Start daemon in background
cd "$PROJECT_DIR"
node src/ramas/status-daemon.js > /tmp/ramas-daemon.log 2>&1 &
DAEMON_PID=$!

# Check if daemon started
sleep 1
if ps -p $DAEMON_PID > /dev/null 2>&1; then
    echo "✅ RAMAS Daemon started (PID: $DAEMON_PID)"
    echo "   Logs: /tmp/ramas-daemon.log"
else
    echo "⚠️  RAMAS Daemon failed to start. Check RabbitMQ connection."
    echo "   Try manually: node src/ramas/status-daemon.js"
fi
echo ""

# Get and display Window IDs and Session UUIDs
echo "═══════════════════════════════════════════════════════════════════"
echo "                    TERMINAL IDs (for automation)"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

osascript <<'IDEOF'
tell application "iTerm2"
    set output to ""
    repeat with w in windows
        set winID to id of w
        set winBounds to bounds of w
        set xPos to item 1 of winBounds

        -- Determine role based on x position
        if xPos < 100 then
            set role to "TEAM LEADER (LEFT)  [GREEN]"
        else if xPos < 600 then
            set role to "WORKER-001 (CENTER) [GREEN]"
        else
            set role to "WORKER-002 (RIGHT)  [GREEN]"
        end if

        -- Get session ID
        set sessionID to id of current session of current tab of w

        set output to output & "  " & role & linefeed
        set output to output & "    Window ID:  " & winID & linefeed
        set output to output & "    Session ID: " & sessionID & linefeed
        set output to output & linefeed
    end repeat
    return output
end tell
IDEOF

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "                      WINDOW LAYOUT"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  ┌────────────────┬────────────────┬────────────────┐"
echo "  │  TEAM LEADER   │   WORKER 1     │   WORKER 2     │"
echo "  │   (480x875)    │   (480x875)    │   (480x875)    │"
echo "  │      LEFT      │    CENTER      │     RIGHT      │"
echo "  └────────────────┴────────────────┴────────────────┘"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "                         WORKFLOW"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  Window 1 (TEAM LEADER - LEFT):"
echo "    > MCP tool ile team-leader olarak register ol"
echo "    > Worker'lara task gonder: send_task"
echo ""
echo "  Window 2 (WORKER 1 - CENTER):"
echo "    > MCP tool ile worker olarak register ol"
echo "    > Bekleyen task'lari al: get_pending_tasks"
echo "    > Task'i tamamla: complete_task"
echo ""
echo "  Window 3 (WORKER 2 - RIGHT):"
echo "    > MCP tool ile worker olarak register ol"
echo "    > Bekleyen task'lari al: get_pending_tasks"
echo "    > Task'i tamamla: complete_task"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "MCP Tools (Core):"
echo "  - register_agent, send_task, get_pending_tasks"
echo "  - complete_task, start_brainstorm, propose_idea"
echo "  - get_messages, get_system_status, broadcast_message"
echo ""
echo "MCP Tools (RAMAS - Push Notifications):"
echo "  - set_worker_status   : Worker'ı green/red durumuna ayarla"
echo "  - interrupt_worker    : ESC + acil mesaj gönder (priority=urgent)"
echo "  - get_worker_statuses : Tüm worker durumlarını görüntüle"
echo ""
echo "RabbitMQ Management: http://localhost:15672"
echo "  User: admin / Pass: rabbitmq123"
echo ""
echo "RAMAS Registry: $RAMAS_REGISTRY"
echo "RAMAS Daemon Logs: /tmp/ramas-daemon.log"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "                    DOCUMENTATION REFERENCES"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  📚 MCP Server Guide (HOW TO CONNECT):"
echo "     $PROJECT_DIR/docs/architecture/MCP-SERVER-GUIDE.md"
echo ""
echo "  📚 RAMAS Guide (PUSH NOTIFICATIONS):"
echo "     $PROJECT_DIR/docs/architecture/RAMAS-GUIDE.md"
echo ""
echo "  📚 Demo Scenarios:"
echo "     $PROJECT_DIR/scripts/demo/README.md"
echo ""
echo "  📚 MCP Config:"
echo "     $PROJECT_DIR/.mcp.json"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "                    EXAMPLE: ASSIGN ROLES"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  TEAM LEADER (Window 1 - LEFT):"
echo "  ─────────────────────────────────────────────────────────────────"
echo '  Sen TEAM LEADER rolündesin. Görevin:'
echo '  1. Plugin oku: /path/to/custom-plugin-ai-red-teaming'
echo '  2. Doküman oku: docs/architecture/MCP-SERVER-GUIDE.md'
echo '  3. Register ol: register_agent role=team-leader'
echo '  Başla!'
echo ""
echo "  WORKER (Window 2,3 - CENTER, RIGHT):"
echo "  ─────────────────────────────────────────────────────────────────"
echo '  Sen WORKER rolündesin. Görevin:'
echo '  1. Plugin oku: /path/to/custom-plugin-ai-engineer'
echo '  2. Doküman oku: docs/architecture/MCP-SERVER-GUIDE.md'
echo '  3. Register ol: register_agent role=worker'
echo '  4. Görevleri al: get_pending_tasks'
echo '  Başla!'
echo ""
echo "  ⚠️  IMPORTANT: After pasting instructions, press ENTER!"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "                    VERIFIED TEST (2025-12-31)"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  ✅ AI-Red-Team-Commander (team-leader) - CONNECTED"
echo "  ✅ AI-Engineer-Worker-1 (worker)       - CONNECTED"
echo "  ✅ WORKER-2-DataScience (worker)       - CONNECTED"
echo ""
echo "  All 3 agents successfully registered to RabbitMQ!"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "                    RAMAS WORKFLOW EXAMPLES"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  📊 Durum Yönetimi:"
echo "  ─────────────────────────────────────────────────────────────────"
echo "  # Worker durumlarını kontrol et"
echo "  get_worker_statuses"
echo ""
echo "  # Worker'ı meşgul olarak işaretle (red)"
echo "  set_worker_status workerId=worker-001 status=red"
echo "    → Başlık güncellenir: [RED] WORKER-001"
echo ""
echo "  # Worker'ı müsait olarak işaretle (green)"
echo "  set_worker_status workerId=worker-001 status=green"
echo "    → Başlık güncellenir: [GREEN] WORKER-001"
echo "    → Bekleyen mesajlar otomatik gönderilir"
echo ""
echo "  🔔 Interrupt (Acil Mesaj):"
echo "  ─────────────────────────────────────────────────────────────────"
echo "  # Normal interrupt (green worker'a hemen, red worker'a bekler)"
echo "  interrupt_worker workerId=worker-001 message=\"Yeni görev var!\""
echo ""
echo "  # Acil interrupt (red bile olsa ESC + mesaj)"
echo "  interrupt_worker workerId=worker-001 message=\"DURDUR!\" priority=urgent"
echo "    → ESC tuşu gönderilir, işlem kesilir"
echo "    → Mesaj yazılır ve ENTER basılır"
echo ""
echo "  📡 RAMAS Daemon Kontrolü:"
echo "  ─────────────────────────────────────────────────────────────────"
echo "  # Daemon loglarını izle"
echo "  tail -f /tmp/ramas-daemon.log"
echo ""
echo "  # Daemon'u yeniden başlat"
echo "  pkill -f status-daemon.js"
echo "  node src/ramas/status-daemon.js &"
echo ""
echo "  # Registry içeriğini görüntüle"
echo "  cat /tmp/ramas-windows.json | jq"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
