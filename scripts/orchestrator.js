#!/usr/bin/env node
/**
 * Agent Orchestrator - Coordinates multi-agent tasks
 * Handles task distribution, brainstorming, and result aggregation
 */

import { RabbitMQClient } from './rabbitmq-client.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

class AgentOrchestrator {
  constructor(agentType = 'worker') {
    this.agentType = agentType;
    this.agentId = process.env.AGENT_ID || `agent-${uuidv4()}`;
    this.agentName = process.env.AGENT_NAME || `Agent-${this.agentType}`;
    this.client = null;

    this.activeTasks = new Map();
    this.brainstormSessions = new Map();
    this.results = new Map();

    this.stats = {
      tasksReceived: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      brainstormsParticipated: 0,
      resultsPublished: 0
    };
  }

  /**
   * Initialize orchestrator
   */
  async initialize() {
    console.log(`\n🚀 Initializing ${this.agentType} orchestrator...`);
    console.log(`Agent ID: ${this.agentId}`);
    console.log(`Agent Name: ${this.agentName}\n`);

    this.client = new RabbitMQClient({
      agentId: this.agentId
    });

    // Setup event listeners
    this.client.on('connected', () => {
      console.log('✅ Agent connected to orchestration system');
      this.publishStatus({ event: 'connected', agentType: this.agentType }, 'agent.status.connected');
    });

    this.client.on('disconnected', () => {
      console.log('⚠️  Agent disconnected from orchestration system');
      this.publishStatus({ event: 'disconnected', agentType: this.agentType }, 'agent.status.disconnected');
    });

    this.client.on('error', (error) => {
      console.error('❌ Client error:', error);
    });

    await this.client.connect();
    await this.setupQueuesAndExchanges();

    return this;
  }

  /**
   * Setup all queues and exchanges
   */
  async setupQueuesAndExchanges() {
    console.log('📋 Setting up queues and exchanges...\n');

    // Task queue
    await this.client.setupTaskQueue();

    // Brainstorm exchange
    const brainstorm = await this.client.setupBrainstormExchange();
    this.brainstormQueue = brainstorm.queueName;

    // Result queue
    await this.client.setupResultQueue();

    // Status exchange
    await this.client.setupStatusExchange();

    console.log('✅ All queues and exchanges ready\n');
  }

  /**
   * Start as Team Leader
   */
  async startTeamLeader() {
    console.log('👔 Starting as TEAM LEADER...\n');

    // Team leader listens for results and coordinates
    await this.client.consumeResults('agent.results', async (msg) => {
      await this.handleResult(msg);
    });

    // Subscribe to all status updates
    await this.client.subscribeStatus('agent.status.#', 'agent.status', async (msg) => {
      await this.handleStatusUpdate(msg);
    });

    console.log('👔 Team Leader ready - waiting for results and status updates\n');
  }

  /**
   * Start as Worker
   */
  async startWorker() {
    console.log('⚙️  Starting as WORKER...\n');

    // Workers consume tasks
    await this.client.consumeTasks('agent.tasks', async (msg, { ack, nack, reject }) => {
      await this.handleTask(msg, { ack, nack, reject });
    });

    // Workers can participate in brainstorms
    await this.client.listenBrainstorm(this.brainstormQueue, async (msg) => {
      await this.handleBrainstormMessage(msg);
    });

    console.log('⚙️  Worker ready - waiting for tasks\n');
  }

  /**
   * Start as Collaborator
   */
  async startCollaborator() {
    console.log('🤝 Starting as COLLABORATOR...\n');

    // Collaborators listen to brainstorms
    await this.client.listenBrainstorm(this.brainstormQueue, async (msg) => {
      await this.handleBrainstormMessage(msg);
    });

    // Can also handle tasks
    await this.client.consumeTasks('agent.tasks', async (msg, { ack, nack, reject }) => {
      await this.handleTask(msg, { ack, nack, reject });
    });

    console.log('🤝 Collaborator ready - waiting for brainstorm sessions\n');
  }

  /**
   * Start as Coordinator
   */
  async startCoordinator() {
    console.log('🎯 Starting as COORDINATOR...\n');

    // Coordinators manage workflows - listen for results
    await this.client.consumeResults('agent.results', async (msg) => {
      await this.handleResult(msg);
    });

    // Subscribe to all status updates for agent coordination
    await this.client.subscribeStatus('agent.status.#', 'agent.status', async (msg) => {
      await this.handleStatusUpdate(msg);
    });

    // Can also handle tasks for workflow execution
    await this.client.consumeTasks('agent.tasks', async (msg, { ack, nack, reject }) => {
      await this.handleTask(msg, { ack, nack, reject });
    });

    console.log('🎯 Coordinator ready - managing workflows and dependencies\n');
  }

  /**
   * Start as Monitor
   */
  async startMonitor() {
    console.log('📊 Starting as MONITOR...\n');

    // Monitors subscribe to all status updates
    await this.client.subscribeStatus('agent.status.#', 'agent.status', async (msg) => {
      await this.handleStatusUpdate(msg);
    });

    // Monitor results for performance tracking
    await this.client.consumeResults('agent.results', async (msg) => {
      await this.handleResult(msg);
    });

    console.log('📊 Monitor ready - tracking system health and performance\n');
  }

  /**
   * Assign task (Team Leader function)
   */
  async assignTask(task) {
    console.log(`📋 Assigning task: ${task.title}`);

    const taskId = await this.client.publishTask({
      title: task.title,
      description: task.description,
      priority: task.priority || 'normal',
      assignedBy: this.agentId,
      assignedAt: Date.now(),
      context: task.context || {}
    });

    await this.publishStatus({
      event: 'task_assigned',
      taskId,
      task: task.title
    }, 'agent.status.task.assigned');

    return taskId;
  }

  /**
   * Handle incoming task
   */
  async handleTask(msg, { ack, nack, reject }) {
    const { id, task } = msg;

    try {
      console.log(`\n📥 Received task: ${task.title}`);
      console.log(`   Description: ${task.description}`);
      console.log(`   Priority: ${task.priority}`);

      this.stats.tasksReceived++;
      this.activeTasks.set(id, {
        ...task,
        startedAt: Date.now()
      });

      // Notify starting work
      await this.publishStatus({
        event: 'task_started',
        taskId: id,
        task: task.title
      }, 'agent.status.task.started');

      // Simulate task processing
      // In real scenario, Claude would execute the actual task
      console.log(`⚙️  Processing task...`);

      // Check if collaboration needed
      if (task.requiresCollaboration) {
        console.log(`🤝 Task requires collaboration - initiating brainstorm`);
        await this.initiateBrainstorm({
          taskId: id,
          topic: task.title,
          question: task.collaborationQuestion || 'How should we approach this?',
          requiredAgents: task.requiredAgents || []
        });

        // Wait for brainstorm results
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Complete task
      const result = {
        taskId: id,
        task: task.title,
        status: 'completed',
        output: `Task "${task.title}" completed successfully`,
        processedBy: this.agentId,
        completedAt: Date.now(),
        duration: Date.now() - this.activeTasks.get(id).startedAt
      };

      await this.publishResult(result);

      // Notify task completion for monitoring
      await this.publishStatus({
        event: 'task_completed',
        taskId: id,
        task: task.title,
        duration: result.duration
      }, 'agent.status.task.completed');

      this.activeTasks.delete(id);
      this.stats.tasksCompleted++;

      console.log(`✅ Task completed: ${task.title}\n`);

      ack();
    } catch (error) {
      console.error(`❌ Task failed: ${error.message}`);

      this.stats.tasksFailed++;

      await this.publishStatus({
        event: 'task_failed',
        taskId: id,
        task: task.title,
        error: error.message
      }, 'agent.status.task.failed');

      // Requeue for retry or reject
      if (task.retryCount && task.retryCount > 0) {
        task.retryCount--;
        nack(true); // Requeue
      } else {
        reject(); // Dead letter
      }
    }
  }

  /**
   * Initiate brainstorm session
   */
  async initiateBrainstorm(session) {
    console.log(`\n🧠 Initiating brainstorm: ${session.topic}`);

    const sessionId = uuidv4();
    this.brainstormSessions.set(sessionId, {
      ...session,
      responses: [],
      startedAt: Date.now()
    });

    await this.client.broadcastBrainstorm({
      sessionId,
      topic: session.topic,
      question: session.question,
      initiatedBy: this.agentId,
      requiredAgents: session.requiredAgents
    });

    console.log(`🧠 Brainstorm broadcasted to all agents\n`);

    return sessionId;
  }

  /**
   * Handle brainstorm message
   */
  async handleBrainstormMessage(msg) {
    const { sessionId, topic, question, initiatedBy } = msg.message;

    console.log(`\n🧠 Brainstorm request received:`);
    console.log(`   Topic: ${topic}`);
    console.log(`   Question: ${question}`);
    console.log(`   From: ${initiatedBy}`);

    this.stats.brainstormsParticipated++;

    // Simulate thinking and responding
    const response = {
      sessionId,
      from: this.agentId,
      agentType: this.agentType,
      suggestion: `Agent ${this.agentId} suggests: Consider approach based on ${topic}`,
      timestamp: Date.now()
    };

    // Send response back via result queue
    await this.publishResult({
      type: 'brainstorm_response',
      ...response
    });

    console.log(`🧠 Brainstorm response sent\n`);
  }

  /**
   * Publish result
   */
  async publishResult(result) {
    await this.client.publishResult(result);
    this.results.set(result.taskId || result.sessionId, result);
    this.stats.resultsPublished++;

    await this.publishStatus({
      event: 'result_published',
      resultId: result.taskId || result.sessionId
    }, 'agent.status.result');
  }

  /**
   * Handle result (Team Leader)
   */
  async handleResult(msg) {
    const { result } = msg;

    if (result.type === 'brainstorm_response') {
      console.log(`\n🧠 Brainstorm response from ${result.from}:`);
      console.log(`   ${result.suggestion}\n`);
    } else {
      console.log(`\n📊 Result received:`);
      console.log(`   Task: ${result.task}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   From: ${result.processedBy}`);
      console.log(`   Duration: ${result.duration}ms\n`);
    }

    this.results.set(result.taskId || result.sessionId, result);
  }

  /**
   * Publish status
   */
  async publishStatus(status, routingKey) {
    // Check if client is connected before publishing
    if (!this.client || !this.client.isConnected) {
      console.warn('⚠️  Cannot publish status - not connected');
      return;
    }

    try {
      await this.client.publishStatus({
        ...status,
        agentId: this.agentId,
        agentType: this.agentType,
        stats: this.stats
      }, routingKey);
    } catch (error) {
      console.error(`❌ Failed to publish status: ${error.message}`);
      // Don't rethrow - allow execution to continue
    }
  }

  /**
   * Handle status update
   */
  async handleStatusUpdate(msg) {
    const { status } = msg;

    if (status.agentId === this.agentId) {
      return; // Ignore own status
    }

    console.log(`📡 Status update from ${status.agentId}: ${status.event || status.state}`);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeTasks: this.activeTasks.size,
      activeBrainstorms: this.brainstormSessions.size,
      totalResults: this.results.size
    };
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    console.log('\n🛑 Shutting down orchestrator...');

    await this.publishStatus({
      event: 'shutdown',
      finalStats: this.getStats()
    }, 'agent.status.shutdown');

    await this.client.close();

    console.log('✅ Orchestrator shutdown complete\n');
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const agentType = process.argv[2] || process.env.AGENT_TYPE || 'worker';

  const orchestrator = new AgentOrchestrator(agentType);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await orchestrator.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await orchestrator.shutdown();
    process.exit(0);
  });

  // Start orchestrator
  await orchestrator.initialize();

  switch (agentType) {
    case 'team-leader':
    case 'leader':
      await orchestrator.startTeamLeader();
      break;
    case 'coordinator':
      await orchestrator.startCoordinator();
      break;
    case 'collaborator':
      await orchestrator.startCollaborator();
      break;
    case 'monitor':
      await orchestrator.startMonitor();
      break;
    case 'worker':
    default:
      await orchestrator.startWorker();
      break;
  }

  console.log('🎯 Orchestrator running - press Ctrl+C to stop\n');
}

export default AgentOrchestrator;
