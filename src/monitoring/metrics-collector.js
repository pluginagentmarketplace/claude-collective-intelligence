/**
 * Metrics Collector Service
 * Collects, aggregates, and exposes metrics for Prometheus scraping
 */

const express = require('express');
const prometheusConfig = require('./prometheus-config');
const os = require('os');
const { EventEmitter } = require('events');

class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      port: options.port || 9090,
      host: options.host || '0.0.0.0',
      path: options.path || '/metrics',
      collectInterval: options.collectInterval || 10000, // 10 seconds
      enableSystemMetrics: options.enableSystemMetrics !== false,
      enableBusinessMetrics: options.enableBusinessMetrics !== false,
      enablePerformanceMetrics: options.enablePerformanceMetrics !== false,
      ...options
    };

    this.app = null;
    this.server = null;
    this.collectors = new Map();
    this.intervals = [];
    this.isRunning = false;

    // Metric aggregation buffers
    this.metricBuffers = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map(),
      summaries: new Map()
    };

    // Performance tracking
    this.performanceMarks = new Map();

    this.setupDefaultCollectors();
  }

  /**
   * Setup default metric collectors
   */
  setupDefaultCollectors() {
    // System metrics collector
    if (this.options.enableSystemMetrics) {
      this.registerCollector('system', this.collectSystemMetrics.bind(this));
    }

    // Process metrics collector
    this.registerCollector('process', this.collectProcessMetrics.bind(this));

    // Custom business metrics can be registered dynamically
  }

  /**
   * Register a custom metric collector
   */
  registerCollector(name, collector) {
    if (typeof collector !== 'function') {
      throw new Error(`Collector must be a function: ${name}`);
    }
    this.collectors.set(name, collector);
  }

  /**
   * Unregister a metric collector
   */
  unregisterCollector(name) {
    return this.collectors.delete(name);
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    try {
      // CPU metrics
      const cpus = os.cpus();
      cpus.forEach((cpu, index) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        const usage = ((total - idle) / total) * 100;

        prometheusConfig.cpuUsagePercent.set(
          { core: `${index}`, process: 'system' },
          usage
        );
      });

      // Memory metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      prometheusConfig.memoryUsageBytes.set(
        { process: 'system', type: 'used' },
        usedMem
      );

      prometheusConfig.memoryUsageBytes.set(
        { process: 'system', type: 'free' },
        freeMem
      );

      // Load average (Unix-like systems)
      const loadAvg = os.loadavg();
      if (loadAvg && loadAvg.length > 0) {
        prometheusConfig.cpuUsagePercent.set(
          { core: 'load_1m', process: 'system' },
          loadAvg[0]
        );
        prometheusConfig.cpuUsagePercent.set(
          { core: 'load_5m', process: 'system' },
          loadAvg[1]
        );
        prometheusConfig.cpuUsagePercent.set(
          { core: 'load_15m', process: 'system' },
          loadAvg[2]
        );
      }
    } catch (error) {
      this.emit('error', { collector: 'system', error });
    }
  }

  /**
   * Collect process metrics
   */
  async collectProcessMetrics() {
    try {
      const memUsage = process.memoryUsage();

      // Process memory metrics
      prometheusConfig.memoryUsageBytes.set(
        { process: 'node', type: 'rss' },
        memUsage.rss
      );

      prometheusConfig.memoryUsageBytes.set(
        { process: 'node', type: 'heap_total' },
        memUsage.heapTotal
      );

      prometheusConfig.memoryUsageBytes.set(
        { process: 'node', type: 'heap_used' },
        memUsage.heapUsed
      );

      prometheusConfig.memoryUsageBytes.set(
        { process: 'node', type: 'external' },
        memUsage.external
      );

      // Process CPU usage
      const cpuUsage = process.cpuUsage();
      const totalCpuTime = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      prometheusConfig.cpuUsagePercent.set(
        { core: 'process', process: 'node' },
        totalCpuTime
      );

      // Event loop lag (if available)
      if (this.eventLoopLag) {
        prometheusConfig.responseTimeMilliseconds.observe(
          { service: 'node', operation: 'event_loop' },
          this.eventLoopLag
        );
      }
    } catch (error) {
      this.emit('error', { collector: 'process', error });
    }
  }

  /**
   * Collect agent metrics
   */
  async collectAgentMetrics(agents) {
    try {
      const agentCounts = new Map();

      // Count agents by type and status
      for (const agent of agents) {
        const key = `${agent.type}_${agent.status}`;
        agentCounts.set(key, (agentCounts.get(key) || 0) + 1);
      }

      // Update gauge metrics
      for (const [key, count] of agentCounts) {
        const [type, status] = key.split('_');
        prometheusConfig.activeAgents.set({ type, status }, count);
      }
    } catch (error) {
      this.emit('error', { collector: 'agent', error });
    }
  }

  /**
   * Collect queue metrics
   */
  async collectQueueMetrics(queues) {
    try {
      for (const queue of queues) {
        prometheusConfig.updateQueueSize(
          queue.name,
          queue.size,
          queue.priority || 'normal'
        );
      }
    } catch (error) {
      this.emit('error', { collector: 'queue', error });
    }
  }

  /**
   * Collect database metrics
   */
  async collectDatabaseMetrics(pools) {
    try {
      for (const [name, pool] of Object.entries(pools)) {
        prometheusConfig.updateConnectionPool(
          'postgres',
          name,
          pool.totalCount,
          pool.idleCount,
          pool.waitingCount
        );
      }
    } catch (error) {
      this.emit('error', { collector: 'database', error });
    }
  }

  /**
   * Start performance tracking
   */
  startPerformance(label) {
    this.performanceMarks.set(label, Date.now());
  }

  /**
   * End performance tracking and record metric
   */
  endPerformance(label, metricType = 'histogram', labels = {}) {
    const startTime = this.performanceMarks.get(label);
    if (!startTime) {
      console.warn(`Performance mark not found: ${label}`);
      return;
    }

    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    this.performanceMarks.delete(label);

    // Record based on metric type
    switch (metricType) {
      case 'histogram':
        prometheusConfig.taskDurationSeconds.observe(labels, duration);
        break;
      case 'summary':
        prometheusConfig.taskCompletionTime.observe(labels, duration);
        break;
      default:
        console.warn(`Unknown metric type: ${metricType}`);
    }

    return duration;
  }

  /**
   * Batch increment counter
   */
  incrementCounter(name, labels = {}, value = 1) {
    const key = `${name}:${JSON.stringify(labels)}`;
    const current = this.metricBuffers.counters.get(key) || 0;
    this.metricBuffers.counters.set(key, current + value);
  }

  /**
   * Batch update gauge
   */
  updateGauge(name, labels = {}, value) {
    const key = `${name}:${JSON.stringify(labels)}`;
    this.metricBuffers.gauges.set(key, value);
  }

  /**
   * Flush metric buffers to Prometheus
   */
  async flushMetrics() {
    try {
      // Flush counters
      for (const [key, value] of this.metricBuffers.counters) {
        const [name, labelsStr] = key.split(':');
        const labels = JSON.parse(labelsStr);

        if (prometheusConfig[name]) {
          prometheusConfig[name].inc(labels, value);
        }
      }
      this.metricBuffers.counters.clear();

      // Flush gauges
      for (const [key, value] of this.metricBuffers.gauges) {
        const [name, labelsStr] = key.split(':');
        const labels = JSON.parse(labelsStr);

        if (prometheusConfig[name]) {
          prometheusConfig[name].set(labels, value);
        }
      }
      this.metricBuffers.gauges.clear();

      this.emit('metrics_flushed', { timestamp: new Date() });
    } catch (error) {
      this.emit('error', { action: 'flush_metrics', error });
    }
  }

  /**
   * Setup Express server for metrics endpoint
   */
  setupServer() {
    this.app = express();

    // Metrics endpoint
    this.app.get(this.options.path, async (req, res) => {
      try {
        // Run all collectors before exposing metrics
        await this.runCollectors();

        // Flush any buffered metrics
        await this.flushMetrics();

        // Get metrics in Prometheus format
        const metrics = await prometheusConfig.getMetrics();

        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(metrics);
      } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).send('Error collecting metrics');
      }
    });

    // JSON metrics endpoint (for debugging)
    this.app.get(`${this.options.path}.json`, async (req, res) => {
      try {
        await this.runCollectors();
        await this.flushMetrics();

        const metrics = await prometheusConfig.getMetricsJSON();
        res.json(metrics);
      } catch (error) {
        console.error('Error getting metrics JSON:', error);
        res.status(500).json({ error: 'Error collecting metrics' });
      }
    });

    // Reset metrics endpoint (for testing)
    this.app.post(`${this.options.path}/reset`, (req, res) => {
      prometheusConfig.reset();
      res.json({ status: 'metrics reset' });
    });

    return this.app;
  }

  /**
   * Run all registered collectors
   */
  async runCollectors() {
    const promises = [];

    for (const [name, collector] of this.collectors) {
      promises.push(
        collector().catch(error => {
          console.error(`Error in collector ${name}:`, error);
          this.emit('collector_error', { name, error });
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Start the metrics collection service
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    this.setupServer();

    // Start the HTTP server
    this.server = this.app.listen(this.options.port, this.options.host, () => {
      console.log(`Metrics server listening on http://${this.options.host}:${this.options.port}${this.options.path}`);
      this.isRunning = true;
      this.emit('started');
    });

    // Setup periodic collection
    if (this.options.collectInterval > 0) {
      const interval = setInterval(() => {
        this.runCollectors().catch(error => {
          console.error('Error in periodic collection:', error);
        });
      }, this.options.collectInterval);

      this.intervals.push(interval);
    }

    // Setup metric flushing interval
    const flushInterval = setInterval(() => {
      this.flushMetrics().catch(error => {
        console.error('Error flushing metrics:', error);
      });
    }, 5000); // Flush every 5 seconds

    this.intervals.push(flushInterval);

    // Monitor event loop lag
    this.monitorEventLoop();

    return this.server;
  }

  /**
   * Stop the metrics collection service
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    // Clear all intervals
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];

    // Close the server
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      this.server = null;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Monitor event loop lag
   */
  monitorEventLoop() {
    let lastCheck = Date.now();

    setInterval(() => {
      const now = Date.now();
      const lag = now - lastCheck - 1000; // Expected 1 second interval

      if (lag > 10) { // More than 10ms lag
        this.eventLoopLag = lag;
      }

      lastCheck = now;
    }, 1000);
  }

  /**
   * Middleware for Express apps
   */
  middleware() {
    return prometheusConfig.httpMiddleware();
  }

  /**
   * Get Prometheus configuration instance
   */
  getPrometheusConfig() {
    return prometheusConfig;
  }

  /**
   * Helper methods for common metrics
   */

  recordTask(agent, status, duration, priority = 'normal') {
    prometheusConfig.recordTaskProcessed(agent, status, duration, priority);
  }

  recordError(type, severity, component, code) {
    prometheusConfig.recordError(type, severity, component, code);
  }

  recordMessage(exchange, routingKey, type, size) {
    prometheusConfig.recordMessagePublished(exchange, routingKey, type, size);
  }

  recordVote(type, category, source) {
    prometheusConfig.recordVote(type, category, source);
  }

  recordAchievement(category, difficulty, agent) {
    prometheusConfig.recordAchievement(category, difficulty, agent);
  }

  recordPoints(points, source, category, agent) {
    prometheusConfig.recordPoints(points, source, category, agent);
  }
}

module.exports = MetricsCollector;