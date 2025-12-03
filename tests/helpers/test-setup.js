/**
 * E2E Test Setup Utilities
 * Provides database connection, RabbitMQ setup, and cleanup utilities
 */

import pkg from 'pg';
const { Pool } = pkg;
import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// CONFIGURATION
// ============================================

export const TEST_CONFIG = {
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5673'),
    username: process.env.RABBITMQ_USER || 'test_user',
    password: process.env.RABBITMQ_PASS || 'test_password',
    vhost: process.env.RABBITMQ_VHOST || 'test_vhost'
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5433'),
    user: process.env.POSTGRES_USER || 'test_user',
    password: process.env.POSTGRES_PASSWORD || 'test_password',
    database: process.env.POSTGRES_DB || 'ai_agents_test'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380')
  }
};

// ============================================
// DATABASE HELPERS
// ============================================

export class TestDatabase {
  constructor(config = TEST_CONFIG.postgres) {
    this.config = config;
    this.pool = null;
  }

  /**
   * Connect to the database
   */
  async connect() {
    this.pool = new Pool(this.config);

    try {
      const client = await this.pool.connect();
      console.log('✅ Connected to test database');
      client.release();
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.query(sql, params);
  }

  /**
   * Create an agent in the database
   */
  async createAgent(agentId, data = {}) {
    const query = `
      INSERT INTO agents (agent_id, name, tier, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      agentId,
      data.name || `Agent ${agentId}`,
      data.tier || 'bronze',
      data.status || 'active'
    ];

    const result = await this.query(query, values);

    // Also create points record
    await this.query(
      'INSERT INTO agent_points (agent_id) VALUES ($1) ON CONFLICT (agent_id) DO NOTHING',
      [agentId]
    );

    return result.rows[0];
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId) {
    const result = await this.query(
      'SELECT * FROM agents WHERE agent_id = $1',
      [agentId]
    );
    return result.rows[0];
  }

  /**
   * Update agent stats
   */
  async updateAgentStats(agentId, stats) {
    const fields = [];
    const values = [];
    let index = 1;

    Object.entries(stats).forEach(([key, value]) => {
      fields.push(`${key} = $${index}`);
      values.push(value);
      index++;
    });

    values.push(agentId);

    const query = `
      UPDATE agents
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE agent_id = $${index}
      RETURNING *
    `;

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Award points to agent
   */
  async awardPoints(agentId, category, points, context = {}) {
    const eventId = uuidv4();

    // Insert into history
    await this.query(
      `INSERT INTO points_history
       (event_id, agent_id, category, points, context, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [eventId, agentId, category, points, JSON.stringify(context)]
    );

    // Update points totals
    const updateField = category === 'total' ? 'total_points' : `${category}_points`;

    await this.query(
      `UPDATE agent_points
       SET ${updateField} = ${updateField} + $1,
           total_points = total_points + $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE agent_id = $3`,
      [category === 'total' ? 0 : points, points, agentId]
    );

    return eventId;
  }

  /**
   * Get agent points
   */
  async getAgentPoints(agentId) {
    const result = await this.query(
      'SELECT * FROM agent_points WHERE agent_id = $1',
      [agentId]
    );
    return result.rows[0];
  }

  /**
   * Get points history
   */
  async getPointsHistory(agentId, limit = 100) {
    const result = await this.query(
      `SELECT * FROM points_history
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [agentId, limit]
    );
    return result.rows;
  }

  /**
   * Create a voting session
   */
  async createVotingSession(sessionId, data) {
    const query = `
      INSERT INTO voting_sessions
      (session_id, topic, question, options, algorithm, initiated_by, deadline, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      sessionId,
      data.topic,
      data.question,
      JSON.stringify(data.options),
      data.algorithm || 'simple_majority',
      data.initiatedBy,
      data.deadline,
      'open'
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Cast a vote
   */
  async castVote(sessionId, agentId, voteData) {
    const voteId = uuidv4();

    const query = `
      INSERT INTO votes
      (vote_id, session_id, agent_id, option_selected, confidence, reasoning)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      voteId,
      sessionId,
      agentId,
      voteData.option,
      voteData.confidence || 1.0,
      voteData.reasoning || ''
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all votes for a session
   */
  async getSessionVotes(sessionId) {
    const result = await this.query(
      'SELECT * FROM votes WHERE session_id = $1 ORDER BY created_at',
      [sessionId]
    );
    return result.rows;
  }

  /**
   * Close voting session
   */
  async closeVotingSession(sessionId, results) {
    const query = `
      UPDATE voting_sessions
      SET status = 'closed',
          results = $1,
          winner = $2,
          closed_at = CURRENT_TIMESTAMP
      WHERE session_id = $3
      RETURNING *
    `;

    const values = [
      JSON.stringify(results),
      results.winner || null,
      sessionId
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Create a battle
   */
  async createBattle(battleId, data) {
    const query = `
      INSERT INTO battles
      (battle_id, mode, participants, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      battleId,
      data.mode,
      JSON.stringify(data.participants),
      'pending'
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Add battle participant
   */
  async addBattleParticipant(battleId, agentId, data = {}) {
    const agent = await this.getAgent(agentId);

    const query = `
      INSERT INTO battle_participants
      (battle_id, agent_id, team, elo_before)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      battleId,
      agentId,
      data.team || null,
      agent.elo_rating || 1000
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Update battle results
   */
  async updateBattleResults(battleId, winnerId, results) {
    const query = `
      UPDATE battles
      SET status = 'completed',
          winner_id = $1,
          results = $2,
          completed_at = CURRENT_TIMESTAMP
      WHERE battle_id = $3
      RETURNING *
    `;

    const values = [
      winnerId,
      JSON.stringify(results),
      battleId
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Update agent ELO rating
   */
  async updateEloRating(agentId, newElo, battleId) {
    const agent = await this.getAgent(agentId);
    const oldElo = agent.elo_rating;
    const change = newElo - oldElo;

    // Update agent
    await this.query(
      'UPDATE agents SET elo_rating = $1 WHERE agent_id = $2',
      [newElo, agentId]
    );

    // Update battle participant
    await this.query(
      `UPDATE battle_participants
       SET elo_after = $1, elo_change = $2
       WHERE battle_id = $3 AND agent_id = $4`,
      [newElo, change, battleId, agentId]
    );

    return { oldElo, newElo, change };
  }

  /**
   * Create mentorship
   */
  async createMentorship(mentorId, menteeId) {
    const mentorshipId = uuidv4();

    const query = `
      INSERT INTO mentorships
      (mentorship_id, mentor_id, mentee_id, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING *
    `;

    const result = await this.query(query, [mentorshipId, mentorId, menteeId]);
    return result.rows[0];
  }

  /**
   * Update mentorship progress
   */
  async updateMentorshipProgress(mentorshipId, progress) {
    const query = `
      UPDATE mentorships
      SET sessions_completed = $1,
          tasks_completed = $2,
          mentee_progress = $3
      WHERE mentorship_id = $4
      RETURNING *
    `;

    const values = [
      progress.sessions || 0,
      progress.tasks || 0,
      JSON.stringify(progress.details || {}),
      mentorshipId
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Graduate mentorship
   */
  async graduateMentorship(mentorshipId) {
    const query = `
      UPDATE mentorships
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          graduated_at = CURRENT_TIMESTAMP
      WHERE mentorship_id = $1
      RETURNING *
    `;

    const result = await this.query(query, [mentorshipId]);
    return result.rows[0];
  }

  /**
   * Create penalty
   */
  async createPenalty(agentId, penaltyData) {
    const penaltyId = uuidv4();

    const query = `
      INSERT INTO penalties
      (penalty_id, agent_id, violation_type, severity, points_deducted, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      penaltyId,
      agentId,
      penaltyData.violationType,
      penaltyData.severity,
      penaltyData.pointsDeducted || 0,
      penaltyData.description || ''
    ];

    const result = await this.query(query, values);
    return result.rows[0];
  }

  /**
   * Refresh leaderboard
   */
  async refreshLeaderboard() {
    await this.query('REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard');
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 10) {
    const result = await this.query(
      'SELECT * FROM leaderboard ORDER BY rank LIMIT $1',
      [limit]
    );
    return result.rows;
  }

  /**
   * Clean up all test data
   */
  async cleanup() {
    const tables = [
      'votes',
      'voting_sessions',
      'battle_participants',
      'battles',
      'brainstorm_ideas',
      'brainstorm_sessions',
      'mentorships',
      'penalties',
      'agent_achievements',
      'points_history',
      'agent_points',
      'agents'
    ];

    for (const table of tables) {
      await this.query(`TRUNCATE TABLE ${table} CASCADE`);
    }

    console.log('✅ Database cleaned up');
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('✅ Database connection closed');
    }
  }
}

// ============================================
// RABBITMQ HELPERS
// ============================================

export class TestRabbitMQ {
  constructor(config = TEST_CONFIG.rabbitmq) {
    this.config = config;
    this.connection = null;
    this.channel = null;
    this.messageHandlers = new Map();
  }

  /**
   * Connect to RabbitMQ
   */
  async connect() {
    const url = `amqp://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.vhost}`;

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      console.log('✅ Connected to RabbitMQ');
      return true;
    } catch (error) {
      console.error('❌ RabbitMQ connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Setup test exchanges and queues
   */
  async setupTestEnvironment() {
    const exchanges = [
      'agent.tasks',
      'agent.results',
      'gamification.points',
      'gamification.tiers',
      'agent.brainstorm',
      'agent.battles'
    ];

    for (const exchange of exchanges) {
      await this.channel.assertExchange(exchange, 'topic', { durable: false });
    }

    console.log('✅ Test exchanges created');
  }

  /**
   * Publish a message
   */
  async publish(exchange, routingKey, message) {
    const buffer = Buffer.from(JSON.stringify(message));
    return this.channel.publish(exchange, routingKey, buffer, { persistent: false });
  }

  /**
   * Consume messages from a queue
   */
  async consume(queueName, handler) {
    const queue = await this.channel.assertQueue(queueName, { durable: false, autoDelete: true });

    await this.channel.consume(queue.queue, (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        handler(content, msg);
        this.channel.ack(msg);
      }
    });

    return queue;
  }

  /**
   * Wait for a specific message
   */
  async waitForMessage(queueName, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message on ${queueName}`));
      }, timeout);

      this.consume(queueName, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }

  /**
   * Clean up test queues and exchanges
   */
  async cleanup() {
    if (this.channel) {
      // Delete test exchanges
      const exchanges = [
        'agent.tasks',
        'agent.results',
        'gamification.points',
        'gamification.tiers',
        'agent.brainstorm',
        'agent.battles'
      ];

      for (const exchange of exchanges) {
        try {
          await this.channel.deleteExchange(exchange);
        } catch (error) {
          // Ignore errors
        }
      }

      console.log('✅ RabbitMQ cleaned up');
    }
  }

  /**
   * Close the connection
   */
  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
      console.log('✅ RabbitMQ connection closed');
    }
  }
}

// ============================================
// TEST HELPERS
// ============================================

/**
 * Setup complete test environment
 */
export async function setupTestEnvironment() {
  const db = new TestDatabase();
  const mq = new TestRabbitMQ();

  await db.connect();
  await mq.connect();
  await mq.setupTestEnvironment();

  return { db, mq };
}

/**
 * Cleanup and teardown test environment
 */
export async function teardownTestEnvironment({ db, mq }) {
  await db.cleanup();
  await mq.cleanup();
  await db.close();
  await mq.close();
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Sleep helper
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  TEST_CONFIG,
  TestDatabase,
  TestRabbitMQ,
  setupTestEnvironment,
  teardownTestEnvironment,
  waitFor,
  sleep
};
