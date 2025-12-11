# 1. Prerequisites / Gereksinimler

## System Inspector Pipeline v6.0.0 - ULTRATHINK EDITION

---

## Sistem Gereksinimleri

### Donanım
- macOS (AppleScript desteği için zorunlu)
- Dual-monitor setup (harici ekran önerilir, isteğe bağlı)
- 8GB+ RAM (Claude Code + RabbitMQ + 3 terminal için)

### Yazılım

#### 1. Python 3.8+
```bash
# Versiyon kontrolü
python3 --version

# Gerekli kütüphaneler (otomatik yüklenir)
# - PyYAML (workflow.yaml için)
# - Pillow (screenshot için)
# - requests (RabbitMQ API için)
```

#### 2. Node.js 18+
```bash
# Versiyon kontrolü
node --version

# Claude Code orchestrator.js için gerekli
```

#### 3. Claude Code CLI
```bash
# Versiyon kontrolü
claude --version

# Kurulum (henüz kurulu değilse)
npm install -g @anthropic-ai/claude-code
```

#### 4. Docker Desktop
```bash
# Versiyon kontrolü
docker --version

# RabbitMQ container için gerekli
```

---

## RabbitMQ Container

### Container Başlatma
```bash
# Container'ın çalıştığını kontrol et
docker ps | grep rabbitmq

# Çalışmıyorsa, projenin docker-compose.yml ile başlat
cd /Users/umitkacar/Documents/github-pluginagentmarketplace/claude-collective-intelligence
docker-compose up -d rabbitmq
```

### Bağlantı Bilgileri (KRİTİK!)
```yaml
# DOĞRU CREDENTIALS
Host: localhost
Port: 5672 (AMQP)
Management Port: 15672
Management Path: /rabbitmq/api/  # path_prefix dahil!
Username: admin
Password: rabbitmq123

# YANLIŞ - Bu çalışmaz!
# Username: guest
# Password: guest
```

### Bağlantı Testi
```bash
# AMQP port testi
nc -zv localhost 5672

# Management API testi (path_prefix ile!)
curl -u admin:rabbitmq123 http://localhost:15672/rabbitmq/api/overview | jq .cluster_name

# Beklenen çıktı: "rabbit@<hostname>"
```

---

## Terminal Ayarları

### AppleScript İzinleri
Pipeline, terminalleri kontrol etmek için AppleScript kullanır.

1. **System Preferences → Security & Privacy → Privacy → Accessibility**
2. Terminal.app'i listeye ekle ve izin ver
3. Eğer VS Code/iTerm kullanıyorsan, onları da ekle

### Terminal Renk Temaları (İsteğe Bağlı)
Pipeline dark tema kullanır. Özelleştirilmiş temalar:
- LEADER: Kırmızı başlık çubuğu
- WORKER-1: Mavi başlık çubuğu
- WORKER-2: Yeşil başlık çubuğu

---

## Proje Klonlama

```bash
# Proje dizinine git
cd /Users/umitkacar/Documents/github-pluginagentmarketplace

# Repo klonla (henüz yoksa)
git clone https://github.com/pluginagentmarketplace/claude-collective-intelligence.git

# Demo dizinine git
cd claude-collective-intelligence/rabbitmq-agents/demos/demo-3-system-inspector
```

---

## Hızlı Kontrol Listesi

| # | Kontrol | Komut | Beklenen |
|---|---------|-------|----------|
| 1 | Python | `python3 --version` | 3.8+ |
| 2 | Node.js | `node --version` | 18+ |
| 3 | Claude Code | `claude --version` | Herhangi |
| 4 | Docker | `docker --version` | 20+ |
| 5 | RabbitMQ | `docker ps \| grep rabbitmq` | agent_rabbitmq |
| 6 | AMQP Port | `nc -zv localhost 5672` | succeeded |
| 7 | API Access | `curl -u admin:rabbitmq123 http://localhost:15672/rabbitmq/api/overview` | JSON |

Tüm kontroller geçtiyse → **[2. Pipeline Çalıştırma](2-run-pipeline.md)**

---

**Version:** 6.0.0 (ULTRATHINK EDITION)
**Last Updated:** 2025-12-11
