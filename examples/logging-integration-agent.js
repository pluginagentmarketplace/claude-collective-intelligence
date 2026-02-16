/**
 * Agent Integration Example
 * Demonstrates how to integrate logging in agent modules
 */

const { log, agentContext, modules } = require('../src/logger');
const { agent: agentLogger } = modules;

/**
 * Example Agent Class with Integrated Logging
 */
class ResearchAgent {
  constructor(agentId, config = {}) {
    this.agentId = agentId;
    this.config = config;
    this.logger = log.child('agent-research', { agentId });

    // Log agent initialization
    agentLogger.logInit(agentId, {
      type: 'research',
      capabilities: ['web-search', 'data-analysis', 'summarization'],
      version: '2.0.0',
      ...config
    });
  }

  /**
   * Execute a research task with full logging
   */
  async executeTask(taskId, taskData) {
    // Use agent context for automatic tracking
    return agentContext(this.agentId, taskId, async (context) => {
      const startTime = Date.now();

      try {
        // Log task start
        agentLogger.logTaskStart(this.agentId, taskId, 'research');

        // Simulate task steps with logging
        this.logger.debug('Starting research task', {
          taskId,
          query: taskData.query,
          sources: taskData.sources
        });

        // Step 1: Web search
        this.logger.info('Performing web search', {
          query: taskData.query,
          maxResults: 10
        });
        const searchResults = await this.performWebSearch(taskData.query);

        // Step 2: Data analysis
        this.logger.info('Analyzing search results', {
          resultCount: searchResults.length
        });
        const analysis = await this.analyzeData(searchResults);

        // Step 3: Generate summary
        this.logger.info('Generating summary', {
          analysisComplete: true
        });
        const summary = await this.generateSummary(analysis);

        // Log successful completion
        const duration = Date.now() - startTime;
        agentLogger.logTaskComplete(this.agentId, taskId, {
          success: true,
          output: summary
        }, duration);

        // Log metrics
        this.updateMetrics(true, duration);

        return {
          success: true,
          summary,
          sources: searchResults.length,
          duration
        };

      } catch (error) {
        const duration = Date.now() - startTime;

        // Log error with full context
        agentLogger.logError(this.agentId, error, {
          taskId,
          taskData,
          duration
        });

        // Log failed completion
        agentLogger.logTaskComplete(this.agentId, taskId, {
          success: false,
          error: error.message
        }, duration);

        // Update metrics
        this.updateMetrics(false, duration);

        throw error;
      }
    });
  }

  /**
   * Communicate with another agent
   */
  async sendMessage(toAgentId, messageType, content) {
    // Log agent communication
    agentLogger.logCommunication(
      this.agentId,
      toAgentId,
      messageType,
      content
    );

    this.logger.debug('Sending message to agent', {
      to: toAgentId,
      type: messageType,
      size: content.length
    });

    // Simulate message sending
    return { sent: true, timestamp: new Date().toISOString() };
  }

  /**
   * Change agent state with logging
   */
  async changeState(newState, reason) {
    const oldState = this.state || 'idle';

    // Log state change
    agentLogger.logStateChange(this.agentId, oldState, newState, reason);

    this.state = newState;

    // Log additional context based on state
    if (newState === 'error') {
      this.logger.error('Agent entered error state', {
        reason,
        previousState: oldState
      });
    } else if (newState === 'busy') {
      this.logger.info('Agent is now busy', {
        reason,
        previousState: oldState
      });
    }
  }

  /**
   * Perform health check with logging
   */
  async healthCheck() {
    const health = {
      healthy: true,
      checks: {
        memory: this.checkMemory(),
        cpu: this.checkCPU(),
        connectivity: await this.checkConnectivity()
      },
      lastActivity: this.lastActivity || new Date().toISOString()
    };

    // Determine overall health
    health.healthy = Object.values(health.checks).every(check => check.passed);

    // Log health check results
    agentLogger.logHealthCheck(this.agentId, health);

    if (!health.healthy) {
      this.logger.warn('Health check failed', {
        failedChecks: Object.entries(health.checks)
          .filter(([_, check]) => !check.passed)
          .map(([name]) => name)
      });
    }

    return health;
  }

  /**
   * Update and log agent metrics
   */
  updateMetrics(success, duration) {
    if (!this.metrics) {
      this.metrics = {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalDuration: 0,
        startTime: Date.now()
      };
    }

    if (success) {
      this.metrics.tasksCompleted++;
    } else {
      this.metrics.tasksFailed++;
    }
    this.metrics.totalDuration += duration;

    const totalTasks = this.metrics.tasksCompleted + this.metrics.tasksFailed;
    const metrics = {
      tasksCompleted: this.metrics.tasksCompleted,
      tasksFailed: this.metrics.tasksFailed,
      successRate: (this.metrics.tasksCompleted / totalTasks) * 100,
      avgResponseTime: this.metrics.totalDuration / totalTasks,
      uptime: Date.now() - this.metrics.startTime,
      memoryUsage: process.memoryUsage()
    };

    // Log metrics periodically
    if (totalTasks % 10 === 0) {
      agentLogger.logMetrics(this.agentId, metrics);
    }

    return metrics;
  }

  // Simulated helper methods
  async performWebSearch(query) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return [
      { url: 'https://example.com/1', title: 'Result 1', relevance: 0.9 },
      { url: 'https://example.com/2', title: 'Result 2', relevance: 0.8 }
    ];
  }

  async analyzeData(data) {
    await new Promise(resolve => setTimeout(resolve, 50));
    return { patterns: ['pattern1', 'pattern2'], insights: 2 };
  }

  async generateSummary(analysis) {
    await new Promise(resolve => setTimeout(resolve, 30));
    return 'Summary of research findings based on analysis.';
  }

  checkMemory() {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return { passed: used < 500, value: used };
  }

  checkCPU() {
    // Simplified CPU check
    return { passed: true, value: 10 };
  }

  async checkConnectivity() {
    // Simulate connectivity check
    return { passed: true, latency: 20 };
  }
}

/**
 * Usage Example
 */
async function example() {
  // Initialize logging
  const { initializeLogging } = require('../src/logger');
  await initializeLogging({
    level: 'debug',
    enableMetrics: true
  });

  // Create agent with logging
  const agent = new ResearchAgent('research-agent-1', {
    maxConcurrentTasks: 5,
    timeout: 30000
  });

  try {
    // Execute a task
    const result = await agent.executeTask('task-123', {
      query: 'AI trends 2024',
      sources: ['web', 'academic']
    });

    log.info('Task completed successfully', {
      agentId: agent.agentId,
      result
    });

    // Send message to another agent
    await agent.sendMessage('analysis-agent-1', 'TASK_RESULT', {
      taskId: 'task-123',
      summary: result.summary
    });

    // Change state
    await agent.changeState('idle', 'Task completed');

    // Perform health check
    const health = await agent.healthCheck();

    if (health.healthy) {
      log.info('Agent is healthy', { agentId: agent.agentId });
    }

  } catch (error) {
    log.exception(error, 'Agent task failed', {
      agentId: agent.agentId
    });

    // Change to error state
    await agent.changeState('error', error.message);
  }
}

// Export for use in other modules
module.exports = {
  ResearchAgent,
  example
};

// Run example if executed directly
if (require.main === module) {
  example().catch(console.error);
}