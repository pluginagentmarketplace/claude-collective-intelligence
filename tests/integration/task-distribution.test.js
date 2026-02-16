#!/usr/bin/env node
/**
 * Integration Test: Task Distribution
 * Tests complete task distribution flow:
 * - Leader assigns task
 * - Worker picks up task
 * - Worker processes task
 * - Worker reports result
 * - Leader receives result
 */

import AgentOrchestrator from '../../src/core/orchestrator.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';

class TaskDistributionTest {
  constructor() {
    this.setup = new TestSetup();
    this.leader = null;
    this.worker = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       INTEGRATION TEST: TASK DISTRIBUTION                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      // Setup RabbitMQ
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      // Run tests
      await this.testBasicTaskDistribution();
      await this.testPriorityTaskDistribution();
      await this.testMultipleTasksSequential();
      await this.testTaskWithContext();
      await this.testTaskAcknowledgement();

      // Print results
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
   * Test 1: Basic task distribution
   */
  async testBasicTaskDistribution() {
    console.log('\n📝 Test 1: Basic Task Distribution');
    console.log('─'.repeat(60));

    try {
      // Initialize agents
      this.leader = new AgentOrchestrator('leader');
      this.worker = new AgentOrchestrator('worker');

      await this.leader.initialize();
      await this.worker.initialize();

      // Setup leader to listen for results
      const resultReceived = new Promise((resolve) => {
        this.leader.handleResult = async (msg) => {
          resolve(msg.result);
        };
      });

      await this.leader.startTeamLeader();
      await this.worker.startWorker();

      // Give agents time to setup
      await wait(500);

      // Leader assigns a task
      console.log('  → Leader assigning task...');
      const taskId = await this.leader.assignTask({
        title: 'Test Task',
        description: 'Simple test task',
        priority: 'normal'
      });

      console.log(`  → Task assigned: ${taskId}`);

      // Wait for result (with timeout)
      const result = await Promise.race([
        resultReceived,
        wait(5000).then(() => null)
      ]);

      // Verify result
      assert(result !== null, 'Result should be received');
      assertEqual(result.taskId, taskId, 'Task ID should match');
      assertEqual(result.status, 'completed', 'Task should be completed');
      assert(result.processedBy === this.worker.agentId, 'Task should be processed by worker');
      assert(result.duration > 0, 'Duration should be positive');

      // Verify worker stats
      assertEqual(this.worker.stats.tasksReceived, 1, 'Worker should have received 1 task');
      assertEqual(this.worker.stats.tasksCompleted, 1, 'Worker should have completed 1 task');
      assertEqual(this.worker.stats.tasksFailed, 0, 'Worker should have 0 failed tasks');

      console.log('  ✅ Basic task distribution test passed');
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
   * Test 2: Priority task distribution
   */
  async testPriorityTaskDistribution() {
    console.log('\n📝 Test 2: Priority Task Distribution');
    console.log('─'.repeat(60));

    try {
      this.leader = new AgentOrchestrator('leader');
      this.worker = new AgentOrchestrator('worker');

      await this.leader.initialize();
      await this.worker.initialize();

      const results = [];
      this.leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      await this.leader.startTeamLeader();
      await this.worker.startWorker();

      await wait(500);

      // Assign multiple tasks with different priorities
      console.log('  → Assigning tasks with different priorities...');
      const task1 = await this.leader.assignTask({
        title: 'Low Priority Task',
        description: 'Low priority test',
        priority: 'low'
      });

      const task2 = await this.leader.assignTask({
        title: 'High Priority Task',
        description: 'High priority test',
        priority: 'high'
      });

      const task3 = await this.leader.assignTask({
        title: 'Normal Priority Task',
        description: 'Normal priority test',
        priority: 'normal'
      });

      console.log(`  → Tasks assigned: ${task1}, ${task2}, ${task3}`);

      // Wait for all results
      await waitForCondition(() => results.length === 3, 10000);

      // Verify all tasks completed
      assertEqual(results.length, 3, 'All 3 tasks should be completed');

      console.log('  ✅ Priority task distribution test passed');
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
   * Test 3: Multiple tasks sequential processing
   */
  async testMultipleTasksSequential() {
    console.log('\n📝 Test 3: Multiple Tasks Sequential Processing');
    console.log('─'.repeat(60));

    try {
      this.leader = new AgentOrchestrator('leader');
      this.worker = new AgentOrchestrator('worker');

      await this.leader.initialize();
      await this.worker.initialize();

      const results = [];
      this.leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      await this.leader.startTeamLeader();
      await this.worker.startWorker();

      await wait(500);

      const taskCount = 5;
      console.log(`  → Assigning ${taskCount} tasks sequentially...`);

      const taskIds = [];
      for (let i = 0; i < taskCount; i++) {
        const taskId = await this.leader.assignTask({
          title: `Sequential Task ${i + 1}`,
          description: `Task number ${i + 1}`,
          priority: 'normal'
        });
        taskIds.push(taskId);
      }

      console.log(`  → ${taskCount} tasks assigned`);

      // Wait for all results
      await waitForCondition(() => results.length === taskCount, 15000);

      // Verify all tasks completed
      assertEqual(results.length, taskCount, `All ${taskCount} tasks should be completed`);
      assertEqual(this.worker.stats.tasksCompleted, taskCount, `Worker should have completed ${taskCount} tasks`);

      // Verify all task IDs are present
      const resultTaskIds = results.map(r => r.taskId).sort();
      const expectedTaskIds = taskIds.sort();
      assertEqual(
        JSON.stringify(resultTaskIds),
        JSON.stringify(expectedTaskIds),
        'All task IDs should be present in results'
      );

      console.log('  ✅ Multiple tasks sequential processing test passed');
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
   * Test 4: Task with context data
   */
  async testTaskWithContext() {
    console.log('\n📝 Test 4: Task with Context Data');
    console.log('─'.repeat(60));

    try {
      this.leader = new AgentOrchestrator('leader');
      this.worker = new AgentOrchestrator('worker');

      await this.leader.initialize();
      await this.worker.initialize();

      const resultReceived = new Promise((resolve) => {
        this.leader.handleResult = async (msg) => {
          resolve(msg.result);
        };
      });

      await this.leader.startTeamLeader();
      await this.worker.startWorker();

      await wait(500);

      // Assign task with context
      const contextData = {
        userId: 'user-123',
        timestamp: Date.now(),
        metadata: {
          source: 'integration-test',
          version: '1.0.0'
        }
      };

      console.log('  → Assigning task with context data...');
      const taskId = await this.leader.assignTask({
        title: 'Task with Context',
        description: 'Task containing context data',
        priority: 'normal',
        context: contextData
      });

      const result = await Promise.race([
        resultReceived,
        wait(5000).then(() => null)
      ]);

      assert(result !== null, 'Result should be received');
      assertEqual(result.status, 'completed', 'Task should be completed');

      console.log('  ✅ Task with context data test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 4: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Test 5: Task acknowledgement and queue state
   */
  async testTaskAcknowledgement() {
    console.log('\n📝 Test 5: Task Acknowledgement and Queue State');
    console.log('─'.repeat(60));

    try {
      this.leader = new AgentOrchestrator('leader');
      this.worker = new AgentOrchestrator('worker');

      await this.leader.initialize();
      await this.worker.initialize();

      const results = [];
      this.leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      await this.leader.startTeamLeader();
      await this.worker.startWorker();

      await wait(500);

      // Check initial queue state
      const initialCount = await this.setup.getQueueMessageCount('agent.tasks');
      console.log(`  → Initial queue count: ${initialCount}`);

      // Assign task
      console.log('  → Assigning task...');
      await this.leader.assignTask({
        title: 'Acknowledgement Test Task',
        description: 'Test task acknowledgement',
        priority: 'normal'
      });

      // Wait a bit for task to be queued
      await wait(100);

      // Check queue after assignment (might be 0 or 1 depending on timing)
      const afterAssignCount = await this.setup.getQueueMessageCount('agent.tasks');
      console.log(`  → Queue count after assignment: ${afterAssignCount}`);

      // Wait for task to be processed
      await waitForCondition(() => results.length === 1, 5000);

      // Wait a bit for queue to update
      await wait(200);

      // Check final queue state (should be 0 after acknowledgement)
      const finalCount = await this.setup.getQueueMessageCount('agent.tasks');
      console.log(`  → Final queue count: ${finalCount}`);

      assertEqual(finalCount, 0, 'Queue should be empty after acknowledgement');
      assertEqual(results.length, 1, 'Should have received 1 result');

      console.log('  ✅ Task acknowledgement test passed');
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
    if (this.leader) {
      try {
        await this.leader.shutdown();
      } catch (error) {
        // Ignore
      }
      this.leader = null;
    }

    if (this.worker) {
      try {
        await this.worker.shutdown();
      } catch (error) {
        // Ignore
      }
      this.worker = null;
    }

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
  const test = new TaskDistributionTest();
  test.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

export default TaskDistributionTest;
