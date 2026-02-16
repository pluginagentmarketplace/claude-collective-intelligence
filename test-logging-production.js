/**
 * Test Logging in Production Mode
 * Verify that logs are written to files
 */

import {
  initializeLogging,
  log,
  modules,
  performanceContext
} from './src/logger/index.js';

// Set environment to production with file logging
process.env.NODE_ENV = 'production';
process.env.LOG_TO_FILE = 'true';
process.env.LOG_TO_CONSOLE = 'true';

async function testProductionLogging() {
  console.log('=== Testing Production Logging ===\n');

  // Initialize logging with file output
  await initializeLogging({
    level: 'info',
    enableMetrics: true
  });

  console.log('Generating various log entries...\n');

  // Generate different types of logs
  for (let i = 0; i < 5; i++) {
    log.info(`Test info message ${i}`, {
      iteration: i,
      timestamp: new Date().toISOString()
    });

    if (i % 2 === 0) {
      log.error(`Test error ${i}`, {
        code: 'TEST_ERROR',
        iteration: i
      });
    }

    if (i % 3 === 0) {
      log.warn(`Test warning ${i}`, {
        threshold: 100,
        value: 150
      });
    }
  }

  // Test module loggers
  modules.agent.logInit('prod-agent-1', {
    type: 'production',
    capabilities: ['testing'],
    version: '2.0.0'
  });

  modules.mq.logConnection('connected', 'amqp://prod-server', {
    vhost: '/prod',
    heartbeat: 30
  });

  // Test performance logging
  await performanceContext('heavy-operation', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    log.info('Heavy operation completed');
  });

  // Test error with stack trace
  try {
    throw new Error('Production test error');
  } catch (error) {
    log.exception(error, 'Caught production error');
  }

  // Give time for logs to flush
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n=== Production Logging Test Complete ===');
  console.log('\nCheck the logs directory for:');
  console.log('  - combined-*.log');
  console.log('  - error-*.log');
  console.log('  - performance.log');
  console.log('  - http-*.log');

  // Shutdown
  await log.close();
}

// Run test
testProductionLogging()
  .then(() => {
    console.log('\nProduction test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Production test failed:', error);
    process.exit(1);
  });