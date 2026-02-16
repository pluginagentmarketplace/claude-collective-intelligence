# RAMAS Dokümantasyon MERKEZ

**Version:** 3.5.0 | **Pattern:** PATTERN-C-003 v6.1 | **Updated:** 2026-01-10

> Bu dosya RAMAS multi-agent orchestration sisteminin **tek merkezi referansıdır**.
> Tüm dokümantasyon buradan navigasyon edilmelidir!

---

## Quick Navigation

| Ne Arıyorsun? | Nereye Git? |
|---------------|-------------|
| **🚀 Mission Control (VS Code)** | [../templates/MISSION_CONTROL.md](../templates/MISSION_CONTROL.md) |
| **v6 özellikleri** | [PATTERN-C-003-v6.md](PATTERN-C-003-v6.md) |
| **MCP tool kullanımı** | [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md) |
| **Emergency stop** | [3-LEVEL-COMMUNICATION.md](3-LEVEL-COMMUNICATION.md) |
| **Codebase yapısı** | [CODEBASE-MAP.md](CODEBASE-MAP.md) |
| **Deep dive (v1→v6)** | [Full PATTERN-C-003](architecture/PATTERN-C-003-Autonomous-Orchestration.md) |
| **Task template** | [../templates/](../templates/) |

---

## RAMAS Nedir?

**RAMAS** (RabbitMQ Agent Multi-Agent System) Claude Code session'ları arasında gerçek zamanlı koordinasyon sağlayan bir multi-agent orchestration sistemidir.

### 4-Role Architecture (v6.1)

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 MISSION CONTROL (VS Code)                                   │
│     Role: Commander - Launch, brief, monitor, intervene         │
│     Template: templates/MISSION_CONTROL.md                      │
│     ↓ Launch & Brief                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  👔 TEAM LEADER (iTerm2)                                 │   │
│  │     Role: Coordinator - Create session, assign tasks     │   │
│  │     Template: templates/TEAM_LEADER.md                   │   │
│  │     ↓ Assign Tasks                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐                     │   │
│  │  │ 👷 WORKER-001│  │ 👷 WORKER-002│                     │   │
│  │  │   (iTerm2)   │  │   (iTerm2)   │                     │   │
│  │  │   Executor   │  │   Executor   │                     │   │
│  │  └──────────────┘  └──────────────┘                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│     ↑ Monitor & Intervene (14 problem-solving alternatives)    │
└─────────────────────────────────────────────────────────────────┘
```

### Temel Özellikler

| Özellik | Açıklama |
|---------|----------|
| **PATTERN-C-003 v6.1** | Bidirectional wake + Handshake protocol + Mission Control |
| **4-Role Architecture** | Mission Control → Team Leader → Workers |
| **40+ MCP Tool** | Session, task, meeting, voting araçları |
| **3-Level Communication** | RabbitMQ → Interrupt → Direct ESC |
| **14 Problem-Solving** | Wait → Query → Hint → WebSearch → ESC → Brainstorm → Restart |
| **<100ms Latency** | Redis Streams ile instant wake |
| **iTerm2 Integration** | Python API ile tam terminal kontrolü |

---

## Workspace Docs (MERKEZ)

Bu klasördeki dosyalar **günlük operasyonel kullanım** için optimize edilmiştir:

| Dosya | İçerik | Satır |
|-------|--------|-------|
| [PATTERN-C-003-v6.md](PATTERN-C-003-v6.md) | v6 quick reference, workflow diagram | 159 |
| [MCP-TOOLS-REFERENCE.md](MCP-TOOLS-REFERENCE.md) | 40+ tool signatures, patterns | 253 |
| [3-LEVEL-COMMUNICATION.md](3-LEVEL-COMMUNICATION.md) | Emergency procedures, ESC stop | 215 |
| [CODEBASE-MAP.md](CODEBASE-MAP.md) | Dosya yapısı, component inventory | ~300 |
| **RAMAS-INDEX.md** (bu dosya) | Central navigation, quick start | ~250 |

---

## Codebase Locations

### Source Code

```
src/ramas/python/                    # Core implementation (14 modules)
├── mcp_server.py      (113K)       # 40+ MCP tools, v6 logic
├── daemon.py          (47K)        # Async RabbitMQ listener
├── session_manager.py (37K)        # Session lifecycle
├── controller.py      (20K)        # iTerm2 Python API
├── redis_registry.py  (21K)        # Wake signals (v5/v6)
├── session_inbox.py   (16K)        # PATTERN-C-001 inbox
├── session_registry.py(12K)        # PATTERN-C-002 registry
└── ...                             # + 7 more modules
```

### Scripts

```
scripts/ramas/python/               # Executable scripts (13 files)
├── launch_windows.py   (18K)       # Demo launcher
├── demo_runner.py      (20K)       # Full demo automation
├── stop_agent.py       (13K)       # Emergency ESC stop (Level 3!)
├── shutdown_demo.py    (12K)       # Graceful shutdown
└── ...                             # + 9 more utilities
```

### Documentation (MERKEZ: workspace/docs/)

```
workspace/docs/                      # MERKEZ (you are here!)
├── RAMAS-INDEX.md                   # This file - START HERE!
├── PATTERN-C-003-v6.md              # Quick reference
├── MCP-TOOLS-REFERENCE.md           # Tool catalog
├── CODEBASE-MAP.md                  # File structure
├── 3-LEVEL-COMMUNICATION.md         # Emergency procedures
└── architecture/                    # Deep dive & patterns
    ├── PATTERN-C-003-Autonomous-Orchestration.md  # Full v6 spec
    ├── PATTERN-C-002-Session-Registry.md          # Registry isolation
    ├── RAMAS-GUIDE.md                             # Implementation guide
    ├── MCP-SERVER-GUIDE.md                        # MCP architecture
    ├── TASK-COORDINATION-GUIDE.md                 # Task patterns
    ├── APPLESCRIPT-ITERM2-COOKBOOK.md             # Legacy (reference)
    └── archive/                                    # Outdated docs
        ├── MASTER-GUIDE.md                        # DEPRECATED
        └── ephemeral-consumer-master-guide.md     # DEPRECATED
```

### Runtime Files

```
/tmp/ramas-session-inboxes/         # Agent inbox files (PATTERN-C-001)
/tmp/ramas-session-registry.json    # Shared registry (PATTERN-C-002)
/tmp/ramas-windows.json             # iTerm2 window mapping
/tmp/ramas-daemon.log               # Status daemon logs
```

---

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make ramas-demo` | Full demo (3 terminals) |
| `make ramas-demo-step` | Step-by-step demo |
| `make ramas-launch` | Launch iTerm2 windows |
| `make ramas-shutdown` | **Graceful shutdown (EXIT + CLOSE)** ✅ |
| `make ramas-check` | Connectivity test |
| `make ramas-sessions` | List sessions |
| `make ramas-inbox` | Inspect inboxes |
| `make ramas-stop AGENT=xxx` | Stop specific agent (ESC only) |
| `make ramas-stop-all` | Stop ALL agents (ESC only, terminals OPEN!) |
| `make ramas-clean` | Clean temp files |

### ⚠️ STOP vs SHUTDOWN (Added 2026-01-08)

```bash
make ramas-stop-all  # ESC only → terminals stay OPEN!
make ramas-shutdown  # /exit + close → clean end ✅
```

See [3-LEVEL-COMMUNICATION.md](3-LEVEL-COMMUNICATION.md) for details.

---

## Quick Start

### 1. Demo Başlat
```bash
# Full demo (Team Leader + 2 Workers)
make ramas-demo

# Veya step-by-step
make ramas-demo-step
```

### 2. MCP Tools Kullan
```javascript
// Session oluştur
mcp__ramas-python__create_session({
  sessionName: "Sprint Planning",
  sessionType: "task-coordination",
  expectedWorkers: 2
})

// Handshake gönder
mcp__ramas-python__session_handshake({
  sessionId: "session-xxx",
  handshakeType: "SESSION_READY"
})

// Task ata
mcp__ramas-python__assign_session_task({
  sessionId: "session-xxx",
  title: "Analyze module",
  description: "...",
  assignTo: "worker-001"
})
```

### 3. Emergency Stop
```bash
# Specific agent (Level 3 - Direct ESC)
make ramas-stop AGENT=worker-002

# Tüm agentlar
make ramas-stop-all
```

---

## PATTERN Evolution

| Version | Date | Key Feature |
|---------|------|-------------|
| **v6** | 2026-01-07 | Stale cleanup + Task fallback + Handshake |
| v5 | 2026-01-04 | Two-phase wake + Bidirectional wake |
| v4 | 2026-01-04 | Hybrid notification (Redis + Interrupt) |
| v3 | 2026-01-03 | iTerm2 AppleScript triggering |
| v2 | 2026-01-02 | Python rewrite (from Node.js) |
| v1 | 2025-12 | Original AppleScript/Node.js |

**Full history:** [PATTERN-C-003-Autonomous-Orchestration.md](architecture/PATTERN-C-003-Autonomous-Orchestration.md)

---

## Architecture Docs (Deep Dive)

`architecture/` alt klasöründe **mimari detaylar ve pattern evolüsyonu** bulunur:

| Dosya | İçerik | Status |
|-------|--------|--------|
| [PATTERN-C-003-Autonomous-Orchestration.md](architecture/PATTERN-C-003-Autonomous-Orchestration.md) | Full v6 spec, v1→v6 history | CURRENT |
| [PATTERN-C-002-Session-Registry.md](architecture/PATTERN-C-002-Session-Registry.md) | Session isolation fix | CURRENT |
| [RAMAS-GUIDE.md](architecture/RAMAS-GUIDE.md) | Python 2.0 implementation | PARTIAL (v5) |
| [MCP-SERVER-GUIDE.md](architecture/MCP-SERVER-GUIDE.md) | MCP server architecture | CURRENT |
| [TASK-COORDINATION-GUIDE.md](architecture/TASK-COORDINATION-GUIDE.md) | Task distribution patterns | CURRENT |

### Archived (Outdated)

| Dosya | Neden Archive? |
|-------|----------------|
| [MASTER-GUIDE.md](architecture/archive/MASTER-GUIDE.md) | v1.0, Nov 2025, 4359 lines - OUTDATED |
| [ephemeral-consumer-master-guide.md](architecture/archive/ephemeral-consumer-master-guide.md) | Legacy RabbitMQ consumer patterns |

---

## Cross-Reference Matrix

| Konu | workspace/docs/ | workspace/docs/architecture/ |
|------|----------------|-------------------|
| **v6 Features** | PATTERN-C-003-v6.md | PATTERN-C-003-Autonomous-Orchestration.md (section 11) |
| **MCP Tools** | MCP-TOOLS-REFERENCE.md | MCP-SERVER-GUIDE.md |
| **3-Level Comm** | 3-LEVEL-COMMUNICATION.md | PATTERN-C-003 (section 3) |
| **Session** | - | PATTERN-C-002-Session-Registry.md |
| **Wake Signals** | PATTERN-C-003-v6.md | PATTERN-C-003 (section 6-7) |
| **Codebase** | CODEBASE-MAP.md | - |

---

## CLAUDE.md Integration

Project CLAUDE.md dosyasında RAMAS referansları:

- **3-Level Communication Hierarchy** (lines 300-365)
  - Level 1: RabbitMQ Task
  - Level 2: RabbitMQ Interrupt
  - Level 3: Direct ESC (stop_agent.py)
- **Makefile targets** (ramas-stop, ramas-stop-all)

---

## Contributing

### Yeni Özellik Eklerken

1. `src/ramas/python/` altında implement et
2. MCP tool eklediysen → `MCP-TOOLS-REFERENCE.md` güncelle
3. Pattern değiştiysen → `PATTERN-C-003-v6.md` güncelle
4. Emergency procedure değiştiysen → `3-LEVEL-COMMUNICATION.md` güncelle
5. Büyük değişiklikse → `architecture/PATTERN-C-003-Autonomous-Orchestration.md` güncelle

### Dokümantasyon Kuralları

| Lokasyon | İçerik Tipi |
|----------|-------------|
| `workspace/docs/` | Operasyonel, quick reference, günlük kullanım |
| `workspace/docs/architecture/` | Deep dive, mimari detaylar, pattern evolution |
| `workspace/templates/` | Task/Agent prompt templates |
| `workspace/tasks/` | Active/completed task instances |

---

## Support

- **Issues:** Check `CLAUDE.md` troubleshooting section
- **Debug:** Use commands in [3-LEVEL-COMMUNICATION.md](3-LEVEL-COMMUNICATION.md)
- **Full docs:** [architecture/](architecture/)

---

*RAMAS v3.5.0 | PATTERN-C-003 v6.1 | workspace/docs/RAMAS-INDEX.md*
*MERKEZ dokümantasyon - Tüm navigasyon buradan başlar!*
*Mission Control template added: 2026-01-08*
*Terminal Configuration (Font 16pt, 640x1055) added: 2026-01-10*
