#!/usr/bin/env node
/**
 * E2E Test: 5-Terminal Scenario
 *
 * Tests the complete multi-agent orchestration flow:
 * - 1 Team Leader
 * - 2 Workers
 * - 2 Collaborators
 *
 * Simulates real-world collaborative task execution with brainstorming
 */

import { strict as assert } from 'assert';
import AgentOrchestrator from '../../scripts/orchestrator.js';
import { performance } from 'perf_hooks';

// Test configuration
const TEST_CONFIG = {
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  TASK_TIMEOUT: 30000,
  BRAINSTORM_TIMEOUT: 10000,
  RESULT_TIMEOUT: 15000
};

// Test state
const testState = {
  agents: [],
  taskId: null,
  brainstormId: null,
  results: [],
  startTime: null,
  endTime: null,
  metrics: {
    agentStartupTime: [],
    taskProcessingTime: 0,
    brainstormResponseTime: [],
    endToEndLatency: 0
  }
};

/**
 * Test utilities
 */
class TestHelpers {
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Timeout waiting for condition');
  }

  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static measureTime(startTime) {
    return performance.now() - startTime;
  }
}

/**
 * Start agent with timing measurement
 */
async function startAgent(agentType, agentName) {
  const startTime = performance.now();
  console.log(`\n🚀 Starting ${agentType}: ${agentName}`);

  const agent = new AgentOrchestrator(agentType);
  agent.agentName = agentName;

  await agent.initialize();

  const startupTime = TestHelpers.measureTime(startTime);
  testState.metrics.agentStartupTime.push(startupTime);
  console.log(`✅ ${agentName} started in ${startupTime.toFixed(2)}ms`);

  return agent;
}

/**
 * Setup: Start all 5 agents
 */
async function setupAgents() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  E2E TEST: 5-Terminal Scenario');
  console.log('═══════════════════════════════════════════\n');

  testState.startTime = performance.now();

  try {
    // Start Team Leader (Terminal 1)
    const leader = await startAgent('team-leader', 'Test-Leader');
    await leader.startTeamLeader();
    testState.agents.push(leader);

    // Start Worker 1 (Terminal 2)
    const worker1 = await startAgent('worker', 'Test-Worker-1');
    await worker1.startWorker();
    testState.agents.push(worker1);

    // Start Worker 2 (Terminal 3)
    const worker2 = await startAgent('worker', 'Test-Worker-2');
    await worker2.startWorker();
    testState.agents.push(worker2);

    // Start Collaborator 1 (Terminal 4)
    const collab1 = await startAgent('collaborator', 'Test-Collab-1');
    await collab1.startCollaborator();
    testState.agents.push(collab1);

    // Start Collaborator 2 (Terminal 5)
    const collab2 = await startAgent('collaborator', 'Test-Collab-2');
    await collab2.startCollaborator();
    testState.agents.push(collab2);

    // Verify all agents are connected
    assert.equal(testState.agents.length, 5, 'All 5 agents should be started');
    console.log('\n✅ All 5 agents initialized successfully\n');

    return testState.agents;
  } catch (error) {
    console.error('❌ Setup failed:', error);
    await cleanup();
    throw error;
  }
}

/**
 * Test: Assign collaborative task and verify flow
 */
async function testCollaborativeTask() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Collaborative Task Flow');
  console.log('───────────────────────────────────────────\n');

  const [leader, worker1, worker2, collab1, collab2] = testState.agents;

  const taskStartTime = performance.now();

  // Setup result collection
  const receivedResults = [];
  const originalHandleResult = leader.handleResult.bind(leader);
  leader.handleResult = async (msg) => {
    receivedResults.push(msg.result);
    await originalHandleResult(msg);
  };

  // Assign collaborative task from leader
  console.log('📋 Leader assigning collaborative task...');
  testState.taskId = await leader.assignTask({
    title: 'E2E Test: Design system architecture',
    description: 'Determine best approach for microservices communication',
    priority: 'high',
    requiresCollaboration: true,
    collaborationQuestion: 'What communication protocol should we use?',
    requiredAgents: ['backend', 'frontend']
  });

  console.log(`✅ Task assigned: ${testState.taskId}\n`);

  // Wait for task to be picked up by worker
  console.log('⏳ Waiting for worker to pick up task...');
  await TestHelpers.waitFor(
    () => worker1.activeTasks.size > 0 || worker2.activeTasks.size > 0,
    TEST_CONFIG.TASK_TIMEOUT
  );

  const activeWorker = worker1.activeTasks.size > 0 ? worker1 : worker2;
  console.log(`✅ Task picked up by ${activeWorker.agentName}\n`);

  // Wait for brainstorm to be initiated
  console.log('⏳ Waiting for brainstorm initiation...');
  await TestHelpers.waitFor(
    () => activeWorker.brainstormSessions.size > 0,
    TEST_CONFIG.BRAINSTORM_TIMEOUT
  );

  testState.brainstormId = Array.from(activeWorker.brainstormSessions.keys())[0];
  console.log(`✅ Brainstorm initiated: ${testState.brainstormId}\n`);

  // Wait for collaborators to respond
  console.log('⏳ Waiting for collaborator responses...');
  const brainstormStartTime = performance.now();

  await TestHelpers.delay(6000); // Wait for brainstorm cycle to complete

  const brainstormTime = TestHelpers.measureTime(brainstormStartTime);
  testState.metrics.brainstormResponseTime.push(brainstormTime);
  console.log(`✅ Brainstorm completed in ${brainstormTime.toFixed(2)}ms\n`);

  // Verify collaborators participated
  assert.ok(
    collab1.stats.brainstormsParticipated > 0 || collab2.stats.brainstormsParticipated > 0,
    'At least one collaborator should participate'
  );
  console.log(`✅ Collaborator participation verified`);
  console.log(`   - Collab1: ${collab1.stats.brainstormsParticipated} sessions`);
  console.log(`   - Collab2: ${collab2.stats.brainstormsParticipated} sessions\n`);

  // Wait for task completion and result
  console.log('⏳ Waiting for task completion...');
  await TestHelpers.waitFor(
    () => receivedResults.length > 0 && receivedResults.some(r => r.taskId === testState.taskId),
    TEST_CONFIG.RESULT_TIMEOUT
  );

  const taskTime = TestHelpers.measureTime(taskStartTime);
  testState.metrics.taskProcessingTime = taskTime;
  console.log(`✅ Task completed in ${taskTime.toFixed(2)}ms\n`);

  // Verify result received by leader
  const taskResult = receivedResults.find(r => r.taskId === testState.taskId);
  assert.ok(taskResult, 'Leader should receive task result');
  assert.equal(taskResult.status, 'completed', 'Task should be completed');
  assert.ok(taskResult.processedBy, 'Result should have processedBy field');
  console.log('✅ Leader received final result\n');

  // Verify stats
  console.log('📊 Final Statistics:');
  console.log(`   - Worker1: ${worker1.stats.tasksCompleted} tasks completed`);
  console.log(`   - Worker2: ${worker2.stats.tasksCompleted} tasks completed`);
  console.log(`   - Total brainstorm participations: ${collab1.stats.brainstormsParticipated + collab2.stats.brainstormsParticipated}`);
  console.log(`   - Leader results received: ${leader.results.size}\n`);

  return taskResult;
}

/**
 * Test: Verify entire flow end-to-end
 */
async function testEndToEndFlow() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: End-to-End Flow Verification');
  console.log('───────────────────────────────────────────\n');

  const [leader, worker1, worker2, collab1, collab2] = testState.agents;

  // Verify all agents are healthy
  console.log('🔍 Verifying agent health...');
  for (const agent of testState.agents) {
    assert.ok(agent.client.isHealthy(), `${agent.agentName} should be healthy`);
  }
  console.log('✅ All agents healthy\n');

  // Verify message flow
  console.log('🔍 Verifying message flow...');

  // At least one worker should have processed tasks
  const totalWorkerTasks = worker1.stats.tasksCompleted + worker2.stats.tasksCompleted;
  assert.ok(totalWorkerTasks > 0, 'Workers should have completed tasks');
  console.log(`✅ Workers processed ${totalWorkerTasks} task(s)\n`);

  // Collaborators should have participated
  const totalCollabParticipation = collab1.stats.brainstormsParticipated + collab2.stats.brainstormsParticipated;
  assert.ok(totalCollabParticipation > 0, 'Collaborators should participate in brainstorms');
  console.log(`✅ Collaborators participated ${totalCollabParticipation} time(s)\n`);

  // Leader should have results
  assert.ok(leader.results.size > 0, 'Leader should have received results');
  console.log(`✅ Leader received ${leader.results.size} result(s)\n`);

  // Calculate end-to-end latency
  testState.endTime = performance.now();
  testState.metrics.endToEndLatency = TestHelpers.measureTime(testState.startTime);

  console.log('✅ End-to-end flow verified successfully\n');
}

/**
 * Test: Verify performance metrics
 */
function testPerformanceMetrics() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Performance Metrics');
  console.log('───────────────────────────────────────────\n');

  const avgStartupTime = testState.metrics.agentStartupTime.reduce((a, b) => a + b, 0) /
                         testState.metrics.agentStartupTime.length;

  console.log('⏱️  Performance Report:');
  console.log(`   - Average agent startup time: ${avgStartupTime.toFixed(2)}ms`);
  console.log(`   - Task processing time: ${testState.metrics.taskProcessingTime.toFixed(2)}ms`);
  console.log(`   - Brainstorm cycle time: ${testState.metrics.brainstormResponseTime[0]?.toFixed(2) || 'N/A'}ms`);
  console.log(`   - End-to-end latency: ${testState.metrics.endToEndLatency.toFixed(2)}ms\n`);

  // Performance assertions
  assert.ok(avgStartupTime < 5000, 'Agent startup should be under 5 seconds');
  assert.ok(testState.metrics.taskProcessingTime < 30000, 'Task processing should be under 30 seconds');
  assert.ok(testState.metrics.endToEndLatency < 60000, 'End-to-end should be under 60 seconds');

  console.log('✅ Performance metrics within acceptable ranges\n');

  return testState.metrics;
}

/**
 * Cleanup: Shutdown all agents
 */
async function cleanup() {
  console.log('\n───────────────────────────────────────────');
  console.log('  CLEANUP: Shutting down agents');
  console.log('───────────────────────────────────────────\n');

  for (const agent of testState.agents) {
    try {
      console.log(`🛑 Shutting down ${agent.agentName}...`);
      await agent.shutdown();
    } catch (error) {
      console.error(`❌ Error shutting down ${agent.agentName}:`, error.message);
    }
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

    // Test collaborative task
    await testCollaborativeTask();
    passed++;

    // Test end-to-end flow
    await testEndToEndFlow();
    passed++;

    // Test performance metrics
    testPerformanceMetrics();
    passed++;

    // Summary
    const totalTime = TestHelpers.measureTime(overallStartTime);
    console.log('\n═══════════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════════\n');
    console.log(`✅ Tests passed: ${passed}`);
    console.log(`❌ Tests failed: ${failed}`);
    console.log(`⏱️  Total time: ${totalTime.toFixed(2)}ms\n`);
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

export { runTests, setupAgents, testCollaborativeTask, testEndToEndFlow, cleanup };
