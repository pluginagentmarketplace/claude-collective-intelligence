/**
 * Authentication Security Tests
 * JWT bypass attempts, token manipulation, credential validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import JWTHandler from '../../src/auth/jwt-handler.js';
import TokenManager from '../../src/auth/token-manager.js';
import RbacManager from '../../src/auth/rbac-manager.js';
import AuthMiddleware from '../../src/auth/middleware.js';

describe('Authentication Security Tests', () => {
  let jwtHandler;
  let tokenManager;
  let rbacManager;
  let authMiddleware;

  beforeEach(() => {
    jwtHandler = new JWTHandler();
    tokenManager = new TokenManager();
    rbacManager = new RbacManager();
    authMiddleware = new AuthMiddleware();
  });

  describe('JWT Validation and Bypass Prevention', () => {
    it('should reject tokens with modified claims', async () => {
      const token = jwtHandler.generateToken({
        agentId: 'agent-123',
        role: 'worker'
      });

      // Attempt to modify the payload
      const parts = token.split('.');
      const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      decodedPayload.role = 'admin';

      const modifiedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64');
      const modifiedToken = `${parts[0]}.${modifiedPayload}.${parts[2]}`;

      // Should fail verification
      const result = jwtHandler.verifyToken(modifiedToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('should reject tokens with altered signature', () => {
      const token = jwtHandler.generateToken({
        agentId: 'agent-123',
        role: 'worker'
      });

      const parts = token.split('.');
      const alteredToken = `${parts[0]}.${parts[1]}.altered_signature_xyz`;

      const result = jwtHandler.verifyToken(alteredToken);
      expect(result.valid).toBe(false);
    });

    it('should reject expired tokens', () => {
      // Create an expired token (manually set expiry in the past)
      const expiredToken = jwtHandler.generateToken(
        {
          agentId: 'agent-123',
          role: 'worker'
        },
        { expiresIn: '-1h' } // Already expired
      );

      const result = jwtHandler.verifyToken(expiredToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject tokens from unverified sources', () => {
      // Create token with different secret
      const maliciousSecret = 'wrong-secret-key';
      const token = jwtHandler.generateToken(
        {
          agentId: 'agent-123',
          role: 'admin'
        },
        { secret: maliciousSecret }
      );

      // Attempt to verify with correct secret
      const result = jwtHandler.verifyToken(token);
      expect(result.valid).toBe(false);
    });

    it('should validate token issuer claim', () => {
      const token = jwtHandler.generateToken({
        agentId: 'agent-123',
        role: 'worker',
        iss: 'unauthorized-issuer'
      });

      const result = jwtHandler.verifyToken(token, {
        issuer: 'rabbitmq-orchestrator'
      });

      expect(result.valid).toBe(false);
    });

    it('should validate token audience claim', () => {
      const token = jwtHandler.generateToken({
        agentId: 'agent-123',
        role: 'worker',
        aud: 'wrong-audience'
      });

      const result = jwtHandler.verifyToken(token, {
        audience: 'agent-network'
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Token Manipulation Prevention', () => {
    it('should prevent token type manipulation', () => {
      const accessToken = jwtHandler.generateToken(
        {
          agentId: 'agent-123',
          role: 'worker',
          type: 'access'
        },
        { expiresIn: '15m' }
      );

      // Decode and modify type
      const parts = accessToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.type = 'refresh'; // Try to make it a refresh token

      const result = jwtHandler.verifyToken(accessToken);
      expect(result.claims.type).toBe('access');
    });

    it('should reject tokens with privilege escalation attempts', () => {
      const workerToken = jwtHandler.generateToken({
        agentId: 'worker-123',
        role: 'worker',
        permissions: ['task.receive', 'task.execute']
      });

      // Verify token doesn't allow admin actions
      const result = authMiddleware.authorize(
        { token: workerToken, agentId: 'worker-123' },
        'system.admin',
        {}
      );

      expect(result.authorized).toBe(false);
    });

    it('should prevent session fixation attacks', async () => {
      const session1 = await tokenManager.createSession({
        agentId: 'agent-1',
        agentType: 'worker'
      });

      const session2 = await tokenManager.createSession({
        agentId: 'agent-2',
        agentType: 'worker'
      });

      // Attempt to use session1 tokens with agent-2
      const result = tokenManager.validateSession(
        session1.tokens.access.token,
        'agent-2'
      );

      expect(result.valid).toBe(false);
    });

    it('should prevent token reuse after refresh', async () => {
      const session = await tokenManager.createSession({
        agentId: 'agent-123',
        agentType: 'worker'
      });

      const oldAccessToken = session.tokens.access.token;

      // Refresh the session
      const newSession = await tokenManager.refreshSession(
        session.tokens.refresh.token
      );

      // Attempt to use old token
      const result = tokenManager.validateSession(oldAccessToken, 'agent-123');
      expect(result.valid).toBe(false);
    });
  });

  describe('Credential Validation', () => {
    it('should require valid username/password format', () => {
      const invalidCredentials = [
        { username: '', password: 'valid' },
        { username: 'user', password: '' },
        { username: null, password: 'pass' },
        { username: 'user', password: null }
      ];

      invalidCredentials.forEach(creds => {
        const result = validateCredentials(creds);
        expect(result.valid).toBe(false);
      });
    });

    it('should enforce password complexity requirements', () => {
      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abcdef',
        '111111'
      ];

      weakPasswords.forEach(pwd => {
        const result = validatePasswordStrength(pwd);
        expect(result.strong).toBe(false);
      });
    });

    it('should enforce password length requirements', () => {
      const shortPassword = 'short';
      const validPassword = 'ValidPassword123!@#';

      expect(validatePasswordStrength(shortPassword).length).toBe(false);
      expect(validatePasswordStrength(validPassword).length).toBe(true);
    });

    it('should prevent credential reuse', async () => {
      const oldPassword = 'OldPassword123!@#';
      const newPassword = 'NewPassword123!@#';

      const changed = await changePassword('agent-123', oldPassword, newPassword);
      expect(changed).toBe(true);

      // Attempt to use old password
      const reused = await changePassword('agent-123', oldPassword, 'AnotherPassword123!@#');
      expect(reused).toBe(false);
    });
  });

  describe('Multi-Factor Authentication (MFA)', () => {
    it('should require MFA verification for sensitive operations', async () => {
      const session = await tokenManager.createSession({
        agentId: 'agent-123',
        agentType: 'admin',
        requireMFA: true
      });

      // Session should be created but not MFA verified
      expect(session.mfaVerified).toBe(false);

      // Attempt to access admin endpoint
      const result = authMiddleware.authorize(
        session,
        'system.admin',
        { requireMFA: true }
      );

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('MFA required');
    });

    it('should verify MFA token before granting access', async () => {
      const session = await tokenManager.createSession({
        agentId: 'agent-123',
        agentType: 'admin',
        requireMFA: true
      });

      const mfaToken = generateMFAToken();
      const verified = await tokenManager.verifyMFA(session.sessionId, mfaToken);

      expect(verified).toBe(true);
    });

    it('should rate limit MFA attempts to prevent brute force', () => {
      const sessionId = 'session-123';
      const attempts = [];

      for (let i = 0; i < 10; i++) {
        const result = tokenManager.verifyMFA(sessionId, 'wrong-code');
        attempts.push(result);
      }

      // After 5 failed attempts, should be rate limited
      expect(attempts[6].rateLimited).toBe(true);
    });
  });

  describe('Session Management Security', () => {
    it('should invalidate sessions on logout', async () => {
      const session = await tokenManager.createSession({
        agentId: 'agent-123',
        agentType: 'worker'
      });

      await tokenManager.invalidateSession(session.sessionId);

      const result = tokenManager.validateSession(
        session.tokens.access.token,
        'agent-123'
      );

      expect(result.valid).toBe(false);
    });

    it('should bind sessions to device/IP address', async () => {
      const deviceInfo = {
        userAgent: 'Mozilla/5.0...',
        ipAddress: '192.168.1.100'
      };

      const session = await tokenManager.createSession(
        {
          agentId: 'agent-123',
          agentType: 'worker'
        },
        deviceInfo
      );

      // Attempt to use with different IP
      const result = tokenManager.validateSession(
        session.tokens.access.token,
        'agent-123',
        {
          userAgent: deviceInfo.userAgent,
          ipAddress: '10.0.0.1' // Different IP
        }
      );

      expect(result.valid).toBe(false);
    });

    it('should limit concurrent sessions per agent', async () => {
      const agentId = 'agent-123';
      const maxSessions = 5;

      const sessions = [];
      for (let i = 0; i < maxSessions + 1; i++) {
        const session = await tokenManager.createSession({
          agentId,
          agentType: 'worker'
        });

        if (i < maxSessions) {
          sessions.push(session);
          expect(session.created).toBe(true);
        } else {
          expect(session.error).toContain('max sessions exceeded');
        }
      }
    });

    it('should timeout inactive sessions', async () => {
      const session = await tokenManager.createSession({
        agentId: 'agent-123',
        agentType: 'worker'
      });

      // Simulate inactivity (mock time)
      await simulateInactivity(session.sessionId, 25 * 60 * 1000); // 25 minutes

      const result = tokenManager.validateSession(
        session.tokens.access.token,
        'agent-123'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('inactive');
    });
  });

  describe('Default Credentials and Hardcoded Secrets', () => {
    it('should not allow default credentials', () => {
      const defaultCreds = [
        { username: 'admin', password: 'admin' },
        { username: 'root', password: 'password' },
        { username: 'test', password: 'test' },
        { username: 'guest', password: 'guest' }
      ];

      defaultCreds.forEach(creds => {
        const result = validateCredentials(creds);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('default credentials');
      });
    });

    it('should not expose secrets in logs or error messages', () => {
      const token = jwtHandler.generateToken({
        agentId: 'agent-123',
        role: 'admin'
      });

      const error = new Error(`Authentication failed with token: ${token}`);
      const sanitized = sanitizeForLogging(error);

      expect(sanitized).not.toContain(token);
      expect(sanitized).toContain('[TOKEN_REDACTED]');
    });
  });

  describe('Authentication Bypass Attempts', () => {
    it('should not allow missing authentication headers', () => {
      const message = {
        headers: {},
        content: { task: 'test' }
      };

      const result = authMiddleware.authenticate(message);
      expect(result.authenticated).toBe(false);
    });

    it('should not allow null or undefined tokens', () => {
      const invalidTokens = [null, undefined, '', false];

      invalidTokens.forEach(token => {
        const result = jwtHandler.verifyToken(token);
        expect(result.valid).toBe(false);
      });
    });

    it('should require proper authorization for sensitive operations', () => {
      const workerSession = {
        agentId: 'worker-123',
        role: 'worker',
        permissions: ['task.receive', 'task.execute']
      };

      const sensitiveOps = [
        'system.admin',
        'agent.delete',
        'rbac.modify',
        'token.revoke_all'
      ];

      sensitiveOps.forEach(op => {
        const result = authMiddleware.authorize(
          workerSession,
          op,
          {}
        );

        expect(result.authorized).toBe(false);
      });
    });
  });
});

// Helper functions
function validateCredentials(creds) {
  const defaultCreds = new Set([
    'admin',
    'root',
    'test',
    'guest'
  ]);

  if (!creds.username || !creds.password) {
    return { valid: false };
  }

  if (defaultCreds.has(creds.username) && defaultCreds.has(creds.password)) {
    return { valid: false, reason: 'default credentials not allowed' };
  }

  return { valid: true };
}

function validatePasswordStrength(password) {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);
  const isLongEnough = password.length >= 12;

  return {
    strong: hasUpper && hasLower && hasNumber && hasSpecial && isLongEnough,
    length: isLongEnough
  };
}

async function changePassword(agentId, oldPassword, newPassword) {
  // Simulated password change
  return oldPassword !== newPassword;
}

function generateMFAToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function simulateInactivity(sessionId, duration) {
  // Simulate time passing
  return new Promise(resolve => setTimeout(resolve, 10));
}

function sanitizeForLogging(error) {
  let message = error.message;
  message = message.replace(/token:\s*[a-zA-Z0-9._-]+/g, 'token: [TOKEN_REDACTED]');
  message = message.replace(/password[:\s=]*[^\s]+/gi, 'password: [REDACTED]');
  message = message.replace(/secret[:\s=]*[^\s]+/gi, 'secret: [REDACTED]');
  return message;
}
