# Architecture Guide

## Multi-Agent Orchestration with RabbitMQ

This document provides a comprehensive overview of the system architecture, design decisions, scalability patterns, and integration strategies for the RabbitMQ-based multi-agent orchestration system.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Design Decisions](#2-design-decisions)
3. [Scalability Architecture](#3-scalability-architecture)
4. [Integration Patterns](#4-integration-patterns)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                     Multi-Agent Orchestration System                    │
└────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │   Client Applications   │
                    │  (Claude Code Sessions) │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │    Agent Orchestrator   │
                    │    (Node.js Process)    │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   RabbitMQ Client       │
                    │   (AMQP Protocol)       │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   RabbitMQ Broker       │
                    │   (Message Queue)       │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
    ┌─────────▼────────┐ ┌─────▼──────┐ ┌───────▼────────┐
    │   Task Queue     │ │ Exchanges  │ │  Result Queue  │
    │   (Work Dist)    │ │ (Pub/Sub)  │ │  (Aggregation) │
    └──────────────────┘ └────────────┘ └────────────────┘
```

### 1.2 Component Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                          System Components                             │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    Agent Orchestrator Layer                    │    │
│  │                                                                │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐          │    │
│  │  │ Team Leader │  │   Worker     │  │Collaborator │          │    │
│  │  │             │  │              │  │             │          │    │
│  │  │ • Assign    │  │ • Execute    │  │ • Brainstorm│          │    │
│  │  │ • Aggregate │  │ • Report     │  │ • Suggest   │          │    │
│  │  │ • Decide    │  │ • Retry      │  │ • Vote      │          │    │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘          │    │
│  │         │                │                 │                  │    │
│  └─────────┼────────────────┼─────────────────┼──────────────────┘    │
│            │                │                 │                       │
│  ┌─────────▼────────────────▼─────────────────▼──────────────────┐    │
│  │                   RabbitMQ Client Layer                        │    │
│  │                                                                │    │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐           │    │
│  │  │ Connection │  │   Channel   │  │   Message    │           │    │
│  │  │ Management │  │  Management │  │   Encoding   │           │    │
│  │  │            │  │             │  │              │           │    │
│  │  │ • Pool     │  │ • Prefetch  │  │ • JSON       │           │    │
│  │  │ • Retry    │  │ • Confirm   │  │ • Buffer     │           │    │
│  │  │ • Health   │  │ • QoS       │  │ • Compress   │           │    │
│  │  └────────────┘  └─────────────┘  └──────────────┘           │    │
│  │                                                                │    │
│  └────────────────────────────┬───────────────────────────────────┘    │
│                               │                                        │
│  ┌────────────────────────────▼───────────────────────────────────┐    │
│  │                     RabbitMQ Broker                            │    │
│  │                                                                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │    │
│  │  │   Queues    │  │  Exchanges  │  │   Bindings  │           │    │
│  │  │             │  │             │  │             │           │    │
│  │  │ • tasks     │  │ • fanout    │  │ • routing   │           │    │
│  │  │ • results   │  │ • topic     │  │ • patterns  │           │    │
│  │  │ • dlq       │  │ • direct    │  │ • filters   │           │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    Persistence Layer                           │    │
│  │                                                                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │    │
│  │  │   Message   │  │    State    │  │   Metrics   │           │    │
│  │  │  Persistence│  │   Storage   │  │   Storage   │           │    │
│  │  │             │  │             │  │             │           │    │
│  │  │ • Disk      │  │ • Redis     │  │ • InfluxDB  │           │    │
│  │  │ • Durable   │  │ • Memcache  │  │ • Prometheus│           │    │
│  │  │ • Replicate │  │ • Sync      │  │ • Grafana   │           │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 1.3 Data Flow

#### Task Distribution Flow
```
┌────────┐                                              ┌────────┐
│ Leader │                                              │Worker 1│
└───┬────┘                                              └───▲────┘
    │                                                       │
    │ 1. assignTask()                                      │
    │───────────────────────────────────┐                 │
    │                                   │                 │
    │                          ┌────────▼─────────┐       │
    │                          │  agent.tasks     │       │
    │                          │  (Queue)         │       │
    │                          │                  │       │
    │                          │  [Task 1]        │       │
    │                          │  [Task 2]        │       │
    │                          │  [Task 3]        │       │
    │                          └────────┬─────────┘       │
    │                                   │                 │
    │                                   │ 2. consumeTasks()
    │                                   │                 │
    │                                   └─────────────────┘
    │                                                     │
    │                                                     │ 3. processTask()
    │                                                     │
    │                          ┌────────┬─────────┐      │
    │                          │  agent.results   │◄─────┘
    │                          │  (Queue)         │  4. publishResult()
    │                          │                  │
    │ 5. consumeResults()      │  [Result 1]      │
    │◄─────────────────────────┤  [Result 2]      │
    │                          │  [Result 3]      │
    │                          └──────────────────┘
    │
    │ 6. aggregateResults()
    │
```

#### Brainstorm Collaboration Flow
```
┌────────┐                                              ┌──────────┐
│Worker 1│                                              │Collab 1  │
└───┬────┘                                              └────▲─────┘
    │                                                        │
    │ 1. broadcastBrainstorm()                              │
    │────────────────────────────────┐                      │
    │                                │                      │
    │                       ┌────────▼────────┐             │
    │                       │ agent.brainstorm│             │
    │                       │   (Fanout)      │             │
    │                       │                 │             │
    │                       └────┬─────┬──────┘             │
    │                            │     │                    │
    │                            │     │  2. listenBrainstorm()
    │                            │     └────────────────────┘
    │                            │                          │
    │                            │                          │ 3. respond()
    │                            │     ┌────────────────────┘
    │                            │     │
    │                       ┌────▼─────▼──────┐
    │                       │  agent.results  │
    │                       │  (Queue)        │
    │                       │                 │
    │                       │  [Response 1]   │
    │                       │  [Response 2]   │
    │ 4. collectResponses() │  [Response 3]   │
    │◄──────────────────────┤                 │
    │                       └─────────────────┘
    │
    │ 5. buildConsensus()
    │
```

#### Status Update Flow
```
┌────────┐  ┌────────┐  ┌────────┐
│Agent 1 │  │Agent 2 │  │Agent 3 │
└───┬────┘  └───┬────┘  └───┬────┘
    │           │           │
    │ status:   │ status:   │ status:
    │ connected │ task.start│ task.done
    │           │           │
    ├───────────┴───────────┴───────────┐
    │                                   │
    │         ┌─────────────────────┐   │
    │         │  agent.status       │   │
    │         │  (Topic Exchange)   │   │
    │         │                     │   │
    │         │  Routes by pattern: │   │
    │         │  • agent.status.*   │   │
    │         │  • agent.status.#   │   │
    │         └─────┬───────────────┘   │
    │               │                   │
    │               │                   │
    │     ┌─────────┼─────────┐         │
    │     │         │         │         │
    │  ┌──▼──┐   ┌─▼───┐  ┌──▼──┐      │
    │  │Mon 1│   │Mon 2│  │Lead │      │
    │  └─────┘   └─────┘  └─────┘      │
    │    │         │         │          │
    │    │         │         │          │
    │  Filter:   Filter:  Filter:      │
    │  status.*  error.*  task.*       │
    │                                   │
    └───────────────────────────────────┘
```

### 1.4 Deployment Topology

#### Single Datacenter Deployment
```
┌───────────────────────────────────────────────────────────────┐
│                      Datacenter (US-East)                      │
│                                                                │
│  ┌───────────────────────────────────────────────────────┐    │
│  │              Load Balancer (HAProxy)                  │    │
│  └────────────┬─────────────┬────────────────────────────┘    │
│               │             │                                  │
│  ┌────────────▼──────┐  ┌──▼─────────────────┐               │
│  │  RabbitMQ Node 1  │  │  RabbitMQ Node 2   │               │
│  │  (Active)         │  │  (Active)          │               │
│  │  Queue: tasks     │  │  Queue: results    │               │
│  └────────┬──────────┘  └──────────┬─────────┘               │
│           │                        │                          │
│           │    ┌───────────────────┘                          │
│           │    │                                              │
│  ┌────────▼────▼─────────────────────────────────────┐       │
│  │           Agent Cluster (Auto-Scaling)            │       │
│  │                                                    │       │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐          │       │
│  │  │Leader│  │Worker│  │Worker│  │Worker│  ...     │       │
│  │  └──────┘  └──────┘  └──────┘  └──────┘          │       │
│  │                                                    │       │
│  │  Auto-scale based on:                             │       │
│  │  • Queue depth                                    │       │
│  │  • CPU usage                                      │       │
│  │  • Message rate                                   │       │
│  └────────────────────────────────────────────────────┘       │
│                                                                │
│  ┌────────────────────────────────────────────────────┐       │
│  │           Monitoring & Logging                     │       │
│  │                                                    │       │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐       │       │
│  │  │Prometheus│  │  Grafana  │  │ ELK Stack│       │       │
│  │  └──────────┘  └───────────┘  └──────────┘       │       │
│  └────────────────────────────────────────────────────┘       │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

#### Multi-Datacenter Deployment
```
┌───────────────────────────────────────────────────────────────────────┐
│                      Global Architecture                               │
└───────────────────────────────────────────────────────────────────────┘

┌────────────────────────────┐         ┌────────────────────────────┐
│     Datacenter US-East     │         │     Datacenter EU-West     │
│                            │         │                            │
│  ┌──────────────────────┐  │         │  ┌──────────────────────┐  │
│  │   RabbitMQ Cluster   │  │         │  │   RabbitMQ Cluster   │  │
│  │   (3 nodes)          │  │◄───────►│  │   (3 nodes)          │  │
│  │                      │  │Federation│  │                      │  │
│  │   • tasks            │  │  Plugin  │  │   • tasks            │  │
│  │   • results          │  │         │  │   • results          │  │
│  └──────────┬───────────┘  │         │  └──────────┬───────────┘  │
│             │               │         │             │               │
│  ┌──────────▼───────────┐  │         │  ┌──────────▼───────────┐  │
│  │  Agent Cluster       │  │         │  │  Agent Cluster       │  │
│  │  (10-50 workers)     │  │         │  │  (10-50 workers)     │  │
│  └──────────────────────┘  │         │  └──────────────────────┘  │
│                            │         │                            │
└────────────────────────────┘         └────────────────────────────┘

                    ┌────────────────────────────┐
                    │   Datacenter Asia-Pacific  │
                    │                            │
                    │  ┌──────────────────────┐  │
                    │  │   RabbitMQ Cluster   │  │
                    │  │   (3 nodes)          │  │
                    │  │                      │  │
                    │  │   • tasks            │  │
                    │  │   • results          │  │
                    │  └──────────┬───────────┘  │
                    │             │               │
                    │  ┌──────────▼───────────┐  │
                    │  │  Agent Cluster       │  │
                    │  │  (10-50 workers)     │  │
                    │  └──────────────────────┘  │
                    │                            │
                    └────────────────────────────┘

Features:
• Geographic distribution for low latency
• Federation for cross-DC message routing
• Regional agent clusters
• Active-active configuration
• Disaster recovery capability
```

---

## 2. Design Decisions

### 2.1 Why RabbitMQ?

#### Decision Matrix
```
┌────────────────────────────────────────────────────────────────────┐
│              Message Queue Technology Comparison                    │
├────────────────┬────────────┬───────────┬────────────┬────────────┤
│   Feature      │  RabbitMQ  │   Kafka   │   Redis    │   AWS SQS  │
├────────────────┼────────────┼───────────┼────────────┼────────────┤
│ Message Pattern│   ✅✅✅    │    ✅✅    │     ✅     │     ✅✅   │
│ Flexibility    │   Excellent│   Good    │  Limited   │   Limited  │
│                │            │           │            │            │
│ Delivery       │   ✅✅✅    │    ✅✅    │     ✅     │     ✅✅   │
│ Guarantees     │   At-least-│  At-least-│   At-most- │  At-least- │
│                │   once     │   once    │   once     │   once     │
│                │            │           │            │            │
│ Ease of Setup  │   ✅✅      │    ✅     │    ✅✅✅   │    ✅✅✅   │
│                │   Docker   │  Complex  │   Simple   │   Managed  │
│                │            │           │            │            │
│ Protocol       │   ✅✅✅    │    ✅     │     ✅✅    │     ✅     │
│ Support        │   AMQP,    │   Custom  │   Custom   │   HTTP/SQS │
│                │   MQTT,    │           │            │            │
│                │   STOMP    │           │            │            │
│                │            │           │            │            │
│ Use Case Fit   │   ✅✅✅    │    ✅✅    │     ✅     │     ✅     │
│ (Task Queue)   │   Perfect  │   Overkill│   Good     │   Cloud-   │
│                │            │ (streaming│            │   only     │
│                │            │           │            │            │
│ Complexity     │   ✅✅✅    │    ✅     │    ✅✅✅   │    ✅✅    │
│                │   Medium   │   High    │   Low      │   Low      │
│                │            │           │            │            │
│ Cost           │   ✅✅✅    │    ✅✅    │    ✅✅✅   │     ✅     │
│                │   Free     │   Free    │   Free     │   Pay-per- │
│                │   (self-   │  (self-   │  (self-    │   use      │
│                │   hosted)  │  hosted)  │  hosted)   │            │
└────────────────┴────────────┴───────────┴────────────┴────────────┘

✅✅✅ = Excellent
✅✅   = Good
✅     = Acceptable
```

#### Why RabbitMQ Won

1. **Rich Routing Patterns**
   - Work queues for task distribution
   - Fanout exchanges for brainstorming
   - Topic exchanges for status updates
   - Direct exchanges for point-to-point

2. **Mature AMQP Protocol**
   - Industry standard
   - Excellent library support (amqplib)
   - Well-documented
   - Cross-platform compatibility

3. **Built-in Features**
   - Dead letter queues
   - Message TTL
   - Priority queues
   - Persistent messages
   - Publisher confirms

4. **Operational Maturity**
   - Battle-tested at scale
   - Comprehensive monitoring
   - Management UI
   - Plugin ecosystem

5. **Perfect for Task Queues**
   - Optimized for work distribution
   - Fair dispatch with prefetch
   - Acknowledgments and retries
   - Load balancing built-in

### 2.2 Message Patterns Chosen

#### Pattern Selection Decision Tree
```
                    Start: Need to send message
                              │
                              ▼
                    ┌───────────────────┐
                    │ Who should receive?│
                    └─────────┬──────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
       One worker        All agents         Specific subset
          │                   │                   │
          ▼                   ▼                   ▼
    ┌──────────┐      ┌─────────────┐    ┌──────────────┐
    │Work Queue│      │Fanout       │    │Topic         │
    │(Direct)  │      │Exchange     │    │Exchange      │
    └────┬─────┘      └──────┬──────┘    └──────┬───────┘
         │                   │                   │
         ▼                   ▼                   ▼
    Task Dist.         Brainstorm          Status Updates
    Load Balance       Broadcast           Selective Route
```

#### Patterns Implemented

**1. Work Queue Pattern (Task Distribution)**
```
Use Case: Distributing tasks to worker pool
Pattern: Direct Exchange + Work Queue

┌────────┐    publish     ┌────────┐    consume    ┌────────┐
│ Leader │───────────────►│  Queue │──────────────►│Worker 1│
└────────┘                └────────┘               └────────┘
                              │                    ┌────────┐
                              └───────────────────►│Worker 2│
                                                   └────────┘

Benefits:
• Load balancing (round-robin with prefetch)
• Exactly one worker processes each task
• Automatic retry on failure
• Scalable (add more workers)

Implementation:
await channel.assertQueue('agent.tasks', { durable: true });
await channel.sendToQueue('agent.tasks', Buffer.from(JSON.stringify(task)));
```

**2. Fanout Pattern (Broadcasting)**
```
Use Case: Brainstorming, announcements, system-wide events
Pattern: Fanout Exchange + Multiple Queues

┌────────┐   publish    ┌─────────┐   consume   ┌──────────┐
│Worker 1│─────────────►│ Fanout  │────────────►│Collab 1  │
└────────┘              │Exchange │             └──────────┘
                        └────┬────┘             ┌──────────┐
                             ├─────────────────►│Collab 2  │
                             │                  └──────────┘
                             │                  ┌──────────┐
                             └─────────────────►│Collab 3  │
                                                └──────────┘

Benefits:
• All subscribers receive message
• Decoupled producers and consumers
• Dynamic subscription (join/leave)
• Real-time collaboration

Implementation:
await channel.assertExchange('agent.brainstorm', 'fanout', { durable: true });
await channel.publish('agent.brainstorm', '', Buffer.from(JSON.stringify(msg)));
```

**3. Topic Pattern (Selective Routing)**
```
Use Case: Status updates, logging, filtered subscriptions
Pattern: Topic Exchange + Routing Keys

┌────────┐   publish    ┌─────────┐              ┌──────────┐
│Agent 1 │  status:     │ Topic   │  pattern:    │Monitor 1 │
│        │  task.start  │Exchange │  task.#      │          │
└────────┘─────────────►└────┬────┘─────────────►└──────────┘
┌────────┐              ┌────┴────┐              ┌──────────┐
│Agent 2 │  status:     │ Topic   │  pattern:    │Monitor 2 │
│        │  error.fatal │Exchange │  error.*     │          │
└────────┘─────────────►└─────────┘─────────────►└──────────┘

Benefits:
• Selective message routing
• Hierarchical routing keys
• Wildcard matching (* and #)
• Fine-grained subscriptions

Implementation:
await channel.assertExchange('agent.status', 'topic', { durable: true });
await channel.publish('agent.status', 'agent.status.task.started', msg);
await channel.bindQueue(queueName, 'agent.status', 'agent.status.#');
```

### 2.3 Queue vs Topic Design

#### Design Philosophy
```
┌────────────────────────────────────────────────────────────────┐
│              Queue vs Exchange Decision                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USE QUEUE WHEN:                                                │
│  ✅ Exactly one consumer should process message                 │
│  ✅ Load balancing is needed                                    │
│  ✅ Work distribution                                           │
│  ✅ Task processing                                             │
│  ✅ Job queue                                                   │
│                                                                 │
│  Examples:                                                      │
│  • agent.tasks (work distribution)                             │
│  • agent.results (result collection)                           │
│  • agent.tasks.retry (retry queue)                             │
│  • agent.tasks.dead (dead letter)                              │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USE EXCHANGE WHEN:                                             │
│  ✅ Multiple consumers should receive message                   │
│  ✅ Broadcasting is needed                                      │
│  ✅ Routing based on criteria                                   │
│  ✅ Pub/sub pattern                                             │
│  ✅ Event notifications                                         │
│                                                                 │
│  Examples:                                                      │
│  • agent.brainstorm (fanout - all agents)                      │
│  • agent.status (topic - filtered subscribers)                 │
│  • agent.events (topic - event routing)                        │
│  • agent.alerts (fanout - all monitors)                        │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Implementation Example
```javascript
class MessageRouter {
  async setupRouting() {
    // 1. Work Queue (no exchange needed, direct to queue)
    await this.channel.assertQueue('agent.tasks', {
      durable: true,
      deadLetterExchange: 'agent.tasks.dlx'
    });

    // 2. Fanout Exchange (broadcast to all)
    await this.channel.assertExchange('agent.brainstorm', 'fanout', {
      durable: true
    });

    // Create exclusive queue for each subscriber
    const { queue } = await this.channel.assertQueue('', {
      exclusive: true,
      autoDelete: true
    });
    await this.channel.bindQueue(queue, 'agent.brainstorm', '');

    // 3. Topic Exchange (selective routing)
    await this.channel.assertExchange('agent.status', 'topic', {
      durable: true
    });

    // Bind with pattern
    await this.channel.assertQueue('monitor.status', { durable: true });
    await this.channel.bindQueue('monitor.status', 'agent.status', 'agent.status.#');
  }

  // Send to work queue
  async assignTask(task) {
    await this.channel.sendToQueue('agent.tasks', Buffer.from(JSON.stringify(task)), {
      persistent: true
    });
  }

  // Broadcast to all
  async broadcastBrainstorm(message) {
    await this.channel.publish('agent.brainstorm', '', Buffer.from(JSON.stringify(message)));
  }

  // Selective routing
  async publishStatus(status, routingKey) {
    await this.channel.publish('agent.status', routingKey, Buffer.from(JSON.stringify(status)));
  }
}
```

### 2.4 State Management Approach

#### Stateless Agent Design
```
┌────────────────────────────────────────────────────────────────┐
│              Agent State Philosophy                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PRINCIPLE: Agents are stateless workers                        │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Local State (In Memory)                              │    │
│  │  • Current active tasks (transient)                   │    │
│  │  • Connection state (ephemeral)                       │    │
│  │  • Metrics counters (volatile)                        │    │  │
│  │                                                        │    │
│  │  Purpose: Operational state only                      │    │
│  │  Scope: Single agent process                          │    │
│  │  Lifetime: Agent lifetime                             │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Shared State (External)                              │    │
│  │  • Task queue (RabbitMQ)                              │    │
│  │  • Results (RabbitMQ)                                 │    │
│  │  • Distributed cache (Redis)                          │    │
│  │  • Persistent storage (Database)                      │    │
│  │                                                        │    │
│  │  Purpose: Durable, shared state                       │    │
│  │  Scope: All agents                                    │    │
│  │  Lifetime: System lifetime                            │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### State Management Strategies

**1. Task State (Message Queue)**
```
State: Task lifecycle (assigned → processing → complete/failed)
Storage: RabbitMQ queues and message headers

┌────────┐  assign   ┌─────────┐  consume   ┌─────────┐  complete  ┌────────┐
│Assigned│──────────►│ Pending │───────────►│Processing│───────────►│Complete│
└────────┘           └─────────┘            └─────────┘            └────────┘
                                                  │
                                                  │ fail
                                                  ▼
                                             ┌─────────┐
                                             │ Retry   │
                                             │  DLQ    │
                                             └─────────┘

Implementation:
• Task metadata in message body
• State transitions via queue routing
• Retry count in message headers
• Final state in results queue
```

**2. Agent State (Ephemeral)**
```
State: Agent health and activity
Storage: In-memory + periodic heartbeat

class AgentOrchestrator {
  constructor() {
    this.activeTasks = new Map();  // Current work
    this.stats = {                 // Counters
      tasksReceived: 0,
      tasksCompleted: 0,
      tasksFailed: 0
    };
  }

  // Broadcast health every 30s
  async heartbeat() {
    await this.client.publishStatus({
      agentId: this.agentId,
      state: 'alive',
      activeTasks: this.activeTasks.size,
      stats: this.stats,
      timestamp: Date.now()
    }, 'agent.status.heartbeat');
  }
}
```

**3. Distributed State (Redis)**
```
State: Shared data across agents
Storage: Redis with pub/sub

class DistributedCache {
  async set(key, value, ttl = 3600) {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
    await redis.publish('cache.invalidate', key);
  }

  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async subscribe(pattern, handler) {
    await redis.psubscribe(`cache.${pattern}`, (channel, message) => {
      handler(message);
    });
  }
}

// Usage
const cache = new DistributedCache();

// Worker 1 caches result
await cache.set('task:123:result', result);

// Worker 2 reads cached result
const result = await cache.get('task:123:result');
```

**4. Persistent State (Database)**
```
State: Long-term audit trail and analytics
Storage: PostgreSQL or MongoDB

Schema:
tasks:
  - id (UUID)
  - title (String)
  - description (String)
  - assigned_by (String)
  - assigned_to (String)
  - status (Enum: assigned, processing, complete, failed)
  - created_at (Timestamp)
  - updated_at (Timestamp)
  - completed_at (Timestamp)
  - metadata (JSONB)

results:
  - id (UUID)
  - task_id (UUID, FK)
  - agent_id (String)
  - status (String)
  - output (JSONB)
  - duration (Integer)
  - created_at (Timestamp)

Usage:
• Audit trail
• Analytics and reporting
• Historical queries
• Compliance
```

---

## 3. Scalability Architecture

### 3.1 Horizontal Scaling

#### Scale-Out Strategy
```
┌────────────────────────────────────────────────────────────────┐
│                   Horizontal Scaling Model                      │
└────────────────────────────────────────────────────────────────┘

  Low Load (1-10 tasks/min)
  ┌─────────────────────┐
  │    RabbitMQ         │
  └──────────┬──────────┘
             │
     ┌───────┴───────┐
  ┌──▼──┐        ┌───▼──┐
  │Lead │        │Worker│
  └─────┘        └──────┘

  ─────────────────────────────────────

  Medium Load (10-100 tasks/min)
  ┌─────────────────────┐
  │    RabbitMQ         │
  └──────────┬──────────┘
             │
     ┌───────┼───────────────────┐
  ┌──▼──┐ ┌──▼──┐ ┌───▼──┐ ┌────▼───┐
  │Lead │ │Work1│ │Work2 │ │ Work3  │
  └─────┘ └─────┘ └──────┘ └────────┘

  ─────────────────────────────────────

  High Load (100-1000 tasks/min)
  ┌─────────────────────┐
  │  RabbitMQ Cluster   │
  │  (3 nodes)          │
  └──────────┬──────────┘
             │
     ┌───────┼───────────────────────────────┐
  ┌──▼──┐ ┌──▼──┐ ┌───▼──┐ ┌────▼───┐ ┌────▼───┐
  │Lead │ │Work1│ │Work2 │ │ Work3  │ │ Work4  │ ...
  └─────┘ └─────┘ └──────┘ └────────┘ └────────┘
                  (Auto-scaled 5-50 workers)

  ─────────────────────────────────────

  Very High Load (1000+ tasks/min)
  ┌─────────────────────┐
  │  RabbitMQ Cluster   │
  │  (5+ nodes)         │
  │  Sharded queues     │
  └──────────┬──────────┘
             │
     ┌───────┴────────────────────────────────────┐
     │                                            │
  ┌──▼───────────────┐                 ┌─────────▼────────┐
  │  Worker Pool 1   │                 │  Worker Pool 2   │
  │  (tasks.shard1)  │                 │  (tasks.shard2)  │
  │                  │                 │                  │
  │  20-100 workers  │                 │  20-100 workers  │
  └──────────────────┘                 └──────────────────┘
```

#### Auto-Scaling Configuration
```javascript
class AutoScaler {
  constructor(config) {
    this.config = {
      minWorkers: config.minWorkers || 2,
      maxWorkers: config.maxWorkers || 50,
      scaleUpThreshold: {
        queueDepth: 100,
        avgWaitTime: 30000,  // 30 seconds
        cpuUsage: 80
      },
      scaleDownThreshold: {
        queueDepth: 10,
        idleTime: 300000,  // 5 minutes
        cpuUsage: 20
      },
      checkInterval: 60000,  // 1 minute
      cooldownPeriod: 120000  // 2 minutes between actions
    };

    this.lastScaleAction = 0;
  }

  async evaluate() {
    const now = Date.now();
    if (now - this.lastScaleAction < this.config.cooldownPeriod) {
      return;  // In cooldown period
    }

    const metrics = await this.collectMetrics();
    const currentWorkers = await this.getCurrentWorkerCount();

    if (this.shouldScaleUp(metrics, currentWorkers)) {
      await this.scaleUp(currentWorkers);
      this.lastScaleAction = now;
    } else if (this.shouldScaleDown(metrics, currentWorkers)) {
      await this.scaleDown(currentWorkers);
      this.lastScaleAction = now;
    }
  }

  shouldScaleUp(metrics, currentWorkers) {
    if (currentWorkers >= this.config.maxWorkers) {
      return false;
    }

    return (
      metrics.queueDepth > this.config.scaleUpThreshold.queueDepth ||
      metrics.avgWaitTime > this.config.scaleUpThreshold.avgWaitTime ||
      metrics.avgCpuUsage > this.config.scaleUpThreshold.cpuUsage
    );
  }

  shouldScaleDown(metrics, currentWorkers) {
    if (currentWorkers <= this.config.minWorkers) {
      return false;
    }

    return (
      metrics.queueDepth < this.config.scaleDownThreshold.queueDepth &&
      metrics.idleTime > this.config.scaleDownThreshold.idleTime &&
      metrics.avgCpuUsage < this.config.scaleDownThreshold.cpuUsage
    );
  }

  async scaleUp(currentWorkers) {
    // Add 50% more workers or at least 1
    const toAdd = Math.max(1, Math.ceil(currentWorkers * 0.5));
    const newCount = Math.min(currentWorkers + toAdd, this.config.maxWorkers);

    console.log(`Scaling up: ${currentWorkers} → ${newCount} workers`);

    for (let i = 0; i < toAdd; i++) {
      await this.startWorker();
    }
  }

  async scaleDown(currentWorkers) {
    // Remove 25% of workers or at least 1
    const toRemove = Math.max(1, Math.ceil(currentWorkers * 0.25));
    const newCount = Math.max(currentWorkers - toRemove, this.config.minWorkers);

    console.log(`Scaling down: ${currentWorkers} → ${newCount} workers`);

    for (let i = 0; i < toRemove; i++) {
      await this.stopWorker();
    }
  }

  async startWorker() {
    // Implementation depends on orchestration platform
    // Docker Swarm:
    // await exec('docker service scale worker=+1');

    // Kubernetes:
    // await exec('kubectl scale deployment worker --replicas=+1');

    // AWS ECS:
    // await ecs.updateService({ desiredCount: currentCount + 1 });
  }
}
```

### 3.2 Load Balancing

#### RabbitMQ Built-in Load Balancing
```
┌────────────────────────────────────────────────────────────────┐
│              Work Queue Load Balancing                          │
│                                                                 │
│  RabbitMQ automatically distributes messages using:            │
│  • Round-robin dispatch                                        │
│  • Prefetch count (QoS)                                        │
│  • Fair dispatch                                               │
│                                                                 │
│  ┌─────────────┐                                               │
│  │agent.tasks  │                                               │
│  │             │                                               │
│  │ [Task 1]───┼───┐                                            │
│  │ [Task 2]───┼───┼───┐                                        │
│  │ [Task 3]───┼───┼───┼───┐                                    │
│  │ [Task 4]───┼───┼───┼───┼───┐                                │
│  │ [Task 5]───┼───┼───┼───┼───┼───┐                            │
│  └─────────────┘   │   │   │   │   │                          │
│                    │   │   │   │   │                          │
│           ┌────────┘   │   │   │   └────────┐                 │
│           │   ┌────────┘   │   └────────┐   │                 │
│           │   │   ┌────────┘            │   │                 │
│           │   │   │                     │   │                 │
│        ┌──▼───▼┐ ┌▼───────┐         ┌──▼───▼┐                 │
│        │Worker1│ │Worker2 │         │Worker3│                 │
│        │Prefetch│ │Prefetch│         │Prefetch│                 │
│        │ = 2   │ │ = 2    │         │ = 2   │                 │
│        └───────┘ └────────┘         └───────┘                 │
│                                                                 │
│  Each worker gets messages up to prefetch limit                │
│  Fast workers get more work automatically                      │
└────────────────────────────────────────────────────────────────┘
```

#### Priority-Based Routing
```javascript
class PriorityRouter {
  async setup() {
    // Create priority queues
    await this.channel.assertQueue('agent.tasks.critical', {
      durable: true,
      arguments: { 'x-max-priority': 10 }
    });

    await this.channel.assertQueue('agent.tasks.high', {
      durable: true,
      arguments: { 'x-max-priority': 10 }
    });

    await this.channel.assertQueue('agent.tasks.normal', {
      durable: true,
      arguments: { 'x-max-priority': 10 }
    });

    await this.channel.assertQueue('agent.tasks.low', {
      durable: true,
      arguments: { 'x-max-priority': 10 }
    });
  }

  async publishTask(task) {
    const queueName = this.getQueueByPriority(task.priority);
    const priority = this.getPriorityValue(task.priority);

    await this.channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(task)),
      {
        persistent: true,
        priority: priority
      }
    );
  }

  getQueueByPriority(priority) {
    const map = {
      'critical': 'agent.tasks.critical',
      'high': 'agent.tasks.high',
      'normal': 'agent.tasks.normal',
      'low': 'agent.tasks.low'
    };
    return map[priority] || 'agent.tasks.normal';
  }

  getPriorityValue(priority) {
    const map = {
      'critical': 10,
      'high': 7,
      'normal': 5,
      'low': 2
    };
    return map[priority] || 5;
  }

  async startWorker() {
    // Consume from all queues with priority
    await this.consumeInPriorityOrder([
      'agent.tasks.critical',
      'agent.tasks.high',
      'agent.tasks.normal',
      'agent.tasks.low'
    ]);
  }

  async consumeInPriorityOrder(queues) {
    // Workers check high-priority queues first
    for (const queue of queues) {
      await this.channel.consume(queue, async (msg) => {
        if (!msg) return;
        await this.handleTask(msg);
      }, { noAck: false });
    }
  }
}
```

### 3.3 Failover Strategies

#### RabbitMQ Cluster Failover
```
┌────────────────────────────────────────────────────────────────┐
│                    Cluster Failover                             │
│                                                                 │
│  Normal Operation:                                              │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                  │
│  │ Node 1  │────│ Node 2  │────│ Node 3  │                  │
│  │(Master) │     │(Mirror) │     │(Mirror) │                  │
│  │  Queue  │ ◄───│  Queue  │ ◄───│  Queue  │                  │
│  └────┬────┘     └─────────┘     └─────────┘                  │
│       │                                                         │
│       └────► Workers connected here                            │
│                                                                 │
│  ──────────────────────────────────────────────────────────    │
│                                                                 │
│  Node 1 Fails:                                                  │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                  │
│  │ Node 1  │     │ Node 2  │────│ Node 3  │                  │
│  │  XXXX   │     │(New     │     │(Mirror) │                  │
│  │         │     │Master)  │     │         │                  │
│  └─────────┘     └────┬────┘     └─────────┘                  │
│                       │                                         │
│                       └────► Workers auto-reconnect here       │
│                                                                 │
│  Features:                                                      │
│  • Automatic failover (seconds)                                │
│  • No message loss (mirrored queues)                           │
│  • Client auto-reconnect                                       │
│  • Quorum-based consistency                                    │
└────────────────────────────────────────────────────────────────┘
```

#### Client-Side Failover
```javascript
class FailoverClient extends RabbitMQClient {
  constructor(config) {
    super(config);

    // Multiple broker URLs for failover
    this.brokerUrls = [
      'amqp://rabbitmq1.example.com:5672',
      'amqp://rabbitmq2.example.com:5672',
      'amqp://rabbitmq3.example.com:5672'
    ];

    this.currentBrokerIndex = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;
  }

  async connect() {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      const url = this.brokerUrls[this.currentBrokerIndex];

      try {
        console.log(`Connecting to ${url}...`);
        this.connection = await amqp.connect(url, {
          heartbeat: 30,
          connectionTimeout: 10000
        });

        this.setupConnectionHandlers();
        this.channel = await this.connection.createChannel();
        this.isConnected = true;
        this.reconnectAttempts = 0;

        console.log(`Connected to ${url}`);
        return this;

      } catch (error) {
        console.error(`Failed to connect to ${url}:`, error.message);

        // Try next broker
        this.currentBrokerIndex = (this.currentBrokerIndex + 1) % this.brokerUrls.length;
        this.reconnectAttempts++;

        // Wait before retry
        await this.sleep(Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
      }
    }

    throw new Error('Failed to connect to any broker');
  }

  setupConnectionHandlers() {
    this.connection.on('error', async (err) => {
      console.error('Connection error:', err);
      this.isConnected = false;
    });

    this.connection.on('close', async () => {
      console.log('Connection closed');
      this.isConnected = false;

      if (this.config.autoReconnect) {
        await this.connect();  // Try to reconnect
      }
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3.4 Multi-Datacenter

#### Federated RabbitMQ Architecture
```
┌────────────────────────────────────────────────────────────────┐
│              Multi-Datacenter Federation                        │
└────────────────────────────────────────────────────────────────┘

Datacenter US-East                   Datacenter EU-West
┌─────────────────────┐              ┌─────────────────────┐
│  RabbitMQ Cluster   │              │  RabbitMQ Cluster   │
│                     │              │                     │
│  ┌───────────────┐  │   Federated  │  ┌───────────────┐  │
│  │agent.tasks.us │  │◄────Links───►│  │agent.tasks.eu │  │
│  └───────────────┘  │              │  └───────────────┘  │
│                     │              │                     │
│  ┌───────────────┐  │              │  ┌───────────────┐  │
│  │ Local Workers │  │              │  │ Local Workers │  │
│  │ (10 workers)  │  │              │  │ (10 workers)  │  │
│  └───────────────┘  │              │  └───────────────┘  │
└─────────────────────┘              └─────────────────────┘
         │                                      │
         │                                      │
    ┌────▼────┐                            ┌───▼─────┐
    │ Users   │                            │  Users  │
    │ (US)    │                            │  (EU)   │
    └─────────┘                            └─────────┘

Benefits:
• Geographic distribution
• Low latency (local processing)
• Disaster recovery
• Compliance (data residency)

Configuration:
rabbitmqctl set_parameter federation-upstream upstream-eu \
  '{"uri":"amqp://eu-rabbitmq.example.com","expires":3600000}'

rabbitmqctl set_policy federate-tasks "^agent.tasks" \
  '{"federation-upstream-set":"all"}'
```

#### Geo-Routing Strategy
```javascript
class GeoRouter {
  constructor() {
    this.regions = {
      'us-east': 'amqp://us-east-rabbitmq.example.com',
      'us-west': 'amqp://us-west-rabbitmq.example.com',
      'eu-west': 'amqp://eu-west-rabbitmq.example.com',
      'ap-southeast': 'amqp://ap-southeast-rabbitmq.example.com'
    };
  }

  async publishTask(task) {
    // Determine target region
    const region = this.determineRegion(task);

    // Connect to regional broker
    const client = await this.getRegionalClient(region);

    // Publish to regional queue
    await client.publishTask(task, `agent.tasks.${region}`);
  }

  determineRegion(task) {
    // Option 1: Explicit region in task
    if (task.region) {
      return task.region;
    }

    // Option 2: User location
    if (task.userId) {
      return this.getUserRegion(task.userId);
    }

    // Option 3: Data location
    if (task.dataLocation) {
      return this.getNearestRegion(task.dataLocation);
    }

    // Default: Use current region
    return process.env.AWS_REGION || 'us-east';
  }

  async getRegionalClient(region) {
    // Lazy-create clients
    if (!this.clients[region]) {
      this.clients[region] = new RabbitMQClient({
        url: this.regions[region]
      });
      await this.clients[region].connect();
    }

    return this.clients[region];
  }

  getUserRegion(userId) {
    // Look up user's preferred or closest region
    // In practice, query from database or cache
    return 'us-east';
  }

  getNearestRegion(dataLocation) {
    // Calculate nearest region based on data location
    // In practice, use geolocation service
    return 'us-east';
  }
}
```

---

## 4. Integration Patterns

### 4.1 Git Worktree Integration

#### Architecture
```
┌────────────────────────────────────────────────────────────────┐
│             Git Worktree Multi-Agent Setup                      │
└────────────────────────────────────────────────────────────────┘

File System:
~/my-project/                       (Main repository)
  ├── .git/
  ├── src/
  └── ...

../my-project-worker1/              (Worktree 1)
  ├── .git  (linked to main)
  ├── src/
  └── ...

../my-project-worker2/              (Worktree 2)
  ├── .git  (linked to main)
  ├── src/
  └── ...

Agents:
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Terminal 1  │      │ Terminal 2  │      │ Terminal 3  │
│             │      │             │      │             │
│ Team Leader │      │   Worker 1  │      │   Worker 2  │
│             │      │             │      │             │
│ ~/my-project│      │ worker1 dir │      │ worker2 dir │
│             │      │             │      │             │
│ • Assigns   │      │ • Executes  │      │ • Executes  │
│ • Monitors  │      │ • Commits   │      │ • Commits   │
│ • Merges    │      │ • Pushes    │      │ • Pushes    │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   RabbitMQ      │
                   │   (Central      │
                   │   Coordination) │
                   └─────────────────┘

Benefits:
• Independent working directories
• No file conflicts
• Parallel development
• Easy cleanup
```

#### Implementation
```bash
#!/bin/bash
# setup-multi-agent-worktree.sh

MAIN_REPO="~/my-project"
NUM_WORKERS=3

echo "Setting up multi-agent git worktree environment..."

# 1. Create main repository if needed
if [ ! -d "$MAIN_REPO" ]; then
  git clone <repository-url> "$MAIN_REPO"
fi

cd "$MAIN_REPO"

# 2. Create worktrees for workers
for i in $(seq 1 $NUM_WORKERS); do
  WORKTREE_DIR="../my-project-worker$i"
  BRANCH="feature/agent-$i-$(date +%s)"

  if [ ! -d "$WORKTREE_DIR" ]; then
    echo "Creating worktree $i..."
    git worktree add "$WORKTREE_DIR" -b "$BRANCH"
  fi
done

# 3. Start RabbitMQ if not running
if ! docker ps | grep -q rabbitmq; then
  echo "Starting RabbitMQ..."
  docker run -d --name rabbitmq \
    -p 5672:5672 \
    -p 15672:15672 \
    rabbitmq:3-management
fi

# 4. Start agents in tmux/screen
echo "Starting agents..."

# Terminal 1: Team Leader
tmux new-session -d -s agents -n leader \
  "cd $MAIN_REPO && node scripts/orchestrator.js team-leader"

# Terminal 2-4: Workers
for i in $(seq 1 $NUM_WORKERS); do
  WORKTREE_DIR="../my-project-worker$i"
  tmux new-window -t agents -n "worker$i" \
    "cd $WORKTREE_DIR && AGENT_ID=worker-$i node scripts/orchestrator.js worker"
done

echo "Multi-agent environment ready!"
echo "Attach with: tmux attach -t agents"
```

#### Workflow Integration
```javascript
class GitWorktreeAgent extends AgentOrchestrator {
  async handleTask(msg, { ack, nack, reject }) {
    const { id, task } = msg;

    try {
      // 1. Ensure clean working directory
      await this.ensureCleanWorkingDir();

      // 2. Pull latest changes
      await this.exec('git pull origin main');

      // 3. Create feature branch
      const branchName = `feature/task-${id}`;
      await this.exec(`git checkout -b ${branchName}`);

      // 4. Execute task (code changes)
      await this.executeTask(task);

      // 5. Commit changes
      await this.exec('git add .');
      await this.exec(`git commit -m "Task ${id}: ${task.title}"`);

      // 6. Push branch
      await this.exec(`git push origin ${branchName}`);

      // 7. Create pull request
      const prUrl = await this.createPullRequest({
        title: task.title,
        branch: branchName,
        description: task.description
      });

      // 8. Publish result
      await this.publishResult({
        taskId: id,
        status: 'completed',
        prUrl: prUrl,
        branch: branchName
      });

      ack();

    } catch (error) {
      console.error('Task failed:', error);
      nack(false);
    }
  }

  async ensureCleanWorkingDir() {
    const status = await this.exec('git status --porcelain');
    if (status.trim()) {
      throw new Error('Working directory not clean');
    }
  }

  async exec(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
  }

  async createPullRequest({ title, branch, description }) {
    // Use GitHub CLI
    const result = await this.exec(
      `gh pr create --title "${title}" --body "${description}" --base main --head ${branch}`
    );
    return result.trim();
  }
}
```

### 4.2 CI/CD Integration

#### Pipeline Architecture
```
┌────────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                               │
└────────────────────────────────────────────────────────────────┘

   Code Push
       │
       ▼
   ┌────────────┐
   │  Git Repo  │
   └──────┬─────┘
          │
          │ webhook
          ▼
   ┌────────────┐
   │   CI/CD    │
   │  (GitHub   │
   │   Actions) │
   └──────┬─────┘
          │
          ├─────► 1. Run Tests
          │
          ├─────► 2. Build Docker Image
          │
          ├─────► 3. Push to Registry
          │
          └─────► 4. Assign Deployment Task
                  │
                  ▼
           ┌──────────────┐
           │  RabbitMQ    │
           │agent.tasks.  │
           │  deploy      │
           └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │Deploy Agent  │
           │              │
           │ • Pull image │
           │ • Update     │
           │ • Health chk │
           │ • Report     │
           └──────────────┘
```

#### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy via RabbitMQ

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Run Tests
        run: npm test

      - name: Build Docker Image
        run: |
          docker build -t my-app:${{ github.sha }} .
          docker tag my-app:${{ github.sha }} my-app:latest

      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push my-app:${{ github.sha }}
          docker push my-app:latest

      - name: Assign Deployment Task
        run: |
          npm install amqplib
          node - <<'EOF'
          const amqp = require('amqplib');

          async function assignDeployTask() {
            const connection = await amqp.connect(process.env.RABBITMQ_URL);
            const channel = await connection.createChannel();

            const task = {
              type: 'deploy',
              image: 'my-app:${{ github.sha }}',
              environment: 'production',
              timestamp: Date.now()
            };

            await channel.assertQueue('agent.tasks.deploy', { durable: true });
            channel.sendToQueue(
              'agent.tasks.deploy',
              Buffer.from(JSON.stringify(task)),
              { persistent: true }
            );

            console.log('Deployment task assigned');

            await channel.close();
            await connection.close();
          }

          assignDeployTask().catch(console.error);
          EOF
        env:
          RABBITMQ_URL: ${{ secrets.RABBITMQ_URL }}

      - name: Wait for Deployment Result
        run: |
          node - <<'EOF'
          const amqp = require('amqplib');

          async function waitForDeployment() {
            const connection = await amqp.connect(process.env.RABBITMQ_URL);
            const channel = await connection.createChannel();

            await channel.assertQueue('agent.results.deploy', { durable: true });

            return new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Deployment timeout'));
              }, 600000);  // 10 minutes

              channel.consume('agent.results.deploy', (msg) => {
                if (!msg) return;

                const result = JSON.parse(msg.content.toString());

                if (result.status === 'success') {
                  clearTimeout(timeout);
                  console.log('Deployment successful!');
                  channel.ack(msg);
                  resolve();
                } else {
                  clearTimeout(timeout);
                  console.error('Deployment failed:', result.error);
                  channel.ack(msg);
                  reject(new Error(result.error));
                }
              });
            });
          }

          waitForDeployment()
            .then(() => process.exit(0))
            .catch((error) => {
              console.error(error);
              process.exit(1);
            });
          EOF
        env:
          RABBITMQ_URL: ${{ secrets.RABBITMQ_URL }}
```

### 4.3 External Systems Integration

#### Webhook Integration
```javascript
class WebhookIntegration {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    // GitHub webhook
    this.app.post('/webhooks/github', async (req, res) => {
      const event = req.headers['x-github-event'];
      const payload = req.body;

      switch (event) {
        case 'pull_request':
          await this.handlePullRequest(payload);
          break;
        case 'push':
          await this.handlePush(payload);
          break;
        case 'issues':
          await this.handleIssue(payload);
          break;
      }

      res.status(200).send('OK');
    });

    // Slack webhook
    this.app.post('/webhooks/slack', async (req, res) => {
      const payload = req.body;

      if (payload.type === 'url_verification') {
        res.json({ challenge: payload.challenge });
        return;
      }

      await this.handleSlackCommand(payload);
      res.status(200).send('OK');
    });

    // Generic webhook
    this.app.post('/webhooks/:source', async (req, res) => {
      const source = req.params.source;
      const payload = req.body;

      await this.handleGenericWebhook(source, payload);
      res.status(200).send('OK');
    });
  }

  async handlePullRequest(payload) {
    const action = payload.action;
    const pr = payload.pull_request;

    if (action === 'opened' || action === 'synchronize') {
      // Assign code review task
      await this.orchestrator.assignTask({
        type: 'code-review',
        title: `Review PR #${pr.number}: ${pr.title}`,
        description: pr.body,
        pr_url: pr.html_url,
        pr_number: pr.number,
        author: pr.user.login,
        priority: 'high'
      });
    }
  }

  async handlePush(payload) {
    const branch = payload.ref.split('/').pop();
    const commits = payload.commits;

    if (branch === 'main') {
      // Assign deployment task
      await this.orchestrator.assignTask({
        type: 'deploy',
        title: `Deploy ${commits.length} commits to production`,
        description: commits.map(c => c.message).join('\n'),
        sha: payload.after,
        priority: 'critical'
      });
    }
  }

  async handleIssue(payload) {
    const action = payload.action;
    const issue = payload.issue;

    if (action === 'opened') {
      // Assign investigation task
      await this.orchestrator.assignTask({
        type: 'investigate-issue',
        title: `Investigate issue #${issue.number}: ${issue.title}`,
        description: issue.body,
        issue_url: issue.html_url,
        labels: issue.labels.map(l => l.name),
        priority: issue.labels.some(l => l.name === 'bug') ? 'high' : 'normal'
      });
    }
  }

  async handleSlackCommand(payload) {
    const command = payload.command;
    const text = payload.text;

    switch (command) {
      case '/deploy':
        await this.orchestrator.assignTask({
          type: 'deploy',
          title: `Deploy ${text}`,
          priority: 'high',
          requested_by: payload.user_name
        });
        break;

      case '/review':
        await this.orchestrator.assignTask({
          type: 'code-review',
          title: `Review ${text}`,
          priority: 'normal',
          requested_by: payload.user_name
        });
        break;
    }
  }

  async handleGenericWebhook(source, payload) {
    // Generic task creation
    await this.orchestrator.assignTask({
      type: 'webhook-task',
      title: `Task from ${source}`,
      description: JSON.stringify(payload, null, 2),
      source: source,
      priority: 'normal'
    });
  }

  start(port = 3000) {
    this.app.listen(port, () => {
      console.log(`Webhook server listening on port ${port}`);
    });
  }
}

// Usage
const webhooks = new WebhookIntegration(orchestrator);
webhooks.start(3000);
```

### 4.4 API Integration

#### REST API Gateway
```javascript
class APIGateway {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(cors());
    this.app.use(this.authMiddleware.bind(this));
  }

  setupRoutes() {
    // Task management
    this.app.post('/api/tasks', this.createTask.bind(this));
    this.app.get('/api/tasks/:id', this.getTask.bind(this));
    this.app.get('/api/tasks', this.listTasks.bind(this));
    this.app.delete('/api/tasks/:id', this.cancelTask.bind(this));

    // Agents
    this.app.get('/api/agents', this.listAgents.bind(this));
    this.app.get('/api/agents/:id', this.getAgent.bind(this));

    // Metrics
    this.app.get('/api/metrics', this.getMetrics.bind(this));

    // Health
    this.app.get('/health', this.health.bind(this));
  }

  async authMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || !this.validateApiKey(apiKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  }

  async createTask(req, res) {
    try {
      const taskId = await this.orchestrator.assignTask(req.body);

      res.status(201).json({
        id: taskId,
        status: 'assigned',
        createdAt: Date.now()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getTask(req, res) {
    const taskId = req.params.id;
    const task = await this.orchestrator.getTaskStatus(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  }

  async listTasks(req, res) {
    const { status, priority, limit = 100, offset = 0 } = req.query;

    const tasks = await this.orchestrator.listTasks({
      status,
      priority,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      tasks,
      total: tasks.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  }

  async cancelTask(req, res) {
    const taskId = req.params.id;

    try {
      await this.orchestrator.cancelTask(taskId);
      res.json({ status: 'cancelled' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async listAgents(req, res) {
    const agents = await this.orchestrator.listAgents();
    res.json({ agents });
  }

  async getAgent(req, res) {
    const agentId = req.params.id;
    const agent = await this.orchestrator.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(agent);
  }

  async getMetrics(req, res) {
    const metrics = await this.orchestrator.getMetrics();
    res.json(metrics);
  }

  async health(req, res) {
    const health = {
      status: 'healthy',
      rabbitmq: await this.orchestrator.client.isHealthy(),
      agents: await this.orchestrator.getActiveAgentCount(),
      timestamp: Date.now()
    };

    const statusCode = health.rabbitmq ? 200 : 503;
    res.status(statusCode).json(health);
  }

  start(port = 8080) {
    this.app.listen(port, () => {
      console.log(`API Gateway listening on port ${port}`);
    });
  }
}

// Usage
const api = new APIGateway(orchestrator);
api.start(8080);
```

---

## Summary

This architecture provides:

1. **Scalability**: Horizontal scaling of agents, load balancing, auto-scaling
2. **Reliability**: Failover, retries, dead letter queues, circuit breakers
3. **Flexibility**: Multiple message patterns, priority queues, routing
4. **Integration**: Git worktree, CI/CD, webhooks, REST API
5. **Observability**: Monitoring, metrics, health checks, logging

The system is designed to be:
- **Production-ready**: Durable queues, persistent messages, monitoring
- **Cloud-native**: Containerized, auto-scaling, distributed
- **Developer-friendly**: Clear patterns, comprehensive examples, extensible

---

**References**:
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [AMQP Protocol](https://www.amqp.org/)
- [amqplib (Node.js)](https://github.com/amqp-node/amqplib)
- [Best Practices Guide](./BEST-PRACTICES.md)
