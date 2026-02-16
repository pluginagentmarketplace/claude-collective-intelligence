#!/usr/bin/env node
/**
 * E2E Test: Performance Benchmarks
 *
 * Comprehensive performance testing:
 * - 100 tasks distributed across 5 workers
 * - Measure throughput (tasks/sec)
 * - Measure latency (task processing time)
 * - Measure resource usage
 * - Generate detailed performance report
 * - Percentile analysis (p50, p95, p99)
 * - Concurrent task processing
 */

import { strict as assert } from 'assert';
import AgentOrchestrator from '../../scripts/orchestrator.js';
import { performance } from 'perf_hooks';
import { cpuUsage, memoryUsage } from 'process';
import { writeFileSync } from 'fs';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  WORKER_COUNT: 5,
  TASK_COUNT: 100,
  WARMUP_TASKS: 10,
  TIMEOUT: 180000, // 3 minutes
  REPORT_PATH: '/home/user/plugin-ai-agent-rabbitmq/tests/e2e/performance-report.json'
};

// Test state
const testState = {
  leader: null,
  workers: [],
  tasks: [],
  results: [],
  resourceSnapshots: [],
  metrics: {
    startTime: 0,
    endTime: 0,
    totalDuration: 0,
    throughput: 0,
    latencies: [],
    taskAssignmentTimes: [],
    taskProcessingTimes: [],
    workerUtilization: new Map(),
    resourceUsage: {
      cpu: [],
      memory: []
    },
    percentiles: {
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0
    },
    errors: [],
    concurrency: {
      max: 0,
      avg: 0
    }
  }
};

/**
 * Performance utilities
 */
class PerformanceHelpers {
  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static measureTime(startTime) {
    return performance.now() - startTime;
  }

  static calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  static calculateThroughput(taskCount, durationMs) {
    return (taskCount / durationMs) * 1000;
  }

  static captureResourceUsage() {
    const cpu = cpuUsage();
    const mem = memoryUsage();

    return {
      timestamp: Date.now(),
      cpu: {
        user: cpu.user / 1000, // Convert to ms
        system: cpu.system / 1000
      },
      memory: {
        rss: mem.rss / 1024 / 1024, // Convert to MB
        heapUsed: mem.heapUsed / 1024 / 1024,
        heapTotal: mem.heapTotal / 1024 / 1024,
        external: mem.external / 1024 / 1024
      }
    };
  }

  static calculateStats(values) {
    if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0, stdDev: 0 };

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, avg, median, stdDev };
  }

  static formatBytes(bytes) {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  static formatTime(ms) {
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

/**
 * Setup: Start all agents
 */
async function setupAgents() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  E2E TEST: Performance Benchmarks');
  console.log('═══════════════════════════════════════════\n');

  console.log(`📋 Test Configuration:`);
  console.log(`   - Workers: ${TEST_CONFIG.WORKER_COUNT}`);
  console.log(`   - Tasks: ${TEST_CONFIG.TASK_COUNT}`);
  console.log(`   - Warmup tasks: ${TEST_CONFIG.WARMUP_TASKS}`);
  console.log(`   - Timeout: ${TEST_CONFIG.TIMEOUT}ms\n`);

  // Capture initial resource usage
  testState.resourceSnapshots.push(PerformanceHelpers.captureResourceUsage());

  // Start team leader
  console.log('🚀 Starting Team Leader...');
  testState.leader = new AgentOrchestrator('team-leader');
  testState.leader.agentName = 'Perf-Test-Leader';

  await testState.leader.initialize();
  await testState.leader.startTeamLeader();

  console.log('✅ Team Leader started\n');

  // Setup result tracking with detailed metrics
  const originalHandleResult = testState.leader.handleResult.bind(testState.leader);
  testState.leader.handleResult = async (msg) => {
    const result = {
      ...msg.result,
      receivedAt: Date.now()
    };

    testState.results.push(result);

    // Track worker utilization
    const workerId = result.processedBy;
    if (workerId) {
      const current = testState.metrics.workerUtilization.get(workerId) || 0;
      testState.metrics.workerUtilization.set(workerId, current + 1);
    }

    // Track latencies
    if (result.duration) {
      testState.metrics.latencies.push(result.duration);
    }

    await originalHandleResult(msg);
  };

  // Start workers
  console.log(`🚀 Starting ${TEST_CONFIG.WORKER_COUNT} workers...\n`);

  for (let i = 1; i <= TEST_CONFIG.WORKER_COUNT; i++) {
    const worker = new AgentOrchestrator('worker');
    worker.agentName = `Perf-Worker-${i}`;

    await worker.initialize();
    await worker.startWorker();

    testState.workers.push(worker);
    console.log(`✅ Worker ${i} started`);

    // Capture resource usage after each worker
    if (i % 2 === 0) {
      testState.resourceSnapshots.push(PerformanceHelpers.captureResourceUsage());
    }
  }

  console.log(`\n✅ All ${TEST_CONFIG.WORKER_COUNT} workers ready\n`);

  // Wait for system to stabilize
  await PerformanceHelpers.delay(2000);

  return { leader: testState.leader, workers: testState.workers };
}

/**
 * Test: Warmup phase
 */
async function runWarmup() {
  console.log('\n───────────────────────────────────────────');
  console.log('  Warmup Phase');
  console.log('───────────────────────────────────────────\n');

  console.log(`🔥 Running ${TEST_CONFIG.WARMUP_TASKS} warmup tasks...\n`);

  for (let i = 1; i <= TEST_CONFIG.WARMUP_TASKS; i++) {
    await testState.leader.assignTask({
      title: `Warmup Task ${i}`,
      description: 'Warmup task to stabilize system',
      priority: 'low',
      isWarmup: true
    });
  }

  // Wait for warmup to complete
  await PerformanceHelpers.delay(5000);

  console.log('✅ Warmup completed\n');
}

/**
 * Test: Main performance benchmark
 */
async function runPerformanceBenchmark() {
  console.log('\n───────────────────────────────────────────');
  console.log('  Main Performance Benchmark');
  console.log('───────────────────────────────────────────\n');

  console.log(`🚀 Starting benchmark: ${TEST_CONFIG.TASK_COUNT} tasks\n`);

  // Clear warmup data
  testState.results = [];
  testState.metrics.latencies = [];

  // Start resource monitoring
  const resourceMonitor = setInterval(() => {
    testState.resourceSnapshots.push(PerformanceHelpers.captureResourceUsage());
  }, 1000);

  testState.metrics.startTime = performance.now();
  const startWallTime = Date.now();

  // Assign all tasks
  console.log('📤 Assigning tasks...\n');
  const taskPromises = [];

  for (let i = 1; i <= TEST_CONFIG.TASK_COUNT; i++) {
    const assignStartTime = performance.now();

    const taskId = await testState.leader.assignTask({
      title: `Performance Test Task ${i}`,
      description: `Benchmark task ${i}/${TEST_CONFIG.TASK_COUNT}`,
      priority: 'normal',
      taskNumber: i,
      assignedAt: Date.now()
    });

    const assignTime = PerformanceHelpers.measureTime(assignStartTime);
    testState.metrics.taskAssignmentTimes.push(assignTime);

    testState.tasks.push({
      id: taskId,
      number: i,
      assignedAt: Date.now()
    });

    taskPromises.push(taskId);

    if (i % 20 === 0) {
      console.log(`   ✅ ${i}/${TEST_CONFIG.TASK_COUNT} tasks assigned`);
    }
  }

  console.log(`\n📤 All ${TEST_CONFIG.TASK_COUNT} tasks assigned\n`);

  // Wait for all tasks to complete
  console.log('⏳ Waiting for task completion...\n');

  let lastProgressUpdate = 0;
  while (testState.results.length < TEST_CONFIG.TASK_COUNT) {
    // Track concurrency
    const activeTasks = testState.workers.reduce((sum, w) => sum + w.activeTasks.size, 0);
    if (activeTasks > testState.metrics.concurrency.max) {
      testState.metrics.concurrency.max = activeTasks;
    }

    // Progress updates
    if (testState.results.length - lastProgressUpdate >= 20) {
      console.log(`   📊 Progress: ${testState.results.length}/${TEST_CONFIG.TASK_COUNT} completed`);
      lastProgressUpdate = testState.results.length;
    }

    // Timeout check
    if (Date.now() - startWallTime > TEST_CONFIG.TIMEOUT) {
      console.log(`\n⚠️  Timeout reached: ${testState.results.length}/${TEST_CONFIG.TASK_COUNT} completed\n`);
      testState.metrics.errors.push({
        type: 'timeout',
        completed: testState.results.length,
        total: TEST_CONFIG.TASK_COUNT
      });
      break;
    }

    await PerformanceHelpers.delay(100);
  }

  testState.metrics.endTime = performance.now();
  testState.metrics.totalDuration = testState.metrics.endTime - testState.metrics.startTime;

  // Stop resource monitoring
  clearInterval(resourceMonitor);

  console.log(`\n✅ Benchmark completed: ${testState.results.length}/${TEST_CONFIG.TASK_COUNT} tasks\n`);

  return testState.results.length;
}

/**
 * Analyze performance metrics
 */
function analyzePerformance() {
  console.log('\n───────────────────────────────────────────');
  console.log('  Performance Analysis');
  console.log('───────────────────────────────────────────\n');

  // Calculate throughput
  testState.metrics.throughput = PerformanceHelpers.calculateThroughput(
    testState.results.length,
    testState.metrics.totalDuration
  );

  // Calculate percentiles
  if (testState.metrics.latencies.length > 0) {
    testState.metrics.percentiles.p50 = PerformanceHelpers.calculatePercentile(
      testState.metrics.latencies, 50
    );
    testState.metrics.percentiles.p75 = PerformanceHelpers.calculatePercentile(
      testState.metrics.latencies, 75
    );
    testState.metrics.percentiles.p90 = PerformanceHelpers.calculatePercentile(
      testState.metrics.latencies, 90
    );
    testState.metrics.percentiles.p95 = PerformanceHelpers.calculatePercentile(
      testState.metrics.latencies, 95
    );
    testState.metrics.percentiles.p99 = PerformanceHelpers.calculatePercentile(
      testState.metrics.latencies, 99
    );
  }

  // Calculate average concurrency
  testState.metrics.concurrency.avg = testState.results.length / (testState.metrics.totalDuration / 1000);

  // Latency statistics
  const latencyStats = PerformanceHelpers.calculateStats(testState.metrics.latencies);

  // Assignment time statistics
  const assignmentStats = PerformanceHelpers.calculateStats(testState.metrics.taskAssignmentTimes);

  // Resource usage statistics
  const memUsages = testState.resourceSnapshots.map(s => s.memory.heapUsed);
  const memStats = PerformanceHelpers.calculateStats(memUsages);

  console.log('📊 PERFORMANCE METRICS\n');

  console.log('⏱️  Timing:');
  console.log(`   - Total duration: ${PerformanceHelpers.formatTime(testState.metrics.totalDuration)}`);
  console.log(`   - Throughput: ${testState.metrics.throughput.toFixed(2)} tasks/sec\n`);

  console.log('📈 Latency (Task Processing Time):');
  console.log(`   - Min: ${PerformanceHelpers.formatTime(latencyStats.min)}`);
  console.log(`   - Max: ${PerformanceHelpers.formatTime(latencyStats.max)}`);
  console.log(`   - Average: ${PerformanceHelpers.formatTime(latencyStats.avg)}`);
  console.log(`   - Median: ${PerformanceHelpers.formatTime(latencyStats.median)}`);
  console.log(`   - Std Dev: ${PerformanceHelpers.formatTime(latencyStats.stdDev)}`);
  console.log(`   - P50: ${PerformanceHelpers.formatTime(testState.metrics.percentiles.p50)}`);
  console.log(`   - P75: ${PerformanceHelpers.formatTime(testState.metrics.percentiles.p75)}`);
  console.log(`   - P90: ${PerformanceHelpers.formatTime(testState.metrics.percentiles.p90)}`);
  console.log(`   - P95: ${PerformanceHelpers.formatTime(testState.metrics.percentiles.p95)}`);
  console.log(`   - P99: ${PerformanceHelpers.formatTime(testState.metrics.percentiles.p99)}\n`);

  console.log('📤 Task Assignment:');
  console.log(`   - Avg assignment time: ${PerformanceHelpers.formatTime(assignmentStats.avg)}`);
  console.log(`   - Min: ${PerformanceHelpers.formatTime(assignmentStats.min)}`);
  console.log(`   - Max: ${PerformanceHelpers.formatTime(assignmentStats.max)}\n`);

  console.log('🔄 Concurrency:');
  console.log(`   - Max concurrent tasks: ${testState.metrics.concurrency.max}`);
  console.log(`   - Avg concurrency: ${testState.metrics.concurrency.avg.toFixed(2)}\n`);

  console.log('💾 Memory Usage:');
  console.log(`   - Average heap: ${PerformanceHelpers.formatBytes(memStats.avg * 1024 * 1024)}`);
  console.log(`   - Peak heap: ${PerformanceHelpers.formatBytes(memStats.max * 1024 * 1024)}`);
  console.log(`   - Min heap: ${PerformanceHelpers.formatBytes(memStats.min * 1024 * 1024)}\n`);

  console.log('👷 Worker Utilization:');
  for (const [workerId, taskCount] of testState.metrics.workerUtilization) {
    const worker = testState.workers.find(w => w.agentId === workerId);
    const workerName = worker ? worker.agentName : workerId;
    const percentage = (taskCount / testState.results.length * 100).toFixed(2);
    console.log(`   - ${workerName}: ${taskCount} tasks (${percentage}%)`);
  }
  console.log();

  // Verify performance assertions
  assert.ok(testState.metrics.throughput > 0, 'Throughput should be positive');
  assert.ok(testState.metrics.percentiles.p95 > 0, 'P95 latency should be recorded');
  assert.ok(testState.metrics.concurrency.max > 0, 'Should have concurrent task execution');

  console.log('✅ Performance analysis completed\n');
}

/**
 * Generate performance report
 */
function generateReport() {
  console.log('\n───────────────────────────────────────────');
  console.log('  Generating Performance Report');
  console.log('───────────────────────────────────────────\n');

  const report = {
    testInfo: {
      date: new Date().toISOString(),
      workers: TEST_CONFIG.WORKER_COUNT,
      totalTasks: TEST_CONFIG.TASK_COUNT,
      completedTasks: testState.results.length,
      successRate: (testState.results.length / TEST_CONFIG.TASK_COUNT * 100).toFixed(2) + '%'
    },
    performance: {
      totalDuration: testState.metrics.totalDuration,
      throughput: testState.metrics.throughput,
      concurrency: testState.metrics.concurrency
    },
    latency: {
      stats: PerformanceHelpers.calculateStats(testState.metrics.latencies),
      percentiles: testState.metrics.percentiles,
      raw: testState.metrics.latencies
    },
    workers: {
      count: TEST_CONFIG.WORKER_COUNT,
      utilization: Array.from(testState.metrics.workerUtilization.entries()).map(([id, count]) => {
        const worker = testState.workers.find(w => w.agentId === id);
        return {
          workerId: id,
          workerName: worker ? worker.agentName : id,
          tasksProcessed: count,
          percentage: (count / testState.results.length * 100).toFixed(2)
        };
      })
    },
    resources: {
      memory: {
        stats: PerformanceHelpers.calculateStats(
          testState.resourceSnapshots.map(s => s.memory.heapUsed)
        ),
        snapshots: testState.resourceSnapshots.map(s => s.memory)
      },
      cpu: {
        snapshots: testState.resourceSnapshots.map(s => s.cpu)
      }
    },
    errors: testState.metrics.errors
  };

  // Write report to file
  try {
    writeFileSync(
      TEST_CONFIG.REPORT_PATH,
      JSON.stringify(report, null, 2),
      'utf8'
    );
    console.log(`✅ Report saved to: ${TEST_CONFIG.REPORT_PATH}\n`);
  } catch (error) {
    console.error(`⚠️  Could not save report: ${error.message}\n`);
  }

  // Display summary
  console.log('📄 Report Summary:');
  console.log(`   - Success rate: ${report.testInfo.successRate}`);
  console.log(`   - Throughput: ${report.performance.throughput.toFixed(2)} tasks/sec`);
  console.log(`   - P95 latency: ${PerformanceHelpers.formatTime(report.latency.percentiles.p95)}`);
  console.log(`   - Max concurrency: ${report.performance.concurrency.max}`);
  console.log(`   - Peak memory: ${PerformanceHelpers.formatBytes(report.resources.memory.stats.max * 1024 * 1024)}\n`);

  return report;
}

/**
 * Cleanup
 */
async function cleanup() {
  console.log('\n───────────────────────────────────────────');
  console.log('  CLEANUP');
  console.log('───────────────────────────────────────────\n');

  // Stop all workers
  for (const worker of testState.workers) {
    try {
      await worker.shutdown();
    } catch (error) {
      console.error(`   ⚠️  Error shutting down ${worker.agentName}:`, error.message);
    }
  }

  // Stop leader
  if (testState.leader) {
    await testState.leader.shutdown();
  }

  console.log('✅ All agents shut down\n');
}

/**
 * Main test runner
 */
async function runTests() {
  const overallStartTime = performance.now();
  let passed = 0;
  let failed = 0;

  try {
    // Setup
    await setupAgents();
    passed++;

    // Warmup
    await runWarmup();
    passed++;

    // Run benchmark
    await runPerformanceBenchmark();
    passed++;

    // Analyze
    analyzePerformance();
    passed++;

    // Generate report
    generateReport();
    passed++;

    // Summary
    const totalTime = PerformanceHelpers.measureTime(overallStartTime);
    console.log('\n═══════════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════════\n');
    console.log(`✅ Tests passed: ${passed}`);
    console.log(`❌ Tests failed: ${failed}`);
    console.log(`⏱️  Total test time: ${PerformanceHelpers.formatTime(totalTime)}`);
    console.log(`📊 Tasks processed: ${testState.results.length}/${TEST_CONFIG.TASK_COUNT}`);
    console.log(`🚀 Throughput: ${testState.metrics.throughput.toFixed(2)} tasks/sec`);
    console.log(`⚡ P95 Latency: ${PerformanceHelpers.formatTime(testState.metrics.percentiles.p95)}\n`);
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
  setupAgents,
  runPerformanceBenchmark,
  analyzePerformance,
  generateReport,
  cleanup
};
