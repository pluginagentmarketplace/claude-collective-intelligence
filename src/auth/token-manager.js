/**
 * Token Manager - Complete Token Lifecycle Management
 * Handles token creation, refresh, revocation, and monitoring
 */

import jwtHandler from './jwt-handler.js';
import rbacManager from './rbac-manager.js';
import crypto from 'crypto';
import { EventEmitter } from 'events';

class TokenManager extends EventEmitter {
  constructor() {
    super();

    // Token storage (in production, use Redis or database)
    this.tokenStore = new Map();
    this.refreshTokens = new Map();
    this.tokenMetadata = new Map();

    // Session management
    this.sessions = new Map();
    this.maxSessionsPerAgent = parseInt(process.env.MAX_SESSIONS_PER_AGENT || '5');

    // Token lifecycle configuration
    this.tokenRotationEnabled = process.env.TOKEN_ROTATION === 'true';
    this.tokenRotationInterval = parseInt(process.env.TOKEN_ROTATION_INTERVAL || '3600000'); // 1 hour
    this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT || '86400000'); // 24 hours

    // Security configurations
    this.requireMFA = process.env.REQUIRE_MFA === 'true';
    this.tokenBindingEnabled = process.env.TOKEN_BINDING === 'true';

    // Audit and monitoring
    this.tokenEvents = [];
    this.maxEventHistory = 1000;

    // Initialize cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Create new session for agent
   * @param {Object} agentData - Agent information
   * @param {Object} options - Session options
   */
  async createSession(agentData, options = {}) {
    try {
      // Validate agent role
      const role = rbacManager.getAgentRole(agentData.agentId);
      if (!role) {
        throw new Error('Agent role not found');
      }

      // Check existing sessions
      const existingSessions = this.getAgentSessions(agentData.agentId);
      if (existingSessions.length >= this.maxSessionsPerAgent) {
        // Revoke oldest session
        const oldestSession = existingSessions.sort((a, b) =>
          a.createdAt - b.createdAt)[0];
        await this.revokeSession(oldestSession.sessionId);
      }

      // Create session ID
      const sessionId = crypto.randomBytes(32).toString('hex');

      // Get effective permissions
      const permissions = rbacManager.getEffectivePermissions(role);

      // Generate token pair
      const tokens = jwtHandler.generateTokenPair({
        agentId: agentData.agentId,
        agentType: agentData.agentType,
        role,
        permissions,
        sessionId
      });

      // Create session record
      const session = {
        sessionId,
        agentId: agentData.agentId,
        role,
        accessToken: tokens.access.token,
        refreshToken: tokens.refresh.token,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        expiresAt: Date.now() + this.sessionTimeout,
        metadata: {
          userAgent: options.userAgent,
          ipAddress: options.ipAddress,
          deviceId: options.deviceId,
          mfaVerified: false
        }
      };

      // Store session
      this.sessions.set(sessionId, session);
      this.tokenStore.set(tokens.access.tokenId, {
        sessionId,
        type: 'access',
        agentId: agentData.agentId
      });
      this.refreshTokens.set(tokens.refresh.tokenId, {
        sessionId,
        type: 'refresh',
        agentId: agentData.agentId
      });

      // Track event
      this.trackEvent({
        event: 'session_created',
        sessionId,
        agentId: agentData.agentId,
        role
      });

      // Emit event
      this.emit('session:created', session);

      return {
        sessionId,
        tokens,
        expiresAt: session.expiresAt
      };
    } catch (error) {
      this.trackEvent({
        event: 'session_creation_failed',
        agentId: agentData.agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Refresh session tokens
   * @param {string} refreshToken - Refresh token
   */
  async refreshSession(refreshToken) {
    try {
      // Verify refresh token
      const verification = jwtHandler.verifyRefreshToken(refreshToken);
      if (!verification.valid) {
        throw new Error('Invalid refresh token');
      }

      const { decoded } = verification;
      const sessionId = decoded.sessionId;

      // Get session
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Check session expiration
      if (Date.now() >= session.expiresAt) {
        await this.revokeSession(sessionId);
        throw new Error('Session expired');
      }

      // Refresh tokens
      const newTokens = await jwtHandler.refreshAccessToken(refreshToken);

      // Update session
      session.accessToken = newTokens.access.token;
      session.lastActivity = Date.now();

      if (newTokens.refresh) {
        // Token rotation occurred
        session.refreshToken = newTokens.refresh.token;

        // Update token store
        this.refreshTokens.delete(decoded.jti);
        this.refreshTokens.set(newTokens.refresh.tokenId, {
          sessionId,
          type: 'refresh',
          agentId: session.agentId
        });
      }

      // Update access token store
      this.tokenStore.set(newTokens.access.tokenId, {
        sessionId,
        type: 'access',
        agentId: session.agentId
      });

      // Track event
      this.trackEvent({
        event: 'session_refreshed',
        sessionId,
        agentId: session.agentId,
        rotated: !!newTokens.refresh
      });

      // Emit event
      this.emit('session:refreshed', session);

      return {
        sessionId,
        tokens: newTokens,
        expiresAt: session.expiresAt
      };
    } catch (error) {
      this.trackEvent({
        event: 'session_refresh_failed',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate session
   * @param {string} accessToken - Access token
   */
  async validateSession(accessToken) {
    try {
      // Verify token
      const verification = jwtHandler.verifyAccessToken(accessToken);
      if (!verification.valid) {
        return {
          valid: false,
          error: verification.error
        };
      }

      const { decoded } = verification;
      const sessionId = decoded.sessionId;

      // Get session
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          valid: false,
          error: 'Session not found'
        };
      }

      // Check session expiration
      if (Date.now() >= session.expiresAt) {
        await this.revokeSession(sessionId);
        return {
          valid: false,
          error: 'Session expired'
        };
      }

      // Update last activity
      session.lastActivity = Date.now();

      return {
        valid: true,
        session: {
          sessionId,
          agentId: session.agentId,
          role: session.role,
          permissions: decoded.permissions
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Revoke session
   * @param {string} sessionId - Session ID to revoke
   */
  async revokeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Revoke tokens
    for (const [tokenId, tokenData] of this.tokenStore.entries()) {
      if (tokenData.sessionId === sessionId) {
        jwtHandler.revokeToken(tokenId);
        this.tokenStore.delete(tokenId);
      }
    }

    for (const [tokenId, tokenData] of this.refreshTokens.entries()) {
      if (tokenData.sessionId === sessionId) {
        jwtHandler.revokeToken(tokenId);
        this.refreshTokens.delete(tokenId);
      }
    }

    // Remove session
    this.sessions.delete(sessionId);

    // Track event
    this.trackEvent({
      event: 'session_revoked',
      sessionId,
      agentId: session.agentId
    });

    // Emit event
    this.emit('session:revoked', session);

    return true;
  }

  /**
   * Revoke all sessions for agent
   * @param {string} agentId - Agent ID
   */
  async revokeAgentSessions(agentId) {
    const sessions = this.getAgentSessions(agentId);
    let revokedCount = 0;

    for (const session of sessions) {
      if (await this.revokeSession(session.sessionId)) {
        revokedCount++;
      }
    }

    // Track event
    this.trackEvent({
      event: 'agent_sessions_revoked',
      agentId,
      count: revokedCount
    });

    return revokedCount;
  }

  /**
   * Get agent sessions
   * @param {string} agentId - Agent ID
   */
  getAgentSessions(agentId) {
    const sessions = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.agentId === agentId) {
        sessions.push({
          sessionId,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          metadata: session.metadata
        });
      }
    }

    return sessions;
  }

  /**
   * Extend session
   * @param {string} sessionId - Session ID
   * @param {number} extension - Extension time in milliseconds
   */
  extendSession(sessionId, extension = 3600000) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.expiresAt = Math.min(
      session.expiresAt + extension,
      Date.now() + this.sessionTimeout
    );

    // Track event
    this.trackEvent({
      event: 'session_extended',
      sessionId,
      agentId: session.agentId,
      newExpiry: session.expiresAt
    });

    return true;
  }

  /**
   * Bind token to device/IP
   * @param {string} sessionId - Session ID
   * @param {Object} binding - Binding information
   */
  bindSession(sessionId, binding) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.metadata.binding = {
      deviceId: binding.deviceId,
      ipAddress: binding.ipAddress,
      fingerprint: binding.fingerprint,
      boundAt: Date.now()
    };

    // Track event
    this.trackEvent({
      event: 'session_bound',
      sessionId,
      agentId: session.agentId,
      binding
    });

    return true;
  }

  /**
   * Verify MFA for session
   * @param {string} sessionId - Session ID
   * @param {string} mfaCode - MFA code
   */
  async verifyMFA(sessionId, mfaCode) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // In production, verify MFA code with authenticator app
    // For now, simulate verification
    const isValid = mfaCode === '123456'; // Mock verification

    if (isValid) {
      session.metadata.mfaVerified = true;
      session.metadata.mfaVerifiedAt = Date.now();

      // Upgrade permissions if needed
      const upgradedTokens = jwtHandler.generateTokenPair({
        agentId: session.agentId,
        agentType: session.agentType,
        role: session.role,
        permissions: rbacManager.getEffectivePermissions(session.role),
        sessionId,
        mfaVerified: true
      });

      session.accessToken = upgradedTokens.access.token;
      session.refreshToken = upgradedTokens.refresh.token;

      // Track event
      this.trackEvent({
        event: 'mfa_verified',
        sessionId,
        agentId: session.agentId
      });

      return {
        verified: true,
        tokens: upgradedTokens
      };
    }

    // Track failed MFA
    this.trackEvent({
      event: 'mfa_failed',
      sessionId,
      agentId: session.agentId
    });

    return {
      verified: false
    };
  }

  /**
   * Clean up expired sessions and tokens
   */
  cleanup() {
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedTokens = 0;

    // Clean expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.revokeSession(sessionId);
        cleanedSessions++;
      }
    }

    // Clean JWT handler tokens
    cleanedTokens = jwtHandler.cleanupExpiredTokens();

    return {
      sessions: cleanedSessions,
      tokens: cleanedTokens
    };
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.cleanup();
      console.log(`Token cleanup: ${cleaned.sessions} sessions, ${cleaned.tokens} tokens`);
    }, 3600000); // 1 hour
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Track token event
   * @param {Object} event - Event data
   */
  trackEvent(event) {
    this.tokenEvents.push({
      ...event,
      timestamp: Date.now()
    });

    // Keep event history manageable
    if (this.tokenEvents.length > this.maxEventHistory) {
      this.tokenEvents = this.tokenEvents.slice(-this.maxEventHistory / 2);
    }
  }

  /**
   * Get token statistics
   */
  getStatistics() {
    const now = Date.now();
    const stats = {
      activeSessions: this.sessions.size,
      activeTokens: this.tokenStore.size,
      activeRefreshTokens: this.refreshTokens.size,
      expiredSessions: 0,
      agentStats: {}
    };

    // Count expired sessions and agent stats
    for (const [, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        stats.expiredSessions++;
      }

      if (!stats.agentStats[session.agentId]) {
        stats.agentStats[session.agentId] = {
          sessions: 0,
          mfaEnabled: 0
        };
      }

      stats.agentStats[session.agentId].sessions++;
      if (session.metadata.mfaVerified) {
        stats.agentStats[session.agentId].mfaEnabled++;
      }
    }

    // Add JWT handler stats
    stats.jwtStats = jwtHandler.getStats();

    return stats;
  }

  /**
   * Get recent token events
   * @param {number} limit - Number of events to return
   * @param {Object} filters - Event filters
   */
  getRecentEvents(limit = 100, filters = {}) {
    let events = [...this.tokenEvents];

    // Apply filters
    if (filters.agentId) {
      events = events.filter(e => e.agentId === filters.agentId);
    }

    if (filters.event) {
      events = events.filter(e => e.event === filters.event);
    }

    if (filters.sessionId) {
      events = events.filter(e => e.sessionId === filters.sessionId);
    }

    // Sort by timestamp descending and limit
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Export session data for backup
   */
  exportSessions() {
    const sessions = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      sessions.push({
        sessionId,
        agentId: session.agentId,
        role: session.role,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        metadata: session.metadata
      });
    }

    return {
      exportedAt: Date.now(),
      sessionCount: sessions.length,
      sessions
    };
  }
}

// Export singleton instance
export default new TokenManager();

// Also export class for testing
export { TokenManager };