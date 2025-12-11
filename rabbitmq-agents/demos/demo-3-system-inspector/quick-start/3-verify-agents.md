# 3. Agent Doğrulama

## System Inspector Pipeline v6.0.0 - ULTRATHINK EDITION

---

## RabbitMQ Bağlantı Kontrolü

### 1. Bağlantı Sayısı (3 olmalı)
```bash
docker exec agent_rabbitmq rabbitmqctl list_connections user

# Beklenen çıktı:
# Listing connections ...
# user
# admin
# admin
# admin
```

### 2. Queue Consumer Sayıları
```bash
docker exec agent_rabbitmq rabbitmqctl list_queues name messages consumers

# Beklenen çıktı (önemli queue'lar):
# agent.results    0    1    (LEADER dinliyor)
# agent.tasks      0    2    (WORKER-1 + WORKER-2 dinliyor)
```

### 3. Management UI Kontrolü
```bash
# Browser'da aç (path_prefix unutma!)
open http://localhost:15672/rabbitmq/

# Login: admin / rabbitmq123
```

**Connections sekmesinde:**
- 3 bağlantı görünmeli
- Hepsi "admin" kullanıcısıyla

**Queues sekmesinde:**
- `agent.tasks`: 2 consumer
- `agent.results`: 1 consumer

---

## Terminal Kontrolü

### Her Terminalde Claude Code Çalışıyor mu?

**LEADER terminali:**
- "Team Leader ready" veya benzeri mesaj
- `agent.results` queue'unu dinliyor

**WORKER-1 terminali:**
- "Worker 1 ready" veya benzeri mesaj
- `agent.tasks` queue'unu dinliyor

**WORKER-2 terminali:**
- "Worker 2 ready" veya benzeri mesaj
- `agent.tasks` queue'unu dinliyor

---

## Basit Test: Task Gönderme

### LEADER terminalinde:

Agent'lara bir test görevi gönder:
```
Tüm worker'lara basit bir test görevi gönder: "Merhaba, bağlantı testi"
```

### Beklenen Sonuç:

1. LEADER, görevi `agent.tasks` queue'una yazar
2. WORKER-1 veya WORKER-2 görevi alır
3. Sonucu `agent.results` queue'una yazar
4. LEADER sonucu görür

---

## Doğrulama Checklist

| # | Kontrol | Beklenen | Sonuç |
|---|---------|----------|-------|
| 1 | RabbitMQ bağlantı sayısı | 3 | |
| 2 | agent.tasks consumer | 2 | |
| 3 | agent.results consumer | 1 | |
| 4 | LEADER terminali | Claude çalışıyor | |
| 5 | WORKER-1 terminali | Claude çalışıyor | |
| 6 | WORKER-2 terminali | Claude çalışıyor | |

---

## Olası Sorunlar

### "Consumer sayısı 0"

**Sorun:** Agent'lar RabbitMQ'ya bağlanmamış

**Olası nedenler:**
1. Yanlış credentials kullanılmış
2. Slash komutu kullanılmış (çalışmaz!)
3. orchestrator.js çalıştırılmamış

**Çözüm:**
Her terminalde manuel olarak çalıştır:
```bash
cd /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence
AGENT_ID="worker-1" AGENT_NAME="Worker 1" node src/core/orchestrator.js worker
```

### "RESOURCE_LOCKED" Hatası

**Sorun:** Önceki session'dan kalan exclusive queue'lar

**Çözüm:**
```bash
# Docker restart
docker restart agent_rabbitmq

# veya tüm queue'ları sil
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/rabbitmq/api/queues/%2F/brainstorm.worker-1"
```

### "Connection refused"

**Sorun:** RabbitMQ çalışmıyor

**Çözüm:**
```bash
# Container durumunu kontrol et
docker ps | grep rabbitmq

# Çalışmıyorsa başlat
docker start agent_rabbitmq
```

---

## Screenshot Kanıtı

Pipeline başarılı olduysa:
```
screenshots/WORKED_3_all_agents_connected.png
```

Bu screenshot'ta 3 terminal görünür, her birinde Claude Code çalışır.

---

## Sonraki Adım

Doğrulama tamamlandıysa → **[4. Güvenli Kapatma](4-shutdown.md)**

---

**Version:** 6.0.0 (ULTRATHINK EDITION)
**Last Updated:** 2025-12-11
