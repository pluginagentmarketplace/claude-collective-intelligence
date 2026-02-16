/**
 * JWT Handler Test Suite
 * Tests for token generation, verification, and management
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JWTHandler } from '../../src/auth/jwt-handler.js';
import authTestUtils from './test-utils.js';

describe('JWT Handler', () => {
  let jwtHandler;

  beforeEach(() => {
    jwtHandler = new JWTHandler();
  });

  afterEach(() => {
    jwtHandler.stopTokenRotation();
    authTestUtils.cleanup();
  });

  describe('Token Generation', () => {
    it('should generate valid access token', () => {
      const agent = authTestUtils.createTestAgent('worker');
      const result = jwtHandler.generateAccessToken({
        agentId: agent.agentId,
        role: agent.role
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('tokenId');
      expect(result).toHaveProperty('expiresIn');
      expect(result.type).toBe('access');
    });

    it('should generate valid refresh token', () => {
      const agent = authTestUtils.createTestAgent('leader');
      const result = jwtHandler.generateRefreshToken({
        agentId: agent.agentId,
        role: agent.role
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('tokenId');
      expect(result.type).toBe('refresh');
    });

    it('should generate token pair', () => {
      const agent = authTestUtils.createTestAgent('admin');
      const result = jwtHandler.generateTokenPair({
        agentId: agent.agentId,
        agentType: agent.agentType,
        role: agent.role,
        permissions: ['system.*']
      });

      expect(result).toHaveProperty('access');
      expect(result).toHaveProperty('refresh');
      expect(result).toHaveProperty('issuedAt');
    });

    it('should include custom permissions in token', () => {
      const permissions = ['task.create', 'task.assign'];
      const result = jwtHandler.generateAccessToken({
        agentId: 'test-agent',
        role: 'custom',
        permissions
      });

      const decoded = jwtHandler.decodeToken(result.token);
      expect(decoded.payload.permissions).toEqual(permissions);
    });
  });

  describe('Token Verification', () => {
    it('should verify valid access token', () => {
      const agent = authTestUtils.createTestAgent();
      const tokenResult = jwtHandler.generateAccessToken({
        agentId: agent.agentId,
        role: agent.role
      });

      const verification = jwtHandler.verifyAccessToken(tokenResult.token);
      expect(verification.valid).toBe(true);
      expect(verification.decoded.agentId).toBe(agent.agentId);
    });

    it('should reject expired token', () => {
      // Create handler with very short expiry
      const shortHandler = new JWTHandler();
      shortHandler.accessTokenExpiry = '1ms';

      const tokenResult = shortHandler.generateAccessToken({
        agentId: 'test',
        role: 'worker'
      });

      // Wait for token to expire
      setTimeout(() => {
        const verification = shortHandler.verifyAccessToken(tokenResult.token);
        expect(verification.valid).toBe(false);
        expect(verification.error).toContain('expired');
      }, 10);
    });

    it('should reject malformed token', () => {
      const malformed = authTestUtils.createMalformedToken();
      const verification = jwtHandler.verifyAccessToken(malformed);

      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });

    it('should reject revoked token', () => {
      const tokenResult = jwtHandler.generateAccessToken({
        agentId: 'test',
        role: 'worker'
      });

      jwtHandler.revokeToken(tokenResult.tokenId);

      const verification = jwtHandler.verifyAccessToken(tokenResult.token);
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('revoked');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const agent = authTestUtils.createTestAgent();
      const tokens = jwtHandler.generateTokenPair({
        agentId: agent.agentId,
        role: agent.role
      });

      const newTokens = await jwtHandler.refreshAccessToken(tokens.refresh.token);

      expect(newTokens.access).toBeDefined();
      expect(newTokens.access.token).not.toBe(tokens.access.token);
    });

    it('should rotate refresh token when enabled', async () => {
      jwtHandler.rotationEnabled = true;

      const tokens = jwtHandler.generateTokenPair({
        agentId: 'test',
        role: 'worker'
      });

      const newTokens = await jwtHandler.refreshAccessToken(tokens.refresh.token);

      expect(newTokens.refresh).toBeDefined();
      expect(newTokens.rotated).toBe(true);
    });

    it('should reject invalid refresh token', async () => {
      const malformed = authTestUtils.createMalformedToken();

      await expect(
        jwtHandler.refreshAccessToken(malformed)
      ).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('Token Management', () => {
    it('should revoke all tokens for agent', () => {
      const agentId = 'test-agent';

      // Generate multiple tokens
      jwtHandler.generateAccessToken({ agentId, role: 'worker' });
      jwtHandler.generateAccessToken({ agentId, role: 'worker' });
      jwtHandler.generateRefreshToken({ agentId, role: 'worker' });

      jwtHandler.revokeAgentTokens(agentId);

      const stats = jwtHandler.getStats();
      expect(stats.revokedTokens).toBeGreaterThan(0);
    });

    it('should cleanup expired tokens', () => {
      // Create handler with short expiry
      const handler = new JWTHandler();
      handler.accessTokenExpiry = '1ms';

      // Generate tokens
      handler.generateAccessToken({ agentId: 'test1', role: 'worker' });
      handler.generateAccessToken({ agentId: 'test2', role: 'worker' });

      setTimeout(() => {
        const cleaned = handler.cleanupExpiredTokens();
        expect(cleaned).toBe(2);
      }, 10);
    });

    it('should track token statistics', () => {
      const handler = new JWTHandler();

      handler.generateAccessToken({ agentId: 'test1', role: 'worker' });
      handler.generateAccessToken({ agentId: 'test2', role: 'leader' });
      handler.generateRefreshToken({ agentId: 'test1', role: 'worker' });

      const stats = handler.getStats();

      expect(stats.activeTokens).toBe(2);
      expect(stats.totalTracked).toBe(3);
    });
  });

  describe('Security Features', () => {
    it('should use different secrets for access and refresh tokens', () => {
      expect(jwtHandler.accessTokenSecret).toBeDefined();
      expect(jwtHandler.refreshTokenSecret).toBeDefined();
      expect(jwtHandler.accessTokenSecret).not.toBe(jwtHandler.refreshTokenSecret);
    });

    it('should include required JWT claims', () => {
      const tokenResult = jwtHandler.generateAccessToken({
        agentId: 'test',
        role: 'worker'
      });

      const decoded = jwtHandler.decodeToken(tokenResult.token);

      expect(decoded.payload).toHaveProperty('iat');
      expect(decoded.payload).toHaveProperty('exp');
      expect(decoded.payload).toHaveProperty('iss');
      expect(decoded.payload).toHaveProperty('aud');
      expect(decoded.payload).toHaveProperty('jti');
    });

    it('should validate issuer and audience', () => {
      const tokenResult = jwtHandler.generateAccessToken({
        agentId: 'test',
        role: 'worker'
      });

      // Modify issuer
      jwtHandler.issuer = 'wrong-issuer';
      const verification = jwtHandler.verifyAccessToken(tokenResult.token);

      expect(verification.valid).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle high volume token generation', () => {
      const start = Date.now();
      const count = 100;

      for (let i = 0; i < count; i++) {
        jwtHandler.generateAccessToken({
          agentId: `agent-${i}`,
          role: 'worker'
        });
      }

      const duration = Date.now() - start;
      const avgTime = duration / count;

      expect(avgTime).toBeLessThan(10); // Less than 10ms per token
    });

    it('should efficiently verify tokens', () => {
      const tokens = [];

      // Generate tokens
      for (let i = 0; i < 100; i++) {
        const result = jwtHandler.generateAccessToken({
          agentId: `agent-${i}`,
          role: 'worker'
        });
        tokens.push(result.token);
      }

      const start = Date.now();

      // Verify all tokens
      tokens.forEach(token => {
        jwtHandler.verifyAccessToken(token);
      });

      const duration = Date.now() - start;
      const avgTime = duration / tokens.length;

      expect(avgTime).toBeLessThan(5); // Less than 5ms per verification
    });
  });
});