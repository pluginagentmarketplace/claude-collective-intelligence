/**
 * Unit Tests for BrainstormSystem
 * Comprehensive tests for collaborative brainstorming functionality
 */

import { jest, beforeAll, beforeEach, afterEach, describe, test, expect } from '@jest/globals';

// Create mock RabbitMQClient instance
const mockRabbitMQClient = {
  connect: jest.fn().mockResolvedValue({}),
  close: jest.fn().mockResolvedValue({}),
  setupBrainstormExchange: jest.fn().mockResolvedValue({
    exchange: 'test.brainstorm',
    queueName: 'test-queue'
  }),
  listenBrainstorm: jest.fn().mockResolvedValue({ consumerTag: 'test-consumer' }),
  broadcastBrainstorm: jest.fn().mockResolvedValue(true),
  publishBrainstorm: jest.fn().mockResolvedValue(true),
  isConnected: true,
  agentId: 'test-agent',
  on: jest.fn(),
  emit: jest.fn()
};

// Mock RabbitMQClient constructor
const MockRabbitMQClient = jest.fn().mockImplementation(() => mockRabbitMQClient);

// Dynamic imports for modules that depend on RabbitMQClient
let BrainstormSystem, IdeaCategory, MessageType;

describe('BrainstormSystem', () => {
  let system;

  beforeAll(async () => {
    // Reset modules and set up mock BEFORE importing
    jest.resetModules();

    // Mock the rabbitmq-client module
    jest.unstable_mockModule('../../../../src/core/rabbitmq-client.js', () => ({
      RabbitMQClient: MockRabbitMQClient
    }));

    // Import modules AFTER mock is set up
    const brainstormModule = await import('../../../../src/systems/brainstorm/system.js');
    BrainstormSystem = brainstormModule.BrainstormSystem;
    IdeaCategory = brainstormModule.IdeaCategory;
    MessageType = brainstormModule.MessageType;
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    MockRabbitMQClient.mockClear();
    Object.values(mockRabbitMQClient).forEach(fn => {
      if (typeof fn === 'function' && fn.mockClear) fn.mockClear();
    });

    system = new BrainstormSystem('test-agent-1', {
      exchangeName: 'test.brainstorm',
      maxIdeasPerAgent: 50
    });
  });

  afterEach(async () => {
    if (system && system.isInitialized) {
      await system.close();
    }
  });

  describe('Constructor', () => {
    test('should initialize with default config', () => {
      const defaultSystem = new BrainstormSystem();
      expect(defaultSystem.agentId).toBeDefined();
      expect(defaultSystem.config.exchangeName).toBe('brainstorm.exchange');
      expect(defaultSystem.config.maxIdeasPerAgent).toBe(100);
    });

    test('should initialize with custom config', () => {
      expect(system.agentId).toBe('test-agent-1');
      expect(system.config.exchangeName).toBe('test.brainstorm');
      expect(system.config.maxIdeasPerAgent).toBe(50);
    });

    test('should initialize empty state', () => {
      expect(system.activeSessions.size).toBe(0);
      expect(system.myIdeas.size).toBe(0);
      expect(system.allIdeas.size).toBe(0);
      expect(system.votes.size).toBe(0);
    });

    test('should initialize statistics', () => {
      expect(system.stats.sessionsParticipated).toBe(0);
      expect(system.stats.ideasGenerated).toBe(0);
      expect(system.stats.ideasCombined).toBe(0);
      expect(system.stats.ideasRefined).toBe(0);
      expect(system.stats.votesCast).toBe(0);
      expect(system.stats.votesReceived).toBe(0);
    });
  });

  describe('initialize()', () => {
    test('should initialize RabbitMQ connection', async () => {
      await system.initialize();

      expect(system.isInitialized).toBe(true);
      expect(system.client).toBeDefined();
      expect(system.queueName).toBeDefined();
    });

    test('should setup brainstorm exchange', async () => {
      await system.initialize();

      expect(mockChannel.assertExchange).toHaveBeenCalledWith(
        'test.brainstorm',
        'fanout',
        { durable: true }
      );
    });

    test('should setup exclusive queue', async () => {
      await system.initialize();

      expect(mockChannel.assertQueue).toHaveBeenCalled();
      expect(mockChannel.bindQueue).toHaveBeenCalled();
    });
  });

  describe('startSession()', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    test('should start a new brainstorm session', async () => {
      const sessionId = await system.startSession('Test Topic', {
        duration: 60000,
        minIdeas: 5,
        maxIdeas: 100
      });

      expect(sessionId).toBeDefined();
      expect(system.activeSessions.has(sessionId)).toBe(true);

      const session = system.activeSessions.get(sessionId);
      expect(session.topic).toBe('Test Topic');
      expect(session.status).toBe('active');
      expect(session.duration).toBe(60000);
      expect(session.minIdeas).toBe(5);
      expect(session.maxIdeas).toBe(100);
    });

    test('should broadcast session start message', async () => {
      await system.startSession('Test Topic');

      expect(mockChannel.publish).toHaveBeenCalled();
      const publishCall = mockChannel.publish.mock.calls[0];
      const message = JSON.parse(publishCall[2].toString());

      expect(message.type).toBe(MessageType.SESSION_START);
      expect(message.message.topic).toBe('Test Topic');
    });

    test('should increment session participation stats', async () => {
      const initialCount = system.stats.sessionsParticipated;
      await system.startSession('Test Topic');

      expect(system.stats.sessionsParticipated).toBe(initialCount + 1);
    });

    test('should emit session_started event', async () => {
      const eventPromise = new Promise(resolve => {
        system.on('session_started', resolve);
      });

      await system.startSession('Test Topic');
      const session = await eventPromise;

      expect(session.topic).toBe('Test Topic');
    });

    test('should auto-stop session after duration', async () => {
      jest.useFakeTimers();

      const sessionId = await system.startSession('Test Topic', { duration: 1000 });
      const session = system.activeSessions.get(sessionId);
      expect(session.status).toBe('active');

      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // Allow async operations to complete

      expect(session.status).toBe('stopped');

      jest.useRealTimers();
    });
  });

  describe('stopSession()', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    test('should stop an active session', async () => {
      const sessionId = await system.startSession('Test Topic');
      const stoppedSession = await system.stopSession(sessionId);

      expect(stoppedSession.status).toBe('stopped');
      expect(stoppedSession.endedAt).toBeDefined();
    });

    test('should broadcast session stop message', async () => {
      const sessionId = await system.startSession('Test Topic');

      mockChannel.publish.mockClear();
      await system.stopSession(sessionId);

      expect(mockChannel.publish).toHaveBeenCalled();
      const publishCall = mockChannel.publish.mock.calls[0];
      const message = JSON.parse(publishCall[2].toString());

      expect(message.type).toBe(MessageType.SESSION_STOP);
    });

    test('should emit session_stopped event', async () => {
      const sessionId = await system.startSession('Test Topic');

      const eventPromise = new Promise(resolve => {
        system.on('session_stopped', resolve);
      });

      await system.stopSession(sessionId);
      const session = await eventPromise;

      expect(session.status).toBe('stopped');
    });

    test('should handle stopping non-existent session', async () => {
      const result = await system.stopSession('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('proposeIdea()', () => {
    let sessionId;

    beforeEach(async () => {
      await system.initialize();
      sessionId = await system.startSession('Test Topic');
    });

    test('should propose a new idea', async () => {
      const ideaId = await system.proposeIdea(
        sessionId,
        'This is a great idea',
        IdeaCategory.FEATURE
      );

      expect(ideaId).toBeDefined();
      expect(system.myIdeas.has(ideaId)).toBe(true);
      expect(system.allIdeas.has(ideaId)).toBe(true);

      const idea = system.myIdeas.get(ideaId);
      expect(idea.content).toBe('This is a great idea');
      expect(idea.category).toBe(IdeaCategory.FEATURE);
      expect(idea.proposedBy).toBe('test-agent-1');
    });

    test('should broadcast idea proposed message', async () => {
      mockChannel.publish.mockClear();
      await system.proposeIdea(sessionId, 'Test idea');

      expect(mockChannel.publish).toHaveBeenCalled();
      const publishCall = mockChannel.publish.mock.calls[0];
      const message = JSON.parse(publishCall[2].toString());

      expect(message.type).toBe(MessageType.IDEA_PROPOSED);
      expect(message.message.idea.content).toBe('Test idea');
    });

    test('should increment ideas generated stats', async () => {
      const initialCount = system.stats.ideasGenerated;
      await system.proposeIdea(sessionId, 'Test idea');

      expect(system.stats.ideasGenerated).toBe(initialCount + 1);
    });

    test('should emit idea_proposed event', async () => {
      const eventPromise = new Promise(resolve => {
        system.on('idea_proposed', resolve);
      });

      await system.proposeIdea(sessionId, 'Test idea');
      const idea = await eventPromise;

      expect(idea.content).toBe('Test idea');
    });

    test('should throw error for inactive session', async () => {
      await expect(
        system.proposeIdea('non-existent-session', 'Test idea')
      ).rejects.toThrow('Session not active');
    });

    test('should throw error when max ideas reached', async () => {
      const session = system.activeSessions.get(sessionId);
      session.maxIdeas = 1;

      await system.proposeIdea(sessionId, 'First idea');

      await expect(
        system.proposeIdea(sessionId, 'Second idea')
      ).rejects.toThrow('Session has reached maximum ideas');
    });
  });

  describe('combineIdeas()', () => {
    let sessionId;
    let idea1Id;
    let idea2Id;

    beforeEach(async () => {
      await system.initialize();
      sessionId = await system.startSession('Test Topic');
      idea1Id = await system.proposeIdea(sessionId, 'Idea 1', IdeaCategory.FEATURE);
      idea2Id = await system.proposeIdea(sessionId, 'Idea 2', IdeaCategory.FEATURE);
    });

    test('should combine multiple ideas', async () => {
      const combinedId = await system.combineIdeas(
        sessionId,
        [idea1Id, idea2Id],
        'Combined idea from 1 and 2',
        IdeaCategory.FEATURE
      );

      expect(combinedId).toBeDefined();
      expect(system.allIdeas.has(combinedId)).toBe(true);

      const combinedIdea = system.allIdeas.get(combinedId);
      expect(combinedIdea.content).toBe('Combined idea from 1 and 2');
      expect(combinedIdea.combinedFrom).toEqual([idea1Id, idea2Id]);
    });

    test('should broadcast idea combined message', async () => {
      mockChannel.publish.mockClear();
      await system.combineIdeas(sessionId, [idea1Id, idea2Id], 'Combined');

      expect(mockChannel.publish).toHaveBeenCalled();
      const publishCall = mockChannel.publish.mock.calls[0];
      const message = JSON.parse(publishCall[2].toString());

      expect(message.type).toBe(MessageType.IDEA_COMBINED);
      expect(message.message.sourceIdeas).toEqual([idea1Id, idea2Id]);
    });

    test('should increment ideas combined stats', async () => {
      const initialCount = system.stats.ideasCombined;
      await system.combineIdeas(sessionId, [idea1Id, idea2Id], 'Combined');

      expect(system.stats.ideasCombined).toBe(initialCount + 1);
    });

    test('should emit idea_combined event', async () => {
      const eventPromise = new Promise(resolve => {
        system.on('idea_combined', resolve);
      });

      await system.combineIdeas(sessionId, [idea1Id, idea2Id], 'Combined');
      const idea = await eventPromise;

      expect(idea.content).toBe('Combined');
    });

    test('should throw error if combination not allowed', async () => {
      const session = system.activeSessions.get(sessionId);
      session.allowCombination = false;

      await expect(
        system.combineIdeas(sessionId, [idea1Id, idea2Id], 'Combined')
      ).rejects.toThrow('Combination not allowed');
    });

    test('should throw error if source ideas not found', async () => {
      await expect(
        system.combineIdeas(sessionId, [idea1Id, 'non-existent-id'], 'Combined')
      ).rejects.toThrow('Some ideas not found');
    });
  });

  describe('refineIdea()', () => {
    let sessionId;
    let originalIdeaId;

    beforeEach(async () => {
      await system.initialize();
      sessionId = await system.startSession('Test Topic');
      originalIdeaId = await system.proposeIdea(sessionId, 'Original idea', IdeaCategory.FEATURE);
    });

    test('should refine an existing idea', async () => {
      const refinedId = await system.refineIdea(
        sessionId,
        originalIdeaId,
        'Refined version of original idea'
      );

      expect(refinedId).toBeDefined();
      expect(system.allIdeas.has(refinedId)).toBe(true);

      const refinedIdea = system.allIdeas.get(refinedId);
      expect(refinedIdea.content).toBe('Refined version of original idea');
      expect(refinedIdea.refinedFrom).toBe(originalIdeaId);
    });

    test('should inherit category from original idea', async () => {
      const refinedId = await system.refineIdea(
        sessionId,
        originalIdeaId,
        'Refined idea'
      );

      const refinedIdea = system.allIdeas.get(refinedId);
      expect(refinedIdea.category).toBe(IdeaCategory.FEATURE);
    });

    test('should broadcast idea refined message', async () => {
      mockChannel.publish.mockClear();
      await system.refineIdea(sessionId, originalIdeaId, 'Refined');

      expect(mockChannel.publish).toHaveBeenCalled();
      const publishCall = mockChannel.publish.mock.calls[0];
      const message = JSON.parse(publishCall[2].toString());

      expect(message.type).toBe(MessageType.IDEA_REFINED);
      expect(message.message.originalIdea).toBe(originalIdeaId);
    });

    test('should increment ideas refined stats', async () => {
      const initialCount = system.stats.ideasRefined;
      await system.refineIdea(sessionId, originalIdeaId, 'Refined');

      expect(system.stats.ideasRefined).toBe(initialCount + 1);
    });

    test('should emit idea_refined event', async () => {
      const eventPromise = new Promise(resolve => {
        system.on('idea_refined', resolve);
      });

      await system.refineIdea(sessionId, originalIdeaId, 'Refined');
      const idea = await eventPromise;

      expect(idea.content).toBe('Refined');
    });

    test('should throw error if refinement not allowed', async () => {
      const session = system.activeSessions.get(sessionId);
      session.allowRefinement = false;

      await expect(
        system.refineIdea(sessionId, originalIdeaId, 'Refined')
      ).rejects.toThrow('Refinement not allowed');
    });

    test('should throw error if original idea not found', async () => {
      await expect(
        system.refineIdea(sessionId, 'non-existent-id', 'Refined')
      ).rejects.toThrow('Original idea not found');
    });
  });

  describe('voteForIdea()', () => {
    let sessionId;
    let ideaId;

    beforeEach(async () => {
      await system.initialize();
      sessionId = await system.startSession('Test Topic');

      // Create another system to propose the idea (can't vote for own ideas)
      const otherSystem = new BrainstormSystem('other-agent');
      await otherSystem.initialize();

      ideaId = await otherSystem.proposeIdea(sessionId, 'Someone else\'s idea');

      // Manually add the idea to our system (simulating receiving it)
      const idea = otherSystem.allIdeas.get(ideaId);
      system.allIdeas.set(ideaId, idea);

      await otherSystem.close();
    });

    test('should vote for an idea', async () => {
      const result = await system.voteForIdea(sessionId, ideaId, 1);

      expect(result).toBe(true);
      expect(system.votes.has(`${sessionId}:${ideaId}`)).toBe(true);
    });

    test('should broadcast vote cast message', async () => {
      mockChannel.publish.mockClear();
      await system.voteForIdea(sessionId, ideaId, 1);

      expect(mockChannel.publish).toHaveBeenCalled();
      const publishCall = mockChannel.publish.mock.calls[0];
      const message = JSON.parse(publishCall[2].toString());

      expect(message.type).toBe(MessageType.VOTE_CAST);
      expect(message.message.ideaId).toBe(ideaId);
      expect(message.message.weight).toBe(1);
    });

    test('should increment votes cast stats', async () => {
      const initialCount = system.stats.votesCast;
      await system.voteForIdea(sessionId, ideaId, 1);

      expect(system.stats.votesCast).toBe(initialCount + 1);
    });

    test('should emit vote_cast event', async () => {
      const eventPromise = new Promise(resolve => {
        system.on('vote_cast', resolve);
      });

      await system.voteForIdea(sessionId, ideaId, 1);
      const vote = await eventPromise;

      expect(vote.ideaId).toBe(ideaId);
      expect(vote.weight).toBe(1);
    });

    test('should throw error if voting not allowed', async () => {
      const session = system.activeSessions.get(sessionId);
      session.allowVoting = false;

      await expect(
        system.voteForIdea(sessionId, ideaId, 1)
      ).rejects.toThrow('Voting not allowed');
    });

    test('should throw error if idea not found', async () => {
      await expect(
        system.voteForIdea(sessionId, 'non-existent-id', 1)
      ).rejects.toThrow('Idea not found');
    });

    test('should throw error when voting for own idea', async () => {
      const myIdeaId = await system.proposeIdea(sessionId, 'My idea');

      await expect(
        system.voteForIdea(sessionId, myIdeaId, 1)
      ).rejects.toThrow('Cannot vote for own idea');
    });

    test('should throw error when voting twice', async () => {
      await system.voteForIdea(sessionId, ideaId, 1);

      await expect(
        system.voteForIdea(sessionId, ideaId, 1)
      ).rejects.toThrow('Already voted for this idea');
    });
  });

  describe('getTopIdeas()', () => {
    let sessionId;

    beforeEach(async () => {
      await system.initialize();
      sessionId = await system.startSession('Test Topic');
    });

    test('should return top ideas by votes', async () => {
      const idea1 = await system.proposeIdea(sessionId, 'Idea 1');
      const idea2 = await system.proposeIdea(sessionId, 'Idea 2');
      const idea3 = await system.proposeIdea(sessionId, 'Idea 3');

      // Simulate votes
      system.allIdeas.get(idea1).votes = 5;
      system.allIdeas.get(idea2).votes = 10;
      system.allIdeas.get(idea3).votes = 3;

      const topIdeas = system.getTopIdeas(sessionId, 2);

      expect(topIdeas.length).toBe(2);
      expect(topIdeas[0].id).toBe(idea2); // Most votes
      expect(topIdeas[1].id).toBe(idea1);
    });

    test('should limit results', async () => {
      for (let i = 0; i < 10; i++) {
        await system.proposeIdea(sessionId, `Idea ${i}`);
      }

      const topIdeas = system.getTopIdeas(sessionId, 5);
      expect(topIdeas.length).toBe(5);
    });

    test('should return empty array for non-existent session', () => {
      const topIdeas = system.getTopIdeas('non-existent-session');
      expect(topIdeas).toEqual([]);
    });
  });

  describe('getSessionStatus()', () => {
    let sessionId;

    beforeEach(async () => {
      await system.initialize();
      sessionId = await system.startSession('Test Topic');
    });

    test('should return session status', async () => {
      await system.proposeIdea(sessionId, 'Idea 1');
      await system.proposeIdea(sessionId, 'Idea 2');

      const status = system.getSessionStatus(sessionId);

      expect(status.id).toBe(sessionId);
      expect(status.topic).toBe('Test Topic');
      expect(status.status).toBe('active');
      expect(status.totalIdeas).toBe(2);
      expect(status.participants).toContain('test-agent-1');
    });

    test('should return null for non-existent session', () => {
      const status = system.getSessionStatus('non-existent-session');
      expect(status).toBeNull();
    });
  });

  describe('calculateIdeaScore()', () => {
    test('should calculate score based on votes', () => {
      const idea = {
        votes: 5,
        combinedFrom: [],
        refinedFrom: null,
        proposedAt: Date.now()
      };

      const score = system.calculateIdeaScore(idea);
      expect(score).toBeGreaterThan(0);
    });

    test('should give bonus for combined ideas', () => {
      const normalIdea = {
        votes: 5,
        combinedFrom: [],
        refinedFrom: null,
        proposedAt: Date.now()
      };

      const combinedIdea = {
        votes: 5,
        combinedFrom: ['id1', 'id2'],
        refinedFrom: null,
        proposedAt: Date.now()
      };

      const normalScore = system.calculateIdeaScore(normalIdea);
      const combinedScore = system.calculateIdeaScore(combinedIdea);

      expect(combinedScore).toBeGreaterThan(normalScore);
    });

    test('should give bonus for refined ideas', () => {
      const normalIdea = {
        votes: 5,
        combinedFrom: [],
        refinedFrom: null,
        proposedAt: Date.now()
      };

      const refinedIdea = {
        votes: 5,
        combinedFrom: [],
        refinedFrom: 'original-id',
        proposedAt: Date.now()
      };

      const normalScore = system.calculateIdeaScore(normalIdea);
      const refinedScore = system.calculateIdeaScore(refinedIdea);

      expect(refinedScore).toBeGreaterThan(normalScore);
    });
  });

  describe('getStats()', () => {
    beforeEach(async () => {
      await system.initialize();
    });

    test('should return statistics', async () => {
      const sessionId = await system.startSession('Test Topic');
      await system.proposeIdea(sessionId, 'Idea 1');

      const stats = system.getStats();

      expect(stats.sessionsParticipated).toBe(1);
      expect(stats.ideasGenerated).toBe(1);
      expect(stats.activeSessions).toBe(1);
      expect(stats.totalIdeas).toBe(1);
      expect(stats.myIdeas).toBe(1);
    });
  });

  describe('serializeIdea() and deserializeIdea()', () => {
    test('should serialize and deserialize idea correctly', () => {
      const originalIdea = {
        id: 'test-id',
        sessionId: 'session-id',
        content: 'Test content',
        category: IdeaCategory.FEATURE,
        proposedBy: 'agent-1',
        proposedAt: Date.now(),
        votes: 5,
        voters: new Set(['voter1', 'voter2']),
        combinedFrom: ['id1', 'id2'],
        refinedFrom: 'original-id',
        score: 100
      };

      const serialized = system.serializeIdea(originalIdea);
      const deserialized = system.deserializeIdea(serialized);

      expect(deserialized.id).toBe(originalIdea.id);
      expect(deserialized.content).toBe(originalIdea.content);
      expect(deserialized.category).toBe(originalIdea.category);
      expect(deserialized.votes).toBe(originalIdea.votes);
      expect(Array.from(deserialized.voters)).toEqual(['voter1', 'voter2']);
      expect(deserialized.combinedFrom).toEqual(originalIdea.combinedFrom);
      expect(deserialized.refinedFrom).toBe(originalIdea.refinedFrom);
    });
  });

  describe('close()', () => {
    test('should close RabbitMQ connection', async () => {
      await system.initialize();
      await system.close();

      expect(system.isInitialized).toBe(false);
      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });
  });
});
