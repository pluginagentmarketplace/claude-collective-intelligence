# 🧠 Claude Collective Intelligence

### AI Agent Swarm Framework for Claude Code - RAMAS v6

**Transform isolated Claude Code sessions into a collaborative AI collective** via RabbitMQ message queues. Real-time dashboard, brainstorming, democratic voting, mentorship acceleration, competitive battles, and gamification - achieving emergent intelligence greater than any single agent.

> *"Collective Intelligence: When multiple Claude instances collaborate through brainstorming, voting, and mentorship, the whole becomes exponentially greater than the sum of its parts."*

[![Custom License](https://img.shields.io/badge/License-Custom-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-green.svg)](https://python.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.12+-orange.svg)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-7+-red.svg)](https://redis.io/)

---

## 🆕 What's New in RAMAS v6 (2026-01-09)

| Feature | Description |
|---------|-------------|
| 🖥️ **Real-Time Dashboard** | React 19 + FastAPI monitoring dashboard with animations |
| 🎨 **Color Coding System** | Role-based agent colors (Team Leader=Blue, Workers=Green/Amber) |
| 📡 **3-Level Communication** | RabbitMQ → Interrupt → ESC (guaranteed delivery) |
| 🤝 **Handshake Protocol** | SESSION_READY → WORKER_READY reliable join |
| 📋 **Template System v6.2** | Standardized agent prompts with discipline rules |
| ⚡ **<100ms Wake Latency** | Redis Streams XREAD BLOCK instant notification |

---

## 🎯 8 AI Mechanisms

| Mechanism | Description |
|-----------|-------------|
| 🧠 **Brainstorm** | Multi-agent idea generation & combination |
| 🗳️ **Voting** | 5 algorithms (Simple, Confidence, Quadratic, Consensus, Ranked) |
| 🎁 **Rewards** | Gamification with tiers (Bronze → Silver → Gold → Platinum) |
| ⚠️ **Penalties** | 6 progressive levels + retraining curriculum |
| 🎓 **Mentorship** | 10x training acceleration (30 days → 3 days) |
| ⚔️ **Battle** | 1v1 duels, Speed Race, Leaderboards, Hall of Fame |
| 📊 **Leaderboard** | ELO ratings, rankings, performance tracking |
| 🎭 **Orchestrator** | Task distribution, agent coordination |

---

## 🏗️ Architecture (PATTERN-C-003 v6)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    RAMAS v6 - COLLECTIVE INTELLIGENCE                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌─────────────┐     RabbitMQ      ┌─────────────┐     Redis            │
│   │ Team Leader │◄───────────────►  │   Workers   │◄──────────►  Streams │
│   │     👑      │     Messages      │   ⚙️ 🎨     │     Wake             │
│   │  (Blue)     │                   │ (Green/Amber)│    Signals           │
│   └──────┬──────┘                   └──────┬──────┘                       │
│          │                                  │                              │
│          │         ┌────────────────────────┘                              │
│          │         │                                                       │
│          ▼         ▼                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐    │
│   │                    Real-Time Dashboard                           │    │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐    │    │
│   │  │ Agent   │  │ Session │  │ Workflow│  │  Message Feed   │    │    │
│   │  │ Cards   │  │ Panel   │  │ Timeline│  │  (Color Coded)  │    │    │
│   │  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘    │    │
│   └─────────────────────────────────────────────────────────────────┘    │
│                              http://localhost:3000                        │
│                                                                           │
│   Mission Control (VS Code)                                               │
│   ┌─────────────┐                                                        │
│   │     👁️      │  Monitors all agents, sends interrupts, coordinates    │
│   │  (Violet)   │                                                        │
│   └─────────────┘                                                        │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (5 Minutes!)

### 1. Prerequisites

```bash
# Start Docker services (RabbitMQ + Redis)
docker compose -f infrastructure/docker/compose/docker-compose.yml up -d

# Activate Python environment
source .venv-ramas/bin/activate
uv pip install -r src/ramas/python/requirements.txt
```

### 2. Launch Multi-Agent System

```bash
# Launch 3-window demo (Team Leader + 2 Workers)
python scripts/ramas/python/launch_windows.py
```

### 3. Start Dashboard (Optional)

```bash
# Terminal 1: Backend
cd workspace/dashboard/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd workspace/dashboard/frontend
npm run dev
# Open http://localhost:3000
```

---

## 🖥️ Real-Time Dashboard

The dashboard provides visual monitoring of all RAMAS agents:

### Features

| Component | Description |
|-----------|-------------|
| **Agent Cards** | Status (green/red), role icon, window ID |
| **Session Panel** | Active sessions, participants, state |
| **Workflow Timeline** | Animated progress indicators |
| **Message Feed** | Live message stream with sender colors |

### Color Coding System

| Role | Color | Icon | Tailwind Class |
|------|-------|------|----------------|
| Team Leader | 🔵 Blue | 👑 | `blue-500` |
| Worker-001 | 🟢 Emerald | ⚙️ | `emerald-500` |
| Worker-002 | 🟠 Amber | 🎨 | `amber-500` |
| Mission Control | 💜 Violet | 👁️ | `violet-500` |
| URGENT | 🔴 Red | 🚨 | `red-500` + pulse |

### Tech Stack

- **Backend:** FastAPI + WebSocket + Python 3.11+
- **Frontend:** React 19 + Framer Motion + Tailwind CSS
- **Real-time:** WebSocket with REST fallback

---

## 📡 3-Level Communication Hierarchy

| Level | Method | Reliability | Use Case |
|-------|--------|-------------|----------|
| **1** | RabbitMQ Task | Agent must be polling | Normal task distribution |
| **2** | RabbitMQ Interrupt | Agent must be polling | Urgent notifications |
| **3** | Direct ESC | **ALWAYS WORKS** | Emergency stop, stuck agents |

```bash
# Level 3: Emergency Stop (Always works!)
make ramas-stop AGENT=worker-002
make ramas-stop-all
make ramas-shutdown  # Full cleanup
```

---

## 📋 Template System (v6.2)

Standardized agent prompts in `workspace/templates/`:

| Template | Purpose |
|----------|---------|
| `TEAM_LEADER.md` | Coordination, task assignment, brainstorm facilitation |
| `WORKER.md` | Task execution, reporting, discipline rules |
| `MISSION_CONTROL.md` | VS Code monitoring, interrupt commands |
| `PRE_TASK_RULES.md` | Pre-task checklist and discipline |
| `TASK.md` | Task definition template |

---

## 🤝 Handshake Protocol

Reliable session join with race condition prevention:

```
Mission Control: create_session()
       │
       ▼
Team Leader: SESSION_READY broadcast
       │
       ▼
Workers: join_session() + WORKER_READY
       │
       ▼
All Ready: Task assignment begins
```

---

## 🔧 MCP Tools (40+ Available)

### Session Management

| Tool | Description |
|------|-------------|
| `create_session` | Create coordination session |
| `join_session` | Join existing session |
| `session_handshake` | SESSION_READY/WORKER_READY protocol |
| `close_session` | End session gracefully |

### Task Management

| Tool | Description |
|------|-------------|
| `assign_session_task` | Assign task + AUTO-NOTIFY worker |
| `wait_for_task` | BLOCK until wake signal (v6) |
| `report_task_completion` | Report result + WAKE Team Leader |

### Communication

| Tool | Description |
|------|-------------|
| `session_broadcast` | Send to all + WAKE all agents |
| `interrupt_worker` | Level-2 urgent notification |
| `poll_session_messages` | Get pending messages |

### Brainstorming

| Tool | Description |
|------|-------------|
| `start_brainstorm` | Initiate collaborative session |
| `propose_idea` | Submit idea to brainstorm |
| `create_vote` | Create voting session |
| `cast_vote` | Vote on decision |

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| 📖 [RAMAS Index](workspace/docs/RAMAS-INDEX.md) | Central navigation hub |
| 🏗️ [PATTERN-C-003 v6](workspace/docs/PATTERN-C-003-v6.md) | Architecture reference |
| 📡 [3-Level Communication](workspace/docs/3-LEVEL-COMMUNICATION.md) | Communication hierarchy |
| 🗺️ [Codebase Map](workspace/docs/CODEBASE-MAP.md) | File structure guide |
| 🔧 [MCP Tools Reference](workspace/docs/MCP-TOOLS-REFERENCE.md) | All 40+ MCP tools |
| 📝 [Lessons Learned](workspace/docs/LESSONS_LEARNED.md) | Discipline rules & discoveries |

---

## 📁 Project Structure

```
claude-collective-intelligence/
├── workspace/
│   ├── dashboard/           # Real-time monitoring dashboard
│   │   ├── backend/         # FastAPI + WebSocket
│   │   └── frontend/        # React 19 + Framer Motion
│   ├── templates/           # Agent prompt templates (v6.2)
│   ├── tasks/               # Task definitions
│   └── docs/                # RAMAS documentation
├── src/ramas/python/        # MCP Server implementation
├── scripts/ramas/python/    # Launch scripts
├── infrastructure/          # Docker configs
└── docs/                    # Architecture docs
```

---

## 🎯 Use Cases

### 1. Multi-Agent Code Review

```bash
# Team Leader assigns reviews to worker pool
# Workers process in parallel
# Results aggregated automatically
```

### 2. Collaborative Architecture Design

```bash
# Brainstorm session with all agents
# Each contributes expertise
# Vote on final decision
```

### 3. Distributed Testing

```bash
# Workers run different test suites
# Monitor tracks progress
# Team Leader aggregates results
```

---

## ⚡ Performance (v6 vs v3)

| Metric | v3 (Manual) | v6 (Auto) | Improvement |
|--------|-------------|-----------|-------------|
| Worker wake time | 30+ seconds | <1 second | **30x faster** |
| Team Leader wake | Manual poll | <1 second | **Instant** |
| Manual interrupts | 4+ per task | 0 | **Zero** |
| End-to-end latency | 60+ seconds | <15 seconds | **4x faster** |

---

## 🛠️ Development

### Run Tests

```bash
# Integration tests (real services)
npm run test:integration

# Backend health check
curl http://localhost:8000/api/v1/health
```

### Dashboard Development

```bash
# Frontend hot reload
cd workspace/dashboard/frontend
npm run dev

# Backend hot reload
cd workspace/dashboard/backend
uvicorn main:app --reload --port 8000
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

---

## 📝 License

**PLUGIN AGENT MARKETPLACE - CUSTOM LICENSE**

Copyright (c) 2025 Dr. Umit Kacar & Muhsin Elcicek
All Rights Reserved.

**Authors:**
- **Dr. Umit Kacar** - Senior AI Researcher & Engineer (kacarumit.phd@gmail.com)
- **Muhsin Elcicek** - Senior Software Architect

**Organization:** Plugin Agent Marketplace
**Repository:** https://github.com/pluginagentmarketplace

This software is provided "AS IS" without warranty of any kind. The user accepts full responsibility for all consequences arising from use. See [LICENSE](LICENSE) file for complete terms.

**Key Terms:**
- ✅ Use for personal, educational, or commercial purposes
- ✅ Modify for your own use
- ✅ Distribute with license included
- ❌ Remove copyright notices
- ❌ Claim ownership of original work
- ❌ Use authors' names for endorsement without permission

---

## 🌟 Features Summary

| Feature | Status |
|---------|--------|
| Multi-terminal orchestration | ✅ Complete |
| Real-time dashboard | ✅ Complete |
| Color coding system | ✅ Complete |
| 3-level communication | ✅ Complete |
| Handshake protocol | ✅ Complete |
| Template system v6.2 | ✅ Complete |
| Task distribution | ✅ Complete |
| Collaborative brainstorming | ✅ Complete |
| Redis Streams wake | ✅ Complete |
| WebSocket monitoring | ✅ Complete |

---

## 💡 What Makes RAMAS v6 Special?

1. **Visual Dashboard** - See all agents in real-time with color coding
2. **Instant Wake** - <100ms latency with Redis Streams
3. **3-Level Reliability** - Multiple fallback communication paths
4. **Discipline System** - Standardized templates prevent errors
5. **Handshake Protocol** - Race condition free session management
6. **Production Ready** - Tested with 45+ hours uptime

---

**Built with** 💙 **for the Claude Code community**

🚀 **Transform your Claude Code sessions into an orchestrated AI team today!**
