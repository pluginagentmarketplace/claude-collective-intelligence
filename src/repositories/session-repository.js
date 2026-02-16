/**
 * Session Repository
 * Manages session data persistence and retrieval
 */

import BaseRepository from './base-repository.js';
import { REDIS_KEYS, TTL_CONFIG } from '../db/redis-connection.js';
import winston from 'winston';
import crypto from 'crypto';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'session-repository' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Session Repository Class
 */
class SessionRepository extends BaseRepository {
  constructor() {
    super('sessions', 'session');
    this.sessionTTL = TTL_CONFIG.SESSION;
  }

  /**
   * Generate session key
   */
  generateSessionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create new session
   */
  async createSession(userId, data = {}, ipAddress = null, userAgent = null) {
    try {
      const sessionKey = this.generateSessionKey();
      const expiresAt = new Date(Date.now() + this.sessionTTL * 1000);

      const session = await this.create({
        session_key: sessionKey,
        user_id: userId,
        data,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt
      });

      // Store in Redis for fast access
      const redisKey = REDIS_KEYS.SESSION.replace('{sessionId}', session.id);
      await this.redis.set(redisKey, session, this.sessionTTL);

      // Add to user's session index
      if (userId) {
        const indexKey = REDIS_KEYS.SESSION_INDEX.replace('{userId}', userId);
        await this.redis.zadd(indexKey, Date.now(), session.id);
      }

      logger.info('Session created', { sessionId: session.id, userId });

      return session;

    } catch (error) {
      logger.error('Error creating session', { userId, error });
      throw error;
    }
  }

  /**
   * Find session by key
   */
  async findByKey(sessionKey) {
    try {
      // Check Redis first
      const sessions = await this.redis.keys(REDIS_KEYS.SESSION.replace('{sessionId}', '*'));

      for (const key of sessions) {
        const session = await this.redis.get(key);
        if (session && session.session_key === sessionKey) {
          // Check if session is expired
          if (new Date(session.expires_at) > new Date()) {
            logger.debug('Session found in Redis cache', { sessionKey });
            return session;
          } else {
            // Clean up expired session
            await this.redis.delete(key);
          }
        }
      }

      // Fallback to database
      const session = await this.findOne({ session_key: sessionKey });

      if (session) {
        // Check expiration
        if (new Date(session.expires_at) > new Date()) {
          // Cache in Redis
          const redisKey = REDIS_KEYS.SESSION.replace('{sessionId}', session.id);
          const ttl = Math.floor((new Date(session.expires_at) - new Date()) / 1000);
          await this.redis.set(redisKey, session, ttl);

          return session;
        } else {
          // Session expired, delete it
          await this.delete(session.id);
          return null;
        }
      }

      return null;

    } catch (error) {
      logger.error('Error finding session by key', { sessionKey, error });
      throw error;
    }
  }

  /**
   * Get session with validation
   */
  async getSession(sessionId) {
    try {
      // Check Redis first
      const redisKey = REDIS_KEYS.SESSION.replace('{sessionId}', sessionId);
      let session = await this.redis.get(redisKey);

      if (!session) {
        // Fallback to database
        session = await this.findById(sessionId);

        if (session) {
          // Cache in Redis
          const ttl = Math.floor((new Date(session.expires_at) - new Date()) / 1000);
          if (ttl > 0) {
            await this.redis.set(redisKey, session, ttl);
          }
        }
      }

      if (session) {
        // Check expiration
        if (new Date(session.expires_at) > new Date()) {
          return session;
        } else {
          // Session expired, clean up
          await this.deleteSession(sessionId);
          return null;
        }
      }

      return null;

    } catch (error) {
      logger.error('Error getting session', { sessionId, error });
      throw error;
    }
  }

  /**
   * Update session data
   */
  async updateSessionData(sessionId, data, extendExpiry = false) {
    try {
      const updateData = { data };

      if (extendExpiry) {
        updateData.expires_at = new Date(Date.now() + this.sessionTTL * 1000);
      }

      const session = await this.update(sessionId, updateData);

      if (session) {
        // Update Redis
        const redisKey = REDIS_KEYS.SESSION.replace('{sessionId}', sessionId);
        const ttl = Math.floor((new Date(session.expires_at) - new Date()) / 1000);

        if (ttl > 0) {
          await this.redis.set(redisKey, session, ttl);
        }

        logger.debug('Session data updated', { sessionId, extendExpiry });
      }

      return session;

    } catch (error) {
      logger.error('Error updating session data', { sessionId, error });
      throw error;
    }
  }

  /**
   * Extend session expiry
   */
  async extendSession(sessionId, additionalSeconds = null) {
    try {
      const additionalTime = additionalSeconds || this.sessionTTL;
      const session = await this.getSession(sessionId);

      if (!session) {
        throw new Error(`Session ${sessionId} not found or expired`);
      }

      const newExpiresAt = new Date(Date.now() + additionalTime * 1000);

      const updatedSession = await this.update(sessionId, {
        expires_at: newExpiresAt
      });

      // Update Redis
      const redisKey = REDIS_KEYS.SESSION.replace('{sessionId}', sessionId);
      await this.redis.set(redisKey, updatedSession, additionalTime);

      logger.info('Session extended', { sessionId, newExpiresAt });

      return updatedSession;

    } catch (error) {
      logger.error('Error extending session', { sessionId, error });
      throw error;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId) {
    try {
      const session = await this.delete(sessionId);

      if (session) {
        // Remove from Redis
        const redisKey = REDIS_KEYS.SESSION.replace('{sessionId}', sessionId);
        await this.redis.delete(redisKey);

        // Remove from user's session index
        if (session.user_id) {
          const indexKey = REDIS_KEYS.SESSION_INDEX.replace('{userId}', session.user_id);
          await this.redis.zrem(indexKey, sessionId);
        }

        logger.info('Session deleted', { sessionId, userId: session.user_id });
      }

      return session;

    } catch (error) {
      logger.error('Error deleting session', { sessionId, error });
      throw error;
    }
  }

  /**
   * Find sessions by user
   */
  async findByUser(userId, includeExpired = false) {
    try {
      // Check Redis index first
      const indexKey = REDIS_KEYS.SESSION_INDEX.replace('{userId}', userId);
      const sessionIds = await this.redis.zrange(indexKey, 0, -1);

      const sessions = [];

      // Get sessions from Redis
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session && (includeExpired || new Date(session.expires_at) > new Date())) {
          sessions.push(session);
        }
      }

      // If no sessions in Redis, check database
      if (sessions.length === 0) {
        const dbSessions = await this.findAll({ user_id: userId });

        for (const session of dbSessions) {
          if (includeExpired || new Date(session.expires_at) > new Date()) {
            sessions.push(session);

            // Cache active sessions
            if (new Date(session.expires_at) > new Date()) {
              const redisKey = REDIS_KEYS.SESSION.replace('{sessionId}', session.id);
              const ttl = Math.floor((new Date(session.expires_at) - new Date()) / 1000);
              await this.redis.set(redisKey, session, ttl);
              await this.redis.zadd(indexKey, Date.now(), session.id);
            }
          }
        }
      }

      return sessions;

    } catch (error) {
      logger.error('Error finding sessions by user', { userId, error });
      throw error;
    }
  }

  /**
   * Delete all sessions for user
   */
  async deleteUserSessions(userId) {
    try {
      const sessions = await this.findByUser(userId, true);
      const deletedSessions = [];

      for (const session of sessions) {
        await this.deleteSession(session.id);
        deletedSessions.push(session.id);
      }

      logger.info('All user sessions deleted', { userId, count: deletedSessions.length });

      return deletedSessions;

    } catch (error) {
      logger.error('Error deleting user sessions', { userId, error });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const query = `
        DELETE FROM sessions
        WHERE expires_at < NOW()
        RETURNING id, user_id
      `;

      const result = await this.db.query(query);

      // Clean up Redis
      for (const row of result.rows) {
        const redisKey = REDIS_KEYS.SESSION.replace('{sessionId}', row.id);
        await this.redis.delete(redisKey);

        if (row.user_id) {
          const indexKey = REDIS_KEYS.SESSION_INDEX.replace('{userId}', row.user_id);
          await this.redis.zrem(indexKey, row.id);
        }
      }

      if (result.rows.length > 0) {
        logger.info(`Cleaned up ${result.rows.length} expired sessions`);
      }

      return result.rows.length;

    } catch (error) {
      logger.error('Error cleaning up expired sessions', { error });
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getStatistics() {
    try {
      const query = `
        SELECT
          COUNT(*) as total_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) FILTER (WHERE expires_at > NOW()) as active_sessions,
          COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_sessions,
          AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_duration_seconds,
          MAX(created_at) as latest_session_created
        FROM sessions
      `;

      const result = await this.db.query(query);

      const stats = result.rows[0];

      // Get current active sessions from Redis
      const redisKeys = await this.redis.keys(REDIS_KEYS.SESSION.replace('{sessionId}', '*'));
      stats.redis_cached_sessions = redisKeys.length;

      return {
        totalSessions: parseInt(stats.total_sessions),
        uniqueUsers: parseInt(stats.unique_users),
        activeSessions: parseInt(stats.active_sessions),
        expiredSessions: parseInt(stats.expired_sessions),
        avgDurationSeconds: parseFloat(stats.avg_duration_seconds) || 0,
        latestSessionCreated: stats.latest_session_created,
        redisCachedSessions: stats.redis_cached_sessions
      };

    } catch (error) {
      logger.error('Error getting session statistics', { error });
      throw error;
    }
  }

  /**
   * Get active session count by time range
   */
  async getActiveSessionsByTimeRange(hours = 24) {
    try {
      const query = `
        WITH time_slots AS (
          SELECT generate_series(
            DATE_TRUNC('hour', NOW() - INTERVAL '${hours} hours'),
            DATE_TRUNC('hour', NOW()),
            INTERVAL '1 hour'
          ) as hour
        )
        SELECT
          ts.hour,
          COUNT(DISTINCT s.id) as session_count
        FROM time_slots ts
        LEFT JOIN sessions s ON
          s.created_at <= ts.hour + INTERVAL '1 hour' AND
          s.expires_at > ts.hour
        GROUP BY ts.hour
        ORDER BY ts.hour
      `;

      const result = await this.db.query(query);

      return result.rows.map(row => ({
        hour: row.hour,
        count: parseInt(row.session_count)
      }));

    } catch (error) {
      logger.error('Error getting active sessions by time range', { hours, error });
      throw error;
    }
  }

  /**
   * Validate session access
   */
  async validateAccess(sessionId, ipAddress = null, userAgent = null) {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        return { valid: false, reason: 'Session not found or expired' };
      }

      // Check IP address if provided
      if (ipAddress && session.ip_address && session.ip_address !== ipAddress) {
        logger.warn('Session IP mismatch', { sessionId, expected: session.ip_address, actual: ipAddress });
        return { valid: false, reason: 'IP address mismatch' };
      }

      // Check user agent if provided
      if (userAgent && session.user_agent && session.user_agent !== userAgent) {
        logger.warn('Session user agent mismatch', { sessionId });
        return { valid: false, reason: 'User agent mismatch' };
      }

      // Update last accessed time
      await this.update(sessionId, { updated_at: new Date() });

      return { valid: true, session };

    } catch (error) {
      logger.error('Error validating session access', { sessionId, error });
      return { valid: false, reason: 'Validation error' };
    }
  }
}

// Export singleton instance
const sessionRepository = new SessionRepository();

export default sessionRepository;
export { SessionRepository };