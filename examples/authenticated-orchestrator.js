#!/usr/bin/env node
/**
 * Authenticated Orchestrator Example
 * Shows how to integrate authentication with the agent orchestrator
 */

import { RabbitMQClient } from '../scripts/rabbitmq-client.js';
import AgentOrchestrator from '../scripts/orchestrator.js';
import jwtHandler from '../src/auth/jwt-handler.js';
import rbacManager from '../src/auth/rbac-manager.js';
import authMiddleware from '../src/auth/middleware.js';
import tokenManager from '../src/auth/token-manager.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Authenticated Agent Orchestrator
 * Extends the base orchestrator with authentication capabilities
 */
class AuthenticatedOrchestrator extends AgentOrchestrator {
  constructor(agentType = 'worker') {
    super(agentType);
    this.session = null;
    this.authData = null;
  }

  /**
   * Initialize with authentication
   */
  async initialize() {
    console.log('🔐 Initializing authenticated orchestrator...');

    // Assign role to agent
    const role = this.getAgentRole();
    rbacManager.assignRole(this.agentId, role);
    console.log(`📋 Assigned role: ${role}`);

    // Create session and get tokens
    this.session = await tokenManager.createSession({
      agentId: this.agentId,
      agentType: this.agentType
    }, {
      userAgent: 'Orchestrator/1.0',
      ipAddress: process.env.AGENT_IP || '127.0.0.1'
    });

    console.log(`🎫 Session created: ${this.session.sessionId}`);
    console.log(`🔑 Access token obtained (expires in ${this.session.tokens.access.expiresIn})`);

    // Store auth data
    this.authData = {
      authenticated: true,
      agentId: this.agentId,
      role,
      permissions: rbacManager.getEffectivePermissions(role),
      accessToken: this.session.tokens.access.token,
      refreshToken: this.session.tokens.refresh.token
    };

    // Set up token refresh interval
    this.setupTokenRefresh();

    // Initialize base orchestrator
    await super.initialize();

    // Override client message handlers with authentication
    this.setupAuthenticatedHandlers();

    return this;
  }

  /**
   * Get agent role based on type
   */
  getAgentRole() {
    const roleMap = {
      'team-leader': 'leader',
      'leader': 'leader',
      'worker': 'worker',
      'collaborator': 'collaborator',
      'specialist': 'specialist',
      'observer': 'observer',
      'admin': 'admin'
    };

    return roleMap[this.agentType] || 'worker';
  }

  /**
   * Setup authenticated message handlers
   */
  setupAuthenticatedHandlers() {
    // Wrap publish methods with authentication
    const originalPublishTask = this.client.publishTask.bind(this.client);
    this.client.publishTask = async (task) => {
      const authenticatedTask = authMiddleware.wrapMessageWithAuth(
        task,
        this.authData
      );
      return originalPublishTask(authenticatedTask);
    };

    const originalPublishResult = this.client.publishResult.bind(this.client);
    this.client.publishResult = async (result) => {
      const authenticatedResult = authMiddleware.wrapMessageWithAuth(
        result,
        this.authData
      );
      return originalPublishResult(authenticatedResult);
    };

    const originalBroadcastBrainstorm = this.client.broadcastBrainstorm.bind(this.client);
    this.client.broadcastBrainstorm = async (message) => {
      const authenticatedMessage = authMiddleware.wrapMessageWithAuth(
        message,
        this.authData
      );
      return originalBroadcastBrainstorm(authenticatedMessage);
    };
  }

  /**
   * Handle incoming task with authentication
   */
  async handleTask(msg, { ack, nack, reject }) {
    try {
      // Validate message authentication
      const authContext = await authMiddleware.createAuthContext(msg);

      if (!authContext.valid) {
        console.error(`❌ Authentication failed: ${authContext.error}`);
        reject(); // Reject unauthenticated messages
        return;
      }

      // Check permission to execute task
      const authorized = await authMiddleware.authorize(
        authContext.authData,
        'task.execute',
        { resourceId: msg.id }
      );

      if (!authorized.authorized) {
        console.error(`🚫 Authorization failed: ${authorized.error}`);
        nack(false); // Don't requeue, agent lacks permission
        return;
      }

      // Apply rate limiting
      const rateLimit = authMiddleware.applyRateLimit(authContext.authData.agentId);
      if (!rateLimit.allowed) {
        console.warn(`⚠️ Rate limit exceeded. Retry after ${rateLimit.retryAfter}s`);
        nack(true); // Requeue for later
        return;
      }

      console.log(`✅ Authenticated task from ${authContext.authData.agentId}`);

      // Process task with base handler
      await super.handleTask(msg, { ack, nack, reject });
    } catch (error) {
      console.error(`❌ Task handling error: ${error.message}`);
      reject();
    }
  }

  /**
   * Handle brainstorm message with authentication
   */
  async handleBrainstormMessage(msg) {
    try {
      // Validate message authentication
      const authContext = await authMiddleware.createAuthContext(msg);

      if (!authContext.valid) {
        console.error(`❌ Brainstorm authentication failed: ${authContext.error}`);
        return;
      }

      // Check permission to participate
      const authorized = await authMiddleware.authorize(
        authContext.authData,
        'brainstorm.participate'
      );

      if (!authorized.authorized) {
        console.error(`🚫 Not authorized to participate in brainstorm`);
        return;
      }

      console.log(`✅ Authenticated brainstorm from ${authContext.authData.agentId}`);

      // Process with base handler
      await super.handleBrainstormMessage(msg);
    } catch (error) {
      console.error(`❌ Brainstorm handling error: ${error.message}`);
    }
  }

  /**
   * Assign task with permission check
   */
  async assignTask(task) {
    // Check permission to assign tasks
    const hasPermission = rbacManager.hasPermission(
      this.agentId,
      'task.assign'
    );

    if (!hasPermission) {
      throw new Error('Permission denied: task.assign required');
    }

    return super.assignTask(task);
  }

  /**
   * Initiate brainstorm with permission check
   */
  async initiateBrainstorm(session) {
    // Check permission to initiate brainstorms
    const hasPermission = rbacManager.hasPermission(
      this.agentId,
      'brainstorm.initiate'
    );

    if (!hasPermission) {
      throw new Error('Permission denied: brainstorm.initiate required');
    }

    return super.initiateBrainstorm(session);
  }

  /**
   * Setup automatic token refresh
   */
  setupTokenRefresh() {
    // Calculate refresh interval (refresh at 80% of token lifetime)
    const expiryMs = this.parseExpiry(this.session.tokens.access.expiresIn);
    const refreshInterval = expiryMs * 0.8;

    this.tokenRefreshInterval = setInterval(async () => {
      try {
        console.log('🔄 Refreshing access token...');

        const result = await tokenManager.refreshSession(
          this.session.tokens.refresh.token
        );

        // Update stored tokens
        this.session = result;
        this.authData.accessToken = result.tokens.access.token;

        if (result.tokens.refresh) {
          this.authData.refreshToken = result.tokens.refresh.token;
        }

        console.log('✅ Token refreshed successfully');
      } catch (error) {
        console.error('❌ Token refresh failed:', error.message);
        // Session expired, need to re-authenticate
        await this.reAuthenticate();
      }
    }, refreshInterval);
  }

  /**
   * Re-authenticate when session expires
   */
  async reAuthenticate() {
    console.log('🔐 Re-authenticating...');

    try {
      // Create new session
      this.session = await tokenManager.createSession({
        agentId: this.agentId,
        agentType: this.agentType
      });

      // Update auth data
      this.authData.accessToken = this.session.tokens.access.token;
      this.authData.refreshToken = this.session.tokens.refresh.token;

      console.log('✅ Re-authentication successful');
    } catch (error) {
      console.error('❌ Re-authentication failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Parse expiry string to milliseconds
   */
  parseExpiry(expiry) {
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900000; // Default 15 minutes

    return parseInt(match[1]) * units[match[2]];
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    return {
      session: {
        sessionId: this.session?.sessionId,
        createdAt: new Date(this.session?.createdAt).toISOString(),
        expiresAt: new Date(this.session?.expiresAt).toISOString()
      },
      role: this.authData?.role,
      permissions: this.authData?.permissions,
      tokenStats: jwtHandler.getStats(),
      rateLimitStats: authMiddleware.getStats()
    };
  }

  /**
   * Shutdown with session cleanup
   */
  async shutdown() {
    console.log('🔐 Cleaning up authentication...');

    // Clear refresh interval
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }

    // Revoke session
    if (this.session) {
      await tokenManager.revokeSession(this.session.sessionId);
    }

    // Base shutdown
    await super.shutdown();
  }
}

// Example usage with different roles
async function demonstrateAuthentication() {
  console.log('\n' + '='.repeat(60));
  console.log('AUTHENTICATED MULTI-AGENT ORCHESTRATION DEMONSTRATION');
  console.log('='.repeat(60) + '\n');

  const agents = [];

  try {
    // Create team leader
    console.log('Creating authenticated Team Leader...');
    const leader = new AuthenticatedOrchestrator('team-leader');
    await leader.initialize();
    await leader.startTeamLeader();
    agents.push(leader);

    // Create workers
    console.log('\nCreating authenticated Workers...');
    for (let i = 1; i <= 2; i++) {
      const worker = new AuthenticatedOrchestrator('worker');
      process.env.AGENT_ID = `worker-${i}`;
      await worker.initialize();
      await worker.startWorker();
      agents.push(worker);
    }

    // Create collaborator
    console.log('\nCreating authenticated Collaborator...');
    const collaborator = new AuthenticatedOrchestrator('collaborator');
    process.env.AGENT_ID = 'collaborator-1';
    await collaborator.initialize();
    await collaborator.startCollaborator();
    agents.push(collaborator);

    // Create observer (read-only)
    console.log('\nCreating authenticated Observer...');
    const observer = new AuthenticatedOrchestrator('observer');
    process.env.AGENT_ID = 'observer-1';
    await observer.initialize();
    agents.push(observer);

    console.log('\n' + '='.repeat(60));
    console.log('AUTHENTICATION STATUS');
    console.log('='.repeat(60));

    // Display authentication status
    for (const agent of agents) {
      const stats = agent.getSecurityStats();
      console.log(`\n${agent.agentName} (${agent.agentType}):`);
      console.log(`  Role: ${stats.role}`);
      console.log(`  Permissions: ${stats.permissions.slice(0, 3).join(', ')}...`);
      console.log(`  Session: ${stats.session.sessionId.substring(0, 8)}...`);
    }

    // Demonstrate permission-based operations
    console.log('\n' + '='.repeat(60));
    console.log('PERMISSION DEMONSTRATIONS');
    console.log('='.repeat(60));

    // Leader assigns task (should succeed)
    try {
      console.log('\n✅ Leader assigning task...');
      await leader.assignTask({
        title: 'Authenticated Task',
        description: 'Task with full authentication',
        priority: 'high',
        requiresCollaboration: true
      });
      console.log('   Task assigned successfully!');
    } catch (error) {
      console.error(`   Failed: ${error.message}`);
    }

    // Observer tries to assign task (should fail)
    try {
      console.log('\n❌ Observer attempting to assign task...');
      await observer.assignTask({
        title: 'Unauthorized Task',
        description: 'This should fail',
        priority: 'normal'
      });
    } catch (error) {
      console.log(`   Correctly denied: ${error.message}`);
    }

    // Display final statistics
    console.log('\n' + '='.repeat(60));
    console.log('SECURITY STATISTICS');
    console.log('='.repeat(60));

    const tokenStats = jwtHandler.getStats();
    const sessionStats = tokenManager.getStatistics();
    const rbacStats = rbacManager.getRoleStats();

    console.log('\nToken Statistics:');
    console.log(`  Active tokens: ${tokenStats.activeTokens}`);
    console.log(`  Revoked tokens: ${tokenStats.revokedTokens}`);

    console.log('\nSession Statistics:');
    console.log(`  Active sessions: ${sessionStats.activeSessions}`);
    console.log(`  Active tokens: ${sessionStats.activeTokens}`);

    console.log('\nRole Distribution:');
    for (const [role, stats] of Object.entries(rbacStats)) {
      console.log(`  ${role}: ${stats.agentCount} agents`);
    }

    // Keep running for demonstration
    console.log('\n🎯 Authenticated orchestration running...');
    console.log('Press Ctrl+C to stop\n');

  } catch (error) {
    console.error('❌ Demonstration error:', error);
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down authenticated orchestration...');
    process.exit(0);
  });

  // Run demonstration
  await demonstrateAuthentication();
}