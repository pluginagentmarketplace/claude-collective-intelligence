# Demo 3: System Inspector - Multi-Agent Terminal Orchestration

## v6.0.0 - ULTRATHINK EDITION

**WORKING DEMO** - Fully tested and verified on 2025-12-11

---

## 🚀 HIZLI BAŞLATMA (2 KOMUT)

```bash
# 1. BAŞLAT (Task 1-5)
cd /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector
python3 orchestrator.py

# 2. KAPAT (Task Final - RabbitMQ cleanup dahil!)
python3 orchestrator.py --task task_final --load-context
```

**Veya kısa yol:**
```bash
./run.sh           # Başlat
./run.sh shutdown  # Kapat
```

---

## 📋 Bu Demo Ne Yapar?

Mac dual-monitor setup ile multi-agent Claude Code orchestration:

| Task | İsim | Açıklama | Süre |
|------|------|----------|------|
| 1 | Display Inspector | Mac ekranlarını tespit eder | ~0.3s |
| 2 | Terminal Setup | 3 terminal açar + Window ID yakalar | ~3s |
| 3 | Screenshot Validator | Doğrulama screenshot'ı alır | ~1.7s |
| 4 | Claude Launcher | Her terminalde Claude Code başlatır | ~21s |
| 5 | Role Prompter | RabbitMQ rollerini atar (doc-based) | ~54s |
| **Final** | **Safe Shutdown** | **RabbitMQ cleanup + /exit + terminal kapat** | ~38s |

**Toplam:** ~80s (Task 1-5) + ~38s (Task Final) = ~118s

---

## 🚨 KRİTİK: Öğrenilen Dersler (v6.0.0)

### 1. RabbitMQ Credentials
```bash
# YANLIŞ - Bu kullanıcı YOK!
guest/guest

# DOĞRU - docker-compose.yml'dan
admin/rabbitmq123
```

### 2. RabbitMQ Management API Path
```bash
# YANLIŞ - 404 Not Found hatası alırsın!
http://localhost:15672/api/

# DOĞRU - path_prefix "/rabbitmq" eklenmeli
http://localhost:15672/rabbitmq/api/
```

### 3. Agent Bağlantı Komutu
```bash
# YANLIŞ - Slash komutları orchestrator.js'i ÇALIŞTIRMAZ!
/join-team worker
/orchestrate team-leader

# DOĞRU - Direkt bash komutu
cd /Users/umitkacar/.../claude-collective-intelligence && \
AGENT_ID="worker-1" AGENT_NAME="Worker 1" node src/core/orchestrator.js worker
```

### 4. RESOURCE_LOCKED Hatası Önleme
Shutdown sırasında exclusive queue'lar silinmeli:
- `brainstorm.team-leader-main`
- `brainstorm.results.team-leader-main`
- `status.team-leader-main`
- `brainstorm.worker-1`, `brainstorm.results.worker-1`
- `brainstorm.worker-2`, `brainstorm.results.worker-2`

**Çözüm:** task_final.py v2.0.0 - RabbitMQ cleanup eklendi!

---

## 🏗️ Pipeline Mimarisi v6.0.0

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
               Bağlan              Bağlan             Bağlan             |
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

## 📁 Dosya Yapısı v6.0.0

```
demo-3-system-inspector/
│
├── ENTRY POINTS
│   ├── orchestrator.py      # Ana script
│   ├── run.sh               # Shell shortcut
│   ├── CLAUDE.md            # Claude session instructions
│   └── README.md            # Bu dosya
│
├── CONFIG
│   └── config/
│       └── workflow.yaml    # Pipeline v6.0.0 (RabbitMQ config dahil!)
│
├── TASKS
│   └── tasks/
│       ├── __init__.py
│       ├── base.py                  # BaseTask
│       ├── display_inspector.py     # Task 1 (v1.0.0)
│       ├── terminal_setup.py        # Task 2 (v3.0.0)
│       ├── screenshot_validator.py  # Task 3 (v1.0.0)
│       ├── claude_launcher.py       # Task 4 (v2.0.0)
│       ├── role_prompter.py         # Task 5 (v3.0.0 - doc-based)
│       └── task_final.py            # Task Final (v2.0.0 - RabbitMQ cleanup!)
│
├── DOCS (Agent Talimatları - KRİTİK!)
│   └── docs/
│       ├── README.md                # Docs açıklaması
│       ├── roles/
│       │   ├── LEADER.md            # Team Leader talimatları
│       │   ├── WORKER-1.md          # Worker 1 talimatları
│       │   └── WORKER-2.md          # Worker 2 talimatları
│       └── rabbitmq/
│           └── CONNECTION.md        # RabbitMQ bağlantı bilgileri
│
├── QUICK-START (Hızlı Başlatma)
│   └── quick-start/
│       ├── 1-prerequisites.md       # Gereksinimler
│       ├── 2-run-pipeline.md        # Pipeline çalıştırma
│       ├── 3-verify-agents.md       # Agent doğrulama
│       └── 4-shutdown.md            # Güvenli kapatma
│
├── SCREENSHOTS (Kanıtlar)
│   └── screenshots/
│       └── WORKED_3_*.png           # En son başarılı çalışma
│
├── REPORTS
│   └── reports/
│       └── pipeline_report_WORKED_3.json
│
└── SCRIPTS
    └── scripts/
        └── setup_terminals.scpt     # Auto-generated
```

---

## 🔧 RabbitMQ Yapılandırması

### workflow.yaml (v6.0.0)
```yaml
rabbitmq:
  host: "localhost"
  port: 5672
  management_port: 15672
  management_path_prefix: "/rabbitmq"  # KRİTİK!
  username: "admin"
  password: "rabbitmq123"
  vhost: "/"
```

### Docker Container
```bash
# Container adı
agent_rabbitmq

# Bağlantı testi
docker exec agent_rabbitmq rabbitmqctl status

# Queue listesi
docker exec agent_rabbitmq rabbitmqctl list_queues name messages consumers
```

---

## ✅ RabbitMQ Bağlantı Doğrulama

Agent'lar bağlandıktan sonra kontrol et:

```bash
# Bağlantı sayısı (3 olmalı)
docker exec agent_rabbitmq rabbitmqctl list_connections user

# Queue consumer sayıları
docker exec agent_rabbitmq rabbitmqctl list_queues name messages consumers | grep -E "agent\.|brainstorm\.|status\."

# Beklenen çıktı:
# agent.results    0    1    (LEADER dinliyor)
# agent.tasks      0    2    (WORKER-1 + WORKER-2)
```

---

## 🔥 Hata Giderme

### RESOURCE_LOCKED Hatası
```
Error: RESOURCE_LOCKED - cannot obtain exclusive access to locked queue
```
**Çözüm:** Shutdown sırasında RabbitMQ cleanup yapılmamış. Manuel temizlik:
```bash
# Tüm bağlantıları kapat
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/rabbitmq/api/connections/URL_ENCODED_NAME"

# veya Docker restart
docker restart agent_rabbitmq
```

### Agent Bağlanmıyor
```
Error: Connection refused
```
**Kontrol:**
1. RabbitMQ çalışıyor mu? `docker ps | grep rabbitmq`
2. Port açık mı? `nc -zv localhost 5672`
3. Credentials doğru mu? `admin:rabbitmq123`

### Management API 404
```
{"error":"Object Not Found","reason":"Not Found"}
```
**Çözüm:** Path prefix eksik. Doğru URL:
```
http://localhost:15672/rabbitmq/api/overview
```

---

## 💻 CLI Seçenekleri

```bash
# Tam pipeline (Task 1-5)
python3 orchestrator.py

# Mevcut task'ları listele
python3 orchestrator.py --list

# Belirli task çalıştır
python3 orchestrator.py --task display_inspector

# Dry run (plan göster, çalıştırma)
python3 orchestrator.py --dry-run

# Güvenli kapatma (RabbitMQ cleanup dahil!)
python3 orchestrator.py --task task_final --load-context
```

---

## 🔑 Key Innovation: Window ID Tracking

**Problem:** AppleScript ile 3 terminale mesaj gönderirken hangisinin hangisi olduğunu tespit edemiyorduk.

**Solution:** Terminal açılır açılmaz `id of window 1` ile benzersiz ID yakalıyoruz:
```applescript
do script ""
set currentWindowID to id of window 1  -- HEMEN YAKALA!
```

**Result:** %100 güvenilir terminal hedefleme!

---

## 📊 Teknik Detaylar

### Window ID Capture (terminal_setup.py)
```python
applescript = '''
tell application "Terminal"
    do script ""
    set currentWindowID to id of window 1  -- CAPTURE IMMEDIATELY!
    set end of windowIDs to currentWindowID
end tell
'''
```

### Window ID Targeting (role_prompter.py & task_final.py)
```python
def _send_prompt_by_window_id(self, window_id: int, message: str):
    applescript = f'''
    tell application "Terminal"
        set targetWindow to window id {window_id}  -- EXACT TARGETING!
        set frontmost of targetWindow to true
    end tell
    '''
```

### RabbitMQ Cleanup (task_final.py v2.0.0)
```python
def _cleanup_rabbitmq(self):
    """Delete exclusive queues before closing connections"""
    queues_to_delete = [
        "brainstorm.team-leader-main",
        "brainstorm.results.team-leader-main",
        "status.team-leader-main",
        # ... worker queues
    ]
    for queue in queues_to_delete:
        requests.delete(
            f"http://localhost:15672/rabbitmq/api/queues/%2F/{queue}",
            auth=("admin", "rabbitmq123")
        )
```

---

## 📜 Version History

| Version | Tarih | Değişiklikler |
|---------|-------|---------------|
| **6.0.0** | 2025-12-11 | **ULTRATHINK EDITION** - RabbitMQ cleanup (task_final v2.0), doc-based rol atama, credentials fix, path_prefix fix |
| 5.1.0 | 2025-12-11 | Task Final (safe shutdown), --load-context |
| 5.0.0 | 2025-12-11 | Window ID tracking, RabbitMQ role assignment |
| 4.0.0 | 2025-12-11 | Added role_prompter task |
| 3.0.0 | 2025-12-11 | Added claude_launcher task |
| 2.0.0 | 2025-12-11 | Added screenshot_validator task |
| 1.0.0 | 2025-12-11 | Initial release |

---

## 📸 Kanıtlar (WORKED_3)

- `screenshots/WORKED_3_all_agents_connected.png` - 3 agent RabbitMQ'ya bağlı
- `reports/pipeline_report_WORKED_3.json` - Pipeline raporu

---

**Demo 3 - System Inspector Pipeline v6.0.0**
*ULTRATHINK EDITION*
*Part of Claude Collective Intelligence RabbitMQ Demos*
*Fully working and verified on 2025-12-11*
