# 4. Güvenli Kapatma

## System Inspector Pipeline v6.0.0 - ULTRATHINK EDITION

---

## KRİTİK: Neden Güvenli Kapatma?

**Problem:** Claude Code ve terminalleri düzgün kapatmazsak:
1. RabbitMQ exclusive queue'lar kilitli kalır
2. Sonraki çalıştırmada `RESOURCE_LOCKED` hatası alırsın
3. Docker restart gerekir

**Çözüm:** Task Final - RabbitMQ cleanup + /exit + terminal close

---

## Tek Komut Kapatma

```bash
# Demo dizinine git (zaten oradaysan atla)
cd /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector

# Güvenli kapatma (Task Final)
python3 orchestrator.py --task task_final --load-context
```

**Veya kısa yol:**
```bash
./run.sh shutdown
```

---

## Ne Olacak?

### Task Final: Safe Shutdown (~38s)

```
======================================================================
SYSTEM INSPECTOR PIPELINE v6.0.0
======================================================================
Version: 6.0.0
Context loaded from: pipeline_report_<timestamp>.json
   LEADER: Window ID 26488
   WORKER-1: Window ID 26490
   WORKER-2: Window ID 26492
======================================================================

Task: task_final

   RABBITMQ CLEANUP:
   Deleting exclusive queues...
   - brainstorm.team-leader-main: deleted
   - brainstorm.results.team-leader-main: deleted
   - status.team-leader-main: deleted
   - brainstorm.worker-1: deleted
   - brainstorm.results.worker-1: deleted
   - brainstorm.worker-2: deleted
   - brainstorm.results.worker-2: deleted
   RabbitMQ cleanup completed!

   KAPATMA SIRASI:
   LEADER (ID: 26488) -> /exit -> close terminal
   WORKER-1 (ID: 26490) -> /exit -> close terminal
   WORKER-2 (ID: 26492) -> /exit -> close terminal

   KAPATMA OZETI:
   Basariyla kapatildi: 3/3
      LEADER (ID: 26488) - success
      WORKER-1 (ID: 26490) - success
      WORKER-2 (ID: 26492) - success
   Task completed in 37523ms

======================================================================
PIPELINE SUMMARY
======================================================================
   Successful tasks: 1
   Total duration: 37.54s
======================================================================
```

---

## Kapatma Sırası (Otomatik)

1. **RabbitMQ Cleanup**
   - Exclusive queue'ları siler
   - Bağlantıları kapatır
   - RESOURCE_LOCKED önlenir

2. **Claude Code Exit**
   - Her terminale `/exit` komutu gönderir
   - Claude Code temiz kapanır

3. **Terminal Close**
   - Terminal pencerelerini kapatır
   - Window ID ile hedefleme

---

## --load-context Açıklaması

**Bu parametre ne yapar?**

Pipeline (Task 1-5) çalıştığında, Window ID'leri `reports/pipeline_report_<timestamp>.json` dosyasına kaydedilir.

`--load-context` parametresi:
1. En son rapor dosyasını bulur
2. Window ID'leri yükler
3. Task Final bu ID'leri kullanarak terminalleri hedefler

**Neden gerekli?**
Task Final ayrı çalıştırıldığında, terminallerin Window ID'lerini bilmez. Context yükleyerek bu bilgiyi alır.

---

## Manuel Kapatma (Sorun Olursa)

### 1. RabbitMQ Cleanup
```bash
# Tüm queue'ları listele
docker exec agent_rabbitmq rabbitmqctl list_queues name

# Belirli queue sil
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/rabbitmq/api/queues/%2F/brainstorm.worker-1"

# Tüm bağlantıları kapat (radikal)
docker restart agent_rabbitmq
```

### 2. Claude Code Exit
Her terminalde manuel:
```
/exit
```

### 3. Terminal Kapatma
Her terminalde:
```bash
exit
```

---

## Kapatma Doğrulama

```bash
# Terminal'ler kapandı mı?
# - 3 terminal penceresi kapalı olmalı

# RabbitMQ queue'lar silindi mi?
docker exec agent_rabbitmq rabbitmqctl list_queues name | grep -E "brainstorm|status"
# - Boş çıktı beklenir

# Bağlantılar kapandı mı?
docker exec agent_rabbitmq rabbitmqctl list_connections user
# - Boş veya sadece monitoring bağlantıları
```

---

## Olası Hatalar

### "Context file not found"

**Sorun:** Pipeline raporu bulunamadı

**Çözüm:**
```bash
# Reports dizinini kontrol et
ls -la reports/

# En son raporu bul
ls -t reports/pipeline_report_*.json | head -1

# Manuel belirt
python3 orchestrator.py --task task_final --context reports/pipeline_report_WORKED_3.json
```

### "Window ID not found"

**Sorun:** Terminal penceresi zaten kapalı

**Çözüm:** Hata göz ardı edilebilir. Diğer terminaller kapatılır.

### "RabbitMQ cleanup failed"

**Sorun:** Management API erişim hatası

**Çözüm:**
```bash
# API erişimini test et
curl -u admin:rabbitmq123 http://localhost:15672/rabbitmq/api/overview

# 404 alıyorsan: path_prefix eksik
# 401 alıyorsan: credentials yanlış
```

---

## Tekrar Çalıştırma

Pipeline'ı tekrar çalıştırmak için:

```bash
# 1. Önce güvenli kapatma yapıldığından emin ol
./run.sh shutdown

# 2. Birkaç saniye bekle
sleep 5

# 3. Tekrar başlat
./run.sh
```

---

## Özet

| Adım | Komut | Süre |
|------|-------|------|
| Başlatma | `python3 orchestrator.py` | ~80s |
| ... çalışma ... | | |
| Kapatma | `python3 orchestrator.py --task task_final --load-context` | ~38s |

**Toplam döngü:** ~118s + çalışma süresi

---

**Version:** 6.0.0 (ULTRATHINK EDITION)
**Last Updated:** 2025-12-11
