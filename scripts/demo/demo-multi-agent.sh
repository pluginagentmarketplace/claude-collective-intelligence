#!/bin/bash
#
# Multi-Agent Orchestration Demo
# Creates a tmux session with multiple panes showing different roles
#

SESSION_NAME="agent-demo"
PROJECT_DIR="/home/umit/github-umitkacar/project-12-plugin-ai-agent-rabbitmq"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Multi-Agent Orchestration Demo${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Kill existing session if exists
tmux kill-session -t $SESSION_NAME 2>/dev/null

# Create new tmux session
tmux new-session -d -s $SESSION_NAME -x 200 -y 50

# Rename first window
tmux rename-window -t $SESSION_NAME:0 'Agent-Orchestration'

# Split into 4 panes (2x2 grid)
tmux split-window -h -t $SESSION_NAME:0
tmux split-window -v -t $SESSION_NAME:0.0
tmux split-window -v -t $SESSION_NAME:0.1

# Pane 0 (top-left): Team Leader
tmux send-keys -t $SESSION_NAME:0.0 "cd $PROJECT_DIR && clear" C-m
tmux send-keys -t $SESSION_NAME:0.0 "echo -e '${YELLOW}╔════════════════════════════════════╗${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.0 "echo -e '${YELLOW}║     👔 TEAM LEADER                 ║${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.0 "echo -e '${YELLOW}║  Coordinates tasks & results       ║${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.0 "echo -e '${YELLOW}╚════════════════════════════════════╝${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.0 "echo ''" C-m
tmux send-keys -t $SESSION_NAME:0.0 "AGENT_ID=leader-001 AGENT_NAME='Team-Leader' AGENT_TYPE=leader node scripts/orchestrator.js" C-m

# Pane 1 (top-right): Worker 1
tmux send-keys -t $SESSION_NAME:0.1 "cd $PROJECT_DIR && clear" C-m
tmux send-keys -t $SESSION_NAME:0.1 "echo -e '${CYAN}╔════════════════════════════════════╗${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.1 "echo -e '${CYAN}║     ⚙️  WORKER 1                   ║${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.1 "echo -e '${CYAN}║  Processes tasks                   ║${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.1 "echo -e '${CYAN}╚════════════════════════════════════╝${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.1 "echo ''" C-m
tmux send-keys -t $SESSION_NAME:0.1 "sleep 2 && AGENT_ID=worker-001 AGENT_NAME='Worker-Alpha' node scripts/orchestrator.js" C-m

# Pane 2 (bottom-left): Worker 2
tmux send-keys -t $SESSION_NAME:0.2 "cd $PROJECT_DIR && clear" C-m
tmux send-keys -t $SESSION_NAME:0.2 "echo -e '${GREEN}╔════════════════════════════════════╗${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.2 "echo -e '${GREEN}║     ⚙️  WORKER 2                   ║${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.2 "echo -e '${GREEN}║  Processes tasks                   ║${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.2 "echo -e '${GREEN}╚════════════════════════════════════╝${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.2 "echo ''" C-m
tmux send-keys -t $SESSION_NAME:0.2 "sleep 3 && AGENT_ID=worker-002 AGENT_NAME='Worker-Beta' node scripts/orchestrator.js" C-m

# Pane 3 (bottom-right): Task Sender / Monitor
tmux send-keys -t $SESSION_NAME:0.3 "cd $PROJECT_DIR && clear" C-m
tmux send-keys -t $SESSION_NAME:0.3 "echo -e '${PURPLE}╔════════════════════════════════════╗${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.3 "echo -e '${PURPLE}║     📋 TASK SENDER / MONITOR       ║${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.3 "echo -e '${PURPLE}║  Send tasks and watch results      ║${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.3 "echo -e '${PURPLE}╚════════════════════════════════════╝${NC}'" C-m
tmux send-keys -t $SESSION_NAME:0.3 "echo ''" C-m
tmux send-keys -t $SESSION_NAME:0.3 "echo 'Waiting for agents to start...'" C-m
tmux send-keys -t $SESSION_NAME:0.3 "sleep 6 && echo '' && echo 'Ready to send tasks!' && echo 'Run: node scripts/send-task.js'" C-m

# Set pane titles (requires tmux 2.6+)
tmux select-pane -t $SESSION_NAME:0.0 -T "👔 TEAM LEADER"
tmux select-pane -t $SESSION_NAME:0.1 -T "⚙️ WORKER 1"
tmux select-pane -t $SESSION_NAME:0.2 -T "⚙️ WORKER 2"
tmux select-pane -t $SESSION_NAME:0.3 -T "📋 TASK SENDER"

# Enable pane border status
tmux set-option -t $SESSION_NAME pane-border-status top
tmux set-option -t $SESSION_NAME pane-border-format " #{pane_title} "

echo ""
echo -e "${GREEN}Demo session created!${NC}"
echo ""
echo -e "To attach to the session, run:"
echo -e "  ${CYAN}tmux attach -t $SESSION_NAME${NC}"
echo ""
echo -e "To send tasks, go to the bottom-right pane and run:"
echo -e "  ${CYAN}node scripts/send-task.js${NC}"
echo ""
echo -e "To kill the session:"
echo -e "  ${RED}tmux kill-session -t $SESSION_NAME${NC}"
echo ""

# Attach to session
tmux attach -t $SESSION_NAME
