# CLAUDE.md - System Inspector Demo v6.0.0

## ULTRATHINK EDITION - Fully Verified & Documented

**Bu demo %100 calisir durumda. Asagidaki komutlari kullan.**

---

## HIZLI BASLATMA (2 KOMUT)

```bash
# 1. BASLAT (Task 1-5)
cd /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector && python3 orchestrator.py

# 2. KAPAT (Task Final - RabbitMQ cleanup dahil!)
python3 orchestrator.py --task task_final --load-context
```

**Veya kisa yol:**
```bash
./run.sh           # Baslat
./run.sh shutdown  # Kapat
```

---

## Bu Demo Ne Yapar?

Multi-agent terminal orchestration pipeline - Mac dual-monitor setup:

| Task | Isim | Aciklama | Sure |
|------|------|----------|------|
| 1 | Display Inspector | Mac ekranlarini tespit eder | ~0.3s |
| 2 | Terminal Setup | 3 terminal acar + Window ID yakalar | ~3s |
| 3 | Screenshot Validator | Dogrulama screenshot'i alir | ~1.7s |
| 4 | Claude Launcher | Her terminalde Claude Code baslatir | ~21s |
| 5 | Role Prompter | RabbitMQ rollerini atar (doc-based) | ~54s |
| **Final** | **Safe Shutdown** | **RabbitMQ cleanup + /exit + terminal kapat** | ~38s |

**Toplam:** ~80s (Task 1-5) + ~38s (Task Final) = ~118s

---

## KRITIK: Ogrenilen Dersler (v6.0.0)

### 1. RabbitMQ Credentials
```
YANLIS: guest/guest (YOK!)
DOGRU:  admin/rabbitmq123 (docker-compose.yml'dan)
```

### 2. RabbitMQ Management API Path
```
YANLIS: http://localhost:15672/api/
DOGRU:  http://localhost:15672/rabbitmq/api/  (path_prefix "/rabbitmq")
```

### 3. Agent Baglanti Komutu
```bash
# YANLIS - Slash komutlari orchestrator.js'i calistirmiyor!
/join-team worker
/orchestrate team-leader

# DOGRU - Direkt bash komutu
cd /Users/umitkacar/.../claude-collective-intelligence && \
AGENT_ID="worker-1" AGENT_NAME="Worker 1" node src/core/orchestrator.js worker
```

### 4. RESOURCE_LOCKED Hatasi Onleme
Shutdown sirasinda exclusive queue'lar silinmeli:
- `brainstorm.team-leader-main`
- `brainstorm.results.team-leader-main`
- `status.team-leader-main`
- `brainstorm.worker-1`, `brainstorm.results.worker-1`
- `brainstorm.worker-2`, `brainstorm.results.worker-2`

**Cozum:** task_final.py v2.0 - RabbitMQ cleanup eklendi!

---

## Pipeline Architecture v6.0.0

```
==========================================================================
                    SYSTEM INSPECTOR PIPELINE v6.0.0
                       ULTRATHINK EDITION
==========================================================================

 TASK 1           TASK 2              TASK 3           TASK 4           TASK 5
 Display   -----> Terminal    -----> Screenshot -----> Claude   -----> Role
 Inspector        Setup              Validator         Launcher        Prompter
                     |                                                    |
                     v                                                    v
              Window ID Capture                                    Doc-Based
              [26488, 26490, 26492]                                Rol Atama
                     |                                                    |
                     +------------------+------------------+              |
                     |                  |                  |              |
                     v                  v                  v              |
                  LEADER             WORKER-1           WORKER-2         |
                     |                  |                  |              |
                     v                  v                  v              |
              LEADER.md           WORKER-1.md        WORKER-2.md         |
                     |                  |                  |              |
                     v                  v                  v              |
              RabbitMQ'ya         RabbitMQ'ya        RabbitMQ'ya         |
               Baglan              Baglan             Baglan             |
                     |                  |                  |              |
                     +------------------+------------------+              |
                                       |                                 |
                                       v                                 |
                                 TASK FINAL <----------------------------+
                           Safe Shutdown v2.0
                                       |
                     +------------------+------------------+
                     |                  |                  |
                     v                  v                  v
              RabbitMQ             RabbitMQ            RabbitMQ
              Cleanup              Cleanup             Cleanup
              (queues)           (connections)        (exclusive)
                     |                  |                  |
                     v                  v                  v
                  /exit              /exit              /exit
                  close              close              close

==========================================================================
```

---

## Dosya Yapisi v6.0.0

```
demo-3-system-inspector/
|
+-- ENTRY POINTS
|   +-- orchestrator.py      # Ana script
|   +-- run.sh               # Shell shortcut
|   +-- CLAUDE.md            # Bu dosya
|
+-- CONFIG
|   +-- config/
|       +-- workflow.yaml    # Pipeline v6.0.0
|
+-- TASKS
|   +-- tasks/
|       +-- __init__.py
|       +-- base.py                  # BaseTask
|       +-- display_inspector.py     # Task 1 (v1.0.0)
|       +-- terminal_setup.py        # Task 2 (v3.0.0)
|       +-- screenshot_validator.py  # Task 3 (v1.0.0)
|       +-- claude_launcher.py       # Task 4 (v2.0.0)
|       +-- role_prompter.py         # Task 5 (v3.0.0 - doc-based)
|       +-- task_final.py            # Task Final (v2.0.0 - RabbitMQ cleanup!)
|
+-- DOCS (Agent Talimatlari - KRITIK!)
|   +-- docs/
|       +-- README.md                # Docs aciklamasi
|       +-- roles/
|       |   +-- LEADER.md            # Team Leader talimatlari
|       |   +-- WORKER-1.md          # Worker 1 talimatlari
|       |   +-- WORKER-2.md          # Worker 2 talimatlari
|       +-- rabbitmq/
|           +-- CONNECTION.md        # RabbitMQ baglanti bilgileri
|
+-- QUICK-START (Hizli Baslatma)
|   +-- quick-start/
|       +-- 1-prerequisites.md       # Gereksinimler
|       +-- 2-run-pipeline.md        # Pipeline calistirma
|       +-- 3-verify-agents.md       # Agent dogrulama
|       +-- 4-shutdown.md            # Guvenli kapatma
|
+-- SCREENSHOTS (Kanitlar)
|   +-- screenshots/
|       +-- WORKED_3_*.png           # En son basarili calisma
|
+-- REPORTS
|   +-- reports/
|       +-- pipeline_report_WORKED_3.json
|
+-- SCRIPTS
    +-- scripts/
        +-- setup_terminals.scpt     # Auto-generated
```

---

## RabbitMQ Baglanti Dogrulama

Agent'lar baglandiktan sonra kontrol et:

```bash
# Baglanti sayisi (3 olmali)
docker exec agent_rabbitmq rabbitmqctl list_connections user

# Queue consumer sayilari
docker exec agent_rabbitmq rabbitmqctl list_queues name messages consumers | grep -E "agent\.|brainstorm\.|status\."

# Beklenen cikti:
# agent.results    0    1    (LEADER dinliyor)
# agent.tasks      0    2    (WORKER-1 + WORKER-2)
```

---

## Hata Giderme

### RESOURCE_LOCKED Hatasi
```
Error: RESOURCE_LOCKED - cannot obtain exclusive access to locked queue
```
**Cozum:** Shutdown sirasinda RabbitMQ cleanup yapilmamis. Manuel temizlik:
```bash
# Tum baglantilari kapat
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/rabbitmq/api/connections/URL_ENCODED_NAME"

# veya Docker restart
docker restart agent_rabbitmq
```

### Agent Baglanmiyor
```
Error: Connection refused
```
**Kontrol:**
1. RabbitMQ calisiyor mu? `docker ps | grep rabbitmq`
2. Port acik mi? `nc -zv localhost 5672`
3. Credentials dogru mu? `admin:rabbitmq123`

### Management API 404
```
{"error":"Object Not Found","reason":"Not Found"}
```
**Cozum:** Path prefix eksik. Dogru URL:
```
http://localhost:15672/rabbitmq/api/overview
```

---

## Version History

| Version | Tarih | Degisiklikler |
|---------|-------|---------------|
| 6.0.0 | 2025-12-11 | RabbitMQ cleanup (task_final v2.0), doc-based rol atama, credentials fix, path_prefix fix |
| 5.1.0 | 2025-12-11 | Task Final (safe shutdown), --load-context |
| 5.0.0 | 2025-12-11 | Window ID tracking, RabbitMQ role assignment |
| 4.0.0 | 2025-12-11 | role_prompter task |
| 3.0.0 | 2025-12-11 | claude_launcher task |
| 2.0.0 | 2025-12-11 | screenshot_validator task |
| 1.0.0 | 2025-12-11 | Initial release |

---

## Kanitlar (WORKED_3)

- `screenshots/WORKED_3_all_agents_connected.png` - 3 agent RabbitMQ'ya bagli
- `reports/pipeline_report_WORKED_3.json` - Pipeline raporu

---

**Version:** 6.0.0 (ULTRATHINK EDITION)
**Status:** WORKING - VERIFIED
**Last Updated:** 2025-12-11
