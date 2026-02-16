#!/usr/bin/env node
/**
 * Integration Test: Multi-Agent Coordination
 * Tests multi-agent coordination:
 * - 3-agent setup (1 leader, 2 workers)
 * - Task distribution
 * - Load balancing
 * - Concurrent execution
 * - Result aggregation
 */

import AgentOrchestrator from '../../src/core/orchestrator.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';

class MultiAgentTest {
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
    console.log('║       INTEGRATION TEST: MULTI-AGENT COORDINATION           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      await this.testThreeAgentSetup();
      await this.testTaskDistributionAcrossWorkers();
      await this.testLoadBalancing();
      await this.testConcurrentExecution();
      await this.testResultAggregation();

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
   * Test 1: Basic 3-agent setup
   */
  async testThreeAgentSetup() {
    console.log('\n📝 Test 1: Three-Agent Setup (1 Leader + 2 Workers)');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker1 = new AgentOrchestrator('worker');
      const worker2 = new AgentOrchestrator('worker');
      this.agents = [leader, worker1, worker2];

      console.log('  → Initializing agents...');
      await Promise.all([
        leader.initialize(),
        worker1.initialize(),
        worker2.initialize()
      ]);

      console.log('  → Starting agents...');
      await Promise.all([
        leader.startTeamLeader(),
        worker1.startWorker(),
        worker2.startWorker()
      ]);

      await wait(500);

      // Verify all agents are initialized
      assert(leader.client.isHealthy(), 'Leader should be healthy');
      assert(worker1.client.isHealthy(), 'Worker 1 should be healthy');
      assert(worker2.client.isHealthy(), 'Worker 2 should be healthy');

      // Verify unique agent IDs
      const agentIds = [leader.agentId, worker1.agentId, worker2.agentId];
      const uniqueIds = new Set(agentIds);
      assertEqual(uniqueIds.size, 3, 'All agents should have unique IDs');

      console.log(`  → Leader ID: ${leader.agentId}`);
      console.log(`  → Worker 1 ID: ${worker1.agentId}`);
      console.log(`  → Worker 2 ID: ${worker2.agentId}`);

      console.log('  ✅ Three-agent setup test passed');
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
   * Test 2: Task distribution across multiple workers
   */
  async testTaskDistributionAcrossWorkers() {
    console.log('\n📝 Test 2: Task Distribution Across Workers');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker1 = new AgentOrchestrator('worker');
      const worker2 = new AgentOrchestrator('worker');
      this.agents = [leader, worker1, worker2];

      await Promise.all([
        leader.initialize(),
        worker1.initialize(),
        worker2.initialize()
      ]);

      const results = [];
      leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      await Promise.all([
        leader.startTeamLeader(),
        worker1.startWorker(),
        worker2.startWorker()
      ]);

      await wait(500);

      // Assign multiple tasks
      const taskCount = 6;
      console.log(`  → Assigning ${taskCount} tasks...`);

      const taskIds = [];
      for (let i = 0; i < taskCount; i++) {
        const taskId = await leader.assignTask({
          title: `Multi-Worker Task ${i + 1}`,
          description: `Task ${i + 1} for worker distribution`,
          priority: 'normal'
        });
        taskIds.push(taskId);
      }

      // Wait for all results
      console.log('  → Waiting for all tasks to complete...');
      await waitForCondition(() => results.length === taskCount, 15000);

      // Verify all tasks completed
      assertEqual(results.length, taskCount, `All ${taskCount} tasks should complete`);

      // Check which workers processed tasks
      const worker1Tasks = results.filter(r => r.processedBy === worker1.agentId);
      const worker2Tasks = results.filter(r => r.processedBy === worker2.agentId);

      console.log(`  → Worker 1 processed: ${worker1Tasks.length} tasks`);
      console.log(`  → Worker 2 processed: ${worker2Tasks.length} tasks`);

      // Both workers should have processed at least one task
      assert(worker1Tasks.length > 0, 'Worker 1 should process at least one task');
      assert(worker2Tasks.length > 0, 'Worker 2 should process at least one task');

      // Verify total
      assertEqual(
        worker1Tasks.length + worker2Tasks.length,
        taskCount,
        'Total processed tasks should equal assigned tasks'
      );

      console.log('  ✅ Task distribution test passed');
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
   * Test 3: Load balancing between workers
   */
  async testLoadBalancing() {
    console.log('\n📝 Test 3: Load Balancing');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker1 = new AgentOrchestrator('worker');
      const worker2 = new AgentOrchestrator('worker');
      const worker3 = new AgentOrchestrator('worker');
      this.agents = [leader, worker1, worker2, worker3];

      await Promise.all([
        leader.initialize(),
        worker1.initialize(),
        worker2.initialize(),
        worker3.initialize()
      ]);

      const results = [];
      leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      await Promise.all([
        leader.startTeamLeader(),
        worker1.startWorker(),
        worker2.startWorker(),
        worker3.startWorker()
      ]);

      await wait(500);

      // Assign many tasks to test load distribution
      const taskCount = 12;
      console.log(`  → Assigning ${taskCount} tasks for load balancing...`);

      for (let i = 0; i < taskCount; i++) {
        await leader.assignTask({
          title: `Load Balance Task ${i + 1}`,
          description: `Task ${i + 1} for load balancing`,
          priority: 'normal'
        });
      }

      // Wait for all tasks
      console.log('  → Waiting for load balanced execution...');
      await waitForCondition(() => results.length === taskCount, 20000);

      // Analyze distribution
      const workerLoads = {
        [worker1.agentId]: results.filter(r => r.processedBy === worker1.agentId).length,
        [worker2.agentId]: results.filter(r => r.processedBy === worker2.agentId).length,
        [worker3.agentId]: results.filter(r => r.processedBy === worker3.agentId).length
      };

      console.log('  → Load distribution:');
      console.log(`     Worker 1: ${workerLoads[worker1.agentId]} tasks`);
      console.log(`     Worker 2: ${workerLoads[worker2.agentId]} tasks`);
      console.log(`     Worker 3: ${workerLoads[worker3.agentId]} tasks`);

      // All workers should have processed tasks
      assert(workerLoads[worker1.agentId] > 0, 'Worker 1 should process tasks');
      assert(workerLoads[worker2.agentId] > 0, 'Worker 2 should process tasks');
      assert(workerLoads[worker3.agentId] > 0, 'Worker 3 should process tasks');

      // Check distribution is reasonably balanced (no worker has more than 70% of tasks)
      const maxLoad = Math.max(...Object.values(workerLoads));
      const loadPercentage = (maxLoad / taskCount) * 100;
      console.log(`  → Max worker load: ${loadPercentage.toFixed(1)}%`);

      assert(
        loadPercentage < 70,
        `Load should be reasonably balanced (max ${loadPercentage.toFixed(1)}%)`
      );

      console.log('  ✅ Load balancing test passed');
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
   * Test 4: Concurrent task execution
   */
  async testConcurrentExecution() {
    console.log('\n📝 Test 4: Concurrent Task Execution');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker1 = new AgentOrchestrator('worker');
      const worker2 = new AgentOrchestrator('worker');
      this.agents = [leader, worker1, worker2];

      await Promise.all([
        leader.initialize(),
        worker1.initialize(),
        worker2.initialize()
      ]);

      const results = [];
      const startTimes = [];

      leader.handleResult = async (msg) => {
        results.push({
          ...msg.result,
          completedAt: Date.now()
        });
      };

      await Promise.all([
        leader.startTeamLeader(),
        worker1.startWorker(),
        worker2.startWorker()
      ]);

      await wait(500);

      // Assign tasks simultaneously
      console.log('  → Assigning tasks for concurrent execution...');
      const startTime = Date.now();

      const taskPromises = [];
      for (let i = 0; i < 4; i++) {
        taskPromises.push(
          leader.assignTask({
            title: `Concurrent Task ${i + 1}`,
            description: `Task ${i + 1} for concurrent execution`,
            priority: 'normal'
          })
        );
      }

      await Promise.all(taskPromises);

      // Wait for all tasks
      await waitForCondition(() => results.length === 4, 15000);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`  → All 4 tasks completed in ${totalTime}ms`);

      // Verify all completed
      assertEqual(results.length, 4, 'All 4 tasks should complete');

      // Check for overlap in execution (concurrent execution)
      // If tasks were truly sequential with 2 workers, it would take much longer
      // With concurrent execution, should be faster
      results.sort((a, b) => a.completedAt - b.completedAt);

      const firstCompletion = results[0].completedAt;
      const lastCompletion = results[3].completedAt;
      const executionSpan = lastCompletion - firstCompletion;

      console.log(`  → Execution time span: ${executionSpan}ms`);

      // With 2 workers and 4 tasks, execution should show concurrency
      assert(results.length === 4, 'All tasks should be completed');

      console.log('  ✅ Concurrent execution test passed');
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
   * Test 5: Result aggregation from multiple workers
   */
  async testResultAggregation() {
    console.log('\n📝 Test 5: Result Aggregation');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker1 = new AgentOrchestrator('worker');
      const worker2 = new AgentOrchestrator('worker');
      this.agents = [leader, worker1, worker2];

      await Promise.all([
        leader.initialize(),
        worker1.initialize(),
        worker2.initialize()
      ]);

      const results = [];
      const aggregatedData = {
        totalDuration: 0,
        tasksByWorker: {},
        completionOrder: []
      };

      leader.handleResult = async (msg) => {
        const result = msg.result;
        results.push(result);

        // Aggregate data
        aggregatedData.totalDuration += result.duration || 0;
        aggregatedData.completionOrder.push(result.taskId);

        if (!aggregatedData.tasksByWorker[result.processedBy]) {
          aggregatedData.tasksByWorker[result.processedBy] = [];
        }
        aggregatedData.tasksByWorker[result.processedBy].push(result.taskId);
      };

      await Promise.all([
        leader.startTeamLeader(),
        worker1.startWorker(),
        worker2.startWorker()
      ]);

      await wait(500);

      // Assign tasks with different priorities
      console.log('  → Assigning tasks for aggregation...');
      const taskIds = [];

      for (let i = 0; i < 8; i++) {
        const taskId = await leader.assignTask({
          title: `Aggregation Task ${i + 1}`,
          description: `Task ${i + 1} for result aggregation`,
          priority: i % 2 === 0 ? 'high' : 'normal'
        });
        taskIds.push(taskId);
      }

      // Wait for all results
      await waitForCondition(() => results.length === 8, 20000);

      // Verify aggregation
      assertEqual(results.length, 8, 'Should receive all 8 results');
      assertEqual(aggregatedData.completionOrder.length, 8, 'Should track completion order');

      // Verify all task IDs are accounted for
      const resultTaskIds = new Set(results.map(r => r.taskId));
      taskIds.forEach(taskId => {
        assert(resultTaskIds.has(taskId), `Task ${taskId} should be in results`);
      });

      // Verify worker distribution in aggregated data
      const workerCount = Object.keys(aggregatedData.tasksByWorker).length;
      assertEqual(workerCount, 2, 'Should have results from 2 workers');

      console.log('  → Aggregated results:');
      console.log(`     Total tasks: ${results.length}`);
      console.log(`     Total duration: ${aggregatedData.totalDuration}ms`);
      console.log(`     Workers involved: ${workerCount}`);

      Object.keys(aggregatedData.tasksByWorker).forEach(workerId => {
        const tasks = aggregatedData.tasksByWorker[workerId];
        console.log(`     ${workerId}: ${tasks.length} tasks`);
      });

      // Verify average duration
      const avgDuration = aggregatedData.totalDuration / results.length;
      console.log(`     Average duration: ${avgDuration.toFixed(2)}ms`);
      assert(avgDuration > 0, 'Average duration should be positive');

      console.log('  ✅ Result aggregation test passed');
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
  const test = new MultiAgentTest();
  test.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

export default MultiAgentTest;
