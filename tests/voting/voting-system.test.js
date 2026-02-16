/**
 * Unit Tests for Voting System
 *
 * Comprehensive test suite for voting mechanism:
 * - Vote registration and tracking
 * - Result calculation and aggregation
 * - Tie-breaking mechanisms
 * - Concurrent voting scenarios
 * - Vote weight and influence
 * - History and audit trails
 */

import { jest } from '@jest/globals';

// ============================================================================
// SETUP: Test Fixtures & Helpers
// ============================================================================

const createVote = (overrides = {}) => ({
  id: `vote-${Date.now()}-${Math.random()}`,
  voterId: 'agent-1',
  choice: 'option-a',
  weight: 1,
  timestamp: Date.now(),
  ...overrides,
});

const createVoter = (id, weight = 1) => ({
  id,
  name: `Voter ${id}`,
  weight,
  active: true,
});

// ============================================================================
// DESCRIBE: Voting System Test Suite
// ============================================================================

describe('Voting System', () => {
  let votingSystem;

  // Simple Voting System Implementation for Testing
  class VotingSystem {
    constructor() {
      this.votes = new Map();
      this.voters = new Map();
      this.sessions = new Map();
      this.results = new Map();
    }

    registerVoter(voterId, weight = 1) {
      const voter = createVoter(voterId, weight);
      this.voters.set(voterId, voter);
      return voter;
    }

    startSession(sessionId, topic, options, duration = 60000) {
      const session = {
        id: sessionId,
        topic,
        options,
        startTime: Date.now(),
        duration,
        status: 'active',
        votes: [],
      };
      this.sessions.set(sessionId, session);
      return session;
    }

    castVote(sessionId, voterId, choice, weight = 1) {
      if (!this.sessions.has(sessionId)) {
        throw new Error('Session not found');
      }

      const session = this.sessions.get(sessionId);
      if (session.status !== 'active') {
        throw new Error('Session is not active');
      }

      const vote = createVote({
        sessionId,
        voterId,
        choice,
        weight: weight || this.voters.get(voterId)?.weight || 1,
      });

      this.votes.set(vote.id, vote);
      session.votes.push(vote);
      return vote;
    }

    getSessionVotes(sessionId) {
      return this.sessions.get(sessionId)?.votes || [];
    }

    calculateResults(sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) throw new Error('Session not found');

      const results = {};
      session.options.forEach(opt => {
        results[opt] = { votes: 0, weight: 0, percentage: 0 };
      });

      let totalWeight = 0;
      session.votes.forEach(vote => {
        results[vote.choice].votes += 1;
        results[vote.choice].weight += vote.weight;
        totalWeight += vote.weight;
      });

      // Calculate percentages
      Object.keys(results).forEach(option => {
        if (totalWeight > 0) {
          results[option].percentage = (results[option].weight / totalWeight) * 100;
        }
      });

      this.results.set(sessionId, results);
      return results;
    }

    getWinner(sessionId) {
      const results = this.results.get(sessionId);
      if (!results) throw new Error('No results found');

      let winner = null;
      let maxWeight = -1;
      const ties = [];

      Object.entries(results).forEach(([option, data]) => {
        if (data.weight > maxWeight) {
          maxWeight = data.weight;
          winner = option;
          ties = [option];
        } else if (data.weight === maxWeight) {
          ties.push(option);
        }
      });

      return { winner: ties.length === 1 ? winner : null, ties };
    }

    closeSession(sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) throw new Error('Session not found');
      session.status = 'closed';
      return this.calculateResults(sessionId);
    }

    getVoteHistory(sessionId) {
      return this.getSessionVotes(sessionId);
    }

    resetSession(sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.votes = [];
      }
    }
  }

  beforeEach(() => {
    votingSystem = new VotingSystem();
  });

  // =========================================================================
  // TEST SUITE 1: Voter Registration
  // =========================================================================

  describe('Voter Registration', () => {
    test('should register a voter successfully', () => {
      // Arrange
      const voterId = 'agent-1';

      // Act
      const voter = votingSystem.registerVoter(voterId);

      // Assert
      expect(voter).toBeDefined();
      expect(voter.id).toBe(voterId);
      expect(voter.weight).toBe(1);
      expect(votingSystem.voters.has(voterId)).toBe(true);
    });

    test('should register voter with custom weight', () => {
      // Arrange
      const voterId = 'agent-leader';
      const weight = 5;

      // Act
      const voter = votingSystem.registerVoter(voterId, weight);

      // Assert
      expect(voter.weight).toBe(weight);
      expect(votingSystem.voters.get(voterId).weight).toBe(weight);
    });

    test('should register multiple voters', () => {
      // Arrange
      const voterCount = 5;

      // Act
      for (let i = 1; i <= voterCount; i++) {
        votingSystem.registerVoter(`agent-${i}`);
      }

      // Assert
      expect(votingSystem.voters.size).toBe(voterCount);
    });

    test('should handle duplicate voter registration', () => {
      // Arrange
      const voterId = 'agent-1';

      // Act
      votingSystem.registerVoter(voterId, 1);
      votingSystem.registerVoter(voterId, 2); // Override

      // Assert
      expect(votingSystem.voters.size).toBe(1);
      expect(votingSystem.voters.get(voterId).weight).toBe(2);
    });
  });

  // =========================================================================
  // TEST SUITE 2: Session Management
  // =========================================================================

  describe('Session Management', () => {
    test('should start voting session successfully', () => {
      // Arrange
      const sessionId = 'session-001';
      const topic = 'Best optimization strategy';
      const options = ['option-a', 'option-b', 'option-c'];

      // Act
      const session = votingSystem.startSession(sessionId, topic, options);

      // Assert
      expect(session).toBeDefined();
      expect(session.topic).toBe(topic);
      expect(session.options).toEqual(options);
      expect(session.status).toBe('active');
      expect(votingSystem.sessions.has(sessionId)).toBe(true);
    });

    test('should initialize session with correct metadata', () => {
      // Arrange
      const sessionId = 'session-002';
      const topic = 'Algorithm Choice';
      const options = ['algorithm-1', 'algorithm-2'];

      // Act
      const session = votingSystem.startSession(sessionId, topic, options, 120000);

      // Assert
      expect(session.startTime).toBeDefined();
      expect(session.duration).toBe(120000);
      expect(session.votes).toEqual([]);
    });

    test('should close voting session', () => {
      // Arrange
      const sessionId = 'session-003';
      votingSystem.startSession(sessionId, 'Topic', ['a', 'b']);

      // Act
      const session = votingSystem.sessions.get(sessionId);
      session.status = 'closed';

      // Assert
      expect(session.status).toBe('closed');
    });

    test('should not allow operations on closed session', () => {
      // Arrange
      const sessionId = 'session-004';
      votingSystem.startSession(sessionId, 'Topic', ['a', 'b']);
      votingSystem.sessions.get(sessionId).status = 'closed';

      // Act & Assert
      expect(() => {
        votingSystem.castVote(sessionId, 'voter-1', 'a');
      }).toThrow('Session is not active');
    });
  });

  // =========================================================================
  // TEST SUITE 3: Vote Casting
  // =========================================================================

  describe('Vote Casting', () => {
    beforeEach(() => {
      votingSystem.startSession('session-001', 'Test Topic', ['option-a', 'option-b', 'option-c']);
      votingSystem.registerVoter('voter-1', 1);
      votingSystem.registerVoter('voter-2', 2);
    });

    test('should cast vote successfully', () => {
      // Arrange
      const sessionId = 'session-001';
      const voterId = 'voter-1';
      const choice = 'option-a';

      // Act
      const vote = votingSystem.castVote(sessionId, voterId, choice);

      // Assert
      expect(vote).toBeDefined();
      expect(vote.voterId).toBe(voterId);
      expect(vote.choice).toBe(choice);
      expect(votingSystem.votes.has(vote.id)).toBe(true);
    });

    test('should cast vote with custom weight', () => {
      // Arrange
      const sessionId = 'session-001';
      const voterId = 'voter-2';
      const choice = 'option-b';
      const weight = 2;

      // Act
      const vote = votingSystem.castVote(sessionId, voterId, choice, weight);

      // Assert
      expect(vote.weight).toBe(weight);
    });

    test('should allow multiple votes from different voters', () => {
      // Arrange
      const sessionId = 'session-001';

      // Act
      votingSystem.castVote(sessionId, 'voter-1', 'option-a');
      votingSystem.castVote(sessionId, 'voter-2', 'option-b');

      // Assert
      const votes = votingSystem.getSessionVotes(sessionId);
      expect(votes).toHaveLength(2);
    });

    test('should reject vote on non-existent session', () => {
      // Arrange
      const invalidSessionId = 'non-existent';

      // Act & Assert
      expect(() => {
        votingSystem.castVote(invalidSessionId, 'voter-1', 'option-a');
      }).toThrow('Session not found');
    });

    test('should allow voter to change their vote', () => {
      // Arrange
      const sessionId = 'session-001';
      const voterId = 'voter-1';

      // Act
      votingSystem.castVote(sessionId, voterId, 'option-a');
      votingSystem.castVote(sessionId, voterId, 'option-b');

      // Assert
      const votes = votingSystem.getSessionVotes(sessionId);
      expect(votes).toHaveLength(2);
    });
  });

  // =========================================================================
  // TEST SUITE 4: Result Calculation
  // =========================================================================

  describe('Result Calculation', () => {
    beforeEach(() => {
      votingSystem.startSession(
        'session-result',
        'Strategy Decision',
        ['strategy-a', 'strategy-b', 'strategy-c']
      );
      votingSystem.registerVoter('voter-1', 1);
      votingSystem.registerVoter('voter-2', 1);
      votingSystem.registerVoter('voter-3', 1);
    });

    test('should calculate results correctly', () => {
      // Arrange
      votingSystem.castVote('session-result', 'voter-1', 'strategy-a');
      votingSystem.castVote('session-result', 'voter-2', 'strategy-a');
      votingSystem.castVote('session-result', 'voter-3', 'strategy-b');

      // Act
      const results = votingSystem.calculateResults('session-result');

      // Assert
      expect(results['strategy-a'].votes).toBe(2);
      expect(results['strategy-b'].votes).toBe(1);
      expect(results['strategy-c'].votes).toBe(0);
    });

    test('should calculate weighted results', () => {
      // Arrange
      votingSystem.registerVoter('heavy-voter', 5);
      votingSystem.castVote('session-result', 'voter-1', 'strategy-a', 1);
      votingSystem.castVote('session-result', 'heavy-voter', 'strategy-b', 5);

      // Act
      const results = votingSystem.calculateResults('session-result');

      // Assert
      expect(results['strategy-a'].weight).toBe(1);
      expect(results['strategy-b'].weight).toBe(5);
    });

    test('should calculate percentages correctly', () => {
      // Arrange
      votingSystem.castVote('session-result', 'voter-1', 'strategy-a');
      votingSystem.castVote('session-result', 'voter-2', 'strategy-a');
      votingSystem.castVote('session-result', 'voter-3', 'strategy-b');

      // Act
      const results = votingSystem.calculateResults('session-result');

      // Assert
      expect(results['strategy-a'].percentage).toBeCloseTo(66.67, 1);
      expect(results['strategy-b'].percentage).toBeCloseTo(33.33, 1);
      expect(results['strategy-c'].percentage).toBe(0);
    });

    test('should handle zero votes scenario', () => {
      // Act
      const results = votingSystem.calculateResults('session-result');

      // Assert
      expect(results['strategy-a'].votes).toBe(0);
      expect(results['strategy-a'].percentage).toBe(0);
    });
  });

  // =========================================================================
  // TEST SUITE 5: Winner Determination & Tie-Breaking
  // =========================================================================

  describe('Winner Determination & Tie-Breaking', () => {
    beforeEach(() => {
      votingSystem.startSession('session-winner', 'Decision', ['option-a', 'option-b']);
      votingSystem.registerVoter('voter-1');
      votingSystem.registerVoter('voter-2');
      votingSystem.registerVoter('voter-3');
    });

    test('should determine winner with clear majority', () => {
      // Arrange
      votingSystem.castVote('session-winner', 'voter-1', 'option-a');
      votingSystem.castVote('session-winner', 'voter-2', 'option-a');
      votingSystem.castVote('session-winner', 'voter-3', 'option-b');
      votingSystem.calculateResults('session-winner');

      // Act
      const { winner, ties } = votingSystem.getWinner('session-winner');

      // Assert
      expect(winner).toBe('option-a');
      expect(ties).toHaveLength(1);
    });

    test('should detect tie situation', () => {
      // Arrange
      votingSystem.castVote('session-winner', 'voter-1', 'option-a');
      votingSystem.castVote('session-winner', 'voter-2', 'option-b');
      votingSystem.calculateResults('session-winner');

      // Act
      const { winner, ties } = votingSystem.getWinner('session-winner');

      // Assert
      expect(winner).toBeNull();
      expect(ties).toHaveLength(2);
    });

    test('should handle three-way tie', () => {
      // Arrange
      votingSystem.startSession('session-three-way', 'Decision', ['a', 'b', 'c']);
      votingSystem.registerVoter('v1');
      votingSystem.registerVoter('v2');
      votingSystem.registerVoter('v3');

      votingSystem.castVote('session-three-way', 'v1', 'a');
      votingSystem.castVote('session-three-way', 'v2', 'b');
      votingSystem.castVote('session-three-way', 'v3', 'c');
      votingSystem.calculateResults('session-three-way');

      // Act
      const { winner, ties } = votingSystem.getWinner('session-three-way');

      // Assert
      expect(winner).toBeNull();
      expect(ties).toHaveLength(3);
    });

    test('should handle weighted tie-breaking', () => {
      // Arrange
      votingSystem.registerVoter('super-voter', 10);

      votingSystem.castVote('session-winner', 'voter-1', 'option-a', 1);
      votingSystem.castVote('session-winner', 'super-voter', 'option-b', 10);
      votingSystem.calculateResults('session-winner');

      // Act
      const { winner } = votingSystem.getWinner('session-winner');

      // Assert
      expect(winner).toBe('option-b');
    });
  });

  // =========================================================================
  // TEST SUITE 6: Concurrent Voting
  // =========================================================================

  describe('Concurrent Voting', () => {
    test('should handle concurrent votes from multiple voters', async () => {
      // Arrange
      const sessionId = 'concurrent-session';
      votingSystem.startSession(sessionId, 'Topic', ['a', 'b']);

      const voterCount = 10;
      for (let i = 1; i <= voterCount; i++) {
        votingSystem.registerVoter(`voter-${i}`);
      }

      // Act
      const votePromises = [];
      for (let i = 1; i <= voterCount; i++) {
        const choice = i % 2 === 0 ? 'a' : 'b';
        votePromises.push(
          Promise.resolve(votingSystem.castVote(sessionId, `voter-${i}`, choice))
        );
      }
      await Promise.all(votePromises);

      // Assert
      const votes = votingSystem.getSessionVotes(sessionId);
      expect(votes).toHaveLength(voterCount);
    });

    test('should handle rapid-fire voting', () => {
      // Arrange
      const sessionId = 'rapid-session';
      votingSystem.startSession(sessionId, 'Topic', ['x', 'y', 'z']);

      // Act
      for (let i = 0; i < 100; i++) {
        votingSystem.registerVoter(`rapid-voter-${i}`);
        const choices = ['x', 'y', 'z'];
        const choice = choices[i % 3];
        votingSystem.castVote(sessionId, `rapid-voter-${i}`, choice);
      }

      // Assert
      const votes = votingSystem.getSessionVotes(sessionId);
      expect(votes).toHaveLength(100);
    });
  });

  // =========================================================================
  // TEST SUITE 7: Vote History & Audit Trail
  // =========================================================================

  describe('Vote History & Audit Trail', () => {
    test('should maintain complete vote history', () => {
      // Arrange
      const sessionId = 'history-session';
      votingSystem.startSession(sessionId, 'Topic', ['a', 'b']);
      votingSystem.registerVoter('voter-1');
      votingSystem.registerVoter('voter-2');

      // Act
      votingSystem.castVote(sessionId, 'voter-1', 'a');
      votingSystem.castVote(sessionId, 'voter-2', 'b');

      // Assert
      const history = votingSystem.getVoteHistory(sessionId);
      expect(history).toHaveLength(2);
      expect(history[0].voterId).toBe('voter-1');
      expect(history[1].voterId).toBe('voter-2');
    });

    test('should track vote timestamps', () => {
      // Arrange
      const sessionId = 'timestamp-session';
      votingSystem.startSession(sessionId, 'Topic', ['a', 'b']);

      // Act
      const before = Date.now();
      votingSystem.castVote(sessionId, 'voter-1', 'a');
      const after = Date.now();

      // Assert
      const votes = votingSystem.getVoteHistory(sessionId);
      expect(votes[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(votes[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  // =========================================================================
  // TEST SUITE 8: Error Handling & Edge Cases
  // =========================================================================

  describe('Error Handling & Edge Cases', () => {
    test('should handle empty session gracefully', () => {
      // Arrange
      const sessionId = 'empty-session';
      votingSystem.startSession(sessionId, 'Topic', ['a', 'b']);

      // Act
      const votes = votingSystem.getSessionVotes(sessionId);

      // Assert
      expect(votes).toEqual([]);
    });

    test('should handle single vote result', () => {
      // Arrange
      const sessionId = 'single-vote';
      votingSystem.startSession(sessionId, 'Topic', ['a', 'b']);

      // Act
      votingSystem.castVote(sessionId, 'voter-1', 'a');
      const results = votingSystem.calculateResults(sessionId);

      // Assert
      expect(results['a'].votes).toBe(1);
      expect(results['a'].percentage).toBe(100);
    });

    test('should reset session votes', () => {
      // Arrange
      const sessionId = 'reset-session';
      votingSystem.startSession(sessionId, 'Topic', ['a', 'b']);
      votingSystem.castVote(sessionId, 'voter-1', 'a');

      // Act
      votingSystem.resetSession(sessionId);

      // Assert
      const votes = votingSystem.getSessionVotes(sessionId);
      expect(votes).toHaveLength(0);
    });
  });
});
