#!/usr/bin/env node
/**
 * E2E Test: Mentorship Flow
 *
 * Tests the complete mentorship lifecycle:
 * 1. Mentor and mentee registration
 * 2. Mentorship pairing in database
 * 3. Training sessions via RabbitMQ
 * 4. Progress tracking in database
 * 5. Mentee skill development
 * 6. Graduation and rewards
 * 7. Mentor points and recognition
 */

import { setupTestEnvironment, teardownTestEnvironment, sleep } from '../helpers/test-setup.js';
import { v4 as uuidv4 } from 'uuid';

const TEST_NAME = 'Mentorship Flow';
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
    // STEP 1: Create Mentor and Mentee Agents
    // ============================================
    console.log('\n✅ STEP 1: Create Mentor and Mentee');

    const mentorId = `mentor-${uuidv4().slice(0, 8)}`;
    const menteeId = `mentee-${uuidv4().slice(0, 8)}`;

    // Create experienced mentor (Gold tier)
    const mentor = await db.createAgent(mentorId, {
      name: 'Mentor Agent (Senior)',
      tier: 'gold',
      status: 'active'
    });

    await db.updateAgentStats(mentorId, {
      tasks_completed: 500,
      success_rate: 95,
      collaborations_completed: 50
    });

    await db.awardPoints(mentorId, 'total', 6000, { reason: 'existing_points' });

    console.log(`   Mentor created: ${mentor.name} (${mentor.tier})`);

    // Create new mentee (Bronze tier)
    const mentee = await db.createAgent(menteeId, {
      name: 'Mentee Agent (Junior)',
      tier: 'bronze',
      status: 'training'
    });

    console.log(`   Mentee created: ${mentee.name} (${mentee.tier})`);

    // ============================================
    // STEP 2: Establish Mentorship Pairing
    // ============================================
    console.log('\n✅ STEP 2: Establish Mentorship Pairing');

    const mentorship = await db.createMentorship(mentorId, menteeId);
    console.log(`   Mentorship ID: ${mentorship.mentorship_id}`);
    console.log(`   Status: ${mentorship.status}`);
    console.log(`   Started: ${mentorship.started_at}`);

    // Publish mentorship event to RabbitMQ
    await mq.publish('agent.brainstorm', 'mentorship.started', {
      mentorshipId: mentorship.mentorship_id,
      mentorId,
      menteeId,
      timestamp: Date.now()
    });

    console.log('   ✓ Mentorship pairing established');

    // ============================================
    // STEP 3: Training Session 1 - Basics
    // ============================================
    console.log('\n✅ STEP 3: Training Session 1 - Basics');

    const session1Queue = `mentorship.${mentorship.mentorship_id}`;
    await mq.channel.assertQueue(session1Queue, { durable: false, autoDelete: true });

    const trainingTask1 = {
      sessionId: uuidv4(),
      type: 'training',
      topic: 'Task Fundamentals',
      mentorId,
      menteeId,
      exercises: [
        'Complete simple task',
        'Handle errors',
        'Report results'
      ]
    };

    await mq.publish('agent.brainstorm', `mentorship.session.${menteeId}`, trainingTask1);
    console.log(`   Session 1 started: ${trainingTask1.topic}`);

    // Simulate session completion
    await sleep(100);

    await db.updateMentorshipProgress(mentorship.mentorship_id, {
      sessions: 1,
      tasks: 3,
      details: {
        session1: {
          topic: trainingTask1.topic,
          completed: true,
          score: 85
        }
      }
    });

    console.log('   ✓ Session 1 completed (score: 85%)');

    // Award collaboration points to both
    await db.awardPoints(mentorId, 'collaboration', 30, {
      reason: 'mentorship_session',
      mentorshipId: mentorship.mentorship_id
    });

    await db.awardPoints(menteeId, 'quality', 20, {
      reason: 'training_session',
      mentorshipId: mentorship.mentorship_id
    });

    // ============================================
    // STEP 4: Training Session 2 - Advanced
    // ============================================
    console.log('\n✅ STEP 4: Training Session 2 - Advanced');

    const trainingTask2 = {
      sessionId: uuidv4(),
      type: 'training',
      topic: 'Advanced Collaboration',
      mentorId,
      menteeId,
      exercises: [
        'Participate in brainstorm',
        'Provide code review',
        'Handle complex task'
      ]
    };

    await mq.publish('agent.brainstorm', `mentorship.session.${menteeId}`, trainingTask2);
    console.log(`   Session 2 started: ${trainingTask2.topic}`);

    await sleep(100);

    await db.updateMentorshipProgress(mentorship.mentorship_id, {
      sessions: 2,
      tasks: 6,
      details: {
        session1: { topic: 'Task Fundamentals', completed: true, score: 85 },
        session2: { topic: trainingTask2.topic, completed: true, score: 92 }
      }
    });

    console.log('   ✓ Session 2 completed (score: 92%)');

    // More points
    await db.awardPoints(mentorId, 'collaboration', 30, {
      reason: 'mentorship_session',
      session: 2
    });

    await db.awardPoints(menteeId, 'quality', 25, {
      reason: 'training_session',
      session: 2
    });

    // ============================================
    // STEP 5: Mentee Skill Development
    // ============================================
    console.log('\n✅ STEP 5: Mentee Skill Development');

    // Simulate mentee completing real tasks
    const tasksCompleted = 25;

    for (let i = 0; i < tasksCompleted; i++) {
      const taskPoints = 15;
      await db.awardPoints(menteeId, 'total', taskPoints, {
        taskId: uuidv4(),
        supervised: true
      });
    }

    await db.updateAgentStats(menteeId, {
      tasks_completed: tasksCompleted,
      success_rate: 88,
      collaborations_completed: 2
    });

    const menteeStats = await db.getAgent(menteeId);
    const menteePoints = await db.getAgentPoints(menteeId);

    console.log(`   Mentee progress:`);
    console.log(`     Tasks completed: ${menteeStats.tasks_completed}`);
    console.log(`     Success rate: ${menteeStats.success_rate}%`);
    console.log(`     Total points: ${menteePoints.total_points}`);

    // ============================================
    // STEP 6: Final Assessment
    // ============================================
    console.log('\n✅ STEP 6: Final Assessment');

    const finalAssessment = {
      sessionId: uuidv4(),
      type: 'assessment',
      mentorId,
      menteeId,
      tests: [
        { name: 'Technical Skills', score: 90 },
        { name: 'Collaboration', score: 85 },
        { name: 'Problem Solving', score: 88 }
      ]
    };

    const avgScore = finalAssessment.tests.reduce((sum, t) => sum + t.score, 0) / finalAssessment.tests.length;

    console.log(`   Final assessment:`);
    finalAssessment.tests.forEach(test => {
      console.log(`     ${test.name}: ${test.score}%`);
    });
    console.log(`   Average: ${avgScore.toFixed(1)}%`);

    // ============================================
    // STEP 7: Graduation
    // ============================================
    console.log('\n✅ STEP 7: Graduation');

    if (avgScore >= 80) {
      // Graduate the mentee
      const graduated = await db.graduateMentorship(mentorship.mentorship_id);

      console.log('   🎓 MENTEE GRADUATED!');
      console.log(`   Graduation date: ${graduated.graduated_at}`);

      // Update mentee status
      await db.query(
        'UPDATE agents SET status = $1 WHERE agent_id = $2',
        ['active', menteeId]
      );

      // Publish graduation event
      await mq.publish('agent.brainstorm', 'mentorship.graduated', {
        mentorshipId: mentorship.mentorship_id,
        mentorId,
        menteeId,
        finalScore: avgScore,
        timestamp: Date.now()
      });

      // Award graduation bonuses
      await db.awardPoints(mentorId, 'collaboration', 100, {
        reason: 'mentorship_graduation',
        mentorshipId: mentorship.mentorship_id
      });

      await db.awardPoints(menteeId, 'total', 50, {
        reason: 'graduation_bonus',
        mentorshipId: mentorship.mentorship_id
      });

      console.log('   ✓ Graduation bonuses awarded');

      // Update mentor stats
      await db.query(
        'UPDATE agents SET mentorships_given = mentorships_given + 1 WHERE agent_id = $1',
        [mentorId]
      );

      await db.query(
        'UPDATE agents SET mentorships_received = mentorships_received + 1 WHERE agent_id = $1',
        [menteeId]
      );

      console.log('   ✓ Mentor/mentee stats updated');
    }

    // ============================================
    // STEP 8: Check Mentorship in Database
    // ============================================
    console.log('\n✅ STEP 8: Verify Mentorship Records');

    const finalMentorship = await db.query(
      'SELECT * FROM mentorships WHERE mentorship_id = $1',
      [mentorship.mentorship_id]
    );

    const mentorshipRecord = finalMentorship.rows[0];
    console.log(`   Mentorship status: ${mentorshipRecord.status}`);
    console.log(`   Sessions completed: ${mentorshipRecord.sessions_completed}`);
    console.log(`   Tasks completed: ${mentorshipRecord.tasks_completed}`);

    // Check all mentorships for mentor
    const mentorHistory = await db.query(
      'SELECT COUNT(*) as total FROM mentorships WHERE mentor_id = $1',
      [mentorId]
    );

    console.log(`   Mentor total mentorships: ${mentorHistory.rows[0].total}`);

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n✅ VERIFICATION');

    const finalMentor = await db.getAgent(mentorId);
    const finalMentee = await db.getAgent(menteeId);
    const mentorPoints = await db.getAgentPoints(mentorId);
    const finalMenteePoints = await db.getAgentPoints(menteeId);

    const checks = [
      {
        name: 'Mentorship created',
        pass: mentorshipRecord !== null
      },
      {
        name: 'Sessions completed',
        pass: mentorshipRecord.sessions_completed >= 2
      },
      {
        name: 'Mentorship graduated',
        pass: mentorshipRecord.status === 'completed'
      },
      {
        name: 'Mentee status updated',
        pass: finalMentee.status === 'active'
      },
      {
        name: 'Mentor points awarded',
        pass: mentorPoints.collaboration_points > 0
      },
      {
        name: 'Mentee improved',
        pass: finalMenteePoints.total_points > 0 && finalMentee.tasks_completed > 0
      },
      {
        name: 'Stats tracked',
        pass: finalMentor.mentorships_given > 0
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
    console.log('✅ TEST PASSED: Mentorship Flow');
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
