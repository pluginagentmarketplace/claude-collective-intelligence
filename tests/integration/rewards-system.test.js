#!/usr/bin/env node
/**
 * Rewards System Integration Tests
 * Tests the full rewards system with RabbitMQ integration
 */

import { RabbitMQClient } from '../../scripts/rabbitmq-client.js';
import { RewardsSystem } from '../../scripts/rewards-system.js';
import assert from 'assert';

const TEST_CONFIG = {
  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
  testTimeout: 30000
};

class RewardsIntegrationTest {
  constructor() {
    this.testResults = [];
    this.testsPassed = 0;
    this.testsFailed = 0;
  }

  async runTest(name, testFn) {
    console.log(`\n🧪 Running: ${name}`);
    try {
      await testFn();
      this.testsPassed++;
      this.testResults.push({ name, status: 'PASSED', error: null });
      console.log(`✅ PASSED: ${name}`);
    } catch (error) {
      this.testsFailed++;
      this.testResults.push({ name, status: 'FAILED', error: error.message });
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${error.message}`);
    }
  }

  async setup() {
    console.log('🔧 Setting up integration test environment...');
    this.client = new RabbitMQClient({ agentId: 'test-rewards-agent' });
    this.rewardsSystem = new RewardsSystem();

    try {
      await this.client.connect();
      console.log('✅ RabbitMQ connected');
    } catch (error) {
      console.error('❌ RabbitMQ connection failed:', error.message);
      throw error;
    }
  }

  async teardown() {
    console.log('\n🧹 Cleaning up...');
    if (this.client) {
      await this.client.disconnect();
    }
  }

  async runAll() {
    console.log('\n' + '='.repeat(60));
    console.log('🏆 REWARDS SYSTEM INTEGRATION TESTS');
    console.log('='.repeat(60));

    try {
      await this.setup();

      // Test 1: Agent Initialization
      await this.runTest('Agent Initialization', async () => {
        const agentId = 'integration-test-agent-1';
        const result = this.rewardsSystem.initializeAgent(agentId);

        assert.strictEqual(result.tier, 'BRONZE');
        assert.strictEqual(result.points, 0);
        assert.ok(result.resources);
      });

      // Test 2: Task Completion Rewards
      await this.runTest('Task Completion Awards Points', async () => {
        const agentId = 'integration-test-agent-2';
        this.rewardsSystem.initializeAgent(agentId);

        const task = { priority: 'HIGH', complexity: 1 };
        const result = { quality: 0.9, duration: 2000 };

        const pointResult = await this.rewardsSystem.awardTaskPoints(agentId, task, result);

        assert.ok(pointResult.points > 0);
        assert.ok(pointResult.breakdown.priority === 2.0);
      });

      // Test 3: Streak Building
      await this.runTest('Streak Building and Multipliers', async () => {
        const agentId = 'integration-test-agent-3';
        this.rewardsSystem.initializeAgent(agentId);

        // Build a streak of 5
        for (let i = 0; i < 5; i++) {
          await this.rewardsSystem.updateStreak(agentId, true);
        }

        const status = this.rewardsSystem.getAgentStatus(agentId);
        assert.strictEqual(status.currentStreak, 5);

        // Check multiplier is applied
        const multiplier = this.rewardsSystem.getStreakMultiplier(agentId);
        assert.ok(multiplier > 1.0);
      });

      // Test 4: Achievement Unlocking
      await this.runTest('Achievement System', async () => {
        const agentId = 'integration-test-agent-4';
        this.rewardsSystem.initializeAgent(agentId);

        const task = { priority: 'NORMAL' };
        const result = { quality: 0.8, duration: 1000 };

        await this.rewardsSystem.awardTaskPoints(agentId, task, result);
        const achievements = await this.rewardsSystem.checkAchievements(agentId);

        assert.ok(achievements.some(a => a.id === 'first_task'));
      });

      // Test 5: Brainstorm Points
      await this.runTest('Brainstorm Participation Rewards', async () => {
        const agentId = 'integration-test-agent-5';
        this.rewardsSystem.initializeAgent(agentId);

        const initialPoints = this.rewardsSystem.permissionManager.getAgentPoints(agentId);
        await this.rewardsSystem.awardBrainstormPoints(agentId, false, false);
        const finalPoints = this.rewardsSystem.permissionManager.getAgentPoints(agentId);

        assert.ok(finalPoints > initialPoints);
      });

      // Test 6: Tier Progression
      await this.runTest('Tier Upgrade System', async () => {
        const agentId = 'integration-test-agent-6';
        this.rewardsSystem.initializeAgent(agentId);

        // Grant sufficient points and achievements
        await this.rewardsSystem.permissionManager.awardPoints(agentId, 1000);
        await this.rewardsSystem.permissionManager.awardAchievement(agentId, 'first_task');
        await this.rewardsSystem.permissionManager.awardAchievement(agentId, 'team_player');

        const metrics = {
          tasksCompleted: 50,
          successRate: 0.85,
          brainstormsParticipated: 10,
          uptime: 3600000
        };

        const upgrade = await this.rewardsSystem.checkTierUpgrade(agentId, metrics);
        assert.ok(upgrade);
        assert.strictEqual(upgrade.newTier, 'SILVER');
      });

      // Test 7: Resource Allocation
      await this.runTest('Dynamic Resource Allocation', async () => {
        const agentId = 'integration-test-agent-7';
        this.rewardsSystem.initializeAgent(agentId);

        const allocation = await this.rewardsSystem.resourceAllocator.allocateResources(agentId);

        assert.strictEqual(allocation.success, true);
        assert.ok(allocation.config.prefetchCount > 0);
        assert.ok(allocation.config.timeoutMultiplier > 0);
      });

      // Test 8: Performance-Based Allocation
      await this.runTest('Performance-Based Resource Boost', async () => {
        const agentId = 'integration-test-agent-8';
        this.rewardsSystem.initializeAgent(agentId);

        // Update metrics with high performance
        this.rewardsSystem.resourceAllocator.updatePerformanceMetrics(agentId, {
          successRate: 0.95,
          avgCompletionTime: 500,
          currentStreak: 10,
          contribution: 100
        });

        const allocation = this.rewardsSystem.resourceAllocator.calculateAllocation(agentId);

        // Should get bonus allocation for performance
        assert.ok(allocation.prefetchCount > 1);
      });

      // Test 9: Permission System
      await this.runTest('Permission Checks', async () => {
        const agentId = 'integration-test-agent-9';
        this.rewardsSystem.initializeAgent(agentId);

        // Bronze tier should have basic permissions
        assert.ok(this.rewardsSystem.permissionManager.hasPermission(agentId, 'task.consume'));
        assert.ok(this.rewardsSystem.permissionManager.hasPermission(agentId, 'result.publish'));

        // Bronze tier should NOT have advanced permissions
        assert.ok(!this.rewardsSystem.permissionManager.hasPermission(agentId, 'workflow.create'));
      });

      // Test 10: Temporary Privilege Elevation
      await this.runTest('Temporary Privilege Elevation', async () => {
        const agentId = 'integration-test-agent-10';
        this.rewardsSystem.initializeAgent(agentId);

        // Grant temporary elevation
        await this.rewardsSystem.permissionManager.grantTemporaryElevation(
          agentId,
          'workflow.create',
          5000,
          'special_task'
        );

        // Should now have permission
        assert.ok(this.rewardsSystem.permissionManager.hasPermission(agentId, 'workflow.create'));
      });

      // Test 11: Multiple Agents Leaderboard
      await this.runTest('Leaderboard Rankings', async () => {
        const agents = ['leader-1', 'leader-2', 'leader-3'];

        for (const agentId of agents) {
          this.rewardsSystem.initializeAgent(agentId);
        }

        await this.rewardsSystem.permissionManager.awardPoints('leader-1', 500);
        await this.rewardsSystem.permissionManager.awardPoints('leader-2', 300);
        await this.rewardsSystem.permissionManager.awardPoints('leader-3', 700);

        const leaderboard = this.rewardsSystem.getLeaderboard(3);

        assert.strictEqual(leaderboard[0].agentId, 'leader-3');
        assert.strictEqual(leaderboard[1].agentId, 'leader-1');
        assert.strictEqual(leaderboard[2].agentId, 'leader-2');
      });

      // Test 12: Streak Protection
      await this.runTest('Streak Protection for Higher Tiers', async () => {
        const agentId = 'integration-test-agent-12';
        this.rewardsSystem.initializeAgent(agentId);

        // Upgrade to Silver
        await this.rewardsSystem.permissionManager.upgradeTier(agentId, 'SILVER');

        // Build a streak
        await this.rewardsSystem.updateStreak(agentId, true);
        await this.rewardsSystem.updateStreak(agentId, true);
        await this.rewardsSystem.updateStreak(agentId, true);

        // Fail once (should be protected)
        await this.rewardsSystem.updateStreak(agentId, false);

        const status = this.rewardsSystem.getAgentStatus(agentId);
        assert.strictEqual(status.currentStreak, 3); // Streak preserved
      });

      // Test 13: Complex Task Workflow
      await this.runTest('Complex Task Workflow', async () => {
        const agentId = 'integration-test-agent-13';
        this.rewardsSystem.initializeAgent(agentId);

        // Simulate completing multiple tasks
        const tasks = [
          { priority: 'HIGH', complexity: 2 },
          { priority: 'NORMAL', complexity: 1 },
          { priority: 'CRITICAL', complexity: 3 },
          { priority: 'LOW', complexity: 1 }
        ];

        for (const task of tasks) {
          const result = { quality: 0.9, duration: 1500 };
          await this.rewardsSystem.awardTaskPoints(agentId, task, result);
        }

        const status = this.rewardsSystem.getAgentStatus(agentId);
        assert.strictEqual(status.stats.tasksCompleted, 4);
        assert.ok(status.points > 0);
        assert.strictEqual(status.currentStreak, 4);
      });

      // Test 14: Event Emission
      await this.runTest('Rewards System Events', async () => {
        const agentId = 'integration-test-agent-14';
        this.rewardsSystem.initializeAgent(agentId);

        let pointsEventFired = false;
        let tierEventFired = false;

        this.rewardsSystem.on('points_awarded', (data) => {
          if (data.agentId === agentId) {
            pointsEventFired = true;
          }
        });

        this.rewardsSystem.on('tier_upgraded', (data) => {
          if (data.agentId === agentId) {
            tierEventFired = true;
          }
        });

        await this.rewardsSystem.permissionManager.awardPoints(agentId, 100);
        await this.rewardsSystem.permissionManager.upgradeTier(agentId, 'SILVER');

        assert.ok(pointsEventFired, 'Points awarded event should fire');
        assert.ok(tierEventFired, 'Tier upgraded event should fire');
      });

      // Test 15: Full Agent Lifecycle
      await this.runTest('Full Agent Lifecycle', async () => {
        const agentId = 'integration-test-agent-15';

        // Initialize
        this.rewardsSystem.initializeAgent(agentId);
        let status = this.rewardsSystem.getAgentStatus(agentId);
        assert.strictEqual(status.tier, 'BRONZE');

        // Complete tasks
        for (let i = 0; i < 10; i++) {
          const task = { priority: 'NORMAL' };
          const result = { quality: 0.85, duration: 1000 };
          await this.rewardsSystem.awardTaskPoints(agentId, task, result);
        }

        status = this.rewardsSystem.getAgentStatus(agentId);
        assert.strictEqual(status.stats.tasksCompleted, 10);
        assert.strictEqual(status.currentStreak, 10);

        // Participate in brainstorms
        for (let i = 0; i < 5; i++) {
          await this.rewardsSystem.awardBrainstormPoints(agentId);
        }

        status = this.rewardsSystem.getAgentStatus(agentId);
        assert.strictEqual(status.stats.brainstormsParticipated, 5);

        // Check achievements
        const achievements = await this.rewardsSystem.checkAchievements(agentId);
        assert.ok(achievements.length > 0);

        // Verify final state
        status = this.rewardsSystem.getAgentStatus(agentId);
        assert.ok(status.points > 0);
        assert.ok(status.currentStreak > 0);
      });

      await this.teardown();

      this.printSummary();
      return this.testsFailed === 0;

    } catch (error) {
      console.error('\n💥 Test execution failed:', error);
      await this.teardown();
      return false;
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.testsPassed + this.testsFailed}`);
    console.log(`✅ Passed: ${this.testsPassed}`);
    console.log(`❌ Failed: ${this.testsFailed}`);
    console.log('='.repeat(60));

    if (this.testsFailed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAILED')
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }

    if (this.testsFailed === 0) {
      console.log('\n🎉 All integration tests passed!');
    } else {
      console.log(`\n⚠️  ${this.testsFailed} test(s) failed`);
    }
  }
}

// Run tests
const tester = new RewardsIntegrationTest();
tester.runAll().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});
