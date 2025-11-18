/**
 * Error Monitoring System
 * Tracks errors, aggregates metrics, and manages alerts
 */

const {
  SEVERITY_LEVELS,
  SEVERITY_WEIGHTS,
  ALERT_THRESHOLDS,
  MONITORING_CONFIG
} = require('./error-constants');

class ErrorMonitor {
  constructor() {
    this.errors = [];
    this.metrics = {
      total: 0,
      byCategory: {},
      bySeverity: {},
      byCode: {},
      byHour: {},
      responseTime: []
    };
    this.alerts = [];
    this.alertHistory = [];
    this.aggregationIntervals = new Map();
    this.initialized = false;
  }

  /**
   * Initialize monitoring system
   */
  async initialize(config = {}) {
    if (this.initialized) return;

    this.config = {
      retentionPeriod: MONITORING_CONFIG.RETENTION_PERIOD,
      collectionInterval: MONITORING_CONFIG.COLLECTION_INTERVAL,
      maxErrors: config.maxErrors || 10000,
      enableAggregation: config.enableAggregation !== false,
      enableAlerts: config.enableAlerts !== false,
      alertChannels: config.alertChannels || [],
      ...config
    };

    // Start periodic cleanup
    this.startCleanup();

    // Start aggregation if enabled
    if (this.config.enableAggregation) {
      this.startAggregation();
    }

    this.initialized = true;
    console.log('Error Monitor initialized');
  }

  /**
   * Record an error
   */
  async recordError(error, context = {}) {
    const errorRecord = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      error: this.sanitizeError(error),
      context: this.sanitizeContext(context),
      category: error.category,
      severity: error.severity || SEVERITY_LEVELS.MEDIUM,
      code: error.code,
      correlationId: error.correlationId
    };

    // Add to errors list (with size limit)
    this.errors.push(errorRecord);
    if (this.errors.length > this.config.maxErrors) {
      this.errors.shift();
    }

    // Update metrics
    this.updateMetrics(errorRecord);

    // Check for alerts
    if (this.config.enableAlerts) {
      await this.checkAlertConditions(errorRecord);
    }

    return errorRecord.id;
  }

  /**
   * Update metrics
   */
  updateMetrics(errorRecord) {
    // Total count
    this.metrics.total++;

    // By category
    if (!this.metrics.byCategory[errorRecord.category]) {
      this.metrics.byCategory[errorRecord.category] = 0;
    }
    this.metrics.byCategory[errorRecord.category]++;

    // By severity
    if (!this.metrics.bySeverity[errorRecord.severity]) {
      this.metrics.bySeverity[errorRecord.severity] = 0;
    }
    this.metrics.bySeverity[errorRecord.severity]++;

    // By code
    if (!this.metrics.byCode[errorRecord.code]) {
      this.metrics.byCode[errorRecord.code] = 0;
    }
    this.metrics.byCode[errorRecord.code]++;

    // By hour
    const hour = new Date(errorRecord.timestamp).getHours();
    if (!this.metrics.byHour[hour]) {
      this.metrics.byHour[hour] = 0;
    }
    this.metrics.byHour[hour]++;
  }

  /**
   * Check alert conditions
   */
  async checkAlertConditions(errorRecord) {
    const alerts = [];

    // Check severity-based alerts
    if (errorRecord.severity === SEVERITY_LEVELS.CRITICAL) {
      alerts.push({
        type: 'CRITICAL_ERROR',
        message: `Critical error occurred: ${errorRecord.error.message}`,
        error: errorRecord,
        timestamp: Date.now()
      });
    }

    // Check threshold-based alerts
    for (const [level, threshold] of Object.entries(ALERT_THRESHOLDS)) {
      const recentErrors = this.getRecentErrors(threshold.timeWindow);
      const severityErrors = recentErrors.filter(e =>
        SEVERITY_WEIGHTS[e.severity] >= SEVERITY_WEIGHTS[threshold.severity]
      );

      if (severityErrors.length >= threshold.errorCount) {
        alerts.push({
          type: 'THRESHOLD_EXCEEDED',
          level,
          message: `Error threshold exceeded: ${severityErrors.length} ${threshold.severity} errors in ${threshold.timeWindow / 60000} minutes`,
          count: severityErrors.length,
          threshold: threshold.errorCount,
          timestamp: Date.now()
        });
      }
    }

    // Check for error rate spikes
    const spike = this.detectErrorSpike();
    if (spike) {
      alerts.push({
        type: 'ERROR_SPIKE',
        message: `Error rate spike detected: ${spike.increase}% increase`,
        details: spike,
        timestamp: Date.now()
      });
    }

    // Check for pattern-based alerts
    const pattern = this.detectErrorPattern();
    if (pattern) {
      alerts.push({
        type: 'ERROR_PATTERN',
        message: `Error pattern detected: ${pattern.description}`,
        pattern: pattern,
        timestamp: Date.now()
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  /**
   * Process an alert
   */
  async processAlert(alert) {
    // Check for duplicate alerts
    if (this.isDuplicateAlert(alert)) {
      return;
    }

    // Add to active alerts
    this.alerts.push(alert);

    // Add to history
    this.alertHistory.push({
      ...alert,
      processedAt: Date.now()
    });

    // Send through configured channels
    for (const channel of this.config.alertChannels) {
      try {
        await channel.send(alert);
      } catch (error) {
        console.error(`Failed to send alert via ${channel.name}:`, error);
      }
    }

    console.log(`Alert triggered: ${alert.type} - ${alert.message}`);
  }

  /**
   * Check if alert is duplicate
   */
  isDuplicateAlert(alert) {
    const recentAlerts = this.alerts.filter(a =>
      Date.now() - a.timestamp < 300000 // 5 minutes
    );

    return recentAlerts.some(a =>
      a.type === alert.type &&
      a.message === alert.message
    );
  }

  /**
   * Detect error spike
   */
  detectErrorSpike() {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    const tenMinutesAgo = now - 600000;

    const recentErrors = this.errors.filter(e => e.timestamp > fiveMinutesAgo).length;
    const previousErrors = this.errors.filter(e =>
      e.timestamp > tenMinutesAgo && e.timestamp <= fiveMinutesAgo
    ).length;

    if (previousErrors === 0) return null;

    const increase = ((recentErrors - previousErrors) / previousErrors) * 100;

    if (increase > 50) { // 50% increase threshold
      return {
        increase: increase.toFixed(2),
        recent: recentErrors,
        previous: previousErrors,
        timeWindow: '5 minutes'
      };
    }

    return null;
  }

  /**
   * Detect error patterns
   */
  detectErrorPattern() {
    const recentErrors = this.getRecentErrors(300000); // Last 5 minutes

    if (recentErrors.length < 5) return null;

    // Check for repeated errors
    const errorCounts = {};
    for (const error of recentErrors) {
      const key = `${error.code}:${error.category}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    }

    // Find most common error
    const mostCommon = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])[0];

    if (mostCommon && mostCommon[1] >= 5) {
      return {
        type: 'REPEATED_ERROR',
        description: `Same error occurred ${mostCommon[1]} times`,
        errorKey: mostCommon[0],
        count: mostCommon[1],
        percentage: (mostCommon[1] / recentErrors.length * 100).toFixed(2)
      };
    }

    // Check for cascading failures
    const categories = recentErrors.map(e => e.category);
    const uniqueCategories = [...new Set(categories)];

    if (uniqueCategories.length >= 3 && recentErrors.length >= 10) {
      return {
        type: 'CASCADING_FAILURE',
        description: 'Multiple error categories detected',
        categories: uniqueCategories,
        errorCount: recentErrors.length
      };
    }

    return null;
  }

  /**
   * Get recent errors
   */
  getRecentErrors(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.errors.filter(e => e.timestamp > cutoff);
  }

  /**
   * Should trigger alert for this error
   */
  async shouldAlert(error) {
    // Always alert for critical errors
    if (error.severity === SEVERITY_LEVELS.CRITICAL) {
      return true;
    }

    // Check recent error rate
    const recentErrors = this.getRecentErrors(60000); // Last minute
    const severeErrors = recentErrors.filter(e =>
      SEVERITY_WEIGHTS[e.severity] >= SEVERITY_WEIGHTS[SEVERITY_LEVELS.HIGH]
    );

    return severeErrors.length >= 5;
  }

  /**
   * Start periodic cleanup
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.collectionInterval);
  }

  /**
   * Cleanup old data
   */
  cleanup() {
    const cutoff = Date.now() - this.config.retentionPeriod;

    // Clean errors
    const initialLength = this.errors.length;
    this.errors = this.errors.filter(e => e.timestamp > cutoff);
    const removed = initialLength - this.errors.length;

    if (removed > 0) {
      console.log(`Cleaned up ${removed} old error records`);
    }

    // Clean alerts
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);

    // Clean alert history (keep longer)
    const historyCutoff = Date.now() - (this.config.retentionPeriod * 7); // 7 days
    this.alertHistory = this.alertHistory.filter(a => a.timestamp > historyCutoff);
  }

  /**
   * Start aggregation
   */
  startAggregation() {
    // Aggregate every minute
    this.aggregationIntervals.set('minute', setInterval(() => {
      this.aggregateMetrics('minute', 60000);
    }, 60000));

    // Aggregate every hour
    this.aggregationIntervals.set('hour', setInterval(() => {
      this.aggregateMetrics('hour', 3600000);
    }, 3600000));

    // Aggregate every day
    this.aggregationIntervals.set('day', setInterval(() => {
      this.aggregateMetrics('day', 86400000);
    }, 86400000));
  }

  /**
   * Aggregate metrics for a time window
   */
  aggregateMetrics(window, duration) {
    const errors = this.getRecentErrors(duration);

    const aggregated = {
      window,
      timestamp: Date.now(),
      total: errors.length,
      byCategory: {},
      bySeverity: {},
      avgResponseTime: 0,
      errorRate: errors.length / (duration / 60000), // per minute
      topErrors: []
    };

    // Aggregate by category
    for (const error of errors) {
      if (!aggregated.byCategory[error.category]) {
        aggregated.byCategory[error.category] = 0;
      }
      aggregated.byCategory[error.category]++;

      if (!aggregated.bySeverity[error.severity]) {
        aggregated.bySeverity[error.severity] = 0;
      }
      aggregated.bySeverity[error.severity]++;
    }

    // Find top errors
    const errorCounts = {};
    for (const error of errors) {
      const key = error.code;
      if (!errorCounts[key]) {
        errorCounts[key] = { code: key, count: 0, message: error.error.message };
      }
      errorCounts[key].count++;
    }

    aggregated.topErrors = Object.values(errorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    console.log(`Aggregated metrics for ${window}:`, aggregated);
    return aggregated;
  }

  /**
   * Generate error ID
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize error for storage
   */
  sanitizeError(error) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      category: error.category,
      severity: error.severity,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }

  /**
   * Sanitize context
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const now = Date.now();

    return {
      total: this.metrics.total,
      last24Hours: this.getRecentErrors(86400000).length,
      lastHour: this.getRecentErrors(3600000).length,
      last5Minutes: this.getRecentErrors(300000).length,
      byCategory: this.metrics.byCategory,
      bySeverity: this.metrics.bySeverity,
      topErrors: this.getTopErrors(),
      errorRate: this.calculateErrorRate(),
      activeAlerts: this.alerts.length,
      healthScore: this.calculateHealthScore()
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeAlerts: this.alerts.length,
      alertHistory: this.alertHistory.length,
      errorBuffer: this.errors.length,
      oldestError: this.errors[0]?.timestamp,
      newestError: this.errors[this.errors.length - 1]?.timestamp
    };
  }

  /**
   * Get top errors
   */
  getTopErrors(limit = 10) {
    const errorCounts = {};

    for (const error of this.errors) {
      const key = error.code;
      if (!errorCounts[key]) {
        errorCounts[key] = {
          code: key,
          message: error.error.message,
          category: error.category,
          severity: error.severity,
          count: 0,
          lastOccurred: error.timestamp
        };
      }
      errorCounts[key].count++;
      errorCounts[key].lastOccurred = Math.max(errorCounts[key].lastOccurred, error.timestamp);
    }

    return Object.values(errorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    const windows = [
      { name: '1min', duration: 60000 },
      { name: '5min', duration: 300000 },
      { name: '1hour', duration: 3600000 }
    ];

    const rates = {};

    for (const window of windows) {
      const errors = this.getRecentErrors(window.duration);
      rates[window.name] = (errors.length / (window.duration / 60000)).toFixed(2);
    }

    return rates;
  }

  /**
   * Calculate health score
   */
  calculateHealthScore() {
    const recentErrors = this.getRecentErrors(300000); // Last 5 minutes

    if (recentErrors.length === 0) return 100;

    let score = 100;

    // Deduct for error count
    score -= Math.min(recentErrors.length * 2, 30);

    // Deduct for severity
    const criticalErrors = recentErrors.filter(e => e.severity === SEVERITY_LEVELS.CRITICAL);
    const highErrors = recentErrors.filter(e => e.severity === SEVERITY_LEVELS.HIGH);

    score -= criticalErrors.length * 10;
    score -= highErrors.length * 5;

    // Deduct for active alerts
    score -= this.alerts.length * 5;

    return Math.max(0, score);
  }

  /**
   * Get error details
   */
  getErrorDetails(errorId) {
    return this.errors.find(e => e.id === errorId);
  }

  /**
   * Get errors by filter
   */
  getErrors(filter = {}) {
    let filtered = [...this.errors];

    if (filter.category) {
      filtered = filtered.filter(e => e.category === filter.category);
    }

    if (filter.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }

    if (filter.code) {
      filtered = filtered.filter(e => e.code === filter.code);
    }

    if (filter.startTime) {
      filtered = filtered.filter(e => e.timestamp >= filter.startTime);
    }

    if (filter.endTime) {
      filtered = filtered.filter(e => e.timestamp <= filter.endTime);
    }

    if (filter.correlationId) {
      filtered = filtered.filter(e => e.correlationId === filter.correlationId);
    }

    return filtered;
  }

  /**
   * Export errors for analysis
   */
  exportErrors(format = 'json') {
    const data = {
      exported: new Date().toISOString(),
      errors: this.errors,
      metrics: this.metrics,
      statistics: this.getStatistics()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // Add other formats as needed (CSV, etc.)
    return data;
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: 'healthy',
      errorCount: this.errors.length,
      alertCount: this.alerts.length,
      healthScore: this.calculateHealthScore(),
      lastError: this.errors[this.errors.length - 1]?.timestamp
    };
  }

  /**
   * Shutdown monitor
   */
  async shutdown() {
    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const interval of this.aggregationIntervals.values()) {
      clearInterval(interval);
    }

    console.log('Error Monitor shutdown complete');
  }
}

module.exports = ErrorMonitor;