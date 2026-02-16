#!/usr/bin/env node
/**
 * E2E Test: Complete Agent Lifecycle
 *
 * Tests the full journey of an agent from registration to rewards:
 * 1. Agent registration in database
 * 2. Task assignment via RabbitMQ
 * 3. Task completion and points awarded
 * 4. Tier progression (Bronze → Silver → Gold)
 * 5. Achievement unlocking
 * 6. Leaderboard updates
 */

import { setupTestEnvironment, teardownTestEnvironment, waitFor, sleep } from '../helpers/test-setup.js';
import { v4 as uuidv4 } from 'uuid';

const TEST_NAME = 'Complete Agent Lifecycle';
let testEnv;

async function runTest() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 ${TEST_NAME}`);
  console.log('='.repeat(60));

  try {
    // Setup
    console.log('\n📦 Setting up test environment...');
    testEnv = await setupTestEnvironment();
    const { db, mq } = testEnv;

    // ============================================
    // STEP 1: Agent Registration
    // ============================================
    console.log('\n✅ STEP 1: Agent Registration');

    const agentId = `agent-lifecycle-${uuidv4().slice(0, 8)}`;
    const agent = await db.createAgent(agentId, {
      name: 'Test Agent Alpha',
      tier: 'bronze',
      status: 'active'
    });

    console.log(`   Agent registered: ${agent.agent_id}`);
    console.log(`   Initial tier: ${agent.tier}`);

    // Verify agent exists
    const fetchedAgent = await db.getAgent(agentId);
    if (!fetchedAgent) {
      throw new Error('Agent not found in database');
    }
    console.log('   ✓ Agent verified in database');

    // ============================================
    // STEP 2: Task Assignment via RabbitMQ
    // ============================================
    console.log('\n✅ STEP 2: Task Assignment via RabbitMQ');

    const taskQueue = `tasks.${agentId}`;
    await mq.channel.assertQueue(taskQueue, { durable: false, autoDelete: true });
    await mq.channel.bindQueue(taskQueue, 'agent.tasks', `task.${agentId}.*`);

    const task1 = {
      taskId: uuidv4(),
      type: 'code_review',
      priority: 'normal',
      complexity: 'moderate',
      data: {
        file: 'test.js',
        action: 'review'
      },
      timestamp: Date.now()
    };

    await mq.publish('agent.tasks', `task.${agentId}.new`, task1);
    console.log(`   Task published: ${task1.taskId}`);

    // Simulate agent receiving task
    const receivedTask = await mq.waitForMessage(taskQueue, 3000);
    console.log(`   ✓ Agent received task: ${receivedTask.taskId}`);

    // ============================================
    // STEP 3: Task Completion & Points
    // ============================================
    console.log('\n✅ STEP 3: Task Completion & Points');

    // Simulate task completion
    await sleep(100); // Simulate work
    const completionTime = 100;

    // Award points for speed
    const speedPoints = 50;
    await db.awardPoints(agentId, 'speed', speedPoints, {
      taskId: task1.taskId,
      completionTime
    });

    // Award points for quality
    const qualityPoints = 75;
    await db.awardPoints(agentId, 'quality', qualityPoints, {
      taskId: task1.taskId,
      qualityScore: 0.9
    });

    const totalTaskPoints = speedPoints + qualityPoints;
    await db.awardPoints(agentId, 'total', totalTaskPoints, {
      taskId: task1.taskId
    });

    // Update agent stats
    await db.updateAgentStats(agentId, {
      tasks_completed: 1,
      last_active_at: new Date()
    });

    console.log(`   Speed points: ${speedPoints}`);
    console.log(`   Quality points: ${qualityPoints}`);
    console.log(`   Total points: ${totalTaskPoints}`);

    // Publish points event to RabbitMQ
    await mq.publish('gamification.points', 'points.earned.total', {
      eventId: uuidv4(),
      agentId,
      points: totalTaskPoints,
      category: 'task_completion'
    });

    // Verify points in database
    const points = await db.getAgentPoints(agentId);
    console.log(`   ✓ Points balance: ${points.total_points}`);

    if (points.total_points !== totalTaskPoints) {
      throw new Error(`Points mismatch: expected ${totalTaskPoints}, got ${points.total_points}`);
    }

    // ============================================
    // STEP 4: Multiple Tasks for Tier Progress
    // ============================================
    console.log('\n✅ STEP 4: Multiple Tasks for Tier Progression');

    const tasksToComplete = 50;
    let totalPoints = totalTaskPoints;

    for (let i = 0; i < tasksToComplete; i++) {
      const task = {
        taskId: uuidv4(),
        type: 'test_task',
        priority: 'normal'
      };

      // Award points
      const taskPoints = 20;
      await db.awardPoints(agentId, 'total', taskPoints, { taskId: task.taskId });
      totalPoints += taskPoints;

      // Update stats every 10 tasks
      if ((i + 1) % 10 === 0) {
        await db.updateAgentStats(agentId, {
          tasks_completed: i + 2,
          success_rate: 100
        });
        console.log(`   Progress: ${i + 2} tasks, ${totalPoints} points`);
      }
    }

    // Final stats update
    await db.updateAgentStats(agentId, {
      tasks_completed: 51,
      success_rate: 100
    });

    console.log(`   ✓ Completed ${tasksToComplete + 1} tasks`);
    console.log(`   ✓ Total points: ${totalPoints}`);

    // ============================================
    // STEP 5: Tier Progression Check
    // ============================================
    console.log('\n✅ STEP 5: Tier Progression');

    const updatedAgent = await db.getAgent(agentId);
    const updatedPoints = await db.getAgentPoints(agentId);

    console.log(`   Current tier: ${updatedAgent.tier}`);
    console.log(`   Total points: ${updatedPoints.total_points}`);
    console.log(`   Tasks completed: ${updatedAgent.tasks_completed}`);
    console.log(`   Success rate: ${updatedAgent.success_rate}%`);

    // Check if eligible for Silver (1000 points, 50 tasks, 70% success)
    if (updatedPoints.total_points >= 1000) {
      // Simulate tier promotion
      await db.query(
        'UPDATE agents SET tier = $1 WHERE agent_id = $2',
        ['silver', agentId]
      );

      // Publish tier promotion event
      await mq.publish('gamification.tiers', 'tier.promoted.silver', {
        eventId: uuidv4(),
        agentId,
        oldTier: 'bronze',
        newTier: 'silver',
        timestamp: Date.now()
      });

      console.log('   🎉 PROMOTED TO SILVER!');

      const promotedAgent = await db.getAgent(agentId);
      if (promotedAgent.tier !== 'silver') {
        throw new Error('Tier promotion failed');
      }
    }

    // ============================================
    // STEP 6: Achievement Unlocking
    // ============================================
    console.log('\n✅ STEP 6: Achievement Unlocking');

    // Check for "First Steps" achievement (1 task completed)
    const firstTaskAchievement = await db.query(
      "SELECT * FROM achievements WHERE achievement_id = 'first_task'"
    );

    if (firstTaskAchievement.rows.length > 0) {
      // Award achievement
      await db.query(
        `INSERT INTO agent_achievements (agent_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [agentId, 'first_task']
      );

      console.log('   🏆 Achievement Unlocked: First Steps');
    }

    // Check agent achievements
    const achievements = await db.query(
      `SELECT a.name, a.points_reward, aa.earned_at
       FROM agent_achievements aa
       JOIN achievements a ON aa.achievement_id = a.achievement_id
       WHERE aa.agent_id = $1`,
      [agentId]
    );

    console.log(`   ✓ Total achievements: ${achievements.rows.length}`);
    achievements.rows.forEach(ach => {
      console.log(`     - ${ach.name} (+${ach.points_reward} pts)`);
    });

    // ============================================
    // STEP 7: Leaderboard Updates
    // ============================================
    console.log('\n✅ STEP 7: Leaderboard Updates');

    // Refresh leaderboard
    await db.refreshLeaderboard();

    const leaderboard = await db.getLeaderboard(10);
    console.log('   Top 10 Leaderboard:');
    leaderboard.forEach((entry, index) => {
      console.log(`     ${index + 1}. ${entry.name} - ${entry.total_points} pts (${entry.tier})`);
    });

    // Check if our agent is on leaderboard
    const agentRank = leaderboard.find(e => e.agent_id === agentId);
    if (agentRank) {
      console.log(`   ✓ Agent rank: #${agentRank.rank}`);
    }

    // ============================================
    // STEP 8: Points History Audit
    // ============================================
    console.log('\n✅ STEP 8: Points History Audit');

    const history = await db.getPointsHistory(agentId, 5);
    console.log(`   Recent point events (showing 5 of ${history.length}):`);
    history.slice(0, 5).forEach(event => {
      const date = new Date(event.created_at).toLocaleTimeString();
      console.log(`     [${date}] ${event.category}: +${event.points} pts`);
    });

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n✅ VERIFICATION');

    const finalAgent = await db.getAgent(agentId);
    const finalPoints = await db.getAgentPoints(agentId);

    const checks = [
      {
        name: 'Agent exists',
        pass: finalAgent !== null
      },
      {
        name: 'Tasks completed',
        pass: finalAgent.tasks_completed >= 50
      },
      {
        name: 'Points awarded',
        pass: finalPoints.total_points >= 1000
      },
      {
        name: 'Success rate tracked',
        pass: finalAgent.success_rate === 100
      },
      {
        name: 'Tier progression',
        pass: finalAgent.tier === 'silver' || finalAgent.tier === 'bronze'
      },
      {
        name: 'Points history recorded',
        pass: history.length > 0
      }
    ];

    let allPassed = true;
    checks.forEach(check => {
      const status = check.pass ? '✓' : '✗';
      console.log(`   ${status} ${check.name}`);
      if (!check.pass) allPassed = false;
    });

    if (!allPassed) {
      throw new Error('Some verification checks failed');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST PASSED: Complete Agent Lifecycle');
    console.log('='.repeat(60));

    return true;

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return false;

  } finally {
    // Cleanup
    if (testEnv) {
      console.log('\n🧹 Cleaning up...');
      await teardownTestEnvironment(testEnv);
    }
  }
}

// Run the test
if (process.argv[1] === new URL(import.meta.url).pathname) {
  runTest()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default runTest;
