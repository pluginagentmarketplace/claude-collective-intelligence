#!/usr/bin/env node
/**
 * Integration Test: Mentorship System
 * Tests complete mentorship flow with RabbitMQ:
 * - Agent enrollment and initialization
 * - Mentor-mentee pairing
 * - Knowledge transfer via message queues
 * - Progress tracking across sessions
 * - Graduation and level advancement
 * - 3-day accelerated training validation
 */

import MentorshipSystem from '../../scripts/mentorship-system.js';
import RabbitMQClient from '../../scripts/rabbitmq-client.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';
import { TransferType } from '../../scripts/mentorship/knowledge-transfer.js';

class MentorshipSystemTest {
  constructor() {
    this.setup = new TestSetup();
    this.clients = [];
    this.mentorshipSystems = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       INTEGRATION TEST: MENTORSHIP SYSTEM                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      await this.testAgentEnrollment();
      await this.testMentorPairing();
      await this.testKnowledgeTransfer();
      await this.testProgressTracking();
      await this.testGraduation();
      await this.testMultipleMentorships();
      await this.testAcceleratedTraining();
      await this.testMentorWorkload();

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
   * Test 1: Agent Enrollment
   */
  async testAgentEnrollment() {
    console.log('\n📝 Test 1: Agent Enrollment & Initialization');
    console.log('─'.repeat(60));

    try {
      const { client, mentorshipSystem } = await this.createMentorshipAgent('enrollment-agent');

      // Initialize agent
      console.log('  → Enrolling new agent...');
      const profile = mentorshipSystem.initializeAgent('junior-agent-1', 'worker');

      // Verify profile
      assert(profile !== null, 'Profile should be created');
      assertEqual(profile.agentId, 'junior-agent-1', 'Agent ID should match');
      assertEqual(profile.currentLevel, 0, 'Should start at Level 0');
      assertEqual(profile.mentees.length, 0, 'Should have no mentees');
      assert(profile.mentorId === null, 'Should have no mentor initially');

      console.log('  ✅ Agent enrollment successful');
      this.testResults.passed++;
    } catch (error) {
      console.error('  ❌ Agent enrollment failed:', error.message);
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    }
  }

  /**
   * Test 2: Mentor-Mentee Pairing
   */
  async testMentorPairing() {
    console.log('\n📝 Test 2: Mentor-Mentee Pairing');
    console.log('─'.repeat(60));

    try {
      const { client, mentorshipSystem } = await this.createMentorshipAgent('pairing-agent');

      // Create mentor (Level 3) and mentee (Level 0)
      console.log('  → Creating mentor and mentee...');
      mentorshipSystem.initializeAgent('mentor-agent-1', 'worker');
      mentorshipSystem.initializeAgent('mentee-agent-1', 'worker');

      const mentor = mentorshipSystem.getAgentProfile('mentor-agent-1');
      mentor.currentLevel = 3;
      mentor.skillProficiency.taskExecution = 0.9;
      mentor.skillProficiency.errorHandling = 0.85;

      // Pair them
      console.log('  → Pairing mentor with mentee...');
      const pairing = await mentorshipSystem.pairMentorMentee('mentee-agent-1');

      // Verify pairing
      assert(pairing !== null, 'Pairing should be created');
      assertEqual(pairing.mentorId, 'mentor-agent-1', 'Mentor should be assigned');
      assertEqual(pairing.menteeId, 'mentee-agent-1', 'Mentee should be assigned');
      assertEqual(pairing.status, 'active', 'Pairing should be active');

      // Verify profiles updated
      const mentee = mentorshipSystem.getAgentProfile('mentee-agent-1');
      assertEqual(mentee.mentorId, 'mentor-agent-1', 'Mentee should have mentor ID');
      assert(mentor.mentees.includes('mentee-agent-1'), 'Mentor should have mentee in list');

      console.log('  ✅ Mentor-mentee pairing successful');
      this.testResults.passed++;
    } catch (error) {
      console.error('  ❌ Mentor pairing failed:', error.message);
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    }
  }

  /**
   * Test 3: Knowledge Transfer
   */
  async testKnowledgeTransfer() {
    console.log('\n📝 Test 3: Knowledge Transfer via RabbitMQ');
    console.log('─'.repeat(60));

    try {
      const { client, mentorshipSystem } = await this.createMentorshipAgent('transfer-agent');

      // Setup knowledge queue
      await client.setupTaskQueue('agent.knowledge');

      // Create mentor and mentee
      mentorshipSystem.initializeAgent('mentor-transfer-1', 'worker');
      mentorshipSystem.initializeAgent('mentee-transfer-1', 'worker');

      // Transfer knowledge
      console.log('  → Transferring knowledge (Observation session)...');
      const transferId1 = await mentorshipSystem.transferKnowledge(
        'mentor-transfer-1',
        'mentee-transfer-1',
        TransferType.OBSERVATION,
        { task: 'basic-execution', steps: ['step1', 'step2'] }
      );

      await wait(500);

      console.log('  → Transferring knowledge (Pattern sharing)...');
      const transferId2 = await mentorshipSystem.transferKnowledge(
        'mentor-transfer-1',
        'mentee-transfer-1',
        TransferType.PATTERN_SHARING,
        {
          pattern: 'Retry Strategy',
          context: 'Network failures',
          solution: 'Exponential backoff'
        }
      );

      await wait(500);

      // Verify transfers
      const mentee = mentorshipSystem.getAgentProfile('mentee-transfer-1');
      assertEqual(mentee.trainingProgress.knowledgeTransfersReceived, 2, 'Should have 2 transfers');

      const mentor = mentorshipSystem.getAgentProfile('mentor-transfer-1');
      assertEqual(mentor.trainingProgress.knowledgeTransfersGiven, 2, 'Mentor should have given 2 transfers');

      console.log('  ✅ Knowledge transfer successful');
      this.testResults.passed++;
    } catch (error) {
      console.error('  ❌ Knowledge transfer failed:', error.message);
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    }
  }

  /**
   * Test 4: Progress Tracking
   */
  async testProgressTracking() {
    console.log('\n📝 Test 4: Progress Tracking');
    console.log('─'.repeat(60));

    try {
      const { client, mentorshipSystem } = await this.createMentorshipAgent('progress-agent');

      // Initialize agent
      mentorshipSystem.initializeAgent('tracking-agent-1', 'worker');

      // Update progress incrementally
      console.log('  → Updating progress (tasks)...');
      mentorshipSystem.updateProgress('tracking-agent-1', {
        tasksCompleted: 5
      });

      let agent = mentorshipSystem.getAgentProfile('tracking-agent-1');
      assertEqual(agent.trainingProgress.tasksCompleted, 5, 'Should have 5 tasks');

      console.log('  → Updating progress (more tasks)...');
      mentorshipSystem.updateProgress('tracking-agent-1', {
        tasksCompleted: 3,
        brainstormsAttended: 2
      });

      agent = mentorshipSystem.getAgentProfile('tracking-agent-1');
      assertEqual(agent.trainingProgress.tasksCompleted, 8, 'Should have 8 total tasks');
      assertEqual(agent.trainingProgress.brainstormsAttended, 2, 'Should have 2 brainstorms');

      console.log('  ✅ Progress tracking successful');
      this.testResults.passed++;
    } catch (error) {
      console.error('  ❌ Progress tracking failed:', error.message);
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    }
  }

  /**
   * Test 5: Agent Graduation
   */
  async testGraduation() {
    console.log('\n📝 Test 5: Agent Graduation (Level 0 → Level 1)');
    console.log('─'.repeat(60));

    try {
      const { client, mentorshipSystem } = await this.createMentorshipAgent('graduation-agent');

      // Setup status exchange to receive graduation events
      await client.setupStatusExchange('agent.status');

      // Initialize agent
      mentorshipSystem.initializeAgent('grad-agent-1', 'worker');

      // Update progress to meet Level 0 requirements
      console.log('  → Meeting graduation requirements...');
      mentorshipSystem.updateProgress('grad-agent-1', {
        tasksCompleted: 10,
        tasksSuccessRate: 0.95
      });

      await wait(500);

      // Verify graduation
      const agent = mentorshipSystem.getAgentProfile('grad-agent-1');
      assertEqual(agent.currentLevel, 1, 'Should graduate to Level 1');
      assertEqual(agent.milestones.length, 1, 'Should have 1 milestone');
      assertEqual(agent.badges.length, 1, 'Should have 1 badge');
      assertEqual(agent.badges[0].name, 'Level 1 Graduate', 'Badge should be Level 1 Graduate');

      console.log('  ✅ Agent graduation successful');
      this.testResults.passed++;
    } catch (error) {
      console.error('  ❌ Agent graduation failed:', error.message);
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    }
  }

  /**
   * Test 6: Multiple Concurrent Mentorships
   */
  async testMultipleMentorships() {
    console.log('\n📝 Test 6: Multiple Concurrent Mentorships');
    console.log('─'.repeat(60));

    try {
      const { client, mentorshipSystem } = await this.createMentorshipAgent('multi-mentor-agent');

      // Create 1 mentor and 3 mentees
      console.log('  → Creating 1 mentor and 3 mentees...');
      mentorshipSystem.initializeAgent('multi-mentor-1', 'worker');
      mentorshipSystem.initializeAgent('multi-mentee-1', 'worker');
      mentorshipSystem.initializeAgent('multi-mentee-2', 'worker');
      mentorshipSystem.initializeAgent('multi-mentee-3', 'worker');

      const mentor = mentorshipSystem.getAgentProfile('multi-mentor-1');
      mentor.currentLevel = 4;

      // Pair mentor with all 3 mentees
      console.log('  → Pairing mentor with 3 mentees...');
      await mentorshipSystem.pairMentorMentee('multi-mentee-1');
      await mentorshipSystem.pairMentorMentee('multi-mentee-2');
      await mentorshipSystem.pairMentorMentee('multi-mentee-3');

      await wait(500);

      // Verify
      assertEqual(mentor.mentees.length, 3, 'Mentor should have 3 mentees');

      const stats = mentorshipSystem.getMentorshipStats();
      assertEqual(stats.activeMentorships, 3, 'Should have 3 active mentorships');

      console.log('  ✅ Multiple mentorships successful');
      this.testResults.passed++;
    } catch (error) {
      console.error('  ❌ Multiple mentorships failed:', error.message);
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    }
  }

  /**
   * Test 7: Accelerated 3-Day Training
   */
  async testAcceleratedTraining() {
    console.log('\n📝 Test 7: Accelerated Training (Level 0 → Level 2 in 3 days)');
    console.log('─'.repeat(60));

    try {
      const { client, mentorshipSystem } = await this.createMentorshipAgent('accelerated-agent');

      // Create mentor and mentee
      console.log('  → Setting up accelerated training...');
      mentorshipSystem.initializeAgent('accel-mentor-1', 'worker');
      mentorshipSystem.initializeAgent('accel-mentee-1', 'worker');

      const mentor = mentorshipSystem.getAgentProfile('accel-mentor-1');
      mentor.currentLevel = 5;

      // Pair them
      const pairing = await mentorshipSystem.pairMentorMentee('accel-mentee-1');
      assert(pairing.curriculum !== undefined, 'Should have 3-day curriculum');
      assertEqual(pairing.curriculum.duration, 3, 'Should be 3-day program');

      // Simulate Day 1 progress
      console.log('  → Simulating Day 1 (Level 0 → 1)...');
      mentorshipSystem.updateProgress('accel-mentee-1', {
        tasksCompleted: 10,
        tasksSuccessRate: 0.92
      });

      let mentee = mentorshipSystem.getAgentProfile('accel-mentee-1');
      assertEqual(mentee.currentLevel, 1, 'Should reach Level 1 after Day 1');

      // Simulate Day 2 progress
      console.log('  → Simulating Day 2 (Level 1 → 2)...');
      mentorshipSystem.updateProgress('accel-mentee-1', {
        tasksCompleted: 15,
        errorHandlingSuccesses: 5,
        brainstormsAttended: 3
      });

      mentee = mentorshipSystem.getAgentProfile('accel-mentee-1');
      assertEqual(mentee.currentLevel, 2, 'Should reach Level 2 after Day 2');

      // Simulate Day 3 progress
      console.log('  → Simulating Day 3 (Level 2 → 3)...');
      mentorshipSystem.updateProgress('accel-mentee-1', {
        complexTasksCompleted: 1,
        brainstormsInitiated: 2
      });

      mentee = mentorshipSystem.getAgentProfile('accel-mentee-1');
      assertEqual(mentee.currentLevel, 3, 'Should reach Level 3 after Day 3');

      // Verify acceleration
      const stats = mentorshipSystem.getMentorshipStats();
      console.log(`  → Training time: ${stats.averageTrainingTime.toFixed(1)} days`);
      console.log(`  → Acceleration factor: ${stats.accelerationFactor.toFixed(1)}x`);

      console.log('  ✅ Accelerated training successful');
      this.testResults.passed++;
    } catch (error) {
      console.error('  ❌ Accelerated training failed:', error.message);
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    }
  }

  /**
   * Test 8: Mentor Workload Tracking
   */
  async testMentorWorkload() {
    console.log('\n📝 Test 8: Mentor Workload Tracking');
    console.log('─'.repeat(60));

    try {
      const { client, mentorshipSystem } = await this.createMentorshipAgent('workload-agent');

      // Create mentors with different workloads
      console.log('  → Creating mentors with varying workloads...');

      // Mentor 1: No mentees
      mentorshipSystem.initializeAgent('workload-mentor-1', 'worker');
      const m1 = mentorshipSystem.getAgentProfile('workload-mentor-1');
      m1.currentLevel = 3;

      // Mentor 2: 2 mentees
      mentorshipSystem.initializeAgent('workload-mentor-2', 'worker');
      const m2 = mentorshipSystem.getAgentProfile('workload-mentor-2');
      m2.currentLevel = 4;
      m2.mentees = ['m1', 'm2'];

      // Mentor 3: 3 mentees (full)
      mentorshipSystem.initializeAgent('workload-mentor-3', 'worker');
      const m3 = mentorshipSystem.getAgentProfile('workload-mentor-3');
      m3.currentLevel = 5;
      m3.mentees = ['m3', 'm4', 'm5'];

      // Get stats
      const stats = mentorshipSystem.getMentorshipStats();

      console.log(`  → Total mentors: ${stats.mentorWorkload.totalMentors}`);
      console.log(`  → Average mentees: ${stats.mentorWorkload.averageMentees.toFixed(1)}`);
      console.log(`  → Utilization: ${(stats.mentorWorkload.utilizationRate * 100).toFixed(0)}%`);

      assert(stats.mentorWorkload.totalMentors === 3, 'Should have 3 mentors');
      assert(stats.mentorWorkload.averageMentees > 1, 'Average should be > 1');
      assert(stats.mentorWorkload.distribution.idle === 1, 'Should have 1 idle mentor');
      assert(stats.mentorWorkload.distribution.full === 1, 'Should have 1 full mentor');

      console.log('  ✅ Mentor workload tracking successful');
      this.testResults.passed++;
    } catch (error) {
      console.error('  ❌ Mentor workload tracking failed:', error.message);
      this.testResults.failed++;
      this.testResults.errors.push(error.message);
    }
  }

  /**
   * Helper: Create mentorship agent with RabbitMQ client
   */
  async createMentorshipAgent(agentId) {
    const client = new RabbitMQClient({
      url: this.setup.getRabbitMQUrl()
    });
    client.agentId = agentId;

    await client.connect();

    // Setup exchanges and queues
    await client.setupTaskQueue('agent.tasks');
    await client.setupStatusExchange('agent.status');

    const mentorshipSystem = new MentorshipSystem(client);

    this.clients.push(client);
    this.mentorshipSystems.push(mentorshipSystem);

    return { client, mentorshipSystem };
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     TEST RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`  ✅ Passed: ${this.testResults.passed}`);
    console.log(`  ❌ Failed: ${this.testResults.failed}`);

    if (this.testResults.errors.length > 0) {
      console.log('\n  Errors:');
      this.testResults.errors.forEach((error, i) => {
        console.log(`    ${i + 1}. ${error}`);
      });
    }

    const total = this.testResults.passed + this.testResults.failed;
    const percentage = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;

    console.log(`\n  Success Rate: ${percentage}%`);

    if (this.testResults.failed === 0) {
      console.log('\n  🎉 All tests passed!\n');
    } else {
      console.log('\n  ⚠️  Some tests failed.\n');
    }
  }

  /**
   * Cleanup
   */
  async cleanup() {
    console.log('\n🧹 Cleaning up...');

    // Close all clients
    for (const client of this.clients) {
      try {
        await client.close();
      } catch (error) {
        console.error('Error closing client:', error.message);
      }
    }

    // Optionally stop RabbitMQ
    // await this.setup.stopRabbitMQ();

    console.log('✅ Cleanup complete\n');
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new MentorshipSystemTest();
  const success = await test.runTests();
  process.exit(success ? 0 : 1);
}

export default MentorshipSystemTest;
