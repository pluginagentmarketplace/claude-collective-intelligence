/**
 * Authentication Test Utilities
 * Helper functions and mocks for testing authentication components
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export class AuthTestUtils {
  constructor() {
    this.testSecret = crypto.randomBytes(32).toString('hex');
    this.testAgents = new Map();
    this.testTokens = new Map();
  }

  /**
   * Create a test agent with role
   */
  createTestAgent(role = 'worker', options = {}) {
    const agentId = options.agentId || `test-agent-${crypto.randomBytes(4).toString('hex')}`;

    const agent = {
      agentId,
      agentType: options.agentType || 'test',
      role,
      permissions: options.permissions || [],
      secret: options.secret || `secret_${agentId}`,
      metadata: {
        createdAt: Date.now(),
        ...options.metadata
      }
    };

    this.testAgents.set(agentId, agent);
    return agent;
  }

  /**
   * Generate test JWT token
   */
  generateTestToken(payload, options = {}) {
    const tokenId = crypto.randomBytes(16).toString('hex');

    const tokenPayload = {
      ...payload,
      jti: tokenId,
      iat: Math.floor(Date.now() / 1000)
    };

    const tokenOptions = {
      expiresIn: options.expiresIn || '1h',
      issuer: options.issuer || 'test-issuer',
      audience: options.audience || 'test-audience',
      algorithm: 'HS256'
    };

    const token = jwt.sign(tokenPayload, this.testSecret, tokenOptions);

    this.testTokens.set(tokenId, {
      token,
      payload: tokenPayload,
      options: tokenOptions,
      createdAt: Date.now()
    });

    return {
      token,
      tokenId,
      decoded: jwt.decode(token)
    };
  }

  /**
   * Create test session
   */
  createTestSession(agentId, role = 'worker') {
    const sessionId = crypto.randomBytes(16).toString('hex');

    const accessToken = this.generateTestToken({
      agentId,
      role,
      sessionId,
      type: 'access'
    }, {
      expiresIn: '15m'
    });

    const refreshToken = this.generateTestToken({
      agentId,
      role,
      sessionId,
      type: 'refresh'
    }, {
      expiresIn: '7d'
    });

    return {
      sessionId,
      agentId,
      role,
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      createdAt: Date.now()
    };
  }

  /**
   * Create test message with auth headers
   */
  createAuthenticatedMessage(content, authToken, options = {}) {
    const timestamp = options.timestamp || Date.now();
    const agentId = options.agentId || 'test-agent';

    // Create signature
    const messageToSign = {
      ...content,
      timestamp,
      agentId
    };

    const signature = this.signMessage(messageToSign);

    return {
      properties: {
        headers: {
          'x-auth-token': authToken,
          'x-agent-id': agentId,
          'x-signature': signature,
          'x-timestamp': timestamp,
          ...options.additionalHeaders
        }
      },
      content
    };
  }

  /**
   * Sign a message for testing
   */
  signMessage(message) {
    const canonical = JSON.stringify(message, Object.keys(message).sort());
    const hmac = crypto.createHmac('sha256', this.testSecret);
    hmac.update(canonical);
    return hmac.digest('hex');
  }

  /**
   * Create expired token
   */
  createExpiredToken(payload) {
    return this.generateTestToken(payload, {
      expiresIn: '-1h' // Already expired
    });
  }

  /**
   * Create malformed token
   */
  createMalformedToken() {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload';
  }

  /**
   * Mock RBAC manager
   */
  createMockRBACManager() {
    const roles = new Map();
    const permissions = new Map();

    return {
      assignRole: jest.fn((agentId, role) => {
        roles.set(agentId, role);
        return { agentId, role };
      }),

      getAgentRole: jest.fn((agentId) => {
        return roles.get(agentId) || 'observer';
      }),

      hasPermission: jest.fn((agentId, permission) => {
        const role = roles.get(agentId);
        // Simple mock logic
        if (role === 'admin') return true;
        if (role === 'worker' && permission.startsWith('task.')) return true;
        if (role === 'observer' && permission.endsWith('.view')) return true;
        return false;
      }),

      getEffectivePermissions: jest.fn((role) => {
        const rolePerms = {
          admin: ['*'],
          leader: ['task.*', 'brainstorm.*', 'monitor.view'],
          worker: ['task.receive', 'task.execute', 'result.submit'],
          observer: ['monitor.view', 'status.view']
        };
        return rolePerms[role] || [];
      })
    };
  }

  /**
   * Mock JWT handler
   */
  createMockJWTHandler() {
    return {
      generateAccessToken: jest.fn((payload) => {
        return this.generateTestToken({
          ...payload,
          type: 'access'
        }, {
          expiresIn: '15m'
        });
      }),

      generateRefreshToken: jest.fn((payload) => {
        return this.generateTestToken({
          ...payload,
          type: 'refresh'
        }, {
          expiresIn: '7d'
        });
      }),

      generateTokenPair: jest.fn((agentData) => {
        const access = this.generateTestToken({
          ...agentData,
          type: 'access'
        }, { expiresIn: '15m' });

        const refresh = this.generateTestToken({
          ...agentData,
          type: 'refresh'
        }, { expiresIn: '7d' });

        return { access, refresh };
      }),

      verifyAccessToken: jest.fn((token) => {
        try {
          const decoded = jwt.verify(token, this.testSecret);
          return { valid: true, decoded };
        } catch (error) {
          return { valid: false, error: error.message };
        }
      }),

      verifyRefreshToken: jest.fn((token) => {
        try {
          const decoded = jwt.verify(token, this.testSecret);
          return { valid: true, decoded };
        } catch (error) {
          return { valid: false, error: error.message };
        }
      }),

      revokeToken: jest.fn(),
      cleanupExpiredTokens: jest.fn(() => 0)
    };
  }

  /**
   * Mock authentication middleware
   */
  createMockAuthMiddleware() {
    return {
      authenticate: jest.fn(async (request) => {
        const token = request.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
          return { authenticated: false, error: 'No token' };
        }

        try {
          const decoded = jwt.verify(token, this.testSecret);
          return {
            authenticated: true,
            agentId: decoded.agentId,
            role: decoded.role,
            permissions: decoded.permissions
          };
        } catch {
          return { authenticated: false, error: 'Invalid token' };
        }
      }),

      authorize: jest.fn(async (authData, permission) => {
        if (!authData.authenticated) {
          return { authorized: false, error: 'Not authenticated' };
        }

        // Simple permission check
        const hasPermission = authData.role === 'admin' ||
                             authData.permissions?.includes(permission);

        return {
          authorized: hasPermission,
          error: hasPermission ? null : 'Permission denied'
        };
      }),

      applyRateLimit: jest.fn(() => ({
        allowed: true,
        remaining: 100,
        resetAt: Date.now() + 60000
      })),

      signMessage: jest.fn((message) => this.signMessage(message)),
      validateMessageSignature: jest.fn(() => true)
    };
  }

  /**
   * Create test RabbitMQ message
   */
  createTestRabbitMessage(content, options = {}) {
    return {
      content: Buffer.from(JSON.stringify(content)),
      fields: {
        deliveryTag: options.deliveryTag || 1,
        redelivered: options.redelivered || false,
        exchange: options.exchange || 'test-exchange',
        routingKey: options.routingKey || 'test.route'
      },
      properties: {
        contentType: 'application/json',
        headers: options.headers || {},
        deliveryMode: options.persistent ? 2 : 1,
        priority: options.priority || 0,
        timestamp: options.timestamp || Date.now()
      }
    };
  }

  /**
   * Simulate authentication flow
   */
  async simulateAuthFlow(agentId, role = 'worker') {
    // Create agent
    const agent = this.createTestAgent(role, { agentId });

    // Create session
    const session = this.createTestSession(agentId, role);

    // Create authenticated message
    const message = this.createAuthenticatedMessage(
      { action: 'test', data: 'test-data' },
      session.accessToken,
      { agentId }
    );

    return {
      agent,
      session,
      message
    };
  }

  /**
   * Test permission scenarios
   */
  getPermissionScenarios() {
    return [
      {
        name: 'Admin has all permissions',
        role: 'admin',
        permission: 'system.shutdown',
        expected: true
      },
      {
        name: 'Worker can execute tasks',
        role: 'worker',
        permission: 'task.execute',
        expected: true
      },
      {
        name: 'Worker cannot assign tasks',
        role: 'worker',
        permission: 'task.assign',
        expected: false
      },
      {
        name: 'Observer can only view',
        role: 'observer',
        permission: 'monitor.view',
        expected: true
      },
      {
        name: 'Observer cannot execute',
        role: 'observer',
        permission: 'task.execute',
        expected: false
      },
      {
        name: 'Leader can orchestrate',
        role: 'leader',
        permission: 'brainstorm.initiate',
        expected: true
      }
    ];
  }

  /**
   * Test token scenarios
   */
  getTokenScenarios() {
    return [
      {
        name: 'Valid access token',
        token: () => this.generateTestToken({ agentId: 'test', role: 'worker' }),
        expectedValid: true
      },
      {
        name: 'Expired token',
        token: () => this.createExpiredToken({ agentId: 'test' }),
        expectedValid: false
      },
      {
        name: 'Malformed token',
        token: () => ({ token: this.createMalformedToken() }),
        expectedValid: false
      },
      {
        name: 'Missing signature',
        token: () => ({ token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0' }),
        expectedValid: false
      }
    ];
  }

  /**
   * Clean up test data
   */
  cleanup() {
    this.testAgents.clear();
    this.testTokens.clear();
  }
}

// Export singleton for convenient testing
export default new AuthTestUtils();

/**
 * Jest test helpers
 */
export const authMatchers = {
  toBeAuthenticated: (received) => {
    const pass = received.authenticated === true;
    return {
      pass,
      message: () => pass
        ? `Expected not to be authenticated`
        : `Expected to be authenticated but got: ${received.error}`
    };
  },

  toBeAuthorized: (received) => {
    const pass = received.authorized === true;
    return {
      pass,
      message: () => pass
        ? `Expected not to be authorized`
        : `Expected to be authorized but got: ${received.error}`
    };
  },

  toHaveValidToken: (received) => {
    const pass = received.valid === true;
    return {
      pass,
      message: () => pass
        ? `Expected token to be invalid`
        : `Expected token to be valid but got: ${received.error}`
    };
  }
};

/**
 * Test data generators
 */
export const testDataGenerators = {
  /**
   * Generate random agent data
   */
  randomAgent: () => ({
    agentId: `agent-${crypto.randomBytes(8).toString('hex')}`,
    agentType: ['worker', 'collaborator', 'specialist'][Math.floor(Math.random() * 3)],
    role: ['admin', 'leader', 'worker', 'observer'][Math.floor(Math.random() * 4)],
    metadata: {
      createdAt: Date.now(),
      version: '1.0.0'
    }
  }),

  /**
   * Generate random task
   */
  randomTask: () => ({
    taskId: crypto.randomBytes(8).toString('hex'),
    title: `Task ${Date.now()}`,
    description: 'Test task description',
    priority: ['low', 'normal', 'high'][Math.floor(Math.random() * 3)],
    requiredPermission: 'task.execute'
  }),

  /**
   * Generate random message
   */
  randomMessage: () => ({
    id: crypto.randomBytes(8).toString('hex'),
    type: ['task', 'brainstorm', 'result'][Math.floor(Math.random() * 3)],
    payload: {
      data: 'test-data',
      timestamp: Date.now()
    }
  })
};

/**
 * Performance testing utilities
 */
export class AuthPerformanceTest {
  constructor() {
    this.results = [];
  }

  /**
   * Measure authentication performance
   */
  async measureAuth(authFunc, iterations = 1000) {
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      await authFunc();
    }

    const duration = Date.now() - start;
    const avgTime = duration / iterations;

    this.results.push({
      operation: 'authentication',
      iterations,
      totalTime: duration,
      averageTime: avgTime
    });

    return {
      totalTime: duration,
      averageTime: avgTime,
      operationsPerSecond: 1000 / avgTime
    };
  }

  /**
   * Measure token generation performance
   */
  async measureTokenGeneration(tokenFunc, iterations = 1000) {
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      tokenFunc();
    }

    const duration = Date.now() - start;
    const avgTime = duration / iterations;

    this.results.push({
      operation: 'token_generation',
      iterations,
      totalTime: duration,
      averageTime: avgTime
    });

    return {
      totalTime: duration,
      averageTime: avgTime,
      tokensPerSecond: 1000 / avgTime
    };
  }

  /**
   * Get performance report
   */
  getReport() {
    return {
      results: this.results,
      summary: {
        totalOperations: this.results.reduce((sum, r) => sum + r.iterations, 0),
        totalTime: this.results.reduce((sum, r) => sum + r.totalTime, 0),
        averageOperationTime: this.results.reduce((sum, r) => sum + r.averageTime, 0) / this.results.length
      }
    };
  }
}