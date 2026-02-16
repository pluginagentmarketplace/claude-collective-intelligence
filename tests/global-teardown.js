/**
 * Global Teardown
 * Runs once after all test suites
 */

export default async function globalTeardown() {
  console.log('\n=== Test Suite Complete ===');
  console.log('Cleaning up test environment...');
  console.log('===========================\n');

  // Add any global cleanup needed here
  // e.g., stop test database, clean up test files, etc.

  // Force exit to prevent hanging
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}
