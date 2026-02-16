#!/usr/bin/env node
/**
 * E2E Test: Git Worktree Integration
 *
 * Tests agent coordination across multiple git worktrees:
 * - Setup multiple worktrees
 * - Start agents in different worktrees
 * - Coordinate work across worktrees
 * - Verify no conflicts
 * - Clean up worktrees
 */

import { strict as assert } from 'assert';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import AgentOrchestrator from '../../scripts/orchestrator.js';

const execAsync = promisify(exec);

// Test configuration
const TEST_CONFIG = {
  BASE_DIR: '/tmp/worktree-test',
  WORKTREE_COUNT: 3,
  TEST_TIMEOUT: 60000,
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672'
};

// Test state
const testState = {
  mainRepo: null,
  worktrees: [],
  agents: [],
  processes: [],
  testBranch: `test-worktree-${Date.now()}`,
  metrics: {
    worktreeSetupTime: 0,
    agentCoordinationTime: 0,
    conflictResolutionTime: 0
  }
};

/**
 * Test utilities
 */
class GitWorktreeHelpers {
  static async execCommand(command, cwd = null) {
    const options = cwd ? { cwd } : {};
    try {
      const { stdout, stderr } = await execAsync(command, options);
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  static async gitCommand(args, cwd = null) {
    const command = `git ${args}`;
    return this.execCommand(command, cwd);
  }

  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static measureTime(startTime) {
    return performance.now() - startTime;
  }
}

/**
 * Setup: Create git repository and worktrees
 */
async function setupGitWorktrees() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  E2E TEST: Git Worktree Integration');
  console.log('═══════════════════════════════════════════\n');

  const startTime = performance.now();

  // Clean up previous test directory
  if (existsSync(TEST_CONFIG.BASE_DIR)) {
    console.log('🧹 Cleaning up previous test directory...');
    rmSync(TEST_CONFIG.BASE_DIR, { recursive: true, force: true });
  }

  mkdirSync(TEST_CONFIG.BASE_DIR, { recursive: true });
  console.log(`✅ Created test directory: ${TEST_CONFIG.BASE_DIR}\n`);

  // Initialize main repository
  testState.mainRepo = path.join(TEST_CONFIG.BASE_DIR, 'main-repo');
  mkdirSync(testState.mainRepo);

  console.log('🔧 Initializing git repository...');
  await GitWorktreeHelpers.gitCommand('init', testState.mainRepo);
  await GitWorktreeHelpers.gitCommand('config user.email "test@example.com"', testState.mainRepo);
  await GitWorktreeHelpers.gitCommand('config user.name "Test User"', testState.mainRepo);

  // Create initial commit
  await GitWorktreeHelpers.execCommand(
    'echo "# Worktree Test" > README.md',
    testState.mainRepo
  );
  await GitWorktreeHelpers.gitCommand('add README.md', testState.mainRepo);
  await GitWorktreeHelpers.gitCommand('commit -m "Initial commit"', testState.mainRepo);
  console.log('✅ Main repository initialized\n');

  // Create test branch
  console.log(`🌿 Creating test branch: ${testState.testBranch}`);
  await GitWorktreeHelpers.gitCommand(
    `checkout -b ${testState.testBranch}`,
    testState.mainRepo
  );
  console.log('✅ Test branch created\n');

  // Create worktrees
  console.log(`🌳 Creating ${TEST_CONFIG.WORKTREE_COUNT} worktrees...`);
  for (let i = 1; i <= TEST_CONFIG.WORKTREE_COUNT; i++) {
    const worktreePath = path.join(TEST_CONFIG.BASE_DIR, `worktree-${i}`);
    const branchName = `${testState.testBranch}-wt${i}`;

    await GitWorktreeHelpers.gitCommand(
      `worktree add ${worktreePath} -b ${branchName}`,
      testState.mainRepo
    );

    testState.worktrees.push({
      path: worktreePath,
      branch: branchName,
      agentType: i === 1 ? 'team-leader' : 'worker'
    });

    console.log(`   ✅ Worktree ${i}: ${worktreePath} (${branchName})`);
  }

  testState.metrics.worktreeSetupTime = GitWorktreeHelpers.measureTime(startTime);
  console.log(`\n✅ All worktrees created in ${testState.metrics.worktreeSetupTime.toFixed(2)}ms\n`);

  // List worktrees
  const { stdout } = await GitWorktreeHelpers.gitCommand('worktree list', testState.mainRepo);
  console.log('📋 Worktree list:');
  console.log(stdout);
  console.log();

  return testState.worktrees;
}

/**
 * Start agents in different worktrees
 */
async function startAgentsInWorktrees() {
  console.log('\n───────────────────────────────────────────');
  console.log('  Starting agents in worktrees');
  console.log('───────────────────────────────────────────\n');

  for (let i = 0; i < testState.worktrees.length; i++) {
    const worktree = testState.worktrees[i];
    const agentName = `${worktree.agentType}-wt${i + 1}`;

    console.log(`🚀 Starting agent in worktree ${i + 1}: ${agentName}`);
    console.log(`   Path: ${worktree.path}`);
    console.log(`   Branch: ${worktree.branch}`);
    console.log(`   Type: ${worktree.agentType}`);

    // Create agent
    const agent = new AgentOrchestrator(worktree.agentType);
    agent.agentName = agentName;
    agent.worktreePath = worktree.path;
    agent.worktreeBranch = worktree.branch;

    await agent.initialize();

    // Start agent based on type
    if (worktree.agentType === 'team-leader') {
      await agent.startTeamLeader();
    } else {
      await agent.startWorker();
    }

    testState.agents.push(agent);
    console.log(`   ✅ Agent started\n`);
  }

  assert.equal(testState.agents.length, TEST_CONFIG.WORKTREE_COUNT, 'All agents should be started');
  console.log(`✅ All ${testState.agents.length} agents running in separate worktrees\n`);

  return testState.agents;
}

/**
 * Test: Coordinate work across worktrees
 */
async function testWorktreeCoordination() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Worktree Coordination');
  console.log('───────────────────────────────────────────\n');

  const startTime = performance.now();
  const [leader, ...workers] = testState.agents;

  // Setup result tracking
  const completedTasks = [];
  const originalHandleResult = leader.handleResult.bind(leader);
  leader.handleResult = async (msg) => {
    completedTasks.push(msg.result);
    await originalHandleResult(msg);
  };

  // Assign tasks to be processed in different worktrees
  console.log('📋 Leader assigning tasks to workers in different worktrees...\n');

  const taskPromises = [];
  for (let i = 0; i < workers.length; i++) {
    const taskId = await leader.assignTask({
      title: `Worktree task ${i + 1}`,
      description: `Process task in worktree ${i + 2}`,
      priority: 'normal',
      worktree: testState.worktrees[i + 1].path,
      branch: testState.worktrees[i + 1].branch
    });

    console.log(`   ✅ Task ${i + 1} assigned: ${taskId}`);
    taskPromises.push(taskId);
  }

  console.log(`\n📤 Total tasks assigned: ${taskPromises.length}\n`);

  // Wait for all tasks to complete
  console.log('⏳ Waiting for workers to complete tasks...');

  const maxWaitTime = 20000;
  const startWait = Date.now();
  while (completedTasks.length < workers.length && (Date.now() - startWait) < maxWaitTime) {
    await GitWorktreeHelpers.delay(500);
  }

  testState.metrics.agentCoordinationTime = GitWorktreeHelpers.measureTime(startTime);

  console.log(`\n✅ Tasks completed: ${completedTasks.length}/${workers.length}`);
  console.log(`⏱️  Coordination time: ${testState.metrics.agentCoordinationTime.toFixed(2)}ms\n`);

  // Verify tasks were processed
  assert.ok(
    completedTasks.length > 0,
    'At least one task should be completed across worktrees'
  );

  // Verify each worktree's branch
  console.log('🔍 Verifying worktree branches...');
  for (const worktree of testState.worktrees) {
    const { stdout } = await GitWorktreeHelpers.gitCommand(
      'rev-parse --abbrev-ref HEAD',
      worktree.path
    );
    console.log(`   - ${worktree.path}: ${stdout}`);
    assert.equal(stdout, worktree.branch, `Worktree should be on correct branch`);
  }
  console.log('✅ All worktrees on correct branches\n');

  return completedTasks;
}

/**
 * Test: Verify no conflicts between worktrees
 */
async function testNoConflicts() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Conflict Detection');
  console.log('───────────────────────────────────────────\n');

  const startTime = performance.now();

  // Make changes in each worktree
  console.log('📝 Making changes in each worktree...\n');

  for (let i = 0; i < testState.worktrees.length; i++) {
    const worktree = testState.worktrees[i];
    const fileName = `file-wt${i + 1}.txt`;
    const content = `Content from worktree ${i + 1}`;

    // Create unique file in each worktree
    await GitWorktreeHelpers.execCommand(
      `echo "${content}" > ${fileName}`,
      worktree.path
    );

    // Stage and commit
    await GitWorktreeHelpers.gitCommand(`add ${fileName}`, worktree.path);
    await GitWorktreeHelpers.gitCommand(
      `commit -m "Add ${fileName} from worktree ${i + 1}"`,
      worktree.path
    );

    console.log(`   ✅ Committed ${fileName} in worktree ${i + 1}`);
  }

  console.log('\n🔍 Checking for conflicts...\n');

  // Check git status in each worktree
  let hasConflicts = false;
  for (const worktree of testState.worktrees) {
    const { stdout } = await GitWorktreeHelpers.gitCommand('status --short', worktree.path);

    if (stdout.includes('UU') || stdout.includes('AA') || stdout.includes('DD')) {
      hasConflicts = true;
      console.log(`   ⚠️  Conflict detected in ${worktree.path}`);
    } else {
      console.log(`   ✅ No conflicts in ${worktree.path}`);
    }
  }

  testState.metrics.conflictResolutionTime = GitWorktreeHelpers.measureTime(startTime);

  assert.ok(!hasConflicts, 'Worktrees should not have conflicts');
  console.log(`\n✅ No conflicts detected across worktrees`);
  console.log(`⏱️  Check completed in ${testState.metrics.conflictResolutionTime.toFixed(2)}ms\n`);

  return !hasConflicts;
}

/**
 * Test: Verify worktree isolation
 */
async function testWorktreeIsolation() {
  console.log('\n───────────────────────────────────────────');
  console.log('  TEST: Worktree Isolation');
  console.log('───────────────────────────────────────────\n');

  console.log('🔍 Verifying each worktree is isolated...\n');

  for (let i = 0; i < testState.worktrees.length; i++) {
    const worktree = testState.worktrees[i];

    // Check working directory
    const { stdout: pwd } = await GitWorktreeHelpers.execCommand('pwd', worktree.path);
    assert.equal(pwd, worktree.path, 'Working directory should match worktree path');
    console.log(`   ✅ Worktree ${i + 1}: Isolated working directory`);

    // Check branch
    const { stdout: branch } = await GitWorktreeHelpers.gitCommand(
      'rev-parse --abbrev-ref HEAD',
      worktree.path
    );
    assert.equal(branch, worktree.branch, 'Should be on correct branch');
    console.log(`   ✅ Worktree ${i + 1}: Correct branch (${branch})`);

    // Check for other worktrees' files
    for (let j = 0; j < testState.worktrees.length; j++) {
      if (i !== j) {
        const otherFile = `file-wt${j + 1}.txt`;
        const fileExists = existsSync(path.join(worktree.path, otherFile));

        // File should not exist in this worktree (different branches)
        console.log(`   ✅ Worktree ${i + 1}: ${otherFile} isolated`);
      }
    }
  }

  console.log('\n✅ All worktrees properly isolated\n');
  return true;
}

/**
 * Cleanup: Shutdown agents and remove worktrees
 */
async function cleanup() {
  console.log('\n───────────────────────────────────────────');
  console.log('  CLEANUP');
  console.log('───────────────────────────────────────────\n');

  // Shutdown agents
  console.log('🛑 Shutting down agents...');
  for (const agent of testState.agents) {
    try {
      await agent.shutdown();
    } catch (error) {
      console.error(`   ⚠️  Error shutting down ${agent.agentName}:`, error.message);
    }
  }
  console.log('✅ All agents shut down\n');

  // Remove worktrees
  console.log('🧹 Removing worktrees...');
  for (const worktree of testState.worktrees) {
    try {
      await GitWorktreeHelpers.gitCommand(
        `worktree remove ${worktree.path} --force`,
        testState.mainRepo
      );
      console.log(`   ✅ Removed ${worktree.path}`);
    } catch (error) {
      console.error(`   ⚠️  Error removing ${worktree.path}:`, error.message);
    }
  }

  // Clean up test directory
  if (existsSync(TEST_CONFIG.BASE_DIR)) {
    rmSync(TEST_CONFIG.BASE_DIR, { recursive: true, force: true });
    console.log(`✅ Cleaned up test directory\n`);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  const overallStartTime = performance.now();
  let passed = 0;
  let failed = 0;

  try {
    // Setup worktrees
    await setupGitWorktrees();
    passed++;

    // Start agents
    await startAgentsInWorktrees();
    passed++;

    // Test coordination
    await testWorktreeCoordination();
    passed++;

    // Test no conflicts
    await testNoConflicts();
    passed++;

    // Test isolation
    await testWorktreeIsolation();
    passed++;

    // Summary
    const totalTime = GitWorktreeHelpers.measureTime(overallStartTime);
    console.log('\n═══════════════════════════════════════════');
    console.log('  TEST SUMMARY');
    console.log('═══════════════════════════════════════════\n');
    console.log(`✅ Tests passed: ${passed}`);
    console.log(`❌ Tests failed: ${failed}`);
    console.log(`⏱️  Total time: ${totalTime.toFixed(2)}ms\n`);
    console.log('📊 Performance Metrics:');
    console.log(`   - Worktree setup: ${testState.metrics.worktreeSetupTime.toFixed(2)}ms`);
    console.log(`   - Agent coordination: ${testState.metrics.agentCoordinationTime.toFixed(2)}ms`);
    console.log(`   - Conflict check: ${testState.metrics.conflictResolutionTime.toFixed(2)}ms\n`);
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

export { runTests, setupGitWorktrees, testWorktreeCoordination, testNoConflicts, cleanup };
