# SYSTEM ARCHITECTURE TRAINING
## AI Agent Orchestrator with RabbitMQ - Comprehensive Training Guide

**Last Updated:** November 18, 2025
**Version:** 1.0.0
**Target Audience:** New engineers, support staff, operations team
**Estimated Completion Time:** 4-6 hours

---

## TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [Data Flow & Message Processing](#data-flow--message-processing)
4. [Infrastructure & Deployment](#infrastructure--deployment)
5. [Monitoring & Observability](#monitoring--observability)
6. [Security Architecture](#security-architecture)
7. [Hands-On Exercises](#hands-on-exercises)
8. [Troubleshooting Basics](#troubleshooting-basics)

---

## ARCHITECTURE OVERVIEW

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATIONS                       │
│  (Web UI, Mobile, APIs, External Services)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│              API GATEWAY / APPLICATION LAYER                      │
│         ┌─────────────────────────────────────────────┐          │
│         │   Express.js REST API (Port 3000)           │          │
│         │   - Request validation & authentication     │          │
│         │   - Rate limiting & throttling              │          │
│         │   - Request routing & middleware            │          │
│         └──────────┬──────────────────────────────────┘          │
│                    │                                             │
│     ┌──────────────┼──────────────┬──────────────┐              │
│     ↓              ↓              ↓              ↓              │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Auth    │  │ Task    │  │ Agent    │  │ Results  │         │
│  │ Module  │  │ Module  │  │ Module   │  │ Module   │         │
│  └────┬────┘  └────┬────┘  └────┬─────┘  └────┬─────┘         │
└───────┼────────────┼────────────┼────────────┼────────────────┘
        │            │            │            │
        ↓            ↓            ↓            ↓
   ┌──────────────────────────────────────────────────┐
   │        MESSAGE BROKER LAYER (RabbitMQ)           │
   │                                                  │
   │  ┌──────────┐  ┌────────────┐  ┌──────────┐   │
   │  │Exchange: │  │ Exchange:  │  │Exchange: │   │
   │  │Tasks     │  │Brainstorm  │  │Results   │   │
   │  └────┬─────┘  └─────┬──────┘  └────┬─────┘   │
   │       │              │              │         │
   │       ↓              ↓              ↓         │
   │  ┌──────────┐  ┌────────────┐  ┌──────────┐   │
   │  │Queue:    │  │Queue:      │  │Queue:    │   │
   │  │Task      │  │Brainstorm  │  │Results   │   │
   │  │Dist      │  │Tasks       │  │Collection│   │
   │  └────┬─────┘  └─────┬──────┘  └────┬─────┘   │
   │       │              │              │         │
   │  ┌────┴──────┬───────┴──────┬───────┴────┐    │
   │  ↓           ↓              ↓            ↓    │
   └──────────────────────────────────────────────┘
        │           │              │            │
        ↓           ↓              ↓            ↓
   ┌──────────────────────────────────────────────────┐
   │           AGENT WORKER LAYER                     │
   │                                                  │
   │  ┌──────────────┐  ┌──────────────┐            │
   │  │ Brainstorm   │  │ Task Worker  │            │
   │  │ Agent        │  │ Agents (N)   │            │
   │  │              │  │              │            │
   │  │ Consumes:    │  │ Consumes:    │            │
   │  │ brainstorm_  │  │ task_        │            │
   │  │ tasks        │  │ distribution │            │
   │  │              │  │              │            │
   │  │ Produces:    │  │ Produces:    │            │
   │  │ task_dist    │  │ results      │            │
   │  └──────────────┘  └──────────────┘            │
   │                                                 │
   └──────────────────────────────────────────────┘
        │
        ├─────────────────────────────────────┐
        ↓                                     ↓
   ┌──────────┐                         ┌─────────┐
   │PostgreSQL│                         │ Redis   │
   │ Database │                         │ Cache   │
   │          │                         │         │
   │- Agents  │                         │-Sessions│
   │- Tasks   │                         │-Temp    │
   │- Results │                         │-Cache   │
   │- Users   │                         │         │
   └──────────┘                         └─────────┘
```

### Design Principles

**1. Asynchronous Processing**
- Tasks are queued immediately
- Agents process independently
- No blocking I/O

**2. Scalability**
- Stateless workers (agents can be added/removed)
- Message-driven architecture
- Horizontal scaling of agents

**3. Reliability**
- Message persistence in RabbitMQ
- Database durability
- Graceful degradation

**4. Observability**
- Comprehensive logging
- Distributed tracing
- Metrics for all components

---

## SYSTEM COMPONENTS

### 1. API Layer (Express.js)

**Responsibility:**
- Accept incoming requests
- Validate & authenticate
- Rate limit & throttle
- Route to appropriate handlers
- Return responses

**Key Endpoints:**

```javascript
// Task submission
POST /api/tasks
{
  "type": "brainstorm|reasoning|analysis",
  "prompt": "...",
  "parameters": {...}
}
Response: { task_id, status: "queued", ... }

// Task status
GET /api/tasks/{task_id}
Response: { task_id, status, agent_id, result, ... }

// Agent management
GET /api/agents
Response: [{ agent_id, status, task_count, ... }]

// Health check
GET /health
Response: { status: "operational", services: {...} }

// Admin endpoints
POST /admin/maintenance-mode
POST /admin/circuit-breaker
POST /admin/rate-limit
```

**Request Flow:**
```
Request → Middleware Chain → Validation → Auth → Rate Limit →
  Handler → Response
```

### 2. Message Broker (RabbitMQ)

**Topology:**

```
Exchanges:
├── tasks (fanout)
│   └── Task Distribution Queue
│       ├── Consumer: Task Worker Agent
│       └── Prefetch: 1 (one task at a time)
│
├── brainstorm (fanout)
│   └── Brainstorm Queue
│       ├── Consumer: Brainstorm Agent
│       └── Prefetch: 2 (can handle 2 concurrent)
│
└── results (fanout)
    └── Results Queue
        ├── Consumer: Result Aggregator
        └── Prefetch: 10 (batch processing)
```

**Message Format:**

```javascript
// Task message
{
  "task_id": "uuid",
  "type": "brainstorm",
  "prompt": "...",
  "metadata": {
    "source": "api",
    "priority": "normal",
    "timeout": 300
  },
  "created_at": "2025-11-18T10:00:00Z"
}

// Result message
{
  "task_id": "uuid",
  "agent_id": "agent-1",
  "status": "completed|failed",
  "result": "...",
  "duration_ms": 5000,
  "metadata": {...},
  "completed_at": "2025-11-18T10:05:00Z"
}
```

**Acknowledgment Strategy:**
- Auto-ack disabled
- Manual ack after processing
- Failed messages requeued (up to max_retries)
- Dead letter exchange for failed messages

### 3. Agent Processors

**Agent Types:**

```
1. BRAINSTORM AGENT
   - Consumes: brainstorm_tasks queue
   - Process: Generates multiple solution approaches
   - Output: Detailed brainstorm results
   - Timeout: 60 seconds per task
   - Parallelism: 2 tasks at once

2. TASK WORKER AGENTS (Pool of N)
   - Consumes: task_distribution queue
   - Process: Executes specific tasks
   - Output: Results to results queue
   - Timeout: 30 seconds per task
   - Parallelism: 1 task at a time
   - Scaling: Auto-scales based on queue depth

3. RESULT AGGREGATOR
   - Consumes: results queue
   - Process: Aggregates results
   - Output: Stores in database
   - Timeout: N/A (batch processing)
   - Parallelism: Processes in batches of 10
```

**Agent Lifecycle:**

```
Initialization:
  1. Register with API (POST /agents/register)
  2. Store registration in database
  3. Connect to RabbitMQ
  4. Send initial heartbeat
  5. Begin consuming messages

Running:
  1. Consumer loop reads messages
  2. Process message (internal logic)
  3. Update task status
  4. Send result to result queue
  5. Acknowledge message
  6. Send heartbeat every 30 seconds

Shutdown:
  1. Stop accepting new messages
  2. Process in-flight messages (max 5 min)
  3. Close RabbitMQ connection
  4. Clean up resources
```

### 4. Database Layer (PostgreSQL)

**Schema Overview:**

```
TABLE agents
├── agent_id (PK)
├── type (brainstorm|worker|aggregator)
├── status (active|inactive|error)
├── version
├── last_heartbeat
├── created_at
└── updated_at

TABLE task_submissions
├── task_id (PK)
├── type
├── prompt
├── parameters (JSONB)
├── status (queued|processing|completed|failed)
├── priority (1-10)
├── created_by (FK: users)
├── created_at
└── updated_at

TABLE task_results
├── task_id (FK, PK)
├── agent_id (FK: agents)
├── status (completed|failed)
├── result (JSONB)
├── error_message
├── processing_time_ms
├── completed_at
└── metadata (JSONB)

TABLE users
├── user_id (PK)
├── username
├── email
├── password_hash
├── status (active|disabled)
├── created_at
└── updated_at

TABLE sessions
├── session_id (PK)
├── user_id (FK)
├── token
├── ip_address
├── expires_at
└── created_at

TABLE audit_log
├── log_id (PK)
├── user_id (FK)
├── action (create|read|update|delete)
├── resource_type
├── resource_id
├── changes (JSONB)
└── timestamp
```

**Key Indexes:**

```sql
-- Fast task lookups
CREATE INDEX idx_task_results_status ON task_results(status)
  WHERE status != 'completed';

-- User session lookups
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);

-- Agent querying
CREATE INDEX idx_agents_status ON agents(status);

-- Time-range queries
CREATE INDEX idx_task_results_created ON task_results(created_at DESC);
```

### 5. Cache Layer (Redis)

**Usage Patterns:**

```
Session Cache:
  Key: session:{session_id}
  Value: { user_id, ip, created_at, last_activity }
  TTL: 24 hours

User Cache:
  Key: user:{user_id}
  Value: { id, username, email, roles }
  TTL: 1 hour

Agent Status Cache:
  Key: agent:{agent_id}
  Value: { status, task_count, last_heartbeat }
  TTL: 5 minutes

Rate Limit Tokens:
  Key: ratelimit:{user_id}:{endpoint}
  Value: token_count (counter)
  TTL: 60 seconds (sliding window)

Task Cache:
  Key: task:{task_id}
  Value: { status, result, metadata }
  TTL: 7 days
```

**Invalidation Strategy:**

```
When database record changes:
  1. Update database
  2. Delete cache key
  3. Next request rebuilds cache
  4. OR proactively rebuild cache for critical keys

Bulk invalidation (e.g., user changes):
  KEYS user:*
  DEL <all matching keys>
```

---

## DATA FLOW & MESSAGE PROCESSING

### Scenario: User Submits Task for Brainstorming

```
1. CLIENT SUBMISSION (0ms)
   POST /api/tasks
   {
     "type": "brainstorm",
     "prompt": "How to improve customer onboarding?"
   }
   ↓

2. API VALIDATION (5ms)
   - Schema validation (Joi)
   - Authentication check (JWT)
   - Rate limiting check (Redis)
   - User exists? (DB or cache)
   ↓

3. TASK PERSISTENCE (10ms)
   - INSERT into task_submissions table
   - task_id = generated UUID
   - status = 'queued'
   - Return task_id to client
   ↓

4. MESSAGE PUBLISHING (5ms)
   - Publish to RabbitMQ.brainstorm exchange
   - Message: { task_id, type, prompt, metadata }
   - Message persistence: yes
   - Delivery guarantee: at-least-once
   ↓

5. BROKER ROUTING (1ms)
   - RabbitMQ routes to brainstorm_tasks queue
   - Message stored on disk if durable
   ↓

6. AGENT CONSUMPTION (varies)
   - Brainstorm agent requests message
   - Prefetch=2 (max 2 unacked messages)
   - Receives message
   ↓

7. AGENT PROCESSING (20-60 seconds)
   - Agent internal processing
   - May call external APIs
   - Generate brainstorm results
   - UPDATE task_submissions SET status='processing'
   ↓

8. RESULT PUBLICATION (2ms)
   - Publish to RabbitMQ.results exchange
   - Message: { task_id, agent_id, result, status }
   ↓

9. RESULT AGGREGATION (5-10 seconds)
   - Result aggregator receives message
   - Batch processing (waits for others)
   - Aggregate multiple agent results if needed
   ↓

10. RESULT PERSISTENCE (10ms)
    - INSERT into task_results table
    - DELETE from task_submissions
    - Cache task result in Redis
    ↓

11. ACKNOWLEDGMENT (1ms)
    - Agent acknowledges original message
    - Message removed from queue
    ↓

12. CLIENT POLL (client dependent)
    - Client polls GET /api/tasks/{task_id}
    - Cache hit on Redis (7 day TTL)
    - Return result to user

Total time: 30-90 seconds (depending on agent processing time)
```

### Message Retry Logic

```
Message Processing:
  1. First attempt: Process normally
  2. If error:
     - Log error
     - Increment retry_count
     - If retry_count < max_retries (3):
       - Requeue message with delay (exponential backoff)
       - Delay: 2^retry_count seconds
       - Retry 1: 2 seconds
       - Retry 2: 4 seconds
       - Retry 3: 8 seconds
     - If retry_count >= max_retries:
       - Send to dead-letter queue
       - Alert monitoring system
       - Task marked as 'failed' in database

Dead-letter queue:
  - Messages that can't be processed
  - Manual review required
  - Stored for up to 30 days
```

---

## INFRASTRUCTURE & DEPLOYMENT

### Container Architecture

```
Docker Compose Services:

1. orchestrator (Port 3000)
   - Express.js application
   - Connects to RabbitMQ
   - Connects to PostgreSQL
   - Connects to Redis
   - Image: node:18-alpine
   - Memory: 1.5GB limit
   - Restart: unless-stopped

2. rabbitmq (Port 5672, 15672)
   - RabbitMQ broker
   - Management UI on 15672
   - Persistent volumes
   - Image: rabbitmq:3.12-management
   - Memory: 512MB limit
   - Restart: unless-stopped

3. postgres (Port 5432)
   - PostgreSQL database
   - Persistent volumes
   - Image: postgres:15-alpine
   - Memory: 512MB limit
   - Restart: unless-stopped

4. redis (Port 6379)
   - Redis cache
   - Image: redis:7-alpine
   - Memory: 256MB limit
   - Restart: unless-stopped

5. monitor (Port 9090, 3001)
   - Prometheus + Grafana
   - Metrics collection
   - Dashboards
   - Image: custom (prom + grafana)
```

### Health Checks

```
Application health:
  GET /health
  Expected: { "status": "operational", "services": {...} }
  Interval: 30 seconds
  Timeout: 5 seconds
  Unhealthy after: 3 failures

Database health:
  Check: Connection pool status
  Expected: < 80% connections used
  Interval: 60 seconds

RabbitMQ health:
  Check: Message broker responsiveness
  Expected: <100ms response time
  Interval: 30 seconds

Cache health:
  Check: GET/SET operations
  Expected: <10ms latency
  Interval: 60 seconds
```

### Networking

```
Internal Communication:
  - All services on docker network
  - Service discovery via Docker DNS
  - Service names resolve to IPs

External Communication:
  - API exposed on port 3000
  - Reverse proxy (nginx) in front
  - TLS termination at edge
  - Rate limiting at gateway

Environment Variables:
  - DATABASE_URL: postgresql://...
  - RABBITMQ_URL: amqp://...
  - REDIS_URL: redis://...
  - JWT_SECRET: [secret key]
  - LOG_LEVEL: debug|info|warn|error
```

---

## MONITORING & OBSERVABILITY

### Logging Strategy

```
Log Levels:

DEBUG: Detailed diagnostic information
  Example: Function entry/exit, variable values

INFO: General informational messages
  Example: Task started, agent registered, request completed

WARN: Warning messages for potential issues
  Example: Cache miss, slow query, retry attempt

ERROR: Error messages for failures
  Example: Task failed, database error, request failed

Structured logging format:
  {
    "timestamp": "2025-11-18T10:00:00Z",
    "level": "INFO",
    "service": "orchestrator",
    "message": "Task processing started",
    "task_id": "uuid",
    "agent_id": "agent-1",
    "duration_ms": 1234,
    "metadata": {...}
  }
```

### Key Metrics

```
Application Metrics:
  - http_requests_total{method, endpoint, status}
  - http_request_duration_seconds{endpoint, method}
  - task_submissions_total{type, status}
  - task_processing_duration_seconds{type, agent}
  - agents_active{type}
  - cache_hits_total vs cache_misses_total

Infrastructure Metrics:
  - container_memory_usage_bytes
  - container_cpu_usage_seconds
  - disk_usage_bytes
  - network_io_bytes{direction}

Business Metrics:
  - tasks_completed_per_hour
  - average_task_completion_time
  - error_rate_percent
  - user_count_active
```

---

## SECURITY ARCHITECTURE

### Authentication & Authorization

```
Authentication Flow:
  1. User provides username/password
  2. Hash password with bcryptjs
  3. Compare with stored hash
  4. If match:
     - Generate JWT token (HS256)
     - Token includes: user_id, email, roles
     - Token TTL: 24 hours
     - Return token to client
  5. Client stores token in localStorage
  6. Client includes token in Authorization header

Authorization Checks:
  - JWT signature verification
  - Token expiration check
  - User status check (active/disabled)
  - Role-based access control
  - Resource ownership check

Admin-only endpoints:
  - /admin/* - Requires admin role
  - System operations
  - User management
```

### Data Protection

```
At Rest:
  - Passwords: bcryptjs hashing (cost=10)
  - Sensitive data: Encryption in database
  - Database files: File permissions 600
  - Backups: Encrypted storage

In Transit:
  - HTTP: Upgraded to HTTPS
  - TLS 1.2+: Required
  - Certificate: Let's Encrypt auto-renewal
  - Internal: mTLS for service-to-service

Secrets Management:
  - Never in code (use .env)
  - Never in git history
  - Rotate periodically (quarterly)
  - Audit access logs
```

### Network Security

```
Firewall Rules:
  - 3000: API (restricted to load balancer)
  - 5432: PostgreSQL (internal only)
  - 5672: RabbitMQ (internal only)
  - 6379: Redis (internal only)

DDoS Protection:
  - Rate limiting per user/IP
  - CloudFlare CDN (if cloud-hosted)
  - WAF rules for common attacks

Input Validation:
  - All inputs validated with Joi schema
  - XSS protection with xss library
  - SQL injection: Parameterized queries only
  - Command injection: No shell commands
```

---

## HANDS-ON EXERCISES

### Exercise 1: Submit and Track a Task

**Objective:** Understand the task submission flow

```bash
# 1. Authenticate
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}' \
  | jq '.token' | xargs -I {} echo "TOKEN={}"

# 2. Submit a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "brainstorm",
    "prompt": "How to improve API performance?"
  }' | jq '.task_id' | xargs -I {} echo "TASK_ID={}"

# 3. Check task status immediately (should be queued)
curl http://localhost:3000/api/tasks/{TASK_ID} \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Wait 30 seconds (let agent process)
sleep 30

# 5. Check again (should be completed)
curl http://localhost:3000/api/tasks/{TASK_ID} \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. View the result
curl http://localhost:3000/api/tasks/{TASK_ID}/result \
  -H "Authorization: Bearer $TOKEN" | jq '.result'
```

### Exercise 2: Monitor Agent Activity

**Objective:** Understand agent metrics

```bash
# 1. List all agents
curl http://localhost:3000/api/agents \
  | jq '.[].{agent_id, status, task_count, last_heartbeat}'

# 2. Get specific agent detail
curl http://localhost:3000/api/agents/{agent_id} \
  | jq

# 3. View agent metrics
curl http://localhost:9090/api/v1/query?query='agents_active' \
  | jq '.data.result'

# 4. Check RabbitMQ queue depths
curl -u guest:guest http://localhost:15672/api/queues \
  | jq '.[] | {name, messages, consumers}'

# 5. View agent logs
docker-compose logs orchestrator | grep "agent-"
```

### Exercise 3: Inspect Message Flow

**Objective:** Understand RabbitMQ message routing

```bash
# 1. Check exchanges
curl -u guest:guest http://localhost:15672/api/exchanges \
  | jq '.[].{name, type, durable}'

# 2. Check queues
curl -u guest:guest http://localhost:15672/api/queues \
  | jq '.[].{name, durable, messages, consumers}'

# 3. Check bindings
curl -u guest:guest http://localhost:15672/api/bindings \
  | jq '.[].{source, destination, routing_key}'

# 4. Publish test message
(echo '{
  "task_id": "test-123",
  "type": "brainstorm",
  "prompt": "Test"
}' | base64) | \
curl -u guest:guest -X POST http://localhost:15672/api/exchanges/%2f/brainstorm/publish \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {},
    "routing_key": "brainstorm",
    "payload": "...",
    "payload_encoding": "string"
  }'

# 5. Check message appeared in queue
curl -u guest:guest http://localhost:15672/api/queues/%2f/brainstorm_tasks \
  | jq '{messages, consumers}'
```

### Exercise 4: Query Database State

**Objective:** Understand data model

```bash
# 1. Connect to database
psql -U orchestrator -d ai_agent_db

# 2. View task submissions
SELECT task_id, type, status, created_at FROM task_submissions LIMIT 5;

# 3. View results
SELECT task_id, agent_id, status, processing_time_ms FROM task_results LIMIT 5;

# 4. Check agent status
SELECT agent_id, type, status, last_heartbeat FROM agents;

# 5. User analytics
SELECT COUNT(*) as active_users FROM users WHERE status='active';

# 6. Performance analysis
SELECT type, AVG(processing_time_ms) as avg_time, COUNT(*) as total
FROM task_results
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY type;

# 7. Error analysis
SELECT status, COUNT(*) FROM task_results GROUP BY status;
```

### Exercise 5: Check Metrics Dashboard

**Objective:** Learn metric interpretation

```
1. Open Grafana: http://localhost:3001
2. Login: admin / admin
3. Navigate to dashboards:
   - System Dashboard: CPU, Memory, Disk
   - Agent Dashboard: Agent count, task processing
   - Performance Dashboard: Latency, throughput
   - Error Dashboard: Error rate, distribution

4. Practice interpreting graphs:
   - Identify trends
   - Spot anomalies
   - Correlate metrics
   - Predict issues
```

---

## TROUBLESHOOTING BASICS

### Systematic Troubleshooting Approach

```
1. Characterize the problem
   - What's not working?
   - When did it start?
   - How many users affected?
   - Is it reproducible?

2. Gather information
   - Application logs
   - System metrics
   - Recent changes
   - Error messages

3. Formulate hypothesis
   - What could cause this?
   - Order by likelihood
   - What would confirm?

4. Test hypothesis
   - Run diagnostic commands
   - Review logs
   - Check metrics
   - Test specific component

5. Implement fix
   - Start with simplest solution
   - Document what changed
   - Test thoroughly

6. Verify resolution
   - Check multiple angles
   - Monitor for regression
   - Update documentation
```

### Common Issues Quick Reference

```
Issue: Application won't start
  1. Check logs: docker-compose logs orchestrator
  2. Check port available: lsof -i :3000
  3. Check dependencies connected
  4. Check environment variables

Issue: Tasks not being processed
  1. Check RabbitMQ: curl -u guest:guest http://localhost:15672/api/overview
  2. Check queue depth: RabbitMQ UI
  3. Check agent status: curl http://localhost:3000/api/agents
  4. Check logs: docker-compose logs orchestrator

Issue: Slow response times
  1. Check database: SELECT COUNT(*) FROM pg_stat_activity;
  2. Check slow queries: See OPERATIONAL_RUNBOOKS
  3. Check cache: redis-cli INFO
  4. Check network: ping other services

Issue: High error rate
  1. Check logs: docker-compose logs --since 10m
  2. Check metrics: http://localhost:9090
  3. Check infrastructure: disk, memory, CPU
  4. Check recent changes: git log --since "10 minutes ago"

Issue: Database full
  1. Check size: du -sh /var/lib/postgresql
  2. Cleanup old logs: find /var/log -mtime +30 -delete
  3. VACUUM database
  4. Archive old data
```

---

**Training Complete!**

**Next Steps:**
1. Complete hands-on exercises
2. Review OPERATIONAL_RUNBOOKS.md
3. Study INCIDENT_RESPONSE_GUIDE.md
4. Shadow experienced team member
5. Take on-call rotation

**Document Version:** 1.0
**Last Updated:** November 18, 2025
**Status:** APPROVED FOR TRAINING
