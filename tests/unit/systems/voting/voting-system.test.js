/**
 * Unit Tests for VotingSystem
 * Comprehensive tests for all 5 voting algorithms, quorum validation, and audit trails
 */

import { jest } from '@jest/globals';
import { VotingSystem } from '../../../../src/systems/voting/system.js';

describe('VotingSystem', () => {
  let votingSystem;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      isHealthy: jest.fn().mockReturnValue(true),
      broadcastBrainstorm: jest.fn().mockResolvedValue('msg-123'),
      publishResult: jest.fn().mockResolvedValue('msg-456')
    };

    votingSystem = new VotingSystem(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with RabbitMQ client', () => {
      expect(votingSystem.client).toBe(mockClient);
      expect(votingSystem.votingSessions).toBeInstanceOf(Map);
      expect(votingSystem.auditTrail).toBeDefined();
    });

    test('should have all 5 voting algorithms', () => {
      expect(votingSystem.algorithms).toHaveProperty('simple_majority');
      expect(votingSystem.algorithms).toHaveProperty('confidence_weighted');
      expect(votingSystem.algorithms).toHaveProperty('quadratic');
      expect(votingSystem.algorithms).toHaveProperty('consensus');
      expect(votingSystem.algorithms).toHaveProperty('ranked_choice');
    });
  });

  describe('initiateVote()', () => {
    test('should create voting session with default values', async () => {
      const config = {
        topic: 'Test Topic',
        question: 'Test Question?',
        options: ['A', 'B', 'C'],
        initiatedBy: 'agent-1',
        totalAgents: 5
      };

      const sessionId = await votingSystem.initiateVote(config);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const session = votingSystem.votingSessions.get(sessionId);
      expect(session.topic).toBe('Test Topic');
      expect(session.question).toBe('Test Question?');
      expect(session.options).toEqual(['A', 'B', 'C']);
      expect(session.algorithm).toBe('simple_majority');
      expect(session.status).toBe('open');
    });

    test('should broadcast voting session via RabbitMQ', async () => {
      const config = {
        topic: 'API Design',
        question: 'REST or GraphQL?',
        options: ['REST', 'GraphQL'],
        algorithm: 'confidence_weighted',
        initiatedBy: 'agent-1',
        totalAgents: 5
      };

      await votingSystem.initiateVote(config);

      expect(mockClient.broadcastBrainstorm).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voting_session',
          topic: 'API Design',
          question: 'REST or GraphQL?',
          options: ['REST', 'GraphQL'],
          algorithm: 'confidence_weighted'
        }),
        'agent.brainstorm'
      );
    });

    test('should emit voting_initiated event', async () => {
      const eventSpy = jest.fn();
      votingSystem.on('voting_initiated', eventSpy);

      const config = {
        topic: 'Test',
        question: 'Question?',
        options: ['A', 'B'],
        initiatedBy: 'agent-1',
        totalAgents: 3
      };

      await votingSystem.initiateVote(config);

      expect(eventSpy).toHaveBeenCalled();
    });

    test('should set custom quorum requirements', async () => {
      const config = {
        topic: 'Critical Decision',
        question: 'Proceed?',
        options: ['Yes', 'No'],
        initiatedBy: 'agent-1',
        totalAgents: 10,
        minParticipation: 0.8,
        minConfidence: 5.0,
        minExperts: 2
      };

      const sessionId = await votingSystem.initiateVote(config);
      const session = votingSystem.votingSessions.get(sessionId);

      expect(session.quorum.minParticipation).toBe(0.8);
      expect(session.quorum.minConfidence).toBe(5.0);
      expect(session.quorum.minExperts).toBe(2);
    });
  });

  describe('castVote()', () => {
    let sessionId;

    beforeEach(async () => {
      sessionId = await votingSystem.initiateVote({
        topic: 'Test',
        question: 'Question?',
        options: ['A', 'B', 'C'],
        initiatedBy: 'agent-1',
        totalAgents: 5
      });
    });

    test('should record vote successfully', async () => {
      const vote = {
        choice: 'A',
        confidence: 0.85,
        agentLevel: 3
      };

      const record = await votingSystem.castVote(sessionId, 'agent-2', vote);

      expect(record.agentId).toBe('agent-2');
      expect(record.choice).toBe('A');
      expect(record.confidence).toBe(0.85);
      expect(record.timestamp).toBeDefined();
    });

    test('should allow vote changes', async () => {
      await votingSystem.castVote(sessionId, 'agent-2', {
        choice: 'A',
        confidence: 0.5
      });

      await votingSystem.castVote(sessionId, 'agent-2', {
        choice: 'B',
        confidence: 0.9
      });

      const session = votingSystem.votingSessions.get(sessionId);
      const agentVotes = session.votes.filter(v => v.agentId === 'agent-2');

      expect(agentVotes.length).toBe(1);
      expect(agentVotes[0].choice).toBe('B');
    });

    test('should throw error for invalid session', async () => {
      await expect(
        votingSystem.castVote('invalid-session', 'agent-2', { choice: 'A' })
      ).rejects.toThrow('Voting session not found');
    });

    test('should throw error for closed session', async () => {
      const session = votingSystem.votingSessions.get(sessionId);
      session.status = 'closed';

      await expect(
        votingSystem.castVote(sessionId, 'agent-2', { choice: 'A' })
      ).rejects.toThrow('Voting session is closed');
    });

    test('should emit vote_cast event', async () => {
      const eventSpy = jest.fn();
      votingSystem.on('vote_cast', eventSpy);

      await votingSystem.castVote(sessionId, 'agent-2', {
        choice: 'A',
        confidence: 0.85
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          agentId: 'agent-2'
        })
      );
    });
  });

  describe('simpleMajorityVote()', () => {
    test('should calculate simple majority correctly', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A' },
        { agentId: 'agent-2', choice: 'B' },
        { agentId: 'agent-3', choice: 'A' },
        { agentId: 'agent-4', choice: 'A' },
        { agentId: 'agent-5', choice: 'C' }
      ];

      const result = votingSystem.simpleMajorityVote(votes);

      expect(result.winner).toBe('A');
      expect(result.tally).toEqual({ A: 3, B: 1, C: 1 });
      expect(result.winnerPercentage).toBe(0.6);
      expect(result.totalVotes).toBe(5);
      expect(result.algorithm).toBe('simple_majority');
    });

    test('should handle tie by selecting first option', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A' },
        { agentId: 'agent-2', choice: 'B' }
      ];

      const result = votingSystem.simpleMajorityVote(votes);

      expect(result.winner).toBeDefined();
      expect(['A', 'B']).toContain(result.winner);
      expect(result.tally).toEqual({ A: 1, B: 1 });
    });

    test('should handle empty votes', () => {
      const result = votingSystem.simpleMajorityVote([]);

      expect(result.winner).toBeNull();
      expect(result.tally).toEqual({});
      expect(result.totalVotes).toBe(0);
    });
  });

  describe('confidenceWeightedVote()', () => {
    test('should weight votes by confidence', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A', confidence: 0.9 },
        { agentId: 'agent-2', choice: 'B', confidence: 0.5 },
        { agentId: 'agent-3', choice: 'A', confidence: 0.8 }
      ];

      const result = votingSystem.confidenceWeightedVote(votes);

      expect(result.winner).toBe('A');
      expect(result.weightedTally).toEqual({ A: 1.7, B: 0.5 });
      expect(result.winnerScore).toBe(1.7);
      expect(result.totalWeight).toBe(2.2);
      expect(result.averageConfidence).toBeCloseTo(0.733, 2);
      expect(result.algorithm).toBe('confidence_weighted');
    });

    test('should default confidence to 1.0 if not provided', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A' },
        { agentId: 'agent-2', choice: 'A', confidence: 0.5 }
      ];

      const result = votingSystem.confidenceWeightedVote(votes);

      expect(result.totalWeight).toBe(1.5);
    });

    test('should handle empty votes', () => {
      const result = votingSystem.confidenceWeightedVote([]);

      expect(result.winner).toBeNull();
      expect(result.totalWeight).toBe(0);
    });
  });

  describe('quadraticVote()', () => {
    test('should calculate quadratic votes correctly', () => {
      const votes = [
        {
          agentId: 'agent-1',
          allocation: { A: 64, B: 25, C: 11 } // sqrt: 8, 5, 3.3
        },
        {
          agentId: 'agent-2',
          allocation: { A: 81, B: 16, C: 3 } // sqrt: 9, 4, 1.7
        }
      ];

      const session = { tokensPerAgent: 100 };
      const result = votingSystem.quadraticVote(votes, session);

      expect(result.winner).toBe('A');
      expect(result.tally.A).toBeCloseTo(17, 0); // 8 + 9
      expect(result.tally.B).toBeCloseTo(9, 0);  // 5 + 4
      expect(result.algorithm).toBe('quadratic');
    });

    test('should include token allocation details', () => {
      const votes = [
        {
          agentId: 'agent-1',
          allocation: { A: 50, B: 50 }
        }
      ];

      const session = { tokensPerAgent: 100 };
      const result = votingSystem.quadraticVote(votes, session);

      expect(result.tokenAllocationDetails).toHaveLength(1);
      expect(result.tokenAllocationDetails[0].agentId).toBe('agent-1');
      expect(result.tokenAllocationDetails[0].allocation).toEqual({ A: 50, B: 50 });
    });

    test('should handle empty votes', () => {
      const session = { tokensPerAgent: 100 };
      const result = votingSystem.quadraticVote([], session);

      expect(result.winner).toBeNull();
      expect(result.tally).toEqual({});
    });
  });

  describe('consensusVote()', () => {
    test('should achieve consensus when threshold met', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A' },
        { agentId: 'agent-2', choice: 'A' },
        { agentId: 'agent-3', choice: 'A' },
        { agentId: 'agent-4', choice: 'B' }
      ];

      const session = { consensusThreshold: 0.75 };
      const result = votingSystem.consensusVote(votes, session);

      expect(result.winner).toBe('A');
      expect(result.consensusReached).toBe(true);
      expect(result.status).toBe('CONSENSUS_ACHIEVED');
      expect(result.requiredThreshold).toBe(0.75);
    });

    test('should fail consensus when threshold not met', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A' },
        { agentId: 'agent-2', choice: 'A' },
        { agentId: 'agent-3', choice: 'B' },
        { agentId: 'agent-4', choice: 'C' }
      ];

      const session = { consensusThreshold: 0.75 };
      const result = votingSystem.consensusVote(votes, session);

      expect(result.winner).toBe('A');
      expect(result.consensusReached).toBe(false);
      expect(result.status).toBe('NO_CONSENSUS');
    });

    test('should use default threshold of 0.75', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A' },
        { agentId: 'agent-2', choice: 'A' },
        { agentId: 'agent-3', choice: 'A' }
      ];

      const session = {};
      const result = votingSystem.consensusVote(votes, session);

      expect(result.requiredThreshold).toBe(0.75);
      expect(result.consensusReached).toBe(true);
    });
  });

  describe('rankedChoiceVote()', () => {
    test('should select winner with majority in first round', () => {
      const votes = [
        { agentId: 'agent-1', rankings: ['A', 'B', 'C'] },
        { agentId: 'agent-2', rankings: ['A', 'C', 'B'] },
        { agentId: 'agent-3', rankings: ['A', 'B', 'C'] }
      ];

      const result = votingSystem.rankedChoiceVote(votes);

      expect(result.winner).toBe('A');
      expect(result.eliminationRounds).toBe(0);
    });

    test('should eliminate lowest and redistribute', () => {
      const votes = [
        { agentId: 'agent-1', rankings: ['A', 'B', 'C'] },
        { agentId: 'agent-2', rankings: ['B', 'A', 'C'] },
        { agentId: 'agent-3', rankings: ['C', 'A', 'B'] },
        { agentId: 'agent-4', rankings: ['A', 'B', 'C'] }
      ];

      const result = votingSystem.rankedChoiceVote(votes);

      expect(result.winner).toBe('A');
      expect(result.eliminationRounds).toBeGreaterThan(0);
      expect(result.rounds).toBeDefined();
    });

    test('should handle single choice as ranking', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A' },
        { agentId: 'agent-2', choice: 'A' },
        { agentId: 'agent-3', choice: 'B' }
      ];

      const result = votingSystem.rankedChoiceVote(votes);

      expect(result.winner).toBe('A');
    });

    test('should break ties when needed', () => {
      const votes = [
        { agentId: 'agent-1', rankings: ['A', 'B'], confidence: 0.9 },
        { agentId: 'agent-2', rankings: ['B', 'A'], confidence: 0.5 }
      ];

      const result = votingSystem.rankedChoiceVote(votes);

      expect(result.winner).toBeDefined();
      if (result.tieBreakMethod) {
        expect(['confidence', 'expertise', 'timestamp', 'random']).toContain(result.tieBreakMethod);
      }
    });
  });

  describe('validateQuorum()', () => {
    test('should validate all quorum requirements', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A', confidence: 0.8, agentLevel: 5 },
        { agentId: 'agent-2', choice: 'B', confidence: 0.7, agentLevel: 4 },
        { agentId: 'agent-3', choice: 'A', confidence: 0.9, agentLevel: 3 }
      ];

      const config = {
        totalAgents: 5,
        minParticipation: 0.5,
        minConfidence: 2.0,
        minExperts: 1
      };

      const result = votingSystem.validateQuorum(votes, config);

      expect(result.participationQuorumMet).toBe(true);
      expect(result.confidenceQuorumMet).toBe(true);
      expect(result.expertQuorumMet).toBe(true);
      expect(result.isValid()).toBe(true);
    });

    test('should fail when participation too low', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A', confidence: 0.8 }
      ];

      const config = {
        totalAgents: 10,
        minParticipation: 0.5,
        minConfidence: 0,
        minExperts: 0
      };

      const result = votingSystem.validateQuorum(votes, config);

      expect(result.participationQuorumMet).toBe(false);
      expect(result.isValid()).toBe(false);
    });

    test('should fail when confidence too low', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A', confidence: 0.3 },
        { agentId: 'agent-2', choice: 'B', confidence: 0.2 }
      ];

      const config = {
        totalAgents: 2,
        minParticipation: 0.5,
        minConfidence: 2.0,
        minExperts: 0
      };

      const result = votingSystem.validateQuorum(votes, config);

      expect(result.confidenceQuorumMet).toBe(false);
      expect(result.isValid()).toBe(false);
    });

    test('should fail when not enough experts', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A', agentLevel: 2 },
        { agentId: 'agent-2', choice: 'B', agentLevel: 3 }
      ];

      const config = {
        totalAgents: 2,
        minParticipation: 0.5,
        minConfidence: 0,
        minExperts: 2
      };

      const result = votingSystem.validateQuorum(votes, config);

      expect(result.expertQuorumMet).toBe(false);
      expect(result.isValid()).toBe(false);
    });
  });

  describe('closeVoting()', () => {
    let sessionId;

    beforeEach(async () => {
      sessionId = await votingSystem.initiateVote({
        topic: 'Test',
        question: 'Question?',
        options: ['A', 'B'],
        initiatedBy: 'agent-1',
        totalAgents: 3,
        minParticipation: 0.5
      });
    });

    test('should close session and calculate results', async () => {
      await votingSystem.castVote(sessionId, 'agent-2', { choice: 'A', confidence: 0.8 });
      await votingSystem.castVote(sessionId, 'agent-3', { choice: 'A', confidence: 0.9 });

      const results = await votingSystem.closeVoting(sessionId);

      expect(results.status).toBe('SUCCESS');
      expect(results.winner).toBe('A');
      expect(results.totalVotes).toBe(2);
      expect(results.auditTrailHash).toBeDefined();
    });

    test('should fail if quorum not met', async () => {
      await votingSystem.castVote(sessionId, 'agent-2', { choice: 'A' });

      const results = await votingSystem.closeVoting(sessionId);

      expect(results.status).toBe('QUORUM_NOT_MET');
    });

    test('should emit voting_closed event', async () => {
      const eventSpy = jest.fn();
      votingSystem.on('voting_closed', eventSpy);

      await votingSystem.castVote(sessionId, 'agent-2', { choice: 'A' });
      await votingSystem.castVote(sessionId, 'agent-3', { choice: 'B' });

      await votingSystem.closeVoting(sessionId);

      expect(eventSpy).toHaveBeenCalled();
    });

    test('should publish results via RabbitMQ', async () => {
      await votingSystem.castVote(sessionId, 'agent-2', { choice: 'A' });
      await votingSystem.castVote(sessionId, 'agent-3', { choice: 'B' });

      await votingSystem.closeVoting(sessionId);

      expect(mockClient.publishResult).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voting_results',
          sessionId
        })
      );
    });

    test('should not close already closed session', async () => {
      await votingSystem.castVote(sessionId, 'agent-2', { choice: 'A' });
      await votingSystem.castVote(sessionId, 'agent-3', { choice: 'B' });

      await votingSystem.closeVoting(sessionId);
      const result2 = await votingSystem.closeVoting(sessionId);

      expect(result2).toBeUndefined();
    });
  });

  describe('VoteAuditTrail', () => {
    let sessionId;

    beforeEach(async () => {
      sessionId = await votingSystem.initiateVote({
        topic: 'Test',
        question: 'Question?',
        options: ['A', 'B'],
        initiatedBy: 'agent-1',
        totalAgents: 3
      });
    });

    test('should record all votes', async () => {
      await votingSystem.castVote(sessionId, 'agent-2', { choice: 'A', confidence: 0.8 });
      await votingSystem.castVote(sessionId, 'agent-3', { choice: 'B', confidence: 0.9 });

      const auditResults = votingSystem.auditTrail.getSessionResults(sessionId);

      expect(auditResults.totalVotes).toBe(2);
      expect(auditResults.votes).toHaveLength(2);
      expect(auditResults.verifiable).toBe(true);
    });

    test('should verify vote integrity', async () => {
      await votingSystem.castVote(sessionId, 'agent-2', { choice: 'A', confidence: 0.8 });

      const isValid = votingSystem.verifyIntegrity(sessionId);

      expect(isValid).toBe(true);
    });

    test('should detect tampered votes', async () => {
      await votingSystem.castVote(sessionId, 'agent-2', { choice: 'A', confidence: 0.8 });

      // Tamper with vote
      const session = votingSystem.auditTrail.votingSessions.get(sessionId);
      if (session && session[0]) {
        session[0].signature = 'tampered';
      }

      const isValid = votingSystem.verifyIntegrity(sessionId);

      expect(isValid).toBe(false);
    });
  });

  describe('getSessionResults()', () => {
    test('should return session results', async () => {
      const sessionId = await votingSystem.initiateVote({
        topic: 'Test',
        question: 'Question?',
        options: ['A', 'B'],
        initiatedBy: 'agent-1',
        totalAgents: 3
      });

      const results = votingSystem.getSessionResults(sessionId);

      expect(results.sessionId).toBe(sessionId);
      expect(results.topic).toBe('Test');
      expect(results.question).toBe('Question?');
      expect(results.status).toBe('open');
    });

    test('should throw error for invalid session', () => {
      expect(() => {
        votingSystem.getSessionResults('invalid-session');
      }).toThrow('Voting session not found');
    });
  });

  describe('getActiveSessions()', () => {
    test('should return all open sessions', async () => {
      await votingSystem.initiateVote({
        topic: 'Session 1',
        question: 'Q1?',
        options: ['A', 'B'],
        initiatedBy: 'agent-1',
        totalAgents: 3
      });

      const sessionId2 = await votingSystem.initiateVote({
        topic: 'Session 2',
        question: 'Q2?',
        options: ['C', 'D'],
        initiatedBy: 'agent-1',
        totalAgents: 3
      });

      // Close one session
      await votingSystem.castVote(sessionId2, 'agent-2', { choice: 'C' });
      await votingSystem.castVote(sessionId2, 'agent-3', { choice: 'D' });
      await votingSystem.closeVoting(sessionId2);

      const activeSessions = votingSystem.getActiveSessions();

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].topic).toBe('Session 1');
    });
  });

  describe('Edge Cases', () => {
    test('should handle voting without RabbitMQ client', async () => {
      const noClientVoting = new VotingSystem(null);

      const sessionId = await noClientVoting.initiateVote({
        topic: 'Test',
        question: 'Question?',
        options: ['A', 'B'],
        initiatedBy: 'agent-1',
        totalAgents: 2
      });

      expect(sessionId).toBeDefined();
    });

    test('should handle unanimous votes', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A' },
        { agentId: 'agent-2', choice: 'A' },
        { agentId: 'agent-3', choice: 'A' }
      ];

      const result = votingSystem.simpleMajorityVote(votes);

      expect(result.winner).toBe('A');
      expect(result.winnerPercentage).toBe(1.0);
    });

    test('should handle zero confidence votes', () => {
      const votes = [
        { agentId: 'agent-1', choice: 'A', confidence: 0 },
        { agentId: 'agent-2', choice: 'B', confidence: 0 }
      ];

      const result = votingSystem.confidenceWeightedVote(votes);

      expect(result.totalWeight).toBe(0);
      expect(result.averageConfidence).toBe(0);
    });
  });
});
