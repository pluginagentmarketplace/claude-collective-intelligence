# API Examples - cURL, JavaScript, Python

Complete examples for using the AI Agent Orchestrator API in different programming languages.

## Table of Contents

1. [Authentication](#authentication)
2. [Agent Management](#agent-management)
3. [Task Management](#task-management)
4. [Voting System](#voting-system)
5. [Achievements](#achievements)
6. [Health Monitoring](#health-monitoring)

---

## Authentication

### Get JWT Token

#### cURL

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
    "credentials": {
      "type": "apiKey",
      "apiKey": "your_api_key_here"
    }
  }' | jq '.accessToken'
```

#### JavaScript

```javascript
const getToken = async () => {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId: 'agent-550e8400-e29b-41d4-a716-446655440000',
      credentials: {
        type: 'apiKey',
        apiKey: 'your_api_key_here',
      },
    }),
  });

  const data = await response.json();
  return data.accessToken;
};

// Usage
const token = await getToken();
console.log('Token:', token);
```

#### Python

```python
import requests
import json

def get_token():
    url = "http://localhost:3000/auth/login"
    payload = {
        "agentId": "agent-550e8400-e29b-41d4-a716-446655440000",
        "credentials": {
            "type": "apiKey",
            "apiKey": "your_api_key_here"
        }
    }

    response = requests.post(url, json=payload)
    data = response.json()
    return data['accessToken']

# Usage
token = get_token()
print(f"Token: {token}")
```

---

## Agent Management

### List Agents

#### cURL

```bash
TOKEN="your_jwt_token_here"

curl -X GET 'http://localhost:3000/api/v1/agents?state=idle&limit=10' \
  -H "Authorization: Bearer $TOKEN"
```

#### JavaScript

```javascript
const listAgents = async (token, options = {}) => {
  const params = new URLSearchParams({
    state: options.state || 'idle',
    limit: options.limit || 10,
    page: options.page || 1,
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/agents?${params}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return await response.json();
};

// Usage
const agents = await listAgents(token, { state: 'idle', limit: 10 });
console.log('Agents:', agents.data);
```

#### Python

```python
import requests

def list_agents(token, state=None, limit=10, page=1):
    url = "http://localhost:3000/api/v1/agents"
    params = {
        'state': state,
        'limit': limit,
        'page': page
    }

    headers = {
        'Authorization': f'Bearer {token}'
    }

    response = requests.get(url, params=params, headers=headers)
    return response.json()

# Usage
agents = list_agents(token, state='idle', limit=10)
print(f"Agents: {agents['data']}")
```

### Create Agent

#### cURL

```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:3000/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "worker-agent-1",
    "role": "worker",
    "capabilities": ["compute", "analyze"],
    "resources": {
      "cpu": 25,
      "memory": 40,
      "network": 250,
      "storage": 2000
    },
    "config": {
      "maxConcurrentTasks": 5,
      "taskTimeout": 60000
    }
  }'
```

#### JavaScript

```javascript
const createAgent = async (token, agentData) => {
  const response = await fetch('http://localhost:3000/api/v1/agents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(agentData),
  });

  if (!response.ok) {
    throw new Error(`Failed to create agent: ${response.statusText}`);
  }

  return await response.json();
};

// Usage
const newAgent = await createAgent(token, {
  name: 'worker-agent-1',
  role: 'worker',
  capabilities: ['compute', 'analyze'],
  resources: {
    cpu: 25,
    memory: 40,
    network: 250,
  },
});

console.log('Created agent:', newAgent.data);
```

#### Python

```python
def create_agent(token, agent_data):
    url = "http://localhost:3000/api/v1/agents"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    response = requests.post(url, json=agent_data, headers=headers)

    if response.status_code != 201:
        raise Exception(f"Failed to create agent: {response.text}")

    return response.json()

# Usage
agent_data = {
    'name': 'worker-agent-1',
    'role': 'worker',
    'capabilities': ['compute', 'analyze'],
    'resources': {
        'cpu': 25,
        'memory': 40,
        'network': 250,
    }
}

new_agent = create_agent(token, agent_data)
print(f"Created agent: {new_agent['data']}")
```

### Update Agent

#### cURL

```bash
TOKEN="your_jwt_token_here"
AGENT_ID="agent-550e8400-e29b-41d4-a716-446655440000"

curl -X PUT http://localhost:3000/api/v1/agents/$AGENT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "capabilities": ["compute", "analyze", "generate"],
      "resources": {
        "cpu": 30,
        "memory": 50
      }
    },
    "reason": "Added generation capability for new workload",
    "updatedBy": "admin@example.com"
  }'
```

#### JavaScript

```javascript
const updateAgent = async (token, agentId, updates, reason, updatedBy) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/agents/${agentId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        updates,
        reason,
        updatedBy,
      }),
    }
  );

  return await response.json();
};

// Usage
const updated = await updateAgent(
  token,
  'agent-550e8400-e29b-41d4-a716-446655440000',
  {
    capabilities: ['compute', 'analyze', 'generate'],
    resources: { cpu: 30, memory: 50 },
  },
  'Added generation capability',
  'admin@example.com'
);

console.log('Updated agent:', updated.data);
```

#### Python

```python
def update_agent(token, agent_id, updates, reason, updated_by):
    url = f"http://localhost:3000/api/v1/agents/{agent_id}"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    payload = {
        'updates': updates,
        'reason': reason,
        'updatedBy': updated_by
    }

    response = requests.put(url, json=payload, headers=headers)
    return response.json()

# Usage
updates = {
    'capabilities': ['compute', 'analyze', 'generate'],
    'resources': {'cpu': 30, 'memory': 50}
}

updated = update_agent(
    token,
    'agent-550e8400-e29b-41d4-a716-446655440000',
    updates,
    'Added generation capability',
    'admin@example.com'
)

print(f"Updated agent: {updated['data']}")
```

### Delete Agent

#### cURL

```bash
TOKEN="your_jwt_token_here"
AGENT_ID="agent-550e8400-e29b-41d4-a716-446655440000"

curl -X DELETE http://localhost:3000/api/v1/agents/$AGENT_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### JavaScript

```javascript
const deleteAgent = async (token, agentId, force = false) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/agents/${agentId}?force=${force}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return response.status === 204;
};

// Usage
const deleted = await deleteAgent(
  token,
  'agent-550e8400-e29b-41d4-a716-446655440000'
);

console.log('Agent deleted:', deleted);
```

#### Python

```python
def delete_agent(token, agent_id, force=False):
    url = f"http://localhost:3000/api/v1/agents/{agent_id}"
    headers = {
        'Authorization': f'Bearer {token}'
    }
    params = {'force': force}

    response = requests.delete(url, headers=headers, params=params)
    return response.status_code == 204

# Usage
deleted = delete_agent(token, 'agent-550e8400-e29b-41d4-a716-446655440000')
print(f"Agent deleted: {deleted}")
```

---

## Task Management

### Submit Task

#### cURL

```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Analyze Q4 Performance Metrics",
    "type": "analyze",
    "priority": "high",
    "description": "Analyze Q4 performance metrics and generate insights",
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
      "parallelizable": true
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
  }'
```

#### JavaScript

```javascript
const submitTask = async (token, taskData) => {
  const response = await fetch('http://localhost:3000/api/v1/tasks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit task: ${response.statusText}`);
  }

  return await response.json();
};

// Usage
const task = await submitTask(token, {
  title: 'Analyze Q4 Performance',
  type: 'analyze',
  priority: 'high',
  description: 'Analyze Q4 performance metrics',
  category: 'data_processing',
  input: {
    metrics: [
      { name: 'revenue', value: 1000000 },
      { name: 'efficiency', value: 95.5 },
    ],
  },
  config: {
    timeout: 300000,
    retryCount: 3,
    parallelizable: true,
  },
  requirements: {
    agents: {
      capabilities: ['analyze'],
    },
  },
  metadata: {
    tags: ['quarterly', 'performance'],
    submittedBy: 'analyst@example.com',
  },
});

console.log('Task submitted:', task.data.id);
```

#### Python

```python
def submit_task(token, task_data):
    url = "http://localhost:3000/api/v1/tasks"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    response = requests.post(url, json=task_data, headers=headers)

    if response.status_code != 201:
        raise Exception(f"Failed to submit task: {response.text}")

    return response.json()

# Usage
task_data = {
    'title': 'Analyze Q4 Performance',
    'type': 'analyze',
    'priority': 'high',
    'description': 'Analyze Q4 performance metrics',
    'category': 'data_processing',
    'input': {
        'metrics': [
            {'name': 'revenue', 'value': 1000000},
            {'name': 'efficiency', 'value': 95.5}
        ]
    },
    'config': {
        'timeout': 300000,
        'retryCount': 3,
        'parallelizable': True
    },
    'requirements': {
        'agents': {
            'capabilities': ['analyze']
        }
    },
    'metadata': {
        'tags': ['quarterly', 'performance'],
        'submittedBy': 'analyst@example.com'
    }
}

task = submit_task(token, task_data)
print(f"Task submitted: {task['data']['id']}")
```

### Get Task Status

#### cURL

```bash
TOKEN="your_jwt_token_here"
TASK_ID="task-550e8400-e29b-41d4-a716-446655440000"

curl -X GET http://localhost:3000/api/v1/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### JavaScript

```javascript
const getTaskStatus = async (token, taskId) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/tasks/${taskId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return await response.json();
};

// Usage
const task = await getTaskStatus(
  token,
  'task-550e8400-e29b-41d4-a716-446655440000'
);

console.log(`Task status: ${task.data.state}, Progress: ${task.data.progress}%`);
```

#### Python

```python
def get_task_status(token, task_id):
    url = f"http://localhost:3000/api/v1/tasks/{task_id}"
    headers = {
        'Authorization': f'Bearer {token}'
    }

    response = requests.get(url, headers=headers)
    return response.json()

# Usage
task = get_task_status(token, 'task-550e8400-e29b-41d4-a716-446655440000')
print(f"Task status: {task['data']['state']}, Progress: {task['data']['progress']}%")
```

### Get Task Result

#### cURL

```bash
TOKEN="your_jwt_token_here"
TASK_ID="task-550e8400-e29b-41d4-a716-446655440000"

curl -X GET http://localhost:3000/api/v1/tasks/$TASK_ID/result \
  -H "Authorization: Bearer $TOKEN"
```

#### JavaScript

```javascript
const getTaskResult = async (token, taskId) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/tasks/${taskId}/result`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Task not complete or error: ${response.statusText}`);
  }

  return await response.json();
};

// Usage - poll until result is available
const pollTaskResult = async (token, taskId, maxAttempts = 30) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await getTaskResult(token, taskId);
      return result.data;
    } catch (error) {
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1s
      } else {
        throw error;
      }
    }
  }
};

const result = await pollTaskResult(token, taskId);
console.log('Task result:', result.output);
```

#### Python

```python
import time

def get_task_result(token, task_id):
    url = f"http://localhost:3000/api/v1/tasks/{task_id}/result"
    headers = {
        'Authorization': f'Bearer {token}'
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"Task not complete or error: {response.text}")

    return response.json()

# Usage - poll until result is available
def poll_task_result(token, task_id, max_attempts=30, wait_time=1):
    for attempt in range(max_attempts):
        try:
            result = get_task_result(token, task_id)
            return result['data']
        except Exception as e:
            if attempt < max_attempts - 1:
                time.sleep(wait_time)
            else:
                raise

result = poll_task_result(token, task_id)
print(f"Task result: {result['output']}")
```

### Update Task

#### cURL

```bash
TOKEN="your_jwt_token_here"
TASK_ID="task-550e8400-e29b-41d4-a716-446655440000"

curl -X PUT http://localhost:3000/api/v1/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

#### JavaScript

```javascript
const updateTask = async (token, taskId, updates, reason, updatedBy) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/tasks/${taskId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        updates,
        reason,
        updatedBy,
      }),
    }
  );

  return await response.json();
};

// Usage
const updated = await updateTask(
  token,
  'task-550e8400-e29b-41d4-a716-446655440000',
  {
    state: 'in_progress',
    priority: 'urgent',
    progress: 50,
  },
  'Priority escalation',
  'manager@example.com'
);

console.log('Task updated:', updated.data);
```

#### Python

```python
def update_task(token, task_id, updates, reason, updated_by):
    url = f"http://localhost:3000/api/v1/tasks/{task_id}"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    payload = {
        'updates': updates,
        'reason': reason,
        'updatedBy': updated_by
    }

    response = requests.put(url, json=payload, headers=headers)
    return response.json()

# Usage
updates = {
    'state': 'in_progress',
    'priority': 'urgent',
    'progress': 50
}

updated = update_task(
    token,
    'task-550e8400-e29b-41d4-a716-446655440000',
    updates,
    'Priority escalation',
    'manager@example.com'
)

print(f"Task updated: {updated['data']}")
```

---

## Voting System

### Create Voting Session

#### cURL

```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:3000/api/v1/voting/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

#### JavaScript

```javascript
const createVotingSession = async (token, sessionData) => {
  const response = await fetch(
    'http://localhost:3000/api/v1/voting/sessions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionData),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }

  return await response.json();
};

// Usage
const session = await createVotingSession(token, {
  topic: 'Choose optimization strategy',
  question: 'Which strategy should we prioritize?',
  options: [
    { id: 'opt-1', label: 'Strategy A' },
    { id: 'opt-2', label: 'Strategy B' },
    { id: 'opt-3', label: 'Strategy C' },
  ],
  algorithm: 'confidence_weighted',
  timing: {
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  metadata: {
    initiatedBy: 'admin-agent',
    category: 'strategy',
  },
});

console.log('Voting session created:', session.data.id);
```

#### Python

```python
from datetime import datetime, timedelta

def create_voting_session(token, session_data):
    url = "http://localhost:3000/api/v1/voting/sessions"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    response = requests.post(url, json=session_data, headers=headers)

    if response.status_code != 201:
        raise Exception(f"Failed to create session: {response.text}")

    return response.json()

# Usage
deadline = (datetime.utcnow() + timedelta(days=1)).isoformat() + 'Z'

session_data = {
    'topic': 'Choose optimization strategy',
    'question': 'Which strategy should we prioritize?',
    'options': [
        {'id': 'opt-1', 'label': 'Strategy A'},
        {'id': 'opt-2', 'label': 'Strategy B'},
        {'id': 'opt-3', 'label': 'Strategy C'}
    ],
    'algorithm': 'confidence_weighted',
    'timing': {
        'deadline': deadline
    },
    'metadata': {
        'initiatedBy': 'admin-agent',
        'category': 'strategy'
    }
}

session = create_voting_session(token, session_data)
print(f"Voting session created: {session['data']['id']}")
```

### Cast Vote

#### cURL

```bash
TOKEN="your_jwt_token_here"
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X POST http://localhost:3000/api/v1/voting/sessions/$SESSION_ID/vote \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'$SESSION_ID'",
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
  }'
```

#### JavaScript

```javascript
const castVote = async (token, sessionId, voteData) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/voting/sessions/${sessionId}/vote`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(voteData),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to cast vote: ${response.statusText}`);
  }

  return await response.json();
};

// Usage
const vote = await castVote(token, sessionId, {
  sessionId,
  agentId: 'agent-550e8400-e29b-41d4-a716-446655440000',
  vote: {
    type: 'single',
    choice: 'opt-1',
  },
  confidence: 0.95,
  reasoning: 'Strategy A aligns with our current infrastructure',
  expertise: {
    level: 'expert',
    domain: 'optimization',
    yearsExperience: 5,
  },
});

console.log('Vote cast successfully:', vote.data.voteId);
```

#### Python

```python
def cast_vote(token, session_id, vote_data):
    url = f"http://localhost:3000/api/v1/voting/sessions/{session_id}/vote"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    response = requests.post(url, json=vote_data, headers=headers)

    if response.status_code != 201:
        raise Exception(f"Failed to cast vote: {response.text}")

    return response.json()

# Usage
vote_data = {
    'sessionId': session_id,
    'agentId': 'agent-550e8400-e29b-41d4-a716-446655440000',
    'vote': {
        'type': 'single',
        'choice': 'opt-1'
    },
    'confidence': 0.95,
    'reasoning': 'Strategy A aligns with our infrastructure',
    'expertise': {
        'level': 'expert',
        'domain': 'optimization',
        'yearsExperience': 5
    }
}

vote = cast_vote(token, session_id, vote_data)
print(f"Vote cast successfully: {vote['data']['voteId']}")
```

### Get Voting Results

#### cURL

```bash
TOKEN="your_jwt_token_here"
SESSION_ID="550e8400-e29b-41d4-a716-446655440000"

curl -X GET http://localhost:3000/api/v1/voting/sessions/$SESSION_ID/results \
  -H "Authorization: Bearer $TOKEN"
```

#### JavaScript

```javascript
const getVotingResults = async (token, sessionId) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/voting/sessions/${sessionId}/results`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get results: ${response.statusText}`);
  }

  return await response.json();
};

// Usage
const results = await getVotingResults(token, sessionId);
console.log('Winner:', results.data.winner);
console.log('Participation:', results.data.participationRate * 100 + '%');
```

#### Python

```python
def get_voting_results(token, session_id):
    url = f"http://localhost:3000/api/v1/voting/sessions/{session_id}/results"
    headers = {
        'Authorization': f'Bearer {token}'
    }

    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        raise Exception(f"Failed to get results: {response.text}")

    return response.json()

# Usage
results = get_voting_results(token, session_id)
print(f"Winner: {results['data']['winner']}")
print(f"Participation: {results['data']['participationRate'] * 100}%")
```

---

## Achievements

### Claim Achievement

#### cURL

```bash
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:3000/api/v1/achievements/claim \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

#### JavaScript

```javascript
const claimAchievement = async (token, claimData) => {
  const response = await fetch(
    'http://localhost:3000/api/v1/achievements/claim',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(claimData),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to claim achievement: ${response.statusText}`);
  }

  return await response.json();
};

// Usage
const claim = await claimAchievement(token, {
  agentId: 'agent-550e8400-e29b-41d4-a716-446655440000',
  achievementId: 'ach-speed-1',
  evidence: {
    taskCompletionTimes: [
      { taskId: 'task-1', duration: 15000 },
      { taskId: 'task-2', duration: 12000 },
      { taskId: 'task-3', duration: 18000 },
    ],
  },
});

console.log('Claim submitted:', claim.data.claimId);
```

#### Python

```python
def claim_achievement(token, claim_data):
    url = "http://localhost:3000/api/v1/achievements/claim"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    response = requests.post(url, json=claim_data, headers=headers)

    if response.status_code != 201:
        raise Exception(f"Failed to claim achievement: {response.text}")

    return response.json()

# Usage
claim_data = {
    'agentId': 'agent-550e8400-e29b-41d4-a716-446655440000',
    'achievementId': 'ach-speed-1',
    'evidence': {
        'taskCompletionTimes': [
            {'taskId': 'task-1', 'duration': 15000},
            {'taskId': 'task-2', 'duration': 12000},
            {'taskId': 'task-3', 'duration': 18000}
        ]
    }
}

claim = claim_achievement(token, claim_data)
print(f"Claim submitted: {claim['data']['claimId']}")
```

### Get Leaderboard

#### cURL

```bash
TOKEN="your_jwt_token_here"

curl -X GET 'http://localhost:3000/api/v1/achievements/leaderboard?type=points&period=weekly&limit=20' \
  -H "Authorization: Bearer $TOKEN"
```

#### JavaScript

```javascript
const getLeaderboard = async (token, type = 'points', period = 'alltime', limit = 10) => {
  const params = new URLSearchParams({
    type,
    period,
    limit,
  });

  const response = await fetch(
    `http://localhost:3000/api/v1/achievements/leaderboard?${params}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  return await response.json();
};

// Usage
const leaderboard = await getLeaderboard(token, 'points', 'weekly', 20);

leaderboard.data.entries.forEach((entry, index) => {
  console.log(`${index + 1}. ${entry.agentName}: ${entry.score} points`);
});
```

#### Python

```python
def get_leaderboard(token, type='points', period='alltime', limit=10):
    url = "http://localhost:3000/api/v1/achievements/leaderboard"
    params = {
        'type': type,
        'period': period,
        'limit': limit
    }

    headers = {
        'Authorization': f'Bearer {token}'
    }

    response = requests.get(url, params=params, headers=headers)
    return response.json()

# Usage
leaderboard = get_leaderboard(token, 'points', 'weekly', 20)

for i, entry in enumerate(leaderboard['data']['entries'], 1):
    print(f"{i}. {entry['agentName']}: {entry['score']} points")
```

---

## Health Monitoring

### Health Check

#### cURL

```bash
curl -X GET http://localhost:3000/health
```

#### JavaScript

```javascript
const getHealthStatus = async () => {
  const response = await fetch('http://localhost:3000/health');
  return await response.json();
};

// Usage
const health = await getHealthStatus();
console.log('Health status:', health.status);
console.log('Uptime:', health.uptime, 'seconds');
```

#### Python

```python
def get_health_status():
    url = "http://localhost:3000/health"
    response = requests.get(url)
    return response.json()

# Usage
health = get_health_status()
print(f"Health status: {health['status']}")
print(f"Uptime: {health['uptime']} seconds")
```

### Readiness Check

#### cURL

```bash
curl -X GET http://localhost:3000/ready
```

#### JavaScript

```javascript
const getReadinessStatus = async () => {
  const response = await fetch('http://localhost:3000/ready');
  return await response.json();
};

// Usage
const ready = await getReadinessStatus();
if (ready.ready) {
  console.log('Service is ready!');
} else {
  console.log('Service is not ready. Dependencies:', ready.dependencies);
}
```

#### Python

```python
def get_readiness_status():
    url = "http://localhost:3000/ready"
    response = requests.get(url)
    return response.json()

# Usage
ready = get_readiness_status()
if ready['ready']:
    print("Service is ready!")
else:
    print(f"Service is not ready. Dependencies: {ready['dependencies']}")
```

---

## Tips & Best Practices

### Error Handling

Always handle errors gracefully:

**JavaScript:**
```javascript
try {
  const agent = await createAgent(token, agentData);
  console.log('Agent created:', agent.data.id);
} catch (error) {
  if (error instanceof Response) {
    const errorData = await error.json();
    console.error('Error:', errorData.code, errorData.message);
  } else {
    console.error('Network error:', error.message);
  }
}
```

**Python:**
```python
try:
    agent = create_agent(token, agent_data)
    print(f"Agent created: {agent['data']['id']}")
except requests.exceptions.RequestException as e:
    print(f"Request error: {e}")
except Exception as e:
    print(f"Error: {e}")
```

### Rate Limit Handling

Check rate limit headers and implement backoff:

**JavaScript:**
```javascript
const makeRequestWithRetry = async (url, options, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After')) * 1000;
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      continue;
    }

    return response;
  }
};
```

**Python:**
```python
def make_request_with_retry(url, headers, method='GET', json=None, max_retries=3):
    for attempt in range(max_retries):
        if method == 'GET':
            response = requests.get(url, headers=headers)
        else:
            response = requests.post(url, json=json, headers=headers)

        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            time.sleep(retry_after)
            continue

        return response
```

### Token Refresh

Implement automatic token refresh:

**JavaScript:**
```javascript
const getValidToken = async (token, refreshToken) => {
  // Check if token is expiring soon (within 1 minute)
  const payload = JSON.parse(atob(token.split('.')[1]));
  const expiresIn = (payload.exp * 1000) - Date.now();

  if (expiresIn < 60000) {
    // Refresh the token
    const response = await fetch('http://localhost:3000/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();
    return data.accessToken;
  }

  return token;
};
```

