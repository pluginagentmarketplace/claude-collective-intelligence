/**
 * Prometheus Configuration and Metric Definitions
 * Enterprise-grade metrics setup for AI Agent RabbitMQ platform
 */

const client = require('prom-client');

class PrometheusConfig {
  constructor() {
    // Create a custom registry for better control
    this.register = new client.Registry();

    // Enable default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({
      register: this.register,
      prefix: 'ai_agent_',
      labels: {
        app: 'ai-agent-rabbitmq',
        env: process.env.NODE_ENV || 'development'
      }
    });

    // Initialize all custom metrics
    this.initializeCounters();
    this.initializeGauges();
    this.initializeHistograms();
    this.initializeSummaries();
  }

  /**
   * Counter Metrics - Values that only increase
   */
  initializeCounters() {
    // Task Processing Metrics
    this.tasksProcessedTotal = new client.Counter({
      name: 'tasks_processed_total',
      help: 'Total number of tasks processed',
      labelNames: ['agent', 'status', 'priority'],
      registers: [this.register]
    });

    this.errorsTotal = new client.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity', 'component', 'code'],
      registers: [this.register]
    });

    this.messagesPublishedTotal = new client.Counter({
      name: 'messages_published_total',
      help: 'Total number of messages published to RabbitMQ',
      labelNames: ['exchange', 'routing_key', 'type'],
      registers: [this.register]
    });

    this.messagesConsumedTotal = new client.Counter({
      name: 'messages_consumed_total',
      help: 'Total number of messages consumed from RabbitMQ',
      labelNames: ['queue', 'consumer', 'status'],
      registers: [this.register]
    });

    // Business Metrics
    this.votesCastTotal = new client.Counter({
      name: 'votes_cast_total',
      help: 'Total number of votes cast',
      labelNames: ['type', 'category', 'source'],
      registers: [this.register]
    });

    this.achievementsUnlockedTotal = new client.Counter({
      name: 'achievements_unlocked_total',
      help: 'Total number of achievements unlocked',
      labelNames: ['category', 'difficulty', 'agent'],
      registers: [this.register]
    });

    this.pointsEarnedTotal = new client.Counter({
      name: 'points_earned_total',
      help: 'Total number of points earned',
      labelNames: ['source', 'category', 'agent'],
      registers: [this.register]
    });

    // API Metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    // Database Metrics
    this.dbQueriesTotal = new client.Counter({
      name: 'db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'table', 'status'],
      registers: [this.register]
    });
  }

  /**
   * Gauge Metrics - Values that can go up and down
   */
  initializeGauges() {
    // System Resources
    this.activeAgents = new client.Gauge({
      name: 'active_agents',
      help: 'Number of currently active agents',
      labelNames: ['type', 'status'],
      registers: [this.register]
    });

    this.queueSize = new client.Gauge({
      name: 'queue_size',
      help: 'Current size of message queues',
      labelNames: ['queue', 'priority'],
      registers: [this.register]
    });

    this.memoryUsageBytes = new client.Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['process', 'type'],
      registers: [this.register]
    });

    this.cpuUsagePercent = new client.Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage',
      labelNames: ['core', 'process'],
      registers: [this.register]
    });

    // Connection Pools
    this.connectionPoolSize = new client.Gauge({
      name: 'connection_pool_size',
      help: 'Total size of connection pool',
      labelNames: ['type', 'host'],
      registers: [this.register]
    });

    this.connectionPoolActive = new client.Gauge({
      name: 'connection_pool_active',
      help: 'Number of active connections in pool',
      labelNames: ['type', 'host'],
      registers: [this.register]
    });

    this.connectionPoolIdle = new client.Gauge({
      name: 'connection_pool_idle',
      help: 'Number of idle connections in pool',
      labelNames: ['type', 'host'],
      registers: [this.register]
    });

    // Business State
    this.userOnlineCount = new client.Gauge({
      name: 'user_online_count',
      help: 'Number of users currently online',
      registers: [this.register]
    });

    this.activeTasksCount = new client.Gauge({
      name: 'active_tasks_count',
      help: 'Number of tasks currently being processed',
      labelNames: ['type', 'priority'],
      registers: [this.register]
    });

    this.pendingVotesCount = new client.Gauge({
      name: 'pending_votes_count',
      help: 'Number of votes pending processing',
      labelNames: ['type'],
      registers: [this.register]
    });

    // Cache Metrics
    this.cacheHitRatio = new client.Gauge({
      name: 'cache_hit_ratio',
      help: 'Cache hit ratio',
      labelNames: ['cache_name'],
      registers: [this.register]
    });

    this.cacheSizeBytes = new client.Gauge({
      name: 'cache_size_bytes',
      help: 'Current cache size in bytes',
      labelNames: ['cache_name'],
      registers: [this.register]
    });
  }

  /**
   * Histogram Metrics - Distribution of values
   */
  initializeHistograms() {
    // Performance Metrics
    this.taskDurationSeconds = new client.Histogram({
      name: 'task_duration_seconds',
      help: 'Task processing duration in seconds',
      labelNames: ['agent', 'type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register]
    });

    this.messageLatencySeconds = new client.Histogram({
      name: 'message_latency_seconds',
      help: 'Message processing latency in seconds',
      labelNames: ['queue', 'type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    this.apiRequestDurationSeconds = new client.Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['endpoint', 'method', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.register]
    });

    this.databaseQueryDurationSeconds = new client.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.register]
    });

    // Size Distributions
    this.messageSizeBytes = new client.Histogram({
      name: 'message_size_bytes',
      help: 'Message size in bytes',
      labelNames: ['type', 'queue'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.register]
    });

    this.batchSize = new client.Histogram({
      name: 'batch_size',
      help: 'Batch processing size',
      labelNames: ['operation', 'type'],
      buckets: [1, 10, 50, 100, 500, 1000],
      registers: [this.register]
    });

    // Response Time Distribution
    this.responseTimeMilliseconds = new client.Histogram({
      name: 'response_time_milliseconds',
      help: 'Response time distribution in milliseconds',
      labelNames: ['service', 'operation'],
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
      registers: [this.register]
    });
  }

  /**
   * Summary Metrics - Quantile calculations
   */
  initializeSummaries() {
    this.requestSizeBytes = new client.Summary({
      name: 'request_size_bytes',
      help: 'Request size in bytes with quantiles',
      labelNames: ['endpoint', 'method'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      maxAgeSeconds: 600,
      ageBuckets: 5,
      registers: [this.register]
    });

    this.responseSizeBytes = new client.Summary({
      name: 'response_size_bytes',
      help: 'Response size in bytes with quantiles',
      labelNames: ['endpoint', 'method', 'status_code'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      maxAgeSeconds: 600,
      ageBuckets: 5,
      registers: [this.register]
    });

    this.taskCompletionTime = new client.Summary({
      name: 'task_completion_time_seconds',
      help: 'Task completion time with quantiles',
      labelNames: ['task_type', 'priority'],
      percentiles: [0.5, 0.75, 0.9, 0.95, 0.99],
      maxAgeSeconds: 600,
      ageBuckets: 5,
      registers: [this.register]
    });
  }

  /**
   * Helper method to record task processing
   */
  recordTaskProcessed(agent, status, duration, priority = 'normal') {
    this.tasksProcessedTotal.inc({ agent, status, priority });
    this.taskDurationSeconds.observe({ agent, type: 'processing', status }, duration);
  }

  /**
   * Helper method to record errors
   */
  recordError(type, severity, component, code = 'unknown') {
    this.errorsTotal.inc({ type, severity, component, code });
  }

  /**
   * Helper method to record message published
   */
  recordMessagePublished(exchange, routingKey, type, sizeBytes) {
    this.messagesPublishedTotal.inc({ exchange, routing_key: routingKey, type });
    this.messageSizeBytes.observe({ type, queue: exchange }, sizeBytes);
  }

  /**
   * Helper method to record API request
   */
  recordApiRequest(method, route, statusCode, duration, requestSize, responseSize) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
    this.apiRequestDurationSeconds.observe({ endpoint: route, method, status_code: statusCode }, duration);
    this.requestSizeBytes.observe({ endpoint: route, method }, requestSize);
    this.responseSizeBytes.observe({ endpoint: route, method, status_code: statusCode }, responseSize);
  }

  /**
   * Helper method to update connection pool metrics
   */
  updateConnectionPool(type, host, total, active, idle) {
    this.connectionPoolSize.set({ type, host }, total);
    this.connectionPoolActive.set({ type, host }, active);
    this.connectionPoolIdle.set({ type, host }, idle);
  }

  /**
   * Helper method to update queue metrics
   */
  updateQueueSize(queue, size, priority = 'normal') {
    this.queueSize.set({ queue, priority }, size);
  }

  /**
   * Helper method for business metrics
   */
  recordVote(type, category = 'general', source = 'user') {
    this.votesCastTotal.inc({ type, category, source });
  }

  recordAchievement(category, difficulty, agent) {
    this.achievementsUnlockedTotal.inc({ category, difficulty, agent });
  }

  recordPoints(points, source, category, agent) {
    this.pointsEarnedTotal.inc({ source, category, agent }, points);
  }

  /**
   * Express middleware for automatic HTTP metrics
   */
  httpMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      const requestSize = parseInt(req.headers['content-length'] || '0');

      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const responseSize = parseInt(res.getHeaders()['content-length'] || '0');
        const route = req.route ? req.route.path : req.path;

        this.recordApiRequest(
          req.method,
          route,
          res.statusCode,
          duration,
          requestSize,
          responseSize
        );
      });

      next();
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics() {
    return this.register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON() {
    return this.register.getMetricsAsJSON();
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.register.resetMetrics();
  }

  /**
   * Clear specific metric
   */
  clear(metricName) {
    this.register.removeSingleMetric(metricName);
  }
}

// Export singleton instance
module.exports = new PrometheusConfig();