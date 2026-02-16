/**
 * Error Recovery System
 * Implements various recovery strategies including retry, circuit breaker, and fallback
 */

const {
  RETRY_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
  CIRCUIT_STATES,
  RECOVERY_STRATEGIES,
  FALLBACK_CONFIG
} = require('./error-constants');

class ErrorRecovery {
  constructor() {
    this.circuitBreakers = new Map();
    this.retryQueues = new Map();
    this.fallbackCache = new Map();
    this.recoveryMetrics = {
      attempts: 0,
      successes: 0,
      failures: 0,
      byStrategy: {}
    };
  }

  /**
   * Initialize recovery system
   */
  async initialize(config = {}) {
    this.config = {
      enableRetry: config.enableRetry !== false,
      enableCircuitBreaker: config.enableCircuitBreaker !== false,
      enableFallback: config.enableFallback !== false,
      enableCache: config.enableCache !== false,
      retryConfig: { ...RETRY_CONFIG.DEFAULT, ...config.retryConfig },
      circuitConfig: { ...CIRCUIT_BREAKER_CONFIG.DEFAULT, ...config.circuitConfig },
      fallbackConfig: { ...FALLBACK_CONFIG, ...config.fallbackConfig },
      ...config
    };

    console.log('Error Recovery System initialized');
  }

  /**
   * Main recovery method
   */
  async recover(error, strategy, context = {}) {
    this.recoveryMetrics.attempts++;

    try {
      let result;

      switch (strategy) {
        case RECOVERY_STRATEGIES.RETRY:
          result = await this.retryWithBackoff(error, context);
          break;

        case RECOVERY_STRATEGIES.CIRCUIT_BREAK:
          result = await this.applyCircuitBreaker(error, context);
          break;

        case RECOVERY_STRATEGIES.FALLBACK:
          result = await this.applyFallback(error, context);
          break;

        case RECOVERY_STRATEGIES.CACHE:
          result = await this.getCachedFallback(error, context);
          break;

        case RECOVERY_STRATEGIES.DEGRADE:
          result = await this.degradeGracefully(error, context);
          break;

        case RECOVERY_STRATEGIES.QUEUE:
          result = await this.queueForRetry(error, context);
          break;

        case RECOVERY_STRATEGIES.IGNORE:
          result = this.ignoreError(error, context);
          break;

        case RECOVERY_STRATEGIES.FAIL_FAST:
        default:
          result = this.failFast(error, context);
      }

      if (result.success) {
        this.recoveryMetrics.successes++;
        this.recordStrategyMetric(strategy, 'success');
      } else {
        this.recoveryMetrics.failures++;
        this.recordStrategyMetric(strategy, 'failure');
      }

      return result;

    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.recoveryMetrics.failures++;
      return {
        success: false,
        strategy,
        error: recoveryError,
        originalError: error
      };
    }
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff(error, context) {
    if (!this.config.enableRetry) {
      return { success: false, reason: 'Retry disabled' };
    }

    const operation = context.operation;
    if (!operation || typeof operation !== 'function') {
      return { success: false, reason: 'No retryable operation provided' };
    }

    const config = this.getRetryConfig(error, context);
    let lastError = error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        // Calculate delay with jitter
        const delay = this.calculateBackoffDelay(attempt, config);

        console.log(`Retry attempt ${attempt}/${config.maxAttempts} after ${delay}ms`);

        // Wait before retry
        await this.sleep(delay);

        // Execute operation
        const result = await operation();

        return {
          success: true,
          strategy: RECOVERY_STRATEGIES.RETRY,
          attempts: attempt,
          result
        };

      } catch (retryError) {
        lastError = retryError;

        // Check if error is retryable
        if (!this.isRetryable(retryError)) {
          return {
            success: false,
            strategy: RECOVERY_STRATEGIES.RETRY,
            attempts: attempt,
            error: retryError,
            reason: 'Non-retryable error'
          };
        }
      }
    }

    return {
      success: false,
      strategy: RECOVERY_STRATEGIES.RETRY,
      attempts: config.maxAttempts,
      error: lastError,
      reason: 'Max attempts reached'
    };
  }

  /**
   * Apply circuit breaker pattern
   */
  async applyCircuitBreaker(error, context) {
    if (!this.config.enableCircuitBreaker) {
      return { success: false, reason: 'Circuit breaker disabled' };
    }

    const key = context.circuitKey || context.operation?.name || 'default';
    let breaker = this.circuitBreakers.get(key);

    if (!breaker) {
      breaker = new CircuitBreaker(key, this.config.circuitConfig);
      this.circuitBreakers.set(key, breaker);
    }

    // Check circuit state
    const state = breaker.getState();

    if (state === CIRCUIT_STATES.OPEN) {
      return {
        success: false,
        strategy: RECOVERY_STRATEGIES.CIRCUIT_BREAK,
        state: CIRCUIT_STATES.OPEN,
        reason: 'Circuit is open',
        retryAfter: breaker.getRetryAfter()
      };
    }

    // Try operation
    try {
      const operation = context.operation;
      if (!operation) {
        throw new Error('No operation provided for circuit breaker');
      }

      const result = await operation();

      // Record success
      breaker.recordSuccess();

      return {
        success: true,
        strategy: RECOVERY_STRATEGIES.CIRCUIT_BREAK,
        state: breaker.getState(),
        result
      };

    } catch (operationError) {
      // Record failure
      breaker.recordFailure();

      // Check if circuit should open
      if (breaker.shouldOpen()) {
        breaker.open();
        console.log(`Circuit breaker opened for: ${key}`);
      }

      return {
        success: false,
        strategy: RECOVERY_STRATEGIES.CIRCUIT_BREAK,
        state: breaker.getState(),
        error: operationError
      };
    }
  }

  /**
   * Apply fallback mechanism
   */
  async applyFallback(error, context) {
    if (!this.config.enableFallback) {
      return { success: false, reason: 'Fallback disabled' };
    }

    const fallback = context.fallback || this.config.defaultFallback;

    if (!fallback) {
      return { success: false, reason: 'No fallback provided' };
    }

    try {
      const result = typeof fallback === 'function'
        ? await fallback(error, context)
        : fallback;

      return {
        success: true,
        strategy: RECOVERY_STRATEGIES.FALLBACK,
        fallbackUsed: true,
        result
      };

    } catch (fallbackError) {
      return {
        success: false,
        strategy: RECOVERY_STRATEGIES.FALLBACK,
        error: fallbackError,
        originalError: error
      };
    }
  }

  /**
   * Get cached fallback value
   */
  async getCachedFallback(error, context) {
    if (!this.config.enableCache) {
      return { success: false, reason: 'Cache disabled' };
    }

    const cacheKey = context.cacheKey || this.generateCacheKey(context);
    const cached = this.fallbackCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      return {
        success: true,
        strategy: RECOVERY_STRATEGIES.CACHE,
        fromCache: true,
        result: cached.value,
        cachedAt: cached.timestamp
      };
    }

    // Try to get fresh value
    if (context.operation) {
      try {
        const result = await context.operation();

        // Cache the result
        this.fallbackCache.set(cacheKey, {
          value: result,
          timestamp: Date.now(),
          ttl: this.config.fallbackConfig.CACHE.maxAge
        });

        return {
          success: true,
          strategy: RECOVERY_STRATEGIES.CACHE,
          fromCache: false,
          result
        };

      } catch (operationError) {
        // Return stale cache if available
        if (cached) {
          return {
            success: true,
            strategy: RECOVERY_STRATEGIES.CACHE,
            fromCache: true,
            stale: true,
            result: cached.value,
            cachedAt: cached.timestamp
          };
        }

        return {
          success: false,
          strategy: RECOVERY_STRATEGIES.CACHE,
          error: operationError
        };
      }
    }

    return {
      success: false,
      strategy: RECOVERY_STRATEGIES.CACHE,
      reason: 'No cached value available'
    };
  }

  /**
   * Degrade service gracefully
   */
  async degradeGracefully(error, context) {
    const degradedOperation = context.degradedOperation;

    if (!degradedOperation) {
      return { success: false, reason: 'No degraded operation provided' };
    }

    try {
      const result = await degradedOperation();

      return {
        success: true,
        strategy: RECOVERY_STRATEGIES.DEGRADE,
        degraded: true,
        result
      };

    } catch (degradedError) {
      return {
        success: false,
        strategy: RECOVERY_STRATEGIES.DEGRADE,
        error: degradedError,
        originalError: error
      };
    }
  }

  /**
   * Queue operation for later retry
   */
  async queueForRetry(error, context) {
    const queueName = context.queueName || 'default';
    let queue = this.retryQueues.get(queueName);

    if (!queue) {
      queue = new RetryQueue(queueName);
      this.retryQueues.set(queueName, queue);
    }

    const item = {
      error,
      context,
      operation: context.operation,
      timestamp: Date.now(),
      attempts: 0
    };

    queue.add(item);

    // Start processing if not already running
    if (!queue.isProcessing()) {
      this.processRetryQueue(queue);
    }

    return {
      success: true,
      strategy: RECOVERY_STRATEGIES.QUEUE,
      queued: true,
      queueName,
      position: queue.size()
    };
  }

  /**
   * Process retry queue
   */
  async processRetryQueue(queue) {
    queue.startProcessing();

    while (queue.hasItems()) {
      const item = queue.next();
      if (!item) break;

      try {
        // Wait before processing
        await this.sleep(1000);

        // Try operation
        const result = await item.operation();

        console.log(`Retry queue success for item from ${new Date(item.timestamp).toISOString()}`);

      } catch (error) {
        item.attempts++;

        // Re-queue if under max attempts
        if (item.attempts < 3) {
          queue.add(item);
        } else {
          console.error(`Retry queue failed after ${item.attempts} attempts:`, error);
        }
      }
    }

    queue.stopProcessing();
  }

  /**
   * Ignore error (log and continue)
   */
  ignoreError(error, context) {
    console.log(`Ignoring error: ${error.message}`);

    return {
      success: true,
      strategy: RECOVERY_STRATEGIES.IGNORE,
      ignored: true
    };
  }

  /**
   * Fail fast (no recovery)
   */
  failFast(error, context) {
    return {
      success: false,
      strategy: RECOVERY_STRATEGIES.FAIL_FAST,
      error,
      reason: 'Fail fast strategy - no recovery attempted'
    };
  }

  /**
   * Calculate backoff delay with jitter
   */
  calculateBackoffDelay(attempt, config) {
    const baseDelay = Math.min(
      config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelay
    );

    // Add jitter
    const [minJitter, maxJitter] = config.jitterRange;
    const jitter = minJitter + Math.random() * (maxJitter - minJitter);

    return Math.floor(baseDelay * jitter);
  }

  /**
   * Get retry configuration for error type
   */
  getRetryConfig(error, context) {
    const customConfig = context.retryConfig;
    if (customConfig) return customConfig;

    const category = error.category;
    const configMap = {
      'NETWORK_ERROR': RETRY_CONFIG.NETWORK,
      'DATABASE_ERROR': RETRY_CONFIG.DATABASE,
      'QUEUE_ERROR': RETRY_CONFIG.QUEUE
    };

    return configMap[category] || this.config.retryConfig;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error) {
    // Check for explicit non-retryable flag
    if (error.retryable === false) return false;

    // Check for specific error codes
    const nonRetryableCodes = ['INVALID_INPUT', 'UNAUTHORIZED', 'FORBIDDEN'];
    if (nonRetryableCodes.includes(error.code)) return false;

    return true;
  }

  /**
   * Generate cache key
   */
  generateCacheKey(context) {
    const parts = [
      context.operation?.name || 'unknown',
      context.userId || 'anonymous',
      JSON.stringify(context.params || {})
    ];

    return parts.join(':');
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(cached) {
    const now = Date.now();
    const age = now - cached.timestamp;

    return age < (cached.ttl || this.config.fallbackConfig.CACHE.maxAge);
  }

  /**
   * Record strategy metrics
   */
  recordStrategyMetric(strategy, result) {
    if (!this.recoveryMetrics.byStrategy[strategy]) {
      this.recoveryMetrics.byStrategy[strategy] = {
        attempts: 0,
        successes: 0,
        failures: 0
      };
    }

    this.recoveryMetrics.byStrategy[strategy].attempts++;

    if (result === 'success') {
      this.recoveryMetrics.byStrategy[strategy].successes++;
    } else {
      this.recoveryMetrics.byStrategy[strategy].failures++;
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery metrics
   */
  getMetrics() {
    return {
      ...this.recoveryMetrics,
      successRate: this.recoveryMetrics.attempts > 0
        ? (this.recoveryMetrics.successes / this.recoveryMetrics.attempts * 100).toFixed(2) + '%'
        : '0%',
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([key, breaker]) => ({
        key,
        state: breaker.getState(),
        failures: breaker.failures,
        successes: breaker.successes
      })),
      retryQueues: Array.from(this.retryQueues.entries()).map(([name, queue]) => ({
        name,
        size: queue.size(),
        processing: queue.isProcessing()
      })),
      cacheSize: this.fallbackCache.size
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: 'healthy',
      metrics: this.getMetrics()
    };
  }

  /**
   * Shutdown recovery system
   */
  async shutdown() {
    // Clear all queues
    for (const queue of this.retryQueues.values()) {
      queue.clear();
    }

    // Close all circuit breakers
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }

    // Clear cache
    this.fallbackCache.clear();

    console.log('Error Recovery System shutdown complete');
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.state = CIRCUIT_STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.openedAt = null;
  }

  getState() {
    // Check if should transition from OPEN to HALF_OPEN
    if (this.state === CIRCUIT_STATES.OPEN) {
      const now = Date.now();
      if (now - this.openedAt > this.config.timeout) {
        this.state = CIRCUIT_STATES.HALF_OPEN;
      }
    }

    return this.state;
  }

  recordSuccess() {
    this.successes++;

    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.close();
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.open();
    }
  }

  shouldOpen() {
    return this.failures >= this.config.threshold;
  }

  open() {
    this.state = CIRCUIT_STATES.OPEN;
    this.openedAt = Date.now();
  }

  close() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failures = 0;
    this.openedAt = null;
  }

  reset() {
    this.close();
    this.successes = 0;
  }

  getRetryAfter() {
    if (this.state !== CIRCUIT_STATES.OPEN) return 0;

    const elapsed = Date.now() - this.openedAt;
    const remaining = this.config.timeout - elapsed;

    return Math.max(0, remaining);
  }
}

/**
 * Retry Queue implementation
 */
class RetryQueue {
  constructor(name) {
    this.name = name;
    this.items = [];
    this.processing = false;
  }

  add(item) {
    this.items.push(item);
  }

  next() {
    return this.items.shift();
  }

  hasItems() {
    return this.items.length > 0;
  }

  size() {
    return this.items.length;
  }

  clear() {
    this.items = [];
  }

  isProcessing() {
    return this.processing;
  }

  startProcessing() {
    this.processing = true;
  }

  stopProcessing() {
    this.processing = false;
  }
}

module.exports = ErrorRecovery;