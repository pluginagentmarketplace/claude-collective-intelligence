# Demo 3: System Inspector - Agent Documentation

Bu klasor, multi-agent RabbitMQ sistemindeki her agent icin rol tanimlarini ve baglanti bilgilerini icerir.

---

## KRITIK: Calisma Dizini

**TUM AGENT'LAR ONCE BU DIZINE GECMELI:**
```bash
cd /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence
```

Bu dizin RabbitMQ scripts, agent ve skill dosyalarinin bulundugu ana dizindir.

---

## Hizli Baslangic

### 1. Rol Dosyani Oku (FULL PATH!)

| Rol | Full Path |
|-----|-----------|
| LEADER | `/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector/docs/roles/LEADER.md` |
| WORKER-1 | `/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector/docs/roles/WORKER-1.md` |
| WORKER-2 | `/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector/docs/roles/WORKER-2.md` |

### 2. RabbitMQ Baglan
```
Full Path: /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector/docs/rabbitmq/CONNECTION.md
```

### 3. Takima Katil
```bash
# LEADER icin
/orchestrate team-leader

# WORKER icin
/join-team worker
```

---

## Klasor Yapisi (Full Paths)

```
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector/
└── docs/
    ├── README.md                 # Bu dosya
    ├── roles/
    │   ├── LEADER.md            # Team Leader rolu
    │   ├── WORKER-1.md          # Worker + Collaborator rolu
    │   └── WORKER-2.md          # Worker rolu
    └── rabbitmq/
        └── CONNECTION.md        # Baglanti bilgileri
```

---

## Rol Ozeti

| Terminal | Rol | Agent | Komut |
|----------|-----|-------|-------|
| LEADER | Team Leader | team-leader | `/orchestrate team-leader` |
| WORKER-1 | Collaborator | worker-agent + collaborator | `/join-team collaborator` |
| WORKER-2 | Worker | worker-agent | `/join-team worker` |

---

## Plugin Kaynaklari (Full Paths)

**Plugin Root:**
```
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence
```

**Agent Dosyalari:**
```
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/agents/team-leader.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/agents/worker-agent.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/agents/collaborator-agent.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/agents/coordinator-agent.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/agents/monitor-agent.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/agents/system-initializer-agent.md
```

**Skill Dosyalari:**
```
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/skills/rabbitmq-ops/SKILL.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/skills/task-distribution/SKILL.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/skills/result-aggregation/SKILL.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/skills/collaboration/SKILL.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/skills/health-monitoring/SKILL.md
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/skills/system-initialization/SKILL.md
```

**Scripts:**
```
/Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/scripts/
```

---

## Mesaj Akisi

```
LEADER (Team Leader)
    |
    | /assign-task
    v
+-------------------+
| agent.tasks queue |
+-------------------+
    |
    +-------+-------+
    |               |
    v               v
WORKER-1        WORKER-2
(Collaborator)  (Worker)
    |               |
    +-------+-------+
            |
            v
+--------------------+
| agent.results queue |
+--------------------+
            |
            v
LEADER (sonuclari toplar)
```

---

**Version:** 1.1.0 (Full Paths)
**Created:** 2025-12-11
