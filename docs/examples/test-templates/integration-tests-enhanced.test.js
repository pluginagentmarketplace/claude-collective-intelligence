/**
 * Enhanced Integration Tests
 * Comprehensive testing of multi-component interactions and end-to-end scenarios
 * Target Coverage: Cross-module integration testing
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// ==================== TEST SUITES ====================

describe('Multi-Agent Integration Tests', () => {
  let orchestrator;
  let rabbitClient;
  let votingSystem;
  let brainstormSystem;
  let achievementSystem;
  let agents;

  // ===== SETUP & TEARDOWN =====
  beforeAll(async () => {
    // Import all modules
    const [
      { default: AgentOrchestrator },
      { RabbitMQClient },
      { VotingSystem },
      { BrainstormSystem },
      { AchievementSystem },
    ] = await Promise.all([
      import('../../scripts/orchestrator.js'),
      import('../../scripts/rabbitmq-client.js'),
      import('../../scripts/voting-system.js'),
      import('../../scripts/brainstorm-system.js'),
      import('../../scripts/gamification/achievement-system.js'),
    ]);

    // Initialize systems
    rabbitClient = new RabbitMQClient({ url: process.env.RABBITMQ_URL || 'amqp://localhost' });
    orchestrator = new AgentOrchestrator({ rabbitClient });
    votingSystem = new VotingSystem();
    brainstormSystem = new BrainstormSystem();
    achievementSystem = new AchievementSystem();

    agents = [];
  });

  beforeEach(async () => {
    // Reset state between tests
    jest.clearAllMocks();
    agents = [];

    // Connect to RabbitMQ
    await rabbitClient.connect();
    await orchestrator.start();
  });

  afterEach(async () => {
    // Cleanup agents
    for (const agent of agents) {
      await agent.stop();
    }

    // Disconnect
    await orchestrator.stop();
    await rabbitClient.close();
  });

  // ===== TASK DISTRIBUTION SCENARIOS =====
  describe('Task Distribution and Coordination', () => {
    it('should distribute tasks across multiple agents', async () => {
      // Spawn 5 agents
      for (let i = 0; i < 5; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `worker-${i}`,
          capabilities: ['compute', 'analyze'],
        });
        agents.push(agent);
      }

      // Submit 20 tasks
      const tasks = Array(20).fill().map((_, i) => ({
        id: `task-${i}`,
        type: 'compute',
        payload: { value: i },
      }));

      const results = [];
      for (const task of tasks) {
        const result = await orchestrator.submitTask(task);
        results.push(result);
      }

      // Verify all tasks completed
      expect(results).toHaveLength(20);
      expect(results.every(r => r.status === 'completed')).toBe(true);

      // Verify load distribution
      const agentStats = await orchestrator.getAgentStatistics();
      const taskCounts = Object.values(agentStats).map(s => s.tasksCompleted);

      // Each agent should have processed roughly 4 tasks (20/5)
      expect(Math.max(...taskCounts) - Math.min(...taskCounts)).toBeLessThanOrEqual(2);
    });

    it('should handle agent failures with task redistribution', async () => {
      // Create 3 agents
      for (let i = 0; i < 3; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `agent-${i}`,
          capabilities: ['process'],
        });
        agents.push(agent);
      }

      // Submit long-running task to agent-1
      const longTask = {
        id: 'long-task',
        type: 'process',
        timeout: 10000,
      };

      const taskPromise = orchestrator.submitTask(longTask);

      // Simulate agent-1 failure after 1 second
      setTimeout(async () => {
        await agents[0].simulateFailure();
      }, 1000);

      const result = await taskPromise;

      // Task should complete on different agent
      expect(result.status).toBe('completed');
      expect(result.processedBy).not.toBe('agent-0');
    });

    it('should prioritize urgent tasks', async () => {
      // Create agents
      for (let i = 0; i < 2; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `priority-agent-${i}`,
        });
        agents.push(agent);
      }

      // Submit mixed priority tasks
      const normalTasks = Array(5).fill().map((_, i) => ({
        id: `normal-${i}`,
        priority: 1,
        type: 'process',
      }));

      const urgentTasks = Array(3).fill().map((_, i) => ({
        id: `urgent-${i}`,
        priority: 10,
        type: 'process',
      }));

      // Submit all tasks
      const allTasks = [...normalTasks, ...urgentTasks];
      const submissions = allTasks.map(t => orchestrator.submitTask(t));

      const results = await Promise.all(submissions);

      // Check completion order - urgent tasks should complete first
      const completionOrder = results
        .sort((a, b) => a.completedAt - b.completedAt)
        .map(r => r.id);

      const urgentCompletedFirst = completionOrder
        .slice(0, 3)
        .every(id => id.startsWith('urgent'));

      expect(urgentCompletedFirst).toBe(true);
    });
  });

  // ===== VOTING AND CONSENSUS SCENARIOS =====
  describe('Voting and Consensus Integration', () => {
    it('should coordinate multi-agent voting session', async () => {
      // Create voting agents
      const voterCount = 7;
      for (let i = 0; i < voterCount; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `voter-${i}`,
          role: 'voter',
        });
        agents.push(agent);
      }

      // Create voting proposal
      const proposal = {
        title: 'System Configuration Change',
        description: 'Should we enable feature X?',
        options: ['yes', 'no', 'abstain'],
      };

      // Initiate voting through orchestrator
      const session = await orchestrator.initiateVoting(proposal);

      // Agents cast votes
      const votes = [
        'yes', 'yes', 'yes', 'yes',  // 4 yes
        'no', 'no',                   // 2 no
        'abstain'                     // 1 abstain
      ];

      for (let i = 0; i < voterCount; i++) {
        await votingSystem.castVote(session.id, `voter-${i}`, votes[i]);
      }

      // Close voting and get results
      const result = await votingSystem.closeSession(session.id);

      expect(result).toMatchObject({
        winner: 'yes',
        tally: {
          yes: 4,
          no: 2,
          abstain: 1,
        },
        consensusReached: true,
      });

      // Verify all agents received result notification
      const notifications = await orchestrator.getNotifications();
      expect(notifications.filter(n => n.type === 'voting-result')).toHaveLength(voterCount);
    });

    it('should handle weighted voting with delegation', async () => {
      // Create agents with different weights
      const agentConfigs = [
        { id: 'lead-agent', weight: 3 },
        { id: 'senior-agent-1', weight: 2 },
        { id: 'senior-agent-2', weight: 2 },
        { id: 'junior-agent-1', weight: 1 },
        { id: 'junior-agent-2', weight: 1 },
      ];

      for (const config of agentConfigs) {
        const agent = await orchestrator.spawnAgent(config);
        agents.push(agent);
      }

      // Create weighted voting session
      const proposal = {
        title: 'Architecture Decision',
        type: 'weighted',
        options: ['microservices', 'monolith'],
        voterWeights: Object.fromEntries(
          agentConfigs.map(c => [c.id, c.weight])
        ),
      };

      const session = await votingSystem.createSession(proposal);

      // Junior agents delegate to seniors
      await votingSystem.delegateVote(session.id, 'junior-agent-1', 'senior-agent-1');
      await votingSystem.delegateVote(session.id, 'junior-agent-2', 'senior-agent-2');

      // Remaining agents vote
      await votingSystem.castVote(session.id, 'lead-agent', 'microservices');
      await votingSystem.castVote(session.id, 'senior-agent-1', 'microservices');
      await votingSystem.castVote(session.id, 'senior-agent-2', 'monolith');

      const result = await votingSystem.closeSession(session.id);

      // Calculate weighted results
      // microservices: 3 (lead) + 2 (senior-1) + 1 (junior-1 delegated) = 6
      // monolith: 2 (senior-2) + 1 (junior-2 delegated) = 3
      expect(result.winner).toBe('microservices');
      expect(result.weightedTally.microservices).toBe(6);
      expect(result.weightedTally.monolith).toBe(3);
    });
  });

  // ===== BRAINSTORMING SCENARIOS =====
  describe('Collaborative Brainstorming Integration', () => {
    it('should conduct full brainstorming session', async () => {
      // Create creative agents
      const creativeAgents = ['innovator', 'analyst', 'critic', 'synthesizer', 'visionary'];

      for (const role of creativeAgents) {
        const agent = await orchestrator.spawnAgent({
          id: `${role}-agent`,
          role,
          capabilities: ['brainstorm', 'evaluate'],
        });
        agents.push(agent);
      }

      // Start brainstorming session
      const problem = {
        statement: 'How can we improve system performance?',
        constraints: [
          'Budget limit: $10,000',
          'Timeline: 2 weeks',
          'No downtime allowed',
        ],
      };

      const session = await brainstormSystem.createSession(problem);

      // Agents submit ideas
      const ideas = [
        { agent: 'innovator-agent', idea: 'Implement caching layer', category: 'optimization' },
        { agent: 'analyst-agent', idea: 'Database query optimization', category: 'database' },
        { agent: 'critic-agent', idea: 'Remove unused indexes', category: 'cleanup' },
        { agent: 'synthesizer-agent', idea: 'Combine caching with CDN', category: 'hybrid' },
        { agent: 'visionary-agent', idea: 'Microservices migration', category: 'architecture' },
      ];

      for (const { agent, idea, category } of ideas) {
        await brainstormSystem.submitIdea(session.id, {
          agentId: agent,
          content: idea,
          category,
        });
      }

      // Agents evaluate ideas
      for (const agent of agents) {
        for (const idea of ideas) {
          const score = Math.random() * 10; // Simulated evaluation
          await brainstormSystem.evaluateIdea(session.id, idea.idea, {
            evaluator: agent.id,
            score,
            criteria: {
              feasibility: score * 0.3,
              impact: score * 0.4,
              cost: score * 0.3,
            },
          });
        }
      }

      // Close session and get results
      const results = await brainstormSystem.finalizeSession(session.id);

      expect(results).toMatchObject({
        topIdeas: expect.any(Array),
        consensusScore: expect.any(Number),
        categories: expect.any(Object),
        participation: {
          totalAgents: 5,
          totalIdeas: 5,
          totalEvaluations: 25,
        },
      });

      expect(results.topIdeas[0]).toMatchObject({
        content: expect.any(String),
        averageScore: expect.any(Number),
        evaluations: expect.any(Number),
      });
    });

    it('should iterate on ideas through rounds', async () => {
      // Create agents
      for (let i = 0; i < 4; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `iterative-agent-${i}`,
        });
        agents.push(agent);
      }

      const session = await brainstormSystem.createSession({
        statement: 'Design new feature',
        rounds: 3,
      });

      // Round 1: Initial ideas
      const round1Ideas = [];
      for (let i = 0; i < 4; i++) {
        const idea = await brainstormSystem.submitIdea(session.id, {
          agentId: `iterative-agent-${i}`,
          content: `Initial idea ${i}`,
          round: 1,
        });
        round1Ideas.push(idea);
      }

      // Select top ideas for refinement
      const topIdeas = await brainstormSystem.selectTopIdeas(session.id, 2);

      // Round 2: Refine selected ideas
      for (const idea of topIdeas) {
        for (let i = 0; i < 4; i++) {
          await brainstormSystem.refineIdea(session.id, idea.id, {
            agentId: `iterative-agent-${i}`,
            refinement: `Improvement from agent ${i}`,
            round: 2,
          });
        }
      }

      // Round 3: Final synthesis
      const synthesis = await brainstormSystem.synthesizeIdeas(session.id, {
        method: 'combine-best',
        round: 3,
      });

      expect(synthesis).toMatchObject({
        finalProposal: expect.any(String),
        incorporatedIdeas: expect.any(Array),
        consensusLevel: expect.any(Number),
      });
    });
  });

  // ===== GAMIFICATION INTEGRATION =====
  describe('Gamification System Integration', () => {
    it('should track achievements across activities', async () => {
      // Create competitive agents
      for (let i = 0; i < 3; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `competitive-agent-${i}`,
        });
        agents.push(agent);
        await achievementSystem.registerAgent(`competitive-agent-${i}`);
      }

      // Agent 0: Complete many tasks (Task Master achievement)
      for (let i = 0; i < 10; i++) {
        await orchestrator.submitTask({
          assignedTo: 'competitive-agent-0',
          type: 'simple',
        });
        await achievementSystem.trackEvent('competitive-agent-0', 'task-completed');
      }

      // Agent 1: Win votes (Democratic Leader achievement)
      for (let i = 0; i < 5; i++) {
        const session = await votingSystem.createSession({
          title: `Vote ${i}`,
          options: ['A', 'B'],
        });

        await votingSystem.castVote(session.id, 'competitive-agent-1', 'A');
        await votingSystem.castVote(session.id, 'competitive-agent-2', 'B');
        await votingSystem.castVote(session.id, 'competitive-agent-0', 'A');

        await votingSystem.closeSession(session.id);
        await achievementSystem.trackEvent('competitive-agent-1', 'vote-won');
      }

      // Agent 2: Brainstorm champion
      for (let i = 0; i < 7; i++) {
        await achievementSystem.trackEvent('competitive-agent-2', 'idea-accepted');
      }

      // Check achievements
      const achievements0 = await achievementSystem.getUnlockedAchievements('competitive-agent-0');
      const achievements1 = await achievementSystem.getUnlockedAchievements('competitive-agent-1');
      const achievements2 = await achievementSystem.getUnlockedAchievements('competitive-agent-2');

      expect(achievements0).toContainEqual(
        expect.objectContaining({ name: 'Task Master' })
      );
      expect(achievements1).toContainEqual(
        expect.objectContaining({ name: 'Democratic Leader' })
      );
      expect(achievements2).toContainEqual(
        expect.objectContaining({ name: 'Idea Generator' })
      );

      // Check leaderboard
      const leaderboard = await achievementSystem.getAchievementLeaderboard();
      expect(leaderboard).toHaveLength(3);
    });

    it('should apply gamification bonuses to performance', async () => {
      // Create agents with different tiers
      const agentTiers = [
        { id: 'bronze-agent', tier: 'bronze', multiplier: 1.0 },
        { id: 'silver-agent', tier: 'silver', multiplier: 1.5 },
        { id: 'gold-agent', tier: 'gold', multiplier: 2.0 },
      ];

      for (const config of agentTiers) {
        const agent = await orchestrator.spawnAgent(config);
        agents.push(agent);
        await achievementSystem.setAgentTier(config.id, config.tier);
      }

      // All agents complete same task type
      const baseReward = 100;
      const tasks = agentTiers.map(agent => ({
        assignedTo: agent.id,
        type: 'reward-task',
        baseReward,
      }));

      const results = await Promise.all(
        tasks.map(t => orchestrator.submitTask(t))
      );

      // Check rewards with multipliers
      expect(results[0].reward).toBe(100);  // Bronze: 100 * 1.0
      expect(results[1].reward).toBe(150);  // Silver: 100 * 1.5
      expect(results[2].reward).toBe(200);  // Gold: 100 * 2.0
    });
  });

  // ===== FAILURE RECOVERY SCENARIOS =====
  describe('System Failure and Recovery', () => {
    it('should recover from RabbitMQ connection loss', async () => {
      // Start normal operations
      for (let i = 0; i < 2; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `resilient-agent-${i}`,
        });
        agents.push(agent);
      }

      // Submit task
      const taskBeforeFailure = {
        id: 'task-before',
        type: 'process',
      };
      await orchestrator.submitTask(taskBeforeFailure);

      // Simulate connection loss
      await rabbitClient.simulateDisconnect();

      // Try to submit task during disconnection
      const taskDuringFailure = {
        id: 'task-during',
        type: 'process',
      };

      const failurePromise = orchestrator.submitTask(taskDuringFailure);

      // Reconnect after 2 seconds
      setTimeout(async () => {
        await rabbitClient.simulateReconnect();
      }, 2000);

      // Task should eventually complete after reconnection
      const result = await failurePromise;
      expect(result.status).toBe('completed');
      expect(result.recoveredFromFailure).toBe(true);
    });

    it('should handle cascading system failures', async () => {
      // Create interconnected agents
      const agentGraph = {
        'master': ['worker-1', 'worker-2'],
        'worker-1': ['sub-worker-1', 'sub-worker-2'],
        'worker-2': ['sub-worker-3'],
      };

      for (const [parent, children] of Object.entries(agentGraph)) {
        const agent = await orchestrator.spawnAgent({
          id: parent,
          children,
        });
        agents.push(agent);

        for (const child of children) {
          const childAgent = await orchestrator.spawnAgent({
            id: child,
            parent,
          });
          agents.push(childAgent);
        }
      }

      // Submit hierarchical task
      const complexTask = {
        id: 'hierarchical-task',
        type: 'distributed',
        subtasks: 5,
      };

      const taskPromise = orchestrator.submitTask(complexTask);

      // Simulate failure of middle-tier agent
      setTimeout(async () => {
        await agents.find(a => a.id === 'worker-1').simulateFailure();
      }, 1000);

      const result = await taskPromise;

      // System should recover and complete task
      expect(result.status).toBe('completed');
      expect(result.failuresRecovered).toContain('worker-1');
      expect(result.subtasksReassigned).toBeGreaterThan(0);
    });
  });

  // ===== PERFORMANCE AND LOAD TESTING =====
  describe('Performance Under Load', () => {
    it('should maintain performance with 100 agents', async () => {
      const agentCount = 100;
      const tasksPerAgent = 10;

      // Spawn agents
      for (let i = 0; i < agentCount; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `load-agent-${i}`,
          lightweight: true, // Optimize for load testing
        });
        agents.push(agent);
      }

      const startTime = Date.now();

      // Submit tasks
      const tasks = [];
      for (let i = 0; i < agentCount * tasksPerAgent; i++) {
        tasks.push(orchestrator.submitTask({
          id: `load-task-${i}`,
          type: 'compute',
          payload: { value: i },
        }));
      }

      const results = await Promise.all(tasks);
      const duration = Date.now() - startTime;

      // Performance assertions
      expect(results).toHaveLength(1000);
      expect(results.every(r => r.status === 'completed')).toBe(true);

      const throughput = 1000 / (duration / 1000);
      expect(throughput).toBeGreaterThan(50); // At least 50 tasks/second

      // Check system health
      const health = await orchestrator.getSystemHealth();
      expect(health.memoryUsage).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
      expect(health.messageQueueDepth).toBeLessThan(100); // Queue not backing up
    });

    it('should handle burst traffic patterns', async () => {
      // Create pool of agents
      for (let i = 0; i < 10; i++) {
        const agent = await orchestrator.spawnAgent({
          id: `burst-agent-${i}`,
        });
        agents.push(agent);
      }

      const burstSizes = [50, 100, 200, 100, 50];
      const results = [];

      for (const burstSize of burstSizes) {
        // Send burst of tasks
        const burstTasks = Array(burstSize).fill().map((_, i) => ({
          id: `burst-${burstSize}-${i}`,
          type: 'process',
        }));

        const burstResults = await Promise.all(
          burstTasks.map(t => orchestrator.submitTask(t))
        );

        results.push(...burstResults);

        // Brief pause between bursts
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // All tasks should complete successfully
      expect(results).toHaveLength(500);
      expect(results.every(r => r.status === 'completed')).toBe(true);

      // System should remain stable
      const metrics = await orchestrator.getMetrics();
      expect(metrics.droppedTasks).toBe(0);
      expect(metrics.averageLatency).toBeLessThan(1000);
    });
  });

  // ===== END-TO-END WORKFLOW SCENARIOS =====
  describe('Complete Workflow Scenarios', () => {
    it('should execute full development workflow', async () => {
      // Phase 1: Planning
      const planningAgents = ['architect', 'designer', 'analyst'];
      for (const role of planningAgents) {
        const agent = await orchestrator.spawnAgent({
          id: `${role}-agent`,
          role,
        });
        agents.push(agent);
      }

      // Brainstorm features
      const featureSession = await brainstormSystem.createSession({
        statement: 'New feature requirements',
      });

      for (const agent of planningAgents) {
        await brainstormSystem.submitIdea(featureSession.id, {
          agentId: `${agent}-agent`,
          content: `Feature idea from ${agent}`,
        });
      }

      const features = await brainstormSystem.finalizeSession(featureSession.id);

      // Vote on priority
      const priorityVote = await votingSystem.createSession({
        title: 'Feature Priority',
        options: features.topIdeas.map(f => f.content),
      });

      for (const agent of planningAgents) {
        await votingSystem.castVote(
          priorityVote.id,
          `${agent}-agent`,
          features.topIdeas[0].content
        );
      }

      const priority = await votingSystem.closeSession(priorityVote.id);

      // Phase 2: Implementation
      const devAgents = ['developer-1', 'developer-2', 'tester'];
      for (const role of devAgents) {
        const agent = await orchestrator.spawnAgent({
          id: `${role}-agent`,
          role,
        });
        agents.push(agent);
      }

      // Distribute implementation tasks
      const implementationTasks = [
        { type: 'frontend', assignedTo: 'developer-1-agent' },
        { type: 'backend', assignedTo: 'developer-2-agent' },
        { type: 'testing', assignedTo: 'tester-agent' },
      ];

      const implementations = await Promise.all(
        implementationTasks.map(t => orchestrator.submitTask(t))
      );

      // Phase 3: Review and Deploy
      const reviewSession = await votingSystem.createSession({
        title: 'Deploy to Production?',
        options: ['yes', 'no'],
        quorum: 5,
      });

      for (const agent of [...planningAgents, ...devAgents]) {
        await votingSystem.castVote(reviewSession.id, `${agent}-agent`, 'yes');
      }

      const deployDecision = await votingSystem.closeSession(reviewSession.id);

      // Verify complete workflow
      expect(features.topIdeas).toBeDefined();
      expect(priority.winner).toBeDefined();
      expect(implementations.every(i => i.status === 'completed')).toBe(true);
      expect(deployDecision.winner).toBe('yes');

      // Award achievements for complete workflow
      for (const agent of [...planningAgents, ...devAgents]) {
        await achievementSystem.trackEvent(`${agent}-agent`, 'workflow-completed');
      }

      const workflowAchievements = await Promise.all(
        [...planningAgents, ...devAgents].map(agent =>
          achievementSystem.getUnlockedAchievements(`${agent}-agent`)
        )
      );

      expect(workflowAchievements.some(a =>
        a.some(ach => ach.name === 'Team Player')
      )).toBe(true);
    });
  });
});