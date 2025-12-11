# 2. Pipeline Çalıştırma

## System Inspector Pipeline v6.0.0 - ULTRATHINK EDITION

---

## Tek Komut Başlatma

```bash
# Demo dizinine git
cd /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector

# Pipeline'ı başlat (Task 1-5)
python3 orchestrator.py
```

**Veya kısa yol:**
```bash
./run.sh
```

---

## Ne Olacak?

### Task 1: Display Inspector (~0.3s)
```
Task: display_inspector
   Found 2 display(s)
   Main: Color LCD (1280x800)
   External: LG FULL HD (1920x1080)
   Task completed in 361ms
```
- Mac ekranlarını tespit eder
- Harici ekran varsa onu kullanır

### Task 2: Terminal Setup (~3s)
```
Task: terminal_setup
   Opening 3 terminals
   Window IDs captured: 26488,26490,26492
   LEADER -> Window ID: 26488
   WORKER-1 -> Window ID: 26490
   WORKER-2 -> Window ID: 26492
   3 terminals opened with ID tracking!
   Task completed in 3079ms
```
- 3 terminal penceresi açar
- Her birinin Window ID'sini yakalar
- İsimleri: LEADER, WORKER-1, WORKER-2

### Task 3: Screenshot Validator (~1.7s)
```
Task: screenshot_validator
   Screenshot: external_display_validation.jpg
   Task completed in 1691ms
```
- Terminallerin doğru açıldığını doğrular
- Screenshot kaydeder

### Task 4: Claude Launcher (~21s)
```
Task: claude_launcher
   Launching Claude in LEADER (Window ID: 26488)... OK
   Launching Claude in WORKER-1 (Window ID: 26490)... OK
   Launching Claude in WORKER-2 (Window ID: 26492)... OK
   Claude instances launched: 3/3
   Task completed in 20609ms
```
- Her terminalde `claude --dangerously-skip-permissions` çalıştırır
- 7 saniye arayla başlatır (yük dengeleme)

### Task 5: Role Prompter (~54s)
```
Task: role_prompter
   ROL ATAMALARI:
   LEADER (ID: 26488) -> docs/roles/LEADER.md oku
   WORKER-1 (ID: 26490) -> docs/roles/WORKER-1.md oku
   WORKER-2 (ID: 26492) -> docs/roles/WORKER-2.md oku

   ROL ATAMA OZETI:
   Roller atandi: 3/3
   Task completed in 54311ms
```
- Her Claude'a rol dokümanını okuttur
- Agent'lar RabbitMQ'ya bağlanır

---

## Beklenen Çıktı

```
======================================================================
SYSTEM INSPECTOR PIPELINE v6.0.0
======================================================================
Workflow: system-inspector-pipeline
Version: 6.0.0
======================================================================

[Task outputs as shown above...]

======================================================================
PIPELINE SUMMARY
======================================================================
   Successful tasks: 5
   Failed tasks: 0
   Total duration: 80.06s
======================================================================

Report saved to: reports/pipeline_report_<timestamp>.json
```

---

## Pipeline Sonrası

Pipeline başarıyla tamamlandığında:

1. **3 terminal** harici ekranda açık olacak
2. **Her terminalde Claude Code** çalışıyor olacak
3. **Her Claude** kendi rolüne göre RabbitMQ'ya bağlanacak:
   - LEADER: `team-leader` rolü, `agent.results` queue'unu dinliyor
   - WORKER-1: `worker` rolü, `agent.tasks` queue'unu dinliyor
   - WORKER-2: `worker` rolü, `agent.tasks` queue'unu dinliyor

---

## CLI Seçenekleri

```bash
# Tam pipeline (varsayılan)
python3 orchestrator.py

# Sadece belirli task
python3 orchestrator.py --task display_inspector

# Mevcut task'ları listele
python3 orchestrator.py --list

# Dry run (sadece plan göster)
python3 orchestrator.py --dry-run

# Verbose mod
python3 orchestrator.py --verbose
```

---

## Olası Hatalar

### "Permission denied" - AppleScript
```
Error: Not authorized to send Apple events to Terminal.
```
**Çözüm:** System Preferences → Security & Privacy → Privacy → Accessibility → Terminal.app izin ver

### "Claude command not found"
```
Error: claude: command not found
```
**Çözüm:** Claude Code CLI'yi yükle:
```bash
npm install -g @anthropic-ai/claude-code
```

### "Display not found"
```
Error: No external display detected
```
**Not:** Harici ekran zorunlu değil. Pipeline ana ekranda da çalışır.

---

## Sonraki Adım

Pipeline tamamlandıysa → **[3. Agent Doğrulama](3-verify-agents.md)**

---

**Version:** 6.0.0 (ULTRATHINK EDITION)
**Last Updated:** 2025-12-11
