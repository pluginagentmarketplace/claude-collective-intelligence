#!/usr/bin/env node
/**
 * Integration Test: Voting System
 * Tests multi-agent voting with RabbitMQ:
 * - Multiple agents participate in voting
 * - Different voting algorithms
 * - Quorum validation
 * - Real-time vote aggregation
 * - Audit trail verification
 */

import VotingSystem from '../../src/systems/voting/system.js';
import RabbitMQClient from '../../src/core/rabbitmq-client.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';

class VotingSystemTest {
  constructor() {
    this.setup = new TestSetup();
    this.clients = [];
    this.votingSystems = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          INTEGRATION TEST: VOTING SYSTEM                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      await this.testSimpleMajorityVoting();
      await this.testConfidenceWeightedVoting();
      await this.testQuadraticVoting();
      await this.testConsensusVoting();
      await this.testRankedChoiceVoting();
      await this.testQuorumValidation();
      await this.testVoteAuditTrail();
      await this.testConcurrentVotingSessions();

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
   * Test 1: Simple Majority Voting
   */
  async testSimpleMajorityVoting() {
    console.log('\n📝 Test 1: Simple Majority Voting');
    console.log('─'.repeat(60));

    try {
      // Create 5 agents
      const agents = await this.createAgents(5);
      const initiator = agents[0];

      // Initiate vote
      console.log('  → Initiating simple majority vote...');
      const sessionId = await initiator.votingSystem.initiateVote({
        topic: 'API Design',
        question: 'Should we use REST or GraphQL?',
        options: ['REST', 'GraphQL', 'Both'],
        algorithm: 'simple_majority',
        initiatedBy: initiator.client.agentId,
        totalAgents: 5,
        minParticipation: 0.6
      });

      console.log(`  → Voting session: ${sessionId}`);

      // Agents cast votes
      await wait(500);
      await agents[0].votingSystem.castVote(sessionId, agents[0].client.agentId, { choice: 'GraphQL' });
      await agents[1].votingSystem.castVote(sessionId, agents[1].client.agentId, { choice: 'GraphQL' });
      await agents[2].votingSystem.castVote(sessionId, agents[2].client.agentId, { choice: 'REST' });
      await agents[3].votingSystem.castVote(sessionId, agents[3].client.agentId, { choice: 'GraphQL' });

      await wait(500);

      // Close and get results
      console.log('  → Closing vote and calculating results...');
      const results = await initiator.votingSystem.closeVoting(sessionId);

      // Verify
      assert(results.status === 'SUCCESS', 'Vote should succeed');
      assertEqual(results.winner, 'GraphQL', 'GraphQL should win');
      assertEqual(results.totalVotes, 4, 'Should have 4 votes');
      assert(results.winnerPercentage > 0.5, 'Winner should have majority');

      console.log(`  → Winner: ${results.winner} (${(results.winnerPercentage * 100).toFixed(0)}%)`);
      console.log('  ✅ Simple majority voting test passed');
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
   * Test 2: Confidence-Weighted Voting
   */
  async testConfidenceWeightedVoting() {
    console.log('\n📝 Test 2: Confidence-Weighted Voting');
    console.log('─'.repeat(60));

    try {
      const agents = await this.createAgents(4);
      const initiator = agents[0];

      console.log('  → Initiating confidence-weighted vote...');
      const sessionId = await initiator.votingSystem.initiateVote({
        topic: 'Database Choice',
        question: 'PostgreSQL or MongoDB?',
        options: ['PostgreSQL', 'MongoDB'],
        algorithm: 'confidence_weighted',
        initiatedBy: initiator.client.agentId,
        totalAgents: 4,
        minParticipation: 0.5
      });

      // Cast votes with different confidence levels
      await wait(500);
      await agents[0].votingSystem.castVote(sessionId, agents[0].client.agentId, {
        choice: 'PostgreSQL',
        confidence: 0.9  // High confidence
      });
      await agents[1].votingSystem.castVote(sessionId, agents[1].client.agentId, {
        choice: 'MongoDB',
        confidence: 0.5  // Low confidence
      });
      await agents[2].votingSystem.castVote(sessionId, agents[2].client.agentId, {
        choice: 'PostgreSQL',
        confidence: 0.7  // Medium confidence
      });

      await wait(500);

      const results = await initiator.votingSystem.closeVoting(sessionId);

      assert(results.status === 'SUCCESS', 'Vote should succeed');
      assertEqual(results.winner, 'PostgreSQL', 'PostgreSQL should win due to higher confidence');
      assert(results.weightedTally['PostgreSQL'] > results.weightedTally['MongoDB'],
        'PostgreSQL should have higher weighted score');
      assert(results.averageConfidence > 0, 'Should have average confidence');

      console.log(`  → Winner: ${results.winner} (weighted score: ${results.winnerScore.toFixed(2)})`);
      console.log(`  → Average confidence: ${(results.averageConfidence * 100).toFixed(0)}%`);
      console.log('  ✅ Confidence-weighted voting test passed');
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
   * Test 3: Quadratic Voting
   */
  async testQuadraticVoting() {
    console.log('\n📝 Test 3: Quadratic Voting');
    console.log('─'.repeat(60));

    try {
      const agents = await this.createAgents(3);
      const initiator = agents[0];

      console.log('  → Initiating quadratic vote...');
      const sessionId = await initiator.votingSystem.initiateVote({
        topic: 'Feature Priority',
        question: 'Which features should we prioritize?',
        options: ['Performance', 'Security', 'UI/UX'],
        algorithm: 'quadratic',
        initiatedBy: initiator.client.agentId,
        totalAgents: 3,
        tokensPerAgent: 100,
        minParticipation: 0.5
      });

      // Cast votes with token allocations
      await wait(500);
      await agents[0].votingSystem.castVote(sessionId, agents[0].client.agentId, {
        allocation: {
          'Performance': 64,  // sqrt(64) = 8 votes
          'Security': 25,     // sqrt(25) = 5 votes
          'UI/UX': 11         // sqrt(11) = 3.3 votes
        }
      });
      await agents[1].votingSystem.castVote(sessionId, agents[1].client.agentId, {
        allocation: {
          'Security': 81,     // sqrt(81) = 9 votes
          'Performance': 16,  // sqrt(16) = 4 votes
          'UI/UX': 3          // sqrt(3) = 1.7 votes
        }
      });

      await wait(500);

      const results = await initiator.votingSystem.closeVoting(sessionId);

      assert(results.status === 'SUCCESS', 'Vote should succeed');
      assert(results.winner !== null, 'Should have a winner');
      assert(results.tally, 'Should have vote tally');
      assert(results.tokenAllocationDetails.length === 2, 'Should have token allocation details');

      console.log(`  → Winner: ${results.winner} (${results.winnerVotes.toFixed(1)} quadratic votes)`);
      console.log('  → Vote distribution:');
      Object.keys(results.tally).forEach(option => {
        console.log(`      ${option}: ${results.tally[option].toFixed(1)} votes`);
      });
      console.log('  ✅ Quadratic voting test passed');
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
   * Test 4: Consensus Voting
   */
  async testConsensusVoting() {
    console.log('\n📝 Test 4: Consensus Voting');
    console.log('─'.repeat(60));

    try {
      const agents = await this.createAgents(4);
      const initiator = agents[0];

      console.log('  → Initiating consensus vote (75% threshold)...');
      const sessionId = await initiator.votingSystem.initiateVote({
        topic: 'Critical Decision',
        question: 'Proceed with migration?',
        options: ['Yes', 'No'],
        algorithm: 'consensus',
        initiatedBy: initiator.client.agentId,
        totalAgents: 4,
        consensusThreshold: 0.75,
        minParticipation: 0.5
      });

      // Cast votes - 3 Yes, 1 No (75% consensus)
      await wait(500);
      await agents[0].votingSystem.castVote(sessionId, agents[0].client.agentId, { choice: 'Yes' });
      await agents[1].votingSystem.castVote(sessionId, agents[1].client.agentId, { choice: 'Yes' });
      await agents[2].votingSystem.castVote(sessionId, agents[2].client.agentId, { choice: 'Yes' });
      await agents[3].votingSystem.castVote(sessionId, agents[3].client.agentId, { choice: 'No' });

      await wait(500);

      const results = await initiator.votingSystem.closeVoting(sessionId);

      assert(results.status === 'SUCCESS', 'Vote should succeed');
      assertEqual(results.winner, 'Yes', 'Yes should win');
      assert(results.consensusReached === true, 'Consensus should be reached');
      assertEqual(results.requiredThreshold, 0.75, 'Threshold should be 75%');

      console.log(`  → Winner: ${results.winner}`);
      console.log(`  → Consensus reached: ${results.consensusReached ? 'YES' : 'NO'}`);
      console.log(`  → Support: ${(results.winnerPercentage * 100).toFixed(0)}% (threshold: ${(results.requiredThreshold * 100).toFixed(0)}%)`);
      console.log('  ✅ Consensus voting test passed');
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
   * Test 5: Ranked Choice Voting
   */
  async testRankedChoiceVoting() {
    console.log('\n📝 Test 5: Ranked Choice Voting');
    console.log('─'.repeat(60));

    try {
      const agents = await this.createAgents(5);
      const initiator = agents[0];

      console.log('  → Initiating ranked choice vote...');
      const sessionId = await initiator.votingSystem.initiateVote({
        topic: 'Framework Selection',
        question: 'Which framework should we use?',
        options: ['React', 'Vue', 'Angular', 'Svelte'],
        algorithm: 'ranked_choice',
        initiatedBy: initiator.client.agentId,
        totalAgents: 5,
        minParticipation: 0.6
      });

      // Cast ranked votes
      await wait(500);
      await agents[0].votingSystem.castVote(sessionId, agents[0].client.agentId, {
        rankings: ['React', 'Vue', 'Svelte', 'Angular']
      });
      await agents[1].votingSystem.castVote(sessionId, agents[1].client.agentId, {
        rankings: ['Vue', 'React', 'Svelte', 'Angular']
      });
      await agents[2].votingSystem.castVote(sessionId, agents[2].client.agentId, {
        rankings: ['React', 'Svelte', 'Vue', 'Angular']
      });
      await agents[3].votingSystem.castVote(sessionId, agents[3].client.agentId, {
        rankings: ['Svelte', 'React', 'Vue', 'Angular']
      });

      await wait(500);

      const results = await initiator.votingSystem.closeVoting(sessionId);

      assert(results.status === 'SUCCESS', 'Vote should succeed');
      assert(results.winner !== null, 'Should have a winner');
      assert(results.rounds, 'Should have elimination rounds');
      assert(results.eliminationRounds >= 0, 'Should track elimination rounds');

      console.log(`  → Winner: ${results.winner}`);
      console.log(`  → Elimination rounds: ${results.eliminationRounds}`);
      console.log(`  → Final support: ${(results.winnerPercentage * 100).toFixed(0)}%`);
      console.log('  ✅ Ranked choice voting test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 5: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Test 6: Quorum Validation
   */
  async testQuorumValidation() {
    console.log('\n📝 Test 6: Quorum Validation');
    console.log('─'.repeat(60));

    try {
      const agents = await this.createAgents(5);
      const initiator = agents[0];

      console.log('  → Initiating vote with strict quorum requirements...');
      const sessionId = await initiator.votingSystem.initiateVote({
        topic: 'Quorum Test',
        question: 'Test question',
        options: ['A', 'B'],
        algorithm: 'simple_majority',
        initiatedBy: initiator.client.agentId,
        totalAgents: 5,
        minParticipation: 0.8,  // Need 4/5 agents
        minConfidence: 3.0,     // Need total confidence of 3.0
        minExperts: 1           // Need at least 1 expert (level 4+)
      });

      // Only 2 agents vote (fails participation quorum)
      await wait(500);
      await agents[0].votingSystem.castVote(sessionId, agents[0].client.agentId, {
        choice: 'A',
        confidence: 0.8
      });
      await agents[1].votingSystem.castVote(sessionId, agents[1].client.agentId, {
        choice: 'B',
        confidence: 0.7
      });

      await wait(500);

      const results = await initiator.votingSystem.closeVoting(sessionId);

      assert(results.status === 'QUORUM_NOT_MET', 'Quorum should not be met');
      assert(results.quorumValidation, 'Should have quorum validation details');
      assert(!results.quorumValidation.isValid(), 'Quorum should be invalid');

      console.log('  → Quorum validation results:');
      console.log(`      Participation: ${results.quorumValidation.participationQuorumMet ? '✓' : '✗'} (${(results.quorumValidation.participationRate * 100).toFixed(0)}%)`);
      console.log(`      Confidence: ${results.quorumValidation.confidenceQuorumMet ? '✓' : '✗'} (${results.quorumValidation.totalConfidence.toFixed(1)})`);
      console.log(`      Experts: ${results.quorumValidation.expertQuorumMet ? '✓' : '✗'} (${results.quorumValidation.expertVotes})`);
      console.log('  ✅ Quorum validation test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 6: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Test 7: Vote Audit Trail
   */
  async testVoteAuditTrail() {
    console.log('\n📝 Test 7: Vote Audit Trail');
    console.log('─'.repeat(60));

    try {
      const agents = await this.createAgents(3);
      const initiator = agents[0];

      console.log('  → Initiating vote with audit trail...');
      const sessionId = await initiator.votingSystem.initiateVote({
        topic: 'Audit Test',
        question: 'Test audit trail',
        options: ['A', 'B'],
        algorithm: 'simple_majority',
        initiatedBy: initiator.client.agentId,
        totalAgents: 3,
        minParticipation: 0.5
      });

      // Cast votes
      await wait(500);
      await agents[0].votingSystem.castVote(sessionId, agents[0].client.agentId, {
        choice: 'A',
        confidence: 0.8
      });
      await agents[1].votingSystem.castVote(sessionId, agents[1].client.agentId, {
        choice: 'B',
        confidence: 0.9
      });

      await wait(500);

      // Get audit trail before closing
      const auditTrail = initiator.votingSystem.auditTrail.getSessionResults(sessionId);

      assert(auditTrail.totalVotes === 2, 'Audit trail should record 2 votes');
      assert(auditTrail.votes.length === 2, 'Should have 2 vote records');
      assert(auditTrail.verifiable === true, 'Should be verifiable');
      assert(auditTrail.auditTrailHash, 'Should have audit trail hash');

      // Verify integrity
      const isValid = initiator.votingSystem.verifyIntegrity(sessionId);
      assert(isValid === true, 'Vote integrity should be valid');

      await initiator.votingSystem.closeVoting(sessionId);

      console.log('  → Audit trail verified:');
      console.log(`      Total votes: ${auditTrail.totalVotes}`);
      console.log(`      Verifiable: ${auditTrail.verifiable ? 'YES' : 'NO'}`);
      console.log(`      Integrity: ${isValid ? 'VALID' : 'INVALID'}`);
      console.log('  ✅ Vote audit trail test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 7: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Test 8: Concurrent Voting Sessions
   */
  async testConcurrentVotingSessions() {
    console.log('\n📝 Test 8: Concurrent Voting Sessions');
    console.log('─'.repeat(60));

    try {
      const agents = await this.createAgents(4);
      const initiator = agents[0];

      console.log('  → Initiating two concurrent voting sessions...');

      // Session 1: Simple majority
      const sessionId1 = await initiator.votingSystem.initiateVote({
        topic: 'Session 1',
        question: 'Question 1?',
        options: ['A', 'B'],
        algorithm: 'simple_majority',
        initiatedBy: initiator.client.agentId,
        totalAgents: 4,
        minParticipation: 0.5
      });

      // Session 2: Confidence weighted
      const sessionId2 = await initiator.votingSystem.initiateVote({
        topic: 'Session 2',
        question: 'Question 2?',
        options: ['C', 'D'],
        algorithm: 'confidence_weighted',
        initiatedBy: initiator.client.agentId,
        totalAgents: 4,
        minParticipation: 0.5
      });

      // Cast votes for both sessions
      await wait(500);

      // Session 1 votes
      await agents[0].votingSystem.castVote(sessionId1, agents[0].client.agentId, { choice: 'A' });
      await agents[1].votingSystem.castVote(sessionId1, agents[1].client.agentId, { choice: 'B' });
      await agents[2].votingSystem.castVote(sessionId1, agents[2].client.agentId, { choice: 'A' });

      // Session 2 votes
      await agents[0].votingSystem.castVote(sessionId2, agents[0].client.agentId, {
        choice: 'C',
        confidence: 0.9
      });
      await agents[1].votingSystem.castVote(sessionId2, agents[1].client.agentId, {
        choice: 'D',
        confidence: 0.6
      });

      await wait(500);

      // Close both sessions
      const results1 = await initiator.votingSystem.closeVoting(sessionId1);
      const results2 = await initiator.votingSystem.closeVoting(sessionId2);

      // Verify both sessions completed independently
      assert(results1.status === 'SUCCESS', 'Session 1 should succeed');
      assert(results2.status === 'SUCCESS', 'Session 2 should succeed');
      assertEqual(results1.winner, 'A', 'Session 1 winner should be A');
      assertEqual(results2.winner, 'C', 'Session 2 winner should be C');

      console.log(`  → Session 1 winner: ${results1.winner} (${results1.algorithm})`);
      console.log(`  → Session 2 winner: ${results2.winner} (${results2.algorithm})`);
      console.log('  ✅ Concurrent voting sessions test passed');
      this.testResults.passed++;
    } catch (error) {
      console.log(`  ❌ Test failed: ${error.message}`);
      this.testResults.failed++;
      this.testResults.errors.push(`Test 8: ${error.message}`);
    } finally {
      await this.cleanupAgents();
    }
  }

  /**
   * Create multiple agent instances
   */
  async createAgents(count) {
    const agents = [];

    for (let i = 0; i < count; i++) {
      const client = new RabbitMQClient({
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        heartbeat: 30,
        autoReconnect: false
      });

      await client.connect();
      await client.setupBrainstormExchange();

      const votingSystem = new VotingSystem(client);

      this.clients.push(client);
      this.votingSystems.push(votingSystem);

      agents.push({ client, votingSystem });
    }

    await wait(500);
    return agents;
  }

  /**
   * Cleanup agents
   */
  async cleanupAgents() {
    for (const client of this.clients) {
      try {
        await client.close();
      } catch (error) {
        // Ignore
      }
    }
    this.clients = [];
    this.votingSystems = [];
    await wait(500);
  }

  /**
   * Final cleanup
   */
  async cleanup() {
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
  const test = new VotingSystemTest();
  test.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

export default VotingSystemTest;
