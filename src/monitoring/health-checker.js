/**
 * Health Checker Service
 * Provides liveness and readiness probes for Kubernetes and monitoring
 */

const express = require('express');
const { EventEmitter } = require('events');
const axios = require('axios');
const prometheusConfig = require('./prometheus-config');

class HealthChecker extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      port: options.port || 3001,
      host: options.host || '0.0.0.0',
      checkInterval: options.checkInterval || 30000, // 30 seconds
      timeout: options.timeout || 5000, // 5 seconds per check
      gracefulShutdownTimeout: options.gracefulShutdownTimeout || 30000,
      ...options
    };

    this.app = null;
    this.server = null;
    this.checks = new Map();
    this.dependencies = new Map();
    this.checkResults = new Map();
    this.startTime = Date.now();
    this.isShuttingDown = false;
    this.isReady = false;

    // Health status
    this.status = {
      healthy: true,
      ready: false,
      checks: {},
      lastCheck: null
    };

    this.setupDefaultChecks();
  }

  /**
   * Setup default health checks
   */
  setupDefaultChecks() {
    // Memory check
    this.registerCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      return {
        healthy: heapUsedPercent < 90,
        message: `Heap usage: ${heapUsedPercent.toFixed(2)}%`,
        details: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          rss: memUsage.rss,
          external: memUsage.external
        }
      };
    });

    // CPU check
    this.registerCheck('cpu', async () => {
      const cpuUsage = process.cpuUsage();
      const totalCpuTime = (cpuUsage.user + cpuUsage.system) / 1000000;

      return {
        healthy: true, // CPU check is informational
        message: `CPU time: ${totalCpuTime.toFixed(2)}s`,
        details: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          total: totalCpuTime
        }
      };
    });

    // Event loop check
    this.registerCheck('event_loop', async () => {
      const start = Date.now();

      return new Promise((resolve) => {
        setImmediate(() => {
          const lag = Date.now() - start;
          resolve({
            healthy: lag < 100, // Less than 100ms lag
            message: `Event loop lag: ${lag}ms`,
            details: { lag }
          });
        });
      });
    });

    // Disk space check (if needed)
    this.registerCheck('disk_space', async () => {
      // This is a placeholder - implement based on your needs
      return {
        healthy: true,
        message: 'Disk space check not implemented',
        details: {}
      };
    });
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFunction, options = {}) {
    this.checks.set(name, {
      fn: checkFunction,
      critical: options.critical !== false, // Default to critical
      timeout: options.timeout || this.options.timeout
    });
  }

  /**
   * Register a dependency
   */
  registerDependency(name, checkFunction, options = {}) {
    this.dependencies.set(name, {
      fn: checkFunction,
      critical: options.critical !== false,
      timeout: options.timeout || this.options.timeout,
      retries: options.retries || 3,
      retryDelay: options.retryDelay || 1000
    });
  }

  /**
   * Common dependency checks
   */

  async checkRabbitMQ(connection) {
    try {
      if (!connection || !connection.connection) {
        return { connected: false, error: 'No connection object' };
      }

      // Check if connection is open
      const isConnected = connection.connection.connection?.state === 'open';

      return {
        connected: isConnected,
        channels: connection.channels?.length || 0,
        error: isConnected ? null : 'Connection not open'
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async checkPostgres(pool) {
    try {
      if (!pool) {
        return { connected: false, error: 'No pool object' };
      }

      const client = await pool.connect();
      const result = await client.query('SELECT 1');
      client.release();

      return {
        connected: true,
        poolSize: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async checkRedis(client) {
    try {
      if (!client) {
        return { connected: false, error: 'No client object' };
      }

      const pong = await client.ping();
      const info = await client.info('server');

      return {
        connected: pong === 'PONG',
        version: info.redis_version,
        connectedClients: info.connected_clients,
        usedMemory: info.used_memory_human
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async checkElasticsearch(client, index) {
    try {
      const health = await client.cluster.health();
      const indexExists = await client.indices.exists({ index });

      return {
        connected: true,
        clusterHealth: health.status,
        indexExists: indexExists.body,
        numberOfNodes: health.number_of_nodes
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  async checkExternalAPI(url, expectedStatus = 200) {
    try {
      const response = await axios.get(url, {
        timeout: this.options.timeout,
        validateStatus: () => true // Don't throw on any status
      });

      return {
        connected: response.status === expectedStatus,
        status: response.status,
        responseTime: response.headers['x-response-time'] || null
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Run a single check with timeout
   */
  async runCheck(name, check) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Check timeout')), check.timeout);
    });

    try {
      const result = await Promise.race([check.fn(), timeoutPromise]);
      return {
        name,
        ...result,
        timestamp: new Date().toISOString(),
        duration: Date.now() - Date.now() // Calculate actual duration
      };
    } catch (error) {
      return {
        name,
        healthy: false,
        message: error.message,
        error: error.stack,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = {};
    const promises = [];

    // Run all checks in parallel
    for (const [name, check] of this.checks) {
      promises.push(
        this.runCheck(name, check).then(result => {
          results[name] = result;
        })
      );
    }

    await Promise.all(promises);

    // Determine overall health
    let healthy = true;
    for (const [name, check] of this.checks) {
      if (check.critical && !results[name].healthy) {
        healthy = false;
        break;
      }
    }

    this.status.healthy = healthy;
    this.status.checks = results;
    this.status.lastCheck = new Date().toISOString();

    // Record metrics
    prometheusConfig.activeAgents.set(
      { type: 'health_checker', status: healthy ? 'healthy' : 'unhealthy' },
      1
    );

    return { healthy, checks: results };
  }

  /**
   * Run readiness checks (dependencies)
   */
  async runReadinessChecks() {
    const results = {};
    const promises = [];

    // Run all dependency checks in parallel
    for (const [name, dep] of this.dependencies) {
      promises.push(
        this.runCheckWithRetry(name, dep).then(result => {
          results[name] = result;
        })
      );
    }

    await Promise.all(promises);

    // Determine readiness
    let ready = true;
    for (const [name, dep] of this.dependencies) {
      if (dep.critical && !results[name].connected) {
        ready = false;
        break;
      }
    }

    this.isReady = ready;
    return { ready, dependencies: results };
  }

  /**
   * Run check with retry logic
   */
  async runCheckWithRetry(name, dependency) {
    let lastError;

    for (let i = 0; i < dependency.retries; i++) {
      try {
        const result = await this.runCheck(name, dependency);
        if (result.healthy || result.connected) {
          return result;
        }
        lastError = result;
      } catch (error) {
        lastError = { name, error: error.message };
      }

      if (i < dependency.retries - 1) {
        await new Promise(resolve => setTimeout(resolve, dependency.retryDelay));
      }
    }

    return lastError;
  }

  /**
   * Setup Express endpoints
   */
  setupEndpoints() {
    this.app = express();
    this.app.use(express.json());

    // Liveness probe
    this.app.get('/health', async (req, res) => {
      if (this.isShuttingDown) {
        res.status(503).json({
          status: 'shutting_down',
          message: 'Service is shutting down'
        });
        return;
      }

      const healthCheck = await this.runHealthChecks();

      const response = {
        status: healthCheck.healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        version: process.env.APP_VERSION || '1.0.0',
        checks: healthCheck.checks
      };

      res.status(healthCheck.healthy ? 200 : 503).json(response);
    });

    // Readiness probe
    this.app.get('/ready', async (req, res) => {
      if (this.isShuttingDown) {
        res.status(503).json({
          status: 'not_ready',
          message: 'Service is shutting down'
        });
        return;
      }

      const readinessCheck = await this.runReadinessChecks();

      const response = {
        status: readinessCheck.ready ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies: readinessCheck.dependencies
      };

      res.status(readinessCheck.ready ? 200 : 503).json(response);
    });

    // Detailed health status
    this.app.get('/health/details', async (req, res) => {
      const [health, readiness] = await Promise.all([
        this.runHealthChecks(),
        this.runReadinessChecks()
      ]);

      res.json({
        health: health.healthy,
        ready: readiness.ready,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: new Date().toISOString(),
        checks: health.checks,
        dependencies: readiness.dependencies,
        metrics: {
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      });
    });

    // Startup probe
    this.app.get('/startup', (req, res) => {
      const startupTime = Date.now() - this.startTime;
      const isStarted = startupTime > 10000 && this.isReady; // 10 seconds minimum

      res.status(isStarted ? 200 : 503).json({
        status: isStarted ? 'started' : 'starting',
        startupTime: Math.floor(startupTime / 1000),
        ready: this.isReady
      });
    });

    // Graceful shutdown endpoint
    this.app.post('/shutdown', (req, res) => {
      if (this.isShuttingDown) {
        res.json({ status: 'already_shutting_down' });
        return;
      }

      res.json({ status: 'shutdown_initiated' });
      this.gracefulShutdown();
    });

    return this.app;
  }

  /**
   * Start the health checker service
   */
  async start() {
    if (this.server) {
      return;
    }

    this.setupEndpoints();

    this.server = this.app.listen(this.options.port, this.options.host, () => {
      console.log(`Health checker listening on http://${this.options.host}:${this.options.port}`);
      this.emit('started');
    });

    // Periodic health checks
    this.checkInterval = setInterval(() => {
      this.runHealthChecks().catch(error => {
        console.error('Error in periodic health check:', error);
        this.emit('check_error', error);
      });
    }, this.options.checkInterval);

    // Initial readiness check
    setTimeout(() => {
      this.runReadinessChecks().catch(error => {
        console.error('Error in initial readiness check:', error);
      });
    }, 5000);

    return this.server;
  }

  /**
   * Stop the health checker service
   */
  async stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      this.server = null;
    }

    this.emit('stopped');
  }

  /**
   * Graceful shutdown handler
   */
  async gracefulShutdown() {
    if (this.isShuttingDown) {
      return;
    }

    console.log('Initiating graceful shutdown...');
    this.isShuttingDown = true;
    this.emit('shutdown_started');

    // Mark as unhealthy immediately
    this.status.healthy = false;

    // Wait for ongoing requests to complete
    setTimeout(async () => {
      await this.stop();
      this.emit('shutdown_completed');
      process.exit(0);
    }, this.options.gracefulShutdownTimeout);
  }

  /**
   * Register shutdown handlers
   */
  registerShutdownHandlers() {
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      prometheusConfig.recordError('uncaught_exception', 'critical', 'process', error.name);
      this.gracefulShutdown();
    });

    // Unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      prometheusConfig.recordError('unhandled_rejection', 'critical', 'promise', 'rejection');
      // Don't exit on unhandled rejection, but log it
    });
  }

  /**
   * Express middleware for health-aware routing
   */
  middleware() {
    return (req, res, next) => {
      if (this.isShuttingDown) {
        res.status(503).json({
          error: 'Service is shutting down'
        });
        return;
      }

      if (!this.isReady && req.path !== '/health' && req.path !== '/ready') {
        res.status(503).json({
          error: 'Service is not ready'
        });
        return;
      }

      next();
    };
  }
}

module.exports = HealthChecker;