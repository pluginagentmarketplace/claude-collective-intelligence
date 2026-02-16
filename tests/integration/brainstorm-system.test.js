#!/usr/bin/env node
/**
 * Integration Test: Brainstorm System
 * Tests complete brainstorming workflow with multiple agents:
 * - Session creation and management
 * - Idea generation across multiple agents
 * - Idea combination and refinement
 * - Democratic voting system
 * - Real-time broadcasting via RabbitMQ
 */

import { BrainstormSystem, IdeaCategory } from '../../src/systems/brainstorm/system.js';
import TestSetup, { waitForCondition, wait, assert, assertEqual } from './setup.js';

class BrainstormSystemTest {
  constructor() {
    this.setup = new TestSetup();
    this.systems = [];
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       INTEGRATION TEST: BRAINSTORM SYSTEM                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
      await this.setup.startRabbitMQ();
      await this.setup.cleanupQueues();

      await this.testBasicSessionManagement();
      await this.testMultiAgentIdeaGeneration();
      await this.testIdeaCombination();
      await this.testIdeaRefinement();
      await this.testVotingSystem();
      await this.testCompleteWorkflow();
      await this.testConcurrentSessions();
      await this.testScaling();

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
   * Test 1: Basic session management
   */
  async testBasicSessionManagement() {
    console.log('\n📝 Test 1: Basic Session Management');
    console.log('─'.repeat(60));

    try {
      const system = new BrainstormSystem('session-manager');
      this.systems = [system];

      await system.initialize();
      console.log('  ✓ System initialized');

      // Start session
      const sessionId = await system.startSession('Test Session', {
        duration: 5000,
        minIdeas: 5,
        maxIdeas: 100
      });

      assert(sessionId, 'Session ID should be generated');
      assert(system.activeSessions.has(sessionId), 'Session should be active');
      console.log('  ✓ Session started');

      const session = system.activeSessions.get(sessionId);
      assertEqual(session.topic, 'Test Session', 'Topic should match');
      assertEqual(session.status, 'active', 'Status should be active');
      console.log('  ✓ Session configuration verified');

      // Stop session
      await system.stopSession(sessionId);
      assertEqual(session.status, 'stopped', 'Status should be stopped');
      console.log('  ✓ Session stopped');

      this.testResults.passed++;
      console.log('✅ Test 1 PASSED\n');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(`Test 1: ${error.message}`);
      console.error('❌ Test 1 FAILED:', error.message, '\n');
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test 2: Multi-agent idea generation
   */
  async testMultiAgentIdeaGeneration() {
    console.log('\n📝 Test 2: Multi-Agent Idea Generation');
    console.log('─'.repeat(60));

    try {
      // Create 3 agents
      const agent1 = new BrainstormSystem('agent-1');
      const agent2 = new BrainstormSystem('agent-2');
      const agent3 = new BrainstormSystem('agent-3');
      this.systems = [agent1, agent2, agent3];

      await agent1.initialize();
      await agent2.initialize();
      await agent3.initialize();
      console.log('  ✓ 3 agents initialized');

      // Agent 1 starts session
      const sessionId = await agent1.startSession('Collaborative Ideas', {
        duration: 10000,
        minIdeas: 10,
        maxIdeas: 100
      });
      console.log('  ✓ Session started by agent-1');

      // Wait for other agents to receive session start
      await wait(500);

      // All agents propose ideas
      const ideas = [];
      ideas.push(await agent1.proposeIdea(sessionId, 'Agent 1 Idea: Implement feature X', IdeaCategory.FEATURE));
      ideas.push(await agent2.proposeIdea(sessionId, 'Agent 2 Idea: Improve performance', IdeaCategory.PERFORMANCE));
      ideas.push(await agent3.proposeIdea(sessionId, 'Agent 3 Idea: Add tests', IdeaCategory.TESTING));
      console.log('  ✓ 3 ideas proposed');

      // Wait for broadcast propagation
      await waitForCondition(() => {
        return agent1.allIdeas.size >= 3 &&
               agent2.allIdeas.size >= 3 &&
               agent3.allIdeas.size >= 3;
      }, 5000);

      // Verify all agents received all ideas
      assert(agent1.allIdeas.size >= 3, 'Agent 1 should have all ideas');
      assert(agent2.allIdeas.size >= 3, 'Agent 2 should have all ideas');
      assert(agent3.allIdeas.size >= 3, 'Agent 3 should have all ideas');
      console.log('  ✓ All agents received all ideas');

      // Verify idea distribution
      assertEqual(agent1.myIdeas.size, 1, 'Agent 1 should have 1 own idea');
      assertEqual(agent2.myIdeas.size, 1, 'Agent 2 should have 1 own idea');
      assertEqual(agent3.myIdeas.size, 1, 'Agent 3 should have 1 own idea');
      console.log('  ✓ Idea ownership verified');

      // Check statistics
      assertEqual(agent1.stats.ideasGenerated, 1, 'Agent 1 stats should be correct');
      assertEqual(agent2.stats.ideasGenerated, 1, 'Agent 2 stats should be correct');
      assertEqual(agent3.stats.ideasGenerated, 1, 'Agent 3 stats should be correct');
      console.log('  ✓ Statistics verified');

      this.testResults.passed++;
      console.log('✅ Test 2 PASSED\n');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(`Test 2: ${error.message}`);
      console.error('❌ Test 2 FAILED:', error.message, '\n');
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test 3: Idea combination
   */
  async testIdeaCombination() {
    console.log('\n📝 Test 3: Idea Combination');
    console.log('─'.repeat(60));

    try {
      const agent1 = new BrainstormSystem('combiner-1');
      const agent2 = new BrainstormSystem('combiner-2');
      this.systems = [agent1, agent2];

      await agent1.initialize();
      await agent2.initialize();
      console.log('  ✓ Agents initialized');

      const sessionId = await agent1.startSession('Combination Test', {
        allowCombination: true
      });
      await wait(300);

      // Propose initial ideas
      const idea1 = await agent1.proposeIdea(sessionId, 'Feature A', IdeaCategory.FEATURE);
      const idea2 = await agent1.proposeIdea(sessionId, 'Feature B', IdeaCategory.FEATURE);
      await wait(300);

      // Agent 2 combines ideas
      const combinedId = await agent2.combineIdeas(
        sessionId,
        [idea1, idea2],
        'Combined Features A and B into unified solution',
        IdeaCategory.FEATURE
      );
      console.log('  ✓ Ideas combined');

      // Wait for propagation
      await waitForCondition(() => agent1.allIdeas.has(combinedId), 5000);

      // Verify combination
      const combinedIdea = agent2.allIdeas.get(combinedId);
      assert(combinedIdea, 'Combined idea should exist');
      assertEqual(combinedIdea.combinedFrom.length, 2, 'Should have 2 source ideas');
      assert(combinedIdea.combinedFrom.includes(idea1), 'Should include idea1');
      assert(combinedIdea.combinedFrom.includes(idea2), 'Should include idea2');
      console.log('  ✓ Combination verified');

      // Check stats
      assertEqual(agent2.stats.ideasCombined, 1, 'Combination stats should be updated');
      console.log('  ✓ Statistics verified');

      this.testResults.passed++;
      console.log('✅ Test 3 PASSED\n');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(`Test 3: ${error.message}`);
      console.error('❌ Test 3 FAILED:', error.message, '\n');
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test 4: Idea refinement
   */
  async testIdeaRefinement() {
    console.log('\n📝 Test 4: Idea Refinement');
    console.log('─'.repeat(60));

    try {
      const agent1 = new BrainstormSystem('refiner-1');
      const agent2 = new BrainstormSystem('refiner-2');
      this.systems = [agent1, agent2];

      await agent1.initialize();
      await agent2.initialize();
      console.log('  ✓ Agents initialized');

      const sessionId = await agent1.startSession('Refinement Test', {
        allowRefinement: true
      });
      await wait(300);

      // Agent 1 proposes initial idea
      const originalId = await agent1.proposeIdea(
        sessionId,
        'Basic implementation of feature',
        IdeaCategory.FEATURE
      );
      await wait(300);

      // Agent 2 refines the idea
      const refinedId = await agent2.refineIdea(
        sessionId,
        originalId,
        'Enhanced implementation with error handling and tests'
      );
      console.log('  ✓ Idea refined');

      // Wait for propagation
      await waitForCondition(() => agent1.allIdeas.has(refinedId), 5000);

      // Verify refinement
      const refinedIdea = agent2.allIdeas.get(refinedId);
      assert(refinedIdea, 'Refined idea should exist');
      assertEqual(refinedIdea.refinedFrom, originalId, 'Should reference original idea');
      assertEqual(refinedIdea.category, IdeaCategory.FEATURE, 'Should inherit category');
      console.log('  ✓ Refinement verified');

      // Check stats
      assertEqual(agent2.stats.ideasRefined, 1, 'Refinement stats should be updated');
      console.log('  ✓ Statistics verified');

      this.testResults.passed++;
      console.log('✅ Test 4 PASSED\n');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(`Test 4: ${error.message}`);
      console.error('❌ Test 4 FAILED:', error.message, '\n');
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test 5: Voting system
   */
  async testVotingSystem() {
    console.log('\n📝 Test 5: Voting System');
    console.log('─'.repeat(60));

    try {
      const agent1 = new BrainstormSystem('voter-1');
      const agent2 = new BrainstormSystem('voter-2');
      const agent3 = new BrainstormSystem('voter-3');
      this.systems = [agent1, agent2, agent3];

      await agent1.initialize();
      await agent2.initialize();
      await agent3.initialize();
      console.log('  ✓ Agents initialized');

      const sessionId = await agent1.startSession('Voting Test', {
        allowVoting: true
      });
      await wait(300);

      // Each agent proposes an idea
      const idea1 = await agent1.proposeIdea(sessionId, 'Idea from Agent 1', IdeaCategory.FEATURE);
      const idea2 = await agent2.proposeIdea(sessionId, 'Idea from Agent 2', IdeaCategory.IMPROVEMENT);
      const idea3 = await agent3.proposeIdea(sessionId, 'Idea from Agent 3', IdeaCategory.TESTING);
      await wait(500);

      // Cross-voting (can't vote for own ideas)
      await agent1.voteForIdea(sessionId, idea2, 1);
      await agent1.voteForIdea(sessionId, idea3, 1);
      await agent2.voteForIdea(sessionId, idea1, 1);
      await agent2.voteForIdea(sessionId, idea3, 1);
      await agent3.voteForIdea(sessionId, idea1, 1);
      await agent3.voteForIdea(sessionId, idea2, 1);
      console.log('  ✓ Votes cast');

      // Wait for vote propagation
      await wait(500);

      // Verify votes
      const idea1Data = agent1.allIdeas.get(idea1);
      const idea2Data = agent2.allIdeas.get(idea2);
      const idea3Data = agent3.allIdeas.get(idea3);

      assertEqual(idea1Data.votes, 2, 'Idea 1 should have 2 votes');
      assertEqual(idea2Data.votes, 2, 'Idea 2 should have 2 votes');
      assertEqual(idea3Data.votes, 2, 'Idea 3 should have 2 votes');
      console.log('  ✓ Vote counts verified');

      // Get top ideas
      const topIdeas = agent1.getTopIdeas(sessionId, 3);
      assertEqual(topIdeas.length, 3, 'Should return 3 top ideas');
      console.log('  ✓ Top ideas retrieved');

      // Check voting stats
      assertEqual(agent1.stats.votesCast, 2, 'Agent 1 should have cast 2 votes');
      assertEqual(agent2.stats.votesCast, 2, 'Agent 2 should have cast 2 votes');
      assertEqual(agent3.stats.votesCast, 2, 'Agent 3 should have cast 2 votes');
      console.log('  ✓ Voting statistics verified');

      this.testResults.passed++;
      console.log('✅ Test 5 PASSED\n');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(`Test 5: ${error.message}`);
      console.error('❌ Test 5 FAILED:', error.message, '\n');
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test 6: Complete workflow
   */
  async testCompleteWorkflow() {
    console.log('\n📝 Test 6: Complete Workflow');
    console.log('─'.repeat(60));

    try {
      const agents = [
        new BrainstormSystem('workflow-1'),
        new BrainstormSystem('workflow-2'),
        new BrainstormSystem('workflow-3')
      ];
      this.systems = agents;

      for (const agent of agents) {
        await agent.initialize();
      }
      console.log('  ✓ 3 agents initialized');

      // Start session
      const sessionId = await agents[0].startSession('Complete Workflow Test', {
        duration: 15000,
        allowCombination: true,
        allowRefinement: true,
        allowVoting: true
      });
      await wait(500);

      // Phase 1: Idea generation
      const ideas = [];
      for (let i = 0; i < agents.length; i++) {
        ideas.push(await agents[i].proposeIdea(
          sessionId,
          `Original idea from agent ${i}`,
          IdeaCategory.FEATURE
        ));
      }
      await wait(500);
      console.log('  ✓ Phase 1: Ideas generated');

      // Phase 2: Combination
      const combinedId = await agents[1].combineIdeas(
        sessionId,
        [ideas[0], ideas[1]],
        'Combined solution from ideas 0 and 1',
        IdeaCategory.FEATURE
      );
      await wait(500);
      console.log('  ✓ Phase 2: Ideas combined');

      // Phase 3: Refinement
      const refinedId = await agents[2].refineIdea(
        sessionId,
        combinedId,
        'Refined combined solution with improvements'
      );
      await wait(500);
      console.log('  ✓ Phase 3: Idea refined');

      // Phase 4: Voting
      await agents[0].voteForIdea(sessionId, combinedId, 1);
      await agents[0].voteForIdea(sessionId, refinedId, 2);
      await agents[1].voteForIdea(sessionId, refinedId, 2);
      await agents[2].voteForIdea(sessionId, combinedId, 1);
      await wait(500);
      console.log('  ✓ Phase 4: Voting completed');

      // Verify final state
      const topIdeas = agents[0].getTopIdeas(sessionId, 5);
      assert(topIdeas.length > 0, 'Should have top ideas');
      console.log('  ✓ Top ideas retrieved');

      const status = agents[0].getSessionStatus(sessionId);
      assert(status.totalIdeas >= 5, 'Should have at least 5 ideas');
      console.log('  ✓ Session status verified');

      // Stop session
      await agents[0].stopSession(sessionId);
      console.log('  ✓ Session stopped');

      this.testResults.passed++;
      console.log('✅ Test 6 PASSED\n');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(`Test 6: ${error.message}`);
      console.error('❌ Test 6 FAILED:', error.message, '\n');
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test 7: Concurrent sessions
   */
  async testConcurrentSessions() {
    console.log('\n📝 Test 7: Concurrent Sessions');
    console.log('─'.repeat(60));

    try {
      const agent = new BrainstormSystem('concurrent-agent');
      this.systems = [agent];

      await agent.initialize();
      console.log('  ✓ Agent initialized');

      // Start multiple sessions
      const session1 = await agent.startSession('Session 1');
      const session2 = await agent.startSession('Session 2');
      const session3 = await agent.startSession('Session 3');
      console.log('  ✓ 3 concurrent sessions started');

      // Add ideas to each session
      await agent.proposeIdea(session1, 'Idea for session 1');
      await agent.proposeIdea(session2, 'Idea for session 2');
      await agent.proposeIdea(session3, 'Idea for session 3');
      console.log('  ✓ Ideas added to all sessions');

      // Verify sessions are independent
      const ideas1 = agent.getSessionIdeas(session1);
      const ideas2 = agent.getSessionIdeas(session2);
      const ideas3 = agent.getSessionIdeas(session3);

      assertEqual(ideas1.length, 1, 'Session 1 should have 1 idea');
      assertEqual(ideas2.length, 1, 'Session 2 should have 1 idea');
      assertEqual(ideas3.length, 1, 'Session 3 should have 1 idea');
      console.log('  ✓ Sessions are independent');

      // Verify active sessions count
      assertEqual(agent.activeSessions.size, 3, 'Should have 3 active sessions');
      console.log('  ✓ Active sessions count verified');

      this.testResults.passed++;
      console.log('✅ Test 7 PASSED\n');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(`Test 7: ${error.message}`);
      console.error('❌ Test 7 FAILED:', error.message, '\n');
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test 8: Scaling test
   */
  async testScaling() {
    console.log('\n📝 Test 8: Scaling Test (5 agents, 25 ideas)');
    console.log('─'.repeat(60));

    try {
      const agentCount = 5;
      const ideasPerAgent = 5;

      const agents = [];
      for (let i = 0; i < agentCount; i++) {
        agents.push(new BrainstormSystem(`scale-agent-${i}`));
      }
      this.systems = agents;

      // Initialize all agents
      for (const agent of agents) {
        await agent.initialize();
      }
      console.log(`  ✓ ${agentCount} agents initialized`);

      // Start session
      const sessionId = await agents[0].startSession('Scaling Test', {
        maxIdeas: 100
      });
      await wait(500);

      // Each agent proposes multiple ideas
      const startTime = Date.now();
      for (let i = 0; i < agentCount; i++) {
        for (let j = 0; j < ideasPerAgent; j++) {
          await agents[i].proposeIdea(
            sessionId,
            `Idea ${j} from agent ${i}`,
            IdeaCategory.FEATURE
          );
        }
      }
      const ideaGenerationTime = Date.now() - startTime;
      console.log(`  ✓ ${agentCount * ideasPerAgent} ideas generated in ${ideaGenerationTime}ms`);

      // Wait for propagation
      await wait(1000);

      // Verify all agents received all ideas
      for (const agent of agents) {
        assert(
          agent.allIdeas.size >= agentCount * ideasPerAgent,
          `Agent should have at least ${agentCount * ideasPerAgent} ideas`
        );
      }
      console.log('  ✓ All ideas propagated to all agents');

      // Get statistics
      const stats = agents[0].getStats();
      console.log(`  ✓ Final stats: ${stats.totalIdeas} total ideas`);

      this.testResults.passed++;
      console.log('✅ Test 8 PASSED\n');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.errors.push(`Test 8: ${error.message}`);
      console.error('❌ Test 8 FAILED:', error.message, '\n');
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Clean up all systems
   */
  async cleanup() {
    for (const system of this.systems) {
      try {
        if (system && system.isInitialized) {
          await system.close();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.systems = [];
    await wait(500); // Allow cleanup to complete
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                     TEST RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Total Tests: ${this.testResults.passed + this.testResults.failed}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);

    if (this.testResults.errors.length > 0) {
      console.log('\nErrors:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n' + '═'.repeat(60) + '\n');
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new BrainstormSystemTest();
  const success = await test.runTests();

  await test.setup.stopRabbitMQ();

  process.exit(success ? 0 : 1);
}

export default BrainstormSystemTest;
