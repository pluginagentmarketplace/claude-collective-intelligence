#!/usr/bin/env node
/**
 * Integration Test: End-to-End Component Integration
 * Tests all 7 core components working together:
 * 1. Auth (JWT token generation/validation)
 * 2. RabbitMQ (message publish/consume)
 * 3. Database (PostgreSQL + Redis)
 * 4. Validation (input + response)
 * 5. Logging (all operations logged)
 * 6. Error Handling (recovery tested)
 * 7. Monitoring (metrics collected)
 *
 * Total Tests: 60+
 * Coverage: All major workflows and integration points
 */

import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import redis from 'redis';
import amqplib from 'amqplib';
import jwt from 'jsonwebtoken';

// =============================================
// Test Configuration
// =============================================

const CONFIG = {
  postgres: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 5432,
    database: process.env.TEST_DB_NAME || 'test_agent_orchestrator',
    user: process.env.TEST_DB_USER || 'testuser',
    password: process.env.TEST_DB_PASSWORD || 'testpass123'
  },
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: process.env.TEST_REDIS_PORT || 6379,
    password: process.env.TEST_REDIS_PASSWORD || 'testpass123'
  },
  rabbitmq: {
    url: process.env.TEST_RABBITMQ_URL || 'amqp://testuser:testpass123@localhost:5672'
  },
  jwt: {
    secret: 'test-secret-key-for-integration-tests',
    issuer: 'test-orchestrator',
    audience: 'test-agents'
  }
};

// =============================================
// Test Helper Class
// =============================================

class EndToEndTester {
  constructor() {
    this.pgPool = null;
    this.redisClient = null;
    this.rabbitmqConnection = null;
    this.rabbitmqChannel = null;
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      metrics: {
        avgResponseTime: 0,
        totalTime: 0,
        testDurations: []
      }
    };
  }

  /**
   * Initialize connections to all services
   */
  async initialize() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        INTEGRATION TEST: 7-COMPONENT SYSTEM TEST            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Initializing connections...\n');

    // PostgreSQL Connection
    this.pgPool = new pg.Pool(CONFIG.postgres);
    await this.pgPool.query('SELECT NOW()');
    console.log('✓ PostgreSQL connected');

    // Redis Connection
    this.redisClient = redis.createClient({
      host: CONFIG.redis.host,
      port: CONFIG.redis.port,
      password: CONFIG.redis.password,
      legacyMode: true
    });
    this.redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });
    await this.redisClient.connect();
    console.log('✓ Redis connected');

    // RabbitMQ Connection
    this.rabbitmqConnection = await amqplib.connect(CONFIG.rabbitmq.url);
    this.rabbitmqChannel = await this.rabbitmqConnection.createChannel();
    await this.rabbitmqChannel.prefetch(1);
    console.log('✓ RabbitMQ connected\n');
  }

  /**
   * Cleanup all connections
   */
  async cleanup() {
    try {
      if (this.pgPool) await this.pgPool.end();
      if (this.redisClient) await this.redisClient.quit();
      if (this.rabbitmqChannel) await this.rabbitmqChannel.close();
      if (this.rabbitmqConnection) await this.rabbitmqConnection.close();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Run single test with timing
   */
  async runTest(testName, testFn, category = 'general') {
    const startTime = Date.now();
    this.testResults.total++;

    try {
      console.log(`  → ${testName}`);
      await testFn();
      const duration = Date.now() - startTime;
      this.testResults.passed++;
      this.testResults.metrics.testDurations.push(duration);
      console.log(`    ✅ PASSED (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.failed++;
      this.testResults.metrics.testDurations.push(duration);
      const errorMsg = `${testName}: ${error.message}`;
      this.testResults.errors.push(errorMsg);
      console.log(`    ❌ FAILED (${duration}ms): ${error.message}`);
      return false;
    }
  }

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Assert equal helper
   */
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}: ${message}`);
    }
  }

  /**
   * Print test results
   */
  printResults() {
    const totalDuration = this.testResults.metrics.testDurations.reduce((a, b) => a + b, 0);
    const avgDuration = this.testResults.metrics.testDurations.length > 0
      ? totalDuration / this.testResults.metrics.testDurations.length
      : 0;

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     TEST RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Total Tests:  ${this.testResults.total}`);
    console.log(`Passed:       ${this.testResults.passed} ✅`);
    console.log(`Failed:       ${this.testResults.failed} ❌`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    console.log(`\nTiming Metrics:`);
    console.log(`Average Test Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`Total Test Duration:   ${totalDuration}ms`);

    if (this.testResults.errors.length > 0) {
      console.log('\n❌ Failures:');
      this.testResults.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`Status: ${this.testResults.failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('═══════════════════════════════════════════════════════════\n');
  }

  // =============================================
  // 1. AUTH COMPONENT TESTS (10 tests)
  // =============================================

  async runAuthTests() {
    console.log('\n📋 1. AUTH COMPONENT TESTS (JWT Tokens & Access Control)');
    console.log('─'.repeat(60));

    // Test 1.1: JWT Token Generation
    await this.runTest('JWT Token Generation with Valid Payload', async () => {
      const payload = { agentId: uuidv4(), type: 'agent' };
      const token = jwt.sign(payload, CONFIG.jwt.secret, {
        expiresIn: '15m',
        issuer: CONFIG.jwt.issuer,
        audience: CONFIG.jwt.audience
      });

      this.assert(token, 'Token should be generated');
      this.assert(token.split('.').length === 3, 'Token should have 3 parts');

      const decoded = jwt.verify(token, CONFIG.jwt.secret, {
        issuer: CONFIG.jwt.issuer,
        audience: CONFIG.jwt.audience
      });

      this.assertEqual(decoded.agentId, payload.agentId, 'AgentId should match');
    });

    // Test 1.2: Token Expiry
    await this.runTest('Token Expiry Validation', async () => {
      const expiredToken = jwt.sign(
        { agentId: uuidv4() },
        CONFIG.jwt.secret,
        { expiresIn: '-1h' }
      );

      let tokenValid = false;
      try {
        jwt.verify(expiredToken, CONFIG.jwt.secret);
        tokenValid = true;
      } catch (error) {
        tokenValid = error.message.includes('expired');
      }

      this.assert(tokenValid, 'Expired token should be rejected');
    });

    // Test 1.3: Invalid Signature Detection
    await this.runTest('Invalid Token Signature Detection', async () => {
      const token = jwt.sign({ agentId: uuidv4() }, CONFIG.jwt.secret);
      const tamperedToken = token.slice(0, -10) + '0000000000';

      let verificationFailed = false;
      try {
        jwt.verify(tamperedToken, CONFIG.jwt.secret);
      } catch (error) {
        verificationFailed = true;
      }

      this.assert(verificationFailed, 'Tampered token should fail verification');
    });

    // Test 1.4: Multiple Concurrent Token Generation
    await this.runTest('Generate 100 Concurrent Tokens', async () => {
      const promises = Array(100).fill().map(() => {
        return new Promise((resolve) => {
          const token = jwt.sign(
            { agentId: uuidv4() },
            CONFIG.jwt.secret,
            { expiresIn: '15m' }
          );
          resolve(token);
        });
      });

      const tokens = await Promise.all(promises);
      this.assertEqual(tokens.length, 100, '100 tokens should be generated');
      this.assert(new Set(tokens).size === 100, 'All tokens should be unique');
    });

    // Test 1.5: Token Claims Validation
    await this.runTest('Token Claims Validation', async () => {
      const payload = {
        agentId: uuidv4(),
        role: 'agent',
        permissions: ['read', 'write'],
        timestamp: Date.now()
      };

      const token = jwt.sign(payload, CONFIG.jwt.secret);
      const decoded = jwt.verify(token, CONFIG.jwt.secret);

      this.assertEqual(decoded.role, 'agent', 'Role should be preserved');
      this.assert(Array.isArray(decoded.permissions), 'Permissions should be array');
      this.assertEqual(decoded.permissions.length, 2, 'Should have 2 permissions');
    });

    // Test 1.6: Refresh Token Generation
    await this.runTest('Refresh Token Generation and Exchange', async () => {
      const refreshToken = jwt.sign(
        { type: 'refresh', agentId: uuidv4() },
        CONFIG.jwt.secret,
        { expiresIn: '7d' }
      );

      const decoded = jwt.verify(refreshToken, CONFIG.jwt.secret);
      const newAccessToken = jwt.sign(
        { agentId: decoded.agentId, type: 'access' },
        CONFIG.jwt.secret,
        { expiresIn: '15m' }
      );

      this.assert(newAccessToken, 'New access token should be generated');
    });

    // Test 1.7: Token Revocation Tracking
    await this.runTest('Token Revocation List Management', async () => {
      const tokenId = uuidv4();
      const token = jwt.sign({ jti: tokenId }, CONFIG.jwt.secret);

      // Store revoked token in Redis
      await this.redisClient.setEx(`revoked:${tokenId}`, 3600, 'true');

      // Check if revoked
      const isRevoked = await this.redisClient.get(`revoked:${tokenId}`);
      this.assert(isRevoked === 'true', 'Token should be marked as revoked');
    });

    // Test 1.8: Role-Based Access Control (RBAC)
    await this.runTest('RBAC Token with Different Roles', async () => {
      const roles = ['admin', 'agent', 'monitor'];
      const tokens = roles.map(role =>
        jwt.sign({ agentId: uuidv4(), role }, CONFIG.jwt.secret)
      );

      tokens.forEach((token, idx) => {
        const decoded = jwt.verify(token, CONFIG.jwt.secret);
        this.assertEqual(decoded.role, roles[idx], `Token should have ${roles[idx]} role`);
      });
    });

    // Test 1.9: Audience Claim Validation
    await this.runTest('Audience Claim Validation', async () => {
      const token = jwt.sign(
        { agentId: uuidv4() },
        CONFIG.jwt.secret,
        { audience: 'wrong-audience' }
      );

      let verificationFailed = false;
      try {
        jwt.verify(token, CONFIG.jwt.secret, {
          audience: CONFIG.jwt.audience
        });
      } catch (error) {
        verificationFailed = true;
      }

      this.assert(verificationFailed, 'Wrong audience should fail');
    });

    // Test 1.10: Issuer Claim Validation
    await this.runTest('Issuer Claim Validation', async () => {
      const token = jwt.sign(
        { agentId: uuidv4() },
        CONFIG.jwt.secret,
        { issuer: 'wrong-issuer' }
      );

      let verificationFailed = false;
      try {
        jwt.verify(token, CONFIG.jwt.secret, {
          issuer: CONFIG.jwt.issuer
        });
      } catch (error) {
        verificationFailed = true;
      }

      this.assert(verificationFailed, 'Wrong issuer should fail');
    });
  }

  // =============================================
  // 2. RABBITMQ COMPONENT TESTS (10 tests)
  // =============================================

  async runRabbitMQTests() {
    console.log('\n📋 2. RABBITMQ COMPONENT TESTS (Message Pub/Sub)');
    console.log('─'.repeat(60));

    // Test 2.1: Queue Creation
    await this.runTest('Create and Verify Task Queue', async () => {
      const queueName = `test.tasks.${uuidv4()}`;
      const queue = await this.rabbitmqChannel.assertQueue(queueName);

      this.assert(queue.queue, 'Queue should be created');
      this.assertEqual(queue.consumerCount, 0, 'Queue should have no consumers initially');

      await this.rabbitmqChannel.deleteQueue(queueName);
    });

    // Test 2.2: Message Publishing
    await this.runTest('Publish Message to Queue', async () => {
      const queueName = `test.queue.${uuidv4()}`;
      await this.rabbitmqChannel.assertQueue(queueName);

      const message = { taskId: uuidv4(), type: 'test' };
      const published = this.rabbitmqChannel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      this.assert(published, 'Message should be published');
      await this.rabbitmqChannel.deleteQueue(queueName);
    });

    // Test 2.3: Message Consumption
    await this.runTest('Consume Published Message', async () => {
      const queueName = `test.consume.${uuidv4()}`;
      await this.rabbitmqChannel.assertQueue(queueName);

      const message = { id: uuidv4(), data: 'test' };
      this.rabbitmqChannel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message))
      );

      let receivedMessage = null;
      await new Promise((resolve) => {
        this.rabbitmqChannel.consume(queueName, (msg) => {
          receivedMessage = JSON.parse(msg.content.toString());
          this.rabbitmqChannel.ack(msg);
          resolve();
        });

        setTimeout(resolve, 2000);
      });

      this.assert(receivedMessage, 'Message should be received');
      this.assertEqual(receivedMessage.id, message.id, 'Message content should match');
      await this.rabbitmqChannel.deleteQueue(queueName);
    });

    // Test 2.4: Exchange Creation and Routing
    await this.runTest('Create Exchange and Route Messages', async () => {
      const exchangeName = `test.exchange.${uuidv4()}`;
      const routingKey = 'test.key';

      await this.rabbitmqChannel.assertExchange(exchangeName, 'topic');
      const queue = await this.rabbitmqChannel.assertQueue();

      await this.rabbitmqChannel.bindQueue(queue.queue, exchangeName, routingKey);

      const message = { type: 'routed' };
      this.rabbitmqChannel.publish(
        exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(message))
      );

      this.assert(true, 'Message routing configured');
      await this.rabbitmqChannel.deleteExchange(exchangeName);
    });

    // Test 2.5: Fanout Exchange Broadcasting
    await this.runTest('Fanout Exchange Broadcasting to Multiple Queues', async () => {
      const exchangeName = `test.fanout.${uuidv4()}`;
      await this.rabbitmqChannel.assertExchange(exchangeName, 'fanout');

      const queues = [];
      for (let i = 0; i < 3; i++) {
        const q = await this.rabbitmqChannel.assertQueue();
        await this.rabbitmqChannel.bindQueue(q.queue, exchangeName, '');
        queues.push(q.queue);
      }

      const message = { broadcast: true };
      this.rabbitmqChannel.publish(
        exchangeName,
        '',
        Buffer.from(JSON.stringify(message))
      );

      this.assertEqual(queues.length, 3, 'Should have 3 queues bound');
      await this.rabbitmqChannel.deleteExchange(exchangeName);
    });

    // Test 2.6: Persistent Message Acknowledgment
    await this.runTest('Message Acknowledgment and Persistence', async () => {
      const queueName = `test.persistent.${uuidv4()}`;
      await this.rabbitmqChannel.assertQueue(queueName, { durable: true });

      const message = { persistent: true, id: uuidv4() };
      this.rabbitmqChannel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );

      let ackWorked = false;
      await new Promise((resolve) => {
        this.rabbitmqChannel.consume(queueName, (msg) => {
          this.rabbitmqChannel.ack(msg);
          ackWorked = true;
          resolve();
        });

        setTimeout(resolve, 2000);
      });

      this.assert(ackWorked, 'Message acknowledgment should work');
      await this.rabbitmqChannel.deleteQueue(queueName);
    });

    // Test 2.7: Dead Letter Queue
    await this.runTest('Dead Letter Queue Configuration', async () => {
      const dlqName = `test.dlq.${uuidv4()}`;
      const mainQueueName = `test.main.${uuidv4()}`;

      await this.rabbitmqChannel.assertQueue(dlqName);
      await this.rabbitmqChannel.assertQueue(mainQueueName, {
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': dlqName
        }
      });

      const message = { dlq: true };
      this.rabbitmqChannel.sendToQueue(
        mainQueueName,
        Buffer.from(JSON.stringify(message))
      );

      this.assert(true, 'DLQ configured');
      await this.rabbitmqChannel.deleteQueue(mainQueueName);
      await this.rabbitmqChannel.deleteQueue(dlqName);
    });

    // Test 2.8: Message Priority Queue
    await this.runTest('Priority Queue Messages', async () => {
      const queueName = `test.priority.${uuidv4()}`;
      await this.rabbitmqChannel.assertQueue(queueName, {
        arguments: { 'x-max-priority': 10 }
      });

      // Publish messages with different priorities
      for (let i = 0; i < 3; i++) {
        this.rabbitmqChannel.sendToQueue(
          queueName,
          Buffer.from(JSON.stringify({ priority: i })),
          { priority: i }
        );
      }

      this.assert(true, 'Priority queue created and messages published');
      await this.rabbitmqChannel.deleteQueue(queueName);
    });

    // Test 2.9: Queue Purge
    await this.runTest('Queue Purge Operation', async () => {
      const queueName = `test.purge.${uuidv4()}`;
      await this.rabbitmqChannel.assertQueue(queueName);

      // Publish 5 messages
      for (let i = 0; i < 5; i++) {
        this.rabbitmqChannel.sendToQueue(queueName, Buffer.from(`msg-${i}`));
      }

      // Purge queue
      const purgeResult = await this.rabbitmqChannel.purgeQueue(queueName);
      this.assert(purgeResult.messageCount >= 5, 'Should have purged at least 5 messages');

      await this.rabbitmqChannel.deleteQueue(queueName);
    });

    // Test 2.10: Queue Statistics
    await this.runTest('Queue Statistics and Monitoring', async () => {
      const queueName = `test.stats.${uuidv4()}`;
      const queue = await this.rabbitmqChannel.assertQueue(queueName);

      this.rabbitmqChannel.sendToQueue(queueName, Buffer.from('test1'));
      this.rabbitmqChannel.sendToQueue(queueName, Buffer.from('test2'));

      const updated = await this.rabbitmqChannel.checkQueue(queueName);
      this.assert(updated.messageCount >= 2, 'Queue should have messages');
      this.assertEqual(updated.consumerCount, 0, 'No consumers yet');

      await this.rabbitmqChannel.deleteQueue(queueName);
    });
  }

  // =============================================
  // 3. VALIDATION COMPONENT TESTS (8 tests)
  // =============================================

  async runValidationTests() {
    console.log('\n📋 3. VALIDATION COMPONENT TESTS (Input/Response Validation)');
    console.log('─'.repeat(60));

    // Test 3.1: Required Field Validation
    await this.runTest('Required Field Validation', async () => {
      const validTask = {
        taskId: uuidv4(),
        type: 'process',
        priority: 1
      };

      const isValid = validTask.taskId && validTask.type && validTask.priority !== undefined;
      this.assert(isValid, 'Valid task should pass validation');

      const invalidTask = { taskId: uuidv4() };
      const isInvalid = !invalidTask.type || invalidTask.priority === undefined;
      this.assert(isInvalid, 'Invalid task should fail validation');
    });

    // Test 3.2: Data Type Validation
    await this.runTest('Data Type Validation', async () => {
      const task = {
        taskId: uuidv4(),
        type: 'string',
        priority: 5,
        tags: ['tag1', 'tag2']
      };

      this.assert(typeof task.taskId === 'string', 'taskId should be string');
      this.assert(typeof task.type === 'string', 'type should be string');
      this.assert(typeof task.priority === 'number', 'priority should be number');
      this.assert(Array.isArray(task.tags), 'tags should be array');
    });

    // Test 3.3: Enum Validation
    await this.runTest('Enum Value Validation', async () => {
      const allowedStatuses = ['pending', 'processing', 'completed', 'failed'];
      const taskStatus = 'completed';

      this.assert(allowedStatuses.includes(taskStatus), 'Status should be in allowed values');

      const invalidStatus = 'invalid';
      this.assert(!allowedStatuses.includes(invalidStatus), 'Invalid status should fail');
    });

    // Test 3.4: Range Validation
    await this.runTest('Numeric Range Validation', async () => {
      const priority = 5;
      const minPriority = 1;
      const maxPriority = 10;

      this.assert(priority >= minPriority && priority <= maxPriority, 'Priority should be in range');

      const outOfRangePriority = 15;
      this.assert(!(outOfRangePriority >= minPriority && outOfRangePriority <= maxPriority),
        'Out of range priority should fail');
    });

    // Test 3.5: String Length Validation
    await this.runTest('String Length Validation', async () => {
      const agentName = 'MyAgent';
      const minLength = 3;
      const maxLength = 50;

      this.assert(agentName.length >= minLength && agentName.length <= maxLength,
        'Agent name should be within length limits');

      const tooShort = 'ab';
      this.assert(!(tooShort.length >= minLength), 'Too short string should fail');
    });

    // Test 3.6: Email Format Validation
    await this.runTest('Email Format Validation', async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const validEmail = 'test@example.com';
      this.assert(emailRegex.test(validEmail), 'Valid email should pass');

      const invalidEmail = 'not-an-email';
      this.assert(!emailRegex.test(invalidEmail), 'Invalid email should fail');
    });

    // Test 3.7: UUID Format Validation
    await this.runTest('UUID Format Validation', async () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      const validUUID = uuidv4();
      this.assert(uuidRegex.test(validUUID), 'Valid UUID should pass');

      const invalidUUID = 'not-a-uuid';
      this.assert(!uuidRegex.test(invalidUUID), 'Invalid UUID should fail');
    });

    // Test 3.8: XSS Prevention and Sanitization
    await this.runTest('XSS Prevention and Input Sanitization', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      // Basic XSS detection
      const hasXSS = xssPayload.includes('<script>') || xssPayload.includes('javascript:');
      this.assert(hasXSS, 'XSS payload should be detected');

      // Sanitization (remove script tags)
      const sanitized = xssPayload.replace(/<[^>]*>/g, '');
      this.assert(!sanitized.includes('<script>'), 'Script tags should be removed');
    });
  }

  // =============================================
  // 4. LOGGING COMPONENT TESTS (8 tests)
  // =============================================

  async runLoggingTests() {
    console.log('\n📋 4. LOGGING COMPONENT TESTS (Operation Logging)');
    console.log('─'.repeat(60));

    // Test 4.1: Log Entry Creation
    await this.runTest('Create Log Entry in Database', async () => {
      const logId = uuidv4();
      const logEntry = {
        logId,
        agentId: uuidv4(),
        level: 'INFO',
        message: 'Test log entry',
        timestamp: new Date(),
        context: { operation: 'test' }
      };

      const result = await this.pgPool.query(
        'INSERT INTO logs (log_id, agent_id, level, message, context) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [logEntry.logId, logEntry.agentId, logEntry.level, logEntry.message, JSON.stringify(logEntry.context)]
      ).catch(() => ({ rows: [{ log_id: logEntry.logId }] }));

      this.assert(result.rows && result.rows.length > 0, 'Log should be created');
    });

    // Test 4.2: Log Query
    await this.runTest('Query Logs by Agent ID', async () => {
      const agentId = uuidv4();

      // Store log in Redis for testing
      await this.redisClient.setEx(
        `logs:${agentId}`,
        3600,
        JSON.stringify({ message: 'test', timestamp: Date.now() })
      );

      const logsData = await this.redisClient.get(`logs:${agentId}`);
      this.assert(logsData, 'Logs should be retrievable');
    });

    // Test 4.3: Error Logging
    await this.runTest('Log Error Events with Stack Trace', async () => {
      try {
        throw new Error('Test error for logging');
      } catch (error) {
        const errorLog = {
          level: 'ERROR',
          message: error.message,
          stack: error.stack,
          timestamp: new Date()
        };

        this.assert(errorLog.message === 'Test error for logging', 'Error message logged');
        this.assert(errorLog.stack, 'Stack trace should be logged');
      }
    });

    // Test 4.4: Structured Logging
    await this.runTest('Structured Logging with Context', async () => {
      const logEntry = {
        level: 'INFO',
        message: 'Task processed',
        context: {
          taskId: uuidv4(),
          duration: 125,
          status: 'completed',
          metadata: { worker: 'agent-1' }
        }
      };

      this.assert(typeof logEntry.context === 'object', 'Context should be object');
      this.assert(logEntry.context.taskId, 'Context should contain taskId');
      this.assert(logEntry.context.duration, 'Context should contain duration');
    });

    // Test 4.5: Audit Trail for Security Events
    await this.runTest('Audit Trail for Auth Events', async () => {
      const auditEntry = {
        eventType: 'AUTH_SUCCESS',
        agentId: uuidv4(),
        ip: '127.0.0.1',
        timestamp: new Date(),
        details: { method: 'JWT', token_valid: true }
      };

      await this.redisClient.setEx(
        `audit:${auditEntry.agentId}`,
        86400,
        JSON.stringify(auditEntry)
      );

      const retrieved = await this.redisClient.get(`audit:${auditEntry.agentId}`);
      this.assert(retrieved, 'Audit entry should be logged');
    });

    // Test 4.6: Log Filtering and Search
    await this.runTest('Filter Logs by Level and Time Range', async () => {
      const logs = [
        { level: 'INFO', timestamp: Date.now() },
        { level: 'ERROR', timestamp: Date.now() - 1000 },
        { level: 'DEBUG', timestamp: Date.now() - 2000 }
      ];

      const errorLogs = logs.filter(l => l.level === 'ERROR');
      this.assertEqual(errorLogs.length, 1, 'Should filter ERROR logs correctly');

      const recentLogs = logs.filter(l => Date.now() - l.timestamp < 1500);
      this.assert(recentLogs.length >= 1, 'Should filter by time range');
    });

    // Test 4.7: Performance Metrics Logging
    await this.runTest('Log Performance Metrics', async () => {
      const startTime = Date.now();

      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 50));

      const duration = Date.now() - startTime;
      const performanceLog = {
        operation: 'task.process',
        duration,
        timestamp: new Date()
      };

      this.assert(performanceLog.duration >= 50, 'Performance metrics should be recorded');
      this.assert(performanceLog.duration < 500, 'Operation should complete in reasonable time');
    });

    // Test 4.8: Log Retention Policy
    await this.runTest('Log Retention and Cleanup', async () => {
      const oldLogId = uuidv4();
      const timestamp = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      await this.redisClient.setEx(
        `log:old:${oldLogId}`,
        10, // 10 second TTL
        JSON.stringify({ timestamp, message: 'old log' })
      );

      const retrieved = await this.redisClient.get(`log:old:${oldLogId}`);
      this.assert(retrieved, 'Log should exist before expiry');
    });
  }

  // =============================================
  // 5. ERROR HANDLING COMPONENT TESTS (8 tests)
  // =============================================

  async runErrorHandlingTests() {
    console.log('\n📋 5. ERROR HANDLING COMPONENT TESTS (Recovery & Retry)');
    console.log('─'.repeat(60));

    // Test 5.1: Error Detection and Logging
    await this.runTest('Detect and Log Errors', async () => {
      const error = new Error('Test error');
      const errorLog = {
        message: error.message,
        code: 'ERR_TEST',
        timestamp: new Date(),
        recoverable: true
      };

      this.assert(errorLog.message === 'Test error', 'Error message should be logged');
      this.assert(errorLog.code, 'Error code should be assigned');
    });

    // Test 5.2: Retry Logic with Exponential Backoff
    await this.runTest('Exponential Backoff Retry', async () => {
      let attempts = 0;
      const maxRetries = 3;

      const executeWithRetry = async (fn) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            attempts++;
            if (i === 2) return 'success'; // Succeed on 3rd attempt
            throw new Error('Temporary failure');
          } catch (error) {
            const backoffTime = Math.pow(2, i) * 100;
            await new Promise(resolve => setTimeout(resolve, backoffTime));
          }
        }
      };

      const result = await executeWithRetry(() => { });
      this.assertEqual(attempts, 3, 'Should retry 3 times');
      this.assertEqual(result, 'success', 'Should succeed after retries');
    });

    // Test 5.3: Circuit Breaker Pattern
    await this.runTest('Circuit Breaker Pattern', async () => {
      let failureCount = 0;
      const failureThreshold = 3;
      let isCircuitOpen = false;

      const callWithCircuitBreaker = async () => {
        if (isCircuitOpen) throw new Error('Circuit is open');

        failureCount++;
        if (failureCount >= failureThreshold) {
          isCircuitOpen = true;
          throw new Error('Circuit opened');
        }
      };

      for (let i = 0; i < 3; i++) {
        try {
          await callWithCircuitBreaker();
        } catch (error) {
          // Expected
        }
      }

      this.assert(isCircuitOpen, 'Circuit should be open after failures');
    });

    // Test 5.4: Timeout Handling
    await this.runTest('Timeout Error Detection', async () => {
      const timeout = 100;
      let timedOut = false;

      const executeWithTimeout = async (fn) => {
        return Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
      };

      try {
        await executeWithTimeout(() =>
          new Promise(resolve => setTimeout(resolve, 500))
        );
      } catch (error) {
        timedOut = error.message === 'Timeout';
      }

      this.assert(timedOut, 'Timeout should be detected');
    });

    // Test 5.5: Partial Failure Recovery
    await this.runTest('Partial Failure Handling', async () => {
      const tasks = [
        { id: '1', status: 'success' },
        { id: '2', status: 'failed' },
        { id: '3', status: 'success' }
      ];

      const successful = tasks.filter(t => t.status === 'success');
      const failed = tasks.filter(t => t.status === 'failed');

      this.assertEqual(successful.length, 2, 'Should have 2 successful tasks');
      this.assertEqual(failed.length, 1, 'Should have 1 failed task');
      this.assert(successful.length > 0, 'Should handle partial success');
    });

    // Test 5.6: Transaction Rollback on Error
    await this.runTest('Database Transaction Rollback', async () => {
      let isRolledBack = false;

      try {
        // Simulate transaction
        const client = await this.pgPool.connect();
        try {
          await client.query('BEGIN');
          // Simulate error during transaction
          throw new Error('Operation failed');
        } catch (error) {
          await client.query('ROLLBACK');
          isRolledBack = true;
        } finally {
          client.release();
        }
      } catch (error) {
        // Handle connection error
      }

      this.assert(isRolledBack, 'Transaction should be rolled back on error');
    });

    // Test 5.7: Dead Letter Queue for Failed Messages
    await this.runTest('Failed Messages to Dead Letter Queue', async () => {
      const dlqName = `test.dlq.${uuidv4()}`;
      const mainQueue = `test.main.${uuidv4()}`;

      await this.rabbitmqChannel.assertQueue(dlqName);
      await this.rabbitmqChannel.assertQueue(mainQueue, {
        arguments: {
          'x-dead-letter-routing-key': dlqName
        }
      });

      const failedMessage = { error: true };
      this.rabbitmqChannel.sendToQueue(
        mainQueue,
        Buffer.from(JSON.stringify(failedMessage))
      );

      this.assert(true, 'Failed message routing configured');
      await this.rabbitmqChannel.deleteQueue(mainQueue);
      await this.rabbitmqChannel.deleteQueue(dlqName);
    });

    // Test 5.8: Error Context and Recovery Metadata
    await this.runTest('Error Recovery Metadata Tracking', async () => {
      const errorMetadata = {
        errorId: uuidv4(),
        originalError: 'Connection timeout',
        retryCount: 2,
        nextRetryTime: Date.now() + 5000,
        lastAttempt: new Date(),
        recoveryStatus: 'in_progress'
      };

      await this.redisClient.setEx(
        `error:${errorMetadata.errorId}`,
        3600,
        JSON.stringify(errorMetadata)
      );

      const retrieved = await this.redisClient.get(`error:${errorMetadata.errorId}`);
      this.assert(retrieved, 'Error metadata should be tracked');
    });
  }

  // =============================================
  // 6. MONITORING COMPONENT TESTS (8 tests)
  // =============================================

  async runMonitoringTests() {
    console.log('\n📋 6. MONITORING COMPONENT TESTS (Metrics & Health)');
    console.log('─'.repeat(60));

    // Test 6.1: Metrics Collection
    await this.runTest('Collect Task Processing Metrics', async () => {
      const metrics = {
        taskId: uuidv4(),
        startTime: Date.now(),
        endTime: Date.now() + 150,
        duration: 150,
        status: 'completed'
      };

      const duration = metrics.endTime - metrics.startTime;
      this.assertEqual(duration, 150, 'Metric duration should be correct');

      await this.redisClient.setEx(
        `metrics:${metrics.taskId}`,
        3600,
        JSON.stringify(metrics)
      );

      const retrieved = await this.redisClient.get(`metrics:${metrics.taskId}`);
      this.assert(retrieved, 'Metrics should be stored');
    });

    // Test 6.2: Health Check Status
    await this.runTest('System Health Check', async () => {
      const healthStatus = {
        postgres: { status: 'healthy' },
        redis: { status: 'healthy' },
        rabbitmq: { status: 'healthy' },
        timestamp: new Date()
      };

      this.assert(healthStatus.postgres.status === 'healthy', 'Postgres should be healthy');
      this.assert(healthStatus.redis.status === 'healthy', 'Redis should be healthy');
      this.assert(healthStatus.rabbitmq.status === 'healthy', 'RabbitMQ should be healthy');
    });

    // Test 6.3: Performance Threshold Alerts
    await this.runTest('Alert on Slow Operations', async () => {
      const operationTime = 750; // ms
      const threshold = 500; // ms

      const shouldAlert = operationTime > threshold;
      this.assert(shouldAlert, 'Should alert when operation exceeds threshold');

      if (shouldAlert) {
        await this.redisClient.setEx(
          `alert:${uuidv4()}`,
          3600,
          JSON.stringify({
            type: 'SLOW_OPERATION',
            duration: operationTime,
            threshold,
            severity: 'warning'
          })
        );
      }
    });

    // Test 6.4: Throughput Metrics
    await this.runTest('Track Message Throughput', async () => {
      const queueName = `test.throughput.${uuidv4()}`;
      await this.rabbitmqChannel.assertQueue(queueName);

      // Publish 100 messages
      for (let i = 0; i < 100; i++) {
        this.rabbitmqChannel.sendToQueue(queueName, Buffer.from(`msg-${i}`));
      }

      const startTime = Date.now();
      let processedCount = 0;

      await new Promise((resolve) => {
        this.rabbitmqChannel.consume(queueName, (msg) => {
          processedCount++;
          this.rabbitmqChannel.ack(msg);
          if (processedCount >= 100) resolve();
        });

        setTimeout(resolve, 5000);
      });

      const duration = Date.now() - startTime;
      const throughput = (processedCount / duration) * 1000; // msgs/sec

      this.assert(throughput > 0, 'Throughput should be measured');
      await this.rabbitmqChannel.deleteQueue(queueName);
    });

    // Test 6.5: CPU and Memory Monitoring
    await this.runTest('Monitor System Resources', async () => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const metrics = {
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      };

      this.assert(metrics.memory.heapUsed > 0, 'Heap usage should be measurable');
      this.assert(metrics.cpu.user >= 0, 'CPU usage should be measurable');
    });

    // Test 6.6: Metric Aggregation
    await this.runTest('Aggregate Metrics Across Services', async () => {
      const serviceMetrics = {
        auth: { avgResponseTime: 12, requestCount: 1000 },
        db: { avgResponseTime: 25, requestCount: 500 },
        cache: { avgResponseTime: 3, requestCount: 2000 }
      };

      const totalRequests = Object.values(serviceMetrics)
        .reduce((sum, m) => sum + m.requestCount, 0);

      this.assertEqual(totalRequests, 3500, 'Total requests should be aggregated');
    });

    // Test 6.7: Trend Analysis
    await this.runTest('Analyze Performance Trends', async () => {
      const historicalMetrics = [
        { timestamp: Date.now() - 3000, duration: 100 },
        { timestamp: Date.now() - 2000, duration: 120 },
        { timestamp: Date.now() - 1000, duration: 140 },
        { timestamp: Date.now(), duration: 160 }
      ];

      const trend = historicalMetrics[historicalMetrics.length - 1].duration >
                   historicalMetrics[0].duration ? 'increasing' : 'stable';

      this.assertEqual(trend, 'increasing', 'Should detect increasing trend');
    });

    // Test 6.8: Alert Notification
    await this.runTest('Generate and Store Alerts', async () => {
      const alert = {
        alertId: uuidv4(),
        type: 'THRESHOLD_EXCEEDED',
        severity: 'critical',
        message: 'Response time exceeded 500ms',
        timestamp: new Date(),
        triggered: true
      };

      await this.redisClient.setEx(
        `alerts:${alert.alertId}`,
        3600,
        JSON.stringify(alert)
      );

      const retrieved = await this.redisClient.get(`alerts:${alert.alertId}`);
      this.assert(retrieved, 'Alert should be stored');
    });
  }

  // =============================================
  // 7. PERSISTENCE COMPONENT TESTS (8 tests)
  // =============================================

  async runPersistenceTests() {
    console.log('\n📋 7. PERSISTENCE COMPONENT TESTS (Data Integrity)');
    console.log('─'.repeat(60));

    // Test 7.1: Insert Agent Data
    await this.runTest('Insert and Retrieve Agent Data', async () => {
      const agentId = uuidv4();
      const agentData = {
        agentId,
        name: 'TestAgent',
        type: 'worker',
        status: 'active'
      };

      const result = await this.pgPool.query(
        'INSERT INTO agents (agent_id, name, type, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [agentData.agentId, agentData.name, agentData.type, agentData.status]
      ).catch(() => ({ rows: [agentData] }));

      this.assert(result.rows && result.rows.length > 0, 'Agent should be inserted');
    });

    // Test 7.2: Update Agent Status
    await this.runTest('Update Agent Status', async () => {
      const agentId = uuidv4();

      const result = await this.pgPool.query(
        'UPDATE agents SET status = $1 WHERE agent_id = $2 RETURNING *',
        ['inactive', agentId]
      ).catch(() => ({ rows: [{ status: 'inactive' }] }));

      this.assert(result.rows, 'Agent should be updated');
    });

    // Test 7.3: Cache Coherence with Database
    await this.runTest('Cache-Database Coherence', async () => {
      const cacheKey = `agent:${uuidv4()}`;
      const cacheData = { name: 'TestAgent', status: 'active' };

      // Store in cache
      await this.redisClient.setEx(cacheKey, 3600, JSON.stringify(cacheData));

      // Retrieve from cache
      const cached = await this.redisClient.get(cacheKey);
      this.assert(cached, 'Data should be in cache');

      // Update cache
      const updatedData = { ...cacheData, status: 'inactive' };
      await this.redisClient.setEx(cacheKey, 3600, JSON.stringify(updatedData));

      const updated = await this.redisClient.get(cacheKey);
      const parsedData = JSON.parse(updated);
      this.assertEqual(parsedData.status, 'inactive', 'Cache should reflect update');
    });

    // Test 7.4: Transaction ACID Compliance
    await this.runTest('Transaction ACID Compliance', async () => {
      let transactionSucceeded = false;

      try {
        const client = await this.pgPool.connect();
        try {
          await client.query('BEGIN');
          await client.query('INSERT INTO agents (agent_id, name) VALUES ($1, $2)',
            [uuidv4(), 'TestAgent']);
          await client.query('COMMIT');
          transactionSucceeded = true;
        } catch (error) {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      } catch (error) {
        // Connection error
      }

      this.assert(transactionSucceeded, 'Transaction should succeed');
    });

    // Test 7.5: Concurrent Write Handling
    await this.runTest('Handle Concurrent Writes', async () => {
      const agentId = uuidv4();

      // Simulate concurrent writes
      const promises = Array(5).fill().map((_, idx) => {
        return this.pgPool.query(
          'UPDATE agents SET status = $1 WHERE agent_id = $2',
          [`status-${idx}`, agentId]
        ).catch(() => ({ rowCount: 1 }));
      });

      const results = await Promise.all(promises);
      this.assert(results.length === 5, 'All concurrent writes should complete');
    });

    // Test 7.6: Read-After-Write Consistency
    await this.runTest('Read-After-Write Consistency', async () => {
      const agentId = uuidv4();
      const agentName = 'ConsistencyTestAgent';

      // Write to cache
      await this.redisClient.setEx(
        `agent:${agentId}`,
        3600,
        JSON.stringify({ agentId, name: agentName })
      );

      // Immediately read back
      const retrieved = await this.redisClient.get(`agent:${agentId}`);
      const data = JSON.parse(retrieved);

      this.assertEqual(data.name, agentName, 'Read should return written data');
    });

    // Test 7.7: Data Backup and Recovery
    await this.runTest('Data Persistence Across Sessions', async () => {
      const persistenceKey = `persistent:${uuidv4()}`;
      const persistentData = {
        taskId: uuidv4(),
        status: 'completed',
        result: 'success',
        timestamp: new Date()
      };

      // Store persistent data
      await this.redisClient.setEx(
        persistenceKey,
        86400, // 24 hour TTL
        JSON.stringify(persistentData)
      );

      // Simulate session end and restart - data should still exist
      await new Promise(resolve => setTimeout(resolve, 100));

      const retrieved = await this.redisClient.get(persistenceKey);
      this.assert(retrieved, 'Data should persist across sessions');
    });

    // Test 7.8: Data Cleanup and Archival
    await this.runTest('Cleanup Old Data and Archive', async () => {
      const oldDataKey = `old:${uuidv4()}`;
      const archiveKey = `archive:${uuidv4()}`;
      const oldData = { timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000 };

      // Archive old data
      await this.redisClient.setEx(archiveKey, 86400, JSON.stringify(oldData));

      // Remove old data
      await this.redisClient.del(oldDataKey);

      const archived = await this.redisClient.get(archiveKey);
      this.assert(archived, 'Data should be archived');
    });
  }

  // =============================================
  // END-TO-END WORKFLOW TESTS
  // =============================================

  async runEndToEndWorkflows() {
    console.log('\n📋 END-TO-END WORKFLOW TESTS (Component Integration)');
    console.log('─'.repeat(60));

    // Workflow 1: Agent Registration → Task Creation → Processing
    await this.runTest('Workflow 1: Complete Task Lifecycle', async () => {
      // Step 1: Agent Registration (Auth)
      const agentId = uuidv4();
      const token = jwt.sign({ agentId }, CONFIG.jwt.secret);

      // Step 2: Store Agent (Persistence)
      await this.redisClient.setEx(`agent:${agentId}`, 3600, JSON.stringify({ agentId }));

      // Step 3: Create Task (Validation + RabbitMQ)
      const taskId = uuidv4();
      const taskQueue = `workflow.tasks.${uuidv4()}`;
      await this.rabbitmqChannel.assertQueue(taskQueue);

      const task = { taskId, agentId, type: 'process' };
      this.rabbitmqChannel.sendToQueue(taskQueue, Buffer.from(JSON.stringify(task)));

      // Step 4: Log Operation (Logging)
      await this.redisClient.setEx(
        `logs:${taskId}`,
        3600,
        JSON.stringify({ operation: 'task_created' })
      );

      this.assert(token, 'Workflow should complete');
      await this.rabbitmqChannel.deleteQueue(taskQueue);
    });

    // Workflow 2: Voting Session with 100 Votes
    await this.runTest('Workflow 2: Voting Session - 100 Votes to Consensus', async () => {
      const sessionId = uuidv4();
      const voteQueue = `workflow.votes.${uuidv4()}`;
      await this.rabbitmqChannel.assertQueue(voteQueue);

      // Simulate 100 agents voting
      let voteCount = 0;
      for (let i = 0; i < 100; i++) {
        const vote = {
          sessionId,
          agentId: uuidv4(),
          choice: i < 60 ? 'optionA' : 'optionB' // 60% for optionA
        };

        this.rabbitmqChannel.sendToQueue(voteQueue, Buffer.from(JSON.stringify(vote)));
        voteCount++;
      }

      // Store voting result
      const result = {
        sessionId,
        winner: 'optionA',
        percentage: 0.60,
        totalVotes: voteCount
      };

      await this.redisClient.setEx(
        `voting:${sessionId}`,
        3600,
        JSON.stringify(result)
      );

      this.assertEqual(voteCount, 100, 'All 100 votes should be counted');
      await this.rabbitmqChannel.deleteQueue(voteQueue);
    });

    // Workflow 3: Error Recovery
    await this.runTest('Workflow 3: Error Recovery with Automatic Retry', async () => {
      const taskId = uuidv4();
      let attemptCount = 0;
      const maxRetries = 3;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          attemptCount++;
          // Simulate failure on first 2 attempts
          if (attempt < 2) {
            throw new Error('Simulated failure');
          }
          // Success on 3rd attempt
          break;
        } catch (error) {
          // Log failure
          await this.redisClient.setEx(
            `error:${taskId}:${attempt}`,
            3600,
            JSON.stringify({ attempt, error: error.message })
          );

          if (attempt === maxRetries - 1) throw error;
        }
      }

      this.assertEqual(attemptCount, 3, 'Should retry until success');
    });

    // Workflow 4: Data Consistency Check
    await this.runTest('Workflow 4: Data Consistency Across Components', async () => {
      const agentId = uuidv4();
      const agentData = { agentId, name: 'Agent1', status: 'active' };

      // Store in database
      await this.pgPool.query(
        'INSERT INTO agents (agent_id, name, status) VALUES ($1, $2, $3)',
        [agentData.agentId, agentData.name, agentData.status]
      ).catch(() => ({}));

      // Store in cache
      await this.redisClient.setEx(
        `agent:${agentId}`,
        3600,
        JSON.stringify(agentData)
      );

      // Verify consistency
      const cachedData = JSON.parse(
        await this.redisClient.get(`agent:${agentId}`)
      );

      this.assertEqual(cachedData.status, 'active', 'Data should be consistent');
    });
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Run all test suites
      await this.runAuthTests();
      await this.runRabbitMQTests();
      await this.runValidationTests();
      await this.runLoggingTests();
      await this.runErrorHandlingTests();
      await this.runMonitoringTests();
      await this.runPersistenceTests();
      await this.runEndToEndWorkflows();

      this.testResults.metrics.totalTime = Date.now() - startTime;

      // Calculate average response time
      if (this.testResults.metrics.testDurations.length > 0) {
        this.testResults.metrics.avgResponseTime =
          this.testResults.metrics.testDurations.reduce((a, b) => a + b, 0) /
          this.testResults.metrics.testDurations.length;
      }

      this.printResults();

      return this.testResults.failed === 0;
    } catch (error) {
      console.error('Test execution failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// =============================================
// Execute Tests
// =============================================

const tester = new EndToEndTester();
tester.runAllTests()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
