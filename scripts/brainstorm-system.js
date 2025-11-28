#!/usr/bin/env node
/**
 * Collaborative Brainstorming System
 * Advanced multi-agent brainstorming with idea generation, combination, refinement, and voting
 *
 * Features:
 * - Idea Generation: Agents propose creative ideas
 * - Idea Combination: Merge similar ideas to create better solutions
 * - Idea Refinement: Iteratively improve existing ideas
 * - Idea Voting: Democratic ranking of best ideas
 * - Session Management: Controlled start/stop of brainstorm sessions
 * - RabbitMQ Integration: Uses fanout exchange for real-time broadcasting
 */

import { RabbitMQClient } from './rabbitmq-client.js';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Idea Categories for classification
 */
export const IdeaCategory = {
  FEATURE: 'feature',
  IMPROVEMENT: 'improvement',
  BUG_FIX: 'bug_fix',
  ARCHITECTURE: 'architecture',
  PERFORMANCE: 'performance',
  TESTING: 'testing',
  DOCUMENTATION: 'documentation',
  OTHER: 'other'
};

/**
 * Message Types for brainstorm communication
 */
export const MessageType = {
  SESSION_START: 'session_start',
  SESSION_STOP: 'session_stop',
  IDEA_PROPOSED: 'idea_proposed',
  IDEA_COMBINED: 'idea_combined',
  IDEA_REFINED: 'idea_refined',
  VOTE_CAST: 'vote_cast',
  REQUEST_IDEAS: 'request_ideas',
  SESSION_STATUS: 'session_status'
};

/**
 * Main Brainstorming System Class
 */
export class BrainstormSystem extends EventEmitter {
  constructor(agentId = null, config = {}) {
    super();

    this.agentId = agentId || `agent-${uuidv4()}`;
    this.config = {
      exchangeName: config.exchangeName || 'agent.brainstorm',
      maxIdeasPerAgent: config.maxIdeasPerAgent || 100,
      votingThreshold: config.votingThreshold || 0.7,
      combinationSimilarity: config.combinationSimilarity || 0.8,
      ...config
    };

    this.client = null;
    this.queueName = null;
    this.isInitialized = false;

    // Session state
    this.activeSessions = new Map();
    this.myIdeas = new Map();
    this.allIdeas = new Map();
    this.votes = new Map();
    this.combinations = new Map();
    this.refinements = new Map();

    // Statistics
    this.stats = {
      sessionsParticipated: 0,
      ideasGenerated: 0,
      ideasCombined: 0,
      ideasRefined: 0,
      votesCast: 0,
      votesReceived: 0
    };
  }

  /**
   * Initialize the brainstorm system
   */
  async initialize() {
    console.log(`🧠 Initializing Brainstorm System for agent: ${this.agentId}`);

    this.client = new RabbitMQClient({ agentId: this.agentId });
    await this.client.connect();

    // Setup fanout exchange for broadcasting
    const setup = await this.client.setupBrainstormExchange(this.config.exchangeName);
    this.queueName = setup.queueName;

    // Start listening to brainstorm messages
    await this.client.listenBrainstorm(this.queueName, async (msg) => {
      await this.handleBrainstormMessage(msg);
    });

    this.isInitialized = true;
    console.log(`✅ Brainstorm System initialized`);

    return this;
  }

  /**
   * Start a new brainstorm session
   */
  async startSession(topic, options = {}) {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      topic,
      startedBy: this.agentId,
      startedAt: Date.now(),
      duration: options.duration || 600000, // Default 10 minutes
      minIdeas: options.minIdeas || 10,
      maxIdeas: options.maxIdeas || 1000,
      allowCombination: options.allowCombination !== false,
      allowRefinement: options.allowRefinement !== false,
      allowVoting: options.allowVoting !== false,
      categories: options.categories || Object.values(IdeaCategory),
      participants: new Set([this.agentId]),
      ideas: [],
      status: 'active'
    };

    this.activeSessions.set(sessionId, session);
    this.stats.sessionsParticipated++;

    // Broadcast session start
    await this.broadcastMessage({
      type: MessageType.SESSION_START,
      sessionId,
      topic,
      options: {
        duration: session.duration,
        minIdeas: session.minIdeas,
        maxIdeas: session.maxIdeas,
        allowCombination: session.allowCombination,
        allowRefinement: session.allowRefinement,
        allowVoting: session.allowVoting,
        categories: session.categories
      }
    });

    console.log(`🚀 Started brainstorm session: ${sessionId}`);
    console.log(`   Topic: ${topic}`);
    console.log(`   Duration: ${session.duration}ms`);

    // Auto-stop after duration
    if (session.duration > 0) {
      setTimeout(() => {
        this.stopSession(sessionId).catch(error => {
          console.error(`❌ Error auto-stopping session ${sessionId}:`, error);
        });
      }, session.duration);
    }

    this.emit('session_started', session);
    return sessionId;
  }

  /**
   * Stop a brainstorm session
   */
  async stopSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.log(`⚠️  Session not found: ${sessionId}`);
      return;
    }

    session.status = 'stopped';
    session.endedAt = Date.now();

    // Broadcast session stop
    await this.broadcastMessage({
      type: MessageType.SESSION_STOP,
      sessionId,
      summary: {
        duration: session.endedAt - session.startedAt,
        participants: Array.from(session.participants),
        totalIdeas: session.ideas.length,
        topIdeas: this.getTopIdeas(sessionId, 5)
      }
    });

    console.log(`🛑 Stopped brainstorm session: ${sessionId}`);
    console.log(`   Duration: ${session.endedAt - session.startedAt}ms`);
    console.log(`   Total ideas: ${session.ideas.length}`);
    console.log(`   Participants: ${session.participants.size}`);

    this.emit('session_stopped', session);
    return session;
  }

  /**
   * Generate and propose an idea
   */
  async proposeIdea(sessionId, ideaContent, category = IdeaCategory.OTHER) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error('Session not active');
    }

    if (session.ideas.length >= session.maxIdeas) {
      throw new Error('Session has reached maximum ideas');
    }

    const idea = {
      id: uuidv4(),
      sessionId,
      content: ideaContent,
      category,
      proposedBy: this.agentId,
      proposedAt: Date.now(),
      votes: 0,
      voters: new Set(),
      combinedFrom: [],
      refinedFrom: null,
      score: 0
    };

    this.myIdeas.set(idea.id, idea);
    this.allIdeas.set(idea.id, idea);
    this.stats.ideasGenerated++;

    // Broadcast idea
    await this.broadcastMessage({
      type: MessageType.IDEA_PROPOSED,
      sessionId,
      idea: this.serializeIdea(idea)
    });

    console.log(`💡 Proposed idea: ${idea.id.substring(0, 8)}`);
    console.log(`   Content: ${ideaContent.substring(0, 60)}...`);
    console.log(`   Category: ${category}`);

    this.emit('idea_proposed', idea);
    return idea.id;
  }

  /**
   * Combine multiple ideas into one
   */
  async combineIdeas(sessionId, ideaIds, combinedContent, category = IdeaCategory.OTHER) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error('Session not active');
    }

    if (!session.allowCombination) {
      throw new Error('Combination not allowed in this session');
    }

    // Verify all ideas exist
    const sourceIdeas = ideaIds.map(id => this.allIdeas.get(id)).filter(Boolean);
    if (sourceIdeas.length !== ideaIds.length) {
      throw new Error('Some ideas not found');
    }

    const combinedIdea = {
      id: uuidv4(),
      sessionId,
      content: combinedContent,
      category,
      proposedBy: this.agentId,
      proposedAt: Date.now(),
      votes: 0,
      voters: new Set(),
      combinedFrom: ideaIds,
      refinedFrom: null,
      score: 0
    };

    this.myIdeas.set(combinedIdea.id, combinedIdea);
    this.allIdeas.set(combinedIdea.id, combinedIdea);
    this.combinations.set(combinedIdea.id, ideaIds);
    this.stats.ideasCombined++;

    // Broadcast combined idea
    await this.broadcastMessage({
      type: MessageType.IDEA_COMBINED,
      sessionId,
      idea: this.serializeIdea(combinedIdea),
      sourceIdeas: ideaIds
    });

    console.log(`🔗 Combined ${ideaIds.length} ideas into: ${combinedIdea.id.substring(0, 8)}`);

    this.emit('idea_combined', combinedIdea);
    return combinedIdea.id;
  }

  /**
   * Refine an existing idea
   */
  async refineIdea(sessionId, originalIdeaId, refinedContent, category = null) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error('Session not active');
    }

    if (!session.allowRefinement) {
      throw new Error('Refinement not allowed in this session');
    }

    const originalIdea = this.allIdeas.get(originalIdeaId);
    if (!originalIdea) {
      throw new Error('Original idea not found');
    }

    const refinedIdea = {
      id: uuidv4(),
      sessionId,
      content: refinedContent,
      category: category || originalIdea.category,
      proposedBy: this.agentId,
      proposedAt: Date.now(),
      votes: 0,
      voters: new Set(),
      combinedFrom: [],
      refinedFrom: originalIdeaId,
      score: 0
    };

    this.myIdeas.set(refinedIdea.id, refinedIdea);
    this.allIdeas.set(refinedIdea.id, refinedIdea);
    this.refinements.set(refinedIdea.id, originalIdeaId);
    this.stats.ideasRefined++;

    // Broadcast refined idea
    await this.broadcastMessage({
      type: MessageType.IDEA_REFINED,
      sessionId,
      idea: this.serializeIdea(refinedIdea),
      originalIdea: originalIdeaId
    });

    console.log(`✨ Refined idea: ${refinedIdea.id.substring(0, 8)}`);
    console.log(`   From: ${originalIdeaId.substring(0, 8)}`);

    this.emit('idea_refined', refinedIdea);
    return refinedIdea.id;
  }

  /**
   * Vote for an idea
   */
  async voteForIdea(sessionId, ideaId, weight = 1) {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      throw new Error('Session not active');
    }

    if (!session.allowVoting) {
      throw new Error('Voting not allowed in this session');
    }

    const idea = this.allIdeas.get(ideaId);
    if (!idea) {
      throw new Error('Idea not found');
    }

    if (idea.proposedBy === this.agentId) {
      throw new Error('Cannot vote for own idea');
    }

    const voteKey = `${sessionId}:${ideaId}`;
    if (this.votes.has(voteKey)) {
      throw new Error('Already voted for this idea');
    }

    this.votes.set(voteKey, { ideaId, weight, timestamp: Date.now() });
    this.stats.votesCast++;

    // Broadcast vote
    await this.broadcastMessage({
      type: MessageType.VOTE_CAST,
      sessionId,
      ideaId,
      weight
    });

    console.log(`👍 Voted for idea: ${ideaId.substring(0, 8)} (weight: ${weight})`);

    this.emit('vote_cast', { ideaId, weight });
    return true;
  }

  /**
   * Get top ideas by votes
   */
  getTopIdeas(sessionId, limit = 10) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return [];
    }

    const sessionIdeas = Array.from(this.allIdeas.values())
      .filter(idea => idea.sessionId === sessionId);

    return sessionIdeas
      .sort((a, b) => {
        // Sort by votes first, then by score, then by timestamp
        if (b.votes !== a.votes) return b.votes - a.votes;
        if (b.score !== a.score) return b.score - a.score;
        return a.proposedAt - b.proposedAt;
      })
      .slice(0, limit)
      .map(idea => this.serializeIdea(idea));
  }

  /**
   * Get all ideas for a session
   */
  getSessionIdeas(sessionId) {
    return Array.from(this.allIdeas.values())
      .filter(idea => idea.sessionId === sessionId)
      .map(idea => this.serializeIdea(idea));
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const ideas = this.getSessionIdeas(sessionId);
    const topIdeas = this.getTopIdeas(sessionId, 5);

    return {
      id: session.id,
      topic: session.topic,
      status: session.status,
      startedBy: session.startedBy,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      duration: session.endedAt ? session.endedAt - session.startedAt : Date.now() - session.startedAt,
      participants: Array.from(session.participants),
      totalIdeas: ideas.length,
      totalVotes: ideas.reduce((sum, idea) => sum + idea.votes, 0),
      topIdeas
    };
  }

  /**
   * Handle incoming brainstorm messages
   */
  async handleBrainstormMessage(msg) {
    const { type, sessionId } = msg.message;

    try {
      switch (type) {
        case MessageType.SESSION_START:
          await this.handleSessionStart(msg.message);
          break;

        case MessageType.SESSION_STOP:
          await this.handleSessionStop(msg.message);
          break;

        case MessageType.IDEA_PROPOSED:
          await this.handleIdeaProposed(msg.message);
          break;

        case MessageType.IDEA_COMBINED:
          await this.handleIdeaCombined(msg.message);
          break;

        case MessageType.IDEA_REFINED:
          await this.handleIdeaRefined(msg.message);
          break;

        case MessageType.VOTE_CAST:
          await this.handleVoteCast(msg.message);
          break;

        case MessageType.REQUEST_IDEAS:
          await this.handleRequestIdeas(msg.message);
          break;

        default:
          console.log(`⚠️  Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ Error handling message: ${error.message}`);
      this.emit('error', error);
    }
  }

  /**
   * Handle session start message
   */
  async handleSessionStart(message) {
    const { sessionId, topic, options } = message;

    if (this.activeSessions.has(sessionId)) {
      return; // Already tracking this session
    }

    const session = {
      id: sessionId,
      topic,
      startedBy: message.from || 'unknown',
      startedAt: Date.now(),
      duration: options.duration || 600000,
      minIdeas: options.minIdeas || 10,
      maxIdeas: options.maxIdeas || 1000,
      allowCombination: options.allowCombination !== false,
      allowRefinement: options.allowRefinement !== false,
      allowVoting: options.allowVoting !== false,
      categories: options.categories || Object.values(IdeaCategory),
      participants: new Set([this.agentId]),
      ideas: [],
      status: 'active'
    };

    this.activeSessions.set(sessionId, session);
    this.stats.sessionsParticipated++;

    console.log(`📨 Joined brainstorm session: ${sessionId}`);
    console.log(`   Topic: ${topic}`);

    this.emit('session_joined', session);
  }

  /**
   * Handle session stop message
   */
  async handleSessionStop(message) {
    const { sessionId } = message;
    const session = this.activeSessions.get(sessionId);

    if (session) {
      session.status = 'stopped';
      session.endedAt = Date.now();

      console.log(`📭 Session stopped: ${sessionId}`);
      this.emit('session_ended', session);
    }
  }

  /**
   * Handle idea proposed message
   */
  async handleIdeaProposed(message) {
    const { idea } = message;
    const deserializedIdea = this.deserializeIdea(idea);

    this.allIdeas.set(deserializedIdea.id, deserializedIdea);

    const session = this.activeSessions.get(deserializedIdea.sessionId);
    if (session) {
      session.ideas.push(deserializedIdea.id);
      session.participants.add(deserializedIdea.proposedBy);
    }

    this.emit('idea_received', deserializedIdea);
  }

  /**
   * Handle idea combined message
   */
  async handleIdeaCombined(message) {
    const { idea, sourceIdeas } = message;
    const deserializedIdea = this.deserializeIdea(idea);

    this.allIdeas.set(deserializedIdea.id, deserializedIdea);
    this.combinations.set(deserializedIdea.id, sourceIdeas);

    const session = this.activeSessions.get(deserializedIdea.sessionId);
    if (session) {
      session.ideas.push(deserializedIdea.id);
      session.participants.add(deserializedIdea.proposedBy);
    }

    this.emit('idea_combined_received', deserializedIdea);
  }

  /**
   * Handle idea refined message
   */
  async handleIdeaRefined(message) {
    const { idea, originalIdea } = message;
    const deserializedIdea = this.deserializeIdea(idea);

    this.allIdeas.set(deserializedIdea.id, deserializedIdea);
    this.refinements.set(deserializedIdea.id, originalIdea);

    const session = this.activeSessions.get(deserializedIdea.sessionId);
    if (session) {
      session.ideas.push(deserializedIdea.id);
      session.participants.add(deserializedIdea.proposedBy);
    }

    this.emit('idea_refined_received', deserializedIdea);
  }

  /**
   * Handle vote cast message
   */
  async handleVoteCast(message) {
    const { ideaId, weight } = message;
    const idea = this.allIdeas.get(ideaId);

    if (idea && !idea.voters.has(message.from)) {
      idea.votes += weight;
      idea.voters.add(message.from);
      idea.score = this.calculateIdeaScore(idea);

      if (this.myIdeas.has(ideaId)) {
        this.stats.votesReceived++;
      }

      this.emit('vote_received', { ideaId, weight });
    }
  }

  /**
   * Handle request ideas message
   */
  async handleRequestIdeas(message) {
    const { sessionId } = message;
    // Could respond with our ideas if needed
    this.emit('ideas_requested', { sessionId });
  }

  /**
   * Calculate idea score based on votes, age, combinations, etc.
   */
  calculateIdeaScore(idea) {
    let score = idea.votes * 10;

    // Bonus for combined ideas
    if (idea.combinedFrom.length > 0) {
      score += idea.combinedFrom.length * 5;
    }

    // Bonus for refined ideas
    if (idea.refinedFrom) {
      score += 3;
    }

    // Age penalty (newer ideas get slight boost)
    const ageMinutes = (Date.now() - idea.proposedAt) / 60000;
    score -= ageMinutes * 0.1;

    return Math.max(0, score);
  }

  /**
   * Broadcast message to all participants
   */
  async broadcastMessage(message) {
    await this.client.broadcastBrainstorm(message, this.config.exchangeName);
  }

  /**
   * Serialize idea for transmission
   */
  serializeIdea(idea) {
    return {
      id: idea.id,
      sessionId: idea.sessionId,
      content: idea.content,
      category: idea.category,
      proposedBy: idea.proposedBy,
      proposedAt: idea.proposedAt,
      votes: idea.votes,
      voters: Array.from(idea.voters),
      combinedFrom: idea.combinedFrom,
      refinedFrom: idea.refinedFrom,
      score: idea.score
    };
  }

  /**
   * Deserialize idea from transmission
   */
  deserializeIdea(data) {
    return {
      id: data.id,
      sessionId: data.sessionId,
      content: data.content,
      category: data.category,
      proposedBy: data.proposedBy,
      proposedAt: data.proposedAt,
      votes: data.votes || 0,
      voters: new Set(data.voters || []),
      combinedFrom: data.combinedFrom || [],
      refinedFrom: data.refinedFrom || null,
      score: data.score || 0
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeSessions: this.activeSessions.size,
      totalIdeas: this.allIdeas.size,
      myIdeas: this.myIdeas.size
    };
  }

  /**
   * Close the system
   */
  async close() {
    console.log('🔌 Closing Brainstorm System...');

    if (this.client) {
      await this.client.close();
    }

    this.isInitialized = false;
    console.log('✅ Brainstorm System closed');
  }
}

export default BrainstormSystem;
