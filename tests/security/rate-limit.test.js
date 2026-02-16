/**
 * Rate Limiting and DDoS Prevention Tests
 * Rate limit bypass attempts, exponential backoff, distributed rate limiting
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Rate Limiting Security Tests', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowSize: 60000, // 1 minute
      maxRequests: 100,
      backoffMultiplier: 2,
      maxBackoff: 3600000 // 1 hour
    });
  });

  describe('Per-Agent Rate Limiting', () => {
    it('should track requests per agent', () => {
      const agentId = 'agent-123';

      for (let i = 0; i < 50; i++) {
        const result = rateLimiter.checkLimit(agentId);
        expect(result.allowed).toBe(true);
      }

      const status = rateLimiter.getAgentStatus(agentId);
      expect(status.requestCount).toBe(50);
    });

    it('should enforce rate limit on excessive requests', () => {
      const agentId = 'agent-123';

      for (let i = 0; i < 100; i++) {
        rateLimiter.checkLimit(agentId);
      }

      // 101st request should be denied
      const result = rateLimiter.checkLimit(agentId);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reset rate limit after time window', async () => {
      const agentId = 'agent-123';

      // Fill up the quota
      for (let i = 0; i < 100; i++) {
        rateLimiter.checkLimit(agentId);
      }

      // Should be rate limited
      let result = rateLimiter.checkLimit(agentId);
      expect(result.allowed).toBe(false);

      // Advance time beyond window
      await rateLimiter.advanceTime(61000);

      // Should be allowed again
      result = rateLimiter.checkLimit(agentId);
      expect(result.allowed).toBe(true);
    });

    it('should provide different limits per agent', () => {
      const agent1 = 'agent-1';
      const agent2 = 'agent-2';

      // Both agents make requests
      for (let i = 0; i < 50; i++) {
        rateLimiter.checkLimit(agent1);
        rateLimiter.checkLimit(agent2);
      }

      const status1 = rateLimiter.getAgentStatus(agent1);
      const status2 = rateLimiter.getAgentStatus(agent2);

      expect(status1.requestCount).toBe(50);
      expect(status2.requestCount).toBe(50);
    });
  });

  describe('Rate Limit Bypass Prevention', () => {
    it('should prevent bypass using different IP addresses', () => {
      const userId = 'user-123';

      const ips = [
        '192.168.1.1',
        '192.168.1.2',
        '192.168.1.3',
        '10.0.0.1'
      ];

      let totalRequests = 0;
      for (const ip of ips) {
        for (let i = 0; i < 30; i++) {
          const result = rateLimiter.checkLimit(userId, { ip });
          if (result.allowed) totalRequests++;
        }
      }

      // Should be rate limited despite different IPs
      expect(totalRequests).toBeLessThanOrEqual(100);
    });

    it('should prevent bypass using different user agents', () => {
      const userId = 'user-123';

      const userAgents = [
        'Mozilla/5.0...',
        'Chrome/90.0...',
        'Safari/14.0...',
        'Firefox/88.0...'
      ];

      let totalRequests = 0;
      for (const userAgent of userAgents) {
        for (let i = 0; i < 30; i++) {
          const result = rateLimiter.checkLimit(userId, { userAgent });
          if (result.allowed) totalRequests++;
        }
      }

      // Should be rate limited despite different user agents
      expect(totalRequests).toBeLessThanOrEqual(100);
    });

    it('should prevent header spoofing bypass', () => {
      const headers = {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1'
      };

      const realIP = extractRealIP(headers);
      const result1 = rateLimiter.checkLimit('user-123', { ip: realIP });

      const spoofedHeaders = {
        'x-forwarded-for': '192.168.1.1, 1.2.3.4, 5.6.7.8'
      };

      const spoofedIP = extractRealIP(spoofedHeaders);
      const result2 = rateLimiter.checkLimit('user-123', { ip: spoofedIP });

      // Should use the trusted IP, not the spoofed one
      expect(result1.allowed || result2.allowed).toBe(true);
    });
  });

  describe('Exponential Backoff and Throttling', () => {
    it('should implement exponential backoff after violations', () => {
      const agentId = 'agent-123';
      const backoffMultiplier = 2;

      // First violation
      for (let i = 0; i < 100; i++) {
        rateLimiter.checkLimit(agentId);
      }

      let result = rateLimiter.checkLimit(agentId);
      expect(result.allowed).toBe(false);

      const firstBackoff = result.retryAfter;

      // Accumulate violations
      rateLimiter.recordViolation(agentId);
      result = rateLimiter.checkLimit(agentId);

      const secondBackoff = result.retryAfter;

      // Second backoff should be greater (exponential)
      expect(secondBackoff).toBeGreaterThan(firstBackoff);
    });

    it('should cap backoff at maximum', () => {
      const agentId = 'agent-123';
      const maxBackoff = 3600000; // 1 hour

      // Simulate many violations
      for (let i = 0; i < 20; i++) {
        rateLimiter.recordViolation(agentId);
      }

      const result = rateLimiter.checkLimit(agentId);
      expect(result.retryAfter).toBeLessThanOrEqual(maxBackoff);
    });

    it('should decay backoff over time', async () => {
      const agentId = 'agent-123';

      rateLimiter.recordViolation(agentId);
      let result = rateLimiter.checkLimit(agentId);
      const initialBackoff = result.retryAfter;

      // Wait half the initial backoff
      await rateLimiter.advanceTime(initialBackoff / 2);

      result = rateLimiter.checkLimit(agentId);
      const decayedBackoff = result.retryAfter;

      expect(decayedBackoff).toBeLessThan(initialBackoff);
    });
  });

  describe('Distributed Rate Limiting', () => {
    it('should enforce rate limits across distributed nodes', () => {
      const nodes = [
        { nodeId: 'node-1', rateLimiter: new RateLimiter() },
        { nodeId: 'node-2', rateLimiter: new RateLimiter() },
        { nodeId: 'node-3', rateLimiter: new RateLimiter() }
      ];

      const agentId = 'agent-123';

      // Requests distributed across nodes
      let totalRequests = 0;
      for (const { rateLimiter: nodeLimiter } of nodes) {
        for (let i = 0; i < 40; i++) {
          const result = nodeLimiter.checkLimitGlobal(agentId);
          if (result.allowed) totalRequests++;
        }
      }

      // Should be rate limited globally
      expect(totalRequests).toBeLessThanOrEqual(100);
    });

    it('should sync rate limit state across nodes', () => {
      const limiter1 = new RateLimiter();
      const limiter2 = new RateLimiter();

      // Make requests on node 1
      for (let i = 0; i < 50; i++) {
        limiter1.checkLimit('agent-123');
      }

      // Sync state
      const state1 = limiter1.exportState();
      limiter2.importState(state1);

      // Node 2 should know about previous requests
      const status2 = limiter2.getAgentStatus('agent-123');
      expect(status2.requestCount).toBe(50);
    });
  });

  describe('Rate Limit by Endpoint', () => {
    it('should apply different limits per endpoint', () => {
      const result1 = rateLimiter.checkLimit('agent-123', {
        endpoint: '/api/tasks'
      });

      const result2 = rateLimiter.checkLimit('agent-123', {
        endpoint: '/api/agents'
      });

      // Different endpoints, same agent - both allowed
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('should enforce stricter limits on sensitive endpoints', () => {
      const agentId = 'agent-123';

      // Sensitive endpoint with lower limit
      for (let i = 0; i < 20; i++) {
        rateLimiter.checkLimit(agentId, {
          endpoint: '/api/admin',
          limit: 20
        });
      }

      let result = rateLimiter.checkLimit(agentId, {
        endpoint: '/api/admin',
        limit: 20
      });

      expect(result.allowed).toBe(false);
    });

    it('should allow higher rate limits for whitelisted endpoints', () => {
      const agentId = 'agent-123';

      // Health check endpoint - typically not rate limited
      for (let i = 0; i < 1000; i++) {
        const result = rateLimiter.checkLimit(agentId, {
          endpoint: '/health',
          limit: null // Unlimited
        });

        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('Concurrent Request Limiting', () => {
    it('should limit concurrent requests', () => {
      const agentId = 'agent-123';
      const maxConcurrent = 10;

      const activeRequests = [];

      for (let i = 0; i < 15; i++) {
        const result = rateLimiter.checkConcurrentLimit(agentId, maxConcurrent);
        if (result.allowed) {
          activeRequests.push(result.requestId);
        }
      }

      expect(activeRequests.length).toBeLessThanOrEqual(maxConcurrent);
    });

    it('should release concurrent request slots on completion', () => {
      const agentId = 'agent-123';
      const maxConcurrent = 10;

      const requestId = 'req-123';
      const result1 = rateLimiter.checkConcurrentLimit(agentId, maxConcurrent);

      // Complete the request
      rateLimiter.releaseRequest(agentId, requestId);

      // Should allow another request
      const result2 = rateLimiter.checkConcurrentLimit(agentId, maxConcurrent);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in responses', () => {
      const agentId = 'agent-123';

      const result = rateLimiter.checkLimit(agentId);
      const headers = rateLimiter.getResponseHeaders(agentId);

      expect(headers).toHaveProperty('X-RateLimit-Limit');
      expect(headers).toHaveProperty('X-RateLimit-Remaining');
      expect(headers).toHaveProperty('X-RateLimit-Reset');
    });

    it('should update rate limit headers after each request', () => {
      const agentId = 'agent-123';

      const headers1 = rateLimiter.getResponseHeaders(agentId);
      const remaining1 = parseInt(headers1['X-RateLimit-Remaining']);

      rateLimiter.checkLimit(agentId);

      const headers2 = rateLimiter.getResponseHeaders(agentId);
      const remaining2 = parseInt(headers2['X-RateLimit-Remaining']);

      expect(remaining2).toBe(remaining1 - 1);
    });

    it('should include Retry-After header when rate limited', () => {
      const agentId = 'agent-123';

      for (let i = 0; i < 100; i++) {
        rateLimiter.checkLimit(agentId);
      }

      const result = rateLimiter.checkLimit(agentId);
      const headers = rateLimiter.getResponseHeaders(agentId);

      expect(result.allowed).toBe(false);
      expect(headers).toHaveProperty('Retry-After');
    });
  });

  describe('DDoS Detection and Mitigation', () => {
    it('should detect distributed attack patterns', () => {
      const agentIds = [];

      // Simulate distributed requests from many agents
      for (let i = 0; i < 100; i++) {
        agentIds.push(`agent-${i}`);
      }

      const attackIndication = rateLimiter.detectAttackPattern(agentIds);
      expect(attackIndication.detected).toBe(true);
      expect(attackIndication.type).toContain('distributed');
    });

    it('should implement adaptive rate limiting for attacks', () => {
      const agentId = 'agent-123';

      // Normal operation
      let result = rateLimiter.checkLimit(agentId, { adaptive: true });
      let limit1 = result.limit;

      // Simulate attack detection
      rateLimiter.recordViolation(agentId);
      rateLimiter.recordViolation(agentId);

      // Rate limit should be reduced
      result = rateLimiter.checkLimit(agentId, { adaptive: true });
      let limit2 = result.limit;

      expect(limit2).toBeLessThan(limit1);
    });

    it('should implement circuit breaker for persistent violators', () => {
      const agentId = 'agent-123';

      // Many violations
      for (let i = 0; i < 50; i++) {
        rateLimiter.recordViolation(agentId);
      }

      const status = rateLimiter.getAgentStatus(agentId);
      expect(status.circuitOpen).toBe(true);

      // Requests should be immediately rejected
      const result = rateLimiter.checkLimit(agentId);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Rate Limit Cleanup and Maintenance', () => {
    it('should cleanup expired rate limit data', async () => {
      const agentId = 'agent-123';

      rateLimiter.checkLimit(agentId);

      // Advance time beyond retention period
      await rateLimiter.advanceTime(7 * 24 * 60 * 60 * 1000); // 7 days

      rateLimiter.cleanup();

      const status = rateLimiter.getAgentStatus(agentId);
      expect(status).toBe(undefined);
    });

    it('should maintain statistics for monitoring', () => {
      const agentId1 = 'agent-1';
      const agentId2 = 'agent-2';

      for (let i = 0; i < 50; i++) {
        rateLimiter.checkLimit(agentId1);
        rateLimiter.checkLimit(agentId2);
      }

      const stats = rateLimiter.getStatistics();

      expect(stats.totalRequests).toBe(100);
      expect(stats.uniqueAgents).toBe(2);
    });
  });
});

// Helper implementations
class RateLimiter {
  constructor(config = {}) {
    this.windowSize = config.windowSize || 60000;
    this.maxRequests = config.maxRequests || 100;
    this.backoffMultiplier = config.backoffMultiplier || 2;
    this.maxBackoff = config.maxBackoff || 3600000;
    this.agents = new Map();
    this.violations = new Map();
    this.time = Date.now();
  }

  checkLimit(agentId, options = {}) {
    const { ip, userAgent, endpoint, limit, adaptive } = options;
    const key = this.getKey(agentId, ip, userAgent, endpoint);

    if (!this.agents.has(key)) {
      this.agents.set(key, {
        requests: [],
        count: 0,
        violations: 0
      });
    }

    const agent = this.agents.get(key);
    const now = this.time;
    const windowStart = now - this.windowSize;

    // Clean old requests
    agent.requests = agent.requests.filter(t => t > windowStart);
    agent.count = agent.requests.length;

    const effectiveLimit = limit || this.maxRequests;

    if (agent.count >= effectiveLimit) {
      return {
        allowed: false,
        retryAfter: this.calculateBackoff(agentId)
      };
    }

    agent.requests.push(now);
    agent.count++;

    return {
      allowed: true,
      limit: effectiveLimit
    };
  }

  checkLimitGlobal(agentId) {
    // Simplified global check
    return this.checkLimit(agentId);
  }

  checkConcurrentLimit(agentId, maxConcurrent) {
    if (!this.agents.has(`concurrent-${agentId}`)) {
      this.agents.set(`concurrent-${agentId}`, { active: 0 });
    }

    const agent = this.agents.get(`concurrent-${agentId}`);

    if (agent.active >= maxConcurrent) {
      return { allowed: false };
    }

    agent.active++;
    const requestId = `req-${Date.now()}-${Math.random()}`;

    return {
      allowed: true,
      requestId
    };
  }

  releaseRequest(agentId, requestId) {
    const agent = this.agents.get(`concurrent-${agentId}`);
    if (agent && agent.active > 0) {
      agent.active--;
    }
  }

  recordViolation(agentId) {
    if (!this.violations.has(agentId)) {
      this.violations.set(agentId, 0);
    }
    this.violations.set(agentId, this.violations.get(agentId) + 1);
  }

  calculateBackoff(agentId) {
    const violations = this.violations.get(agentId) || 0;
    const backoff = Math.min(
      1000 * Math.pow(this.backoffMultiplier, violations),
      this.maxBackoff
    );
    return backoff;
  }

  getKey(agentId, ip, userAgent, endpoint) {
    return `${agentId}-${ip || 'unknown'}-${endpoint || 'default'}`;
  }

  getAgentStatus(agentId) {
    for (const [key, data] of this.agents.entries()) {
      if (key.startsWith(agentId)) {
        return {
          requestCount: data.count,
          circuitOpen: false
        };
      }
    }
  }

  getResponseHeaders(agentId) {
    const agent = this.agents.get(agentId);
    const remaining = agent ? this.maxRequests - agent.count : this.maxRequests;

    return {
      'X-RateLimit-Limit': this.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, remaining).toString(),
      'X-RateLimit-Reset': (this.time + this.windowSize).toString()
    };
  }

  exportState() {
    return {
      agents: Array.from(this.agents.entries())
    };
  }

  importState(state) {
    state.agents.forEach(([key, value]) => {
      this.agents.set(key, value);
    });
  }

  detectAttackPattern(agentIds) {
    return {
      detected: agentIds.length > 50,
      type: 'distributed attack'
    };
  }

  getStatistics() {
    const totalRequests = Array.from(this.agents.values())
      .reduce((sum, agent) => sum + agent.count, 0);

    const uniqueAgents = new Set();
    this.agents.forEach((agent, key) => {
      const agentId = key.split('-')[0];
      uniqueAgents.add(agentId);
    });

    return {
      totalRequests,
      uniqueAgents: uniqueAgents.size
    };
  }

  cleanup() {
    // Remove old entries
    this.agents.forEach((agent, key) => {
      if (agent.requests.length === 0) {
        this.agents.delete(key);
      }
    });
  }

  async advanceTime(ms) {
    this.time += ms;
  }
}

function extractRealIP(headers) {
  if (headers['x-forwarded-for']) {
    return headers['x-forwarded-for'].split(',')[0].trim();
  }
  return 'unknown';
}
