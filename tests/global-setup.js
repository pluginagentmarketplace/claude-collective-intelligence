/**
 * Global Setup
 * Runs once before all test suites
 */

export default async function globalSetup() {
  console.log('\n=== Starting Test Suite ===');
  console.log('Environment: test');
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
  console.log('===========================\n');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';

  // Add any global setup needed here
  // e.g., start test database, initialize test services, etc.
}
