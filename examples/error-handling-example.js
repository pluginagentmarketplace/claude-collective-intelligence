/**
 * Error Handling System - Usage Examples
 * Demonstrates how to use the comprehensive error handling system
 */

const {
  // Error classes
  ValidationError,
  NetworkError,
  DatabaseError,
  QueueError,
  ErrorFactory,

  // Handler
  errorHandler,
  handle,
  initialize,

  // Recovery
  Recovery,

  // Monitor
  Monitor,

  // Formatter
  Formatter,

  // Constants
  ERROR_CATEGORIES,
  SEVERITY_LEVELS,
  RECOVERY_STRATEGIES
} = require('../src/errors');

// Test utilities
const {
  ErrorGenerator,
  ErrorScenarioBuilder,
  MockErrorHandler
} = require('../src/utils/error-test-utils');

/**
 * Example 1: Basic Error Handling
 */
async function basicErrorHandling() {
  console.log('\n=== Example 1: Basic Error Handling ===\n');

  try {
    // Simulate an operation that fails
    throw new ValidationError('Invalid email format', 'email', 'not-an-email');
  } catch (error) {
    // Handle the error
    const result = await handle(error, {
      userId: '12345',
      operation: 'user-registration'
    });

    console.log('Error handled:', JSON.stringify(result.error, null, 2));
    console.log('Was recovered?', result.recovered);
  }
}

/**
 * Example 2: Error Recovery with Retry
 */
async function errorRecoveryWithRetry() {
  console.log('\n=== Example 2: Error Recovery with Retry ===\n');

  let attemptCount = 0;
  const unreliableOperation = async () => {
    attemptCount++;
    console.log(`Attempt ${attemptCount}`);

    if (attemptCount < 3) {
      throw new NetworkError('Connection timeout', 'https://api.example.com');
    }

    return { success: true, data: 'Operation succeeded!' };
  };

  const error = new NetworkError('Initial connection failed', 'https://api.example.com');

  const recoveryResult = await Recovery.recover(
    error,
    RECOVERY_STRATEGIES.RETRY,
    {
      operation: unreliableOperation,
      maxRetries: 5,
      retryConfig: {
        maxAttempts: 5,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitterRange: [0.8, 1.2]
      }
    }
  );

  console.log('Recovery result:', recoveryResult);
}

/**
 * Example 3: Circuit Breaker Pattern
 */
async function circuitBreakerExample() {
  console.log('\n=== Example 3: Circuit Breaker Pattern ===\n');

  const failingOperation = async () => {
    throw new DatabaseError('Connection pool exhausted');
  };

  // Simulate multiple failures to open circuit
  for (let i = 0; i < 7; i++) {
    const error = new DatabaseError('Database unavailable');

    const result = await Recovery.recover(
      error,
      RECOVERY_STRATEGIES.CIRCUIT_BREAK,
      {
        operation: failingOperation,
        circuitKey: 'database-main'
      }
    );

    console.log(`Attempt ${i + 1}:`, result.state || 'No state', '-', result.success ? 'Success' : 'Failed');

    // Small delay between attempts
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Example 4: Fallback Strategy
 */
async function fallbackStrategyExample() {
  console.log('\n=== Example 4: Fallback Strategy ===\n');

  const primaryOperation = async () => {
    throw new NetworkError('API endpoint unavailable');
  };

  const fallbackData = {
    source: 'cache',
    timestamp: new Date().toISOString(),
    data: ['cached-item-1', 'cached-item-2', 'cached-item-3']
  };

  const error = new NetworkError('Primary service failed');

  const result = await Recovery.recover(
    error,
    RECOVERY_STRATEGIES.FALLBACK,
    {
      operation: primaryOperation,
      fallback: () => {
        console.log('Using cached fallback data');
        return fallbackData;
      }
    }
  );

  console.log('Fallback result:', result);
}

/**
 * Example 5: Error Monitoring and Alerts
 */
async function errorMonitoringExample() {
  console.log('\n=== Example 5: Error Monitoring and Alerts ===\n');

  // Initialize monitor
  await Monitor.initialize({
    enableAlerts: true,
    alertChannels: [{
      name: 'console',
      send: async (alert) => {
        console.log('📨 ALERT:', alert.type, '-', alert.message);
      }
    }]
  });

  // Generate multiple errors to trigger alerts
  const errors = ErrorGenerator.batch(15, {
    VALIDATION: 0.2,
    NETWORK: 0.3,
    DATABASE: 0.3,
    SYSTEM: 0.2
  });

  for (const error of errors) {
    await Monitor.recordError(error, {
      source: 'monitoring-example'
    });
  }

  // Get statistics
  const stats = Monitor.getStatistics();
  console.log('\nError Statistics:');
  console.log('- Total errors:', stats.total);
  console.log('- Last 5 minutes:', stats.last5Minutes);
  console.log('- By category:', stats.byCategory);
  console.log('- By severity:', stats.bySeverity);
  console.log('- Health score:', stats.healthScore);
}

/**
 * Example 6: Custom Error Handlers
 */
async function customErrorHandlerExample() {
  console.log('\n=== Example 6: Custom Error Handlers ===\n');

  // Register custom handler for specific error type
  errorHandler.registerHandler('ValidationError', async (error, context) => {
    console.log('Custom validation handler activated');

    // Custom logic for validation errors
    if (error.field === 'email') {
      return {
        error: {
          message: 'Please provide a valid email address (e.g., user@example.com)',
          field: error.field,
          suggestions: [
            'Check for typos',
            'Ensure @ symbol is present',
            'Verify domain name'
          ]
        },
        handled: true,
        customHandled: true
      };
    }

    return null; // Let default handler process
  });

  // Test custom handler
  const emailError = new ValidationError('Invalid email', 'email', 'bad-email');
  const result = await handle(emailError);

  console.log('Custom handled result:', JSON.stringify(result, null, 2));
}

/**
 * Example 7: Error Formatting
 */
async function errorFormattingExample() {
  console.log('\n=== Example 7: Error Formatting ===\n');

  const error = new DatabaseError(
    'Unique constraint violation',
    'INSERT INTO users (email) VALUES (?)',
    'ER_DUP_ENTRY'
  );

  error.details = {
    table: 'users',
    field: 'email',
    value: 'user@example.com'
  };

  const formatter = new Formatter();

  // Standard format
  console.log('Standard format:');
  console.log(JSON.stringify(formatter.format(error), null, 2));

  // Detailed format
  console.log('\nDetailed format:');
  console.log(JSON.stringify(formatter.format(error, { format: 'detailed' }), null, 2));

  // Minimal format
  console.log('\nMinimal format:');
  console.log(JSON.stringify(formatter.format(error, { format: 'minimal' }), null, 2));

  // CLI format
  console.log('\nCLI format:');
  console.log(formatter.formatCLI(error));
}

/**
 * Example 8: Complex Scenario - Cascading Failure
 */
async function cascadingFailureScenario() {
  console.log('\n=== Example 8: Cascading Failure Scenario ===\n');

  const scenario = ErrorScenarioBuilder.cascadingFailure();

  console.log(`Running scenario: ${scenario.name}`);
  console.log(`Errors to simulate: ${scenario.errors.length}`);
  console.log(`Expected recoveries: ${scenario.expectedRecoveries.join(', ')}`);
  console.log(`Expected alerts: ${scenario.expectedAlerts.join(', ')}\n`);

  for (const error of scenario.errors) {
    console.log(`Processing ${error.constructor.name}: ${error.message}`);

    const result = await handle(error, {
      scenario: scenario.name,
      timestamp: Date.now()
    });

    console.log(`  Status: ${result.handled ? 'Handled' : 'Not handled'}`);
    console.log(`  Recovered: ${result.recovered}\n`);

    // Simulate delay between errors
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Example 9: Express/HTTP Integration
 */
function expressIntegrationExample() {
  console.log('\n=== Example 9: Express Integration ===\n');

  console.log('Example Express setup with error handling:\n');

  const exampleCode = `
const express = require('express');
const { setupMiddleware, asyncHandler, ValidationError } = require('./src/errors');

const app = express();

// Initialize error handler
initialize({
  enableMonitoring: true,
  enableRecovery: true,
  enableAlerts: true
});

// Setup error middleware
setupMiddleware(app, {
  logging: true,
  recovery: true
});

// Example route with error handling
app.get('/users/:id', asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Validation
  if (!userId || isNaN(userId)) {
    throw new ValidationError('Invalid user ID', 'id', userId);
  }

  // Fetch user (may throw DatabaseError)
  const user = await getUserById(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json(user);
}));

app.listen(3000, () => {
  console.log('Server running with comprehensive error handling');
});`;

  console.log(exampleCode);
}

/**
 * Example 10: Testing Error Scenarios
 */
async function testingErrorScenarios() {
  console.log('\n=== Example 10: Testing Error Scenarios ===\n');

  const mockHandler = new MockErrorHandler();

  // Generate test errors
  const testErrors = [
    ErrorGenerator.validationError({ field: 'username' }),
    ErrorGenerator.networkError({ endpoint: 'test-api' }),
    ErrorGenerator.databaseError({ query: 'SELECT * FROM test' }),
    ErrorGenerator.queueError({ queue: 'test-queue' })
  ];

  // Process errors with mock handler
  for (const error of testErrors) {
    await mockHandler.handle(error, { test: true });
  }

  console.log('Test Results:');
  console.log(`- Errors handled: ${mockHandler.getHandled().length}`);
  console.log(`- Error types: ${[...new Set(mockHandler.getErrors().map(e => e.constructor.name))].join(', ')}`);

  // Simulate recovery
  await mockHandler.handleWithRecovery(testErrors[0], { test: true });
  console.log(`- Recovered errors: ${mockHandler.getRecovered().length}`);
}

/**
 * Main function to run all examples
 */
async function runExamples() {
  console.log('🛡️  ERROR HANDLING SYSTEM EXAMPLES 🛡️');
  console.log('=====================================');

  // Initialize the error handler
  await initialize({
    enableMonitoring: true,
    enableRecovery: true,
    enableAlerts: false, // Disable for examples
    logLevel: 'info'
  });

  try {
    // Run examples
    await basicErrorHandling();
    await errorRecoveryWithRetry();
    await circuitBreakerExample();
    await fallbackStrategyExample();
    await errorMonitoringExample();
    await customErrorHandlerExample();
    await errorFormattingExample();
    await cascadingFailureScenario();
    expressIntegrationExample();
    await testingErrorScenarios();

  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    // Cleanup
    await errorHandler.shutdown();
    console.log('\n✅ All examples completed!');
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  basicErrorHandling,
  errorRecoveryWithRetry,
  circuitBreakerExample,
  fallbackStrategyExample,
  errorMonitoringExample,
  customErrorHandlerExample,
  errorFormattingExample,
  cascadingFailureScenario,
  expressIntegrationExample,
  testingErrorScenarios,
  runExamples
};