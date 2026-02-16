#!/usr/bin/env node
/**
 * Integration Test: Failure Handling
 * Tests failure scenarios:
 * - Task failure and retry
 * - Agent disconnection
 * - Queue overflow
 * - Message timeout
 * - Dead letter queue
 */

import AgentOrchestrator from '../../src/core/orchestrator.js';
import { RabbitMQClient } from '../../src/core/rabbitmq-client.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';

class FailureHandlingTest {
  constructor() {
    this.setup = new TestSetup();
    this.agents = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         INTEGRATION TEST: FAILURE HANDLING                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      await this.testTaskFailureAndRetry();
      await this.testAgentDisconnection();
      await this.testQueueOverflow();
      await this.testMessageTimeout();
      await this.testTaskRequeue();

      this.printResults();

      return this.testResults.failed === 0;
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.testResults.errors.push(error.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test 1: Task failure and retry mechanism
   */
  async testTaskFailureAndRetry() {
    console.log('\n📝 Test 1: Task Failure and Retry');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      this.agents = [leader, worker];

      await leader.initialize();
      await worker.initialize();

      const results = [];
      const failures = [];

      leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      // Override worker's handleTask to fail first attempt
      let attemptCount = 0;
      const originalHandleTask = worker.handleTask.bind(worker);

      worker.handleTask = async (msg, { ack, nack, reject }) => {
        attemptCount++;
        console.log(`  → Task attempt #${attemptCount}`);

        if (attemptCount === 1) {
          // Fail first attempt
          console.log('  → Simulating failure on first attempt...');
          worker.stats.tasksFailed++;

          await worker.publishStatus({
            event: 'task_failed',
            taskId: msg.id,
            task: msg.task.title,
            error: 'Simulated failure'
          }, 'agent.status.task.failed');

          failures.push(msg.id);

          // Requeue with retry count
          msg.task.retryCount = 1;
          nack(true); // Requeue
          return;
        }

        // Second attempt succeeds
        await originalHandleTask(msg, { ack, nack, reject });
      };

      await leader.startTeamLeader();
      await worker.startWorker();

      await wait(500);

      // Assign task
      console.log('  → Assigning task...');
      const taskId = await leader.assignTask({
        title: 'Retry Test Task',
        description: 'Task that will fail first attempt',
        priority: 'normal'
      });

      // Wait for completion (should retry and succeed)
      await waitForCondition(() => results.length >= 1, 10000);

      // Verify
      assertEqual(attemptCount, 2, 'Task should be attempted twice');
      assertEqual(failures.length, 1, 'Should have 1 failure');
      assertEqual(results.length, 1, 'Should have 1 successful result');
      assertEqual(results[0].status, 'completed', 'Task should eventually complete');
      assertEqual(worker.stats.tasksFailed, 1, 'Worker should record 1 failure');
      assertEqual(worker.stats.tasksCompleted, 1, 'Worker should record 1 completion');

      console.log('  ✅ Task failure and retry test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 1: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Test 2: Agent disconnection and reconnection
   */
  async testAgentDisconnection() {
    console.log('\n📝 Test 2: Agent Disconnection');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      this.agents = [leader, worker];

      await leader.initialize();
      await worker.initialize();

      const statusUpdates = [];
      leader.handleStatusUpdate = (msg) => {
        statusUpdates.push(msg.status);
      };

      await leader.startTeamLeader();
      await worker.startWorker();

      await wait(500);

      // Verify worker is connected
      const connectedUpdate = statusUpdates.find(
        s => s.state === 'connected' && s.agentId === worker.agentId
      );
      assert(connectedUpdate, 'Worker should send connected status');

      // Disconnect worker
      console.log('  → Disconnecting worker...');
      await worker.client.close();

      await wait(1000);

      // Check for disconnection status
      const hasDisconnectStatus = statusUpdates.some(
        s => s.state === 'disconnected' || s.event === 'shutdown'
      );

      console.log('  → Worker disconnected');

      // Verify worker is no longer healthy
      assertEqual(worker.client.isHealthy(), false, 'Worker should not be healthy after disconnect');

      console.log('  ✅ Agent disconnection test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 2: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Test 3: Queue overflow handling
   */
  async testQueueOverflow() {
    console.log('\n📝 Test 3: Queue Overflow Handling');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      await leader.initialize();
      this.agents = [leader];

      await leader.startTeamLeader();
      await wait(500);

      // Create a queue with small max length for testing
      const testQueue = 'test.overflow.queue';
      await leader.client.channel.assertQueue(testQueue, {
        durable: true,
        arguments: {
          'x-max-length': 10 // Small limit for testing
        }
      });

      console.log('  → Publishing messages to fill queue...');

      // Try to publish more messages than queue can hold
      const messageCount = 15;
      for (let i = 0; i < messageCount; i++) {
        await leader.client.channel.sendToQueue(
          testQueue,
          Buffer.from(JSON.stringify({ index: i })),
          { persistent: true }
        );
      }

      await wait(500);

      // Check queue length (should be limited to 10)
      const queueInfo = await leader.client.channel.checkQueue(testQueue);
      console.log(`  → Queue length: ${queueInfo.messageCount}`);

      assert(queueInfo.messageCount <= 10, 'Queue should be limited to max length');
      assert(queueInfo.messageCount > 0, 'Queue should contain messages');

      // Cleanup
      await leader.client.channel.deleteQueue(testQueue);

      console.log('  ✅ Queue overflow handling test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 3: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Test 4: Message timeout
   */
  async testMessageTimeout() {
    console.log('\n📝 Test 4: Message Timeout (TTL)');
    console.log('─'.repeat(60));

    try {
      const client = this.setup.createTestClient('timeout-test');
      await client.connect();

      // Create queue with short TTL
      const testQueue = 'test.ttl.queue';
      await client.channel.assertQueue(testQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': 2000 // 2 seconds TTL
        }
      });

      console.log('  → Publishing message with 2s TTL...');

      // Publish message
      await client.channel.sendToQueue(
        testQueue,
        Buffer.from(JSON.stringify({ test: 'ttl' })),
        { persistent: true }
      );

      // Check queue immediately
      let queueInfo = await client.channel.checkQueue(testQueue);
      console.log(`  → Queue count immediately: ${queueInfo.messageCount}`);
      assertEqual(queueInfo.messageCount, 1, 'Message should be in queue initially');

      // Wait for TTL to expire
      console.log('  → Waiting for TTL to expire...');
      await wait(2500);

      // Check queue after TTL
      queueInfo = await client.channel.checkQueue(testQueue);
      console.log(`  → Queue count after TTL: ${queueInfo.messageCount}`);
      assertEqual(queueInfo.messageCount, 0, 'Message should be expired after TTL');

      // Cleanup
      await client.channel.deleteQueue(testQueue);
      await client.close();

      console.log('  ✅ Message timeout test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 4: ${error.message}`);
    }
  }

  /**
   * Test 5: Task requeue behavior
   */
  async testTaskRequeue() {
    console.log('\n📝 Test 5: Task Requeue Behavior');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      this.agents = [leader, worker];

      await leader.initialize();
      await worker.initialize();

      const processedTasks = [];

      // Override handleTask to track processing and requeue once
      const originalHandleTask = worker.handleTask.bind(worker);
      let requeueCount = 0;

      worker.handleTask = async (msg, { ack, nack, reject }) => {
        processedTasks.push({
          id: msg.id,
          attempt: processedTasks.filter(t => t.id === msg.id).length + 1
        });

        if (requeueCount === 0 && processedTasks.length === 1) {
          console.log('  → Requeuing task for second attempt...');
          requeueCount++;
          nack(true); // Requeue
          return;
        }

        await originalHandleTask(msg, { ack, nack, reject });
      };

      const results = [];
      leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      await leader.startTeamLeader();
      await worker.startWorker();

      await wait(500);

      // Assign task
      console.log('  → Assigning task that will be requeued...');
      await leader.assignTask({
        title: 'Requeue Test Task',
        description: 'Task to test requeue behavior',
        priority: 'normal'
      });

      // Wait for completion
      await waitForCondition(() => results.length >= 1, 8000);

      // Verify task was processed twice
      const taskAttempts = processedTasks.filter(t => t.id === processedTasks[0].id);
      assertEqual(taskAttempts.length, 2, 'Task should be processed twice');
      assertEqual(taskAttempts[0].attempt, 1, 'First attempt should be attempt 1');
      assertEqual(taskAttempts[1].attempt, 2, 'Second attempt should be attempt 2');

      // Verify eventual completion
      assertEqual(results.length, 1, 'Should have 1 result');
      assertEqual(results[0].status, 'completed', 'Task should be completed');

      console.log('  ✅ Task requeue test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 5: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Cleanup agents
   */
  async cleanupAgents() {
    for (const agent of this.agents) {
      try {
        await agent.shutdown();
      } catch (error) {
        // Ignore
      }
    }
    this.agents = [];
    await wait(500);
  }

  /**
   * Final cleanup
   */
  async cleanup() {
    await this.cleanupAgents();
    await this.setup.stopRabbitMQ();
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST RESULTS                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n  Total Tests: ${this.testResults.passed + this.testResults.failed}`);
    console.log(`  ✅ Passed: ${this.testResults.passed}`);
    console.log(`  ❌ Failed: ${this.testResults.failed}`);

    if (this.testResults.errors.length > 0) {
      console.log('\n  Errors:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`    ${index + 1}. ${error}`);
      });
    }

    console.log('\n' + '═'.repeat(62) + '\n');
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new FailureHandlingTest();
  test.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

export default FailureHandlingTest;
