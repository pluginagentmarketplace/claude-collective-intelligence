/**
 * Log Query and Analysis Examples
 * Demonstrates how to query, analyze, and monitor logs
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Log Query Helper Class
 */
class LogQueryHelper {
  constructor(logDir = './logs') {
    this.logDir = logDir;
  }

  /**
   * Query logs by correlation ID
   */
  async findByCorrelationId(correlationId, logFile = 'combined.log') {
    const logPath = path.join(this.logDir, logFile);
    const results = [];

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        if (log.correlationId === correlationId) {
          results.push(log);
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    return results;
  }

  /**
   * Find all errors within a time range
   */
  async findErrorsInTimeRange(startTime, endTime, logFile = 'error.log') {
    const logPath = path.join(this.logDir, logFile);
    const results = [];

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        const logTime = new Date(log.timestamp).getTime();

        if (logTime >= startMs && logTime <= endMs && log.level === 'error') {
          results.push(log);
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    return results;
  }

  /**
   * Analyze performance metrics
   */
  async analyzePerformance(operation, logFile = 'performance.log') {
    const logPath = path.join(this.logDir, logFile);
    const metrics = [];

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        if (log.operation === operation && log.duration) {
          metrics.push(log.duration);
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    if (metrics.length === 0) {
      return null;
    }

    // Calculate statistics
    const sorted = metrics.sort((a, b) => a - b);
    const sum = metrics.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / metrics.length,
      median: sorted[Math.floor(metrics.length / 2)],
      p95: sorted[Math.floor(metrics.length * 0.95)],
      p99: sorted[Math.floor(metrics.length * 0.99)]
    };
  }

  /**
   * Count errors by type
   */
  async countErrorsByType(logFile = 'error.log') {
    const logPath = path.join(this.logDir, logFile);
    const errorCounts = {};

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        if (log.error && log.error.type) {
          const errorType = log.error.type;
          errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    return errorCounts;
  }

  /**
   * Find slow queries
   */
  async findSlowQueries(threshold = 100, logFile = 'combined.log') {
    const logPath = path.join(this.logDir, logFile);
    const slowQueries = [];

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        if (log.module === 'database' && log.duration > threshold) {
          slowQueries.push({
            query: log.query,
            duration: log.duration,
            timestamp: log.timestamp
          });
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    return slowQueries.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Track user activity
   */
  async getUserActivity(userId, logFile = 'combined.log') {
    const logPath = path.join(this.logDir, logFile);
    const activities = [];

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        if (log.userId === userId) {
          activities.push({
            timestamp: log.timestamp,
            action: log.message,
            module: log.module,
            metadata: log
          });
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    return activities.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Monitor agent performance
   */
  async getAgentMetrics(agentId, logFile = 'combined.log') {
    const logPath = path.join(this.logDir, logFile);
    const tasks = [];

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        if (log.agentId === agentId && log.message.includes('task completed')) {
          tasks.push({
            taskId: log.taskId,
            duration: log.duration,
            success: log.result === 'success',
            timestamp: log.timestamp
          });
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    const successCount = tasks.filter(t => t.success).length;
    const durations = tasks.map(t => t.duration).filter(d => d);

    return {
      agentId,
      totalTasks: tasks.length,
      successCount,
      failureCount: tasks.length - successCount,
      successRate: (successCount / tasks.length) * 100,
      avgDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      tasks
    };
  }

  /**
   * Detect error patterns
   */
  async detectErrorPatterns(windowMinutes = 5, threshold = 10) {
    const errors = await this.findErrorsInTimeRange(
      new Date(Date.now() - windowMinutes * 60 * 1000),
      new Date()
    );

    const errorPatterns = {};

    errors.forEach(error => {
      const key = `${error.module}-${error.error?.type || 'unknown'}`;
      if (!errorPatterns[key]) {
        errorPatterns[key] = {
          pattern: key,
          count: 0,
          firstSeen: error.timestamp,
          lastSeen: error.timestamp,
          examples: []
        };
      }

      errorPatterns[key].count++;
      errorPatterns[key].lastSeen = error.timestamp;

      if (errorPatterns[key].examples.length < 3) {
        errorPatterns[key].examples.push(error);
      }
    });

    // Find patterns exceeding threshold
    const alerts = Object.values(errorPatterns)
      .filter(pattern => pattern.count >= threshold)
      .sort((a, b) => b.count - a.count);

    return {
      totalErrors: errors.length,
      uniquePatterns: Object.keys(errorPatterns).length,
      alerts
    };
  }

  /**
   * Generate daily summary report
   */
  async generateDailySummary(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const errors = await this.findErrorsInTimeRange(startOfDay, endOfDay);
    const errorTypes = await this.countErrorsByType();

    // Read all logs for the day
    const allLogs = [];
    const logPath = path.join(this.logDir, 'combined.log');

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      try {
        const log = JSON.parse(line);
        const logTime = new Date(log.timestamp).getTime();
        if (logTime >= startOfDay.getTime() && logTime <= endOfDay.getTime()) {
          allLogs.push(log);
        }
      } catch (e) {
        // Skip non-JSON lines
      }
    }

    // Analyze logs by level
    const levelCounts = {};
    const moduleCounts = {};

    allLogs.forEach(log => {
      levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
      if (log.module) {
        moduleCounts[log.module] = (moduleCounts[log.module] || 0) + 1;
      }
    });

    return {
      date: date.toISOString().split('T')[0],
      summary: {
        totalLogs: allLogs.length,
        errors: errors.length,
        warnings: levelCounts.warn || 0,
        info: levelCounts.info || 0,
        debug: levelCounts.debug || 0
      },
      errorTypes,
      topModules: Object.entries(moduleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([module, count]) => ({ module, count })),
      hourlyDistribution: this.getHourlyDistribution(allLogs)
    };
  }

  /**
   * Get hourly distribution of logs
   */
  getHourlyDistribution(logs) {
    const hourly = Array(24).fill(0);

    logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourly[hour]++;
    });

    return hourly.map((count, hour) => ({
      hour: `${hour}:00`,
      count
    }));
  }
}

/**
 * Real-time Log Monitor
 */
class LogMonitor {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    this.watchers = new Map();
  }

  /**
   * Watch a log file for new entries
   */
  watchLog(logFile, callback) {
    const logPath = path.join(this.logDir, logFile);

    // Track file position
    let fileSize = fs.statSync(logPath).size;

    const watcher = fs.watch(logPath, (eventType) => {
      if (eventType === 'change') {
        const newSize = fs.statSync(logPath).size;

        if (newSize > fileSize) {
          // Read new content
          const stream = fs.createReadStream(logPath, {
            start: fileSize,
            end: newSize
          });

          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');

            // Process complete lines
            for (let i = 0; i < lines.length - 1; i++) {
              if (lines[i]) {
                try {
                  const log = JSON.parse(lines[i]);
                  callback(log);
                } catch (e) {
                  // Skip non-JSON lines
                }
              }
            }

            // Keep incomplete line in buffer
            buffer = lines[lines.length - 1];
          });

          fileSize = newSize;
        }
      }
    });

    this.watchers.set(logFile, watcher);
    return watcher;
  }

  /**
   * Monitor for errors in real-time
   */
  monitorErrors(callback) {
    return this.watchLog('error.log', (log) => {
      if (log.level === 'error') {
        callback({
          timestamp: log.timestamp,
          module: log.module,
          message: log.message,
          error: log.error
        });
      }
    });
  }

  /**
   * Monitor performance metrics
   */
  monitorPerformance(threshold = 1000, callback) {
    return this.watchLog('performance.log', (log) => {
      if (log.duration && log.duration > threshold) {
        callback({
          timestamp: log.timestamp,
          operation: log.operation,
          duration: log.duration,
          slow: true
        });
      }
    });
  }

  /**
   * Stop watching a specific log
   */
  stopWatching(logFile) {
    const watcher = this.watchers.get(logFile);
    if (watcher) {
      watcher.close();
      this.watchers.delete(logFile);
    }
  }

  /**
   * Stop all watchers
   */
  stopAll() {
    for (const [file, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

/**
 * Example usage and demonstrations
 */
async function runExamples() {
  const queryHelper = new LogQueryHelper('./logs');
  const monitor = new LogMonitor('./logs');

  console.log('=== Log Query Examples ===\n');

  // 1. Find logs by correlation ID
  console.log('1. Finding logs by correlation ID...');
  const correlationLogs = await queryHelper.findByCorrelationId('abc-123-def');
  console.log(`Found ${correlationLogs.length} logs with correlation ID\n`);

  // 2. Find errors in last hour
  console.log('2. Finding errors in last hour...');
  const recentErrors = await queryHelper.findErrorsInTimeRange(
    new Date(Date.now() - 3600000),
    new Date()
  );
  console.log(`Found ${recentErrors.length} errors\n`);

  // 3. Analyze performance metrics
  console.log('3. Analyzing performance for "createAgentTask"...');
  const perfStats = await queryHelper.analyzePerformance('createAgentTask');
  if (perfStats) {
    console.log('Performance Statistics:');
    console.log(`  Count: ${perfStats.count}`);
    console.log(`  Average: ${perfStats.avg.toFixed(2)}ms`);
    console.log(`  P95: ${perfStats.p95}ms`);
    console.log(`  P99: ${perfStats.p99}ms\n`);
  }

  // 4. Count errors by type
  console.log('4. Counting errors by type...');
  const errorCounts = await queryHelper.countErrorsByType();
  console.log('Error counts:', errorCounts, '\n');

  // 5. Find slow queries
  console.log('5. Finding slow queries (>100ms)...');
  const slowQueries = await queryHelper.findSlowQueries(100);
  console.log(`Found ${slowQueries.length} slow queries\n`);

  // 6. Get agent metrics
  console.log('6. Getting agent metrics...');
  const agentMetrics = await queryHelper.getAgentMetrics('research-agent-1');
  console.log('Agent Metrics:');
  console.log(`  Total Tasks: ${agentMetrics.totalTasks}`);
  console.log(`  Success Rate: ${agentMetrics.successRate.toFixed(2)}%`);
  console.log(`  Avg Duration: ${agentMetrics.avgDuration.toFixed(2)}ms\n`);

  // 7. Detect error patterns
  console.log('7. Detecting error patterns...');
  const patterns = await queryHelper.detectErrorPatterns(5, 3);
  console.log(`Found ${patterns.alerts.length} error patterns exceeding threshold\n`);

  // 8. Generate daily summary
  console.log('8. Generating daily summary...');
  const summary = await queryHelper.generateDailySummary();
  console.log('Daily Summary:');
  console.log(`  Date: ${summary.date}`);
  console.log(`  Total Logs: ${summary.summary.totalLogs}`);
  console.log(`  Errors: ${summary.summary.errors}`);
  console.log(`  Top Modules: ${summary.topModules.map(m => m.module).join(', ')}\n`);

  // 9. Real-time monitoring
  console.log('9. Starting real-time monitoring...');

  // Monitor errors
  monitor.monitorErrors((error) => {
    console.log(`[ERROR ALERT] ${error.timestamp}: ${error.message}`);
  });

  // Monitor slow operations
  monitor.monitorPerformance(1000, (perf) => {
    console.log(`[SLOW OPERATION] ${perf.operation} took ${perf.duration}ms`);
  });

  console.log('Monitoring started. Press Ctrl+C to stop.\n');

  // Keep monitoring for 10 seconds then stop
  setTimeout(() => {
    monitor.stopAll();
    console.log('Monitoring stopped.');
  }, 10000);
}

// Export utilities
module.exports = {
  LogQueryHelper,
  LogMonitor,
  runExamples
};

// Run examples if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}