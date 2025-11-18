#!/usr/bin/env node
/**
 * Validated Agent Orchestrator
 *
 * Example integration of validation system with the orchestrator
 * Shows how to use validation middleware with RabbitMQ
 */

import { RabbitMQClient } from '../../scripts/rabbitmq-client.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// Import validation components
import { ValidationMiddleware } from '../middleware/validation-middleware.js';
import {
  validateByType,
  agentCreationSchema,
  taskSubmissionSchema,
  brainstormMessageSchema
} from '../schemas/index.js';
import { sanitize } from '../sanitizers/sanitizer.js';

dotenv.config();

/**
 * Enhanced Orchestrator with Validation
 */
class ValidatedOrchestrator {
  constructor(agentType = 'worker') {
    this.agentType = agentType;
    this.agentId = process.env.AGENT_ID || `agent-${uuidv4()}`;
    this.agentName = process.env.AGENT_NAME || `Agent-${this.agentType}`;
    this.client = null;

    // Initialize validation middleware
    this.validationMiddleware = new ValidationMiddleware({
      enabled: true,
      sanitize: true,
      strict: false,
      logErrors: true,
      rejectInvalid: true,
      maxRetries: 3
    });

    // Setup validation event handlers
    this.setupValidationHandlers();

    this.activeTasks = new Map();
    this.brainstormSessions = new Map();

    this.stats = {
      tasksReceived: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      validationsFailed: 0,
      maliciousBlocked: 0
    };
  }

  /**
   * Setup validation event handlers
   */
  setupValidationHandlers() {
    this.validationMiddleware.on('validation:failed', (event) => {
      console.error('❌ Validation failed:', event.error);
      this.stats.validationsFailed++;
    });

    this.validationMiddleware.on('message:retried', (event) => {
      console.log(`🔄 Message retried (attempt ${event.retryCount})`);
    });

    this.validationMiddleware.on('message:deadlettered', (event) => {
      console.error('💀 Message sent to dead letter queue:', event.error);
    });

    this.validationMiddleware.on('middleware:error', (event) => {
      console.error('⚠️  Middleware error:', event.error);
    });
  }

  /**
   * Initialize with validation
   */
  async initialize() {
    console.log(`\n🛡️  Initializing VALIDATED ${this.agentType} orchestrator...`);
    console.log(`Agent ID: ${this.agentId}`);
    console.log(`Validation: ENABLED\n`);

    this.client = new RabbitMQClient({
      agentId: this.agentId
    });

    // Wrap client methods with validation
    this.wrapClientWithValidation();

    await this.client.connect();
    await this.setupQueuesAndExchanges();

    return this;
  }

  /**
   * Wrap RabbitMQ client with validation
   */
  wrapClientWithValidation() {
    const originalPublish = this.client.channel?.publish;
    const originalSendToQueue = this.client.channel?.sendToQueue;

    if (originalPublish) {
      this.client.channel.publish = async (exchange, routingKey, content, options) => {
        // Validate before publishing
        const validated = await this.validateOutgoingMessage(content);
        if (validated.valid) {
          return originalPublish.call(this.client.channel, exchange, routingKey, validated.content, options);
        } else {
          console.error('Cannot publish invalid message:', validated.error);
          throw new Error('Message validation failed');
        }
      };
    }

    if (originalSendToQueue) {
      this.client.channel.sendToQueue = async (queue, content, options) => {
        // Validate before sending
        const validated = await this.validateOutgoingMessage(content);
        if (validated.valid) {
          return originalSendToQueue.call(this.client.channel, queue, validated.content, options);
        } else {
          console.error('Cannot send invalid message:', validated.error);
          throw new Error('Message validation failed');
        }
      };
    }
  }

  /**
   * Validate outgoing message
   */
  async validateOutgoingMessage(content) {
    try {
      let message = content;
      if (Buffer.isBuffer(content)) {
        message = JSON.parse(content.toString());
      }

      // Sanitize
      const sanitized = await sanitize(message);

      // Identify and validate by type
      const messageType = this.identifyMessageType(sanitized);
      const validation = validateByType(messageType, sanitized);

      if (validation.error) {
        return {
          valid: false,
          error: validation.error
        };
      }

      return {
        valid: true,
        content: Buffer.from(JSON.stringify(validation.value))
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Identify message type
   */
  identifyMessageType(message) {
    if (message.type === 'brainstorm') return 'message.brainstorm';
    if (message.type === 'status') return 'message.status';
    if (message.taskId && message.status) return 'task.result';
    if (message.title && message.type && message.priority) return 'task.submit';
    if (message.name && message.role) return 'agent.create';
    return 'message.status'; // default
  }

  /**
   * Setup queues with validation
   */
  async setupQueuesAndExchanges() {
    console.log('📋 Setting up validated queues and exchanges...\n');

    // Task queue with validation middleware
    await this.client.setupTaskQueue();

    // Add consumer wrapper with validation
    const originalConsume = this.client.channel.consume;
    this.client.channel.consume = (queue, callback, options) => {
      const validatedCallback = this.validationMiddleware.createConsumerMiddleware()(
        callback,
        this.client.channel,
        callback
      );
      return originalConsume.call(this.client.channel, queue, validatedCallback, options);
    };

    // Brainstorm exchange
    const brainstorm = await this.client.setupBrainstormExchange();
    this.brainstormQueue = brainstorm.queueName;

    // Result queue
    await this.client.setupResultQueue();

    // Status exchange
    await this.client.setupStatusExchange();

    console.log('✅ All validated queues ready\n');
  }

  /**
   * Submit task with validation
   */
  async submitTask(taskData) {
    console.log('📝 Validating and submitting task...');

    // Validate task data
    const validation = taskSubmissionSchema.validate(taskData);

    if (validation.error) {
      console.error('❌ Task validation failed:', validation.error.details);
      throw new Error(`Invalid task data: ${validation.error.message}`);
    }

    // Sanitize task data
    const sanitizedTask = await sanitize(validation.value);

    // Add metadata
    const task = {
      ...sanitizedTask,
      taskId: uuidv4(),
      submittedAt: Date.now(),
      submittedBy: this.agentId
    };

    // Publish to task queue
    await this.client.publishTask('tasks.new', task);

    console.log(`✅ Valid task submitted: ${task.taskId}`);
    return task.taskId;
  }

  /**
   * Create agent with validation
   */
  async createAgent(agentData) {
    console.log('🤖 Validating and creating agent...');

    // Validate agent data
    const validation = agentCreationSchema.validate(agentData);

    if (validation.error) {
      console.error('❌ Agent validation failed:', validation.error.details);
      throw new Error(`Invalid agent data: ${validation.error.message}`);
    }

    // Check for malicious patterns
    const sanitized = await sanitize(validation.value);

    // Detect SQL injection attempts
    if (this.detectMaliciousPattern(sanitized.name)) {
      this.stats.maliciousBlocked++;
      throw new Error('Malicious pattern detected in agent name');
    }

    const agent = {
      ...sanitized,
      agentId: uuidv4(),
      createdAt: Date.now()
    };

    // Publish agent creation
    await this.client.publishStatus({
      event: 'agent.created',
      agent
    }, 'agent.status.created');

    console.log(`✅ Valid agent created: ${agent.agentId}`);
    return agent;
  }

  /**
   * Initiate brainstorm with validation
   */
  async initiateBrainstorm(sessionData) {
    console.log('🧠 Validating and initiating brainstorm...');

    const message = {
      messageId: uuidv4(),
      type: 'brainstorm',
      from: this.agentId,
      payload: {
        sessionId: uuidv4(),
        action: 'initiate',
        initiation: sessionData
      }
    };

    // Validate brainstorm message
    const validation = brainstormMessageSchema.validate(message);

    if (validation.error) {
      console.error('❌ Brainstorm validation failed:', validation.error.details);
      throw new Error(`Invalid brainstorm data: ${validation.error.message}`);
    }

    // Broadcast validated message
    await this.client.broadcastBrainstorm(validation.value.payload);

    console.log(`✅ Valid brainstorm initiated: ${message.payload.sessionId}`);
    return message.payload.sessionId;
  }

  /**
   * Detect malicious patterns
   */
  detectMaliciousPattern(input) {
    const patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/gi,
      /<script[^>]*>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Handle validated message
   */
  async handleValidatedMessage(msg) {
    // Message has already been validated by middleware
    const content = msg.validatedContent || JSON.parse(msg.content.toString());

    console.log('✅ Processing validated message:', {
      type: msg.validation?.type,
      sanitized: msg.validation?.sanitized
    });

    // Process based on type
    if (content.type === 'task') {
      await this.processValidatedTask(content);
    } else if (content.type === 'brainstorm') {
      await this.processValidatedBrainstorm(content);
    }
  }

  /**
   * Process validated task
   */
  async processValidatedTask(task) {
    this.stats.tasksReceived++;

    try {
      // Task is already validated and sanitized
      console.log(`📋 Processing validated task: ${task.title}`);

      // Execute task logic...
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = {
        taskId: task.taskId || uuidv4(),
        status: 'completed',
        output: `Validated task "${task.title}" completed`,
        processedBy: this.agentId
      };

      // Result will be validated on publish
      await this.client.publishResult(result);

      this.stats.tasksCompleted++;
      console.log('✅ Validated task completed');

    } catch (error) {
      this.stats.tasksFailed++;
      console.error('❌ Validated task failed:', error);
    }
  }

  /**
   * Process validated brainstorm
   */
  async processValidatedBrainstorm(message) {
    const { sessionId, action } = message.payload;

    if (action === 'initiate') {
      console.log('🧠 Participating in validated brainstorm');

      const response = {
        messageId: uuidv4(),
        type: 'brainstorm',
        from: this.agentId,
        payload: {
          sessionId,
          action: 'respond',
          response: {
            suggestion: 'Validated suggestion for the brainstorm',
            confidence: 0.9,
            reasoning: 'Based on validated input analysis'
          }
        }
      };

      // Response will be validated on publish
      await this.client.broadcastBrainstorm(response);
    }
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    const middlewareStats = this.validationMiddleware.getStats();

    return {
      ...this.stats,
      validation: {
        processed: middlewareStats.processed,
        valid: middlewareStats.valid,
        invalid: middlewareStats.invalid,
        sanitized: middlewareStats.sanitized,
        rejected: middlewareStats.rejected,
        retried: middlewareStats.retried,
        successRate: middlewareStats.validRate,
        maliciousBlocked: this.stats.maliciousBlocked
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('\n📊 Final validation statistics:');
    console.log(JSON.stringify(this.getValidationStats(), null, 2));

    if (this.client) {
      await this.client.close();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🛡️  VALIDATED ORCHESTRATOR DEMO\n');
  console.log('This demonstrates the integration of comprehensive validation\n');

  const orchestrator = new ValidatedOrchestrator('worker');

  try {
    await orchestrator.initialize();

    // Demo: Submit valid task
    console.log('\n--- Testing Valid Task ---');
    await orchestrator.submitTask({
      title: 'Valid test task for validation demo',
      type: 'compute',
      priority: 'normal',
      description: 'This is a valid task that will pass validation',
      metadata: {
        submittedBy: 'demo-user'
      }
    });

    // Demo: Try invalid task (will fail)
    console.log('\n--- Testing Invalid Task ---');
    try {
      await orchestrator.submitTask({
        title: 'X', // Too short
        type: 'invalid_type', // Invalid type
        // Missing required fields
      });
    } catch (error) {
      console.log('✅ Invalid task correctly rejected:', error.message);
    }

    // Demo: Try malicious input
    console.log('\n--- Testing Malicious Input ---');
    try {
      await orchestrator.createAgent({
        name: "Agent'; DROP TABLE users; --", // SQL injection
        role: 'worker',
        capabilities: ['compute']
      });
    } catch (error) {
      console.log('✅ Malicious input correctly blocked:', error.message);
    }

    // Demo: Create valid agent
    console.log('\n--- Testing Valid Agent ---');
    await orchestrator.createAgent({
      name: 'ValidAgent-Demo',
      role: 'worker',
      capabilities: ['compute', 'analyze'],
      metadata: {
        description: 'Demo agent with validation',
        owner: 'demo@example.com'
      }
    });

    // Demo: Initiate valid brainstorm
    console.log('\n--- Testing Valid Brainstorm ---');
    await orchestrator.initiateBrainstorm({
      topic: 'How to improve validation in distributed systems',
      question: 'What are the best practices for message validation in RabbitMQ?',
      minResponses: 2,
      timeout: 60000
    });

    // Wait for some processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Show statistics
    console.log('\n📊 Validation Statistics:');
    console.log(JSON.stringify(orchestrator.getValidationStats(), null, 2));

  } catch (error) {
    console.error('❌ Demo error:', error);
  } finally {
    await orchestrator.shutdown();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default ValidatedOrchestrator;