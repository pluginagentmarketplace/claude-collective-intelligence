/**
 * Main Application Integration Example
 * Demonstrates comprehensive logging integration across the entire application
 */

const express = require('express');
const {
  initializeLogging,
  log,
  expressMiddleware,
  errorHandler,
  asyncHandler,
  performanceContext,
  batchContext,
  modules
} = require('../src/logger');

/**
 * Application class with full logging integration
 */
class AgentOrchestrationApp {
  constructor(config = {}) {
    this.config = config;
    this.app = express();
    this.agents = new Map();
    this.sessions = new Map();
  }

  /**
   * Initialize application with logging
   */
  async initialize() {
    // Initialize logging system
    await initializeLogging({
      level: process.env.LOG_LEVEL || 'info',
      enableMetrics: true,
      metricsInterval: 30000,
      globalContext: {
        appVersion: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'us-east-1'
      }
    });

    log.info('Application initialization started', {
      config: this.config,
      nodeVersion: process.version
    });

    // Setup middleware
    this.setupMiddleware();

    // Setup routes
    this.setupRoutes();

    // Initialize components
    await this.initializeComponents();

    // Start background tasks
    this.startBackgroundTasks();

    log.info('Application initialized successfully');
  }

  /**
   * Setup Express middleware with logging
   */
  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());

    // Add logging middleware
    this.app.use(expressMiddleware());

    // Add Morgan HTTP logging
    const morgan = require('morgan');
    this.app.use(morgan('combined', {
      stream: log.httpStream
    }));

    // Add request timing
    this.app.use((req, res, next) => {
      req.startTime = Date.now();

      // Override res.json to log response
      const originalJson = res.json;
      res.json = function(data) {
        const duration = Date.now() - req.startTime;

        modules.performance.logApiResponseTime(
          req.path,
          req.method,
          duration,
          res.statusCode
        );

        return originalJson.call(this, data);
      };

      next();
    });

    log.debug('Middleware configured');
  }

  /**
   * Setup application routes with logging
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', asyncHandler(async (req, res) => {
      const health = await this.performHealthCheck();

      log.info('Health check performed', {
        healthy: health.healthy,
        checks: Object.keys(health.checks)
      });

      res.status(health.healthy ? 200 : 503).json(health);
    }));

    // Create agent task
    this.app.post('/agents/:agentId/tasks', asyncHandler(async (req, res) => {
      const { agentId } = req.params;
      const taskData = req.body;

      log.info('Creating agent task', {
        agentId,
        taskType: taskData.type,
        priority: taskData.priority
      });

      const result = await performanceContext('createAgentTask', async () => {
        // Validate agent exists
        if (!this.agents.has(agentId)) {
          const error = new Error('Agent not found');
          error.status = 404;
          throw error;
        }

        // Create task
        const taskId = require('crypto').randomUUID();
        const agent = this.agents.get(agentId);

        const taskResult = await agent.executeTask(taskId, taskData);

        log.info('Agent task created', {
          agentId,
          taskId,
          success: taskResult.success
        });

        return {
          taskId,
          agentId,
          result: taskResult
        };
      });

      res.json(result);
    }));

    // Start voting session
    this.app.post('/voting/sessions', asyncHandler(async (req, res) => {
      const { topic, participants, options } = req.body;

      const sessionId = require('crypto').randomUUID();

      modules.voting.logSessionStart(sessionId, topic, participants, options);

      const session = await this.createVotingSession(
        sessionId,
        topic,
        participants,
        options
      );

      this.sessions.set(sessionId, session);

      res.json({
        sessionId,
        status: 'active',
        participantCount: participants.length
      });
    }));

    // Cast vote
    this.app.post('/voting/sessions/:sessionId/vote', asyncHandler(async (req, res) => {
      const { sessionId } = req.params;
      const { voterId, vote } = req.body;

      if (!this.sessions.has(sessionId)) {
        const error = new Error('Session not found');
        error.status = 404;
        throw error;
      }

      modules.voting.logVoteCast(sessionId, voterId, vote);

      const session = this.sessions.get(sessionId);
      const result = await session.castVote(voterId, vote);

      if (result.consensusReached) {
        modules.voting.logConsensus(sessionId, result.decision, {
          totalVotes: result.totalVotes,
          consensusPercentage: result.consensusPercentage,
          voteDistribution: result.distribution,
          duration: Date.now() - session.startTime
        });
      }

      res.json(result);
    }));

    // Batch operations endpoint
    this.app.post('/batch/operations', asyncHandler(async (req, res) => {
      const { operations } = req.body;
      const batchId = require('crypto').randomUUID();

      log.info('Starting batch operation', {
        batchId,
        operationCount: operations.length
      });

      const results = await batchContext(batchId, operations, async (operation) => {
        return await this.executeOperation(operation);
      });

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      log.info('Batch operation completed', {
        batchId,
        total: operations.length,
        success: successCount,
        failure: failureCount
      });

      res.json({
        batchId,
        results,
        summary: {
          total: operations.length,
          success: successCount,
          failure: failureCount
        }
      });
    }));

    // Metrics endpoint
    this.app.get('/metrics', asyncHandler(async (req, res) => {
      const metrics = await this.collectMetrics();

      log.debug('Metrics collected', {
        metricCount: Object.keys(metrics).length
      });

      res.json(metrics);
    }));

    // Error handling middleware
    this.app.use(errorHandler);

    log.info('Routes configured', {
      routes: this.app._router.stack
        .filter(r => r.route)
        .map(r => ({
          path: r.route.path,
          methods: Object.keys(r.route.methods)
        }))
    });
  }

  /**
   * Initialize application components
   */
  async initializeComponents() {
    log.info('Initializing components');

    try {
      // Initialize RabbitMQ
      const { RabbitMQManager } = require('./logging-integration-rabbitmq');
      this.mq = new RabbitMQManager(this.config.rabbitmq);
      await this.mq.connect();

      // Initialize agents
      const { ResearchAgent } = require('./logging-integration-agent');

      const agentConfigs = [
        { id: 'research-agent-1', type: 'research' },
        { id: 'analysis-agent-1', type: 'analysis' },
        { id: 'summary-agent-1', type: 'summary' }
      ];

      for (const config of agentConfigs) {
        const agent = new ResearchAgent(config.id, config);
        this.agents.set(config.id, agent);

        log.info('Agent initialized', {
          agentId: config.id,
          type: config.type
        });
      }

      // Initialize gamification system
      modules.gamification.logPointsAwarded('system', 100, 'System startup');

      log.info('All components initialized successfully', {
        agentCount: this.agents.size,
        rabbitmqConnected: !!this.mq
      });

    } catch (error) {
      log.exception(error, 'Component initialization failed');
      throw error;
    }
  }

  /**
   * Start background tasks with logging
   */
  startBackgroundTasks() {
    // Health check interval
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.performHealthCheck();

        if (!health.healthy) {
          log.warn('Health check failed', {
            failedChecks: Object.entries(health.checks)
              .filter(([_, check]) => !check.passed)
              .map(([name]) => name)
          });
        }
      } catch (error) {
        log.error('Health check error', {
          error: error.message
        });
      }
    }, 60000);

    // Metrics collection interval
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();

        log.info('System metrics', {
          activeAgents: metrics.agents.active,
          pendingTasks: metrics.tasks.pending,
          memoryUsage: metrics.system.memory.heapUsed
        });

      } catch (error) {
        log.error('Metrics collection error', {
          error: error.message
        });
      }
    }, 30000);

    // Session cleanup interval
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 3600000; // 1 hour

      for (const [sessionId, session] of this.sessions) {
        if (now - session.startTime > timeout) {
          modules.voting.logTimeout(
            sessionId,
            session.votesReceived,
            session.totalExpected
          );
          this.sessions.delete(sessionId);
        }
      }
    }, 300000); // 5 minutes

    log.info('Background tasks started', {
      tasks: ['healthCheck', 'metrics', 'cleanup']
    });
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    const checks = {};

    // Check agents
    checks.agents = {
      passed: this.agents.size > 0,
      value: this.agents.size
    };

    // Check RabbitMQ
    checks.rabbitmq = {
      passed: this.mq && this.mq.connection,
      value: 'connected'
    };

    // Check memory
    const memUsage = process.memoryUsage();
    checks.memory = {
      passed: memUsage.heapUsed < 500 * 1024 * 1024, // 500MB
      value: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
    };

    // Check sessions
    checks.sessions = {
      passed: this.sessions.size < 100,
      value: this.sessions.size
    };

    const healthy = Object.values(checks).every(check => check.passed);

    return {
      healthy,
      checks,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Collect system metrics
   */
  async collectMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      agents: {
        total: this.agents.size,
        active: 0,
        idle: 0
      },
      tasks: {
        pending: 0,
        completed: 0,
        failed: 0
      },
      sessions: {
        active: this.sessions.size,
        completed: 0
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };

    // Collect agent metrics
    for (const agent of this.agents.values()) {
      if (agent.state === 'busy') {
        metrics.agents.active++;
      } else {
        metrics.agents.idle++;
      }
    }

    return metrics;
  }

  /**
   * Create voting session
   */
  async createVotingSession(sessionId, topic, participants, options) {
    return {
      sessionId,
      topic,
      participants,
      startTime: Date.now(),
      votes: new Map(),
      votesReceived: 0,
      totalExpected: participants.length,
      castVote: async function(voterId, vote) {
        this.votes.set(voterId, vote);
        this.votesReceived++;

        const consensus = this.checkConsensus();
        return {
          accepted: true,
          votesReceived: this.votesReceived,
          totalExpected: this.totalExpected,
          consensusReached: consensus.reached,
          decision: consensus.decision,
          consensusPercentage: consensus.percentage,
          distribution: consensus.distribution,
          totalVotes: this.votesReceived
        };
      },
      checkConsensus: function() {
        const voteCount = {};
        for (const vote of this.votes.values()) {
          voteCount[vote] = (voteCount[vote] || 0) + 1;
        }

        const maxVotes = Math.max(...Object.values(voteCount));
        const winner = Object.keys(voteCount).find(k => voteCount[k] === maxVotes);
        const percentage = (maxVotes / this.votesReceived) * 100;

        return {
          reached: percentage >= (options?.threshold || 51),
          decision: winner,
          percentage,
          distribution: voteCount
        };
      }
    };
  }

  /**
   * Execute a single operation
   */
  async executeOperation(operation) {
    log.debug('Executing operation', { type: operation.type });

    // Simulate operation execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    if (Math.random() > 0.9) {
      throw new Error('Random operation failure');
    }

    return {
      type: operation.type,
      result: 'success'
    };
  }

  /**
   * Start the application server
   */
  async start(port = 3000) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        log.info('Application server started', {
          port,
          pid: process.pid,
          environment: process.env.NODE_ENV || 'development'
        });
        resolve();
      });
    });
  }

  /**
   * Gracefully shutdown the application
   */
  async shutdown() {
    log.info('Application shutdown initiated');

    // Clear intervals
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    // Close RabbitMQ connection
    if (this.mq) {
      await this.mq.close();
    }

    // Close HTTP server
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }

    // Shutdown logging
    await log.close();

    console.log('Application shutdown complete');
  }
}

/**
 * Main application entry point
 */
async function main() {
  const app = new AgentOrchestrationApp({
    rabbitmq: {
      url: process.env.RABBITMQ_URL || 'amqp://localhost'
    }
  });

  try {
    // Initialize application
    await app.initialize();

    // Start server
    const port = process.env.PORT || 3000;
    await app.start(port);

    // Handle shutdown signals
    const shutdown = async () => {
      await app.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      log.exception(error, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled rejection', {
        reason,
        promise
      });
    });

    log.info('Application is ready to accept requests', {
      url: `http://localhost:${port}`,
      endpoints: [
        'GET /health',
        'GET /metrics',
        'POST /agents/:agentId/tasks',
        'POST /voting/sessions',
        'POST /voting/sessions/:sessionId/vote',
        'POST /batch/operations'
      ]
    });

  } catch (error) {
    log.exception(error, 'Application startup failed');
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  AgentOrchestrationApp,
  main
};

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}