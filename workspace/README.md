# RAMAS Workspace

**Multi-Agent Task Coordination System**
**Version:** 3.7.0 | **Pattern:** PATTERN-C-003 v6.4 | **Updated:** 2026-01-11

> **MERKEZ:** Tüm RAMAS dokümantasyonu için başlangıç noktası: [docs/RAMAS-INDEX.md](docs/RAMAS-INDEX.md)

---

## Directory Structure

```
workspace/
├── README.md                 ← You are here (Task Index)
├── docs/                     # MERKEZ - ALL documentation here!
│   ├── RAMAS-INDEX.md        ← START HERE (Central navigation)
│   ├── CODEBASE-MAP.md       # File structure, components (v3.5.0)
│   ├── PATTERN-C-003-v6.md   # Quick reference
│   ├── MCP-TOOLS-REFERENCE.md
│   ├── 3-LEVEL-COMMUNICATION.md
│   ├── LESSONS_LEARNED.md    # Disiplin kuralları (v1.5.0)
│   └── architecture/         # Deep dive docs
│       ├── PATTERN-C-003-Autonomous-Orchestration.md
│       ├── PATTERN-C-002-Session-Registry.md
│       ├── RAMAS-GUIDE.md    # (v3.5.0 - Terminal config)
│       ├── MCP-SERVER-GUIDE.md
│       ├── TASK-COORDINATION-GUIDE.md
│       └── archive/          # Outdated docs
├── templates/                # Reusable templates (v6.3!)
│   ├── MISSION_CONTROL.md    # 🚀 VS Code session (Commander)
│   ├── TEAM_LEADER.md        # 👔 iTerm2 Team Leader
│   ├── WORKER.md             # 👷 iTerm2 Workers (v6.3 - NEW SECTIONS!)
│   ├── TASK.md               # 📋 Task definition
│   ├── BRAINSTORM.md         # 🧠 Brainstorm session template
│   └── PRE_TASK_RULES.md     # 📖 Pre-task reading rules
└── tasks/                    # ALL tasks (active + archived)
    ├── current -> task-009-tta-batch-processing/
    ├── task-001-keypoint-health-check/
    ├── task-002-dashboard/
    ├── task-003-closed-session-complete/
    ├── task-004-fastapi-frontend-integration/
    ├── task-005-feature-audit/
    ├── task-006-feature-audit/
    ├── task-007-annotation-bug-hunt/
    ├── task-008-category-search-fix/
    ├── task-009-tta-batch-processing/  # 🔄 ACTIVE
    │   └── TASK.md
    └── archive/              # Completed/archived tasks
        └── task-000-prime-fibo-test/
```

---

## Task Registry

| ID | Name | Status | Created | Workers | Notes |
|----|------|--------|---------|---------|-------|
| **task-009-tta-batch-processing** | TTA Batch Processing System | 🔄 ACTIVE | 2026-01-11 | 3 | L_BOTH_ZERO critical |
| task-008-category-search-fix | Category Filter & Search Fix | ✅ COMPLETED | 2026-01-11 | 1 | v22.3 category filter |
| task-007-annotation-bug-hunt | Annotation Tool Bug Hunt | ✅ COMPLETED | 2026-01-10 | 1 | YOLO OBB, filters |
| task-006-feature-audit | Flask→FastAPI Feature Audit | ✅ COMPLETED | 2026-01-10 | 3 | Route comparison |
| task-005-feature-audit | Feature Audit & AI Detection | ✅ COMPLETED | 2026-01-10 | 3 | Backend/Frontend/QA |
| task-004-fastapi-frontend-integration | FastAPI Frontend | ✅ COMPLETED | 2026-01-10 | 2 | v22.0 migration |
| task-003-closed-session-complete | Closed Session Fix | ✅ COMPLETED | 2026-01-09 | 2 | Dashboard bug |
| task-002-dashboard | RAMAS Dashboard | ✅ COMPLETED | 2026-01-08 | 2 | React + WebSocket |
| task-001-keypoint-health-check | Keypoint Health Check | ✅ COMPLETED | 2026-01-07 | 2 | First real task |
| task-000-prime-fibo-test | Prime/Fibonacci Test | 📁 ARCHIVED | 2026-01-04 | 2 | Demo task |

---

## Quick Start

### Navigate to Current Task
```bash
cd workspace/tasks/current
# Currently points to: task-009-tta-batch-processing
```

### Starting a New Session

**4-Role Architecture:**
1. **Mission Control (VS Code):** You are `templates/MISSION_CONTROL.md` - Launch, brief, monitor, intervene
2. **Team Leader (iTerm2):** Copy prompt from `templates/TEAM_LEADER.md`
3. **Worker-001 (iTerm2):** Copy prompt from `templates/WORKER.md` (replace XXX with 001)
4. **Worker-002 (iTerm2):** Copy prompt from `templates/WORKER.md` (replace XXX with 002)
5. **Worker-003 (iTerm2):** Copy prompt from `templates/WORKER.md` (replace XXX with 003) *(optional)*

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 MISSION CONTROL (VS Code)                                   │
│     ↓ Launch & Brief                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  👔 TEAM LEADER (iTerm2)                                 │   │
│  │     ↓ Assign Tasks                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ 👷 WORKER-001│  │ 👷 WORKER-002│  │ 👷 WORKER-003│   │   │
│  │  │   (iTerm2)   │  │   (iTerm2)   │  │   (iTerm2)   │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│     ↑ Monitor & Intervene (14 problem-solving alternatives)    │
└─────────────────────────────────────────────────────────────────┘
```

### Creating a New Task

```bash
# 1. Create task folder
mkdir workspace/tasks/task-006-new-task-name

# 2. Copy templates
cp workspace/templates/TASK.md workspace/tasks/task-006-new-task-name/
cp workspace/templates/WORKER.md workspace/tasks/task-006-new-task-name/WORKER_001.md
cp workspace/templates/WORKER.md workspace/tasks/task-006-new-task-name/WORKER_002.md

# 3. Edit files with task-specific content

# 4. Update symlink
rm workspace/tasks/current
ln -s task-006-new-task-name workspace/tasks/current

# 5. Update this README's Task Registry
```

---

## Documentation (MERKEZ: docs/)

| Document | Description |
|----------|-------------|
| [**RAMAS-INDEX.md**](docs/RAMAS-INDEX.md) | **START HERE** - Central navigation, quick start |
| [CODEBASE-MAP.md](docs/CODEBASE-MAP.md) | File structure, component inventory (v3.5.0) |
| [PATTERN-C-003-v6.md](docs/PATTERN-C-003-v6.md) | Session messaging and wake signals |
| [MCP-TOOLS-REFERENCE.md](docs/MCP-TOOLS-REFERENCE.md) | 40+ MCP tools reference |
| [3-LEVEL-COMMUNICATION.md](docs/3-LEVEL-COMMUNICATION.md) | Emergency stop procedures |
| [LESSONS_LEARNED.md](docs/LESSONS_LEARNED.md) | Disiplin kuralları, öğrenilen dersler (v1.5.0) |

**Deep Dive:** [docs/architecture/](docs/architecture/) - Full pattern specs, v1→v6 history

---

## Templates

| Template | Role | Size | Purpose |
|----------|------|------|---------|
| [MISSION_CONTROL.md](templates/MISSION_CONTROL.md) | 🚀 Commander | 12KB | Launch, brief, monitor, intervene |
| [TEAM_LEADER.md](templates/TEAM_LEADER.md) | 👔 Coordinator | 10KB | Create session, assign tasks, aggregate |
| [WORKER.md](templates/WORKER.md) | 👷 Executor | **18KB** | Process tasks, return results **(v6.3!)** |
| [TASK.md](templates/TASK.md) | 📋 Definition | 3KB | Task definition template |
| [BRAINSTORM.md](templates/BRAINSTORM.md) | 🧠 Ideation | 2KB | Brainstorm session template |
| [PRE_TASK_RULES.md](templates/PRE_TASK_RULES.md) | 📖 Rules | 2KB | Pre-task reading requirements |

---

## PATTERN-C-003 v6.3 Features (NEW!)

### Core Features (v6.0-v6.1)
- **Stale Wake Cleanup:** Old session signals cleared automatically
- **Task Fallback:** Results broadcasted if task not found
- **Session Handshake:** SESSION_READY → WORKER_READY protocol
- **3-Level Communication:** RabbitMQ → Interrupt → ESC (emergency)
- **4-Role Architecture:** Mission Control → Team Leader → Workers

### New in v6.3 (2026-01-10)

| Feature | Description |
|---------|-------------|
| 🔗 **Dependency Management** | Workers can wait for other workers' signals |
| ⏱️ **Time Budget** | Estimated/max timeout per task with escalation |
| 🆘 **5-Level Escalation** | Self → Peer → Team Leader → MC → Oracle |
| 🔙 **Rollback Instructions** | Pre-change backup, verification, rollback commands |
| 📡 **Communication Checkpoints** | Mandatory progress reports, silence = problem |

### Dependency Signal Pattern
```python
# Worker-001 completes critical task:
session_broadcast(
    sessionId="...",
    content="AI_DETECTION_FIXED: Ready for testing",
    messageType="dependency"
)

# Worker-003 waits for this signal before testing
```

### Time Budget Template
```markdown
| Task | Estimated | Max Timeout |
|------|-----------|-------------|
| Task 1 | 30 min | 60 min |
| Task 2 | 45 min | 90 min |
```

### Escalation Levels
```
Level 1: Self-Help (0-5 min stuck)
Level 2: Peer Help (5-10 min) → request_task_help()
Level 3: Team Leader (10-15 min) → session_broadcast(urgent)
Level 4: Mission Control (15+ min) → critical alert
Level 5: Oracle (Architecture decisions)
```

---

## Automation

```bash
# Launch 3-window demo (iTerm2)
make ramas-demo

# Stop specific agent (ESC only)
make ramas-stop AGENT=worker-001

# Stop all agents (ESC only - terminals stay OPEN!)
make ramas-stop-all

# END SESSION PROPERLY (exit + close terminals) ✅
make ramas-shutdown
```

### Terminal Configuration (2026-01-10)

| Parameter | Value | Description |
|-----------|-------|-------------|
| Window Size | 640x1055 | Full-height (was 800px) |
| Font | Monaco 16pt | Increased for readability |
| Layout | 3 side-by-side | Screen 2 (1920x1080) |

### ⚠️ STOP vs SHUTDOWN (Added 2026-01-08)

| Command | Action | Result |
|---------|--------|--------|
| `make ramas-stop-all` | ESC keystroke | Interrupts, terminals **OPEN** |
| `make ramas-shutdown` | `/exit` + close | **Clean exit** ✅ |

**Rule:** Use `shutdown` when ending session or after code changes!

---

## ⚠️ Critical Learnings

### MCP Server Does NOT Hot-Reload! (2026-01-08)

After editing `src/ramas/python/mcp_server.py`:

```bash
make ramas-shutdown    # NOT stop-all!
sleep 3
claude                 # Fresh subprocess loads new code
```

### Broadcast vs Interrupt (2026-01-09)

| Mesaj Tipi | Ne Zaman Alınır |
|------------|-----------------|
| `session_broadcast` | SADECE `wait_for_task` veya `poll` çağırınca |
| `interrupt_worker` | **HER ZAMAN** (idle olsan bile) |

### Mission Control Overreach (2026-01-09)

```
Mission Control = Koordinatör, Yapıcı DEĞİL!
Session açmadan iş yapmak = YANLIŞ!
Workers'ı bypass etmek = YANLIŞ!
```

### Silence = Problem! (2026-01-10 v6.3)

```
30+ dakika sessizlik = Team Leader inquiry
60+ dakika sessizlik = Mission Control alert
```

---

## Feedback System (NEW!)

Task tamamlandıktan sonra Mission Control FEEDBACK.md oluşturabilir:

```
workspace/tasks/task-XXX/
├── TASK.md
├── WORKER_001.md
├── WORKER_002.md
└── FEEDBACK.md    ← Mission Control review
```

**Feedback içeriği:**
- Pros/Cons analizi
- Improvement önerileri
- Template güncellemeleri
- Lessons learned

---

*Workspace v3.6.0 | Pattern: PATTERN-C-003 v6.3*
*Template WORKER.md upgraded: 2026-01-10 (Dependency, Time, Escalation, Rollback, Checkpoints)*
*Terminal Configuration documented: 2026-01-10 (Font 16pt, 640x1055)*
