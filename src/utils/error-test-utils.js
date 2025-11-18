/**
 * Error Testing Utilities
 * Helper functions and mocks for testing error handling
 */

const {
  BaseError,
  ValidationError,
  NetworkError,
  DatabaseError,
  QueueError,
  ErrorFactory
} = require('../errors/custom-errors');

const {
  ERROR_CATEGORIES,
  SEVERITY_LEVELS,
  ERROR_CODES
} = require('../errors/error-constants');

/**
 * Error Generator for testing
 */
class ErrorGenerator {
  /**
   * Generate a random error
   */
  static random() {
    const types = ['VALIDATION', 'NETWORK', 'DATABASE', 'QUEUE', 'SYSTEM', 'AUTHENTICATION'];
    const type = types[Math.floor(Math.random() * types.length)];
    return this.generate(type);
  }

  /**
   * Generate error by type
   */
  static generate(type, options = {}) {
    const generators = {
      'VALIDATION': () => this.validationError(options),
      'NETWORK': () => this.networkError(options),
      'DATABASE': () => this.databaseError(options),
      'QUEUE': () => this.queueError(options),
      'AUTHENTICATION': () => this.authError(options),
      'SYSTEM': () => this.systemError(options)
    };

    const generator = generators[type] || generators['SYSTEM'];
    return generator();
  }

  /**
   * Generate validation error
   */
  static validationError(options = {}) {
    const fields = ['email', 'username', 'password', 'age', 'phone'];
    const field = options.field || fields[Math.floor(Math.random() * fields.length)];

    const error = new ValidationError(
      options.message || `Invalid ${field}`,
      field,
      options.value || 'test-value'
    );

    if (options.validationErrors) {
      error.validationErrors = options.validationErrors;
    }

    return error;
  }

  /**
   * Generate network error
   */
  static networkError(options = {}) {
    const messages = [
      'Connection refused',
      'Connection timeout',
      'DNS lookup failed',
      'Socket hang up'
    ];

    const message = options.message || messages[Math.floor(Math.random() * messages.length)];
    const error = new NetworkError(message, options.endpoint || 'http://test.api.com');

    if (options.code) {
      error.code = options.code;
    }

    return error;
  }

  /**
   * Generate database error
   */
  static databaseError(options = {}) {
    const messages = [
      'Connection pool exhausted',
      'Query timeout',
      'Duplicate key error',
      'Foreign key constraint failed'
    ];

    const message = options.message || messages[Math.floor(Math.random() * messages.length)];
    const error = new DatabaseError(
      message,
      options.query || 'SELECT * FROM users',
      options.code || 'ER_DUP_ENTRY'
    );

    return error;
  }

  /**
   * Generate queue error
   */
  static queueError(options = {}) {
    const error = new QueueError(
      options.message || 'Failed to publish message',
      options.queue || 'test-queue',
      options.exchange || 'test-exchange'
    );

    return error;
  }

  /**
   * Generate auth error
   */
  static authError(options = {}) {
    const error = ErrorFactory.create(
      'AUTHENTICATION',
      options.message || 'Invalid credentials'
    );

    error.statusCode = 401;
    return error;
  }

  /**
   * Generate system error
   */
  static systemError(options = {}) {
    const error = ErrorFactory.create(
      'SYSTEM',
      options.message || 'Internal server error'
    );

    error.severity = SEVERITY_LEVELS.HIGH;
    return error;
  }

  /**
   * Generate error batch
   */
  static batch(count = 10, distribution = {}) {
    const errors = [];
    const defaultDist = {
      VALIDATION: 0.3,
      NETWORK: 0.2,
      DATABASE: 0.2,
      QUEUE: 0.1,
      AUTHENTICATION: 0.1,
      SYSTEM: 0.1
    };

    const dist = { ...defaultDist, ...distribution };

    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      let cumulative = 0;

      for (const [type, probability] of Object.entries(dist)) {
        cumulative += probability;
        if (rand <= cumulative) {
          errors.push(this.generate(type));
          break;
        }
      }
    }

    return errors;
  }
}

/**
 * Mock Error Handler for testing
 */
class MockErrorHandler {
  constructor() {
    this.errors = [];
    this.handled = [];
    this.recovered = [];
  }

  async handle(error, context) {
    this.errors.push(error);
    this.handled.push({ error, context, timestamp: Date.now() });

    return {
      error: {
        code: error.code,
        message: error.message
      },
      handled: true,
      recovered: false
    };
  }

  async handleWithRecovery(error, context) {
    const result = await this.handle(error, context);
    result.recovered = true;
    this.recovered.push({ error, context });
    return result;
  }

  getErrors() {
    return this.errors;
  }

  getHandled() {
    return this.handled;
  }

  getRecovered() {
    return this.recovered;
  }

  reset() {
    this.errors = [];
    this.handled = [];
    this.recovered = [];
  }
}

/**
 * Mock Recovery System for testing
 */
class MockRecovery {
  constructor() {
    this.attempts = [];
    this.successes = [];
    this.failures = [];
  }

  async recover(error, strategy, context) {
    const attempt = {
      error,
      strategy,
      context,
      timestamp: Date.now()
    };

    this.attempts.push(attempt);

    // Simulate recovery success/failure
    const success = Math.random() > 0.5;

    if (success) {
      this.successes.push(attempt);
      return {
        success: true,
        strategy,
        attempts: 1,
        result: 'Recovered successfully'
      };
    } else {
      this.failures.push(attempt);
      return {
        success: false,
        strategy,
        error,
        reason: 'Recovery failed'
      };
    }
  }

  getAttempts() {
    return this.attempts;
  }

  getSuccesses() {
    return this.successes;
  }

  getFailures() {
    return this.failures;
  }

  reset() {
    this.attempts = [];
    this.successes = [];
    this.failures = [];
  }
}

/**
 * Error Scenario Builder
 */
class ErrorScenarioBuilder {
  constructor() {
    this.scenario = {
      name: 'Test Scenario',
      errors: [],
      expectedRecoveries: [],
      expectedAlerts: []
    };
  }

  name(name) {
    this.scenario.name = name;
    return this;
  }

  addError(type, options = {}) {
    const error = ErrorGenerator.generate(type, options);
    this.scenario.errors.push(error);
    return this;
  }

  expectRecovery(strategy) {
    this.scenario.expectedRecoveries.push(strategy);
    return this;
  }

  expectAlert(type) {
    this.scenario.expectedAlerts.push(type);
    return this;
  }

  build() {
    return this.scenario;
  }

  /**
   * Create common scenarios
   */
  static networkOutage() {
    return new ErrorScenarioBuilder()
      .name('Network Outage')
      .addError('NETWORK', { message: 'Connection refused' })
      .addError('NETWORK', { message: 'Connection timeout' })
      .addError('NETWORK', { message: 'DNS lookup failed' })
      .expectRecovery('RETRY')
      .expectRecovery('CIRCUIT_BREAK')
      .expectAlert('ERROR_SPIKE')
      .build();
  }

  static databaseFailure() {
    return new ErrorScenarioBuilder()
      .name('Database Failure')
      .addError('DATABASE', { message: 'Connection pool exhausted' })
      .addError('DATABASE', { message: 'Query timeout' })
      .expectRecovery('RETRY')
      .expectRecovery('FALLBACK')
      .expectAlert('THRESHOLD_EXCEEDED')
      .build();
  }

  static validationStorm() {
    return new ErrorScenarioBuilder()
      .name('Validation Storm')
      .addError('VALIDATION', { field: 'email' })
      .addError('VALIDATION', { field: 'password' })
      .addError('VALIDATION', { field: 'username' })
      .expectRecovery('FAIL_FAST')
      .build();
  }

  static cascadingFailure() {
    return new ErrorScenarioBuilder()
      .name('Cascading Failure')
      .addError('NETWORK', { message: 'API timeout' })
      .addError('DATABASE', { message: 'Connection lost' })
      .addError('QUEUE', { message: 'Channel closed' })
      .addError('SYSTEM', { message: 'Out of memory' })
      .expectRecovery('CIRCUIT_BREAK')
      .expectRecovery('DEGRADE')
      .expectAlert('CASCADING_FAILURE')
      .expectAlert('CRITICAL_ERROR')
      .build();
  }
}

/**
 * Circuit Breaker Test Helper
 */
class CircuitBreakerTester {
  constructor(circuitBreaker) {
    this.circuitBreaker = circuitBreaker;
    this.results = [];
  }

  async testTransitions() {
    const results = {
      closedToOpen: false,
      openToHalfOpen: false,
      halfOpenToClosed: false,
      halfOpenToOpen: false
    };

    // Test CLOSED to OPEN
    for (let i = 0; i < 10; i++) {
      try {
        await this.circuitBreaker.execute(() => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }
    }

    if (this.circuitBreaker.state === 'OPEN') {
      results.closedToOpen = true;
    }

    // Wait for timeout
    await this.sleep(this.circuitBreaker.timeout + 100);

    // Test OPEN to HALF_OPEN
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      results.openToHalfOpen = true;
    }

    // Test HALF_OPEN to CLOSED
    await this.circuitBreaker.execute(() => Promise.resolve('success'));

    if (this.circuitBreaker.state === 'CLOSED') {
      results.halfOpenToClosed = true;
    }

    return results;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Error Assertion Helpers
 */
class ErrorAssertions {
  static assertErrorType(error, expectedType) {
    if (error.constructor.name !== expectedType) {
      throw new Error(`Expected error type ${expectedType}, got ${error.constructor.name}`);
    }
  }

  static assertErrorCode(error, expectedCode) {
    if (error.code !== expectedCode) {
      throw new Error(`Expected error code ${expectedCode}, got ${error.code}`);
    }
  }

  static assertErrorCategory(error, expectedCategory) {
    if (error.category !== expectedCategory) {
      throw new Error(`Expected error category ${expectedCategory}, got ${error.category}`);
    }
  }

  static assertErrorSeverity(error, expectedSeverity) {
    if (error.severity !== expectedSeverity) {
      throw new Error(`Expected error severity ${expectedSeverity}, got ${error.severity}`);
    }
  }

  static assertRecoverySuccess(result) {
    if (!result.success) {
      throw new Error('Expected recovery to succeed');
    }
  }

  static assertRecoveryStrategy(result, expectedStrategy) {
    if (result.strategy !== expectedStrategy) {
      throw new Error(`Expected recovery strategy ${expectedStrategy}, got ${result.strategy}`);
    }
  }
}

/**
 * Performance Test Helper
 */
class ErrorPerformanceTester {
  async testErrorHandlingPerformance(iterations = 1000) {
    const results = {
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errors: []
    };

    for (let i = 0; i < iterations; i++) {
      const error = ErrorGenerator.random();
      const start = process.hrtime.bigint();

      try {
        // Test error handling
        await this.handleError(error);
      } catch (e) {
        results.errors.push(e);
      }

      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to ms

      results.totalTime += duration;
      results.minTime = Math.min(results.minTime, duration);
      results.maxTime = Math.max(results.maxTime, duration);
    }

    results.averageTime = results.totalTime / iterations;
    return results;
  }

  async handleError(error) {
    // Simulate error handling
    return new Promise(resolve => {
      setTimeout(() => resolve({ handled: true }), Math.random() * 10);
    });
  }
}

module.exports = {
  ErrorGenerator,
  MockErrorHandler,
  MockRecovery,
  ErrorScenarioBuilder,
  CircuitBreakerTester,
  ErrorAssertions,
  ErrorPerformanceTester
};