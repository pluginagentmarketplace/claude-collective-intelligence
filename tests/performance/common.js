/**
 * Common utilities for K6 performance tests
 * Shared functions, helpers, and configuration
 */

/**
 * Convert duration string to milliseconds
 * @param {string} durationStr - Duration string like "2m", "30s", "100ms"
 * @returns {number} Duration in milliseconds
 */
export function parseDuration(durationStr) {
  const match = durationStr.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) throw new Error(`Invalid duration: ${durationStr}`);

  const [, value, unit] = match;
  const multipliers = {
    'ms': 1,
    's': 1000,
    'm': 60000,
    'h': 3600000
  };

  return parseInt(value) * multipliers[unit];
}

/**
 * Sleep for specified duration
 * @param {number} ms - Milliseconds to sleep
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate percentile from array
 * @param {number[]} values - Sorted array of values
 * @param {number} percentile - Percentile (0-100)
 * @returns {number} Percentile value
 */
export function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.max(0, index)];
}

/**
 * Calculate statistics from array of numbers
 * @param {number[]} values - Array of numeric values
 * @returns {object} Statistics object
 */
export function calculateStats(values) {
  if (values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      avg: 0,
      median: 0,
      p95: 0,
      p99: 0
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: avg,
    median: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99)
  };
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxAttempts - Maximum retry attempts
 * @param {number} initialDelay - Initial delay in ms
 * @returns {Promise} Result of function
 */
export async function retryWithBackoff(fn, maxAttempts = 3, initialDelay = 100) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Generate random request ID
 * @returns {string} Unique request ID
 */
export function generateRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate random agent ID
 * @returns {string} Unique agent ID
 */
export function generateAgentId() {
  return `agent-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate random task ID
 * @returns {string} Unique task ID
 */
export function generateTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check HTTP response status
 * @param {Response} response - K6 HTTP response
 * @param {number[]} expectedStatus - Expected status codes
 * @returns {boolean} True if status matches
 */
export function checkStatus(response, expectedStatus = [200, 201, 202]) {
  return expectedStatus.includes(response.status);
}

/**
 * Extract error code from response
 * @param {Response} response - K6 HTTP response
 * @returns {string} Error code or 'unknown'
 */
export function getErrorCode(response) {
  try {
    const body = response.json();
    return body.code || body.error || `HTTP${response.status}`;
  } catch {
    return `HTTP${response.status}`;
  }
}

/**
 * Performance target definitions
 */
export const performanceTargets = {
  responseTime: {
    p50: 100,      // ms
    p95: 500,      // ms (critical)
    p99: 2000,     // ms
    max: 5000      // ms
  },
  throughput: {
    minimum: 1000,  // req/sec
    target: 2000,   // req/sec
    peak: 5000      // req/sec
  },
  errorRate: {
    normal: 0.001,  // 0.1%
    high: 0.01,     // 1%
    spike: 0.05     // 5%
  },
  resources: {
    memoryPerWorker: 500,  // MB
    cpuUsage: 80,          // %
    dbConnections: 80,     // % of pool
    rabbitmqLatency: 100   // ms
  }
};

/**
 * Test phase definitions
 */
export const testPhases = {
  WARMUP: 'warmup',
  NORMAL: 'normal',
  SPIKE: 'spike',
  RECOVERY: 'recovery',
  SOAK: 'soak',
  COOLDOWN: 'cooldown'
};

/**
 * Generate payload for agent task
 * @param {object} options - Custom options
 * @returns {object} Task payload
 */
export function generateTaskPayload(options = {}) {
  return {
    taskId: generateTaskId(),
    agentId: options.agentId || generateAgentId(),
    type: options.type || 'general',
    priority: options.priority || Math.floor(Math.random() * 5) + 1,
    timestamp: new Date().toISOString(),
    data: options.data || {},
    ...options
  };
}

/**
 * Generate payload for voting
 * @param {object} options - Custom options
 * @returns {object} Vote payload
 */
export function generateVotePayload(options = {}) {
  return {
    proposalId: options.proposalId || `proposal-${Date.now()}`,
    agentId: options.agentId || generateAgentId(),
    vote: options.vote || (Math.random() > 0.5 ? 'yes' : 'no'),
    confidence: options.confidence || Math.random() * 100,
    timestamp: new Date().toISOString(),
    ...options
  };
}

/**
 * Format bytes to human readable
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * Format duration to human readable
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted string
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Log with timestamp
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warn, error, debug)
 */
export function logWithTimestamp(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    'info': 'ℹ️',
    'warn': '⚠️',
    'error': '❌',
    'debug': '🔍',
    'success': '✅'
  }[level] || '→';

  console.log(`${prefix} [${timestamp}] ${message}`);
}

/**
 * Parse environment configuration
 * @returns {object} Configuration object
 */
export function getConfig() {
  return {
    baseUrl: __ENV.API_BASE_URL || 'http://localhost:3000',
    verbose: __ENV.VERBOSE === 'true',
    testEnv: __ENV.TEST_ENV || 'development',
    duration: __ENV.DURATION || '15m',
    timeout: parseInt(__ENV.TIMEOUT || '30000'),
    maxRetries: parseInt(__ENV.MAX_RETRIES || '3'),
    enableMetrics: __ENV.ENABLE_METRICS !== 'false',
    enableLogging: __ENV.ENABLE_LOGGING !== 'false'
  };
}

export default {
  parseDuration,
  sleep,
  calculatePercentile,
  calculateStats,
  retryWithBackoff,
  generateRequestId,
  generateAgentId,
  generateTaskId,
  checkStatus,
  getErrorCode,
  performanceTargets,
  testPhases,
  generateTaskPayload,
  generateVotePayload,
  formatBytes,
  formatDuration,
  logWithTimestamp,
  getConfig
};
