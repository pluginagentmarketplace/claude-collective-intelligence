/**
 * Module-Specific Loggers
 * Pre-configured loggers for different system modules
 */

import { createChildLogger, logger, logPerformance, logError } from './winston-config.js';
import { getContext, addToContext } from './context-manager.js';
import crypto from 'crypto';

/**
 * Agent Module Logger
 */
class AgentLogger {
  constructor() {
    this.logger = createChildLogger('agent');
  }

  /**
   * Log agent initialization
   */
  logInit(agentId, config) {
    this.logger.info('Agent initialized', {
      agentId,
      type: config.type,
      capabilities: config.capabilities,
      status: 'ready',
      version: config.version || '1.0.0'
    });
  }

  /**
   * Log agent task execution
   */
  logTaskStart(agentId, taskId, taskType) {
    addToContext({ agentId, taskId });
    this.logger.info('Agent task started', {
      agentId,
      taskId,
      taskType,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log agent task completion
   */
  logTaskComplete(agentId, taskId, result, duration) {
    this.logger.info('Agent task completed', {
      agentId,
      taskId,
      result: result.success ? 'success' : 'failure',
      duration,
      output: result.output ? result.output.substring(0, 200) : null
    });

    // Log performance metrics
    if (duration > 5000) {
      this.logger.warn('Slow agent task detected', {
        agentId,
        taskId,
        duration,
        threshold: 5000
      });
    }
  }

  /**
   * Log agent communication
   */
  logCommunication(fromAgent, toAgent, messageType, content) {
    this.logger.debug('Agent communication', {
      from: fromAgent,
      to: toAgent,
      type: messageType,
      contentSize: content ? content.length : 0,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log agent state change
   */
  logStateChange(agentId, oldState, newState, reason) {
    this.logger.info('Agent state changed', {
      agentId,
      oldState,
      newState,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log agent error
   */
  logError(agentId, error, context) {
    this.logger.error('Agent error occurred', {
      agentId,
      error: error.message,
      stack: error.stack,
      code: error.code,
      context
    });
  }

  /**
   * Log agent metrics
   */
  logMetrics(agentId, metrics) {
    this.logger.info('Agent metrics', {
      agentId,
      tasksCompleted: metrics.tasksCompleted,
      successRate: metrics.successRate,
      avgResponseTime: metrics.avgResponseTime,
      uptime: metrics.uptime,
      memoryUsage: metrics.memoryUsage
    });
  }

  /**
   * Log agent health check
   */
  logHealthCheck(agentId, health) {
    const level = health.healthy ? 'info' : 'warn';
    this.logger[level]('Agent health check', {
      agentId,
      healthy: health.healthy,
      checks: health.checks,
      lastActivity: health.lastActivity
    });
  }
}

/**
 * RabbitMQ Module Logger
 */
class RabbitMQLogger {
  constructor() {
    this.logger = createChildLogger('rabbitmq');
  }

  /**
   * Log connection events
   */
  logConnection(status, url, options = {}) {
    const level = status === 'connected' ? 'info' : 'warn';
    this.logger[level](`RabbitMQ ${status}`, {
      url: url.replace(/:[^:]*@/, ':***@'), // Hide password
      vhost: options.vhost,
      heartbeat: options.heartbeat,
      prefetch: options.prefetch
    });
  }

  /**
   * Log channel events
   */
  logChannel(action, channelId, details = {}) {
    this.logger.debug(`Channel ${action}`, {
      channelId,
      ...details
    });
  }

  /**
   * Log message publishing
   */
  logPublish(exchange, routingKey, message, options = {}) {
    const context = getContext();
    this.logger.info('Message published', {
      exchange,
      routingKey,
      messageId: options.messageId,
      correlationId: options.correlationId || context.correlationId,
      contentType: options.contentType,
      size: Buffer.byteLength(JSON.stringify(message)),
      persistent: options.persistent,
      priority: options.priority
    });
  }

  /**
   * Log message consumption
   */
  logConsume(queue, message, processingTime) {
    this.logger.info('Message consumed', {
      queue,
      messageId: message.properties.messageId,
      correlationId: message.properties.correlationId,
      deliveryTag: message.fields.deliveryTag,
      redelivered: message.fields.redelivered,
      processingTime,
      contentSize: message.content.length
    });
  }

  /**
   * Log message acknowledgment
   */
  logAck(deliveryTag, multiple = false) {
    this.logger.debug('Message acknowledged', {
      deliveryTag,
      multiple
    });
  }

  /**
   * Log message rejection
   */
  logNack(deliveryTag, requeue = false, reason) {
    this.logger.warn('Message rejected', {
      deliveryTag,
      requeue,
      reason
    });
  }

  /**
   * Log queue metrics
   */
  logQueueMetrics(queue, metrics) {
    this.logger.info('Queue metrics', {
      queue,
      messages: metrics.messageCount,
      consumers: metrics.consumerCount,
      messagesReady: metrics.messagesReady,
      messagesUnacknowledged: metrics.messagesUnacknowledged
    });
  }

  /**
   * Log connection error
   */
  logConnectionError(error) {
    this.logger.error('RabbitMQ connection error', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  }

  /**
   * Log retry attempt
   */
  logRetry(attemptNumber, maxAttempts, delay) {
    this.logger.warn('RabbitMQ retry attempt', {
      attempt: attemptNumber,
      maxAttempts,
      delay,
      nextRetryIn: delay
    });
  }
}

/**
 * Voting Module Logger
 */
class VotingLogger {
  constructor() {
    this.logger = createChildLogger('voting');
  }

  /**
   * Log voting session start
   */
  logSessionStart(sessionId, topic, participants, options = {}) {
    this.logger.info('Voting session started', {
      sessionId,
      topic,
      participantCount: participants.length,
      participants: participants.map(p => p.id || p),
      votingType: options.type || 'consensus',
      quorum: options.quorum,
      timeout: options.timeout
    });
  }

  /**
   * Log vote cast
   */
  logVoteCast(sessionId, voterId, vote, weight = 1) {
    this.logger.debug('Vote cast', {
      sessionId,
      voterId,
      vote,
      weight,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log voting progress
   */
  logProgress(sessionId, votesReceived, totalExpected) {
    const percentage = (votesReceived / totalExpected) * 100;
    this.logger.info('Voting progress', {
      sessionId,
      votesReceived,
      totalExpected,
      percentage: percentage.toFixed(2),
      remaining: totalExpected - votesReceived
    });
  }

  /**
   * Log consensus reached
   */
  logConsensus(sessionId, result, stats) {
    this.logger.info('Consensus reached', {
      sessionId,
      result,
      totalVotes: stats.totalVotes,
      consensus: stats.consensusPercentage,
      distribution: stats.voteDistribution,
      duration: stats.duration
    });
  }

  /**
   * Log voting timeout
   */
  logTimeout(sessionId, votesReceived, totalExpected) {
    this.logger.warn('Voting session timeout', {
      sessionId,
      votesReceived,
      totalExpected,
      missingVotes: totalExpected - votesReceived
    });
  }

  /**
   * Log voting conflict
   */
  logConflict(sessionId, conflicts) {
    this.logger.warn('Voting conflict detected', {
      sessionId,
      conflictCount: conflicts.length,
      conflicts: conflicts
    });
  }

  /**
   * Log voting session completion
   */
  logSessionComplete(sessionId, outcome, stats) {
    this.logger.info('Voting session completed', {
      sessionId,
      outcome,
      duration: stats.duration,
      participationRate: stats.participationRate,
      consensusAchieved: stats.consensusAchieved
    });
  }
}

/**
 * Gamification Module Logger
 */
class GamificationLogger {
  constructor() {
    this.logger = createChildLogger('gamification');
  }

  /**
   * Log achievement unlocked
   */
  logAchievement(userId, achievement, context = {}) {
    this.logger.info('Achievement unlocked', {
      userId,
      achievementId: achievement.id,
      achievementName: achievement.name,
      points: achievement.points,
      rarity: achievement.rarity,
      ...context
    });
  }

  /**
   * Log points awarded
   */
  logPointsAwarded(userId, points, reason, multiplier = 1) {
    this.logger.info('Points awarded', {
      userId,
      points,
      actualPoints: points * multiplier,
      reason,
      multiplier,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log level up
   */
  logLevelUp(userId, oldLevel, newLevel, totalXP) {
    this.logger.info('User leveled up', {
      userId,
      oldLevel,
      newLevel,
      levelIncrease: newLevel - oldLevel,
      totalXP,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log leaderboard update
   */
  logLeaderboardUpdate(leaderboard, period = 'daily') {
    this.logger.info('Leaderboard updated', {
      period,
      topPlayers: leaderboard.slice(0, 10).map((p, i) => ({
        rank: i + 1,
        userId: p.userId,
        score: p.score
      })),
      totalPlayers: leaderboard.length
    });
  }

  /**
   * Log streak milestone
   */
  logStreak(userId, streakType, days) {
    this.logger.info('Streak milestone', {
      userId,
      streakType,
      days,
      milestone: this.getStreakMilestone(days)
    });
  }

  /**
   * Log badge earned
   */
  logBadgeEarned(userId, badge, criteria) {
    this.logger.info('Badge earned', {
      userId,
      badgeId: badge.id,
      badgeName: badge.name,
      tier: badge.tier,
      criteria,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log challenge progress
   */
  logChallengeProgress(userId, challengeId, progress, target) {
    const percentage = (progress / target) * 100;
    this.logger.debug('Challenge progress', {
      userId,
      challengeId,
      progress,
      target,
      percentage: percentage.toFixed(2),
      completed: progress >= target
    });
  }

  /**
   * Get streak milestone
   */
  getStreakMilestone(days) {
    if (days >= 365) return 'yearly';
    if (days >= 100) return 'century';
    if (days >= 30) return 'monthly';
    if (days >= 7) return 'weekly';
    return 'daily';
  }
}

/**
 * Performance Module Logger
 */
class PerformanceLogger {
  constructor() {
    this.logger = createChildLogger('performance');
    this.metrics = new Map();
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId) {
    this.metrics.set(operationId, {
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
      startCpu: process.cpuUsage()
    });
  }

  /**
   * End timing and log metrics
   */
  endTimer(operationId, metadata = {}) {
    const metrics = this.metrics.get(operationId);
    if (!metrics) {
      this.logger.warn('Timer not found', { operationId });
      return;
    }

    const duration = Date.now() - metrics.startTime;
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(metrics.startCpu);

    this.logger.info('Operation performance', {
      operationId,
      duration,
      memory: {
        rssDelta: endMemory.rss - metrics.startMemory.rss,
        heapDelta: endMemory.heapUsed - metrics.startMemory.heapUsed,
        external: endMemory.external
      },
      cpu: {
        user: endCpu.user / 1000,
        system: endCpu.system / 1000
      },
      ...metadata
    });

    this.metrics.delete(operationId);

    // Alert on slow operations
    if (duration > 1000) {
      this.logger.warn('Slow operation detected', {
        operationId,
        duration,
        threshold: 1000
      });
    }

    return duration;
  }

  /**
   * Log API response time
   */
  logApiResponseTime(endpoint, method, duration, statusCode) {
    const level = duration > 1000 ? 'warn' : 'info';
    this.logger[level]('API response time', {
      endpoint,
      method,
      duration,
      statusCode,
      slow: duration > 1000
    });
  }

  /**
   * Log database query performance
   */
  logQueryPerformance(query, duration, rowCount) {
    const level = duration > 100 ? 'warn' : 'debug';
    this.logger[level]('Database query performance', {
      query: query.substring(0, 200),
      duration,
      rowCount,
      rowsPerMs: rowCount / duration
    });
  }

  /**
   * Log cache performance
   */
  logCachePerformance(operation, key, hit, duration) {
    this.logger.debug('Cache performance', {
      operation,
      key,
      hit,
      duration,
      efficiency: hit ? 'hit' : 'miss'
    });
  }

  /**
   * Log batch processing performance
   */
  logBatchPerformance(batchId, itemCount, duration, errors = 0) {
    const itemsPerSecond = (itemCount / duration) * 1000;
    this.logger.info('Batch processing performance', {
      batchId,
      itemCount,
      duration,
      itemsPerSecond: itemsPerSecond.toFixed(2),
      errors,
      errorRate: ((errors / itemCount) * 100).toFixed(2)
    });
  }

  /**
   * Log system metrics
   */
  logSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.logger.info('System metrics', {
      memory: {
        rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
        external: (memUsage.external / 1024 / 1024).toFixed(2) + ' MB'
      },
      cpu: {
        user: (cpuUsage.user / 1000000).toFixed(2) + ' seconds',
        system: (cpuUsage.system / 1000000).toFixed(2) + ' seconds'
      },
      uptime: process.uptime(),
      pid: process.pid
    });
  }

  /**
   * Start system metrics interval logging
   */
  startMetricsInterval(intervalMs = 60000) {
    this.metricsInterval = setInterval(() => {
      this.logSystemMetrics();
    }, intervalMs);
  }

  /**
   * Stop system metrics interval logging
   */
  stopMetricsInterval() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}

/**
 * Create and export logger instances
 */
const agentLogger = new AgentLogger();
const rabbitMQLogger = new RabbitMQLogger();
const votingLogger = new VotingLogger();
const gamificationLogger = new GamificationLogger();
const performanceLogger = new PerformanceLogger();

// Export instances
export {
  agentLogger,
  rabbitMQLogger,
  votingLogger,
  gamificationLogger,
  performanceLogger
};

// Export direct access aliases
export const agent = agentLogger;
export const mq = rabbitMQLogger;
export const voting = votingLogger;
export const gamification = gamificationLogger;
export const performance = performanceLogger;

// Export convenience methods
export const logAgentInit = (...args) => agentLogger.logInit(...args);
export const logAgentTask = (...args) => agentLogger.logTaskStart(...args);
export const logAgentError = (...args) => agentLogger.logError(...args);

export const logMQPublish = (...args) => rabbitMQLogger.logPublish(...args);
export const logMQConsume = (...args) => rabbitMQLogger.logConsume(...args);
export const logMQConnection = (...args) => rabbitMQLogger.logConnection(...args);

export const logVoteStart = (...args) => votingLogger.logSessionStart(...args);
export const logVoteCast = (...args) => votingLogger.logVoteCast(...args);
export const logConsensus = (...args) => votingLogger.logConsensus(...args);

export const logAchievement = (...args) => gamificationLogger.logAchievement(...args);
export const logPoints = (...args) => gamificationLogger.logPointsAwarded(...args);
export const logLevelUp = (...args) => gamificationLogger.logLevelUp(...args);

export const startTimer = (...args) => performanceLogger.startTimer(...args);
export const endTimer = (...args) => performanceLogger.endTimer(...args);
export const logApiTime = (...args) => performanceLogger.logApiResponseTime(...args);

// Start/stop system metrics
export const startMetrics = (interval) => performanceLogger.startMetricsInterval(interval);
export const stopMetrics = () => performanceLogger.stopMetricsInterval();