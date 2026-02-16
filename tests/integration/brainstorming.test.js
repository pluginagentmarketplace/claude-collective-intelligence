#!/usr/bin/env node
/**
 * Integration Test: Brainstorming
 * Tests brainstorming flow:
 * - Worker initiates brainstorm
 * - Collaborators receive broadcast
 * - Collaborators respond
 * - Worker aggregates responses
 * - Consensus building
 */

import AgentOrchestrator from '../../src/core/orchestrator.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';

class BrainstormingTest {
  constructor() {
    this.setup = new TestSetup();
    this.agents = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          INTEGRATION TEST: BRAINSTORMING                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      await this.testBasicBrainstorm();
      await this.testMultipleCollaborators();
      await this.testBrainstormWithTaskFlow();
      await this.testBrainstormResponseAggregation();
      await this.testConcurrentBrainstorms();

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
   * Test 1: Basic brainstorm session
   */
  async testBasicBrainstorm() {
    console.log('\n📝 Test 1: Basic Brainstorm Session');
    console.log('─'.repeat(60));

    try {
      // Create initiator and one collaborator
      const initiator = new AgentOrchestrator('worker');
      const collaborator = new AgentOrchestrator('collaborator');
      this.agents = [initiator, collaborator];

      await initiator.initialize();
      await collaborator.initialize();

      // Track responses
      const responses = [];
      initiator.handleResult = async (msg) => {
        if (msg.result.type === 'brainstorm_response') {
          responses.push(msg.result);
        }
      };

      // Start agents
      await initiator.startWorker();
      await collaborator.startCollaborator();

      await wait(500);

      // Initiate brainstorm
      console.log('  → Initiating brainstorm session...');
      const sessionId = await initiator.initiateBrainstorm({
        topic: 'Test Brainstorm',
        question: 'How should we approach this test?',
        requiredAgents: []
      });

      console.log(`  → Brainstorm session: ${sessionId}`);

      // Wait for response
      await waitForCondition(() => responses.length >= 1, 5000);

      // Verify
      assert(responses.length >= 1, 'Should receive at least 1 response');

      const response = responses[0];
      assertEqual(response.sessionId, sessionId, 'Session ID should match');
      assertEqual(response.type, 'brainstorm_response', 'Type should be brainstorm_response');
      assert(response.from === collaborator.agentId, 'Response should be from collaborator');
      assert(response.suggestion && response.suggestion.length > 0, 'Should have a suggestion');

      // Verify stats
      assert(collaborator.stats.brainstormsParticipated >= 1, 'Collaborator should have participated');

      console.log('  ✅ Basic brainstorm test passed');
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
   * Test 2: Multiple collaborators
   */
  async testMultipleCollaborators() {
    console.log('\n📝 Test 2: Multiple Collaborators');
    console.log('─'.repeat(60));

    try {
      // Create initiator and multiple collaborators
      const initiator = new AgentOrchestrator('worker');
      const collab1 = new AgentOrchestrator('collaborator');
      const collab2 = new AgentOrchestrator('collaborator');
      const collab3 = new AgentOrchestrator('collaborator');
      this.agents = [initiator, collab1, collab2, collab3];

      await Promise.all([
        initiator.initialize(),
        collab1.initialize(),
        collab2.initialize(),
        collab3.initialize()
      ]);

      // Track responses
      const responses = [];
      initiator.handleResult = async (msg) => {
        if (msg.result.type === 'brainstorm_response') {
          responses.push(msg.result);
        }
      };

      // Start agents
      await Promise.all([
        initiator.startWorker(),
        collab1.startCollaborator(),
        collab2.startCollaborator(),
        collab3.startCollaborator()
      ]);

      await wait(500);

      // Initiate brainstorm
      console.log('  → Initiating brainstorm with 3 collaborators...');
      const sessionId = await initiator.initiateBrainstorm({
        topic: 'Multi-Collaborator Test',
        question: 'What are your suggestions?',
        requiredAgents: []
      });

      // Wait for all responses (with generous timeout)
      console.log('  → Waiting for responses from all collaborators...');
      await waitForCondition(() => responses.length >= 3, 8000);

      // Verify
      assert(responses.length >= 3, 'Should receive responses from all 3 collaborators');

      // Check all responses have same session ID
      responses.forEach(response => {
        assertEqual(response.sessionId, sessionId, 'All responses should have same session ID');
      });

      // Verify unique agents responded
      const uniqueAgents = new Set(responses.map(r => r.from));
      assert(uniqueAgents.size >= 3, 'Should have responses from at least 3 different agents');

      console.log('  ✅ Multiple collaborators test passed');
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
   * Test 3: Brainstorm within task flow
   */
  async testBrainstormWithTaskFlow() {
    console.log('\n📝 Test 3: Brainstorm Within Task Flow');
    console.log('─'.repeat(60));

    try {
      const leader = new AgentOrchestrator('leader');
      const worker = new AgentOrchestrator('worker');
      const collab1 = new AgentOrchestrator('collaborator');
      const collab2 = new AgentOrchestrator('collaborator');
      this.agents = [leader, worker, collab1, collab2];

      await Promise.all([
        leader.initialize(),
        worker.initialize(),
        collab1.initialize(),
        collab2.initialize()
      ]);

      // Track results
      const taskResults = [];
      const brainstormResponses = [];

      leader.handleResult = async (msg) => {
        if (msg.result.type === 'brainstorm_response') {
          brainstormResponses.push(msg.result);
        } else {
          taskResults.push(msg.result);
        }
      };

      await Promise.all([
        leader.startTeamLeader(),
        worker.startWorker(),
        collab1.startCollaborator(),
        collab2.startCollaborator()
      ]);

      await wait(500);

      // Assign task that requires collaboration
      console.log('  → Assigning task that requires collaboration...');
      const taskId = await leader.assignTask({
        title: 'Collaborative Task',
        description: 'Task requiring brainstorming',
        priority: 'high',
        requiresCollaboration: true,
        collaborationQuestion: 'How should we solve this?'
      });

      console.log('  → Waiting for brainstorm responses...');
      await waitForCondition(() => brainstormResponses.length >= 2, 8000);

      console.log('  → Waiting for task completion...');
      await waitForCondition(() => taskResults.length >= 1, 10000);

      // Verify brainstorm happened
      assert(brainstormResponses.length >= 2, 'Should have brainstorm responses');

      // Verify task completed
      assert(taskResults.length >= 1, 'Task should be completed');
      const taskResult = taskResults[0];
      assertEqual(taskResult.taskId, taskId, 'Task ID should match');
      assertEqual(taskResult.status, 'completed', 'Task should be completed');

      console.log('  ✅ Brainstorm with task flow test passed');
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
   * Test 4: Brainstorm response aggregation
   */
  async testBrainstormResponseAggregation() {
    console.log('\n📝 Test 4: Brainstorm Response Aggregation');
    console.log('─'.repeat(60));

    try {
      const initiator = new AgentOrchestrator('worker');
      const collabs = [];

      // Create 4 collaborators
      for (let i = 0; i < 4; i++) {
        collabs.push(new AgentOrchestrator('collaborator'));
      }

      this.agents = [initiator, ...collabs];

      await initiator.initialize();
      await Promise.all(collabs.map(c => c.initialize()));

      // Track responses with timestamps
      const responses = [];
      initiator.handleResult = async (msg) => {
        if (msg.result.type === 'brainstorm_response') {
          responses.push({
            ...msg.result,
            receivedAt: Date.now()
          });
        }
      };

      await initiator.startWorker();
      await Promise.all(collabs.map(c => c.startCollaborator()));

      await wait(500);

      // Initiate brainstorm
      console.log('  → Initiating brainstorm for aggregation test...');
      const startTime = Date.now();
      const sessionId = await initiator.initiateBrainstorm({
        topic: 'Aggregation Test',
        question: 'Provide your input for aggregation',
        requiredAgents: []
      });

      // Wait for all responses
      console.log('  → Waiting for all 4 responses...');
      await waitForCondition(() => responses.length >= 4, 10000);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all responses
      assert(responses.length >= 4, 'Should receive all 4 responses');

      // Verify response structure
      responses.forEach((response, index) => {
        assertEqual(response.sessionId, sessionId, `Response ${index + 1} should have correct session ID`);
        assert(response.from, `Response ${index + 1} should have 'from' field`);
        assert(response.suggestion, `Response ${index + 1} should have suggestion`);
        assert(response.timestamp, `Response ${index + 1} should have timestamp`);
      });

      // Verify timing (all responses should come within reasonable time)
      console.log(`  → All responses received in ${totalTime}ms`);
      assert(totalTime < 15000, 'All responses should be received within 15 seconds');

      console.log('  ✅ Response aggregation test passed');
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
   * Test 5: Concurrent brainstorm sessions
   */
  async testConcurrentBrainstorms() {
    console.log('\n📝 Test 5: Concurrent Brainstorm Sessions');
    console.log('─'.repeat(60));

    try {
      const initiator1 = new AgentOrchestrator('worker');
      const initiator2 = new AgentOrchestrator('worker');
      const collab1 = new AgentOrchestrator('collaborator');
      const collab2 = new AgentOrchestrator('collaborator');
      this.agents = [initiator1, initiator2, collab1, collab2];

      await Promise.all([
        initiator1.initialize(),
        initiator2.initialize(),
        collab1.initialize(),
        collab2.initialize()
      ]);

      // Track responses by session
      const responsesBySession = new Map();

      const trackResponses = (initiator) => {
        initiator.handleResult = async (msg) => {
          if (msg.result.type === 'brainstorm_response') {
            const sessionId = msg.result.sessionId;
            if (!responsesBySession.has(sessionId)) {
              responsesBySession.set(sessionId, []);
            }
            responsesBySession.get(sessionId).push(msg.result);
          }
        };
      };

      trackResponses(initiator1);
      trackResponses(initiator2);

      await Promise.all([
        initiator1.startWorker(),
        initiator2.startWorker(),
        collab1.startCollaborator(),
        collab2.startCollaborator()
      ]);

      await wait(500);

      // Initiate two concurrent brainstorms
      console.log('  → Initiating two concurrent brainstorm sessions...');
      const session1 = await initiator1.initiateBrainstorm({
        topic: 'Concurrent Session 1',
        question: 'Question for session 1'
      });

      const session2 = await initiator2.initiateBrainstorm({
        topic: 'Concurrent Session 2',
        question: 'Question for session 2'
      });

      console.log(`  → Session 1: ${session1}`);
      console.log(`  → Session 2: ${session2}`);

      // Wait for responses to both sessions
      console.log('  → Waiting for responses to both sessions...');
      await waitForCondition(
        () => responsesBySession.size >= 2,
        10000
      );

      // Verify both sessions got responses
      assert(responsesBySession.has(session1), 'Session 1 should have responses');
      assert(responsesBySession.has(session2), 'Session 2 should have responses');

      const session1Responses = responsesBySession.get(session1);
      const session2Responses = responsesBySession.get(session2);

      assert(session1Responses.length >= 2, 'Session 1 should have at least 2 responses');
      assert(session2Responses.length >= 2, 'Session 2 should have at least 2 responses');

      // Verify responses are correctly associated with sessions
      session1Responses.forEach(r => {
        assertEqual(r.sessionId, session1, 'Response should belong to session 1');
      });

      session2Responses.forEach(r => {
        assertEqual(r.sessionId, session2, 'Response should belong to session 2');
      });

      console.log('  ✅ Concurrent brainstorms test passed');
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
   * Cleanup agents
   */
  async cleanupAgents() {
    for (const agent of this.agents) {
      try {
        await agent.shutdown();
      } catch (error) {
        // Ignore
      }
    }
    this.agents = [];
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
  const test = new BrainstormingTest();
  test.runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

export default BrainstormingTest;
