# RabbitMQ Bağlantı Bilgileri v6.0.0

## ULTRATHINK EDITION - Doğrulanmış Ayarlar

---

## KRİTİK: Öğrenilen Dersler

### 1. Credentials (YANLIŞ vs DOĞRU)
```bash
# YANLIŞ - Bu kullanıcı YOK!
guest/guest

# DOĞRU - docker-compose.yml'dan
admin/rabbitmq123
```

### 2. Management API Path
```bash
# YANLIŞ - 404 Not Found hatası!
http://localhost:15672/api/

# DOĞRU - path_prefix "/rabbitmq" gerekli!
http://localhost:15672/rabbitmq/api/
```

### 3. Agent Bağlantı Komutu
```bash
# YANLIŞ - Slash komutları orchestrator.js'i ÇALIŞTIRMAZ!
/join-team worker
/orchestrate team-leader

# DOĞRU - Direkt bash komutu kullan!
cd /Users/umitkacar/.../claude-collective-intelligence && \
AGENT_ID="worker-1" AGENT_NAME="Worker 1" node src/core/orchestrator.js worker
```

---

## Sunucu Ayarları

```yaml
Host: localhost
AMQP Port: 5672
Management Port: 15672
Management Path: /rabbitmq/api/  # KRİTİK!
Virtual Host: /
```

## Kimlik Bilgileri

```yaml
Username: admin
Password: rabbitmq123
```

## Bağlantı URL'leri

```bash
# AMQP (Agent bağlantısı)
amqp://admin:rabbitmq123@localhost:5672/

# Management UI
http://localhost:15672/rabbitmq/

# Management API
http://localhost:15672/rabbitmq/api/
```

---

## Docker Container

```bash
# Container adı
agent_rabbitmq

# Container durumu
docker ps | grep rabbitmq

# Container logları
docker logs agent_rabbitmq

# Container restart
docker restart agent_rabbitmq
```

---

## Bağlantı Kodu

### JavaScript (amqplib)
```javascript
import { RabbitMQClient } from './scripts/rabbitmq-client.js';

const client = new RabbitMQClient({
  url: 'amqp://admin:rabbitmq123@localhost:5672',  // KRİTİK: admin!
  autoReconnect: true,
  heartbeat: 30
});

await client.connect();
console.log('RabbitMQ bağlantısı başarılı!');
```

### Python (pika)
```python
import pika

credentials = pika.PlainCredentials('admin', 'rabbitmq123')  # KRİTİK: admin!
connection = pika.BlockingConnection(
    pika.ConnectionParameters(
        host='localhost',
        port=5672,
        credentials=credentials
    )
)
channel = connection.channel()
print('RabbitMQ bağlantısı başarılı!')
```

---

## Queue Mimarisi

### Task Queue (Work Distribution)
```yaml
Queue: agent.tasks
Type: Durable, Point-to-Point
Purpose: LEADER -> Worker task dağıtımı
Consumer: WORKER-1, WORKER-2 (fair dispatch)
```

### Result Queue (Result Collection)
```yaml
Queue: agent.results
Type: Durable, Point-to-Point
Purpose: Worker -> LEADER sonuç raporlama
Consumer: LEADER ONLY (exclusive)
```

### Status Exchange (Pub/Sub)
```yaml
Exchange: agent.status
Type: Topic
Purpose: Agent durum bildirimleri
Routing Keys:
  - agent.status.connected
  - agent.status.disconnected
  - agent.status.task.started
  - agent.status.task.completed
  - agent.status.task.failed
```

### Brainstorm Exchange (Pub/Sub)
```yaml
Exchange: agent.brainstorm
Type: Fanout
Purpose: Brainstorm istekleri (tüm agent'lara)
```

### Exclusive Queues (Shutdown'da Silinmeli!)
```yaml
# RESOURCE_LOCKED önlemek için shutdown'da bu queue'lar silinmeli:
- brainstorm.team-leader-main
- brainstorm.results.team-leader-main
- status.team-leader-main
- brainstorm.worker-1
- brainstorm.results.worker-1
- brainstorm.worker-2
- brainstorm.results.worker-2
```

---

## Mesaj Akışı Diyagramı

```
                    +------------------+
                    |     LEADER       |
                    | (team-leader)    |
                    +--------+---------+
                             |
              publish task   |   consume result
                    +--------v---------+
                    |                  |
          +---------v------+   +-------v---------+
          | agent.tasks    |   | agent.results   |
          | (work queue)   |   | (result queue)  |
          +-------+--------+   +--------^--------+
                  |                     |
         consume  |                     | publish
                  |                     |
     +------------+-------------+       |
     |                          |       |
+----v------+            +------v----+  |
| WORKER-1  |            | WORKER-2  |  |
| (worker)  +------------+ (worker)  +--+
+-----------+  publish   +-----------+
               result
```

---

## Bağlantı Testi

### AMQP Port Testi
```bash
nc -zv localhost 5672
# Connection to localhost port 5672 [tcp/...] succeeded!
```

### Management API Testi
```bash
# KRİTİK: /rabbitmq/ prefix gerekli!
curl -u admin:rabbitmq123 http://localhost:15672/rabbitmq/api/overview | jq .cluster_name
# "rabbit@<hostname>"
```

### Queue Listesi
```bash
docker exec agent_rabbitmq rabbitmqctl list_queues name messages consumers
```

### Bağlantı Sayısı
```bash
docker exec agent_rabbitmq rabbitmqctl list_connections user
```

---

## Hata Ayıklama

### Connection refused
```
Error: Connection refused
```
**Çözüm:** RabbitMQ çalışmıyor.
```bash
docker ps | grep rabbitmq
docker start agent_rabbitmq
```

### ACCESS_REFUSED / Authentication Error
```
Error: ACCESS_REFUSED - Login was refused
```
**Çözüm:** Yanlış credentials. `admin/rabbitmq123` kullan (guest/guest YOK!)

### 404 Not Found (Management API)
```
{"error":"Object Not Found","reason":"Not Found"}
```
**Çözüm:** Path prefix eksik. `/rabbitmq/api/` kullan.

### RESOURCE_LOCKED
```
Error: RESOURCE_LOCKED - cannot obtain exclusive access
```
**Çözüm:** Önceki session'dan kalan exclusive queue'lar.
```bash
docker restart agent_rabbitmq
```

---

## Güvenlik Notu

**PRODUCTION İÇİN:**
- TLS/SSL kullan
- Yeni kullanıcı oluştur
- Virtual host ayır
- Rate limiting uygula

```bash
# Yeni kullanıcı oluştur
docker exec agent_rabbitmq rabbitmqctl add_user myuser mypassword
docker exec agent_rabbitmq rabbitmqctl set_permissions -p / myuser ".*" ".*" ".*"
```

---

**Version:** 6.0.0 (ULTRATHINK EDITION)
**Last Updated:** 2025-12-11
