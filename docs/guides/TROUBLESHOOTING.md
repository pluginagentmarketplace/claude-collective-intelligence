# Troubleshooting Guide

Complete guide to diagnosing and fixing common issues.

---

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Queue Issues](#queue-issues)
3. [MCP Issues](#mcp-issues)
4. [Docker Issues](#docker-issues)
5. [Demo Script Issues](#demo-script-issues)
6. [Performance Issues](#performance-issues)

---

## Connection Issues

### Error: ECONNREFUSED

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:5672
```

**Cause:** RabbitMQ not running

**Solution:**
```bash
# Check Docker status
sudo docker compose ps

# Start RabbitMQ
sudo docker compose up -d rabbitmq

# Wait 10 seconds for startup
sleep 10

# Verify
curl -u admin:rabbitmq123 http://localhost:15672/api/overview
```

---

### Error: ACCESS_REFUSED (403)

**Symptom:**
```
ACCESS_REFUSED - Login was refused using authentication mechanism PLAIN
```

**Cause:** Wrong credentials

**Solution:**

1. Check `.env` file:
```bash
cat .env | grep RABBITMQ
```

2. Should contain:
```
RABBITMQ_URL=amqp://admin:rabbitmq123@localhost:5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=rabbitmq123
```

3. Check `.mcp.json`:
```bash
cat .mcp.json
```

4. Should have correct URL:
```json
{
  "mcpServers": {
    "rabbitmq-orchestrator": {
      "env": {
        "RABBITMQ_URL": "amqp://admin:rabbitmq123@localhost:5672"
      }
    }
  }
}
```

---

### Error: Connection Timeout

**Symptom:**
```
Error: Connection timeout
```

**Cause:** Network/firewall issues

**Solution:**
```bash
# Check if port is open
nc -zv localhost 5672

# Check Docker network
sudo docker network ls
sudo docker network inspect project-12-plugin-ai-agent-rabbitmq_default
```

---

## Queue Issues

### Error: PRECONDITION_FAILED (406)

**Symptom:**
```
PRECONDITION_FAILED - inequivalent arg 'x-message-ttl' for queue 'agent.tasks'
```

**Cause:** Queue exists with different options

**Solution:**
```bash
# Delete the queue
curl -u admin:rabbitmq123 -X DELETE \
  "http://localhost:15672/api/queues/%2F/agent.tasks"

# Delete results queue too
curl -u admin:rabbitmq123 -X DELETE \
  "http://localhost:15672/api/queues/%2F/agent.results"
```

Or via Management UI:
1. Go to http://localhost:15672
2. Login: admin / rabbitmq123
3. Queues tab
4. Click queue name
5. Delete queue

---

### Error: NOT_FOUND (404) - Exchange

**Symptom:**
```
NOT_FOUND - no exchange 'agent.status' in vhost '/'
```

**Cause:** Trying to publish before exchange is created

**Solution:**

This is a race condition. The fix is in `orchestrator.js`:

```javascript
// WRONG - publishing in connected event
this.client.on('connected', () => {
  this.publishStatus(...);  // Exchange not ready!
});

// RIGHT - publish after setup
async initialize() {
  await this.client.connect();
  await this.setupQueuesAndExchanges();  // Creates exchange
  await this.publishStatus(...);  // Now safe
}
```

If you get this error, restart the orchestrator.

---

### Tasks Not Being Picked Up

**Diagnosis:**
```bash
# Check queue depth
curl -s -u admin:rabbitmq123 \
  "http://localhost:15672/api/queues/%2F/agent.tasks" | \
  python3 -c "import sys,json; q=json.load(sys.stdin); print(f'Messages: {q[\"messages\"]}, Consumers: {q[\"consumers\"]}')"
```

**Solutions:**

1. **No consumers?** Start a worker:
   ```bash
   node scripts/orchestrator.js worker
   ```

2. **Messages stuck?** Check message format:
   ```javascript
   // send-task.js must match orchestrator.js format
   const message = {
     id: taskId,
     type: 'task',
     from: 'sender',
     timestamp: Date.now(),
     task: {
       title: '...',
       description: '...',
       priority: 'normal'
     }
   };
   ```

3. **Consumer not acknowledging?** Check for errors in worker terminal.

---

## MCP Issues

### MCP Tools Not Available

**Symptom:** Claude Code doesn't see MCP tools

**Solutions:**

1. Check `.mcp.json` is valid:
   ```bash
   cat .mcp.json | python3 -m json.tool
   ```

2. Check MCP server starts:
   ```bash
   node scripts/mcp-server.js
   # Should output: "RabbitMQ MCP Server started"
   ```

3. Restart Claude Code to reload MCP servers

4. Verify you're in the project directory:
   ```bash
   pwd
   # Should be in project-12-plugin-ai-agent-rabbitmq
   ```

---

### MCP Tool Returns Error

**Symptom:**
```json
{
  "error": "Not connected. Call register_agent first."
}
```

**Solution:** Register before using other tools:
```
Use register_agent tool with role="worker"
```

---

### MCP Connection Lost

**Symptom:** Tools work, then stop working

**Cause:** RabbitMQ connection dropped

**Solution:**
```
Use get_connection_status to check
If not connected, use register_agent again
```

---

## Docker Issues

### Permission Denied

**Symptom:**
```
permission denied while trying to connect to the Docker daemon socket
```

**Solutions:**

1. **Use sudo:**
   ```bash
   sudo docker compose up -d
   ```

2. **Add to docker group:**
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker  # Or logout/login
   ```

3. **Fix socket permissions:**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```

---

### Container Won't Start

**Diagnosis:**
```bash
sudo docker compose logs rabbitmq
```

**Common causes:**

1. **Port conflict:**
   ```bash
   # Check port usage
   sudo lsof -i :5672
   sudo lsof -i :15672

   # Kill conflicting process or change port in docker-compose.yml
   ```

2. **Volume corruption:**
   ```bash
   # Remove volumes and restart
   sudo docker compose down -v
   sudo docker compose up -d
   ```

---

### Container Keeps Restarting

**Diagnosis:**
```bash
sudo docker compose ps
sudo docker compose logs --tail=50 rabbitmq
```

**Solution:**
```bash
# Full reset
sudo docker compose down -v
sudo docker compose up -d
```

---

## Demo Script Issues

### Terminals Don't Open

**Symptom:** `launch-claude-demo.sh` runs but no terminals appear

**Cause:** gnome-terminal not installed or not default

**Solution:**
```bash
# Check gnome-terminal
which gnome-terminal

# Install if missing
sudo apt install gnome-terminal

# Or modify script to use xterm:
# Change: gnome-terminal
# To: xterm -e
```

---

### Claude Code Doesn't Start

**Symptom:** Terminal opens but Claude doesn't start

**Solution:**

1. Check Claude is installed:
   ```bash
   which claude
   claude --version
   ```

2. Start manually:
   ```bash
   cd /path/to/project
   claude
   ```

---

### Monitor Shows "waiting for data"

**Symptom:** Monitor terminal shows no queue data

**Cause:** RabbitMQ API not responding

**Solution:**
```bash
# Check API
curl -u admin:rabbitmq123 http://localhost:15672/api/queues

# If error, restart RabbitMQ
sudo docker compose restart rabbitmq
```

---

## Performance Issues

### High Memory Usage

**Diagnosis:**
```bash
sudo docker stats
```

**Solutions:**

1. **Set memory limits** in docker-compose.yml:
   ```yaml
   services:
     rabbitmq:
       deploy:
         resources:
           limits:
             memory: 512M
   ```

2. **Purge old messages:**
   ```bash
   curl -u admin:rabbitmq123 -X DELETE \
     "http://localhost:15672/api/queues/%2F/agent.tasks/contents"
   ```

---

### Slow Message Processing

**Diagnosis:**
```bash
# Check queue depth
curl -s -u admin:rabbitmq123 http://localhost:15672/api/queues | \
  python3 -c "
import sys, json
for q in json.load(sys.stdin):
    if q['messages'] > 100:
        print(f\"HIGH: {q['name']} has {q['messages']} messages\")
"
```

**Solutions:**

1. **Add more workers:**
   ```bash
   # Start additional workers
   AGENT_NAME="Worker-3" node scripts/orchestrator.js worker &
   AGENT_NAME="Worker-4" node scripts/orchestrator.js worker &
   ```

2. **Increase prefetch:**
   ```bash
   PREFETCH_COUNT=5 node scripts/orchestrator.js worker
   ```

---

## Health Check Commands

### Full System Check

```bash
#!/bin/bash
echo "=== System Health Check ==="

# Docker
echo -n "Docker: "
docker ps >/dev/null 2>&1 && echo "OK" || echo "FAIL"

# RabbitMQ
echo -n "RabbitMQ: "
curl -s -u admin:rabbitmq123 http://localhost:15672/api/overview >/dev/null && echo "OK" || echo "FAIL"

# Queues
echo -n "Queues: "
QUEUE_COUNT=$(curl -s -u admin:rabbitmq123 http://localhost:15672/api/queues | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "$QUEUE_COUNT queues"

# Connections
echo -n "Connections: "
CONN_COUNT=$(curl -s -u admin:rabbitmq123 http://localhost:15672/api/connections | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo "$CONN_COUNT active"

echo "=== Check Complete ==="
```

---

## Getting Help

1. **Check logs:**
   ```bash
   sudo docker compose logs -f
   ```

2. **Check this guide** for your specific error

3. **Read [MASTER-GUIDE.md](../MASTER-GUIDE.md)** for full documentation

4. **Open an issue** if problem persists
