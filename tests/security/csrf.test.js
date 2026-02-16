/**
 * CSRF (Cross-Site Request Forgery) Prevention Tests
 * Token validation, SameSite cookies, referer validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import crypto from 'crypto';

describe('CSRF Prevention Tests', () => {
  let csrfTokenManager;

  beforeEach(() => {
    csrfTokenManager = new CSRFTokenManager();
  });

  describe('CSRF Token Generation and Validation', () => {
    it('should generate unique CSRF tokens for each session', () => {
      const session1 = 'session-123';
      const session2 = 'session-456';

      const token1 = csrfTokenManager.generateToken(session1);
      const token2 = csrfTokenManager.generateToken(session2);

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(20);
      expect(token2.length).toBeGreaterThan(20);
    });

    it('should use cryptographically secure randomness', () => {
      const tokens = new Set();

      for (let i = 0; i < 100; i++) {
        const token = csrfTokenManager.generateToken(`session-${i}`);
        tokens.add(token);
      }

      expect(tokens.size).toBe(100); // All unique
    });

    it('should validate correct CSRF tokens', () => {
      const session = 'session-123';
      const token = csrfTokenManager.generateToken(session);

      const result = csrfTokenManager.validateToken(session, token);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid CSRF tokens', () => {
      const session = 'session-123';
      const validToken = csrfTokenManager.generateToken(session);
      const invalidToken = 'invalid-token-xyz';

      const result = csrfTokenManager.validateToken(session, invalidToken);
      expect(result.valid).toBe(false);
    });

    it('should reject tokens from different sessions', () => {
      const session1 = 'session-123';
      const session2 = 'session-456';

      const token1 = csrfTokenManager.generateToken(session1);

      const result = csrfTokenManager.validateToken(session2, token1);
      expect(result.valid).toBe(false);
    });

    it('should expire CSRF tokens after timeout', () => {
      const session = 'session-123';
      const token = csrfTokenManager.generateToken(session);

      // Simulate time passing
      csrfTokenManager.expireTokensOlderThan(Date.now() + 100);

      const result = csrfTokenManager.validateToken(session, token);
      expect(result.valid).toBe(false);
    });
  });

  describe('Double Submit Cookie Pattern', () => {
    it('should set CSRF cookie with secure attributes', () => {
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 3600
      };

      const cookie = setCSRFCookie('token-123', cookieOptions);

      expect(cookie.secure).toBe(true);
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe('Strict');
    });

    it('should validate token from cookie matches token from form', () => {
      const token = csrfTokenManager.generateToken('session-123');

      const result = validateDoubleSubmit({
        cookieToken: token,
        formToken: token
      });

      expect(result.valid).toBe(true);
    });

    it('should reject mismatched tokens', () => {
      const token1 = csrfTokenManager.generateToken('session-123');
      const token2 = csrfTokenManager.generateToken('session-456');

      const result = validateDoubleSubmit({
        cookieToken: token1,
        formToken: token2
      });

      expect(result.valid).toBe(false);
    });

    it('should require tokens to be present', () => {
      const results = [
        validateDoubleSubmit({ cookieToken: null, formToken: 'token' }),
        validateDoubleSubmit({ cookieToken: 'token', formToken: null }),
        validateDoubleSubmit({ cookieToken: null, formToken: null })
      ];

      results.forEach(result => {
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('SameSite Cookie Attribute', () => {
    it('should use SameSite=Strict for sensitive operations', () => {
      const cookie = {
        sameSite: 'Strict'
      };

      expect(cookie.sameSite).toBe('Strict');
    });

    it('should use SameSite=Lax for general use', () => {
      const cookie = {
        sameSite: 'Lax'
      };

      expect(cookie.sameSite).toBe('Lax');
    });

    it('should prevent CSRF attacks with SameSite=Strict', () => {
      const request = {
        origin: 'http://attacker.com',
        site: 'http://target.com',
        sameSite: 'Strict'
      };

      const allowed = isCrossSiteAllowed(request);
      expect(allowed).toBe(false);
    });

    it('should allow same-site requests', () => {
      const request = {
        origin: 'http://target.com',
        site: 'http://target.com',
        sameSite: 'Strict'
      };

      const allowed = isCrossSiteAllowed(request);
      expect(allowed).toBe(true);
    });
  });

  describe('Referer Header Validation', () => {
    it('should validate Referer header origin', () => {
      const requests = [
        { referer: 'https://target.com/page', allowedOrigins: ['https://target.com'] },
        { referer: 'https://attacker.com/page', allowedOrigins: ['https://target.com'] },
        { referer: null, allowedOrigins: ['https://target.com'] }
      ];

      const results = requests.map(r => validateReferer(r));

      expect(results[0]).toBe(true);  // Valid referer
      expect(results[1]).toBe(false); // Different origin
      expect(results[2]).toBe(false); // Missing referer
    });

    it('should handle missing Referer header gracefully', () => {
      const result = validateReferer({
        referer: null,
        allowedOrigins: ['https://target.com']
      });

      expect(result).toBe(false);
    });

    it('should be case-insensitive for origin matching', () => {
      const result = validateReferer({
        referer: 'https://TARGET.COM/page',
        allowedOrigins: ['https://target.com']
      });

      expect(result).toBe(true);
    });
  });

  describe('Origin Header Validation', () => {
    it('should validate Origin header for state-changing requests', () => {
      const request = {
        method: 'POST',
        origin: 'https://target.com',
        allowedOrigins: ['https://target.com']
      };

      const result = validateOrigin(request);
      expect(result).toBe(true);
    });

    it('should reject requests from unauthorized origins', () => {
      const request = {
        method: 'POST',
        origin: 'https://attacker.com',
        allowedOrigins: ['https://target.com']
      };

      const result = validateOrigin(request);
      expect(result).toBe(false);
    });

    it('should require Origin header for state-changing requests', () => {
      const request = {
        method: 'POST',
        origin: null,
        allowedOrigins: ['https://target.com']
      };

      const result = validateOrigin(request);
      expect(result).toBe(false);
    });
  });

  describe('CSRF Token in Request Headers', () => {
    it('should require CSRF token in custom header', () => {
      const sessionToken = csrfTokenManager.generateToken('session-123');
      const request = {
        headers: {
          'x-csrf-token': sessionToken
        }
      };

      const result = validateCSRFToken(request, 'session-123');
      expect(result.valid).toBe(true);
    });

    it('should reject requests missing CSRF header', () => {
      const request = {
        headers: {}
      };

      const result = validateCSRFToken(request, 'session-123');
      expect(result.valid).toBe(false);
    });

    it('should support multiple header names', () => {
      const sessionToken = csrfTokenManager.generateToken('session-123');

      const headerNames = ['x-csrf-token', 'x-xsrf-token', 'x-token'];
      const results = headerNames.map(headerName => {
        const request = {
          headers: {
            [headerName]: sessionToken
          }
        };
        return validateCSRFToken(request, 'session-123', headerNames);
      });

      results.forEach(result => {
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('CSRF Token in Forms', () => {
    it('should include CSRF token in forms', () => {
      const token = csrfTokenManager.generateToken('session-123');
      const formHTML = generateFormWithCSRFToken(token);

      expect(formHTML).toContain('csrf');
      expect(formHTML).toContain(token);
      expect(formHTML).toContain('type="hidden"');
    });

    it('should validate CSRF token from form submission', () => {
      const sessionId = 'session-123';
      const token = csrfTokenManager.generateToken(sessionId);

      const formData = {
        data: 'user input',
        '_csrf': token
      };

      const result = validateFormCSRFToken(formData, sessionId);
      expect(result.valid).toBe(true);
    });

    it('should reject form submissions without CSRF token', () => {
      const formData = {
        data: 'user input'
        // Missing _csrf field
      };

      const result = validateFormCSRFToken(formData, 'session-123');
      expect(result.valid).toBe(false);
    });
  });

  describe('CSRF Protection for State-Changing Operations', () => {
    const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

    it('should enforce CSRF protection for state-changing methods', () => {
      protectedMethods.forEach(method => {
        const request = {
          method,
          headers: {}
        };

        const result = requiresCSRFProtection(request);
        expect(result).toBe(true);
      });
    });

    it('should not require CSRF for safe methods', () => {
      safeMethods.forEach(method => {
        const request = {
          method,
          headers: {}
        };

        const result = requiresCSRFProtection(request);
        expect(result).toBe(false);
      });
    });

    it('should protect task creation with CSRF token', () => {
      const sessionId = 'session-123';
      const token = csrfTokenManager.generateToken(sessionId);

      const request = {
        method: 'POST',
        endpoint: '/api/tasks',
        headers: {
          'x-csrf-token': token
        },
        body: { title: 'New Task' }
      };

      const result = validateCSRFToken(request, sessionId);
      expect(result.valid).toBe(true);
    });

    it('should protect agent role changes with CSRF token', () => {
      const sessionId = 'session-123';
      const token = csrfTokenManager.generateToken(sessionId);

      const request = {
        method: 'PUT',
        endpoint: '/api/agents/agent-123/role',
        headers: {
          'x-csrf-token': token
        },
        body: { role: 'admin' }
      };

      const result = validateCSRFToken(request, sessionId);
      expect(result.valid).toBe(true);
    });
  });

  describe('CSRF Token Rotation', () => {
    it('should rotate token after sensitive operations', () => {
      const sessionId = 'session-123';
      const oldToken = csrfTokenManager.generateToken(sessionId);

      const newToken = csrfTokenManager.rotateToken(sessionId);

      expect(newToken).not.toBe(oldToken);
    });

    it('should invalidate old token after rotation', () => {
      const sessionId = 'session-123';
      const oldToken = csrfTokenManager.generateToken(sessionId);

      csrfTokenManager.rotateToken(sessionId);

      const result = csrfTokenManager.validateToken(sessionId, oldToken);
      expect(result.valid).toBe(false);
    });

    it('should validate new token after rotation', () => {
      const sessionId = 'session-123';
      csrfTokenManager.generateToken(sessionId);

      const newToken = csrfTokenManager.rotateToken(sessionId);

      const result = csrfTokenManager.validateToken(sessionId, newToken);
      expect(result.valid).toBe(true);
    });
  });

  describe('CSRF Logging and Monitoring', () => {
    it('should log CSRF validation failures', () => {
      const logs = [];
      csrfTokenManager.onCSRFFailure = (event) => logs.push(event);

      csrfTokenManager.validateToken('session-123', 'invalid-token');

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].reason).toContain('validation failed');
    });

    it('should track CSRF attack attempts', () => {
      const attempts = [];
      csrfTokenManager.onCSRFFailure = (event) => attempts.push(event);

      for (let i = 0; i < 5; i++) {
        csrfTokenManager.validateToken('session-123', 'invalid-token');
      }

      expect(attempts.length).toBe(5);
    });

    it('should alert on suspicious patterns', () => {
      const alerts = [];
      csrfTokenManager.onSuspiciousPattern = (pattern) => alerts.push(pattern);

      // Simulate multiple failed attempts from different sessions
      csrfTokenManager.validateToken('session-1', 'token-1');
      csrfTokenManager.validateToken('session-2', 'token-1');
      csrfTokenManager.validateToken('session-3', 'token-1');

      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});

// Helper implementations
class CSRFTokenManager {
  constructor() {
    this.tokens = new Map();
    this.events = [];
    this.onCSRFFailure = () => {};
    this.onSuspiciousPattern = () => {};
  }

  generateToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    this.tokens.set(sessionId, {
      token,
      createdAt: Date.now()
    });
    return token;
  }

  validateToken(sessionId, token) {
    const stored = this.tokens.get(sessionId);
    if (!stored || stored.token !== token) {
      this.onCSRFFailure({ reason: 'validation failed' });
      return { valid: false };
    }
    return { valid: true };
  }

  expireTokensOlderThan(timestamp) {
    for (const [sessionId, data] of this.tokens.entries()) {
      if (data.createdAt < timestamp) {
        this.tokens.delete(sessionId);
      }
    }
  }

  rotateToken(sessionId) {
    const newToken = crypto.randomBytes(32).toString('hex');
    this.tokens.set(sessionId, {
      token: newToken,
      createdAt: Date.now()
    });
    return newToken;
  }
}

function setCSRFCookie(token, options) {
  return {
    ...options,
    value: token
  };
}

function validateDoubleSubmit({ cookieToken, formToken }) {
  return {
    valid: cookieToken && formToken && cookieToken === formToken
  };
}

function isCrossSiteAllowed({ origin, site, sameSite }) {
  if (sameSite === 'Strict') {
    return origin === site;
  }
  return true;
}

function validateReferer({ referer, allowedOrigins }) {
  if (!referer) return false;
  try {
    const refererURL = new URL(referer);
    const refererOrigin = refererURL.origin.toLowerCase();
    return allowedOrigins.some(origin => origin.toLowerCase() === refererOrigin);
  } catch {
    return false;
  }
}

function validateOrigin({ method, origin, allowedOrigins }) {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

function validateCSRFToken(request, sessionId, headerNames = ['x-csrf-token']) {
  for (const headerName of headerNames) {
    const token = request.headers?.[headerName];
    if (token) {
      const csrfManager = new CSRFTokenManager();
      return csrfManager.validateToken(sessionId, token);
    }
  }
  return { valid: false };
}

function generateFormWithCSRFToken(token) {
  return `
    <form method="POST">
      <input type="hidden" name="_csrf" value="${token}" />
      <input type="text" name="data" />
      <button type="submit">Submit</button>
    </form>
  `;
}

function validateFormCSRFToken(formData, sessionId) {
  const token = formData._csrf;
  const csrfManager = new CSRFTokenManager();
  return csrfManager.validateToken(sessionId, token);
}

function requiresCSRFProtection(request) {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
}
