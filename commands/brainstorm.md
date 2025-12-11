---
description: Initiate a multi-agent brainstorming session for collaborative problem solving
allowed-tools: Read, Bash, Task, Skill
argument-hint: topic="<topic>" question="<question>" [agents=<list>]
---

# Brainstorm - Collaborative Multi-Agent Problem Solving

Initiate a brainstorming session where multiple agents collaborate to solve complex problems or make decisions.

## Usage

```bash
/brainstorm [options]
```

## Options

- `topic` - Brainstorm topic (required)
- `question` - Specific question to answer (required)
- `agents` - Target specific agent types (optional)
- `rounds` - Number of discussion rounds (default: 1)
- `timeout` - Max wait time for responses in seconds (default: 60)

## Examples

### Basic Brainstorm
```bash
/brainstorm topic="API Design" \
  question="Should we use REST, GraphQL, or gRPC for our microservices?"
```

**Result:**
- Broadcast to all connected collaborators
- Each agent analyzes from their perspective
- Responses aggregated
- Summary presented to initiator

### Targeted Brainstorm
```bash
/brainstorm topic="Database Optimization" \
  question="How can we reduce query latency from 500ms to 100ms?" \
  agents="database,performance,caching"
```

**Result:**
- Only database, performance, and caching specialists respond
- Focused expertise
- Higher quality insights

### Multi-Round Discussion
```bash
/brainstorm topic="System Architecture" \
  question="How should we structure our microservices?" \
  rounds=3
```

**Discussion Flow:**
```
Round 1: Initial proposals
    ↓
Round 2: Critique and refinement
    ↓
Round 3: Consensus building
```

## Brainstorm Flow

### Phase 1: Initiation
```
Initiator → Publishes to brainstorm exchange (fanout)
    ↓
All collaborators receive broadcast
```

### Phase 2: Individual Analysis
```
Each agent:
1. Analyzes topic and question
2. Considers from their specialty
3. Formulates structured response
4. Publishes to results queue
```

### Phase 3: Aggregation
```
Initiator:
1. Collects all responses
2. Identifies common themes
3. Notes conflicts
4. Builds consensus
5. Presents summary
```

## Response Structure

Each agent provides:

```json
{
  "agentId": "worker-backend-01",
  "specialty": "backend-architecture",
  "analysis": "Detailed analysis...",
  "pros": ["Advantage 1", "Advantage 2"],
  "cons": ["Concern 1", "Concern 2"],
  "recommendation": "Specific recommendation",
  "alternatives": ["Alternative 1", "Alternative 2"],
  "confidence": 0.85
}
```

## Real-World Scenarios

### Scenario 1: Technology Selection
```bash
# Terminal 1 (Team Leader)
/brainstorm topic="State Management" \
  question="Redux vs Zustand vs Jotai for React app?" \
  agents="frontend"

# Terminal 3 (Frontend Specialist #1)
# Response: "Zustand for simplicity, Redux for complex state"

# Terminal 4 (Frontend Specialist #2)
# Response: "Jotai for atomic state, better performance"

# Terminal 1 receives both perspectives
# Makes informed decision
```

### Scenario 2: Performance Problem
```bash
# Terminal 2 (Worker discovering issue)
/brainstorm topic="Performance Bottleneck" \
  question="API response time degraded from 100ms to 2s under load. Root cause?"

# Terminal 3 (Database Expert)
# "Check for missing indexes, N+1 queries"

# Terminal 4 (Caching Expert)
# "Implement Redis caching for hot data"

# Terminal 5 (Infrastructure Expert)
# "Check connection pool exhaustion, CPU throttling"

# Terminal 2 investigates all suggestions
# Finds root cause: connection pool exhaustion
```

### Scenario 3: Architecture Decision
```bash
# Terminal 1 (Coordinator)
/brainstorm topic="Monolith vs Microservices" \
  question="Should we migrate to microservices or optimize monolith?" \
  rounds=2

# Round 1: Initial positions
# - Agent A: "Microservices for scalability"
# - Agent B: "Optimize monolith, migration too risky"
# - Agent C: "Hybrid: extract critical services only"

# Round 2: Debate and refinement
# - Agent A: "Acknowledges migration risk, suggests phased approach"
# - Agent B: "Agrees some services could be extracted"
# - Agent C: "Proposes specific services to extract first"

# Consensus: Phased migration starting with auth service
```

## Multi-Round Brainstorming

### Round-Based Discussion
```bash
/brainstorm topic="Scaling Strategy" \
  question="How to handle 10x traffic increase?" \
  rounds=3
```

**Round 1: Ideas**
- Agent 1: Horizontal scaling
- Agent 2: Caching layer
- Agent 3: CDN for static assets
- Agent 4: Database read replicas

**Round 2: Analysis**
- Agent 1: "Horizontal scaling needs load balancer, stateless services"
- Agent 2: "Caching gives biggest immediate impact"
- Agent 3: "CDN reduces 40% of backend load"
- Agent 4: "Read replicas for read-heavy endpoints"

**Round 3: Consensus**
- Phase 1: CDN + Caching (quick wins)
- Phase 2: Read replicas (database bottleneck)
- Phase 3: Horizontal scaling (ultimate scalability)

## Brainstorm Patterns

### Pattern 1: Parallel Perspectives
```
Question → Multiple agents analyze independently → Aggregate
```

All agents provide independent analysis, no influence from others.

### Pattern 2: Sequential Refinement
```
Agent 1 proposal → Agent 2 builds on it → Agent 3 refines → Final
```

Each agent builds upon previous responses.

### Pattern 3: Debate Format
```
Agent 1: Position A
Agent 2: Position B
Agent 3: Evaluates both
Agent 4: Proposes compromise
```

Structured debate leading to synthesis.

### Pattern 4: Expert Panel
```
Frontend expert → Frontend perspective
Backend expert → Backend perspective
DevOps expert → Operations perspective
Security expert → Security perspective
→ Holistic solution
```

Each specialist contributes their domain expertise.

## Agent Specialization

Configure agent specialties:

```bash
# Terminal 2 - Database Specialist
AGENT_NAME="Database-Expert" \
AGENT_SPECIALTY="database-optimization" \
/orchestrate collaborator

# Terminal 3 - Security Specialist
AGENT_NAME="Security-Expert" \
AGENT_SPECIALTY="security" \
/orchestrate collaborator

# Terminal 4 - Performance Specialist
AGENT_NAME="Performance-Expert" \
AGENT_SPECIALTY="performance" \
/orchestrate collaborator
```

Then target specific specialists:

```bash
/brainstorm topic="Data Security" \
  question="How to implement end-to-end encryption?" \
  agents="security,database"

# Only security and database specialists respond
```

## Timeout and Waiting

```bash
# Wait longer for complex analysis
/brainstorm topic="System Design" \
  question="Design real-time collaborative editing system" \
  timeout=300

# Quick brainstorm
/brainstorm topic="Bug Fix" \
  question="Why is logout not working?" \
  timeout=30
```

## Consensus Building

System automatically identifies:

### Strong Consensus
```
All agents agree on approach
Confidence: HIGH
Action: Proceed with consensus
```

### Moderate Consensus
```
Majority agree, some dissent
Confidence: MEDIUM
Action: Consider majority view, note concerns
```

### No Consensus
```
Conflicting recommendations
Confidence: LOW
Action: Further discussion needed or leader decision
```

## Best Practices

1. **Clear Question**: Ask specific, answerable questions
2. **Appropriate Scope**: Not too broad, not too narrow
3. **Right Participants**: Target relevant specialists
4. **Sufficient Time**: Allow time for thorough analysis
5. **Multiple Rounds**: Use for complex decisions
6. **Document Results**: Save brainstorm outcomes
7. **Act on Insights**: Don't brainstorm without follow-up

## Integration with Task Assignment

Combine brainstorming with task execution:

```bash
# Assign collaborative task
/assign-task title="Implement payment gateway" \
  collaboration=true \
  question="Which payment provider: Stripe, PayPal, or Adyen?"

# Worker receives task
# Worker initiates brainstorm automatically
# Collects input from collaborators
# Makes decision
# Implements chosen solution
# Reports result
```

## Monitoring Brainstorms

```bash
# In Monitor terminal
/orchestrate monitor

# Dashboard shows active brainstorms:
# 🧠 ACTIVE BRAINSTORMS (2)
#    Session #1234: "API Design" - 3/4 responses received
#    Session #1235: "Performance Optimization" - 2/5 responses received
```

## Brainstorm Analytics

Track effectiveness:

```javascript
// Metrics collected
{
  totalBrainstorms: 50,
  avgResponseTime: '45s',
  avgParticipants: 3.5,
  consensusRate: 0.75,
  implementationRate: 0.82, // How often recommendations are followed
  successRate: 0.90 // How often brainstormed solutions work
}
```

## Advanced Features

### Weighted Voting
```bash
/brainstorm topic="Technology Choice" \
  question="Database selection" \
  voting=weighted \
  criteria="performance,scalability,cost"

# Agents vote on each criterion
# Weighted average determines winner
```

### Anonymous Brainstorm
```bash
/brainstorm topic="Process Improvement" \
  question="What's wrong with our current workflow?" \
  anonymous=true

# Agent IDs hidden from responses
# Reduces bias, encourages honesty
```

### Brainstorm Templates
```bash
/brainstorm template="architecture-review" \
  context='{"system":"payment-service"}'

# Pre-defined question structure
# Standardized response format
```

## Troubleshooting

### No responses
```bash
# Check collaborators are connected
/status agents

# Start collaborators if needed
/orchestrate collaborator
```

### Timeout before all responses
```bash
# Increase timeout
/brainstorm topic="..." question="..." timeout=120

# Or reduce number of participants
/brainstorm topic="..." question="..." agents="backend,frontend"
```

### Conflicting responses
```bash
# Use multi-round discussion
/brainstorm topic="..." question="..." rounds=3

# Or manual resolution
# Review all responses
# Make leader decision
```

## See Also

- `/orchestrate collaborator` - Start as brainstorm participant
- `/assign-task` - Assign task with collaboration
- `/status` - Monitor active brainstorms
