#!/usr/bin/env node
/**
 * Multi-Agent Voting System
 * Enables democratic decision-making with multiple voting algorithms and confidence scoring
 *
 * Implements 5 voting algorithms:
 * 1. Simple Majority - One vote per agent
 * 2. Confidence-Weighted - Votes weighted by agent confidence
 * 3. Quadratic Voting - Tokens allocate votes with diminishing returns
 * 4. Consensus Threshold - Requires supermajority agreement
 * 5. Ranked Choice - Instant runoff voting with preference rankings
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export class VotingSystem extends EventEmitter {
  constructor(rabbitMQClient) {
    super();
    this.client = rabbitMQClient;
    this.votingSessions = new Map();
    this.auditTrail = new VoteAuditTrail();
    this.algorithms = {
      'simple_majority': this.simpleMajorityVote.bind(this),
      'confidence_weighted': this.confidenceWeightedVote.bind(this),
      'quadratic': this.quadraticVote.bind(this),
      'consensus': this.consensusVote.bind(this),
      'ranked_choice': this.rankedChoiceVote.bind(this)
    };
  }

  /**
   * Initiate voting session
   */
  async initiateVote(config) {
    const sessionId = uuidv4();

    const session = {
      id: sessionId,
      topic: config.topic,
      question: config.question,
      options: config.options,
      algorithm: config.algorithm || 'simple_majority',
      initiatedBy: config.initiatedBy,
      initiatedAt: Date.now(),

      // Quorum configuration
      quorum: {
        minParticipation: config.minParticipation || 0.5,
        minConfidence: config.minConfidence || 0.0,
        minExperts: config.minExperts || 0,
        totalAgents: config.totalAgents
      },

      // Voting state
      votes: [],
      status: 'open',
      deadline: config.deadline || (Date.now() + 300000), // 5 min default

      // Results (populated after closing)
      results: null,

      // Algorithm-specific config
      consensusThreshold: config.consensusThreshold || 0.75,
      tokensPerAgent: config.tokensPerAgent || 100
    };

    this.votingSessions.set(sessionId, session);

    // Broadcast voting request via brainstorm exchange
    if (this.client && this.client.isHealthy()) {
      await this.client.broadcastBrainstorm({
        type: 'voting_session',
        sessionId,
        topic: config.topic,
        question: config.question,
        options: config.options,
        algorithm: config.algorithm,
        deadline: session.deadline,
        tokensPerAgent: session.tokensPerAgent
      }, 'agent.brainstorm');
    }

    this.emit('voting_initiated', session);

    // Auto-close at deadline
    const timeUntilDeadline = session.deadline - Date.now();
    if (timeUntilDeadline > 0) {
      setTimeout(() => this.closeVoting(sessionId), timeUntilDeadline);
    }

    return sessionId;
  }

  /**
   * Cast vote
   */
  async castVote(sessionId, agentId, vote) {
    const session = this.votingSessions.get(sessionId);
    if (!session) {
      throw new Error('Voting session not found');
    }

    if (session.status !== 'open') {
      throw new Error('Voting session is closed');
    }

    if (Date.now() > session.deadline) {
      throw new Error('Voting deadline passed');
    }

    // Remove previous vote from same agent (allow vote changes)
    session.votes = session.votes.filter(v => v.agentId !== agentId);

    // Add new vote
    const voteRecord = {
      agentId,
      ...vote,
      timestamp: Date.now()
    };

    session.votes.push(voteRecord);

    // Record in audit trail
    this.auditTrail.recordVote(sessionId, agentId, vote);

    this.emit('vote_cast', { sessionId, agentId, vote });

    return voteRecord;
  }

  /**
   * Close voting and calculate results
   */
  async closeVoting(sessionId) {
    const session = this.votingSessions.get(sessionId);
    if (!session || session.status !== 'open') {
      return;
    }

    session.status = 'closed';
    session.closedAt = Date.now();

    // Validate quorum
    const quorumValid = this.validateQuorum(session.votes, session.quorum);

    if (!quorumValid.isValid()) {
      session.results = {
        status: 'QUORUM_NOT_MET',
        quorumValidation: quorumValid,
        votes: session.votes.length
      };

      this.emit('voting_failed', session);
      return session.results;
    }

    // Calculate results using specified algorithm
    const algorithm = this.algorithms[session.algorithm];
    if (!algorithm) {
      throw new Error(`Unknown voting algorithm: ${session.algorithm}`);
    }

    const results = algorithm(session.votes, session);

    session.results = {
      ...results,
      status: 'SUCCESS',
      quorumValidation: quorumValid,
      totalVotes: session.votes.length,
      calculatedAt: Date.now(),
      auditTrailHash: this.auditTrail.hashSession(
        this.auditTrail.votingSessions.get(sessionId) || []
      )
    };

    // Publish results
    if (this.client && this.client.isHealthy()) {
      await this.client.publishResult({
        type: 'voting_results',
        sessionId,
        results: session.results
      });
    }

    this.emit('voting_closed', session);

    return session.results;
  }

  /**
   * Simple majority vote - Each agent gets 1 vote, most votes win
   */
  simpleMajorityVote(votes) {
    const tally = {};
    votes.forEach(vote => {
      const choice = vote.choice;
      tally[choice] = (tally[choice] || 0) + 1;
    });

    if (Object.keys(tally).length === 0) {
      return {
        winner: null,
        tally: {},
        winnerPercentage: 0,
        totalVotes: 0,
        algorithm: 'simple_majority'
      };
    }

    const winner = Object.keys(tally)
      .reduce((a, b) => tally[a] > tally[b] ? a : b);

    return {
      winner,
      tally,
      winnerPercentage: tally[winner] / votes.length,
      totalVotes: votes.length,
      algorithm: 'simple_majority'
    };
  }

  /**
   * Confidence-weighted vote - Votes weighted by agent confidence (0-1 scale)
   */
  confidenceWeightedVote(votes) {
    const weightedTally = {};
    let totalWeight = 0;

    votes.forEach(vote => {
      const weight = vote.confidence || 1.0;
      const choice = vote.choice;
      weightedTally[choice] = (weightedTally[choice] || 0) + weight;
      totalWeight += weight;
    });

    if (Object.keys(weightedTally).length === 0) {
      return {
        winner: null,
        weightedTally: {},
        winnerScore: 0,
        winnerPercentage: 0,
        totalWeight: 0,
        averageConfidence: 0,
        algorithm: 'confidence_weighted'
      };
    }

    const winner = Object.keys(weightedTally)
      .reduce((a, b) => weightedTally[a] > weightedTally[b] ? a : b);

    return {
      winner,
      weightedTally,
      winnerScore: weightedTally[winner],
      winnerPercentage: weightedTally[winner] / totalWeight,
      totalWeight,
      averageConfidence: totalWeight / votes.length,
      algorithm: 'confidence_weighted'
    };
  }

  /**
   * Quadratic vote - Agents allocate tokens, votes = sqrt(tokens)
   * Use case: Preference intensity matters, minority protection
   */
  quadraticVote(votes, session) {
    const tokensPerAgent = session.tokensPerAgent || 100;
    const tally = {};

    votes.forEach(vote => {
      if (vote.allocation) {
        Object.keys(vote.allocation).forEach(choice => {
          const tokens = vote.allocation[choice];
          const voteCount = Math.sqrt(tokens);
          tally[choice] = (tally[choice] || 0) + voteCount;
        });
      }
    });

    if (Object.keys(tally).length === 0) {
      return {
        winner: null,
        tally: {},
        winnerVotes: 0,
        tokenAllocationDetails: [],
        algorithm: 'quadratic'
      };
    }

    const winner = Object.keys(tally)
      .reduce((a, b) => tally[a] > tally[b] ? a : b);

    return {
      winner,
      tally,
      winnerVotes: tally[winner],
      tokenAllocationDetails: votes.map(v => ({
        agentId: v.agentId,
        allocation: v.allocation
      })),
      algorithm: 'quadratic'
    };
  }

  /**
   * Consensus threshold vote - Requires minimum agreement percentage
   */
  consensusVote(votes, session) {
    const thresholdPercentage = session.consensusThreshold || 0.75;
    const simple = this.simpleMajorityVote(votes);

    const consensusReached = simple.winnerPercentage >= thresholdPercentage;

    return {
      ...simple,
      consensusReached,
      requiredThreshold: thresholdPercentage,
      status: consensusReached ? 'CONSENSUS_ACHIEVED' : 'NO_CONSENSUS',
      algorithm: 'consensus'
    };
  }

  /**
   * Ranked choice vote - Agents rank preferences, instant runoff elimination
   */
  rankedChoiceVote(votes) {
    let rankings = votes.map(v => [...(v.rankings || [v.choice])]); // Deep copy
    const eliminated = new Set();
    const rounds = [];

    while (true) {
      // Count first-choice votes
      const tally = {};
      rankings.forEach(ranking => {
        const firstChoice = ranking.find(choice => !eliminated.has(choice));
        if (firstChoice) {
          tally[firstChoice] = (tally[firstChoice] || 0) + 1;
        }
      });

      rounds.push({ ...tally, eliminated: [...eliminated] });

      if (Object.keys(tally).length === 0) {
        return {
          winner: null,
          tally: {},
          eliminationRounds: eliminated.size,
          rounds,
          algorithm: 'ranked_choice'
        };
      }

      const totalVotes = Object.values(tally).reduce((a, b) => a + b, 0);
      const winner = Object.keys(tally).reduce((a, b) =>
        tally[a] > tally[b] ? a : b
      );

      // Winner has majority?
      if (tally[winner] > totalVotes / 2) {
        return {
          winner,
          tally,
          eliminationRounds: eliminated.size,
          winnerPercentage: tally[winner] / totalVotes,
          rounds,
          algorithm: 'ranked_choice'
        };
      }

      // Eliminate lowest
      const loser = Object.keys(tally).reduce((a, b) =>
        tally[a] < tally[b] ? a : b
      );
      eliminated.add(loser);

      // Prevent infinite loop
      if (eliminated.size >= Object.keys(tally).length - 1) {
        // Tie-breaking needed
        const tieBreak = this.breakTie(Object.keys(tally), votes);
        return {
          winner: tieBreak.winner,
          tally,
          eliminationRounds: eliminated.size,
          status: 'TIE_BROKEN',
          tieBreakMethod: tieBreak.method,
          rounds,
          algorithm: 'ranked_choice'
        };
      }
    }
  }

  /**
   * Break ties using multiple criteria
   */
  breakTie(tiedOptions, votes) {
    // 1. Confidence weighting
    const confidenceScores = tiedOptions.map(option => {
      return votes
        .filter(v => v.choice === option || (v.rankings && v.rankings.includes(option)))
        .reduce((sum, v) => sum + (v.confidence || 1.0), 0);
    });

    const maxConfidence = Math.max(...confidenceScores);
    const confidentWinners = tiedOptions.filter((opt, i) =>
      confidenceScores[i] === maxConfidence
    );

    if (confidentWinners.length === 1) {
      return { winner: confidentWinners[0], method: 'confidence' };
    }

    // 2. Expertise weighting
    const expertiseScores = confidentWinners.map(option => {
      return votes
        .filter(v => v.choice === option || (v.rankings && v.rankings.includes(option)))
        .reduce((sum, v) => sum + ((v.agentLevel >= 4) ? 2 : 1), 0);
    });

    const maxExpertise = Math.max(...expertiseScores);
    const expertWinners = confidentWinners.filter((opt, i) =>
      expertiseScores[i] === maxExpertise
    );

    if (expertWinners.length === 1) {
      return { winner: expertWinners[0], method: 'expertise' };
    }

    // 3. Timestamp (first vote)
    const timestampWinner = votes
      .filter(v => expertWinners.includes(v.choice) ||
                   (v.rankings && v.rankings.some(r => expertWinners.includes(r))))
      .sort((a, b) => a.timestamp - b.timestamp)[0];

    if (timestampWinner) {
      const winner = timestampWinner.choice || timestampWinner.rankings[0];
      return { winner, method: 'timestamp' };
    }

    // 4. Random selection
    const randomIndex = Math.floor(Math.random() * expertWinners.length);
    return { winner: expertWinners[randomIndex], method: 'random' };
  }

  /**
   * Validate quorum requirements
   */
  validateQuorum(votes, config) {
    // Guard against division by zero
    const participationRate = (config?.totalAgents > 0)
      ? votes.length / config.totalAgents
      : 0;
    const totalConfidence = votes.reduce((sum, v) => sum + (v.confidence || 1.0), 0);
    const expertVotes = votes.filter(v => (v.agentLevel || 0) >= 4).length;

    const result = {
      participationQuorumMet: participationRate >= config.minParticipation,
      confidenceQuorumMet: totalConfidence >= config.minConfidence,
      expertQuorumMet: expertVotes >= config.minExperts,

      participationRate,
      totalConfidence,
      expertVotes
    };

    result.isValid = function() {
      return this.participationQuorumMet &&
             this.confidenceQuorumMet &&
             this.expertQuorumMet;
    };

    return result;
  }

  /**
   * Get session results
   */
  getSessionResults(sessionId) {
    const session = this.votingSessions.get(sessionId);
    if (!session) {
      throw new Error('Voting session not found');
    }

    return {
      sessionId,
      topic: session.topic,
      question: session.question,
      status: session.status,
      results: session.results,
      auditTrail: this.auditTrail.getSessionResults(sessionId)
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    const sessions = [];
    for (const [sessionId, session] of this.votingSessions.entries()) {
      if (session.status === 'open') {
        sessions.push({
          sessionId,
          topic: session.topic,
          question: session.question,
          algorithm: session.algorithm,
          votesCount: session.votes.length,
          deadline: session.deadline
        });
      }
    }
    return sessions;
  }

  /**
   * Verify vote integrity
   */
  verifyIntegrity(sessionId) {
    return this.auditTrail.verifyIntegrity(sessionId);
  }

  /**
   * Calculate confidence score for a decision
   */
  calculateConfidence(agent, decision) {
    const factors = {
      expertise: this.getExpertiseScore(agent, decision.domain),
      experience: this.getExperienceScore(agent, decision.taskType),
      dataQuality: this.assessDataQuality(decision.context),
      complexity: this.assessComplexity(decision),
      timeAvailable: this.assessTimeConstraints(decision)
    };

    // Weighted combination
    const confidence =
      (factors.expertise * 0.30) +
      (factors.experience * 0.25) +
      (factors.dataQuality * 0.20) +
      ((1 - factors.complexity) * 0.15) +
      (factors.timeAvailable * 0.10);

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Helper: Get expertise score
   */
  getExpertiseScore(agent, domain) {
    // Placeholder - would lookup agent's domain expertise
    return agent.domainExpertise?.[domain] || 0.5;
  }

  /**
   * Helper: Get experience score
   */
  getExperienceScore(agent, taskType) {
    // Placeholder - would lookup agent's task type experience
    return agent.taskExperience?.[taskType] || 0.5;
  }

  /**
   * Helper: Assess data quality
   */
  assessDataQuality(context) {
    // Placeholder - would assess context completeness
    return context ? 0.7 : 0.3;
  }

  /**
   * Helper: Assess complexity
   */
  assessComplexity(decision) {
    // Placeholder - would analyze decision complexity
    return decision.complexity || 0.5;
  }

  /**
   * Helper: Assess time constraints
   */
  assessTimeConstraints(decision) {
    // Placeholder - would check available time
    return decision.timeAvailable ? 0.8 : 0.4;
  }

  /**
   * Check if agent should abstain
   */
  shouldAbstain(confidence, abstentionThreshold = 0.3) {
    return confidence < abstentionThreshold;
  }
}

/**
 * Vote Audit Trail - Immutable vote recording
 */
class VoteAuditTrail {
  constructor() {
    this.votes = [];
    this.votingSessions = new Map();
  }

  recordVote(sessionId, agentId, vote) {
    const record = {
      id: uuidv4(),
      sessionId,
      agentId,
      vote: vote.choice || vote.rankings || vote.allocation,
      confidence: vote.confidence,
      timestamp: Date.now(),
      signature: this.hashVote(agentId, vote, Date.now())
    };

    this.votes.push(record);

    if (!this.votingSessions.has(sessionId)) {
      this.votingSessions.set(sessionId, []);
    }
    this.votingSessions.get(sessionId).push(record);

    return record;
  }

  hashVote(agentId, vote, timestamp) {
    const voteData = JSON.stringify(vote.choice || vote.rankings || vote.allocation);
    const data = `${agentId}:${voteData}:${vote.confidence}:${timestamp}`;
    return Buffer.from(data).toString('base64');
  }

  getSessionResults(sessionId) {
    const votes = this.votingSessions.get(sessionId) || [];

    return {
      sessionId,
      totalVotes: votes.length,
      votes: votes.map(v => ({
        agentId: v.agentId,
        vote: v.vote,
        confidence: v.confidence,
        timestamp: v.timestamp
      })),
      verifiable: true,
      auditTrailHash: this.hashSession(votes)
    };
  }

  hashSession(votes) {
    if (!votes || votes.length === 0) {
      return Buffer.from('empty').toString('base64');
    }

    const data = votes
      .map(v => v.signature)
      .sort()
      .join('|');
    return Buffer.from(data).toString('base64');
  }

  verifyIntegrity(sessionId) {
    const session = this.votingSessions.get(sessionId);
    if (!session) return false;

    return session.every(record => {
      const vote = {
        choice: Array.isArray(record.vote) ? record.vote : [record.vote],
        confidence: record.confidence
      };
      const expectedHash = this.hashVote(
        record.agentId,
        vote,
        record.timestamp
      );
      return record.signature === expectedHash;
    });
  }
}

export default VotingSystem;
