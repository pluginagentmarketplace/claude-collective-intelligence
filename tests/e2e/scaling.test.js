#!/usr/bin/env node
/**
 * E2E Test: Scaling Scenarios
 *
 * Tests system scalability and load balancing:
 * - Start with 2 workers
 * - Add 3 more workers dynamically
 * - Verify load balancing across all workers
 * - Remove workers dynamically
 * - Verify rebalancing
 * - Test performance under different scales
 */

import { strict as assert } from 'assert';
import AgentOrchestrator from '../../scripts/orchestrator.js';
import { performance } from 'perf_hooks';

// Test configuration
const TEST_CONFIG = {
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  INITIAL_WORKERS: 2,
  ADDITIONAL_WORKERS: 3,
  TASKS_PER_SCALE_TEST: 10,
  TASK_TIMEOUT: 60000
};

// Test state
const testState = {
  leader: null,
  workers: [],
  tasks: [],
  results: [],
  metrics: {
    workerStartupTimes: [],
    taskDistribution: new Map(),
    loadBalancingScore: 0,
    throughput: {
      twoWorkers: 0,
      fiveWorkers: 0
    },
    latency: {
      twoWorkers: [],
      fiveWorkers: []
    },
    scalingTime: {
      scaleUp: 0,
      scaleDown: 0
    }
  }
};

/**
 * Test utilities
 */
class ScalingHelpers {
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static measureTime(startTime) {
    return performance.now() - startTime;
  }

  static async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await this.delay(interval);
    }
    throw new Error('Timeout waiting for condition');
  }

  static calculateLoadBalancingScore(distribution) {
    // Calculate variance to measure how evenly tasks are distributed
    const values = Array.from(distribution.values());
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = better load balancing
    // Score: 100 = perfect, 0 = poor
    const maxStdDev = mean; // Worst case: all tasks on one worker
    const score = Math.max(0, 100 - (stdDev / maxStdDev) * 100);

    return score;
  }

  static calculateThroughput(taskCount, durationMs) {
    // Tasks per second
    return (taskCount / durationMs) * 1000;
  }

  static calculateAverageLatency(latencies) {
    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }
}

/**
 * Setup: Start team leader
 */
async function setupLeader() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  E2E TEST: Scaling Scenarios');
  console.log('═══════════════════════════════════════════\n');

  console.log('🚀 Starting Team Leader...');
  testState.leader = new AgentOrchestrator('team-leader');
  testState.leader.agentName = 'Scaling-Test-Leader';

  await testState.leader.initialize();
  await testState.leader.startTeamLeader();

  console.log('✅ Team Leader started\n');

  // Setup result tracking
  const originalHandleResult = testState.leader.handleResult.bind(testState.leader);
  testState.leader.handleResult = async (msg) => {
    testState.results.push({
      ...msg.result,
      receivedAt: Date.now()
    });

    // Track task distribution per worker
    const workerId = msg.result.processedBy;
    if (workerId) {
      const current = testState.metrics.taskDistribution.get(workerId) || 0;
      testState.metrics.taskDistribution.set(workerId, current + 1);
    }

    await originalHandleResult(msg);
  };

  return testState.leader;
}

/**
 * Start workers
 */
async function startWorkers(count, startIndex = 0) {
  console.log(`🚀 Starting ${count} worker(s)...\n`);

  const workers = [];
  for (let i = 0; i < count; i++) {
    const workerNum = startIndex + i + 1;
    const startTime = performance.now();

    const worker = new AgentOrchestrator('worker');
    worker.agentName = `Scaling-Worker-${workerNum}`;

    await worker.initialize();
    await worker.startWorker();

    const startupTime = ScalingHelpers.measureTime(startTime);
    testState.metrics.workerStartupTimes.push(startupTime);

    workers.push(worker);
    testState.workers.push(worker);

    console.log(`✅ Worker ${workerNum} started (${startupTime.toFixed(2)}ms)`);
  }

  console.log(`\n✅ All ${count} worker(s) ready\n`);
  return workers;
}

/**
 * Stop workers
 */
async function stopWorkers(workers) {
  console.log(`🛑 Stopping ${workers.length} worker(s)...\n`);

  for (const worker of workers) {
    try {
      console.log(`   Stopping ${worker.agentName}...`);
      await worker.shutdown();
      testState.workers = testState.workers.filter(w => w !== worker);
    } catch (error) {
      console.error(`   ⚠️  Error stopping ${worker.agentName}:`, error.message);
    }
  }

  console.log(`✅ Workers stopped\n`);
}

/**
 * Assign tasks
 */
async function assignTasks(count, testPhase) {
  console.log(`📋 Assigning ${count} tasks for ${testPhase}...\n`);

  const taskIds = [];
  const startTime = performance.now();

  for (let i = 0; i < count; i++) {
    const taskId = await testState.leader.assignTask({
      title: `Scaling Test Task ${i + 1}`,
      description: `Task for ${testPhase} - ${i + 1}/${count}`,
      priority: 'normal',
      testPhase,
      assignedAt: Date.now()
    });

    taskIds.push(taskId);
    testState.tasks.push({
      id: taskId,
      phase: testPhase,
      assignedAt: Date.now()
    });

    console.log(`   ✅ Task ${i + 1}/${count} assigned`);
  }

  const assignmentTime = ScalingHelpers.measureTime(startTime);
  console.log(`\n📤 ${count} tasks assigned in ${assignmentTime.toFixed(2)}ms\n`);

  return taskIds;
}

/**
 * Wait for task completion
 */
async function waitForTaskCompletion(taskIds, phase) {
  console.log(`⏳ Waiting for ${taskIds.length} tasks to complete...\n`);

  const startTime = performance.now();
  const timeout = TEST_CONFIG.TASK_TIMEOUT;
  const checkInterval = 500;

  while (true) {
    const completedCount = testState.results.filter(r =>
      taskIds.includes(r.taskId) && r.status === 'completed'
    ).length;

    if (completedCount === taskIds.length) {
      const duration = ScalingHelpers.measureTime(startTime);
      console.log(`✅ All ${taskIds.length} tasks completed in ${duration.toFixed(2)}ms\n`);

      // Calculate metrics
      const throughput = ScalingHelpers.calculateThroughput(taskIds.length, duration);
      const latencies = testState.results
        .filter(r => taskIds.includes(r.taskId))
        .map(r => r.duration || 0);

      console.log(`📊 Phase "${phase}" Metrics:`);
      console.log(`   - Throughput: ${throughput.toFixed(2)} tasks/sec`);
      console.log(`   - Avg latency: ${ScalingHelpers.calculateAverageLatency(latencies).toFixed(2)}ms`);
      console.log(`   - Total time: ${duration.toFixed(2)}ms\n`);

      return { throughput, latencies, duration };
    }

    if (ScalingHelpers.measureTime(startTime) > timeout) {
      console.log(`⚠️  Timeout: ${completedCount}/${taskIds.length} completed\n`);
      break;
    }

    await ScalingHelpers.delay(checkInterval);
  }

  return null;
}

/**
 * Test: Initial scale with 2 workers
 */
async function testInitialScale() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Initial Scale (2 Workers)');
  console.log('───────────────────────────────────────────\n');

  // Start initial workers
  await startWorkers(TEST_CONFIG.INITIAL_WORKERS);

  assert.equal(testState.workers.length, TEST_CONFIG.INITIAL_WORKERS,
    'Should have correct number of initial workers');

  // Assign and process tasks
  const taskIds = await assignTasks(TEST_CONFIG.TASKS_PER_SCALE_TEST, 'initial-2-workers');
  const metrics = await waitForTaskCompletion(taskIds, 'initial-2-workers');

  if (metrics) {
    testState.metrics.throughput.twoWorkers = metrics.throughput;
    testState.metrics.latency.twoWorkers = metrics.latencies;
  }

  console.log('✅ Initial scale test completed\n');
  return metrics;
}

/**
 * Test: Scale up to 5 workers
 */
async function testScaleUp() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Scale Up (2 → 5 Workers)');
  console.log('───────────────────────────────────────────\n');

  const scaleStartTime = performance.now();

  console.log('📈 Scaling up: Adding 3 more workers...\n');

  // Add more workers dynamically
  await startWorkers(TEST_CONFIG.ADDITIONAL_WORKERS, TEST_CONFIG.INITIAL_WORKERS);

  testState.metrics.scalingTime.scaleUp = ScalingHelpers.measureTime(scaleStartTime);

  const totalWorkers = TEST_CONFIG.INITIAL_WORKERS + TEST_CONFIG.ADDITIONAL_WORKERS;
  assert.equal(testState.workers.length, totalWorkers, 'Should have scaled to 5 workers');

  console.log(`✅ Scaled up to ${testState.workers.length} workers in ${testState.metrics.scalingTime.scaleUp.toFixed(2)}ms\n`);

  // Wait a bit for workers to stabilize
  await ScalingHelpers.delay(2000);

  // Assign and process tasks with more workers
  const taskIds = await assignTasks(TEST_CONFIG.TASKS_PER_SCALE_TEST, 'scaled-5-workers');
  const metrics = await waitForTaskCompletion(taskIds, 'scaled-5-workers');

  if (metrics) {
    testState.metrics.throughput.fiveWorkers = metrics.throughput;
    testState.metrics.latency.fiveWorkers = metrics.latencies;
  }

  console.log('✅ Scale up test completed\n');
  return metrics;
}

/**
 * Test: Load balancing verification
 */
async function testLoadBalancing() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Load Balancing Verification');
  console.log('───────────────────────────────────────────\n');

  console.log('📊 Task Distribution Across Workers:\n');

  // Display distribution
  for (const [workerId, taskCount] of testState.metrics.taskDistribution) {
    const worker = testState.workers.find(w => w.agentId === workerId);
    const workerName = worker ? worker.agentName : workerId;
    console.log(`   ${workerName}: ${taskCount} tasks`);
  }

  console.log();

  // Calculate load balancing score
  testState.metrics.loadBalancingScore = ScalingHelpers.calculateLoadBalancingScore(
    testState.metrics.taskDistribution
  );

  console.log(`📈 Load Balancing Score: ${testState.metrics.loadBalancingScore.toFixed(2)}/100\n`);

  // Verify reasonable distribution
  const values = Array.from(testState.metrics.taskDistribution.values());
  const min = Math.min(...values);
  const max = Math.max(...values);
  const ratio = max / (min || 1);

  console.log(`📊 Distribution Analysis:`);
  console.log(`   - Min tasks per worker: ${min}`);
  console.log(`   - Max tasks per worker: ${max}`);
  console.log(`   - Max/Min ratio: ${ratio.toFixed(2)}`);
  console.log(`   - Ideal ratio: 1.0 (perfectly balanced)\n`);

  // Reasonable load balancing: max/min ratio should be < 3
  assert.ok(ratio < 3, 'Load should be reasonably balanced across workers');
  console.log('✅ Load balancing verified\n');

  return testState.metrics.loadBalancingScore;
}

/**
 * Test: Scale down
 */
async function testScaleDown() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Scale Down (5 → 2 Workers)');
  console.log('───────────────────────────────────────────\n');

  const scaleStartTime = performance.now();

  // Remove 3 workers
  const workersToRemove = testState.workers.slice(-3);
  console.log(`📉 Scaling down: Removing 3 workers...\n`);

  await stopWorkers(workersToRemove);

  testState.metrics.scalingTime.scaleDown = ScalingHelpers.measureTime(scaleStartTime);

  assert.equal(testState.workers.length, TEST_CONFIG.INITIAL_WORKERS,
    'Should scale down to initial worker count');

  console.log(`✅ Scaled down to ${testState.workers.length} workers in ${testState.metrics.scalingTime.scaleDown.toFixed(2)}ms\n`);

  // Wait for system to stabilize
  await ScalingHelpers.delay(2000);

  // Verify remaining workers can still process tasks
  console.log('🔍 Verifying remaining workers functionality...\n');

  const taskIds = await assignTasks(5, 'scaled-down-2-workers');
  await waitForTaskCompletion(taskIds, 'scaled-down-2-workers');

  console.log('✅ Scale down test completed\n');
  return testState.workers.length;
}

/**
 * Test: Rebalancing after scale changes
 */
async function testRebalancing() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Rebalancing After Scale Changes');
  console.log('───────────────────────────────────────────\n');

  // Clear previous distribution
  testState.metrics.taskDistribution.clear();

  // Assign new tasks
  const taskIds = await assignTasks(10, 'rebalancing-test');
  await waitForTaskCompletion(taskIds, 'rebalancing-test');

  // Check new distribution
  console.log('📊 New Task Distribution:\n');

  for (const [workerId, taskCount] of testState.metrics.taskDistribution) {
    const worker = testState.workers.find(w => w.agentId === workerId);
    const workerName = worker ? worker.agentName : workerId;
    console.log(`   ${workerName}: ${taskCount} tasks`);
  }

  console.log();

  // Verify only active workers received tasks
  const activeWorkerIds = testState.workers.map(w => w.agentId);
  for (const workerId of testState.metrics.taskDistribution.keys()) {
    assert.ok(
      activeWorkerIds.includes(workerId),
      'Only active workers should receive tasks'
    );
  }

  console.log('✅ Rebalancing verified - tasks only assigned to active workers\n');
  return true;
}

/**
 * Test: Performance comparison
 */
function testPerformanceComparison() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Performance Comparison');
  console.log('───────────────────────────────────────────\n');

  console.log('📊 Performance Summary:\n');

  console.log('🔹 With 2 Workers:');
  console.log(`   - Throughput: ${testState.metrics.throughput.twoWorkers.toFixed(2)} tasks/sec`);
  console.log(`   - Avg Latency: ${ScalingHelpers.calculateAverageLatency(testState.metrics.latency.twoWorkers).toFixed(2)}ms\n`);

  console.log('🔹 With 5 Workers:');
  console.log(`   - Throughput: ${testState.metrics.throughput.fiveWorkers.toFixed(2)} tasks/sec`);
  console.log(`   - Avg Latency: ${ScalingHelpers.calculateAverageLatency(testState.metrics.latency.fiveWorkers).toFixed(2)}ms\n`);

  const throughputImprovement = (
    (testState.metrics.throughput.fiveWorkers - testState.metrics.throughput.twoWorkers) /
    testState.metrics.throughput.twoWorkers * 100
  );

  console.log('📈 Scaling Efficiency:');
  console.log(`   - Throughput improvement: ${throughputImprovement.toFixed(2)}%`);
  console.log(`   - Scale up time: ${testState.metrics.scalingTime.scaleUp.toFixed(2)}ms`);
  console.log(`   - Scale down time: ${testState.metrics.scalingTime.scaleDown.toFixed(2)}ms`);
  console.log(`   - Load balancing score: ${testState.metrics.loadBalancingScore.toFixed(2)}/100\n`);

  console.log('🎯 Worker Startup Times:');
  const avgStartupTime = testState.metrics.workerStartupTimes.reduce((a, b) => a + b, 0) /
                          testState.metrics.workerStartupTimes.length;
  console.log(`   - Average: ${avgStartupTime.toFixed(2)}ms`);
  console.log(`   - Min: ${Math.min(...testState.metrics.workerStartupTimes).toFixed(2)}ms`);
  console.log(`   - Max: ${Math.max(...testState.metrics.workerStartupTimes).toFixed(2)}ms\n`);

  // Verify scaling provided improvement
  assert.ok(
    throughputImprovement > 0,
    'Scaling up should improve throughput'
  );

  console.log('✅ Performance comparison completed\n');

  return {
    throughputImprovement,
    avgStartupTime
  };
}

/**
 * Cleanup
 */
async function cleanup() {
  console.log('\n───────────────────────────────────────────');
  console.log('  CLEANUP');
  console.log('───────────────────────────────────────────\n');

  // Stop all workers
  await stopWorkers([...testState.workers]);

  // Stop leader
  if (testState.leader) {
    console.log('🛑 Stopping Team Leader...');
    await testState.leader.shutdown();
    console.log('✅ Team Leader stopped\n');
  }

  console.log('✅ Cleanup complete\n');
}

/**
 * Main test runner
 */
async function runTests() {
  const overallStartTime = performance.now();
  let passed = 0;
  let failed = 0;

  try {
    // Setup leader
    await setupLeader();
    passed++;

    // Test initial scale
    await testInitialScale();
    passed++;

    // Test scale up
    await testScaleUp();
    passed++;

    // Test load balancing
    await testLoadBalancing();
    passed++;

    // Test scale down
    await testScaleDown();
    passed++;

    // Test rebalancing
    await testRebalancing();
    passed++;

    // Performance comparison
    testPerformanceComparison();
    passed++;

    // Summary
    const totalTime = ScalingHelpers.measureTime(overallStartTime);
    console.log('\n═══════════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════════\n');
    console.log(`✅ Tests passed: ${passed}`);
    console.log(`❌ Tests failed: ${failed}`);
    console.log(`⏱️  Total time: ${totalTime.toFixed(2)}ms\n`);
    console.log(`📊 Total tasks processed: ${testState.results.length}`);
    console.log(`📊 Total workers used: ${testState.metrics.workerStartupTimes.length}\n`);
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    failed++;
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    await cleanup();
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export {
  runTests,
  setupLeader,
  testInitialScale,
  testScaleUp,
  testLoadBalancing,
  testScaleDown,
  cleanup
};
