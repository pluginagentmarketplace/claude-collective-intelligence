# AI Agent Orchestrator RabbitMQ API Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Error Handling](#error-handling)
5. [Agent Management](#agent-management)
6. [Task Management](#task-management)
7. [Voting System](#voting-system)
8. [Achievements System](#achievements-system)
9. [Health & Monitoring](#health--monitoring)
10. [Examples](#examples)

## Introduction

The AI Agent Orchestrator API provides a comprehensive REST interface for managing multi-agent distributed systems using RabbitMQ. The API is organized into logical groups:

- **Agents** - Agent lifecycle management (create, read, update, delete)
- **Tasks** - Task submission, status tracking, and result retrieval
- **Voting** - Democratic decision-making with multiple algorithms
- **Achievements** - Gamification and performance tracking
- **Health** - System health and readiness checks

### Base URL

```
http://localhost:3000
http://localhost:3001 (production)
```

### API Version

- **Current Version**: v1
- **All endpoints are prefixed with** `/api/v1`

### Response Format

All responses are JSON formatted with the following structure:

**Success Response:**
```json
{
  "data": {...},
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req-uuid-here"
  }
}
```

**Error Response:**
```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {...},
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v1/agents",
  "requestId": "req-uuid-here"
}
```

---

## Authentication

The API supports two authentication methods:

### JWT Bearer Token

Use for user/application authentication:

```bash
Authorization: Bearer <your_jwt_token>
```

**Token Structure:**
```json
{
  "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
  "role": "worker",
  "type": "access",
  "iat": 1705315800,
  "exp": 1705315800,
  "jti": "token-id",
  "iss": "rabbitmq-orchestrator",
  "aud": "agent-network"
}
```

**Token Expiration:**
- Access Token: 15 minutes
- Refresh Token: 7 days

### API Key

Use for service-to-service communication:

```bash
X-API-Key: <your_api_key>
```

### Example: Getting a Token

**Endpoint:** `POST /auth/login`

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
    "credentials": {
      "type": "apiKey",
      "apiKey": "your_api_key_here"
    }
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": "15m",
  "tokenType": "Bearer"
}
```

---

## Rate Limiting

Rate limits are applied per API key or authentication token:

### Rate Limit Tiers

| Tier | Requests/Minute | Requests/Hour |
|------|-----------------|---------------|
| Free | 60 | 1,000 |
| Standard | 300 | 10,000 |
| Premium | 1,000 | 100,000 |

### Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 300          # Total requests allowed per minute
X-RateLimit-Remaining: 287      # Requests remaining in current window
X-RateLimit-Reset: 1705315860   # Unix timestamp when limit resets
Retry-After: 30                 # Seconds to wait before retrying (on 429)
```

### Example: Rate Limit Exceeded

**Status Code:** `429 Too Many Requests`

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Maximum 300 requests per minute",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Success with no response body |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |
| 503 | Service Unavailable - Service down |

### Error Response Format

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "details": {
    "field": "priority",
    "issue": "must be one of: low, normal, high, urgent, critical"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v1/tasks",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input parameters |
| `UNAUTHORIZED` | 401 | Missing/invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `UNAVAILABLE` | 503 | Service unavailable |

---

## Agent Management

Agents are autonomous units in the orchestration system. Manage their lifecycle with these endpoints.

### List Agents

**Endpoint:** `GET /api/v1/agents`

**Description:** Retrieve a paginated list of agents with optional filtering

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | string | - | Filter by state: idle, busy, offline, error, maintenance |
| `role` | string | - | Filter by role: leader, worker, observer, coordinator, analyzer |
| `page` | integer | 1 | Page number for pagination |
| `limit` | integer | 20 | Results per page (max 100) |
| `sortBy` | string | createdAt | Sort field: createdAt, name, state |
| `sortOrder` | string | desc | Sort direction: asc, desc |

**Example Request:**

```bash
curl -X GET 'http://localhost:3000/api/v1/agents?state=idle&role=worker&page=1&limit=10' \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "agent-550e8400-e29b-41d4-a716-446655440000",
      "name": "worker-agent-1",
      "role": "worker",
      "state": "idle",
      "capabilities": ["compute", "analyze"],
      "resources": {
        "cpu": 20,
        "memory": 30,
        "network": 200,
        "storage": 1000
      },
      "health": {
        "status": "healthy",
        "checks": {
          "cpu": true,
          "memory": true,
          "network": true,
          "heartbeat": true
        },
        "lastCheck": "2024-01-15T10:30:00Z"
      },
      "metrics": {
        "cpuUsage": 45,
        "memoryUsage": 62,
        "activeTasks": 0,
        "completedTasks": 150,
        "failedTasks": 2,
        "uptime": 604800
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### Create Agent

**Endpoint:** `POST /api/v1/agents`

**Description:** Create a new agent with specified configuration

**Request Body:**

```json
{
  "name": "new-agent-1",
  "role": "worker",
  "capabilities": ["compute", "analyze", "generate"],
  "resources": {
    "cpu": 25,
    "memory": 40,
    "network": 250,
    "storage": 2000
  },
  "metadata": {
    "description": "High-performance compute agent",
    "tags": ["compute", "gpu-ready"],
    "owner": "admin@example.com",
    "team": "core-team",
    "version": "1.0.0"
  },
  "config": {
    "autoStart": true,
    "maxConcurrentTasks": 5,
    "taskTimeout": 60000,
    "retryPolicy": {
      "maxRetries": 3,
      "retryDelay": 1000,
      "backoffMultiplier": 2
    },
    "heartbeatInterval": 5000
  }
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "worker-agent-2",
    "role": "worker",
    "capabilities": ["compute", "analyze"],
    "resources": {
      "cpu": 20,
      "memory": 30,
      "network": 200
    }
  }'
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "agent-550e8400-e29b-41d4-a716-446655440001",
    "name": "worker-agent-2",
    "role": "worker",
    "state": "idle",
    "capabilities": ["compute", "analyze"],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Agent

**Endpoint:** `GET /api/v1/agents/{agentId}`

**Description:** Retrieve detailed information about a specific agent

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Agent unique identifier |

**Example Request:**

```bash
curl -X GET http://localhost:3000/api/v1/agents/agent-550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

### Update Agent

**Endpoint:** `PUT /api/v1/agents/{agentId}`

**Description:** Update agent configuration and properties

**Request Body:**

```json
{
  "updates": {
    "name": "updated-agent-name",
    "capabilities": ["compute", "analyze", "generate"],
    "resources": {
      "cpu": 30,
      "memory": 40
    },
    "config": {
      "maxConcurrentTasks": 10,
      "taskTimeout": 120000
    }
  },
  "reason": "Increased performance requirements for new workload",
  "updatedBy": "admin@example.com"
}
```

**Example Request:**

```bash
curl -X PUT http://localhost:3000/api/v1/agents/agent-550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "capabilities": ["compute", "analyze", "generate"]
    },
    "reason": "Added generation capability",
    "updatedBy": "admin"
  }'
```

### Delete Agent

**Endpoint:** `DELETE /api/v1/agents/{agentId}`

**Description:** Delete an agent from the system

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `force` | boolean | false | Force delete even if agent has active tasks |

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/v1/agents/agent-550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

**Response (204 No Content):** Empty response body

---

## Task Management

Tasks represent work to be distributed among agents.

### List Tasks

**Endpoint:** `GET /api/v1/tasks`

**Description:** Retrieve a paginated list of tasks with optional filtering

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | string | Filter by state: pending, queued, assigned, in_progress, completed, failed, cancelled |
| `priority` | string | Filter by priority: low, normal, high, urgent, critical |
| `assignedTo` | string | Filter by assigned agent ID |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 20, max: 100) |

**Example Request:**

```bash
curl -X GET 'http://localhost:3000/api/v1/tasks?state=in_progress&priority=high&limit=20' \
  -H "Authorization: Bearer <token>"
```

### Submit Task

**Endpoint:** `POST /api/v1/tasks`

**Description:** Submit a new task for execution by agents

**Request Body:**

```json
{
  "title": "Analyze Q4 Performance Metrics",
  "type": "analyze",
  "priority": "high",
  "description": "Analyze Q4 performance metrics and generate insights for next quarter planning",
  "category": "data_processing",
  "input": {
    "metrics": [
      {"name": "revenue", "value": 1000000},
      {"name": "efficiency", "value": 95.5}
    ]
  },
  "config": {
    "timeout": 300000,
    "retryCount": 3,
    "retryDelay": 5000,
    "parallelizable": true,
    "preemptible": false
  },
  "requirements": {
    "resources": {
      "cpu": {
        "min": 10,
        "preferred": 25,
        "max": 50
      },
      "memory": {
        "min": 512,
        "preferred": 1024,
        "max": 2048
      }
    },
    "agents": {
      "min": 1,
      "max": 3,
      "capabilities": ["analyze"]
    }
  },
  "metadata": {
    "tags": ["quarterly", "performance"],
    "submittedBy": "analyst@example.com",
    "project": "Q4-Analysis"
  }
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Process customer data",
    "type": "analyze",
    "description": "Analyze customer feedback from Q4",
    "category": "data_processing"
  }'
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "task-550e8400-e29b-41d4-a716-446655440000",
    "title": "Process customer data",
    "type": "analyze",
    "state": "pending",
    "priority": "normal",
    "progress": 0,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Task

**Endpoint:** `GET /api/v1/tasks/{taskId}`

**Description:** Retrieve detailed information about a specific task

**Example Request:**

```bash
curl -X GET http://localhost:3000/api/v1/tasks/task-550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

### Update Task

**Endpoint:** `PUT /api/v1/tasks/{taskId}`

**Description:** Update task status, priority, or other properties

**Request Body:**

```json
{
  "updates": {
    "state": "in_progress",
    "priority": "urgent",
    "progress": 50,
    "assignedTo": [
      "agent-550e8400-e29b-41d4-a716-446655440000",
      "agent-550e8400-e29b-41d4-a716-446655440001"
    ]
  },
  "reason": "Priority escalation due to deadline change",
  "updatedBy": "manager@example.com"
}
```

### Cancel Task

**Endpoint:** `DELETE /api/v1/tasks/{taskId}`

**Description:** Cancel a task

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/v1/tasks/task-550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

### Get Task Result

**Endpoint:** `GET /api/v1/tasks/{taskId}/result`

**Description:** Retrieve the result of a completed task

**Example Request:**

```bash
curl -X GET http://localhost:3000/api/v1/tasks/task-550e8400-e29b-41d4-a716-446655440000/result \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "data": {
    "id": "result-550e8400-e29b-41d4-a716-446655440000",
    "taskId": "task-550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "output": {
      "insights": [
        "Q4 revenue increased by 15%",
        "Customer satisfaction improved"
      ],
      "recommendations": ["Expand team", "Invest in automation"]
    },
    "format": "json",
    "execution": {
      "startTime": "2024-01-15T10:00:00Z",
      "endTime": "2024-01-15T10:30:00Z",
      "duration": 1800000,
      "attempts": 1,
      "resources": {
        "cpuTime": 45000,
        "memoryPeak": 512
      }
    }
  }
}
```

---

## Voting System

Enable democratic decision-making among agents with advanced voting algorithms.

### List Voting Sessions

**Endpoint:** `GET /api/v1/voting/sessions`

**Description:** Retrieve a list of voting sessions

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | string | Filter by state: open, closed, calculating, completed, cancelled |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 20) |

### Create Voting Session

**Endpoint:** `POST /api/v1/voting/sessions`

**Description:** Create a new voting session for agent decision-making

**Request Body:**

```json
{
  "topic": "Choose optimization strategy for next quarter",
  "question": "Which strategy should we prioritize?",
  "description": "We need to decide between three strategies...",
  "options": [
    {
      "id": "opt-1",
      "label": "Strategy A: Increase Parallelization",
      "description": "Focus on parallel task processing"
    },
    {
      "id": "opt-2",
      "label": "Strategy B: Optimize Memory Usage",
      "description": "Reduce memory footprint per task"
    },
    {
      "id": "opt-3",
      "label": "Strategy C: Hybrid Approach",
      "description": "Combine both strategies"
    }
  ],
  "algorithm": "confidence_weighted",
  "timing": {
    "startTime": "2024-01-15T10:30:00Z",
    "deadline": "2024-01-16T10:30:00Z",
    "extendable": true,
    "maxExtensions": 2
  },
  "quorum": {
    "minParticipation": 0.75,
    "minAgents": 5
  },
  "security": {
    "anonymousVoting": false,
    "encryptVotes": true,
    "auditTrail": true
  },
  "metadata": {
    "initiatedBy": "admin-agent",
    "category": "strategy",
    "tags": ["quarterly", "important"]
  }
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/v1/voting/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Choose next optimization",
    "question": "Which strategy?",
    "options": [
      {"id": "opt-1", "label": "Strategy A"},
      {"id": "opt-2", "label": "Strategy B"}
    ],
    "timing": {
      "deadline": "2024-01-16T23:59:59Z"
    },
    "metadata": {
      "initiatedBy": "admin"
    }
  }'
```

### Get Voting Session

**Endpoint:** `GET /api/v1/voting/sessions/{sessionId}`

**Description:** Retrieve details of a specific voting session including current state and participation

### Cast Vote

**Endpoint:** `POST /api/v1/voting/sessions/{sessionId}/vote`

**Description:** Cast a vote in an active voting session

**Request Body:**

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
  "vote": {
    "type": "single",
    "choice": "opt-1"
  },
  "confidence": 0.95,
  "reasoning": "Strategy A aligns with our current infrastructure and goals",
  "expertise": {
    "level": "expert",
    "domain": "optimization",
    "yearsExperience": 5
  }
}
```

**Voting Types:**

- **Single Choice:** One option
  ```json
  {
    "type": "single",
    "choice": "opt-1"
  }
  ```

- **Multiple Choice:** Multiple options
  ```json
  {
    "type": "multiple",
    "choices": ["opt-1", "opt-2"]
  }
  ```

- **Ranked Choice:** Ordered preferences
  ```json
  {
    "type": "ranked",
    "ranking": ["opt-1", "opt-2", "opt-3"]
  }
  ```

- **Weighted Vote:** Option-weight pairs
  ```json
  {
    "type": "weighted",
    "weights": {
      "opt-1": 50,
      "opt-2": 30,
      "opt-3": 20
    }
  }
  ```

- **Quadratic Vote:** Token allocation
  ```json
  {
    "type": "quadratic",
    "allocation": {
      "opt-1": 7,
      "opt-2": 3
    }
  }
  ```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/v1/voting/sessions/550e8400-e29b-41d4-a716-446655440000/vote \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
    "vote": {
      "type": "single",
      "choice": "opt-1"
    },
    "confidence": 0.9
  }'
```

### Get Voting Results

**Endpoint:** `GET /api/v1/voting/sessions/{sessionId}/results`

**Description:** Retrieve results of a completed voting session

**Example Response:**

```json
{
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "winner": "opt-1",
    "algorithm": "confidence_weighted",
    "totalVotes": 15,
    "validVotes": 15,
    "participationRate": 0.93,
    "results": {
      "options": [
        {
          "id": "opt-1",
          "label": "Strategy A",
          "votes": 10,
          "percentage": 0.67,
          "weightedScore": 8.5,
          "rank": 1
        },
        {
          "id": "opt-2",
          "label": "Strategy B",
          "votes": 4,
          "percentage": 0.27,
          "weightedScore": 3.2,
          "rank": 2
        },
        {
          "id": "opt-3",
          "label": "Strategy C",
          "votes": 1,
          "percentage": 0.06,
          "weightedScore": 0.8,
          "rank": 3
        }
      ]
    },
    "quorum": {
      "met": true
    },
    "calculatedAt": "2024-01-16T10:35:00Z"
  }
}
```

---

## Achievements System

Track agent performance and unlock achievements with gamification features.

### List Achievements

**Endpoint:** `GET /api/v1/achievements`

**Description:** Retrieve a list of available achievements

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category: speed, quality, collaboration, endurance, innovation, leadership, special, legendary |
| `tier` | string | Filter by tier: bronze, silver, gold, platinum, diamond, legendary |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 20) |

**Example Request:**

```bash
curl -X GET 'http://localhost:3000/api/v1/achievements?category=speed&tier=gold' \
  -H "Authorization: Bearer <token>"
```

### Claim Achievement

**Endpoint:** `POST /api/v1/achievements/claim`

**Description:** Claim an achievement with supporting evidence

**Request Body:**

```json
{
  "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
  "achievementId": "ach-speed-1",
  "evidence": {
    "taskCompletionTimes": [
      {
        "taskId": "task-550e8400-e29b-41d4-a716-446655440000",
        "duration": 15000
      },
      {
        "taskId": "task-550e8400-e29b-41d4-a716-446655440001",
        "duration": 12000
      },
      {
        "taskId": "task-550e8400-e29b-41d4-a716-446655440002",
        "duration": 18000
      }
    ]
  },
  "metadata": {
    "autoDetected": false
  }
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/v1/achievements/claim \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
    "achievementId": "ach-speed-1",
    "evidence": {
      "taskCompletionTimes": [
        {"taskId": "task-1", "duration": 10000}
      ]
    }
  }'
```

### Get Leaderboard

**Endpoint:** `GET /api/v1/achievements/leaderboard`

**Description:** Retrieve leaderboard rankings

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | points | Leaderboard type: points, achievements, tasks, efficiency |
| `period` | string | alltime | Time period: daily, weekly, monthly, alltime |
| `limit` | integer | 10 | Number of top entries (max: 100) |

**Example Request:**

```bash
curl -X GET 'http://localhost:3000/api/v1/achievements/leaderboard?type=points&period=weekly&limit=20' \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "data": {
    "type": "points",
    "period": "weekly",
    "entries": [
      {
        "rank": 1,
        "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
        "agentName": "Worker-1",
        "score": 5250,
        "change": 2,
        "stats": {
          "primary": 5250,
          "trend": "up",
          "percentile": 99
        },
        "badges": ["speed-master", "quality-elite"],
        "tier": "gold"
      },
      {
        "rank": 2,
        "agentId": "agent-550e8400-e29b-41d4-a716-446655440001",
        "agentName": "Worker-2",
        "score": 4875,
        "change": 0,
        "stats": {
          "primary": 4875,
          "trend": "stable",
          "percentile": 98
        }
      }
    ]
  }
}
```

---

## Health & Monitoring

Monitor system health and readiness.

### Health Check

**Endpoint:** `GET /health`

**Description:** Check overall system health

**Security:** No authentication required

**Example Request:**

```bash
curl -X GET http://localhost:3000/health
```

**Example Response (Healthy):**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 604800,
  "components": {
    "rabbitmq": {
      "status": "healthy",
      "latency": 5
    },
    "database": {
      "status": "healthy",
      "latency": 10
    },
    "redis": {
      "status": "healthy",
      "latency": 3
    }
  },
  "metrics": {
    "cpuUsage": 45,
    "memoryUsage": 62,
    "diskUsage": 35,
    "activeConnections": 150,
    "requestsPerSecond": 250
  }
}
```

### Readiness Check

**Endpoint:** `GET /ready`

**Description:** Check if service is ready to handle requests

**Security:** No authentication required

**Example Request:**

```bash
curl -X GET http://localhost:3000/ready
```

**Example Response:**

```json
{
  "ready": true,
  "dependencies": {
    "rabbitmq": true,
    "database": true,
    "redis": true
  }
}
```

### Metrics Collection

**Endpoint:** `GET /metrics`

**Description:** Retrieve system metrics in Prometheus format

**Security:** No authentication required

**Content-Type:** `text/plain`

**Example Request:**

```bash
curl -X GET http://localhost:3000/metrics
```

**Example Response:**

```
# HELP agent_count Total number of agents
# TYPE agent_count gauge
agent_count{state="idle"} 15
agent_count{state="busy"} 8
agent_count{state="offline"} 2

# HELP task_count Total number of tasks
# TYPE task_count gauge
task_count{state="pending"} 10
task_count{state="in_progress"} 5
task_count{state="completed"} 1250

# HELP task_duration_ms Task execution duration
# TYPE task_duration_ms histogram
task_duration_ms_bucket{le="1000"} 100
task_duration_ms_bucket{le="5000"} 350
task_duration_ms_bucket{le="10000"} 450
```

---

## Examples

### Complete Workflow Example

Here's a complete example of submitting a task and monitoring its progress:

```bash
# 1. Create an agent
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "analysis-agent",
    "role": "worker",
    "capabilities": ["analyze"]
  }'
# Response: agent-id = "agent-550e8400-..."

# 2. Submit a task
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Analyze customer data",
    "type": "analyze",
    "priority": "high",
    "description": "Analyze Q4 customer behavior",
    "category": "data_processing"
  }'
# Response: task-id = "task-550e8400-..."

# 3. Get task status
curl -X GET http://localhost:3000/api/v1/tasks/task-550e8400-... \
  -H "Authorization: Bearer <token>"

# 4. Get task result when complete
curl -X GET http://localhost:3000/api/v1/tasks/task-550e8400-.../result \
  -H "Authorization: Bearer <token>"

# 5. Claim achievement
curl -X POST http://localhost:3000/api/v1/achievements/claim \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-550e8400-...",
    "achievementId": "ach-speed-1",
    "evidence": {
      "taskCompletionTimes": [{
        "taskId": "task-550e8400-...",
        "duration": 5000
      }]
    }
  }'
```

### Error Handling Example

```bash
# Missing authentication
curl -X GET http://localhost:3000/api/v1/agents
# Response (401):
{
  "code": "UNAUTHORIZED",
  "message": "Missing authentication token"
}

# Invalid request parameters
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer <token>" \
  -d '{"title": "Task"}'
# Response (400):
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "details": {
    "field": "type",
    "issue": "type is required"
  }
}

# Rate limited
curl -X GET http://localhost:3000/api/v1/tasks
# Response (429):
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Maximum 300 requests per minute"
}
```

---

## Support

For additional support and questions:

- **Email:** support@orchestrator.local
- **Documentation:** [Full API Specification](../openapi.yaml)
- **Swagger UI:** [Interactive API Explorer](/api/docs)
