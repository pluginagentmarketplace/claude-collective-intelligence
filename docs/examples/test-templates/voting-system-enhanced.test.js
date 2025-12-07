/**
 * Enhanced Unit Tests for VotingSystem
 * Comprehensive testing of voting mechanisms, consensus algorithms, and decision making
 * Target Coverage: 85%+
 */

import { jest } from '@jest/globals';

// ==================== MOCK SETUP ====================

// Mock RabbitMQ Client
const mockRabbitClient = {
  publishVote: jest.fn().mockResolvedValue('vote-id'),
  subscribeToVotes: jest.fn(),
  broadcastVoteRequest: jest.fn().mockResolvedValue('request-id'),
  publishVoteResult: jest.fn().mockResolvedValue('result-id'),
};

jest.unstable_mockModule('../../scripts/rabbitmq-client.js', () => ({
  RabbitMQClient: jest.fn(() => mockRabbitClient),
}));

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('winston', () => ({
  createLogger: jest.fn(() => mockLogger),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

// ==================== TEST SUITES ====================

describe('VotingSystem - Enhanced Test Suite', () => {
  let VotingSystem;
  let votingSystem;

  // ===== SETUP & TEARDOWN =====
  beforeAll(async () => {
    const module = await import('../../scripts/voting-system.js');
    VotingSystem = module.VotingSystem;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    votingSystem = null;
  });

  afterEach(() => {
    jest.useRealTimers();
    if (votingSystem) {
      votingSystem.cleanup();
    }
  });

  // ===== INITIALIZATION TESTS =====
  describe('System Initialization', () => {
    it('should initialize with default configuration', () => {
      votingSystem = new VotingSystem();

      expect(votingSystem).toBeDefined();
      expect(votingSystem.config).toMatchObject({
        defaultQuorum: expect.any(Number),
        defaultTimeout: expect.any(Number),
        consensusThreshold: expect.any(Number),
      });
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        defaultQuorum: 0.75,
        defaultTimeout: 60000,
        consensusThreshold: 0.8,
        allowAbstention: true,
      };

      votingSystem = new VotingSystem(customConfig);

      expect(votingSystem.config).toMatchObject(customConfig);
    });

    it('should validate configuration parameters', () => {
      expect(() => new VotingSystem({ defaultQuorum: 1.5 }))
        .toThrow('Invalid quorum value');

      expect(() => new VotingSystem({ consensusThreshold: -0.1 }))
        .toThrow('Invalid consensus threshold');
    });
  });

  // ===== VOTING SESSION TESTS =====
  describe('Voting Sessions', () => {
    beforeEach(() => {
      votingSystem = new VotingSystem();
    });

    describe('Session Creation', () => {
      it('should create a simple voting session', async () => {
        const proposal = {
          title: 'Adopt new feature',
          description: 'Should we implement feature X?',
          options: ['yes', 'no'],
        };

        const session = await votingSystem.createSession(proposal);

        expect(session).toMatchObject({
          id: expect.stringMatching(/^vote-/),
          proposal,
          status: 'active',
          votes: {},
          startTime: expect.any(Number),
        });
      });

      it('should create multi-option voting session', async () => {
        const proposal = {
          title: 'Choose implementation approach',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          type: 'ranked-choice',
        };

        const session = await votingSystem.createSession(proposal);

        expect(session.type).toBe('ranked-choice');
        expect(session.proposal.options).toHaveLength(4);
      });

      it('should create weighted voting session', async () => {
        const proposal = {
          title: 'Budget allocation',
          type: 'weighted',
          voterWeights: {
            'agent-1': 3,
            'agent-2': 2,
            'agent-3': 1,
          },
        };

        const session = await votingSystem.createSession(proposal);

        expect(session.type).toBe('weighted');
        expect(session.voterWeights).toBeDefined();
      });

      it('should enforce minimum participants requirement', async () => {
        const proposal = {
          title: 'Critical decision',
          minParticipants: 5,
          options: ['approve', 'reject'],
        };

        const session = await votingSystem.createSession(proposal);

        // Try to close with insufficient participants
        await votingSystem.castVote(session.id, 'agent-1', 'approve');
        await votingSystem.castVote(session.id, 'agent-2', 'approve');

        const result = await votingSystem.closeSession(session.id);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('insufficient participants');
      });
    });

    describe('Vote Casting', () => {
      let sessionId;

      beforeEach(async () => {
        const session = await votingSystem.createSession({
          title: 'Test proposal',
          options: ['yes', 'no', 'abstain'],
        });
        sessionId = session.id;
      });

      it('should cast a valid vote', async () => {
        const vote = await votingSystem.castVote(sessionId, 'agent-1', 'yes');

        expect(vote).toMatchObject({
          voter: 'agent-1',
          choice: 'yes',
          timestamp: expect.any(Number),
          valid: true,
        });
      });

      it('should prevent duplicate votes', async () => {
        await votingSystem.castVote(sessionId, 'agent-1', 'yes');

        await expect(
          votingSystem.castVote(sessionId, 'agent-1', 'no')
        ).rejects.toThrow('already voted');
      });

      it('should allow vote changes when configured', async () => {
        votingSystem = new VotingSystem({ allowVoteChange: true });
        const session = await votingSystem.createSession({
          title: 'Test',
          options: ['yes', 'no'],
        });

        await votingSystem.castVote(session.id, 'agent-1', 'yes');
        const changedVote = await votingSystem.castVote(session.id, 'agent-1', 'no');

        expect(changedVote.choice).toBe('no');
        expect(changedVote.changed).toBe(true);
      });

      it('should validate vote options', async () => {
        await expect(
          votingSystem.castVote(sessionId, 'agent-1', 'invalid-option')
        ).rejects.toThrow('Invalid vote option');
      });

      it('should handle ranked choice voting', async () => {
        const session = await votingSystem.createSession({
          title: 'Rank options',
          type: 'ranked-choice',
          options: ['A', 'B', 'C'],
        });

        const vote = await votingSystem.castRankedVote(
          session.id,
          'agent-1',
          ['B', 'A', 'C']
        );

        expect(vote.rankings).toEqual(['B', 'A', 'C']);
      });

      it('should handle score voting', async () => {
        const session = await votingSystem.createSession({
          title: 'Score options',
          type: 'score',
          options: ['Option 1', 'Option 2', 'Option 3'],
          maxScore: 10,
        });

        const vote = await votingSystem.castScoreVote(session.id, 'agent-1', {
          'Option 1': 8,
          'Option 2': 5,
          'Option 3': 9,
        });

        expect(vote.scores['Option 3']).toBe(9);
      });
    });

    describe('Vote Delegation', () => {
      it('should allow vote delegation', async () => {
        votingSystem = new VotingSystem({ allowDelegation: true });

        const session = await votingSystem.createSession({
          title: 'Delegated decision',
          options: ['approve', 'reject'],
        });

        // Agent 1 delegates to Agent 2
        await votingSystem.delegateVote(session.id, 'agent-1', 'agent-2');

        // Agent 2 votes
        await votingSystem.castVote(session.id, 'agent-2', 'approve');

        const tally = await votingSystem.getTally(session.id);

        // Both votes should count for 'approve'
        expect(tally.approve).toBe(2);
      });

      it('should handle delegation chains', async () => {
        votingSystem = new VotingSystem({ allowDelegation: true });

        const session = await votingSystem.createSession({
          title: 'Chain delegation',
          options: ['yes', 'no'],
        });

        // Create delegation chain: A -> B -> C
        await votingSystem.delegateVote(session.id, 'agent-a', 'agent-b');
        await votingSystem.delegateVote(session.id, 'agent-b', 'agent-c');

        // Agent C votes
        await votingSystem.castVote(session.id, 'agent-c', 'yes');

        const tally = await votingSystem.getTally(session.id);

        expect(tally.yes).toBe(3);
      });

      it('should detect and prevent delegation cycles', async () => {
        votingSystem = new VotingSystem({ allowDelegation: true });

        const session = await votingSystem.createSession({
          title: 'Cycle test',
          options: ['yes', 'no'],
        });

        await votingSystem.delegateVote(session.id, 'agent-a', 'agent-b');
        await votingSystem.delegateVote(session.id, 'agent-b', 'agent-c');

        // This would create a cycle: C -> A
        await expect(
          votingSystem.delegateVote(session.id, 'agent-c', 'agent-a')
        ).rejects.toThrow('delegation cycle');
      });
    });
  });

  // ===== CONSENSUS ALGORITHMS TESTS =====
  describe('Consensus Algorithms', () => {
    beforeEach(() => {
      votingSystem = new VotingSystem();
    });

    describe('Simple Majority', () => {
      it('should determine simple majority winner', async () => {
        const session = await votingSystem.createSession({
          title: 'Simple majority',
          options: ['yes', 'no'],
          consensusType: 'simple-majority',
        });

        await votingSystem.castVote(session.id, 'agent-1', 'yes');
        await votingSystem.castVote(session.id, 'agent-2', 'yes');
        await votingSystem.castVote(session.id, 'agent-3', 'no');

        const result = await votingSystem.closeSession(session.id);

        expect(result.winner).toBe('yes');
        expect(result.consensusReached).toBe(true);
      });

      it('should handle ties in simple majority', async () => {
        const session = await votingSystem.createSession({
          title: 'Tie scenario',
          options: ['A', 'B'],
          tieBreaker: 'random',
        });

        await votingSystem.castVote(session.id, 'agent-1', 'A');
        await votingSystem.castVote(session.id, 'agent-2', 'B');

        const result = await votingSystem.closeSession(session.id);

        expect(result.tie).toBe(true);
        expect(['A', 'B']).toContain(result.winner);
      });
    });

    describe('Supermajority', () => {
      it('should require supermajority threshold', async () => {
        const session = await votingSystem.createSession({
          title: 'Supermajority required',
          options: ['approve', 'reject'],
          consensusType: 'supermajority',
          threshold: 0.66,
        });

        // 60% approval - not enough for 66% threshold
        await votingSystem.castVote(session.id, 'agent-1', 'approve');
        await votingSystem.castVote(session.id, 'agent-2', 'approve');
        await votingSystem.castVote(session.id, 'agent-3', 'approve');
        await votingSystem.castVote(session.id, 'agent-4', 'reject');
        await votingSystem.castVote(session.id, 'agent-5', 'reject');

        const result = await votingSystem.closeSession(session.id);

        expect(result.consensusReached).toBe(false);
        expect(result.winner).toBeNull();
      });
    });

    describe('Quorum Requirements', () => {
      it('should enforce quorum for vote validity', async () => {
        const session = await votingSystem.createSession({
          title: 'Quorum test',
          options: ['yes', 'no'],
          quorum: 5,
          totalVoters: 10,
        });

        // Only 3 votes - below quorum
        await votingSystem.castVote(session.id, 'agent-1', 'yes');
        await votingSystem.castVote(session.id, 'agent-2', 'yes');
        await votingSystem.castVote(session.id, 'agent-3', 'yes');

        const result = await votingSystem.closeSession(session.id);

        expect(result.quorumMet).toBe(false);
        expect(result.valid).toBe(false);
      });
    });

    describe('Instant Runoff Voting', () => {
      it('should implement instant runoff voting', async () => {
        const session = await votingSystem.createSession({
          title: 'IRV test',
          type: 'instant-runoff',
          options: ['A', 'B', 'C'],
        });

        // First preferences
        await votingSystem.castRankedVote(session.id, 'voter-1', ['A', 'B', 'C']);
        await votingSystem.castRankedVote(session.id, 'voter-2', ['B', 'C', 'A']);
        await votingSystem.castRankedVote(session.id, 'voter-3', ['C', 'B', 'A']);
        await votingSystem.castRankedVote(session.id, 'voter-4', ['A', 'C', 'B']);
        await votingSystem.castRankedVote(session.id, 'voter-5', ['B', 'A', 'C']);

        const result = await votingSystem.closeSession(session.id);

        expect(result.rounds).toBeDefined();
        expect(result.winner).toBeDefined();
        expect(result.eliminationOrder).toBeDefined();
      });
    });

    describe('Condorcet Method', () => {
      it('should find Condorcet winner', async () => {
        const session = await votingSystem.createSession({
          title: 'Condorcet test',
          type: 'condorcet',
          options: ['X', 'Y', 'Z'],
        });

        // X beats Y and Z in pairwise comparisons
        await votingSystem.castRankedVote(session.id, 'v1', ['X', 'Y', 'Z']);
        await votingSystem.castRankedVote(session.id, 'v2', ['X', 'Z', 'Y']);
        await votingSystem.castRankedVote(session.id, 'v3', ['X', 'Y', 'Z']);
        await votingSystem.castRankedVote(session.id, 'v4', ['Y', 'X', 'Z']);
        await votingSystem.castRankedVote(session.id, 'v5', ['Z', 'X', 'Y']);

        const result = await votingSystem.closeSession(session.id);

        expect(result.condorcetWinner).toBe('X');
        expect(result.pairwiseMatrix).toBeDefined();
      });
    });
  });

  // ===== TIMEOUT AND SCHEDULING TESTS =====
  describe('Timeout and Scheduling', () => {
    beforeEach(() => {
      votingSystem = new VotingSystem();
    });

    it('should auto-close session after timeout', async () => {
      const session = await votingSystem.createSession({
        title: 'Timeout test',
        options: ['yes', 'no'],
        timeout: 5000, // 5 seconds
      });

      await votingSystem.castVote(session.id, 'agent-1', 'yes');

      // Advance time past timeout
      jest.advanceTimersByTime(6000);

      const status = await votingSystem.getSessionStatus(session.id);

      expect(status).toBe('closed');
    });

    it('should extend deadline when configured', async () => {
      votingSystem = new VotingSystem({ allowDeadlineExtension: true });

      const session = await votingSystem.createSession({
        title: 'Extension test',
        options: ['yes', 'no'],
        timeout: 5000,
      });

      // Cast vote near deadline
      jest.advanceTimersByTime(4000);
      await votingSystem.castVote(session.id, 'agent-1', 'yes');

      // Should auto-extend
      jest.advanceTimersByTime(3000);

      const status = await votingSystem.getSessionStatus(session.id);
      expect(status).toBe('active');
    });

    it('should schedule future voting sessions', async () => {
      const futureTime = Date.now() + 10000;

      const session = await votingSystem.scheduleSession({
        title: 'Future vote',
        options: ['option1', 'option2'],
        startTime: futureTime,
      });

      expect(session.status).toBe('scheduled');

      // Advance to start time
      jest.advanceTimersByTime(10000);

      const status = await votingSystem.getSessionStatus(session.id);
      expect(status).toBe('active');
    });
  });

  // ===== VOTING ANALYTICS TESTS =====
  describe('Voting Analytics', () => {
    beforeEach(() => {
      votingSystem = new VotingSystem();
    });

    it('should track voting patterns', async () => {
      const sessions = [];

      // Create multiple voting sessions
      for (let i = 0; i < 5; i++) {
        const session = await votingSystem.createSession({
          title: `Vote ${i}`,
          options: ['A', 'B'],
        });

        await votingSystem.castVote(session.id, 'agent-1', i % 2 === 0 ? 'A' : 'B');
        await votingSystem.castVote(session.id, 'agent-2', 'A');
        await votingSystem.castVote(session.id, 'agent-3', 'B');

        sessions.push(session.id);
      }

      const analytics = await votingSystem.getVoterAnalytics('agent-1');

      expect(analytics).toMatchObject({
        totalVotes: 5,
        participationRate: expect.any(Number),
        preferenceDistribution: expect.any(Object),
        consistencyScore: expect.any(Number),
      });
    });

    it('should calculate consensus metrics', async () => {
      const session = await votingSystem.createSession({
        title: 'Consensus test',
        options: ['yes', 'no'],
      });

      // High consensus scenario
      for (let i = 1; i <= 8; i++) {
        await votingSystem.castVote(session.id, `agent-${i}`, 'yes');
      }
      await votingSystem.castVote(session.id, 'agent-9', 'no');
      await votingSystem.castVote(session.id, 'agent-10', 'no');

      const metrics = await votingSystem.getConsensusMetrics(session.id);

      expect(metrics).toMatchObject({
        unanimity: false,
        consensusStrength: expect.any(Number),
        dissenterCount: 2,
        majorityMargin: 0.6,
      });

      expect(metrics.consensusStrength).toBeGreaterThan(0.7);
    });

    it('should generate voting reports', async () => {
      const session = await votingSystem.createSession({
        title: 'Report test',
        options: ['approve', 'reject', 'abstain'],
      });

      await votingSystem.castVote(session.id, 'agent-1', 'approve');
      await votingSystem.castVote(session.id, 'agent-2', 'approve');
      await votingSystem.castVote(session.id, 'agent-3', 'reject');
      await votingSystem.castVote(session.id, 'agent-4', 'abstain');

      const report = await votingSystem.generateReport(session.id);

      expect(report).toMatchObject({
        sessionId: session.id,
        title: 'Report test',
        totalVotes: 4,
        distribution: {
          approve: 2,
          reject: 1,
          abstain: 1,
        },
        percentages: {
          approve: 50,
          reject: 25,
          abstain: 25,
        },
        timeline: expect.any(Array),
      });
    });
  });

  // ===== SECURITY AND INTEGRITY TESTS =====
  describe('Security and Integrity', () => {
    beforeEach(() => {
      votingSystem = new VotingSystem({
        enableAudit: true,
        cryptographicVerification: true,
      });
    });

    it('should maintain vote audit trail', async () => {
      const session = await votingSystem.createSession({
        title: 'Audit test',
        options: ['yes', 'no'],
      });

      await votingSystem.castVote(session.id, 'agent-1', 'yes');

      const auditLog = await votingSystem.getAuditLog(session.id);

      expect(auditLog).toContainEqual(
        expect.objectContaining({
          action: 'vote_cast',
          voter: 'agent-1',
          timestamp: expect.any(Number),
          hash: expect.any(String),
        })
      );
    });

    it('should detect vote tampering', async () => {
      const session = await votingSystem.createSession({
        title: 'Tamper test',
        options: ['A', 'B'],
      });

      await votingSystem.castVote(session.id, 'agent-1', 'A');

      // Attempt to tamper with vote
      const tamperAttempt = () => {
        // Direct manipulation attempt (should be prevented)
        votingSystem._sessions.get(session.id).votes['agent-1'] = 'B';
      };

      tamperAttempt();

      const verificationResult = await votingSystem.verifyIntegrity(session.id);

      expect(verificationResult.valid).toBe(false);
      expect(verificationResult.tamperedVotes).toContain('agent-1');
    });

    it('should anonymize votes when configured', async () => {
      votingSystem = new VotingSystem({ anonymousVoting: true });

      const session = await votingSystem.createSession({
        title: 'Anonymous vote',
        options: ['candidate-1', 'candidate-2'],
      });

      await votingSystem.castVote(session.id, 'agent-1', 'candidate-1');
      await votingSystem.castVote(session.id, 'agent-2', 'candidate-2');

      const votes = await votingSystem.getVotes(session.id);

      // Votes should be shuffled and anonymized
      expect(votes).not.toHaveProperty('agent-1');
      expect(votes).toHaveLength(2);
    });

    it('should implement vote encryption', async () => {
      const session = await votingSystem.createSession({
        title: 'Encrypted vote',
        options: ['yes', 'no'],
        encrypted: true,
      });

      const encryptedVote = await votingSystem.castEncryptedVote(
        session.id,
        'agent-1',
        'yes'
      );

      expect(encryptedVote.encrypted).toBe(true);
      expect(encryptedVote.payload).not.toContain('yes');
      expect(encryptedVote.signature).toBeDefined();
    });
  });

  // ===== ERROR HANDLING TESTS =====
  describe('Error Handling', () => {
    beforeEach(() => {
      votingSystem = new VotingSystem();
    });

    it('should handle invalid session ID', async () => {
      await expect(
        votingSystem.castVote('invalid-session', 'agent-1', 'yes')
      ).rejects.toThrow('Session not found');
    });

    it('should handle voting on closed session', async () => {
      const session = await votingSystem.createSession({
        title: 'Test',
        options: ['yes', 'no'],
      });

      await votingSystem.closeSession(session.id);

      await expect(
        votingSystem.castVote(session.id, 'agent-1', 'yes')
      ).rejects.toThrow('Session is closed');
    });

    it('should handle concurrent vote submissions', async () => {
      const session = await votingSystem.createSession({
        title: 'Concurrency test',
        options: ['A', 'B'],
      });

      // Simulate concurrent votes from same agent
      const votes = Array(10).fill().map(() =>
        votingSystem.castVote(session.id, 'agent-1', 'A')
          .catch(err => err.message)
      );

      const results = await Promise.all(votes);

      // Only one should succeed
      const successCount = results.filter(r => typeof r !== 'string').length;
      expect(successCount).toBe(1);
    });

    it('should recover from system failures', async () => {
      const session = await votingSystem.createSession({
        title: 'Recovery test',
        options: ['yes', 'no'],
        persistent: true,
      });

      await votingSystem.castVote(session.id, 'agent-1', 'yes');

      // Simulate system crash and recovery
      const backup = await votingSystem.backup(session.id);
      votingSystem = new VotingSystem();
      await votingSystem.restore(backup);

      const restored = await votingSystem.getSession(session.id);
      expect(restored.votes['agent-1']).toBe('yes');
    });
  });

  // ===== PERFORMANCE TESTS =====
  describe('Performance and Scalability', () => {
    it('should handle large number of voters', async () => {
      votingSystem = new VotingSystem();

      const session = await votingSystem.createSession({
        title: 'Scale test',
        options: ['A', 'B', 'C'],
      });

      const voteCount = 1000;
      const startTime = Date.now();

      const votes = Array(voteCount).fill().map((_, i) => {
        const option = ['A', 'B', 'C'][i % 3];
        return votingSystem.castVote(session.id, `voter-${i}`, option);
      });

      await Promise.all(votes);

      const duration = Date.now() - startTime;
      const votesPerSecond = voteCount / (duration / 1000);

      // Should handle at least 100 votes per second
      expect(votesPerSecond).toBeGreaterThan(100);
    });

    it('should efficiently calculate complex voting algorithms', async () => {
      votingSystem = new VotingSystem();

      const session = await votingSystem.createSession({
        title: 'Algorithm performance',
        type: 'condorcet',
        options: Array(10).fill().map((_, i) => `Option${i}`),
      });

      // Create ranked votes for performance test
      for (let i = 0; i < 100; i++) {
        const ranking = [...Array(10).keys()]
          .sort(() => Math.random() - 0.5)
          .map(j => `Option${j}`);

        await votingSystem.castRankedVote(session.id, `voter-${i}`, ranking);
      }

      const startTime = Date.now();
      const result = await votingSystem.closeSession(session.id);
      const calculationTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(calculationTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent voting sessions', async () => {
      votingSystem = new VotingSystem();

      const sessionCount = 50;
      const sessions = [];

      // Create multiple concurrent sessions
      for (let i = 0; i < sessionCount; i++) {
        sessions.push(
          votingSystem.createSession({
            title: `Session ${i}`,
            options: ['yes', 'no'],
          })
        );
      }

      const createdSessions = await Promise.all(sessions);

      // Cast votes in all sessions concurrently
      const votes = [];
      for (const session of createdSessions) {
        for (let j = 0; j < 10; j++) {
          votes.push(
            votingSystem.castVote(
              session.id,
              `voter-${j}`,
              j % 2 === 0 ? 'yes' : 'no'
            )
          );
        }
      }

      await Promise.all(votes);

      // All sessions should have correct vote count
      for (const session of createdSessions) {
        const tally = await votingSystem.getTally(session.id);
        expect(tally.yes + tally.no).toBe(10);
      }
    });
  });
});