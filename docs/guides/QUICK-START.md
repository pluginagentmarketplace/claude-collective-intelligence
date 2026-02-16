# Quick Start Guide

Get the Multi-Agent Orchestration System running in 5 minutes.

---

## Prerequisites

- Node.js 18+
- Docker
- Claude Code CLI

---

## Step 1: Install Dependencies

```bash
cd project-12-plugin-ai-agent-rabbitmq
npm install
```

---

## Step 2: Start Docker Services

```bash
sudo docker compose up -d
```

Verify:
```bash
curl -u admin:rabbitmq123 http://localhost:15672/api/overview
```

---

## Step 3: Run the Demo

```bash
./scripts/launch-claude-demo.sh
```

3 terminals will open:
- **TEAM LEADER** - Claude Code (auto-starts)
- **WORKER** - Claude Code (auto-starts)
- **MONITOR** - Real-time queue stats

---

## Step 4: Test Communication

### In Team Leader terminal:

```
MCP tool ile team-leader olarak register ol,
sonra worker'a bir görev gönder: README.md dosyasını analiz et
```

### In Worker terminal:

```
MCP tool ile worker olarak register ol,
sonra bekleyen görevleri kontrol et ve tamamla
```

---

## Step 5: Check Results

### In Team Leader terminal:

```
get_messages ile sonuçları kontrol et
```

---

## Troubleshooting

### RabbitMQ not running?
```bash
sudo docker compose up -d rabbitmq
```

### Queue errors?
```bash
curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.tasks"
```

### Permission denied?
```bash
sudo usermod -aG docker $USER && newgrp docker
```

---

## Next Steps

- Read [MASTER-GUIDE.md](../MASTER-GUIDE.md) for full documentation
- Explore MCP tools in Claude Code
- Try brainstorming and voting features

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start services | `sudo docker compose up -d` |
| Stop services | `sudo docker compose down` |
| Run demo | `./scripts/launch-claude-demo.sh` |
| RabbitMQ UI | http://localhost:15672 (admin/rabbitmq123) |
| Clean queues | `curl -u admin:rabbitmq123 -X DELETE "http://localhost:15672/api/queues/%2F/agent.tasks"` |
