/**
 * JWT Handler - Token Generation and Verification
 * Handles JWT token creation, validation, and management
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class JWTHandler {
  constructor() {
    // Get secrets from environment or generate secure defaults
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || this.generateSecret();
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || this.generateSecret();
    this.issuer = process.env.JWT_ISSUER || 'rabbitmq-orchestrator';
    this.audience = process.env.JWT_AUDIENCE || 'agent-network';

    // Token expiration settings
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';

    // Token rotation settings
    this.rotationEnabled = process.env.JWT_ROTATION_ENABLED === 'true';
    this.rotationInterval = parseInt(process.env.JWT_ROTATION_INTERVAL || '86400000'); // 24 hours

    // Store active tokens (in production, use Redis or database)
    this.activeTokens = new Map();
    this.revokedTokens = new Set();

    // Initialize token rotation if enabled
    if (this.rotationEnabled) {
      this.startTokenRotation();
    }
  }

  /**
   * Generate a secure random secret
   */
  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate access token
   * @param {Object} payload - Token payload
   * @param {Object} options - Additional JWT options
   */
  generateAccessToken(payload, options = {}) {
    const tokenId = crypto.randomBytes(16).toString('hex');

    const tokenPayload = {
      ...payload,
      jti: tokenId,
      type: 'access'
    };

    const tokenOptions = {
      expiresIn: this.accessTokenExpiry,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256',
      ...options
    };

    const token = jwt.sign(tokenPayload, this.accessTokenSecret, tokenOptions);

    // Track active token
    this.activeTokens.set(tokenId, {
      token,
      type: 'access',
      agentId: payload.agentId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + this.parseExpiry(this.accessTokenExpiry)
    });

    return {
      token,
      tokenId,
      expiresIn: this.accessTokenExpiry,
      type: 'access'
    };
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload
   * @param {Object} options - Additional JWT options
   */
  generateRefreshToken(payload, options = {}) {
    const tokenId = crypto.randomBytes(16).toString('hex');

    const tokenPayload = {
      ...payload,
      jti: tokenId,
      type: 'refresh'
    };

    const tokenOptions = {
      expiresIn: this.refreshTokenExpiry,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256',
      ...options
    };

    const token = jwt.sign(tokenPayload, this.refreshTokenSecret, tokenOptions);

    // Track active token
    this.activeTokens.set(tokenId, {
      token,
      type: 'refresh',
      agentId: payload.agentId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + this.parseExpiry(this.refreshTokenExpiry)
    });

    return {
      token,
      tokenId,
      expiresIn: this.refreshTokenExpiry,
      type: 'refresh'
    };
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} agentData - Agent information
   */
  generateTokenPair(agentData) {
    const payload = {
      agentId: agentData.agentId,
      agentType: agentData.agentType,
      role: agentData.role,
      permissions: agentData.permissions || []
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      access: accessToken,
      refresh: refreshToken,
      issuedAt: new Date().toISOString()
    };
  }

  /**
   * Verify access token
   * @param {string} token - JWT token to verify
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      // Check if token is revoked
      if (this.revokedTokens.has(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Check if token is still active
      if (!this.activeTokens.has(decoded.jti)) {
        throw new Error('Token is not active');
      }

      return {
        valid: true,
        decoded,
        tokenId: decoded.jti
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - Refresh token to verify
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      // Check if token is revoked
      if (this.revokedTokens.has(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Check if token is still active
      if (!this.activeTokens.has(decoded.jti)) {
        throw new Error('Token is not active');
      }

      return {
        valid: true,
        decoded,
        tokenId: decoded.jti
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   */
  async refreshAccessToken(refreshToken) {
    const verification = this.verifyRefreshToken(refreshToken);

    if (!verification.valid) {
      throw new Error(`Invalid refresh token: ${verification.error}`);
    }

    const { decoded } = verification;

    // Generate new access token with same payload
    const newAccessToken = this.generateAccessToken({
      agentId: decoded.agentId,
      agentType: decoded.agentType,
      role: decoded.role,
      permissions: decoded.permissions
    });

    // Optionally rotate refresh token
    let newRefreshToken = null;
    if (this.rotationEnabled) {
      // Revoke old refresh token
      this.revokeToken(decoded.jti);

      // Generate new refresh token
      newRefreshToken = this.generateRefreshToken({
        agentId: decoded.agentId,
        agentType: decoded.agentType,
        role: decoded.role,
        permissions: decoded.permissions
      });
    }

    return {
      access: newAccessToken,
      refresh: newRefreshToken,
      rotated: !!newRefreshToken
    };
  }

  /**
   * Revoke a token
   * @param {string} tokenId - Token ID to revoke
   */
  revokeToken(tokenId) {
    this.revokedTokens.add(tokenId);
    this.activeTokens.delete(tokenId);
  }

  /**
   * Revoke all tokens for an agent
   * @param {string} agentId - Agent ID
   */
  revokeAgentTokens(agentId) {
    for (const [tokenId, tokenData] of this.activeTokens.entries()) {
      if (tokenData.agentId === agentId) {
        this.revokeToken(tokenId);
      }
    }
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let cleaned = 0;

    for (const [tokenId, tokenData] of this.activeTokens.entries()) {
      if (tokenData.expiresAt < now) {
        this.activeTokens.delete(tokenId);
        this.revokedTokens.delete(tokenId); // Also clean from revoked set
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Start token rotation interval
   */
  startTokenRotation() {
    this.rotationInterval = setInterval(() => {
      this.cleanupExpiredTokens();
      console.log('Token cleanup completed at', new Date().toISOString());
    }, this.rotationInterval);
  }

  /**
   * Stop token rotation
   */
  stopTokenRotation() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }
  }

  /**
   * Parse expiry string to milliseconds
   * @param {string} expiry - Expiry string (e.g., '15m', '1h', '7d')
   */
  parseExpiry(expiry) {
    const units = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${expiry}`);
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  /**
   * Get token statistics
   */
  getStats() {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;

    for (const [, tokenData] of this.activeTokens.entries()) {
      if (tokenData.expiresAt > now) {
        activeCount++;
      } else {
        expiredCount++;
      }
    }

    return {
      activeTokens: activeCount,
      expiredTokens: expiredCount,
      revokedTokens: this.revokedTokens.size,
      totalTracked: this.activeTokens.size
    };
  }

  /**
   * Decode token without verification (for debugging)
   * @param {string} token - JWT token
   */
  decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }
}

// Export singleton instance
export default new JWTHandler();

// Also export class for testing
export { JWTHandler };