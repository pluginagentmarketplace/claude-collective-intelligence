/**
 * Authentication Middleware
 * Handles request authentication, validation, and security checks
 */

import jwtHandler from './jwt-handler.js';
import rbacManager from './rbac-manager.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

class AuthMiddleware {
  constructor() {
    // Rate limiting configuration
    this.rateLimits = new Map();
    this.rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW || '60000'); // 1 minute
    this.rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '100');

    // Security configuration
    this.secretKey = process.env.MESSAGE_SECRET_KEY || crypto.randomBytes(32).toString('hex');
    this.saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');

    // Failed attempt tracking
    this.failedAttempts = new Map();
    this.maxFailedAttempts = parseInt(process.env.MAX_FAILED_ATTEMPTS || '5');
    this.lockoutDuration = parseInt(process.env.LOCKOUT_DURATION || '900000'); // 15 minutes

    // Message signature cache
    this.signatureCache = new Map();
    this.maxCacheSize = 1000;
  }

  /**
   * Authenticate request with JWT token
   * @param {Object} request - Request object with headers
   */
  async authenticate(request) {
    try {
      // Extract token from request
      const token = this.extractToken(request);

      if (!token) {
        return {
          authenticated: false,
          error: 'No authentication token provided'
        };
      }

      // Verify token
      const verification = jwtHandler.verifyAccessToken(token);

      if (!verification.valid) {
        // Track failed attempt
        this.trackFailedAttempt(request.agentId || 'unknown');

        return {
          authenticated: false,
          error: verification.error
        };
      }

      // Check if agent is locked out
      if (this.isLockedOut(verification.decoded.agentId)) {
        return {
          authenticated: false,
          error: 'Account temporarily locked due to failed attempts'
        };
      }

      // Reset failed attempts on successful authentication
      this.resetFailedAttempts(verification.decoded.agentId);

      return {
        authenticated: true,
        agentId: verification.decoded.agentId,
        role: verification.decoded.role,
        permissions: verification.decoded.permissions
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        authenticated: false,
        error: error.message
      };
    }
  }

  /**
   * Authorize request based on permissions
   * @param {Object} authData - Authentication data from authenticate()
   * @param {string} requiredPermission - Required permission
   * @param {Object} context - Additional context
   */
  async authorize(authData, requiredPermission, context = {}) {
    if (!authData.authenticated) {
      return {
        authorized: false,
        error: 'Not authenticated'
      };
    }

    const hasPermission = rbacManager.hasPermission(
      authData.agentId,
      requiredPermission,
      context
    );

    return {
      authorized: hasPermission,
      error: hasPermission ? null : `Permission denied: ${requiredPermission} required`
    };
  }

  /**
   * Validate message signature
   * @param {Object} message - Message to validate
   * @param {string} signature - Provided signature
   */
  validateMessageSignature(message, signature) {
    const calculatedSignature = this.signMessage(message);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature)
    );
  }

  /**
   * Sign a message
   * @param {Object} message - Message to sign
   */
  signMessage(message) {
    // Create canonical representation
    const canonical = this.canonicalizeMessage(message);

    // Generate signature
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(canonical);
    return hmac.digest('hex');
  }

  /**
   * Verify agent identity
   * @param {Object} request - Request with agent credentials
   */
  async verifyAgentIdentity(request) {
    const { agentId, agentSecret, signature } = request;

    // Check if agent exists and get stored secret hash
    const storedHash = await this.getAgentSecretHash(agentId);

    if (!storedHash) {
      return {
        verified: false,
        error: 'Unknown agent'
      };
    }

    // Verify secret if provided
    if (agentSecret) {
      const isValid = await bcrypt.compare(agentSecret, storedHash);
      if (!isValid) {
        this.trackFailedAttempt(agentId);
        return {
          verified: false,
          error: 'Invalid credentials'
        };
      }
    }

    // Verify signature if provided
    if (signature) {
      const messageToVerify = {
        agentId,
        timestamp: request.timestamp
      };

      if (!this.validateMessageSignature(messageToVerify, signature)) {
        return {
          verified: false,
          error: 'Invalid signature'
        };
      }
    }

    this.resetFailedAttempts(agentId);

    return {
      verified: true,
      agentId
    };
  }

  /**
   * Apply rate limiting
   * @param {string} identifier - Rate limit identifier (e.g., agentId)
   */
  applyRateLimit(identifier) {
    const now = Date.now();
    const key = `rate:${identifier}`;

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, {
        count: 0,
        resetAt: now + this.rateLimitWindow
      });
    }

    const limit = this.rateLimits.get(key);

    // Reset if window expired
    if (now >= limit.resetAt) {
      limit.count = 0;
      limit.resetAt = now + this.rateLimitWindow;
    }

    limit.count++;

    if (limit.count > this.rateLimitMax) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: limit.resetAt,
        retryAfter: Math.ceil((limit.resetAt - now) / 1000)
      };
    }

    return {
      allowed: true,
      remaining: this.rateLimitMax - limit.count,
      resetAt: limit.resetAt
    };
  }

  /**
   * Create authentication context for message processing
   * @param {Object} message - RabbitMQ message
   */
  async createAuthContext(message) {
    const headers = message.properties?.headers || {};

    // Extract authentication data
    const authToken = headers['x-auth-token'];
    const agentId = headers['x-agent-id'];
    const signature = headers['x-signature'];
    const timestamp = headers['x-timestamp'];

    // Validate timestamp (prevent replay attacks)
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age > 300000) { // 5 minutes
        return {
          valid: false,
          error: 'Request timestamp too old'
        };
      }
    }

    // Authenticate
    const authResult = await this.authenticate({
      headers: {
        authorization: `Bearer ${authToken}`
      },
      agentId
    });

    if (!authResult.authenticated) {
      return {
        valid: false,
        error: authResult.error
      };
    }

    // Verify signature if provided
    if (signature) {
      const isValidSignature = this.validateMessageSignature(
        {
          ...message.content,
          timestamp,
          agentId
        },
        signature
      );

      if (!isValidSignature) {
        return {
          valid: false,
          error: 'Invalid message signature'
        };
      }
    }

    return {
      valid: true,
      authData: authResult,
      timestamp: parseInt(timestamp),
      signature
    };
  }

  /**
   * Wrap message with authentication
   * @param {Object} message - Message to wrap
   * @param {Object} authData - Authentication data
   */
  wrapMessageWithAuth(message, authData) {
    const timestamp = Date.now();
    const signature = this.signMessage({
      ...message,
      timestamp,
      agentId: authData.agentId
    });

    return {
      ...message,
      _auth: {
        agentId: authData.agentId,
        role: authData.role,
        timestamp,
        signature
      }
    };
  }

  /**
   * Extract token from request
   * @param {Object} request - Request object
   */
  extractToken(request) {
    const authHeader = request.headers?.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check for token in other locations
    return request.headers?.['x-auth-token'] ||
           request.query?.token ||
           request.body?.token;
  }

  /**
   * Track failed authentication attempt
   * @param {string} agentId - Agent identifier
   */
  trackFailedAttempt(agentId) {
    if (!this.failedAttempts.has(agentId)) {
      this.failedAttempts.set(agentId, {
        count: 0,
        firstAttempt: Date.now(),
        lastAttempt: Date.now()
      });
    }

    const attempts = this.failedAttempts.get(agentId);
    attempts.count++;
    attempts.lastAttempt = Date.now();

    // Clean old attempts
    if (Date.now() - attempts.firstAttempt > this.lockoutDuration) {
      attempts.count = 1;
      attempts.firstAttempt = Date.now();
    }
  }

  /**
   * Check if agent is locked out
   * @param {string} agentId - Agent identifier
   */
  isLockedOut(agentId) {
    const attempts = this.failedAttempts.get(agentId);

    if (!attempts) {
      return false;
    }

    if (attempts.count >= this.maxFailedAttempts) {
      const timeSinceLast = Date.now() - attempts.lastAttempt;
      return timeSinceLast < this.lockoutDuration;
    }

    return false;
  }

  /**
   * Reset failed attempts for agent
   * @param {string} agentId - Agent identifier
   */
  resetFailedAttempts(agentId) {
    this.failedAttempts.delete(agentId);
  }

  /**
   * Get agent secret hash (mock - in production use database)
   * @param {string} agentId - Agent identifier
   */
  async getAgentSecretHash(agentId) {
    // In production, fetch from database
    // For now, generate a mock hash
    const mockSecret = `secret_${agentId}`;
    return bcrypt.hash(mockSecret, this.saltRounds);
  }

  /**
   * Canonicalize message for signing
   * @param {Object} message - Message to canonicalize
   */
  canonicalizeMessage(message) {
    // Sort keys and stringify
    return JSON.stringify(message, Object.keys(message).sort());
  }

  /**
   * Clean up expired data
   */
  cleanup() {
    const now = Date.now();

    // Clean rate limits
    for (const [key, limit] of this.rateLimits.entries()) {
      if (now >= limit.resetAt) {
        this.rateLimits.delete(key);
      }
    }

    // Clean failed attempts
    for (const [agentId, attempts] of this.failedAttempts.entries()) {
      if (now - attempts.lastAttempt > this.lockoutDuration) {
        this.failedAttempts.delete(agentId);
      }
    }

    // Clean signature cache
    if (this.signatureCache.size > this.maxCacheSize) {
      const toDelete = this.signatureCache.size - this.maxCacheSize / 2;
      const keys = Array.from(this.signatureCache.keys()).slice(0, toDelete);
      keys.forEach(key => this.signatureCache.delete(key));
    }
  }

  /**
   * Get security statistics
   */
  getStats() {
    return {
      rateLimits: this.rateLimits.size,
      failedAttempts: this.failedAttempts.size,
      lockedOutAgents: Array.from(this.failedAttempts.entries())
        .filter(([agentId]) => this.isLockedOut(agentId))
        .map(([agentId]) => agentId),
      signatureCacheSize: this.signatureCache.size
    };
  }
}

// Export singleton instance
export default new AuthMiddleware();

// Also export class for testing
export { AuthMiddleware };