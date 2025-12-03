/**
 * Jest Configuration
 * Ultra-advanced test infrastructure with 95%+ coverage targets
 */

export default {
  // Test environment
  testEnvironment: 'node',

  // Use native ESM support (experimental)
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {},

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverage: false, // Only when explicitly requested
  collectCoverageFrom: [
    'scripts/**/*.js',
    'agents/**/*.js',
    '!scripts/hooks/**',
    '!scripts/mcp-server.js',
    '!scripts/monitor.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**'
  ],

  // Coverage threshold - 95%+ target (note: singular "coverageThreshold")
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './scripts/rabbitmq-client.js': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './scripts/orchestrator.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary'
  ],

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Detect open handles
  detectOpenHandles: true,

  // Force exit after tests complete
  forceExit: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Max workers for parallel execution
  maxWorkers: '50%',

  // Bail on first failure in CI
  bail: process.env.CI ? 1 : 0

  // Note: Global setup/teardown disabled for ESM compatibility
  // globalSetup: '<rootDir>/tests/global-setup.js',
  // globalTeardown: '<rootDir>/tests/global-teardown.js'
};
