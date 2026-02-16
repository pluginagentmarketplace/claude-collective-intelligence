#!/usr/bin/env node
/**
 * Integration Test: Monitoring
 * Tests monitoring features:
 * - Status updates
 * - Health checks
 * - Metrics collection
 * - Alert generation
 */

import AgentOrchestrator from '../../src/core/orchestrator.js';
import MonitorDashboard from '../../src/core/monitor.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';

class MonitoringTest {
  constructor() {
    this.setup = new TestSetup();
    this.agents = [];
    this.monitor = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║           INTEGRATION TEST: MONITORING                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      await this.testStatusUpdates();
      await this.testHealthChecks();
      await this.testMetricsCollection();
      await this.testAlertGeneration();
      await this.testMonitorDashboard();

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
   * Test 1: Status updates
   */
  async testStatusUpdates() {
    console.log('\n📝 Test 1: Status Updates');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      this.agents = [leader, worker];

      await leader.initialize();
      await worker.initialize();

      // Track status updates
      const statusUpdates = [];
      leader.handleStatusUpdate = (msg) => {
        statusUpdates.push(msg.status);
      };

      await leader.startTeamLeader();
      await worker.startWorker();

      await wait(500);

      // Verify connection status
      const connectedStatus = statusUpdates.find(
        s => s.state === 'connected' && s.agentId === worker.agentId
      );
      assert(connectedStatus, 'Should receive worker connected status');

      console.log('  → Assigning task to generate status updates...');

      // Assign task to generate more status updates
      await leader.assignTask({
        title: 'Status Test Task',
        description: 'Task to generate status updates',
        priority: 'normal'
      });

      // Wait for task-related status updates
      await waitForCondition(
        () => statusUpdates.some(s => s.event === 'task_started'),
        5000
      );

      // Verify different status types
      const statusEvents = statusUpdates.map(s => s.event || s.state);
      console.log(`  → Status events received: ${statusEvents.join(', ')}`);

      assert(
        statusUpdates.some(s => s.event === 'task_started' || s.event === 'task_assigned'),
        'Should have task-related status updates'
      );

      console.log('  ✅ Status updates test passed');
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
   * Test 2: Health checks
   */
  async testHealthChecks() {
    console.log('\n📝 Test 2: Health Checks');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      this.agents = [leader, worker];

      await leader.initialize();
      await worker.initialize();

      await leader.startTeamLeader();
      await worker.startWorker();

      await wait(500);

      // Check health of all agents
      console.log('  → Checking agent health...');

      assert(leader.client.isHealthy(), 'Leader should be healthy');
      assert(worker.client.isHealthy(), 'Worker should be healthy');

      console.log('  → All agents healthy ✓');

      // Test unhealthy state
      console.log('  → Testing unhealthy state...');
      await worker.client.close();

      await wait(500);

      assertEqual(worker.client.isHealthy(), false, 'Worker should be unhealthy after disconnect');

      console.log('  → Unhealthy state detected ✓');

      console.log('  ✅ Health checks test passed');
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
   * Test 3: Metrics collection
   */
  async testMetricsCollection() {
    console.log('\n📝 Test 3: Metrics Collection');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      this.agents = [leader, worker];

      await leader.initialize();
      await worker.initialize();

      const results = [];
      leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      await leader.startTeamLeader();
      await worker.startWorker();

      await wait(500);

      // Check initial stats
      const initialStats = worker.getStats();
      console.log('  → Initial worker stats:', JSON.stringify(initialStats, null, 2));

      assertEqual(initialStats.tasksReceived, 0, 'Initial tasks received should be 0');
      assertEqual(initialStats.tasksCompleted, 0, 'Initial tasks completed should be 0');

      // Assign tasks to generate metrics
      console.log('  → Assigning tasks to generate metrics...');
      const taskCount = 5;

      for (let i = 0; i < taskCount; i++) {
        await leader.assignTask({
          title: `Metrics Task ${i + 1}`,
          description: 'Task for metrics collection',
          priority: 'normal'
        });
      }

      // Wait for completion
      await waitForCondition(() => results.length === taskCount, 15000);

      // Check updated stats
      const finalStats = worker.getStats();
      console.log('  → Final worker stats:', JSON.stringify(finalStats, null, 2));

      assertEqual(finalStats.tasksReceived, taskCount, `Should have received ${taskCount} tasks`);
      assertEqual(finalStats.tasksCompleted, taskCount, `Should have completed ${taskCount} tasks`);
      assertEqual(finalStats.tasksFailed, 0, 'Should have 0 failed tasks');
      assertEqual(finalStats.resultsPublished, taskCount, `Should have published ${taskCount} results`);

      // Verify stats structure
      assert(typeof finalStats.activeTasks === 'number', 'Should have activeTasks metric');
      assert(typeof finalStats.activeBrainstorms === 'number', 'Should have activeBrainstorms metric');
      assert(typeof finalStats.totalResults === 'number', 'Should have totalResults metric');

      console.log('  ✅ Metrics collection test passed');
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
   * Test 4: Alert generation
   */
  async testAlertGeneration() {
    console.log('\n📝 Test 4: Alert Generation');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      this.agents = [leader, worker];

      await leader.initialize();
      await worker.initialize();

      // Track status updates for alerts
      const alerts = [];
      leader.handleStatusUpdate = (msg) => {
        const status = msg.status;
        if (status.event === 'task_failed') {
          alerts.push({
            type: 'task_failed',
            agentId: status.agentId,
            task: status.task,
            error: status.error,
            timestamp: Date.now()
          });
        }
      };

      await leader.startTeamLeader();

      // Override worker to fail a task
      const originalHandleTask = worker.handleTask.bind(worker);
      worker.handleTask = async (msg, { ack, nack, reject }) => {
        // Simulate failure
        console.log('  → Simulating task failure...');

        worker.stats.tasksFailed++;

        await worker.publishStatus({
          event: 'task_failed',
          taskId: msg.id,
          task: msg.task.title,
          error: 'Simulated failure for alert test'
        }, 'agent.status.task.failed');

        reject(); // Reject task
      };

      await worker.startWorker();

      await wait(500);

      // Assign task that will fail
      console.log('  → Assigning task that will fail...');
      await leader.assignTask({
        title: 'Alert Test Task',
        description: 'Task that will fail to generate alert',
        priority: 'normal'
      });

      // Wait for alert
      await waitForCondition(() => alerts.length > 0, 5000);

      // Verify alert
      assert(alerts.length > 0, 'Should generate alert for failed task');

      const alert = alerts[0];
      assertEqual(alert.type, 'task_failed', 'Alert type should be task_failed');
      assertEqual(alert.agentId, worker.agentId, 'Alert should be from worker');
      assert(alert.error, 'Alert should contain error message');

      console.log('  → Alert generated:', JSON.stringify(alert, null, 2));

      console.log('  ✅ Alert generation test passed');
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
   * Test 5: Monitor dashboard integration
   */
  async testMonitorDashboard() {
    console.log('\n📝 Test 5: Monitor Dashboard Integration');
    console.log('─'.repeat(60));

    try {
      // Create monitor dashboard
      this.monitor = new MonitorDashboard();

      // Override displayDashboard to prevent clearing console during tests
      this.monitor.displayDashboard = () => {
        // No-op during tests
      };

      await this.monitor.start();

      // Create agents
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      this.agents = [leader, worker];

      await leader.initialize();
      await worker.initialize();

      const results = [];
      leader.handleResult = async (msg) => {
        results.push(msg.result);
      };

      await leader.startTeamLeader();
      await worker.startWorker();

      await wait(1000);

      // Verify monitor captured agent connections
      assert(
        this.monitor.metrics.agents.size > 0,
        'Monitor should track connected agents'
      );

      console.log(`  → Monitor tracking ${this.monitor.metrics.agents.size} agents`);

      // Assign tasks to generate metrics
      console.log('  → Assigning tasks for monitoring...');

      for (let i = 0; i < 3; i++) {
        await leader.assignTask({
          title: `Monitor Task ${i + 1}`,
          description: 'Task for monitor dashboard',
          priority: 'normal'
        });
      }

      // Wait for tasks to complete
      await waitForCondition(() => results.length === 3, 10000);

      // Wait a bit for monitor to update
      await wait(500);

      // Verify monitor metrics
      const metrics = this.monitor.metrics;

      console.log('  → Monitor metrics:', {
        agents: metrics.agents.size,
        tasksCompleted: metrics.tasks.completed,
        tasksFailed: metrics.tasks.failed
      });

      assert(metrics.tasks.completed >= 3, 'Monitor should track completed tasks');

      // Verify agent tracking
      const trackedAgents = Array.from(metrics.agents.values());
      const connectedAgents = trackedAgents.filter(a => a.state === 'connected');

      console.log(`  → Connected agents in monitor: ${connectedAgents.length}`);
      assert(connectedAgents.length >= 1, 'Monitor should track connected agents');

      console.log('  ✅ Monitor dashboard integration test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 5: ${error.message}`);
    } finally {
      if (this.monitor) {
        try {
          await this.monitor.shutdown();
        } catch (error) {
          // Ignore
        }
        this.monitor = null;
      }
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
    if (this.monitor) {
      try {
        await this.monitor.shutdown();
      } catch (error) {
        // Ignore
      }
      this.monitor = null;
    }
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
  const test = new MonitoringTest();
  test.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

export default MonitoringTest;
