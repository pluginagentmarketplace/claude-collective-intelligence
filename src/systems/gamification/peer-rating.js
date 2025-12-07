#!/usr/bin/env node
/**
 * Peer Rating System with RabbitMQ Integration
 *
 * Enables agents to rate each other's performance and builds trust relationships
 * Integrates with the EigenTrust reputation system via RabbitMQ messaging
 */

import { EventEmitter } from 'events';
import { RabbitMQClient } from '../rabbitmq-client.js';
import { ReputationSystem } from './reputation-system.js';

export class PeerRatingSystem extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      rabbitMQUrl: options.rabbitMQUrl || process.env.RABBITMQ_URL || 'amqp://localhost:5672',
      exchangeName: options.exchangeName || 'reputation.exchange',
      queueName: options.queueName || 'reputation.ratings',
      minRating: options.minRating || 0,
      maxRating: options.maxRating || 5,
      rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute
      maxRatingsPerWindow: options.maxRatingsPerWindow || 10,
      ...options
    };

    this.rabbitMQ = null;
    this.reputationSystem = options.reputationSystem || new ReputationSystem();

    // Rate limiting: Map<agentId, Array<timestamp>>
    this.rateLimitTracker = new Map();

    // Rating validation rules
    this.validationRules = options.validationRules || [
      this.validateRatingRange.bind(this),
      this.validateRateLimit.bind(this),
      this.validateNoSelfRating.bind(this)
    ];
  }

  /**
   * Initialize peer rating system and connect to RabbitMQ
   */
  async initialize() {
    console.log('🎯 Initializing Peer Rating System...');

    // Setup RabbitMQ connection
    this.rabbitMQ = new RabbitMQClient({
      url: this.options.rabbitMQUrl
    });

    await this.rabbitMQ.connect();

    // Setup exchange for reputation events
    await this.rabbitMQ.createExchange(
      this.options.exchangeName,
      'topic',
      { durable: true }
    );

    // Setup queue for rating messages
    await this.rabbitMQ.createQueue(this.options.queueName, {
      durable: true,
      arguments: {
        'x-message-ttl': 3600000 // 1 hour TTL
      }
    });

    // Bind queue to exchange with routing patterns
    await this.rabbitMQ.bindQueue(
      this.options.queueName,
      this.options.exchangeName,
      'rating.#'
    );

    // Start consuming rating messages
    await this.consumeRatings();

    console.log('✅ Peer Rating System initialized');

    this.emit('initialized', { timestamp: Date.now() });
  }

  /**
   * Submit a peer rating
   */
  async submitRating(fromAgentId, toAgentId, rating, context = {}) {
    try {
      // Validate rating
      const validation = await this.validateRating(fromAgentId, toAgentId, rating);

      if (!validation.valid) {
        this.emit('rating.rejected', {
          fromAgentId,
          toAgentId,
          rating,
          reason: validation.reason,
          timestamp: Date.now()
        });

        throw new Error(`Rating rejected: ${validation.reason}`);
      }

      // Create rating message
      const ratingMessage = {
        id: `rating-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'peer.rating',
        from: fromAgentId,
        to: toAgentId,
        rating,
        context: {
          taskId: context.taskId,
          category: context.category || 'general',
          comment: context.comment,
          timestamp: Date.now(),
          ...context
        },
        timestamp: Date.now()
      };

      // Publish to RabbitMQ
      await this.rabbitMQ.publish(
        this.options.exchangeName,
        `rating.submitted.${toAgentId}`,
        ratingMessage,
        { persistent: true }
      );

      // Update rate limiter
      this.updateRateLimiter(fromAgentId);

      // Apply rating immediately to reputation system
      this.reputationSystem.addPeerRating(fromAgentId, toAgentId, rating, context);

      this.emit('rating.submitted', ratingMessage);

      console.log(`⭐ Rating submitted: ${fromAgentId} → ${toAgentId}: ${rating}/5`);

      return ratingMessage;
    } catch (error) {
      console.error('❌ Error submitting rating:', error);
      this.emit('rating.error', { error, fromAgentId, toAgentId, timestamp: Date.now() });
      throw error;
    }
  }

  /**
   * Submit batch ratings (e.g., end of collaboration)
   */
  async submitBatchRatings(fromAgentId, ratings) {
    const results = [];

    for (const { toAgentId, rating, context } of ratings) {
      try {
        const result = await this.submitRating(fromAgentId, toAgentId, rating, context);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message, toAgentId });
      }
    }

    return results;
  }

  /**
   * Consume rating messages from RabbitMQ
   */
  async consumeRatings() {
    await this.rabbitMQ.consume(
      this.options.queueName,
      async (message) => {
        try {
          const rating = JSON.parse(message.content.toString());

          console.log(`📨 Received rating: ${rating.from} → ${rating.to}: ${rating.rating}/5`);

          // Process rating
          await this.processRating(rating);

          // Acknowledge message
          this.rabbitMQ.channel.ack(message);

          this.emit('rating.processed', rating);
        } catch (error) {
          console.error('❌ Error processing rating message:', error);
          // Reject and requeue on error
          this.rabbitMQ.channel.nack(message, false, true);
        }
      },
      { noAck: false }
    );
  }

  /**
   * Process a rating and trigger reputation updates
   */
  async processRating(rating) {
    // Update reputation system
    this.reputationSystem.addPeerRating(
      rating.from,
      rating.to,
      rating.rating,
      rating.context
    );

    // Publish reputation update event
    const updatedReputation = this.reputationSystem.getReputationSummary(rating.to);

    await this.rabbitMQ.publish(
      this.options.exchangeName,
      `reputation.updated.${rating.to}`,
      {
        type: 'reputation.updated',
        agentId: rating.to,
        reputation: updatedReputation,
        trigger: 'peer_rating',
        ratingId: rating.id,
        timestamp: Date.now()
      },
      { persistent: true }
    );

    // Check if reputation milestone reached
    await this.checkReputationMilestones(rating.to, updatedReputation);
  }

  /**
   * Validate a rating submission
   */
  async validateRating(fromAgentId, toAgentId, rating) {
    for (const rule of this.validationRules) {
      const result = rule(fromAgentId, toAgentId, rating);
      if (!result.valid) {
        return result;
      }
    }

    return { valid: true };
  }

  /**
   * Validation Rule: Rating must be within valid range
   */
  validateRatingRange(fromAgentId, toAgentId, rating) {
    if (rating < this.options.minRating || rating > this.options.maxRating) {
      return {
        valid: false,
        reason: `Rating must be between ${this.options.minRating} and ${this.options.maxRating}`
      };
    }
    return { valid: true };
  }

  /**
   * Validation Rule: Rate limiting
   */
  validateRateLimit(fromAgentId, toAgentId, rating) {
    const now = Date.now();
    const ratings = this.rateLimitTracker.get(fromAgentId) || [];

    // Remove old ratings outside window
    const recentRatings = ratings.filter(
      timestamp => now - timestamp < this.options.rateLimitWindow
    );

    if (recentRatings.length >= this.options.maxRatingsPerWindow) {
      return {
        valid: false,
        reason: 'Rate limit exceeded. Please wait before submitting more ratings.'
      };
    }

    return { valid: true };
  }

  /**
   * Validation Rule: No self-rating
   */
  validateNoSelfRating(fromAgentId, toAgentId, rating) {
    if (fromAgentId === toAgentId) {
      return {
        valid: false,
        reason: 'Cannot rate yourself'
      };
    }
    return { valid: true };
  }

  /**
   * Update rate limiter tracker
   */
  updateRateLimiter(agentId) {
    const now = Date.now();
    const ratings = this.rateLimitTracker.get(agentId) || [];

    // Add current timestamp
    ratings.push(now);

    // Clean up old timestamps
    const recentRatings = ratings.filter(
      timestamp => now - timestamp < this.options.rateLimitWindow
    );

    this.rateLimitTracker.set(agentId, recentRatings);
  }

  /**
   * Request rating from agent
   */
  async requestRating(fromAgentId, toAgentId, context = {}) {
    const requestMessage = {
      type: 'rating.request',
      from: fromAgentId,
      to: toAgentId,
      context,
      timestamp: Date.now()
    };

    await this.rabbitMQ.publish(
      this.options.exchangeName,
      `rating.request.${toAgentId}`,
      requestMessage,
      { persistent: true }
    );

    this.emit('rating.requested', requestMessage);

    console.log(`📧 Rating request sent: ${fromAgentId} → ${toAgentId}`);
  }

  /**
   * Get ratings for an agent
   */
  getRatings(agentId, options = {}) {
    const ratings = this.reputationSystem.peerRatings.get(agentId) || [];

    let filtered = ratings;

    // Filter by time period
    if (options.since) {
      filtered = filtered.filter(r => r.timestamp >= options.since);
    }

    // Filter by source agent
    if (options.fromAgent) {
      filtered = filtered.filter(r => r.from === options.fromAgent);
    }

    // Sort
    if (options.sort === 'recent') {
      filtered.sort((a, b) => b.timestamp - a.timestamp);
    } else if (options.sort === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    }

    // Limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get rating statistics for an agent
   */
  getRatingStats(agentId) {
    const ratings = this.reputationSystem.peerRatings.get(agentId) || [];

    if (ratings.length === 0) {
      return {
        count: 0,
        average: 0,
        distribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const { rating } of ratings) {
      const rounded = Math.round(rating);
      distribution[rounded] = (distribution[rounded] || 0) + 1;
      sum += rating;
    }

    return {
      count: ratings.length,
      average: sum / ratings.length,
      distribution,
      recent: ratings.slice(-10).map(r => r.rating)
    };
  }

  /**
   * Check and announce reputation milestones
   */
  async checkReputationMilestones(agentId, reputation) {
    const milestones = [
      { score: 200, level: 'Bronze', message: 'achieved Bronze reputation!' },
      { score: 400, level: 'Silver', message: 'achieved Silver reputation!' },
      { score: 600, level: 'Gold', message: 'achieved Gold reputation!' },
      { score: 800, level: 'Platinum', message: 'achieved Platinum reputation!' },
      { score: 950, level: 'Diamond', message: 'achieved Diamond reputation!' }
    ];

    for (const milestone of milestones) {
      if (reputation.reputationScore >= milestone.score) {
        // Check if this is a new milestone
        const previousScore = reputation.reputationScore - 10; // Approximate

        if (previousScore < milestone.score) {
          // New milestone reached!
          await this.rabbitMQ.publish(
            this.options.exchangeName,
            'reputation.milestone',
            {
              type: 'reputation.milestone',
              agentId,
              level: milestone.level,
              score: milestone.score,
              currentScore: reputation.reputationScore,
              message: milestone.message,
              timestamp: Date.now()
            },
            { persistent: true }
          );

          this.emit('milestone.reached', {
            agentId,
            level: milestone.level,
            score: milestone.score
          });

          console.log(`🏆 ${agentId} ${milestone.message}`);
        }
      }
    }
  }

  /**
   * Trigger EigenTrust recomputation and broadcast results
   */
  async recomputeEigenTrust() {
    console.log('🔄 Recomputing EigenTrust scores...');

    const trustScores = await this.reputationSystem.computeEigenTrust();

    // Broadcast EigenTrust update for each agent
    for (const [agentId, eigentrustScore] of trustScores) {
      const reputation = this.reputationSystem.getReputationSummary(agentId);

      await this.rabbitMQ.publish(
        this.options.exchangeName,
        `eigentrust.updated.${agentId}`,
        {
          type: 'eigentrust.updated',
          agentId,
          eigentrustScore,
          reputation,
          timestamp: Date.now()
        },
        { persistent: true }
      );
    }

    this.emit('eigentrust.recomputed', {
      agentCount: trustScores.size,
      timestamp: Date.now()
    });

    console.log(`✅ EigenTrust recomputed for ${trustScores.size} agents`);

    return trustScores;
  }

  /**
   * Schedule periodic EigenTrust recomputation
   */
  scheduleEigenTrustRecomputation(intervalMs = 300000) { // Default: 5 minutes
    setInterval(async () => {
      try {
        await this.recomputeEigenTrust();
      } catch (error) {
        console.error('❌ Error in scheduled EigenTrust recomputation:', error);
      }
    }, intervalMs);

    console.log(`⏰ Scheduled EigenTrust recomputation every ${intervalMs / 1000}s`);
  }

  /**
   * Get rating leaderboard
   */
  getRatingLeaderboard(limit = 10) {
    const allAgents = Array.from(this.reputationSystem.agentStats.keys());

    const leaderboard = allAgents.map(agentId => {
      const stats = this.getRatingStats(agentId);
      const reputation = this.reputationSystem.getReputationSummary(agentId);

      return {
        agentId,
        agentName: reputation?.agentName || agentId,
        averageRating: stats.average,
        ratingCount: stats.count,
        reputationScore: reputation?.reputationScore || 0,
        trustLevel: reputation?.trustLevel || 'unknown'
      };
    });

    // Sort by average rating (with minimum count threshold)
    leaderboard.sort((a, b) => {
      // Require at least 3 ratings to be on leaderboard
      const aValid = a.ratingCount >= 3;
      const bValid = b.ratingCount >= 3;

      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
      if (!aValid && !bValid) return 0;

      // Sort by average rating
      return b.averageRating - a.averageRating;
    });

    return leaderboard.slice(0, limit);
  }

  /**
   * Close connections
   */
  async close() {
    if (this.rabbitMQ) {
      await this.rabbitMQ.close();
    }
    console.log('👋 Peer Rating System closed');
  }
}

export default PeerRatingSystem;
