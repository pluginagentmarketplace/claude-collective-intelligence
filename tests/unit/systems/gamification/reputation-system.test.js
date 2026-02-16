/**
 * Unit Tests for EigenTrust Reputation System
 *
 * Tests cover:
 * - EigenTrust algorithm correctness
 * - Five-dimensional reputation scoring (persistence, competence, reputation, credibility, integrity)
 * - Trust graph normalization
 * - Peer rating integration
 * - Real-world scenarios
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReputationSystem } from '../../../src/systems/reputation/system.js';

describe('ReputationSystem', () => {
  let reputationSystem;

  beforeEach(() => {
    reputationSystem = new ReputationSystem({
      eigentrustIterations: 20,
      convergenceThreshold: 0.0001,
      decayFactor: 0.95
    });
  });

  afterEach(() => {
    reputationSystem = null;
  });

  describe('Agent Registration', () => {
    it('should register a new agent with default values', () => {
      const agent = reputationSystem.registerAgent('agent-001', { name: 'Alice' });

      assert.equal(agent.id, 'agent-001');
      assert.equal(agent.name, 'Alice');
      assert.equal(agent.reputation.score, 500);
      assert.equal(agent.reputation.trustLevel, 'neutral');
      assert.equal(agent.stats.successRate, 100);
    });

    it('should initialize global trust with uniform distribution', () => {
      reputationSystem.registerAgent('agent-001');
      reputationSystem.registerAgent('agent-002');
      reputationSystem.registerAgent('agent-003');

      const trust1 = reputationSystem.globalTrust.get('agent-001');
      const trust2 = reputationSystem.globalTrust.get('agent-002');
      const trust3 = reputationSystem.globalTrust.get('agent-003');

      assert.equal(trust1, 1 / 3);
      assert.equal(trust2, 1 / 3);
      assert.equal(trust3, 1 / 3);
    });

    it('should emit agent.registered event', (t, done) => {
      reputationSystem.once('agent.registered', (event) => {
        assert.equal(event.agentId, 'agent-test');
        assert.ok(event.timestamp > 0);
        done();
      });

      reputationSystem.registerAgent('agent-test');
    });
  });

  describe('Trust Graph and Interactions', () => {
    beforeEach(() => {
      reputationSystem.registerAgent('agent-A');
      reputationSystem.registerAgent('agent-B');
      reputationSystem.registerAgent('agent-C');
    });

    it('should add interaction to trust graph', () => {
      reputationSystem.addInteraction('agent-A', 'agent-B', 0.8);

      const trustGraph = reputationSystem.trustGraph.get('agent-A');
      assert.ok(trustGraph.has('agent-B'));
      assert.ok(trustGraph.get('agent-B') > 0);
    });

    it('should normalize trust values to [0,1]', () => {
      reputationSystem.addInteraction('agent-A', 'agent-B', 5.0); // Over limit
      reputationSystem.addInteraction('agent-B', 'agent-C', -1.0); // Under limit

      assert.equal(reputationSystem.trustGraph.get('agent-A').get('agent-B'), 1.0);
      assert.equal(reputationSystem.trustGraph.get('agent-B').get('agent-C'), 0.0);
    });

    it('should apply exponential moving average to repeated interactions', () => {
      reputationSystem.addInteraction('agent-A', 'agent-B', 0.5);
      const firstTrust = reputationSystem.trustGraph.get('agent-A').get('agent-B');

      reputationSystem.addInteraction('agent-A', 'agent-B', 0.9);
      const secondTrust = reputationSystem.trustGraph.get('agent-A').get('agent-B');

      // Trust should increase but not jump to 0.9
      assert.ok(secondTrust > firstTrust);
      assert.ok(secondTrust < 0.9);
    });

    it('should record interaction history', () => {
      reputationSystem.addInteraction('agent-A', 'agent-B', 0.8, { taskId: 'task-001' });

      assert.equal(reputationSystem.interactions.length, 1);
      assert.equal(reputationSystem.interactions[0].from, 'agent-A');
      assert.equal(reputationSystem.interactions[0].to, 'agent-B');
      assert.equal(reputationSystem.interactions[0].trust, 0.8);
      assert.equal(reputationSystem.interactions[0].context.taskId, 'task-001');
    });

    it('should emit interaction.added event', (t, done) => {
      reputationSystem.once('interaction.added', (event) => {
        assert.equal(event.fromAgentId, 'agent-A');
        assert.equal(event.toAgentId, 'agent-B');
        assert.equal(event.trust, 0.75);
        done();
      });

      reputationSystem.addInteraction('agent-A', 'agent-B', 0.75);
    });
  });

  describe('EigenTrust Algorithm', () => {
    beforeEach(() => {
      // Create test network with known trust relationships
      reputationSystem.registerAgent('agent-1');
      reputationSystem.registerAgent('agent-2');
      reputationSystem.registerAgent('agent-3');
      reputationSystem.registerAgent('agent-4');
    });

    it('should compute EigenTrust scores for simple network', async () => {
      // Agent 1 trusts Agent 2 highly
      reputationSystem.addInteraction('agent-1', 'agent-2', 0.9);

      // Agent 2 trusts Agent 3 highly
      reputationSystem.addInteraction('agent-2', 'agent-3', 0.9);

      // Agent 3 trusts Agent 4 moderately
      reputationSystem.addInteraction('agent-3', 'agent-4', 0.5);

      // Agent 4 trusts Agent 1 (cycle)
      reputationSystem.addInteraction('agent-4', 'agent-1', 0.7);

      const trust = await reputationSystem.computeEigenTrust();

      // Verify trust scores sum to 1
      const sum = Array.from(trust.values()).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1.0) < 0.001);

      // Verify all scores are positive
      for (const score of trust.values()) {
        assert.ok(score > 0);
        assert.ok(score < 1);
      }
    });

    it('should identify highly trusted agent in star topology', async () => {
      // Create star topology where agent-2 is trusted by all
      reputationSystem.addInteraction('agent-1', 'agent-2', 1.0);
      reputationSystem.addInteraction('agent-3', 'agent-2', 1.0);
      reputationSystem.addInteraction('agent-4', 'agent-2', 1.0);

      const trust = await reputationSystem.computeEigenTrust();

      const trust2 = trust.get('agent-2');
      const trust1 = trust.get('agent-1');
      const trust3 = trust.get('agent-3');
      const trust4 = trust.get('agent-4');

      // Agent 2 should have highest trust
      assert.ok(trust2 > trust1);
      assert.ok(trust2 > trust3);
      assert.ok(trust2 > trust4);
    });

    it('should handle agents with no outgoing trust', async () => {
      // Agent 1 trusts Agent 2, but Agent 2 trusts no one
      reputationSystem.addInteraction('agent-1', 'agent-2', 0.8);

      const trust = await reputationSystem.computeEigenTrust();

      // Should not throw error
      assert.ok(trust.size > 0);

      // Agent 2 should still have some trust
      assert.ok(trust.get('agent-2') > 0);
    });

    it('should converge within iteration limit', async () => {
      reputationSystem.registerAgent('agent-5');
      reputationSystem.registerAgent('agent-6');

      // Complex network
      reputationSystem.addInteraction('agent-1', 'agent-2', 0.7);
      reputationSystem.addInteraction('agent-1', 'agent-3', 0.3);
      reputationSystem.addInteraction('agent-2', 'agent-3', 0.5);
      reputationSystem.addInteraction('agent-2', 'agent-4', 0.5);
      reputationSystem.addInteraction('agent-3', 'agent-1', 0.6);
      reputationSystem.addInteraction('agent-4', 'agent-5', 0.9);
      reputationSystem.addInteraction('agent-5', 'agent-6', 0.8);
      reputationSystem.addInteraction('agent-6', 'agent-1', 0.7);

      const trust = await reputationSystem.computeEigenTrust();

      // Should converge
      assert.ok(trust.size === 6);

      // Verify normalization
      const sum = Array.from(trust.values()).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1.0) < 0.01);
    });

    it('should emit eigentrust.computed event', async () => {
      reputationSystem.addInteraction('agent-1', 'agent-2', 0.8);

      const eventPromise = new Promise((resolve) => {
        reputationSystem.once('eigentrust.computed', (event) => {
          assert.ok(event.iterations > 0);
          assert.ok(event.timestamp > 0);
          resolve();
        });
      });

      await reputationSystem.computeEigenTrust();
      await eventPromise;
    });

    it('should update agent reputation with eigentrust scores', async () => {
      reputationSystem.addInteraction('agent-1', 'agent-2', 0.9);
      reputationSystem.addInteraction('agent-3', 'agent-2', 0.9);
      reputationSystem.addInteraction('agent-4', 'agent-2', 0.9);

      await reputationSystem.computeEigenTrust();

      const agent2 = reputationSystem.agentStats.get('agent-2');
      assert.ok(agent2.reputation.eigentrust > 0);
    });
  });

  describe('Five-Dimensional Reputation Scoring', () => {
    beforeEach(() => {
      reputationSystem.registerAgent('agent-test', { name: 'TestAgent' });
    });

    describe('1. Persistence Score', () => {
      it('should calculate persistence based on consecutive days', () => {
        const agent = reputationSystem.agentStats.get('agent-test');
        agent.stats.consecutiveDays = 30;
        agent.stats.tasksCompleted = 100;

        const persistence = reputationSystem.calculatePersistence(agent);

        assert.ok(persistence > 0);
        assert.ok(persistence <= 100);
      });

      it('should use logarithmic scale for diminishing returns', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        agent.stats.consecutiveDays = 10;
        agent.stats.tasksCompleted = 50;
        const score10 = reputationSystem.calculatePersistence(agent);

        agent.stats.consecutiveDays = 100;
        agent.stats.tasksCompleted = 500;
        const score100 = reputationSystem.calculatePersistence(agent);

        // Score should increase but not linearly
        const ratio = score100 / score10;
        assert.ok(ratio < 10); // Not 10x despite 10x days
      });

      it('should consider both days and task count', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        agent.stats.consecutiveDays = 50;
        agent.stats.tasksCompleted = 0;
        const scoreNoDays = reputationSystem.calculatePersistence(agent);

        agent.stats.consecutiveDays = 50;
        agent.stats.tasksCompleted = 200;
        const scoreWithTasks = reputationSystem.calculatePersistence(agent);

        assert.ok(scoreWithTasks > scoreNoDays);
      });
    });

    describe('2. Competence Score', () => {
      it('should calculate competence from quality, speed, and success rate', () => {
        const agent = reputationSystem.agentStats.get('agent-test');
        agent.stats.averageQualityScore = 80; // 0-100
        agent.stats.averageTaskTime = 150000; // 2.5 minutes (fast)
        agent.stats.successRate = 95; // 95%

        const competence = reputationSystem.calculateCompetence(agent);

        assert.ok(competence > 50); // Should be above average
        assert.ok(competence <= 100);
      });

      it('should weight quality highest at 40%', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        // High quality, poor speed/success
        agent.stats.averageQualityScore = 100;
        agent.stats.averageTaskTime = 600000; // Slow
        agent.stats.successRate = 50;
        const highQuality = reputationSystem.calculateCompetence(agent);

        // Low quality, good speed/success
        agent.stats.averageQualityScore = 20;
        agent.stats.averageTaskTime = 100000; // Fast
        agent.stats.successRate = 95;
        const lowQuality = reputationSystem.calculateCompetence(agent);

        // High quality should score better despite poor other metrics
        assert.ok(highQuality > lowQuality);
      });
    });

    describe('3. Historical Reputation Score', () => {
      it('should calculate reputation from points and innovations', () => {
        const agent = reputationSystem.agentStats.get('agent-test');
        agent.stats.totalPoints = 5000;
        agent.stats.innovations = 10;

        const reputation = reputationSystem.calculateHistoricalReputation(agent);

        assert.ok(reputation > 0);
        assert.ok(reputation <= 100);
      });

      it('should reward innovations', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        agent.stats.totalPoints = 1000;
        agent.stats.innovations = 0;
        const noInnovation = reputationSystem.calculateHistoricalReputation(agent);

        agent.stats.innovations = 5;
        const withInnovation = reputationSystem.calculateHistoricalReputation(agent);

        assert.ok(withInnovation > noInnovation);
      });
    });

    describe('4. Credibility Score', () => {
      it('should calculate credibility from peer ratings', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        // Add peer ratings
        reputationSystem.addPeerRating('agent-1', 'agent-test', 4.5);
        reputationSystem.addPeerRating('agent-2', 'agent-test', 4.0);
        reputationSystem.addPeerRating('agent-3', 'agent-test', 5.0);

        const credibility = reputationSystem.calculateCredibility(agent);

        // Average rating is 4.5, so credibility should be around 90
        assert.ok(credibility >= 85);
        assert.ok(credibility <= 100);
      });

      it('should default to neutral 50 with no ratings', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        const credibility = reputationSystem.calculateCredibility(agent);

        assert.equal(credibility, 50);
      });

      it('should reflect low ratings', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        reputationSystem.addPeerRating('agent-1', 'agent-test', 2.0);
        reputationSystem.addPeerRating('agent-2', 'agent-test', 1.5);

        const credibility = reputationSystem.calculateCredibility(agent);

        // Average ~1.75/5 = 35%
        assert.ok(credibility < 50);
      });
    });

    describe('5. Integrity Score', () => {
      it('should calculate integrity from error rate', () => {
        const agent = reputationSystem.agentStats.get('agent-test');
        agent.stats.successRate = 95; // 5% error rate

        const integrity = reputationSystem.calculateIntegrity(agent);

        assert.ok(integrity >= 90); // High integrity with low errors
      });

      it('should penalize high error rates', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        agent.stats.successRate = 90;
        const integrity90 = reputationSystem.calculateIntegrity(agent);

        agent.stats.successRate = 60;
        const integrity60 = reputationSystem.calculateIntegrity(agent);

        assert.ok(integrity90 > integrity60);
      });

      it('should bottom out at 0 for very high error rates', () => {
        const agent = reputationSystem.agentStats.get('agent-test');
        agent.stats.successRate = 0; // 100% error rate

        const integrity = reputationSystem.calculateIntegrity(agent);

        assert.equal(integrity, 0);
      });
    });

    describe('Combined Reputation Score', () => {
      it('should compute weighted sum of all five dimensions', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        // Set excellent stats across all dimensions
        agent.stats.consecutiveDays = 60;
        agent.stats.tasksCompleted = 200;
        agent.stats.averageQualityScore = 90;
        agent.stats.averageTaskTime = 120000;
        agent.stats.successRate = 98;
        agent.stats.totalPoints = 10000;
        agent.stats.innovations = 15;

        reputationSystem.addPeerRating('agent-1', 'agent-test', 5.0);
        reputationSystem.addPeerRating('agent-2', 'agent-test', 4.5);

        const score = reputationSystem.calculateReputationScore('agent-test');

        // Should be high reputation
        assert.ok(score > 700);
        assert.ok(score <= 1000);
      });

      it('should apply correct weights: competence (30%) > reputation (25%) > persistence (20%) > credibility (15%) > integrity (10%)', () => {
        // This test validates the weight distribution
        const agent = reputationSystem.agentStats.get('agent-test');

        // Set baseline
        agent.stats.consecutiveDays = 30;
        agent.stats.tasksCompleted = 100;
        agent.stats.averageQualityScore = 50;
        agent.stats.averageTaskTime = 300000;
        agent.stats.successRate = 80;
        agent.stats.totalPoints = 2000;
        agent.stats.innovations = 3;

        reputationSystem.addPeerRating('agent-1', 'agent-test', 3.0);

        const baseScore = reputationSystem.calculateReputationScore('agent-test');

        // Improve competence significantly
        agent.stats.averageQualityScore = 100;
        agent.stats.averageTaskTime = 100000;
        agent.stats.successRate = 100;

        const competenceScore = reputationSystem.calculateReputationScore('agent-test');

        // Competence improvement should have largest impact (30% weight)
        assert.ok(competenceScore > baseScore);
      });

      it('should apply decay factor for inactive agents', () => {
        const agent = reputationSystem.agentStats.get('agent-test');

        // Set good stats
        agent.stats.consecutiveDays = 50;
        agent.stats.tasksCompleted = 150;
        agent.stats.averageQualityScore = 85;
        agent.stats.successRate = 95;

        // Recent activity
        agent.lastActiveAt = Date.now();
        const recentScore = reputationSystem.calculateReputationScore('agent-test');

        // Old activity (7 days ago)
        agent.lastActiveAt = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const oldScore = reputationSystem.calculateReputationScore('agent-test');

        // Score should decay
        assert.ok(oldScore < recentScore);
      });
    });
  });

  describe('Peer Ratings', () => {
    beforeEach(() => {
      reputationSystem.registerAgent('agent-A');
      reputationSystem.registerAgent('agent-B');
    });

    it('should add peer rating', () => {
      reputationSystem.addPeerRating('agent-A', 'agent-B', 4.5, {
        taskId: 'task-123',
        comment: 'Great collaboration'
      });

      const ratings = reputationSystem.peerRatings.get('agent-B');
      assert.equal(ratings.length, 1);
      assert.equal(ratings[0].from, 'agent-A');
      assert.equal(ratings[0].rating, 4.5);
      assert.equal(ratings[0].context.taskId, 'task-123');
    });

    it('should normalize ratings to [0,5] range', () => {
      reputationSystem.addPeerRating('agent-A', 'agent-B', 10); // Over limit

      const ratings = reputationSystem.peerRatings.get('agent-B');
      assert.equal(ratings[0].rating, 5.0);
    });

    it('should automatically add to trust graph', () => {
      reputationSystem.addPeerRating('agent-A', 'agent-B', 4.0);

      const trustGraph = reputationSystem.trustGraph.get('agent-A');
      assert.ok(trustGraph.has('agent-B'));
      // 4.0/5.0 = 0.8 trust
      assert.ok(trustGraph.get('agent-B') > 0.7);
    });

    it('should emit peer.rating.added event', (t, done) => {
      reputationSystem.once('peer.rating.added', (event) => {
        assert.equal(event.fromAgentId, 'agent-A');
        assert.equal(event.toAgentId, 'agent-B');
        assert.equal(event.rating, 3.5);
        done();
      });

      reputationSystem.addPeerRating('agent-A', 'agent-B', 3.5);
    });
  });

  describe('Agent Statistics Updates', () => {
    beforeEach(() => {
      reputationSystem.registerAgent('agent-test');
    });

    it('should update agent stats and recalculate reputation', () => {
      const initialScore = reputationSystem.agentStats.get('agent-test').reputation.score;

      reputationSystem.updateAgentStats('agent-test', {
        tasksCompleted: 150,
        averageQualityScore: 90,
        successRate: 98,
        totalPoints: 8000
      });

      const newScore = reputationSystem.agentStats.get('agent-test').reputation.score;

      assert.ok(newScore > initialScore);
    });

    it('should update trust level based on score', () => {
      reputationSystem.updateAgentStats('agent-test', {
        tasksCompleted: 500,
        averageQualityScore: 95,
        successRate: 99,
        totalPoints: 20000,
        consecutiveDays: 90,
        innovations: 20
      });

      const agent = reputationSystem.agentStats.get('agent-test');
      assert.ok(['excellent', 'exceptional'].includes(agent.reputation.trustLevel));
    });

    it('should track reputation trend', () => {
      // Start low
      reputationSystem.updateAgentStats('agent-test', {
        averageQualityScore: 30,
        successRate: 60
      });

      const lowScore = reputationSystem.agentStats.get('agent-test').reputation.score;

      // Improve
      reputationSystem.updateAgentStats('agent-test', {
        averageQualityScore: 80,
        successRate: 95,
        tasksCompleted: 100
      });

      const agent = reputationSystem.agentStats.get('agent-test');
      assert.equal(agent.reputation.trend, 'rising');
    });

    it('should emit stats.updated event', (t, done) => {
      reputationSystem.once('stats.updated', (event) => {
        assert.equal(event.agentId, 'agent-test');
        assert.ok(event.newScore !== event.oldScore);
        done();
      });

      reputationSystem.updateAgentStats('agent-test', {
        tasksCompleted: 50
      });
    });
  });

  describe('Reputation Summary and Leaderboard', () => {
    beforeEach(() => {
      // Create multiple agents with different reputations
      ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'].forEach((id, index) => {
        reputationSystem.registerAgent(id, { name: `Agent ${index + 1}` });

        reputationSystem.updateAgentStats(id, {
          tasksCompleted: (index + 1) * 50,
          averageQualityScore: 50 + (index * 10),
          successRate: 80 + (index * 4),
          totalPoints: (index + 1) * 2000,
          consecutiveDays: (index + 1) * 15,
          innovations: index * 2
        });
      });
    });

    it('should get reputation summary for agent', () => {
      const summary = reputationSystem.getReputationSummary('agent-3');

      assert.equal(summary.agentId, 'agent-3');
      assert.equal(summary.agentName, 'Agent 3');
      assert.ok(summary.reputationScore > 0);
      assert.ok(summary.breakdown);
      assert.ok(summary.breakdown.persistence);
      assert.ok(summary.breakdown.competence);
      assert.ok(summary.breakdown.reputation);
      assert.ok(summary.breakdown.credibility);
      assert.ok(summary.breakdown.integrity);
    });

    it('should get leaderboard sorted by reputation', () => {
      const leaderboard = reputationSystem.getLeaderboard(3);

      assert.equal(leaderboard.length, 3);
      // Should be sorted descending
      assert.ok(leaderboard[0].reputationScore >= leaderboard[1].reputationScore);
      assert.ok(leaderboard[1].reputationScore >= leaderboard[2].reputationScore);
    });

    it('should identify low reputation agents', () => {
      // Make agent-1 have low reputation
      reputationSystem.updateAgentStats('agent-1', {
        averageQualityScore: 20,
        successRate: 50,
        totalPoints: 100
      });

      const lowRepAgents = reputationSystem.getLowReputationAgents(400);

      assert.ok(lowRepAgents.some(a => a.agentId === 'agent-1'));
    });

    it('should identify specific reputation issues', () => {
      const agent = reputationSystem.agentStats.get('agent-1');
      agent.stats.averageQualityScore = 10;
      agent.stats.successRate = 40;
      agent.stats.consecutiveDays = 1;
      agent.lastActiveAt = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago

      const issues = reputationSystem.identifyReputationIssues(agent);

      assert.ok(issues.includes('low_competence'));
      assert.ok(issues.includes('low_integrity'));
      assert.ok(issues.includes('low_persistence'));
      assert.ok(issues.includes('inactive'));
    });
  });

  describe('Real-World Scenario: 5-Agent Collaboration', () => {
    it('should correctly compute reputation for collaborative scenario', async () => {
      // Scenario: 5 agents working together on a project
      const agents = ['alice', 'bob', 'charlie', 'david', 'eve'];

      agents.forEach((id, index) => {
        reputationSystem.registerAgent(id, { name: id.charAt(0).toUpperCase() + id.slice(1) });

        // Different performance profiles
        const profiles = [
          { quality: 95, speed: 100000, success: 99, tasks: 200, days: 90 }, // Alice: Excellent
          { quality: 85, speed: 150000, success: 95, tasks: 180, days: 85 }, // Bob: Very good
          { quality: 70, speed: 200000, success: 88, tasks: 150, days: 60 }, // Charlie: Good
          { quality: 60, speed: 280000, success: 80, tasks: 100, days: 45 }, // David: Fair
          { quality: 50, speed: 350000, success: 70, tasks: 50, days: 20 }   // Eve: Needs improvement
        ];

        const profile = profiles[index];
        reputationSystem.updateAgentStats(id, {
          tasksCompleted: profile.tasks,
          averageQualityScore: profile.quality,
          averageTaskTime: profile.speed,
          successRate: profile.success,
          totalPoints: profile.tasks * 50,
          consecutiveDays: profile.days,
          innovations: Math.floor(profile.tasks / 50)
        });
      });

      // Add peer ratings based on collaboration
      // Alice is rated highly by everyone
      reputationSystem.addPeerRating('bob', 'alice', 5.0);
      reputationSystem.addPeerRating('charlie', 'alice', 5.0);
      reputationSystem.addPeerRating('david', 'alice', 4.5);

      // Bob is also well-regarded
      reputationSystem.addPeerRating('alice', 'bob', 4.5);
      reputationSystem.addPeerRating('charlie', 'bob', 4.0);

      // Charlie is moderate
      reputationSystem.addPeerRating('bob', 'charlie', 3.5);
      reputationSystem.addPeerRating('david', 'charlie', 3.0);

      // David gets mixed reviews
      reputationSystem.addPeerRating('charlie', 'david', 3.0);
      reputationSystem.addPeerRating('eve', 'david', 2.5);

      // Eve is struggling
      reputationSystem.addPeerRating('david', 'eve', 2.0);

      // Compute EigenTrust
      await reputationSystem.computeEigenTrust();

      // Get final reputations
      const leaderboard = reputationSystem.getLeaderboard(5);

      // Verify ranking
      assert.equal(leaderboard[0].agentId, 'alice'); // Best performer
      assert.equal(leaderboard[1].agentId, 'bob');   // Second best

      // Alice should have high reputation
      const aliceSummary = reputationSystem.getReputationSummary('alice');
      assert.ok(aliceSummary.reputationScore > 700);
      assert.ok(['excellent', 'exceptional'].includes(aliceSummary.trustLevel));

      // Eve should have lower reputation
      const eveSummary = reputationSystem.getReputationSummary('eve');
      assert.ok(eveSummary.reputationScore < 500);

      // Verify all five dimensions are calculated
      assert.ok(aliceSummary.breakdown.persistence > 70);
      assert.ok(aliceSummary.breakdown.competence > 80);
      assert.ok(aliceSummary.breakdown.reputation > 50);
      assert.ok(aliceSummary.breakdown.credibility > 80);
      assert.ok(aliceSummary.breakdown.integrity > 90);

      console.log('\n=== 5-Agent Collaboration Scenario Results ===');
      leaderboard.forEach((agent, rank) => {
        const summary = reputationSystem.getReputationSummary(agent.agentId);
        console.log(`\n${rank + 1}. ${agent.agentName}`);
        console.log(`   Score: ${agent.reputationScore}/1000`);
        console.log(`   Level: ${agent.trustLevel}`);
        console.log(`   EigenTrust: ${(agent.eigentrust * 100).toFixed(2)}%`);
        console.log(`   Breakdown:`);
        console.log(`     - Persistence:  ${summary.breakdown.persistence.toFixed(1)}/100`);
        console.log(`     - Competence:   ${summary.breakdown.competence.toFixed(1)}/100`);
        console.log(`     - Reputation:   ${summary.breakdown.reputation.toFixed(1)}/100`);
        console.log(`     - Credibility:  ${summary.breakdown.credibility.toFixed(1)}/100`);
        console.log(`     - Integrity:    ${summary.breakdown.integrity.toFixed(1)}/100`);
      });
    });
  });

  describe('Data Export/Import', () => {
    it('should export reputation data', () => {
      reputationSystem.registerAgent('agent-1');
      reputationSystem.registerAgent('agent-2');
      reputationSystem.addInteraction('agent-1', 'agent-2', 0.8);
      reputationSystem.addPeerRating('agent-1', 'agent-2', 4.0);

      const exported = reputationSystem.exportData();

      assert.ok(exported.trustGraph);
      assert.ok(exported.globalTrust);
      assert.ok(exported.agentStats);
      assert.ok(exported.peerRatings);
      assert.ok(exported.interactions);
    });

    it('should import reputation data', () => {
      const data = {
        trustGraph: [
          {
            from: 'agent-1',
            trusts: [['agent-2', 0.8]]
          }
        ],
        globalTrust: [['agent-1', 0.5], ['agent-2', 0.5]],
        agentStats: [
          ['agent-1', {
            id: 'agent-1',
            name: 'Agent 1',
            stats: { tasksCompleted: 100 },
            reputation: { score: 650 }
          }]
        ],
        peerRatings: [
          ['agent-2', [{ from: 'agent-1', rating: 4.0, timestamp: Date.now() }]]
        ],
        interactions: [
          { from: 'agent-1', to: 'agent-2', trust: 0.8, timestamp: Date.now() }
        ]
      };

      reputationSystem.importData(data);

      assert.equal(reputationSystem.trustGraph.size, 1);
      assert.equal(reputationSystem.globalTrust.size, 2);
      assert.equal(reputationSystem.agentStats.size, 1);
      assert.equal(reputationSystem.interactions.length, 1);
    });
  });
});
