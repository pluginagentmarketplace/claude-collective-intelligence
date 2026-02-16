# Integration Examples

Production-grade integration examples for TypeScript/JavaScript, Python, and React applications.

## Table of Contents

1. [Express.js Integration](#expressjs-integration)
2. [Django Integration](#django-integration)
3. [FastAPI Integration](#fastapi-integration)
4. [React Hooks](#react-hooks)
5. [Real-World Scenarios](#real-world-scenarios)

## Express.js Integration

### Basic Setup with Agent Client

```typescript
import express, { Request, Response } from 'express';
import { AgentClient } from '@ai-agent/typescript-sdk';

const app = express();
app.use(express.json());

// Initialize client
const client = new AgentClient({
  apiUrl: process.env.AGENT_API_URL || 'http://localhost:3000',
  apiKey: process.env.AGENT_API_KEY || 'your-api-key'
});

// Middleware to attach client to request
app.use((req, res, next) => {
  req.agentClient = client;
  next();
});

declare global {
  namespace Express {
    interface Request {
      agentClient: AgentClient;
    }
  }
}

// Route: Submit a task
app.post('/api/tasks', async (req: Request, res: Response) => {
  try {
    const { name, type, payload } = req.body;

    const task = await client.tasks.submit({
      name,
      type,
      payload,
      priority: 'NORMAL'
    });

    res.json({
      success: true,
      data: task,
      taskUrl: `/api/tasks/${task.id}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Route: Get task status
app.get('/api/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await client.tasks.get(taskId);

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Task not found'
    });
  }
});

// Route: Wait for task completion
app.post('/api/tasks/:taskId/wait', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { timeout = 60000 } = req.body;

    const completed = await client.tasks.waitForCompletion(taskId, timeout);

    res.json({
      success: true,
      data: completed
    });
  } catch (error) {
    res.status(504).json({
      success: false,
      error: 'Task timeout or error'
    });
  }
});

// Route: Create agent
app.post('/api/agents', async (req: Request, res: Response) => {
  try {
    const { name, type, capabilities } = req.body;

    const agent = await client.agents.create({
      name,
      type,
      capabilities
    });

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid input'
    });
  }
});

// Route: List agents
app.get('/api/agents', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, type } = req.query;

    const agents = await client.agents.list({
      page: parseInt(String(page)),
      limit: parseInt(String(limit)),
      type: String(type) || undefined
    });

    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agents'
    });
  }
});

// Health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await client.health();
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'DOWN',
      error: 'Agent service unavailable'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await client.close();
  process.exit(0);
});

app.listen(3001, () => {
  console.log('Express server running on port 3001');
});
```

### Advanced: WebSocket Support for Real-time Updates

```typescript
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { AgentClient } from '@ai-agent/typescript-sdk';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' }
});

const client = new AgentClient({
  apiUrl: 'http://localhost:3000',
  apiKey: process.env.AGENT_API_KEY!
});

// Real-time task polling with WebSocket
io.on('connection', (socket) => {
  socket.on('watch-task', async (taskId: string) => {
    let isCompleted = false;

    while (!isCompleted && socket.connected) {
      try {
        const task = await client.tasks.get(taskId);

        socket.emit('task-update', {
          taskId,
          status: task.status,
          result: task.result,
          error: task.error
        });

        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)) {
          isCompleted = true;
          socket.emit('task-complete', { taskId, task });
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        socket.emit('task-error', {
          taskId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(3001);
```

## Django Integration

### Django Views with Agent Client

```python
# requirements.txt
django>=4.0
ai-agent-orchestrator>=1.0.0
aiohttp>=3.8.0

# settings.py
import os
from ai_agent import AgentClient

AGENT_CLIENT_CONFIG = {
    'api_url': os.getenv('AGENT_API_URL', 'http://localhost:3000'),
    'api_key': os.getenv('AGENT_API_KEY', 'your-api-key'),
    'timeout': 30,
    'max_retries': 3,
}

# views.py
import asyncio
import json
from django.http import JsonResponse
from django.views import View
from django.views.decorators.http import require_http_methods
from ai_agent import AgentClient, TaskSubmitParams, AgentCreateParams
from .settings import AGENT_CLIENT_CONFIG


class AgentClient Singleton:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = AgentClient(**AGENT_CLIENT_CONFIG)
        return cls._instance


def get_event_loop():
    try:
        return asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


class TaskListCreateView(View):
    """Submit and list tasks"""

    async def async_post(self, request):
        """Submit a task"""
        try:
            data = json.loads(request.body)
            client = AgentClient Singleton.get_instance()

            task = await client.tasks.submit(
                TaskSubmitParams(
                    name=data.get('name'),
                    type=data.get('type'),
                    payload=data.get('payload'),
                    priority=data.get('priority', 'NORMAL'),
                    description=data.get('description')
                )
            )

            return JsonResponse({
                'success': True,
                'data': {
                    'id': task.id,
                    'name': task.name,
                    'status': task.status
                }
            })
        except Exception as error:
            return JsonResponse({
                'success': False,
                'error': str(error)
            }, status=400)

    async def async_get(self, request):
        """List tasks"""
        try:
            page = int(request.GET.get('page', 1))
            limit = int(request.GET.get('limit', 10))
            client = AgentClient Singleton.get_instance()

            tasks_response = await client.tasks.list(
                page=page,
                limit=limit
            )

            return JsonResponse({
                'success': True,
                'data': tasks_response
            })
        except Exception as error:
            return JsonResponse({
                'success': False,
                'error': str(error)
            }, status=500)

    def post(self, request):
        """POST handler"""
        loop = get_event_loop()
        return loop.run_until_complete(self.async_post(request))

    def get(self, request):
        """GET handler"""
        loop = get_event_loop()
        return loop.run_until_complete(self.async_get(request))


class TaskDetailView(View):
    """Get task details and wait for completion"""

    async def async_get(self, request, task_id):
        """Get task details"""
        try:
            client = AgentClient Singleton.get_instance()
            task = await client.tasks.get(task_id)

            return JsonResponse({
                'success': True,
                'data': {
                    'id': task.id,
                    'name': task.name,
                    'status': task.status,
                    'result': task.result,
                    'error': task.error
                }
            })
        except Exception as error:
            return JsonResponse({
                'success': False,
                'error': str(error)
            }, status=404)

    async def async_post(self, request, task_id):
        """Wait for task completion"""
        try:
            timeout = json.loads(request.body).get('timeout', 60)
            client = AgentClient Singleton.get_instance()

            task = await client.tasks.wait_for_completion(task_id, timeout)

            return JsonResponse({
                'success': True,
                'data': {
                    'id': task.id,
                    'status': task.status,
                    'result': task.result
                }
            })
        except Exception as error:
            return JsonResponse({
                'success': False,
                'error': str(error)
            }, status=504)

    def get(self, request, task_id):
        """GET handler"""
        loop = get_event_loop()
        return loop.run_until_complete(self.async_get(request, task_id))

    def post(self, request, task_id):
        """POST handler"""
        loop = get_event_loop()
        return loop.run_until_complete(self.async_post(request, task_id))


# urls.py
from django.urls import path
from .views import TaskListCreateView, TaskDetailView

urlpatterns = [
    path('tasks/', TaskListCreateView.as_view(), name='task-list-create'),
    path('tasks/<str:task_id>/', TaskDetailView.as_view(), name='task-detail'),
]
```

## FastAPI Integration

### FastAPI with Async Agent Client

```python
# requirements.txt
fastapi>=0.100.0
uvicorn>=0.23.0
ai-agent-orchestrator>=1.0.0

# main.py
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from ai_agent import AgentClient, TaskSubmitParams, AgentCreateParams

# Initialize app and client
app = FastAPI(title="Agent API Gateway")

# Global client instance
agent_client: Optional[AgentClient] = None


@app.on_event("startup")
async def startup():
    """Initialize agent client on startup"""
    global agent_client
    agent_client = AgentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key",
        timeout=30,
        max_retries=3
    )
    await agent_client.initialize()


@app.on_event("shutdown")
async def shutdown():
    """Close agent client on shutdown"""
    if agent_client:
        await agent_client.close()


# Request/Response models
class TaskSubmitRequest(BaseModel):
    name: str
    type: str
    payload: dict
    priority: str = "NORMAL"
    description: Optional[str] = None


class TaskWaitRequest(BaseModel):
    timeout: int = 60


class AgentCreateRequest(BaseModel):
    name: str
    type: str
    capabilities: list[str]


# Task endpoints
@app.post("/tasks")
async def submit_task(request: TaskSubmitRequest):
    """Submit a new task"""
    try:
        task = await agent_client.tasks.submit(
            TaskSubmitParams(
                name=request.name,
                type=request.type,
                payload=request.payload,
                priority=request.priority,
                description=request.description
            )
        )
        return {
            "success": True,
            "data": {
                "id": task.id,
                "name": task.name,
                "status": task.status
            }
        }
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/tasks")
async def list_tasks(page: int = 1, limit: int = 10):
    """List all tasks"""
    try:
        tasks = await agent_client.tasks.list(page=page, limit=limit)
        return {
            "success": True,
            "data": tasks
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get task details"""
    try:
        task = await agent_client.tasks.get(task_id)
        return {
            "success": True,
            "data": {
                "id": task.id,
                "name": task.name,
                "status": task.status,
                "result": task.result,
                "error": task.error
            }
        }
    except Exception as error:
        raise HTTPException(status_code=404, detail="Task not found")


@app.post("/tasks/{task_id}/wait")
async def wait_task(task_id: str, request: TaskWaitRequest):
    """Wait for task completion"""
    try:
        task = await agent_client.tasks.wait_for_completion(
            task_id,
            timeout=request.timeout
        )
        return {
            "success": True,
            "data": {
                "id": task.id,
                "status": task.status,
                "result": task.result
            }
        }
    except Exception as error:
        raise HTTPException(status_code=504, detail=str(error))


@app.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel a task"""
    try:
        task = await agent_client.tasks.cancel(task_id)
        return {
            "success": True,
            "data": {"status": task.status}
        }
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


# Agent endpoints
@app.post("/agents")
async def create_agent(request: AgentCreateRequest):
    """Create a new agent"""
    try:
        agent = await agent_client.agents.create(
            AgentCreateParams(
                name=request.name,
                type=request.type,
                capabilities=request.capabilities
            )
        )
        return {
            "success": True,
            "data": {
                "id": agent.id,
                "name": agent.name,
                "type": agent.type
            }
        }
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/agents")
async def list_agents(page: int = 1, limit: int = 10, type: Optional[str] = None):
    """List agents"""
    try:
        agents = await agent_client.agents.list(
            page=page,
            limit=limit,
            agent_type=type
        )
        return {
            "success": True,
            "data": agents
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    """Get agent details"""
    try:
        agent = await agent_client.agents.get(agent_id)
        return {
            "success": True,
            "data": {
                "id": agent.id,
                "name": agent.name,
                "status": agent.status,
                "capabilities": agent.capabilities
            }
        }
    except Exception as error:
        raise HTTPException(status_code=404, detail="Agent not found")


# Health check
@app.get("/health")
async def health():
    """Health check"""
    try:
        health = await agent_client.health()
        return {
            "status": health.status,
            "checks": health.checks
        }
    except Exception:
        return {"status": "DOWN"}, 503


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## React Hooks

### Custom React Hooks for Agent Management

```typescript
// hooks/useAgent.ts
import { useState, useEffect, useCallback } from 'react';
import { AgentClient, Agent } from '@ai-agent/typescript-sdk';

const agentClient = new AgentClient({
  apiUrl: process.env.REACT_APP_AGENT_API_URL || 'http://localhost:3000',
  apiKey: process.env.REACT_APP_AGENT_API_KEY || 'your-api-key'
});

export const useAgent = (agentId: string) => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const data = await agentClient.agents.get(agentId);
        setAgent(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [agentId]);

  return { agent, loading, error };
};

// hooks/useTask.ts
import { useState, useCallback, useEffect } from 'react';
import { Task, TaskSubmitParams } from '@ai-agent/typescript-sdk';

export const useTask = () => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submitTask = useCallback(async (params: TaskSubmitParams) => {
    setLoading(true);
    setError(null);

    try {
      const submitted = await agentClient.tasks.submit(params);
      setTask(submitted);
      return submitted;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const waitForCompletion = useCallback(async (taskId: string) => {
    setLoading(true);
    try {
      const completed = await agentClient.tasks.waitForCompletion(taskId);
      setTask(completed);
      return completed;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    task,
    loading,
    error,
    submitTask,
    waitForCompletion
  };
};

// Component usage
const TaskForm = () => {
  const { task, loading, submitTask } = useTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    await submitTask({
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      payload: {
        description: formData.get('description')
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Task name" required />
      <input name="type" placeholder="Task type" required />
      <textarea name="description" placeholder="Description" />
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Task'}
      </button>
      {task && <p>Task ID: {task.id}</p>}
    </form>
  );
};
```

## Real-World Scenarios

### Scenario 1: Data Processing Pipeline

```typescript
// Process customer data with multiple agents
async function processCustomerData(customers: any[]) {
  const client = new AgentClient({
    apiUrl: 'http://localhost:3000',
    apiKey: process.env.AGENT_API_KEY!
  });

  try {
    // Create specialized agents
    const validators = await client.agents.create({
      name: 'Data Validator',
      type: 'SPECIALIST',
      capabilities: ['validation', 'data-quality']
    });

    const processors = await client.agents.create({
      name: 'Data Processor',
      type: 'WORKER',
      capabilities: ['processing', 'transformation']
    });

    // Submit tasks to pipeline
    const validationTasks = await client.tasks.submitBatch(
      customers.map(c => ({
        name: `Validate ${c.id}`,
        type: 'validation',
        payload: c
      }))
    );

    // Wait for validation
    const validatedResults = await client.tasks.waitForAll(
      validationTasks.map(t => t.id)
    );

    // Process valid records
    const processingTasks = await client.tasks.submitBatch(
      validatedResults
        .filter(t => t.status === 'COMPLETED')
        .map(t => ({
          name: `Process ${t.id}`,
          type: 'processing',
          payload: t.result
        }))
    );

    const processed = await client.tasks.waitForAll(
      processingTasks.map(t => t.id)
    );

    return {
      total: customers.length,
      validated: validatedResults.filter(t => t.status === 'COMPLETED').length,
      processed: processed.filter(t => t.status === 'COMPLETED').length,
      results: processed
    };
  } finally {
    await client.close();
  }
}
```

### Scenario 2: Distributed Analysis System

```python
async def analyze_data_distributed(data_sources: list[str]):
    async with AgentClient(
        api_url="http://localhost:3000",
        api_key="your-api-key"
    ) as client:
        # Create analyzer agents
        analyzers = []
        for i in range(3):
            agent = await client.agents.create(
                AgentCreateParams(
                    name=f"Analyzer-{i}",
                    type="SPECIALIST",
                    capabilities=["analysis", "statistics"]
                )
            )
            analyzers.append(agent)

        # Distribute tasks
        tasks = []
        for source in data_sources:
            task = await client.tasks.submit(
                TaskSubmitParams(
                    name=f"Analyze {source}",
                    type="analysis",
                    payload={"source": source}
                )
            )
            tasks.append(task)

        # Wait for completion and aggregate results
        results = await client.tasks.wait_for_all([t.id for t in tasks])

        return {
            "total": len(results),
            "completed": sum(1 for r in results if r.status == "COMPLETED"),
            "failed": sum(1 for r in results if r.status == "FAILED"),
            "results": [r.result for r in results if r.status == "COMPLETED"]
        }
```

## Summary

These integration examples demonstrate:

- **Express.js**: REST API gateway with agent operations
- **Django**: Async views with agent client integration
- **FastAPI**: Modern async API with Pydantic models
- **React**: Custom hooks for task and agent management
- **Real-world**: Data processing pipelines and distributed analysis

Adapt these examples to your specific use case and requirements.
