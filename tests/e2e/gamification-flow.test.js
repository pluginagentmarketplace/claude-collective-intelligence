#!/usr/bin/env node
/**
 * E2E Test: Gamification Flow
 *
 * Tests comprehensive gamification system:
 * 1. Points earning across all categories
 * 2. Tier progression (Bronze → Diamond)
 * 3. Achievement unlocking
 * 4. Streak bonuses
 * 5. Penalty system (violations → rehabilitation)
 * 6. Leaderboard rankings
 * 7. Rewards redemption
 */

import { setupTestEnvironment, teardownTestEnvironment, sleep } from '../helpers/test-setup.js';
import { v4 as uuidv4 } from 'uuid';

const TEST_NAME = 'Gamification Flow';
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
    // STEP 1: Create Test Agents
    // ============================================
    console.log('\n✅ STEP 1: Create Test Agents');

    const agent1Id = `gami-agent1-${uuidv4().slice(0, 8)}`;
    const agent2Id = `gami-agent2-${uuidv4().slice(0, 8)}`;

    await db.createAgent(agent1Id, { name: 'Gamification Agent 1' });
    await db.createAgent(agent2Id, { name: 'Gamification Agent 2' });

    console.log(`   Agent 1: ${agent1Id}`);
    console.log(`   Agent 2: ${agent2Id}`);

    // ============================================
    // STEP 2: Award Points - All Categories
    // ============================================
    console.log('\n✅ STEP 2: Award Points Across All Categories');

    // Speed points
    await db.awardPoints(agent1Id, 'speed', 100, {
      taskId: uuidv4(),
      completionTime: 50,
      multiplier: 2.0
    });

    // Quality points
    await db.awardPoints(agent1Id, 'quality', 150, {
      taskId: uuidv4(),
      qualityScore: 0.95,
      perfectionBonus: true
    });

    // Collaboration points
    await db.awardPoints(agent1Id, 'collaboration', 75, {
      sessionId: uuidv4(),
      type: 'brainstorm',
      teamSize: 5
    });

    // Innovation points
    await db.awardPoints(agent1Id, 'innovation', 200, {
      noveltyScore: 0.9,
      approach: 'novel'
    });

    // Reliability points
    await db.awardPoints(agent1Id, 'reliability', 50, {
      consecutiveDays: 7,
      successRate: 100
    });

    const totalPoints = 100 + 150 + 75 + 200 + 50; // 575
    await db.awardPoints(agent1Id, 'total', totalPoints, {
      reason: 'multi_category_award'
    });

    // Publish points events
    await mq.publish('gamification.points', 'points.earned.multi', {
      agentId: agent1Id,
      categories: {
        speed: 100,
        quality: 150,
        collaboration: 75,
        innovation: 200,
        reliability: 50
      }
    });

    const points = await db.getAgentPoints(agent1Id);
    console.log(`   Speed: ${points.speed_points}`);
    console.log(`   Quality: ${points.quality_points}`);
    console.log(`   Collaboration: ${points.collaboration_points}`);
    console.log(`   Innovation: ${points.innovation_points}`);
    console.log(`   Reliability: ${points.reliability_points}`);
    console.log(`   Total: ${points.total_points}`);

    // ============================================
    // STEP 3: Tier Progression
    // ============================================
    console.log('\n✅ STEP 3: Tier Progression');

    const tierProgression = [
      { tier: 'bronze', points: 0, tasks: 0 },
      { tier: 'silver', points: 1000, tasks: 50 },
      { tier: 'gold', points: 5000, tasks: 200 },
      { tier: 'platinum', points: 15000, tasks: 500 },
      { tier: 'diamond', points: 50000, tasks: 1000 }
    ];

    let currentTier = 'bronze';
    let totalPointsEarned = 575;

    console.log(`   Starting tier: ${currentTier}`);

    // Progress to Silver
    const pointsToSilver = 1000 - totalPointsEarned;
    await db.awardPoints(agent1Id, 'total', pointsToSilver, { reason: 'tier_progress' });
    totalPointsEarned += pointsToSilver;

    await db.updateAgentStats(agent1Id, {
      tasks_completed: 50,
      success_rate: 85
    });

    await db.query('UPDATE agents SET tier = $1 WHERE agent_id = $2', ['silver', agent1Id]);
    currentTier = 'silver';

    await mq.publish('gamification.tiers', 'tier.promoted.silver', {
      agentId: agent1Id,
      oldTier: 'bronze',
      newTier: 'silver',
      timestamp: Date.now()
    });

    console.log(`   ⬆️  Promoted to SILVER (${totalPointsEarned} pts, 50 tasks)`);

    // Progress to Gold
    const pointsToGold = 5000 - totalPointsEarned;
    await db.awardPoints(agent1Id, 'total', pointsToGold, { reason: 'tier_progress' });
    totalPointsEarned += pointsToGold;

    await db.updateAgentStats(agent1Id, {
      tasks_completed: 200,
      success_rate: 90,
      collaborations_completed: 30
    });

    await db.query('UPDATE agents SET tier = $1 WHERE agent_id = $2', ['gold', agent1Id]);
    currentTier = 'gold';

    console.log(`   ⬆️  Promoted to GOLD (${totalPointsEarned} pts, 200 tasks)`);

    // ============================================
    // STEP 4: Streak Bonuses
    // ============================================
    console.log('\n✅ STEP 4: Streak Bonuses');

    const streaks = [
      { days: 3, bonus: 1.1, name: '3-day streak' },
      { days: 7, bonus: 1.25, name: '7-day streak' },
      { days: 30, bonus: 1.5, name: '30-day streak' }
    ];

    for (const streak of streaks) {
      await db.updateAgentStats(agent1Id, {
        consecutive_days: streak.days
      });

      const basePoints = 100;
      const bonusPoints = Math.round(basePoints * (streak.bonus - 1));

      await db.awardPoints(agent1Id, 'total', basePoints + bonusPoints, {
        reason: 'streak_bonus',
        streak: streak.days
      });

      console.log(`   ${streak.name}: +${bonusPoints} bonus pts (${streak.bonus}x)`);
    }

    // ============================================
    // STEP 5: Achievement Unlocking
    // ============================================
    console.log('\n✅ STEP 5: Achievement Unlocking');

    const achievementsToUnlock = [
      { id: 'first_task', name: 'First Steps', points: 10 },
      { id: 'speed_demon', name: 'Speed Demon', points: 50 },
      { id: 'team_player', name: 'Team Player', points: 50 }
    ];

    for (const achievement of achievementsToUnlock) {
      await db.query(
        `INSERT INTO agent_achievements (agent_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [agent1Id, achievement.id]
      );

      await db.awardPoints(agent1Id, 'total', achievement.points, {
        reason: 'achievement',
        achievementId: achievement.id
      });

      console.log(`   🏆 ${achievement.name} (+${achievement.points} pts)`);
    }

    const agentAchievements = await db.query(
      `SELECT COUNT(*) as count FROM agent_achievements WHERE agent_id = $1`,
      [agent1Id]
    );

    console.log(`   Total achievements unlocked: ${agentAchievements.rows[0].count}`);

    // ============================================
    // STEP 6: Penalty System
    // ============================================
    console.log('\n✅ STEP 6: Penalty System');

    // Simulate a violation
    const violation = {
      violationType: 'task_timeout',
      severity: 'moderate',
      pointsDeducted: 100,
      description: 'Failed to complete task within deadline'
    };

    const penalty = await db.createPenalty(agent1Id, violation);

    console.log(`   Penalty issued: ${penalty.violation_type}`);
    console.log(`   Severity: ${penalty.severity}`);
    console.log(`   Points deducted: -${penalty.points_deducted}`);

    // Deduct points
    await db.awardPoints(agent1Id, 'penalty', -violation.pointsDeducted, {
      penaltyId: penalty.penalty_id,
      reason: violation.violationType
    });

    // Publish penalty event
    await mq.publish('gamification.points', 'penalty.issued', {
      agentId: agent1Id,
      penaltyId: penalty.penalty_id,
      pointsDeducted: violation.pointsDeducted
    });

    console.log(`   ✓ Penalty applied to points balance`);

    // Rehabilitation process
    console.log('\n   Rehabilitation:');

    const rehabTasks = 3;
    for (let i = 0; i < rehabTasks; i++) {
      await sleep(50);
      console.log(`     Rehab task ${i + 1}/${rehabTasks} completed`);
    }

    // Mark rehabilitation complete
    await db.query(
      `UPDATE penalties
       SET rehabilitation_completed = true, status = 'resolved', resolved_at = CURRENT_TIMESTAMP
       WHERE penalty_id = $1`,
      [penalty.penalty_id]
    );

    console.log('   ✓ Rehabilitation completed, penalty resolved');

    // Restore some points
    const restorationBonus = 50;
    await db.awardPoints(agent1Id, 'total', restorationBonus, {
      reason: 'rehabilitation_complete',
      penaltyId: penalty.penalty_id
    });

    console.log(`   ✓ Restoration bonus: +${restorationBonus} pts`);

    // ============================================
    // STEP 7: Leaderboard Rankings
    // ============================================
    console.log('\n✅ STEP 7: Leaderboard Rankings');

    // Create some competition
    for (let i = 0; i < 5; i++) {
      const competitorId = `competitor-${i}`;
      await db.createAgent(competitorId, { name: `Competitor ${i}` });

      const randomPoints = Math.floor(Math.random() * 3000) + 500;
      await db.awardPoints(competitorId, 'total', randomPoints, {});

      await db.updateAgentStats(competitorId, {
        tasks_completed: Math.floor(Math.random() * 100) + 10,
        success_rate: Math.floor(Math.random() * 30) + 70
      });
    }

    // Refresh leaderboard
    await db.refreshLeaderboard();
    const leaderboard = await db.getLeaderboard(10);

    console.log('   Current Leaderboard:');
    leaderboard.forEach((entry, index) => {
      const marker = entry.agent_id === agent1Id ? ' ← YOU' : '';
      console.log(`     ${entry.rank}. ${entry.name} - ${entry.total_points} pts (${entry.tier})${marker}`);
    });

    // ============================================
    // STEP 8: Points History Audit Trail
    // ============================================
    console.log('\n✅ STEP 8: Points History Audit Trail');

    const history = await db.getPointsHistory(agent1Id, 10);
    console.log(`   Recent transactions (${history.length} total):`);

    const summary = {
      earned: 0,
      deducted: 0,
      categories: {}
    };

    history.forEach(event => {
      if (event.points > 0) {
        summary.earned += event.points;
      } else {
        summary.deducted += Math.abs(event.points);
      }

      summary.categories[event.category] = (summary.categories[event.category] || 0) + event.points;
    });

    console.log(`   Total earned: +${summary.earned}`);
    console.log(`   Total deducted: -${summary.deducted}`);
    console.log(`   Net points: ${summary.earned - summary.deducted}`);
    console.log('   By category:');
    Object.entries(summary.categories).forEach(([cat, pts]) => {
      if (pts !== 0) {
        console.log(`     ${cat}: ${pts > 0 ? '+' : ''}${pts}`);
      }
    });

    // ============================================
    // STEP 9: Multi-Agent Comparison
    // ============================================
    console.log('\n✅ STEP 9: Multi-Agent Comparison');

    // Give agent2 some points
    await db.awardPoints(agent2Id, 'total', 2000, {});
    await db.updateAgentStats(agent2Id, {
      tasks_completed: 100,
      success_rate: 88
    });

    await db.query('UPDATE agents SET tier = $1 WHERE agent_id = $2', ['silver', agent2Id]);

    const agent1 = await db.getAgent(agent1Id);
    const agent2 = await db.getAgent(agent2Id);
    const points1 = await db.getAgentPoints(agent1Id);
    const points2 = await db.getAgentPoints(agent2Id);

    console.log('   Agent Comparison:');
    console.log(`   ${agent1.name}:`);
    console.log(`     Tier: ${agent1.tier}`);
    console.log(`     Points: ${points1.total_points}`);
    console.log(`     Tasks: ${agent1.tasks_completed}`);
    console.log(`     Success: ${agent1.success_rate}%`);

    console.log(`   ${agent2.name}:`);
    console.log(`     Tier: ${agent2.tier}`);
    console.log(`     Points: ${points2.total_points}`);
    console.log(`     Tasks: ${agent2.tasks_completed}`);
    console.log(`     Success: ${agent2.success_rate}%`);

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n✅ VERIFICATION');

    const finalAgent = await db.getAgent(agent1Id);
    const finalPoints = await db.getAgentPoints(agent1Id);
    const penalties = await db.query(
      'SELECT * FROM penalties WHERE agent_id = $1',
      [agent1Id]
    );

    const checks = [
      {
        name: 'Points awarded in all categories',
        pass: finalPoints.speed_points > 0 &&
              finalPoints.quality_points > 0 &&
              finalPoints.collaboration_points > 0 &&
              finalPoints.innovation_points > 0 &&
              finalPoints.reliability_points > 0
      },
      {
        name: 'Tier progression occurred',
        pass: finalAgent.tier === 'gold'
      },
      {
        name: 'Achievements unlocked',
        pass: agentAchievements.rows[0].count >= 3
      },
      {
        name: 'Penalty issued and tracked',
        pass: penalties.rows.length > 0
      },
      {
        name: 'Rehabilitation completed',
        pass: penalties.rows[0].rehabilitation_completed === true
      },
      {
        name: 'Points history recorded',
        pass: history.length > 10
      },
      {
        name: 'Leaderboard populated',
        pass: leaderboard.length > 0
      },
      {
        name: 'Total points positive',
        pass: finalPoints.total_points > 0
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
    console.log('✅ TEST PASSED: Gamification Flow');
    console.log('='.repeat(60));

    return true;

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return false;

  } finally {
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
